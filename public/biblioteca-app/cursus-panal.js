// biblioteca-app/cursus-panal.js — El "cursus honorum" de la Biblioteca.
//
// Gamificación de la matriz canónica Senda × Grado (shared/sendas.js ×
// shared/niveles.js). Cada Senda es un hexágono de 6 lados (un lado por
// grado, G0→G5) que se rellena al ascender; las 5 Sendas rodean un
// hexágono central de "ciudadanía transversal" que se enciende al graduar
// las cinco. Ese panal vive tras el avatar del cursus honorum (#app-topbar-enter).
//
// Disparador de progreso (decisión 2026-06-02 "señal activa"):
//   - ABRIR un recurso lo marca como "visto" (gesto `lectura_abierta`).
//   - Para GRADUAR hace falta una SEÑAL ACTIVA: subrayar o sintetizar
//     (≥1 anotación en ese recurso, vía contarAnotaciones).
// Una celda (senda×grado) se gradúa cuando TODOS sus recursos tienen señal
// activa. Una Senda se gradúa cuando todos sus grados con contenido están
// graduados. Las 5 Sendas graduadas encienden la ciudadanía central.

import { SENDAS, getSenda } from "../shared/sendas.js?v=20260602-sendas";
import { GRADOS, getGrado } from "../shared/niveles.js?v=20260602-niveles";
import { getUserId, getAllGestos, recordGesto } from "../shared/gestos.js?v=20260527a";
import { contarAnotaciones } from "./recursos-lector.js?v=20260602-recursos";

// ─────────── Registro de apertura (estado "visto") ───────────
// Llamado por la card al abrir el Lector. Anónimo, idempotente en la
// práctica (varias aperturas del mismo recurso no cambian el estado).
export function registrarApertura(item) {
  if (!item || !item.id) return;
  recordGesto("lectura_abierta", {
    recurso_id: item.id,
    senda: item.senda || null,
    grado: item.grado || null
  });
}

// ─────────── Señal activa calibrada por tipo (decisión 2026-06-03) ───────────
// El lazo de graduación se rompía: solo hilos/epígrafes abren el Lector y se
// subrayan. Píldoras (G0 Chispa) y vídeos no se subrayan → nunca graduaban.
// Calibramos la "señal activa" al gesto que cada formato sí permite:
//   píldora → GUARDAR (☆) · vídeo → REPRODUCIR (▷ con intención) ·
//   hilo/epígrafe → SUBRAYAR (≥1 anotación, vía contarAnotaciones).
export function registrarGuardado(item) {
  if (!item || !item.id) return;
  recordGesto("recurso_guardado", {
    recurso_id: item.id, senda: item.senda || null, grado: item.grado || null
  });
}
export function registrarReproduccion(item) {
  if (!item || !item.id) return;
  recordGesto("video_reproducido", {
    recurso_id: item.id, senda: item.senda || null, grado: item.grado || null
  });
}
// ¿Este recurso tiene ya su señal activa? (la usan las cards para pintar el
// estado "graduado" y el botón guardar como activo).
export function tieneSenalActiva(item) {
  if (!item || !item.id) return false;
  const uid = getUserId();
  const tiene = (tipo) => getAllGestos().some(g =>
    g.tipo === tipo && g.userId === uid && !g.falso &&
    g.payload && g.payload.recurso_id === item.id);
  return item.kind === "pildora" ? tiene("recurso_guardado")
       : item.kind === "video"   ? tiene("video_reproducido")
       : contarAnotaciones(item.id) > 0;
}

// ─────────── Cómputo de la matriz ───────────
// items: array plano de TODOS los recursos consumibles (hilos, píldoras,
// epígrafes, vídeos) ya estampados con {id, senda, grado}.
export function computeCursus(items) {
  const uid = getUserId();
  const gestos = getAllGestos().filter(g => g.userId === uid && !g.falso);
  const idsDe = (tipo) => new Set(
    gestos.filter(g => g.tipo === tipo)
      .map(g => g.payload && g.payload.recurso_id).filter(Boolean)
  );
  const abiertos     = idsDe("lectura_abierta");
  const guardados    = idsDe("recurso_guardado");
  const reproducidos = idsDe("video_reproducido");

  // Señal activa calibrada por tipo (ver registrarGuardado/Reproduccion).
  const tieneSenal = (it) =>
      it.kind === "pildora" ? guardados.has(it.id)
    : it.kind === "video"   ? reproducidos.has(it.id)
    : contarAnotaciones(it.id) > 0;

  // matrix[sendaId][gradoId] = { total, vistos, activos }
  const matrix = {};
  for (const s of SENDAS) {
    matrix[s.id] = {};
    for (const g of GRADOS) matrix[s.id][g.id] = { total: 0, vistos: 0, activos: 0 };
  }

  for (const it of (items || [])) {
    if (!it || !it.senda || !matrix[it.senda]) continue; // sin senda → fuera del panal
    const gr = it.grado || "g2";
    const cell = matrix[it.senda][gr];
    if (!cell) continue;
    cell.total++;
    if (abiertos.has(it.id) || tieneSenal(it)) cell.vistos++;
    if (tieneSenal(it)) cell.activos++;
  }

  // Estado por celda y por senda.
  const sendaEstado = {};
  let sendasGraduadas = 0;
  for (const s of SENDAS) {
    let conContenido = 0, graduadas = 0, gradoActual = null;
    const celdas = {};
    for (const g of GRADOS) {
      const c = matrix[s.id][g.id];
      let estado;
      if (c.total === 0)               estado = "vacio";
      else if (c.activos === c.total)  estado = "graduado";
      else if (c.vistos > 0 || c.activos > 0) estado = "enCurso";
      else                             estado = "disponible";
      celdas[g.id] = { ...c, estado };
      if (c.total > 0) {
        conContenido++;
        if (estado === "graduado") graduadas++;
        else if (gradoActual === null) gradoActual = g.id; // primer grado no completado
      }
    }
    const completa = conContenido > 0 && graduadas === conContenido;
    if (completa) sendasGraduadas++;
    sendaEstado[s.id] = {
      celdas, conContenido, graduadas, completa,
      // si está completa no hay "grado actual"; si no, el primer pendiente
      gradoActual: completa ? null : (gradoActual || (conContenido ? null : null))
    };
  }

  return {
    matrix, sendaEstado,
    sendasGraduadas,
    totalSendas: SENDAS.length,
    ciudadania: sendasGraduadas === SENDAS.length && sendasGraduadas > 0
  };
}

// Resumen ligero para el badge del avatar.
export function estadoCursus(items) {
  const c = computeCursus(items);
  return { sendasGraduadas: c.sendasGraduadas, total: c.totalSendas, ciudadania: c.ciudadania };
}

// ─────────── Render del hexágono de una Senda ───────────
// 6 cuñas (una por grado, G0 arriba y girando en sentido horario) más el
// borde. Color por estado de celda.
function hexSenda(cx, cy, r, celdas) {
  const COL = {
    graduado:   "var(--ocre)",
    enCurso:    "color-mix(in srgb, var(--ocre) 38%, transparent)",
    disponible: "color-mix(in srgb, var(--indigo) 22%, transparent)",
    vacio:      "transparent"
  };
  // Vértices pointy-top: ángulo -90 + 60*i.
  const vert = i => {
    const a = (-90 + 60 * i) * Math.PI / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  let wedges = "";
  for (let i = 0; i < 6; i++) {
    const g = GRADOS[i];
    const st = (celdas[g.id] && celdas[g.id].estado) || "vacio";
    const [x1, y1] = vert(i);
    const [x2, y2] = vert(i + 1);
    wedges += `<path d="M${cx.toFixed(1)},${cy.toFixed(1)} L${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)} Z"
      fill="${COL[st]}" stroke="var(--bg)" stroke-width="1"></path>`;
  }
  // Borde exterior.
  const pts = Array.from({ length: 6 }, (_, i) => vert(i).map(n => n.toFixed(1)).join(",")).join(" ");
  const borde = `<polygon points="${pts}" fill="none" stroke="var(--line)" stroke-width="1.5"></polygon>`;
  return wedges + borde;
}

// ─────────── Overlay del panal ───────────
let _overlay = null;

export function abrirPanal(items) {
  cerrarPanal();
  const cur = computeCursus(items);

  const ov = document.createElement("div");
  ov.className = "cursus-overlay";
  _overlay = ov;

  // Pentaflor: centro = ciudadanía, 5 pétalos = sendas (top y girando).
  const W = 320, C = W / 2, R = 44, D = 92;
  let petalos = "";
  SENDAS.forEach((s, k) => {
    const a = (-90 + k * 72) * Math.PI / 180;
    const px = C + D * Math.cos(a), py = C + D * Math.sin(a);
    const est = cur.sendaEstado[s.id];
    petalos += `<g class="cursus-petalo${est.completa ? " is-graduada" : ""}" data-senda="${s.id}">
        ${hexSenda(px, py, R, est.celdas)}
        <text x="${px.toFixed(1)}" y="${(py + 3).toFixed(1)}" text-anchor="middle"
          class="cursus-petalo-glifo">${escapeHtml(getSenda(s.id).glifo)}</text>
      </g>`;
  });
  // Hexágono central de ciudadanía.
  const central = (() => {
    const vert = i => {
      const ang = (-90 + 60 * i) * Math.PI / 180;
      return [C + 30 * Math.cos(ang), C + 30 * Math.sin(ang)];
    };
    const pts = Array.from({ length: 6 }, (_, i) => vert(i).map(n => n.toFixed(1)).join(",")).join(" ");
    const fill = cur.ciudadania ? "var(--oro)" : "color-mix(in srgb, var(--indigo) 18%, transparent)";
    return `<polygon points="${pts}" fill="${fill}" stroke="var(--line)" stroke-width="1.5"></polygon>
      <text x="${C}" y="${C + 4}" text-anchor="middle" class="cursus-central-txt">${cur.sendasGraduadas}/${cur.totalSendas}</text>`;
  })();

  // Leyenda de grados.
  const leyenda = GRADOS.map(g =>
    `<span class="cursus-leg-item"><b>${g.glifo}</b> ${escapeHtml(g.label)}</span>`
  ).join("");

  // Detalle por senda (grado actual + progreso).
  const filas = SENDAS.map(s => {
    const est = cur.sendaEstado[s.id];
    const def = getSenda(s.id);
    let estadoTxt;
    if (est.conContenido === 0) estadoTxt = "sin recursos aún";
    else if (est.completa)      estadoTxt = "✓ graduada";
    else {
      const g = est.gradoActual ? getGrado(est.gradoActual) : null;
      estadoTxt = `${est.graduadas}/${est.conContenido} grados` +
        (g ? ` · siguiente: ${escapeHtml(g.label)}` : "");
    }
    return `<div class="cursus-fila${est.completa ? " is-graduada" : ""}">
        <span class="cursus-fila-glifo">${escapeHtml(def.glifo)}</span>
        <span class="cursus-fila-label">${escapeHtml(def.label)}</span>
        <span class="cursus-fila-estado">${estadoTxt}</span>
      </div>`;
  }).join("");

  ov.innerHTML = `
    <div class="cursus-sheet">
      <div class="cursus-top">
        <button class="cursus-cerrar" type="button" aria-label="Cerrar">✕</button>
        <div class="cursus-top-meta">
          <div class="cursus-top-tit">Mi cursus ciudadano</div>
          <div class="cursus-top-sub">subraya o sintetiza para graduar cada grado</div>
        </div>
      </div>
      <div class="cursus-cuerpo">
        <svg class="cursus-panal" viewBox="0 0 ${W} ${W}" width="${W}" height="${W}" aria-hidden="true">
          ${petalos}${central}
        </svg>
        <div class="cursus-leyenda">${leyenda}</div>
        <div class="cursus-detalle">${filas}</div>
        ${cur.ciudadania
          ? `<p class="cursus-graduado-msg">★ Ciudadanía transversal alcanzada — graduaste las 5 Sendas.</p>`
          : ""}
      </div>
    </div>`;

  ov.addEventListener("click", (e) => {
    if (e.target === ov || e.target.closest(".cursus-cerrar")) cerrarPanal();
  });
  document.body.appendChild(ov);
  return ov;
}

export function cerrarPanal() {
  if (_overlay && _overlay.parentNode) _overlay.parentNode.removeChild(_overlay);
  _overlay = null;
}

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
