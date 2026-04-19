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

export type BarrioJuego = {
  id: string;
  /** Coordenadas del centroide del hexágono en el viewBox del mapa. */
  posicion: { cx: number; cy: number };
  /** 0-100 % por tipo, suman 100. */
  composicionCapital: ComposicionCapital;
  /** Nota editorial opcional para mostrar en la ventana emergente. */
  nota?: string;
};

/**
 * Barrios del municipio `las-palmas-de-gran-canaria`. Los ids deben
 * coincidir con los definidos en `src/lib/territorio/canarias.ts`.
 */
export const BARRIOS_LPGC: BarrioJuego[] = [
  {
    id: "isleta",
    posicion: { cx: 250, cy: 70 },
    composicionCapital: { comun: 15, residente: 55, autonomo: 20, rentista: 8, corporativo: 2 },
    nota: "Península del norte, tejido obrero y portuario. Tradición asociativa fuerte.",
  },
  {
    id: "guanarteme",
    posicion: { cx: 160, cy: 155 },
    composicionCapital: { comun: 8, residente: 35, autonomo: 17, rentista: 30, corporativo: 10 },
    nota: "Costa cercana a Las Canteras. Presión turística y alquiler vacacional.",
  },
  {
    id: "alcaravaneras",
    posicion: { cx: 340, cy: 155 },
    composicionCapital: { comun: 6, residente: 45, autonomo: 18, rentista: 22, corporativo: 9 },
    nota: "Barrio marinero reconvertido. Mezcla residente + rentismo difuso.",
  },
  {
    id: "schamann",
    posicion: { cx: 90, cy: 240 },
    composicionCapital: { comun: 12, residente: 65, autonomo: 18, rentista: 4, corporativo: 1 },
    nota: "Popular, autoconstruido en los 60-70. Tejido vecinal denso.",
  },
  {
    id: "arenales",
    posicion: { cx: 250, cy: 240 },
    composicionCapital: { comun: 7, residente: 52, autonomo: 22, rentista: 13, corporativo: 6 },
    nota: "Residencial histórico con comercio de barrio activo.",
  },
  {
    id: "san-cristobal",
    posicion: { cx: 410, cy: 240 },
    composicionCapital: { comun: 25, residente: 58, autonomo: 12, rentista: 4, corporativo: 1 },
    nota: "Pueblo pesquero anexionado. Frente al mar, fuerte identidad común.",
  },
  {
    id: "tamaraceite",
    posicion: { cx: 160, cy: 325 },
    composicionCapital: { comun: 14, residente: 52, autonomo: 25, rentista: 6, corporativo: 3 },
    nota: "Periferia noroeste, economía mixta. Pequeños oficios y agricultura residual.",
  },
  {
    id: "triana",
    posicion: { cx: 340, cy: 325 },
    composicionCapital: { comun: 12, residente: 30, autonomo: 33, rentista: 18, corporativo: 7 },
    nota: "Eje comercial histórico. Autónomos al frente, presión de cadenas.",
  },
  {
    id: "vegueta",
    posicion: { cx: 250, cy: 410 },
    composicionCapital: { comun: 30, residente: 28, autonomo: 22, rentista: 15, corporativo: 5 },
    nota: "Casco histórico. Espacios comunes (Catedral, museos, Casa de Colón) al frente; presión turística creciente.",
  },
  {
    id: "jinamar",
    posicion: { cx: 250, cy: 495 },
    composicionCapital: { comun: 5, residente: 40, autonomo: 10, rentista: 10, corporativo: 35 },
    nota: "Valle sur. Presencia significativa de grandes tenedores corporativos — candidato natural a recuperación.",
  },
];

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
