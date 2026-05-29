// Overlay "Movilidad suave" — carriles bici, peatonales, zonas 30 y
// calles pacificadas (living_street). Indicador MOV-02 del visor OCRE.
//
// Fuente: `data/movilidad-suave-canarias.geojson`
//   generado por scripts/extract-movilidad-suave.py (OSM Geofabrik).
//
// Patrón de overlay: combinación de cobertura.js (polígonos) + guaguas.js
// (líneas). Aquí el dataset es 99% LineString — los polígonos peatonales
// (highway=pedestrian + area=yes) se serializan también como LineString
// cerrado y se reconocen por la coincidencia primer==último vértice
// (flagged en property `is_area`).
//
// Render por tipo:
//   cycleway      → trazo verde brillante grueso (carril bici)
//   footway       → trazo ocre fino y translúcido (peatonal estrecha)
//   pedestrian    → polígono amarillo translúcido cuando cerrado,
//                   trazo amarillo si lineal (calle peatonal estrecha)
//   zona30        → trazo naranja punteado (calmado urbano)
//   living_street → polígono verde-amarillo alpha bajo cuando cerrado,
//                   trazo del mismo color si lineal
//
// Niveles: municipio · distrito · barrio · sección. En isla/archipiélago
// satura y no aporta señal — el dataset son ~42k líneas para Canarias.

import { project, lnglatToLocalMeters } from "../iso.js";

const DATA_URL = "../data/movilidad-suave-canarias.geojson?v=20260527-movsuave-v0";
const GC_ANCHOR = [-15.55, 28.05];

// --- estilos por tipo -----------------------------------------------------
// Colores coherentes con la paleta ocre/sand del visor: verdes saturados
// para movilidad activa, ocres tenues para peatonales, naranjas para
// zonas calmadas.
const STYLE = {
  cycleway: {
    label: "Carril bici",
    stroke: "#3FAE5C",      // verde brillante
    strokeAlpha: 0.85,
    width: 2.5,
    dash: null,
    fill: null,
    fillAlpha: 0
  },
  footway: {
    label: "Peatonal",
    stroke: "#A37945",      // ocre suave
    strokeAlpha: 0.55,
    width: 1.5,
    dash: null,
    fill: null,
    fillAlpha: 0
  },
  pedestrian: {
    label: "Zona peatonal",
    stroke: "#D9B43A",      // amarillo
    strokeAlpha: 0.75,
    width: 2,
    dash: null,
    fill: "#EDD167",        // amarillo translúcido para zonas cerradas
    fillAlpha: 0.40
  },
  zona30: {
    label: "Zona 30",
    stroke: "#E68A4F",      // naranja
    strokeAlpha: 0.85,
    width: 2,
    dash: [6, 4],           // punteado
    fill: null,
    fillAlpha: 0
  },
  living_street: {
    label: "Calle pacificada",
    stroke: "#8AB04A",      // verde-amarillo
    strokeAlpha: 0.7,
    width: 1.8,
    dash: null,
    fill: "#B6C76B",
    fillAlpha: 0.30
  }
};

const TIPOS = ["cycleway", "footway", "pedestrian", "zona30", "living_street"];

// Tipos visibles — el overlay arranca con todos activos. UI futura
// (sub-chips) actuará sobre este Set vía setTipoEnabled().
const _enabled = new Set(TIPOS);

// Cada feature preproyectada vive como:
//   { tipo, pts:[[mx,mz],...], bbox:[minX,minZ,maxX,maxZ], closed }
let _features = null;
let _bbox = null;
let _loadingPromise = null;
let _counts = {};

// --- utilidades -----------------------------------------------------------

function _bboxAccum(b, mx, mz) {
  if (mx < b[0]) b[0] = mx;
  if (mz < b[1]) b[1] = mz;
  if (mx > b[2]) b[2] = mx;
  if (mz > b[3]) b[3] = mz;
}

function _bboxIntersects(a, b) {
  if (!a || !b) return true;
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
}

function _projectLine(coords) {
  const pts = new Array(coords.length);
  const bb = [Infinity, Infinity, -Infinity, -Infinity];
  for (let i = 0; i < coords.length; i++) {
    const c = coords[i];
    const [mx, mz] = lnglatToLocalMeters(c[0], c[1], GC_ANCHOR);
    pts[i] = [mx, mz];
    _bboxAccum(bb, mx, mz);
  }
  return { pts, bbox: bb };
}

async function _load() {
  if (_features) return _features;
  if (_loadingPromise) return _loadingPromise;
  _loadingPromise = fetch(DATA_URL, { cache: "force-cache" })
    .then(r => r.ok ? r.json() : Promise.reject(new Error("status " + r.status)))
    .then(json => {
      const out = [];
      const bb = [Infinity, Infinity, -Infinity, -Infinity];
      const counts = {};
      for (const f of (json.features || [])) {
        const tipo = f.properties && f.properties.tipo;
        if (!tipo || !STYLE[tipo]) continue;
        const g = f.geometry;
        if (!g || g.type !== "LineString" || !g.coordinates || g.coordinates.length < 2) continue;
        const { pts, bbox } = _projectLine(g.coordinates);
        // Cerrado: primera == última coordenada (en lng/lat antes de proyectar).
        const first = g.coordinates[0];
        const last = g.coordinates[g.coordinates.length - 1];
        const closed = first[0] === last[0] && first[1] === last[1];
        out.push({
          tipo,
          pts,
          bbox,
          closed,
          name: (f.properties && f.properties.name) || null
        });
        counts[tipo] = (counts[tipo] || 0) + 1;
        _bboxAccum(bb, bbox[0], bbox[1]);
        _bboxAccum(bb, bbox[2], bbox[3]);
      }
      _features = out;
      _bbox = isFinite(bb[0]) ? bb : null;
      _counts = counts;
      return _features;
    })
    .catch(err => {
      console.warn("[movilidadSuaveOverlay] load fallo:", err);
      _features = null;
      _loadingPromise = null;
      return null;
    });
  return _loadingPromise;
}

// --- render ---------------------------------------------------------------

function _drawFeature(ctx, f, view) {
  const s = STYLE[f.tipo];
  if (!s) return;
  const pts = f.pts;
  if (pts.length < 2) return;

  // Construye path una sola vez (puede usarse para fill y/o stroke).
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const [px, py] = project(pts[i][0], 0, pts[i][1], view);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }

  // Fill SOLO para polígonos cerrados con estilo fill (pedestrian, living_street).
  if (s.fill && f.closed) {
    ctx.closePath();
    ctx.globalAlpha = s.fillAlpha;
    ctx.fillStyle = s.fill;
    ctx.fill();
  }

  // Stroke en todos los casos.
  ctx.globalAlpha = s.strokeAlpha;
  ctx.strokeStyle = s.stroke;
  ctx.lineWidth = s.width;
  if (s.dash && ctx.setLineDash) {
    ctx.setLineDash(s.dash);
  } else if (ctx.setLineDash) {
    ctx.setLineDash([]);
  }
  ctx.stroke();
}

// Devuelve el bbox del nivel actual o `undefined` si el nivel no aplica.
function _clipBboxForLevel(state) {
  const lvl = state && state.lodLevel;
  if (lvl === "municipio") return state.municipio && state.municipio.bbox || null;
  if (lvl === "distrito")  return state.district  && state.district.bbox  || null;
  if (lvl === "barrio")    return state.barrio    && state.barrio.bbox    || null;
  if (lvl === "seccion")   return state.section   && (state.section.bbox || state.section._bbox) || null;
  return undefined;
}

// --- API pública ----------------------------------------------------------

export const movilidadSuaveOverlay = {
  id: "movilidad-suave",
  name: "Movilidad suave",
  category: "movilidad",
  levels: ["municipio", "distrito", "barrio", "seccion"],

  load: _load,
  isReady: () => Array.isArray(_features),

  draw: (ctx, state, view) => {
    if (!_features || !_features.length) return;
    if (!state || !view) return;
    const clip = _clipBboxForLevel(state);
    if (clip === undefined) return;            // nivel no soportado
    if (clip && _bbox && !_bboxIntersects(clip, _bbox)) return;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Orden de pintado: primero fills (pedestrian/living_street polígonos
    // grandes que sirven de "fondo"), luego footway/zona30 finas, luego
    // cycleway encima para que destaque. Iteramos en este orden:
    const ORDER = ["living_street", "pedestrian", "footway", "zona30", "cycleway"];
    for (const tipo of ORDER) {
      if (!_enabled.has(tipo)) continue;
      for (let i = 0; i < _features.length; i++) {
        const f = _features[i];
        if (f.tipo !== tipo) continue;
        if (!_bboxIntersects(f.bbox, clip)) continue;
        _drawFeature(ctx, f, view);
      }
    }

    // Reset línea discontinua para no contaminar otros overlays posteriores.
    if (ctx.setLineDash) ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.restore();
  },

  // --- sub-chips: filtrado por tipo ---------------------------------------
  getCategoryOptions: () => TIPOS.map(t => ({
    key: t,
    label: STYLE[t].label,
    fill: STYLE[t].fill || STYLE[t].stroke,
    count: _counts[t] || 0,
    enabled: _enabled.has(t)
  })),

  setTipoEnabled: (tipo, on) => {
    if (!STYLE[tipo]) return;
    if (on) _enabled.add(tipo);
    else _enabled.delete(tipo);
  },

  toggleTipo: (tipo) => {
    if (!STYLE[tipo]) return;
    if (_enabled.has(tipo)) _enabled.delete(tipo);
    else _enabled.add(tipo);
  },

  getEnabledTipos: () => Array.from(_enabled),
  getCounts: () => Object.assign({}, _counts),
  getBbox: () => _bbox
};
