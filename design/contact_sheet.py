"""Compose a single brand-board contact sheet PNG from the eight pieces."""
from __future__ import annotations
import pathlib
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent
PNG  = ROOT / "png"
OUT  = ROOT / "contact_sheet.png"

PALETTE = [
    ("#c8b898", "SAND"),       ("#f0e0c0", "SAND·LIGHT"),
    ("#b07840", "OCRE"),       ("#8a5a2a", "OCRE·DEEP"),
    ("#c85438", "TERRACOTTA"), ("#5b9aa8", "AEGEAN"),
    ("#3a5878", "BLUE·DEEP"),  ("#7c8a4a", "LAUREL"),
    ("#d8a44a", "GOLD"),       ("#221d18", "VOLCANIC"),
]

PIECES = [
    ("koinos.png",      "KOINOS",        "Tà koiná — the commons"),
    ("polis.png",       "POLIS",         "El visor del territorio"),
    ("agora.png",       "ÁGORA",         "Discusión cívica"),
    ("bibliotheka.png", "BIBLIOTHEKA",   "Cursus honorum · Koiná"),
    ("pharos.png",      "PHAROS",        "Ejes de capital cívico"),
    ("ocre.png",        "OCRE",          "Recuperación de espacios"),
    ("cursus.png",      "CURSUS",        "Honorum · ciudadanía"),
    ("koina.png",       "KOINÁ",         "Recursos del común"),
]

# 4 cols × 2 rows of pieces, plus header & palette strip
TILE = 480
PAD  = 36
COLS, ROWS = 4, 2
W = COLS * TILE + (COLS + 1) * PAD
H = 360 + ROWS * TILE + (ROWS + 1) * PAD + 220

BG       = (251, 244, 221)        # paper_lt
INK      = (34,  29,  24)         # volcanic
SUBTLE   = (138, 90,  42)         # ocre_dk

img = Image.new("RGB", (W, H), BG)
draw = ImageDraw.Draw(img)

def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
            if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
            if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for p in candidates:
        if pathlib.Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

# ---------------------------------------------------------- header
draw.text((PAD*2, PAD), "KOINOS", font=font(140, True), fill=INK)
draw.text((PAD*2, PAD + 150),
          "Civic design system  ·  isometric tile + corporate logogram",
          font=font(36), fill=SUBTLE)
draw.text((PAD*2, PAD + 200),
          "OCRE — Organización Canaria para la Recuperación de Espacios",
          font=font(28), fill=INK)

# divider
y_div = PAD + 270
draw.line([(PAD*2, y_div), (W - PAD*2, y_div)], fill=INK, width=4)

# ---------------------------------------------------------- pieces grid
y0 = y_div + PAD
for i, (fname, name, sub) in enumerate(PIECES):
    r, c = divmod(i, COLS)
    x = PAD + c * (TILE + PAD)
    y = y0 + r * (TILE + PAD)
    # tile background — soft sand panel
    draw.rounded_rectangle([x, y, x + TILE, y + TILE], radius=18,
                           fill=(244, 234, 212), outline=INK, width=3)
    # paste piece
    p = Image.open(PNG / fname).convert("RGBA")
    p.thumbnail((TILE - 24, TILE - 24), Image.LANCZOS)
    px = x + (TILE - p.width) // 2
    py = y + (TILE - p.height) // 2 - 14
    img.paste(p, (px, py), p)
    # label
    draw.text((x + 24, y + TILE - 64), name, font=font(34, True), fill=INK)
    draw.text((x + 24, y + TILE - 28), sub, font=font(18), fill=SUBTLE)

# ---------------------------------------------------------- palette strip
y_pal = y0 + ROWS * (TILE + PAD)
swatch_w = (W - 2*PAD) // len(PALETTE)
for i, (hex_c, name) in enumerate(PALETTE):
    rgb = tuple(int(hex_c[j:j+2], 16) for j in (1, 3, 5))
    x = PAD + i * swatch_w
    draw.rectangle([x, y_pal, x + swatch_w - 6, y_pal + 110], fill=rgb)
    draw.text((x + 12, y_pal + 124), name, font=font(16, True), fill=INK)
    draw.text((x + 12, y_pal + 144), hex_c.upper(), font=font(15), fill=SUBTLE)

# footer
draw.text((PAD*2, H - 56),
          "Each piece reads as a 2.5-D map tile (transparent variant in /png/tile/) "
          "and as a corporate logogram (full disc in /png/).",
          font=font(20), fill=SUBTLE)

img.save(OUT, "PNG", optimize=True)
print("wrote", OUT)
