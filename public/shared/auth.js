// shared/auth.js — cliente Supabase compartido para los apps estáticos
// (polis-app / agora-app / biblioteca-app).
//
// Replica EXACTAMENTE el modelo del sitio Next (src/app/registro):
//   signUp({ email, password, options: { data: { handle } } })
// El trigger `handle_new_user` crea la fila en `profiles` a partir del
// `handle` que va en raw_user_meta_data. NO insertamos en profiles a mano.
//
// La clave es la PUBLISHABLE key (pública por diseño; segura en cliente).
// La sesión la persiste supabase-js en localStorage del origen demosios.eu,
// así que se comparte entre los 3 apps y con el sitio Next (mismo origen).

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://zkezbitcvpjyxyyjilyx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_bLhkym6sQrj14i9TolHnpA_ccKo57OZ";

// Mismo validador que RegistroForm.tsx del sitio.
export const HANDLE_RE = /^[a-z0-9_]{3,30}$/;

let _client = null;
export function client() {
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "sb-ocre-auth",
      },
    });
  }
  return _client;
}

export async function getSession() {
  try {
    const { data } = await client().auth.getSession();
    return data?.session || null;
  } catch (e) {
    console.warn("[auth] getSession fallo:", e);
    return null;
  }
}

// Perfil de la persona logueada (handle + chrome básico). Devuelve null si
// no hay sesión o si RLS lo bloquea.
export async function getProfile() {
  const session = await getSession();
  if (!session) return null;
  try {
    const { data, error } = await client()
      .from("profiles")
      .select("handle, display_name, avatar_color")
      .eq("id", session.user.id)
      .maybeSingle();
    if (error) { console.warn("[auth] getProfile:", error.message); return null; }
    return data;
  } catch (e) {
    console.warn("[auth] getProfile fallo:", e);
    return null;
  }
}

// Suscripción a cambios de sesión. Devuelve la subscription (con .unsubscribe()).
export function onAuthChange(cb) {
  const { data } = client().auth.onAuthStateChange((_event, session) => cb(session));
  return data?.subscription;
}

export async function signUp({ email, password, handle }) {
  return client().auth.signUp({
    email,
    password,
    options: {
      data: { handle },
      emailRedirectTo: `${location.origin}/auth/callback`,
    },
  });
}

export async function signIn({ email, password }) {
  return client().auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return client().auth.signOut();
}
