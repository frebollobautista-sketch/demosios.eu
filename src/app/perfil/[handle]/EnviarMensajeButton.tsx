"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getOCrearConversacionDirecta } from "@/lib/mensajes/queries";

/**
 * Botón "Enviar mensaje" en perfil ajeno. Al click:
 *  · Si no hay sesión → redirige a /login con redirect al perfil.
 *  · Si hay sesión → busca/crea conversación directa con el otro user
 *    y redirige a /mensajes/[id].
 */
export function EnviarMensajeButton({
  otherUserId,
  authed,
  handle,
}: {
  otherUserId: string;
  authed: boolean;
  handle: string;
}) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    if (!authed) {
      router.push(
        `/login?redirect=${encodeURIComponent(`/perfil/${handle}`)}`,
      );
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const supabase = createClient();
      const { id } = await getOCrearConversacionDirecta(supabase, otherUserId);
      router.push(`/mensajes/${id}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "No se pudo abrir conversación.";
      setError(msg);
      setEnviando(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={enviando}
        className="px-4 py-2 rounded-md text-[0.9rem] font-semibold disabled:opacity-50"
        style={{
          background: "var(--color-ocre-deep)",
          color: "var(--color-surface)",
        }}
      >
        {enviando ? "Abriendo…" : `✉️ Enviar mensaje`}
      </button>
      {error && (
        <p
          className="text-[0.82rem] mt-2"
          style={{ color: "#a04030" }}
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
