"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/**
 * Hook cliente para leer la sesión actual. Devuelve `user = null`
 * durante el estado inicial y cuando no hay sesión. Si hay usuario,
 * devuelve el objeto `User` de Supabase.
 *
 * No lo uses en layouts server-rendered; para eso, llama directamente
 * a `createClient()` del módulo `server.ts`.
 */
export function useSession(): { user: User | null; cargando: boolean } {
  const [user, setUser] = useState<User | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let activo = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!activo) return;
      setUser(data.user ?? null);
      setCargando(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!activo) return;
      setUser(session?.user ?? null);
    });

    return () => {
      activo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, cargando };
}
