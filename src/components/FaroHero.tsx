// Faro hero animado. Ciclo de 6 s:
//   · 0.3 s fade-in  → 2.4 s a pleno brillo  → 0.3 s fade-out  → 3 s apagado.
// Además, todo el conjunto de haces rota lentamente (6 s / vuelta) para
// que cuando las luces encienden parezca estar girando, como un faro real.
//
// La estructura SVG está agrupada por "pisos" (<g id="piso-…">) para
// poder convertirlos en anchors clicables hacia secciones cuando el
// usuario lo decida.

export function FaroHero() {
  return (
    <div
      role="img"
      aria-label="Faro encendiéndose en ciclos — símbolo de Demos iOS"
      className="relative mx-auto flex items-end justify-center"
      style={{
        maxWidth: 420,
        width: "100%",
        aspectRatio: "3 / 4",
      }}
    >
      <svg
        viewBox="0 0 300 440"
        preserveAspectRatio="xMidYMax meet"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: "100%", height: "100%", overflow: "visible" }}
      >
        <defs>
          {/* Gradiente de haz: ámbar suave que se desvanece hacia fuera. */}
          <radialGradient
            id="faro-haz"
            cx="150"
            cy="110"
            r="260"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#FFE3A8" stopOpacity="0.92" />
            <stop offset="0.22" stopColor="#FFE3A8" stopOpacity="0.6" />
            <stop offset="0.55" stopColor="#FFE3A8" stopOpacity="0.18" />
            <stop offset="1" stopColor="#FFE3A8" stopOpacity="0" />
          </radialGradient>
          {/* Halo corto alrededor de la lámpara, para que la linterna "respire". */}
          <radialGradient id="faro-halo" cx="150" cy="110" r="40" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#FFEFC4" stopOpacity="0.95" />
            <stop offset="0.6" stopColor="#FFEFC4" stopOpacity="0.35" />
            <stop offset="1" stopColor="#FFEFC4" stopOpacity="0" />
          </radialGradient>
          {/* Sombra bajo el faro. */}
          <radialGradient id="faro-sombra" cx="150" cy="420" r="90" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#1C1915" stopOpacity="0.25" />
            <stop offset="1" stopColor="#1C1915" stopOpacity="0" />
          </radialGradient>
          {/* Ligera textura interna de la torre. */}
          <linearGradient id="faro-torre" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#FBF7EC" />
            <stop offset="0.45" stopColor="#FFFFFF" />
            <stop offset="1" stopColor="#F1EBDE" />
          </linearGradient>
        </defs>

        {/* Sombra del faro sobre el suelo. */}
        <ellipse cx="150" cy="415" rx="90" ry="8" fill="url(#faro-sombra)" />

        {/* Haces de luz — oscilan (no giran 360°) y pulsan juntos.
            El pivote está en el centro exacto de la bombilla (150, 110)
            gracias a `transform-box: view-box`. La oscilación se limita a
            ±4°, de forma que la punta de cada haz nunca sube ni baja más
            que la propia altura del bulbo — como pediste. */}
        <g
          className="faro-haces"
          style={{
            transformBox: "view-box",
            transformOrigin: "150px 110px",
          }}
        >
          <polygon
            points="150,110 360,92 360,128"
            fill="url(#faro-haz)"
          />
          <polygon
            points="150,110 -60,92 -60,128"
            fill="url(#faro-haz)"
          />
        </g>

        {/* Acantilado / roca. */}
        <g className="faro-base">
          <path
            d="M40 410 L60 385 L78 395 L92 372 L110 388 L120 372 L150 382 L170 365 L188 385 L210 374 L228 388 L250 380 L272 395 L260 410 Z"
            fill="#2B241B"
            opacity="0.9"
          />
          <path
            d="M40 410 L260 410 L260 418 L40 418 Z"
            fill="#1C1915"
          />
        </g>

        {/* Fuste troncocónico — piso bajo, medio y alto. */}
        <g id="piso-base">
          <path
            d="M98 360 L202 360 L196 320 L104 320 Z"
            fill="url(#faro-torre)"
            stroke="#8A5E1F"
            strokeWidth="1.2"
          />
        </g>
        <g id="piso-medio">
          <path
            d="M104 320 L196 320 L190 240 L110 240 Z"
            fill="url(#faro-torre)"
            stroke="#8A5E1F"
            strokeWidth="1.2"
          />
          {/* bandas rojas tipo faro canario */}
          <rect x="110" y="280" width="80" height="8" fill="#A14B2A" />
        </g>
        <g id="piso-alto">
          <path
            d="M110 240 L190 240 L185 165 L115 165 Z"
            fill="url(#faro-torre)"
            stroke="#8A5E1F"
            strokeWidth="1.2"
          />
          <rect x="115" y="200" width="70" height="8" fill="#A14B2A" />
          {/* ventanita estrecha */}
          <rect x="146" y="190" width="8" height="22" fill="#2B241B" rx="1" />
        </g>

        {/* Balcón / galería circundante. */}
        <g id="galeria">
          <rect x="102" y="157" width="96" height="10" fill="#8A5E1F" />
          <rect x="106" y="148" width="88" height="9" fill="#FBF7EC" stroke="#8A5E1F" strokeWidth="1" />
          {/* barandilla — líneas verticales */}
          {[...Array(8)].map((_, i) => (
            <line
              key={i}
              x1={112 + i * 11}
              y1="148"
              x2={112 + i * 11}
              y2="157"
              stroke="#8A5E1F"
              strokeWidth="1"
            />
          ))}
        </g>

        {/* Linterna (caja de cristal) con la lámpara dentro. */}
        <g id="linterna">
          <rect
            x="118"
            y="90"
            width="64"
            height="58"
            fill="#FBF7EC"
            stroke="#8A5E1F"
            strokeWidth="1.4"
            rx="2"
          />
          {/* travesaños verticales del cristal */}
          <line x1="134" y1="94" x2="134" y2="144" stroke="#8A5E1F" strokeWidth="0.8" />
          <line x1="150" y1="94" x2="150" y2="144" stroke="#8A5E1F" strokeWidth="0.8" />
          <line x1="166" y1="94" x2="166" y2="144" stroke="#8A5E1F" strokeWidth="0.8" />
          {/* travesaño horizontal */}
          <line x1="120" y1="118" x2="180" y2="118" stroke="#8A5E1F" strokeWidth="0.8" />
          {/* lámpara (halo pulsante dentro) */}
          <circle cx="150" cy="110" r="30" fill="url(#faro-halo)" className="faro-halo" />
          <circle cx="150" cy="110" r="7" fill="#FFE3A8" className="faro-bombilla" />
        </g>

        {/* Cúpula / tejado. */}
        <g id="cupula">
          <path
            d="M118 90 Q150 50 182 90 Z"
            fill="#6E2A1E"
            stroke="#2B241B"
            strokeWidth="1.2"
          />
          <path
            d="M122 90 Q150 56 178 90"
            fill="none"
            stroke="#2B241B"
            strokeOpacity="0.25"
            strokeWidth="0.8"
          />
        </g>
        {/* Pináculo / veleta. */}
        <g id="pinaculo">
          <line x1="150" y1="52" x2="150" y2="30" stroke="#2B241B" strokeWidth="1.6" />
          <circle cx="150" cy="30" r="3.5" fill="#8A5E1F" stroke="#2B241B" strokeWidth="1" />
          <path d="M150 26 L156 24 L156 20 L150 22 Z" fill="#8A5E1F" />
        </g>
      </svg>

    </div>
  );
}
