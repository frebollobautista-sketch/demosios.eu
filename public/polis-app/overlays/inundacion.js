// Overlay "Zonas inundables" (RIE-01) — polígonos translúcidos sobre
// tramos ARPSI (Áreas de Riesgo Potencial Significativo de Inundación)
// generados a partir del dataset oficial PEINCA del Gobierno de Canarias
// (SITCAN), buffer 50 m fluvial / 100 m costera, simplificación 30 m.
//
// Datos: `data/zonas-inundables-canarias.geojson` — 180 polígonos
//   (34 fluviales + 146 costeras) en WGS84. ~165 KB.
//
// API:
//   inundacionOverlay.id        = "inundacion"
//   inundacionOverlay.name      = "Zonas inundables"
//   inundacionOverlay.load()    → fetch + cache + preproyección
//   inundacionOverlay.draw(ctx, state, view)
//   inundacionOverlay.isReady() → true tras load() OK
//
// Render: niveles `municipio`, `distrito`, `barrio`, `seccion`. En isla
// los tramos son demasiado finos para aportar (saturarían); a nivel
// manzana la granularidad es ya excesivamente fina y los polígonos del
// buffer pierden sentido (entrarían en edificios concretos cuando lo
// que el indicador transmite es "este barranco/tramo costero tiene
// riesgo"). Filtramos por bbox del nivel para no recorrer toda Canarias.
//
// Paleta — escala "más azul = más riesgo" (la T100 del SNCZI estatal se
// representa típicamente en azul saturado; T500 en azul claro):
//   fluvial  → azul medio, alpha 0.30  (categoría T100 — ARPSI fluvial)
//   costera  → cyan,       alpha 0.28  (costera / temporal marino)
// (DPH y T10 no están en este dataset autonómico; la paleta queda
// preparada por si en una iter posterior se integran del SNCZI).
//
// Leyenda: si el overlay está activo se renderiza/oculta el div
// `#inundacion-legend` en bottom-left. El HTML lo crea el overlay al
// vuelo si no existe — así no hay que tocar `index.html`.

import { project, lnglatToLocalMeters } from "../iso.js";

const DATA_URL  = "../data/zonas-inundables-canarias.geojson";
const GC_ANCHOR = [-15.55, 28.05];

// Paleta — keyed por properties.categoria del geojson. El extractor
// produce "T100" para fluvial y "costera" para frente marino. T10/T500
// /DPH se conservan en la paleta por si llegan datos SNCZI nacionales
// en futuras iteraciones (Pancho lo dejó previsto en el brief).
const STYLES = {
  T10:      { fill: "rgba( 40,110,200,0.40)", stroke: "rgba( 70,140,220,0.75)", label: "Riesgo alto (T10)" },
  T100:     { fill: "rgba( 70,140,220,0.30)", stroke: "rgba(100,170,235,0.65)", label: "Riesgo fluvial (ARPSI)" },
  T500:     { fill: "rgba(140,190,235,0.20)", stroke: "rgba(160,205,240,0.50)", label: "Riesgo bajo (T500)" },
  DPH:      { fill: "rgba( 40,200,220,0.50)", stroke: "rgba( 80,220,235,0.80)", label: "Dominio Público Hidráulico" },
  costera:  { fill: "rgba( 90,190,210,0.28)", stroke: "rgba(120,210,225,0.60)", label: "Riesgo costero / temporal" },
};
const DEFAULT_STYLE = STYLES.T100;
const STROKE_WIDTH  = 0.6;

// Categorías efectivamente presentes (rellenado en load()). Sirve para
// pintar la leyenda sólo con lo que se está mostrando realmente.
const _present = new Set();

// Cada polígono pre-proyectado: {ring, bbox, categoria}. Holes ignorados
// (mismo criterio que cobertura/parques — alpha bajo lee mejor sin huecos).
let _polys = null;
let _hadHoles = false;
let _loadingPromise = null;

function _ringBbox(ring) {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < ring.length; i++) {
    const x = ring[i][0], z = ring[i][1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return [minX, minZ, maxX, maxZ];
}

function _projectRing(lnglatRing) {
  const out = new Array(lnglatRing.length);
  for (let i = 0; i < lnglatRing.length; i++) {
    const ll = lnglatRing[i];
    out[i] = lnglatToLocalMeters(ll[0], ll[1], GC_ANCHOR);
  }
  return out;
}

function _ingestFeature(feature) {
  const out = [];
  const g = feature && feature.geometry;
  if (!g) return out;
  const props = feature.properties || {};
  const categoria = props.categoria || "T100";
  if (g.type === "Polygon") {
    if (g.coordinates && g.coordinates[0]) {
      if (g.coordinates.length > 1) _hadHoles = true;
      const ring = _projectRing(g.coordinates[0]);
      out.push({ ring, bbox: _ringBbox(ring), categoria });
    }
  } else if (g.type === "MultiPolygon") {
    for (const poly of g.coordinates || []) {
      if (!poly || !poly[0]) continue;
      if (poly.length > 1) _hadHoles = true;
      const ring = _projectRing(poly[0]);
      out.push({ ring, bbox: _ringBbox(ring), categoria });
    }
  }
  return out;
}

function _bboxIntersects(a, b) {
  if (!a || !b) return true;
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
}

function _levelBbox(state) {
  const lvl = state.lodLevel;
  if (lvl === "municipio") return state.municipio && state.municipio.bbox;
  if (lvl === "distrito")  return state.district  && state.district.bbox;
  if (lvl === "barrio")    return state.barrio    && state.barrio.bbox;
  if (lvl === "seccion")   return state.section   && state.section.bbox;
  return null;
}

function _drawPolys(ctx, view, levelBbox) {
  if (!_polys || !_polys.length) return;
  ctx.lineWidth = STROKE_WIDTH;
  // El extractor agrupa por orden de tipo (fluvial primero, costera
  // después) — no es estricto pero minimiza cambios de fillStyle.
  let curFill = null;
  let curStroke = null;
  for (let i = 0; i < _polys.length; i++) {
    const poly = _polys[i];
    if (!_bboxIntersects(poly.bbox, levelBbox)) continue;
    const ring = poly.ring;
    if (ring.length < 3) continue;
    const style = STYLES[poly.categoria] || DEFAULT_STYLE;
    if (style.fill !== curFill) {
      ctx.fillStyle = style.fill;
      curFill = style.fill;
    }
    if (style.stroke !== curStroke) {
      ctx.strokeStyle = style.stroke;
      curStroke = style.stroke;
    }
    ctx.beginPath();
    for (let j = 0; j < ring.length; j++) {
      const [px, py] = project(ring[j][0], 0, ring[j][1], view);
      if (j === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

// -----------------------------------------------------------
// Leyenda flotante bottom-left. Se inyecta on-demand para no
// requerir tocar index.html ni style.css. Se muestra/oculta según
// el toggle del overlay. CSS inline mínimo (mismo lenguaje visual
// que las píldoras del cog-modal: papel translúcido, borde tinta).

const LEGEND_ID = "inundacion-legend";

function _ensureLegendNode() {
  let el = document.getElementById(LEGEND_ID);
  if (el) return el;
  el = document.createElement("div");
  el.id = LEGEND_ID;
  el.setAttribute("aria-hidden", "true");
  Object.assign(el.style, {
    position: "fixed",
    left: "12px",
    bottom: "12px",
    zIndex: "40",
    background: "rgba(252,247,236,0.92)",
    border: "1px solid rgba(60,40,20,0.35)",
    borderRadius: "6px",
    padding: "6px 9px",
    font: "11px/1.35 system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    color: "#3a2814",
    boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
    pointerEvents: "none",
    display: "none",
    maxWidth: "240px",
  });
  document.body.appendChild(el);
  return el;
}

function _renderLegend() {
  const el = _ensureLegendNode();
  const rows = [];
  rows.push(`<div style="font-weight:600;margin-bottom:3px">Zonas inundables (ARPSI)</div>`);
  for (const key of ["T10", "T100", "DPH", "T500", "costera"]) {
    if (!_present.has(key)) continue;
    const s = STYLES[key];
    rows.push(
      `<div style="display:flex;align-items:center;gap:6px;margin:1px 0">` +
        `<span style="display:inline-block;width:14px;height:10px;` +
              `background:${s.fill};border:1px solid ${s.stroke}"></span>` +
        `<span>${s.label}</span>` +
      `</div>`
    );
  }
  rows.push(`<div style="font-size:10px;opacity:0.7;margin-top:3px">PEINCA · Gob. Canarias</div>`);
  el.innerHTML = rows.join("");
}

function _showLegend() {
  const el = _ensureLegendNode();
  _renderLegend();
  el.style.display = "block";
}

function _hideLegend() {
  const el = document.getElementById(LEGEND_ID);
  if (el) el.style.display = "none";
}

// -----------------------------------------------------------

export const inundacionOverlay = {
  id: "inundacion",
  name: "Zonas inundables",

  load: async () => {
    if (_polys) return _polys;
    if (_loadingPromise) return _loadingPromise;
    _loadingPromise = fetch(DATA_URL)
      .then(r => {
        if (!r.ok) throw new Error("inundacion fetch " + r.status);
        return r.json();
      })
      .then(json => {
        _hadHoles = false;
        _present.clear();
        const polys = [];
        const feats = (json && json.features) || [];
        for (const f of feats) {
          for (const p of _ingestFeature(f)) {
            polys.push(p);
            _present.add(p.categoria);
          }
        }
        // Orden por categoría → minimiza cambios de fillStyle en draw().
        polys.sort((a, b) => (a.categoria < b.categoria ? -1 : a.categoria > b.categoria ? 1 : 0));
        _polys = polys;
        if (_hadHoles) {
          console.info("[inundacionOverlay] geojson contiene holes; se ignoran");
        }
        console.info(`[inundacionOverlay] cargados ${polys.length} polígonos (${[..._present].join(", ")})`);
        return _polys;
      })
      .catch(err => {
        console.warn("[inundacionOverlay] no se pudo cargar:", err);
        _polys = null;
        _loadingPromise = null;
        return null;
      });
    return _loadingPromise;
  },

  isReady: () => _polys !== null,

  // Render por nivel: municipio · distrito · barrio · sección.
  // En `isla` y `manzana` no pintamos (justificación en cabecera).
  // La leyenda se muestra/oculta dependiendo de si efectivamente
  // estamos pintando algo en este frame (no sólo del toggle).
  draw: (ctx, state, view) => {
    if (!_polys || !_polys.length) {
      _hideLegend();
      return;
    }
    if (!state || !view) return;
    const lvl = state.lodLevel;
    const ok = (lvl === "municipio" || lvl === "distrito" ||
                lvl === "barrio"    || lvl === "seccion");
    if (!ok) {
      _hideLegend();
      return;
    }
    const bbox = _levelBbox(state);
    ctx.save();
    _drawPolys(ctx, view, bbox);
    ctx.restore();
    _showLegend();
  },
};
