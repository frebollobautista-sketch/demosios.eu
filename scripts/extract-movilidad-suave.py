#!/usr/bin/env python3
"""
extract-movilidad-suave.py — Extrae del PBF Geofabrik (Canarias) la red de
movilidad suave / calmada y la escribe en
public/data/movilidad-suave-canarias.geojson.

Indicador MOV-02 (carriles bici + zonas 30 + peatonales) del visor OCRE.

Tags OSM cubiertos (en orden de prioridad — la primera coincidencia gana):
  highway=cycleway              → cycleway       (vía bici dedicada)
  bicycle=designated (en otros)  → cycleway       (carril compartido marcado)
  highway=footway                → footway        (peatonal estrecha)
  highway=pedestrian             → pedestrian     (zona/calle peatonal)
  highway=living_street          → living_street  (zona residencial pacificada)
  maxspeed in {20,30}            → zona30         (calmado)

Sólo se procesan ways (lineales). Las áreas peatonales (highway=pedestrian
con area=yes) se incluyen igualmente como LineString cerrado: el overlay
puede pintar el polígono cerrando el path. Para los polígonos reales se
emite también el geometry como LineString — el overlay rellena cuando
detecta cierre (primer == último punto) y el tipo es `pedestrian`.

Simplificación: tolerancia ≈8 m vía Douglas-Peucker propio (sin shapely).
"""

import json
import math
import os
import sys
from collections import defaultdict

import osmium

ROOT = "/Users/panch/KOINOS-iso"
PBF_CANDIDATES = [
    f"{ROOT}/GEOFABRIK/canary-islands-latest.osm.pbf",
    f"{ROOT}/GEOFABRIK/canary-islands-260410.osm.pbf",
]
OUT = f"{ROOT}/public/data/movilidad-suave-canarias.geojson"

# Bbox Canarias: lng [-18.2, -13.3], lat [27.5, 29.5]
BBOX = (-18.2, 27.5, -13.3, 29.5)

# Tolerancia de simplificación. 8 m ≈ ancho de calle: por debajo de eso
# los giros son ruido para el visor iso a las escalas relevantes.
SIMPLIFY_TOL_M = 8.0


# ----- clasificación ------------------------------------------------------

def _maxspeed_value(tags):
    """Devuelve velocidad numérica en km/h o None si no se puede leer."""
    raw = tags.get("maxspeed")
    if not raw:
        return None
    raw = raw.strip().lower()
    if raw in ("walk", "none", "signals", "variable"):
        return None
    # "30 mph", "50", "30 km/h", "ES:urban", etc.
    if raw.startswith("es:") or raw.startswith("de:"):
        # Zonas legales — fuera del alcance de este indicador.
        return None
    try:
        # quita unidades
        for unit in ("km/h", "kmh", "kph", "mph"):
            if raw.endswith(unit):
                num = float(raw[: -len(unit)].strip())
                return num * (1.609 if unit == "mph" else 1.0)
        return float(raw)
    except ValueError:
        return None


def categoria(tags):
    highway = tags.get("highway")
    if highway == "cycleway":
        return "cycleway"
    # Carril bici señalizado dentro de un highway normal
    if tags.get("bicycle") == "designated" and highway and highway != "cycleway":
        return "cycleway"
    if highway == "footway":
        return "footway"
    if highway == "pedestrian":
        return "pedestrian"
    if highway == "living_street":
        return "living_street"
    # Zonas 20/30
    ms = _maxspeed_value(tags)
    if ms is not None and ms <= 30 and highway:
        # No queremos contar pistas/agrarias como zona30
        if highway in ("residential", "tertiary", "secondary", "unclassified",
                       "service", "living_street"):
            return "zona30"
    return None


# ----- simplificación Douglas-Peucker en lat/lng convertido a metros ------

# Aproximación local: 1 grado lat ≈ 111_320 m. 1 grado lng ≈ 111_320 * cos(lat).
# Para Canarias (lat ~28°), cos ≈ 0.883. Usar centro 28 está bien — tolerancia
# 8 m no es sensible al error de cos a estas latitudes.
_M_PER_DEG_LAT = 111_320.0
_COS_REF = math.cos(math.radians(28.0))
_M_PER_DEG_LNG = 111_320.0 * _COS_REF


def _ll_to_m(lng, lat):
    return (lng * _M_PER_DEG_LNG, lat * _M_PER_DEG_LAT)


def _perp_dist_m(p, a, b):
    # p, a, b en (lng, lat). Convertimos a metros locales.
    px, py = _ll_to_m(p[0], p[1])
    ax, ay = _ll_to_m(a[0], a[1])
    bx, by = _ll_to_m(b[0], b[1])
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
    if t < 0:
        return math.hypot(px - ax, py - ay)
    if t > 1:
        return math.hypot(px - bx, py - by)
    cx, cy = ax + t * dx, ay + t * dy
    return math.hypot(px - cx, py - cy)


def simplify(coords, tol_m=SIMPLIFY_TOL_M):
    n = len(coords)
    if n < 3:
        return coords[:]
    keep = [False] * n
    keep[0] = True
    keep[-1] = True
    stack = [(0, n - 1)]
    while stack:
        i, j = stack.pop()
        if j <= i + 1:
            continue
        # Encuentra punto con distancia máxima al segmento i-j.
        max_d = -1.0
        max_k = -1
        a, b = coords[i], coords[j]
        for k in range(i + 1, j):
            d = _perp_dist_m(coords[k], a, b)
            if d > max_d:
                max_d = d
                max_k = k
        if max_d > tol_m and max_k > 0:
            keep[max_k] = True
            stack.append((i, max_k))
            stack.append((max_k, j))
    return [coords[i] for i in range(n) if keep[i]]


# ----- handler ------------------------------------------------------------


class Extractor(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.features = []
        self.counts = defaultdict(int)

    def _in_bbox(self, lon, lat):
        return BBOX[0] <= lon <= BBOX[2] and BBOX[1] <= lat <= BBOX[3]

    def way(self, w):
        tags = {t.k: t.v for t in w.tags}
        cat = categoria(tags)
        if not cat:
            return
        # Coordenadas del way
        try:
            coords = []
            inside_any = False
            for n in w.nodes:
                if not n.location.valid():
                    continue
                lon, lat = n.location.lon, n.location.lat
                if self._in_bbox(lon, lat):
                    inside_any = True
                coords.append([round(lon, 6), round(lat, 6)])
        except osmium.InvalidLocationError:
            return
        if not inside_any or len(coords) < 2:
            return
        coords = simplify(coords, SIMPLIFY_TOL_M)
        if len(coords) < 2:
            return

        # ¿Polígono cerrado? Para pedestrian con area=yes, marcamos el flag.
        closed = (coords[0] == coords[-1])
        is_area = closed and tags.get("area") == "yes"

        name = tags.get("name") or tags.get("name:es") or ""
        feature = {
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": coords},
            "properties": {
                "tipo": cat,
                "name": name or None,
                "highway": tags.get("highway") or None,
                "maxspeed": tags.get("maxspeed") or None,
                "surface": tags.get("surface") or None,
                "lit": tags.get("lit") or None,
                "is_area": is_area,
                "osm_id": f"way/{w.id}",
            }
        }
        # Limpia properties None para reducir peso
        feature["properties"] = {k: v for k, v in feature["properties"].items()
                                 if v is not None}
        self.features.append(feature)
        self.counts[cat] += 1


def main():
    pbf = next((p for p in PBF_CANDIDATES if os.path.exists(p)), None)
    if not pbf:
        print("ERROR: PBF no encontrado", file=sys.stderr)
        sys.exit(1)
    print(f"PBF: {pbf}", file=sys.stderr)

    ex = Extractor()
    ex.apply_file(pbf, locations=True)

    out_fc = {
        "type": "FeatureCollection",
        "name": "movilidad-suave-canarias",
        "generated_at": "2026-05-27",
        "source": "OSM Geofabrik canary-islands",
        "simplify_tol_m": SIMPLIFY_TOL_M,
        "count": len(ex.features),
        "by_tipo": dict(ex.counts),
        "features": ex.features,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(out_fc, f, ensure_ascii=False, separators=(",", ":"))
    size_kb = os.path.getsize(OUT) / 1024
    print(f"wrote {OUT} — {len(ex.features)} features · {size_kb:.1f} KB",
          file=sys.stderr)
    for cat, n in sorted(ex.counts.items(), key=lambda x: -x[1]):
        print(f"  {cat}: {n}", file=sys.stderr)


if __name__ == "__main__":
    main()
