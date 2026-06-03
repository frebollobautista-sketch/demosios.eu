"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { bloquear, desbloquear, estaBloqueado } from "@/lib/bloqueos/api";

/**
 * Botón para bloquear / desbloquear a otro usuario desde su perfil.
 *
 * - Sin sesión: no se muestra (lo decide la página padre con `authed`).
 * - Comprueba el estado inicial al montar.
 * - Si la tabla `bloqueos` aún no existe (migración pendiente), muestra un
 *   aviso discreto en lugar de romper.
 */
export function BloquearButton({
  otherUserId,
  handle,
}: {
  otherUserId: string;
  handle: string;
}) {
  const [cargando, setCargando] = useState(true);
  const [bloqueado, setBloqueado] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    estaBloqueado(supabase, otherUserId).then((b) => {
      setBloqueado(b);
      setCargando(false);
    });
  }, [otherUserId]);

  const toggle = async () => {
    setProcesando(true);
    setAviso(null);
    const supabase = createClient();
    const res = bloqueado
      ? await desbloquear(supabase, otherUserId)
      : await bloquear(supabase, otherUserId);

    if (res.ok) {
      setBloqueado(!bloqueado);
    } else if (res.razon === "no-disponible") {
      setAviso("El bloqueo aún no está disponible. Inténtalo más tarde.");
    } else {
      setAviso("No se pudo completar la acción. Inténtalo de nuevo.");
    }
    setProcesando(false);
  };

  if (cargando) return null;

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        disabled={procesando}
        className="px-4 py-2 rounded-md text-[0.88rem] font-medium disabled:opacity-50"
        style={{
          background: "transparent",
          border: `1px solid ${bloqueado ? "var(--color-linea)" : "#a04030"}`,
          color: bloqueado ? "var(--color-piedra)" : "#a04030",
        }}
      >
        {procesando
          ? "…"
          : bloqueado
            ? `Desbloquear a @${handle}`
            : `Bloquear a @${handle}`}
      </button>
      {bloqueado && (
        <p
          className="text-[0.78rem] mt-1"
          style={{ color: "var(--color-piedra-clara)" }}
        >
          No verás sus mensajes ni podrá escribirte.
        </p>
      )}
      {aviso && (
        <p className="text-[0.8rem] mt-1" style={{ color: "#a04030" }} role="alert">
          {aviso}
        </p>
      )}
    </div>
  );
}
