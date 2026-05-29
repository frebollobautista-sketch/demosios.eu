// Overlay "Bici parking + recarga eléctrica" (MOV-03). Dos tipologías
// de infraestructura de movilidad sostenible: aparcabicis (incluye
// estaciones Sítycleta de Las Palmas GC) y puntos de recarga para
// vehículos eléctricos.
//
// Datos: scripts/extract-movilidad-electrica.py → movilidad-electrica-canarias.geojson
// 364 features: 204 bici_parking + 160 recarga.
// Fuente: OSM PBF + API nextbike Sítycleta (city.uid=408).
// Biciambiental TF: sin feed abierto a 2026-05-27 (CSV manual).

import { project, lnglatToLocalMeters } from "../iso.js";

const DATA_URL = "../data/movilidad-electrica-canarias.geojson?v=20260527-bici-recarga-v0";
const GC_ANCHOR = [-15.55, 28.05];

const TIPO_STYLE = {
  bici_parking: { fill: "#4A7B5A", glyph: "B",  label: "Bici parking" },
  recarga:      { fill: "#3D5A80", glyph: "⚡", label: "Recarga eléctrica" },
  _default:     { fill: "#6B6358", glyph: "·",  label: "Movilidad eléctrica" }
};

const PIN_R = 7;
const CLUSTER_PX = 18;

let _data = null;
let _loadingPromise = null;
let _tipoFilter = null;

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
      console.warn("[biciRecargaOverlay] load fallo:", err);
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
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 8px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(style.glyph, px, py);
  if (count > 1) {
    ctx.beginPath();
    ctx.arc(px + 6, py - 6, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#1A1612";
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 8px 'IBM Plex Mono', monospace";
    ctx.fillText(String(count), px + 6, py - 6);
  }
}

export const biciRecargaOverlay = {
  id: "bici-recarga",
  name: "Bici parking + recarga",

  load: _load,
  isReady: () => Array.isArray(_data),

  draw: (ctx, state, view) => {
    if (!_data || !_data.length) return;
    let bbox = null;
    if (state.lodLevel === "isla") bbox = state.isla?.bbox;
    else if (state.lodLevel === "municipio") bbox = state.municipio?.bbox;
    else if (state.lodLevel === "distrito") bbox = state.district?.bbox;
    else if (state.lodLevel === "barrio") bbox = state.barrio?.bbox;
    else if (state.lodLevel === "seccion") bbox = state.section?.bbox || state.section?._bbox || null;
    else if (state.lodLevel === "manzana") bbox = state.manzana?.bbox || null;
    if (state.lodLevel === "archipielago") return;

    const projected = [];
    for (const item of _data) {
      if (!_inBbox(item.mx, item.mz, bbox)) continue;
      if (!_passes(item)) continue;
      const [px, py] = project(item.mx, 0, item.mz, view);
      projected.push({ item, px, py });
    }

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
      // Prioriza recarga sobre parking en cluster mixto (impacto eléctrico).
      const priority = { recarga: 0, bici_parking: 1, _default: 2 };
      const best = c.items.slice().sort(
        (a, b) => (priority[a.tipo] ?? 9) - (priority[b.tipo] ?? 9)
      )[0];
      _drawPin(ctx, c.px, c.py, _styleFor(best.tipo), c.items.length);
    }
  },

  getSubcatOptions: () => [
    { id: "bici_parking", label: "Bici parking",       color: TIPO_STYLE.bici_parking.fill },
    { id: "recarga",      label: "Recarga eléctrica",  color: TIPO_STYLE.recarga.fill }
  ],
  setSubcatFilter: (ids) => {
    _tipoFilter = ids && ids.length ? new Set(ids) : null;
  },
  getSubcatFilter: () => _tipoFilter ? Array.from(_tipoFilter) : null
};
