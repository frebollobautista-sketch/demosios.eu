// Overlay "Tejido social" — cooperativas, asociaciones vecinales y
// culturales, espacios comunitarios autogestionados, huertos urbanos,
// centros sociales y bibliotecas populares de Gran Canaria.
//
// Esta capa materializa la política de docs/CURATION-POLICY.md: solo
// entidades que sostienen el tejido social local. Franquicias,
// multinacionales y actores con prácticas controvertidas NO entran
// (se invisibilizan por omisión — no están en el geojson).
//
// Prioridad de discovery: máxima (+6 en search.js · typeBonus, por
// encima incluso de productores). El tejido comunitario es el corazón
// del proyecto.

import { project, lnglatToLocalMeters } from "../iso.js";

// 2026-05-27 — Cobertura multi-isla v2: tejido-social-canarias-v2.geojson
// (1.2 MB, 3.926 features). Solo entidades con geocode preciso
// (ok-native + ok-street) como pin individual, las que solo tienen geocode
// de municipio se AGRUPAN como 1 cluster-feature por (mun, cat) con
// `count`. Reduce el archivo 8 MB → 1.2 MB y elimina la saturación visual
// de 2800+ pins falsamente apilados en el centroide del mun.
//
// Para volver a v1 (todas las entidades sueltas) cambiar a
// tejido-social-canarias.geojson.
const DATA_URL = "../data/tejido-social-canarias-v2.geojson";
const GC_ANCHOR = [-15.55, 28.05];

// Paleta + glifo por categoría — verde-tierra para distinguir del
// comercial (productores) y del cultural (eventos). Sin
// transparencias ni gradientes — fiel a Into the Breach.
const CAT_STYLE = {
  cooperativa:         { fill: "#4A7C59", glyph: "Cp", label: "Cooperativa" },
  asociacion_vecinos:  { fill: "#3F5F7E", glyph: "Av", label: "Asociación vecinal" },
  asociacion_cultural: { fill: "#7A4F9E", glyph: "Ac", label: "Asociación cultural" },
  espacio_comunitario: { fill: "#C45A4A", glyph: "Ec", label: "Espacio comunitario" },
  huerto_urbano:       { fill: "#7CB07C", glyph: "Hu", label: "Huerto urbano" },
  centro_social:       { fill: "#D9534F", glyph: "Cs", label: "Centro social" },
  biblioteca_popular:  { fill: "#8B6F47", glyph: "Bb", label: "Biblioteca popular" },
  _default:            { fill: "#6B6358", glyph: "··", label: "Tejido social" }
};

const MARKER_R = 11;
const POLE_H = 12;
const CLUSTER_PX = 22;

let _items = null;
let _loadingPromise = null;
let _filter = null;

function _styleFor(cat) {
  return CAT_STYLE[cat] || CAT_STYLE._default;
}

function _passes(item) {
  return !_filter || _filter(item);
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
          id: f.properties?.id || `s-${out.length}`,
          mx, mz,
          properties: { ...f.properties }
        });
      }
      _items = out;
      return _items;
    })
    .catch(err => {
      console.warn("[tejidoSocialOverlay] load fallo:", err);
      _items = null;
      _loadingPromise = null;
      return null;
    });
  return _loadingPromise;
}

// Pin con forma de "hito" — círculo con triángulo apuntando abajo —
// para distinguir visualmente del banner-rectángulo de productores
// y del banner-círculo de eventos. La forma comunica "comunidad"
// (puntos de encuentro convergiendo).
function _drawPin(ctx, px, py, style, count) {
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px, py - POLE_H);
  ctx.strokeStyle = "#1A1612";
  ctx.lineWidth = 1.8;
  ctx.stroke();

  const cy = py - POLE_H - MARKER_R + 2;
  // Triángulo apuntando abajo + círculo encima.
  ctx.beginPath();
  ctx.arc(px, cy, MARKER_R, 0, Math.PI * 2);
  ctx.fillStyle = style.fill;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#1A1612";
  ctx.stroke();

  // Glifo dentro.
  ctx.fillStyle = "#FFFFFF";
  if (count > 1) {
    ctx.font = "bold 9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${style.glyph}·${count}`, px, cy);
  } else {
    ctx.font = "bold 11px Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(style.glyph, px, cy);
  }

  // Ancla.
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

export const tejidoSocialOverlay = {
  id: "tejido-social",
  name: "Tejido social",

  load: _load,
  isReady: () => Array.isArray(_items),

  draw: (ctx, state, view) => {
    if (!_items || !_items.length) return;
    let bbox = null;
    if (state.lodLevel === "municipio") bbox = state.municipio?.bbox;
    else if (state.lodLevel === "distrito") bbox = state.district?.bbox;
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
      const firstCat = c.items[0].properties?.categoria;
      const allSame = c.items.every(x => x.properties?.categoria === firstCat);
      const style = allSame ? _styleFor(firstCat) : _styleFor("_default");
      _drawPin(ctx, c.px, c.py, style, c.items.length);
    }
    ctx.restore();
  },

  hitTest: (px, py, state, view) => {
    if (!_items || !_items.length) return null;
    let bbox = null;
    if (state.lodLevel === "municipio") bbox = state.municipio?.bbox;
    else if (state.lodLevel === "distrito") bbox = state.district?.bbox;
    else if (state.lodLevel === "seccion") {
      bbox = state.section?.bbox || state.section?._bbox || null;
    }
    let best = null, bestD2 = (MARKER_R + 6) * (MARKER_R + 6);
    for (const x of _items) {
      if (!_inBbox(x.mx, x.mz, bbox)) continue;
      if (!_passes(x)) continue;
      const [epx, epy] = project(x.mx, 0, x.mz, view);
      const cy = epy - POLE_H - MARKER_R + 2;
      const dx = px - epx, dy = py - cy;
      const d2 = dx*dx + dy*dy;
      if (d2 < bestD2) { bestD2 = d2; best = x; }
    }
    return best;
  },

  getAllItems: () => (_items ? _items.slice() : []),
  getCategoriaLabel: (cat) => _styleFor(cat).label,

  // Filtro cross-cutting: aplica a draw() y hitTest(). null = sin filtro.
  setFilter: (predicate) => { _filter = (typeof predicate === "function") ? predicate : null; },
  passesFilter: (item) => _passes(item),

  // Catálogo de categorías para construir UI de chips.
  getCategoryOptions: () => Object.entries(CAT_STYLE)
    .filter(([k]) => k !== "_default")
    .map(([key, v]) => ({ key, label: v.label, fill: v.fill })),
  getCategoryOf: (item) => item?.properties?.categoria || null,

  // 2026-05-27 — API sub-chips estándar (alias de getCategoryOptions +
  // setFilter sobre categoría). Compatible con la lógica de
  // mountPanel.lp-subchips en overlays/index.js.
  getSubcatOptions: () => Object.entries(CAT_STYLE)
    .filter(([k]) => k !== "_default")
    .map(([key, v]) => ({ key, label: v.label, fill: v.fill, glyph: v.glyph || "··" })),
  setSubcatFilter: (cats) => {
    if (!cats || (cats.size !== undefined && cats.size === 0)) {
      _filter = null;
    } else {
      const set = cats instanceof Set ? cats : new Set(cats);
      _filter = (item) => set.has(item.properties?.categoria);
    }
  },
};
