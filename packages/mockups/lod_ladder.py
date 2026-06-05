"""KOINOS · POLIS — Escalera de niveles isométricos.

Genera UN PNG horizontal con 5 paneles isométricos mostrando el zoom
desde manzana hasta isla:

  P1. MANZANA (manzana 24 sección 3501602052) — render con catálogo
      de arquetipos.
  P2. SECCIÓN CENSAL (3501602052) — manzanas como un único prisma cada una.
  P3. DISTRITO (02 LPGC, ~58 secciones) — secciones como tiles iso.
  P4. MUNICIPIO (35016 LPGC, 274 secciones) — secciones casi planas
      con bordes de distrito reforzados.
  P5. ISLA (Gran Canaria, 21 municipios) — un token iso por municipio.

Uso:
    python3 -m packages.mockups.lod_ladder
    python3 -m packages.mockups.lod_ladder --cusec 3501602052 --manzana 24
"""
from __future__ import annotations

import argparse
import json
import math
import pathlib
import sys
from typing import Dict, List, Tuple

from PIL import Image, ImageDraw, ImageFont
from shapely.geometry import (
    LineString, MultiLineString, Polygon, box, shape,
)
from shapely.ops import unary_union

ROOT = pathlib.Path(__file__).resolve().parents[2]

from packages.iso import archetypes as AC  # noqa: E402
from packages.mockups.zoom import COS30, SIN30, PALETTE as P, hex2rgb  # noqa: E402

PANEL_W = 1100
PANEL_H = 1300
N_PANELS = 5
BANNER_H = 100
SEP_W = 0
TOTAL_W = PANEL_W * N_PANELS
TOTAL_H = PANEL_H + BANNER_H
LABEL_BAND_H = 90

DEFAULT_PACK = ROOT / "public" / "sections_pack"
DEFAULT_OUT = ROOT / "design" / "secciones" / "lod_ladder_3501602052.png"
DEFAULT_CUSEC = "3501602052"
DEFAULT_MANZANA = 24

GRAN_CANARIA_MUN = {
    "001", "002", "005", "006", "008", "009", "011", "012", "013", "016",
    "019", "020", "021", "022", "023", "025", "026", "027", "031", "032",
    "033",
}

MUN_POPULATION = {
    "001": 5500,    "002": 31000,  "005": 1100,   "006": 38000,
    "008": 7700,    "009": 24500,  "011": 32000,  "012": 21000,
    "013": 8000,    "016": 380000, "019": 53000,  "020": 7100,
    "021": 19000,   "022": 75000,  "023": 14000,  "025": 1800,
    "026": 102000,  "027": 12500,  "031": 9000,   "032": 4000,
    "033": 7700,
}


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
    candidates_sans = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]

    def _try(cands, size):
        for c in cands:
            try:
                return ImageFont.truetype(c, size)
            except Exception:
                continue
        return ImageFont.load_default()

    return {
        "banner":    _try(candidates_b, 38),
        "panel_lbl": _try(candidates_b, 22),
        "panel_sub": _try(candidates_r, 17),
        "small":     _try(candidates_r, 14),
        "muni":      _try(candidates_sans, 13),
        "muni_big":  _try(candidates_sans, 16),
        "level":     _try(candidates_b, 20),
    }


def text_w(d, txt, f):
    try:
        bbox = d.textbbox((0, 0), txt, font=f)
        return bbox[2] - bbox[0]
    except Exception:
        return d.textsize(txt, font=f)[0]


def make_iso(scale_xy, scale_z, cx_canvas, cy_canvas):
    def IS(x, y, z):
        return (cx_canvas + (x - z) * COS30 * scale_xy,
                cy_canvas + (x + z) * SIN30 * scale_xy - y * scale_z)
    return IS


def make_enu(lng0, lat0):
    R = 6378137.0
    cos_lat = math.cos(math.radians(lat0))

    def to_xy(lng, lat):
        x = math.radians(lng - lng0) * R * cos_lat
        z = -math.radians(lat - lat0) * R
        return (x, z)
    return to_xy


def transform_geom(coords, to_xy, geom_type):
    if geom_type == "Point":
        return to_xy(coords[0], coords[1])
    if geom_type == "LineString":
        return [to_xy(c[0], c[1]) for c in coords]
    if geom_type == "Polygon":
        return [[to_xy(c[0], c[1]) for c in ring] for ring in coords]
    if geom_type == "MultiPolygon":
        return [[[to_xy(c[0], c[1]) for c in ring] for ring in poly]
                for poly in coords]
    if geom_type == "MultiLineString":
        return [[to_xy(c[0], c[1]) for c in ls] for ls in coords]
    return coords


def shape_local(feat, to_xy):
    g = feat["geometry"]
    t = g["type"]
    coords = transform_geom(g["coordinates"], to_xy, t)
    if t == "Polygon":
        return Polygon(coords[0], coords[1:] if len(coords) > 1 else None)
    if t == "MultiPolygon":
        from shapely.geometry import MultiPolygon
        return MultiPolygon([Polygon(p[0], p[1:] if len(p) > 1 else None)
                             for p in coords])
    if t == "LineString":
        return LineString(coords)
    if t == "MultiLineString":
        return MultiLineString(coords)
    return None


def lerp_color(c0, c1, t):
    return tuple(int(c0[i] + (c1[i] - c0[i]) * t) for i in range(3))


def density_palette(t):
    if t < 0.5:
        return lerp_color((228, 212, 178), (208, 178, 132), t * 2)
    return lerp_color((208, 178, 132), (176, 120, 64), (t - 0.5) * 2)


def draw_simple_prism(img, IS, ring_xz, h, top_color, side_l, side_r,
                      ink, *, stroke=2, shadow=None):
    pts = list(ring_xz)
    if len(pts) >= 2 and pts[0] == pts[-1]:
        pts = pts[:-1]
    if len(pts) < 3:
        return

    if shadow is not None:
        sx, sz = shadow["offset"]
        sh_pts = [IS(x + sx, 0, z + sz) for x, z in pts]
        layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
        ImageDraw.Draw(layer).polygon(sh_pts, fill=(34, 29, 24, shadow["alpha"]))
        img.alpha_composite(layer)

    bot = [IS(x, 0, z) for x, z in pts]
    top = [IS(x, h, z) for x, z in pts]
    n = len(pts)
    d = ImageDraw.Draw(img)
    for k in range(n):
        ax, az = pts[k]
        bx, bz = pts[(k + 1) % n]
        nx_, nz_ = (bz - az), -(bx - ax)
        if nx_ + nz_ <= 0:
            continue
        tilt = nx_ / (abs(nx_) + abs(nz_) + 1e-6)
        face = side_r if tilt > 0 else side_l
        d.polygon([bot[k], bot[(k + 1) % n], top[(k + 1) % n], top[k]],
                  fill=face, outline=ink, width=stroke)
    d.polygon(top, fill=top_color, outline=ink, width=stroke)


def poly_outer_rings(poly):
    rings = []
    if poly is None or poly.is_empty:
        return rings
    if poly.geom_type == "Polygon":
        rings.append(list(poly.exterior.coords))
    elif poly.geom_type == "MultiPolygon":
        for g in poly.geoms:
            rings.append(list(g.exterior.coords))
    elif poly.geom_type == "GeometryCollection":
        for g in poly.geoms:
            if g.geom_type == "Polygon":
                rings.append(list(g.exterior.coords))
    return rings


def draw_flat_tile(img, IS, ring_xz, top_color, ink, stroke=2):
    pts = list(ring_xz)
    if len(pts) >= 2 and pts[0] == pts[-1]:
        pts = pts[:-1]
    if len(pts) < 3:
        return
    sc = [IS(x, 0, z) for x, z in pts]
    d = ImageDraw.Draw(img)
    d.polygon(sc, fill=top_color, outline=ink, width=stroke)


def draw_banner(canvas, F):
    d = ImageDraw.Draw(canvas)
    d.rectangle((0, 0, TOTAL_W, BANNER_H), fill=hex2rgb("#5A4A38"))
    title = "KOINOS · POLIS — escalera de niveles isométricos · de la manzana a la isla"
    f = F["banner"]
    w = text_w(d, title, f)
    d.text(((TOTAL_W - w) // 2, (BANNER_H - 50) // 2), title,
           fill=P["paper"], font=f)


def draw_panel_label(canvas, idx, level_name, sublabel, F):
    x0 = idx * PANEL_W
    y0 = BANNER_H + PANEL_H - LABEL_BAND_H
    d = ImageDraw.Draw(canvas)
    d.rectangle((x0, y0, x0 + PANEL_W, y0 + LABEL_BAND_H),
                fill=hex2rgb("#3A2E22"))
    f1 = F["level"]
    f2 = F["panel_sub"]
    w1 = text_w(d, level_name, f1)
    d.text((x0 + (PANEL_W - w1) // 2, y0 + 12), level_name,
           fill=hex2rgb("#E8D5A8"), font=f1)
    w2 = text_w(d, sublabel, f2)
    d.text((x0 + (PANEL_W - w2) // 2, y0 + 50), sublabel,
           fill=P["paper"], font=f2)


def draw_step_badge(canvas, idx, F):
    x0 = idx * PANEL_W
    y0 = BANNER_H + 16
    d = ImageDraw.Draw(canvas)
    r = 22
    cx = x0 + 30
    cy = y0 + r
    d.ellipse((cx - r, cy - r, cx + r, cy + r),
              fill=hex2rgb("#C85438"), outline=P["ink"], width=2)
    f = F["panel_lbl"]
    txt = str(idx + 1)
    w = text_w(d, txt, f)
    d.text((cx - w // 2, cy - 14), txt, fill=P["paper"], font=f)


def draw_arrow(canvas, idx_left):
    x_mid = (idx_left + 1) * PANEL_W
    y_mid = BANNER_H + PANEL_H // 2
    d = ImageDraw.Draw(canvas)
    r = 28
    d.ellipse((x_mid - r, y_mid - r, x_mid + r, y_mid + r),
              fill=P["paper"], outline=P["ocre"], width=3)
    arrow = [
        (x_mid - 10, y_mid - 9),
        (x_mid + 8,  y_mid),
        (x_mid - 10, y_mid + 9),
    ]
    d.polygon(arrow, fill=P["ocre"], outline=P["ocre_dk"])


def render_panel_manzana(canvas, panel_x0, panel_y0, panel_w, panel_h,
                         pack_dir, target_id, F):
    panel_y_map_top = panel_y0 + 30
    panel_y_map_bot = panel_y0 + panel_h - LABEL_BAND_H - 30
    map_h = panel_y_map_bot - panel_y_map_top

    d = ImageDraw.Draw(canvas)
    d.rectangle((panel_x0, panel_y0, panel_x0 + panel_w,
                 panel_y0 + panel_h - LABEL_BAND_H), fill=P["cream"])

    manz_gj = json.load(open(pack_dir / "manzanas.geojson", encoding="utf-8"))
    bldg_gj = json.load(open(pack_dir / "buildings.geojson", encoding="utf-8"))
    roads_gj = json.load(open(pack_dir / "roads.geojson", encoding="utf-8"))

    manz: Dict[int, Polygon] = {}
    for f in manz_gj["features"]:
        manz[f["properties"]["id"]] = shape(f["geometry"])
    target_poly = manz[target_id]

    pad = 35.0
    minx, miny, maxx, maxy = target_poly.bounds
    bw = (maxx - minx) + 2 * pad
    bh = (maxy - miny) + 2 * pad
    span_w = (bw + bh) * COS30
    span_h = (bw + bh) * SIN30 + 30 * 1.6
    avail_w = panel_w - 60
    avail_h = map_h - 30
    sxy = min(avail_w / span_w, avail_h / span_h) * 0.85
    sz = sxy * 1.6
    mx = (minx + maxx) / 2
    my = (miny + maxy) / 2
    cx_canvas = panel_x0 + panel_w / 2 - (mx - my) * COS30 * sxy
    cy_canvas = panel_y_map_top + map_h / 2 - (mx + my) * SIN30 * sxy
    IS = make_iso(sxy, sz, cx_canvas, cy_canvas)

    bbox_hi = box(minx - 60, miny - 60, maxx + 60, maxy + 60)

    others = sorted(
        [(mid, p) for mid, p in manz.items() if mid != target_id],
        key=lambda kv: kv[1].distance(target_poly),
    )[:8]
    floor_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    fd = ImageDraw.Draw(floor_layer)
    for mid, poly in others:
        ring = list(poly.exterior.coords)
        pts = [IS(x_, 0, z_) for x_, z_ in ring]
        if len(pts) >= 3:
            fd.polygon(pts, fill=P["sand_lt"] + (170,),
                       outline=P["sand"] + (220,))
    ring = list(target_poly.exterior.coords)
    pts = [IS(x_, 0, z_) for x_, z_ in ring]
    if len(pts) >= 3:
        fd.polygon(pts, fill=P["sand_lt"] + (255,),
                   outline=P["ocre_dk"] + (240,))
    canvas.alpha_composite(floor_layer)

    road_col = hex2rgb("#8A8276")
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
        if clipped.geom_type == "LineString":
            geoms = [list(clipped.coords)]
        elif clipped.geom_type == "MultiLineString":
            geoms = [list(g.coords) for g in clipped.geoms]
        else:
            continue
        for coords in geoms:
            pts = [IS(x_, 0, z_) for x_, z_ in coords]
            if len(pts) >= 2:
                d.line(pts, fill=road_col, width=2)

    target_buildings = []
    neigh_buildings = []
    for f in bldg_gj["features"]:
        ring_b = f["geometry"]["coordinates"][0]
        try:
            poly = Polygon(ring_b)
        except Exception:
            continue
        if not poly.is_valid or poly.is_empty:
            continue
        if not poly.intersects(bbox_hi):
            continue
        c = poly.centroid
        b = {
            "id": f["properties"]["id"],
            "ring": [(p[0], p[1]) for p in ring_b],
            "h": float(f["properties"].get("height_m") or 6.0),
            "category": f["properties"].get("category", "residencial"),
            "manzana_id": f["properties"].get("manzana_id"),
            "centroid": (c.x, c.y),
            "area": poly.area,
            "props": f["properties"],
        }
        if b["manzana_id"] == target_id:
            target_buildings.append(b)
        elif bbox_hi.contains(c):
            neigh_buildings.append(b)

    def order_key(b):
        cx_, cz_ = b["centroid"]
        return cx_ + cz_

    for b in sorted(neigh_buildings, key=order_key):
        atype = AC.classify_building(b["props"], b["area"])
        rot, long_m, short_m = AC.axis_angle_from_ring(b["ring"])
        canon_w, canon_d, canon_h = AC.ARCHETYPE_DIMS[atype]
        long_canon = max(canon_w, canon_d)
        scale_xy = max(0.4, long_m / long_canon)
        scale_z = 1.0
        if canon_h > 0:
            target_h = b["h"] if b["h"] > 0 else canon_h
            scale_z = max(0.55, min(1.6, target_h / canon_h))
        sub = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        AC.ARCHETYPES[atype](sub, IS, P["ink"],
                             cx_m=b["centroid"][0], cz_m=b["centroid"][1],
                             scale_xy=scale_xy, scale_z=scale_z, rot_rad=rot)
        alpha = sub.split()[3].point(lambda v: int(v * 0.55))
        sub.putalpha(alpha)
        canvas.alpha_composite(sub)

    archetype_dist = {}
    for b in sorted(target_buildings, key=order_key):
        atype = AC.classify_building(b["props"], b["area"])
        archetype_dist[atype] = archetype_dist.get(atype, 0) + 1
        rot, long_m, short_m = AC.axis_angle_from_ring(b["ring"])
        canon_w, canon_d, canon_h = AC.ARCHETYPE_DIMS[atype]
        long_canon = max(canon_w, canon_d)
        scale_xy = max(0.4, long_m / long_canon)
        scale_z = 1.0
        if canon_h > 0:
            target_h = b["h"] if b["h"] > 0 else canon_h
            scale_z = max(0.55, min(1.6, target_h / canon_h))
        AC.ARCHETYPES[atype](canvas, IS, P["ink"],
                             cx_m=b["centroid"][0], cz_m=b["centroid"][1],
                             scale_xy=scale_xy, scale_z=scale_z, rot_rad=rot)

    return {
        "n_target_buildings": len(target_buildings),
        "n_neigh_buildings": len(neigh_buildings),
        "archetype_dist": archetype_dist,
    }


def render_panel_seccion(canvas, panel_x0, panel_y0, panel_w, panel_h,
                         pack_dir, hero_manz_id, F):
    panel_y_map_top = panel_y0 + 30
    panel_y_map_bot = panel_y0 + panel_h - LABEL_BAND_H - 30
    map_h = panel_y_map_bot - panel_y_map_top

    d = ImageDraw.Draw(canvas)
    d.rectangle((panel_x0, panel_y0, panel_x0 + panel_w,
                 panel_y0 + panel_h - LABEL_BAND_H), fill=P["cream"])

    manz_gj = json.load(open(pack_dir / "manzanas.geojson", encoding="utf-8"))
    bldg_gj = json.load(open(pack_dir / "buildings.geojson", encoding="utf-8"))
    roads_gj = json.load(open(pack_dir / "roads.geojson", encoding="utf-8"))
    section_gj = json.load(open(pack_dir / "section.geojson", encoding="utf-8"))

    section_poly = shape(section_gj["features"][0]["geometry"])

    comm_per_manz = {}
    for b in bldg_gj["features"]:
        mid = b["properties"].get("manzana_id")
        cat = b["properties"].get("category", "")
        if cat in ("comercio", "restauracion", "alojamiento", "finanzas"):
            comm_per_manz[mid] = comm_per_manz.get(mid, 0) + 1

    manzanas = []
    for f in manz_gj["features"]:
        poly = shape(f["geometry"])
        manzanas.append({
            "id": f["properties"]["id"],
            "h_med": float(f["properties"].get("height_median_m") or 6.0),
            "n": int(f["properties"].get("building_count") or 0),
            "poly": poly,
            "comm": comm_per_manz.get(f["properties"]["id"], 0),
        })

    minx, miny, maxx, maxy = section_poly.bounds
    pad = 25.0
    bw = (maxx - minx) + 2 * pad
    bh = (maxy - miny) + 2 * pad
    h_max = max(m["h_med"] for m in manzanas) * 1.0
    span_w = (bw + bh) * COS30
    span_h = (bw + bh) * SIN30 + h_max * 1.6
    avail_w = panel_w - 60
    avail_h = map_h - 40
    sxy = min(avail_w / span_w, avail_h / span_h) * 1.0
    sz = sxy * 1.4
    mx = (minx + maxx) / 2
    my = (miny + maxy) / 2
    cx_canvas = panel_x0 + panel_w / 2 - (mx - my) * COS30 * sxy
    cy_canvas = panel_y_map_top + map_h / 2 - (mx + my) * SIN30 * sxy
    IS = make_iso(sxy, sz, cx_canvas, cy_canvas)

    sec_ring = list(section_poly.exterior.coords)
    sec_pts = [IS(x_, 0, z_) for x_, z_ in sec_ring]
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).polygon(sec_pts, fill=P["cream"] + (255,),
                                  outline=P["ocre"] + (255,))
    canvas.alpha_composite(layer)
    ImageDraw.Draw(canvas).line(sec_pts + [sec_pts[0]],
                                fill=P["ocre"], width=2)

    bbox_section = box(minx - 5, miny - 5, maxx + 5, maxy + 5)
    road_col = hex2rgb("#8A8276")
    for f in roads_gj["features"]:
        try:
            line = LineString(f["geometry"]["coordinates"])
        except Exception:
            continue
        if not line.intersects(bbox_section):
            continue
        clipped = line.intersection(bbox_section)
        if clipped.is_empty:
            continue
        if clipped.geom_type == "LineString":
            geoms = [list(clipped.coords)]
        elif clipped.geom_type == "MultiLineString":
            geoms = [list(g.coords) for g in clipped.geoms]
        else:
            continue
        for coords in geoms:
            pts = [IS(x_, 0, z_) for x_, z_ in coords]
            if len(pts) >= 2:
                ImageDraw.Draw(canvas).line(pts, fill=road_col, width=2)

    manzanas_sorted = sorted(manzanas,
                             key=lambda m: m["poly"].centroid.x + m["poly"].centroid.y)

    sand_top = (216, 196, 158)
    sand_lt = (236, 218, 184)
    sand_dk = (180, 162, 130)
    blue_tint_top = (200, 200, 184)
    blue_tint_lt = (220, 220, 200)
    blue_tint_dk = (162, 162, 148)

    for m in manzanas_sorted:
        ring = list(m["poly"].exterior.coords)
        h_use = max(4.0, m["h_med"])
        if m["comm"] > 0:
            top, sl, sr = blue_tint_top, blue_tint_lt, blue_tint_dk
        else:
            t = min(1.0, m["n"] / 35.0)
            top = lerp_color(sand_lt, sand_top, t)
            sl = lerp_color((230, 212, 178), (210, 192, 154), t)
            sr = lerp_color(sand_dk, (160, 142, 110), t)
        draw_simple_prism(canvas, IS, ring, h_use, top, sl, sr, P["ink"],
                          stroke=2, shadow={"offset": (1.6, 1.6), "alpha": 110})

    hero = next((m for m in manzanas if m["id"] == hero_manz_id), None)
    if hero:
        ring = list(hero["poly"].exterior.coords)
        aura = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        h_use = max(4.0, hero["h_med"])
        glow_pts_floor = [IS(x_, 0, z_) for x_, z_ in ring]
        ImageDraw.Draw(aura).polygon(glow_pts_floor,
                                     fill=(0, 0, 0, 0),
                                     outline=hex2rgb("#C85438") + (255,))
        ad = ImageDraw.Draw(aura)
        for w_ in (8, 5, 3):
            ad.line(glow_pts_floor + [glow_pts_floor[0]],
                    fill=hex2rgb("#C85438") + (90 if w_ == 8 else 200,),
                    width=w_)
        top_pts = [IS(x_, h_use, z_) for x_, z_ in ring]
        ad.polygon(top_pts, fill=hex2rgb("#E6A07A") + (255,),
                   outline=P["ink"] + (255,))
        n = len(ring) - 1 if ring[0] == ring[-1] else len(ring)
        rxz = ring[:-1] if ring[0] == ring[-1] else ring
        for k in range(len(rxz)):
            ax, az = rxz[k]
            bx, bz = rxz[(k + 1) % len(rxz)]
            nx_, nz_ = (bz - az), -(bx - ax)
            if nx_ + nz_ <= 0:
                continue
            tilt = nx_ / (abs(nx_) + abs(nz_) + 1e-6)
            face_col = hex2rgb("#D88A66") if tilt > 0 else hex2rgb("#B5754F")
            pts4 = [
                IS(ax, 0, az), IS(bx, 0, bz),
                IS(bx, h_use, bz), IS(ax, h_use, az),
            ]
            ad.polygon(pts4, fill=face_col + (255,),
                       outline=P["ink"] + (255,))
        canvas.alpha_composite(aura)
        cx_lbl, cy_lbl = IS(hero["poly"].centroid.x, h_use,
                            hero["poly"].centroid.y)
        f = F["small"]
        txt = f"manzana {hero_manz_id}"
        wt = text_w(ImageDraw.Draw(canvas), txt, f)
        ImageDraw.Draw(canvas).rectangle(
            (cx_lbl - wt // 2 - 6, cy_lbl - 22,
             cx_lbl + wt // 2 + 6, cy_lbl - 4),
            fill=P["paper"] + (240,), outline=P["ink"], width=1)
        ImageDraw.Draw(canvas).text((cx_lbl - wt // 2, cy_lbl - 20),
                                    txt, fill=P["ink"], font=f)

    return {"n_manzanas": len(manzanas)}


def render_panel_distrito(canvas, panel_x0, panel_y0, panel_w, panel_h,
                          gc_secciones, manifest_idx, hero_cusec, F,
                          osm_roads=None, osm_coast=None):
    panel_y_map_top = panel_y0 + 30
    panel_y_map_bot = panel_y0 + panel_h - LABEL_BAND_H - 30
    map_h = panel_y_map_bot - panel_y_map_top

    d = ImageDraw.Draw(canvas)
    d.rectangle((panel_x0, panel_y0, panel_x0 + panel_w,
                 panel_y0 + panel_h - LABEL_BAND_H), fill=P["paper"])

    distrito_feats = [f for f in gc_secciones["features"]
                      if f["properties"]["cusec"].startswith("3501602")]
    if not distrito_feats:
        return {"n_secciones": 0}

    all_lng = []
    all_lat = []
    for f in distrito_feats:
        for ring in f["geometry"]["coordinates"]:
            for c in ring:
                all_lng.append(c[0])
                all_lat.append(c[1])
    lng0 = sum(all_lng) / len(all_lng)
    lat0 = sum(all_lat) / len(all_lat)
    to_xy = make_enu(lng0, lat0)

    secciones = []
    for f in distrito_feats:
        cusec = f["properties"]["cusec"]
        try:
            poly = shape_local(f, to_xy)
            if poly is not None and not poly.is_valid:
                poly = poly.buffer(0)
        except Exception:
            continue
        if poly is None or poly.is_empty:
            continue
        man = manifest_idx.get(cusec, {})
        secciones.append({
            "cusec": cusec,
            "poly": poly,
            "buildings": man.get("buildings"),
            "area_ha": man.get("area_ha", poly.area / 10000.0),
        })

    cxs = [s["poly"].centroid.x for s in secciones]
    cys = [s["poly"].centroid.y for s in secciones]
    cmx = sum(cxs) / len(cxs)
    cmy = sum(cys) / len(cys)
    dist = sorted(math.hypot(cx - cmx, cy - cmy)
                  for cx, cy in zip(cxs, cys))
    thr = dist[int(len(dist) * 0.92)] * 1.6 if dist else 1e9
    keep = [s for s, cx, cy in zip(secciones, cxs, cys)
            if math.hypot(cx - cmx, cy - cmy) <= thr]
    keep_for_bbox = keep if keep else secciones
    minx = min(s["poly"].bounds[0] for s in keep_for_bbox)
    miny = min(s["poly"].bounds[1] for s in keep_for_bbox)
    maxx = max(s["poly"].bounds[2] for s in keep_for_bbox)
    maxy = max(s["poly"].bounds[3] for s in keep_for_bbox)
    pad = 100.0
    bw = (maxx - minx) + 2 * pad
    bh = (maxy - miny) + 2 * pad
    h_max = 12.0
    span_w = (bw + bh) * COS30
    span_h = (bw + bh) * SIN30 + h_max * 1.6
    avail_w = panel_w - 60
    avail_h = map_h - 40
    sxy = min(avail_w / span_w, avail_h / span_h) * 1.0
    sz = sxy * 1.4
    mx = (minx + maxx) / 2
    my = (miny + maxy) / 2
    cx_canvas = panel_x0 + panel_w / 2 - (mx - my) * COS30 * sxy
    cy_canvas = panel_y_map_top + map_h / 2 - (mx + my) * SIN30 * sxy
    IS = make_iso(sxy, sz, cx_canvas, cy_canvas)

    bvals = [s["buildings"] for s in secciones if s["buildings"] is not None]
    if bvals:
        bmin, bmax = min(bvals), max(bvals)
    else:
        bmin = bmax = 0
    avals = [s["area_ha"] for s in secciones if s["area_ha"]]
    amin, amax = (min(avals), max(avals)) if avals else (0, 1)

    def density_for(s):
        if s["buildings"] is not None and bmax > bmin:
            return (s["buildings"] - bmin) / (bmax - bmin)
        if amax > amin:
            return min(1.0, (s["area_ha"] - amin) / (amax - amin))
        return 0.5

    secciones.sort(key=lambda s: s["poly"].centroid.x + s["poly"].centroid.y)

    if osm_coast is not None:
        coast_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        cd = ImageDraw.Draw(coast_layer)
        for f in osm_coast["features"]:
            if f["geometry"]["type"] != "LineString":
                continue
            xs = [c[0] for c in f["geometry"]["coordinates"]]
            ys = [c[1] for c in f["geometry"]["coordinates"]]
            if not xs:
                continue
            if (max(xs) < lng0 - 0.05 or min(xs) > lng0 + 0.05 or
                    max(ys) < lat0 - 0.05 or min(ys) > lat0 + 0.05):
                continue
            local = [to_xy(x, y) for x, y in zip(xs, ys)]
            pts = [IS(x_, 0, z_) for x_, z_ in local]
            if len(pts) >= 2:
                cd.line(pts, fill=hex2rgb("#7AA0B5") + (200,), width=3)
        canvas.alpha_composite(coast_layer)

    if osm_roads is not None:
        bbox_lng = (lng0 - 0.04, lat0 - 0.04, lng0 + 0.04, lat0 + 0.04)
        for f in osm_roads["features"]:
            hw = f["properties"].get("highway", "")
            if hw not in ("primary", "secondary", "trunk"):
                continue
            if f["geometry"]["type"] != "LineString":
                continue
            xs = [c[0] for c in f["geometry"]["coordinates"]]
            ys = [c[1] for c in f["geometry"]["coordinates"]]
            if not xs:
                continue
            if (max(xs) < bbox_lng[0] or min(xs) > bbox_lng[2] or
                    max(ys) < bbox_lng[1] or min(ys) > bbox_lng[3]):
                continue
            local = [to_xy(x, y) for x, y in zip(xs, ys)]
            pts = [IS(x_, 0, z_) for x_, z_ in local]
            if len(pts) >= 2:
                col = P["shadow"] if hw in ("primary", "trunk") else P["ocre_dk"]
                w_ = 4 if hw in ("primary", "trunk") else 3
                ImageDraw.Draw(canvas).line(pts, fill=col, width=w_)

    for s in secciones:
        rings = poly_outer_rings(s["poly"])
        t = density_for(s)
        if t < 0.33:
            top = lerp_color((232, 220, 192), (220, 200, 162), t / 0.33)
        elif t < 0.66:
            top = lerp_color((220, 200, 162), (196, 158, 108),
                             (t - 0.33) / 0.33)
        else:
            top = lerp_color((196, 158, 108), (170, 110, 56),
                             (t - 0.66) / 0.34)
        side_l = lerp_color(top, (50, 40, 30), 0.18)
        side_r = lerp_color(top, (50, 40, 30), 0.32)
        h_use = 6.0 + t * 6.0
        for ring in rings:
            draw_simple_prism(canvas, IS, ring, h_use, top, side_l, side_r,
                              P["ink"], stroke=1,
                              shadow={"offset": (1.4, 1.4), "alpha": 95})

    hero = next((s for s in secciones if s["cusec"] == hero_cusec), None)
    if hero:
        rings = poly_outer_rings(hero["poly"])
        h_use = 6.0 + density_for(hero) * 6.0 + 3.0
        top = hex2rgb("#E6A07A")
        side_l = hex2rgb("#D88A66")
        side_r = hex2rgb("#B5754F")
        for ring in rings:
            draw_simple_prism(canvas, IS, ring, h_use, top, side_l, side_r,
                              P["ink"], stroke=2,
                              shadow={"offset": (1.6, 1.6), "alpha": 130})
        glow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        gd = ImageDraw.Draw(glow)
        for ring in rings:
            floor_pts = [IS(x_, 0, z_) for x_, z_ in ring]
            for w_ in (12, 7, 4):
                gd.line(floor_pts + [floor_pts[0]],
                        fill=hex2rgb("#C85438") + (60 if w_ == 12 else 160,),
                        width=w_)
        canvas.alpha_composite(glow)
        c = hero["poly"].centroid
        sx, sy = IS(c.x, h_use, c.y)
        f = F["small"]
        txt = f"sec. {hero_cusec[-3:]}"
        wt = text_w(ImageDraw.Draw(canvas), txt, f)
        ImageDraw.Draw(canvas).rectangle(
            (sx - wt // 2 - 6, sy - 22, sx + wt // 2 + 6, sy - 4),
            fill=P["paper"] + (240,), outline=P["ink"], width=1)
        ImageDraw.Draw(canvas).text((sx - wt // 2, sy - 20),
                                    txt, fill=P["ink"], font=f)

    return {"n_secciones": len(secciones)}


def render_panel_municipio(canvas, panel_x0, panel_y0, panel_w, panel_h,
                           gc_secciones, manifest_idx, hero_distrito, F,
                           osm_roads=None, osm_coast=None):
    panel_y_map_top = panel_y0 + 30
    panel_y_map_bot = panel_y0 + panel_h - LABEL_BAND_H - 30
    map_h = panel_y_map_bot - panel_y_map_top

    d = ImageDraw.Draw(canvas)
    d.rectangle((panel_x0, panel_y0, panel_x0 + panel_w,
                 panel_y0 + panel_h - LABEL_BAND_H), fill=P["paper"])

    feats = [f for f in gc_secciones["features"]
             if f["properties"]["cusec"].startswith("35016")]
    if not feats:
        return {"n_secciones": 0}

    all_lng = []
    all_lat = []
    for f in feats:
        for ring in f["geometry"]["coordinates"]:
            for c in ring:
                all_lng.append(c[0])
                all_lat.append(c[1])
    lng0 = sum(all_lng) / len(all_lng)
    lat0 = sum(all_lat) / len(all_lat)
    to_xy = make_enu(lng0, lat0)

    secciones = []
    for f in feats:
        cusec = f["properties"]["cusec"]
        try:
            poly = shape_local(f, to_xy)
            if poly is not None and not poly.is_valid:
                poly = poly.buffer(0)
        except Exception:
            continue
        if poly is None or poly.is_empty:
            continue
        man = manifest_idx.get(cusec, {})
        secciones.append({
            "cusec": cusec,
            "dis": cusec[5:7],
            "poly": poly,
            "buildings": man.get("buildings"),
            "area_ha": man.get("area_ha", poly.area / 10000.0),
        })

    minx = min(s["poly"].bounds[0] for s in secciones)
    miny = min(s["poly"].bounds[1] for s in secciones)
    maxx = max(s["poly"].bounds[2] for s in secciones)
    maxy = max(s["poly"].bounds[3] for s in secciones)
    pad = 200.0
    bw = (maxx - minx) + 2 * pad
    bh = (maxy - miny) + 2 * pad
    h_max = 6.0
    span_w = (bw + bh) * COS30
    span_h = (bw + bh) * SIN30 + h_max * 1.6
    avail_w = panel_w - 60
    avail_h = map_h - 40
    sxy = min(avail_w / span_w, avail_h / span_h) * 1.0
    sz = sxy * 1.2
    mx = (minx + maxx) / 2
    my = (miny + maxy) / 2
    cx_canvas = panel_x0 + panel_w / 2 - (mx - my) * COS30 * sxy
    cy_canvas = panel_y_map_top + map_h / 2 - (mx + my) * SIN30 * sxy
    IS = make_iso(sxy, sz, cx_canvas, cy_canvas)

    bvals = [s["buildings"] for s in secciones if s["buildings"] is not None]
    if bvals:
        bmin, bmax = min(bvals), max(bvals)
    else:
        bmin = bmax = 0
    avals = [s["area_ha"] for s in secciones if s["area_ha"]]
    amin, amax = (min(avals), max(avals)) if avals else (0, 1)

    def density_for(s):
        if s["buildings"] is not None and bmax > bmin:
            return (s["buildings"] - bmin) / (bmax - bmin)
        if amax > amin:
            return 1.0 - min(1.0, (s["area_ha"] - amin) / (amax - amin))
        return 0.5

    if osm_coast is not None:
        coast_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        cd = ImageDraw.Draw(coast_layer)
        bbox_lng = (lng0 - 0.15, lat0 - 0.15, lng0 + 0.15, lat0 + 0.15)
        for f in osm_coast["features"]:
            if f["geometry"]["type"] != "LineString":
                continue
            xs = [c[0] for c in f["geometry"]["coordinates"]]
            ys = [c[1] for c in f["geometry"]["coordinates"]]
            if not xs:
                continue
            if (max(xs) < bbox_lng[0] or min(xs) > bbox_lng[2] or
                    max(ys) < bbox_lng[1] or min(ys) > bbox_lng[3]):
                continue
            local = [to_xy(x, y) for x, y in zip(xs, ys)]
            pts = [IS(x_, 0, z_) for x_, z_ in local]
            if len(pts) >= 2:
                cd.line(pts, fill=hex2rgb("#7AA0B5") + (200,), width=2)
        canvas.alpha_composite(coast_layer)

    secciones.sort(key=lambda s: s["poly"].centroid.x + s["poly"].centroid.y)

    for s in secciones:
        rings = poly_outer_rings(s["poly"])
        t = density_for(s)
        if t < 0.33:
            top = lerp_color((232, 220, 192), (220, 200, 162), t / 0.33)
        elif t < 0.66:
            top = lerp_color((220, 200, 162), (196, 158, 108),
                             (t - 0.33) / 0.33)
        else:
            top = lerp_color((196, 158, 108), (170, 110, 56),
                             (t - 0.66) / 0.34)
        if s["dis"] == hero_distrito:
            top = lerp_color(top, (210, 130, 80), 0.35)
        side_l = lerp_color(top, (50, 40, 30), 0.20)
        side_r = lerp_color(top, (50, 40, 30), 0.36)
        h_use = 4.0 + t * 2.0
        for ring in rings:
            draw_simple_prism(canvas, IS, ring, h_use, top, side_l, side_r,
                              P["ink"], stroke=1,
                              shadow={"offset": (1.0, 1.0), "alpha": 80})

    by_dis = {}
    for s in secciones:
        by_dis.setdefault(s["dis"], []).append(s["poly"])
    for dis, polys in by_dis.items():
        try:
            cleaned = [p.buffer(0) for p in polys]
            u = unary_union(cleaned)
        except Exception:
            continue
        if u.geom_type == "Polygon":
            rings = [list(u.exterior.coords)] + [list(r.coords)
                                                 for r in u.interiors]
        elif u.geom_type == "MultiPolygon":
            rings = []
            for g in u.geoms:
                rings.append(list(g.exterior.coords))
                for r in g.interiors:
                    rings.append(list(r.coords))
        else:
            continue
        col = P["ink"]
        for ring in rings:
            pts = [IS(x_, 4.0, z_) for x_, z_ in ring]
            if len(pts) >= 2:
                ImageDraw.Draw(canvas).line(pts + [pts[0]], fill=col, width=4)

    hero_polys = [s["poly"] for s in secciones if s["dis"] == hero_distrito]
    if hero_polys:
        try:
            u = unary_union([p.buffer(0) for p in hero_polys])
        except Exception:
            u = hero_polys[0].buffer(0)
        if u.geom_type == "Polygon":
            rings = [list(u.exterior.coords)]
        else:
            rings = [list(g.exterior.coords) for g in u.geoms]
        glow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        gd = ImageDraw.Draw(glow)
        for ring in rings:
            pts = [IS(x_, 4.5, z_) for x_, z_ in ring]
            if len(pts) >= 2:
                for w_ in (10, 6, 4):
                    gd.line(pts + [pts[0]],
                            fill=hex2rgb("#C85438") +
                                 (70 if w_ == 10 else 200,),
                            width=w_)
        canvas.alpha_composite(glow)
        c = u.centroid
        sx, sy = IS(c.x, 4.5, c.y)
        f = F["panel_sub"]
        txt = f"distrito {hero_distrito}"
        wt = text_w(ImageDraw.Draw(canvas), txt, f)
        ImageDraw.Draw(canvas).rectangle(
            (sx - wt // 2 - 6, sy - 28, sx + wt // 2 + 6, sy - 6),
            fill=P["paper"] + (240,), outline=P["ink"], width=1)
        ImageDraw.Draw(canvas).text((sx - wt // 2, sy - 26),
                                    txt, fill=P["ink"], font=f)

    return {"n_secciones": len(secciones), "n_distritos": len(by_dis)}


def render_panel_isla(canvas, panel_x0, panel_y0, panel_w, panel_h,
                      gc_municipios, manifest_idx, gc_secciones, F,
                      osm_coast=None):
    panel_y_map_top = panel_y0 + 30
    panel_y_map_bot = panel_y0 + panel_h - LABEL_BAND_H - 30
    map_h = panel_y_map_bot - panel_y_map_top

    d = ImageDraw.Draw(canvas)
    d.rectangle((panel_x0, panel_y0, panel_x0 + panel_w,
                 panel_y0 + panel_h - LABEL_BAND_H), fill=P["paper"])

    munis = [f for f in gc_municipios["features"]
             if f["properties"]["mun"] in GRAN_CANARIA_MUN]

    all_lng = [f["properties"]["center"][0] for f in munis]
    all_lat = [f["properties"]["center"][1] for f in munis]
    lng0 = sum(all_lng) / len(all_lng)
    lat0 = sum(all_lat) / len(all_lat)
    to_xy = make_enu(lng0, lat0)

    sec_by_mun = {}
    for f in gc_secciones["features"]:
        mun = f["properties"]["mun"]
        cusec = f["properties"]["cusec"]
        if cusec[:5] != "35" + mun:
            continue
        if mun in {m for m in GRAN_CANARIA_MUN}:
            sec_by_mun.setdefault(mun, []).append(f)

    mun_polys = {}
    for mun, feats in sec_by_mun.items():
        polys = []
        for ff in feats:
            try:
                p = shape_local(ff, to_xy)
                if p and not p.is_empty:
                    p = p.buffer(0).simplify(20, preserve_topology=True)
                    if not p.is_empty:
                        polys.append(p)
            except Exception:
                continue
        if polys:
            try:
                u = unary_union(polys)
                u = u.buffer(5).buffer(-5)
                mun_polys[mun] = u
            except Exception:
                mun_polys[mun] = max(polys, key=lambda p: p.area)

    if mun_polys:
        try:
            union_all = unary_union(list(mun_polys.values()))
            minx, miny, maxx, maxy = union_all.bounds
        except Exception:
            minx = min(p.bounds[0] for p in mun_polys.values())
            miny = min(p.bounds[1] for p in mun_polys.values())
            maxx = max(p.bounds[2] for p in mun_polys.values())
            maxy = max(p.bounds[3] for p in mun_polys.values())
    else:
        all_pts = [to_xy(c[0], c[1])
                   for c in [f["properties"]["center"] for f in munis]]
        minx = min(p[0] for p in all_pts) - 5000
        maxx = max(p[0] for p in all_pts) + 5000
        miny = min(p[1] for p in all_pts) - 5000
        maxy = max(p[1] for p in all_pts) + 5000
        union_all = None

    pad = 1500.0
    bw = (maxx - minx) + 2 * pad
    bh = (maxy - miny) + 2 * pad
    h_max = 1500.0
    span_w = (bw + bh) * COS30
    span_h = (bw + bh) * SIN30 + h_max * 1.6
    avail_w = panel_w - 60
    avail_h = map_h - 40
    sxy = min(avail_w / span_w, avail_h / span_h) * 1.0
    sz = sxy * 1.4
    mx = (minx + maxx) / 2
    my = (miny + maxy) / 2
    cx_canvas = panel_x0 + panel_w / 2 - (mx - my) * COS30 * sxy
    cy_canvas = panel_y_map_top + map_h / 2 - (mx + my) * SIN30 * sxy
    IS = make_iso(sxy, sz, cx_canvas, cy_canvas)

    if osm_coast is not None:
        coast_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        cd = ImageDraw.Draw(coast_layer)
        bbox_lng = (lng0 - 0.6, lat0 - 0.5, lng0 + 0.6, lat0 + 0.5)
        for f in osm_coast["features"]:
            if f["geometry"]["type"] != "LineString":
                continue
            xs = [c[0] for c in f["geometry"]["coordinates"]]
            ys = [c[1] for c in f["geometry"]["coordinates"]]
            if not xs:
                continue
            if (max(xs) < bbox_lng[0] or min(xs) > bbox_lng[2] or
                    max(ys) < bbox_lng[1] or min(ys) > bbox_lng[3]):
                continue
            local = [to_xy(x, y) for x, y in zip(xs, ys)]
            pts = [IS(x_, 0, z_) for x_, z_ in local]
            if len(pts) >= 2:
                cd.line(pts, fill=hex2rgb("#7AA0B5") + (180,), width=2)
        canvas.alpha_composite(coast_layer)

    muni_records = []
    for mu in munis:
        mun = mu["properties"]["mun"]
        nmun = mu["properties"]["nmun"]
        nsec = mu["properties"]["sections"]
        pop = MUN_POPULATION.get(mun, nsec * 1000)
        cx_local, cz_local = to_xy(mu["properties"]["center"][0],
                                   mu["properties"]["center"][1])
        muni_records.append({
            "mun": mun, "nmun": nmun, "n_sec": nsec, "pop": pop,
            "cx": cx_local, "cz": cz_local,
            "poly": mun_polys.get(mun),
        })

    muni_records.sort(key=lambda m: m["cx"] + m["cz"])

    pmax = max(m["pop"] for m in muni_records)

    for m in muni_records:
        ratio = (m["pop"] / pmax) ** 0.5
        top = density_palette(0.3 + ratio * 0.7)
        side_l = lerp_color(top, (50, 40, 30), 0.20)
        side_r = lerp_color(top, (50, 40, 30), 0.36)
        h_use = 200 + ratio * 1100

        if m["poly"] is not None and not m["poly"].is_empty:
            rings = poly_outer_rings(m["poly"])
            for ring in rings:
                draw_simple_prism(canvas, IS, ring, h_use, top, side_l, side_r,
                                  P["ink"], stroke=2,
                                  shadow={"offset": (40, 40), "alpha": 110})
            c = m["poly"].centroid
            sx, sy = IS(c.x, h_use, c.y)
        else:
            size_m = 800 + ratio * 1500
            ring = [
                (m["cx"] - size_m / 2, m["cz"] - size_m / 2),
                (m["cx"] + size_m / 2, m["cz"] - size_m / 2),
                (m["cx"] + size_m / 2, m["cz"] + size_m / 2),
                (m["cx"] - size_m / 2, m["cz"] + size_m / 2),
            ]
            draw_simple_prism(canvas, IS, ring, h_use, top, side_l, side_r,
                              P["ink"], stroke=2,
                              shadow={"offset": (40, 40), "alpha": 110})
            sx, sy = IS(m["cx"], h_use, m["cz"])

        rd = ImageDraw.Draw(canvas)
        rd.ellipse((sx - 5, sy - 5, sx + 5, sy + 5),
                   fill=hex2rgb("#FFB370"),
                   outline=P["ink"])

    lpgc_rec = next((m for m in muni_records if m["mun"] == "016"), None)
    if lpgc_rec is not None and lpgc_rec["poly"] is not None:
        rings = poly_outer_rings(lpgc_rec["poly"])
        glow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        gd = ImageDraw.Draw(glow)
        for ring in rings:
            floor_pts = [IS(x_, 0, z_) for x_, z_ in ring]
            for w_ in (12, 7, 4):
                gd.line(floor_pts + [floor_pts[0]],
                        fill=hex2rgb("#C85438") + (60 if w_ == 12 else 180,),
                        width=w_)
        canvas.alpha_composite(glow)

    sorted_by_pop = sorted(muni_records, key=lambda m: -m["pop"])
    label_set = {m["mun"] for m in sorted_by_pop[:8]}
    label_set |= {"016", "026"}

    f_small = F["muni"]
    f_big = F["muni_big"]
    cd2 = ImageDraw.Draw(canvas)
    placed = []
    for m in muni_records:
        if m["mun"] not in label_set:
            continue
        ratio = (m["pop"] / pmax) ** 0.5
        h_use = 200 + ratio * 1100
        if m["poly"] is not None:
            c = m["poly"].centroid
            sx, sy = IS(c.x, h_use, c.y)
        else:
            sx, sy = IS(m["cx"], h_use, m["cz"])
        f = f_big if m["pop"] > 30000 else f_small
        nm = m["nmun"][:18]
        wt = text_w(cd2, nm, f)
        bx0 = int(sx - wt / 2 - 5)
        bx1 = int(sx + wt / 2 + 5)
        by0 = int(sy - 24)
        by1 = int(sy - 6)
        cd2.rectangle((bx0, by0, bx1, by1),
                      fill=P["paper"] + (240,),
                      outline=P["ink"], width=1)
        cd2.text((sx - wt / 2, by0 + 1), nm, fill=P["ink"], font=f)
        placed.append(m["mun"])

    return {"n_municipios": len(muni_records)}


def render_lod_ladder(cusec: str, manzana_id: int,
                      pack_root: pathlib.Path,
                      gc_secciones_path: pathlib.Path,
                      gc_municipios_path: pathlib.Path,
                      manifest_path: pathlib.Path,
                      coast_path: pathlib.Path,
                      roads_path: pathlib.Path,
                      out_path: pathlib.Path) -> Dict:
    pack_dir = pack_root / cusec
    if not pack_dir.exists():
        raise SystemExit(f"data pack no encontrado: {pack_dir}")

    F = fonts()

    canvas = Image.new("RGBA", (TOTAL_W, TOTAL_H), P["paper"] + (255,))

    draw_banner(canvas, F)

    gc_secciones = json.load(open(gc_secciones_path, encoding="utf-8"))
    gc_municipios = json.load(open(gc_municipios_path, encoding="utf-8"))
    manifest = json.load(open(manifest_path, encoding="utf-8"))
    manifest_idx = {s["cusec"]: s for s in manifest["sections"]}

    osm_coast = None
    if coast_path.exists():
        try:
            osm_coast = json.load(open(coast_path, encoding="utf-8"))
        except Exception:
            osm_coast = None
    osm_roads = None
    if roads_path.exists():
        try:
            osm_roads = json.load(open(roads_path, encoding="utf-8"))
        except Exception:
            osm_roads = None

    results = {}

    print("Render P1 manzana...")
    r1 = render_panel_manzana(canvas, 0, BANNER_H, PANEL_W, PANEL_H,
                              pack_dir, manzana_id, F)
    draw_panel_label(canvas, 0, "MANZANA",
                     f"~{r1['n_target_buildings']} edificios · ~150 portales · "
                     f"unidad táctil = edificio", F)
    draw_step_badge(canvas, 0, F)
    results["panel1"] = r1

    print("Render P2 sección...")
    r2 = render_panel_seccion(canvas, PANEL_W, BANNER_H, PANEL_W, PANEL_H,
                              pack_dir, manzana_id, F)
    draw_panel_label(canvas, 1, "SECCIÓN CENSAL",
                     f"{r2['n_manzanas']} manzanas · ~2.000 personas · "
                     f"unidad táctil = manzana", F)
    draw_step_badge(canvas, 1, F)
    results["panel2"] = r2

    print("Render P3 distrito...")
    r3 = render_panel_distrito(canvas, PANEL_W * 2, BANNER_H, PANEL_W, PANEL_H,
                               gc_secciones, manifest_idx, cusec, F,
                               osm_roads=osm_roads, osm_coast=osm_coast)
    draw_panel_label(canvas, 2, "DISTRITO",
                     f"{r3['n_secciones']} secciones · ~80.000 personas · "
                     f"unidad táctil = sección", F)
    draw_step_badge(canvas, 2, F)
    results["panel3"] = r3

    print("Render P4 municipio...")
    hero_distrito = cusec[5:7]
    r4 = render_panel_municipio(canvas, PANEL_W * 3, BANNER_H, PANEL_W, PANEL_H,
                                gc_secciones, manifest_idx, hero_distrito, F,
                                osm_roads=osm_roads, osm_coast=osm_coast)
    draw_panel_label(canvas, 3, "MUNICIPIO",
                     f"{r4.get('n_distritos', 5)} distritos · "
                     f"{r4['n_secciones']} secciones · ~380.000 personas · "
                     f"unidad táctil = distrito", F)
    draw_step_badge(canvas, 3, F)
    results["panel4"] = r4

    print("Render P5 isla...")
    r5 = render_panel_isla(canvas, PANEL_W * 4, BANNER_H, PANEL_W, PANEL_H,
                           gc_municipios, manifest_idx, gc_secciones, F,
                           osm_coast=osm_coast)
    draw_panel_label(canvas, 4, "ISLA",
                     f"{r5['n_municipios']} municipios · ~860.000 personas · "
                     f"unidad táctil = municipio", F)
    draw_step_badge(canvas, 4, F)
    results["panel5"] = r5

    for i in range(N_PANELS - 1):
        draw_arrow(canvas, i)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(out_path, "PNG", optimize=True)
    return {"out_path": out_path, **results}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cusec", nargs="?", default=DEFAULT_CUSEC)
    ap.add_argument("manzana", nargs="?", type=int, default=DEFAULT_MANZANA)
    ap.add_argument("--pack-root", default=str(DEFAULT_PACK))
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    args = ap.parse_args()

    pack_root = pathlib.Path(args.pack_root)
    if not pack_root.is_absolute():
        pack_root = ROOT / pack_root

    out_path = pathlib.Path(args.out)
    if not out_path.is_absolute():
        out_path = ROOT / out_path

    res = render_lod_ladder(
        cusec=args.cusec,
        manzana_id=args.manzana,
        pack_root=pack_root,
        gc_secciones_path=ROOT / "public" / "gc-secciones-lite.json",
        gc_municipios_path=ROOT / "public" / "gc-municipios-lite.json",
        manifest_path=ROOT / "public" / "sections_pack" / "manifest.json",
        coast_path=ROOT / "public" / "osm-gc" / "coastline.json",
        roads_path=ROOT / "public" / "osm-gc" / "roads.json",
        out_path=out_path,
    )
    print(f"OK -> {res['out_path']}")
    print(f"  P1 manzana   target_b={res['panel1']['n_target_buildings']}")
    print(f"  P2 sección   manzanas={res['panel2']['n_manzanas']}")
    print(f"  P3 distrito  secciones={res['panel3']['n_secciones']}")
    print(f"  P4 municipio secciones={res['panel4']['n_secciones']} "
          f"distritos={res['panel4'].get('n_distritos')}")
    print(f"  P5 isla      municipios={res['panel5']['n_municipios']}")


if __name__ == "__main__":
    main()
