// shared/sendas.js — Taxonomía canónica "Sendas de aprendizaje cívico".
//
// Fuente de verdad ÚNICA cross-lens de la Biblioteca: vídeos, píldoras,
// hilos y fuentes críticas se etiquetan con la misma Senda. Pensada para
// que AGORA pueda reutilizar el mismo mapa (un teórico es a la vez fuente
// aquí y cuenta en el mausoleo) — por eso vive en shared/, no en una app.
//
// 5 grandes familias (decisión 2026-06-02 con Panch). Cada una ABSORBE
// las antiguas asignatura_id (1..8) y las corrientes de descubre.js /
// FUENTES_CRITICAS_SEED como sub-nivel (sub-etiquetas), sin perderlas.
//
// Encuadre: cada Senda es una SENSIBILIDAD cívica que se cultiva —
// nombrada por lo que despierta en quien aprende, no por la escuela
// teórica. Glifos geométricos coherentes con las lentes (◌ ≡ ¶ ▷ ▣);
// a futuro pueden heredar un icono vernáculo del OCRE iconset.
//
// Módulo ES puro, sin dependencias (como el resto de shared/).

export const SENDAS = [
  {
    id: "republica",
    label: "Libertad republicana",
    glifo: "⊜",
    subtags: ["no-dominación", "ciudadanía"],
    keywords: [
      "pettit", "skinner", "domènech", "domenech", "libertad",
      "no-dominación", "no-dominacion", "dominación", "dominacion",
      "república", "republica", "republicanismo", "neorrepublicanismo",
      "ciudadanía", "ciudadania", "arbitrario"
    ]
  },
  {
    id: "vida-cuidados",
    label: "Vida digna y cuidados",
    glifo: "❦",
    subtags: ["renta básica", "precariado", "egalité", "feminismo"],
    keywords: [
      "renta básica", "renta basica", "raventós", "raventos", "standing",
      "precariado", "precariedad", "van parijs", "ingreso", "egalité",
      "egalite", "igualdad", "federici", "luxemburg", "cuidados",
      "feminismo", "mujer", "curie"
    ]
  },
  {
    id: "poder-democracia",
    label: "Poder y democracia",
    glifo: "▲",
    subtags: ["decidir juntos", "crítica del poder", "acción común"],
    keywords: [
      "democracia", "mouffe", "rancière", "ranciere", "arendt",
      "populismo", "pluralismo", "agonismo", "marx", "capital",
      "plusvalía", "plusvalia", "clase", "harvey", "engels", "manifiesto",
      "žižek", "zizek", "ideología", "ideologia", "hegemonía", "hegemonia",
      "gramsci", "ostrom", "acción colectiva", "accion colectiva", "comunes"
    ]
  },
  {
    id: "ecologia",
    label: "Ecología política",
    glifo: "◍",
    subtags: ["límites", "decrecimiento", "isla finita", "comunes naturales"],
    keywords: [
      "ecología", "ecologia", "riechmann", "decrecimiento", "clima",
      "sostenib", "límites", "limites", "bioeconomía", "bioeconomia",
      "georgescu", "energía", "energia", "ecologismo"
    ]
  },
  {
    id: "memoria-isla",
    label: "Memoria e isla",
    glifo: "◐",
    subtags: ["identidad canaria", "archipiélago-mundo", "decolonialidad"],
    keywords: [
      "canaria", "canario", "canarias", "cubillo", "galdós", "galdos",
      "torón", "toron", "isla", "insular", "archipiélago", "archipielago",
      "decolonial", "decolonialidad", "fanon", "colonial", "memoria"
    ]
  }
];

// Mapa asignatura_id (8 asignaturas base) → senda_id. Usado para migrar
// píldoras/hilos existentes sin reescribir sus seeds a mano.
export const ASIGNATURA_A_SENDA = {
  "1-republica-libertad": "republica",
  "2-renta-basica":       "vida-cuidados",
  "5-egalite":            "vida-cuidados",
  "3-democracia":         "poder-democracia",
  "6-marxismo":           "poder-democracia",
  "4-memoria-canaria":    "memoria-isla",
  "7-decolonialidad":     "memoria-isla",
  "8-ecologia-comunes":   "ecologia"
};

// Mapa corriente → senda_id. Cubre las corrientes de descubre.js
// (PALETA_CULTIVO) y el campo `corriente` de FUENTES_CRITICAS_SEED.
export const CORRIENTE_A_SENDA = {
  republicanismo:    "republica",
  renta_basica:      "vida-cuidados",
  rentabasica:       "vida-cuidados",
  egalite:           "vida-cuidados",
  democracia:        "poder-democracia",
  marxismo:          "poder-democracia",
  teoriacritica:     "poder-democracia",
  teoria_critica:    "poder-democracia",
  ecologia:          "ecologia",
  ecologia_politica: "ecologia",
  memoria_canaria:   "memoria-isla",
  decolonialidad:    "memoria-isla"
};

const _BY_ID = Object.fromEntries(SENDAS.map(s => [s.id, s]));

export function getSenda(id) {
  return _BY_ID[id] || null;
}

// Deriva la Senda de un item heterogéneo (vídeo / píldora / hilo / fuente).
// Orden de prioridad:
//   1. item.senda explícito (seed que ya trae la etiqueta)
//   2. asignatura_id → senda
//   3. corriente → senda
//   4. scan de tags contra keywords de cada senda
//   5. null (sin clasificar — el caller decide el fallback de UI)
export function sendaDe(item) {
  if (!item) return null;
  if (item.senda && _BY_ID[item.senda]) return item.senda;
  if (item.asignatura_id && ASIGNATURA_A_SENDA[item.asignatura_id]) {
    return ASIGNATURA_A_SENDA[item.asignatura_id];
  }
  if (item.corriente && CORRIENTE_A_SENDA[item.corriente]) {
    return CORRIENTE_A_SENDA[item.corriente];
  }
  const tags = Array.isArray(item.tags) ? item.tags.join(" ").toLowerCase() : "";
  if (tags) {
    for (const s of SENDAS) {
      for (const kw of s.keywords) {
        if (tags.includes(kw)) return s.id;
      }
    }
  }
  return null;
}
