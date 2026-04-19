"use client";

import { useState } from "react";
import { IconMail, IconClose } from "./Icons";

/**
 * Banner inferior de suscripción al correo de OCRE.
 * Componente controlado: el estado abierto/cerrado vive en el Shell
 * para evitar setState sincrónico dentro de useEffect (regla de React 19).
 *
 * · En móvil: ocupa solo la parte inferior, no molesta.
 * · Colapsable a un único icono flotante (lado izquierdo).
 * · La persistencia en localStorage la gestiona el Shell con
 *   useSyncExternalStore (ver Shell.tsx).
 */
export function BannerSuscripcion({
  abierto,
  onAbrir,
  onCerrar,
}: {
  abierto: boolean;
  onAbrir: () => void;
  onCerrar: () => void;
}) {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);

  const enviar = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!email) return;
    // TODO: cablear a Supabase / Resend. Por ahora marcamos enviado.
    setEnviado(true);
    setTimeout(() => {
      onCerrar();
      // reset tras cerrar para que abrir de nuevo sea estado limpio
      setTimeout(() => {
        setEnviado(false);
        setEmail("");
      }, 400);
    }, 1400);
  };

  if (!abierto) {
    return (
      <button
        onClick={onAbrir}
        aria-label="Abrir suscripción al correo"
        title="Suscribirse al boletín"
        className="fixed left-4 bottom-4 z-30 inline-flex h-11 w-11 items-center justify-center rounded-full flotante-sombra"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-linea)",
          color: "var(--color-ocre-deep)",
        }}
      >
        <IconMail />
      </button>
    );
  }

  return (
    <div
      role="region"
      aria-label="Suscripción al boletín"
      className="fixed inset-x-0 bottom-0 z-30 md:inset-x-auto md:left-4 md:bottom-4 md:w-[360px]"
    >
      <div
        className="mx-auto max-w-xl md:max-w-none rounded-t-2xl md:rounded-2xl flotante-sombra"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-linea)",
          borderBottom: 0,
        }}
      >
        <div className="flex items-start gap-3 p-3 md:p-4">
          <span
            className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full shrink-0"
            style={{
              background: "var(--color-papiro-soft)",
              color: "var(--color-ocre-deep)",
            }}
          >
            <IconMail />
          </span>
          <div className="min-w-0 flex-1">
            <p
              className="display text-[0.98rem]"
              style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
            >
              Boletín de OCRE
            </p>
            <p
              className="text-[0.82rem]"
              style={{ color: "var(--color-piedra)" }}
            >
              Espacios recuperados, nuevas cohortes del cursus, convocatorias de asamblea.
            </p>
          </div>
          <button
            onClick={onCerrar}
            aria-label="Cerrar suscripción"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md"
            style={{ color: "var(--color-piedra)" }}
          >
            <IconClose />
          </button>
        </div>
        <form
          onSubmit={enviar}
          className="flex items-center gap-2 px-3 pb-3 md:pb-4 md:px-4"
        >
          <input
            type="email"
            required
            value={email}
            disabled={enviado}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.es"
            className="flex-1 h-10 rounded-md px-3 text-[0.9rem] outline-none"
            style={{
              background: "var(--color-papiro)",
              border: "1px solid var(--color-linea)",
              color: "var(--color-papiro-ink)",
            }}
          />
          <button
            type="submit"
            disabled={enviado || !email}
            className="h-10 rounded-md px-3 text-[0.85rem] font-semibold transition-opacity disabled:opacity-60"
            style={{
              background: "var(--color-ocre-deep)",
              color: "var(--color-surface)",
            }}
          >
            {enviado ? "Gracias ✓" : "Suscribirme"}
          </button>
        </form>
        <p
          className="px-3 md:px-4 pb-3 text-[0.72rem]"
          style={{ color: "var(--color-piedra-clara)" }}
        >
          Sin cesión a terceros. Darte de baja en cualquier momento.
        </p>
      </div>
    </div>
  );
}
