"use client";

// ─── POLIS · Juego: toast animado de ganancia de PEC ──────────────

import { COLOR_EJE_JUEGO } from "@/lib/polis-juego/paletas";
import type { PuntosJuego } from "@/lib/polis-juego/tipos";

export function ToastPEC({
  ejePrincipal,
  pec,
  mensaje,
}: {
  ejePrincipal: "exploracion" | "calibrado" | "recuperacion";
  pec: PuntosJuego;
  mensaje: string;
}) {
  const meta = COLOR_EJE_JUEGO[ejePrincipal];
  const total = pec.exploracion + pec.calibrado + pec.recuperacion;
  return (
    <div
      className="rounded-full px-4 py-2 flex items-center gap-3 shadow-md pointer-events-auto"
      style={{
        background: "var(--color-surface)",
        border: `1px solid ${meta.hex}`,
        animation: "toastEntrar 280ms ease-out, toastSalir 480ms ease-in 3s forwards",
        boxShadow: "var(--shadow-carta)",
      }}
    >
      <span
        className="display"
        style={{
          color: meta.hex,
          fontWeight: 600,
          fontSize: "1rem",
          minWidth: 28,
          textAlign: "center",
        }}
      >
        +{total}
      </span>
      <span
        style={{
          height: 18,
          width: 1,
          background: "var(--color-linea)",
        }}
      />
      <span
        className="text-[0.82rem]"
        style={{ color: "var(--color-papiro-ink)" }}
      >
        {mensaje}
      </span>
      <style jsx>{`
        @keyframes toastEntrar {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes toastSalir {
          to {
            opacity: 0;
            transform: translateY(-4px);
          }
        }
      `}</style>
    </div>
  );
}
