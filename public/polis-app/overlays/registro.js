// Overlay "Registro oficial" — Registro de Asociaciones de Canarias
// (25 286 entidades — asociaciones, fundaciones, federaciones). Datos
// raw del registro público, **separados** de tejido-social.geojson
// (curado, ~50 items políticos). Ambas capas conviven, NO se fusionan.
//
// Diferencia clave de UX vs tejido-social y productores:
//   - Volumen masivo (~25k): NO se carga todo de golpe. Lazy-load por
//     isla — el JSON de la isla activa baja la primera vez que se entra
//     a ese contexto. Manifest cuenta los totales por isla sin payload.
//   - A nivel archipielago/isla: pintamos CONTEOS agregados sobre los
//     centroides (de isla o de municipio), no pins individuales. 25k
//     pins serían catastróficos para el render y visualmente ilegibles.
//   - A nivel municipio/distrito/barrio/seccion: pins con clustering
//     screen-space (CLUSTER_PX = 18), filtrados por bbox del contexto.
//
// Estilo visual: marker pequeño tipo "+" en ink semi-transparente para
// que NO compita con productores (banner naranja) ni tejido-social
// (círculo verde). El registro oficial es un dato "ambiental",
// contexto cuantitativo del tejido asociativo formal — los hitos
// curados siguen siendo tejido-social.

import { project, lnglatToLocalMeters } from "../iso.js";

const MANIFEST_URL = "../data/entidades/manifest.json";
const ISLA_URL = (isla) => `../data/entidades/${isla}.json`;
const GC_ANCHOR = [-15.55, 28.05]; // mismo anchor que resto de overlays

// Estilo por tipo. Paleta muted (ink-tinted) para no competir con
// productores (saturados) ni tejido (verdes/azules-tierra).
const TIPO_STYLE = {
  asociacion: { fill: "#5C5651", glyph: "+",  label: "Asociación" },
  fundacion:  { fill: "#7A6B4A", glyph: "Fn", label: "Fundación"  },
  _default:   { fill: "#6B6358", glyph: "·",  label: "Entidad"    }
};

const MARKER_R = 8;
const POLE_H = 8;
const CLUSTER_PX = 18;

// Estado interno.
let _manifest = null;             // { files: { gc: {count,…}, … } }
let _items = [];                  // entidades cargadas (todas las islas activas)
let _loadedIslas = new Set();     // qué islas tienen entidades en _items
let _loadingIslas = new Map();    // isla → Promise<void> en vuelo
let _manifestPromise = null;
let _filter = null;
let _requestRender = null;        // se inyecta desde state cuando llega
let _wantedFromState = true;      // marcador de isReady() (true tras manifest)

function _styleFor(tipo) {
  return TIPO_STYLE[tipo] || TIPO_STYLE._default;
}

function _passes(item) {
  return !_filter || _filter(item);
}

async function _loadManifest() {
  if (_manifest) return _manifest;
  if (_manifestPromise) return _manifestPromise;
  _manifestPromise = fetch(MANIFEST_URL, { cache: "no-cache" })
    .then(r => r.ok ? r.json() : Promise.reject(new Error("status " + r.status)))
    .then(m => { _manifest = m; return m; })
    .catch(err => {
      console.warn("[registroOverlay] manifest fallo:", err);
      _manifestPromise = null;
      return null;
    });
  return _manifestPromise;
}

async function _loadIsla(islaId, state) {
  if (!islaId) return;
  if (_loadedIslas.has(islaId)) return;
  if (_loadingIslas.has(islaId)) return _loadingIslas.get(islaId);

  const p = fetch(ISLA_URL(islaId), { cache: "no-cache" })
    .then(r => r.ok ? r.json() : Promise.reject(new Error("status " + r.status)))
    .then(data => {
      const list = data?.entidades || [];
      for (const e of list) {
        if (typeof e.lat !== "number" || typeof e.lon !== "number") continue;
        const [mx, mz] = lnglatToLocalMeters(e.lon, e.lat, GC_ANCHOR);
        _items.push({
          id: e.id || `reg-${_items.length}`,
          mx, mz,
          isla: islaId,
          properties: { ...e }
        });
      }
      _loadedIslas.add(islaId);
      _loadingIslas.delete(islaId);
      // Pide un re-render al app (si nos lo cablearon vía load(state)).
      if (state?._requestRender) state._requestRender();
      else if (_requestRender) _requestRender();
    })
    .catch(err => {
      console.warn(`[registroOverlay] isla ${islaId} fallo:`, err);
      _loadingIslas.delete(islaId);
    });
  _loadingIslas.set(islaId, p);
  return p;
}

// Pin sobrio — asta corta + cruz dentro de un círculo pequeño. Refleja
// "registro" (sello administrativo). Color muted para no robar foco a
// productores ni tejido-social.
function _drawPin(ctx, px, py, style, count) {
  // Asta corta.
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px, py - POLE_H);
  ctx.strokeStyle = "#1A1612";
  ctx.lineWidth = 1.4;
  ctx.stroke();

  const cy = py - POLE_H - MARKER_R + 2;
  ctx.beginPath();
  ctx.arc(px, cy, MARKER_R, 0, Math.PI * 2);
  ctx.fillStyle = style.fill;
  ctx.globalAlpha = 0.88;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#1A1612";
  ctx.stroke();

  ctx.fillStyle = "#FFFFFF";
  if (count > 1) {
    ctx.font = "bold 8px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`Asoc·${count}`, px, cy);
  } else {
    ctx.font = "bold 10px Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(style.glyph, px, cy);
  }

  // Ancla.
  ctx.beginPath();
  ctx.arc(px, py, 2, 0, Math.PI * 2);
  ctx.fillStyle = "#1A1612";
  ctx.fill();
}

// Badge agregado de conteo (para niveles archipielago / isla). Se
// pinta sobre un centroide ya proyectado en pantalla. No tiene asta —
// es una "etiqueta de territorio", no un pin de POI.
function _drawCountBadge(ctx, px, py, count, label) {
  if (!count) return;
  const text = `${label} · ${count}`;
  ctx.save();
  ctx.font = "bold 11px system-ui, sans-serif";
  const w = ctx.measureText(text).width + 16;
  const h = 20;
  const x = px - w / 2;
  const y = py - h / 2;
  ctx.fillStyle = "rgba(26, 22, 18, 0.86)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#1A1612";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = "#F5EBD3";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, px, py);
  ctx.restore();
}

function _inBbox(mx, mz, bbox) {
  if (!bbox) return true;
  const [a, b, c, d] = bbox;
  return mx >= a && mx <= c && mz >= b && mz <= d;
}

function _countForIsla(islaId) {
  if (!_manifest?.files) return 0;
  return _manifest.files[islaId]?.count || 0;
}

export const registroOverlay = {
  id: "registro-oficial",
  name: "Registro oficial",

  // load() puede llamarse sin argumentos (compat) o con state. Si llega
  // state, intentamos cargar la isla activa. Cuando no hay isla activa,
  // basta con el manifest para pintar conteos agregados a nivel
  // archipielago.
  load: async (state) => {
    if (state?._requestRender) _requestRender = state._requestRender;
    await _loadManifest();
    if (state?.isla?.id) {
      // No bloqueamos: cargamos en background para que el activado
      // sea instantáneo (pintamos conteos de manifest mientras llega).
      _loadIsla(state.isla.id, state);
    }
  },

  // Consideramos "ready" cuando hay manifest. El payload por isla se
  // carga incrementalmente — el draw() es tolerante a falta de _items.
  isReady: () => !!_manifest,

  draw: (ctx, state, view) => {
    if (!_manifest) return;
    if (state?._requestRender && !_requestRender) _requestRender = state._requestRender;

    const lvl = state.lodLevel;

    // ----- A nivel archipiélago: badge sobre cada centroide de isla.
    if (lvl === "archipielago") {
      const islands = state.archipielago?.islands || [];
      ctx.save();
      for (const f of islands) {
        const islaId = f.properties?.isla;
        if (!islaId) continue;
        const count = _countForIsla(islaId);
        if (!count) continue;
        const [cx, , cz] = [f._centroid[0], 0, f._centroid[1]];
        const [px, py] = project(cx, 0, cz, view);
        // Etiqueta corta (nombre isla -> "Asoc"). El conteo ya
        // contextualiza; usamos solo "Asoc" para mantener el badge
        // legible incluso sobre islas pequeñas.
        _drawCountBadge(ctx, px, py - 4, count, "Asoc");
      }
      ctx.restore();
      return;
    }

    // ----- A nivel isla: badge sobre cada municipio (centroide).
    // Distribuimos el total por isla repartiendo equiproporcionalmente
    // si la isla aún no está cargada; si está cargada, usamos cuentas
    // reales por municipio (clave nombre municipio normalizado).
    if (lvl === "isla") {
      const islaId = state.isla?.id;
      const muns = state.isla?.municipios || [];
      // Trigger lazy-load si activa y aún no en flight.
      if (islaId && !_loadedIslas.has(islaId) && !_loadingIslas.has(islaId)) {
        _loadIsla(islaId, state);
      }
      const ready = islaId && _loadedIslas.has(islaId);
      let perMun = null;
      if (ready) {
        perMun = new Map();
        for (const x of _items) {
          if (x.isla !== islaId) continue;
          const m = (x.properties?.municipio || "").toUpperCase();
          perMun.set(m, (perMun.get(m) || 0) + 1);
        }
      }
      ctx.save();
      for (const f of muns) {
        const munName = (f.properties?.name || "").toUpperCase();
        let count;
        if (ready) {
          count = perMun.get(munName) || 0;
        } else {
          // Aún sin payload — repartir manifest count uniformemente.
          const total = _countForIsla(islaId);
          count = muns.length > 0 ? Math.round(total / muns.length) : 0;
        }
        if (!count) continue;
        const c = f._centroid;
        if (!c) continue;
        const [px, py] = project(c[0], 0, c[1], view);
        _drawCountBadge(ctx, px, py - 6, count, "Asoc");
      }
      ctx.restore();
      return;
    }

    // ----- Niveles bajos: pins individuales con clustering.
    // Si todavía no hay payload para la isla activa, dispara load y
    // sale (saldrá un re-render cuando llegue).
    const islaId = state.isla?.id
                || (state.municipio?.isla)
                || null;
    if (islaId && !_loadedIslas.has(islaId)) {
      if (!_loadingIslas.has(islaId)) _loadIsla(islaId, state);
      return;
    }
    if (!_items.length) return;

    let bbox = null;
    if (lvl === "municipio")     bbox = state.municipio?.bbox;
    else if (lvl === "distrito") bbox = state.district?.bbox;
    else if (lvl === "barrio")   bbox = state.barrio?.bbox;
    else if (lvl === "seccion")  bbox = state.section?.bbox || state.section?._bbox || null;

    const projected = [];
    for (const x of _items) {
      if (islaId && x.isla !== islaId) continue;
      if (!_inBbox(x.mx, x.mz, bbox)) continue;
      if (!_passes(x)) continue;
      const [px, py] = project(x.mx, 0, x.mz, view);
      projected.push({ item: x, px, py });
    }
    if (!projected.length) return;

    // Cluster screen-space — CLUSTER_PX más apretado que tejido (los
    // muns tienen muchos pins agrupados en el mismo centroide cuando
    // el geocode es "mun-centroid").
    const clusters = [];
    const claimed = new Uint8Array(projected.length);
    for (let i = 0; i < projected.length; i++) {
      if (claimed[i]) continue;
      const c = { px: projected[i].px, py: projected[i].py,
                  items: [projected[i].item] };
      claimed[i] = 1;
      for (let j = i + 1; j < projected.length; j++) {
        if (claimed[j]) continue;
        const dx = projected[j].px - c.px;
        const dy = projected[j].py - c.py;
        if (dx*dx + dy*dy <= CLUSTER_PX*CLUSTER_PX) {
          c.items.push(projected[j].item);
          claimed[j] = 1;
        }
      }
      clusters.push(c);
    }

    ctx.save();
    for (const c of clusters) {
      const firstTipo = c.items[0].properties?.tipo;
      const allSame = c.items.every(x => x.properties?.tipo === firstTipo);
      const style = allSame ? _styleFor(firstTipo) : _styleFor("_default");
      _drawPin(ctx, c.px, c.py, style, c.items.length);
    }
    ctx.restore();
  },

  hitTest: (px, py, state, view) => {
    const lvl = state.lodLevel;
    // Hit-test sólo en niveles de pin individual.
    if (lvl !== "municipio" && lvl !== "distrito"
        && lvl !== "barrio" && lvl !== "seccion") return null;
    if (!_items.length) return null;
    const islaId = state.isla?.id || null;
    let bbox = null;
    if (lvl === "municipio")     bbox = state.municipio?.bbox;
    else if (lvl === "distrito") bbox = state.district?.bbox;
    else if (lvl === "barrio")   bbox = state.barrio?.bbox;
    else if (lvl === "seccion")  bbox = state.section?.bbox || state.section?._bbox || null;

    let best = null, bestD2 = (MARKER_R + 6) * (MARKER_R + 6);
    for (const x of _items) {
      if (islaId && x.isla !== islaId) continue;
      if (!_inBbox(x.mx, x.mz, bbox)) continue;
      if (!_passes(x)) continue;
      const [epx, epy] = project(x.mx, 0, x.mz, view);
      const cy = epy - POLE_H - MARKER_R + 2;
      const dx = px - epx, dy = py - cy;
      const d2 = dx*dx + dy*dy;
      if (d2 < bestD2) { bestD2 = d2; best = x; }
    }
    return best;
  },

  getAllItems: () => _items.slice(),
  getTipoLabel: (tipo) => _styleFor(tipo).label,

  // Filtro cross-cutting — paridad con productores / tejido-social.
  setFilter: (predicate) => {
    _filter = (typeof predicate === "function") ? predicate : null;
  },
  passesFilter: (item) => _passes(item),

  // Para construir UI de chips (panel ≡ no lo usa hoy, pero es parte
  // del contrato común de overlay).
  getCategoryOptions: () => Object.entries(TIPO_STYLE)
    .filter(([k]) => k !== "_default")
    .map(([key, v]) => ({ key, label: v.label, fill: v.fill })),
  getCategoryOf: (item) => item?.properties?.tipo || null,

  // Helpers públicos de diagnóstico.
  _debug: () => ({
    manifestLoaded: !!_manifest,
    loadedIslas: Array.from(_loadedIslas),
    itemsCount: _items.length
  })
};
