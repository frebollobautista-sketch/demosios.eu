/**
 * Utilidades de presentación para Ágora.
 */

import { SECCIONES, type Seccion } from "@/lib/pharos/secciones";

export function getSeccionPorId(id: string): Seccion | undefined {
  return SECCIONES.find((s) => s.id === id);
}

/**
 * Fecha relativa en español ("hace 5 min", "hace 3 horas", "ayer", "hace 4 días").
 * Para fechas > 7 días devuelve formato corto "5 may", "12 ene 2025".
 */
export function fechaRelativa(iso: string): string {
  const d = new Date(iso);
  const ahora = Date.now();
  const diff = ahora - d.getTime();
  const seg = Math.floor(diff / 1000);
  const min = Math.floor(seg / 60);
  const horas = Math.floor(min / 60);
  const dias = Math.floor(horas / 24);

  if (seg < 60) return "ahora";
  if (min < 60) return `hace ${min} min`;
  if (horas < 24) return `hace ${horas}h`;
  if (dias === 1) return "ayer";
  if (dias < 7) return `hace ${dias} días`;

  const mismoAnio = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("es", {
    day: "numeric",
    month: "short",
    year: mismoAnio ? undefined : "numeric",
  });
}

/**
 * Slug de display para autor (display_name o handle).
 */
export function nombreAutor(autor?: {
  handle?: string;
  display_name?: string | null;
}): string {
  if (!autor) return "anónimo";
  return autor.display_name || autor.handle || "anónimo";
}
