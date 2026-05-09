import { redirect } from "next/navigation";

/**
 * /recursos — alias temporal de /demos-ios.
 *
 * Decisión 2026-05-09 con Panch: lo que antes era /recursos pasa a
 * llamarse "Demos iOS". Mantenemos esta ruta funcional como redirect
 * para no romper enlaces antiguos. En el futuro, si confirmamos que
 * nadie linka a /recursos desde fuera, esta ruta se puede eliminar.
 */
export default function RecursosPage(): never {
  redirect("/demos-ios");
}
