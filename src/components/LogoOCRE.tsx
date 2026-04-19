// Logo discreto de OCRE: una columna jónica mínima más el rótulo.
// Todo en SVG inline para que el color herede de la paleta.

export function LogoOCRE({
  size = 28,
  withText = true,
  textColor = "var(--color-papiro-ink)",
}: {
  size?: number;
  withText?: boolean;
  textColor?: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-2.5"
      style={{ color: "var(--color-ocre-deep)" }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 28 28"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* capitel */}
        <path d="M6 4h16" />
        <path d="M8 7h12" />
        {/* fuste con acanaladuras */}
        <path d="M10 7v14" />
        <path d="M14 7v14" />
        <path d="M18 7v14" />
        {/* basa */}
        <path d="M7 21h14" />
        <path d="M5 24h18" />
      </svg>
      {withText && (
        <span
          className="display text-[1.05rem] tracking-[0.22em] font-semibold"
          style={{ color: textColor }}
        >
          OCRE
        </span>
      )}
    </span>
  );
}
