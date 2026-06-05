"""KOINOS · POLIS — Mockup móvil con TRES eventos vivos sobre la sección.

Genera UN PNG (1170x2532, iPhone) que muestra tres eventos sobre el cluster
de manzanas, con bottom sheet abierta sobre el evento seleccionado y tab
navigator inferior.

Uso:
    python3 -m packages.mockups.events 3501602052
    python3 -m packages.mockups.events 3501602052 --out path.png
"""
from __future__ import annotations

import argparse
import json
import math
import pathlib
import sys
from typing import Dict, List, Tuple

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

TOP_BAR_H = 132
TAB_BAR_H = 156
USABLE_H = H - STATUS_BAR_H - TOP_BAR_H - TAB_BAR_H - HOME_INDICATOR_H
MAP_H = int(USABLE_H * 0.40)
SHEET_H = USABLE_H - MAP_H + HOME_INDICATOR_H

P = dict(PALETTE)
P["paper_dim"] = tuple(int(c * 0.94) for c in P["paper"])
P["sheet_bg"] = P["paper"]
P["chip_bg"] = P["sand_lt"]
P["divider"] = (210, 200, 178)
P["muted"] = (118, 108, 90)
P["btn_dark_ocre"] = hex2rgb("#8A5A2A")
P["accent_glow"] = (200, 84, 56)

CAT_CULTURA = "#9F4FE6"
CAT_COMUNIDAD = "#E68A4F"
CAT_EDUCACION = "#4F8AE6"

EVENTS = [
    {
        "key": "A",
        "title": "Concierto OFGC · Mahler Sinfonía 5",
        "category_l1": "Cultura",
        "category_l2": "Música",
        "color_hex": CAT_CULTURA,
        "venue": "Auditorio Alfredo Kraus",
        "when_label": "20:30",
        "when_full": "Hoy · 20:30",
        "access": "Entrada 18-45 €",
        "desc": ("Sinfonía nº5 de Gustav Mahler. Director: Karel Mark "
                 "Chichon. Programa de cierre de temporada."),
        "source": "auditorio-alfredokraus.org · publicado hace 3 días",
        "manzana_id": 13,
        "building_id": 84,
        "world_xz": (-180.15, 107.04),
        "lift_m": 16.0,
    },
    {
        "key": "B",
        "title": "Asamblea vecinal Las Canteras",
        "category_l1": "Comunidad",
        "category_l2": "Asamblea",
        "color_hex": CAT_COMUNIDAD,
        "venue": "Local AAVV Las Canteras",
        "when_label": "Mañ 19h",
        "when_full": "Mañana · 19:00",
        "access": "Acceso libre",
        "desc": ("Debate sobre la peatonalización de la avenida. "
                 "Convoca la federación de asociaciones del barrio."),
        "source": "lascanteras-aavv.org · publicado ayer",
        "manzana_id": 39,
        "building_id": 123,
        "world_xz": (101.17, 5.07),
        "lift_m": 14.0,
    },
    {
        "key": "C",
        "title": "Taller de cocina canaria",
        "category_l1": "Educación",
        "category_l2": "Taller",
        "color_hex": CAT_EDUCACION,
        "venue": "Cocina vecinal · Las Canteras",
        "when_label": "Sáb 11h",
        "when_full": "Sábado · 11:00",
        "access": "Inscripción previa",
        "desc": ("Ronda de trompos y queso de flor. Plazas limitadas, "
                 "incluye degustación."),
        "source": "tallerescanarios.es · publicado hace 5 días",
        "manzana_id": 38,
        "building_id": 314,
        "world_xz": (63.39, -104.37),
        "lift_m": 14.0,
    },
]
SELECTED_KEY = "A"


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
    base["pin_lbl"] = _try(sans_b, 9 * s)
    base["sheet_title"] = _try(serif_b, 22 * s)
    base["ribbon"] = _try(sans_b, 10 * s)
    base["body"] = _try(sans_r, 12 * s)
    base["meta_lbl"] = _try(sans_r, 11 * s)
    base["btn_b"] = _try(sans_b, 13 * s)
    base["tabnav_b"] = _try(sans_b, 10 * s)
    base["tabnav_r"] = _try(sans_r, 10 * s)
    base["badge"] = _try(sans_b, 9 * s)
    base["foot"] = _try(sans_r, 8 * s)
    return base


def draw_top_bar(img: Image.Image, y0: int, ink, paper):
    d = ImageDraw.Draw(img)
    d.rectangle((0, y0, W, y0 + TOP_BAR_H), fill=paper)
    d.rectangle((0, y0 + TOP_BAR_H - 2, W, y0 + TOP_BAR_H), fill=P["divider"])
    f = fonts()
    cy = y0 + TOP_BAR_H // 2
    bx = 60
    d.line([(bx + 22, cy - 22), (bx, cy), (bx + 22, cy + 22)],
           fill=ink, width=6)
    crumb = "Las Palmas  >  Las Canteras  >  Sec 052"
    cw = text_w(d, crumb, f["crumb"])
    d.text(((W - cw) // 2, cy - 22), crumb,
           fill=P["muted"], font=f["crumb"])
    sx = W - 80
    d.polygon([(sx - 22, cy - 6), (sx - 22, cy - 18),
               (sx + 22, cy - 18), (sx + 22, cy - 6),
               (sx + 32, cy + 6), (sx - 32, cy + 6)],
              fill=ink)
    d.rectangle((sx - 6, cy + 6, sx + 6, cy + 14), fill=ink)
    d.ellipse((sx + 16, cy - 30, sx + 36, cy - 10),
              fill=P["accent_glow"], outline=P["paper"], width=3)


def draw_tab_nav(img: Image.Image, y0: int, ink):
    d = ImageDraw.Draw(img)
    f = fonts()
    d.rectangle((0, y0, W, y0 + TAB_BAR_H), fill=P["paper"])
    d.rectangle((0, y0, W, y0 + 3), fill=P["divider"])

    tabs = [
        ("Mapa", True, "map"),
        ("Eventos", False, "events"),
        ("Avisos", False, "bell"),
        ("Mi portal", False, "user"),
    ]
    n = len(tabs)
    seg_w = W // n
    for i, (label, active, kind) in enumerate(tabs):
        cx = i * seg_w + seg_w // 2
        cy = y0 + 50
        col = ink if active else P["muted"]
        if kind == "map":
            d.polygon([(cx - 24, cy + 4), (cx, cy - 18),
                       (cx + 24, cy + 4), (cx, cy + 22)],
                      outline=col, width=4)
            d.line([(cx - 12, cy + 12), (cx + 12, cy - 4)],
                   fill=col, width=4)
        elif kind == "events":
            d.rectangle((cx - 22, cy - 18, cx + 22, cy + 22),
                        outline=col, width=4)
            d.line([(cx - 22, cy - 6), (cx + 22, cy - 6)],
                   fill=col, width=3)
            d.ellipse((cx - 6, cy + 6, cx + 6, cy + 18), fill=col)
        elif kind == "bell":
            d.polygon([(cx - 20, cy + 4), (cx - 20, cy - 12),
                       (cx + 20, cy - 12), (cx + 20, cy + 4),
                       (cx + 28, cy + 12), (cx - 28, cy + 12)],
                      outline=col, width=4)
            d.line([(cx - 4, cy + 14), (cx + 4, cy + 14)],
                   fill=col, width=5)
        elif kind == "user":
            d.ellipse((cx - 14, cy - 22, cx + 14, cy + 6),
                      outline=col, width=4)
            d.arc((cx - 24, cy + 0, cx + 24, cy + 36),
                  start=200, end=340, fill=col, width=4)
        font = f["tabnav_b"] if active else f["tabnav_r"]
        tw = text_w(d, label, font)
        d.text((cx - tw // 2, y0 + TAB_BAR_H - 50),
               label, fill=col, font=font)
        if active:
            d.rectangle((cx - 36, y0 + TAB_BAR_H - 8,
                         cx + 36, y0 + TAB_BAR_H - 2),
                        fill=P["accent_glow"])
        if kind == "events":
            bx0 = cx + 18
            by0 = cy - 30
            round_rect(d, (bx0, by0, bx0 + 38, by0 + 38),
                       radius=19, fill=P["accent_glow"], outline=P["paper"],
                       width=3)
            tw = text_w(d, "3", f["badge"])
            d.text((bx0 + (38 - tw) // 2, by0 + 8),
                   "3", fill=P["paper"], font=f["badge"])


def render_events_map(img: Image.Image, y0: int, height: int,
                      pack_dir: pathlib.Path, target_ids: List[int],
                      categories: Dict, ink) -> Dict:
    d = ImageDraw.Draw(img)
    d.rectangle((0, y0, W, y0 + height), fill=P["cream"])

    manz_gj = json.load(open(pack_dir / "manzanas.geojson", encoding="utf-8"))
    bldg_gj = json.load(open(pack_dir / "buildings.geojson", encoding="utf-8"))
    roads_gj = json.load(open(pack_dir / "roads.geojson", encoding="utf-8"))

    manz: Dict[int, Polygon] = {}
    for f in manz_gj["features"]:
        manz[f["properties"]["id"]] = shape(f["geometry"])

    cluster = [manz[i] for i in target_ids if i in manz]
    union = cluster[0]
    for p in cluster[1:]:
        union = union.union(p)

    pad = 14.0
    minx, miny, maxx, maxy = union.bounds
    bbox_xz = box(minx - pad, miny - pad, maxx + pad, maxy + pad)
    bx0, by0_, bx1, by1_ = bbox_xz.bounds

    margin_x = 60
    margin_top = 30
    margin_bot = 30
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

    def IS(x_, y_, z_):
        return iso(x_, y_, z_, sxy, sz, cx_canvas, cy_canvas)

    union_dil = union.buffer(3.0)
    bldg_in: List[Dict] = []
    for f in bldg_gj["features"]:
        ring = f["geometry"]["coordinates"][0]
        try:
            poly = Polygon(ring)
        except Exception:
            continue
        if not poly.is_valid or poly.is_empty:
            continue
        if not poly.intersects(union_dil):
            continue
        c = poly.centroid
        if not union_dil.contains(c):
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
            roads_in.append((rtype, list(clipped.coords)))
        elif clipped.geom_type == "MultiLineString":
            for g in clipped.geoms:
                roads_in.append((rtype, list(g.coords)))
        elif clipped.geom_type == "GeometryCollection":
            for g in clipped.geoms:
                if g.geom_type == "LineString":
                    roads_in.append((rtype, list(g.coords)))

    floor_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    fd = ImageDraw.Draw(floor_layer)
    for poly in cluster:
        ring = list(poly.exterior.coords)
        pts = [IS(x_, 0, z_) for x_, z_ in ring]
        if len(pts) >= 3:
            fd.polygon(pts, fill=P["sand_lt"] + (255,),
                       outline=P["sand"] + (255,))
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

    order = sorted(range(len(bldg_in)),
                   key=lambda i: bldg_in[i]["bounds"][0]
                   + bldg_in[i]["bounds"][1])
    bldg_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    bd = ImageDraw.Draw(bldg_layer)
    for i in order:
        b = bldg_in[i]
        cat = b["category"]
        col_hex = categories.get(cat, {}).get("color", "#C8B898")
        base = hex2rgb(col_hex)
        top_col = base
        left = shade(base, 0.78)
        right = shade(base, 0.92)
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
            face = right if tilt > 0 else left
            bd.polygon([bot[k], bot[(k + 1) % n],
                        top_pts[(k + 1) % n], top_pts[k]],
                       fill=face + (255,),
                       outline=ink + (255,), width=2)
        bd.polygon(top_pts, fill=top_col + (255,),
                   outline=ink + (255,), width=2)
    img.alpha_composite(bldg_layer)
    d = ImageDraw.Draw(img)

    return {"IS": IS, "bldg_in": bldg_in}


def draw_event_pin(img: Image.Image, anchor_xy: Tuple[int, int],
                   color_hex: str, label_text: str, ink, selected: bool):
    d = ImageDraw.Draw(img)
    f = fonts()
    color = hex2rgb(color_hex)
    ax, ay = anchor_xy
    head_r = 40
    head_cx = ax
    head_cy = ay - 130
    sh_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh_layer)
    sd.ellipse((head_cx - head_r - 4, head_cy - head_r + 6,
                head_cx + head_r + 4, head_cy + head_r + 12),
               fill=(20, 16, 12, 110))
    sh_blur = sh_layer.filter(ImageFilter.GaussianBlur(radius=8))
    img.alpha_composite(sh_blur)
    d = ImageDraw.Draw(img)

    tip_w = 22
    d.polygon([
        (head_cx - tip_w, head_cy + head_r - 4),
        (head_cx + tip_w, head_cy + head_r - 4),
        (head_cx, ay - 8),
    ], fill=color, outline=ink, width=3)

    d.ellipse((head_cx - head_r, head_cy - head_r,
               head_cx + head_r, head_cy + head_r),
              fill=color, outline=ink, width=4 if selected else 3)
    if selected:
        d.ellipse((head_cx - head_r - 8, head_cy - head_r - 8,
                   head_cx + head_r + 8, head_cy + head_r + 8),
                  outline=P["accent_glow"], width=4)

    lbl = label_text
    lw = text_w(d, lbl, f["pin_lbl"])
    pad_lbl = 14
    cap_w = lw + 2 * pad_lbl
    cap_h = 42
    cap_x0 = head_cx - cap_w // 2
    cap_y0 = head_cy - head_r - cap_h - 8
    round_rect(d, (cap_x0, cap_y0, cap_x0 + cap_w, cap_y0 + cap_h),
               radius=cap_h // 2, fill=ink, outline=color, width=3)
    d.text((cap_x0 + pad_lbl, cap_y0 + 11),
           lbl, fill=P["paper"], font=f["pin_lbl"])

    d.ellipse((ax - 8, ay - 8, ax + 8, ay + 8),
              fill=color, outline=ink, width=2)


def draw_event_sheet(img: Image.Image, y0: int, height: int, evt: Dict, ink):
    d = ImageDraw.Draw(img)
    f = fonts()

    sheet_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sheet_layer)
    radius = 84
    shadow_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    shd = ImageDraw.Draw(shadow_layer)
    shd.rounded_rectangle((0 - 6, y0 - 18, W + 6, y0 + height),
                          radius=radius + 6, fill=(0, 0, 0, 80))
    shadow_blur = shadow_layer.filter(ImageFilter.GaussianBlur(radius=18))
    img.alpha_composite(shadow_blur)

    sd.rounded_rectangle((0, y0, W, y0 + height),
                         radius=radius, fill=P["sheet_bg"] + (255,))
    sd.rectangle((0, y0 + radius, W, y0 + height),
                 fill=P["sheet_bg"] + (255,))
    img.alpha_composite(sheet_layer)
    d = ImageDraw.Draw(img)

    handle_w, handle_h = 132, 14
    hx0 = (W - handle_w) // 2
    hy0 = y0 + 28
    round_rect(d, (hx0, hy0, hx0 + handle_w, hy0 + handle_h),
               radius=7, fill=P["divider"])

    pad_x = 60
    cur_y = y0 + 78

    color = hex2rgb(evt["color_hex"])
    color_dk = shade(color, 0.55)

    ribbon_label = f"{evt['category_l1']} · {evt['category_l2']}".upper()
    rw = text_w(d, ribbon_label, f["ribbon"])
    rb_w = rw + 36
    rb_h = 46
    round_rect(d, (pad_x, cur_y, pad_x + rb_w, cur_y + rb_h),
               radius=rb_h // 2, fill=color, outline=ink, width=2)
    d.text((pad_x + 18, cur_y + 11),
           ribbon_label, fill=P["paper"], font=f["ribbon"])
    cur_y += rb_h + 28

    photo_size = 240
    photo_x0 = pad_x
    photo_y0 = cur_y
    photo_x1 = photo_x0 + photo_size
    photo_y1 = photo_y0 + photo_size
    round_rect(d, (photo_x0, photo_y0, photo_x1, photo_y1),
               radius=24, fill=color_dk, outline=ink, width=3)
    cx = (photo_x0 + photo_x1) // 2
    cy = (photo_y0 + photo_y1) // 2
    head_r = 22
    d.ellipse((cx - 50 - head_r, cy + 24 - head_r,
               cx - 50 + head_r, cy + 24 + head_r), fill=P["paper"])
    d.ellipse((cx + 22 - head_r, cy + 36 - head_r,
               cx + 22 + head_r, cy + 36 + head_r), fill=P["paper"])
    d.line([(cx - 50 + head_r, cy + 24),
            (cx - 50 + head_r, cy - 60)], fill=P["paper"], width=6)
    d.line([(cx + 22 + head_r, cy + 36),
            (cx + 22 + head_r, cy - 48)], fill=P["paper"], width=6)
    d.line([(cx - 50 + head_r, cy - 60),
            (cx + 22 + head_r, cy - 48)], fill=P["paper"], width=8)
    d.line([(cx - 50 + head_r, cy - 38),
            (cx + 22 + head_r, cy - 26)], fill=P["paper"], width=6)

    title = evt["title"]
    title_x = photo_x1 + 30
    title_y = photo_y0 + 6
    avail_w = W - title_x - pad_x
    fnt_t = f["sheet_title"]
    parts = title.split(" · ")
    if len(parts) == 2:
        line1, line2 = parts[0], "· " + parts[1]
    else:
        line1, line2 = title, ""
    d.text((title_x, title_y), line1, fill=ink, font=fnt_t)
    if line2:
        d.text((title_x, title_y + 78), line2, fill=ink, font=fnt_t)

    meta_y = photo_y0 + 170
    meta_line1 = f"{evt['when_full']}  ·  {evt['venue']}"
    d.text((title_x, meta_y), meta_line1,
           fill=P["muted"], font=f["meta_lbl"])
    meta_y += 38
    d.text((title_x, meta_y), evt["access"],
           fill=color_dk, font=f["meta_lbl"])

    cur_y = photo_y1 + 36

    desc = evt["desc"]
    avail_w_full = W - 2 * pad_x
    words = desc.split()
    lines = []
    cur = ""
    for wd in words:
        cand = (cur + " " + wd).strip()
        if text_w(d, cand, f["body"]) <= avail_w_full:
            cur = cand
        else:
            lines.append(cur)
            cur = wd
    if cur:
        lines.append(cur)
    for ln in lines[:3]:
        d.text((pad_x, cur_y), ln, fill=ink, font=f["body"])
        cur_y += 46

    cur_y += 24

    btn_h = 130
    primary_w = 480
    btn_y0 = cur_y
    btn_y1 = btn_y0 + btn_h
    round_rect(d, (pad_x, btn_y0, pad_x + primary_w, btn_y1),
               radius=btn_h // 2, fill=P["btn_dark_ocre"])
    txt = "Quiero ir"
    tw = text_w(d, txt, f["btn_b"])
    d.text((pad_x + (primary_w - tw) // 2, btn_y0 + 44),
           txt, fill=P["paper"], font=f["btn_b"])

    sec_x0 = pad_x + primary_w + 24
    sec_x1 = W - pad_x
    round_rect(d, (sec_x0, btn_y0, sec_x1, btn_y1),
               radius=btn_h // 2, fill=P["paper"], outline=ink, width=4)
    txt2 = "Notificarme"
    tw2 = text_w(d, txt2, f["btn_b"])
    d.text((sec_x0 + (sec_x1 - sec_x0 - tw2) // 2, btn_y0 + 44),
           txt2, fill=ink, font=f["btn_b"])

    cur_y = btn_y1 + 28

    share = "Compartir con vecinos"
    sw = text_w(d, share, f["meta_lbl"])
    d.text((pad_x + (primary_w - sw) // 2, cur_y),
           share, fill=color_dk, font=f["meta_lbl"])
    d.line([(pad_x + (primary_w - sw) // 2, cur_y + 32),
            (pad_x + (primary_w - sw) // 2 + sw, cur_y + 32)],
           fill=color_dk, width=2)
    cur_y += 64

    foot = f"Fuente: {evt['source']}"
    d.text((pad_x, y0 + height - HOME_INDICATOR_H - 60),
           foot, fill=P["muted"], font=f["foot"])


def render_events_mockup(cusec: str, pack_dir: pathlib.Path,
                         out_path: pathlib.Path) -> Dict:
    meta = json.load(open(pack_dir / "meta.json", encoding="utf-8"))
    categories = meta["categories"]

    img = Image.new("RGBA", (W, H), P["paper"] + (255,))
    ink = P["ink"]

    draw_status_bar(img, top_y=0, ink=ink, paper=P["paper_dim"])

    top_y = STATUS_BAR_H
    draw_top_bar(img, y0=top_y, ink=ink, paper=P["paper"])

    map_y = top_y + TOP_BAR_H
    target_ids = [13, 24, 38, 39]
    map_meta = render_events_map(img, y0=map_y, height=MAP_H,
                                 pack_dir=pack_dir,
                                 target_ids=target_ids,
                                 categories=categories, ink=ink)
    IS = map_meta["IS"]

    pin_anchors = []
    for evt in EVENTS:
        wx, wz = evt["world_xz"]
        ax, ay = IS(wx, evt["lift_m"], wz)
        ay = max(map_y + 60, min(map_y + MAP_H - 60, ay))
        ax = max(80, min(W - 80, ax))
        pin_anchors.append((evt["key"], ax, ay))

    pa = [list(t) for t in pin_anchors]
    for i in range(len(pa)):
        for j in range(i + 1, len(pa)):
            kx, ki, ky = pa[i]
            lx, li, ly = pa[j]
            if abs(ki - li) < 140 and abs(ky - ly) < 200:
                pa[j][1] = pa[i][1] + 200 if pa[i][1] < W - 250 else pa[i][1] - 200

    pin_resolved = [(t[0], t[1], t[2]) for t in pa]
    pin_anchor_lookup = {k: (x, y) for k, x, y in pin_resolved}

    order_keys = [k for k in [e["key"] for e in EVENTS] if k != SELECTED_KEY]
    order_keys.append(SELECTED_KEY)
    for key in order_keys:
        evt = next(e for e in EVENTS if e["key"] == key)
        ax, ay = pin_anchor_lookup[key]
        draw_event_pin(img, (ax, ay),
                       evt["color_hex"], evt["when_label"],
                       ink, selected=(key == SELECTED_KEY))

    sheet_y = map_y + MAP_H
    selected_evt = next(e for e in EVENTS if e["key"] == SELECTED_KEY)
    draw_event_sheet(img, y0=sheet_y, height=SHEET_H,
                     evt=selected_evt, ink=ink)

    nav_y0 = H - HOME_INDICATOR_H - TAB_BAR_H
    nav_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    nd = ImageDraw.Draw(nav_layer)
    nd.rectangle((0, nav_y0, W, nav_y0 + TAB_BAR_H),
                 fill=P["paper"] + (255,))
    img.alpha_composite(nav_layer)
    draw_tab_nav(img, y0=nav_y0, ink=ink)

    draw_home_indicator(img, bottom_y=H, ink=ink)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(out_path, "PNG", optimize=True)

    return {
        "out_path": out_path,
        "pin_resolved": pin_resolved,
        "events": EVENTS,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cusec", help="Código de sección censal (10 dígitos)")
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
        out_path = DEFAULT_OUT_DIR / f"{args.cusec}_events.png"
    if not out_path.is_absolute():
        out_path = ROOT / out_path

    res = render_events_mockup(args.cusec, pack_dir, out_path)
    print(f"OK -> {res['out_path']}")
    for evt in res["events"]:
        print(f"  pin {evt['key']} ({evt['category_l1']}): "
              f"manzana {evt['manzana_id']} · building {evt['building_id']} · "
              f"{evt['when_label']}")
    print(f"  pin coords px: {res['pin_resolved']}")


if __name__ == "__main__":
    main()
