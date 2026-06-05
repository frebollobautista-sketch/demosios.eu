# PENDIENTE · Integrar overlay Árboles singulares (ESP-05)

Fecha: 2026-05-27

## Ficheros
- `public/data/arboles-singulares-canarias.geojson` (50KB · 146 árboles)
- `public/polis-app/overlays/arboles-singulares.js`

## Joyas representativas
- Pino Gordo de Vilaflor (45.12m, ~801 años, monumental)
- Drago Milenario de Icod (~1000 años)
- Sabinas El Hierro (familia: sabina)
- Laureles, mocanes, codesos, palmas chilenas

## Integración en `overlays/index.js`
```js
import { arbolesSingularesOverlay } from "./arboles-singulares.js?v=20260527-arboles-v0";
// En OVERLAYS[]:
arbolesSingularesOverlay,
// En META:
"arboles-singulares": { category: "patrimonio", levels: ["isla","municipio","distrito","barrio","seccion"], subcategorias: true },
```

## Integración en `app.js` AMBITOS
Vincular al ámbito "espacio" o crear sub-categoría "patrimonio botánico" en cultura:
```js
{ id: "espacio", ..., layers: [..., "arboles-singulares"] }
```
