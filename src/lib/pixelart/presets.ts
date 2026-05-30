/**
 * Perfiles de material predefinidos para el flujo /mapear.
 *
 * Son los mismos cinco materiales canónicos de KOINOS/estilos/materiales_base.json.
 * Se mantienen aquí embebidos para no depender del sistema de archivos en runtime;
 * cuando el calibrador exporte nuevos perfiles se podrán regenerar por script.
 *
 * Cada preset es un ParametrosFiltro listo para alimentar procesarImagen.
 */

import type { ParametrosFiltro } from "./procesar";

export type PresetMaterial = {
  id: string;
  etiqueta: string;
  descripcion: string;
  params: ParametrosFiltro;
  colorRepresentativo: string;
};

export const PRESETS_MATERIAL: PresetMaterial[] = [
  {
    id: "piedra_volcanica_canaria",
    etiqueta: "Piedra volcánica",
    descripcion: "Muros basálticos, zócalos, sillares",
    params: { pixelSize: 9, colores: 7, contraste: 140, saturacion: 50 },
    colorRepresentativo: "#5a5350",
  },
  {
    id: "madera_tea",
    etiqueta: "Madera tea",
    descripcion: "Balcones, carpintería, celosías",
    params: { pixelSize: 6, colores: 12, contraste: 125, saturacion: 95 },
    colorRepresentativo: "#6d3a10",
  },
  {
    id: "encalado_blanco",
    etiqueta: "Encalado",
    descripcion: "Fachadas blancas, cal tradicional",
    params: { pixelSize: 7, colores: 5, contraste: 115, saturacion: 40 },
    colorRepresentativo: "#f0ebe2",
  },
  {
    id: "azulejo_hidraulico",
    etiqueta: "Azulejo",
    descripcion: "Baldosa hidráulica, cerámica",
    params: { pixelSize: 3, colores: 20, contraste: 130, saturacion: 120 },
    colorRepresentativo: "#3d6ea5",
  },
  {
    id: "tejado_teja_arabe",
    etiqueta: "Teja árabe",
    descripcion: "Cubiertas, aleros",
    params: { pixelSize: 5, colores: 10, contraste: 130, saturacion: 80 },
    colorRepresentativo: "#a14a1e",
  },
];

export const PRESET_POR_DEFECTO: PresetMaterial = PRESETS_MATERIAL[0];
