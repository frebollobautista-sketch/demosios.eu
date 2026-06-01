// agora-app/pulso.js — "Pulso de Zona": vista textual/ranking del mapa
// POLIS. Mientras el viewer geográfico-cartográfico responde a "dónde está
// pasando" con cartografía, Pulso responde con un listado priorizado:
// qué barrios concentran actividad en las últimas 72h y cuáles siguen
// silenciosos pero merecen invitación.
//
// Filosofía: cuando la masa de gestos es baja (estado de arranque),
// dispersarlos en un mapa los hace invisibles. Una lista corta y
// destacada los vuelve "leíbles" — el usuario ve dónde ir, o se ve a sí
// mismo invitado a activar su propia zona.
//
// Este módulo NO emite gestos. Solo agrega, presenta y emite eventos
// (vía callbacks en ctx) que la app principal interpreta (filtrar feed,
// abrir creador de gesto).
//
// Restricciones de diseño: vanilla ES modules, cero dependencias, todo
// el dato proviene del log local de gestos.

import { getAllGestos } from "../shared/gestos.js?v=20260529-agora-verde";

// =============================================================
// ZONAS PIVOTE
//
// Set canónico de barrios/municipios que SIEMPRE queremos mostrar — sea
// porque están activos (suben al ranking) o silenciosos (caen al bloque
// "esperando", como invitación visible). Subconjunto deliberado de los
// topónimos de feed.js: los que el equipo identifica como "candidatos a
// primer foco cívico" en la fase de arranque.
//
// No reflejan ranking poblacional ni jerarquía administrativa — son las
// que estratégicamente queremos visibilizar antes que ninguna otra.
const ZONAS_PIVOTE = [
  "Vegueta", "Triana", "La Isleta", "Tafira",
  "Telde", "Arucas", "Gáldar",
  "Santa Cruz de Tenerife", "La Laguna"
];

// =============================================================
// agregarPulso(gestos, opts) → PulsoData
//
// PURA: dada una lista cualquiera de gestos y opciones, devuelve la
// agregación. No depende del DOM ni del localStorage (la lectura del log
// se hace en abrirPulso para mantener esto testeable).

export function agregarPulso(gestos, opts = {}) {
  const ventanaHoras = Number.isFinite(opts.ventanaHoras) ? opts.ventanaHoras : 72;
  const zonaUsuario  = opts.zonaUsuario || null;

  const corte = Date.now() - (ventanaHoras * 3600 * 1000);

  // Cubo por zona. Clave especial __sin_geo__ para gestos sin nada.
  const buckets = new Map();
  let sinGeo = 0;

  for (const g of (gestos || [])) {
    if (!g || g.falso) continue;     // los marcados como falsos no cuentan
    const ts = g.ts ? Date.parse(g.ts) : NaN;
    if (!Number.isFinite(ts) || ts < corte) continue;

    // Resolución de zona:
    //   1. gesto.zona (top-level, el caso canónico)
    //   2. payload.municipio
    //   3. payload.isla
    //   4. payload.zona  (gestos sobre posts externos que normalizaron
    //                     geo dentro de payload)
    // Si nada, va al cubo "sin geo".
    const zona = g.zona
              || g.payload?.municipio
              || g.payload?.isla
              || g.payload?.zona
              || null;

    if (!zona) { sinGeo++; continue; }

    let b = buckets.get(zona);
    if (!b) {
      b = { zona, gestos: 0, usuarios: new Set(), ultimo_ts: null };
      buckets.set(zona, b);
    }
    b.gestos++;
    if (g.userId) b.usuarios.add(g.userId);
    if (!b.ultimo_ts || ts > Date.parse(b.ultimo_ts)) b.ultimo_ts = g.ts;
  }

  // Ranking — máximo absoluto define la intensidad relativa (0..1).
  let maxGestos = 0;
  for (const b of buckets.values()) {
    if (b.gestos > maxGestos) maxGestos = b.gestos;
  }

  const zonas = [...buckets.values()]
    .map(b => ({
      zona: b.zona,
      gestos: b.gestos,
      usuarios_unicos: b.usuarios.size,
      ultimo_ts: b.ultimo_ts,
      intensidad: maxGestos > 0 ? b.gestos / maxGestos : 0
    }))
    .sort((a, b) => b.gestos - a.gestos);

  // Zona del usuario — la encontramos en el ranking si existe, si no
  // sintetizamos una entrada vacía (intensidad 0) para que el render
  // pueda mostrar el call-to-action "activa la primera señal aquí".
  let usuario_zona = null;
  if (zonaUsuario) {
    usuario_zona = zonas.find(z => z.zona === zonaUsuario) || {
      zona: zonaUsuario,
      gestos: 0,
      usuarios_unicos: 0,
      ultimo_ts: null,
      intensidad: 0
    };
  }

  // Silenciosas invitantes — pivotes que NO tienen actividad en ventana.
  const zonasActivas = new Set(zonas.map(z => z.zona));
  const silenciosas_invitantes = ZONAS_PIVOTE.filter(z => !zonasActivas.has(z));

  return {
    ventana_hrs: ventanaHoras,
    total_gestos: zonas.reduce((s, z) => s + z.gestos, 0),
    total_zonas_activas: zonas.length,
    zonas,
    usuario_zona,
    sin_geo: sinGeo,
    silenciosas_invitantes
  };
}

// =============================================================
// HELPERS DE FORMATEO

// Diferencia de tiempo relativa breve ("hace 3 min", "hace 2 h", "ayer").
// El módulo es presentación pura, así que mantenemos el formateador local
// en vez de pedir uno al ctx — evita acoplamiento.
function _haceRel(iso) {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  const diff = Date.now() - t;
  if (diff < 0)                return "ahora";
  const min = Math.round(diff / 60000);
  if (min < 1)                 return "ahora";
  if (min < 60)                return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24)                  return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1)                 return "ayer";
  if (d < 7)                   return `hace ${d} d`;
  return `hace +${d} d`;
}

// Pluralización ligera para los conteos de personas/gestos.
function _plural(n, sing, plu) {
  return `${n} ${n === 1 ? sing : plu}`;
}

// =============================================================
// renderPulso(container, pulsoData, ctx) → void
//
// Inyecta el HTML del panel dentro del container. Idempotente: vacía y
// rellena cada vez.

export function renderPulso(container, pulsoData, ctx = {}) {
  if (!container) return;
  container.innerHTML = "";

  const { zonas, usuario_zona, sin_geo,
          silenciosas_invitantes,
          total_gestos, total_zonas_activas,
          ventana_hrs } = pulsoData;

  // ── Cabecera ────────────────────────────────────────────────
  const head = document.createElement("div");
  head.className = "pulso-head";
  head.innerHTML = `
    <h2 class="pulso-title">Pulso <span class="pulso-title-sub">· últimas ${ventana_hrs}h</span></h2>
    <p class="pulso-summary">
      <span class="pulso-num">${total_gestos}</span>
      ${_plural(total_gestos, "gesto", "gestos")} en
      <span class="pulso-num">${total_zonas_activas}</span>
      ${_plural(total_zonas_activas, "zona activa", "zonas activas")}
    </p>
  `;
  container.appendChild(head);

  // ── Estado vacío total ──────────────────────────────────────
  // Si NO hay actividad y NO hay zona de usuario, mostramos un mensaje
  // y saltamos directamente al bloque de silenciosas (que sí dará
  // entrada a la acción).
  const vacio = total_gestos === 0 && !usuario_zona;
  if (vacio) {
    const empty = document.createElement("p");
    empty.className = "pulso-empty";
    empty.textContent = "Nadie ha dejado señal en las últimas " +
                        ventana_hrs + " horas. Sé la primera.";
    container.appendChild(empty);
  }

  // ── Tu zona ─────────────────────────────────────────────────
  if (usuario_zona) {
    const tuZona = document.createElement("section");
    tuZona.className = "pulso-tuzona";
    tuZona.dataset.pulsoZona = usuario_zona.zona;  // app.js puede leer esto

    const tituloTuZona = document.createElement("p");
    tituloTuZona.className = "pulso-tuzona-label";
    tituloTuZona.textContent = "Tu zona";
    tuZona.appendChild(tituloTuZona);

    const nombreTuZona = document.createElement("p");
    nombreTuZona.className = "pulso-tuzona-nombre";
    nombreTuZona.textContent = usuario_zona.zona;
    tuZona.appendChild(nombreTuZona);

    if (usuario_zona.gestos > 0) {
      const meta = document.createElement("p");
      meta.className = "pulso-tuzona-meta";
      meta.innerHTML =
        `<span class="pulso-num">${usuario_zona.gestos}</span> ${_plural(usuario_zona.gestos, "gesto", "gestos")} · ` +
        `<span class="pulso-num">${usuario_zona.usuarios_unicos}</span> ${_plural(usuario_zona.usuarios_unicos, "persona", "personas")} · ` +
        `<span class="pulso-rel">${_haceRel(usuario_zona.ultimo_ts)}</span>`;
      tuZona.appendChild(meta);

      // Acción primaria: ver el feed filtrado por tu zona.
      const btnVer = document.createElement("button");
      btnVer.type = "button";
      btnVer.className = "pulso-btn pulso-btn-zona";
      btnVer.dataset.pulsoAction = "ver-zona";
      btnVer.textContent = "ver mi zona";
      btnVer.addEventListener("click", () => ctx.onZonaClick?.(usuario_zona.zona));
      tuZona.appendChild(btnVer);
    } else {
      // Silencioso: invitación explícita.
      const invitacion = document.createElement("p");
      invitacion.className = "pulso-tuzona-invita";
      invitacion.textContent = "activa la primera señal aquí";
      tuZona.appendChild(invitacion);

      const btnActivar = document.createElement("button");
      btnActivar.type = "button";
      btnActivar.className = "pulso-btn pulso-btn-activar";
      btnActivar.dataset.pulsoAction = "activar-zona";
      btnActivar.textContent = "+ señal aquí";
      btnActivar.addEventListener("click", () => ctx.onActivar?.(usuario_zona.zona));
      tuZona.appendChild(btnActivar);
    }

    container.appendChild(tuZona);
  }

  // ── Zonas activas ───────────────────────────────────────────
  if (zonas.length > 0) {
    const seccion = document.createElement("section");
    seccion.className = "pulso-seccion";

    const subtitulo = document.createElement("h3");
    subtitulo.className = "pulso-subtitulo";
    subtitulo.textContent = "Zonas activas";
    seccion.appendChild(subtitulo);

    const lista = document.createElement("ul");
    lista.className = "pulso-lista";
    lista.dataset.pulsoLista = "activas";

    for (const z of zonas) {
      const li = document.createElement("li");
      li.className = "pulso-fila pulso-fila--activa";
      li.dataset.pulsoZona = z.zona;
      // Tabular para que sea navegable con teclado y clicable como link.
      li.tabIndex = 0;
      li.setAttribute("role", "button");
      li.setAttribute("aria-label",
        `${z.zona}, ${z.gestos} gestos de ${z.usuarios_unicos} personas. Ver feed de la zona.`);

      // Barra horizontal proporcional a la zona más activa.
      const barraWrap = document.createElement("span");
      barraWrap.className = "pulso-barra-wrap";
      const barra = document.createElement("span");
      barra.className = "pulso-barra";
      barra.style.width = (z.intensidad * 100).toFixed(1) + "%";
      barraWrap.appendChild(barra);

      const nombre = document.createElement("span");
      nombre.className = "pulso-fila-nombre";
      nombre.textContent = z.zona;

      const meta = document.createElement("span");
      meta.className = "pulso-fila-meta";
      meta.textContent =
        `${z.gestos} g · ${z.usuarios_unicos} pers`;

      const flecha = document.createElement("span");
      flecha.className = "pulso-fila-flecha";
      flecha.textContent = "▸";

      li.append(barraWrap, nombre, meta, flecha);

      const click = () => ctx.onZonaClick?.(z.zona);
      li.addEventListener("click", click);
      li.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); click(); }
      });

      lista.appendChild(li);
    }

    seccion.appendChild(lista);
    container.appendChild(seccion);
  }

  // ── Silenciosas invitantes ──────────────────────────────────
  if (silenciosas_invitantes.length > 0) {
    const seccion = document.createElement("section");
    seccion.className = "pulso-seccion pulso-seccion--silenciosas";

    const subtitulo = document.createElement("h3");
    subtitulo.className = "pulso-subtitulo pulso-subtitulo--dim";
    subtitulo.textContent = "Silenciosas (esperando)";
    seccion.appendChild(subtitulo);

    const lista = document.createElement("ul");
    lista.className = "pulso-lista";
    lista.dataset.pulsoLista = "silenciosas";

    for (const zona of silenciosas_invitantes) {
      const li = document.createElement("li");
      li.className = "pulso-fila pulso-fila--silenciosa";
      li.dataset.pulsoZona = zona;

      const punto = document.createElement("span");
      punto.className = "pulso-fila-punto";
      punto.textContent = "·";

      const nombre = document.createElement("span");
      nombre.className = "pulso-fila-nombre";
      nombre.textContent = zona;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pulso-btn pulso-btn-mini";
      btn.dataset.pulsoAction = "activar-zona";
      btn.textContent = "activa";
      btn.setAttribute("aria-label", `Activar primera señal en ${zona}`);
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        ctx.onActivar?.(zona);
      });

      li.append(punto, nombre, btn);
      lista.appendChild(li);
    }

    seccion.appendChild(lista);
    container.appendChild(seccion);
  }

  // ── Sin geo (apartado, no compite con ranking) ─────────────
  if (sin_geo > 0) {
    const pie = document.createElement("p");
    pie.className = "pulso-singeo";
    pie.innerHTML =
      `<span class="pulso-singeo-label">Sin geo:</span> ` +
      `<span class="pulso-num">${sin_geo}</span> ` +
      _plural(sin_geo, "gesto", "gestos");
    container.appendChild(pie);
  }
}

// =============================================================
// abrirPulso(ctx) → void
//
// Crea o reusa un overlay full-screen, lee los gestos, agrega y renderiza.
// El overlay se identifica con id `pulso-overlay` para que la app principal
// pueda comprobar si está abierto o cerrarlo programáticamente.

const OVERLAY_ID  = "pulso-overlay";
const PANEL_ID    = "pulso-panel";
const CONTENT_ID  = "pulso-content";

export function abrirPulso(ctx = {}) {
  // Reusar si ya existe (idempotente: re-render con datos frescos).
  let overlay = document.getElementById(OVERLAY_ID);
  let content;

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.className = "pulso-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "pulso-title-heading");

    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.className = "pulso-panel";

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "pulso-close";
    closeBtn.setAttribute("aria-label", "Cerrar Pulso");
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", cerrarPulso);

    content = document.createElement("div");
    content.id = CONTENT_ID;
    content.className = "pulso-content";

    panel.append(closeBtn, content);
    overlay.appendChild(panel);

    // Cerrar al pulsar fuera del panel.
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) cerrarPulso();
    });

    // Tecla ESC.
    overlay._escHandler = (e) => {
      if (e.key === "Escape") cerrarPulso();
    };
    document.addEventListener("keydown", overlay._escHandler);

    document.body.appendChild(overlay);
  } else {
    content = document.getElementById(CONTENT_ID);
  }

  // Lectura + agregación + render. Si por alguna razón content no
  // existe (DOM mutado externamente), abortamos sin romper.
  if (!content) return;
  const todos = getAllGestos();
  const datos = agregarPulso(todos, {
    ventanaHoras: 72,
    zonaUsuario: ctx.zonaUsuario || null
  });

  // Envolvemos los callbacks para cerrar el overlay automáticamente al
  // accionar — el usuario espera que pinchar "ver Vegueta" lo lleve al
  // feed, no que quede el overlay encima.
  renderPulso(content, datos, {
    onZonaClick: (zona) => {
      cerrarPulso();
      ctx.onZonaClick?.(zona);
    },
    onActivar: (zona) => {
      cerrarPulso();
      ctx.onActivar?.(zona);
    }
  });
}

// Helper para cerrar el overlay desde fuera o desde el propio módulo.
export function cerrarPulso() {
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
// Array sintético de 8 gestos repartido en varias zonas y un gesto sin
// geo. Lo que `agregarPulso` debería devolver con ventana 72h y
// zonaUsuario "La Isleta" (silenciosa en este set).
//
// Entrada:
//   const ahora = "2026-05-27T20:00:00Z";
//   const gestos = [
//     { tipo:"senal", userId:"u_a", zona:"Vegueta", ts:"2026-05-27T15:00:00Z" },
//     { tipo:"senal", userId:"u_b", zona:"Vegueta", ts:"2026-05-27T16:30:00Z" },
//     { tipo:"reporte", userId:"u_a", zona:"Vegueta", ts:"2026-05-27T17:00:00Z" },
//     { tipo:"senal", userId:"u_c", zona:"Telde",    ts:"2026-05-26T10:00:00Z" },
//     { tipo:"senal", userId:"u_d", zona:"Telde",    ts:"2026-05-26T18:00:00Z" },
//     { tipo:"senal", userId:"u_e", zona:"Tafira",   ts:"2026-05-25T22:00:00Z" },
//     // sin zona top-level pero con payload.municipio:
//     { tipo:"senal", userId:"u_f", zona:null,
//       payload:{ municipio:"Arucas" },                 ts:"2026-05-27T09:00:00Z" },
//     // totalmente sin geo → cubo sin_geo:
//     { tipo:"reporte", userId:"u_g", zona:null, payload:{}, ts:"2026-05-27T11:00:00Z" }
//   ];
//
// agregarPulso(gestos, { ventanaHoras: 72, zonaUsuario: "La Isleta" })
// → {
//     ventana_hrs: 72,
//     total_gestos: 7,
//     total_zonas_activas: 4,
//     zonas: [
//       { zona:"Vegueta", gestos:3, usuarios_unicos:2, ultimo_ts:"2026-05-27T17:00:00Z", intensidad:1.0 },
//       { zona:"Telde",   gestos:2, usuarios_unicos:2, ultimo_ts:"2026-05-26T18:00:00Z", intensidad:0.6667 },
//       { zona:"Tafira",  gestos:1, usuarios_unicos:1, ultimo_ts:"2026-05-25T22:00:00Z", intensidad:0.3333 },
//       { zona:"Arucas",  gestos:1, usuarios_unicos:1, ultimo_ts:"2026-05-27T09:00:00Z", intensidad:0.3333 }
//     ],
//     usuario_zona: { zona:"La Isleta", gestos:0, usuarios_unicos:0, ultimo_ts:null, intensidad:0 },
//     sin_geo: 1,
//     silenciosas_invitantes: ["Triana", "La Isleta", "Gáldar",
//                              "Santa Cruz de Tenerife", "La Laguna"]
//       // (Vegueta, Tafira, Telde, Arucas están activas → filtradas del pivote)
//   }
