// Overlay "Barrios (identitario)" — pinta las secciones censales agrupadas
// por barrio con un color vivaracho por barrio + label con el nombre
// del barrio en el centroide de la unión de sus secciones.
//
// API estándar (igual que renta.js):
//   barriosOverlay.id        → "barrios"
//   barriosOverlay.name      → "Barrios (identitario)"
//   barriosOverlay.load()    → fetch + cache + cómputo de centroides
//   barriosOverlay.isReady() → true si load() resolvió
//   barriosOverlay.draw(ctx, state, view) → pinta en niveles mun/distrito
//
// Datos: /data/barrios-canonical.json (164 barrios prov 35, agregados OSM
// con mapping barrio → cusecs). Estructura mínima usada por este overlay:
//   { barrios: { <barrioId>: { name, mun, secciones_origen: [cusec, …] } } }
// `secciones_origen` se normaliza a `sections` en load() para mantener
// el código del overlay sencillo.
//
// Render por nivel:
//   - isla:      omitido (fuera de escala barrio)
//   - municipio: pinta cada sección que pertenece a un barrio LPGC con el
//                color de ese barrio + label del barrio en su centroide.
//   - distrito:  igual, pero filtrado a secciones del distrito visible.
//   - barrio:    omitido (ya estás dentro de un barrio)
//   - sección:   omitido
//
// Tap → enterBarrio: fuera de scope en esta versión. Ver TODO al final.

import { project, ringCentroid } from "../iso.js";

const DATA_URL = "../data/barrios-canonical.json";

// Paleta vivaracha — 34 colores contrastantes pensados para fondo arena/ocre.
// Con 164 barrios se reutiliza por mod-34 (asignación determinística por orden
// alfabético del barrioId; colisiones se aceptan: dos barrios alejados pueden
// compartir color sin confusión perceptiva).
const PALETTE = [
  "#e94e4e", "#ff8a3d", "#ffc94e", "#c4d63a", "#5cd676",
  "#34c8a4", "#3dbbf0", "#6a83f5", "#a45fea", "#e94eb0",
  "#ffae84", "#d4a05a", "#b87333", "#6ba43a", "#2e8b57",
  "#1f9ec4", "#1e6db8", "#5a3ea1", "#c44d8c", "#a8324a",
  "#f06292", "#ba68c8", "#7e57c2", "#5c6bc0", "#26a69a",
  "#9ccc65", "#fdd835", "#fb8c00", "#8d6e63", "#78909c",
  "#ef5350", "#ab47bc", "#42a5f5", "#66bb6a"
];

const FILL_ALPHA   = 0.45;
const STROKE_ALPHA = 0.95;

let _data = null;            // raw json
let _byCusec = null;         // Map<cusec, barrioId>
let _byBarrio = null;        // Map<barrioId, { name, color, sections:[], centroidM:null }>
let _loadingPromise = null;

function _hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16)
  ];
}

function _rgba([r, g, b], a) {
  return `rgba(${r},${g},${b},${a})`;
}

function _buildIndexes(json) {
  // Orden alfabético determinista por barrioId para que el color sea estable
  // entre cargas/usuarios.
  const ids = Object.keys(json.barrios || {}).sort();
  _byBarrio = new Map();
  _byCusec  = new Map();
  ids.forEach((id, i) => {
    const meta = json.barrios[id];
    const color = PALETTE[i % PALETTE.length];
    _byBarrio.set(id, {
      id,
      name: meta.name || id,
      color,
      rgb: _hexToRgb(color),
      sections: meta.sections || [],
      // centroidM se rellena perezosamente cuando hay state disponible,
      // porque depende de _ringSimple proyectado a metros locales del mun.
      centroidM: null
    });
    for (const cusec of (meta.sections || [])) {
      _byCusec.set(cusec, id);
    }
  });
}

// Recorre las secciones del nivel actual y rellena los centroidM
// faltantes con el promedio de los centroides de las secciones del barrio.
// Si no hay ninguna sección visible para un barrio, su centroide queda
// null y el label simplemente no se pinta para ese barrio.
function _ensureCentroids(seccionesDelNivel) {
  if (!_byBarrio || !seccionesDelNivel) return;
  // Acumulador: barrioId → { sx, sy, n }
  const acc = new Map();
  for (const s of seccionesDelNivel) {
    const cusec = s.properties && s.properties.cusec;
    if (!cusec) continue;
    const barrioId = _byCusec.get(cusec);
    if (!barrioId) continue;
    const c = s._centroid || (s._ringSimple ? ringCentroid(s._ringSimple) : null);
    if (!c) continue;
    let rec = acc.get(barrioId);
    if (!rec) { rec = { sx: 0, sy: 0, n: 0 }; acc.set(barrioId, rec); }
    rec.sx += c[0]; rec.sy += c[1]; rec.n += 1;
  }
  for (const [barrioId, rec] of acc.entries()) {
    if (!rec.n) continue;
    const b = _byBarrio.get(barrioId);
    if (b) b.centroidM = [rec.sx / rec.n, rec.sy / rec.n];
  }
}

function _fillSection(ctx, ring, view, rgb, strokeColor) {
  if (!ring || ring.length < 3) return;
  ctx.beginPath();
  for (let i = 0; i < ring.length; i++) {
    const [px, py] = project(ring[i][0], 0, ring[i][1], view);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = _rgba(rgb, FILL_ALPHA);
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = strokeColor;
  ctx.stroke();
}

function _drawSecciones(ctx, secciones, view) {
  if (!secciones || !secciones.length) return;
  // Conteo de secciones visibles por barrio (para escalar el label).
  const visCount = new Map();
  for (const s of secciones) {
    const cusec = s.properties && s.properties.cusec;
    if (!cusec) continue;
    const barrioId = _byCusec.get(cusec);
    if (!barrioId) continue;
    const b = _byBarrio.get(barrioId);
    if (!b) continue;
    _fillSection(ctx, s._ringSimple, view, b.rgb, _rgba(b.rgb, STROKE_ALPHA));
    visCount.set(barrioId, (visCount.get(barrioId) || 0) + 1);
  }
  return visCount;
}

function _drawLabels(ctx, visCount, view) {
  if (!_byBarrio || !visCount || !visCount.size) return;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  // paint-order: stroke (Canvas no soporta CSS paint-order; lo emulamos
  // dibujando stroke primero y fill encima).
  for (const [barrioId, n] of visCount.entries()) {
    const b = _byBarrio.get(barrioId);
    if (!b || !b.centroidM) continue;
    const [cx, cy] = b.centroidM;
    const [px, py] = project(cx, 0, cy, view);
    // Tamaño: clamp 9-16 px, escalado por nº secciones visibles del barrio.
    const size = Math.max(9, Math.min(16, 8 + n));
    ctx.font = `italic 600 ${size}px Georgia, "Times New Roman", serif`;
    ctx.lineWidth = Math.max(2, size * 0.28);
    ctx.strokeStyle = "#1a1612";
    ctx.strokeText(b.name, px, py);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(b.name, px, py);
  }
  ctx.restore();
}

export const barriosOverlay = {
  id: "barrios",
  name: "Barrios (identitario)",

  load: async () => {
    if (_data) return _data;
    if (_loadingPromise) return _loadingPromise;
    _loadingPromise = fetch(DATA_URL)
      .then(r => {
        if (!r.ok) throw new Error("barrios fetch " + r.status);
        return r.json();
      })
      .then(json => {
        // Normaliza schema canonical (secciones_origen → sections) para
        // que _buildIndexes y el resto del overlay no tengan que conocer
        // ambos nombres. Idempotente con runs previos.
        for (const bid of Object.keys(json.barrios || {})) {
          const b = json.barrios[bid];
          if (b.secciones_origen && !b.sections) b.sections = b.secciones_origen;
        }
        _data = json;
        _buildIndexes(json);
        return _data;
      })
      .catch(err => {
        console.warn("[barriosOverlay] no se pudo cargar:", err);
        _data = null;
        _byCusec = null;
        _byBarrio = null;
        _loadingPromise = null;
        return null;
      });
    return _loadingPromise;
  },

  isReady: () => _data !== null && _byCusec !== null && _byBarrio !== null,

  draw: (ctx, state, view) => {
    if (!_data || !_byCusec || !_byBarrio) return;
    if (!state || !view) return;
    const lvl = state.lodLevel;
    if (lvl !== "municipio" && lvl !== "distrito") return;

    let secciones = null;
    if (lvl === "municipio") secciones = state.municipio?.secciones;
    else if (lvl === "distrito") secciones = state.district?.secciones;
    if (!secciones || !secciones.length) return;

    // mun_filter: si el JSON lo trae (schema curado v1, LPGC), filtramos
    // por él. El schema canonical v2 no lo incluye → la capa pinta en
    // cualquier mun de prov 35 que tenga barrios indexados.
    const munCode = state.municipio?.mun;
    const munFilter = _data.mun_filter || [];
    if (munCode && munFilter.length) {
      const munFull = (munCode.length === 5) ? munCode : ("35" + munCode);
      if (!munFilter.includes(munFull)) return;
    }

    ctx.save();
    _ensureCentroids(secciones);
    const visCount = _drawSecciones(ctx, secciones, view);
    _drawLabels(ctx, visCount, view);
    ctx.restore();
  },

  // Hit-test público para que el runtime lo use al manejar taps cuando la
  // capa está activa. Devuelve barrioId del barrio cuyo centroide esté más
  // cerca del tap (proyectado a px) dentro de un radio razonable. NO usado
  // todavía por app.js — TODO: enganchar en handleTap para enterBarrio.
  // Si quieres activar el tap, en handleTap (app.js) añade antes del
  // hit-test de secciones:
  //   if (state.activeOverlays?.barrios && barriosOverlay.isReady()) {
  //     const bid = barriosOverlay.hitTest(px, py, state, view);
  //     if (bid) { enterBarrio(bid); return; }
  //   }
  hitTest: (px, py, state, view) => {
    if (!_byBarrio || !state || !view) return null;
    const lvl = state.lodLevel;
    if (lvl !== "municipio" && lvl !== "distrito") return null;
    const secciones = (lvl === "municipio")
      ? state.municipio?.secciones
      : state.district?.secciones;
    if (!secciones) return null;
    // Asegura centroides actualizados.
    _ensureCentroids(secciones);
    let best = null;
    let bestD2 = Infinity;
    for (const [bid, b] of _byBarrio.entries()) {
      if (!b.centroidM) continue;
      const [cx, cy] = b.centroidM;
      const [sx, sy] = project(cx, 0, cy, view);
      const dx = sx - px, dy = sy - py;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) { bestD2 = d2; best = bid; }
    }
    // Radio máximo 80 px (≈ tap target generoso). Por encima, no hay match.
    return (bestD2 <= 80 * 80) ? best : null;
  }
};
