# Pendiente integrar: movilidad-suave overlay

Indicador **MOV-02 Carriles bici + zonas 30 + peatonales**. Datos y
overlay ya producidos por `scripts/extract-movilidad-suave.py` (genera
`public/data/movilidad-suave-canarias.geojson`) y
`public/polis-app/overlays/movilidad-suave.js`.

No se ha tocado `overlays/index.js` ni `app.js` porque hay otros chats
trabajando en paralelo sobre esos ficheros. Cambios mínimos abajo.

## Cambios necesarios en `public/polis-app/overlays/index.js`

1. Añadir import (junto al resto de imports de overlays):

   ```js
   import { movilidadSuaveOverlay } from "./movilidad-suave.js?v=20260527-movsuave-v0";
   ```

2. Añadir a `OVERLAYS[]` (junto al resto de overlays de movilidad):

   ```js
   movilidadSuaveOverlay,
   ```

3. Añadir a `META`:

   ```js
   "movilidad-suave": {
     category: "movilidad",
     levels: ["municipio", "distrito", "barrio", "seccion"],
     subcategorias: true
   },
   ```

## Cambios en `public/polis-app/app.js` (AMBITOS)

Localizar el `layer` con `id: "movilidad"` y añadir `"movilidad-suave"` a
la lista `layers`. Queda:

```js
{ id: "movilidad", /* ...resto... */, layers: ["guaguas", "cobertura", "titsa", "movilidad-suave"] }
```

## Sub-chips (5 tipos)

El overlay expone `getCategoryOptions()` con los 5 tipos:

| key            | label             | count aprox (Canarias) |
|----------------|-------------------|------------------------|
| cycleway       | Carril bici       | 926                    |
| footway        | Peatonal          | 31 213                 |
| pedestrian     | Zona peatonal     | 5 434                  |
| zona30         | Zona 30           | 3 349                  |
| living_street  | Calle pacificada  | 1 111                  |

API mínima para UI de chips:

```js
movilidadSuaveOverlay.getCategoryOptions();      // { key, label, fill, count, enabled }
movilidadSuaveOverlay.toggleTipo("cycleway");    // flip on/off
movilidadSuaveOverlay.setTipoEnabled("zona30", false);
```

Si la UI de sub-chips reusa el patrón de `parques`/`alimentacion`/etc.,
con `subcategorias: true` en META debería pillar el listado por sí
sola — verificar al integrar.

## Notas

- El overlay no se renderiza en niveles `archipielago/isla` (~42k
  features saturarían el lienzo); por eso `META.levels` se limita a
  `municipio/distrito/barrio/seccion` y el propio `draw()` devuelve si
  el nivel no está soportado.
- El GeoJSON pesa **~9,9 MB** (footway por sí solo es el 70% del peso —
  ~31k peatonales en Canarias). Tolerancia de simplificación 8 m fijada
  por el brief; si el peso bloquea producción, opciones son:
  (a) subir tolerancia a 15 m solo para `footway`, (b) recortar
  `footway` por niveles (>=barrio), (c) emitir un segundo GeoJSON
  parcial. Cache-buster del fetch fijado a `force-cache` por defecto.
- `pedestrian` y `living_street` con geometría cerrada se rinden como
  polígono translúcido (fill alpha bajo); el resto sólo como trazo.
  `zona30` usa stroke punteado para distinguirse de cycleway.
- `cycleway` también incluye los highway con `bicycle=designated` (carril
  bici señalizado dentro de calzada compartida).
- Cache-buster `?v=20260527-movsuave-v0` en el `fetch` del overlay.
  Subir número si se regenera el GeoJSON con cambios incompatibles
  (p.ej. nuevos tipos, properties renombradas).
