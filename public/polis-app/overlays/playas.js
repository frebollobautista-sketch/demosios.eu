// Overlay "Playas" (ESP-02) — 534 playas Canarias enriquecidas con
// bandera azul ADEAC 2025 + accesibilidad OSM.
//
// Datos: scripts/extract-playas.py → playas-canarias.geojson

import { project, lnglatToLocalMeters } from "../iso.js";

const DATA_URL = "../data/playas-canarias.geojson?v=20260527-playas-v0";
const GC_ANCHOR = [-15.55, 28.05];

const PIN_R = 9;
const CLUSTER_PX = 22;

let _data = null;
let _loadingPromise = null;
let _filter = { soloBandera: false, soloAccesibles: false };

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
      console.warn("[playasOverlay] load fallo:", err);
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
  const p = item.properties || {};
  if (_filter.soloBandera && !p.bandera_azul) return false;
  if (_filter.soloAccesibles && p.accesibilidad !== "silla_ruedas") return false;
  return true;
}

function _drawPin(ctx, px, py, item, count) {
  const p = item.properties;
  const isBandera = p.bandera_azul;
  const isAcc = p.accesibilidad === "silla_ruedas";

  // Halo azul cyan suave
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = "#3D5A80";
  ctx.beginPath();
  ctx.arc(px, py, PIN_R + 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Cuerpo de la playa: círculo arena
  ctx.beginPath();
  ctx.arc(px, py, PIN_R, 0, Math.PI * 2);
  ctx.fillStyle = isBandera ? "#3D5A80" : "#E2C99A";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#1A1612";
  ctx.stroke();

  // Mini bandera azul para playas premium
  if (isBandera) {
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 9px Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("★", px, py);
  }

  // Badge accesibilidad (silla)
  if (isAcc) {
    ctx.beginPath();
    ctx.arc(px + 7, py + 6, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#6FA56F";
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 6.5px sans-serif";
    ctx.fillText("♿", px + 7, py + 6);
  }

  // Cluster badge
  if (count > 1) {
    ctx.beginPath();
    ctx.arc(px + 8, py - 8, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#1A1612";
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 8px 'IBM Plex Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(count), px + 8, py - 8);
  }
}

export const playasOverlay = {
  id: "playas",
  name: "Playas",

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
      // Prioriza el item con bandera azul si hay
      const best = c.items.find(x => x.properties.bandera_azul) || c.items[0];
      _drawPin(ctx, c.px, c.py, best, c.items.length);
    }
  },

  // API filtros (sub-toggles del drawer)
  getSubcatOptions: () => [
    { id: "bandera_azul", label: "Solo bandera azul", color: "#3D5A80" },
    { id: "accesibles",   label: "Accesibles silla ruedas", color: "#6FA56F" }
  ],
  setSubcatFilter: (ids) => {
    const s = new Set(ids || []);
    _filter = {
      soloBandera: s.has("bandera_azul"),
      soloAccesibles: s.has("accesibles")
    };
  },
  getSubcatFilter: () => {
    const out = [];
    if (_filter.soloBandera) out.push("bandera_azul");
    if (_filter.soloAccesibles) out.push("accesibles");
    return out;
  }
};
