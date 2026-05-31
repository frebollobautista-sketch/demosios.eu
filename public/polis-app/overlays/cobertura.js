// Overlay "Cobertura bus" — zonas a ≤300m (≈4 min andando) de una
// parada de guaguas en LPGC. Portado del visor canónico MapLibre
// (polis-provincia.html · toggleCoberturaBus) al runtime iso 2D.
//
// API mínima (la misma que `rentaOverlay`):
//   coberturaOverlay.id        → identificador de capa
//   coberturaOverlay.name      → etiqueta human-readable
//   coberturaOverlay.load()    → fetch + cache + preproyección. Idempotente.
//   coberturaOverlay.draw(ctx, state, view) → pinta polígonos cobertura.
//   coberturaOverlay.isReady() → true si load() resolvió.
//
// Datos: `data/guaguas-cobertura.geojson` — FeatureCollection con uno o
// varios features Polygon/MultiPolygon (buffer 300m disuelto del set de
// paradas de guagua LPGC). Aprox. 41,6 km² cubiertos.
//
// Color: del canónico (#5dc88a) con alpha bajo para no saturar el render
// base ocre/sand. Contorno fino del mismo color con alpha algo mayor.
//
// Cobertura sólo existe en LPGC (mun "016"). En niveles isla pintaría
// fuera de contexto, así que se omite. En municipio/distrito/sección
// se filtran polígonos por bbox del nivel para evitar trabajo inútil.

import { project, lnglatToLocalMeters } from "../iso.js";

const DATA_URL = "../data/guaguas-cobertura.geojson";
const GC_ANCHOR = [-15.55, 28.05];

// Mun LPGC en el callejero INE / data pack. Sólo dibujamos cuando el
// usuario está mirando LPGC (o uno de sus distritos/secciones).
const LPGC_MUN = "016";

// Color del canónico (polis-provincia.html L1680, L1688). Alpha bajo
// para legibilidad sobre el render iso.
const FILL_COLOR   = "rgba(93, 200, 138, 0.28)";
const STROKE_COLOR = "rgba(93, 200, 138, 0.55)";
const STROKE_WIDTH = 0.8;

// _polys: array de anillos exteriores ya proyectados a metros locales
// (anchor GC_ANCHOR). Cada elemento: { ring:[[mx,mz],...], bbox:[minX,minZ,maxX,maxZ] }.
// Los holes se descartan deliberadamente: para el uso "ver zonas con
// cobertura" un fill alpha bajo sin huecos lee mejor a esta escala.
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
  // Anillo cerrado GeoJSON [[lng,lat],...] → [[mx,mz],...] en metros
  // locales relativos a GC_ANCHOR. Conserva el cierre (último == primero).
  const out = new Array(lnglatRing.length);
  for (let i = 0; i < lnglatRing.length; i++) {
    const ll = lnglatRing[i];
    out[i] = lnglatToLocalMeters(ll[0], ll[1], GC_ANCHOR);
  }
  return out;
}

function _ingestFeature(feature) {
  // Aplana Polygon / MultiPolygon en una lista de anillos exteriores.
  // Anota si vimos holes para diagnóstico.
  const out = [];
  const g = feature && feature.geometry;
  if (!g) return out;
  if (g.type === "Polygon") {
    if (g.coordinates && g.coordinates[0]) {
      if (g.coordinates.length > 1) _hadHoles = true;
      const ring = _projectRing(g.coordinates[0]);
      out.push({ ring, bbox: _ringBbox(ring) });
    }
  } else if (g.type === "MultiPolygon") {
    for (const poly of g.coordinates || []) {
      if (!poly || !poly[0]) continue;
      if (poly.length > 1) _hadHoles = true;
      const ring = _projectRing(poly[0]);
      out.push({ ring, bbox: _ringBbox(ring) });
    }
  }
  return out;
}

function _bboxIntersects(a, b) {
  // a,b en [minX,minZ,maxX,maxZ] (metros locales). Mismas convenciones
  // que el data pack: x = este, z = sur.
  if (!a || !b) return true; // sin bbox de nivel → no filtramos
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
}

function _drawPolys(ctx, view, levelBbox) {
  if (!_polys || !_polys.length) return;
  ctx.fillStyle = FILL_COLOR;
  ctx.strokeStyle = STROKE_COLOR;
  ctx.lineWidth = STROKE_WIDTH;
  for (let i = 0; i < _polys.length; i++) {
    const poly = _polys[i];
    if (!_bboxIntersects(poly.bbox, levelBbox)) continue;
    const ring = poly.ring;
    if (ring.length < 3) continue;
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

// Detecta si el nivel actual corresponde a LPGC. La forma del state
// sigue el contrato de renta.js (state.municipio, state.district,
// state.section). El código del municipio puede vivir en distintas
// propiedades según el data pack; cubrimos las habituales (cod, code,
// id, cmun, cumun) y verificamos sufijo "016" en el código del
// distrito/sección por si el dato lleva provincia+mun concatenados.
function _isLpgc(state) {
  const lvl = state && state.lodLevel;
  if (lvl === "municipio") {
    const m = state.municipio || {};
    const code = m.cod || m.code || m.id || m.cmun || m.cumun || m.codigo;
    if (typeof code === "string") return code === LPGC_MUN || code.endsWith(LPGC_MUN);
    return false;
  }
  if (lvl === "distrito") {
    const d = state.district || {};
    const muncode = d.mun || d.municipio || d.cmun;
    if (typeof muncode === "string") return muncode === LPGC_MUN || muncode.endsWith(LPGC_MUN);
    // Fallback: el cod de distrito INE suele incluir el mun (p.ej. "35016xx").
    const dcode = d.cod || d.code || d.id || d.codigo;
    if (typeof dcode === "string") return dcode.indexOf(LPGC_MUN) !== -1;
    return false;
  }
  if (lvl === "seccion") {
    const s = state.section || {};
    const muncode = s.mun || s.municipio || s.cmun;
    if (typeof muncode === "string") return muncode === LPGC_MUN || muncode.endsWith(LPGC_MUN);
    const cusec = s.cusec || s.cod || s.code || s.id;
    if (typeof cusec === "string") return cusec.indexOf(LPGC_MUN) !== -1;
    return false;
  }
  return false;
}

function _levelBbox(state) {
  const lvl = state.lodLevel;
  if (lvl === "municipio") return state.municipio && state.municipio.bbox;
  if (lvl === "distrito")  return state.district  && state.district.bbox;
  if (lvl === "seccion")   return state.section   && state.section.bbox;
  return null;
}

export const coberturaOverlay = {
  id: "cobertura",
  name: "Cobertura bus",

  load: async () => {
    if (_polys) return _polys;
    if (_loadingPromise) return _loadingPromise;
    _loadingPromise = fetch(DATA_URL)
      .then(r => {
        if (!r.ok) throw new Error("cobertura fetch " + r.status);
        return r.json();
      })
      .then(json => {
        _hadHoles = false;
        const polys = [];
        const feats = (json && json.features) || [];
        for (const f of feats) {
          for (const p of _ingestFeature(f)) polys.push(p);
        }
        _polys = polys;
        if (_hadHoles) {
          console.info("[coberturaOverlay] geojson contiene holes; se ignoran en este overlay");
        }
        return _polys;
      })
      .catch(err => {
        console.warn("[coberturaOverlay] no se pudo cargar:", err);
        _polys = null;
        _loadingPromise = null;
        return null;
      });
    return _loadingPromise;
  },

  isReady: () => _polys !== null,

  // Render por nivel:
  //  - isla:                 omitido (cobertura sólo LPGC, no aporta a 21 muns).
  //  - municipio (LPGC):     se pintan los polígonos del buffer.
  //  - distrito (LPGC):      idem, filtrados por bbox del distrito.
  //  - sección (LPGC):       idem, filtrados por bbox de la sección.
  //  - cualquier otro mun:   omitido para no pintar zonas LPGC fuera de contexto.
  draw: (ctx, state, view) => {
    if (!_polys || !_polys.length) return;
    if (!state || !view) return;
    const lvl = state.lodLevel;
    if (lvl !== "municipio" && lvl !== "distrito" && lvl !== "seccion") return;
    if (!_isLpgc(state)) return;
    const bbox = _levelBbox(state);
    ctx.save();
    _drawPolys(ctx, view, bbox);
    ctx.restore();
  }
};
