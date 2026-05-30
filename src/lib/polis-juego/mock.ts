// ─── POLIS · Juego: datos mock no-catastrales ────────────────────
// Tablero macro de barrios LPGC + misiones iniciales + jugador.
// Los EDIFICIOS reales se cargan del Catastro INSPIRE (ver
// cargador-edificios.ts) — aquí solo viven los datos de gamificación
// que no están en el catastro: nombres, resúmenes, posición en el
// tablero pixel art.

import type { Mision, Jugador } from "./tipos";

export type BarrioMacro = {
  id: string;
  nombre: string;
  eyebrow: string;
  tx: number;
  ty: number;
  tintHex: string;
  /** Tipo de capital dominante — para colorear la franja inferior. */
  tipoDominante:
    | "comun"
    | "residente"
    | "autonomo"
    | "rentista"
    | "corporativo";
  candidato: boolean;
  totalEdificios: number;
  resumen: string;
  /** ¿Es un barrio jugable en este prototipo (tiene catastro cargable)? */
  jugable: boolean;
};

export const BARRIOS_TABLERO: BarrioMacro[] = [
  {
    id: "isleta",
    nombre: "La Isleta",
    eyebrow: "PENÍNSULA · NORTE",
    tx: 2,
    ty: 0,
    tintHex: "#B4832E",
    tipoDominante: "residente",
    candidato: false,
    totalEdificios: 4_120,
    resumen: "Tejido obrero y portuario. Tradición asociativa fuerte.",
    jugable: false,
  },
  {
    id: "guanarteme",
    nombre: "Guanarteme",
    eyebrow: "FRENTE · CANTERAS",
    tx: 1,
    ty: 1,
    tintHex: "#A14B2A",
    tipoDominante: "rentista",
    candidato: true,
    totalEdificios: 3_580,
    resumen: "Costa cercana a Las Canteras. Presión vacacional.",
    jugable: false,
  },
  {
    id: "alcaravaneras",
    nombre: "Alcaravaneras",
    eyebrow: "CALETA · MAR",
    tx: 3,
    ty: 1,
    tintHex: "#C98A1A",
    tipoDominante: "residente",
    candidato: false,
    totalEdificios: 3_005,
    resumen: "Barrio marinero reconvertido. Mezcla residente + rentismo difuso.",
    jugable: false,
  },
  {
    id: "schamann",
    nombre: "Schamann",
    eyebrow: "INTERIOR · DENSO",
    tx: 0,
    ty: 2,
    tintHex: "#5B7A3E",
    tipoDominante: "residente",
    candidato: false,
    totalEdificios: 5_440,
    resumen: "Popular, autoconstruido en los 60-70. Tejido vecinal denso.",
    jugable: false,
  },
  {
    id: "arenales",
    nombre: "Arenales",
    eyebrow: "EJE · CENTRAL",
    tx: 2,
    ty: 2,
    tintHex: "#B4832E",
    tipoDominante: "residente",
    candidato: false,
    totalEdificios: 2_870,
    resumen: "Residencial histórico con comercio de barrio activo.",
    jugable: false,
  },
  {
    id: "san-cristobal",
    nombre: "San Cristóbal",
    eyebrow: "PUEBLO · MAR",
    tx: 4,
    ty: 2,
    tintHex: "#5B7A3E",
    tipoDominante: "comun",
    candidato: false,
    totalEdificios: 1_620,
    resumen: "Pueblo pesquero anexionado. Frente al mar, fuerte identidad común.",
    jugable: false,
  },
  {
    id: "tamaraceite",
    nombre: "Tamaraceite",
    eyebrow: "PERIFERIA · NW",
    tx: 1,
    ty: 3,
    tintHex: "#C98A1A",
    tipoDominante: "autonomo",
    candidato: false,
    totalEdificios: 4_300,
    resumen: "Periferia noroeste. Pequeños oficios y agricultura residual.",
    jugable: false,
  },
  {
    id: "triana",
    nombre: "Triana",
    eyebrow: "EJE · COMERCIAL",
    tx: 3,
    ty: 3,
    tintHex: "#A14B2A",
    tipoDominante: "autonomo",
    candidato: false,
    totalEdificios: 2_390,
    resumen: "Eje comercial histórico. Autónomos al frente, presión de cadenas.",
    jugable: false,
  },
  {
    id: "vegueta",
    nombre: "Vegueta",
    eyebrow: "CASCO · HISTÓRICO",
    tx: 2,
    ty: 4,
    tintHex: "#5B7A3E",
    tipoDominante: "comun",
    candidato: false,
    totalEdificios: 1_534,
    resumen: "Casco histórico. Catastro real cargado · listo para mapeo de campo.",
    jugable: true,
  },
  {
    id: "jinamar",
    nombre: "Jinámar",
    eyebrow: "VALLE · SUR",
    tx: 2,
    ty: 5,
    tintHex: "#6E2A1E",
    tipoDominante: "corporativo",
    candidato: true,
    totalEdificios: 6_820,
    resumen: "Valle sur. Grandes tenedores corporativos — candidato natural a recuperación.",
    jugable: false,
  },
];

// ─── Misiones del prototipo de campo ─────────────────────────────

export const MISIONES_INICIALES: Mision[] = [
  {
    id: "primer-mapeo",
    titulo: "Primer mapeo de campo",
    descripcion: "Activa el GPS y anota un edificio dentro del radio de 25 m.",
    ejePrincipal: "exploracion",
    recompensa: { exploracion: 30, calibrado: 0, recuperacion: 0 },
    progreso: 0,
    cuandoCompleta: "Has firmado tu primera observación cívica.",
  },
  {
    id: "calle-completa",
    titulo: "Una calle entera",
    descripcion: "Anota 5 edificios distintos en Vegueta.",
    ejePrincipal: "exploracion",
    recompensa: { exploracion: 60, calibrado: 30, recuperacion: 0 },
    progreso: 0,
    cuandoCompleta: "Has caminado un tramo entero. La calle te lee.",
  },
  {
    id: "ojo-tea",
    titulo: "Ojo de tea",
    descripcion: "Identifica madera tea como material en al menos 3 fachadas.",
    ejePrincipal: "calibrado",
    recompensa: { exploracion: 10, calibrado: 60, recuperacion: 0 },
    progreso: 0,
    cuandoCompleta: "Reconoces el balcón canario a primera vista.",
  },
  {
    id: "cazador-vacacional",
    titulo: "Cazador de vacacionales",
    descripcion: "Marca 2 edificios como vivienda vacacional o capital rentista.",
    ejePrincipal: "recuperacion",
    recompensa: { exploracion: 5, calibrado: 0, recuperacion: 80 },
    progreso: 0,
    cuandoCompleta: "Dos pisos opacos menos en el silencio.",
  },
  {
    id: "primera-corporativa",
    titulo: "Primera corporativa",
    descripcion: "Anota un edificio cuya capital declarada sea privado-corporativo.",
    ejePrincipal: "recuperacion",
    recompensa: { exploracion: 0, calibrado: 0, recuperacion: 100 },
    progreso: 0,
    cuandoCompleta: "Anotado en el registro. Strategós verá tu propuesta.",
  },
];

// ─── Jugador inicial (mock) ──────────────────────────────────────

export const JUGADOR_INICIAL: Jugador = {
  alias: "Vecino/a sin firmar",
  inicial: "P",
  pec: { exploracion: 0, calibrado: 0, recuperacion: 0 },
  anotaciones: [],
  edificiosExplorados: [],
};
