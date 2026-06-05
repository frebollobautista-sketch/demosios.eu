#!/usr/bin/env python3
"""
extract-mobiliario-urbano.py — ESP-07 · Mobiliario urbano para visor OCRE
=========================================================================

Extrae del PBF Geofabrik elementos clave para olas de calor:
  amenity=bench           → banco
  amenity=drinking_water  → fuente potable
  amenity=fountain        → fuente ornamental
  amenity=toilets         → aseos públicos
  amenity=waste_basket    → papelera (opcional)
  amenity=shelter         → refugio / marquesina
  natural=tree (urban)    → árbol urbano (proxy de sombra)

Salida: public/data/mobiliario-urbano-canarias.geojson

Estrategia árboles
------------------
OSM contiene decenas de miles de árboles individuales en Canarias.
Para no inflar el JSON:

  1. Sólo aceptamos árboles con `denotation=urban|street|avenue|park`,
     o cualquier árbol que esté a < 600m de un centro urbano OSM
     (places city/town/suburb/neighbourhood/village).
  2. Si tras (1) hay > 5000 árboles, nos quedamos con los 5000 más
     cercanos al centro urbano más próximo.

Objetivo de peso final: < 500 KB.
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
PLACES_PATH = f"{ROOT}/public/data/osm-places-canarias.json"
OUT = f"{ROOT}/public/data/mobiliario-urbano-canarias.geojson"

# Bbox Canarias: lng [-18.5, -13.2], lat [27.4, 29.6]
BBOX = (-18.5, 27.4, -13.2, 29.6)

# Mapping (key, value) → tipo normalizado
AMENITY_MAP = {
    "bench":          "banco",
    "drinking_water": "agua",
    "fountain":       "fuente_orn",
    "toilets":        "aseos",
    "waste_basket":   "papelera",
    "shelter":        "refugio",
}

# Árboles: aceptamos cualquier natural=tree y luego filtramos.
URBAN_TREE_DENOTATIONS = {
    "urban", "street", "avenue", "park", "garden", "agricultural"
}

# Tipos de "place" considerados urbanos para proxy de proximidad.
URBAN_PLACE_TYPES = {"city", "town", "suburb", "neighbourhood", "village"}

# Distancia máxima (metros) entre un árbol y el centro urbano más
# cercano para considerarlo "urbano" si no tiene tag denotation.
MAX_TREE_TO_PLACE_M = 600.0

# Tope absoluto de árboles aceptados en el output. Mantenemos
# FeatureCollection estándar; con 10.000+ features el formato GeoJSON
# clásico ya supera 1 MB por overhead estructural — recortamos topes
# para mantener el peso bajo (objetivo ~500 KB) priorizando densidad
# urbana (árboles más cercanos a un centro urbano OSM).
MAX_TREES = 1500

# Tope de bancos (los más densos del dataset). Si superamos el tope
# nos quedamos con los `MAX_BENCHES` más cercanos a un centro urbano.
MAX_BENCHES = 1500

# Si True, descartamos las papeleras (tipo opcional según ESP-07).
SKIP_PAPELERAS = True

# Decimales de las coordenadas. 5 ≈ 1.1 m a esta latitud.
COORD_DECIMALS = 5


# ---------------------------------------------------------------
#  Utilidades geográficas
# ---------------------------------------------------------------

def haversine_m(lat1, lon1, lat2, lon2):
    R = 6371000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = (math.sin(dphi/2)**2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(dlmb/2)**2)
    return 2 * R * math.asin(math.sqrt(a))


def load_urban_places():
    """Carga los centros urbanos (city/town/suburb/neighbourhood/village)
    desde el JSON existente. Devuelve lista de (lat, lng, kind)."""
    try:
        with open(PLACES_PATH) as f:
            d = json.load(f)
    except FileNotFoundError:
        print(f"WARN: {PLACES_PATH} no existe — sin filtro de proximidad",
              file=sys.stderr)
        return []
    pts = []
    for p in d.get("places", []):
        kind = p.get("place")
        if kind not in URBAN_PLACE_TYPES:
            continue
        try:
            lat = float(p["lat"]); lng = float(p["lng"])
        except (KeyError, ValueError):
            continue
        pts.append((lat, lng, kind))
    print(f"  centros urbanos cargados: {len(pts)}", file=sys.stderr)
    return pts


def build_grid_index(places, cell_deg=0.05):
    """Indexa lugares en una rejilla lat/lng. cell_deg ~5.5 km a estas
    latitudes. Devuelve dict[(ci,cj)] -> [places]."""
    grid = defaultdict(list)
    for lat, lng, kind in places:
        ci = int(math.floor(lat / cell_deg))
        cj = int(math.floor(lng / cell_deg))
        grid[(ci, cj)].append((lat, lng, kind))
    return grid, cell_deg


def nearest_place_dist(lat, lng, grid, cell_deg):
    """Distancia (m) al lugar urbano más cercano. Busca en las 9 celdas
    alrededor. Si no hay nada cerca devuelve (math.inf, None)."""
    ci = int(math.floor(lat / cell_deg))
    cj = int(math.floor(lng / cell_deg))
    best_d = math.inf
    best_kind = None
    for di in (-1, 0, 1):
        for dj in (-1, 0, 1):
            for plat, plng, kind in grid.get((ci+di, cj+dj), ()):
                d = haversine_m(lat, lng, plat, plng)
                if d < best_d:
                    best_d = d
                    best_kind = kind
    return best_d, best_kind


# ---------------------------------------------------------------
#  Extractor osmium
# ---------------------------------------------------------------

class Extractor(osmium.SimpleHandler):
    def __init__(self, grid, cell_deg):
        super().__init__()
        self.grid = grid
        self.cell_deg = cell_deg
        self.amenity_feats = []
        self.tree_candidates = []   # (dist, feature) — para top-K
        self.bench_candidates = []  # (dist, feature) — para top-K
        self.counts = defaultdict(int)
        self.trees_seen = 0

    def _in_bbox(self, lon, lat):
        return BBOX[0] <= lon <= BBOX[2] and BBOX[1] <= lat <= BBOX[3]

    def _emit_amenity(self, lon, lat, tipo, tags, osm_id):
        # Para máximo compactado nos quedamos sólo con `tipo` por defecto.
        # Sólo añadimos `name` si existe y `shelter_type` (relevante para
        # filtrar refugios/marquesinas reales).
        props = {"tipo": tipo}
        name = tags.get("name")
        if name and tipo in ("refugio", "fuente_orn", "aseos"):
            props["name"] = name
        if tipo == "refugio":
            st = tags.get("shelter_type")
            if st:
                props["shelter_type"] = st
        if tipo == "aseos":
            wc = tags.get("wheelchair")
            if wc == "yes":
                props["wheelchair"] = "yes"

        # Para bancos guardamos también lat/lon en candidatos para luego
        # poder filtrar por proximidad si superamos MAX_BENCHES.
        feat = {
            "type": "Feature",
            "geometry": {"type": "Point",
                         "coordinates": [round(lon, COORD_DECIMALS),
                                         round(lat, COORD_DECIMALS)]},
            "properties": props,
        }
        if tipo == "banco":
            d, _ = nearest_place_dist(lat, lon, self.grid, self.cell_deg)
            self.bench_candidates.append((d, feat))
        else:
            self.amenity_feats.append(feat)
        self.counts[tipo] += 1

    def _maybe_emit_tree(self, lon, lat, tags, osm_id):
        self.trees_seen += 1
        denot = (tags.get("denotation") or "").lower()

        dist, _ = nearest_place_dist(lat, lon, self.grid, self.cell_deg)

        # Aceptación:
        #   - denotation explícita urbana, O
        #   - cualquier árbol < MAX_TREE_TO_PLACE_M de un centro urbano
        if denot in URBAN_TREE_DENOTATIONS:
            pass
        elif dist < MAX_TREE_TO_PLACE_M:
            pass
        else:
            return

        # Properties minimalistas (sólo `tipo`) para máxima compactación.
        feat = {
            "type": "Feature",
            "geometry": {"type": "Point",
                         "coordinates": [round(lon, COORD_DECIMALS),
                                         round(lat, COORD_DECIMALS)]},
            "properties": {"tipo": "arbol"},
        }
        self.tree_candidates.append((dist, feat))

    def node(self, n):
        tags = {t.k: t.v for t in n.tags}
        try:
            lon, lat = n.location.lon, n.location.lat
        except osmium.InvalidLocationError:
            return
        if not self._in_bbox(lon, lat):
            return

        # 1) amenity simples
        amen = tags.get("amenity")
        if amen in AMENITY_MAP:
            tipo = AMENITY_MAP[amen]
            if SKIP_PAPELERAS and tipo == "papelera":
                return
            self._emit_amenity(lon, lat, tipo, tags, f"node/{n.id}")
            return

        # 2) árboles urbanos
        if tags.get("natural") == "tree":
            self._maybe_emit_tree(lon, lat, tags, f"node/{n.id}")
            return

    def area(self, a):
        # Algunas fuentes/aseos/refugios están como way cerrado. Tomamos
        # centroide simple del outer ring.
        tags = {t.k: t.v for t in a.tags}
        amen = tags.get("amenity")
        if amen not in AMENITY_MAP:
            return
        if SKIP_PAPELERAS and AMENITY_MAP[amen] == "papelera":
            return
        try:
            outer = next(iter(a.outer_rings()), None)
            if outer is None:
                return
            xs, ys = [], []
            for pt in outer:
                xs.append(pt.lon); ys.append(pt.lat)
            if not xs:
                return
            lon = sum(xs) / len(xs)
            lat = sum(ys) / len(ys)
        except Exception:
            return
        if not self._in_bbox(lon, lat):
            return
        self._emit_amenity(lon, lat, AMENITY_MAP[amen], tags, f"way/{a.id}")


# ---------------------------------------------------------------
#  main
# ---------------------------------------------------------------

def main():
    pbf = next((p for p in PBF_CANDIDATES if os.path.exists(p)), None)
    if not pbf:
        print("ERROR: PBF Geofabrik no encontrado", file=sys.stderr)
        sys.exit(1)
    print(f"PBF: {pbf}", file=sys.stderr)

    places = load_urban_places()
    grid, cell_deg = build_grid_index(places, cell_deg=0.05)

    ex = Extractor(grid, cell_deg)
    ex.apply_file(pbf, locations=True)

    # Selección de árboles: top-K por cercanía al centro urbano más cercano
    print(f"  árboles vistos: {ex.trees_seen}", file=sys.stderr)
    print(f"  árboles candidatos (urbanos): {len(ex.tree_candidates)}",
          file=sys.stderr)
    ex.tree_candidates.sort(key=lambda t: t[0])
    trees_kept = [feat for _, feat in ex.tree_candidates[:MAX_TREES]]
    print(f"  árboles incluidos: {len(trees_kept)} (tope={MAX_TREES})",
          file=sys.stderr)

    # Bancos: top-K más cercanos a centros urbanos.
    print(f"  bancos vistos: {len(ex.bench_candidates)}", file=sys.stderr)
    ex.bench_candidates.sort(key=lambda t: t[0])
    benches_kept = [feat for _, feat in ex.bench_candidates[:MAX_BENCHES]]
    print(f"  bancos incluidos: {len(benches_kept)} (tope={MAX_BENCHES})",
          file=sys.stderr)

    features = ex.amenity_feats + benches_kept + trees_kept
    counts = dict(ex.counts)
    counts["arbol"] = len(trees_kept)
    counts["banco"] = len(benches_kept)

    out_fc = {
        "type": "FeatureCollection",
        "name": "mobiliario-urbano-canarias",
        "generated_at": "2026-05-27",
        "source": "OSM Geofabrik canary-islands-latest",
        "count": len(features),
        "by_tipo": counts,
        "tree_filter": {
            "max_distance_to_urban_place_m": MAX_TREE_TO_PLACE_M,
            "max_trees_kept": MAX_TREES,
            "trees_seen_total": ex.trees_seen,
            "trees_candidates": len(ex.tree_candidates),
        },
        "features": features,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(out_fc, f, ensure_ascii=False, separators=(",", ":"))
    size_kb = os.path.getsize(OUT) / 1024
    print(f"\nwrote {OUT} — {len(features)} features ({size_kb:.0f} KB)",
          file=sys.stderr)
    for tipo, n in sorted(counts.items(), key=lambda x: -x[1]):
        print(f"  {tipo}: {n}", file=sys.stderr)


if __name__ == "__main__":
    main()
