"""KOINOS · POLIS — prueba de fidelidad por sección.

Genera UN PNG con TRES paneles horizontales del MISMO bbox de la sección:

    A. SATÉLITE real (Esri World Imagery / fallback CARTO / OSM) + contorno sección
    B. FOOTPRINTS (mismos polígonos pintados en ocre semitransparente sobre satélite)
    C. ISO render KOINOS (LOD-2 de iso_packages.py panel 4) + ground tile + roads

Salida:
    design/secciones/<cusec>_fidelity.png
    design/secciones/<cusec>_satellite_raw.png

Uso:
    python3 iso_fidelity.py 3501602007

NB: requiere conexión a internet para descargar tiles. Probará Esri primero,
luego CARTO Voyager, luego OpenStreetMap. Si TODOS fallan, panel A muestra
mensaje "satélite no disponible" pero B y C se generan igualmente.
"""
from __future__ import annotations
import argparse, json, math, pathlib, time, urllib.request, urllib.error, io, sys
from collections import Counter
from typing import Dict, List, Tuple, Optional
from PIL import Image, ImageDraw, ImageFont
from shapely.geometry import shape, Polygon, MultiPolygon, LineString, box
from shapely.ops import unary_union

ROOT = pathlib.Path(__file__).resolve().parent
PUBLIC = ROOT.parent / "public"
BUILDINGS = PUBLIC / "buildings"
SECCIONES = PUBLIC / "gc-secciones-lite.json"
ROADS = PUBLIC / "osm-gc" / "roads.json"
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
}

COS30 = math.cos(math.radians(30))
SIN30 = 0.5

# ----------------------------------------------------- iso helpers (de iso_packages)
def iso(x, y, z, sxy, sz, cx, cy):
    return (cx + (x - y) * COS30 * sxy,
            cy + (x + y) * SIN30 * sxy - z * sz)

def shade(rgb, k):
    return tuple(max(0, min(255, int(c * k))) for c in rgb)

def project_to_meters(lon0: float, lat0: float):
    cos_lat0 = math.cos(math.radians(lat0))
    def to_m(lng, lat):
        return ((lng - lon0) * 111320 * cos_lat0,
               -(lat - lat0) * 111320)
    return to_m, cos_lat0

# ----------------------------------------------------- data
def load_section_polygon(cusec: str) -> Polygon:
    coll = json.load(open(SECCIONES, encoding="utf-8"))
    for f in coll["features"]:
        if f["properties"]["cusec"] == cusec:
            return shape(f["geometry"])
    raise ValueError(f"sección {cusec} no encontrada")

def load_buildings(cusec: str) -> list:
    return json.load(open(BUILDINGS / f"{cusec}.json", encoding="utf-8"))

def load_roads_in_bbox(bbox) -> List[Tuple[str, list]]:
    coll = json.load(open(ROADS, encoding="utf-8"))
    bb = box(*bbox)
    out = []
    for f in coll["features"]:
        if f["geometry"]["type"] != "LineString":
            continue
        coords = f["geometry"]["coordinates"]
        if not any(bbox[0]-0.001<=c[0]<=bbox[2]+0.001 and bbox[1]-0.001<=c[1]<=bbox[3]+0.001 for c in coords):
            continue
        line = LineString(coords)
        if not line.intersects(bb): continue
        clipped = line.intersection(bb)
        if clipped.is_empty: continue
        hw = f["properties"].get("highway")
        if clipped.geom_type == "LineString":
            out.append((hw, list(clipped.coords)))
        elif clipped.geom_type == "MultiLineString":
            for g in clipped.geoms:
                out.append((hw, list(g.coords)))
    return out

# ----------------------------------------------------- tiles
TILE_SOURCES = [
    ("Esri World Imagery",
     "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
     18),
    ("CARTO Voyager",
     "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
     18),
    ("OpenStreetMap",
     "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
     18),
]

def lnglat_to_tile(lng, lat, z):
    n = 2 ** z
    x = (lng + 180) / 360 * n
    rad = math.radians(lat)
    y = (1 - math.log(math.tan(rad) + 1/math.cos(rad))/math.pi)/2 * n
    return x, y

def fetch_tile(url, timeout=8):
    req = urllib.request.Request(url, headers={"User-Agent": "KOINOS/1.0 (https://koinos.es)"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

def fetch_satellite(bbox, max_w_px=1500) -> Tuple[Optional[Image.Image], callable, str, float]:
    """Try sources in order until one returns enough tiles. Returns
       (image_or_None, lnglat_to_pixel_fn, source_label, elapsed_seconds)."""
    min_lng, min_lat, max_lng, max_lat = bbox
    errors = []
    for label, tmpl, z in TILE_SOURCES:
        # tile coords
        x0, y1 = lnglat_to_tile(min_lng, min_lat, z)
        x1, y0 = lnglat_to_tile(max_lng, max_lat, z)
        tx0, tx1 = int(math.floor(x0)), int(math.floor(x1))
        ty0, ty1 = int(math.floor(y0)), int(math.floor(y1))
        cols, rows = tx1 - tx0 + 1, ty1 - ty0 + 1
        # cap zoom if too big
        while cols * rows > 64 and z > 14:
            z -= 1
            x0, y1 = lnglat_to_tile(min_lng, min_lat, z)
            x1, y0 = lnglat_to_tile(max_lng, max_lat, z)
            tx0, tx1 = int(math.floor(x0)), int(math.floor(x1))
            ty0, ty1 = int(math.floor(y0)), int(math.floor(y1))
            cols, rows = tx1 - tx0 + 1, ty1 - ty0 + 1
        print(f"   probando {label} z={z} → {cols}x{rows}={cols*rows} tiles")
        t0 = time.time()
        img = Image.new("RGB", (cols * 256, rows * 256), (200, 200, 200))
        ok = 0
        first_fail = None
        for ty in range(ty0, ty1 + 1):
            for tx in range(tx0, tx1 + 1):
                url = tmpl.format(z=z, x=tx, y=ty)
                try:
                    data = fetch_tile(url, timeout=8)
                    tile = Image.open(io.BytesIO(data)).convert("RGB")
                    img.paste(tile, ((tx - tx0) * 256, (ty - ty0) * 256))
                    ok += 1
                except Exception as e:
                    if first_fail is None:
                        first_fail = f"{type(e).__name__}: {e}"
            # bail rápido si la primera fila falla del todo
            if ty == ty0 and ok == 0 and first_fail:
                break
        elapsed = time.time() - t0
        if ok >= cols * rows * 0.75:
            # construir lnglat→pixel del mosaico
            def make_ll2px(z=z, tx0=tx0, ty0=ty0):
                def ll2px(lng, lat):
                    x, y = lnglat_to_tile(lng, lat, z)
                    return (x - tx0) * 256, (y - ty0) * 256
                return ll2px
            label_full = f"{label} z={z}"
            print(f"   ✔ {label_full}: {ok}/{cols*rows} tiles en {elapsed:.1f}s")
            return img, make_ll2px(), label_full, elapsed
        else:
            errors.append(f"{label}: {ok}/{cols*rows} ({first_fail})")
            print(f"   ✗ {label}: {ok}/{cols*rows} ({first_fail})")
    print("   ⚠ todas las fuentes fallaron:")
    for e in errors:
        print(f"      - {e}")
    return None, None, "fallo · " + "; ".join(errors)[:200], 0.0

# ----------------------------------------------------- font
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
    def first(paths, size):
        for c in paths:
            try: return ImageFont.truetype(c, size)
            except Exception: pass
        return ImageFont.load_default()
    return (first(candidates, 24), first(candidates_reg, 16),
            first(candidates, 32), first(candidates_reg, 18))

# ----------------------------------------------------- iso prism (de iso_packages)
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

def draw_roads_iso(d, roads_m, sxy, sz, cx, cy):
    importance = {
        "motorway":7, "trunk":7, "primary":6, "secondary":5, "tertiary":4,
        "unclassified":3, "residential":3, "living_street":3,
        "pedestrian":2, "service":1, "footway":1, "path":1, "track":1,
        "cycleway":1, "steps":1,
    }
    for hw, ring_m in sorted(roads_m, key=lambda r: importance.get(r[0], 0)):
        col, w = ROAD_STYLE.get(hw, (P["sand_lt"], 1))
        pts = [iso(x, y, 0, sxy, sz, cx, cy) for x,y in ring_m]
        if len(pts) >= 2:
            d.line(pts, fill=col, width=w)

# ----------------------------------------------------- panel canvas
PANEL_W = 1100
PANEL_H = 1100
BANNER_H = 90

def panel_with_title(title: str) -> Tuple[Image.Image, ImageDraw.ImageDraw]:
    img = Image.new("RGBA", (PANEL_W, PANEL_H), P["paper"]+(255,))
    d = ImageDraw.Draw(img)
    f_t, f_s, _, _ = fonts()
    d.rectangle((0, 0, PANEL_W, 56), fill=P["ink"]+(255,))
    d.text((22, 14), title, fill=P["paper"], font=f_t)
    return img, d

# ----------------------------------------------------- crop satellite to bbox
def crop_satellite_to_bbox(sat: Image.Image, ll2px, bbox, pad_frac=0.04
                           ) -> Tuple[Image.Image, callable, Tuple[float,float,float,float]]:
    """Recorta la imagen al bbox + padding. Devuelve (cropped, new_ll2px_to_PANEL, used_bbox)."""
    min_lng, min_lat, max_lng, max_lat = bbox
    dlng = (max_lng - min_lng) * pad_frac
    dlat = (max_lat - min_lat) * pad_frac
    e_bbox = (min_lng - dlng, min_lat - dlat, max_lng + dlng, max_lat + dlat)
    # esquinas en píxeles del mosaico
    px0, py1 = ll2px(e_bbox[0], e_bbox[1])  # SW
    px1, py0 = ll2px(e_bbox[2], e_bbox[3])  # NE
    cx0, cy0 = int(min(px0, px1)), int(min(py0, py1))
    cx1, cy1 = int(max(px0, px1)), int(max(py0, py1))
    cx0, cy0 = max(0, cx0), max(0, cy0)
    cx1 = min(sat.size[0], cx1)
    cy1 = min(sat.size[1], cy1)
    cropped = sat.crop((cx0, cy0, cx1, cy1))
    return cropped, e_bbox

def render_satellite_panel(sat_crop: Image.Image, used_bbox, sec_poly_lnglat: Polygon,
                           label: str, sublabel: str, *, footprints_lnglat=None
                           ) -> Image.Image:
    """Render satélite en panel 1100x1100; opcionalmente pinta footprints encima."""
    img, d = panel_with_title(label)
    f_t, f_s, _, _ = fonts()
    # área de imagen: y 60 → PANEL_H-50 (deja banda inferior para subtítulo)
    avail_y0, avail_y1 = 60, PANEL_H - 50
    avail_x0, avail_x1 = 10, PANEL_W - 10
    aw = avail_x1 - avail_x0
    ah = avail_y1 - avail_y0
    sw, sh = sat_crop.size
    if sw == 0 or sh == 0:
        d.text((20, avail_y0 + 20), "satélite no disponible", fill=P["accent"], font=f_t)
        return img
    s = min(aw / sw, ah / sh)
    fw, fh = int(sw * s), int(sh * s)
    sat_resized = sat_crop.resize((fw, fh), Image.LANCZOS).convert("RGBA")
    ox = avail_x0 + (aw - fw) // 2
    oy = avail_y0 + (ah - fh) // 2
    img.paste(sat_resized, (ox, oy))
    # mapping lnglat → panel coords
    min_lng, min_lat, max_lng, max_lat = used_bbox
    def ll2panel(lng, lat):
        u = (lng - min_lng) / (max_lng - min_lng) * fw
        v = (max_lat - lat) / (max_lat - min_lat) * fh
        return ox + u, oy + v
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    # footprints opcionales (panel B)
    if footprints_lnglat:
        for ring in footprints_lnglat:
            pts = [ll2panel(lng, lat) for lng, lat in ring]
            if len(pts) >= 3:
                fill = P["ocre"] + (110,)
                od.polygon(pts, fill=fill, outline=P["ink"]+(220,))
    # contorno de la sección (línea blanca semi-transparente)
    if isinstance(sec_poly_lnglat, MultiPolygon):
        rings = [list(p.exterior.coords) for p in sec_poly_lnglat.geoms]
    else:
        rings = [list(sec_poly_lnglat.exterior.coords)]
    for ring in rings:
        pts = [ll2panel(lng, lat) for lng, lat in ring]
        if len(pts) >= 2:
            od.line(pts, fill=(255, 255, 255, 180), width=3)
            od.line(pts, fill=P["ink"]+(120,), width=1)
    img = Image.alpha_composite(img, overlay)
    d = ImageDraw.Draw(img)
    d.text((22, PANEL_H - 36), sublabel, fill=P["ocre_dk"], font=f_s)
    return img

def render_iso_panel(cusec, polys_m, heights, roads_m, section_m_ring, section_m,
                     label: str, sublabel: str) -> Image.Image:
    img, d = panel_with_title(label)
    f_t, f_s, _, _ = fonts()
    # escala iso
    bx0, by0, bx1, by1 = section_m.bounds
    h_max = max(heights) if heights else 12
    bw, bh = bx1 - bx0, by1 - by0
    span_w = (bw + bh) * COS30
    span_h = (bw + bh) * SIN30 + h_max * 1.6
    margin = 70
    sxy = min((PANEL_W - 2*margin)/span_w, (PANEL_H - 2*margin - 80)/span_h)
    sz = sxy * 1.6
    mx = (bx0+bx1)/2; my = (by0+by1)/2
    cx = PANEL_W/2 - (mx-my)*COS30*sxy
    cy = PANEL_H/2 + 60 - (mx+my)*SIN30*sxy
    # ground tile = sección
    pts_section = [iso(x, y, 0, sxy, sz, cx, cy) for x,y in section_m_ring]
    d.polygon(pts_section, fill=P["cream"]+(255,), outline=P["ocre_dk"], width=3)
    # roads dentro/cerca del bbox
    draw_roads_iso(d, roads_m, sxy, sz, cx, cy)
    # contorno sección encima de roads
    d.line(pts_section, fill=P["ocre_dk"], width=3)
    # edificios painter's algo
    order = sorted(range(len(polys_m)),
                   key=lambda i: polys_m[i].bounds[0]+polys_m[i].bounds[1])
    for i in order:
        ext = list(polys_m[i].exterior.coords)
        render_prism(d, ext, heights[i], sxy, sz, cx, cy,
                     top=P["sand_lt"], left=P["sand"], right=P["ocre"], stroke=1)
    d.text((22, PANEL_H - 36), sublabel, fill=P["ocre_dk"], font=f_s)
    return img

# ----------------------------------------------------- master
def render(cusec: str):
    t_total = time.time()
    print(f"[{cusec}] cargando sección…")
    sec_poly_lnglat = load_section_polygon(cusec)
    bbox = sec_poly_lnglat.bounds  # min_lng, min_lat, max_lng, max_lat
    raw = load_buildings(cusec)
    print(f"[{cusec}] {len(raw)} edificios, bbox={bbox}")

    # roads en lnglat
    roads_lnglat = load_roads_in_bbox(bbox)
    rcount = Counter(hw for hw,_ in roads_lnglat)
    print(f"[{cusec}] {len(roads_lnglat)} tramos: {rcount.most_common(5)}")

    # ---- proyección a metros para el panel C
    lon0 = (bbox[0]+bbox[2])/2
    lat0 = (bbox[1]+bbox[3])/2
    to_m, _ = project_to_meters(lon0, lat0)
    if isinstance(sec_poly_lnglat, MultiPolygon):
        sec_poly_main = max(sec_poly_lnglat.geoms, key=lambda p: p.area)
    else:
        sec_poly_main = sec_poly_lnglat
    section_m_ring = [to_m(*c) for c in sec_poly_main.exterior.coords]
    section_m = Polygon(section_m_ring)
    if not section_m.is_valid: section_m = section_m.buffer(0)

    polys_m, heights, footprints_lnglat = [], [], []
    for b in raw:
        ring_lnglat = b[0]
        ring_m = [to_m(*p) for p in ring_lnglat]
        if ring_m[0] != ring_m[-1]: ring_m.append(ring_m[0])
        h = float(b[1]) if len(b)>=2 and b[1] else 6.0
        if h < 1.5: h = 6.0
        try:
            p = Polygon(ring_m)
            if p.is_valid and p.area > 1.0:
                polys_m.append(p); heights.append(h)
                footprints_lnglat.append(ring_lnglat)
        except Exception:
            pass
    print(f"[{cusec}] {len(polys_m)} edificios válidos")

    roads_m = [(hw, [to_m(*c) for c in coords]) for hw, coords in roads_lnglat]

    area_ha = section_m.area / 10000.0

    # ---- DESCARGAR satélite
    print(f"[{cusec}] descargando tiles…")
    sat, ll2px, source_label, dl_secs = fetch_satellite(bbox)

    # ---- recortar al bbox de la sección
    if sat is not None:
        sat_crop, used_bbox = crop_satellite_to_bbox(sat, ll2px, bbox, pad_frac=0.04)
        # guardar raw crop
        raw_path = OUT / f"{cusec}_satellite_raw.png"
        sat_crop.save(raw_path, "PNG", optimize=True)
        print(f"[{cusec}] satélite guardado en {raw_path}  ({sat_crop.size})")
    else:
        sat_crop = None
        used_bbox = bbox
        # crear placeholder visual
        ph = Image.new("RGB", (1000, 1000), P["sand_lt"])
        pd = ImageDraw.Draw(ph)
        f_t, f_s, _, _ = fonts()
        pd.text((40, 40), "satélite no disponible", fill=P["accent"], font=f_t)
        pd.text((40, 80), source_label, fill=P["ink"], font=f_s)
        raw_path = OUT / f"{cusec}_satellite_raw.png"
        ph.save(raw_path, "PNG")
        print(f"[{cusec}] sin satélite — placeholder guardado")

    # ---- panel A
    today = time.strftime("%Y-%m-%d")
    sub_a = f"bbox sección · padding 4% · fuente: {source_label}"
    if sat_crop is not None:
        panel_a = render_satellite_panel(sat_crop, used_bbox, sec_poly_lnglat,
                                         f"SATÉLITE · {source_label}",
                                         sub_a)
    else:
        panel_a = Image.new("RGBA", (PANEL_W, PANEL_H), P["paper"]+(255,))
        d = ImageDraw.Draw(panel_a)
        f_t, f_s, _, _ = fonts()
        d.rectangle((0, 0, PANEL_W, 56), fill=P["ink"]+(255,))
        d.text((22, 14), "SATÉLITE · no disponible", fill=P["paper"], font=f_t)
        d.text((40, 100), "fuentes probadas y descartadas:", fill=P["accent"], font=f_t)
        wrap_y = 140
        for line in source_label.replace("fallo · ", "").split(";"):
            d.text((40, wrap_y), line.strip()[:120], fill=P["ink"], font=f_s)
            wrap_y += 26

    # ---- panel B (footprints sobre satélite)
    sub_b = f"{len(polys_m)} footprints · ocre alpha 110/255"
    if sat_crop is not None:
        panel_b = render_satellite_panel(sat_crop, used_bbox, sec_poly_lnglat,
                                         "FOOTPRINTS · OSM/Catastro vs satélite",
                                         sub_b,
                                         footprints_lnglat=footprints_lnglat)
    else:
        # sin satélite: pinta footprints sobre fondo paper
        panel_b = Image.new("RGBA", (PANEL_W, PANEL_H), P["paper"]+(255,))
        d = ImageDraw.Draw(panel_b)
        f_t, f_s, _, _ = fonts()
        d.rectangle((0, 0, PANEL_W, 56), fill=P["ink"]+(255,))
        d.text((22, 14), "FOOTPRINTS · sin satélite (no comparable)",
               fill=P["paper"], font=f_t)
        # render simple
        bx0, by0, bx1, by1 = section_m.bounds
        margin = 70
        s = min((PANEL_W-2*margin)/(bx1-bx0), (PANEL_H-2*margin-80)/(by1-by0))
        for ring_lnglat in footprints_lnglat:
            ring_m = [to_m(*p) for p in ring_lnglat]
            pts = [(margin + (x-bx0)*s, 60 + margin + (y-by0)*s) for x,y in ring_m]
            d.polygon(pts, fill=P["ocre"]+(180,), outline=P["ink"])
        d.text((22, PANEL_H - 36), sub_b, fill=P["ocre_dk"], font=f_s)

    # ---- panel C iso
    sub_c = f"{len(polys_m)} edificios extruidos · {len(roads_m)} tramos · {area_ha:.1f} ha"
    panel_c = render_iso_panel(cusec, polys_m, heights, roads_m,
                               section_m_ring, section_m,
                               "ISO · KOINOS (paquetes 1+2+4)", sub_c)

    # ---- composición final con banner
    f_t, f_s, f_b, f_b2 = fonts()
    total_w = PANEL_W * 3
    total_h = BANNER_H + PANEL_H
    out_img = Image.new("RGBA", (total_w, total_h), P["paper"]+(255,))
    bd = ImageDraw.Draw(out_img)
    bd.rectangle((0, 0, total_w, BANNER_H), fill=P["cream"]+(255,))
    bd.text((28, 14),
            f"KOINOS · POLIS — prueba de fidelidad · sección {cusec}",
            fill=P["ink"], font=f_b)
    sub = (f"cusec {cusec}  ·  {len(polys_m)} edificios  ·  "
           f"{len(roads_m)} tramos OSM  ·  {area_ha:.1f} ha  ·  "
           f"{today}  ·  fuente tiles: {source_label}")
    bd.text((28, 54), sub[:220], fill=P["ocre_dk"], font=f_b2)

    out_img.paste(panel_a, (0, BANNER_H))
    out_img.paste(panel_b, (PANEL_W, BANNER_H))
    out_img.paste(panel_c, (PANEL_W*2, BANNER_H))

    out_path = OUT / f"{cusec}_fidelity.png"
    out_img.convert("RGB").save(out_path, "PNG", optimize=True)
    elapsed_total = time.time() - t_total
    print(f"[{cusec}] guardado en {out_path}  total={elapsed_total:.1f}s  download={dl_secs:.1f}s")
    return out_path, source_label, dl_secs, len(polys_m), len(roads_m), area_ha

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("seccion", nargs="?", default="3501602007")
    args = ap.parse_args()
    render(args.seccion)
