// agora-app/quorums.js — Termómetro de Quórum.
//
// Convocatorias con umbral: la gente firma porque ve cuánto falta. El
// progreso ES el feed; el vacío también informa (si nadie firma, es señal
// honesta de que la idea no agarra — no es triste, es información).
//
// Modelo:
//   - El gesto "convoco_quorum" (capa 4) crea una convocatoria con
//     {titulo, descripcion, umbral, deadline, lugar?, fecha_evento?}.
//   - El gesto "firmo_quorum" añade una firma referenciada por quorum_id.
//   - La unicidad por (userId, quorum_id) la valida ESTE módulo antes de
//     persistir (el catálogo lo declara como condición pero no la aplica
//     automáticamente — recordGesto es tonto, escribe lo que le digan).
//
// Persistencia: localStorage vía recordGesto. Pre-Supabase, los gestos
// viven sólo en el navegador del autor — por eso el SEED garantiza que
// el feed muestra algo aunque nadie haya emitido nada todavía.
//
// Render: termómetro horizontal cuya barra de progreso ES el contenido
// emocional principal. La línea humana ("Faltan X firmas") refuerza pero
// nunca culpabiliza. Si está alcanzado, cambia a verde y mensaje de cita.

import {
  recordGesto,
  getAllGestos,
  getUserId
} from "../shared/gestos.js?v=20260529-agora-verde";

// =============================================================
// QUORUMS_SEED — Convocatorias de demostración.
//
// Elegidas para cubrir mezcla de:
//   - Distintas islas/municipios (no todo Las Palmas) → muestra que el
//     feed tiene aliento archipiélago.
//   - Distintas escalas de umbral (12, 20, 8, 40, 25) → la barra se ve
//     interesante en distintos estados.
//   - Distintas urgencias (deadline en 3, 7, 10, 18, 25 días) → al pasar
//     el tiempo unos se vuelven "urgentes" y otros "vigentes".
//   - Distintos temas plausibles: movilidad, vivienda, cultura, espacio
//     público, alimentación. Nada de polémica radioactiva — son ejemplos
//     amables que invitan a firmar sin pelear.
//
// Las fechas se computan en tiempo de import como ISO a partir de hoy,
// para que el seed envejezca con el navegador (no quedan obsoletas si el
// usuario abre la app meses después).

const _D = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString();
};

export const QUORUMS_SEED = [
  {
    id: "seed_q_vegueta_parking",
    titulo: "Asamblea sobre el aparcamiento de Vegueta",
    descripcion: "El ayuntamiento ha planteado cambios en el aparcamiento residencial. Necesitamos hablarlo antes de que pase el plazo de alegaciones.",
    umbral: 12,
    deadline: _D(10),
    lugar: "Plaza de Santa Ana",
    fecha_evento: _D(14),
    zona: "Vegueta",
    municipio: "Las Palmas de Gran Canaria",
    creador_seed: true
  },
  {
    id: "seed_q_laguna_biblio",
    titulo: "Pedir horario ampliado en la biblioteca municipal",
    descripcion: "Cierra a las 20h en época de exámenes. Si juntamos firmas suficientes lo llevamos al pleno del próximo mes.",
    umbral: 25,
    deadline: _D(18),
    lugar: "Biblioteca Municipal Adrián Alemán",
    fecha_evento: null,
    zona: "La Laguna",
    municipio: "La Laguna",
    creador_seed: true
  },
  {
    id: "seed_q_arrecife_mercadillo",
    titulo: "Recuperar el mercadillo del Charco los sábados",
    descripcion: "Lleva dos años suspendido. Hay productores locales dispuestos a volver si vemos demanda real.",
    umbral: 20,
    deadline: _D(7),
    lugar: "Charco de San Ginés",
    fecha_evento: _D(28),
    zona: "Arrecife",
    municipio: "Arrecife",
    creador_seed: true
  },
  {
    id: "seed_q_telde_parque",
    titulo: "Limpiar y reabrir el parque infantil de San Juan",
    descripcion: "Convocatoria vecinal para limpieza voluntaria una mañana de sábado. Material lo aporta la asociación.",
    umbral: 8,
    deadline: _D(3),
    lugar: "Parque San Juan, Telde",
    fecha_evento: _D(5),
    zona: "Telde",
    municipio: "Telde",
    creador_seed: true
  },
  {
    id: "seed_q_palma_cultura",
    titulo: "Reabrir el cine-club de Santa Cruz de La Palma",
    descripcion: "Sesiones quincenales, gestión vecinal. Hace falta un grupo motor de al menos 40 personas para arrancar.",
    umbral: 40,
    deadline: _D(25),
    lugar: "Casa Salazar (a confirmar)",
    fecha_evento: null,
    zona: "Santa Cruz de La Palma",
    municipio: "Santa Cruz de La Palma",
    creador_seed: true
  }
];

// =============================================================
// HELPERS — Reconstrucción del estado.

// Calcula porcentaje 0-100 con clamp. Útil para barra termómetro.
function _pct(firmas, umbral) {
  if (!umbral || umbral <= 0) return 0;
  const r = Math.round((firmas / umbral) * 100);
  return Math.max(0, Math.min(100, r));
}

// Formato humano del deadline: "hoy", "mañana", "en 3 días", "en 2 semanas".
// Devuelve también un `urgente` boolean (<48h y todavía vigente).
function _formatearDeadline(deadlineIso) {
  const t = Date.parse(deadlineIso);
  if (!Number.isFinite(t)) return { texto: "sin fecha", dias: Infinity, urgente: false, vencido: false };
  const ahora = Date.now();
  const diffMs = t - ahora;
  const vencido = diffMs < 0;
  const horas = Math.round(diffMs / (3600 * 1000));
  const dias = Math.round(diffMs / (24 * 3600 * 1000));
  let texto;
  if (vencido) {
    texto = "vencido";
  } else if (horas < 24) {
    texto = horas <= 1 ? "hoy mismo" : `en ${horas} h`;
  } else if (dias === 1) {
    texto = "mañana";
  } else if (dias < 14) {
    texto = `en ${dias} días`;
  } else if (dias < 60) {
    const sem = Math.round(dias / 7);
    texto = `en ${sem} ${sem === 1 ? "semana" : "semanas"}`;
  } else {
    const meses = Math.round(dias / 30);
    texto = `en ${meses} ${meses === 1 ? "mes" : "meses"}`;
  }
  const urgente = !vencido && diffMs < (48 * 3600 * 1000);
  return { texto, dias, urgente, vencido };
}

// Formato humano de fecha_evento ("12 jun", "sábado 14", etc.). Mantengo
// simple: día y mes corto en español.
const _MESES_ES = ["ene", "feb", "mar", "abr", "may", "jun",
                   "jul", "ago", "sep", "oct", "nov", "dic"];
function _formatearFechaEvento(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "fecha por confirmar";
  const d = new Date(t);
  return `${d.getDate()} ${_MESES_ES[d.getMonth()]}`;
}

// Determina la temporalidad (-1..+1) para dims.temporalidad: cuanto más
// lejos el deadline, más +1; cuanto más cerca, más -1. Caducados no se
// muestran pero por completitud devolvemos -1 también.
function _temporalidadFromDeadline(deadlineIso) {
  const fmt = _formatearDeadline(deadlineIso);
  if (fmt.vencido) return -1;
  if (fmt.dias <= 2) return -1;
  if (fmt.dias <= 7) return -0.5;
  if (fmt.dias <= 30) return 0;
  return +1;
}

// Cuenta firmas únicas por userId. Acepta el array completo de gestos
// (lo recibe ya filtrado por tipo). Importante: si el mismo userId firma
// dos veces el mismo quórum (no debería pasar, pero el log es append-only
// y podría haber un bug), contamos una sola vez.
function _contarFirmasUnicas(firmasGestos) {
  const ids = new Set();
  for (const g of firmasGestos) {
    if (g.falso) continue;
    if (g.userId) ids.add(g.userId);
  }
  return ids.size;
}

// =============================================================
// loadQuorums() — Devuelve Post[] del feed.

export function loadQuorums() {
  const gestos = getAllGestos();
  const convocoGestos = gestos.filter(g => g.tipo === "convoco_quorum" && !g.falso);
  const firmasGestos  = gestos.filter(g => g.tipo === "firmo_quorum"   && !g.falso);
  const uidActual = getUserId();

  // Indexa firmas por quorum_ref → array de gestos firma. Esto evita un
  // escaneo cuadrático cuando hay muchos quórums × muchas firmas.
  const firmasPorQuorum = new Map();
  for (const f of firmasGestos) {
    const ref = f.payload?.quorum_ref;
    if (!ref) continue;
    if (!firmasPorQuorum.has(ref)) firmasPorQuorum.set(ref, []);
    firmasPorQuorum.get(ref).push(f);
  }

  // Combina: SEED + convoco_quorum del log. SEED se trata como si fueran
  // gestos sintéticos sin userId (no son de nadie). Los del log usan su
  // ts como id si payload.quorum_id falta (compatibilidad por si alguien
  // emitió un convoco_quorum sin id en pruebas).
  const items = [];

  for (const seed of QUORUMS_SEED) {
    const firmas = firmasPorQuorum.get(seed.id) || [];
    items.push(_construirPost({
      quorum_id: seed.id,
      titulo: seed.titulo,
      descripcion: seed.descripcion,
      umbral: seed.umbral,
      deadline: seed.deadline,
      lugar: seed.lugar,
      fecha_evento: seed.fecha_evento,
      zona: seed.zona,
      municipio: seed.municipio,
      ts_creacion: seed.deadline, // sin ts real → usamos deadline como aproximación
      firmas,
      uidActual,
      es_seed: true
    }));
  }

  for (const g of convocoGestos) {
    const p = g.payload || {};
    const quorum_id = p.quorum_id || g.ts;
    const firmas = firmasPorQuorum.get(quorum_id) || [];
    items.push(_construirPost({
      quorum_id,
      titulo: p.titulo || "Convocatoria sin título",
      descripcion: p.descripcion || "",
      umbral: p.umbral || 2,
      deadline: p.deadline,
      lugar: p.lugar,
      fecha_evento: p.fecha_evento,
      zona: g.zona || p.zona,
      municipio: p.municipio,
      ts_creacion: g.ts,
      firmas,
      uidActual,
      es_seed: false,
      creador_uid: g.userId
    }));
  }

  // Filtra caducados (por defecto no aparecen en el feed). Si en algún
  // momento queremos mostrarlos como "archivo de propuestas que no
  // cuajaron" es un parámetro fácil de añadir.
  return items.filter(p => p.payload.estado !== "caducado");
}

// Construye el objeto Post a partir de los datos de un quórum.
function _construirPost(d) {
  const firmasCount = _contarFirmasUnicas(d.firmas);
  const fmtDeadline = _formatearDeadline(d.deadline);

  let estado;
  if (firmasCount >= d.umbral) estado = "abierto";
  else if (fmtDeadline.vencido) estado = "caducado";
  else estado = "vigente";

  const ya_firmado = d.firmas.some(f => f.userId === d.uidActual);
  const progreso = _pct(firmasCount, d.umbral);

  // body legible para clientes que no entienden kind="quorum". Sirve
  // también para el "compartir" como texto plano.
  const fechaTxt = d.fecha_evento ? ` · 📅 ${_formatearFechaEvento(d.fecha_evento)}` : "";
  const lugarTxt = d.lugar ? `📍 ${d.lugar}` : "";
  const metaLinea = [lugarTxt, fechaTxt.trim()].filter(Boolean).join(" ");
  const body = `${d.titulo}\n\n${d.descripcion}${metaLinea ? "\n\n" + metaLinea : ""}`;

  const geo = {};
  if (d.zona) geo.zona = d.zona;
  if (d.municipio) geo.municipio = d.municipio;
  // Si no hay nada geográfico, geo queda como objeto vacío → lo
  // convertimos en null para coincidir con el contrato del feed.
  const geoFinal = (geo.zona || geo.municipio) ? geo : null;

  return {
    id: "quorum-" + d.quorum_id,
    source: "civic",
    source_label: "CONVOCATORIA",
    kind: "quorum",
    author: d.es_seed
      ? { handle: "@vecindario", display: "vecindario" }
      : { handle: "@convocante", display: "convocante anónimo" },
    body,
    ts: d.ts_creacion || null,
    geo: geoFinal,
    payload: {
      quorum_id: d.quorum_id,
      titulo: d.titulo,
      descripcion: d.descripcion,
      umbral: d.umbral,
      deadline: d.deadline,
      lugar: d.lugar,
      fecha_evento: d.fecha_evento,
      firmas: firmasCount,
      progreso,
      estado,
      ya_firmado_por_usuario_actual: ya_firmado,
      es_seed: d.es_seed,
      _deadline_fmt: fmtDeadline // pre-computado para el render
    },
    url_origen: null,
    dims: {
      cercania: 0,        // TODO geo del usuario
      conocidos: -1,      // público por definición
      reaccionar: +1,     // ES una llamada a acción explícita
      temporalidad: _temporalidadFromDeadline(d.deadline)
    }
  };
}

// =============================================================
// crearQuorum(data) — Emite gesto convoco_quorum.

export function crearQuorum(data) {
  if (!data || typeof data !== "object") {
    throw new Error("crearQuorum: data requerida");
  }
  const { titulo, descripcion, umbral, deadline, lugar, fecha_evento } = data;

  if (!titulo || !String(titulo).trim()) {
    throw new Error("crearQuorum: titulo requerido");
  }
  if (!Number.isFinite(umbral) || umbral < 2) {
    throw new Error("crearQuorum: umbral debe ser >= 2");
  }
  const tDeadline = Date.parse(deadline);
  if (!Number.isFinite(tDeadline) || tDeadline <= Date.now()) {
    throw new Error("crearQuorum: deadline debe ser fecha futura ISO");
  }

  // ID estable: prefijo q_ + base36(ts) + 4 chars de azar. Lo bastante
  // único para coexistir con otros quórums creados el mismo milisegundo.
  const quorum_id = "q_" +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 6);

  // Zona derivada: si data.zona viene, úsala. Si no, deduce del lugar
  // por mención literal (búsqueda simple — el feed ya tiene detectarGeo
  // más sofisticado pero no lo importamos para no acoplar este módulo).
  const zona = data.zona || _deducirZonaDeLugar(lugar);

  const payload = {
    quorum_id,
    titulo: String(titulo).trim(),
    descripcion: descripcion ? String(descripcion).trim() : "",
    umbral: Math.floor(umbral),
    deadline,
    lugar: lugar || null,
    fecha_evento: fecha_evento || null
  };

  recordGesto("convoco_quorum", payload, zona || null);

  // El propio creador NO se autofirma. Deliberado: que el gesto de firmar
  // sea explícito mantiene el log auditable y el conteo "honest" (si el
  // creador no firma, quizá ni él cree en su propia propuesta — señal).
  return quorum_id;
}

// Heurística mínima para sacar zona de un texto libre. Si no encuentra
// nada, devuelve null y el feed sigue funcionando sin geo.
function _deducirZonaDeLugar(lugar) {
  if (!lugar) return null;
  // Lista corta de barrios/municipios canarios reconocibles. Esto es un
  // espejo voluntariamente reducido de TOPONIMOS_CANARIAS de feed.js —
  // no importamos esa lista para no acoplar módulos.
  const TOP = [
    "Vegueta", "Triana", "La Isleta", "Tafira", "Tamaraceite",
    "Las Palmas de Gran Canaria", "Las Palmas",
    "Telde", "Arucas", "Gáldar", "Agaete", "Mogán",
    "Santa Cruz de Tenerife", "La Laguna", "La Orotava",
    "Puerto de la Cruz", "Adeje", "Arona",
    "Arrecife", "Puerto del Rosario",
    "San Sebastián de la Gomera", "Santa Cruz de La Palma",
    "El Hierro"
  ];
  const lugarLow = lugar.toLowerCase();
  // Más largos primero para evitar que "Las Palmas" se trague a
  // "Las Palmas de Gran Canaria".
  const ordenado = [...TOP].sort((a, b) => b.length - a.length);
  for (const t of ordenado) {
    if (lugarLow.includes(t.toLowerCase())) return t;
  }
  return null;
}

// =============================================================
// firmarQuorum(quorum_id) — Emite gesto firmo_quorum con unicidad.

export function firmarQuorum(quorum_id) {
  if (!quorum_id) return false;
  const uid = getUserId();
  const todos = getAllGestos();
  const yaFirmado = todos.some(g =>
    g.tipo === "firmo_quorum" &&
    !g.falso &&
    g.userId === uid &&
    g.payload?.quorum_ref === quorum_id
  );
  if (yaFirmado) return false;

  recordGesto("firmo_quorum", { quorum_ref: quorum_id }, null);
  return true;
}

// =============================================================
// renderQuorumCard(post, ctx) — Render custom para kind="quorum".

export function renderQuorumCard(post, ctx) {
  const p = post.payload || {};
  const estado = p.estado || "vigente";
  const fmtDeadline = p._deadline_fmt || _formatearDeadline(p.deadline);

  const art = document.createElement("article");
  art.className = "post is-quorum";
  art.dataset.estado = estado;
  if (fmtDeadline.urgente && estado === "vigente") {
    art.dataset.urgente = "true";
  }

  // ── Cabecera ────────────────────────────────────────────────
  const head = document.createElement("header");
  head.className = "post-head";

  const geoSpan = document.createElement("span");
  geoSpan.className = "post-geo";
  geoSpan.textContent = post.geo?.zona
    ? "◉ " + post.geo.zona
    : "◉ Canarias";
  head.appendChild(geoSpan);

  const srcSpan = document.createElement("span");
  srcSpan.className = "post-source";
  srcSpan.textContent = "CONVOCATORIA";
  head.appendChild(srcSpan);

  // Badge contextual (urgente / caducado / abierto).
  if (estado === "abierto") {
    const badge = document.createElement("span");
    badge.className = "quorum-badge is-abierto";
    badge.textContent = "✓ alcanzado";
    head.appendChild(badge);
  } else if (estado === "caducado") {
    const badge = document.createElement("span");
    badge.className = "quorum-badge is-caducado";
    badge.textContent = "caducado";
    head.appendChild(badge);
  } else if (fmtDeadline.urgente) {
    const badge = document.createElement("span");
    badge.className = "quorum-badge is-urgente";
    badge.textContent = "⏳ urgente";
    head.appendChild(badge);
  }

  art.appendChild(head);

  // ── Título / descripción ────────────────────────────────────
  const h3 = document.createElement("h3");
  h3.className = "quorum-title";
  h3.textContent = p.titulo || "Convocatoria";
  art.appendChild(h3);

  if (p.descripcion) {
    const desc = document.createElement("p");
    desc.className = "quorum-desc";
    desc.textContent = p.descripcion;
    art.appendChild(desc);
  }

  // ── Línea meta (lugar + fecha + deadline) ───────────────────
  const meta = document.createElement("p");
  meta.className = "quorum-meta";
  const partes = [];
  if (p.lugar) partes.push("📍 " + p.lugar);
  if (p.fecha_evento) partes.push("📅 " + _formatearFechaEvento(p.fecha_evento));
  if (estado === "vigente") partes.push("⏳ " + fmtDeadline.texto);
  meta.textContent = partes.join(" · ");
  art.appendChild(meta);

  // ── Termómetro ──────────────────────────────────────────────
  const termo = document.createElement("div");
  termo.className = "quorum-termometro";

  const bar = document.createElement("div");
  bar.className = "termo-bar";
  const fill = document.createElement("div");
  fill.className = "termo-fill";
  fill.style.width = (p.progreso || 0) + "%";
  bar.appendChild(fill);
  termo.appendChild(bar);

  const label = document.createElement("div");
  label.className = "termo-label";
  label.textContent = `${p.firmas} / ${p.umbral}  (${p.progreso}%)`;
  termo.appendChild(label);

  art.appendChild(termo);

  // ── Mensaje humano ──────────────────────────────────────────
  const mensaje = document.createElement("div");
  mensaje.className = "quorum-mensaje";
  if (estado === "abierto") {
    const dondeCuando = [
      p.fecha_evento ? `el ${_formatearFechaEvento(p.fecha_evento)}` : null,
      p.lugar ? `en ${p.lugar}` : null
    ].filter(Boolean).join(" ");
    mensaje.textContent = dondeCuando
      ? `✓ Alcanzado. Nos vemos ${dondeCuando}.`
      : "✓ Alcanzado. Quedará por confirmar lugar y fecha.";
  } else if (estado === "caducado") {
    mensaje.textContent = "No llegó al umbral antes del plazo. Queda como propuesta archivada.";
    mensaje.classList.add("is-faint");
  } else {
    const faltan = Math.max(0, (p.umbral || 0) - (p.firmas || 0));
    const colita = p.ya_firmado_por_usuario_actual
      ? "(la tuya cuenta — gracias)"
      : "(la tuya aún no está)";
    mensaje.textContent = `Faltan ${faltan} ${faltan === 1 ? "firma" : "firmas"}. ${colita}`;
    mensaje.classList.add("is-faint");
  }
  art.appendChild(mensaje);

  // ── HUD slot (lo monta app.js) ──────────────────────────────
  const hud = document.createElement("div");
  hud.className = "post-hud";
  art.appendChild(hud);

  // ── Acciones ────────────────────────────────────────────────
  const footer = document.createElement("footer");
  footer.className = "post-actions";

  if (estado === "vigente") {
    const btnFirmar = document.createElement("button");
    btnFirmar.dataset.act = "firmar";
    if (p.ya_firmado_por_usuario_actual) {
      btnFirmar.disabled = true;
      btnFirmar.textContent = "✓ firmaste";
      btnFirmar.className = "is-done";
    } else {
      btnFirmar.className = "primary";
      btnFirmar.textContent = "firmar +";
      btnFirmar.addEventListener("click", () => {
        if (ctx?.onFirmar) ctx.onFirmar(post);
      });
    }
    footer.appendChild(btnFirmar);
  } else if (estado === "abierto") {
    // Mantiene visible si tú firmaste (cierre emocional) pero ya no es
    // accionable. Si no firmaste pero está alcanzado, mostramos un botón
    // informativo desactivado — la convocatoria sigue siendo "real".
    const btn = document.createElement("button");
    btn.disabled = true;
    btn.textContent = p.ya_firmado_por_usuario_actual
      ? "✓ firmaste"
      : "✓ alcanzado";
    btn.className = "is-done";
    footer.appendChild(btn);
  }

  const btnCompartir = document.createElement("button");
  btnCompartir.dataset.act = "compartir";
  btnCompartir.textContent = "copiar enlace";
  btnCompartir.addEventListener("click", () => {
    if (ctx?.onCompartir) ctx.onCompartir(post);
  });
  footer.appendChild(btnCompartir);

  art.appendChild(footer);

  return art;
}

// =============================================================
// VERIFICACIÓN — Pintando un quórum vigente al 30%.
//
// Caso de uso documentado (no se ejecuta). Útil como referencia rápida
// del shape resultante.
//
// Input al pipeline:
//   - SEED contiene "seed_q_vegueta_parking" con umbral=12 y deadline
//     a +10 días desde hoy.
//   - localStorage tiene 4 gestos firmo_quorum (de 4 userId distintos)
//     con payload.quorum_ref = "seed_q_vegueta_parking".
//
// Estado tras loadQuorums():
//   {
//     id: "quorum-seed_q_vegueta_parking",
//     source: "civic",
//     source_label: "CONVOCATORIA",
//     kind: "quorum",
//     author: { handle: "@vecindario", display: "vecindario" },
//     body: "Asamblea sobre el aparcamiento de Vegueta\n\nEl ayuntamiento...",
//     ts: "<iso del deadline>",
//     geo: { zona: "Vegueta", municipio: "Las Palmas de Gran Canaria" },
//     payload: {
//       quorum_id: "seed_q_vegueta_parking",
//       titulo: "Asamblea sobre el aparcamiento de Vegueta",
//       descripcion: "...",
//       umbral: 12,
//       deadline: "<iso +10d>",
//       lugar: "Plaza de Santa Ana",
//       fecha_evento: "<iso +14d>",
//       firmas: 4,
//       progreso: 33,                        // round(4/12 * 100)
//       estado: "vigente",
//       ya_firmado_por_usuario_actual: false,
//       es_seed: true,
//       _deadline_fmt: { texto: "en 10 días", dias: 10, urgente: false, vencido: false }
//     },
//     url_origen: null,
//     dims: {
//       cercania:     0,    // sin geo de usuario aún
//       conocidos:   -1,    // público por definición
//       reaccionar:  +1,    // CTA explícito
//       temporalidad: 0     // deadline a 10 días → entre 7 y 30 → 0
//     }
//   }
//
// Render resultante (resumen):
//   <article class="post is-quorum" data-estado="vigente">
//     <header>
//       <span class="post-geo">◉ Vegueta</span>
//       <span class="post-source">CONVOCATORIA</span>
//     </header>
//     <h3>Asamblea sobre el aparcamiento de Vegueta</h3>
//     <p class="quorum-desc">...</p>
//     <p class="quorum-meta">📍 Plaza de Santa Ana · 📅 14 jun · ⏳ en 10 días</p>
//     <div class="quorum-termometro">
//       <div class="termo-bar"><div class="termo-fill" style="width: 33%"></div></div>
//       <div class="termo-label">4 / 12  (33%)</div>
//     </div>
//     <div class="quorum-mensaje is-faint">Faltan 8 firmas. (la tuya aún no está)</div>
//     <footer>
//       <button class="primary" data-act="firmar">firmar +</button>
//       <button data-act="compartir">copiar enlace</button>
//     </footer>
//   </article>
