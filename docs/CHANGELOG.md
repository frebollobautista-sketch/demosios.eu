# CHANGELOG

## [v1.5.3] — 2026-05-11
- **Fix edificios al suelo en LOD distrito** (`public/polis-app/renderer.js`):
  Pancho reportaba que al hacer zoom in al paso 3 del distrito (edificios
  individuales) las manzanas debajo conservaban su extrusión `height_median_m`
  y los edificios parecían "flotar" sobre el techo de la manzana en lugar de
  extrudir desde el suelo. Fix en `renderDistrito` paso 2: durante el
  cross-fade paso 2 → paso 3 la altura de cada manzana se interpola
  linealmente con `heightK = 1 - alpha3` (de `height_median_m` a 0). Cuando
  `hUse < 0.5` se dibuja un anillo plano (`fillRing`) en lugar de tile iso —
  desaparecen las caras laterales y los edificios extruyen claramente desde
  z=0. La sombra plana SE de las manzanas se atenúa con el mismo factor
  (`shadowOffset = 4 * heightK`) para evitar pop visual. Los pasos 1 y 2
  puros mantienen su extrusión: relieve sutil 3 m en polígonos-sección
  (paso 1) y `height_median_m` en manzanas (paso 2). Sólo el paso 3
  dominante las aplana. Documentado en `STYLE_GUIDE.md` §"Regla edificios
  al suelo".
- **Indicators hook para integración Next.js / Supabase**
  (`public/polis-app/app.js`, `renderer.js`, `index.html`): el chat "polis"
  está modelando estado de edificios (descubierto / identificado /
  calibrado / badges / eventos) en Supabase desde `src/app/`. Para no
  acoplar el runtime web a esa decisión, dejamos el punto de inyección
  listo:
  - `state.indicators = { zone, user, realtime }` con shape acordado
    (ver `RUNTIME.md`). Valores a 0 / null en arranque.
  - `renderHud(state)` consume `state.indicators` y escribe en filas HUD
    con `data-key`. Si campo a 0/null muestra placeholder `"--"`.
  - API pública `window.polisApp.setIndicators(partial)` hace deep-merge
    sobre las tres ramas y dispara repaint. `getIndicators()` devuelve
    snapshot JSON.
  - `index.html` reestructura el HUD con `.hud-row[data-key]` para que
    el renderer pueda actualizar valor + label sin reflujo del layout.
- **Documentación deploy**: nuevo `docs/DEPLOY_POLIS_APP.md` con URL
  esperada `https://koinos.es/polis-app/`, checklist pre-deploy, comando
  de deploy (Vercel auto-detecta tras `git push`), plan de rollback con
  `git revert`, y cómo enlazar desde la app principal cuando se decida.
  Next.js sirve `public/polis-app/` sin configuración extra (compor-
  tamiento default).
- **RUNTIME.md** añade sección "Integración con la capa cívica" con
  contrato `state.indicators`, snippet de uso desde Next.js (vía
  postgres_changes + iframe) y prueba de humo desde consola.

## [v1.5.2] — 2026-05-10
- **Fix zoom de entrada al distrito** (`public/polis-app/iso.js`):
  Pancho reportaba que al entrar a un distrito veía "puntos negros" en
  lugar de las regiones-sección que v1.5.1 había introducido. Diagnóstico:
  el `fitView` calculaba `scale = baseScale` con `padPx=90`, lo que dejaba
  el bbox del distrito ocupando ~50 % del viewport — las 58 secciones de
  distrito 02 LPGC quedaban entonces a ~20-40 px de ancho, ininteligibles
  (sus contornos ink 4 px las hacían parecer puntos). Era el caso (b) del
  diagnóstico: paso 1 correcto pero zoom demasiado lejano. Fix:
  - `fitView` acepta un multiplicador `entryZoom` por nivel:
    `{ isla: 1.0, municipio: 1.0, distrito: 1.45, seccion: 1.05 }`.
    `scale = baseScale * entryZoom`, mientras que `fitScale` se conserva
    como `baseScale` (escala de fit exacto) para que los thresholds LOD
    relativos a `fitScale` no se rompan.
  - Recalibración de thresholds LOD distrito tras subir `entryZoom`:
    `DISTRITO_T1` 1.5 → **2.2**, `DISTRITO_T2` 3.0 → **4.0**. Con esto
    el entry zoom (ratio ≈ 1.45) queda dentro de Paso 1 puro
    (≤ T1 - r = 1.85) y el usuario tiene margen para zoomear in hasta
    pasos 2 y 3 con la rueda normal.
  - Resultado: las 58 secciones del distrito 02 LPGC ocupan ~80-200 px
    de ancho mínimo y se leen como piezas grandes coloreadas.
- **Vecinos colindantes (mapa continuo)** (`public/polis-app/app.js`,
  `renderer.js`): hasta v1.5.1 cuando entrabas a un distrito o sección
  todo el espacio alrededor quedaba como `paper_warm` vacío, lo cual
  rompía la sensación de mapa continuo. Ahora los tres niveles
  municipio / distrito / sección renderizan también las piezas vecinas
  con detalle reducido y permiten tap-saltar a ellas:
  - **Detección de adyacencia**: para municipios, intersección de bbox
    con buffer del 25 % del tamaño del mun activo (`findMunicipioNeighbors`
    en `app.js`). Para distritos, los demás distritos del mismo
    municipio (`munObj.distList`). Para secciones, las demás secciones
    del mismo distrito (`state.district.secciones`).
  - **Reglas visuales** (ver §Vecinos colindantes en `STYLE_GUIDE.md`):
    sin extrusión, sin sombra, sin manzanas / edificios / calles del
    vecino. Distrito vecino → polígonos-sección desaturados (60 %
    `paper_warm` + 40 % color densidad), stroke ink 2 px. Sección
    vecina → relleno `rgba(240,221,180,0.55)`, stroke ink 1.5 px.
    Municipio vecino → relleno `rgba(240,221,180,0.55)`, stroke ink
    2 px. Todos renderizados ANTES del contenido activo (capa
    inferior).
  - **Tap → slide lateral**: `handleTap` detecta tap sobre vecino tras
    fallar el hit-test del contenido activo. Dispara `enterMunicipio /
    enterDistrito / enterSeccion` del vecino mediante un nuevo helper
    `slideHorizontal(duration, dir, swapAsync)` que reutiliza
    `state._slideAnim`. Duración: 600 ms para municipio y distrito,
    400 ms para sección. La dirección depende de en qué mitad del
    viewport quedó el tap. El renderer extiende el slide translate a
    los tres niveles (antes sólo nivel distrito).
  - **Reutilización de coords nivel sección**: para que la sección y
    sus vecinas compartan sistema de coordenadas (anchor GC), si
    `state.district` ya está cargado y contiene el pack reproyectado
    de la sección destino, `enterSeccion` lo reutiliza vía
    `buildSeccionFromDistrictPack` en lugar de re-cargar la sección
    con anchor local. Si no, cae al `loadSeccion` clásico.
- **Documentación**: `docs/STYLE_GUIDE.md` añade sección "Vecinos
  colindantes" con tabla por nivel y reglas comunes. `docs/RUNTIME.md`
  añade bullet "Tap vecino → slide lateral" en Navegación. Ambos
  reflejan los nuevos thresholds LOD distrito (T1=2.2, T2=4.0) y el
  `entryZoom` 1.45×.

## [v1.5.1] — 2026-05-10
- **LOD distrito TRIPLE** (`public/polis-app/renderer.js` +
  `app.js`): tras feedback de Pancho (entrar a distrito 02 LPGC y ver
  1.700 manzanas pequeñas saturaba visualmente), el LOD doble del
  distrito pasa a triple con dos cross-fades:
  - **Paso 1 — entry zoom** (`scale ≤ 1.5 × fitScale`): sólo
    polígonos-sección del distrito coloreados por densidad de edificios
    (paleta cálida 3 niveles, terciles del propio distrito). 58 piezas
    legibles en distrito 02 LPGC, no 1.700 manzanas. Trazo ink 4 px,
    sombra plana SE 3 px, contorno bbox ink 6 px. Calles ocultas.
  - **Paso 2 — mid zoom** (`1.5× < scale ≤ 3.0×`): cross-fade entre
    regiones-sección y manzanas-tile (`OCRE`, stroke 4 px, sombra 4 px).
    Secciones quedan como contorno fino `rgba(26,22,18,0.55)` 1.4 px.
    Calles del distrito aparecen progresivamente con anchos por tipo.
  - **Paso 3 — high zoom** (`scale > 3.0×`): cross-fade entre
    manzanas-tile y edificios-arquetipo individuales con
    `drawArchetype()` y catálogo (lo que existía antes en v1.5).
  - Ventana de cross-fade ±0.35 alrededor de cada threshold (≈300 ms
    percibidos en MacBook normal con rueda de zoom). Helper:
    `computeLodBlendDistrito(view) → { alpha1, alpha2, alpha3, ratio }`.
  - `loadDistrito()` computa los terciles `secStats` y el `districtOutline`
    (rectángulo del bbox del distrito) y los expone en `state.district`.
- **Viewport stack para back animado** (`public/polis-app/app.js`):
  Pancho reportaba que la transición backwards se sentía "rara". La
  causa era que el back saltaba al `fitView` del nivel padre, perdiendo
  el zoom + pan que el usuario tenía la última vez en ese nivel
  (teleport visual desagradable). Fix:
  - Nuevo `state.viewportStack` (objeto keyed por lodLevel) y
    helpers `snapshotViewport()`, `saveParentViewport(parentLevel)`,
    `consumeViewportFor(level)`, `mergeRestoredView(fitNew, snap)`.
  - Cada `enterMunicipio` / `enterDistrito` / `enterSeccion`
    (navegación forward) guarda un snapshot del viewport del padre
    antes del swap. El snapshot incluye `scale, cx, cy, tx, ty,
    ax, ay, sz_factor, minScale, maxScale, fitScale`.
  - `navigateBack()` y el handler de `popstate` consumen el snapshot
    del nivel destino y lo pasan como tercer argumento `restoreView`
    a las funciones `enter*`, que lo combinan con el `fitView` fresco
    (`minScale/maxScale/fitScale` del nuevo cálculo + resto del
    snapshot) y animan con la misma curva 500 ms `ease-in-out` que
    la forward.
  - `isBackNavigation(from, to)` usa `LEVEL_DEPTH` (`isla=0`,
    `municipio=1`, `distrito=2`, `seccion=3`) para distinguir back
    de forward en `popstate`.
  - Si no hay snapshot guardado (deep link, primer arranque, slot
    ya consumido), se cae a `fitView` como fallback. Los cuatro
    niveles (isla → municipio → distrito → sección) preservan el
    viewport en cualquier dirección de back.
- **Documentación**: `docs/STYLE_GUIDE.md` añade la subsección
  "LOD triple (v1.5.1)" dentro de Nivel 2 — Distrito y actualiza la
  fila "LOD interno" de la tabla resumen. `docs/RUNTIME.md` añade
  bullet "Viewport stack (v1.5.1)" en Navegación y nueva subsección
  "LOD interno en distrito (v1.5.1 — TRIPLE)".

## [v1.5] — 2026-05-10
- **Fix orientación isla** (`public/polis-app/iso.js`): la antigua
  proyección `ax=0 / ay=90` colapsaba la coordenada vertical y estiraba
  la silueta de Gran Canaria en el eje este-oeste. Nuevo modo plano
  top-down: cuando `ax≈0` y `ay≈0`, `project()` y `fitView()` aplican
  `px = cx + (x-tx)*scale` / `py = cy + (z-ty)*scale`, preservando la
  proporción real (ratio en pantalla 0.942, GC mide 46.8 km × 49.6 km en
  metros locales tras la corrección `cos(lat)` que ya aplicaba
  `lnglatToLocalMeters`). La silueta se reconoce ahora "como en Google
  Maps", norte arriba.
- **Aplanado del nivel municipio**: `PROJ_PRESETS.municipio` pasa de
  iso ligera (`ax=20 / ay=15`) a top-down puro (`ax=0 / ay=0 /
  sz_factor=0`). Las secciones siguen como polígonos coloreados por
  densidad de edificios pero sin extrusión visible — sigue siendo "un
  mapa", no un tablero 3D.
- **Nuevo nivel DISTRITO** entre municipio y sección. Identificador
  `distritoId = mun + dis` (5 dígitos, p.ej. `01602` para LPGC distrito
  02). Se construye en runtime agrupando las secciones del municipio
  por los dígitos 6-7 del cusec. Carga lazy en paralelo de los N packs
  del distrito (típicamente 30-79 secciones) tolerante a fallos.
  Reproyección por sección desde el anchor de su `meta.enu_basis` al
  anchor común GC para que todo el distrito comparta el sistema de
  coordenadas con isla y municipio.
  - Proyección iso completa 30°/30° (`PROJ_PRESETS.distrito`,
    `sz_factor=1.6`) — relieve y carácter Into the Breach.
  - LOD interno con cross-fade ±40% del threshold `1.6 × fitScale`:
    zoom out = manzanas como tiles iso unificados; zoom in = edificios
    individuales con archetipos del catálogo `archetypes.json`.
  - Etiqueta flotante centrada bajo el banner: "Distrito 02 · Las
    Canteras + Guanarteme · 58 secciones · 7.147 edificios". Apodos
    descriptivos hardcoded para los 5 distritos LPGC.
- **Cambio de comportamiento del tap en municipio**: tap en una
  sección NO entra ya a sección, entra a su distrito. Tap en distrito
  entra a sección. Back: sección → distrito → municipio → isla.
- **Navegación lateral cíclica entre distritos**: dos botones
  flotantes en los bordes laterales (`#dist-prev` ‹ y `#dist-next` ›)
  visibles sólo en nivel distrito. Animación de slide horizontal 600 ms
  ease-in-out (300 ms salida + 300 ms entrada del siguiente distrito).
  Recorrido cíclico 01 → 02 → 03 → 04 → 05 → 01. En móvil, gesto swipe
  horizontal del canvas (≥60 px X, <40 px Y, <600 ms) hace lo mismo.
- **Deep linking actualizado**: nuevo formato URL para distrito
  `?level=distrito&distrito_id=01602`. `history.pushState` apila una
  entrada por nivel; `popstate` reconstruye el estado completo
  (municipio → distrito → sección si es necesario). El cusec sigue
  funcionando como atajo: `?cusec=3501602052` carga municipio +
  distrito + sección en cascada.
- **Documentación**: `docs/STYLE_GUIDE.md` añade la sección "Nivel
  distrito" y actualiza la tabla resumen y los presets de proyección.
  `docs/RUNTIME.md` documenta el cuarto nivel, la navegación lateral
  y el deep linking del distrito.

## [v1.4] — 2026-05-10
- **Rescate de las 3 secciones fallidas** (3501301006, 3501901001,
  3502501002) que petaron por `TopologyException` en v1.3.
  `packages/pack/pack_section.py` añade el helper `_repair_geom` (capas
  `buffer(0)` → `make_valid()` shapely 2.x → `simplify(0.0001)`) y
  envuelve con él los `intersection`/`intersects` de roads, parks y
  water (los más sucios del PBF). Manifest GC: **562/562 OK**.
  Totales: 92,871 edificios, 24,357 manzanas, 10,472 POIs, 154,790 ha.
- **Reproyección por nivel** (`public/polis-app/iso.js`): nueva
  función `project(x, y, z, view)` parametrizada por `ax`/`ay`/`sz_factor`
  vía presets `PROJ_PRESETS = { isla, municipio, seccion }`.
  - Isla: top-down norte-arriba (`ax=0`, `ay=90`), polígonos planos por
    color de densidad, costa lazy-loaded en azul `#3F5F7E`. Como
    Google Maps.
  - Municipio: iso ligera 20°/15°, secciones extruidas
    `min(40, sqrt(building_count·3))`, calles primary/secondary
    clipadas al bbox del mun cargadas bajo demanda.
  - Sección: iso clásica 30°/30° (lo de v1.3, intacto).
  - Animación de transición interpola también `ax`/`ay`/`sz_factor`,
    así la cámara "rota" suavemente al subir/bajar de nivel.
- **Back button + history.pushState**: botón flotante "←" arriba-izq
  (oculto en isla). `history.pushState` por nivel con state `{ lodLevel,
  mun, cusec }`. Listener `popstate` reproduce el nivel guardado, con
  guardas (`_bootstrapping`, `_navigatingFromPop`) para no entrar en
  bucle. El botón Atrás del navegador y el gesto deslizar de iOS
  funcionan.
- **Validación automática**: nuevo `scripts/validate_packs.py` que
  comprueba (1) área pack vs `meta.area_ha` (±2%), (2) centroide
  dentro del polígono, (3) bbox sección vs bbox edificios (±30%),
  (4) `building_count` meta vs geojson, (5) `manzana_count` si está
  declarado. Output: `public/sections_pack/validation_report.{json,csv}`.
  Resultado batch v1.4: **523/562 packs pasan** (39 fallos por
  centroide-fuera-de-polígono en formas no convexas; el chequeo se
  conserva como sanity flag, no como hard fail).
- **Contact sheet GC completa**: `public/sections_pack/contact_sheet_gc.png`
  (3882×4118 px, ~8 MB), grid 25×23 con thumbnails 150×150 de las 562
  secciones ordenadas por cusec. Banner cabecera con totales globales.
  La contact sheet anterior se renombra a `contact_sheet_lpgc.png`
  para preservar histórico.
- `docs/STYLE_GUIDE.md` actualiza la tabla por nivel con la nueva
  proyección. `docs/RUNTIME.md` documenta el back button y el
  flujo de navegación con `pushState`/`popstate`.

## [v1.3] — 2026-05-10
- **Batch GC completo**: 285 secciones extra (resto de Gran Canaria
  fuera de LPGC) procesadas. Total acumulado en manifest: 559 secciones
  GC con 90,258 edificios, 22,758 manzanas, 10,366 POIs y 132,532 ha.
  3 fallos por geometría OSM inválida (TopologyException), no
  bloqueantes.
- `packages/pack/batch.py` extendido con `--isla {gc,fv,lz}`,
  `--exclude-mun ...` y `--no-manifest` (útil en chunks).
- **Polígonos de municipio**: nuevo `scripts/derive_municipios.py` que
  agrupa secciones por mun con `unary_union` (shapely) y simplifica a
  ~30 m. Output: `public/gc-municipios-poly.json` (382 KB, 21 muns con
  area_ha, perimeter_km, sections_count, centroid, geometría WGS84).
- **Runtime web jerárquico** (`public/polis-app/`): tres niveles
  navegables (isla → municipio → sección) con tap, breadcrumb y deep
  links por URL (`?mun=`/`?cusec=`). Transiciones de view animadas
  500 ms ease-in-out. +480 LOC.
- **Estilo sección reducido**: stroke en manzanas baja de 5 a 4 px,
  sombra plana de 6–8 px a 4 px, sombra de edificios de 4 a 2.5 px.
  Reduce el ruido visual reportado por Pancho.
- `docs/STYLE_GUIDE.md` (~150 líneas) con la spec de los tres niveles
  (paleta, trazo, sombra, tipografía, qué se omite a cada escala).
- `docs/RUNTIME.md` actualizado con la jerarquía y el sistema dual de
  LOD (entre niveles + cross-fade interno).

## [v1.2] — 2026-05-10
- Runtime web v0 del motor isométrico en `public/polis-app/` (HTML +
  Canvas2D + ES modules, sin build step).
- Carga directa del data pack v1 vía `fetch()`: `meta.json`,
  `manzanas.geojson`, `buildings.geojson`, `roads.geojson`,
  `pois.geojson` y `catalog/archetypes.json`.
- Dos LODs con cross-fade: sección (manzanas como tiles unificados,
  10 bloqueadas en gris) y manzana (edificios individuales con colores
  del archetipo resuelto por `classify()`).
- Pan/zoom con mouse y touch (pinch), tap para seleccionar manzana,
  panel lateral con id/edificios/POIs/área/altura mediana.
- HUD hardcoded ("47% recuperado · 8 eventos vivos · 156 portales") y
  card Songkick anclada a la manzana 24, replicando el patrón del hero
  render `packages/mockups/hero.py`.
- `docs/RUNTIME.md` con instrucciones de arranque y limitaciones de v0.

## [v1.1] — 2026-05-09
- Batch extendido al municipio entero LPGC (274 secciones, +198 sobre v1).
- Manifests separados por zona: global, lpgc, canteras.
- Trees vacíos en secciones fuera de Canteras (pendiente fuente alternativa).
- batch.py acepta --mun para filtrar por código de municipio.

## [v1] — 2026-05-09
- Reorganización del repo en packages/, docs/, public/.
- Promoción de catálogo de arquetipos a public/catalog/archetypes.json.
- Documentación de arquitectura y contrato del data pack.
- Wrappers de compatibilidad en scripts/ apuntando a packages/.
