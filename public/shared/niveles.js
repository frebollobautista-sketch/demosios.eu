// shared/niveles.js — Taxonomía canónica "Grados del cursus".
//
// SEGUNDO eje canónico de la Biblioteca, ORTOGONAL a las Sendas
// (shared/sendas.js). Mientras la Senda dice el QUÉ (república, ecología…),
// el Grado dice el CUÁN PROFUNDO: una escalera didáctica de lo más simple
// (la chispa que engancha) a la cumbre (la fuente teórica pura).
//
// Decisión 2026-06-02 con Panch — escalera "A · Teoría cumbre", 6 grados
// (el 6 cuadra hexagonalmente: cada Senda se dibuja como un hexágono de 6
// lados que se rellena al ascender; 5 Sendas + 1 hexágono central de
// "ciudadanía transversal" = el panal del cursus honorum).
//
// Matriz canónica: Senda × Grado = 5 × 6 = 30 celdas. Las celdas vacías
// (una Senda sin recursos en cierto grado) son toleradas, no rompen.
//
// Nota de nomenclatura: la "Síntesis G2" del editor actual corresponde
// conceptualmente al GRADO 4 de esta escala (producir tu propia postura).
// El nombre del botón no se toca aún para no romper nada.
//
// Módulo ES puro, sin dependencias (como el resto de shared/).

export const GRADOS = [
  { id: "g0", orden: 0, label: "Chispa",    glifo: "0", descripcion: "la cita que engancha" },
  { id: "g1", orden: 1, label: "Nociones",  glifo: "1", descripcion: "vocabulario en lenguaje llano" },
  { id: "g2", orden: 2, label: "Contexto",  glifo: "2", descripcion: "el caso canario concreto" },
  { id: "g3", orden: 3, label: "Argumento", glifo: "3", descripcion: "confrontar posturas" },
  { id: "g4", orden: 4, label: "Síntesis",  glifo: "4", descripcion: "produces tu propia postura" },
  { id: "g5", orden: 5, label: "Teoría",    glifo: "5", descripcion: "la fuente pura — cumbre" }
];

export const N_GRADOS = GRADOS.length;

// Grado por defecto según el TIPO de recurso (cuando el seed no trae un
// `nivel` explícito). Es una derivación de arranque: el formato insinúa la
// profundidad, pero un seed puede sobreescribir (p.ej. un vídeo-fuente de
// Pettit con `nivel:"g5"`, o una píldora de vocabulario con `nivel:"g1"`).
export const KIND_A_GRADO = {
  pildora:  "g0",  // chispa: cita corta que engancha
  epigrafe: "g1",  // nociones: resumen/vocabulario del temario
  hilo:     "g2",  // contexto: artículo editorial con caso canario
  video:    "g2"   // contexto: divulgación (las charlas-fuente pueden subir a g5)
};

const _BY_ID = Object.fromEntries(GRADOS.map(g => [g.id, g]));

export function getGrado(id) {
  return _BY_ID[id] || null;
}

// Devuelve el id de grado contiguo (orden +1) o null si ya es la cumbre.
export function gradoSiguiente(id) {
  const g = _BY_ID[id];
  if (!g) return null;
  const sig = GRADOS.find(x => x.orden === g.orden + 1);
  return sig ? sig.id : null;
}

// Deriva el Grado de un item heterogéneo (recurso / vídeo / píldora / hilo).
// Orden de prioridad:
//   1. item.nivel explícito (seed que ya trae la etiqueta de grado)
//   2. item.grado explícito (alias por si ya viene normalizado)
//   3. KIND_A_GRADO[item.kind] (derivación por tipo)
//   4. "g2" (Contexto) como fallback neutro
export function gradoDe(item) {
  if (!item) return "g2";
  if (item.nivel && _BY_ID[item.nivel]) return item.nivel;
  if (item.grado && _BY_ID[item.grado]) return item.grado;
  if (item.kind && KIND_A_GRADO[item.kind]) return KIND_A_GRADO[item.kind];
  return "g2";
}
