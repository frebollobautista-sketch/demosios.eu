// ─── Territorio canario: isla → municipio → barrio ────────────────
// Datos mínimos para el navegador territorial. No pretende ser exhaustivo:
// incluimos todos los municipios y una selección representativa de barrios
// por cada capital insular y algunos municipios grandes.
//
// Cuando conectemos catastro/OSM sustituiremos los barrios mock por un
// índice real de distritos y secciones censales.

export type Barrio = {
  id: string;
  nombre: string;
};

export type Municipio = {
  id: string;
  nombre: string;
  poblacion?: number;
  barrios: Barrio[];
};

export type Isla = {
  id: string;
  nombre: string;
  emoji: string;
  capital: string;
  municipios: Municipio[];
};

export const CANARIAS: Isla[] = [
  {
    id: "gran-canaria",
    nombre: "Gran Canaria",
    emoji: "🌋",
    capital: "Las Palmas de Gran Canaria",
    municipios: [
      {
        id: "las-palmas-de-gran-canaria",
        nombre: "Las Palmas de Gran Canaria",
        poblacion: 381_847,
        barrios: [
          { id: "vegueta", nombre: "Vegueta" },
          { id: "triana", nombre: "Triana" },
          { id: "arenales", nombre: "Arenales" },
          { id: "isleta", nombre: "La Isleta" },
          { id: "guanarteme", nombre: "Guanarteme" },
          { id: "alcaravaneras", nombre: "Alcaravaneras" },
          { id: "schamann", nombre: "Schamann" },
          { id: "san-cristobal", nombre: "San Cristóbal" },
          { id: "tamaraceite", nombre: "Tamaraceite" },
          { id: "jinamar", nombre: "Jinámar" },
        ],
      },
      { id: "telde", nombre: "Telde", poblacion: 103_781, barrios: [
        { id: "san-juan", nombre: "San Juan" },
        { id: "san-gregorio", nombre: "San Gregorio" },
        { id: "jinamar-telde", nombre: "Jinámar" },
      ]},
      { id: "santa-lucia-de-tirajana", nombre: "Santa Lucía de Tirajana", poblacion: 76_419, barrios: [
        { id: "vecindario", nombre: "Vecindario" },
        { id: "sardina", nombre: "Sardina del Sur" },
      ]},
      { id: "san-bartolome-de-tirajana", nombre: "San Bartolomé de Tirajana", poblacion: 52_792, barrios: [
        { id: "maspalomas", nombre: "Maspalomas" },
        { id: "playa-ingles", nombre: "Playa del Inglés" },
        { id: "tunte", nombre: "Tunte" },
      ]},
      { id: "arucas", nombre: "Arucas", poblacion: 37_889, barrios: [] },
      { id: "aguimes", nombre: "Agüimes", poblacion: 32_158, barrios: [] },
      { id: "ingenio", nombre: "Ingenio", poblacion: 31_517, barrios: [] },
      { id: "galdar", nombre: "Gáldar", poblacion: 24_238, barrios: [] },
      { id: "santa-brigida", nombre: "Santa Brígida", poblacion: 18_659, barrios: [] },
      { id: "mogan", nombre: "Mogán", poblacion: 21_120, barrios: [] },
    ],
  },
  {
    id: "tenerife",
    nombre: "Tenerife",
    emoji: "🗻",
    capital: "Santa Cruz de Tenerife",
    municipios: [
      {
        id: "santa-cruz-de-tenerife",
        nombre: "Santa Cruz de Tenerife",
        poblacion: 209_048,
        barrios: [
          { id: "centro-ifara", nombre: "Centro-Ifara" },
          { id: "salud", nombre: "La Salud" },
          { id: "ofra", nombre: "Ofra-Costa Sur" },
          { id: "anaga", nombre: "Anaga" },
          { id: "suroeste", nombre: "Suroeste" },
        ],
      },
      { id: "la-laguna", nombre: "San Cristóbal de La Laguna", poblacion: 159_654, barrios: [
        { id: "centro-laguna", nombre: "Centro" },
        { id: "taco", nombre: "Taco" },
        { id: "tejina", nombre: "Tejina" },
      ]},
      { id: "arona", nombre: "Arona", poblacion: 84_212, barrios: [] },
      { id: "granadilla", nombre: "Granadilla de Abona", poblacion: 54_878, barrios: [] },
      { id: "adeje", nombre: "Adeje", poblacion: 48_213, barrios: [] },
      { id: "la-orotava", nombre: "La Orotava", poblacion: 42_170, barrios: [] },
      { id: "puerto-de-la-cruz", nombre: "Puerto de la Cruz", poblacion: 30_952, barrios: [] },
      { id: "los-realejos", nombre: "Los Realejos", poblacion: 37_909, barrios: [] },
      { id: "icod", nombre: "Icod de los Vinos", poblacion: 22_376, barrios: [] },
    ],
  },
  {
    id: "lanzarote",
    nombre: "Lanzarote",
    emoji: "🏝️",
    capital: "Arrecife",
    municipios: [
      {
        id: "arrecife",
        nombre: "Arrecife",
        poblacion: 64_542,
        barrios: [
          { id: "altavista", nombre: "Altavista" },
          { id: "valterra", nombre: "Valterra" },
          { id: "titerroy", nombre: "Titerroy" },
        ],
      },
      { id: "teguise", nombre: "Teguise", poblacion: 21_843, barrios: [] },
      { id: "san-bartolome", nombre: "San Bartolomé", poblacion: 18_762, barrios: [] },
      { id: "tias", nombre: "Tías", poblacion: 20_514, barrios: [] },
      { id: "yaiza", nombre: "Yaiza", poblacion: 17_112, barrios: [] },
      { id: "haria", nombre: "Haría", poblacion: 5_389, barrios: [] },
      { id: "tinajo", nombre: "Tinajo", poblacion: 6_472, barrios: [] },
    ],
  },
  {
    id: "fuerteventura",
    nombre: "Fuerteventura",
    emoji: "🏜️",
    capital: "Puerto del Rosario",
    municipios: [
      {
        id: "puerto-del-rosario",
        nombre: "Puerto del Rosario",
        poblacion: 41_828,
        barrios: [
          { id: "el-charco", nombre: "El Charco" },
          { id: "risco-prieto", nombre: "Risco Prieto" },
        ],
      },
      { id: "la-oliva", nombre: "La Oliva", poblacion: 27_648, barrios: [] },
      { id: "pajara", nombre: "Pájara", poblacion: 20_864, barrios: [] },
      { id: "antigua", nombre: "Antigua", poblacion: 13_026, barrios: [] },
      { id: "tuineje", nombre: "Tuineje", poblacion: 15_003, barrios: [] },
      { id: "betancuria", nombre: "Betancuria", poblacion: 797, barrios: [] },
    ],
  },
  {
    id: "la-palma",
    nombre: "La Palma",
    emoji: "🌿",
    capital: "Santa Cruz de La Palma",
    municipios: [
      {
        id: "santa-cruz-de-la-palma",
        nombre: "Santa Cruz de La Palma",
        poblacion: 15_711,
        barrios: [
          { id: "centro-scp", nombre: "Centro" },
          { id: "velhoco", nombre: "Velhoco" },
        ],
      },
      { id: "los-llanos", nombre: "Los Llanos de Aridane", poblacion: 20_442, barrios: [] },
      { id: "el-paso", nombre: "El Paso", poblacion: 7_592, barrios: [] },
      { id: "brena-alta", nombre: "Breña Alta", poblacion: 7_124, barrios: [] },
      { id: "brena-baja", nombre: "Breña Baja", poblacion: 5_554, barrios: [] },
      { id: "tazacorte", nombre: "Tazacorte", poblacion: 4_580, barrios: [] },
      { id: "garafia", nombre: "Garafía", poblacion: 1_558, barrios: [] },
    ],
  },
  {
    id: "la-gomera",
    nombre: "La Gomera",
    emoji: "🌳",
    capital: "San Sebastián de La Gomera",
    municipios: [
      { id: "san-sebastian", nombre: "San Sebastián de La Gomera", poblacion: 8_960, barrios: [] },
      { id: "valle-gran-rey", nombre: "Valle Gran Rey", poblacion: 4_371, barrios: [] },
      { id: "alajero", nombre: "Alajeró", poblacion: 1_999, barrios: [] },
      { id: "agulo", nombre: "Agulo", poblacion: 1_151, barrios: [] },
      { id: "hermigua", nombre: "Hermigua", poblacion: 1_929, barrios: [] },
      { id: "vallehermoso", nombre: "Vallehermoso", poblacion: 2_632, barrios: [] },
    ],
  },
  {
    id: "el-hierro",
    nombre: "El Hierro",
    emoji: "🪨",
    capital: "Valverde",
    municipios: [
      { id: "valverde", nombre: "Valverde", poblacion: 4_998, barrios: [] },
      { id: "frontera", nombre: "Frontera", poblacion: 4_124, barrios: [] },
      { id: "el-pinar", nombre: "El Pinar", poblacion: 1_833, barrios: [] },
    ],
  },
  {
    id: "la-graciosa",
    nombre: "La Graciosa",
    emoji: "🐚",
    capital: "Caleta de Sebo",
    municipios: [
      { id: "caleta-de-sebo", nombre: "Caleta de Sebo", poblacion: 750, barrios: [] },
    ],
  },
];

/** Utilidad para UI: obtiene todas las islas ordenadas por tamaño. */
export function islasPorPoblacion(): Isla[] {
  return [...CANARIAS].sort((a, b) => {
    const pobA = a.municipios.reduce((s, m) => s + (m.poblacion ?? 0), 0);
    const pobB = b.municipios.reduce((s, m) => s + (m.poblacion ?? 0), 0);
    return pobB - pobA;
  });
}
