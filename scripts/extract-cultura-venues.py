#!/usr/bin/env python3
"""
extract-cultura-venues.py — Extrae sedes culturales del PBF Geofabrik
(bibliotecas, teatros, cines, centros de artes, centros cívicos) y
escribe public/cultura-venues.geojson.

Tags OSM cubiertos:
  amenity=library         → biblioteca
  amenity=theatre         → teatro
  amenity=cinema          → cine
  amenity=arts_centre     → centro de artes
  amenity=community_centre→ centro cívico/social
  amenity=social_centre   → centro social
  tourism=museum          → museo

Se aceptan tanto nodos (Point) como vías cerradas (Polygon → centroide).
"""

import json
import os
import sys
from collections import defaultdict

import osmium

ROOT = "/Users/panch/KOINOS-iso"
PBF_CANDIDATES = [
    f"{ROOT}/GEOFABRIK/canary-islands-latest.osm.pbf",
    f"{ROOT}/GEOFABRIK/canary-islands-260410.osm.pbf",
]
OUT = f"{ROOT}/public/data/cultura-venues.geojson"

# Bbox Canarias: lng [-18.2, -13.3], lat [27.5, 29.5]
BBOX = (-18.2, 27.5, -13.3, 29.5)

VENUE_TAGS = {
    # (tag_key, tag_value) → categoría normalizada
    ("amenity", "library"):           "biblioteca",
    ("amenity", "theatre"):           "teatro",
    ("amenity", "cinema"):            "cine",
    ("amenity", "arts_centre"):       "centro_artes",
    ("amenity", "community_centre"):  "centro_civico",
    ("amenity", "social_centre"):     "centro_social",
    ("tourism", "museum"):            "museo",
}


def categoria(tags):
    for (k, v), cat in VENUE_TAGS.items():
        if tags.get(k) == v:
            return cat
    return None


class Extractor(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.features = []
        self.counts = defaultdict(int)

    def _in_bbox(self, lon, lat):
        return BBOX[0] <= lon <= BBOX[2] and BBOX[1] <= lat <= BBOX[3]

    def node(self, n):
        tags = {t.k: t.v for t in n.tags}
        cat = categoria(tags)
        if not cat:
            return
        try:
            lon, lat = n.location.lon, n.location.lat
        except osmium.InvalidLocationError:
            return
        if not self._in_bbox(lon, lat):
            return
        name = tags.get("name") or tags.get("name:es") or ""
        self.features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]},
            "properties": {
                "name": name,
                "categoria": cat,
                "opening_hours": tags.get("opening_hours") or None,
                "wheelchair": tags.get("wheelchair") or None,
                "operator": tags.get("operator") or None,
                "website": tags.get("website") or tags.get("contact:website") or None,
                "phone": tags.get("phone") or tags.get("contact:phone") or None,
                "osm_id": f"node/{n.id}",
            }
        })
        self.counts[cat] += 1

    def area(self, a):
        # Áreas cerradas (vías o relations multipolígono) — centroide.
        tags = {t.k: t.v for t in a.tags}
        cat = categoria(tags)
        if not cat:
            return
        try:
            # Centroide simple del bounding box del outer ring
            outer = next(iter(a.outer_rings()), None)
            if outer is None:
                return
            xs, ys = [], []
            for pt in outer:
                xs.append(pt.lon)
                ys.append(pt.lat)
            if not xs:
                return
            lon = sum(xs) / len(xs)
            lat = sum(ys) / len(ys)
        except (osmium.InvalidLocationError, Exception):
            return
        if not self._in_bbox(lon, lat):
            return
        name = tags.get("name") or tags.get("name:es") or ""
        self.features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]},
            "properties": {
                "name": name,
                "categoria": cat,
                "opening_hours": tags.get("opening_hours") or None,
                "wheelchair": tags.get("wheelchair") or None,
                "operator": tags.get("operator") or None,
                "website": tags.get("website") or tags.get("contact:website") or None,
                "phone": tags.get("phone") or tags.get("contact:phone") or None,
                "osm_id": f"way/{a.id}",
            }
        })
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
        "name": "cultura-venues",
        "generated_at": "2026-05-25",
        "source": "OSM Geofabrik canary-islands",
        "count": len(ex.features),
        "by_categoria": dict(ex.counts),
        "features": ex.features,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(out_fc, f, ensure_ascii=False, separators=(",", ":"))
    print(f"wrote {OUT} — {len(ex.features)} venues", file=sys.stderr)
    for cat, n in sorted(ex.counts.items(), key=lambda x: -x[1]):
        print(f"  {cat}: {n}", file=sys.stderr)


if __name__ == "__main__":
    main()
