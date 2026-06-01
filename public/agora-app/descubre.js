// agora-app/descubre.js — Modo "Descubre" (StumbleUpon + TikTok táctil).
//
// Pantalla completa, móvil-primero. Tarjeta swipeable con 4 gestos:
//   ↑ arriba    → siguiente (sin opinar)
//   → derecha   → me gusta (senal_pos + sube algoritmo)
//   ← izquierda → menos de esto (senal_neg + baja algoritmo)
//   ↓ abajo     → guardar (gesto guardar, "para luego")
// Rail lateral con los mismos 4 como fallback accesible / desktop.
//
// Dos "algoritmos" elegibles en el onboarding:
//   ✦ Intereses → paleta amplia (entretenimiento), trae contenido vía
//                 subreddits reales. Cada 6 stumbles inyecta 1 cívico
//                 (incentivo de participación).
//   🏛 Cívico   → paleta cívica, sliders sesgados a convocar+cerca,
//                 prioriza quórums/convocatorias.
//
// Todo entra por `ctx`. El módulo no conoce el estado de la app.

import { pickStumble, aprenderDeFeedback, describirDiff } from "../shared/stumble.js?v=20260529-agora-verde";
import { mountHud, HUD_CSS } from "../shared/hud.js?v=20260529-agora-verde";

const KEY_CONFIG = "agora-descubre-config";   // { preset, intereses: [] }
const KEY_LEGEND = "agora-descubre-legend";   // "1" cuando ya se mostró la leyenda

// -----------------------------------------------------------
// Paletas de interés. keywords → boost sobre contenido cargado;
// subreddits → fuentes Reddit reales que se añaden al cargar; dimBias →
// empuje inicial de sliders.

// subreddits → solo los que tenemos en snapshot (../data/reddit/).
// Para añadir más: ampliar SUBS en tools/snapshot-reddit.py y re-correr.
// Snapshot actual: canarias, spain, es, futbol, cine, libros, ciencia,
// musica, videojuegos, askspain, podemos.
const PALETA_AMPLIA = [
  { id: "humor",       label: "Humor",         emoji: "😂", keywords: ["humor","meme","chiste","gracioso","cachondeo"], subreddits: ["spain","es"], dimBias: {} },
  { id: "deportes",    label: "Deportes",      emoji: "⚽", keywords: ["fútbol","futbol","baloncesto","deporte","liga","partido"], subreddits: ["futbol"], dimBias: {} },
  { id: "cine",        label: "Cine y series", emoji: "🎬", keywords: ["película","pelicula","serie","cine","netflix","estreno"], subreddits: ["cine"], dimBias: {} },
  { id: "musica",      label: "Música",        emoji: "🎵", keywords: ["música","musica","disco","concierto","canción","banda"], subreddits: ["musica"], dimBias: {} },
  { id: "ciencia",     label: "Ciencia y tec", emoji: "🔬", keywords: ["ciencia","tecnología","tecnologia","ia","espacio","investigación"], subreddits: ["ciencia"], dimBias: {} },
  { id: "gastronomia", label: "Gastronomía",   emoji: "🍳", keywords: ["receta","cocina","comida","restaurante","gastronomía"], subreddits: ["es"], dimBias: {} },
  { id: "naturaleza",  label: "Naturaleza",    emoji: "🌄", keywords: ["senderismo","montaña","playa","naturaleza","ruta","mar"], subreddits: ["canarias"], dimBias: { cercania: +0.2 } },
  { id: "actualidad",  label: "Actualidad",    emoji: "📰", keywords: ["política","politica","noticia","gobierno","actualidad","derechos"], subreddits: ["spain","podemos"], dimBias: { reaccionar: +0.2 } },
  { id: "videojuegos", label: "Videojuegos",   emoji: "🎮", keywords: ["videojuego","gaming","consola","steam","juego"], subreddits: ["videojuegos"], dimBias: {} },
  { id: "libros",      label: "Libros e ideas",emoji: "📚", keywords: ["libro","novela","ensayo","filosofía","leer","autor"], subreddits: ["libros"], dimBias: { reaccionar: -0.1 } }
];

const PALETA_CIVICA = [
  { id: "medioambiente", label: "Medio ambiente", emoji: "🌱", keywords: ["clima","reciclaje","huerto","parque","sostenib","verde","residu"], subreddits: ["canarias"], kinds: ["parque"], dimBias: {} },
  { id: "movilidad",     label: "Movilidad",      emoji: "🚌", keywords: ["guagua","bici","carril","peatonal","aparcamiento","movilidad","parada"], subreddits: ["canarias"], dimBias: {} },
  { id: "participacion", label: "Participación",  emoji: "🏛️", keywords: ["asamblea","vecinal","quórum","convocatoria","participa","propuesta","firma","colectiv"], kinds: ["agora-civic","quorum"], dimBias: { reaccionar: +0.5 } },
  { id: "cultura",       label: "Cultura local",  emoji: "🎭", keywords: ["concierto","teatro","taller","cultura","fiesta","romería"], kinds: ["cultura","evento"], dimBias: {} },
  { id: "alimentacion",  label: "Aliment. local", emoji: "🥬", keywords: ["mercadillo","productor","queso","huerta","km0","cooperativa"], kinds: ["productor"], dimBias: { cercania: +0.3 } },
  { id: "barrio",        label: "Barrio",         emoji: "🏘️", keywords: ["vivienda","alquiler","barrio","vecinos","comunidad"], kinds: ["tejido","silla_vacia"], dimBias: { conocidos: +0.2 } }
];

const PRESETS = {
  intereses: { label: "Intereses", emoji: "✦", desc: "entretenimiento y descubrimiento amplio",
               palette: PALETA_AMPLIA, dimBias: {}, civicInject: true, serendipia: 0.75 },
  civico:    { label: "Cívico", emoji: "🏛", desc: "tu barrio, participación real",
               palette: PALETA_CIVICA, dimBias: { reaccionar: +0.4, cercania: +0.3 }, civicInject: false, serendipia: 0.5 }
};

const CIVIC_KINDS = new Set(["quorum", "agora-civic", "silla_vacia", "evento"]);
const INJECT_CADA = 6;   // 1 cívico cada N stumbles en modo Intereses

// -----------------------------------------------------------
let _vistos = new Set();
let _ultimoDiff = null;
let _ctx = null;
let _resActual = null;
let _conteo = 0;
let _boost = null;
let _config = null;       // { preset, intereses: [] }
let _preset = null;       // objeto de PRESETS

function cargarConfig() {
  try {
    const raw = localStorage.getItem(KEY_CONFIG);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (Array.isArray(c)) return { preset: "civico", intereses: c };  // compat formato viejo
    if (c && typeof c === "object" && c.preset) return c;
    return null;
  } catch (e) { return null; }
}
function guardarConfig(c) {
  try { localStorage.setItem(KEY_CONFIG, JSON.stringify(c)); } catch (e) {}
}

function paletaDe(presetId) {
  return (PRESETS[presetId] || PRESETS.intereses).palette;
}

function construirBoost(presetId, ids) {
  const palette = paletaDe(presetId);
  const sel = palette.filter(i => ids.includes(i.id));
  if (sel.length === 0) return null;
  const kws = []; const kinds = new Set();
  for (const i of sel) {
    for (const k of (i.keywords || [])) kws.push(k.toLowerCase());
    for (const k of (i.kinds || [])) kinds.add(k);
  }
  return (res) => {
    const it = res && res.item; if (!it) return 1;
    if (it.kind && kinds.has(it.kind)) return 3.0;
    const txt = ((it.body || "") + " " + (it._view?.name || "") + " " + (it.payload?.titulo || "")).toLowerCase();
    for (const kw of kws) { if (txt.includes(kw)) return 2.5; }
    return 1;
  };
}

function aplicarDimBias(presetId, ids) {
  if (!_ctx.getSliders || !_ctx.setSliders) return;
  const sliders = { ..._ctx.getSliders() };
  const preset = PRESETS[presetId] || PRESETS.intereses;
  const aplicar = (bias) => {
    for (const [dim, delta] of Object.entries(bias || {})) {
      if (typeof sliders[dim] === "number") sliders[dim] = Math.max(-1, Math.min(1, sliders[dim] + delta));
    }
  };
  aplicar(preset.dimBias);
  const palette = paletaDe(presetId);
  for (const i of palette.filter(x => ids.includes(x.id))) aplicar(i.dimBias);
  _ctx.setSliders(sliders);
}

function subredditsDe(presetId, ids) {
  const palette = paletaDe(presetId);
  const out = new Set();
  for (const i of palette.filter(x => ids.includes(x.id))) {
    for (const s of (i.subreddits || [])) out.add(s);
  }
  return [...out];
}

// -----------------------------------------------------------
export function abrirDescubre(ctx) {
  _ctx = ctx || {};
  _vistos = new Set();
  _ultimoDiff = null; _resActual = null; _conteo = 0;
  inyectarHudCss();
  const ov = construirOverlay();
  ov.hidden = false;

  _config = cargarConfig();
  if (!_config) {
    mostrarOnboardingPreset();
  } else {
    _preset = PRESETS[_config.preset] || PRESETS.intereses;
    _boost = construirBoost(_config.preset, _config.intereses || []);
    iniciarStumble();
  }
}

export function cerrarDescubre() {
  const ov = document.getElementById("descubre-overlay");
  if (ov) ov.hidden = true;
  document.removeEventListener("keydown", onKey);
}

function construirOverlay() {
  let ov = document.getElementById("descubre-overlay");
  if (ov) return ov;
  ov = document.createElement("div");
  ov.id = "descubre-overlay";
  ov.className = "descubre-overlay";
  ov.innerHTML = `
    <div class="descubre-stage" id="descubre-stage">
      <div class="descubre-topbar">
        <span class="descubre-title">Descubre</span>
        <div class="descubre-top-actions">
          <button class="descubre-intereses-btn" id="descubre-intereses-btn" title="Cambiar algoritmo / intereses">✦</button>
          <label class="descubre-toggle" title="El pulgar ajusta tu algoritmo">
            <input type="checkbox" id="descubre-aprendizaje"><span>aprende</span>
          </label>
          <button class="descubre-close" id="descubre-close" aria-label="Salir">×</button>
        </div>
      </div>

      <div class="descubre-content" id="descubre-content"></div>

      <div class="descubre-aviso" id="descubre-aviso" hidden></div>

      <div class="descubre-rail" id="descubre-rail" hidden>
        <button class="rail-btn rail-si"   id="descubre-si"   title="Me gusta (→)"><span class="rail-ico">❤</span><span class="rail-lbl">sí</span></button>
        <button class="rail-btn rail-save" id="descubre-save" title="Guardar (↓)"><span class="rail-ico">📌</span><span class="rail-lbl">guardar</span></button>
        <button class="rail-btn rail-no"   id="descubre-no"   title="Menos de esto (←)"><span class="rail-ico">✕</span><span class="rail-lbl">menos</span></button>
        <button class="rail-btn rail-next" id="descubre-next" title="Siguiente (↑)"><span class="rail-ico">↑</span><span class="rail-lbl">otra</span></button>
        <button class="rail-btn rail-undo" id="descubre-undo" title="Deshacer ajuste" hidden><span class="rail-ico">↶</span><span class="rail-lbl">deshacer</span></button>
      </div>

      <div class="descubre-counter" id="descubre-counter"></div>
      <div class="descubre-legend" id="descubre-legend" hidden></div>
    </div>`;
  document.body.appendChild(ov);

  ov.querySelector("#descubre-close").onclick = cerrarDescubre;
  ov.querySelector("#descubre-intereses-btn").onclick = mostrarOnboardingPreset;
  ov.querySelector("#descubre-next").onclick = () => avanzar("up");
  ov.querySelector("#descubre-si").onclick = () => avanzar("right");
  ov.querySelector("#descubre-no").onclick = () => avanzar("left");
  ov.querySelector("#descubre-save").onclick = () => avanzar("down");
  ov.querySelector("#descubre-undo").onclick = deshacer;
  document.addEventListener("keydown", onKey);
  return ov;
}

// -----------------------------------------------------------
// Onboarding paso 1: elegir algoritmo (preset).
function mostrarOnboardingPreset() {
  const ov = document.getElementById("descubre-overlay");
  ov.querySelector("#descubre-rail").hidden = true;
  ov.querySelector("#descubre-counter").textContent = "";
  const cont = ov.querySelector("#descubre-content");
  const actual = (cargarConfig() || {}).preset;

  cont.innerHTML = `
    <div class="onb">
      <h2 class="onb-title">¿Qué Ágora quieres?</h2>
      <p class="onb-sub">Dos algoritmos. Puedes cambiar cuando quieras (✦).</p>
      <div class="onb-presets">
        ${Object.entries(PRESETS).map(([id, p]) => `
          <button class="onb-preset${actual === id ? " is-on" : ""}" data-preset="${id}">
            <span class="onb-preset-emoji">${p.emoji}</span>
            <span class="onb-preset-label">${p.label}</span>
            <span class="onb-preset-desc">${p.desc}</span>
          </button>`).join("")}
      </div>
    </div>`;

  cont.querySelectorAll(".onb-preset").forEach(btn => {
    btn.onclick = () => mostrarOnboardingIntereses(btn.dataset.preset);
  });
}

// Onboarding paso 2: elegir intereses de la paleta del preset.
function mostrarOnboardingIntereses(presetId) {
  const ov = document.getElementById("descubre-overlay");
  const cont = ov.querySelector("#descubre-content");
  const palette = paletaDe(presetId);
  const cfg = cargarConfig();
  const yaSel = new Set((cfg && cfg.preset === presetId) ? (cfg.intereses || []) : []);
  const p = PRESETS[presetId];

  cont.innerHTML = `
    <div class="onb">
      <h2 class="onb-title">${p.emoji} ${p.label}</h2>
      <p class="onb-sub">Marca hasta 6. Sembramos tu algoritmo — luego se afina con tus pulgares.</p>
      <div class="onb-grid">
        ${palette.map(i => `
          <label class="onb-chip${yaSel.has(i.id) ? " is-on" : ""}">
            <input type="checkbox" value="${i.id}" ${yaSel.has(i.id) ? "checked" : ""}>
            <span class="onb-emoji">${i.emoji}</span>
            <span class="onb-label">${i.label}</span>
          </label>`).join("")}
      </div>
      <button class="onb-start" id="onb-start">empezar a descubrir →</button>
      <p class="onb-skip" id="onb-back">‹ volver a elegir algoritmo</p>
    </div>`;

  cont.querySelectorAll(".onb-chip input").forEach(inp => {
    inp.addEventListener("change", () => {
      const marcados = cont.querySelectorAll(".onb-chip input:checked").length;
      if (marcados > 6 && inp.checked) { inp.checked = false; return; }
      inp.closest(".onb-chip").classList.toggle("is-on", inp.checked);
    });
  });

  cont.querySelector("#onb-back").onclick = mostrarOnboardingPreset;
  cont.querySelector("#onb-start").onclick = async () => {
    const ids = [...cont.querySelectorAll(".onb-chip input:checked")].map(i => i.value).slice(0, 6);
    _config = { preset: presetId, intereses: ids };
    guardarConfig(_config);
    _preset = PRESETS[presetId];
    _boost = construirBoost(presetId, ids);
    aplicarDimBias(presetId, ids);

    // Traer contenido real de los subreddits mapeados (Reddit funciona).
    const subs = subredditsDe(presetId, ids);
    if (subs.length && typeof _ctx.ampliarFuentes === "function") {
      cont.innerHTML = `<p class="descubre-vacio">Trayendo contenido de tus intereses…</p>`;
      try { await _ctx.ampliarFuentes({ subreddits: subs }); } catch (e) {}
    }
    iniciarStumble();
  };
}

// -----------------------------------------------------------
function iniciarStumble() {
  const ov = document.getElementById("descubre-overlay");
  ov.querySelector("#descubre-rail").hidden = false;
  const tog = ov.querySelector("#descubre-aprendizaje");
  if (tog) tog.checked = _ctx.aprendizaje !== false;
  _vistos = new Set(); _conteo = 0;
  // Leyenda de gestos la primera vez.
  if (!localStorage.getItem(KEY_LEGEND)) mostrarLeyenda();
  avanzar(null, true);
}

function mostrarLeyenda() {
  const el = document.getElementById("descubre-legend");
  if (!el) return;
  el.innerHTML = `
    <div class="legend-box">
      <div class="legend-title">desliza la tarjeta</div>
      <div class="legend-grid">
        <span>↑ siguiente</span>
        <span>→ me gusta</span>
        <span>↓ guardar</span>
        <span>← menos de esto</span>
      </div>
      <button id="legend-ok">entendido</button>
    </div>`;
  el.hidden = false;
  el.querySelector("#legend-ok").onclick = () => {
    el.hidden = true;
    try { localStorage.setItem(KEY_LEGEND, "1"); } catch (e) {}
  };
}

// dir: "up" | "right" | "down" | "left" | null(=up). primero salta acción.
function avanzar(dir, primero = false) {
  const ov = document.getElementById("descubre-overlay");
  if (!ov) return;
  const d = dir || "up";

  if (!primero && _resActual) {
    const item = _resActual.item;
    if (d === "down") {
      // Guardar.
      if (typeof _ctx.onGuardar === "function") _ctx.onGuardar(item);
      toast("📌 guardado");
    } else if (d === "right" || d === "left") {
      const signo = d === "right" ? +1 : -1;
      if (typeof _ctx.onSenal === "function") _ctx.onSenal(item, signo);
      const aprende = ov.querySelector("#descubre-aprendizaje")?.checked;
      if (aprende) {
        const sliders = _ctx.getSliders ? _ctx.getSliders() : {};
        const rate = typeof _ctx.learningRate === "number" ? _ctx.learningRate : 0.10;
        const { sliders: nuevos, diff } = aprenderDeFeedback(sliders, item, signo, rate);
        if (Object.keys(diff).length > 0) {
          _ultimoDiff = { antes: sliders };
          if (_ctx.setSliders) _ctx.setSliders(nuevos);
          mostrarAviso(diff);
          ov.querySelector("#descubre-undo").hidden = false;
        }
      }
    }
    // "up" → nada, solo avanza.
  }

  // Elegir siguiente.
  const ranked = (_ctx.getRanked ? _ctx.getRanked() : []) || [];
  let res;
  // Incentivo cívico: cada INJECT_CADA stumbles en modo intereses,
  // forzamos un item cívico de participación.
  if (_preset && _preset.civicInject && _conteo > 0 && _conteo % INJECT_CADA === 0) {
    res = pickCivico(ranked) || pickStumble(ranked, { serendipia: _preset.serendipia, vistos: _vistos, boost: _boost });
    if (res) toast("✦ del tejido cívico");
  } else {
    res = pickStumble(ranked, {
      serendipia: _preset ? _preset.serendipia : 0.7,
      vistos: _vistos, boost: _boost
    });
  }
  _resActual = res;
  _conteo++;
  renderCard(res);
  const counter = ov.querySelector("#descubre-counter");
  if (counter) counter.textContent = `${_conteo} descubiertos`;
}

function pickCivico(ranked) {
  const cand = ranked.filter(r => {
    const id = r?.item?.id;
    if (id != null && _vistos.has(String(id))) return false;
    return r.item && CIVIC_KINDS.has(r.item.kind);
  });
  if (cand.length === 0) return null;
  const res = cand[Math.floor(Math.random() * cand.length)];
  const id = res?.item?.id;
  if (id != null) _vistos.add(String(id));
  return res;
}

function renderCard(res) {
  const cont = document.getElementById("descubre-content");
  if (!cont) return;
  cont.innerHTML = "";
  if (!res || !res.item) {
    cont.innerHTML = `<p class="descubre-vacio">No hay nada que descubrir con estos filtros.<br>Toca ✦ para cambiar algoritmo o revisa fuentes en ⚙.</p>`;
    return;
  }
  const post = res.item;
  const v = post._view || {};
  const card = document.createElement("div");
  card.className = "descubre-card";

  const geo = post.geo && post.geo.zona ? "◉ " + post.geo.zona : "◉ sin geo";
  const head = document.createElement("div");
  head.className = "descubre-card-head";
  head.innerHTML = `<span class="descubre-geo">${geo}</span>
                    <span class="descubre-source">${post.source_label || (post.source || "").toUpperCase()}</span>`;
  const title = document.createElement("div");
  title.className = "descubre-card-title";
  const t = v.name || post.payload?.titulo || post.author?.handle || "";
  if (t) title.textContent = t;
  const body = document.createElement("div");
  body.className = "descubre-card-body";
  body.textContent = post.body || v.desc || "";
  const hud = document.createElement("div");
  hud.className = "post-hud descubre-hud";
  mountHud(hud, res, _ctx.dimsMeta);
  card.append(head, title, body, hud);
  if (post.url_origen) {
    const a = document.createElement("a");
    a.className = "descubre-link";
    a.href = post.url_origen; a.target = "_blank"; a.rel = "noopener noreferrer";
    a.textContent = "abrir en origen ↗";
    card.appendChild(a);
  }
  cont.appendChild(card);
  activarDrag(card);
}

// -----------------------------------------------------------
// Drag/swipe con feedback visual. La tarjeta sigue al dedo; al soltar,
// si pasa el umbral en una dirección, dispara esa acción.
function activarDrag(card) {
  let x0 = null, y0 = null, dragging = false;
  const UMBRAL = 70;

  const start = (x, y) => { x0 = x; y0 = y; dragging = true; card.style.transition = "none"; };
  const move = (x, y) => {
    if (!dragging) return;
    const dx = x - x0, dy = y - y0;
    card.style.transform = `translate(${dx * 0.6}px, ${dy * 0.6}px) rotate(${dx * 0.02}deg)`;
    // Tinte direccional.
    let tint = "transparent";
    if (Math.abs(dx) > Math.abs(dy)) tint = dx > 0 ? "rgba(255,90,122,0.18)" : "rgba(255,255,255,0.10)";
    else tint = dy > 0 ? "rgba(201,168,106,0.18)" : "rgba(120,160,255,0.12)";
    card.style.background = tint;
    hintDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"),
            Math.max(Math.abs(dx), Math.abs(dy)) > UMBRAL);
  };
  const end = (x, y) => {
    if (!dragging) return; dragging = false;
    const dx = x - x0, dy = y - y0;
    card.style.transition = "transform 180ms ease, background 180ms ease";
    card.style.transform = ""; card.style.background = "";
    clearHint();
    if (Math.max(Math.abs(dx), Math.abs(dy)) < UMBRAL) return;  // snap back
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
    avanzar(dir);
  };

  card.addEventListener("touchstart", e => { const t = e.changedTouches[0]; start(t.clientX, t.clientY); }, { passive: true });
  card.addEventListener("touchmove",  e => { const t = e.changedTouches[0]; move(t.clientX, t.clientY); }, { passive: true });
  card.addEventListener("touchend",   e => { const t = e.changedTouches[0]; end(t.clientX, t.clientY); }, { passive: true });
  // Ratón (desktop): permitir arrastrar también.
  card.addEventListener("mousedown", e => start(e.clientX, e.clientY));
  window.addEventListener("mousemove", e => { if (dragging) move(e.clientX, e.clientY); });
  window.addEventListener("mouseup",   e => { if (dragging) end(e.clientX, e.clientY); });
}

function hintDir(dir, activo) {
  const map = { up: "#descubre-next", right: "#descubre-si", down: "#descubre-save", left: "#descubre-no" };
  const ov = document.getElementById("descubre-overlay");
  ov?.querySelectorAll(".rail-btn").forEach(b => b.classList.remove("is-armed"));
  if (activo) ov?.querySelector(map[dir])?.classList.add("is-armed");
}
function clearHint() {
  document.getElementById("descubre-overlay")?.querySelectorAll(".rail-btn").forEach(b => b.classList.remove("is-armed"));
}

function toast(txt) {
  const el = document.getElementById("descubre-aviso");
  if (!el) return;
  el.textContent = txt; el.hidden = false;
  clearTimeout(el._t); el._t = setTimeout(() => el.hidden = true, 1400);
}

function mostrarAviso(diff) {
  const el = document.getElementById("descubre-aviso");
  if (!el) return;
  const txt = describirDiff(diff, _ctx.dimsMeta);
  if (!txt) { el.hidden = true; return; }
  el.textContent = "ajusté tu algoritmo: " + txt;
  el.hidden = false;
  clearTimeout(el._t); el._t = setTimeout(() => { el.hidden = true; }, 2600);
}

function deshacer() {
  if (!_ultimoDiff) return;
  if (_ctx.setSliders) _ctx.setSliders(_ultimoDiff.antes);
  _ultimoDiff = null;
  document.getElementById("descubre-undo")?.setAttribute("hidden", "true");
  toast("ajuste deshecho");
}

function onKey(ev) {
  const ov = document.getElementById("descubre-overlay");
  if (!ov || ov.hidden) return;
  if (ev.key === "Escape") cerrarDescubre();
  else if (ev.key === "ArrowUp") avanzar("up");
  else if (ev.key === "ArrowRight") avanzar("right");
  else if (ev.key === "ArrowDown") { ev.preventDefault(); avanzar("down"); }
  else if (ev.key === "ArrowLeft") avanzar("left");
}

function inyectarHudCss() {
  if (document.getElementById("hud-style")) return;
  const style = document.createElement("style");
  style.id = "hud-style";
  style.textContent = HUD_CSS || "";
  document.head.appendChild(style);
}
