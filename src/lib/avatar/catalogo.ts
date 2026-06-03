// ─── Catálogo de cosméticos del avatar + reglas de desbloqueo (BLaP) ────────
//
// Cada "parte" del avatar (peinado, ojos, ropa…) mapea a un campo de DiceBear
// (estilo avataaars) y ofrece una lista de opciones. Cada opción tiene una
// regla de desbloqueo: libre, por grado del cursus, por logro o por insignia.
//
// La verdad sobre qué tiene desbloqueado un usuario se calcula a partir de:
//   · su grado actual (nivel 0..6, derivado de `contribuciones`),
//   · sus logros conseguidos (tabla user_logros, cuando exista),
//   · sus insignias (tabla user_insignias, cuando exista).
//
// IMPORTANTE: el gating se valida también en servidor al guardar (actions.ts);
// el cliente sólo lo usa para mostrar/atenuar. Nunca confíes solo en el cliente.

import { CURSUS, type Grado } from "@/lib/cursus/grados";

export type Desbloqueo =
  | { tipo: "libre" }
  | { tipo: "grado"; nivel: number } // nivel mínimo del cursus (0..6)
  | { tipo: "logro"; logroId: string }
  | { tipo: "insignia"; insigniaId: string };

export type OpcionCosmetica = {
  /** Valor que entiende DiceBear (o hex sin '#' si es color). */
  id: string;
  etiqueta: string;
  desbloqueo: Desbloqueo;
};

export type ParteAvatar = {
  id: string;
  etiqueta: string;
  /** Campo DiceBear principal (top, eyes, clothing, skinColor…). */
  campo: string;
  /** true si las opciones son colores (hex sin '#'). */
  esColor?: boolean;
  /**
   * Si la parte es opcional (vello facial, gafas), el campo de probabilidad
   * asociado para mostrar/ocultar (p.ej. "facialHairProbability"). Cuando se
   * elige la opción "ninguno" se pone a 0; en otro caso a 100.
   */
  campoProbabilidad?: string;
  opciones: OpcionCosmetica[];
};

const libre = (): Desbloqueo => ({ tipo: "libre" });
const porGrado = (nivel: number): Desbloqueo => ({ tipo: "grado", nivel });

/** Id especial: "sin vello facial / sin gafas". */
export const NINGUNO = "__ninguno__";

// Paletas (hex sin '#', como espera DiceBear).
const PIELES = ["ffdbb4", "edb98a", "fd9841", "f8d25c", "d08b5b", "ae5d29", "614335"];
const PELOS = ["2c1b18", "4a312c", "724133", "a55728", "b58143", "d6b370", "c93305", "e8e1e1", "ecdcbf"];
const ROPAS = ["262e33", "3c4f5c", "5199e4", "65c9ff", "25557c", "929598", "e6e6e6", "ff488e", "ff5c5c", "a7ffc4", "ffafb9"];
// Fondos: tonos OCRE/papiro + algunos de prestigio gated.
const FONDOS_LIBRES = ["c7e3c0", "b6e3f4", "ffd5dc", "ffdfbf", "d1d4f9", "e6e6e6"];

export const CATALOGO_AVATAR: ParteAvatar[] = [
  {
    id: "piel",
    etiqueta: "Piel",
    campo: "skinColor",
    esColor: true,
    opciones: PIELES.map((c) => ({ id: c, etiqueta: c, desbloqueo: libre() })),
  },
  {
    id: "peinado",
    etiqueta: "Peinado",
    campo: "top",
    opciones: [
      { id: "shortFlat", etiqueta: "Corto liso", desbloqueo: libre() },
      { id: "shortRound", etiqueta: "Corto redondo", desbloqueo: libre() },
      { id: "shortWaved", etiqueta: "Corto ondulado", desbloqueo: libre() },
      { id: "theCaesar", etiqueta: "César", desbloqueo: libre() },
      { id: "bob", etiqueta: "Bob", desbloqueo: libre() },
      { id: "straight01", etiqueta: "Liso largo", desbloqueo: libre() },
      { id: "curly", etiqueta: "Rizado", desbloqueo: libre() },
      { id: "bun", etiqueta: "Moño", desbloqueo: porGrado(1) },
      { id: "dreads", etiqueta: "Rastas", desbloqueo: porGrado(1) },
      { id: "fro", etiqueta: "Afro", desbloqueo: porGrado(2) },
      { id: "frida", etiqueta: "Frida", desbloqueo: porGrado(2) },
      { id: "bigHair", etiqueta: "Melena", desbloqueo: porGrado(3) },
      { id: "hijab", etiqueta: "Hiyab", desbloqueo: libre() },
      { id: "turban", etiqueta: "Turbante", desbloqueo: libre() },
      { id: "hat", etiqueta: "Sombrero", desbloqueo: porGrado(2) },
      { id: "winterHat1", etiqueta: "Gorro", desbloqueo: porGrado(1) },
    ],
  },
  {
    id: "colorPelo",
    etiqueta: "Color de pelo",
    campo: "hairColor",
    esColor: true,
    opciones: PELOS.map((c) => ({ id: c, etiqueta: c, desbloqueo: libre() })),
  },
  {
    id: "cejas",
    etiqueta: "Cejas",
    campo: "eyebrows",
    opciones: [
      { id: "default", etiqueta: "Normal", desbloqueo: libre() },
      { id: "raisedExcited", etiqueta: "Levantadas", desbloqueo: libre() },
      { id: "flatNatural", etiqueta: "Planas", desbloqueo: libre() },
      { id: "angry", etiqueta: "Enfadadas", desbloqueo: libre() },
      { id: "sadConcerned", etiqueta: "Preocupadas", desbloqueo: libre() },
      { id: "unibrowNatural", etiqueta: "Unidas", desbloqueo: libre() },
    ],
  },
  {
    id: "ojos",
    etiqueta: "Ojos",
    campo: "eyes",
    opciones: [
      { id: "default", etiqueta: "Normales", desbloqueo: libre() },
      { id: "happy", etiqueta: "Contentos", desbloqueo: libre() },
      { id: "squint", etiqueta: "Entornados", desbloqueo: libre() },
      { id: "wink", etiqueta: "Guiño", desbloqueo: libre() },
      { id: "side", etiqueta: "De lado", desbloqueo: libre() },
      { id: "surprised", etiqueta: "Sorpresa", desbloqueo: libre() },
      { id: "hearts", etiqueta: "Corazones", desbloqueo: porGrado(2) },
      { id: "closed", etiqueta: "Cerrados", desbloqueo: libre() },
    ],
  },
  {
    id: "boca",
    etiqueta: "Boca",
    campo: "mouth",
    opciones: [
      { id: "smile", etiqueta: "Sonrisa", desbloqueo: libre() },
      { id: "default", etiqueta: "Neutra", desbloqueo: libre() },
      { id: "serious", etiqueta: "Seria", desbloqueo: libre() },
      { id: "twinkle", etiqueta: "Media sonrisa", desbloqueo: libre() },
      { id: "tongue", etiqueta: "Lengua", desbloqueo: libre() },
      { id: "grimace", etiqueta: "Mueca", desbloqueo: libre() },
    ],
  },
  {
    id: "vello",
    etiqueta: "Vello facial",
    campo: "facialHair",
    campoProbabilidad: "facialHairProbability",
    opciones: [
      { id: NINGUNO, etiqueta: "Ninguno", desbloqueo: libre() },
      { id: "beardLight", etiqueta: "Barba ligera", desbloqueo: libre() },
      { id: "beardMedium", etiqueta: "Barba media", desbloqueo: libre() },
      { id: "moustacheFancy", etiqueta: "Bigote", desbloqueo: libre() },
      { id: "beardMajestic", etiqueta: "Barba majestuosa", desbloqueo: porGrado(3) },
    ],
  },
  {
    id: "ropa",
    etiqueta: "Ropa",
    campo: "clothing",
    opciones: [
      { id: "shirtCrewNeck", etiqueta: "Camiseta", desbloqueo: libre() },
      { id: "shirtVNeck", etiqueta: "Camiseta de pico", desbloqueo: libre() },
      { id: "hoodie", etiqueta: "Sudadera", desbloqueo: libre() },
      { id: "overall", etiqueta: "Peto", desbloqueo: libre() },
      { id: "collarAndSweater", etiqueta: "Jersey con cuello", desbloqueo: porGrado(1) },
      { id: "graphicShirt", etiqueta: "Camiseta estampada", desbloqueo: porGrado(1) },
      { id: "blazerAndShirt", etiqueta: "Americana", desbloqueo: porGrado(2) },
      { id: "blazerAndSweater", etiqueta: "Americana y jersey", desbloqueo: porGrado(4) },
    ],
  },
  {
    id: "colorRopa",
    etiqueta: "Color de ropa",
    campo: "clothesColor",
    esColor: true,
    opciones: ROPAS.map((c) => ({ id: c, etiqueta: c, desbloqueo: libre() })),
  },
  {
    id: "gafas",
    etiqueta: "Gafas",
    campo: "accessories",
    campoProbabilidad: "accessoriesProbability",
    opciones: [
      { id: NINGUNO, etiqueta: "Ninguna", desbloqueo: libre() },
      { id: "round", etiqueta: "Redondas", desbloqueo: libre() },
      { id: "prescription01", etiqueta: "Graduadas", desbloqueo: libre() },
      { id: "prescription02", etiqueta: "Graduadas 2", desbloqueo: libre() },
      { id: "sunglasses", etiqueta: "De sol", desbloqueo: porGrado(1) },
      { id: "wayfarers", etiqueta: "Wayfarer", desbloqueo: porGrado(2) },
      { id: "eyepatch", etiqueta: "Parche", desbloqueo: porGrado(3) },
    ],
  },
  {
    id: "fondo",
    etiqueta: "Fondo",
    campo: "backgroundColor",
    esColor: true,
    opciones: [
      ...FONDOS_LIBRES.map((c) => ({ id: c, etiqueta: c, desbloqueo: libre() })),
      { id: "f5d76e", etiqueta: "f5d76e", desbloqueo: porGrado(4) },
      { id: "e0aa3e", etiqueta: "e0aa3e", desbloqueo: porGrado(6) },
    ],
  },
];

// ─── Contexto y evaluación de desbloqueo ────────────────────────────────────

export type ContextoDesbloqueo = {
  /** Nivel del grado actual (0 = polites … 6 = archon). */
  nivelGrado: number;
  logros: Set<string>;
  insignias: Set<string>;
};

export function contextoVacio(): ContextoDesbloqueo {
  return { nivelGrado: 0, logros: new Set(), insignias: new Set() };
}

export function estaDesbloqueada(
  d: Desbloqueo,
  ctx: ContextoDesbloqueo,
): boolean {
  switch (d.tipo) {
    case "libre":
      return true;
    case "grado":
      return ctx.nivelGrado >= d.nivel;
    case "logro":
      return ctx.logros.has(d.logroId);
    case "insignia":
      return ctx.insignias.has(d.insigniaId);
  }
}

/** Texto corto que explica por qué algo está bloqueado. */
export function motivoBloqueo(d: Desbloqueo): string {
  switch (d.tipo) {
    case "libre":
      return "";
    case "grado": {
      const g: Grado | undefined = CURSUS.find((x) => x.nivel === d.nivel);
      return `Se desbloquea al alcanzar ${g ? g.nombre : `nivel ${d.nivel}`}`;
    }
    case "logro":
      return "Se desbloquea con un logro";
    case "insignia":
      return "Se desbloquea con una insignia";
  }
}

/**
 * Valida que TODAS las opciones elegidas en una receta estén desbloqueadas para
 * el contexto dado. Devuelve la lista de campos inválidos (vacía = ok).
 * Ignora campos no catalogados (probabilidades, style, seed…).
 */
export function validarRecetaContra(
  opciones: Record<string, string[] | number>,
  ctx: ContextoDesbloqueo,
): string[] {
  const invalidos: string[] = [];
  for (const parte of CATALOGO_AVATAR) {
    const val = opciones[parte.campo];
    if (!Array.isArray(val) || val.length === 0) continue;
    const elegido = String(val[0]);
    // Toggle oculto → no validamos su valor (no se ve).
    if (parte.campoProbabilidad && opciones[parte.campoProbabilidad] === 0) {
      continue;
    }
    if (elegido === NINGUNO) continue;
    const opcion = parte.opciones.find((o) => o.id === elegido);
    if (!opcion) {
      invalidos.push(parte.campo);
      continue;
    }
    if (!estaDesbloqueada(opcion.desbloqueo, ctx)) invalidos.push(parte.campo);
  }
  return invalidos;
}
