// ─── Cursus honorum ──────────────────────────────────────────────
// Carrera cívica dentro de OCRE. 7 grados con nombre griego clásico
// pero función profesional real contemporánea: el grado no es solo
// decorativo, declara lo que la persona está dispuesta (y acreditada)
// a hacer dentro del común.
//
// Lo importante de este diseño:
//   · Cada grado tiene REQUISITO (puntos mínimos por eje).
//   · Cada grado tiene una FUNCIÓN REAL asociada (lo que puede hacer).
//   · Cada grado mapea a PROFESIONES/ROLES CONTEMPORÁNEOS, de manera
//     que el día de mañana OCRE pueda articular una red profesional
//     real (autónomos, cooperativas, asociaciones, cargos electos)
//     sobre esta misma escalera.
//   · La iconografía es sobria — una silueta + un atributo simple
//     (una herramienta, un libro, una corona ligera) — para dejar
//     espacio al avatar real del ciudadano.

import { EjeId, PesoPorEje } from "@/lib/capital/ejes";

export type GradoId =
  | "polites"
  | "oikonomos"
  | "ergates"
  | "didaskalos"
  | "bouleutes"
  | "strategos"
  | "archon";

export type Grado = {
  /** Orden en la carrera: 0 = entrada. */
  nivel: number;
  id: GradoId;
  /** Nombre griego — se muestra como título principal. */
  nombre: string;
  /** Transliteración latina — para lectura rápida. */
  nombreLatino: string;
  /** Traducción castellana — en caption. */
  traduccion: string;
  /** En una frase: quién es. */
  lema: string;
  /** Función cívica concreta que habilita este grado en OCRE. */
  funcionCivica: string;
  /** Mapeo a profesiones / roles reales contemporáneos. */
  correspondenciaProfesional: string[];
  /** Icono — lo usamos como símbolo encima del avatar en el banner flotante. */
  atributo: string;
  /** Color acento para el grado (HEX). */
  color: string;
  /** Requisito mínimo por eje para alcanzarlo. */
  requisito: Partial<PesoPorEje> & { total?: number };
  /** Requisitos no numéricos — condiciones cualitativas. */
  requisitoCualitativo?: string[];
};

export const CURSUS: Grado[] = [
  {
    nivel: 0,
    id: "polites",
    nombre: "Polítes",
    nombreLatino: "POLITES",
    traduccion: "ciudadano/a",
    lema: "Te inscribes, participas, aprendes.",
    funcionCivica:
      "Acceso básico al Ágora y a la Bibliotheka. Puede PEC a otras aportaciones y marcar pines en Polis.",
    correspondenciaProfesional: ["cualquier persona empadronada"],
    atributo: "○",
    color: "#8A5E1F",
    requisito: {},
  },
  {
    nivel: 1,
    id: "oikonomos",
    nombre: "Oikonómos",
    nombreLatino: "OIKONOMOS",
    traduccion: "gestor/a del hogar",
    lema: "Pone oficio y cuidado al servicio del común.",
    funcionCivica:
      "Puede publicar recursos en Koiná (guías prácticas, plantillas, servicios de proximidad) y ofrecer servicios verificados dentro del barrio.",
    correspondenciaProfesional: [
      "autónomos/as",
      "artesanos/as",
      "oficios del cuidado",
      "pequeño comercio de barrio",
    ],
    atributo: "⬡",
    color: "#A14B2A",
    requisito: { koinonia: 20, total: 40 },
    requisitoCualitativo: ["3 recursos publicados en Koiná", "5 PECs recibidos"],
  },
  {
    nivel: 2,
    id: "ergates",
    nombre: "Ergátes",
    nombreLatino: "ERGATES",
    traduccion: "trabajador/a cualificado/a",
    lema: "Convierte su oficio en formación pública.",
    funcionCivica:
      "Puede abrir una serie propia en el Cursus honorum de la Bibliotheka (canal de videos) y moderar hilos de su sección en el Ágora.",
    correspondenciaProfesional: [
      "técnicos/as",
      "profesionales cualificados/as",
      "PYMEs de servicios especializados",
      "cooperativas pequeñas",
    ],
    atributo: "◆",
    color: "#B4832E",
    requisito: { paideia: 60, total: 120 },
    requisitoCualitativo: [
      "5 videos publicados en el cursus",
      "15 PECs recibidos",
    ],
  },
  {
    nivel: 3,
    id: "didaskalos",
    nombre: "Didáskalos",
    nombreLatino: "DIDASKALOS",
    traduccion: "maestro/a",
    lema: "Enseña y sostiene el hilo de una disciplina.",
    funcionCivica:
      "Puede fijar un hilo de referencia en Ágora, proponer currículos en Bibliotheka y validar series de otros ergátai.",
    correspondenciaProfesional: [
      "formadores/as",
      "educadores/as",
      "divulgadores/as",
      "cooperativas de conocimiento",
    ],
    atributo: "✦",
    color: "#C98A1A",
    requisito: { paideia: 160, total: 300 },
    requisitoCualitativo: [
      "10 videos publicados",
      "50 PECs recibidos",
      "1 hilo pedagógico fijado en Ágora",
    ],
  },
  {
    nivel: 4,
    id: "bouleutes",
    nombre: "Bouleutés",
    nombreLatino: "BOULEUTES",
    traduccion: "consejero/a del barrio",
    lema: "Representa la voz del barrio en el común.",
    funcionCivica:
      "Puede proponer acciones en Polis, convocar votaciones de barrio y acreditar espacios como candidatos a recuperación.",
    correspondenciaProfesional: [
      "tejido asociativo vecinal",
      "representantes de AMPAs",
      "cooperativas de consumo",
      "delegados/as de PYMEs locales",
    ],
    atributo: "❖",
    color: "#5B7A3E",
    requisito: { politeia: 120, total: 400 },
    requisitoCualitativo: [
      "participación activa en 3 barrios",
      "50 PECs totales",
    ],
  },
  {
    nivel: 5,
    id: "strategos",
    nombre: "Strategós",
    nombreLatino: "STRATEGOS",
    traduccion: "estratega",
    lema: "Lidera campañas de recuperación de espacio.",
    funcionCivica:
      "Puede abrir procesos formales de recuperación de bloques en Polis y coordinar cooperativas de intervención con varios oikonómoi y ergátai.",
    correspondenciaProfesional: [
      "gestores/as culturales",
      "promotores/as de economía social",
      "directores/as de cooperativa",
      "coordinadores/as de barrio",
    ],
    atributo: "✶",
    color: "#6E2A1E",
    requisito: { politeia: 300, total: 800 },
    requisitoCualitativo: [
      "1 espacio recuperado con éxito",
      "100 PECs totales",
    ],
  },
  {
    nivel: 6,
    id: "archon",
    nombre: "Árchon",
    nombreLatino: "ARCHON",
    traduccion: "arconte",
    lema: "Custodia el común durante un mandato.",
    funcionCivica:
      "Puede convocar asambleas abiertas, vetar aprobaciones y custodiar el inventario de Koiná. Cargo rotatorio y revocable.",
    correspondenciaProfesional: [
      "referentes comunitarios electos",
      "miembros de consejos rectores",
      "cargos cívicos rotatorios",
    ],
    atributo: "♁",
    color: "#2B241B",
    requisito: { total: 1600 },
    requisitoCualitativo: ["elección democrática anual"],
  },
];

/** Devuelve el grado actual del ciudadano dado su capital acumulado. */
export function gradoActual(puntos: PesoPorEje): Grado {
  const total = puntos.koinonia + puntos.paideia + puntos.politeia;
  let actual = CURSUS[0];
  for (const g of CURSUS) {
    const reqTotal = g.requisito.total ?? 0;
    const reqKoinonia = g.requisito.koinonia ?? 0;
    const reqPaideia = g.requisito.paideia ?? 0;
    const reqPoliteia = g.requisito.politeia ?? 0;
    const cumple =
      total >= reqTotal &&
      puntos.koinonia >= reqKoinonia &&
      puntos.paideia >= reqPaideia &&
      puntos.politeia >= reqPoliteia;
    if (cumple) actual = g;
  }
  return actual;
}

/** Próximo grado (si lo hay). */
export function proximoGrado(actual: Grado): Grado | null {
  return CURSUS[actual.nivel + 1] ?? null;
}

/**
 * Porcentaje de avance hacia el próximo grado — métrica útil para la
 * barra del banner flotante.
 */
export function avanceHaciaProximo(puntos: PesoPorEje, actual: Grado): number {
  const proximo = proximoGrado(actual);
  if (!proximo) return 1;
  const total = puntos.koinonia + puntos.paideia + puntos.politeia;
  const totalBase = actual.requisito.total ?? 0;
  const totalDestino = proximo.requisito.total ?? totalBase + 1;
  const span = totalDestino - totalBase;
  if (span <= 0) return 1;
  const progreso = Math.max(0, Math.min(1, (total - totalBase) / span));
  return progreso;
}

/** Busca grado por id. */
export function grado(id: GradoId): Grado {
  const g = CURSUS.find((x) => x.id === id);
  if (!g) throw new Error(`Grado desconocido: ${id}`);
  return g;
}

/** Re-export del tipo EjeId para quien importe desde aquí. */
export type { EjeId };
