// agora-app/app.js — Orquestador del Ágora (v3, masa crítica).
//
// Layout: timeline vertical + drawer lateral con sliders, fuentes,
// misiones, loops, honesty, tokens, pulso y quórum.
//
// Responsabilidades (v3):
//   - Cargar fuentes externas (Bluesky + Reddit) + cívicas + sillas vacías
//     + quórums activos. Todos como items del mismo feed (kind discrimina).
//   - Rankear con shared/rank.js (sliders + misiones).
//   - Pintar timeline, drawer, pinned mission, loops, honesty.
//   - Emitir gestos: senal_pos, guardar, anecdota, compromiso/_cumplido,
//     soy_de_entidad, sigue_vivo, convoco_quorum, firmo_quorum.
//   - Vacío como invitación (cuando el feed queda a 0).
//   - Tokens de invitación (1 por cada misión cerrada).
//   - Pulso de zona (panel) y modal de convocatoria de quórum.

import { recordGesto, getUserId, getAllGestos } from "../shared/gestos.js?v=20260529-agora-verde";
import { rank } from "../shared/rank.js?v=20260529-agora-verde";
import { mountHud, HUD_CSS } from "../shared/hud.js?v=20260529-agora-verde";
import {
  honestyMeter,
  detectarAperturasTejido,
  detectarReciprocidad
} from "../shared/loops.js?v=20260529-agora-verde";

import { mountTablero } from "./sliders.js?v=20260529-agora-verde";
import {
  loadTablero, saveTablero, dimsMetaDe, FAMILIAS, interleave, esItemCivico
} from "../shared/tablero.js?v=20260529-agora-verde";
import {
  loadAllSources, aplicarDims, DEFAULT_SOURCES_CONFIG
} from "./feed.js?v=20260601-parque";

// Módulos de masa crítica (v3).
import { loadSillasVacias, renderSillaCard, SILLAS_DEFAULT_CONFIG } from "./sillas.js?v=20260529-agora-verde";
import { loadQuorums, crearQuorum, firmarQuorum, renderQuorumCard } from "./quorums.js?v=20260529-agora-verde";
import { abrirPulso } from "./pulso.js?v=20260529-agora-verde";
import { registrarCierre, renderTokensBlock, reconciliarTokens } from "./tokens.js?v=20260529-agora-verde";
import { abrirDescubre } from "./descubre.js?v=20260529-agora-verde";

// ─────────────────── CONSTANTES ───────────────────

const KEY_MISIONES = "agora-misiones";
const KEY_SOURCES  = "agora-sources-config";
const PAGE_SIZE    = 15;

// ─────────────────── ESTADO ───────────────────

const state = {
  posts:    [],
  tablero:  loadTablero(),
  misiones: cargarMisiones(),
  sources:  cargarSourcesConfig(),
  page:     0,
  ranked:   []
};

let tableroCtrl = null;
let slContainer = null;

// Atajos a la familia activa del tablero.
function famAct()        { return state.tablero.familiaActiva; }
function modoUnico()     { return state.tablero.modo === "unico"; }
function slidersAct()    { return state.tablero[famAct()].sliders; }
function dimsMetaAct()   {
  // En modo Mezcla el HUD debe poder nombrar dims de ambas familias.
  return modoUnico()
    ? { ...dimsMetaDe("hobby"), ...dimsMetaDe("civico") }
    : dimsMetaDe(famAct());
}
function setSlidersAct(nuevos) {
  state.tablero[famAct()].sliders = nuevos;
  saveTablero(state.tablero);
}

// Enrutado por FUENTE: Aficiones = el ancho de la web (reddit/bsky);
// Cívico = la vida local (overlays, quórums, sillas, eventos). Crisp y
// coherente con los presets originales. Las dims temáticas siguen
// ordenando DENTRO de cada feed; el ruteo solo decide en cuál cae.

function cargarMisiones() {
  try {
    const raw = localStorage.getItem(KEY_MISIONES);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}
function guardarMisiones() {
  try { localStorage.setItem(KEY_MISIONES, JSON.stringify(state.misiones)); }
  catch (e) {}
}

function cargarSourcesConfig() {
  try {
    const raw = localStorage.getItem(KEY_SOURCES);
    if (!raw) return clone(DEFAULT_SOURCES_CONFIG);
    const parsed = JSON.parse(raw);
    // Merge defensivo con defaults para tolerar versiones viejas.
    return {
      bsky: {
        enabled: parsed.bsky?.enabled !== false,
        hashtags: Array.isArray(parsed.bsky?.hashtags) ? parsed.bsky.hashtags : DEFAULT_SOURCES_CONFIG.bsky.hashtags,
        accounts: Array.isArray(parsed.bsky?.accounts) ? parsed.bsky.accounts : DEFAULT_SOURCES_CONFIG.bsky.accounts
      },
      reddit: {
        enabled: parsed.reddit?.enabled !== false,
        subreddits: Array.isArray(parsed.reddit?.subreddits) ? parsed.reddit.subreddits : DEFAULT_SOURCES_CONFIG.reddit.subreddits
      },
      civic: {
        enabled: parsed.civic?.enabled !== false,
        kinds: Array.isArray(parsed.civic?.kinds) ? parsed.civic.kinds : DEFAULT_SOURCES_CONFIG.civic.kinds
      }
    };
  } catch (e) {
    return clone(DEFAULT_SOURCES_CONFIG);
  }
}
function guardarSourcesConfig() {
  try { localStorage.setItem(KEY_SOURCES, JSON.stringify(state.sources)); }
  catch (e) {}
}
function clone(o) { return JSON.parse(JSON.stringify(o)); }

// ─────────────────── RANKING ───────────────────

function reRank() {
  const misIds = state.misiones.map(m => m.id);
  const esPin = r => r.score === Infinity;       // misiones fijadas: siempre
  const rankHobby  = () => rank({ sliders: state.tablero.hobby.sliders,  misiones: misIds, dimsMeta: dimsMetaDe("hobby") },  state.posts);
  const rankCivico = () => rank({ sliders: state.tablero.civico.sliders, misiones: misIds, dimsMeta: dimsMetaDe("civico") }, state.posts);
  const enHobby  = r => esPin(r) || !esItemCivico(r.item);
  const enCivico = r => esPin(r) || esItemCivico(r.item);

  if (modoUnico()) {
    const rh = rankHobby().filter(enHobby);
    const rc = rankCivico().filter(enCivico);
    state.ranked = interleave(rh, rc, { ratio: state.tablero.ratio });
  } else if (famAct() === "civico") {
    state.ranked = rankCivico().filter(enCivico);
  } else {
    state.ranked = rankHobby().filter(enHobby);
  }
  state.page = 0;
  renderFeed();
}

// ─────────────────── RENDER: FEED ───────────────────

function renderFeed() {
  const root   = document.getElementById("feed");
  const status = document.getElementById("feed-status");
  const btnMas = document.getElementById("btn-mas");
  const empty  = document.getElementById("feed-empty");
  if (!root) return;

  root.innerHTML = "";
  const fin = (state.page + 1) * PAGE_SIZE;
  const visibles = state.ranked.slice(0, fin);

  for (const res of visibles) {
    root.appendChild(dispatchRenderCard(res));
  }

  if (status) {
    if (state.ranked.length === 0) {
      status.textContent = "0 — revisa fuentes en ⚙";
    } else {
      status.textContent = `${Math.min(fin, state.ranked.length)} de ${state.ranked.length}`;
    }
  }
  if (btnMas) btnMas.hidden = fin >= state.ranked.length;

  // Vacío como invitación: si el ranking quedó a 0, mostramos un bloque
  // CTA para activar la primera señal (en la zona del usuario o genérica).
  if (empty) {
    if (state.ranked.length === 0) {
      empty.hidden = false;
      renderEmptyInvite(empty);
    } else {
      empty.hidden = true;
      empty.innerHTML = "";
    }
  }
}

// Dispatcher: distintos kinds tienen distintos renderers. Todos
// devuelven un <article class="post …">. El HUD se monta dentro
// (en `.post-hud`) por cada renderer o por nosotros si no lo hace.
function dispatchRenderCard(resultado) {
  const post = resultado.item || {};
  let article = null;

  if (post.kind === "silla_vacia") {
    article = renderSillaCard(post, {
      onReclamar: (p) => accionReclamarSilla(p),
      onSigueVivo: (p) => accionSigueVivoSilla(p)
    });
  } else if (post.kind === "quorum") {
    article = renderQuorumCard(post, {
      onFirmar: (p) => {
        const ok = firmarQuorum(p.payload?.quorum_id);
        if (!ok) alert("Ya habías firmado este quórum.");
        recargarFuentes();
      },
      onCompartir: (p) => {
        const url = `${location.origin}${location.pathname}#q=${encodeURIComponent(p.payload?.quorum_id || "")}`;
        navigator.clipboard?.writeText(url).catch(() => {});
        alert("Enlace copiado.\n" + url);
      }
    });
  } else {
    article = renderCard(resultado);
  }

  // Si el renderer custom dejó un `.post-hud` vacío, lo poblamos.
  const hud = article.querySelector(".post-hud");
  if (hud && hud.childElementCount === 0) {
    mountHud(hud, resultado, dimsMetaAct());
  }
  return article;
}

// ─────────────────── ACCIONES SOBRE SILLAS ───────────────────

function accionReclamarSilla(post) {
  const nombre = post.payload?.nombre || "(sin nombre)";
  const url = prompt(`Reclamar la entidad "${nombre}".\nPega un validador (URL oficial, NIF, o nº de registro). Será revisado:`, "");
  if (url === null) return;
  recordGesto("soy_de_entidad", {
    entidad_id: post.payload?.id || null,
    nombre,
    validador_tipo: url.startsWith("http") ? "url" : "texto",
    validador_valor: url.trim(),
    fuente_app: "agora"
  }, post.geo?.municipio || post.geo?.zona);
  alert(`Reclamación registrada (pendiente de moderación).`);
  recargarFuentes();
}

function accionSigueVivoSilla(post) {
  recordGesto("sigue_vivo", {
    entidad_id: post.payload?.id || null,
    nombre: post.payload?.nombre,
    fuente_app: "agora"
  }, post.geo?.municipio || post.geo?.zona);
  refrescarLoops();
}

// ─────────────────── VACÍO COMO INVITACIÓN ───────────────────

function renderEmptyInvite(container) {
  container.innerHTML = "";
  const zona = zonaInferida();

  const h = document.createElement("h3");
  h.textContent = zona
    ? `◉ ${zona}: aún sin actividad`
    : "Aún nadie ha hecho un gesto aquí.";
  container.appendChild(h);

  const p = document.createElement("p");
  p.textContent = zona
    ? "Sé tú quien lo abra. Una señal, una convocatoria, una entidad reclamada — cualquiera de las tres cuenta."
    : "Sé tú quien abra esta Ágora. Empieza por una misión, una convocatoria o reclama una entidad que conozcas.";
  container.appendChild(p);

  const actions = document.createElement("div");
  actions.className = "empty-actions";

  const b1 = document.createElement("button");
  b1.textContent = "+ misión";
  b1.onclick = () => abrirModalMision();
  actions.appendChild(b1);

  const b2 = document.createElement("button");
  b2.textContent = "▸ convocar quórum";
  b2.onclick = () => abrirModalQuorum();
  actions.appendChild(b2);

  const b3 = document.createElement("button");
  b3.textContent = "📡 pulso de zona";
  b3.onclick = () => abrirPulsoPanel();
  actions.appendChild(b3);

  container.appendChild(actions);

  // Stat suave del estado del proyecto.
  const stat = document.createElement("p");
  stat.className = "empty-stat";
  stat.textContent = "Hay miles de entidades cívicas reales esperando que alguien vinculado las reclame.";
  container.appendChild(stat);
}

function zonaInferida() {
  // Zona más frecuente en los gestos del usuario, si tiene historial.
  const uid = getUserId();
  const conteo = new Map();
  for (const g of getAllGestos()) {
    if (g.userId !== uid || g.falso) continue;
    const z = g.zona || g.payload?.contraparte || null;
    if (!z) continue;
    conteo.set(z, (conteo.get(z) || 0) + 1);
  }
  let max = 0, zona = null;
  for (const [z, n] of conteo) { if (n > max) { max = n; zona = z; } }
  return zona;
}

function renderCard(resultado) {
  const post = resultado.item;
  const article = document.createElement("article");
  article.className = "post";
  article.dataset.source = post.source || "civic";
  article.dataset.kind = post.kind || "post";
  article.dataset.postId = post.id;
  if (resultado.score === Infinity) article.classList.add("is-mision");

  // ── Head: geo + source ─────────────────────────────
  const head = document.createElement("header");
  head.className = "post-head";

  const geo = document.createElement("span");
  geo.className = "post-geo";
  if (post.geo && post.geo.zona) {
    geo.textContent = "◉ " + post.geo.zona;
  } else {
    geo.classList.add("is-empty");
    geo.textContent = "◉ sin geo";
  }

  const src = document.createElement("span");
  src.className = "post-source";
  src.textContent = post.source_label || (post.source || "").toUpperCase();

  head.append(geo, src);

  // ── Author ─────────────────────────────────────────
  const authorRow = document.createElement("div");
  authorRow.className = "post-author";

  if (post.author && post.author.handle) {
    const h = document.createElement("span");
    h.className = "post-handle";
    h.textContent = post.author.handle;
    authorRow.appendChild(h);
  }
  const t = document.createElement("span");
  t.className = "post-time";
  t.textContent = post.ts ? tiempoDesde(post.ts) : "";
  authorRow.appendChild(t);

  // ── Body ───────────────────────────────────────────
  const body = document.createElement("div");
  body.className = "post-body";
  body.textContent = post.body || "";

  // ── HUD ────────────────────────────────────────────
  const hud = document.createElement("div");
  hud.className = "post-hud";
  mountHud(hud, resultado, dimsMetaAct());

  // ── Acciones ───────────────────────────────────────
  const footer = document.createElement("footer");
  footer.className = "post-actions";

  footer.append(
    botonAccion("senal",   "❤", "Señal positiva"),
    botonAccion("guardar", "📌", "Guardar"),
    botonAccion("nota",    "💬", "Nota / anécdota"),
    botonAccion("mision",  "⊕", "Vincular a misión")
  );
  if (post.url_origen) {
    const link = document.createElement("a");
    link.className = "post-link";
    link.href = post.url_origen;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "↗";
    link.title = "Abrir en origen";
    footer.appendChild(link);
  }

  // Delegación de clicks en acciones.
  footer.addEventListener("click", (ev) => {
    const btn = ev.target.closest(".act");
    if (!btn) return;
    const act = btn.dataset.act;
    onAccionPost(post, act, btn);
  });

  article.append(head, authorRow, body, hud, footer);

  // Body clamp + leer más.
  setTimeout(() => {
    if (body.scrollHeight > body.clientHeight + 4) {
      const more = document.createElement("button");
      more.className = "post-body-more";
      more.textContent = "…leer más";
      more.addEventListener("click", () => {
        body.classList.toggle("is-expanded");
        more.textContent = body.classList.contains("is-expanded")
          ? "menos" : "…leer más";
      });
      body.insertAdjacentElement("afterend", more);
    }
  }, 0);

  return article;
}

function botonAccion(act, icon, titulo) {
  const b = document.createElement("button");
  b.className = "act act-" + act;
  b.dataset.act = act;
  b.title = titulo;
  b.textContent = icon;
  return b;
}

// ─────────────────── ACCIONES SOBRE POST ───────────────────

function onAccionPost(post, act, btn) {
  const baseZona = post.geo?.municipio || post.geo?.zona || null;
  const basePayload = {
    sujeto: post.source === "civic" ? post.kind : "post_externo",
    post_id: post.id,
    post_source: post.source,
    post_url: post.url_origen || null,
    author_handle: post.author?.handle || null,
    fuente_app: "agora"
  };

  if (act === "senal") {
    recordGesto("senal_pos", { ...basePayload, valor: 1 }, baseZona);
    btn.classList.toggle("is-on");
    refrescarLoops();
  } else if (act === "guardar") {
    recordGesto("guardar", basePayload, baseZona);
    btn.classList.toggle("is-on");
  } else if (act === "nota") {
    const texto = prompt("Nota / anécdota sobre este post (privada de momento):", "");
    if (texto === null || !texto.trim()) return;
    recordGesto("anecdota", { ...basePayload, texto: texto.trim() }, baseZona);
    btn.classList.add("is-on");
  } else if (act === "mision") {
    // Crear misión rápida atada a este post.
    const titulo = prompt(
      "Misión vinculada a este post (qué te comprometes a hacer):",
      post.author?.handle ? `Responder a ${post.author.handle}` : "Actuar sobre este post"
    );
    if (!titulo || !titulo.trim()) return;
    addMision(titulo.trim(), "", post.author?.handle || baseZona || "", { post_id: post.id });
    btn.classList.add("is-on");
  }
  renderHonesty();
}

// ─────────────────── MISIONES ───────────────────

function addMision(titulo, descripcion, contraparte, extra = {}) {
  const id = "m_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const mision = {
    id,
    titulo: titulo.trim(),
    descripcion: (descripcion || "").trim(),
    contraparte: (contraparte || "").trim() || null,
    post_id: extra.post_id || null,
    ts_creado: new Date().toISOString()
  };
  state.misiones.push(mision);
  guardarMisiones();

  recordGesto("compromiso", {
    id: mision.id,
    texto: mision.titulo + (mision.descripcion ? " — " + mision.descripcion : ""),
    contraparte: mision.contraparte,
    post_id: mision.post_id,
    fuente_app: "agora"
  });

  renderMisiones();
  renderPinned();
  renderHonesty();
  reRank();
  return mision;
}

function cerrarMision(misionId, nota) {
  const idx = state.misiones.findIndex(m => m.id === misionId);
  if (idx === -1) return false;
  const mision = state.misiones[idx];

  const gestos = getAllGestos();
  const compromisoGesto = gestos
    .filter(g => g.tipo === "compromiso" && g.payload?.id === misionId)
    .sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts))[0];
  const ref = compromisoGesto ? compromisoGesto.ts : misionId;

  recordGesto("compromiso_cumplido", {
    compromiso_ref: ref,
    nota: (nota || "").trim() || null,
    titulo: mision.titulo,
    contraparte: mision.contraparte,
    fuente_app: "agora"
  });

  // Token de invitación: +1 por cada cierre.
  registrarCierre(ref);

  state.misiones.splice(idx, 1);
  guardarMisiones();
  renderMisiones();
  renderPinned();
  renderHonesty();
  refrescarLoops();
  renderTokens();
  reRank();
  return true;
}

// ─────────────────── MODAL DE QUÓRUM ───────────────────

function abrirModalQuorum() {
  const back = document.getElementById("modal-quorum-backdrop");
  if (!back) return;
  // Defaults razonables: deadline a 10 días, evento a 14.
  const d10 = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
  const d14 = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  document.getElementById("q-titulo").value = "";
  document.getElementById("q-descripcion").value = "";
  document.getElementById("q-umbral").value = "12";
  document.getElementById("q-deadline").value = d10;
  document.getElementById("q-lugar").value = "";
  document.getElementById("q-fecha-evento").value = d14;
  back.hidden = false;

  document.getElementById("q-cancel").onclick = () => { back.hidden = true; };
  document.getElementById("q-confirm").onclick = () => {
    const titulo   = document.getElementById("q-titulo").value.trim();
    const desc     = document.getElementById("q-descripcion").value.trim();
    const umbral   = parseInt(document.getElementById("q-umbral").value, 10);
    const deadline = document.getElementById("q-deadline").value;
    const lugar    = document.getElementById("q-lugar").value.trim() || null;
    const fechaEv  = document.getElementById("q-fecha-evento").value || null;
    if (!titulo) return alert("Falta título.");
    if (!Number.isFinite(umbral) || umbral < 2) return alert("Umbral mínimo: 2 firmas.");
    if (!deadline) return alert("Falta deadline.");
    try {
      crearQuorum({
        titulo, descripcion: desc, umbral,
        deadline: new Date(deadline).toISOString(),
        lugar,
        fecha_evento: fechaEv ? new Date(fechaEv).toISOString() : null
      });
      back.hidden = true;
      recargarFuentes();
    } catch (e) {
      alert("Error creando quórum: " + (e.message || e));
    }
  };
}

// ─────────────────── PULSO PANEL ───────────────────

function abrirPulsoPanel() {
  cerrarDrawer();
  abrirPulso({
    zonaUsuario: zonaInferida(),
    onZonaClick: (zona) => {
      // V1 simple: alert con la zona. V2: filtrar feed por zona.
      console.log("[agora] filtrar feed por zona:", zona);
    },
    onActivar: (zona) => {
      // Abrir modal de creación rápida con la zona pre-rellenada como
      // contraparte. Es la puerta "activa la primera señal aquí".
      abrirModalMision({ contraparteInicial: zona });
    }
  });
}

// ─────────────────── TOKENS ───────────────────

function renderTokens() {
  const root = document.getElementById("tokens-block");
  if (!root) return;
  renderTokensBlock(root);
}

// ─────────────────── TABLERO: TIRA SELECTORA DE FEED ───────────────
// Muta la "touchbar" de islas de POLIS: aquí no saltas de isla, saltas de
// algoritmo-yo. Aficiones / Cívico (toggle) · Mezcla (feed único).

const FEED_CHIPS = [
  { id: "hobby",  emoji: "✦", label: "Aficiones" },
  { id: "civico", emoji: "🏛", label: "Cívico" },
  { id: "mezcla", emoji: "⇄", label: "Mezcla" }
];

function montarStrip() {
  const strip = document.getElementById("agora-strip");
  if (!strip) return;
  strip.innerHTML = FEED_CHIPS.map(c =>
    `<button type="button" class="feed-chip" role="tab" data-chip="${c.id}">` +
    `<span class="feed-chip-ico" aria-hidden="true">${c.emoji}</span>${c.label}</button>`
  ).join("");
  strip.addEventListener("click", (ev) => {
    const btn = ev.target.closest(".feed-chip");
    if (btn) seleccionarChip(btn.dataset.chip);
  });
  actualizarStrip();
}

function chipActivo() {
  return modoUnico() ? "mezcla" : famAct();
}

function actualizarStrip() {
  const act = chipActivo();
  document.querySelectorAll("#agora-strip .feed-chip").forEach(b => {
    const on = b.dataset.chip === act;
    b.classList.toggle("is-active", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
  });
}

function remontarTablero() {
  tableroCtrl = mountTablero(slContainer, famAct(), () => reRank());
}

function seleccionarChip(chip) {
  if (chip === "mezcla") {
    state.tablero.modo = "unico";
  } else {
    state.tablero.modo = "toggle";
    if (chip !== famAct()) {
      state.tablero.familiaActiva = chip;
      remontarTablero();
    }
  }
  saveTablero(state.tablero);
  actualizarStrip();
  reRank();
}

// ─────────────────── HEADER: DROPDOWN OCRE ▾ ───────────────

function montarBrandMenu() {
  const brand = document.getElementById("app-topbar-brand");
  const menu = document.getElementById("app-topbar-menu");
  if (!brand || !menu) return;
  const set = (open) => {
    menu.classList.toggle("open", open);
    brand.setAttribute("aria-expanded", open ? "true" : "false");
    menu.setAttribute("aria-hidden", open ? "false" : "true");
  };
  brand.addEventListener("click", () => set(!menu.classList.contains("open")));
  brand.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); set(!menu.classList.contains("open")); }
  });
  document.addEventListener("click", (ev) => {
    if (!menu.contains(ev.target) && !brand.contains(ev.target)) set(false);
  });
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") set(false); });
}

// ─────────────────── MODO DESCUBRE (StumbleUpon) ───────────────

function abrirDescubrePanel() {
  cerrarDrawer();
  abrirDescubre({
    getRanked: () => state.ranked,
    getSliders: () => slidersAct(),
    setSliders: (nuevos) => {
      // setState refleja el nudge en los sliders del tablero Y dispara el
      // onChange (que hace reRank). Si por lo que sea no existe, fallback.
      if (tableroCtrl && typeof tableroCtrl.setState === "function") {
        tableroCtrl.setState(nuevos);
      } else {
        setSlidersAct(nuevos);
        reRank();
      }
    },
    dimsMeta: dimsMetaAct(),
    onSenal: (item, signo) => {
      const tipo = signo >= 0 ? "senal_pos" : "senal_neg";
      const baseZona = item.geo?.municipio || item.geo?.zona || null;
      recordGesto(tipo, {
        sujeto: item.source === "civic" ? item.kind : "post_externo",
        post_id: item.id,
        post_source: item.source,
        author_handle: item.author?.handle || null,
        valor: signo >= 0 ? 1 : -1,
        fuente_app: "agora"
      }, baseZona);
      refrescarLoops();
    },
    onGuardar: (item) => {
      const baseZona = item.geo?.municipio || item.geo?.zona || null;
      recordGesto("guardar", {
        sujeto: item.source === "civic" ? item.kind : "post_externo",
        post_id: item.id,
        post_source: item.source,
        author_handle: item.author?.handle || null,
        fuente_app: "agora"
      }, baseZona);
    },
    // Amplía las fuentes con subreddits de los intereses elegidos y
    // recarga el feed (Reddit funciona; así "Intereses" trae contenido
    // real, no solo boost sobre lo cívico).
    ampliarFuentes: async ({ subreddits = [], hashtags = [] }) => {
      const subs = new Set(state.sources.reddit.subreddits || []);
      subreddits.forEach(s => subs.add(s));
      state.sources.reddit.subreddits = [...subs];
      state.sources.reddit.enabled = true;
      const hs = new Set(state.sources.bsky.hashtags || []);
      hashtags.forEach(h => hs.add(h));
      state.sources.bsky.hashtags = [...hs];
      guardarSourcesConfig();
      poblarFormFuentes();
      await recargarFuentes();
    },
    serendipia: state.tablero[famAct()].descubrimiento ?? 0.75,
    learningRate: 0.10, // aprendizaje rápido
    aprendizaje: true   // ON por defecto (se siente vivo)
  });
}

// ─────────────────── RENDER: PINNED MISSION ───────────────────

function renderPinned() {
  const pin = document.getElementById("mision-pinned");
  if (!pin) return;
  if (state.misiones.length === 0) {
    pin.hidden = true;
    return;
  }
  pin.hidden = false;
  const m = state.misiones[0]; // la más antigua (orden de inserción)
  document.getElementById("mision-pinned-title").textContent = m.titulo;
  document.getElementById("mision-pinned-time").textContent = tiempoDesde(m.ts_creado);
  const close = document.getElementById("mision-pinned-close");
  close.onclick = () => {
    const nota = prompt("Nota opcional sobre el cierre:", "");
    if (nota === null) return;
    cerrarMision(m.id, nota);
  };
}

// ─────────────────── RENDER: DRAWER (misiones / loops / honesty) ───

function renderMisiones() {
  const ul    = document.getElementById("misiones-list");
  const empty = document.getElementById("misiones-empty");
  if (!ul) return;
  ul.innerHTML = "";

  if (state.misiones.length === 0) {
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  const visibles = state.misiones.slice(0, 8);
  for (const m of visibles) {
    const li = document.createElement("li");
    li.className = "mision-item";

    const tit = document.createElement("div");
    tit.className = "mision-title";
    tit.textContent = m.titulo;

    const meta = document.createElement("div");
    meta.className = "mision-meta";
    const partes = [tiempoDesde(m.ts_creado)];
    if (m.contraparte) partes.push("· " + m.contraparte);
    meta.textContent = partes.join(" ");

    const btn = document.createElement("button");
    btn.className = "btn-cerrar";
    btn.textContent = "✓";
    btn.title = "Cerrar misión";
    btn.addEventListener("click", () => {
      const nota = prompt("Nota opcional sobre el cierre:", "");
      if (nota === null) return;
      cerrarMision(m.id, nota);
    });

    li.append(tit, meta, btn);
    ul.appendChild(li);
  }

  if (state.misiones.length > 8) {
    const li = document.createElement("li");
    li.className = "mision-overflow";
    li.textContent = `+${state.misiones.length - 8} ocultas`;
    ul.appendChild(li);
  }
}

function renderLoopsSummary() {
  const root = document.getElementById("loops-summary");
  if (!root) return;
  const gestos = getAllGestos();
  const aperturas = detectarAperturasTejido(gestos);
  const reciproc  = detectarReciprocidad(gestos, 30);

  root.innerHTML = "";

  if (aperturas.length === 0 && reciproc.length === 0) {
    const p = document.createElement("p");
    p.className = "loops-empty";
    p.textContent = "Aún sin aperturas ni reciprocidad.";
    root.appendChild(p);
    return;
  }

  if (aperturas.length > 0) {
    const p = document.createElement("p");
    p.className = "loops-line";
    p.innerHTML = `▪ <strong>${aperturas.length}</strong> ${aperturas.length === 1 ? "apertura" : "aperturas"} de tejido`;
    root.appendChild(p);
  }
  if (reciproc.length > 0) {
    const p = document.createElement("p");
    p.className = "loops-line";
    p.innerHTML = `▪ <strong>${reciproc.length}</strong> reciprocidad sostenida (30d)`;
    root.appendChild(p);
  }
}

function refrescarLoops() {
  renderLoopsSummary();
}

function renderHonesty() {
  const root = document.getElementById("honesty-meter");
  if (!root) return;
  const gestos = getAllGestos().filter(g => {
    if (g.tipo !== "compromiso" && g.tipo !== "compromiso_cumplido") return true;
    return g.payload?.fuente_app === "agora";
  });
  const m = honestyMeter(gestos, 30);
  root.innerHTML = "";

  if (m.ratio === null) {
    const p = document.createElement("p");
    p.className = "honesty-empty";
    p.textContent = "0 compromisos en 30d.";
    root.appendChild(p);
    root.dataset.banda = "ambar";
    return;
  }

  const pct = Math.round(m.ratio * 100);
  const dot = document.createElement("span");
  dot.className = "honesty-dot honesty-" + m.banda;

  const txt = document.createElement("span");
  txt.className = "honesty-text";
  const hint = m.banda === "verde"
    ? "sano · 50-75% es señal de compromisos calibrados."
    : (m.ratio < 0.5
        ? "muchas abiertas. Cierra alguna o redefine."
        : "todo cerrado. ¿Te comprometes a poco?");
  txt.innerHTML = `<strong>${m.cerradas}/${m.abiertas + m.cerradas}</strong> cerradas (${pct}%) · ${hint}`;

  root.append(dot, txt);
  root.dataset.banda = m.banda;
}

// ─────────────────── DRAWER ───────────────────

function abrirDrawer() {
  const dr  = document.getElementById("drawer");
  const bd  = document.getElementById("drawer-backdrop");
  const btn = document.getElementById("btn-drawer");
  if (!dr) return;
  dr.hidden = false;
  if (bd) bd.hidden = false;
  dr.setAttribute("aria-hidden", "false");
  if (btn) btn.setAttribute("aria-expanded", "true");
  // Render perezoso de bloques del drawer.
  renderMisiones();
  renderLoopsSummary();
  renderHonesty();
}
function cerrarDrawer() {
  const dr  = document.getElementById("drawer");
  const bd  = document.getElementById("drawer-backdrop");
  const btn = document.getElementById("btn-drawer");
  if (!dr) return;
  dr.hidden = true;
  if (bd) bd.hidden = true;
  dr.setAttribute("aria-hidden", "true");
  if (btn) btn.setAttribute("aria-expanded", "false");
}

// ─────────────────── FUENTES (form en drawer) ───────────────────

function poblarFormFuentes() {
  document.getElementById("src-civic-toggle").checked  = !!state.sources.civic.enabled;
  document.getElementById("src-bsky-toggle").checked   = !!state.sources.bsky.enabled;
  document.getElementById("src-reddit-toggle").checked = !!state.sources.reddit.enabled;
  document.getElementById("src-bsky-hashtags").value   = (state.sources.bsky.hashtags || []).join(", ");
  document.getElementById("src-bsky-accounts").value   = (state.sources.bsky.accounts || []).join(", ");
  document.getElementById("src-reddit-subreddits").value = (state.sources.reddit.subreddits || []).join(", ");
}

function leerFormFuentes() {
  const parse = (s) => (s || "").split(",").map(x => x.trim()).filter(Boolean);
  state.sources = {
    civic:  { enabled: document.getElementById("src-civic-toggle").checked,
              kinds: DEFAULT_SOURCES_CONFIG.civic.kinds },
    bsky:   { enabled: document.getElementById("src-bsky-toggle").checked,
              hashtags: parse(document.getElementById("src-bsky-hashtags").value),
              accounts: parse(document.getElementById("src-bsky-accounts").value) },
    reddit: { enabled: document.getElementById("src-reddit-toggle").checked,
              subreddits: parse(document.getElementById("src-reddit-subreddits").value) }
  };
  guardarSourcesConfig();
}

async function recargarFuentes() {
  const status = document.getElementById("feed-status");
  if (status) status.textContent = "cargando…";
  try {
    // 1) Fuentes externas + cívicas (Bluesky/Reddit/civic)
    const rawExternas = await loadAllSources(state.sources);
    const externas = aplicarDims(rawExternas);

    // 2) Sillas vacías (entidades del tejido sin reclamar)
    let sillas = [];
    try { sillas = await loadSillasVacias(SILLAS_DEFAULT_CONFIG); }
    catch (e) { console.warn("[agora] sillas fallo:", e); }

    // 3) Quórums activos (seed + creados por usuarios)
    let quorums = [];
    try { quorums = loadQuorums(); }
    catch (e) { console.warn("[agora] quorums fallo:", e); }

    // Merge — el ranking decide el orden final.
    state.posts = [...quorums, ...externas, ...sillas];
  } catch (e) {
    console.error("[agora] error cargando fuentes:", e);
    state.posts = [];
  }
  reRank();
}

// ─────────────────── MODAL DE MISIÓN ───────────────────

function abrirModalMision({ forzado = false, contraparteInicial = "" } = {}) {
  const back = document.getElementById("modal-backdrop");
  const hint = document.getElementById("modal-hint");
  const tit  = document.getElementById("modal-title");
  const $t   = document.getElementById("mision-titulo");
  const $d   = document.getElementById("mision-descripcion");
  const $c   = document.getElementById("mision-contraparte");
  const $cancel  = document.getElementById("btn-cancel");
  const $confirm = document.getElementById("btn-confirm");
  if (!back) return;

  $t.value = ""; $d.value = ""; $c.value = contraparteInicial || "";
  back.hidden = false;

  if (forzado) {
    tit.textContent = "Tu primera misión";
    hint.textContent = "Ágora no funciona sin objetivos. Formula al menos UNA misión esta semana: una persona o colectivo con quien quieres conectar, una convocatoria, un acto concreto.";
    $cancel.hidden = true;
  } else {
    tit.textContent = "Nueva misión";
    hint.textContent = "Una misión es un compromiso contigo. Ágora la fija arriba del feed hasta que la cierres.";
    $cancel.hidden = false;
  }
  setTimeout(() => $t.focus(), 50);

  $confirm.onclick = () => {
    const tt = $t.value.trim();
    if (!tt) { $t.focus(); return; }
    addMision(tt, $d.value, $c.value);
    back.hidden = true;
  };
  $cancel.onclick = () => {
    if (!forzado) back.hidden = true;
  };
  document.onkeydown = (ev) => {
    if (ev.key !== "Escape") return;
    if (!back.hidden && !forzado) back.hidden = true;
    else if (!document.getElementById("drawer").hidden) cerrarDrawer();
  };
  back.onclick = (ev) => {
    if (ev.target === back && !forzado) back.hidden = true;
  };
}

// ─────────────────── ONBOARDING ───────────────────

function necesitaOnboarding() {
  if (state.misiones.length > 0) return false;
  const uid = getUserId();
  const tieneGestosPrevios = getAllGestos().some(g => g.userId === uid);
  return !tieneGestosPrevios;
}

// ─────────────────── HELPERS ───────────────────

function inyectarHudCss() {
  if (document.getElementById("hud-style")) return;
  const style = document.createElement("style");
  style.id = "hud-style";
  style.textContent = HUD_CSS || "";
  document.head.appendChild(style);
}

function tiempoDesde(isoTs) {
  const t = Date.parse(isoTs);
  if (!Number.isFinite(t)) return "";
  const diff = Date.now() - t;
  if (diff < 0) {
    // Fecha futura (eventos).
    const min = Math.floor(-diff / 60000);
    if (min < 60) return `en ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 48) return `en ${h} h`;
    const d = Math.floor(h / 24);
    return `en ${d} d`;
  }
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `hace ${d} d`;
  return new Date(t).toLocaleDateString();
}

// ─────────────────── BOOT ───────────────────

async function boot() {
  montarBrandMenu();

  const uidEl = document.getElementById("uid");
  if (uidEl) uidEl.textContent = getUserId();

  inyectarHudCss();

  // Tablero de aficiones: la tira selectora arriba + los sliders en el drawer.
  slContainer = document.getElementById("sliders-container");
  montarStrip();
  remontarTablero();
  document.getElementById("reset-sliders")?.addEventListener("click", () => {
    if (tableroCtrl) {
      tableroCtrl.reset();
      reRank();
    }
  });

  // Drawer.
  document.getElementById("btn-drawer")?.addEventListener("click", abrirDrawer);
  document.getElementById("drawer-close")?.addEventListener("click", cerrarDrawer);
  document.getElementById("drawer-backdrop")?.addEventListener("click", cerrarDrawer);

  // Descubre (✦ en el header): abre el overlay; el feed lineal es la base.
  document.getElementById("mode-descubre")?.addEventListener("click", abrirDescubrePanel);

  // Fuentes form.
  poblarFormFuentes();
  document.getElementById("btn-fuentes-aplicar")?.addEventListener("click", async () => {
    leerFormFuentes();
    cerrarDrawer();
    await recargarFuentes();
  });

  // Botón "+ misión" en drawer.
  document.getElementById("btn-add-mision")?.addEventListener("click", () => abrirModalMision());

  // Botones nuevos del drawer (v3 masa crítica).
  document.getElementById("btn-abrir-pulso")?.addEventListener("click", abrirPulsoPanel);
  document.getElementById("btn-nuevo-quorum")?.addEventListener("click", abrirModalQuorum);

  // Paginación.
  document.getElementById("btn-mas")?.addEventListener("click", () => {
    state.page++;
    renderFeed();
  });

  // Render inicial paneles.
  renderPinned();
  reconciliarTokens();
  renderTokens();

  // Carga inicial de fuentes.
  await recargarFuentes();

  // Onboarding al final.
  // Onboarding suave: el bloque `feed-empty` invita a la primera misión.
  // Sin modal bloqueante (antes abría uno con `forzado:true` y tapaba todo).
}

document.addEventListener("DOMContentLoaded", boot);
