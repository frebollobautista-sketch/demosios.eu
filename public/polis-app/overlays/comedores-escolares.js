// Overlay "Comedores escolares + becas" (EDU-02). Enriquece la red de
// centros educativos con tipo de comedor (gratuito / subvencionado /
// concertado / becas / no_comedor) + programa de desayuno.
//
// Datos: scripts/enriquece-comedores.py → comedores-escolares-canarias.geojson
// Estado: placeholder estructural mientras se valida con consejería.

import { project, lnglatToLocalMeters } from "../iso.js";

const DATA_URL = "../data/comedores-escolares-canarias.geojson?v=20260527-comedores-v0";
const GC_ANCHOR = [-15.55, 28.05];

const TIPO_STYLE = {
  gratuito:              { fill: "#4aaa5a", glyph: "G", label: "Gratuito" },
  subvencionado_parcial: { fill: "#d4c44a", glyph: "S", label: "Subvencionado" },
  concertado:            { fill: "#e68a4f", glyph: "C", label: "Concertado" },
  becas_estatales:       { fill: "#3D5A80", glyph: "B", label: "Becas estatales" },
  no_comedor:            { fill: "#6B6358", glyph: "—", label: "Sin comedor" },
};

const PIN_R = 9;
const CLUSTER_PX = 20;

let _data = null;
let _loadingPromise = null;
let _tipoFilter = null;
let _includeNoComedor = false;

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
        out.push({ mx, mz, properties: { ...f.properties } });
      }
      _data = out;
      return _data;
    })
    .catch(err => {
      console.warn("[comedoresOverlay] load fallo:", err);
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
  const tipo = item.properties?.tipo_comedor || "no_comedor";
  if (!_includeNoComedor && tipo === "no_comedor") return false;
  if (_tipoFilter && !_tipoFilter.has(tipo)) return false;
  return true;
}

function _drawPin(ctx, px, py, item, count) {
  const tipo = item.properties?.tipo_comedor || "no_comedor";
  const style = TIPO_STYLE[tipo] || TIPO_STYLE.no_comedor;
  const desayuno = item.properties?.desayuno_disponible;

  ctx.beginPath();
  ctx.arc(px, py, PIN_R, 0, Math.PI * 2);
  ctx.fillStyle = style.fill;
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = "#1A1612";
  ctx.stroke();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 10px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(style.glyph, px, py);

  // Estrella ocre adicional si desayuno disponible
  if (desayuno) {
    ctx.fillStyle = "#B88646";
    ctx.font = "10px serif";
    ctx.fillText("★", px - 8, py - 8);
  }

  if (count > 1) {
    ctx.beginPath();
    ctx.arc(px + 8, py - 8, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = "#1A1612";
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 8px 'IBM Plex Mono', monospace";
    ctx.fillText(String(count), px + 8, py - 8);
  }
}

export const comedoresEscolaresOverlay = {
  id: "comedores-escolares",
  name: "Comedores escolares",

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
    if (state.lodLevel === "archipielago" || state.lodLevel === "manzana") return;

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
      // Prioriza items con tipo más informativo (gratuito > subv > etc)
      const priority = ["gratuito", "subvencionado_parcial", "concertado", "becas_estatales", "no_comedor"];
      const best = c.items.slice().sort((a, b) =>
        priority.indexOf(a.properties.tipo_comedor) - priority.indexOf(b.properties.tipo_comedor)
      )[0];
      _drawPin(ctx, c.px, c.py, best, c.items.length);
    }
  },

  getSubcatOptions: () => Object.entries(TIPO_STYLE).map(([id, s]) => ({
    id, label: s.label, color: s.fill
  })),
  setSubcatFilter: (ids) => {
    const s = new Set(ids || []);
    _tipoFilter = s.size ? s : null;
    _includeNoComedor = !s.size || s.has("no_comedor");
  },
  getSubcatFilter: () => _tipoFilter ? Array.from(_tipoFilter) : null
};
