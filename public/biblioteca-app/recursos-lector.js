// biblioteca-app/recursos-lector.js — Lector de RECURSOS.
//
// Lee un recurso (artículo/hilo o epígrafe) en una vista enfocada
// móvil-first y permite SUBRAYAR y ANOTAR sobre el texto. Todo se guarda
// en localStorage; no hay backend (coherente con el prototipo iso).
//
// Anclaje de subrayados (la parte delicada): cada subrayado se guarda como
// (índice de párrafo + offset inicio/fin dentro del texto plano de ESE
// párrafo + la cita literal). Es robusto a reflow y a móvil porque los
// párrafos son bloques de texto estables; no dependemos de posiciones
// absolutas del DOM. La cita se guarda además para mostrarla en la nota,
// en "mis apuntes" y al enviar a la síntesis G2.
//
// Integración con síntesis: "→ Síntesis" emite un CustomEvent en window
// (`biblioteca:sintetizar-cita`) con {recursoId, titulo, autor, cita, nota}.
// app.js lo escucha, precarga el editor de síntesis y lo abre. Así el
// subrayado deja de ser pasivo y se convierte en munición para escribir.

const KEY_ANOTACIONES = "biblioteca-recursos-anotaciones-v1";
const COLOR_DEFAULT = "ocre";

// ─────────────── persistencia ───────────────
function cargarTodas() {
  try { return JSON.parse(localStorage.getItem(KEY_ANOTACIONES) || "{}") || {}; }
  catch { return {}; }
}
function guardarTodas(obj) {
  try { localStorage.setItem(KEY_ANOTACIONES, JSON.stringify(obj)); } catch { /**/ }
}
function anotacionesDe(recursoId) {
  const all = cargarTodas();
  return Array.isArray(all[recursoId]) ? all[recursoId] : [];
}
function setAnotacionesDe(recursoId, lista) {
  const all = cargarTodas();
  all[recursoId] = lista;
  guardarTodas(all);
}

// Cuántos subrayados tiene un recurso (para el badge en la card).
export function contarAnotaciones(recursoId) {
  return anotacionesDe(recursoId).length;
}

// ─────────────── util ───────────────
function uid() {
  return "an-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
}
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Pinta el texto plano de un párrafo intercalando <mark> por cada subrayado.
function pintarParrafo(texto, marks) {
  if (!marks || !marks.length) return esc(texto);
  const orden = marks.slice().sort((a, b) => a.start - b.start);
  let html = "", cursor = 0;
  for (const m of orden) {
    const s = Math.max(cursor, m.start | 0);
    const e = Math.max(s, m.end | 0);
    if (s > cursor) html += esc(texto.slice(cursor, s));
    html += `<mark class="hl hl-${m.color || COLOR_DEFAULT}${m.nota ? " has-nota" : ""}" `
          + `data-hid="${m.id}">${esc(texto.slice(s, e))}</mark>`;
    cursor = e;
  }
  if (cursor < texto.length) html += esc(texto.slice(cursor));
  return html;
}

// ─────────────── API principal ───────────────
// recurso: { id, titulo, autor?, lectura_min?, parrafos: string[] }
// opts:    { onCerrar?(recursoId), onSintetizar?(detail) }
export function abrirLector(recurso, opts = {}) {
  const parrafos = Array.isArray(recurso.parrafos)
    ? recurso.parrafos.map(p => String(p || ""))
    : (recurso.parrafos ? [String(recurso.parrafos)] : []);
  let anots = anotacionesDe(recurso.id);

  const ov = document.createElement("div");
  ov.className = "lector-overlay";
  ov.innerHTML = `
    <div class="lector-sheet" role="dialog" aria-modal="true" aria-label="${esc(recurso.titulo || "Lectura")}">
      <header class="lector-top">
        <button class="lector-cerrar" type="button" aria-label="Volver">←</button>
        <div class="lector-top-meta">
          <span class="lector-top-tit">${esc(recurso.titulo || "")}</span>
          <span class="lector-top-sub">${esc(recurso.autor || "")}${recurso.lectura_min ? ` · ${recurso.lectura_min} min` : ""}</span>
        </div>
        <button class="lector-apuntes-btn" type="button" aria-label="Mis apuntes">
          ✎ <span class="lector-apuntes-n">${anots.length}</span>
        </button>
      </header>
      <article class="lector-cuerpo">
        ${parrafos.map((p, i) =>
          `<p class="lector-p" data-pidx="${i}">${pintarParrafo(p, anots.filter(a => a.pidx === i))}</p>`
        ).join("")}
        ${parrafos.length === 0 ? `<p class="lector-vacio">Este recurso no tiene texto legible todavía.</p>` : ""}
      </article>
    </div>
    <div class="lector-selbar" hidden role="toolbar" aria-label="Acciones de selección">
      <button data-act="sub" type="button">⎯ Subrayar</button>
      <button data-act="nota" type="button">✎ Nota</button>
      <button data-act="sint" type="button">→ Síntesis</button>
    </div>`;
  document.body.appendChild(ov);
  document.body.style.overflow = "hidden";

  const cuerpo = ov.querySelector(".lector-cuerpo");
  const selbar = ov.querySelector(".lector-selbar");
  const apuntesN = ov.querySelector(".lector-apuntes-n");

  function cerrar() {
    document.body.style.overflow = "";
    document.removeEventListener("selectionchange", onSelChange);
    ov.remove();
    opts.onCerrar?.(recurso.id);
  }
  ov.querySelector(".lector-cerrar").addEventListener("click", cerrar);

  function repintar() {
    anots = anotacionesDe(recurso.id);
    cuerpo.querySelectorAll(".lector-p").forEach(p => {
      const i = +p.dataset.pidx;
      p.innerHTML = pintarParrafo(parrafos[i], anots.filter(a => a.pidx === i));
    });
    apuntesN.textContent = anots.length;
  }

  // ── selección → medir (pidx, start, end, quote) ──
  let pendiente = null;
  function medirSeleccion() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    const quote = sel.toString().replace(/\s+/g, " ").trim();
    if (!quote) return null;
    let node = range.startContainer;
    let pEl = node.nodeType === 1 ? node : node.parentElement;
    pEl = pEl && pEl.closest(".lector-p");
    if (!pEl || !cuerpo.contains(pEl)) return null;
    const pidx = +pEl.dataset.pidx;
    // offset = longitud del texto desde el inicio del párrafo hasta el
    // inicio de la selección (cuenta a través de <mark> ya existentes).
    const pre = document.createRange();
    pre.selectNodeContents(pEl);
    try { pre.setEnd(range.startContainer, range.startOffset); }
    catch { return null; }
    const start = pre.toString().length;
    const visible = sel.toString();           // longitud real seleccionada
    const end = start + visible.length;
    return { pidx, start, end, quote };
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
      id: uid(), pidx: pendiente.pidx, start: pendiente.start, end: pendiente.end,
      quote: pendiente.quote, color: COLOR_DEFAULT, nota: "", ts: Date.now(),
      ...(extra || {})
    };
    const lista = anotacionesDe(recurso.id);
    lista.push(rec);
    setAnotacionesDe(recurso.id, lista);
    window.getSelection()?.removeAllRanges();
    selbar.hidden = true;
    pendiente = null;
    repintar();
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

  // tap en un subrayado existente → abrir su nota
  cuerpo.addEventListener("click", (e) => {
    const mk = e.target.closest("mark.hl");
    if (mk) abrirNota(mk.dataset.hid);
  });

  // ── bottom-sheet de nota ──
  function abrirNota(hid) {
    const lista = anotacionesDe(recurso.id);
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
      setAnotacionesDe(recurso.id, lista);
      repintar(); cerrarSheet();
    });
    sheet.querySelector('[data-act="borrar"]').addEventListener("click", () => {
      const idx = lista.findIndex(a => a.id === hid);
      if (idx >= 0) lista.splice(idx, 1);
      setAnotacionesDe(recurso.id, lista);
      repintar(); cerrarSheet();
    });
    sheet.querySelector('[data-act="sint"]').addEventListener("click", () => {
      rec.nota = ta.value.trim();
      setAnotacionesDe(recurso.id, lista);
      repintar();
      enviarASintesis(rec.quote, rec.nota);
      cerrarSheet();
    });
  }

  // ── "mis apuntes" del recurso ──
  ov.querySelector(".lector-apuntes-btn").addEventListener("click", abrirApuntes);
  function abrirApuntes() {
    const lista = anotacionesDe(recurso.id).slice()
      .sort((a, b) => a.pidx - b.pidx || a.start - b.start);
    const sheet = document.createElement("div");
    sheet.className = "lector-sheet-modal";
    sheet.innerHTML = `
      <div class="sheet-card sheet-apuntes">
        <h3 class="sheet-tit">Mis apuntes · ${lista.length}</h3>
        ${lista.length ? lista.map(a => `
          <div class="apunte-row" data-hid="${a.id}">
            <blockquote class="sheet-cita">${esc(a.quote)}</blockquote>
            ${a.nota ? `<p class="apunte-nota">${esc(a.nota)}</p>` : ""}
            <button class="apunte-ir" data-act="ir" type="button">abrir ›</button>
          </div>`).join("")
          : `<p class="sheet-vacio">Aún no has subrayado nada. Selecciona texto en el artículo para empezar.</p>`}
        <div class="sheet-acciones">
          <span class="sheet-spacer"></span>
          <button data-act="cerrar" type="button" class="primary">Cerrar</button>
        </div>
      </div>`;
    ov.appendChild(sheet);
    sheet.addEventListener("click", (e) => {
      if (e.target === sheet || e.target.closest('[data-act="cerrar"]')) { sheet.remove(); return; }
      const ir = e.target.closest('[data-act="ir"]');
      if (ir) { const hid = ir.closest(".apunte-row").dataset.hid; sheet.remove(); abrirNota(hid); }
    });
  }

  // ── puente a la síntesis G2 ──
  function enviarASintesis(cita, nota) {
    const detail = {
      recursoId: recurso.id,
      titulo: recurso.titulo || "",
      autor: recurso.autor || "",
      cita: cita || "",
      nota: nota || ""
    };
    window.dispatchEvent(new CustomEvent("biblioteca:sintetizar-cita", { detail }));
    opts.onSintetizar?.(detail);
  }

  return { cerrar };
}
