// Overlay AGORA — espacios públicos físicos de encuentro.
//
// Pins por categoría:
//   plaza        — espacios abiertos cívicos (OSM leisure=park named)
//   jardin       — jardines abiertos al público
//   playground   — áreas de juego infantil
//   institucion  — community_centre, townhall, library, arts_centre, theatre
//
// Datos: data/agora-canarias.geojson (854 features, 156 KB, derivado de
// osm-{gc,prov38} con _build_agora). Glyph: ▲ (triángulo abierto) como
// "punto de encuentro" — distinto del círculo de tejido_social.
//
// Niveles: isla / municipio / distrito / barrio / vecindario / seccion.
// Clustering por proximidad screen-space (igual patrón que tejido-social).

import { project, lnglatToLocalMeters } from "../iso.js";

const DATA_URL = "../data/agora-canarias.geojson";
const GC_ANCHOR = [-15.55, 28.05];

const KIND_STYLE = {
  plaza:       { fill: "#8a5a2a", glyph: "Pl", label: "Plaza" },
  jardin:      { fill: "#4d7a3a", glyph: "Jd", label: "Jardín" },
  playground:  { fill: "#c47038", glyph: "Pg", label: "Juego" },
  institucion: { fill: "#3a4f6e", glyph: "In", label: "Equipamiento cívico" },
  _default:    { fill: "#6e5e48", glyph: "Ag", label: "Ágora" },
};

const MARKER_R = 10;
const POLE_H = 10;
const CLUSTER_PX = 24;

let _items = null;
let _loadingPromise = null;
let _kindFilter = null;  // 2026-05-27 sub-chip filter

function _styleFor(kind) { return KIND_STYLE[kind] || KIND_STYLE._default; }
function _passesKind(item) {
  if (!_kindFilter) return true;
  return _kindFilter.has(item.properties?.kind);
}

async function _load() {
  if (_items) return _items;
  if (_loadingPromise) return _loadingPromise;
  _loadingPromise = fetch(DATA_URL, { cache: "no-cache" })
    .then(r => r.ok ? r.json() : Promise.reject(new Error("status " + r.status)))
    .then(fc => {
      const out = [];
      for (const f of fc.features || []) {
        if (!f.geometry || f.geometry.type !== "Point") continue;
        const [lng, lat] = f.geometry.coordinates;
        const [mx, mz] = lnglatToLocalMeters(lng, lat, GC_ANCHOR);
        out.push({
          id: f.properties?.subtype + "-" + out.length,
          mx, mz,
          properties: { ...f.properties }
        });
      }
      _items = out;
      console.info(`[agoraOverlay] ${out.length} ágoras cargadas`);
      return _items;
    })
    .catch(err => {
      console.warn("[agoraOverlay] load fallo:", err);
      _items = null;
      _loadingPromise = null;
      return null;
    });
  return _loadingPromise;
}

// Triángulo apuntando arriba (▲) = "punto de encuentro". Distinto del
// círculo (tejido social) y del cuadrado (productores).
function _drawPin(ctx, px, py, style, count) {
  // Ancla + poste
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px, py - POLE_H);
  ctx.strokeStyle = "#1A1612";
  ctx.lineWidth = 1.6;
  ctx.stroke();

  const cy = py - POLE_H - MARKER_R + 2;
  // Triángulo upright
  ctx.beginPath();
  ctx.moveTo(px, cy - MARKER_R);
  ctx.lineTo(px + MARKER_R * 0.9, cy + MARKER_R * 0.7);
  ctx.lineTo(px - MARKER_R * 0.9, cy + MARKER_R * 0.7);
  ctx.closePath();
  ctx.fillStyle = style.fill;
  ctx.fill();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = "#1A1612";
  ctx.stroke();

  // Glifo
  ctx.fillStyle = "#FFFFFF";
  if (count > 1) {
    ctx.font = "bold 9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${style.glyph}·${count}`, px, cy);
  } else {
    ctx.font = "bold 10px Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(style.glyph, px, cy + 1);
  }
  // Ancla punto
  ctx.beginPath();
  ctx.arc(px, py, 2, 0, Math.PI * 2);
  ctx.fillStyle = "#1A1612";
  ctx.fill();
}

function _inBbox(mx, mz, bbox) {
  if (!bbox) return true;
  const [a, b, c, d] = bbox;
  return mx >= a && mx <= c && mz >= b && mz <= d;
}

export const agoraOverlay = {
  id: "agora",
  name: "Ágora · espacios públicos",
  load: _load,
  isReady: () => Array.isArray(_items),

  draw: (ctx, state, view) => {
    if (!_items || !_items.length) return;
    let bbox = null;
    if (state.lodLevel === "isla") bbox = state.isla?.bbox;
    else if (state.lodLevel === "municipio") bbox = state.municipio?.bbox;
    else if (state.lodLevel === "distrito") bbox = state.district?.bbox;
    else if (state.lodLevel === "vecindario") bbox = state.vecindario?.bbox;
    else if (state.lodLevel === "barrio") bbox = state.barrio?.bbox;
    else if (state.lodLevel === "seccion") {
      bbox = state.section?.bbox || state.section?._bbox || null;
    }

    const projected = [];
    for (const x of _items) {
      if (!_inBbox(x.mx, x.mz, bbox)) continue;
      if (!_passesKind(x)) continue;
      const [px, py] = project(x.mx, 0, x.mz, view);
      projected.push({ item: x, px, py });
    }
    if (!projected.length) return;

    // Cluster por proximidad screen
    const clusters = [];
    const claimed = new Uint8Array(projected.length);
    for (let i = 0; i < projected.length; i++) {
      if (claimed[i]) continue;
      const c = { px: projected[i].px, py: projected[i].py,
                  items: [projected[i].item] };
      claimed[i] = 1;
      for (let j = i + 1; j < projected.length; j++) {
        if (claimed[j]) continue;
        const dx = projected[j].px - c.px;
        const dy = projected[j].py - c.py;
        if (dx*dx + dy*dy <= CLUSTER_PX*CLUSTER_PX) {
          c.items.push(projected[j].item);
          claimed[j] = 1;
        }
      }
      clusters.push(c);
    }

    ctx.save();
    for (const c of clusters) {
      const firstKind = c.items[0].properties?.kind;
      const allSame = c.items.every(x => x.properties?.kind === firstKind);
      const style = allSame ? _styleFor(firstKind) : _styleFor("_default");
      _drawPin(ctx, c.px, c.py, style, c.items.length);
    }
    ctx.restore();
  },

  hitTest: (px, py, state, view) => {
    if (!_items || !_items.length) return null;
    let best = null, bestD2 = (MARKER_R + 6) * (MARKER_R + 6);
    for (const x of _items) {
      const [epx, epy] = project(x.mx, 0, x.mz, view);
      const cy = epy - POLE_H - MARKER_R + 2;
      const dx = px - epx, dy = py - cy;
      const d2 = dx*dx + dy*dy;
      if (d2 < bestD2) { bestD2 = d2; best = x; }
    }
    return best;
  },

  getCategoryOptions: () => Object.entries(KIND_STYLE)
    .filter(([k]) => k !== "_default")
    .map(([key, v]) => ({ key, label: v.label, fill: v.fill })),

  // 2026-05-27 — API sub-chips estándar (paneles de capas)
  getSubcatOptions: () => Object.entries(KIND_STYLE)
    .filter(([k]) => k !== "_default")
    .map(([key, v]) => ({ key, label: v.label, fill: v.fill, glyph: v.glyph })),
  setSubcatFilter: (kinds) => {
    if (!kinds || (kinds.size !== undefined && kinds.size === 0)) {
      _kindFilter = null;
    } else {
      _kindFilter = kinds instanceof Set ? kinds : new Set(kinds);
    }
  },
};
