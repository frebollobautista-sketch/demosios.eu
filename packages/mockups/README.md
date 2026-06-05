# packages.mockups

Renders comparativos y mockups isométricos. Cada módulo lee un data pack
(`public/sections_pack/<cusec>/`) y produce un PNG en `design/secciones/`.
Son herramientas de diseño/iteración, no parte del visor en producción.

## Módulos

- `zoom.py` — close-up iso de N manzanas contiguas (grid 10 m, IDs).
  Aporta también la paleta y proyección iso compartidas.
- `mobile.py` — frame iPhone con manzana hero + ficha; chrome iOS reusable.
- `songkick.py` — manzana hero + dos cards XL estilo Songkick.
- `archetypes_compare.py` — antes (OSM literal) vs ahora (catálogo).
- `bloque_compare.py` — 4 paneles edificio / bloque / manzana / sección.
- `lod_ladder.py` — 5 niveles desde manzana hasta isla completa.
- `filter.py` — A vs B con filtro por categoría activo en B.
- `events.py` — 3 eventos sintéticos como pins + bottom sheet.

## Ejemplo de uso desde Python

```python
from packages.mockups.bloque_compare import render_compare
import pathlib

render_compare("3501602052", 24,
               pathlib.Path("public/sections_pack/3501602052"),
               pathlib.Path("design/secciones/out.png"))
```

## CLI

```bash
python3 -m packages.mockups.bloque_compare 3501602052 24
python3 -m packages.mockups.lod_ladder 3501602052 24
python3 -m packages.mockups.songkick 3501602052 24
```
