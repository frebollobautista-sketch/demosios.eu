// Overlay "Bienes de Interés Cultural y patrimonio catalogado" — visor OCRE/POLIS.
//
// Fuente: BIC oficial Gobierno de Canarias (Tenerife) + fallback OSM historic=*
//         para el resto del archipiélago. 2600 features aprox.
//
// Generación: scripts/extract-bic-patrimonio.py
// Datos:     public/data/bic-patrimonio-canarias.geojson
//
// Glifos por tipo:
//   bic            → estrella ocre brand (★)
//   monumento      → rectángulo punto (■)
//   archaeological → triángulo púrpura (▲)
//   iglesia        → cruz (✝)
//   castle         → torre (♜)
//   ruins          → glifo "Ru"
//   memorial       → glifo "Me"

import { project, lnglatToLocalMeters } from "../iso.js";

const DATA_URL = "../data/bic-patrimonio-canarias.geojson";
const GC_ANCHOR = [-15.55, 28.05];

const TYPE_STYLE = {
  bic:            { fill: "#C5764A", glyph: "★", label: "BIC declarado",   priority: 1 },
  archaeological: { fill: "#7A4FA8", glyph: "▲", label: "Yacimiento",      priority: 2 },
  castle:         { fill: "#5C3A1E", glyph: "♜", label: "Fortificación",   priority: 3 },
  iglesia:        { fill: "#3D5A80", glyph: "✝", label: "Iglesia/ermita",  priority: 4 },
  monumento:      { fill: "#A88B4F", glyph: "■", label: "Monumento",       priority: 5 },
  ruins:          { fill: "#7B6F5C", glyph: "Ru",    label: "Ruinas",           priority: 6 },
  memorial:       { fill: "#8C7B6F", glyph: "Me",    label: "Memorial",         priority: 7 },
  _default:       { fill: "#6B6358", glyph: "··", label: "Patrimonio", priority: 9 }
};

const CATEGORIA_LABEL = {
  arquitectura:    "Arquitectura",
  arqueologia:     "Arqueología",
  etnografico:     "Etnográfico",
  memoria:         "Memoria histórica",
  paleontologico:  "Paleontología",
  desconocido:     "Sin clasificar"
};

const MARKER_R = 10;
const POLE_H = 10;
const CLUSTER_PX = 22;

let _items = null;
let _loadingPromise = null;
let _activeTypes = null; // null = todos; Set(string) = filtrar

function _styleFor(tipo) {
  return TYPE_STYLE[tipo] || TYPE_STYLE._default;
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
        const p = f.properties || {};
        out.push({
          id: p.id || `bic-${out.length}`,
          mx, mz,
          tipo: p.tipo || "_default",
          categoria: p.categoria || "desconocido",
          nombre: p.nombre || null,
          mun: p.mun || null,
          fecha: p.fecha_declaracion || null,
          fuente: p.fuente || null,
          categoriaOriginal: p.categoria_original || null,
        });
      }
      _items = out;
      return _items;
    })
    .catch(err => {
      console.warn("[bicOverlay] load fallo:", err);
      _items = null;
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

// --- glyph drawers ----------------------------------------------------------
function _drawStar(ctx, cx, cy, r, fill) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(ang) * rad;
    const y = cy + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = "#1A1612";
  ctx.stroke();
}

function _drawTriangle(ctx, cx, cy, r, fill) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r * 0.9, cy + r * 0.7);
  ctx.lineTo(cx - r * 0.9, cy + r * 0.7);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = "#1A1612";
  ctx.stroke();
}

function _drawTower(ctx, cx, cy, r, fill) {
  const w = r * 1.5, h = r * 1.8;
  ctx.beginPath();
  // base
  ctx.rect(cx - w / 2, cy - h / 2 + r * 0.3, w, h - r * 0.3);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = "#1A1612";
  ctx.stroke();
  // almenas (3 dientes)
  ctx.fillStyle = fill;
  const ty = cy - h / 2;
  const dw = w / 3.2;
  for (let i = 0; i < 3; i++) {
    const x = cx - w / 2 + i * (w / 3) + (w / 3 - dw) / 2;
    ctx.fillRect(x, ty, dw, r * 0.45);
    ctx.strokeRect(x, ty, dw, r * 0.45);
  }
}

function _drawCross(ctx, cx, cy, r, fill) {
  const a = r * 0.32;
  ctx.fillStyle = fill;
  ctx.strokeStyle = "#1A1612";
  ctx.lineWidth = 1.4;
  // vertical
  ctx.beginPath();
  ctx.rect(cx - a / 2, cy - r, a, r * 2);
  ctx.fill();
  ctx.stroke();
  // horizontal
  ctx.beginPath();
  ctx.rect(cx - r * 0.7, cy - r * 0.4, r * 1.4, a);
  ctx.fill();
  ctx.stroke();
}

function _drawSquare(ctx, cx, cy, r, fill) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = "#1A1612";
  ctx.lineWidth = 1.5;
  const s = r * 1.5;
  ctx.beginPath();
  ctx.rect(cx - s / 2, cy - s / 2, s, s);
  ctx.fill();
  ctx.stroke();
}

function _drawTextBanner(ctx, cx, cy, glyph, fill) {
  const w = MARKER_R * 2, h = MARKER_R * 1.6;
  const r = 4;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2 + r, cy - h / 2);
  ctx.lineTo(cx + w / 2 - r, cy - h / 2);
  ctx.quadraticCurveTo(cx + w / 2, cy - h / 2, cx + w / 2, cy - h / 2 + r);
  ctx.lineTo(cx + w / 2, cy + h / 2 - r);
  ctx.quadraticCurveTo(cx + w / 2, cy + h / 2, cx + w / 2 - r, cy + h / 2);
  ctx.lineTo(cx - w / 2 + r, cy + h / 2);
  ctx.quadraticCurveTo(cx - w / 2, cy + h / 2, cx - w / 2, cy + h / 2 - r);
  ctx.lineTo(cx - w / 2, cy - h / 2 + r);
  ctx.quadraticCurveTo(cx - w / 2, cy - h / 2, cx - w / 2 + r, cy - h / 2);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = "#1A1612";
  ctx.stroke();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 9px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(glyph, cx, cy);
}

function _drawPin(ctx, px, py, tipo, style, count) {
  // asta vertical
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px, py - POLE_H);
  ctx.strokeStyle = "#1A1612";
  ctx.lineWidth = 1.4;
  ctx.stroke();

  const cy = py - POLE_H - MARKER_R + 2;
  const r = MARKER_R;

  // glifo principal según tipo
  if (count > 1) {
    // cluster: usamos banner con número
    _drawTextBanner(ctx, px, cy, `${style.glyph}·${count}`, style.fill);
  } else {
    switch (tipo) {
      case "bic":
        _drawStar(ctx, px, cy, r, style.fill); break;
      case "archaeological":
        _drawTriangle(ctx, px, cy, r, style.fill); break;
      case "castle":
        _drawTower(ctx, px, cy, r, style.fill); break;
      case "iglesia":
        _drawCross(ctx, px, cy, r, style.fill); break;
      case "monumento":
        _drawSquare(ctx, px, cy, r, style.fill); break;
      default:
        _drawTextBanner(ctx, px, cy, style.glyph, style.fill);
    }
  }

  // anclaje inferior
  ctx.beginPath();
  ctx.arc(px, py, 2.2, 0, Math.PI * 2);
  ctx.fillStyle = "#1A1612";
  ctx.fill();
}

export const bicOverlay = {
  id: "bic",
  name: "Bienes de Interés Cultural",
  // tipos disponibles para construir sub-chips desde la UI
  types: Object.keys(TYPE_STYLE).filter(k => k !== "_default").map(k => ({
    key: k,
    label: TYPE_STYLE[k].label,
    color: TYPE_STYLE[k].fill,
  })),
  categorias: CATEGORIA_LABEL,

  load: _load,
  isReady: () => Array.isArray(_items),

  // permite al index/UI activar sólo ciertos tipos (sub-chips)
  setActiveTypes(types) {
    if (!types || (Array.isArray(types) && types.length === 0)) {
      _activeTypes = null;
    } else {
      _activeTypes = new Set(types);
    }
  },

  // hit-test simple para popups (chascarrillos por feature)
  pick(view, state, px, py, radius = 14) {
    if (!_items || !_items.length) return null;
    let bbox = null;
    if (state.lodLevel === "municipio") bbox = state.municipio?.bbox;
    else if (state.lodLevel === "distrito") bbox = state.district?.bbox;
    else if (state.lodLevel === "seccion") {
      bbox = state.section?.bbox || state.section?._bbox || null;
    }
    let best = null;
    let bestD = radius * radius;
    for (const v of _items) {
      if (_activeTypes && !_activeTypes.has(v.tipo)) continue;
      if (!_inBbox(v.mx, v.mz, bbox)) continue;
      const [qx, qy] = project(v.mx, 0, v.mz, view);
      const dx = qx - px, dy = qy - (py - POLE_H);
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = v; }
    }
    return best;
  },

  draw(ctx, state, view) {
    if (!_items || !_items.length) return;

    let bbox = null;
    const lvl = state.lodLevel;
    if (lvl === "municipio") bbox = state.municipio?.bbox;
    else if (lvl === "distrito") bbox = state.district?.bbox;
    else if (lvl === "seccion") {
      bbox = state.section?.bbox || state.section?._bbox || null;
    } else if (lvl === "barrio") {
      bbox = state.barrio?.bbox || state.section?.bbox || null;
    }

    // En isla/archipiélago sólo BIC declarados + castle (los “hitos”),
    // para no saturar. En niveles bajos se muestra todo el detalle.
    const islaLike = lvl === "isla" || lvl === "archipielago";

    const projected = [];
    for (const v of _items) {
      if (_activeTypes && !_activeTypes.has(v.tipo)) continue;
      if (!_inBbox(v.mx, v.mz, bbox)) continue;
      if (islaLike) {
        if (v.tipo !== "bic" && v.tipo !== "castle" && v.tipo !== "archaeological") continue;
        if (v.tipo === "archaeological" && !v.nombre) continue;
      }
      const [px, py] = project(v.mx, 0, v.mz, view);
      projected.push({ v, px, py });
    }

    // Cluster por proximidad
    const clusters = [];
    for (const item of projected) {
      let placed = false;
      for (const c of clusters) {
        if (Math.abs(c.px - item.px) < CLUSTER_PX &&
            Math.abs(c.py - item.py) < CLUSTER_PX) {
          c.items.push(item.v);
          c.px = (c.px * (c.items.length - 1) + item.px) / c.items.length;
          c.py = (c.py * (c.items.length - 1) + item.py) / c.items.length;
          placed = true;
          break;
        }
      }
      if (!placed) clusters.push({ px: item.px, py: item.py, items: [item.v] });
    }

    // ordenar por prioridad de tipo dominante: BIC > arqueológico > castle ...
    clusters.sort((a, b) => a.py - b.py);
    for (const c of clusters) {
      // tipo dominante = el de mayor prioridad (número menor)
      let dominant = c.items[0].tipo;
      let dprio = (_styleFor(dominant).priority || 99);
      for (const it of c.items) {
        const p = (_styleFor(it.tipo).priority || 99);
        if (p < dprio) { dprio = p; dominant = it.tipo; }
      }
      const style = _styleFor(dominant);
      _drawPin(ctx, c.px, c.py, dominant, style, c.items.length);
    }
  }
};
