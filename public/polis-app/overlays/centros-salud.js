// Overlay "Centros de salud (SAL-01)" — red FÍSICA de equipamientos
// sanitarios en Canarias: centros de Atención Primaria (AP), consultorios
// locales (CSO), hospitales, urgencias y clínicas especializadas.
//
// Indicador SAL-01 del catálogo de datos cívicos. Complementa al overlay
// `lista-espera` (que muestra demora promedio del SCS por municipio):
// aquí ves DÓNDE están físicamente los centros donde se pide cita.
//
// Fuente: OSM PBF Geofabrik canary-islands (extraído por
// scripts/extract-centros-salud.py — el SCS no expone dataset abierto
// accesible). El geojson resultante vive en
// data/centros-salud-canarias.geojson.
//
// Render: pins con glifo de 2 letras estilo Into the Breach (mismo patrón
// visual que productores.js / alimentacion.js / eventos.js para mantener
// coherencia). Cluster por proximidad-pantalla cuando hay solapes.
//
// API mínima (idéntica al resto de overlays):
//   centrosSaludOverlay.id        → "centros-salud"
//   centrosSaludOverlay.name      → "Centros de salud (SAL-01)"
//   centrosSaludOverlay.load()    → fetch + preproyección. Idempotente.
//   centrosSaludOverlay.draw(ctx, state, view)
//   centrosSaludOverlay.isReady() → true tras load() exitoso
//   centrosSaludOverlay.hitTest(px, py, state, view) → feature o null
//
// Sub-chips opcionales por tipo (AP/CSO/HOSP/URG/ESP) vía
// getSubcatOptions() + setSubcatFilter() — se activa desde overlays/index.js
// añadiendo `subcategorias: true` en META.

import { project, lnglatToLocalMeters } from "../iso.js";

const DATA_URL = "../data/centros-salud-canarias.geojson";
const GC_ANCHOR = [-15.55, 28.05];

// Estilo por tipo. Paleta sanitaria (verdes-azules para AP/CSO públicos,
// rojos para hospital/urgencias, morado para especializado). Glifos de
// 2 chars que el brief especifica explícitamente.
const TIPO_STYLE = {
  centro_atencion_primaria: { fill: "#2E8B8B", glyph: "AP", label: "Centro de AP" },
  consultorio_local:        { fill: "#7FB5C8", glyph: "Cs", label: "Consultorio" },
  hospital:                 { fill: "#C24A3A", glyph: "H+", label: "Hospital" },
  urgencias:                { fill: "#8B1A1A", glyph: "Ur", label: "Urgencias" },
  especializado:            { fill: "#8A5CC0", glyph: "Es", label: "Especializado" },
  _default:                 { fill: "#6B6358", glyph: "··", label: "Centro sanitario" }
};

const MARKER_R   = 11;
const POLE_H     = 12;
const CLUSTER_PX = 22;          // brief: cluster por proximidad 22px
const INK        = "#1A1612";
const POINT_SMALL_R = 4;        // a nivel isla: dots, no pins

// Estados de módulo (cache de carga).
let _centros = null;            // [{ mx, mz, properties }]
let _loadingPromise = null;
let _tipoFilter = null;         // Set<tipo> | null
let _publicoFilter = null;      // 'publico'|'privado'|null

function _styleFor(tipo) {
  return TIPO_STYLE[tipo] || TIPO_STYLE._default;
}

function _passes(item) {
  if (_tipoFilter && !_tipoFilter.has(item.properties.tipo)) return false;
  if (_publicoFilter === "publico"  && item.properties.publico !== true)  return false;
  if (_publicoFilter === "privado"  && item.properties.publico !== false) return false;
  return true;
}

function _inBbox(mx, mz, bbox) {
  if (!bbox) return true;
  const [a, b, c, d] = bbox;
  return mx >= a && mx <= c && mz >= b && mz <= d;
}

async function _load() {
  if (_centros) return _centros;
  if (_loadingPromise) return _loadingPromise;
  _loadingPromise = fetch(DATA_URL, { cache: "no-cache" })
    .then(r => r.ok ? r.json() : Promise.reject(new Error("status " + r.status)))
    .then(fc => {
      const out = [];
      for (const f of fc.features || []) {
        if (!f.geometry || f.geometry.type !== "Point") continue;
        const [lng, lat] = f.geometry.coordinates;
        if (typeof lng !== "number" || typeof lat !== "number") continue;
        const [mx, mz] = lnglatToLocalMeters(lng, lat, GC_ANCHOR);
        out.push({
          id: f.properties?.osm_id || `cs-${out.length}`,
          mx, mz,
          properties: { ...f.properties }
        });
      }
      _centros = out;
      return _centros;
    })
    .catch(err => {
      console.warn("[centrosSaludOverlay] load fallo:", err);
      _centros = null;
      _loadingPromise = null;
      return null;
    });
  return _loadingPromise;
}

// ----------------------------------------------------------
// Render helpers

function _drawDot(ctx, px, py, style) {
  // Punto compacto sin asta — usado a nivel isla cuando hay miles.
  ctx.beginPath();
  ctx.arc(px, py, POINT_SMALL_R, 0, Math.PI * 2);
  ctx.fillStyle = style.fill;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

function _drawPin(ctx, px, py, style, count) {
  // Asta vertical.
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px, py - POLE_H);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Banner rectangular con el glifo. Mismo tamaño que productores para
  // que la densidad visual sea comparable cuando ambas capas están
  // activas a la vez.
  const cy = py - POLE_H - MARKER_R + 2;
  const w = MARKER_R * 2;
  const h = MARKER_R * 1.6;
  ctx.beginPath();
  ctx.rect(px - w/2, cy - h/2, w, h);
  ctx.fillStyle = style.fill;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke();

  if (count > 1) {
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${style.glyph}·${count}`, px, cy);
  } else {
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 11px Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(style.glyph, px, cy);
  }

  // Anclaje inferior.
  ctx.beginPath();
  ctx.arc(px, py, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = INK;
  ctx.fill();
}

function _projectVisible(state, view, useBbox) {
  // Devuelve array {p, px, py} de centros visibles + dentro del bbox del
  // nivel actual (si aplica) y que pasan el filtro.
  const projected = [];
  if (!_centros) return projected;
  let bbox = null;
  if (useBbox) {
    if (state.lodLevel === "municipio") bbox = state.municipio?.bbox;
    else if (state.lodLevel === "distrito") bbox = state.district?.bbox;
    else if (state.lodLevel === "barrio") {
      bbox = state.barrio?.bbox || state.barrio?._bbox || null;
    } else if (state.lodLevel === "seccion" || state.lodLevel === "section") {
      bbox = state.section?.bbox || state.section?._bbox || null;
    }
  }
  for (const p of _centros) {
    if (!_inBbox(p.mx, p.mz, bbox)) continue;
    if (!_passes(p)) continue;
    const [px, py] = project(p.mx, 0, p.mz, view);
    projected.push({ p, px, py });
  }
  return projected;
}

function _clusterByScreen(projected) {
  // Cluster greedy O(n²) — el N esperado es ≤724 y a nivel municipio
  // muchísimo menos, así que basta. Mismo patrón que productores.
  const clusters = [];
  const claimed = new Uint8Array(projected.length);
  for (let i = 0; i < projected.length; i++) {
    if (claimed[i]) continue;
    const c = {
      px: projected[i].px,
      py: projected[i].py,
      items: [projected[i].p],
    };
    claimed[i] = 1;
    for (let j = i + 1; j < projected.length; j++) {
      if (claimed[j]) continue;
      const dx = projected[j].px - c.px;
      const dy = projected[j].py - c.py;
      if (dx*dx + dy*dy <= CLUSTER_PX * CLUSTER_PX) {
        c.items.push(projected[j].p);
        claimed[j] = 1;
      }
    }
    clusters.push(c);
  }
  return clusters;
}

// ----------------------------------------------------------
// Overlay exportable

export const centrosSaludOverlay = {
  id: "centros-salud",
  name: "Centros de salud (SAL-01)",

  load: _load,
  isReady: () => Array.isArray(_centros),

  draw: (ctx, state, view) => {
    if (!_centros || !_centros.length) return;
    if (!state || !view) return;
    const lvl = state.lodLevel;

    ctx.save();
    if (lvl === "isla") {
      // A nivel isla NO clusterizamos — pintamos dots para sugerir
      // densidad sin saturar. Filtramos por bbox de la isla (si existe).
      const projected = _projectVisible(state, view, false);
      // Filtro adicional por bbox de la isla si el state lo expone.
      const islaBbox = state.isla?.bbox || state.isla?._bbox || null;
      for (const { p, px, py } of projected) {
        if (!_inBbox(p.mx, p.mz, islaBbox)) continue;
        _drawDot(ctx, px, py, _styleFor(p.properties.tipo));
      }
    } else if (lvl === "municipio" || lvl === "distrito"
               || lvl === "barrio"   || lvl === "seccion" || lvl === "section") {
      const projected = _projectVisible(state, view, true);
      if (!projected.length) { ctx.restore(); return; }
      const clusters = _clusterByScreen(projected);
      for (const c of clusters) {
        const firstTipo = c.items[0].properties.tipo;
        const allSame = c.items.every(x => x.properties.tipo === firstTipo);
        const style = allSame ? _styleFor(firstTipo) : _styleFor("_default");
        _drawPin(ctx, c.px, c.py, style, c.items.length);
      }
    }
    ctx.restore();
  },

  hitTest: (px, py, state, view) => {
    if (!_centros || !_centros.length) return null;
    let bbox = null;
    if (state.lodLevel === "municipio") bbox = state.municipio?.bbox;
    else if (state.lodLevel === "distrito") bbox = state.district?.bbox;
    else if (state.lodLevel === "barrio") {
      bbox = state.barrio?.bbox || state.barrio?._bbox || null;
    } else if (state.lodLevel === "seccion" || state.lodLevel === "section") {
      bbox = state.section?.bbox || state.section?._bbox || null;
    }
    let best = null, bestD2 = (MARKER_R + 6) * (MARKER_R + 6);
    for (const p of _centros) {
      if (!_inBbox(p.mx, p.mz, bbox)) continue;
      if (!_passes(p)) continue;
      const [epx, epy] = project(p.mx, 0, p.mz, view);
      const cy = epy - POLE_H - MARKER_R + 2;
      const dx = px - epx, dy = py - cy;
      const d2 = dx*dx + dy*dy;
      if (d2 < bestD2) { bestD2 = d2; best = p; }
    }
    return best;
  },

  getAll: () => (_centros ? _centros.slice() : []),
  getStyleFor: (tipo) => _styleFor(tipo),

  // Catálogo para sub-chips por tipo (no se renderiza si META no lleva
  // `subcategorias: true` — opt-in desde overlays/index.js).
  getSubcatOptions: () => [
    "centro_atencion_primaria",
    "consultorio_local",
    "hospital",
    "urgencias",
    "especializado",
  ].map(key => ({
    key,
    label: TIPO_STYLE[key].label,
    fill:  TIPO_STYLE[key].fill,
    glyph: TIPO_STYLE[key].glyph,
  })),
  setSubcatFilter: (tipos) => {
    if (!tipos || (tipos.size !== undefined && tipos.size === 0)) {
      _tipoFilter = null;
    } else {
      _tipoFilter = tipos instanceof Set ? tipos : new Set(tipos);
    }
  },

  // Filtro extra público/privado — UI opcional, no hooked todavía.
  setPublicoFilter: (mode) => {
    _publicoFilter = (mode === "publico" || mode === "privado") ? mode : null;
  },
};
