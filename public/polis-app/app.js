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
  from "./iso.js?v=20260529-clamp";
import { simplifyRing, outerRing, annotateDepth, sortByDepth }
  from "./clustering.js";
import { loadCatalog, classify } from "./archetypes.js";
import { render } from "./renderer.js?v=20260529-drilldown";
import { attach } from "./interaction.js?v=20260525-swipeback";
import { initOverlays, setOverlayActive } from "./overlays/index.js?v=20260529-batch3";
import { TAXONOMIA, getVerbo, SECTOR_ESTADO, VERBO_ART } from "../shared/taxonomia.js?v=20260529b-lineart";
import { eventosOverlay } from "./overlays/eventos.js?v=20260521e";
import { productoresOverlay } from "./overlays/productores.js";
import { tejidoSocialOverlay } from "./overlays/tejido-social.js";
import { registroOverlay } from "./overlays/registro.js";
import { rentaOverlay } from "./overlays/renta.js";
// Nota: search.js se carga dinámicamente abajo (vía _loadSearchModule)
// con cache-buster por sesión. Esto sortea el cache de módulos ESM del
// navegador en development, donde editar search.js no siempre
// invalida el import estático. En producción con headers anti-cache
// no es necesario, pero no estorba.
let _searchModule = null;
async function _loadSearchModule() {
  if (_searchModule) return _searchModule;
  // Tag por session para que un reload del usuario fuerce nueva versión.
  const tag = (window.__POLIS_BUILD || (window.__POLIS_BUILD = Date.now()));
  _searchModule = await import("./search.js?v=" + tag);
  return _searchModule;
}
import { initDashboard, refreshDashboard, AMBITOS } from "./dashboard.js?v=20260521k";
import { recordGesto, getUserId, getAllGestos,
         REPORTES_POR_AMBITO, CATEGORIAS_ENTIDAD,
         VALIDADOR_LABELS,
         isAdmin, enableAdmin, disableAdmin,
         getRegistroDetallado, marcarFalso, amonestar,
         listarAmonestaciones,
         gestosDisponiblesPara } from "../shared/gestos.js?v=20260527a";

const DEFAULT_CUSEC = "3501602052";
const SONGKICK_ANCHOR_ID = 24;
const N_BLOQUEADAS = 10;

// Proyección equirect local: metros relativos al centroide de GC.
const GC_ANCHOR_LNGLAT = [-15.55, 28.05];

// 2026-05-19 — Unificamos anchor para todo Canarias. Mantenemos el valor
// histórico GC_ANCHOR_LNGLAT = [-15.55, 28.05] (overlays cívicos lo hard-
// codean) y proyectamos también las islas/muns no-GC contra ese mismo
// anchor. La consecuencia: Hierro/La Palma quedan en coords x muy
// negativas, pero fitView re-centra cada nivel y la geometría relativa
// es correcta. Sin esto, mun-rings y sec-rings podrían venir de anchors
// distintos y no alinearse.
const CANARIAS_ANCHOR_LNGLAT = [-15.55, 28.05];

// State global. Una caja con todos los datos cargados.
const state = {
  lodLevel: "archipielago",
  // 2026-05-19 — Nivel raíz nuevo: archipielago. Sus 7 islas se cargan
  // una vez desde canarias-islands-poly.json y se cachean aquí.
  archipielago: null, // { islands: [...features con _ringMeters], bbox }
  // Cache de las 88 features de municipio para TODO Canarias. Se carga
  // perezosamente la primera vez que se entra a un nivel isla/mun no GC
  // (o desde el dropdown del membrete a otra isla). Ver loadCanariasMuns().
  _canariasMuns: null,
  isla: null,        // { id, name, municipios: [...features con _ringMeters], bbox }
  municipio: null,   // { mun, nmun, secciones: [...], polygon, bbox,
                     //   districts: Map<dis, {dis, distritoId, secciones[],
                     //   bbox, sectionCount}> }
  district: null,    // { distritoId, dis, mun, nmun, secciones, bbox,
                     //   sectionPacks: Map<cusec, packPreprocesado>,
                     //   buildings, manzanas, totalBuildings, _slide:{...} }
  // v1.6.barrio — nivel paralelo al distrito (hijo directo del municipio).
  // Se modela con la MISMA forma que `district`: secciones, sectionPacks,
  // buildings, manzanas, bbox, totalBuildings… para que renderDistrito
  // (reutilizado) y los overlays cívicos (renta) funcionen sin cambios
  // estructurales. Campos extra propios del barrio: id, name, mun_name,
  // distrito_hint, centroid_lnglat.
  barrio: null,
  // v1.6.manzana (Phase 2b) — quinto nivel del LOD. Drill-down de una
  // sola manzana del barrio activo. Forma:
  //   { id: "<cusec>-<manzanaId>", manzanaId: <int>, cusec: <string>,
  //     feature: <manzanaFeature>, bbox_local_m: [...], buildings: [...] }
  // El id compuesto evita colisiones (manzana_id es un int local a la
  // sección; un barrio agrega N secciones que pueden compartir índices).
  manzana: null,
  // Tabla canonical barrio → cusecs (data/barrios-canonical.json,
  // 164 barrios prov 35). Cargada en boot. Nombre del campo conservado
  // como `barriosGc` por compatibilidad histórica con el resto del runtime.
  barriosGc: null,
  section: null,     // (data pack v1)
  view: null,
  initialView: null,
  selectedManzanaId: null,
  // v1.6c — selección/hover de sección a nivel distrito. Sirven al
  // renderer para iluminar la pieza-sección y al UI futuro para
  // colgar tableros de actividad sobre la sección activa. Tap a nivel
  // distrito ya NO navega a sección (se decidió que la identidad
  // operativa es el distrito); selecciona/deselecciona.
  selectedSeccionCusec: null,
  hoveredSeccionCusec: null,
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
  },

  // Capas-overlay opcionales que se pintan ENCIMA del render base. Cada
  // overlay vive en overlays/<id>.js con la API mínima { id, name, load,
  // draw, isReady }. La UI (botón flotante o, en el futuro, panel)
  // pone su flag a true/false y la próxima frame el renderer lo pinta.
  activeOverlays: {
    renta: false
  }
};

const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");
state._lodPillEl = document.getElementById("lod-pill");

// -----------------------------------------------------------
// Carga inicial: catálogo + isla. Determina nivel según URL.

async function boot() {
  // 2026-05-26 — Paraleliza cargas independientes del boot. Antes en
  // serie ~150-300 ms encadenados; ahora se solapan en el wire.
  const [catalog] = await Promise.all([
    loadCatalog("../catalog/archetypes.json"),
    loadArchipielago(),
    loadCanariasMuns(),
    loadBarriosGc(),
  ]);
  state.catalog = catalog;

  const params = new URLSearchParams(window.location.search);
  const cusec = params.get("cusec");
  const mun = params.get("mun");
  const islaParam = params.get("isla");
  const level = params.get("level");
  const distritoId = params.get("distrito_id");
  const barrioId = params.get("barrio");
  const manzanaParam = params.get("manzana");

  sizeCanvas();
  bindUI();
  attach(canvas, state, requestRender, handleTap, handleSwipe);
  initOverlays(state);
  // Montar tablero cívico. El contexto le da acceso al popup de
  // compromiso y a la activación de capas por ámbito.
  initDashboard(state, {
    openCompromiso: (ambito) => openCompromisoPopup(ambito),
    openReporte: (ambito) => openReportePopup(ambito),
    getState: () => state
  });
  // Hook para que el renderer dispare refresh tras lodLevel change.
  state._refreshDashboard = () => refreshDashboard(state);

  // _bootstrapping evita que cada paso del arranque empuje al history.
  state._bootstrapping = true;
  if (cusec) {
    // El primer dígito de cusec corresponde a la provincia (3=Sta Cruz Tf,
    // 5=Las Palmas), pero para cusec canarios el formato es 35XXX / 38XXX.
    // Schema actual gc/lite: cusec de 10 dígitos = prov(2)+mun(3)+dis(2)+sec(3).
    // 2026-05-24 — Pasamos cumun (5 dígitos prov+mun) a inferIslaFromMun
    // para evitar colisiones (ej. mun 029 = Tinajo LZ ∩ Puntagorda LP).
    const cumun = cusec.slice(0, 5);
    const munCode = cusec.slice(2, 5);
    const disCode = cusec.slice(5, 7);
    const islaOfMun = inferIslaFromMun(cumun) || inferIslaFromMun(munCode);
    if (islaOfMun) await enterIsla(islaOfMun, /*animate*/ false);
    await enterMunicipio(munCode, /*animate*/ false);
    await enterDistrito(munCode + disCode, /*animate*/ false);
    await enterSeccion(cusec, /*animate*/ false);
    // Deep link self-contained a manzana SIN barrio (resto de islas):
    // ?cusec=<cusec>&manzana=<localId>. La manzana cuelga de la sección
    // recién cargada; reconstruimos el composite id.
    if (manzanaParam) {
      await enterManzana(`${cusec}-${manzanaParam}`, { animate: false });
    }
  } else if (level === "distrito" && distritoId) {
    // 2026-05-24 — Mismo fix: si el distritoId trae prov (5+ dígitos),
    // resolvemos isla por cumun para desambiguar.
    const cumun = distritoId.length >= 5 ? distritoId.slice(0, 5) : null;
    const munCode = distritoId.slice(0, 3);
    const islaOfMun = (cumun && inferIslaFromMun(cumun)) || inferIslaFromMun(munCode);
    if (islaOfMun) await enterIsla(islaOfMun, /*animate*/ false);
    await enterMunicipio(munCode, /*animate*/ false);
    await enterDistrito(distritoId, /*animate*/ false);
  } else if (barrioId) {
    // v1.6.barrio — deep link a barrio: expandir cascada
    //   enterIsla → enterMunicipio(mun_de_la_tabla) → enterBarrio(id).
    // Si el id no existe en la tabla, fallback a isla con warning.
    // Backward-compat: URLs viejas con `?barrio=lpgc-XXX` (schema curado v1)
    // se mapean a `016-XXX` (schema canonical, 3-digit mun + slug).
    let resolvedBarrioId = barrioId;
    let meta = state.barriosGc?.barrios?.[resolvedBarrioId];
    if (!meta && resolvedBarrioId.startsWith("lpgc-")) {
      const alias = "016-" + resolvedBarrioId.slice(5);
      const aliasMeta = state.barriosGc?.barrios?.[alias];
      if (aliasMeta) { resolvedBarrioId = alias; meta = aliasMeta; }
    }
    if (!meta) {
      console.warn(`[barrio] id "${barrioId}" no está en barrios-canonical.json — fallback archipielago`);
      enterArchipielago(/*animate*/ false);
    } else {
      // mun en la tabla viene como "35016" (5 dígitos) o "016" (3); normalizamos
      // al formato 3 dígitos que usa enterMunicipio.
      // 2026-05-24 — Si tenemos el cumun completo, lo usamos para resolver
      // isla y evitar colisión entre prov 35/38 con mismos códigos 3-dig.
      const munRaw = String(meta.mun || "");
      const cumun = munRaw.length === 5 ? munRaw : null;
      const munCode = munRaw.replace(/^3[58]/, "");
      const islaOfMun = (cumun && inferIslaFromMun(cumun)) || inferIslaFromMun(munCode);
      if (islaOfMun) await enterIsla(islaOfMun, /*animate*/ false);
      await enterMunicipio(munCode, /*animate*/ false);
      await enterBarrio(resolvedBarrioId, /*animate*/ false);
      // v1.6.manzana (Phase 2b) — deep link a manzana del barrio.
      // Requiere ?barrio=<id>&manzana=<cusec-localId>. Si la manzana no
      // existe en el barrio, se queda en lodLevel=barrio (warning ya
      // emitido por enterManzana).
      if (manzanaParam) {
        await enterManzana(manzanaParam, { animate: false });
      }
    }
  } else if (mun) {
    // 2026-05-24 — Fix colisión 3-digit mun entre provincias (p.ej. "029"
    // = Tinajo LZ ∩ Puntagorda LP). Si la URL trae también ?isla=, lo
    // honramos como verdad de origen. Sin ?isla=, caemos a
    // inferIslaFromMun (preserva backward-compat para URLs viejas que
    // sólo traían ?mun=).
    const munCode = mun.replace(/^3[58]/, "");
    const islaOfMun = islaParam || inferIslaFromMun(munCode);
    if (islaOfMun) await enterIsla(islaOfMun, /*animate*/ false);
    await enterMunicipio(munCode, /*animate*/ false);
  } else if (islaParam) {
    await enterIsla(islaParam, /*animate*/ false);
  } else {
    enterArchipielago(/*animate*/ false);
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

// 2026-05-19 — Carga el FeatureCollection de las 7 islas (canarias-islands-
// poly.json). Cada feature trae properties.isla, name, muns_count,
// sections_count, centroid_lnglat, bbox_lnglat y un MultiPolygon. Las
// coordenadas las proyectamos a metros locales con CANARIAS_ANCHOR_LNGLAT
// (centro entre TF y GC) para que las 7 islas se vean a escala real.
async function loadArchipielago() {
  // 2026-05-29 — cache-buster: la geometría se regeneró desde límites
  // oficiales (es-atlas/IGN-INE). Sin el ?v el navegador servía la
  // versión vieja cacheada del JSON.
  const url = "../canarias-islands-poly.json?v=20260529-oficial2";
  const fc = await fetch(url).then(r => r.json());
  const islands = [];
  for (const f of fc.features) {
    // Convertimos los outer rings del MultiPolygon a metros. 2026-05-23:
    // filtramos islotes/fragmentos cuya área sea < 1% del polígono mayor
    // — quita la "mella" en Fuerteventura causada por Isla de Lobos
    // (4.8 km² vs FV 1658 km² = 0.3%). Preserva La Graciosa en LZ (3.4%)
    // porque tiene identidad propia y área significativa.
    const rings = [];
    const g = f.geometry;
    const ringArea = (r) => {
      // Shoelace en grados — suficiente para comparar fragmentos del
      // mismo polígono (sin reproyectar; relativo, no absoluto).
      let a = 0;
      for (let i = 0; i < r.length - 1; i++) {
        a += r[i][0] * r[i+1][1] - r[i+1][0] * r[i][1];
      }
      return Math.abs(a) / 2;
    };
    if (g.type === "Polygon") {
      const r = g.coordinates[0];
      if (r && r.length >= 3) rings.push(r);
    } else if (g.type === "MultiPolygon") {
      // Calcula áreas y descarta fragmentos < 1% del mayor.
      const polys = g.coordinates
        .map(poly => ({ r: poly[0], area: poly[0] && poly[0].length >= 3 ? ringArea(poly[0]) : 0 }))
        .filter(p => p.area > 0);
      const maxArea = polys.length ? Math.max(...polys.map(p => p.area)) : 0;
      for (const p of polys) {
        if (p.area >= maxArea * 0.01) rings.push(p.r);
      }
    }
    if (!rings.length) continue;
    const ringsM = rings.map(r => r.map(([lng, lat]) =>
      lnglatToLocalMeters(lng, lat, CANARIAS_ANCHOR_LNGLAT)));
    // Outer ring "principal" (el de mayor número de puntos suele ser el
    // de la isla) — usado como _ringSimple para hit-test y centroide.
    let main = ringsM[0];
    for (const r of ringsM) if (r.length > main.length) main = r;
    f._ring = main;
    f._rings = ringsM.map(r => simplifyRing(r, 60));   // 60m tol para isla
    f._ringSimple = f._rings.find(r => r.length === Math.max(...f._rings.map(rr => rr.length))) || simplifyRing(main, 60);
    f._centroid = ringCentroid(main);
    // bbox unión de TODOS los rings (para bbox real de la isla, no sólo main)
    let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
    for (const r of ringsM) {
      const [a, b, c, d] = ringBbox(r);
      if (a < mnx) mnx = a; if (b < mny) mny = b;
      if (c > mxx) mxx = c; if (d > mxy) mxy = d;
    }
    f._bbox = [mnx, mny, mxx, mxy];
    islands.push(f);
  }
  // bbox del archipiélago = unión de bboxes de cada isla.
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const f of islands) {
    const [a, b, c, d] = f._bbox;
    if (a < minx) minx = a; if (b < miny) miny = b;
    if (c > maxx) maxx = c; if (d > maxy) maxy = d;
  }
  // Estadísticas para coloreado por densidad (sections_count por isla).
  // 2026-05-22 — endurecido como en loadIsla: filtramos 0/undefined y
  // devolvemos sentinels si quedan <3 valores o todos son iguales. Con
  // sólo 7 islas (y EH=126 vs LZ=98 muy juntas) los terciles son
  // estables, pero por consistencia con loadIsla aplicamos el mismo patrón.
  const counts = islands.map(f => f.properties.sections_count || 0)
                        .filter(n => n > 0)
                        .sort((a, b) => a - b);
  let archT1, archT2;
  if (counts.length < 3 || counts[0] === counts[counts.length - 1]) {
    archT1 = -1; archT2 = Infinity;
  } else {
    archT1 = counts[Math.floor(counts.length / 3)];
    archT2 = counts[Math.floor(counts.length * 2 / 3)];
  }
  state.archipielago = {
    islands,
    bbox: [minx, miny, maxx, maxy],
    t1: archT1,
    t2: archT2
  };

  // [OCRE-SKIN F5b] Construir la siluetas-strip permanente. Sólo si
  // existe el contenedor en el DOM (body.skin-ocre).
  try { buildSiluetasStrip(); } catch (e) { console.warn("siluetas-strip build failed", e); }
}

// [OCRE-SKIN F5b] Genera los chips SVG de la siluetas-strip a partir
// de state.archipielago.islands. Cada chip lleva el path normalizado a
// un viewbox local 36x24, con click handler que salta a enterIsla.
// El primer chip ("Canarias") vuelve al archipielago.
function buildSiluetasStrip() {
  const strip = document.getElementById("siluetas-strip");
  if (!strip || !state.archipielago) return;
  strip.innerHTML = "";

  // Chip "Canarias" inicial — vuelve al archipielago (todas las islas).
  // Lo dibujamos como pequeño grupo de 7 puntos (placeholder identitario).
  const allChip = document.createElement("button");
  allChip.className = "silueta-chip silueta-chip-all";
  allChip.dataset.isla = "_all";
  allChip.setAttribute("aria-label", "Archipiélago");
  allChip.innerHTML = `<svg viewBox="0 0 36 24">
    <g>
      <circle cx="4"  cy="14" r="1.6"/>
      <circle cx="9"  cy="11" r="1.4"/>
      <circle cx="13" cy="15" r="1.2"/>
      <circle cx="18" cy="12" r="2.2"/>
      <circle cx="24" cy="14" r="1.4"/>
      <circle cx="29" cy="11" r="1.5"/>
      <circle cx="33" cy="13" r="1.2"/>
    </g>
  </svg>`;
  // SVG global: usa fill como path normal (CSS lo controla via path).
  allChip.querySelector("g").setAttribute("fill", "currentColor");
  allChip.style.color = "rgba(184,134,70,0.7)";
  allChip.addEventListener("click", () => {
    if (typeof enterArchipielago === "function") enterArchipielago(true);
  });
  strip.appendChild(allChip);

  // Separador visual sutil
  const sep = document.createElement("span");
  sep.className = "silueta-sep";
  sep.style.cssText = "width:1px;height:14px;background:rgba(245,232,200,0.18);margin:0 2px;";
  strip.appendChild(sep);

  // Una silueta SVG por isla. Normalizamos cada _ringSimple a viewbox local.
  for (const f of state.archipielago.islands) {
    const ring = f._ringSimple;
    if (!ring || ring.length < 3) continue;
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (const [x, z] of ring) {
      if (x < minx) minx = x; if (x > maxx) maxx = x;
      if (z < miny) miny = z; if (z > maxy) maxy = z;
    }
    const dx = Math.max(1, maxx - minx);
    const dy = Math.max(1, maxy - miny);
    // Viewbox 32x20 con 2px padding. Preserva aspect ratio centrando.
    const vbW = 32, vbH = 20;
    const scale = Math.min(vbW / dx, vbH / dy);
    const offX = (vbW - dx * scale) / 2;
    const offY = (vbH - dy * scale) / 2;
    const pts = ring.map(([x, z]) => {
      const px = (x - minx) * scale + offX;
      const py = (z - miny) * scale + offY;
      return `${px.toFixed(1)},${py.toFixed(1)}`;
    });
    const d = `M ${pts[0]} L ${pts.slice(1).join(" L ")} Z`;

    const chip = document.createElement("button");
    chip.className = "silueta-chip";
    chip.dataset.isla = f.properties.isla;
    chip.title = f.properties.name || f.properties.isla;
    chip.setAttribute("aria-label", f.properties.name || f.properties.isla);
    chip.innerHTML = `<svg viewBox="0 0 ${vbW} ${vbH}"><path d="${d}"/></svg>`;
    chip.addEventListener("click", () => {
      const id = f.properties.isla;
      if (typeof enterIsla === "function") enterIsla(id, true);
    });
    strip.appendChild(chip);
  }

  updateSiluetasStripActive();
}

// [OCRE-SKIN] Actualiza el caption "Polis · X" del bottom-bar paper
// según el nivel actual. Reemplaza la información que daba el
// membrete (ahora oculto). También actualiza el sub del CTA del sheet
// ("en Canarias" → "en LPGC" → "en Las Coloradas") y dispara el
// re-render de la lista de gestos recientes para el nivel.
function updateBottomBarCaption() {
  const el = document.getElementById("app-bottombar-caption");
  if (!el) return;
  let label = "Canarias";
  if (state.lodLevel === "isla") {
    label = state.isla?.name || "Canarias";
  } else if (state.lodLevel === "municipio") {
    label = state.municipio?.nmun || label;
  } else if (state.lodLevel === "distrito") {
    label = `Distrito ${state.district?.dis || ""}`.trim();
  } else if (state.lodLevel === "barrio") {
    label = state.barrio?.name || label;
  } else if (state.lodLevel === "seccion") {
    label = `Sección ${state.section?.meta?.cusec?.slice(-3) || ""}`.trim();
  } else if (state.lodLevel === "manzana") {
    label = `Manzana ${state.manzana?.manzanaId || ""}`.trim();
  }
  el.innerHTML = `Polis<span class="bb-sep">·</span>${escapeHtmlSafe(label)}`;
  const sub = document.getElementById("bb-cta-sub");
  if (sub) sub.textContent = "en " + label;
}

// [OCRE-SKIN F3] Wire del bottom sheet pull-up. El grip (handle +
// caption) toggla aria-expanded. Click fuera o ESC lo cierran.
(function bindAppBottomBar() {
  const bar = document.getElementById("app-bottombar");
  const grip = document.getElementById("app-bottombar-grip");
  const cta = document.getElementById("bb-cta-dejar-gesto");
  if (!bar || !grip) return;
  function open() { bar.setAttribute("aria-expanded", "true"); }
  function close() { bar.setAttribute("aria-expanded", "false"); }
  function toggle() {
    if (bar.getAttribute("aria-expanded") === "true") close(); else open();
  }
  grip.addEventListener("click", toggle);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && bar.getAttribute("aria-expanded") === "true") close();
  });
  // Click fuera del sheet → cerrar. Solo cuando está abierto, y
  // siempre que el target no esté dentro del sheet.
  document.addEventListener("pointerdown", (e) => {
    if (bar.getAttribute("aria-expanded") !== "true") return;
    if (bar.contains(e.target)) return;
    close();
  });
  // CTA placeholder — por ahora solo log. Cuando llegue backend de
  // gestos, abrir flujo "Dejar un gesto" anclado al nivel actual.
  cta?.addEventListener("click", () => {
    console.log("[gesto] CTA 'Dejar un gesto aquí' nivel:", state.lodLevel);
    // TODO: integrar con flujo real cuando exista Supabase de gestos.
  });
})();

// [OCRE-SKIN] Wire del dropdown OCRE ▾ — lista de vistas / modos. Por
// ahora POLIS activo, resto placeholder "pronto" (disabled).
(function bindAppTopBarMenu() {
  const brand = document.getElementById("app-topbar-brand");
  const menu = document.getElementById("app-topbar-menu");
  if (!brand || !menu) return;
  function open() {
    menu.classList.add("open");
    brand.setAttribute("aria-expanded", "true");
    menu.setAttribute("aria-hidden", "false");
  }
  function close() {
    menu.classList.remove("open");
    brand.setAttribute("aria-expanded", "false");
    menu.setAttribute("aria-hidden", "true");
  }
  function toggle() {
    if (menu.classList.contains("open")) close(); else open();
  }
  brand.addEventListener("click", (e) => { e.stopPropagation(); toggle(); });
  brand.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
    if (e.key === "Escape") close();
  });
  document.addEventListener("pointerdown", (e) => {
    if (!menu.classList.contains("open")) return;
    if (brand.contains(e.target) || menu.contains(e.target)) return;
    close();
  });
  menu.addEventListener("click", (e) => {
    const item = e.target.closest(".atm-item");
    if (!item) return;
    if (item.disabled) return;
    const view = item.dataset.view;
    if (view && typeof switchView === "function") switchView(view);
    close();
  });
})();

// [OCRE-SKIN 2026-05-25] View switcher entre POLIS / ÁGORA / BIBLIOTHEKA.
// El cambio se hace via body[data-view=…] y la CSS de .view-page hace
// el resto. Mantiene state.lodLevel intacto para volver luego a POLIS.
function switchView(view) {
  // [2026-05-27] Integración multi-app: ÁGORA y BIBLIOTHEKA ahora son
  // apps reales hermanas (../agora-app/, ../biblioteca-app/), no vistas
  // internas placeholder. Navegamos de verdad — la identidad (polis-uid)
  // y el log de gestos persisten porque es el mismo origen.
  if (view === "agora") { window.location.href = "../agora-app/"; return; }
  if (view === "bibliotheka" || view === "biblioteca") { window.location.href = "../biblioteca-app/"; return; }
  // "polis" sigue siendo la vista interna del mapa.
  document.body.setAttribute("data-view", view);
  for (const it of document.querySelectorAll(".atm-item")) {
    it.classList.toggle("atm-active", it.dataset.view === view);
  }
}
window.polisApp = window.polisApp || {};
window.polisApp.switchView = switchView;

// [OCRE-SKIN 2026-05-25] Wire back button del topbar — sube un nivel
// usando navigateBack() existente. Visibilidad sincronizada con
// updateBackButton (renombrada para incluir el botón nuevo).
(function bindTopbarBack() {
  const btn = document.getElementById("app-topbar-back");
  if (!btn) return;
  btn.addEventListener("click", () => {
    if (typeof window.polisApp?.navigateBack === "function") {
      window.polisApp.navigateBack();
    } else if (typeof navigateBack === "function") {
      navigateBack();
    }
  });
})();

// [OCRE-SKIN 2026-05-25] Wire search bubble. Click 🔍 abre/cierra el
// bocadillo anclado al topbar. Input filtra en tiempo real sobre muns,
// barrios, islas. Tap en resultado → enterX y cierra bubble.
(function bindAppSearch() {
  const btn = document.getElementById("app-topbar-search");
  const bubble = document.getElementById("app-search-bubble");
  const input = document.getElementById("app-search-input");
  const results = document.getElementById("app-search-results");
  const clear = document.getElementById("app-search-clear");
  if (!btn || !bubble || !input || !results) return;

  function open() {
    bubble.classList.add("open");
    bubble.setAttribute("aria-hidden", "false");
    btn.classList.add("active");
    setTimeout(() => input.focus(), 60);
    // El callejero es pesado (~MB): se carga al abrir el buscador, no en
    // el boot. Cuando llega, re-ejecutamos la búsqueda para incluir calles.
    ensureCalles().then(() => {
      if (bubble.classList.contains("open")) runSearch(input.value);
    });
    runSearch(input.value);
  }
  function close() {
    bubble.classList.remove("open");
    bubble.setAttribute("aria-hidden", "true");
    btn.classList.remove("active");
  }
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (bubble.classList.contains("open")) close(); else open();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && bubble.classList.contains("open")) close();
  });
  document.addEventListener("pointerdown", (e) => {
    if (!bubble.classList.contains("open")) return;
    if (bubble.contains(e.target) || btn.contains(e.target)) return;
    close();
  });

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
  }

  // Cache de tejido-social + OSM places + callejero (lazy en 1ª búsqueda)
  let _tejidoCache = null;
  let _placesCache = null;
  let _callesCache = null;
  async function ensureCalles() {
    if (_callesCache) return;
    try {
      const mod = await _loadSearchModule();
      _callesCache = (await mod.loadCalles()) || [];
    } catch (_) { _callesCache = []; }
  }
  async function ensureExtraSearchData() {
    if (!_tejidoCache) {
      try {
        const r = await fetch("../data/tejido-social.geojson");
        const fc = await r.json();
        _tejidoCache = (fc.features || []).map(f => ({
          nombre: f.properties.nombre || "",
          categoria: f.properties.categoria || "",
          municipio: f.properties.municipio || "",
          que_hace: f.properties.que_hace || "",
          lng: f.geometry?.coordinates?.[0],
          lat: f.geometry?.coordinates?.[1]
        }));
      } catch (_) { _tejidoCache = []; }
    }
    if (!_placesCache) {
      try {
        const r = await fetch("../data/osm-places-canarias.json");
        const d = await r.json();
        _placesCache = (d.places || []).map(p => ({
          name: p.name || "",
          type: p.place || p.type || "",
          lng: p.lnglat?.[0] ?? p.center?.[0] ?? p.centroid_lnglat?.[0] ?? p.lng,
          lat: p.lnglat?.[1] ?? p.center?.[1] ?? p.centroid_lnglat?.[1] ?? p.lat
        })).filter(p => p.name && p.lng != null);
      } catch (_) { _placesCache = []; }
    }
  }
  ensureExtraSearchData(); // arranca el fetch en background

  function runSearch(q) {
    q = (q || "").trim().toLowerCase();
    clear.classList.toggle("visible", q.length > 0);
    results.innerHTML = "";
    if (!q) {
      results.innerHTML = `<div class="asb-hint">Escribe para buscar islas, municipios, barrios, calles, lugares o asociaciones…</div>`;
      return;
    }
    const arch = state.archipielago;
    const cmuns = state._canariasMuns;
    const found = { islas: [], muns: [], barrios: [], calles: [], lugares: [], asociaciones: [] };

    // Islas
    if (arch?.islands) {
      for (const f of arch.islands) {
        const name = (f.properties.name || "").toLowerCase();
        if (name.includes(q)) {
          found.islas.push({ id: f.properties.isla, name: f.properties.name });
        }
      }
    }
    // Muns
    if (cmuns?.byIsla) {
      for (const muns of cmuns.byIsla.values()) {
        for (const m of muns) {
          const name = (m.properties.nmun || "").toLowerCase();
          if (name.includes(q)) {
            found.muns.push({
              mun: m.properties.mun, nmun: m.properties.nmun,
              isla: m.properties.isla, cumun: m.properties.cumun
            });
            if (found.muns.length >= 30) break;
          }
        }
        if (found.muns.length >= 30) break;
      }
    }
    // Barrios (canonical)
    if (state.barriosGc?.barrios) {
      let n = 0;
      for (const [bid, meta] of Object.entries(state.barriosGc.barrios)) {
        const name = (meta.name || "").toLowerCase();
        if (name.includes(q)) {
          found.barrios.push({ id: bid, name: meta.name, mun: meta.mun_name });
          n++;
          if (n >= 30) break;
        }
      }
    }
    // Calles del callejero OSM (carga lazy al abrir; GC por ahora).
    if (_callesCache) {
      let n = 0;
      for (const c of _callesCache) {
        if ((c.name || "").toLowerCase().includes(q)) {
          found.calles.push(c);
          n++; if (n >= 20) break;
        }
      }
    }
    // Lugares OSM (place=hamlet/village/town/locality/...)
    if (_placesCache) {
      let n = 0;
      for (const p of _placesCache) {
        if ((p.name || "").toLowerCase().includes(q)) {
          found.lugares.push(p);
          n++; if (n >= 25) break;
        }
      }
    }
    // Asociaciones / tejido social (match por nombre o municipio)
    if (_tejidoCache) {
      let n = 0;
      for (const t of _tejidoCache) {
        const nm = (t.nombre || "").toLowerCase();
        const mun = (t.municipio || "").toLowerCase();
        const cat = (t.categoria || "").toLowerCase();
        if (nm.includes(q) || mun.includes(q) || cat.includes(q)) {
          found.asociaciones.push(t);
          n++; if (n >= 25) break;
        }
      }
    }

    // Cross-reference: si un mun coincide y hay asociaciones EN ese mun,
    // las anotamos con un badge para que aparezcan juntas.
    const munNames = new Set(found.muns.map(m => (m.nmun || "").toLowerCase()));
    for (const a of found.asociaciones) {
      if (munNames.has((a.municipio || "").toLowerCase())) a._linkedToMatchedMun = true;
    }

    const totalFound = Object.values(found).reduce((a, b) => a + b.length, 0);
    if (!totalFound) {
      results.innerHTML = `<div class="asb-hint">Sin resultados para "${escapeHtml(q)}"</div>
        <div class="asb-hint" style="margin-top:6px;font-size:11px;">Pronto: buscar por dirección (calle + número) cuando el pipeline catastro lo extraiga.</div>`;
      return;
    }

    const groups = [];
    if (found.islas.length) {
      groups.push(`<div class="asb-result-group">Islas</div>` +
        found.islas.map(i => `<button class="asb-result" data-kind="isla" data-id="${escapeHtml(i.id)}">${escapeHtml(i.name)}</button>`).join(""));
    }
    if (found.muns.length) {
      groups.push(`<div class="asb-result-group">Municipios (${found.muns.length})</div>` +
        found.muns.slice(0, 20).map(m =>
          `<button class="asb-result" data-kind="mun" data-mun="${escapeHtml(m.mun)}" data-isla="${escapeHtml(m.isla)}">${escapeHtml(m.nmun)}<span class="asb-r-meta">${escapeHtml(m.isla.toUpperCase())} · ${escapeHtml(m.cumun)}</span></button>`).join(""));
    }
    if (found.barrios.length) {
      groups.push(`<div class="asb-result-group">Barrios (${found.barrios.length})</div>` +
        found.barrios.slice(0, 20).map(b =>
          `<button class="asb-result" data-kind="barrio" data-id="${escapeHtml(b.id)}">${escapeHtml(b.name)}<span class="asb-r-meta">${escapeHtml(b.mun || "")}</span></button>`).join(""));
    }
    if (found.calles.length) {
      groups.push(`<div class="asb-result-group">Calles (${found.calles.length})</div>` +
        found.calles.slice(0, 20).map(c =>
          `<button class="asb-result" data-kind="calle" data-lng="${c.centroide[0]}" data-lat="${c.centroide[1]}" data-name="${escapeHtml(c.name)}">${escapeHtml(c.name)}<span class="asb-r-meta">${escapeHtml((c.type || "calle").toUpperCase())}</span></button>`).join(""));
    }
    if (found.lugares.length) {
      groups.push(`<div class="asb-result-group">Lugares (${found.lugares.length})</div>` +
        found.lugares.slice(0, 20).map(p =>
          `<button class="asb-result" data-kind="lugar" data-lng="${p.lng}" data-lat="${p.lat}">${escapeHtml(p.name)}<span class="asb-r-meta">${escapeHtml((p.type || "").toUpperCase())}</span></button>`).join(""));
    }
    if (found.asociaciones.length) {
      groups.push(`<div class="asb-result-group">Asociaciones / tejido social (${found.asociaciones.length})</div>` +
        found.asociaciones.slice(0, 20).map(a => {
          const link = a._linkedToMatchedMun ? ' · ✓ municipio coincide' : '';
          return `<button class="asb-result" data-kind="asoc" data-lng="${a.lng}" data-lat="${a.lat}">${escapeHtml(a.nombre)}<span class="asb-r-meta">${escapeHtml((a.categoria || "").toUpperCase())} · ${escapeHtml(a.municipio || "")}${escapeHtml(link)}</span></button>`;
        }).join(""));
    }
    results.innerHTML = groups.join("");
  }

  input.addEventListener("input", (e) => runSearch(e.target.value));
  clear.addEventListener("click", () => { input.value = ""; runSearch(""); input.focus(); });
  results.addEventListener("click", (e) => {
    const r = e.target.closest(".asb-result");
    if (!r) return;
    const kind = r.dataset.kind;
    try {
      if (kind === "isla") {
        enterIsla(r.dataset.id, true);
      } else if (kind === "mun") {
        const islaParam = r.dataset.isla;
        (async () => {
          if (islaParam) await enterIsla(islaParam, false);
          await enterMunicipio(r.dataset.mun, true);
        })();
      } else if (kind === "barrio") {
        enterBarrio(r.dataset.id, true);
      } else if (kind === "lugar" || kind === "asoc" || kind === "calle") {
        // Punto con coordenadas (lugar OSM, asociación o calle del
        // callejero): SITUAR en el punto exacto, en CUALQUIER isla.
        // findMunByLngLat resuelve isla+municipio que lo contiene; entramos
        // y hacemos pan+zoom a la coordenada. Vale para GC y prov38.
        const lng = parseFloat(r.dataset.lng);
        const lat = parseFloat(r.dataset.lat);
        if (Number.isFinite(lng) && Number.isFinite(lat)) {
          const [mx, mz] = lnglatToLocalMeters(lng, lat, GC_ANCHOR_LNGLAT);
          const target = findMunByLngLat(lng, lat);
          if (target) {
            (async () => {
              await enterIsla(target.isla, false);
              await enterMunicipio(target.mun, true);
              _panZoomToPoint(mx, mz, 2.5);
            })();
          } else {
            _panZoomToPoint(mx, mz, 2.5);
          }
        }
      }
    } catch (_) {}
    close();
  });
})();

// 2026-05-25 — Resuelve mun que contiene un lng/lat (bbox test sobre
// state._canariasMuns). Devuelve { mun, isla, nmun } o null.
function findMunByLngLat(lng, lat) {
  const cmuns = state._canariasMuns;
  if (!cmuns?.byIsla) return null;
  let best = null;
  let bestArea = Infinity;
  for (const muns of cmuns.byIsla.values()) {
    for (const m of muns) {
      const c = m.properties.centroid_lnglat;
      if (!c) continue;
      // Heurística: el centroide más cercano dentro de ~25km
      const dlng = (lng - c[0]) * Math.cos(c[1] * Math.PI / 180);
      const dlat = lat - c[1];
      const d2 = dlng * dlng + dlat * dlat;
      if (d2 < bestArea) { bestArea = d2; best = m; }
    }
  }
  if (!best) return null;
  return {
    mun: best.properties.mun,
    isla: best.properties.isla,
    nmun: best.properties.nmun
  };
}

// [OCRE-SKIN 2026-05-25] Wire cog → reuso el cog-menu existente (con
// items Buscar / Registrar / ADMIN / Cerrar). Buscar redirige a la lupa.
(function bindAppCog() {
  const btn = document.getElementById("app-topbar-cog");
  const menu = document.getElementById("cog-menu");
  if (!btn || !menu) return;
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (menu.classList.contains("open")) {
      menu.classList.remove("open");
      btn.classList.remove("active");
    } else {
      menu.classList.add("open");
      btn.classList.add("active");
    }
  });
  document.addEventListener("pointerdown", (e) => {
    if (!menu.classList.contains("open")) return;
    if (menu.contains(e.target) || btn.contains(e.target)) return;
    menu.classList.remove("open");
    btn.classList.remove("active");
  });
})();

// [OCRE-SKIN 2026-05-25] Wire FAB unificado: tap abre drawer; las 3
// pestañas (Gestos / Datos / Capas) reutilizan estructura existente.
// El pane "Gestos" clona el grid de #gestos-sheet-grid; "Datos" copia
// el contenido del dashboard ITB v2; "Capas" copia el layer-panel.
(function bindUnifiedFab() {
  const fab = document.getElementById("unified-fab");
  const drawer = document.getElementById("unified-drawer");
  const closeBtn = document.getElementById("unified-drawer-close");
  if (!fab || !drawer) return;

  // 2026-05-25 — Toggles de POLÍTICA PÚBLICA con workflow de commit.
  // El usuario marca varias políticas en el drawer (pendientes), busca
  // sinergias entre ellas, y al pulsar "Aplicar al mapa" se cierra el
  // drawer y aparecen los indicadores en el lienzo (overlays reales).
  //
  // Cada ámbito declara los overlays asociados — esos se activan/
  // desactivan en bloque al aplicar. La capa visual del mapa queda
  // sincronizada con la última selección comprometida.
  state._activeAmbitos = state._activeAmbitos || new Set();
  state._pendingAmbitos = state._pendingAmbitos || new Set(state._activeAmbitos);

  // 2026-05-27 — Batch grande: integrados 10 overlays nuevos a los
  // ámbitos correspondientes. Movilidad pasa de 2→4 capas (suma Titsa
  // itinerarios + carriles bici), Salud +centros-salud, Cultura+BIC,
  // Espacio+(inundación, mobiliario, árboles singulares, calima),
  // Trabajo+subvenciones. Memoria democrática se cuelga de Cultura.
  // 2026-05-28 — Recuperado el LENGUAJE DE GESTOS: el nombre de cada
  // ámbito es un VERBO ACTIVO en primera persona (lo que el ciudadano
  // viene a hacer), no un sustantivo de área. `id` y `layers` se mantienen
  // intactos (SINERGIAS y overlays siguen funcionando). `art` apunta a un
  // line-art en polilíneas (ver GESTO_ART) que ilustra la etiqueta.
  const AMBITOS = [
    { id: "movilidad",    nombre: "Moverme",   art: "moverme",   sub: "Guaguas · Titsa · cobertura · carriles bici", icon: "⇄",
      layers: ["guaguas", "cobertura", "titsa", "movilidad-suave"] },
    { id: "vivienda",     nombre: "Habitar",   art: "habitar",   sub: "Padrón · alquiler · presión turística · inundación", icon: "⌂",
      layers: ["vv", "inundacion"] },
    { id: "salud",        nombre: "Cuidarme",  art: "cuidarme",  sub: "SCS · lista espera · centros AP · hospitales", icon: "+",
      layers: ["lista-espera", "centros-salud"] },
    { id: "alimentacion", nombre: "Comer",     art: "comer",     sub: "Productores · mercadillos · comercio local · kmo", icon: "◉",
      layers: ["productores", "alimentacion"] },
    { id: "cultura",      nombre: "Disfrutar", art: "disfrutar", sub: "Eventos · bibliotecas · BIC · memoria democrática", icon: "♪",
      layers: ["eventos", "registro-oficial", "cultura-venues", "bic", "memoria-democratica"] },
    { id: "espacio",      nombre: "Pasear",    art: "pasear",    sub: "Parques · playas · aire · calima · mobiliario · árboles", icon: "✻",
      layers: ["parques", "playas", "calidad-aire", "calima", "mobiliario", "arboles-singulares"] },
    { id: "educacion",    nombre: "Estudiar",  art: "estudiar",  sub: "Colegios · comedores · becas · formación", icon: "▤",
      layers: ["educacion", "comedores-escolares"] },
    { id: "social",       nombre: "Convivir",  art: "convivir",  sub: "Asociaciones · 3er sector · cuidados", icon: "⊕",
      layers: ["tejido-social"] },
    { id: "trabajo",      nombre: "Trabajar",  art: "trabajar",  sub: "Paro registrado · subvenciones · empleo", icon: "⚒",
      layers: ["paro", "subvenciones"] }
  ];

  // Line-art en polilíneas (stroke=currentColor → hereda color de la
  // tarjeta: ink normal, blanco cuando .on). Cada dibujo representa el
  // verbo/etiqueta. viewBox 48×32, trazo redondeado.
  const GESTO_ART = {
    moverme: `<svg viewBox="0 0 48 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="10" y="6" width="30" height="15" rx="2.5"/><line x1="10" y1="13.5" x2="40" y2="13.5"/><line x1="18" y1="6.5" x2="18" y2="13"/><line x1="26" y1="6.5" x2="26" y2="13"/><line x1="34" y1="6.5" x2="34" y2="13"/><circle cx="18" cy="25" r="3"/><circle cx="33" cy="25" r="3"/><line x1="2" y1="10" x2="7" y2="10"/><line x1="2" y1="15" x2="6" y2="15"/></svg>`,
    habitar: `<svg viewBox="0 0 48 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 16 L24 5 L40 16"/><path d="M12 16 V27 H36 V16"/><rect x="21" y="20" width="6" height="7"/></svg>`,
    cuidarme: `<svg viewBox="0 0 48 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17 H12 L15 10 L19 24 L22 17 H27"/><path d="M37 9 V23 M30 16 H44"/></svg>`,
    comer: `<svg viewBox="0 0 48 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="16" r="9"/><circle cx="24" cy="16" r="4.5"/><path d="M8 6 V14 M11 6 V14 M9.5 6 V26"/><path d="M40 6 q-3 4 0 8 V26"/></svg>`,
    disfrutar: `<svg viewBox="0 0 48 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="13" cy="24" r="3.2"/><line x1="16.2" y1="24" x2="16.2" y2="8"/><path d="M16.2 8 q6 1 6 5.5"/><path d="M28 11 q3.5 5 0 10 M33 8 q5.5 8 0 16"/></svg>`,
    pasear: `<svg viewBox="0 0 48 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="16" cy="12" r="6.5"/><line x1="16" y1="18.5" x2="16" y2="27"/><circle cx="37" cy="8" r="3.2"/><path d="M3 28 q16 -5 42 0"/></svg>`,
    estudiar: `<svg viewBox="0 0 48 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M24 8 C18 4 9 5 5 7 V25 C9 23 18 22 24 26"/><path d="M24 8 C30 4 39 5 43 7 V25 C39 23 30 22 24 26"/><line x1="24" y1="8" x2="24" y2="26"/></svg>`,
    convivir: `<svg viewBox="0 0 48 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="16" cy="11" r="4"/><path d="M9 27 q0 -8 7 -8 q7 0 7 8"/><circle cx="32" cy="11" r="4"/><path d="M25 27 q0 -8 7 -8 q7 0 7 8"/></svg>`,
    trabajar: `<svg viewBox="0 0 48 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="15" height="6" rx="1"/><line x1="13.5" y1="12" x2="22" y2="27"/><line x1="33" y1="7" x2="33" y2="26"/><line x1="29" y1="8" x2="37" y2="8"/></svg>`
  };

  // Sinergias predefinidas: pares de ámbitos que "se cruzan bien".
  // Cuando el usuario marca 2+, hinteamos las que aplican.
  const SINERGIAS = [
    { a: "movilidad",    b: "vivienda",     desc: "Accesibilidad residencial" },
    { a: "movilidad",    b: "cultura",      desc: "Eventos accesibles en guagua" },
    { a: "movilidad",    b: "educacion",    desc: "Camino escolar" },
    { a: "movilidad",    b: "salud",        desc: "Cita SCS vs cobertura bus" },
    { a: "vivienda",     b: "alimentacion", desc: "Cesta básica + alquiler" },
    { a: "vivienda",     b: "social",       desc: "Vulnerabilidad residencial" },
    { a: "salud",        b: "social",       desc: "Cuidados de mayores" },
    { a: "cultura",      b: "espacio",      desc: "Vida en plazas" },
    { a: "alimentacion", b: "espacio",      desc: "Mercados al aire libre" },
    { a: "educacion",    b: "espacio",      desc: "Patios y parques cercanos" },
    { a: "social",       b: "alimentacion", desc: "Bancos de alimentos" },
    { a: "trabajo",      b: "vivienda",     desc: "Paro vs precio alquiler" },
    { a: "trabajo",      b: "movilidad",    desc: "Acceso a empleo en bus" },
    { a: "trabajo",      b: "educacion",    desc: "Formación en zonas de paro alto" },
    { a: "trabajo",      b: "social",       desc: "Vulnerabilidad laboral + cuidados" }
  ];

  function detectarSinergias(set) {
    if (set.size < 2) return [];
    return SINERGIAS.filter(s => set.has(s.a) && set.has(s.b));
  }

  function pendingDiffersFromActive() {
    const p = state._pendingAmbitos, a = state._activeAmbitos;
    if (p.size !== a.size) return true;
    for (const id of p) if (!a.has(id)) return true;
    return false;
  }

  function populateGestos() {
    const dst = document.getElementById("ud-pane-gestos");
    if (!dst) return;
    const pending = state._pendingAmbitos;
    const dirty = pendingDiffersFromActive();
    const sinergias = detectarSinergias(pending);
    const headMeta = pending.size > 0
      ? ` · ${pending.size} pendiente${pending.size === 1 ? "" : "s"}`
      : "";

    dst.innerHTML = `
      <div class="ud-grid-head">Políticas que quieres ver cruzadas en el mapa<span class="ud-grid-head-meta">${headMeta}</span></div>
      <div class="ud-toggle-grid">
        ${AMBITOS.map(a => `
          <button class="ud-toggle ${pending.has(a.id) ? "on" : ""}" data-ambito="${a.id}" type="button">
            <span class="ud-toggle-art" aria-hidden="true">${(a.art && GESTO_ART[a.art]) || `<span class="ud-toggle-icon">${a.icon}</span>`}</span>
            <span class="ud-toggle-name">${a.nombre}</span>
            <span class="ud-toggle-sub">${a.sub}</span>
          </button>
        `).join("")}
      </div>
      ${sinergias.length > 0 ? `
        <div class="ud-synergies">
          <div class="ud-synergies-head">Sinergias detectadas</div>
          ${sinergias.map(s => `<div class="ud-synergy">${s.desc}</div>`).join("")}
        </div>
      ` : ""}
      <div class="ud-grid-actions">
        <button class="ud-action-secondary" id="ud-clear-pending" type="button"
                ${pending.size === 0 ? "disabled" : ""}>Limpiar</button>
        <button class="ud-action-primary" id="ud-apply-pending" type="button"
                ${!dirty ? "disabled" : ""}>${pending.size === 0 && state._activeAmbitos.size > 0
                  ? "Quitar todas las capas"
                  : "Aplicar al mapa"}</button>
      </div>
    `;

    // Tap toggles (no aplica al mapa, sólo cambia pendientes).
    for (const btn of dst.querySelectorAll(".ud-toggle")) {
      btn.addEventListener("click", () => {
        const id = btn.dataset.ambito;
        if (pending.has(id)) pending.delete(id); else pending.add(id);
        populateGestos();
      });
    }
    // Limpiar pendientes
    dst.querySelector("#ud-clear-pending")?.addEventListener("click", () => {
      pending.clear();
      populateGestos();
    });
    // Aplicar pendientes → activos + setOverlayActive en bloque + cerrar drawer
    dst.querySelector("#ud-apply-pending")?.addEventListener("click", () => {
      aplicarAmbitos();
    });

    // Pestaña Gestos con badge si hay pendientes O activos
    const tabGestos = document.querySelector('.unified-drawer-tab[data-pane="gestos"]');
    if (tabGestos) {
      const baseLabel = "Gestos";
      const n = Math.max(pending.size, state._activeAmbitos.size);
      tabGestos.textContent = n > 0 ? `${baseLabel} (${n})` : baseLabel;
    }
  }

  // Aplica selección pendiente: copia a active, llama setOverlayActive en
  // bloque, cierra drawer. La unión de IDs de overlay sobre los ámbitos
  // activos se traduce a setOverlayActive(state, id, true/false).
  function aplicarAmbitos() {
    const pending = state._pendingAmbitos;
    const active = state._activeAmbitos;
    // Union nueva de overlays según pending
    const newOverlayIds = new Set();
    for (const id of pending) {
      const a = AMBITOS.find(x => x.id === id);
      if (a) for (const lid of (a.layers || [])) newOverlayIds.add(lid);
    }
    // Union vieja de overlays según active (antes del commit)
    const oldOverlayIds = new Set();
    for (const id of active) {
      const a = AMBITOS.find(x => x.id === id);
      if (a) for (const lid of (a.layers || [])) oldOverlayIds.add(lid);
    }
    // Aplicar diff:
    for (const lid of oldOverlayIds) {
      if (!newOverlayIds.has(lid)) {
        try { setOverlayActive(state, lid, false); } catch (_) {}
      }
    }
    for (const lid of newOverlayIds) {
      if (!oldOverlayIds.has(lid)) {
        try { setOverlayActive(state, lid, true); } catch (_) {}
      }
    }
    // Commit
    state._activeAmbitos = new Set(pending);
    console.log("[politicas] aplicadas →", Array.from(state._activeAmbitos),
                "| overlays activos:", Array.from(newOverlayIds));
    // Cerrar drawer
    const drawer = document.getElementById("unified-drawer");
    if (drawer) {
      drawer.classList.remove("open");
      drawer.setAttribute("aria-hidden", "true");
    }
    requestRender();
  }
  function populateDatos() {
    const dst = document.getElementById("ud-pane-datos");
    if (!dst) return;
    // getElementById (no querySelector) para que SIEMPRE devuelva el
    // #dashboard real: el clon vive en el drawer (antes en el DOM) y, si
    // conservase el id/clase, una querySelector lo cazaría primero.
    const dash = document.getElementById("dashboard");
    if (dash) {
      dst.innerHTML = "";
      const clone = dash.cloneNode(true);
      clone.classList.remove("open");
      // Neutralizar identificadores que colisionan con las consultas
      // globales del dashboard real (refreshDashboard / _refreshSenales usan
      // document.querySelector('.db-card[data-id]'); app.js usa
      // getElementById('dashboard')). Sin esto el refresh apuntaría al clon.
      clone.removeAttribute("id");
      clone.querySelectorAll(".db-card").forEach((c) => {
        c.dataset.cloneAmb = c.dataset.id || "";
        c.removeAttribute("data-id");
      });
      dst.appendChild(clone);
      // BUGFIX 2026-05-29 — cloneNode(true) NO copia event listeners (mismo
      // bug que populateCapas el 2026-05-28). El #dashboard real usa listeners
      // delegados, así que el clon quedaba MUERTO: señales, compromiso,
      // reporte, Detalles y el toggle de capa por card no respondían.
      // Reenviamos cada clic al control REAL (que sí dispara el handler) y
      // re-sincronizamos el estado visual del clon.
      clone.addEventListener("click", (e) => {
        const card = e.target.closest(".db-card");
        if (!card) return;
        const amb = card.dataset.cloneAmb;
        const realCard = amb && dash.querySelector(`.db-card[data-id="${amb}"]`);
        if (!realCard) return;
        const actionBtn = e.target.closest("[data-action]");
        if (actionBtn) {
          // Botón interior (senal-pos/neg, compromiso, reporte, datos).
          const realBtn = realCard.querySelector(
            `[data-action="${actionBtn.dataset.action}"]`);
          if (realBtn) realBtn.click();
        } else {
          // Cuerpo de la card: togglea el overlay primario del ámbito.
          realCard.click();
        }
        _syncDatosClone(clone, dash);
      });
    } else {
      dst.innerHTML = `<div class="vp-empty">Datos del nivel — sin tablero cargado todavía.</div>`;
    }
  }
  function populateCapas() {
    const dst = document.getElementById("ud-pane-capas");
    const src = document.getElementById("layer-panel");
    if (!dst || !src) return;
    dst.innerHTML = "";
    const clone = src.cloneNode(true);
    clone.classList.remove("open");
    dst.appendChild(clone);
    // BUGFIX 2026-05-28 — cloneNode(true) NO copia event listeners. El
    // #layer-panel real usa un único listener delegado (setOverlayActive /
    // setSubcatFilter), así que el clon quedaba MUERTO: el usuario tocaba
    // una capa en la pestaña "Capas" y no pasaba nada → no podía quitar el
    // choropleth (paro/renta) y el color rojo/verde "persistía". Solución:
    // reenviar los clics del clon a los botones REALES (que sí disparan el
    // handler) y re-sincronizar el estado visual del clon.
    clone.addEventListener("click", (e) => {
      const chip = e.target.closest(".lp-chip");
      const layer = e.target.closest(".lp-layer");
      if (chip) {
        // Subchips (filtros de subcategoría): el .active del chip real es la
        // fuente de verdad, así que reenviamos el clic al chip real.
        const ov = chip.dataset.overlay;
        const sub = chip.dataset.sub;
        const realChip = (sub != null)
          ? src.querySelector(`.lp-chip[data-overlay="${ov}"][data-sub="${sub}"]`)
          : src.querySelector(`.lp-chip-all[data-overlay="${ov}"]`);
        if (realChip) { realChip.click(); _syncCapasClone(clone, src); }
        return;
      }
      if (layer) {
        // Toggle de capa: la verdad es state.activeOverlays[id], NO el
        // .active del botón (que puede estar desincronizado si la capa se
        // activó vía gestos o setLayer). Llamamos setOverlayActive directo.
        const id = layer.dataset.id;
        const on = !state.activeOverlays[id];
        setOverlayActive(state, id, on);
        const realBtn = src.querySelector(`.lp-layer[data-id="${id}"]`);
        if (realBtn) realBtn.classList.toggle("active", on);
        const realSub = src.querySelector(`.lp-subchips[data-for="${id}"]`);
        if (realSub) realSub.hidden = !on;
        _syncCapasClone(clone, src);
      }
    });
  }
  // Copia el estado visual (.active y subchips ocultos) del #layer-panel
  // real al clon de la pestaña Capas tras un reenvío de clic.
  function _syncCapasClone(clone, src) {
    src.querySelectorAll(".lp-layer, .lp-chip, .lp-subchips").forEach((rb) => {
      let sel = null;
      if (rb.classList.contains("lp-layer")) {
        sel = `.lp-layer[data-id="${rb.dataset.id}"]`;
      } else if (rb.classList.contains("lp-subchips")) {
        sel = `.lp-subchips[data-for="${rb.dataset.for}"]`;
      } else if (rb.dataset.sub != null) {
        sel = `.lp-chip[data-overlay="${rb.dataset.overlay}"][data-sub="${rb.dataset.sub}"]`;
      } else {
        sel = `.lp-chip-all[data-overlay="${rb.dataset.overlay}"]`;
      }
      const cb = sel && clone.querySelector(sel);
      if (!cb) return;
      cb.classList.toggle("active", rb.classList.contains("active"));
      if (rb.classList.contains("lp-subchips")) cb.hidden = rb.hidden;
    });
  }
  // Copia el estado visual del dashboard real al clon de la pestaña Datos
  // tras un reenvío de clic: la clase .layer-on (overlay primario activo) y
  // los contadores de señal/reporte que _refreshSenales actualiza.
  function _syncDatosClone(clone, dash) {
    dash.querySelectorAll(".db-card").forEach((rc) => {
      const cc = clone.querySelector(`.db-card[data-clone-amb="${rc.dataset.id}"]`);
      if (!cc) return;
      cc.classList.toggle("layer-on", rc.classList.contains("layer-on"));
      ["senal-pos", "senal-neg", "reportes"].forEach((k) => {
        const rv = rc.querySelector(`[data-key="${k}"]`);
        const cv = cc.querySelector(`[data-key="${k}"]`);
        if (rv && cv) cv.textContent = rv.textContent;
      });
    });
  }
  function open() {
    // Sincroniza pendiente con activo al abrir para que la edición
    // empiece desde el estado comprometido actual del mapa.
    state._pendingAmbitos = new Set(state._activeAmbitos || []);
    populateGestos();
    populateDatos();
    populateCapas();
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
  }
  function close() {
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
  }
  // [2026-05-29 ladrillo#1] El FAB visible abre el MENÚ DE VERBOS canónico
  // (taxonomía → #gestos-sheet), NO el drawer viejo de pestañas. Disparamos
  // su propio botón (#gestos-toggle, oculto) para reusar su lógica sin
  // acoplarnos a ella. Con esto Datos y Capas (pestañas del drawer) quedan
  // invisibles "de momento" — el drawer ya no se abre. Reversible: devolver
  // esta línea a `fab.addEventListener("click", open)`.
  fab.addEventListener("click", () => {
    const verbBtn = document.getElementById("gestos-toggle");
    if (verbBtn) verbBtn.click();
    else open(); // fallback al drawer si el sheet no existiera
  });
  closeBtn?.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && drawer.classList.contains("open")) close();
  });

  // Switching de pestañas
  drawer.querySelectorAll(".unified-drawer-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      const pane = tab.dataset.pane;
      drawer.querySelectorAll(".unified-drawer-tab").forEach(t =>
        t.classList.toggle("active", t === tab));
      drawer.querySelectorAll(".ud-pane").forEach(p =>
        p.classList.toggle("active", p.dataset.pane === pane));
    });
  });
})();

// [OCRE-SKIN 2026-05-25] Sincroniza visibilidad del back-button flotante
// (ahora junto al membrete, antes en topbar). Mismo id, distinto CSS class.
function syncTopbarBack() {
  const el = document.getElementById("app-topbar-back");
  if (!el) return;
  const hasBack = state.lodLevel && state.lodLevel !== "archipielago";
  el.classList.toggle("visible", !!hasBack);
}
// Hook al updateBackButton si existe (lo invoca el sistema en cada cambio)
if (typeof window !== "undefined") {
  const origUbb = window.polisApp?.updateBackButton;
  window.polisApp = window.polisApp || {};
  window.polisApp.updateBackButton = function (...args) {
    if (origUbb) origUbb(...args);
    syncTopbarBack();
  };
}
function escapeHtmlSafe(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}

// [OCRE-SKIN F5b] Aplica la clase .active al chip que corresponde al
// nivel actual. Llamado desde updateBreadcrumb() para mantenerlos
// sincronizados con la navegación.
function updateSiluetasStripActive() {
  const strip = document.getElementById("siluetas-strip");
  if (!strip) return;
  const chips = strip.querySelectorAll(".silueta-chip");
  let activeIslaId = null;
  if (state.lodLevel === "archipielago") {
    activeIslaId = "_all";
  } else {
    activeIslaId = state.isla?.id
      || inferIslaFromMun(state.municipio?.mun || state.district?.mun
                          || state.barrio?.mun || state.section?.meta?.mun)
      || null;
  }
  for (const chip of chips) {
    chip.classList.toggle("active", chip.dataset.isla === activeIslaId);
  }
}

// 2026-05-19 — Carga UNA vez canarias-municipios-poly.json (88 muns con
// properties.isla). Cachea en state._canariasMuns como Map<isla, [features]>
// y como Map<munCode, isla> (índice inverso para deep-link mun→isla). Cada
// feature lleva sus rings ya proyectados a CANARIAS_ANCHOR_LNGLAT.
async function loadCanariasMuns() {
  if (state._canariasMuns) return state._canariasMuns;
  // 2026-05-29 — cache-buster (ver loadArchipielago): geometría oficial.
  const url = "../canarias-municipios-poly.json?v=20260529-oficial2";
  const fc = await fetch(url).then(r => r.json());
  const byIsla = new Map();    // islaId → [features ordered]
  // munToIsla maps mun (3-digit) → islaId. Como `mun` 3-digit colisiona
  // entre provincias (p.ej. mun "012" existe en GC=Mogán y en TF=Fasnia),
  // damos preferencia a GC para preservar deep-link backward-compat
  // (URLs históricas ?mun=016 = LPGC). El resto cabe sólo si su mun no
  // está ya tomado.
  const munToIsla = new Map();
  const cumunToIsla = new Map(); // cumun (5-digit) → islaId, inequívoco
  // Primera pasada: indexar features GC con prioridad alta.
  const featsGc = fc.features.filter(f => f.properties.isla === "gc");
  const featsOther = fc.features.filter(f => f.properties.isla !== "gc");
  const processFeat = (f) => {
    const islaId = f.properties.isla;
    if (!islaId) return;
    const ring = outerRing(f.geometry);
    if (!ring) return;
    const ringM = ring.map(([lng, lat]) =>
      lnglatToLocalMeters(lng, lat, CANARIAS_ANCHOR_LNGLAT));
    f._ring = ringM;
    f._ringSimple = simplifyRing(ringM, 30);
    f._centroid = ringCentroid(ringM);
    annotateDepth(f);
    if (!byIsla.has(islaId)) byIsla.set(islaId, []);
    byIsla.get(islaId).push(f);
    if (!munToIsla.has(f.properties.mun)) munToIsla.set(f.properties.mun, islaId);
    if (f.properties.cumun) cumunToIsla.set(f.properties.cumun, islaId);
  };
  for (const f of featsGc) processFeat(f);
  for (const f of featsOther) processFeat(f);
  // Sort por depth dentro de cada isla
  for (const [k, arr] of byIsla.entries()) {
    byIsla.set(k, sortByDepth(arr));
  }
  state._canariasMuns = { byIsla, munToIsla, cumunToIsla };
  return state._canariasMuns;
}

// 2026-05-19 — Devuelve el islaId para un munCode 3-dígito (p.ej. "037"
// → "tf"). Usado para que deep-links ?mun=037 cascadeen primero a la isla.
// Si el mun no está en el pack, devuelve null (caller decide fallback).
function inferIslaFromMun(munCode) {
  // 2026-05-24 — Si pasas un cumun de 5 dígitos (prov+mun, p.ej. "38029")
  // resolvemos vía cumunToIsla, que NO colisiona entre provincias. Si
  // pasas 3 dígitos caemos al map munToIsla legacy (que prefiere prov 35).
  if (munCode && munCode.length === 5) {
    const v = state._canariasMuns?.cumunToIsla?.get(munCode);
    if (v) return v;
  }
  return state._canariasMuns?.munToIsla?.get(munCode) || null;
}

// 2026-05-25 — Set module-scope para que buildBarriosPiezas y otras
// funciones lo usen sin re-declarar dentro de loadMunicipio.
const PROV38_ISLAS = new Set(["tf", "lp", "lg", "eh"]);

// 2026-05-19 — Versión refactorizada: carga muns de una isla específica.
// Usa state._canariasMuns como cache (filtrado por isla). Equivalente al
// antiguo loadIsla() pero ahora islaId-aware. La isla anterior (GC) se
// servía desde gc-municipios-poly.json; ahora siempre se usa
// canarias-municipios-poly.json para coherencia inter-isla.
async function loadIsla(islaId) {
  if (!state._canariasMuns) await loadCanariasMuns();
  const islandFeat = state.archipielago?.islands?.find(f => f.properties.isla === islaId);
  if (!islandFeat) throw new Error(`isla "${islaId}" no encontrada en archipielago`);
  const municipios = state._canariasMuns.byIsla.get(islaId) || [];
  if (!municipios.length) throw new Error(`isla "${islaId}" sin municipios`);
  // bbox = usamos el bbox de la isla (más estable que la unión de muns,
  // que puede dejar bordes recortados). Ya está en metros locales.
  const bbox = islandFeat._bbox.slice();

  // Estadísticas para coloreado por densidad. 2026-05-22 — endurecido
  // igual que computeBcStats: filtramos 0/undefined (muns sin manifest),
  // y devolvemos sentinels (-1, Infinity) si hay <3 valores reales o
  // todos son iguales. Sin esto, islas pequeñas (EH 3 muns, LG 6 muns)
  // o cualquier dataset con sections_count=0/undefined podían dar t1=0
  // → todos los muns caen al tier inferior (un solo color).
  const counts = municipios.map(m => m.properties.sections_count || 0)
                            .filter(n => n > 0)
                            .sort((a, b) => a - b);
  let t1, t2;
  if (counts.length < 3 || counts[0] === counts[counts.length - 1]) {
    t1 = -1; t2 = Infinity;
  } else {
    t1 = counts[Math.floor(counts.length / 3)];
    t2 = counts[Math.floor(counts.length * 2 / 3)];
  }
  state.isla = {
    id: islaId,
    name: islandFeat.properties.name,
    feature: islandFeat,
    municipios,
    bbox,
    t1, t2
  };
}

// v1.6.barrio — Carga la tabla canonical barrio → cusecs. Tolerante a fallo:
// si el JSON no carga, deja `state.barriosGc = null` y la app sigue sin
// la capa barrio. Estructura del JSON (barrios-canonical.json, 164 barrios
// agregados de OSM prov 35):
//   { version, barrios: { <id>: { id, name, place_type, mun, mun_name,
//       centroide:[lng,lat], bbox, geometria, secciones_origen:[cusec,…],
//       datos:{edificios, hogares, renta_media_ponderada, …} } } }
// IDs: `<3-digit-mun>-<slug>` (p.ej. `016-vegueta`). Antes (curado v1):
// `lpgc-<slug>`. El boot tiene alias backward-compat para URLs viejas.
async function loadBarriosGc() {
  try {
    // 2026-05-26 — barrios-canonical-lite.json (251 KB) sin geometrías.
    // Las geometrías full vienen en barrios-canonical.json (7.4 MB) y se
    // cargan lazy si el usuario navega al nivel barrio (loadBarrio).
    const res = await fetch("../data/barrios-canonical-lite.json");
    if (!res.ok) throw new Error(`http ${res.status}`);
    const json = await res.json();
    if (!json || !json.barrios) throw new Error("schema inválido");
    // Normalización in-place: el schema canonical usa `secciones_origen`,
    // el resto del runtime (loadBarrio, overlay) espera `sections`.
    // Mapeo no-destructivo para mantener compatibilidad con futuro consumo
    // del campo original.
    for (const bid of Object.keys(json.barrios)) {
      const b = json.barrios[bid];
      if (b.secciones_origen && !b.sections) b.sections = b.secciones_origen;
    }
    // Índice inverso cusec → barrioId para resolución O(1) en handleTap.
    const cusecIndex = new Map();
    for (const [barrioId, meta] of Object.entries(json.barrios)) {
      for (const cusec of (meta.sections || [])) {
        cusecIndex.set(cusec, barrioId);
      }
    }
    json._cusecIndex = cusecIndex;
    state.barriosGc = json;
  } catch (e) {
    console.warn("[barrio] no se pudo cargar barrios-canonical.json:", e);
    state.barriosGc = null;
  }
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
  // 2026-05-22 — Multi-provincia: prov 35 (gc/fv/lz) usa gc-secciones-lite,
  // prov 38 (tf/lp/lg/eh) usa prov38-secciones-lite. Decidimos por isla:
  // state.isla.id está cacheada por loadIsla antes de loadMunicipio (bootstrap
  // hace enterIsla → enterMunicipio incluso en deep-link directo a ?mun=).
  // Fallback: inferIslaFromMun si por alguna razón state.isla está vacío.
  const islaId = state.isla?.id || inferIslaFromMun(mun);
  // PROV38_ISLAS ahora vive en module scope (definido junto a inferIslaFromMun).
  const isProv38 = PROV38_ISLAS.has(islaId);
  const seccionesUrl = isProv38
    ? "../prov38-secciones-lite.json"
    : "../gc-secciones-lite.json";
  const secciones = await fetch(seccionesUrl).then(r => r.json());

  // 2026-05-24 — Manifest regenerado para cubrir las 1381 secciones reales
  // en disco (prov 35 + prov 38). El guard `!isProv38` se elimina porque
  // ahora hay entradas para Tenerife/LP/LG/EH. Sin esto, prov 38 entraba
  // con _buildingCount=0 en toda sección → barrios "vacíos", densityFocused
  // bbox sin señal, nivel OSM sin tejido visible.
  const buildingsByCusec = new Map();
  // Cache buster: manifest se regeneró 2026-05-24 con las 1381 secciones
  // reales en disco (prov 35 + 38). Sin el query el navegador servía el
  // cache de 562 entries (sólo subset de prov 35).
  const manifest = await fetch("../sections_pack/manifest.json?v=20260524-full")
    .then(r => r.json());
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

  // 2026-05-24 — Clusters DBSCAN del mun: núcleos poblados detectados
  // automáticamente a partir de los building centroids. Sirven como nivel
  // intermedio clicable en muns rurales donde "barrio = todo el mun" no da
  // resolución de navegación. eps=120m, min_samples=8, min_cluster_size=25.
  // 1631 clusters totales en Canarias, nombrados por OSM place más cercano.
  const cumun = (isProv38 ? "38" : "35") + mun;
  const muClusters = await loadMunClusters(cumun);

  // v1.6.barrio-pieza (Fase 2a) — Piezas-barrio: agrupamos las secciones
  // INE bajo los barrios canonical del mun. Cada pieza es un tile iso
  // tappable. Si el mun no tiene barrios curados (caso Tejeda/Artenara),
  // dejamos `barriosPiezas` vacío y el renderer cae al modo legacy (274
  // secciones-INE como tiles). Reutilizamos la `geometria` y `centroide`
  // ya precomputados en barrios-canonical.json (Polygon/MultiPolygon
  // en lnglat) — sólo proyectamos a metros locales GC anchor.
  const barriosPiezas = buildBarriosPiezas(mun, out);
  const barrioOwnedCusecs = new Set();
  for (const p of barriosPiezas) {
    for (const c of p.seccionesCusecs) barrioOwnedCusecs.add(c);
  }
  // bcStats para coloreado: cuando hay piezas usamos el total de buildings
  // del barrio entero; cuando no, conservamos el legacy por sección.
  let bcStats;
  if (barriosPiezas.length) {
    bcStats = computeBcStats(barriosPiezas.map(p => ({
      _buildingCount: p.buildings_total
    })));
  } else {
    bcStats = computeBcStats(out);
  }

  return {
    mun,
    nmun: munFeat.properties.nmun,
    polygon: munFeat,
    secciones: sorted,
    bbox: [bxa, bxb, bxc, bxd],
    // Para coloreado por densidad
    bcStats,
    // Distritos del municipio (Map distritoId → {dis, secciones, bbox, ...})
    districts,
    distList,  // lista ordenada cíclicamente
    // v1.5.2: vecinos colindantes para render + tap (mapa continuo)
    neighbors: findMunicipioNeighbors(munFeat),
    // v1.6.barrio-pieza: piezas-barrio para render+tap.
    barriosPiezas,
    barrioOwnedCusecs,
    // 2026-05-24 — Clusters DBSCAN para nav intermedia en muns rurales.
    clusters: muClusters
  };
}

// 2026-05-24 — Tap en HUD card de cluster: zoom in al bbox del cluster
// dentro del mismo nivel municipio. Aplicamos fitView sobre el bbox del
// cluster con padding 60px para que se vean los barrios/secs/buildings
// que coinciden con esa zona, animado para mantener continuidad visual.
// Devuelve true si efectivamente hizo zoom al cluster; false si fue no-op
// (zoom ya ≈ el del bbox del cluster). El caller usa ese booleano para
// decidir si consumir el tap o dejarlo caer al descenso de sección.
function focusOnCluster(cluster) {
  if (!cluster || !cluster.bbox) return false;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const fitNew = fitView(cluster.bbox, w, h, 60, "municipio");
  // Si el zoom resultante está MUY cerca del actual, no animamos para
  // evitar jitter (puede ocurrir si el usuario re-tappea el mismo cluster).
  const dr = Math.abs(fitNew.scale - state.view.scale) / state.view.scale;
  if (dr < 0.05) return false;
  applyNewView(fitNew, /*animate*/ true);
  // Anota el cluster activo en el state para que el renderer pueda
  // resaltarlo más adelante (fase pendiente — highlight visual).
  state.municipio._activeClusterId = cluster.id;
  requestRender();
  return true;
}

// 2026-05-24 — Carga (cacheada) clusters_by_mun.json y devuelve los
// clusters del mun pedido (cumun = prov+mun, 5 dígitos), cada uno con
// rings proyectados a metros locales GC anchor + centroide proyectado +
// bbox precomputado para hit-test y zoom.
async function loadMunClusters(cumun) {
  if (!state._clustersByMun) {
    try {
      state._clustersByMun = await fetch(
        "../clusters_by_mun.json?v=20260524-eps180"
      ).then(r => r.json());
    } catch (e) {
      console.warn("[clusters] no se pudo cargar clusters_by_mun.json", e);
      state._clustersByMun = { clusters: {} };
    }
  }
  const raw = state._clustersByMun.clusters?.[cumun] || [];
  const out = [];
  for (const c of raw) {
    if (!c.hull_lnglat || c.hull_lnglat.length < 3) continue;
    const ringM = c.hull_lnglat.map(([lng, lat]) =>
      lnglatToLocalMeters(lng, lat, GC_ANCHOR_LNGLAT));
    const [cx, cy] = lnglatToLocalMeters(
      c.centroid_lnglat[0], c.centroid_lnglat[1], GC_ANCHOR_LNGLAT
    );
    const [a, b, d, e] = ringBbox(ringM);
    // Label: usa el nombre OSM si la distancia cae bajo el umbral del tipo.
    // Los `town/village` cubren más territorio que los `hamlet/locality` →
    // los aceptamos a más distancia. Si supera el umbral, fallback a
    // "Núcleo N" para no engañar con nombre lejano.
    const dist = c.nearest_place_dist_m;
    const typeMax = {
      town: 2500, village: 1800, suburb: 1500, neighbourhood: 1200,
      hamlet: 900, quarter: 800, city_block: 500, locality: 700
    };
    const maxDist = typeMax[c.nearest_place_type] || 600;
    const name = (c.nearest_place_name && dist !== null && dist < maxDist)
      ? c.nearest_place_name
      : `Núcleo ${c.id.split("-c")[1]}`;
    out.push({
      id: c.id,
      name,
      placeType: c.nearest_place_type,
      placeDistM: dist,
      buildingCount: c.building_count,
      ring: ringM,
      centroid: [cx, cy],
      bbox: [a, b, d, e]
    });
  }
  return out;
}

// v1.6.barrio-pieza — Construye las piezas-barrio del mun activo a partir
// de `state.barriosGc.barrios` (164 barrios prov 35). Cada pieza lleva su
// geometría proyectada a metros locales GC (Polygon o MultiPolygon), el
// centroide proyectado, building_count agregado y la lista de cusecs que
// agrega. El input `mun` viene en 3 dígitos ("016") mientras que el
// `b.mun` canonical viene en 5 dígitos ("35016") — ajustamos con strip.
function buildBarriosPiezas(mun, sectionFeatures) {
  if (!state.barriosGc?.barrios) return [];
  const out = [];
  // Index local cusec → buildings para sumar por barrio.
  const buildingsByCusec = new Map();
  for (const s of sectionFeatures) {
    buildingsByCusec.set(s.properties.cusec, s._buildingCount || 0);
  }
  // 2026-05-25 — Fix colisión prov 35/38: el campo `meta.mun` viene como
  // "35XXX" o "38XXX" (5 dígitos) y debemos strippear AMBOS prefijos para
  // el match 3-dig. Además filtramos por prov de la isla actual: si
  // estamos en TF (prov 38) sólo aceptamos barrios con meta.mun "38XXX",
  // y si estamos en GC/FV/LZ (prov 35) sólo "35XXX". Sin esto, Arico TF
  // (mun=005) atraía erróneamente `005-artenara-mun` de GC.
  const islaProv38 = PROV38_ISLAS.has(state.isla?.id);
  const expectedProvPrefix = islaProv38 ? "38" : "35";
  for (const [bid, meta] of Object.entries(state.barriosGc.barrios)) {
    const rawMun = String(meta.mun || "");
    // Match prov: el barrio debe ser de la misma provincia que la isla.
    if (rawMun.length >= 5 && !rawMun.startsWith(expectedProvPrefix)) continue;
    const bmun = rawMun.replace(/^3[58]/, "");
    if (bmun !== mun) continue;
    const g = meta.geometria;
    if (!g || !g.type) continue;

    // Convierte cada coordinate ring de lnglat → metros locales GC.
    const projectRingLL = (ringLL) =>
      ringLL.map(([lng, lat]) =>
        lnglatToLocalMeters(lng, lat, GC_ANCHOR_LNGLAT));

    let rings = []; // [ringMeters,…] outer rings de cada polygon
    if (g.type === "Polygon") {
      // GeoJSON Polygon: coordinates = [outerRing, hole1, hole2,…]
      const outerLL = g.coordinates[0];
      if (outerLL && outerLL.length >= 3) rings.push(projectRingLL(outerLL));
    } else if (g.type === "MultiPolygon") {
      for (const poly of g.coordinates) {
        const outerLL = poly[0];
        if (outerLL && outerLL.length >= 3) rings.push(projectRingLL(outerLL));
      }
    } else {
      continue;
    }
    if (!rings.length) continue;

    // Simplificación moderada (tol 6m igual que secciones del mun para
    // mantener visualmente comparables las aristas).
    const ringsSimple = rings.map(r => simplifyRing(r, 6));

    // Centroide: usamos el precomputado en lnglat (más preciso que el
    // centroide del ring outer) y proyectamos a metros.
    let centroidM;
    if (Array.isArray(meta.centroide) && meta.centroide.length === 2) {
      const [lng, lat] = meta.centroide;
      centroidM = lnglatToLocalMeters(lng, lat, GC_ANCHOR_LNGLAT);
    } else {
      centroidM = ringCentroid(ringsSimple[0]);
    }

    const seccionesCusecs = Array.isArray(meta.sections)
      ? meta.sections.slice()
      : [];
    let buildingsTotal = 0;
    let seccionesCount = 0;
    for (const cusec of seccionesCusecs) {
      if (buildingsByCusec.has(cusec)) {
        buildingsTotal += buildingsByCusec.get(cusec);
        seccionesCount += 1;
      }
    }

    // Pieza-barrio. `rings` es la lista de outer rings simplificados (1+
    // para MultiPolygon). Usamos `_ringSimple` = primer ring como key
    // primaria para los helpers iso que esperan un único ring; el
    // renderer iterará todos los rings.
    out.push({
      id: bid,
      name: meta.name,
      place_type: meta.place_type,
      rings: ringsSimple,
      _ringSimple: ringsSimple[0],
      centroid: centroidM,
      buildings_total: buildingsTotal,
      secciones_count: seccionesCount,
      seccionesCusecs: new Set(seccionesCusecs)
    });
  }

  // [E] Reasignación de secciones huérfanas — "en los mapas no existe
  // tierra de nadie". El JSON canonical declara `secciones_origen` por
  // barrio, pero hay cusecs del mun que ningún barrio reclama (huecos
  // de cobertura). Sin este fix se rendrizan con stroke ligero como
  // "tierra de nadie" entre barrios. Aquí cada huérfana se adopta por
  // el barrio cuyo centroide proyectado esté más cerca (euclidiana en
  // metros), añadiendo su `_ringSimple` a la lista `rings` de la pieza
  // (NO unión geométrica — el renderer ya itera todos los rings) y
  // sumando su `_buildingCount` al `buildings_total`. Si el mun no
  // tiene piezas (Tejeda/Artenara/synthetic prov 38) se hace skip: la
  // ruta legacy ya cubre todo el mun. El centroid original se preserva
  // para que la etiqueta del barrio no salte.
  if (out.length > 0) {
    const ownedCusecs = new Set();
    for (const p of out) {
      for (const cu of p.seccionesCusecs) ownedCusecs.add(cu);
    }
    let orphanCount = 0;
    for (const sec of sectionFeatures) {
      const cu = sec.properties.cusec;
      if (ownedCusecs.has(cu)) continue;
      const [sx, sz] = sec._centroid;
      let best = out[0];
      let bestD = Infinity;
      for (const p of out) {
        const [px, pz] = p.centroid;
        const d = Math.hypot(px - sx, pz - sz);
        if (d < bestD) { bestD = d; best = p; }
      }
      best.rings.push(sec._ringSimple);
      best.seccionesCusecs.add(cu);
      best.buildings_total += (sec._buildingCount || 0);
      best.secciones_count += 1;
      orphanCount += 1;
    }
    if (orphanCount > 0) {
      console.log(`[E] mun ${mun}: ${orphanCount} sección(es) huérfana(s) ` +
        `reasignada(s) por nearest-centroid sobre ${out.length} barrio(s)`);
    }
  }

  return out;
}

function computeBcStats(secs) {
  const counts = secs.map(s => s._buildingCount).filter(n => n > 0);
  // Sentinels degenerados: si no hay datos, o hay <3 valores, o todos
  // iguales — no existe tercil real. t1=-1, t2=+Inf hace que el render
  // colapse al tono medio (OCRE_LT) en vez de caer en la rama
  // PAPER_WARM (que coincide con el fondo y deja el mun invisible —
  // bug visto en muns rurales tipo Tejeda/Artenara con 1-2 secciones).
  if (counts.length < 3) return { t1: -1, t2: Infinity };
  counts.sort((a, b) => a - b);
  if (counts[0] === counts[counts.length - 1]) {
    return { t1: -1, t2: Infinity };
  }
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

// v1.6.barrio — Carga un barrio (lista de cusecs en barrios-canonical.json).
//
// Diseñado como gemelo de `loadDistrito`: carga las N secciones del
// barrio en paralelo y reproyecta cada una al anchor GC. Reusa
// `preprocessSectionForDistrict` literalmente. El objeto devuelto es
// estructuralmente idéntico al distrito (mismas keys), para que
// renderDistrito y los overlays cívicos puedan consumirlo sin saber que
// es un barrio. Diferencia: en lugar de `distritoId`/`dis` lleva
// `barrioId`/`name` + algunas keys descriptivas (mun_name, distrito_hint,
// centroid_lnglat).
async function loadBarrio(barrioId) {
  if (!state.barriosGc?.barrios) {
    throw new Error("barrios-canonical.json no cargado");
  }
  const meta = state.barriosGc.barrios[barrioId];
  if (!meta) throw new Error(`barrio ${barrioId} no encontrado`);
  // 2026-05-24 — bug fix: solo se quitaba "^35", no "^38". Resultado:
  // los barrios prov 38 (TF/LP/LG/EH) con meta.mun="38xxx" quedaban con
  // munCode="38xxx" (5-dig) en vez de "xxx" (3-dig), y loadMunicipio no
  // encontraba el mun → throw silencioso, tap muerto.
  const munCode = String(meta.mun || "").replace(/^3[58]/, "");

  // Necesitamos `state.municipio` cargado para obtener los features de
  // sección con _ring en anchor GC (igual que hace loadDistrito).
  const munObj = state.municipio?.mun === munCode
    ? state.municipio
    : await loadMunicipio(munCode);

  // Mapea cada cusec del barrio a su feature en munObj.secciones. Los
  // que no estén en el mun (typo en la tabla curada) se descartan con
  // warning — la app sigue funcionando con las que sí coincidan.
  const wantedCusecs = new Set(meta.sections);
  const secciones = [];
  const byCusec = new Map();
  for (const s of munObj.secciones) {
    byCusec.set(s.properties.cusec, s);
  }
  for (const cusec of meta.sections) {
    const s = byCusec.get(cusec);
    if (!s) {
      console.warn(`[barrio ${barrioId}] cusec ${cusec} no está en mun ${munCode}`);
      continue;
    }
    secciones.push(s);
  }
  if (!secciones.length) {
    throw new Error(`barrio ${barrioId} sin secciones válidas`);
  }

  document.getElementById("banner-sub").textContent =
    `cargando barrio ${meta.name} · ${secciones.length} secciones…`;

  // Fetch de cada pack de sección en paralelo, igual que loadDistrito.
  const sectionPromises = secciones.map(async (sFeat) => {
    const cusec = sFeat.properties.cusec;
    try {
      const base = `../sections_pack/${cusec}/`;
      const [meta2, manzanasGj, buildingsGj, roadsGj] = await Promise.all([
        fetch(base + "meta.json").then(r => r.json()),
        fetch(base + "manzanas.geojson").then(r => r.json()),
        fetch(base + "buildings.geojson").then(r => r.json()),
        fetch(base + "roads.geojson").then(r => r.json())
      ]);
      return preprocessSectionForDistrict(cusec, meta2, manzanasGj,
                                           buildingsGj, roadsGj);
    } catch (e) {
      console.warn(`barrio ${barrioId}: fallo cargando ${cusec}`, e);
      return null;
    }
  });
  const sectionPacks = (await Promise.all(sectionPromises)).filter(Boolean);

  // Aplanar manzanas + edificios + roads (idem distrito).
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

  // Estadísticas de densidad por sección (idem distrito) para el render
  // de los polígonos-sección coloreados en α1.
  const bcArr = secciones.map(s => s._buildingCount).filter(n => n > 0);
  bcArr.sort((a, b) => a - b);
  const secStats = {
    t1: bcArr[Math.floor(bcArr.length / 3)] || 0,
    t2: bcArr[Math.floor(bcArr.length * 2 / 3)] || 0
  };

  // Bbox del barrio (en metros GC) calculado de la unión de las
  // secciones, igual que distrito → districtOutline.
  let dnx = Infinity, dny = Infinity, dxx = -Infinity, dxy = -Infinity;
  for (const s of secciones) {
    const [a, b, c, e] = ringBbox(s._ring);
    if (a < dnx) dnx = a; if (b < dny) dny = b;
    if (c > dxx) dxx = c; if (e > dxy) dxy = e;
  }
  const districtOutline = [
    [dnx, dny], [dxx, dny], [dxx, dxy], [dnx, dxy], [dnx, dny]
  ];

  // v1.6.barrio-pieza-real — Polígono real del barrio (no bbox) para
  // el outline grueso del nuevo renderBarrio. Lo tomamos de la pieza
  // canónica del mun ya proyectada en metros GC. Si la pieza no existe
  // (fallback) caemos al rect del bbox.
  const munPieza = munObj.barriosPiezas?.find(p => p.id === barrioId);
  const barrioRings = munPieza?.rings || [districtOutline];

  // v1.6.barrio-pieza-real — Vecinos: piezas-barrio del mismo mun cuyo
  // bbox toca el del barrio activo. Bbox-test rápido — el render usará
  // sólo el outline finísimo para contexto, no extrusión.
  const neighborBarrios = [];
  if (munObj.barriosPiezas) {
    for (const p of munObj.barriosPiezas) {
      if (p.id === barrioId) continue;
      // Test bbox-bbox: descarta si están disjuntos en X o en Z.
      let touch = false;
      for (const ring of p.rings) {
        const [a, b, c, e] = ringBbox(ring);
        if (c < dnx || a > dxx) continue;
        if (e < dny || b > dxy) continue;
        touch = true;
        break;
      }
      if (touch) neighborBarrios.push(p);
    }
  }

  return {
    // Campos descriptivos propios del barrio
    barrioId,
    id: barrioId,
    name: meta.name,
    mun: munCode,
    mun_name: meta.mun_name,
    nmun: munObj.nmun,
    distrito_hint: meta.distrito_hint,
    centroid_lnglat: meta.centroid_lnglat,
    bbox_local_m: [dnx, dny, dxx, dxy],

    // Compat con shape distrito (para renderDistrito + overlays):
    //   - secciones[]            (features con _ring/_ringSimple/_centroid/_buildingCount)
    //   - sectionPacks[]         (packs reproyectados)
    //   - buildings[], manzanas[], roads[]
    //   - bbox, totalBuildings, sectionCount
    //   - secStats, districtOutline
    //   - neighborDistricts (vacío en Phase 1 — no hay slide entre barrios)
    secciones,
    sectionPacks,
    buildings: buildingsSorted,
    manzanas: manzanasSorted,
    roads,
    bbox: [mnx, mny, mxx, mxy],
    totalBuildings: buildings.length,
    sectionCount: sectionPacks.length,
    secStats,
    districtOutline,
    neighborDistricts: [],
    munObj,

    // v1.6.barrio-pieza-real — Para el nuevo renderBarrio que pinta
    // manzanas (no edificios) como piezas-tile. `barrioRings` lleva los
    // rings reales del polígono del barrio (canónico). `neighborBarrios`
    // son las piezas-barrio adyacentes para dibujarlas como contexto.
    barrioRings,
    neighborBarrios
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
  const [meta, manzanasGj, buildingsGj, roadsGj, poisGj, parksGj] = await Promise.all([
    fetch(base + "meta.json").then(r => r.json()),
    fetch(base + "manzanas.geojson").then(r => r.json()),
    fetch(base + "buildings.geojson").then(r => r.json()),
    fetch(base + "roads.geojson").then(r => r.json()),
    fetch(base + "pois.geojson").then(r => r.json()).catch(() => ({features: []})),
    fetch(base + "parks.geojson").then(r => r.json()).catch(() => ({features: []}))
  ]);
  return preprocessSection(meta, manzanasGj, buildingsGj, roadsGj, poisGj, parksGj);
}

function preprocessSection(meta, manzanasGj, buildingsGj, roadsGj, poisGj, parksGj = { features: [] }) {
  const manzanas = [];
  for (const f of manzanasGj.features) {
    const ring = outerRing(f.geometry);
    if (!ring) continue;
    f._ring = ring;
    f._ringSimple = simplifyRing(ring, 1.8);
    f._centroid = ringCentroid(ring);
    // 2026-05-29 — Paridad con el loader de barrio (GC): loadManzana
    // resuelve la manzana por `_cusec` + properties.id y construye el id
    // compuesto "<cusec>-<localId>". Sin esto, el drill-down a manzana/
    // edificio desde una sección entrada directamente (prov 38: El Hierro/
    // La Gomera/…) generaba ids "undefined-<id>" y nunca cargaba.
    f._cusec = meta.cusec;
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
    // 2026-05-29 — _cusec necesario para que loadManzana filtre los
    // edificios de la manzana (b._cusec === cusec && manzana_id === localId)
    // al entrar a la manzana desde una sección directa (prov 38).
    f._cusec = meta.cusec;
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

  // 2026-05-29 — Parques/zonas verdes: mismas coords locales (m) que los
  // edificios. Se proyectan igual y "brotan" con la rampa LOD (ver
  // renderSeccion). Guardamos category/kind por si luego se estiliza por
  // tipo (nature_reserve, park, garden, pitch…).
  const parks = [];
  if (parksGj && Array.isArray(parksGj.features)) {
    for (const f of parksGj.features) {
      const ring = outerRing(f.geometry);
      if (!ring) continue;
      f._ring = ring;
      f._centroid = ringCentroid(ring);
      parks.push(f);
    }
  }

  return {
    meta,
    manzanas: manzanasSorted,
    buildings: buildingsSorted,
    roads: roadsGj.features,
    pois: poisGj.features,
    parks,
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

// 2026-05-19 — Entra al nivel raíz archipiélago (7 islas Canarias).
// Render top-down de los 7 polígonos como tiles iso planos. Sin extrusión.
function enterArchipielago(animate = true, restoreView = null) {
  if (state.lodLevel !== "archipielago") saveParentViewport(state.lodLevel);
  state.lodLevel = "archipielago";
  state.isla = null;
  state.municipio = null;
  state.district = null;
  state.barrio = null;
  state.section = null;
  state.manzana = null;
  state.selectedManzanaId = null;
  state.hoverFeature = null;
  closeSidePanel();

  const fitNew = fitView(state.archipielago.bbox,
                         window.innerWidth, window.innerHeight, 60, "archipielago");
  const newView = restoreView ? mergeRestoredView(fitNew, restoreView) : fitNew;
  applyNewView(newView, animate);

  updateBreadcrumb();
  updateBannerSub();
  updateDistLabel();
  updateSideButtons();
  if (!state._bootstrapping && !state._navigatingFromPop) updateUrl();
  else updateBackButton();
  requestRender();
  if (state._refreshDashboard) state._refreshDashboard();
  _hideLoader();
}

async function enterIsla(islaId, animate = true, restoreView = null) {
  // Backward-compat: si recibimos boolean en primer arg (firma antigua
  // sin islaId), interpretamos como animate y vamos por defecto a "gc".
  if (typeof islaId === "boolean") {
    restoreView = animate === true ? null : animate;
    animate = islaId;
    islaId = "gc";
  }
  if (!islaId) islaId = state.isla?.id || "gc";

  // Guarda el viewport del nivel padre actual antes del swap (forward).
  if (state.lodLevel !== "isla") saveParentViewport(state.lodLevel);

  await loadIsla(islaId);
  state.lodLevel = "isla";
  state.municipio = null;
  state.district = null;
  state.barrio = null;
  state.section = null;
  state.manzana = null;
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
  // Tablero cívico: recalcular métricas con el state ya cargado del nivel
  // destino. El hook desde renderer también dispara, pero ahí el state
  // a veces aún no está poblado (la transición es asíncrona); aquí
  // garantizamos un refresh "final" con datos completos.
  if (state._refreshDashboard) state._refreshDashboard();
  _hideLoader();  // 2026-05-27 — bug #12: loader pegado en enterIsla
}

// 2026-05-27 — Helper centralizado para ocultar el splash loader. Algunos
// enterX (isla, distrito, vecindario, seccion) NO lo hacían y se quedaba
// pegado tapando el canvas tras navegación programática. Llamar al final
// de cada enterX o tras updateUrl() es seguro (idempotente).
function _hideLoader() {
  document.getElementById("loader")?.classList.add("hidden");
}

// Centroide ponderado por densidad poblacional (proxy: `_buildingCount`).
// Sustituye al centroide geométrico del bbox cuando se entra al municipio
// o al distrito. En muns rurales (Tejeda, Artenara, San Bartolomé de
// Tirajana) el centro del bbox cae en barranco/monte; el usuario quiere
// aterrizar donde hay viviendas. Si ninguna sección tiene buildings cae
// a media simple de centroides.
function populationWeightedCenter(secciones) {
  if (!secciones?.length) return null;
  let sumW = 0, sumX = 0, sumY = 0;
  let nFallback = 0, fxSum = 0, fySum = 0;
  for (const s of secciones) {
    const c = s._centroid;
    if (!c) continue;
    fxSum += c[0]; fySum += c[1]; nFallback += 1;
    const w = s._buildingCount || 0;
    if (w > 0) {
      sumX += c[0] * w;
      sumY += c[1] * w;
      sumW += w;
    }
  }
  if (sumW > 0) return [sumX / sumW, sumY / sumW];
  if (nFallback > 0) return [fxSum / nFallback, fySum / nFallback];
  return null;
}

// [H] Fase 1 — Bbox enfocado en el núcleo poblado. Para muns rurales
// (Valverde EH, Tejeda GC, synthetic-mun de TF/LP/LG/EH) el bbox total
// del mun deja al núcleo habitado minúsculo y la cámara aterriza en
// barranco/monte. Devolvemos un bbox más pequeño centrado en la
// densidad poblacional.
//
// Hay dos regímenes según si el manifest sections_pack tiene
// _buildingCount por sección (prov 35) o no (prov 38):
//
//  A) Régimen "manifest" (prov 35: gc/fv/lz). Las secciones urbanas son
//     geográficamente pequeñas y tienen muchos edificios; las rurales
//     son grandes y tienen pocos. Seleccionamos top-K secciones que
//     acumulan ≥80% del building_count, y devolvemos la unión de sus
//     bboxes. Funciona bien para San Bart Tirajana. Si top-K cubre casi
//     todo el mun (Tejeda: 2 secciones que abarcan todo) caemos a la
//     caja focal de régimen B pero usando _buildingCount como peso.
//
//  B) Régimen "fallback" (prov 38: tf/lp/lg/eh, sin manifest). Las
//     secciones censales son geográficamente AMPLIAS aunque sean
//     urbanas: el ring incluye barranco/monte además del pueblo, así
//     que la unión de bboxes de secciones no se reduce. En su lugar
//     construimos un cuadrado focal alrededor del centroide ponderado
//     (que se calcula con `1/area` como proxy: secciones urbanas son
//     proporcionalmente más pequeñas que las rurales aun cuando ambas
//     ocupan miles de hectáreas). Tamaño = max(35% del mun, 4km).
//
// Reglas defensivas:
//  - <2 secciones útiles → null (no compensa).
//  - Bbox <30% del mun en algún eje → padding x1.4 para contexto urbano.
//  - Clamp final al bbox del mun (nunca expandir fuera del polígono).
function densityFocusedBbox(secciones, munBbox, coverageFrac = 0.8) {
  if (!secciones?.length || !munBbox) return null;
  const ringAreaM = (r) => {
    if (!r || r.length < 3) return 0;
    let a = 0;
    for (let i = 0; i < r.length - 1; i++) {
      a += r[i][0] * r[i+1][1] - r[i+1][0] * r[i][1];
    }
    return Math.abs(a) / 2;
  };
  const hasManifest = secciones.some(s => (s._buildingCount || 0) > 0);
  const [umnx, umny, umxx, umxy] = munBbox;
  const munW = Math.max(umxx - umnx, 1);
  const munH = Math.max(umxy - umny, 1);

  let mnx, mny, mxx, mxy;

  // Régimen B (centroide ponderado + caja focal). Función reutilizable
  // tanto como fallback prov 38 como rescate para muns prov 35 donde
  // top-K cubre todo el bbox (Tejeda: 2 secs enormes ambas).
  const buildFocalBox = (weightFn) => {
    let sumW = 0, sumX = 0, sumY = 0;
    let n = 0;
    for (const s of secciones) {
      const c = s._centroid;
      if (!c) return null;
      const w = weightFn(s);
      if (!(w > 0)) continue;
      sumX += c[0] * w; sumY += c[1] * w; sumW += w;
      n += 1;
    }
    if (sumW <= 0 || n < 2) return null;
    const cx = sumX / sumW;
    const cy = sumY / sumW;
    const halfW = Math.max(munW * 0.35 / 2, 2000);
    const halfH = Math.max(munH * 0.35 / 2, 2000);
    return [cx - halfW, cy - halfH, cx + halfW, cy + halfH];
  };

  if (hasManifest) {
    // Régimen A: top-K secciones por building_count, unión de bboxes.
    const withCounts = secciones
      .map(s => ({ s, w: s._buildingCount || 0 }))
      .filter(o => o.w > 0)
      .sort((a, b) => b.w - a.w);
    if (withCounts.length < 2) return null;
    const total = withCounts.reduce((acc, o) => acc + o.w, 0);
    if (total <= 0) return null;
    const target = total * coverageFrac;
    const picked = [];
    let acc = 0;
    for (const o of withCounts) {
      picked.push(o.s);
      acc += o.w;
      if (acc >= target) break;
    }
    mnx = Infinity; mny = Infinity; mxx = -Infinity; mxy = -Infinity;
    for (const s of picked) {
      const ring = s._ring || s._ringSimple;
      if (!ring) continue;
      const [a, b, c, e] = ringBbox(ring);
      if (a < mnx) mnx = a; if (b < mny) mny = b;
      if (c > mxx) mxx = c; if (e > mxy) mxy = e;
    }
    if (!isFinite(mnx)) return null;
    // Si el bbox unión sigue cubriendo casi todo el mun (caso Tejeda:
    // 2 secciones que cada una abarca todo el polígono), pasamos a
    // régimen B con building_count como peso (en vez de 1/area).
    if ((mxx - mnx) >= munW * 0.9 && (mxy - mny) >= munH * 0.9) {
      const fb = buildFocalBox(s => s._buildingCount || 0);
      if (fb) [mnx, mny, mxx, mxy] = fb;
    }
  } else {
    // Régimen B: fallback prov 38 sin manifest. Centroide ponderado
    // por 1/area + caja focal. Sin manifest las secciones son
    // geográficamente amplias así que el bbox unión no comprime; en
    // cambio el centroide pesado por densidad cae cerca del pueblo.
    const fb = buildFocalBox(s => {
      const a = ringAreaM(s._ring || s._ringSimple);
      return a > 0 ? 1 / a : 0;
    });
    if (!fb) return null;
    [mnx, mny, mxx, mxy] = fb;
  }

  // Padding extra si el bbox queda excesivamente compacto.
  let pw = mxx - mnx;
  let ph = mxy - mny;
  const ratioW = pw / munW;
  const ratioH = ph / munH;
  if (ratioW < 0.3 || ratioH < 0.3) {
    const cx = (mnx + mxx) / 2;
    const cy = (mny + mxy) / 2;
    pw = Math.max(pw, 1) * 1.4;
    ph = Math.max(ph, 1) * 1.4;
    mnx = cx - pw / 2;
    mxx = cx + pw / 2;
    mny = cy - ph / 2;
    mxy = cy + ph / 2;
  }

  // Clamp al bbox del mun.
  mnx = Math.max(mnx, umnx);
  mny = Math.max(mny, umny);
  mxx = Math.min(mxx, umxx);
  mxy = Math.min(mxy, umxy);

  // Si el clamp deja un bbox degenerado (igual o casi igual al del mun),
  // no aporta: devolvemos null y caller usa el bbox del mun.
  if (mxx - mnx >= munW * 0.95 && mxy - mny >= munH * 0.95) return null;

  return [mnx, mny, mxx, mxy];
}

async function enterMunicipio(mun, animate = true, restoreView = null) {
  if (state.lodLevel !== "municipio") saveParentViewport(state.lodLevel);

  document.getElementById("banner-sub").textContent = `cargando municipio ${mun}…`;
  state.municipio = await loadMunicipio(mun);
  state.lodLevel = "municipio";
  state.district = null;
  state.barrio = null;
  state.section = null;
  state.manzana = null;
  state.selectedManzanaId = null;
  state.hoverFeature = null;
  closeSidePanel();

  // [H] Fase 1 — Decidir bbox de entrada según densidad. Muns rurales
  // grandes con núcleo concentrado (Valverde EH, Tejeda GC, synthetic-
  // mun de toda Tenerife/LP/LG/EH) aterrizaban en barranco vacío. La
  // regla del brief decía "≥6 secciones y ≥200 buildings", pero Valverde
  // tiene solo 3 secciones y Tejeda solo 2 (los casos a resolver), así
  // que relajamos a ≥2 secciones. Si hay manifest (alguna sec con
  // _buildingCount>0) exigimos también ≥200 totales. Para prov 38 sin
  // manifest, densityFocusedBbox usa el fallback 1/area. Si el helper
  // devuelve null (1 sec, todo cero, o bbox degenerado), caemos al bbox
  // del mun (zero regresión en LPGC y muns urbanos densos).
  const secs = state.municipio.secciones || [];
  const totalBuildings = secs.reduce((a, s) => a + (s._buildingCount || 0), 0);
  const hasManifest = totalBuildings > 0;
  let entryBbox = state.municipio.bbox;
  // ≥2 secciones para que tenga sentido elegir un subset.
  // Si hay manifest, exigimos ≥200 buildings totales (filtra outliers
  // con datos pobres). Sin manifest (prov 38) bypass del threshold.
  const meetsThreshold = secs.length >= 2 &&
    (!hasManifest || totalBuildings >= 200);
  if (meetsThreshold) {
    const focused = densityFocusedBbox(secs, state.municipio.bbox, 0.8);
    if (focused) entryBbox = focused;
  }
  const fitNew = fitView(entryBbox,
                         window.innerWidth, window.innerHeight, 90, "municipio");
  if (!restoreView) {
    const popCenter = populationWeightedCenter(state.municipio.secciones);
    if (popCenter) { fitNew.tx = popCenter[0]; fitNew.ty = popCenter[1]; }
  }
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
  // Tablero cívico: recalcular métricas con el state ya cargado del nivel
  // destino. El hook desde renderer también dispara, pero ahí el state
  // a veces aún no está poblado (la transición es asíncrona); aquí
  // garantizamos un refresh "final" con datos completos.
  if (state._refreshDashboard) state._refreshDashboard();
  // Safety: si el splash quedó visible por una transición previa, ocultar.
  document.getElementById("loader")?.classList.add("hidden");
}

async function enterDistrito(distritoId, animate = true, restoreView = null) {
  if (state.lodLevel !== "distrito") saveParentViewport(state.lodLevel);

  document.getElementById("banner-sub").textContent =
    `cargando distrito ${distritoId}…`;
  state.district = await loadDistrito(distritoId);
  state.lodLevel = "distrito";
  state.barrio = null;
  state.section = null;
  state.manzana = null;
  state.selectedManzanaId = null;
  state.hoverFeature = null;
  closeSidePanel();

  const fitNew = fitView(state.district.bbox,
                         window.innerWidth, window.innerHeight, 90, "distrito");
  if (!restoreView) {
    const popCenter = populationWeightedCenter(state.district.secciones);
    if (popCenter) { fitNew.tx = popCenter[0]; fitNew.ty = popCenter[1]; }
  }
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
  // Tablero cívico: recalcular métricas con el state ya cargado del nivel
  // destino. El hook desde renderer también dispara, pero ahí el state
  // a veces aún no está poblado (la transición es asíncrona); aquí
  // garantizamos un refresh "final" con datos completos.
  if (state._refreshDashboard) state._refreshDashboard();
  _hideLoader();
}

// 2026-05-26 — enterVecindario: nivel intermedio auto-cluster entre
// sección y barrio/distrito. Útil cuando el barrio es sintético-mun
// (e.g. SC Tenerife "038-santa-cruz-de-tenerife-mun" con 165 secciones,
// 21×19 km de bbox): el back desde sección caería en un vacío gigante.
//
// El vecindario es: la sección focal + las N secciones más cercanas
// (por centroide) dentro de un RADIUS_M. Se carga peresozamente como
// mini-distrito (mismo schema que state.district) para reusar render
// y navegación.
//
// Persiste como state.vecindario; lodLevel === "vecindario". Back cae
// al municipio (saltando distrito/barrio porque ya son padres del foco).
const VECINDARIO_MAX_N = 12;
const VECINDARIO_RADIUS_M = 1200;

// 2026-05-26 — Cache de secciones por isla (lite + proyectadas a anchor GC
// con _centroid). Para 1-mun secciones aisladas (mun "035" Lanzarote o
// Garafía, Frontera EH) el vecindario tiene que cruzar muns; iteramos
// todas las secciones de la isla.
async function loadIslaSections(islaId) {
  if (!state._islaSecsByIsla) state._islaSecsByIsla = new Map();
  if (state._islaSecsByIsla.has(islaId)) {
    return state._islaSecsByIsla.get(islaId);
  }
  const isProv38 = PROV38_ISLAS.has(islaId);
  const url = isProv38
    ? "../prov38-secciones-lite.json"
    : "../gc-secciones-lite.json";
  const fc = await fetch(url).then(r => r.json());
  const out = [];
  for (const f of fc.features) {
    // Filtrar por isla via inferIslaFromMun (gc-secciones-lite incluye
    // GC + FV + LZ; prov38-secciones-lite incluye TF/LP/LG/EH).
    if (inferIslaFromMun(f.properties.mun) !== islaId) continue;
    const ring = outerRing(f.geometry);
    if (!ring) continue;
    const ringM = ring.map(([lng, lat]) =>
      lnglatToLocalMeters(lng, lat, GC_ANCHOR_LNGLAT));
    f._ring = ringM;
    f._ringSimple = simplifyRing(ringM, 6);
    f._centroid = ringCentroid(ringM);
    out.push(f);
  }
  state._islaSecsByIsla.set(islaId, out);
  return out;
}

async function loadVecindario(focalCusec) {
  const mun = focalCusec.slice(2, 5);
  // Asegurar que el municipio del focal está cargado (para tener state.municipio
  // poblado para breadcrumb y back-nav).
  const munObj = state.municipio?.mun === mun
    ? state.municipio
    : await loadMunicipio(mun);

  // 2026-05-26 — Iterar secciones de TODA la isla (no solo el mun) para
  // resolver casos rurales/aislados: 7 muns en Canarias tienen 1 sección
  // sola, varios más tienen 2. El vecindario tiene que poder cruzar el
  // límite municipal para encontrar vecinas geográficas reales.
  const islaId = inferIslaFromMun(mun) || state.isla?.id;
  const allSecs = islaId
    ? await loadIslaSections(islaId)
    : (() => {
        const tmp = [];
        for (const d of munObj.distList) {
          for (const s of d.secciones) tmp.push(s);
        }
        return tmp;
      })();
  const focal = allSecs.find(s => s.properties.cusec === focalCusec);
  if (!focal) {
    throw new Error(`vecindario: sección ${focalCusec} no en isla ${islaId}`);
  }

  // Filtrar y ordenar por distancia al cuadrado al centroide focal.
  const [fcx, fcz] = focal._centroid;
  const R2 = VECINDARIO_RADIUS_M * VECINDARIO_RADIUS_M;
  const candidatos = allSecs
    .map(s => {
      const [cx, cz] = s._centroid;
      return { s, d2: (cx - fcx) ** 2 + (cz - fcz) ** 2 };
    })
    .filter(o => o.d2 <= R2)
    .sort((a, b) => a.d2 - b.d2)
    .slice(0, VECINDARIO_MAX_N);
  const vecSecs = candidatos.map(o => o.s);

  // Si la focal quedó sola (radio sin vecinas), incluir al menos las 5 más cercanas
  if (vecSecs.length < 2 && allSecs.length > 1) {
    const expand = allSecs
      .map(s => {
        const [cx, cz] = s._centroid;
        return { s, d2: (cx - fcx) ** 2 + (cz - fcz) ** 2 };
      })
      .sort((a, b) => a.d2 - b.d2)
      .slice(0, Math.min(5, allSecs.length));
    vecSecs.splice(0, vecSecs.length, ...expand.map(o => o.s));
  }

  document.getElementById("banner-sub").textContent =
    `cargando vecindario · ${vecSecs.length} secciones…`;

  // Carga peresoza de packs (mismo patrón que loadDistrito).
  const packPromises = vecSecs.map(async (sFeat) => {
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
      console.warn(`vecindario: fallo cargando ${cusec}`, e);
      return null;
    }
  });
  const sectionPacks = (await Promise.all(packPromises)).filter(Boolean);

  // Aplanar manzanas/edificios/roads y calcular bbox.
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

  // Schema compatible con state.district para reusar renderDistrito.
  return {
    distritoId: `vec-${focalCusec}`,
    dis: focalCusec.slice(5, 7),
    mun,
    nmun: munObj.nmun,
    secciones: vecSecs,
    sectionPacks,
    buildings: sortByDepth(buildings),
    manzanas: sortByDepth(manzanas),
    roads,
    bbox: [mnx, mny, mxx, mxy],
    totalBuildings: buildings.length,
    secStats: { t1: 0, t2: Infinity },
    districtOutline: null,
    neighborDistricts: [],
    _isVecindario: true,
    _focalCusec: focalCusec,
  };
}

async function enterVecindario(focalCusec, animate = true, restoreView = null) {
  if (state.lodLevel !== "vecindario") saveParentViewport(state.lodLevel);

  state.vecindario = await loadVecindario(focalCusec);
  state.lodLevel = "vecindario";
  state.section = null;
  state.manzana = null;
  state.selectedManzanaId = null;
  state.selectedSeccionCusec = focalCusec;
  state.hoverFeature = null;
  closeSidePanel();

  const fitNew = fitView(state.vecindario.bbox,
                         window.innerWidth, window.innerHeight, 60, "distrito");
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
  if (state._refreshDashboard) state._refreshDashboard();
  _hideLoader();
}

// v1.6.barrio — Entra al nivel barrio (hijo directo del municipio).
// Estructuralmente análogo a enterDistrito; setea state.barrio con la
// misma forma que state.district para que renderDistrito y overlays
// (renta) lo consuman sin modificaciones.
async function enterBarrio(barrioId, animate = true, restoreView = null) {
  if (state.lodLevel !== "barrio") saveParentViewport(state.lodLevel);

  document.getElementById("banner-sub").textContent =
    `cargando barrio ${barrioId}…`;
  state.barrio = await loadBarrio(barrioId);
  state.lodLevel = "barrio";
  // Vaciamos district/section para evitar ambigüedad de overlays que
  // consultan ambos sin discriminar por lodLevel.
  state.district = null;
  state.section = null;
  state.manzana = null;
  state.selectedManzanaId = null;
  state.selectedSeccionCusec = null;
  if (window.polisApp?._syncSeccionDetalleToggle) window.polisApp._syncSeccionDetalleToggle();
  state.hoveredSeccionCusec = null;
  state.hoverFeature = null;
  closeSidePanel();

  // Usa preset "barrio" (sz 1.5, entry 2.5×) para zoom de entrada cerrado.
  // 2026-05-22 — paddingPx bajado de 60 → 40 para reducir aire muerto
  // alrededor del barrio. El fitScale resultante (referencia del cap
  // maxZoomRatio) se vuelve un poco más grande, lo que ayuda al
  // minScale de la silueta a no quedarse corto en barrios irregulares.
  const fitNew = fitView(state.barrio.bbox,
                         window.innerWidth, window.innerHeight, 40, "barrio");
  // v1.6.barrio-frame-silhouette — Encuadre real sobre la silueta de
  // manzanas, no sobre el world-bbox. Razones:
  //  · el world-bbox de un barrio puede ser mayor que el rectángulo
  //    que ocupan sus manzanas (secciones colindantes con vacíos,
  //    bordes irregulares, etc.) — eso dejaba aire muerto.
  //  · y el centroide de la silueta rara vez coincide con el centro
  //    del world-bbox para barrios irregulares (Vegueta, costeros) —
  //    la silueta caía a un lado y se salía del viewport.
  // Calculamos directamente el bbox de las manzanas en iso-space, y
  // resolvemos tx/ty para que su centro caiga en (cx, cy) y scale
  // para que llene ~70% del viewport vertical (con respeto al cap del
  // preset, maxZoomRatio 2.5×).
  if (state.barrio.manzanas?.length) {
    const ax = fitNew.ax ?? 30, ay = fitNew.ay ?? 30;
    const cax = Math.cos(ax * Math.PI / 180);
    const say = Math.sin(ay * Math.PI / 180);
    let Xmn = Infinity, Xmx = -Infinity, Ymn = Infinity, Ymx = -Infinity;
    for (const m of state.barrio.manzanas) {
      const ring = m._ringSimple || m._ring;
      if (!ring) continue;
      for (const [x, z] of ring) {
        const X = (x - z) * cax;
        const Y = (x + z) * say;
        if (X < Xmn) Xmn = X;
        if (X > Xmx) Xmx = X;
        if (Y < Ymn) Ymn = Y;
        if (Y > Ymx) Ymx = Y;
      }
    }
    if (Xmn < Infinity) {
      const silW = Xmx - Xmn, silH = Ymx - Ymn;
      const Xc = (Xmn + Xmx) / 2, Yc = (Ymn + Ymx) / 2;
      // tx, ty del view son world-coords; tx-ty proyecta a X/cax,
      // tx+ty proyecta a Y/say. Solve.
      const txMinusTy = Xc / cax;
      const txPlusTy = Yc / say;
      fitNew.tx = (txMinusTy + txPlusTy) / 2;
      fitNew.ty = (txPlusTy - txMinusTy) / 2;
      // Escala objetivo: vertical-first — la silueta llena ~72% del
      // alto de viewport, aceptando overflow horizontal (doctrina
      // documentada: la iso-bbox es √3:1 fija y los barrios reales son
      // irregulares; el "overflow" es del aire del bbox, no de la
      // silueta). Cap suave en horizontal a 3.5× viewport para que un
      // barrio costero muy alargado no desaparezca por los lados pero
      // permitiendo el overflow inherente al ratio iso √3:1 en móvil
      // portrait.
      // 2026-05-22 — FILL_V subido de 0.70 → 0.82 porque el usuario
      // reportaba que la silueta llegaba al 35-45% del viewport real
      // (no al 70% teórico). El cap horizontal antiguo (2.5×) y el
      // factor de banner/membrete reducían el target efectivo. Con
      // 0.82 el barrio queda enmarcado con autoridad y el aire vertical
      // arriba/abajo es justo banner+membrete y hint.
      // Cap horizontal subido de 2.5× → 3.5× para que el targetScaleV
      // no quede recortado por el ancho en desktop con barrios anchos.
      const FILL_V = 0.82;
      const targetScaleV = (window.innerHeight * FILL_V) / Math.max(silH, 1);
      const maxScaleHoverflow = (window.innerWidth * 3.5) / Math.max(silW, 1);
      const targetScale = Math.min(targetScaleV, maxScaleHoverflow);
      // No bajar de fitScale (mantiene continuidad si la silueta es
      // diminuta vs su bbox).
      const minScale = fitNew.fitScale || fitNew.scale;
      fitNew.scale = Math.max(minScale, targetScale);
      if (fitNew.maxScale < fitNew.scale * 1.4) {
        fitNew.maxScale = fitNew.scale * 1.4;
      }
    }
  }
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
  // Tablero cívico: recalcular métricas con el state ya cargado del nivel
  // destino. El hook desde renderer también dispara, pero ahí el state
  // a veces aún no está poblado (la transición es asíncrona); aquí
  // garantizamos un refresh "final" con datos completos.
  if (state._refreshDashboard) state._refreshDashboard();
  // Safety: si el splash quedó visible por una transición previa, ocultar.
  document.getElementById("loader")?.classList.add("hidden");
}

// v1.6.manzana (Phase 2b) — Resuelve una manzana del barrio actual a su
// representación interna. El `manzanaId` es compuesto: `"<cusec>-<localId>"`
// (string), donde localId es el `properties.id` de la manzana en su pack
// de sección. Buscamos en `state.barrio.manzanas` por _cusec+id, calculamos
// el bbox del anillo, y filtramos los edificios del barrio que pertenezcan
// a esa manzana por (cusec, manzana_id).
//
// Devuelve null si el id no existe en el barrio (caso de deep link a una
// manzana inexistente o de un barrio no cargado).
function loadManzana(manzanaId) {
  // Fuente de manzanas/edificios: el barrio (GC, con barrios canonical) o
  // —cuando no hay barrio— la sección activa (resto de islas, donde no
  // existen barrios identitarios). Ambas estructuras exponen la misma
  // forma: manzanas[] con _cusec/_ring/properties.id y buildings[] con
  // _cusec/properties.manzana_id. Esto da paridad de drill-down a edificio
  // en las 7 islas, no solo en Gran Canaria.
  const src = (state.barrio && state.barrio.manzanas) ? state.barrio
            : (state.section && state.section.manzanas) ? state.section
            : null;
  if (!src) return null;
  const dashIdx = String(manzanaId).lastIndexOf("-");
  if (dashIdx <= 0) return null;
  const cusec = manzanaId.slice(0, dashIdx);
  const localId = parseInt(manzanaId.slice(dashIdx + 1), 10);
  if (Number.isNaN(localId)) return null;

  // Localizar el feature de manzana en la fuente.
  const feature = src.manzanas.find(m =>
    m._cusec === cusec && m.properties.id === localId);
  if (!feature) return null;

  // bbox local en metros (anchor GC, igual sistema que barrio/sección).
  const bbox = ringBbox(feature._ring);

  // Edificios de la manzana: filtro O(N) sobre los edificios de la fuente.
  const buildings = src.buildings.filter(b =>
    b._cusec === cusec && b.properties.manzana_id === localId);

  return {
    id: manzanaId,
    manzanaId: localId,
    cusec,
    feature,
    geometry: feature._ring,
    bbox_local_m: bbox,
    buildings
  };
}

// v1.6.manzana (Phase 2b) — Entra al nivel manzana (quinto del LOD,
// hijo del barrio). Se anima la cámara a un zoom muy cerrado (ENTRY_ZOOM
// 3.5×) para que los edificios queden grandes y tappables en móvil.
// Requiere `state.barrio` cargado: se llama típicamente desde handleTap
// (tap sobre polígono de manzana en lodLevel=barrio) o desde el deep
// link `?manzana=<id>&barrio=<barrioId>` (resuelto en boot).
async function enterManzana(manzanaId, opts = {}) {
  const animate = opts.animate !== false;
  const restoreView = opts.restoreView || null;
  if (state.lodLevel !== "manzana") saveParentViewport(state.lodLevel);

  const manz = loadManzana(manzanaId);
  if (!manz) {
    console.warn(`[manzana] no se pudo cargar "${manzanaId}" (barrio ${state.barrio?.barrioId})`);
    return;
  }

  // v1.6.manzana — Capturamos el nivel-padre ANTES de promover lodLevel,
  // para diferir el swap visual: renderer.js seguirá pintando el barrio/
  // sección mientras la cámara vuela (state.renderLevel + state._anim).
  const prevLevel = state.lodLevel;

  state.manzana = manz;
  state.lodLevel = "manzana";
  // Vaciamos selecciones de niveles hermanos/padres para evitar
  // ghost-highlights del barrio sobre el render de manzana.
  state.selectedManzanaId = null;
  state.selectedSeccionCusec = null;
  if (window.polisApp?._syncSeccionDetalleToggle) window.polisApp._syncSeccionDetalleToggle();
  state.hoveredSeccionCusec = null;
  state.hoverFeature = null;
  closeSidePanel();

  // fitView con preset manzana (sz 1.4, entry 3.5×). El bbox es el de la
  // propia manzana, así que ocupa casi toda la pantalla.
  const fitNew = fitView(manz.bbox_local_m,
                         window.innerWidth, window.innerHeight, 60, "manzana");
  const newView = restoreView ? mergeRestoredView(fitNew, restoreView) : fitNew;

  // Diferimos el swap de render: mientras dura el vuelo (animate y venimos
  // de un nivel distinto a manzana) seguimos pintando el nivel-padre; el
  // onDone lo limpia al aterrizar para que aparezca la manzana de golpe ya
  // con la cámara en su sitio (sin "pop" del contexto del barrio).
  if (animate && prevLevel && prevLevel !== "manzana") {
    state.renderLevel = prevLevel;
    applyNewView(newView, animate, () => { state.renderLevel = null; requestRender(); });
  } else {
    state.renderLevel = null;
    applyNewView(newView, animate);
  }

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
  if (state._refreshDashboard) state._refreshDashboard();
  // Safety: si el splash quedó visible por una transición previa, ocultar.
  document.getElementById("loader")?.classList.add("hidden");
}

// v1.6.manzana (Phase 2b) — Hook tap sobre edificio dentro del nivel
// manzana. Phase 2c implementará el modal de edificio focal. Por ahora
// sólo loguea y deja la última selección expuesta vía `window.polisApp`.
function onBuildingTap(buildingId, manzanaId) {
  console.log("[building tap]", buildingId, "en manzana", manzanaId);
  if (typeof window !== "undefined") {
    window.polisApp = window.polisApp || {};
    window.polisApp.lastBuildingTap = {
      buildingId, manzanaId, at: Date.now()
    };
  }
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
  state.manzana = null;

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
  // Tablero cívico: recalcular métricas con el state ya cargado del nivel
  // destino. El hook desde renderer también dispara, pero ahí el state
  // a veces aún no está poblado (la transición es asíncrona); aquí
  // garantizamos un refresh "final" con datos completos.
  if (state._refreshDashboard) state._refreshDashboard();
  _hideLoader();
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
    // v1.6 — Easing escalonado para los ángulos: el pan/zoom usa
    // easeInOut (suave en todo el rango), pero ax/ay/sz_factor se
    // congelan al valor SOURCE durante el primer 55 % del tiempo y
    // sólo transicionan en el último 45 %. Antes la interpolación
    // simétrica producía un estado intermedio "aplastado" muy visible
    // (la isla a ax=15° se ve compresada). Ahora la cámara primero
    // hace pan/zoom sin tocar el tilt y, ya cerca del destino, hace
    // el tilt corto y limpio.
    const ANGLE_HOLD = 0.55;
    const kAngle = k <= ANGLE_HOLD
      ? 0
      : easeInOut((k - ANGLE_HOLD) / (1 - ANGLE_HOLD));
    state.view = {
      scale: lerp(a.from.scale, a.to.scale, k),
      minScale: lerp(a.from.minScale, a.to.minScale, k),
      maxScale: lerp(a.from.maxScale, a.to.maxScale, k),
      fitScale: lerp(a.from.fitScale, a.to.fitScale, k),
      cx: lerp(a.from.cx, a.to.cx, k),
      cy: lerp(a.from.cy, a.to.cy, k),
      tx: lerp(a.from.tx, a.to.tx, k),
      ty: lerp(a.from.ty, a.to.ty, k),
      ax: lerp(a.from.ax ?? 30, a.to.ax ?? 30, kAngle),
      ay: lerp(a.from.ay ?? 30, a.to.ay ?? 30, kAngle),
      sz_factor: lerp(a.from.sz_factor ?? 1.4, a.to.sz_factor ?? 1.4, kAngle),
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
  // [OCRE-SKIN F5b] Sincroniza la siluetas-strip con el nivel actual
  // (independiente del membrete, que está oculto en skin-ocre).
  try { updateSiluetasStripActive(); } catch (_) {}
  // [OCRE-SKIN] Actualizar también el caption del bottom-bar paper.
  try { updateBottomBarCaption(); } catch (_) {}
  // [OCRE-SKIN 2026-05-25] Sincroniza visibilidad del back-button del topbar.
  try { syncTopbarBack(); } catch (_) {}
  // v1.7.membrete — Render del membrete flotante. Cadena de padres
  // en línea superior (pequeña, cada segmento clicable navega a su
  // nivel). Línea inferior: nivel actual con meta descriptiva.
  const parentsEl = document.getElementById("mb-parents");
  const currentEl = document.getElementById("mb-current");
  if (!parentsEl || !currentEl) return;
  // Cerrar cualquier dropdown abierto antes de re-render.
  _closeBreadcrumbDropdown();
  parentsEl.innerHTML = "";
  currentEl.innerHTML = "";
  const segs = [];
  // 2026-05-19 — Raíz: archipielago siempre presente.
  segs.push({ label: "Canarias", level: "archipielago" });
  // Isla — siempre presente si lodLevel >= isla.
  if (state.lodLevel === "isla" || state.lodLevel === "municipio" ||
      state.lodLevel === "distrito" || state.lodLevel === "barrio" ||
      state.lodLevel === "seccion" || state.lodLevel === "manzana") {
    const islaId = state.isla?.id
                   || inferIslaFromMun(state.municipio?.mun
                                       || state.district?.mun
                                       || state.barrio?.mun
                                       || state.section?.meta?.mun)
                   || "gc";
    const islaName = state.isla?.name
                     || state.archipielago?.islands?.find(f => f.properties.isla === islaId)?.properties?.name
                     || islaId.toUpperCase();
    segs.push({ label: islaName, level: "isla", islaId });
  }
  if (state.lodLevel === "municipio" || state.lodLevel === "distrito" ||
      state.lodLevel === "barrio" || state.lodLevel === "vecindario" ||
      state.lodLevel === "seccion" || state.lodLevel === "manzana") {
    const nmun = state.municipio?.nmun
                 || state.district?.nmun
                 || state.barrio?.nmun
                 || state.vecindario?.nmun
                 || state.isla?.municipios?.find(m => m.properties.mun ===
                     (state.section?.meta.mun || ""))?.properties.nmun
                 || "?";
    const munCode = state.municipio?.mun || state.district?.mun
                    || state.barrio?.mun || state.vecindario?.mun
                    || state.section?.meta.mun;
    segs.push({ label: shortName(nmun), level: "municipio", mun: munCode });
  }
  // 2026-05-26 — Vecindario como segmento del breadcrumb (entre mun y sección).
  if (state.lodLevel === "vecindario" || state.lodLevel === "seccion") {
    const vec = state.vecindario;
    if (vec) {
      segs.push({
        label: "Vecindario",
        level: "vecindario",
        cusec: vec._focalCusec,
      });
    }
  }
  // v1.6.barrio — segmento intermedio "Barrio" (GC, con barrios canonical).
  // En manzana SIN barrio (resto de islas: la manzana cuelga directamente
  // de una sección) insertamos en su lugar la cadena Distrito › Sección,
  // para que el breadcrumb sea navegable y no se asuma state.barrio.
  if ((state.lodLevel === "barrio" || state.lodLevel === "manzana") && state.barrio) {
    segs.push({ label: state.barrio.name, level: "barrio",
                barrioId: state.barrio.barrioId });
  } else if (state.lodLevel === "manzana" && !state.barrio && state.manzana?.cusec) {
    const c = state.manzana.cusec;
    segs.push({ label: "Distrito " + c.slice(5, 7), level: "distrito",
                distritoId: c.slice(2, 7) });
    segs.push({ label: "Sección " + c.slice(-3), level: "seccion", cusec: c });
  }
  // v1.6.manzana (Phase 2b) — segmento hoja "Manzana N" mostrando el
  // localId (el composite id no es legible al humano). Tap en este
  // segmento no-op (es current); tap en barrio segment vuelve al barrio.
  if (state.lodLevel === "manzana") {
    segs.push({
      label: `Manzana ${state.manzana.manzanaId}`,
      level: "manzana",
      manzanaId: state.manzana.id
    });
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
  // Última seg = nivel actual (línea inferior, italic bold grande).
  // Resto = cadena de padres (línea superior pequeña con flechas).
  // En isla solo hay un seg (Gran Canaria) → parentsEl queda vacío.
  const current = segs[segs.length - 1];
  const parents = segs.slice(0, -1);
  parents.forEach((s, i) => {
    if (i > 0) {
      const sep = document.createElement("span");
      sep.className = "mb-sep"; sep.textContent = " › ";
      parentsEl.appendChild(sep);
    }
    const btn = document.createElement("button");
    btn.className = "mb-parent";
    btn.dataset.level = s.level;
    if (s.mun) btn.dataset.mun = s.mun;
    if (s.cusec) btn.dataset.cusec = s.cusec;
    if (s.distritoId) btn.dataset.distritoId = s.distritoId;
    if (s.barrioId) btn.dataset.barrioId = s.barrioId;
    if (s.manzanaId) btn.dataset.manzanaId = s.manzanaId;
    if (s.islaId) btn.dataset.islaId = s.islaId;
    btn.textContent = s.label + " ▾";
    btn.title = "Hermanos a este nivel";
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      _openBreadcrumbDropdown(s, btn);
    });
    parentsEl.appendChild(btn);
  });
  // Línea actual: label + meta descriptiva del nivel (edificios, etc.).
  // Meta se construye según lodLevel, igual que updateBannerSub pero
  // sólo la cola informativa (sin repetir el nombre del nivel).
  let meta = "";
  if (state.lodLevel === "archipielago") {
    meta = `${state.archipielago.islands.length} islas`;
  } else if (state.lodLevel === "isla") {
    meta = `${state.isla.municipios.length} municipios`;
  } else if (state.lodLevel === "municipio") {
    meta = `${state.municipio.secciones.length} secciones`;
  } else if (state.lodLevel === "distrito") {
    meta = `${state.district.totalBuildings.toLocaleString("es")} edificios`;
  } else if (state.lodLevel === "barrio") {
    meta = `${state.barrio.totalBuildings.toLocaleString("es")} edificios`;
  } else if (state.lodLevel === "manzana") {
    meta = `${state.manzana.buildings.length} edificios`;
  } else if (state.lodLevel === "vecindario") {
    meta = state.vecindario
      ? `${state.vecindario.secciones.length} secciones · ${state.vecindario.totalBuildings.toLocaleString("es")} edificios`
      : "";
  } else if (state.lodLevel === "seccion") {
    meta = `${state.section.manzanas.length} manzanas`;
  }
  // [I] ITB v2 — la meta numérica va en su propio span con font-mono.
  // Se pinta sólo si existe; en archipielago el label "Canarias" sigue
  // pudiendo lucir su meta de islas en mono al lado.
  currentEl.textContent = current.label;
  if (meta) {
    const metaEl = document.createElement("span");
    metaEl.className = "mb-meta"; // [I]
    metaEl.textContent = meta;
    currentEl.appendChild(document.createTextNode(" "));
    currentEl.appendChild(metaEl);
  }
}

function onBreadcrumb(seg) {
  if (seg.level === state.lodLevel &&
      ((seg.level === "municipio" && seg.mun === state.municipio?.mun) ||
       (seg.level === "distrito" && seg.distritoId === state.district?.distritoId) ||
       (seg.level === "barrio" && seg.barrioId === state.barrio?.barrioId) ||
       (seg.level === "vecindario" && seg.cusec === state.vecindario?._focalCusec) ||
       (seg.level === "manzana" && seg.manzanaId === state.manzana?.id) ||
       (seg.level === "seccion" && seg.cusec === state.section?.meta.cusec) ||
       (seg.level === "isla" && seg.islaId === state.isla?.id) ||
        seg.level === "archipielago")) return;
  if (seg.level === "archipielago") enterArchipielago(true);
  else if (seg.level === "isla") enterIsla(seg.islaId || "gc", true);
  else if (seg.level === "municipio") enterMunicipio(seg.mun, true);
  else if (seg.level === "distrito") enterDistrito(seg.distritoId, true);
  else if (seg.level === "barrio") enterBarrio(seg.barrioId, true);
  else if (seg.level === "vecindario") enterVecindario(seg.cusec, true);
  else if (seg.level === "manzana") enterManzana(seg.manzanaId, { animate: true });
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

// 2026-05-19 — Dropdown desplegable del membrete.
//
// Cada segmento `mb-parent` (Canarias / Tenerife / Adeje / …) abre al
// click un dropdown vertical con sus HERMANOS al mismo nivel jerárquico.
// Pick un hermano → navega a ese nivel y los niveles inferiores se
// resetean. Cierre por click fuera, ESC o selección.
//
// La lista de hermanos se calcula on-the-fly según el state:
//   archipielago → 7 islas
//   isla         → muns de esa isla (vía state._canariasMuns)
//   municipio    → barrios del mun activo (state.municipio.barriosPiezas)
//   distrito     → distritos del mun activo
//   barrio       → barrios hermanos del mun
//   seccion      → secciones del distrito
//   manzana      → manzanas del barrio (ordenadas por building_count desc)

let _breadcrumbDropdownEl = null;
let _breadcrumbDropdownCleanup = null;

function _closeBreadcrumbDropdown() {
  if (_breadcrumbDropdownEl) {
    _breadcrumbDropdownEl.remove();
    _breadcrumbDropdownEl = null;
  }
  if (_breadcrumbDropdownCleanup) {
    _breadcrumbDropdownCleanup();
    _breadcrumbDropdownCleanup = null;
  }
}

function _openBreadcrumbDropdown(seg, anchorBtn) {
  _closeBreadcrumbDropdown();
  const items = _siblingsForSegment(seg);
  if (!items || !items.length) return;

  const dd = document.createElement("div");
  dd.className = "mb-dropdown";
  dd.setAttribute("role", "menu");
  for (const it of items) {
    const li = document.createElement("button");
    li.type = "button";
    li.className = "mb-dropdown-item";
    if (it.active) li.classList.add("active");
    li.textContent = it.label;
    if (it.sub) {
      const sub = document.createElement("span");
      sub.className = "mb-dropdown-sub";
      sub.textContent = " · " + it.sub;
      li.appendChild(sub);
    }
    li.addEventListener("click", (ev) => {
      ev.stopPropagation();
      _closeBreadcrumbDropdown();
      it.action();
    });
    dd.appendChild(li);
  }
  document.body.appendChild(dd);

  // Posicionado bajo el botón ancla, centrado horizontalmente, clamp a viewport.
  const r = anchorBtn.getBoundingClientRect();
  const ddRect = dd.getBoundingClientRect();
  let left = r.left + r.width / 2 - ddRect.width / 2;
  const margin = 8;
  left = Math.max(margin, Math.min(window.innerWidth - ddRect.width - margin, left));
  dd.style.left = left + "px";
  dd.style.top = (r.bottom + 6) + "px";

  _breadcrumbDropdownEl = dd;
  const onDoc = (ev) => {
    if (!dd.contains(ev.target) && ev.target !== anchorBtn) _closeBreadcrumbDropdown();
  };
  const onKey = (ev) => {
    if (ev.key === "Escape") _closeBreadcrumbDropdown();
  };
  // Pequeño delay para que el click que lo abrió no lo cierre.
  setTimeout(() => document.addEventListener("click", onDoc), 0);
  document.addEventListener("keydown", onKey);
  _breadcrumbDropdownCleanup = () => {
    document.removeEventListener("click", onDoc);
    document.removeEventListener("keydown", onKey);
  };
}

// Devuelve los hermanos para un segmento del membrete. Cada item:
//   { label, sub?, active?, action: () => void }
function _siblingsForSegment(seg) {
  const out = [];
  if (seg.level === "archipielago") {
    // 2026-05-20 — Click en "Canarias" muestra: opción para volver al
    // archipiélago entero + las 7 islas para saltar lateral.
    out.push({
      label: "↑ Canarias (todas)",
      sub: `${state.archipielago.islands.length} islas`,
      active: state.lodLevel === "archipielago",
      action: () => enterArchipielago(true)
    });
    const islands = state.archipielago?.islands || [];
    for (const f of islands) {
      const p = f.properties;
      out.push({
        label: p.name,
        sub: `${p.muns_count} muns · ${p.sections_count} sec`,
        active: state.isla?.id === p.isla,
        action: () => enterIsla(p.isla, true)
      });
    }
    return out;
  }
  if (seg.level === "isla") {
    // Hermanos = las 7 islas del archipiélago.
    const islands = state.archipielago?.islands || [];
    for (const f of islands) {
      const p = f.properties;
      out.push({
        label: p.name,
        sub: `${p.muns_count} muns · ${p.sections_count} sec`,
        active: state.isla?.id === p.isla,
        action: () => enterIsla(p.isla, true)
      });
    }
    return out;
  }
  if (seg.level === "municipio") {
    // Hermanos = los muns de la isla activa.
    const munsArr = state._canariasMuns?.byIsla?.get(state.isla?.id) || state.isla?.municipios || [];
    for (const m of munsArr) {
      const p = m.properties;
      out.push({
        label: shortName(p.nmun),
        sub: `${p.sections_count || 0} sec`,
        active: state.municipio?.mun === p.mun,
        action: () => enterMunicipio(p.mun, true)
      });
    }
    // Orden alfabético por nmun corto.
    out.sort((a, b) => a.label.localeCompare(b.label, "es"));
    return out;
  }
  if (seg.level === "barrio") {
    // Hermanos = barrios del mun activo (piezas-barrio).
    const piezas = state.municipio?.barriosPiezas || [];
    for (const p of piezas) {
      out.push({
        label: p.name,
        sub: `${p.secciones_count} sec`,
        active: state.barrio?.barrioId === p.id,
        action: () => enterBarrio(p.id, true)
      });
    }
    out.sort((a, b) => a.label.localeCompare(b.label, "es"));
    return out;
  }
  if (seg.level === "distrito") {
    // Hermanos = distritos del mun activo.
    const list = state.municipio?.distList || [];
    for (const d of list) {
      out.push({
        label: "Distrito " + d.dis,
        sub: `${d.sectionCount} sec`,
        active: state.district?.distritoId === d.distritoId,
        action: () => enterDistrito(d.distritoId, true)
      });
    }
    return out;
  }
  if (seg.level === "manzana") {
    // Hermanos = manzanas del barrio activo. Orden por building_count desc.
    const manz = state.barrio?.manzanas || [];
    // Building counts por manzana (cusec, id) — reusamos los del barrio.
    const counts = new Map();
    for (const b of (state.barrio?.buildings || [])) {
      const key = `${b._cusec}-${b.properties.manzana_id}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const items = manz.map(m => {
      const key = `${m._cusec}-${m.properties.id}`;
      return {
        label: `Manzana ${m.properties.id}`,
        sub: `${counts.get(key) || 0} edif`,
        active: state.manzana?.id === key,
        sortBy: counts.get(key) || 0,
        action: () => enterManzana(key, { animate: true })
      };
    });
    items.sort((a, b) => b.sortBy - a.sortBy);
    return items.map(({ sortBy, ...rest }) => rest);
  }
  if (seg.level === "seccion") {
    // Hermanos = secciones del distrito (si está cargado).
    const list = state.district?.secciones || state.municipio?.secciones || [];
    for (const s of list) {
      const c = s.properties.cusec;
      out.push({
        label: "Sección " + c.slice(-3),
        sub: c,
        active: state.section?.meta?.cusec === c,
        action: () => enterSeccion(c, true)
      });
    }
    return out;
  }
  return out;
}

function updateBannerSub() {
  const el = document.getElementById("banner-sub");
  if (state.lodLevel === "archipielago") {
    el.textContent = `Canarias · ${state.archipielago.islands.length} islas`;
  } else if (state.lodLevel === "isla") {
    el.textContent = `${state.isla.name} · ${state.isla.municipios.length} municipios`;
  } else if (state.lodLevel === "municipio") {
    el.textContent = `${shortName(state.municipio.nmun)} · ${state.municipio.secciones.length} secciones · ${state.municipio.distList.length} distritos`;
  } else if (state.lodLevel === "distrito") {
    const d = state.district;
    el.textContent = `Distrito ${d.dis} · ${d.sectionCount} secciones · ${d.totalBuildings.toLocaleString("es")} edif`;
  } else if (state.lodLevel === "barrio") {
    const b = state.barrio;
    el.textContent = `${b.name} · ${b.sectionCount} secciones · ${b.totalBuildings.toLocaleString("es")} edificios`;
  } else if (state.lodLevel === "manzana") {
    const m = state.manzana;
    const barrioName = state.barrio?.name || "barrio";
    el.textContent = `${barrioName} · Manzana ${m.manzanaId} · ${m.buildings.length} edificios`;
  } else if (state.lodLevel === "vecindario") {
    const v = state.vecindario;
    el.textContent = v
      ? `Vecindario · ${v.secciones.length} secciones · ${v.totalBuildings.toLocaleString("es")} edif`
      : "Vecindario";
  } else if (state.section) {
    const c = state.section.meta.cusec;
    el.textContent = `Sección ${c.slice(-3)} · ${state.section.manzanas.length} mz · ${state.section.buildings.length} edif`;
  }
}

// Etiqueta flotante con título descriptivo del distrito (sólo nivel distrito).
function updateDistLabel() {
  const el = document.getElementById("dist-label");
  const elBarrio = document.getElementById("barrio-label");
  if (state.lodLevel === "distrito" && state.district) {
    const d = state.district;
    const nick = DISTRITO_NICKS[d.distritoId] || "";
    const tag = nick ? ` · ${nick}` : "";
    if (el) {
      el.textContent = `Distrito ${d.dis}${tag} · ${d.sectionCount} secciones · ${d.totalBuildings.toLocaleString("es")} edificios`;
      el.classList.add("visible");
    }
    if (elBarrio) elBarrio.classList.remove("visible");
  } else if (state.lodLevel === "barrio" && state.barrio) {
    // v1.6.barrio — etiqueta flotante para el nivel barrio. Reutilizamos
    // el estilo `.dist-label`, sólo cambia el texto.
    const b = state.barrio;
    if (elBarrio) {
      elBarrio.textContent = `${b.name} · ${b.sectionCount} secciones · ${b.totalBuildings.toLocaleString("es")} edificios`;
      elBarrio.classList.add("visible");
    }
    if (el) el.classList.remove("visible");
  } else {
    if (el) el.classList.remove("visible");
    if (elBarrio) elBarrio.classList.remove("visible");
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
  u.searchParams.delete("barrio");
  u.searchParams.delete("manzana");
  u.searchParams.delete("isla");
  // 2026-05-24 — En municipio/distrito/barrio/manzana también escribimos
  // `?isla=` para que el deep-link sea self-contained y NO colisione con
  // mun 3-digit homónimos en otra provincia (p.ej. 029 = Tinajo LZ ∩
  // Puntagorda LP). El cusec branch ya incluía prov; el resto no.
  if (state.lodLevel === "isla") {
    u.searchParams.set("isla", state.isla.id);
  } else if (state.lodLevel === "municipio") {
    if (state.isla?.id) u.searchParams.set("isla", state.isla.id);
    u.searchParams.set("mun", state.municipio.mun);
  } else if (state.lodLevel === "distrito") {
    if (state.isla?.id) u.searchParams.set("isla", state.isla.id);
    u.searchParams.set("level", "distrito");
    u.searchParams.set("distrito_id", state.district.distritoId);
  } else if (state.lodLevel === "barrio") {
    if (state.isla?.id) u.searchParams.set("isla", state.isla.id);
    u.searchParams.set("barrio", state.barrio.barrioId);
  } else if (state.lodLevel === "manzana") {
    // v1.6.manzana — deep link self-contained. Con barrio (GC):
    // ?barrio=<id>&manzana=<compositeId>. Sin barrio (resto de islas): la
    // manzana cuelga de la sección → ?cusec=<cusec>&manzana=<localId>.
    if (state.barrio) {
      u.searchParams.set("barrio", state.barrio.barrioId);
      u.searchParams.set("manzana", state.manzana.id);
    } else if (state.manzana?.cusec) {
      u.searchParams.set("cusec", state.manzana.cusec);
      u.searchParams.set("manzana", String(state.manzana.manzanaId));
    }
  } else if (state.lodLevel === "seccion") {
    u.searchParams.set("cusec", state.section.meta.cusec);
  }
  const stateObj = {
    lodLevel: state.lodLevel,
    islaId: state.isla?.id ?? null,
    mun: state.municipio?.mun ?? state.district?.mun ?? state.barrio?.mun ?? null,
    distritoId: state.district?.distritoId ?? null,
    barrioId: state.barrio?.barrioId ?? null,
    manzanaId: state.manzana?.id ?? null,
    cusec: state.section?.meta?.cusec ?? null,
  };
  if (replace) history.replaceState(stateObj, "", u.toString());
  else history.pushState(stateObj, "", u.toString());
  updateBackButton();
}

function updateBackButton() {
  maybeShowGestosTutorial(); // [2026-05-29 ladrillo#3] tutorial 1ª vez en isla
  const btn = document.getElementById("back-btn");
  if (!btn) return;
  if (state.lodLevel === "archipielago") btn.classList.remove("visible");
  else btn.classList.add("visible");
}

// [2026-05-29 ladrillo#3] Tutorial mínimo: la PRIMERA vez que el usuario
// llega a nivel ISLA, un globo señala el botón de gestos (el FAB). Se muestra
// una sola vez (localStorage). Estilos inline a propósito: style.css se está
// editando en paralelo y no queremos colisionar. Cualquier toque lo cierra.
const _GESTOS_TUT_KEY = "polis_tut_gestos_v1";
function maybeShowGestosTutorial() {
  try {
    if (state.lodLevel !== "isla") return;
    if (window._gestosTutShown) return;
    if (localStorage.getItem(_GESTOS_TUT_KEY)) return;
    window._gestosTutShown = true; // evita reprogramar en cada updateBackButton
    setTimeout(() => _renderGestosCoach(0), 750); // tiempo para que el FAB se posicione
  } catch (e) { /* no-op */ }
}
function _renderGestosCoach(attempt) {
  if (document.getElementById("gestos-coach")) return;
  const fab = document.getElementById("unified-fab");
  const r = fab && fab.getBoundingClientRect();
  // El FAB puede no estar maquetado aún si llegamos a isla en el boot
  // (deep-link). Reintentamos unas cuantas veces antes de rendirnos.
  if (!fab || !r.width) {
    if ((attempt || 0) < 10) setTimeout(() => _renderGestosCoach((attempt || 0) + 1), 400);
    return;
  }
  // Sólo marcamos "visto" cuando de verdad se dibuja.
  try { localStorage.setItem(_GESTOS_TUT_KEY, "1"); } catch (e) { /* no-op */ }
  const coach = document.createElement("div");
  coach.id = "gestos-coach";
  coach.setAttribute("role", "dialog");
  coach.style.cssText = [
    "position:fixed", "z-index:99999",
    `left:${Math.round(r.right + 16)}px`,
    `top:${Math.round(r.top + r.height / 2)}px`,
    "transform:translateY(-50%)", "max-width:240px",
    "background:#2D2926", "color:#F4ECD8",
    "font:500 13px/1.45 system-ui,-apple-system,sans-serif",
    "padding:13px 15px", "border-radius:13px",
    "box-shadow:0 10px 28px rgba(0,0,0,.38)", "cursor:pointer"
  ].join(";");
  coach.innerHTML =
    `<div style="font-weight:600;margin-bottom:5px">Esto está en tus manos ✋</div>
     <div style="opacity:.85">Toca aquí para abrir tus <b>gestos</b>: lo que puedes hacer en este lugar — moverte, cuidar, convivir, disfrutar…</div>
     <div style="margin-top:9px;font-size:11px;opacity:.55">Toca para cerrar</div>
     <div style="position:absolute;left:-7px;top:50%;transform:translateY(-50%);width:0;height:0;border:7px solid transparent;border-right-color:#2D2926"></div>`;
  const close = () => { coach.remove(); fab.style.boxShadow = _prevFabShadow; };
  coach.addEventListener("click", close);
  // Pulso de atención en el FAB.
  const _prevFabShadow = fab.style.boxShadow;
  fab.style.transition = "box-shadow .3s";
  fab.style.boxShadow = "0 0 0 7px rgba(244,236,216,.4)";
  document.body.appendChild(coach);
  setTimeout(() => { if (document.body.contains(coach)) close(); }, 10000);
}
// Capas invisibles "de momento": ocultamos el escape "Ver capas de datos"
// del pie del menú de verbos, desde fuera (sin tocar bindGestosSheet, que
// se está editando en paralelo). Reversible: borrar esta línea.
(function _hideCapasEscape() {
  const b = document.getElementById("gestos-data-toggle");
  if (b) b.style.display = "none";
})();

// [2026-05-29 ladrillo B] SINERGIAS — "el mapa te dice algo" cuando hay
// varios verbos/sectores activos a la vez. AUTOCONTENIDO: observa
// state.activeOverlays por polling (NO toca el menú de verbos, que la otra
// sesión edita) y muestra un aviso. Reglas + estilos inline a propósito.
// TODO al cerrar la sesión paralela: mover reglas a shared/sinergias.js y
// hacer el texto data-driven (conteo por bbox del nivel actual).
(function bindSinergias() {
  const SINERGIAS = [
    { overlays: ["movilidad-suave", "parques"], glifo: "🌿", titulo: "Ruta verde",
      texto: "Carriles bici que enlazan con zonas verdes — buena zona para moverte y respirar." },
    { overlays: ["guaguas", "centros-salud"], glifo: "🚌", titulo: "Salud sin coche",
      texto: "Centros de salud con parada de guagua cerca." },
    { overlays: ["productores", "alimentacion"], glifo: "🧺", titulo: "Despensa local",
      texto: "Productores y comercio de alimentación de barrio concentrados aquí." },
    { overlays: ["eventos", "cultura-venues"], glifo: "🎭", titulo: "Zona viva",
      texto: "Eventos y espacios culturales activos en la zona." },
    { overlays: ["guaguas", "movilidad-suave"], glifo: "🔁", titulo: "Movilidad combinada",
      texto: "Bus y bici/peatonal cubren bien esta zona." }
  ];
  let lastKey = "", dismissedKey = "", bar = null;
  function activeSet() {
    const ov = (window.polisApp && window.polisApp.state && window.polisApp.state.activeOverlays) || {};
    return new Set(Object.keys(ov).filter((k) => ov[k]));
  }
  function ensureBar() {
    if (bar) return bar;
    bar = document.createElement("div");
    bar.id = "sinergia-bar";
    bar.style.cssText = [
      "position:fixed", "z-index:9998", "left:50%", "bottom:28px",
      "transform:translateX(-50%)", "max-width:min(360px,86vw)",
      "box-sizing:border-box", "background:#F4ECD8", "color:#2D2926",
      "border:1.5px solid #2D2926", "border-radius:14px", "padding:11px 14px",
      "cursor:pointer", "box-shadow:0 8px 24px rgba(45,41,38,.22)",
      "font:500 13px/1.4 system-ui,-apple-system,sans-serif"
    ].join(";");
    bar.addEventListener("click", () => { dismissedKey = lastKey; bar.style.display = "none"; });
    document.body.appendChild(bar);
    return bar;
  }
  function tick() {
    let hits;
    try {
      const set = activeSet();
      hits = SINERGIAS.filter((s) => s.overlays.every((o) => set.has(o)));
    } catch (e) { return; }
    const key = hits.map((h) => h.titulo).join("|");
    if (key === lastKey) return;
    lastKey = key;
    if (!hits.length) { if (bar) bar.style.display = "none"; return; }
    if (key === dismissedKey) return; // ya lo cerró para esta misma combinación
    const h = hits[0];
    const b = ensureBar();
    b.innerHTML =
      `<div style="display:flex;gap:9px;align-items:flex-start">
         <span style="font-size:18px;line-height:1">${h.glifo}</span>
         <span><b style="display:block;margin-bottom:2px">Sinergia · ${h.titulo}</b>
         <span style="opacity:.82">${h.texto}</span></span>
       </div>`;
    b.style.display = "block";
  }
  setInterval(tick, 700);
})();

// El back lógico v1.5: sección → distrito (del cusec) ; distrito → municipio ;
// municipio → isla. Si no hay distrito (municipio con 1 distrito o sin cargar),
// la sección vuelve directamente al municipio.
//
// v1.5.1: si tenemos viewport guardado del nivel destino, lo pasamos como
// restoreView para que la animación de back sea el inverso visual de la
// forward (vuelta al zoom + pan original).
// Orden jerárquico para detectar si popstate es back (target más alto)
// o forward (target más profundo o lateral en cambio de distrito).
// v1.6.barrio — barrio = 2 (mismo que distrito; ambos son hijos directos
// del municipio y hermanos lógicos entre sí).
// v1.6.manzana (Phase 2b) — manzana = 3 (hijo del barrio). El nivel
// "seccion" sigue siendo 3 porque es hermano lógico (hijo de distrito),
// no descendiente del barrio.
const LEVEL_DEPTH = { archipielago: 0, isla: 1, municipio: 2, distrito: 3, barrio: 3, seccion: 4, manzana: 4 };
function isBackNavigation(from, to) {
  return (LEVEL_DEPTH[to] ?? 0) < (LEVEL_DEPTH[from] ?? 0);
}

function navigateBack() {
  if (state.lodLevel === "seccion") {
    const cusec = state.section?.meta?.cusec;
    const mun = state.section?.meta?.mun || state.municipio?.mun;
    // 2026-05-26 — Back desde sección cae en vecindario auto-cluster
    // (12 secs más cercanas en radio 1.2 km). Más íntimo que distrito o
    // barrio-sintético-mun. Si vecindario falla, fallback a la cadena
    // antigua (distrito → municipio → isla).
    if (cusec) {
      enterVecindario(cusec, true, consumeViewportFor("vecindario"))
        .catch(err => {
          console.warn("vecindario falló, fallback a distrito", err);
          const distritoId = state.district?.distritoId
                             || cusec.slice(2, 7);
          if (distritoId) {
            enterDistrito(distritoId, true, consumeViewportFor("distrito"));
          } else if (mun) {
            enterMunicipio(mun, true, consumeViewportFor("municipio"));
          } else {
            enterIsla(true, consumeViewportFor("isla"));
          }
        });
    } else if (mun) {
      enterMunicipio(mun, true, consumeViewportFor("municipio"));
    } else {
      enterIsla(true, consumeViewportFor("isla"));
    }
  } else if (state.lodLevel === "vecindario") {
    // Back desde vecindario: si vinimos de un barrio, vuelve al barrio;
    // si vinimos de un distrito, vuelve al distrito; si no, al municipio.
    const mun = state.vecindario?.mun;
    if (mun) enterMunicipio(mun, true, consumeViewportFor("municipio"));
    else enterIsla(true, consumeViewportFor("isla"));
  } else if (state.lodLevel === "distrito") {
    const mun = state.district?.mun || state.municipio?.mun;
    if (mun) enterMunicipio(mun, true, consumeViewportFor("municipio"));
    else enterIsla(true, consumeViewportFor("isla"));
  } else if (state.lodLevel === "manzana") {
    // v1.6.manzana — Back desde manzana → su padre. Con barrio (GC) vuelve
    // al barrio; sin barrio (resto de islas) vuelve a la sección padre
    // (state.manzana.cusec). Fallbacks defensivos a municipio/isla.
    const barrioId = state.barrio?.barrioId;
    if (barrioId) {
      enterBarrio(barrioId, true, consumeViewportFor("barrio"));
    } else if (state.manzana?.cusec) {
      enterSeccion(state.manzana.cusec, true, consumeViewportFor("seccion"));
    } else {
      const mun = state.municipio?.mun;
      if (mun) enterMunicipio(mun, true, consumeViewportFor("municipio"));
      else enterIsla(true, consumeViewportFor("isla"));
    }
  } else if (state.lodLevel === "barrio") {
    // Back desde barrio salta directamente al municipio (no pasa por
    // distrito — el barrio es hijo directo del mun, no del distrito).
    const mun = state.barrio?.mun || state.municipio?.mun;
    if (mun) enterMunicipio(mun, true, consumeViewportFor("municipio"));
    else enterIsla(true, consumeViewportFor("isla"));
  } else if (state.lodLevel === "municipio") {
    const islaId = state.isla?.id || inferIslaFromMun(state.municipio?.mun) || "gc";
    enterIsla(islaId, true, consumeViewportFor("isla"));
  } else if (state.lodLevel === "isla") {
    enterArchipielago(true, consumeViewportFor("archipielago"));
  }
  // En archipielago no hace nada (raíz).
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

// v1.6c — Hover handler para iluminar secciones a nivel distrito. Sólo
// dispara hit-test si lodLevel === "distrito" (los otros niveles no
// usan hoveredSeccionCusec). Throttled a 1 update por rAF para que el
// pan/drag no se ralentice.
let _hoverRafQueued = false;
let _lastHoverX = 0, _lastHoverY = 0;
canvas.addEventListener("mousemove", (e) => {
  if (state.lodLevel !== "distrito" || !state.district || !state.view) return;
  const rect = canvas.getBoundingClientRect();
  _lastHoverX = e.clientX - rect.left;
  _lastHoverY = e.clientY - rect.top;
  if (_hoverRafQueued) return;
  _hoverRafQueued = true;
  requestAnimationFrame(() => {
    _hoverRafQueued = false;
    if (state.lodLevel !== "distrito") return;
    const px = _lastHoverX, py = _lastHoverY;
    const secs = state.district.secciones;
    let hit = null;
    for (let i = secs.length - 1; i >= 0; i--) {
      const s = secs[i];
      const ringPx = s._ringSimple.map(([x, z]) => project(x, 0, z, state.view));
      if (pointInScreenPolygon(px, py, ringPx)) {
        hit = s.properties.cusec;
        break;
      }
    }
    if (hit !== state.hoveredSeccionCusec) {
      state.hoveredSeccionCusec = hit;
      requestRender();
      // Cambiar el cursor para indicar interactividad.
      canvas.style.cursor = hit ? "pointer" : "";
    }
  });
});
canvas.addEventListener("mouseleave", () => {
  if (state.hoveredSeccionCusec) {
    state.hoveredSeccionCusec = null;
    requestRender();
  }
  canvas.style.cursor = "";
});

// -----------------------------------------------------------
// v1.6.nav — Peek tooltip (hover en escritorio, long-press en móvil).
// Sustituye al popup bloqueante `openMunicipioPopup` que se disparaba con
// tap a nivel isla. Doctrina: tap = navega, peek = fisga. El peek
// aparece mientras el cursor/dedo se mantiene sobre el objetivo y
// desaparece al soltar. Niveles soportados:
//   - isla        → peek sobre municipio (nombre, lema, población,
//                   chascarrillo)
//   - municipio   → peek sobre sección (barrio si está mapeado en
//                   barrios-canonical.json; fallback al distrito INE)

let _peekEl = null;
function _ensurePeekEl() {
  if (_peekEl) return _peekEl;
  _peekEl = document.createElement("div");
  _peekEl.id = "peek-tooltip";
  _peekEl.style.cssText = [
    "position:fixed", "pointer-events:none", "z-index:9999",
    "background:rgba(20,20,20,0.92)", "color:#f0e6d2",
    "border:1px solid rgba(200,153,104,0.4)",
    "padding:8px 12px", "font-size:13px", "line-height:1.35",
    "max-width:280px", "border-radius:4px",
    "opacity:0", "transition:opacity 120ms",
    "box-shadow:0 4px 14px rgba(0,0,0,0.45)"
  ].join(";");
  document.body.appendChild(_peekEl);
  return _peekEl;
}
function _showPeek({ title, subtitle, body, x, y }) {
  const el = _ensurePeekEl();
  el.innerHTML =
    `<div style="font-weight:600;font-size:14px;color:#e2c99a">${_escapeHtml(title)}</div>` +
    (subtitle ? `<div style="font-style:italic;opacity:.78;margin-top:2px">${_escapeHtml(subtitle)}</div>` : "") +
    (body ? `<div style="margin-top:4px;font-size:12px;opacity:.85">${_escapeHtml(body)}</div>` : "");
  // Clamp al viewport con offset desde el puntero.
  el.style.left = "0px"; el.style.top = "0px";
  el.style.opacity = "1";
  const rect = el.getBoundingClientRect();
  const margin = 12, gap = 16;
  let left = x + gap;
  let top = y + gap;
  if (left + rect.width > window.innerWidth - margin) left = x - rect.width - gap;
  if (top + rect.height > window.innerHeight - margin) top = y - rect.height - gap;
  if (left < margin) left = margin;
  if (top < margin) top = margin;
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}
function _hidePeek() {
  if (_peekEl) _peekEl.style.opacity = "0";
}

async function _resolvePeekAt(px, py) {
  if (state.lodLevel === "isla") {
    if (!state.isla?.municipios) return null;
    for (let i = state.isla.municipios.length - 1; i >= 0; i--) {
      const m = state.isla.municipios[i];
      const ringPx = m._ringSimple.map(([x, z]) => project(x, 0, z, state.view));
      if (pointInScreenPolygon(px, py, ringPx)) {
        const munCode = m.properties.mun;
        const info = await loadMunicipiosInfo();
        const row = info[munCode] || {};
        const nombre = row.nombre || m.properties.nmun || `Municipio ${munCode}`;
        const lema = row.lema || "";
        const pob = typeof row.poblacion === "number"
          ? `${row.poblacion.toLocaleString("es")} hab.` : "";
        const chasc = row.chascarrillo || "";
        const body = [pob, chasc].filter(Boolean).join(" · ");
        return { title: nombre, subtitle: lema, body };
      }
    }
  } else if (state.lodLevel === "municipio") {
    if (!state.municipio?.secciones) return null;
    for (let i = state.municipio.secciones.length - 1; i >= 0; i--) {
      const s = state.municipio.secciones[i];
      const ringPx = s._ringSimple.map(([x, z]) => project(x, 0, z, state.view));
      if (pointInScreenPolygon(px, py, ringPx)) {
        const cusec = s.properties.cusec;
        const barrioId = state.barriosGc?._cusecIndex?.get(cusec);
        if (barrioId) {
          const meta = state.barriosGc.barrios[barrioId];
          return {
            title: meta.name || barrioId,
            subtitle: meta.mun_name || "",
            body: meta.note || ""
          };
        }
        const distritoId = cusec.slice(2, 7);
        return {
          title: `Distrito ${distritoId.slice(3, 5)}`,
          subtitle: `Sección ${cusec.slice(7)}`,
          body: ""
        };
      }
    }
  }
  return null;
}

// Peek hover (escritorio): se ejecuta junto al hover handler existente
// del distrito, pero solo en isla y municipio (lodLevel propio). El
// throttling usa microtask (Promise.resolve().then) en lugar de
// requestAnimationFrame para que el peek funcione también cuando la
// pestaña está en background (rAF se pausa con visibilityState=hidden).
let _peekScheduled = false;
let _lastPeekClientX = 0, _lastPeekClientY = 0;
let _lastPeekCanvasX = 0, _lastPeekCanvasY = 0;
canvas.addEventListener("mousemove", (e) => {
  if (state.lodLevel !== "archipielago" && state.lodLevel !== "isla" && state.lodLevel !== "municipio") return;
  if (state._anim || state._slideAnim) { _hidePeek(); return; }
  const rect = canvas.getBoundingClientRect();
  _lastPeekClientX = e.clientX;
  _lastPeekClientY = e.clientY;
  _lastPeekCanvasX = e.clientX - rect.left;
  _lastPeekCanvasY = e.clientY - rect.top;

  // 2026-05-19 — Hit-test para hover en cada nivel (archipielago/isla/mun).
  if (state.lodLevel === "archipielago" && state.archipielago?.islands) {
    let hit = null;
    const islands = state.archipielago.islands;
    for (let i = islands.length - 1; i >= 0; i--) {
      const f = islands[i];
      for (const r of (f._rings || [f._ringSimple])) {
        const ringPx = r.map(([x, z]) => project(x, 0, z, state.view));
        if (pointInScreenPolygon(_lastPeekCanvasX, _lastPeekCanvasY, ringPx)) { hit = f; break; }
      }
      if (hit) break;
    }
    const prev = state.hoverFeature?.properties?.isla;
    const curr = hit?.properties?.isla;
    if (prev !== curr) {
      state.hoverFeature = hit;
      requestRender();
    }
    canvas.style.cursor = hit ? "pointer" : "";
    return;
  }
  if (state.lodLevel === "isla" && state.isla?.municipios) {
    let hitMun = null;
    for (let i = state.isla.municipios.length - 1; i >= 0; i--) {
      const m = state.isla.municipios[i];
      const ringPx = m._ringSimple.map(([x, z]) => project(x, 0, z, state.view));
      if (pointInScreenPolygon(_lastPeekCanvasX, _lastPeekCanvasY, ringPx)) {
        hitMun = m;
        break;
      }
    }
    const prev = state.hoverFeature?.properties?.mun;
    const curr = hitMun?.properties?.mun;
    if (prev !== curr) {
      state.hoverFeature = hitMun;
      requestRender();
    }
  } else if (state.lodLevel === "municipio" && state.municipio?.barriosPiezas) {
    let hitPieza = null;
    for (let i = state.municipio.barriosPiezas.length - 1; i >= 0; i--) {
      const p = state.municipio.barriosPiezas[i];
      const ring = p.ring || p._ringSimple;
      if (!ring) continue;
      const ringPx = ring.map(([x, z]) => project(x, 0, z, state.view));
      if (pointInScreenPolygon(_lastPeekCanvasX, _lastPeekCanvasY, ringPx)) {
        hitPieza = p;
        break;
      }
    }
    const prev = state.hoverFeature?.properties?.barrioPiezaId;
    const curr = hitPieza?.id;
    if (prev !== curr) {
      state.hoverFeature = hitPieza ? { properties: { barrioPiezaId: hitPieza.id } } : null;
      requestRender();
    }
  }

  if (_peekScheduled) return;
  _peekScheduled = true;
  Promise.resolve().then(async () => {
    _peekScheduled = false;
    if (state.lodLevel !== "isla" && state.lodLevel !== "municipio") return;
    const result = await _resolvePeekAt(_lastPeekCanvasX, _lastPeekCanvasY);
    if (result) {
      _showPeek({ ...result, x: _lastPeekClientX, y: _lastPeekClientY });
      canvas.style.cursor = "pointer";
    } else {
      _hidePeek();
      canvas.style.cursor = "";
    }
  });
});
canvas.addEventListener("mouseleave", () => {
  _hidePeek();
  if (state.hoverFeature) {
    state.hoverFeature = null;
    requestRender();
  }
});
canvas.addEventListener("mousedown", _hidePeek);

// 2026-05-19 — Long-press en móvil DESHABILITADO. El usuario pidió que
// el peek aparezca SOLO con hover (escritorio), no en mobile, para que
// no bloquee la navegación. En mobile: tap = navega siempre.
// Si en el futuro quieres recuperar long-press peek, vuelve al commit
// anterior y QUITA la línea `state._lpFired = true` para que el peek
// muestre sin frenar el siguiente tap.

function requestRender() {
  // Sync UI cromo dependiente del nivel (síncrono, fuera de rAF para
  // que funcione también en pestañas hidden donde rAF está pausado).
  _syncArchipielagoGrid();
  if (state._renderQueued) return;
  state._renderQueued = true;
  requestAnimationFrame(() => {
    state._renderQueued = false;
    render(ctx, state);
  });
}
state._requestRender = requestRender;

// -----------------------------------------------------------
// 2026-05-21 — Grid de archipiélago (overlay HTML que sustituye al
// render iso del nivel "archipielago"). Las 7 islas aparecen como
// tarjetas con mini-silueta iso + nombre, dispuestas en CSS Grid 4×3
// respetando posición geográfica (LP/LG/EH oeste, TF/GC centro, FV/LZ
// este). Tap = enterIsla. Mientras lodLevel="archipielago" el canvas
// y el HUD se ocultan; al entrar a isla la grid se oculta y el canvas
// reaparece. Pintar las siluetas requiere state.archipielago ya
// cargado, por eso se hace lazy (primer sync con lodLevel correcto).

let _archipielagoGridMounted = false;
let _lastSyncedArchVisible = null;

function _mountArchipielagoGrid() {
  if (_archipielagoGridMounted) return;
  const grid = document.getElementById("archipielago-grid");
  if (!grid) return;
  for (const card of grid.querySelectorAll(".isla-card")) {
    card.addEventListener("click", () => {
      const id = card.dataset.isla;
      if (id) enterIsla(id, true);
    });
  }
  // Repintar al resize (siluetas dependen de tamaño de celda).
  let _resizeRaf = null;
  window.addEventListener("resize", () => {
    if (grid.hasAttribute("hidden")) return;
    if (_resizeRaf) cancelAnimationFrame(_resizeRaf);
    _resizeRaf = requestAnimationFrame(() => {
      _resizeRaf = null;
      _paintArchipielagoCards();
    });
  });
  _archipielagoGridMounted = true;
}

function _paintArchipielagoCards() {
  const arch = state.archipielago;
  if (!arch?.islands) return;
  const islandsById = new Map(arch.islands.map(f => [f.properties.isla, f]));
  for (const card of document.querySelectorAll("#archipielago-grid .isla-card")) {
    const id = card.dataset.isla;
    const feat = islandsById.get(id);
    const cnv = card.querySelector(".isla-card-canvas");
    if (!feat || !cnv) continue;
    _drawIslaSilhouette(cnv, feat);
  }
}

function _drawIslaSilhouette(cnv, feat) {
  // Tamaño físico = tamaño CSS * dpr para nitidez.
  const cssW = cnv.clientWidth || 100;
  const cssH = cnv.clientHeight || 80;
  const dpr = window.devicePixelRatio || 1;
  cnv.width = Math.round(cssW * dpr);
  cnv.height = Math.round(cssH * dpr);
  const c = cnv.getContext("2d");
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.scale(dpr, dpr);
  c.clearRect(0, 0, cssW, cssH);
  // Bbox de la isla en metros locales (CANARIAS_ANCHOR).
  const [a, b, cc, dd] = feat._bbox;
  const islandW = cc - a;
  const islandH = dd - b;
  if (islandW <= 0 || islandH <= 0) return;
  // Fit preservando aspect ratio con margen interno.
  const pad = 6;
  const fitScale = Math.min((cssW - pad * 2) / islandW,
                            (cssH - pad * 2) / islandH);
  const txw = a + islandW / 2;
  const tzw = b + islandH / 2;
  const ox = cssW / 2;
  const oy = cssH / 2;
  const p2 = (x, z) => [ox + (x - txw) * fitScale, oy + (z - tzw) * fitScale];

  // v1.7.float-ink — Borde reforzado en dos pasos: primero una sombra
  // plana SE 2px (ink alpha 0.4) que "levanta" la silueta del fondo y
  // la separa del mapa-fantasma de ghosts; después fill OCRE + stroke
  // INK más grueso (1.2 → 2.0) para que el contorno se lea como
  // dibujo a tinta sobre papel y no como JPG plano.
  //
  // 2026-05-27 — Fuerteventura (225 pts a tol 60m) se veía dentada en
  // la mini-silueta porque cada 0.3 px caía un vértice y el stroke
  // generaba micro-dientes. Simplificamos cada ring con una tolerancia
  // adaptada al tamaño de pantalla: queremos ~0.6 px = unidades-mundo
  // por píxel × 0.6. fitScale ya convierte unidades-mundo a píxeles,
  // así que tol = 0.6 / fitScale.
  const rawRings = feat._rings && feat._rings.length
    ? feat._rings
    : [feat._ringSimple];
  const SIMPLIFY_TOL_PX = 0.6;
  const tol = SIMPLIFY_TOL_PX / Math.max(fitScale, 1e-6);
  const rings = rawRings.map(r => (r && r.length > 4) ? simplifyRing(r, tol) : r);

  // Paso 1 — sombra ink plana SE.
  c.save();
  c.translate(2, 2);
  c.fillStyle = "rgba(26,22,18,0.40)";
  for (const ring of rings) {
    if (!ring || ring.length < 3) continue;
    c.beginPath();
    for (let i = 0; i < ring.length; i++) {
      const [px, py] = p2(ring[i][0], ring[i][1]);
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
    c.fill();
  }
  c.restore();

  // Paso 2 — fill OCRE + stroke INK reforzado.
  c.fillStyle = "#C89968";    // OCRE
  c.strokeStyle = "#1A1612";  // INK
  c.lineWidth = 2.0;          // antes 1.2 — borde de tinta más presente
  c.lineJoin = "round";
  c.lineCap = "round";
  for (const ring of rings) {
    if (!ring || ring.length < 3) continue;
    c.beginPath();
    for (let i = 0; i < ring.length; i++) {
      const [px, py] = p2(ring[i][0], ring[i][1]);
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
    c.fill();
    c.stroke();
  }
}

// 2026-05-21 v2 — Modo del selector de archipiélago. "float" es el
// concepto experimental (siluetas flotando + hover snap + drag-to-map).
// "grid" se conserva por si volvemos al layout cuadriculado.
const ARCH_MODE = "float";  // "float" | "grid"

function _syncArchipielagoGrid() {
  const grid = document.getElementById("archipielago-grid");
  const float = document.getElementById("archipielago-float");
  const canvasEl = document.getElementById("stage");
  const isArch = state.lodLevel === "archipielago";
  if (isArch === _lastSyncedArchVisible) return; // idempotente
  _lastSyncedArchVisible = isArch;
  if (isArch) {
    document.body.classList.add("lv-archipielago");
    if (canvasEl) canvasEl.style.visibility = "hidden";
    if (ARCH_MODE === "grid") {
      _mountArchipielagoGrid();
      if (grid) grid.hidden = false;
      if (float) float.hidden = true;
      requestAnimationFrame(() => _paintArchipielagoCards());
      Promise.resolve().then(() => _paintArchipielagoCards());
    } else {
      _mountArchipielagoFloat();
      _resetArchipielagoFloatState();
      if (float) {
        // 2026-05-25 — fade in suave al volver al archipielago
        float.hidden = false;
        float.classList.add("fading");           // empieza invisible
        // Force reflow para que la transición arranque
        void float.offsetWidth;
        float.classList.remove("fading");        // sube opacidad 0→1
      }
      if (grid) grid.hidden = true;
      requestAnimationFrame(() => _paintArchipielagoFloat());
      Promise.resolve().then(() => _paintArchipielagoFloat());
    }
  } else {
    document.body.classList.remove("lv-archipielago");
    if (grid) grid.hidden = true;
    // 2026-05-25 — fade-out 280ms antes de hide para suavizar la
    // transición mini-juego → vista canvas isla. Sin esto el switch
    // era un cut brusco que Pancho reportó como "transición fea".
    if (float && !float.hidden) {
      float.classList.add("fading");
      setTimeout(() => {
        float.hidden = true;
        float.classList.remove("fading");
      }, 280);
    } else if (float) {
      float.hidden = true;
    }
    if (canvasEl) canvasEl.style.visibility = "";
    _stopArchipielagoPhysics();
  }
}

// -----------------------------------------------------------
// 2026-05-21 v2 — Modo FLOTANTE del archipiélago.
// Las 7 siluetas flotan con bobbing en posiciones random. Hover (mouse)
// → la silueta deja de bobbeear y anima hacia su posición geográfica
// real sobre el mapa-fantasma del fondo, quedando "iluminada". Drag
// desde silueta iluminada → al soltar dentro del radio de su ghost,
// confirma → enterIsla. Drop fuera → vuelve a flotar.
// Mobile (pointerType=touch + tap rápido sin desplazamiento) =
// enterIsla directo (fallback usable con dedo).

const _ARCH_FLOAT = {
  mounted: false,
  items: [],      // {islaId, name, feat, ghostEl, floatEl, ghostCnv, cnv,
                  //  inner, ghostX, ghostY, ghostW, ghostH,
                  //  cellW, cellH, freeX, freeY,
                  //  physX, physY, physRot,        // posición/rotación actuales (motor)
                  //  vx, vy, vrot,                 // velocidades
                  //  snapped, dragging}
  pointer: null,  // {id, startX, startY, dx, dy, item, moved}
  bbox: null,     // {x0,y0,x1,y1,scale,offX,offY,dispW,dispH,W,H}
  physTimer: null,
  physLastT: 0,
  DROP_RADIUS_PX: 70,
  ROT_CORRECT_RADIUS_PX: 240,  // a partir de aquí, el drag corrige rotación → 0°
  lastEncajadaId: null          // [D] última isla que se encajó (para efecto "emerge" al volver)
};

function _mountArchipielagoFloat() {
  const root = document.getElementById("archipielago-float");
  if (!root || _ARCH_FLOAT.mounted) return;
  const arch = state.archipielago;
  if (!arch?.islands) return;

  const ghostsEl = root.querySelector(".float-ghosts");
  const islandsEl = root.querySelector(".float-islands");
  ghostsEl.innerHTML = "";
  islandsEl.innerHTML = "";
  _ARCH_FLOAT.items = [];

  for (const feat of arch.islands) {
    const id = feat.properties.isla;
    const name = feat.properties.name;

    const ghostEl = document.createElement("div");
    ghostEl.className = "isla-ghost";
    ghostEl.dataset.isla = id;
    const ghostCnv = document.createElement("canvas");
    ghostEl.appendChild(ghostCnv);
    ghostsEl.appendChild(ghostEl);

    const floatEl = document.createElement("div");
    floatEl.className = "isla-float";
    floatEl.dataset.isla = id;
    floatEl.tabIndex = 0;
    floatEl.setAttribute("role", "button");
    floatEl.setAttribute("aria-label", `Seleccionar ${name}`);
    const inner = document.createElement("div");
    inner.className = "isla-float-inner";
    // Aleatorizamos delay del bobbing para que las 7 no se muevan en fase.
    inner.style.animationDelay = (Math.random() * -4).toFixed(2) + "s";
    inner.style.animationDuration = (3.5 + Math.random() * 2).toFixed(2) + "s";
    const cnv = document.createElement("canvas");
    inner.appendChild(cnv);
    floatEl.appendChild(inner);
    const lbl = document.createElement("span");
    lbl.className = "isla-float-name";
    lbl.textContent = name;
    floatEl.appendChild(lbl);
    islandsEl.appendChild(floatEl);

    _ARCH_FLOAT.items.push({
      islaId: id, name, feat,
      ghostEl, floatEl, ghostCnv, cnv, inner,
      ghostX: 0, ghostY: 0, ghostW: 0, ghostH: 0,
      cellW: 0, cellH: 0,
      freeX: 0, freeY: 0,
      physX: 0, physY: 0, physRot: 0,
      vx: 0, vy: 0, vrot: 0,
      snapped: false, dragging: false,
      _physInit: false
    });
  }

  _attachArchipielagoFloatInteractions(root);

  // Reposicionar al resize. Usamos microtask en lugar de rAF para que
  // funcione también en pestañas hidden donde rAF está pausado.
  let _resizeScheduled = false;
  window.addEventListener("resize", () => {
    if (root.hasAttribute("hidden")) return;
    if (_resizeScheduled) return;
    _resizeScheduled = true;
    Promise.resolve().then(() => {
      _resizeScheduled = false;
      _paintArchipielagoFloat();
    });
  });
  _ARCH_FLOAT.mounted = true;
}

// Calcula bbox del archipiélago en metros locales y el mapping a
// coordenadas de pantalla (centrado en el viewport con margen).
function _computeArchipielagoLayout() {
  const arch = state.archipielago;
  if (!arch?.bbox) return null;
  const W = window.innerWidth;
  const H = window.innerHeight;
  // Márgenes para no chocar con banner+membrete arriba y respiración abajo.
  const margin = { top: 110, right: 30, bottom: 80, left: 30 };
  const dispW = Math.max(200, W - margin.left - margin.right);
  const dispH = Math.max(200, H - margin.top - margin.bottom);
  const [bx0, by0, bx1, by1] = arch.bbox;
  const archW = bx1 - bx0;
  const archH = by1 - by0;
  if (archW <= 0 || archH <= 0) return null;
  const scale = Math.min(dispW / archW, dispH / archH);
  const offX = margin.left + (dispW - archW * scale) / 2;
  const offY = margin.top + (dispH - archH * scale) / 2;
  return { bx0, by0, bx1, by1, scale, offX, offY, dispW, dispH, W, H };
}

function _paintArchipielagoFloat() {
  if (!_ARCH_FLOAT.mounted) return;
  const layout = _computeArchipielagoLayout();
  if (!layout) return;
  _ARCH_FLOAT.bbox = layout;
  const { bx0, by0, scale, offX, offY, W, H } = layout;

  // Pintar cada ghost en su posición geográfica + cada silueta flotante
  // en su posición random (estable entre repintados).
  for (const it of _ARCH_FLOAT.items) {
    const f = it.feat;
    const [fx0, fy0, fx1, fy1] = f._bbox;
    const islaW = (fx1 - fx0) * scale;
    const islaH = (fy1 - fy0) * scale;
    // Tamaño de la celda (ligeramente mayor que la isla para padding).
    const cellW = Math.max(56, islaW + 18);
    const cellH = Math.max(48, islaH + 18);
    // Centroide de la isla en pantalla.
    const cx = offX + ((fx0 + fx1) / 2 - bx0) * scale;
    const cy = offY + ((fy0 + fy1) / 2 - by0) * scale;

    // Ghost (centrado en cx,cy con tamaño cellW×cellH).
    it.ghostX = cx - cellW / 2;
    it.ghostY = cy - cellH / 2;
    it.ghostW = cellW;
    it.ghostH = cellH;
    it.cellW = cellW;
    it.cellH = cellH;
    it.ghostEl.style.left = `${it.ghostX}px`;
    it.ghostEl.style.top = `${it.ghostY}px`;
    it.ghostEl.style.width = `${cellW}px`;
    it.ghostEl.style.height = `${cellH}px`;
    _drawIslaSilhouette(it.ghostCnv, f);

    // Posición flotante inicial — desde la banda perimetral determinista.
    // Solo se calcula si aún no había una posición física, o si la
    // anterior cae fuera del viewport actual (resize).
    const outOfBounds = (it.physX === 0 && it.physY === 0) ||
                        it.physX < 0 || it.physY < 0 ||
                        it.physX + cellW > W ||
                        it.physY + cellH > H;
    if (!it._physInit || outOfBounds) {
      const seed = _hashStr(it.islaId);
      const [rx, ry] = _seededRandPositionAvoiding(
        seed, W, H, cellW, cellH,
        _ARCH_FLOAT.items, it, layout
      );
      it.freeX = rx;
      it.freeY = ry;
      if (!it._physInit) {
        // Velocidad inicial: dirección aleatoria, módulo moderado.
        const angle = Math.random() * Math.PI * 2;
        const speed = 28 + Math.random() * 28;   // 28–56 px/s
        it.vx = Math.cos(angle) * speed;
        it.vy = Math.sin(angle) * speed;
        // Rotación inicial: pequeño offset + velocidad horario/antihorario.
        it.physRot = (Math.random() - 0.5) * 30;
        it.vrot = (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 6); // ±4–10 deg/s
        it._physInit = true;
      }
      it.physX = rx;
      it.physY = ry;
    }
    // Aplica posición + tamaño. Si está snapped queda fija en su ghost.
    const targetX = it.snapped ? it.ghostX : it.physX;
    const targetY = it.snapped ? it.ghostY : it.physY;
    it.floatEl.style.left = `${targetX}px`;
    it.floatEl.style.top = `${targetY}px`;
    it.floatEl.style.width = `${cellW}px`;
    it.floatEl.style.height = `${cellH}px`;
    if (it.inner) {
      it.inner.style.transform = `rotate(${it.snapped ? 0 : it.physRot}deg)`;
    }
    _drawIslaSilhouette(it.cnv, f);
  }
  _startArchipielagoPhysics();
}

// 2026-05-27 v4 — Destello de encaje. Crea dos capas efímeras dentro
// del contenedor del archipiélago, centradas en (cx, cy) — el centro
// de la isla recién encajada, en coords de viewport:
//   · .lockin-flash        — frente de onda radial que se expande.
//   · .lockin-flash-global — wash que tiñe todo el mapa.
// Ambas se autodestruyen al terminar su animación (~900ms).
function _spawnLockinFlash(cx, cy) {
  const root = document.getElementById("archipielago-float");
  if (!root) return;
  const globalFlash = document.createElement("div");
  globalFlash.className = "lockin-flash-global";
  globalFlash.style.setProperty("--fx", `${cx}px`);
  globalFlash.style.setProperty("--fy", `${cy}px`);
  const radial = document.createElement("div");
  radial.className = "lockin-flash";
  radial.style.left = `${cx}px`;
  radial.style.top = `${cy}px`;
  root.appendChild(globalFlash);
  root.appendChild(radial);
  setTimeout(() => { radial.remove(); globalFlash.remove(); }, 920);
}

// Hash determinista de un string corto → entero 32-bit (positivo).
function _hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

// PRNG xorshift32 simple a partir de seed.
function _seededRand(seed) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return (s & 0xffffffff) / 0x100000000;
  };
}

// Encuentra una posición random dentro del viewport que:
//  - quepa íntegra (con margen para el nombre debajo)
//  - no se overlapee con OTROS items ya posicionados
//  - esté a una distancia mínima del ghost-target propio (para que
//    haya "viaje" visual al hacer hover)
// Distribución determinista en banda perimetral del viewport. 7 slots
// dispuestos en una orla alrededor del rectángulo central (donde están
// los ghosts del archipiélago). Cada isla recibe un slot único basado
// en un orden estable (índice en el array de items). Jitter pequeño
// con seed por id para suavizar la regularidad.
function _seededRandPositionAvoiding(seed, W, H, w, h, items, self, layout) {
  const rand = _seededRand(seed);
  const padTop = 90;             // bajo banner + membrete (48+8+~30)
  const padBottom = 60;
  const padSide = 14;
  const labelSpace = 22;
  const idx = items.indexOf(self);
  const n = items.length;
  const safeMaxX = Math.max(padSide, W - w - padSide);
  const safeMaxY = Math.max(padTop, H - h - padBottom - labelSpace);
  // 8 slots perimetrales (orden horario empezando arriba-izquierda).
  // Si hay 7 islas, dejamos uno vacío automáticamente.
  const slotPositions = [
    [padSide,            padTop],            // 0 top-left
    [(W - w) * 0.5,      padTop],            // 1 top-center
    [safeMaxX,           padTop],            // 2 top-right
    [safeMaxX,           (padTop + safeMaxY) * 0.5],  // 3 mid-right
    [safeMaxX,           safeMaxY],          // 4 bot-right
    [(W - w) * 0.5,      safeMaxY],          // 5 bot-center
    [padSide,            safeMaxY],          // 6 bot-left
    [padSide,            (padTop + safeMaxY) * 0.5]   // 7 mid-left
  ];
  // Saltamos el slot 1 (top-center) si hay riesgo de chocar con el
  // membrete que está top-center.
  const allowed = [0, 2, 3, 4, 5, 6, 7];   // 7 slots para 7 islas
  const slotIdx = allowed[idx % allowed.length];
  let [x, y] = slotPositions[slotIdx];
  // Jitter pequeño por seed (±10px) para que no parezca demasiado robot.
  x += (rand() - 0.5) * 20;
  y += (rand() - 0.5) * 20;
  // Clamp al viewport (defensivo).
  x = Math.max(padSide, Math.min(safeMaxX, x));
  y = Math.max(padTop, Math.min(safeMaxY, y));
  return [x, y];
}

function _attachArchipielagoFloatInteractions(root) {
  // Hover (solo mouse): SOLO ilumina la isla (color + halo + pausa
  // bobbing). NO la mueve a su sitio — eso lo decide el usuario al
  // arrastrarla. Touch ignora hover; usa pointerdown→drag+drop.
  root.addEventListener("pointerover", (e) => {
    const float = e.target.closest(".isla-float");
    if (!float) return;
    if (e.pointerType !== "mouse") return;
    _setHighlight(float.dataset.isla, true);
  });
  root.addEventListener("pointerout", (e) => {
    const float = e.target.closest(".isla-float");
    if (!float) return;
    if (e.pointerType !== "mouse") return;
    // No deshacer si está siendo arrastrada
    if (_ARCH_FLOAT.pointer?.item?.floatEl === float) return;
    _setHighlight(float.dataset.isla, false);
  });

  // Pointerdown → potencial drag. Mobile fallback: si touch + sin
  // desplazamiento + corto, lo tratamos como tap → enterIsla.
  root.addEventListener("pointerdown", (e) => {
    const float = e.target.closest(".isla-float");
    if (!float) return;
    const item = _ARCH_FLOAT.items.find(it => it.islaId === float.dataset.isla);
    if (!item) return;
    e.preventDefault();
    // setPointerCapture puede fallar con eventos sintéticos o pointer IDs
    // no reconocidos por el navegador; lo envolvemos para no romper drag.
    try { float.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
    const rect = float.getBoundingClientRect();
    _ARCH_FLOAT.pointer = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      offX: e.clientX - rect.left,
      offY: e.clientY - rect.top,
      item, moved: false,
      pointerType: e.pointerType,
      startedAt: performance.now()
    };
    float.classList.add("dragging");
    float.classList.remove("snapped", "highlighted");
    root.classList.add("interacted");
    item.dragging = true;
    p.lastMoveX = e.clientX;
    p.lastMoveY = e.clientY;
    p.lastMoveT = performance.now();
  });

  root.addEventListener("pointermove", (e) => {
    const p = _ARCH_FLOAT.pointer;
    if (!p || p.id !== e.pointerId) return;
    const dx = e.clientX - p.startX;
    const dy = e.clientY - p.startY;
    // Threshold de 8px (vs el habitual 4): el arrastre debe ser un
    // gesto deliberado — Pancho pide "que te esfuerce arrastrar la isla".
    if (!p.moved && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) p.moved = true;
    const x = e.clientX - p.offX;
    const y = e.clientY - p.offY;
    p.item.floatEl.style.left = `${x}px`;
    p.item.floatEl.style.top = `${y}px`;
    p.item.physX = x;
    p.item.physY = y;
    // Corrección rotacional: si la isla se aproxima a su ghost,
    // physRot tiende a 0° proporcional a la cercanía.
    const now = performance.now();
    const dtMove = Math.max(0.001, Math.min(0.05, (now - (p.lastMoveT || now)) / 1000));
    _correctRotationTowardsGhost(p.item, e.clientX, e.clientY, dtMove);
    // Guardar movimiento para calcular impulso al soltar fuera.
    p.lastVX = (e.clientX - (p.lastMoveX ?? e.clientX)) / dtMove;
    p.lastVY = (e.clientY - (p.lastMoveY ?? e.clientY)) / dtMove;
    p.lastMoveX = e.clientX;
    p.lastMoveY = e.clientY;
    p.lastMoveT = now;
    // Resalta el ghost si el cursor cae dentro de su radio.
    const inside = _isOverGhost(p.item, e.clientX, e.clientY);
    for (const it of _ARCH_FLOAT.items) {
      it.ghostEl.classList.toggle("hit",
        it === p.item && inside);
      it.ghostEl.classList.toggle("active",
        it === p.item && !inside);
    }
  });

  const finishPointer = (e) => {
    const p = _ARCH_FLOAT.pointer;
    if (!p || p.id !== e.pointerId) return;
    _ARCH_FLOAT.pointer = null;
    const item = p.item;
    item.floatEl.classList.remove("dragging");
    item.dragging = false;
    // Mobile tap heuristic: pointerType=touch + no movido + breve.
    const elapsed = performance.now() - p.startedAt;
    if (!p.moved && p.pointerType === "touch" && elapsed < 400) {
      _enterIslaFromFloat(item.islaId);
      return;
    }
    // Drop test: ¿soltado dentro del ghost-target propio?
    if (p.moved && _isOverGhost(item, e.clientX, e.clientY)) {
      // 2026-05-27 v4 — Lock-in cinematográfico: descenso lento (850ms)
      // con glow interior creciente + destello radial "de adentro a
      // afuera" que ilumina todo el mapa + onda de choque (quake) en el
      // resto de islas. La animación CSS `lockin-descend` baja la isla
      // desde 18px arriba a su sitio; `top` se queda fijo en ghostY
      // (el descenso es transform), así que acaba alineada con el ghost.
      item.snapped = true;
      item.physX = item.ghostX;
      item.physY = item.ghostY;
      item.physRot = 0;
      item.floatEl.style.left = `${item.ghostX}px`;
      item.floatEl.style.top = `${item.ghostY}px`;
      if (item.inner) item.inner.style.transform = `rotate(0deg)`;
      item.floatEl.classList.add("snapped", "locked");
      // [D] Recordamos qué isla quedó encajada para que, al volver al
      // archipiélago, podamos hacer el efecto inverso "emerge".
      _ARCH_FLOAT.lastEncajadaId = item.islaId;
      for (const it of _ARCH_FLOAT.items) {
        it.ghostEl.classList.remove("hit", "active");
      }
      // Destello "de adentro a afuera": un frente de onda radial nace
      // del centro de la isla y se expande cubriendo el viewport, más
      // un wash global que tiñe todo el mapa con un fogonazo cálido.
      _spawnLockinFlash(item.ghostX + item.cellW / 2,
                        item.ghostY + item.cellH / 2);
      // Onda de choque: las demás islas (que siguen flotando) tiemblan
      // brevemente como por el impacto del encaje. Excluimos la propia
      // isla encajada, las ya snapped, las que se están arrastrando y
      // las en hover (cuya transform colisionaría con `lockin-quake`).
      for (const it of _ARCH_FLOAT.items) {
        if (it === item || it.snapped || it.dragging) continue;
        if (it.floatEl.classList.contains("highlighted")) continue;
        it.floatEl.classList.add("quaking");
        setTimeout(() => it.floatEl.classList.remove("quaking"), 560);
      }
      // 1050ms = 850ms (descenso) + 200ms para saborear el destello
      // antes de cambiar de nivel.
      setTimeout(() => _enterIslaFromFloat(item.islaId), 1050);
      return;
    }
    // Drop fuera: re-incorporar al motor físico con un impulso nuevo
    // tomado de la velocidad del último movimiento del cursor. Si el
    // usuario soltó sin movimiento previo, le damos una velocidad
    // pequeña aleatoria para que no se quede inerte. Mantenemos su
    // posición actual (no vuelve al freeX/Y original — Pancho:
    // "al arrastrarlas, se vayan reposicionando").
    item.snapped = false;
    item.floatEl.classList.remove("snapped");
    const releaseVx = (p.lastVX || 0);
    const releaseVy = (p.lastVY || 0);
    const releaseSpeed = Math.hypot(releaseVx, releaseVy);
    const maxSpeed = 220;            // clamp para no salir disparada
    if (releaseSpeed > 4) {
      const sc = Math.min(1, maxSpeed / releaseSpeed);
      item.vx = releaseVx * sc;
      item.vy = releaseVy * sc;
    } else {
      // Sin gesto: relanzamos con velocidad aleatoria moderada.
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 20;
      item.vx = Math.cos(angle) * speed;
      item.vy = Math.sin(angle) * speed;
    }
    // Le damos un nuevo spin (puede invertir sentido).
    item.vrot = (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 6);
    for (const it of _ARCH_FLOAT.items) {
      it.ghostEl.classList.remove("hit", "active");
    }
  };
  root.addEventListener("pointerup", finishPointer);
  root.addEventListener("pointercancel", finishPointer);

  // Teclado: Enter/Space sobre una isla con foco = enterIsla directo
  // (accesibilidad básica, sin pelearnos con el drag).
  root.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const float = e.target.closest(".isla-float");
    if (!float) return;
    e.preventDefault();
    _enterIslaFromFloat(float.dataset.isla);
  });
}

// Hover (mouse) → la isla solo se ILUMINA en su posición flotante;
// no se mueve a su ghost. El usuario debe arrastrarla para encajarla.
function _setHighlight(islaId, on) {
  const item = _ARCH_FLOAT.items.find(it => it.islaId === islaId);
  if (!item) return;
  if (on) {
    item.floatEl.classList.add("highlighted");
    item.ghostEl.classList.add("active");
  } else {
    item.floatEl.classList.remove("highlighted");
    item.ghostEl.classList.remove("active");
  }
}

function _isOverGhost(item, clientX, clientY) {
  const cx = item.ghostX + item.ghostW / 2;
  const cy = item.ghostY + item.ghostH / 2;
  return Math.hypot(clientX - cx, clientY - cy) < _ARCH_FLOAT.DROP_RADIUS_PX;
}

function _enterIslaFromFloat(islaId) {
  enterIsla(islaId, true);
}

// Limpia el estado visual de TODAS las siluetas al regresar al
// archipiélago (back desde isla, popstate, etc.). Garantiza que la
// isla que se acaba de visitar no quede marcada como locked/snapped al
// volver al selector.
function _resetArchipielagoFloatState() {
  if (!_ARCH_FLOAT.mounted) return;
  // [D] Antes de limpiar, recordamos si había una isla encajada para
  // disparar el efecto "emerge" (la pieza asoma del slot antes de
  // re-incorporarse al motor físico). Solo aplica a esa isla.
  const emergeId = _ARCH_FLOAT.lastEncajadaId || null;
  for (const it of _ARCH_FLOAT.items) {
    it.snapped = false;
    it.dragging = false;
    it.floatEl.classList.remove("snapped", "locked", "dragging", "highlighted");
    it.ghostEl.classList.remove("active", "hit");
    // [D] La isla que estaba encajada arranca con un translateY -12px
    // + scale 1.1 y se relaja por transition hasta su posición física
    // normal. El motor físico actualiza left/top y rotate del inner
    // cada frame; .emerging solo añade transform sobre el contenedor
    // (no entra en conflicto con el rotate del inner ni con left/top).
    // Diferimos la clase a 2× requestAnimationFrame para que el
    // contenedor float (que puede estar oculto/recién montado) ya
    // sea visible y el browser dispare la transition correctamente.
    if (emergeId && it.islaId === emergeId) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          it.floatEl.classList.add("emerging");
          setTimeout(() => {
            it.floatEl.classList.remove("emerging");
          }, 400);
        });
      });
    }
  }
  _ARCH_FLOAT.lastEncajadaId = null;
  _ARCH_FLOAT.pointer = null;
}

// -----------------------------------------------------------
// Motor físico (2026-05-21 v3) — las islas flotan tipo screensaver:
// translation + rotación libres, rebote en bordes del viewport, y
// colisiones entre sí (basadas en círculos inscritos para abaratar el
// hit-test). Cuando una isla se arrastra cerca de su ghost target, la
// rotación se va corrigiendo suavemente hacia 0° (el ángulo del mapa
// real), dando la satisfacción de irla "centrando".

function _startArchipielagoPhysics() {
  if (_ARCH_FLOAT.physTimer) return;
  _ARCH_FLOAT.physLastT = performance.now();
  const tick = (now) => {
    if (!_ARCH_FLOAT.physTimer) return; // stopped
    const dt = Math.min((now - _ARCH_FLOAT.physLastT) / 1000, 0.05);
    _ARCH_FLOAT.physLastT = now;
    _physicsTickArchipielago(dt);
    _ARCH_FLOAT.physTimer = requestAnimationFrame(tick);
  };
  _ARCH_FLOAT.physTimer = requestAnimationFrame(tick);
}

function _stopArchipielagoPhysics() {
  if (_ARCH_FLOAT.physTimer) {
    cancelAnimationFrame(_ARCH_FLOAT.physTimer);
    _ARCH_FLOAT.physTimer = null;
  }
}

function _physicsTickArchipielago(dt) {
  const layout = _ARCH_FLOAT.bbox;
  if (!layout) return;
  const W = layout.W, H = layout.H;
  const padTop = 90;     // bajo banner+membrete
  const padBottom = 60;  // sobre el hint
  const items = _ARCH_FLOAT.items;

  // 1) Translation + rotation libre + rebote en bordes.
  for (const it of items) {
    if (it.dragging || it.snapped) continue;
    it.physX += it.vx * dt;
    it.physY += it.vy * dt;
    it.physRot += it.vrot * dt;
    // Bordes (rebote elástico).
    if (it.physX < 0) { it.physX = 0; it.vx = Math.abs(it.vx); }
    if (it.physX + it.cellW > W) { it.physX = W - it.cellW; it.vx = -Math.abs(it.vx); }
    if (it.physY < padTop) { it.physY = padTop; it.vy = Math.abs(it.vy); }
    if (it.physY + it.cellH > H - padBottom) {
      it.physY = H - padBottom - it.cellH;
      it.vy = -Math.abs(it.vy);
    }
  }

  // 2) Colisiones entre islas (círculo inscrito por isla).
  //
  // v1.7.float-phys — Antes: intercambio elástico simétrico de velocidades
  // (asumía masa idéntica para todas las islas). El resultado era que
  // chocar con Tenerife o con El Hierro daba exactamente el mismo
  // empujón, lo cual contradice la intuición visual.
  //
  // Ahora: conservación de momento 1D a lo largo del normal con masas
  // proporcionales al área del círculo inscrito (m ≈ r², el escalado
  // de la silueta lo determina, no aparece densidad explícita) y
  // coeficiente de restitución e=0.88 (un pelín por debajo de 1 para
  // amortiguar suavemente — evita que el archipiélago se acelere por
  // resonancia tras un rato de bobbing).
  //
  // Efecto neto:
  //   · velocidad relativa de impacto → magnitud del impulso (j ∝ velRel)
  //   · masa → reparto del impulso (la pequeña sale más despedida,
  //     j/m mayor para r menor)
  // Más un baseKick mínimo (8 px/s) para que dos islas casi-paradas
  // que se rozan aún se separen con visible ligereza.
  const RESTITUTION = 0.88;
  const BASE_KICK = 8; // px/s — impulso mínimo de separación
  for (let i = 0; i < items.length; i++) {
    const a = items[i];
    if (a.dragging || a.snapped) continue;
    const ax = a.physX + a.cellW / 2;
    const ay = a.physY + a.cellH / 2;
    const ra = Math.min(a.cellW, a.cellH) * 0.42;
    const ma = ra * ra;
    for (let j = i + 1; j < items.length; j++) {
      const b = items[j];
      if (b.dragging || b.snapped) continue;
      const bx = b.physX + b.cellW / 2;
      const by = b.physY + b.cellH / 2;
      const rb = Math.min(b.cellW, b.cellH) * 0.42;
      const mb = rb * rb;
      const dx = bx - ax, dy = by - ay;
      const dist2 = dx * dx + dy * dy;
      const minD = ra + rb;
      if (dist2 < minD * minD && dist2 > 0.01) {
        const dist = Math.sqrt(dist2);
        const nx = dx / dist, ny = dy / dist;
        // Separación geométrica: desplazamos cada isla proporcional al
        // INVERSO de su masa (la pequeña cede más terreno). Antes
        // era 50/50 ciego.
        const overlap = (minD - dist);
        const wA = mb / (ma + mb);  // a se mueve ∝ mb (la otra)
        const wB = ma / (ma + mb);
        a.physX -= nx * overlap * wA;
        a.physY -= ny * overlap * wA;
        b.physX += nx * overlap * wB;
        b.physY += ny * overlap * wB;

        // Velocidades a lo largo del normal (positivo b→a separándose).
        const va = a.vx * nx + a.vy * ny;
        const vb = b.vx * nx + b.vy * ny;
        const velRel = va - vb; // velocidad de aproximación
        if (velRel > 0) {
          // Sólo aplicamos impulso si se están acercando; evita que
          // una segunda iteración tras la separación geométrica las
          // re-pegue al "rebotar" contra una velocidad ya saliente.
          const effectiveVel = Math.max(velRel, BASE_KICK);
          const j = -(1 + RESTITUTION) * effectiveVel / (1 / ma + 1 / mb);
          // j es escalar; a recibe j/ma a lo largo del normal (negativo
          // porque la convención `dx = bx - ax` apunta de a→b).
          const ja = j / ma;
          const jb = -j / mb;
          a.vx += ja * nx; a.vy += ja * ny;
          b.vx += jb * nx; b.vy += jb * ny;
          // 2026-05-25 — Pancho: añadir algunos grados de giro al colisionar
          // para que la pieza visiblemente rote por el impacto. Proporcional
          // a la magnitud del impulso (los choques fuertes giran más).
          // El signo del torque depende de qué cara recibe el golpe:
          // usamos el componente tangencial del vector normal como signo.
          const torqueScale = 0.04; // deg/s por unidad de impulso
          const tangentSignA = (ny >= 0 ? 1 : -1);
          const tangentSignB = (ny >= 0 ? -1 : 1);
          const impulseMag = Math.abs(j);
          a.vrot += tangentSignA * impulseMag * torqueScale / ma;
          b.vrot += tangentSignB * impulseMag * torqueScale / mb;
          // Clamp para evitar giros descontrolados al concatenar choques.
          const ROT_CAP = 35; // deg/s
          if (a.vrot > ROT_CAP) a.vrot = ROT_CAP;
          if (a.vrot < -ROT_CAP) a.vrot = -ROT_CAP;
          if (b.vrot > ROT_CAP) b.vrot = ROT_CAP;
          if (b.vrot < -ROT_CAP) b.vrot = -ROT_CAP;
        }
      }
    }
  }

  // 3) Aplicar al DOM.
  for (const it of items) {
    if (it.snapped) continue;       // posición fija
    if (it.dragging) continue;      // controlada por pointermove
    it.floatEl.style.left = `${it.physX}px`;
    it.floatEl.style.top = `${it.physY}px`;
    if (it.inner) it.inner.style.transform = `rotate(${it.physRot}deg)`;
  }
}

// Corrige la rotación durante el drag: cuanto más cerca está la isla
// de su ghost target, más se interpola physRot hacia 0° (la
// orientación del mapa). Esto da feedback de "vas en buena dirección"
// además del rebote físico al soltar fuera.
function _correctRotationTowardsGhost(item, clientX, clientY, dt) {
  const cx = item.ghostX + item.ghostW / 2;
  const cy = item.ghostY + item.ghostH / 2;
  const dx = clientX - cx;
  const dy = clientY - cy;
  const dist = Math.hypot(dx, dy);
  const R = _ARCH_FLOAT.ROT_CORRECT_RADIUS_PX;
  if (dist >= R) return; // fuera del radio de corrección
  // proximidad ∈ (0,1] — 1 = encima del ghost, 0 = en el borde del radio.
  const proximidad = 1 - dist / R;
  // Strength: con proximidad 1, recorta casi todo el ángulo cada frame;
  // con proximidad baja, solo un susurro.
  const lerp = Math.min(1, proximidad * 6 * dt);
  item.physRot += (0 - item.physRot) * lerp;
  if (item.inner) item.inner.style.transform = `rotate(${item.physRot}deg)`;
}

// -----------------------------------------------------------
// Tap por nivel.

function handleTap(px, py) {
  if (state._anim) return; // ignorar durante animación
  if (state._slideAnim) return;
  // v1.6.nav — Si un long-press disparó peek, el touchend siguiente NO
  // debe interpretarse como tap (si no, peek + navegación a la vez).
  if (state._lpFired) { state._lpFired = false; return; }

  // Prioridad alta: si los overlays interactivos están activos,
  // comprobar si el tap cayó en un pin. Orden de prioridad explícito
  // (jerarquía de visibilidad pedida por el usuario):
  //   1. tejido-social — corazón del proyecto, máxima prioridad
  //   2. productores   — pequeño productor local
  //   3. eventos       — contenido institucional/cultural
  if (state.activeOverlays?.["tejido-social"] && tejidoSocialOverlay.isReady()) {
    const hit = tejidoSocialOverlay.hitTest(px, py, state, state.view);
    if (hit) {
      openTejidoPopup(hit);
      return;
    }
  }
  if (state.activeOverlays?.productores && productoresOverlay.isReady()) {
    const hit = productoresOverlay.hitTest(px, py, state, state.view);
    if (hit) {
      openProductorPopup(hit);
      return;
    }
  }
  if (state.activeOverlays?.eventos && eventosOverlay.isReady()) {
    // P5 (2026-05-21): si un cluster acumula varios eventos, abrir modal
    // con lista para que el usuario elija. Solo cuando hay 1 evento, ir
    // directo al popup. Fallback a hitTest si hitTestCluster no existe.
    const hits = eventosOverlay.hitTestCluster?.(px, py, state, state.view)
              || (eventosOverlay.hitTest?.(px, py, state, state.view) ? [eventosOverlay.hitTest(px, py, state, state.view)] : []);
    if (hits.length === 1) {
      openEventoPopup(hits[0]);
      return;
    } else if (hits.length > 1) {
      openEventoListModal(hits);
      return;
    }
  }
  // Registro oficial al final — menor prioridad que el tejido social
  // curado (P6 — overlay raw del Registro de Asociaciones de Canarias).
  if (state.activeOverlays?.["registro-oficial"] && registroOverlay.isReady()) {
    const hit = registroOverlay.hitTest(px, py, state, state.view);
    if (hit) {
      openRegistroEntidadPopup(hit);
      return;
    }
  }

  if (state.lodLevel === "archipielago") {
    // 2026-05-19 — Tap a nivel archipiélago entra DIRECTO a la isla.
    // Hit-test sobre todos los rings (MultiPolygon) de cada isla.
    const islands = state.archipielago?.islands || [];
    for (let i = islands.length - 1; i >= 0; i--) {
      const f = islands[i];
      for (const r of (f._rings || [f._ringSimple])) {
        const ringPx = r.map(([x, z]) => project(x, 0, z, state.view));
        if (pointInScreenPolygon(px, py, ringPx)) {
          enterIsla(f.properties.isla, true);
          return;
        }
      }
    }
  } else if (state.lodLevel === "isla") {
    for (let i = state.isla.municipios.length - 1; i >= 0; i--) {
      const m = state.isla.municipios[i];
      const ringPx = m._ringSimple.map(([x, z]) => project(x, 0, z, state.view));
      if (pointInScreenPolygon(px, py, ringPx)) {
        // v1.6.nav — Tap a nivel isla entra DIRECTO al municipio. El
        // popup informativo bloqueante se sustituyó por peek
        // (hover/long-press) que aparece sin frenar la navegación.
        enterMunicipio(m.properties.mun, true);
        return;
      }
    }
  } else if (state.lodLevel === "municipio") {
    // 2026-05-24 — Cluster DBSCAN hit-test va PRIMERO. Si el tap cae en
    // una HUD card de cluster (renderer publica state._munClusterRects),
    // el cluster gana — zoom in a su bbox para revelar barrios/secs/
    // edificios concentrados ahí. No cambia de lodLevel: queda al user
    // hacer otro tap si quiere entrar a un barrio/sec específico.
    const clusterRects = state._munClusterRects;
    if (clusterRects && clusterRects.length) {
      const PAD = 12;
      for (const cr of clusterRects) {
        if (px >= cr.x0 - PAD && px <= cr.x1 + PAD &&
            py >= cr.y0 - PAD && py <= cr.y1 + PAD) {
          const cluster = (state.municipio.clusters || []).find(c => c.id === cr.clusterId);
          // 2026-05-29 — Si el cluster ya está enfocado (zoom ≈ su bbox),
          // focusOnCluster es no-op: NO consumimos el tap, lo dejamos caer
          // al descenso de sección de abajo. Sin esto, en muns rurales/
          // prov 38 las cards de cluster cubren el núcleo edificado y
          // bloqueaban por completo la entrada a la sección.
          if (cluster) { if (focusOnCluster(cluster)) return; break; }
        }
      }
    }

    // v1.6.barrio-pieza (Fase 2a) — Las piezas tappables del nivel mun
    // son los barrios canonical (164 prov 35), no las 274 secciones-INE.
    // Hit-test prioriza piezas-barrio; si el mun no tiene piezas (caso
    // Tejeda/Artenara) o el tap cae sobre una sección huérfana, caemos
    // al comportamiento legacy (enterDistrito por cusec→distrito).
    const piezas = state.municipio.barriosPiezas;

    // [C] Hit-test extendido sobre la etiqueta del barrio (o cerca, ±20
    // px). El renderer publica los rects de las etiquetas pintadas en
    // state._munLabelRects (ver renderMunicipio en renderer.js). En
    // muns dispersos (Mogán, San Bart) las piezas pueden ser pequeñas
    // y la etiqueta es el target táctil principal — sin este hit-test
    // el tap fallaría por margen.
    const labelRects = state._munLabelRects;
    if (labelRects && labelRects.length && piezas && piezas.length) {
      const PAD = 20;
      for (const lr of labelRects) {
        if (px >= lr.x0 - PAD && px <= lr.x1 + PAD &&
            py >= lr.y0 - PAD && py <= lr.y1 + PAD) {
          const p = piezas.find(pp => pp.id === lr.piezaId);
          if (p) { enterBarrio(p.id, true); return; }
        }
      }
    }

    if (piezas && piezas.length) {
      for (let i = piezas.length - 1; i >= 0; i--) {
        const p = piezas[i];
        // MultiPolygon: hit en cualquier ring cuenta.
        for (const ring of p.rings) {
          const ringPx = ring.map(([x, z]) => project(x, 0, z, state.view));
          if (pointInScreenPolygon(px, py, ringPx)) {
            enterBarrio(p.id, true);
            return;
          }
        }
      }
    }
    // Fallback (orphan section o mun sin barrios canonical): tap sobre
    // sección desciende.
    // 2026-05-29 — Salto del distrito redundante. En municipios de UN
    // solo distrito (todo El Hierro/La Gomera y los rurales) el nivel
    // distrito repite exactamente las mismas secciones del municipio y
    // su fitView ALEJA la cámara (el mun entra con densityFocusedBbox,
    // más cercano, que el bbox del distrito). El usuario percibía eso
    // como "retroceder" al intentar bajar, y además el doble-tap del
    // nivel distrito para llegar a edificios era frágil. Si el mun tiene
    // 1 distrito vamos directo a la sección (descenso monótono de 1 tap);
    // los muns multi-distrito (urbanos GC) conservan el flujo distrito.
    const singleDistrito = (state.municipio.distList?.length || 1) <= 1;
    for (let i = state.municipio.secciones.length - 1; i >= 0; i--) {
      const s = state.municipio.secciones[i];
      const ringPx = s._ringSimple.map(([x, z]) => project(x, 0, z, state.view));
      if (pointInScreenPolygon(px, py, ringPx)) {
        const cusec = s.properties.cusec;
        if (singleDistrito) {
          enterSeccion(cusec, true);
        } else {
          const distritoId = cusec.slice(2, 7); // mun(3)+dis(2)
          enterDistrito(distritoId, true);
        }
        return;
      }
    }
    // v1.6.fluid — tap sobre vecino municipio: entrada directa con
    // animación estándar de view (drill-down regular). El slide
    // horizontal entre vecinos (v1.5.2) se eliminó: usuario reporta
    // sensación de "desplazamiento de cámara" molesto al tap-vecino.
    const neigh = state.municipio.neighbors || [];
    for (const n of neigh) {
      const ringPx = n._ringSimple.map(([x, z]) => project(x, 0, z, state.view));
      if (pointInScreenPolygon(px, py, ringPx)) {
        enterMunicipio(n.properties.mun, true);
        return;
      }
    }
  } else if (state.lodLevel === "distrito") {
    // v1.6e — Tap a nivel distrito navega (zoom-in animado) a la
    // sección bajo el cursor en lugar de toggle-en-sitio. El highlight
    // surge al llegar al zoom donde ya se ven los edificios; en el
    // mosaico de entrada solo es hint de clicabilidad. La navegación
    // mantiene lodLevel=distrito — todos los packs de sección del
    // distrito siguen cargados, así que se ven edificios vecinos sin
    // discontinuidad. La unidad mínima desde donde se colgará el
    // tablero de actividades es el edificio individual (zoom α3).
    const secs = state.district.secciones;
    for (let i = secs.length - 1; i >= 0; i--) {
      const s = secs[i];
      const ringPx = s._ringSimple.map(([x, z]) => project(x, 0, z, state.view));
      if (pointInScreenPolygon(px, py, ringPx)) {
        const cusec = s.properties.cusec;
        // 2º tap sobre la sección ya seleccionada → entrar a nivel sección
        // (desde donde se accede a manzanas → edificios → tablero). El 1er
        // tap (abajo) solo selecciona + hace zoom. Esto da el drill-down
        // completo a edificio en todas las islas, no solo GC (que llega vía
        // barrio→manzana). En GC el nivel distrito es un fallback poco
        // usado, así que el cambio no afecta su flujo habitual.
        if (state.selectedSeccionCusec === cusec) {
          enterSeccion(cusec, true);
          return;
        }
        state.selectedSeccionCusec = cusec;
        if (window.polisApp?._syncSeccionDetalleToggle) window.polisApp._syncSeccionDetalleToggle();
        state.hoveredSeccionCusec = null;
        // [A] Animación: zoom a ratio 4.2× fitScale (α3 entrando con
        // bldHeightK ≈ 0.5 — edificios a media altura, contexto urbano
        // todavía visible). Antes era 5×, que aterrizaba con edificios
        // ya saturados y la sensación de "se ha perdido la ciudad".
        // 850 ms (antes 600) para que el ramp footprint→3D dé tiempo
        // a leerse como gradiente y no como teleporte.
        const [cx_w, cz_w] = s._centroid;
        const toView = {
          ...state.view,
          scale: state.view.fitScale * 4.2, // [A] lowered from 5
          tx: cx_w,
          ty: cz_w
        };
        animateView(state.view, toView, 850); // [A] longer
        return;
      }
    }
    // Tap fuera de cualquier sección → si hay selección, deselecciona y
    // anima de vuelta a entry zoom. Si no hay selección, no hace nada.
    if (state.selectedSeccionCusec) {
      state.selectedSeccionCusec = null;
      if (window.polisApp?._syncSeccionDetalleToggle) window.polisApp._syncSeccionDetalleToggle();
      // Restaurar view a entry del distrito (fitScale * 1.05, centrado
      // en el centro del bbox).
      const [bxa, bxb, bxc, bxd] = state.district.bbox;
      const toView = {
        ...state.view,
        scale: state.view.fitScale * 1.05,
        tx: (bxa + bxc) / 2,
        ty: (bxb + bxd) / 2
      };
      animateView(state.view, toView, 500);
    }
    // v1.6.fluid — tap sobre distrito vecino: entrada directa con
    // animación estándar (no slide horizontal). Ver bloque municipio.
    const neigh = state.district.neighborDistricts || [];
    for (const nd of neigh) {
      for (const s of nd.secciones) {
        const ringPx = s._ringSimple.map(([x, z]) =>
          project(x, 0, z, state.view));
        if (pointInScreenPolygon(px, py, ringPx)) {
          enterDistrito(nd.distritoId, true);
          return;
        }
      }
    }
  } else if (state.lodLevel === "barrio") {
    // v1.6.manzana (Phase 2b) — Tap a nivel barrio: hit-test sobre los
    // polígonos de manzanas del barrio. Si hay hit → enterManzana(id)
    // con id compuesto (cusec + manzana_id local). Si el tap cae fuera
    // de cualquier manzana mantenemos el comportamiento de fallback
    // legacy (entrar a la sección a la que pertenece el polígono-bloque
    // bajo el tap), igual que hacía el distrito.
    //
    // v1.6.tap-progresivo — Si la manzana es muy pequeña en pantalla
    // (zoom-out fuerte), el "salto" a manzana es excesivo: primero
    // hacemos zoom-pan animado centrado en la manzana sin cambiar de
    // nivel. Un segundo tap, ya con la manzana grande, entra a manzana.
    const manzanas = state.barrio?.manzanas || [];
    const MIN_TAP_SIZE_PX = 70;   // bajo este tamaño no entramos directo
    const TARGET_SIZE_PX  = 180;  // tamaño objetivo tras el zoom progresivo
    for (let i = manzanas.length - 1; i >= 0; i--) {
      const m = manzanas[i];
      const ringPx = m._ringSimple.map(([x, z]) => project(x, 0, z, state.view));
      if (pointInScreenPolygon(px, py, ringPx)) {
        // Bbox en pantalla → dimensión más larga.
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const [x, y] of ringPx) {
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
        const sizePx = Math.max(maxX - minX, maxY - minY);
        if (sizePx < MIN_TAP_SIZE_PX) {
          // Zoom progresivo: centrar la manzana y acercar lo justo para
          // que sea tappable cómodamente. Cap a fitScale*4 para evitar
          // overshoot (4× es ENTRY_ZOOM.manzana + margen).
          const [cx_w, cz_w] = m._centroid;
          const k = TARGET_SIZE_PX / Math.max(sizePx, 1);
          const newScale = Math.min(state.view.fitScale * 4.0,
                                    state.view.scale * k);
          animateView(state.view, {
            ...state.view,
            scale: newScale,
            tx: cx_w,
            ty: cz_w
          }, 450);
          return;
        }
        const compositeId = `${m._cusec}-${m.properties.id}`;
        enterManzana(compositeId, { animate: true });
        return;
      }
    }
    // Fallback: tap fuera de toda manzana → comportamiento de sección
    // del barrio (selecciona la sección si la hay debajo). Reutiliza
    // el patrón del distrito: zoom-in animado a la sección.
    const secs = state.barrio?.secciones || [];
    for (let i = secs.length - 1; i >= 0; i--) {
      const s = secs[i];
      const ringPx = s._ringSimple.map(([x, z]) => project(x, 0, z, state.view));
      if (pointInScreenPolygon(px, py, ringPx)) {
        const cusec = s.properties.cusec;
        state.selectedSeccionCusec = cusec;
        if (window.polisApp?._syncSeccionDetalleToggle) window.polisApp._syncSeccionDetalleToggle();
        const [cx_w, cz_w] = s._centroid;
        const toView = {
          ...state.view,
          scale: state.view.fitScale * 5,
          tx: cx_w,
          ty: cz_w
        };
        animateView(state.view, toView, 600);
        return;
      }
    }
    // [G] Tap sobre barrio vecino del mismo mun → cambio lateral sin
    // volver a nivel mun. El renderer ya pinta los vecinos como outline
    // (barrioRings de neighborBarrios) — aquí los hacemos tappables.
    // Acceso fluido a "zonas continuas".
    const nbs = state.barrio?.neighborBarrios || [];
    for (const nb of nbs) {
      for (const ring of (nb.rings || [])) {
        const ringPx = ring.map(([x, z]) => project(x, 0, z, state.view));
        if (pointInScreenPolygon(px, py, ringPx)) {
          enterBarrio(nb.id, true);
          return;
        }
      }
    }
  } else if (state.lodLevel === "manzana") {
    // v1.6.manzana (Phase 2b) — Tap a nivel manzana: hit-test sobre los
    // edificios. Cuando hay hit llamamos al hook `onBuildingTap` sin
    // entrar a un sublevel — Phase 2c implementará el modal focal. Si
    // el tap cae fuera de los edificios pero sobre la manzana padre,
    // no-op (queda como hint visual de que se está en zoom manzana).
    const buildings = state.manzana?.buildings || [];
    for (let i = buildings.length - 1; i >= 0; i--) {
      const b = buildings[i];
      const ringPx = b._ring.map(([x, z]) => project(x, 0, z, state.view));
      if (pointInScreenPolygon(px, py, ringPx)) {
        const bid = b.properties.id || b.properties.osm_id
                    || `${state.manzana.cusec}-${state.manzana.manzanaId}-b${i}`;
        onBuildingTap(bid, state.manzana.id);
        return;
      }
    }
  } else if (state.lodLevel === "seccion") {
    // Tap progresivo sobre manzana, con paridad para TODAS las islas: el
    // 1er tap selecciona la manzana (panel de stats) y, si es pequeña en
    // pantalla, hace zoom-pan hacia ella; un 2º tap sobre la manzana ya
    // seleccionada entra al nivel manzana → edificios tappables → tablero
    // (onBuildingTap). Antes solo seleccionaba y la rama enterManzana era
    // exclusiva de barrio (GC).
    const manzanas = state.section.manzanas;
    const MIN_TAP_SIZE_PX = 70;
    const TARGET_SIZE_PX  = 180;
    for (let i = manzanas.length - 1; i >= 0; i--) {
      const m = manzanas[i];
      const ringPx = m._ringSimple.map(([x, z]) => project(x, 0, z, state.view));
      if (pointInScreenPolygon(px, py, ringPx)) {
        // 2º tap sobre la manzana ya seleccionada → entrar.
        if (state.selectedManzanaId === m.properties.id) {
          enterManzana(`${m._cusec}-${m.properties.id}`, { animate: true });
          return;
        }
        // 1er tap: seleccionar (abre panel) + zoom progresivo si es pequeña.
        selectManzana(m.properties.id);
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const [x, y] of ringPx) {
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
        const sizePx = Math.max(maxX - minX, maxY - minY);
        if (sizePx < MIN_TAP_SIZE_PX) {
          const [cx_w, cz_w] = m._centroid;
          const k = TARGET_SIZE_PX / Math.max(sizePx, 1);
          const newScale = Math.min(state.view.fitScale * 6.0,
                                    state.view.scale * k);
          animateView(state.view, {
            ...state.view, scale: newScale, tx: cx_w, ty: cz_w
          }, 450);
        }
        return;
      }
    }
    // v1.6.fluid — tap sobre sección vecina: entrada directa con
    // animación estándar (no slide horizontal). Ver bloque municipio.
    if (state.district) {
      const currentCusec = state.section?.meta?.cusec;
      for (const s of state.district.secciones) {
        if (s.properties.cusec === currentCusec) continue;
        const ringPx = s._ringSimple.map(([x, z]) =>
          project(x, 0, z, state.view));
        if (pointInScreenPolygon(px, py, ringPx)) {
          enterSeccion(s.properties.cusec, true);
          return;
        }
      }
    }
    // 2026-05-29 — Rescate "sección rural enorme" (prov 38: TF/LP/LG/EH).
    // Las secciones INE de El Hierro/La Gomera/etc. abarcan 8-16 km y, al
    // entrar a nivel sección (fit ~1.05×), TODAS las manzanas quedan a
    // 1-17 px: imposible acertarles un tap (≈0.3% de la pantalla cae sobre
    // alguna), así que el tap caía siempre al `selectManzana(null)` de
    // abajo y el usuario NO podía llegar al edificio. En prov 35 (GC) esto
    // no pasa: se llega al edificio vía barrio→manzana (piezas densas) y a
    // este zoom las manzanas SÍ son tappables — el primer bucle acierta y
    // retorna antes de llegar aquí, así que este rescate queda inerte para
    // el flujo habitual de GC (donde además las manzanas llenan la
    // pantalla).
    //
    // Va DESPUÉS del hit-test de secciones vecinas para no robarles el tap
    // cuando el usuario toca una vecina. Comportamiento: si el tap cae
    // cerca del núcleo edificado de ESTA sección (dentro del bbox de sus
    // manzanas, con holgura), hacemos zoom-pan progresivo hacia la manzana
    // más cercana al punto tocado (sin cambiar de nivel). Tap a tap el
    // usuario "se acerca" hasta que las manzanas crecen lo bastante para
    // seleccionarlas/entrar. Usa `animateView` directo (no pasa por el
    // clamp de maxScale del wheel), igual que el zoom progresivo de arriba
    // — necesario porque estas secciones requieren >6× para hacer una
    // manzana tappable. No depende de state.district (puede ser null al
    // llegar por deep-link ?cusec=… o por breadcrumb).
    if (manzanas.length) {
      // Bbox (en pantalla) de la unión de centroides de manzana + holgura,
      // como guarda de "el tap apunta a la zona habitada" sin necesitar el
      // polígono de la sección (que no siempre está cargado).
      let bmnx = Infinity, bmny = Infinity, bmxx = -Infinity, bmxy = -Infinity;
      let best = null, bestD = Infinity;
      for (const m of manzanas) {
        const [mpx, mpy] = project(m._centroid[0], 0,
                                   m._centroid[1], state.view);
        if (mpx < bmnx) bmnx = mpx; if (mpx > bmxx) bmxx = mpx;
        if (mpy < bmny) bmny = mpy; if (mpy > bmxy) bmxy = mpy;
        // Penalizamos las manzanas vacías para no aterrizar en descampado.
        const w = (m.properties.building_count || 0) > 0 ? 1 : 1.6;
        const d = ((mpx - px) ** 2 + (mpy - py) ** 2) * w;
        if (d < bestD) { bestD = d; best = m; }
      }
      const PAD = 80;
      const inHabitada = px >= bmnx - PAD && px <= bmxx + PAD &&
                         py >= bmny - PAD && py <= bmxy + PAD;
      if (best && inHabitada) {
        // Zoom-pan ×2.4 por paso centrado en la manzana objetivo:
        // aproximación cómoda sin teleporte. Sin cap a fitScale.
        const [cx_w, cz_w] = best._centroid;
        animateView(state.view, {
          ...state.view,
          scale: state.view.scale * 2.4,
          tx: cx_w, ty: cz_w
        }, 450);
        return;
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

  // v1.6f — Flechas laterales eliminadas. La navegación entre distritos
  // vecinos sigue accesible vía swipe horizontal y vía buscador.

  // ESC retrocede un nivel (si no hay popup abierto). Los handlers de
  // popup (mun-popup, evento-popup) tienen sus propios listeners ESC
  // que cierran cuando están abiertos; esta lógica solo dispara
  // navigateBack si ningún popup está visible.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const munOpen = document.getElementById("mun-popup")?.classList.contains("open");
    const evtOpen = document.getElementById("evento-popup")?.classList.contains("open");
    if (munOpen || evtOpen) return;
    if (state.lodLevel === "isla") return;
    navigateBack();
  });

  // Toggles de overlays: el panel completo se monta desde
  // overlays/index.js · mountPanel(). Aquí no se cablea nada por capa —
  // basta con que el panel exista en el DOM antes de initOverlays(state),
  // lo cual ya está garantizado por el orden en boot() (sizeCanvas →
  // bindUI → initOverlays).

  // Botón flotante "←": SIEMPRE sube un nivel jerárquico (manzana →
  // barrio → mun → isla), NUNCA delega en window.history.back(). El
  // historial del navegador queda solo para el chrome del browser
  // (gesto deslizar de iOS / botón ← del browser), que sigue
  // funcionando vía el popstate handler de abajo. Esto evita que el
  // back lógico "salte" a un estado previo arbitrario cuando el
  // historial no está alineado con la jerarquía actual.
  document.getElementById("back-btn").addEventListener("click", () => {
    navigateBack();
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
    const targetLevel = (!s || (!s.mun && !s.cusec && !s.distritoId && !s.barrioId && !s.manzanaId && !s.islaId && s.lodLevel !== "isla"))
      ? "archipielago" : s.lodLevel;
    const isBack = isBackNavigation(state.lodLevel, targetLevel);
    const restore = isBack ? consumeViewportFor(targetLevel) : null;

    if (!s || (!s.lodLevel && !s.mun && !s.cusec && !s.distritoId && !s.barrioId && !s.manzanaId)) {
      enterArchipielago(true, restore);
    } else if (s.lodLevel === "archipielago") {
      enterArchipielago(true, restore);
    } else if (s.lodLevel === "isla") {
      enterIsla(s.islaId || "gc", true, restore);
    } else if (s.lodLevel === "manzana" && s.manzanaId && s.barrioId) {
      // v1.6.manzana (Phase 2b) — restaurar nivel manzana: aseguramos
      // municipio + barrio cargados primero. La cascada es idéntica a
      // la de la rama `barrio` salvo el `enterManzana` final.
      const meta = state.barriosGc?.barrios?.[s.barrioId];
      const munCode = s.mun
        || (meta ? String(meta.mun || "").replace(/^35/, "") : null);
      const ensureMun = (munCode && state.municipio?.mun !== munCode)
        ? enterMunicipio(munCode, false)
        : Promise.resolve();
      const ensureBarrio = ensureMun.then(() => {
        if (state.barrio?.barrioId !== s.barrioId) {
          return enterBarrio(s.barrioId, false);
        }
      });
      ensureBarrio
        .then(() => enterManzana(s.manzanaId, { animate: true, restoreView: restore }))
        .then(() => { state._navigatingFromPop = false; });
    } else if (s.lodLevel === "barrio" && s.barrioId) {
      // v1.6.barrio — restaurar nivel barrio desde history. Aseguramos
      // municipio cargado antes (el barrio depende de munObj.secciones).
      const meta = state.barriosGc?.barrios?.[s.barrioId];
      const munCode = s.mun
        || (meta ? String(meta.mun || "").replace(/^35/, "") : null);
      const ensureMun = (munCode && state.municipio?.mun !== munCode)
        ? enterMunicipio(munCode, false)
        : Promise.resolve();
      ensureMun.then(() => enterBarrio(s.barrioId, true, restore)).then(() => {
        state._navigatingFromPop = false;
      });
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
      enterArchipielago(true, restore);
      state._navigatingFromPop = false;
    }
    // Para las navegaciones síncronas (enterArchipielago) liberamos el flag al final.
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

// -----------------------------------------------------------
// Popup de municipio (vista isla). v1.6.
//
// Carga `data/municipios-info.json` la primera vez y cachea. Cada
// municipio se identifica por su código de 3 dígitos (sufijo INE).
// El popup reusa el aside `#mun-popup`; mientras está abierto, el
// canvas sigue interactuable pero el backdrop captura clicks fuera
// para cerrarlo sin disparar tap accidental sobre otro municipio.

let _munInfoCache = null;
let _munInfoLoading = null;

async function loadMunicipiosInfo() {
  if (_munInfoCache) return _munInfoCache;
  if (_munInfoLoading) return _munInfoLoading;
  _munInfoLoading = fetch("../data/municipios-info.json")
    .then(r => r.ok ? r.json() : Promise.reject(new Error("status " + r.status)))
    .then(json => { _munInfoCache = json; return json; })
    .catch(err => {
      console.warn("[mun-popup] no se pudo cargar municipios-info.json:", err);
      _munInfoCache = {};
      return _munInfoCache;
    });
  return _munInfoLoading;
}

async function openMunicipioPopup(munCode) {
  const info = await loadMunicipiosInfo();
  const row = info[munCode];
  const munFeat = state.isla?.municipios?.find(m => m.properties.mun === munCode);
  const fallbackNombre = munFeat?.properties?.nmun || `Municipio ${munCode}`;

  const popup = document.getElementById("mun-popup");
  const backdrop = document.getElementById("mun-popup-backdrop");
  if (!popup || !backdrop) return;

  const nombre = row?.nombre || fallbackNombre;
  const lema = row?.lema || "";
  const poblacion = row?.poblacion;
  const chasc = row?.chascarrillo || "";

  // Iniciales para el escudo placeholder: primer y segundo char de nombre.
  const initials = nombre
    .replace(/^(de |la |las |los |el )/i, "")
    .split(/\s+|,/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() || "")
    .join("") || nombre.slice(0, 2).toUpperCase();

  document.getElementById("mp-escudo").textContent = initials;
  document.getElementById("mp-nombre").textContent = nombre;
  const lemaEl = document.getElementById("mp-lema");
  lemaEl.textContent = lema;
  lemaEl.style.display = lema ? "block" : "none";

  const stats = document.getElementById("mp-stats");
  const statRows = [];
  if (typeof poblacion === "number") {
    statRows.push(`<dt>Población</dt><dd>${poblacion.toLocaleString("es")} hab.</dd>`);
  }
  const secCount = munFeat?.properties?.sections_count;
  if (typeof secCount === "number") {
    statRows.push(`<dt>Secciones censales</dt><dd>${secCount}</dd>`);
  }
  const areaHa = munFeat?.properties?.area_ha;
  if (typeof areaHa === "number") {
    statRows.push(`<dt>Superficie</dt><dd>${Math.round(areaHa).toLocaleString("es")} ha</dd>`);
  }
  stats.innerHTML = statRows.join("");

  const chascEl = document.getElementById("mp-chascarrillo");
  chascEl.textContent = chasc;
  chascEl.style.display = chasc ? "block" : "none";

  const enterBtn = document.getElementById("mp-enter");
  enterBtn.onclick = () => {
    closeMunicipioPopup();
    enterMunicipio(munCode, true);
  };

  popup.classList.add("open");
  popup.setAttribute("aria-hidden", "false");
  backdrop.classList.add("open");
  backdrop.setAttribute("aria-hidden", "false");
}

function closeMunicipioPopup() {
  const popup = document.getElementById("mun-popup");
  const backdrop = document.getElementById("mun-popup-backdrop");
  if (popup) {
    popup.classList.remove("open");
    popup.setAttribute("aria-hidden", "true");
  }
  if (backdrop) {
    backdrop.classList.remove("open");
    backdrop.setAttribute("aria-hidden", "true");
  }
}

// Wire-up del popup: backdrop y botón × cierran. ESC también.
(function bindMunPopup() {
  const close = () => closeMunicipioPopup();
  document.getElementById("mun-popup-backdrop")?.addEventListener("click", close);
  document.getElementById("mun-popup-close")?.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
})();

// -----------------------------------------------------------
// Popup de evento cultural. v1.6.
//
// Llamado desde handleTap cuando el tap cae sobre un pin del overlay
// `eventos`. Rellena `#evento-popup` con título, fecha+hora, lugar,
// descripción y la badge de categoría.

const _CAT_LABELS = {
  exposicion: "Exposición",
  concierto: "Concierto",
  taller: "Taller",
  festival: "Festival",
  presentacion: "Presentación",
  evento_especial: "Evento especial"
};

function _formatFecha(iso, hora) {
  if (!iso) return hora || "";
  // 2026-05-12 → "12 may 2026 · 17:00"
  const [y, m, d] = iso.split("-").map(n => parseInt(n, 10));
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  const fechaStr = `${d} ${meses[m-1]} ${y}`;
  return hora ? `${fechaStr} · ${hora}` : fechaStr;
}

function openEventoPopup(evt) {
  const popup = document.getElementById("evento-popup");
  if (!popup || !evt) return;
  const props = evt.properties || {};

  const catEl = document.getElementById("ep-cat");
  catEl.textContent = _CAT_LABELS[props.categoria] || props.categoria || "Evento";
  catEl.setAttribute("data-cat", props.categoria || "");

  document.getElementById("ep-titulo").textContent = props.titulo || "";
  document.getElementById("ep-when").textContent =
    _formatFecha(props.fecha, props.hora_inicio);
  document.getElementById("ep-where").textContent =
    props.lugar ? `${props.lugar}${props.municipio ? " · " + props.municipio : ""}` : "";

  const descEl = document.getElementById("ep-desc");
  descEl.textContent = props.descripcion || "";
  descEl.style.display = props.descripcion ? "block" : "none";

  popup.classList.add("open");
  popup.setAttribute("aria-hidden", "false");
}

function closeEventoPopup() {
  const popup = document.getElementById("evento-popup");
  if (popup) {
    popup.classList.remove("open");
    popup.setAttribute("aria-hidden", "true");
  }
}

(function bindEventoPopup() {
  document.getElementById("evento-popup-close")?.addEventListener("click",
    closeEventoPopup);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeEventoPopup();
  });
})();

// -----------------------------------------------------------
// Modal de lista de eventos (P5 — 2026-05-21).
// Cuando un cluster de pins acumula >1 evento, en lugar de abrir el
// popup del más cercano, mostramos esta lista para que el usuario elija.
// El item al hacer click abre el popup individual normal.

function openEventoListModal(events) {
  const modal = document.getElementById("evento-list-modal");
  if (!modal || !events?.length) return;
  document.getElementById("elm-count").textContent = events.length;
  const list = document.getElementById("elm-list");
  list.innerHTML = events.map((e, i) => {
    const p = e.properties || {};
    const cat = (p.categoria || "evento").replace("_", " ");
    return `<button class="elm-item" data-idx="${i}" role="listitem">
      <span class="elm-cat">${_escapeHtml(cat)}</span>
      <span class="elm-titulo-pequeno">${_escapeHtml(p.titulo || "")}</span>
      <span class="elm-fecha">${_escapeHtml(_formatFecha(p.fecha, p.hora_inicio))} · ${_escapeHtml(p.lugar || "")}</span>
    </button>`;
  }).join("");
  list.onclick = (ev) => {
    const btn = ev.target.closest(".elm-item");
    if (!btn) return;
    const i = parseInt(btn.dataset.idx, 10);
    if (events[i]) {
      closeEventoListModal();
      openEventoPopup(events[i]);
    }
  };
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function closeEventoListModal() {
  const modal = document.getElementById("evento-list-modal");
  if (modal) {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
  }
}

(function bindEventoListModal() {
  document.getElementById("elm-close")?.addEventListener("click", closeEventoListModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.getElementById("evento-list-modal")?.getAttribute("aria-hidden") === "false") {
      closeEventoListModal();
    }
  });
})();

// -----------------------------------------------------------
// Popup de productor local. v1.7.

function openProductorPopup(prod) {
  const popup = document.getElementById("productor-popup");
  if (!popup || !prod) return;
  const props = prod.properties || {};

  const ofEl = document.getElementById("pp-oficio");
  const oficio = props.oficio || "";
  ofEl.textContent = productoresOverlay.getOficioLabel(oficio) || oficio;
  ofEl.setAttribute("data-o", oficio);

  document.getElementById("pp-nombre").textContent = props.nombre || "";
  document.getElementById("pp-where").textContent = props.municipio || "";
  document.getElementById("pp-que").textContent = props.que_hace || "";

  renderProductorGestos(prod);

  popup.classList.add("open");
  popup.setAttribute("aria-hidden", "false");
}

// Render del bloque de gestos disponibles para un productor. Consume
// gestosDisponiblesPara(sujeto, contexto) — el catálogo es la fuente de
// verdad. Hoy el productor se modela como sujeto `comercio` con flags
// vacíos; el contexto del actor sale del estado local del navegador
// (anónimo por defecto, identidad pseudónima si el usuario activó una).
//
// Capa 0 (visita) se registra implícitamente al abrir el popup. Capa 1
// son iconos compactos. Capa 2 con payload se abre como picker inline.
// Capas 3+ se rellenan en iteraciones futuras (texto libre, formularios).
function renderProductorGestos(prod) {
  const host = document.getElementById("pp-gestos");
  if (!host) return;
  const props = prod.properties || {};
  const sujeto = {
    tipo: "comercio",
    id: props.id || `prod-${props.nombre || "anon"}`,
    flags: { franquicia: !!props.franquicia, existe_en_mapa: true }
  };
  const contexto = {
    actor: { identidad: _actorIdentidad() },
    zona: _zonaActual()
  };
  const disponibles = gestosDisponiblesPara(sujeto, contexto);

  // Capa 0: visita implícita.
  if (disponibles.some(g => g.id === "visita")) {
    recordGesto("visita", { sujeto_tipo: sujeto.tipo, sujeto_id: sujeto.id }, contexto.zona);
  }

  const capa1 = disponibles.filter(g => g.capa === 1);
  const capa2 = disponibles.filter(g => g.capa === 2);

  const ICON = {
    senal_pos:  "+", senal_neg:  "−",
    sigue_vivo: "✓", guardar: "★"
  };
  const LABEL_CORTO = {
    senal_pos: "Me gusta", senal_neg: "No me gusta",
    sigue_vivo: "Sigue activo", guardar: "Guardar"
  };

  const row1 = capa1.map(g => `
    <button class="gesto-btn gesto-btn--icon"
            data-gesto="${g.id}"
            data-mode="atomic"
            title="${LABEL_CORTO[g.id] || g.id}"
            aria-label="${LABEL_CORTO[g.id] || g.id}">
      ${ICON[g.id] || "·"}
    </button>`).join("");

  const row2 = capa2.map(g => `
    <button class="gesto-btn"
            data-gesto="${g.id}"
            data-mode="${g.payload_schema ? "picker" : "atomic"}">
      ${_gestoCorto(g.id)}
    </button>
    ${g.payload_schema ? `<div class="pp-gestos-picker" data-picker-for="${g.id}">${_pickerHTML(g)}</div>` : ""}
  `).join("");

  host.innerHTML = `
    <button class="gesto-btn gesto-btn--icon gesto-disclosure"
            data-action="toggle-panel"
            aria-label="Acciones disponibles"
            aria-expanded="false"
            title="Acciones">+</button>
    <div class="gesto-panel" data-panel="gestos">
      <div class="pp-gestos-label">Gestos rápidos</div>
      <div class="pp-gestos-row">${row1}</div>
      <div class="pp-gestos-label">Más</div>
      <div class="pp-gestos-row">${row2}</div>
    </div>
  `;

  // Event delegation para todos los botones del bloque.
  host.addEventListener("click", (e) => _onGestoClick(e, sujeto, contexto), { once: false });
}

function _actorIdentidad() {
  // Hoy todos anónimos. Cuando llegue identidad pseudónima estable,
  // leer aquí del perfil del usuario.
  return "anonimo";
}

function _zonaActual() {
  if (state.barrio?.id) return state.barrio.id;
  if (state.distrito?.id) return state.distrito.id;
  if (state.municipio?.mun) return state.municipio.mun;
  return "isla";
}

function _gestoCorto(id) {
  const map = {
    recomiendo_para: "Recomendar para…",
    reporte:         "Reportar",
    rango_precio:    "Precio",
    accesibilidad:   "Accesibilidad",
    check_in:        "Estuve aquí"
  };
  return map[id] || id;
}

function _pickerHTML(gesto) {
  // Sólo enums y multi-enums: construimos pills clickables. El reporte
  // delega a su propio popup existente (openReportePopup) — no se
  // dibuja picker inline.
  if (gesto.id === "reporte") return "";
  const schema = gesto.payload_schema || {};
  const firstKey = Object.keys(schema)[0];
  const spec = schema[firstKey];
  if (!spec) return "";
  if (spec.type === "enum" || spec.type === "multi-enum") {
    return `<div class="pp-gestos-row">` +
      spec.values.map(v => `
        <button class="gesto-btn"
                data-gesto="${gesto.id}"
                data-mode="submit"
                data-key="${firstKey}"
                data-value="${v}"
                data-multi="${spec.type === "multi-enum" ? "1" : "0"}">${v.replace(/_/g," ")}</button>
      `).join("") +
      `</div>`;
  }
  return "";
}

function _onGestoClick(ev, sujeto, contexto) {
  const btn = ev.target.closest(".gesto-btn");
  if (!btn) return;

  // Disclosure: alterna la visibilidad del panel de gestos.
  if (btn.dataset.action === "toggle-panel") {
    const host = btn.closest(".pp-gestos");
    const panel = host.querySelector("[data-panel='gestos']");
    const opened = panel.classList.toggle("open");
    btn.setAttribute("aria-expanded", opened ? "true" : "false");
    btn.textContent = opened ? "×" : "+";
    return;
  }

  const id = btn.dataset.gesto;
  const mode = btn.dataset.mode;

  if (mode === "atomic") {
    if (id === "reporte") {
      openReportePopup("espacio");
      return;
    }
    recordGesto(id, { sujeto_tipo: sujeto.tipo, sujeto_id: sujeto.id }, contexto.zona);
    btn.dataset.active = "true";
    return;
  }

  if (mode === "picker") {
    if (id === "reporte") { openReportePopup("espacio"); return; }
    const picker = btn.parentElement.querySelector(`[data-picker-for="${id}"]`);
    if (picker) picker.classList.toggle("open");
    return;
  }

  if (mode === "submit") {
    const key = btn.dataset.key;
    const value = btn.dataset.value;
    const multi = btn.dataset.multi === "1";
    if (multi) {
      btn.dataset.active = btn.dataset.active === "true" ? "false" : "true";
    } else {
      // Marca el seleccionado en el grupo, desmarca los hermanos.
      btn.parentElement.querySelectorAll(".gesto-btn").forEach(b => b.dataset.active = "false");
      btn.dataset.active = "true";
    }
    recordGesto(id, {
      sujeto_tipo: sujeto.tipo, sujeto_id: sujeto.id, [key]: value
    }, contexto.zona);
  }
}

function closeProductorPopup() {
  const popup = document.getElementById("productor-popup");
  if (popup) {
    popup.classList.remove("open");
    popup.setAttribute("aria-hidden", "true");
  }
}

(function bindProductorPopup() {
  document.getElementById("productor-popup-close")?.addEventListener("click",
    closeProductorPopup);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeProductorPopup();
  });
})();

// -----------------------------------------------------------
// Popup tejido social (cooperativa/asociación/espacio comunitario). v1.7.

function openTejidoPopup(item) {
  const popup = document.getElementById("tejido-popup");
  if (!popup || !item) return;
  const props = item.properties || {};

  const catEl = document.getElementById("tp-cat");
  const cat = props.categoria || "";
  catEl.textContent = tejidoSocialOverlay.getCategoriaLabel(cat) || cat;
  catEl.setAttribute("data-c", cat);

  document.getElementById("tp-nombre").textContent = props.nombre || "";
  document.getElementById("tp-where").textContent = props.municipio || "";
  document.getElementById("tp-que").textContent = props.que_hace || "";

  popup.classList.add("open");
  popup.setAttribute("aria-hidden", "false");
}

function closeTejidoPopup() {
  const popup = document.getElementById("tejido-popup");
  if (popup) {
    popup.classList.remove("open");
    popup.setAttribute("aria-hidden", "true");
  }
}

(function bindTejidoPopup() {
  document.getElementById("tejido-popup-close")?.addEventListener("click",
    closeTejidoPopup);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeTejidoPopup();
  });
})();

// -----------------------------------------------------------
// Popup del Registro Oficial — overlay raw del Registro de Asociaciones
// de Canarias. Diferencia con tejido-social: aquí mostramos los campos
// crudos del registro (tipo, actividad, municipio, web/email). No hay
// "qué_hace" curado — son 25k entidades, no caben anotaciones humanas.

function openRegistroEntidadPopup(item) {
  const popup = document.getElementById("registro-popup");
  if (!popup || !item) return;
  const props = item.properties || {};

  const tipoEl = document.getElementById("rp-tipo");
  const tipo = props.tipo || "";
  tipoEl.textContent = registroOverlay.getTipoLabel(tipo) || tipo;
  tipoEl.setAttribute("data-t", tipo);

  document.getElementById("rp-nombre").textContent = props.nombre || "";
  document.getElementById("rp-actividad").textContent = props.actividad || "";
  document.getElementById("rp-where").textContent = props.municipio || "";

  // Enlaces (web + mailto) sólo si hay datos. El campo `email` no viene
  // expuesto (solo `tiene_email`); por eso el botón mailto solo se
  // muestra si hay flag, abriendo un mailto vacío (mejor que nada —
  // el usuario podría tener el contacto en otra fuente).
  const links = document.getElementById("rp-links");
  if (links) {
    const parts = [];
    if (props.tiene_web && props.web) {
      const href = props.web.startsWith("http") ? props.web : `https://${props.web}`;
      parts.push(`<a class="rp-link" href="${href}" target="_blank" rel="noopener">Web</a>`);
    }
    if (props.tiene_email) {
      parts.push(`<span class="rp-flag">@ email</span>`);
    }
    if (props.tiene_telefono) {
      parts.push(`<span class="rp-flag">☎ teléfono</span>`);
    }
    links.innerHTML = parts.join("");
  }

  popup.classList.add("open");
  popup.setAttribute("aria-hidden", "false");
}

function closeRegistroEntidadPopup() {
  const popup = document.getElementById("registro-popup");
  if (popup) {
    popup.classList.remove("open");
    popup.setAttribute("aria-hidden", "true");
  }
}

(function bindRegistroEntidadPopup() {
  document.getElementById("registro-popup-close")?.addEventListener("click",
    closeRegistroEntidadPopup);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeRegistroEntidadPopup();
  });
})();

// -----------------------------------------------------------
// Buscador transversal. v1.6f.
//
// Abre con click en lupa o Cmd/Ctrl-K. Indexa muns + eventos +
// distritos + venues (ver search.js · buildIndex). Cada resultado
// lleva su `action` precomputada — al click ejecuta navegación o
// abre popup correspondiente.

let _searchIndex = null;
let _searchActiveIdx = 0;

const _searchCtx = {
  openMunicipioPopup: (munCode) => openMunicipioPopup(munCode),
  openEventoPopup: (evt) => openEventoPopup(evt),
  openProductorPopup: (prod) => openProductorPopup(prod),
  openTejidoPopup: (item) => openTejidoPopup(item),
  enterDistrito: (id, animate) => enterDistrito(id, animate),
  // Niveles barrio/manzana + hook de edificio: necesarios para que el
  // buscador llegue a niveles inferiores (barrios canónicos, manzanas
  // del barrio activo, POIs por barrio).
  enterMunicipio: (mun, animate) => enterMunicipio(mun, animate),
  enterBarrio: (id, animate) => enterBarrio(id, animate),
  enterManzana: (id, opts) => enterManzana(id, opts || { animate: true }),
  onBuildingTap: (bid, mid) => onBuildingTap(bid, mid),
  distritoLabel: (id) => DISTRITO_NICKS[id] || null,
  navigateToStreet: (calle) => navigateToStreet(calle)
};

// -----------------------------------------------------------
// Navegación a calle desde el buscador. v1.8.
//
// El buscador indexa el callejero (osm-gc/roads.json). Al seleccionar
// una calle hacemos pan + zoom sobre su centroide en metros locales.
// Si estamos en isla, subimos al municipio que contiene la calle (el
// que tenga el centroide en su bbox); si ya estamos en mun/distrito,
// mantenemos el lodLevel y simplemente animamos el view.

function navigateToStreet(calle) {
  if (!calle || !calle.centroide || !state.view) return;
  const [lng, lat] = calle.centroide;
  const [mx, mz] = lnglatToLocalMeters(lng, lat, GC_ANCHOR_LNGLAT);

  // Si estamos en isla, intentar entrar al municipio que contiene
  // la calle para que se vea con las calles reales del nivel mun.
  if (state.lodLevel === "isla") {
    const owner = state.isla?.municipios?.find(m => {
      const [a, b, c, d] = m._bbox || (m._bbox = (function() {
        // Lazy compute bbox del mun en metros
        let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
        for (const [px, pz] of m._ring) {
          if (px < mnx) mnx = px; if (px > mxx) mxx = px;
          if (pz < mny) mny = pz; if (pz > mxy) mxy = pz;
        }
        return [mnx, mny, mxx, mxy];
      })());
      return mx >= a && mx <= c && mz >= b && mz <= d;
    });
    if (owner) {
      enterMunicipio(owner.properties.mun, true).then(() => {
        _panZoomToPoint(mx, mz, 2.2);
      });
      return;
    }
  }
  _panZoomToPoint(mx, mz, 2.5);
}

function _panZoomToPoint(mx, mz, zoomFactor) {
  const v = state.view;
  const targetScale = v.fitScale * zoomFactor;
  const toView = {
    ...v,
    scale: targetScale,
    tx: mx,
    ty: mz
  };
  animateView(v, toView, 600);
}

async function openSearch() {
  const ov = document.getElementById("search-overlay");
  const input = document.getElementById("search-input");
  if (!ov || !input) return;
  ov.classList.add("open");
  ov.setAttribute("aria-hidden", "false");
  input.value = "";
  _renderSearchResults([]);
  _searchActiveIdx = 0;
  // Asegurar focus en el input (un rAF para que la transición no se lo coma).
  requestAnimationFrame(() => input.focus());
  // Rebuild index cada vez que se abre — refleja overlays cargados,
  // mun activo, etc.
  const mod = await _loadSearchModule();
  _searchIndex = await mod.buildIndex(state, _searchCtx);
}

function closeSearch() {
  const ov = document.getElementById("search-overlay");
  if (!ov) return;
  ov.classList.remove("open");
  ov.setAttribute("aria-hidden", "true");
}

function _renderSearchResults(results) {
  const wrap = document.getElementById("search-results");
  if (!wrap) return;
  if (!results.length) {
    wrap.innerHTML = "";
    return;
  }
  const html = results.map((r, i) => {
    const t = (r.type || "").replace(/"/g, "");
    const lbl = _escapeHtml(r.label);
    const sub = _escapeHtml(r.sublabel);
    const tLbl = _escapeHtml(_searchModule?.typeLabel?.(r.type) || r.type);
    const active = i === _searchActiveIdx ? " active" : "";
    return `<div class="search-result${active}" data-idx="${i}">
      <span class="sr-type" data-t="${t}">${tLbl}</span>
      <span class="sr-text">
        <span class="sr-label">${lbl}</span>
        <span class="sr-sublabel">${sub}</span>
      </span>
    </div>`;
  }).join("");
  wrap.innerHTML = html;
}

function _escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

(function bindSearch() {
  const toggle = document.getElementById("search-toggle");
  const ov = document.getElementById("search-overlay");
  const input = document.getElementById("search-input");
  const wrap = document.getElementById("search-results");
  if (!toggle || !ov || !input || !wrap) return;

  toggle.addEventListener("click", () => openSearch());
  ov.addEventListener("click", (e) => {
    if (e.target === ov) closeSearch();
  });

  // Cmd/Ctrl-K abre el buscador.
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      openSearch();
    } else if (e.key === "Escape" && ov.classList.contains("open")) {
      closeSearch();
    }
  });

  let _currentResults = [];
  input.addEventListener("input", () => {
    const q = input.value;
    _currentResults = (_searchIndex && _searchModule)
      ? _searchModule.search(_searchIndex, q)
      : [];
    _searchActiveIdx = 0;
    _renderSearchResults(_currentResults);
  });

  input.addEventListener("keydown", (e) => {
    if (!_currentResults.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      _searchActiveIdx = (_searchActiveIdx + 1) % _currentResults.length;
      _renderSearchResults(_currentResults);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      _searchActiveIdx = (_searchActiveIdx - 1 + _currentResults.length)
                         % _currentResults.length;
      _renderSearchResults(_currentResults);
    } else if (e.key === "Enter") {
      const r = _currentResults[_searchActiveIdx];
      if (r?.action) {
        closeSearch();
        r.action();
      }
    }
  });

  wrap.addEventListener("click", (e) => {
    const el = e.target.closest(".search-result");
    if (!el) return;
    const i = parseInt(el.dataset.idx, 10);
    const r = _currentResults[i];
    if (r?.action) {
      closeSearch();
      r.action();
    }
  });
})();

window.polisApp = window.polisApp || {};
window.polisApp.setIndicators = setIndicators;
window.polisApp.getIndicators = () => JSON.parse(JSON.stringify(state.indicators));
window.polisApp.state = state;  // sólo lectura recomendada — para debug
// 2026-05-24 — debug helpers expuestos para forzar tap programáticamente.
window.polisApp.handleTap = handleTap;
window.polisApp.enterMunicipio = enterMunicipio;
window.polisApp.enterIsla = enterIsla;
window.polisApp.enterBarrio = enterBarrio;
window.polisApp.enterArchipielago = enterArchipielago;
window.polisApp.setLayer = (id, on) => setOverlayActive(state, id, on);
window.polisApp.openMunicipioPopup = openMunicipioPopup;
window.polisApp.closeMunicipioPopup = closeMunicipioPopup;
window.polisApp.openEventoPopup = openEventoPopup;
window.polisApp.closeEventoPopup = closeEventoPopup;
window.polisApp.openProductorPopup = openProductorPopup;
window.polisApp.closeProductorPopup = closeProductorPopup;
window.polisApp.openTejidoPopup = openTejidoPopup;
window.polisApp.closeTejidoPopup = closeTejidoPopup;
window.polisApp.openSearch = openSearch;
window.polisApp.closeSearch = closeSearch;
// v1.6.manzana (Phase 2b) — Expuesto para deep-link programático y para
// que la capa Next.js dispare drill-down sin pasar por la URL. El hook
// `onBuildingTap` queda overrideable por la capa cívica (Phase 2c).
window.polisApp.enterManzana = (id, opts) => enterManzana(id, opts || {});
// [B] v1.6.pinch — expuesto para que interaction.js dispare la subida al
// nivel padre cuando el pinch-out cruza el umbral de commit. Reutiliza
// la misma lógica + restoreView que el botón back tradicional.
window.polisApp.navigateBack = navigateBack;
window.polisApp.onBuildingTap = onBuildingTap;
window.polisApp.refreshDashboard = () => refreshDashboard(state);
window.polisApp.getCompromisos = () => {
  try { return JSON.parse(localStorage.getItem("polis-compromisos") || "[]"); }
  catch (e) { return []; }
};

// -----------------------------------------------------------
// Popup de compromiso (acción de un paso por ámbito). v1.7.
//
// Captura nombre + email + intención específica del ámbito. Mientras
// el backend (Next.js + Supabase) no esté disponible, guarda en
// localStorage como mock — cuando llegue, una migración leerá esa
// cola y la procesará.

let _currentAmbito = null;

function openCompromisoPopup(ambito) {
  _currentAmbito = ambito;
  const ov = document.getElementById("compromiso-overlay");
  if (!ov) return;
  document.getElementById("cp-derecho").textContent = ambito.derecho;
  document.getElementById("cp-titulo").textContent = ambito.accion.label;
  document.getElementById("cp-explica").textContent =
    `Te apuntas a participar en el ámbito "${ambito.label}". Cuando el ` +
    `sistema cívico esté disponible recibirás aviso para confirmar.`;
  document.getElementById("cp-nombre").value = "";
  document.getElementById("cp-email").value = "";
  document.getElementById("cp-result").textContent = "";
  ov.classList.add("open");
  ov.setAttribute("aria-hidden", "false");
  setTimeout(() => document.getElementById("cp-nombre")?.focus(), 60);
}

function closeCompromisoPopup() {
  const ov = document.getElementById("compromiso-overlay");
  if (!ov) return;
  ov.classList.remove("open");
  ov.setAttribute("aria-hidden", "true");
  _currentAmbito = null;
}

function _submitCompromiso() {
  if (!_currentAmbito) return;
  const nombre = document.getElementById("cp-nombre").value.trim();
  const email = document.getElementById("cp-email").value.trim();
  const result = document.getElementById("cp-result");
  if (!nombre || !email) {
    result.textContent = "Completa nombre y email para confirmar.";
    return;
  }
  const entry = {
    intent: _currentAmbito.accion.intent,
    ambito: _currentAmbito.id,
    derecho: _currentAmbito.derecho,
    nombre, email,
    lodLevel: state.lodLevel,
    zona: state.district?.distritoId || state.municipio?.mun || "isla",
    ts: new Date().toISOString()
  };
  try {
    const prev = JSON.parse(localStorage.getItem("polis-compromisos") || "[]");
    prev.push(entry);
    localStorage.setItem("polis-compromisos", JSON.stringify(prev));
    result.textContent = "✓ Apuntado. Te avisaremos cuando arranque el sistema.";
    setTimeout(closeCompromisoPopup, 1400);
  } catch (e) {
    result.textContent = "No se pudo guardar localmente. Revisa permisos.";
    console.warn("[compromiso] localStorage fallo:", e);
  }
}

(function bindCompromiso() {
  const ov = document.getElementById("compromiso-overlay");
  if (!ov) return;
  document.getElementById("compromiso-close")?.addEventListener("click",
    closeCompromisoPopup);
  ov.addEventListener("click", (e) => {
    if (e.target === ov) closeCompromisoPopup();
  });
  document.getElementById("cp-submit")?.addEventListener("click",
    _submitCompromiso);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && ov.classList.contains("open"))
      closeCompromisoPopup();
    if (e.key === "Enter" && ov.classList.contains("open")) {
      const active = document.activeElement;
      if (active && active.tagName === "INPUT") _submitCompromiso();
    }
  });
})();

window.polisApp.openCompromisoPopup = openCompromisoPopup;
window.polisApp.closeCompromisoPopup = closeCompromisoPopup;

// -----------------------------------------------------------
// Popup de REPORTE categorizado (gesto anónimo, 3-click). v1.7.

let _currentReporteAmbito = null;

function openReportePopup(ambito) {
  _currentReporteAmbito = ambito;
  const ov = document.getElementById("reporte-overlay");
  if (!ov) return;
  document.getElementById("rp-derecho").textContent = ambito.label;
  const opts = REPORTES_POR_AMBITO[ambito.id] || [];
  const html = opts.map(o =>
    `<button class="rp-option" type="button" data-rid="${o.id}">${o.label}</button>`
  ).join("");
  const wrap = document.getElementById("rp-options");
  wrap.innerHTML = html;
  document.getElementById("rp-result").textContent = "";
  ov.classList.add("open");
  ov.setAttribute("aria-hidden", "false");
}

function closeReportePopup() {
  const ov = document.getElementById("reporte-overlay");
  if (!ov) return;
  ov.classList.remove("open");
  ov.setAttribute("aria-hidden", "true");
  _currentReporteAmbito = null;
}

(function bindReportePopup() {
  const ov = document.getElementById("reporte-overlay");
  if (!ov) return;
  document.getElementById("reporte-close")?.addEventListener("click", closeReportePopup);
  ov.addEventListener("click", (e) => { if (e.target === ov) closeReportePopup(); });
  document.getElementById("rp-options")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".rp-option");
    if (!btn || !_currentReporteAmbito) return;
    const rid = btn.dataset.rid;
    const zona = state.district?.distritoId ||
                 state.municipio?.mun ||
                 state.section?.meta?.cusec ||
                 "isla";
    recordGesto("reporte", {
      ambito: _currentReporteAmbito.id,
      categoria: rid
    }, zona);
    document.getElementById("rp-result").textContent =
      "✓ Reporte registrado anónimamente. Gracias.";
    if (state._refreshDashboard) state._refreshDashboard();
    setTimeout(closeReportePopup, 1100);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && ov.classList.contains("open"))
      closeReportePopup();
  });
})();

// -----------------------------------------------------------
// Popup de REGISTRO DE ENTIDAD (auto-alta con validadores externos).
// El gesto queda "pendiente" en localStorage hasta que la moderación
// del backend lo valide y lo promueva a su geojson correspondiente.

function openRegistroPopup() {
  const ov = document.getElementById("registro-overlay");
  if (!ov) return;
  // Poblar el select de categorías la primera vez.
  const sel = document.getElementById("rg-categoria");
  if (sel && !sel.options.length) {
    sel.innerHTML = CATEGORIAS_ENTIDAD
      .map(c => `<option value="${c.id}">${c.label}</option>`).join("");
  }
  // Pre-fill municipio si el usuario está dentro de uno.
  const munInput = document.getElementById("rg-municipio");
  if (munInput && state.municipio?.nmun && !munInput.value) {
    munInput.value = state.municipio.nmun;
  }
  document.getElementById("rg-result").textContent = "";
  ov.classList.add("open");
  ov.setAttribute("aria-hidden", "false");
  setTimeout(() => document.getElementById("rg-nombre")?.focus(), 60);
}

function closeRegistroPopup() {
  const ov = document.getElementById("registro-overlay");
  if (!ov) return;
  ov.classList.remove("open");
  ov.setAttribute("aria-hidden", "true");
}

function _submitRegistro() {
  const nombre = document.getElementById("rg-nombre").value.trim();
  const categoria = document.getElementById("rg-categoria").value;
  const municipio = document.getElementById("rg-municipio").value.trim();
  const que = document.getElementById("rg-que").value.trim();
  const url = document.getElementById("rg-url").value.trim();
  const nif = document.getElementById("rg-nif").value.trim();
  const email = document.getElementById("rg-email").value.trim();
  const result = document.getElementById("rg-result");
  if (!nombre || !categoria || !municipio || !que) {
    result.textContent = "Faltan campos obligatorios (nombre, categoría, municipio, qué hace).";
    return;
  }
  if (!url && !nif) {
    result.textContent = "Aporta al menos un validador (URL o NIF/registro).";
    return;
  }
  const zona = state.district?.distritoId ||
               state.municipio?.mun || "isla";
  recordGesto("registro_entidad", {
    nombre, categoria, municipio, que_hace: que,
    validadores: { url, nif },
    email_contacto: email,
    estado: "pendiente"
  }, zona);
  result.textContent = "✓ Enviado. Te contactaremos al email para validar.";
  setTimeout(closeRegistroPopup, 1400);
}

(function bindRegistro() {
  document.getElementById("registro-toggle")?.addEventListener("click",
    openRegistroPopup);
  document.getElementById("registro-close")?.addEventListener("click",
    closeRegistroPopup);
  document.getElementById("rg-submit")?.addEventListener("click",
    _submitRegistro);
  const ov = document.getElementById("registro-overlay");
  ov?.addEventListener("click", (e) => {
    if (e.target === ov) closeRegistroPopup();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && ov?.classList.contains("open"))
      closeRegistroPopup();
  });
})();

window.polisApp.openReportePopup = openReportePopup;
window.polisApp.closeReportePopup = closeReportePopup;
window.polisApp.openRegistroPopup = openRegistroPopup;
window.polisApp.closeRegistroPopup = closeRegistroPopup;
window.polisApp.getGestos = () => getAllGestos();
window.polisApp.getUserId = () => getUserId();

// -----------------------------------------------------------
// PANEL ADMIN — registro nominal de gestos. v1.7.
// Ver docs/ADMIN-PROTOCOL.md para el principio doble capa.

function _renderAdminBadge() {
  // v1.7 — badge legacy queda hidden siempre (entrada vía cog menu).
  // En su lugar mostramos el item "👤 ADMIN" del menú cog cuando
  // isAdmin() es true para revelar acceso al panel y permitir salir.
  const badge = document.getElementById("admin-badge");
  if (badge) badge.hidden = true;
  const cogAdmin = document.querySelector("#cog-menu .cog-admin");
  if (cogAdmin) cogAdmin.hidden = !isAdmin();
}

function _attemptEnableAdmin() {
  // Prompt local de passphrase. Sin backend esto NO es seguridad real,
  // solo evita acceso casual. Documentado en ADMIN-PROTOCOL.md.
  // eslint-disable-next-line no-alert
  const pass = prompt("Passphrase modo admin:");
  if (pass === null) return;
  const ok = enableAdmin(pass);
  if (ok) {
    _renderAdminBadge();
    openAdminPanel();
  } else {
    // eslint-disable-next-line no-alert
    alert("Passphrase incorrecta.");
  }
}

function toggleAdmin() {
  if (isAdmin()) {
    disableAdmin();
    closeAdminPanel();
    _renderAdminBadge();
  } else {
    _attemptEnableAdmin();
  }
}

function openAdminPanel() {
  if (!isAdmin()) return;
  const ov = document.getElementById("admin-overlay");
  if (!ov) return;
  _renderAdminTable();
  ov.classList.add("open");
  ov.setAttribute("aria-hidden", "false");
}

function closeAdminPanel() {
  const ov = document.getElementById("admin-overlay");
  if (!ov) return;
  ov.classList.remove("open");
  ov.setAttribute("aria-hidden", "true");
}

function _renderAdminTable() {
  const tipo = document.getElementById("ad-tipo")?.value || "";
  const ambito = document.getElementById("ad-ambito")?.value || "";
  const zona = (document.getElementById("ad-zona")?.value || "").trim();
  const filtros = {};
  if (tipo) filtros.tipo = tipo;
  if (ambito) filtros.ambito = ambito;
  if (zona) filtros.zona = zona;
  const rows = getRegistroDetallado(filtros);
  const tbody = document.querySelector("#ad-table tbody");
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;font-style:italic">Sin gestos para estos filtros</td></tr>`;
    document.getElementById("ad-summary").textContent = "";
    return;
  }
  const html = rows.map(g => {
    const detail = _formatPayload(g);
    const uid = (g.userId || "?").slice(0, 12);
    const when = g.ts ? new Date(g.ts).toLocaleString("es") : "?";
    const falsoCls = g.falso ? " gesto-falso" : "";
    return `<tr class="${falsoCls}" data-ts="${g.ts}" data-uid="${g.userId}">
      <td>${_escAdmin(g.tipo)}</td>
      <td>${_escAdmin(g.payload?.ambito || "—")}</td>
      <td>${_escAdmin(g.zona || "—")}</td>
      <td class="ad-detail" title="${_escAdmin(detail)}">${_escAdmin(detail)}</td>
      <td class="ad-uid">${_escAdmin(uid)}</td>
      <td>${_escAdmin(when)}</td>
      <td class="ad-actions">
        ${g.falso
          ? `<span style="font-size:9px;color:#D9534F;">${_escAdmin(g.motivo_falso || "FALSO")}</span>`
          : `<button class="ad-act-btn danger" data-act="marcar-falso">marcar falso</button>`
        }
        <button class="ad-act-btn" data-act="amonestar">amonestar</button>
      </td>
    </tr>`;
  }).join("");
  tbody.innerHTML = html;

  // Conteo de UIDs únicos como pista de patrones
  const uids = new Set(rows.map(g => g.userId));
  const falsosCount = rows.filter(g => g.falso).length;
  document.getElementById("ad-summary").textContent =
    `${rows.length} gestos · ${uids.size} userIds únicos · ${falsosCount} marcados como falsos`;
}

function _formatPayload(g) {
  const p = g.payload || {};
  if (g.tipo === "senal") return `valor: ${p.valor === 1 ? "+1" : "-1"}`;
  if (g.tipo === "reporte") return `cat: ${p.categoria || "?"}`;
  if (g.tipo === "compromiso") return `intent: ${p.intent || "?"} · ${p.nombre || "?"}`;
  if (g.tipo === "registro_entidad") {
    return `${p.nombre || "?"} (${p.categoria || "?"}) · url:${p.validadores?.url ? "✓" : "✗"} nif:${p.validadores?.nif ? "✓" : "✗"}`;
  }
  return JSON.stringify(p).slice(0, 80);
}

function _escAdmin(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

(function bindAdmin() {
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "a") {
      e.preventDefault();
      toggleAdmin();
    } else if (e.key === "Escape" &&
               document.getElementById("admin-overlay")?.classList.contains("open")) {
      closeAdminPanel();
    }
  });
  document.getElementById("admin-close")?.addEventListener("click",
    closeAdminPanel);
  document.getElementById("admin-badge")?.addEventListener("click",
    openAdminPanel);
  const ov = document.getElementById("admin-overlay");
  ov?.addEventListener("click", (e) => {
    if (e.target === ov) closeAdminPanel();
  });
  // Filtros re-renderizan tabla
  for (const id of ["ad-tipo", "ad-ambito"]) {
    document.getElementById(id)?.addEventListener("change", _renderAdminTable);
  }
  document.getElementById("ad-zona")?.addEventListener("input",
    _debounce(_renderAdminTable, 200));
  // Acciones sobre filas
  document.querySelector("#ad-table tbody")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".ad-act-btn");
    if (!btn) return;
    const tr = btn.closest("tr");
    const ts = tr?.dataset.ts;
    const uid = tr?.dataset.uid;
    const act = btn.dataset.act;
    if (act === "marcar-falso") {
      // eslint-disable-next-line no-alert
      const motivo = prompt("Motivo de marcar como falso:") || "";
      if (marcarFalso(ts, motivo)) {
        _renderAdminTable();
        if (state._refreshDashboard) state._refreshDashboard();
      }
    } else if (act === "amonestar") {
      // eslint-disable-next-line no-alert
      const motivo = prompt(`Motivo de amonestar a ${uid.slice(0,12)}:`) || "";
      if (motivo && amonestar(uid, motivo)) {
        // eslint-disable-next-line no-alert
        alert("Amonestación registrada.");
      }
    }
  });
  // Inicial: si el modo admin estaba persistido, mostrar badge.
  _renderAdminBadge();
})();

function _debounce(fn, ms) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// v1.7.cog — Menú de preferencias unificado. Click en ⚙ despliega
// menu con [🔍 Buscar / + Registrar mi sitio / 👤 ADMIN / Cerrar].
// Click fuera o ESC lo cierran. El item ADMIN solo es visible cuando
// 2026-05-26 — Modal genérico para los items "secundarios" del cog
// (cuenta, privacidad, tema, info). Cada item inyecta su contenido en
// el body. Persistencia (tema, escala) en localStorage bajo prefijo
// "polis:cog:".
//
// Diseño: minimal viable, placeholders honestos donde aún no hay backend
// (cuenta, privacidad). Tema sí es funcional y persiste.

const COG_LS_PREFIX = "polis:cog:";

function _cogVersionTag() {
  // Lee el cache-bust del script tag activo (?v=...)
  try {
    const tag = document.querySelector('script[src*="app.js?v="]');
    const m = tag && tag.getAttribute("src").match(/\?v=([^"&]+)/);
    return m ? m[1] : "dev";
  } catch (_) { return "dev"; }
}

function _cogModalContent(kind) {
  if (kind === "cuenta") {
    const user = localStorage.getItem(COG_LS_PREFIX + "alias") || "";
    return {
      title: "Cuenta",
      html: `
        <p class="cog-lead">POLIS no requiere registro para explorar. Si quieres reservar un alias para tus registros y compromisos, escríbelo aquí (se guarda localmente).</p>
        <label class="cog-field">
          <span>Alias público</span>
          <input type="text" id="cog-alias" placeholder="ej. vecina_isleta_88" value="${_cogEsc(user)}" maxlength="40">
        </label>
        <p class="cog-note">Sin servidor por ahora · Sin email · Sin contraseña. Esto cambiará cuando entre Supabase.</p>
        <button class="cog-btn" data-cog-save="alias">Guardar alias</button>
      `,
    };
  }
  if (kind === "privacidad") {
    return {
      title: "Privacidad",
      html: `
        <p class="cog-lead">Lo que ves en POLIS lo descarga tu navegador desde el servidor público. Nada se envía de vuelta.</p>
        <ul class="cog-list">
          <li>📍 Catastro INSPIRE (España, dominio público)</li>
          <li>🗺️ OpenStreetMap (ODbL)</li>
          <li>🏛️ ISTAC / INE (estadística pública canaria)</li>
        </ul>
        <p class="cog-lead">No usamos cookies, tracking, ni analytics. <code>localStorage</code> guarda solo tus preferencias (tema, alias) en este navegador.</p>
        <button class="cog-btn cog-btn-danger" data-cog-action-local="clear-storage">Borrar mis preferencias locales</button>
      `,
    };
  }
  if (kind === "tema") {
    const theme = localStorage.getItem(COG_LS_PREFIX + "theme") || "ocre";
    const scale = localStorage.getItem(COG_LS_PREFIX + "fontscale") || "m";
    return {
      title: "Tema y escala",
      html: `
        <fieldset class="cog-radio">
          <legend>Paleta visual</legend>
          <label><input type="radio" name="cog-theme" value="ocre" ${theme === "ocre" ? "checked" : ""}> Ocre canario (default)</label>
          <label><input type="radio" name="cog-theme" value="papel" ${theme === "papel" ? "checked" : ""}> Papel claro</label>
          <label><input type="radio" name="cog-theme" value="tinta" ${theme === "tinta" ? "checked" : ""}> Tinta oscura</label>
        </fieldset>
        <fieldset class="cog-radio">
          <legend>Tamaño de texto</legend>
          <label><input type="radio" name="cog-fontscale" value="s" ${scale === "s" ? "checked" : ""}> S</label>
          <label><input type="radio" name="cog-fontscale" value="m" ${scale === "m" ? "checked" : ""}> M (default)</label>
          <label><input type="radio" name="cog-fontscale" value="l" ${scale === "l" ? "checked" : ""}> L</label>
        </fieldset>
        <p class="cog-note">Los cambios se aplican al instante. Paleta "papel" y "tinta" son experimentales — algunos overlays están calibrados para ocre.</p>
      `,
    };
  }
  if (kind === "info") {
    const v = _cogVersionTag();
    return {
      title: "Info y créditos",
      html: `
        <p class="cog-lead"><b>POLIS</b> es un visor cívico isométrico de Canarias. 88 municipios, 1.381 secciones censales, ~1.5 M edificios desde catastro INSPIRE.</p>
        <h3>Datos</h3>
        <ul class="cog-list">
          <li><b>Edificios</b>: Catastro INSPIRE (Dirección General del Catastro, España)</li>
          <li><b>Coastline · roads · POIs · parques</b>: OpenStreetMap (ODbL)</li>
          <li><b>Renta · vivienda vacacional</b>: INE / Ministerio</li>
          <li><b>Tejido social</b>: Registro de Asociaciones del Gobierno de Canarias + Cabildos</li>
          <li><b>Eventos / cultura</b>: Cabildo de Gran Canaria · agenda cultural</li>
        </ul>
        <h3>Versión</h3>
        <p class="cog-note">Cache-bust actual: <code>${_cogEsc(v)}</code></p>
        <h3>Créditos</h3>
        <p class="cog-note">Diseño y código: Pancho · iconos OCRE: vernáculos canarios (2026-05-25) · runtime iso: Canvas2D vanilla, sin frameworks.</p>
      `,
    };
  }
  return { title: "—", html: "<p>—</p>" };
}

function openCogModal(kind) {
  const modal = document.getElementById("cog-modal");
  const titleEl = document.getElementById("cog-modal-title");
  const bodyEl = document.getElementById("cog-modal-body");
  if (!modal || !titleEl || !bodyEl) return;
  const c = _cogModalContent(kind);
  titleEl.textContent = c.title;
  bodyEl.innerHTML = c.html;
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  // Aplicar tema en vivo cuando cambia el radio
  if (kind === "tema") {
    bodyEl.querySelectorAll("input[name=cog-theme]").forEach(r => {
      r.addEventListener("change", (e) => {
        const v = e.target.value;
        localStorage.setItem(COG_LS_PREFIX + "theme", v);
        document.documentElement.setAttribute("data-cog-theme", v);
      });
    });
    bodyEl.querySelectorAll("input[name=cog-fontscale]").forEach(r => {
      r.addEventListener("change", (e) => {
        const v = e.target.value;
        localStorage.setItem(COG_LS_PREFIX + "fontscale", v);
        document.documentElement.setAttribute("data-cog-fontscale", v);
      });
    });
  }
  // Guardar alias
  if (kind === "cuenta") {
    bodyEl.querySelector("[data-cog-save=alias]")?.addEventListener("click", () => {
      const v = bodyEl.querySelector("#cog-alias")?.value?.trim() || "";
      if (v) localStorage.setItem(COG_LS_PREFIX + "alias", v);
      else localStorage.removeItem(COG_LS_PREFIX + "alias");
      bodyEl.insertAdjacentHTML("beforeend",
        '<p class="cog-flash">Guardado en este navegador.</p>');
      setTimeout(() => bodyEl.querySelector(".cog-flash")?.remove(), 1500);
    });
  }
  // Privacidad: borrar storage
  if (kind === "privacidad") {
    bodyEl.querySelector("[data-cog-action-local=clear-storage]")?.addEventListener("click", () => {
      const keys = Object.keys(localStorage).filter(k => k.startsWith(COG_LS_PREFIX));
      keys.forEach(k => localStorage.removeItem(k));
      bodyEl.insertAdjacentHTML("beforeend",
        `<p class="cog-flash">Borradas ${keys.length} entradas.</p>`);
      setTimeout(() => bodyEl.querySelector(".cog-flash")?.remove(), 1500);
    });
  }
}

function closeCogModal() {
  const modal = document.getElementById("cog-modal");
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

// (escapeHtmlSafe ya existe en este módulo; lo aliasamos para los modals)
const _cogEsc = (s) => escapeHtmlSafe(String(s ?? ""));

// Bind cierre del modal (backdrop + X + ESC)
(function bindCogModal() {
  const modal = document.getElementById("cog-modal");
  if (!modal) return;
  modal.addEventListener("click", (e) => {
    if (e.target.hasAttribute("data-cog-close")) closeCogModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("open")) closeCogModal();
  });
  // Aplicar tema/escala persistidos al boot
  const theme = localStorage.getItem(COG_LS_PREFIX + "theme");
  if (theme) document.documentElement.setAttribute("data-cog-theme", theme);
  const scale = localStorage.getItem(COG_LS_PREFIX + "fontscale");
  if (scale) document.documentElement.setAttribute("data-cog-fontscale", scale);
})();

// isAdmin() (lo controla _renderAdminBadge).
(function bindCog() {
  const toggle = document.getElementById("cog-toggle");
  const menu = document.getElementById("cog-menu");
  if (!toggle || !menu) return;

  const openMenu = () => {
    menu.classList.add("open");
    menu.setAttribute("aria-hidden", "false");
    toggle.classList.add("active");
  };
  const closeMenu = () => {
    menu.classList.remove("open");
    menu.setAttribute("aria-hidden", "true");
    toggle.classList.remove("active");
  };

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    if (menu.classList.contains("open")) closeMenu();
    else openMenu();
  });

  menu.addEventListener("click", (e) => {
    const item = e.target.closest(".cog-item");
    if (!item) return;
    const action = item.dataset.cogAction;
    closeMenu();
    if (action === "search") openSearch();
    else if (action === "registro") openRegistroPopup();
    else if (action === "admin") openAdminPanel();
    else if (action === "cuenta") openCogModal("cuenta");
    else if (action === "privacidad") openCogModal("privacidad");
    else if (action === "tema") openCogModal("tema");
    else if (action === "info") openCogModal("info");
    // "close" simplemente cierra (ya hecho arriba).
  });

  // Click fuera del menú (y fuera del toggle) lo cierra.
  document.addEventListener("click", (e) => {
    if (!menu.classList.contains("open")) return;
    if (menu.contains(e.target) || toggle.contains(e.target)) return;
    closeMenu();
  });
  // ESC cierra el menú si está abierto (y no hay otro overlay activo).
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menu.classList.contains("open")) {
      closeMenu();
    }
  });
})();

window.polisApp.isAdmin = isAdmin;
window.polisApp.enableAdmin = enableAdmin;
window.polisApp.disableAdmin = () => { disableAdmin(); _renderAdminBadge(); closeAdminPanel(); };
window.polisApp.openAdminPanel = openAdminPanel;
window.polisApp.closeAdminPanel = closeAdminPanel;
window.polisApp.toggleAdmin = toggleAdmin;

// -----------------------------------------------------------
// Popup-desplegable de SECCIÓN (datos · actividades · acciones)
// v1.8 — Tras seleccionar una sección (state.selectedSeccionCusec) el
// botón flotante "Datos y actividades" aparece abajo-centro. Click
// abre un popup con 3 zonas:
//   1. Resumen — cusec, edificios, manzanas, renta (si disponible)
//   2. Actividades cerca — eventos / productores / tejido en el bbox
//   3. Tu gesto aquí — atajos a ámbitos (delegan a openReportePopup /
//      openCompromisoPopup con la zona pre-seleccionada)

function _syncSeccionDetalleToggle() {
  const btn = document.getElementById("seccion-detalle-toggle");
  if (!btn) return;
  const visible = !!state.selectedSeccionCusec &&
                  state.lodLevel === "distrito";
  btn.hidden = !visible;
}

function _seccionBbox(secFeat) {
  // El ringSimple ya está en metros locales.
  let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
  for (const [x, z] of secFeat._ringSimple) {
    if (x < mnx) mnx = x; if (x > mxx) mxx = x;
    if (z < mny) mny = z; if (z > mxy) mxy = z;
  }
  return [mnx, mny, mxx, mxy];
}

function _inBbox(mx, mz, bbox) {
  if (!bbox) return false;
  const [a, b, c, d] = bbox;
  return mx >= a && mx <= c && mz >= b && mz <= d;
}

// -----------------------------------------------------------
// Filtro cross-cutting de actividades culturales — afecta tanto a los
// pins en el mapa (vía setFilter en cada overlay) como al listado
// "Actividades cerca" en el popup de sección. Estado global persistente:
// el filtro NO se borra al cerrar el popup, los markers siguen filtrados.
//
//   activityFilter = {
//     tipo:    "todo" | "evento" | "productor" | "tejido"
//     subcats: Set<string>  // sub-categorías activas (categoria/oficio).
//                           // vacío = todas las del tipo seleccionado.
//   }

state.activityFilter = { tipo: "todo", subcats: new Set() };

// Mapa tipo → overlay + accessor para sub-categoría. Centraliza la
// asimetría de nombres (categoria vs oficio) entre los tres overlays.
const _ACTIVITY_TYPES = [
  { id: "todo",      label: "Todo",       overlay: null },
  { id: "evento",    label: "Eventos",    overlay: eventosOverlay,      catLabel: "Eventos" },
  { id: "productor", label: "Productores", overlay: productoresOverlay, catLabel: "Productores" },
  { id: "tejido",    label: "Tejido",     overlay: tejidoSocialOverlay, catLabel: "Tejido" }
];

function _applyActivityFilter() {
  const af = state.activityFilter;
  const allOf = (overlay) => {
    if (af.tipo === "todo") return null;
    const targetTipo = _ACTIVITY_TYPES.find(t => t.overlay === overlay)?.id;
    if (af.tipo !== targetTipo) return () => false; // ocultar otros tipos
    if (!af.subcats.size) return null;              // mismo tipo, todas las sub-cats
    const get = overlay.getCategoryOf;
    return (item) => af.subcats.has(get(item));
  };
  eventosOverlay.setFilter?.(allOf(eventosOverlay));
  productoresOverlay.setFilter?.(allOf(productoresOverlay));
  tejidoSocialOverlay.setFilter?.(allOf(tejidoSocialOverlay));
  if (state._requestRender) state._requestRender();
}

function _renderActivityChips() {
  const af = state.activityFilter;
  const rowT = document.getElementById("sd-chips-tipo");
  const rowS = document.getElementById("sd-chips-subcat");
  if (!rowT || !rowS) return;

  // Row 1 — tipo (radio-like)
  rowT.innerHTML = _ACTIVITY_TYPES.map(t => {
    const active = af.tipo === t.id ? " active" : "";
    return `<button class="sd-chip${active}" role="tab"
      data-tipo="${_escapeHtml(t.id)}" aria-selected="${af.tipo === t.id}">
      ${_escapeHtml(t.label)}
    </button>`;
  }).join("");

  // Row 2 — sub-categoría (solo si hay tipo concreto y el overlay está listo)
  rowS.innerHTML = "";
  const tipoActivo = _ACTIVITY_TYPES.find(t => t.id === af.tipo);
  if (tipoActivo?.overlay && tipoActivo.overlay.isReady?.() && tipoActivo.overlay.getCategoryOptions) {
    const opts = tipoActivo.overlay.getCategoryOptions();
    rowS.innerHTML = opts.map(o => {
      const active = af.subcats.has(o.key) ? " active" : "";
      return `<button class="sd-chip${active}" data-subcat="${_escapeHtml(o.key)}"
        aria-pressed="${af.subcats.has(o.key)}">
        <span class="sd-chip-dot" style="background:${_escapeHtml(o.fill)}"></span>
        ${_escapeHtml(o.label)}
      </button>`;
    }).join("");
  }
}

function _bindActivityChips() {
  const rowT = document.getElementById("sd-chips-tipo");
  const rowS = document.getElementById("sd-chips-subcat");
  if (!rowT || !rowS || rowT.dataset.bound) return;
  rowT.dataset.bound = "1";

  rowT.addEventListener("click", (e) => {
    const btn = e.target.closest(".sd-chip[data-tipo]");
    if (!btn) return;
    const tipo = btn.dataset.tipo;
    if (state.activityFilter.tipo === tipo) return;
    state.activityFilter.tipo = tipo;
    state.activityFilter.subcats = new Set(); // reset sub al cambiar tipo
    _applyActivityFilter();
    _renderActivityChips();
    _refreshSeccionDetalleActivities();
  });

  rowS.addEventListener("click", (e) => {
    const btn = e.target.closest(".sd-chip[data-subcat]");
    if (!btn) return;
    const key = btn.dataset.subcat;
    const subs = state.activityFilter.subcats;
    if (subs.has(key)) subs.delete(key); else subs.add(key);
    _applyActivityFilter();
    _renderActivityChips();
    _refreshSeccionDetalleActivities();
  });
}

// Re-render del listado de actividades sin recomputar el resto del
// popup. Se llama tras un cambio de filtro mientras el popup está abierto.
function _refreshSeccionDetalleActivities() {
  const popup = document.getElementById("seccion-detalle-popup");
  if (!popup?.classList.contains("open")) return;
  const cusec = state.selectedSeccionCusec;
  if (!cusec) return;
  const sec = state.district?.secciones?.find(s => s.properties.cusec === cusec);
  if (!sec) return;
  _renderSeccionActividades(_seccionBbox(sec));
}

function _renderSeccionActividades(bbox) {
  const actividades = [];
  if (eventosOverlay.isReady?.()) {
    for (const e of eventosOverlay.getAllEvents?.() || []) {
      if (!_inBbox(e.mx, e.mz, bbox)) continue;
      if (!eventosOverlay.passesFilter?.(e)) continue;
      actividades.push({ tipo: "evento", catLbl: "Evento", label: e.properties?.titulo || "Evento", ref: e });
    }
  }
  if (productoresOverlay.isReady?.()) {
    for (const p of productoresOverlay.getAllProductores?.() || []) {
      if (!_inBbox(p.mx, p.mz, bbox)) continue;
      if (!productoresOverlay.passesFilter?.(p)) continue;
      actividades.push({ tipo: "productor", catLbl: "Productor", label: p.properties?.nombre || "Productor", ref: p });
    }
  }
  if (tejidoSocialOverlay.isReady?.()) {
    for (const t of tejidoSocialOverlay.getAllItems?.() || []) {
      if (!_inBbox(t.mx, t.mz, bbox)) continue;
      if (!tejidoSocialOverlay.passesFilter?.(t)) continue;
      actividades.push({ tipo: "tejido", catLbl: "Tejido", label: t.properties?.nombre || "Tejido social", ref: t });
    }
  }
  const wrap = document.getElementById("sd-actividades");
  if (!actividades.length) {
    const hayFiltro = state.activityFilter.tipo !== "todo" || state.activityFilter.subcats.size;
    wrap.innerHTML = `<div class="sd-empty">${hayFiltro
      ? "Sin actividades para los filtros activos en esta sección."
      : "Sin actividades referenciadas en esta sección. Puedes registrar la tuya con el botón \"+\"."}</div>`;
    wrap.onclick = null;
    return;
  }
  wrap.innerHTML = actividades.map((a, i) =>
    `<button class="sd-actividad" data-i="${i}">
      <span class="sda-cat" data-t="${a.tipo}">${_escapeHtml(a.catLbl)}</span>
      <span class="sda-text">${_escapeHtml(a.label)}</span>
    </button>`
  ).join("");
  wrap.onclick = (e) => {
    const btn = e.target.closest(".sd-actividad");
    if (!btn) return;
    const i = parseInt(btn.dataset.i, 10);
    const a = actividades[i];
    if (!a) return;
    closeSeccionDetallePopup();
    if (a.tipo === "evento") openEventoPopup(a.ref);
    else if (a.tipo === "productor") openProductorPopup(a.ref);
    else if (a.tipo === "tejido") openTejidoPopup(a.ref);
  };
}

async function openSeccionDetallePopup() {
  const cusec = state.selectedSeccionCusec;
  if (!cusec) return;
  const sec = state.district?.secciones?.find(s => s.properties.cusec === cusec);
  if (!sec) return;

  const popup = document.getElementById("seccion-detalle-popup");
  if (!popup) return;

  // En móvil: si el tablero (bottom sheet) está abierto, lo cerramos
  // antes de mostrar el popup para liberar espacio vertical y evitar
  // que los glifos del dashboard asomen detrás del popup.
  const dashboard = document.getElementById("dashboard");
  if (dashboard && dashboard.classList.contains("open") &&
      window.matchMedia("(max-width: 768px)").matches) {
    dashboard.classList.remove("open");
  }

  document.getElementById("sd-cusec").textContent = cusec;
  document.getElementById("sd-zona").textContent =
    `${state.municipio?.nmun || ""}${state.district?.dis ? " · Distrito " + state.district.dis : ""}`;

  // ---------- ZONA 1: Resumen
  const datos = [];
  const bc = sec._buildingCount || 0;
  datos.push({ k: "Edificios", v: bc.toLocaleString("es") });
  // Renta si overlay cargado
  if (rentaOverlay?.isReady?.()) {
    try {
      // Hack: leer directamente del módulo si expone helper, si no skip
      const breaks = rentaOverlay.getBreaks?.();
      // No expone get por cusec; obtenemos desde fetch directo cache
      // Simplificación: skip renta detallada en MVP
      if (breaks) datos.push({ k: "Tramos renta isla", v: `${Math.round(breaks.p20/1000)}k / ${Math.round(breaks.p50/1000)}k / ${Math.round(breaks.p80/1000)}k €` });
    } catch (e) { /* no-op */ }
  }
  document.getElementById("sd-datos").innerHTML = datos
    .map(d => `<dt>${_escapeHtml(d.k)}</dt><dd>${_escapeHtml(d.v)}</dd>`)
    .join("");

  // ---------- ZONA 2: Filtros + Actividades cerca (eventos + productores + tejido)
  const bbox = _seccionBbox(sec);
  _renderActivityChips();
  _bindActivityChips();
  _renderSeccionActividades(bbox);

  // ---------- ZONA 3: Tu gesto aquí — atajos a ámbitos
  const acc = document.getElementById("sd-acciones");
  acc.innerHTML = AMBITOS.map(a =>
    `<button class="sd-accion" data-amb="${_escapeHtml(a.id)}" data-act="reporte">
      <span class="sda-glifo">${_escapeHtml(a.glyph)}</span>
      Reportar problema · ${_escapeHtml(a.label.toLowerCase())}
    </button>
    <button class="sd-accion" data-amb="${_escapeHtml(a.id)}" data-act="compromiso">
      <span class="sda-glifo">${_escapeHtml(a.glyph)}</span>
      Compromiso · ${_escapeHtml(a.label.toLowerCase())}
    </button>`
  ).join("");
  acc.onclick = (e) => {
    const btn = e.target.closest(".sd-accion");
    if (!btn) return;
    const ambId = btn.dataset.amb;
    const act = btn.dataset.act;
    const amb = AMBITOS.find(x => x.id === ambId);
    if (!amb) return;
    closeSeccionDetallePopup();
    if (act === "reporte") openReportePopup(amb);
    else if (act === "compromiso") openCompromisoPopup(amb);
  };

  popup.classList.add("open");
  popup.setAttribute("aria-hidden", "false");
}

function closeSeccionDetallePopup() {
  const popup = document.getElementById("seccion-detalle-popup");
  if (!popup) return;
  popup.classList.remove("open");
  popup.setAttribute("aria-hidden", "true");
}

(function bindSeccionDetalle() {
  document.getElementById("seccion-detalle-toggle")?.addEventListener("click",
    openSeccionDetallePopup);
  document.getElementById("sd-close")?.addEventListener("click",
    closeSeccionDetallePopup);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" &&
        document.getElementById("seccion-detalle-popup")?.classList.contains("open"))
      closeSeccionDetallePopup();
  });
})();

window.polisApp.openSeccionDetallePopup = openSeccionDetallePopup;
window.polisApp.closeSeccionDetallePopup = closeSeccionDetallePopup;
window.polisApp._syncSeccionDetalleToggle = _syncSeccionDetalleToggle;
window.polisApp.getRegistroDetallado = getRegistroDetallado;
window.polisApp.marcarFalso = marcarFalso;
window.polisApp.amonestar = amonestar;
window.polisApp.listarAmonestaciones = listarAmonestaciones;

// -----------------------------------------------------------
// Sheet "Lo que está en mis manos" — bottom-sheet con grid de ámbitos.
// Sustituye al ≡ panel de capas como entrada UX principal. El panel
// crudo sigue accesible vía footer del sheet ("Ver capas de datos").
// Nivel 1 (actividades dentro de cada ámbito) pendiente — hoy el
// click en una tarjeta solo registra el ámbito en consola para que
// veas qué se está pulsando.

(function bindGestosSheet() {
  const toggle = document.getElementById("gestos-toggle");
  const sheet  = document.getElementById("gestos-sheet");
  const close  = document.getElementById("gestos-sheet-close");
  const grid   = document.getElementById("gestos-sheet-grid");
  const dataBtn = document.getElementById("gestos-data-toggle");
  if (!toggle || !sheet) return;

  function open() {
    renderVerbos(); // cada apertura arranca en el grid de verbos (no en un subgrid stale)
    sheet.classList.add("open");
    sheet.setAttribute("aria-hidden", "false");
    toggle.classList.add("open");
    toggle.setAttribute("aria-expanded", "true");
  }
  function closeSheet() {
    sheet.classList.remove("open");
    sheet.setAttribute("aria-hidden", "true");
    toggle.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  }

  toggle.addEventListener("click", () => {
    if (sheet.classList.contains("open")) closeSheet();
    else open();
  });
  close?.addEventListener("click", closeSheet);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && sheet.classList.contains("open")) closeSheet();
  });

  // [2026-05-29] Nivel 0/1 de la hoja de gestos: grid de VERBOS cívicos
  // (taxonomía compartida) → subgrid de SECTORES → activa overlay del
  // mapa. Fuente: shared/taxonomia.js. Reusa CSS .ambito-card.
  const titleEl = document.getElementById("gestos-sheet-title");
  const hintEl  = document.querySelector(".gestos-sheet-hint");

  function flashHint(txt) {
    if (!hintEl) return;
    hintEl.textContent = txt;
    clearTimeout(hintEl._t);
    hintEl._t = setTimeout(() => {
      hintEl.textContent = "Toca un verbo para ver sus sectores";
    }, 2400);
  }

  function cardHTML(glifo, title, sub, dataAttrs, soon) {
    return `<button class="ambito-card${soon ? " is-soon" : ""}" type="button" ${dataAttrs}>
      <span class="ambito-glifo" aria-hidden="true">${glifo || "·"}</span>
      <span class="ambito-title">${title}</span>
      <span class="ambito-sub">${sub || ""}</span>
    </button>`;
  }

  function renderVerbos() {
    if (!grid) return;
    if (titleEl) titleEl.textContent = "Lo que está en mis manos";
    grid.innerHTML = TAXONOMIA.map(v =>
      cardHTML((VERBO_ART && VERBO_ART[v.id]) || v.glifo, v.verbo, v.sub, `data-verbo="${v.id}"`, false)
    ).join("");
  }

  // Subgrid FLOTANTE con multi-selección + commit. Al pulsar un verbo se
  // abre un panel flotante con toggles; marcas varios y "Aceptar" activa
  // todos los overlays a la vez (uniendo subcats si apuntan al mismo).
  let subgridEl = null;
  let subgridVerbo = null;

  function ensureSubgrid() {
    if (subgridEl) return subgridEl;
    const back = document.createElement("div");
    back.className = "gsg-backdrop"; back.id = "gestos-subgrid-backdrop"; back.hidden = true;
    const panel = document.createElement("div");
    panel.className = "gsg-panel"; panel.id = "gestos-subgrid"; panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.innerHTML = `
      <header class="gsg-head">
        <span class="gsg-title"></span>
        <button class="gsg-close" type="button" aria-label="Cerrar">×</button>
      </header>
      <div class="gsg-toggles"></div>
      <footer class="gsg-foot">
        <button class="gsg-cancel" type="button">cancelar</button>
        <button class="gsg-accept" type="button">aceptar</button>
      </footer>`;
    document.body.append(back, panel);

    back.addEventListener("click", closeSubgrid);
    panel.querySelector(".gsg-close").addEventListener("click", closeSubgrid);
    panel.querySelector(".gsg-cancel").addEventListener("click", closeSubgrid);
    panel.querySelector(".gsg-accept").addEventListener("click", aplicarSeleccion);
    panel.querySelector(".gsg-toggles").addEventListener("click", (e) => {
      const go = e.target.closest(".gsg-go");
      if (go) { window.location.href = go.dataset.destino; return; }
      const tog = e.target.closest(".gsg-toggle");
      if (!tog || tog.disabled) return;
      tog.classList.toggle("on");
      tog.setAttribute("aria-pressed", tog.classList.contains("on") ? "true" : "false");
    });
    subgridEl = panel;
    return panel;
  }

  function openSubgrid(verbo) {
    if (!verbo) return;
    subgridVerbo = verbo;
    const panel = ensureSubgrid();
    panel.querySelector(".gsg-title").textContent = verbo.verbo;
    panel.querySelector(".gsg-toggles").innerHTML = verbo.sectores.map(s => {
      const soon = s.estado !== SECTOR_ESTADO.LOCAL;
      if (s.destino && !soon) {
        return `<button class="gsg-go" type="button" data-destino="${s.destino}">
          <span class="gsg-glifo">${s.glifo || "·"}</span><span class="gsg-lbl">${s.label}</span>
          <span class="gsg-arrow">↗</span></button>`;
      }
      const attrs = [
        s.overlay ? `data-overlay="${s.overlay}"` : "",
        s.subcat ? `data-subcat='${JSON.stringify(s.subcat)}'` : ""
      ].filter(Boolean).join(" ");
      const tag = soon ? `<span class="gsg-soon">${s.estado === SECTOR_ESTADO.WEB ? "web · pronto" : "pronto"}</span>` : "";
      return `<button class="gsg-toggle" type="button" aria-pressed="false" ${attrs} ${soon ? "disabled" : ""}>
        <span class="gsg-glifo">${s.glifo || "·"}</span><span class="gsg-lbl">${s.label}</span>${tag}</button>`;
    }).join("");
    document.getElementById("gestos-subgrid-backdrop").hidden = false;
    panel.hidden = false;
  }

  function closeSubgrid() {
    if (subgridEl) subgridEl.hidden = true;
    const back = document.getElementById("gestos-subgrid-backdrop");
    if (back) back.hidden = true;
  }

  async function aplicarSeleccion() {
    if (!subgridVerbo || !subgridEl) { closeSubgrid(); return; }
    const marcados = [...subgridEl.querySelectorAll(".gsg-toggle.on")];
    if (marcados.length === 0) { closeSubgrid(); return; }
    // Agrupar por overlay, unir subcats. Si algún sector del mismo overlay
    // no trae subcat → se muestran todos (filtro nulo).
    const porOverlay = new Map();
    for (const t of marcados) {
      const ovId = t.dataset.overlay;
      if (!ovId) continue;
      const subcat = t.dataset.subcat ? JSON.parse(t.dataset.subcat) : null;
      if (!porOverlay.has(ovId)) porOverlay.set(ovId, subcat ? new Set(subcat) : null);
      else {
        const cur = porOverlay.get(ovId);
        if (cur === null || !subcat) porOverlay.set(ovId, null);
        else subcat.forEach(k => cur.add(k));
      }
    }
    for (const [ovId, subcatSet] of porOverlay) {
      try {
        await setOverlayActive(state, ovId, true);
        const ov = state._overlayRegistry && state._overlayRegistry.get(ovId);
        ov?.setSubcatFilter?.(subcatSet || new Set());  // Set vacío = todos
      } catch (err) {
        console.warn("[gestos] overlay falló:", ovId, err);
      }
    }
    state._requestRender && state._requestRender();
    closeSubgrid();
    closeSheet();
  }

  grid?.addEventListener("click", (e) => {
    const card = e.target.closest(".ambito-card");
    if (!card) return;
    if (card.dataset.verbo) openSubgrid(getVerbo(card.dataset.verbo));
  });

  renderVerbos();

  dataBtn?.addEventListener("click", () => {
    // Abrir el panel de capas crudo (≡) directamente sin pasar por su
    // botón toggle (que ahora está hidden).
    const panel = document.getElementById("layer-panel");
    const legacyBtn = document.getElementById("layer-panel-toggle");
    if (!panel) return;
    panel.classList.add("open");
    legacyBtn?.classList.add("open");
    legacyBtn?.setAttribute("aria-expanded", "true");
    closeSheet();
  });
})();

boot().catch(err => {
  console.error(err);
  document.getElementById("banner-sub").textContent = "error: " + err.message;
});
