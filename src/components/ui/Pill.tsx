/**
 * KOINOS · Pill
 * -------------
 * Chip / pill / tag para filtros, categorías y badges. Tres variantes:
 *   - default  · cream + border sand. Estado neutro.
 *   - active   · volcánico + paper. Filtro seleccionado.
 *   - category · color de la categoría KOINOS. Inmutable.
 *
 * Para variante category, pasa la prop `category` con uno de los nombres
 * (restauracion, comercio, alojamiento, salud, finanzas, residencial, publico).
 *
 * Uso típico:
 *   <Pill>Todos</Pill>
 *   <Pill active>Salud</Pill>
 *   <Pill category="restauracion">Restauración</Pill>
 *
 * Token: --cream, --sand, --volcanic, --paper, paleta categórica del sistema.
 */

import type { HTMLAttributes, ReactNode } from "react";

export type PillCategory =
  | "restauracion"
  | "comercio"
  | "alojamiento"
  | "salud"
  | "finanzas"
  | "residencial"
  | "publico"
  | "monumento";

export interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  active?: boolean;
  category?: PillCategory;
  /** Punto decorativo a la izquierda (típico en categorías). */
  withDot?: boolean;
}

/** Paleta categórica fijada en SISTEMA.md §2 — coherente con polis-juego. */
const categoryStyles: Record<PillCategory, { bg: string; text: string; dot: string }> = {
  restauracion: { bg: "#c85438", text: "#fbf4dd", dot: "#fbf4dd" },
  comercio:     { bg: "#3a5878", text: "#fbf4dd", dot: "#fbf4dd" },
  alojamiento:  { bg: "#6e2a1e", text: "#fbf4dd", dot: "#fbf4dd" },
  salud:        { bg: "#7c8a4a", text: "#fbf4dd", dot: "#fbf4dd" },
  finanzas:     { bg: "#d8a44a", text: "#221d18", dot: "#221d18" },
  residencial:  { bg: "#b07840", text: "#fbf4dd", dot: "#fbf4dd" },
  publico:      { bg: "#5b9aa8", text: "#fbf4dd", dot: "#fbf4dd" },
  monumento:    { bg: "#221d18", text: "#fbf4dd", dot: "#d8a44a" },
};

export function Pill({
  active,
  category,
  withDot,
  className = "",
  children,
  ...rest
}: PillProps) {
  const baseClass =
    "inline-flex items-center gap-1.5 h-7 px-3 rounded-full font-sans font-medium text-[12px] cursor-pointer transition-colors duration-[120ms] border-[0.5px]";

  if (category) {
    const c = categoryStyles[category];
    return (
      <span
        {...rest}
        className={[baseClass, "border-transparent", className].join(" ")}
        style={{ background: c.bg, color: c.text }}
      >
        {(withDot ?? true) ? (
          <span
            aria-hidden
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: c.dot }}
          />
        ) : null}
        {children}
      </span>
    );
  }

  if (active) {
    return (
      <span
        {...rest}
        className={[baseClass, "bg-volcanic text-paper border-volcanic", className].join(" ")}
      >
        {children}
      </span>
    );
  }

  return (
    <span
      {...rest}
      className={[
        baseClass,
        "bg-cream text-volcanic border-sand hover:border-ocre",
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}
