// Renderiza un avatar DiceBear a partir de su receta. Síncrono y determinista,
// vale tanto en componentes de servidor como de cliente (el editor lo usa para
// la vista previa en vivo).

import { renderAvatarSVG, type AvatarReceta as Receta } from "@/lib/avatar/receta";

export function AvatarReceta({
  receta,
  size = 96,
  className,
  title,
}: {
  receta: Receta;
  size?: number;
  className?: string;
  title?: string;
}) {
  const svg = renderAvatarSVG(receta, size);
  return (
    <span
      className={className}
      title={title}
      role="img"
      aria-label={title || "Avatar"}
      style={{
        display: "inline-block",
        width: size,
        height: size,
        lineHeight: 0,
        borderRadius: "50%",
        overflow: "hidden",
      }}
      // El SVG lo genera DiceBear a partir de datos controlados (no entrada
      // libre del usuario), por eso es seguro inyectarlo.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
