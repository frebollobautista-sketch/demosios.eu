// Overlay "Calidad del aire" — pins coloreados por AQI sobre las
// estaciones de la red CEGCA Canarias. Datos en
// `data/calidad-aire-canarias.json` (placeholder v0 — ver
// scripts/refresh-calidad-aire.py para fetch en vivo desde AQICN/CEGCA).
//
// Diseño visual:
//   · pin circular grande (16px radio) coloreado por nivel AQI
//   · número AQI dentro del pin en blanco bold
//   · halo translúcido alrededor para que destaque sobre paper
//   · clustering en niveles bajos: si N estaciones quedan en <30px,
//     se agrupan con badge "N estaciones · AQI medio"
//
// Niveles donde aplica: TODOS (archipielago/isla/municipio/distrito/
// barrio/seccion/manzana). En archipiélago se ven las 24 estaciones
// como puntos calmos; al hacer zoom-in se separan y crecen.

import { project, lnglatToLocalMeters } from "../iso.js";

const DATA_URL = "../data/calidad-aire-canarias.json";
const GC_ANCHOR = [-15.55, 28.05];

// Escala oficial AQI EPA (igual que AQICN)
function _aqiColor(aqi) {
  if (aqi == null || !isFinite(aqi)) return "#9CA3A8";
  if (aqi <= 50)  return "#4aaa5a"; // verde — bueno
  if (aqi <= 100) return "#d4c44a"; // amarillo — moderado
  if (aqi <= 150) return "#e68a4f"; // naranja — poco saludable sensibles
  if (aqi <= 200) return "#c45a4a"; // rojo — poco saludable
  if (aqi <= 300) return "#9f4fe6"; // morado — muy malo
  return "#5c2424";                  // marrón oscuro — peligroso
}

function _aqiLabel(aqi) {
  if (aqi == null) return "—";
  if (aqi <= 50)  return "Bueno";
  if (aqi <= 100) return "Moderado";
  if (aqi <= 150) return "Poco sano (sensibles)";
  if (aqi <= 200) return "Poco sano";
  if (aqi <= 300) return "Muy malo";
  return "Peligroso";
}

const CLUSTER_PX = 30;
const PIN_R_BASE = 14;

let _stations = null;     // [{ id, nombre, isla, mx, mz, aqi, dominantpol }]
let _meta = null;
let _loadingPromise = null;

async function _load() {
  if (_stations) return _stations;
  if (_loadingPromise) return _loadingPromise;
  _loadingPromise = fetch(DATA_URL, { cache: "no-cache" })
    .then(r => r.ok ? r.json() : Promise.reject(new Error("status " + r.status)))
    .then(json => {
      _meta = {
        version: json.version, fuente: json.fuente,
        actualizado: json.actualizado, leyenda: json.leyenda_aqi
      };
      const out = [];
      for (const s of (json.estaciones || [])) {
        const [mx, mz] = lnglatToLocalMeters(s.lng, s.lat, GC_ANCHOR);
        out.push({
          id: s.id,
          nombre: s.nombre,
          isla: s.isla,
          mx, mz,
          aqi: s.aqi,
          dominantpol: s.dominantpol,
          actualizado: s.actualizado
        });
      }
      _stations = out;
      return _stations;
    })
    .catch(err => {
      console.warn("[calidadAireOverlay] load fallo:", err);
      _stations = null;
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

function _drawPin(ctx, px, py, aqi, count) {
  const color = _aqiColor(aqi);
  // Halo translúcido
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(px, py, PIN_R_BASE + 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Pin
  ctx.beginPath();
  ctx.arc(px, py, PIN_R_BASE, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#1A1612";
  ctx.stroke();
  // AQI number
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 11px 'IBM Plex Mono', SF Mono, Menlo, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(aqi != null ? String(aqi) : "–", px, py);
  // Badge cluster
  if (count > 1) {
    ctx.beginPath();
    ctx.arc(px + 10, py - 10, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#1A1612";
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 9px 'IBM Plex Mono', monospace";
    ctx.fillText(String(count), px + 10, py - 10);
  }
}

export const calidadAireOverlay = {
  id: "calidad-aire",
  name: "Calidad del aire (AQI)",

  load: _load,
  isReady: () => Array.isArray(_stations),

  draw: (ctx, state, view) => {
    if (!_stations || !_stations.length) return;
    let bbox = null;
    if (state.lodLevel === "municipio") bbox = state.municipio?.bbox;
    else if (state.lodLevel === "distrito") bbox = state.district?.bbox;
    else if (state.lodLevel === "seccion") bbox = state.section?.bbox || state.section?._bbox || null;
    else if (state.lodLevel === "isla") bbox = state.isla?.bbox;
    // Archipiélago: muestra TODAS las estaciones
    const projected = [];
    for (const s of _stations) {
      if (!_inBbox(s.mx, s.mz, bbox)) continue;
      const [px, py] = project(s.mx, 0, s.mz, view);
      projected.push({ s, px, py });
    }

    // Cluster por proximidad
    const clusters = [];
    for (const item of projected) {
      let placed = false;
      for (const c of clusters) {
        if (Math.abs(c.px - item.px) < CLUSTER_PX &&
            Math.abs(c.py - item.py) < CLUSTER_PX) {
          c.items.push(item.s);
          c.px = (c.px * (c.items.length - 1) + item.px) / c.items.length;
          c.py = (c.py * (c.items.length - 1) + item.py) / c.items.length;
          placed = true;
          break;
        }
      }
      if (!placed) clusters.push({ px: item.px, py: item.py, items: [item.s] });
    }

    // Pintar (ordenado por y desc para que cercanos queden encima)
    clusters.sort((a, b) => a.py - b.py);
    for (const c of clusters) {
      // AQI dominante: el peor del cluster (más visible = más alarma)
      let worst = -Infinity;
      for (const s of c.items) {
        if (typeof s.aqi === "number" && s.aqi > worst) worst = s.aqi;
      }
      _drawPin(ctx, c.px, c.py, worst === -Infinity ? null : Math.round(worst), c.items.length);
    }
  },

  getMeta: () => _meta,
  getStations: () => _stations
};
