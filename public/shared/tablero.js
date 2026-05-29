// shared/tablero.js — Tablero de aficiones y preferencias.
//
// Modela el "algoritmo del usuario" como DOS tableros separados, cada uno
// con su propio set de dimensiones TEMÁTICAS (afinidad de gusto):
//
//   hobby  → entretenimiento (humor, deportes, cine, música…)
//   civico → sociopolítico (los 10 verbos de taxonomia.js)
//
// Filosofía (heredada de rank.js / stumble.js): el tablero solo guarda
// GUSTOS ESTABLES como sliders por tema. Lugar/tiempo/postura NO viven
// aquí — son propiedades por-ítem que la UI surfacea como chips en la
// tarjeta (pivot transitorio). Por eso este módulo NO declara sliders
// posturales: solo temas + un mando de Descubrimiento (serendipia) por
// familia + un alcance geográfico persistente en el tablero cívico.
//
// Se enchufa al motor existente SIN reescribirlo:
//   - clasificar(item) cuelga dims temáticas → rank() las suma nativo.
//   - dimsMetaDe(familia) alimenta explicar() ("Música ★★").
//   - aprenderDeFeedback() (stumble.js) empuja esos sliders al opinar.
//   - pivotBoost(pivots) produce el boost transitorio de los chips.
//   - interleave() mezcla las dos pasadas para el modo "feed único".
//
// Datos puros + estado en localStorage. Vanilla ES module, sin deps de
// UI. taxonomia.js se importa en SÓLO-LECTURA (otra sesión es su dueña).

import { TAXONOMIA } from "./taxonomia.js?v=20260529a";

// =============================================================
// FAMILIA HOBBY — paleta de entretenimiento.
//
// Fuente de verdad de los intereses de ocio. keywords → clasificación de
// ítems; subreddits → fuentes Reddit que el onboarding puede activar.
// (descubre.js debe importar esta lista en vez de duplicarla.)

export const HOBBY_TEMAS = [
  { id: "humor",       label: "Humor",          emoji: "😂", keywords: ["humor", "meme", "chiste", "gracioso", "cachondeo", "broma"], subreddits: ["spain", "es"] },
  { id: "deportes",    label: "Deportes",       emoji: "⚽", keywords: ["futbol", "fútbol", "baloncesto", "deporte", "liga", "partido", "tenis", "atletismo"], subreddits: ["futbol"] },
  { id: "cine",        label: "Cine y series",  emoji: "🎬", keywords: ["pelicula", "película", "serie", "cine", "netflix", "estreno", "film", "rodaje"], subreddits: ["cine"] },
  { id: "musica",      label: "Música",         emoji: "🎵", keywords: ["musica", "música", "disco", "concierto", "cancion", "canción", "banda", "album", "álbum"], subreddits: ["musica"] },
  { id: "ciencia",     label: "Ciencia y tec",  emoji: "🔬", keywords: ["ciencia", "tecnologia", "tecnología", "espacio", "investigacion", "investigación", "fisica", "biologia", "inteligencia"], subreddits: ["ciencia"] },
  { id: "gastronomia", label: "Gastronomía",    emoji: "🍳", keywords: ["receta", "cocina", "comida", "gastronomia", "gastronomía", "plato", "chef", "tapa"], subreddits: ["es"] },
  { id: "naturaleza",  label: "Naturaleza",     emoji: "🌄", keywords: ["senderismo", "montaña", "playa", "naturaleza", "ruta", "mar", "paisaje", "fauna"], subreddits: ["canarias"] },
  { id: "actualidad",  label: "Actualidad",     emoji: "📰", keywords: ["politica", "política", "noticia", "gobierno", "actualidad", "derechos", "elecciones"], subreddits: ["spain", "podemos"] },
  { id: "videojuegos", label: "Videojuegos",    emoji: "🎮", keywords: ["videojuego", "gaming", "consola", "steam", "juego", "gamer", "rpg"], subreddits: ["videojuegos"] },
  { id: "libros",      label: "Libros e ideas", emoji: "📚", keywords: ["libro", "novela", "ensayo", "filosofia", "filosofía", "leer", "autor", "lectura"], subreddits: ["libros"] }
];

// =============================================================
// FAMILIA CÍVICO — derivada de taxonomia.js (los 10 verbos).
//
// NO duplicamos la taxonomía: la proyectamos a temas de feed. De cada
// verbo tomamos id/label/glifo y construimos keywords a partir de su
// `sub`, las etiquetas de sus sectores y sus queries `web`.

// Mapa kind-de-feed → verbo cívico. Cuando un ítem ya viene tipado por
// su fuente (overlays, quórums…), el kind manda sobre el texto.
const KIND_A_VERBO = {
  evento:        "disfruto",
  cultura:       "disfruto",
  productor:     "como",
  parque:        "paseo",
  tejido:        "convivo",
  silla_vacia:   "convivo",
  "agora-civic": "participo",
  quorum:        "participo"
};

const _palabras = (s) => String(s || "")
  .split(/[·,/]|\s+/)
  .map(t => t.trim().toLowerCase())
  .filter(t => t.length > 2 && !["por", "del", "los", "las", "una", "con", "sin"].includes(t));

function derivarCivico() {
  return TAXONOMIA.map(v => {
    const kws = new Set(_palabras(v.sub));
    for (const sec of (v.sectores || [])) {
      for (const w of _palabras(sec.label)) kws.add(w);
      for (const q of (sec.web || [])) for (const w of _palabras(q)) kws.add(w);
    }
    // El propio verbo (sin el "Me ") también es señal.
    for (const w of _palabras(v.verbo)) kws.add(w);
    const kinds = Object.keys(KIND_A_VERBO).filter(k => KIND_A_VERBO[k] === v.id);
    return { id: v.id, label: v.verbo, emoji: v.glifo, keywords: [...kws], kinds };
  });
}

export const CIVICO_TEMAS = derivarCivico();

// =============================================================
// Metadata de familias.

export const FAMILIAS = {
  hobby:  { id: "hobby",  label: "Aficiones", emoji: "✦", temas: HOBBY_TEMAS,
            descubrimientoDefault: 0.75, desc: "entretenimiento y descubrimiento amplio" },
  civico: { id: "civico", label: "Cívico",    emoji: "🏛", temas: CIVICO_TEMAS,
            descubrimientoDefault: 0.5,  desc: "tu barrio, participación real" }
};

export function temasDe(familia) {
  return (FAMILIAS[familia] || FAMILIAS.hobby).temas;
}

// dimsMeta para explicar(): cada tema es una dim cuasi-unipolar. El polo
// positivo es el propio tema ("música"); el negativo es "menos música"
// (cuando el usuario baja el slider o pulga en contra).
export function dimsMetaDe(familia) {
  const meta = {};
  for (const t of temasDe(familia)) {
    const lc = t.label.toLowerCase();
    meta[t.id] = { label: t.label, polos: ["menos " + lc, lc] };
  }
  return meta;
}

// Sliders por defecto: todos los temas a 0 (neutro). El onboarding y los
// pulgares los mueven; rank() ignora dims que el ítem no puntúa.
export function defaultSlidersDe(familia) {
  const s = {};
  for (const t of temasDe(familia)) s[t.id] = 0;
  return s;
}

// =============================================================
// CLASIFICADOR — item → dims temáticas (de AMBAS familias).
//
// Cuelga en cada ítem las dims de los temas que casan, para que rank()
// las sume cuando se rankee bajo el tablero de esa familia. Un ítem puede
// puntuar en hobby y en cívico a la vez; rank() solo usa las dims cuyos
// sliders existen en el tablero activo.

const _deburr = (s) => String(s || "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function _textoDe(item) {
  if (!item) return "";
  const partes = [
    item.body,
    item.source_label,
    item.payload && item.payload.titulo,
    item.payload && item.payload.subreddit,
    item.author && item.author.handle
  ];
  return _deburr(partes.filter(Boolean).join(" "));
}

function _subredditDe(item) {
  if (!item) return null;
  if (item.payload && item.payload.subreddit) return String(item.payload.subreddit).toLowerCase();
  // source_label tipo "REDDIT r/futbol".
  const m = /r\/([a-z0-9_]+)/i.exec(item.source_label || "");
  return m ? m[1].toLowerCase() : null;
}

export function clasificar(item) {
  const dims = {};
  const txt = _textoDe(item);
  const sub = _subredditDe(item);
  const kind = item && item.kind;

  // Coincidencia por PALABRA completa (no substring) para evitar falsos
  // positivos tipo "ia" dentro de "Canaria". Las frases (con espacio) sí
  // se buscan como substring.
  const palabras = new Set(txt.split(/[^a-z0-9]+/).filter(Boolean));
  const casa = (k) => {
    const kk = _deburr(k);
    return kk.includes(" ") ? txt.includes(kk) : palabras.has(kk);
  };

  // Hobby: keyword (fuerte) o subreddit (medio).
  for (const t of HOBBY_TEMAS) {
    if (t.keywords.some(casa)) { dims[t.id] = 1; continue; }
    if (sub && (t.subreddits || []).includes(sub)) dims[t.id] = 0.5;
  }

  // Cívico: kind (fuerte) o keyword (medio). Cuidado con colisiones de id
  // entre familias — no hay (verbos vs intereses son disjuntos).
  for (const t of CIVICO_TEMAS) {
    if (kind && (t.kinds || []).includes(kind)) { dims[t.id] = 1; continue; }
    if (t.keywords.some(k => _deburr(k).length > 3 && casa(k))) dims[t.id] = 0.8;
  }

  return dims;
}

// =============================================================
// PIVOT BOOST — chips de contexto de la tarjeta (patrón 1).
//
// Lugar/tiempo/postura son propiedades del ítem. Al tocar su chip, la UI
// fija un pivot TRANSITORIO (lente de sesión, no aprendizaje persistido).
// pivotBoost(pivots) devuelve un multiplicador por ítem para pickStumble
// y un bonus aditivo para el orden lineal.
//
// pivots: { lugar?: "zona", tiempo?: "reciente", postura?: "convocar" }

const CTA_REGEX = /\b(asamblea|convocamos|convocatoria|manifestaci|reunion|reunión|necesitamos|sumate|súmate|apuntate|apúntate|firma|ven\b)/i;
const RECIENTE_MS = 7 * 24 * 3600 * 1000;

export function esConvocatoria(item) {
  if (!item) return false;
  if (item.kind === "evento" || item.kind === "agora-civic" || item.kind === "quorum") return true;
  return CTA_REGEX.test(item.body || "");
}

function _coincidePivot(item, pivots) {
  if (!item || !pivots) return 0;
  let hits = 0;
  if (pivots.lugar) {
    const z = item.geo && (item.geo.zona || item.geo.municipio);
    if (z && _deburr(z) === _deburr(pivots.lugar)) hits++;
  }
  if (pivots.tiempo === "reciente" && item.ts) {
    const t = Date.parse(item.ts);
    if (Number.isFinite(t) && (Date.now() - t) < RECIENTE_MS) hits++;
  }
  if (pivots.postura === "convocar" && esConvocatoria(item)) hits++;
  return hits;
}

// Multiplicador para pickStumble (boost). 1 = sin efecto.
export function pivotBoost(pivots) {
  if (!pivots || Object.keys(pivots).length === 0) return null;
  return (res) => {
    const hits = _coincidePivot(res && res.item, pivots);
    return hits > 0 ? 1 + hits * 1.5 : 1;
  };
}

// Bonus aditivo para re-ordenar el feed lineal (no toca misiones=Infinity).
export function aplicarPivots(ranked, pivots) {
  if (!Array.isArray(ranked) || !pivots || Object.keys(pivots).length === 0) return ranked;
  return ranked
    .map(r => ({ r, bonus: r.score === Infinity ? 0 : _coincidePivot(r.item, pivots) * 1.0 }))
    .sort((a, b) => {
      if (a.r.score === Infinity || b.r.score === Infinity) return 0; // estables arriba
      return (b.r.score + b.bonus) - (a.r.score + a.bonus);
    })
    .map(x => x.r);
}

// =============================================================
// INTERLEAVE — modo "feed único" (las dos pasadas en una línea).
//
// Mezcla rankedHobby y rankedCivico respetando un ratio (cuánto cívico) y
// una CUOTA dura: al menos `cuota` cívicos por cada `ventana` ítems, para
// que lo sociopolítico no se diluya pase lo que pase con los pesos.

export function esItemCivico(item) {
  return !!(item && (KIND_A_VERBO[item.kind] || item.source === "civic"));
}

export function interleave(rankedHobby, rankedCivico, opts = {}) {
  const ratio = Math.max(0.15, Math.min(0.85, typeof opts.ratio === "number" ? opts.ratio : 0.4));
  const ventana = opts.ventana || 6;
  const cuota = opts.cuota || 1;

  const h = (rankedHobby || []).slice();
  const c = (rankedCivico || []).slice();
  const usados = new Set();
  const idDe = (r) => (r && r.item && r.item.id != null) ? String(r.item.id) : null;
  const out = [];

  const tomar = (arr) => {
    while (arr.length) {
      const r = arr.shift();
      const id = idDe(r);
      if (id !== null && usados.has(id)) continue;
      if (id !== null) usados.add(id);
      return r;
    }
    return null;
  };

  let civicosEnVentana = 0;
  while (h.length || c.length) {
    const pos = out.length % ventana;
    if (pos === 0) civicosEnVentana = 0;        // nueva ventana
    const slotsRestantes = ventana - pos;
    // Si lo que falta de cuota no cabe ya en los slots restantes, fuerza cívico.
    const faltaCuota = c.length > 0 && (cuota - civicosEnVentana) >= slotsRestantes;
    const tocaCivico = faltaCuota || h.length === 0 || (c.length > 0 && Math.random() < ratio);
    const r = tocaCivico ? (tomar(c) || tomar(h)) : (tomar(h) || tomar(c));
    if (!r) break;
    out.push(r);
    if (esItemCivico(r.item)) civicosEnVentana++;
  }
  return out;
}

// =============================================================
// ESTADO + PERSISTENCIA.

const KEY = "agora-tablero";
const KEY_DESCUBRE_VIEJO = "agora-descubre-config";   // migración

function estadoVacio() {
  return {
    familiaActiva: "hobby",
    modo: "toggle",                 // "toggle" | "unico"
    ratio: 0.4,                     // share cívico en modo único
    hobby:  { sliders: defaultSlidersDe("hobby"),  descubrimiento: FAMILIAS.hobby.descubrimientoDefault },
    civico: { sliders: defaultSlidersDe("civico"), descubrimiento: FAMILIAS.civico.descubrimientoDefault, alcance: "todo" }
  };
}

function sanear(parsed) {
  const base = estadoVacio();
  if (!parsed || typeof parsed !== "object") return base;
  if (parsed.familiaActiva === "civico" || parsed.familiaActiva === "hobby") base.familiaActiva = parsed.familiaActiva;
  if (parsed.modo === "unico" || parsed.modo === "toggle") base.modo = parsed.modo;
  if (typeof parsed.ratio === "number") base.ratio = Math.max(0.15, Math.min(0.85, parsed.ratio));
  for (const fam of ["hobby", "civico"]) {
    const src = parsed[fam] || {};
    const def = defaultSlidersDe(fam);
    if (src.sliders && typeof src.sliders === "object") {
      for (const k of Object.keys(def)) {
        const v = src.sliders[k];
        if (typeof v === "number" && Number.isFinite(v)) def[k] = Math.max(-1, Math.min(1, v));
      }
    }
    base[fam].sliders = def;
    if (typeof src.descubrimiento === "number") base[fam].descubrimiento = Math.max(0, Math.min(1, src.descubrimiento));
  }
  if (["todo", "isla", "municipio", "barrio"].includes(parsed.civico && parsed.civico.alcance)) {
    base.civico.alcance = parsed.civico.alcance;
  }
  return base;
}

// Migración desde el viejo onboarding de Descubre: { preset, intereses:[] }
// → siembra los sliders de la familia correspondiente a +0.6.
function migrarDesdeDescubre(estado) {
  try {
    const raw = localStorage.getItem(KEY_DESCUBRE_VIEJO);
    if (!raw) return estado;
    const c = JSON.parse(raw);
    const intereses = Array.isArray(c) ? c : (c && c.intereses) || [];
    const fam = (c && c.preset === "civico") ? "civico" : "hobby";
    for (const id of intereses) {
      if (id in estado[fam].sliders) estado[fam].sliders[id] = 0.6;
    }
    if (c && (c.preset === "civico" || c.preset === "intereses")) {
      estado.familiaActiva = c.preset === "civico" ? "civico" : "hobby";
    }
  } catch (e) { /* no-op */ }
  return estado;
}

let _cache = null;

export function loadTablero() {
  if (_cache) return _cache;
  let estado;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      estado = sanear(JSON.parse(raw));
    } else {
      estado = migrarDesdeDescubre(estadoVacio());
      saveTablero(estado);
    }
  } catch (e) {
    estado = estadoVacio();
  }
  _cache = estado;
  return estado;
}

export function saveTablero(estado) {
  _cache = estado;
  try { localStorage.setItem(KEY, JSON.stringify(estado)); } catch (e) { /* no-op */ }
}

// Atajos para la familia activa.
export function familiaActiva() { return loadTablero().familiaActiva; }
export function slidersActivos() {
  const t = loadTablero();
  return t[t.familiaActiva].sliders;
}
export function subredditsSembrados() {
  // Subreddits de los temas hobby con slider > 0 (para ampliar fuentes).
  const t = loadTablero();
  const out = new Set();
  for (const tema of HOBBY_TEMAS) {
    if ((t.hobby.sliders[tema.id] || 0) > 0) for (const s of (tema.subreddits || [])) out.add(s);
  }
  return [...out];
}
