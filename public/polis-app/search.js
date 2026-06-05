// Buscador transversal — indexa muns, eventos culturales, distritos y
// venues. El index se construye dinámicamente cada vez que se abre el
// buscador, así que refleja el estado actual (overlays cargados,
// distritos del mun activo, etc.) sin pollings.
//
// API:
//   buildIndex(state, registry) → Array<Entry>
//   search(index, query)        → Array<Entry> (subset, ranked)
//
// Entry shape:
//   { type, label, sublabel, search, action }
//
// `action` es una función que ejecuta la navegación o el popup
// correspondiente al resultado. La firma es action() — el contexto ya
// está cerrado vía closures al construir el index.

const TYPE_LABELS = {
  tejido:    "Tejido social",
  productor: "Productor",
  municipio: "🏙 Mun",
  evento:    "Evento",
  distrito:  "Distrito",
  calle:     "Calle",
  venue:     "Lugar",
  barrio:    "🏘 Barrio",
  manzana:   "🧱 Manzana",
  poi:       "📌 POI"
};

// Highway types relevantes para indexar. Excluye footways, cycleways,
// motorway_link, etc. para no inflar el index.
const HIGHWAY_INDEXABLE = new Set([
  "residential", "primary", "secondary", "tertiary",
  "pedestrian", "living_street", "unclassified"
]);

const HIGHWAY_LABELS = {
  primary:        "vía principal",
  secondary:      "vía secundaria",
  tertiary:       "vía local",
  residential:    "calle residencial",
  pedestrian:     "vía peatonal",
  living_street:  "calle de prioridad peatonal",
  unclassified:   "vía sin clasificar"
};

function _normalize(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// ----------------------------------------------------------
// Construcción del index (snapshot del estado actual).

import { assetUrl } from "./assets-base.js";

export async function buildIndex(state, ctx) {
  const out = [];

  // 1. Municipios — siempre disponibles desde state.isla.municipios.
  //    Enriquecidos con `municipios-info.json` cuando esté cacheado.
  const munInfo = await _loadMunInfo();
  for (const m of state.isla?.municipios || []) {
    const munCode = m.properties.mun;
    const nmun = m.properties.nmun;
    const row = munInfo[munCode] || {};
    out.push({
      type: "municipio",
      label: row.nombre || nmun,
      sublabel: row.lema || "Municipio",
      search: _normalize([nmun, row.nombre, row.lema, row.chascarrillo,
                          munCode].join(" ")),
      action: () => ctx.openMunicipioPopup(munCode)
    });
  }

  // 2. Eventos culturales — desde el overlay si está cargado, o se
  //    fuerza load porque el buscador es el punto natural de descubrir.
  const eventosOv = state._overlayRegistry?.get("eventos");
  if (eventosOv) {
    if (!eventosOv.isReady()) await eventosOv.load();
    const evts = eventosOv.getAllEvents ? eventosOv.getAllEvents() : [];
    for (const e of evts) {
      const p = e.properties || {};
      out.push({
        type: "evento",
        label: p.titulo || "Evento",
        sublabel: `${_fmtFechaCorta(p.fecha)}${p.hora_inicio ? " · " + p.hora_inicio : ""} · ${p.lugar || ""}`,
        search: _normalize([p.titulo, p.lugar, p.municipio, p.categoria,
                            p.descripcion, p.fecha].join(" ")),
        action: () => ctx.openEventoPopup(e)
      });
    }
  }

  // 2.4 Tejido social — PRIORIDAD MÁXIMA. Cooperativas, asociaciones,
  // espacios comunitarios. Es el corazón del proyecto: lo que sostiene
  // la vida en el territorio sin extraerla.
  const tejidoOv = state._overlayRegistry?.get("tejido-social");
  if (tejidoOv) {
    if (!tejidoOv.isReady()) await tejidoOv.load();
    const items = tejidoOv.getAllItems ? tejidoOv.getAllItems() : [];
    for (const t of items) {
      const tp = t.properties || {};
      const catLabel = tejidoOv.getCategoriaLabel(tp.categoria) || tp.categoria || "";
      out.push({
        type: "tejido",
        label: tp.nombre || "Tejido social",
        sublabel: `${catLabel} · ${tp.municipio || ""}`,
        search: _normalize([tp.nombre, tp.categoria, catLabel, tp.municipio,
                            tp.que_hace].join(" ")),
        action: () => ctx.openTejidoPopup(t)
      });
    }
  }

  // 2.5 Productores locales — prioridad alta en el ranking (boost en
  // typeBonus). Pancho los puso por encima de instituciones grandes
  // para que el discovery valore artesanos/agricultores pequeños.
  const prodOv = state._overlayRegistry?.get("productores");
  if (prodOv) {
    if (!prodOv.isReady()) await prodOv.load();
    const prods = prodOv.getAllProductores ? prodOv.getAllProductores() : [];
    for (const p of prods) {
      const pr = p.properties || {};
      const oficioLabel = prodOv.getOficioLabel(pr.oficio) || pr.oficio || "";
      out.push({
        type: "productor",
        label: pr.nombre || "Productor",
        sublabel: `${oficioLabel} · ${pr.municipio || ""}`,
        search: _normalize([pr.nombre, pr.oficio, oficioLabel, pr.municipio,
                            pr.que_hace].join(" ")),
        action: () => ctx.openProductorPopup(p)
      });
    }
  }

  // 3.0 Barrios — TODOS los barrios curados (prov 35/38), siempre
  //     disponibles desde state.barriosGc.barrios. Action: enterBarrio(id).
  //     2026-06-02 — Filtramos:
  //       · piezas catch-all "<Mun> (otros)" (29 entradas que pollutan)
  //       · piezas synthetic-mun (envuelven el mun entero, ya aparece en
  //         la categoría "municipio" — duplicar no aporta).
  //       · piezas con id "supra-..." (se indexan abajo desde el geojson
  //         de supra-regiones directamente; ese flujo es el coherente).
  if (state.barriosGc?.barrios) {
    for (const [bid, meta] of Object.entries(state.barriosGc.barrios)) {
      if (!meta?.name) continue;
      if (/\(otros\)$/i.test(meta.name)) continue;
      if (meta.place_type === "synthetic-mun") continue;
      if (bid.startsWith("supra-")) continue;
      out.push({
        type: "barrio",
        label: meta.name,
        sublabel: meta.mun_name || meta.place_type || "Barrio",
        search: _normalize([meta.name, meta.mun_name, meta.place_type,
                            bid].join(" ")),
        action: () => ctx.enterBarrio(bid, true)
      });
    }
  }

  // 3.0.bis — Supra-piezas RURALES indexadas desde supra-regiones-{isla}.
  //     geojson. Sub-supras + top-level sin hijos (la misma selección que
  //     _buildSupraPiezas hace al render). Se cargan en background (cache
  //     por isla); el usuario puede buscar "Las Cuevas" o "Barranco de
  //     la Mina" SIN haber visitado el mun rural correspondiente. La
  //     acción navega: enterIsla → enterMunicipio → enterBarrio cuando la
  //     pieza esté registrada en state.barriosGc.barrios (la registra
  //     `_buildSupraPiezas` al cargar el mun).
  //     Resolución de mun_name: municipios-info.json solo cubre prov 35;
  //     para prov 38 usamos los barrios canonical (state.barriosGc) que
  //     traen mun_name. Sin este fallback los muns TF/LP/LG/EH aparecían
  //     como "38038" en lugar de "Santa Cruz de Tenerife".
  const munNameByCod = new Map();
  if (state.barriosGc?.barrios) {
    for (const meta of Object.values(state.barriosGc.barrios)) {
      if (meta?.mun && meta?.mun_name) {
        munNameByCod.set(meta.mun, meta.mun_name);
      }
    }
  }
  for (const isla of ['gc','tf','lp','lz','fv','lg','eh']) {
    const supraIdx = await _loadSupraIndex(isla);
    for (const s of supraIdx) {
      const munName = s.munName || munNameByCod.get(s.munCod) || s.munCod;
      out.push({
        type: "barrio",
        label: s.nombre,
        sublabel: `${munName} · Pago / barranco`,
        search: _normalize([s.nombre, munName, s.munCod,
                            s.capa || ""].join(" ")),
        action: () => ctx.navigateToSupraPieza(s)
      });
    }
  }

  // 3.1 Manzanas del BARRIO ACTIVO (lazy — sólo si estamos en barrio o
  //     niveles inferiores). Cada manzana del barrio entra al índice como
  //     "Manzana <localId> de <barrioName>". El handler reconstruye el
  //     compositeId "<cusec>-<localId>" y llama enterManzana.
  if (state.barrio?.manzanas?.length) {
    const barrioName = state.barrio.name || "barrio";
    for (const m of state.barrio.manzanas) {
      const cusec = m._cusec;
      const localId = m.properties?.id;
      if (cusec == null || localId == null) continue;
      const compositeId = `${cusec}-${localId}`;
      const label = `Manzana ${localId} de ${barrioName}`;
      out.push({
        type: "manzana",
        label,
        sublabel: `${barrioName} · ${m.properties?.building_count || 0} edificios`,
        search: _normalize([label, barrioName, compositeId, cusec,
                            String(localId)].join(" ")),
        action: () => ctx.enterManzana(compositeId)
      });
    }
  }

  // 3.2 POIs nombrados del BARRIO ACTIVO (lazy — fetch pois.geojson de
  //     cada sección del barrio, una vez por barrio cacheado). Acción:
  //     enterManzana(compositeId) + onBuildingTap(building_id, manzana_id)
  //     para que la capa cívica futura pueda reaccionar al edificio focal.
  if (state.barrio?.barrioId) {
    const pois = await _loadBarrioPois(state.barrio);
    for (const poi of pois) {
      out.push({
        type: "poi",
        label: poi.name,
        sublabel: poi.category
          ? `${poi.category} · ${state.barrio.name || ""}`
          : (state.barrio.name || "POI"),
        search: _normalize([poi.name, poi.category,
                            state.barrio.name || ""].join(" ")),
        action: () => {
          const compositeId = `${poi.cusec}-${poi.manzana_id}`;
          const r = ctx.enterManzana(compositeId);
          const after = () => ctx.onBuildingTap(poi.building_id, poi.manzana_id);
          if (r && typeof r.then === "function") r.then(after);
          else after();
        }
      });
    }
  }

  // 3. Distritos del mun activo (si lo hay). LPGC tiene labels propios.
  if (state.municipio?.distList?.length) {
    for (const d of state.municipio.distList) {
      const label = ctx.distritoLabel(d.distritoId) || `Distrito ${d.dis}`;
      out.push({
        type: "distrito",
        label,
        sublabel: `${state.municipio.nmun} · ${d.secciones?.length || 0} secciones`,
        search: _normalize([label, state.municipio.nmun, d.distritoId,
                            d.dis].join(" ")),
        action: () => ctx.enterDistrito(d.distritoId, true)
      });
    }
  }

  // 3.5 Calles del callejero OSM. Cargadas lazy. Dedupe por nombre,
  //    bbox + centroide pre-calculados. typeBonus moderado (+2) para
  //    que no opaquen productores/tejido cuando coinciden.
  const calles = await _loadCalles();
  for (const c of calles) {
    out.push({
      type: "calle",
      label: c.name,
      sublabel: HIGHWAY_LABELS[c.type] || "calle",
      search: _normalize(c.name),
      action: () => ctx.navigateToStreet(c)
    });
  }

  // 4. Venues únicos derivados de los eventos. Útil para "Casa de Colón"
  //    como búsqueda directa que abre el primer evento allí (proxy de
  //    abrir el lugar).
  if (eventosOv?.isReady && eventosOv.isReady()) {
    const evts = eventosOv.getAllEvents();
    const venueMap = new Map();
    for (const e of evts) {
      const lugar = e.properties?.lugar;
      if (!lugar || venueMap.has(lugar)) continue;
      venueMap.set(lugar, e);
    }
    for (const [lugar, e] of venueMap) {
      const p = e.properties || {};
      out.push({
        type: "venue",
        label: lugar,
        sublabel: p.municipio || "Lugar cultural",
        search: _normalize([lugar, p.municipio].join(" ")),
        action: () => ctx.openEventoPopup(e)
      });
    }
  }

  return out;
}

// ----------------------------------------------------------
// Búsqueda con ranking básico.

export function search(index, query, limit = 20) {
  const q = _normalize(query).trim();
  if (!q) return [];
  const tokens = q.split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];

  const scored = [];
  for (const e of index) {
    let score = 0;
    let allMatch = true;
    for (const t of tokens) {
      const idx = e.search.indexOf(t);
      if (idx === -1) { allMatch = false; break; }
      // Ranking simple: prefijo de palabra (precedido por espacio o
      // inicio) puntúa más. Coincidencias tempranas también.
      const isStart = idx === 0 || e.search[idx - 1] === " ";
      score += isStart ? 10 : 5;
      score += Math.max(0, 5 - Math.floor(idx / 20));
    }
    if (!allMatch) continue;
    // Bonus por tipo — refleja la jerarquía editorial:
    //   tejido social ⟫ productores ⟫ muns/eventos ⟫ distritos/calles ⟫ venues
    // El tejido social es el corazón del proyecto (cooperativas,
    // asociaciones vecinales, espacios autogestionados); los productores
    // son la PYME local; muns/eventos contenido institucional; las
    // calles son referencias del callejero (útiles para localizar).
    const typeBonus = e.type === "tejido"    ? 6
                    : e.type === "productor" ? 5
                    : e.type === "poi"       ? 4
                    : e.type === "municipio" ? 3
                    : e.type === "evento"    ? 3
                    : e.type === "barrio"    ? 3
                    : e.type === "distrito"  ? 2
                    : e.type === "manzana"   ? 2
                    : e.type === "calle"     ? 2
                    : 1;
    score += typeBonus;
    scored.push({ ...e, _score: score });
  }
  scored.sort((a, b) => b._score - a._score);
  return scored.slice(0, limit);
}

export function typeLabel(t) {
  return TYPE_LABELS[t] || t;
}

// ----------------------------------------------------------
// Helpers internos.

// 2026-06-02 — Cache por isla del index de supra-piezas para el buscador.
// Lee el geojson supra-regiones-{isla}.geojson una sola vez y deriva:
//   { id, nombre, munCod, munName, capa, lng, lat }
// donde id es el numérico de la supra, munCod el "35XXX"/"38XXX". El runtime
// `_buildSupraPiezas` registra estas piezas en state.barriosGc.barrios bajo
// `supra-{munCod}-{id}` solo al entrar al mun — el search debe poder buscar
// SIN ese registro, por eso vamos directo al geojson.
const _supraIdxCache = new Map();   // isla → Promise<rows[]>
async function _loadSupraIndex(isla) {
  if (_supraIdxCache.has(isla)) return _supraIdxCache.get(isla);
  const p = (async () => {
    try {
      const r = await fetch(`../data/supra-regiones-${isla}.geojson`);
      if (!r.ok) return [];
      const fc = await r.json();
      // Misma selección que _buildSupraPiezas: sub-supras + top-level
      // sin hijos.
      const parentsConHijos = new Set();
      for (const f of fc.features || []) {
        if (f.properties.parent_id != null)
          parentsConHijos.add(String(f.properties.parent_id));
      }
      const munInfo = await _loadMunInfo();
      const rows = [];
      for (const f of fc.features || []) {
        const p = f.properties;
        if (!p?.nombre) continue;
        if (p.parent_id == null && parentsConHijos.has(String(p.id))) continue;
        const munCod = p.mun_cod || "";
        const mun3 = munCod.replace(/^3[58]/, "");
        const munName = munInfo[mun3]?.nombre || "";
        const c = p.centroide?.coordinates;
        rows.push({
          id: p.id,
          nombre: p.nombre,
          munCod, munName,
          capa: p.capa,
          lng: c?.[0] ?? null,
          lat: c?.[1] ?? null
        });
      }
      return rows;
    } catch (e) {
      console.warn(`[search] supra-regiones-${isla} no cargado:`, e);
      return [];
    }
  })();
  _supraIdxCache.set(isla, p);
  return p;
}

let _munInfoCache = null;
async function _loadMunInfo() {
  if (_munInfoCache) return _munInfoCache;
  try {
    const r = await fetch("../data/municipios-info.json");
    if (!r.ok) throw new Error("status " + r.status);
    _munInfoCache = await r.json();
  } catch (e) {
    console.warn("[search] municipios-info.json no cargado:", e);
    _munInfoCache = {};
  }
  return _munInfoCache;
}

function _fmtFechaCorta(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(n => parseInt(n, 10));
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${d} ${meses[m-1]}`;
}

// -----------------------------------------------------------
// Callejero — lazy load + dedupe por nombre.
//
// El archivo `osm-gc/roads.json` tiene ~96K segmentos. Tras filtrar por
// tipo de vía relevante y agrupar por nombre quedan ~10K nombres únicos.
// Para cada nombre acumulamos coords de TODOS sus segmentos y derivamos:
//   - centroide (media simple, para pan)
//   - bbox lngLat (para zoom-to-fit)
//
// La carga es one-shot y se cachea — la primera abertura del buscador
// pagará el coste (varios MB de geojson); abrertyras posteriores tiran
// del cache.

let _callesCache = null;
let _callesLoadingPromise = null;

// Exposición del callejero para el buscador unificado (bocadillo 🔍 de
// app.js). Devuelve el array cacheado de calles {name, type, centroide,
// bboxLngLat}. Carga lazy one-shot compartida con buildIndex.
export async function loadCalles() { return _loadCalles(); }

// Agrega un FeatureCollection de roads en entradas de calle. La
// agregación por nombre es POR FICHERO (cada fichero = una isla/provincia)
// para NO fusionar calles homónimas de islas distintas (p.ej. "Calle Real"
// existe en varias islas y cada una debe ser un resultado con su centroide).
function _aggregateRoads(fc) {
  const byName = new Map();
  for (const f of fc.features || []) {
    const name = (f.properties?.name || "").trim();
    if (!name) continue;
    const hw = f.properties?.highway;
    if (!HIGHWAY_INDEXABLE.has(hw)) continue;
    if (!f.geometry || f.geometry.type !== "LineString") continue;
    let agg = byName.get(name);
    if (!agg) {
      agg = {
        name, type: hw,
        minLng: Infinity, maxLng: -Infinity,
        minLat: Infinity, maxLat: -Infinity,
        sumLng: 0, sumLat: 0, n: 0
      };
      byName.set(name, agg);
    }
    for (const [lng, lat] of f.geometry.coordinates) {
      if (lng < agg.minLng) agg.minLng = lng;
      if (lng > agg.maxLng) agg.maxLng = lng;
      if (lat < agg.minLat) agg.minLat = lat;
      if (lat > agg.maxLat) agg.maxLat = lat;
      agg.sumLng += lng; agg.sumLat += lat; agg.n++;
    }
  }
  const out = [];
  for (const r of byName.values()) {
    if (r.n === 0) continue;
    out.push({
      name: r.name,
      type: r.type,
      centroide: [r.sumLng / r.n, r.sumLat / r.n],
      bboxLngLat: [r.minLng, r.minLat, r.maxLng, r.maxLat]
    });
  }
  return out;
}

async function _loadCalles() {
  if (_callesCache) return _callesCache;
  if (_callesLoadingPromise) return _callesLoadingPromise;
  // Callejero de las islas con datos OSM extraídos: GC (osm-gc) + provincia
  // 38 = Tenerife/La Palma/La Gomera/El Hierro (osm-prov38). Lanzarote y
  // Fuerteventura aún sin extracto local → no aparecen sus calles todavía.
  const fetchFC = (url) =>
    fetch(url)
      .then(r => r.ok ? r.json() : Promise.reject(new Error("status " + r.status)))
      .then(_aggregateRoads)
      .catch(err => { console.warn("[search] callejero " + url + " fallo:", err); return []; });
  _callesLoadingPromise = Promise.all([
    fetchFC(assetUrl("../osm-gc/roads.json")),
    fetchFC(assetUrl("../osm-prov38/roads.json")),
  ]).then(parts => {
    _callesCache = parts.flat();
    return _callesCache;
  });
  return _callesLoadingPromise;
}

// -----------------------------------------------------------
// POIs nombrados — lazy por barrio.
//
// Cuando el usuario abre el buscador con un barrio activo, fetchamos
// pois.geojson de cada sección del barrio en paralelo y construimos un
// índice plano. Cache por barrioId, viva mientras el módulo siga cargado.
// Tope de seguridad: MAX_POIS_PER_BARRIO entries (los barrios densos como
// Vegueta-Triana pueden tener cientos de POIs; truncamos para no saturar
// la UI).

const MAX_POIS_PER_BARRIO = 200;
const _barrioPoisCache = new Map();   // barrioId → Array<{name,category,…}>

async function _loadBarrioPois(barrio) {
  if (!barrio?.barrioId) return [];
  if (_barrioPoisCache.has(barrio.barrioId)) {
    return _barrioPoisCache.get(barrio.barrioId);
  }
  const sections = barrio.secciones || [];
  const cusecs = sections.map(s => s.properties?.cusec).filter(Boolean);
  if (!cusecs.length) {
    _barrioPoisCache.set(barrio.barrioId, []);
    return [];
  }
  // Fetch en paralelo pois.geojson y manzanas.geojson de cada sección.
  // Necesitamos las manzanas en coords section-local (raw) para hacer
  // point-in-polygon contra las coords section-local de cada POI. Las
  // manzanas en state.barrio.manzanas están ya reproyectadas a anchor GC,
  // así que no sirven directamente.
  const fetches = cusecs.map(cusec => Promise.all([
    fetch(assetUrl(`../sections_pack/${cusec}/pois.geojson`))
      .then(r => r.ok ? r.json() : { features: [] })
      .catch(() => ({ features: [] })),
    fetch(assetUrl(`../sections_pack/${cusec}/manzanas.geojson`))
      .then(r => r.ok ? r.json() : { features: [] })
      .catch(() => ({ features: [] }))
  ]).then(([poisGj, manzGj]) => ({ cusec, poisGj, manzGj })));
  const results = await Promise.all(fetches);
  const out = [];
  for (const { cusec, poisGj, manzGj } of results) {
    // Pre-compute manzana rings + bbox for fast PIP.
    const manzPolys = [];
    for (const mf of manzGj.features || []) {
      const id = mf.properties?.id;
      if (id == null) continue;
      const ring = _outerRing(mf.geometry);
      if (!ring) continue;
      manzPolys.push({ id, ring, bbox: _ringBbox(ring) });
    }
    for (const f of poisGj.features || []) {
      const p = f.properties || {};
      const name = (p.name || "").trim();
      if (!name) continue;
      const pt = f.geometry?.coordinates;
      if (!pt || pt.length < 2) continue;
      const manzanaId = _findContainingManzana(pt, manzPolys);
      if (manzanaId == null) continue;   // POI fuera de cualquier manzana — saltamos
      out.push({
        name,
        category: p.category || "",
        // pois.geojson no carga building_id propio; usamos osm_id como
        // hint para el hook onBuildingTap. La capa cívica puede ignorarlo
        // si no le sirve.
        building_id: p.osm_id || null,
        manzana_id: manzanaId,
        cusec,
        barrio_id: barrio.barrioId
      });
    }
  }
  if (out.length > MAX_POIS_PER_BARRIO) {
    console.warn(`[search] barrio ${barrio.barrioId}: ${out.length} POIs, truncado a ${MAX_POIS_PER_BARRIO}`);
    out.length = MAX_POIS_PER_BARRIO;
  }
  _barrioPoisCache.set(barrio.barrioId, out);
  return out;
}

function _outerRing(geom) {
  if (!geom) return null;
  if (geom.type === "Polygon") return geom.coordinates?.[0] || null;
  if (geom.type === "MultiPolygon") return geom.coordinates?.[0]?.[0] || null;
  return null;
}

function _ringBbox(ring) {
  let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
  for (const [x, y] of ring) {
    if (x < mnx) mnx = x; if (x > mxx) mxx = x;
    if (y < mny) mny = y; if (y > mxy) mxy = y;
  }
  return [mnx, mny, mxx, mxy];
}

function _pointInRing(pt, ring) {
  const [x, y] = pt;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function _findContainingManzana(pt, manzPolys) {
  const [x, y] = pt;
  for (const m of manzPolys) {
    const [a, b, c, d] = m.bbox;
    if (x < a || x > c || y < b || y > d) continue;
    if (_pointInRing(pt, m.ring)) return m.id;
  }
  return null;
}
