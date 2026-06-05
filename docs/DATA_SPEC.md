# Contrato del Data Pack — KOINOS · POLIS

Cada sección censal genera un "data pack" en
`public/sections_pack/<cusec>/`. Es la unidad de carga del visor y del
prototipo Godot: 11 ficheros que describen el territorio en metros
locales ENU centrados en el centroide de la sección.

## v1 (actual)

Producido por `packages.pack.pack_section.build_pack`. Identificable
por `meta.producer == "iso_pack.py v1"`.

### Sistema de coordenadas

- Origen: centroide de la sección, lng0/lat0 en `meta.enu_basis`.
- Linealización ENU plana:
  - `x = (lng - lng0) * 111320 * cos(lat0)`
  - `z = (lat0 - lat) * 111320`
- Eje Y = altura sobre suelo (metros).
- Convención Godot (right-handed, Y up):
  X=este, Y=altura, Z=sur. Documentado en
  `meta.godot_axis_mapping`.
- CRS string libre en `crs.properties.name`:
  `"EPSG:32628_local_enu_m_section_centroid"`.

### Ficheros del pack

| Archivo | Tipo | Contenido |
| --- | --- | --- |
| `meta.json` | JSON | metadatos, contadores, bbox, paleta de categorías |
| `section.geojson` | FC (2 features) | sección en WGS84 + sección en metros locales |
| `buildings.geojson` | FC Polygon | huellas de edificios + altura/categoría/manzana_id |
| `manzanas.geojson` | FC Polygon | manzanas extraídas por buffer+dissolve+buffer-in |
| `roads.geojson` | FC LineString | calles clipped al bbox + tipo + width_m |
| `pois.geojson` | FC Point | POIs comerciales clasificados (restauración, comercio, salud…) |
| `trees.geojson` | FC Point | árboles del extracto Canteras (sólo zona LPGC) |
| `monuments.geojson` | FC Point | monumentos OSM con altura simbólica |
| `parks.geojson` | FC Polygon | parques/cultivos/cementerios clipped |
| `water.geojson` | FC Polygon | agua clipped (ríos, embalses, mar interior) |
| `preview.png` | PNG 1024×1094 | render iso del pack con leyenda y banner |

### `meta.json` — campos canónicos

```json
{
  "cusec": "3501602052",
  "mun": "016",
  "nmun": "Palmas de Gran Canaria, Las",
  "area_ha": 24.91,
  "perimeter_m": 3209.86,
  "building_count": 361,
  "tree_count": 154,
  "monument_count": 0,
  "poi_count": 38,
  "road_segment_count": 381,
  "centroid_lnglat": [-15.4319, 28.1272],
  "bbox_lnglat": [-15.4356, 28.1236, -15.4258, 28.1296],
  "bbox_local_m": [-363.24, -271.28, 598.86, 396.64],
  "enu_basis": {"lng0": -15.4319, "lat0": 28.1272, "cos_lat0": 0.881903},
  "godot_axis_mapping": "X=east_m, Y=height_m, Z=south_m (right-handed, Y up)",
  "produced_at": "2026-05-09T16:47:31+00:00",
  "producer": "iso_pack.py v1",
  "categories": { /* dict cat → {color hex, extrude bool} */ }
}
```

### `buildings.geojson` properties

- `id` (int): correlativo dentro del pack.
- `height_m` (float): altura sobre suelo. 6.0 m por defecto si falta.
- `levels` (int|null): plantas declaradas si vienen del Catastro.
- `category` (str): asignada por `assign_building_category()` según POI
  más cercano (<30 m). Valores: residencial, comercio, restauracion,
  alojamiento, salud, finanzas, publico.
- `extrude` (bool): siempre true para edificios.
- `manzana_id` (int|null): id de manzana que contiene su centroide.

### `manzanas.geojson` properties

- `id` (int): correlativo.
- `height_median_m` (float): mediana de los edificios contenidos.
- `building_count` (int): nº edificios cuyos centroides caen dentro.
- `area_m2` (float).

### Categorías y paleta

Las 12 categorías oficiales con su color hex viven en `meta.categories`.
También están duplicadas en `packages.pack.pack_section.CATEGORIES` y
en `packages.iso.archetypes` (a través del JSON declarativo). Cualquier
cambio de paleta debe propagarse a los tres sitios.

### Contadores y consistencia

`meta.building_count == len(buildings.geojson.features)`. Lo mismo para
`tree_count`, `monument_count`, `poi_count`, `road_segment_count`. El
batch (`packages.pack.batch`) no rellena `manzana_count` en v1 (bug
menor — usar `len(manzanas.geojson.features)` en su lugar).

## v2 (planificado)

Cambios menores que requieren regenerar el batch.

### Nuevo: `bloques.geojson`

FeatureCollection Polygon con la salida de
`packages.iso.bloque_clustering.compute_bloques()` aplicada a los
edificios de cada manzana. Properties:

- `id` (int): correlativo.
- `manzana_id` (int): manzana padre.
- `building_ids` (list[int]): edificios que componen el bloque.
- `n` (int): tamaño del clúster (4-12 típico).
- `height_median_m` (float).
- `category_dominant` (str).
- `area_m2` (float).

### Cambios en `meta.json`

```json
{
  ...,
  "schema_version": "2.0",
  "producer": "pack_section.py v2",
  "bloque_count": 87,
  "manzana_count": 52,
  "clustering_params": {
    "distance_threshold_m": 1.5,
    "morphological_close_m": 0.5,
    "simplify_tol_m": 0.8
  }
}
```

### Compatibilidad

Lectores v1 deben:

- Comprobar `schema_version` antes de cargar.
- Ignorar campos desconocidos (`bloque_count`, `clustering_params`)
  sin fallar.
- Cargar `bloques.geojson` solo si existe (es opcional para LOD).

Lectores v2 deben funcionar también con packs v1, asumiendo
`schema_version: "1.0"` por defecto y reconstruyendo `bloques` en
runtime (lento) si el archivo falta.
