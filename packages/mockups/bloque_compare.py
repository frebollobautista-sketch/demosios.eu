"""KOINOS · POLIS — Mockup comparativo del nivel intermedio BLOQUE.

Genera UN PNG horizontal (4400×1400 px) con CUATRO paneles + banner que
demuestran un nuevo nivel de detalle, el BLOQUE, intermedio entre
EDIFICIO INDIVIDUAL y MANZANA ENTERA, y la simplificación agresiva de
la sección entera para vista zoom-out.

  P1 EDIFICIO INDIVIDUAL — 40 piezas con catálogo de arquetipos.
  P2 BLOQUE              — clústeres por adyacencia ≤1.5 m unificados.
  P3 MANZANA ENTERA      — la manzana 24 como una única pieza iso.
  P4 SECCIÓN SIMPLIFICADA— 52 manzanas como blobs simplificados.

Uso:
    python3 -m packages.mockups.bloque_compare 3501602052 24
"""
from __future__ import annotations

import argparse
import json
import math
import pathlib
import sys
from typing import Dict, List, Tuple

from PIL import Image, ImageDraw, ImageFont
from shapely.geometry import LineString, MultiPolygon, Polygon, box, shape

ROOT = pathlib.Path(__file__).resolve().parents[2]

from packages.iso import archetypes as AC  # noqa: E402
from packages.iso import bloque_clustering as BC  # noqa: E402
from packages.mockups.zoom import COS30, SIN30, PALETTE as P, hex2rgb  # noqa: E402

PANEL_W = 1100
PANEL_H = 1300
N_PANELS = 4
BANNER_H = 100
TOTAL_W = PANEL_W * N_PANELS
TOTAL_H = PANEL_H + BANNER_H
LABEL_BAND_H = 90

DEFAULT_PACK = ROOT / "public" / "sections_pack"
DEFAULT_OUT = ROOT / "design" / "secciones" / "3501602052_bloque_compare.png"
DEFAULT_CUSEC = "3501602052"
DEFAULT_MANZANA = 24

OSM_GC_ROADS = ROOT / "public" / "osm-gc" / "roads.json"


def fonts():
    cands_b = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
        "/System/Library/Fonts/Supplemental/Georgia Bold.ttf",
    ]
    cands_r = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
        "/System/Library/Fonts/Supplemental/Georgia.ttf",
    ]
    cands_sans = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]

    def _try(c, s):
        for x in c:
            try:
                return ImageFont.truetype(x, s)
            except Exception:
                continue
        return ImageFont.load_default()

    return {
        "banner":    _try(cands_b, 38),
        "level":     _try(cands_b, 22),
        "panel_sub": _try(cands_r, 17),
        "small":     _try(cands_r, 14),
        "tag":       _try(cands_sans, 14),
        "tag_big":   _try(cands_sans, 18),
    }


def text_w(d, txt, f):
    try:
        b = d.textbbox((0, 0), txt, font=f)
        return b[2] - b[0]
    except Exception:
        return d.textsize(txt, font=f)[0]


def make_iso(scale_xy, scale_z, cx_canvas, cy_canvas):
    def IS(x, y, z):
        return (cx_canvas + (x - z) * COS30 * scale_xy,
                cy_canvas + (x + z) * SIN30 * scale_xy - y * scale_z)
    return IS


def lerp_color(c0, c1, t):
    return tuple(int(c0[i] + (c1[i] - c0[i]) * t) for i in range(3))


CATEGORY_TOPS = {
    "residencial":  ((226, 206, 168), (200, 178, 138), (172, 152, 116)),
    "comercio":     ((196, 180, 168), (172, 154, 142), (140, 124, 112)),
    "publico":      ((202, 186, 156), (172, 158, 130), (140, 130, 108)),
    "restauracion": ((220, 178, 142), (192, 152, 116), (158, 122,  90)),
    "alojamiento":  ((212, 188, 196), (186, 162, 170), (152, 132, 138)),
    "monumento":    ((196, 130,  92), (170, 104,  72), (134,  78,  52)),
    "default":      ((226, 206, 168), (200, 178, 138), (172, 152, 116)),
}


def palette_for(cat: str):
    return CATEGORY_TOPS.get(cat, CATEGORY_TOPS["default"])


def _ring_xz(poly: Polygon):
    if isinstance(poly, MultiPolygon):
        poly = max(poly.geoms, key=lambda g: g.area)
    return list(poly.exterior.coords)


def _world_to_screen(IS, ring, h):
    return [IS(x_, h, z_) for x_, z_ in ring]


def draw_unified_piece(img, IS, polygon: Polygon, h_total, *,
                       category: str = "residencial",
                       outline=2, ink=P["ink"], shadow=True,
                       windows=True, win_rows=4):
    ring = _ring_xz(polygon)
    if len(ring) >= 2 and ring[0] == ring[-1]:
        ring = ring[:-1]
    if len(ring) < 3:
        return

    top_col, side_l, side_r = palette_for(category)

    if shadow:
        sx, sz = 1.4, 1.4
        sh_pts = [IS(x + sx, 0, z + sz) for x, z in ring]
        layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
        ImageDraw.Draw(layer).polygon(sh_pts, fill=ink + (115,))
        img.alpha_composite(layer)

    bot = [IS(x, 0, z) for x, z in ring]
    top = [IS(x, h_total, z) for x, z in ring]
    n = len(ring)

    d = ImageDraw.Draw(img)
    visible_faces = []
    for k in range(n):
        ax, az = ring[k]
        bx, bz = ring[(k + 1) % n]
        nx_, nz_ = (bz - az), -(bx - ax)
        if nx_ + nz_ <= 0:
            continue
        tilt = nx_ / (abs(nx_) + abs(nz_) + 1e-6)
        face = side_r if tilt > 0 else side_l
        face_pts = [bot[k], bot[(k + 1) % n], top[(k + 1) % n], top[k]]
        d.polygon(face_pts, fill=face, outline=ink, width=outline)
        L_m = math.hypot(bx - ax, bz - az)
        visible_faces.append((face_pts, L_m, face))

    d.polygon(top, fill=top_col, outline=ink, width=outline)

    if windows:
        win_color = lerp_color(side_l, (40, 32, 22), 0.55)
        layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
        wd = ImageDraw.Draw(layer)
        for face_pts, L_m, face_col in visible_faces:
            cols = max(1, int(L_m / 3.0))
            cols = min(cols, 16)
            p0, p1, p2, p3 = face_pts
            margin_v_top = 0.18
            margin_v_bot = 0.10
            usable_v = 1 - margin_v_top - margin_v_bot
            for r in range(win_rows):
                v0 = margin_v_bot + (r + 0.18) * usable_v / win_rows
                v1 = margin_v_bot + (r + 0.82) * usable_v / win_rows
                for c in range(cols):
                    u0 = (c + 0.30) / cols
                    u1 = (c + 0.70) / cols

                    def lerp_pt(a, b, t):
                        return (a[0] + (b[0] - a[0]) * t,
                                a[1] + (b[1] - a[1]) * t)

                    bot_l = lerp_pt(p0, p1, u0)
                    bot_r = lerp_pt(p0, p1, u1)
                    top_l = lerp_pt(p3, p2, u0)
                    top_r = lerp_pt(p3, p2, u1)
                    ll = lerp_pt(bot_l, top_l, v0)
                    lr = lerp_pt(bot_r, top_r, v0)
                    ur = lerp_pt(bot_r, top_r, v1)
                    ul = lerp_pt(bot_l, top_l, v1)
                    wd.polygon([ll, lr, ur, ul],
                               fill=win_color + (200,))
        img.alpha_composite(layer)


def draw_count_tag(img, IS, polygon: Polygon, h_top, text: str, F):
    if isinstance(polygon, MultiPolygon):
        polygon = max(polygon.geoms, key=lambda g: g.area)
    c = polygon.centroid
    sx, sy = IS(c.x, h_top, c.y)
    f = F["tag_big"]
    d = ImageDraw.Draw(img)
    w = text_w(d, text, f)
    pad_x, pad_y = 8, 4
    box_h = 24
    d.rectangle((sx - w // 2 - pad_x, sy - box_h - pad_y,
                 sx + w // 2 + pad_x, sy + pad_y - 4),
                fill=P["paper"] + (240,), outline=P["ink"], width=2)
    d.text((sx - w // 2, sy - box_h - pad_y + 2), text,
           fill=P["ink"], font=f)


def draw_banner(canvas, F):
    d = ImageDraw.Draw(canvas)
    d.rectangle((0, 0, TOTAL_W, BANNER_H), fill=hex2rgb("#5A4A38"))
    title = ("KOINOS · POLIS — nivel intermedio BLOQUE + simplificación de "
             "sección")
    f = F["banner"]
    w = text_w(d, title, f)
    d.text(((TOTAL_W - w) // 2, (BANNER_H - 50) // 2), title,
           fill=P["paper"], font=f)


def draw_panel_label(canvas, idx, big, sub, F):
    x0 = idx * PANEL_W
    y0 = BANNER_H + PANEL_H - LABEL_BAND_H
    d = ImageDraw.Draw(canvas)
    d.rectangle((x0, y0, x0 + PANEL_W, y0 + LABEL_BAND_H),
                fill=hex2rgb("#3A2E22"))
    f1 = F["level"]
    f2 = F["panel_sub"]
    w1 = text_w(d, big, f1)
    d.text((x0 + (PANEL_W - w1) // 2, y0 + 12), big,
           fill=hex2rgb("#E8D5A8"), font=f1)
    w2 = text_w(d, sub, f2)
    d.text((x0 + (PANEL_W - w2) // 2, y0 + 50), sub,
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
    f = F["level"]
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


def make_iso_for_manzana(target_poly: Polygon, panel_x0, panel_y0, panel_w,
                         panel_h, *, h_max=14.0, pad=35.0):
    panel_y_map_top = panel_y0 + 30
    panel_y_map_bot = panel_y0 + panel_h - LABEL_BAND_H - 30
    map_h = panel_y_map_bot - panel_y_map_top

    minx, miny, maxx, maxy = target_poly.bounds
    bw = (maxx - minx) + 2 * pad
    bh = (maxy - miny) + 2 * pad
    span_w = (bw + bh) * COS30
    span_h = (bw + bh) * SIN30 + h_max * 1.6
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
    return IS, sxy, sz, bbox_hi, map_h


def load_pack(pack_dir: pathlib.Path):
    manz = json.load(open(pack_dir / "manzanas.geojson", encoding="utf-8"))
    bld = json.load(open(pack_dir / "buildings.geojson", encoding="utf-8"))
    rds = json.load(open(pack_dir / "roads.geojson", encoding="utf-8"))
    return manz, bld, rds


def render_panel_individual(canvas, panel_x0, panel_y0, pack_dir, target_id,
                            F):
    panel_w, panel_h = PANEL_W, PANEL_H
    d = ImageDraw.Draw(canvas)
    d.rectangle((panel_x0, panel_y0, panel_x0 + panel_w,
                 panel_y0 + panel_h - LABEL_BAND_H), fill=P["cream"])

    manz_gj, bldg_gj, roads_gj = load_pack(pack_dir)

    manz: Dict[int, Polygon] = {}
    for f in manz_gj["features"]:
        manz[f["properties"]["id"]] = shape(f["geometry"])
    target_poly = manz[target_id]

    IS, sxy, sz, bbox_hi, _ = make_iso_for_manzana(
        target_poly, panel_x0, panel_y0, panel_w, panel_h)

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
    total_vertices = 0
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
            total_vertices += len(ring_b) - 1
        elif bbox_hi.contains(c):
            neigh_buildings.append(b)

    def order_key(b):
        cx_, cz_ = b["centroid"]
        return cx_ + cz_

    for b in sorted(neigh_buildings, key=order_key):
        atype = AC.classify_building(b["props"], b["area"])
        rot, long_m, _ = AC.axis_angle_from_ring(b["ring"])
        canon_w, canon_d, canon_h = AC.ARCHETYPE_DIMS[atype]
        long_canon = max(canon_w, canon_d)
        scale_xy = max(0.4, long_m / long_canon)
        scale_z = 1.0
        if canon_h > 0:
            tgt_h = b["h"] if b["h"] > 0 else canon_h
            scale_z = max(0.55, min(1.6, tgt_h / canon_h))
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
        rot, long_m, _ = AC.axis_angle_from_ring(b["ring"])
        canon_w, canon_d, canon_h = AC.ARCHETYPE_DIMS[atype]
        long_canon = max(canon_w, canon_d)
        scale_xy = max(0.4, long_m / long_canon)
        scale_z = 1.0
        if canon_h > 0:
            tgt_h = b["h"] if b["h"] > 0 else canon_h
            scale_z = max(0.55, min(1.6, tgt_h / canon_h))
        AC.ARCHETYPES[atype](canvas, IS, P["ink"],
                             cx_m=b["centroid"][0], cz_m=b["centroid"][1],
                             scale_xy=scale_xy, scale_z=scale_z, rot_rad=rot)

    return {
        "n_target_buildings": len(target_buildings),
        "n_neigh_buildings": len(neigh_buildings),
        "archetype_dist": archetype_dist,
        "vertices_target": total_vertices,
        "target_buildings": target_buildings,
    }


def render_panel_bloque(canvas, panel_x0, panel_y0, pack_dir, target_id,
                        F):
    panel_w, panel_h = PANEL_W, PANEL_H
    d = ImageDraw.Draw(canvas)
    d.rectangle((panel_x0, panel_y0, panel_x0 + panel_w,
                 panel_y0 + panel_h - LABEL_BAND_H), fill=P["cream"])

    manz_gj, bldg_gj, roads_gj = load_pack(pack_dir)

    manz: Dict[int, Polygon] = {}
    for f in manz_gj["features"]:
        manz[f["properties"]["id"]] = shape(f["geometry"])
    target_poly = manz[target_id]

    IS, sxy, sz, bbox_hi, _ = make_iso_for_manzana(
        target_poly, panel_x0, panel_y0, panel_w, panel_h)

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

    neigh_features_by_manz = {}
    target_features = []
    for f in bldg_gj["features"]:
        mid = f["properties"].get("manzana_id")
        try:
            geom = shape(f["geometry"])
        except Exception:
            continue
        if not geom.is_valid or geom.is_empty:
            continue
        c = geom.centroid
        if mid == target_id:
            target_features.append(f)
        elif bbox_hi.contains(c):
            neigh_features_by_manz.setdefault(mid, []).append(f)

    for mid, feats in neigh_features_by_manz.items():
        sub_bloques = BC.compute_bloques(feats, distance_threshold=1.5)
        sub_bloques.sort(key=lambda b: b["centroid"][0] + b["centroid"][1])
        for bl in sub_bloques:
            if bl["polygon"].distance(target_poly) > 30:
                continue
            sub = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
            h_neigh = min(4.0, max(3.0, bl["height"] * 0.5))
            draw_unified_piece(sub, IS, bl["polygon"], h_neigh,
                               category=bl["category"], outline=2,
                               windows=False)
            alpha = sub.split()[3].point(lambda v: int(v * 0.45))
            sub.putalpha(alpha)
            canvas.alpha_composite(sub)

    bloques = BC.compute_bloques(target_features, distance_threshold=1.5)
    bloques.sort(key=lambda b: b["centroid"][0] + b["centroid"][1])

    total_vertices = 0
    sizes = []
    for bl in bloques:
        h_use = max(4.0, bl["height"])
        draw_unified_piece(canvas, IS, bl["polygon"], h_use,
                           category=bl["category"], outline=3,
                           windows=True, win_rows=max(2, int(h_use / 3.0)))
        total_vertices += BC.count_vertices(bl["polygon"])
        sizes.append(bl["n"])

    for bl in bloques:
        h_use = max(4.0, bl["height"])
        draw_count_tag(canvas, IS, bl["polygon"], h_use,
                       f"x{bl['n']}", F)

    return {
        "n_bloques": len(bloques),
        "vertices_target": total_vertices,
        "sizes": sizes,
        "bloques": bloques,
    }


def render_panel_manzana_entera(canvas, panel_x0, panel_y0, pack_dir,
                                target_id, F, n_buildings_label=40,
                                n_portales_label=156):
    panel_w, panel_h = PANEL_W, PANEL_H
    d = ImageDraw.Draw(canvas)
    d.rectangle((panel_x0, panel_y0, panel_x0 + panel_w,
                 panel_y0 + panel_h - LABEL_BAND_H), fill=P["cream"])

    manz_gj, bldg_gj, roads_gj = load_pack(pack_dir)

    manz: Dict[int, Polygon] = {}
    for f in manz_gj["features"]:
        manz[f["properties"]["id"]] = shape(f["geometry"])
    target_poly = manz[target_id]

    IS, sxy, sz, bbox_hi, _ = make_iso_for_manzana(
        target_poly, panel_x0, panel_y0, panel_w, panel_h)

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

    target_features = [f for f in bldg_gj["features"]
                       if f["properties"].get("manzana_id") == target_id]
    if not target_features:
        return {"n_buildings": 0, "vertices_target": 0}

    merged = BC.unify_manzana(target_features, buffer_m=1.0,
                              simplify_tol=2.0)
    if merged is None:
        return {"n_buildings": len(target_features), "vertices_target": 0}

    heights = [float(f["properties"].get("height_m") or 6.0)
               for f in target_features]
    h_med = sorted(heights)[len(heights) // 2] if heights else 6.0
    cats = [f["properties"].get("category", "residencial")
            for f in target_features]
    from collections import Counter
    cat_dom = Counter(cats).most_common(1)[0][0]

    neigh_by_manz = {}
    for f in bldg_gj["features"]:
        mid = f["properties"].get("manzana_id")
        if mid == target_id or mid is None:
            continue
        try:
            geom = shape(f["geometry"])
            if bbox_hi.contains(geom.centroid):
                neigh_by_manz.setdefault(mid, []).append(f)
        except Exception:
            continue

    neigh_pieces = []
    for mid, feats in neigh_by_manz.items():
        m_poly = BC.unify_manzana(feats, buffer_m=1.0, simplify_tol=2.0)
        if m_poly is None or m_poly.is_empty:
            continue
        m_h = sorted([float(ff["properties"].get("height_m") or 6.0)
                      for ff in feats])
        m_h_med = m_h[len(m_h) // 2] if m_h else 6.0
        m_cat = Counter([ff["properties"].get("category", "residencial")
                         for ff in feats]).most_common(1)[0][0]
        c = m_poly.centroid
        neigh_pieces.append({
            "polygon": m_poly, "h": m_h_med, "cat": m_cat,
            "centroid": (c.x, c.y),
        })
    neigh_pieces.sort(key=lambda p: p["centroid"][0] + p["centroid"][1])

    for p in neigh_pieces:
        if p["polygon"].distance(target_poly) > 30:
            continue
        sub = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        h_neigh = min(4.0, max(3.0, p["h"] * 0.5))
        draw_unified_piece(sub, IS, p["polygon"], h_neigh,
                           category=p["cat"], outline=2, windows=False)
        alpha = sub.split()[3].point(lambda v: int(v * 0.45))
        sub.putalpha(alpha)
        canvas.alpha_composite(sub)

    h_use = max(7.0, h_med)
    draw_unified_piece(canvas, IS, merged, h_use, category=cat_dom,
                       outline=4, windows=True,
                       win_rows=max(2, int(h_use / 3.0)))

    label = (f"Manzana {target_id} · {len(target_features)} edif · "
             f"{n_portales_label} portales · "
             f"{cat_dom[:3]}.")
    c = merged.centroid if not isinstance(merged, MultiPolygon) else \
        max(merged.geoms, key=lambda g: g.area).centroid
    sx, sy = IS(c.x, h_use, c.y)
    f = F["tag"]
    d2 = ImageDraw.Draw(canvas)
    w = text_w(d2, label, f)
    d2.rectangle((sx - w // 2 - 8, sy - 26, sx + w // 2 + 8, sy - 4),
                 fill=P["paper"] + (245,), outline=P["ink"], width=2)
    d2.text((sx - w // 2, sy - 24), label, fill=P["ink"], font=f)

    return {
        "n_buildings": len(target_features),
        "vertices_target": BC.count_vertices(merged),
    }


def render_panel_seccion(canvas, panel_x0, panel_y0, pack_dir, target_id, F):
    panel_w, panel_h = PANEL_W, PANEL_H
    panel_y_map_top = panel_y0 + 30
    panel_y_map_bot = panel_y0 + panel_h - LABEL_BAND_H - 30
    map_h = panel_y_map_bot - panel_y_map_top
    d = ImageDraw.Draw(canvas)
    d.rectangle((panel_x0, panel_y0, panel_x0 + panel_w,
                 panel_y0 + panel_h - LABEL_BAND_H), fill=P["cream"])

    manz_gj, bldg_gj, roads_gj = load_pack(pack_dir)

    manzanas_simpl = []
    total_vertices = 0
    for f in manz_gj["features"]:
        mid = f["properties"]["id"]
        h_med = float(f["properties"].get("height_median_m") or 6.0)
        n_b = int(f["properties"].get("building_count") or 0)
        poly_simpl = BC.simplify_manzana(f, tolerance=5.0)
        if poly_simpl is None or poly_simpl.is_empty:
            continue
        manzanas_simpl.append({
            "id": mid, "h": h_med, "n": n_b, "poly": poly_simpl,
        })
        total_vertices += BC.count_vertices(poly_simpl)

    minx = min(m["poly"].bounds[0] for m in manzanas_simpl)
    miny = min(m["poly"].bounds[1] for m in manzanas_simpl)
    maxx = max(m["poly"].bounds[2] for m in manzanas_simpl)
    maxy = max(m["poly"].bounds[3] for m in manzanas_simpl)
    from shapely.ops import unary_union
    try:
        section_poly = unary_union([m["poly"].buffer(2) for m in manzanas_simpl])
        section_poly = section_poly.buffer(8).buffer(-8)
        if isinstance(section_poly, MultiPolygon):
            section_poly = max(section_poly.geoms, key=lambda g: g.area)
    except Exception:
        section_poly = None
    pad = 25.0
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

    if section_poly is not None and not section_poly.is_empty:
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
    importance = {"primary": 4, "secondary": 3, "tertiary": 2,
                  "residential": 2, "service": 1}
    width_for = {"primary": 4, "secondary": 3, "tertiary": 2,
                 "residential": 2, "service": 1, "footway": 1,
                 "pedestrian": 1, "track": 1}
    sorted_roads = []
    for f in roads_gj["features"]:
        try:
            line = LineString(f["geometry"]["coordinates"])
        except Exception:
            continue
        if not line.intersects(bbox_section):
            continue
        rtype = f["properties"].get("type", "service")
        if rtype not in ("primary", "secondary", "tertiary", "residential"):
            continue
        clipped = line.intersection(bbox_section)
        if clipped.is_empty:
            continue
        if clipped.geom_type == "LineString":
            sorted_roads.append((rtype, list(clipped.coords)))
        elif clipped.geom_type == "MultiLineString":
            for g in clipped.geoms:
                sorted_roads.append((rtype, list(g.coords)))
    sorted_roads.sort(key=lambda r: importance.get(r[0], 0))
    for rtype, coords in sorted_roads:
        pts = [IS(x_, 0, z_) for x_, z_ in coords]
        if len(pts) >= 2:
            ImageDraw.Draw(canvas).line(pts, fill=road_col,
                                        width=width_for.get(rtype, 1))

    manzanas_simpl.sort(key=lambda m: m["poly"].centroid.x + m["poly"].centroid.y)
    sand_top = (236, 218, 184)
    sand_l = (224, 206, 168)
    sand_r = (196, 178, 138)
    for m in manzanas_simpl:
        if m["id"] == target_id:
            continue
        rings_xz = []
        if isinstance(m["poly"], MultiPolygon):
            for g in m["poly"].geoms:
                rings_xz.append(list(g.exterior.coords))
        else:
            rings_xz.append(list(m["poly"].exterior.coords))
        h_use = max(4.0, m["h"])
        for ring in rings_xz:
            ring_clean = ring[:-1] if ring[0] == ring[-1] else ring
            if len(ring_clean) < 3:
                continue
            sx, sz_o = 1.2, 1.2
            sh_pts = [IS(x + sx, 0, z + sz_o) for x, z in ring_clean]
            sl = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
            ImageDraw.Draw(sl).polygon(sh_pts, fill=P["ink"] + (90,))
            canvas.alpha_composite(sl)
            bot = [IS(x, 0, z) for x, z in ring_clean]
            top = [IS(x, h_use, z) for x, z in ring_clean]
            n = len(ring_clean)
            for k in range(n):
                ax, az = ring_clean[k]
                bx, bz = ring_clean[(k + 1) % n]
                nx_, nz_ = (bz - az), -(bx - ax)
                if nx_ + nz_ <= 0:
                    continue
                tilt = nx_ / (abs(nx_) + abs(nz_) + 1e-6)
                face = sand_r if tilt > 0 else sand_l
                ImageDraw.Draw(canvas).polygon(
                    [bot[k], bot[(k + 1) % n], top[(k + 1) % n], top[k]],
                    fill=face, outline=P["ink"], width=1)
            ImageDraw.Draw(canvas).polygon(top, fill=sand_top,
                                           outline=P["ink"], width=1)

    hero = next((m for m in manzanas_simpl if m["id"] == target_id), None)
    if hero:
        rings_xz = []
        if isinstance(hero["poly"], MultiPolygon):
            for g in hero["poly"].geoms:
                rings_xz.append(list(g.exterior.coords))
        else:
            rings_xz.append(list(hero["poly"].exterior.coords))
        h_use = max(6.0, hero["h"]) + 2.0
        top_c = hex2rgb("#E6A07A")
        side_l_c = hex2rgb("#D88A66")
        side_r_c = hex2rgb("#B5754F")
        for ring in rings_xz:
            ring_clean = ring[:-1] if ring[0] == ring[-1] else ring
            if len(ring_clean) < 3:
                continue
            sx, sz_o = 1.4, 1.4
            sh_pts = [IS(x + sx, 0, z + sz_o) for x, z in ring_clean]
            sl = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
            ImageDraw.Draw(sl).polygon(sh_pts, fill=P["ink"] + (130,))
            canvas.alpha_composite(sl)
            bot = [IS(x, 0, z) for x, z in ring_clean]
            top = [IS(x, h_use, z) for x, z in ring_clean]
            n = len(ring_clean)
            for k in range(n):
                ax, az = ring_clean[k]
                bx, bz = ring_clean[(k + 1) % n]
                nx_, nz_ = (bz - az), -(bx - ax)
                if nx_ + nz_ <= 0:
                    continue
                tilt = nx_ / (abs(nx_) + abs(nz_) + 1e-6)
                face = side_r_c if tilt > 0 else side_l_c
                ImageDraw.Draw(canvas).polygon(
                    [bot[k], bot[(k + 1) % n], top[(k + 1) % n], top[k]],
                    fill=face, outline=P["ink"], width=2)
            ImageDraw.Draw(canvas).polygon(top, fill=top_c,
                                           outline=P["ink"], width=2)
            glow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
            gd = ImageDraw.Draw(glow)
            for w_ in (10, 6, 4):
                gd.line(bot + [bot[0]],
                        fill=hex2rgb("#C85438") +
                             (70 if w_ == 10 else 200,), width=w_)
            canvas.alpha_composite(glow)

        c = hero["poly"].centroid if not isinstance(hero["poly"], MultiPolygon) \
            else max(hero["poly"].geoms, key=lambda g: g.area).centroid
        sx2, sy2 = IS(c.x, h_use, c.y)
        f = F["small"]
        txt = f"manzana {target_id}"
        wt = text_w(ImageDraw.Draw(canvas), txt, f)
        ImageDraw.Draw(canvas).rectangle(
            (sx2 - wt // 2 - 6, sy2 - 22, sx2 + wt // 2 + 6, sy2 - 4),
            fill=P["paper"] + (240,), outline=P["ink"], width=1)
        ImageDraw.Draw(canvas).text((sx2 - wt // 2, sy2 - 20),
                                    txt, fill=P["ink"], font=f)

    return {
        "n_manzanas": len(manzanas_simpl),
        "vertices_total": total_vertices,
    }


def render_compare(cusec: str, target_id: int, pack_dir: pathlib.Path,
                   out_path: pathlib.Path) -> Dict:
    F = fonts()

    canvas = Image.new("RGBA", (TOTAL_W, TOTAL_H), P["paper"] + (255,))

    panel_y0 = BANNER_H

    p1 = render_panel_individual(canvas, 0 * PANEL_W, panel_y0,
                                 pack_dir, target_id, F)
    p2 = render_panel_bloque(canvas, 1 * PANEL_W, panel_y0,
                             pack_dir, target_id, F)
    n_buildings = p1["n_target_buildings"]
    n_portales = int(round(n_buildings * 3.9))
    p3 = render_panel_manzana_entera(canvas, 2 * PANEL_W, panel_y0,
                                     pack_dir, target_id, F,
                                     n_buildings_label=n_buildings,
                                     n_portales_label=n_portales)
    p4 = render_panel_seccion(canvas, 3 * PANEL_W, panel_y0,
                              pack_dir, target_id, F)

    draw_banner(canvas, F)
    for i in range(N_PANELS):
        draw_step_badge(canvas, i, F)
    draw_panel_label(
        canvas, 0,
        "EDIFICIO INDIVIDUAL",
        f"{p1['n_target_buildings']} piezas distintas · "
        f"alta carga visual y de cómputo", F)
    sizes_str = ",".join(str(s) for s in p2["sizes"])
    draw_panel_label(
        canvas, 1,
        "BLOQUE",
        f"{p2['n_bloques']} piezas agrupadas ({sizes_str}) · "
        f"ruido reducido ~{max(1, p1['n_target_buildings'] // max(1, p2['n_bloques']))}x", F)
    draw_panel_label(
        canvas, 2,
        "MANZANA ENTERA",
        "1 pieza · ideal para vista sección/distrito", F)
    draw_panel_label(
        canvas, 3,
        "SECCIÓN SIMPLIFICADA",
        f"{p4['n_manzanas']} manzanas como blobs · listas para zoom out", F)

    for i in range(N_PANELS - 1):
        draw_arrow(canvas, i)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(out_path, "PNG", optimize=True)

    return {
        "out_path": str(out_path),
        "p1": {k: v for k, v in p1.items() if k != "target_buildings"},
        "p2": {k: v for k, v in p2.items() if k != "bloques"},
        "p3": p3,
        "p4": p4,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cusec", nargs="?", default=DEFAULT_CUSEC)
    ap.add_argument("manzana_id", type=int, nargs="?", default=DEFAULT_MANZANA)
    ap.add_argument("--pack-dir", default=str(DEFAULT_PACK))
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    args = ap.parse_args()

    pack_root = pathlib.Path(args.pack_dir)
    if not pack_root.is_absolute():
        pack_root = ROOT / pack_root
    pack_dir = pack_root / args.cusec
    if not pack_dir.exists():
        raise SystemExit(f"data pack no encontrado: {pack_dir}")

    out_path = pathlib.Path(args.out)
    if not out_path.is_absolute():
        out_path = ROOT / out_path

    res = render_compare(args.cusec, args.manzana_id, pack_dir, out_path)
    print(f"OK -> {res['out_path']}")
    print(f"  P1 EDIFICIO: {res['p1']['n_target_buildings']} edif. "
          f"target ({res['p1']['vertices_target']} vértices) · "
          f"{res['p1']['n_neigh_buildings']} vecinos")
    print(f"  P2 BLOQUE:   {res['p2']['n_bloques']} bloques "
          f"({res['p2']['sizes']}) · {res['p2']['vertices_target']} vértices")
    print(f"  P3 MANZANA:  1 pieza · {res['p3']['vertices_target']} vértices")
    print(f"  P4 SECCION:  {res['p4']['n_manzanas']} manzanas "
          f"simplificadas · {res['p4']['vertices_total']} vértices")


if __name__ == "__main__":
    main()
