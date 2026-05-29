/**
 * KOINOS · Card
 * -------------
 * Contenedor base. Tres variantes:
 *   - surface  · misma capa que el bg, sin elevación. Para cards sobre cream.
 *   - elevated · blanco + sombra sutil. Para cards sobre paper.
 *   - outlined · blanco + borde 0.5px. Para listas y cards en grids densos.
 *
 * Padding: tight | default | generous. Si necesitas otro, pásalo
 * con className y asume que estás saliéndote del sistema.
 *
 * Token: --paper, --cream, --line, sombra --shadow-sutil.
 */

import type { HTMLAttributes } from "react";

export type CardVariant = "surface" | "elevated" | "outlined";
export type CardPadding = "tight" | "default" | "generous" | "none";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
  /** Marca de color en el borde izquierdo — útil en stat-cards y resaltes. */
  accent?: "ocre" | "terracotta" | "laurel" | "blue-dk" | "gold";
}

const variantClass: Record<CardVariant, string> = {
  surface: "bg-paper",
  elevated: "bg-white shadow-[0_1px_2px_rgba(34,29,24,0.06)]",
  outlined: "bg-white border-[0.5px] border-line",
};

const paddingClass: Record<CardPadding, string> = {
  none: "",
  tight: "p-3",
  default: "p-5",
  generous: "p-6",
};

const accentClass: Record<NonNullable<CardProps["accent"]>, string> = {
  ocre: "border-l-[3px] border-ocre",
  terracotta: "border-l-[3px] border-terracotta",
  laurel: "border-l-[3px] border-laurel",
  "blue-dk": "border-l-[3px] border-blue-dk",
  gold: "border-l-[3px] border-gold",
};

export function Card({
  variant = "outlined",
  padding = "default",
  accent,
  className = "",
  children,
  ...rest
}: CardProps) {
  return (
    <div
      {...rest}
      className={[
        "rounded-xl",
        variantClass[variant],
        paddingClass[padding],
        accent ? accentClass[accent] : "",
        // Si hay accent, anulamos el border-radius del lado izquierdo para que
        // la franja quede limpia (ver SISTEMA.md §1, regla de border-l-only).
        accent ? "rounded-l-none" : "",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}
