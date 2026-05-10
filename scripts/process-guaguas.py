#!/usr/bin/env python3
"""
process-guaguas.py — Procesa el feed GTFS de Guaguas Municipales LPGC
y genera los GeoJSON consumidos por el visor:

  public/data/guaguas-paradas.geojson    — puntos de cada parada
  public/data/guaguas-lineas.geojson     — geometrías de las 47 líneas
  public/data/guaguas-cobertura.geojson  — buffer 300 m sobre paradas

Fuente:
  https://www.guaguas.com/transit/google_transit/{stops,routes,shapes,trips}.csv
  Feed GTFS publicado por Guaguas Municipales S.A. (LPGC).
  Catálogo NAP: https://nap.transportes.gob.es/Files/Detail/1094

Uso:
  cd ~/OCRE
  for f in stops routes shapes trips; do
    curl -sL -A "OCRE/cívico" -o "scripts/raw/guaguas_${f}.csv" \
      "https://www.guaguas.com/transit/google_transit/${f}.csv"
  done
  python3 scripts/process-guaguas.py

Requiere: pip install shapely pyproj
"""
import csv
import json
import os
import sys
from collections import defaultdict

try:
    from shapely.geometry import Point, mapping
    from shapely.ops import unary_union, transform
    from pyproj import Transformer
except ImportError:
    print("ERROR: pip install shapely pyproj", file=sys.stderr)
    sys.exit(1)

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(REPO, "scripts", "raw")
OUT = os.path.join(REPO, "public", "data")

OUT_PARADAS = os.path.join(OUT, "guaguas-paradas.geojson")
OUT_LINEAS = os.path.join(OUT, "guaguas-lineas.geojson")
OUT_COBERTURA = os.path.join(OUT, "guaguas-cobertura.geojson")
BUFFER_M = 300


def main():
    for f in ["guaguas_stops.csv", "guaguas_routes.csv", "guaguas_shapes.csv", "guaguas_trips.csv"]:
        if not os.path.exists(os.path.join(RAW, f)):
            print(f"ERROR: falta {f} (ver docstring)", file=sys.stderr)
            sys.exit(1)

    stops = list(csv.DictReader(open(f"{RAW}/guaguas_stops.csv", encoding="utf-8")))
    routes = list(csv.DictReader(open(f"{RAW}/guaguas_routes.csv", encoding="utf-8")))
    trips = list(csv.DictReader(open(f"{RAW}/guaguas_trips.csv", encoding="utf-8")))
    print(f"Paradas: {len(stops):,}  Rutas: {len(routes):,}  Trips: {len(trips):,}")

    routes_by_id = {r["route_id"]: r for r in routes}

    # Map route_id → shape_ids únicos
    route_shapes = defaultdict(set)
    for t in trips:
        if t.get("shape_id"):
            route_shapes[t["route_id"]].add(t["shape_id"])

    # Cargar shapes ordenados por secuencia
    shape_pts = defaultdict(list)
    for s in csv.DictReader(open(f"{RAW}/guaguas_shapes.csv", encoding="utf-8")):
        shape_pts[s["shape_id"]].append(
            (int(s["shape_pt_sequence"]), float(s["shape_pt_lon"]), float(s["shape_pt_lat"]))
        )
    for sid in shape_pts:
        shape_pts[sid].sort()
    print(f"Shapes únicos: {len(shape_pts):,}")

    # === Paradas → GeoJSON ===
    parada_features = []
    coords_paradas = []
    for s in stops:
        try:
            lat, lng = float(s["stop_lat"]), float(s["stop_lon"])
        except (ValueError, KeyError):
            continue
        parada_features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lng, lat]},
            "properties": {
                "id": s["stop_id"],
                "codigo": s.get("stop_code", "") or "",
                "nombre": s.get("stop_name", "").strip().strip('"'),
                "wheelchair": s.get("wheelchair_boarding", "") or "",
            }
        })
        coords_paradas.append((lng, lat))

    with open(OUT_PARADAS, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": parada_features},
                  f, ensure_ascii=False, separators=(",", ":"))
    print(f"✓ {OUT_PARADAS} ({len(parada_features):,} paradas, {os.path.getsize(OUT_PARADAS) // 1024} KB)")

    # === Líneas → GeoJSON ===
    linea_features = []
    for route_id, shape_ids in route_shapes.items():
        r = routes_by_id.get(route_id)
        if not r:
            continue
        shapes_coords = []
        for sid in shape_ids:
            pts = shape_pts.get(sid, [])
            if len(pts) >= 2:
                shapes_coords.append([[p[1], p[2]] for p in pts])
        if not shapes_coords:
            continue
        color = "#" + (r.get("route_color", "3da06a").strip() or "3da06a")
        linea_features.append({
            "type": "Feature",
            "geometry": {"type": "MultiLineString", "coordinates": shapes_coords},
            "properties": {
                "id": route_id,
                "short": r.get("route_short_name", ""),
                "nombre": r.get("route_long_name", ""),
                "color": color,
            }
        })

    with open(OUT_LINEAS, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": linea_features},
                  f, ensure_ascii=False, separators=(",", ":"))
    print(f"✓ {OUT_LINEAS} ({len(linea_features):,} líneas, {os.path.getsize(OUT_LINEAS) // 1024} KB)")

    # === Buffer 300m → GeoJSON ===
    to_utm = Transformer.from_crs("EPSG:4326", "EPSG:32628", always_xy=True).transform
    to_wgs = Transformer.from_crs("EPSG:32628", "EPSG:4326", always_xy=True).transform

    print(f"Calculando buffer {BUFFER_M}m de paradas…")
    puntos_utm = [Point(*to_utm(lng, lat)) for lng, lat in coords_paradas]
    union_utm = unary_union([p.buffer(BUFFER_M) for p in puntos_utm])
    union_wgs = transform(lambda x, y, z=None: to_wgs(x, y), union_utm)

    with open(OUT_COBERTURA, "w", encoding="utf-8") as f:
        json.dump({
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "geometry": mapping(union_wgs),
                "properties": {"tipo": f"cobertura_{BUFFER_M}m", "paradas": len(coords_paradas)}
            }]
        }, f, ensure_ascii=False, separators=(",", ":"))
    area_km2 = union_utm.area / 1_000_000
    print(f"✓ {OUT_COBERTURA} ({os.path.getsize(OUT_COBERTURA) // 1024} KB)")
    print(f"\nÁrea cubierta por buffer {BUFFER_M}m: {area_km2:.1f} km²")


if __name__ == "__main__":
    main()
