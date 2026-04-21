// Logo de "Demos iOS" by OCRE. Doble lectura deliberada:
//   · Para quien sabe griego: δημόσιος ("público") → nombre propio clásico.
//   · Para cualquiera: "Demos iOS" → sistema operativo del demos (del pueblo).
// OCRE es la ORGANIZACIÓN que sostiene la plataforma.
//
// El icono es un faro: referencia a PHAROS (el legado del que OCRE parte —
// la famosa torre de Alejandría dio nombre a los faros) y, a la vez, símbolo
// canario de primer orden. Una baliza civil que marca el camino.

export function LogoOCRE({
  size = 28,
  withText = true,
  compact = false,
  textColor = "var(--color-papiro-ink)",
}: {
  size?: number;
  withText?: boolean;
  /** Si true, solo muestra "Demos iOS" sin la banda "by OCRE". */
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
        aria-label="Faro"
      >
        {/* rayos de luz saliendo del lampara */}
        <path d="M8 5l-2-2" opacity="0.55" />
        <path d="M20 5l2-2" opacity="0.55" />
        <path d="M14 2.5v-1" opacity="0.55" />
        {/* linterna (caja superior con luz) */}
        <rect x="11.5" y="4.5" width="5" height="4" rx="0.5" />
        <path d="M13 6.3h2" />
        {/* cornisa / balcón */}
        <path d="M10.5 8.5h7" />
        <path d="M10 9.5h8" />
        {/* fuste troncocónico */}
        <path d="M11 10l-2 13" />
        <path d="M17 10l2 13" />
        {/* banda horizontal a media altura */}
        <path d="M10 16h8" opacity="0.6" />
        {/* base sobre el acantilado */}
        <path d="M8 23h12" />
        <path d="M6 25.5h16" />
      </svg>
      {withText && (
        <span className="inline-flex flex-col leading-none">
          <span
            className="inline-flex items-baseline gap-[0.2em]"
            style={{ color: textColor, lineHeight: 1 }}
          >
            <span
              className="display font-semibold"
              style={{
                fontSize: "1.05rem",
                letterSpacing: "0.04em",
              }}
            >
              Demos
            </span>
            <span
              className="font-semibold"
              style={{
                fontFamily:
                  "ui-sans-serif, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif",
                fontSize: "0.82rem",
                letterSpacing: "-0.01em",
              }}
            >
              iOS
            </span>
          </span>
          {!compact && (
            <span
              className="display italic"
              style={{
                color: "var(--color-piedra)",
                fontSize: "0.62rem",
                letterSpacing: "0.12em",
                marginTop: "3px",
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
