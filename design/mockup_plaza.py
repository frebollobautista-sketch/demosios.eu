"""Mockup — eight tiles arranged on an isometric civic plaza."""
from __future__ import annotations
import math, pathlib
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent
TIL  = ROOT / "png" / "tile"
OUT  = ROOT / "mockup_plaza.png"

W, H = 2200, 1500
BG   = (251, 244, 221)
INK  = (34, 29, 24)

img = Image.new("RGBA", (W, H), BG + (255,))
draw = ImageDraw.Draw(img)

# isometric grid centred a touch low
CX, CY = W // 2, H // 2 + 90
TILE_W, TILE_H = 280, 160              # screen size of one ground tile
COS30 = math.cos(math.radians(30))

def grid_to_screen(gx: int, gy: int):
    sx = CX + (gx - gy) * TILE_W * 0.5
    sy = CY + (gx + gy) * TILE_H * 0.5
    return sx, sy

# ground rhombus tiles (3x3)
for gy in range(-2, 3):
    for gx in range(-2, 3):
        sx, sy = grid_to_screen(gx, gy)
        pts = [(sx, sy - TILE_H/2),
               (sx + TILE_W/2, sy),
               (sx, sy + TILE_H/2),
               (sx - TILE_W/2, sy)]
        light = ((gx + gy) % 2 == 0)
        fill = (220, 207, 178) if light else (200, 184, 152)
        draw.polygon(pts, fill=fill, outline=(138, 90, 42), width=2)

# Place tiles — (filename, gx, gy, scale)
PIECES = [
    ("polis.tile.png",        0, -1, 0.62),  # top — polis as the city
    ("agora.tile.png",       -1,  0, 0.58),
    ("bibliotheka.tile.png",  1,  0, 0.58),
    ("pharos.tile.png",       0,  0, 0.74),  # center — the lighthouse
    ("cursus.tile.png",      -1,  1, 0.55),
    ("ocre.tile.png",         1,  1, 0.55),
    ("koinos.tile.png",       0,  2, 0.50),  # foreground anchor
    ("koina.tile.png",        2, -1, 0.55),  # right back
]

# Sort painter's order: smallest gx+gy (deepest) first
PIECES.sort(key=lambda t: t[1] + t[2])

for fname, gx, gy, scale in PIECES:
    sx, sy = grid_to_screen(gx, gy)
    p = Image.open(TIL / fname).convert("RGBA")
    new_w = int(p.width * scale)
    new_h = int(p.height * scale)
    p = p.resize((new_w, new_h), Image.LANCZOS)
    # the tile asset's centre-of-base ≈ (W/2, H/2 + 60*scale_factor in original)
    # paste so the foot of the piece sits on the rhombus centre
    px = int(sx - new_w / 2)
    py = int(sy - new_h * 0.62)
    img.alpha_composite(p, (px, py))

# title
def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    p = ("/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
         if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf")
    return ImageFont.truetype(p, size)

draw.text((60, 50), "POLIS — civic plaza", font=font(72, True), fill=INK)
draw.text((60, 130),
          "Each piece of the brand reads simultaneously as a 2.5-D map tile "
          "and as a corporate logogram.",
          font=font(28), fill=(138, 90, 42))

img.convert("RGB").save(OUT, "PNG", optimize=True)
print("wrote", OUT)
