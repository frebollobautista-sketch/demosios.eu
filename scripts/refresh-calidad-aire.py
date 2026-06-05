#!/usr/bin/env python3
"""
refresh-calidad-aire.py — Genera/actualiza public/data/calidad-aire-canarias.json
con la red de estaciones de calidad del aire en Canarias y su AQI actual.

Estado: PLACEHOLDER con estaciones CEGCA reales (lng/lat correctos) + AQI
estructural. Para datos en tiempo real:
  · Opción A: token AQICN (https://aqicn.org/data-platform/token/) → fetch
    https://api.waqi.info/map/bounds/?latlng=27.5,-18.5,29.5,-13.0&token=X
  · Opción B: CEGCA WMS directo (gobcan transición ecológica) — formato
    GetFeatureInfo (no JSON nativo, parser propio).

Estructura de salida:
{
  "version": "v0-placeholder-2026-05-27",
  "fuente": "...",
  "actualizado": "ISO-8601",
  "leyenda_aqi": {
    "0-50":   "Bueno",
    "51-100": "Moderado",
    "101-150": "Poco saludable para sensibles",
    "151-200": "Poco saludable",
    "201-300": "Muy malo",
    "300+":   "Peligroso"
  },
  "estaciones": [
    {
      "id": "lpgc-mercado",
      "nombre": "LPGC · Mercado",
      "isla": "gc",
      "lng": -15.4137, "lat": 28.1099,
      "aqi": 42,
      "dominantpol": "pm25",
      "actualizado": "2026-05-27T08:00:00Z",
      "_placeholder": true
    },
    ...
  ]
}
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("/Users/panch/KOINOS-iso")
OUT = ROOT / "public" / "data" / "calidad-aire-canarias.json"

# Red CEGCA conocida (red oficial Canarias 2024/2025). Coords aproximados
# por barrio donde está la cabina. Si conocemos sitio exacto, mejor.
STATIONS = [
    # Gran Canaria
    {"id": "lpgc-mercado",        "nombre": "LPGC · Mercado",        "isla": "gc", "lng": -15.4137, "lat": 28.1099, "aqi": 48, "pol": "no2"},
    {"id": "lpgc-tafira",         "nombre": "LPGC · Tafira",         "isla": "gc", "lng": -15.4577, "lat": 28.0676, "aqi": 32, "pol": "o3"},
    {"id": "lpgc-sebadal",        "nombre": "LPGC · El Sebadal",     "isla": "gc", "lng": -15.4313, "lat": 28.1331, "aqi": 65, "pol": "pm25"},
    {"id": "lpgc-las-rehoyas",    "nombre": "LPGC · Las Rehoyas",    "isla": "gc", "lng": -15.4360, "lat": 28.1118, "aqi": 51, "pol": "no2"},
    {"id": "telde-remudas",       "nombre": "Telde · Las Remudas",   "isla": "gc", "lng": -15.4036, "lat": 28.0036, "aqi": 56, "pol": "pm10"},
    {"id": "santa-lucia-vecindario", "nombre": "Vecindario",         "isla": "gc", "lng": -15.4561, "lat": 27.8470, "aqi": 44, "pol": "no2"},
    {"id": "arinaga-puerto",      "nombre": "Arinaga · Puerto",      "isla": "gc", "lng": -15.4022, "lat": 27.8616, "aqi": 38, "pol": "so2"},
    {"id": "san-mateo",           "nombre": "Vega de San Mateo",     "isla": "gc", "lng": -15.5360, "lat": 28.0119, "aqi": 22, "pol": "o3"},

    # Tenerife
    {"id": "sct-tome-cano",       "nombre": "SC Tenerife · Tomé Cano", "isla": "tf", "lng": -16.2542, "lat": 28.4684, "aqi": 55, "pol": "no2"},
    {"id": "sct-las-delicias",    "nombre": "SC Tenerife · Las Delicias", "isla": "tf", "lng": -16.2630, "lat": 28.4530, "aqi": 48, "pol": "pm25"},
    {"id": "laguna-rodeos",       "nombre": "La Laguna · Los Rodeos", "isla": "tf", "lng": -16.3290, "lat": 28.4824, "aqi": 41, "pol": "no2"},
    {"id": "granadilla-polvazales", "nombre": "Granadilla · Polvazales", "isla": "tf", "lng": -16.5630, "lat": 28.1262, "aqi": 36, "pol": "pm10"},
    {"id": "candelaria",          "nombre": "Candelaria",            "isla": "tf", "lng": -16.3683, "lat": 28.3548, "aqi": 39, "pol": "no2"},
    {"id": "puerto-cruz",         "nombre": "Puerto de la Cruz",     "isla": "tf", "lng": -16.5436, "lat": 28.4153, "aqi": 31, "pol": "o3"},
    {"id": "guimar-polvora",      "nombre": "Güímar · Polvorín",     "isla": "tf", "lng": -16.4112, "lat": 28.3225, "aqi": 35, "pol": "pm10"},

    # Lanzarote
    {"id": "arrecife-titerroy",   "nombre": "Arrecife · Titerroy",   "isla": "lz", "lng": -13.5474, "lat": 28.9536, "aqi": 28, "pol": "o3"},
    {"id": "san-bartolome-lz",    "nombre": "San Bartolomé (LZ)",    "isla": "lz", "lng": -13.6172, "lat": 28.9716, "aqi": 24, "pol": "o3"},

    # Fuerteventura
    {"id": "puerto-rosario",      "nombre": "Puerto del Rosario",    "isla": "fv", "lng": -13.8627, "lat": 28.5004, "aqi": 26, "pol": "o3"},
    {"id": "morro-jable",         "nombre": "Morro Jable",           "isla": "fv", "lng": -14.3531, "lat": 28.0489, "aqi": 21, "pol": "o3"},

    # La Palma
    {"id": "santa-cruz-palma",    "nombre": "SC La Palma",           "isla": "lp", "lng": -17.7676, "lat": 28.6835, "aqi": 33, "pol": "pm10"},
    {"id": "los-llanos-aridane",  "nombre": "Los Llanos de Aridane", "isla": "lp", "lng": -17.9202, "lat": 28.6588, "aqi": 38, "pol": "pm10"},
    {"id": "el-paso-cumbres",     "nombre": "El Paso · Cumbres",     "isla": "lp", "lng": -17.8693, "lat": 28.6520, "aqi": 25, "pol": "o3"},

    # La Gomera
    {"id": "san-sebastian-lg",    "nombre": "San Sebastián (LG)",    "isla": "lg", "lng": -17.1110, "lat": 28.0918, "aqi": 22, "pol": "o3"},

    # El Hierro
    {"id": "valverde-eh",         "nombre": "Valverde (EH)",         "isla": "eh", "lng": -17.9151, "lat": 27.8059, "aqi": 18, "pol": "o3"},
]


def main():
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    estaciones_out = []
    for s in STATIONS:
        estaciones_out.append({
            "id": s["id"],
            "nombre": s["nombre"],
            "isla": s["isla"],
            "lng": s["lng"],
            "lat": s["lat"],
            "aqi": s["aqi"],
            "dominantpol": s["pol"],
            "actualizado": now,
            "_placeholder": True
        })

    out = {
        "version": "v0-placeholder-2026-05-27",
        "fuente": "placeholder con red CEGCA conocida — sustituir por AQICN API real con token o CEGCA WMS",
        "actualizado": now,
        "n_estaciones": len(estaciones_out),
        "leyenda_aqi": {
            "0-50":    {"nivel": "Bueno",                              "color": "#4aaa5a"},
            "51-100":  {"nivel": "Moderado",                           "color": "#d4c44a"},
            "101-150": {"nivel": "Poco saludable para sensibles",       "color": "#e68a4f"},
            "151-200": {"nivel": "Poco saludable",                     "color": "#c45a4a"},
            "201-300": {"nivel": "Muy malo",                           "color": "#9f4fe6"},
            "300+":    {"nivel": "Peligroso",                          "color": "#5c2424"}
        },
        "estaciones": estaciones_out
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"wrote {OUT}", file=sys.stderr)
    print(f"  estaciones: {len(estaciones_out)}", file=sys.stderr)
    print(f"  islas cubiertas: {sorted(set(s['isla'] for s in estaciones_out))}", file=sys.stderr)


if __name__ == "__main__":
    main()
