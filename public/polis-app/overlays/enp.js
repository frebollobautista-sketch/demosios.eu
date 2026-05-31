// Overlay "Espacios Naturales Protegidos + Red Natura 2000" (ESP-01) —
// polígonos translúcidos verde-oliva sobre la Red Canaria de ENP (147
// figuras de la Ley 12/1994 / TR 1/2000) y la Red Natura 2000 (ZEC de
// Decreto 174/2009 + ZEPA terrestres del Decreto 184/2022).
//
// Datos: `data/enp-canarias.geojson` — 369 polígonos en WGS84, ~970 KB.
// Generado por `scripts/extract-enp-canarias.py` desde tres SHP oficiales
// del Gob. Canarias (SITCAN). Ver `docs/PENDIENTE-INTEGRAR-ENP.md`.
//
// API (idéntica al resto de overlays — `inundacionOverlay`, `parquesOverlay`):
//   enpOverlay.id        = "enp"
//   enpOverlay.name      = "Espacios protegidos"
//   enpOverlay.load()    → fetch + cache + preproyección
//   enpOverlay.draw(ctx, state, view)
//   enpOverlay.isReady() → true tras load() OK
//
// Niveles: `isla`, `municipio`, `distrito`, `barrio`, `seccion`. A nivel
// `manzana` los polígonos serían demasiado grandes (cubrirían toda la
// vista — no aporta). A nivel `isla` SÍ aporta: la Red Canaria + Red
// Natura cubren porciones grandes de cada isla (Parque Nacional Teide,
// Caldera Taburiente, Corona Forestal, Tamadaba, Inagua…). Filtramos por
// bbox del nivel para no recorrer el dataset entero.
//
// Paleta — todos verde-oliva con distinta saturación/alpha según jerarquía
// legal. Los Parques Nacionales son los más oscuros/saturados (figura
// máxima); las figuras menores (sitio_interes, monumento_natural) van más
// claras. ZEC/ZEPA llevan verde-azulado para diferenciarlas visualmente
// de la Red Canaria (son redes distintas que se solapan).
//
// Sub-chips por tipo: la UI del cog-modal puede consultar
// `enpOverlay.subtypes` para construir checkboxes individuales. El estado
// se guarda en `enpOverlay.activeSubtypes` (Set). Por defecto todos
// activos. Si el caller no usa sub-chips, simplemente no toca el Set y
// se pintan todos.

import { project, lnglatToLocalMeters } from "../iso.js";

const DATA_URL  = "../data/enp-canarias.geojson";
const GC_ANCHOR = [-15.55, 28.05];

// Paleta verde-oliva. fill alpha entre 0.30 y 0.45 según figura.
// Stroke ligeramente más opaco. Coherente con `parquesOverlay` (forestal
// usa rgba(42,80,24)) pero con tono propio para distinguir ENP de OSM
// nature_reserve / wood.
const STYLES = {
  // Red Canaria de ENP — 8 figuras legales
  parque_nacional: {
    label: "Parque Nacional",
    fill:   "rgba( 60,110, 40, 0.45)",
    stroke: "rgba( 80,140, 56, 0.80)",
  },
  parque_natural: {
    label: "Parque Natural",
    fill:   "rgba( 80,130, 50, 0.38)",
    stroke: "rgba(110,160, 70, 0.75)",
  },
  parque_rural: {
    label: "Parque Rural",
    fill:   "rgba(110,150, 70, 0.32)",
    stroke: "rgba(140,180,100, 0.70)",
  },
  reserva_natural_integral: {
    label: "Reserva Natural Integral",
    fill:   "rgba( 50, 90, 30, 0.45)",
    stroke: "rgba( 80,120, 50, 0.80)",
  },
  reserva_natural_especial: {
    label: "Reserva Natural Especial",
    fill:   "rgba( 70,110, 45, 0.42)",
    stroke: "rgba(100,140, 70, 0.78)",
  },
  monumento_natural: {
    label: "Monumento Natural",
    fill:   "rgba(120,150, 80, 0.35)",
    stroke: "rgba(150,180,110, 0.72)",
  },
  paisaje_protegido: {
    label: "Paisaje Protegido",
    fill:   "rgba(140,170,100, 0.32)",
    stroke: "rgba(170,200,130, 0.70)",
  },
  sitio_interes: {
    label: "Sitio de Interés Científico",
    fill:   "rgba(130,160, 95, 0.30)",
    stroke: "rgba(160,190,125, 0.68)",
  },
  // Red Natura 2000 — verde-azulado para distinguir de Red Canaria
  red_natura_zec: {
    label: "ZEC (Red Natura 2000)",
    fill:   "rgba( 80,150,120, 0.30)",
    stroke: "rgba(110,180,150, 0.70)",
  },
  red_natura_zepa: {
    label: "ZEPA (Red Natura 2000)",
    fill:   "rgba( 90,170,150, 0.32)",
    stroke: "rgba(120,200,180, 0.72)",
  },
};
const DEFAULT_STYLE = STYLES.paisaje_protegido;
const STROKE_WIDTH  = 0.65;

// Orden de pintado: figuras menores primero, mayores encima. Así un
// Parque Nacional se ve nítido aun si se solapa con un Monumento Natural
// dentro (caso real: muchos MN del Teide caen dentro del PN del Teide).
// El array es el orden Z creciente.
const Z_ORDER = [
  "sitio_interes",
  "monumento_natural",
  "paisaje_protegido",
  "red_natura_zec",
  "red_natura_zepa",
  "reserva_natural_especial",
  "reserva_natural_integral",
  "parque_rural",
  "parque_natural",
  "parque_nacional",
];

// Subtipos efectivamente presentes en el dataset (rellenado en load()).
// Sirve para construir sub-chips sólo con lo que hay (la Red Canaria
// no tiene "parque_rural" en El Hierro, p.ej. — no debería ofrecerse
// el chip si no hay datos).
const _present = new Set();

// Cada polígono pre-proyectado: {ring, bbox, tipo, props}. Holes ignorados
// (mismo criterio que cobertura/parques — alpha bajo lee mejor sin huecos).
let _polys = null;
let _hadHoles = false;
let _loadingPromise = null;

// Set de subtipos activos. null → todos activos (default). El caller
// (cog-modal) puede asignar un Set propio para filtrar.
let _activeSubtypes = null;


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
  const tipo = props.tipo || "paisaje_protegido";
  if (g.type === "Polygon") {
    if (g.coordinates && g.coordinates[0]) {
      if (g.coordinates.length > 1) _hadHoles = true;
      const ring = _projectRing(g.coordinates[0]);
      out.push({ ring, bbox: _ringBbox(ring), tipo, props });
    }
  } else if (g.type === "MultiPolygon") {
    for (const poly of g.coordinates || []) {
      if (!poly || !poly[0]) continue;
      if (poly.length > 1) _hadHoles = true;
      const ring = _projectRing(poly[0]);
      out.push({ ring, bbox: _ringBbox(ring), tipo, props });
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
  if (lvl === "isla")      return state.island    && state.island.bbox;
  if (lvl === "municipio") return state.municipio && state.municipio.bbox;
  if (lvl === "distrito")  return state.district  && state.district.bbox;
  if (lvl === "barrio")    return state.barrio    && state.barrio.bbox;
  if (lvl === "seccion")   return state.section   && state.section.bbox;
  return null;
}

function _isSubtypeActive(tipo) {
  if (_activeSubtypes === null) return true;  // sin filtro → todos
  return _activeSubtypes.has(tipo);
}

function _drawPolys(ctx, view, levelBbox) {
  if (!_polys || !_polys.length) return;
  ctx.lineWidth = STROKE_WIDTH;
  let curFill = null;
  let curStroke = null;
  for (let i = 0; i < _polys.length; i++) {
    const poly = _polys[i];
    if (!_isSubtypeActive(poly.tipo)) continue;
    if (!_bboxIntersects(poly.bbox, levelBbox)) continue;
    const ring = poly.ring;
    if (ring.length < 3) continue;
    const style = STYLES[poly.tipo] || DEFAULT_STYLE;
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


export const enpOverlay = {
  id: "enp",
  name: "Espacios protegidos",

  // Catálogo de subtipos disponibles, en orden legal de mayor a menor
  // (parque_nacional primero). Usado por el cog-modal para construir
  // sub-chips. El campo `present` indica si el subtipo tiene polígonos
  // en el dataset cargado — los sub-chips de subtipos vacíos pueden
  // ocultarse o aparecer deshabilitados.
  subtypes: Z_ORDER.slice().reverse().map(t => ({
    id: t,
    label: STYLES[t].label,
    fill: STYLES[t].fill,
    stroke: STYLES[t].stroke,
    get present() { return _present.has(t); },
  })),

  // Set<string> de subtipos activos. null = todos activos (default).
  // El caller puede leer/escribir directamente (p.ej. on click chip):
  //   enpOverlay.activeSubtypes = new Set(["parque_nacional","red_natura_zec"]);
  //   enpOverlay.activeSubtypes = null;  // restaurar "todos"
  get activeSubtypes() { return _activeSubtypes; },
  set activeSubtypes(v) {
    if (v === null || v === undefined) { _activeSubtypes = null; return; }
    if (v instanceof Set) { _activeSubtypes = v; return; }
    if (Array.isArray(v)) { _activeSubtypes = new Set(v); return; }
    _activeSubtypes = null;
  },

  load: async () => {
    if (_polys) return _polys;
    if (_loadingPromise) return _loadingPromise;
    _loadingPromise = fetch(DATA_URL)
      .then(r => {
        if (!r.ok) throw new Error("enp fetch " + r.status);
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
            _present.add(p.tipo);
          }
        }
        // Orden Z creciente: figuras menores primero, mayores encima.
        const zIdx = new Map(Z_ORDER.map((t, i) => [t, i]));
        polys.sort((a, b) => {
          const za = zIdx.has(a.tipo) ? zIdx.get(a.tipo) : -1;
          const zb = zIdx.has(b.tipo) ? zIdx.get(b.tipo) : -1;
          return za - zb;
        });
        _polys = polys;
        if (_hadHoles) {
          console.info("[enpOverlay] geojson contiene holes; se ignoran");
        }
        console.info(
          `[enpOverlay] cargados ${polys.length} polígonos (${[..._present].join(", ")})`
        );
        return _polys;
      })
      .catch(err => {
        console.warn("[enpOverlay] no se pudo cargar:", err);
        _polys = null;
        _loadingPromise = null;
        return null;
      });
    return _loadingPromise;
  },

  isReady: () => _polys !== null,

  // Render por nivel: isla · municipio · distrito · barrio · sección.
  // En `manzana` no pintamos (los polígonos saturarían la vista). En
  // niveles superiores filtramos por bbox del nivel para no recorrer
  // toda Canarias en cada frame.
  draw: (ctx, state, view) => {
    if (!_polys || !_polys.length) return;
    if (!state || !view) return;
    const lvl = state.lodLevel;
    const ok = (lvl === "isla"      || lvl === "municipio" ||
                lvl === "distrito"  || lvl === "barrio"    ||
                lvl === "seccion");
    if (!ok) return;
    const bbox = _levelBbox(state);
    ctx.save();
    _drawPolys(ctx, view, bbox);
    ctx.restore();
  },
};
