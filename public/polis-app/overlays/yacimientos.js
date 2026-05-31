// Overlay "Yacimientos prehispánicos" (MEM-04) — identidad guanche /
// canaria-aborigen sobre el territorio. Cuevas pintadas, poblados de
// piedra seca, necrópolis tumulares, petroglifos, almogarenes.
//
// Datos: scripts/extract-yacimientos.py → yacimientos-prehispanicos-canarias.geojson
// 89 yacimientos: catálogo curado (29) + OSM historic=archaeological_site (60).
//
// SENSIBILIDAD ANTI-EXPOLIO (Ley 11/2019 Patrimonio Cultural de Canarias):
//   - `visitable=true`  → pin terracota grande con glifo espiral, nombre completo.
//   - `visitable=false` → pin terracota PEQUEÑO, sin glifo. Coordenada degradada
//      a centroide municipal en el script. El popup no debe revelar pistas
//      geográficas finas: usar `descripcion_corta` (ya redactada genéricamente).
//   - Sin protección formal → no entra en el dataset.

import { project, lnglatToLocalMeters } from "../iso.js";

const DATA_URL = "../data/yacimientos-prehispanicos-canarias.geojson?v=20260527-yacimientos-v0";
const GC_ANCHOR = [-15.55, 28.05];

// Paleta terracota / almagre aborigen. Sin discriminación cromática por
// tipo — todos los yacimientos comparten el mismo color cultural; el
// glifo distingue tipo cuando es visitable.
const COLOR_TERRACOTA = "#A0522D";  // sienna / almagre
const COLOR_BORDE     = "#1A1612";

const TIPO_GLYPH = {
  poblado:    "⌂",   // casa
  necropolis: "†",
  petroglifo: "◉",   // espiral / círculo concéntrico simbólico
  cueva:      "∩",
  granero:    "▴",
  tumulo:     "◬",
  _default:   "·"
};

const TIPO_LABEL = {
  poblado: "Poblado", necropolis: "Necrópolis", petroglifo: "Petroglifo",
  cueva: "Cueva", granero: "Granero", tumulo: "Túmulo"
};

const CULTURA_LABEL = {
  canario:     "canario antiguo (GC)",
  guanche:     "guanche (TF)",
  benahoarita: "benahoarita (LP)",
  gomero:      "gomero (LG)",
  bimbache:    "bimbache (EH)",
  majo:        "majo (LZ)",
  mahorero:    "mahorero (FV)",
  awara:       "awara"
};

const PIN_R_VISITABLE   = 9;
const PIN_R_PROTEGIDO   = 5;  // más pequeño → menos pista
const CLUSTER_PX        = 24;

let _data = null;
let _loadingPromise = null;
let _tipoFilter = null;
let _culturaFilter = null;

async function _load() {
  if (_data) return _data;
  if (_loadingPromise) return _loadingPromise;
  _loadingPromise = fetch(DATA_URL, { cache: "no-cache" })
    .then(r => r.ok ? r.json() : Promise.reject(new Error("status " + r.status)))
    .then(fc => {
      const out = [];
      for (const f of (fc.features || [])) {
        if (!f.geometry || f.geometry.type !== "Point") continue;
        const [lng, lat] = f.geometry.coordinates;
        const [mx, mz] = lnglatToLocalMeters(lng, lat, GC_ANCHOR);
        out.push({ mx, mz, properties: { ...f.properties } });
      }
      _data = out;
      return _data;
    })
    .catch(err => {
      console.warn("[yacimientosOverlay] load fallo:", err);
      _data = null;
      _loadingPromise = null;
      return null;
    });
  return _loadingPromise;
}

function _inBbox(mx, mz, bbox) {
  if (!bbox) return true;
  const [a, b, c, d] = bbox;
  return mx >= a && mx <= c && mz >= b && mz <= d;
}

function _passes(item) {
  const tipo = item.properties?.tipo || "_default";
  const cultura = item.properties?.cultura;
  if (_tipoFilter && !_tipoFilter.has(tipo)) return false;
  if (_culturaFilter && !_culturaFilter.has(cultura)) return false;
  return true;
}

function _drawPin(ctx, px, py, item, count) {
  const props = item.properties || {};
  const visitable = !!props.visitable;
  const tipo = props.tipo || "_default";
  const r = visitable ? PIN_R_VISITABLE : PIN_R_PROTEGIDO;

  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fillStyle = COLOR_TERRACOTA;
  ctx.globalAlpha = visitable ? 1 : 0.75;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = COLOR_BORDE;
  ctx.stroke();

  if (visitable) {
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 10px Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(TIPO_GLYPH[tipo] || TIPO_GLYPH._default, px, py);
  }

  if (count > 1) {
    ctx.beginPath();
    ctx.arc(px + r - 1, py - r + 1, 5, 0, Math.PI * 2);
    ctx.fillStyle = COLOR_BORDE;
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 8px 'IBM Plex Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(count), px + r - 1, py - r + 1);
  }
}

export const yacimientosOverlay = {
  id: "yacimientos",
  name: "Yacimientos prehispánicos",

  load: _load,
  isReady: () => Array.isArray(_data),

  draw: (ctx, state, view) => {
    if (!_data || !_data.length) return;
    let bbox = null;
    if (state.lodLevel === "isla") bbox = state.isla?.bbox;
    else if (state.lodLevel === "municipio") bbox = state.municipio?.bbox;
    else if (state.lodLevel === "distrito") bbox = state.district?.bbox;
    else if (state.lodLevel === "barrio") bbox = state.barrio?.bbox;
    else if (state.lodLevel === "seccion") bbox = state.section?.bbox || state.section?._bbox || null;
    if (state.lodLevel === "archipielago" || state.lodLevel === "manzana") return;

    const projected = [];
    for (const item of _data) {
      if (!_inBbox(item.mx, item.mz, bbox)) continue;
      if (!_passes(item)) continue;
      const [px, py] = project(item.mx, 0, item.mz, view);
      projected.push({ item, px, py });
    }

    const clusters = [];
    for (const it of projected) {
      let placed = false;
      for (const c of clusters) {
        if (Math.abs(c.px - it.px) < CLUSTER_PX &&
            Math.abs(c.py - it.py) < CLUSTER_PX) {
          c.items.push(it.item);
          c.px = (c.px * (c.items.length - 1) + it.px) / c.items.length;
          c.py = (c.py * (c.items.length - 1) + it.py) / c.items.length;
          placed = true;
          break;
        }
      }
      if (!placed) clusters.push({ px: it.px, py: it.py, items: [it.item] });
    }

    clusters.sort((a, b) => a.py - b.py);
    for (const c of clusters) {
      // Prioriza visitable para que el cluster muestre el pin "grande con glifo".
      const best = c.items.slice().sort((a, b) =>
        (b.properties?.visitable ? 1 : 0) - (a.properties?.visitable ? 1 : 0)
      )[0];
      _drawPin(ctx, c.px, c.py, best, c.items.length);
    }
  },

  // Sub-chips por tipo
  getSubcatOptions: () => Object.entries(TIPO_LABEL).map(([id, label]) => ({
    id, label, color: COLOR_TERRACOTA
  })),
  setSubcatFilter: (ids) => {
    _tipoFilter = ids && ids.length ? new Set(ids) : null;
  },
  getSubcatFilter: () => _tipoFilter ? Array.from(_tipoFilter) : null,

  // API extra para filtro por cultura aborigen (si la UI quiere ofrecerlo)
  getCulturaOptions: () => Object.entries(CULTURA_LABEL).map(([id, label]) => ({
    id, label, color: COLOR_TERRACOTA
  })),
  setCulturaFilter: (ids) => {
    _culturaFilter = ids && ids.length ? new Set(ids) : null;
  }
};
