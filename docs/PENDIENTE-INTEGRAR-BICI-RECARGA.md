# PENDIENTE · Integrar overlay Bici parking + recarga eléctrica (MOV-03)

Fecha: 2026-05-27

## Ficheros
- `public/data/movilidad-electrica-canarias.geojson` (65 KB · 364 features)
- `public/polis-app/overlays/bici-recarga.js`
- `scripts/extract-movilidad-electrica.py` (genera el geojson desde OSM PBF + nextbike Sítycleta)

## Distribución
- 204 bici parking (incluye estaciones Sítycleta de Las Palmas GC, city.uid=408)
- 160 puntos de recarga eléctrica
- Por isla: Gran Canaria (99), Tenerife (89), Lanzarote (59), Fuerteventura (40), La Palma (38), La Gomera (19), El Hierro (9), La Graciosa (11)
- Biciambiental Tenerife: sin feed abierto a 2026-05-27 — el extractor deja un CSV manual en `data-sources/biciambiental-tf.csv`.

## Integración en `overlays/index.js`
```js
import { biciRecargaOverlay } from "./bici-recarga.js?v=20260527-bici-recarga-v0";
// En OVERLAYS[]:
biciRecargaOverlay,
// En META:
"bici-recarga": { category: "movilidad", levels: ["isla","municipio","distrito","barrio","seccion","manzana"], subcategorias: true },
```

## Integración en `app.js` AMBITOS
Encaja en el ámbito "movilidad":
```js
{ id: "movilidad", ..., layers: ["guaguas","titsa","movilidad-suave","bici-recarga"] }
```

## API
- `getSubcatOptions()` → `[{id, label, color}]` con `bici_parking` y `recarga`.
- `setSubcatFilter(ids)` para filtrar (null/[] = todos).

## Render
- Pin circular pequeño (r=7) con glifo: `B` para bici_parking, `⚡` para recarga.
- Cluster 18px. En cluster mixto prioriza `recarga` por impacto.
- Niveles activos: `isla` → `manzana` (todos menos `archipielago`).
