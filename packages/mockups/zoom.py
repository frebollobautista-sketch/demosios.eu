"""KOINOS · POLIS — Render de close-up isométrico de N manzanas contiguas.

Lee un data pack ya generado (carpeta `public/sections_pack/<cusec>/`) y
produce UN PNG en `design/secciones/<cusec>_zoom<N>manzanas.png` con un
zoom sobre N manzanas contiguas representativas, en el mismo estilo que
el preview general pero con detalle suficiente para evaluar resolución
(grid 10 m, IDs de portal sobre los techos, escala efectiva, etc.).

Uso:
    python3 -m packages.mockups.zoom 3501602052
    python3 -m packages.mockups.zoom 3501602052 --n-manzanas 4 --out path.png

Heurística de selección de manzanas igual que la versión legacy de
``scripts/iso_zoom.py``.
"""
from __future__ import annotations

import argparse
import json
import math
import pathlib
from datetime import datetime
from itertools import combinations
from typing import Dict, List, Optional, Tuple

from PIL import Image, ImageDraw, ImageFont
from shapely.geometry import (
    LineString, MultiLineString, MultiPolygon, Point, Polygon, box, shape,
)

# ----------------------------------------------------------------- paths
ROOT = pathlib.Path(__file__).resolve().parents[2]
DEFAULT_PACK = ROOT / "public" / "sections_pack"
DEFAULT_OUT_DIR = ROOT / "design" / "secciones"

# ----------------------------------------------------------------- palette
PALETTE = {
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

ROAD_TYPE_WIDTH = {
    "primary": 12, "secondary": 9, "tertiary": 7,
    "residential": 5, "service": 3.5, "pedestrian": 4,
    "footway": 2, "track": 3,
}
ROAD_TYPE_STYLE = {
    "primary":     ("shadow",  6),
    "secondary":   ("ocre_dk", 5),
    "tertiary":    ("ocre",    4),
    "residential": ("sand",    3),
    "service":     ("sand_lt", 2),
    "pedestrian":  ("sand_lt", 2),
    "footway":     ("sand_lt", 1),
    "track":       ("sand_lt", 1),
}
ROAD_TYPE_IMPORTANCE = {
    "primary": 6, "secondary": 5, "tertiary": 4,
    "residential": 3, "pedestrian": 2, "service": 2,
    "footway": 1, "track": 1,
}

COS30 = math.cos(math.radians(30))
SIN30 = 0.5

# ----------------------------------------------------------------- helpers

def hex2rgb(h: str) -> Tuple[int, int, int]:
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def shade(rgb, k):
    return tuple(max(0, min(255, int(c * k))) for c in rgb)


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
    candidates_mono = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
        "/System/Library/Fonts/Supplemental/Andale Mono.ttf",
        "/System/Library/Fonts/Menlo.ttc",
    ]

    def _try(cands, size):
        for c in cands:
            try:
                return ImageFont.truetype(c, size)
            except Exception:
                continue
        return ImageFont.load_default()

    return {
        "title":   _try(candidates_b, 28),
        "subtit":  _try(candidates_r, 16),
        "small":   _try(candidates_r, 14),
        "portal":  _try(candidates_mono, 10),
    }


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
        ax, az = ring_xz[k]
        bx, bz = ring_xz[(k + 1) % n]
        nx_, nz_ = (bz - az), -(bx - ax)
        if nx_ + nz_ <= 0:
            continue
        tilt = nx_ / (abs(nx_) + abs(nz_) + 1e-6)
        face = right if tilt > 0 else left
        d.polygon([bot[k], bot[(k + 1) % n], top_pts[(k + 1) % n], top_pts[k]],
                  fill=face, outline=ink, width=stroke)
    d.polygon(top_pts, fill=top, outline=ink, width=stroke)


def grid_step(d, polygon_xz: Polygon, sxy, sz, cx, cy, color, step=10.0):
    bx0, by0, bx1, by1 = polygon_xz.bounds
    x = math.floor(bx0 / step) * step
    while x <= bx1:
        line = LineString([(x, by0 - 2), (x, by1 + 2)])
        clipped = line.intersection(polygon_xz)
        if not clipped.is_empty:
            geoms = ([clipped] if clipped.geom_type == "LineString"
                     else list(clipped.geoms))
            for g in geoms:
                if g.geom_type != "LineString":
                    continue
                pts = [iso(px, 0, py, sxy, sz, cx, cy) for px, py in g.coords]
                if len(pts) >= 2:
                    d.line(pts, fill=color, width=1)
        x += step
    z = math.floor(by0 / step) * step
    while z <= by1:
        line = LineString([(bx0 - 2, z), (bx1 + 2, z)])
        clipped = line.intersection(polygon_xz)
        if not clipped.is_empty:
            geoms = ([clipped] if clipped.geom_type == "LineString"
                     else list(clipped.geoms))
            for g in geoms:
                if g.geom_type != "LineString":
                    continue
                pts = [iso(px, 0, py, sxy, sz, cx, cy) for px, py in g.coords]
                if len(pts) >= 2:
                    d.line(pts, fill=color, width=1)
        z += step


# ----------------------------------------------------------------- selection

def pick_cluster(manzanas: List[Dict], n: int = 4) -> List[Dict]:
    if len(manzanas) < n:
        raise ValueError(f"sólo hay {len(manzanas)} manzanas (<{n})")

    by_count = sorted(manzanas, key=lambda m: -m["nb"])
    top = by_count[0]
    others = sorted(
        [m for m in manzanas if m["id"] != top["id"]],
        key=lambda m: math.hypot(m["cx"] - top["cx"], m["cy"] - top["cy"]),
    )
    cluster_h1 = [top] + others[:n - 1]
    max_gap_h1 = 0.0
    for a, b in combinations(cluster_h1, 2):
        gap = a["g"].distance(b["g"])
        if gap > max_gap_h1:
            max_gap_h1 = gap
    if max_gap_h1 <= 40.0:
        return cluster_h1

    pool = by_count[:20]

    def connected(combo, max_gap=40.0) -> bool:
        k = len(combo)
        if k <= 1:
            return True
        adj = {i: set() for i in range(k)}
        for i, j in combinations(range(k), 2):
            if combo[i]["g"].distance(combo[j]["g"]) <= max_gap:
                adj[i].add(j)
                adj[j].add(i)
        seen = {0}
        stack = [0]
        while stack:
            u = stack.pop()
            for v in adj[u]:
                if v not in seen:
                    seen.add(v)
                    stack.append(v)
        return len(seen) == k

    best = None
    for combo in combinations(pool, n):
        if not connected(list(combo)):
            continue
        s = sum(m["nb"] for m in combo)
        if best is None or s > best[0]:
            best = (s, list(combo))

    if best is None:
        return cluster_h1
    return best[1]


# ----------------------------------------------------------------- main render

def render_zoom(cusec: str, n_manzanas: int, pack_dir: pathlib.Path,
                out_path: pathlib.Path) -> Dict:
    meta = json.load(open(pack_dir / "meta.json", encoding="utf-8"))
    categories = meta["categories"]
    section_gj = json.load(open(pack_dir / "section.geojson", encoding="utf-8"))
    manzanas_gj = json.load(open(pack_dir / "manzanas.geojson", encoding="utf-8"))
    buildings_gj = json.load(open(pack_dir / "buildings.geojson", encoding="utf-8"))
    roads_gj = json.load(open(pack_dir / "roads.geojson", encoding="utf-8"))
    pois_gj = json.load(open(pack_dir / "pois.geojson", encoding="utf-8"))
    trees_gj = json.load(open(pack_dir / "trees.geojson", encoding="utf-8"))

    manzanas: List[Dict] = []
    for f in manzanas_gj["features"]:
        g = shape(f["geometry"])
        c = g.centroid
        manzanas.append({
            "id": f["properties"]["id"],
            "nb": f["properties"]["building_count"],
            "area": f["properties"]["area_m2"],
            "cx": c.x, "cy": c.y,
            "g": g,
        })

    cluster = pick_cluster(manzanas, n_manzanas)
    cluster_ids = sorted(m["id"] for m in cluster)
    cluster_polys = [m["g"] for m in cluster]
    cluster_union = cluster_polys[0]
    for p in cluster_polys[1:]:
        cluster_union = cluster_union.union(p)

    pad = 20.0
    minx, miny, maxx, maxy = cluster_union.bounds
    bbox_xz = box(minx - pad, miny - pad, maxx + pad, maxy + pad)
    bx0, by0, bx1, by1 = bbox_xz.bounds
    cluster_area = sum(m["g"].area for m in cluster)

    bldg_in: List[Dict] = []
    for f in buildings_gj["features"]:
        ring = f["geometry"]["coordinates"][0]
        try:
            poly = Polygon(ring)
        except Exception:
            continue
        if not poly.is_valid or poly.is_empty:
            continue
        if not poly.intersects(bbox_xz):
            continue
        c = poly.centroid
        if not bbox_xz.contains(c):
            continue
        bldg_in.append({
            "id": f["properties"]["id"],
            "ring": [(p[0], p[1]) for p in ring],
            "h": float(f["properties"].get("height_m") or 6.0),
            "category": f["properties"].get("category", "residencial"),
            "centroid": (c.x, c.y),
            "bounds": poly.bounds,
        })

    roads_in: List[Tuple[str, list, Optional[str]]] = []
    for f in roads_gj["features"]:
        coords = f["geometry"]["coordinates"]
        line = LineString(coords)
        if not line.intersects(bbox_xz):
            continue
        clipped = line.intersection(bbox_xz)
        if clipped.is_empty:
            continue
        rtype = f["properties"].get("type", "service")
        name = f["properties"].get("name")
        if isinstance(clipped, LineString):
            roads_in.append((rtype, list(clipped.coords), name))
        elif isinstance(clipped, MultiLineString):
            for g in clipped.geoms:
                roads_in.append((rtype, list(g.coords), name))

    pois_in: List[Tuple[Tuple[float, float], str]] = []
    for f in pois_gj["features"]:
        c = f["geometry"]["coordinates"]
        if not bbox_xz.contains(Point(c[0], c[1])):
            continue
        pois_in.append(((c[0], c[1]), f["properties"].get("category", "comercio")))

    trees_in: List[Tuple[float, float]] = []
    for f in trees_gj["features"]:
        c = f["geometry"]["coordinates"]
        if not bbox_xz.contains(Point(c[0], c[1])):
            continue
        trees_in.append((c[0], c[1]))

    CANVAS_W = 1400
    CANVAS_H = 1400
    BANNER_H = 80
    h_max = max([b["h"] for b in bldg_in] + [12.0])
    bw = bx1 - bx0
    bh = by1 - by0
    span_w = (bw + bh) * COS30
    span_h = (bw + bh) * SIN30 + h_max * 1.6
    margin = 80
    sxy = min((CANVAS_W - 2 * margin) / span_w,
              (CANVAS_H - 2 * margin - 70) / span_h)
    sz = sxy * 1.6
    mx = (bx0 + bx1) / 2
    my = (by0 + by1) / 2
    cx_canvas = CANVAS_W / 2 - (mx - my) * COS30 * sxy
    cy_canvas = CANVAS_H / 2 + 20 - (mx + my) * SIN30 * sxy

    m_per_px = 1.0 / (COS30 * sxy)

    P = PALETTE
    img = Image.new("RGBA", (CANVAS_W, CANVAS_H + BANNER_H), P["paper"] + (255,))
    d = ImageDraw.Draw(img)

    d.rectangle((0, 0, CANVAS_W, CANVAS_H), fill=P["cream"] + (255,))

    grid_step(d, bbox_xz, sxy, sz, cx_canvas, cy_canvas, P["sand"], step=10.0)

    bbox_ring = list(bbox_xz.exterior.coords)
    bbox_pts = [iso(x, 0, z, sxy, sz, cx_canvas, cy_canvas) for x, z in bbox_ring]
    d.line(bbox_pts, fill=P["ocre_dk"], width=2)

    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    ocre_alpha = P["ocre"] + (90,)
    for m in cluster:
        ring = list(m["g"].exterior.coords)
        pts = [iso(x, 0, z, sxy, sz, cx_canvas, cy_canvas) for x, z in ring]
        if len(pts) >= 3:
            od.polygon(pts, fill=ocre_alpha, outline=P["ocre_dk"] + (220,))
    img = Image.alpha_composite(img, overlay)
    d = ImageDraw.Draw(img)
    for m in cluster:
        ring = list(m["g"].exterior.coords)
        pts = [iso(x, 0, z, sxy, sz, cx_canvas, cy_canvas) for x, z in ring]
        if len(pts) >= 3:
            d.line(pts + [pts[0]], fill=P["ocre_dk"], width=4)

    sorted_roads = sorted(roads_in,
                          key=lambda r: ROAD_TYPE_IMPORTANCE.get(r[0], 0))
    for rtype, coords, name in sorted_roads:
        col_key, w = ROAD_TYPE_STYLE.get(rtype, ("sand_lt", 1))
        col = P[col_key]
        pts = [iso(x, 0, z, sxy, sz, cx_canvas, cy_canvas) for x, z in coords]
        if len(pts) >= 2:
            d.line(pts, fill=col, width=w)

    f_set = fonts()
    seen_names = set()
    for rtype, coords, name in sorted_roads:
        if not name or rtype in ("footway", "track"):
            continue
        if name in seen_names:
            continue
        if len(coords) < 2:
            continue
        mid_idx = len(coords) // 2
        x, z = coords[mid_idx]
        if not bbox_xz.contains(Point(x, z)):
            continue
        px, py = iso(x, 0.05, z, sxy, sz, cx_canvas, cy_canvas)
        d.text((px + 4, py - 14), str(name)[:24],
               fill=P["ink"], font=f_set["small"])
        seen_names.add(name)

    order = sorted(range(len(bldg_in)),
                   key=lambda i: bldg_in[i]["bounds"][0]
                   + bldg_in[i]["bounds"][1])
    for i in order:
        b = bldg_in[i]
        cat = b["category"]
        col_hex = categories.get(cat, {}).get("color", "#C8B898")
        base = hex2rgb(col_hex)
        top = base
        left = shade(base, 0.78)
        right = shade(base, 0.92)
        render_prism(d, b["ring"], b["h"], sxy, sz, cx_canvas, cy_canvas,
                     top=top, left=left, right=right, ink=P["ink"], stroke=1)

    for b in bldg_in:
        cx_, cz_ = b["centroid"]
        px, py = iso(cx_, b["h"], cz_, sxy, sz, cx_canvas, cy_canvas)
        txt = str(b["id"])
        w_est = len(txt) * 6
        d.rectangle((px - w_est / 2 - 2, py - 7,
                     px + w_est / 2 + 2, py + 6),
                    fill=P["paper"] + (180,))
        d.text((px - w_est / 2, py - 6), txt,
               fill=P["ink"], font=f_set["portal"])

    tree_col = hex2rgb(categories["arbol"]["color"])
    for tx, tz in trees_in:
        base_pt = iso(tx, 0, tz, sxy, sz, cx_canvas, cy_canvas)
        top_pt = iso(tx, 6.0, tz, sxy, sz, cx_canvas, cy_canvas)
        r = max(3, int(2.0 * sxy))
        d.ellipse((base_pt[0] - r * 0.4, base_pt[1] - r * 0.2,
                   base_pt[0] + r * 0.4, base_pt[1] + r * 0.2),
                  fill=shade(tree_col, 0.6), outline=P["ink"])
        d.polygon([(base_pt[0] - r, base_pt[1]),
                   (base_pt[0] + r, base_pt[1]),
                   (top_pt[0], top_pt[1])],
                  fill=tree_col, outline=P["ink"])

    for (px_, pz_), cat in pois_in:
        col_hex = categories.get(cat, {}).get("color", "#888888")
        col = hex2rgb(col_hex)
        pt = iso(px_, 0.05, pz_, sxy, sz, cx_canvas, cy_canvas)
        d.ellipse((pt[0] - 4, pt[1] - 4, pt[0] + 4, pt[1] + 4),
                  fill=col, outline=P["ink"], width=1)

    scale_m = 25.0
    bar_px = scale_m / m_per_px
    sx0, sy0 = 28, CANVAS_H - 36
    d.rectangle((sx0, sy0, sx0 + bar_px, sy0 + 6),
                fill=P["ink"], outline=P["ink"])
    d.text((sx0, sy0 - 18), f"25 m  ({m_per_px:.2f} m/px)",
           fill=P["ink"], font=f_set["small"])

    legend_items = [
        ("residencial", "residencial"),
        ("publico", "público"),
        ("restauracion", "restauración"),
        ("comercio", "comercio"),
        ("alojamiento", "alojamiento"),
        ("salud", "salud"),
        ("finanzas", "finanzas"),
        ("monumento", "monumento"),
        ("arbol", "árbol"),
    ]
    line_h = 18
    block_h = line_h * len(legend_items) + 12
    block_w = 170
    lx0 = CANVAS_W - block_w - 18
    ly0 = CANVAS_H - block_h - 14
    d.rectangle((lx0, ly0, lx0 + block_w, ly0 + block_h),
                fill=P["paper"] + (235,), outline=P["ocre_dk"], width=1)
    yy = ly0 + 8
    for cat, label in legend_items:
        col = hex2rgb(categories.get(cat, {}).get("color", "#888888"))
        d.rectangle((lx0 + 8, yy + 2, lx0 + 22, yy + 14),
                    fill=col, outline=P["ink"])
        d.text((lx0 + 28, yy + 1), label, fill=P["ink"], font=f_set["small"])
        yy += line_h

    d.rectangle((0, CANVAS_H, CANVAS_W, CANVAS_H + BANNER_H),
                fill=P["ink"] + (255,))
    title = (f"KOINOS · POLIS — zoom {n_manzanas} manzanas · "
             f"sección {cusec}")
    d.text((22, CANVAS_H + 10), title,
           fill=P["paper"], font=f_set["title"])
    sub_ids = ", ".join(str(i) for i in cluster_ids)
    sub = (f"manzanas {sub_ids}  ·  edificios visibles {len(bldg_in)}  ·  "
           f"área cluster {cluster_area:.0f} m²  ·  "
           f"escala {m_per_px:.2f} m/px  ·  "
           f"{datetime.now().strftime('%Y-%m-%d')}")
    d.text((22, CANVAS_H + 46), sub,
           fill=P["sand_lt"], font=f_set["subtit"])

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(out_path, "PNG", optimize=True)

    return {
        "out_path": out_path,
        "cluster_ids": cluster_ids,
        "n_buildings_visible": len(bldg_in),
        "cluster_area_m2": cluster_area,
        "m_per_px": m_per_px,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cusec", help="Código de sección censal (10 dígitos)")
    ap.add_argument("--n-manzanas", type=int, default=4,
                    help="Número de manzanas a incluir (default: 4)")
    ap.add_argument("--pack-dir", default=str(DEFAULT_PACK))
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    pack_root = pathlib.Path(args.pack_dir)
    if not pack_root.is_absolute():
        pack_root = ROOT / pack_root
    pack_dir = pack_root / args.cusec
    if not pack_dir.exists():
        raise SystemExit(f"data pack no encontrado: {pack_dir}")

    if args.out:
        out_path = pathlib.Path(args.out)
    else:
        out_path = (DEFAULT_OUT_DIR
                    / f"{args.cusec}_zoom{args.n_manzanas}manzanas.png")
    if not out_path.is_absolute():
        out_path = ROOT / out_path

    res = render_zoom(args.cusec, args.n_manzanas, pack_dir, out_path)
    print(f"OK → {res['out_path']}")
    print(f"  manzanas seleccionadas: {res['cluster_ids']}")
    print(f"  edificios visibles:      {res['n_buildings_visible']}")
    print(f"  área cluster:            {res['cluster_area_m2']:.0f} m²")
    print(f"  escala efectiva:         {res['m_per_px']:.3f} m/px")


if __name__ == "__main__":
    main()
