// agora-app/deliberacion.js — Superficie de DELIBERACIÓN (Fase 3).
//
// Paridad funcional con Decidim / CONSUL, en cuatro secciones que conmuta
// la tira contextual del touchbar (Propuestas · Debates · Votaciones ·
// Presupuestos). Estado en localStorage vía el registro de gestos, igual
// que el resto del Ágora — sin backend.
//
//   · Propuestas  → ciclo de vida (máquina de estados proceso-estados.json)
//                   + termómetro de apoyos (gesto "apoyo_propuesta").
//   · Debates     → hilos con nº de comentarios (lectura; participar = gesto).
//   · Votaciones  → binaria/ternaria, recuento base + votos del registro
//                   (gesto "voto_delib", último voto por usuario manda).
//   · Presupuestos→ bolsa total + proyectos con importe; el usuario arma su
//                   cesta (gesto "apoyo_presupuesto") y ve cuánto le queda.
//
// La superficie es read-mostly + gestos: no inventa identidad ni manda nada
// fuera; cada acción es un gesto local auditable.

import { recordGesto, getAllGestos, getUserId } from "../shared/gestos.js?v=20260529-agora-verde";

const DATA = "../data/agora";

let root = null;
let estados = [];          // máquina de estados (proceso-estados.json)
let seed = null;           // propuestas-seed.json
let seccion = "propuestas";
let cargado = false;

// ─────────────────── Carga ───────────────────
async function cargar() {
  if (cargado) return;
  try {
    const [rE, rS] = await Promise.all([
      fetch(`${DATA}/proceso-estados.json`, { cache: "no-cache" }),
      fetch(`${DATA}/propuestas-seed.json`, { cache: "no-cache" })
    ]);
    estados = (await rE.json()).estados || [];
    seed = await rS.json();
    cargado = true;
  } catch (e) {
    console.warn("[deliberacion] no se pudo cargar el seed:", e.message);
    seed = { propuestas: [], debates: [], votaciones: [], presupuestos: { bolsa: 0, proyectos: [] } };
  }
}

// ─────────────────── Helpers de gestos ───────────────────
function gestos(tipo, ref) {
  return getAllGestos().filter(g => g.tipo === tipo && !g.falso && g.payload?.ref === ref);
}
function contarUnico(tipo, ref) {
  return new Set(gestos(tipo, ref).map(g => g.userId)).size;
}
function yoHice(tipo, ref) {
  const uid = getUserId();
  return gestos(tipo, ref).some(g => g.userId === uid);
}
// Último voto de cada usuario para una votación → {opcionId: nº}
function recuentoVotos(ref) {
  const porUsuario = new Map();
  gestos("voto_delib", ref).sort((a, b) => a.ts - b.ts)
    .forEach(g => porUsuario.set(g.userId, g.payload.opcion));
  const tally = {};
  for (const op of porUsuario.values()) tally[op] = (tally[op] || 0) + 1;
  return tally;
}
function miVoto(ref) {
  const uid = getUserId();
  let v = null;
  gestos("voto_delib", ref).sort((a, b) => a.ts - b.ts)
    .forEach(g => { if (g.userId === uid) v = g.payload.opcion; });
  return v;
}

const CAT_LABEL = {
  movilidad: "Movilidad", cultura: "Cultura", urbanismo: "Urbanismo",
  "medio-ambiente": "Medio ambiente", economia: "Economía", social: "Social"
};
const fmt = n => n.toLocaleString("es-ES");

// ─────────────────── Render: STEPPER de estado ───────────────────
function stepper(estadoId) {
  const actual = estados.find(e => e.id === estadoId);
  const ord = actual ? actual.orden : 0;
  const pasos = estados.map(e => {
    const cls = e.orden < ord ? "done" : e.orden === ord ? "now" : "todo";
    return `<li class="dl-step is-${cls}" title="${e.desc}">
      <span class="dl-step-dot">${e.orden < ord ? "✓" : e.ico}</span>
      <span class="dl-step-label">${e.label}</span>
    </li>`;
  }).join("");
  return `<ol class="dl-stepper">${pasos}</ol>`;
}

// ─────────────────── Sección: PROPUESTAS ───────────────────
function renderPropuestas() {
  const items = (seed.propuestas || []).map(p => {
    const apoyos = p.apoyos_base + contarUnico("apoyo_propuesta", p.id);
    const pct = Math.min(100, Math.round((apoyos / p.umbral) * 100));
    const yo = yoHice("apoyo_propuesta", p.id);
    const alcanzado = apoyos >= p.umbral;
    const autorIco = p.autor.tipo === "actor" ? "🏛" : "🙋";
    const geo = p.geo?.municipio ? `· 📍 ${p.geo.municipio}` : "";
    const resultado = p.resultado
      ? `<p class="dl-resultado">🏁 ${p.resultado}</p>` : "";
    return `<article class="dl-card" data-prop="${p.id}">
      <div class="dl-card-head">
        <span class="dl-cat">${CAT_LABEL[p.categoria] || p.categoria}</span>
        <span class="dl-autor">${autorIco} ${p.autor.nombre} ${geo}</span>
      </div>
      <h3 class="dl-card-title">${p.titulo}</h3>
      <p class="dl-card-body">${p.cuerpo}</p>
      ${stepper(p.estado)}
      <div class="dl-apoyos">
        <div class="dl-termo"><span class="dl-termo-fill${alcanzado ? " is-full" : ""}" style="width:${pct}%"></span></div>
        <div class="dl-apoyos-row">
          <span class="dl-apoyos-num">${fmt(apoyos)} / ${fmt(p.umbral)} apoyos</span>
          <button class="dl-btn dl-apoyar${yo ? " is-on" : ""}" data-act="apoyar" data-ref="${p.id}" ${alcanzado && !yo ? "" : ""}>
            ${yo ? "✓ Apoyada" : "✋ Apoyar"}
          </button>
        </div>
      </div>
      ${resultado}
    </article>`;
  }).join("");
  return `<div class="dl-list">${items || vacio("propuestas")}</div>`;
}

// ─────────────────── Sección: DEBATES ───────────────────
function renderDebates() {
  const items = (seed.debates || []).map(d => {
    const extra = contarUnico("participo_debate", d.id);
    const total = d.comentarios + extra;
    const yo = yoHice("participo_debate", d.id);
    return `<article class="dl-card" data-debate="${d.id}">
      <div class="dl-card-head">
        <span class="dl-cat">${CAT_LABEL[d.categoria] || d.categoria}</span>
        <span class="dl-autor">💬 ${fmt(total)} comentarios</span>
      </div>
      <h3 class="dl-card-title">${d.titulo}</h3>
      <p class="dl-card-body">${d.resumen}</p>
      <div class="dl-apoyos-row">
        <span class="dl-apoyos-num">Debate abierto</span>
        <button class="dl-btn${yo ? " is-on" : ""}" data-act="participar" data-ref="${d.id}">
          ${yo ? "✓ Participas" : "💬 Participar"}
        </button>
      </div>
    </article>`;
  }).join("");
  return `<div class="dl-list">${items || vacio("debates")}</div>`;
}

// ─────────────────── Sección: VOTACIONES ───────────────────
function renderVotaciones() {
  const items = (seed.votaciones || []).map(v => {
    const tally = recuentoVotos(v.id);
    const mio = miVoto(v.id);
    const conTotales = v.opciones.map(o => ({ ...o, total: o.votos_base + (tally[o.id] || 0) }));
    const suma = conTotales.reduce((a, o) => a + o.total, 0) || 1;
    const ganadora = conTotales.reduce((a, o) => o.total > a.total ? o : a, conTotales[0]);
    const opcionesHtml = conTotales.map(o => {
      const pct = Math.round((o.total / suma) * 100);
      const on = mio === o.id;
      const win = o.id === ganadora.id;
      return `<button class="dl-voto${on ? " is-on" : ""}" data-act="votar" data-ref="${v.id}" data-op="${o.id}">
        <span class="dl-voto-bar${win ? " is-win" : ""}" style="width:${pct}%"></span>
        <span class="dl-voto-txt"><span class="dl-voto-label">${o.label}</span><span class="dl-voto-pct">${pct}%</span></span>
      </button>`;
    }).join("");
    return `<article class="dl-card" data-votacion="${v.id}">
      <div class="dl-card-head">
        <span class="dl-cat">${v.tipo === "ternaria" ? "Ternaria" : "Binaria"}</span>
        <span class="dl-autor">🗳 ${fmt(suma)} votos</span>
      </div>
      <h3 class="dl-card-title">${v.titulo}</h3>
      <p class="dl-card-body">${v.pregunta}</p>
      <div class="dl-votos">${opcionesHtml}</div>
      <p class="dl-voto-aviso">${mio ? "Tu voto cuenta — puedes cambiarlo." : "Pulsa una opción para votar."}</p>
    </article>`;
  }).join("");
  return `<div class="dl-list">${items || vacio("votaciones")}</div>`;
}

// ─────────────────── Sección: PRESUPUESTOS ───────────────────
function renderPresupuestos() {
  const pp = seed.presupuestos || { bolsa: 0, proyectos: [] };
  const sel = (pp.proyectos || []).filter(p => yoHice("apoyo_presupuesto", p.id));
  const gastado = sel.reduce((a, p) => a + p.importe, 0);
  const restante = pp.bolsa - gastado;
  const pctBolsa = Math.min(100, Math.round((gastado / pp.bolsa) * 100));
  const items = (pp.proyectos || []).map(p => {
    const apoyos = p.apoyos_base + contarUnico("apoyo_presupuesto", p.id);
    const yo = yoHice("apoyo_presupuesto", p.id);
    const cabe = restante >= p.importe || yo;
    return `<article class="dl-card${yo ? " is-sel" : ""}" data-proyecto="${p.id}">
      <div class="dl-card-head">
        <span class="dl-cat">${CAT_LABEL[p.categoria] || p.categoria}</span>
        <span class="dl-autor">💶 ${fmt(p.importe)} ${pp.moneda} · 👥 ${fmt(apoyos)}</span>
      </div>
      <h3 class="dl-card-title">${p.titulo}</h3>
      <p class="dl-card-body">${p.descripcion}</p>
      <div class="dl-apoyos-row">
        <span class="dl-apoyos-num">${fmt(p.importe)} ${pp.moneda}</span>
        <button class="dl-btn dl-add${yo ? " is-on" : ""}" data-act="presupuesto" data-ref="${p.id}" ${cabe ? "" : "disabled"}>
          ${yo ? "✓ En tu cesta" : (cabe ? "➕ Añadir" : "Sin saldo")}
        </button>
      </div>
    </article>`;
  }).join("");
  const barra = `<div class="dl-bolsa">
    <div class="dl-bolsa-row">
      <strong>Tu presupuesto ${pp.anio || ""}</strong>
      <span class="dl-bolsa-cifras">${fmt(gastado)} / ${fmt(pp.bolsa)} ${pp.moneda}</span>
    </div>
    <div class="dl-termo"><span class="dl-termo-fill" style="width:${pctBolsa}%"></span></div>
    <span class="dl-bolsa-rest">Te quedan ${fmt(Math.max(0, restante))} ${pp.moneda} por asignar</span>
  </div>`;
  return barra + `<div class="dl-list">${items || vacio("presupuestos")}</div>`;
}

function vacio(s) {
  return `<p class="dl-vacio">Sin contenido en «${s}» todavía.</p>`;
}

// ─────────────────── Render maestro ───────────────────
const RENDERERS = {
  propuestas: renderPropuestas,
  debates: renderDebates,
  votaciones: renderVotaciones,
  presupuestos: renderPresupuestos
};

function render() {
  if (!root) return;
  const fn = RENDERERS[seccion] || renderPropuestas;
  root.innerHTML = `<div class="dl-surface">${fn()}</div>`;
}

// ─────────────────── Acciones (click delegado) ───────────────────
function onClick(ev) {
  const btn = ev.target.closest("[data-act]");
  if (!btn) return;
  const act = btn.dataset.act;
  const ref = btn.dataset.ref;

  if (act === "apoyar") {
    if (!yoHice("apoyo_propuesta", ref)) recordGesto("apoyo_propuesta", { ref, fuente_app: "agora" });
    render();
  } else if (act === "participar") {
    if (!yoHice("participo_debate", ref)) recordGesto("participo_debate", { ref, fuente_app: "agora" });
    render();
  } else if (act === "votar") {
    recordGesto("voto_delib", { ref, opcion: btn.dataset.op, fuente_app: "agora" });
    render();
  } else if (act === "presupuesto") {
    // Toggle: si ya está en la cesta no re-añadimos (no podemos "quitar" un
    // gesto del registro, así que el primer apoyo es definitivo en esta demo).
    if (!yoHice("apoyo_presupuesto", ref)) recordGesto("apoyo_presupuesto", { ref, fuente_app: "agora" });
    render();
  }
}

// ─────────────────── API pública ───────────────────
export async function initDeliberacion(rootEl) {
  root = rootEl;
  if (!root) return;
  root.addEventListener("click", onClick);
  await cargar();
  render();
}

export function seccionDeliberacion(id) {
  if (RENDERERS[id]) seccion = id;
  render();
}
