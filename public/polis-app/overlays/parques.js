// Overlay "Espacios verdes" — polígonos OSM agrupados por subtipo
// (jardines/parques, deporte, agrícola, forestal, playas, cementerios).
// Portado del visor canónico MapLibre (polis-provincia.html · togglePq*)
// al runtime iso vanilla 2D.
//
// API mínima (la misma que `rentaOverlay` / `coberturaOverlay`):
//   parquesOverlay.id        → identificador de capa
//   parquesOverlay.name      → etiqueta human-readable
//   parquesOverlay.load()    → fetch + cache + preproyección. Idempotente.
//   parquesOverlay.draw(ctx, state, view) → pinta polígonos espacios verdes.
//   parquesOverlay.isReady() → true si load() resolvió.
//
// Datos: `osm-gc/parks.json` — FeatureCollection (Polygon) con ~12.881
// polígonos OSM. Cada feature lleva `properties.type` (string) con uno de
// los 16 valores OSM: garden, pitch, farmland, scrub, park, playground,
// orchard, beach, sand, vineyard, wood, forest, cemetery, nature_reserve,
// salt_pond, beach_resort. Sin holes en la práctica (los Multi tampoco
// aparecen aquí), pero el código aguanta MultiPolygon por seguridad.
//
// Diseño visual v1: UNA sola capa que pinta TODOS los subtipos coloreados
// según el bucket canónico (urbano, deporte, agrícola, forestal, playa,
// cementerio). Sub-toggles llegarán en una iter posterior. Paleta y
// agrupación copiadas tal cual del canónico (L2294-L2299 de
// polis-provincia.html) para mantener coherencia entre los dos visores.
//
// Nivel: aplicable a `municipio`, `distrito`, `seccion`. En `isla` no
// aporta — los polígonos son demasiado pequeños frente a 21 muns y el
// fill saturaría la lectura del tablero. Filtramos por bbox del nivel.

import { project, lnglatToLocalMeters } from "../iso.js";
import { assetUrl } from "../assets-base.js";

// 2026-05-26 — Multi-isla: osm-gc/parks.json cubre prov 35 (GC+FV+LZ,
// 12.881 features), osm-prov38/parks.json cubre prov 38 (TF/LP/LG/EH,
// 32.242 features). Cargamos ambos y combinamos.
const DATA_URLS = [
  assetUrl("../osm-gc/parks.json"),
  assetUrl("../osm-prov38/parks.json"),
];
const GC_ANCHOR = [-15.55, 28.05];

// Buckets canónicos. `types` mapea valores OSM crudos al bucket.
// `fill` / `stroke` copiados de polis-provincia.html (mismas constantes
// hex). Alpha 0.55 en fill para legibilidad sobre el render iso ocre/sand;
// stroke con alpha algo mayor para perfilar.
const BUCKETS = {
  urbano:     { types: ["garden", "park", "playground"],
                fill: "rgba(74,160, 90,0.55)",  stroke: "rgba(124,200,138,0.8)" },
  deporte:    { types: ["pitch"],
                fill: "rgba(90,196,168,0.55)",  stroke: "rgba(134,218,196,0.8)" },
  agricola:   { types: ["farmland", "orchard", "vineyard"],
                fill: "rgba(196,168,104,0.55)", stroke: "rgba(216,196,144,0.85)" },
  forestal:   { types: ["scrub", "wood", "forest", "nature_reserve"],
                fill: "rgba(42, 80, 24, 0.55)", stroke: "rgba(74,122, 58,0.85)" },
  playa:      { types: ["beach", "sand", "salt_pond", "beach_resort"],
                fill: "rgba(212,200,120,0.55)", stroke: "rgba(230,219,160,0.9)" },
  cementerio: { types: ["cemetery"],
                fill: "rgba(128,120,104,0.55)", stroke: "rgba(156,148,126,0.85)" },
};

// Bucket por defecto si OSM trajera un type no contemplado (defensivo —
// hoy en día los 16 valores conocidos ya están todos cubiertos arriba).
const DEFAULT_BUCKET = {
  fill: "rgba(160,178,124,0.55)", stroke: "rgba(120,138, 92,0.85)"
};

// Construye lookup type → bucketId una sola vez.
const TYPE_TO_BUCKET = (() => {
  const m = new Map();
  for (const id of Object.keys(BUCKETS)) {
    for (const t of BUCKETS[id].types) m.set(t, id);
  }
  return m;
})();

const STROKE_WIDTH = 1;

// _polys: array de polígonos ya preproyectados a metros locales
// (anchor GC_ANCHOR). Cada elemento: { ring:[[mx,mz],...], bbox, bucket }.
// Los holes se descartan deliberadamente (no aparecen en este pack).
// Ordenado por bucket para fill batch (mismo fillStyle seguido).
let _polys = null;
let _hadHoles = false;
let _hadUnknownType = false;
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

function _bucketIdFor(rawType) {
  if (typeof rawType !== "string") return null;
  const b = TYPE_TO_BUCKET.get(rawType);
  if (b) return b;
  _hadUnknownType = true;
  return null;
}

function _ingestFeature(feature) {
  // Aplana Polygon / MultiPolygon en una lista de anillos exteriores.
  // Anota si vimos holes para diagnóstico.
  const out = [];
  const g = feature && feature.geometry;
  if (!g) return out;
  const bucket = _bucketIdFor(feature.properties && feature.properties.type);
  if (g.type === "Polygon") {
    if (g.coordinates && g.coordinates[0]) {
      if (g.coordinates.length > 1) _hadHoles = true;
      const ring = _projectRing(g.coordinates[0]);
      if (ring.length >= 3) out.push({ ring, bbox: _ringBbox(ring), bucket });
    }
  } else if (g.type === "MultiPolygon") {
    for (const poly of g.coordinates || []) {
      if (!poly || !poly[0]) continue;
      if (poly.length > 1) _hadHoles = true;
      const ring = _projectRing(poly[0]);
      if (ring.length >= 3) out.push({ ring, bbox: _ringBbox(ring), bucket });
    }
  }
  return out;
}

function _bboxIntersects(a, b) {
  // a,b en [minX,minZ,maxX,maxZ] (metros locales). Mismas convenciones
  // que el data pack: x = este, z = sur. Si falta el bbox de nivel,
  // no filtramos (pintamos todo — sólo pasaría si state.* viniera mal).
  if (!a || !b) return true;
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
}

function _levelBbox(state) {
  const lvl = state.lodLevel;
  if (lvl === "municipio") return state.municipio && state.municipio.bbox;
  if (lvl === "distrito")  return state.district  && state.district.bbox;
  if (lvl === "seccion")   return state.section   && state.section.bbox;
  return null;
}

// 2026-05-27 — Filtro por bucket (sub-categorías expuestas como chips
// en el panel de capas vía meta.subcategorias=true).
let _bucketFilter = null;  // null = todos, o Set<bucketId>

function _drawPolys(ctx, view, levelBbox) {
  if (!_polys || !_polys.length) return;

  // Dibujamos en dos pases por bucket: primero el fill (batch por color
  // para minimizar cambios de fillStyle), después el stroke. Cada pase
  // recorre la misma lista — el coste es trivial frente al fetch.
  // El array ya viene ordenado por bucket (ver load()), así que dentro
  // de cada color los polígonos van seguidos.
  let curFill = null;
  ctx.lineWidth = STROKE_WIDTH;

  for (let i = 0; i < _polys.length; i++) {
    const poly = _polys[i];
    if (_bucketFilter && !_bucketFilter.has(poly.bucket)) continue;
    if (!_bboxIntersects(poly.bbox, levelBbox)) continue;
    const ring = poly.ring;
    if (ring.length < 3) continue;
    const style = (poly.bucket && BUCKETS[poly.bucket]) || DEFAULT_BUCKET;

    if (style.fill !== curFill) {
      ctx.fillStyle = style.fill;
      curFill = style.fill;
    }
    ctx.strokeStyle = style.stroke;

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

export const parquesOverlay = {
  id: "parques",
  name: "Espacios verdes",

  load: async () => {
    if (_polys) return _polys;
    if (_loadingPromise) return _loadingPromise;
    _loadingPromise = Promise.all(DATA_URLS.map(url =>
      fetch(url)
        .then(r => {
          if (!r.ok) throw new Error(`parques fetch ${url} ${r.status}`);
          return r.json();
        })
        .catch(err => {
          // Tolerante: si falta un archivo (p.ej. osm-prov38 sin generar
          // en algún entorno), seguimos con los demás.
          console.warn(`[parquesOverlay] ${url}: ${err.message}`);
          return { features: [] };
        })
    ))
      .then(jsons => {
        _hadHoles = false;
        _hadUnknownType = false;
        const polys = [];
        for (const json of jsons) {
          const feats = (json && json.features) || [];
          for (const f of feats) {
            for (const p of _ingestFeature(f)) polys.push(p);
          }
        }
        polys.sort((a, b) => {
          const ka = a.bucket || "~";
          const kb = b.bucket || "~";
          return ka < kb ? -1 : ka > kb ? 1 : 0;
        });
        _polys = polys;
        if (_hadHoles) {
          console.info("[parquesOverlay] geojson contiene holes; se ignoran en v1");
        }
        if (_hadUnknownType) {
          console.info("[parquesOverlay] tipos OSM no mapeados; usando paleta por defecto");
        }
        console.info(`[parquesOverlay] cargados ${polys.length} polígonos de ${DATA_URLS.length} fuentes`);
        return _polys;
      })
      .catch(err => {
        console.warn("[parquesOverlay] no se pudo cargar:", err);
        _polys = null;
        _loadingPromise = null;
        return null;
      });
    return _loadingPromise;
  },

  isReady: () => _polys !== null,

  // Render por nivel:
  //  - isla:      omitido (polígonos demasiado pequeños frente a 21 muns).
  //  - municipio: filtramos polys por bbox del mun y los pintamos.
  //  - distrito:  filtramos por bbox del distrito.
  //  - sección:   filtramos por bbox de la sección.
  draw: (ctx, state, view) => {
    if (!_polys || !_polys.length) return;
    if (!state || !view) return;
    const lvl = state.lodLevel;
    if (lvl !== "municipio" && lvl !== "distrito" && lvl !== "seccion") return;
    const bbox = _levelBbox(state);
    ctx.save();
    _drawPolys(ctx, view, bbox);
    ctx.restore();
  },

  // 2026-05-27 — API sub-chips
  setSubcatFilter: (buckets) => {
    if (!buckets || (buckets.size !== undefined && buckets.size === 0)) {
      _bucketFilter = null;
    } else {
      _bucketFilter = buckets instanceof Set ? buckets : new Set(buckets);
    }
  },
  getSubcatFilter: () => _bucketFilter ? Array.from(_bucketFilter) : null,
  getSubcatOptions: () => [
    { key: "urbano",     label: "Parques urbanos",  fill: "rgb(74,160,90)",  glyph: "Ur" },
    { key: "deporte",    label: "Deporte",           fill: "rgb(90,196,168)", glyph: "Dp" },
    { key: "agricola",   label: "Agrícola",          fill: "rgb(196,168,104)",glyph: "Ag" },
    { key: "forestal",   label: "Forestal",          fill: "rgb(42,80,24)",   glyph: "Fr" },
    { key: "playa",      label: "Playa / arena",     fill: "rgb(212,200,120)",glyph: "Pl" },
    { key: "cementerio", label: "Cementerio",        fill: "rgb(128,120,104)",glyph: "Cm" },
  ],
};
