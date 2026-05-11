# KOINOS · POLIS — Style Guide visual (runtime web)

> Especificación de estilo visual para los cuatro niveles de navegación
> jerárquica (isla → municipio → distrito → sección). Aplicable a
> `public/polis-app/`. Última actualización: 2026-05-10 (v1.5.2).

## Filosofía

POLIS web hereda el lenguaje de los mockups iso (`packages/mockups/*.py`):
**papel cálido + ocre + tinta**, con sombras planas hacia el sureste y
contornos consistentes. La navegación recorre escalas — isla, municipio,
sección — manteniendo ese lenguaje pero adaptando densidad de detalle:
cuanto más amplia la vista, más simplificada es la pieza individual.

## Paleta común

```
paper_warm   #F0DDB4   fondo principal a todos los niveles
paper        #F5E8C8   variante usada en tiles bajos / fondos de UI
ocre         #C89968   tile densidad alta
ocre_lt      #D9B58A   tile densidad media
ocre_dk      #A37945   acentos
sand         #E2C99A   tile rural / muy bajo
gris         #4A4D52   manzanas bloqueadas (sólo nivel sección)
street       #6B6358   trazos de calle
ink          #1A1612   contornos, sombras, etiquetas
costa        #3F5F7E   contorno de costa (nivel isla)
naranja      #E68A4F   selección/hover
morado       #9F4FE6   marcador de evento (Songkick card)
```

Las variables CSS están en `style.css` bajo `:root`.

## Tipografía

- Cuerpo y etiquetas: `Georgia, "Times New Roman", serif`.
- Banner principal: 18 px bold.
- Etiquetas en mundo (nombres de municipio): 11–13 px bold con halo
  `ink` 4 px y relleno blanco.
- Pill LOD y breadcrumb: 12–13 px, `letter-spacing: 0.4–0.8 px`.

## Proyección por nivel (v1.5)

v1.5 reorganiza los presets para que isla y municipio sean ambos mapas
top-down planos (Pancho explícito: "el municipio que se vea también como
mapa, no como tablero 3D") y que la iso completa esté reservada al par
distrito + sección, donde sí queremos relieve y carácter de juego.

| Nivel     | ax  | ay  | sz_factor | Resultado                                                |
|-----------|-----|-----|-----------|----------------------------------------------------------|
| Isla      |  0° |  0° | 0.0       | Top-down puro (mapa plano), sin extrusión                |
| Municipio |  0° |  0° | 0.0       | Top-down puro, polígonos coloreados sin extrusión        |
| Distrito  | 30° | 30° | 1.6       | Iso completa, extrusión marcada — Into the Breach        |
| Sección   | 30° | 30° | 1.4       | Iso clásica de los mockups (lo de v1.4)                  |

`project(x, y, z, view)` detecta el modo plano cuando `|ax| < 0.5 &&
|ay| < 0.5` y aplica `px = cx + (x-tx)*scale` / `py = cy + (z-ty)*scale`
en lugar de la rotación iso. Esto es lo que arregla el bug histórico
de v1.4 donde `ax=0 / ay=90` colapsaba la coordenada vertical y
estiraba la silueta de Gran Canaria. Tras el fix, GC mide 46.8 km
× 49.6 km en metros locales (ratio 0.942), reconocible como en
Google Maps.

La animación entre niveles **interpola los tres parámetros**, así que
al pasar de municipio (plano) a distrito (iso) la cámara "rota"
suavemente desde el top-down hasta la iso completa.

## Tabla resumen por nivel

| Aspecto                | Isla (GC)                 | Municipio                | Distrito                          | Sección                       |
|------------------------|---------------------------|--------------------------|-----------------------------------|-------------------------------|
| Piezas en pantalla     | 21 muns                   | 1–79 secciones           | 30–79 secciones + N edif          | 5–80 manzanas + N edif        |
| Trazo (stroke ink)     | 4 px                      | 4 px                     | 4 px (manzana) / 1.6 px (edif)    | 4 px (manzana) / 3 px (edif)  |
| Contorno externo       | —                         | (futuro)                 | —                                 | —                             |
| Sombra plana SE        | (sin sombra, plano)       | (sin sombra, plano)      | 4 px (manzanas) / 2.5 px (edif)   | 4 px (offset 4,4 m)           |
| Altura tile            | (top-down sin extrusión)  | (top-down sin extrusión) | height_median_m por manzana       | height_median_m por manzana   |
| Color por…             | sections_count (3 ramps)  | building_count (3 ramps) | OCRE base / archetipo en LOD alto | bloqueada=gris / activa=ocre  |
| Etiqueta en mundo      | sí (nombre mun)           | no                       | etiqueta flotante HTML (banner)   | no (anchor Songkick aparte)   |
| Calles                 | no                        | primary/secondary clip   | sí, todas las del distrito        | sí, por tipo OSM              |
| LOD interno            | no                        | no                       | sí — TRIPLE (regiones ↔ manzanas ↔ edif) | sí (sección ↔ manzana)  |
| Costa                  | sí (azul `#3F5F7E` 1.2px) | —                        | —                                 | —                             |
| Navegación lateral     | —                         | —                        | sí (‹ › cíclica + swipe touch)    | —                             |

## Nivel 0 — Isla (Gran Canaria)

- Proyección **plana top-down puro** (`ax=0`, `ay=0`, sin extrusión).
  La silueta de Gran Canaria se ve "como en Google Maps", norte arriba.
  Los 21 municipios son polígonos planos rellenos, no tiles iso.
- Fondo `paper_warm`.
- Color de relleno según `sections_count`:
  - rural (≤ tercil 1): `sand` (arena cálida)
  - intermedio: `ocre_lt`
  - denso (≥ tercil 2): `ocre`
- Trazo `ink` 4 px. Sin caras laterales, sin sombra plana.
- **Costa** `#3F5F7E` 1.2 px (lazy-loaded de `osm-gc/coastline.json` la
  primera vez que se entra al nivel; cacheada en `state.isla.coastline`).
- Etiqueta del nombre del mun (versión corta — "LPGC", "S.B. Tirajana")
  centrada sobre el centroide del polígono, fuente serif blanca 12 px
  con halo ink 4 px.

## Nivel 1 — Municipio

- Proyección **plana top-down puro** (`ax=0`, `ay=0`, `sz_factor=0`).
  v1.5 elimina la iso ligera 20°/15° de v1.4 a petición de Pancho:
  el municipio se lee también como mapa, no como tablero 3D.
- Fondo `paper_warm`.
- Polígono del municipio como contorno `ink` 6 px (anclaje visual).
- Cada sección renderizada como polígono coloreado **sin extrusión
  visible**: aunque `drawIsoTile` recibe una `h` mínima, en modo plano
  todas las caras laterales colapsan y sólo se ve el techo.
- Color por densidad de edificios (tres terciles propios del mun):
  - rural: `paper_warm`
  - intermedio: `ocre_lt`
  - denso: `ocre`
- Trazo 4 px. Sin sombra plana visible (la proyección plana hace que
  el offset de sombra colapse al mismo polígono).
- **Calles primary/secondary** (incluye `trunk`/`motorway`) clipadas al
  bbox del mun, en `street` con anchos 4 / 2.5 px. Carga lazy global de
  `osm-gc/roads.json` la primera vez (cacheada en `state._roadsGlobal`).
- Sin etiquetas por sección — son demasiadas en LPGC y demasiado
  ilegibles en muns rurales.

## Nivel 2 — Distrito (v1.5.1 — LOD triple)

Cuarto nivel introducido en v1.5, entre municipio y sección. El
distrito es la unidad administrativa intermedia (cusec dígitos 6-7) que
agrupa típicamente 30-79 secciones contiguas. LPGC tiene 5 distritos:
01 (Vegueta + Triana), 02 (Las Canteras + Guanarteme), 03 (Ciudad Alta
+ Schamann), 04 (Tamaraceite + San Lorenzo), 05 (Tafira + La Isleta sur).
La mayoría de municipios pequeños tienen 1 solo distrito.

- Proyección **iso completa** (`ax=30`, `ay=30`, `sz_factor=1.6`).
  Aquí SÍ queremos relieve y carácter de juego (Into the Breach).
- Fondo `paper_warm`.
- Carga lazy en paralelo de los N packs del distrito al entrar (loader
  visible: "cargando distrito 02 · 58 secciones…"). Reproyección de
  cada pack desde su anchor `meta.enu_basis` al anchor común GC.
- **Etiqueta flotante HTML** centrada bajo el banner:
  "Distrito 02 · Las Canteras + Guanarteme · 58 secciones · 7.147
  edificios". Apodos en `DISTRITO_NICKS` para los 5 distritos LPGC.
- **Botones laterales ‹ ›**: navegación cíclica entre distritos del
  mismo municipio (01 → 02 → 03 → 04 → 05 → 01). Animación slide
  horizontal 600 ms ease-in-out (fase out 300 ms + fase in 300 ms).
  En móvil el mismo gesto se dispara con swipe horizontal del canvas
  (≥60 px X, <40 px Y, <600 ms).

### LOD triple (v1.5.1)

v1.5.1 sustituye el LOD doble por uno triple, después de que Pancho
señalara que entrar al nivel distrito y ver 1.700 manzanas pequeñas de
golpe (en distrito 02 LPGC) saturaba visualmente. La progresión revela
detalle gradualmente conforme el usuario hace zoom in.

Helper en `renderer.js`: `computeLodBlendDistrito(view)` devuelve
`{ alpha1, alpha2, alpha3, ratio }` con los pesos para componer los
tres pasos. Thresholds calibrados para sentir natural en MacBook normal
con rueda de zoom estándar.

**Zoom de entrada al distrito (v1.5.2)**: `fitView` aplica un
multiplicador `entryZoom = 1.45×` al nivel distrito para que el bbox
ocupe ~70-80 % del viewport en lugar del 50 % que daba `fitScale`
exacto. Con ello las 58 secciones del distrito 02 LPGC ocupan
~80-200 px de ancho mínimo en pantalla y se leen como piezas grandes
en lugar de puntos. El `fitScale` se conserva como "scale de
referencia" (la escala que haría fit exacto), de forma que los
thresholds LOD relativos a `fitScale` siguen funcionando: T1 sube a
**2.2×** y T2 a **4.0×** para que el entry zoom (ratio efectiva ≈
1.45) caiga claramente en Paso 1 puro (< T1 - r = 1.85) y haya margen
para que el usuario zoomee hacia paso 2 y paso 3.

| Paso | Rango (scale / fitScale) | Qué se ve                                                  |
|------|--------------------------|-------------------------------------------------------------|
|  1   | ≤ **2.20×**              | Polígonos-sección coloreados por densidad (3 niveles)      |
|  2   | 2.20× – **4.00×**        | Cross-fade regiones-sección ↔ manzanas-tile (`OCRE` 4px)   |
|  3   | ≥ 4.00×                  | Cross-fade manzanas-tile ↔ edificios-arquetipo (catálogo)  |

Ventana de cross-fade: ±0.35 alrededor de cada threshold (≈300 ms
percibidos a velocidad de zoom normal).

#### Paso 1 — entry zoom (default al entrar al distrito)
- Sólo polígonos de las N secciones del distrito como regiones
  coloreadas (58 polígonos en distrito 02 LPGC, no 1.700 manzanas).
- Color por densidad de edificios por sección, paleta cálida 3 niveles
  (terciles del propio distrito): `sand` / `ocre_lt` / `ocre`.
- Trazo `ink` 4 px, sombra plana SE 3 px.
- Bbox del distrito como contorno `ink` 6 px de referencia visual.
- Relieve sutil (`h=3 m` simbólico, no extrusión real).
- Etiqueta del distrito flotante (HTML, ya existente).
- Calles del distrito ocultas a alpha cero en paso 1 puro (saturarían
  igual que las manzanas).

#### Paso 2 — mid zoom
- Las regiones-sección desaparecen progresivamente; queda un contorno
  fino `rgba(26,22,18,0.55)` 1.4 px de cada sección como anchor
  administrativo.
- Las manzanas aparecen como tiles iso unificados en `OCRE`, stroke
  4 px, sombra plana SE 4 px (mismo spec que vista sección LOD bajo).
- Calles del distrito aparecen progresivamente con sus anchos por tipo
  OSM (`primary` 5 px, `residential` 2 px, etc.).

#### Paso 3 — high zoom
- Manzanas pintadas como base translúcida `rgba(200,153,104,0.18)`.
- Edificios individuales con archetipo del catálogo `archetypes.json`
  vía `drawArchetype()`. Stroke 1.6 px, sombras 2.5 px. Lo que existía
  antes en v1.5.

#### Regla "edificios al suelo" (v1.5.3)

Las manzanas del paso 2 (tiles iso ocre con stroke 4 px) **se aplastan a
z=0** cuando el paso 3 (edificios individuales) toma el relevo. Durante
el cross-fade el factor `heightK = 1 - alpha3` reduce la altura de cada
manzana de su `height_median_m` hasta 0; cuando `heightK < 0.5` la
manzana se dibuja como anillo plano (`fillRing`) en lugar de tile iso —
las caras laterales desaparecen y los edificios extruyen claramente
desde el suelo. Sin esta regla, los edificios parecían "flotar" sobre
el techo de la manzana (que también extrudía a 4-8 m). La sombra plana
SE de las manzanas también se atenúa con el mismo factor para
acompañar el aplanado.

Pasos 1 y 2 puros mantienen su extrusión: relieve sutil 3 m en
polígonos-sección (paso 1) y `height_median_m` por manzana (paso 2).
Sólo el paso 3 dominante las aplana.

## Nivel 3 — Sección

Proyección **iso clásica** (`ax=30`, `ay=30`, sz_factor=1.4) — la de los
mockups Python. Continuación del estilo v1.2 con dos ajustes pedidos por
Pancho:

- **Sombra reducida**: offset 4 px (antes 6–8 px). Aplica a manzanas y a
  los edificios individuales (que pasan a 2.5 px).
- **Stroke reducido en manzanas**: 4 px (antes 5 px). El stroke de
  edificios sigue en 3 px.

Todo lo demás se mantiene:
- Sub-LOD interno con cross-fade entre vista de manzanas (tiles) y
  vista de edificios (archetipos coloreados según `archetypes.json`).
- Calles dibujadas según `roads.geojson` con `street` y anchos por
  tipo OSM (`primary` 5 px, `residential` 2 px, etc.).
- Selección `naranja` con anillo top y lift de 4 px en el tile.
- Card Songkick anclada a la manzana 24, morada con sombra 5 px ink.

## Selección, hover y elevación

A todos los niveles, los elementos seleccionables (mun, sección,
manzana) responden a tap con:
- Lift de 4 px (offset Y negativo en pantalla) — elevación visual.
- Anillo `naranja` 4 px sobre el techo.
- Persistencia del estado en `state.selectedManzanaId` (sección) o
  consumido inmediatamente como navegación (isla y municipio).

## Transiciones entre niveles

- Animación de view de **500 ms** (`ease-in-out`) interpolando
  `scale, cx, cy, tx, ty, fitScale, ax, ay, sz_factor`. Durante la
  animación el render sigue dibujando el nivel actual.
- Al terminar la animación, se hace el "swap" de nivel y se dispara un
  render final con el nuevo `state.lodLevel`. El usuario ve un zoom
  hasta el bbox del siguiente nivel y entonces aparecen las nuevas
  piezas.
- **Viewport stack (v1.5.1)**: las animaciones forward y back NO son
  simétricas en destino. Forward va al `fitView` del bbox del hijo;
  back restaura el viewport exacto que el usuario tenía la última vez
  en el nivel padre (zoom + pan + ángulos), guardado en
  `state.viewportStack` al entrar al hijo. Si no hay snapshot (deep
  link, primer arranque) cae a `fitView` como fallback. Ver
  `docs/RUNTIME.md` §Transiciones.
- (Limitación) No hay cross-fade entre niveles — el cambio de piezas
  es instantáneo al final del zoom. Si Pancho lo nota molesto se
  puede añadir cross-fade de alpha 200 ms al swap.

## Breadcrumb

Posicionado fijo bajo el banner (top: 56 px, left: 16 px). Estilo
`paper` con borde `ink` 3 px y sombra 4 px ink. Cada segmento es un
botón clickeable. El segmento actual va en `naranja` con subrayado y
no es clickeable (cursor default).

Formatos:
- "Gran Canaria"
- "Gran Canaria › LPGC"
- "Gran Canaria › LPGC › Distrito 02"
- "Gran Canaria › LPGC › Distrito 02 › Sección 052"

## Vecinos colindantes (v1.5.2)

Para que el usuario perciba el mapa como continuo (y no como una pieza
aislada flotando sobre `paper_warm`), los niveles **municipio**,
**distrito** y **sección** dibujan también las piezas vecinas — los
muns/distritos/secciones colindantes al activo — con detalle reducido,
desaturadas, y son tap-clicables para saltar lateralmente. Los vecinos
se renderizan ANTES que el contenido activo, así quedan siempre por
debajo y el contenido principal mantiene énfasis visual.

| Nivel     | Qué se dibuja                              | Relleno                          | Stroke      | Sombra | Anim. tap         |
|-----------|--------------------------------------------|----------------------------------|-------------|--------|-------------------|
| Isla      | (no aplica, ya están todos los muns)       | —                                | —           | —      | —                 |
| Municipio | otros muns colindantes (heurística bbox)   | `rgba(240,221,180,0.55)`         | ink 2 px    | no     | slide lateral 600 ms |
| Distrito  | otros distritos del mismo mun, polígonos-sección | 60 % `paper_warm` + 40 % color densidad | ink 2 px    | no     | slide lateral 600 ms |
| Sección   | otras secciones del distrito               | `rgba(240,221,180,0.55)`         | ink 1.5 px  | no     | slide lateral 400 ms |

**Reglas comunes:**
- Sin etiqueta flotante (no compiten visualmente con el activo).
- Sin extrusión visible aun en niveles iso (h=0 en el render del vecino).
- Sin calles / manzanas / edificios del vecino — sólo la silueta.
- Detección de adyacencia:
  - Municipio: intersección de bbox expandido (25 % del tamaño del mun
    activo) entre el mun activo y los demás muns de la isla.
  - Distrito: todos los demás distritos del mismo municipio.
  - Sección: todas las demás secciones del mismo distrito.
- Tap sobre un vecino dispara `enterMunicipio` / `enterDistrito` /
  `enterSeccion` del vecino con animación de slide horizontal: la
  dirección (`dir`) se decide según en qué mitad del viewport quedó el
  tap (derecha → contenido sale a la izquierda; izquierda → sale a la
  derecha). Reutiliza la maquinaria de `state._slideAnim` que ya
  existía para los botones `‹ ›` del nivel distrito.

## Don'ts

- No usar saturaciones puras (rojos, azules brillantes) — se reservan
  exclusivamente para selección y eventos.
- No mezclar tipografías sans-serif en mundo. Toda etiqueta dentro
  del canvas usa Georgia.
- No introducir gradientes en techos: el lenguaje es plano + sombra
  desplazada (riso).
- No mover el offset de sombra al NO/N — el lenguaje es siempre SE.
