// Overlay "Productores locales" — pequeños agricultores, artesanos y
// mercadillos de Gran Canaria. Datos curados en
// data/productores-locales.geojson, ampliables sin tocar código (sigue
// el esquema documentado en docs/CULTURAL-CONTENT-FORMAT.md).
//
// Diferencia con `eventos`: los productores son PERMANENTES (no tienen
// fecha/hora), tienen oficio en lugar de categoría y representan
// identidad económico-cultural del territorio. El usuario pidió
// priorizarlos en el discovery → boost extra en search.js (ver typeBonus).

import { project, lnglatToLocalMeters } from "../iso.js";

const DATA_URL = "../data/productores-locales.geojson";
const GC_ANCHOR = [-15.55, 28.05];

// Paleta + glifo (2 letras) por oficio. Estética Into the Breach: ink +
// color sólido + sin gradientes. Los glifos son letras mayúsculas porque
// los emojis no encajan con el resto del runtime canvas2D.
const OFICIO_STYLE = {
  queso:      { fill: "#C89968", glyph: "Qs", label: "Queso" },
  vino:       { fill: "#9F4FE6", glyph: "Vn", label: "Vino" },
  cafe:       { fill: "#5C3D24", glyph: "Cf", label: "Café" },
  miel:       { fill: "#E68A4F", glyph: "Mi", label: "Miel" },
  sidra:      { fill: "#7CB07C", glyph: "Sd", label: "Sidra" },
  almendra:   { fill: "#D4A87C", glyph: "Al", label: "Almendra" },
  calado:     { fill: "#4A4D52", glyph: "Tx", label: "Calado / textil" },
  sal:        { fill: "#B8D4E0", glyph: "Sl", label: "Sal" },
  mercadillo: { fill: "#E2C99A", glyph: "Mk", label: "Mercadillo" },
  aloe:       { fill: "#9FCB6C", glyph: "Av", label: "Aloe Vera" },
  _default:   { fill: "#6B6358", glyph: "··", label: "Productor" }
};

const MARKER_R = 11;
const POLE_H = 12;
const CLUSTER_PX = 22;

let _productores = null;
let _loadingPromise = null;
let _filter = null;

function _styleFor(oficio) {
  return OFICIO_STYLE[oficio] || OFICIO_STYLE._default;
}

function _passes(item) {
  return !_filter || _filter(item);
}

async function _load() {
  if (_productores) return _productores;
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
          id: f.properties?.id || `p-${out.length}`,
          mx, mz,
          properties: { ...f.properties }
        });
      }
      _productores = out;
      return _productores;
    })
    .catch(err => {
      console.warn("[productoresOverlay] load fallo:", err);
      _productores = null;
      _loadingPromise = null;
      return null;
    });
  return _loadingPromise;
}

function _drawPin(ctx, px, py, style, count) {
  // Asta vertical.
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px, py - POLE_H);
  ctx.strokeStyle = "#1A1612";
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Cuerpo rectangular (banner) — más cuadrado que el círculo de
  // eventos, para distinguirlos visualmente de un vistazo.
  const cy = py - POLE_H - MARKER_R + 2;
  const w = MARKER_R * 2;
  const h = MARKER_R * 1.6;
  ctx.beginPath();
  ctx.rect(px - w/2, cy - h/2, w, h);
  ctx.fillStyle = style.fill;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#1A1612";
  ctx.stroke();

  // Glifo (2 letras) en el banner.
  if (count > 1) {
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${style.glyph}·${count}`, px, cy);
  } else {
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 11px Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(style.glyph, px, cy);
  }

  // Anclaje inferior.
  ctx.beginPath();
  ctx.arc(px, py, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = "#1A1612";
  ctx.fill();
}

function _inBbox(mx, mz, bbox) {
  if (!bbox) return true;
  const [a, b, c, d] = bbox;
  return mx >= a && mx <= c && mz >= b && mz <= d;
}

export const productoresOverlay = {
  id: "productores",
  name: "Productores locales",

  load: _load,
  isReady: () => Array.isArray(_productores),

  draw: (ctx, state, view) => {
    if (!_productores || !_productores.length) return;
    let bbox = null;
    if (state.lodLevel === "municipio") bbox = state.municipio?.bbox;
    else if (state.lodLevel === "distrito") bbox = state.district?.bbox;
    else if (state.lodLevel === "seccion") {
      bbox = state.section?.bbox || state.section?._bbox || null;
    }

    const projected = [];
    for (const p of _productores) {
      if (!_inBbox(p.mx, p.mz, bbox)) continue;
      if (!_passes(p)) continue;
      const [px, py] = project(p.mx, 0, p.mz, view);
      projected.push({ p, px, py });
    }
    if (!projected.length) return;

    // Cluster por proximidad-pantalla.
    const clusters = [];
    const claimed = new Uint8Array(projected.length);
    for (let i = 0; i < projected.length; i++) {
      if (claimed[i]) continue;
      const c = { px: projected[i].px, py: projected[i].py,
                  productores: [projected[i].p] };
      claimed[i] = 1;
      for (let j = i + 1; j < projected.length; j++) {
        if (claimed[j]) continue;
        const dx = projected[j].px - c.px;
        const dy = projected[j].py - c.py;
        if (dx*dx + dy*dy <= CLUSTER_PX*CLUSTER_PX) {
          c.productores.push(projected[j].p);
          claimed[j] = 1;
        }
      }
      clusters.push(c);
    }

    ctx.save();
    for (const c of clusters) {
      const firstOf = c.productores[0].properties?.oficio;
      const allSame = c.productores.every(x => x.properties?.oficio === firstOf);
      const style = allSame ? _styleFor(firstOf) : _styleFor("_default");
      _drawPin(ctx, c.px, c.py, style, c.productores.length);
    }
    ctx.restore();
  },

  hitTest: (px, py, state, view) => {
    if (!_productores || !_productores.length) return null;
    let bbox = null;
    if (state.lodLevel === "municipio") bbox = state.municipio?.bbox;
    else if (state.lodLevel === "distrito") bbox = state.district?.bbox;
    else if (state.lodLevel === "seccion") {
      bbox = state.section?.bbox || state.section?._bbox || null;
    }
    let best = null, bestD2 = (MARKER_R + 6) * (MARKER_R + 6);
    for (const p of _productores) {
      if (!_inBbox(p.mx, p.mz, bbox)) continue;
      if (!_passes(p)) continue;
      const [epx, epy] = project(p.mx, 0, p.mz, view);
      const cy = epy - POLE_H - MARKER_R + 2;
      const dx = px - epx, dy = py - cy;
      const d2 = dx*dx + dy*dy;
      if (d2 < bestD2) { bestD2 = d2; best = p; }
    }
    return best;
  },

  getAllProductores: () => (_productores ? _productores.slice() : []),
  getOficioLabel: (oficio) => _styleFor(oficio).label,

  // Filtro cross-cutting: aplica a draw() y hitTest(). null = sin filtro.
  setFilter: (predicate) => { _filter = (typeof predicate === "function") ? predicate : null; },
  passesFilter: (item) => _passes(item),

  // Catálogo de oficios para construir UI de chips.
  getCategoryOptions: () => Object.entries(OFICIO_STYLE)
    .filter(([k]) => k !== "_default")
    .map(([key, v]) => ({ key, label: v.label, fill: v.fill })),
  getCategoryOf: (item) => item?.properties?.oficio || null
};
