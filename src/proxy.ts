import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy de sesión Supabase (antes "middleware" — renombrado en Next.js 16).
 * Refresca cookies de auth en cada request y protege las rutas que requieren
 * usuario.
 *
 * Rutas públicas: /, /agora, /bibliotheka, /polis, /login, /auth, /api/**
 * Rutas protegidas: /perfil, /ajustes (y cualquier ruta futura fuera de la lista).
 */
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const esRutaProtegida =
    pathname.startsWith("/perfil") || pathname.startsWith("/ajustes");

  if (!user && esRutaProtegida) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Ya logueado: no dejamos volver a las pantallas de auth.
  if (user && (pathname === "/login" || pathname === "/registro")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Onboarding obligatorio: si el usuario no lo ha completado, lo enviamos a
  // /onboarding salvo en rutas de auth, API y el propio onboarding. Es
  // resiliente: si la columna `onboarding_completed` aún no existe (migración
  // sin aplicar), la query falla y NO redirigimos (la app sigue funcionando).
  if (user) {
    const enRutaLibre =
      pathname.startsWith("/onboarding") ||
      pathname.startsWith("/auth") ||
      pathname.startsWith("/api") ||
      pathname === "/login" ||
      pathname === "/registro";
    if (!enRutaLibre) {
      const { data: perfil, error } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", user.id)
        .maybeSingle();
      if (!error && perfil && perfil.onboarding_completed === false) {
        const url = request.nextUrl.clone();
        url.pathname = "/onboarding";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Todas las rutas menos assets estáticos e imágenes.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
