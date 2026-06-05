# packages.data_sources

Placeholder. Aquí vivirán los extractores de fuentes externas que hoy
están sueltos en `scripts/` (PBF Geofabrik → buildings/OSM layers,
INE renta, ISTAC vivienda vacacional, Catastro INSPIRE…).

## Plan de migración (no bloqueante)

Cuando se aborde la migración, los siguientes scripts pasarán aquí:

- `scripts/pbf-to-buildings.py` → `packages/data_sources/osm_buildings.py`
- `scripts/pbf-to-osm-layers.py` → `packages/data_sources/osm_layers.py`
- `scripts/process-vv.py`        → `packages/data_sources/istac_vv.py`
- `scripts/fetch-renta-ine.mjs`  → `packages/data_sources/ine_renta.mjs`
- `scripts/catastro-to-buildings.mjs` → `packages/data_sources/catastro.mjs`

Por ahora siguen donde están y no es necesario tocarlos. Los datos que
producen viven en `public/buildings/`, `public/osm-gc/`, `public/data/`.

## CLI (futuro)

```bash
python3 -m packages.data_sources.osm_buildings
python3 -m packages.data_sources.osm_layers
```
