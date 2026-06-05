# PENDIENTE · Integrar overlay Mobiliario urbano (ESP-07)

Fecha: 2026-05-27

## Ficheros
- `public/data/mobiliario-urbano-canarias.geojson` (610KB · 5.245 features)
- `public/polis-app/overlays/mobiliario.js`

## Distribución
- 1.500 árboles urbanos
- 1.500 bancos
- 810 aseos públicos
- 579 refugios/marquesinas
- 473 fuentes potables
- 383 fuentes ornamentales

## Integración en `overlays/index.js`
```js
import { mobiliarioOverlay } from "./mobiliario.js?v=20260527-mobiliario-v0";
// En OVERLAYS[]: añadir al final
mobiliarioOverlay,
// En META:
mobiliario: { category: "verdes", levels: ["municipio","distrito","barrio","seccion","manzana"], subcategorias: true },
```

## Integración en `app.js` AMBITOS
El ámbito "espacio" puede añadir `mobiliario` a su `layers`:
```js
{ id: "espacio", ..., layers: ["parques", "calidad-aire", "mobiliario"] }
```
