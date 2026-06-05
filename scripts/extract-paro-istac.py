#!/usr/bin/env python3
"""
extract-paro-istac.py — Genera public/data/paro-registrado-muns.json
con el % de paro registrado para los 88 municipios canarios.

Fuente: ISTAC — Estadística de Población Activa Registrada (EPA-Reg)
Dataset: C00069A_000001 ("Población activa registrada según situación
laboral, sexos y grupos de edad. Islas y municipios de Canarias por
trimestres")
Frecuencia: trimestral (la actualización más reciente suele tener un
desfase de ~2 meses tras el cierre del trimestre).

Por qué este dataset y no el mensual de paro (E59021A_000010):
- Este dataset incluye en la misma tabla el numerador (UNE_REG = paro
  registrado) y el denominador (ACT_REG = población activa registrada),
  ambos referidos al mismo periodo y misma metodología ISTAC. Eso permite
  calcular tasa de paro municipal coherente sin tener que cruzar dos
  marcos temporales (mensual vs trimestral) ni asumir poblaciones activas.
- Cubre los 88 municipios (incluido el caso especial Frontera 38013_2007
  que ISTAC marca por la división territorial de 2007).

Estructura de salida (la consume public/polis-app/overlays/paro.js):
{
  "version": "...",
  "fuente": "ISTAC C00069A_000001",
  "fecha_dato": "YYYY-Qn",
  "nota": "...",
  "muns": {
    "<cumun_5digit>": {
      "paro_pct": 14.2,
      "paro_n":   2453,
      "activa_n": 17270,
      "fecha":    "2026-Q1",
      "nmun":     "...",
      "isla":     "gc|tf|lz|fv|lp|lg|eh"
    },
    ...
  }
}

Uso:
  python3 scripts/extract-paro-istac.py
  python3 scripts/extract-paro-istac.py --version 1.13  # versión específica
  python3 scripts/extract-paro-istac.py --period 2025-Q4  # trimestre específico

La URL versionada del dataset puede cambiar al publicarse un nuevo
trimestre (1.12 → 1.13 → ...). Para resolverla automáticamente desde el
endpoint v1.0 de ISTAC, ver scripts/_resolve_istac_version.py (TODO).
"""

import argparse
import csv
import json
import sys
import urllib.request
from io import StringIO
from pathlib import Path

ROOT = Path("/Users/panch/KOINOS-iso")
MUNS_GEOJSON = ROOT / "public" / "canarias-municipios-poly.json"
OUT = ROOT / "public" / "data" / "paro-registrado-muns.json"

ISTAC_DATASET_ID = "C00069A_000001"
ISTAC_DEFAULT_VERSION = "1.12"  # actualizar al publicarse nueva versión
ISTAC_URL_TEMPLATE = (
    "https://datos.canarias.es/api/estadisticas/statistical-resources/v1.0/"
    "datasets/ISTAC/{dataset_id}/{version}.csv"
)

# ISTAC codifica Frontera (38013) como 38013_2007 por la división
# territorial post-creación de El Pinar (38901) en 2007. El resto de
# 5-dígitos coincide con el cumun.
ISTAC_TO_CUMUN_OVERRIDES = {
    "38013_2007": "38013",
}


def download_real_source(version: str = ISTAC_DEFAULT_VERSION) -> str:
    """Descarga el CSV de ISTAC. Devuelve el contenido como string UTF-8."""
    url = ISTAC_URL_TEMPLATE.format(dataset_id=ISTAC_DATASET_ID, version=version)
    print(f"[ISTAC] fetching {url}", file=sys.stderr)
    req = urllib.request.Request(url, headers={"User-Agent": "OCRE-POLIS/1.0"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        return resp.read().decode("utf-8")


def latest_period(csv_text: str) -> str:
    """Devuelve el TIME_PERIOD_CODE más reciente presente en el CSV."""
    reader = csv.DictReader(StringIO(csv_text))
    periods = set()
    for row in reader:
        periods.add(row["TIME_PERIOD_CODE"])
    # 'YYYY-Qn' ordena lexicográficamente bien
    return sorted(periods)[-1]


def parse_to_json(csv_text: str, period: str) -> dict:
    """
    Parsea el CSV ISTAC y devuelve un dict {cumun: {ACT_REG, UNE_REG, EMP_REG, name}}
    filtrando para sexo=Total, edad=Y_GE16 y el periodo solicitado.
    """
    data = {}
    name_map = {}
    reader = csv.DictReader(StringIO(csv_text))
    for row in reader:
        if row["TIME_PERIOD_CODE"] != period:
            continue
        if row["SEXO_CODE"] != "_T":
            continue
        if row["EDAD_CODE"] != "Y_GE16":
            continue
        terr = row["TERRITORIO_CODE"]
        # Aceptar cumun 5-dígitos o el especial _2007
        if not ((len(terr) == 5 and terr.isdigit()) or terr.endswith("_2007")):
            continue
        cumun = ISTAC_TO_CUMUN_OVERRIDES.get(terr, terr)
        sit = row["SITUACION_LABORAL_REGISTRADA_CODE"]
        val = row["OBS_VALUE"]
        if not val:
            continue
        data.setdefault(cumun, {})[sit] = float(val)
        name_map[cumun] = row["TERRITORIO#es"]
    return data, name_map


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--version", default=ISTAC_DEFAULT_VERSION,
                    help=f"Versión del dataset ISTAC (default {ISTAC_DEFAULT_VERSION})")
    ap.add_argument("--period", default=None,
                    help="Trimestre YYYY-Qn (default = más reciente disponible)")
    ap.add_argument("--cache", default=None,
                    help="Ruta a CSV cacheado (evita re-descargar)")
    args = ap.parse_args()

    # 1. Obtener CSV
    if args.cache and Path(args.cache).exists():
        print(f"[ISTAC] using cached CSV at {args.cache}", file=sys.stderr)
        csv_text = Path(args.cache).read_text(encoding="utf-8")
    else:
        csv_text = download_real_source(args.version)

    # 2. Periodo objetivo
    period = args.period or latest_period(csv_text)
    print(f"[ISTAC] target period: {period}", file=sys.stderr)

    # 3. Parsear
    data, name_map = parse_to_json(csv_text, period)
    print(f"[ISTAC] muns parseados con dato: {len(data)}", file=sys.stderr)

    # 4. Cruzar con nuestros 88 cumun canónicos
    if not MUNS_GEOJSON.exists():
        print(f"ERROR: no encuentro {MUNS_GEOJSON}", file=sys.stderr)
        sys.exit(1)
    with open(MUNS_GEOJSON) as f:
        fc = json.load(f)

    out = {}
    missing = []
    for feat in fc["features"]:
        props = feat["properties"]
        cumun = props["cumun"]
        nmun = props["nmun"]
        isla = props["isla"]
        d = data.get(cumun)
        if not d:
            missing.append((cumun, nmun))
            out[cumun] = {
                "paro_pct": None,
                "paro_n": None,
                "activa_n": None,
                "fecha": period,
                "nmun": nmun,
                "isla": isla,
                "_missing": True,
            }
            continue
        act = d.get("ACT_REG")
        une = d.get("UNE_REG")
        if not act or not une:
            missing.append((cumun, nmun))
            out[cumun] = {
                "paro_pct": None,
                "paro_n": int(une) if une else None,
                "activa_n": int(act) if act else None,
                "fecha": period,
                "nmun": nmun,
                "isla": isla,
                "_missing": True,
            }
            continue
        pct = round(une / act * 100, 2)
        out[cumun] = {
            "paro_pct": pct,
            "paro_n": int(une),
            "activa_n": int(act),
            "fecha": period,
            "nmun": nmun,
            "isla": isla,
        }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "version": f"istac-{ISTAC_DATASET_ID}-{args.version}-{period}",
        "fuente": (
            f"ISTAC · Estadística de Población Activa Registrada (EPA-Reg) · "
            f"Dataset {ISTAC_DATASET_ID} v{args.version} · "
            f"https://datos.canarias.es/api/estadisticas/statistical-resources/v1.0/"
            f"datasets/ISTAC/{ISTAC_DATASET_ID}/{args.version}.csv"
        ),
        "fecha_dato": period,
        "nota": (
            "Tasa de paro registrado = paro registrado (UNE_REG) / población "
            "activa registrada (ACT_REG, 16+ años). Datos trimestrales ISTAC. "
            "Frontera (38013) se reporta como '38013_2007' en ISTAC tras la "
            "creación de El Pinar (38901) en 2007."
        ),
        "muns": out,
    }
    with open(OUT, "w") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"\n[OK] wrote {OUT}", file=sys.stderr)
    print(f"     muns con dato: {len(out) - len(missing)} / {len(out)}", file=sys.stderr)
    if missing:
        print(f"     muns sin dato ({len(missing)}):", file=sys.stderr)
        for c, n in missing:
            print(f"       {c} {n}", file=sys.stderr)

    # Stats rápidas
    pcts = [m["paro_pct"] for m in out.values() if m["paro_pct"] is not None]
    if pcts:
        pcts_sorted = sorted(pcts)
        median = pcts_sorted[len(pcts_sorted) // 2]
        print(f"\n     paro_pct: min={min(pcts):.2f}, max={max(pcts):.2f}, "
              f"mediana={median:.2f}, media={sum(pcts)/len(pcts):.2f}",
              file=sys.stderr)


if __name__ == "__main__":
    main()
