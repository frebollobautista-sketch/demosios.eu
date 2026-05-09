"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { marcarLeido } from "@/lib/mensajes/queries";

/**
 * Cliente que dispara `marcarLeido` al montar la página de detalle.
 * Así el badge de "no leídos" del buzón se limpia cuando el usuario
 * abre la conversación. Es fire-and-forget: el efecto silencia errores.
 */
export function MarcarLeidoOnLoad({ conversacionId }: { conversacionId: string }) {
  useEffect(() => {
    const supabase = createClient();
    marcarLeido(supabase, conversacionId).catch(() => {
      // Silencioso: no es crítico si falla. Reintenta al próximo render.
    });
  }, [conversacionId]);

  return null;
}
