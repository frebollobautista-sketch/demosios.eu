"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  buscarUsuarios,
  getOCrearConversacionDirecta,
} from "@/lib/mensajes/queries";

type Resultado = {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
};

/**
 * Busca usuarios por handle/display_name. Click en uno → busca o crea
 * conversación directa y redirige a /mensajes/[id].
 */
export function BuscadorUsuarios({ miId }: { miId: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buscar = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) {
      setError("Escribe al menos 2 caracteres.");
      return;
    }
    setBuscando(true);
    setError(null);
    try {
      const supabase = createClient();
      const r = await buscarUsuarios(supabase, q, miId);
      setResultados(r);
      if (r.length === 0) setError(`Nadie encontrado para "${q}".`);
    } catch (e) {
      console.warn(e);
      setError("Error al buscar.");
    } finally {
      setBuscando(false);
    }
  };

  const empezarConversacion = async (otherId: string) => {
    setBuscando(true);
    setError(null);
    try {
      const supabase = createClient();
      const { id } = await getOCrearConversacionDirecta(supabase, otherId);
      router.push(`/mensajes/${id}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      setError(msg);
      setBuscando(false);
    }
  };

  return (
    <div>
      <form onSubmit={buscar} className="flex gap-2 mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Busca por handle (ej. tito) o nombre"
          className="flex-1 rounded-md px-3 py-2 text-[0.95rem]"
          style={{
            background: "var(--color-papiro)",
            border: "1px solid var(--color-linea)",
            color: "var(--color-papiro-ink)",
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={buscando || query.trim().length < 2}
          className="px-4 py-2 rounded-md text-[0.88rem] font-semibold disabled:opacity-50"
          style={{
            background: "var(--color-ocre-deep)",
            color: "var(--color-surface)",
          }}
        >
          {buscando ? "…" : "Buscar"}
        </button>
      </form>

      {error && (
        <p
          className="text-[0.85rem] rounded-md px-3 py-2 mb-3"
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

      {resultados.length > 0 && (
        <ul className="space-y-2">
          {resultados.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => empezarConversacion(u.id)}
                disabled={buscando}
                className="w-full text-left rounded-lg p-3 transition-colors hover:opacity-90 disabled:opacity-50"
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-linea)",
                }}
              >
                <div
                  className="text-[0.95rem]"
                  style={{
                    color: "var(--color-papiro-ink)",
                    fontWeight: 600,
                  }}
                >
                  @{u.handle}
                  {u.display_name && (
                    <span
                      className="ml-2 font-normal"
                      style={{ color: "var(--color-piedra)" }}
                    >
                      · {u.display_name}
                    </span>
                  )}
                </div>
                <div
                  className="text-[0.78rem] mt-0.5"
                  style={{ color: "var(--color-piedra-clara)" }}
                >
                  Iniciar conversación →
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
