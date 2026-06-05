# PENDIENTE · Integrar overlay Espacios Naturales Protegidos (ESP-01)

Fecha: 2026-05-27

## Ficheros
- `public/data/enp-canarias.geojson` (970 KB · 369 polígonos WGS84)
- `public/polis-app/overlays/enp.js`
- `scripts/extract-enp-canarias.py` (genera el geojson desde 3 SHP de SITCAN)

## Cobertura
- Red Canaria de ENP (Ley 12/1994 / TR 1/2000): parques nacionales, parques
  naturales, parques rurales, reservas naturales integrales / especiales,
  monumentos naturales, paisajes protegidos, sitios de interés científico.
- Red Natura 2000: ZEC (Decreto 174/2009) + ZEPA terrestres (Decreto 184/2022).

## Integración en `overlays/index.js`
```js
import { enpOverlay } from "./enp.js?v=20260527-enp-v0";
// En OVERLAYS[]: añadir
enpOverlay,
// En META:
enp: { category: "verdes", levels: ["isla","municipio","distrito","barrio","seccion"], subcategorias: true },
```

> Nota API: `enp.js` expone subtipos vía `enpOverlay.subtypes`
> (lista) + `enpOverlay.activeSubtypes` (Set | null), NO vía
> `getSubcatOptions`/`setSubcatFilter`. Si el cog-modal usa la API
> uniforme, añadir shims o adaptar el drawer.

## Integración en `app.js` AMBITOS
Encaja en el ámbito "espacio" o uno dedicado "naturaleza":
```js
{ id: "espacio", ..., layers: ["parques", "calidad-aire", "mobiliario", "enp"] }
```

## Render
- Niveles: `isla`, `municipio`, `distrito`, `barrio`, `seccion`. NO en `manzana` ni `archipielago`.
- Polígonos translúcidos verde-oliva, opacidad y saturación según jerarquía legal
  (parque_nacional más oscuro/saturado; sitio_interes y monumento más claros).
- ZEC/ZEPA en verde-azulado para distinguirlas de la Red Canaria.
- Filtra por bbox del nivel; no recorre el dataset completo en cada frame.
