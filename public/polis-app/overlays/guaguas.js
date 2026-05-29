// Overlay "Guaguas LPGC" — paradas + líneas del transporte público
// municipal de Las Palmas de Gran Canaria (GTFS Guaguas Municipales).
// Portado del visor canónico MapLibre (polis-provincia.html ·
// toggleGuaguas / setupGuaguasLayer) al runtime iso vanilla 2D.
//
// API mínima (misma que renta.js):
//   guaguasOverlay.id        → identificador de capa
//   guaguasOverlay.name      → etiqueta human-readable (para el botón)
//   guaguasOverlay.load()    → fetch + preproyección + cache. Idempotente.
//   guaguasOverlay.isReady() → true si load() resolvió.
//   guaguasOverlay.draw(ctx, state, view) → pinta líneas y paradas
//       sobre el nivel municipio/distrito/sección cuando estamos en LPGC.
//       El renderer decide cuándo llamarlo en función de
//       state.activeOverlays.guaguas.
//
// Datos:
//   ../data/guaguas-paradas.geojson  (Point   · ~848 paradas)
//   ../data/guaguas-lineas.geojson   (MultiLineString · 47 líneas)
//
// Proyección:
//   En load() todo se transforma una vez de lng/lat → metros locales
//   (anclados en GC_ANCHOR, coherente con el resto del runtime iso).
//   En draw() sólo aplicamos project(mx, 0, mz, view) → pantalla.

import { project, lnglatToLocalMeters } from "../iso.js";

const PARADAS_URL = "../data/guaguas-paradas.geojson";
const LINEAS_URL  = "../data/guaguas-lineas.geojson";

// Mismo anclaje que usa el resto del runtime iso para Gran Canaria.
// Mantener en sync con app.js / iso.js si cambia.
const GC_ANCHOR = [-15.55, 28.05];

// Color fallback cuando una línea no trae `color` en properties.
// Naranja accent del runtime — destaca sobre la calle gris (#6B6358).
const LINE_DEFAULT_COLOR = "#E68A4F";

// Paint params (matcheando paridad cromática con el canónico
// MapLibre, ajustados a la escala fija del Canvas2D iso).
const LINE_WIDTH       = 2.4;
const LINE_ALPHA       = 0.78;
const STOP_RADIUS      = 3.0;
const STOP_FILL        = "rgba(255,255,255,0.95)";
const STOP_STROKE      = "rgba(15,12,10,0.9)";
const STOP_STROKE_W    = 1.4;

// Cache module-scope. _paradas[i] = { mx, mz, props }.
// _lineas[i] = { color, parts: [ [ [mx,mz], … ], … ] } (multilínea).
// _bbox = bbox global del conjunto de paradas en metros locales,
//         [minX, minZ, maxX, maxZ] — sirve para descartar rápido
//         niveles que no caen sobre LPGC.
let _paradas = null;
let _lineas  = null;
let _bbox    = null;
let _loadingPromise = null;

// --- helpers --------------------------------------------------------

function _normalizeColor(raw) {
  if (!raw || typeof raw !== "string") return LINE_DEFAULT_COLOR;
  const c = raw.trim();
  if (!c) return LINE_DEFAULT_COLOR;
  return c.startsWith("#") ? c : "#" + c;
}

function _bboxAccum(bbox, mx, mz) {
  if (mx < bbox[0]) bbox[0] = mx;
  if (mz < bbox[1]) bbox[1] = mz;
  if (mx > bbox[2]) bbox[2] = mx;
  if (mz > bbox[3]) bbox[3] = mz;
}

function _bboxIntersects(a, b) {
  if (!a || !b) return true;
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
}

function _pointInBbox(mx, mz, b) {
  if (!b) return true;
  return mx >= b[0] && mx <= b[2] && mz >= b[1] && mz <= b[3];
}

// Preproyecta paradas: GeoJSON Point → { mx, mz, props }.
function _prepareParadas(geojson) {
  const out = [];
  const features = (geojson && geojson.features) || [];
  for (const f of features) {
    if (!f.geometry || f.geometry.type !== "Point") continue;
    const c = f.geometry.coordinates;
    if (!c || c.length < 2) continue;
    const [mx, mz] = lnglatToLocalMeters(c[0], c[1], GC_ANCHOR);
    out.push({ mx, mz, props: f.properties || {} });
  }
  return out;
}

// Preproyecta líneas: LineString o MultiLineString → array de partes.
function _prepareLineas(geojson) {
  const out = [];
  const features = (geojson && geojson.features) || [];
  for (const f of features) {
    if (!f.geometry) continue;
    const g = f.geometry;
    let multi;
    if (g.type === "LineString")        multi = [g.coordinates];
    else if (g.type === "MultiLineString") multi = g.coordinates;
    else continue;

    const parts = [];
    const partBboxes = [];
    for (const line of multi) {
      if (!line || line.length < 2) continue;
      const pts = new Array(line.length);
      const bb = [Infinity, Infinity, -Infinity, -Infinity];
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        const [mx, mz] = lnglatToLocalMeters(c[0], c[1], GC_ANCHOR);
        pts[i] = [mx, mz];
        _bboxAccum(bb, mx, mz);
      }
      parts.push(pts);
      partBboxes.push(bb);
    }
    if (!parts.length) continue;

    const props = f.properties || {};
    out.push({
      color: _normalizeColor(props.color),
      props,
      parts,
      partBboxes
    });
  }
  return out;
}

// Bbox global a partir de las paradas (más estable que las líneas,
// que pueden tener vértices duplicados o cabos sueltos).
function _computeBbox(paradas) {
  const bb = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of paradas) _bboxAccum(bb, p.mx, p.mz);
  if (!isFinite(bb[0])) return null;
  return bb;
}

// --- render ---------------------------------------------------------

function _drawLineas(ctx, view, clipBbox) {
  if (!_lineas || !_lineas.length) return;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = LINE_WIDTH;
  ctx.globalAlpha = LINE_ALPHA;

  for (const ln of _lineas) {
    ctx.strokeStyle = ln.color;
    for (let pi = 0; pi < ln.parts.length; pi++) {
      const bb = ln.partBboxes[pi];
      if (!_bboxIntersects(bb, clipBbox)) continue;
      const pts = ln.parts[pi];
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const [sx, sy] = project(pts[i][0], 0, pts[i][1], view);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

function _drawParadas(ctx, view, clipBbox) {
  if (!_paradas || !_paradas.length) return;
  ctx.lineWidth = STOP_STROKE_W;
  ctx.strokeStyle = STOP_STROKE;
  ctx.fillStyle = STOP_FILL;
  for (const p of _paradas) {
    if (!_pointInBbox(p.mx, p.mz, clipBbox)) continue;
    const [sx, sy] = project(p.mx, 0, p.mz, view);
    ctx.beginPath();
    ctx.arc(sx, sy, STOP_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

// Devuelve el bbox del nivel actual o null si no aplica.
// El renderer ya filtra por nivel — aquí sólo decidimos qué bbox de
// recorte usamos para descartar paradas/líneas fuera de pantalla.
function _clipBboxForLevel(state) {
  const lvl = state && state.lodLevel;
  if (lvl === "municipio") return state.municipio && state.municipio.bbox;
  if (lvl === "distrito")  return state.district  && state.district.bbox;
  if (lvl === "seccion")   return state.section   && state.section.bbox;
  return null;
}

// --- public ---------------------------------------------------------

export const guaguasOverlay = {
  id: "guaguas",
  name: "Guaguas LPGC",
  category: "movilidad",
  levels: ["municipio", "distrito", "seccion"],

  load: async () => {
    if (_paradas && _lineas) return { paradas: _paradas, lineas: _lineas };
    if (_loadingPromise) return _loadingPromise;
    _loadingPromise = Promise.all([
      fetch(PARADAS_URL).then(r => {
        if (!r.ok) throw new Error("guaguas paradas fetch " + r.status);
        return r.json();
      }),
      fetch(LINEAS_URL).then(r => {
        if (!r.ok) throw new Error("guaguas lineas fetch " + r.status);
        return r.json();
      })
    ])
      .then(([paradasJson, lineasJson]) => {
        _paradas = _prepareParadas(paradasJson);
        _lineas  = _prepareLineas(lineasJson);
        _bbox    = _computeBbox(_paradas);
        return { paradas: _paradas, lineas: _lineas };
      })
      .catch(err => {
        console.warn("[guaguasOverlay] no se pudo cargar:", err);
        _paradas = null;
        _lineas  = null;
        _bbox    = null;
        _loadingPromise = null;
        return null;
      });
    return _loadingPromise;
  },

  isReady: () => _paradas !== null && _lineas !== null,

  getAllParadas: () => (_paradas ? _paradas.slice() : []),
  getAllLineas: () => (_lineas ? _lineas.slice() : []),

  // Render por nivel:
  //  - isla:      omitido (a esa escala una marisma de puntos amazaca
  //               el mapa; los datos sólo cubren LPGC).
  //  - municipio: si es LPGC (bbox intersecta), líneas + paradas
  //               recortadas al bbox del municipio.
  //  - distrito:  igual, recorte al bbox del distrito.
  //  - sección:   paradas individuales + tramos de líneas que cruzan.
  draw: (ctx, state, view) => {
    if (!_paradas || !_lineas) return;
    if (!state || !view) return;
    const lvl = state.lodLevel;
    if (lvl !== "municipio" && lvl !== "distrito" && lvl !== "seccion") return;

    const clip = _clipBboxForLevel(state);
    // Si tenemos bbox del nivel y bbox global de guaguas y no se
    // tocan, no hay nada que pintar (probablemente isla ≠ GC o
    // municipio ≠ LPGC).
    if (clip && _bbox && !_bboxIntersects(clip, _bbox)) return;

    ctx.save();
    _drawLineas(ctx, view, clip);
    _drawParadas(ctx, view, clip);
    ctx.restore();
  },

  // Bbox global de la red (útil para zoom-to o tests). En metros
  // locales, mismo frame que el resto del runtime iso.
  getBbox: () => _bbox
};
