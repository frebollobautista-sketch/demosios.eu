// Overlay "Listas de espera SCS" — hospitales del Servicio Canario de
// Salud con datos de lista de espera quirúrgica. Portado del visor
// canónico MapLibre (polis-provincia.html · toggleListasEspera) al
// runtime iso vanilla 2D.
//
// API (igual que renta.js / vv.js):
//   listaEsperaOverlay.id        → "lista-espera"
//   listaEsperaOverlay.name      → "Listas de espera SCS"
//   listaEsperaOverlay.load()    → fetch geojson, preproyecta a metros
//                                  locales (cacheado, idempotente).
//   listaEsperaOverlay.isReady() → true cuando load() resolvió bien.
//   listaEsperaOverlay.draw(ctx, state, view) → render según lodLevel.
//
// Datos: pocos puntos (uno por isla en la prov35), cada uno con
// properties.total = personas en lista de espera quirúrgica. La
// severidad se codifica por color y radio, igual que el canónico.
//
// Paleta y umbrales: copiados de showListasEsperaLegend del canónico:
//   ~100   → #fad8b6 (radio 10)
//   ~8.000 → #c8632a (radio 14)
//  ~15.000 → #8a3a10 (radio 18)
// Interpolación lineal entre stops sobre la cuenta de personas.

import { project, lnglatToLocalMeters } from "../iso.js";

const DATA_URL = "../data/lista-espera-scs.geojson";
const GC_ANCHOR = [-15.55, 28.05];

// Stops del canónico (lista-espera-bubble paint step en MapLibre).
const STOPS = [
  { v:   100, color: [250, 216, 182], r: 10 }, // #fad8b6
  { v:  8000, color: [200,  99,  42], r: 14 }, // #c8632a
  { v: 15000, color: [138,  58,  16], r: 18 }, // #8a3a10
];

const STROKE = "rgba(20, 16, 10, 0.9)";
const STROKE_W = 2.5;
const CROSS_COLOR = "rgba(255, 248, 232, 0.95)";

let _points = null;       // [{ lng, lat, mx, my, props }]
let _loadingPromise = null;

function _lerp(a, b, t) { return a + (b - a) * t; }

function _styleFor(total) {
  const n = Number(total) || 0;
  // Por debajo del primer stop: clamp al color/radio del stop bajo.
  if (n <= STOPS[0].v) {
    return { color: STOPS[0].color, r: STOPS[0].r };
  }
  // Entre stops: interpolación lineal.
  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i], b = STOPS[i + 1];
    if (n <= b.v) {
      const t = (n - a.v) / (b.v - a.v);
      return {
        color: [
          _lerp(a.color[0], b.color[0], t),
          _lerp(a.color[1], b.color[1], t),
          _lerp(a.color[2], b.color[2], t)
        ],
        r: _lerp(a.r, b.r, t)
      };
    }
  }
  // Por encima del último stop: clamp.
  const last = STOPS[STOPS.length - 1];
  return { color: last.color, r: last.r };
}

function _rgb([r, g, b]) {
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

// Filtro por bbox local en metros (mx, my). El bbox lo derivamos del
// _localBbox que app.js ya calcula para municipios/distritos/secciones.
function _inBbox(p, bbox) {
  if (!bbox) return true;
  // bbox: [minX, minY, maxX, maxY] en metros locales.
  return p.mx >= bbox[0] && p.mx <= bbox[2]
      && p.my >= bbox[1] && p.my <= bbox[3];
}

function _drawHospital(ctx, p, view) {
  const { color, r } = _styleFor(p.props && p.props.total);
  const [px, py] = project(p.mx, 0, p.my, view);

  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fillStyle = _rgb(color);
  ctx.fill();
  ctx.lineWidth = STROKE_W;
  ctx.strokeStyle = STROKE;
  ctx.stroke();

  // Cruz médica centrada (dos líneas blancas formando +).
  const arm = Math.max(3, r * 0.55);
  ctx.beginPath();
  ctx.moveTo(px - arm, py);
  ctx.lineTo(px + arm, py);
  ctx.moveTo(px, py - arm);
  ctx.lineTo(px, py + arm);
  ctx.lineWidth = Math.max(1.5, r * 0.22);
  ctx.lineCap = "round";
  ctx.strokeStyle = CROSS_COLOR;
  ctx.stroke();
}

export const listaEsperaOverlay = {
  id: "lista-espera",
  name: "Listas de espera SCS",

  load: async () => {
    if (_points) return _points;
    if (_loadingPromise) return _loadingPromise;
    _loadingPromise = fetch(DATA_URL)
      .then(r => {
        if (!r.ok) throw new Error("lista-espera fetch " + r.status);
        return r.json();
      })
      .then(json => {
        const feats = (json && json.features) || [];
        const out = [];
        for (const f of feats) {
          const g = f && f.geometry;
          if (!g || g.type !== "Point") continue;
          const [lng, lat] = g.coordinates || [];
          if (typeof lng !== "number" || typeof lat !== "number") continue;
          const [mx, my] = lnglatToLocalMeters(lng, lat, GC_ANCHOR);
          out.push({ lng, lat, mx, my, props: f.properties || {} });
        }
        _points = out;
        return _points;
      })
      .catch(err => {
        console.warn("[listaEsperaOverlay] no se pudo cargar:", err);
        _points = null;
        _loadingPromise = null;
        return null;
      });
    return _loadingPromise;
  },

  isReady: () => _points !== null,

  // Render por nivel:
  //  - isla:      todos los hospitales (pocos, todos visibles).
  //  - municipio: solo los que caen dentro del bbox local del municipio.
  //  - distrito:  solo los que caen dentro del bbox local del distrito.
  //  - sección:   solo los que caen dentro del bbox local de la sección.
  draw: (ctx, state, view) => {
    if (!_points || !_points.length) return;
    if (!state || !view) return;

    const lvl = state.lodLevel;
    // 2026-05-31 — Baseline = bbox de la isla actual, para no dispersar
    // hospitales de otras islas (los datos del SCS son multi-isla). En
    // archipielago state.isla es null → bbox null → todos en su posición real.
    let bbox = (state.isla && state.isla.bbox) || null;
    if (lvl === "municipio")      bbox = (state.municipio && state.municipio._localBbox) || bbox;
    else if (lvl === "distrito")  bbox = (state.district  && state.district._localBbox) || bbox;
    else if (lvl === "seccion")   bbox = (state.section   && state.section._localBbox) || bbox;

    ctx.save();
    for (const p of _points) {
      if (bbox && !_inBbox(p, bbox)) continue;
      _drawHospital(ctx, p, view);
    }
    ctx.restore();
  }
};
