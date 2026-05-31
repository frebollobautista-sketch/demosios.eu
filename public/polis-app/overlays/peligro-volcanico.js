// Overlay "Peligrosidad volcánica" (RIE-02) — visor OCRE/POLIS.
//
// Tres capas en uno:
//
//   1. Zonas PEVOLCA — polígonos translúcidos rojos en 5 tonos según
//      el nivel de peligrosidad (1 = más alto, 5 = más bajo). Se pintan
//      DEBAJO de coladas y conos.
//   2. Coladas históricas — polígonos marrón-rojizo (basalto envejecido
//      con tintes rojos del óxido de hierro). Se pintan SOBRE las
//      zonas PEVOLCA.
//   3. Conos volcánicos — pins triángulo. Los HISTÓRICOS (erupciones
//      1430-2021) en rojo brillante con badge del año. Los demás en
//      tono ladrillo apagado. Cluster por proximidad.
//
// Fuentes: PEVOLCA Decreto 73/2020 GobCan + OSM (conos/coladas) +
// catálogo erupciones históricas + Becerril 2014 / Sobradelo & Martí
// 2015 para la zonificación científica.
//
// Datos: `data/peligro-volcanico-canarias.geojson` — generado por
//   `scripts/extract-peligro-volcanico.py` (485 features · 300 KB).
//
// Render: niveles `isla`, `municipio`, `distrito`, `barrio`, `seccion`.
//   - En `isla` se ven zonas PEVOLCA + conos históricos como hitos.
//   - En `municipio/distrito/barrio/seccion` se filtran por bbox del
//     nivel: vemos el detalle local (qué nivel PEVOLCA cubre el barrio,
//     qué coladas atraviesan la sección, qué conos están dentro).
//
// API sub-chips estándar — el panel de capas puede filtrar por nivel
// PEVOLCA 1..5 (getSubcatOptions / setSubcatFilter).

import { project, lnglatToLocalMeters } from "../iso.js";

const DATA_URL  = "../data/peligro-volcanico-canarias.geojson";
const GC_ANCHOR = [-15.55, 28.05];

// =============================================================================
// Paleta
// =============================================================================
//
// 5 tonos de rojo PEVOLCA — del más saturado (N1) al más palido (N5).
// Alpha bajo para que el render isométrico de base siga legible.
const NIVEL_STYLE = {
  1: { fill: "rgba(178, 28, 28, 0.34)",  stroke: "rgba(178, 28, 28, 0.75)",
       label: "Nivel 1 — Muy alta" },
  2: { fill: "rgba(205, 65, 45, 0.28)",  stroke: "rgba(205, 65, 45, 0.70)",
       label: "Nivel 2 — Alta" },
  3: { fill: "rgba(218,108, 60, 0.24)",  stroke: "rgba(218,108, 60, 0.65)",
       label: "Nivel 3 — Media" },
  4: { fill: "rgba(225,150, 80, 0.20)",  stroke: "rgba(225,150, 80, 0.55)",
       label: "Nivel 4 — Moderada" },
  5: { fill: "rgba(225,185,120, 0.18)",  stroke: "rgba(225,185,120, 0.50)",
       label: "Nivel 5 — Baja" },
};

// Coladas — marrón-rojizo (basalto envejecido con tintes de óxido).
// Las coladas históricas con año (Tajogaite 2021, Chinyero 1909,
// Teneguía 1971, Timanfaya 1730) se pintan algo más saturadas.
const COLADA_STYLE_HIST = {
  fill: "rgba(120, 50, 30, 0.42)",
  stroke: "rgba(120, 50, 30, 0.80)",
};
const COLADA_STYLE_PRE  = {
  fill: "rgba(140, 80, 55, 0.30)",
  stroke: "rgba(140, 80, 55, 0.60)",
};

// Conos — pins triángulo rojo. Histórico vs prehistórico distinto.
const CONO_HIST = { fill: "#C9311F", stroke: "#3A1810" };  // rojo brillante
const CONO_PRE  = { fill: "#9A6450", stroke: "#3A1810" };  // ladrillo apagado
const PIN_R     = 8;
const POLE_H    = 9;
const CLUSTER_PX = 22;

const STROKE_WIDTH_POLY = 0.6;

// =============================================================================
// Estado del overlay
// =============================================================================

// _zonas: polígonos PEVOLCA pre-proyectados. {ring, bbox, nivel, nombre, isla, comentario}
// _coladas: polígonos colada pre-proyectados. {ring, bbox, nombre, anio, isla}
// _conos: pins pre-proyectados.  {mx, mz, nombre, isla, historica, anio}
let _zonas = null;
let _coladas = null;
let _conos = null;
let _loadingPromise = null;

// Filtro sub-chips por nivel PEVOLCA (1..5). null = todos.
let _nivelFilter = null;

// Categorías efectivamente presentes — para construir leyenda con
// sólo lo que está en el dataset (puede que un nivel no aparezca).
const _nivelesPresent = new Set();

// =============================================================================
// Helpers de geometría (idéntico patrón a inundacion.js / cobertura.js)
// =============================================================================

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

function _bboxIntersects(a, b) {
  if (!a || !b) return true;
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
}

function _inBbox(mx, mz, bbox) {
  if (!bbox) return true;
  const [a, b, c, d] = bbox;
  return mx >= a && mx <= c && mz >= b && mz <= d;
}

function _levelBbox(state) {
  if (!state) return null;
  const lvl = state.lodLevel;
  if (lvl === "isla")      return state.isla       && state.isla.bbox;
  if (lvl === "municipio") return state.municipio  && state.municipio.bbox;
  if (lvl === "distrito")  return state.district   && state.district.bbox;
  if (lvl === "barrio")    return state.barrio     && state.barrio.bbox;
  if (lvl === "vecindario")return state.vecindario && state.vecindario.bbox;
  if (lvl === "seccion") {
    return (state.section && state.section.bbox) ||
           (state.section && state.section._bbox)  || null;
  }
  return null;
}

// =============================================================================
// Load
// =============================================================================

function _ingestPolygon(geometry) {
  // Devuelve lista de anillos exteriores proyectados. Holes ignorados
  // (mismo criterio que inundacion/cobertura — alpha bajo lee mejor).
  const out = [];
  if (!geometry) return out;
  if (geometry.type === "Polygon") {
    if (geometry.coordinates && geometry.coordinates[0]) {
      const ring = _projectRing(geometry.coordinates[0]);
      out.push({ ring, bbox: _ringBbox(ring) });
    }
  } else if (geometry.type === "MultiPolygon") {
    for (const poly of geometry.coordinates || []) {
      if (!poly || !poly[0]) continue;
      const ring = _projectRing(poly[0]);
      out.push({ ring, bbox: _ringBbox(ring) });
    }
  }
  return out;
}

async function _load() {
  if (_zonas && _coladas && _conos) {
    return { zonas: _zonas, coladas: _coladas, conos: _conos };
  }
  if (_loadingPromise) return _loadingPromise;
  _loadingPromise = fetch(DATA_URL)
    .then(r => {
      if (!r.ok) throw new Error("peligro-volcanico fetch " + r.status);
      return r.json();
    })
    .then(json => {
      _zonas = [];
      _coladas = [];
      _conos = [];
      _nivelesPresent.clear();
      const feats = (json && json.features) || [];
      for (const f of feats) {
        const props = f.properties || {};
        const tipo = props.tipo;
        if (tipo === "zona_pevolca") {
          for (const ring of _ingestPolygon(f.geometry)) {
            _zonas.push({
              ring: ring.ring, bbox: ring.bbox,
              nivel: Number(props.nivel) || 5,
              nombre: props.nombre,
              isla: props.isla,
              comentario: props.comentario,
            });
            _nivelesPresent.add(Number(props.nivel) || 5);
          }
        } else if (tipo === "colada") {
          for (const ring of _ingestPolygon(f.geometry)) {
            _coladas.push({
              ring: ring.ring, bbox: ring.bbox,
              nombre: props.nombre,
              anio: props.erupcion_anio,
              isla: props.isla,
            });
          }
        } else if (tipo === "cono") {
          if (!f.geometry || f.geometry.type !== "Point") continue;
          const [lng, lat] = f.geometry.coordinates;
          const [mx, mz] = lnglatToLocalMeters(lng, lat, GC_ANCHOR);
          _conos.push({
            mx, mz,
            nombre: props.nombre,
            isla: props.isla,
            historica: !!props.historica,
            anio: props.erupcion_anio,
            ele: props.ele,
          });
        }
      }
      // Ordenar zonas por nivel ASC (N1 último → se pinta encima del resto).
      // En realidad pintamos ASC visualmente: N5 primero (debajo), N1
      // último (encima) para que las áreas críticas dominen visualmente.
      _zonas.sort((a, b) => a.nivel === b.nivel ? 0 : (a.nivel < b.nivel ? 1 : -1));
      // Coladas históricas primero → quedan debajo (luego se pintan las
      // prehistóricas encima — invertimos el orden de relleno tras debug).
      // Realmente preferimos histórico SOBRE prehistórico: si una histórica
      // solapa una vieja, queremos ver la nueva.
      _coladas.sort((a, b) => {
        const ah = a.anio ? 1 : 0;
        const bh = b.anio ? 1 : 0;
        return ah - bh;  // sin anio primero → histórica encima
      });
      console.info(
        `[peligroVolcanicoOverlay] cargado: ${_zonas.length} zonas PEVOLCA, ` +
        `${_coladas.length} coladas, ${_conos.length} conos ` +
        `(${_conos.filter(c => c.historica).length} históricos)`
      );
      return { zonas: _zonas, coladas: _coladas, conos: _conos };
    })
    .catch(err => {
      console.warn("[peligroVolcanicoOverlay] no se pudo cargar:", err);
      _zonas = null; _coladas = null; _conos = null;
      _loadingPromise = null;
      return null;
    });
  return _loadingPromise;
}

// =============================================================================
// Drawers
// =============================================================================

function _drawPolyRing(ctx, ring, view, fill, stroke) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
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

function _drawZonas(ctx, view, levelBbox) {
  if (!_zonas || !_zonas.length) return;
  ctx.lineWidth = STROKE_WIDTH_POLY;
  for (let i = 0; i < _zonas.length; i++) {
    const z = _zonas[i];
    if (_nivelFilter && !_nivelFilter.has(z.nivel)) continue;
    if (!_bboxIntersects(z.bbox, levelBbox)) continue;
    if (z.ring.length < 3) continue;
    const style = NIVEL_STYLE[z.nivel] || NIVEL_STYLE[5];
    _drawPolyRing(ctx, z.ring, view, style.fill, style.stroke);
  }
}

function _drawColadas(ctx, view, levelBbox) {
  if (!_coladas || !_coladas.length) return;
  ctx.lineWidth = STROKE_WIDTH_POLY;
  for (let i = 0; i < _coladas.length; i++) {
    const c = _coladas[i];
    if (!_bboxIntersects(c.bbox, levelBbox)) continue;
    if (c.ring.length < 3) continue;
    const style = c.anio ? COLADA_STYLE_HIST : COLADA_STYLE_PRE;
    _drawPolyRing(ctx, c.ring, view, style.fill, style.stroke);
  }
}

// Pin triángulo rojo apuntando hacia arriba (cono volcánico estilizado).
function _drawConoPin(ctx, px, py, cono, count) {
  const style = cono.historica ? CONO_HIST : CONO_PRE;
  // Asta
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px, py - POLE_H);
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  // Triángulo (cono)
  const cy = py - POLE_H - PIN_R * 0.7;
  const r  = PIN_R;
  ctx.beginPath();
  ctx.moveTo(px, cy - r);
  ctx.lineTo(px + r * 0.95, cy + r * 0.75);
  ctx.lineTo(px - r * 0.95, cy + r * 0.75);
  ctx.closePath();
  ctx.fillStyle = style.fill;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = style.stroke;
  ctx.stroke();
  // Cluster count o badge de año
  if (count > 1) {
    ctx.fillStyle = "#FFF6E6";
    ctx.font = "bold 9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(count), px, cy + 1);
  } else if (cono.historica && cono.anio) {
    // Badge año debajo del triángulo
    const txt = String(cono.anio);
    ctx.font = "bold 9px Georgia, serif";
    const tw = ctx.measureText(txt).width + 6;
    const by = cy + r * 0.75 + 7;
    ctx.beginPath();
    ctx.rect(px - tw/2, by - 6, tw, 11);
    ctx.fillStyle = "#3A1810";
    ctx.fill();
    ctx.fillStyle = "#FFE6C0";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(txt, px, by);
  }
  // Ancla
  ctx.beginPath();
  ctx.arc(px, py, 1.8, 0, Math.PI * 2);
  ctx.fillStyle = style.stroke;
  ctx.fill();
}

function _drawConos(ctx, state, view, levelBbox) {
  if (!_conos || !_conos.length) return;
  const lvl = state && state.lodLevel;
  const islaLike = (lvl === "isla");

  const projected = [];
  for (const c of _conos) {
    if (!_inBbox(c.mx, c.mz, levelBbox)) continue;
    // En isla sólo conos históricos (no saturar con 400 prehistóricos).
    if (islaLike && !c.historica) continue;
    const [px, py] = project(c.mx, 0, c.mz, view);
    projected.push({ cono: c, px, py });
  }
  if (!projected.length) return;

  // Cluster por proximidad de pantalla (idéntico patrón a memoria/bic).
  const clusters = [];
  const claimed = new Uint8Array(projected.length);
  for (let i = 0; i < projected.length; i++) {
    if (claimed[i]) continue;
    const c = {
      px: projected[i].px, py: projected[i].py,
      items: [projected[i].cono],
      hasHist: projected[i].cono.historica,
    };
    claimed[i] = 1;
    for (let j = i + 1; j < projected.length; j++) {
      if (claimed[j]) continue;
      const dx = projected[j].px - c.px;
      const dy = projected[j].py - c.py;
      if (dx*dx + dy*dy <= CLUSTER_PX*CLUSTER_PX) {
        c.items.push(projected[j].cono);
        if (projected[j].cono.historica) c.hasHist = true;
        claimed[j] = 1;
      }
    }
    clusters.push(c);
  }

  ctx.save();
  for (const cl of clusters) {
    // Representante visual: si el cluster contiene un histórico,
    // mostrarlo como histórico (estilo brillante + badge).
    const rep = cl.items.find(x => x.historica) || cl.items[0];
    _drawConoPin(ctx, cl.px, cl.py, rep, cl.items.length);
  }
  ctx.restore();
}

// =============================================================================
// Leyenda flotante (mismo patrón inyectado on-demand que inundacion.js)
// =============================================================================

const LEGEND_ID = "peligro-volcanico-legend";

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
    maxWidth: "260px",
  });
  document.body.appendChild(el);
  return el;
}

function _renderLegend() {
  const el = _ensureLegendNode();
  const rows = [];
  rows.push(`<div style="font-weight:600;margin-bottom:3px">Peligrosidad volcánica (PEVOLCA)</div>`);
  for (let n = 1; n <= 5; n++) {
    if (!_nivelesPresent.has(n)) continue;
    if (_nivelFilter && !_nivelFilter.has(n)) continue;
    const s = NIVEL_STYLE[n];
    rows.push(
      `<div style="display:flex;align-items:center;gap:6px;margin:1px 0">` +
        `<span style="display:inline-block;width:14px;height:10px;` +
              `background:${s.fill};border:1px solid ${s.stroke}"></span>` +
        `<span>${s.label}</span>` +
      `</div>`
    );
  }
  // Coladas
  rows.push(
    `<div style="display:flex;align-items:center;gap:6px;margin:3px 0 1px">` +
      `<span style="display:inline-block;width:14px;height:10px;` +
            `background:${COLADA_STYLE_HIST.fill};border:1px solid ${COLADA_STYLE_HIST.stroke}"></span>` +
      `<span>Colada histórica</span>` +
    `</div>`,
    `<div style="display:flex;align-items:center;gap:6px;margin:1px 0">` +
      `<span style="display:inline-block;width:14px;height:10px;` +
            `background:${COLADA_STYLE_PRE.fill};border:1px solid ${COLADA_STYLE_PRE.stroke}"></span>` +
      `<span>Malpaís/colada prehistórica</span>` +
    `</div>`
  );
  // Conos
  rows.push(
    `<div style="display:flex;align-items:center;gap:6px;margin:3px 0 1px">` +
      `<span style="display:inline-block;width:0;height:0;` +
            `border-left:6px solid transparent;border-right:6px solid transparent;` +
            `border-bottom:9px solid ${CONO_HIST.fill}"></span>` +
      `<span>Erupción histórica (con año)</span>` +
    `</div>`,
    `<div style="display:flex;align-items:center;gap:6px;margin:1px 0">` +
      `<span style="display:inline-block;width:0;height:0;` +
            `border-left:6px solid transparent;border-right:6px solid transparent;` +
            `border-bottom:9px solid ${CONO_PRE.fill}"></span>` +
      `<span>Cono prehistórico</span>` +
    `</div>`
  );
  rows.push(`<div style="font-size:10px;opacity:0.7;margin-top:3px">PEVOLCA · OSM · catálogo histórico</div>`);
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

// =============================================================================
// Export
// =============================================================================

export const peligroVolcanicoOverlay = {
  id: "peligro-volcanico",
  name: "Peligrosidad volcánica",

  load: _load,
  isReady: () => Array.isArray(_zonas) && Array.isArray(_coladas) && Array.isArray(_conos),

  // Render por nivel: isla, municipio, distrito, barrio, sección. En
  // niveles más altos (archipiélago) las zonas PEVOLCA cubren toda
  // la isla y pierden definición; a nivel manzana los pins se vuelven
  // ruidosos. La leyenda sólo se muestra si efectivamente pintamos.
  draw: (ctx, state, view) => {
    if (!_zonas || !_coladas || !_conos) { _hideLegend(); return; }
    if (!state || !view) return;
    const lvl = state.lodLevel;
    const ok = (lvl === "isla" || lvl === "municipio" || lvl === "distrito" ||
                lvl === "barrio" || lvl === "vecindario" || lvl === "seccion");
    if (!ok) { _hideLegend(); return; }

    const bbox = _levelBbox(state);
    ctx.save();
    _drawZonas(ctx, view, bbox);
    _drawColadas(ctx, view, bbox);
    _drawConos(ctx, state, view, bbox);
    ctx.restore();
    _showLegend();
  },

  // ---- Sub-chips por nivel PEVOLCA ----
  getSubcatOptions: () => [
    { key: "1", label: NIVEL_STYLE[1].label, fill: NIVEL_STYLE[1].fill },
    { key: "2", label: NIVEL_STYLE[2].label, fill: NIVEL_STYLE[2].fill },
    { key: "3", label: NIVEL_STYLE[3].label, fill: NIVEL_STYLE[3].fill },
    { key: "4", label: NIVEL_STYLE[4].label, fill: NIVEL_STYLE[4].fill },
    { key: "5", label: NIVEL_STYLE[5].label, fill: NIVEL_STYLE[5].fill },
  ],
  setSubcatFilter: (niveles) => {
    if (!niveles || (niveles.size !== undefined && niveles.size === 0)) {
      _nivelFilter = null;
    } else {
      const arr = niveles instanceof Set ? Array.from(niveles) : niveles;
      _nivelFilter = new Set(arr.map(x => Number(x)).filter(x => x >= 1 && x <= 5));
      if (!_nivelFilter.size) _nivelFilter = null;
    }
  },

  // ---- Acceso read-only para inspección / hit-test externo ----
  getAllConos: () => (_conos ? _conos.slice() : []),
  getAllColadas: () => (_coladas ? _coladas.slice() : []),
  getAllZonas: () => (_zonas ? _zonas.slice() : []),
};
