// ─── Avatar generativo (DiceBear · estilo "avataaars") ──────────────────────
//
// La "receta" es lo que se guarda en profiles.avatar_receta (jsonb): el estilo,
// una semilla y el conjunto de opciones elegidas. A partir de la receta se
// repinta SIEMPRE el mismo SVG, en servidor o cliente, de forma determinista.
//
// Decisión 2026-06-03 (con Panch): motor DiceBear (SVG generativo, open source)
// + cosméticos que se DESBLOQUEAN con el cursus/BLaP (ver catalogo.ts).
//
// Las opciones de DiceBear son arrays (elige determinista por semilla); para
// una elección concreta pasamos un array de un elemento. Los colores van en
// hex SIN '#'.

import { createAvatar } from "@dicebear/core";
import { avataaars } from "@dicebear/collection";

export const AVATAR_RECETA_VERSION = 1;

export type AvatarReceta = {
  v: number;
  estilo: "avataaars";
  seed: string;
  /** Opciones DiceBear: arrays de string (valores/hex) o números (probabilidades). */
  opciones: Record<string, string[] | number>;
};

/**
 * Receta por defecto, determinista a partir de la semilla (normalmente el id o
 * el handle del usuario). Pensada para que un avatar recién creado ya tenga un
 * aspecto coherente y sobrio, todo con cosméticos de acceso libre.
 */
export function recetaPorDefecto(seed: string): AvatarReceta {
  return {
    v: AVATAR_RECETA_VERSION,
    estilo: "avataaars",
    seed: seed || "ocre",
    opciones: {
      top: ["shortFlat"],
      hairColor: ["2c1b18"],
      skinColor: ["edb98a"],
      eyebrows: ["default"],
      eyes: ["default"],
      mouth: ["smile"],
      clothing: ["shirtCrewNeck"],
      clothesColor: ["5199e4"],
      backgroundColor: ["c7e3c0"],
      // Toggles ocultos por defecto (probabilidad 0).
      accessories: ["round"],
      accessoriesProbability: 0,
      facialHair: ["beardLight"],
      facialHairProbability: 0,
      style: ["default"],
    },
  };
}

/** Genera el SVG (string) de la receta. Síncrono; vale en server y cliente. */
export function renderAvatarSVG(receta: AvatarReceta, size = 96): string {
  const avatar = createAvatar(avataaars, {
    seed: receta.seed,
    size,
    ...receta.opciones,
  });
  return avatar.toString();
}

/** Versión data-uri (útil para <img src>). */
export function renderAvatarDataUri(receta: AvatarReceta, size = 96): string {
  const avatar = createAvatar(avataaars, {
    seed: receta.seed,
    size,
    ...receta.opciones,
  });
  return avatar.toDataUri();
}

/**
 * Parseo defensivo de lo que venga de la columna jsonb. Devuelve null si no es
 * una receta reconocible (así la UI cae al avatar de inicial/foto).
 */
export function parseReceta(value: unknown): AvatarReceta | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (v.estilo !== "avataaars") return null;
  if (typeof v.seed !== "string") return null;
  if (!v.opciones || typeof v.opciones !== "object") return null;
  return {
    v: typeof v.v === "number" ? v.v : AVATAR_RECETA_VERSION,
    estilo: "avataaars",
    seed: v.seed,
    opciones: v.opciones as Record<string, string[] | number>,
  };
}
