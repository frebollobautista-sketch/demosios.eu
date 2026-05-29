/**
 * KOINOS · Button
 * ---------------
 * Botón base del sistema. Cuatro variantes (primary, secondary, ghost, danger)
 * y tres tamaños (sm, md, lg). Acepta cualquier prop nativa de <button>.
 *
 * Uso típico:
 *   <Button variant="primary">Confirmar</Button>
 *   <Button variant="secondary" size="sm">Cancelar</Button>
 *   <Button variant="danger" onClick={borrar}>Eliminar</Button>
 *
 * Token: consume --ocre, --paper, --volcanic, --line, --cream, --terracotta
 * via Tailwind utilities (bg-ocre, text-paper, etc.).
 */

import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Contenido al inicio del botón — habitualmente un ícono iso 16. */
  leadingIcon?: ReactNode;
  /** Contenido al final del botón. */
  trailingIcon?: ReactNode;
}

const variantClass: Record<ButtonVariant, string> = {
  primary:
    "bg-ocre text-paper border-ocre hover:bg-ocre-dk hover:border-ocre-dk",
  secondary:
    "bg-white text-volcanic border-line hover:bg-cream",
  ghost:
    "bg-transparent text-ocre border-transparent hover:bg-cream",
  danger:
    "bg-transparent text-terracotta border-terracotta hover:bg-terracotta hover:text-paper",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px] rounded-md gap-1.5",
  md: "h-10 px-4 text-sm rounded-lg gap-2",
  lg: "h-12 px-6 text-base rounded-lg gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  leadingIcon,
  trailingIcon,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const disabledClass = disabled
    ? "bg-cream text-piedra-clara border-cream cursor-not-allowed hover:bg-cream hover:text-piedra-clara"
    : "cursor-pointer";

  return (
    <button
      {...rest}
      disabled={disabled}
      className={[
        "inline-flex items-center justify-center font-sans font-medium",
        "border-[0.5px] transition-colors duration-[240ms]",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ocre/25",
        sizeClass[size],
        variantClass[variant],
        disabledClass,
        className,
      ].join(" ")}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  );
}
