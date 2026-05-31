// Overlay "Centros educativos" — puntos del directorio de centros de
// la Consejería de Educación (provincia 35) + stats agregadas por
// municipio. Portado del visor canónico MapLibre
// (polis-provincia.html · toggleEducacion / setupEducacionLayer) al
// runtime iso vanilla 2D.
//
// API mínima (idéntica al resto de overlays):
//   educacionOverlay.id        → "educacion"
//   educacionOverlay.name      → "Centros educativos"
//   educacionOverlay.load()    → fetch + preproyección. Idempotente.
//   educacionOverlay.draw(ctx, state, view)
//   educacionOverlay.isReady() → true si load() resolvió
//
// Render por nivel:
//   - isla:      una burbuja por municipio en su centroide, área ∝ total
//                (sqrt scale). Color educativo azul medio del canónico.
//   - municipio / distrito / sección:
//                puntos individuales del geojson, filtrados por bbox
//                del nivel. Color por `categoria` (paleta exacta del
//                canónico: publico #5a90c0, concertado #9ec0d8,
//                privado #c08a5a, otro #888).
//
// El geojson se preproyecta entero en load() — son ~1000 puntos, una
// pasada y a guardar. Por frame sólo filtramos por bbox + project().

import { project, lnglatToLocalMeters } from "../iso.js";

// 2026-05-27 — Multi-provincia: prov 35 (GC/LZ/FV) + prov 38 (TF/LP/LG/EH)
// se cargan en paralelo y se concatenan al construir _points y _stats.
const POINTS_URLS = [
  "../data/centros-educativos-prov35.geojson",
  "../data/centros-educativos-prov38.geojson?v=20260527-edu38-v0"
];
const STATS_URLS = [
  "../data/centros-educativos-stats.json",
  "../data/centros-educativos-stats-prov38.json?v=20260527-edu38-v0"
];
const GC_ANCHOR  = [-15.55, 28.05];

// Paleta exacta del canónico (polis-provincia.html · educacion-points).
// Si cambias estos colores, actualiza también el visor MapLibre.
const COLOR_BY_CAT = {
  publico:    "#5a90c0",
  concertado: "#9ec0d8",
  privado:    "#c08a5a",
  otro:       "#888888"
};
const COLOR_DEFAULT = "#888888";

// Color "sombrilla" para la burbuja a nivel isla (publico domina en
// casi todos los municipios de la provincia).
const ISLA_BUBBLE_FILL   = "#5a90c0";
const ISLA_BUBBLE_STROKE = "rgba(15,12,10,0.9)";
const POINT_STROKE       = "rgba(15,12,10,0.9)";

// Tamaños en píxeles de pantalla (no escalan con el zoom — se podría
// hacer, pero por consistencia con cómo dibuja `renta.js` los rellenos
// los mantenemos en screen-space).
const POINT_R   = 3.5;
const POINT_LW  = 1.0;
const BUBBLE_LW = 1.2;

let _points = null;        // Array<{ cat, etapa_bucket, mx, mz, mun }>
let _stats  = null;        // Map<MUN_NORMALIZED, {total, publico, ...}>
let _loadingPromise = null;
let _etapaFilter = null;   // 2026-05-27 sub-chip filter por etapa

// 2026-05-27 — Mapping de códigos de etapa canarios a bucket simple.
// Códigos detectados: CEIP/IES/CEP/CEO/IFPMP/CPEIPS/EA/CPEIP/RE/CEE/CPEE/
//   CPDEM/CPES/EASD/CAEPA/EEI/IFPA/CPEPS/CPM/CEPA/CPDEP/EOI/CEAD/CPFP/
//   AEOI/EMM/CAMGEM/EMMD/CIMGE/CPEI/CASAD/EIM/CSM/UAPA/CPEIS/CIFP/CAEDGM/
//   CIPFP/CAEDGMS/CEL
const ETAPA_BUCKETS = {
  // Infantil + Primaria + Educación de Adultos / Educación social
  infantil_primaria: new Set([
    "CEIP", "EEI", "CPEIP", "CPEIPS", "CPEI", "CPEIS", "CEPA", "UAPA",
  ]),
  // Secundaria + Bachillerato
  secundaria: new Set(["IES", "CEO", "CEP", "CPES", "CPEPS"]),
  // FP
  fp: new Set([
    "CIFP", "CIPFP", "CPFP", "IFPMP", "IFPA", "CAEDGM", "CAEDGMS",
  ]),
  // Idiomas
  idiomas: new Set(["EOI", "AEOI"]),
  // Música / Arte / Danza
  musica_arte: new Set([
    "CPDEM", "CPDEP", "EMM", "EMMD", "EIM", "CSM", "CPM", "CAMGEM",
    "CIMGE", "CASAD", "EA", "EASD",
  ]),
  // Especial / Adultos / Otras
  especial_otros: new Set(["CEE", "CPEE", "CEAD", "CEL", "CAEPA", "RE"]),
};
const ETAPA_LABELS = {
  infantil_primaria: { label: "Infantil y Primaria", fill: "#5a90c0", glyph: "IP" },
  secundaria:        { label: "Secundaria",          fill: "#3a6a90", glyph: "Sc" },
  fp:                { label: "FP",                  fill: "#8a5cc0", glyph: "FP" },
  idiomas:           { label: "Idiomas",             fill: "#5cc090", glyph: "Id" },
  musica_arte:       { label: "Música y Arte",       fill: "#c08a5c", glyph: "Ar" },
  especial_otros:    { label: "Especial / Adultos",  fill: "#888888", glyph: "Es" },
};
function _etapaBucket(etapa) {
  if (!etapa) return "especial_otros";
  for (const [b, set] of Object.entries(ETAPA_BUCKETS)) {
    if (set.has(etapa)) return b;
  }
  return "especial_otros";
}

// Normaliza nombres de municipio para hacer match entre el `nmun` del
// geojson de la provincia (formato "Agaete", "Palmas de Gran Canaria,
// Las") y las claves de `centros-educativos-stats.json` (UPPERCASE,
// "LAS PALMAS DE GRAN CANARIA"). Estrategia:
//   1) NFD + quitar tildes
//   2) UPPERCASE
//   3) si acaba en ", LAS" / ", LA" → mueve el artículo al inicio
function _normalizeMun(name) {
  if (!name) return "";
  let s = String(name)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();
  const m = s.match(/^(.+),\s*(LAS|LA|EL|LOS)$/);
  if (m) s = m[2] + " " + m[1];
  return s;
}

function _bboxContains(bbox, mx, mz) {
  // bbox = [minx, miny, maxx, maxy] en metros locales (mx, mz).
  if (!bbox) return true;
  return mx >= bbox[0] && mx <= bbox[2] && mz >= bbox[1] && mz <= bbox[3];
}

function _drawPoint(ctx, mx, mz, view, color) {
  const [px, py] = project(mx, 0, mz, view);
  ctx.beginPath();
  ctx.arc(px, py, POINT_R, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = POINT_LW;
  ctx.strokeStyle = POINT_STROKE;
  ctx.stroke();
}

function _drawPointsInBbox(ctx, view, bbox) {
  if (!_points) return;
  for (let i = 0; i < _points.length; i++) {
    const p = _points[i];
    if (!_bboxContains(bbox, p.mx, p.mz)) continue;
    if (_etapaFilter && !_etapaFilter.has(p.etapa_bucket)) continue;
    // 2026-05-27 — Si hay filtro de etapa activo, el color del punto se
    // toma del bucket (no de categoria) para reforzar la semántica del
    // chip activo.
    const color = _etapaFilter
      ? (ETAPA_LABELS[p.etapa_bucket]?.fill || COLOR_DEFAULT)
      : (COLOR_BY_CAT[p.cat] || COLOR_DEFAULT);
    _drawPoint(ctx, p.mx, p.mz, view, color);
  }
}

function _drawIslaBubbles(ctx, state, view) {
  if (!_stats || !state.isla || !state.isla.municipios) return;
  ctx.lineWidth = BUBBLE_LW;
  ctx.strokeStyle = ISLA_BUBBLE_STROKE;
  ctx.fillStyle = ISLA_BUBBLE_FILL;
  for (const m of state.isla.municipios) {
    const c = m._centroid;
    if (!c) continue;
    const nmun = m.properties && m.properties.nmun;
    const row = _stats.get(_normalizeMun(nmun));
    if (!row || !row.total) continue;
    const r = 3 + Math.sqrt(row.total) * 1.2;
    const [px, py] = project(c[0], 0, c[1], view);
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

export const educacionOverlay = {
  id: "educacion",
  name: "Centros educativos",

  load: async () => {
    if (_points && _stats) return { points: _points, stats: _stats };
    if (_loadingPromise) return _loadingPromise;
    _loadingPromise = Promise.all([
      Promise.all(POINTS_URLS.map(u => fetch(u).then(r => r.ok ? r.json() : null).catch(() => null))),
      Promise.all(STATS_URLS.map(u => fetch(u).then(r => r.ok ? r.json() : null).catch(() => null)))
    ])
      .then(([geos, statsArr]) => {
        // Concatena features de ambas provincias en una sola lista
        const feats = geos.flatMap(g => (g && g.features) || []);
        // Merge stats objetos en uno (claves: nombre municipio normalizado)
        const stats = {};
        for (const s of statsArr) {
          if (!s) continue;
          for (const k of Object.keys(s)) stats[k] = s[k];
        }
        // Preproyecta los puntos a metros locales con GC_ANCHOR. Como
        // todo el visor iso vive en este sistema, basta una pasada.
        const out = [];
        for (let i = 0; i < feats.length; i++) {
          const f = feats[i];
          const g = f && f.geometry;
          if (!g || g.type !== "Point") continue;
          const coords = g.coordinates;
          if (!coords || coords.length < 2) continue;
          const [mx, mz] = lnglatToLocalMeters(coords[0], coords[1], GC_ANCHOR);
          const props = f.properties || {};
          out.push({
            mx, mz,
            cat: props.categoria || "otro",
            etapa_bucket: _etapaBucket(props.etapa),
            mun: props.municipio || ""
          });
        }
        _points = out;
        // Construye Map con clave normalizada.
        const sm = new Map();
        for (const k of Object.keys(stats || {})) {
          sm.set(_normalizeMun(k), stats[k]);
        }
        _stats = sm;
        return { points: _points, stats: _stats };
      })
      .catch(err => {
        console.warn("[educacionOverlay] no se pudo cargar:", err);
        _points = null;
        _stats = null;
        _loadingPromise = null;
        return null;
      });
    return _loadingPromise;
  },

  isReady: () => _points !== null && _stats !== null,

  // Render por nivel:
  //  - isla:      una burbuja por municipio (sqrt(total)).
  //  - municipio: puntos individuales filtrados por bbox del municipio.
  //  - distrito:  puntos individuales filtrados por bbox del distrito.
  //  - sección:   puntos individuales filtrados por bbox de la sección.
  draw: (ctx, state, view) => {
    if (!_points || !_stats) return;
    if (!state || !view) return;
    const lvl = state.lodLevel;
    ctx.save();
    if (lvl === "isla") {
      _drawIslaBubbles(ctx, state, view);
    } else if (lvl === "municipio") {
      _drawPointsInBbox(ctx, view, state.municipio?.bbox);
    } else if (lvl === "distrito") {
      _drawPointsInBbox(ctx, view, state.district?.bbox);
    } else if (lvl === "seccion" || lvl === "section") {
      // En sección el bbox vive como _bbox.
      const bb = (state.section && (state.section._bbox || state.section.bbox)) || null;
      _drawPointsInBbox(ctx, view, bb);
    }
    ctx.restore();
  },

  // Hook útil si más adelante queremos pintar una leyenda.
  getStats: () => _stats,
  getPoints: () => _points,

  // 2026-05-27 — API sub-chips por etapa (6 buckets sintéticos)
  getSubcatOptions: () => Object.entries(ETAPA_LABELS).map(([key, v]) => ({
    key, label: v.label, fill: v.fill, glyph: v.glyph,
  })),
  setSubcatFilter: (etapas) => {
    if (!etapas || (etapas.size !== undefined && etapas.size === 0)) {
      _etapaFilter = null;
    } else {
      _etapaFilter = etapas instanceof Set ? etapas : new Set(etapas);
    }
  },
};
