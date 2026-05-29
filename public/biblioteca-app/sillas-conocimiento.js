// biblioteca-app/sillas-conocimiento.js — "Sillas vacías" del conocimiento.
//
// Equivalente conceptual a las sillas vacías del tejido cívico (Ágora),
// pero aplicado al saber. Dos tipos coexisten dentro del mismo módulo:
//
//   1. silla_epigrafe → un epígrafe del temario canónico mnemoHACK que el
//      usuario NUNCA ha tocado (no hay gesto suyo que lo referencie).
//      Le "espera": metáfora de pupitre vacío.
//
//   2. silla_fuente   → una de ~12 obras críticas hardcoded (semilla
//      curada a partir del NotebookLM "LIBROS": republicanismo, renta
//      básica, marxismo, democracia, ecología política) sobre la que el
//      usuario aún no ha hecho NINGUNA síntesis (gesto "sintesis" con
//      esa fuente en `payload.fuentes`).
//
// La metáfora: en Ágora las sillas son entidades cívicas sin firma; aquí
// son piezas de pensamiento sin diálogo. Las dims se eligen para que el
// rank() las haga aparecer cuando el usuario tire de los polos "frontera"
// (dominio = -1) o "crítico" (canonico = +1, sólo las fuentes); las
// epígrafe-sillas son canónicas (-1) — frontera del temario propio.
//
// NO modifica app.js/data.js: la integración correrá a cargo de quien
// monte estas cards en el feed (`renderSillaConocimientoCard`) junto a
// las cards normales del feed bibliotecario.

import { getAllGestos } from "../shared/gestos.js?v=20260527a";

// =============================================================
// FUENTES_CRITICAS_SEED — 12 obras canónicas de la biblioteca crítica.
//
// Selección alineada con el notebook LIBROS (id "libros") y los clusters
// del memory file:
//   - Republicanismo: Pettit, Skinner, Domènech.
//   - Renta básica: Standing, Raventós, Van Parijs.
//   - Marxismo: Marx-Engels, Harvey, Žižek.
//   - Democracia: Mouffe, Rancière.
//   - Ecología política: Riechmann.
//
// `palacio_relacionado` apunta a uno de los 9 palacios mnemónicos del
// proyecto (mapeo aproximado para que la UI pueda enlazar lateralmente
// si quiere — 1-9, opcional). El campo es informativo; no participa en
// la lógica de filtrado.

export const FUENTES_CRITICAS_SEED = [
  // ── Republicanismo ──────────────────────────────────────
  {
    id: "pettit-republicanismo",
    autor: "Philip Pettit",
    titulo: "Republicanismo. Una teoría sobre la libertad y el gobierno",
    ano: 1997,
    corriente: "republicanismo",
    resena_breve: "Define la libertad como no-dominación (frente al liberalismo de la no-interferencia). Marco contemporáneo para discutir poder arbitrario y ciudadanía.",
    palacio_relacionado: 1
  },
  {
    id: "skinner-libertad",
    autor: "Quentin Skinner",
    titulo: "La libertad antes del liberalismo",
    ano: 1998,
    corriente: "republicanismo",
    resena_breve: "Recupera la tradición neorromana: libre es quien no depende de la voluntad de otro. Historia conceptual que reabre la libertad republicana.",
    palacio_relacionado: 1
  },
  {
    id: "domenech-eclipse",
    autor: "Antoni Domènech",
    titulo: "El eclipse de la fraternidad",
    ano: 2004,
    corriente: "republicanismo",
    resena_breve: "Republicanismo democrático-plebeyo y la pista de la fraternidad como tercer término olvidado. Marx, Robespierre, propiedad fiduciaria.",
    palacio_relacionado: 2
  },

  // ── Renta básica ───────────────────────────────────────
  {
    id: "standing-precariado",
    autor: "Guy Standing",
    titulo: "El precariado. Una nueva clase social",
    ano: 2011,
    corriente: "renta_basica",
    resena_breve: "Diagnóstico del precariado como clase emergente y defensa de la renta básica como respuesta estructural — no caridad ni subsidio.",
    palacio_relacionado: 3
  },
  {
    id: "raventos-vida-buena",
    autor: "Daniel Raventós",
    titulo: "Vida buena, virtud y existencia material garantizada",
    corriente: "renta_basica",
    resena_breve: "Renta básica leída desde el republicanismo: condición material para la libertad efectiva, no transferencia compensatoria.",
    palacio_relacionado: 3
  },
  {
    id: "vanparijs-ingreso-basico",
    autor: "Philippe Van Parijs",
    titulo: "Ingreso básico para una sociedad libre",
    ano: 1995,
    corriente: "renta_basica",
    resena_breve: "Argumento liberal-igualitarista: real-libertad-para-todos requiere ingreso incondicional. Cuasi-canon contemporáneo del debate.",
    palacio_relacionado: 3
  },

  // ── Marxismo ───────────────────────────────────────────
  {
    id: "marx-engels-manifiesto",
    autor: "Karl Marx & Friedrich Engels",
    titulo: "Manifiesto del Partido Comunista",
    ano: 1848,
    corriente: "marxismo",
    resena_breve: "Texto-puerta. Análisis de clase, plusvalía implícita y programa político — leerlo desnudo de glosas escolares es ejercicio incómodo y necesario.",
    palacio_relacionado: 4
  },
  {
    id: "harvey-breve-historia-neoliberalismo",
    autor: "David Harvey",
    titulo: "Breve historia del neoliberalismo",
    ano: 2005,
    corriente: "marxismo",
    resena_breve: "Cartografía del neoliberalismo como restauración de poder de clase. Útil para conectar lo macro (FMI, Chile, Reagan) con lo cotidiano.",
    palacio_relacionado: 4
  },
  {
    id: "zizek-sublime",
    autor: "Slavoj Žižek",
    titulo: "El sujeto sublime de la ideología",
    ano: 1989,
    corriente: "marxismo",
    resena_breve: "Lectura lacaniana de la ideología: 'saben lo que hacen y aún así lo hacen'. Cinismo, fantasía y plusvalía simbólica.",
    palacio_relacionado: 5
  },

  // ── Democracia ─────────────────────────────────────────
  {
    id: "mouffe-paradoja",
    autor: "Chantal Mouffe",
    titulo: "La paradoja democrática",
    ano: 2000,
    corriente: "democracia",
    resena_breve: "Tensión irresoluble entre libertad liberal e igualdad democrática. Agonismo frente a consenso deliberativo: el conflicto como suelo.",
    palacio_relacionado: 6
  },
  {
    id: "ranciere-odio-democracia",
    autor: "Jacques Rancière",
    titulo: "El odio a la democracia",
    ano: 2005,
    corriente: "democracia",
    resena_breve: "La democracia como escándalo: poder del cualquiera, sin título. Crítica a la oligarquía representativa y al desprecio ilustrado por las mayorías.",
    palacio_relacionado: 6
  },

  // ── Ecología política ──────────────────────────────────
  {
    id: "riechmann-bioeconomia",
    autor: "Jorge Riechmann",
    titulo: "Bioeconomía para el siglo XXI",
    corriente: "ecologia_politica",
    resena_breve: "Marco bioeconómico (Georgescu-Roegen) aplicado al diseño político. Decrecimiento, límites termodinámicos y el problema del crecimiento como dogma.",
    palacio_relacionado: 7
  }
];

// =============================================================
// CONFIG por defecto.
//
// max_epigrafes capa el número de sillas-epígrafe inyectadas — 20 sigue
// la pauta de Ágora (sillas con presencia constante pero sin ahogar el
// feed). Las sillas-fuente son sólo 12, no necesitan tope salvo el
// propio tamaño del seed.

const DEFAULT_CONFIG = {
  enabled: true,
  max_epigrafes: 20,
  max_fuentes: 12
};

// Temas canónicos disponibles como .json. El temario nominal son t1..t26,
// pero los .json sólo existen para t1..t21. Ignoramos silenciosamente
// t22..t26: si el usuario nunca puede abrirlos, no tiene sentido
// recordárselos como "sillas pendientes" — sería culpabilidad sin acción
// posible. Cuando se publiquen los .json restantes, basta con ampliar
// este rango.
const N_TEMAS = 21;

// =============================================================
// detectarEpigrafesTocados(gestos) → Set<"t3:e3_2">
//
// Un epígrafe se considera "tocado" si EL USUARIO ha emitido cualquier
// gesto cuyo payload referencie ese par tema_id+epi_id. Aceptamos varias
// formas porque distintos gestos guardan la referencia distinto:
//   - payload.item_ref === "t3:e3_2"           (compromiso de Biblioteca)
//   - payload.tema_id + payload.epi_id         (gestos de Biblioteca futura)
//   - payload.fuentes[].id === "t3:e3_2" con origen=canonico (sintesis)
//
// Los gestos marcados como falsos no cuentan.

export function detectarEpigrafesTocados(gestos) {
  const set = new Set();
  if (!Array.isArray(gestos)) return set;
  for (const g of gestos) {
    if (!g || g.falso) continue;
    const p = g.payload || {};
    // (a) item_ref directo (compromiso/misión asociada a un epígrafe).
    if (typeof p.item_ref === "string" && p.item_ref.includes(":")) {
      set.add(p.item_ref);
    }
    // (b) tema_id + epi_id explícitos.
    if (p.tema_id && p.epi_id) {
      set.add(p.tema_id + ":" + p.epi_id);
    }
    // (c) fuentes canónicas dentro de una síntesis.
    if (Array.isArray(p.fuentes)) {
      for (const f of p.fuentes) {
        if (!f || f.origen !== "canonico") continue;
        if (typeof f.id === "string" && f.id.includes(":")) set.add(f.id);
      }
    }
  }
  return set;
}

// =============================================================
// detectarFuentesSintetizadas(gestos) → Set<fuente_id>
//
// Una fuente del seed se considera "sintetizada" si aparece en el log
// LOCAL un gesto tipo "sintesis" cuyo payload.fuentes[] contenga un
// item con id === fuente.id (independientemente del origen — el id es
// el identificador único de la fuente del seed).

export function detectarFuentesSintetizadas(gestos) {
  const set = new Set();
  if (!Array.isArray(gestos)) return set;
  for (const g of gestos) {
    if (!g || g.falso) continue;
    if (g.tipo !== "sintesis") continue;
    const fuentes = g.payload?.fuentes;
    if (!Array.isArray(fuentes)) continue;
    for (const f of fuentes) {
      if (f && typeof f.id === "string") set.add(f.id);
    }
  }
  return set;
}

// =============================================================
// Helpers internos.

// Strip HTML simple (no podemos importar el de data.js para no acoplarnos).
function _stripHtml(html, maxLen) {
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  let txt = (tmp.textContent || tmp.innerText || "").trim();
  if (maxLen && txt.length > maxLen) {
    txt = txt.slice(0, maxLen).trimEnd() + "…";
  }
  return txt;
}

function _escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Etiqueta legible para la corriente (fallback al raw).
const CORRIENTE_LABELS = {
  republicanismo:    "republicanismo",
  renta_basica:      "renta básica",
  marxismo:          "marxismo",
  democracia:        "democracia",
  ecologia_politica: "ecología política"
};
function _labelCorriente(c) {
  return CORRIENTE_LABELS[c] || (c || "crítica");
}

// =============================================================
// _cargarEpigrafesCrudos() → Promise<Array<{tema_id, epi_id, resumen}>>
//
// Re-implementamos la carga de los .json en lugar de importar cargarItems()
// de data.js: data.js descarta el HTML al normalizar (lo conserva en
// resumen_html sí, pero perdemos algo de control sobre cómo pintar la
// silla). Además queremos los `tema_id` raw para construir el id de Post
// "epi-vacio-t3-e3_2" de forma estable, sin depender de la forma interna
// de los `id` de data.js.
//
// Tolerante a fallos individuales: si un .json revienta, lo saltamos.

async function _cargarEpigrafesCrudos() {
  const ids = Array.from({ length: N_TEMAS }, (_, i) => i + 1);
  const promesas = ids.map(n =>
    fetch(`../data/biblioteca/resumen_t${n}.json`, { cache: "no-cache" })
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
  );
  const resultados = await Promise.all(promesas);
  const epis = [];
  for (const arr of resultados) {
    if (!Array.isArray(arr)) continue;
    for (const epi of arr) {
      if (!epi || !epi.tema_id || !epi.epi_id) continue;
      epis.push({
        tema_id: epi.tema_id,
        epi_id: epi.epi_id,
        resumen: epi.resumen || ""
      });
    }
  }
  return epis;
}

// =============================================================
// _epigrafeToSilla(epi) → Post silla_epigrafe.
//
// dims:
//   dominio = -1 (frontera: no lo dominas porque no lo has tocado)
//   canonico = -1 (es canónico oficial mnemoHACK)
//   compania = -1 (solitario)
//   navegacion = 0 (neutro — sin "último tema visto" no podemos sesgar)

function _epigrafeToSilla(epi) {
  const preview = _stripHtml(epi.resumen, 200);
  return {
    id: "epi-vacio-" + epi.tema_id + "-" + epi.epi_id,
    source: "canonico",
    source_label: "EPÍGRAFE PENDIENTE",
    kind: "silla_epigrafe",
    author: null,
    body: preview + (preview.length >= 200 ? "" : ""),
    ts: null,
    payload: {
      tema_id: epi.tema_id,
      epi_id: epi.epi_id,
      resumen_html: epi.resumen
    },
    dims: {
      dominio: -1,
      canonico: -1,
      compania: -1,
      navegacion: 0
    }
  };
}

// =============================================================
// _fuenteToSilla(fuente) → Post silla_fuente.
//
// dims:
//   dominio = -1 (frontera)
//   canonico = +1 (es voz crítica)
//   compania = -1 (solitario)
//   navegacion = +1 (explorar lateral — saltar fuera del temario)

function _fuenteToSilla(fuente) {
  const titulo = fuente.titulo || "(sin título)";
  const ano = fuente.ano ? " · " + fuente.ano : "";
  const body =
    titulo + ano +
    "\n\n" +
    (fuente.resena_breve || "");
  return {
    id: "fuente-vacia-" + fuente.id,
    source: "critico",
    source_label: "FUENTE SIN SÍNTESIS",
    kind: "silla_fuente",
    author: {
      handle: fuente.autor,
      display: fuente.autor
    },
    body,
    ts: null,
    payload: fuente,
    dims: {
      dominio: -1,
      canonico: +1,
      compania: -1,
      navegacion: +1
    }
  };
}

// =============================================================
// loadSillasConocimiento(config) → Promise<Post[]>
//
// Combina epígrafes no tocados + fuentes críticas sin sintetizar.
// Devuelve un array plano para que la integración con el feed sea
// trivial: el caller mete estos posts junto a los normales y deja que
// rank() los ordene por sliders.

export async function loadSillasConocimiento(config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...(config || {}) };
  if (!cfg.enabled) return [];

  const gestos = (() => {
    try { return getAllGestos(); }
    catch (e) {
      console.warn("[sillas-conocimiento] getAllGestos falló:", e?.message || e);
      return [];
    }
  })();

  const tocados = detectarEpigrafesTocados(gestos);
  const sintetizadas = detectarFuentesSintetizadas(gestos);

  // ── (a) Epígrafes no tocados ─────────────────────────
  let epigrafes = [];
  try {
    const todos = await _cargarEpigrafesCrudos();
    const libres = todos.filter(epi => {
      const key = epi.tema_id + ":" + epi.epi_id;
      return !tocados.has(key);
    });
    epigrafes = libres.slice(0, cfg.max_epigrafes).map(_epigrafeToSilla);
  } catch (e) {
    console.warn("[sillas-conocimiento] fallo cargando epígrafes:", e?.message || e);
  }

  // ── (b) Fuentes críticas sin síntesis ────────────────
  const fuentesLibres = FUENTES_CRITICAS_SEED
    .filter(f => !sintetizadas.has(f.id))
    .slice(0, cfg.max_fuentes)
    .map(_fuenteToSilla);

  return [...epigrafes, ...fuentesLibres];
}

// =============================================================
// renderSillaConocimientoCard(post, ctx) → HTMLElement
//
// Renderiza una card distinta según kind. La estructura DOM imita la del
// feed de Ágora (post-head / post-body / post-hud / post-actions) para
// que se pueda compartir CSS de hud / acciones. Los botones son
// text-only — misma decisión visual que en Ágora: el gesto es de
// compromiso, no reacción.
//
// ctx puede traer:
//   ctx.onEmpezar(post)        → al hacer click en "empezar →"
//                                (sólo en silla_epigrafe)
//   ctx.onSintetizarCon(post)  → al hacer click en "sintetizar con →"
//                                (sólo en silla_fuente)

export function renderSillaConocimientoCard(post, ctx) {
  const article = document.createElement("article");
  article.className = "post is-silla-conocimiento";
  article.dataset.kind = post.kind;
  article.dataset.source = post.source || "";
  article.dataset.postId = post.id;
  if (post.kind === "silla_epigrafe") article.classList.add("is-silla-epigrafe");
  if (post.kind === "silla_fuente")   article.classList.add("is-silla-fuente");

  // ── Head: id del epígrafe o autor, + label de source ─────────────
  const head = document.createElement("header");
  head.className = "post-head";

  const izq = document.createElement("span");
  izq.className = "post-meta-izq";
  if (post.kind === "silla_epigrafe") {
    const p = post.payload || {};
    izq.textContent = (p.tema_id || "") + " / " + (p.epi_id || "");
  } else {
    izq.textContent = post.author?.display || "—";
  }

  const src = document.createElement("span");
  src.className = "post-source is-silla-conocimiento-label";
  src.textContent = post.source_label || "PENDIENTE";

  head.append(izq, src);

  // ── Body ──────────────────────────────────────────────────────
  const body = document.createElement("div");
  body.className = "post-body is-silla-conocimiento-body";
  // Mostramos el body con saltos de línea respetados (los \n del shape).
  body.textContent = post.body || "";

  // Para silla_fuente: chip con la corriente, antes del body, sutil.
  if (post.kind === "silla_fuente") {
    const chip = document.createElement("div");
    chip.className = "silla-corriente-chip";
    chip.textContent = _labelCorriente(post.payload?.corriente);
    body.prepend(chip);
  }

  // ── HUD ───────────────────────────────────────────────────────
  // Contenedor vacío para que la app monte su HUD estándar de dims.
  const hud = document.createElement("div");
  hud.className = "post-hud";

  // ── Acciones text-only ────────────────────────────────────────
  const footer = document.createElement("footer");
  footer.className = "post-actions is-silla-conocimiento-actions";

  if (post.kind === "silla_epigrafe") {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "act act-silla-empezar";
    btn.dataset.act = "empezar";
    btn.textContent = "empezar →";
    btn.title = "Abrir este epígrafe y registrarlo como guardado";
    btn.addEventListener("click", () => {
      if (ctx && typeof ctx.onEmpezar === "function") ctx.onEmpezar(post);
      else console.warn("[sillas-conocimiento] onEmpezar no inyectado");
    });
    footer.append(btn);
  } else if (post.kind === "silla_fuente") {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "act act-silla-sintetizar";
    btn.dataset.act = "sintetizar_con";
    btn.textContent = "sintetizar con →";
    btn.title = "Abrir el editor de síntesis con esta fuente pre-cargada";
    btn.addEventListener("click", () => {
      if (ctx && typeof ctx.onSintetizarCon === "function") ctx.onSintetizarCon(post);
      else console.warn("[sillas-conocimiento] onSintetizarCon no inyectado");
    });
    footer.append(btn);
  }

  article.append(head, body, hud, footer);
  return article;
}

// =============================================================
// MINI-TEST DOCUMENTAL (no se ejecuta).
//
// Caso 1 — Gesto sintético sobre tema_id "t3":
//   Supongamos que el log contiene un gesto:
//     { tipo: "compromiso",
//       payload: { item_ref: "t3:e3_1", fuente_app: "biblioteca" },
//       userId: "u_x", ts: "2026-05-28T10:00:00Z" }
//
//   detectarEpigrafesTocados(...) devuelve Set { "t3:e3_1" }.
//   En loadSillasConocimiento(), todos los epígrafes de t3 distintos de
//   e3_1 SÍ aparecen (t3:e3_2, t3:e3_3, ...) — el "tocado" es por par
//   exacto, no por tema completo. Si la política deseada fuera "tocar
//   un epígrafe del tema marca el tema entero como visitado", habría
//   que expandir el Set aquí. Decisión actual: NO se expande — granularidad
//   de epígrafe. Razón: la idea de "pupitre vacío" es por unidad de
//   estudio, no por carpeta.
//
// Caso 2 — Fuente "pettit-republicanismo" sin síntesis previa:
//   El log no contiene ningún gesto tipo "sintesis" con
//   payload.fuentes[].id === "pettit-republicanismo".
//   detectarFuentesSintetizadas(...) devuelve Set vacío.
//   loadSillasConocimiento(...) emite el Post:
//     {
//       id: "fuente-vacia-pettit-republicanismo",
//       source: "critico", source_label: "FUENTE SIN SÍNTESIS",
//       kind: "silla_fuente",
//       author: { handle: "Philip Pettit", display: "Philip Pettit" },
//       body: "Republicanismo. Una teoría sobre la libertad y el gobierno · 1997\n\nDefine la libertad como no-dominación...",
//       ts: null,
//       payload: <objeto completo de FUENTES_CRITICAS_SEED[0]>,
//       dims: { dominio: -1, canonico: +1, compania: -1, navegacion: +1 }
//     }
//
// Caso 3 — Fuente ya sintetizada:
//   Si el log incluye:
//     { tipo: "sintesis",
//       payload: { titulo: "...", texto: "...",
//                  fuentes: [
//                    { id: "t1:e1_1", origen: "canonico" },
//                    { id: "pettit-republicanismo", origen: "critico" }
//                  ],
//                  fuente_app: "biblioteca" },
//       userId: "u_x", ts: "2026-05-28T12:00:00Z" }
//
//   detectarFuentesSintetizadas(...) devuelve Set { "t1:e1_1", "pettit-republicanismo" }.
//   La fuente "pettit-republicanismo" NO genera silla_fuente.
//   Además, detectarEpigrafesTocados(...) marca "t1:e1_1" como tocado
//   (por la rama (c) que mira fuentes.canonico), así que el epígrafe
//   e1_1 de t1 tampoco genera silla_epigrafe.
//
// Caso 4 — Temas 22-26:
//   No existen los .json. _cargarEpigrafesCrudos() los pide igual (porque
//   N_TEMAS = 21 y el rango es 1..21), pero como ni se intenta cargar
//   t22..t26, no hay 404 silenciados ni warnings. Si en el futuro se
//   publican los .json, basta con subir N_TEMAS — el resto del módulo
//   no necesita cambios.
