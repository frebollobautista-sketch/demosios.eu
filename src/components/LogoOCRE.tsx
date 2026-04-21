// Logo de Demosios by OCRE. Distinción importante:
//   · Demosios (δημόσιος, "público") es el nombre del PROYECTO / plataforma.
//   · OCRE es la ORGANIZACIÓN que lo sostiene.
// La columna jónica representa ambos: lo público y la organización.

export function LogoOCRE({
  size = 28,
  withText = true,
  compact = false,
  textColor = "var(--color-papiro-ink)",
}: {
  size?: number;
  withText?: boolean;
  /** Si true, solo muestra "Demosios" sin la banda "by OCRE". */
  compact?: boolean;
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
        <span className="inline-flex flex-col leading-none">
          <span
            className="display font-semibold"
            style={{
              color: textColor,
              fontSize: "1.05rem",
              letterSpacing: "0.04em",
            }}
          >
            Demosios
          </span>
          {!compact && (
            <span
              className="display italic"
              style={{
                color: "var(--color-piedra)",
                fontSize: "0.62rem",
                letterSpacing: "0.12em",
                marginTop: "2px",
              }}
            >
              by OCRE
            </span>
          )}
        </span>
      )}
    </span>
  );
}
