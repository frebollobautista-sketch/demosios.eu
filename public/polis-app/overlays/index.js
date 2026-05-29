// Registry + orquestador de overlays cívicos para el runtime iso.
//
// Cada overlay vive en su propio módulo `overlays/<id>.js` y exporta
// un objeto con la siguiente forma mínima:
//
//   {
//     id:      string  — slug único ("renta", "guaguas", ...)
//     name:    string  — etiqueta human-readable para el botón
//     load():           Promise — fetch + cache. Idempotente.
//     isReady(): boolean — true tras load() exitoso
//     draw(ctx, state, view) — pinta sobre el canvas actual
//   }
//
// La metadata de UI (categoría, niveles aplicables) la centraliza este
// fichero para no exigirla a cada overlay y poder reordenar/etiquetar
// desde un único punto. Si un overlay no aparece en META cae en
// "otros" con niveles vacíos (= toggleable en cualquier nivel).
//
// Hook con renderer: el renderer llama a `drawActiveOverlays(ctx, state,
// view)` después del render base del nivel. Cada overlay decide
// internamente qué hacer en función de `state.lodLevel`.

import { rentaOverlay }       from "./renta.js";
import { vvOverlay }          from "./vv.js";
import { guaguasOverlay }     from "./guaguas.js";
import { coberturaOverlay }   from "./cobertura.js";
import { educacionOverlay }   from "./educacion.js?v=20260527-multiprov";
import { listaEsperaOverlay } from "./lista-espera.js";
import { parquesOverlay }     from "./parques.js?v=20260527-subchips";
import { eventosOverlay }     from "./eventos.js";
import { productoresOverlay } from "./productores.js";
import { tejidoSocialOverlay } from "./tejido-social.js?v=20260527-subchips";
import { agoraOverlay }       from "./agora.js?v=20260527-subchips";
import { registroOverlay }    from "./registro.js";
import { barriosOverlay }     from "./barrios.js";
import { culturaVenuesOverlay } from "./cultura-venues.js";
import { paroOverlay }        from "./paro.js?v=20260527-paro-istac";
import { calidadAireOverlay } from "./calidad-aire.js?v=20260527-aire-v0";
import { alimentacionOverlay } from "./alimentacion.js?v=20260527-alim-v0";
// === Batch 2026-05-27 (10 overlays nuevos, integración final) ===
import { titsaOverlay }        from "./titsa.js?v=20260527-titsa-v0";
import { centrosSaludOverlay } from "./centros-salud.js?v=20260527-salud-v0";
import { inundacionOverlay }   from "./inundacion.js?v=20260527-inund-v0";
import { calimaOverlay }       from "./calima.js?v=20260527-calima-v0";
import { movilidadSuaveOverlay } from "./movilidad-suave.js?v=20260527-movsuave-v0";
import { subvencionesOverlay } from "./subvenciones.js?v=20260527-subv-v0";
import { memoriaDemocraticaOverlay } from "./memoria-democratica.js?v=20260527-mem-v0";
import { bicOverlay }          from "./bic.js?v=20260527-bic-v0";
import { mobiliarioOverlay }   from "./mobiliario.js?v=20260527-mobiliario-v0";
import { arbolesSingularesOverlay } from "./arboles-singulares.js?v=20260527-arboles-v0";
import { playasOverlay }   from "./playas.js?v=20260527-playas-v0";
import { comedoresEscolaresOverlay } from "./comedores-escolares.js?v=20260527-comedores-v0";
// === Batch 2026-05-29 (3 overlays nuevos: ENP · bici/recarga · yacimientos) ===
import { enpOverlay }            from "./enp.js?v=20260529-enp-v0";
import { biciRecargaOverlay }    from "./bici-recarga.js?v=20260529-bici-v0";
import { yacimientosOverlay }    from "./yacimientos.js?v=20260529-yac-v0";

// Lista canónica de overlays. El orden determina el orden de pintado:
// los siguientes pintan ENCIMA. Coropletas primero (rellenan), luego
// polígonos translúcidos (cobertura, parques), luego puntos/líneas,
// y por último eventos (pins encima de todo).
export const OVERLAYS = [
  // === Coropletas (fondos administrativos) ===
  rentaOverlay,
  paroOverlay,            // % paro registrado ISTAC 2026-Q1
  subvencionesOverlay,    // ayudas €/mun BDNS
  // === Polígonos translúcidos (zonas) ===
  inundacionOverlay,      // ARPSI PEINCA bandas azules
  calimaOverlay,          // velo polvo sahariano nivel-color
  enpOverlay,             // Espacios Naturales Protegidos + Red Natura (verde-oliva)
  barriosOverlay,
  parquesOverlay,
  coberturaOverlay,
  movilidadSuaveOverlay,  // carriles bici / peatonales / zona 30
  // === Líneas/áreas semitransparentes ===
  guaguasOverlay,
  vvOverlay,
  // === Pins (puntos rich) ===
  educacionOverlay,
  centrosSaludOverlay,    // 723 centros AP/HOSP/URG
  listaEsperaOverlay,
  eventosOverlay,
  productoresOverlay,
  tejidoSocialOverlay,
  agoraOverlay,
  registroOverlay,
  culturaVenuesOverlay,
  bicOverlay,             // BIC + patrimonio catalogado
  arbolesSingularesOverlay, // 146 árboles singulares (drago, pino, sabina…)
  memoriaDemocraticaOverlay, // 16 lugares memoria histórica
  titsaOverlay,           // 3.788 paradas Titsa con itinerarios
  alimentacionOverlay,    // 10.812 negocios alimentación
  mobiliarioOverlay,      // bancos · fuentes · aseos · refugios · árboles urbanos
  playasOverlay,          // 534 playas + 22 banderas azules 2025
  comedoresEscolaresOverlay, // comedores + becas escolares
  // === Batch 2026-05-29 (pins) ===
  biciRecargaOverlay,     // bici parking + recarga eléctrica + Sítycleta
  yacimientosOverlay,     // yacimientos prehispánicos (terracota, anti-expolio)
  calidadAireOverlay,     // pins encima de todo (datos en vivo)
];

// Metadata UI por id de overlay (categoría + niveles donde aplica).
const META = {
  barrios:        { category: "identidad",     levels: ["municipio", "distrito"] },
  renta:          { category: "vivienda",      levels: ["municipio", "distrito", "barrio"] },
  vv:             { category: "vivienda",      levels: ["isla", "municipio", "distrito", "seccion"] },
  parques:        { category: "verdes",        levels: ["municipio", "distrito", "seccion"], subcategorias: true },
  cobertura:      { category: "movilidad",     levels: ["municipio", "distrito", "seccion"] },
  guaguas:        { category: "movilidad",     levels: ["municipio", "distrito", "seccion"] },
  educacion:      { category: "equipamientos", levels: ["isla", "municipio", "distrito", "seccion"], subcategorias: true },
  "lista-espera": { category: "desigualdades", levels: ["isla", "municipio", "distrito", "seccion"] },
  eventos:        { category: "cultura",       levels: ["archipielago", "isla", "municipio", "distrito", "barrio", "manzana", "seccion"] },
  productores:    { category: "cultura",       levels: ["isla", "municipio", "distrito", "seccion"] },
  "tejido-social": { category: "comunidad",    levels: ["isla", "municipio", "distrito", "seccion"], subcategorias: true },
  agora:          { category: "comunidad",    levels: ["isla", "municipio", "distrito", "vecindario", "barrio", "seccion"], subcategorias: true },
  "registro-oficial": { category: "comunidad", levels: ["archipielago", "isla", "municipio", "distrito", "barrio", "seccion"] },
  "cultura-venues":   { category: "cultura",   levels: ["isla", "municipio", "distrito", "barrio", "seccion"] },
  paro:               { category: "trabajo",   levels: ["archipielago", "isla", "municipio"] },
  "calidad-aire":     { category: "ambiente",  levels: ["archipielago", "isla", "municipio", "distrito", "barrio", "seccion"] },
  // 2026-05-27 — Alimentación y comercio local: 10.812 negocios OSM con
  // 11 sub-categorías filtrables (panadería, carnicería, pescadería,
  // frutería, supermercado, ultramarinos, bebidas, mercado, restaurante,
  // café, bar). UI sub-toggle vía alimentacionOverlay.setSubcatFilter().
  alimentacion:       { category: "alimentacion", levels: ["isla", "municipio", "distrito", "vecindario", "barrio", "seccion"], subcategorias: true },
  // === Batch 2026-05-27 ===
  titsa:               { category: "movilidad",     levels: ["municipio", "distrito", "barrio", "seccion"] },
  "movilidad-suave":   { category: "movilidad",     levels: ["municipio", "distrito", "barrio", "seccion"], subcategorias: true },
  "centros-salud":     { category: "equipamientos", levels: ["isla", "municipio", "distrito", "barrio", "seccion"], subcategorias: true },
  inundacion:          { category: "ambiente",      levels: ["municipio", "distrito", "barrio", "seccion"] },
  calima:              { category: "ambiente",      levels: ["archipielago", "isla", "municipio"] },
  subvenciones:        { category: "trabajo",       levels: ["archipielago", "isla", "municipio", "distrito", "barrio", "seccion"] },
  "memoria-democratica": { category: "patrimonio",  levels: ["isla", "municipio", "distrito", "barrio", "seccion"], subcategorias: true },
  bic:                 { category: "patrimonio",    levels: ["isla", "municipio", "distrito", "barrio", "seccion"], subcategorias: true },
  "arboles-singulares": { category: "patrimonio",   levels: ["isla", "municipio", "distrito", "barrio", "seccion"], subcategorias: true },
  mobiliario:          { category: "verdes",        levels: ["municipio", "distrito", "barrio", "seccion", "manzana"], subcategorias: true },
  playas:              { category: "verdes",        levels: ["isla", "municipio", "distrito", "barrio", "seccion"], subcategorias: true },
  "comedores-escolares": { category: "equipamientos", levels: ["isla", "municipio", "distrito", "barrio", "seccion"], subcategorias: true },
  // === Batch 2026-05-29 ===
  enp:                 { category: "verdes",        levels: ["isla", "municipio", "distrito", "barrio", "seccion"] },
  "bici-recarga":      { category: "movilidad",     levels: ["isla", "municipio", "distrito", "barrio", "seccion", "manzana"], subcategorias: true },
  yacimientos:         { category: "patrimonio",    levels: ["isla", "municipio", "distrito", "barrio", "seccion"], subcategorias: true },
};

const CATEGORIES = {
  identidad:     { label: "Identidad" },
  comunidad:     { label: "Tejido social" },
  alimentacion:  { label: "Alimentación y comercio" },
  vivienda:      { label: "Vivienda y turismo" },
  patrimonio:    { label: "Patrimonio y cultura" },
  cultura:       { label: "Cultura y eventos" },
  movilidad:     { label: "Movilidad y transporte" },
  equipamientos: { label: "Equipamientos" },
  desigualdades: { label: "Desigualdades cívicas" },
  ambiente:      { label: "Medio ambiente" },
  verdes:        { label: "Espacios verdes" },
  trabajo:       { label: "Trabajo y economía" },
  otros:         { label: "Otros" },
};

// Orden visual de categorías en el panel — comunidad ARRIBA del todo,
// coherente con la prioridad pedida por Pancho (curation policy).
const CATEGORY_ORDER = [
  "identidad", "comunidad", "alimentacion", "vivienda", "patrimonio", "cultura",
  "movilidad", "equipamientos", "desigualdades", "ambiente", "verdes", "trabajo", "otros"
];

// -----------------------------------------------------------
// Inicialización: registra overlays en el state + monta panel UI.

export function initOverlays(state) {
  state.activeOverlays = {};
  state._overlayRegistry = new Map();
  for (const ov of OVERLAYS) {
    state._overlayRegistry.set(ov.id, ov);
    state.activeOverlays[ov.id] = false;
  }
  mountPanel(state);
}

// -----------------------------------------------------------
// API pública: encender/apagar un overlay.

export async function setOverlayActive(state, id, on) {
  const ov = state._overlayRegistry.get(id);
  if (!ov) {
    console.warn(`[overlays] desconocido: ${id}`);
    return;
  }
  state.activeOverlays[id] = !!on;
  if (on) {
    // Pasamos `state` a load(); los overlays simples lo ignoran. Los
    // overlays con lazy-load por contexto (p.ej. registro-oficial)
    // lo usan para cargar sólo la isla activa.
    if (!ov.isReady()) {
      try {
        await ov.load(state);
      } catch (e) {
        console.warn(`[overlay ${id}] load fallo`, e);
      }
    } else if (typeof ov.load === "function") {
      // Si ya está "ready" pero el overlay soporta context-aware load
      // (p.ej. nueva isla por descubrir), lo invocamos sin bloquear.
      try { Promise.resolve(ov.load(state)).catch(() => {}); }
      catch (e) { /* silent */ }
    }
  }
  if (state._requestRender) state._requestRender();
}

// -----------------------------------------------------------
// Hook llamado por renderer.render() tras el render base del nivel.

export function drawActiveOverlays(ctx, state, view) {
  if (!state.activeOverlays || !state._overlayRegistry) return;
  for (const ov of OVERLAYS) {
    if (!state.activeOverlays[ov.id]) continue;
    if (!ov.isReady || !ov.isReady()) continue;
    try {
      ov.draw(ctx, state, view);
    } catch (e) {
      console.error(`[overlay ${ov.id}] draw error`, e);
    }
  }
}

// -----------------------------------------------------------
// Panel UI: lista de toggles agrupada por categoría.

function mountPanel(state) {
  const panel = document.getElementById("layer-panel");
  const toggleBtn = document.getElementById("layer-panel-toggle");
  if (!panel || !toggleBtn) return;

  // Agrupar overlays por categoría.
  const byCat = new Map();
  for (const ov of OVERLAYS) {
    const meta = META[ov.id] || { category: "otros", levels: [] };
    const cat = meta.category;
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat).push({ ov, meta });
  }

  const parts = [];
  parts.push(`<header class="lp-head">Capas</header>`);
  for (const catId of CATEGORY_ORDER) {
    const list = byCat.get(catId);
    if (!list || !list.length) continue;
    const catLabel = CATEGORIES[catId]?.label || catId;
    parts.push(`<section class="lp-cat">`);
    parts.push(`<div class="lp-cat-label">${escapeHtml(catLabel)}</div>`);
    for (const { ov, meta } of list) {
      const levelsAttr = (meta.levels || []).join(",");
      parts.push(
        `<button class="lp-layer" data-id="${escapeHtml(ov.id)}" ` +
        `data-levels="${escapeHtml(levelsAttr)}">` +
        `<span class="lp-dot"></span>` +
        `<span class="lp-name">${escapeHtml(ov.name)}</span>` +
        `</button>`
      );
      // 2026-05-27 — Sub-chips de filtro por subcategoría. Si el overlay
      // tiene .getSubcatOptions() y meta.subcategorias=true, renderizamos
      // un row colapsable de chips bajo el toggle principal.
      if (meta.subcategorias && typeof ov.getSubcatOptions === "function") {
        const opts = ov.getSubcatOptions();
        if (opts && opts.length) {
          parts.push(`<div class="lp-subchips" data-for="${escapeHtml(ov.id)}" hidden>`);
          for (const opt of opts) {
            parts.push(
              `<button class="lp-chip" data-sub="${escapeHtml(opt.key)}" ` +
              `data-overlay="${escapeHtml(ov.id)}" ` +
              `style="--chip-fill:${escapeHtml(opt.fill)}" ` +
              `title="${escapeHtml(opt.label)}">` +
              `<span class="lp-chip-dot"></span>` +
              `<span class="lp-chip-glyph">${escapeHtml(opt.glyph || "·")}</span>` +
              `<span class="lp-chip-label">${escapeHtml(opt.label)}</span>` +
              `</button>`
            );
          }
          parts.push(`<button class="lp-chip lp-chip-all" data-sub-all data-overlay="${escapeHtml(ov.id)}">Todos</button>`);
          parts.push(`</div>`);
        }
      }
    }
    parts.push(`</section>`);
  }
  panel.innerHTML = parts.join("");

  panel.addEventListener("click", (e) => {
    // 2026-05-27 — Sub-chips toman precedencia sobre toggle principal
    const chip = e.target.closest(".lp-chip");
    if (chip) {
      e.stopPropagation();
      const ovId = chip.dataset.overlay;
      const ov = state._overlayRegistry.get(ovId);
      if (!ov || typeof ov.setSubcatFilter !== "function") return;
      const container = chip.closest(".lp-subchips");
      const allChips = container ? container.querySelectorAll(".lp-chip[data-sub]") : [];
      if (chip.hasAttribute("data-sub-all")) {
        // "Todos" → desactivar filtro, marcar todos los chips como activos visualmente
        allChips.forEach(c => c.classList.add("active"));
        chip.classList.add("active");
        ov.setSubcatFilter(null);
      } else {
        chip.classList.toggle("active");
        // Si algún chip individual está activo, "Todos" deja de estar.
        const allBtn = container?.querySelector(".lp-chip-all");
        if (allBtn) allBtn.classList.remove("active");
        const active = Array.from(allChips).filter(c => c.classList.contains("active"))
                            .map(c => c.dataset.sub);
        ov.setSubcatFilter(active.length === 0 ? null : new Set(active));
      }
      if (state._requestRender) state._requestRender();
      return;
    }

    const btn = e.target.closest(".lp-layer");
    if (!btn) return;
    const id = btn.dataset.id;
    const on = !btn.classList.contains("active");
    btn.classList.toggle("active", on);
    // Mostrar/ocultar sub-chips del overlay
    const sub = panel.querySelector(`.lp-subchips[data-for="${id}"]`);
    if (sub) sub.hidden = !on;
    setOverlayActive(state, id, on);
  });

  toggleBtn.addEventListener("click", () => {
    const open = panel.classList.toggle("open");
    toggleBtn.classList.toggle("open", open);
    toggleBtn.setAttribute("aria-expanded", String(open));
  });

  // Atenúa botones cuyos `levels` no aplican al nivel actual. Se
  // actualiza desde app.js tras cada cambio de nivel.
  state._refreshLayerPanel = () => {
    const lvl = state.lodLevel;
    panel.querySelectorAll(".lp-layer").forEach((btn) => {
      const levels = (btn.dataset.levels || "").split(",").filter(Boolean);
      const ok = !levels.length || levels.includes(lvl);
      btn.classList.toggle("muted", !ok);
    });
  };
  state._refreshLayerPanel();
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Helper para que sub-agentes registren su capa+metadata sin tocar las
// constantes de arriba. Llamar ANTES de initOverlays(state).
export function registerOverlay(overlay, meta) {
  if (!overlay || !overlay.id) return;
  if (!OVERLAYS.some(o => o.id === overlay.id)) {
    OVERLAYS.push(overlay);
  }
  if (meta) META[overlay.id] = meta;
}
