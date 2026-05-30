// Las Palmas de Gran Canaria — urban landmark data for POLIS mode
// Coordinates sourced from OpenStreetMap / Google Maps references.
// Mercado de Vegueta architectural data from estilos/mercado_vegueta.json

export type UrbanLandmark = {
  id: string;
  name: string;
  coords: [number, number]; // [lat, lng]
  category: string; // PHAROS category id
  description: string;
  year?: number;
  architect?: string;
  materials?: string[];
  pixelArtProfile?: string; // path to Godot/calibrador data
  dimensions?: {
    width: number;
    depth: number;
    heightWalls: number;
    heightTotal: number;
  };
};

/** GPS coordinates for each existing POLI_PIN location */
export const PIN_COORDS: Record<string, [number, number]> = {
  triana: [28.1037, -15.4156],
  plaza_del_pilar: [28.1068, -15.4182],
  el_confital: [28.1481, -15.4503],
  las_canteras: [28.135, -15.4367],
  vegueta: [28.1003, -15.4139],
};

/** Map center for Las Palmas */
export const LAS_PALMAS_CENTER: [number, number] = [28.12, -15.43];
export const LAS_PALMAS_ZOOM = 13;

/** Mercado de Vegueta — full architectural record */
export const MERCADO_VEGUETA: UrbanLandmark = {
  id: "mercado-vegueta",
  name: "Mercado de Vegueta",
  coords: [28.1022, -15.4133],
  category: "cultura",
  description:
    "Primer mercado de abastos de Canarias (1858). Planta claustral con patio central, fachadas encaladas y portico de canteria con arco de medio punto.",
  year: 1858,
  architect: "Manuel de Oraa",
  materials: [
    "canteria de piedra",
    "muros encalados",
    "carpinteria de madera",
    "teja arabe",
  ],
  pixelArtProfile: "godot/mercado_vegueta",
  dimensions: {
    width: 30,
    depth: 45,
    heightWalls: 7,
    heightTotal: 10,
  },
};

/** Urban landmarks seeded around Las Palmas */
export const LANDMARKS: UrbanLandmark[] = [
  MERCADO_VEGUETA,
  {
    id: "catedral-santa-ana",
    name: "Catedral de Santa Ana",
    coords: [28.1003, -15.4155],
    category: "cultura",
    description:
      "Catedral de Las Palmas, mezcla de gotico tardio y neoclasico. Construccion iniciada en el siglo XV.",
    year: 1500,
  },
  {
    id: "casa-colon",
    name: "Casa de Colon",
    coords: [28.1005, -15.4148],
    category: "cultura",
    description:
      "Museo dedicado a Cristobal Colon y la historia de Canarias. Arquitectura colonial con patios interiores.",
    year: 1951,
  },
  {
    id: "teatro-perez-galdos",
    name: "Teatro Perez Galdos",
    coords: [28.1043, -15.4133],
    category: "cultura",
    description:
      "Teatro principal de Las Palmas, inaugurado en 1890. Estilo eclectico con influencias modernistas.",
    year: 1890,
  },
  {
    id: "castillo-la-luz",
    name: "Castillo de La Luz",
    coords: [28.1455, -15.4309],
    category: "cultura",
    description:
      "Fortaleza del siglo XV en el Puerto de La Luz. Hoy centro de arte contemporaneo.",
    year: 1494,
  },
  {
    id: "auditorio-alfredo-kraus",
    name: "Auditorio Alfredo Kraus",
    coords: [28.1332, -15.4433],
    category: "cultura",
    description:
      "Auditorio frente al mar en Las Canteras, disenado por Oscar Tusquets. Inaugurado en 1997.",
    year: 1997,
    architect: "Oscar Tusquets",
  },
  {
    id: "playa-las-canteras",
    name: "Playa de Las Canteras",
    coords: [28.1365, -15.4362],
    category: "medioambiente",
    description:
      "Playa urbana principal de Las Palmas, con arrecife natural (La Barra) que forma una piscina natural.",
  },
  {
    id: "parque-santa-catalina",
    name: "Parque Santa Catalina",
    coords: [28.1415, -15.4295],
    category: "comunidad",
    description:
      "Plaza y parque historico junto al puerto. Sede del Carnaval y punto de encuentro ciudadano.",
  },
];
