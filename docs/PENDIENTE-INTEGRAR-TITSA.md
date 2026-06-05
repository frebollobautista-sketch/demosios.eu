# Pendiente integrar: titsa overlay

Indicador **MOV-01 Paradas Titsa con itinerarios**. Datos y overlay ya
producidos por `scripts/extract-titsa-gtfs.py` (genera
`public/data/titsa-stops.json`) y `public/polis-app/overlays/titsa.js`.

No se ha tocado `overlays/index.js` ni `app.js` porque hay otros chats
trabajando en paralelo sobre esos ficheros. Cambios mínimos abajo.

## Cambios necesarios en `public/polis-app/overlays/index.js`

1. Añadir import (junto al resto de imports de overlays):

   ```js
   import { titsaOverlay } from "./titsa.js?v=20260527-titsa-v0";
   ```

2. Añadir a `OVERLAYS[]` (al final, antes de `calidadAireOverlay`):

   ```js
   titsaOverlay,
   ```

3. Añadir a `META`:

   ```js
   titsa: { category: "movilidad", levels: ["municipio", "distrito", "barrio", "seccion"] },
   ```

## Cambios en `public/polis-app/app.js` (AMBITOS)

Localizar el `layer` con `id: "movilidad"` y añadir `"titsa"` a la lista
`layers`. Queda:

```js
{ id: "movilidad", /* ...resto... */, layers: ["guaguas", "cobertura", "titsa"] }
```

## Notas

- El overlay no se renderiza en niveles `archipielago/isla` (saturación
  visual con 3.788 paradas); por eso `META.levels` se limita a
  `municipio/distrito/barrio/seccion` y el propio `draw()` devuelve si
  el nivel no está soportado.
- El JSON pesa 482 KB. Si en algún momento crece, recortar
  `TOP_ROUTES_PER_STOP` en el script (actualmente 5).
- Cache-buster `?v=20260527-titsa-v0` en el `fetch` del overlay. Subir
  número si se regenera el JSON con cambios incompatibles.
