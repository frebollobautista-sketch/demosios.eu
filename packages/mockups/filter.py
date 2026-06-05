"""KOINOS · POLIS — Mockup comparativo (A vs B) del patrón de filtrado por
categoría sobre la app móvil.

Genera UN PNG con DOS smartphones lado a lado (cada uno 1170x2532, marco
iPhone), separador de 40 px en el centro. Total ~2380x2532.

Estado A (izq): "sin filtro" — todos los edificios pintados con su color
de categoría completa, chip "Todos" activo, search bar vacío.

Estado B (der): "filtro <category> activo" — los edificios de la categoría
elegida brillan (color saturado + lift +2m), los edificios con un POI de la
misma categoría a <60m se pintan en color apagado de la misma familia, y el
resto se atenúa a un gris muy oscuro.

Uso:
    python3 -m packages.mockups.filter 3501602052 salud
    python3 -m packages.mockups.filter 3501602052 comercio --out path.png
"""
from __future__ import annotations

import argparse
import json
import math
import pathlib
import sys
from typing import Dict, List, Tuple

from PIL import Image, ImageDraw, ImageFilter, ImageFont
from shapely.geometry import LineString, Point, Polygon, box, shape

ROOT = pathlib.Path(__file__).resolve().parents[2]

from packages.mockups.zoom import (  # noqa: E402
    COS30, SIN30, PALETTE, ROAD_TYPE_IMPORTANCE, ROAD_TYPE_STYLE,
    hex2rgb, iso, shade,
)

DEFAULT_PACK = ROOT / "public" / "sections_pack"
DEFAULT_OUT_DIR = ROOT / "design" / "secciones"

PHONE_W, PHONE_H = 1170, 2532
GAP = 40
LABEL_TOP_H = 90
CANVAS_W = PHONE_W * 2 + GAP
CANVAS_H = PHONE_H + LABEL_TOP_H

SCALE = 3
STATUS_BAR_H = 132
SEARCH_BAR_H = 168
CHIPS_H = 132
HOME_INDICATOR_H = 102
SHEET_PEEK_H = 380

USABLE_H = PHONE_H - STATUS_BAR_H - SEARCH_BAR_H - CHIPS_H - HOME_INDICATOR_H
MAP_H = USABLE_H - SHEET_PEEK_H

P = dict(PALETTE)
P["paper_dim"] = tuple(int(c * 0.94) for c in P["paper"])
P["sheet_bg"] = P["paper"]
P["chip_bg"] = P["sand_lt"]
P["chip_bg_off"] = (232, 222, 200)
P["divider"] = (210, 200, 178)
P["muted"] = (118, 108, 90)
P["dim_bldg"] = (46, 42, 38)
P["dim_bldg_outline"] = (70, 64, 56)
P["btn_dark_ocre"] = hex2rgb("#8A5A2A")
P["accent_glow"] = (200, 84, 56)
P["arrow_ocre"] = hex2rgb("#B07840")

CHIP_CATS = [
    ("todos",        "Todos",        None),
    ("comercio",     "Comercio",     "comercio"),
    ("restauracion", "Restauración", "restauracion"),
    ("salud",        "Salud",        "salud"),
    ("alojamiento",  "Alojamiento",  "alojamiento"),
    ("finanzas",     "Finanzas",     "finanzas"),
    ("publico",      "Público",      "publico"),
    ("parques",      "Parques",      "parque"),
    ("sin_uso",      "Sin uso",      "residencial"),
]

NEAR_POI_RADIUS_M = 60.0
LIFT_HIGHLIGHT_M = 2.5


def fonts(scale: int = SCALE):
    serif_b = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
        "/System/Library/Fonts/Supplemental/Georgia Bold.ttf",
    ]
    serif_r = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
        "/System/Library/Fonts/Supplemental/Georgia.ttf",
    ]
    serif_i = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Italic.ttf",
        "/System/Library/Fonts/Supplemental/Georgia Italic.ttf",
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
        "status":       _try(sans_b, 17 * s),
        "search_ph":    _try(sans_r, 14 * s),
        "search_typed": _try(sans_b, 14 * s),
        "chip":         _try(sans_b, 11 * s),
        "chip_off":     _try(sans_r, 11 * s),
        "label_top":    _try(serif_i, 11 * s),
        "title":        _try(serif_b, 19 * s),
        "subtitle":     _try(sans_r, 11 * s),
        "row_title":    _try(sans_b, 12 * s),
        "row_sub":      _try(sans_r, 10 * s),
        "stat":         _try(sans_b, 10 * s),
        "small":        _try(sans_r, 9 * s),
        "map_lbl":      _try(sans_b, 10 * s),
        "arrow":        _try(serif_i, 12 * s),
    }


def round_rect(d, box_, radius, fill=None, outline=None, width=1):
    d.rounded_rectangle(box_, radius=radius, fill=fill, outline=outline,
                        width=width)


def text_w(d, txt, font):
    bb = d.textbbox((0, 0), txt, font=font)
    return bb[2] - bb[0]


def draw_status_bar(img, x_off, y_off, ink, paper):
    d = ImageDraw.Draw(img)
    f = fonts()
    d.rectangle((x_off, y_off, x_off + PHONE_W, y_off + STATUS_BAR_H),
                fill=paper)
    cy = y_off + STATUS_BAR_H // 2
    d.text((x_off + 54, cy - 22), "09:41", fill=ink, font=f["status"])

    notch_w = 360
    notch_h = 90
    nx0 = x_off + (PHONE_W - notch_w) // 2
    ny0 = y_off + 6
    round_rect(d, (nx0, ny0, nx0 + notch_w, ny0 + notch_h),
               radius=45, fill=(15, 12, 10))

    rx = x_off + PHONE_W - 60
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
    for r in [22, 14, 6]:
        d.arc((wf_x - r, wf_y - r - 4, wf_x + r, wf_y + r - 4),
              start=215, end=325, fill=ink, width=4)
    d.ellipse((wf_x - 5, wf_y + 1, wf_x + 5, wf_y + 11), fill=ink)
    sg_x = wf_x - 78
    for i in range(4):
        h = 8 + i * 6
        x0 = sg_x + i * 9
        d.rectangle((x0, cy + 14 - h, x0 + 6, cy + 14), fill=ink)


def draw_home_indicator(img, x_off, bottom_y, ink):
    d = ImageDraw.Draw(img)
    bar_w = 402
    bar_h = 15
    bx0 = x_off + (PHONE_W - bar_w) // 2
    by0 = bottom_y - HOME_INDICATOR_H + (HOME_INDICATOR_H - bar_h) // 2 - 8
    round_rect(d, (bx0, by0, bx0 + bar_w, by0 + bar_h), radius=8, fill=ink)


def draw_search_bar(img, x_off, y0, ink, paper, typed_text: str = "",
                    show_cursor: bool = False):
    d = ImageDraw.Draw(img)
    f = fonts()
    d.rectangle((x_off, y0, x_off + PHONE_W, y0 + SEARCH_BAR_H), fill=paper)
    d.rectangle((x_off, y0 + SEARCH_BAR_H - 2, x_off + PHONE_W,
                 y0 + SEARCH_BAR_H), fill=P["divider"])

    pad = 60
    field_h = 110
    field_y0 = y0 + (SEARCH_BAR_H - field_h) // 2
    field_y1 = field_y0 + field_h
    round_rect(d, (x_off + pad, field_y0, x_off + PHONE_W - pad, field_y1),
               radius=field_h // 2, fill=P["chip_bg"], outline=P["divider"],
               width=2)

    lup_cx = x_off + pad + 50
    lup_cy = (field_y0 + field_y1) // 2
    lr = 22
    d.ellipse((lup_cx - lr, lup_cy - lr, lup_cx + lr, lup_cy + lr),
              outline=P["muted"], width=5)
    d.line([(lup_cx + lr * 0.7, lup_cy + lr * 0.7),
            (lup_cx + lr * 1.4, lup_cy + lr * 1.4)],
           fill=P["muted"], width=6)

    flt_cx = x_off + PHONE_W - pad - 60
    flt_cy = (field_y0 + field_y1) // 2
    for i, dy in enumerate([-22, 0, 22]):
        y = flt_cy + dy
        d.line([(flt_cx - 28, y), (flt_cx + 28, y)],
               fill=P["muted"], width=5)
        nx = flt_cx + (-12 if i % 2 == 0 else 14)
        d.ellipse((nx - 8, y - 8, nx + 8, y + 8),
                  fill=P["sheet_bg"], outline=P["muted"], width=4)

    txt_x = lup_cx + lr + 36
    txt_y = lup_cy - 22
    if typed_text:
        d.text((txt_x, txt_y), typed_text, fill=ink, font=f["search_typed"])
        if show_cursor:
            tw = text_w(d, typed_text, f["search_typed"])
            cur_x = txt_x + tw + 4
            d.line([(cur_x, field_y0 + 26), (cur_x, field_y1 - 26)],
                   fill=P["accent_glow"], width=4)
    else:
        d.text((txt_x, txt_y),
               "Buscar farmacia, restaurante, dirección…",
               fill=P["muted"], font=f["search_ph"])


def draw_chips(img, x_off, y0, ink, active_key: str, categories: Dict):
    d = ImageDraw.Draw(img)
    f = fonts()
    d.rectangle((x_off, y0, x_off + PHONE_W, y0 + CHIPS_H),
                fill=P["paper"])
    d.rectangle((x_off, y0 + CHIPS_H - 2, x_off + PHONE_W, y0 + CHIPS_H),
                fill=P["divider"])

    cy = y0 + CHIPS_H // 2
    chip_h = 86
    pad_h = 32
    cur_x = x_off + 40

    for key, label, cat_key in CHIP_CATS:
        is_active = (key == active_key)
        font = f["chip"] if is_active else f["chip_off"]
        tw = text_w(d, label, font)
        chip_w = tw + 2 * pad_h
        ch_y0 = cy - chip_h // 2
        ch_y1 = cy + chip_h // 2
        ch_x0 = cur_x
        ch_x1 = cur_x + chip_w

        if is_active:
            if cat_key and cat_key in categories:
                fill = hex2rgb(categories[cat_key]["color"])
                txt_col = P["ink"]
                lum = 0.299 * fill[0] + 0.587 * fill[1] + 0.114 * fill[2]
                txt_col = P["ink"] if lum > 140 else P["paper"]
                outline = shade(fill, 0.6)
            else:
                fill = P["ink"]
                txt_col = P["paper"]
                outline = P["ink"]
        else:
            fill = P["chip_bg_off"]
            txt_col = P["muted"]
            outline = P["divider"]

        round_rect(d, (ch_x0, ch_y0, ch_x1, ch_y1),
                   radius=chip_h // 2, fill=fill, outline=outline, width=2)
        d.text((ch_x0 + pad_h, cy - 22), label, fill=txt_col, font=font)
        cur_x = ch_x1 + 22


def render_map(img, x_off, y0, height, pack_dir, categories,
               filter_cat: str = None, ink=None) -> Dict:
    d = ImageDraw.Draw(img)
    d.rectangle((x_off, y0, x_off + PHONE_W, y0 + height), fill=P["cream"])

    meta = json.load(open(pack_dir / "meta.json", encoding="utf-8"))
    manzanas_gj = json.load(open(pack_dir / "manzanas.geojson",
                                 encoding="utf-8"))
    buildings_gj = json.load(open(pack_dir / "buildings.geojson",
                                  encoding="utf-8"))
    roads_gj = json.load(open(pack_dir / "roads.geojson", encoding="utf-8"))
    pois_gj = json.load(open(pack_dir / "pois.geojson", encoding="utf-8"))
    trees_gj = json.load(open(pack_dir / "trees.geojson", encoding="utf-8"))
    parks_gj = None
    try:
        parks_gj = json.load(open(pack_dir / "parks.geojson",
                                  encoding="utf-8"))
    except Exception:
        pass

    pad = 25.0
    bx_min, by_min, bx_max, by_max = meta["bbox_local_m"]
    bbox_xz = box(bx_min - pad, by_min - pad, bx_max + pad, by_max + pad)
    bx0, by0_, bx1, by1_ = bbox_xz.bounds

    margin_x = 30
    margin_top = 30
    margin_bot = 30
    h_max = 16.0
    bw = bx1 - bx0
    bh = by1_ - by0_
    span_w = (bw + bh) * COS30
    span_h = (bw + bh) * SIN30 + h_max * 1.6
    avail_w = PHONE_W - 2 * margin_x
    avail_h = height - margin_top - margin_bot
    sxy = min(avail_w / span_w, avail_h / span_h)
    sz = sxy * 1.6
    mx = (bx0 + bx1) / 2
    my = (by0_ + by1_) / 2
    cx_canvas = x_off + PHONE_W / 2 - (mx - my) * COS30 * sxy
    cy_canvas = y0 + height / 2 - (mx + my) * SIN30 * sxy

    def IS(x_, y_, z_):
        return iso(x_, y_, z_, sxy, sz, cx_canvas, cy_canvas)

    target_pois: List[Tuple[Polygon, Dict]] = []
    if filter_cat:
        for f in pois_gj["features"]:
            if f["properties"].get("category") == filter_cat:
                target_pois.append((shape(f["geometry"]), f))

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
        cat = f["properties"].get("category", "residencial")
        state = None
        if filter_cat is None:
            state = "normal"
        elif cat == filter_cat:
            state = "highlight"
        else:
            for pt, _ in target_pois:
                if poly.distance(pt) < NEAR_POI_RADIUS_M:
                    state = "near"
                    break
            if state is None:
                state = "dim"
        bldg_in.append({
            "id": f["properties"]["id"],
            "ring": [(p[0], p[1]) for p in ring],
            "h": float(f["properties"].get("height_m") or 6.0),
            "category": cat,
            "centroid": (c.x, c.y),
            "bounds": poly.bounds,
            "state": state,
        })

    if parks_gj:
        for f in parks_gj["features"]:
            try:
                poly = shape(f["geometry"])
            except Exception:
                continue
            if not poly.intersects(bbox_xz):
                continue
            poly = poly.intersection(bbox_xz)
            geoms = [poly] if poly.geom_type == "Polygon" else list(
                getattr(poly, "geoms", []))
            for gp in geoms:
                if gp.geom_type != "Polygon":
                    continue
                ring = list(gp.exterior.coords)
                pts = [IS(x_, 0, z_) for x_, z_ in ring]
                if len(pts) >= 3:
                    park_col = hex2rgb(categories.get("parque", {}).get(
                        "color", "#A8C28A"))
                    if filter_cat:
                        park_col = shade(park_col, 0.55)
                        park_col = tuple(int(0.55 * c + 0.45 * cr)
                                         for c, cr in zip(park_col,
                                                          P["cream"]))
                    d.polygon(pts, fill=park_col,
                              outline=shade(park_col, 0.8))

    for f in manzanas_gj["features"]:
        gp = shape(f["geometry"])
        if not gp.intersects(bbox_xz):
            continue
        ring = list(gp.exterior.coords)
        pts = [IS(x_, 0, z_) for x_, z_ in ring]
        if len(pts) >= 3:
            if filter_cat:
                fill = tuple(int(0.7 * c + 0.3 * cr)
                             for c, cr in zip(P["sand_lt"], P["cream"]))
                outline = shade(P["sand"], 0.85)
            else:
                fill = P["sand_lt"]
                outline = P["sand"]
            d.polygon(pts, fill=fill, outline=outline)

    sorted_roads = []
    for f in roads_gj["features"]:
        coords = f["geometry"]["coordinates"]
        try:
            line = LineString(coords)
        except Exception:
            continue
        if not line.intersects(bbox_xz):
            continue
        clipped = line.intersection(bbox_xz)
        if clipped.is_empty:
            continue
        rtype = f["properties"].get("type", "service")
        if clipped.geom_type == "LineString":
            sorted_roads.append((rtype, list(clipped.coords)))
        elif clipped.geom_type == "MultiLineString":
            for g in clipped.geoms:
                sorted_roads.append((rtype, list(g.coords)))
        elif clipped.geom_type == "GeometryCollection":
            for g in clipped.geoms:
                if g.geom_type == "LineString":
                    sorted_roads.append((rtype, list(g.coords)))

    sorted_roads.sort(key=lambda r: ROAD_TYPE_IMPORTANCE.get(r[0], 0))
    for rtype, coords in sorted_roads:
        col_key, w = ROAD_TYPE_STYLE.get(rtype, ("sand_lt", 1))
        col = P[col_key]
        if filter_cat:
            col = tuple(int(0.55 * c + 0.45 * cr)
                        for c, cr in zip(col, P["cream"]))
        pts = [IS(x_, 0, z_) for x_, z_ in coords]
        if len(pts) >= 2:
            d.line(pts, fill=col, width=max(1, w - 1))

    if filter_cat:
        glow_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
        gd = ImageDraw.Draw(glow_layer)
        glow_col = hex2rgb(categories.get(filter_cat, {}).get(
            "color", "#4FE69F"))
        for b in bldg_in:
            if b["state"] != "highlight":
                continue
            ring = b["ring"]
            pts = [IS(x_, 0, z_) for x_, z_ in ring]
            for w in [40, 28, 16, 8]:
                gd.line(pts + [pts[0]], fill=glow_col + (50,), width=w)
        glow_blur = glow_layer.filter(ImageFilter.GaussianBlur(radius=14))
        img.alpha_composite(glow_blur)
        d = ImageDraw.Draw(img)

    order = sorted(range(len(bldg_in)),
                   key=lambda i: bldg_in[i]["bounds"][0]
                   + bldg_in[i]["bounds"][1])

    bldg_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    bd = ImageDraw.Draw(bldg_layer)

    n_highlight = 0
    n_near = 0
    n_dim = 0

    for i in order:
        b = bldg_in[i]
        cat = b["category"]
        state = b["state"]
        if state == "normal":
            base = hex2rgb(categories.get(cat, {}).get("color", "#C8B898"))
            alpha = 255
            ink_for = P["ink"]
            lift = 0.0
            outline_w = 1
        elif state == "highlight":
            n_highlight += 1
            base = hex2rgb(categories.get(filter_cat, {}).get(
                "color", "#4FE69F"))
            alpha = 255
            ink_for = P["ink"]
            lift = LIFT_HIGHLIGHT_M
            outline_w = 2
        elif state == "near":
            n_near += 1
            sat = hex2rgb(categories.get(filter_cat, {}).get(
                "color", "#4FE69F"))
            base = tuple(int(0.55 * c + 0.45 * 152) for c in sat)
            alpha = 220
            ink_for = shade(sat, 0.45)
            lift = 0.0
            outline_w = 2
        else:
            n_dim += 1
            base = P["dim_bldg"]
            alpha = 178
            ink_for = P["dim_bldg_outline"]
            lift = 0.0
            outline_w = 1

        top_col = base
        left = shade(base, 0.78)
        right = shade(base, 0.92)

        ring_xz = b["ring"]
        if len(ring_xz) >= 2 and ring_xz[0] == ring_xz[-1]:
            ring_xz = ring_xz[:-1]
        n = len(ring_xz)
        if n < 3:
            continue
        bot = [IS(x_, 0 + lift, z_) for x_, z_ in ring_xz]
        top_pts = [IS(x_, b["h"] + lift, z_) for x_, z_ in ring_xz]

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
                       outline=ink_for + (alpha,), width=outline_w)
        bd.polygon(top_pts, fill=top_col + (alpha,),
                   outline=ink_for + (alpha,), width=outline_w)
    img.alpha_composite(bldg_layer)
    d = ImageDraw.Draw(img)

    if filter_cat is None:
        for f in pois_gj["features"]:
            x_, z_ = f["geometry"]["coordinates"]
            if not bbox_xz.contains(Point(x_, z_)):
                continue
            cat = f["properties"].get("category", "comercio")
            col_hex = categories.get(cat, {}).get("color", "#888888")
            pt = IS(x_, 0.05, z_)
            r = 6
            d.ellipse((pt[0] - r, pt[1] - r, pt[0] + r, pt[1] + r),
                      fill=hex2rgb(col_hex), outline=P["ink"], width=1)
    else:
        glow_col = hex2rgb(categories.get(filter_cat, {}).get(
            "color", "#4FE69F"))
        halo_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
        hd = ImageDraw.Draw(halo_layer)
        for poly_pt, f in target_pois:
            x_, z_ = poly_pt.x, poly_pt.y
            if not bbox_xz.contains(Point(x_, z_)):
                continue
            pt = IS(x_, 1.0, z_)
            for r in [38, 26, 16]:
                hd.ellipse((pt[0] - r, pt[1] - r, pt[0] + r, pt[1] + r),
                           fill=glow_col + (60,))
        halo_blur = halo_layer.filter(ImageFilter.GaussianBlur(radius=8))
        img.alpha_composite(halo_blur)
        d = ImageDraw.Draw(img)
        for poly_pt, f in target_pois:
            x_, z_ = poly_pt.x, poly_pt.y
            if not bbox_xz.contains(Point(x_, z_)):
                continue
            pt = IS(x_, 1.0, z_)
            r = 14
            d.ellipse((pt[0] - r, pt[1] - r, pt[0] + r, pt[1] + r),
                      fill=glow_col, outline=P["ink"], width=2)
            d.ellipse((pt[0] - 4, pt[1] - 4, pt[0] + 4, pt[1] + 4),
                      fill=P["paper"])

    return {
        "n_highlight": n_highlight,
        "n_near": n_near,
        "n_dim": n_dim,
        "n_bldg_total": len(bldg_in),
        "n_pois_filter": len(target_pois),
    }


def draw_bottom_sheet_no_filter(img, x_off, y0, height, ink, n_buildings,
                                n_pois):
    d = ImageDraw.Draw(img)
    f = fonts()
    sheet_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sheet_layer)
    radius = 60
    sd.rounded_rectangle((x_off, y0, x_off + PHONE_W, y0 + height + radius),
                         radius=radius, fill=P["sheet_bg"] + (255,))
    img.alpha_composite(sheet_layer)
    d = ImageDraw.Draw(img)

    handle_w, handle_h = 132, 14
    hx0 = x_off + (PHONE_W - handle_w) // 2
    hy0 = y0 + 28
    round_rect(d, (hx0, hy0, hx0 + handle_w, hy0 + handle_h),
               radius=7, fill=P["divider"])

    pad_x = 60
    cur_y = y0 + 70
    title = "Sección Las Canteras 052"
    d.text((pad_x + x_off, cur_y), title, fill=ink, font=f["title"])
    cur_y += 70

    sub = f"{n_buildings} edificios  ·  {n_pois} negocios"
    d.text((pad_x + x_off, cur_y), sub, fill=P["muted"], font=f["subtitle"])
    cur_y += 60

    stat_items = [
        ("345", "viviendas"),
        (f"{n_pois}", "POIs"),
        ("154", "árboles"),
        ("47", "manzanas"),
    ]
    chip_gap = 22
    chip_w = (PHONE_W - 2 * pad_x - 3 * chip_gap) // 4
    chip_h = 110
    for i, (num, lbl) in enumerate(stat_items):
        cx0 = x_off + pad_x + i * (chip_w + chip_gap)
        cy0 = cur_y
        round_rect(d, (cx0, cy0, cx0 + chip_w, cy0 + chip_h),
                   radius=24, fill=P["chip_bg"], outline=P["divider"], width=2)
        nw = text_w(d, num, f["row_title"])
        d.text((cx0 + (chip_w - nw) // 2, cy0 + 18),
               num, fill=ink, font=f["row_title"])
        lw = text_w(d, lbl, f["small"])
        d.text((cx0 + (chip_w - lw) // 2, cy0 + 64),
               lbl, fill=P["muted"], font=f["small"])


def draw_bottom_sheet_filter(img, x_off, y0, height, ink, categories,
                             filter_cat, pack_dir):
    d = ImageDraw.Draw(img)
    f = fonts()

    sheet_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sheet_layer)
    radius = 60
    sd.rounded_rectangle((x_off, y0, x_off + PHONE_W, y0 + height + radius),
                         radius=radius, fill=P["sheet_bg"] + (255,))
    img.alpha_composite(sheet_layer)
    d = ImageDraw.Draw(img)

    handle_w, handle_h = 132, 14
    hx0 = x_off + (PHONE_W - handle_w) // 2
    hy0 = y0 + 28
    round_rect(d, (hx0, hy0, hx0 + handle_w, hy0 + handle_h),
               radius=7, fill=P["divider"])

    pois_gj = json.load(open(pack_dir / "pois.geojson", encoding="utf-8"))
    inside = []
    for pf in pois_gj["features"]:
        if pf["properties"].get("category") != filter_cat:
            continue
        pt = shape(pf["geometry"])
        inside.append((pf, pt))

    rows = [(pf, False) for pf, _ in inside[:3]]

    pad_x = 60
    cur_y = y0 + 80

    n_results = len(inside)
    title = f"{n_results} resultados en zona"
    d.text((x_off + pad_x, cur_y), title, fill=ink, font=f["title"])
    cur_y += 60
    cat_hex = categories.get(filter_cat, {}).get("color", "#4FE69F")
    sub = f"Filtro activo: {filter_cat}"
    d.text((x_off + pad_x, cur_y), sub, fill=hex2rgb(cat_hex),
           font=f["subtitle"])
    cur_y += 60

    row_h = 90
    for pf, is_near in rows:
        name = pf["properties"].get("name") or "(sin nombre)"
        if not name.strip():
            name = "(sin nombre)"
        if len(name) > 36:
            name = name[:34] + "…"
        cy_row = cur_y + row_h // 2
        cx0 = x_off + pad_x
        d.ellipse((cx0, cy_row - 26, cx0 + 52, cy_row + 26),
                  fill=hex2rgb(cat_hex), outline=P["ink"], width=2)
        d.line([(cx0 + 26, cy_row - 12), (cx0 + 26, cy_row + 12)],
               fill=P["paper"], width=4)
        d.line([(cx0 + 14, cy_row), (cx0 + 38, cy_row)],
               fill=P["paper"], width=4)
        title_x = cx0 + 76
        d.text((title_x, cy_row - 28),
               name, fill=ink, font=f["row_title"])
        sub_lbl = "Las Canteras"
        if is_near:
            sub_lbl += "  ·  (en zona)"
        d.text((title_x, cy_row + 4),
               sub_lbl, fill=P["muted"], font=f["row_sub"])
        chx = x_off + PHONE_W - pad_x - 30
        d.line([(chx, cy_row - 14), (chx + 14, cy_row),
                (chx, cy_row + 14)], fill=P["muted"], width=4)
        cur_y += row_h


def draw_phone_frame(img, x_off):
    d = ImageDraw.Draw(img)
    radius = 110
    d.rounded_rectangle((x_off + 4, 4, x_off + PHONE_W - 4, PHONE_H - 4),
                        radius=radius, outline=P["ink"], width=8)


def render_filter_mockup(cusec: str, category: str, pack_dir: pathlib.Path,
                         out_path: pathlib.Path) -> Dict:
    meta = json.load(open(pack_dir / "meta.json", encoding="utf-8"))
    categories = meta["categories"]
    if category not in categories:
        raise SystemExit(f"categoría {category} no en meta.json")

    canvas = Image.new("RGBA", (CANVAS_W, CANVAS_H), P["paper"] + (255,))
    d = ImageDraw.Draw(canvas)
    f = fonts()

    label_a = "A  ·  sin filtro"
    label_b = f"B  ·  filtro {category.capitalize()} activo"
    lw_a = text_w(d, label_a, f["label_top"])
    lw_b = text_w(d, label_b, f["label_top"])
    d.text((PHONE_W // 2 - lw_a // 2, 38), label_a,
           fill=P["muted"], font=f["label_top"])
    d.text((PHONE_W + GAP + PHONE_W // 2 - lw_b // 2, 38), label_b,
           fill=P["muted"], font=f["label_top"])

    phone_a = Image.new("RGBA", (PHONE_W, PHONE_H), P["paper"] + (255,))
    phone_b = Image.new("RGBA", (PHONE_W, PHONE_H), P["paper"] + (255,))

    ink = P["ink"]

    draw_status_bar(phone_a, 0, 0, ink, P["paper_dim"])
    draw_search_bar(phone_a, 0, STATUS_BAR_H, ink, P["paper"])
    draw_chips(phone_a, 0, STATUS_BAR_H + SEARCH_BAR_H, ink, "todos",
               categories)
    map_y_a = STATUS_BAR_H + SEARCH_BAR_H + CHIPS_H
    map_meta_a = render_map(phone_a, 0, map_y_a, MAP_H, pack_dir, categories,
                            filter_cat=None, ink=ink)
    sheet_y = map_y_a + MAP_H
    pois_gj = json.load(open(pack_dir / "pois.geojson", encoding="utf-8"))
    n_pois_total = len(pois_gj["features"])
    draw_bottom_sheet_no_filter(phone_a, 0, sheet_y, SHEET_PEEK_H, ink,
                                n_buildings=meta["building_count"],
                                n_pois=n_pois_total)
    draw_home_indicator(phone_a, 0, PHONE_H, ink)
    draw_phone_frame(phone_a, 0)

    draw_status_bar(phone_b, 0, 0, ink, P["paper_dim"])
    draw_search_bar(phone_b, 0, STATUS_BAR_H, ink, P["paper"],
                    typed_text=category, show_cursor=True)
    draw_chips(phone_b, 0, STATUS_BAR_H + SEARCH_BAR_H, ink, category,
               categories)
    map_y_b = STATUS_BAR_H + SEARCH_BAR_H + CHIPS_H
    map_meta_b = render_map(phone_b, 0, map_y_b, MAP_H, pack_dir, categories,
                            filter_cat=category, ink=ink)
    sheet_y_b = map_y_b + MAP_H
    draw_bottom_sheet_filter(phone_b, 0, sheet_y_b, SHEET_PEEK_H, ink,
                             categories, category, pack_dir)
    draw_home_indicator(phone_b, 0, PHONE_H, ink)
    draw_phone_frame(phone_b, 0)

    canvas.alpha_composite(phone_a, (0, LABEL_TOP_H))
    canvas.alpha_composite(phone_b, (PHONE_W + GAP, LABEL_TOP_H))

    d = ImageDraw.Draw(canvas)
    arrow_y = LABEL_TOP_H + PHONE_H // 2
    arrow_text = f"el usuario tipea '{category}' →"
    aw = text_w(d, arrow_text, f["arrow"])
    sep_x = PHONE_W + GAP // 2
    d.line([(sep_x, LABEL_TOP_H + 100),
            (sep_x, LABEL_TOP_H + PHONE_H - 100)],
           fill=P["arrow_ocre"] + (140,) if False else P["arrow_ocre"],
           width=2)
    box_pad = 16
    box_w = aw + 2 * box_pad
    box_h = 60
    box_x0 = sep_x - box_w // 2
    box_y0 = arrow_y - box_h // 2
    round_rect(d, (box_x0, box_y0, box_x0 + box_w, box_y0 + box_h),
               radius=14, fill=P["paper"], outline=P["arrow_ocre"], width=3)
    d.text((box_x0 + box_pad, box_y0 + 16),
           arrow_text, fill=P["arrow_ocre"], font=f["arrow"])

    out_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(out_path, "PNG", optimize=True)

    return {
        "out_path": out_path,
        "category": category,
        "n_pois_filter": map_meta_b["n_pois_filter"],
        "n_highlight_bldg": map_meta_b["n_highlight"],
        "n_near_bldg": map_meta_b["n_near"],
        "n_dim_bldg": map_meta_b["n_dim"],
        "n_bldg_total": map_meta_b["n_bldg_total"],
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cusec", help="Código de sección censal (10 dígitos)")
    ap.add_argument("category", help="Categoría a filtrar (ej: salud)")
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
                    / f"{args.cusec}_filter_{args.category}.png")
    if not out_path.is_absolute():
        out_path = ROOT / out_path

    res = render_filter_mockup(args.cusec, args.category, pack_dir, out_path)
    print(f"OK -> {res['out_path']}")
    print(f"  categoría:                 {res['category']}")
    print(f"  POIs de filtro:            {res['n_pois_filter']}")
    print(f"  edificios brillantes:      {res['n_highlight_bldg']}")
    print(f"  edificios cerca:           {res['n_near_bldg']}")
    print(f"  edificios apagados:        {res['n_dim_bldg']}")
    print(f"  edificios totales:         {res['n_bldg_total']}")


if __name__ == "__main__":
    main()
