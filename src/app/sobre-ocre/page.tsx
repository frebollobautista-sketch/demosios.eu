import { redirect } from "next/navigation";

/**
 * /sobre-ocre — alias temporal de /nosotros.
 *
 * Decisión 2026-05-06: el header pasa a usar "Sobre OCRE" como etiqueta y
 * URL canónica. Mantenemos /nosotros funcional (no rompemos enlaces
 * antiguos ni el contenido existente) y /sobre-ocre redirige a /nosotros.
 *
 * Redirect temporal a propósito: si en una siguiente iteración consolidamos
 * /sobre-ocre como ruta canónica y movemos el contenido aquí, los buscadores
 * no tendrán cacheado un 308 estable que entorpezca el cambio.
 */
export default function SobreOcrePage(): never {
  redirect("/nosotros");
}
