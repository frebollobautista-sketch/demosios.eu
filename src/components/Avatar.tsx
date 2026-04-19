// Avatar sobrio: círculo con inicial. El "atributo" del grado
// (la pequeña marca romana/griega) se renderiza encima como insignia.

import type { Grado } from "@/lib/cursus/grados";

export function Avatar({
  inicial,
  color,
  grado,
  size = 40,
  mostrarGrado = true,
}: {
  inicial: string;
  color: string;
  grado?: Grado;
  size?: number;
  mostrarGrado?: boolean;
}) {
  const fontSize = Math.round(size * 0.42);

  return (
    <span
      className="relative inline-flex items-center justify-center rounded-full font-semibold select-none"
      style={{
        width: size,
        height: size,
        background: color,
        color: "#FBF7EC",
        boxShadow:
          "inset 0 0 0 1px rgba(255,255,255,0.25), 0 1px 2px rgba(0,0,0,0.12)",
        fontSize,
        letterSpacing: "0.02em",
      }}
      aria-hidden
    >
      {inicial.toUpperCase()}
      {mostrarGrado && grado && (
        <span
          className="absolute -bottom-1 -right-1 inline-flex items-center justify-center rounded-full"
          style={{
            width: Math.round(size * 0.42),
            height: Math.round(size * 0.42),
            background: "var(--color-surface)",
            color: grado.color,
            border: "1px solid var(--color-linea)",
            fontFamily: "var(--font-serif-stack)",
            fontSize: Math.round(size * 0.24),
            lineHeight: 1,
            fontWeight: 700,
          }}
          title={`${grado.nombre} — ${grado.traduccion}`}
        >
          {grado.atributo}
        </span>
      )}
    </span>
  );
}
