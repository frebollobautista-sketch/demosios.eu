"""KOINOS · POLIS — Mockup de smartphone con UNA manzana seleccionada y ficha.

Genera UN PNG (1170x2532, iPhone 14/15 Pro a 3x) que simula la app POLIS:
chrome de iOS (status bar + notch + home indicator), top bar con breadcrumb,
zona de mapa iso con un cluster de manzanas (la objetivo "levantada" y con
glow naranja, el resto atenuado), y un bottom sheet con la ficha de la
manzana: stats, tabs (Negocios activa) y CTA flotante.

Reutiliza la lógica de proyección iso, paleta y selección de cluster del
módulo `packages.mockups.zoom`.

Uso:
    python3 -m packages.mockups.mobile 3501602052 24
    python3 -m packages.mockups.mobile 3501602052 24 --out path.png
"""
from __future__ import annotations

import argparse
import json
import math
import pathlib
import sys
from typing import Dict, List, Optional, Tuple

from PIL import Image, ImageDraw, ImageFilter, ImageFont
from shapely.geometry import LineString, Point, Polygon, box, shape

ROOT = pathlib.Path(__file__).resolve().parents[2]

from packages.mockups.zoom import (  # noqa: E402
    COS30, SIN30, PALETTE, ROAD_TYPE_IMPORTANCE, ROAD_TYPE_STYLE,
    hex2rgb, iso, pick_cluster, render_prism, shade,
)

DEFAULT_PACK = ROOT / "public" / "sections_pack"
DEFAULT_OUT_DIR = ROOT / "design" / "secciones"

W, H = 1170, 2532
SCALE = 3

STATUS_BAR_H = 132
TOP_BAR_H = 168
HOME_INDICATOR_H = 102
USABLE_H = H - STATUS_BAR_H - TOP_BAR_H - HOME_INDICATOR_H
MAP_H = int(USABLE_H * 0.50)
SHEET_H = USABLE_H - MAP_H + HOME_INDICATOR_H

P = dict(PALETTE)
P["paper_dim"] = tuple(int(c * 0.94) for c in P["paper"])
P["sheet_bg"] = P["paper"]
P["chip_bg"] = P["sand_lt"]
P["divider"] = (210, 200, 178)
P["muted"] = (118, 108, 90)
P["btn_dark_ocre"] = hex2rgb("#8A5A2A")
P["accent_glow"] = (200, 84, 56)


def fonts(scale: int = SCALE):
    serif_b = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
        "/System/Library/Fonts/Supplemental/Georgia Bold.ttf",
    ]
    serif_r = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
        "/System/Library/Fonts/Supplemental/Georgia.ttf",
    ]
    sans_b = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    ]
    sans_r = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
    ]

    def _try(cands, size):
        for c in cands:
            try:
                return ImageFont.truetype(c, size)
            except Exception:
                continue
        return ImageFont.load_default()

    s = scale
    return {
        "status":     _try(sans_b, 17 * s),
        "crumb":      _try(sans_r, 11 * s),
        "crumb_b":    _try(sans_b, 11 * s),
        "title":      _try(serif_b, 26 * s),
        "subtitle":   _try(sans_r, 13 * s),
        "stat_num":   _try(serif_b, 18 * s),
        "stat_lbl":   _try(sans_r, 9 * s),
        "tab":        _try(sans_b, 12 * s),
        "tab_off":    _try(sans_r, 12 * s),
        "row_title":  _try(sans_b, 13 * s),
        "row_sub":    _try(sans_r, 11 * s),
        "cta":        _try(sans_b, 13 * s),
        "small":      _try(sans_r, 9 * s),
        "map_lbl":    _try(sans_b, 10 * s),
    }


def round_rect(d: ImageDraw.ImageDraw, box_, radius: int, fill=None,
               outline=None, width=1):
    d.rounded_rectangle(box_, radius=radius, fill=fill, outline=outline,
                        width=width)


def text_w(d: ImageDraw.ImageDraw, txt: str, font) -> int:
    bb = d.textbbox((0, 0), txt, font=font)
    return bb[2] - bb[0]


def draw_status_bar(img: Image.Image, top_y: int, ink, paper):
    d = ImageDraw.Draw(img)
    d.rectangle((0, top_y, W, top_y + STATUS_BAR_H), fill=paper)
    f = fonts()
    cy = top_y + STATUS_BAR_H // 2
    d.text((54, cy - 22), "09:41", fill=ink, font=f["status"])

    notch_w = 360
    notch_h = 90
    nx0 = (W - notch_w) // 2
    ny0 = top_y + 6
    round_rect(d, (nx0, ny0, nx0 + notch_w, ny0 + notch_h), radius=45,
               fill=(15, 12, 10))

    rx = W - 60
    bw, bh = 78, 30
    bx1 = rx
    bx0 = bx1 - bw
    by0 = cy - bh // 2
    round_rect(d, (bx0, by0, bx1, by0 + bh), radius=8, outline=ink, width=3)
    d.rectangle((bx1 + 2, by0 + 8, bx1 + 8, by0 + bh - 8), fill=ink)
    pad_in = 4
    fill_w = int((bw - 2 * pad_in) * 0.85)
    round_rect(d, (bx0 + pad_in, by0 + pad_in,
                   bx0 + pad_in + fill_w, by0 + bh - pad_in),
               radius=4, fill=ink)

    wf_x = bx0 - 48
    wf_y = cy
    for i, r in enumerate([22, 14, 6]):
        d.arc((wf_x - r, wf_y - r - 4, wf_x + r, wf_y + r - 4),
              start=215, end=325, fill=ink, width=4)
    d.ellipse((wf_x - 5, wf_y + 1, wf_x + 5, wf_y + 11), fill=ink)

    sg_x = wf_x - 78
    for i in range(4):
        h = 8 + i * 6
        x0 = sg_x + i * 9
        d.rectangle((x0, cy + 14 - h, x0 + 6, cy + 14), fill=ink)


def draw_home_indicator(img: Image.Image, bottom_y: int, ink):
    d = ImageDraw.Draw(img)
    bar_w = 402
    bar_h = 15
    bx0 = (W - bar_w) // 2
    by0 = bottom_y - HOME_INDICATOR_H + (HOME_INDICATOR_H - bar_h) // 2 - 8
    round_rect(d, (bx0, by0, bx0 + bar_w, by0 + bar_h), radius=8, fill=ink)


def draw_top_bar(img: Image.Image, y0: int, ink, paper, ocre):
    d = ImageDraw.Draw(img)
    d.rectangle((0, y0, W, y0 + TOP_BAR_H), fill=paper)
    d.rectangle((0, y0 + TOP_BAR_H - 2, W, y0 + TOP_BAR_H), fill=P["divider"])

    f = fonts()
    cy = y0 + TOP_BAR_H // 2

    bx = 60
    d.line([(bx + 22, cy - 22), (bx, cy), (bx + 22, cy + 22)],
           fill=ink, width=6)

    sx = W - 80
    for i, dy in enumerate([-26, 0, 26]):
        d.ellipse((sx - 7, cy + dy - 7, sx + 7, cy + dy + 7), fill=ink)

    line1 = "Las Palmas  >  Las Canteras  >  Sec 052"
    line2 = "Manzana 24"
    w1 = text_w(d, line1, f["crumb"])
    d.text(((W - w1) // 2, cy - 38), line1,
           fill=P["muted"], font=f["crumb"])
    w2 = text_w(d, line2, f["crumb_b"])
    d.text(((W - w2) // 2, cy + 6), line2, fill=ocre, font=f["crumb_b"])


def render_map_panel(img: Image.Image, y0: int, height: int,
                     pack_dir: pathlib.Path, target_id: int,
                     categories: Dict, ink) -> Dict:
    d = ImageDraw.Draw(img)
    d.rectangle((0, y0, W, y0 + height), fill=P["cream"])

    manzanas_gj = json.load(open(pack_dir / "manzanas.geojson",
                                 encoding="utf-8"))
    buildings_gj = json.load(open(pack_dir / "buildings.geojson",
                                  encoding="utf-8"))
    roads_gj = json.load(open(pack_dir / "roads.geojson", encoding="utf-8"))

    manz: Dict[int, Polygon] = {}
    manz_meta: List[Dict] = []
    for f in manzanas_gj["features"]:
        g = shape(f["geometry"])
        c = g.centroid
        manz[f["properties"]["id"]] = g
        manz_meta.append({
            "id": f["properties"]["id"],
            "nb": f["properties"]["building_count"],
            "area": f["properties"]["area_m2"],
            "cx": c.x, "cy": c.y, "g": g,
        })

    if target_id not in manz:
        raise SystemExit(f"manzana {target_id} no existe")

    target = next(m for m in manz_meta if m["id"] == target_id)
    others = sorted(
        [m for m in manz_meta if m["id"] != target_id],
        key=lambda m: math.hypot(m["cx"] - target["cx"],
                                 m["cy"] - target["cy"]),
    )
    cluster_meta = [target]
    for o in others:
        if len(cluster_meta) >= 4:
            break
        if any(o["g"].distance(c["g"]) <= 40.0 for c in cluster_meta):
            cluster_meta.append(o)
    if len(cluster_meta) < 4:
        for o in others:
            if o["id"] in {c["id"] for c in cluster_meta}:
                continue
            cluster_meta.append(o)
            if len(cluster_meta) >= 4:
                break
    cluster_polys = [m["g"] for m in cluster_meta]
    union = cluster_polys[0]
    for p in cluster_polys[1:]:
        union = union.union(p)

    pad = 14.0
    minx, miny, maxx, maxy = union.bounds
    bbox_xz = box(minx - pad, miny - pad, maxx + pad, maxy + pad)
    bx0, by0_, bx1, by1_ = bbox_xz.bounds

    margin_x = 60
    margin_top = 40
    margin_bot = 40
    h_max = 14.0
    bw = bx1 - bx0
    bh = by1_ - by0_
    span_w = (bw + bh) * COS30
    span_h = (bw + bh) * SIN30 + h_max * 1.6
    avail_w = W - 2 * margin_x
    avail_h = height - margin_top - margin_bot
    sxy = min(avail_w / span_w, avail_h / span_h)
    sz = sxy * 1.6
    mx = (bx0 + bx1) / 2
    my = (by0_ + by1_) / 2
    cx_canvas = W / 2 - (mx - my) * COS30 * sxy
    cy_canvas = y0 + height / 2 - (mx + my) * SIN30 * sxy

    def IS(x_, y_, z_, lift=0.0):
        return iso(x_, y_ + lift, z_, sxy, sz, cx_canvas, cy_canvas)

    union_dilated = union.buffer(3.0)
    bldg_in: List[Dict] = []
    for f in buildings_gj["features"]:
        ring = f["geometry"]["coordinates"][0]
        try:
            poly = Polygon(ring)
        except Exception:
            continue
        if not poly.is_valid or poly.is_empty:
            continue
        if not poly.intersects(union_dilated):
            continue
        c = poly.centroid
        if not union_dilated.contains(c):
            continue
        bldg_in.append({
            "id": f["properties"]["id"],
            "ring": [(p[0], p[1]) for p in ring],
            "h": float(f["properties"].get("height_m") or 6.0),
            "category": f["properties"].get("category", "residencial"),
            "manzana_id": f["properties"].get("manzana_id"),
            "centroid": (c.x, c.y),
            "bounds": poly.bounds,
        })

    roads_in = []
    for f in roads_gj["features"]:
        coords = f["geometry"]["coordinates"]
        line = LineString(coords)
        if not line.intersects(bbox_xz):
            continue
        clipped = line.intersection(bbox_xz)
        if clipped.is_empty:
            continue
        rtype = f["properties"].get("type", "service")
        if hasattr(clipped, "coords"):
            roads_in.append((rtype, list(clipped.coords)))
        else:
            for g in getattr(clipped, "geoms", []):
                roads_in.append((rtype, list(g.coords)))

    glow_img = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow_img)
    target_ring = list(manz[target_id].exterior.coords)
    target_pts_floor = [IS(x_, 0, z_) for x_, z_ in target_ring]
    if len(target_pts_floor) >= 3:
        for w in [22, 16, 10, 6]:
            gd.line(target_pts_floor + [target_pts_floor[0]],
                    fill=P["accent_glow"] + (60,), width=w)
    glow_blur = glow_img.filter(ImageFilter.GaussianBlur(radius=8))
    img.alpha_composite(glow_blur)

    d = ImageDraw.Draw(img)

    manz_floor_overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    mfd = ImageDraw.Draw(manz_floor_overlay)
    for m in cluster_meta:
        ring = list(m["g"].exterior.coords)
        pts = [IS(x_, 0, z_) for x_, z_ in ring]
        if len(pts) < 3:
            continue
        if m["id"] == target_id:
            mfd.polygon(pts, fill=P["sand_lt"] + (255,),
                        outline=P["accent_glow"] + (255,))
        else:
            mfd.polygon(pts, fill=P["sand_lt"] + (160,),
                        outline=P["sand"] + (200,))
    img.alpha_composite(manz_floor_overlay)
    d = ImageDraw.Draw(img)

    sorted_roads = sorted(roads_in,
                          key=lambda r: ROAD_TYPE_IMPORTANCE.get(r[0], 0))
    for rtype, coords in sorted_roads:
        col_key, w = ROAD_TYPE_STYLE.get(rtype, ("sand_lt", 1))
        col = P[col_key]
        pts = [IS(x_, 0, z_) for x_, z_ in coords]
        if len(pts) >= 2:
            d.line(pts, fill=col, width=max(1, w - 1))

    LIFT_Y_M = 2.5
    order = sorted(range(len(bldg_in)),
                   key=lambda i: bldg_in[i]["bounds"][0]
                   + bldg_in[i]["bounds"][1])

    bldg_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    bd = ImageDraw.Draw(bldg_layer)

    for i in order:
        b = bldg_in[i]
        is_target = (b["manzana_id"] == target_id)
        cat = b["category"]
        col_hex = categories.get(cat, {}).get("color", "#C8B898")
        base = hex2rgb(col_hex)
        top_col = base
        left = shade(base, 0.78)
        right = shade(base, 0.92)
        lift = LIFT_Y_M if is_target else 0.0
        ink_for = ink

        ring_xz = b["ring"]
        if len(ring_xz) >= 2 and ring_xz[0] == ring_xz[-1]:
            ring_xz = ring_xz[:-1]
        n = len(ring_xz)
        if n < 3:
            continue
        bot = [IS(x_, 0 + lift, z_) for x_, z_ in ring_xz]
        top_pts = [IS(x_, b["h"] + lift, z_) for x_, z_ in ring_xz]

        alpha = 255 if is_target else 165
        for k in range(n):
            ax_, az_ = ring_xz[k]
            bx_, bz_ = ring_xz[(k + 1) % n]
            nx_, nz_ = (bz_ - az_), -(bx_ - ax_)
            if nx_ + nz_ <= 0:
                continue
            tilt = nx_ / (abs(nx_) + abs(nz_) + 1e-6)
            face = right if tilt > 0 else left
            bd.polygon([bot[k], bot[(k + 1) % n],
                        top_pts[(k + 1) % n], top_pts[k]],
                       fill=face + (alpha,),
                       outline=ink_for + (alpha,), width=2)
        bd.polygon(top_pts, fill=top_col + (alpha,),
                   outline=ink_for + (alpha,), width=2)
    img.alpha_composite(bldg_layer)
    d = ImageDraw.Draw(img)

    target_pts_lift = [IS(x_, LIFT_Y_M, z_) for x_, z_ in target_ring]
    d.line(target_pts_lift + [target_pts_lift[0]],
           fill=P["accent_glow"], width=4)

    xs = [p[0] for p in target_pts_floor]
    ys = [p[1] for p in target_pts_floor]
    hitbox = (min(xs), min(ys), max(xs), max(ys))

    f = fonts()
    label = "Manzana 24"
    cx_lbl, cz_lbl = manz[target_id].centroid.x, manz[target_id].centroid.y
    px_lbl, py_lbl = IS(cx_lbl, 18.0, cz_lbl)
    lw = text_w(d, label, f["map_lbl"])
    pad_lbl = 14
    round_rect(d, (px_lbl - lw // 2 - pad_lbl, py_lbl - 28,
                   px_lbl + lw // 2 + pad_lbl, py_lbl + 16),
               radius=14, fill=P["ink"], outline=P["accent_glow"], width=2)
    d.text((px_lbl - lw // 2, py_lbl - 18), label,
           fill=P["paper"], font=f["map_lbl"])
    d.line([(px_lbl, py_lbl + 16), (px_lbl, py_lbl + 28)],
           fill=P["accent_glow"], width=3)

    return {
        "hitbox": hitbox,
        "n_buildings_target": sum(
            1 for b in bldg_in if b["manzana_id"] == target_id),
    }


def filter_target_pois_and_trees(pack_dir: pathlib.Path, target_id: int,
                                  manz_poly: Polygon,
                                  near_radius_m: float = 25.0):
    pois_gj = json.load(open(pack_dir / "pois.geojson", encoding="utf-8"))
    trees_gj = json.load(open(pack_dir / "trees.geojson", encoding="utf-8"))

    inside_pois, near_pois = [], []
    for f in pois_gj["features"]:
        pt = shape(f["geometry"])
        if manz_poly.contains(pt):
            inside_pois.append((f, pt, 0.0))
        else:
            d = pt.distance(manz_poly)
            if d <= 300.0:
                near_pois.append((f, pt, d))
    near_pois.sort(key=lambda x: x[2])

    n_trees_inside = sum(1 for f in trees_gj["features"]
                         if manz_poly.contains(shape(f["geometry"])))
    return inside_pois, near_pois, n_trees_inside


def draw_bottom_sheet(img: Image.Image, y0: int, height: int,
                      target_id: int, pack_dir: pathlib.Path,
                      categories: Dict, n_buildings_target: int,
                      inside_pois, near_pois, n_trees_inside,
                      ink) -> Dict:
    d = ImageDraw.Draw(img)
    f = fonts()

    sheet_box = (0, y0, W, y0 + height)
    radius = 84
    sheet_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sheet_layer)
    shadow_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    shd = ImageDraw.Draw(shadow_layer)
    shd.rounded_rectangle((sheet_box[0] - 6, sheet_box[1] - 18,
                            sheet_box[2] + 6, sheet_box[3]),
                           radius=radius + 6, fill=(0, 0, 0, 70))
    shadow_blur = shadow_layer.filter(ImageFilter.GaussianBlur(radius=18))
    img.alpha_composite(shadow_blur)
    sd.rounded_rectangle(sheet_box, radius=radius, fill=P["sheet_bg"] + (255,))
    sd.rectangle((0, y0 + radius, W, y0 + height), fill=P["sheet_bg"] + (255,))
    img.alpha_composite(sheet_layer)
    d = ImageDraw.Draw(img)

    handle_w, handle_h = 132, 14
    hx0 = (W - handle_w) // 2
    hy0 = y0 + 30
    round_rect(d, (hx0, hy0, hx0 + handle_w, hy0 + handle_h),
               radius=7, fill=P["divider"])

    pad_x = 72
    cur_y = y0 + 90

    title = f"Manzana {target_id}"
    d.text((pad_x, cur_y), title, fill=ink, font=f["title"])
    cur_y += 100

    n_portales = int(round(n_buildings_target * 3.9))
    subtitle = (f"Las Canteras  ·  {n_buildings_target} edificios  ·  "
                f"{n_portales} portales registrables")
    d.text((pad_x, cur_y), subtitle, fill=P["muted"], font=f["subtitle"])
    cur_y += 70

    stat_items = [
        ("edif",     f"{n_buildings_target}",       "edificios",
         categories.get("residencial", {}).get("color", "#C8B898")),
        ("portales", f"{n_portales}",               "portales",
         "#8A5A2A"),
        ("negocios", f"{len(inside_pois)}",         "negocios POI",
         categories.get("comercio", {}).get("color", "#4F8AE6")),
        ("arboles",  f"{n_trees_inside}",           "árboles",
         categories.get("arbol", {}).get("color", "#5E8A3E")),
    ]
    chip_gap = 30
    chip_w = (W - 2 * pad_x - 3 * chip_gap) // 4
    chip_h = 220
    for i, (key, num, lbl, hexcol) in enumerate(stat_items):
        cx0 = pad_x + i * (chip_w + chip_gap)
        cy0 = cur_y
        round_rect(d, (cx0, cy0, cx0 + chip_w, cy0 + chip_h),
                   radius=36, fill=P["chip_bg"], outline=P["divider"], width=2)
        ic_col = hex2rgb(hexcol) if hexcol.startswith("#") else hexcol
        ic_cx = cx0 + chip_w // 2
        ic_cy = cy0 + 50
        if key == "edif":
            r = 26
            d.polygon([(ic_cx - r, ic_cy + r // 2),
                       (ic_cx, ic_cy - r),
                       (ic_cx + r, ic_cy + r // 2),
                       (ic_cx, ic_cy + r)],
                      fill=ic_col, outline=ink, width=2)
        elif key == "portales":
            r = 22
            d.rectangle((ic_cx - r, ic_cy - r * 1.2,
                         ic_cx + r, ic_cy + r),
                        fill=ic_col, outline=ink, width=2)
            d.ellipse((ic_cx + r // 2 - 4, ic_cy - 4,
                       ic_cx + r // 2 + 4, ic_cy + 4),
                      fill=ink)
        elif key == "negocios":
            r = 22
            d.polygon([(ic_cx - r, ic_cy + r),
                       (ic_cx - r * 0.8, ic_cy - r * 0.6),
                       (ic_cx + r * 0.8, ic_cy - r * 0.6),
                       (ic_cx + r, ic_cy + r)],
                      fill=ic_col, outline=ink, width=2)
            d.line([(ic_cx - r * 0.4, ic_cy - r * 0.6),
                    (ic_cx - r * 0.4, ic_cy - r * 1.0),
                    (ic_cx + r * 0.4, ic_cy - r * 1.0),
                    (ic_cx + r * 0.4, ic_cy - r * 0.6)],
                   fill=ink, width=3)
        elif key == "arboles":
            r = 26
            d.ellipse((ic_cx - r, ic_cy - r,
                       ic_cx + r, ic_cy + r * 0.5),
                      fill=ic_col, outline=ink, width=2)
            d.rectangle((ic_cx - 5, ic_cy + r * 0.4,
                         ic_cx + 5, ic_cy + r),
                        fill=hex2rgb("#8A5A2A"), outline=ink)

        nw = text_w(d, num, f["stat_num"])
        d.text((ic_cx - nw // 2, cy0 + 100), num,
               fill=ink, font=f["stat_num"])
        lw = text_w(d, lbl, f["stat_lbl"])
        d.text((ic_cx - lw // 2, cy0 + 160), lbl,
               fill=P["muted"], font=f["stat_lbl"])

    cur_y += chip_h + 50

    tabs = ["Vecinos", "Negocios", "Decisiones", "Ranking"]
    active = "Negocios"
    tabs_y = cur_y
    tab_total_w = W - 2 * pad_x
    n = len(tabs)
    tab_w = tab_total_w // n
    for i, t in enumerate(tabs):
        tx0 = pad_x + i * tab_w
        is_active = (t == active)
        tw = text_w(d, t, f["tab"] if is_active else f["tab_off"])
        d.text((tx0 + (tab_w - tw) // 2, tabs_y),
               t,
               fill=ink if is_active else P["muted"],
               font=f["tab"] if is_active else f["tab_off"])
        if is_active:
            d.rectangle((tx0 + tab_w // 2 - 60,
                         tabs_y + 50,
                         tx0 + tab_w // 2 + 60,
                         tabs_y + 56),
                        fill=P["accent_glow"])
    cur_y += 86
    d.line([(pad_x, cur_y), (W - pad_x, cur_y)],
           fill=P["divider"], width=2)
    cur_y += 24

    rows_to_show = []
    for f_, pt, _d in inside_pois[:4]:
        rows_to_show.append((f_, False))
    if len(rows_to_show) < 4:
        for f_, pt, _d in near_pois[:(4 - len(rows_to_show))]:
            rows_to_show.append((f_, True))

    row_h = 150
    for f_, is_near in rows_to_show:
        cat = f_["properties"].get("category", "comercio")
        name = f_["properties"].get("name") or "(sin nombre)"
        col_hex = categories.get(cat, {}).get("color", "#888888")
        cx0 = pad_x + 8
        cy_row = cur_y + row_h // 2
        d.ellipse((cx0, cy_row - 28, cx0 + 56, cy_row + 28),
                  fill=hex2rgb(col_hex), outline=ink, width=2)
        title_x = cx0 + 80
        title_lbl = name
        if len(title_lbl) > 38:
            title_lbl = title_lbl[:36] + "..."
        d.text((title_x, cy_row - 30),
               title_lbl, fill=ink, font=f["row_title"])
        sub = f"{cat}"
        if is_near:
            sub += "  ·  (en zona)"
        d.text((title_x, cy_row + 8),
               sub, fill=P["muted"], font=f["row_sub"])
        chx = W - pad_x - 30
        d.line([(chx, cy_row - 16), (chx + 14, cy_row),
                (chx, cy_row + 16)], fill=P["muted"], width=4)
        d.line([(pad_x, cur_y + row_h - 1),
                (W - pad_x, cur_y + row_h - 1)],
               fill=P["divider"], width=1)
        cur_y += row_h

    btn_w = 720
    btn_h = 168
    btn_x1 = W - 60
    btn_y1 = y0 + height - HOME_INDICATOR_H - 30
    btn_x0 = btn_x1 - btn_w
    btn_y0 = btn_y1 - btn_h
    shd_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd2 = ImageDraw.Draw(shd_layer)
    sd2.rounded_rectangle((btn_x0 + 6, btn_y0 + 12,
                            btn_x1 + 6, btn_y1 + 12),
                           radius=84, fill=(30, 25, 18, 140))
    shd_blur = shd_layer.filter(ImageFilter.GaussianBlur(radius=12))
    img.alpha_composite(shd_blur)
    d = ImageDraw.Draw(img)
    round_rect(d, (btn_x0, btn_y0, btn_x1, btn_y1),
               radius=84, fill=P["btn_dark_ocre"])
    cta = "+   Registrar mi portal"
    cw = text_w(d, cta, f["cta"])
    d.text((btn_x0 + (btn_w - cw) // 2,
            btn_y0 + (btn_h - 40) // 2 - 4),
           cta, fill=P["paper"], font=f["cta"])

    return {
        "rows_shown": len(rows_to_show),
        "btn_box": (btn_x0, btn_y0, btn_x1, btn_y1),
    }


def render_mockup(cusec: str, target_id: int,
                  pack_dir: pathlib.Path, out_path: pathlib.Path) -> Dict:
    meta = json.load(open(pack_dir / "meta.json", encoding="utf-8"))
    categories = meta["categories"]

    img = Image.new("RGBA", (W, H), P["paper"] + (255,))
    ink = P["ink"]

    draw_status_bar(img, top_y=0, ink=ink, paper=P["paper_dim"])

    top_y = STATUS_BAR_H
    draw_top_bar(img, y0=top_y, ink=ink, paper=P["paper"], ocre=P["ocre_dk"])

    map_y = top_y + TOP_BAR_H
    map_meta = render_map_panel(img, y0=map_y, height=MAP_H,
                                pack_dir=pack_dir, target_id=target_id,
                                categories=categories, ink=ink)

    manzanas_gj = json.load(open(pack_dir / "manzanas.geojson",
                                 encoding="utf-8"))
    target_poly = None
    for f in manzanas_gj["features"]:
        if f["properties"]["id"] == target_id:
            target_poly = shape(f["geometry"])
            break
    inside_pois, near_pois, n_trees = filter_target_pois_and_trees(
        pack_dir, target_id, target_poly)

    sheet_y = map_y + MAP_H
    sheet_meta = draw_bottom_sheet(
        img, y0=sheet_y, height=SHEET_H,
        target_id=target_id, pack_dir=pack_dir, categories=categories,
        n_buildings_target=map_meta["n_buildings_target"],
        inside_pois=inside_pois, near_pois=near_pois,
        n_trees_inside=n_trees, ink=ink,
    )

    draw_home_indicator(img, bottom_y=H, ink=ink)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(out_path, "PNG", optimize=True)

    n_buildings_target = map_meta["n_buildings_target"]
    n_portales = int(round(n_buildings_target * 3.9))
    return {
        "out_path": out_path,
        "target_id": target_id,
        "n_buildings": n_buildings_target,
        "n_portales": n_portales,
        "n_pois_inside": len(inside_pois),
        "n_pois_in_zone": max(0, sheet_meta["rows_shown"] - len(inside_pois)),
        "n_trees": n_trees,
        "hitbox_px": map_meta["hitbox"],
        "rows_shown": sheet_meta["rows_shown"],
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cusec", help="Código de sección censal (10 dígitos)")
    ap.add_argument("manzana_id", type=int,
                    help="ID de la manzana a destacar")
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
                    / f"{args.cusec}_m{args.manzana_id}_mobile.png")
    if not out_path.is_absolute():
        out_path = ROOT / out_path

    res = render_mockup(args.cusec, args.manzana_id, pack_dir, out_path)
    print(f"OK -> {res['out_path']}")
    print(f"  manzana objetivo:    {res['target_id']}")
    print(f"  edificios:           {res['n_buildings']}")
    print(f"  portales (x3.9):     {res['n_portales']}")
    print(f"  POIs dentro:         {res['n_pois_inside']}")
    print(f"  POIs (en zona):      {res['n_pois_in_zone']}")
    print(f"  arboles:             {res['n_trees']}")
    print(f"  hitbox manzana px:   {res['hitbox_px']}")
    print(f"  filas mostradas:     {res['rows_shown']}")


if __name__ == "__main__":
    main()
