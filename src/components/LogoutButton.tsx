"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Botón de cerrar sesión. Llama a `supabase.auth.signOut()` y redirige
 * a la home tras éxito.
 *
 * Usable en dos formas según `variant`:
 *  - "menu": estilo entrada de dropdown (texto + sin fondo)
 *  - "button": estilo botón estándar
 */
export function LogoutButton({
  variant = "menu",
  onLoggedOut,
}: {
  variant?: "menu" | "button";
  onLoggedOut?: () => void;
}) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);

  const cerrarSesion = async () => {
    if (enviando) return;
    setEnviando(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      onLoggedOut?.();
      router.push("/");
      router.refresh();
    } catch (e) {
      console.warn("Error cerrando sesión:", e);
      setEnviando(false);
    }
  };

  if (variant === "button") {
    return (
      <button
        type="button"
        onClick={cerrarSesion}
        disabled={enviando}
        className="px-4 py-2 rounded-md text-[0.9rem] font-semibold disabled:opacity-50"
        style={{
          background: "var(--color-papiro-soft)",
          color: "var(--color-piedra)",
          border: "1px solid var(--color-linea)",
        }}
      >
        {enviando ? "Cerrando…" : "Cerrar sesión"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={cerrarSesion}
      disabled={enviando}
      role="menuitem"
      className="block w-full text-left px-4 py-2.5 text-[0.92rem] hover:bg-[var(--color-papiro-soft)] transition-colors disabled:opacity-50"
      style={{ color: "var(--color-piedra)" }}
    >
      {enviando ? "Cerrando sesión…" : "Cerrar sesión"}
    </button>
  );
}
