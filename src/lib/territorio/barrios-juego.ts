// ─── Datos de juego por barrio ──────────────────────────────────
// Por ahora solo Las Palmas de Gran Canaria (10 barrios), con datos
// mock de composición de capital. Cuando conectemos catastro/OSM y las
// contribuciones reales de ciudadanos, estos valores se calcularán a
// partir de la propiedad real de los bloques del barrio.
//
// `composicionCapital` suma 100 % entre los 5 tipos definidos en la
// página /polis: comun, residente, autonomo, rentista, corporativo.
// El `tipoDominante` es el que más peso tiene, y se usa para colorear
// el hexágono del barrio en el mapa.
//
// `posicion` son coordenadas en el viewBox del SVG del mapa (500 x 560).
// Están pensadas para formar una cuadrícula hexagonal estilizada que
// evoca la geografía del municipio sin pretender precisión catastral.

export type TipoBloque =
  | "comun"
  | "residente"
  | "autonomo"
  | "rentista"
  | "corporativo";

export type ComposicionCapital = Record<TipoBloque, number>;

/**
 * Geometría vectorial de un barrio. Dos modos mutuamente excluyentes:
 *   · `hex`     — posición del centroide para pintarlo como hexágono.
 *   · `vector`  — path SVG con el contorno real del barrio (ya
 *                 proyectado a coordenadas del viewBox del mapa).
 *
 * `hex` es el MVP provisional, `vector` es la dirección final (el
 * contorno real hace que el ciudadano se reconozca en SU barrio, no
 * en un símbolo).
 */
export type GeometriaBarrio =
  | {
      modo: "hex";
      cx: number;
      cy: number;
    }
  | {
      modo: "vector";
      /** Atributo `d` de un `<path>` SVG, en coordenadas del viewBox 500×560. */
      d: string;
      /** Centroide aproximado (cx, cy) — para colocar la etiqueta del nombre. */
      cx: number;
      cy: number;
    };

export type BarrioJuego = {
  id: string;
  /** Geometría: hexágono estilizado o polígono real. */
  geometria: GeometriaBarrio;
  /** 0-100 % por tipo, suman 100. */
  composicionCapital: ComposicionCapital;
  /** Nota editorial opcional para mostrar en la ventana emergente. */
  nota?: string;
};

/**
 * Diccionario de barrios mock por municipio. Las claves coinciden con
 * `Municipio.id` definido en `src/lib/territorio/canarias.ts`. Cuando el
 * mapa Supabase-driven (#16) esté vivo, esta tabla se reemplaza por una
 * lectura RPC contra `secciones` agrupadas por barrio.
 */

const BARRIOS_LPGC: BarrioJuego[] = [
  {
    id: "isleta",
    geometria: { modo: "hex", cx: 250, cy: 70 },
    composicionCapital: { comun: 15, residente: 55, autonomo: 20, rentista: 8, corporativo: 2 },
    nota: "Península del norte, tejido obrero y portuario. Tradición asociativa fuerte.",
  },
  {
    id: "guanarteme",
    geometria: { modo: "hex", cx: 160, cy: 155 },
    composicionCapital: { comun: 8, residente: 35, autonomo: 17, rentista: 30, corporativo: 10 },
    nota: "Costa cercana a Las Canteras. Presión turística y alquiler vacacional.",
  },
  {
    id: "alcaravaneras",
    geometria: { modo: "hex", cx: 340, cy: 155 },
    composicionCapital: { comun: 6, residente: 45, autonomo: 18, rentista: 22, corporativo: 9 },
    nota: "Barrio marinero reconvertido. Mezcla residente + rentismo difuso.",
  },
  {
    id: "schamann",
    geometria: { modo: "hex", cx: 90, cy: 240 },
    composicionCapital: { comun: 12, residente: 65, autonomo: 18, rentista: 4, corporativo: 1 },
    nota: "Popular, autoconstruido en los 60-70. Tejido vecinal denso.",
  },
  {
    id: "arenales",
    geometria: { modo: "hex", cx: 250, cy: 240 },
    composicionCapital: { comun: 7, residente: 52, autonomo: 22, rentista: 13, corporativo: 6 },
    nota: "Residencial histórico con comercio de barrio activo.",
  },
  {
    id: "san-cristobal",
    geometria: { modo: "hex", cx: 410, cy: 240 },
    composicionCapital: { comun: 25, residente: 58, autonomo: 12, rentista: 4, corporativo: 1 },
    nota: "Pueblo pesquero anexionado. Frente al mar, fuerte identidad común.",
  },
  {
    id: "tamaraceite",
    geometria: { modo: "hex", cx: 160, cy: 325 },
    composicionCapital: { comun: 14, residente: 52, autonomo: 25, rentista: 6, corporativo: 3 },
    nota: "Periferia noroeste, economía mixta. Pequeños oficios y agricultura residual.",
  },
  {
    id: "triana",
    geometria: { modo: "hex", cx: 340, cy: 325 },
    composicionCapital: { comun: 12, residente: 30, autonomo: 33, rentista: 18, corporativo: 7 },
    nota: "Eje comercial histórico. Autónomos al frente, presión de cadenas.",
  },
  {
    id: "vegueta",
    geometria: { modo: "hex", cx: 250, cy: 410 },
    composicionCapital: { comun: 30, residente: 28, autonomo: 22, rentista: 15, corporativo: 5 },
    nota: "Casco histórico. Espacios comunes (Catedral, museos, Casa de Colón) al frente; presión turística creciente.",
  },
  {
    id: "jinamar",
    geometria: { modo: "hex", cx: 250, cy: 495 },
    composicionCapital: { comun: 5, residente: 40, autonomo: 10, rentista: 10, corporativo: 35 },
    nota: "Valle sur. Presencia significativa de grandes tenedores corporativos — candidato natural a recuperación.",
  },
];

/** Santa Cruz de Tenerife — 5 distritos amplios. */
const BARRIOS_SCT: BarrioJuego[] = [
  {
    id: "anaga",
    geometria: { modo: "hex", cx: 380, cy: 130 },
    composicionCapital: { comun: 38, residente: 45, autonomo: 12, rentista: 4, corporativo: 1 },
    nota: "Macizo de Anaga. Parque rural protegido — la presencia del común es alta porque el suelo no se urbaniza.",
  },
  {
    id: "centro-ifara",
    geometria: { modo: "hex", cx: 250, cy: 220 },
    composicionCapital: { comun: 10, residente: 38, autonomo: 28, rentista: 18, corporativo: 6 },
    nota: "Centro histórico + Ifara. Comercio de barrio y tejido urbano consolidado, con presión rentista creciente.",
  },
  {
    id: "salud",
    geometria: { modo: "hex", cx: 130, cy: 290 },
    composicionCapital: { comun: 9, residente: 70, autonomo: 14, rentista: 5, corporativo: 2 },
    nota: "La Salud. Barrio popular con alta proporción residente y vida vecinal densa.",
  },
  {
    id: "ofra",
    geometria: { modo: "hex", cx: 250, cy: 360 },
    composicionCapital: { comun: 7, residente: 48, autonomo: 18, rentista: 19, corporativo: 8 },
    nota: "Ofra–Costa Sur. Mezcla residente con presión rentista por proximidad al mar.",
  },
  {
    id: "suroeste",
    geometria: { modo: "hex", cx: 130, cy: 430 },
    composicionCapital: { comun: 6, residente: 42, autonomo: 14, rentista: 16, corporativo: 22 },
    nota: "Suroeste. Capital corporativo creciendo — fondos desplazándose desde el norte vacacional.",
  },
];

/** San Cristóbal de La Laguna — patrimonio UNESCO + barrios populares. */
const BARRIOS_LAGUNA: BarrioJuego[] = [
  {
    id: "centro-laguna",
    geometria: { modo: "hex", cx: 250, cy: 200 },
    composicionCapital: { comun: 32, residente: 30, autonomo: 24, rentista: 11, corporativo: 3 },
    nota: "Centro histórico (UNESCO). La Universidad de La Laguna y el patrimonio público elevan el común; los autónomos se concentran en hostelería y oficios.",
  },
  {
    id: "taco",
    geometria: { modo: "hex", cx: 140, cy: 320 },
    composicionCapital: { comun: 11, residente: 68, autonomo: 16, rentista: 4, corporativo: 1 },
    nota: "Taco. Periferia residencial popular, tejido cooperativo emergente.",
  },
  {
    id: "tejina",
    geometria: { modo: "hex", cx: 360, cy: 320 },
    composicionCapital: { comun: 22, residente: 56, autonomo: 16, rentista: 5, corporativo: 1 },
    nota: "Tejina. Costa norte de Tegueste. Identidad rural-marinera viva, agricultura residual.",
  },
];

/** Arrecife — capital de Lanzarote, ciudad pequeña con presión vacacional. */
const BARRIOS_ARRECIFE: BarrioJuego[] = [
  {
    id: "altavista",
    geometria: { modo: "hex", cx: 180, cy: 200 },
    composicionCapital: { comun: 8, residente: 64, autonomo: 18, rentista: 8, corporativo: 2 },
    nota: "Altavista. Barrio residente con comercio de proximidad.",
  },
  {
    id: "valterra",
    geometria: { modo: "hex", cx: 320, cy: 280 },
    composicionCapital: { comun: 18, residente: 58, autonomo: 18, rentista: 5, corporativo: 1 },
    nota: "Valterra. Asociacionismo vecinal histórico, fuerte presencia del común gestionado.",
  },
  {
    id: "titerroy",
    geometria: { modo: "hex", cx: 180, cy: 380 },
    composicionCapital: { comun: 5, residente: 38, autonomo: 14, rentista: 28, corporativo: 15 },
    nota: "Titerroy. Próximo a puerto y aeropuerto: presión vacacional alta, capital rentista creciente.",
  },
];

/** Puerto del Rosario — capital de Fuerteventura. */
const BARRIOS_PDR: BarrioJuego[] = [
  {
    id: "el-charco",
    geometria: { modo: "hex", cx: 210, cy: 240 },
    composicionCapital: { comun: 12, residente: 60, autonomo: 18, rentista: 8, corporativo: 2 },
    nota: "El Charco. Casco histórico de pescadores. Identidad residente fuerte.",
  },
  {
    id: "risco-prieto",
    geometria: { modo: "hex", cx: 290, cy: 340 },
    composicionCapital: { comun: 4, residente: 38, autonomo: 12, rentista: 18, corporativo: 28 },
    nota: "Risco Prieto. Urbanizaciones recientes con alta proporción de capital corporativo y rentista — candidato.",
  },
];

/**
 * Diccionario público: dado un `Municipio.id` devuelve sus barrios de juego.
 * Los municipios sin entrada en el diccionario muestran un estado vacío
 * en el tablero ("este municipio aún no tiene barrios mapeados").
 */
export const BARRIOS_POR_MUNICIPIO: Record<string, BarrioJuego[]> = {
  "las-palmas-de-gran-canaria": BARRIOS_LPGC,
  "santa-cruz-de-tenerife": BARRIOS_SCT,
  "la-laguna": BARRIOS_LAGUNA,
  "arrecife": BARRIOS_ARRECIFE,
  "puerto-del-rosario": BARRIOS_PDR,
};

/** Compatibilidad: alias antiguo `BARRIOS_LPGC` para no romper imports existentes. */
export { BARRIOS_LPGC };

/** Computa el tipo dominante de un barrio a partir de su composición. */
export function tipoDominante(c: ComposicionCapital): TipoBloque {
  return (Object.entries(c) as [TipoBloque, number][]).reduce((a, b) =>
    b[1] > a[1] ? b : a,
  )[0];
}

/** Devuelve true si el barrio es candidato a recuperación (>30 % rentista+corporativo). */
export function esCandidatoRecuperacion(c: ComposicionCapital): boolean {
  return c.rentista + c.corporativo >= 30;
}
