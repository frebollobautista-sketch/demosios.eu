// ─── POLIS · Juego: tipos compartidos ─────────────────────────────
// Modelo del prototipo /polis/juego. El juego es un MAPEO DE CAMPO:
// el ciudadano camina la calle (GPS obligatorio), la app le muestra
// los edificios cercanos en low poly 3D, y él los anota.
//
// Diseño:
//   · Tres ejes de juego entrelazados, alimentados por anotaciones:
//       EXPLORACIÓN  — descubrir edificios al estar cerca
//       CALIBRADO    — declarar uso, materiales, año, conservación
//       RECUPERACIÓN — declarar bloque como rentista o corporativo
//   · Los ejes mapean a κοινωνία / παιδεία / πολιτεία (cursus honorum).
//   · Cada anotación queda asociada a un edificio del CATASTRO REAL.
//     Otros vecinos pueden refrendar o discrepar — la propiedad
//     declarativa nunca es vinculante, es un acto cívico de mirar.

import type { TipoBloque } from "@/lib/territorio/barrios-juego";

// ── Geometría / catastro ─────────────────────────────────────────

/** Edificio cargado del Catastro INSPIRE. Polígono en lat/lng + altura. */
export type EdificioCatastro = {
  /** ID estable: hash de la sección + índice. */
  id: string;
  /** Polígono exterior en coordenadas WGS84 (lng, lat). */
  poligonoLngLat: Array<[number, number]>;
  /** Altura en metros. */
  alturaM: number;
  /** Centroide aproximado en lat/lng. */
  centroideLngLat: [number, number];
  /** Sección censal de origen (e.g. "3501601001"). */
  seccionId: string;
};

/** Edificio proyectado a metros locales — listo para R3F. */
export type EdificioProyectado = EdificioCatastro & {
  /** Polígono en metros, centrado en el origen del barrio (X, Z). */
  poligonoXZ: Array<[number, number]>;
  /** Centroide en metros (X, Z). */
  centroideXZ: [number, number];
};

// ── Mapeo / anotaciones ───────────────────────────────────────────

export type UsoDeclarado =
  | "vivienda-residente"
  | "vivienda-vacacional"
  | "comercio-local"
  | "comercio-cadena"
  | "oficina"
  | "industrial"
  | "dotacional"
  | "patrimonio"
  | "vacante";

/** Materiales pixel art canónicos de la paleta canaria base. */
export type MaterialId =
  | "piedra_volcanica_canaria"
  | "madera_tea"
  | "encalado_blanco"
  | "azulejo_hidraulico"
  | "tejado_teja_arabe";

/** Una anotación de campo sobre un edificio. */
export type Anotacion = {
  id: string;
  /** ID del edificio anotado (tabla EdificioCatastro). */
  edificioId: string;
  /** Timestamp de cuando se hizo. */
  ts: number;
  /** Coordenadas reales del usuario en el momento de anotar. */
  posUsuarioLngLat: [number, number];
  /** Distancia al edificio en el momento de anotar (metros). */
  distanciaM: number;

  uso: UsoDeclarado;
  capital: TipoBloque;
  /** Año aproximado de construcción. */
  anioAprox?: number;
  /** Materiales que se ven en la fachada. */
  materialesDetectados: MaterialId[];
  /** 0–100: estado de conservación. */
  conservacion: number;
  /** Nota libre. */
  nota?: string;
};

/** Estado de un edificio en el juego (deriva de las anotaciones del jugador). */
export type EstadoEdificio =
  | "no-anotado"
  | "explorado"      // descubierto al pasar cerca, sin ficha completa
  | "anotado"        // ficha de mapeo enviada
  | "marcado-recuperar";

// ── Ejes de juego y conversión a capital OCRE ─────────────────────

export type EjeJuego = "exploracion" | "calibrado" | "recuperacion";
export type PuntosJuego = Record<EjeJuego, number>;

export type ConversionACapitalOCRE = {
  koinonia: number;
  paideia: number;
  politeia: number;
};

export function convertirAOcre(pec: PuntosJuego): ConversionACapitalOCRE {
  return {
    koinonia: Math.round(pec.exploracion * 0.6),
    paideia: Math.round(pec.calibrado * 0.8),
    politeia: Math.round(pec.recuperacion * 1.0),
  };
}

export function totalPEC(pec: PuntosJuego): number {
  return pec.exploracion + pec.calibrado + pec.recuperacion;
}

// ── Misiones ─────────────────────────────────────────────────────

export type Mision = {
  id: string;
  titulo: string;
  descripcion: string;
  ejePrincipal: EjeJuego;
  recompensa: PuntosJuego;
  progreso: number; // 0..1
  cuandoCompleta?: string;
};

// ── Jugador ───────────────────────────────────────────────────────

export type Jugador = {
  alias: string;
  inicial: string;
  pec: PuntosJuego;
  /** Anotaciones registradas por este jugador. */
  anotaciones: Anotacion[];
  /** IDs de edificios que ha pasado cerca (sin anotar). */
  edificiosExplorados: string[];
};

// ── Estado de la sesión / posición GPS ────────────────────────────

export type EstadoGps =
  | "inicial"        // aún no se ha pedido permiso
  | "solicitando"
  | "denegado"
  | "indisponible"
  | "ok";

export type PosicionUsuario = {
  lat: number;
  lng: number;
  /** Precisión declarada por el navegador (m). */
  accuracyM: number;
  /** Si es una posición simulada (modo dev). */
  esTest: boolean;
  /** Cuando se obtuvo. */
  ts: number;
};

/** Modos en que vive la pantalla de juego. */
export type ModoJuego =
  | "espectador"     // sin GPS o fuera del barrio: tablero macro
  | "mapeo"          // con GPS dentro de un barrio mapeable: motor 3D
  | "test";          // dev: posición simulada
