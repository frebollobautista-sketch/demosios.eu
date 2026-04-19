"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/auth/useSession";

/**
 * Botón que requiere sesión activa para interactuar.
 *
 * Cuando hay usuario: se comporta como un botón normal y ejecuta `onAction`.
 * Cuando no hay usuario: queda visible pero inerte, cambia su etiqueta y
 * al clicar muestra un tooltip/mensaje breve con un enlace a `/login` y
 * `/registro`.
 *
 * Patrón "visible pero inerte" para no ocultar las funcionalidades de la
 * plataforma a lectores anónimos — que vean qué pasará si se registran.
 */
export function CTAProtegido({
  etiqueta,
  etiquetaAnonimo,
  razon,
  onAction,
  tamano = "md",
  variant = "primary",
}: {
  etiqueta: string;
  /** Etiqueta alternativa cuando el usuario es anónimo. Si se omite, se usa `etiqueta`. */
  etiquetaAnonimo?: string;
  /** Frase corta que explica por qué hace falta cuenta. */
  razon: string;
  onAction?: () => void;
  tamano?: "sm" | "md";
  variant?: "primary" | "ghost";
}) {
  const { user, cargando } = useSession();
  const [mostrarMensaje, setMostrarMensaje] = useState(false);

  const tieneSesion = !!user;
  const padding = tamano === "sm" ? "px-3 py-1.5" : "px-3 py-2";
  const tamanoFuente = tamano === "sm" ? "text-[0.85rem]" : "text-[0.88rem]";

  const estilos =
    variant === "primary"
      ? {
          background: "var(--color-ocre-deep)",
          color: "var(--color-surface)",
        }
      : {
          background: "var(--color-surface)",
          border: "1px solid var(--color-linea)",
          color: "var(--color-papiro-ink)",
        };

  if (cargando) {
    return (
      <button
        disabled
        className={`shrink-0 rounded-md ${padding} ${tamanoFuente} font-semibold opacity-60`}
        style={estilos}
      >
        {etiqueta}
      </button>
    );
  }

  if (tieneSesion) {
    return (
      <button
        onClick={onAction}
        className={`shrink-0 rounded-md ${padding} ${tamanoFuente} font-semibold`}
        style={estilos}
      >
        {etiqueta}
      </button>
    );
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setMostrarMensaje((v) => !v)}
        className={`shrink-0 rounded-md ${padding} ${tamanoFuente} font-semibold`}
        style={{
          ...estilos,
          opacity: 0.6,
          cursor: "help",
        }}
        aria-describedby="cta-protegido-msg"
      >
        {etiquetaAnonimo ?? etiqueta}
      </button>
      {mostrarMensaje && (
        <div
          id="cta-protegido-msg"
          role="tooltip"
          className="absolute z-20 left-0 top-full mt-2 w-[260px] rounded-lg p-3 flotante-sombra"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-linea)",
          }}
        >
          <p
            className="text-[0.82rem]"
            style={{ color: "var(--color-papiro-ink)" }}
          >
            {razon}
          </p>
          <div className="mt-2 flex gap-2">
            <Link
              href="/login"
              className="text-[0.82rem] font-semibold px-2 py-1 rounded-md"
              style={{
                background: "var(--color-papiro-soft)",
                color: "var(--color-papiro-ink)",
              }}
            >
              Entrar
            </Link>
            <Link
              href="/registro"
              className="text-[0.82rem] font-semibold px-2 py-1 rounded-md"
              style={{
                background: "var(--color-ocre-deep)",
                color: "var(--color-surface)",
              }}
            >
              Crear cuenta
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
