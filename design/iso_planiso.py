"""KOINOS · POLIS — comparativa cenital vs isométrico por sección.

Genera UN PNG con DOS paneles horizontales que permiten a Pancho juzgar
visualmente la fidelidad del render isométrico contra el plano cenital
construido con los mismos datos OSM/INE, ANTES de lanzar el batch.

  Panel A · vista cenital (plan view, NO iso): bbox de la sección desde
           arriba con suelo paper, polígono de la sección con borde ocre,
           carreteras OSM por tipo, edificios en relleno semitransparente,
           POIs por categoría. Norte arriba. Rosa de los vientos +
           escala 100 m. Comparable con polis-provincia.html en cámara
           cenital sobre las mismas coords.

  Panel B · iso isométrico LOD-2 (paquetes 1+2+4+5): reusa el render
           compacto de iso_packages.py — suelo + viales + edificios
           extruidos coloreados por uso dominante (POI<60m + heurística).

Uso:
    python3 iso_planiso.py 3501602052

Salida:
    design/secciones/<cusec>_planiso.png

Requiere: Pillow, shapely. NO requiere conexión a internet (no descarga
tiles satelitales).
"""
from __future__ import annotations
import argparse, json, math, pathlib, time
from collections import Counter
from typing import Dict, List, Tuple
from PIL import Image, ImageDraw, ImageFont
from shapely.geometry import shape, Polygon, MultiPolygon, Point, LineString, box
from shapely.ops import unary_union

# // shared helpers — reuso directo de iso_packages
from iso_packages import (
    P, COS30, SIN30, POI_CAT, CAT_COLOR, CAT_LABEL,
    iso, shade,
    load_section_polygon, load_buildings, load_roads_in_bbox, load_pois_near,
    project_to_meters, assign_categories,
    fonts, render_prism, ROAD_STYLE, draw_roads,
)

ROOT = pathlib.Path(__file__).resolve().parent
OUT = ROOT / "secciones"
OUT.mkdir(exist_ok=True)

# ---------------------------------------------------------- canvas
PANEL_W, PANEL_H = 1300, 1300
BANNER_H = 90

# ---------------------------------------------------------- panel A: vista cenital
def render_plan_panel(cusec: str,
                      sec_poly_lnglat: Polygon,
                      footprints_lnglat: List[list],
                      roads_lnglat: List[Tuple[str, list]],
                      pois_lnglat: List[Tuple[Tuple[float,float], str]],
                      bbox: Tuple[float,float,float,float],
                      area_ha: float) -> Image.Image:
    """Panel cenital (plan view). Norte arriba. Mismas coords que
       polis-provincia.html para que Pancho pueda comparar a ojo."""
    img = Image.new("RGBA", (PANEL_W, PANEL_H), P["paper"]+(255,))
    d = ImageDraw.Draw(img)
    f_t, f_s, _, f_b2 = fonts()

    # ---- franja título
    d.rectangle((0, 0, PANEL_W, 56), fill=P["ink"]+(255,))
    d.text((22, 14),
           "VISTA CENITAL · datos OSM/INE — comparable con polis-provincia.html",
           fill=P["paper"], font=f_t)

    # ---- área de mapa
    margin_left, margin_right = 30, 30
    margin_top, margin_bot = 70, 70
    map_x0, map_y0 = margin_left, margin_top
    map_x1, map_y1 = PANEL_W - margin_right, PANEL_H - margin_bot

    min_lng, min_lat, max_lng, max_lat = bbox
    # padding 4% para que no roce el borde
    pad_x = (max_lng - min_lng) * 0.04
    pad_y = (max_lat - min_lat) * 0.04
    e_min_lng = min_lng - pad_x
    e_max_lng = max_lng + pad_x
    e_min_lat = min_lat - pad_y
    e_max_lat = max_lat + pad_y

    # mantener relación de aspecto correcta usando cos(lat)
    lat0 = (e_min_lat + e_max_lat) / 2
    cos_lat0 = math.cos(math.radians(lat0))
    dx = (e_max_lng - e_min_lng) * cos_lat0
    dy = (e_max_lat - e_min_lat)
    aw = map_x1 - map_x0
    ah = map_y1 - map_y0
    s = min(aw / dx, ah / dy)
    fw = dx * s
    fh = dy * s
    ox = map_x0 + (aw - fw) / 2
    oy = map_y0 + (ah - fh) / 2

    def ll2px(lng, lat):
        u = (lng - e_min_lng) * cos_lat0 * s
        v = (e_max_lat - lat) * s
        return (ox + u, oy + v)

    # fondo del mapa: paper crema
    d.rectangle((ox, oy, ox+fw, oy+fh), fill=P["cream"]+(255,), outline=P["ocre_dk"], width=1)

    # ---- carreteras (orden: poco importantes primero)
    importance = {
        "motorway":7, "trunk":7, "primary":6, "secondary":5, "tertiary":4,
        "unclassified":3, "residential":3, "living_street":3,
        "pedestrian":2, "service":1, "footway":1, "path":1, "track":1,
        "cycleway":1, "steps":1,
    }
    # anchos requeridos por el spec: primary 4, secondary 3, tertiary 2.5,
    # residential 2, service/footway 1.2 — mantener consistencia con polis
    PLAN_ROAD_STYLE = {
        "motorway":     (P["ink"],     5),
        "trunk":        (P["ink"],     5),
        "primary":      (P["shadow"],  4),
        "secondary":    (P["ocre_dk"], 3),
        "tertiary":     (P["ocre"],    3),  # 2.5 redondeado
        "residential":  (P["sand"],    2),
        "unclassified": (P["sand"],    2),
        "living_street":(P["sand"],    2),
        "pedestrian":   (P["sand_lt"], 2),
        "service":      (P["sand_lt"], 1),
        "footway":      (P["sand_lt"], 1),
        "path":         (P["sand_lt"], 1),
        "track":        (P["sand_lt"], 1),
        "cycleway":     (P["sand_lt"], 1),
        "steps":        (P["sand_lt"], 1),
    }
    sorted_roads = sorted(roads_lnglat, key=lambda r: importance.get(r[0], 0))
    for hw, coords in sorted_roads:
        col, w = PLAN_ROAD_STYLE.get(hw, (P["sand_lt"], 1))
        pts = [ll2px(lng, lat) for lng, lat in coords]
        if len(pts) >= 2:
            d.line(pts, fill=col, width=w)

    # ---- edificios (relleno semitransparente ocre + borde ink fino)
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    fill_b = P["ocre"] + (140,)
    for ring in footprints_lnglat:
        pts = [ll2px(lng, lat) for lng, lat in ring]
        if len(pts) >= 3:
            od.polygon(pts, fill=fill_b, outline=P["ink"]+(220,))
    img = Image.alpha_composite(img, overlay)
    d = ImageDraw.Draw(img)

    # ---- POIs por categoría
    for (lng, lat), cat in pois_lnglat:
        if not (min_lng <= lng <= max_lng and min_lat <= lat <= max_lat):
            continue
        col = CAT_COLOR.get(cat, P["ink"])
        x, y = ll2px(lng, lat)
        r = 5
        d.ellipse((x-r, y-r, x+r, y+r), fill=col, outline=P["ink"], width=1)

    # ---- contorno de la sección con borde grueso ocre oscuro
    if isinstance(sec_poly_lnglat, MultiPolygon):
        rings = [list(p.exterior.coords) for p in sec_poly_lnglat.geoms]
    else:
        rings = [list(sec_poly_lnglat.exterior.coords)]
    for ring in rings:
        pts = [ll2px(lng, lat) for lng, lat in ring]
        if len(pts) >= 2:
            d.line(pts, fill=P["ocre_dk"], width=4)

    # ---- rosa de los vientos (esquina sup-derecha)
    rose_cx = ox + fw - 56
    rose_cy = oy + 56
    rose_r = 32
    d.ellipse((rose_cx-rose_r, rose_cy-rose_r, rose_cx+rose_r, rose_cy+rose_r),
              fill=P["paper"]+(220,), outline=P["ink"], width=1)
    # aguja N-S
    d.polygon([(rose_cx, rose_cy-rose_r+4),
               (rose_cx-7, rose_cy),
               (rose_cx+7, rose_cy)], fill=P["accent"], outline=P["ink"])
    d.polygon([(rose_cx, rose_cy+rose_r-4),
               (rose_cx-7, rose_cy),
               (rose_cx+7, rose_cy)], fill=P["sand"], outline=P["ink"])
    d.text((rose_cx-5, rose_cy-rose_r-18), "N", fill=P["ink"], font=f_t)

    # ---- escala gráfica 100 m (esquina inf-izq dentro del mapa)
    # 100 m = (100 / 111320 / cos_lat0) grados de lng
    deg_100m = 100.0 / (111320.0 * cos_lat0)
    px_100m = deg_100m * cos_lat0 * s
    sc_x0 = ox + 20
    sc_y = oy + fh - 26
    d.rectangle((sc_x0, sc_y, sc_x0 + px_100m, sc_y + 6),
                fill=P["ink"], outline=P["ink"])
    d.rectangle((sc_x0 + px_100m/2, sc_y, sc_x0 + px_100m, sc_y + 6),
                fill=P["paper"], outline=P["ink"])
    d.text((sc_x0, sc_y - 22), "100 m", fill=P["ink"], font=f_s)

    # ---- pie con coords
    cx_lng = (bbox[0] + bbox[2]) / 2
    cy_lat = (bbox[1] + bbox[3]) / 2
    foot = (f"centro lat={cy_lat:.6f} lng={cx_lng:.6f}  ·  "
            f"bbox WSEN: {bbox[0]:.5f}, {bbox[1]:.5f}, {bbox[2]:.5f}, {bbox[3]:.5f}  ·  "
            f"sup. {area_ha:.2f} ha")
    d.text((22, PANEL_H - 32), foot[:170], fill=P["ocre_dk"], font=f_s)

    return img

# ---------------------------------------------------------- panel B: iso compacto
def render_iso_panel(cusec: str,
                     polys_m: List[Polygon],
                     heights: List[float],
                     roads_m: List[Tuple[str, list]],
                     section_m_ring: list,
                     section_m: Polygon,
                     cats: List[str],
                     cat_counter: Counter) -> Image.Image:
    """Panel iso isométrico: paquetes 1+2+4+5 compactados.
       Norte arriba se interpreta como esquina sup-derecha en iso (eje +y
       baja-derecha en la convención de iso())."""
    img = Image.new("RGBA", (PANEL_W, PANEL_H), P["paper"]+(255,))
    d = ImageDraw.Draw(img)
    f_t, f_s, _, _ = fonts()

    # franja título
    d.rectangle((0, 0, PANEL_W, 56), fill=P["ink"]+(255,))
    d.text((22, 14),
           "ISOMÉTRICO · render KOINOS (paquetes 1+2+4+5)",
           fill=P["paper"], font=f_t)

    # ---- escala iso (idem iso_packages)
    bx0, by0, bx1, by1 = section_m.bounds
    h_max = max(heights) if heights else 12
    bw, bh = bx1 - bx0, by1 - by0
    span_w = (bw + bh) * COS30
    span_h = (bw + bh) * SIN30 + h_max * 1.6
    margin = 80
    sxy = min((PANEL_W - 2*margin)/span_w, (PANEL_H - 2*margin - 100)/span_h)
    sz = sxy * 1.6
    mx = (bx0+bx1)/2; my = (by0+by1)/2
    cx_canvas = PANEL_W/2 - (mx-my)*COS30*sxy
    cy_canvas = PANEL_H/2 + 70 - (mx+my)*SIN30*sxy

    # ---- suelo (sección)
    pts_section = [iso(x, y, 0, sxy, sz, cx_canvas, cy_canvas) for x,y in section_m_ring]
    d.polygon(pts_section, fill=P["cream"]+(255,), outline=P["ocre_dk"], width=3)

    # ---- viales
    draw_roads(d, roads_m, sxy, sz, cx_canvas, cy_canvas, section_m)

    # ---- contorno de la sección encima de roads
    d.line(pts_section, fill=P["ocre_dk"], width=3)

    # ---- edificios LOD-2 coloreados por uso dominante
    order_b = sorted(range(len(polys_m)),
                     key=lambda i: polys_m[i].bounds[0]+polys_m[i].bounds[1])
    for i in order_b:
        ext = list(polys_m[i].exterior.coords)
        cat = cats[i]
        base = CAT_COLOR[cat]
        top = base
        left = shade(base, 0.78)
        right = shade(base, 0.92)
        render_prism(d, ext, heights[i], sxy, sz, cx_canvas, cy_canvas,
                     top=top, left=left, right=right, stroke=1)

    # ---- mini indicador "N ↗" para recordar que norte va arriba-derecha en iso
    arrow_cx = PANEL_W - 90
    arrow_cy = 100
    d.ellipse((arrow_cx-30, arrow_cy-30, arrow_cx+30, arrow_cy+30),
              fill=P["paper"]+(220,), outline=P["ink"], width=1)
    # flecha hacia esquina sup-der (en iso, +y de mundo va abajo-der; el norte
    # geográfico real es -y de mundo → en iso queda arriba-der).
    ax = arrow_cx + 18 * COS30
    ay = arrow_cy - 18 * SIN30 - 4
    bx_ = arrow_cx - 18 * COS30
    by_ = arrow_cy + 18 * SIN30 + 4
    d.line([(bx_, by_), (ax, ay)], fill=P["accent"], width=3)
    # punta
    d.polygon([(ax, ay), (ax-8, ay+2), (ax-4, ay+8)], fill=P["accent"])
    d.text((arrow_cx-6, arrow_cy-50), "N", fill=P["ink"], font=f_t)

    # ---- leyenda al pie
    legend_y = PANEL_H - 64
    legend_x = 22
    d.rectangle((0, legend_y-4, PANEL_W, legend_y+30), fill=P["cream"]+(255,))
    cur_x = legend_x
    for cat in ("food","shop","lodge","health","finance","civic","resi"):
        col = CAT_COLOR[cat]
        d.rectangle((cur_x, legend_y+2, cur_x+18, legend_y+20),
                    fill=col, outline=P["ink"])
        label = CAT_LABEL[cat]
        n = cat_counter.get(cat, 0)
        txt = f"{label} ({n})"
        d.text((cur_x+22, legend_y+4), txt, fill=P["ink"], font=f_s)
        w_est = 22 + len(txt)*7
        cur_x += w_est + 12

    # subtítulo
    sub = (f"{len(polys_m)} edificios extruidos  ·  altura real m  ·  "
           f"colores por uso (POI<60m + heurística)")
    d.text((22, PANEL_H - 36), sub[:160], fill=P["ocre_dk"], font=f_s)

    return img

# ---------------------------------------------------------- master
def render(cusec: str):
    t0 = time.time()
    print(f"[{cusec}] cargando…")
    sec_poly_lnglat = load_section_polygon(cusec)
    bbox = sec_poly_lnglat.bounds
    raw = load_buildings(cusec)
    print(f"[{cusec}] {len(raw)} edificios, bbox={bbox}")

    # proyección al centro
    lon0 = (bbox[0]+bbox[2])/2
    lat0 = (bbox[1]+bbox[3])/2
    to_m, _ = project_to_meters(lon0, lat0)

    # polígono sección en metros
    if isinstance(sec_poly_lnglat, MultiPolygon):
        sec_poly_main = max(sec_poly_lnglat.geoms, key=lambda p: p.area)
    else:
        sec_poly_main = sec_poly_lnglat
    section_m_ring = [to_m(*c) for c in sec_poly_main.exterior.coords]
    section_m = Polygon(section_m_ring)
    if not section_m.is_valid:
        section_m = section_m.buffer(0)

    # edificios
    polys_m, heights, footprints_lnglat = [], [], []
    for b in raw:
        ring_lnglat = b[0]
        ring_m = [to_m(*p) for p in ring_lnglat]
        if ring_m[0] != ring_m[-1]: ring_m.append(ring_m[0])
        h = float(b[1]) if len(b)>=2 and b[1] else 6.0
        if h < 1.5: h = 6.0
        try:
            p = Polygon(ring_m)
            if p.is_valid and p.area > 1.0:
                polys_m.append(p); heights.append(h)
                footprints_lnglat.append(ring_lnglat)
        except Exception:
            pass
    print(f"[{cusec}] {len(polys_m)} edificios válidos")

    # roads
    roads_lnglat = load_roads_in_bbox(bbox)
    roads_m = [(hw, [to_m(*c) for c in coords]) for hw, coords in roads_lnglat]
    rcount = Counter(hw for hw,_ in roads_m)
    print(f"[{cusec}] {len(roads_m)} tramos: {rcount.most_common(6)}")

    # POIs
    pois_lnglat = load_pois_near(bbox, pad=0.0030)
    pois_m = [(to_m(*c), cat) for c, cat in pois_lnglat]
    print(f"[{cusec}] {len(pois_m)} POIs en bbox+pad")

    # categorías
    cats = assign_categories(polys_m, heights, pois_m, max_dist_m=60.0)
    cat_counter = Counter(cats)
    print(f"[{cusec}] categorías: {cat_counter.most_common()}")

    # métricas
    area_ha = section_m.area / 10000.0

    # ---- paneles
    print(f"[{cusec}] panel A · cenital")
    panel_a = render_plan_panel(cusec, sec_poly_lnglat, footprints_lnglat,
                                roads_lnglat, pois_lnglat, bbox, area_ha)

    print(f"[{cusec}] panel B · iso")
    panel_b = render_iso_panel(cusec, polys_m, heights, roads_m,
                               section_m_ring, section_m, cats, cat_counter)

    # ---- composición global con banner
    f_t, f_s, f_b, f_b2 = fonts()
    total_w = PANEL_W * 2
    total_h = BANNER_H + PANEL_H
    out_img = Image.new("RGBA", (total_w, total_h), P["paper"]+(255,))
    bd = ImageDraw.Draw(out_img)
    bd.rectangle((0, 0, total_w, BANNER_H), fill=P["cream"]+(255,))
    bd.text((28, 14),
            f"KOINOS · POLIS — comparativa cenital vs isométrico  ·  sección {cusec}",
            fill=P["ink"], font=f_b)
    today = time.strftime("%Y-%m-%d")
    sub = (f"cusec {cusec}  ·  {len(polys_m)} edificios  ·  "
           f"{len(roads_m)} calles OSM  ·  {area_ha:.2f} ha  ·  {today}")
    bd.text((28, 54), sub[:200], fill=P["ocre_dk"], font=f_b2)

    out_img.paste(panel_a, (0, BANNER_H))
    out_img.paste(panel_b, (PANEL_W, BANNER_H))

    out_path = OUT / f"{cusec}_planiso.png"
    out_img.convert("RGB").save(out_path, "PNG", optimize=True)
    elapsed = time.time() - t0
    print(f"[{cusec}] guardado en {out_path}  ({elapsed:.1f}s)")
    return out_path, elapsed, len(polys_m), len(roads_m), area_ha

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("seccion", nargs="?", default="3501602052")
    args = ap.parse_args()
    render(args.seccion)
