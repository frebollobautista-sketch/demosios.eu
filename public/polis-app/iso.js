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
export const PROJ_PRESETS = {
  isla:      { ax: 0,  ay: 0,  sz_factor: 0.0 },  // top-down puro
  municipio: { ax: 0,  ay: 0,  sz_factor: 0.0 },  // v1.5: aplanado
  distrito:  { ax: 30, ay: 30, sz_factor: 1.6 },  // iso completa, relieve
  seccion:   { ax: 30, ay: 30, sz_factor: 1.4 },
};

function deg2rad(d) { return d * Math.PI / 180; }

// Proyecta un punto del mundo (x_m, y_m, z_m) a coordenadas de pantalla.
// `view` controla pan/zoom y opcionalmente trae los ángulos.
//   - Si view.ax === 0 && view.ay === 0 → modo plano top-down (mapa).
//   - Si no, modo iso clásico (interpolación angular durante anim).
export function project(x, y, z, view) {
  const sxy = view.scale;
  const ax = view.ax !== undefined ? view.ax : 30;
  const ay = view.ay !== undefined ? view.ay : 30;
  const sz_factor = view.sz_factor !== undefined ? view.sz_factor : 1.4;

  // Modo plano top-down. Se activa cuando ax y ay son ambos ~0 (con un
  // umbral pequeño para que la animación de transición no oscile).
  if (Math.abs(ax) < 0.5 && Math.abs(ay) < 0.5) {
    const px = view.cx + (x - view.tx) * sxy;
    const py = view.cy + (z - view.ty) * sxy;
    return [px, py];
  }

  const sz = view.scale * sz_factor;
  const cax = Math.cos(deg2rad(ax));
  const say = Math.sin(deg2rad(ay));
  const px = view.cx + ((x - z) * cax - view.tx) * sxy;
  const py = view.cy + ((x + z) * say - view.ty) * sxy - y * sz;
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
  isla: 1.0,
  municipio: 1.0,
  distrito: 1.45,   // 58 secciones se ven como piezas, no como puntos
  seccion: 1.05,
};

export function fitView(bbox, canvasW, canvasH, padPx = 80, proj = "seccion") {
  const preset = typeof proj === "string" ? PROJ_PRESETS[proj] : proj;
  const ax = preset?.ax ?? 30;
  const ay = preset?.ay ?? 30;
  const sz_factor = preset?.sz_factor ?? 1.4;
  const entryZoom = (typeof proj === "string" && ENTRY_ZOOM[proj]) || 1.0;

  const [minx, miny, maxx, maxy] = bbox;
  const bw = maxx - minx;
  const bh = maxy - miny;
  const availW = canvasW - 2 * padPx;
  const availH = canvasH - 2 * padPx - 60; // banner
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
      maxScale: baseScale * 6,
      fitScale: baseScale,
      cx: canvasW / 2,
      cy: canvasH / 2 + 24,
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
    maxScale: baseScale * 6,
    fitScale: baseScale,
    cx: canvasW / 2,
    cy: canvasH / 2 + 24,
    tx: (mx - my) * cax,
    ty: (mx + my) * say,
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
