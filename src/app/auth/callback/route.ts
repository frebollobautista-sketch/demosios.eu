import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Callback de auth: Supabase envía al usuario aquí tras pulsar el magic link
 * o completar el OAuth. Intercambiamos el code por sesión y redirigimos.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirect = searchParams.get("redirect") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${redirect}`);
    }
  }

  // Si algo falla, a login con mensaje de error
  return NextResponse.redirect(`${origin}/login?error=callback`);
}
