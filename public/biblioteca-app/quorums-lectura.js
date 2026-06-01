// biblioteca-app/quorums-lectura.js — Quórums de Lectura Conjunta.
//
// Fork adaptado de agora-app/quorums.js. Misma mecánica (umbral, firmas,
// deadline) pero aplicada a "leer juntos" en lugar de "convocar asamblea".
// Una persona propone leer un libro/tema con N personas antes de una
// fecha; al alcanzar el umbral, el círculo se "abre" como grupo activo.
//
// Diferencias clave con quorums.js de Ágora:
//   - Tono contemplativo: no hay alarmas ámbar de urgencia <48h. Si el
//     plazo se acerca, simplemente lo dice ("en 3 días"), pero la barra
//     no cambia de color ni el borde alarma. Leer juntos no es urgente.
//   - Sin lugar físico → se sustituye por `fuente_id` (libro/recurso del
//     canon) o `tema_id` (tema interno mnemoHACK). El "dónde" es textual.
//   - Estado adicional "leyendo": cuando el umbral está alcanzado Y la
//     fecha_evento (día de arranque) ya pasó pero no hace mucho (≤30d).
//     Es el círculo en vida activa.
//   - Paleta CSS azul-índigo en lugar de ocre — registro intelectual,
//     no cívico.
//
// Gestos reutilizados (no añadimos al catálogo):
//   - convoco_quorum con payload.tipo_quorum = "lectura"
//   - firmo_quorum con payload.quorum_ref = quorum_id (igual que Ágora)
//
// Por qué distinguir con `tipo_quorum`: si en algún momento Ágora y
// Biblioteca compartiesen log (Supabase futuro), un mismo array de gestos
// debe permitir filtrar lectura ↔ asamblea sin ambigüedad. La marca va
// en el payload del convoco; las firmas heredan el tipo del convoco.

import {
  recordGesto,
  getAllGestos,
  getUserId
} from "../shared/gestos.js?v=20260527a";

// =============================================================
// QUORUMS_LECTURA_SEED — 5 lecturas conjuntas plausibles.
//
// Mezcla deliberada de:
//   - Canónico clásico (Marx-Engels, Manifiesto) → registro fundacional.
//   - Crítico contemporáneo (Pettit, Raventós, Mouffe) → republicanismo,
//     renta básica, agonismo. Coincide con el corpus del notebook LIBROS.
//   - Tema interno mnemoHACK (REF I, Tema 14) → muestra que los grupos
//     de lectura pueden engancharse al material propio del proyecto, no
//     sólo a libros externos.
//
// Umbrales variados (4, 6, 6, 8, 10) → el termómetro se ve interesante
// en distintos estados según vayan firmando personas distintas en el
// localStorage de cada navegador.
//
// Las fechas se calculan en tiempo de import — el seed envejece con el
// usuario, no queda obsoleto si abre la app meses después.

const _D = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString();
};

export const QUORUMS_LECTURA_SEED = [
  {
    id: "seed_ql_pettit_republicanismo",
    titulo: "Leer 'Republicanismo: una teoría sobre la libertad y el gobierno'",
    descripcion: "Sesiones quincenales, cuatro capítulos por encuentro. Buscamos discutir la idea de libertad como no-dominación frente a la liberal clásica.",
    fuente_id: "pettit-1997-republicanismo",
    autor: "Philip Pettit",
    umbral: 6,
    deadline: _D(28),
    fecha_evento: _D(35),
    creador_seed: true
  },
  {
    id: "seed_ql_raventos_renta_basica",
    titulo: "Leer 'La renta básica universal'",
    descripcion: "Grupo de lectura en torno a la propuesta de Raventós. Tres sesiones, una mensual. Abierto a quien no haya leído nada del tema todavía.",
    fuente_id: "raventos-2007-rb",
    autor: "Daniel Raventós",
    umbral: 8,
    deadline: _D(21),
    fecha_evento: _D(28),
    creador_seed: true
  },
  {
    id: "seed_ql_manifiesto_releer",
    titulo: "Releer el Manifiesto Comunista",
    descripcion: "Una sola sesión larga, edición anotada. La idea es releerlo con ojos de 2026 — qué sigue interpelando, qué ha caducado, qué pedía contexto que ya tenemos.",
    fuente_id: "marx-engels-1848-manifiesto",
    autor: "Marx & Engels",
    umbral: 10,
    deadline: _D(14),
    fecha_evento: _D(18),
    creador_seed: true
  },
  {
    id: "seed_ql_tema14_ref",
    titulo: "Lectura colectiva del Tema 14 (REF I)",
    descripcion: "Repasamos el Tema 14 entre quien lo tenga aplazado o quiera afianzarlo. Sin ponente — cada persona resume un epígrafe y se debate.",
    tema_id: "t14",
    umbral: 4,
    deadline: _D(10),
    fecha_evento: _D(12),
    creador_seed: true
  },
  {
    id: "seed_ql_mouffe_politico",
    titulo: "Discutir 'Sobre lo político'",
    descripcion: "Mouffe contra el consenso post-político. Dos sesiones, capítulos repartidos. Quien venga con texto leído tendrá quien le rebata.",
    fuente_id: "mouffe-2007-sobre-lo-politico",
    autor: "Chantal Mouffe",
    umbral: 6,
    deadline: _D(21),
    fecha_evento: _D(26),
    creador_seed: true
  }
];

// =============================================================
// HELPERS — Reconstrucción del estado.

// Porcentaje 0-100 con clamp.
function _pct(firmas, umbral) {
  if (!umbral || umbral <= 0) return 0;
  const r = Math.round((firmas / umbral) * 100);
  return Math.max(0, Math.min(100, r));
}

// Formato humano del deadline. Diferencia con Ágora: NO marcamos
// `urgente` aunque falten <48h. Aquí no hay alarma ámbar — la lectura
// tiene ritmo propio. Devolvemos `dias` y `vencido` para el render
// textual, y un `texto` legible.
function _formatearDeadline(deadlineIso) {
  const t = Date.parse(deadlineIso);
  if (!Number.isFinite(t)) {
    return { texto: "sin fecha", dias: Infinity, vencido: false };
  }
  const ahora = Date.now();
  const diffMs = t - ahora;
  const vencido = diffMs < 0;
  const horas = Math.round(diffMs / (3600 * 1000));
  const dias = Math.round(diffMs / (24 * 3600 * 1000));
  let texto;
  if (vencido) {
    texto = "plazo cerrado";
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
  return { texto, dias, vencido };
}

// Formato corto de fecha_evento ("12 jun"). Igual que en Ágora.
const _MESES_ES = ["ene", "feb", "mar", "abr", "may", "jun",
                   "jul", "ago", "sep", "oct", "nov", "dic"];
function _formatearFechaEvento(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "fecha por confirmar";
  const d = new Date(t);
  return `${d.getDate()} ${_MESES_ES[d.getMonth()]}`;
}

// Cuenta firmas únicas por userId. Si un userId aparece dos veces (no
// debería, pero el log es append-only), una sola cuenta. Filtra falsos.
function _contarFirmasUnicas(firmasGestos) {
  const ids = new Set();
  for (const g of firmasGestos) {
    if (g.falso) continue;
    if (g.userId) ids.add(g.userId);
  }
  return ids.size;
}

// Determina el estado del quórum según firmas + deadlines + fecha_evento.
//
// Estados:
//   - "vigente"  → todavía recogiendo firmas, deadline no vencido.
//   - "abierto"  → alcanzó umbral pero fecha_evento aún no ha llegado
//                  (o no hay fecha_evento). Es el momento de "ya somos,
//                  preparémonos".
//   - "leyendo"  → alcanzó umbral Y fecha_evento ya pasó pero hace ≤30
//                  días. El círculo está vivo, leyendo activamente. Ese
//                  margen de 30d es arbitrario pero razonable: un grupo
//                  de lectura suele cubrir un libro entre 2 y 8 semanas.
//   - "caducado" → no alcanzó umbral antes del deadline. Archivado sin
//                  drama (la lectura no cuajó — es información honesta).
//
// Si pasados 30 días tras fecha_evento sigue "leyendo", se considera
// que el círculo ya terminó su ciclo y vuelve a "abierto" como hito
// histórico (no caducado, porque sí se logró). Decisión simple para no
// inventar un quinto estado.
function _estadoQuorum(firmasCount, umbral, deadlineIso, fechaEventoIso) {
  const alcanzado = firmasCount >= umbral;
  const fmt = _formatearDeadline(deadlineIso);

  if (!alcanzado) {
    return fmt.vencido ? "caducado" : "vigente";
  }

  // Alcanzado. ¿Estamos en periodo de lectura activa?
  if (fechaEventoIso) {
    const tEvento = Date.parse(fechaEventoIso);
    if (Number.isFinite(tEvento)) {
      const ahora = Date.now();
      const treintaDias = 30 * 24 * 3600 * 1000;
      if (ahora >= tEvento && ahora <= tEvento + treintaDias) {
        return "leyendo";
      }
    }
  }
  return "abierto";
}

// Cálculo de `canonico` para dims. Heurística:
//   - tema_id (interno mnemoHACK) → 0, terreno propio sin gradiente.
//   - fuente_id con autor en lista crítica conocida → +1 (registro crítico).
//   - fuente_id con autor canónico clásico → -1 (canon).
//   - fuente_id sin pista → 0 neutro.
//
// La lista no pretende ser exhaustiva — sólo cubrir los autores del SEED
// y unos pocos más previsibles. Si la app evoluciona, esto se reemplaza
// por metadatos del catálogo de fuentes.
const _AUTORES_CANONICOS = new Set([
  "marx", "engels", "marx & engels", "marx-engels",
  "platón", "aristóteles", "kant", "hegel", "rousseau", "hobbes", "locke"
]);
const _AUTORES_CRITICOS = new Set([
  "philip pettit", "pettit",
  "daniel raventós", "raventós",
  "chantal mouffe", "mouffe",
  "antonio gramsci", "gramsci",
  "judith butler", "butler"
]);

function _canonicoFromAutor(autor, tema_id) {
  if (tema_id) return 0;
  if (!autor) return 0;
  const a = String(autor).toLowerCase().trim();
  if (_AUTORES_CRITICOS.has(a)) return +1;
  if (_AUTORES_CANONICOS.has(a)) return -1;
  // Búsqueda parcial por apellido para "Marx & Engels" et al.
  for (const c of _AUTORES_CRITICOS) {
    if (a.includes(c)) return +1;
  }
  for (const c of _AUTORES_CANONICOS) {
    if (a.includes(c)) return -1;
  }
  return 0;
}

// =============================================================
// loadQuorumsLectura() — Devuelve Post[] del feed.

export function loadQuorumsLectura() {
  const gestos = getAllGestos();

  // Convocos de tipo lectura: convoco_quorum con payload.tipo_quorum=="lectura".
  const convocoGestos = gestos.filter(g =>
    g.tipo === "convoco_quorum" &&
    !g.falso &&
    g.payload?.tipo_quorum === "lectura"
  );

  // Firmas: como compartimos el gesto firmo_quorum con Ágora, indexamos
  // por quorum_ref. La pertenencia "es de lectura" la determina el
  // convoco referido — aquí sólo consultamos por los quorum_ref que nos
  // interesan (los del SEED + los de convocos de lectura del log).
  const firmasGestos = gestos.filter(g => g.tipo === "firmo_quorum" && !g.falso);
  const uidActual = getUserId();

  const firmasPorQuorum = new Map();
  for (const f of firmasGestos) {
    const ref = f.payload?.quorum_ref;
    if (!ref) continue;
    if (!firmasPorQuorum.has(ref)) firmasPorQuorum.set(ref, []);
    firmasPorQuorum.get(ref).push(f);
  }

  const items = [];

  for (const seed of QUORUMS_LECTURA_SEED) {
    const firmas = firmasPorQuorum.get(seed.id) || [];
    items.push(_construirPost({
      quorum_id: seed.id,
      titulo: seed.titulo,
      descripcion: seed.descripcion,
      fuente_id: seed.fuente_id || null,
      tema_id: seed.tema_id || null,
      autor: seed.autor || null,
      umbral: seed.umbral,
      deadline: seed.deadline,
      fecha_evento: seed.fecha_evento,
      ts_creacion: seed.deadline, // sin ts real → aproximación
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
      titulo: p.titulo || "Lectura sin título",
      descripcion: p.descripcion || "",
      fuente_id: p.fuente_id || null,
      tema_id: p.tema_id || null,
      autor: p.autor || null,
      umbral: p.umbral || 2,
      deadline: p.deadline,
      fecha_evento: p.fecha_evento,
      ts_creacion: g.ts,
      firmas,
      uidActual,
      es_seed: false,
      creador_uid: g.userId
    }));
  }

  // Devolvemos también los caducados, pero atenuados (sin badge ámbar,
  // solo gris). Decisión consciente: la lectura no cuajada sigue siendo
  // información de qué interesa al colectivo. No la escondemos.
  return items;
}

function _construirPost(d) {
  const firmasCount = _contarFirmasUnicas(d.firmas);
  const fmtDeadline = _formatearDeadline(d.deadline);
  const estado = _estadoQuorum(firmasCount, d.umbral, d.deadline, d.fecha_evento);

  const ya_firmado = d.firmas.some(f => f.userId === d.uidActual);
  const progreso = _pct(firmasCount, d.umbral);

  // body legible para clientes que no entienden kind="quorum_lectura".
  // Sirve también como texto plano para compartir.
  const partesBody = [d.titulo];
  if (d.descripcion) partesBody.push(d.descripcion);
  const metaPartes = [];
  if (d.autor) metaPartes.push(`📚 ${d.autor}`);
  if (d.fecha_evento) metaPartes.push(`📅 ${_formatearFechaEvento(d.fecha_evento)}`);
  if (metaPartes.length) partesBody.push(metaPartes.join(" · "));
  const body = partesBody.join("\n\n");

  return {
    id: "quorum-lectura-" + d.quorum_id,
    source: "critico",
    source_label: "GRUPO DE LECTURA",
    kind: "quorum_lectura",
    author: d.es_seed
      ? { handle: "@biblioteca", display: "biblioteca" }
      : { handle: "@convocante", display: "convocante" },
    body,
    ts: d.ts_creacion || null,
    payload: {
      quorum_id: d.quorum_id,
      titulo: d.titulo,
      descripcion: d.descripcion,
      fuente_id: d.fuente_id,
      tema_id: d.tema_id,
      autor: d.autor,
      umbral: d.umbral,
      deadline: d.deadline,
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
      // dominio 0: leer juntos no es ni íntimo ni público-amplio, es
      // intermedio (un círculo).
      dominio: 0,
      // canonico según autor / tema (ver _canonicoFromAutor).
      canonico: _canonicoFromAutor(d.autor, d.tema_id),
      // compania +1: el rasgo definitorio del gesto es leer EN GRUPO.
      compania: +1,
      // navegacion +1: la lectura colectiva es exploración horizontal,
      // no consumo vertical de feed.
      navegacion: +1
    }
  };
}

// =============================================================
// crearQuorumLectura(data) — Emite gesto convoco_quorum tipo "lectura".

export function crearQuorumLectura(data) {
  if (!data || typeof data !== "object") {
    throw new Error("crearQuorumLectura: data requerida");
  }
  const {
    titulo, descripcion, fuente_id, tema_id, autor,
    umbral, deadline, fecha_evento
  } = data;

  if (!titulo || !String(titulo).trim()) {
    throw new Error("crearQuorumLectura: titulo requerido");
  }
  if (!fuente_id && !tema_id) {
    // Exigimos al menos una de las dos. Sin ancla a fuente/tema, una
    // "lectura conjunta" es etérea — preferimos que la persona convocante
    // diga qué se lee.
    throw new Error("crearQuorumLectura: requiere fuente_id o tema_id");
  }
  if (!Number.isFinite(umbral) || umbral < 2) {
    throw new Error("crearQuorumLectura: umbral debe ser >= 2");
  }
  const tDeadline = Date.parse(deadline);
  if (!Number.isFinite(tDeadline) || tDeadline <= Date.now()) {
    throw new Error("crearQuorumLectura: deadline debe ser fecha futura ISO");
  }

  // ID estable. Prefijo `ql_` para distinguir visualmente en logs de los
  // quórums de Ágora (q_). Funcionalmente da igual; ayuda al debugging.
  const quorum_id = "ql_" +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 6);

  const payload = {
    tipo_quorum: "lectura",      // marca clave para que loadQuorumsLectura lo recoja
    quorum_id,
    titulo: String(titulo).trim(),
    descripcion: descripcion ? String(descripcion).trim() : "",
    fuente_id: fuente_id || null,
    tema_id: tema_id || null,
    autor: autor ? String(autor).trim() : null,
    umbral: Math.floor(umbral),
    deadline,
    fecha_evento: fecha_evento || null
  };

  // zona = null: las lecturas conjuntas no tienen geo. Si en algún
  // momento alguien quisiera "grupo de lectura presencial en Vegueta",
  // que use convoco_aqui de Ágora; este gesto es deliberadamente
  // a-geográfico (un círculo puede ser online, mixto, o moverse).
  recordGesto("convoco_quorum", payload, null);

  return quorum_id;
}

// =============================================================
// firmarQuorumLectura(quorum_id) — Emite firmo_quorum con unicidad.

export function firmarQuorumLectura(quorum_id) {
  if (!quorum_id) return false;
  const uid = getUserId();
  const todos = getAllGestos();
  // Misma lógica de unicidad que Ágora: un userId no puede firmar dos
  // veces el mismo quórum. Como el gesto firmo_quorum es compartido,
  // basta con comprobar quorum_ref — no hace falta filtrar por tipo.
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
// renderQuorumLecturaCard(post, ctx) — Render custom kind="quorum_lectura".

export function renderQuorumLecturaCard(post, ctx) {
  const p = post.payload || {};
  const estado = p.estado || "vigente";
  const fmtDeadline = p._deadline_fmt || _formatearDeadline(p.deadline);

  const art = document.createElement("article");
  art.className = "post is-quorum-lectura";
  art.dataset.estado = estado;

  // ── Cabecera ────────────────────────────────────────────────
  const head = document.createElement("header");
  head.className = "post-head";

  const srcSpan = document.createElement("span");
  srcSpan.className = "post-source";
  srcSpan.textContent = "GRUPO DE LECTURA";
  head.appendChild(srcSpan);

  // Badge contextual.
  // A diferencia de Ágora, NO mostramos badge ámbar de urgencia <48h —
  // la lectura no se grita. Sólo badges de estado positivo (leyendo,
  // abierto) o neutro discreto (caducado).
  if (estado === "leyendo") {
    const badge = document.createElement("span");
    badge.className = "quorum-l-badge is-leyendo";
    badge.textContent = "★ leyendo ahora";
    head.appendChild(badge);
  } else if (estado === "abierto") {
    const badge = document.createElement("span");
    badge.className = "quorum-l-badge is-abierto";
    badge.textContent = "✓ alcanzado";
    head.appendChild(badge);
  } else if (estado === "caducado") {
    const badge = document.createElement("span");
    badge.className = "quorum-l-badge is-caducado";
    badge.textContent = "archivada";
    head.appendChild(badge);
  }

  art.appendChild(head);

  // ── Título / descripción ────────────────────────────────────
  const h3 = document.createElement("h3");
  h3.className = "quorum-l-title";
  h3.textContent = p.titulo || "Lectura conjunta";
  art.appendChild(h3);

  if (p.descripcion) {
    const desc = document.createElement("p");
    desc.className = "quorum-l-desc";
    desc.textContent = p.descripcion;
    art.appendChild(desc);
  }

  // ── Línea meta (autor + fecha de arranque + plazo) ──────────
  const meta = document.createElement("p");
  meta.className = "quorum-l-meta";
  const partes = [];
  if (p.autor) partes.push("📚 " + p.autor);
  if (p.tema_id && !p.autor) partes.push("📑 tema " + p.tema_id);
  if (p.fecha_evento) partes.push("📅 " + _formatearFechaEvento(p.fecha_evento));
  if (estado === "vigente") partes.push("· " + fmtDeadline.texto);
  meta.textContent = partes.join(" · ");
  art.appendChild(meta);

  // ── Termómetro ──────────────────────────────────────────────
  const termo = document.createElement("div");
  termo.className = "quorum-l-termometro";

  const bar = document.createElement("div");
  bar.className = "termo-l-bar";
  const fill = document.createElement("div");
  fill.className = "termo-l-fill";
  fill.style.width = (p.progreso || 0) + "%";
  bar.appendChild(fill);
  termo.appendChild(bar);

  const label = document.createElement("div");
  label.className = "termo-l-label";
  label.textContent = `${p.firmas} / ${p.umbral}  (${p.progreso}%)`;
  termo.appendChild(label);

  art.appendChild(termo);

  // ── Mensaje humano ──────────────────────────────────────────
  const mensaje = document.createElement("div");
  mensaje.className = "quorum-l-mensaje";
  if (estado === "leyendo") {
    mensaje.textContent = "El círculo está en marcha. Si te sumas ahora puedes ponerte al día.";
  } else if (estado === "abierto") {
    const cuando = p.fecha_evento
      ? `Empezamos el ${_formatearFechaEvento(p.fecha_evento)}.`
      : "Queda por fijar fecha de arranque.";
    mensaje.textContent = `✓ Alcanzado. ${cuando}`;
  } else if (estado === "caducado") {
    mensaje.textContent = "No reunió suficientes lectores en el plazo. Queda archivada para retomar.";
    mensaje.classList.add("is-faint");
  } else {
    const faltan = Math.max(0, (p.umbral || 0) - (p.firmas || 0));
    const colita = p.ya_firmado_por_usuario_actual
      ? "(ya estás dentro)"
      : "(aún no te has sumado)";
    mensaje.textContent = `Faltan ${faltan} ${faltan === 1 ? "persona" : "personas"}. ${colita}`;
    mensaje.classList.add("is-faint");
  }
  art.appendChild(mensaje);

  // ── Acciones ────────────────────────────────────────────────
  const footer = document.createElement("footer");
  footer.className = "post-actions";

  if (estado === "vigente") {
    const btnFirmar = document.createElement("button");
    btnFirmar.dataset.act = "firmar";
    if (p.ya_firmado_por_usuario_actual) {
      btnFirmar.disabled = true;
      btnFirmar.textContent = "✓ te sumaste";
      btnFirmar.className = "is-done";
    } else {
      btnFirmar.className = "primary";
      btnFirmar.textContent = "me sumo";
      btnFirmar.addEventListener("click", () => {
        if (ctx?.onFirmar) ctx.onFirmar(post);
      });
    }
    footer.appendChild(btnFirmar);
  } else if (estado === "abierto" || estado === "leyendo") {
    // Visible si ya estás dentro (cierre emocional), informativo si no.
    const btn = document.createElement("button");
    btn.disabled = true;
    if (p.ya_firmado_por_usuario_actual) {
      btn.textContent = estado === "leyendo" ? "✓ leyendo" : "✓ te sumaste";
    } else {
      btn.textContent = estado === "leyendo" ? "★ en marcha" : "✓ alcanzado";
    }
    btn.className = "is-done";
    footer.appendChild(btn);
  }
  // Caducados: no hay botón de acción, sólo "copiar enlace" (abajo).

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
// VERIFICACIÓN — Quórum vigente al 40% (escenario documentado).
//
// Caso de uso (no se ejecuta, sólo referencia):
//
// Input:
//   - SEED contiene "seed_ql_raventos_renta_basica" con umbral=8 y
//     deadline a +21 días desde hoy, fecha_evento a +28 días.
//   - localStorage tiene 3 gestos firmo_quorum con userIds distintos
//     apuntando a quorum_ref = "seed_ql_raventos_renta_basica".
//   - El usuario actual NO está entre esos 3.
//
// Resultado de loadQuorumsLectura() (uno de los 5 items):
//   {
//     id: "quorum-lectura-seed_ql_raventos_renta_basica",
//     source: "critico",
//     source_label: "GRUPO DE LECTURA",
//     kind: "quorum_lectura",
//     author: { handle: "@biblioteca", display: "biblioteca" },
//     body: "Leer 'La renta básica universal'\n\nGrupo de lectura...\n\n📚 Daniel Raventós · 📅 25 jun",
//     ts: "<iso del deadline>",
//     payload: {
//       quorum_id: "seed_ql_raventos_renta_basica",
//       titulo: "Leer 'La renta básica universal'",
//       descripcion: "Grupo de lectura en torno a la propuesta de Raventós...",
//       fuente_id: "raventos-2007-rb",
//       tema_id: null,
//       autor: "Daniel Raventós",
//       umbral: 8,
//       deadline: "<iso +21d>",
//       fecha_evento: "<iso +28d>",
//       firmas: 3,
//       progreso: 38,          // round(3/8 * 100) → 37.5 → 38
//       estado: "vigente",     // 3 < 8 && deadline aún no vencido
//       ya_firmado_por_usuario_actual: false,
//       es_seed: true,
//       _deadline_fmt: { texto: "en 3 semanas", dias: 21, vencido: false }
//     },
//     url_origen: null,
//     dims: {
//       dominio:    0,
//       canonico:  +1,   // Raventós está en _AUTORES_CRITICOS
//       compania:  +1,
//       navegacion:+1
//     }
//   }
//
// Render simplificado:
//   <article class="post is-quorum-lectura" data-estado="vigente">
//     <header>
//       <span class="post-source">GRUPO DE LECTURA</span>
//       <!-- sin badge: vigente sin urgencia -->
//     </header>
//     <h3>Leer 'La renta básica universal'</h3>
//     <p class="quorum-l-desc">Grupo de lectura en torno a la propuesta de Raventós...</p>
//     <p class="quorum-l-meta">📚 Daniel Raventós · 📅 25 jun · · en 3 semanas</p>
//     <div class="quorum-l-termometro">
//       <div class="termo-l-bar"><div class="termo-l-fill" style="width: 38%"></div></div>
//       <div class="termo-l-label">3 / 8  (38%)</div>
//     </div>
//     <div class="quorum-l-mensaje is-faint">Faltan 5 personas. (aún no te has sumado)</div>
//     <footer>
//       <button class="primary" data-act="firmar">me sumo</button>
//       <button data-act="compartir">copiar enlace</button>
//     </footer>
//   </article>
//
// Notas del caso pedido en el contrato (vigente al 40%, 3/8, deadline a
// 14 días): los números coinciden salvo por el progreso (38% en vez de
// 40% por redondeo entero de 3/8) y el plazo (este SEED tiene 21d). Para
// reproducir exactamente 40% se necesitarían 4/10 firmas; mantengo el
// caso del SEED real porque ilustra mejor el camino completo de datos.
