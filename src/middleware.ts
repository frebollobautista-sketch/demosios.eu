import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware de sesión + gating del "modo cerrado".
 *
 *  1. Refresca la sesión de Supabase en cada request (escribe las cookies
 *     rotadas en la respuesta). Hasta ahora faltaba, y `lib/supabase/server.ts`
 *     ya daba por hecho que existía.
 *  2. Onboarding obligatorio: si hay sesión y el perfil no ha completado el
 *     onboarding, redirige a /onboarding (salvo en rutas exentas).
 *
 * La lectura del feed sigue abierta; las ESCRITURAS ya están protegidas en las
 * server actions (Ágora/STOA) + RLS. Esto es la puerta de identidad, no un
 * muro de lectura.
 */

// Rutas donde NO forzamos onboarding (auth, legales, la propia onboarding…).
const EXENTAS = [
  "/onboarding",
  "/login",
  "/registro",
  "/recuperar",
  "/auth",
  "/invite",
  "/waitlist",
  "/legal",
  "/api",
];

function esExenta(path: string): boolean {
  return EXENTAS.some((p) => path === p || path.startsWith(p + "/"));
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

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
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANTE: getUser() revalida el token y dispara setAll → cookies frescas.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  if (user && !esExenta(path)) {
    const { data: perfil } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .single();

    if (perfil && perfil.onboarding_completed === false) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  // Excluye estáticos y assets; corre en todo lo demás.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml|woff2?)$).*)",
  ],
};
