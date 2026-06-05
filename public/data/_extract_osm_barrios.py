#!/usr/bin/env python3
"""
Extrae lugares OSM (place=*) del PBF Canarias para semilla de barrios.

Salida:
1. `osm-places-canarias.json` — todas las entidades place=* extraídas del PBF
   con nombre, tipo, lat/lon (centroide), y polígono cuando existe.
2. `barrios-canarias-seed.json` — mapping barrio_id → secciones, computado
   por nearest-centroid dentro de mismo municipio (con polígonos disponibles).

Filtros:
- place ∈ {suburb, neighbourhood, quarter, hamlet, village, town, city_block}
- Provincia 35 + 38 (Canarias)
"""
import json
import os
import re
import time
import unicodedata
from collections import defaultdict
from math import sqrt

import osmium
from shapely.geometry import shape, Point, Polygon
from shapely.ops import unary_union

ROOT_ISO = "/Users/panch/KOINOS-iso/public"
PBF = "/Users/panch/Documents/UCM reclamación/_archivo/duplicates/KOINOS-duplicado/GEOFABRIK/canary-islands-260410.osm.pbf"
SECCIONES_GEOJSON = f"{ROOT_ISO}/canarias-secciones-lite.json"

OUT_PLACES = f"{ROOT_ISO}/data/osm-places-canarias.json"
OUT_SEED = f"{ROOT_ISO}/data/barrios-canarias-seed.json"
LOG = f"{ROOT_ISO}/data/_extract_osm_barrios.log"

PLACE_TYPES = {"suburb", "neighbourhood", "quarter", "hamlet",
               "village", "town", "city_block", "locality"}

# Bbox Canarias (suelto): lng -18.5 a -13.0, lat 27.4 a 29.5
CAN_LNG = (-18.5, -13.0)
CAN_LAT = (27.4, 29.5)


def log(msg):
    line = f"[{time.strftime('%H:%M:%S')}] {msg}"
    print(line, flush=True)
    with open(LOG, "a") as f:
        f.write(line + "\n")


def slug(s):
    if not s:
        return ""
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return s


class PlaceHandler(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.places = []
        self.checked = 0

    def in_canarias(self, lng, lat):
        return CAN_LNG[0] <= lng <= CAN_LNG[1] and CAN_LAT[0] <= lat <= CAN_LAT[1]

    def node(self, n):
        if "place" not in n.tags:
            return
        place = n.tags["place"]
        if place not in PLACE_TYPES:
            return
        name = n.tags.get("name", "").strip()
        if not name:
            return
        if not n.location.valid():
            return
        lng = n.location.lon
        lat = n.location.lat
        if not self.in_canarias(lng, lat):
            return
        self.places.append({
            "osm_id": n.id,
            "osm_type": "node",
            "name": name,
            "place": place,
            "lat": lat,
            "lng": lng,
            "tags": dict(n.tags),
        })
        self.checked += 1

    def area(self, a):
        if "place" not in a.tags:
            return
        place = a.tags["place"]
        if place not in PLACE_TYPES:
            return
        name = a.tags.get("name", "").strip()
        if not name:
            return
        try:
            rings = []
            for outer in a.outer_rings():
                ring = [(n.location.lon, n.location.lat) for n in outer if n.location.valid()]
                if len(ring) >= 3:
                    rings.append(ring)
            if not rings:
                return
            poly = Polygon(rings[0])
            if not poly.is_valid:
                poly = poly.buffer(0)
            c = poly.centroid
            if not self.in_canarias(c.x, c.y):
                return
            self.places.append({
                "osm_id": a.id,
                "osm_type": "area",
                "name": name,
                "place": place,
                "lat": c.y,
                "lng": c.x,
                "polygon": list(rings[0]),
                "tags": dict(a.tags),
            })
            self.checked += 1
        except Exception as e:
            pass


def extract_places():
    log("== fase 1: extraer place=* del PBF ==")
    h = PlaceHandler()
    h.apply_file(PBF, locations=True)
    log(f"places encontrados: {len(h.places)}")

    by_type = defaultdict(int)
    for p in h.places:
        by_type[p["place"]] += 1
    for t, n in sorted(by_type.items(), key=lambda x: -x[1]):
        log(f"  {t}: {n}")

    # Guardar
    out = {
        "version": "v1-osm-places-canarias-2026-05-13",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": "OSM PBF Geofabrik (canary-islands-260410)",
        "filters": list(PLACE_TYPES),
        "count": len(h.places),
        "by_type": dict(by_type),
        "places": h.places,
    }
    with open(OUT_PLACES, "w") as f:
        json.dump(out, f, ensure_ascii=False)
    size_mb = os.path.getsize(OUT_PLACES) / 1024 / 1024
    log(f"escrito {OUT_PLACES} ({size_mb:.2f} MB)")
    return h.places


def assign_to_sections(places):
    log("== fase 2: asignar cada cusec a su barrio OSM más cercano (mismo mun) ==")
    log(f"leyendo {SECCIONES_GEOJSON} ...")
    with open(SECCIONES_GEOJSON) as f:
        secs_raw = json.load(f)
    log(f"features en gc-secciones-lite: {len(secs_raw['features'])}")

    # Secciones por mun → lista de (cusec, centroid_lng, centroid_lat, polygon)
    by_mun = defaultdict(list)
    for feat in secs_raw["features"]:
        cusec = feat["properties"]["cusec"]
        mun = feat["properties"]["mun"]
        nmun = feat["properties"].get("nmun", "")
        g = shape(feat["geometry"])
        c = g.centroid
        by_mun[mun].append({
            "cusec": cusec,
            "nmun": nmun,
            "centroid": (c.x, c.y),
            "geom": g,
        })
    log(f"municipios con secciones disponibles: {len(by_mun)}")

    # Lugares OSM agrupados aproximadamente por mun (heurística: encontrar el
    # mun cuyo polígono contiene el punto, o el cusec más cercano si no)
    # Versión simple: para cada place, encontrar la SECCIÓN más cercana por
    # distancia haversine simple (sin librería). Luego derivar mun de la sección.
    log("asignando OSM places → municipios ...")
    place_mun = {}
    for p in places:
        # Si tiene polígono y contiene algún cusec, usa el primero. Si no, distancia.
        best_mun = None
        best_dist = float("inf")
        pp = Point(p["lng"], p["lat"])
        # Encontrar el cusec más cercano de cualquier mun
        for mun, secs in by_mun.items():
            for s in secs:
                d = (s["centroid"][0]-p["lng"])**2 + (s["centroid"][1]-p["lat"])**2
                if d < best_dist:
                    best_dist = d
                    best_mun = mun
        if best_mun:
            place_mun[p["osm_id"]] = best_mun
    log(f"places con mun asignado: {len(place_mun)}/{len(places)}")

    # Por cada mun, los places que apuntan a él son candidatos a barrio
    barrios_seed = {}
    for mun, secs in by_mun.items():
        candidates = [p for p in places if place_mun.get(p["osm_id"]) == mun]
        if not candidates:
            continue
        # Cada sección se asigna al place más cercano (clave: slug del nombre)
        for s in secs:
            best = None
            best_d = float("inf")
            for c in candidates:
                d = (c["lng"] - s["centroid"][0])**2 + (c["lat"] - s["centroid"][1])**2
                if d < best_d:
                    best_d = d
                    best = c
            if not best:
                continue
            bid = f"{mun}-{slug(best['name'])}"
            entry = barrios_seed.setdefault(bid, {
                "id": bid,
                "name": best["name"],
                "place_type": best["place"],
                "mun": "35" + mun,
                "mun_name": s.get("nmun"),
                "centroide_osm": [best["lng"], best["lat"]],
                "sections": [],
                "source": "osm-nearest-centroid"
            })
            entry["sections"].append(s["cusec"])

    log(f"barrios-seed generados: {len(barrios_seed)}")

    # Stats por mun
    counts_per_mun = defaultdict(int)
    for bid, b in barrios_seed.items():
        counts_per_mun[b["mun"]] += 1
    log("barrios-seed por mun:")
    for mun, n in sorted(counts_per_mun.items(), key=lambda x: -x[1])[:30]:
        log(f"  {mun}: {n}")

    out = {
        "version": "v1-seed-osm-canarias-2026-05-13",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "scope": "Provincia 35 (donde gc-secciones-lite tiene polígonos) — semilla automática desde OSM",
        "method": "OSM place=* nearest-centroid dentro del mismo municipio",
        "note": "Esto es semilla, NO sustituye a barrios-gc.json curado para LPGC. La unión de ambos da cobertura completa GC + zonas urbanas LZ/FV. Curación manual recomendada para refinar.",
        "barrios_count": len(barrios_seed),
        "barrios": barrios_seed,
    }
    with open(OUT_SEED, "w") as f:
        json.dump(out, f, ensure_ascii=False)
    size_mb = os.path.getsize(OUT_SEED) / 1024 / 1024
    log(f"escrito {OUT_SEED} ({size_mb:.2f} MB)")


def main():
    open(LOG, "w").close()
    log("== extracción OSM places para semilla de barrios ==")
    t0 = time.time()
    places = extract_places()
    assign_to_sections(places)
    log(f"== fin · total {(time.time()-t0):.1f}s ==")


if __name__ == "__main__":
    main()
