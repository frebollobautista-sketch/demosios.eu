#!/usr/bin/env python3
"""
Extrae resultados electorales por sección censal para Canarias (prov 35 + 38).

Fuente: Ministerio del Interior · infoelectoral.interior.gob.es
URL base: https://infoelectoral.interior.gob.es/estaticos/docxl/apliextr/
Patrón:   <TIPO><AAAA><MM>_MESA.zip       (TIPO=02 Generales-Congreso)

ZIP contiene ficheros DAT de ancho fijo (codificación ISO-8859-1):
  03<AAAA><MM>.DAT — Catálogo de candidaturas (sigla, denominación)
  09<AAAA><MM>.DAT — Datos básicos de cada mesa electoral
                     (censo, votantes, blancos, nulos, válidos a cands.)
  10<AAAA><MM>.DAT — Votos por candidatura y mesa

Esquema según paquete R rOpenSpain/infoelectoral (GPL-3) — adaptado a
posiciones 0-indexed Python.

Producto: public/data/elecciones-canarias.json con la siguiente forma:
  {
    "version": "ISO date",
    "convocatoria": "Generales 2023 (23-J)",
    "fuente": "Ministerio del Interior",
    "secciones_total": N,
    "secciones_cubiertas": N,
    "muns": {
      "<cumun>": {
        "secciones": {
          "<cusec>": {
            "censo": int,
            "votantes": int,
            "blancos": int,
            "nulos": int,
            "validos": int,
            "partido_ganador": "SIGLA",
            "siglas_top3": ["PSOE", "PP", "CC"],
            "votos_top3": [1234, 1100, 900],
            "pct_top3": [42.1, 37.5, 30.7]
          }
        }
      }
    }
  }

Uso:
  python3 scripts/extract-resultados-electorales.py
  (descarga el ZIP a /tmp si no existe, parsea, escribe el JSON)
"""

from __future__ import annotations

import io
import json
import sys
import urllib.request
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuración de convocatoria

TIPO = "02"     # 02 = Generales Congreso, 03 = Generales Senado,
                # 04 = Municipales, 05 = Autonómicas, 06 = Cabildos,
                # 07 = Europeas. Mantenemos Congreso 23-J 2023.
ANNO = "2023"
MES  = "07"
CONVOCATORIA = "Generales 2023 (Congreso · 23-J)"

BASE_URL = "https://infoelectoral.interior.gob.es/estaticos/docxl/apliextr/"
ZIP_NAME = f"{TIPO}{ANNO}{MES}_MESA.zip"
ZIP_URL  = BASE_URL + ZIP_NAME

PROV_CANARIAS = {"35", "38"}

# Paths del repo (relativos al script, que está en scripts/)
HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DATA_DIR = ROOT / "public" / "data"
CACHE_DIR = Path("/tmp")
OUT_JSON = DATA_DIR / "elecciones-canarias.json"
ZIP_CACHE = CACHE_DIR / ZIP_NAME

# Cuántas siglas top mostrar por sección
TOP_N = 3

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


# ---------------------------------------------------------------------------
# 1. Descarga (con cache local)

def fetch_zip() -> bytes:
    if ZIP_CACHE.exists() and ZIP_CACHE.stat().st_size > 1_000_000:
        print(f"[cache] {ZIP_CACHE} ({ZIP_CACHE.stat().st_size:,} bytes)")
        return ZIP_CACHE.read_bytes()

    print(f"[download] {ZIP_URL}")
    req = urllib.request.Request(ZIP_URL, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    ZIP_CACHE.write_bytes(data)
    print(f"[saved] {ZIP_CACHE} ({len(data):,} bytes)")
    return data


# ---------------------------------------------------------------------------
# 2. Parseo de ficheros DAT

def _decode(line_bytes: bytes) -> str:
    # ISO-8859-1 nunca falla; los caracteres latinos quedan correctos.
    return line_bytes.decode("iso-8859-1", errors="replace").rstrip("\r\n")


def parse_partidos(dat_bytes: bytes) -> dict[str, dict]:
    """Devuelve {codigo_partido_6dig: {'siglas': str, 'denominacion': str}}."""
    out: dict[str, dict] = {}
    for raw in dat_bytes.split(b"\n"):
        if not raw.strip():
            continue
        line = _decode(raw)
        if len(line) < 64:
            continue
        codigo = line[8:14]           # 6 dígitos
        siglas = line[14:64].strip()  # 50 chars
        denom  = line[64:214].strip() if len(line) >= 214 else ""
        # Normaliza siglas con espacios internos o trailing
        if not codigo or not siglas:
            continue
        out[codigo] = {"siglas": siglas, "denominacion": denom}
    return out


def parse_mesa_basico(dat_bytes: bytes) -> dict[str, dict]:
    """
    Lee fichero 09 (mesa básico). Devuelve dict por cusec con los agregados:
      cusec → { 'censo':, 'votantes':, 'blancos':, 'nulos':, 'validos': }

    cusec = prov(2) + mun(3) + dist(2) + secc(3).
    En el fichero secc viene como 4 chars con un espacio trailing.
    """
    agg: dict[str, dict] = {}
    for raw in dat_bytes.split(b"\n"):
        if not raw.strip():
            continue
        line = _decode(raw)
        if len(line) < 90:
            continue
        prov = line[11:13]
        if prov not in PROV_CANARIAS:
            continue
        mun  = line[13:16]
        dist = line[16:18]
        secc = line[18:22].strip().zfill(3)
        cusec = f"{prov}{mun}{dist}{secc}"
        try:
            censo     = int(line[23:30])
            votantes2 = int(line[58:65])   # participación 2º avance (definitivo)
            blancos   = int(line[65:72])
            nulos     = int(line[72:79])
            validos_c = int(line[79:86])
        except ValueError:
            continue
        rec = agg.setdefault(cusec, {
            "censo": 0, "votantes": 0,
            "blancos": 0, "nulos": 0, "validos": 0,
        })
        rec["censo"]    += censo
        rec["votantes"] += votantes2
        rec["blancos"]  += blancos
        rec["nulos"]    += nulos
        rec["validos"]  += validos_c
    return agg


def parse_mesa_votos(dat_bytes: bytes) -> dict[str, dict[str, int]]:
    """
    Lee fichero 10 (votos candidatura×mesa). Devuelve cusec → {codigo_partido: votos}.
    Suma las mesas A/B/U de cada sección.
    """
    out: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for raw in dat_bytes.split(b"\n"):
        if not raw.strip():
            continue
        line = _decode(raw)
        if len(line) < 37:
            continue
        prov = line[11:13]
        if prov not in PROV_CANARIAS:
            continue
        mun  = line[13:16]
        dist = line[16:18]
        secc = line[18:22].strip().zfill(3)
        cusec = f"{prov}{mun}{dist}{secc}"
        codigo_partido = line[23:29]
        try:
            votos = int(line[29:36])
        except ValueError:
            continue
        if votos <= 0:
            continue
        out[cusec][codigo_partido] += votos
    return {k: dict(v) for k, v in out.items()}


# ---------------------------------------------------------------------------
# 3. Composición del JSON final

def build_dataset(zip_bytes: bytes) -> dict:
    print("[extract] abriendo ZIP en memoria")
    z = zipfile.ZipFile(io.BytesIO(zip_bytes))
    fnames = z.namelist()

    def _pick(prefix: str) -> str:
        for n in fnames:
            base = n.split("/")[-1].upper()
            if base.startswith(prefix) and base.endswith(".DAT"):
                return n
        raise KeyError(f"No encuentro fichero con prefijo {prefix} en {fnames}")

    f03 = _pick("03")
    f09 = _pick("09")
    f10 = _pick("10")
    print(f"[extract] partidos={f03}  mesa={f09}  votos={f10}")

    partidos = parse_partidos(z.read(f03))
    print(f"[extract] partidos parseados: {len(partidos):,}")

    mesa_basico = parse_mesa_basico(z.read(f09))
    print(f"[extract] secciones canarias (09): {len(mesa_basico):,}")

    mesa_votos = parse_mesa_votos(z.read(f10))
    print(f"[extract] secciones canarias con votos (10): {len(mesa_votos):,}")

    # Construye el árbol por mun → cusec
    muns: dict[str, dict] = {}
    cubiertas = 0

    for cusec, base in sorted(mesa_basico.items()):
        cumun = cusec[:5]
        votos_part = mesa_votos.get(cusec, {})
        # Convierte codigo→siglas y ordena descendente por votos
        items = []
        for codigo, votos in votos_part.items():
            sig = (partidos.get(codigo) or {}).get("siglas") or codigo
            items.append((sig, votos))
        items.sort(key=lambda kv: kv[1], reverse=True)

        if items:
            cubiertas += 1
        top = items[:TOP_N]
        siglas_top = [s for s, _ in top]
        votos_top  = [v for _, v in top]
        validos = base["validos"] or 1
        pct_top = [round(v * 100 / validos, 2) for v in votos_top]
        ganador = siglas_top[0] if siglas_top else None

        rec = {
            "censo": base["censo"],
            "votantes": base["votantes"],
            "blancos": base["blancos"],
            "nulos": base["nulos"],
            "validos": base["validos"],
            "partido_ganador": ganador,
            "siglas_top3": siglas_top,
            "votos_top3": votos_top,
            "pct_top3": pct_top,
        }
        muns.setdefault(cumun, {"secciones": {}})["secciones"][cusec] = rec

    total = len(mesa_basico)
    print(f"[build] muns canarias: {len(muns)}")
    print(f"[build] secciones totales: {total}  con votos: {cubiertas} "
          f"({cubiertas*100/total:.1f}%)")

    return {
        "version": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "convocatoria": CONVOCATORIA,
        "fuente": "Ministerio del Interior (infoelectoral.interior.gob.es)",
        "fuente_zip": ZIP_URL,
        "ambito": "Canarias (provincias 35 y 38)",
        "secciones_total": total,
        "secciones_cubiertas": cubiertas,
        "muns": muns,
    }


# ---------------------------------------------------------------------------
# 4. Main

def main() -> int:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    zip_bytes = fetch_zip()
    dataset = build_dataset(zip_bytes)

    OUT_JSON.write_text(
        json.dumps(dataset, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"[write] {OUT_JSON}  ({OUT_JSON.stat().st_size:,} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
