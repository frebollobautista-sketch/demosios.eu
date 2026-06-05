"""KOINOS · POLIS — Hero render isométrico (estilo Into the Breach).

Genera UN PNG (1600x1400) con la sección entera renderizada como tablero
iso plano, paleta limitada (4 colores + ink + accents), contornos
gruesos uniformes, sombras planas (sin blur), y dos cards Songkick
flotando sobre manzanas no-hero.

Uso:
    python3 -m packages.mockups.hero
    python3 -m packages.mockups.hero --cusec 3501602052 \
        --out design/secciones/3501602052_hero.png
"""
from __future__ import annotations

import argparse
import json
import math
import pathlib
from typing import Dict, List, Optional, Tuple

from PIL import Image, ImageDraw, ImageFont
from shapely.geometry import LineString, Polygon, box, shape
from shapely.ops import unary_union

ROOT = pathlib.Path(__file__).resolve().parents[2]

from packages.iso.bloque_clustering import simplify_manzana  # noqa: E402

# ----------------------------------------------------------------- canvas
W = 1600
H = 1400
BANNER_H = 60
MARGIN = 80

# ----------------------------------------------------------------- palette
PAPER_WARM = (245, 232, 200)        # #F5E8C8
RECUPERADO_OCRE = (200, 153, 104)   # #C89968
BLOQUEADO_GRIS = (74, 77, 82)       # #4A4D52
STREET = (107, 99, 88)              # #6B6358
INK = (26, 22, 18)                  # #1A1612
ACCENT_NARANJA = (230, 138, 79)     # #E68A4F
ACCENT_MORADO = (159, 79, 230)      # #9F4FE6
WHITE = (255, 255, 255)

# Caras laterales de las piezas iso: INK puro (estilo ITB).
SIDE_DARK = INK

# Anchos de calle por tipo
ROAD_WIDTHS = {
    "primary": 6,
    "secondary": 5,
    "tertiary": 4,
    "residential": 3,
    "service": 2,
    "footway": 2,
    "pedestrian": 2,
    "track": 2,
}

# Iso
COS30 = math.cos(math.radians(30))
SIN30 = 0.5

# Hero / cards
HERO_MANZANA_ID = 24
HERO_LIFT_PX = 4
HERO_RING_W = 3

CARD_W = 320
CARD_H = 120
CARD_RADIUS = 14
CARD_SHADOW_OFFSET = 7

# ----------------------------------------------------------------- fonts


def fonts():
    serif_b = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
        "/System/Library/Fonts/Supplemental/Georgia Bold.ttf",
        "/System/Library/Fonts/Supplemental/Times New Roman Bold.ttf",
    ]
    serif_r = [
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

    return {
        "banner_t":  _try(serif_b, 32),
        "banner_s":  _try(serif_r, 18),
        "card_t":    _try(serif_b, 22),
        "card_d":    _try(serif_r, 16),
    }


def text_w(d, txt, f):
    try:
        bbox = d.textbbox((0, 0), txt, font=f)
        return bbox[2] - bbox[0]
    except Exception:
        return d.textsize(txt, font=f)[0]


# ----------------------------------------------------------------- iso

def make_iso(scale_xy: float, scale_z: float,
             cx_canvas: float, cy_canvas: float):
    def IS(x, y, z):
        return (cx_canvas + (x - z) * COS30 * scale_xy,
                cy_canvas + (x + z) * SIN30 * scale_xy - y * scale_z)
    return IS


# ----------------------------------------------------------------- drawing

def _ring_open(ring):
    pts = list(ring)
    if len(pts) >= 2 and pts[0] == pts[-1]:
        pts = pts[:-1]
    return pts


def draw_flat_shadow(img: Image.Image, IS, ring_xz, *, dx_m: float,
                     dz_m: float):
    """Sombra plana ink puro proyectada al SE.

    Dibuja el contorno de la manzana desplazado en (dx_m, dz_m) sobre
    el plano de suelo (y=0). Color sólido INK (sin alpha gradient).
    """
    pts = _ring_open(ring_xz)
    if len(pts) < 3:
        return
    sh_pts = [IS(x + dx_m, 0, z + dz_m) for x, z in pts]
    d = ImageDraw.Draw(img)
    d.polygon(sh_pts, fill=INK)


def draw_iso_tile(img: Image.Image, IS, ring_xz, h_m: float,
                  top_color: Tuple[int, int, int], *,
                  stroke: int = 5, lift_px: int = 0,
                  ring_extra_color: Optional[Tuple[int, int, int]] = None,
                  ring_extra_w: int = 3):
    """Pieza iso (top + caras) con contorno INK uniforme.

    Caras laterales en INK puro, techo en color sólido. Sin gradientes.
    Si lift_px > 0, eleva la pieza entera ese desplazamiento en pantalla.
    Si ring_extra_color, dibuja un anillo ADICIONAL sobre el techo.
    """
    pts = _ring_open(ring_xz)
    n = len(pts)
    if n < 3:
        return

    def shift(p):
        return (p[0], p[1] - lift_px)

    bot = [shift(IS(x, 0, z)) for x, z in pts]
    top = [shift(IS(x, h_m, z)) for x, z in pts]

    d = ImageDraw.Draw(img)

    # Caras laterales: solo las visibles (sur/este).
    for k in range(n):
        ax, az = pts[k]
        bx, bz = pts[(k + 1) % n]
        nx_, nz_ = (bz - az), -(bx - ax)
        if nx_ + nz_ <= 0:
            continue
        d.polygon([bot[k], bot[(k + 1) % n], top[(k + 1) % n], top[k]],
                  fill=SIDE_DARK, outline=INK, width=stroke)

    # Techo
    d.polygon(top, fill=top_color, outline=INK, width=stroke)

    # Anillo accent extra
    if ring_extra_color is not None:
        d.line(top + [top[0]], fill=ring_extra_color, width=ring_extra_w)


# ----------------------------------------------------------------- card

def draw_event_card(img: Image.Image, anchor_screen: Tuple[int, int],
                    color: Tuple[int, int, int],
                    title_lines: List[str], when_label: str,
                    F: Dict, *, place: str = "above",
                    dx: int = 0, dy: int = 0):
    """Card Songkick con sombra plana ink al SE y pico hacia el anchor."""
    ax, ay = anchor_screen
    if place == "above":
        bx0 = ax - CARD_W // 2 + dx
        by0 = ay - CARD_H - 36 + dy
    else:
        bx0 = ax - CARD_W // 2 + dx
        by0 = ay + 36 + dy
    bx0 = max(20, min(W - CARD_W - 20, bx0))
    by0 = max(BANNER_H + 12, min(H - CARD_H - 20, by0))
    bx1 = bx0 + CARD_W
    by1 = by0 + CARD_H

    d = ImageDraw.Draw(img)

    # Sombra plana ink al SE
    so = CARD_SHADOW_OFFSET
    d.rounded_rectangle((bx0 + so, by0 + so, bx1 + so, by1 + so),
                        radius=CARD_RADIUS, fill=INK)

    # Pico apuntando al anchor (sombra)
    tip_w = 16
    tip_x = max(bx0 + 30, min(bx1 - 30, ax))
    if place == "above":
        d.polygon([
            (tip_x - tip_w + so, by1 + so),
            (tip_x + tip_w + so, by1 + so),
            (ax + so, ay + so - 2),
        ], fill=INK)
    else:
        d.polygon([
            (tip_x - tip_w + so, by0 + so),
            (tip_x + tip_w + so, by0 + so),
            (ax + so, ay + so - 2),
        ], fill=INK)

    # Card body
    d.rounded_rectangle((bx0, by0, bx1, by1), radius=CARD_RADIUS,
                        fill=color, outline=INK, width=5)

    # Pico color
    if place == "above":
        d.polygon([
            (tip_x - tip_w, by1),
            (tip_x + tip_w, by1),
            (ax, ay - 2),
        ], fill=color)
        d.line([(tip_x - tip_w, by1), (ax, ay - 2)], fill=INK, width=4)
        d.line([(tip_x + tip_w, by1), (ax, ay - 2)], fill=INK, width=4)
    else:
        d.polygon([
            (tip_x - tip_w, by0),
            (tip_x + tip_w, by0),
            (ax, ay - 2),
        ], fill=color)
        d.line([(tip_x - tip_w, by0), (ax, ay - 2)], fill=INK, width=4)
        d.line([(tip_x + tip_w, by0), (ax, ay - 2)], fill=INK, width=4)

    # Borde blanco interno
    d.rounded_rectangle((bx0 + 4, by0 + 4, bx1 - 4, by1 - 4),
                        radius=max(2, CARD_RADIUS - 4),
                        outline=WHITE, width=2)

    # Título (hasta 2 líneas)
    pad = 16
    cur_y = by0 + 14
    for line in title_lines[:2]:
        if not line:
            cur_y += 30
            continue
        f = F["card_t"]
        line_use = line
        while text_w(d, line_use, f) > CARD_W - 2 * pad and len(line_use) > 4:
            line_use = line_use[:-1]
        d.text((bx0 + pad, cur_y), line_use, fill=WHITE, font=f)
        cur_y += 30

    # Fecha
    when_y = by1 - 32
    d.text((bx0 + pad, when_y), when_label,
           fill=(255, 255, 255), font=F["card_d"])

    # Punto de anclaje encima de la manzana
    r = 6
    d.ellipse((ax - r, ay - r, ax + r, ay + r),
              fill=color, outline=INK, width=3)

    return (bx0, by0, bx1, by1)


# ----------------------------------------------------------------- main

def render_hero(cusec: str, pack_dir: pathlib.Path,
                out_path: pathlib.Path) -> Dict:
    F = fonts()

    # ---- Datos
    manz_gj = json.load(open(pack_dir / "manzanas.geojson",
                             encoding="utf-8"))
    roads_gj = json.load(open(pack_dir / "roads.geojson",
                              encoding="utf-8"))

    manzanas = []
    for f in manz_gj["features"]:
        poly = shape(f["geometry"])
        poly_s = simplify_manzana(f, tolerance=4.0)
        if poly_s is None or poly_s.is_empty:
            poly_s = poly
        p = f["properties"]
        manzanas.append({
            "id": int(p["id"]),
            "h": float(p.get("height_median_m") or 6.0),
            "n": int(p.get("building_count") or 0),
            "area": float(p.get("area_m2") or 0.0),
            "poly": poly_s,
            "raw_poly": poly,
        })

    # 10 bloqueadas: menor building_count, desempate por área DESC para
    # asegurar visibilidad ("manzanas grandes pero abandonadas").
    bloq_sorted = sorted(manzanas, key=lambda m: (m["n"], -m["area"]))
    bloq_ids = set(m["id"] for m in bloq_sorted[:10])

    # ---- bbox y escala
    union_poly = unary_union([m["raw_poly"] for m in manzanas])
    minx, miny, maxx, maxy = union_poly.bounds
    pad_m = 18.0
    minx -= pad_m
    miny -= pad_m
    maxx += pad_m
    maxy += pad_m
    bw = maxx - minx
    bh = maxy - miny
    h_max = max(m["h"] for m in manzanas) + 4.0

    span_w = (bw + bh) * COS30
    span_h = (bw + bh) * SIN30 + h_max * 1.5

    avail_w = W - 2 * MARGIN
    avail_h = H - BANNER_H - 2 * MARGIN
    sxy = min(avail_w / span_w, avail_h / span_h)
    sz = sxy * 1.4

    mx = (minx + maxx) / 2
    my = (miny + maxy) / 2
    cx_canvas = W / 2 - (mx - my) * COS30 * sxy
    cy_canvas = (BANNER_H + (H - BANNER_H) / 2
                 - (mx + my) * SIN30 * sxy
                 - (h_max * sz) * 0.25)
    IS = make_iso(sxy, sz, cx_canvas, cy_canvas)

    # ---- Canvas
    img = Image.new("RGB", (W, H), PAPER_WARM)
    d = ImageDraw.Draw(img)

    # Banner
    d.rectangle((0, 0, W, BANNER_H), fill=INK)
    title = "KOINOS · POLIS"
    d.text((24, (BANNER_H - 36) // 2), title, fill=WHITE,
           font=F["banner_t"])
    sub = f"Las Canteras · sección {cusec[-3:]} · {len(manzanas)} manzanas"
    sw = text_w(d, sub, F["banner_s"])
    d.text((W - 24 - sw, (BANNER_H - 22) // 2 + 2), sub,
           fill=WHITE, font=F["banner_s"])

    img_rgba = img.convert("RGBA")
    d = ImageDraw.Draw(img_rgba)

    # ---- Calles (debajo de manzanas) — clipped al bbox
    bbox_clip = box(minx, miny, maxx, maxy)
    road_order = ["service", "footway", "pedestrian", "track",
                  "residential", "tertiary", "secondary", "primary"]
    roads_by_type = {t: [] for t in road_order}
    for f in roads_gj["features"]:
        rtype = f["properties"].get("type", "service")
        if rtype not in roads_by_type:
            continue
        try:
            line = LineString(f["geometry"]["coordinates"])
        except Exception:
            continue
        if not line.intersects(bbox_clip):
            continue
        clipped = line.intersection(bbox_clip)
        if clipped.is_empty:
            continue
        if clipped.geom_type == "LineString":
            roads_by_type[rtype].append(list(clipped.coords))
        elif clipped.geom_type == "MultiLineString":
            for g in clipped.geoms:
                roads_by_type[rtype].append(list(g.coords))

    for rtype in road_order:
        w = ROAD_WIDTHS.get(rtype, 2)
        for coords in roads_by_type[rtype]:
            pts = [IS(x, 0, z) for x, z in coords]
            if len(pts) >= 2:
                d.line(pts, fill=STREET, width=w)

    # ---- Sombras + piezas (painter's order)
    shadow_dx = 4.0  # metros
    shadow_dz = 4.0
    manz_sorted = sorted(manzanas,
                         key=lambda m: (m["raw_poly"].centroid.x
                                        + m["raw_poly"].centroid.y))

    # Paso 1: sombras planas
    for m in manz_sorted:
        ring = list(m["poly"].exterior.coords)
        draw_flat_shadow(img_rgba, IS, ring,
                         dx_m=shadow_dx, dz_m=shadow_dz)

    # Paso 2: piezas iso
    for m in manz_sorted:
        ring = list(m["poly"].exterior.coords)
        h_use = max(4.0, m["h"])
        if m["id"] == HERO_MANZANA_ID:
            color = RECUPERADO_OCRE
            draw_iso_tile(img_rgba, IS, ring, h_use, color,
                          stroke=5, lift_px=HERO_LIFT_PX,
                          ring_extra_color=ACCENT_NARANJA,
                          ring_extra_w=HERO_RING_W)
        else:
            color = (BLOQUEADO_GRIS if m["id"] in bloq_ids
                     else RECUPERADO_OCRE)
            draw_iso_tile(img_rgba, IS, ring, h_use, color,
                          stroke=5, lift_px=0)

    # ---- Contorno perímetro de la sección entera
    if union_poly.geom_type == "Polygon":
        sec_rings = [list(union_poly.exterior.coords)]
    else:
        sec_rings = [list(g.exterior.coords) for g in union_poly.geoms]
    for ring in sec_rings:
        pts = [IS(x, 0, z) for x, z in ring]
        if len(pts) >= 2:
            d.line(pts + [pts[0]], fill=INK, width=6)

    # ---- Cards Songkick
    anchors = {
        "card1": next((m for m in manzanas if m["id"] == 16), None),
        "card2": next((m for m in manzanas if m["id"] == 43), None),
    }
    if anchors["card1"] is None:
        west = sorted([m for m in manzanas
                       if m["id"] != HERO_MANZANA_ID
                       and m["id"] not in bloq_ids],
                      key=lambda m: m["raw_poly"].centroid.x)
        anchors["card1"] = west[0] if west else None
    if anchors["card2"] is None:
        se = sorted([m for m in manzanas
                     if m["id"] != HERO_MANZANA_ID
                     and m["id"] not in bloq_ids],
                    key=lambda m: -(m["raw_poly"].centroid.x
                                    - m["raw_poly"].centroid.y))
        anchors["card2"] = se[0] if se else None

    def anchor_screen(m):
        c = m["raw_poly"].centroid
        h = max(4.0, m["h"])
        return tuple(int(v) for v in IS(c.x, h, c.y))

    boxes = []
    if anchors["card1"] is not None:
        a = anchor_screen(anchors["card1"])
        b = draw_event_card(
            img_rgba, a, ACCENT_MORADO,
            ["Concierto OFGC", "Mahler"],
            "Hoy · 20:30", F, place="above", dx=0, dy=0)
        boxes.append(("card1", anchors["card1"]["id"], b))
    if anchors["card2"] is not None:
        a = anchor_screen(anchors["card2"])
        b = draw_event_card(
            img_rgba, a, ACCENT_NARANJA,
            ["Asamblea vecinal", ""],
            "Mañana · 19:00", F, place="below", dx=0, dy=0)
        boxes.append(("card2", anchors["card2"]["id"], b))

    # Sanity: las cards no deben solapar la manzana 24.
    hero_m = next(m for m in manzanas if m["id"] == HERO_MANZANA_ID)
    hero_ring = list(hero_m["poly"].exterior.coords)
    hero_top_pts = [IS(x, max(4.0, hero_m["h"]), z) for x, z in hero_ring]
    hero_xs = [p[0] for p in hero_top_pts]
    hero_ys = [p[1] for p in hero_top_pts]
    hero_bbox_screen = (min(hero_xs), min(hero_ys),
                        max(hero_xs), max(hero_ys))
    overlaps = []
    for name, mid, (bx0, by0, bx1, by1) in boxes:
        ox0 = max(bx0, hero_bbox_screen[0])
        oy0 = max(by0, hero_bbox_screen[1])
        ox1 = min(bx1, hero_bbox_screen[2])
        oy1 = min(by1, hero_bbox_screen[3])
        if ox1 > ox0 and oy1 > oy0:
            overlaps.append((name, mid, ox1 - ox0, oy1 - oy0))
            print(f"WARN: card {name} (manz {mid}) solapa hero manz "
                  f"{HERO_MANZANA_ID}: overlap "
                  f"({ox1 - ox0:.0f}x{oy1 - oy0:.0f} px)")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img_rgba.convert("RGB").save(out_path, "PNG", optimize=True)

    return {
        "out_path": out_path,
        "n_manzanas": len(manzanas),
        "bloq_ids": sorted(bloq_ids),
        "card1_anchor": anchors["card1"]["id"] if anchors["card1"] else None,
        "card2_anchor": anchors["card2"]["id"] if anchors["card2"] else None,
        "hero_manzana": HERO_MANZANA_ID,
        "card_overlaps_hero": overlaps,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cusec", default="3501602052")
    ap.add_argument("--pack-root",
                    default=str(ROOT / "public" / "sections_pack"))
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    pack_root = pathlib.Path(args.pack_root)
    if not pack_root.is_absolute():
        pack_root = ROOT / pack_root
    pack_dir = pack_root / args.cusec
    if not pack_dir.exists():
        raise SystemExit(f"data pack no encontrado: {pack_dir}")

    if args.out:
        out_path = pathlib.Path(args.out)
    else:
        out_path = ROOT / "design" / "secciones" / f"{args.cusec}_hero.png"
    if not out_path.is_absolute():
        out_path = ROOT / out_path

    res = render_hero(args.cusec, pack_dir, out_path)
    print(f"OK -> {res['out_path']}")
    print(f"  manzanas:        {res['n_manzanas']}")
    print(f"  bloqueadas (10): {res['bloq_ids']}")
    print(f"  card1 ancla:     manz {res['card1_anchor']}")
    print(f"  card2 ancla:     manz {res['card2_anchor']}")
    print(f"  hero manzana:    {res['hero_manzana']}")
    if res['card_overlaps_hero']:
        print(f"  WARN solapes:    {res['card_overlaps_hero']}")


if __name__ == "__main__":
    main()
