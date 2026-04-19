// Migrated from PHAROS [REF-008] — categorías temáticas para hilos del foro

export type Categoria = {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
};

export const CATEGORIAS: Categoria[] = [
  {
    id: "urbanismo",
    nombre: "Urbanismo",
    descripcion: "Planificación urbana, edificios, espacios públicos",
    icono: "🏗️",
  },
  {
    id: "movilidad",
    nombre: "Movilidad",
    descripcion: "Transporte público, carriles bici, peatonalización",
    icono: "🚌",
  },
  {
    id: "medioambiente",
    nombre: "Medioambiente",
    descripcion: "Zonas verdes, contaminación, reciclaje, costas",
    icono: "🌿",
  },
  {
    id: "cultura",
    nombre: "Cultura",
    descripcion: "Eventos culturales, patrimonio, arte público",
    icono: "🎭",
  },
  {
    id: "comunidad",
    nombre: "Comunidad",
    descripcion: "Vida vecinal, asociaciones, convivencia",
    icono: "🤝",
  },
  {
    id: "educacion",
    nombre: "Educación",
    descripcion: "Colegios, formación, bibliotecas",
    icono: "📚",
  },
  {
    id: "economia-local",
    nombre: "Economía Local",
    descripcion: "Comercio de barrio, empleo, cooperativas",
    icono: "🏪",
  },
  {
    id: "participacion",
    nombre: "Participación",
    descripcion: "Política pública, presupuestos participativos, gobernanza",
    icono: "🗳️",
  },
  {
    id: "bienestar",
    nombre: "Bienestar",
    descripcion: "Salud, deporte, servicios sociales",
    icono: "💚",
  },
  {
    id: "general",
    nombre: "General",
    descripcion: "Temas que no encajan en otras categorías",
    icono: "💬",
  },
];
