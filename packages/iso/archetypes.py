"""KOINOS · POLIS — Catálogo de arquetipos isométricos estilo Into the Breach.

Cada arquetipo es una pieza iso paramétrica vectorial (PIL.ImageDraw) con
dimensiones canónicas en METROS (eje X-Z planta, eje Y altura). Se proyecta
con la función iso(x, y, z, sxy, sz, cx, cy) compartida con iso_zoom.py.

REFACTOR (mayo 2026): los parámetros declarativos de cada arquetipo
(colores, dimensiones canónicas, reglas de matching) viven ahora en
``public/catalog/archetypes.json``. Este módulo carga ese JSON al
importarse y rellena ``COLORS`` y ``ARCHETYPE_DIMS`` desde ahí. Las
funciones de drawing siguen siendo Python; los datos son una sola fuente
de verdad consumible también por JS y GDScript.

Filosofía visual:
  · Paleta limitada (4-6 colores por pieza). Sin gradientes, colores planos.
  · Borde ink #221D18 grueso (3-4 px) para que la silueta pegue contra
    cualquier fondo.
  · Ventanas estilizadas: rectángulos pequeños ink semi-transparentes
    organizados en rejilla regular (cuento de plantas y huecos).
  · Una sombra DURA al sureste sin blur (un polígono offset 1.3 m al
    SE proyectado al suelo).
  · Detalle de personalidad propio (antena, AC, marquesina, chimenea,
    cúpula, etc.) que ayude a leer el arquetipo a primera vista.

Cada función de arquetipo tiene la firma:
    draw_<arquetipo>(img, IS, ink, *, cx_m, cz_m, scale_xy, scale_z=1.0,
                     rot_rad=0.0, paper_alpha=255)
"""
from __future__ import annotations

import json
import math
import pathlib
from typing import Callable, Dict, List, Tuple

from PIL import Image, ImageDraw

# ---------------------------------------------------------------------------
# Carga de catálogo declarativo desde public/catalog/archetypes.json
# ---------------------------------------------------------------------------

ROOT = pathlib.Path(__file__).resolve().parents[2]
CATALOG_PATH = ROOT / "public" / "catalog" / "archetypes.json"


def _hex_to_rgb(h: str) -> Tuple[int, int, int]:
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def _load_catalog() -> Dict:
    with open(CATALOG_PATH, encoding="utf-8") as f:
        return json.load(f)


_CATALOG = _load_catalog()

INK: Tuple[int, int, int] = _hex_to_rgb(
    _CATALOG.get("iso_projection", {}).get("ink_color", "#221D18"))

# colores por arquetipo: dict nombre -> dict slot -> RGB tuple
COLORS: Dict[str, Dict[str, Tuple[int, int, int]]] = {}
for _name, _spec in _CATALOG["archetypes"].items():
    COLORS[_name] = {k: _hex_to_rgb(v) for k, v in _spec["colors"].items()}

# Dimensiones canónicas (W en X, D en Z, H total) en metros.
ARCHETYPE_DIMS: Dict[str, Tuple[float, float, float]] = {
    name: tuple(spec["canonical_size_m"])
    for name, spec in _CATALOG["archetypes"].items()
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _rotate(p: Tuple[float, float], rot: float) -> Tuple[float, float]:
    """Rota (x, z) (planta) alrededor del origen local."""
    if rot == 0.0:
        return p
    c, s = math.cos(rot), math.sin(rot)
    x, z = p
    return (x * c - z * s, x * s + z * c)


def _world(p_local, cx_m, cz_m, scale_xy, rot):
    x, z = _rotate(p_local, rot)
    return (cx_m + x * scale_xy, cz_m + z * scale_xy)


def _hard_shadow(img, IS, footprint_local, cx_m, cz_m, scale_xy, rot,
                 dxdz_m=(1.3, 1.3), alpha=110):
    """Sombra dura sureste: poligono base offset al SE en mundo."""
    pts = []
    for p in footprint_local:
        wx, wz = _world(p, cx_m, cz_m, scale_xy, rot)
        pts.append(IS(wx + dxdz_m[0], 0, wz + dxdz_m[1]))
    if len(pts) >= 3:
        layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        d.polygon(pts, fill=INK + (alpha,))
        img.alpha_composite(layer)


def _face_visible(p0_local, p1_local, rot):
    a = _rotate(p0_local, rot)
    b = _rotate(p1_local, rot)
    nx = b[1] - a[1]
    nz = -(b[0] - a[0])
    return (nx + nz) > 0


def _draw_polygon(img, pts, fill=None, outline=None, width=3):
    if len(pts) < 3:
        return
    d = ImageDraw.Draw(img)
    if fill is not None:
        d.polygon(pts, fill=fill)
    if outline is not None and width > 0:
        ring = list(pts) + [pts[0]]
        d.line(ring, fill=outline, width=width, joint="curve")


def _draw_face(img, IS, p0_xz, p1_xz, h_bot, h_top, fill, ink, width=3):
    pts = [
        IS(p0_xz[0], h_bot, p0_xz[1]),
        IS(p1_xz[0], h_bot, p1_xz[1]),
        IS(p1_xz[0], h_top, p1_xz[1]),
        IS(p0_xz[0], h_top, p0_xz[1]),
    ]
    _draw_polygon(img, pts, fill=fill, outline=ink, width=width)
    return pts


def _grid_windows_on_face(img, face_pts, rows, cols, *, ink_color, alpha=180,
                          margin_u=0.10, margin_v=0.18, win_u=0.55, win_v=0.55):
    if rows <= 0 or cols <= 0:
        return
    p0, p1, p2, p3 = face_pts

    def lerp(a, b, t):
        return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)

    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for r in range(rows):
        cell_v0 = margin_v + (r + (1 - win_v) / 2) * (1 - 2 * margin_v) / rows
        cell_v1 = cell_v0 + win_v * (1 - 2 * margin_v) / rows
        for c in range(cols):
            cell_u0 = margin_u + (c + (1 - win_u) / 2) * (1 - 2 * margin_u) / cols
            cell_u1 = cell_u0 + win_u * (1 - 2 * margin_u) / cols
            ll = lerp(lerp(p0, p1, cell_u0), lerp(p3, p2, cell_u0), cell_v0)
            lr = lerp(lerp(p0, p1, cell_u1), lerp(p3, p2, cell_u1), cell_v0)
            ur = lerp(lerp(p0, p1, cell_u1), lerp(p3, p2, cell_u1), cell_v1)
            ul = lerp(lerp(p0, p1, cell_u0), lerp(p3, p2, cell_u0), cell_v1)
            d.polygon([ll, lr, ur, ul], fill=ink_color + (alpha,))
    img.alpha_composite(layer)


def _box_footprint(w, d):
    return [
        (-w / 2, -d / 2),
        (w / 2, -d / 2),
        (w / 2,  d / 2),
        (-w / 2,  d / 2),
    ]


def _draw_extruded_box(img, IS, pal, footprint_local, h_total, cx_m, cz_m,
                       scale_xy, rot, *, ink=INK, levels_rows=3,
                       windows=True, width_outline=3, alpha=255):
    n = len(footprint_local)
    world = [_world(p, cx_m, cz_m, scale_xy, rot) for p in footprint_local]

    visible_idx = []
    for i in range(n):
        a = footprint_local[i]
        b = footprint_local[(i + 1) % n]
        if _face_visible(a, b, rot):
            visible_idx.append(i)

    h = h_total
    face_records = []
    for i in visible_idx:
        a_w = world[i]
        b_w = world[(i + 1) % n]
        a_l = _rotate(footprint_local[i], rot)
        b_l = _rotate(footprint_local[(i + 1) % n], rot)
        nx = b_l[1] - a_l[1]
        nz = -(b_l[0] - a_l[0])
        right_facing = nx > nz
        face_color = pal["wall"] if right_facing else pal["wall_d"]
        pts = _draw_face(img, IS, a_w, b_w, 0, h, face_color, ink,
                         width=width_outline)
        if windows:
            length_m = math.hypot(b_l[0] - a_l[0], b_l[1] - a_l[1]) * scale_xy
            cols = max(1, int(length_m / 2.4))
            _grid_windows_on_face(img, pts, levels_rows, cols,
                                  ink_color=pal["window"], alpha=190)
        face_records.append({
            "pts": pts, "i": i, "world_a": a_w, "world_b": b_w,
            "right": right_facing,
        })

    top_pts = [IS(p[0], h, p[1]) for p in world]
    _draw_polygon(img, top_pts, fill=pal["roof"], outline=ink,
                  width=width_outline)

    return {
        "world": world,
        "h": h,
        "top_pts": top_pts,
        "faces": face_records,
        "visible_idx": visible_idx,
    }


# ---------------------------------------------------------------------------
# 1. residencial_3p
# ---------------------------------------------------------------------------

def draw_residencial_3p(img, IS, ink=INK, *, cx_m, cz_m, scale_xy, scale_z=1.0,
                        rot_rad=0.0):
    pal = COLORS["residencial_3p"]
    W_, D_, H_canon = ARCHETYPE_DIMS["residencial_3p"]
    levels_rows = _CATALOG["archetypes"]["residencial_3p"]["windows"]["levels_rows"]
    H_ = H_canon * scale_z
    fp = _box_footprint(W_, D_)
    _hard_shadow(img, IS, fp, cx_m, cz_m, scale_xy, rot_rad,
                 dxdz_m=(1.5, 1.5), alpha=120)

    rec = _draw_extruded_box(img, IS, pal, fp, H_, cx_m, cz_m, scale_xy,
                             rot_rad, ink=ink, levels_rows=levels_rows,
                             windows=True)

    bal_h = 3.0 * scale_z
    for face in rec["faces"]:
        a, b = face["world_a"], face["world_b"]
        dx, dz = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dz)
        if L < 1e-6:
            continue
        nx, nz = dz / L, -dx / L
        out = 0.5
        a2 = (a[0] + nx * out, a[1] + nz * out)
        b2 = (b[0] + nx * out, b[1] + nz * out)
        bal_pts = [
            IS(a[0], bal_h, a[1]), IS(b[0], bal_h, b[1]),
            IS(b2[0], bal_h, b2[1]), IS(a2[0], bal_h, a2[1]),
        ]
        _draw_polygon(img, bal_pts, fill=pal["trim"], outline=ink, width=2)
        bal_front = [
            IS(a2[0], bal_h - 0.5, a2[1]),
            IS(b2[0], bal_h - 0.5, b2[1]),
            IS(b2[0], bal_h, b2[1]),
            IS(a2[0], bal_h, a2[1]),
        ]
        _draw_polygon(img, bal_front, fill=pal["trim"], outline=ink, width=2)


# ---------------------------------------------------------------------------
# 2. residencial_6p
# ---------------------------------------------------------------------------

def draw_residencial_6p(img, IS, ink=INK, *, cx_m, cz_m, scale_xy, scale_z=1.0,
                        rot_rad=0.0):
    pal = COLORS["residencial_6p"]
    W_, D_, H_canon = ARCHETYPE_DIMS["residencial_6p"]
    levels_rows = _CATALOG["archetypes"]["residencial_6p"]["windows"]["levels_rows"]
    H_ = H_canon * scale_z
    fp = _box_footprint(W_, D_)
    _hard_shadow(img, IS, fp, cx_m, cz_m, scale_xy, rot_rad,
                 dxdz_m=(2.0, 2.0), alpha=120)

    rec = _draw_extruded_box(img, IS, pal, fp, H_, cx_m, cz_m, scale_xy,
                             rot_rad, ink=ink, levels_rows=levels_rows,
                             windows=True)

    for face in rec["faces"]:
        a, b = face["world_a"], face["world_b"]
        zoc = [
            IS(a[0], 0, a[1]), IS(b[0], 0, b[1]),
            IS(b[0], 1.6 * scale_z, b[1]), IS(a[0], 1.6 * scale_z, a[1]),
        ]
        _draw_polygon(img, zoc, fill=pal["trim"], outline=ink, width=2)

    cw = _world((0.0, -1.0), cx_m, cz_m, scale_xy, rot_rad)
    a0 = IS(cw[0], H_, cw[1])
    a1 = IS(cw[0], H_ + 3.5 * scale_z, cw[1])
    d = ImageDraw.Draw(img)
    d.line([a0, a1], fill=ink, width=3)
    d.ellipse((a1[0] - 4, a1[1] - 4, a1[0] + 4, a1[1] + 4), fill=ink)


# ---------------------------------------------------------------------------
# 3. bloque_grande
# ---------------------------------------------------------------------------

def draw_bloque_grande(img, IS, ink=INK, *, cx_m, cz_m, scale_xy, scale_z=1.0,
                       rot_rad=0.0):
    pal = COLORS["bloque_grande"]
    W_, D_, H_canon = ARCHETYPE_DIMS["bloque_grande"]
    levels_rows = _CATALOG["archetypes"]["bloque_grande"]["windows"]["levels_rows"]
    H_ = H_canon * scale_z
    fp = _box_footprint(W_, D_)
    _hard_shadow(img, IS, fp, cx_m, cz_m, scale_xy, rot_rad,
                 dxdz_m=(2.5, 2.5), alpha=130)

    rec = _draw_extruded_box(img, IS, pal, fp, H_, cx_m, cz_m, scale_xy,
                             rot_rad, ink=ink, levels_rows=levels_rows,
                             windows=True)

    hvac_h = 1.6 * scale_z
    for off in (-9.0, 0.0, 9.0):
        bx, bz = _world((off, -3.0), cx_m, cz_m, scale_xy, rot_rad)
        sw, sd_ = 2.4 * scale_xy, 1.6 * scale_xy
        pts_top = [
            IS(bx - sw / 2, H_ + hvac_h, bz - sd_ / 2),
            IS(bx + sw / 2, H_ + hvac_h, bz - sd_ / 2),
            IS(bx + sw / 2, H_ + hvac_h, bz + sd_ / 2),
            IS(bx - sw / 2, H_ + hvac_h, bz + sd_ / 2),
        ]
        side_r = [
            IS(bx + sw / 2, H_, bz - sd_ / 2),
            IS(bx + sw / 2, H_, bz + sd_ / 2),
            IS(bx + sw / 2, H_ + hvac_h, bz + sd_ / 2),
            IS(bx + sw / 2, H_ + hvac_h, bz - sd_ / 2),
        ]
        side_f = [
            IS(bx - sw / 2, H_, bz + sd_ / 2),
            IS(bx + sw / 2, H_, bz + sd_ / 2),
            IS(bx + sw / 2, H_ + hvac_h, bz + sd_ / 2),
            IS(bx - sw / 2, H_ + hvac_h, bz + sd_ / 2),
        ]
        _draw_polygon(img, side_f, fill=pal["hvac"], outline=ink, width=2)
        _draw_polygon(img, side_r, fill=pal["hvac"], outline=ink, width=2)
        _draw_polygon(img, pts_top, fill=pal["wall_d"], outline=ink, width=2)


# ---------------------------------------------------------------------------
# 4. unifamiliar
# ---------------------------------------------------------------------------

def draw_unifamiliar(img, IS, ink=INK, *, cx_m, cz_m, scale_xy, scale_z=1.0,
                     rot_rad=0.0):
    pal = COLORS["unifamiliar"]
    W_, D_, _ = ARCHETYPE_DIMS["unifamiliar"]
    roof_spec = _CATALOG["archetypes"]["unifamiliar"]["roof"]
    eaves_h = roof_spec["eaves_h_m"] * scale_z
    ridge_h = roof_spec["ridge_h_m"] * scale_z
    fp = _box_footprint(W_, D_)
    _hard_shadow(img, IS, fp, cx_m, cz_m, scale_xy, rot_rad,
                 dxdz_m=(1.0, 1.0), alpha=120)

    rec = _draw_extruded_box(img, IS, pal, fp, eaves_h, cx_m, cz_m, scale_xy,
                             rot_rad, ink=ink, levels_rows=1, windows=True)

    p_a = (0.0, -D_ / 2)
    p_b = (0.0,  D_ / 2)
    a_w = _world(p_a, cx_m, cz_m, scale_xy, rot_rad)
    b_w = _world(p_b, cx_m, cz_m, scale_xy, rot_rad)
    corners_w = [_world(p, cx_m, cz_m, scale_xy, rot_rad) for p in fp]
    roof_L = [
        IS(corners_w[0][0], eaves_h, corners_w[0][1]),
        IS(corners_w[3][0], eaves_h, corners_w[3][1]),
        IS(b_w[0], ridge_h, b_w[1]),
        IS(a_w[0], ridge_h, a_w[1]),
    ]
    roof_R = [
        IS(corners_w[1][0], eaves_h, corners_w[1][1]),
        IS(corners_w[2][0], eaves_h, corners_w[2][1]),
        IS(b_w[0], ridge_h, b_w[1]),
        IS(a_w[0], ridge_h, a_w[1]),
    ]
    if max(p[1] for p in roof_R) > max(p[1] for p in roof_L):
        front, back = roof_R, roof_L
        col_front, col_back = pal["roof"], pal["roof_d"]
    else:
        front, back = roof_L, roof_R
        col_front, col_back = pal["roof"], pal["roof_d"]
    _draw_polygon(img, back, fill=col_back, outline=ink, width=3)
    _draw_polygon(img, front, fill=col_front, outline=ink, width=3)

    gable_a = [
        IS(corners_w[0][0], eaves_h, corners_w[0][1]),
        IS(corners_w[1][0], eaves_h, corners_w[1][1]),
        IS(a_w[0], ridge_h, a_w[1]),
    ]
    gable_b = [
        IS(corners_w[3][0], eaves_h, corners_w[3][1]),
        IS(corners_w[2][0], eaves_h, corners_w[2][1]),
        IS(b_w[0], ridge_h, b_w[1]),
    ]
    if (gable_a[0][1] + gable_a[1][1]) > (gable_b[0][1] + gable_b[1][1]):
        gable_visible, gable_back = gable_a, gable_b
    else:
        gable_visible, gable_back = gable_b, gable_a
    _draw_polygon(img, gable_back, fill=pal["wall_d"], outline=ink, width=2)
    _draw_polygon(img, gable_visible, fill=pal["wall"], outline=ink, width=3)

    door_face = next((f for f in rec["faces"] if f["right"]), None)
    if door_face:
        a, b = door_face["world_a"], door_face["world_b"]
        t = 0.55
        pa = (a[0] + (b[0] - a[0]) * (t - 0.08),
              a[1] + (b[1] - a[1]) * (t - 0.08))
        pb = (a[0] + (b[0] - a[0]) * (t + 0.08),
              a[1] + (b[1] - a[1]) * (t + 0.08))
        door = [
            IS(pa[0], 0, pa[1]),
            IS(pb[0], 0, pb[1]),
            IS(pb[0], 2.0 * scale_z, pb[1]),
            IS(pa[0], 2.0 * scale_z, pa[1]),
        ]
        _draw_polygon(img, door, fill=pal["door"], outline=ink, width=2)

    ch_x, ch_z = _world((1.5, -2.5), cx_m, cz_m, scale_xy, rot_rad)
    chw = 0.7 * scale_xy
    chd = 0.7 * scale_xy
    chh = 1.4 * scale_z
    ch_base_h = (eaves_h + ridge_h) / 2
    ch_top = [
        IS(ch_x - chw / 2, ch_base_h + chh, ch_z - chd / 2),
        IS(ch_x + chw / 2, ch_base_h + chh, ch_z - chd / 2),
        IS(ch_x + chw / 2, ch_base_h + chh, ch_z + chd / 2),
        IS(ch_x - chw / 2, ch_base_h + chh, ch_z + chd / 2),
    ]
    ch_side = [
        IS(ch_x + chw / 2, ch_base_h, ch_z - chd / 2),
        IS(ch_x + chw / 2, ch_base_h, ch_z + chd / 2),
        IS(ch_x + chw / 2, ch_base_h + chh, ch_z + chd / 2),
        IS(ch_x + chw / 2, ch_base_h + chh, ch_z - chd / 2),
    ]
    ch_front = [
        IS(ch_x - chw / 2, ch_base_h, ch_z + chd / 2),
        IS(ch_x + chw / 2, ch_base_h, ch_z + chd / 2),
        IS(ch_x + chw / 2, ch_base_h + chh, ch_z + chd / 2),
        IS(ch_x - chw / 2, ch_base_h + chh, ch_z + chd / 2),
    ]
    _draw_polygon(img, ch_front, fill=pal["wall_d"], outline=ink, width=2)
    _draw_polygon(img, ch_side, fill=pal["wall_d"], outline=ink, width=2)
    _draw_polygon(img, ch_top, fill=pal["roof_d"], outline=ink, width=2)


# ---------------------------------------------------------------------------
# 5. comercial
# ---------------------------------------------------------------------------

def draw_comercial(img, IS, ink=INK, *, cx_m, cz_m, scale_xy, scale_z=1.0,
                   rot_rad=0.0):
    pal = COLORS["comercial"]
    W_, D_, H_canon = ARCHETYPE_DIMS["comercial"]
    H_ = H_canon * scale_z
    fp = _box_footprint(W_, D_)
    _hard_shadow(img, IS, fp, cx_m, cz_m, scale_xy, rot_rad,
                 dxdz_m=(1.4, 1.4), alpha=120)

    rec = _draw_extruded_box(img, IS, pal, fp, H_, cx_m, cz_m, scale_xy,
                             rot_rad, ink=ink, levels_rows=1, windows=False)

    front_face = None
    longest = 0
    for face in rec["faces"]:
        a, b = face["world_a"], face["world_b"]
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        if L > longest:
            longest = L
            front_face = face
    if front_face:
        a, b = front_face["world_a"], front_face["world_b"]
        glass_h0 = 0.5 * scale_z
        glass_h1 = 3.2 * scale_z
        for ti, t0 in enumerate([0.10, 0.42]):
            t1 = t0 + 0.28
            pa = (a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0)
            pb = (a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1)
            glass = [
                IS(pa[0], glass_h0, pa[1]), IS(pb[0], glass_h0, pb[1]),
                IS(pb[0], glass_h1, pb[1]), IS(pa[0], glass_h1, pa[1]),
            ]
            _draw_polygon(img, glass, fill=pal["glass"], outline=ink, width=3)
        dx, dz = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dz)
        nx, nz = dz / L, -dx / L
        out = 1.0
        a2 = (a[0] + nx * out, a[1] + nz * out)
        b2 = (b[0] + nx * out, b[1] + nz * out)
        ah = 3.4 * scale_z
        awn_top = [
            IS(a[0], ah, a[1]), IS(b[0], ah, b[1]),
            IS(b2[0], ah, b2[1]), IS(a2[0], ah, a2[1]),
        ]
        awn_front = [
            IS(a2[0], ah - 0.5, a2[1]), IS(b2[0], ah - 0.5, b2[1]),
            IS(b2[0], ah, b2[1]), IS(a2[0], ah, a2[1]),
        ]
        _draw_polygon(img, awn_top, fill=pal["awning"], outline=ink, width=3)
        _draw_polygon(img, awn_front, fill=pal["awning"], outline=ink, width=3)


# ---------------------------------------------------------------------------
# 6. publico
# ---------------------------------------------------------------------------

def draw_publico(img, IS, ink=INK, *, cx_m, cz_m, scale_xy, scale_z=1.0,
                 rot_rad=0.0):
    pal = COLORS["publico"]
    W_, D_, H_canon = ARCHETYPE_DIMS["publico"]
    H_ = H_canon * scale_z
    fp = _box_footprint(W_, D_)
    _hard_shadow(img, IS, fp, cx_m, cz_m, scale_xy, rot_rad,
                 dxdz_m=(1.7, 1.7), alpha=130)

    rec = _draw_extruded_box(img, IS, pal, fp, H_, cx_m, cz_m, scale_xy,
                             rot_rad, ink=ink, levels_rows=2, windows=True,
                             width_outline=4)

    for face in rec["faces"]:
        a, b = face["world_a"], face["world_b"]
        zoc = [
            IS(a[0], 0, a[1]), IS(b[0], 0, b[1]),
            IS(b[0], 1.4 * scale_z, b[1]), IS(a[0], 1.4 * scale_z, a[1]),
        ]
        _draw_polygon(img, zoc, fill=pal["stone"], outline=ink, width=3)

    for face in rec["faces"]:
        a, b = face["world_a"], face["world_b"]
        cor = [
            IS(a[0], H_ - 0.8 * scale_z, a[1]),
            IS(b[0], H_ - 0.8 * scale_z, b[1]),
            IS(b[0], H_, b[1]),
            IS(a[0], H_, a[1]),
        ]
        _draw_polygon(img, cor, fill=pal["trim"], outline=ink, width=2)

    front_face = None
    longest = 0
    for face in rec["faces"]:
        a, b = face["world_a"], face["world_b"]
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        if L > longest:
            longest = L
            front_face = face
    if front_face:
        a, b = front_face["world_a"], front_face["world_b"]
        col_h = 4.5 * scale_z
        for t in (0.30, 0.42, 0.58, 0.70):
            cxw = a[0] + (b[0] - a[0]) * t
            czw = a[1] + (b[1] - a[1]) * t
            cw = 0.4 * scale_xy
            cd = 0.4 * scale_xy
            col_front = [
                IS(cxw - cw / 2, 1.4 * scale_z, czw + cd),
                IS(cxw + cw / 2, 1.4 * scale_z, czw + cd),
                IS(cxw + cw / 2, 1.4 * scale_z + col_h, czw + cd),
                IS(cxw - cw / 2, 1.4 * scale_z + col_h, czw + cd),
            ]
            _draw_polygon(img, col_front, fill=pal["stone"], outline=ink, width=2)


# ---------------------------------------------------------------------------
# 7. monumento
# ---------------------------------------------------------------------------

def draw_monumento(img, IS, ink=INK, *, cx_m, cz_m, scale_xy, scale_z=1.0,
                   rot_rad=0.0):
    pal = COLORS["monumento"]
    W_, D_, H_canon = ARCHETYPE_DIMS["monumento"]
    H_ = 5.0 * scale_z
    fp = _box_footprint(W_, D_)
    _hard_shadow(img, IS, fp, cx_m, cz_m, scale_xy, rot_rad,
                 dxdz_m=(1.0, 1.0), alpha=130)

    rec = _draw_extruded_box(img, IS, pal, fp, H_, cx_m, cz_m, scale_xy,
                             rot_rad, ink=ink, levels_rows=1, windows=False,
                             width_outline=3)

    cw = _world((0.0, 0.0), cx_m, cz_m, scale_xy, rot_rad)
    base_top = IS(cw[0], H_, cw[1])
    apex = IS(cw[0], H_ + 4.0 * scale_z, cw[1])
    rx = 2.5 * scale_xy * 0.866
    d = ImageDraw.Draw(img)
    bbox_dome = (base_top[0] - rx, apex[1],
                 base_top[0] + rx, base_top[1] + 6)
    d.pieslice(bbox_dome, start=180, end=360, fill=pal["dome"],
               outline=ink, width=3)
    d.line([apex, (apex[0], apex[1] - 14)], fill=ink, width=4)
    d.ellipse((apex[0] - 4, apex[1] - 18, apex[0] + 4, apex[1] - 10),
              fill=pal["trim"], outline=ink)


# ---------------------------------------------------------------------------
# 8. arbol_grande
# ---------------------------------------------------------------------------

def draw_arbol_grande(img, IS, ink=INK, *, cx_m, cz_m, scale_xy, scale_z=1.0,
                      rot_rad=0.0):
    pal = COLORS["arbol_grande"]
    spec = _CATALOG["archetypes"]["arbol_grande"]
    H_trunk = spec["trunk"]["height_m"] * scale_z
    H_top = spec["crown"]["height_m"] * scale_z
    trunk_w = spec["trunk"]["width_m"]
    crown_r_m = spec["crown"]["radius_m"]

    cw = (cx_m + 1.0, cz_m + 1.0)
    base = IS(cw[0], 0, cw[1])
    rx = 2.4 * scale_xy * 0.866
    ry = 1.2 * scale_xy * 0.5
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.ellipse((base[0] - rx, base[1] - ry, base[0] + rx, base[1] + ry),
              fill=INK + (110,))
    img.alpha_composite(layer)

    d = ImageDraw.Draw(img)
    fp = _box_footprint(trunk_w, trunk_w)
    _draw_extruded_box(img, IS, {
        "wall": pal["trunk"], "wall_d": pal["trunk_d"],
        "roof": pal["trunk_d"], "window": (0, 0, 0),
    }, fp, H_trunk, cx_m, cz_m, scale_xy, rot_rad, ink=ink,
        levels_rows=1, windows=False, width_outline=2)

    crown_h = (H_trunk + H_top) / 2 + 0.8
    cw_p = IS(cx_m, crown_h, cz_m)
    crown_r = crown_r_m * scale_xy
    d.ellipse((cw_p[0] - crown_r, cw_p[1] - crown_r,
               cw_p[0] + crown_r, cw_p[1] + crown_r),
              fill=pal["leaves_d"], outline=ink, width=3)
    d.ellipse((cw_p[0] - crown_r * 0.78, cw_p[1] - crown_r * 0.95,
               cw_p[0] + crown_r * 0.55, cw_p[1] + crown_r * 0.55),
              fill=pal["leaves"], outline=None)


# ---------------------------------------------------------------------------
# 9. plaza_pavimento
# ---------------------------------------------------------------------------

def draw_plaza_pavimento(img, IS, ink=INK, *, cx_m, cz_m, scale_xy, scale_z=1.0,
                         rot_rad=0.0):
    pal = COLORS["plaza_pavimento"]
    W_, D_, _ = ARCHETYPE_DIMS["plaza_pavimento"]
    step = _CATALOG["archetypes"]["plaza_pavimento"].get("tile_step_m", 2.5)
    fp = _box_footprint(W_, D_)
    pts = [IS(_world(p, cx_m, cz_m, scale_xy, rot_rad)[0], 0,
              _world(p, cx_m, cz_m, scale_xy, rot_rad)[1]) for p in fp]
    _draw_polygon(img, pts, fill=pal["ground"], outline=ink, width=3)
    d = ImageDraw.Draw(img)
    off = -D_ / 2 + step
    while off < D_ / 2:
        a = _world((off, -D_ / 2), cx_m, cz_m, scale_xy, rot_rad)
        b = _world((off,  D_ / 2), cx_m, cz_m, scale_xy, rot_rad)
        d.line([IS(a[0], 0, a[1]), IS(b[0], 0, b[1])],
               fill=pal["tile"], width=2)
        off += step
    off = -W_ / 2 + step
    while off < W_ / 2:
        a = _world((-W_ / 2, off), cx_m, cz_m, scale_xy, rot_rad)
        b = _world((W_ / 2, off), cx_m, cz_m, scale_xy, rot_rad)
        d.line([IS(a[0], 0, a[1]), IS(b[0], 0, b[1])],
               fill=pal["tile"], width=2)
        off += step


# ---------------------------------------------------------------------------
# Registro y matching
# ---------------------------------------------------------------------------

ARCHETYPES: Dict[str, Callable] = {
    "residencial_3p":   draw_residencial_3p,
    "residencial_6p":   draw_residencial_6p,
    "bloque_grande":    draw_bloque_grande,
    "unifamiliar":      draw_unifamiliar,
    "comercial":        draw_comercial,
    "publico":          draw_publico,
    "monumento":        draw_monumento,
    "arbol_grande":     draw_arbol_grande,
    "plaza_pavimento":  draw_plaza_pavimento,
}


def classify_building(props: Dict, area_m2: float) -> str:
    """Reglas oficiales de matching definidas en el brief.

    El orden es el de ``classification_rules.order`` en
    ``public/catalog/archetypes.json``. Mantener sincronizado.
    """
    h = float(props.get("height_m") or 6.0)
    cat = props.get("category", "residencial")

    if cat == "comercio":
        return "comercial"
    if cat == "publico":
        return "publico"

    if h > 22:
        return "bloque_grande"
    if h > 16:
        return "residencial_6p"
    if h > 12 and area_m2 > 350:
        return "bloque_grande"
    if h > 10:
        return "residencial_3p"
    if h <= 10 and area_m2 < 80:
        return "unifamiliar"
    if h <= 10 and area_m2 >= 80 and cat == "residencial":
        return "residencial_3p"
    return "residencial_3p"


def axis_angle_from_ring(ring_xz) -> Tuple[float, float, float]:
    """Devuelve (rot_rad, length_long, length_short) del bbox alineado con
    la orientación principal del polígono."""
    pts = list(ring_xz)
    if len(pts) >= 2 and pts[0] == pts[-1]:
        pts = pts[:-1]
    if len(pts) < 3:
        return 0.0, 1.0, 1.0
    mx = sum(p[0] for p in pts) / len(pts)
    mz = sum(p[1] for p in pts) / len(pts)
    best = None
    for k in range(0, 90, 5):
        ang = math.radians(k)
        c, s = math.cos(ang), math.sin(ang)
        xs = [(p[0] - mx) * c + (p[1] - mz) * s for p in pts]
        zs = [-(p[0] - mx) * s + (p[1] - mz) * c for p in pts]
        w = max(xs) - min(xs)
        d = max(zs) - min(zs)
        area = w * d
        if best is None or area < best[0]:
            best = (area, ang, w, d)
    _, ang, w, d = best
    if w > d:
        ang = ang + math.pi / 2
        w, d = d, w
    return ang, d, w


def axis_angle_and_dims(ring_xz):
    """Compatibilidad: alias."""
    return axis_angle_from_ring(ring_xz)
