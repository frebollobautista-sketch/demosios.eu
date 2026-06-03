/**
 * Home — el runtime POLIS (juego iso del archipiélago).
 *
 * Decisión 2026-05-31 (con Panch): la portada pasa a ser directamente el
 * mapa-juego POLIS (public/polis-app), el runtime iso donde se eligen islas
 * → municipios → secciones y se ven los edificios en 3D. Sustituye al lobby
 * del faro. Los datos pesados (sections_pack / osm) se sirven desde
 * Cloudflare R2 vía el wiring de assets-base.js dentro de polis-app.
 *
 * En la home se oculta el Header del sitio (ver Shell.tsx), así que el
 * iframe ocupa el viewport completo y solo se ve la barra propia del juego.
 *
 * 2026-06-03 (con Panch): "directo a su isla". Si el usuario ya está
 * registrado y ha completado el onboarding (eligió isla), NO mostramos la
 * vista de archipiélago para volver a "encajar la isla": arrancamos el
 * runtime directamente en su isla pasando `?isla=<slug>` al iframe. El
 * polis-app ya honra ese parámetro en boot() → enterIsla(islaParam), y
 * mantiene su propio botón para volver al archipiélago / cambiar de isla.
 *
 * Sin sesión, o sin isla elegida, se sirve el archipiélago como antes.
 */

import { createClient } from "@/lib/supabase/server";

// Cache-buster del bundle estático del polis-app.
const POLIS_VERSION = "20260603-isla1";

/**
 * El onboarding guarda `profiles.isla_id` con el id largo del catálogo
 * CANARIAS (p.ej. "gran-canaria"), pero el runtime POLIS usa el slug corto
 * INE de la isla (p.ej. "gc"). Mapa de traducción. La Graciosa se pliega en
 * Lanzarote porque el archipiélago del juego no la separa.
 */
const ISLA_A_SLUG: Record<string, string> = {
  "gran-canaria": "gc",
  tenerife: "tf",
  lanzarote: "lz",
  fuerteventura: "fv",
  "la-palma": "lp",
  "la-gomera": "lg",
  "el-hierro": "eh",
  "la-graciosa": "lz",
};

export default async function InicioPage() {
  const supabase = await createClient();

  // Lectura defensiva: si la columna `onboarding_completed` o `isla_id` aún
  // no existe (migración sin aplicar) o no hay sesión, caemos al archipiélago.
  let islaSlug: string | null = null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: perfil } = await supabase
        .from("profiles")
        .select("isla_id, onboarding_completed")
        .eq("id", user.id)
        .maybeSingle();

      const p = perfil as
        | { isla_id: string | null; onboarding_completed: boolean | null }
        | null;

      if (p?.onboarding_completed && p.isla_id) {
        islaSlug = ISLA_A_SLUG[p.isla_id] ?? null;
      }
    }
  } catch {
    // Silencioso: cualquier fallo de lectura → archipiélago por defecto.
    islaSlug = null;
  }

  const src = islaSlug
    ? `/polis-app/index.html?v=${POLIS_VERSION}&isla=${islaSlug}`
    : `/polis-app/index.html?v=${POLIS_VERSION}`;

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height: "100dvh", background: "#0a0a0a" }}
    >
      <iframe
        src={src}
        title="POLIS — mapa cívico de Canarias"
        className="absolute inset-0 h-full w-full border-0 block"
        allow="fullscreen"
      />
    </div>
  );
}
