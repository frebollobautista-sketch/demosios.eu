"use client";

import { useState } from "react";
import { renderAvatarSVG, type AvatarReceta } from "@/lib/avatar/receta";

/**
 * Avatar de visualización: muestra SIEMPRE el muñeco generativo por defecto, y
 * solo revela la foto de perfil (si la persona subió una) cuando el usuario
 * "posa el dedo" encima: hover en escritorio, mantener pulsado en móvil, o foco
 * por teclado. Quien no tenga foto, se queda con el muñeco.
 */
export function AvatarInteractivo({
  receta,
  fotoUrl,
  nombre,
  size = 96,
  className,
}: {
  receta: AvatarReceta;
  fotoUrl?: string | null;
  nombre?: string;
  size?: number;
  className?: string;
}) {
  const [revelado, setRevelado] = useState(false);
  const svg = renderAvatarSVG(receta, size);
  const tieneFoto = !!fotoUrl;

  const mostrar = () => tieneFoto && setRevelado(true);
  const ocultar = () => setRevelado(false);

  return (
    <span
      className={className}
      role="img"
      aria-label={nombre ? `Avatar de ${nombre}` : "Avatar"}
      title={
        tieneFoto
          ? `Mantén el cursor o pulsa para ver la foto${nombre ? ` de ${nombre}` : ""}`
          : nombre
      }
      tabIndex={tieneFoto ? 0 : -1}
      onMouseEnter={mostrar}
      onMouseLeave={ocultar}
      onFocus={mostrar}
      onBlur={ocultar}
      onTouchStart={mostrar}
      onTouchEnd={ocultar}
      onTouchCancel={ocultar}
      style={{
        position: "relative",
        display: "inline-block",
        width: size,
        height: size,
        lineHeight: 0,
        borderRadius: "50%",
        overflow: "hidden",
        border: "1px solid var(--color-linea)",
        cursor: tieneFoto ? "pointer" : "default",
        userSelect: "none",
        WebkitTouchCallout: "none",
      }}
    >
      {/* Capa base: muñeco generativo */}
      <span
        aria-hidden
        style={{ position: "absolute", inset: 0 }}
        // SVG generado por DiceBear a partir de datos controlados.
        dangerouslySetInnerHTML={{ __html: svg }}
      />

      {/* Capa foto: solo si hay foto; aparece al revelar */}
      {tieneFoto && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fotoUrl as string}
            alt={nombre ? `Foto de ${nombre}` : "Foto de perfil"}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: revelado ? 1 : 0,
              transition: "opacity 160ms ease",
              pointerEvents: "none",
            }}
          />
          {/* Indicador discreto de que hay foto detrás */}
          <span
            aria-hidden
            style={{
              position: "absolute",
              right: Math.max(3, Math.round(size * 0.04)),
              bottom: Math.max(3, Math.round(size * 0.04)),
              width: Math.max(8, Math.round(size * 0.14)),
              height: Math.max(8, Math.round(size * 0.14)),
              borderRadius: "50%",
              background: "var(--color-surface, #fff)",
              border: "1px solid var(--color-linea)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: Math.max(6, Math.round(size * 0.09)),
              opacity: revelado ? 0 : 0.9,
              transition: "opacity 160ms ease",
            }}
          >
            📷
          </span>
        </>
      )}
    </span>
  );
}
