"""KOINOS / POLIS — isometric icon & logo system.

Each asset is built as an SVG so it works at every size, then rasterised to PNG.
The same shape reads as a 2.5-D map tile (perspective) AND as a flat corporate
logogram — exactly what an ad agency would deliver as a brand kit.

Run:
    python3 generate.py            # writes svg/ + png/ + the contact sheet
"""

from __future__ import annotations
import math, os, pathlib, textwrap
from typing import Iterable, List, Tuple

ROOT    = pathlib.Path(__file__).resolve().parent
SVG     = ROOT / "svg"
PNG     = ROOT / "png"
TILE    = PNG / "tile"
FAVICON = PNG / "favicon"
for d in (SVG, PNG, TILE, FAVICON): d.mkdir(parents=True, exist_ok=True)

# -------------------------------------------------------------------- palette
P = {
    "sand":        "#c8b898",  # base building tone (from POLIS state)
    "sand_lt":     "#f0e0c0",  # hover / highlight
    "cream":       "#f4ead4",  # paper / page
    "ocre":        "#b07840",  # earth pigment, mid-warm
    "ocre_dk":     "#8a5a2a",  # shadow side
    "terracotta":  "#c85438",  # plebeian red, accent
    "aegean":      "#5b9aa8",  # mediterranean water
    "blue_dk":     "#3a5878",  # classical / imperial deep
    "volcanic":    "#221d18",  # outline / canarian volcanic black
    "laurel":      "#7c8a4a",  # civic green
    "gold":        "#d8a44a",  # patrician light
    "paper_lt":    "#fbf4dd",
}

W, H = 1024, 1024                     # master canvas
CX, CY = W / 2, H / 2 + 60            # iso scenes sit a touch low
S = 120                               # iso unit (px per world unit)

# ------------------------------------------------------ isometric projection
COS30 = math.cos(math.radians(30))
SIN30 = 0.5

def iso(x: float, y: float, z: float = 0.0,
        cx: float = CX, cy: float = CY, s: float = S) -> Tuple[float, float]:
    return (cx + (x - y) * COS30 * s,
            cy + (x + y) * SIN30 * s - z * s)

def poly(points: Iterable[Tuple[float, float]], fill: str,
         stroke: str = "none", sw: float = 0.0, opacity: float = 1.0) -> str:
    pts = " ".join(f"{x:.2f},{y:.2f}" for x, y in points)
    return (f'<polygon points="{pts}" fill="{fill}" stroke="{stroke}" '
            f'stroke-width="{sw}" stroke-linejoin="round" opacity="{opacity}"/>')

def cube(x0: float, y0: float, z0: float, dx: float, dy: float, dz: float,
         top: str, left: str, right: str,
         outline: str = P["volcanic"], sw: float = 2.5) -> str:
    """Axis-aligned iso box with three visible faces.  Light from upper-right."""
    p = lambda x, y, z: iso(x, y, z)
    a = p(x0,      y0,      z0+dz); b = p(x0+dx, y0,      z0+dz)
    c = p(x0+dx,   y0+dy,   z0+dz); d = p(x0,    y0+dy,   z0+dz)
    e = p(x0,      y0+dy,   z0   ); f = p(x0+dx, y0+dy,   z0   )
    g = p(x0+dx,   y0,      z0   )
    out = []
    out.append(poly([d, e, f, c],  left,  outline, sw))   # left  (front-left)
    out.append(poly([c, f, g, b],  right, outline, sw))   # right (front-right)
    out.append(poly([a, b, c, d],  top,   outline, sw))   # top
    return "\n".join(out)

def ground(extent: float = 2.4, fill: str = P["cream"],
           stroke: str = P["volcanic"], sw: float = 3) -> str:
    """A subtle iso ground tile so logos read on a 'plinth'."""
    e = extent
    pts = [iso(-e, -e), iso(e, -e), iso(e, e), iso(-e, e)]
    return poly(pts, fill, stroke, sw)

# -------------------------------------------------------------------- header
def svg_open(title: str) -> str:
    return textwrap.dedent(f'''\
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}"
             role="img" aria-labelledby="t" font-family="'Archivo Black', Archivo, 'Helvetica Neue', sans-serif">
          <title id="t">{title}</title>
          <defs>
            <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%"  stop-color="{P["paper_lt"]}"/>
              <stop offset="100%" stop-color="{P["sand_lt"]}"/>
            </linearGradient>
            <radialGradient id="vignette" cx="50%" cy="55%" r="65%">
              <stop offset="60%" stop-color="{P["paper_lt"]}" stop-opacity="0"/>
              <stop offset="100%" stop-color="{P["ocre_dk"]}" stop-opacity="0.18"/>
            </radialGradient>
            <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6"/>
            </filter>
          </defs>
        ''')

def svg_close() -> str:
    return "</svg>"

def disc_bg() -> str:
    """Brand-board disc behind every iso piece."""
    return (f'<circle cx="{CX}" cy="{CY-40}" r="430" fill="url(#sky)" '
            f'stroke="{P["volcanic"]}" stroke-width="6"/>'
            f'<circle cx="{CX}" cy="{CY-40}" r="430" fill="url(#vignette)"/>')

def shadow(extent: float = 1.6) -> str:
    """Soft contact shadow under the piece."""
    e = extent
    pts = [iso(-e, -e), iso(e, -e), iso(e, e), iso(-e, e)]
    return poly(pts, P["ocre_dk"], opacity=0.22)

def wordmark(name: str, sub: str = "") -> str:
    # Archivo Black is single-weight (900); we drop font-weight="700" because
    # the family already carries the weight. Letter-spacing trimmed from 14
    # to 11 because Archivo Black sits wider than Georgia at the same size.
    return (f'<g text-anchor="middle">'
            f'<text x="{CX}" y="{H-110}" font-size="86" fill="{P["volcanic"]}" '
            f'letter-spacing="11" font-family="\'Archivo Black\', Archivo, sans-serif">{name}</text>'
            f'<text x="{CX}" y="{H-66}" font-size="22" fill="{P["ocre_dk"]}" '
            f'letter-spacing="8" font-family="Inter, system-ui, sans-serif" font-weight="500">{sub}</text></g>')

# ---------------------------------------------------------- per-piece bodies
def koinos() -> str:
    """Master mark — a foundation block with the 'common circle' on top."""
    parts = [disc_bg(), shadow(1.55)]
    # plinth
    parts.append(cube(-1.2, -1.2, 0,  2.4, 2.4, 0.55,
                      P["sand_lt"], P["sand"], P["ocre"]))
    # inscribed common circle on top — projected to top face (z = 0.55)
    cx, cy = iso(0, 0, 0.55)
    parts.append(f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="135" ry="78" '
                 f'fill="none" stroke="{P["volcanic"]}" stroke-width="6"/>')
    parts.append(f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="86"  ry="50" '
                 f'fill="{P["terracotta"]}" stroke="{P["volcanic"]}" stroke-width="4"/>')
    parts.append(f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="36"  ry="21" '
                 f'fill="{P["gold"]}" stroke="{P["volcanic"]}" stroke-width="3"/>')
    parts.append(wordmark("KOINOS", "TÀ KOINÁ — THE COMMONS"))
    return "".join(parts)

def polis() -> str:
    """City — a cluster of small buildings on a tile."""
    parts = [disc_bg(), shadow(1.7)]
    # plinth (the territory)
    parts.append(cube(-1.4, -1.4, 0,  2.8, 2.8, 0.18,
                      P["cream"], P["sand"], P["ocre"]))
    # streets — two strokes on the top face
    a = iso(-1.4,  0.05, 0.18); b = iso( 1.4,  0.05, 0.18)
    c = iso( 0.05,-1.4, 0.18); d = iso( 0.05, 1.4, 0.18)
    parts.append(f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" '
                 f'stroke="{P["ocre_dk"]}" stroke-width="6" opacity="0.55"/>')
    parts.append(f'<line x1="{c[0]:.1f}" y1="{c[1]:.1f}" x2="{d[0]:.1f}" y2="{d[1]:.1f}" '
                 f'stroke="{P["ocre_dk"]}" stroke-width="6" opacity="0.55"/>')
    # buildings — varying heights
    blocks = [
        # x, y, w, d, h, roof
        (-1.15, -1.15, 0.95, 0.95, 1.30, P["terracotta"]),
        ( 0.20, -1.15, 1.00, 0.95, 0.85, P["sand_lt"]),
        (-1.15,  0.20, 1.00, 1.00, 0.65, P["sand_lt"]),
        ( 0.25,  0.25, 0.92, 0.92, 1.05, P["aegean"]),
    ]
    for x, y, w, d, h, roof in blocks:
        parts.append(cube(x, y, 0.18, w, d, h,
                          roof, P["sand"], P["ocre"]))
        # window strip on right face
        rx0, ry0 = iso(x+w, y+0.18, 0.18 + h*0.55)
        rx1, ry1 = iso(x+w, y+d-0.18, 0.18 + h*0.55)
        parts.append(f'<line x1="{rx0:.1f}" y1="{ry0:.1f}" x2="{rx1:.1f}" y2="{ry1:.1f}" '
                     f'stroke="{P["volcanic"]}" stroke-width="3" opacity="0.55"/>')
    parts.append(wordmark("POLIS", "EL VISOR DEL TERRITORIO"))
    return "".join(parts)

def agora() -> str:
    """Stoa — colonnade on a stepped plinth, viewed front-right."""
    parts = [disc_bg(), shadow(1.55)]
    # two-step stylobate
    parts.append(cube(-1.5, -1.0, 0,    3.0, 2.0, 0.22, P["cream"], P["sand"], P["ocre"]))
    parts.append(cube(-1.35,-0.85,0.22, 2.7, 1.7, 0.18, P["sand_lt"], P["sand"], P["ocre"]))
    # back wall of the stoa (the cella) — solid mass behind the columns
    parts.append(cube(-1.20, 0.45, 0.40, 2.40, 0.30, 1.20,
                      P["sand_lt"], P["sand"], P["ocre"]))
    # FIVE columns along the FRONT edge so they read clearly against the wall
    n_cols = 5
    z0 = 0.40
    for i in range(n_cols):
        t = i/(n_cols-1)
        x = -1.05 + t*2.10
        y = -0.55
        # base
        parts.append(cube(x-0.16, y-0.16, z0, 0.32, 0.32, 0.08,
                          P["cream"], P["sand_lt"], P["ocre"]))
        # column shaft (thicker, more presence)
        parts.append(cube(x-0.13, y-0.13, z0+0.08, 0.26, 0.26, 1.05,
                          P["sand_lt"], P["sand"], P["ocre"]))
        # capital
        parts.append(cube(x-0.18, y-0.18, z0+1.13, 0.36, 0.36, 0.10,
                          P["cream"], P["sand_lt"], P["ocre"]))
    # entablature (architrave) — terracotta band
    parts.append(cube(-1.25, -0.75, z0+1.23, 2.50, 0.40, 0.18,
                      P["terracotta"], P["ocre"], P["ocre_dk"]))
    # pediment triangle (front-right face only)
    p1 = iso(-1.25, -0.75, z0+1.41)
    p2 = iso( 1.25, -0.75, z0+1.41)
    p3 = iso( 0.0,  -0.75, z0+1.96)
    parts.append(poly([p1,p2,p3], P["sand_lt"], P["volcanic"], 3))
    # tiny acroterion (decorative tip)
    tx, ty = iso(0, -0.75, z0+1.96)
    parts.append(f'<circle cx="{tx}" cy="{ty-6}" r="9" fill="{P["gold"]}" '
                 f'stroke="{P["volcanic"]}" stroke-width="2.5"/>')
    parts.append(wordmark("ÁGORA", "DISCUSIÓN CÍVICA"))
    return "".join(parts)

def bibliotheka() -> str:
    """Library temple — colonnade, pediment, and scroll, with cella behind."""
    parts = [disc_bg(), shadow(1.55)]
    # plinth (two-step)
    parts.append(cube(-1.4, -1.0, 0,    2.8, 2.0, 0.22, P["cream"], P["sand"], P["ocre"]))
    parts.append(cube(-1.25,-0.85, 0.22, 2.5, 1.7, 0.18, P["sand_lt"], P["sand"], P["ocre"]))
    # cella (back wall) — gives the columns something to stand against
    parts.append(cube(-1.10, 0.40, 0.40, 2.20, 0.32, 1.30,
                      P["cream"], P["sand_lt"], P["ocre"]))
    z0 = 0.40
    # 4 columns across front edge
    for t in [0.0, 0.33, 0.67, 1.0]:
        x = -0.92 + t*1.84
        # base
        parts.append(cube(x-0.16, -0.66, z0, 0.32, 0.32, 0.08,
                          P["cream"], P["sand_lt"], P["ocre"]))
        # shaft
        parts.append(cube(x-0.13, -0.63, z0+0.08, 0.26, 0.26, 1.18,
                          P["sand_lt"], P["sand"], P["ocre"]))
        # capital
        parts.append(cube(x-0.18, -0.68, z0+1.26, 0.36, 0.36, 0.10,
                          P["cream"], P["sand_lt"], P["ocre"]))
    # entablature
    parts.append(cube(-1.10, -0.66, z0+1.36, 2.20, 0.36, 0.18,
                      P["sand_lt"], P["ocre"], P["ocre_dk"]))
    # pediment
    p1 = iso(-1.10, -0.66, z0+1.54)
    p2 = iso( 1.10, -0.66, z0+1.54)
    p3 = iso( 0.0,  -0.66, z0+2.10)
    parts.append(poly([p1,p2,p3], P["terracotta"], P["volcanic"], 3))
    # large scroll on the pediment (tilted in the iso plane)
    sx, sy = iso(0, -0.66, z0+1.78)
    parts.append(f'<g transform="translate({sx-72:.1f} {sy-16:.1f})">'
                 f'<rect x="14" y="0" width="118" height="32" rx="4" '
                 f'fill="{P["cream"]}" stroke="{P["volcanic"]}" stroke-width="3"/>'
                 f'<line x1="34" y1="10" x2="118" y2="10" '
                 f'stroke="{P["volcanic"]}" stroke-width="2" opacity="0.55"/>'
                 f'<line x1="34" y1="18" x2="98"  y2="18" '
                 f'stroke="{P["volcanic"]}" stroke-width="2" opacity="0.55"/>'
                 f'<line x1="34" y1="24" x2="108" y2="24" '
                 f'stroke="{P["volcanic"]}" stroke-width="2" opacity="0.55"/>'
                 f'<circle cx="14"  cy="16" r="16" fill="{P["sand_lt"]}" '
                 f'stroke="{P["volcanic"]}" stroke-width="3"/>'
                 f'<circle cx="132" cy="16" r="16" fill="{P["sand_lt"]}" '
                 f'stroke="{P["volcanic"]}" stroke-width="3"/></g>')
    parts.append(wordmark("BIBLIOTHEKA", "CURSUS HONORUM · KOINÁ"))
    return "".join(parts)

def pharos() -> str:
    """Lighthouse — three tiers with a flame at the top."""
    parts = [disc_bg(), shadow(1.4)]
    # base plinth (rocky outcrop)
    parts.append(cube(-1.2, -1.2, 0,   2.4, 2.4, 0.30, P["cream"], P["sand"], P["ocre"]))
    # square base of the tower
    parts.append(cube(-0.85, -0.85, 0.30, 1.70, 1.70, 1.10,
                      P["sand_lt"], P["sand"], P["ocre"]))
    # cornice
    parts.append(cube(-0.95, -0.95, 1.40, 1.90, 1.90, 0.10,
                      P["cream"], P["ocre"], P["ocre_dk"]))
    # octagonal middle (approximated as smaller square rotated visually — keep a square)
    parts.append(cube(-0.55, -0.55, 1.50, 1.10, 1.10, 0.95,
                      P["sand_lt"], P["sand"], P["ocre"]))
    parts.append(cube(-0.62, -0.62, 2.45, 1.24, 1.24, 0.08,
                      P["cream"], P["ocre"], P["ocre_dk"]))
    # cylindrical top (square again, slimmer)
    parts.append(cube(-0.30, -0.30, 2.53, 0.60, 0.60, 0.70,
                      P["terracotta"], P["ocre"], P["ocre_dk"]))
    # lantern dome
    cx, cy = iso(0, 0, 3.23)
    parts.append(f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="42" ry="22" '
                 f'fill="{P["gold"]}" stroke="{P["volcanic"]}" stroke-width="3"/>')
    # flame
    fx, fy = iso(0, 0, 3.45)
    parts.append(f'<path d="M {fx:.1f} {fy-90:.1f} '
                 f'C {fx-30:.1f} {fy-50:.1f}, {fx-22:.1f} {fy-10:.1f}, {fx:.1f} {fy:.1f} '
                 f'C {fx+22:.1f} {fy-10:.1f}, {fx+30:.1f} {fy-50:.1f}, {fx:.1f} {fy-90:.1f} Z" '
                 f'fill="{P["terracotta"]}" stroke="{P["volcanic"]}" stroke-width="3"/>')
    parts.append(f'<path d="M {fx:.1f} {fy-60:.1f} '
                 f'C {fx-14:.1f} {fy-36:.1f}, {fx-10:.1f} {fy-12:.1f}, {fx:.1f} {fy-4:.1f} '
                 f'C {fx+10:.1f} {fy-12:.1f}, {fx+14:.1f} {fy-36:.1f}, {fx:.1f} {fy-60:.1f} Z" '
                 f'fill="{P["gold"]}"/>')
    # light beams (subtle)
    parts.append(f'<g stroke="{P["gold"]}" stroke-width="4" opacity="0.55" stroke-linecap="round">'
                 f'<line x1="{fx-150}" y1="{fy-110}" x2="{fx-60}"  y2="{fy-50}"/>'
                 f'<line x1="{fx+150}" y1="{fy-110}" x2="{fx+60}"  y2="{fy-50}"/>'
                 f'</g>')
    parts.append(wordmark("PHAROS", "EJES DE CAPITAL CÍVICO"))
    return "".join(parts)

def ocre() -> str:
    """OCRE — earth strata block with a sprout (recovery of space)."""
    parts = [disc_bg(), shadow(1.55)]
    # ground tile
    parts.append(cube(-1.4, -1.4, 0,   2.8, 2.8, 0.16, P["cream"], P["sand"], P["ocre"]))
    # strata (5 thin layers, increasingly ocre)
    layers = [
        (P["sand_lt"],   0.16, 0.20),
        (P["sand"],      0.36, 0.20),
        (P["ocre"],      0.56, 0.22),
        (P["ocre_dk"],   0.78, 0.20),
        (P["terracotta"],0.98, 0.18),
    ]
    for top, z0, dz in layers:
        parts.append(cube(-1.0, -1.0, z0,  2.0, 2.0, dz,
                          top, P["sand"], P["ocre_dk"]))
    # archeological cut — a notch on the front-right corner
    # (we draw a darker quadrilateral over the strata edge to suggest excavation)
    nx, ny = iso(1.0, -1.0, 0.36)
    parts.append(f'<circle cx="{nx-30}" cy="{ny+90}" r="18" fill="{P["volcanic"]}" '
                 f'opacity="0.35"/>')
    # sprout on top
    sx, sy = iso(0, 0, 1.16)
    parts.append(f'<path d="M {sx} {sy} C {sx-2} {sy-80}, {sx-26} {sy-110}, {sx-44} {sy-118}" '
                 f'stroke="{P["laurel"]}" stroke-width="6" fill="none" stroke-linecap="round"/>')
    parts.append(f'<ellipse cx="{sx-44}" cy="{sy-118}" rx="22" ry="11" '
                 f'fill="{P["laurel"]}" stroke="{P["volcanic"]}" stroke-width="2.5" '
                 f'transform="rotate(-30 {sx-44} {sy-118})"/>')
    parts.append(f'<path d="M {sx} {sy-30} C {sx+4} {sy-90}, {sx+26} {sy-100}, {sx+40} {sy-92}" '
                 f'stroke="{P["laurel"]}" stroke-width="6" fill="none" stroke-linecap="round"/>')
    parts.append(f'<ellipse cx="{sx+40}" cy="{sy-92}" rx="20" ry="10" '
                 f'fill="{P["laurel"]}" stroke="{P["volcanic"]}" stroke-width="2.5" '
                 f'transform="rotate(30 {sx+40} {sy-92})"/>')
    parts.append(wordmark("OCRE", "RECUPERACIÓN DE ESPACIOS"))
    return "".join(parts)

def cursus() -> str:
    """Cursus honorum — stepped pyramid topped with a laurel wreath."""
    parts = [disc_bg(), shadow(1.55)]
    # ground
    parts.append(cube(-1.4, -1.4, 0,  2.8, 2.8, 0.14, P["cream"], P["sand"], P["ocre"]))
    # 5 steps (the offices of the cursus)
    steps = [
        (1.20, 0.14, 0.30, P["sand_lt"]),
        (0.95, 0.44, 0.30, P["sand"]),
        (0.72, 0.74, 0.30, P["ocre"]),
        (0.48, 1.04, 0.30, P["ocre_dk"]),
        (0.28, 1.34, 0.26, P["terracotta"]),
    ]
    for half, z0, dz, top in steps:
        parts.append(cube(-half, -half, z0, 2*half, 2*half, dz,
                          top, P["sand"], P["ocre_dk"]))
    # laurel wreath on top — two arcs of leaves
    cx, cy = iso(0, 0, 1.66)
    cy -= 6  # nudge
    R = 70
    parts.append(f'<circle cx="{cx}" cy="{cy}" r="{R}" fill="none" '
                 f'stroke="{P["laurel"]}" stroke-width="8" '
                 f'stroke-dasharray="0.1 28" stroke-linecap="round"/>')
    # gold medal in the centre
    parts.append(f'<circle cx="{cx}" cy="{cy}" r="36" fill="{P["gold"]}" '
                 f'stroke="{P["volcanic"]}" stroke-width="4"/>')
    parts.append(f'<text x="{cx}" y="{cy+12}" text-anchor="middle" font-size="38" '
                 f'fill="{P["volcanic"]}" font-weight="700">V</text>')
    parts.append(wordmark("CURSUS", "HONORUM · CIUDADANÍA"))
    return "".join(parts)

def koina() -> str:
    """Koiná — three amphorae on a tile (water, oil, grain : the commons)."""
    parts = [disc_bg(), shadow(1.55)]
    parts.append(cube(-1.4, -1.4, 0,  2.8, 2.8, 0.18, P["cream"], P["sand"], P["ocre"]))
    parts.append(cube(-1.25, -1.25, 0.18,  2.5, 2.5, 0.10, P["sand_lt"], P["sand"], P["ocre"]))

    # Simple, readable amphora drawn from a base anchor on the tile.
    def amphora(wx: float, wy: float, body: str, scale: float = 1.0,
                contents: str | None = None):
        cx, cy = iso(wx, wy, 0.28)
        s = scale
        # geometry
        belly_cx, belly_cy = cx, cy - 110 * s
        belly_rx, belly_ry = 90 * s, 100 * s
        neck_w   = 44  * s
        neck_h   = 38  * s
        neck_top = belly_cy - belly_ry - neck_h
        # foot stem
        parts.append(f'<rect x="{cx-22*s}" y="{cy-32*s}" width="{44*s}" height="{32*s}" '
                     f'fill="{P["ocre"]}" stroke="{P["volcanic"]}" stroke-width="3" '
                     f'stroke-linejoin="round"/>')
        parts.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{50*s}" ry="{12*s}" '
                     f'fill="{P["ocre_dk"]}" stroke="{P["volcanic"]}" stroke-width="3"/>')
        # body (round belly)
        parts.append(f'<ellipse cx="{belly_cx}" cy="{belly_cy}" '
                     f'rx="{belly_rx}" ry="{belly_ry}" '
                     f'fill="{body}" stroke="{P["volcanic"]}" stroke-width="4"/>')
        # neck
        parts.append(f'<rect x="{cx-neck_w/2}" y="{neck_top}" '
                     f'width="{neck_w}" height="{neck_h+6}" '
                     f'fill="{body}" stroke="{P["volcanic"]}" stroke-width="4" '
                     f'stroke-linejoin="round"/>')
        # lip
        parts.append(f'<ellipse cx="{cx}" cy="{neck_top}" '
                     f'rx="{neck_w/2 + 8*s}" ry="{8*s}" '
                     f'fill="{P["ocre_dk"]}" stroke="{P["volcanic"]}" stroke-width="3"/>')
        parts.append(f'<rect x="{cx-neck_w/2 - 8*s}" y="{neck_top - 6*s}" '
                     f'width="{neck_w + 16*s}" height="{12*s}" rx="3" '
                     f'fill="{P["ocre_dk"]}" stroke="{P["volcanic"]}" stroke-width="3"/>')
        # handles — two open arcs, drawn behind body where they wrap
        for sign in (-1, 1):
            x_neck_side = cx + sign * neck_w/2
            x_belly_top = belly_cx + sign * (belly_rx - 8*s)
            y_belly_top = belly_cy - belly_ry * 0.55
            x_outer     = belly_cx + sign * (belly_rx + 18*s)
            parts.append(
                f'<path d="M {x_neck_side} {neck_top + 8*s} '
                f'C {x_outer} {neck_top + 12*s}, '
                f'  {x_outer} {y_belly_top + 20*s}, '
                f'  {x_belly_top} {y_belly_top}" '
                f'fill="none" stroke="{P["volcanic"]}" stroke-width="6" '
                f'stroke-linecap="round"/>')
        # decorative band on the upper body
        parts.append(f'<ellipse cx="{belly_cx}" cy="{belly_cy - belly_ry*0.45}" '
                     f'rx="{belly_rx*0.92}" ry="{belly_ry*0.30}" '
                     f'fill="none" stroke="{P["volcanic"]}" stroke-width="3"/>')
        parts.append(f'<ellipse cx="{belly_cx}" cy="{belly_cy - belly_ry*0.30}" '
                     f'rx="{belly_rx*0.97}" ry="{belly_ry*0.25}" '
                     f'fill="none" stroke="{P["volcanic"]}" stroke-width="2" '
                     f'opacity="0.6" stroke-dasharray="6 6"/>')
        # belly highlight
        parts.append(f'<path d="M {belly_cx - belly_rx*0.55} {belly_cy + belly_ry*0.25} '
                     f'C {belly_cx - belly_rx*0.75} {belly_cy - belly_ry*0.05}, '
                     f'  {belly_cx - belly_rx*0.65} {belly_cy - belly_ry*0.55}, '
                     f'  {belly_cx - belly_rx*0.20} {belly_cy - belly_ry*0.80}" '
                     f'fill="none" stroke="{P["paper_lt"]}" stroke-width="8" '
                     f'opacity="0.45" stroke-linecap="round"/>')
        # contents emblem on the belly
        ex, ey = belly_cx, belly_cy - belly_ry * 0.05
        if contents == "water":
            parts.append(f'<path d="M {ex} {ey-26} '
                         f'C {ex-24} {ey-2}, {ex-20} {ey+24}, {ex} {ey+24} '
                         f'C {ex+20} {ey+24}, {ex+24} {ey-2}, {ex} {ey-26} Z" '
                         f'fill="{P["paper_lt"]}" stroke="{P["volcanic"]}" '
                         f'stroke-width="3"/>')
        elif contents == "oil":
            parts.append(f'<g transform="translate({ex} {ey})">'
                         f'<path d="M 0 -28 L 24 14 L -24 14 Z" '
                         f'fill="{P["laurel"]}" stroke="{P["volcanic"]}" '
                         f'stroke-width="3" stroke-linejoin="round"/>'
                         f'<rect x="-5" y="14" width="10" height="10" '
                         f'fill="{P["ocre_dk"]}" stroke="{P["volcanic"]}" stroke-width="2.5"/>'
                         f'</g>')
        elif contents == "grain":
            parts.append(f'<g transform="translate({ex} {ey})" '
                         f'stroke="{P["volcanic"]}" stroke-width="3" stroke-linecap="round" '
                         f'fill="none">'
                         f'<line x1="0" y1="-28" x2="0" y2="26"/>'
                         f'<path d="M 0 -22 L -12 -14 M 0 -12 L -12 -4 '
                         f'M 0 -2 L -12 6 M 0 8 L -12 16"/>'
                         f'<path d="M 0 -22 L 12 -14 M 0 -12 L 12 -4 '
                         f'M 0 -2 L 12 6 M 0 8 L 12 16"/>'
                         f'</g>')

    # paint back-to-front so the front amphora occludes the back ones cleanly.
    amphora( 0.0, -0.45, P["aegean"],     0.95, "water")  # back  (centre-back)
    amphora(-0.55, 0.20, P["terracotta"], 1.05, "oil")    # left
    amphora( 0.55, 0.20, P["sand_lt"],    1.00, "grain")  # right
    parts.append(wordmark("KOINÁ", "RECURSOS DEL COMÚN"))
    return "".join(parts)

# ---------------------------------------------------- registry & flat tiles
PIECES = [
    ("koinos",      "KOINOS",       koinos),
    ("polis",       "POLIS",        polis),
    ("agora",       "ÁGORA",        agora),
    ("bibliotheka", "BIBLIOTHEKA",  bibliotheka),
    ("pharos",      "PHAROS",       pharos),
    ("ocre",        "OCRE",         ocre),
    ("cursus",      "CURSUS HONORUM", cursus),
    ("koina",       "KOINÁ",        koina),
]

# A "tile" variant strips the disc background and the wordmark so the artwork
# can be dropped directly onto an isometric map.
def tile_svg(body_fn) -> str:
    body = body_fn()
    # remove the disc background (first two svg fragments) and the wordmark
    body = body.replace(disc_bg(), "")
    # drop wordmark by cutting the trailing <g text-anchor="middle">…</g>
    cut = body.rfind('<g text-anchor="middle">')
    if cut != -1: body = body[:cut]
    return body

# ────────────────────────────────────────────── variant transformations
# Each returns a transformed SVG body string. They operate on the raw output
# of the piece functions (or any sub-piece) and are composable.

import re

_HEX_RE = re.compile(r'(fill|stroke)="(#[0-9a-fA-F]{6})"')
_URL_FILL_RE = re.compile(r'fill="url\([^)]*\)"')

def _to_mono(body: str) -> str:
    """Single-tinta volcánica. Eliminamos rellenos, conservamos el outline."""
    def sub(m):
        attr, color = m.group(1), m.group(2).lower()
        if attr == "stroke":
            return f'{attr}="{P["volcanic"]}"'
        # fills: paper-class become none, ink stays as fill (text)
        if color in ("#221d18",):
            return f'{attr}="{P["volcanic"]}"'
        return f'{attr}="none"'
    out = _HEX_RE.sub(sub, body)
    out = _URL_FILL_RE.sub('fill="none"', out)
    return out

def _to_inverse(body: str) -> str:
    """Negativo · sobre fondo volcánico. Conserva acentos terracota y oro."""
    swaps = [
        ("#fbf4dd", "__PAPER__"),
        ("#f4ead4", "__CREAM__"),
        ("#f0e0c0", "__SAND_LT__"),
        ("#221d18", "__INK__"),
    ]
    out = body
    for src, tag in swaps: out = out.replace(src, tag)
    out = out.replace("__PAPER__", P["volcanic"])
    out = out.replace("__CREAM__", P["volcanic"])
    out = out.replace("__SAND_LT__", "#3a302a")  # papel translúcido sobre obsidiana
    out = out.replace("__INK__", P["paper_lt"])
    # Gradients (sky / vignette) → solid volcanic (no flashy gradients en inverse)
    out = _URL_FILL_RE.sub(f'fill="{P["volcanic"]}"', out)
    return out

def _to_tint(body: str, ink: str = None) -> str:
    """Single-color · outline en una sola tinta. Default: papel sobre fondo de color."""
    ink = ink or P["paper_lt"]
    def sub(m):
        return f'{m.group(1)}="{ink}"' if m.group(1) == "stroke" else f'{m.group(1)}="none"'
    out = _HEX_RE.sub(sub, body)
    out = _URL_FILL_RE.sub('fill="none"', out)
    return out

# ────────────────────────────────────────────── monogram + horizontal lockup
def monogram(letter: str) -> str:
    """Cubo volcánico con la letra Archivo Black sobre la cara superior.
       Usado para favicons y aplicaciones < 24 px."""
    parts = [shadow(1.0)]
    # Plinth volcánico maciza
    parts.append(cube(-1.0, -1.0, 0, 2.0, 2.0, 1.4,
                      P["volcanic"], P["volcanic"], P["volcanic"]))
    # Letra centrada sobre la cara superior, en papel
    cx, cy = iso(0, 0, 1.4)
    parts.append(
        f'<text x="{cx:.0f}" y="{cy + 70:.0f}" text-anchor="middle" '
        f'font-family="\'Archivo Black\', Archivo, sans-serif" '
        f'font-size="280" fill="{P["paper_lt"]}">{letter}</text>'
    )
    return "".join(parts)

def horizontal_lockup(piece_fn, name: str, sub: str) -> str:
    """Lockup horizontal · isótipo a la izquierda, wordmark + tagline a la derecha.
       Caja 1024×1024 dividida 50/50."""
    # Render del isótipo en el cuadrante izquierdo (escalado al 80%)
    iso_body = tile_svg(piece_fn)
    parts = []
    parts.append(f'<g transform="translate(-256 80) scale(0.7)">{iso_body}</g>')
    # Wordmark + tagline alineados a la izquierda en el cuadrante derecho
    parts.append(
        f'<g text-anchor="start">'
        f'<text x="540" y="510" font-size="86" fill="{P["volcanic"]}" '
        f'letter-spacing="11" font-family="\'Archivo Black\', Archivo, sans-serif">{name}</text>'
        f'<text x="540" y="558" font-size="22" fill="{P["ocre_dk"]}" '
        f'letter-spacing="8" font-family="Inter, system-ui, sans-serif" font-weight="500">{sub}</text>'
        f'</g>'
    )
    return "".join(parts)

# -------------------------------------------------------------------- writer
def write_svg(name: str, body: str, transparent: bool = False) -> pathlib.Path:
    bg = "" if transparent else (
        f'<rect width="{W}" height="{H}" fill="{P["paper_lt"]}"/>')
    out = svg_open(name) + bg + body + svg_close()
    path = SVG / f"{name}.svg"
    path.write_text(out, encoding="utf-8")
    return path

def write_tile_svg(name: str, body: str) -> pathlib.Path:
    # Tile variants are transparent and use a tighter viewBox.
    out = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}">'
           + body + "</svg>")
    path = SVG / f"{name}.tile.svg"
    path.write_text(out, encoding="utf-8")
    return path

def write_variant_svg(name: str, suffix: str, body: str,
                       bg_fill: str | None = None) -> pathlib.Path:
    """Write a variant SVG with optional solid background fill."""
    bg = f'<rect width="{W}" height="{H}" fill="{bg_fill}"/>' if bg_fill else ""
    out = svg_open(name) + bg + body + svg_close()
    path = SVG / f"{name}.{suffix}.svg"
    path.write_text(out, encoding="utf-8")
    return path

# Mapeo de marca → letra para el monograma. Ver MANUAL_LOGO.md §2.D.
MONOGRAM_LETTERS = {
    "koinos": "K", "ocre": "O", "polis": "P", "agora": "A",
    "bibliotheka": "B", "pharos": "Φ", "cursus": "C", "koina": "κ",
}

if __name__ == "__main__":
    import cairosvg
    written = []
    for slug, label, fn in PIECES:
        master_body = fn()
        # ── A · color master (vertical lockup) ──
        sp = write_svg(slug, master_body, transparent=False)
        cairosvg.svg2png(url=str(sp), write_to=str(PNG / f"{slug}.png"),
                         output_width=1024, output_height=1024)
        # ── tile (isotipo solo, transparente) ──
        tp = write_tile_svg(slug, tile_svg(fn))
        cairosvg.svg2png(url=str(tp), write_to=str(TILE / f"{slug}.tile.png"),
                         output_width=1024, output_height=1024)
        # ── B · monocromática ──
        mono_body = _to_mono(master_body)
        mp = write_variant_svg(slug, "mono", mono_body, bg_fill=P["paper_lt"])
        cairosvg.svg2png(url=str(mp), write_to=str(PNG / f"{slug}.mono.png"),
                         output_width=1024, output_height=1024)
        # ── C · inverse (negativo) ──
        inv_body = _to_inverse(master_body)
        ip = write_variant_svg(slug, "inverse", inv_body, bg_fill=P["volcanic"])
        cairosvg.svg2png(url=str(ip), write_to=str(PNG / f"{slug}.inverse.png"),
                         output_width=1024, output_height=1024)
        # ── D · single-color tint (papel sobre fondo ocre por defecto) ──
        tint_body = _to_tint(master_body, ink=P["paper_lt"])
        tp2 = write_variant_svg(slug, "tint", tint_body, bg_fill=P["ocre"])
        cairosvg.svg2png(url=str(tp2), write_to=str(PNG / f"{slug}.tint.png"),
                         output_width=1024, output_height=1024)
        # ── horizontal lockup ──
        sub_label = label  # we don't have the tagline here; use label as fallback
        # (taglines viven dentro de cada piece function; para horizontal usamos label)
        h_body = horizontal_lockup(fn, label, sub_label)
        hp = write_variant_svg(slug, "horizontal", h_body, bg_fill=P["paper_lt"])
        cairosvg.svg2png(url=str(hp), write_to=str(PNG / f"{slug}.horizontal.png"),
                         output_width=1024, output_height=1024)
        # ── monograma + favicons ──
        letter = MONOGRAM_LETTERS.get(slug, slug[0].upper())
        m_body = monogram(letter)
        mg = write_variant_svg(slug, "monogram", m_body, bg_fill=None)
        cairosvg.svg2png(url=str(mg), write_to=str(PNG / f"{slug}.monogram.png"),
                         output_width=1024, output_height=1024)
        for size in (16, 32, 64):
            cairosvg.svg2png(url=str(mg),
                             write_to=str(FAVICON / f"{slug}-{size}.png"),
                             output_width=size, output_height=size)
        written.append(slug)
        print("ok", slug, "· 7 SVG + 9 PNG (color, tile, mono, inverse, tint, horizontal, monogram, favicons 16/32/64)")
    print("done:", written)
