#!/usr/bin/env python3
"""
extract-subvenciones-gobcan.py — Genera public/data/subvenciones-gobcan.json
con las concesiones de subvenciones del Gobierno de Canarias del último año,
agrupadas por municipio canario y cruzadas con tejido-social.geojson.

Fuente:
  Base de Datos Nacional de Subvenciones (BDNS) · IGAE / Ministerio de Hacienda
  API REST pública: /api/concesiones/busqueda
  Portal:           https://www.infosubvenciones.es/bdnstrans

Por qué BDNS y no datos.canarias.es:
  El dataset "Subvenciones, premios y becas del Gobierno de Canarias" de
  datos.canarias.es es un CATÁLOGO DE PROCEDIMIENTOS (convocatorias),
  sin beneficiarios ni importes concretos. La BDNS estatal sí publica
  cada concesión individual (beneficiario + NIF + importe + convocatoria
  + nivel3 = órgano gestor) y permite filtrar por:
    - regiones=79      → NUTS ES70 (CCAA Canarias)
    - organos=<ids>    → 65 órganos del Gobierno de Canarias (DIR3 A05)
    - tipoAdmon=A      → administración autonómica
    - fechaDesde/fechaHasta (DD/MM/YYYY)

Estrategia para asignar municipio (BDNS no lo expone directamente):
  1. Si beneficiario es un AYUNTAMIENTO (NIF empieza por "P"), las
     posiciones 2-5 del NIF coinciden con el cumun (provincia+mun).
     Ej. "P3804700G AYUNTAMIENTO TIJARAFE" → cumun 38047.
  2. Si el beneficiario aparece en data/tejido-social.geojson (match por
     similitud de nombre normalizado), tomamos su `municipio`.
  3. Si la convocatoria menciona explícitamente un municipio canario,
     se imputa ahí (heurística simple sobre 88 nombres).
  4. Resto: contribuyen al total archipielágico pero NO se imputan al mun.

Estructura de salida (la consume overlays/subvenciones.js):
{
  "version": "...",
  "fuente": "BDNS · API /api/concesiones/busqueda · ...",
  "periodo": "2025-05-01 / 2026-04-30",
  "n_concesiones": 24660,
  "total_eur": 234000000,
  "n_concesiones_imputadas_mun": 4120,
  "total_eur_imputado_mun": 89000000,
  "muns": {
    "<cumun>": {
      "n_concesiones": 250,
      "total_eur": 4500000,
      "nmun": "...",
      "isla": "gc",
      "top_beneficiarios": [
        { "nombre": "...", "importe": 120000, "convocatoria": "..." }
      ],
      "por_consejeria": { "CONSEJERÍA DE TURISMO Y EMPLEO": 1200000, ... }
    },
    ...
  },
  "concesiones_destacadas": [
    { "lng": -15.4, "lat": 28.1, "beneficiario": "...", "importe": 50000,
      "convocatoria": "...", "consejeria": "...", "fecha": "YYYY-MM-DD",
      "cumun": "35016", "nmun": "Palmas de Gran Canaria, Las" }
  ]
}

Uso:
  python3 scripts/extract-subvenciones-gobcan.py
  python3 scripts/extract-subvenciones-gobcan.py --desde 01/01/2025 --hasta 31/12/2025
  python3 scripts/extract-subvenciones-gobcan.py --pages 5   # debug: solo N páginas
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from datetime import date, timedelta
from pathlib import Path
from typing import Optional, Tuple

ROOT = Path("/Users/panch/KOINOS-iso")
MUNS_GEOJSON = ROOT / "public" / "canarias-municipios-poly.json"
TEJIDO_GEOJSON = ROOT / "public" / "data" / "tejido-social.geojson"
OUT = ROOT / "public" / "data" / "subvenciones-gobcan.json"

BDNS_API = "https://www.infosubvenciones.es/bdnstrans/api"
BDNS_ENDPOINT_ORGANOS = f"{BDNS_API}/organos/codigoAdmin"
BDNS_ENDPOINT_CONCESIONES = f"{BDNS_API}/concesiones/busqueda"
GOBCAN_CODIGO_ADMIN = "A05"          # DIR3 — Comunidad Autónoma de Canarias
NUTS_CANARIAS = 79                   # regiones id en BDNS para ES70 Canarias

PAGE_SIZE = 1000                     # máx aceptado por la API
USER_AGENT = "OCRE-POLIS/1.0 (datos cívicos · KOINOS)"
UMBRAL_GEORREF_EUR = 5000            # umbral para concesiones_destacadas

# Mapa nombre municipio normalizado → cumun (rellenado al cargar geojson)
MUN_NAME_TO_CUMUN: dict = {}
MUN_INFO: dict = {}                  # cumun → {nmun, isla, centroid}


# ---------------------------------------------------------------------
# Utilidades

def _norm(text: str) -> str:
    """Normaliza para fuzzy matching (sin tildes, minúsculas, sin signos)."""
    if not text:
        return ""
    t = unicodedata.normalize("NFKD", text)
    t = "".join(c for c in t if not unicodedata.combining(c))
    t = t.lower()
    t = re.sub(r"[^a-z0-9 ]", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def _fetch_json(url: str, retries: int = 3, timeout: int = 60) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT,
                                               "Accept": "application/json"})
    last_err = None
    for i in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            last_err = e
            time.sleep(1.5 * (i + 1))
    raise RuntimeError(f"fetch fallo tras {retries} intentos: {last_err} :: {url}")


def _load_muns() -> None:
    """Rellena MUN_NAME_TO_CUMUN y MUN_INFO desde el geojson canónico."""
    with open(MUNS_GEOJSON) as f:
        fc = json.load(f)
    for feat in fc["features"]:
        p = feat["properties"]
        cumun = p["cumun"]
        nmun = p["nmun"]
        isla = p["isla"]
        centroid = p.get("centroid_lnglat") or [None, None]
        MUN_INFO[cumun] = {"nmun": nmun, "isla": isla,
                           "lng": centroid[0], "lat": centroid[1]}
        # Variantes de nombre para matching
        keys = {_norm(nmun)}
        # "Palmas de Gran Canaria, Las" → "las palmas de gran canaria"
        if "," in nmun:
            parts = [x.strip() for x in nmun.split(",")]
            keys.add(_norm(" ".join(reversed(parts))))
        # Sin parts: añadir solo la primera parte
        keys.add(_norm(nmun.split(",")[0]))
        for k in keys:
            if k and k not in MUN_NAME_TO_CUMUN:
                MUN_NAME_TO_CUMUN[k] = cumun


def _load_tejido_index() -> dict:
    """
    Construye un índice { nombre_normalizado: {cumun, nmun, lng, lat,
    nombre_orig} } a partir de tejido-social.geojson.
    """
    if not TEJIDO_GEOJSON.exists():
        print(f"[warn] no encuentro {TEJIDO_GEOJSON}", file=sys.stderr)
        return {}
    with open(TEJIDO_GEOJSON) as f:
        fc = json.load(f)
    idx = {}
    for feat in fc.get("features", []):
        geom = feat.get("geometry") or {}
        if geom.get("type") != "Point":
            continue
        coords = geom.get("coordinates") or [None, None]
        p = feat.get("properties", {}) or {}
        nombre = p.get("nombre") or ""
        municipio = p.get("municipio") or ""
        if not nombre:
            continue
        cumun = MUN_NAME_TO_CUMUN.get(_norm(municipio))
        norm = _norm(nombre)
        # Indexamos varios tokens significativos
        for k in {norm}:
            if k not in idx:
                idx[k] = {
                    "cumun": cumun,
                    "municipio": municipio,
                    "lng": coords[0],
                    "lat": coords[1],
                    "nombre_orig": nombre,
                }
    return idx


def _get_organo_ids() -> list:
    """Devuelve la lista de IDs de órgano del Gobierno de Canarias (DIR3 A05)."""
    url = f"{BDNS_ENDPOINT_ORGANOS}?codigoAdmin={GOBCAN_CODIGO_ADMIN}"
    data = _fetch_json(url)
    ids = data.get("ids", [])
    if not ids:
        raise RuntimeError("BDNS no devolvió IDs para A05 Canarias")
    return ids


def _fetch_page(organos_csv: str, desde: str, hasta: str, page: int) -> dict:
    params = {
        "organos": organos_csv,
        "tipoAdmon": "A",
        "regiones": str(NUTS_CANARIAS),
        "fechaDesde": desde,
        "fechaHasta": hasta,
        "pageSize": str(PAGE_SIZE),
        "numPagina": str(page),
    }
    # BDNS quiere DD/MM/YYYY SIN URL-encode de las barras (raro pero verificado).
    qs = "&".join(f"{k}={urllib.parse.quote(v, safe='/')}" for k, v in params.items())
    url = f"{BDNS_ENDPOINT_CONCESIONES}?{qs}"
    return _fetch_json(url, timeout=120)


# ---------------------------------------------------------------------
# Cross-ref → municipio

NIF_AYTO_RE = re.compile(r"^P(\d{2})(\d{3})\d{2}[A-Z]?\b")


def _cumun_from_ayto(beneficiario: str) -> str | None:
    """P3804700G AYUNTAMIENTO TIJARAFE → cumun 38047."""
    m = NIF_AYTO_RE.match(beneficiario or "")
    if not m:
        return None
    cumun = m.group(1) + m.group(2)
    return cumun if cumun in MUN_INFO else None


def _cumun_from_tejido(beneficiario: str, tejido_idx: dict) -> tuple | None:
    """
    Busca el beneficiario por nombre normalizado en tejido-social.
    Devuelve (cumun, lng, lat, nombre_orig) o None.
    """
    if not beneficiario:
        return None
    # Eliminar prefijo NIF (letra + 8dig) si está presente
    b = re.sub(r"^[A-Z]\d{7,8}[A-Z]?\s+", "", beneficiario, flags=re.I)
    b = b.strip(" *")
    norm = _norm(b)
    if not norm or len(norm) < 6:
        return None
    # Match exacto primero
    hit = tejido_idx.get(norm)
    if hit:
        return (hit["cumun"], hit["lng"], hit["lat"], hit["nombre_orig"])
    # Match por substring (uno contiene al otro y mide al menos 12 chars)
    if len(norm) < 12:
        return None
    for k, v in tejido_idx.items():
        if len(k) < 12:
            continue
        if k in norm or norm in k:
            return (v["cumun"], v["lng"], v["lat"], v["nombre_orig"])
    return None


def _cumun_from_convocatoria(texto: str) -> Optional[str]:
    """
    Heurística simple: si el texto de la convocatoria contiene un nombre
    de municipio canario, asignar ese cumun. Útil para subvenciones
    nominativas tipo "AYUDA AL AYUNTAMIENTO DE ARUCAS".
    """
    if not texto:
        return None
    n = _norm(texto)
    # Buscar el match más largo para evitar falsos positivos
    best = None
    best_len = 0
    for name_norm, cumun in MUN_NAME_TO_CUMUN.items():
        if len(name_norm) < 6:  # evitar nombres cortos como "agüimes" → "aguimes" OK pero filtramos < 6
            continue
        if name_norm in n and len(name_norm) > best_len:
            best = cumun
            best_len = len(name_norm)
    return best


def _cumun_from_beneficiario_text(beneficiario: str) -> Optional[str]:
    """
    Igual que _cumun_from_convocatoria pero buscando el nombre de municipio
    dentro del propio nombre del beneficiario (después del NIF).
    Ej: "G35408681 UNION GENERAL DE TRABAJADORES DE CASTILLO DEL ROMERAL"
        no matchearía nada útil; pero
        "CAMARA OFICIAL DE COMERCIO IND. Y N FTVRA" tampoco resuelve.
        Sirve sobre todo para "AYUNTAMIENTO DE X", "CABILDO DE X",
        "ASOCIACIÓN DE X", etc.
    """
    if not beneficiario:
        return None
    # Quitar NIF
    b = re.sub(r"^[A-Z]\d{7,8}[A-Z]?\s+", "", beneficiario, flags=re.I)
    return _cumun_from_convocatoria(b)


# Alias de islas → cumun de la capital (para imputación coarse cuando solo
# tenemos pista de isla). Útil con beneficiarios tipo "FEDER...S/C TEN" o
# "...DE GRAN CANARIA". Devuelve el cumun de la capital, conscientemente
# imperfecto pero útil como fallback.
_ISLA_HINTS = {
    "gran canaria":  "35016",  # Las Palmas de Gran Canaria
    "tenerife":      "38038",  # Santa Cruz de Tenerife
    "s c ten":       "38038",
    "fuerteventura": "35017",  # Puerto del Rosario
    "ftvra":         "35017",
    "lanzarote":     "35017",  # (sin capital exacta, usamos Arrecife)
    "la palma":      "38037",  # Santa Cruz de La Palma
    "la gomera":     "38036",  # San Sebastián de La Gomera
    "el hierro":     "38048",  # Valverde
}
# Corrección: Lanzarote capital = Arrecife (cumun 35004)
_ISLA_HINTS["lanzarote"] = "35004"


def _cumun_from_isla_hint(texto: str) -> Optional[str]:
    if not texto:
        return None
    n = _norm(texto)
    for hint, cumun in _ISLA_HINTS.items():
        if hint in n:
            return cumun
    return None


# ---------------------------------------------------------------------
# Main

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    today = date.today()
    default_hasta = today.strftime("%d/%m/%Y")
    default_desde = (today - timedelta(days=365)).strftime("%d/%m/%Y")
    ap.add_argument("--desde", default=default_desde, help="DD/MM/YYYY")
    ap.add_argument("--hasta", default=default_hasta, help="DD/MM/YYYY")
    ap.add_argument("--pages", type=int, default=0,
                    help="Limitar páginas (0 = todas)")
    ap.add_argument("--cache", default=None,
                    help="JSON cacheado con concesiones (debug)")
    ap.add_argument("--out", default=str(OUT))
    args = ap.parse_args()

    # 1. Carga catálogos locales
    _load_muns()
    tejido_idx = _load_tejido_index()
    print(f"[init] muns canónicos: {len(MUN_INFO)} | tejido idx: {len(tejido_idx)}",
          file=sys.stderr)

    # 2. Descarga concesiones BDNS
    if args.cache and Path(args.cache).exists():
        print(f"[cache] cargando concesiones desde {args.cache}", file=sys.stderr)
        with open(args.cache) as f:
            concesiones = json.load(f)
    else:
        org_ids = _get_organo_ids()
        organos_csv = ",".join(str(x) for x in org_ids)
        print(f"[bdns] {len(org_ids)} órganos A05 Gob Canarias",
              file=sys.stderr)

        # Sondeo total
        first = _fetch_page(organos_csv, args.desde, args.hasta, 1)
        total_elements = first.get("totalElements") or 0
        total_pages = first.get("totalPages") or 1
        print(f"[bdns] {total_elements} concesiones · {total_pages} páginas "
              f"· periodo {args.desde}–{args.hasta}", file=sys.stderr)

        concesiones = list(first.get("content", []))
        max_page = total_pages
        if args.pages:
            max_page = min(max_page, args.pages)
        for p in range(2, max_page + 1):
            page = _fetch_page(organos_csv, args.desde, args.hasta, p)
            chunk = page.get("content", [])
            concesiones.extend(chunk)
            if p % 5 == 0 or p == max_page:
                print(f"[bdns] página {p}/{max_page} · acumulado "
                      f"{len(concesiones)}", file=sys.stderr)
            time.sleep(0.15)  # cortesía con la API pública

    print(f"[bdns] concesiones descargadas: {len(concesiones)}", file=sys.stderr)

    # 3. Procesar
    muns_agg: dict = {}     # cumun → {n, total, top_benef[], por_cons}
    concesiones_destacadas = []
    n_imputadas = 0
    total_eur_imputado = 0
    total_eur = 0

    for c in concesiones:
        imp = float(c.get("importe") or 0)
        total_eur += imp
        benef = c.get("beneficiario") or ""
        convo = c.get("convocatoria") or ""
        consej = c.get("nivel3") or ""
        fecha = c.get("fechaConcesion") or ""

        # Estrategias en orden de fiabilidad
        cumun = _cumun_from_ayto(benef)
        georef = None        # (lng, lat) si tenemos punto exacto
        georef_match = False # True si el match es preciso (tejido o ayto)
        if cumun:
            georef_match = True
        if not cumun:
            hit = _cumun_from_tejido(benef, tejido_idx)
            if hit:
                cumun, lng, lat, _ = hit
                if lng is not None and lat is not None:
                    georef = (lng, lat)
                georef_match = True
        if not cumun:
            cumun = _cumun_from_beneficiario_text(benef)
            if cumun:
                georef_match = True
        if not cumun:
            cumun = _cumun_from_convocatoria(convo)
        if not cumun:
            # Fallback más débil — pista de isla en beneficiario o convocatoria
            cumun = _cumun_from_isla_hint(benef) or _cumun_from_isla_hint(convo)

        if not cumun:
            continue
        if not georef:
            # Si no tenemos punto exacto pero sí cumun fiable, usar centroide
            # del municipio para destacadas (mejor que nada).
            info = MUN_INFO.get(cumun)
            if info and info.get("lng") is not None and georef_match:
                georef = (info["lng"], info["lat"])
        if cumun not in MUN_INFO:
            continue

        n_imputadas += 1
        total_eur_imputado += imp

        slot = muns_agg.setdefault(cumun, {
            "n_concesiones": 0,
            "total_eur": 0.0,
            "_top": [],      # heap manual
            "por_consejeria": {},
        })
        slot["n_concesiones"] += 1
        slot["total_eur"] += imp
        slot["por_consejeria"][consej] = slot["por_consejeria"].get(consej, 0) + imp
        # mantener top 5
        slot["_top"].append({"nombre": benef[:120], "importe": imp,
                             "convocatoria": convo[:160], "consejeria": consej,
                             "fecha": fecha})
        slot["_top"].sort(key=lambda x: -x["importe"])
        del slot["_top"][5:]

        # Concesiones destacadas: importe > umbral y georef preciso
        if imp >= UMBRAL_GEORREF_EUR and georef:
            concesiones_destacadas.append({
                "lng": round(georef[0], 5),
                "lat": round(georef[1], 5),
                "beneficiario": benef[:160],
                "importe": imp,
                "convocatoria": convo[:200],
                "consejeria": consej,
                "fecha": fecha,
                "cumun": cumun,
                "nmun": MUN_INFO[cumun]["nmun"],
            })

    # 4. Empaquetar
    muns_out = {}
    for cumun, slot in muns_agg.items():
        info = MUN_INFO[cumun]
        muns_out[cumun] = {
            "n_concesiones": slot["n_concesiones"],
            "total_eur": round(slot["total_eur"], 2),
            "nmun": info["nmun"],
            "isla": info["isla"],
            "top_beneficiarios": slot["_top"],
            "por_consejeria": {k: round(v, 2)
                               for k, v in sorted(
                                   slot["por_consejeria"].items(),
                                   key=lambda kv: -kv[1])[:8]},
        }

    payload = {
        "version": f"bdns-canarias-{date.today().isoformat()}",
        "fuente": (
            "BDNS — Base de Datos Nacional de Subvenciones · IGAE/Hacienda. "
            f"API REST {BDNS_ENDPOINT_CONCESIONES}?organos=<A05>&tipoAdmon=A&"
            f"regiones={NUTS_CANARIAS}&fechaDesde=DD/MM/YYYY&fechaHasta=DD/MM/YYYY"
        ),
        "periodo": f"{args.desde} – {args.hasta}",
        "n_concesiones": len(concesiones),
        "total_eur": round(total_eur, 2),
        "n_concesiones_imputadas_mun": n_imputadas,
        "total_eur_imputado_mun": round(total_eur_imputado, 2),
        "n_concesiones_destacadas": len(concesiones_destacadas),
        "umbral_destacadas_eur": UMBRAL_GEORREF_EUR,
        "nota": (
            "Importes en €. BDNS no expone municipio del beneficiario; "
            "la asignación municipal sigue tres estrategias en cascada: "
            "(1) NIF de ayuntamiento P##### → cumun directo; "
            "(2) cruce de nombre con data/tejido-social.geojson; "
            "(3) heurística sobre el texto de la convocatoria. "
            "Las concesiones de personas físicas (NIF enmascarado) no se "
            "imputan a municipio y solo se reflejan en el total archipielágico."
        ),
        "muns": muns_out,
        "concesiones_destacadas": concesiones_destacadas,
    }

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    # 5. Stats finales
    pct_imp_n = 100 * n_imputadas / max(1, len(concesiones))
    pct_imp_eur = 100 * total_eur_imputado / max(1, total_eur)
    print(file=sys.stderr)
    print(f"[OK] wrote {out_path}", file=sys.stderr)
    print(f"     concesiones totales:  {len(concesiones):>8}",
          file=sys.stderr)
    print(f"     imputadas a municipio: {n_imputadas:>8}  "
          f"({pct_imp_n:.1f}%)", file=sys.stderr)
    print(f"     concesiones destacadas (georref + ≥{UMBRAL_GEORREF_EUR}€): "
          f"{len(concesiones_destacadas)}", file=sys.stderr)
    print(f"     total €:               {total_eur:>14,.0f}",
          file=sys.stderr)
    print(f"     imputado a mun €:      {total_eur_imputado:>14,.0f}  "
          f"({pct_imp_eur:.1f}%)", file=sys.stderr)
    print(f"     municipios con dato:   {len(muns_out)} / 88", file=sys.stderr)

    # Top 5 muns receptores
    print(file=sys.stderr)
    print("     TOP 5 muns receptores (€ imputado):", file=sys.stderr)
    top5 = sorted(muns_out.items(),
                  key=lambda kv: -kv[1]["total_eur"])[:5]
    for cumun, m in top5:
        print(f"       {cumun}  {m['nmun']:<35}  "
              f"{m['total_eur']:>14,.0f} €  "
              f"({m['n_concesiones']} conc)", file=sys.stderr)


if __name__ == "__main__":
    main()
