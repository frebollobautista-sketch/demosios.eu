"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { crearComentario } from "@/lib/agora/queries";

/**
 * Form de respuesta a un hilo. Para v1 sin anidación: parent_id es null.
 * En v2 añadiremos respuesta a un comentario concreto.
 */
export function RespuestaForm({
  hiloId,
  authed,
}: {
  hiloId: string;
  authed: boolean;
}) {
  const router = useRouter();
  const [cuerpo, setCuerpo] = useState("");
  const [estado, setEstado] = useState<"idle" | "enviando" | "error">("idle");
  const [mensaje, setMensaje] = useState("");

  if (!authed) {
    return (
      <div
        className="rounded-lg p-4 text-center text-[0.92rem]"
        style={{
          background: "var(--color-papiro-soft)",
          border: "1px solid var(--color-linea)",
          color: "var(--color-piedra)",
        }}
      >
        <a
          href={`/login?redirect=${typeof window !== "undefined" ? encodeURIComponent(window.location.pathname) : ""}`}
          className="underline font-semibold"
          style={{ color: "var(--color-ocre-deep)" }}
        >
          Inicia sesión
        </a>{" "}
        para participar en este hilo.
      </div>
    );
  }

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = cuerpo.trim();
    if (t.length < 1 || t.length > 2000) {
      setEstado("error");
      setMensaje("El comentario debe tener entre 1 y 2000 caracteres.");
      return;
    }
    setEstado("enviando");
    setMensaje("");
    try {
      const supabase = createClient();
      await crearComentario(supabase, { hilo_id: hiloId, cuerpo: t });
      setCuerpo("");
      setEstado("idle");
      router.refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      setEstado("error");
      setMensaje(msg);
    }
  };

  return (
    <form onSubmit={enviar} className="space-y-3" noValidate>
      <div>
        <label
          className="flex items-baseline justify-between mb-1.5"
        >
          <span
            className="text-[0.85rem] font-semibold"
            style={{ color: "var(--color-papiro-ink)" }}
          >
            Tu respuesta
          </span>
          <span
            className="text-[0.75rem] tabular-nums"
            style={{ color: "var(--color-piedra-clara)" }}
          >
            {cuerpo.trim().length} / 2000
          </span>
        </label>
        <textarea
          required
          rows={4}
          value={cuerpo}
          onChange={(e) => setCuerpo(e.target.value)}
          placeholder="Aporta lo que sumes al hilo. Si no aporta, mejor un PEC."
          className="w-full rounded-md px-3 py-2 text-[0.95rem] leading-relaxed"
          style={{
            background: "var(--color-papiro)",
            border: "1px solid var(--color-linea)",
            color: "var(--color-papiro-ink)",
            outline: "none",
          }}
        />
      </div>

      {estado === "error" && (
        <p
          className="text-[0.88rem] rounded-md px-3 py-2"
          style={{
            background: "rgba(196, 90, 74, 0.08)",
            border: "1px solid rgba(196, 90, 74, 0.4)",
            color: "#a04030",
          }}
          role="alert"
        >
          {mensaje}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={estado === "enviando" || cuerpo.trim().length === 0}
          className="px-4 py-2 rounded-md text-[0.9rem] font-semibold disabled:opacity-50"
          style={{
            background: "var(--color-ocre-deep)",
            color: "var(--color-surface)",
          }}
        >
          {estado === "enviando" ? "Enviando…" : "Responder"}
        </button>
      </div>
    </form>
  );
}
