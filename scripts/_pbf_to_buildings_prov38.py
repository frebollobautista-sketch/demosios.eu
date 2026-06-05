#!/usr/bin/env python3
"""
pbf-to-buildings.py

Extrae edificios del PBF de Geofabrik (Canarias) y genera JSONs
por sección censal para el visor Polis.

NO necesita Catastro, GDAL ni PostGIS.
Usa osmium + shapely para leer el PBF y asignar edificios.

Uso:
  python3 scripts/pbf-to-buildings.py

Entrada:
  - Geofabrik PBF (canary-islands-*.osm.pbf)
  - public/prov38-secciones-lite.json (secciones censales)

Salida: public/buildings/CUSECCODE.json
  Formato: [[coords, height, levels], ...]
"""

import osmium
import json
import sys
import os
import time
from shapely.geometry import shape, Point, Polygon
from shapely.prepared import prep
from shapely.strtree import STRtree

# ── Paths ──
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(SCRIPT_DIR)
OUT_DIR = os.path.join(ROOT, "public", "buildings")
os.makedirs(OUT_DIR, exist_ok=True)

# Find PBF file
PBF_CANDIDATES = [
    os.path.join(ROOT, "GEOFABRIK", "canary-islands-latest.osm.pbf"),
    "/Users/panch/Documents/UCM reclamación/_archivo/duplicates/KOINOS-duplicado/GEOFABRIK/canary-islands-260410.osm.pbf",
    os.path.join(ROOT, "GEOFABRIK", "canary-islands-260410.osm.pbf"),
    os.path.join(ROOT, "KOINOS duplicado", "GEOFABRIK", "canary-islands-260410.osm.pbf"),
    os.path.join(ROOT, "canary-islands.osm.pbf"),
]

PBF_PATH = None
for p in PBF_CANDIDATES:
    if os.path.exists(p) and os.path.getsize(p) > 1000:
        PBF_PATH = p
        break

if not PBF_PATH:
    print("ERROR: No se encontró el PBF de Geofabrik.")
    print("Descárgalo de: https://download.geofabrik.de/europe/spain/canary-islands-latest.osm.pbf")
    print(f"y colócalo en: {os.path.join(ROOT, 'GEOFABRIK')}/")
    sys.exit(1)

SECCIONES_PATH = os.path.join(ROOT, "public", "prov38-secciones-lite.json")
if not os.path.exists(SECCIONES_PATH):
    print("ERROR: Falta prov38-secciones-lite.json")
    sys.exit(1)

# Provincia 35 bounding box (with margin)
BBOX_MIN_LON = -18.3
BBOX_MAX_LON = -16.0
BBOX_MIN_LAT = 27.4
BBOX_MAX_LAT = 28.9


class BuildingCollector(osmium.SimpleHandler):
    """First pass: collect all node coordinates used by building ways."""

    def __init__(self):
        super().__init__()
        self.building_way_ids = set()
        self.node_coords = {}
        self.buildings = []
        self._way_nodes = {}  # way_id -> [node_ids]
        self._way_tags = {}   # way_id -> {tags}

    def way(self, w):
        if 'building' not in w.tags:
            return
        tags = {t.k: t.v for t in w.tags}
        # Skip building=no
        if tags.get('building') == 'no':
            return
        nodes = [n.ref for n in w.nodes]
        self._way_nodes[w.id] = nodes
        self._way_tags[w.id] = tags

    def node(self, n):
        self.node_coords[n.id] = (n.location.lon, n.location.lat)


class NodeCollector(osmium.SimpleHandler):
    """Collect node locations."""
    def __init__(self):
        super().__init__()
        self.coords = {}

    def node(self, n):
        try:
            lon, lat = n.location.lon, n.location.lat
            if BBOX_MIN_LON <= lon <= BBOX_MAX_LON and BBOX_MIN_LAT <= lat <= BBOX_MAX_LAT:
                self.coords[n.id] = (lon, lat)
        except osmium.InvalidLocationError:
            pass


class WayCollector(osmium.SimpleHandler):
    """Collect building ways with node refs."""
    def __init__(self):
        super().__init__()
        self.ways = {}  # id -> (node_ids, tags)

    def way(self, w):
        if 'building' not in w.tags:
            return
        tags = {t.k: t.v for t in w.tags}
        if tags.get('building') == 'no':
            return
        nodes = [n.ref for n in w.nodes]
        self.ways[w.id] = (nodes, tags)


def extract_height_levels(tags):
    """Extract building height and levels from OSM tags."""
    height = None
    levels = None

    # Height
    h_str = tags.get('height', tags.get('building:height', ''))
    if h_str:
        try:
            h_str = h_str.replace(' m', '').replace('m', '').strip()
            height = float(h_str)
        except ValueError:
            pass

    # Levels
    l_str = tags.get('building:levels', tags.get('levels', ''))
    if l_str:
        try:
            levels = int(float(l_str))
        except ValueError:
            pass

    # Defaults
    if height is None and levels:
        height = levels * 3.0
    if height is None:
        # Estimate by building type
        btype = tags.get('building', 'yes')
        type_heights = {
            'house': 6, 'detached': 6, 'semidetached_house': 6,
            'residential': 9, 'apartments': 12,
            'commercial': 10, 'retail': 5, 'office': 15,
            'industrial': 8, 'warehouse': 7,
            'church': 15, 'cathedral': 25, 'chapel': 8,
            'school': 10, 'university': 12, 'hospital': 15,
            'garage': 3, 'garages': 3, 'shed': 3,
            'roof': 4, 'hut': 3,
        }
        height = type_heights.get(btype, 8)

    if levels is None and height:
        levels = max(1, round(height / 3))

    return round(height, 1), levels or 0


def main():
    print("╔═══════════════════════════════════════════════════╗")
    print("║  Geofabrik PBF → Buildings JSON por sección      ║")
    print("╚═══════════════════════════════════════════════════╝\n")

    print(f"PBF: {PBF_PATH}")
    print(f"Tamaño: {os.path.getsize(PBF_PATH) / 1024 / 1024:.1f} MB\n")

    # ── Step 1: Load secciones censales ──
    print("Cargando secciones censales...")
    t0 = time.time()
    with open(SECCIONES_PATH) as f:
        secciones = json.load(f)

    sec_geometries = []
    sec_cusecs = []
    sec_shapes = []

    for feat in secciones['features']:
        cusec = feat['properties'].get('cusec', feat['properties'].get('CUSEC', ''))
        if not cusec or not cusec.startswith('38'):
            continue
        try:
            geom = shape(feat['geometry'])
            if not geom.is_valid:
                geom = geom.buffer(0)
            sec_geometries.append(geom)
            sec_cusecs.append(cusec)
            sec_shapes.append(prep(geom))
        except Exception as e:
            print(f"  Warning: sección {cusec} inválida: {e}")

    print(f"  {len(sec_geometries)} secciones cargadas ({time.time()-t0:.1f}s)")

    # Build STRtree spatial index
    print("Construyendo índice espacial...")
    tree = STRtree(sec_geometries)
    print("  Índice listo")

    # ── Step 2: Read nodes from PBF ──
    print("\nLeyendo nodos del PBF...")
    t0 = time.time()
    nc = NodeCollector()
    nc.apply_file(PBF_PATH)
    print(f"  {len(nc.coords)} nodos en bbox provincia 35 ({time.time()-t0:.1f}s)")

    # ── Step 3: Read building ways ──
    print("Leyendo edificios del PBF...")
    t0 = time.time()
    wc = WayCollector()
    wc.apply_file(PBF_PATH)
    print(f"  {len(wc.ways)} building ways totales ({time.time()-t0:.1f}s)")

    # ── Step 4: Build polygons and assign to sections ──
    print("\nConstruyendo polígonos y asignando a secciones...")
    t0 = time.time()

    section_buildings = {}  # cusec -> list of [coords, height, levels]
    total = 0
    assigned = 0
    skipped_no_coords = 0
    skipped_no_section = 0

    for way_id, (node_ids, tags) in wc.ways.items():
        # Build coordinate ring
        coords = []
        valid = True
        for nid in node_ids:
            if nid in nc.coords:
                coords.append(nc.coords[nid])
            else:
                valid = False
                break

        if not valid or len(coords) < 3:
            skipped_no_coords += 1
            continue

        total += 1

        # Close ring if needed
        if coords[0] != coords[-1]:
            coords.append(coords[0])

        # Round coordinates
        coords = [[round(c[0], 6), round(c[1], 6)] for c in coords]

        # Centroid for section lookup
        cx = sum(c[0] for c in coords) / len(coords)
        cy = sum(c[1] for c in coords) / len(coords)

        # Check in bbox
        if cx < BBOX_MIN_LON or cx > BBOX_MAX_LON or cy < BBOX_MIN_LAT or cy > BBOX_MAX_LAT:
            continue

        # Find section using spatial index
        point = Point(cx, cy)
        candidates = tree.query(point)

        cusec = None
        for idx in candidates:
            if sec_shapes[idx].contains(point):
                cusec = sec_cusecs[idx]
                break

        if not cusec:
            skipped_no_section += 1
            continue

        height, levels = extract_height_levels(tags)

        if cusec not in section_buildings:
            section_buildings[cusec] = []
        section_buildings[cusec].append([coords, height, levels])
        assigned += 1

        if assigned % 10000 == 0:
            print(f"  ... {assigned} edificios asignados")

    print(f"\n  {total} edificios con geometría válida")
    print(f"  {assigned} asignados a secciones")
    print(f"  {skipped_no_coords} sin coordenadas completas")
    print(f"  {skipped_no_section} fuera de secciones censales")
    print(f"  ({time.time()-t0:.1f}s)")

    # ── Step 5: Write section files ──
    print(f"\nEscribiendo {len(section_buildings)} archivos de secciones...")

    # Keep existing 35016 (LPGC from Catastro) if they have more buildings
    existing_kept = 0
    written = 0

    for cusec, buildings in section_buildings.items():
        out_path = os.path.join(OUT_DIR, f"{cusec}.json")

        # Check if existing file has more buildings (Catastro data is more detailed)
        if os.path.exists(out_path) and cusec.startswith("35016"):
            try:
                with open(out_path) as f:
                    existing = json.load(f)
                if len(existing) > len(buildings):
                    existing_kept += 1
                    continue
            except:
                pass

        with open(out_path, 'w') as f:
            json.dump(buildings, f)
        written += 1

    print(f"\n{'═' * 45}")
    print(f"  {assigned} edificios totales procesados")
    print(f"  {written} archivos de secciones escritos")
    print(f"  {existing_kept} secciones LPGC conservadas (Catastro)")
    print(f"  Destino: {OUT_DIR}/")
    print(f"{'═' * 45}\n")

    # Summary by municipality
    muni_count = {}
    for cusec in section_buildings:
        muni = cusec[:5]
        muni_count[muni] = muni_count.get(muni, 0) + 1
    print("Secciones por municipio:")
    for muni in sorted(muni_count.keys()):
        print(f"  {muni}: {muni_count[muni]} secciones con edificios")


if __name__ == "__main__":
    main()
