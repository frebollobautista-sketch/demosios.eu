"""KOINOS — moldes isométricos de edificios coloreados desde una imagen aérea.

Pipeline (independiente de la fuente del raster):

    1. Cargar `public/buildings/<seccion>.json`
       Formato:  [ [polígono_lng_lat, altura_m, niveles?], ... ]

    2. Generar / descargar un raster aéreo que cubra la sección:
       - `--source synth`  (por defecto)  raster sintético procedural,
         realista para Canarias (mezcla terracota / hormigón / vegetación)
       - `--source esri`   tiles de Esri World Imagery (ejecutar LOCAL,
         el sandbox no tiene acceso a server.arcgisonline.com)

    3. Para cada edificio:
         • polígono lng/lat  →  píxeles del raster aéreo  →  color medio
         • polígono lng/lat  →  metros locales (ENU)      →  proyección iso
       Se renderizan DOS variantes en el mismo lienzo, lado a lado:
         A. tejado plano con el color medio del satélite
         B. tejado con el recorte real del raster (warp afín por triángulos)
       Las paredes laterales se sombrean a partir del color del tejado.

    4. Salida:  /KOINOS/design/secciones/<seccion>_iso.png
"""
from __future__ import annotations
import argparse, json, math, pathlib, random
from typing import List, Tuple
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

# --------------------------------------------------------------------- paths
ROOT = pathlib.Path(__file__).resolve().parent           # /KOINOS/design
BUILDINGS = ROOT.parent / "public" / "buildings"          # /KOINOS/public/buildings
OUT = ROOT / "secciones"
OUT.mkdir(exist_ok=True)

# --------------------------------------------------------- isometric helpers
COS30 = math.cos(math.radians(30))
SIN30 = 0.5

def to_local_meters(poly_lnglat: List[List[float]],
                    lng0: float, lat0: float) -> List[Tuple[float, float]]:
    """Convert a lng/lat ring into local east/south metres around (lng0,lat0)."""
    cos_lat0 = math.cos(math.radians(lat0))
    out = []
    for lng, lat in poly_lnglat:
        x =  (lng - lng0) * 111320.0 * cos_lat0
        y = -(lat - lat0) * 111320.0      # SOUTH-positive so north points up-right
        out.append((x, y))
    return out

def iso(x: float, y: float, z: float, scale_xy: float, scale_z: float,
        cx: float, cy: float) -> Tuple[float, float]:
    return (cx + (x - y) * COS30 * scale_xy,
            cy + (x + y) * SIN30 * scale_xy - z * scale_z)

# --------------------------------------------------- aerial raster (synth/esri)
def lnglat_bbox(buildings) -> Tuple[float, float, float, float]:
    xs, ys = [], []
    for b in buildings:
        for p in b[0]:
            xs.append(p[0]); ys.append(p[1])
    pad_x = (max(xs) - min(xs)) * 0.04
    pad_y = (max(ys) - min(ys)) * 0.04
    return min(xs)-pad_x, min(ys)-pad_y, max(xs)+pad_x, max(ys)+pad_y

def synth_aerial(bbox: Tuple[float, float, float, float],
                 buildings, ppm: float = 6.0,
                 seed: int = 42) -> Tuple[Image.Image, callable]:
    """Make a synthetic aerial photo that *looks* like Las Palmas seen from above.

    Returns (image, lnglat_to_pixel) where lnglat_to_pixel(lng, lat) -> (px, py).
    """
    min_lng, min_lat, max_lng, max_lat = bbox
    cos_lat0 = math.cos(math.radians((min_lat + max_lat) / 2))
    W = int((max_lng - min_lng) * 111320 * cos_lat0 * ppm)
    H = int((max_lat - min_lat) * 111320 * ppm)
    rng = np.random.default_rng(seed)

    # --- ground: warm asphalt + sand mosaic with low-frequency variation
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    # low-freq fields (smooth gradients of urban tone)
    def noise(scale, amp):
        nh = max(2, int(H/scale))
        nw = max(2, int(W/scale))
        n = rng.random((nh, nw)).astype(np.float32)
        return np.array(Image.fromarray(n).resize((W, H), Image.BILINEAR)) * amp

    base = np.zeros((H, W, 3), dtype=np.float32)
    # warm urban grey base (asphalt + concrete)
    base[..., 0] = 110 + noise(40, 35) + noise(8, 8)
    base[..., 1] = 102 + noise(40, 30) + noise(8, 6)
    base[..., 2] =  92 + noise(40, 22) + noise(8, 4)
    # an avenue of darker asphalt down the diagonal of the section
    diag = np.abs((xx + yy) / (W + H) - 0.55)
    road = np.clip(1.0 - diag * 12, 0, 1)[..., None]
    base = base * (1 - road * 0.25) + np.array([60, 56, 52]) * (road * 0.25)
    # a band of paler stone toward the top (lighter inland)
    band = np.clip((1 - yy / H) - 0.25, 0, 1)[..., None]
    base = base * (1 - band * 0.20) + np.array([180, 170, 150]) * (band * 0.20)
    # sprinkle of green (parks, patios)
    green_spots = noise(60, 1.0)
    g_mask = (green_spots > 0.78).astype(np.float32)[..., None]
    base = base * (1 - g_mask * 0.55) + np.array([95, 120, 70]) * (g_mask * 0.55)

    img = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8))
    draw = ImageDraw.Draw(img)

    # mapping helper
    def lnglat_to_pixel(lng, lat):
        u = (lng - min_lng) / (max_lng - min_lng) * W
        v = (max_lat - lat) / (max_lat - min_lat) * H
        return u, v

    # paint each building footprint with a realistic roof colour palette so
    # the sample inside the polygon picks up that hue (terracotta / concrete /
    # gravel / white / green)
    palette = [
        (190,  92,  62),  # terracotta tile
        (200, 105,  72),
        (175,  85,  58),
        (210, 198, 178),  # cream stucco / flat concrete
        (185, 175, 158),
        (135, 130, 122),  # grey flat roof
        (105, 102,  98),  # darker grey
        ( 95, 110,  78),  # green roof / patio
        (235, 225, 205),  # white roof
    ]
    seed_rng = random.Random(seed)
    for b in buildings:
        ring = b[0]
        col = seed_rng.choice(palette)
        px = [lnglat_to_pixel(lng, lat) for lng, lat in ring]
        if len(px) < 3: continue
        draw.polygon(px, fill=col, outline=tuple(int(c*0.8) for c in col))
        # bbox in pixels
        xmin = max(0, int(min(p[0] for p in px)))
        ymin = max(0, int(min(p[1] for p in px)))
        xmax = min(W-1, int(max(p[0] for p in px)))
        ymax = min(H-1, int(max(p[1] for p in px)))
        if xmax - xmin < 4 or ymax - ymin < 4: continue
        bw, bh = xmax - xmin, ymax - ymin
        # roof tile pattern — larger, more contrasty, so it survives the iso
        # downsampling and clearly differentiates the clip variant.
        step = max(5, bh // 4 if bw >= bh else bw // 4)
        if bw >= bh:
            for yy in range(ymin, ymax, step):
                jitter = tuple(min(255, max(0, int(c + seed_rng.uniform(-45, 45))))
                               for c in col)
                draw.line([(xmin, yy), (xmax, yy)], fill=jitter, width=2)
        else:
            for xx in range(xmin, xmax, step):
                jitter = tuple(min(255, max(0, int(c + seed_rng.uniform(-45, 45))))
                               for c in col)
                draw.line([(xx, ymin), (xx, ymax)], fill=jitter, width=2)
        # bigger skylights / patios / AC units
        for _ in range(3):
            ux = seed_rng.uniform(xmin + 2, xmax - 2)
            uy = seed_rng.uniform(ymin + 2, ymax - 2)
            r  = seed_rng.uniform(3, max(4, min(bw, bh) / 4))
            patch = tuple(min(255, max(0, int(c + seed_rng.uniform(-65, 65))))
                          for c in col)
            draw.ellipse((ux-r, uy-r, ux+r, uy+r), fill=patch)
    img = img.filter(ImageFilter.GaussianBlur(0.5))
    return img, lnglat_to_pixel


def esri_aerial(bbox, buildings, zoom: int = 18):
    """Real Esri World Imagery fetcher.  Run LOCAL — sandbox has no network."""
    import urllib.request
    min_lng, min_lat, max_lng, max_lat = bbox
    n = 2 ** zoom
    def lnglat_to_tile(lng, lat):
        x = (lng + 180) / 360 * n
        rad = math.radians(lat)
        y = (1 - math.log(math.tan(rad) + 1/math.cos(rad))/math.pi)/2 * n
        return x, y
    x0, y1 = lnglat_to_tile(min_lng, min_lat)
    x1, y0 = lnglat_to_tile(max_lng, max_lat)
    tx0, tx1 = int(math.floor(x0)), int(math.floor(x1))
    ty0, ty1 = int(math.floor(y0)), int(math.floor(y1))
    cols, rows = tx1 - tx0 + 1, ty1 - ty0 + 1
    img = Image.new("RGB", (cols * 256, rows * 256))
    base = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile"
    for ty in range(ty0, ty1 + 1):
        for tx in range(tx0, tx1 + 1):
            url = f"{base}/{zoom}/{ty}/{tx}"
            req = urllib.request.Request(url, headers={"User-Agent": "KOINOS"})
            with urllib.request.urlopen(req, timeout=10) as r:
                tile = Image.open(r).convert("RGB")
            img.paste(tile, ((tx - tx0) * 256, (ty - ty0) * 256))
    W, H = img.size
    def lnglat_to_pixel(lng, lat):
        x, y = lnglat_to_tile(lng, lat)
        return (x - tx0) * 256, (y - ty0) * 256
    return img, lnglat_to_pixel

# ------------------------------------------------------- colour sampling
def avg_color_in_polygon(raster: Image.Image, poly_pixels) -> Tuple[int, int, int]:
    """Mean RGB of `raster` pixels lying inside the polygon."""
    W, H = raster.size
    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).polygon([(int(x), int(y)) for x, y in poly_pixels], fill=255)
    a = np.asarray(raster, dtype=np.uint16)
    m = np.asarray(mask, dtype=np.uint8)
    if m.sum() == 0:
        # tiny polygon — fall back to a 3×3 centroid sample
        cx = sum(p[0] for p in poly_pixels) / len(poly_pixels)
        cy = sum(p[1] for p in poly_pixels) / len(poly_pixels)
        x0, y0 = max(0,int(cx)-1), max(0,int(cy)-1)
        return tuple(int(c) for c in np.mean(a[y0:y0+3, x0:x0+3].reshape(-1,3), axis=0))
    sums = (a * (m[..., None] > 0)).reshape(-1, 3).sum(axis=0)
    n = (m > 0).sum()
    return tuple(int(c) for c in sums // n)

def shade(rgb: Tuple[int, int, int], k: float) -> Tuple[int, int, int]:
    return tuple(max(0, min(255, int(c * k))) for c in rgb)

# -------------------------------------------------------- iso renderer
def render_section(seccion: str, source: str = "synth",
                   variant: str = "both") -> pathlib.Path:
    f = BUILDINGS / f"{seccion}.json"
    buildings = json.load(open(f, encoding="utf-8"))
    print(f"[{seccion}] {len(buildings)} edificios")

    # bbox + local frame
    min_lng, min_lat, max_lng, max_lat = lnglat_bbox(buildings)
    lng0 = (min_lng + max_lng) / 2
    lat0 = (min_lat + max_lat) / 2

    # fetch aerial raster
    if source == "esri":
        aerial, ll2px = esri_aerial((min_lng, min_lat, max_lng, max_lat), buildings)
    else:
        aerial, ll2px = synth_aerial((min_lng, min_lat, max_lng, max_lat), buildings)
    print(f"[{seccion}] aerial raster {aerial.size}  source={source}")

    # local-meter footprints + sampled colour
    metres, colours, heights, raster_polys = [], [], [], []
    for b in buildings:
        ring = b[0]
        h = float(b[1]) if len(b) >= 2 else 6.0
        if h < 1.5: h = 6.0
        m = to_local_meters(ring, lng0, lat0)
        metres.append(m)
        heights.append(h)
        rp = [ll2px(lng, lat) for lng, lat in ring]
        raster_polys.append(rp)
        colours.append(avg_color_in_polygon(aerial, rp))

    # iso scale & framing — based on the actual bbox of all building vertices
    xs = [x for poly in metres for x, _ in poly]
    ys = [y for poly in metres for _, y in poly]
    bx0, bx1 = min(xs), max(xs)
    by0, by1 = min(ys), max(ys)
    bw = bx1 - bx0
    bh = by1 - by0
    span_iso_w = (bw + bh) * COS30
    span_iso_h = (bw + bh) * SIN30 + max(heights) * 1.6
    panel_w, panel_h = 1300, 1050
    margin = 80
    scale_xy = (panel_w - 2*margin) / span_iso_w
    # vertical fit check
    if (panel_h - 2*margin) / span_iso_h < scale_xy:
        scale_xy = (panel_h - 2*margin) / span_iso_h
    scale_z  = scale_xy * 1.6

    # centre iso bbox-midpoint at canvas centre (slightly low for ground)
    mx = (bx0 + bx1) / 2
    my = (by0 + by1) / 2
    cx = panel_w / 2 - (mx - my) * COS30 * scale_xy
    cy = panel_h / 2 + 60 - (mx + my) * SIN30 * scale_xy

    # render panels
    panels = []
    for mode in ("flat", "clip"):
        if variant != "both" and variant != mode: continue
        panel = Image.new("RGBA", (panel_w, panel_h),
                          (251, 244, 221, 255))
        d = ImageDraw.Draw(panel)
        # ground tile (the section bbox)
        ground = [
            iso(bx0, by0, 0, scale_xy, scale_z, cx, cy),
            iso(bx1, by0, 0, scale_xy, scale_z, cx, cy),
            iso(bx1, by1, 0, scale_xy, scale_z, cx, cy),
            iso(bx0, by1, 0, scale_xy, scale_z, cx, cy),
        ]
        d.polygon(ground, fill=(232, 218, 188), outline=(138, 90, 42), width=2)

        # painter's algo: sort buildings by max(x+y) ascending so back ones first
        order = sorted(range(len(metres)),
                       key=lambda i: max(x+y for x,y in metres[i]))
        for i in order:
            poly_m = metres[i]
            h = heights[i]
            roof_rgb = colours[i]
            # vertices: bottom (z=0) and top (z=h)
            bot = [iso(x, y, 0,   scale_xy, scale_z, cx, cy) for x, y in poly_m]
            top = [iso(x, y, h,   scale_xy, scale_z, cx, cy) for x, y in poly_m]
            n = len(poly_m)
            # walls — only those whose outward normal faces the camera (south or east)
            for k in range(n - 1):
                ax, ay = poly_m[k]
                bx, by = poly_m[k + 1]
                # outward normal in our local (east, south) frame:
                nx, ny = (by - ay), -(bx - ax)
                # camera looks toward (-east, -south, -up) roughly: light from upper-right
                # We just colour SE-facing faces brighter.
                if nx + ny <= 0:           # wall is on the back, skip
                    continue
                # cast a small offset shadow dab on the ground for depth
                wall_pts = [bot[k], bot[k+1], top[k+1], top[k]]
                tilt = (nx) / (abs(nx) + abs(ny) + 1e-6)   # -1..1
                k_shade = 0.55 + 0.18 * tilt              # east-facing brighter
                d.polygon(wall_pts, fill=shade(roof_rgb, k_shade),
                          outline=(34, 29, 24))
            # roof
            if mode == "flat":
                d.polygon(top, fill=roof_rgb, outline=(34, 29, 24))
            else:
                # CLIP variant: warp the satellite raster polygon onto the iso top.
                # Strategy: triangulate the polygon (fan from poly[0]) and apply
                # an affine transform per triangle from raster coords -> iso coords.
                src_poly = raster_polys[i]
                # Build a working RGBA layer with just this building's clip
                rx_min = max(0, int(min(p[0] for p in src_poly)) - 2)
                ry_min = max(0, int(min(p[1] for p in src_poly)) - 2)
                rx_max = min(aerial.size[0], int(max(p[0] for p in src_poly)) + 2)
                ry_max = min(aerial.size[1], int(max(p[1] for p in src_poly)) + 2)
                if rx_max <= rx_min or ry_max <= ry_min:
                    d.polygon(top, fill=roof_rgb, outline=(34, 29, 24))
                    continue
                cw = rx_max - rx_min
                ch = ry_max - ry_min
                local = aerial.crop((rx_min, ry_min, rx_max, ry_max)).convert("RGBA")
                # fan triangles in raster space
                src_local = [(p[0] - rx_min, p[1] - ry_min) for p in src_poly]
                dst_iso   = top
                for k in range(1, n - 1):
                    s_tri = [src_local[0], src_local[k], src_local[k+1]]
                    d_tri = [dst_iso[0],   dst_iso[k],   dst_iso[k+1]]
                    warped = _affine_warp_triangle(local, s_tri, d_tri,
                                                   panel_w, panel_h)
                    panel.alpha_composite(warped)
                # stroke the iso top edge
                d.polygon(top, fill=None, outline=(34, 29, 24))

        # title strip
        d.rectangle((0, 0, panel_w, 60), fill=(34, 29, 24, 255))
        title = ("VARIANTE A · color medio del satélite"
                 if mode == "flat" else
                 "VARIANTE B · recorte texturizado del satélite")
        try:
            f_t = ImageFont.truetype(
                "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf", 26)
            f_s = ImageFont.truetype(
                "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf", 18)
        except Exception:
            f_t = f_s = ImageFont.load_default()
        d.text((28, 16), title, fill=(251, 244, 221), font=f_t)
        d.text((28, panel_h - 36),
               f"sección {seccion}  ·  {len(buildings)} edificios  ·  fuente del raster: {source}",
               fill=(34, 29, 24), font=f_s)
        panels.append(panel)

    # ---- aerial reference panel (top-down) with footprints overlaid
    ref = Image.new("RGBA", (panel_w, panel_h), (251, 244, 221, 255))
    rd = ImageDraw.Draw(ref)
    rd.rectangle((0, 0, panel_w, 60), fill=(34, 29, 24, 255))
    try:
        f_t = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf", 26)
        f_s = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf", 18)
    except Exception:
        f_t = f_s = ImageFont.load_default()
    rd.text((28, 16), "REFERENCIA · raster aéreo + footprints",
            fill=(251, 244, 221), font=f_t)
    aerial_w = panel_w - 80
    aerial_h = panel_h - 140
    a = aerial.copy()
    a.thumbnail((aerial_w, aerial_h), Image.LANCZOS)
    ref.paste(a, ((panel_w - a.width) // 2, 80))
    rd.text((28, panel_h - 36),
            f"raster {aerial.size[0]}×{aerial.size[1]} px  ·  fuente: {source}",
            fill=(34, 29, 24), font=f_s)

    # ---- moldes catalog: pick 8 distinctive buildings, render each as a
    # standalone iso piece (footprint + colour) in a bottom strip.
    catalog_h = 360
    catalog = Image.new("RGBA", (panel_w * (1 + len(panels)), catalog_h),
                        (244, 234, 212, 255))
    cd = ImageDraw.Draw(catalog)
    try:
        f_t = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf", 26)
        f_s = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf", 16)
    except Exception:
        f_t = f_s = ImageFont.load_default()
    cd.text((28, 14), "MOLDES — piezas individuales extraídas de la sección",
            fill=(34, 29, 24), font=f_t)
    # pick 8 distinctive buildings: rank by footprint area*height
    def poly_area(poly):
        s = 0
        for k in range(len(poly) - 1):
            s += poly[k][0] * poly[k+1][1] - poly[k+1][0] * poly[k][1]
        return abs(s) / 2
    ranked = sorted(range(len(metres)),
                    key=lambda i: poly_area(metres[i]) * heights[i],
                    reverse=True)
    pick_n = min(8, len(ranked))
    picks = ranked[:pick_n]
    # layout: 8 cells across the catalog row
    cell_w = (panel_w * (1 + len(panels))) // pick_n
    cell_h = catalog_h - 70
    cy_top = 60
    for slot, idx in enumerate(picks):
        cx0 = slot * cell_w
        # cell background
        cd.rounded_rectangle((cx0 + 8, cy_top, cx0 + cell_w - 8, cy_top + cell_h),
                             radius=14, fill=(251, 244, 221, 255),
                             outline=(138, 90, 42), width=2)
        poly_m = metres[idx]
        h = heights[idx]
        roof_rgb = colours[idx]
        # local iso transform centred in this cell
        bx_min = min(x for x, _ in poly_m); bx_max = max(x for x, _ in poly_m)
        by_min = min(y for _, y in poly_m); by_max = max(y for _, y in poly_m)
        b_w = bx_max - bx_min
        b_h = by_max - by_min
        b_span_iso_w = (b_w + b_h) * COS30
        b_span_iso_h = (b_w + b_h) * SIN30 + h * 1.6
        avail_w = cell_w - 60
        avail_h = cell_h - 100
        s_xy = min(avail_w / b_span_iso_w, avail_h / b_span_iso_h)
        s_z  = s_xy * 1.6
        m_x = (bx_min + bx_max) / 2
        m_y = (by_min + by_max) / 2
        cell_cx = cx0 + cell_w // 2 - (m_x - m_y) * COS30 * s_xy
        cell_cy = cy_top + cell_h // 2 + 30 - (m_x + m_y) * SIN30 * s_xy
        # tiny ground tile
        gnd = [
            iso(bx_min - b_w*0.15, by_min - b_h*0.15, 0, s_xy, s_z, cell_cx, cell_cy),
            iso(bx_max + b_w*0.15, by_min - b_h*0.15, 0, s_xy, s_z, cell_cx, cell_cy),
            iso(bx_max + b_w*0.15, by_max + b_h*0.15, 0, s_xy, s_z, cell_cx, cell_cy),
            iso(bx_min - b_w*0.15, by_max + b_h*0.15, 0, s_xy, s_z, cell_cx, cell_cy),
        ]
        cd.polygon(gnd, fill=(232, 218, 188), outline=(138, 90, 42), width=1)
        # extruded prism
        bot = [iso(x, y, 0, s_xy, s_z, cell_cx, cell_cy) for x, y in poly_m]
        top = [iso(x, y, h, s_xy, s_z, cell_cx, cell_cy) for x, y in poly_m]
        n = len(poly_m)
        for k in range(n - 1):
            ax, ay = poly_m[k]
            bx, by = poly_m[k + 1]
            nx, ny = (by - ay), -(bx - ax)
            if nx + ny <= 0: continue
            tilt = nx / (abs(nx) + abs(ny) + 1e-6)
            k_shade = 0.55 + 0.18 * tilt
            cd.polygon([bot[k], bot[k+1], top[k+1], top[k]],
                       fill=shade(roof_rgb, k_shade), outline=(34, 29, 24))
        cd.polygon(top, fill=roof_rgb, outline=(34, 29, 24))
        # label: footprint vertices count + height + colour swatch
        cd.text((cx0 + 18, cy_top + cell_h - 64),
                f"#{idx+1}", fill=(34, 29, 24), font=f_t)
        cd.text((cx0 + 18, cy_top + cell_h - 34),
                f"h={h:.1f} m  ·  {len(poly_m)-1} vért.",
                fill=(34, 29, 24), font=f_s)
        # colour swatch
        sw_x = cx0 + cell_w - 60
        cd.rectangle((sw_x, cy_top + cell_h - 50, sw_x + 36, cy_top + cell_h - 14),
                     fill=roof_rgb, outline=(34, 29, 24))

    # ---- combine: REFERENCE | A | B  +  CATALOG underneath
    parts_row = [ref] + panels
    total_w = panel_w * len(parts_row)
    out_img = Image.new("RGBA", (total_w, panel_h + 70 + catalog_h),
                        (251, 244, 221, 255))
    # banner
    bd = ImageDraw.Draw(out_img)
    bd.rectangle((0, 0, total_w, 70), fill=(232, 218, 188, 255))
    try:
        f_b = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf", 36)
        f_b2 = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf", 20)
    except Exception:
        f_b = f_b2 = ImageFont.load_default()
    bd.text((28, 14),
            f"KOINOS · POLIS — moldes isométricos · sección {seccion}",
            fill=(34, 29, 24), font=f_b)
    bd.text((28, 50),
            "Mismas huellas, color tomado del raster aéreo · "
            "comparativa color-medio vs recorte texturizado",
            fill=(138, 90, 42), font=f_b2)
    for i, p in enumerate(parts_row):
        out_img.paste(p, (i * panel_w, 70))
    out_img.paste(catalog, (0, 70 + panel_h))
    out_path = OUT / f"{seccion}_iso_{source}.png"
    out_img.convert("RGB").save(out_path, "PNG", optimize=True)
    # also save the raw aerial for reference
    aerial.save(OUT / f"{seccion}_aerial_{source}.png", "PNG")
    return out_path

def _affine_warp_triangle(src: Image.Image,
                          s_tri, d_tri,
                          out_w: int, out_h: int) -> Image.Image:
    """Affine-warp ONE triangle of `src` into a target triangle in iso-canvas
    space. Returns an RGBA layer the size of the canvas with everything but the
    triangle transparent. PIL's Image.transform AFFINE maps OUTPUT->INPUT, so
    we solve: src = A · dst."""
    (sx0, sy0), (sx1, sy1), (sx2, sy2) = s_tri
    (dx0, dy0), (dx1, dy1), (dx2, dy2) = d_tri
    # build the 6 affine coefficients (a b c d e f) so that
    #   src_x = a*dst_x + b*dst_y + c
    #   src_y = d*dst_x + e*dst_y + f
    M = np.array([
        [dx0, dy0, 1, 0,   0,   0],
        [dx1, dy1, 1, 0,   0,   0],
        [dx2, dy2, 1, 0,   0,   0],
        [0,   0,   0, dx0, dy0, 1],
        [0,   0,   0, dx1, dy1, 1],
        [0,   0,   0, dx2, dy2, 1],
    ], dtype=np.float64)
    rhs = np.array([sx0, sx1, sx2, sy0, sy1, sy2], dtype=np.float64)
    try:
        a, b, c, d, e, f = np.linalg.solve(M, rhs)
    except np.linalg.LinAlgError:
        return Image.new("RGBA", (out_w, out_h), (0, 0, 0, 0))
    # render into an output the size of the canvas, clip with triangle mask
    warped = src.transform((out_w, out_h), Image.AFFINE, (a, b, c, d, e, f),
                           Image.BILINEAR)
    mask = Image.new("L", (out_w, out_h), 0)
    ImageDraw.Draw(mask).polygon(d_tri, fill=255)
    out = Image.new("RGBA", (out_w, out_h), (0, 0, 0, 0))
    out.paste(warped, (0, 0), mask)
    return out


# ------------------------------------------------------------------ CLI
if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("seccion", nargs="?", default="3501602010",
                    help="cusec id (10 dígitos), p.ej. 3501602010")
    ap.add_argument("--source", choices=("synth", "esri"), default="synth",
                    help="sintético (sandbox) o Esri World Imagery (LOCAL)")
    ap.add_argument("--variant", choices=("flat", "clip", "both"), default="both")
    args = ap.parse_args()
    out = render_section(args.seccion, args.source, args.variant)
    print("→", out)
