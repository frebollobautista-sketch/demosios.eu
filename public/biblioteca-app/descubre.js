// biblioteca-app/descubre.js — Modo "Descubre" formativo.
//
// Hermano del Descubre de Ágora, pero contemplativo:
//   - serendipia baja (más guiado, no salta tan lejos)
//   - aprendizaje lento (rate 0.05 — sin saltos bruscos en estudio)
//   - sin cap de dosis (explorar formación es sano)
//   - dos algoritmos: 📖 Temario (canónico, opositor) / ✦ Cultivo (crítico)
//   - gestos 4-dir: ↑ siguiente · → me gusta · ↓ guardar · ← menos
//
// Stumblea por TODO el feed de la Biblioteca: epígrafes mnemoHACK,
// epígrafes pendientes (sillas), fuentes críticas (sillas) y grupos de
// lectura. Todo entra por `ctx`.

import { pickStumble, aprenderDeFeedback, describirDiff } from "../shared/stumble.js?v=20260527e";
import { mountHud, HUD_CSS } from "../shared/hud.js?v=20260527a";

const KEY_CONFIG = "biblioteca-descubre-config";
const KEY_LEGEND = "biblioteca-descubre-legend";

// 9 palacios del temario (áreas canónicas). Cada uno boostea sus temas.
const PALETA_TEMARIO = [
  { id: "p1", label: "Función pública",     emoji: "🏛", temas: ["t1","t2","t3"] },
  { id: "p2", label: "Derecho laboral y SS", emoji: "⚖️", temas: ["t4","t5"] },
  { id: "p3", label: "Hacienda e ingresos", emoji: "🏦", temas: ["t6","t7","t8","t9","t10","t11","t12"] },
  { id: "p4", label: "Presupuestos y REF",  emoji: "🏝", temas: ["t13","t14","t15","t16","t17"] },
  { id: "p5", label: "Igualdad",            emoji: "♀", temas: ["t18"] },
  { id: "p6", label: "Corporaciones y UE",  emoji: "🚢", temas: ["t19","t20","t21"] },
  { id: "p7", label: "Inmigración y demografía", emoji: "🛂", temas: ["t22","t23"] },
  { id: "p8", label: "Fondos y PEC",        emoji: "🇪🇺", temas: ["t24","t25"] },
  { id: "p9", label: "Gestión pública",     emoji: "🎯", temas: ["t26"] }
];

// Corrientes críticas (cultivo). Boost por keyword en el cuerpo.
const PALETA_CULTIVO = [
  { id: "republicanismo", label: "Republicanismo", emoji: "🏛", keywords: ["pettit","skinner","libertad","dominación","dominacion","república","republica","domènech","domenech"] },
  { id: "rentabasica",    label: "Renta básica",    emoji: "💶", keywords: ["renta básica","renta basica","raventós","raventos","standing","precariado","van parijs","ingreso"] },
  { id: "marxismo",       label: "Marxismo",        emoji: "☭", keywords: ["marx","capital","plusvalía","plusvalia","clase","harvey","engels","manifiesto"] },
  { id: "democracia",     label: "Democracia",      emoji: "🗳", keywords: ["democracia","mouffe","rancière","ranciere","populismo","pluralismo","agonismo"] },
  { id: "ecologia",       label: "Ecología política", emoji: "🌍", keywords: ["ecología","ecologia","riechmann","decrecimiento","clima","latour","sostenib"] },
  { id: "teoriacritica",  label: "Teoría crítica",  emoji: "🧠", keywords: ["ideología","ideologia","žižek","zizek","hegemonía","hegemonia","gramsci","foucault"] }
];

const PRESETS = {
  temario: { label: "Temario", emoji: "📖", desc: "lo que entra en el examen, canónico",
             palette: PALETA_TEMARIO, dimBias: { canonico: -0.5 }, serendipia: 0.30, learningRate: 0.05 },
  cultivo: { label: "Cultivo", emoji: "✦", desc: "capital cultural crítico, saltos laterales",
             palette: PALETA_CULTIVO, dimBias: { canonico: +0.5, navegacion: +0.4 }, serendipia: 0.50, learningRate: 0.05 }
};

let _vistos = new Set();
let _ultimoDiff = null;
let _ctx = null;
let _resActual = null;
let _conteo = 0;
let _boost = null;
let _config = null;
let _preset = null;

function stripHtml(html, maxLen) {
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  let t = (tmp.textContent || "").replace(/\s+/g, " ").trim();
  if (maxLen && t.length > maxLen) t = t.slice(0, maxLen) + "…";
  return t;
}

function cargarConfig() {
  try {
    const raw = localStorage.getItem(KEY_CONFIG);
    if (!raw) return null;
    const c = JSON.parse(raw);
    return (c && c.preset) ? c : null;
  } catch (e) { return null; }
}
function guardarConfig(c) { try { localStorage.setItem(KEY_CONFIG, JSON.stringify(c)); } catch (e) {} }

function paletaDe(presetId) { return (PRESETS[presetId] || PRESETS.cultivo).palette; }

function temaDe(item) {
  return item?.tema_id || item?.payload?.tema_id ||
         (typeof item?.payload?.fuente_id === "string" && item.payload.fuente_id.startsWith("t")
            ? item.payload.fuente_id.split(":")[0] : null) || null;
}

function construirBoost(presetId, ids) {
  const palette = paletaDe(presetId);
  const sel = palette.filter(i => ids.includes(i.id));
  if (sel.length === 0) return null;
  const temas = new Set();
  const kws = [];
  for (const i of sel) {
    for (const t of (i.temas || [])) temas.add(t);
    for (const k of (i.keywords || [])) kws.push(k.toLowerCase());
  }
  return (res) => {
    const it = res && res.item; if (!it) return 1;
    const tema = temaDe(it);
    if (tema && temas.has(tema)) return 3.0;
    if (kws.length) {
      const txt = ((it.body || "") + " " + stripHtml(it.resumen_html, 600) + " " +
                   (it.payload?.titulo || "") + " " + (it.author?.handle || "")).toLowerCase();
      for (const kw of kws) { if (txt.includes(kw)) return 2.5; }
    }
    return 1;
  };
}

function aplicarDimBias(presetId, ids) {
  if (!_ctx.getSliders || !_ctx.setSliders) return;
  const sliders = { ..._ctx.getSliders() };
  const preset = PRESETS[presetId] || PRESETS.cultivo;
  for (const [dim, delta] of Object.entries(preset.dimBias || {})) {
    if (typeof sliders[dim] === "number") sliders[dim] = Math.max(-1, Math.min(1, sliders[dim] + delta));
  }
  _ctx.setSliders(sliders);
}

// -----------------------------------------------------------
export function abrirDescubre(ctx) {
  _ctx = ctx || {};
  _vistos = new Set(); _ultimoDiff = null; _resActual = null; _conteo = 0;
  inyectarHudCss();
  const ov = construirOverlay();
  ov.hidden = false;
  _config = cargarConfig();
  if (!_config) mostrarOnboardingPreset();
  else {
    _preset = PRESETS[_config.preset] || PRESETS.cultivo;
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
        <span class="descubre-title">Descubre una idea</span>
        <div class="descubre-top-actions">
          <button class="descubre-intereses-btn" id="descubre-intereses-btn" title="Cambiar algoritmo / áreas">✦</button>
          <label class="descubre-toggle" title="El pulgar ajusta tu algoritmo"><input type="checkbox" id="descubre-aprendizaje"><span>aprende</span></label>
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

function mostrarOnboardingPreset() {
  const ov = document.getElementById("descubre-overlay");
  ov.querySelector("#descubre-rail").hidden = true;
  ov.querySelector("#descubre-counter").textContent = "";
  const cont = ov.querySelector("#descubre-content");
  const actual = (cargarConfig() || {}).preset;
  cont.innerHTML = `
    <div class="onb">
      <h2 class="onb-title">¿Qué quieres cultivar?</h2>
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
    btn.onclick = () => mostrarOnboardingAreas(btn.dataset.preset);
  });
}

function mostrarOnboardingAreas(presetId) {
  const ov = document.getElementById("descubre-overlay");
  const cont = ov.querySelector("#descubre-content");
  const palette = paletaDe(presetId);
  const cfg = cargarConfig();
  const yaSel = new Set((cfg && cfg.preset === presetId) ? (cfg.intereses || []) : []);
  const p = PRESETS[presetId];
  cont.innerHTML = `
    <div class="onb">
      <h2 class="onb-title">${p.emoji} ${p.label}</h2>
      <p class="onb-sub">Marca hasta 6 áreas. Sembramos tu algoritmo — se afina con tus pulgares.</p>
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
      const n = cont.querySelectorAll(".onb-chip input:checked").length;
      if (n > 6 && inp.checked) { inp.checked = false; return; }
      inp.closest(".onb-chip").classList.toggle("is-on", inp.checked);
    });
  });
  cont.querySelector("#onb-back").onclick = mostrarOnboardingPreset;
  cont.querySelector("#onb-start").onclick = () => {
    const ids = [...cont.querySelectorAll(".onb-chip input:checked")].map(i => i.value).slice(0, 6);
    _config = { preset: presetId, intereses: ids };
    guardarConfig(_config);
    _preset = PRESETS[presetId];
    _boost = construirBoost(presetId, ids);
    aplicarDimBias(presetId, ids);
    iniciarStumble();
  };
}

function iniciarStumble() {
  const ov = document.getElementById("descubre-overlay");
  ov.querySelector("#descubre-rail").hidden = false;
  const tog = ov.querySelector("#descubre-aprendizaje");
  if (tog) tog.checked = _ctx.aprendizaje !== false;
  _vistos = new Set(); _conteo = 0;
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
        <span>↑ siguiente</span><span>→ me gusta</span>
        <span>↓ guardar</span><span>← menos de esto</span>
      </div>
      <button id="legend-ok">entendido</button>
    </div>`;
  el.hidden = false;
  el.querySelector("#legend-ok").onclick = () => { el.hidden = true; try { localStorage.setItem(KEY_LEGEND, "1"); } catch (e) {} };
}

function avanzar(dir, primero = false) {
  const ov = document.getElementById("descubre-overlay");
  if (!ov) return;
  const d = dir || "up";
  if (!primero && _resActual) {
    const item = _resActual.item;
    if (d === "down") {
      if (typeof _ctx.onGuardar === "function") _ctx.onGuardar(item);
      toast("📌 guardado");
    } else if (d === "right" || d === "left") {
      const signo = d === "right" ? +1 : -1;
      if (typeof _ctx.onSenal === "function") _ctx.onSenal(item, signo);
      const aprende = ov.querySelector("#descubre-aprendizaje")?.checked;
      if (aprende) {
        const sliders = _ctx.getSliders ? _ctx.getSliders() : {};
        const rate = _preset ? _preset.learningRate : 0.05;
        const { sliders: nuevos, diff } = aprenderDeFeedback(sliders, item, signo, rate);
        if (Object.keys(diff).length > 0) {
          _ultimoDiff = { antes: sliders };
          if (_ctx.setSliders) _ctx.setSliders(nuevos);
          mostrarAviso(diff);
          ov.querySelector("#descubre-undo").hidden = false;
        }
      }
    }
  }
  const ranked = (_ctx.getRanked ? _ctx.getRanked() : []) || [];
  const res = pickStumble(ranked, {
    serendipia: _preset ? _preset.serendipia : 0.4,
    vistos: _vistos, boost: _boost
  });
  _resActual = res;
  _conteo++;
  renderCard(res);
  const counter = ov.querySelector("#descubre-counter");
  if (counter) counter.textContent = `${_conteo} descubiertos`;
}

function renderCard(res) {
  const cont = document.getElementById("descubre-content");
  if (!cont) return;
  cont.innerHTML = "";
  if (!res || !res.item) {
    cont.innerHTML = `<p class="descubre-vacio">No hay nada que descubrir con estas áreas.<br>Toca ✦ para cambiar de algoritmo.</p>`;
    return;
  }
  const it = res.item;
  const card = document.createElement("div");
  card.className = "descubre-card";

  const tema = temaDe(it);
  const etiqueta = it.source_label || (tema ? "EPÍGRAFE" : (it.kind || "").toUpperCase());
  const head = document.createElement("div");
  head.className = "descubre-card-head";
  head.innerHTML = `<span class="descubre-geo">${tema ? "§ " + tema : "✦"}</span>
                    <span class="descubre-source">${etiqueta}</span>`;

  const title = document.createElement("div");
  title.className = "descubre-card-title";
  const t = it._view?.name || it.payload?.titulo || it.author?.handle ||
            (tema ? `${tema} / ${it.epi_id || it.payload?.epi_id || ""}` : "");
  if (t) title.textContent = t;

  const body = document.createElement("div");
  body.className = "descubre-card-body";
  body.textContent = it.body || stripHtml(it.resumen_html, 1200) || it._view?.desc || "";

  const hud = document.createElement("div");
  hud.className = "post-hud descubre-hud";
  mountHud(hud, res, _ctx.dimsMeta);

  card.append(head, title, body, hud);
  cont.appendChild(card);
  activarDrag(card);
}

function activarDrag(card) {
  let x0 = null, y0 = null, dragging = false;
  const UMBRAL = 70;
  const start = (x, y) => { x0 = x; y0 = y; dragging = true; card.style.transition = "none"; };
  const move = (x, y) => {
    if (!dragging) return;
    const dx = x - x0, dy = y - y0;
    card.style.transform = `translate(${dx * 0.6}px, ${dy * 0.6}px) rotate(${dx * 0.02}deg)`;
    let tint = "transparent";
    if (Math.abs(dx) > Math.abs(dy)) tint = dx > 0 ? "rgba(255,90,122,0.16)" : "rgba(255,255,255,0.09)";
    else tint = dy > 0 ? "rgba(201,168,106,0.16)" : "rgba(120,160,255,0.12)";
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
    if (Math.max(Math.abs(dx), Math.abs(dy)) < UMBRAL) return;
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
    avanzar(dir);
  };
  card.addEventListener("touchstart", e => { const t = e.changedTouches[0]; start(t.clientX, t.clientY); }, { passive: true });
  card.addEventListener("touchmove",  e => { const t = e.changedTouches[0]; move(t.clientX, t.clientY); }, { passive: true });
  card.addEventListener("touchend",   e => { const t = e.changedTouches[0]; end(t.clientX, t.clientY); }, { passive: true });
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
  style.id = "hud-style"; style.textContent = HUD_CSS || "";
  document.head.appendChild(style);
}
