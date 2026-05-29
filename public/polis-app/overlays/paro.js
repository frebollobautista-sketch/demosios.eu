// Overlay "Paro registrado" — coropleta cuantil por MUNICIPIO sobre el
// % de paro registrado mensual. Datos en `data/paro-registrado-muns.json`
// (placeholder v0 hasta enchufar fuente ISTAC/SEPE real — ver
// scripts/extract-paro-istac.py).
//
// Diferencia con `renta`:
//   · renta granularidad sección → coropleta sección por sección
//   · paro granularidad municipio → coropleta tiñe el polígono del mun
//
// Niveles donde aplica:
//   · isla:       pinta TODOS los muns de la isla con su % paro
//   · municipio:  tiñe el mun activo + muns vecinos
//   · distrito/barrio/sección: omitido (granularidad mun, no aporta info
//     adicional al estar zoomado a barrio)
//   · archipielago: pinta las 7 islas con paro promedio ponderado
//
// Color scale invertida vs renta:
//   · paro bajo  → VERDE  (#4aaa5a)
//   · paro medio → AMARILLO
//   · paro alto  → ROJO   (#c45a4a)
// Es lo contrario que renta: alto paro = malo (rojo), bajo = bueno (verde).

import { project } from "../iso.js";

// 2026-05-27 — cache buster para forzar fetch al JSON oficial recién
// regenerado por el agente background (ISTAC 1.12 Q1 2026). Sin esto
// el navegador servía el placeholder v0 cacheado.
const DATA_URL = "../data/paro-registrado-muns.json?v=20260527-istac-q1";

// Inversa de renta: rojo = paro alto, verde = paro bajo
const C_LOW  = [ 74, 170,  90]; // #4aaa5a   (paro bajo = bueno)
const C_MID  = [212, 196,  74]; // #d4c44a
const C_HIGH = [196,  90,  74]; // #c45a4a   (paro alto = malo)

const FILL_ALPHA = 0.45;
const STROKE_ALPHA = 0.85;

let _data = null;     // { [cumun]: { paro_pct, paro_n, fecha, nmun, isla } }
let _meta = null;     // { version, fuente, fecha_dato, nota }
let _breaks = null;   // { p20, p50, p80 }
let _islaAvg = null;  // { [isla]: paro_pct promedio simple }
let _loadingPromise = null;

function _computeBreaks(muns) {
  const pcts = Object.values(muns)
    .map(r => r && r.paro_pct)
    .filter(n => typeof n === "number" && isFinite(n))
    .sort((a, b) => a - b);
  if (!pcts.length) return { p20: 12, p50: 16, p80: 20 };
  return {
    p20: pcts[Math.floor(pcts.length * 0.2)] || 12,
    p50: pcts[Math.floor(pcts.length * 0.5)] || 16,
    p80: pcts[Math.floor(pcts.length * 0.8)] || 20
  };
}

function _computeIslaAvg(muns) {
  const byIsla = {};
  for (const cumun of Object.keys(muns)) {
    const r = muns[cumun];
    if (!r || typeof r.paro_pct !== "number") continue;
    if (!byIsla[r.isla]) byIsla[r.isla] = { sum: 0, n: 0 };
    byIsla[r.isla].sum += r.paro_pct;
    byIsla[r.isla].n += 1;
  }
  const out = {};
  for (const k of Object.keys(byIsla)) {
    out[k] = byIsla[k].sum / byIsla[k].n;
  }
  return out;
}

function _lerp(a, b, t) { return a + (b - a) * t; }

function _colorFor(pct, breaks) {
  if (pct <= breaks.p20) return C_LOW;
  if (pct >= breaks.p80) return C_HIGH;
  if (pct <= breaks.p50) {
    const t = (pct - breaks.p20) / (breaks.p50 - breaks.p20);
    return [
      _lerp(C_LOW[0], C_MID[0], t),
      _lerp(C_LOW[1], C_MID[1], t),
      _lerp(C_LOW[2], C_MID[2], t)
    ];
  }
  const t = (pct - breaks.p50) / (breaks.p80 - breaks.p50);
  return [
    _lerp(C_MID[0], C_HIGH[0], t),
    _lerp(C_MID[1], C_HIGH[1], t),
    _lerp(C_MID[2], C_HIGH[2], t)
  ];
}

function _rgba([r, g, b], a) {
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
}

function _fillRing(ctx, ring, view, color) {
  if (!ring || ring.length < 3) return;
  ctx.beginPath();
  for (let i = 0; i < ring.length; i++) {
    const [px, py] = project(ring[i][0], 0, ring[i][1], view);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = _rgba(color, FILL_ALPHA);
  ctx.fill();
  ctx.strokeStyle = _rgba(color, STROKE_ALPHA);
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// Resuelve cumun (5-dig prov+mun) a partir del mun feature.
function _cumunOf(munFeat) {
  const props = munFeat.properties || {};
  if (props.cumun) return String(props.cumun);
  // fallback: combinar isla→prov + mun 3-dig
  const islaProv38 = new Set(["tf", "lp", "lg", "eh"]);
  const prov = islaProv38.has(props.isla) ? "38" : "35";
  return prov + String(props.mun);
}

function _drawIslaLevel(ctx, state, view) {
  const muns = state.isla?.municipios;
  if (!muns?.length) return;
  for (const m of muns) {
    const cumun = _cumunOf(m);
    const row = _data[cumun];
    if (!row || typeof row.paro_pct !== "number") continue;
    const color = _colorFor(row.paro_pct, _breaks);
    _fillRing(ctx, m._ringSimple, view, color);
  }
}

function _drawMunLevel(ctx, state, view) {
  const active = state.municipio;
  if (active) {
    const cumun = _cumunOf(active.polygon);
    const row = _data[cumun];
    if (row && typeof row.paro_pct === "number") {
      const color = _colorFor(row.paro_pct, _breaks);
      _fillRing(ctx, active.polygon._ringSimple, view, color);
    }
  }
  // Vecinos
  const neigh = state.municipio?.neighbors;
  if (neigh) {
    for (const n of neigh) {
      const cumun = _cumunOf(n);
      const row = _data[cumun];
      if (!row || typeof row.paro_pct !== "number") continue;
      const color = _colorFor(row.paro_pct, _breaks);
      _fillRing(ctx, n._ringSimple, view, color);
    }
  }
}

function _drawArchipielagoLevel(ctx, state, view) {
  const islas = state.archipielago?.islands;
  if (!islas?.length) return;
  for (const f of islas) {
    const islaId = f.properties?.isla;
    const avgPct = _islaAvg && _islaAvg[islaId];
    if (typeof avgPct !== "number") continue;
    const color = _colorFor(avgPct, _breaks);
    // f._rings es lista de outer rings (MultiPolygon parseado)
    const rings = f._rings || (f._ringSimple ? [f._ringSimple] : []);
    for (const ring of rings) {
      _fillRing(ctx, ring, view, color);
    }
  }
}

export const paroOverlay = {
  id: "paro",
  name: "Paro registrado por mun",

  load: async () => {
    if (_data) return _data;
    if (_loadingPromise) return _loadingPromise;
    _loadingPromise = fetch(DATA_URL)
      .then(r => {
        if (!r.ok) throw new Error("paro fetch " + r.status);
        return r.json();
      })
      .then(json => {
        _meta = {
          version: json.version, fuente: json.fuente,
          fecha_dato: json.fecha_dato, nota: json.nota
        };
        _data = json.muns || {};
        _breaks = _computeBreaks(_data);
        _islaAvg = _computeIslaAvg(_data);
        return _data;
      })
      .catch(err => {
        console.warn("[paroOverlay] no se pudo cargar:", err);
        _data = null;
        _breaks = null;
        _loadingPromise = null;
        return null;
      });
    return _loadingPromise;
  },

  isReady: () => _data !== null && _breaks !== null,

  draw: (ctx, state, view) => {
    if (!_data || !_breaks) return;
    if (!state || !view) return;
    const lvl = state.lodLevel;
    ctx.save();
    if (lvl === "archipielago") {
      _drawArchipielagoLevel(ctx, state, view);
    } else if (lvl === "isla") {
      _drawIslaLevel(ctx, state, view);
    } else if (lvl === "municipio") {
      _drawMunLevel(ctx, state, view);
    }
    // distrito / barrio / seccion / manzana: omitido (granularidad
    // demasiado fina; ya estamos dentro de un mun y la coropleta no
    // aporta info adicional). Si en futuro queremos persistir un
    // "ya conoces el paro de tu mun", podemos pintar un chip tipo HUD
    // en lugar de coropleta — pero eso es UI, no overlay.
    ctx.restore();
  },

  getBreaks: () => _breaks,
  getMeta: () => _meta,
  getIslaAvg: () => _islaAvg
};
