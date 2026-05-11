// KOINOS · POLIS — orquestador del runtime web v0.3 (navegación jerárquica
// isla → municipio → distrito → sección).
//
// Niveles (v1.5):
//   - "isla":      Gran Canaria como tablero de 21 muns (top-down puro).
//   - "municipio": un mun con sus N secciones (top-down puro).
//   - "distrito":  un distrito (cusec dígitos 6-7) con todas sus secciones
//                  cargadas en paralelo y todos sus edificios en iso completa
//                  (Into the Breach). LOD interno: manzana ↔ edificios.
//   - "seccion":   el data pack de una sección concreta.
//
// La URL controla el nivel inicial:
//   ?cusec=3501602052           → nivel sección
//   ?level=distrito&distrito_id=01602  → nivel distrito (mun+dis)
//   ?mun=016                    → nivel municipio
//   (sin parámetros)            → nivel isla
//
// Cada nivel mantiene su `state.<nivel>` y `state.view<nivel>`. Las
// transiciones animan el view 0.5s ease-in-out antes del swap. El render
// loop delega en renderIsla / renderMunicipio / renderDistrito /
// renderSeccion según state.lodLevel.

import { fitView, project, pointInScreenPolygon, ringCentroid, ringBbox,
         lnglatToLocalMeters, projectFeatureRing }
  from "./iso.js";
import { simplifyRing, outerRing, annotateDepth, sortByDepth }
  from "./clustering.js";
import { loadCatalog, classify } from "./archetypes.js";
import { render } from "./renderer.js";
import { attach } from "./interaction.js";

const DEFAULT_CUSEC = "3501602052";
const SONGKICK_ANCHOR_ID = 24;
const N_BLOQUEADAS = 10;

// Proyección equirect local: metros relativos al centroide de GC.
const GC_ANCHOR_LNGLAT = [-15.55, 28.05];

// State global. Una caja con todos los datos cargados.
const state = {
  lodLevel: "isla",
  isla: null,        // { municipios: [...features con _ringMeters], bbox }
  municipio: null,   // { mun, nmun, secciones: [...], polygon, bbox,
                     //   districts: Map<dis, {dis, distritoId, secciones[],
                     //   bbox, sectionCount}> }
  district: null,    // { distritoId, dis, mun, nmun, secciones, bbox,
                     //   sectionPacks: Map<cusec, packPreprocesado>,
                     //   buildings, manzanas, totalBuildings, _slide:{...} }
  section: null,     // (data pack v1)
  view: null,
  initialView: null,
  selectedManzanaId: null,
  hoverFeature: null,
  dpr: window.devicePixelRatio || 1,
  catalog: null,
  // animación de transición de view
  _anim: null,       // { from, to, t0, duration, onDone }
  // animación de slide horizontal entre distritos
  _slideAnim: null,  // { dx, t0, duration, onDone }
  _renderQueued: false,
  // v1.5.1: pila de viewports por nivel padre. Cuando navegamos forward
  // (isla→municipio, municipio→distrito, distrito→sección) guardamos
  // aquí el snapshot del viewport del nivel padre. Al hacer back lo
  // restauramos con animación inversa, en lugar del salto a fitView.
  // key = lodLevel del padre ("isla"|"municipio"|"distrito"); value =
  // { view: { scale, cx, cy, tx, ty, ax, ay, sz_factor,
  //          minScale, maxScale, fitScale } }
  viewportStack: {},

  // v1.5.3 — Indicadores cívicos (hook para la capa Next.js / Supabase).
  //
  // El HUD consume este objeto en renderer.renderHud(). La app web no los
  // rellena por sí misma — quedan a cero / null hasta que el código
  // externo (componente Next.js) llame a
  // `window.polisApp.setIndicators({...})`. Documentado en
  // docs/RUNTIME.md §Integración con la capa cívica.
  //
  // Shape acordado con el chat polis (ver docs/notebook/06_POLIS_GAME.md):
  //   zone:     stats agregadas de la zona/distrito visible
  //   user:     stats del jugador (badges, calibraciones)
  //   realtime: estado en tiempo real (eventos, residentes registrables)
  indicators: {
    zone: {
      discovered_pct: 0,
      identified_pct: 0,
      calibrated_pct: 0,
      total_buildings: 0
    },
    user: {
      badges_count: 0,
      materials_found: 0,
      last_calibration_at: null
    },
    realtime: {
      events_live: 0,
      registered_residents: 0
    }
  }
};

const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");
state._lodPillEl = document.getElementById("lod-pill");

// -----------------------------------------------------------
// Carga inicial: catálogo + isla. Determina nivel según URL.

async function boot() {
  state.catalog = await loadCatalog("../catalog/archetypes.json");
  // Carga isla: la necesitamos para todos los niveles (centroides).
  await loadIsla();

  const params = new URLSearchParams(window.location.search);
  const cusec = params.get("cusec");
  const mun = params.get("mun");
  const level = params.get("level");
  const distritoId = params.get("distrito_id");

  sizeCanvas();
  bindUI();
  attach(canvas, state, requestRender, handleTap, handleSwipe);

  // _bootstrapping evita que cada paso del arranque empuje al history.
  state._bootstrapping = true;
  if (cusec) {
    const munCode = cusec.slice(2, 5);
    const disCode = cusec.slice(5, 7);
    await enterMunicipio(munCode, /*animate*/ false);
    await enterDistrito(munCode + disCode, /*animate*/ false);
    await enterSeccion(cusec, /*animate*/ false);
  } else if (level === "distrito" && distritoId) {
    const munCode = distritoId.slice(0, 3);
    await enterMunicipio(munCode, /*animate*/ false);
    await enterDistrito(distritoId, /*animate*/ false);
  } else if (mun) {
    await enterMunicipio(mun.replace(/^35/, ""), /*animate*/ false);
  } else {
    enterIsla(/*animate*/ false);
  }
  state._bootstrapping = false;
  // Reemplaza la entrada inicial del history con el estado actual real
  // para que tras una navegación back se sepa dónde "estaba" el usuario.
  updateUrl({ replace: true });
  updateBackButton();

  setTimeout(() => document.getElementById("loader").classList.add("hidden"), 50);
}

// -----------------------------------------------------------
// Carga de datos por nivel.

async function loadIsla() {
  const url = "../gc-municipios-poly.json";
  const fc = await fetch(url).then(r => r.json());
  const municipios = [];
  for (const f of fc.features) {
    const ring = outerRing(f.geometry);
    if (!ring) continue;
    // Proyecta lng/lat a metros locales (anclados al centro de GC).
    const ringM = ring.map(([lng, lat]) =>
      lnglatToLocalMeters(lng, lat, GC_ANCHOR_LNGLAT));
    f._ring = ringM;
    f._ringSimple = simplifyRing(ringM, 30); // 30m tol → polígonos isla
    f._centroid = ringCentroid(ringM);
    annotateDepth(f);
    municipios.push(f);
  }
  const sorted = sortByDepth(municipios);
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const m of municipios) {
    const [a, b, c, d] = ringBbox(m._ring);
    if (a < minx) minx = a; if (b < miny) miny = b;
    if (c > maxx) maxx = c; if (d > maxy) maxy = d;
  }
  state.isla = {
    municipios: sorted,
    bbox: [minx, miny, maxx, maxy]
  };

  // Estadísticas para coloreado por densidad (sections_count).
  const counts = municipios.map(m => m.properties.sections_count);
  counts.sort((a, b) => a - b);
  state.isla.t1 = counts[Math.floor(counts.length / 3)];
  state.isla.t2 = counts[Math.floor(counts.length * 2 / 3)];
}

// v1.5.2: detecta municipios vecinos (heurística rápida sin shapely).
// Criterio: distancia entre centroides < threshold (basado en tamaño del
// propio mun) + intersección de bbox expandidos. Devuelve los features
// vecinos (ya con _ring, _ringSimple, _centroid anotados) de state.isla.
function findMunicipioNeighbors(munFeat) {
  const [a0, b0, a1, b1] = ringBbox(munFeat._ring);
  const w = a1 - a0, h = b1 - b0;
  const expand = Math.max(w, h) * 0.25;  // buffer 25% del tamaño del mun
  const [exa0, exb0, exa1, exb1] = [a0 - expand, b0 - expand,
                                     a1 + expand, b1 + expand];
  const neighbors = [];
  for (const m of state.isla.municipios) {
    if (m.properties.mun === munFeat.properties.mun) continue;
    const [oa0, ob0, oa1, ob1] = ringBbox(m._ring);
    // bbox-bbox intersection con buffer
    if (oa1 < exa0 || oa0 > exa1 || ob1 < exb0 || ob0 > exb1) continue;
    neighbors.push(m);
  }
  return neighbors;
}

async function loadMunicipio(mun) {
  // Polígono del mun
  const munFeat = state.isla.municipios.find(f => f.properties.mun === mun);
  if (!munFeat) throw new Error(`mun ${mun} no encontrado`);
  // Secciones: filtramos gc-secciones-lite por mun
  const secciones = await fetch("../gc-secciones-lite.json").then(r => r.json());
  // Manifest para sacar building_count por sección
  const manifest = await fetch("../sections_pack/manifest.json").then(r => r.json());
  const buildingsByCusec = new Map();
  for (const s of manifest.sections) buildingsByCusec.set(s.cusec, s.buildings);

  const out = [];
  for (const f of secciones.features) {
    if (f.properties.mun !== mun) continue;
    const ring = outerRing(f.geometry);
    if (!ring) continue;
    const ringM = ring.map(([lng, lat]) =>
      lnglatToLocalMeters(lng, lat, GC_ANCHOR_LNGLAT));
    f._ring = ringM;
    f._ringSimple = simplifyRing(ringM, 6);
    f._centroid = ringCentroid(ringM);
    f._buildingCount = buildingsByCusec.get(f.properties.cusec) || 0;
    annotateDepth(f);
    out.push(f);
  }
  const sorted = sortByDepth(out);

  // bbox = bbox del polígono del mun en metros
  const [bxa, bxb, bxc, bxd] = ringBbox(munFeat._ring);

  // Agrupa secciones por distrito (cusec dígitos 6-7).
  const districts = new Map();
  for (const s of out) {
    const cs = s.properties.cusec;
    const dis = cs.slice(5, 7);
    const distritoId = mun + dis;
    if (!districts.has(distritoId)) {
      districts.set(distritoId, {
        dis, distritoId, mun, nmun: munFeat.properties.nmun,
        secciones: [], bbox: null
      });
    }
    districts.get(distritoId).secciones.push(s);
  }
  // bbox de cada distrito = bbox unión de sus secciones (en metros locales
  // GC anchor); orden cíclico por código de distrito ascendente.
  const distList = [...districts.values()].sort((a, b) =>
    a.dis.localeCompare(b.dis));
  for (const d of distList) {
    let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
    for (const s of d.secciones) {
      const [a, b, c, e] = ringBbox(s._ring);
      if (a < mnx) mnx = a; if (b < mny) mny = b;
      if (c > mxx) mxx = c; if (e > mxy) mxy = e;
    }
    d.bbox = [mnx, mny, mxx, mxy];
    d.sectionCount = d.secciones.length;
  }

  return {
    mun,
    nmun: munFeat.properties.nmun,
    polygon: munFeat,
    secciones: sorted,
    bbox: [bxa, bxb, bxc, bxd],
    // Para coloreado por densidad
    bcStats: computeBcStats(out),
    // Distritos del municipio (Map distritoId → {dis, secciones, bbox, ...})
    districts,
    distList,  // lista ordenada cíclicamente
    // v1.5.2: vecinos colindantes para render + tap (mapa continuo)
    neighbors: findMunicipioNeighbors(munFeat)
  };
}

function computeBcStats(secs) {
  const counts = secs.map(s => s._buildingCount).filter(n => n > 0);
  if (!counts.length) return { t1: 0, t2: 0 };
  counts.sort((a, b) => a - b);
  return {
    t1: counts[Math.floor(counts.length / 3)],
    t2: counts[Math.floor(counts.length * 2 / 3)]
  };
}

// Carga las N secciones de un distrito (en paralelo) y normaliza todas
// las coordenadas al anchor GC (mismo sistema que isla/municipio). Esto
// permite que la vista distrito comparta el mismo "mundo" 2D que los
// niveles superiores y que la animación de slide entre distritos sea
// coherente.
async function loadDistrito(distritoId) {
  const mun = distritoId.slice(0, 3);
  const dis = distritoId.slice(3, 5);
  const munObj = state.municipio?.mun === mun
    ? state.municipio
    : await loadMunicipio(mun);
  const distrito = munObj.districts.get(distritoId);
  if (!distrito) throw new Error(`distrito ${distritoId} no encontrado`);

  // Loader visible mientras descargamos N packs.
  document.getElementById("banner-sub").textContent =
    `cargando distrito ${dis} · ${distrito.sectionCount} secciones…`;

  // Fetch de cada sección en paralelo. Tolerante a fallos puntuales.
  const sectionPromises = distrito.secciones.map(async (sFeat) => {
    const cusec = sFeat.properties.cusec;
    try {
      const base = `../sections_pack/${cusec}/`;
      const [meta, manzanasGj, buildingsGj, roadsGj] = await Promise.all([
        fetch(base + "meta.json").then(r => r.json()),
        fetch(base + "manzanas.geojson").then(r => r.json()),
        fetch(base + "buildings.geojson").then(r => r.json()),
        fetch(base + "roads.geojson").then(r => r.json())
      ]);
      return preprocessSectionForDistrict(cusec, meta, manzanasGj,
                                           buildingsGj, roadsGj);
    } catch (e) {
      console.warn(`distrito ${distritoId}: fallo cargando ${cusec}`, e);
      return null;
    }
  });
  const sectionPacks = (await Promise.all(sectionPromises)).filter(Boolean);

  // Aplanar manzanas + edificios + roads en arrays únicos del distrito.
  let buildings = [], manzanas = [], roads = [];
  let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
  for (const sp of sectionPacks) {
    for (const m of sp.manzanas) manzanas.push(m);
    for (const b of sp.buildings) buildings.push(b);
    for (const r of sp.roads) roads.push(r);
    const [a, b, c, e] = sp._bbox;
    if (a < mnx) mnx = a; if (b < mny) mny = b;
    if (c > mxx) mxx = c; if (e > mxy) mxy = e;
  }
  const buildingsSorted = sortByDepth(buildings);
  const manzanasSorted = sortByDepth(manzanas);

  // v1.5.1: estadísticas de densidad por sección dentro del distrito,
  // para colorear los polígonos-sección del entry zoom (paso 1 LOD).
  // Tres terciles → paleta cálida 3 niveles (sand / ocre_lt / ocre).
  const bcArr = distrito.secciones.map(s => s._buildingCount).filter(n => n > 0);
  bcArr.sort((a, b) => a - b);
  const secStats = {
    t1: bcArr[Math.floor(bcArr.length / 3)] || 0,
    t2: bcArr[Math.floor(bcArr.length * 2 / 3)] || 0
  };

  // Bbox del distrito (en metros GC) calculado de la unión de las
  // secciones; sirve como contorno de referencia (ink 6px) — paso 1.
  let dnx = Infinity, dny = Infinity, dxx = -Infinity, dxy = -Infinity;
  for (const s of distrito.secciones) {
    const [a, b, c, e] = ringBbox(s._ring);
    if (a < dnx) dnx = a; if (b < dny) dny = b;
    if (c > dxx) dxx = c; if (e > dxy) dxy = e;
  }
  // Anillo del bbox como pseudo-contorno externo del distrito.
  const districtOutline = [
    [dnx, dny], [dxx, dny], [dxx, dxy], [dnx, dxy], [dnx, dny]
  ];

  // v1.5.2 — vecinos distritales: los demás distritos del mismo municipio.
  // Ya están cargados en `munObj.distList`; sólo necesitamos referenciar
  // sus secciones (mismo sistema de coordenadas anchor GC).
  const neighborDistricts = munObj.distList
    .filter(d => d.distritoId !== distritoId)
    .map(d => ({ distritoId: d.distritoId, dis: d.dis,
                 mun: d.mun, secciones: d.secciones, bbox: d.bbox }));

  return {
    distritoId,
    dis,
    mun,
    nmun: distrito.nmun,
    secciones: distrito.secciones,
    sectionPacks,
    buildings: buildingsSorted,
    manzanas: manzanasSorted,
    roads,
    bbox: [mnx, mny, mxx, mxy],
    totalBuildings: buildings.length,
    sectionCount: sectionPacks.length,
    // v1.5.1 — datos para el paso 1 del LOD triple
    secStats,
    districtOutline,
    // v1.5.2 — vecinos para render + tap (mapa continuo)
    neighborDistricts,
    munObj   // referencia al municipio (vecinos del nivel sección)
  };
}

// Procesa una sección para integración en el distrito: convierte sus
// coords locales (anchor centroide de la propia sección) al anchor GC.
function preprocessSectionForDistrict(cusec, meta, manzanasGj, buildingsGj,
                                      roadsGj) {
  const lng0 = meta.enu_basis?.lng0 ?? meta.centroid_lnglat[0];
  const lat0 = meta.enu_basis?.lat0 ?? meta.centroid_lnglat[1];
  // Conversión: local de sección (m) → lng/lat → local GC (m)
  // x_sec = (lng - lng0) * M_LNG_local        ⇒  lng = lng0 + x_sec / M_LNG_local
  // z_sec = -(lat - lat0) * M_LAT             ⇒  lat = lat0 - z_sec / M_LAT
  const M_LAT = 111132.0;
  const M_LNG_LOCAL = 111320.0 * Math.cos(lat0 * Math.PI / 180);
  const ANCH = GC_ANCHOR_LNGLAT;
  const M_LNG_GC = 111320.0 * Math.cos(ANCH[1] * Math.PI / 180);
  function reproject([x, z]) {
    const lng = lng0 + x / M_LNG_LOCAL;
    const lat = lat0 - z / M_LAT;
    const xg = (lng - ANCH[0]) * M_LNG_GC;
    const zg = -(lat - ANCH[1]) * M_LAT;
    return [xg, zg];
  }

  const manzanas = [];
  for (const f of manzanasGj.features) {
    const ring = outerRing(f.geometry);
    if (!ring) continue;
    const reringed = ring.map(reproject);
    f._ring = reringed;
    f._ringSimple = simplifyRing(reringed, 1.8);
    f._centroid = ringCentroid(reringed);
    f._cusec = cusec;
    annotateDepth(f);
    manzanas.push(f);
  }

  const buildings = [];
  for (const f of buildingsGj.features) {
    const ring = outerRing(f.geometry);
    if (!ring) continue;
    const reringed = ring.map(reproject);
    f._ring = reringed;
    f._centroid = ringCentroid(reringed);
    f._cusec = cusec;
    annotateDepth(f);
    const area = polygonArea(reringed);
    f._archetype = classify(f.properties, area);
    buildings.push(f);
  }

  const roads = [];
  for (const f of roadsGj.features) {
    if (!f.geometry || f.geometry.type !== "LineString") continue;
    const line = f.geometry.coordinates.map(reproject);
    roads.push({ type: f.properties?.type || "residential", line });
  }

  let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
  for (const m of manzanas) {
    const [a, b, c, e] = ringBbox(m._ring);
    if (a < mnx) mnx = a; if (b < mny) mny = b;
    if (c > mxx) mxx = c; if (e > mxy) mxy = e;
  }

  return { cusec, meta, manzanas, buildings, roads,
           _bbox: [mnx, mny, mxx, mxy] };
}

// v1.5.2: construye la estructura de "sección activa" reutilizando el
// sectionPack ya reproyectado al anchor GC en loadDistrito. Necesario
// para que la sección y sus vecinas (state.district.secciones) compartan
// sistema de coordenadas y los vecinos sean clicables.
function buildSeccionFromDistrictPack(pack) {
  const manzanas = pack.manzanas.map(f => f);  // ya tienen _ring, _ringSimple, _centroid
  // Anotar simpleRing por si falta (sí está, pero idempotente)
  for (const m of manzanas) {
    if (!m._ringSimple) m._ringSimple = simplifyRing(m._ring, 1.8);
  }
  // Bloqueadas: las N con menor building_count (mismo criterio que preprocessSection)
  const byCount = manzanas.slice().sort((a, b) => {
    const ca = a.properties.building_count || 0;
    const cb = b.properties.building_count || 0;
    if (ca !== cb) return ca - cb;
    return (b.properties.area_m2 || 0) - (a.properties.area_m2 || 0);
  });
  const bloqIds = new Set(byCount.slice(0, N_BLOQUEADAS).map(m => m.properties.id));

  const buildings = pack.buildings.map(f => f);

  // Bbox de la sección (en anchor GC)
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const m of manzanas) {
    const [a, b, c, d] = ringBbox(m._ring);
    if (a < minx) minx = a; if (b < miny) miny = b;
    if (c > maxx) maxx = c; if (d > maxy) maxy = d;
  }

  // POIs by manzana: no se reproyectaron en loadDistrito, así que devolvemos vacío.
  // Para la card Songkick basta con elegir un anchor entre las manzanas.
  const poisByManz = new Map();

  // roads: los del pack vienen como {type, line} en coords GC. Para el
  // renderSeccion las espera con f.geometry.coordinates y f.properties.type
  // — adaptamos al formato común.
  const roads = pack.roads.map(r => ({
    geometry: { type: "LineString", coordinates: r.line },
    properties: { type: r.type }
  }));

  return {
    meta: pack.meta,
    manzanas,
    buildings,
    roads,
    pois: [],
    _bloqIds: bloqIds,
    _bbox: [minx, miny, maxx, maxy],
    _songkickAnchorId: manzanas.find(m => m.properties.id === SONGKICK_ANCHOR_ID)
      ? SONGKICK_ANCHOR_ID
      : (manzanas[Math.floor(manzanas.length / 2)]?.properties.id ?? null),
    _poisByManz: poisByManz
  };
}

async function loadSeccion(cusec) {
  const base = `../sections_pack/${cusec}/`;
  const [meta, manzanasGj, buildingsGj, roadsGj, poisGj] = await Promise.all([
    fetch(base + "meta.json").then(r => r.json()),
    fetch(base + "manzanas.geojson").then(r => r.json()),
    fetch(base + "buildings.geojson").then(r => r.json()),
    fetch(base + "roads.geojson").then(r => r.json()),
    fetch(base + "pois.geojson").then(r => r.json()).catch(() => ({features: []}))
  ]);
  return preprocessSection(meta, manzanasGj, buildingsGj, roadsGj, poisGj);
}

function preprocessSection(meta, manzanasGj, buildingsGj, roadsGj, poisGj) {
  const manzanas = [];
  for (const f of manzanasGj.features) {
    const ring = outerRing(f.geometry);
    if (!ring) continue;
    f._ring = ring;
    f._ringSimple = simplifyRing(ring, 1.8);
    f._centroid = ringCentroid(ring);
    annotateDepth(f);
    manzanas.push(f);
  }
  const manzanasSorted = sortByDepth(manzanas);

  const byCount = manzanas.slice().sort((a, b) => {
    const ca = a.properties.building_count || 0;
    const cb = b.properties.building_count || 0;
    if (ca !== cb) return ca - cb;
    return (b.properties.area_m2 || 0) - (a.properties.area_m2 || 0);
  });
  const bloqIds = new Set(byCount.slice(0, N_BLOQUEADAS).map(m => m.properties.id));

  const buildings = [];
  for (const f of buildingsGj.features) {
    const ring = outerRing(f.geometry);
    if (!ring) continue;
    f._ring = ring;
    f._centroid = ringCentroid(ring);
    annotateDepth(f);
    const area = polygonArea(ring);
    f._archetype = classify(f.properties, area);
    buildings.push(f);
  }
  const buildingsSorted = sortByDepth(buildings);

  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const m of manzanas) {
    const [a, b, c, d] = ringBbox(m._ring);
    if (a < minx) minx = a; if (b < miny) miny = b;
    if (c > maxx) maxx = c; if (d > maxy) maxy = d;
  }

  const poisByManz = new Map();
  for (const p of poisGj.features) {
    const [px, pz] = p.geometry.coordinates;
    for (const m of manzanas) {
      if (worldPointInRing(px, pz, m._ring)) {
        const id = m.properties.id;
        poisByManz.set(id, (poisByManz.get(id) || 0) + 1);
        break;
      }
    }
  }

  return {
    meta,
    manzanas: manzanasSorted,
    buildings: buildingsSorted,
    roads: roadsGj.features,
    pois: poisGj.features,
    _bloqIds: bloqIds,
    _bbox: [minx, miny, maxx, maxy],
    _songkickAnchorId: manzanas.find(m => m.properties.id === SONGKICK_ANCHOR_ID)
      ? SONGKICK_ANCHOR_ID
      : (manzanas[Math.floor(manzanas.length / 2)]?.properties.id ?? null),
    _poisByManz: poisByManz
  };
}

function polygonArea(ring) {
  let s = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    s += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return Math.abs(s) / 2;
}

function worldPointInRing(px, pz, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = ((yi > pz) !== (yj > pz)) &&
                      (px < ((xj - xi) * (pz - yi)) / (yj - yi + 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// -----------------------------------------------------------
// Viewport stack — v1.5.1.
//
// Cada vez que el usuario hace navegación forward (isla → mun, mun →
// distrito, distrito → sección) guardamos un snapshot del viewport del
// nivel padre. Al hacer back restauramos exactamente ese viewport con
// animación 500ms ease-in-out. Esto sustituye el "teleport" a fitView
// que producía la sensación rara que reportaba Pancho.
//
// Si no hay viewport guardado (deep link, primer arranque) caemos al
// fitView del nivel actual como fallback.

function snapshotViewport() {
  const v = state.view;
  if (!v) return null;
  return {
    scale: v.scale, minScale: v.minScale, maxScale: v.maxScale,
    fitScale: v.fitScale,
    cx: v.cx, cy: v.cy,
    tx: v.tx, ty: v.ty,
    ax: v.ax, ay: v.ay, sz_factor: v.sz_factor
  };
}

function saveParentViewport(parentLevel) {
  // Sólo guardamos durante navegación forward "real" (no bootstrap,
  // no pop). Si volvemos a un nivel ya visitado entrando hacia adelante
  // (por deep link p.ej.) sobrescribimos — siempre vale el último.
  if (state._bootstrapping || state._navigatingFromPop) return;
  const snap = snapshotViewport();
  if (snap) state.viewportStack[parentLevel] = { view: snap };
}

function consumeViewportFor(level) {
  // Al volver atrás: si hay snapshot guardado para `level`, lo usamos
  // como target del viewport. Una vez consumido, lo borramos: si el
  // usuario vuelve a entrar a ese nivel debe ser una navegación nueva.
  const saved = state.viewportStack[level];
  if (!saved) return null;
  delete state.viewportStack[level];
  return saved.view;
}

// -----------------------------------------------------------
// Entrar a cada nivel.
//
// El parámetro opcional `restoreView` (objeto viewport) fuerza al
// nivel a animar hacia ese viewport (usado por la restauración de back).
// Si no se pasa, se calcula `fitView` para el bbox del nivel.

function applyNewView(newView, animate, onDone) {
  if (animate && state.view) {
    animateView(state.view, newView, 500, () => {
      state.view = newView;
      state.initialView = { cx: newView.cx, cy: newView.cy, scale: newView.scale };
      if (onDone) onDone();
      requestRender();
    });
  } else {
    state.view = newView;
    state.initialView = { cx: newView.cx, cy: newView.cy, scale: newView.scale };
    if (onDone) onDone();
  }
}

function enterIsla(animate = true, restoreView = null) {
  // Guarda el viewport del nivel padre actual antes del swap (forward).
  if (state.lodLevel !== "isla") saveParentViewport(state.lodLevel);

  state.lodLevel = "isla";
  state.municipio = null;
  state.district = null;
  state.section = null;
  state.selectedManzanaId = null;
  state.hoverFeature = null;
  closeSidePanel();

  const fitNew = fitView(state.isla.bbox,
                         window.innerWidth, window.innerHeight, 90, "isla");
  const newView = restoreView ? mergeRestoredView(fitNew, restoreView) : fitNew;
  applyNewView(newView, animate);

  updateBreadcrumb();
  updateBannerSub();
  updateDistLabel();
  updateSideButtons();
  if (!state._bootstrapping && !state._navigatingFromPop) {
    updateUrl();
  } else {
    updateBackButton();
  }
  requestRender();
}

async function enterMunicipio(mun, animate = true, restoreView = null) {
  if (state.lodLevel !== "municipio") saveParentViewport(state.lodLevel);

  document.getElementById("banner-sub").textContent = `cargando municipio ${mun}…`;
  state.municipio = await loadMunicipio(mun);
  state.lodLevel = "municipio";
  state.district = null;
  state.section = null;
  state.selectedManzanaId = null;
  state.hoverFeature = null;
  closeSidePanel();

  const fitNew = fitView(state.municipio.bbox,
                         window.innerWidth, window.innerHeight, 90, "municipio");
  const newView = restoreView ? mergeRestoredView(fitNew, restoreView) : fitNew;
  applyNewView(newView, animate);

  updateBreadcrumb();
  updateBannerSub();
  updateDistLabel();
  updateSideButtons();
  if (!state._bootstrapping && !state._navigatingFromPop) {
    updateUrl();
  } else {
    updateBackButton();
  }
  requestRender();
}

async function enterDistrito(distritoId, animate = true, restoreView = null) {
  if (state.lodLevel !== "distrito") saveParentViewport(state.lodLevel);

  document.getElementById("banner-sub").textContent =
    `cargando distrito ${distritoId}…`;
  state.district = await loadDistrito(distritoId);
  state.lodLevel = "distrito";
  state.section = null;
  state.selectedManzanaId = null;
  state.hoverFeature = null;
  closeSidePanel();

  const fitNew = fitView(state.district.bbox,
                         window.innerWidth, window.innerHeight, 90, "distrito");
  const newView = restoreView ? mergeRestoredView(fitNew, restoreView) : fitNew;
  applyNewView(newView, animate);

  updateBreadcrumb();
  updateBannerSub();
  updateDistLabel();
  updateSideButtons();
  if (!state._bootstrapping && !state._navigatingFromPop) {
    updateUrl();
  } else {
    updateBackButton();
  }
  requestRender();
}

async function enterSeccion(cusec, animate = true, restoreView = null) {
  if (state.lodLevel !== "seccion") saveParentViewport(state.lodLevel);

  document.getElementById("banner-sub").textContent = `cargando sección ${cusec}…`;
  // v1.5.2: si venimos del distrito (state.district cargado), reutilizamos
  // el sectionPack reproyectado a anchor GC para que las coords de la
  // sección coincidan con las de sus vecinas (state.district.secciones).
  // Esto permite renderizar vecinos sin re-reproyectar.
  if (state.district?.sectionPacks?.length) {
    const pack = state.district.sectionPacks.find(p => p.cusec === cusec);
    if (pack) {
      state.section = buildSeccionFromDistrictPack(pack);
    } else {
      state.section = await loadSeccion(cusec);
    }
  } else {
    state.section = await loadSeccion(cusec);
  }
  state.lodLevel = "seccion";

  const fitNew = fitView(state.section._bbox,
                         window.innerWidth, window.innerHeight, 80, "seccion");
  const newView = restoreView ? mergeRestoredView(fitNew, restoreView) : fitNew;
  applyNewView(newView, animate);

  updateBreadcrumb();
  updateBannerSub();
  updateDistLabel();
  updateSideButtons();
  if (!state._bootstrapping && !state._navigatingFromPop) {
    updateUrl();
  } else {
    updateBackButton();
  }
  requestRender();
}

// Combina un viewport snapshot guardado con el fitView "fresco" del
// nivel actual. La idea: heredamos minScale/maxScale/fitScale del
// nuevo cálculo (por si la ventana se redimensionó entre forward y
// back) pero sustituimos scale + pan + ángulos con los del snapshot
// para preservar lo que el usuario tenía.
function mergeRestoredView(fitNew, snap) {
  return {
    scale: snap.scale,
    minScale: fitNew.minScale,
    maxScale: fitNew.maxScale,
    fitScale: fitNew.fitScale,
    cx: snap.cx, cy: snap.cy,
    tx: snap.tx, ty: snap.ty,
    ax: snap.ax, ay: snap.ay, sz_factor: snap.sz_factor
  };
}

// Animación de view: interpola scale, cx, cy, tx, ty, fitScale, etc.
function animateView(from, to, duration, onDone) {
  state._anim = { from: { ...from }, to: { ...to }, t0: performance.now(),
                  duration, onDone };
  step();
  function step() {
    const a = state._anim;
    if (!a) return;
    const t = (performance.now() - a.t0) / a.duration;
    const k = t >= 1 ? 1 : easeInOut(t);
    state.view = {
      scale: lerp(a.from.scale, a.to.scale, k),
      minScale: lerp(a.from.minScale, a.to.minScale, k),
      maxScale: lerp(a.from.maxScale, a.to.maxScale, k),
      fitScale: lerp(a.from.fitScale, a.to.fitScale, k),
      cx: lerp(a.from.cx, a.to.cx, k),
      cy: lerp(a.from.cy, a.to.cy, k),
      tx: lerp(a.from.tx, a.to.tx, k),
      ty: lerp(a.from.ty, a.to.ty, k),
      // Interpolación de ángulos para que la cámara rote suavemente
      // entre niveles (top-down isla → iso ligera mun → iso seccion).
      ax: lerp(a.from.ax ?? 30, a.to.ax ?? 30, k),
      ay: lerp(a.from.ay ?? 30, a.to.ay ?? 30, k),
      sz_factor: lerp(a.from.sz_factor ?? 1.4, a.to.sz_factor ?? 1.4, k),
    };
    requestRender();
    if (t < 1) requestAnimationFrame(step);
    else {
      state._anim = null;
      if (a.onDone) a.onDone();
    }
  }
}
function easeInOut(t) { return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2; }
function lerp(a, b, t) { return a + (b - a) * t; }

// -----------------------------------------------------------
// UI

function updateBreadcrumb() {
  const el = document.getElementById("breadcrumb");
  el.innerHTML = "";
  const segs = [];
  segs.push({ label: "Gran Canaria", level: "isla" });
  if (state.lodLevel === "municipio" || state.lodLevel === "distrito" ||
      state.lodLevel === "seccion") {
    const nmun = state.municipio?.nmun
                 || state.district?.nmun
                 || state.isla.municipios.find(m => m.properties.mun ===
                     (state.section?.meta.mun || ""))?.properties.nmun
                 || "?";
    const munCode = state.municipio?.mun || state.district?.mun
                    || state.section?.meta.mun;
    segs.push({ label: shortName(nmun), level: "municipio", mun: munCode });
  }
  if (state.lodLevel === "distrito" || state.lodLevel === "seccion") {
    let dis = null, distritoId = null;
    if (state.lodLevel === "distrito") {
      dis = state.district.dis;
      distritoId = state.district.distritoId;
    } else if (state.section?.meta?.cusec) {
      dis = state.section.meta.cusec.slice(5, 7);
      distritoId = state.section.meta.cusec.slice(2, 7);
    }
    if (dis) {
      segs.push({ label: "Distrito " + dis, level: "distrito",
                  distritoId: distritoId });
    }
  }
  if (state.lodLevel === "seccion") {
    segs.push({ label: "Sección " + state.section.meta.cusec.slice(-3),
                level: "seccion", cusec: state.section.meta.cusec });
  }
  segs.forEach((s, i) => {
    if (i > 0) {
      const sep = document.createElement("span");
      sep.className = "bc-sep"; sep.textContent = "›";
      el.appendChild(sep);
    }
    const btn = document.createElement("button");
    btn.className = "bc-seg";
    btn.dataset.level = s.level;
    if (s.mun) btn.dataset.mun = s.mun;
    if (s.cusec) btn.dataset.cusec = s.cusec;
    if (s.distritoId) btn.dataset.distritoId = s.distritoId;
    btn.textContent = s.label;
    if (i === segs.length - 1) btn.classList.add("current");
    btn.addEventListener("click", () => onBreadcrumb(s));
    el.appendChild(btn);
  });
}

function onBreadcrumb(seg) {
  if (seg.level === state.lodLevel &&
      ((seg.level === "municipio" && seg.mun === state.municipio?.mun) ||
       (seg.level === "distrito" && seg.distritoId === state.district?.distritoId) ||
       (seg.level === "seccion" && seg.cusec === state.section?.meta.cusec) ||
        seg.level === "isla")) return;
  if (seg.level === "isla") enterIsla(true);
  else if (seg.level === "municipio") enterMunicipio(seg.mun, true);
  else if (seg.level === "distrito") enterDistrito(seg.distritoId, true);
  else if (seg.level === "seccion") enterSeccion(seg.cusec, true);
}

function shortName(nmun) {
  // Reduce nombres muy largos
  return nmun.replace("Palmas de Gran Canaria, Las", "LPGC")
             .replace("de Gran Canaria", "")
             .replace(", La", "")
             .replace(", Las", "")
             .trim();
}

function updateBannerSub() {
  const el = document.getElementById("banner-sub");
  if (state.lodLevel === "isla") {
    el.textContent = `Gran Canaria · ${state.isla.municipios.length} municipios`;
  } else if (state.lodLevel === "municipio") {
    el.textContent = `${shortName(state.municipio.nmun)} · ${state.municipio.secciones.length} secciones · ${state.municipio.distList.length} distritos`;
  } else if (state.lodLevel === "distrito") {
    const d = state.district;
    el.textContent = `Distrito ${d.dis} · ${d.sectionCount} secciones · ${d.totalBuildings.toLocaleString("es")} edif`;
  } else {
    const c = state.section.meta.cusec;
    el.textContent = `Sección ${c.slice(-3)} · ${state.section.manzanas.length} mz · ${state.section.buildings.length} edif`;
  }
}

// Etiqueta flotante con título descriptivo del distrito (sólo nivel distrito).
function updateDistLabel() {
  const el = document.getElementById("dist-label");
  if (!el) return;
  if (state.lodLevel === "distrito" && state.district) {
    const d = state.district;
    const nick = DISTRITO_NICKS[d.distritoId] || "";
    const tag = nick ? ` · ${nick}` : "";
    el.textContent = `Distrito ${d.dis}${tag} · ${d.sectionCount} secciones · ${d.totalBuildings.toLocaleString("es")} edificios`;
    el.classList.add("visible");
  } else {
    el.classList.remove("visible");
  }
}

// Apodos descriptivos de algunos distritos LPGC para la etiqueta flotante.
const DISTRITO_NICKS = {
  "01601": "Vegueta + Triana",
  "01602": "Las Canteras + Guanarteme",
  "01603": "Ciudad Alta + Schamann",
  "01604": "Tamaraceite + San Lorenzo",
  "01605": "Tafira + La Isleta sur"
};

// Visibilidad de los botones laterales ‹ › para navegar entre distritos.
function updateSideButtons() {
  const prev = document.getElementById("dist-prev");
  const next = document.getElementById("dist-next");
  if (!prev || !next) return;
  if (state.lodLevel === "distrito" && state.municipio?.distList?.length > 1) {
    prev.classList.add("visible");
    next.classList.add("visible");
  } else {
    prev.classList.remove("visible");
    next.classList.remove("visible");
  }
}

// pushState añade entrada al history del navegador. replace=true sobreescribe
// (para arranque inicial o navegación interna que no quiere apilar).
function updateUrl({ replace = false } = {}) {
  const u = new URL(window.location.href);
  u.searchParams.delete("mun");
  u.searchParams.delete("cusec");
  u.searchParams.delete("level");
  u.searchParams.delete("distrito_id");
  if (state.lodLevel === "municipio") {
    u.searchParams.set("mun", state.municipio.mun);
  } else if (state.lodLevel === "distrito") {
    u.searchParams.set("level", "distrito");
    u.searchParams.set("distrito_id", state.district.distritoId);
  } else if (state.lodLevel === "seccion") {
    u.searchParams.set("cusec", state.section.meta.cusec);
  }
  const stateObj = {
    lodLevel: state.lodLevel,
    mun: state.municipio?.mun ?? state.district?.mun ?? null,
    distritoId: state.district?.distritoId ?? null,
    cusec: state.section?.meta?.cusec ?? null,
  };
  if (replace) history.replaceState(stateObj, "", u.toString());
  else history.pushState(stateObj, "", u.toString());
  updateBackButton();
}

function updateBackButton() {
  const btn = document.getElementById("back-btn");
  if (!btn) return;
  if (state.lodLevel === "isla") btn.classList.remove("visible");
  else btn.classList.add("visible");
}

// El back lógico v1.5: sección → distrito (del cusec) ; distrito → municipio ;
// municipio → isla. Si no hay distrito (municipio con 1 distrito o sin cargar),
// la sección vuelve directamente al municipio.
//
// v1.5.1: si tenemos viewport guardado del nivel destino, lo pasamos como
// restoreView para que la animación de back sea el inverso visual de la
// forward (vuelta al zoom + pan original).
// Orden jerárquico para detectar si popstate es back (target más alto)
// o forward (target más profundo o lateral en cambio de distrito).
const LEVEL_DEPTH = { isla: 0, municipio: 1, distrito: 2, seccion: 3 };
function isBackNavigation(from, to) {
  return (LEVEL_DEPTH[to] ?? 0) < (LEVEL_DEPTH[from] ?? 0);
}

function navigateBack() {
  if (state.lodLevel === "seccion") {
    const cusec = state.section?.meta?.cusec;
    const mun = state.section?.meta?.mun || state.municipio?.mun;
    const distritoId = state.district?.distritoId
                       || (cusec ? cusec.slice(2, 7) : null);
    if (distritoId) {
      enterDistrito(distritoId, true, consumeViewportFor("distrito"));
    } else if (mun) {
      enterMunicipio(mun, true, consumeViewportFor("municipio"));
    } else {
      enterIsla(true, consumeViewportFor("isla"));
    }
  } else if (state.lodLevel === "distrito") {
    const mun = state.district?.mun || state.municipio?.mun;
    if (mun) enterMunicipio(mun, true, consumeViewportFor("municipio"));
    else enterIsla(true, consumeViewportFor("isla"));
  } else if (state.lodLevel === "municipio") {
    enterIsla(true, consumeViewportFor("isla"));
  }
  // En isla no hace nada (raíz).
}

function sizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  state.dpr = dpr;
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";
}

window.addEventListener("resize", () => {
  if (!state.view) return;
  sizeCanvas();
  requestRender();
});

function requestRender() {
  if (state._renderQueued) return;
  state._renderQueued = true;
  requestAnimationFrame(() => {
    state._renderQueued = false;
    render(ctx, state);
  });
}
state._requestRender = requestRender;

// -----------------------------------------------------------
// Tap por nivel.

function handleTap(px, py) {
  if (state._anim) return; // ignorar durante animación
  if (state._slideAnim) return;
  if (state.lodLevel === "isla") {
    for (let i = state.isla.municipios.length - 1; i >= 0; i--) {
      const m = state.isla.municipios[i];
      const ringPx = m._ringSimple.map(([x, z]) => project(x, 0, z, state.view));
      if (pointInScreenPolygon(px, py, ringPx)) {
        enterMunicipio(m.properties.mun, true);
        return;
      }
    }
  } else if (state.lodLevel === "municipio") {
    // v1.5: tap en una sección del municipio entra al distrito que la
    // contiene (no salta directo a la sección).
    for (let i = state.municipio.secciones.length - 1; i >= 0; i--) {
      const s = state.municipio.secciones[i];
      const ringPx = s._ringSimple.map(([x, z]) => project(x, 0, z, state.view));
      if (pointInScreenPolygon(px, py, ringPx)) {
        const cusec = s.properties.cusec;
        const distritoId = cusec.slice(2, 7); // mun(3)+dis(2)
        enterDistrito(distritoId, true);
        return;
      }
    }
    // v1.5.2 — tap sobre vecino municipio: animación slide lateral.
    const neigh = state.municipio.neighbors || [];
    for (const n of neigh) {
      const ringPx = n._ringSimple.map(([x, z]) => project(x, 0, z, state.view));
      if (pointInScreenPolygon(px, py, ringPx)) {
        slideToMunicipioNeighbor(n, px);
        return;
      }
    }
  } else if (state.lodLevel === "distrito") {
    // Tap en el distrito activo = entrar a la sección concreta.
    const secs = state.district.secciones;
    for (let i = secs.length - 1; i >= 0; i--) {
      const s = secs[i];
      const ringPx = s._ringSimple.map(([x, z]) => project(x, 0, z, state.view));
      if (pointInScreenPolygon(px, py, ringPx)) {
        enterSeccion(s.properties.cusec, true);
        return;
      }
    }
    // v1.5.2 — tap sobre distrito vecino: slide lateral al distrito.
    const neigh = state.district.neighborDistricts || [];
    for (const nd of neigh) {
      for (const s of nd.secciones) {
        const ringPx = s._ringSimple.map(([x, z]) =>
          project(x, 0, z, state.view));
        if (pointInScreenPolygon(px, py, ringPx)) {
          slideToDistritoNeighbor(nd, px);
          return;
        }
      }
    }
  } else if (state.lodLevel === "seccion") {
    const manzanas = state.section.manzanas;
    for (let i = manzanas.length - 1; i >= 0; i--) {
      const m = manzanas[i];
      const ringPx = m._ringSimple.map(([x, z]) => project(x, 0, z, state.view));
      if (pointInScreenPolygon(px, py, ringPx)) {
        selectManzana(m.properties.id);
        return;
      }
    }
    // v1.5.2 — tap sobre sección vecina: slide lateral a la sección.
    if (state.district) {
      const currentCusec = state.section?.meta?.cusec;
      for (const s of state.district.secciones) {
        if (s.properties.cusec === currentCusec) continue;
        const ringPx = s._ringSimple.map(([x, z]) =>
          project(x, 0, z, state.view));
        if (pointInScreenPolygon(px, py, ringPx)) {
          slideToSeccionNeighbor(s, px);
          return;
        }
      }
    }
    selectManzana(null);
  }
}

// v1.5.2 — slides laterales a vecinos.
//
// Determinamos la dirección (+1 o -1) según en qué lado del viewport
// quedó el tap: derecha → contenido sale a la izquierda (dir=+1), izq →
// sale a la derecha (dir=-1). Reutilizamos la maquinaria existente de
// state._slideAnim del renderer (out 300 ms + in 300 ms = 600 ms para
// distrito/municipio, 200+200 = 400 ms para sección).
function slideHorizontal(durationMs, dir, swapAsync) {
  const w = window.innerWidth;
  state._slideAnim = {
    phase: "out", dir, t0: performance.now(),
    duration: durationMs / 2, width: w
  };
  requestRender();
  const animateSlide = () => {
    const a = state._slideAnim;
    if (!a) return;
    const t = (performance.now() - a.t0) / a.duration;
    if (t < 1) {
      requestRender();
      requestAnimationFrame(animateSlide);
    } else if (a.phase === "out") {
      swapAsync().then(() => {
        state._slideAnim = {
          phase: "in", dir: a.dir, t0: performance.now(),
          duration: a.duration, width: w
        };
        requestRender();
        requestAnimationFrame(animateSlide);
      });
    } else {
      state._slideAnim = null;
      requestRender();
    }
  };
  requestAnimationFrame(animateSlide);
}

function slideToDistritoNeighbor(nd, tapX) {
  const w = window.innerWidth;
  const dir = tapX > w / 2 ? +1 : -1;
  slideHorizontal(600, dir, () => enterDistrito(nd.distritoId, false));
}

function slideToSeccionNeighbor(s, tapX) {
  const w = window.innerWidth;
  const dir = tapX > w / 2 ? +1 : -1;
  slideHorizontal(400, dir, () => enterSeccion(s.properties.cusec, false));
}

function slideToMunicipioNeighbor(munFeat, tapX) {
  const w = window.innerWidth;
  const dir = tapX > w / 2 ? +1 : -1;
  slideHorizontal(600, dir, () =>
    enterMunicipio(munFeat.properties.mun, false));
}

function selectManzana(id) {
  state.selectedManzanaId = id;
  const panel = document.getElementById("side-panel");
  if (id === null) {
    closeSidePanel();
  } else {
    const m = state.section.manzanas.find(mm => mm.properties.id === id);
    if (!m) return;
    document.getElementById("sp-title").textContent = `Manzana #${id}`;
    const body = document.getElementById("sp-body");
    const props = m.properties;
    const nPois = state.section._poisByManz.get(id) || 0;
    const isBloq = state.section._bloqIds.has(id);
    body.innerHTML = `
      <dt>Estado</dt>
      <dd style="color:${isBloq ? "#4A4D52" : "#C89968"}">${isBloq ? "Bloqueada" : "Recuperada"}</dd>
      <dt>Edificios</dt>
      <dd>${props.building_count ?? "—"}</dd>
      <dt>POIs en interior</dt>
      <dd>${nPois}</dd>
      <dt>Área</dt>
      <dd>${(props.area_m2 || 0).toFixed(0)} m²</dd>
      <dt>Altura mediana</dt>
      <dd>${(props.height_median_m || 0).toFixed(1)} m</dd>
    `;
    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
  }
  requestRender();
}

function closeSidePanel() {
  const panel = document.getElementById("side-panel");
  panel.classList.remove("open");
  panel.setAttribute("aria-hidden", "true");
}

// -----------------------------------------------------------
// Navegación lateral cíclica entre distritos del mismo municipio.
//
// Animación de slide horizontal 600 ms ease-in-out: pintamos el distrito
// actual desplazándolo fuera mientras el siguiente entra desde el lado
// opuesto. La interpolación se hace sobre `state._slideAnim.dx` que el
// renderer aplica como translate al canvas.

function gotoAdjacentDistrict(dir /* +1 (next) o -1 (prev) */) {
  if (state.lodLevel !== "distrito" || state._anim || state._slideAnim) return;
  const list = state.municipio?.distList;
  if (!list || list.length < 2) return;
  const curIdx = list.findIndex(d => d.distritoId === state.district.distritoId);
  if (curIdx < 0) return;
  const nextIdx = (curIdx + dir + list.length) % list.length;
  const nextDist = list[nextIdx];
  if (!nextDist) return;

  const w = window.innerWidth;
  // Fase 1 (300 ms): el actual se desliza fuera. dir=+1 (next) → sale a la
  // izquierda; dir=-1 (prev) → sale a la derecha.
  state._slideAnim = {
    phase: "out",
    dir,
    t0: performance.now(),
    duration: 300,
    width: w
  };
  requestRender();

  const animateSlide = () => {
    const a = state._slideAnim;
    if (!a) return;
    const t = (performance.now() - a.t0) / a.duration;
    if (t < 1) {
      requestRender();
      requestAnimationFrame(animateSlide);
    } else if (a.phase === "out") {
      // Cargar el siguiente distrito (sin animar el view) y arrancar fase in.
      enterDistrito(nextDist.distritoId, /*animate*/ false).then(() => {
        state._slideAnim = {
          phase: "in",
          dir: a.dir,
          t0: performance.now(),
          duration: 300,
          width: w
        };
        requestRender();
        requestAnimationFrame(animateSlide);
      });
    } else {
      state._slideAnim = null;
      requestRender();
    }
  };
  requestAnimationFrame(animateSlide);
}
state._gotoAdjacentDistrict = gotoAdjacentDistrict;

function handleSwipe(dx) {
  if (state.lodLevel !== "distrito") return;
  if (Math.abs(dx) < 60) return;
  gotoAdjacentDistrict(dx < 0 ? +1 : -1);
}

function bindUI() {
  document.getElementById("side-close").addEventListener("click", () =>
    selectManzana(null));

  document.getElementById("dist-prev").addEventListener("click", () =>
    gotoAdjacentDistrict(-1));
  document.getElementById("dist-next").addEventListener("click", () =>
    gotoAdjacentDistrict(+1));

  // Botón flotante "←": equivalente al back del navegador. Si hay
  // history.length, mejor disparar history.back() para que el back
  // físico y el lógico queden alineados.
  document.getElementById("back-btn").addEventListener("click", () => {
    if (window.history.length > 1) window.history.back();
    else navigateBack();
  });

  // popstate: el botón Atrás del navegador (o gesto deslizar de iOS).
  // Reproducimos el nivel guardado en history.state, sin volver a empujar
  // entradas (state._navigatingFromPop bloquea el push).
  //
  // v1.5.1: detectamos si el popstate es una navegación back "real" (el
  // nivel destino es más alto que el actual). En ese caso intentamos
  // restaurar el viewport guardado para el nivel destino. Las cargas
  // intermedias (ensureDistrict, etc.) usan animate=false para no
  // generar transiciones falsas — sólo el "swap" final anima.
  window.addEventListener("popstate", (e) => {
    const s = e.state;
    state._navigatingFromPop = true;
    const targetLevel = (!s || (!s.mun && !s.cusec && !s.distritoId))
      ? "isla" : s.lodLevel;
    const isBack = isBackNavigation(state.lodLevel, targetLevel);
    const restore = isBack ? consumeViewportFor(targetLevel) : null;

    if (!s || s.lodLevel === "isla" || (!s.mun && !s.cusec && !s.distritoId)) {
      enterIsla(true, restore);
    } else if (s.lodLevel === "seccion" && s.cusec) {
      const munCode = s.mun || s.cusec.slice(2, 5);
      const distritoId = s.distritoId || s.cusec.slice(2, 7);
      // Carga municipio + distrito si no están, luego sección.
      const ensureDistrict = state.district?.distritoId === distritoId
        ? Promise.resolve()
        : (state.municipio?.mun === munCode
            ? enterDistrito(distritoId, false)
            : enterMunicipio(munCode, false).then(() =>
                enterDistrito(distritoId, false)));
      ensureDistrict.then(() => enterSeccion(s.cusec, true, restore)).then(() => {
        state._navigatingFromPop = false;
      });
    } else if (s.lodLevel === "distrito" && s.distritoId) {
      const munCode = s.mun || s.distritoId.slice(0, 3);
      if (state.municipio?.mun !== munCode) {
        enterMunicipio(munCode, false).then(() =>
          enterDistrito(s.distritoId, true, restore).then(() => {
            state._navigatingFromPop = false;
          }));
      } else {
        enterDistrito(s.distritoId, true, restore).then(() => {
          state._navigatingFromPop = false;
        });
      }
    } else if (s.lodLevel === "municipio" && s.mun) {
      enterMunicipio(s.mun, true, restore).then(() => {
        state._navigatingFromPop = false;
      });
    } else {
      enterIsla(true, restore);
      state._navigatingFromPop = false;
    }
    // Para las navegaciones síncronas (enterIsla) liberamos el flag al final.
    setTimeout(() => { state._navigatingFromPop = false; }, 600);
  });
}

// -----------------------------------------------------------
// API pública para integración con la capa cívica (Next.js → polis-app).
//
// El chat polis está modelando el estado real de cada edificio en Supabase
// (descubierto/identificado/calibrado, badges del jugador, eventos vivos).
// Aquí dejamos los huecos para que cuando esa pieza esté lista, el
// componente Next.js que monte este runtime pueda inyectar valores sin
// tocar app.js. Snippet de uso en docs/RUNTIME.md §Integración con la
// capa cívica.
//
// `setIndicators(partial)` hace deep-merge de las tres ramas (zone, user,
// realtime) sobre `state.indicators` y dispara un repaint inmediato.

function deepMergeIndicators(target, partial) {
  if (!partial || typeof partial !== "object") return;
  for (const key of ["zone", "user", "realtime"]) {
    if (partial[key] && typeof partial[key] === "object") {
      Object.assign(target[key], partial[key]);
    }
  }
}

function setIndicators(newIndicators) {
  deepMergeIndicators(state.indicators, newIndicators);
  requestRender();
}

window.polisApp = window.polisApp || {};
window.polisApp.setIndicators = setIndicators;
window.polisApp.getIndicators = () => JSON.parse(JSON.stringify(state.indicators));
window.polisApp.state = state;  // sólo lectura recomendada — para debug

boot().catch(err => {
  console.error(err);
  document.getElementById("banner-sub").textContent = "error: " + err.message;
});
