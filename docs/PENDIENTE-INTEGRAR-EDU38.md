# Pendiente · Integrar centros educativos prov 38 en el overlay

**Estado**: datos generados (722 centros TF/LP/LG/EH), overlay aún solo
consume prov 35. Cambio mínimo de 2 líneas en `overlays/educacion.js`.

## Qué hay hecho (2026-05-27)

- `scripts/extract-centros-educativos-prov38.py` — extractor a partir
  del CSV oficial de la Consejería de Educación (datos.canarias.es).
  Mismo schema que `process-centros-educativos.py` de prov35.
- `public/data/centros-educativos-prov38.geojson` — 722 features
  (TF 589 · LP 90 · LG 28 · EH 15). 329 KB. Esquema idéntico a prov35:
  `nombre, etapa, etapa_desc, municipio, isla, categoria` ∈
  `{publico, concertado, privado, otro}`.
- `public/data/centros-educativos-stats-prov38.json` — agregados por
  municipio prov 38 (no se sobre-escribió `centros-educativos-stats.json`
  para no romper el overlay actual).

## Cambio pendiente en `overlays/educacion.js`

Hoy (línea ~28):

```js
const POINTS_URL = "../data/centros-educativos-prov35.geojson";
const STATS_URL  = "../data/centros-educativos-stats.json";
```

Cambio sugerido (cargar ambos geojson + ambos stats y mergear):

```js
const POINTS_URLS = [
  "../data/centros-educativos-prov35.geojson",
  "../data/centros-educativos-prov38.geojson",
];
const STATS_URLS = [
  "../data/centros-educativos-stats.json",
  "../data/centros-educativos-stats-prov38.json",
];
```

Y en `load()` reemplazar el `Promise.all([fetch(POINTS_URL)..., fetch(STATS_URL)...])`
por dos `Promise.all` que carguen cada array y luego concatenen:

```js
const [geos, statsArr] = await Promise.all([
  Promise.all(POINTS_URLS.map(u => fetch(u).then(r => r.json()))),
  Promise.all(STATS_URLS.map(u => fetch(u).then(r => r.json()))),
]);
const allFeats = geos.flatMap(g => (g && g.features) || []);
// ...iterar allFeats igual que ahora.
const mergedStats = Object.assign({}, ...statsArr);
// ...construir Map a partir de mergedStats igual que ahora.
```

Sin cambios en `draw()`, `META`, `index.js` o `app.js`. La proyección
local sigue siendo válida: `lnglatToLocalMeters` con `GC_ANCHOR =
[-15.55, 28.05]` proyecta correctamente cualquier lng/lat de Canarias a
metros locales (verificado: las distancias son grandes pero el sistema
es plano-equirrectangular suficiente para puntos finos).

## Cache-bust

Tras integrar:
- `overlays/educacion.js?v=20260527-edu-multifuente`
- Actualizar `polis-app/app.js` y `polis-app/overlays/index.js` referencias
  si las tienen pinneadas.

## Verificación tras integrar

1. Navegar a TF a nivel isla → ver burbujas por municipio (top: SC TF
   131, La Laguna 103, Arona 30, La Orotava 29).
2. Entrar en SC TF mun → ver puntos individuales (131 esperados).
3. Confirmar que prov 35 sigue funcionando (Las Palmas de GC sin
   regresión: ~286 centros).
4. Sub-chips por etapa (Infantil/Secundaria/FP/etc.) deben funcionar
   igual — los buckets se calculan en `_etapaBucket()` por código de
   etapa OSM/Consejería, válido para ambas provincias.

## Por qué no se integró en esta tarea

Brief explícito: "NO toques `overlays/index.js` ni `app.js`. Si overlay
no soporta múltiples fuentes, deja en `docs/PENDIENTE-INTEGRAR-EDU38.md`
el cambio". Cumplido.
