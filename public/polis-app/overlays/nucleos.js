// Overlay "Núcleos de población" — nivel intermedio entre municipio y
// sección. Pinta tiles Voronoi nombrados (`nombre`, `place_type`,
// `centroide`) dentro del municipio activo. Permite reconocer las
// zonas rurales/urbanas con su nombre propio (Cuevas del Pinar, Costa
// Calma, San Mateo, Vegueta…) en vez de un zoom amorfo.
//
// Datos: public/data/nucleos-{isla}.geojson  (generado por
// scripts/exportar-nucleos.mjs desde la tabla `nucleos` en Supabase,
// con tiles Voronoi recortados por ST_Intersection con el municipio).
//
// Render: SOLO a lodLevel === "municipio" (el nivel donde aportan).
// En isla son demasiado pequeños; en sección/manzana ya estás dentro.

import { project, lnglatToLocalMeters } from "../iso.js";

const GC_ANCHOR = [-15.55, 28.05];

// Cache por isla: { isla → [{ mun_cod, nombre, place_type, rings, _centroidM, poblacion }] }
const _byIsla = new Map();
let _loadingIsla = null;

// Paleta. Sin fill (no compite con el render base); borde terracota
// claro como separador; las etiquetas dan la identidad.
const TILE_STROKE = "rgba(160, 82, 45, 0.55)";
const LABEL_INK   = "#3D2317";
const LABEL_HALO  = "rgba(245, 232, 200, 0.94)";

// Jerarquía LOD: tiles grandes (>= 80 px en pantalla) muestran TODOS los
// nombres. Tamaños intermedios muestran sólo los tipos jerárquicamente
// "altos" (town > village > suburb > neighbourhood). Hamlet/locality solo
// con zoom suficiente. Evita la marea de 100+ etiquetas pisándose.
const TYPE_PRIORITY = {
  town: 0, village: 1, suburb: 2, neighbourhood: 3, hamlet: 4, locality: 5, quarter: 5
};
function _fontFor(placeType, sizePx) {
  const base = { town:15, village:14, suburb:13, neighbourhood:13, hamlet:12, locality:12, quarter:12 }[placeType] || 12;
  // Ligero escalado por tamaño en pantalla: tiles grandes → fuente un punto mayor.
  return sizePx > 200 ? base + 1 : sizePx > 120 ? base : base - 1;
}
function _shouldLabel(placeType, sizePx) {
  const pr = TYPE_PRIORITY[placeType] ?? 5;
  if (sizePx >= 80) return true;          // tile grande: todos
  if (sizePx >= 50 && pr <= 3) return true; // tile medio: solo top
  if (sizePx >= 30 && pr <= 1) return true; // tile pequeño: solo town/village
  return false;
}

function _ringsFromGeom(geom) {
  // Devuelve un array de rings (cada ring = [[lng,lat],...]) ya
  // proyectados a metros locales con GC_ANCHOR para que el render
  // comparta sistema con secciones/municipios.
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
  // El export trae `props.centroide` como Point lng/lat — más fiable
  // que la media simple del polígono.
  const c = props && props.centroide;
  if (c && c.coordinates) {
    const [lng, lat] = c.coordinates;
    return lnglatToLocalMeters(lng, lat, GC_ANCHOR);
  }
  if (fallbackRings && fallbackRings[0]) {
    const ring = fallbackRings[0];
    let sx = 0, sz = 0;
    for (const [x, z] of ring) { sx += x; sz += z; }
    return [sx / ring.length, sz / ring.length];
  }
  return [0, 0];
}

async function _loadIsla(islaId) {
  if (_byIsla.has(islaId)) return _byIsla.get(islaId);
  if (_loadingIsla === islaId) {
    // ya en curso; espera al próximo frame
    return new Promise(res => setTimeout(() => res(_loadIsla(islaId)), 100));
  }
  _loadingIsla = islaId;
  try {
    const r = await fetch(`../data/nucleos-${islaId}.geojson`, { cache: "no-cache" });
    if (!r.ok) throw new Error("status " + r.status);
    const fc = await r.json();
    const items = [];
    for (const f of (fc.features || [])) {
      const rings = _ringsFromGeom(f.geometry);
      if (!rings.length) continue;
      const p = f.properties || {};
      items.push({
        mun_cod: p.mun_cod,
        nombre:  p.nombre || "?",
        place_type: p.place_type || "locality",
        poblacion: p.poblacion || null,
        supra_region_id: p.supra_region_id || null,
        rings,
        _centroidM: _centroidM(p, rings)
      });
    }
    _byIsla.set(islaId, items);
    return items;
  } catch (e) {
    console.warn(`[nucleosOverlay] load fallo isla=${islaId}:`, e);
    _byIsla.set(islaId, []);
    return [];
  } finally {
    _loadingIsla = null;
  }
}

function _fillRing(ctx, ringPx) {
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
  ctx.lineWidth = Math.max(2, font * 0.22);
  ctx.lineJoin = "round";
  ctx.strokeStyle = LABEL_HALO;
  ctx.strokeText(text, px, py);
  ctx.fillStyle = LABEL_INK;
  ctx.fillText(text, px, py);
}

export const nucleosOverlay = {
  id: "nucleos",
  name: "Núcleos",

  load: async (state) => {
    // Lazy por isla activa
    if (state.isla?.id) await _loadIsla(state.isla.id);
    return true;
  },

  // 2026-06-02 — Siempre ready: el dispatcher salta el draw si false,
  // bloqueando la auto-carga lazy. draw() ya gatea internamente.
  isReady: () => true,

  draw: (ctx, state, view) => {
    // 2026-06-02 — Gateado por supra-región activa. El render normal del
    // municipio lo cubre supra-regiones.js (tiles nombradas grandes). Los
    // núcleos individuales solo aparecen cuando el usuario ha entrado a
    // una supra-región concreta (Las Cuevas, Barranco de la Mina, …).
    if (state.lodLevel !== "municipio") return;
    // 2026-06-02 — Defensivo: en muns con barrios canonical (urbanos)
    // nunca debería haber supra activa, pero protegemos por si acaso.
    if (state.municipio?.barriosPiezas?.length > 0) return;
    const activeSupra = state._activeSupraRegionId;
    if (!activeSupra) return;
    const islaId = state.isla?.id;
    const mun3   = state.municipio?.mun;
    if (!islaId || !mun3) return;
    const munCod = state.municipio.cumun
                || ((['gc','lz','fv'].includes(islaId) ? '35' : '38') + mun3);
    let items = _byIsla.get(islaId);
    if (!items) {
      _loadIsla(islaId).then(() => state._requestRender && state._requestRender());
      return;
    }
    items = items.filter(n => n.mun_cod === munCod && n.supra_region_id === activeSupra);
    if (!items.length) return;

    ctx.save();
    ctx.strokeStyle = TILE_STROKE;
    ctx.lineWidth   = 1.4;
    ctx.lineJoin    = "round";
    // 1) Solo bordes — el fill compite con el render base; usamos contorno.
    for (const n of items) {
      for (const ring of n.rings) {
        const ringPx = ring.map(([x, z]) => project(x, 0, z, view));
        if (ringPx.length < 3) continue;
        ctx.beginPath();
        ctx.moveTo(ringPx[0][0], ringPx[0][1]);
        for (let i = 1; i < ringPx.length; i++) ctx.lineTo(ringPx[i][0], ringPx[i][1]);
        ctx.closePath();
        ctx.stroke();
      }
    }
    // 2) Etiquetas con LOD por tamaño + jerarquía place_type.
    for (const n of items) {
      const [pxC, pyC] = project(n._centroidM[0], 0, n._centroidM[1], view);
      let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
      for (const [x, z] of n.rings[0]) {
        const [px, py] = project(x, 0, z, view);
        if (px<minX) minX=px; if (px>maxX) maxX=px;
        if (py<minY) minY=py; if (py>maxY) maxY=py;
      }
      const sz = Math.max(maxX-minX, maxY-minY);
      if (!_shouldLabel(n.place_type, sz)) continue;
      _drawLabel(ctx, n.nombre, [pxC, pyC], _fontFor(n.place_type, sz));
    }
    ctx.restore();
  },

  // Hit-test: devuelve el núcleo cuyo tile contiene el punto, o null.
  // Útil para hookear el tap en handleTap (paso 6 navegación).
  hitTest: (px, py, state, view) => {
    if (state.lodLevel !== "municipio") return null;
    const activeSupra = state._activeSupraRegionId;
    if (!activeSupra) return null;
    const islaId = state.isla?.id;
    const mun3   = state.municipio?.mun;
    if (!islaId || !mun3) return null;
    const munCod = state.municipio.cumun
                || ((['gc','lz','fv'].includes(islaId) ? '35' : '38') + mun3);
    const items = _byIsla.get(islaId);
    if (!items) return null;
    for (const n of items) {
      if (n.mun_cod !== munCod) continue;
      if (n.supra_region_id !== activeSupra) continue;
      for (const ring of n.rings) {
        const ringPx = ring.map(([x, z]) => project(x, 0, z, view));
        if (_pip(px, py, ringPx)) return n;
      }
    }
    return null;
  },

  // 2026-06-02 — API para drillToBarrio (app.js). Dado un punto en world
  // meters (mx, mz) y un mun_cod, devuelve el núcleo cuyo tile Voronoi
  // lo contiene, o null. NO requiere supra activa (a diferencia de
  // hitTest). Usado por el flujo de PIN-drill: el pin tiene coordenada
  // exacta y queremos encuadrar el núcleo que lo aloja.
  findContainingNucleo: (mx, mz, munCod) => {
    for (const items of _byIsla.values()) {
      for (const n of items) {
        if (n.mun_cod !== munCod) continue;
        for (const ring of n.rings) {
          if (_pip(mx, mz, ring)) return n;
        }
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
