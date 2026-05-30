/**
 * KOINOS · Input
 * --------------
 * Campo de texto base. Soporta texto, búsqueda con ícono, y estado de error.
 * Usa font-sans (Inter) por defecto; pásale className="font-mono" si es para
 * datos numéricos o IDs (cusec, etc.).
 *
 * Uso típico:
 *   <Input placeholder="Tu nombre" />
 *   <Input variant="search" placeholder="Buscar..." icon={<SearchIcon/>} />
 *   <Input error="cusec inválido" value={cusec} onChange={...} />
 *
 * Token: --line, --ocre, --terracotta, --volcanic, --piedra.
 */

import type { InputHTMLAttributes, ReactNode } from "react";

export type InputVariant = "text" | "search";

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  variant?: InputVariant;
  /** Mensaje de error mostrado debajo del input. Si está presente, marca borde rojo. */
  error?: string;
  /** Ícono a la izquierda. Recomendado tamaño 14-16px stroke="currentColor". */
  icon?: ReactNode;
  /** Etiqueta opcional encima del input. */
  label?: string;
}

export function Input({
  variant = "text",
  error,
  icon,
  label,
  className = "",
  id,
  ...rest
}: InputProps) {
  const inputId = id || (label ? `i-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined);
  const radius = variant === "search" ? "rounded-full" : "rounded-lg";
  const padLeft = icon ? "pl-9" : "pl-3.5";
  const errorClass = error
    ? "border-terracotta focus:border-terracotta focus:ring-terracotta/20"
    : "border-line focus:border-ocre focus:ring-ocre/20";

  return (
    <div className="w-full">
      {label ? (
        <label
          htmlFor={inputId}
          className="block text-[12px] text-piedra mb-1.5 font-sans"
        >
          {label}
        </label>
      ) : null}
      <div className="relative">
        {icon ? (
          <span
            aria-hidden
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ocre-dk pointer-events-none [&>svg]:w-3.5 [&>svg]:h-3.5"
          >
            {icon}
          </span>
        ) : null}
        <input
          id={inputId}
          {...rest}
          className={[
            "h-10 w-full pr-3.5 bg-white text-volcanic font-sans text-sm",
            "border-[0.5px] outline-none transition-colors duration-[120ms]",
            "placeholder:text-piedra-clara",
            "focus:border focus:ring-[3px]",
            radius,
            padLeft,
            errorClass,
            className,
          ].join(" ")}
        />
      </div>
      {error ? (
        <div className="mt-1.5 text-[12px] text-terracotta font-sans">{error}</div>
      ) : null}
    </div>
  );
}
