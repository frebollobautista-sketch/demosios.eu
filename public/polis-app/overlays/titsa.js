// Overlay "Paradas Titsa (líneas)" — paradas de la red interurbana de
// Tenerife enriquecidas con número de líneas y trips/día (GTFS Titsa).
//
// Diferencia con `guaguas` y `cobertura`:
//   · guaguas pinta paradas + LineString por línea (LPGC).
//   · cobertura pinta radios isócronos en metros (cualquier red).
//   · titsa pinta UN TRIÁNGULO por parada coloreado por nº de líneas
//     que la sirven — un indicador de "calidad de servicio" agregada
//     sin saturar el lienzo con polilíneas.
//
// Fuente:
//   data/titsa-stops.json (extract-titsa-gtfs.py · GTFS Titsa semanal)
//
// Patrón de overlay: clon estructural de productores.js (pin con glifo,
// cluster por proximidad). Anchor común GC_ANCHOR — la proyección iso
// es archipelágica, cualquier isla cae en el frame local.

import { project, lnglatToLocalMeters } from "../iso.js";

const DATA_URL = "../data/titsa-stops.json?v=20260527-titsa-v0";
const GC_ANCHOR = [-15.55, 28.05];

// Triángulo verde-azulado escalado por nº de líneas. Naranja para
// intercambiadores (11+) — visualmente "calientes" como los nodos
// hub de la red.
const ROUTE_BUCKETS = [
  { max: 2,        fill: "#A8C8D8", label: "1-2 líneas" }, // azul pálido
  { max: 5,        fill: "#5FA88A", label: "3-5 líneas" }, // verde
  { max: 10,       fill: "#A37945", label: "6-10 líneas" }, // ocre
  { max: Infinity, fill: "#E68A4F", label: "11+ líneas (hub)" } // naranja
];

const MARKER_R = 10;     // semilado del triángulo
const POLE_H = 10;
const CLUSTER_PX = 25;

let _stops = null;
let _meta = null;
let _loadingPromise = null;
let _bbox = null;

function _bucketFor(routesCount) {
  for (const b of ROUTE_BUCKETS) if (routesCount <= b.max) return b;
  return ROUTE_BUCKETS[ROUTE_BUCKETS.length - 1];
}

function _bboxAccum(b, mx, mz) {
  if (mx < b[0]) b[0] = mx;
  if (mz < b[1]) b[1] = mz;
  if (mx > b[2]) b[2] = mx;
  if (mz > b[3]) b[3] = mz;
}

async function _load() {
  if (_stops) return _stops;
  if (_loadingPromise) return _loadingPromise;
  _loadingPromise = fetch(DATA_URL, { cache: "no-cache" })
    .then(r => r.ok ? r.json() : Promise.reject(new Error("status " + r.status)))
    .then(json => {
      _meta = {
        version: json.version,
        fuente: json.fuente,
        actualizado: json.actualizado,
        n_stops: json.n_stops,
        n_routes: json.n_routes,
        routes: json.routes || []
      };
      const out = [];
      const bb = [Infinity, Infinity, -Infinity, -Infinity];
      for (const s of (json.stops || [])) {
        if (typeof s.lng !== "number" || typeof s.lat !== "number") continue;
        const [mx, mz] = lnglatToLocalMeters(s.lng, s.lat, GC_ANCHOR);
        _bboxAccum(bb, mx, mz);
        out.push({
          id: s.id,
          mx, mz,
          properties: {
            id: s.id,
            name: s.name,
            routes_count: s.routes_count,
            routes: s.routes,
            trips_per_day: s.trips_per_day
          }
        });
      }
      _stops = out;
      _bbox = isFinite(bb[0]) ? bb : null;
      return _stops;
    })
    .catch(err => {
      console.warn("[titsaOverlay] load fallo:", err);
      _stops = null;
      _loadingPromise = null;
      return null;
    });
  return _loadingPromise;
}

function _inBbox(mx, mz, bbox) {
  if (!bbox) return true;
  const [a, b, c, d] = bbox;
  return mx >= a && mx <= c && mz >= b && mz <= d;
}

function _bboxIntersects(a, b) {
  if (!a || !b) return true;
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
}

function _drawPin(ctx, px, py, fill, label) {
  // Asta vertical (anclaje al suelo).
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px, py - POLE_H);
  ctx.strokeStyle = "#1A1612";
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Triángulo equilátero apuntando hacia arriba — distintivo frente a los
  // cuadrados/círculos de eventos, productores y calidad-aire.
  const cy = py - POLE_H - MARKER_R + 2;
  const h = MARKER_R * 1.7;
  ctx.beginPath();
  ctx.moveTo(px, cy - h * 0.55);             // vértice superior
  ctx.lineTo(px - MARKER_R, cy + h * 0.45);  // base izda
  ctx.lineTo(px + MARKER_R, cy + h * 0.45);  // base dcha
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#1A1612";
  ctx.stroke();

  // Glifo: número de líneas (o "+" cuando es cluster con valores mixtos).
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 10px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Centrar ópticamente dentro del triángulo (algo por debajo del centro
  // geométrico — la base ancha desequilibra hacia abajo).
  ctx.fillText(label, px, cy + 1);

  // Anclaje inferior (mismo motivo que productores.js).
  ctx.beginPath();
  ctx.arc(px, py, 2.2, 0, Math.PI * 2);
  ctx.fillStyle = "#1A1612";
  ctx.fill();
}

// Devuelve el bbox del nivel actual. En isla saturan demasiado — el
// renderer ya nos filtra por niveles vía META.levels, pero ponemos
// defensivamente un return null aquí para no pintar si llegáramos.
function _clipBboxForLevel(state) {
  const lvl = state && state.lodLevel;
  if (lvl === "municipio") return state.municipio?.bbox || null;
  if (lvl === "distrito")  return state.district?.bbox || null;
  if (lvl === "barrio")    return state.barrio?.bbox || null;
  if (lvl === "seccion")   return state.section?.bbox || state.section?._bbox || null;
  return undefined;  // undefined → no aplica este nivel; null → todo
}

export const titsaOverlay = {
  id: "titsa",
  name: "Paradas Titsa (líneas)",
  category: "movilidad",
  levels: ["municipio", "distrito", "barrio", "seccion"],

  load: _load,
  isReady: () => Array.isArray(_stops),

  draw: (ctx, state, view) => {
    if (!_stops || !_stops.length) return;
    if (!state || !view) return;
    const clip = _clipBboxForLevel(state);
    if (clip === undefined) return; // nivel no soportado (isla/archipielago)
    if (clip && _bbox && !_bboxIntersects(clip, _bbox)) return;

    const projected = [];
    for (const s of _stops) {
      if (!_inBbox(s.mx, s.mz, clip)) continue;
      const [px, py] = project(s.mx, 0, s.mz, view);
      projected.push({ s, px, py });
    }
    if (!projected.length) return;

    // Cluster por proximidad-pantalla (mismo método que productores).
    const clusters = [];
    const claimed = new Uint8Array(projected.length);
    for (let i = 0; i < projected.length; i++) {
      if (claimed[i]) continue;
      const c = {
        px: projected[i].px,
        py: projected[i].py,
        stops: [projected[i].s]
      };
      claimed[i] = 1;
      for (let j = i + 1; j < projected.length; j++) {
        if (claimed[j]) continue;
        const dx = projected[j].px - c.px;
        const dy = projected[j].py - c.py;
        if (dx*dx + dy*dy <= CLUSTER_PX*CLUSTER_PX) {
          c.stops.push(projected[j].s);
          claimed[j] = 1;
        }
      }
      clusters.push(c);
    }

    ctx.save();
    for (const c of clusters) {
      // Para clusters: usamos el routes_count MÁXIMO (la parada "más
      // hub" del cluster manda el color, como si la representara).
      let maxRoutes = 0;
      for (const s of c.stops) {
        const rc = s.properties?.routes_count || 0;
        if (rc > maxRoutes) maxRoutes = rc;
      }
      const bucket = _bucketFor(maxRoutes);
      const label = c.stops.length > 1
        ? `${c.stops.length}·${maxRoutes}`
        : String(maxRoutes);
      _drawPin(ctx, c.px, c.py, bucket.fill, label);
    }
    ctx.restore();
  },

  hitTest: (px, py, state, view) => {
    if (!_stops || !_stops.length) return null;
    const clip = _clipBboxForLevel(state);
    if (clip === undefined) return null;
    let best = null;
    let bestD2 = (MARKER_R + 6) * (MARKER_R + 6);
    for (const s of _stops) {
      if (!_inBbox(s.mx, s.mz, clip)) continue;
      const [epx, epy] = project(s.mx, 0, s.mz, view);
      const cy = epy - POLE_H - MARKER_R + 2;
      const dx = px - epx;
      const dy = py - cy;
      const d2 = dx*dx + dy*dy;
      if (d2 < bestD2) { bestD2 = d2; best = s; }
    }
    return best;
  },

  // Acceso a metadatos y catálogo de rutas (para popups o UI futura).
  getMeta: () => _meta,
  getAllStops: () => (_stops ? _stops.slice() : []),
  getBbox: () => _bbox,

  // Para UI de leyenda — mismo shape que `getCategoryOptions` de otros
  // overlays, pero aquí son tramos de "calidad de servicio" en vez de
  // categorías discretas.
  getCategoryOptions: () => ROUTE_BUCKETS.map((b, i) => ({
    key: `tramo-${i}`,
    label: b.label,
    fill: b.fill
  }))
};
