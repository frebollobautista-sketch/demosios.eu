# PENDIENTE · Integrar overlay Peligrosidad Volcánica (RIE-02)

Fecha: 2026-05-27
Estado: ficheros creados y datos extraídos, **integración manual
pendiente** para no tocar `overlays/index.js` ni `app.js` desde la
tarea de generación.

## Ficheros creados

| Path | Rol |
|---|---|
| `scripts/extract-peligro-volcanico.py` | Pipeline OSM + catálogo histórico + zonas PEVOLCA |
| `public/data/peligro-volcanico-canarias.geojson` | 485 features · 300 KB |
| `public/polis-app/overlays/peligro-volcanico.js` | Overlay 3-capas + leyenda + sub-chips |

Contenido del GeoJSON:
- **412 conos volcánicos** (33 históricos 1430–2021, resto prehistórico).
- **62 coladas históricas** (lava fields/flows OSM cerrados): Malpaís
  de Güímar, malpaís Timanfaya 1730-36, coladas Tajogaite 2021, etc.
- **11 zonas PEVOLCA** clasificadas en 5 niveles (N1 muy alta → N5 baja).

## Fuentes de datos

### 1. PEVOLCA — Plan Especial Protección Civil Riesgo Volcánico Canarias

- Decreto 73/2020 GobCan, en proceso de modificación (Proyecto VOLCAN
  CSIC + IGN + GobCan financiado por la Comisión Europea, mapas
  vectoriales oficiales por publicar 2026-2027).
- El PEVOLCA vigente publica el plan como PDF en BOC y mapas raster
  en visores web, **pero no expone WFS/GeoPackage vectorial por niveles
  descargable**. SITCAN tiene un dataset llamado RIESGOMAP (MAC 2007-2013,
  FEDER) con memorias PDF + un ZIP de mapas que NO incluye GPK por
  niveles canarios.

### 2. OSM Geofabrik canary-islands

- 433 nodos `natural=volcano`.
- 56 ways `geological=volcanic_lava_field` cerrados (malpaíses con
  identidad: Güímar, La Geria, etc.).
- 6 ways `geological=volcanic_lava_flow` cerrados.
- Filtrado a bbox Canarias `(-18.3, 27.4, -13.3, 29.6)`.

### 3. Catálogo erupciones históricas (1430-2021)

Compilado en `ERUPCIONES_HISTORICAS` dentro del script. Fuentes
cruzadas: Becerril 2014, IGN, Volcanes de Canarias (gobcan), Global
Volcanism Program (Smithsonian).

Erupciones cubiertas (15 episodios): Tacande 1430, Garachico 1706,
Tahuya 1585, Martín/Tigalate 1646, San Antonio (Fuencaliente) 1677,
Siete Fuentes/Fasnia/Arafo 1704-05, El Charco 1712, Timanfaya 1730-36,
Chahorra/Narices del Teide 1798, Tao/Tinguatón 1824, Chinyero 1909,
San Juan 1949, Teneguía 1971, Tajogaite/Cumbre Vieja 2021.

## Por qué bounding-boxes y no polígonos finos para PEVOLCA

El extractor materializa las zonas PEVOLCA como **rectángulos** WGS84
encajados sobre cada dorsal/zona reconocida en la literatura científica
(Becerril 2014, Sobradelo & Martí 2015 — referencias usadas por el
propio PEVOLCA). Razones:

1. **No hay polígonos vectoriales oficiales abiertos**. El visor del
   IGN expone WMS raster, no vectores; SITCAN no publica GPK.
2. **Mensaje cívico**: el ciudadano necesita saber "mi barrio cae en
   zona N1/N2/N3", no la línea exacta de un mapa de isoprobabilidades
   que aún está en revisión científica.
3. **Sustitución limpia**: cuando VOLCAN/CSIC publique los polígonos
   oficiales (2026-2027) se sustituye el bloque `ZONAS_PEVOLCA` por
   un fetch a la capa oficial. El **overlay no cambia** — sólo el
   extractor.

Patrón idéntico al que ya usa `extract-zonas-inundables.py` con buffers
sobre líneas ARPSI.

## Lo que FALTA hacer (manual, ~3 líneas)

### 1. Registrar el overlay en `overlays/index.js`

```js
import { peligroVolcanicoOverlay } from "./peligro-volcanico.js";
// ... añadir peligroVolcanicoOverlay al array OVERLAYS

// En META:
"peligro-volcanico": {
  category: "riesgo",
  levels: ["isla", "municipio", "distrito", "barrio", "seccion"],
  hasSubcats: true,
},
```

Orden Z sugerido: justo después de `inundacionOverlay` (otro indicador
RIE-*), antes de pins de educación/eventos. Las coladas y conos del
overlay ya se pintan por encima de las zonas PEVOLCA internamente.

### 2. (Nada que tocar en `app.js`)

El overlay sigue el contrato estándar `load`/`isReady`/`draw` +
`getSubcatOptions`/`setSubcatFilter`. El boot y el render loop ya lo
gestionarán a través del registry de `initOverlays(state)`.

## Diseño del overlay (resumen)

- **Niveles activos**: `isla`, `municipio`, `distrito`, `barrio`,
  `vecindario`, `seccion`. En `isla` sólo se ven zonas PEVOLCA +
  conos históricos (no 412 prehistóricos saturando). En niveles
  inferiores se ve todo el detalle.
- **Paleta**:
  - 5 tonos de rojo PEVOLCA: N1 saturado → N5 pálido (alpha 0.18-0.34).
  - Colada histórica: marrón-rojizo saturado (alpha 0.42).
  - Colada prehistórica: marrón apagado (alpha 0.30).
  - Cono histórico: triángulo rojo brillante + badge año (Georgia).
  - Cono prehistórico: triángulo ladrillo apagado.
- **Sub-chips por nivel PEVOLCA** (1..5) vía `getSubcatOptions` /
  `setSubcatFilter`. Filtran zonas (no coladas/conos).
- **Cluster de conos** por proximidad-pantalla (22 px) — mismo
  patrón que `bic.js` y `memoria-democratica.js`. Si un cluster
  contiene un cono histórico se muestra como histórico (estilo
  brillante + badge).
- **Leyenda flotante bottom-left** (`#peligro-volcanico-legend`),
  inyectada on-demand desde `draw()`. Sólo muestra niveles
  realmente presentes / no filtrados. Sin tocar `index.html`.

## Cómo regenerar el dataset

```bash
# Requiere GEOFABRIK/canary-islands-latest.osm.pbf
python3 /Users/panch/KOINOS-iso/scripts/extract-peligro-volcanico.py
```

Salida esperada:
```
[osm] conos volcano: 433
[osm] coladas (lava fields/flows cerrados): 62
[dedup] conos finales: 397
[hist] conos marcados como históricos: 33
[ok] public/data/peligro-volcanico-canarias.geojson
      485 features · 300.1 KB
      conos: 412  (históricos 33)
      coladas: 62
      zonas PEVOLCA: 11
```

## Importancia cívica

Canarias es archipiélago volcánico ACTIVO. La erupción de Cumbre Vieja
(Tajogaite) 2021 destruyó más de 1.600 viviendas, 370 ha de cultivos
y 73 km de carreteras en La Palma. Antes: Teneguía 1971, Chinyero 1909,
Timanfaya 1730-36 (que sepultó 11 pueblos en Lanzarote).

Este indicador permite al ciudadano:
- Identificar si vive sobre una colada histórica (suelo geológicamente
  reciente, normativa específica de edificación).
- Ver el nivel PEVOLCA de su barrio (N1/N2 implican protocolos de
  evacuación, simulacros, planes municipales obligatorios).
- Aprender qué erupciones documentadas han ocurrido cerca (memoria
  territorial: cada cono histórico lleva su año visible).

Es información que el comprador de vivienda o el padre de familia
necesita **antes** de decidir dónde vivir — análogo al de inundación
(RIE-01) pero para el riesgo más característicamente canario.

## Limitaciones conocidas

- Las zonas PEVOLCA son rectángulos, no polígonos topográficos
  precisos. Hasta que VOLCAN/CSIC publique vectores oficiales.
- Las coladas históricas vienen de OSM y no traen año documentado
  en `name`; el overlay pinta todas en el mismo tono "histórica"
  cuando el atributo `erupcion_anio` está vacío (mayoría).
- El catálogo de erupciones (15 episodios, 1430-2021) cubre toda
  la era documentada subaérea; las erupciones submarinas (El Hierro
  2011-12) no se representan como cono (no hay cono terrestre).
- Sin hit-test/popup expuesto desde el overlay aún — está preparado
  vía `getAllConos()` etc. para que el visor lo enganche cuando
  se integre.
