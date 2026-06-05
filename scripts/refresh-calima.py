#!/usr/bin/env python3
"""
refresh-calima.py — Genera/actualiza public/data/calima-estado.json con el
nivel de polvo sahariano (calima) actual y su pronóstico a 48h.

Estado: PLACEHOLDER estructural. El esquema es el que consume el overlay
`public/polis-app/overlays/calima.js` (RIE-05). Para datos en vivo hay
tres caminos, ordenados por viabilidad técnica:

  Opción A — BDRC / AEMET dust (preferida)
  =========================================
    https://dust.aemet.es  (WMO Barcelona Dust Regional Center)
    Modelo MONARCH operacional (BSC). Salida en netCDF 0.1° x 0.1°,
    cadencia 3h, horizonte 72h. Variables clave: `od550_dust` (Dust
    Optical Depth) y `sconc_dust` (Dust Surface Concentration µg/m³).
    Acceso: THREDDS Data Server (TDS) referenciado en la User Guide del
    portal. La página `/products/data-download` redirige a la guía PDF
    para los URLs concretos del TDS — hay que descargarla manualmente
    para confirmar el endpoint estable (no aparece linkado en HTML).
    Pseudo-pipeline:
      1. Bajar slice netCDF para bbox Canarias (lat 27.5..29.5, lng -18.5..-13.0)
      2. Extraer sconc_dust media en cada isla (FV, LZ, GC, TF, LP, LG, EH)
      3. Mapear µg/m³ → nivel via `LEYENDA` y poblar `afecta_islas`
      4. Tomar horizonte +24h y +48h para `fecha_pronostico`/`horas_validez`
    Requiere netCDF4 + numpy. Sin clave por ahora pero podría requerirla.

  Opción B — AEMET OpenData avisos
  ================================
    https://opendata.aemet.es/centrodedescargas/inicio
    API REST con API key gratuita. Endpoint relevante:
      /opendata/api/avisos_cap/ultimoelaborado/area/61   (Canarias)
    Devuelve CAP-XML con avisos meteo. Filtrar por
    `<eventCode><valueName>AEMET-Meteoalerta fenomeno</valueName>
       <value>PI</value></eventCode>` (PI = Polvo en suspensión).
    Nivel a partir del color CAP (verde/amarillo/naranja/rojo).
    Mucho más simple que A) pero sólo da nivel cualitativo, no PM10.

  Opción C — Proxy AQICN PM10 sostenido
  =====================================
    Cruzar con `calidad-aire-canarias.json`: si N estaciones canarias
    tienen PM10>50 µg/m³ durante >24h en condiciones secas, es calima.
    Pragmático pero no permite pronóstico (sólo nowcast).

Uso:
    # Placeholder estructural (default)
    python3 scripts/refresh-calima.py

    # Intento AEMET avisos (requiere key)
    python3 scripts/refresh-calima.py --source aemet --api-key XYZ

    # Intento BDRC MONARCH (no implementado todavía)
    python3 scripts/refresh-calima.py --source bdrc
"""

import argparse
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path("/Users/panch/KOINOS-iso")
OUT = ROOT / "public" / "data" / "calima-estado.json"

ALL_ISLAS = ["fv", "lz", "gc", "tf", "lp", "lg", "eh"]

LEYENDA = {
    "bajo":      {"pm10_min": 0,    "color": "#4aaa5a", "desc": "Aire limpio"},
    "moderado":  {"pm10_min": 50,   "color": "#d4c44a", "desc": "Polvo perceptible"},
    "alto":      {"pm10_min": 100,  "color": "#e68a4f", "desc": "Episodio de calima"},
    "muy_alto":  {"pm10_min": 200,  "color": "#c45a4a", "desc": "Calima intensa - cerrar ventanas"},
    "extremo":   {"pm10_min": 500,  "color": "#9f4fe6", "desc": "Calima excepcional"}
}

# Niveles ordenados por gravedad ascendente para mapeo numérico <-> str
NIVEL_ORDEN = ["bajo", "moderado", "alto", "muy_alto", "extremo"]


def pm10_to_nivel(pm10):
    """Devuelve la clave de nivel para un valor PM10 dado."""
    nivel = "bajo"
    for n in NIVEL_ORDEN:
        if pm10 >= LEYENDA[n]["pm10_min"]:
            nivel = n
    return nivel


def placeholder_payload():
    """Escenario tipo episodio primaveral moderado. Valores realistas para
    finales de mayo: intrusion ligera entrando por FV/LZ, propagándose
    a GC/TF en 24h. LP/LG/EH al margen.

    Si necesitas otro escenario para probar el overlay, edita estos
    valores o pasa --simulate {bajo,alto,muy_alto,extremo}.
    """
    now = datetime.now(timezone.utc)
    return {
        "version": "v0-placeholder-2026-05-27",
        "fuente": "TODO: integrar AEMET avisos (opendata.aemet.es) + BDRC dust.aemet.es (MONARCH netCDF) + NAAPS NRL como cross-check",
        "fuente_pretendida": {
            "primaria": "BDRC MONARCH (https://dust.aemet.es) — netCDF 0.1deg, 3h, 72h forecast, Dust Surface Concentration",
            "secundaria": "AEMET opendata — avisos fenomeno=polvo&area=can (requiere API key gratis en opendata.aemet.es)",
            "cross_check": "NAAPS NRL FNMOC (https://www.nrlmry.navy.mil/aerosol/) — sólo PNG, sin endpoint estable, scraping frágil",
            "proxy_aqicn": "PM10 sostenido >50 µg/m³ varios días en estaciones canarias durante sequía => calima (fallback)"
        },
        "actualizado": now.isoformat(timespec="seconds"),
        "nivel_actual": "moderado",
        "valor_pm10_proxy": 65,
        "afecta_islas": ["fv", "lz", "gc", "tf"],
        "fecha_pronostico": now.date().isoformat(),
        "horas_validez": 48,
        "comentario": "Episodio primaveral de intrusion sahariana — afecta principalmente islas orientales (FV/LZ) con propagacion progresiva a GC/TF. LP/LG/EH quedan al margen del flujo en este escenario.",
        "leyenda": LEYENDA,
        "_placeholder": True
    }


def simulate_payload(nivel):
    """Genera un payload sintético en el nivel pedido (para testing overlay)."""
    base = placeholder_payload()
    pm10_demo = {
        "bajo": 12,
        "moderado": 65,
        "alto": 130,
        "muy_alto": 280,
        "extremo": 620
    }.get(nivel, 65)
    base["nivel_actual"] = nivel
    base["valor_pm10_proxy"] = pm10_demo
    # En extremo afecta a todo el archipiélago; en bajo a ninguna
    if nivel == "bajo":
        base["afecta_islas"] = []
    elif nivel in ("alto", "muy_alto", "extremo"):
        base["afecta_islas"] = ALL_ISLAS
    return base


def download_real_source(source, api_key=None):
    """Stub para integrar fuente real. Devuelve dict si tiene éxito, None si
    debe caer al placeholder.

    TODO por fuente:

      source="aemet"  (AVISOS · CAP-XML)
        - GET https://opendata.aemet.es/opendata/api/avisos_cap/ultimoelaborado/area/61
          headers={"api_key": api_key}
        - Parsear XML, buscar <event>POLVO ...</event> en cualquier <info>
        - Mapear <urgency>/<severity> a {moderado, alto, muy_alto}
        - Obtener `afecta_islas` desde <areaDesc> o <geocode> del CAP

      source="bdrc"  (MONARCH netCDF — Barcelona Dust Regional Center)
        - URL TDS: por confirmar (descargar User Guide del portal)
        - Variable sconc_dust @ surface, slice bbox 27.5..29.5N -18.5..-13.0W
        - Cargar con netCDF4, np.nanmean por isla (necesita máscaras isla)
        - +24h y +48h: leer dim `time` y filtrar offsets

      source="naaps"  (NAAPS NRL FNMOC)
        - Sólo PNG con runs en URL tipo /aerosol/Case_studies/...
        - No hay endpoint estable. Scraping frágil. NO RECOMENDADO.
    """
    if source == "aemet":
        if not api_key:
            print("[refresh-calima] --source aemet requiere --api-key", file=sys.stderr)
            return None
        # Aquí iría: requests.get(..., headers={"api_key": api_key})
        # parsear, mapear, devolver dict completo siguiendo placeholder_payload()
        print("[refresh-calima] AEMET avisos: stub no implementado todavía", file=sys.stderr)
        return None

    if source == "bdrc":
        # Aquí iría: netCDF4.Dataset(TDS_URL_CON_BBOX_CANARIAS)
        print("[refresh-calima] BDRC MONARCH: stub no implementado todavía", file=sys.stderr)
        return None

    if source == "naaps":
        print("[refresh-calima] NAAPS sólo PNG, scraping frágil — no implementado", file=sys.stderr)
        return None

    return None


def main():
    parser = argparse.ArgumentParser(description="Refresca el estado de calima (RIE-05) para POLIS")
    parser.add_argument("--source", choices=["placeholder", "aemet", "bdrc", "naaps"],
                        default="placeholder", help="Fuente de datos (default: placeholder)")
    parser.add_argument("--api-key", help="API key para AEMET opendata")
    parser.add_argument("--simulate", choices=NIVEL_ORDEN,
                        help="Fuerza un nivel concreto en el placeholder (para testing overlay)")
    args = parser.parse_args()

    payload = None
    if args.source != "placeholder":
        payload = download_real_source(args.source, api_key=args.api_key)
        if payload is None:
            print(f"[refresh-calima] fallback a placeholder (fuente {args.source} no disponible)", file=sys.stderr)

    if payload is None:
        payload = simulate_payload(args.simulate) if args.simulate else placeholder_payload()

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"wrote {OUT}", file=sys.stderr)
    print(f"  nivel_actual:   {payload['nivel_actual']}", file=sys.stderr)
    print(f"  pm10_proxy:     {payload['valor_pm10_proxy']}", file=sys.stderr)
    print(f"  afecta_islas:   {payload['afecta_islas']}", file=sys.stderr)
    print(f"  horas_validez:  {payload['horas_validez']}h", file=sys.stderr)
    print(f"  fuente:         {payload['fuente']}", file=sys.stderr)


if __name__ == "__main__":
    main()
