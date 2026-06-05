"""KOINOS · POLIS — Generador de "data pack" Godot-ready por sección censal.

Convención de ejes para Godot (right-handed, Y up):
    X = east_m       (metros al este del centroide de la sección)
    Y = height_m     (altura sobre suelo, eje vertical)
    Z = south_m      (metros al sur del centroide; +Z apunta al sur,
                      es decir negativo del norte geográfico)

Unidades: metros (m).
Origen:   centroide de la sección, sistema ENU local linealizado por
          ``(lng - lng0) * 111320 * cos(lat0)`` y ``(lat0 - lat) * 111320``.

Salida (carpeta ``<out_dir>/<cusec>/``):
    meta.json
    section.geojson    buildings.geojson    manzanas.geojson
    roads.geojson      pois.geojson         trees.geojson
    monuments.geojson  parks.geojson        water.geojson
    preview.png

Uso:
    python3 -m packages.pack.pack_section 3501602052
    python3 -m packages.pack.pack_section 3501602052 --out-dir public/sections_pack

Diseñado para ser invocado en bucle por una lista de cusecs (76 secciones de
Las Canteras, 709 de la provincia 35).

Dependencias: pillow, shapely (no descarga nada, todo offline).
"""
from __future__ import annotations
import argparse
import json
import math
import pathlib
import time
from collections import Counter
from datetime import datetime, timezone
from typing import Dict, List, Tuple, Optional

from PIL import Image, ImageDraw, ImageFont
from shapely.geometry import (
    shape, Polygon, MultiPolygon, Point, LineString, MultiLineString, box,
)
from shapely.ops import unary_union

# shapely 2.x expone make_valid; en 1.8 no existe, hacemos fallback.
try:
    from shapely.validation import make_valid as _shapely_make_valid  # type: ignore
except Exception:  # pragma: no cover
    _shapely_make_valid = None


def _repair_geom(g):
    """Devuelve una geometría válida o None si no se puede reparar.

    Estrategia (de barata a cara):
        1. ``buffer(0)`` — la receta canónica de shapely para geometrías
           con anillos invertidos, auto-intersecciones, repeticiones de
           vértices o spikes.
        2. ``make_valid()`` (shapely 2.x) — descompone en piezas válidas.
        3. ``simplify(0.0001, preserve_topology=False)`` — última bala,
           tolera pequeñas pérdidas de detalle a cambio de validez.
    """
    if g is None or g.is_empty:
        return g
    if g.is_valid:
        return g
    try:
        g2 = g.buffer(0)
        if g2.is_valid and not g2.is_empty:
            return g2
    except Exception:
        pass
    if _shapely_make_valid is not None:
        try:
            g2 = _shapely_make_valid(g)
            if g2.is_valid and not g2.is_empty:
                return g2
        except Exception:
            pass
    try:
        g2 = g.simplify(0.0001, preserve_topology=False)
        if g2.is_valid and not g2.is_empty:
            return g2
    except Exception:
        pass
    return None


def _safe_intersects(geom, other):
    try:
        return geom.intersects(other)
    except Exception:
        rg = _repair_geom(geom)
        if rg is None:
            return False
        try:
            return rg.intersects(other)
        except Exception:
            return False


def _safe_intersection(geom, other):
    """Devuelve la intersección o None si la operación no es viable."""
    try:
        return geom.intersection(other)
    except Exception:
        rg = _repair_geom(geom)
        if rg is None:
            return None
        try:
            return rg.intersection(other)
        except Exception:
            return None

# ----------------------------------------------------------------- paths
# 2026-05-19 — Override por env vars para soportar prov 38:
#   KOINOS_SECCIONES_FILE, KOINOS_OSM_DIR (apunta a osm-gc/ o osm-prov38/).
import os as _os
ROOT = pathlib.Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "public"
BUILDINGS_DIR = PUBLIC / "buildings"
SECCIONES_FILE = pathlib.Path(_os.environ.get(
    "KOINOS_SECCIONES_FILE", str(PUBLIC / "gc-secciones-lite.json")))
SECCIONES_FULL = PUBLIC / "gc-secciones.json"
_OSM_DIR = pathlib.Path(_os.environ.get(
    "KOINOS_OSM_DIR", str(PUBLIC / "osm-gc")))
ROADS_FILE = _OSM_DIR / "roads.json"
POIS_FILE = _OSM_DIR / "pois.json"
PARKS_FILE = _OSM_DIR / "parks.json"
WATER_FILE = _OSM_DIR / "water.json"
CANTERAS_DATA = ROOT / "godot" / "polis_walk" / "canteras_data.json"

DEFAULT_OUT = PUBLIC / "sections_pack"

MUN_NAMES: Dict[str, str] = {}

# ----------------------------------------------------------------- palette
KOINOS_PALETTE = {
    "paper":     (251, 244, 221),
    "cream":     (244, 234, 212),
    "sand_lt":   (240, 224, 192),
    "sand":      (200, 184, 152),
    "ocre":      (176, 120,  64),
    "ocre_dk":   (138,  90,  42),
    "ink":       ( 34,  29,  24),
    "shadow":    (110,  72,  36),
    "accent":    (200,  84,  56),
}

CATEGORIES = {
    "restauracion": {"color": "#E68A4F", "extrude": False},
    "comercio":     {"color": "#4F8AE6", "extrude": False},
    "alojamiento":  {"color": "#9F4FE6", "extrude": False},
    "salud":        {"color": "#4FE69F", "extrude": False},
    "finanzas":     {"color": "#E6C44F", "extrude": False},
    "residencial":  {"color": "#C8B898", "extrude": True},
    "publico":      {"color": "#A06544", "extrude": True},
    "monumento":    {"color": "#7A3A1A", "extrude": True},
    "arbol":        {"color": "#5E8A3E", "extrude": True},
    "calle":        {"color": "#8A8276", "extrude": False},
    "parque":       {"color": "#A8C28A", "extrude": False},
    "agua":         {"color": "#7AA0C2", "extrude": False},
}

POI_CAT_MAP = {
    "restaurant": "restauracion", "cafe": "restauracion", "bar": "restauracion",
    "pub": "restauracion", "fast_food": "restauracion", "ice_cream": "restauracion",
    "biergarten": "restauracion",
    "shop": "comercio", "supermarket": "comercio", "convenience": "comercio",
    "marketplace": "comercio", "department_store": "comercio",
    "hotel": "alojamiento", "hostel": "alojamiento", "guest_house": "alojamiento",
    "apartment": "alojamiento", "motel": "alojamiento",
    "pharmacy": "salud", "hospital": "salud", "clinic": "salud",
    "doctors": "salud", "dentist": "salud",
    "bank": "finanzas", "atm": "finanzas", "bureau_de_change": "finanzas",
    "school": "publico", "library": "publico", "museum": "publico",
    "place_of_worship": "publico", "townhall": "publico", "police": "publico",
    "fire_station": "publico", "post_office": "publico", "university": "publico",
    "kindergarten": "publico", "hospital_public": "publico", "theatre": "publico",
    "arts_centre": "publico", "community_centre": "publico",
}

BUILDING_PUBLIC_TAGS = {"hospital", "school", "church", "government",
                        "public", "civic", "kindergarten", "university"}

MONUMENT_TYPES = {"monument", "artwork", "memorial", "statue", "fountain",
                  "castle", "ruins", "archaeological_site"}
MONUMENT_HEIGHT = {"monument": 12.0, "artwork": 4.0, "memorial": 6.0,
                   "statue": 4.0, "fountain": 2.0, "castle": 18.0,
                   "ruins": 6.0, "archaeological_site": 3.0}

ROAD_WIDTH = {
    "motorway": 14, "trunk": 13,
    "primary": 12, "secondary": 9, "tertiary": 7,
    "residential": 5, "unclassified": 5, "living_street": 4,
    "service": 3.5, "footway": 2, "pedestrian": 4,
    "track": 3, "cycleway": 2, "path": 2, "steps": 1.5,
}
ROAD_HW_TO_TYPE = {
    "motorway": "primary", "trunk": "primary", "primary": "primary",
    "secondary": "secondary", "tertiary": "tertiary",
    "residential": "residential", "unclassified": "residential",
    "living_street": "residential",
    "service": "service", "pedestrian": "pedestrian",
    "footway": "footway", "path": "footway", "steps": "footway",
    "cycleway": "footway", "track": "track",
}

# ----------------------------------------------------------------- helpers

def hex2rgb(h: str) -> Tuple[int, int, int]:
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def shade(rgb, k):
    return tuple(max(0, min(255, int(c * k))) for c in rgb)


def project_to_meters(lng0: float, lat0: float):
    cos_lat0 = math.cos(math.radians(lat0))
    def to_local(lng, lat):
        x = (lng - lng0) * 111320.0 * cos_lat0
        z = (lat0 - lat) * 111320.0
        return (x, z)
    return to_local, cos_lat0


def coords_to_local(coords, to_local):
    if isinstance(coords[0], (int, float)):
        return list(to_local(coords[0], coords[1]))
    return [coords_to_local(c, to_local) for c in coords]


# ----------------------------------------------------------------- loaders

def load_section_polygon(cusec: str, sections_collection=None):
    coll = sections_collection
    if coll is None:
        coll = json.load(open(SECCIONES_FILE, encoding="utf-8"))
    for f in coll["features"]:
        if f["properties"]["cusec"] == cusec:
            geom = shape(f["geometry"])
            props = f["properties"]
            return geom, props.get("mun", cusec[2:5]), props.get("nmun", "")
    raise ValueError(f"sección {cusec} no encontrada en {SECCIONES_FILE}")


def load_buildings(cusec: str) -> list:
    return json.load(open(BUILDINGS_DIR / f"{cusec}.json", encoding="utf-8"))


def _bbox_filter(features, bbox, geom_filter=None, pad=0.001):
    minx, miny, maxx, maxy = bbox[0]-pad, bbox[1]-pad, bbox[2]+pad, bbox[3]+pad
    for f in features:
        gtype = f["geometry"]["type"]
        if geom_filter and gtype != geom_filter:
            continue
        coords = f["geometry"]["coordinates"]
        flat = []
        def _rec(c):
            if isinstance(c[0], (int, float)):
                flat.append(c)
            else:
                for cc in c:
                    _rec(cc)
        _rec(coords)
        if not flat:
            continue
        xs = [p[0] for p in flat]
        ys = [p[1] for p in flat]
        if max(xs) < minx or min(xs) > maxx: continue
        if max(ys) < miny or min(ys) > maxy: continue
        yield f


# ----------------------------------------------------------------- manzanas

def extract_manzanas(polys: List[Polygon], heights: List[float], buf: float = 3.5):
    if not polys:
        return []
    expanded = [p.buffer(buf, join_style=2) for p in polys]
    merged = unary_union(expanded)
    merged_polys = [merged] if isinstance(merged, Polygon) else list(merged.geoms)
    manzanas = []
    for m in merged_polys:
        s = m.buffer(-buf*0.9, join_style=2)
        if s.is_empty:
            continue
        if isinstance(s, Polygon):
            manzanas.append(s)
        else:
            manzanas.extend(list(s.geoms))
    centroids = [p.centroid for p in polys]
    out = []
    for mz in manzanas:
        idx = [i for i, c in enumerate(centroids) if mz.contains(c)]
        if not idx:
            idx = [i for i, c in enumerate(centroids) if mz.intersects(polys[i])]
        if not idx:
            continue
        h_med = sorted(heights[i] for i in idx)[len(idx)//2]
        out.append((mz, h_med, len(idx)))
    return out


# ----------------------------------------------------------------- categorize

def assign_building_category(b_poly: Polygon, b_height: float,
                              pois_local: List[Tuple[Tuple[float,float], str]],
                              max_dist_m: float = 30.0) -> str:
    c = b_poly.centroid
    best, best_d = None, max_dist_m
    for (px, pz), cat in pois_local:
        d = math.hypot(c.x - px, c.y - pz)
        if d < best_d:
            best_d = d; best = cat
    if best:
        return best
    if b_poly.area > 900 and b_height < 9:
        return "publico"
    return "residencial"


# ----------------------------------------------------------------- iso preview

def fonts():
    candidates_b = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
        "/System/Library/Fonts/Supplemental/Georgia Bold.ttf",
        "/System/Library/Fonts/Supplemental/Times New Roman Bold.ttf",
    ]
    candidates_r = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
        "/System/Library/Fonts/Supplemental/Georgia.ttf",
        "/System/Library/Fonts/Supplemental/Times New Roman.ttf",
    ]
    def _try(cands, size):
        for c in cands:
            try:
                return ImageFont.truetype(c, size)
            except Exception:
                continue
        return ImageFont.load_default()
    return (_try(candidates_b, 26),
            _try(candidates_r, 14),
            _try(candidates_b, 30),
            _try(candidates_r, 16))


COS30 = math.cos(math.radians(30))
SIN30 = 0.5

def iso(x, y, z, sxy, sz, cx, cy):
    return (cx + (x - z) * COS30 * sxy,
            cy + (x + z) * SIN30 * sxy - y * sz)


def render_prism(d, ring_xz, h, sxy, sz, cx, cy, top, left, right,
                 ink=(34, 29, 24), stroke=1):
    if len(ring_xz) >= 2 and ring_xz[0] == ring_xz[-1]:
        ring_xz = ring_xz[:-1]
    n = len(ring_xz)
    if n < 3:
        return
    bot = [iso(x, 0, z, sxy, sz, cx, cy) for x, z in ring_xz]
    top_pts = [iso(x, h, z, sxy, sz, cx, cy) for x, z in ring_xz]
    for k in range(n):
        ax, az = ring_xz[k]; bx, bz = ring_xz[(k+1) % n]
        nx_, nz_ = (bz - az), -(bx - ax)
        if nx_ + nz_ <= 0:
            continue
        tilt = nx_ / (abs(nx_) + abs(nz_) + 1e-6)
        face = right if tilt > 0 else left
        d.polygon([bot[k], bot[(k+1) % n], top_pts[(k+1) % n], top_pts[k]],
                  fill=face, outline=ink, width=stroke)
    d.polygon(top_pts, fill=top, outline=ink, width=stroke)


def grid_50m(d, polygon_xz: Polygon, sxy, sz, cx, cy, color):
    bx0, by0, bx1, by1 = polygon_xz.bounds
    step = 50.0
    x = math.floor(bx0/step) * step
    while x <= bx1:
        line = LineString([(x, by0-2), (x, by1+2)])
        clipped = line.intersection(polygon_xz)
        if not clipped.is_empty:
            geoms = [clipped] if clipped.geom_type == "LineString" else list(clipped.geoms)
            for g in geoms:
                if g.geom_type != "LineString":
                    continue
                pts = [iso(px, 0, py, sxy, sz, cx, cy) for px, py in g.coords]
                if len(pts) >= 2:
                    d.line(pts, fill=color, width=1)
        x += step
    z = math.floor(by0/step) * step
    while z <= by1:
        line = LineString([(bx0-2, z), (bx1+2, z)])
        clipped = line.intersection(polygon_xz)
        if not clipped.is_empty:
            geoms = [clipped] if clipped.geom_type == "LineString" else list(clipped.geoms)
            for g in geoms:
                if g.geom_type != "LineString":
                    continue
                pts = [iso(px, 0, py, sxy, sz, cx, cy) for px, py in g.coords]
                if len(pts) >= 2:
                    d.line(pts, fill=color, width=1)
        z += step


# ----------------------------------------------------------------- preview render

def render_preview(out_path: pathlib.Path, *,
                   cusec: str, section_xz: Polygon,
                   buildings: List[Dict], manzanas: List[Tuple],
                   roads_xz: List[Tuple[str, list]],
                   parks_xz: List[Polygon],
                   water_xz: List,
                   pois_xz: List[Tuple[Tuple[float,float], str]],
                   trees_xz: List[Tuple[float, float]],
                   monuments_xz: List[Tuple[float, float, float, str]],
                   stats: Dict):
    P = KOINOS_PALETTE
    CANVAS_W = 1024
    CANVAS_H = 1024
    BANNER_H = 70
    img = Image.new("RGBA", (CANVAS_W, CANVAS_H + BANNER_H), P["paper"] + (255,))
    d = ImageDraw.Draw(img)

    bx0, bz0, bx1, bz1 = section_xz.bounds
    h_max = max([b["height_m"] for b in buildings] + [12.0])
    bw, bh = bx1 - bx0, bz1 - bz0
    span_w = (bw + bh) * COS30
    span_h = (bw + bh) * SIN30 + h_max * 1.6
    margin = 60
    sxy = min((CANVAS_W - 2*margin) / span_w,
              (CANVAS_H - 2*margin - 110) / span_h)
    sz = sxy * 1.6
    mx = (bx0 + bx1) / 2; my = (bz0 + bz1) / 2
    cx_canvas = CANVAS_W / 2 - (mx - my) * COS30 * sxy
    cy_canvas = CANVAS_H / 2 + 30 - (mx + my) * SIN30 * sxy

    d.rectangle((0, 0, CANVAS_W, CANVAS_H), fill=P["cream"] + (255,))

    sec_ring = list(section_xz.exterior.coords)
    sec_pts = [iso(x, 0, z, sxy, sz, cx_canvas, cy_canvas) for x, z in sec_ring]
    d.polygon(sec_pts, fill=P["paper"] + (255,), outline=P["ocre_dk"], width=4)

    grid_50m(d, section_xz, sxy, sz, cx_canvas, cy_canvas, P["sand"])

    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    park_col = hex2rgb(CATEGORIES["parque"]["color"]) + (150,)
    for park in parks_xz:
        ring = list(park.exterior.coords) if isinstance(park, Polygon) else None
        if not ring:
            continue
        pts = [iso(x, 0, z, sxy, sz, cx_canvas, cy_canvas) for x, z in ring]
        if len(pts) >= 3:
            od.polygon(pts, fill=park_col, outline=P["ocre"] + (180,))
    img = Image.alpha_composite(img, overlay)
    d = ImageDraw.Draw(img)

    water_col = hex2rgb(CATEGORIES["agua"]["color"])
    for w in water_xz:
        if isinstance(w, Polygon):
            ring = list(w.exterior.coords)
            pts = [iso(x, 0, z, sxy, sz, cx_canvas, cy_canvas) for x, z in ring]
            if len(pts) >= 3:
                d.polygon(pts, fill=water_col, outline=P["ink"], width=1)

    road_importance = {"primary": 6, "secondary": 5, "tertiary": 4,
                       "residential": 3, "service": 2, "pedestrian": 2,
                       "footway": 1, "track": 1}
    road_styles = {
        "primary":     (P["shadow"], 5),
        "secondary":   (P["ocre_dk"], 4),
        "tertiary":    (P["ocre"], 3),
        "residential": (P["sand"], 2),
        "service":     (P["sand_lt"], 1),
        "pedestrian":  (P["sand_lt"], 2),
        "footway":     (P["sand_lt"], 1),
        "track":       (P["sand_lt"], 1),
    }
    sorted_roads = sorted(roads_xz, key=lambda r: road_importance.get(r[0], 0))
    for rtype, coords in sorted_roads:
        col, w = road_styles.get(rtype, (P["sand_lt"], 1))
        pts = [iso(x, 0, z, sxy, sz, cx_canvas, cy_canvas) for x, z in coords]
        if len(pts) >= 2:
            d.line(pts, fill=col, width=w)

    d.line(sec_pts + [sec_pts[0]], fill=P["ocre_dk"], width=3)

    order = sorted(range(len(buildings)),
                   key=lambda i: (buildings[i]["centroid"][1] - buildings[i]["centroid"][0]))
    order = sorted(range(len(buildings)),
                   key=lambda i: buildings[i]["bounds"][0] + buildings[i]["bounds"][1])
    for i in order:
        b = buildings[i]
        ring = b["ring_xz"]
        cat = b["category"]
        h = b["height_m"]
        base = hex2rgb(CATEGORIES[cat]["color"])
        top = base
        left = shade(base, 0.78)
        right = shade(base, 0.92)
        render_prism(d, ring, h, sxy, sz, cx_canvas, cy_canvas,
                     top=top, left=left, right=right, ink=P["ink"], stroke=1)

    mon_col = hex2rgb(CATEGORIES["monumento"]["color"])
    for (mx_, mz_, mh, _name) in monuments_xz:
        s = 3.0
        ring = [(mx_-s, mz_-s), (mx_+s, mz_-s), (mx_+s, mz_+s), (mx_-s, mz_+s)]
        render_prism(d, ring, mh, sxy, sz, cx_canvas, cy_canvas,
                     top=mon_col, left=shade(mon_col, 0.78),
                     right=shade(mon_col, 0.92), ink=P["ink"], stroke=1)

    tree_col = hex2rgb(CATEGORIES["arbol"]["color"])
    for (tx, tz_) in trees_xz:
        base_pt = iso(tx, 0, tz_, sxy, sz, cx_canvas, cy_canvas)
        top_pt = iso(tx, 6.0, tz_, sxy, sz, cx_canvas, cy_canvas)
        r = max(2, int(2.0 * sxy))
        d.ellipse((base_pt[0]-r*0.4, base_pt[1]-r*0.2,
                   base_pt[0]+r*0.4, base_pt[1]+r*0.2),
                  fill=shade(tree_col, 0.6), outline=P["ink"])
        d.polygon([(base_pt[0]-r, base_pt[1]),
                   (base_pt[0]+r, base_pt[1]),
                   (top_pt[0], top_pt[1])],
                  fill=tree_col, outline=P["ink"])

    for (px, pz), cat in pois_xz:
        col = hex2rgb(CATEGORIES.get(cat, {}).get("color", "#888888"))
        pt = iso(px, 0.05, pz, sxy, sz, cx_canvas, cy_canvas)
        d.ellipse((pt[0]-3, pt[1]-3, pt[0]+3, pt[1]+3),
                  fill=col, outline=P["ink"], width=1)

    f_t, f_s, f_b, f_b2 = fonts()
    d.rectangle((0, CANVAS_H, CANVAS_W, CANVAS_H + BANNER_H), fill=P["ink"] + (255,))
    title = f"KOINOS · POLIS — sección {cusec}"
    d.text((18, CANVAS_H + 8), title, fill=P["paper"], font=f_b)
    line = (f"edif {stats['n_edif']}  ·  árb {stats['n_arboles']}  ·  "
            f"mon {stats['n_monumentos']}  ·  POIs {stats['n_pois']}  ·  "
            f"{stats['area_ha']:.2f} ha  ·  {stats['date']}")
    d.text((18, CANVAS_H + 42), line, fill=P["sand_lt"], font=f_b2)

    legend_y = CANVAS_H - 64
    d.rectangle((0, legend_y, CANVAS_W, CANVAS_H), fill=P["cream"] + (255,))
    cur_x = 14
    legend_items = ["restauracion", "comercio", "alojamiento", "salud",
                    "finanzas", "residencial", "publico", "monumento",
                    "arbol", "parque"]
    for cat in legend_items:
        col = hex2rgb(CATEGORIES[cat]["color"])
        d.rectangle((cur_x, legend_y + 10, cur_x + 14, legend_y + 26),
                    fill=col, outline=P["ink"])
        label = cat
        d.text((cur_x + 18, legend_y + 12), label, fill=P["ink"], font=f_s)
        cur_x += 18 + len(label) * 7 + 12
        if cur_x > CANVAS_W - 90:
            cur_x = 14
            legend_y += 22

    img.convert("RGB").save(out_path, "PNG", optimize=True)


# ----------------------------------------------------------------- writers

def write_geojson(path: pathlib.Path, features, lng0, lat0):
    gj = {
        "type": "FeatureCollection",
        "crs": {
            "type": "name",
            "properties": {
                "name": "EPSG:32628_local_enu_m_section_centroid",
                "lng0": lng0,
                "lat0": lat0,
            },
        },
        "features": features,
    }
    json.dump(gj, open(path, "w", encoding="utf-8"), ensure_ascii=False)


# ----------------------------------------------------------------- master

def build_pack(cusec: str, out_dir: pathlib.Path, cache: Optional[Dict] = None,
               verbose: bool = True):
    """Construye un data pack para ``cusec``.

    Si se pasa ``cache`` (dict con datasets pre-cargados y, opcionalmente,
    índices STRtree) se evita releer los ficheros grandes en cada llamada.
    """
    t0 = time.time()
    cache = cache or {}
    def _say(msg):
        if verbose:
            print(msg)
    _say(f"[{cusec}] cargando…")

    sec_geom_lnglat, mun, nmun = load_section_polygon(
        cusec, sections_collection=cache.get("sections"))
    # Saneo previo: anillos invertidos / auto-intersecciones del INE.
    if not sec_geom_lnglat.is_valid:
        rg = _repair_geom(sec_geom_lnglat)
        if rg is not None and not rg.is_empty:
            sec_geom_lnglat = rg
    if isinstance(sec_geom_lnglat, MultiPolygon):
        sec_geom_lnglat = max(sec_geom_lnglat.geoms, key=lambda p: p.area)
    bbox = sec_geom_lnglat.bounds
    centroid = sec_geom_lnglat.centroid
    lng0, lat0 = centroid.x, centroid.y
    to_local, cos_lat0 = project_to_meters(lng0, lat0)

    section_ring_xz = [to_local(*c) for c in sec_geom_lnglat.exterior.coords]
    section_xz = Polygon(section_ring_xz)
    if not section_xz.is_valid:
        section_xz = section_xz.buffer(0)
    if isinstance(section_xz, MultiPolygon):
        section_xz = max(section_xz.geoms, key=lambda p: p.area)
        section_ring_xz = [list(c) for c in section_xz.exterior.coords]
    area_m2 = section_xz.area
    perim_m = section_xz.length

    raw = load_buildings(cusec)
    buildings: List[Dict] = []
    polys_xz: List[Polygon] = []
    heights: List[float] = []
    for idx, b in enumerate(raw):
        ring_lnglat = b[0]
        h = float(b[1]) if len(b) >= 2 and b[1] else 6.0
        if h < 1.5:
            h = 6.0
        levels = int(b[2]) if len(b) >= 3 and b[2] is not None else None
        ring_xz = [to_local(*p) for p in ring_lnglat]
        if ring_xz[0] != ring_xz[-1]:
            ring_xz.append(ring_xz[0])
        try:
            poly = Polygon(ring_xz)
            if not poly.is_valid:
                fixed = _repair_geom(poly)
                if fixed is None or fixed.is_empty:
                    continue
                if isinstance(fixed, MultiPolygon):
                    fixed = max(fixed.geoms, key=lambda p: p.area)
                if not isinstance(fixed, Polygon):
                    continue
                poly = fixed
                ring_xz = [list(c) for c in poly.exterior.coords]
            if poly.area < 1.0:
                continue
        except Exception:
            continue
        polys_xz.append(poly)
        heights.append(h)
        buildings.append({
            "id": idx,
            "ring_xz": ring_xz,
            "ring_lnglat": ring_lnglat,
            "height_m": h,
            "levels": levels,
            "category": "residencial",
            "centroid": (poly.centroid.x, poly.centroid.y),
            "bounds": poly.bounds,
            "manzana_id": None,
        })
    _say(f"[{cusec}] {len(buildings)} edificios válidos")

    bbox_pad = 0.0010
    roads_features: List[Dict] = []
    roads_xz: List[Tuple[str, list]] = []
    roads_collection = cache.get("roads") or json.load(
        open(ROADS_FILE, encoding="utf-8"))
    sec_box = box(*bbox).buffer(0.001)
    n_roads = 0
    roads_idx = cache.get("roads_idx")
    if roads_idx is not None:
        tree, feats = roads_idx
        from shapely.geometry import box as _box
        candidates = [feats[i] for i in tree.query(_box(*bbox).buffer(bbox_pad))]
        roads_iter = _bbox_filter(candidates, bbox, "LineString", pad=bbox_pad)
    else:
        roads_iter = _bbox_filter(roads_collection["features"], bbox,
                                  "LineString", pad=bbox_pad)
    for f in roads_iter:
        coords = f["geometry"]["coordinates"]
        try:
            line = LineString(coords)
        except Exception:
            continue
        if not _safe_intersects(line, sec_box):
            continue
        clipped = _safe_intersection(line, sec_box)
        if clipped is None or clipped.is_empty:
            continue
        hw = f["properties"].get("highway") or "service"
        rtype = ROAD_HW_TO_TYPE.get(hw, "service")
        width = ROAD_WIDTH.get(hw, 3.5)
        osm_id = f["properties"].get("osm_id")
        if isinstance(clipped, LineString):
            geoms = [clipped]
        elif isinstance(clipped, MultiLineString):
            geoms = list(clipped.geoms)
        else:
            geoms = []
        for g in geoms:
            ring_xz = [to_local(*c) for c in g.coords]
            if len(ring_xz) < 2:
                continue
            roads_xz.append((rtype, ring_xz))
            roads_features.append({
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": ring_xz,
                },
                "properties": {
                    "osm_id": osm_id,
                    "type": rtype,
                    "width_m": width,
                    "extrude": False,
                },
            })
            n_roads += 1
    _say(f"[{cusec}] {n_roads} segmentos de calle")

    pois_features: List[Dict] = []
    pois_xz: List[Tuple[Tuple[float,float], str]] = []
    pois_collection = cache.get("pois") or json.load(
        open(POIS_FILE, encoding="utf-8"))
    monuments_xz: List[Tuple[float,float,float,str]] = []
    monuments_features: List[Dict] = []
    pois_idx = cache.get("pois_idx")
    if pois_idx is not None:
        tree, feats = pois_idx
        from shapely.geometry import box as _box
        candidates = [feats[i] for i in tree.query(_box(*bbox).buffer(bbox_pad))]
        pois_iter = _bbox_filter(candidates, bbox, "Point", pad=bbox_pad)
    else:
        pois_iter = _bbox_filter(pois_collection["features"], bbox, "Point",
                                 pad=bbox_pad)
    for f in pois_iter:
        c = f["geometry"]["coordinates"]
        if not (bbox[0]-bbox_pad <= c[0] <= bbox[2]+bbox_pad and
                bbox[1]-bbox_pad <= c[1] <= bbox[3]+bbox_pad):
            continue
        t = f["properties"].get("type")
        cat_osm = f["properties"].get("category", "")
        if t in MONUMENT_TYPES or cat_osm == "historic":
            x, z = to_local(*c)
            mh = MONUMENT_HEIGHT.get(t, 6.0)
            monuments_xz.append((x, z, mh, f["properties"].get("name", "")))
            monuments_features.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [x, z]},
                "properties": {
                    "name": f["properties"].get("name"),
                    "kind": t,
                    "height_m": mh,
                    "category": "monumento",
                    "extrude": True,
                },
            })
            continue
        cat = POI_CAT_MAP.get(t)
        if not cat:
            continue
        x, z = to_local(*c)
        pois_xz.append(((x, z), cat))
        pois_features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [x, z]},
            "properties": {
                "osm_id": f["properties"].get("osm_id"),
                "category": cat,
                "name": f["properties"].get("name"),
                "extrude": False,
            },
        })
    _say(f"[{cusec}] {len(pois_features)} POIs comerciales, "
          f"{len(monuments_features)} monumentos OSM")

    trees_features: List[Dict] = []
    trees_xz: List[Tuple[float, float]] = []
    cd = cache.get("canteras")
    if cd is None and CANTERAS_DATA.exists():
        cd = json.load(open(CANTERAS_DATA, encoding="utf-8"))
    if cd is not None:
        c_lng = cd["center"]["lon"]; c_lat = cd["center"]["lat"]
        c_cos = math.cos(math.radians(c_lat))
        for tpos in cd.get("trees", []):
            tx_can, tz_can = float(tpos[0]), float(tpos[1])
            t_lng = c_lng + (tx_can / 111320.0 / c_cos)
            t_lat = c_lat - (tz_can / 111320.0)
            if not (bbox[0] <= t_lng <= bbox[2] and bbox[1] <= t_lat <= bbox[3]):
                continue
            x, z = to_local(t_lng, t_lat)
            trees_xz.append((x, z))
            trees_features.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [x, z]},
                "properties": {
                    "osm_id": None,
                    "height_m": 6.0,
                    "category": "arbol",
                    "extrude": True,
                },
            })
    _say(f"[{cusec}] {len(trees_features)} árboles dentro del bbox")

    parks_features: List[Dict] = []
    parks_xz: List[Polygon] = []
    parks_collection = cache.get("parks") or json.load(
        open(PARKS_FILE, encoding="utf-8"))
    parks_idx = cache.get("parks_idx")
    if parks_idx is not None:
        tree, feats = parks_idx
        from shapely.geometry import box as _box
        candidates = [feats[i] for i in tree.query(_box(*bbox).buffer(bbox_pad))]
        parks_iter = _bbox_filter(candidates, bbox, None, pad=bbox_pad)
    else:
        parks_iter = _bbox_filter(parks_collection["features"], bbox, None,
                                  pad=bbox_pad)
    for f in parks_iter:
        try:
            geom = shape(f["geometry"])
        except Exception:
            continue
        geom = _repair_geom(geom)
        if geom is None or geom.is_empty:
            continue
        if not _safe_intersects(geom, sec_box):
            continue
        clipped = _safe_intersection(geom, sec_box)
        if clipped is None or clipped.is_empty:
            continue
        polys_to_emit = []
        if isinstance(clipped, Polygon):
            polys_to_emit = [clipped]
        elif isinstance(clipped, MultiPolygon):
            polys_to_emit = list(clipped.geoms)
        for p in polys_to_emit:
            ring_xz = [to_local(lng, lat) for lng, lat in p.exterior.coords]
            parks_xz.append(Polygon(ring_xz))
            parks_features.append({
                "type": "Feature",
                "geometry": {"type": "Polygon", "coordinates": [ring_xz]},
                "properties": {
                    "name": f["properties"].get("name"),
                    "kind": f["properties"].get("type"),
                    "category": "parque",
                    "extrude": False,
                },
            })
    _say(f"[{cusec}] {len(parks_features)} parques recortados")

    water_features: List[Dict] = []
    water_xz: List = []
    water_collection = cache.get("water") or json.load(
        open(WATER_FILE, encoding="utf-8"))
    water_idx = cache.get("water_idx")
    if water_idx is not None:
        tree, feats = water_idx
        from shapely.geometry import box as _box
        candidates = [feats[i] for i in tree.query(_box(*bbox).buffer(bbox_pad))]
        water_iter = _bbox_filter(candidates, bbox, None, pad=bbox_pad)
    else:
        water_iter = _bbox_filter(water_collection["features"], bbox, None,
                                  pad=bbox_pad)
    for f in water_iter:
        try:
            geom = shape(f["geometry"])
        except Exception:
            continue
        geom = _repair_geom(geom)
        if geom is None or geom.is_empty:
            continue
        if not _safe_intersects(geom, sec_box):
            continue
        clipped = _safe_intersection(geom, sec_box)
        if clipped is None or clipped.is_empty:
            continue
        if isinstance(clipped, Polygon):
            polys_w = [clipped]
        elif isinstance(clipped, MultiPolygon):
            polys_w = list(clipped.geoms)
        else:
            polys_w = []
        for p in polys_w:
            ring_xz = [to_local(lng, lat) for lng, lat in p.exterior.coords]
            water_xz.append(Polygon(ring_xz))
            water_features.append({
                "type": "Feature",
                "geometry": {"type": "Polygon", "coordinates": [ring_xz]},
                "properties": {
                    "name": f["properties"].get("name"),
                    "kind": f["properties"].get("type"),
                    "category": "agua",
                    "extrude": False,
                },
            })
    _say(f"[{cusec}] {len(water_features)} polígonos de agua recortados")

    manzanas = extract_manzanas(polys_xz, heights, buf=3.5)
    manzanas_features: List[Dict] = []
    for mid, (mz_poly, h_med, n_b) in enumerate(manzanas):
        ring_xz = [list(p) for p in mz_poly.exterior.coords]
        manzanas_features.append({
            "type": "Feature",
            "geometry": {"type": "Polygon", "coordinates": [ring_xz]},
            "properties": {
                "id": mid,
                "height_median_m": h_med,
                "building_count": n_b,
                "area_m2": mz_poly.area,
            },
        })
        for b in buildings:
            if b["manzana_id"] is None:
                cx_, cz_ = b["centroid"]
                if mz_poly.contains(Point(cx_, cz_)):
                    b["manzana_id"] = mid
    _say(f"[{cusec}] {len(manzanas)} manzanas extraídas")

    monument_set = set()
    for b, poly in zip(buildings, polys_xz):
        cat = assign_building_category(poly, b["height_m"], pois_xz,
                                        max_dist_m=30.0)
        b["category"] = cat

    buildings_features: List[Dict] = []
    for b in buildings:
        ring_xz = [list(p) for p in b["ring_xz"]]
        buildings_features.append({
            "type": "Feature",
            "geometry": {"type": "Polygon", "coordinates": [ring_xz]},
            "properties": {
                "id": b["id"],
                "height_m": b["height_m"],
                "levels": b["levels"],
                "category": b["category"],
                "extrude": True,
                "manzana_id": b["manzana_id"],
            },
        })

    sec_features = [
        {
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [
                    [list(c) for c in sec_geom_lnglat.exterior.coords],
                ],
            },
            "properties": {
                "cusec": cusec, "mun": mun, "nmun": nmun,
                "area_m2": area_m2, "perimeter_m": perim_m,
                "coords_system": "wgs84",
            },
        },
        {
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [
                    [list(c) for c in section_ring_xz],
                ],
            },
            "properties": {
                "cusec": cusec, "mun": mun, "nmun": nmun,
                "area_m2": area_m2, "perimeter_m": perim_m,
                "coords_system": "local_m_enu",
            },
        },
    ]
    section_gj = {
        "type": "FeatureCollection",
        "crs": {
            "type": "name",
            "properties": {
                "name": "wgs84_and_EPSG:32628_local_enu_m_section_centroid",
                "lng0": lng0, "lat0": lat0,
            },
        },
        "features": sec_features,
    }

    pack_dir = out_dir / cusec
    pack_dir.mkdir(parents=True, exist_ok=True)

    bx0, bz0, bx1, bz1 = section_xz.bounds
    meta = {
        "cusec": cusec,
        "mun": mun,
        "nmun": nmun,
        "area_ha": area_m2 / 10000.0,
        "perimeter_m": perim_m,
        "building_count": len(buildings_features),
        "tree_count": len(trees_features),
        "tree_data_source": ("canteras_data.json" if len(trees_features) > 0
                              else None),
        "monument_count": len(monuments_features),
        "poi_count": len(pois_features),
        "road_segment_count": len(roads_features),
        "centroid_lnglat": [lng0, lat0],
        "bbox_lnglat": list(bbox),
        "bbox_local_m": [bx0, bz0, bx1, bz1],
        "enu_basis": {"lng0": lng0, "lat0": lat0, "cos_lat0": cos_lat0},
        "godot_axis_mapping": "X=east_m, Y=height_m, Z=south_m (right-handed, Y up)",
        "produced_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "producer": "iso_pack.py v1",
        "categories": CATEGORIES,
    }
    json.dump(meta, open(pack_dir / "meta.json", "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)

    json.dump(section_gj, open(pack_dir / "section.geojson", "w", encoding="utf-8"),
              ensure_ascii=False)
    write_geojson(pack_dir / "buildings.geojson", buildings_features, lng0, lat0)
    write_geojson(pack_dir / "manzanas.geojson", manzanas_features, lng0, lat0)
    write_geojson(pack_dir / "roads.geojson", roads_features, lng0, lat0)
    write_geojson(pack_dir / "pois.geojson", pois_features, lng0, lat0)
    write_geojson(pack_dir / "trees.geojson", trees_features, lng0, lat0)
    write_geojson(pack_dir / "monuments.geojson", monuments_features, lng0, lat0)
    write_geojson(pack_dir / "parks.geojson", parks_features, lng0, lat0)
    write_geojson(pack_dir / "water.geojson", water_features, lng0, lat0)

    stats = {
        "n_edif": len(buildings_features),
        "n_arboles": len(trees_features),
        "n_monumentos": len(monuments_features),
        "n_pois": len(pois_features),
        "area_ha": area_m2 / 10000.0,
        "date": datetime.now().strftime("%Y-%m-%d"),
    }
    render_preview(pack_dir / "preview.png",
                   cusec=cusec, section_xz=section_xz,
                   buildings=buildings, manzanas=manzanas,
                   roads_xz=roads_xz, parks_xz=parks_xz,
                   water_xz=water_xz, pois_xz=pois_xz,
                   trees_xz=trees_xz, monuments_xz=monuments_xz,
                   stats=stats)

    elapsed = time.time() - t0
    _say(f"[{cusec}] OK pack en {pack_dir}  ({elapsed:.1f}s)")
    return pack_dir, elapsed, stats, len(manzanas), len(roads_features), \
        len(parks_features), len(water_features)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cusec", help="Código de sección censal (10 dígitos)")
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT),
                    help="Directorio raíz de salida (default: public/sections_pack)")
    args = ap.parse_args()
    out_dir = pathlib.Path(args.out_dir)
    if not out_dir.is_absolute():
        out_dir = ROOT / out_dir
    pack_dir, elapsed, stats, n_mz, n_rd, n_pk, n_wa = build_pack(args.cusec, out_dir)
    print()
    print(f"=== iso_pack v1 — {args.cusec} ===")
    print(f"directorio:    {pack_dir}")
    print(f"preview:       {pack_dir / 'preview.png'}")
    print(f"edificios:     {stats['n_edif']}")
    print(f"manzanas:      {n_mz}")
    print(f"calles:        {n_rd}")
    print(f"POIs:          {stats['n_pois']}")
    print(f"árboles:       {stats['n_arboles']}")
    print(f"monumentos:    {stats['n_monumentos']}")
    print(f"parques:       {n_pk}")
    print(f"agua:          {n_wa}")
    print(f"área:          {stats['area_ha']:.2f} ha")
    print(f"tiempo total:  {elapsed:.1f} s")


if __name__ == "__main__":
    main()
