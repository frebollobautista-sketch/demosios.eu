// biblioteca-app/pulso-palacios.js — "Pulso de Palacios": vista
// contemplativa de la estructura mnemo de la BIBLIOTECA.
//
// Equivalente al Pulso de Zona de Ágora, pero aquí los cubos no son
// barrios sino los 9 palacios temáticos del temario mnemoHACK. La
// ventana es más larga (30 días por defecto) porque el ritmo de
// estudio es más lento que el ritmo cívico — un palacio "silencioso"
// no es una alarma, es una invitación discreta a volver.
//
// Diferencias clave respecto a Ágora:
//   · Cubos: palacio (no zona). Derivados de tema_id, no de geo.
//   · Ventana: 30d por defecto (no 72h).
//   · Los 9 palacios SIEMPRE se listan — los que no aparecen en
//     activos caen al bloque "silenciosos" sin urgencia.
//   · CTA: "+ empezar epígrafe aquí" (no "+ señal aquí").
//   · "Tu palacio" se deriva del palacio dominante (más gestos del
//     usuario en ventana), no de un dato geo del perfil.
//
// Este módulo NO emite gestos. Sólo agrega, presenta y emite eventos
// (vía callbacks en ctx) que app.js interpreta.

import { getAllGestos } from "../shared/gestos.js?v=20260527a";

// =============================================================
// ESTRUCTURA DE PALACIOS
//
// Mapeo hard-coded tema_id → palacio. Viene del BUILD_SUMMARY de
// mnemoHACK v6 (26 temas, 9 palacios). Es declarativo y estable:
// si en el futuro se reordena el temario, este array es la única
// fuente de verdad que hay que tocar.
export const PALACIOS = [
  { num: 1, nombre: "Administración Canaria", temas: ["t1", "t2", "t3"] },
  { num: 2, nombre: "Fábrica de los Derechos", temas: ["t4", "t5"] },
  { num: 3, nombre: "Banco de la República", temas: ["t6", "t7", "t8", "t9", "t10", "t11", "t12"] },
  { num: 4, nombre: "Cabildo Insular", temas: ["t13", "t14", "t15", "t16", "t17"] },
  { num: 5, nombre: "Casa de Cristal", temas: ["t18"] },
  { num: 6, nombre: "Puerto Comercial", temas: ["t19", "t20", "t21"] },
  { num: 7, nombre: "Terminal de Fronteras", temas: ["t22", "t23"] },
  { num: 8, nombre: "Torre de Europa", temas: ["t24", "t25"] },
  { num: 9, nombre: "Centro de Mando", temas: ["t26"] }
];

// Índice inverso tema → palacio (Map<string, number>) construido una
// sola vez en el cierre del módulo. Lookup O(1) en _resolverPalacio.
const _TEMA_A_PALACIO = (() => {
  const m = new Map();
  for (const p of PALACIOS) {
    for (const t of p.temas) m.set(t, p.num);
  }
  return m;
})();

// =============================================================
// _resolverPalacio(gesto) → number | null
//
// Estrategia de derivación (en orden):
//   1. payload.tema_id        → mapeo directo
//   2. payload.fuente_id      → si fuente.id empieza por "t<N>" o
//                               por "t<N>:<algo>" (epígrafe), extrae
//                               el prefijo de tema. Si no encaja, null.
//   3. payload.epi_id         → si el epi_id codifica el tema (formato
//                               "t<N>:<epi>"), úsalo. Útil para gestos
//                               que se quedaron sólo con epi_id.
//   4. nada                   → null (irá al cubo sin_palacio).
//
// Nota: un tema_id válido no listado en PALACIOS (ej. "t99" o "tX")
// se considera "sin palacio" — no rompemos por datos sucios.
function _resolverPalacio(g) {
  const p = g && g.payload;
  if (!p) return null;

  // 1. tema_id directo
  if (typeof p.tema_id === "string") {
    const num = _TEMA_A_PALACIO.get(p.tema_id);
    if (num) return num;
  }

  // 2. fuente_id (síntesis que referencia un epígrafe canónico).
  //    Formatos esperados: "t6" | "t6:e2" | "t6:algo_largo".
  if (typeof p.fuente_id === "string") {
    const tema = p.fuente_id.split(":")[0];
    const num = _TEMA_A_PALACIO.get(tema);
    if (num) return num;
  }

  // 3. epi_id con prefijo de tema. data.js usa item.id = "tN:eX",
  //    pero el epi_id "pelado" no debería traerlo. Lo cubrimos por
  //    si algún gesto duplica el id completo aquí.
  if (typeof p.epi_id === "string" && p.epi_id.includes(":")) {
    const tema = p.epi_id.split(":")[0];
    const num = _TEMA_A_PALACIO.get(tema);
    if (num) return num;
  }

  return null;
}

// =============================================================
// agregarPulsoPalacios(gestos, opts) → PulsoPalaciosData
//
// PURA: dada una lista cualquiera de gestos y opciones, devuelve la
// agregación. No toca DOM ni localStorage (la lectura del log se hace
// en abrirPulsoPalacios para mantener esto testeable).
//
// opts:
//   ventanaDias     — número, default 30.
//   palacioUsuario  — number 1..9, opcional. Si se pasa, fuerza el
//                     "tu palacio"; si no, se deriva del más frecuente.

export function agregarPulsoPalacios(gestos, opts = {}) {
  const ventanaDias = Number.isFinite(opts.ventanaDias) ? opts.ventanaDias : 30;
  const palacioForzado = Number.isFinite(opts.palacioUsuario) ? opts.palacioUsuario : null;

  const corte = Date.now() - (ventanaDias * 24 * 3600 * 1000);

  // Cubos por palacio (Map<num, bucket>) + contador sin_palacio.
  const buckets = new Map();
  let sinPalacio = 0;

  for (const g of (gestos || [])) {
    if (!g || g.falso) continue;            // gestos falsos no cuentan
    const ts = g.ts ? Date.parse(g.ts) : NaN;
    if (!Number.isFinite(ts) || ts < corte) continue;

    const num = _resolverPalacio(g);
    if (!num) { sinPalacio++; continue; }

    let b = buckets.get(num);
    if (!b) {
      const meta = PALACIOS.find(p => p.num === num);
      b = { num, nombre: meta.nombre, gestos: 0, ultimo_ts: null };
      buckets.set(num, b);
    }
    b.gestos++;
    if (!b.ultimo_ts || ts > Date.parse(b.ultimo_ts)) b.ultimo_ts = g.ts;
  }

  // Intensidad relativa respecto al palacio más activo.
  let maxGestos = 0;
  for (const b of buckets.values()) {
    if (b.gestos > maxGestos) maxGestos = b.gestos;
  }

  // Lista de activos ordenada por gestos desc.
  const palacios = [...buckets.values()]
    .map(b => ({
      num: b.num,
      nombre: b.nombre,
      gestos: b.gestos,
      ultimo_ts: b.ultimo_ts,
      intensidad: maxGestos > 0 ? b.gestos / maxGestos : 0
    }))
    .sort((a, b) => b.gestos - a.gestos);

  // Tu palacio:
  //   · si opts.palacioUsuario está, se respeta (deferred-future hook
  //     para una preferencia manual);
  //   · si no, se deriva del primero del ranking (el dominante).
  //   · si no hay actividad, null.
  let usuario_palacio = null;
  if (palacioForzado) {
    const meta = PALACIOS.find(p => p.num === palacioForzado);
    if (meta) {
      const activo = palacios.find(p => p.num === palacioForzado);
      usuario_palacio = {
        num: meta.num,
        nombre: meta.nombre,
        gestos: activo ? activo.gestos : 0
      };
    }
  } else if (palacios.length > 0) {
    const top = palacios[0];
    usuario_palacio = { num: top.num, nombre: top.nombre, gestos: top.gestos };
  }

  // Silenciosos: los 9 palacios menos los activos. SIEMPRE listables
  // (la mística "lenta" del módulo — toda casa tiene puerta abierta).
  const activosSet = new Set(palacios.map(p => p.num));
  const silenciosos = PALACIOS
    .filter(p => !activosSet.has(p.num))
    .map(p => ({ num: p.num, nombre: p.nombre }));

  return {
    ventana_dias: ventanaDias,
    total_gestos: palacios.reduce((s, p) => s + p.gestos, 0),
    total_palacios_activos: palacios.length,
    palacios,
    usuario_palacio,
    silenciosos,
    sin_palacio: sinPalacio
  };
}

// =============================================================
// HELPERS DE FORMATEO

// Diferencia de tiempo relativa breve, calibrada para escala días
// (la ventana del módulo). Cuando ya son meses, devolvemos "+30 d".
function _haceRel(iso) {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  const diff = Date.now() - t;
  if (diff < 0)                return "ahora";
  const h = Math.round(diff / 3600000);
  if (h < 1)                   return "hace <1 h";
  if (h < 24)                  return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1)                 return "ayer";
  if (d < 30)                  return `hace ${d} d`;
  return `hace +30 d`;
}

// Pluralización ligera para conteos de gestos/palacios.
function _plural(n, sing, plu) {
  return `${n} ${n === 1 ? sing : plu}`;
}

// Devuelve el rango legible de temas de un palacio: "t1–t3", "t18",
// "t6–t12". Lo usamos para el subtítulo de cada fila.
function _rangoTemas(temas) {
  if (!temas || temas.length === 0) return "";
  if (temas.length === 1) return temas[0];
  return temas[0] + "–" + temas[temas.length - 1];
}

// =============================================================
// renderPulsoPalacios(container, data, ctx) → void
//
// Inyecta el HTML del panel dentro del container. Idempotente: vacía
// y rellena cada vez.
//
// ctx:
//   onPalacioClick(num) — usuario pincha un palacio activo (app.js
//                         puede filtrar el feed por sus temas).
//   onEmpezarPalacio(num) — usuario pincha "+ empezar epígrafe aquí"
//                         en un palacio silencioso (app.js abre el
//                         primer epígrafe no tocado de ese palacio).

export function renderPulsoPalacios(container, data, ctx = {}) {
  if (!container) return;
  container.innerHTML = "";

  const { palacios, usuario_palacio, silenciosos, sin_palacio,
          total_gestos, total_palacios_activos,
          ventana_dias } = data;

  // ── Cabecera ────────────────────────────────────────────────
  const head = document.createElement("div");
  head.className = "pulso-pal-head";
  head.innerHTML = `
    <h2 class="pulso-pal-title">Pulso de palacios <span class="pulso-pal-title-sub">· últimos ${ventana_dias} d</span></h2>
    <p class="pulso-pal-summary">
      <span class="pulso-pal-num">${total_gestos}</span>
      ${_plural(total_gestos, "gesto", "gestos")} en
      <span class="pulso-pal-num">${total_palacios_activos}</span>
      de <span class="pulso-pal-num">${PALACIOS.length}</span> palacios
    </p>
  `;
  container.appendChild(head);

  // ── Estado vacío total ──────────────────────────────────────
  // Si nadie ha tocado nada en ventana, mensaje contemplativo —
  // los silenciosos abajo dan la entrada a la acción.
  if (total_gestos === 0) {
    const empty = document.createElement("p");
    empty.className = "pulso-pal-empty";
    empty.textContent = "La biblioteca está en silencio en los últimos " +
                        ventana_dias + " días. Empieza por cualquier palacio.";
    container.appendChild(empty);
  }

  // ── Tu palacio ──────────────────────────────────────────────
  if (usuario_palacio && usuario_palacio.gestos > 0) {
    const meta = PALACIOS.find(p => p.num === usuario_palacio.num);

    const tu = document.createElement("section");
    tu.className = "pulso-pal-tuyo";
    tu.dataset.pulsoPalacio = String(usuario_palacio.num);

    const label = document.createElement("p");
    label.className = "pulso-pal-tuyo-label";
    label.textContent = "Tu palacio";
    tu.appendChild(label);

    const fila = document.createElement("div");
    fila.className = "pulso-pal-tuyo-fila";

    const numEl = document.createElement("span");
    numEl.className = "pulso-pal-num-grande";
    numEl.textContent = String(usuario_palacio.num);

    const info = document.createElement("div");
    info.className = "pulso-pal-tuyo-info";

    const nombreEl = document.createElement("p");
    nombreEl.className = "pulso-pal-tuyo-nombre";
    nombreEl.textContent = usuario_palacio.nombre;
    info.appendChild(nombreEl);

    const subEl = document.createElement("p");
    subEl.className = "pulso-pal-tuyo-meta";
    subEl.innerHTML =
      `<span class="pulso-pal-rango">${_rangoTemas(meta?.temas)}</span> · ` +
      `<span class="pulso-pal-num">${usuario_palacio.gestos}</span> ${_plural(usuario_palacio.gestos, "gesto", "gestos")}`;
    info.appendChild(subEl);

    fila.append(numEl, info);
    tu.appendChild(fila);

    // Acción: entrar al feed filtrado por este palacio.
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pulso-pal-btn pulso-pal-btn-tuyo";
    btn.dataset.pulsoAction = "ver-palacio";
    btn.textContent = "ver mi palacio";
    btn.addEventListener("click", () => ctx.onPalacioClick?.(usuario_palacio.num));
    tu.appendChild(btn);

    container.appendChild(tu);
  }

  // ── Palacios activos ────────────────────────────────────────
  if (palacios.length > 0) {
    const seccion = document.createElement("section");
    seccion.className = "pulso-pal-seccion";

    const subtitulo = document.createElement("h3");
    subtitulo.className = "pulso-pal-subtitulo";
    subtitulo.textContent = "Palacios activos";
    seccion.appendChild(subtitulo);

    const lista = document.createElement("ul");
    lista.className = "pulso-pal-lista";
    lista.dataset.pulsoLista = "activos";

    for (const p of palacios) {
      const meta = PALACIOS.find(x => x.num === p.num);

      const li = document.createElement("li");
      li.className = "pulso-pal-fila pulso-pal-fila--activa";
      li.dataset.pulsoPalacio = String(p.num);
      li.tabIndex = 0;
      li.setAttribute("role", "button");
      li.setAttribute("aria-label",
        `Palacio ${p.num}, ${p.nombre}, ${p.gestos} gestos. Ver feed del palacio.`);

      // Barra horizontal proporcional como en Ágora, pero color
      // azul-índigo (contemplativo, no de alarma).
      const barraWrap = document.createElement("span");
      barraWrap.className = "pulso-pal-barra-wrap";
      const barra = document.createElement("span");
      barra.className = "pulso-pal-barra";
      barra.style.width = (p.intensidad * 100).toFixed(1) + "%";
      barraWrap.appendChild(barra);

      // Número grande del palacio (1..9) a la izquierda.
      const numEl = document.createElement("span");
      numEl.className = "pulso-pal-fila-num";
      numEl.textContent = String(p.num);

      // Nombre + rango temas a la derecha.
      const nombreBlock = document.createElement("span");
      nombreBlock.className = "pulso-pal-fila-nombre-block";

      const nombre = document.createElement("span");
      nombre.className = "pulso-pal-fila-nombre";
      nombre.textContent = p.nombre;

      const rango = document.createElement("span");
      rango.className = "pulso-pal-fila-rango";
      rango.textContent = _rangoTemas(meta?.temas);

      nombreBlock.append(nombre, rango);

      const metaEl = document.createElement("span");
      metaEl.className = "pulso-pal-fila-meta";
      metaEl.textContent = `${p.gestos} g · ${_haceRel(p.ultimo_ts)}`;

      const flecha = document.createElement("span");
      flecha.className = "pulso-pal-fila-flecha";
      flecha.textContent = "▸";

      li.append(barraWrap, numEl, nombreBlock, metaEl, flecha);

      const click = () => ctx.onPalacioClick?.(p.num);
      li.addEventListener("click", click);
      li.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); click(); }
      });

      lista.appendChild(li);
    }

    seccion.appendChild(lista);
    container.appendChild(seccion);
  }

  // ── Palacios silenciosos ────────────────────────────────────
  // Siempre se muestran los que no están activos. Sin badges de
  // alarma: una invitación discreta a empezar.
  if (silenciosos.length > 0) {
    const seccion = document.createElement("section");
    seccion.className = "pulso-pal-seccion pulso-pal-seccion--silenciosos";

    const subtitulo = document.createElement("h3");
    subtitulo.className = "pulso-pal-subtitulo pulso-pal-subtitulo--dim";
    subtitulo.textContent = "Palacios silenciosos";
    seccion.appendChild(subtitulo);

    const lista = document.createElement("ul");
    lista.className = "pulso-pal-lista";
    lista.dataset.pulsoLista = "silenciosos";

    for (const s of silenciosos) {
      const meta = PALACIOS.find(x => x.num === s.num);

      const li = document.createElement("li");
      li.className = "pulso-pal-fila pulso-pal-fila--silenciosa";
      li.dataset.pulsoPalacio = String(s.num);

      const numEl = document.createElement("span");
      numEl.className = "pulso-pal-fila-num pulso-pal-fila-num--dim";
      numEl.textContent = String(s.num);

      const nombreBlock = document.createElement("span");
      nombreBlock.className = "pulso-pal-fila-nombre-block";

      const nombre = document.createElement("span");
      nombre.className = "pulso-pal-fila-nombre";
      nombre.textContent = s.nombre;

      const rango = document.createElement("span");
      rango.className = "pulso-pal-fila-rango";
      rango.textContent = _rangoTemas(meta?.temas);

      nombreBlock.append(nombre, rango);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pulso-pal-btn pulso-pal-btn-mini";
      btn.dataset.pulsoAction = "empezar-palacio";
      btn.textContent = "+ empezar epígrafe aquí";
      btn.setAttribute("aria-label",
        `Empezar el primer epígrafe del palacio ${s.num} ${s.nombre}`);
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        ctx.onEmpezarPalacio?.(s.num);
      });

      li.append(numEl, nombreBlock, btn);
      lista.appendChild(li);
    }

    seccion.appendChild(lista);
    container.appendChild(seccion);
  }

  // ── Sin palacio (pie discreto) ──────────────────────────────
  if (sin_palacio > 0) {
    const pie = document.createElement("p");
    pie.className = "pulso-pal-singeo";
    pie.innerHTML =
      `<span class="pulso-pal-singeo-label">Sin palacio:</span> ` +
      `<span class="pulso-pal-num">${sin_palacio}</span> ` +
      _plural(sin_palacio, "gesto", "gestos");
    container.appendChild(pie);
  }
}

// =============================================================
// abrirPulsoPalacios(ctx) → void
//
// Crea o reusa un overlay full-screen, lee los gestos, agrega y
// renderiza. El overlay se identifica con id `pulso-pal-overlay`
// para que app.js pueda comprobar si está abierto o cerrarlo.

const OVERLAY_ID  = "pulso-pal-overlay";
const PANEL_ID    = "pulso-pal-panel";
const CONTENT_ID  = "pulso-pal-content";

export function abrirPulsoPalacios(ctx = {}) {
  let overlay = document.getElementById(OVERLAY_ID);
  let content;

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.className = "pulso-pal-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "pulso-pal-title-heading");

    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.className = "pulso-pal-panel";

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "pulso-pal-close";
    closeBtn.setAttribute("aria-label", "Cerrar Pulso de palacios");
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", cerrarPulsoPalacios);

    content = document.createElement("div");
    content.id = CONTENT_ID;
    content.className = "pulso-pal-content";

    panel.append(closeBtn, content);
    overlay.appendChild(panel);

    // Cerrar al pulsar fuera del panel.
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) cerrarPulsoPalacios();
    });

    // Tecla ESC.
    overlay._escHandler = (e) => {
      if (e.key === "Escape") cerrarPulsoPalacios();
    };
    document.addEventListener("keydown", overlay._escHandler);

    document.body.appendChild(overlay);
  } else {
    content = document.getElementById(CONTENT_ID);
  }

  if (!content) return;
  const todos = getAllGestos();
  const datos = agregarPulsoPalacios(todos, {
    ventanaDias: ctx.ventanaDias || 30,
    palacioUsuario: ctx.palacioUsuario || null
  });

  // Envolvemos los callbacks para cerrar el overlay al accionar —
  // el usuario espera que pinchar "ver palacio 3" lo lleve al feed.
  renderPulsoPalacios(content, datos, {
    onPalacioClick: (num) => {
      cerrarPulsoPalacios();
      ctx.onPalacioClick?.(num);
    },
    onEmpezarPalacio: (num) => {
      cerrarPulsoPalacios();
      ctx.onEmpezarPalacio?.(num);
    }
  });
}

// Helper para cerrar el overlay desde fuera o desde el propio módulo.
export function cerrarPulsoPalacios() {
  const overlay = document.getElementById(OVERLAY_ID);
  if (!overlay) return;
  if (overlay._escHandler) {
    document.removeEventListener("keydown", overlay._escHandler);
  }
  overlay.remove();
}

// =============================================================
// VERIFICACIÓN — Mini-test documental (no se ejecuta).
//
// Gestos sintéticos repartidos entre palacio 3 (t8, t10) y palacio 6
// (t19, t21), más un gesto sin tema_id válido. Ventana 30d.
//
// Entrada (asume ahora ~ 2026-05-28):
//   const gestos = [
//     // Palacio 3 — Banco de la República (t6..t12)
//     { tipo:"epigrafe_visto", userId:"u_a",
//       payload:{ tema_id:"t8", epi_id:"e2" },  ts:"2026-05-27T09:00:00Z" },
//     { tipo:"epigrafe_visto", userId:"u_a",
//       payload:{ tema_id:"t8", epi_id:"e3" },  ts:"2026-05-27T10:30:00Z" },
//     { tipo:"sintesis",       userId:"u_a",
//       payload:{ fuente_id:"t10:e1" },         ts:"2026-05-25T18:00:00Z" },
//
//     // Palacio 6 — Puerto Comercial (t19..t21)
//     { tipo:"epigrafe_visto", userId:"u_b",
//       payload:{ tema_id:"t19", epi_id:"e1" }, ts:"2026-05-20T11:00:00Z" },
//     { tipo:"epigrafe_visto", userId:"u_b",
//       payload:{ tema_id:"t21", epi_id:"e2" }, ts:"2026-05-15T16:00:00Z" },
//
//     // Sin tema_id válido → sin_palacio = 1
//     { tipo:"nota", userId:"u_c", payload:{}, ts:"2026-05-26T12:00:00Z" }
//   ];
//
// agregarPulsoPalacios(gestos, { ventanaDias: 30 })
// → {
//     ventana_dias: 30,
//     total_gestos: 5,
//     total_palacios_activos: 2,
//     palacios: [
//       { num:3, nombre:"Banco de la República", gestos:3,
//         ultimo_ts:"2026-05-27T10:30:00Z", intensidad:1.0 },
//       { num:6, nombre:"Puerto Comercial",     gestos:2,
//         ultimo_ts:"2026-05-20T11:00:00Z", intensidad:0.6667 }
//     ],
//     usuario_palacio: { num:3, nombre:"Banco de la República", gestos:3 },
//     silenciosos: [
//       { num:1, nombre:"Administración Canaria" },
//       { num:2, nombre:"Fábrica de los Derechos" },
//       { num:4, nombre:"Cabildo Insular" },
//       { num:5, nombre:"Casa de Cristal" },
//       { num:7, nombre:"Terminal de Fronteras" },
//       { num:8, nombre:"Torre de Europa" },
//       { num:9, nombre:"Centro de Mando" }
//     ],
//     sin_palacio: 1
//   }
