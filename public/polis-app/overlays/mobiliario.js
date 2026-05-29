// Overlay "Mobiliario urbano" (ESP-07) — pins minimalistas por tipo:
// bancos, fuentes potables, fuentes ornamentales, aseos públicos,
// refugios/marquesinas, árboles urbanos seleccionados. Crítico en olas
// de calor para localizar puntos de sombra/agua/descanso.
//
// Datos: scripts/extract-mobiliario-urbano.py → mobiliario-urbano-canarias.geojson
// 5.245 features (1.500 árboles + 1.500 bancos + 810 aseos + 579 refugios +
// 473 fuentes potables + 383 fuentes ornamentales).

import { project, lnglatToLocalMeters } from "../iso.js";

const DATA_URL = "../data/mobiliario-urbano-canarias.geojson?v=20260527-mobiliario-v0";
const GC_ANCHOR = [-15.55, 28.05];

const TIPO_STYLE = {
  banco:      { fill: "#8B5A2B", glyph: "Bc", label: "Banco" },
  agua:       { fill: "#3D5A80", glyph: "H₂O", label: "Fuente potable" },
  fuente_orn: { fill: "#7CB1D4", glyph: "Fn", label: "Fuente ornamental" },
  aseos:      { fill: "#4A4D52", glyph: "WC", label: "Aseos públicos" },
  refugio:    { fill: "#C89968", glyph: "Rf", label: "Refugio / marquesina" },
  arbol:      { fill: "#5C8C5C", glyph: "♣",  label: "Árbol urbano" },
  papelera:   { fill: "#6B6358", glyph: "·",  label: "Papelera" },
  _default:   { fill: "#6B6358", glyph: "··", label: "Mobiliario" }
};

const PIN_R = 7;
const CLUSTER_PX = 18;

let _data = null;
let _loadingPromise = null;
let _tipoFilter = null;  // Set<string> | null (null = todos)

function _styleFor(tipo) { return TIPO_STYLE[tipo] || TIPO_STYLE._default; }

async function _load() {
  if (_data) return _data;
  if (_loadingPromise) return _loadingPromise;
  _loadingPromise = fetch(DATA_URL, { cache: "no-cache" })
    .then(r => r.ok ? r.json() : Promise.reject(new Error("status " + r.status)))
    .then(fc => {
      const out = [];
      for (const f of (fc.features || [])) {
        if (!f.geometry || f.geometry.type !== "Point") continue;
        const [lng, lat] = f.geometry.coordinates;
        const [mx, mz] = lnglatToLocalMeters(lng, lat, GC_ANCHOR);
        out.push({
          tipo: f.properties?.tipo || "_default",
          mx, mz,
          properties: { ...f.properties }
        });
      }
      _data = out;
      return _data;
    })
    .catch(err => {
      console.warn("[mobiliarioOverlay] load fallo:", err);
      _data = null;
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
function _passes(item) {
  if (!_tipoFilter) return true;
  return _tipoFilter.has(item.tipo);
}

function _drawPin(ctx, px, py, style, count) {
  ctx.beginPath();
  ctx.arc(px, py, PIN_R, 0, Math.PI * 2);
  ctx.fillStyle = style.fill;
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = "#1A1612";
  ctx.stroke();
  if (count > 1) {
    ctx.beginPath();
    ctx.arc(px + 5, py - 5, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#1A1612";
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 8px 'IBM Plex Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(count), px + 5, py - 5);
  }
}

export const mobiliarioOverlay = {
  id: "mobiliario",
  name: "Mobiliario urbano",

  load: _load,
  isReady: () => Array.isArray(_data),

  draw: (ctx, state, view) => {
    if (!_data || !_data.length) return;
    let bbox = null;
    if (state.lodLevel === "municipio") bbox = state.municipio?.bbox;
    else if (state.lodLevel === "distrito") bbox = state.district?.bbox;
    else if (state.lodLevel === "barrio") bbox = state.barrio?.bbox;
    else if (state.lodLevel === "seccion") bbox = state.section?.bbox || state.section?._bbox || null;
    else if (state.lodLevel === "manzana") bbox = state.manzana?.bbox || null;
    // En isla/archipielago no pintamos — granularidad muy fina
    if (state.lodLevel === "isla" || state.lodLevel === "archipielago") return;

    const projected = [];
    for (const item of _data) {
      if (!_inBbox(item.mx, item.mz, bbox)) continue;
      if (!_passes(item)) continue;
      const [px, py] = project(item.mx, 0, item.mz, view);
      projected.push({ item, px, py });
    }

    // Cluster
    const clusters = [];
    for (const it of projected) {
      let placed = false;
      for (const c of clusters) {
        if (Math.abs(c.px - it.px) < CLUSTER_PX &&
            Math.abs(c.py - it.py) < CLUSTER_PX) {
          c.items.push(it.item);
          c.px = (c.px * (c.items.length - 1) + it.px) / c.items.length;
          c.py = (c.py * (c.items.length - 1) + it.py) / c.items.length;
          placed = true;
          break;
        }
      }
      if (!placed) clusters.push({ px: it.px, py: it.py, items: [it.item] });
    }

    clusters.sort((a, b) => a.py - b.py);
    for (const c of clusters) {
      const style = _styleFor(c.items[0].tipo);
      _drawPin(ctx, c.px, c.py, style, c.items.length);
    }
  },

  // Sub-chips API (consumida por el drawer toggle)
  getSubcatOptions: () => [
    { id: "banco",      label: "Bancos",          color: TIPO_STYLE.banco.fill },
    { id: "agua",       label: "Fuentes potables", color: TIPO_STYLE.agua.fill },
    { id: "fuente_orn", label: "Fuentes ornamentales", color: TIPO_STYLE.fuente_orn.fill },
    { id: "aseos",      label: "Aseos públicos",  color: TIPO_STYLE.aseos.fill },
    { id: "refugio",    label: "Refugios/marquesinas", color: TIPO_STYLE.refugio.fill },
    { id: "arbol",      label: "Árboles urbanos", color: TIPO_STYLE.arbol.fill }
  ],
  setSubcatFilter: (ids) => {
    _tipoFilter = ids && ids.length ? new Set(ids) : null;
  },
  getSubcatFilter: () => _tipoFilter ? Array.from(_tipoFilter) : null
};
