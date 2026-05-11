"""KOINOS · POLIS — Mockup comparativo "Antes/Ahora".

Genera UN PNG (2380×2532 px) con DOS pantallas mobile lado a lado:

  · IZQUIERDA "ANTES · trazado OSM literal": render exacto de songkick.
  · DERECHA  "AHORA · catálogo de arquetipos": misma manzana renderizada
    sustituyendo cada footprint por una pieza isométrica del catálogo
    (packages.iso.archetypes), estilo Into the Breach.

Uso:
    python3 -m packages.mockups.archetypes_compare 3501602052 24
"""
from __future__ import annotations

import argparse
import json
import math
import pathlib
import sys
from typing import Dict, List, Tuple

from PIL import Image, ImageDraw, ImageFilter
from shapely.geometry import LineString, Polygon, box, shape

ROOT = pathlib.Path(__file__).resolve().parents[2]

from packages.mockups.zoom import (  # noqa: E402
    COS30, SIN30, PALETTE, ROAD_TYPE_IMPORTANCE, ROAD_TYPE_STYLE,
    hex2rgb, iso, shade,
)
from packages.mockups.mobile import (  # noqa: E402
    W as MOBILE_W, H as MOBILE_H, SCALE, STATUS_BAR_H, HOME_INDICATOR_H,
    fonts as base_fonts, round_rect, text_w,
    draw_status_bar, draw_home_indicator,
)
from packages.mockups.songkick import (  # noqa: E402
    TOP_BAR_H, SHEET_PEEK_H, MAP_H, P, EVENTS,
    draw_top_bar, draw_event_card, draw_peek_sheet, fonts as sk_fonts,
)
from packages.iso import archetypes as AC  # noqa: E402

DEFAULT_PACK = ROOT / "public" / "sections_pack"
DEFAULT_OUT = ROOT / "design" / "secciones" / "3501602052_archetypes_compare.png"

SEP_W = 40
COMPARE_W = MOBILE_W * 2 + SEP_W
COMPARE_H = MOBILE_H

BANNER_H = 96


def make_IS_for_panel(target_poly: Polygon, panel_origin_x: int,
                      panel_origin_y: int, map_h: int):
    pad = 4.0
    minx, miny, maxx, maxy = target_poly.bounds
    bbox_xz = box(minx - pad, miny - pad, maxx + pad, maxy + pad)
    bx0, by0_, bx1, by1_ = bbox_xz.bounds

    margin_x = 30
    margin_top = 20
    margin_bot = 20
    h_max = 14.0
    bw_ = bx1 - bx0
    bh_ = by1_ - by0_
    span_w = (bw_ + bh_) * COS30
    span_h = (bw_ + bh_) * SIN30 + h_max * 1.6
    avail_w = MOBILE_W - 2 * margin_x
    avail_h = map_h - margin_top - margin_bot
    sxy = min(avail_w / span_w, avail_h / span_h) * 1.05
    sz = sxy * 1.6
    mx = (bx0 + bx1) / 2
    my = (by0_ + by1_) / 2
    cx_canvas = panel_origin_x + MOBILE_W / 2 - (mx - my) * COS30 * sxy
    cy_canvas = panel_origin_y + map_h / 2 - (mx + my) * SIN30 * sxy

    def IS(x_, y_, z_):
        return (cx_canvas + (x_ - z_) * COS30 * sxy,
                cy_canvas + (x_ + z_) * SIN30 * sxy - y_ * sz)

    bbox_hi = box(bx0 - 60, by0_ - 60, bx1 + 60, by1_ + 60)
    return IS, sxy, sz, 1.0 / (COS30 * sxy), bbox_hi


def render_left_panel(target_id: int, pack_dir: pathlib.Path,
                      categories: Dict, ink) -> Tuple[Image.Image, Dict]:
    """Genera el panel izquierdo reusando exactamente la lógica de
    songkick (manzana hero + cards + chrome)."""
    import tempfile
    from packages.mockups.songkick import render_songkick_mockup
    tmp_dir = pathlib.Path(tempfile.gettempdir())
    tmp_out = tmp_dir / "_koinos_compare_left_tmp.png"
    res = render_songkick_mockup("3501602052", target_id, pack_dir, tmp_out)
    img = Image.open(tmp_out).convert("RGBA")
    try:
        tmp_out.unlink()
    except Exception:
        pass
    return img, res


def render_archetype_panel(panel_origin_x: int, panel_origin_y: int,
                           pack_dir: pathlib.Path, target_id: int,
                           categories: Dict, ink) -> Tuple[Image.Image, Dict]:
    img = Image.new("RGBA", (MOBILE_W, MOBILE_H), P["paper"] + (255,))
    ink_rgb = ink

    draw_status_bar(img, top_y=0, ink=ink_rgb, paper=P["paper_dim"])
    top_y = STATUS_BAR_H
    draw_top_bar(img, y0=top_y, ink=ink_rgb, paper=P["paper"])
    map_y0 = top_y + TOP_BAR_H
    map_h = MAP_H
    d = ImageDraw.Draw(img)
    d.rectangle((0, map_y0, MOBILE_W, map_y0 + map_h), fill=P["cream"])

    manz_gj = json.load(open(pack_dir / "manzanas.geojson", encoding="utf-8"))
    bldg_gj = json.load(open(pack_dir / "buildings.geojson", encoding="utf-8"))
    roads_gj = json.load(open(pack_dir / "roads.geojson", encoding="utf-8"))
    pois_gj = None
    pois_path = pack_dir / "pois.geojson"
    if pois_path.exists():
        pois_gj = json.load(open(pois_path, encoding="utf-8"))

    manz: Dict[int, Polygon] = {}
    for f in manz_gj["features"]:
        manz[f["properties"]["id"]] = shape(f["geometry"])
    target_poly = manz[target_id]

    IS, sxy, sz, m_per_px, bbox_hi = make_IS_for_panel(
        target_poly, 0, map_y0, map_h)

    others = sorted(
        [(mid, p) for mid, p in manz.items() if mid != target_id],
        key=lambda kv: kv[1].distance(target_poly),
    )[:6]

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

    road_col = hex2rgb("#8A8276")
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
    sorted_roads = sorted(roads_in,
                          key=lambda r: ROAD_TYPE_IMPORTANCE.get(r[0], 0))
    d = ImageDraw.Draw(img)
    for rtype, coords in sorted_roads:
        _, w_ = ROAD_TYPE_STYLE.get(rtype, ("sand_lt", 1))
        pts = [IS(x_, 0, z_) for x_, z_ in coords]
        if len(pts) >= 2:
            d.line(pts, fill=road_col, width=max(1, w_ - 1))

    target_buildings: List[Dict] = []
    neigh_buildings: List[Dict] = []
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
            "levels": int(f["properties"].get("levels") or 3),
            "centroid": (c.x, c.y),
            "area": poly.area,
            "bounds": poly.bounds,
            "props": f["properties"],
        }
        if b["manzana_id"] == target_id:
            target_buildings.append(b)
        elif bbox_hi.contains(c):
            neigh_buildings.append(b)

    def order_key(b):
        cx_, cz_ = b["centroid"]
        return cx_ + cz_

    archetype_dist = {}
    for b in sorted(neigh_buildings, key=order_key):
        atype = AC.classify_building(b["props"], b["area"])
        rot, long_m, short_m = AC.axis_angle_from_ring(b["ring"])
        canon_w, canon_d, canon_h = AC.ARCHETYPE_DIMS[atype]
        long_canon = max(canon_w, canon_d)
        scale_xy = max(0.4, long_m / long_canon)
        scale_z = 1.0
        if canon_h > 0:
            target_h = b["h"] if b["h"] > 0 else canon_h
            scale_z = target_h / canon_h
            scale_z = max(0.55, min(1.6, scale_z))
        cx_, cz_ = b["centroid"]
        sub = Image.new("RGBA", img.size, (0, 0, 0, 0))
        AC.ARCHETYPES[atype](sub, IS, ink_rgb, cx_m=cx_, cz_m=cz_,
                             scale_xy=scale_xy, scale_z=scale_z,
                             rot_rad=rot)
        alpha = sub.split()[3].point(lambda v: int(v * 0.78))
        sub.putalpha(alpha)
        img.alpha_composite(sub)

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
            scale_z = target_h / canon_h
            scale_z = max(0.55, min(1.6, scale_z))
        cx_, cz_ = b["centroid"]
        AC.ARCHETYPES[atype](img, IS, ink_rgb, cx_m=cx_, cz_m=cz_,
                             scale_xy=scale_xy, scale_z=scale_z,
                             rot_rad=rot)

    if pois_gj:
        for f in pois_gj["features"]:
            cat = f["properties"].get("category", "")
            if cat != "arbol":
                continue
            pt = f["geometry"]["coordinates"]
            try:
                if not (bbox_hi.bounds[0] <= pt[0] <= bbox_hi.bounds[2] and
                        bbox_hi.bounds[1] <= pt[1] <= bbox_hi.bounds[3]):
                    continue
            except Exception:
                continue
            AC.draw_arbol_grande(img, IS, ink_rgb, cx_m=pt[0], cz_m=pt[1],
                                 scale_xy=1.0, scale_z=1.0)

    bldg_with_screen = []
    for b in target_buildings:
        cx_, cz_ = b["centroid"]
        sx, sy = IS(cx_, b["h"], cz_)
        bldg_with_screen.append((b, sx, sy))
    third = map_h / 3
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

    draw_event_card(img, anchor_a, EVENTS[0], ink_rgb, place="above")
    draw_event_card(img, anchor_b, EVENTS[1], ink_rgb, place="below")

    sheet_y = MOBILE_H - HOME_INDICATOR_H - SHEET_PEEK_H
    n_buildings = len(target_buildings)
    n_portales = int(round(n_buildings * 3.9))
    draw_peek_sheet(img, y0=sheet_y, height=SHEET_PEEK_H, ink=ink_rgb,
                    n_buildings=n_buildings, n_portales=n_portales,
                    n_negocios=6, n_eventos=2)
    draw_home_indicator(img, bottom_y=MOBILE_H, ink=ink_rgb)

    return img, {
        "archetype_dist": archetype_dist,
        "n_target_buildings": len(target_buildings),
        "n_neigh_buildings": len(neigh_buildings),
    }


def render_compare_mockup(cusec: str, target_id: int,
                          pack_dir: pathlib.Path, out_path: pathlib.Path) -> Dict:
    meta = json.load(open(pack_dir / "meta.json", encoding="utf-8"))
    categories = meta["categories"]
    ink = P["ink"]

    canvas = Image.new("RGBA", (COMPARE_W, COMPARE_H + BANNER_H),
                       P["paper"] + (255,))

    left_img, left_meta = render_left_panel(target_id, pack_dir, categories, ink)
    right_img, right_meta = render_archetype_panel(0, 0, pack_dir, target_id,
                                                   categories, ink)

    canvas.paste(left_img, (0, BANNER_H))
    canvas.paste(right_img, (MOBILE_W + SEP_W, BANNER_H))
    sep = Image.new("RGBA", (SEP_W, COMPARE_H + BANNER_H), P["sand"] + (255,))
    canvas.paste(sep, (MOBILE_W, 0))

    f = sk_fonts()
    d = ImageDraw.Draw(canvas)
    d.rectangle((0, 0, MOBILE_W, BANNER_H), fill=hex2rgb("#5A4A38"))
    d.rectangle((MOBILE_W + SEP_W, 0, COMPARE_W, BANNER_H),
                fill=hex2rgb("#C85438"))
    txt_l = "ANTES · trazado OSM literal"
    txt_r = "AHORA · catálogo de arquetipos"
    f_banner = f["sheet_h"]
    wl = text_w(d, txt_l, f_banner)
    wr = text_w(d, txt_r, f_banner)
    d.text(((MOBILE_W - wl) // 2, (BANNER_H - 36) // 2),
           txt_l, fill=P["paper"], font=f_banner)
    d.text((MOBILE_W + SEP_W + (MOBILE_W - wr) // 2,
            (BANNER_H - 36) // 2),
           txt_r, fill=P["paper"], font=f_banner)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(out_path, "PNG", optimize=True)


    return {
        "out_path": out_path,
        "right_meta": right_meta,
        "left_meta": left_meta,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cusec")
    ap.add_argument("manzana_id", type=int)
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

    res = render_compare_mockup(args.cusec, args.manzana_id, pack_dir, out_path)
    rm = res["right_meta"]
    print(f"OK -> {res['out_path']}")
    print(f"  manzana hero:        {args.manzana_id}")
    print(f"  edificios target:    {rm['n_target_buildings']}")
    print(f"  edificios vecinos:   {rm['n_neigh_buildings']}")
    print(f"  distribucion arq:    {rm['archetype_dist']}")


if __name__ == "__main__":
    main()
