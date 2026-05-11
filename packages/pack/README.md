# packages.pack

Generador del "data pack" Godot-ready por sección censal. Produce 11
ficheros (10 GeoJSON en metros locales ENU + meta.json + preview.png) que
cualquier renderer (Python, JS, GDScript) puede consumir.

## Módulos

- `pack_section.py` — `build_pack(cusec, out_dir, cache=None)` y CLI
  para una sección. Convierte WGS84 → metros locales con origen en el
  centroide de la sección, recorta calles/POIs/parques/agua del bbox,
  agrupa edificios en manzanas y categoriza según POIs cercanos.
- `batch.py` — orquesta `build_pack` sobre muchas secciones, cargando
  los datasets grandes (roads.json ~38 MB) UNA sola vez en memoria con
  índices STRtree. Genera `manifest.json` y `contact_sheet.png`.

## Ejemplo de uso desde Python

```python
from packages.pack.pack_section import build_pack
import pathlib

build_pack("3501602052", pathlib.Path("public/sections_pack"))
```

## CLI

```bash
python3 -m packages.pack.pack_section 3501602052
python3 -m packages.pack.batch --zone canteras
python3 -m packages.pack.batch --cusecs 3501602052 3501602053 --skip-existing
```
