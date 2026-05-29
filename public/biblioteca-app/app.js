// biblioteca-app/app.js — Orquestador de la UI.
//
// Responsabilidades:
//   - Cargar items (data.js) y persistir estado en localStorage.
//   - Re-rankear el feed cuando cambian sliders, misiones o último tema visto.
//   - Pintar sliders, feed, panel de misiones, honesty meter.
//   - Abrir modales de "nueva misión" / "nueva síntesis" / onboarding.
//   - Emitir gestos en los puntos canónicos (compromiso, compromiso_cumplido,
//     sintesis).
//
// Diseño: una sola fuente de verdad (`state`), funciones puras de render
// que leen el state y vuelcan al DOM. Cualquier mutación pasa por
// helpers (setSlider, addMision, cerrarMision, addSintesis) que tocan
// localStorage y disparan render() de la sección afectada.

import { recordGesto, getUserId, getAllGestos } from "../shared/gestos.js?v=20260527a";
import { rank } from "../shared/rank.js?v=20260527a";
import { mountHud, HUD_CSS } from "../shared/hud.js?v=20260527a";
import { honestyMeter } from "../shared/loops.js?v=20260527a";

import { cargarItems, mapearDims, stripHtml } from "./data.js?v=20260527a";

// Módulos masa crítica (v3).
import {
  loadSillasConocimiento, renderSillaConocimientoCard
} from "./sillas-conocimiento.js?v=20260527d";
import {
  loadQuorumsLectura, crearQuorumLectura, firmarQuorumLectura, renderQuorumLecturaCard
} from "./quorums-lectura.js?v=20260527d";
import { abrirPulsoPalacios } from "./pulso-palacios.js?v=20260527d";
import { registrarSintesis, reconciliarTokens, renderTokensBlock } from "./tokens.js?v=20260527d";
import { abrirDescubre } from "./descubre.js?v=20260527g";
import { mountNavbar } from "../shared/navbar.js?v=20260527h";

// ─────────────────── CONSTANTES ───────────────────

const DIMS_META = {
  dominio:    { label: "Profundidad", polos: ["dominio", "frontera"] },
  canonico:   { label: "Voz",         polos: ["canónico", "crítico"] },
  compania:   { label: "Compañía",    polos: ["solitario", "compartido"] },
  navegacion: { label: "Navegación",  polos: ["vertical", "horizontal"] }
};
const DIMS_ORDEN = ["dominio", "canonico", "compania", "navegacion"];

const DEFAULT_SLIDERS = {
  dominio: 0,
  canonico: +0.6,   // default = crítico (cultivo)
  compania: 0,
  navegacion: +0.6  // default = horizontal (cultivo)
};

const KEY_SLIDERS  = "biblioteca-sliders";
const KEY_MISIONES = "biblioteca-misiones";
const KEY_ULTIMO   = "biblioteca-ultimo-tema";

const PAGE_SIZE = 12;

// ─────────────────── ESTADO ───────────────────

const state = {
  items: [],          // cargados de data.js
  sliders: cargarSliders(),
  misiones: cargarMisiones(),
  ultimoTema: cargarUltimoTema(),
  page: 0,
  ranked: []          // último resultado de rank()
};

function cargarSliders() {
  try {
    const raw = localStorage.getItem(KEY_SLIDERS);
    if (!raw) return { ...DEFAULT_SLIDERS };
    const parsed = JSON.parse(raw);
    // sanea: mantener sólo claves conocidas
    const out = { ...DEFAULT_SLIDERS };
    for (const k of DIMS_ORDEN) {
      if (typeof parsed[k] === "number") out[k] = clamp(parsed[k], -1, 1);
    }
    return out;
  } catch { return { ...DEFAULT_SLIDERS }; }
}
function guardarSliders() {
  try { localStorage.setItem(KEY_SLIDERS, JSON.stringify(state.sliders)); } catch { /**/ }
}
function cargarMisiones() {
  try {
    const raw = localStorage.getItem(KEY_MISIONES);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function guardarMisiones() {
  try { localStorage.setItem(KEY_MISIONES, JSON.stringify(state.misiones)); } catch { /**/ }
}
function cargarUltimoTema() {
  try { return localStorage.getItem(KEY_ULTIMO) || null; } catch { return null; }
}
function guardarUltimoTema(t) {
  state.ultimoTema = t;
  try {
    if (t) localStorage.setItem(KEY_ULTIMO, t);
    else localStorage.removeItem(KEY_ULTIMO);
  } catch { /**/ }
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ─────────────────── RE-RANK + RENDER ───────────────────

function reRank() {
  const itemsConDims = mapearDims(state.items, state.ultimoTema);
  const estado = {
    sliders: state.sliders,
    misiones: state.misiones.map(m => m.id),
    dimsMeta: DIMS_META
  };
  state.ranked = rank(estado, itemsConDims);
  renderFeed();
}

// ─────────────────── SLIDERS ───────────────────

function renderSliders() {
  const root = document.getElementById("sliders");
  root.innerHTML = `<div class="sliders-title">Algoritmo</div>`;
  for (const dimId of DIMS_ORDEN) {
    const meta = DIMS_META[dimId];
    const val = state.sliders[dimId];
    const block = document.createElement("div");
    block.className = "slider-block";
    block.innerHTML = `
      <div class="polo top">${meta.polos[1]}</div>
      <input type="range" min="-1" max="1" step="0.05"
             value="${val}" data-dim="${dimId}"
             aria-label="${meta.label}: ${meta.polos[0]} a ${meta.polos[1]}">
      <div class="polo bottom">${meta.polos[0]}</div>
      <div class="valor" data-dim-val="${dimId}">${val.toFixed(2)}</div>
    `;
    const input = block.querySelector("input");
    input.addEventListener("input", e => {
      const v = clamp(parseFloat(e.target.value), -1, 1);
      state.sliders[dimId] = v;
      block.querySelector(`[data-dim-val="${dimId}"]`).textContent = v.toFixed(2);
      guardarSliders();
      reRank();
    });
    root.appendChild(block);
  }
}

// ─────────────────── FEED ───────────────────

function renderFeed() {
  const root = document.getElementById("feed");
  const stats = document.getElementById("feed-stats");
  const empty = document.getElementById("feed-empty");
  const total = state.ranked.length;
  const desde = state.page * PAGE_SIZE;
  const hasta = Math.min(desde + PAGE_SIZE, total);

  stats.textContent = total > 0
    ? `${desde + 1}–${hasta} de ${total}`
    : "sin items";

  root.innerHTML = "";

  if (total === 0) {
    if (empty) {
      empty.hidden = false;
      renderEmptyInvite(empty);
    }
    return;
  } else if (empty) {
    empty.hidden = true;
    empty.innerHTML = "";
  }

  for (let i = desde; i < hasta; i++) {
    const res = state.ranked[i];
    const item = res.item;
    const kind = item?.kind;
    let card;

    // Dispatch por kind: sillas y quórums llevan render custom; el
    // resto sigue el flujo clásico de epígrafes mnemoHACK.
    if (kind === "silla_epigrafe" || kind === "silla_fuente") {
      card = renderSillaConocimientoCard(item, {
        onEmpezar: (p) => onSillaEmpezar(p),
        onSintetizarCon: (p) => onSillaSintetizarCon(p)
      });
    } else if (kind === "quorum_lectura") {
      card = renderQuorumLecturaCard(item, {
        onFirmar: (p) => {
          const ok = firmarQuorumLectura(p.payload?.quorum_id);
          if (!ok) alert("Ya habías firmado esta lectura.");
          recargarFeed();
        },
        onCompartir: (p) => {
          const url = `${location.origin}${location.pathname}#ql=${encodeURIComponent(p.payload?.quorum_id || "")}`;
          navigator.clipboard?.writeText(url).catch(() => {});
          alert("Enlace copiado.\n" + url);
        }
      });
    } else {
      // Render clásico mnemoHACK
      const isMision = res.score === Infinity;
      card = document.createElement("article");
      card.className = "card collapsed" + (isMision ? " is-mision" : "");
      if (!isMision) {
        const grosor = clamp(2 + Math.abs(res.score) * 6, 2, 8);
        card.style.borderLeftWidth = grosor.toFixed(1) + "px";
      }
      const scoreTxt = isMision ? "misión" : res.score.toFixed(2);
      card.innerHTML = `
        <div class="card-meta">
          <span class="card-id">${item.tema_id} / ${item.epi_id}</span>
          <span class="card-score">${scoreTxt}</span>
        </div>
        <div class="card-body"></div>
        <div class="card-toggle">▾ desplegar</div>
      `;
      const body = card.querySelector(".card-body");
      body.textContent = stripHtml(item.resumen_html, 300);
      const toggle = card.querySelector(".card-toggle");
      toggle.addEventListener("click", () => {
        const colapsado = card.classList.contains("collapsed");
        if (colapsado) {
          body.innerHTML = item.resumen_html;
          card.classList.remove("collapsed");
          toggle.textContent = "▴ plegar";
          if (item.tema_id !== state.ultimoTema) {
            guardarUltimoTema(item.tema_id);
            setTimeout(reRank, 50);
          }
        } else {
          body.textContent = stripHtml(item.resumen_html, 300);
          card.classList.add("collapsed");
          toggle.textContent = "▾ desplegar";
        }
      });
    }

    // HUD universal: lo monta el dispatcher si el renderer custom dejó
    // un `.post-hud` vacío; si no, lo montamos en `.card-meta`.
    const hudSlot = card.querySelector(".post-hud") || card.querySelector(".card-meta");
    if (hudSlot && (!hudSlot.classList.contains("post-hud") || hudSlot.childElementCount === 0)) {
      if (hudSlot.classList.contains("post-hud") || !hudSlot.querySelector(".hud-razon")) {
        mountHud(hudSlot, res, DIMS_META);
      }
    }

    root.appendChild(card);
  }

  // Pager
  const pager = document.createElement("div");
  pager.className = "feed-pager";
  if (total > PAGE_SIZE) {
    if (state.page > 0) {
      const btn = document.createElement("button");
      btn.textContent = "‹ anteriores";
      btn.addEventListener("click", () => { state.page--; renderFeed(); window.scrollTo(0,0); });
      pager.appendChild(btn);
    }
    if (hasta < total) {
      const btn = document.createElement("button");
      btn.textContent = "siguientes 12 ›";
      btn.style.marginLeft = "0.6em";
      btn.addEventListener("click", () => { state.page++; renderFeed(); window.scrollTo(0,0); });
      pager.appendChild(btn);
    }
  }
  root.appendChild(pager);
}

// ─────────────────── MISIONES ───────────────────

function addMision(titulo, descripcion, itemRef) {
  const id = "m_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const mision = {
    id,
    titulo: titulo.trim(),
    descripcion: (descripcion || "").trim(),
    item_ref: itemRef || null,
    ts_creado: new Date().toISOString()
  };
  state.misiones.push(mision);
  guardarMisiones();
  // Emitir gesto "compromiso" — esto es lo que abre el bucle para el
  // honesty meter. compromiso_cumplido referenciará el ts del gesto
  // (no el id de misión local) — usamos el mismo id que la misión
  // como payload.id por si alguien filtra por id explícito.
  recordGesto("compromiso", {
    id: mision.id,
    texto: mision.titulo + (mision.descripcion ? " — " + mision.descripcion : ""),
    item_ref: mision.item_ref,
    fuente_app: "biblioteca"
  });
  renderMisiones();
  renderHonesty();
  reRank();
  return mision;
}

function cerrarMision(misionId, nota) {
  const idx = state.misiones.findIndex(m => m.id === misionId);
  if (idx === -1) return false;
  const mision = state.misiones[idx];
  // Para que el honesty meter empareje, compromiso_cumplido.compromiso_ref
  // debe coincidir con el TS del gesto compromiso (así lo busca
  // honestyMeter en shared/loops.js). Buscamos el gesto correspondiente.
  const gestos = getAllGestos();
  const compromisoGesto = gestos
    .filter(g => g.tipo === "compromiso" && g.payload?.id === misionId)
    .sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts))[0];
  const ref = compromisoGesto ? compromisoGesto.ts : misionId;

  recordGesto("compromiso_cumplido", {
    compromiso_ref: ref,
    nota: (nota || "").trim() || null,
    titulo: mision.titulo,
    fuente_app: "biblioteca"
  });

  state.misiones.splice(idx, 1);
  guardarMisiones();
  renderMisiones();
  renderHonesty();
  reRank();
  return true;
}

function renderMisiones() {
  const root = document.getElementById("mision-list");
  root.innerHTML = "";
  const visibles = state.misiones.slice(0, 5);
  for (const m of visibles) {
    const item = document.createElement("div");
    item.className = "mision-item";
    item.innerHTML = `
      <div class="mision-title"></div>
      <div class="mision-meta"></div>
      <div class="mision-actions">
        <button class="primary" data-act="cerrar">✓ Cerrada</button>
      </div>
    `;
    item.querySelector(".mision-title").textContent = m.titulo;
    item.querySelector(".mision-meta").textContent = tiempoDesde(m.ts_creado);
    item.querySelector("[data-act=cerrar]").addEventListener("click", () => {
      const nota = prompt("Nota opcional sobre el cierre (qué hiciste, qué aprendiste):", "");
      if (nota === null) return; // cancelado
      cerrarMision(m.id, nota);
    });
    root.appendChild(item);
  }
  if (state.misiones.length > 5) {
    const mas = document.createElement("div");
    mas.style.cssText = "font-size:0.75em;color:var(--text-faint);font-style:italic;text-align:center;margin-top:0.5em;";
    mas.textContent = `+${state.misiones.length - 5} más (ocultas)`;
    root.appendChild(mas);
  }
}

function tiempoDesde(isoTs) {
  const t = Date.parse(isoTs);
  if (!Number.isFinite(t)) return "";
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "hace un momento";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `hace ${d} d`;
  return new Date(t).toLocaleDateString();
}

// ─────────────────── HONESTY ───────────────────

function renderHonesty() {
  const root = document.getElementById("honesty");
  // Filtramos sólo gestos de esta app (fuente_app === "biblioteca")
  // para que el meter sea local a Biblioteca y no se mezcle con
  // compromisos de POLIS/Ágora. Si el campo no existe en gestos
  // antiguos, los excluimos también (no contaminamos).
  const todos = getAllGestos();
  const miosBiblioteca = todos.filter(g => g.payload?.fuente_app === "biblioteca");
  const m = honestyMeter(miosBiblioteca, 30);

  root.className = "honesty " + (m.banda === "verde" ? "verde" : "ambar");
  let texto;
  let hint = "";
  if (m.ratio === null) {
    texto = "0 / 0 cerradas";
    hint = "Sin misiones aún en ventana 30d.";
  } else {
    const pct = Math.round(m.ratio * 100);
    texto = `${m.cerradas} / ${m.abiertas} (${pct}%)`;
    if (m.banda === "verde") {
      hint = "sano · 50-75% es señal de compromisos calibrados.";
    } else if (m.ratio < 0.5) {
      hint = "ámbar · más promesas que cierres. Revisa.";
    } else {
      hint = "ámbar · ratio alto. ¿Quizás te comprometes a poco?";
    }
  }
  root.innerHTML = `
    <div class="honesty-label">Honesty · 30d</div>
    <div class="honesty-row">
      <span class="dot"></span>
      <span class="honesty-text">${texto}</span>
    </div>
    <div class="honesty-hint">${hint}</div>
  `;
}

// ─────────────────── MODALES ───────────────────

function abrirModal({ titulo, intro, contenidoHtml, onMount, dismissable = true }) {
  const back = document.createElement("div");
  back.className = "modal-backdrop";
  back.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <h3>${titulo}</h3>
      ${intro ? `<p class="modal-intro">${intro}</p>` : ""}
      <div class="modal-body"></div>
    </div>
  `;
  const body = back.querySelector(".modal-body");
  body.innerHTML = contenidoHtml;

  function cerrar() { back.remove(); }
  if (dismissable) {
    back.addEventListener("click", e => { if (e.target === back) cerrar(); });
  }
  document.body.appendChild(back);
  if (onMount) onMount(body, cerrar);
  return { back, cerrar };
}

// Modal: nueva misión.
function abrirModalNuevaMision({ forzado = false } = {}) {
  // Selector opcional de tema/epígrafe asociado: los items ya están
  // cargados, así que listamos temas únicos y, dentro de cada tema,
  // los epígrafes.
  const temas = [...new Set(state.items.map(i => i.tema_id))].sort();
  const optsTema = temas.map(t => `<option value="${t}">${t}</option>`).join("");

  const html = `
    <div class="field">
      <label for="m-titulo">Título</label>
      <input id="m-titulo" maxlength="120" required
             placeholder="Ej: comparar Rawls y Pettit en 1 página">
    </div>
    <div class="field">
      <label for="m-desc">Descripción (opcional)</label>
      <textarea id="m-desc" maxlength="500"
                placeholder="Qué quieres conseguir, qué consideras un cierre real"></textarea>
    </div>
    <div class="field">
      <label for="m-tema">Tema asociado (opcional)</label>
      <select id="m-tema"><option value="">— ninguno —</option>${optsTema}</select>
    </div>
    <div class="modal-actions">
      ${forzado ? "" : '<button data-act="cancelar">Cancelar</button>'}
      <button class="primary" data-act="guardar">Crear misión</button>
    </div>
    <div class="modal-error" hidden></div>
  `;
  const intro = forzado
    ? "Para empezar, formula al menos UNA misión. Esta app no funciona sin objetivos — el feed es un medio, no un fin."
    : "Una misión es un compromiso contigo. La app la fija arriba del feed hasta que la cierres.";
  const { cerrar } = abrirModal({
    titulo: forzado ? "Antes de empezar" : "Nueva misión",
    intro,
    contenidoHtml: html,
    dismissable: !forzado,
    onMount: (body, cerrarModal) => {
      const $t = body.querySelector("#m-titulo");
      const $d = body.querySelector("#m-desc");
      const $tema = body.querySelector("#m-tema");
      const $err = body.querySelector(".modal-error");
      $t.focus();

      body.querySelector('[data-act="guardar"]').addEventListener("click", () => {
        const titulo = $t.value.trim();
        if (titulo.length < 3) {
          $err.textContent = "El título debe tener al menos 3 caracteres.";
          $err.hidden = false;
          return;
        }
        addMision(titulo, $d.value, $tema.value || null);
        cerrarModal();
      });
      const cancelBtn = body.querySelector('[data-act="cancelar"]');
      if (cancelBtn) cancelBtn.addEventListener("click", cerrarModal);
    }
  });
  return cerrar;
}

// Modal: nueva síntesis (G2). Valida ≥2 fuentes y ≥1 canónica + ≥1 crítica.
function abrirModalSintesis() {
  // Opciones canónicas: temas/epígrafes cargados.
  const optsCanon = state.items.map(i =>
    `<option value="${i.id}">${i.tema_id} / ${i.epi_id} — ${escapeHtml(stripHtml(i.resumen_html, 60))}</option>`
  ).join("");

  const html = `
    <div class="field">
      <label for="s-titulo">Título</label>
      <input id="s-titulo" maxlength="120"
             placeholder="Tu tesis en una línea">
    </div>
    <div class="field">
      <label for="s-texto">Texto</label>
      <textarea id="s-texto" maxlength="1000" style="min-height:8em;"
                placeholder="Tu síntesis. Mínimo: cruza al menos 2 fuentes — 1 canónica + 1 crítica."></textarea>
    </div>
    <div class="field">
      <label>Fuentes citadas (mín. 2 · 1 canónica + 1 crítica)</label>
      <div class="fuentes-list" id="s-fuentes"></div>
      <div class="fuentes-add">
        <button data-act="add-canon">+ canónica</button>
        <button data-act="add-critica">+ crítica</button>
        <button data-act="add-externa">+ externa</button>
      </div>
      <div class="fuentes-hint">
        Canónicas: epígrafes de /data/biblioteca (dropdown).
        Críticas/externas: id libre (cita o URL).
        TODO post-MVP: integración real con LIBROS / NotebookLM.
      </div>
    </div>
    <div class="modal-actions">
      <button data-act="cancelar">Cancelar</button>
      <button class="primary" data-act="guardar">Guardar síntesis</button>
    </div>
    <div class="modal-error" hidden></div>
    <div class="modal-ok" hidden></div>
  `;
  abrirModal({
    titulo: "Nueva síntesis (G2)",
    intro: "Cuenta como cierre de ciclo G2: destilas voces dispares en una pieza única. La app valida que cruces al menos 1 canónica + 1 crítica.",
    contenidoHtml: html,
    onMount: (body, cerrarModal) => {
      const $fuentes = body.querySelector("#s-fuentes");
      const $err = body.querySelector(".modal-error");
      const $ok  = body.querySelector(".modal-ok");

      function pintarFila(origen) {
        const row = document.createElement("div");
        row.className = "fuente-row";
        row.dataset.origen = origen;
        if (origen === "canonico") {
          row.innerHTML = `
            <select data-id>
              <option value="">— elige epígrafe canónico —</option>
              ${optsCanon}
            </select>
            <select data-origen>
              <option value="canonico" selected>canónico</option>
              <option value="critico">crítico</option>
              <option value="externo">externo</option>
            </select>
            <button data-act="del">×</button>
          `;
        } else {
          row.innerHTML = `
            <input data-id type="text" maxlength="200"
                   placeholder="${origen === 'critico' ? 'autor/obra crítica (ej: Graeber, Debt)' : 'cita o URL externa'}">
            <select data-origen>
              <option value="canonico">canónico</option>
              <option value="critico" ${origen==='critico'?'selected':''}>crítico</option>
              <option value="externo" ${origen==='externo'?'selected':''}>externo</option>
            </select>
            <button data-act="del">×</button>
          `;
        }
        row.querySelector("[data-act=del]").addEventListener("click", () => row.remove());
        $fuentes.appendChild(row);
      }

      body.querySelector('[data-act="add-canon"]').addEventListener("click", () => pintarFila("canonico"));
      body.querySelector('[data-act="add-critica"]').addEventListener("click", () => pintarFila("critico"));
      body.querySelector('[data-act="add-externa"]').addEventListener("click", () => pintarFila("externo"));

      // Empezamos con una canónica y una crítica para guiar al usuario.
      pintarFila("canonico");
      pintarFila("critico");

      body.querySelector('[data-act="cancelar"]').addEventListener("click", cerrarModal);
      body.querySelector('[data-act="guardar"]').addEventListener("click", () => {
        const titulo = body.querySelector("#s-titulo").value.trim();
        const texto = body.querySelector("#s-texto").value.trim();
        if (titulo.length < 3 || texto.length < 20) {
          $err.textContent = "Faltan título (≥3 chars) y/o texto (≥20 chars).";
          $err.hidden = false; $ok.hidden = true;
          return;
        }
        // Recolectar fuentes.
        const fuentes = [];
        $fuentes.querySelectorAll(".fuente-row").forEach(row => {
          const id = row.querySelector("[data-id]").value.trim();
          const origen = row.querySelector("[data-origen]").value;
          if (id && origen) fuentes.push({ id, origen });
        });
        if (fuentes.length < 2) {
          $err.textContent = "Necesitas al menos 2 fuentes.";
          $err.hidden = false; $ok.hidden = true;
          return;
        }
        const tieneCanon = fuentes.some(f => f.origen === "canonico");
        const tieneCrit  = fuentes.some(f => f.origen === "critico");
        if (!tieneCanon || !tieneCrit) {
          $err.textContent = "Debe haber al menos 1 fuente canónica y 1 crítica.";
          $err.hidden = false; $ok.hidden = true;
          return;
        }
        const entry = recordGesto("sintesis", {
          titulo,
          texto,
          fuentes,
          fuente_app: "biblioteca"
        });
        // Token +1: registrar la síntesis en historia local.
        try { registrarSintesis(entry.ts); renderTokens(); }
        catch (e) { console.warn("[biblioteca] tokens:", e); }
        $err.hidden = true;
        $ok.textContent = "Síntesis registrada. +1 token de invitación.";
        $ok.hidden = false;
        renderHonesty();
        // Auto-cerrar tras 1.2s.
        setTimeout(() => { cerrarModal(); recargarFeed(); }, 1200);
      });
    }
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ─────────────────── RECARGA FEED (con sillas + quorums) ─────

async function recargarFeed() {
  let mnemo = [];
  try { mnemo = await cargarItems(); }
  catch (e) { console.warn("[biblioteca] mnemo:", e); }

  let sillas = [];
  try { sillas = await loadSillasConocimiento({ max_epigrafes: 20, max_fuentes: 12 }); }
  catch (e) { console.warn("[biblioteca] sillas:", e); }

  let quorums = [];
  try { quorums = loadQuorumsLectura(); }
  catch (e) { console.warn("[biblioteca] quorums:", e); }

  // Merge — rank() ordena. Quorums arriba para que se vean los
  // termómetros al abrir.
  state.items = [...quorums, ...mnemo, ...sillas];
  reRank();
}

// ─────────────────── SILLAS — ACCIONES ────────────────────────

function onSillaEmpezar(post) {
  // "Empezar" un epígrafe = emite gesto guardar y abre su contenido
  // pleno (si es de canónico) o el editor de síntesis (si crítico).
  const p = post.payload || {};
  if (post.kind === "silla_epigrafe") {
    recordGesto("guardar", {
      tema_id: p.tema_id, epi_id: p.epi_id,
      fuente_app: "biblioteca"
    });
    guardarUltimoTema(p.tema_id);
    // Inyectar el item al feed clásico para que pueda expandirse:
    // simplemente rehacemos el feed — el item pasará de "silla" a
    // "tocado" porque ahora tiene un gesto.
    recargarFeed();
  }
}

function onSillaSintetizarCon(post) {
  // Abrir editor de síntesis con la fuente crítica pre-rellenada.
  // El modal de síntesis no tiene una API de pre-relleno explícita;
  // exponemos un hint vía variable global que `abrirModalSintesis`
  // pueda leer en el setTimeout inicial. Simple y reversible.
  window.__biblioteca_sintesis_prefuente = {
    id: post.payload?.id || post.id,
    origen: "critico",
    cita_breve: `${post.payload?.autor || ""} — ${post.payload?.titulo || ""}`.trim()
  };
  abrirModalSintesis();
}

// ─────────────────── MODAL DE QUÓRUM LECTURA ──────────────────

function abrirModalQuorumLectura() {
  const back = document.getElementById("modal-quorum-backdrop");
  if (!back) return;
  const d14 = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const d21 = new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10);
  document.getElementById("ql-titulo").value = "";
  document.getElementById("ql-autor").value = "";
  document.getElementById("ql-descripcion").value = "";
  document.getElementById("ql-umbral").value = "6";
  document.getElementById("ql-deadline").value = d14;
  document.getElementById("ql-fecha-evento").value = d21;
  document.getElementById("ql-tema").value = "";
  back.hidden = false;

  document.getElementById("ql-cancel").onclick = () => { back.hidden = true; };
  document.getElementById("ql-confirm").onclick = () => {
    const titulo  = document.getElementById("ql-titulo").value.trim();
    const autor   = document.getElementById("ql-autor").value.trim() || null;
    const desc    = document.getElementById("ql-descripcion").value.trim();
    const umbral  = parseInt(document.getElementById("ql-umbral").value, 10);
    const dl      = document.getElementById("ql-deadline").value;
    const fe      = document.getElementById("ql-fecha-evento").value || null;
    const tema    = document.getElementById("ql-tema").value.trim() || null;
    if (!titulo) return alert("Falta título.");
    if (!Number.isFinite(umbral) || umbral < 2) return alert("Umbral mínimo: 2.");
    if (!dl) return alert("Falta deadline.");
    try {
      crearQuorumLectura({
        titulo, descripcion: desc, autor, umbral,
        deadline: new Date(dl).toISOString(),
        fecha_evento: fe ? new Date(fe).toISOString() : null,
        tema_id: tema
      });
      back.hidden = true;
      recargarFeed();
    } catch (e) {
      alert("Error: " + (e.message || e));
    }
  };
}

// ─────────────────── PULSO PALACIOS ───────────────────────────

function abrirPulsoPanel() {
  abrirPulsoPalacios({
    ventanaDias: 30,
    onPalacioClick: (n) => console.log("[biblio] palacio click:", n),
    onEmpezarPalacio: (n) => console.log("[biblio] empezar palacio:", n)
  });
}

// ─────────────────── TOKENS ───────────────────────────────────

function renderTokens() {
  const c = document.getElementById("tokens-block");
  if (!c) return;
  renderTokensBlock(c);
}

// ─────────────────── MODO DESCUBRE (formativo) ────────────────

function abrirDescubrePanel() {
  abrirDescubre({
    getRanked: () => state.ranked,
    getSliders: () => ({ ...state.sliders }),
    setSliders: (nuevos) => {
      // Refleja el nudge en los sliders visibles + persiste + re-rankea.
      for (const k of Object.keys(state.sliders)) {
        if (typeof nuevos[k] === "number") state.sliders[k] = Math.max(-1, Math.min(1, nuevos[k]));
      }
      guardarSliders();
      renderSliders();
      reRank();
    },
    dimsMeta: DIMS_META,
    onSenal: (item, signo) => {
      const tipo = signo >= 0 ? "senal_pos" : "senal_neg";
      recordGesto(tipo, {
        sujeto: item.kind || "epigrafe",
        tema_id: item.tema_id || item.payload?.tema_id || null,
        epi_id: item.epi_id || item.payload?.epi_id || null,
        ref_id: item.id,
        valor: signo >= 0 ? 1 : -1,
        fuente_app: "biblioteca"
      });
    },
    onGuardar: (item) => {
      recordGesto("guardar", {
        sujeto: item.kind || "epigrafe",
        tema_id: item.tema_id || item.payload?.tema_id || null,
        epi_id: item.epi_id || item.payload?.epi_id || null,
        ref_id: item.id,
        fuente_app: "biblioteca"
      });
    },
    // serendipia/learningRate los fija cada preset dentro de descubre.js.
    aprendizaje: true
  });
}

// ─────────────────── VACÍO COMO INVITACIÓN ────────────────────

function renderEmptyInvite(container) {
  container.innerHTML = "";
  const palacio = palacioInferido();
  const h = document.createElement("h3");
  h.textContent = palacio
    ? `📚 Palacio ${palacio}: aún sin actividad reciente`
    : "Aún no has tocado la Biblioteca.";
  container.appendChild(h);
  const p = document.createElement("p");
  p.textContent = palacio
    ? "Vuelve a un epígrafe pendiente, sintetiza con una fuente crítica, o convoca una lectura."
    : "Empieza por un epígrafe del temario, sintetiza con una fuente crítica, o convoca una lectura conjunta.";
  container.appendChild(p);
  const actions = document.createElement("div");
  actions.className = "empty-actions";
  const b1 = document.createElement("button");
  b1.textContent = "+ misión";
  b1.onclick = () => abrirModalNuevaMision();
  actions.appendChild(b1);
  const b2 = document.createElement("button");
  b2.textContent = "✎ síntesis";
  b2.onclick = () => abrirModalSintesis();
  actions.appendChild(b2);
  const b3 = document.createElement("button");
  b3.textContent = "▸ lectura conjunta";
  b3.onclick = () => abrirModalQuorumLectura();
  actions.appendChild(b3);
  const b4 = document.createElement("button");
  b4.textContent = "📡 pulso de palacios";
  b4.onclick = () => abrirPulsoPanel();
  actions.appendChild(b4);
  container.appendChild(actions);
  const stat = document.createElement("p");
  stat.className = "empty-stat";
  stat.textContent = "12 fuentes críticas y 20 epígrafes están esperando tu primer gesto.";
  container.appendChild(stat);
}

function palacioInferido() {
  const uid = getUserId();
  const PAL = { t1:1,t2:1,t3:1, t4:2,t5:2, t6:3,t7:3,t8:3,t9:3,t10:3,t11:3,t12:3,
                t13:4,t14:4,t15:4,t16:4,t17:4, t18:5, t19:6,t20:6,t21:6,
                t22:7,t23:7, t24:8,t25:8, t26:9 };
  const conteo = new Map();
  for (const g of getAllGestos()) {
    if (g.userId !== uid || g.falso) continue;
    const t = g.payload?.tema_id;
    if (!t) continue;
    const p = PAL[t];
    if (!p) continue;
    conteo.set(p, (conteo.get(p) || 0) + 1);
  }
  let max = 0, palacio = null;
  for (const [p, n] of conteo) if (n > max) { max = n; palacio = p; }
  return palacio;
}

// ─────────────────── ONBOARDING ───────────────────

function debeForzarOnboarding() {
  // Si ya hay misiones guardadas → no.
  if (state.misiones.length > 0) return false;
  // Si el usuario ya tiene gestos previos en cualquier app → no
  // (asumimos que ya conoce el patrón).
  try {
    const todos = getAllGestos();
    if (todos.length > 0) return false;
  } catch { /* sigue */ }
  return true;
}

// ─────────────────── BOOTSTRAP ───────────────────

async function init() {
  // Barra superior compartida (faceta Biblioteca, acento índigo).
  mountNavbar("biblioteca");

  // Inyectar CSS del HUD una vez.
  document.head.insertAdjacentHTML("beforeend", `<style>${HUD_CSS}</style>`);

  // UID en topbar.
  document.getElementById("uid").textContent = getUserId();

  // Listeners de header.
  document.getElementById("btn-nueva-mision").addEventListener("click", () => abrirModalNuevaMision());
  document.getElementById("btn-nueva-sintesis").addEventListener("click", () => abrirModalSintesis());

  renderSliders();
  renderMisiones();
  renderHonesty();

  // Botones masa crítica v3.
  document.getElementById("btn-abrir-pulso-palacios")?.addEventListener("click", abrirPulsoPanel);
  document.getElementById("btn-nuevo-quorum-lectura")?.addEventListener("click", abrirModalQuorumLectura);
  document.getElementById("btn-descubre")?.addEventListener("click", abrirDescubrePanel);

  // Tokens iniciales.
  reconciliarTokens();
  renderTokens();

  // Carga combinada: mnemo + sillas + quorums.
  await recargarFeed();

  // Onboarding: forzar primera misión si procede. Lo hacemos al final
  // para que el usuario vea el feed cargado de fondo (no en vacío).
  if (debeForzarOnboarding()) {
    abrirModalNuevaMision({ forzado: true });
  }
}

init();
