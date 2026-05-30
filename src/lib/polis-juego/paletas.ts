// ─── POLIS · Juego: paletas pixel art y mapeo de capital ──────────
// Paletas calibradas a partir de KOINOS/estilos/materiales_base.json.
// Cada material aporta un degradado de tres tonos para pintar el
// edificio en pixel art: sombra · base · luz.

import type { MaterialId } from "./tipos";
import type { TipoBloque } from "@/lib/territorio/barrios-juego";

export type PaletaMaterial = {
  id: MaterialId;
  etiqueta: string;
  /** Sombra, base, luz — tres tonos para sombrear cubo pixel art. */
  sombra: string;
  base: string;
  luz: string;
  /** Color de "borde" del píxel para reforzar definición. */
  contorno: string;
  /** Densidad (cuán pequeño es el grano del material; influye en el render). */
  granoPx: number;
};

export const PALETAS_MATERIAL: Record<MaterialId, PaletaMaterial> = {
  piedra_volcanica_canaria: {
    id: "piedra_volcanica_canaria",
    etiqueta: "Piedra volcánica",
    sombra: "#2d2a28",
    base: "#5a5350",
    luz: "#847a72",
    contorno: "#1a1a1a",
    granoPx: 9,
  },
  madera_tea: {
    id: "madera_tea",
    etiqueta: "Madera tea",
    sombra: "#5a2f14",
    base: "#8c5a2c",
    luz: "#c69856",
    contorno: "#2e1a0a",
    granoPx: 6,
  },
  encalado_blanco: {
    id: "encalado_blanco",
    etiqueta: "Encalado",
    sombra: "#e8e4db",
    base: "#f5f2eb",
    luz: "#ffffff",
    contorno: "#cdc7bb",
    granoPx: 7,
  },
  azulejo_hidraulico: {
    id: "azulejo_hidraulico",
    etiqueta: "Azulejo",
    sombra: "#1a3a5c",
    base: "#4a8cbc",
    luz: "#e8d4a0",
    contorno: "#2a5a8c",
    granoPx: 3,
  },
  tejado_teja_arabe: {
    id: "tejado_teja_arabe",
    etiqueta: "Teja árabe",
    sombra: "#5a2810",
    base: "#944a20",
    luz: "#dba868",
    contorno: "#3a1a0a",
    granoPx: 5,
  },
};

/** Color base de la franja del barrio según el tipo de capital dominante. */
export const COLOR_TIPO_CAPITAL: Record<
  TipoBloque,
  { base: string; tenue: string; etiqueta: string; aptoRecuperacion: boolean }
> = {
  comun: {
    base: "var(--color-oliva)",
    tenue: "#DEE6D0",
    etiqueta: "Común",
    aptoRecuperacion: false,
  },
  residente: {
    base: "var(--color-ocre)",
    tenue: "#EFE2C1",
    etiqueta: "Residente",
    aptoRecuperacion: false,
  },
  autonomo: {
    base: "var(--color-ambar)",
    tenue: "#FBEACF",
    etiqueta: "Autónomo / PYME",
    aptoRecuperacion: false,
  },
  rentista: {
    base: "var(--color-siena)",
    tenue: "#F0DED3",
    etiqueta: "Rentista difuso",
    aptoRecuperacion: true,
  },
  corporativo: {
    base: "var(--color-sangre)",
    tenue: "#E8D1CD",
    etiqueta: "Privado-corporativo",
    aptoRecuperacion: true,
  },
};

/** Color exclusivo para los tres ejes de juego (HUD y barras de PEC). */
export const COLOR_EJE_JUEGO: Record<
  "exploracion" | "calibrado" | "recuperacion",
  { hex: string; etiqueta: string; lema: string; icono: string }
> = {
  exploracion: {
    hex: "var(--color-ocre)",
    etiqueta: "Exploración",
    lema: "Caminar la calle.",
    icono: "◎",
  },
  calibrado: {
    hex: "var(--color-ocre-deep)",
    etiqueta: "Calibrado",
    lema: "Reconocer el material.",
    icono: "◐",
  },
  recuperacion: {
    hex: "var(--color-sangre)",
    etiqueta: "Recuperación",
    lema: "Devolver al común.",
    icono: "✺",
  },
};
