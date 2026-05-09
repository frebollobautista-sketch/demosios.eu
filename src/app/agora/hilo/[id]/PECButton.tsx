"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { togglePecHilo, togglePecComentario } from "@/lib/agora/queries";

/**
 * Botón PEC ("estoy de acuerdo") con optimistic update.
 * Funciona igual para hilo o comentario según `tipo`.
 *
 * Si no hay sesión, redirige a /login.
 */
export function PECButton({
  tipo,
  id,
  countInicial,
  dadoInicial,
  authed,
}: {
  tipo: "hilo" | "comentario";
  id: string;
  countInicial: number;
  dadoInicial: boolean;
  authed: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [count, setCount] = useState(countInicial);
  const [dado, setDado] = useState(dadoInicial);
  const [enviando, setEnviando] = useState(false);

  const click = async () => {
    if (!authed) {
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (enviando) return;

    // Optimistic UI
    const nuevoDado = !dado;
    setDado(nuevoDado);
    setCount((c) => c + (nuevoDado ? 1 : -1));
    setEnviando(true);

    try {
      const supabase = createClient();
      if (tipo === "hilo") {
        await togglePecHilo(supabase, id);
      } else {
        await togglePecComentario(supabase, id);
      }
      // El conteo real lo mantiene un trigger en la BD; en lugar de
      // releer aquí, dejamos que la próxima navegación o refresh sincronice.
      // Nuestro optimistic ya es consistente con la operación realizada.
      startTransition(() => {});
    } catch (e) {
      // Rollback
      setDado(dado);
      setCount(countInicial);
      console.warn("Toggle PEC falló:", e);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <button
      type="button"
      onClick={click}
      disabled={enviando}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[0.85rem] transition-colors disabled:opacity-60"
      style={{
        background: dado ? "var(--color-ocre-deep)" : "var(--color-papiro-soft)",
        color: dado ? "var(--color-surface)" : "var(--color-piedra)",
        border: "1px solid var(--color-linea)",
      }}
      aria-pressed={dado}
      aria-label={
        dado
          ? "Quitar PEC (estoy de acuerdo)"
          : "Dar PEC (estoy de acuerdo)"
      }
    >
      <span aria-hidden>🤝</span>
      <span className="tabular-nums">{count}</span>
    </button>
  );
}
