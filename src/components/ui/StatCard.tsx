/**
 * KOINOS · StatCard
 * -----------------
 * Tarjeta de estadística — número grande con eyebrow inferior. Dos formas:
 *   - simple   · número + label. Para grids de mini-stats (345 viviendas, etc.).
 *   - accent   · número + label + delta + franja izquierda con color semántico.
 *               Para resaltar cifras clave (renta media, % vacacional, etc.).
 *
 * El número siempre va en font-mono con tabular-nums — para que columnas
 * de StatCards alineen sus dígitos perfectamente.
 *
 * Uso típico:
 *   <StatCard value={345} label="Viviendas" />
 *   <StatCard value="28.450 €" label="Renta media" accent="ocre"
 *             delta={{ value: "+8,2% sobre 2022 · INE" }} />
 *
 * Token: --paper, --volcanic, --ocre-dk, --piedra, --terracotta, --laurel.
 */

import type { ReactNode } from "react";

export interface StatCardProps {
  value: ReactNode;
  label: string;
  /** Si presente, dibuja franja izquierda y aumenta tamaño del número. */
  accent?: "ocre" | "terracotta" | "laurel" | "blue-dk" | "gold";
  /** Cambio o delta mostrado debajo del valor. positive=true colorea laurel. */
  delta?: { value: string; positive?: boolean };
  className?: string;
}

const accentBorder: Record<NonNullable<StatCardProps["accent"]>, string> = {
  ocre: "border-l-[3px] border-ocre",
  terracotta: "border-l-[3px] border-terracotta",
  laurel: "border-l-[3px] border-laurel",
  "blue-dk": "border-l-[3px] border-blue-dk",
  gold: "border-l-[3px] border-gold",
};

export function StatCard({
  value,
  label,
  accent,
  delta,
  className = "",
}: StatCardProps) {
  const hasAccent = Boolean(accent);
  const valueSize = hasAccent ? "text-[28px]" : "text-2xl";

  return (
    <div
      className={[
        "bg-white rounded-lg p-4",
        hasAccent ? accentBorder[accent!] : "",
        hasAccent ? "rounded-l-none" : "",
        className,
      ].join(" ")}
    >
      {hasAccent ? (
        <div className="text-[11px] tracking-[0.18em] uppercase text-ocre-dk font-sans font-medium mb-1.5">
          {label}
        </div>
      ) : null}
      <div className={`${valueSize} font-mono text-volcanic leading-none tabular-nums`}>
        {value}
      </div>
      {!hasAccent ? (
        <div className="text-[11px] tracking-[0.18em] uppercase text-ocre-dk font-sans font-medium mt-1.5">
          {label}
        </div>
      ) : null}
      {delta ? (
        <div
          className={[
            "text-[12px] font-sans mt-1.5",
            delta.positive ? "text-laurel" : "text-piedra",
          ].join(" ")}
        >
          {delta.value}
        </div>
      ) : null}
    </div>
  );
}
