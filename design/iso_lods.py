"""KOINOS · POLIS — Niveles de detalle (LOD) en isométrico monocromo.

LOD-0:  la sección entera como un único bloque  (vista provincia/municipio)
LOD-1:  las manzanas extraídas por buffer+disolución  (vista de tablero)
LOD-2:  los edificios uno a uno  (vista jugable, donde van color y partidas)

Sin colores del satélite — sólo paleta KOINOS y silueta.  Estilo limpio
tipo Into the Breach: trazo grueso, paleta cálida, mínimo ruido.

    python3 iso_lods.py 3501602010 [--buffer 3.5]
"""
from __future__ import annotations
import argparse, json, math, pathlib
from typing import List, Tuple
from PIL import Image, ImageDraw, ImageFont
from shapely.geometry import Polygon, MultiPolygon
from shapely.ops import unary_union

ROOT = pathlib.Path(__file__).resolve().parent
BUILDINGS = ROOT.parent / "public" / "buildings"
OUT = ROOT / "secciones"
OUT.mkdir(exist_ok=True)

# ----- KOINOS palette (matches the rest of the design system)
P = {
    "paper":    (251, 244, 221),
    "cream":    (244, 234, 212),
    "sand_lt":  (240, 224, 192),
    "sand":     (200, 184, 152),
    "ocre":     (176, 120,  64),
    "ocre_dk":  (138,  90,  42),
    "shadow":   (110,  72,  36),
    "ink":      ( 34,  29,  24),
    "accent":   (200,  84,  56),
}

COS30 = math.cos(math.radians(30))
SIN30 = 0.5

def iso(x, y, z, sxy, sz, cx, cy):
    return (cx + (x - y) * COS30 * sxy,
            cy + (x + y) * SIN30 * sxy - z * sz)

# ---------------------------------------------------------- data loading
def load(seccion: str):
    f = BUILDINGS / f"{seccion}.json"
    raw = json.load(open(f, encoding="utf-8"))
    xs = [p[0] for b in raw for p in b[0]]
    ys = [p[1] for b in raw for p in b[0]]
    lng0, lat0 = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    cos_lat0 = math.cos(math.radians(lat0))
    def to_m(lng, lat):
        return ((lng - lng0) * 111320 * cos_lat0,
               -(lat - lat0) * 111320)

    polys, heights = [], []
    for b in raw:
        ring = [to_m(*p) for p in b[0]]
        if ring[0] != ring[-1]: ring.append(ring[0])
        h = float(b[1]) if len(b) >= 2 and b[1] else 6.0
        if h < 1.5: h = 6.0
        try:
            p = Polygon(ring)
            if p.is_valid and p.area > 1.0:
                polys.append(p); heights.append(h)
        except Exception:
            pass
    return polys, heights

# ---------------------------------------------------- manzana extraction
def extract_manzanas(polys: List[Polygon], heights: List[float],
                     buffer_m: float = 3.5):
    """Buffer + disolver + buffer-in para fusionar edificios próximos."""
    expanded = [p.buffer(buffer_m, join_style=2) for p in polys]
    merged = unary_union(expanded)
    if isinstance(merged, Polygon):
        merged_polys = [merged]
    else:
        merged_polys = list(merged.geoms)
    # contraer otra vez para acercarse a la silueta real
    manzanas = []
    for m in merged_polys:
        s = m.buffer(-buffer_m * 0.9, join_style=2)
        if s.is_empty: continue
        if isinstance(s, Polygon):
            manzanas.append(s)
        else:
            manzanas.extend(list(s.geoms))
    # asociar cada edificio con la manzana que lo contiene → altura mediana
    centroids = [p.centroid for p in polys]
    out = []
    for mz in manzanas:
        inside = [heights[i] for i, c in enumerate(centroids) if mz.contains(c)]
        if not inside:
            inside = [heights[i] for i, c in enumerate(centroids)
                      if mz.intersects(polys[i])]
        if not inside: continue
        h = sorted(inside)[len(inside)//2]              # mediana
        out.append((mz, h, len(inside)))
    return out                                          # [(polygon, height, n_buildings)]

# ---------------------------------------------------- iso renderer (mono)
def render_prism(d: ImageDraw.ImageDraw, ring, h: float,
                 sxy: float, sz: float, cx: float, cy: float,
                 top=P["sand_lt"], left=P["sand"], right=P["ocre"],
                 ink=P["ink"], stroke=2):
    """Render an extruded iso prism for a (closed) ring of (x_m, y_m) coords."""
    if len(ring) >= 2 and ring[0] == ring[-1]:
        ring = ring[:-1]
    n = len(ring)
    if n < 3: return
    bot = [iso(x, y, 0, sxy, sz, cx, cy) for x, y in ring]
    top_pts = [iso(x, y, h, sxy, sz, cx, cy) for x, y in ring]
    # walls — only outward-facing (south or east) faces are visible to the camera
    for k in range(n):
        ax, ay = ring[k]
        bx, by = ring[(k + 1) % n]
        nx, ny = (by - ay), -(bx - ax)
        if nx + ny <= 0:                                # back-facing → skip
            continue
        # east-facing → "right" (lighter ocre); south-facing → "left" (sand mid)
        tilt = nx / (abs(nx) + abs(ny) + 1e-6)          # 1=east, -1=south
        if tilt > 0:
            face = right
        else:
            face = left
        d.polygon([bot[k], bot[(k+1) % n], top_pts[(k+1) % n], top_pts[k]],
                  fill=face, outline=ink)
    # top
    d.polygon(top_pts, fill=top, outline=ink)

def fit_scale(bx0, bx1, by0, by1, hmax, panel_w, panel_h, margin=70):
    bw, bh = bx1 - bx0, by1 - by0
    span_iso_w = (bw + bh) * COS30
    span_iso_h = (bw + bh) * SIN30 + hmax * 1.6
    sxy = min((panel_w - 2*margin) / span_iso_w,
              (panel_h - 2*margin) / span_iso_h)
    sz = sxy * 1.6
    mx, my = (bx0 + bx1) / 2, (by0 + by1) / 2
    cx = panel_w / 2 - (mx - my) * COS30 * sxy
    cy = panel_h / 2 + 70 - (mx + my) * SIN30 * sxy
    return sxy, sz, cx, cy

def panel(title: str, subtitle: str, w: int, h: int) -> Tuple[Image.Image, ImageDraw.ImageDraw, ImageFont.FreeTypeFont]:
    img = Image.new("RGBA", (w, h), P["paper"] + (255,))
    d = ImageDraw.Draw(img)
    try:
        f_t = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf", 28)
        f_s = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf", 17)
    except Exception:
        f_t = f_s = ImageFont.load_default()
    d.rectangle((0, 0, w, 60), fill=P["ink"] + (255,))
    d.text((24, 16), title, fill=P["paper"], font=f_t)
    d.text((24, h - 30), subtitle, fill=P["ocre_dk"], font=f_s)
    return img, d, f_s

def ground_tile(d, bx0, bx1, by0, by1, sxy, sz, cx, cy, pad=12):
    pts = [
        iso(bx0 - pad, by0 - pad, 0, sxy, sz, cx, cy),
        iso(bx1 + pad, by0 - pad, 0, sxy, sz, cx, cy),
        iso(bx1 + pad, by1 + pad, 0, sxy, sz, cx, cy),
        iso(bx0 - pad, by1 + pad, 0, sxy, sz, cx, cy),
    ]
    d.polygon(pts, fill=P["cream"], outline=P["ocre_dk"], width=2)
    # subtle grid every 50 m
    step = 50
    x = math.floor((bx0 - pad) / step) * step
    while x <= bx1 + pad:
        a = iso(x, by0 - pad, 0, sxy, sz, cx, cy)
        b = iso(x, by1 + pad, 0, sxy, sz, cx, cy)
        d.line([a, b], fill=P["sand"], width=1)
        x += step
    y = math.floor((by0 - pad) / step) * step
    while y <= by1 + pad:
        a = iso(bx0 - pad, y, 0, sxy, sz, cx, cy)
        b = iso(bx1 + pad, y, 0, sxy, sz, cx, cy)
        d.line([a, b], fill=P["sand"], width=1)
        y += step

# ---------------------------------------------------- main
def render_section(seccion: str, buffer_m: float = 3.5):
    polys, heights = load(seccion)
    print(f"[{seccion}] {len(polys)} edificios")
    manzanas = extract_manzanas(polys, heights, buffer_m=buffer_m)
    print(f"[{seccion}] {len(manzanas)} manzanas (buffer {buffer_m}m)")

    # bbox común a los tres LODs
    all_x = [pt[0] for p in polys for pt in p.exterior.coords]
    all_y = [pt[1] for p in polys for pt in p.exterior.coords]
    bx0, bx1 = min(all_x), max(all_x)
    by0, by1 = min(all_y), max(all_y)
    h_max = max(heights)
    h_med = sorted(heights)[len(heights)//2]

    panel_w, panel_h = 1300, 1100
    sxy, sz, cx, cy = fit_scale(bx0, bx1, by0, by1, h_max, panel_w, panel_h)

    # ----- LOD-0: una caja para toda la sección, altura = mediana
    p0, d0, f0 = panel("LOD-0 · sección como volumen único",
                       f"sección {seccion}  ·  altura mediana {h_med:.1f} m",
                       panel_w, panel_h)
    ground_tile(d0, bx0, bx1, by0, by1, sxy, sz, cx, cy)
    section_ring = [(bx0, by0), (bx1, by0), (bx1, by1), (bx0, by1), (bx0, by0)]
    render_prism(d0, section_ring, h_med, sxy, sz, cx, cy,
                 top=P["sand_lt"], left=P["sand"], right=P["ocre"], stroke=3)

    # ----- LOD-1: manzanas
    p1, d1, f1 = panel("LOD-1 · manzanas",
                       f"{len(manzanas)} manzanas  ·  buffer {buffer_m}m  ·  monocromo",
                       panel_w, panel_h)
    ground_tile(d1, bx0, bx1, by0, by1, sxy, sz, cx, cy)
    # painter order: deepest first (smallest x+y of polygon bounds)
    sorted_mz = sorted(manzanas, key=lambda t: t[0].bounds[0] + t[0].bounds[1])
    for mz_poly, mz_h, n_b in sorted_mz:
        ext = list(mz_poly.exterior.coords)
        render_prism(d1, ext, mz_h, sxy, sz, cx, cy,
                     top=P["sand_lt"], left=P["sand"], right=P["ocre"])
        # building-count tag at centroid (top face)
        c = mz_poly.centroid
        cx_p, cy_p = iso(c.x, c.y, mz_h, sxy, sz, cx, cy)
        d1.text((cx_p - 12, cy_p - 12), f"×{n_b}",
                fill=P["ink"], font=f1)

    # ----- LOD-2: edificios
    p2, d2, f2 = panel("LOD-2 · edificios (vista jugable)",
                       f"{len(polys)} edificios  ·  paleta KOINOS  ·  sin color satélite",
                       panel_w, panel_h)
    ground_tile(d2, bx0, bx1, by0, by1, sxy, sz, cx, cy)
    sorted_b = sorted(zip(polys, heights),
                      key=lambda t: t[0].bounds[0] + t[0].bounds[1])
    for poly, h in sorted_b:
        ext = list(poly.exterior.coords)
        render_prism(d2, ext, h, sxy, sz, cx, cy)

    # banner + composite
    total_w = panel_w * 3
    total_h = panel_h + 80
    out = Image.new("RGBA", (total_w, total_h), P["paper"] + (255,))
    bd = ImageDraw.Draw(out)
    bd.rectangle((0, 0, total_w, 80), fill=P["cream"] + (255,))
    try:
        f_b = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf", 38)
        f_b2 = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf", 22)
    except Exception:
        f_b = f_b2 = ImageFont.load_default()
    bd.text((28, 14),
            f"KOINOS · POLIS — niveles de detalle · sección {seccion}",
            fill=P["ink"], font=f_b)
    bd.text((28, 56),
            "Misma sección · tres representaciones · "
            "el ruido baja al subir el LOD; los edificios se reservan para la vista jugable",
            fill=P["ocre_dk"], font=f_b2)
    out.paste(p0, (0, 80))
    out.paste(p1, (panel_w, 80))
    out.paste(p2, (panel_w * 2, 80))
    path = OUT / f"{seccion}_lods.png"
    out.convert("RGB").save(path, "PNG", optimize=True)
    return path


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("seccion", nargs="?", default="3501602010")
    ap.add_argument("--buffer", type=float, default=3.5,
                    help="metros de fusión entre edificios cercanos")
    args = ap.parse_args()
    print("→", render_section(args.seccion, args.buffer))
