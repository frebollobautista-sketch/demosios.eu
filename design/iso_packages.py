"""KOINOS · POLIS — paquetes de datos por sección (iso isométrico).

Renderiza UN PNG con CINCO paneles que apilan capas de datos sobre la misma
sección censal:

  1. Sección + grid 50 m
  2. + Vialidad (OSM)
  3. + Manzanas (LOD-1)
  4. + Edificios (LOD-2)
  5. + Categorización por uso POI

Uso:
    python3 iso_packages.py 3501604043

Necesita: Pillow, numpy, shapely.

Salida: design/secciones/<cusec>_packages.png
"""
from __future__ import annotations
import argparse, json, math, pathlib, time
from collections import Counter
from typing import Dict, List, Tuple
from PIL import Image, ImageDraw, ImageFont
from shapely.geometry import shape, Polygon, MultiPolygon, Point, LineString, box
from shapely.ops import unary_union

ROOT = pathlib.Path(__file__).resolve().parent
PUBLIC = ROOT.parent / "public"
BUILDINGS = PUBLIC / "buildings"
SECCIONES = PUBLIC / "gc-secciones-lite.json"
ROADS = PUBLIC / "osm-gc" / "roads.json"
POIS = PUBLIC / "osm-gc" / "pois.json"
OUT = ROOT / "secciones"
OUT.mkdir(exist_ok=True)

# ----- KOINOS palette
P = {
    "paper":   (251, 244, 221),
    "cream":   (244, 234, 212),
    "sand_lt": (240, 224, 192),
    "sand":    (200, 184, 152),
    "ocre":    (176, 120,  64),
    "ocre_dk": (138,  90,  42),
    "shadow":  (110,  72,  36),
    "ink":     ( 34,  29,  24),
    "accent":  (200,  84,  56),
    # uso por categoría
    "cat_food":   (220, 130,  55),   # restauración - naranja
    "cat_shop":   ( 70, 110, 175),   # comercio - azul
    "cat_lodge":  (135,  90, 175),   # alojamiento - púrpura
    "cat_health": ( 90, 155,  85),   # salud - verde
    "cat_finance":(195, 160,  60),   # finanzas - dorado
    "cat_civic":  ( 95, 130, 155),   # cívico/cultural - azul gris
    "cat_resi":   (220, 204, 170),   # residencial / sin POI - arena
}

COS30 = math.cos(math.radians(30))
SIN30 = 0.5

# --- mapeo type OSM → categoría visual
POI_CAT = {
    "restaurant": "food", "cafe": "food", "bar": "food", "pub": "food",
    "fast_food": "food", "ice_cream": "food", "biergarten": "food",
    "shop": "shop", "supermarket": "shop", "convenience": "shop",
    "marketplace": "shop", "department_store": "shop",
    "hotel": "lodge", "hostel": "lodge", "guest_house": "lodge",
    "apartment": "lodge", "motel": "lodge",
    "pharmacy": "health", "hospital": "health", "clinic": "health",
    "doctors": "health", "dentist": "health",
    "bank": "finance", "atm": "finance", "bureau_de_change": "finance",
    "school": "civic", "library": "civic", "museum": "civic",
    "place_of_worship": "civic", "townhall": "civic", "police": "civic",
    "fire_station": "civic", "post_office": "civic", "university": "civic",
    "viewpoint": "civic", "attraction": "civic", "kindergarten": "civic",
    "theatre": "civic", "arts_centre": "civic", "community_centre": "civic",
}
CAT_COLOR = {
    "food":    P["cat_food"],
    "shop":    P["cat_shop"],
    "lodge":   P["cat_lodge"],
    "health":  P["cat_health"],
    "finance": P["cat_finance"],
    "civic":   P["cat_civic"],
    "resi":    P["cat_resi"],
}
CAT_LABEL = {
    "food":    "restauración",
    "shop":    "comercio",
    "lodge":   "alojamiento",
    "health":  "salud",
    "finance": "finanzas",
    "civic":   "cívico/cultural",
    "resi":    "residencial / sin POI",
}

# ---------------------------------------------------------- iso helpers
def iso(x, y, z, sxy, sz, cx, cy):
    return (cx + (x - y) * COS30 * sxy,
            cy + (x + y) * SIN30 * sxy - z * sz)

def shade(rgb, k):
    return tuple(max(0, min(255, int(c * k))) for c in rgb)

# ---------------------------------------------------------- data loading
def load_section_polygon(cusec: str) -> Polygon:
    coll = json.load(open(SECCIONES, encoding="utf-8"))
    for f in coll["features"]:
        if f["properties"]["cusec"] == cusec:
            return shape(f["geometry"])
    raise ValueError(f"sección {cusec} no encontrada")

def load_buildings(cusec: str) -> list:
    return json.load(open(BUILDINGS / f"{cusec}.json", encoding="utf-8"))

def load_roads_in_bbox(bbox) -> List[Tuple[str, list]]:
    """Devuelve [(highway_type, [(lng,lat),..]), ...] dentro del bbox."""
    coll = json.load(open(ROADS, encoding="utf-8"))
    bb = box(*bbox)
    out = []
    for f in coll["features"]:
        if f["geometry"]["type"] != "LineString":
            continue
        coords = f["geometry"]["coordinates"]
        # filtrado bbox rápido
        if not any(bbox[0]-0.001<=c[0]<=bbox[2]+0.001 and bbox[1]-0.001<=c[1]<=bbox[3]+0.001 for c in coords):
            continue
        line = LineString(coords)
        if not line.intersects(bb): continue
        clipped = line.intersection(bb)
        if clipped.is_empty: continue
        hw = f["properties"].get("highway")
        # admite multilinestring
        if clipped.geom_type == "LineString":
            out.append((hw, list(clipped.coords)))
        elif clipped.geom_type == "MultiLineString":
            for g in clipped.geoms:
                out.append((hw, list(g.coords)))
    return out

def load_pois_near(bbox, pad=0.003):
    coll = json.load(open(POIS, encoding="utf-8"))
    ebbox = (bbox[0]-pad, bbox[1]-pad, bbox[2]+pad, bbox[3]+pad)
    out = []
    for f in coll["features"]:
        c = f["geometry"]["coordinates"]
        if ebbox[0]<=c[0]<=ebbox[2] and ebbox[1]<=c[1]<=ebbox[3]:
            t = f["properties"].get("type")
            cat = POI_CAT.get(t)
            if cat:
                out.append((c, cat))
    return out

# ---------------------------------------------------------- projection
def project_to_meters(lon0: float, lat0: float):
    cos_lat0 = math.cos(math.radians(lat0))
    def to_m(lng, lat):
        return ((lng - lon0) * 111320 * cos_lat0,
               -(lat - lat0) * 111320)
    return to_m, cos_lat0

# ---------------------------------------------------------- manzanas
def extract_manzanas(polys: List[Polygon], heights: List[float], buf=3.5):
    expanded = [p.buffer(buf, join_style=2) for p in polys]
    merged = unary_union(expanded)
    merged_polys = [merged] if isinstance(merged, Polygon) else list(merged.geoms)
    manzanas = []
    for m in merged_polys:
        s = m.buffer(-buf*0.9, join_style=2)
        if s.is_empty: continue
        if isinstance(s, Polygon):
            manzanas.append(s)
        else:
            manzanas.extend(list(s.geoms))
    centroids = [p.centroid for p in polys]
    out = []
    for mz in manzanas:
        idx = [i for i,c in enumerate(centroids) if mz.contains(c)]
        if not idx:
            idx = [i for i,c in enumerate(centroids) if mz.intersects(polys[i])]
        if not idx: continue
        h_med = sorted(heights[i] for i in idx)[len(idx)//2]
        out.append((mz, h_med, len(idx)))
    return out

# ---------------------------------------------------------- categorías
def assign_categories(buildings_m: List[Polygon], heights: List[float],
                      poi_m: List[Tuple[Tuple[float,float], str]],
                      max_dist_m: float = 60.0):
    """Asigna a cada edificio la categoría del POI más cercano (si <max_dist_m).
    Si no hay POI cerca, usa heurística por altura+área para generar diversidad
    (ESTO ES UN DEMO DE COLORIZACIÓN — en producción se vincula con catastro
    + viviendas vacacionales + listas oficiales). Edificios pequeños bajos →
    comercio; medianos → residencial; muy bajos en esquina/grandes → cívico."""
    cats = []
    for poly, h in zip(buildings_m, heights):
        c = poly.centroid
        best, best_d = None, max_dist_m
        for (px, py), cat in poi_m:
            d = math.hypot(c.x - px, c.y - py)
            if d < best_d:
                best_d = d; best = cat
        if best:
            cats.append(best)
            continue
        # heurística para diversificar: en el demo asignamos algunos edificios
        # a categorías plausibles por geometría. En producción esta función
        # se reemplaza por joins con catastro/INE/listas oficiales.
        a = poly.area
        if a > 400 and h < 9:           # planta amplia, baja → comercio/local
            cats.append("shop")
        elif a > 900:                   # gran equipamiento
            cats.append("civic")
        elif h >= 12 and a < 220:       # alto y compacto → posible pensión/hostal
            cats.append("lodge")
        elif h >= 18:                   # edificio destacado en altura
            cats.append("finance")
        else:
            cats.append("resi")
    return cats

# ---------------------------------------------------------- font helpers
def fonts():
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
        "/System/Library/Fonts/Supplemental/Georgia Bold.ttf",
        "/System/Library/Fonts/Supplemental/Times New Roman Bold.ttf",
    ]
    candidates_reg = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
        "/System/Library/Fonts/Supplemental/Georgia.ttf",
        "/System/Library/Fonts/Supplemental/Times New Roman.ttf",
    ]
    f_t = f_s = f_b = f_b2 = None
    for c in candidates:
        try: f_t = ImageFont.truetype(c, 24); break
        except Exception: pass
    for c in candidates_reg:
        try: f_s = ImageFont.truetype(c, 16); break
        except Exception: pass
    for c in candidates:
        try: f_b = ImageFont.truetype(c, 32); break
        except Exception: pass
    for c in candidates_reg:
        try: f_b2 = ImageFont.truetype(c, 18); break
        except Exception: pass
    if f_t is None: f_t = ImageFont.load_default()
    if f_s is None: f_s = ImageFont.load_default()
    if f_b is None: f_b = ImageFont.load_default()
    if f_b2 is None: f_b2 = ImageFont.load_default()
    return f_t, f_s, f_b, f_b2

# ---------------------------------------------------------- iso primitives
def render_prism(d, ring, h, sxy, sz, cx, cy,
                 top, left, right, ink=P["ink"], stroke=1):
    if len(ring) >= 2 and ring[0] == ring[-1]:
        ring = ring[:-1]
    n = len(ring)
    if n < 3: return
    bot = [iso(x, y, 0, sxy, sz, cx, cy) for x,y in ring]
    top_pts = [iso(x, y, h, sxy, sz, cx, cy) for x,y in ring]
    for k in range(n):
        ax, ay = ring[k]; bx, by = ring[(k+1)%n]
        nx, ny = (by-ay), -(bx-ax)
        if nx + ny <= 0: continue
        tilt = nx / (abs(nx)+abs(ny)+1e-6)
        face = right if tilt > 0 else left
        d.polygon([bot[k], bot[(k+1)%n], top_pts[(k+1)%n], top_pts[k]],
                  fill=face, outline=ink, width=stroke)
    d.polygon(top_pts, fill=top, outline=ink, width=stroke)

def ground_section(d, section_ring_m, sxy, sz, cx, cy, fill=P["cream"],
                   outline=P["ocre_dk"], width=3):
    pts = [iso(x, y, 0, sxy, sz, cx, cy) for x,y in section_ring_m]
    d.polygon(pts, fill=fill, outline=outline, width=width)

def grid_50m(d, polygon_m: Polygon, sxy, sz, cx, cy, color=P["sand"]):
    bx0, by0, bx1, by1 = polygon_m.bounds
    step = 50.0
    x = math.floor(bx0/step) * step
    while x <= bx1:
        # clip vertical line (x = const) by polygon
        line = LineString([(x, by0-2), (x, by1+2)])
        clipped = line.intersection(polygon_m)
        if not clipped.is_empty:
            geoms = [clipped] if clipped.geom_type=="LineString" else list(clipped.geoms)
            for g in geoms:
                if g.geom_type != "LineString": continue
                pts = [iso(px, py, 0, sxy, sz, cx, cy) for px,py in g.coords]
                if len(pts)>=2:
                    d.line(pts, fill=color, width=1)
        x += step
    y = math.floor(by0/step) * step
    while y <= by1:
        line = LineString([(bx0-2, y), (bx1+2, y)])
        clipped = line.intersection(polygon_m)
        if not clipped.is_empty:
            geoms = [clipped] if clipped.geom_type=="LineString" else list(clipped.geoms)
            for g in geoms:
                if g.geom_type != "LineString": continue
                pts = [iso(px, py, 0, sxy, sz, cx, cy) for px,py in g.coords]
                if len(pts)>=2:
                    d.line(pts, fill=color, width=1)
        y += step

# ---------------------------------------------------------- panels
PANEL_W, PANEL_H = 1100, 1100
BANNER_H = 90

ROAD_STYLE = {
    "motorway":     (P["ink"],     6),
    "trunk":        (P["ink"],     6),
    "primary":      (P["shadow"],  5),
    "secondary":    (P["ocre_dk"], 4),
    "tertiary":     (P["ocre"],    3),
    "residential":  (P["sand"],    2),
    "unclassified": (P["sand"],    2),
    "living_street":(P["sand"],    2),
    "pedestrian":   (P["sand_lt"], 2),
    "service":      (P["sand_lt"], 1),
    "footway":      (P["sand_lt"], 1),
    "path":         (P["sand_lt"], 1),
    "track":        (P["sand_lt"], 1),
    "cycleway":     (P["sand_lt"], 1),
    "steps":        (P["sand_lt"], 1),
}

def draw_roads(d, roads_m, sxy, sz, cx, cy, polygon_m: Polygon):
    """Pinta cada road ya recortada; orden: anchas al final."""
    # ordenar de menor a mayor importancia para que las anchas queden encima
    importance = {
        "motorway":7, "trunk":7, "primary":6, "secondary":5, "tertiary":4,
        "unclassified":3, "residential":3, "living_street":3,
        "pedestrian":2, "service":1, "footway":1, "path":1, "track":1,
        "cycleway":1, "steps":1,
    }
    sorted_roads = sorted(roads_m, key=lambda r: importance.get(r[0], 0))
    for hw, ring_m in sorted_roads:
        col, w = ROAD_STYLE.get(hw, (P["sand_lt"], 1))
        pts = [iso(x, y, 0, sxy, sz, cx, cy) for x,y in ring_m]
        if len(pts) >= 2:
            d.line(pts, fill=col, width=w)

# ---------------------------------------------------------- panel builder
def panel(title: str, subtitle: str) -> Tuple[Image.Image, ImageDraw.ImageDraw]:
    img = Image.new("RGBA", (PANEL_W, PANEL_H), P["paper"]+(255,))
    d = ImageDraw.Draw(img)
    f_t, f_s, _, _ = fonts()
    # franja título
    d.rectangle((0, 0, PANEL_W, 56), fill=P["ink"]+(255,))
    d.text((22, 14), title, fill=P["paper"], font=f_t)
    # subtítulo (al pie)
    d.text((22, PANEL_H-32), subtitle, fill=P["ocre_dk"], font=f_s)
    return img, d

# ---------------------------------------------------------- master
def render(cusec: str):
    t0 = time.time()
    print(f"[{cusec}] cargando…")
    sec_poly_lnglat = load_section_polygon(cusec)
    bbox = sec_poly_lnglat.bounds
    raw = load_buildings(cusec)
    print(f"[{cusec}] {len(raw)} edificios, bbox={bbox}")

    # proyección al centro de la sección
    lon0 = (bbox[0]+bbox[2])/2
    lat0 = (bbox[1]+bbox[3])/2
    to_m, cos_lat0 = project_to_meters(lon0, lat0)

    # polígono sección en metros
    if isinstance(sec_poly_lnglat, MultiPolygon):
        sec_poly_lnglat = max(sec_poly_lnglat.geoms, key=lambda p: p.area)
    section_m_ring = [to_m(*c) for c in sec_poly_lnglat.exterior.coords]
    section_m = Polygon(section_m_ring)
    if not section_m.is_valid:
        section_m = section_m.buffer(0)

    # edificios en metros
    polys_m, heights = [], []
    for b in raw:
        ring = [to_m(*p) for p in b[0]]
        if ring[0] != ring[-1]: ring.append(ring[0])
        h = float(b[1]) if len(b)>=2 and b[1] else 6.0
        if h < 1.5: h = 6.0
        try:
            p = Polygon(ring)
            if p.is_valid and p.area > 1.0:
                polys_m.append(p); heights.append(h)
        except Exception:
            pass
    print(f"[{cusec}] {len(polys_m)} edificios válidos")

    # roads en metros, recortados al bbox de la sección (no a la sección estricta,
    # para mostrar la conexión con calles colindantes)
    roads_lnglat = load_roads_in_bbox(bbox)
    roads_m = [(hw, [to_m(*c) for c in coords]) for hw, coords in roads_lnglat]
    rcount = Counter(hw for hw,_ in roads_m)
    print(f"[{cusec}] {len(roads_m)} tramos de calle: {rcount.most_common(6)}")

    # POIs cercanos
    pois_lnglat = load_pois_near(bbox, pad=0.0030)
    pois_m = [(to_m(*c), cat) for c, cat in pois_lnglat]
    print(f"[{cusec}] {len(pois_m)} POIs en bbox+pad")

    # manzanas
    manzanas = extract_manzanas(polys_m, heights, buf=3.5)
    print(f"[{cusec}] {len(manzanas)} manzanas")

    # categorías por edificio
    cats = assign_categories(polys_m, heights, pois_m, max_dist_m=60.0)
    cat_counter = Counter(cats)
    print(f"[{cusec}] categorías: {cat_counter.most_common()}")

    # ----- escala común a los 5 paneles
    bx0, by0, bx1, by1 = section_m.bounds
    h_max = max(heights)
    bw, bh = bx1-bx0, by1-by0
    span_w = (bw + bh) * COS30
    span_h = (bw + bh) * SIN30 + h_max * 1.6
    margin = 70
    sxy = min((PANEL_W - 2*margin)/span_w, (PANEL_H - 2*margin - 80)/span_h)
    sz = sxy * 1.6
    mx = (bx0+bx1)/2; my = (by0+by1)/2
    cx_canvas = PANEL_W/2 - (mx-my)*COS30*sxy
    cy_canvas = PANEL_H/2 + 60 - (mx+my)*SIN30*sxy

    # painter order: deepest first (smallest x+y bound)
    order_b = sorted(range(len(polys_m)), key=lambda i: polys_m[i].bounds[0]+polys_m[i].bounds[1])
    order_mz = sorted(range(len(manzanas)), key=lambda i: manzanas[i][0].bounds[0]+manzanas[i][0].bounds[1])

    # ----- métricas para subtítulos
    area_ha = section_m.area / 10000.0
    perim_m = section_m.length

    panels = []

    # ===== panel 1: sección + grid
    print(f"[{cusec}] panel 1/5 sección+grid")
    p1, d1 = panel("paquete 1 · sección + grid",
                   f"sup. {area_ha:.2f} ha  ·  perímetro {perim_m:.0f} m  ·  retícula 50 m")
    ground_section(d1, section_m_ring, sxy, sz, cx_canvas, cy_canvas)
    grid_50m(d1, section_m, sxy, sz, cx_canvas, cy_canvas)
    # contorno por encima
    pts = [iso(x, y, 0, sxy, sz, cx_canvas, cy_canvas) for x,y in section_m_ring]
    d1.line(pts, fill=P["ocre_dk"], width=3)
    panels.append(p1)

    # ===== panel 2: + vialidad
    print(f"[{cusec}] panel 2/5 +vialidad")
    types_summary = []
    for tp in ("primary","secondary","tertiary","residential","service"):
        if rcount.get(tp,0):
            types_summary.append(f"{rcount[tp]} {tp}")
    if not types_summary:
        types_summary = [f"{n} {tp}" for tp,n in rcount.most_common(4)]
    p2, d2 = panel("paquete 2 · + vialidad (OSM)",
                   "  ·  ".join(types_summary)[:120])
    ground_section(d2, section_m_ring, sxy, sz, cx_canvas, cy_canvas)
    grid_50m(d2, section_m, sxy, sz, cx_canvas, cy_canvas)
    draw_roads(d2, roads_m, sxy, sz, cx_canvas, cy_canvas, section_m)
    pts = [iso(x, y, 0, sxy, sz, cx_canvas, cy_canvas) for x,y in section_m_ring]
    d2.line(pts, fill=P["ocre_dk"], width=3)
    panels.append(p2)

    # ===== panel 3: + manzanas
    print(f"[{cusec}] panel 3/5 +manzanas")
    p3, d3 = panel("paquete 3 · + manzanas (LOD-1)",
                   f"{len(manzanas)} manzanas extruidas a altura mediana del bloque")
    ground_section(d3, section_m_ring, sxy, sz, cx_canvas, cy_canvas)
    grid_50m(d3, section_m, sxy, sz, cx_canvas, cy_canvas)
    draw_roads(d3, roads_m, sxy, sz, cx_canvas, cy_canvas, section_m)
    for i in order_mz:
        mz_poly, mz_h, _ = manzanas[i]
        ext = list(mz_poly.exterior.coords)
        render_prism(d3, ext, mz_h, sxy, sz, cx_canvas, cy_canvas,
                     top=P["sand_lt"], left=P["sand"], right=P["ocre"], stroke=1)
    pts = [iso(x, y, 0, sxy, sz, cx_canvas, cy_canvas) for x,y in section_m_ring]
    d3.line(pts, fill=P["ocre_dk"], width=3)
    panels.append(p3)

    # ===== panel 4: + edificios LOD-2
    print(f"[{cusec}] panel 4/5 +edificios")
    p4, d4 = panel("paquete 4 · + edificios (LOD-2)",
                   f"{len(polys_m)} edificios individuales  ·  altura real m")
    ground_section(d4, section_m_ring, sxy, sz, cx_canvas, cy_canvas)
    grid_50m(d4, section_m, sxy, sz, cx_canvas, cy_canvas)
    draw_roads(d4, roads_m, sxy, sz, cx_canvas, cy_canvas, section_m)
    for i in order_b:
        ext = list(polys_m[i].exterior.coords)
        render_prism(d4, ext, heights[i], sxy, sz, cx_canvas, cy_canvas,
                     top=P["sand_lt"], left=P["sand"], right=P["ocre"], stroke=1)
    pts = [iso(x, y, 0, sxy, sz, cx_canvas, cy_canvas) for x,y in section_m_ring]
    d4.line(pts, fill=P["ocre_dk"], width=3)
    panels.append(p4)

    # ===== panel 5: + categorización
    print(f"[{cusec}] panel 5/5 +categorías")
    n_cat = sum(1 for c in cats if c != "resi")
    p5, d5 = panel("paquete 5 · + uso (POI dominante)",
                   f"{n_cat}/{len(cats)} edificios coloreados por categoría dominante  ·  POI<60m + heurística")
    ground_section(d5, section_m_ring, sxy, sz, cx_canvas, cy_canvas)
    grid_50m(d5, section_m, sxy, sz, cx_canvas, cy_canvas)
    draw_roads(d5, roads_m, sxy, sz, cx_canvas, cy_canvas, section_m)
    for i in order_b:
        ext = list(polys_m[i].exterior.coords)
        cat = cats[i]
        base = CAT_COLOR[cat]
        top = base
        left = shade(base, 0.78)
        right = shade(base, 0.92)
        render_prism(d5, ext, heights[i], sxy, sz, cx_canvas, cy_canvas,
                     top=top, left=left, right=right, stroke=1)
    pts = [iso(x, y, 0, sxy, sz, cx_canvas, cy_canvas) for x,y in section_m_ring]
    d5.line(pts, fill=P["ocre_dk"], width=3)
    # leyenda al pie del panel 5
    f_t, f_s, _, _ = fonts()
    legend_y = PANEL_H - 64
    legend_x = 22
    d5.rectangle((0, legend_y-4, PANEL_W, legend_y+30), fill=P["cream"]+(255,))
    cur_x = legend_x
    for cat in ("food","shop","lodge","health","finance","civic","resi"):
        col = CAT_COLOR[cat]
        d5.rectangle((cur_x, legend_y+2, cur_x+18, legend_y+20),
                     fill=col, outline=P["ink"])
        label = CAT_LABEL[cat]
        n = cat_counter.get(cat, 0)
        txt = f"{label} ({n})"
        d5.text((cur_x+22, legend_y+4), txt, fill=P["ink"], font=f_s)
        # estima ancho
        w_est = 22 + len(txt)*7
        cur_x += w_est + 12
    panels.append(p5)

    # ===== composición global con banner
    f_t, f_s, f_b, f_b2 = fonts()
    total_w = PANEL_W * 5
    total_h = BANNER_H + PANEL_H
    out_img = Image.new("RGBA", (total_w, total_h), P["paper"]+(255,))
    bd = ImageDraw.Draw(out_img)
    bd.rectangle((0, 0, total_w, BANNER_H), fill=P["cream"]+(255,))
    bd.text((28, 14),
            f"KOINOS · POLIS — paquetes de datos por sección  ·  {cusec}",
            fill=P["ink"], font=f_b)
    bd.text((28, 54),
            "Cada paquete añade una capa sobre la anterior. Misma sección, mismo encuadre.",
            fill=P["ocre_dk"], font=f_b2)
    for i, p in enumerate(panels):
        out_img.paste(p, (i*PANEL_W, BANNER_H))

    out_path = OUT / f"{cusec}_packages.png"
    out_img.convert("RGB").save(out_path, "PNG", optimize=True)
    elapsed = time.time() - t0
    print(f"[{cusec}] guardado en {out_path}  ({elapsed:.1f}s)")
    return out_path, elapsed

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("seccion", nargs="?", default="3501604043")
    args = ap.parse_args()
    out, dt = render(args.seccion)
    print("→", out, f"  {dt:.1f}s")
