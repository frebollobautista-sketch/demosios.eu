"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { crearPost } from "@/lib/stoa/queries";

const MAX = 280;

/**
 * Compose box para STOA. Se ancla arriba del feed.
 * Sin sesión muestra invitación a /login. Con sesión muestra textarea
 * con contador y botón Publicar.
 *
 * Decisión: max 280 chars (estilo Twitter clásico) aunque la tabla
 * permite hasta 2000. Si es más, mejor es un hilo de Ágora.
 */
export function Compose({ authed }: { authed: boolean }) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!authed) {
    return (
      <div
        className="rounded-xl p-4 mb-6"
        style={{
          background: "var(--color-papiro-soft)",
          border: "1px solid var(--color-linea)",
        }}
      >
        <p
          className="text-[0.92rem] text-center"
          style={{ color: "var(--color-piedra)" }}
        >
          <Link
            href="/login?redirect=/stoa"
            className="underline font-semibold"
            style={{ color: "var(--color-ocre-deep)" }}
          >
            Inicia sesión
          </Link>{" "}
          para publicar en el patio.
        </p>
      </div>
    );
  }

  const t = texto.trim();
  const ok = t.length > 0 && t.length <= MAX;
  const restantes = MAX - t.length;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const supabase = createClient();
      await crearPost(supabase, { text: t });
      setTexto("");
      router.refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      setError(msg);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form
      onSubmit={enviar}
      className="rounded-xl p-4 mb-6"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-linea)",
      }}
    >
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={3}
        placeholder="¿Qué pasa hoy en el barrio?"
        className="w-full text-[1rem] resize-none px-1 py-1"
        style={{
          background: "transparent",
          color: "var(--color-papiro-ink)",
          outline: "none",
          border: "none",
          lineHeight: 1.5,
        }}
        disabled={enviando}
      />
      {error && (
        <p
          className="text-[0.85rem] rounded-md px-3 py-2 mt-2"
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
      <div
        className="flex items-center justify-between gap-2 mt-2 pt-2"
        style={{ borderTop: "1px solid var(--color-linea)" }}
      >
        <span
          className="text-[0.78rem] tabular-nums"
          style={{
            color:
              restantes < 0
                ? "#a04030"
                : restantes < 30
                  ? "var(--color-ocre-deep)"
                  : "var(--color-piedra-clara)",
            fontWeight: restantes < 30 ? 600 : 400,
          }}
          aria-live="polite"
        >
          {restantes}
        </span>
        <button
          type="submit"
          disabled={!ok || enviando}
          className="px-4 py-1.5 rounded-md text-[0.88rem] font-semibold disabled:opacity-50"
          style={{
            background: "var(--color-ocre-deep)",
            color: "var(--color-surface)",
          }}
        >
          {enviando ? "Publicando…" : "Publicar"}
        </button>
      </div>
    </form>
  );
}
