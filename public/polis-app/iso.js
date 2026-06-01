// KOINOS · POLIS — proyección parametrizable y utilidades de coordenadas.
//
// v1.5: la proyección distingue ahora un modo plano top-down (cuando
// ay = 0 y ax = 0) que evita el bug de v1.4 donde ax=0 / ay=90 colapsaba
// la coordenada vertical y estiraba GC en el eje este-oeste. El modo plano
// hace literalmente `px = cx + (x-tx)*scale` / `py = cy + (z-ty)*scale`,
// preservando la proporción real de la silueta tras la corrección cos(lat).
//
// Convención del data pack v1: los polígonos vienen en metros locales ENU
// (x = este, z = sur, y = altura). Aquí Y positivo en pantalla = sur.

export const COS30 = Math.cos(Math.PI / 6); // ~0.8660
export const SIN30 = 0.5;

// Presets de proyección por nivel (ángulos en grados).
//   isla:      plano top-down puro (sin rotación iso). El visor renderiza
//              un mapa "como Google Maps", norte arriba.
//   municipio: plano top-down puro. v1.5 elimina la iso 20°/15° de v1.4
//              porque Pancho lo quiere también como mapa, no tablero 3D.
//   distrito:  iso clásica 30° / 30° con extrusión completa — relieve y
//              carácter de juego (Into the Breach).
//   seccion:   iso 30° / 30°, igual que distrito, hereda los mockups.
// v1.6.barrio-clamp — `maxZoomRatio` añade clamp por nivel. El usuario
// puede hacer zoom-in con rueda/pinch hasta `fitScale * maxZoomRatio` y
// luego se topa contra el techo. Esto evita que el zoom intra-nivel
// "exponga" detalle del nivel siguiente (que ya no se renderiza). El
// descenso jerárquico se hace ÚNICAMENTE por tap explícito.
//   municipio: 2.5 — los barrios se ven al 250 % del fit, suficiente
//                    para etiquetas, sin invadir el rol de manzanas.
//   barrio:    2.5 — manzanas como pieza-tile, sin exponer edificios.
//   distrito:  6.0 — preset legacy: sigue permitiendo zoom al detalle
//                    porque renderDistrito todavía hace cross-fade
//                    multi-paso (LOD intra-nivel).
//   manzana:   4.0 — para inspeccionar edificios grandes en móvil.
//   seccion:   4.0 — comportamiento clásico.
export const PROJ_PRESETS = {
  // 2026-05-19 — archipielago: raíz por encima de isla. Plano top-down,
  // sirve para que las 7 islas se vean a la vez como tiles geográficos.
  archipielago: { ax: 0, ay: 0, sz_factor: 0.0, maxZoomRatio: 2.5 },
  isla:      { ax: 0,  ay: 0,  sz_factor: 0.0, maxZoomRatio: 3.0 },  // top-down puro
  municipio: { ax: 0,  ay: 0,  sz_factor: 0.0, maxZoomRatio: 2.5 },  // v1.5: aplanado
  distrito:  { ax: 30, ay: 30, sz_factor: 1.6, maxZoomRatio: 6.0 },  // iso completa, relieve
  // v1.6.barrio: nivel intermedio hijo directo del municipio. Como tiene
  // menos secciones que el distrito (típicamente 3-30 vs 30-79), entra
  // con menos extrusión (sz 1.5) para que los edificios — visibles al
  // zoom de entrada cerrado — no se apilen visualmente.
  barrio:    { ax: 30, ay: 30, sz_factor: 1.5, maxZoomRatio: 2.5 },
  // v1.6.manzana (Phase 2b) — quinto nivel: drill-down a una sola
  // manzana del barrio. Iso 30°/30° con sz 1.4 (más bajo que barrio para
  // que los edificios grandes queden bien proporcionados al zoom cerrado
  // 3.5×, sin caras laterales gigantes).
  manzana:   { ax: 30, ay: 30, sz_factor: 1.4, maxZoomRatio: 4.0 },
  seccion:   { ax: 30, ay: 30, sz_factor: 1.4, maxZoomRatio: 4.0 },
};

function deg2rad(d) { return d * Math.PI / 180; }

// Proyecta un punto del mundo (x_m, y_m, z_m) a coordenadas de pantalla.
// `view` controla pan/zoom y opcionalmente trae los ángulos.
//   - Si view.ax === 0 && view.ay === 0 → modo plano top-down (mapa).
//   - Si no, modo iso clásico (interpolación angular durante anim).
// v1.6 — proyección unificada continua. Hasta v1.5 había dos ramas
// (plano vs iso) que conmutaban abruptamente cuando ax cruzaba 0.5°.
// Durante una animación isla→distrito, ese cruce provocaba un "flip"
// visual de 45° porque las dos fórmulas usaban bases distintas
// (plano: (x, z); iso: (x-z, x+z)). Además fitView guardaba `tx/ty`
// en coordenadas pre-proyectadas en modo iso pero en world en modo
// plano, así que la interpolación cruzaba sistemas de coordenadas
// incompatibles.
//
// Ahora `tx, ty` SIEMPRE son world-coords (centroide del bbox) y la
// fórmula es una mezcla lineal entre los dos extremos parametrizada
// por ALPHA = ax/30 y BETA = ay/30. En los extremos coincide con las
// fórmulas antiguas (verificado algebraicamente); en valores
// intermedios el render se "transforma" suavemente sin saltos.
const COS30_C = 0.86602540378443864;
const SIN30_C = 0.5;

export function project(x, y, z, view) {
  const sxy = view.scale;
  const ax = view.ax !== undefined ? view.ax : 30;
  const ay = view.ay !== undefined ? view.ay : 30;
  const sz_factor = view.sz_factor !== undefined ? view.sz_factor : 1.4;

  const dx = x - (view.tx || 0);
  const dz = z - (view.ty || 0);

  // Mezcla continua plano↔iso. ALPHA escala el "shear horizontal"
  // (eje x se mezcla con eje -z); BETA escala la "compresión
  // vertical" (eje z se mezcla con eje +x). En ax=0/ay=0 el polígono
  // se proyecta tal cual al canvas (top-down); en ax=30/ay=30 los
  // coeficientes equivalen a cos(30°) y sin(30°) — iso clásica.
  const ALPHA = ax / 30;
  const BETA  = ay / 30;
  const cxX = 1 - ALPHA * (1 - COS30_C);   // 1 → 0.866
  const czX = -ALPHA * COS30_C;            // 0 → -0.866
  const cxY = BETA * SIN30_C;              // 0 → 0.5
  const czY = 1 - BETA * (1 - SIN30_C);    // 1 → 0.5

  const px = view.cx + (dx * cxX + dz * czX) * sxy;
  const py = view.cy + (dx * cxY + dz * czY) * sxy
                     - y * sz_factor * sxy * BETA;
  return [px, py];
}

// Proyecta un anillo entero (lista de [x, z]) a tierra (y=0).
export function projectRing(ring, view, yOffset = 0) {
  const out = new Array(ring.length);
  for (let i = 0; i < ring.length; i++) {
    out[i] = project(ring[i][0], yOffset, ring[i][1], view);
  }
  return out;
}

// Calcula el centro de pan inicial dado un bbox [minx, miny, maxx, maxy]
// y el tamaño del canvas. Devuelve un view inicial con scale ajustada.
// `proj` es uno de PROJ_PRESETS (string o objeto), default "seccion".
//
// v1.5.2: añadido `zoomFactor` opcional (por nivel) que multiplica la
// escala de entrada para que el bbox NO ocupe sólo el 50% del viewport.
// Antes el distrito entraba con ratio scale=fitScale → 58 secciones se
// veían como puntos negros porque cada una ocupaba ~20–40 px. Con
// zoomFactor 1.45 las secciones llenan ~70–80 % del viewport y se leen
// como piezas grandes. Importante: `fitScale` se mantiene como el
// "scale de referencia" (escala que hace fit exacto), de forma que los
// thresholds LOD relativos a fitScale siguen funcionando igual.
const ENTRY_ZOOM = {
  // 2026-05-19 — archipielago: entra al 100% para que las 7 islas
  // ocupen casi toda la pantalla con un poco de aire.
  archipielago: 1.0,
  isla: 1.0,
  municipio: 1.0,
  // v1.6 — bajado de 1.45 a 1.05 para "ampliar la cámara". Antes el
  // distrito quedaba muy zoom-in y las secciones urbanas se apilaban
  // visualmente. Con 1.05 hay aire suficiente alrededor para que cada
  // sección-edificio se lea como pieza individual.
  distrito: 1.05,
  // v1.6.barrio — el barrio tiene típicamente 3-30 secciones (vs 30-79
  // del distrito). Con un bbox más pequeño y un fitView "fresco" se ve
  // ampliado naturalmente; el zoomFactor sirve sólo como fallback en
  // barrios sin manzanas cargadas (el path normal usa el override de
  // silueta en enterBarrio, ver app.js FILL_V).
  // 2026-05-22 — subido de 1.8 → 2.5 porque la entrada quedaba con
  // mucho aire alrededor (silueta al 35-45% del viewport). Ahora el
  // bbox del barrio sí llena el viewport con autoridad incluso por
  // este path de fallback.
  barrio: 2.5,
  // v1.6.manzana (Phase 2b) — zoom cerrado para ver edificios grandes en
  // móvil con tap fiable. El bbox local de una manzana es típicamente
  // 40-120 m, así que con 3.5× de fitScale los edificios ocupan >60 px
  // y los hit-targets se tocan bien con el pulgar.
  manzana: 3.5,
  seccion: 1.05,
};

export function fitView(bbox, canvasW, canvasH, padPx = 80, proj = "seccion") {
  const preset = typeof proj === "string" ? PROJ_PRESETS[proj] : proj;
  const ax = preset?.ax ?? 30;
  const ay = preset?.ay ?? 30;
  const sz_factor = preset?.sz_factor ?? 1.4;
  const entryZoom = (typeof proj === "string" && ENTRY_ZOOM[proj]) || 1.0;
  // v1.6.barrio-clamp — Techo de zoom-in por nivel. Default 6× (legacy);
  // los niveles que prefieren bloquear el LOD intra-nivel (municipio,
  // barrio) lo declaran más bajo en PROJ_PRESETS.
  const maxZoomRatio = preset?.maxZoomRatio ?? 6.0;

  const [minx, miny, maxx, maxy] = bbox;
  const bw = maxx - minx;
  const bh = maxy - miny;
  // 2026-05-29 — Clamp a un mínimo positivo. En viewports muy estrechos
  // (split-view, paneles laterales) canvasW - 2·padPx podía volverse
  // negativo → baseScale negativo → scale negativo → render colapsado
  // (todo invertido, edificios invisibles). Garantizamos ≥40 px útiles.
  // 2026-06-01 — Inset superior por las barras de chrome (OCRE topbar +
  // tira de siluetas de islas) que se superponen sobre el #stage. Sin
  // esto, los topónimos del borde superior del mapa quedan recortados
  // bajo las barras. Centramos el mapa en el área visible bajo ellas.
  const TOP_INSET = 120;
  const availW = Math.max(40, canvasW - 2 * padPx);
  const availH = Math.max(40, canvasH - 2 * padPx - 60 - TOP_INSET); // banner + barras
  const mx = (minx + maxx) / 2;
  const my = (miny + maxy) / 2;

  // Modo plano top-down: el bbox cabe directamente en pantalla, sin rotación
  // iso. Preserva la proporción real de la geometría (clave para que la
  // silueta de GC se reconozca como en Google Maps).
  if (Math.abs(ax) < 0.5 && Math.abs(ay) < 0.5) {
    const baseScale = Math.min(availW / Math.max(bw, 1),
                               availH / Math.max(bh, 1));
    const scale = baseScale * entryZoom;
    return {
      scale,
      minScale: baseScale * 0.5,
      maxScale: baseScale * maxZoomRatio,
      fitScale: baseScale,
      cx: canvasW / 2,
      cy: (canvasH + TOP_INSET) / 2 + 24,
      tx: mx,
      ty: my,
      ax, ay, sz_factor
    };
  }

  const cax = Math.cos(deg2rad(ax));
  const say = Math.sin(deg2rad(ay));
  const spanW = (bw + bh) * cax;
  const spanH = (bw + bh) * say;
  const baseScale = Math.min(availW / Math.max(spanW, 1),
                             availH / Math.max(spanH, 1));
  const scale = baseScale * entryZoom;
  return {
    scale,
    minScale: baseScale * 0.5,
    maxScale: baseScale * maxZoomRatio,
    fitScale: baseScale,
    cx: canvasW / 2,
    cy: canvasH / 2 + 24,
    // v1.6 — tx/ty en world-coords (consistente con la rama plano).
    // La proyección iso resta tx/ty antes de aplicar la rotación
    // (x-z, x+z), así que el resultado coincide algebraicamente con
    // el legacy: (x-z)*cax - (mx-my)*cax == ((x-tx) - (z-ty))*cax.
    tx: mx,
    ty: my,
    ax, ay, sz_factor
  };
}

// Test punto-en-polígono (ray casting) en coordenadas de pantalla.
export function pointInScreenPolygon(px, py, ringPx) {
  let inside = false;
  for (let i = 0, j = ringPx.length - 1; i < ringPx.length; j = i++) {
    const [xi, yi] = ringPx[i];
    const [xj, yj] = ringPx[j];
    const intersect =
      (yi > py) !== (yj > py) &&
      px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Centroide aproximado (media simple) de un anillo.
export function ringCentroid(ring) {
  let sx = 0, sz = 0;
  for (const [x, z] of ring) { sx += x; sz += z; }
  return [sx / ring.length, sz / ring.length];
}

// bbox de un anillo en mundo.
export function ringBbox(ring) {
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const [x, z] of ring) {
    if (x < minx) minx = x;
    if (x > maxx) maxx = x;
    if (z < miny) miny = z;
    if (z > maxy) maxy = z;
  }
  return [minx, miny, maxx, maxy];
}

// Convierte (lng, lat) a metros locales relativos a un anchor [lngRef, latRef].
// Útil para isla/municipio donde no usamos los ENU del data pack.
// Convención: x = este, z = sur (igual que en el data pack).
export function lnglatToLocalMeters(lng, lat, anchor) {
  const [lngRef, latRef] = anchor;
  const M_PER_DEG_LAT = 111132.0;
  const M_PER_DEG_LNG = 111320.0 * Math.cos(latRef * Math.PI / 180);
  const x = (lng - lngRef) * M_PER_DEG_LNG;
  const z = -(lat - latRef) * M_PER_DEG_LAT; // norte→sur ⇒ z positivo al sur
  return [x, z];
}

// Helper inverso que conserva la firma del proyectado para rings ya
// convertidos. Suelo y altura.
export function projectFeatureRing(ring, view) {
  const out = new Array(ring.length);
  for (let i = 0; i < ring.length; i++) {
    out[i] = project(ring[i][0], 0, ring[i][1], view);
  }
  return out;
}
