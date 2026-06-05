// Overlay "Supra-regiones" — nivel principal del municipio.
//
// Sustituye al choropleth administrativo (barrios canonical o secciones
// INE) por tiles con NOMBRE REAL DEL TERRITORIO, asignados por cascada
// toponímica → barranco → núcleo cabecera → kmeans. Cada nombre es
// reconocible para el ciudadano (Las Cuevas, Los Lomos, Barranco de la
// Mina, San Mateo y sus pagos...).
//
// Datos: public/data/supra-regiones-{isla}.geojson
// Always-on a lodLevel === "municipio".

import { project, lnglatToLocalMeters } from "../iso.js";

const GC_ANCHOR = [-15.55, 28.05];

const _byIsla = new Map();
let _loadingIsla = null;

// Paleta: fill suave para que se note la subdivisión sin tapar el suelo;
// borde terracota más visible (1.6 px); etiqueta serif grande.
const TILE_FILL   = "rgba(160, 82, 45, 0.10)";
const TILE_STROKE = "rgba(160, 82, 45, 0.60)";
const LABEL_INK   = "#3D2317";
const LABEL_HALO  = "rgba(245, 232, 200, 0.94)";

// Glifo opcional por capa (pequeño, junto al nombre).
const CAPA_GLYPH = {
  toponimia: "",         // sin glifo — nombre topónimo es suficiente
  barranco:  "∽ ",       // ondulación para barrancos
  cabecera:  "⌂ ",       // casa para cabeceras
  kmeans:    "·",
  sub:       "›"
};

function _ringsFromGeom(geom) {
  const out = [];
  const push = (lnglatRing) => {
    out.push(lnglatRing.map(([lng, lat]) => lnglatToLocalMeters(lng, lat, GC_ANCHOR)));
  };
  if (geom.type === "Polygon") {
    for (const r of geom.coordinates) push(r);
  } else if (geom.type === "MultiPolygon") {
    for (const poly of geom.coordinates) for (const r of poly) push(r);
  }
  return out;
}

function _centroidM(props, fallbackRings) {
  const c = props && props.centroide;
  if (c && c.coordinates) {
    const [lng, lat] = c.coordinates;
    return lnglatToLocalMeters(lng, lat, GC_ANCHOR);
  }
  if (fallbackRings && fallbackRings[0]) {
    const ring = fallbackRings[0];
    let sx=0, sz=0;
    for (const [x, z] of ring) { sx += x; sz += z; }
    return [sx/ring.length, sz/ring.length];
  }
  return [0, 0];
}

async function _loadIsla(islaId) {
  if (_byIsla.has(islaId)) return _byIsla.get(islaId);
  if (_loadingIsla === islaId) {
    return new Promise(res => setTimeout(() => res(_loadIsla(islaId)), 100));
  }
  _loadingIsla = islaId;
  try {
    const r = await fetch(`../data/supra-regiones-${islaId}.geojson`, { cache: "no-cache" });
    if (!r.ok) throw new Error("status " + r.status);
    const fc = await r.json();
    const items = [];
    for (const f of (fc.features || [])) {
      const rings = _ringsFromGeom(f.geometry);
      if (!rings.length) continue;
      const p = f.properties || {};
      items.push({
        id: p.id,
        mun_cod: p.mun_cod,
        capa: p.capa,
        nombre: p.nombre || "?",
        parent_id: p.parent_id || null,
        n_nucleos: p.n_nucleos || 0,
        rings,
        _centroidM: _centroidM(p, rings)
      });
    }
    _byIsla.set(islaId, items);
    return items;
  } catch (e) {
    console.warn(`[supraRegionesOverlay] load fallo isla=${islaId}:`, e);
    _byIsla.set(islaId, []);
    return [];
  } finally {
    _loadingIsla = null;
  }
}

function _strokeRing(ctx, ringPx) {
  if (ringPx.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(ringPx[0][0], ringPx[0][1]);
  for (let i = 1; i < ringPx.length; i++) ctx.lineTo(ringPx[i][0], ringPx[i][1]);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function _drawLabel(ctx, text, [px, py], font) {
  ctx.font = `italic 600 ${font}px Georgia, "Times New Roman", serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = Math.max(3, font * 0.28);
  ctx.lineJoin = "round";
  ctx.strokeStyle = LABEL_HALO;
  ctx.strokeText(text, px, py);
  ctx.fillStyle = LABEL_INK;
  ctx.fillText(text, px, py);
}

function _resolveMunCod(state) {
  const islaId = state.isla?.id;
  const mun3 = state.municipio?.mun;
  if (!islaId || !mun3) return null;
  return state.municipio.cumun
      || ((['gc','lz','fv'].includes(islaId) ? '35' : '38') + mun3);
}

export const supraRegionesOverlay = {
  id: "supra-regiones",
  name: "Supra-regiones",

  load: async (state) => {
    if (state.isla?.id) await _loadIsla(state.isla.id);
    return true;
  },
  // 2026-06-02 — Siempre ready: el dispatcher saltaría el draw si fuese
  // false, y la auto-carga lazy del draw nunca dispararía. La función
  // draw() ya hace gating internamente (lod=municipio, isla, mun).
  isReady: () => true,

  draw: (ctx, state, view) => {
    if (state.lodLevel !== "municipio") return;
    // 2026-06-02 — Discriminación urbano/rural: si el mun tiene barrios
    // canonical (Vegueta, Triana, La Isleta…), NO renderizamos
    // supra-regiones. El usuario reclamó que la cascada toponímica era
    // para zonas rurales sin barrios identitarios; en Las Palmas y
    // similares, renderMunicipio() pinta las tiles iso 3D canonical.
    if (state.municipio?.barriosPiezas?.length > 0) return;
    const islaId = state.isla?.id;
    const munCod = _resolveMunCod(state);
    if (!islaId || !munCod) return;
    let items = _byIsla.get(islaId);
    if (!items) {
      _loadIsla(islaId).then(() => state._requestRender && state._requestRender());
      return;
    }
    const activeSupra = state._activeSupraRegionId || null;

    // Filtro: sólo del mun actual. Si hay supra activa, mostramos sus
    // hijos (sub-supra con parent_id = activa) Y la activa misma resaltada.
    items = items.filter(s => s.mun_cod === munCod);
    if (activeSupra) {
      // Tiles a pintar: hijos de la activa (si tiene sub-tessellación) o
      // la activa sola si no tiene hijos.
      const childs = items.filter(s => s.parent_id === activeSupra);
      const itsHer = items.find(s => s.id === activeSupra);
      items = childs.length ? childs : (itsHer ? [itsHer] : []);
    } else {
      // Top-level only
      items = items.filter(s => !s.parent_id);
    }
    if (!items.length) return;

    ctx.save();
    ctx.fillStyle = TILE_FILL;
    ctx.strokeStyle = TILE_STROKE;
    ctx.lineWidth = 1.6;
    ctx.lineJoin = "round";

    // 1) Tiles (fill + stroke)
    for (const s of items) {
      for (const ring of s.rings) {
        const ringPx = ring.map(([x, z]) => project(x, 0, z, view));
        _strokeRing(ctx, ringPx);
      }
    }

    // 2) Etiquetas con tamaño según screen-size del tile
    for (const s of items) {
      const [pxC, pyC] = project(s._centroidM[0], 0, s._centroidM[1], view);
      let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
      for (const [x, z] of s.rings[0]) {
        const [px, py] = project(x, 0, z, view);
        if (px<minX) minX=px; if (px>maxX) maxX=px;
        if (py<minY) minY=py; if (py>maxY) maxY=py;
      }
      const sz = Math.max(maxX-minX, maxY-minY);
      if (sz < 35) continue; // muy pequeño en pantalla
      const font = sz > 200 ? 17 : sz > 100 ? 15 : 13;
      const text = (CAPA_GLYPH[s.capa] || "") + s.nombre;
      _drawLabel(ctx, text, [pxC, pyC], font);
    }
    ctx.restore();
  },

  // Hit-test: devuelve la supra-region tocada (top-level si no hay activa,
  // sub-supra si hay activa con hijos), o null.
  hitTest: (px, py, state, view) => {
    if (state.lodLevel !== "municipio") return null;
    // 2026-06-02 — Idem draw: en muns con barrios canonical no hay
    // hit-test de supra-regiones; el flow tap-a-barrio (app.js ~5711)
    // ya cubre la afordancia con enterBarrio.
    if (state.municipio?.barriosPiezas?.length > 0) return null;
    const islaId = state.isla?.id;
    const munCod = _resolveMunCod(state);
    if (!islaId || !munCod) return null;
    const all = _byIsla.get(islaId);
    if (!all) return null;
    const activeSupra = state._activeSupraRegionId || null;
    let items = all.filter(s => s.mun_cod === munCod);
    items = activeSupra
      ? items.filter(s => s.parent_id === activeSupra)
      : items.filter(s => !s.parent_id);
    for (const s of items) {
      for (const ring of s.rings) {
        const ringPx = ring.map(([x, z]) => project(x, 0, z, view));
        if (_pip(px, py, ringPx)) return s;
      }
    }
    return null;
  }
};

function _pip(px, py, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    const intersect =
      (yi > py) !== (yj > py) &&
      px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
