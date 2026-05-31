// Overlay "Árboles singulares" (ESP-05) — patrimonio botánico canario.
// 146 árboles: drago de Icod, pino gordo Vilaflor, sabinas El Hierro,
// laureles, mocanes, etc.
//
// Datos: scripts/extract-arboles-singulares.py → arboles-singulares-canarias.geojson
// Cada feature: nombre, especie, familia, edad_aprox, altura_m, proteccion,
// mun, tradicion, osm_id, wikipedia/wikidata.

import { project, lnglatToLocalMeters } from "../iso.js";

const DATA_URL = "../data/arboles-singulares-canarias.geojson?v=20260527-arboles-v0";
const GC_ANCHOR = [-15.55, 28.05];

// Estilo por familia botánica
const FAM_STYLE = {
  drago:          { fill: "#A37945", glyph: "Dg", label: "Drago" },
  pino_canario:   { fill: "#3D5A2D", glyph: "Pn", label: "Pino canario" },
  laurel:         { fill: "#6FA56F", glyph: "Lr", label: "Laurel" },
  sabina:         { fill: "#8B5A2B", glyph: "Sb", label: "Sabina" },
  mocan:          { fill: "#5C8C5C", glyph: "Mo", label: "Mocán" },
  palma:          { fill: "#C89968", glyph: "Pl", label: "Palma" },
  codeso:         { fill: "#9FCB6C", glyph: "Cd", label: "Codeso" },
  _default:       { fill: "#5C8C5C", glyph: "Ar", label: "Árbol singular" }
};

const PIN_R = 11;
const POLE_H = 11;
const CLUSTER_PX = 26;

let _data = null;
let _loadingPromise = null;
let _famFilter = null;

function _styleFor(item) {
  const fam = (item.properties?.familia || "").toLowerCase();
  if (FAM_STYLE[fam]) return FAM_STYLE[fam];
  // Fallback heurístico por nombre/especie
  const text = `${item.properties?.especie || ""} ${item.properties?.nombre || ""}`.toLowerCase();
  if (text.includes("drago"))   return FAM_STYLE.drago;
  if (text.includes("pino"))    return FAM_STYLE.pino_canario;
  if (text.includes("laurel"))  return FAM_STYLE.laurel;
  if (text.includes("sabina"))  return FAM_STYLE.sabina;
  if (text.includes("mocán") || text.includes("mocan")) return FAM_STYLE.mocan;
  if (text.includes("palma"))   return FAM_STYLE.palma;
  if (text.includes("codeso"))  return FAM_STYLE.codeso;
  return FAM_STYLE._default;
}

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
          mx, mz,
          properties: { ...f.properties }
        });
      }
      _data = out;
      return _data;
    })
    .catch(err => {
      console.warn("[arbolesSingularesOverlay] load fallo:", err);
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
  if (!_famFilter) return true;
  const fam = (item.properties?.familia || "").toLowerCase();
  return _famFilter.has(fam);
}

function _drawPin(ctx, px, py, style, count) {
  // Asta
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px, py - POLE_H);
  ctx.strokeStyle = "#1A1612";
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // Marca tipo estampa botánica: círculo + halo verde tenue
  const cy = py - POLE_H - PIN_R + 2;
  ctx.save();
  ctx.globalAlpha = 0.24;
  ctx.fillStyle = style.fill;
  ctx.beginPath();
  ctx.arc(px, cy, PIN_R + 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(px, cy, PIN_R, 0, Math.PI * 2);
  ctx.fillStyle = style.fill;
  ctx.fill();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = "#1A1612";
  ctx.stroke();
  // Glyph
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 9.5px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(count > 1 ? `${style.glyph}·${count}` : style.glyph, px, cy);
  // Anclaje
  ctx.beginPath();
  ctx.arc(px, py, 2.4, 0, Math.PI * 2);
  ctx.fillStyle = "#1A1612";
  ctx.fill();
}

export const arbolesSingularesOverlay = {
  id: "arboles-singulares",
  name: "Árboles singulares",

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
      const style = _styleFor(c.items[0]);
      _drawPin(ctx, c.px, c.py, style, c.items.length);
    }
  },

  getSubcatOptions: () => [
    { id: "drago",        label: "Dragos",         color: FAM_STYLE.drago.fill },
    { id: "pino_canario", label: "Pinos canarios", color: FAM_STYLE.pino_canario.fill },
    { id: "laurel",       label: "Laureles",       color: FAM_STYLE.laurel.fill },
    { id: "sabina",       label: "Sabinas",        color: FAM_STYLE.sabina.fill },
    { id: "mocan",        label: "Mocanes",        color: FAM_STYLE.mocan.fill },
    { id: "palma",        label: "Palmas",         color: FAM_STYLE.palma.fill }
  ],
  setSubcatFilter: (ids) => {
    _famFilter = ids && ids.length ? new Set(ids) : null;
  },
  getSubcatFilter: () => _famFilter ? Array.from(_famFilter) : null
};
