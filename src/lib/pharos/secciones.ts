// Migrated from PHAROS [REF-400] — secciones temáticas del repositorio de recursos

export type Seccion = {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
  color: string; // Hex tinted background
  colorTexto: string; // Hex text accent
};

export const SECCIONES: Seccion[] = [
  {
    id: "salud-servicios-sociales",
    nombre: "Salud, servicios sociales y economía reproductiva",
    descripcion:
      "Sanidad pública, cuidados, dependencia, sistemas de protección social y economía del cuidado.",
    icono: "🏥",
    color: "#FFF1F2",
    colorTexto: "#BE123C",
  },
  {
    id: "cambio-climatico",
    nombre: "Cambio climático y autonomía estratégica",
    descripcion:
      "Crisis climática, soberanía energética, adaptación territorial y resiliencia urbana.",
    icono: "🌍",
    color: "#ECFDF5",
    colorTexto: "#047857",
  },
  {
    id: "el-comun",
    nombre: "El común",
    descripcion:
      "Bienes comunes, gobernanza compartida, espacios colectivos y gestión comunitaria.",
    icono: "🤝",
    color: "#FFFBEB",
    colorTexto: "#B45309",
  },
  {
    id: "migracion-cooperacion",
    nombre: "Migración y cooperación al desarrollo",
    descripcion:
      "Flujos migratorios, políticas de acogida, cooperación internacional y desarrollo sostenible.",
    icono: "🌐",
    color: "#EFF6FF",
    colorTexto: "#1D4ED8",
  },
  {
    id: "defensa-geopolitica",
    nombre: "Defensa, geopolítica y seguridad ciudadana",
    descripcion:
      "Seguridad, defensa, relaciones internacionales y convivencia urbana.",
    icono: "🛡️",
    color: "#F8FAFC",
    colorTexto: "#334155",
  },
  {
    id: "medios-desinformacion",
    nombre: "Medios de comunicación y desinformación post-moderna",
    descripcion:
      "Medios, fake news, alfabetización mediática, narrativas y pensamiento crítico.",
    icono: "📡",
    color: "#FAF5FF",
    colorTexto: "#7E22CE",
  },
  {
    id: "industria-energia",
    nombre: "Industria, energía y transición sostenible",
    descripcion:
      "Política industrial, transición energética, economía circular y modelos productivos.",
    icono: "⚡",
    color: "#FEFCE8",
    colorTexto: "#A16207",
  },
  {
    id: "trabajo-4ri",
    nombre: "Cartera de trabajo de la 4ª Revolución Industrial",
    descripcion:
      "Futuro del trabajo, automatización, inteligencia artificial, formación y nuevas competencias.",
    icono: "🤖",
    color: "#ECFEFF",
    colorTexto: "#0E7490",
  },
];
