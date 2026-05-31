// Tablero cívico — estilo juego de gestión.
//
// 4 ámbitos de derecho fundamental visibles permanentemente en el lado
// derecho de la pantalla. Cada uno agrega información de los datasets
// existentes desde la perspectiva del habitante (no del cartógrafo) y
// ofrece una acción de un paso para participar.
//
// Filosofía (ver docs/CURATION-POLICY.md): los ámbitos enmarcan los
// datos desde derechos fundamentales — espacio, movilidad, alimentación,
// cultura. Las capas individuales siguen accesibles para usuarios
// avanzados desde el botón "Modo datos" (panel ≡).

import { setOverlayActive } from "./overlays/index.js";
import { recordGesto, getSenalesAggregadas, getReportesCount,
         REPORTES_POR_AMBITO } from "../shared/gestos.js";

// -----------------------------------------------------------
// 2026-05-21 P3 — Helper para fetch perezoso del manifest de entidades.
// Sólo se consulta cuando el usuario abre "Detalles ▾" en cultura archi/
// isla. Cachea en state._entidadesManifest para no volver a fetcharlo.
async function _ensureEntidadesManifest(state) {
  if (!state) return { files: {} };
  if (state._entidadesManifest) return state._entidadesManifest;
  try {
    state._entidadesManifest = await fetch("../data/entidades/manifest.json")
      .then(r => r.json());
  } catch (e) {
    console.warn("[dashboard] manifest entidades no disponible:", e);
    state._entidadesManifest = { files: {} };
  }
  return state._entidadesManifest;
}

// -----------------------------------------------------------
// Definición declarativa de ámbitos.

export const AMBITOS = [
  {
    id: "espacio",
    label: "Cuidado del espacio",
    glyph: "◰",
    derecho: "Derecho a la ciudad",
    capas: ["parques", "tejido-social"],
    accion: {
      label: "Apuntarme a una jornada de cuidado",
      intent: "cuidado-espacio"
    }
  },
  {
    id: "movilidad",
    label: "Movilidad sostenible",
    glyph: "⇆",
    derecho: "Derecho a moverse",
    capas: ["guaguas", "cobertura"],
    accion: {
      label: "Comprometerme a usar bus 3 días/sem",
      intent: "movilidad-bus"
    }
  },
  {
    id: "alimentacion",
    label: "Soberanía alimentaria",
    glyph: "✿",
    derecho: "Derecho a alimentación adecuada",
    capas: ["productores", "tejido-social"],
    accion: {
      label: "Comprar local 1× semana",
      intent: "alimentacion-local"
    }
  },
  {
    id: "cultura",
    label: "Cultura accesible",
    glyph: "♪",
    derecho: "Derecho de acceso a la cultura",
    capas: ["eventos", "tejido-social"],
    accion: {
      label: "Avisarme de eventos cercanos",
      intent: "cultura-eventos"
    }
  }
];

// 2026-05-21 — Cableado ámbito → overlay primario (HANDOFF prioridad 1).
// Click en card del tablero togglea el overlay correspondiente en lugar
// de abrir el popover dummy "próximamente". El popover sólo se usa para
// ámbitos sin overlay primario asociado.
const AMBITO_TO_OVERLAY = {
  cultura:      "eventos",
  movilidad:    "guaguas",
  alimentacion: "productores",
  espacio:      "parques",
};

// -----------------------------------------------------------
// Helpers de cálculo de métricas.

function _getCurrentBbox(state) {
  if (state.lodLevel === "isla")      return state.isla?.bbox;
  if (state.lodLevel === "municipio") return state.municipio?.bbox;
  if (state.lodLevel === "distrito")  return state.district?.bbox;
  if (state.lodLevel === "seccion")
    return state.section?._bbox || state.section?.bbox || null;
  return null;
}

function _inBbox(mx, mz, bbox) {
  if (!bbox) return true;
  const [a, b, c, d] = bbox;
  return mx >= a && mx <= c && mz >= b && mz <= d;
}

async function _preload(state, id) {
  const ov = state._overlayRegistry?.get(id);
  if (!ov) return null;
  if (!ov.isReady()) await ov.load();
  return ov;
}

// -----------------------------------------------------------
// Cálculo de métricas por ámbito.

async function _computeMetric(ambito, state) {
  const bbox = _getCurrentBbox(state);

  if (ambito.id === "espacio") {
    const parquesOv = await _preload(state, "parques");
    const tejidoOv  = await _preload(state, "tejido-social");
    // Parques: contar polígonos globalmente (filtrado fino lo dejamos
    // para v2 — los polys parques no tienen un punto único). El número
    // refleja la oferta total de espacios verdes accesibles.
    let parques = 0;
    if (parquesOv?.isReady()) {
      const polys = parquesOv.getAllParques ? parquesOv.getAllParques() :
                    parquesOv._polys || [];
      parques = polys.length;
    }
    let comunitarios = 0;
    if (tejidoOv?.isReady()) {
      const items = tejidoOv.getAllItems() || [];
      const relevantes = items.filter(i => [
        "espacio_comunitario", "centro_social",
        "huerto_urbano", "biblioteca_popular"
      ].includes(i.properties?.categoria));
      comunitarios = relevantes.filter(i => _inBbox(i.mx, i.mz, bbox)).length;
    }
    return {
      value: comunitarios,
      label: comunitarios === 1 ? "espacio comunitario" : "espacios comunitarios",
      hint: parques > 0 ? `+ ${parques} parques en la isla` : ""
    };
  }

  if (ambito.id === "movilidad") {
    const guaguasOv = await _preload(state, "guaguas");
    let paradas = 0;
    if (guaguasOv?.isReady()) {
      const all = guaguasOv.getAllParadas ? guaguasOv.getAllParadas() : [];
      paradas = all.filter(p => _inBbox(p.mx, p.mz, bbox)).length;
    }
    return {
      value: paradas,
      label: paradas === 1 ? "parada bus" : "paradas bus",
      hint: paradas > 0 ? "cobertura activa LPGC" : "sin servicio actual"
    };
  }

  if (ambito.id === "alimentacion") {
    const prodOv   = await _preload(state, "productores");
    const tejidoOv = await _preload(state, "tejido-social");
    let prods = 0, coops = 0;
    if (prodOv?.isReady()) {
      const all = prodOv.getAllProductores() || [];
      prods = all.filter(p => _inBbox(p.mx, p.mz, bbox)).length;
    }
    if (tejidoOv?.isReady()) {
      const items = tejidoOv.getAllItems() || [];
      coops = items.filter(i =>
        ["cooperativa", "huerto_urbano"].includes(i.properties?.categoria)
        && _inBbox(i.mx, i.mz, bbox)
      ).length;
    }
    const total = prods + coops;
    return {
      value: total,
      label: total === 1 ? "punto cercano" : "puntos cercanos",
      hint: `${prods} productores · ${coops} coop/huerto`
    };
  }

  if (ambito.id === "cultura") {
    const eventosOv = await _preload(state, "eventos");
    const tejidoOv  = await _preload(state, "tejido-social");
    let evts = 0, asoc = 0;
    if (eventosOv?.isReady()) {
      const all = eventosOv.getAllEvents() || [];
      evts = all.filter(e => _inBbox(e.mx, e.mz, bbox)).length;
    }
    if (tejidoOv?.isReady()) {
      const items = tejidoOv.getAllItems() || [];
      asoc = items.filter(i =>
        ["asociacion_cultural", "biblioteca_popular",
         "espacio_comunitario"].includes(i.properties?.categoria)
        && _inBbox(i.mx, i.mz, bbox)
      ).length;
    }
    const total = evts + asoc;
    return {
      value: total,
      label: total === 1 ? "oferta cerca" : "ofertas cerca",
      hint: `${evts} eventos · ${asoc} espacios`
    };
  }

  return { value: "·", label: "", hint: "" };
}

// -----------------------------------------------------------
// Mount + refresh del panel.

let _ctx;
// 2026-05-21 P3 — Handle al UI del popover, expuesto por _mountCards
// para que _renderPopoverDatos (fuera del closure) pueda abrirlo.
let _ui = null;

export function initDashboard(state, ctx) {
  _ctx = ctx;
  const panel = document.getElementById("dashboard");
  if (!panel) return;
  _mountCards(panel);
  refreshDashboard(state);
}

function _escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function _mountCards(panel) {
  const parts = [
    `<header class="db-head">Tablero cívico</header>`
  ];
  for (const a of AMBITOS) {
    parts.push(`
      <article class="db-card" data-id="${_escapeHtml(a.id)}">
        <div class="db-card-head">
          <span class="db-glyph">${_escapeHtml(a.glyph)}</span>
          <div class="db-titles">
            <div class="db-label">${_escapeHtml(a.label)}</div>
            <div class="db-derecho">${_escapeHtml(a.derecho)}</div>
          </div>
        </div>
        <div class="db-metric">
          <span class="db-value" data-key="value">·</span>
          <span class="db-unit" data-key="unit">cargando…</span>
        </div>
        <div class="db-hint" data-key="hint"></div>
        <div class="db-senales">
          <button class="db-senal" data-action="senal-pos" data-id="${_escapeHtml(a.id)}"
                  title="Está bien cuidado">
            ✓ <span data-key="senal-pos">0</span>
          </button>
          <button class="db-senal" data-action="senal-neg" data-id="${_escapeHtml(a.id)}"
                  title="Algo no funciona">
            ✗ <span data-key="senal-neg">0</span>
          </button>
          <span class="db-reportes-count" data-key="reportes">0 reportes</span>
        </div>
        <button class="db-action" data-action="compromiso" type="button" data-id="${_escapeHtml(a.id)}">
          ${_escapeHtml(a.accion.label)} →
        </button>
        <button class="db-action db-secondary" data-action="reporte" type="button" data-id="${_escapeHtml(a.id)}">
          Reportar problema →
        </button>
        <button class="db-action db-secondary" data-action="datos" type="button" data-id="${_escapeHtml(a.id)}">
          Detalles ▾
        </button>
      </article>
    `);
  }
  panel.innerHTML = parts.join("");

  // Bottom-sheet toggle en móvil: tap en el header (que en móvil es el
  // handle visual) alterna .open. En desktop el panel es lateral fijo
  // y la clase .open no afecta visualmente — el header sigue siendo
  // clickable pero no produce cambio.
  // 2026-05-14 v2 — Iconos sueltos con popover individual.
  //   - Click en un icon-card → muestra popover con su título + derecho.
  //   - Click en el MISMO card abierto → cierra.
  //   - Click en OTRO card → cambia popover al nuevo.
  //   - Click fuera (canvas, body, etc.) → cierra.
  //   - Sin panel ".open" global.
  let _popover = document.querySelector(".db-popover");
  if (!_popover) {
    _popover = document.createElement("div");
    _popover.className = "db-popover";
    _popover.setAttribute("aria-hidden", "true");
    document.body.appendChild(_popover);
  }
  let _activeCard = null;

  // Expone el popover a helpers fuera del closure (P3 Detalles).
  _ui = {
    popover: _popover,
    positionFor: (card) => {
      const r = card.getBoundingClientRect();
      _popover.style.top = `${r.top}px`;
      _popover.style.right = `${window.innerWidth - r.left + 8}px`;
      _popover.style.left = "auto";
    },
    open: () => _popover.classList.add("open"),
    close: () => {
      _popover.classList.remove("open");
      if (_activeCard) {
        _activeCard.classList.remove("active");
        _activeCard = null;
      }
    },
    setActive: (card) => {
      if (_activeCard && _activeCard !== card) {
        _activeCard.classList.remove("active");
      }
      if (card) card.classList.add("active");
      _activeCard = card;
    }
  };

  function closePopover() {
    _popover.classList.remove("open");
    if (_activeCard) {
      _activeCard.classList.remove("active");
      _activeCard = null;
    }
  }

  function openPopoverFor(card) {
    const id = card.dataset.id;
    const amb = AMBITOS.find(a => a.id === id);
    if (!amb) return;
    _popover.innerHTML = `
      <div class="pop-titulo">${_escapeHtml(amb.label)}</div>
      <div class="pop-derecho">${_escapeHtml(amb.derecho || "")}</div>
      <div class="pop-hint">Sin contenido todavía · próximamente</div>
    `;
    // Posicionar a la izquierda del icono (right-side strip)
    const r = card.getBoundingClientRect();
    _popover.style.top = `${r.top}px`;
    _popover.style.right = `${window.innerWidth - r.left + 8}px`;
    _popover.style.left = "auto";
    _popover.classList.add("open");
    if (_activeCard && _activeCard !== card) _activeCard.classList.remove("active");
    card.classList.add("active");
    _activeCard = card;
  }

  panel.addEventListener("click", (e) => {
    const card = e.target.closest(".db-card");
    if (!card) return;
    // Si el click viene de un botón interior (señal/reporte/compromiso),
    // dejar que el segundo listener lo maneje y NO togglear el card.
    if (e.target.closest("[data-action]")) return;
    const id = card.dataset.id;
    const overlayId = AMBITO_TO_OVERLAY[id];
    if (overlayId && _ctx?.getState) {
      const state = _ctx.getState();
      const on = !state.activeOverlays?.[overlayId];
      setOverlayActive(state, overlayId, on);
      card.classList.toggle("layer-on", on);
      closePopover();
      e.stopPropagation();
      return;
    }
    // Ámbito sin overlay primario (futuro patrimonio etc.): popover dummy.
    if (card === _activeCard) {
      closePopover();
    } else {
      openPopoverFor(card);
    }
    e.stopPropagation();
  });

  // Click-away: cierra si el target no es popover ni card del dashboard
  document.addEventListener("click", (e) => {
    if (!_popover.classList.contains("open")) return;
    if (e.target.closest(".db-popover")) return;
    if (e.target.closest(".dashboard .db-card")) return;
    closePopover();
  });

  // Esc también cierra
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && _popover.classList.contains("open")) {
      closePopover();
    }
  });

  // Delegación: click en acción abre el popup correspondiente o
  // registra señal binaria. Las señales son 1-click anónimas; reporte
  // y compromiso abren popups.
  panel.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const amb = AMBITOS.find(a => a.id === id);
    if (!amb) return;
    if (action === "senal-pos" || action === "senal-neg") {
      _registrarSenal(amb, action === "senal-pos" ? 1 : -1);
    } else if (action === "reporte" && _ctx?.openReporte) {
      _ctx.openReporte(amb);
    } else if (action === "compromiso" && _ctx?.openCompromiso) {
      _ctx.openCompromiso(amb);
    } else if (action === "datos") {
      const card = btn.closest(".db-card");
      _renderPopoverDatos(amb, card, _ctx?.getState?.());
    }
  });
}

function _zonaActual(state) {
  if (state.lodLevel === "distrito") return state.district?.distritoId;
  if (state.lodLevel === "municipio") return state.municipio?.mun;
  if (state.lodLevel === "seccion") return state.section?.meta?.cusec;
  return "isla";
}

function _registrarSenal(ambito, valor) {
  if (!_ctx?.getState) return;
  const state = _ctx.getState();
  recordGesto("senal", { ambito: ambito.id, valor }, _zonaActual(state));
  // Refresh local de los contadores de señal en este card.
  _refreshSenales(state);
}

function _refreshSenales(state) {
  const zona = _zonaActual(state);
  for (const a of AMBITOS) {
    const card = document.querySelector(`.db-card[data-id="${a.id}"]`);
    if (!card) continue;
    const { pos, neg } = getSenalesAggregadas(a.id, zona);
    const reportes = getReportesCount(a.id, zona);
    const elPos = card.querySelector('[data-key="senal-pos"]');
    const elNeg = card.querySelector('[data-key="senal-neg"]');
    const elRep = card.querySelector('[data-key="reportes"]');
    if (elPos) elPos.textContent = pos;
    if (elNeg) elNeg.textContent = neg;
    if (elRep) elRep.textContent =
      reportes === 1 ? "1 reporte" : `${reportes} reportes`;
  }
}

export async function refreshDashboard(state) {
  for (const a of AMBITOS) {
    let metric;
    try {
      metric = await _computeMetric(a, state);
    } catch (e) {
      console.warn(`[dashboard] métrica ${a.id} fallo:`, e);
      metric = { value: "—", label: "no disponible", hint: "" };
    }
    const card = document.querySelector(`.db-card[data-id="${a.id}"]`);
    if (!card) continue;
    card.querySelector('[data-key="value"]').textContent = metric.value;
    card.querySelector('[data-key="unit"]').textContent = metric.label;
    card.querySelector('[data-key="hint"]').textContent = metric.hint || "";
  }
  // Después de la métrica del dataset, actualizar contadores de gestos
  // por zona (anónimos, agregados, persistidos localmente).
  _refreshSenales(state);
}

// -----------------------------------------------------------
// API auxiliar: activar las capas asociadas a un ámbito (modo
// "destacar este ámbito en el mapa"). Útil si añadimos un long-tap o
// hover sobre la card que enciende las capas relacionadas.

export async function activarCapasAmbito(state, ambitoId) {
  const amb = AMBITOS.find(a => a.id === ambitoId);
  if (!amb) return;
  for (const capa of amb.capas) {
    await setOverlayActive(state, capa, true);
  }
}

// -----------------------------------------------------------
// 2026-05-21 P3 — "Detalles ▾": popover con datos canónicos del LOD
// activo. No es métrica resumida (esa ya vive en .db-metric) sino una
// lista de líneas label/value adaptadas al nivel:
//   - archipielago: cifras totales (todas las islas)
//   - isla:         filtrado por bbox de la isla + manifest entidades
//   - municipio:    filtrado por bbox del municipio
//   - barrio:       datos canónicos del propio barrio (barrios-canonical)
// Distrito y sección caen al fallback "por bbox" del municipio (no hay
// canonical dedicado para distrito; sección ya tiene su propio popup).

// Categorías de cooperativismo / huerto / mercadillo agrupadas como
// "soberanía alimentaria" en el ámbito alimentación.
const _ALIM_TEJIDO_CATS = new Set(["cooperativa", "huerto_urbano"]);
// Tejido social que cuenta como cultura.
const _CULT_TEJIDO_CATS = new Set([
  "asociacion_cultural", "biblioteca_popular", "espacio_comunitario",
  "centro_social"
]);

function _countInBbox(items, bbox) {
  if (!items) return 0;
  if (!bbox) return items.length;
  let n = 0;
  for (const it of items) {
    if (_inBbox(it.mx, it.mz, bbox)) n++;
  }
  return n;
}

function _next7Days(events) {
  if (!events) return 0;
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const limit = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);
  let n = 0;
  for (const e of events) {
    const f = e.properties?.fecha;
    if (!f) continue;
    if (f >= todayStr && f <= limit) n++;
  }
  return n;
}

async function _getStatsForAmbito(ambitoId, state) {
  if (!state) return { titulo: ambitoId, lineas: [{ label: "estado", value: "no disponible" }] };
  const lod = state.lodLevel || "archipielago";
  const bbox = _getCurrentBbox(state); // null en archipielago
  const titulo = (AMBITOS.find(a => a.id === ambitoId)?.label) || ambitoId;
  const lineas = [];

  // BARRIO — usa datos canónicos del barrio (no overlays).
  if (lod === "barrio" && state.barrio) {
    const b = state.barrio;
    const munMeta = state.barriosGc?.barrios?.[b.barrioId];
    const datos = munMeta?.datos || {};
    lineas.push({ label: "barrio", value: b.name || b.barrioId });
    if (ambitoId === "espacio") {
      lineas.push({ label: "puntos de interés", value: datos.pois_total ?? "—" });
      lineas.push({ label: "edificios", value: (datos.edificios ?? "—").toLocaleString?.("es") || datos.edificios });
      if (datos.area_ha) lineas.push({ label: "superficie", value: `${datos.area_ha} ha` });
    } else if (ambitoId === "movilidad") {
      lineas.push({ label: "paradas guaguas", value: datos.paradas_guaguas ?? 0 });
      // Sumamos info ad-hoc desde el overlay si está cargado.
      const guaguasOv = state._overlayRegistry?.get("guaguas");
      if (guaguasOv?.isReady?.()) {
        const lin = guaguasOv.getAllLineas ? guaguasOv.getAllLineas().length : 0;
        if (lin) lineas.push({ label: "líneas en isla", value: lin });
      }
    } else if (ambitoId === "alimentacion") {
      const prodOv   = state._overlayRegistry?.get("productores");
      const tejidoOv = state._overlayRegistry?.get("tejido-social");
      const prods = prodOv?.isReady?.()
        ? _countInBbox(prodOv.getAllProductores(), bbox) : 0;
      const coops = tejidoOv?.isReady?.()
        ? (tejidoOv.getAllItems() || []).filter(i =>
            _ALIM_TEJIDO_CATS.has(i.properties?.categoria)
            && _inBbox(i.mx, i.mz, bbox)).length : 0;
      lineas.push({ label: "productores cerca", value: prods });
      lineas.push({ label: "coop/huertos", value: coops });
    } else if (ambitoId === "cultura") {
      const eventosOv = state._overlayRegistry?.get("eventos");
      const tejidoOv  = state._overlayRegistry?.get("tejido-social");
      const evts = eventosOv?.isReady?.()
        ? _countInBbox(eventosOv.getAllEvents(), bbox) : 0;
      const tej = tejidoOv?.isReady?.()
        ? (tejidoOv.getAllItems() || []).filter(i =>
            _CULT_TEJIDO_CATS.has(i.properties?.categoria)
            && _inBbox(i.mx, i.mz, bbox)).length : 0;
      lineas.push({ label: "eventos cerca", value: evts });
      lineas.push({ label: "espacios cult.", value: tej });
      lineas.push({ label: "centros educativos", value: datos.centros_educativos ?? "—" });
    }
    return { titulo, lineas };
  }

  // Para archipi/isla/mun/distrito/seccion usamos overlays + bbox.
  // Sólo cargamos lo que el ámbito necesita.
  if (ambitoId === "espacio") {
    const parquesOv = await _preload(state, "parques");
    const tejidoOv  = await _preload(state, "tejido-social");
    let parques = 0, comunitarios = 0;
    if (parquesOv?.isReady()) {
      const polys = parquesOv.getAllParques
        ? parquesOv.getAllParques() : (parquesOv._polys || []);
      parques = polys.length; // bbox no útil (parques no tienen mx/mz simple)
    }
    if (tejidoOv?.isReady()) {
      const items = tejidoOv.getAllItems() || [];
      comunitarios = items.filter(i =>
        ["espacio_comunitario", "centro_social",
         "huerto_urbano", "biblioteca_popular"]
          .includes(i.properties?.categoria)
        && _inBbox(i.mx, i.mz, bbox)
      ).length;
    }
    if (lod === "archipielago") {
      lineas.push({ label: "parques OSM (GC)", value: parques });
      lineas.push({ label: "espacios comunitarios", value: comunitarios });
    } else if (lod === "isla") {
      lineas.push({ label: "espacios comunitarios", value: comunitarios });
      lineas.push({ label: "parques OSM (GC)", value: parques,
                    hint: "datos parques sólo en GC" });
    } else { // municipio/distrito/seccion
      lineas.push({ label: "espacios comunitarios", value: comunitarios });
      lineas.push({ label: "parques (isla)", value: parques });
    }
    return { titulo, lineas };
  }

  if (ambitoId === "movilidad") {
    const guaguasOv = await _preload(state, "guaguas");
    let paradas = 0, lineasN = 0;
    if (guaguasOv?.isReady()) {
      paradas = _countInBbox(guaguasOv.getAllParadas
        ? guaguasOv.getAllParadas() : [], bbox);
      lineasN = guaguasOv.getAllLineas ? guaguasOv.getAllLineas().length : 0;
    }
    if (lod === "archipielago") {
      lineas.push({ label: "paradas guaguas (GC)", value: paradas });
      lineas.push({ label: "líneas guaguas", value: lineasN });
    } else if (lod === "isla") {
      lineas.push({ label: "paradas en isla", value: paradas });
      lineas.push({ label: "líneas guaguas", value: lineasN,
                    hint: "datos guaguas sólo en GC" });
    } else {
      lineas.push({ label: "paradas cerca", value: paradas });
      lineas.push({ label: "líneas (isla)", value: lineasN });
    }
    return { titulo, lineas };
  }

  if (ambitoId === "alimentacion") {
    const prodOv   = await _preload(state, "productores");
    const tejidoOv = await _preload(state, "tejido-social");
    let prods = 0, mercadillos = 0, coops = 0;
    const oficios = {};
    if (prodOv?.isReady()) {
      const all = prodOv.getAllProductores() || [];
      for (const p of all) {
        if (!_inBbox(p.mx, p.mz, bbox)) continue;
        const of = p.properties?.oficio || "otro";
        if (of === "mercadillo") mercadillos++;
        else { prods++; oficios[of] = (oficios[of] || 0) + 1; }
      }
    }
    if (tejidoOv?.isReady()) {
      const items = tejidoOv.getAllItems() || [];
      coops = items.filter(i =>
        _ALIM_TEJIDO_CATS.has(i.properties?.categoria)
        && _inBbox(i.mx, i.mz, bbox)
      ).length;
    }
    if (lod === "archipielago" || lod === "isla") {
      lineas.push({ label: "productores", value: prods });
      lineas.push({ label: "mercadillos", value: mercadillos });
      lineas.push({ label: "cooperativas/huertos", value: coops });
      // Top 2 oficios para dar color.
      const top = Object.entries(oficios).sort((a, b) => b[1] - a[1]).slice(0, 2);
      for (const [k, v] of top) {
        lineas.push({ label: `· ${k}`, value: v });
      }
    } else {
      lineas.push({ label: "productores cerca", value: prods });
      if (mercadillos) lineas.push({ label: "mercadillos", value: mercadillos });
      lineas.push({ label: "coop/huertos cerca", value: coops });
    }
    return { titulo, lineas };
  }

  if (ambitoId === "cultura") {
    const eventosOv = await _preload(state, "eventos");
    const tejidoOv  = await _preload(state, "tejido-social");
    let evts = 0, asoc = 0, prox7 = 0;
    if (eventosOv?.isReady()) {
      const allEv = (eventosOv.getAllEvents() || [])
        .filter(e => _inBbox(e.mx, e.mz, bbox));
      evts = allEv.length;
      prox7 = _next7Days(allEv);
    }
    if (tejidoOv?.isReady()) {
      const items = tejidoOv.getAllItems() || [];
      asoc = items.filter(i =>
        _CULT_TEJIDO_CATS.has(i.properties?.categoria)
        && _inBbox(i.mx, i.mz, bbox)
      ).length;
    }
    lineas.push({ label: "eventos próximos", value: evts });
    if (prox7) lineas.push({ label: "· en 7 días", value: prox7 });
    lineas.push({ label: "asoc. culturales", value: asoc });
    // Entidades manifest — sólo en archipi/isla.
    if (lod === "archipielago" || lod === "isla") {
      const manifest = await _ensureEntidadesManifest(state);
      const files = manifest?.files || {};
      if (lod === "archipielago") {
        let total = 0;
        for (const k of Object.keys(files)) total += files[k].count || 0;
        lineas.push({ label: "entidades (todas islas)",
                      value: total.toLocaleString("es") });
        // Desglose top 3.
        const sorted = Object.entries(files)
          .sort((a, b) => (b[1].count || 0) - (a[1].count || 0))
          .slice(0, 3);
        for (const [isl, info] of sorted) {
          lineas.push({ label: `· ${isl}`,
                        value: (info.count || 0).toLocaleString("es") });
        }
      } else { // isla concreta
        const isl = state.isla?.id;
        const info = isl ? files[isl] : null;
        if (info) {
          lineas.push({ label: `entidades en ${isl}`,
                        value: (info.count || 0).toLocaleString("es") });
        }
      }
    }
    return { titulo, lineas };
  }

  return { titulo, lineas: [{ label: "—", value: "sin datos" }] };
}

function _renderPopoverDatos(amb, card, state) {
  if (!_ui || !card) return;
  // Header inicial mientras se cargan los datasets (puede ser async).
  _ui.popover.innerHTML = `
    <div class="pop-titulo">${_escapeHtml(amb.label)}</div>
    <div class="pop-derecho">${_escapeHtml(amb.derecho || "")}</div>
    <div class="pop-hint">cargando datos…</div>
  `;
  _ui.positionFor(card);
  _ui.open();
  _ui.setActive(card);

  _getStatsForAmbito(amb.id, state).then(stats => {
    const linesHtml = (stats.lineas || []).map(l => {
      const val = l.value == null ? "—" : l.value;
      const hint = l.hint
        ? `<div class="pop-line-hint">${_escapeHtml(l.hint)}</div>` : "";
      return `<div class="pop-line">
        <span class="pop-line-label">${_escapeHtml(l.label)}</span>
        <span class="pop-line-value">${_escapeHtml(val)}</span>
      </div>${hint}`;
    }).join("");
    _ui.popover.innerHTML = `
      <div class="pop-titulo">${_escapeHtml(stats.titulo || amb.label)}</div>
      <div class="pop-derecho">${_escapeHtml(amb.derecho || "")}</div>
      <div class="pop-lines">${linesHtml}</div>
    `;
    // Re-posiciona por si la altura cambió.
    _ui.positionFor(card);
  }).catch(err => {
    console.warn(`[dashboard] datos ${amb.id} fallaron:`, err);
    _ui.popover.innerHTML = `
      <div class="pop-titulo">${_escapeHtml(amb.label)}</div>
      <div class="pop-derecho">${_escapeHtml(amb.derecho || "")}</div>
      <div class="pop-hint">no se pudieron cargar los datos</div>
    `;
  });
}
