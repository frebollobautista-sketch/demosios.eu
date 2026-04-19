"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

export function TogglePrivacidad({
  userId,
  inicial,
}: {
  userId: string;
  inicial: boolean;
}) {
  const [publico, setPublico] = useState(inicial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = () => {
    const siguiente = !publico;
    setPublico(siguiente);
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { error: e } = await supabase
        .from("profiles")
        .update({ is_public: siguiente })
        .eq("id", userId);
      if (e) {
        setPublico(publico); // revertir
        setError(e.message);
      }
    });
  };

  const privado = !publico;
  const fondo = privado ? "#F0DED3" : "#DEE6D0";
  const color = privado ? "var(--color-siena)" : "var(--color-oliva)";

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className="w-full rounded-xl p-4 flex items-center gap-3 text-left transition-opacity disabled:opacity-70"
      style={{
        background: "var(--color-surface)",
        border: `1px solid var(--color-linea)`,
      }}
      aria-pressed={publico}
    >
      <span
        aria-hidden
        className="shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-md"
        style={{ background: fondo, color }}
      >
        {privado ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="10" width="16" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 018 0v3" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="10" width="16" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 017.5-2" />
          </svg>
        )}
      </span>
      <span className="flex-1 min-w-0">
        <span
          className="block text-[0.95rem] font-semibold"
          style={{ color: "var(--color-papiro-ink)" }}
        >
          Perfil {publico ? "público" : "privado"}
        </span>
        <span
          className="block text-[0.82rem]"
          style={{ color: "var(--color-piedra)" }}
        >
          {publico
            ? "Visible en Ágora, Bibliotheka y Polis."
            : "Solo te ven quienes tú aceptes."}
        </span>
        {error && (
          <span
            className="block text-[0.78rem] mt-1"
            style={{ color: "var(--color-sangre)" }}
          >
            {error}
          </span>
        )}
      </span>
      <span
        aria-hidden
        className="shrink-0 relative inline-block"
        style={{
          width: "2.25rem",
          height: "1.25rem",
          borderRadius: "999px",
          background: publico ? "var(--color-oliva)" : "var(--color-papiro-soft)",
          border: "1px solid var(--color-linea)",
          transition: "background 0.2s",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 1,
            left: publico ? "calc(100% - 1.0625rem - 1px)" : 1,
            width: "1rem",
            height: "1rem",
            borderRadius: "999px",
            background: "var(--color-surface)",
            boxShadow: "0 1px 2px rgba(0,0,0,.15)",
            transition: "left 0.2s",
          }}
        />
      </span>
    </button>
  );
}
