// biblioteca-app/libro-lector.js — Visor de PDF con subrayado en línea.
//
// Calcado conceptualmente de recursos-lector.js (mismo flujo selección →
// subrayar/nota/síntesis, mismo "Mis apuntes"), pero sobre un PDF renderizado
// con pdf.js en vez de párrafos HTML. Las anotaciones se guardan en el MISMO
// almacén que el Lector (clave biblioteca-recursos-anotaciones-v1), indexadas
// por doc_id — así contarAnotaciones() ya las cuenta y el panal del cursus las
// recoge en G5 sin tocar nada más.
//
// Anclaje de subrayados: a diferencia del Lector (índice de párrafo + offset),
// aquí guardamos rectángulos NORMALIZADOS (0..1 respecto al tamaño de la
// página) + la cita. Es robusto al re-render y a cambios de escala, y no
// depende de re-anclar texto entre los <span> de la capa de texto.
//
// pdf.js se carga vía CDN ESM (sin build). Única dependencia externa nueva.

import { getPDF, getMeta } from "./libros-store.js?v=20260603-libros";

const PDFJS_VER  = "4.7.76";
const PDFJS_BASE = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VER}/`;
const PDFJS_URL  = `${PDFJS_BASE}build/pdf.min.mjs`;
const WORKER_URL = `${PDFJS_BASE}build/pdf.worker.min.mjs`;
// Fuentes estándar (Helvetica, Times…) y CMaps: imprescindibles para que el
// RASTERIZADO de canvas no se cuelgue en PDFs que NO embeben sus fuentes (la
// extracción de texto no las necesita, pero el render sí).
const STD_FONTS_URL = `${PDFJS_BASE}standard_fonts/`;
const CMAP_URL = `${PDFJS_BASE}cmaps/`;

// Mismo store que el Lector de recursos: los subrayados son metadatos del
// archivo, separados del binario, y se cuentan con contarAnotaciones(doc_id).
const KEY_ANOTACIONES = "biblioteca-recursos-anotaciones-v1";
const COLOR_DEFAULT = "ocre";
const ESCALA = 1.4;

// ─────────────── carga perezosa de pdf.js ───────────────
let _pdfjs = null;
async function pdfjs() {
  if (_pdfjs) return _pdfjs;
  const lib = await import(/* @vite-ignore */ PDFJS_URL);
  try { lib.GlobalWorkerOptions.workerSrc = WORKER_URL; } catch { /**/ }
  _pdfjs = lib;
  return lib;
}

// Capa de texto seleccionable. pdf.js v4 expone la clase TextLayer; versiones
// antiguas exponían renderTextLayer(). Soportamos ambas por robustez.
async function renderCapaTexto(lib, textContent, container, viewport) {
  if (typeof lib.TextLayer === "function") {
    const tl = new lib.TextLayer({ textContentSource: textContent, container, viewport });
    await tl.render();
    return;
  }
  if (typeof lib.renderTextLayer === "function") {
    const task = lib.renderTextLayer({ textContentSource: textContent, container, viewport, textDivs: [] });
    if (task && task.promise) await task.promise;
    return;
  }
  throw new Error("pdf.js sin API de capa de texto");
}

// ─────────────── persistencia (idéntica al Lector) ───────────────
function cargarTodas() {
  try { return JSON.parse(localStorage.getItem(KEY_ANOTACIONES) || "{}") || {}; }
  catch { return {}; }
}
function guardarTodas(obj) {
  try { localStorage.setItem(KEY_ANOTACIONES, JSON.stringify(obj)); } catch { /**/ }
}
function anotacionesDe(docId) {
  const all = cargarTodas();
  return Array.isArray(all[docId]) ? all[docId] : [];
}
function setAnotacionesDe(docId, lista) {
  const all = cargarTodas();
  all[docId] = lista;
  guardarTodas(all);
}

function uid() {
  return "lib-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
}
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ─────────────── API principal ───────────────
// abrirLibroLector(docId, { onCerrar?(docId), onSintetizar?(detail) })
export async function abrirLibroLector(docId, opts = {}) {
  const meta = await getMeta(docId);
  const buf = await getPDF(docId);

  const ov = document.createElement("div");
  ov.className = "libro-overlay";
  ov.innerHTML = `
    <div class="libro-sheet" role="dialog" aria-modal="true" aria-label="${esc(meta?.titulo || "Libro")}">
      <header class="libro-top">
        <button class="libro-cerrar" type="button" aria-label="Volver">←</button>
        <div class="libro-top-meta">
          <span class="libro-top-tit">${esc(meta?.titulo || "")}</span>
          <span class="libro-top-sub">${esc(meta?.autor || "")}</span>
        </div>
        <button class="libro-apuntes-btn" type="button" aria-label="Mis apuntes">
          ✎ <span class="libro-apuntes-n">0</span>
        </button>
      </header>
      <div class="libro-cuerpo"><div class="libro-cargando">Cargando PDF…</div></div>
    </div>
    <div class="lector-selbar libro-selbar" hidden role="toolbar" aria-label="Acciones de selección">
      <button data-act="sub" type="button">⎯ Subrayar</button>
      <button data-act="nota" type="button">✎ Nota</button>
      <button data-act="sint" type="button">→ Síntesis</button>
    </div>`;
  document.body.appendChild(ov);
  document.body.style.overflow = "hidden";

  const cuerpo = ov.querySelector(".libro-cuerpo");
  const selbar = ov.querySelector(".libro-selbar");
  const apuntesN = ov.querySelector(".libro-apuntes-n");
  const pageEls = {};   // page → { wrap, hlDiv }

  function refreshN() { apuntesN.textContent = anotacionesDe(docId).length; }
  refreshN();

  function cerrar() {
    document.body.style.overflow = "";
    document.removeEventListener("selectionchange", onSelChange);
    ov.remove();
    opts.onCerrar?.(docId);
  }
  ov.querySelector(".libro-cerrar").addEventListener("click", cerrar);

  if (!buf) {
    cuerpo.innerHTML = `<div class="libro-error">No encuentro el PDF en este navegador. ¿Lo añadiste en otro dispositivo? (path A es local).</div>`;
    return { cerrar };
  }

  // ── render del PDF ──
  try {
    const lib = await pdfjs();
    const doc = await lib.getDocument({
      data: buf.slice(0),
      cMapUrl: CMAP_URL,
      cMapPacked: true,
      standardFontDataUrl: STD_FONTS_URL
    }).promise;
    cuerpo.innerHTML = "";
    let textTotal = 0;
    const canvasJobs = [];

    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: ESCALA });

      const wrap = document.createElement("div");
      wrap.className = "libro-page";
      wrap.dataset.page = String(n);
      wrap.style.width = Math.floor(viewport.width) + "px";
      wrap.style.height = Math.floor(viewport.height) + "px";

      const canvas = document.createElement("canvas");
      canvas.className = "libro-canvas";
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      const hlDiv = document.createElement("div");
      hlDiv.className = "libro-highlights";

      const textDiv = document.createElement("div");
      textDiv.className = "libro-textlayer";
      // pdf.js >=3 exige --scale-factor para posicionar bien los <span>.
      textDiv.style.setProperty("--scale-factor", String(ESCALA));

      wrap.appendChild(canvas);
      wrap.appendChild(hlDiv);
      wrap.appendChild(textDiv);
      cuerpo.appendChild(wrap);

      // 1) Capa de texto PRIMERO: el subrayado queda interactivo de inmediato,
      // sin esperar al rasterizado (que es lo lento y lo que en headless cuelga).
      const tc = await page.getTextContent();
      textTotal += tc.items.reduce((a, it) => a + (it.str ? it.str.length : 0), 0);
      try {
        await renderCapaTexto(lib, tc, textDiv, viewport);
      } catch (e) {
        console.warn("[libro-lector] textLayer p" + n + ":", e);
      }

      pageEls[n] = { wrap, hlDiv };
      // 2) Canvas (la imagen de la página) en SEGUNDO PLANO: no bloquea el
      // texto ni la anotación.
      canvasJobs.push(() => page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise);
    }

    if (textTotal < 8) {
      const aviso = document.createElement("div");
      aviso.className = "libro-aviso-ocr";
      aviso.textContent =
        "Este PDF parece escaneado (sin capa de texto): no se puede subrayar. Haría falta OCR (siguiente versión).";
      cuerpo.insertBefore(aviso, cuerpo.firstChild);
    }
    pintarHighlights();

    // Rasteriza las páginas en segundo plano, secuencialmente (no bloquea la
    // interacción). Si un render se cuelga/falla, paramos sin romper el texto.
    (async () => {
      for (const job of canvasJobs) {
        try { await job(); } catch (e) { console.warn("[libro-lector] canvas:", e); break; }
      }
    })();
  } catch (e) {
    console.warn("[libro-lector] render:", e);
    cuerpo.innerHTML = `<div class="libro-error">No pude renderizar el PDF: ${esc(e && e.message || e)}</div>`;
    return { cerrar };
  }

  // ── pintar resaltados existentes como overlay de rects ──
  function pintarHighlights() {
    const anots = anotacionesDe(docId);
    for (const n in pageEls) pageEls[n].hlDiv.innerHTML = "";
    for (const a of anots) {
      const pe = pageEls[a.page];
      if (!pe || !Array.isArray(a.rects)) continue;
      const W = pe.wrap.clientWidth, H = pe.wrap.clientHeight;
      for (const r of a.rects) {
        const d = document.createElement("div");
        d.className = "libro-hl hl-" + (a.color || COLOR_DEFAULT) + (a.nota ? " has-nota" : "");
        d.style.left = (r.x * W) + "px";
        d.style.top = (r.y * H) + "px";
        d.style.width = (r.w * W) + "px";
        d.style.height = (r.h * H) + "px";
        d.dataset.hid = a.id;
        pe.hlDiv.appendChild(d);
      }
    }
    refreshN();
  }

  // ── selección → medir (page, rects normalizados, quote) ──
  let pendiente = null;
  function medirSeleccion() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    const quote = sel.toString().replace(/\s+/g, " ").trim();
    if (!quote) return null;
    let node = range.startContainer;
    let el = node.nodeType === 1 ? node : node.parentElement;
    const pageEl = el && el.closest(".libro-page");
    if (!pageEl || !cuerpo.contains(pageEl)) return null;
    const page = +pageEl.dataset.page;
    const pb = pageEl.getBoundingClientRect();
    const W = pb.width || 1, H = pb.height || 1;
    const rects = Array.from(range.getClientRects())
      .filter(r => r.width > 0.5 && r.height > 0.5)
      .map(r => ({
        x: (r.left - pb.left) / W,
        y: (r.top - pb.top) / H,
        w: r.width / W,
        h: r.height / H
      }));
    if (!rects.length) return null;
    return { page, rects, quote };
  }

  function colocarSelbar() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) { selbar.hidden = true; return; }
    const r = sel.getRangeAt(0).getBoundingClientRect();
    if (!r || (r.width === 0 && r.height === 0)) { selbar.hidden = true; return; }
    selbar.hidden = false;
    const bw = selbar.offsetWidth || 220;
    const bh = selbar.offsetHeight || 42;
    let top = r.top - bh - 10;
    if (top < 10) top = r.bottom + 10;
    let left = r.left + r.width / 2 - bw / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - bw - 8));
    selbar.style.top = top + "px";
    selbar.style.left = left + "px";
  }

  function onSelChange() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) { selbar.hidden = true; pendiente = null; return; }
    const anchorEl = sel.anchorNode &&
      (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
    if (!anchorEl || !cuerpo.contains(anchorEl)) { selbar.hidden = true; return; }
    pendiente = medirSeleccion();
    if (pendiente) colocarSelbar(); else selbar.hidden = true;
  }
  document.addEventListener("selectionchange", onSelChange);

  // ── crear subrayado ──
  function nuevoSubrayado(extra) {
    if (!pendiente) return null;
    const rec = {
      id: uid(), page: pendiente.page, rects: pendiente.rects,
      quote: pendiente.quote, color: COLOR_DEFAULT, nota: "", ts: Date.now(),
      ...(extra || {})
    };
    const lista = anotacionesDe(docId);
    lista.push(rec);
    setAnotacionesDe(docId, lista);
    window.getSelection()?.removeAllRanges();
    selbar.hidden = true;
    pendiente = null;
    pintarHighlights();
    return rec;
  }

  selbar.addEventListener("click", (e) => {
    const act = e.target.closest("button")?.dataset.act;
    if (!act) return;
    if (act === "sub") {
      nuevoSubrayado();
    } else if (act === "nota") {
      const r = nuevoSubrayado();
      if (r) abrirNota(r.id);
    } else if (act === "sint") {
      const cita = pendiente?.quote;
      nuevoSubrayado();
      if (cita) enviarASintesis(cita, "");
    }
  });

  // tap en un resaltado → abrir su nota
  cuerpo.addEventListener("click", (e) => {
    const mk = e.target.closest(".libro-hl");
    if (mk) abrirNota(mk.dataset.hid);
  });

  // ── bottom-sheet de nota (reutiliza estilos .lector-sheet-modal) ──
  function abrirNota(hid) {
    const lista = anotacionesDe(docId);
    const rec = lista.find(a => a.id === hid);
    if (!rec) return;
    const sheet = document.createElement("div");
    sheet.className = "lector-sheet-modal";
    sheet.innerHTML = `
      <div class="sheet-card">
        <blockquote class="sheet-cita">${esc(rec.quote)}</blockquote>
        <textarea class="sheet-ta" rows="4" placeholder="Tu anotación…">${esc(rec.nota || "")}</textarea>
        <div class="sheet-acciones">
          <button data-act="borrar" type="button" class="sheet-borrar">Borrar</button>
          <span class="sheet-spacer"></span>
          <button data-act="sint" type="button">→ Síntesis</button>
          <button data-act="guardar" type="button" class="primary">Guardar</button>
        </div>
      </div>`;
    ov.appendChild(sheet);
    const ta = sheet.querySelector(".sheet-ta");
    setTimeout(() => ta.focus(), 30);
    const cerrarSheet = () => sheet.remove();
    sheet.addEventListener("click", (e) => { if (e.target === sheet) cerrarSheet(); });
    sheet.querySelector('[data-act="guardar"]').addEventListener("click", () => {
      rec.nota = ta.value.trim();
      setAnotacionesDe(docId, lista);
      pintarHighlights(); cerrarSheet();
    });
    sheet.querySelector('[data-act="borrar"]').addEventListener("click", () => {
      const idx = lista.findIndex(a => a.id === hid);
      if (idx >= 0) lista.splice(idx, 1);
      setAnotacionesDe(docId, lista);
      pintarHighlights(); cerrarSheet();
    });
    sheet.querySelector('[data-act="sint"]').addEventListener("click", () => {
      rec.nota = ta.value.trim();
      setAnotacionesDe(docId, lista);
      pintarHighlights();
      enviarASintesis(rec.quote, rec.nota);
      cerrarSheet();
    });
  }

  // ── "Mis apuntes" del libro ──
  ov.querySelector(".libro-apuntes-btn").addEventListener("click", () => {
    const lista = anotacionesDe(docId).slice().sort((a, b) => (a.page - b.page) || (a.ts - b.ts));
    const sheet = document.createElement("div");
    sheet.className = "lector-sheet-modal";
    sheet.innerHTML = `
      <div class="sheet-card sheet-apuntes">
        <h3 class="sheet-tit">Mis apuntes · ${lista.length}</h3>
        ${lista.length ? lista.map(a => `
          <div class="apunte-row" data-hid="${a.id}">
            <blockquote class="sheet-cita">${esc(a.quote)}</blockquote>
            ${a.nota ? `<p class="apunte-nota">${esc(a.nota)}</p>` : ""}
            <span class="apunte-pag">pág. ${a.page}</span>
          </div>`).join("")
          : `<p class="sheet-vacio">Aún no has subrayado nada. Selecciona texto en el PDF para empezar.</p>`}
        <div class="sheet-acciones">
          <span class="sheet-spacer"></span>
          <button data-act="cerrar" type="button" class="primary">Cerrar</button>
        </div>
      </div>`;
    ov.appendChild(sheet);
    sheet.addEventListener("click", (e) => {
      if (e.target === sheet || e.target.closest('[data-act="cerrar"]')) { sheet.remove(); return; }
      const row = e.target.closest(".apunte-row");
      if (row) { sheet.remove(); abrirNota(row.dataset.hid); }
    });
  });

  // ── puente a la síntesis G2 (mismo CustomEvent que el Lector) ──
  function enviarASintesis(cita, nota) {
    const detail = {
      recursoId: docId,
      titulo: meta?.titulo || "",
      autor: meta?.autor || "",
      cita: cita || "",
      nota: nota || ""
    };
    window.dispatchEvent(new CustomEvent("biblioteca:sintetizar-cita", { detail }));
    opts.onSintetizar?.(detail);
  }

  return { cerrar };
}
