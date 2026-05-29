// Overlay "Eventos culturales" — pins reales sobre el mapa iso para cada
// evento listado en `data/events-cultural.geojson`. Datos extraídos del
// agenda del Cabildo de Gran Canaria (cultura.grancanaria.com/agenda).
//
// Pattern: sigue el contrato establecido por renta.js (id, name, load,
// isReady, draw). Añade un test de hit-test que el handler de tap del
// runtime (app.js · handleTap) puede consultar vía
// `eventosOverlay.hitTest(px, py, state, view)` para abrir el popup
// `#evento-popup` con el detalle del evento.

import { project, lnglatToLocalMeters } from "../iso.js";

const DATA_URL = "../data/events-cultural.geojson";
const GC_ANCHOR = [-15.55, 28.05];

// Paleta por categoría — ink + accent del runtime.
const CATEGORY_COLORS = {
  exposicion:      { fill: "#C89968", border: "#1A1612", label: "Exp." },
  concierto:       { fill: "#9F4FE6", border: "#1A1612", label: "♪" },
  taller:          { fill: "#7CB07C", border: "#1A1612", label: "Tlr" },
  festival:        { fill: "#E68A4F", border: "#1A1612", label: "Fst" },
  presentacion:    { fill: "#3F5F7E", border: "#1A1612", label: "Pres" },
  evento_especial: { fill: "#D9534F", border: "#1A1612", label: "★" },
  _default:        { fill: "#6B6358", border: "#1A1612", label: "·" }
};

const MARKER_R = 8;   // radio del círculo del marker en px pantalla
const POLE_H = 14;    // altura del "asta" sobre el ancla en px pantalla

let _events = null;        // [{ id, mx, mz, properties }]
let _loadingPromise = null;
let _filter = null;        // (item) => boolean. null = todo pasa.

function _categoryStyle(cat) {
  return CATEGORY_COLORS[cat] || CATEGORY_COLORS._default;
}

function _passes(item) {
  return !_filter || _filter(item);
}

async function _load() {
  if (_events) return _events;
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
          id: f.properties?.id || `e-${out.length}`,
          mx, mz,
          properties: { ...f.properties }
        });
      }
      _events = out;
      return _events;
    })
    .catch(err => {
      console.warn("[eventosOverlay] load fallo:", err);
      _events = null;
      _loadingPromise = null;
      return null;
    });
  return _loadingPromise;
}

function _drawPin(ctx, px, py, style, count) {
  // Asta vertical del marker — sale del ancla hacia arriba.
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px, py - POLE_H);
  ctx.strokeStyle = style.border;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Círculo del marker.
  ctx.beginPath();
  ctx.arc(px, py - POLE_H - MARKER_R + 2, MARKER_R, 0, Math.PI * 2);
  ctx.fillStyle = style.fill;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = style.border;
  ctx.stroke();

  // Punto ancla (terminación inferior).
  ctx.beginPath();
  ctx.arc(px, py, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = style.border;
  ctx.fill();

  // Badge con número si hay cluster.
  if (count && count > 1) {
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(count), px, py - POLE_H - MARKER_R + 2);
  }
}

// Cluster simple por proximidad-en-pantalla: si dos pins quedan a menos
// de CLUSTER_PX uno del otro, se fusionan en uno con count = n.
const CLUSTER_PX = 18;

function _inBbox(mx, mz, bbox) {
  if (!bbox) return true;
  const [a, b, c, d] = bbox;
  return mx >= a && mx <= c && mz >= b && mz <= d;
}

export const eventosOverlay = {
  id: "eventos",
  name: "Eventos culturales",

  load: _load,
  isReady: () => Array.isArray(_events),

  // Render por nivel:
  //   - isla:      pins de eventos en todos los muns
  //   - municipio: pins dentro del bbox del mun
  //   - distrito:  pins dentro del bbox del distrito
  //   - seccion:   pins dentro del bbox de la sección
  // En cada nivel hace cluster por proximidad en pantalla (18 px).
  draw: (ctx, state, view) => {
    if (!_events || !_events.length) return;
    let bbox = null;
    if (state.lodLevel === "municipio") bbox = state.municipio?.bbox;
    else if (state.lodLevel === "distrito") bbox = state.district?.bbox;
    else if (state.lodLevel === "barrio") bbox = state.barrio?.bbox;
    else if (state.lodLevel === "manzana") bbox = state.manzana?.bbox_local_m || state.manzana?.bbox;
    else if (state.lodLevel === "seccion") {
      bbox = state.section?.bbox || state.section?._bbox || null;
    }
    // archipielago / isla: bbox=null → muestra todos los eventos (109).

    // Proyectar a pantalla los eventos visibles.
    const projected = [];
    for (const e of _events) {
      if (!_inBbox(e.mx, e.mz, bbox)) continue;
      if (!_passes(e)) continue;
      const [px, py] = project(e.mx, 0, e.mz, view);
      projected.push({ e, px, py });
    }
    if (!projected.length) return;

    // Cluster greedy por proximidad-pantalla.
    const clusters = [];
    const claimed = new Uint8Array(projected.length);
    for (let i = 0; i < projected.length; i++) {
      if (claimed[i]) continue;
      const c = { px: projected[i].px, py: projected[i].py,
                  events: [projected[i].e] };
      claimed[i] = 1;
      for (let j = i + 1; j < projected.length; j++) {
        if (claimed[j]) continue;
        const dx = projected[j].px - c.px;
        const dy = projected[j].py - c.py;
        if (dx*dx + dy*dy <= CLUSTER_PX*CLUSTER_PX) {
          c.events.push(projected[j].e);
          claimed[j] = 1;
        }
      }
      clusters.push(c);
    }

    ctx.save();
    for (const c of clusters) {
      // Categoría del cluster: la del primer evento (si todos comparten),
      // o "_default" si mixed. Visualmente más claro que pin doble.
      const firstCat = c.events[0].properties?.categoria;
      const allSame = c.events.every(e => e.properties?.categoria === firstCat);
      const style = allSame ? _categoryStyle(firstCat) : _categoryStyle("_default");
      _drawPin(ctx, c.px, c.py, style, c.events.length);
    }
    ctx.restore();
  },

  // Hit-test: devuelve el evento (o cluster) más cercano a (px, py)
  // dentro de un radio en pantalla. Usado por handleTap.
  hitTest: (px, py, state, view) => {
    if (!_events || !_events.length) return null;
    let bbox = null;
    if (state.lodLevel === "municipio") bbox = state.municipio?.bbox;
    else if (state.lodLevel === "distrito") bbox = state.district?.bbox;
    else if (state.lodLevel === "barrio") bbox = state.barrio?.bbox;
    else if (state.lodLevel === "manzana") bbox = state.manzana?.bbox_local_m || state.manzana?.bbox;
    else if (state.lodLevel === "seccion") {
      bbox = state.section?.bbox || state.section?._bbox || null;
    }
    // 2026-05-21 — Hit-test extendido. Antes solo cubría el círculo
    // (radio MARKER_R+6 = 14px). El poste de 14px + la base del pin
    // quedaban fuera del área tappable → "el pin a veces no muestra
    // nada". Ahora cubre todo el pin: bounding rect desde el círculo
    // (arriba) hasta la base (abajo) + holgura lateral para dedo móvil.
    const PIN_HIT_W = MARKER_R + 10;     // ±18px horizontal
    const PIN_HIT_TOP = POLE_H + MARKER_R*2 + 6;  // 38px arriba de la base
    const PIN_HIT_BOT = 6;               // 6px debajo de la base
    let best = null, bestD2 = Infinity;
    for (const e of _events) {
      if (!_inBbox(e.mx, e.mz, bbox)) continue;
      if (!_passes(e)) continue;
      const [epx, epy] = project(e.mx, 0, e.mz, view);
      const dx = px - epx;
      const dy = py - epy;
      // Bounding rect del pin: [-PIN_HIT_W, +PIN_HIT_W] x [-PIN_HIT_TOP, +PIN_HIT_BOT]
      if (Math.abs(dx) > PIN_HIT_W) continue;
      if (dy < -PIN_HIT_TOP || dy > PIN_HIT_BOT) continue;
      // Dentro del rect → cusésimo más cerca de la base por d2 simple.
      const d2 = dx*dx + dy*dy;
      if (d2 < bestD2) { bestD2 = d2; best = e; }
    }
    return best;
  },

  // Hit-test de cluster: devuelve todos los eventos del cluster cuyo
  // ancla cae bajo (px, py), siguiendo la misma lógica greedy que draw().
  // - Si el tap impacta un cluster con N>1, devuelve los N eventos.
  // - Si solo hay 1 evento bajo el cursor, devuelve [evento].
  // - Si no hay impacto, devuelve [].
  // Usado por handleTap en app.js para abrir el modal de selección
  // cuando un cluster acumula varios eventos (P5 — 2026-05-21).
  hitTestCluster: (px, py, state, view) => {
    if (!_events || !_events.length) return [];
    let bbox = null;
    if (state.lodLevel === "municipio") bbox = state.municipio?.bbox;
    else if (state.lodLevel === "distrito") bbox = state.district?.bbox;
    else if (state.lodLevel === "barrio") bbox = state.barrio?.bbox;
    else if (state.lodLevel === "manzana") bbox = state.manzana?.bbox_local_m || state.manzana?.bbox;
    else if (state.lodLevel === "seccion") {
      bbox = state.section?.bbox || state.section?._bbox || null;
    }

    // Recrear los mismos clusters que dibuja draw().
    const projected = [];
    for (const e of _events) {
      if (!_inBbox(e.mx, e.mz, bbox)) continue;
      if (!_passes(e)) continue;
      const [epx, epy] = project(e.mx, 0, e.mz, view);
      projected.push({ e, px: epx, py: epy });
    }
    if (!projected.length) return [];

    const clusters = [];
    const claimed = new Uint8Array(projected.length);
    for (let i = 0; i < projected.length; i++) {
      if (claimed[i]) continue;
      const c = { px: projected[i].px, py: projected[i].py,
                  events: [projected[i].e] };
      claimed[i] = 1;
      for (let j = i + 1; j < projected.length; j++) {
        if (claimed[j]) continue;
        const dx = projected[j].px - c.px;
        const dy = projected[j].py - c.py;
        if (dx*dx + dy*dy <= CLUSTER_PX*CLUSTER_PX) {
          c.events.push(projected[j].e);
          claimed[j] = 1;
        }
      }
      clusters.push(c);
    }

    // Mismo bounding rect que hitTest() para mantener coherencia táctil.
    const PIN_HIT_W = MARKER_R + 10;
    const PIN_HIT_TOP = POLE_H + MARKER_R*2 + 6;
    const PIN_HIT_BOT = 6;
    let bestCluster = null, bestD2 = Infinity;
    for (const c of clusters) {
      const dx = px - c.px;
      const dy = py - c.py;
      if (Math.abs(dx) > PIN_HIT_W) continue;
      if (dy < -PIN_HIT_TOP || dy > PIN_HIT_BOT) continue;
      const d2 = dx*dx + dy*dy;
      if (d2 < bestD2) { bestD2 = d2; bestCluster = c; }
    }
    return bestCluster ? bestCluster.events.slice() : [];
  },

  getAllEvents: () => (_events ? _events.slice() : []),

  // Filtro cross-cutting: aplica a draw() y hitTest(). Predicate recibe
  // un item con .properties. Llamar con null para resetear. Los callers
  // que necesiten respetar el filtro al iterar getAllEvents() deben usar
  // passesFilter(item).
  setFilter: (predicate) => { _filter = (typeof predicate === "function") ? predicate : null; },
  passesFilter: (item) => _passes(item),

  // Catálogo de categorías para construir UI de chips.
  getCategoryOptions: () => Object.entries(CATEGORY_COLORS)
    .filter(([k]) => k !== "_default")
    .map(([key, v]) => ({ key, label: _CAT_LABELS[key] || key, fill: v.fill })),
  getCategoryOf: (item) => item?.properties?.categoria || null
};

// Etiquetas legibles para chips (sin "Exp.", "Tlr"… que viven en la paleta).
const _CAT_LABELS = {
  exposicion: "Exposición",
  concierto: "Concierto",
  taller: "Taller",
  festival: "Festival",
  presentacion: "Presentación",
  evento_especial: "Especial"
};
