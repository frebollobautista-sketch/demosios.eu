"""KOINOS · POLIS — Mockup móvil "Songkick": una manzana hero + cards XL.

Genera UN PNG (1170x2532, iPhone 14/15 Pro a 3x) que muestra UNA manzana
del cluster con presencia visual contundente: edificios grandes con
ventanas, sombras y borde grueso, y dos eventos como CARDS estilo
Songkick (no pins). Resto del cluster solo asoma en los bordes.

Uso:
    python3 -m packages.mockups.songkick 3501602052 24
    python3 -m packages.mockups.songkick 3501602052 24 --out path.png
"""
from __future__ import annotations

import argparse
import json
import math
import pathlib
import sys
from typing import Dict, List, Optional, Tuple

from PIL import Image, ImageDraw, ImageFilter, ImageFont
from shapely.geometry import LineString, Polygon, box, shape

ROOT = pathlib.Path(__file__).resolve().parents[2]

from packages.mockups.zoom import (  # noqa: E402
    COS30, SIN30, PALETTE, ROAD_TYPE_IMPORTANCE, ROAD_TYPE_STYLE,
    hex2rgb, iso, shade,
)
from packages.mockups.mobile import (  # noqa: E402
    W, H, SCALE, STATUS_BAR_H, HOME_INDICATOR_H,
    fonts as base_fonts, round_rect, text_w,
    draw_status_bar, draw_home_indicator,
)

DEFAULT_PACK = ROOT / "public" / "sections_pack"
DEFAULT_OUT_DIR = ROOT / "design" / "secciones"

TOP_BAR_H = 168
SHEET_PEEK_H = int(H * 0.20)
USABLE_H = H - STATUS_BAR_H - TOP_BAR_H - SHEET_PEEK_H - HOME_INDICATOR_H
MAP_H = USABLE_H

P = dict(PALETTE)
P["paper_dim"] = tuple(int(c * 0.94) for c in P["paper"])
P["sheet_bg"] = P["paper"]
P["chip_bg"] = P["sand_lt"]
P["divider"] = (210, 200, 178)
P["muted"] = (118, 108, 90)
P["btn_dark_ocre"] = hex2rgb("#8A5A2A")
P["accent_glow"] = (200, 84, 56)
P["res_warm"] = hex2rgb("#D4BE9C")
P["window_ink"] = (38, 30, 22)

CAT_CULTURA = "#9F4FE6"
CAT_COMUNIDAD = "#E68A4F"


EVENTS = [
    {
        "key": "A",
        "title": "Concierto OFGC",
        "title2": "Sinfonía nº 5 de Mahler",
        "category_l1": "Cultura",
        "category_l2": "Música",
        "color_hex": CAT_CULTURA,
        "when_label": "Hoy · 20:30",
        "icon": "music",
    },
    {
        "key": "B",
        "title": "Asamblea vecinal",
        "title2": "Peatonalización avenida",
        "category_l1": "Comunidad",
        "category_l2": "Asamblea",
        "color_hex": CAT_COMUNIDAD,
        "when_label": "Mañana · 19:00",
        "icon": "mic",
    },
]


def fonts(scale: int = SCALE):
    base = base_fonts(scale)
    serif_b = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
        "/System/Library/Fonts/Supplemental/Georgia Bold.ttf",
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
    base["card_title"] = _try(serif_b, 9 * s)
    base["card_when"]  = _try(sans_b,  6 * s)
    base["card_cat"]   = _try(sans_b,  5 * s)
    base["chip"]       = _try(sans_b,   8 * s)
    base["chip_lbl"]   = _try(sans_r,   8 * s)
    base["sheet_h"]    = _try(serif_b, 16 * s)
    base["crumb_sm"]   = _try(sans_r,   9 * s)
    base["pile_more"]  = _try(sans_b,   8 * s)
    return base


def draw_round_btn(d, cx, cy, r, ink, paper, kind: str):
    d.ellipse((cx - r, cy - r, cx + r, cy + r),
              fill=paper, outline=ink, width=4)
    if kind == "back":
        d.line([(cx + 10, cy - 18), (cx - 8, cy), (cx + 10, cy + 18)],
               fill=ink, width=6)
    elif kind == "search":
        rr = 16
        d.ellipse((cx - rr - 4, cy - rr - 4, cx + rr - 4, cy + rr - 4),
                  outline=ink, width=5)
        d.line([(cx + rr - 12, cy + rr - 12), (cx + rr + 6, cy + rr + 6)],
               fill=ink, width=6)


def draw_top_bar(img: Image.Image, y0: int, ink, paper):
    d = ImageDraw.Draw(img)
    d.rectangle((0, y0, W, y0 + TOP_BAR_H), fill=paper)
    d.rectangle((0, y0 + TOP_BAR_H - 2, W, y0 + TOP_BAR_H), fill=P["divider"])
    f = fonts()
    cy = y0 + TOP_BAR_H // 2

    draw_round_btn(d, cx=84, cy=cy, r=54, ink=ink, paper=P["paper"],
                   kind="back")
    draw_round_btn(d, cx=W - 84, cy=cy, r=54, ink=ink, paper=P["paper"],
                   kind="search")

    crumb = "Las Canteras  ›  Sec 052"
    cw = text_w(d, crumb, f["crumb_sm"])
    d.text(((W - cw) // 2, cy - 16), crumb,
           fill=P["muted"], font=f["crumb_sm"])
    sub = "Manzana 24"
    sw = text_w(d, sub, f["sheet_h"])
    d.text(((W - sw) // 2, cy + 12), sub, fill=ink, font=f["sheet_h"])


def composite_shadow(img: Image.Image, draw_cb, blur_radius: int = 14):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(layer)
    draw_cb(sd)
    blurred = layer.filter(ImageFilter.GaussianBlur(radius=blur_radius))
    img.alpha_composite(blurred)


def _grid_face_windows(d, p0, p1, p2, p3, levels: int, ink_alpha=170):
    base_w = math.hypot(p1[0] - p0[0], p1[1] - p0[1])
    cols = max(1, int(base_w / 14))
    rows = max(1, levels)

    if rows == 0 or cols == 0:
        return

    for r in range(rows):
        v0 = 0.15 + (r + 0.15) / (rows + 0.30) * 0.70
        v1 = 0.15 + (r + 0.85) / (rows + 0.30) * 0.70
        for c in range(cols):
            u0 = 0.10 + (c + 0.20) / cols * 0.80
            u1 = 0.10 + (c + 0.80) / cols * 0.80
            def lerp(a, b, t):
                return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
            bot_uv = lerp(p0, p1, u0)
            bot_uv2 = lerp(p0, p1, u1)
            top_uv = lerp(p3, p2, u0)
            top_uv2 = lerp(p3, p2, u1)
            ll = lerp(bot_uv, top_uv, v0)
            lr = lerp(bot_uv2, top_uv2, v0)
            ur = lerp(bot_uv2, top_uv2, v1)
            ul = lerp(bot_uv, top_uv, v1)
            d.polygon([ll, lr, ur, ul],
                      fill=P["window_ink"] + (ink_alpha,))


def _draw_building_iso(img: Image.Image, b: Dict, IS, ink, base_color,
                       levels: int, draw_shadows=True):
    ring_xz = b["ring"]
    if len(ring_xz) >= 2 and ring_xz[0] == ring_xz[-1]:
        ring_xz = ring_xz[:-1]
    n = len(ring_xz)
    if n < 3:
        return
    h = b["h"]

    if draw_shadows:
        shadow_offset_m = (3.5, 3.5)
        shadow_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
        sd = ImageDraw.Draw(shadow_layer)
        sh_pts = []
        for x_, z_ in ring_xz:
            sh_pts.append(IS(x_ + shadow_offset_m[0], 0,
                             z_ + shadow_offset_m[1]))
        sd.polygon(sh_pts, fill=(20, 16, 12, 70))
        shadow_blur = shadow_layer.filter(ImageFilter.GaussianBlur(radius=8))
        img.alpha_composite(shadow_blur)

    d = ImageDraw.Draw(img)

    bot = [IS(x_, 0, z_) for x_, z_ in ring_xz]
    top_pts = [IS(x_, h, z_) for x_, z_ in ring_xz]

    base = base_color
    left_col = shade(base, 0.74)
    right_col = shade(base, 0.90)
    border = ink

    for k in range(n):
        ax_, az_ = ring_xz[k]
        bx_, bz_ = ring_xz[(k + 1) % n]
        nx_, nz_ = (bz_ - az_), -(bx_ - ax_)
        if nx_ + nz_ <= 0:
            continue
        tilt = nx_ / (abs(nx_) + abs(nz_) + 1e-6)
        face = right_col if tilt > 0 else left_col
        p0 = bot[k]
        p1 = bot[(k + 1) % n]
        p2 = top_pts[(k + 1) % n]
        p3 = top_pts[k]
        d.polygon([p0, p1, p2, p3], fill=face,
                  outline=border, width=3)
        win_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
        wd = ImageDraw.Draw(win_layer)
        _grid_face_windows(wd, p0, p1, p2, p3, levels=levels,
                           ink_alpha=160)
        img.alpha_composite(win_layer)
        d = ImageDraw.Draw(img)

    xs = [pt[0] for pt in top_pts]
    ys = [pt[1] for pt in top_pts]
    x0_t, y0_t, x1_t, y1_t = min(xs), min(ys), max(xs), max(ys)
    d.polygon(top_pts, fill=base, outline=border, width=3)
    grad_w = max(2, int(x1_t - x0_t) + 4)
    grad_h = max(2, int(y1_t - y0_t) + 4)
    grad = Image.new("RGBA", (grad_w, grad_h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grad)
    light = shade(base, 1.10) + (90,)
    dark = shade(base, 0.78) + (90,)
    for yy in range(grad_h):
        t = yy / max(1, grad_h - 1)
        c = (
            int(light[0] + (dark[0] - light[0]) * t),
            int(light[1] + (dark[1] - light[1]) * t),
            int(light[2] + (dark[2] - light[2]) * t),
            int(light[3] + (dark[3] - light[3]) * t),
        )
        gd.line([(0, yy), (grad_w, yy)], fill=c)
    mask_img = Image.new("L", img.size, 0)
    md = ImageDraw.Draw(mask_img)
    md.polygon(top_pts, fill=255)
    grad_full = Image.new("RGBA", img.size, (0, 0, 0, 0))
    grad_full.paste(grad, (int(x0_t) - 2, int(y0_t) - 2))
    img.paste(grad_full, (0, 0), mask_img)
    d = ImageDraw.Draw(img)
    d.line(top_pts + [top_pts[0]], fill=border, width=3)


def render_hero_map(img: Image.Image, y0: int, height: int,
                    pack_dir: pathlib.Path, target_id: int,
                    categories: Dict, ink) -> Dict:
    d = ImageDraw.Draw(img)
    d.rectangle((0, y0, W, y0 + height), fill=P["cream"])

    manz_gj = json.load(open(pack_dir / "manzanas.geojson", encoding="utf-8"))
    bldg_gj = json.load(open(pack_dir / "buildings.geojson", encoding="utf-8"))
    roads_gj = json.load(open(pack_dir / "roads.geojson", encoding="utf-8"))

    manz: Dict[int, Polygon] = {}
    for f in manz_gj["features"]:
        manz[f["properties"]["id"]] = shape(f["geometry"])

    if target_id not in manz:
        raise SystemExit(f"manzana {target_id} no existe")
    target_poly = manz[target_id]

    others = sorted(
        [(mid, p) for mid, p in manz.items() if mid != target_id],
        key=lambda kv: kv[1].distance(target_poly),
    )[:6]

    pad = 4.0
    minx, miny, maxx, maxy = target_poly.bounds
    bbox_xz = box(minx - pad, miny - pad, maxx + pad, maxy + pad)
    bx0, by0_, bx1, by1_ = bbox_xz.bounds

    margin_x = 30
    margin_top = 20
    margin_bot = 20
    h_max = 14.0
    bw = bx1 - bx0
    bh = by1_ - by0_
    span_w = (bw + bh) * COS30
    span_h = (bw + bh) * SIN30 + h_max * 1.6
    avail_w = W - 2 * margin_x
    avail_h = height - margin_top - margin_bot
    sxy = min(avail_w / span_w, avail_h / span_h) * 1.05
    sz = sxy * 1.6
    mx = (bx0 + bx1) / 2
    my = (by0_ + by1_) / 2
    cx_canvas = W / 2 - (mx - my) * COS30 * sxy
    cy_canvas = y0 + height / 2 - (mx + my) * SIN30 * sxy

    def IS(x_, y_, z_):
        return iso(x_, y_, z_, sxy, sz, cx_canvas, cy_canvas)

    m_per_px = 1.0 / (COS30 * sxy)

    bbox_hi = box(bx0 - 60, by0_ - 60, bx1 + 60, by1_ + 60)

    bldg_target: List[Dict] = []
    bldg_neigh: List[Dict] = []
    for f in bldg_gj["features"]:
        ring = f["geometry"]["coordinates"][0]
        try:
            poly = Polygon(ring)
        except Exception:
            continue
        if not poly.is_valid or poly.is_empty:
            continue
        if not poly.intersects(bbox_hi):
            continue
        c = poly.centroid
        b = {
            "id": f["properties"]["id"],
            "ring": [(p[0], p[1]) for p in ring],
            "h": float(f["properties"].get("height_m") or 6.0),
            "category": f["properties"].get("category", "residencial"),
            "manzana_id": f["properties"].get("manzana_id"),
            "levels": int(f["properties"].get("levels") or 3),
            "centroid": (c.x, c.y),
            "bounds": poly.bounds,
        }
        if b["manzana_id"] == target_id:
            bldg_target.append(b)
        elif bbox_hi.contains(c):
            bldg_neigh.append(b)

    roads_in = []
    for f in roads_gj["features"]:
        try:
            line = LineString(f["geometry"]["coordinates"])
        except Exception:
            continue
        if not line.intersects(bbox_hi):
            continue
        clipped = line.intersection(bbox_hi)
        if clipped.is_empty:
            continue
        rtype = f["properties"].get("type", "service")
        if clipped.geom_type == "LineString":
            roads_in.append((rtype, list(clipped.coords)))
        elif clipped.geom_type == "MultiLineString":
            for g in clipped.geoms:
                roads_in.append((rtype, list(g.coords)))

    floor_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    fd = ImageDraw.Draw(floor_layer)
    for mid, poly in others:
        ring = list(poly.exterior.coords)
        pts = [IS(x_, 0, z_) for x_, z_ in ring]
        if len(pts) >= 3:
            fd.polygon(pts, fill=P["sand_lt"] + (160,),
                       outline=P["sand"] + (220,))
    ring = list(target_poly.exterior.coords)
    pts = [IS(x_, 0, z_) for x_, z_ in ring]
    if len(pts) >= 3:
        fd.polygon(pts, fill=P["sand_lt"] + (255,),
                   outline=P["ocre_dk"] + (240,))
    img.alpha_composite(floor_layer)
    d = ImageDraw.Draw(img)

    sorted_roads = sorted(roads_in,
                          key=lambda r: ROAD_TYPE_IMPORTANCE.get(r[0], 0))
    for rtype, coords in sorted_roads:
        col_key, w = ROAD_TYPE_STYLE.get(rtype, ("sand_lt", 1))
        col = P[col_key]
        pts = [IS(x_, 0, z_) for x_, z_ in coords]
        if len(pts) >= 2:
            d.line(pts, fill=col, width=max(1, w - 1))

    order_n = sorted(range(len(bldg_neigh)),
                     key=lambda i: bldg_neigh[i]["bounds"][0]
                     + bldg_neigh[i]["bounds"][1])
    bn_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    bnd = ImageDraw.Draw(bn_layer)
    for i in order_n:
        b = bldg_neigh[i]
        cat = b["category"]
        col_hex = categories.get(cat, {}).get("color", "#C8B898")
        if cat == "residencial":
            base = P["res_warm"]
        else:
            base = hex2rgb(col_hex)
        base_dim = shade(base, 0.92)
        ring_xz = b["ring"]
        if len(ring_xz) >= 2 and ring_xz[0] == ring_xz[-1]:
            ring_xz = ring_xz[:-1]
        n = len(ring_xz)
        if n < 3:
            continue
        bot = [IS(x_, 0, z_) for x_, z_ in ring_xz]
        top_pts = [IS(x_, b["h"], z_) for x_, z_ in ring_xz]
        for k in range(n):
            ax_, az_ = ring_xz[k]
            bx_, bz_ = ring_xz[(k + 1) % n]
            nx_, nz_ = (bz_ - az_), -(bx_ - ax_)
            if nx_ + nz_ <= 0:
                continue
            tilt = nx_ / (abs(nx_) + abs(nz_) + 1e-6)
            face = (shade(base_dim, 0.90) if tilt > 0
                    else shade(base_dim, 0.74))
            bnd.polygon([bot[k], bot[(k + 1) % n],
                         top_pts[(k + 1) % n], top_pts[k]],
                        fill=face + (190,),
                        outline=ink + (200,), width=2)
        bnd.polygon(top_pts, fill=base_dim + (190,),
                    outline=ink + (200,), width=2)
    img.alpha_composite(bn_layer)
    d = ImageDraw.Draw(img)

    order_t = sorted(range(len(bldg_target)),
                     key=lambda i: bldg_target[i]["bounds"][0]
                     + bldg_target[i]["bounds"][1])
    avg_w_px_list = []
    for i in order_t:
        b = bldg_target[i]
        bnd_b = b["bounds"]
        w_m = max(bnd_b[2] - bnd_b[0], bnd_b[3] - bnd_b[1])
        w_px = w_m * COS30 * sxy
        avg_w_px_list.append(w_px)
        cat = b["category"]
        if cat == "residencial":
            base = P["res_warm"]
        else:
            base = hex2rgb(categories.get(cat, {}).get("color", "#C8B898"))
        _draw_building_iso(img, b, IS, ink, base,
                           levels=max(2, b["levels"]), draw_shadows=True)

    avg_w_px = sum(avg_w_px_list) / max(1, len(avg_w_px_list))

    return {
        "IS": IS,
        "sxy": sxy,
        "m_per_px": m_per_px,
        "avg_building_w_px": avg_w_px,
        "bldg_target": bldg_target,
        "y0": y0,
        "height": height,
    }


def _draw_card_icon(d: ImageDraw.ImageDraw, cx: int, cy: int, r: int,
                    kind: str, color):
    d.ellipse((cx - r, cy - r, cx + r, cy + r),
              fill=P["paper"], outline=color, width=2)
    if kind == "music":
        head_r = 6
        d.ellipse((cx - 12 - head_r, cy + 6 - head_r,
                   cx - 12 + head_r, cy + 6 + head_r), fill=color)
        d.ellipse((cx + 4 - head_r, cy + 10 - head_r,
                   cx + 4 + head_r, cy + 10 + head_r), fill=color)
        d.line([(cx - 12 + head_r, cy + 6),
                (cx - 12 + head_r, cy - 14)], fill=color, width=3)
        d.line([(cx + 4 + head_r, cy + 10),
                (cx + 4 + head_r, cy - 10)], fill=color, width=3)
        d.line([(cx - 12 + head_r, cy - 14),
                (cx + 4 + head_r, cy - 10)], fill=color, width=3)
    elif kind == "mic":
        d.rounded_rectangle((cx - 7, cy - 14, cx + 7, cy + 4),
                            radius=7, fill=color)
        d.arc((cx - 14, cy - 6, cx + 14, cy + 14),
              start=0, end=180, fill=color, width=3)
        d.line([(cx, cy + 10), (cx, cy + 16)], fill=color, width=3)
        d.line([(cx - 8, cy + 16), (cx + 8, cy + 16)], fill=color, width=3)
    elif kind == "chef":
        d.ellipse((cx - 14, cy - 16, cx + 14, cy + 6), fill=color)
        d.rectangle((cx - 12, cy + 2, cx + 12, cy + 14), fill=color)


CARD_W = 720
CARD_H = 290


def draw_event_card(img: Image.Image, anchor_xy: Tuple[int, int],
                    evt: Dict, ink, *, dx: int = 0, dy: int = 0,
                    pile_idx: int = 0, total: int = 1,
                    place: str = "above"):
    d = ImageDraw.Draw(img)
    f = fonts()
    color = hex2rgb(evt["color_hex"])
    color_dk = shade(color, 0.55)

    ax, ay = anchor_xy

    card_w, card_h = CARD_W, CARD_H
    pad = 30
    if place == "above":
        bx0 = ax - card_w // 2 + dx
        by0 = ay - card_h - 80 + dy
    elif place == "below":
        bx0 = ax - card_w // 2 + dx
        by0 = ay + 80 + dy
    else:
        bx0 = ax - card_w // 2 + dx
        by0 = ay - card_h - 80 + dy

    if bx0 < pad:
        bx0 = pad
    if bx0 + card_w > W - pad:
        bx0 = W - pad - card_w
    bx1 = bx0 + card_w
    by1 = by0 + card_h

    def shadow_cb(sd):
        sd.rounded_rectangle((bx0 + 10, by0 + 18, bx1 + 10, by1 + 18),
                             radius=36, fill=(20, 16, 12, 140))
    composite_shadow(img, shadow_cb, blur_radius=12)
    d = ImageDraw.Draw(img)

    radius = 36
    base_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    bd = ImageDraw.Draw(base_layer)
    bd.rounded_rectangle((bx0, by0, bx1, by1), radius=radius,
                         fill=color + (255,))
    img.alpha_composite(base_layer)

    grad_full = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(grad_full)
    x_thresh = int(card_w * 0.55)
    y_thresh = int(card_h * 0.50)
    for j in range(y_thresh, card_h):
        ty = (j - y_thresh) / max(1, card_h - y_thresh)
        for i_seg in range(x_thresh, card_w, 8):
            tx = (i_seg - x_thresh) / max(1, card_w - x_thresh)
            t = (tx + ty) * 0.5
            a = int(t * 70)
            if a > 0:
                gd.rectangle((bx0 + i_seg, by0 + j,
                              bx0 + i_seg + 8, by0 + j + 1),
                             fill=color_dk + (a,))
    mask_full = Image.new("L", img.size, 0)
    mfd = ImageDraw.Draw(mask_full)
    mfd.rounded_rectangle((bx0, by0, bx1, by1), radius=radius, fill=255)
    grad_a = grad_full.split()[3]
    from PIL import ImageChops
    new_a = ImageChops.multiply(grad_a, mask_full)
    grad_full.putalpha(new_a)
    img.alpha_composite(grad_full)
    d = ImageDraw.Draw(img)

    border_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    brd = ImageDraw.Draw(border_layer)
    brd.rounded_rectangle((bx0, by0, bx1, by1), radius=radius,
                          outline=(255, 248, 230, 130), width=4)
    img.alpha_composite(border_layer)
    d = ImageDraw.Draw(img)

    pad_in = 26
    cat_lbl = f"{evt['category_l1'].upper()} · {evt['category_l2'].upper()}"
    cw = text_w(d, cat_lbl, f["card_cat"])
    rib_x0 = bx0 + pad_in
    rib_y0 = by0 + pad_in
    rib_h = 30
    rib_w = cw + 22
    cap_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    cd = ImageDraw.Draw(cap_layer)
    cd.rounded_rectangle((rib_x0, rib_y0, rib_x0 + rib_w, rib_y0 + rib_h),
                         radius=rib_h // 2, fill=(255, 255, 255, 70))
    img.alpha_composite(cap_layer)
    d = ImageDraw.Draw(img)
    d.text((rib_x0 + 11, rib_y0 + 7), cat_lbl,
           fill=P["paper"], font=f["card_cat"])

    icon_r = 28
    icon_cx = bx1 - pad_in - icon_r
    icon_cy = by0 + pad_in + icon_r
    _draw_card_icon(d, icon_cx, icon_cy, icon_r, evt["icon"], color_dk)

    tit_x = bx0 + pad_in
    tit_y = rib_y0 + rib_h + 16
    d.text((tit_x, tit_y), evt["title"],
           fill=P["paper"], font=f["card_title"])
    d.text((tit_x, tit_y + 50), evt["title2"],
           fill=P["paper"], font=f["card_title"])

    when = evt["when_label"]
    when_y = by1 - pad_in - 28
    d.text((tit_x, when_y), when,
           fill=(255, 248, 230, 235), font=f["card_when"])

    tip_w = 22
    tip_x = max(bx0 + 60, min(bx1 - 60, ax))
    if place == "above":
        d.polygon([
            (tip_x - tip_w, by1),
            (tip_x + tip_w, by1),
            (ax, ay - 8),
        ], fill=color, outline=None)
    else:
        d.polygon([
            (tip_x - tip_w, by0),
            (tip_x + tip_w, by0),
            (ax, ay - 8),
        ], fill=color, outline=None)

    d.ellipse((ax - 8, ay - 8, ax + 8, ay + 8),
              fill=color, outline=ink, width=2)

    return (bx0, by0, bx1, by1)


def draw_peek_sheet(img: Image.Image, y0: int, height: int, ink,
                    n_buildings: int, n_portales: int, n_negocios: int,
                    n_eventos: int):
    d = ImageDraw.Draw(img)
    f = fonts()

    sheet_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sheet_layer)
    radius = 84

    shadow_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    shd = ImageDraw.Draw(shadow_layer)
    shd.rounded_rectangle((-6, y0 - 18, W + 6, y0 + height + 30),
                          radius=radius + 6, fill=(0, 0, 0, 80))
    shadow_blur = shadow_layer.filter(ImageFilter.GaussianBlur(radius=18))
    img.alpha_composite(shadow_blur)

    sd.rounded_rectangle((0, y0, W, y0 + height + 60),
                         radius=radius, fill=P["sheet_bg"] + (255,))
    sd.rectangle((0, y0 + radius, W, y0 + height + 60),
                 fill=P["sheet_bg"] + (255,))
    img.alpha_composite(sheet_layer)
    d = ImageDraw.Draw(img)

    handle_w, handle_h = 132, 14
    hx0 = (W - handle_w) // 2
    hy0 = y0 + 28
    round_rect(d, (hx0, hy0, hx0 + handle_w, hy0 + handle_h),
               radius=7, fill=P["divider"])

    pad_x = 64
    cur_y = y0 + 80
    title = "Manzana 24  ·  Las Canteras"
    d.text((pad_x, cur_y), title, fill=ink, font=f["sheet_h"])
    cur_y += 90

    chips = [
        (f"{n_buildings} edif"),
        (f"{n_portales} portales"),
        (f"{n_negocios} negocios"),
        (f"{n_eventos} eventos hoy"),
    ]
    chip_h = 70
    chip_gap = 18
    cur_x = pad_x
    for ch in chips:
        cw = text_w(d, ch, f["chip"])
        chip_w = cw + 56
        round_rect(d, (cur_x, cur_y, cur_x + chip_w, cur_y + chip_h),
                   radius=chip_h // 2, fill=P["chip_bg"],
                   outline=P["divider"], width=2)
        d.text((cur_x + 28, cur_y + 18), ch,
               fill=ink, font=f["chip"])
        cur_x += chip_w + chip_gap


def render_songkick_mockup(cusec: str, target_id: int,
                           pack_dir: pathlib.Path,
                           out_path: pathlib.Path) -> Dict:
    meta = json.load(open(pack_dir / "meta.json", encoding="utf-8"))
    categories = meta["categories"]

    img = Image.new("RGBA", (W, H), P["paper"] + (255,))
    ink = P["ink"]

    draw_status_bar(img, top_y=0, ink=ink, paper=P["paper_dim"])

    top_y = STATUS_BAR_H
    draw_top_bar(img, y0=top_y, ink=ink, paper=P["paper"])

    map_y = top_y + TOP_BAR_H
    map_meta = render_hero_map(img, y0=map_y, height=MAP_H,
                               pack_dir=pack_dir, target_id=target_id,
                               categories=categories, ink=ink)
    IS = map_meta["IS"]
    bldg_target = map_meta["bldg_target"]

    bldg_with_screen = []
    for b in bldg_target:
        cx_, cz_ = b["centroid"]
        sx, sy = IS(cx_, b["h"], cz_)
        bldg_with_screen.append((b, sx, sy))

    map_y0 = map_meta["y0"]
    map_y1 = map_meta["y0"] + map_meta["height"]
    third = (map_y1 - map_y0) / 3

    upper = [t for t in bldg_with_screen
             if t[2] < map_y0 + third * 1.4]
    lower = [t for t in bldg_with_screen
             if t[2] > map_y0 + third * 1.6]
    if not upper:
        upper = bldg_with_screen[:max(1, len(bldg_with_screen) // 3)]
    if not lower:
        lower = bldg_with_screen[-max(1, len(bldg_with_screen) // 3):]

    upper.sort(key=lambda t: t[1])
    cand_a = upper[len(upper) // 4]
    lower.sort(key=lambda t: -t[1])
    cand_b = lower[len(lower) // 4]

    anchor_a = (int(cand_a[1]), int(cand_a[2]))
    anchor_b = (int(cand_b[1]), int(cand_b[2]))

    box_a = draw_event_card(img, anchor_a, EVENTS[0], ink, place="above")
    box_b = draw_event_card(img, anchor_b, EVENTS[1], ink, place="below")

    sheet_y = H - HOME_INDICATOR_H - SHEET_PEEK_H
    n_buildings = len(bldg_target)
    n_portales = int(round(n_buildings * 3.9))
    draw_peek_sheet(img, y0=sheet_y, height=SHEET_PEEK_H, ink=ink,
                    n_buildings=n_buildings, n_portales=n_portales,
                    n_negocios=6, n_eventos=2)

    draw_home_indicator(img, bottom_y=H, ink=ink)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(out_path, "PNG", optimize=True)

    return {
        "out_path": out_path,
        "target_id": target_id,
        "n_buildings": n_buildings,
        "m_per_px": map_meta["m_per_px"],
        "avg_building_w_px": map_meta["avg_building_w_px"],
        "anchor_a": anchor_a,
        "anchor_b": anchor_b,
        "box_a": box_a,
        "box_b": box_b,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cusec", help="Código de sección censal (10 dígitos)")
    ap.add_argument("manzana_id", type=int,
                    help="ID de la manzana hero (la que ocupa ~75%)")
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
        out_path = DEFAULT_OUT_DIR / f"{args.cusec}_songkick.png"
    if not out_path.is_absolute():
        out_path = ROOT / out_path

    res = render_songkick_mockup(args.cusec, args.manzana_id,
                                 pack_dir, out_path)
    print(f"OK -> {res['out_path']}")
    print(f"  manzana hero:    {res['target_id']}")
    print(f"  edificios hero:  {res['n_buildings']}")
    print(f"  m/px:            {res['m_per_px']:.3f}")
    print(f"  avg edif w (px): {res['avg_building_w_px']:.1f}")
    print(f"  anchor A:        {res['anchor_a']}")
    print(f"  anchor B:        {res['anchor_b']}")


if __name__ == "__main__":
    main()
