# packages.iso

Catálogo de arquetipos isométricos y agrupación de edificios en bloques.
Es la capa de "vocabulario" del visor: cada edificio del territorio se
proyecta en una de 9 piezas paramétricas estilo Into the Breach con
dimensiones canónicas en metros y paleta plana.

## Módulos

- `archetypes.py` — 9 arquetipos (residencial 3p/6p, bloque grande,
  unifamiliar, comercial, público, monumento, árbol, plaza). Lee las
  definiciones declarativas desde `public/catalog/archetypes.json` al
  importarse. Expone `ARCHETYPES`, `ARCHETYPE_DIMS`, `COLORS`, `INK`,
  `classify_building(props, area)`, `axis_angle_from_ring(ring)`.
- `bloque_clustering.py` — agrupa edificios contiguos (distancia ≤ 1.5 m)
  en BLOQUES; también `simplify_manzana()` y `unify_manzana()` para vistas
  zoom-out.

## Ejemplo de uso desde Python

```python
from packages.iso.archetypes import ARCHETYPES, classify_building
from packages.iso.bloque_clustering import compute_bloques

atype = classify_building({"category": "residencial", "height_m": 18}, area_m2=180)
ARCHETYPES[atype](img, IS, ink, cx_m=0, cz_m=0, scale_xy=1.0)

bloques = compute_bloques(building_features, distance_threshold=1.5)
```

## CLI

Estos módulos no exponen CLI propia (se consumen desde `packages.mockups.*`).
