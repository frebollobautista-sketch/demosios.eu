"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { enviarMensaje } from "@/lib/mensajes/queries";

/**
 * Input para enviar mensaje en una conversación.
 * Tras enviar limpia el texto y refresca la página (Server Component
 * de mensajes recarga la lista). En iteración 2 cambiaremos a Realtime
 * de Supabase para que aparezca al instante sin refresh.
 */
export function MensajeForm({ conversacionId }: { conversacionId: string }) {
  const router = useRouter();
  const [cuerpo, setCuerpo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = cuerpo.trim();
    if (!t || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const supabase = createClient();
      await enviarMensaje(supabase, conversacionId, t);
      setCuerpo("");
      router.refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      setError(msg);
    } finally {
      setEnviando(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Shift+Enter inserta línea, Enter envía
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviar(e as unknown as React.FormEvent);
    }
  };

  return (
    <form onSubmit={enviar} className="space-y-2">
      <textarea
        value={cuerpo}
        onChange={(e) => setCuerpo(e.target.value)}
        onKeyDown={onKeyDown}
        rows={2}
        maxLength={2000}
        placeholder="Escribe un mensaje (Enter envía, Shift+Enter salta línea)…"
        className="w-full rounded-md px-3 py-2 text-[0.95rem] resize-none"
        style={{
          background: "var(--color-papiro)",
          border: "1px solid var(--color-linea)",
          color: "var(--color-papiro-ink)",
          outline: "none",
          lineHeight: 1.5,
        }}
        disabled={enviando}
      />
      {error && (
        <p
          className="text-[0.82rem] rounded-md px-3 py-2"
          style={{
            background: "rgba(196, 90, 74, 0.08)",
            border: "1px solid rgba(196, 90, 74, 0.4)",
            color: "#a04030",
          }}
          role="alert"
        >
          {error}
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[0.75rem] tabular-nums"
          style={{ color: "var(--color-piedra-clara)" }}
        >
          {cuerpo.trim().length} / 2000
        </span>
        <button
          type="submit"
          disabled={enviando || cuerpo.trim().length === 0}
          className="px-4 py-2 rounded-md text-[0.88rem] font-semibold disabled:opacity-50"
          style={{
            background: "var(--color-ocre-deep)",
            color: "var(--color-surface)",
          }}
        >
          {enviando ? "Enviando…" : "Enviar"}
        </button>
      </div>
    </form>
  );
}
