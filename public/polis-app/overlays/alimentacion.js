// Overlay ALIMENTACIÓN — negocios locales de alimentación de Canarias
// (panaderías, carnicerías, supermercados, restaurantes, bares, etc.).
//
// Datos: data/negocios-canarias.geojson (filtrado a bucket=alimentacion)
//        ~10.812 features extraídos del PBF Geofabrik.
//
// Sub-categorías navegables vía `alimentacionOverlay.setSubcatFilter(Set)`.
// El estilo varía por subcategoría (glifo + color); cluster por proximidad
// screen-space (mismo patrón que tejido-social / agora).

import { project, lnglatToLocalMeters } from "../iso.js";

const DATA_URL = "../data/negocios-canarias.geojson";
const GC_ANCHOR = [-15.55, 28.05];

// Paleta + glifo + label por subcategoría. Colores cálidos (cocina, pan,
// fuego) para diferenciar visualmente de tejido social (verde) y agora
// (marrón ocre).
export const ALIMENTACION_SUBCAT = {
  panaderia:    { fill: "#D9A85C", glyph: "Pn", label: "Panadería" },
  carniceria:   { fill: "#A0383A", glyph: "Cn", label: "Carnicería" },
  pescaderia:   { fill: "#3A6A8C", glyph: "Ps", label: "Pescadería" },
  fruteria:     { fill: "#6BAA45", glyph: "Fr", label: "Frutería" },
  supermercado: { fill: "#5A4030", glyph: "Sm", label: "Supermercado" },
  ultramarinos: { fill: "#8A6238", glyph: "Ul", label: "Ultramarinos" },
  bebidas:      { fill: "#5B2E5C", glyph: "Bd", label: "Bebidas / Bodega" },
  mercado:      { fill: "#C25A30", glyph: "Mk", label: "Mercado" },
  restaurante:  { fill: "#C47038", glyph: "Rt", label: "Restaurante" },
  cafe:         { fill: "#7E5235", glyph: "Cf", label: "Café" },
  bar:          { fill: "#8E3A20", glyph: "Br", label: "Bar / Pub" },
  _default:     { fill: "#6B6358", glyph: "··", label: "Negocio" },
};

const MARKER_R = 9;
const POLE_H = 9;
const CLUSTER_PX = 22;

let _items = null;
let _loadingPromise = null;
let _subcatFilter = null;  // null = todos, o Set<subcat>

function _styleFor(subcat) {
  return ALIMENTACION_SUBCAT[subcat] || ALIMENTACION_SUBCAT._default;
}

function _passes(item) {
  if (!_subcatFilter) return true;
  return _subcatFilter.has(item.properties?.subcat);
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
        const props = f.properties || {};
        if (props.bucket !== "alimentacion") continue;
        const [lng, lat] = f.geometry.coordinates;
        const [mx, mz] = lnglatToLocalMeters(lng, lat, GC_ANCHOR);
        out.push({
          id: props.kind_raw + "-" + out.length,
          mx, mz,
          properties: props,
        });
      }
      _items = out;
      console.info(`[alimentacionOverlay] ${out.length} negocios cargados`);
      return _items;
    })
    .catch(err => {
      console.warn("[alimentacionOverlay] load fallo:", err);
      _items = null;
      _loadingPromise = null;
      return null;
    });
  return _loadingPromise;
}

// Pin rectangular pequeño (chip-style) — distingue de:
//   tejido-social (círculo)
//   agora (triángulo)
//   eventos (banner)
function _drawPin(ctx, px, py, style, count) {
  const W = 22, H = 14, R = 3;
  // poste
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px, py - POLE_H);
  ctx.strokeStyle = "#1A1612";
  ctx.lineWidth = 1.4;
  ctx.stroke();
  const cy = py - POLE_H - H / 2;
  const x0 = px - W / 2, y0 = cy - H / 2;
  // rect rounded
  ctx.beginPath();
  ctx.moveTo(x0 + R, y0);
  ctx.lineTo(x0 + W - R, y0);
  ctx.quadraticCurveTo(x0 + W, y0, x0 + W, y0 + R);
  ctx.lineTo(x0 + W, y0 + H - R);
  ctx.quadraticCurveTo(x0 + W, y0 + H, x0 + W - R, y0 + H);
  ctx.lineTo(x0 + R, y0 + H);
  ctx.quadraticCurveTo(x0, y0 + H, x0, y0 + H - R);
  ctx.lineTo(x0, y0 + R);
  ctx.quadraticCurveTo(x0, y0, x0 + R, y0);
  ctx.closePath();
  ctx.fillStyle = style.fill;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#1A1612";
  ctx.stroke();
  // glifo
  ctx.fillStyle = "#FFFFFF";
  ctx.font = count > 1
    ? "bold 9px system-ui, sans-serif"
    : "bold 10px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(count > 1 ? `${style.glyph}·${count}` : style.glyph, px, cy);
  // ancla
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

export const alimentacionOverlay = {
  id: "alimentacion",
  name: "Alimentación y comercio local",
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
      if (!_passes(x)) continue;
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
      const firstSub = c.items[0].properties?.subcat;
      const allSame = c.items.every(x => x.properties?.subcat === firstSub);
      const style = allSame ? _styleFor(firstSub) : _styleFor("_default");
      _drawPin(ctx, c.px, c.py, style, c.items.length);
    }
    ctx.restore();
  },

  hitTest: (px, py, state, view) => {
    if (!_items || !_items.length) return null;
    let best = null, bestD2 = (MARKER_R + 6) * (MARKER_R + 6);
    for (const x of _items) {
      if (!_passes(x)) continue;
      const [epx, epy] = project(x.mx, 0, x.mz, view);
      const cy = epy - POLE_H - MARKER_R;
      const dx = px - epx, dy = py - cy;
      const d2 = dx*dx + dy*dy;
      if (d2 < bestD2) { bestD2 = d2; best = x; }
    }
    return best;
  },

  // API pública para chip-filter de sub-categorías
  setSubcatFilter: (subcats) => {
    if (!subcats || (subcats.size !== undefined && subcats.size === 0)) {
      _subcatFilter = null;
    } else {
      _subcatFilter = subcats instanceof Set ? subcats : new Set(subcats);
    }
  },
  getSubcatFilter: () => _subcatFilter ? Array.from(_subcatFilter) : null,
  getSubcatOptions: () => Object.entries(ALIMENTACION_SUBCAT)
    .filter(([k]) => k !== "_default")
    .map(([key, v]) => ({ key, label: v.label, fill: v.fill, glyph: v.glyph })),
};
