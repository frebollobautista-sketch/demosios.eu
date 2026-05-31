// Overlay "Subvenciones GobCan" — indicador PAR-05 del visor OCRE · POLIS.
//
// Visualiza las concesiones de subvención del Gobierno de Canarias en
// el último año, cruzando dinero público con territorio:
//
//   Modo 1 (default, niveles archipielago/isla/municipio):
//     COROPLETA por municipio según total €/año concedido. Verde claro
//     → ocre profundo en cuantiles. Misma estética que `paro.js` pero
//     paleta ocre (= concesión efectiva, no patología).
//
//   Modo 2 (municipio/distrito/barrio/seccion):
//     PINS sobre los beneficiarios georreferenciados (centroide del mun
//     o pin preciso si el beneficiario está en tejido-social.geojson).
//     Pin estilo "billete dorado" con €. Importe mostrado en chip al
//     pasar por encima (lo gestiona el sistema de hitTest del runtime).
//
// Datos: public/data/subvenciones-gobcan.json (regenerar con
// scripts/extract-subvenciones-gobcan.py · fuente BDNS).
//
// NOTA SOBRE COBERTURA: BDNS no expone el municipio del beneficiario.
// El script imputa cumun por tres caminos (NIF de ayuntamiento, cruce
// con tejido-social, heurística sobre texto de la convocatoria). Las
// concesiones de personas físicas (NIF enmascarado) NO se imputan y
// solo contribuyen al total archipielágico. Esto es honestamente lo
// que la fuente permite — ver `nota` en el JSON.

import { project, lnglatToLocalMeters } from "../iso.js";

const DATA_URL = "../data/subvenciones-gobcan.json?v=20260527-bdns";
const GC_ANCHOR = [-15.55, 28.05];

// Paleta ocre (verde claro → ocre saturado). Coherente con "concesión
// = recurso, no carencia"; opuesto al rojo de paro.
const C_LOW  = [232, 224, 196]; // #E8E0C4 — verde-crema
const C_MID  = [212, 168,  92]; // #D4A85C — ocre claro
const C_HIGH = [142,  88,  40]; // #8E5828 — ocre profundo

const FILL_ALPHA = 0.50;
const STROKE_ALPHA = 0.85;

// Pin "billete": rectángulo dorado con € — distinto de banner (productores)
// y círculo+triángulo (tejido). Comunica "dinero".
const PIN_W = 26;
const PIN_H = 14;
const POLE_H = 12;
const CLUSTER_PX = 22;
const BILL_FILL = "#D4A85C";
const BILL_STROKE = "#5A3A18";

let _data = null;       // payload completo
let _muns = null;       // { cumun: { total_eur, n_concesiones, ... } }
let _breaks = null;     // { p20, p50, p80 } sobre total_eur
let _islaAgg = null;    // { isla: total_eur (sumatorio simple) }
let _destacadas = null; // [{ mx, mz, ...props }]
let _loadingPromise = null;

// ------------------------------------------------------------------
// Helpers

function _computeBreaks(muns) {
  const arr = Object.values(muns)
    .map(r => r && r.total_eur)
    .filter(n => typeof n === "number" && isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  if (!arr.length) return { p20: 100000, p50: 500000, p80: 5000000 };
  return {
    p20: arr[Math.floor(arr.length * 0.2)] || arr[0],
    p50: arr[Math.floor(arr.length * 0.5)] || arr[0],
    p80: arr[Math.floor(arr.length * 0.8)] || arr[arr.length - 1]
  };
}

function _computeIslaAgg(muns) {
  const byIsla = {};
  for (const cumun of Object.keys(muns)) {
    const r = muns[cumun];
    if (!r || typeof r.total_eur !== "number") continue;
    byIsla[r.isla] = (byIsla[r.isla] || 0) + r.total_eur;
  }
  return byIsla;
}

function _lerp(a, b, t) { return a + (b - a) * t; }
function _rgba([r, g, b], a) {
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
}

function _colorFor(eur, breaks) {
  if (eur <= breaks.p20) return C_LOW;
  if (eur >= breaks.p80) return C_HIGH;
  if (eur <= breaks.p50) {
    const t = (eur - breaks.p20) / Math.max(1, breaks.p50 - breaks.p20);
    return [_lerp(C_LOW[0], C_MID[0], t),
            _lerp(C_LOW[1], C_MID[1], t),
            _lerp(C_LOW[2], C_MID[2], t)];
  }
  const t = (eur - breaks.p50) / Math.max(1, breaks.p80 - breaks.p50);
  return [_lerp(C_MID[0], C_HIGH[0], t),
          _lerp(C_MID[1], C_HIGH[1], t),
          _lerp(C_MID[2], C_HIGH[2], t)];
}

function _cumunOf(munFeat) {
  const props = munFeat.properties || {};
  if (props.cumun) return String(props.cumun);
  const islaProv38 = new Set(["tf", "lp", "lg", "eh"]);
  const prov = islaProv38.has(props.isla) ? "38" : "35";
  return prov + String(props.mun);
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

// ------------------------------------------------------------------
// COROPLETA — archipielago / isla / municipio

function _drawArchipielagoLevel(ctx, state, view) {
  const islas = state.archipielago?.islands;
  if (!islas?.length) return;
  // Para el archipielago usamos la suma total por isla, normalizada por
  // su propio cuantil (un solo cuantil global puede saturarse en GC/TF).
  const vals = Object.values(_islaAgg).filter(v => typeof v === "number");
  const min = Math.min(...vals), max = Math.max(...vals);
  for (const f of islas) {
    const islaId = f.properties?.isla;
    const tot = _islaAgg[islaId];
    if (typeof tot !== "number") continue;
    // breaks lineal sobre el rango de islas
    const t = (tot - min) / Math.max(1, max - min);
    const color = t < 0.5
      ? [_lerp(C_LOW[0], C_MID[0], t * 2),
         _lerp(C_LOW[1], C_MID[1], t * 2),
         _lerp(C_LOW[2], C_MID[2], t * 2)]
      : [_lerp(C_MID[0], C_HIGH[0], (t - 0.5) * 2),
         _lerp(C_MID[1], C_HIGH[1], (t - 0.5) * 2),
         _lerp(C_MID[2], C_HIGH[2], (t - 0.5) * 2)];
    const rings = f._rings || (f._ringSimple ? [f._ringSimple] : []);
    for (const ring of rings) _fillRing(ctx, ring, view, color);
  }
}

function _drawIslaLevel(ctx, state, view) {
  const muns = state.isla?.municipios;
  if (!muns?.length) return;
  for (const m of muns) {
    const cumun = _cumunOf(m);
    const row = _muns[cumun];
    if (!row || typeof row.total_eur !== "number" || row.total_eur <= 0) continue;
    const color = _colorFor(row.total_eur, _breaks);
    _fillRing(ctx, m._ringSimple, view, color);
  }
}

function _drawMunLevel(ctx, state, view) {
  const active = state.municipio;
  if (active) {
    const cumun = _cumunOf(active.polygon);
    const row = _muns[cumun];
    if (row && typeof row.total_eur === "number" && row.total_eur > 0) {
      const color = _colorFor(row.total_eur, _breaks);
      _fillRing(ctx, active.polygon._ringSimple, view, color);
    }
  }
  const neigh = state.municipio?.neighbors;
  if (neigh) {
    for (const n of neigh) {
      const cumun = _cumunOf(n);
      const row = _muns[cumun];
      if (!row || typeof row.total_eur !== "number" || row.total_eur <= 0) continue;
      const color = _colorFor(row.total_eur, _breaks);
      _fillRing(ctx, n._ringSimple, view, color);
    }
  }
}

// ------------------------------------------------------------------
// PINS — municipio / distrito / barrio / seccion

function _inBbox(mx, mz, bbox) {
  if (!bbox) return true;
  const [a, b, c, d] = bbox;
  return mx >= a && mx <= c && mz >= b && mz <= d;
}

function _drawBillete(ctx, px, py, importe, clusterCount) {
  // Asta
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px, py - POLE_H);
  ctx.strokeStyle = "#1A1612";
  ctx.lineWidth = 1.8;
  ctx.stroke();

  const cy = py - POLE_H - PIN_H / 2;
  // Billete (rect dorado con borde)
  ctx.beginPath();
  ctx.rect(px - PIN_W / 2, cy - PIN_H / 2, PIN_W, PIN_H);
  ctx.fillStyle = BILL_FILL;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = BILL_STROKE;
  ctx.stroke();

  // Símbolo €
  ctx.fillStyle = "#3A2410";
  ctx.font = "bold 10px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (clusterCount > 1) {
    ctx.fillText(`€·${clusterCount}`, px, cy);
  } else {
    ctx.fillText("€", px, cy);
  }

  // Ancla
  ctx.beginPath();
  ctx.arc(px, py, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = "#1A1612";
  ctx.fill();
}

function _drawPinLevel(ctx, state, view) {
  if (!_destacadas || !_destacadas.length) return;
  let bbox = null;
  if (state.lodLevel === "municipio") bbox = state.municipio?.bbox;
  else if (state.lodLevel === "distrito") bbox = state.district?.bbox;
  else if (state.lodLevel === "barrio") bbox = state.barrio?.bbox || state.barrio?._bbox;
  else if (state.lodLevel === "seccion") {
    bbox = state.section?.bbox || state.section?._bbox || null;
  }

  // Proyectar
  const projected = [];
  for (const d of _destacadas) {
    if (!_inBbox(d.mx, d.mz, bbox)) continue;
    const [px, py] = project(d.mx, 0, d.mz, view);
    projected.push({ d, px, py });
  }
  if (!projected.length) return;

  // Cluster por proximidad pantalla
  const clusters = [];
  const claimed = new Uint8Array(projected.length);
  for (let i = 0; i < projected.length; i++) {
    if (claimed[i]) continue;
    const c = { px: projected[i].px, py: projected[i].py,
                items: [projected[i].d],
                totalEur: projected[i].d.properties.importe };
    claimed[i] = 1;
    for (let j = i + 1; j < projected.length; j++) {
      if (claimed[j]) continue;
      const dx = projected[j].px - c.px;
      const dy = projected[j].py - c.py;
      if (dx * dx + dy * dy <= CLUSTER_PX * CLUSTER_PX) {
        c.items.push(projected[j].d);
        c.totalEur += projected[j].d.properties.importe;
        claimed[j] = 1;
      }
    }
    clusters.push(c);
  }

  ctx.save();
  for (const c of clusters) {
    _drawBillete(ctx, c.px, c.py, c.totalEur, c.items.length);
  }
  ctx.restore();
}

// ------------------------------------------------------------------
// API pública

export const subvencionesOverlay = {
  id: "subvenciones",
  name: "Subvenciones GobCan",

  load: async () => {
    if (_data) return _data;
    if (_loadingPromise) return _loadingPromise;
    _loadingPromise = fetch(DATA_URL)
      .then(r => {
        if (!r.ok) throw new Error("subvenciones fetch " + r.status);
        return r.json();
      })
      .then(json => {
        _data = json;
        _muns = json.muns || {};
        _breaks = _computeBreaks(_muns);
        _islaAgg = _computeIslaAgg(_muns);

        // Pre-proyectar destacadas a coords locales
        _destacadas = [];
        for (const c of (json.concesiones_destacadas || [])) {
          if (typeof c.lng !== "number" || typeof c.lat !== "number") continue;
          const [mx, mz] = lnglatToLocalMeters(c.lng, c.lat, GC_ANCHOR);
          _destacadas.push({
            id: `subv-${_destacadas.length}`,
            mx, mz,
            properties: { ...c }
          });
        }
        return _data;
      })
      .catch(err => {
        console.warn("[subvencionesOverlay] no se pudo cargar:", err);
        _data = null;
        _muns = null;
        _breaks = null;
        _islaAgg = null;
        _destacadas = null;
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
      // En municipio mostramos AMBOS: coropleta de fondo + pins de los
      // beneficiarios destacados georreferenciados dentro del mun.
      _drawMunLevel(ctx, state, view);
      _drawPinLevel(ctx, state, view);
    } else if (lvl === "distrito" || lvl === "barrio" || lvl === "seccion") {
      _drawPinLevel(ctx, state, view);
    }
    ctx.restore();
  },

  hitTest: (px, py, state, view) => {
    // Solo pins son interactivos. La coropleta no genera hit (tooltip).
    if (!_destacadas || !_destacadas.length) return null;
    const lvl = state.lodLevel;
    if (lvl !== "municipio" && lvl !== "distrito" && lvl !== "barrio" && lvl !== "seccion") {
      return null;
    }
    let bbox = null;
    if (lvl === "municipio") bbox = state.municipio?.bbox;
    else if (lvl === "distrito") bbox = state.district?.bbox;
    else if (lvl === "barrio") bbox = state.barrio?.bbox || state.barrio?._bbox;
    else if (lvl === "seccion") bbox = state.section?.bbox || state.section?._bbox;

    const HIT_R = PIN_W / 2 + 4;
    const HIT_R2 = HIT_R * HIT_R;
    let best = null, bestD2 = HIT_R2;
    for (const d of _destacadas) {
      if (!_inBbox(d.mx, d.mz, bbox)) continue;
      const [epx, epy] = project(d.mx, 0, d.mz, view);
      const cy = epy - POLE_H - PIN_H / 2;
      const dx = px - epx, dy = py - cy;
      const dd = dx * dx + dy * dy;
      if (dd < bestD2) { bestD2 = dd; best = d; }
    }
    return best;
  },

  // Introspección para UI / debug
  getMeta: () => (_data ? {
    version: _data.version,
    fuente: _data.fuente,
    periodo: _data.periodo,
    n_concesiones: _data.n_concesiones,
    n_concesiones_imputadas_mun: _data.n_concesiones_imputadas_mun,
    total_eur: _data.total_eur,
    total_eur_imputado_mun: _data.total_eur_imputado_mun,
    nota: _data.nota
  } : null),
  getBreaks: () => _breaks,
  getMunData: (cumun) => _muns ? _muns[cumun] : null,
  getDestacadas: () => _destacadas ? _destacadas.slice() : []
};
