"""KOINOS · POLIS — Mockup comparativo KOINOS vs Decidim.

Genera UN PNG (2380x3100) con tres secciones:
1. Smartphone KOINOS (voto diario contextual, mapa iso + card Reigns)
2. Smartphone Decidim (propuesta institucional, muro de texto)
3. Dashboard institucional (mapa coropleta + stats geográficos)

El objetivo es ilustrar la diferencia entre una decisión bilateral SI/NO
contextualizada al territorio (KOINOS) y un flujo formal de propuesta
parlamentaria con texto largo y firmas (Decidim), cerrando con un dashboard
que demuestra qué insights GEOGRÁFICOS produce KOINOS y Decidim no.

Uso:
    python3 -m packages.mockups.comparative
    python3 -m packages.mockups.comparative --cusec 3501602052
"""
from __future__ import annotations

import argparse
import json
import math
import pathlib
from typing import Dict, List, Optional, Tuple

from PIL import Image, ImageDraw, ImageFilter, ImageFont
from shapely.geometry import LineString, Polygon, box, shape

ROOT = pathlib.Path(__file__).resolve().parents[2]

from packages.mockups.zoom import (  # noqa: E402
    COS30, SIN30, PALETTE, hex2rgb, iso, shade,
)
from packages.iso.bloque_clustering import simplify_manzana  # noqa: E402

DEFAULT_PACK = ROOT / "public" / "sections_pack"
DEFAULT_OUT = ROOT / "design" / "secciones" / "koinos_vs_decidim.png"

W, H = 2380, 3100

# Layout
PAD = 40
TOP_H = 1800      # franja superior con dos smartphones
DASH_Y = TOP_H + 20
DASH_H = H - DASH_Y

PHONE_W = 1170
PHONE_H = 1700

# Phone vertical inset inside the top band (some margin for labels)
PHONE_TOP_OFFSET = 80
PHONE_LEFT_X = PAD + 40
PHONE_RIGHT_X = W - PHONE_W - PAD - 40

# ----- palette derivado ---------------------------------------------------
P = dict(PALETTE)
P["paper_warm"] = hex2rgb("#F5E8C8")
P["paper"] = hex2rgb("#F5E8C8")
P["paper_light"] = hex2rgb("#FBF3DC")
P["ocre"] = hex2rgb("#C89968")
P["ocre_lt"] = hex2rgb("#D9B58A")
P["ocre_dk"] = hex2rgb("#A37945")
P["sand"] = hex2rgb("#E2C99A")
P["gris"] = hex2rgb("#4A4D52")
P["gris_lt"] = hex2rgb("#7A7D82")
P["street"] = hex2rgb("#6B6358")
P["ink"] = hex2rgb("#1A1612")
P["accent"] = hex2rgb("#E68A4F")
P["divider"] = (210, 200, 178)
P["muted"] = (118, 108, 90)

# colores de voto (escala roja-amarilla-verde como heatmap electoral)
P["vote_green_dk"] = hex2rgb("#3D8A4D")
P["vote_green"] = hex2rgb("#6FB87A")
P["vote_yellow"] = hex2rgb("#E6C44F")
P["vote_orange"] = hex2rgb("#E68A4F")
P["vote_red"] = hex2rgb("#C85438")

# decidim brand
P["decidim_blue"] = hex2rgb("#21436F")
P["decidim_accent"] = hex2rgb("#EF604D")


# ----- fonts ---------------------------------------------------------------

def _try_font(cands, size):
    for c in cands:
        try:
            return ImageFont.truetype(c, size)
        except Exception:
            continue
    return ImageFont.load_default()


def fonts():
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
    return {
        "phone_label": _try_font(serif_b, 34),
        "status":      _try_font(sans_b, 26),
        "crumb":       _try_font(sans_r, 22),
        "crumb_b":     _try_font(sans_b, 22),
        "chip":        _try_font(sans_b, 20),
        "card_title":  _try_font(serif_b, 46),
        "card_sub":    _try_font(serif_r, 24),
        "btn_big":     _try_font(sans_b, 44),
        "stats_sm":    _try_font(sans_r, 22),
        "stats_b":     _try_font(sans_b, 22),
        "link":        _try_font(sans_b, 22),
        "tab":         _try_font(sans_b, 18),
        "tab_off":     _try_font(sans_r, 18),
        "badge":       _try_font(sans_b, 16),

        # Decidim
        "dec_logo":    _try_font(serif_b, 34),
        "dec_id":      _try_font(sans_r, 20),
        "dec_title":   _try_font(serif_b, 42),
        "dec_tag":     _try_font(sans_b, 18),
        "dec_body":    _try_font(serif_r, 22),
        "dec_section": _try_font(sans_b, 24),
        "dec_btn":     _try_font(sans_b, 28),
        "dec_user":    _try_font(sans_b, 20),
        "dec_time":    _try_font(sans_r, 18),
        "dec_comment": _try_font(serif_r, 20),
        "dec_tab":     _try_font(sans_b, 18),

        # Dashboard
        "dash_banner": _try_font(serif_b, 34),
        "dash_h2":     _try_font(serif_b, 32),
        "dash_lbl":    _try_font(sans_b, 22),
        "dash_sm":     _try_font(sans_r, 20),
        "dash_huge":   _try_font(serif_b, 56),
        "dash_kpi":    _try_font(serif_b, 64),
        "dash_kpi_lbl": _try_font(sans_r, 22),
        "dash_insight_t": _try_font(serif_b, 30),
        "dash_insight":   _try_font(serif_r, 24),
        "dash_legend":    _try_font(sans_r, 18),
        "dash_foot":      _try_font(serif_r, 22),
    }


def text_w(d: ImageDraw.ImageDraw, txt: str, font) -> int:
    bb = d.textbbox((0, 0), txt, font=font)
    return bb[2] - bb[0]


def text_h(d: ImageDraw.ImageDraw, txt: str, font) -> int:
    bb = d.textbbox((0, 0), txt, font=font)
    return bb[3] - bb[1]


def round_rect(d, box_, radius, fill=None, outline=None, width=1):
    d.rounded_rectangle(box_, radius=radius, fill=fill, outline=outline,
                        width=width)


def wrap_text(d, txt, font, max_w):
    words = txt.split(" ")
    lines, cur = [], ""
    for w in words:
        cand = (cur + " " + w).strip()
        if text_w(d, cand, font) <= max_w:
            cur = cand
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


# ----- phone chrome --------------------------------------------------------

def draw_phone_frame(img, x0, y0, ink_col, paper_col, label, f):
    """Marco de smartphone (corner radius), status bar y home indicator."""
    d = ImageDraw.Draw(img)
    # label arriba
    lw = text_w(d, label, f["phone_label"])
    d.text((x0 + (PHONE_W - lw) // 2, y0 - 56), label,
           fill=P["ink"], font=f["phone_label"])

    radius = 60
    # sombra fina
    sh_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh_layer)
    sd.rounded_rectangle((x0 + 14, y0 + 22, x0 + PHONE_W + 14,
                          y0 + PHONE_H + 22),
                         radius=radius, fill=(0, 0, 0, 110))
    sh_blur = sh_layer.filter(ImageFilter.GaussianBlur(radius=14))
    img.alpha_composite(sh_blur)
    d = ImageDraw.Draw(img)

    # marco
    round_rect(d, (x0 - 6, y0 - 6, x0 + PHONE_W + 6, y0 + PHONE_H + 6),
               radius=radius + 6, fill=P["ink"])
    round_rect(d, (x0, y0, x0 + PHONE_W, y0 + PHONE_H),
               radius=radius, fill=paper_col)

    # status bar
    sb_h = 70
    d.text((x0 + 60, y0 + 22), "09:41", fill=ink_col, font=f["status"])
    # notch
    notch_w, notch_h = 280, 38
    nx = x0 + (PHONE_W - notch_w) // 2
    round_rect(d, (nx, y0 + 16, nx + notch_w, y0 + 16 + notch_h),
               radius=18, fill=P["ink"])
    # battery
    bx1 = x0 + PHONE_W - 50
    bw, bh = 56, 22
    by0 = y0 + 30
    round_rect(d, (bx1 - bw, by0, bx1, by0 + bh),
               radius=4, outline=ink_col, width=2)
    d.rectangle((bx1 - bw + 3, by0 + 3, bx1 - bw + 3 + int((bw - 6) * 0.85),
                 by0 + bh - 3), fill=ink_col)
    # signal bars
    sg_x = bx1 - bw - 50
    for i in range(4):
        hb = 6 + i * 4
        d.rectangle((sg_x + i * 7, by0 + bh - hb, sg_x + i * 7 + 5,
                     by0 + bh), fill=ink_col)

    # home indicator
    bar_w, bar_h = 270, 9
    bx0 = x0 + (PHONE_W - bar_w) // 2
    by_ = y0 + PHONE_H - 26
    round_rect(d, (bx0, by_, bx0 + bar_w, by_ + bar_h),
               radius=5, fill=ink_col)
    return sb_h


# ----- KOINOS phone (left) -------------------------------------------------

def draw_koinos_phone(img, x0, y0, pack_dir, target_id, f):
    """Smartphone A — KOINOS voto diario contextual."""
    d = ImageDraw.Draw(img)
    sb_h = draw_phone_frame(img, x0, y0, P["ink"], P["paper_warm"],
                            "KOINOS  ·  voto diario", f)

    # top bar
    top_y = y0 + sb_h + 10
    top_h = 64
    d.rectangle((x0, top_y, x0 + PHONE_W, top_y + top_h),
                fill=P["paper_warm"])
    d.line((x0 + 30, top_y + top_h, x0 + PHONE_W - 30, top_y + top_h),
           fill=P["divider"], width=2)
    # breadcrumb
    crumb = "Las Canteras  >  Sec 052"
    cw = text_w(d, crumb, f["crumb"])
    d.text((x0 + 60, top_y + 18), crumb,
           fill=P["ink"], font=f["crumb"])
    # settings (3 dots)
    sx = x0 + PHONE_W - 56
    for i, dy in enumerate([-12, 0, 12]):
        d.ellipse((sx - 5, top_y + top_h // 2 + dy - 5,
                   sx + 5, top_y + top_h // 2 + dy + 5),
                  fill=P["ink"])

    # bottom tab bar reservado abajo
    tab_h = 88
    tab_y = y0 + PHONE_H - tab_h - 18

    # mapa iso (50% del alto usable)
    map_y0 = top_y + top_h + 6
    usable_h = tab_y - map_y0
    map_h = int(usable_h * 0.46)
    map_y1 = map_y0 + map_h
    d.rectangle((x0, map_y0, x0 + PHONE_W, map_y1), fill=P["paper_warm"])

    _draw_iso_map(img, x0, map_y0, PHONE_W, map_h, pack_dir, target_id, f)

    # card overlay tipo Reigns (debajo del mapa, dejando ver mapa parcial)
    card_y0 = map_y0 + int(map_h * 0.62)
    card_y1 = tab_y - 8
    card_x0 = x0 + 28
    card_x1 = x0 + PHONE_W - 28

    # sombra de card
    sh_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh_layer)
    sd.rounded_rectangle((card_x0 + 6, card_y0 + 18, card_x1 + 6, card_y1 + 8),
                         radius=46, fill=(0, 0, 0, 130))
    sh_blur = sh_layer.filter(ImageFilter.GaussianBlur(radius=18))
    img.alpha_composite(sh_blur)
    d = ImageDraw.Draw(img)
    round_rect(d, (card_x0, card_y0, card_x1, card_y1),
               radius=44, fill=P["paper_light"],
               outline=P["ink"], width=4)

    cy = card_y0 + 28
    # chip "decisión de hoy"
    chip_txt = "Decisión de hoy  ·  cierra a las 23:59"
    chw = text_w(d, chip_txt, f["chip"]) + 36
    chh = 38
    chx0 = card_x0 + 30
    round_rect(d, (chx0, cy, chx0 + chw, cy + chh),
               radius=19, fill=P["accent"], outline=P["ink"], width=2)
    d.text((chx0 + 18, cy + 6), chip_txt,
           fill=P["paper_light"], font=f["chip"])
    cy += chh + 18

    # título
    title = "Peatonalizar la Avenida\nLas Canteras los domingos?"
    for line in title.split("\n"):
        d.text((card_x0 + 30, cy), line,
               fill=P["ink"], font=f["card_title"])
        cy += 56
    cy += 8

    # subtítulo
    sub = ("Propuesta del Ayuntamiento de LPGC para uso "
           "recreativo del frente marítimo los domingos de 9h a 14h.")
    inner_w = (card_x1 - card_x0) - 60
    for line in wrap_text(d, sub, f["card_sub"], inner_w):
        d.text((card_x0 + 30, cy), line,
               fill=P["muted"], font=f["card_sub"])
        cy += 32
    cy += 22

    # dos botones gigantes lado a lado
    btn_w = (inner_w - 24) // 2
    btn_h = 110
    bx_no = card_x0 + 30
    bx_si = bx_no + btn_w + 24
    by_btn = cy
    round_rect(d, (bx_no, by_btn, bx_no + btn_w, by_btn + btn_h),
               radius=22, fill=P["gris"], outline=P["ink"], width=3)
    round_rect(d, (bx_si, by_btn, bx_si + btn_w, by_btn + btn_h),
               radius=22, fill=P["accent"], outline=P["ink"], width=3)
    no_txt = "X   NO"
    si_txt = "OK   SI"
    nw = text_w(d, no_txt, f["btn_big"])
    sw = text_w(d, si_txt, f["btn_big"])
    d.text((bx_no + (btn_w - nw) // 2, by_btn + (btn_h - 50) // 2),
           no_txt, fill=P["paper_light"], font=f["btn_big"])
    d.text((bx_si + (btn_w - sw) // 2, by_btn + (btn_h - 50) // 2),
           si_txt, fill=P["paper_light"], font=f["btn_big"])
    cy += btn_h + 22

    # stats debajo
    stats = "1.247 vecinos han votado en tu barrio  ·  43% del total registrado"
    sw2 = text_w(d, stats, f["stats_sm"])
    d.text((card_x0 + (card_x1 - card_x0 - sw2) // 2, cy),
           stats, fill=P["muted"], font=f["stats_sm"])
    cy += 32
    # link
    link = "Ver opiniones de otros vecinos  ->"
    lw2 = text_w(d, link, f["link"])
    d.text((card_x0 + (card_x1 - card_x0 - lw2) // 2, cy),
           link, fill=P["ocre_dk"], font=f["link"])

    # tab bar inferior
    d.rectangle((x0, tab_y, x0 + PHONE_W, tab_y + tab_h),
                fill=P["paper_warm"])
    d.line((x0 + 20, tab_y, x0 + PHONE_W - 20, tab_y),
           fill=P["divider"], width=2)
    tabs = [("mapa", True, None), ("eventos", False, "3"),
            ("votos", False, "1 hoy"), ("perfil", False, None)]
    n = len(tabs)
    seg = PHONE_W // n
    for i, (name, active, badge) in enumerate(tabs):
        cx = x0 + i * seg + seg // 2
        cy2 = tab_y + 18
        # icon stub
        col = P["accent"] if active else P["gris_lt"]
        if name == "mapa":
            d.polygon([(cx - 16, cy2 + 28), (cx, cy2 + 4),
                       (cx + 16, cy2 + 28)], fill=col, outline=P["ink"])
        elif name == "eventos":
            d.rectangle((cx - 16, cy2 + 6, cx + 16, cy2 + 30),
                        fill=col, outline=P["ink"], width=2)
            d.line((cx - 16, cy2 + 14, cx + 16, cy2 + 14),
                   fill=P["ink"], width=2)
        elif name == "votos":
            d.line((cx - 12, cy2 + 18, cx - 4, cy2 + 26),
                   fill=col, width=4)
            d.line((cx - 4, cy2 + 26, cx + 14, cy2 + 6),
                   fill=col, width=4)
        elif name == "perfil":
            d.ellipse((cx - 10, cy2 + 4, cx + 10, cy2 + 24),
                      fill=col, outline=P["ink"], width=2)
            d.ellipse((cx - 16, cy2 + 22, cx + 16, cy2 + 42),
                      fill=col, outline=P["ink"], width=2)
        # label
        nw3 = text_w(d, name, f["tab"])
        d.text((cx - nw3 // 2, cy2 + 44), name,
               fill=P["ink"] if active else P["muted"], font=f["tab"])
        # badge
        if badge:
            bw_, bh_ = text_w(d, badge, f["badge"]) + 14, 22
            bx_ = cx + 16
            by_ = cy2 + 2
            round_rect(d, (bx_, by_, bx_ + bw_, by_ + bh_),
                       radius=11, fill=P["accent"], outline=P["ink"], width=2)
            d.text((bx_ + 7, by_ + 2), badge,
                   fill=P["paper_light"], font=f["badge"])


def _draw_iso_map(img, x0, y0, w, h, pack_dir, target_id, f):
    """Mapa iso pequeño dentro de un smartphone — paleta limitada, manzana 24 destacada."""
    d = ImageDraw.Draw(img)
    manzanas_gj = json.load(open(pack_dir / "manzanas.geojson",
                                 encoding="utf-8"))

    # extraer todas las manzanas en coords XZ locales
    manz_list = []
    for feat in manzanas_gj["features"]:
        try:
            poly = simplify_manzana(feat, tolerance=3.0)
            if poly is None or poly.is_empty:
                continue
            manz_list.append({
                "id": feat["properties"]["id"],
                "g": poly,
                "h": float(feat["properties"].get("height_median_m") or
                           feat["properties"].get("height_m") or 8.0),
                "nb": feat["properties"].get("building_count", 0),
            })
        except Exception:
            continue

    # bbox global
    minx = min(m["g"].bounds[0] for m in manz_list)
    miny = min(m["g"].bounds[1] for m in manz_list)
    maxx = max(m["g"].bounds[2] for m in manz_list)
    maxy = max(m["g"].bounds[3] for m in manz_list)
    pad = 30.0
    bx0, by0_, bx1, by1_ = minx - pad, miny - pad, maxx + pad, maxy + pad

    bw_m = bx1 - bx0
    bh_m = by1_ - by0_
    span_w = (bw_m + bh_m) * COS30
    span_h = (bw_m + bh_m) * SIN30 + 12.0 * 1.6
    sxy = min((w - 40) / span_w, (h - 40) / span_h)
    sz = sxy * 1.4
    mx_ = (bx0 + bx1) / 2
    my_ = (by0_ + by1_) / 2
    cx_canvas = x0 + w / 2 - (mx_ - my_) * COS30 * sxy
    cy_canvas = y0 + h / 2 - (mx_ + my_) * SIN30 * sxy

    # dibujar manzanas: tile iso plano simple
    sorted_manz = sorted(manz_list, key=lambda m: m["g"].bounds[0]
                         + m["g"].bounds[1])
    for m in sorted_manz:
        if m["g"].geom_type != "Polygon":
            try:
                m["g"] = max(m["g"].geoms, key=lambda gp: gp.area)
            except Exception:
                continue
        ring = list(m["g"].exterior.coords)
        if len(ring) >= 2 and ring[0] == ring[-1]:
            ring = ring[:-1]
        n_ = len(ring)
        if n_ < 3:
            continue
        is_target = (m["id"] == target_id)
        h_m = max(4.0, min(12.0, m["h"] * 0.5))
        bot = [iso(x_, 0, z_, sxy, sz, cx_canvas, cy_canvas)
               for x_, z_ in ring]
        top = [iso(x_, h_m, z_, sxy, sz, cx_canvas, cy_canvas)
               for x_, z_ in ring]
        base = P["ocre"] if not is_target else P["accent"]
        top_col = base
        right = shade(base, 0.85)
        left = shade(base, 0.72)
        for k in range(n_):
            ax_, az_ = ring[k]
            bx_, bz_ = ring[(k + 1) % n_]
            nx_ = (bz_ - az_)
            nz_ = -(bx_ - ax_)
            if nx_ + nz_ <= 0:
                continue
            tilt = nx_ / (abs(nx_) + abs(nz_) + 1e-6)
            face = right if tilt > 0 else left
            d.polygon([bot[k], bot[(k + 1) % n_],
                       top[(k + 1) % n_], top[k]],
                      fill=face, outline=P["ink"], width=2)
        d.polygon(top, fill=top_col, outline=P["ink"], width=3)
        # anillo destacado sobre manzana objetivo
        if is_target:
            d.line(top + [top[0]], fill=P["accent"], width=5)


# ----- DECIDIM phone (right) -----------------------------------------------

def draw_decidim_phone(img, x0, y0, f):
    d = ImageDraw.Draw(img)
    paper = hex2rgb("#FAFAF6")
    sb_h = draw_phone_frame(img, x0, y0, P["ink"], paper,
                            "Decidim  ·  movil", f)

    # top bar
    top_y = y0 + sb_h + 10
    top_h = 80
    d.rectangle((x0, top_y, x0 + PHONE_W, top_y + top_h),
                fill=P["decidim_blue"])
    d.text((x0 + 40, top_y + 24), "Decidim Las Palmas",
           fill=paper, font=f["dec_logo"])
    # user icon (avatar)
    ux = x0 + PHONE_W - 60
    uy = top_y + top_h // 2
    d.ellipse((ux - 22, uy - 22, ux + 22, uy + 22),
              outline=paper, width=3)
    d.ellipse((ux - 9, uy - 10, ux + 9, uy + 6),
              fill=paper)
    d.chord((ux - 18, uy + 4, ux + 18, uy + 30),
            start=180, end=360, fill=paper)

    cur_y = top_y + top_h + 24
    pad_x = 36

    # ID + título
    d.text((x0 + pad_x, cur_y), "Propuesta no 472",
           fill=P["muted"], font=f["dec_id"])
    cur_y += 30
    title_lines = ["Peatonalización dominical",
                   "de la Av. Las Canteras"]
    for line in title_lines:
        d.text((x0 + pad_x, cur_y), line,
               fill=P["ink"], font=f["dec_title"])
        cur_y += 50
    cur_y += 8

    # tags
    tags = [("Movilidad", P["decidim_blue"]),
            ("Las Canteras", hex2rgb("#5A8C5F")),
            ("Sostenibilidad", hex2rgb("#8E5DA0"))]
    tx = x0 + pad_x
    for tag, col in tags:
        tw = text_w(d, tag, f["dec_tag"]) + 24
        th = 32
        round_rect(d, (tx, cur_y, tx + tw, cur_y + th),
                   radius=16, fill=col, outline=P["ink"], width=1)
        d.text((tx + 12, cur_y + 4), tag,
               fill=paper, font=f["dec_tag"])
        tx += tw + 12
    cur_y += 50

    # bloque de texto largo (descripción formal)
    body = ("La presente propuesta tiene por objeto la regulación dominical "
            "del tráfico rodado en el eje principal del paseo marítimo de "
            "Las Canteras, en el tramo comprendido entre Plaza de Saulo "
            "Torón y Calle Joaquín Costa, con el fin de favorecer el uso "
            "peatonal y recreativo del frente costero durante las horas "
            "matinales del domingo, conforme a los precedentes de Diagonal "
            "en Barcelona y Castellana en Madrid, y en línea con la "
            "Estrategia de Movilidad Sostenible 2025-2030 del Cabildo...")
    inner_w = PHONE_W - 2 * pad_x
    body_lines = wrap_text(d, body, f["dec_body"], inner_w)
    for line in body_lines[:10]:
        d.text((x0 + pad_x, cur_y), line,
               fill=P["ink"], font=f["dec_body"])
        cur_y += 30
    cur_y += 6

    # barra de progreso de firmas
    d.text((x0 + pad_x, cur_y), "Apoyos: 47 / 500 necesarios",
           fill=P["ink"], font=f["dec_section"])
    cur_y += 36
    bar_w = inner_w
    bar_h = 22
    round_rect(d, (x0 + pad_x, cur_y, x0 + pad_x + bar_w, cur_y + bar_h),
               radius=11, fill=hex2rgb("#E6E1D2"), outline=P["ink"], width=2)
    fill_w = int(bar_w * 47 / 500)
    round_rect(d, (x0 + pad_x, cur_y,
                   x0 + pad_x + fill_w, cur_y + bar_h),
               radius=11, fill=P["decidim_blue"])
    pct = "9,4%"
    pw = text_w(d, pct, f["dec_tag"])
    d.text((x0 + pad_x + bar_w - pw - 8, cur_y - 2), pct,
           fill=P["ink"], font=f["dec_tag"])
    cur_y += bar_h + 30

    # comentarios
    d.text((x0 + pad_x, cur_y), "Comentarios (47)",
           fill=P["ink"], font=f["dec_section"])
    cur_y += 36

    comments = [
        ("@mar_canteras", "hace 2h",
         "Estoy a favor pero hay que pensar en los comercios que dependen del flujo del domingo. Una compensación seria justa."),
        ("@vegueta_vecino", "hace 5h",
         "El paseo ya es caótico los domingos. Cerrarlo al coche es de sentido común. Apoyo."),
        ("@guanarteme7", "hace 8h",
         "Y como llego yo desde Guanarteme al trabajo el domingo? Falta plan de desvío para residentes."),
    ]
    avatar_colors = [P["decidim_accent"], P["decidim_blue"],
                     hex2rgb("#8E5DA0")]
    for i, (user, when, body_) in enumerate(comments):
        ax = x0 + pad_x + 26
        ay = cur_y + 24
        d.ellipse((ax - 24, ay - 24, ax + 24, ay + 24),
                  fill=avatar_colors[i], outline=P["ink"], width=2)
        # username + time
        d.text((ax + 38, cur_y + 2), user,
               fill=P["ink"], font=f["dec_user"])
        uw = text_w(d, user, f["dec_user"])
        d.text((ax + 38 + uw + 12, cur_y + 6), when,
               fill=P["muted"], font=f["dec_time"])
        body_lines2 = wrap_text(d, body_, f["dec_comment"],
                                inner_w - 70)
        ty = cur_y + 32
        for ln in body_lines2[:2]:
            d.text((ax + 38, ty), ln,
                   fill=P["ink"], font=f["dec_comment"])
            ty += 26
        cur_y = max(ty + 6, ay + 30)

    # botones inferiores (justo por encima del tab bar)
    tab_h = 80
    tab_y = y0 + PHONE_H - tab_h - 18
    btn_h = 70
    btn_y0 = tab_y - btn_h - 18
    btn_y1 = tab_y - 18
    inner_w = PHONE_W - 2 * pad_x
    half_w = (inner_w - 18) // 2
    round_rect(d, (x0 + pad_x, btn_y0,
                   x0 + pad_x + half_w, btn_y1),
               radius=14, fill=P["decidim_blue"], outline=P["ink"], width=2)
    txt = "Apoyar propuesta"
    tw = text_w(d, txt, f["dec_btn"])
    d.text((x0 + pad_x + (half_w - tw) // 2, btn_y0 + 16),
           txt, fill=paper, font=f["dec_btn"])
    bx2 = x0 + pad_x + half_w + 18
    round_rect(d, (bx2, btn_y0, bx2 + half_w, btn_y1),
               radius=14, fill=paper, outline=P["decidim_blue"], width=3)
    txt2 = "Comentar"
    tw2 = text_w(d, txt2, f["dec_btn"])
    d.text((bx2 + (half_w - tw2) // 2, btn_y0 + 16),
           txt2, fill=P["decidim_blue"], font=f["dec_btn"])

    # tab bar
    d.rectangle((x0, tab_y, x0 + PHONE_W, tab_y + tab_h),
                fill=paper)
    d.line((x0, tab_y, x0 + PHONE_W, tab_y),
           fill=P["divider"], width=2)
    dec_tabs = ["Procesos", "Asambleas", "Iniciativas", "Mi cuenta"]
    seg = PHONE_W // len(dec_tabs)
    for i, t in enumerate(dec_tabs):
        cx = x0 + i * seg + seg // 2
        active = (i == 0)
        col = P["decidim_blue"] if active else P["muted"]
        tw3 = text_w(d, t, f["dec_tab"])
        d.text((cx - tw3 // 2, tab_y + 36), t,
               fill=col, font=f["dec_tab"])
        # icon stub: small circle
        d.ellipse((cx - 8, tab_y + 12, cx + 8, tab_y + 28),
                  outline=col, width=2)


# ----- Dashboard institucional --------------------------------------------

def _flatten_polygon_xz(geom):
    """Extract exterior ring coords from polygon/multipolygon."""
    if geom.geom_type == "Polygon":
        return [list(geom.exterior.coords)]
    if geom.geom_type == "MultiPolygon":
        return [list(g.exterior.coords) for g in geom.geoms]
    return []


def _vote_color_from_pct(pct):
    """Devuelve color voto según % sí."""
    if pct >= 70:
        return P["vote_green_dk"], "verde"
    if pct >= 50:
        return P["vote_green"], "verde"
    if pct >= 40:
        return P["vote_yellow"], "amarillo"
    if pct >= 20:
        return P["vote_orange"], "naranja"
    return P["vote_red"], "rojo"


def draw_dashboard(img, x0, y0, w, h, pack_dir, target_id, f):
    d = ImageDraw.Draw(img)
    # fondo paper claro
    d.rectangle((x0, y0, x0 + w, y0 + h), fill=P["paper_light"])

    # banner ink superior
    banner_h = 70
    d.rectangle((x0, y0, x0 + w, y0 + banner_h), fill=P["ink"])
    banner_txt = ("Panel cívico institucional  ·  "
                  "Ayuntamiento de Las Palmas de Gran Canaria  ·  "
                  "vista de la concejalía")
    d.text((x0 + 40, y0 + 22), banner_txt,
           fill=P["paper_light"], font=f["dash_banner"])

    # layout: dos columnas
    content_y0 = y0 + banner_h + 20
    content_h = h - banner_h - 130   # 130 px reservados para etiqueta inferior
    # columna izquierda: mapa coropleta (1100x1100)
    col_left_x = x0 + 30
    col_left_w = 1100
    col_left_h = content_h - 20
    # columna derecha: 4 bloques apilados (1240 px)
    col_right_x = col_left_x + col_left_w + 20
    col_right_w = w - (col_right_x - x0) - 30
    col_right_h = col_left_h

    color_counts = _draw_choropleth(img, col_left_x, content_y0,
                                    col_left_w, col_left_h,
                                    pack_dir, f)
    _draw_stats_column(img, col_right_x, content_y0,
                       col_right_w, col_right_h, f)

    # etiqueta pie del dashboard
    foot_y0 = y0 + h - 110
    d.rectangle((x0, foot_y0, x0 + w, y0 + h), fill=P["ink"])
    foot_txt = ("Lo que KOINOS extrae: las interacciones cívicas "
                "geolocalizadas producen señales agregadas por proximidad "
                "real al territorio afectado, no por afinidad ideológica "
                "genérica. Esta capa de insight es estructural y no la "
                "ofrece ninguna plataforma de participación basada en "
                "formularios web.")
    lines = wrap_text(d, foot_txt, f["dash_foot"], w - 80)
    fy = foot_y0 + 20
    for line in lines[:3]:
        d.text((x0 + 40, fy), line,
               fill=P["paper_light"], font=f["dash_foot"])
        fy += 28
    return color_counts


def _draw_choropleth(img, x0, y0, w, h, pack_dir, f):
    """Mapa plano (top-down) coloreado por % de voto sí.

    Heurística sintética: % sí decae con distancia al eje del paseo
    marítimo (estimado como el segmento norte de la sección 052).
    """
    d = ImageDraw.Draw(img)
    # marco
    round_rect(d, (x0, y0, x0 + w, y0 + h),
               radius=12, fill=P["paper_warm"],
               outline=P["ink"], width=3)

    # cabecera
    d.text((x0 + 24, y0 + 18),
           "Voto agregado por manzana  ·  1.247 participantes",
           fill=P["ink"], font=f["dash_h2"])

    # cargar manzanas (en ENU local m, X=east, Z=south)
    manzanas_gj = json.load(open(pack_dir / "manzanas.geojson",
                                 encoding="utf-8"))

    polys = []
    for feat in manzanas_gj["features"]:
        try:
            g = simplify_manzana(feat, tolerance=2.0)
            if g is None or g.is_empty:
                continue
            polys.append({
                "id": feat["properties"]["id"],
                "g": g,
                "nb": feat["properties"].get("building_count", 0),
            })
        except Exception:
            continue

    # proyección plana ENU local — X=este, Z=sur (queremos norte arriba)
    # bbox de las manzanas
    minx = min(p["g"].bounds[0] for p in polys)
    minz = min(p["g"].bounds[1] for p in polys)
    maxx = max(p["g"].bounds[2] for p in polys)
    maxz = max(p["g"].bounds[3] for p in polys)
    # padding
    pad_m = 30.0
    bx0, bz0, bx1, bz1 = (minx - pad_m, minz - pad_m,
                          maxx + pad_m, maxz + pad_m)
    bw_m = bx1 - bx0
    bh_m = bz1 - bz0
    # área de dibujo (debajo del título, con margen para leyenda)
    legend_h = 80
    inner_x0 = x0 + 30
    inner_y0 = y0 + 80
    inner_x1 = x0 + w - 30
    inner_y1 = y0 + h - legend_h - 20
    avail_w = inner_x1 - inner_x0
    avail_h = inner_y1 - inner_y0
    scale = min(avail_w / bw_m, avail_h / bh_m) * 0.96
    # centrado
    cx_canvas = (inner_x0 + inner_x1) / 2
    cy_canvas = (inner_y0 + inner_y1) / 2
    mx_ = (bx0 + bx1) / 2
    mz_ = (bz0 + bz1) / 2

    def project(x_m, z_m):
        # invertimos Z para que norte (z negativo) quede arriba
        return (cx_canvas + (x_m - mx_) * scale,
                cy_canvas + (z_m - mz_) * scale)

    # heurística de voto: el "paseo" es la línea horizontal en
    # z = minz + 0.1*bh_m (el frente marítimo norte) — proximidad determina %sí.
    paseo_z = bz0 + 0.08 * bh_m
    max_d_close = bh_m * 0.95   # decay para sección 052 (Las Canteras)

    counts = {"verde": 0, "amarillo": 0, "naranja": 0, "rojo": 0}
    # subdivisión: solo dibujamos manzanas que caben en el bbox de la
    # propia sección 052; añadimos también un "halo" sintético alrededor
    # para simular las manzanas de Guanarteme. Lo hacemos repitiendo el
    # patrón con offset y desplazando la heurística.

    # primero, render real de la sección 052
    section_results = []
    for p in polys:
        c = p["g"].centroid
        dz = abs(c.y - paseo_z)
        # decay del % sí con distancia
        t = max(0.0, min(1.0, dz / max_d_close))
        pct_si = 88 - t * 28 + (hash(p["id"]) % 12) - 6
        pct_si = max(45, min(95, pct_si))
        col, bucket = _vote_color_from_pct(pct_si)
        counts[bucket] += 1
        section_results.append((p, pct_si, col))

    # añadimos copies desplazadas (simulando Guanarteme + Sta Catalina + Vegueta)
    # cada offset tiene una "distancia conceptual" que controla el centro de %sí
    extras = []
    offsets = [
        # (offset_x_m, offset_z_m, base_pct_si, jitter)
        (0,            bh_m * 1.05, 55, 10),   # Guanarteme directo al sur
        (-bw_m * 0.9,  bh_m * 0.7,  42, 12),   # Sta Catalina al oeste
        (bw_m * 0.7,   bh_m * 0.9,  32, 12),   # Vegueta lejano
    ]
    for ox, oz, base_pct, jitter in offsets:
        for p in polys:
            c = p["g"].centroid
            shifted_z = c.y + oz
            dz = abs(shifted_z - paseo_z)
            t = max(0.0, min(1.0, dz / (bh_m * 2.5)))
            # interior de cada barrio: pct si decae con distancia al paseo
            pct_si = base_pct - t * 18 + (hash((p["id"], ox, oz)) % (jitter * 2)) - jitter
            pct_si = max(8, min(78, pct_si))
            col, bucket = _vote_color_from_pct(pct_si)
            counts[bucket] += 1
            extras.append((p, pct_si, col, ox, oz))

    # dibujar primero los extras (atenuados)
    for p, pct, col, ox, oz in extras:
        rings = _flatten_polygon_xz(p["g"])
        for ring in rings:
            if len(ring) < 3:
                continue
            pts = [project(rx + ox, rz + oz) for rx, rz in ring]
            # clip rough: skip if entirely outside drawing area
            xs_ = [pp[0] for pp in pts]
            ys_ = [pp[1] for pp in pts]
            if (max(xs_) < inner_x0 or min(xs_) > inner_x1 or
                    max(ys_) < inner_y0 or min(ys_) > inner_y1):
                continue
            # atenuar color (mix con paper)
            atten = tuple(int(c * 0.85 + P["paper_warm"][i] * 0.15)
                          for i, c in enumerate(col))
            d.polygon(pts, fill=atten, outline=P["ink"])

    # luego la sección 052 a tono pleno
    for p, pct, col in section_results:
        rings = _flatten_polygon_xz(p["g"])
        for ring in rings:
            if len(ring) < 3:
                continue
            pts = [project(rx, rz) for rx, rz in ring]
            d.polygon(pts, fill=col, outline=P["ink"])

    # marco del paseo marítimo: línea azul horizontal
    px0, _ = project(bx0, paseo_z)
    px1, py_paseo = project(bx1, paseo_z)
    d.line([(px0, py_paseo), (px1, py_paseo)],
           fill=hex2rgb("#3F5F7E"), width=6)
    # etiqueta paseo
    d.text((px0 + 12, py_paseo - 30), "Paseo Las Canteras",
           fill=hex2rgb("#3F5F7E"), font=f["dash_lbl"])

    # leyenda
    leg_y0 = inner_y1 + 20
    leg_items = [
        ("> 70% sí", P["vote_green_dk"]),
        ("50–70%", P["vote_green"]),
        ("40–50%", P["vote_yellow"]),
        ("20–40%", P["vote_orange"]),
        ("< 20%", P["vote_red"]),
    ]
    lx = inner_x0
    for lbl, col in leg_items:
        d.rectangle((lx, leg_y0 + 8, lx + 28, leg_y0 + 36),
                    fill=col, outline=P["ink"], width=2)
        d.text((lx + 36, leg_y0 + 12), lbl,
               fill=P["ink"], font=f["dash_legend"])
        lx += text_w(d, lbl, f["dash_legend"]) + 80

    return counts


def _draw_stats_column(img, x0, y0, w, h, f):
    d = ImageDraw.Draw(img)
    # 4 bloques apilados; alturas: 300, 250, 250, 300 (total 1100)
    block_specs = [
        ("bar_chart", 300),
        ("line_chart", 250),
        ("kpi_grid", 250),
        ("insight", 300),
    ]
    total = sum(b[1] for b in block_specs)
    gap = 10
    # escalamos si la altura es distinta
    scale = (h - gap * (len(block_specs) - 1)) / total
    cur_y = y0
    for kind, base_h in block_specs:
        block_h = int(base_h * scale)
        if kind == "bar_chart":
            _draw_bar_chart(img, x0, cur_y, w, block_h, f)
        elif kind == "line_chart":
            _draw_line_chart(img, x0, cur_y, w, block_h, f)
        elif kind == "kpi_grid":
            _draw_kpi_grid(img, x0, cur_y, w, block_h, f)
        elif kind == "insight":
            _draw_insight(img, x0, cur_y, w, block_h, f)
        cur_y += block_h + gap


def _draw_bar_chart(img, x0, y0, w, h, f):
    d = ImageDraw.Draw(img)
    round_rect(d, (x0, y0, x0 + w, y0 + h), radius=12,
               fill=P["paper_warm"], outline=P["ink"], width=3)
    d.text((x0 + 20, y0 + 14), "Apoyo por barrio",
           fill=P["ink"], font=f["dash_h2"])

    bars = [
        ("Las Canteras", 86, P["vote_green_dk"]),
        ("Guanarteme", 64, P["vote_green"]),
        ("Sta. Catalina", 52, P["vote_green"]),
        ("Vegueta", 38, P["vote_orange"]),
        ("Telde (control)", 24, P["vote_red"]),
    ]
    inner_x0 = x0 + 220
    inner_x1 = x0 + w - 80
    bar_total_w = inner_x1 - inner_x0
    rows_y0 = y0 + 60
    row_h = (h - 80) // len(bars)
    for i, (name, pct, col) in enumerate(bars):
        ry = rows_y0 + i * row_h
        d.text((x0 + 20, ry + 8), name,
               fill=P["ink"], font=f["dash_lbl"])
        bw_ = int(bar_total_w * pct / 100)
        bh_ = 24
        round_rect(d, (inner_x0, ry + 10, inner_x0 + bw_, ry + 10 + bh_),
                   radius=4, fill=col, outline=P["ink"], width=1)
        # rail
        d.rectangle((inner_x0, ry + 10, inner_x1, ry + 10 + bh_),
                    outline=P["divider"], width=1)
        # value
        d.text((inner_x0 + bw_ + 8, ry + 8), f"{pct}%",
               fill=P["ink"], font=f["dash_lbl"])


def _draw_line_chart(img, x0, y0, w, h, f):
    d = ImageDraw.Draw(img)
    round_rect(d, (x0, y0, x0 + w, y0 + h), radius=12,
               fill=P["paper_warm"], outline=P["ink"], width=3)
    d.text((x0 + 20, y0 + 14), "Votos por hora (24h)",
           fill=P["ink"], font=f["dash_h2"])

    # eje X de 6 a 24
    chart_x0 = x0 + 80
    chart_x1 = x0 + w - 40
    chart_y0 = y0 + 70
    chart_y1 = y0 + h - 50
    # ejes
    d.line((chart_x0, chart_y1, chart_x1, chart_y1),
           fill=P["ink"], width=2)
    d.line((chart_x0, chart_y0, chart_x0, chart_y1),
           fill=P["ink"], width=2)

    hours = list(range(6, 25))
    # forma de los votos: bajos, pico a las 12-13, depresión 14-17, pico fuerte 19-21
    def vol(h_):
        peak1 = math.exp(-((h_ - 12.5) ** 2) / 2.0) * 0.55
        peak2 = math.exp(-((h_ - 20) ** 2) / 1.6) * 1.0
        base = 0.08
        return peak1 + peak2 + base

    values = [vol(h_) for h_ in hours]
    vmax = max(values)
    pts = []
    for i, (h_, v) in enumerate(zip(hours, values)):
        t = i / (len(hours) - 1)
        cx = chart_x0 + t * (chart_x1 - chart_x0)
        cy = chart_y1 - (v / vmax) * (chart_y1 - chart_y0) * 0.92
        pts.append((cx, cy))

    # área bajo la curva
    poly_pts = [(chart_x0, chart_y1)] + pts + [(chart_x1, chart_y1)]
    fill_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    fd = ImageDraw.Draw(fill_layer)
    fd.polygon(poly_pts, fill=P["ocre"] + (95,))
    img.alpha_composite(fill_layer)
    d = ImageDraw.Draw(img)
    # línea
    d.line(pts, fill=P["ocre_dk"], width=4)
    # puntos clave
    for cx, cy in pts:
        d.ellipse((cx - 3, cy - 3, cx + 3, cy + 3),
                  fill=P["ocre_dk"])

    # ticks X
    tick_hours = [6, 9, 12, 15, 18, 21, 24]
    for h_ in tick_hours:
        t = (h_ - 6) / 18.0
        cx = chart_x0 + t * (chart_x1 - chart_x0)
        d.line((cx, chart_y1, cx, chart_y1 + 6),
               fill=P["ink"], width=2)
        lbl = f"{h_:02d}h"
        lw = text_w(d, lbl, f["dash_legend"])
        d.text((cx - lw // 2, chart_y1 + 8), lbl,
               fill=P["muted"], font=f["dash_legend"])

    # anotación pico
    pico_x = chart_x0 + (20 - 6) / 18.0 * (chart_x1 - chart_x0)
    pico_y = chart_y0 + 20
    d.text((pico_x - 80, pico_y), "pico 19-21h",
           fill=P["ink"], font=f["dash_lbl"])


def _draw_kpi_grid(img, x0, y0, w, h, f):
    d = ImageDraw.Draw(img)
    round_rect(d, (x0, y0, x0 + w, y0 + h), radius=12,
               fill=P["paper_warm"], outline=P["ink"], width=3)
    d.text((x0 + 20, y0 + 14), "Métricas clave",
           fill=P["ink"], font=f["dash_h2"])

    cells = [
        ("1.247", "votantes totales"),
        ("73%", "sí global"),
        ("0,8 km", "radio medio al eje"),
        ("12,4%", "participación barrio"),
    ]
    inner_y0 = y0 + 60
    inner_h = h - 70
    cw = (w - 40) // 2
    ch = (inner_h - 16) // 2
    for i, (num, lbl) in enumerate(cells):
        col = i % 2
        row = i // 2
        cx0 = x0 + 20 + col * cw
        cy0 = inner_y0 + row * (ch + 8)
        round_rect(d, (cx0, cy0, cx0 + cw - 12, cy0 + ch),
                   radius=8, fill=P["paper_light"],
                   outline=P["divider"], width=2)
        nw = text_w(d, num, f["dash_kpi"])
        d.text((cx0 + (cw - 12 - nw) // 2, cy0 + 14), num,
               fill=P["ink"], font=f["dash_kpi"])
        lw = text_w(d, lbl, f["dash_kpi_lbl"])
        d.text((cx0 + (cw - 12 - lw) // 2, cy0 + ch - 38), lbl,
               fill=P["muted"], font=f["dash_kpi_lbl"])


def _draw_insight(img, x0, y0, w, h, f):
    d = ImageDraw.Draw(img)
    # fondo destacado ocre cálido
    round_rect(d, (x0, y0, x0 + w, y0 + h), radius=12,
               fill=P["sand"], outline=P["ink"], width=6)
    d.text((x0 + 24, y0 + 20), "Conclusión del modelo:",
           fill=P["ink"], font=f["dash_insight_t"])
    body = ("El apoyo es geográficamente concentrado y inversamente "
            "proporcional a la distancia. El 86% de votantes residentes "
            "a menos de 500 m del eje afectado vota a favor; el apoyo cae "
            "al 41% en barrios a más de 2 km. Pico de participación "
            "19:00–21:00 — los vecinos votan después del trabajo, no en "
            "horario de oficina. Demanda territorial sólida y localizada: "
            "la propuesta tiene mandato del entorno directamente afectado.")
    lines = wrap_text(d, body, f["dash_insight"], w - 60)
    ty = y0 + 70
    for ln in lines[:7]:
        d.text((x0 + 30, ty), ln,
               fill=P["ink"], font=f["dash_insight"])
        ty += 30


# ----- main render ---------------------------------------------------------

def render(cusec: str, target_id: int, pack_root: pathlib.Path,
           out_path: pathlib.Path) -> Dict:
    pack_dir = pack_root / cusec
    if not pack_dir.exists():
        raise SystemExit(f"data pack no encontrado: {pack_dir}")

    img = Image.new("RGBA", (W, H), P["paper_warm"] + (255,))
    d = ImageDraw.Draw(img)
    f = fonts()

    # divider sutil entre top band y dashboard
    d.line((0, TOP_H, W, TOP_H), fill=P["divider"], width=3)

    # smartphones
    draw_koinos_phone(img, PHONE_LEFT_X, PHONE_TOP_OFFSET, pack_dir,
                      target_id, f)
    draw_decidim_phone(img, PHONE_RIGHT_X, PHONE_TOP_OFFSET, f)

    # dashboard
    counts = draw_dashboard(img, 0, DASH_Y, W, DASH_H, pack_dir,
                            target_id, f)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(out_path, "PNG", optimize=True)

    total = sum(counts.values())
    pct = {k: round(v / total * 100, 1) for k, v in counts.items()} \
        if total else {k: 0 for k in counts}
    return {
        "out_path": out_path,
        "color_counts": counts,
        "color_pct": pct,
        "total_manzanas": total,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cusec", default="3501602052")
    ap.add_argument("--manzana", type=int, default=24)
    ap.add_argument("--pack-dir", default=str(DEFAULT_PACK))
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    args = ap.parse_args()

    pack_root = pathlib.Path(args.pack_dir)
    if not pack_root.is_absolute():
        pack_root = ROOT / pack_root
    out_path = pathlib.Path(args.out)
    if not out_path.is_absolute():
        out_path = ROOT / out_path

    res = render(args.cusec, args.manzana, pack_root, out_path)
    print(f"OK -> {res['out_path']}")
    print(f"   manzanas dibujadas: {res['total_manzanas']}")
    for k, v in res["color_counts"].items():
        print(f"   {k:10s} {v:4d}   ({res['color_pct'][k]}%)")


if __name__ == "__main__":
    main()
