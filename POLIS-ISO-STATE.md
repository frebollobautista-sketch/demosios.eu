# POLIS · Iso runtime — Estado de trabajo

---

## 🆕 HANDOFF 2026-05-27 (vespertino) — Negocios alimentación + sub-chips multi-capa

### Negocios locales y sub-categorías
- **`overlays/alimentacion.js`** (nuevo): 10.812 negocios extraídos del PBF Geofabrik (`scripts/_extract_negocios_canarias.py`). 11 sub-categorías filtrables: panadería, carnicería, pescadería, frutería, supermercado, ultramarinos, bebidas/bodega, mercado, restaurante, café, bar/pub. Pins rectángulos coloreados con glifo de 2 letras.
- `data/negocios-canarias.geojson` (3.5 MB, total 17.713 negocios — alimentación 10.812 + ropa 1.588 + cuidado 1.233 + hogar 881 + ocio 680 + cultura 265 + otros 2.254).
- Nueva categoría **"Alimentación y comercio"** en CATEGORY_ORDER (entre comunidad y vivienda).

### Sub-chips UI estándar (5 capas activas)
Patrón general en `overlays/index.js` `mountPanel`: si `META[id].subcategorias === true` y el overlay expone `getSubcatOptions()` + `setSubcatFilter(Set)`, se renderiza un row `.lp-subchips` colapsable bajo el toggle principal. Cada chip enciende/apaga su subcategoría, el botón "Todos" resetea.

| Capa | Sub-chips | Total cats |
|---|---|---|
| **Alimentación** | Panadería, Carnicería, Pescadería, Frutería, Supermercado, Ultramarinos, Bebidas, Mercado, Restaurante, Café, Bar | 11 |
| **Parques** | Urbano, Deporte, Agrícola, Forestal, Playa, Cementerio (BUCKETS ya existían) | 6 |
| **Tejido social** | Cooperativa, Asoc. vecinos, Asoc. cultural, Espacio comunitario, Huerto urbano, Centro social, Biblioteca | 7 |
| **Ágora** | Plaza, Jardín, Juego, Equipamiento cívico (KIND_STYLE ya existía) | 4 |
| **Educación** | Infantil/Primaria, Secundaria, FP, Idiomas, Música y Arte, Especial/Adultos (etapa OSM agrupada) | 6 |
| **TOTAL** | | **34** |

CSS dedicado en `style.css` (`.lp-subchips`, `.lp-chip`, `.lp-chip-dot`, `.lp-chip-glyph`, `.lp-chip-all`).

### Cache-bust HEAD nuevos
- `app.js` → `overlays/index.js?v=20260527-subchips`
- `overlays/parques.js?v=20260527-subchips`
- `overlays/tejido-social.js?v=20260527-subchips`
- `overlays/agora.js?v=20260527-subchips`
- `overlays/educacion.js?v=20260527-subchips`
- `overlays/alimentacion.js?v=20260527-alim-v0`

### Próximas extensiones de sub-chips obvias
- **Cultura-venues**: por tipo (teatro, sala concierto, museo, galería, biblioteca, cinema, espacio cultural). Datos ya en `cultura-venues.geojson`, ver `properties.type`.
- **Eventos**: por género (música/teatro/exposición/festival/cinema) + temporal (hoy/semana/mes).
- **Lista-espera**: por especialidad médica (hay 7 hospitales, pero el detalle por especialidad debe estar en el geojson properties).
- **Guaguas**: por operador (Global, TITSA, etc.) cuando se haga el scrape multi-isla.
- **Renta**: chips por umbral (p20/p50/p80) en vez de gradiente continuo (alternativa visual).

### Tareas BLOQUEADAS recurrentes

- **#10 Guaguas multi-isla** — scrape TITSA + GuaguaGlobal + IntercityBus + Transhier.
- **#16 Renta prov 38** — tablas INE 30824/30896/31097 son por municipio; necesita replicar scrape manual del Atlas web para los 672 cusecs prov 38.

---

## HANDOFF 2026-05-27 (matinal) — Optimización + cog menu + AGORA + sub-barrios + tejido v2

### 1. Optimización de carga (-93% boot)
- `osm-{gc,prov38}/roads.json` (38+48 MB) → `roads-main.json` (2.5+3.7 MB). `scripts/_extract_roads_main.py` filtra a motorway/trunk/primary/secondary.
- `barrios-canonical.json` (7.4 MB) → `barrios-canonical-lite.json` (251 KB) sin geometrías. `scripts/_extract_barrios_canonical_lite.py`.
- Boot loads paralelizados con `Promise.all` (antes serie).
- Total boot fresco: ~196 MB potencial → **~14 MB** sin overlays activos.

### 2. Menú Cog (settings) ampliado
- 8 items con separadores. Modal genérico (`#cog-modal`) con backdrop + ESC + X.
- Acciones: Buscar · Registrar · Cuenta (alias localStorage) · Privacidad (clear-storage) · Tema y escala (3 paletas + 3 tamaños, persistido `polis:cog:*`) · Info y créditos (fuentes + versión cache-bust) · ADMIN.
- CSS dedicado en `style.css` con `.cog-modal*` + `[data-cog-theme="papel|tinta"]`.

### 3. Overlay AGORA (espacios físicos)
- Nuevo `overlays/agora.js`. 854 pins triangulares ▲:
  - 542 plazas (osm leisure=park named)
  - 118 jardines
  - 67 playgrounds
  - 127 equipamientos cívicos (community_centre, townhall, library, arts_centre, theatre)
- Categoría "comunidad", niveles isla/municipio/distrito/vecindario/barrio/sección. Solo 156 KB.

### 4. Sub-barrios sintéticos por k-means (2026-05-27)
- 10 barrios `*-mun` con >15 secciones (SC Tenerife 165, La Laguna 108, Arona 33, etc.) divididos en sub-zonas `*-z1`, `*-z2`, ... por k-means de centroides.
- 42 sub-barrios añadidos a `barrios-canonical-lite.json` (504 barrios total, 279 KB).
- `scripts/_split_mun_barrios_kmeans.py` (idempotente, hace backup `*.pre-split.json`).
- Mejora navegación: back desde sección en SC TF cae en una sub-zona de ~20 secs, no en el barrio-mun de 165.

### 5. Tejido social v2 (2026-05-27)
- `data/tejido-social-canarias-v2.geojson` (1.2 MB vs 8 MB v1, -85%).
- Estrategia: entidades con geocode preciso (`ok-native + ok-street`) individuales (3.671); las `ok-municipio[-centroide]` AGRUPADAS por (mun, cat) en 255 cluster-features con `count`.
- Elimina la saturación visual de 2.880 pins falsamente apilados en el centroide de LPGC.
- `scripts/_build_tejido_social_canarias_v2.py`. Para volver a v1 cambiar `DATA_URL` en `overlays/tejido-social.js`.

### 6. Fix loader pegado (2026-05-27)
- Helper `_hideLoader()` añadido a las 4 `enterX` que no lo ocultaban (enterArchipielago, enterIsla, enterDistrito, enterVecindario, enterSeccion). Bug conocido del state doc anterior.

### 7. Deploy preparado (Cloudflare Pages)
- `public/_headers` + `public/_redirects` para CF Pages.
- `.vercelignore` reutilizable.
- `DEPLOY-CLOUDFLARE.md` con 3 métodos (Git, Wrangler CLI, drag&drop).
- Reducción para deploy: 1.5 GB → ~350 MB (excluye backups, `buildings/`, `osm-*/roads.json`, entidades raw).

### Tareas BLOQUEADAS / abiertas

- **#10 Guaguas multi-isla**: scrape TITSA + GuaguaGlobal + IntercityBus. Trabajo grande, no resuelto.
- **#16 Renta prov 38**: las tablas INE 30824/30896/31097 son por municipio, no sección. El `renta-seccion.json` original (698 cusecs prov 35) parece venir de scrape manual del Atlas web. Hay que replicar el manual scrape para los 672 cusecs prov 38.

### Cache-bust HEAD

| Archivo | Versión |
|---|---|
| `polis-app/app.js` | `?v=20260527-paro-v0` (Pancho añadió overlay paro) o `?v=20260527-loader-fix` |
| `polis-app/style.css` | `?v=20260526-cog-v2` |
| `overlays/parques.js` | `?v=20260526-multiisla` |
| `overlays/tejido-social.js` | (sin ?v= explícito en index.js — pasa al servir v2 al refresh) |
| `overlays/agora.js` | `?v=20260526-agora` |

### Archivos nuevos en esta sesión

- `scripts/_extract_roads_main.py`
- `scripts/_extract_barrios_canonical_lite.py`
- `scripts/_build_tejido_social_canarias_v2.py`
- `scripts/_split_mun_barrios_kmeans.py`
- `scripts/fetch-renta-ine-canarias.mjs` (bloqueado, ver task #16)
- `public/data/tejido-social-canarias-v2.geojson`
- `public/data/agora-canarias.geojson`
- `public/data/barrios-canonical-lite.json` (regenerado con sub-barrios)
- `public/osm-gc/roads-main.json` · `public/osm-prov38/roads-main.json`
- `public/_headers` · `public/_redirects` · `.vercelignore` · `vercel.json`
- `DEPLOY-CLOUDFLARE.md`

---

## HANDOFF 2026-05-26 — Vecindario + cross-fade + capas multi-isla

### 1. Nuevo lodLevel `vecindario` (auto-cluster intermedio)

Problema: para muns sin desagregación real de barrios (e.g. SC Tenerife "038-santa-cruz-de-tenerife-mun" con 165 secciones × 21 km bbox), el back desde sección caía en un viewport gigante sin contexto local.

Fix: nuevo nivel `vecindario` que reúne las 12 secciones más cercanas (radio 1.2 km, con fallback a 5 vecinas geográficas si no hay vecinas en el radio) **cruzando límites municipales dentro de la isla**. Cargado peresoazmente con `loadIslaSections(islaId)` cacheado (lee `prov38-secciones-lite.json` o `gc-secciones-lite.json`).

- `state.vecindario` con schema idéntico a `state.district` (reusa `renderDistrito`).
- `enterVecindario(focalCusec)` — `app.js:2611+`.
- `loadIslaSections(islaId)` — cache de centroides por isla.
- `navigateBack` desde sección ahora va a vecindario (fallback a distrito→mun→isla).
- Breadcrumb: `Canarias › Tenerife › SC Tenerife › Vecindario · 12 secciones · 3673 edif`.

Constantes: `VECINDARIO_MAX_N=12`, `VECINDARIO_RADIUS_M=1200`.

### 2. Cross-fade manzanas ↔ edificios en sección

Antes (2026-05-25): manzanas iso unificadas a todo zoom; edificios SOLO al entrar a manzana. Tras el catastro completo (5-10× más edif), perdíamos riqueza informativa.

Ahora: rampa `tDetail = clamp((ratio-3.0)/2.0)`:
- ratio < 3.0: solo manzanas iso (drawSectionLOD)
- 3.0 → 5.0: cross-fade simultáneo manzanas + edificios (drawArchetype con clipping por viewport)
- ratio ≥ 5.0: solo edificios individuales

Roads atenuados en paralelo (alpha 1.0→0.40, width ×1.0→0.55 entre ratio 2.5 y 4.5).

Nueva función `drawSeccionBuildings` proyecta centroide de cada edif, descarta los fuera del canvas (+80 px margin), ordena painter por (x+z) creciente, llama `drawArchetype`. Coste real ~50-200 edif visibles vs 580 totales.

Sin `drawFlatShadow` en edificios — eliminaba el efecto "pedestal flotante" que confundía con buildings "que no llegan al suelo".

### 3. Capas multi-isla

| Capa | Estado |
|---|---|
| **parques** | ✅ Combina `osm-gc/parks.json` (12.881) + `osm-prov38/parks.json` (32.242). Code-only en `overlays/parques.js`. |
| **tejido-social** | ✅ Nuevo `data/tejido-social-canarias.geojson` (25.286 features, 8 MB) generado por `scripts/_build_tejido_social_canarias.py` desde `data/entidades/{isla}.json` (ya geocoded). Antes solo 135 features curados prov 35. |
| **educacion** | ✅ ya cubría toda Canarias (747 features) — sin cambios. |
| **lista-espera** | ✅ ya cubría toda Canarias (7 hospitales) — sin cambios. |
| **cultura-venues** | ✅ ya cubría toda Canarias (691 venues) — sin cambios. |
| **eventos** | ✅ ya cubría toda Canarias (183) — sin cambios. |
| **renta-seccion** | ❌ Solo prov 35 (698 cusecs). Falta scrape INE para 672 cusecs prov 38. |
| **vv-prov35** | ❌ Solo LPGC. Falta scrape Airbnb multi-isla. |
| **guaguas (paradas+líneas+cobertura)** | ❌ Solo LPGC bus urbano. Pendiente: GTFS/scrape TITSA (TF) + GuaguaGlobal (GC interurbano) + IntercityBus (FV/LZ) + Transhier (EH). Task #10 en backlog. |
| **productores** | ❌ Solo prov 35. Falta scrape prov 38. |

### Cache-bust versions activas (HEAD)

| Archivo | Versión |
|---|---|
| `polis-app/app.js` | `?v=20260526-vecindario-d` |
| `polis-app/renderer.js` | `?v=20260526-vecindario-d` (vía import en app.js) |
| `polis-app/overlays/index.js` | `?v=20260526-multiisla` |
| `polis-app/overlays/parques.js` | `?v=20260526-multiisla` |
| `polis-app/overlays/tejido-social.js` | `?v=20260526-multiisla` |

### Archivos nuevos en esta sesión

- `scripts/_build_tejido_social_canarias.py`
- `public/data/tejido-social-canarias.geojson` (25.286 features)
- `POLIS-ISO-STATE.md` actualizado

---

## HANDOFF 2026-05-24 — Bugs de datos catastro + coastline

Resuelto en esta sesión (2 bugs y los 28 packs faltantes):

### Bug 1 · `sections_pack/{cusec}/buildings.geojson` desactualizado

Tras la última tanda de catastro INSPIRE (2026-05-23), los `public/buildings/{cusec}.json` quedaron muy enriquecidos (321 688 → ~1 470 000 edif totales) pero los `sections_pack/{cusec}/buildings.geojson` seguían apuntando al pipeline anterior — 79 edif vs 619 reales en SC Tenerife centro, 440 vs 1413 en Vegueta.

**Fix:** re-packeo completo de 1 381 secciones con `python3 -m packages.pack.batch` usando los nuevos `buildings/{cusec}.json` como fuente:

- prov 35 (gc/fv/lz, 709 cusecs) → `osm-gc/` (que cubre toda prov 35 a pesar del nombre)
- prov 38 (tf/lp/lg/eh, 672 cusecs) → `osm-prov38/`

Wrapper en `scripts/_repack_sections_buildings.py` — usa `--prov 35|38` y resuelve el bug latente de `ISLA_MUNS` (mun "013" existe en gc Y eh, hay que filtrar por prov además).

Preview render stubeado a 1×1px para acelerar (~10× más rápido); para regenerar contact_sheet puede ejecutarse luego `batch.py --skip-existing` (recorre solo los que no tienen preview detallado).

4 cusecs prov 38 fallaron con `GEOSException` en `extract_manzanas` por topología inválida tras `unary_union`: `3801701018`, `3802202002`, `3803103005`, `3803601002`. Recuperados con `scripts/_retry_failed_packs.py` que reemplaza `extract_manzanas` por una versión que valida cada polígono buffered antes de hacer unión, recupera tras `unary_union` fallido haciendo union-por-pares con `_repair_geom` entre cada par, y blinda `mz.contains(centroid)` con try/except.

Conteos finales (sample):
| cusec | antes | después | json source |
|---|---:|---:|---:|
| 3803803001 (SC Tenerife) | 79 | 580 | 619 |
| 3803803010 | 40 | 526 | 526 |
| 3804801001 (Valverde) | 387 | 2 279 | 2 281 |
| 3501601003 (Vegueta) | 440 | 1 396 | 1 413 |
| 3500301001 (FV sample) | 951 | 2 532 | 2 546 |
| 3502801001 (Yaiza LZ) | 387 | 1 320 | 1 328 |

Cobertura final: **1 381/1 381 packs** (los 28 que faltaban se generan automáticamente desde la nueva fuente catastro).

**Backup**: `public/sections_pack_backup_2026_05_24/` (hardlinks, ~0 B de disco extra). Borrable cuando se valide la regresión.

### Bug 2 · Coastline solo para GC

El gate `state.isla.id === "gc"` en `renderer.js` (renderIsla) impedía cargar el coastline para el resto de islas. **No hacía falta generar archivos nuevos** — `osm-gc/coastline.json` ya cubre TODA prov 35 (lng -16.20 a -13.33; 658 features GC+FV+LZ), y `osm-prov38/coastline.json` ya cubre prov 38 (850 features TF+LP+LG+EH).

**Fix:** mapping `COASTLINE_SRC` por isla.id en renderer.js (línea ~436):
```
gc/fv/lz → osm-gc/coastline.json
tf/lp/lg/eh → osm-prov38/coastline.json
```

Como cada archivo cubre varias islas, añadido filtro por bbox de la isla (con PAD=5 km) en JS para descartar segmentos de las otras islas. Confirmado en preview: TF (431 líneas), LP (82 líneas), FV (121 manualmente verificadas). Cache-bust: `renderer.js?v=20260524-coastline-all`, `app.js?v=20260524-coastline-all`.

### Archivos tocados

- `public/polis-app/renderer.js` (renderIsla coastline block)
- `public/polis-app/app.js` (import cache-bust)
- `public/polis-app/index.html` (script cache-bust)
- `scripts/_repack_sections_buildings.py` (nuevo, wrapper batch por prov)
- `scripts/_retry_failed_packs.py` (nuevo, retry con make_valid agresivo)
- `public/sections_pack/{1381 cusecs}/` (todos los packs regenerados)
- `public/sections_pack_backup_2026_05_24/` (backup hardlinks, no commiteable)

### Pendientes nuevos detectados

- **`ISLA_MUNS` en `packages/pack/batch.py`**: el filtro `--isla eh` selecciona mun "013" en GC también (mismo código existe en ambas provs). El wrapper `_repack_sections_buildings.py` lo corrige filtrando por prefijo de cusec. Considerar parchear el script base.
- **Contact sheet desactualizado**: los previews son placeholders 1×1; correr `python3 -m packages.pack.batch --isla X --skip-existing` para regenerar previews y `contact_sheet.png` por isla cuando interese.
- El `_lz` (mun 028 = Yaiza) y las muns no-GC ahora tienen catastro detallado pero `ENTRY_ZOOM` / labels podrían necesitar tweaks específicos.

---

## HANDOFF 2026-05-21 — Migración de chat

Esta sección concentra el estado al cierre del chat largo. Las secciones de
abajo (2026-05-11/13/19) siguen siendo válidas como referencia histórica,
pero **prevalece lo que aparece aquí cuando hay contradicción**.

### Estado de cobertura territorial (todo Canarias)

| Pieza | Cifra | Notas |
|---|---|---|
| Islas con datos cargados | **7/7** | GC, TF, LP, LG, EH, LZ, FV |
| Secciones censales packed | **1 353** de 1 381 (97,9%) | Combinado prov 35 + 38 |
| Edificios extraídos OSM | **321 688** | 88,4 % con altura real; 9,8 % con categoría OSM |
| Barrios canónicos | **462** | OSM `place=*` + sintéticos para muns rurales + huérfanos rellenados |
| Muns con polígono suavizado | **88/88** | `_build_canarias_geo.py` con buffer±0.0008 |
| Islas con polígono suavizado | **7/7** | jigsaw con buffer±0.002 |
| Eventos culturales pin | **109** | Solo agenda Cabildo GC. Resto islas = 0 (TODO scrape) |

Archivos de datos generados nuevos en esta sesión:
- `public/canarias-secciones-lite.json` — 1 381 secciones combinadas
- `public/canarias-islands-poly.json` — 7 islas con bordes suavizados
- `public/canarias-municipios-poly.json` — 88 muns suavizados
- `public/data/barrios-canonical.json` — 462 barrios (era 202 prov 35)
- `public/osm-prov38/` — paquete OSM extraído para Tenerife/LP/LG/EH

### Cache-bust versions activas (HEAD)

| Archivo | Versión | Última edición lógica |
|---|---|---|
| `polis-app/index.html` | n/a | imports actualizados manualmente |
| `polis-app/app.js` | `?v=20260523-lodA-ramp` | [A] tap-distrito zoom target 5→4.2, anim 600→850ms |
| `polis-app/renderer.js` | `?v=20260523-lodA-ramp` | [A] sub-rampa bldFootprintK + bldHeightK en renderDistrito |
| `polis-app/overlays/eventos.js` | `?v=20260521d` | hit-test extendido + bbox barrio/manzana |
| `polis-app/overlays/index.js` | `?v=20260521c` | `eventos` en TODOS los niveles |
| `polis-app/style.css` | `?v=20260519f` | sin cambios desde la sesión previa |

**Regla**: si tocas un módulo, sube la letra final (`a→b→c…`) en TODAS
las referencias `<script type="module">` o `import` con cache-bust. El
navegador cachea agresivamente módulos servidos por preview.

### Fixes que aterrizaron en esta sesión

1. **Jigsaw smoothing** — antes los polígonos tenían "pinchos crispados".
   `scripts/_build_canarias_geo.py` aplica `geom.buffer(d).buffer(-d)` con
   d=0.0008 (muns) y d=0.002 (islas).
2. **Terciles con contraste** — los muns en nivel isla ya no quedan
   invisibles. Paleta nueva en `renderer.js` (renderArchipielago, renderIsla).
3. **Eventos en todos los niveles** — `META.eventos.levels` ahora incluye
   `["archipielago", "isla", "municipio", "distrito", "barrio", "manzana", "seccion"]`.
   `draw()` y `hitTest()` derivan bbox para barrio/manzana también.
4. **Pin hit-test extendido** — antes solo se tappeaba el círculo (14 px
   radio sobre el ancla). Ahora cubre el pin entero (±18 px W × 38 px
   arriba × 6 px abajo). Ver `eventos.js:194-217`.
5. **Long-press tour-de-mun retirado** — el handler bloqueaba navegación
   ocasional con `_lpFired = true`. Eliminado entero.
6. **Body display:none accidental** — un eval anterior dejaba el body
   oculto. Documentado por si reaparece (`document.body.style.display = ''`).

### 🚧 Pending priorizado (próxima sesión)

**Prioridad 1 — el botón Cultura del right-strip debe encender eventos**
> Petición explícita del usuario al cerrar el chat: *"que los eventos
> culturales se vean con un toggle de alguna manera incorporado a los
> botones de la derecha"*.

Hoy el right-strip (8 botones de categoría: Identidad, Comunidad,
Vivienda, Patrimonio, Cultura, Movilidad, Equipamientos, Desigualdades)
abre popovers placeholder con "próximamente". Hay que cablear, mínimo,
que el botón **Cultura** active/desactive el overlay `eventos` (ya
implementado y testeado) — toggle real, no popover dummy.

Implementación recomendada:
- Sub-agente que mapee `right-strip → setOverlayActive`.
- `Cultura` → `setOverlayActive(state, "eventos", on)` + estado visual
  del botón (active/inactive).
- Bonus: mismo patrón para los otros 7 botones (renta→Vivienda,
  guaguas+cobertura→Movilidad, etc.) — uno por categoría.
- El panel `#layer-panel` existente sigue funcionando como modo "avanzado".

**Prioridad 2 — Switcher 3 modos right-strip**
Diseño aparcado (Acción / Filtros / Visiones), con la idea de gamificar
retos cívicos. Sub-agente ya tiene brief preparado. Esperar a P1.

**Prioridad 3 — Tablero datos canonical reales en popovers**
Sustituir "próximamente" por datos reales de `barrios-canonical.json`
(edificios, hogares, renta_media_ponderada, vivienda_vacacional,
paradas_guaguas, centros_educativos).

**Prioridad 4 — Panel ficha al tap manzana**
Visión "Google Maps cívico": catálogo de POIs + edificios prominentes
+ métricas locales. Hoy `enterManzana` renderiza geometría pero no abre
ficha.

**Prioridad 5 — Cluster tap → modal lista de eventos**
Hoy un tap sobre cluster abre solo el evento más cercano. Si el cluster
agrupa N>1 eventos debería abrir un modal con lista.

**Prioridad 6 — Entidades tercer sector como pins**
Datos ya en `public/data/entidades/` (geocoder Etapa 2). Falta overlay
`tejido-social` con render real (hoy es stub).

**Prioridad 7 — Deploy Vercel**
El usuario advierte que es el último mes con suscripción. Plan original
contemplaba deploy a Vercel en Semana 1 para que sobreviva al fin de
sesión Claude. Setup: `vercel.json` o repo standalone con redirect a
KOINOS Next.js.

**Pending técnico de menor prioridad**:
- Eventos para TF/LP/LG/LZ/EH (0 eventos hoy fuera de GC, scrape pendiente)
- Re-run extractor GC para subir levels de 61% a 100% (`_pbf_to_buildings_prov35.py`)
- Catastro INSPIRE descargado solo para LPGC; ampliar mejoraría 9.8%→? en categoría
- Curación rural más granular (Tejeda/Artenara/Vega de San Mateo con `place=hamlet|locality|isolated_dwelling`)
- Bug splash `#loader` colgando ocasionalmente en transición programática
- Banner-sub stale durante `enterManzana` programático
- Breadcrumb "Telde › Telde" duplicado cuando mun y barrio comparten nombre
- URL routing: `?isla=tf` no procesa tras navegación in-page

### Cómo retomar en la próxima sesión

1. Lee este bloque (HANDOFF 2026-05-21). Las secciones inferiores son
   historia, leerlas solo si chocan con algo.
2. Revisa `MEMORY.md` para paths persistentes.
3. Arranca preview: `preview_start({ name: "polis-iso" })`.
4. Para el cableado Cultura→eventos: sub-agente con brief autocontenido
   que toque `app.js` (donde se inicializa el right-strip) y conecte con
   `setOverlayActive(state, "eventos", …)` de `overlays/index.js`.
5. Cualquier cambio en módulos → subir letra de cache-bust en TODAS las
   referencias (ver tabla arriba).

### Lecciones operativas (para futuras sesiones largas)

- **Sub-agentes con sandbox no pueden ejecutar `python3` ni `curl`.** Lanzo
  yo el script en background; el sub-agente solo lee, escribe y razona.
- **Cache de navegador es agresivo.** Cada edit de módulo necesita bump
  de versión, si no la nueva versión no se evalúa.
- **`preview_start` muere al rotar la sesión.** Si `preview_eval` reporta
  `window.polisApp === undefined`, relanzar polis-iso (puerto 8123).
- **Memoria persistente entre chats** vía MEMORY.md + esta nota. Sigue
  esa convención.

---

> **2026-05-19** · Pendiente curación de barrios rurales: la extracción
> OSM `place=*` actual filtra `suburb/neighbourhood/quarter/hamlet/village/town/city_block/locality`
> y luego descarta hamlets/neighbourhoods con 1 sec + localities (ver
> `data/_extract_osm_barrios.py` y `_fill_orphan_sections.py`).
> Para muns rurales (Tejeda, Artenara, Vega de San Mateo, etc.) hoy queda
> 1 barrio sintético = nombre del mun. El usuario pidió **granularidad
> mayor en rural**: catalogar trozos del territorio por nombres
> históricos/conocidos aunque no estén poblados ("zonas" más que "barrios").
> Acción próxima: re-extraer del PBF con filtro más laxo que incluya
> `hamlet` (incluso con 1 sec) + `place=isolated_dwelling` + nombres
> de cordillera/valle/playa cuando existan; o curación manual por mun
> usando IDECanarias.


> Doc de handoff para sesiones futuras de Claude. Lee esto primero. Captura
> exactamente dónde está el trabajo, qué decide cada cosa, y qué falta.
> Última actualización: 2026-05-13.

> **2026-05-13** · El runtime iso ya consume `data/barrios-canonical.json`
> (164 barrios OSM agregados prov 35) en lugar del antiguo `barrios-gc.json`
> (34 barrios curados solo LPGC). Tocan `app.js` (`loadBarriosGc`, boot
> deep-link `?barrio=`) y `overlays/barrios.js` (DATA_URL + normalización
> `secciones_origen` → `sections`). IDs migrados de `lpgc-vegueta` →
> `016-vegueta`; URLs viejas `?barrio=lpgc-XXX` siguen funcionando vía
> alias backward-compat en boot. Schema canonical incluye `datos{}`,
> `geometria`, `centroide`, `place_type`, pero el runtime aún no los
> consume — disponibles para futuras capas/popups.

## Localización

- **Worktree iso**: `/Users/panch/KOINOS-iso/` (rama `polis-app-runtime`)
- **Repo main**: `/Users/panch/KOINOS/` (rama `main`, tiene merge a medio resolver sin tocar)
- **Server config**: `/Users/panch/mnemoHACK/.claude/launch.json`
  - `polis-iso` → puerto **8123**, sirve `/Users/panch/KOINOS-iso/public/`
  - `polis` → puerto **8092**, sirve `/Users/panch/KOINOS/public/` (visor canónico)
- **URLs**:
  - Iso runtime: http://127.0.0.1:8123/polis-app/
  - Visor canónico: http://127.0.0.1:8092/polis-provincia.html

## Arrancar el preview

```bash
# desde Claude Code en /Users/panch/mnemoHACK:
preview_start({ name: "polis-iso" })
# o
preview_start({ name: "polis" })
```

**Importante**: los servidores `preview_start` mueren al rotar la sesión (cambio de día / cierre de Claude Code). Si una nueva sesión hace `preview_eval` antes de `preview_start`, encontrará el preview en `localhost:8090` (mnemoHACK por defecto) y `window.polisApp === undefined`. Siempre relanzar `polis-iso` al arrancar.

## Decisión arquitectural

**Plan elegido (mayo 2026):** portar las capas cívicas desde
`polis-provincia.html` (canónico, ya validado con datos reales) al runtime
iso, una a una, usando sub-agentes. La iso es drill-down jerárquico
(isla→municipio→distrito→sección); el canónico es MapLibre con tiles
satélite y todas las capas como toggle. Coexisten hasta que la iso
alcance paridad.

**Lo rechazado**: 
- Integrar iso como ruta Next.js dentro de `src/app/` (KOINOS) — descartado
  porque cargaría demasiado contexto Next.js+Supabase en cada sesión.
- Tratar iso como prototipo pausado — el usuario quiere paridad.

## Symlinks en el worktree iso (NO commiteables, en .gitignore)

Recrear si el worktree se borra:

```bash
ln -s /Users/panch/KOINOS/public/osm-gc /Users/panch/KOINOS-iso/public/osm-gc
cd /Users/panch/KOINOS-iso/public/sections_pack
for dir in /Users/panch/KOINOS/public/sections_pack/*/; do
  name=$(basename "$dir")
  if [[ "$name" =~ ^350[0-9]{2} ]] && [[ ! "$name" =~ ^35016 ]] && [[ ! -e "$name" ]]; then
    ln -s "$dir" "$name"
  fi
done
```

Resultado: 562/562 secciones GC + capas OSM disponibles para la iso.

## Estado actual de la iso runtime

### Funciona
- 4 niveles drill-down (isla → municipio → distrito → sección)
- 562 secciones GC cargables vía `?cusec=`, `?mun=` o `?level=distrito&distrito_id=`
- Lazy loading por nivel verificado (red real, no preload)
- API `window.polisApp.setIndicators(partial)` reactivo
- HUD de 3 filas (`zone-recovered`, `realtime-events`, `realtime-portals`)

### Gaps vs polis-provincia.html
| Aspecto | iso | canónico |
|---|---|---|
| Buildings en isla/municipio | ❌ solo contornos | ✅ fill-extrusion a cualquier zoom |
| Capas cívicas activables | ✅ 7 (renta, vv, parques, cobertura, guaguas, educación, listas-espera) | ✅ 12 |
| Renta coropleta por sección | ✅ `overlays/renta.js` | ✅ `toggleRenta` |
| BIC patrimonio | ❌ bloqueado (WMS) | ✅ `toggleBIC` (WMS) |
| Guaguas | ✅ `overlays/guaguas.js` + `cobertura.js` | ✅ paradas + líneas + cobertura |

### Hardcoded a quitar antes de paridad
- Card "Concierto OFGC · Mahler · Hoy · 20:30" — `renderer.js` (TODO: eliminar hasta que haya `events.geojson` v2)
- HUD label "recuperado" usa `calibrated_pct || zone.discovered_pct` con
  fallback OR confuso — `renderer.js:184`

## Contrato `setIndicators` (runtime iso v1.5.3)

```js
window.polisApp.setIndicators({
  zone:     { discovered_pct, identified_pct, calibrated_pct, total_buildings },
  user:     { badges_count, materials_found, last_calibration_at },
  realtime: { events_live, registered_residents }
});
```

Deep-merge sobre `state.indicators`, dispara `requestRender` → rAF →
`renderHud` → DOM. Implementación en `public/polis-app/app.js:1421-1438`.
Lectura: `window.polisApp.getIndicators()`. HUD se repinta solo si cambia
el valor textual (no fragmenta layout).

## Inventario de capas para portar

Cada fila es un brief autocontenido para un sub-agente. Refs son
`polis-provincia.html` líneas en `/Users/panch/KOINOS/public/`.

### Capas con datos por sección/municipio (JSON plano, directos)

| ID | Categoría | Datos | Schema | Toggle | Status iso |
|---|---|---|---|---|---|
| `renta` | Vivienda y turismo | `data/renta-seccion.json` | `{cusec: {renta, hogar}}` | `toggleRenta` line 696 | ✅ `overlays/renta.js` — coropleta cuantil p20/p50/p80, municipio+distrito |
| `vv-stats` | Vivienda y turismo | `data/vv-municipio-stats.json` | `{nombre: {count, plazas}}` | parte de `toggleVV` line 864 | ✅ integrado en `overlays/vv.js` (burbuja por mun a isla/municipio) |
| `edu-stats` | Equipamientos | `data/centros-educativos-stats.json` | `{NMUN: stats}` | parte de `toggleEducacion` line 1524 | ✅ integrado en `overlays/educacion.js` (burbuja por mun a nivel isla) |

### Capas con datos vectoriales (geojson, necesitan point-in-polygon o render directo)

| ID | Categoría | Datos | Tipo geom | Toggle | Notas |
|---|---|---|---|---|---|
| `vv` | Vivienda y turismo | `data/vv-prov35.geojson` | Point clusters | `toggleVV` line 864 | ✅ `overlays/vv.js` — grid-cluster a nivel bajo, burbuja por mun a nivel alto |
| `bic` | Patrimonio | WMS GRAFCAN | tiles | `toggleBIC` line 2164 | ❌ WMS bloqueado |
| `guaguas` | Movilidad | `data/guaguas-paradas.geojson` + `data/guaguas-lineas.geojson` | Point + LineString | `toggleGuaguas` line 1624 | ✅ `overlays/guaguas.js` — 848 paradas + 47 líneas, color oficial por línea |
| `cobertura` | Movilidad | `data/guaguas-cobertura.geojson` | Polygon | `toggleCoberturaBus` line 1696 | ✅ `overlays/cobertura.js` — Multi/Polygon, holes descartados |
| `educacion` | Equipamientos | `data/centros-educativos-prov35.geojson` | Point | `toggleEducacion` line 1524 | ✅ `overlays/educacion.js` — color por titularidad + burbuja agregada a isla |
| `salud` | Equipamientos | WMS GRAFCAN | tiles | `toggleSalud` line 1886 | ❌ WMS bloqueado |
| `lista-espera` | Desigualdades | `data/lista-espera-scs.geojson` | Point hospital | `toggleListasEspera` line 2077 | ✅ `overlays/lista-espera.js` — cruz médica por hospital, color por nº pacientes |
| `aire` | Medio ambiente | WMS GRAFCAN | tiles | `toggleAire` line 1767 | ❌ WMS bloqueado |
| `pq-*` | Espacios verdes | `osm-gc/parks.json` (`properties.type`) | Polygon | `togglePqUrbano` … `togglePqCementerio` | ✅ `overlays/parques.js` — 1 capa con 6 buckets (urbano/deporte/agrícola/forestal/playa/cementerio) |

### Capas WMS (bloqueadas)

`aire`, `salud`, `bic` consumen tiles WMS de GRAFCAN — son imágenes, no
datos. Para que aparezcan como indicador numérico en iso hay que
encontrar el WFS equivalente o scrape. **No empezar por aquí.**

### Catálogo completo de UI (LAYER_CATALOG)

Definido en `polis-provincia.html:1290-1325`. 8 categorías:
- Vivienda y turismo (2 capas)
- Patrimonio y cultura (1 + 1 soon)
- Movilidad y transporte (2)
- Demografía (0, ambas soon)
- Equipamientos (2)
- Desigualdades cívicas (1)
- Medio ambiente (1)
- Espacios verdes (6 subtipos)

## Bugs y observaciones a confirmar

1. **Banner cuenta secciones mal a nivel municipio.** En Telde (`?mun=026`)
   el banner dice "67 secciones · 6 distritos" pero el manifest reporta
   55. Discrepancia entre `gc-secciones-lite.json` (INE) y secciones
   realmente packed. No bloquea pero confunde.

2. **HUD timing.** `setIndicators` actualiza state inmediatamente pero el
   DOM solo se ve actualizado después de `requestAnimationFrame`. Al
   testear, esperar 2× rAF antes de leer `innerText`.

3. **URL `?mun=NNN` puede no resetear bien estado anterior.** Inicialmente
   en mi sesión cargué con cusec previo retenido. Comportamiento normal de
   `history.replaceState` pero conviene confirmar al portar.

## Arquitectura de la iso (resumen, no leer si solo vas a portar 1 capa)

```
public/polis-app/
├── index.html      Markup canvas + HUD + breadcrumb + zoom bar
├── style.css
├── app.js          Orquestador, URL routing, state.indicators
├── iso.js          Proyección + fitView + point-in-polygon
├── renderer.js     render(ctx, state) → render{Isla,Municipio,Distrito,Seccion}
├── archetypes.js   Catálogo de piezas para nivel sección (zoom in)
├── clustering.js   Painter's algorithm
└── interaction.js  Pan/zoom/tap/swipe
```

**Punto natural de extensión para capas cívicas**: añadir un módulo
`overlays.js` que cargue/cachee/dibuje capas opcionales por encima del
render base. Llamado desde `render()` después de `renderSeccion` /
`renderDistrito`. Cada capa: `{load(), draw(ctx, view), bbox()}`.

## Cómo retomar (futuras sesiones)

1. Lee este archivo entero. ~5 minutos.
2. Lee `MEMORY.md` para refs persistentes (worktree paths, etc).
3. NO recargues toda la conversación previa — basta este doc + memorias.
4. Para portar una capa: invoca `Agent` (subagent_type: general-purpose)
   con un brief sacado de la tabla "Inventario de capas". El sub-agente
   lee la sección relevante de `polis-provincia.html`, redacta el módulo
   nuevo en `public/polis-app/overlays/<id>.js`, devuelve diff.
5. Tras aplicar, prueba en preview (`polis-iso`) y actualiza el status
   de la tabla en este archivo.

## Archivos modificados durante setup inicial (commit-listos si quieres)

- `/Users/panch/mnemoHACK/.claude/launch.json` — añadido server `polis-iso`
- `/Users/panch/KOINOS-iso/POLIS-ISO-STATE.md` — este archivo

## Modelo de niveles confirmado (2026-05-13)

**4 niveles visibles al usuario** + scaffolding de datos invisible:

| # | Nivel visible | Qué muestra | Tap | Status iso |
|---|---|---|---|---|
| 1 | **Isla** | 21 muns de GC con nombre | tap mun | ✅ existe |
| 2 | **Municipio** | piezas-barrio nombradas (no secciones) | tap barrio | ❌ hoy muestra secciones; cambiar |
| 3 | **Barrio** | manzanas iso del barrio | tap manzana | ⚠️ existe vía URL, pero renderiza edificios — debe agruparse en manzanas tappables |
| 4 | **Manzana** | edificios grandes de la manzana | tap edificio | ❌ no existe — añadir |
| 5 (modal) | **Edificio focal** | un edificio + tarjeta de evento | placer evento | ❌ no existe |

**Scaffolding invisible** (existe en datos, no en UI):
- `distrito` (cusec dígitos 6-7) — solo administrativo. Mantener accesible por URL para debug pero quitar del breadcrumb principal.
- `sección` (cusec 10 díg) — unidad de join INE. Agregada al barrio que la contiene vía `barrios-gc.json`. **El usuario nunca ve un cusec.**

**Razón del cambio respecto a la jerarquía anterior**:
- Las secciones censales son unidades por población (~1000-2500 hab.), sin nombre ni historia compartida → no sirven para generar comunidad.
- Los barrios sí: tienen nombre, memoria, identidad ("soy de Vegueta" vs "soy de la 3501601003").
- En móvil, los edificios individuales son demasiado pequeños para tap fiable → necesitamos manzana como unidad táctil intermedia.

**Roadmap de implementación** (en orden de bloqueo):

1. **Phase 2a — Tap-target municipio → barrio** (desbloquea navegación, antes solo URL)
   - El nivel mun deja de mostrar 274 secciones y muestra 34 piezas-barrio nombradas (LPGC)
   - Tap pieza-barrio → `enterBarrio`
   - Distrito sigue accesible por URL `?level=distrito` para debug, no aparece en breadcrumb
   - ~150 LOC, sub-agente self-contained

2. **Phase 2b — Manzana como nivel navegable**
   - Dentro del barrio, las manzanas se agrupan como piezas tappables (~50-100 px en móvil)
   - Tap manzana → `enterManzana` con zoom de entrada cerrado
   - Manzana renderiza edificios grandes individualizados
   - `ENTRY_ZOOM.manzana = 3.0` aprox.

3. **Phase 2c — Edificio focal modal**
   - Tap edificio dentro de manzana → modal con tarjeta del edificio
   - En esa tarjeta: botón "ubicar evento aquí" → activa flujo agenda

4. **Phase 3 — Agenda (overlay eventos)**
   - Cuando 2c esté, el placer de eventos vive aquí. Ver `docs/AGENDA-INTERACCIONES.md`.

## Visión de producto: POLIS como agenda viva

POLIS no termina en visor cívico. La siguiente capa es **agenda cultural / social
proyectada sobre los barrios**: eventos, encuentros, quedadas, memoria, coros,
mercado local, alianzas inter-barrios. Heredera de FEED (público lineal) y
TOUCH (íntimo conversacional), con el mapa de barrios como plano espacial.

Lista completa de interacciones diseñadas (10 categorías + orden de implementación):
[`docs/AGENDA-INTERACCIONES.md`](docs/AGENDA-INTERACCIONES.md). Es banco de
ideas para iterar, no plan inmediato.

## Decisión conceptual mayor (2026-05-11) — Jerarquía identitaria

**Dos jerarquías paralelas**, no una sola:
- **Administrativa** (existente): isla → municipio → distrito → cusec — para joins de datos
- **Identitaria** (en construcción): isla → municipio → **barrio** → cusec — para que la gente reconozca el territorio (Vegueta, La Isleta, Tarahales)

La razón: la sección censal no significa nada emocionalmente; el barrio sí. La gamificación (competición amistosa inter-barrios) descansa sobre esto. Los datos brutos no cambian — siguen indexados por cusec. Solo se añade `data/barrios-gc.json` como tabla `barrio → [cusecs]`. Cualquier overlay existente (renta, vv, guaguas…) puede agregarse por barrio sumando/promediando.

### Estado del soporte de barrios

| Pieza | Status |
|---|---|
| `data/barrios-gc.json` LPGC | ✅ 34 barrios, 274/274 secciones (sub-agente 2026-05-11) |
| Resto de GC (20 muns) | ❌ pendiente — usar mismo build script con anchors o OSM `place=suburb` |
| Render del nivel `barrio` en iso | ✅ 2026-05-11 — `renderBarrio` proxy a `renderDistrito`, `enterBarrio()` análogo a `enterDistrito`. Probado Vegueta (4 secs, 964 edif) + La Isleta (21 secs, 3365 edif). |
| Zoom de entrada al barrio | ✅ `ENTRY_ZOOM.barrio = 1.8` (vs 1.05 distrito). Edificios individualizados desde la entrada. |
| Breadcrumb barrio + ?barrio= URL | ✅ `?barrio=lpgc-vegueta` deep-link funciona. Breadcrumb "Gran Canaria › LPGC › Vegueta" sin distrito intermedio. |
| Overlay renta sobre barrios | ✅ verificado con renta — coropleta pinta las secciones del barrio. Patrón replicable para otros overlays (añadir `"barrio"` a `META.<id>.levels` + caso en `draw`). |
| Tap-target municipio → barrio | ❌ pendiente Phase 2 — actualmente sólo URL deep-link, tap en mun sigue yendo a distrito |
| Slide horizontal entre barrios vecinos | ❌ pendiente Phase 2 |
| Otros overlays aprendiendo "barrio" | ❌ pendiente — replicar el patrón renta en `vv`, `guaguas`, `parques`, etc. |

### Cosméticos / bugs menores tras el port

- **Banner duplicado**: el texto del banner aparece arriba (top bar) Y dentro del breadcrumb area (donde antes estaba el dist-label). Causa: `barrio-label` se añadió como elemento paralelo a `dist-label` y se setea con el mismo texto. Revisar si se quiere fusionar.
- **Breadcrumb truncado**: "Gran Canaria" se corta a "Gran Cana..." cuando hay 3 niveles + barrio largo ("La Isleta", "Los Tarahales"). Probable solución: shrink en el segmento de isla o ellipsis controlada.
- **Lupa top-right**: aparece un icono de lupa nuevo cuando entras a barrio. No probada su función — verificar si es UI existente que solo aparece a este nivel o si la añadió el sub-agente.

### Bug detectado durante la curación

`DISTRITO_NICKS` en `app.js:998-1004` etiqueta distritos LPGC con barrios que **no coinciden con la geometría INE real** (La Isleta en distrito 03 no 02; Tafira en 05; Jinámar en 01 no 05). Reemplazar al integrar el render.

## Lo que NO se ha hecho

- WMS bloqueadas: `bic`, `salud`, `aire` — pendientes de endpoint WFS o scrape.
- Cero commits creados en la rama iso (los archivos del port están listos).
- El bug del Mahler hardcoded y el HUD "recuperado" siguen ahí.

### 🔴 BLOQUEO PRIORITARIO: navegación interactiva a barrios

El nivel `barrio` tiene render, datos y deep-link funcionales (ver tabla
de estado más arriba). **Lo que falta es el flow de navegación
interactiva desde el mapa** — el barrio es la capa más rica para
ofrecer "skins" identitarios y donde la gente se reconoce, pero
actualmente solo se llega vía URL `?barrio=lpgc-vegueta`.

Trabajo pendiente concreto:

1. **Tap-target municipio → barrio**. En `handleTap` a nivel municipio,
   el tap sobre una sección lleva a `enterDistrito` (jerarquía
   administrativa). Decisión a tomar: ¿reemplazamos por `enterBarrio`
   (jerarquía identitaria) cuando el cusec está mapeado a un barrio?
   ¿O abrimos un selector intermedio "ver por distrito / por barrio"?
2. **Slide horizontal entre barrios vecinos** análogo al actual
   `slideToDistritoNeighbor`. Requiere `barrio.neighborBarrios` calculado
   al cargar el barrio (intersección de bboxes o nº de secciones
   colindantes).
3. **Resto de GC (20 muns)**: solo LPGC tiene `barrios-gc.json` con 34
   barrios y 274/274 secciones mapeadas. Para el resto se necesita
   correr un script con anchors locales o `place=suburb` de OSM.
4. **Otros overlays sobre barrio**: por ahora solo `renta` sabe pintar
   a nivel barrio. Replicar el patrón en `vv`, `guaguas`, `parques`,
   `eventos`, `productores`, `tejido-social`.
5. **Skins por barrio** (visión más amplia): cada barrio debería tener
   su paleta, glifo y "carácter" — Vegueta no se ve igual que La
   Isleta. Esto necesita un campo `skin` en `barrios-gc.json` y
   variaciones en el renderer.

Este bloque se ha delegado al chat **NAVEGACION** —
ver [`docs/HANDOFF-NAVEGACION.md`](docs/HANDOFF-NAVEGACION.md) para el
brief autocontenido.

## Caveats post-port a auditar

- **bbox de sección**: el campo real es `state.section._bbox` (underscore).
  Algunos overlays (cobertura, guaguas, lista-espera) asumieron `state.section.bbox`
  o `_localBbox` y caen al "no filtrar" como fallback. Funcional pero
  iteran todos los features a nivel sección. Auditar si la perf importa.
- **Detección LPGC en `cobertura.js`**: heurística sobre `cod/code/id/cmun/cumun`.
  El contrato real es `state.municipio.mun === "016"`. Ajustar si la capa
  pinta/no pinta cuando no debería.
- **VV markers a nivel isla**: render confirmado (20 arcs/frame = 20 muns).
  Contraste bajo con paleta ocre — el marrón del marker se mimetiza con
  el ocre del polígono. Subir saturación del fill o engrosar stroke.

## Patrón establecido por el primer port (renta) — SEGUIR este patrón

Hay un **registry de overlays** en `public/polis-app/overlays/index.js`:
- `OVERLAYS[]` — lista de módulos importados
- `META[]` — metadatos para UI (categoría, nombre, color)
- `drawActiveOverlays(ctx, state, view)` — invocado por `renderer.js` después del render base
- Panel UI `#layer-panel` con toggle `≡` en `index.html`
- API pública: `window.polisApp.setLayer(id, bool)` + `state.activeOverlays[id]`

**Para añadir una capa nueva**: crear `overlays/<id>.js` con la misma forma
que `renta.js` (`{id, name, load, draw, isReady}`), añadir 1 import + 1
entrada en `OVERLAYS` + 1 entrada en `META`. Renderer y app.js NO se tocan.
