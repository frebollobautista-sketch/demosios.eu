// Overlay "Sedes culturales" — bibliotecas, teatros, cines, museos,
// centros de artes/cívicos/sociales extraídos del PBF OSM Geofabrik.
// 691 puntos (124 bibliotecas + 197 museos + 91 teatros + 22 cines +
// 49 centros de artes + 193 centros cívicos + 15 centros sociales).
//
// Generación: scripts/extract-cultura-venues.py
// Datos:     public/data/cultura-venues.geojson

import { project, lnglatToLocalMeters } from "../iso.js";

const DATA_URL = "../data/cultura-venues.geojson";
const GC_ANCHOR = [-15.55, 28.05];

// Estilo por categoría (paleta paper-ocre + cyan para identificar como capa
// nueva). Glifos 2 chars para coherencia con productoresOverlay.
const CAT_STYLE = {
  biblioteca:     { fill: "#3D5A80", glyph: "BB", label: "Biblioteca" },
  museo:          { fill: "#9F4FE6", glyph: "Mu", label: "Museo" },
  teatro:         { fill: "#E63946", glyph: "Te", label: "Teatro" },
  cine:           { fill: "#1A1612", glyph: "Ci", label: "Cine" },
  centro_artes:   { fill: "#E68A4F", glyph: "Ar", label: "Centro de artes" },
  centro_civico:  { fill: "#5C8C5C", glyph: "Cv", label: "Centro cívico" },
  centro_social:  { fill: "#7B6F8C", glyph: "So", label: "Centro social" },
  _default:       { fill: "#6B6358", glyph: "··", label: "Sede cultural" }
};

const MARKER_R = 10;
const POLE_H = 10;
const CLUSTER_PX = 22;

let _venues = null;
let _loadingPromise = null;

function _styleFor(cat) {
  return CAT_STYLE[cat] || CAT_STYLE._default;
}

async function _load() {
  if (_venues) return _venues;
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
          id: f.properties?.osm_id || `v-${out.length}`,
          mx, mz,
          properties: { ...f.properties }
        });
      }
      _venues = out;
      return _venues;
    })
    .catch(err => {
      console.warn("[culturaVenuesOverlay] load fallo:", err);
      _venues = null;
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

function _drawPin(ctx, px, py, style, count) {
  // Asta vertical
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px, py - POLE_H);
  ctx.strokeStyle = "#1A1612";
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Banner redondeado (cultura = ligero, vs productores que es rectángulo)
  const cy = py - POLE_H - MARKER_R + 2;
  const w = MARKER_R * 2;
  const h = MARKER_R * 1.6;
  ctx.beginPath();
  const r = 4;
  ctx.moveTo(px - w/2 + r, cy - h/2);
  ctx.lineTo(px + w/2 - r, cy - h/2);
  ctx.quadraticCurveTo(px + w/2, cy - h/2, px + w/2, cy - h/2 + r);
  ctx.lineTo(px + w/2, cy + h/2 - r);
  ctx.quadraticCurveTo(px + w/2, cy + h/2, px + w/2 - r, cy + h/2);
  ctx.lineTo(px - w/2 + r, cy + h/2);
  ctx.quadraticCurveTo(px - w/2, cy + h/2, px - w/2, cy + h/2 - r);
  ctx.lineTo(px - w/2, cy - h/2 + r);
  ctx.quadraticCurveTo(px - w/2, cy - h/2, px - w/2 + r, cy - h/2);
  ctx.closePath();
  ctx.fillStyle = style.fill;
  ctx.fill();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = "#1A1612";
  ctx.stroke();

  // Glifo
  ctx.fillStyle = "#FFFFFF";
  ctx.font = count > 1
    ? "bold 9px system-ui, sans-serif"
    : "bold 10px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(count > 1 ? `${style.glyph}·${count}` : style.glyph, px, cy);

  // Anclaje inferior
  ctx.beginPath();
  ctx.arc(px, py, 2.4, 0, Math.PI * 2);
  ctx.fillStyle = "#1A1612";
  ctx.fill();
}

export const culturaVenuesOverlay = {
  id: "cultura-venues",
  name: "Sedes culturales",

  load: _load,
  isReady: () => Array.isArray(_venues),

  draw: (ctx, state, view) => {
    if (!_venues || !_venues.length) return;
    // 2026-05-31 — Baseline = bbox de la isla actual (datos multi-isla). Sin
    // esto, en isla bbox=null dejaba pasar venues de otras islas; en
    // archipielago state.isla es null → bbox null → todos en su posición real.
    let bbox = state.isla?.bbox || null;
    if (state.lodLevel === "municipio") bbox = state.municipio?.bbox || bbox;
    else if (state.lodLevel === "distrito") bbox = state.district?.bbox || bbox;
    else if (state.lodLevel === "seccion") {
      bbox = state.section?.bbox || state.section?._bbox || bbox;
    }
    // En isla/archipielago mostramos sólo los principales (museos +
    // bibliotecas grandes con nombre) para no saturar. En niveles bajos
    // mostramos todos los que caigan en bbox.
    const islaLike = state.lodLevel === "isla" || state.lodLevel === "archipielago";

    const projected = [];
    for (const v of _venues) {
      if (!_inBbox(v.mx, v.mz, bbox)) continue;
      if (islaLike) {
        // sólo museos y bibliotecas con nombre en niveles altos
        const cat = v.properties.categoria;
        if (cat !== "museo" && cat !== "biblioteca") continue;
        if (!v.properties.name) continue;
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

    // Dibujar (ordenados por y para que los más cercanos queden encima)
    clusters.sort((a, b) => a.py - b.py);
    for (const c of clusters) {
      const dominant = c.items[0].properties.categoria;
      const style = _styleFor(dominant);
      _drawPin(ctx, c.px, c.py, style, c.items.length);
    }
  }
};
