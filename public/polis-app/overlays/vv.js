// Overlay "Viviendas Vacacionales" (vv) — puntos del Registro General
// Turístico de Canarias. Portado del visor canónico MapLibre
// (polis-provincia.html · setupVVLayer/toggleVV) al runtime iso 2D.
//
// API (igual que renta.js):
//   vvOverlay.id        → "vv"
//   vvOverlay.name      → "Viviendas vacacionales"
//   vvOverlay.load()    → fetch geojson + stats, preproyecta a metros
//                         locales (cacheado, idempotente).
//   vvOverlay.isReady() → true cuando load() resolvió bien.
//   vvOverlay.draw(ctx, state, view) → renderiza según lodLevel.
//
// Estrategia por nivel:
//  - isla / municipio: un marcador por municipio en su _centroid, con
//      radio ~ sqrt(count) (escala continua del canónico). Color
//      naranja cálido #e07a3a → #8a3a10 (steps idénticos al MapLibre).
//      Etiqueta numérica si el marcador es lo bastante grande.
//  - distrito / seccion: pintar puntos individuales del geojson cuyo
//      bbox local intersecte el bbox del nivel actual. Cluster simple
//      por celdas (grid en metros) si superan ~120 puntos en vista,
//      para no degradar el fps a 60.
//
// Paleta y radios: copiados de setupVVLayer (vv-clusters paint.steps,
// vv-points circle-color). Mantenemos paridad cromática con el visor
// canónico para que un mismo dato se reconozca entre vistas.

import { project, lnglatToLocalMeters } from "../iso.js";

const GEO_URL   = "../data/vv-prov35.geojson";
const STATS_URL = "../data/vv-municipio-stats.json";
const GC_ANCHOR = [-15.55, 28.05];

// Paleta del canónico (vv-clusters paint['circle-color'] step).
// Umbrales: <10, <100, <500, >=500.
const C_S   = "#e07a3a"; // <10  / punto individual
const C_M   = "#d4632a"; // <100
const C_L   = "#b54a18"; // <500
const C_XL  = "#8a3a10"; // >=500
const C_STROKE = "rgba(20,16,10,0.9)";

function _colorForCount(n) {
  if (n >= 500) return C_XL;
  if (n >= 100) return C_L;
  if (n >= 10)  return C_M;
  return C_S;
}

// Radio en píxeles para un agregador con `n` puntos. Replicamos
// approx el step del canónico (10/16/24/32) pero con curva continua
// sqrt para que los municipios pequeños no desaparezcan.
function _radiusForCount(n) {
  if (n <= 0) return 0;
  const r = Math.sqrt(n) * 1.35;
  return Math.max(6, Math.min(36, r));
}

// Slug compartido entre `vv-municipio-stats` ("Las Palmas De Gran Canaria")
// y `nmun` ("Palmas de Gran Canaria, Las"): lowercase, sin tildes,
// sin comas/espacios/puntos. La inversión "X, Las" → "Las X" se
// resuelve sólo con el match por conjunto de palabras (sort).
function _slug(s) {
  if (!s) return "";
  const norm = s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[,.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Orden alfabético de palabras para que "palmas gran canaria las"
  // == "las palmas de gran canaria" (mod stopwords). Conservamos "de".
  return norm.split(" ").sort().join(" ");
}

let _points = null;          // [{ mx, mz, plazas, municipio, nombre }]
let _statsByMunSlug = null;  // Map<slug, { count, plazas, displayName }>
let _loadingPromise = null;

function _buildStatsIndex(stats) {
  const m = new Map();
  for (const k of Object.keys(stats)) {
    m.set(_slug(k), { ...stats[k], displayName: k });
  }
  return m;
}

function _preprojectFeatures(geojson) {
  const out = [];
  const feats = geojson && geojson.features;
  if (!Array.isArray(feats)) return out;
  for (let i = 0; i < feats.length; i++) {
    const f = feats[i];
    if (!f || !f.geometry || f.geometry.type !== "Point") continue;
    const c = f.geometry.coordinates;
    if (!c || c.length < 2) continue;
    const lng = c[0], lat = c[1];
    if (!isFinite(lng) || !isFinite(lat)) continue;
    const [mx, mz] = lnglatToLocalMeters(lng, lat, GC_ANCHOR);
    const p = f.properties || {};
    out.push({
      mx, mz,
      plazas: typeof p.plazas === "number" ? p.plazas : 0,
      municipio: p.municipio || "",
      nombre: p.nombre || ""
    });
  }
  return out;
}

// ---------- helpers de dibujo ----------

function _drawMarker(ctx, px, py, radius, color, label) {
  ctx.beginPath();
  ctx.arc(px, py, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.78;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = C_STROKE;
  ctx.stroke();

  if (label && radius >= 11) {
    ctx.font = "600 " + Math.round(Math.min(15, radius * 0.85)) + "px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 2;
    ctx.strokeText(label, px, py);
    ctx.fillText(label, px, py);
  }
}

function _drawDot(ctx, px, py, r) {
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fillStyle = C_S;
  ctx.globalAlpha = 0.85;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1;
  ctx.strokeStyle = C_STROKE;
  ctx.stroke();
}

// ---------- niveles altos: marcador por municipio ----------

function _drawIslaOrMunicipio(ctx, state, view) {
  const munis = state.isla && state.isla.municipios;
  if (!munis || !munis.length) return;
  for (const m of munis) {
    const centroid = m._centroid;
    if (!centroid) continue;
    const nmun = m.properties && m.properties.nmun;
    if (!nmun) continue;
    const row = _statsByMunSlug.get(_slug(nmun));
    if (!row || !row.count) continue;
    const [px, py] = project(centroid[0], 0, centroid[1], view);
    const r = _radiusForCount(row.count);
    _drawMarker(ctx, px, py, r, _colorForCount(row.count), String(row.count));
  }
}

// ---------- niveles bajos: puntos individuales con cluster suave ----------

// Cuenta cuántos puntos caen dentro del bbox y devuelve indices.
function _pointsInBbox(bbox) {
  if (!bbox) return null;
  const [minX, minZ, maxX, maxZ] = bbox;
  const idx = [];
  for (let i = 0; i < _points.length; i++) {
    const p = _points[i];
    if (p.mx >= minX && p.mx <= maxX && p.mz >= minZ && p.mz <= maxZ) idx.push(i);
  }
  return idx;
}

// Cluster por grid simple en metros. cellSize ~ radio efectivo
// del clusterRadius:45px del canónico, traducido a metros según
// view.scale. Devuelve [{mx, mz, count}].
function _gridCluster(indices, cellMeters) {
  const cells = new Map();
  for (const i of indices) {
    const p = _points[i];
    const cx = Math.floor(p.mx / cellMeters);
    const cy = Math.floor(p.mz / cellMeters);
    const key = cx + "|" + cy;
    let bucket = cells.get(key);
    if (!bucket) { bucket = { sx: 0, sz: 0, count: 0 }; cells.set(key, bucket); }
    bucket.sx += p.mx;
    bucket.sz += p.mz;
    bucket.count++;
  }
  const out = [];
  for (const b of cells.values()) {
    out.push({ mx: b.sx / b.count, mz: b.sz / b.count, count: b.count });
  }
  return out;
}

function _drawPointsLevel(ctx, bbox, view) {
  const idx = _pointsInBbox(bbox);
  if (!idx || !idx.length) return;

  // Umbral simple: si hay muchos puntos, agrupamos por celdas.
  if (idx.length > 120) {
    // Tamaño de celda: 45px del canónico → metros locales según view.scale.
    // view.scale ~ px/m. Fallback razonable si no existe.
    const pxPerM = (view && view.scale) ? view.scale : 0.02;
    const cellMeters = Math.max(40, 45 / Math.max(pxPerM, 1e-6));
    const clusters = _gridCluster(idx, cellMeters);
    for (const c of clusters) {
      const [px, py] = project(c.mx, 0, c.mz, view);
      if (c.count === 1) {
        _drawDot(ctx, px, py, 3.5);
      } else {
        const r = _radiusForCount(c.count);
        _drawMarker(ctx, px, py, r, _colorForCount(c.count), String(c.count));
      }
    }
    return;
  }

  for (const i of idx) {
    const p = _points[i];
    const [px, py] = project(p.mx, 0, p.mz, view);
    _drawDot(ctx, px, py, 3.5);
  }
}

// ---------- export ----------

export const vvOverlay = {
  id: "vv",
  name: "Viviendas vacacionales",

  load: async () => {
    if (_points && _statsByMunSlug) return _points;
    if (_loadingPromise) return _loadingPromise;
    _loadingPromise = Promise.all([
      fetch(GEO_URL).then(r => {
        if (!r.ok) throw new Error("vv geo fetch " + r.status);
        return r.json();
      }),
      fetch(STATS_URL).then(r => {
        if (!r.ok) throw new Error("vv stats fetch " + r.status);
        return r.json();
      })
    ])
      .then(([geojson, stats]) => {
        _points = _preprojectFeatures(geojson);
        _statsByMunSlug = _buildStatsIndex(stats);
        return _points;
      })
      .catch(err => {
        console.warn("[vvOverlay] no se pudo cargar:", err);
        _points = null;
        _statsByMunSlug = null;
        _loadingPromise = null;
        return null;
      });
    return _loadingPromise;
  },

  isReady: () => Array.isArray(_points) && _statsByMunSlug !== null,

  draw: (ctx, state, view) => {
    if (!_points || !_statsByMunSlug) return;
    if (!state || !view) return;
    const lvl = state.lodLevel;
    ctx.save();
    if (lvl === "isla" || lvl === "municipio") {
      // Para municipio, también mostramos el marcador agregado
      // del propio municipio (mismo centroid). Los puntos finos
      // aparecen al bajar a distrito/sección.
      _drawIslaOrMunicipio(ctx, state, view);
    } else if (lvl === "distrito") {
      _drawPointsLevel(ctx, state.district && state.district.bbox, view);
    } else if (lvl === "seccion") {
      const bbox = (state.section && (state.section.bbox || state.section._bbox)) || null;
      _drawPointsLevel(ctx, bbox, view);
    }
    ctx.restore();
  },

  // Útil para una futura `showVVLegend()` o tooltip.
  getStatsForMun: (nmun) => {
    if (!_statsByMunSlug) return null;
    return _statsByMunSlug.get(_slug(nmun)) || null;
  }
};
