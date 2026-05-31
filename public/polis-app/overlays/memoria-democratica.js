// Overlay "Memoria democrática" — fosas comunes, cárceles, lugares
// simbólicos de la represión franquista y del exilio republicano en
// Canarias. Datos curados en `data/memoria-democratica-canarias.geojson`
// (ver script `scripts/extract-memoria-democratica.py` para fuentes).
//
// MEM-01 · Ley 19/2022 de Memoria Democrática.
//
// ===== ETICA (leer antes de modificar) =====
// - No se renderizan ni se exponen nombres individuales de víctimas.
// - Pin SOBRIO: rojo apagado tipo óxido, sin animación, sin pulsado.
// - Cuando es fosa común y hay cifra agregada, SE MUESTRA SIEMPRE
//   junto al pin (responsabilidad cívica de no invisibilizar la
//   represión, expresada por consigna del proyecto).
// - Texto del popup en castellano, neutro, citando fuente.
//
// Patrón estructural idéntico a `productores.js` / `agora.js`:
// load → draw con bbox por LOD → hitTest → API sub-chips estándar.

import { project, lnglatToLocalMeters } from "../iso.js";

const DATA_URL = "../data/memoria-democratica-canarias.geojson";
const GC_ANCHOR = [-15.55, 28.05];

// Paleta apagada — rojos óxido / tierra quemada. Sin saturación alta.
// Glifos: 2 letras mayúsculas en serif (Georgia) para tono lapidario.
const TIPO_STYLE = {
  fosa_comun:         { fill: "#7A2E2E", glyph: "Fo", label: "Fosa común" },
  carcel:             { fill: "#4E2A22", glyph: "Cá", label: "Cárcel / campo" },
  lugar_simbolico:    { fill: "#6B4A2E", glyph: "Ls", label: "Lugar simbólico" },
  monumento_victimas: { fill: "#5A3030", glyph: "Mv", label: "Monumento" },
  exilio_embarque:    { fill: "#3A4459", glyph: "Ex", label: "Exilio / embarque" },
  _default:           { fill: "#5A3030", glyph: "Md", label: "Memoria" },
};

// Marcador discreto. Más pequeño que el de eventos/productores: la
// idea es estar PRESENTE pero no clamar atención visual sobre el resto
// del mapa cívico — coherente con sobriedad memorialística.
const MARKER_R = 9;
const POLE_H = 11;
const CLUSTER_PX = 22;

let _items = null;
let _loadingPromise = null;
let _tipoFilter = null;

function _styleFor(tipo) { return TIPO_STYLE[tipo] || TIPO_STYLE._default; }
function _passesTipo(item) {
  if (!_tipoFilter) return true;
  return _tipoFilter.has(item.properties?.tipo);
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
          id: f.properties?.id || `mem-${out.length}`,
          mx, mz,
          properties: { ...f.properties }
        });
      }
      _items = out;
      console.info(`[memoriaDemocraticaOverlay] ${out.length} lugares cargados`);
      return _items;
    })
    .catch(err => {
      console.warn("[memoriaDemocraticaOverlay] load fallo:", err);
      _items = null;
      _loadingPromise = null;
      return null;
    });
  return _loadingPromise;
}

// Pin lapidario: asta + losa rectangular vertical (proporción 1:1.3),
// sin gradiente. Color apagado. Glifo en blanco para legibilidad.
function _drawPin(ctx, px, py, style, item, count) {
  // Asta
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px, py - POLE_H);
  ctx.strokeStyle = "#1A1612";
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Losa vertical (más alta que ancha — evocación estela)
  const w = MARKER_R * 1.7;
  const h = MARKER_R * 2.0;
  const cy = py - POLE_H - h/2 + 1;
  ctx.beginPath();
  ctx.rect(px - w/2, cy - h/2, w, h);
  ctx.fillStyle = style.fill;
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = "#1A1612";
  ctx.stroke();

  // Glifo (2 letras) o cuenta de cluster
  ctx.fillStyle = "#F2EAD3";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (count > 1) {
    ctx.font = "bold 9px system-ui, sans-serif";
    ctx.fillText(`${style.glyph}·${count}`, px, cy);
  } else {
    ctx.font = "bold 10px Georgia, serif";
    ctx.fillText(style.glyph, px, cy);
  }

  // ETICA — Si es fosa común y hay cifra de víctimas/exhumados,
  // pintarla como pequeño badge debajo de la losa. NUNCA ocultar
  // la cifra agregada: responsabilidad de no invisibilizar.
  if (count === 1 && item.properties?.tipo === "fosa_comun") {
    const nv = item.properties?.numero_exhumados;
    const ne = item.properties?.numero_victimas;
    let badgeText = null;
    if (typeof nv === "number" && nv > 0) badgeText = `${nv}†`;
    else if (typeof ne === "string" && /\d/.test(ne)) {
      const m = ne.match(/\d+/);
      if (m) badgeText = `~${m[0]}†`;
    }
    if (badgeText) {
      const by = cy + h/2 + 6;
      ctx.font = "bold 9px Georgia, serif";
      const tw = ctx.measureText(badgeText).width + 6;
      ctx.beginPath();
      ctx.rect(px - tw/2, by - 6, tw, 11);
      ctx.fillStyle = "#1A1612";
      ctx.fill();
      ctx.fillStyle = "#E8C7A0";
      ctx.fillText(badgeText, px, by);
    }
  }

  // Ancla
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

function _bboxForState(state) {
  if (state.lodLevel === "isla") return state.isla?.bbox || null;
  if (state.lodLevel === "municipio") return state.municipio?.bbox || null;
  if (state.lodLevel === "distrito") return state.district?.bbox || null;
  if (state.lodLevel === "barrio") return state.barrio?.bbox || null;
  if (state.lodLevel === "vecindario") return state.vecindario?.bbox || null;
  if (state.lodLevel === "seccion") {
    return state.section?.bbox || state.section?._bbox || null;
  }
  return null;
}

export const memoriaDemocraticaOverlay = {
  id: "memoria-democratica",
  name: "Memoria democrática",

  load: _load,
  isReady: () => Array.isArray(_items),

  draw: (ctx, state, view) => {
    if (!_items || !_items.length) return;
    const bbox = _bboxForState(state);

    const projected = [];
    for (const x of _items) {
      if (!_inBbox(x.mx, x.mz, bbox)) continue;
      if (!_passesTipo(x)) continue;
      const [px, py] = project(x.mx, 0, x.mz, view);
      projected.push({ item: x, px, py });
    }
    if (!projected.length) return;

    // Cluster por proximidad-pantalla
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
      const firstT = c.items[0].properties?.tipo;
      const allSame = c.items.every(x => x.properties?.tipo === firstT);
      const style = allSame ? _styleFor(firstT) : _styleFor("_default");
      _drawPin(ctx, c.px, c.py, style, c.items[0], c.items.length);
    }
    ctx.restore();
  },

  hitTest: (px, py, state, view) => {
    if (!_items || !_items.length) return null;
    const bbox = _bboxForState(state);
    let best = null, bestD2 = (MARKER_R + 8) * (MARKER_R + 8);
    for (const x of _items) {
      if (!_inBbox(x.mx, x.mz, bbox)) continue;
      if (!_passesTipo(x)) continue;
      const [epx, epy] = project(x.mx, 0, x.mz, view);
      const cy = epy - POLE_H - MARKER_R + 2;
      const dx = px - epx, dy = py - cy;
      const d2 = dx*dx + dy*dy;
      if (d2 < bestD2) { bestD2 = d2; best = x; }
    }
    return best;
  },

  // Catálogo de tipos para chips
  getCategoryOptions: () => Object.entries(TIPO_STYLE)
    .filter(([k]) => k !== "_default")
    .map(([key, v]) => ({ key, label: v.label, fill: v.fill })),
  getCategoryOf: (item) => item?.properties?.tipo || null,
  getTipoLabel: (tipo) => _styleFor(tipo).label,

  // API sub-chips estándar (paneles de capas) — 2026-05-27
  getSubcatOptions: () => Object.entries(TIPO_STYLE)
    .filter(([k]) => k !== "_default")
    .map(([key, v]) => ({ key, label: v.label, fill: v.fill, glyph: v.glyph })),
  setSubcatFilter: (tipos) => {
    if (!tipos || (tipos.size !== undefined && tipos.size === 0)) {
      _tipoFilter = null;
    } else {
      _tipoFilter = tipos instanceof Set ? tipos : new Set(tipos);
    }
  },

  // Acceso al dataset (read-only) para inspección u otras capas
  getAllLugares: () => (_items ? _items.slice() : []),
};
