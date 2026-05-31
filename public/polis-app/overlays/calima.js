// Overlay "Calima" (RIE-05) — velo translúcido de polvo sahariano sobre
// las islas afectadas. Datos en `data/calima-estado.json` (ver
// scripts/refresh-calima.py para el pipeline de fuentes reales).
//
// A diferencia de `calidadAireOverlay` (pins puntuales por estación),
// la calima es un fenómeno difuso de escala regional: una nube de PM10
// que afecta a islas enteras durante varios días. Por eso se pinta como
// una BANDA TRANSLÚCIDA sobre los polígonos de las islas listadas en
// `afecta_islas`, con color/alpha proporcional al `nivel_actual`.
//
// Niveles donde aplica:
//   · archipiélago, isla, municipio — sí (la calima es regional)
//   · distrito, barrio, sección, manzana — NO (sería ruido visual repetido,
//     el banner del topbar ya transmite la info a esa escala)
//
// Banner topbar: cuando el nivel es `alto` o superior, se inyecta en
// document.body un elemento `.calima-banner` con un aviso textual. El
// banner se crea dinámicamente en load() — no se toca index.html ni
// overlays/index.js ni app.js (integración pendiente, ver docs/).

import { project, lnglatToLocalMeters } from "../iso.js";

const DATA_URL = "../data/calima-estado.json";
const ISLAS_URL = "../data/islas-canarias.geojson";
const GC_ANCHOR = [-15.55, 28.05];

// Mapeo del código corto que usa `afecta_islas` en calima-estado.json
// (fv/lz/gc/tf/lp/lg/eh) al `id` largo del feature en islas-canarias.geojson.
// La Graciosa va con Lanzarote (administrativamente y a efectos de polvo).
const ISLA_CODE_TO_ID = {
  fv: ["fuerteventura"],
  lz: ["lanzarote", "la-graciosa"],
  gc: ["gran-canaria"],
  tf: ["tenerife"],
  lp: ["la-palma"],
  lg: ["la-gomera"],
  eh: ["el-hierro"]
};

// Alpha por nivel (proporcional a gravedad). Calibrado para que en
// "moderado" sea perceptible pero no oculte el render base, y en
// "extremo" se vea casi opaco para transmitir alarma.
const NIVEL_ALPHA = {
  bajo:     0.00,   // no se pinta
  moderado: 0.18,
  alto:     0.24,
  muy_alto: 0.30,
  extremo:  0.35
};

const NIVEL_ORDEN = ["bajo", "moderado", "alto", "muy_alto", "extremo"];

let _estado = null;          // payload de calima-estado.json
let _polysByCode = null;     // { fv:[{ring,bbox}], lz:[...], ... } proyectado
let _loadingPromise = null;
let _bannerEl = null;

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
  // Aplana Polygon/MultiPolygon en una lista de anillos exteriores
  // (descartamos holes — para un velo translúcido un fill simple lee
  // mejor a esta escala, igual que en cobertura.js).
  const out = [];
  const g = feature && feature.geometry;
  if (!g) return out;
  if (g.type === "Polygon") {
    if (g.coordinates && g.coordinates[0]) {
      const ring = _projectRing(g.coordinates[0]);
      out.push({ ring, bbox: _ringBbox(ring) });
    }
  } else if (g.type === "MultiPolygon") {
    for (const poly of g.coordinates || []) {
      if (!poly || !poly[0]) continue;
      const ring = _projectRing(poly[0]);
      out.push({ ring, bbox: _ringBbox(ring) });
    }
  }
  return out;
}

function _bboxIntersects(a, b) {
  if (!a || !b) return true;
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
}

function _idToCode(id) {
  // Invierso de ISLA_CODE_TO_ID: dado un id largo del geojson, devuelve
  // el código corto (o null si no está mapeado).
  for (const code of Object.keys(ISLA_CODE_TO_ID)) {
    if (ISLA_CODE_TO_ID[code].includes(id)) return code;
  }
  return null;
}

async function _loadIslas() {
  const res = await fetch(ISLAS_URL, { cache: "no-cache" });
  if (!res.ok) throw new Error("islas geojson status " + res.status);
  const json = await res.json();
  const by = {};
  for (const code of Object.keys(ISLA_CODE_TO_ID)) by[code] = [];
  for (const feat of (json.features || [])) {
    const longId = feat.properties && feat.properties.id;
    const code = _idToCode(longId);
    if (!code) continue;
    for (const p of _ingestFeature(feat)) by[code].push(p);
  }
  return by;
}

async function _loadEstado() {
  const res = await fetch(DATA_URL, { cache: "no-cache" });
  if (!res.ok) throw new Error("calima-estado status " + res.status);
  return res.json();
}

function _ensureBanner(estado) {
  // Inyecta o actualiza el banner del topbar. Sólo aparece en niveles
  // `alto` o superiores. Se posiciona absolute bajo el topbar (top: 56px).
  if (!estado) return;
  const nivel = estado.nivel_actual;
  const orden = NIVEL_ORDEN.indexOf(nivel);
  const debeMostrarse = orden >= NIVEL_ORDEN.indexOf("alto");

  if (!debeMostrarse) {
    if (_bannerEl && _bannerEl.parentNode) _bannerEl.parentNode.removeChild(_bannerEl);
    _bannerEl = null;
    return;
  }

  if (!_bannerEl) {
    _bannerEl = document.createElement("div");
    _bannerEl.className = "calima-banner";
    // Estilo inline para no depender de cambios en style.css. El diseño
    // mimetiza el lenguaje visual del visor (ocre / mono).
    Object.assign(_bannerEl.style, {
      position: "fixed",
      top: "56px",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: "40",
      padding: "8px 14px",
      borderRadius: "4px",
      fontFamily: "'IBM Plex Mono', SF Mono, Menlo, monospace",
      fontSize: "13px",
      fontWeight: "600",
      color: "#1A1612",
      boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
      pointerEvents: "none",
      whiteSpace: "nowrap"
    });
    document.body.appendChild(_bannerEl);
  }

  const leyenda = (estado.leyenda && estado.leyenda[nivel]) || {};
  const color = leyenda.color || "#e68a4f";
  _bannerEl.style.background = color;

  // Texto del banner: severidad + PM10 + consejo
  const pm10 = estado.valor_pm10_proxy;
  const nivelLabel = nivel.replace("_", " ");
  let consejo = "";
  if (nivel === "alto")     consejo = " · cerrar ventanas si eres sensible";
  if (nivel === "muy_alto") consejo = " · cerrar ventanas";
  if (nivel === "extremo")  consejo = " · evita salir, usa mascarilla";

  _bannerEl.textContent =
    `⚠ Calima ${nivelLabel} hoy · PM10 ~${pm10}${consejo}`;
}

function _drawVelo(ctx, view, polys, color, alpha, levelBbox) {
  if (!polys || !polys.length) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.6;
  for (let i = 0; i < polys.length; i++) {
    const poly = polys[i];
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
  }
  ctx.restore();
}

function _levelBbox(state) {
  const lvl = state && state.lodLevel;
  if (lvl === "municipio") return state.municipio && state.municipio.bbox;
  if (lvl === "isla")      return state.isla && state.isla.bbox;
  return null; // archipiélago: sin filtro
}

function _islaStateCode(state) {
  // Si estamos en nivel isla/municipio, devolvemos el código corto de la
  // isla actual para limitar el velo a esa isla (evita pintar fuera de
  // contexto). Soportamos los nombres habituales del data pack.
  const lvl = state && state.lodLevel;
  if (lvl !== "isla" && lvl !== "municipio") return null;
  const isla = (state.isla && (state.isla.code || state.isla.id || state.isla.cod)) ||
               (state.municipio && (state.municipio.isla || state.municipio.island));
  if (typeof isla !== "string") return null;
  // Si ya es código corto, devolvemos tal cual
  if (ISLA_CODE_TO_ID[isla]) return isla;
  // Si es id largo, traducimos
  return _idToCode(isla);
}

export const calimaOverlay = {
  id: "calima",
  name: "Calima (polvo sahariano)",

  load: async () => {
    if (_estado && _polysByCode) return _estado;
    if (_loadingPromise) return _loadingPromise;
    _loadingPromise = Promise.all([_loadEstado(), _loadIslas()])
      .then(([estado, polys]) => {
        _estado = estado;
        _polysByCode = polys;
        _ensureBanner(estado);
        return _estado;
      })
      .catch(err => {
        console.warn("[calimaOverlay] load fallo:", err);
        _estado = null;
        _polysByCode = null;
        _loadingPromise = null;
        return null;
      });
    return _loadingPromise;
  },

  isReady: () => !!(_estado && _polysByCode),

  draw: (ctx, state, view) => {
    if (!_estado || !_polysByCode) return;
    if (!state || !view) return;

    // Niveles aplicables: archipiélago, isla, municipio. A escalas más
    // finas (distrito/barrio/sección/manzana) el velo ya no aporta
    // información y satura visualmente.
    const lvl = state.lodLevel;
    if (lvl !== "archipielago" && lvl !== "isla" && lvl !== "municipio") return;

    const nivel = _estado.nivel_actual;
    const alpha = NIVEL_ALPHA[nivel] || 0;
    if (alpha <= 0) return;  // bajo: no se pinta

    const leyenda = (_estado.leyenda && _estado.leyenda[nivel]) || {};
    const color = leyenda.color || "#d4c44a";

    const afectadas = _estado.afecta_islas || [];
    if (!afectadas.length) return;

    const levelBbox = _levelBbox(state);
    const focoCode = _islaStateCode(state);

    for (const code of afectadas) {
      // En nivel isla/municipio, sólo pintamos si coincide con la isla
      // mirada (no tiene sentido pintar Tenerife mientras navegas LZ).
      if (focoCode && code !== focoCode) continue;
      const polys = _polysByCode[code];
      if (!polys || !polys.length) continue;
      _drawVelo(ctx, view, polys, color, alpha, levelBbox);
    }
  },

  getEstado: () => _estado,
  getBanner: () => _bannerEl
};
