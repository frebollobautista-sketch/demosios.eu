"use client";

// ─── POLIS · Juego: Tablero LPGC ──────────────────────────────────
// Vista pixel art de los 10 barrios de Las Palmas como tarjetas
// cuadradas tile-based. Cada tarjeta tiene una mini-fachada generada
// de píxeles, el nombre del barrio, su tipo de capital dominante y
// un indicador de candidato a recuperación. El barrio operativo
// (Vegueta) tiene una marca dorada para invitar al click.

import { COLOR_TIPO_CAPITAL } from "@/lib/polis-juego/paletas";
import type { Jugador } from "@/lib/polis-juego/tipos";
import type { BarrioMacro } from "@/lib/polis-juego/mock";

export function TableroLPGC({
  barrios,
  jugador,
  onAbrirBarrio,
}: {
  barrios: BarrioMacro[];
  jugador: Jugador;
  onAbrirBarrio: (id: string) => void;
}) {
  return (
    <div
      className="rounded-xl p-5 sm:p-6"
      style={{
        background: "var(--color-papiro-soft)",
        border: "1px solid var(--color-linea)",
      }}
    >
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
        <div>
          <div className="eyebrow">Πόλις · Tablero</div>
          <h2
            className="display text-[1.1rem] mt-1"
            style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
          >
            Las Palmas de Gran Canaria
          </h2>
        </div>
        <span
          className="eyebrow"
          style={{ color: "var(--color-piedra-clara)" }}
        >
          {barrios.length} barrios · 1 jugable
        </span>
      </div>

      <p
        className="text-[0.88rem] mb-5 max-w-2xl"
        style={{ color: "var(--color-piedra)" }}
      >
        Cada barrio es una pieza pixel art. Pulsa{" "}
        <strong>Vegueta</strong> — el casco histórico — para entrar en el
        juego de calibrado y recuperación. El resto se irá abriendo según
        avance el pipeline catastral.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {barrios.map((b) => (
          <CartaBarrio
            key={b.id}
            barrio={b}
            jugable={b.jugable}
            onAbrir={() => onAbrirBarrio(b.id)}
            visitado={jugador.anotaciones.length > 0 && b.id === "vegueta"}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Tarjeta de barrio ────────────────────────────────────────────

function CartaBarrio({
  barrio,
  jugable,
  visitado,
  onAbrir,
}: {
  barrio: BarrioMacro;
  jugable: boolean;
  visitado: boolean;
  onAbrir: () => void;
}) {
  const tipo = COLOR_TIPO_CAPITAL[barrio.tipoDominante];

  return (
    <button
      onClick={jugable ? onAbrir : undefined}
      className="text-left rounded-lg overflow-hidden transition-transform"
      style={{
        background: "var(--color-surface)",
        border: `1px solid ${jugable ? "var(--color-ocre)" : "var(--color-linea)"}`,
        cursor: jugable ? "pointer" : "default",
        opacity: jugable ? 1 : 0.78,
      }}
      onMouseEnter={(e) => {
        if (jugable) e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {/* Mini-paisaje pixel art ─ */}
      <MiniPixelBarrio barrio={barrio} />

      <div className="p-3">
        <div className="flex items-center justify-between mb-1">
          <span
            className="eyebrow"
            style={{ color: "var(--color-piedra-clara)" }}
          >
            {barrio.eyebrow}
          </span>
          {visitado && (
            <span
              className="eyebrow rounded-full px-1.5 py-0.5"
              style={{
                background: "var(--color-papiro-soft)",
                color: "var(--color-ocre-deep)",
                fontSize: "0.6rem",
              }}
              title="Has caminado este barrio"
            >
              ✓
            </span>
          )}
        </div>
        <div
          className="display text-[1rem] mb-1"
          style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
        >
          {barrio.nombre}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span
            className="inline-block rounded-sm"
            style={{
              width: 10,
              height: 10,
              background: tipo.base,
            }}
          />
          <span
            className="text-[0.74rem]"
            style={{ color: "var(--color-piedra)" }}
          >
            {tipo.etiqueta}
          </span>
          {barrio.candidato && (
            <span
              className="ml-auto eyebrow rounded-full px-1.5 py-0.5"
              style={{
                background: "var(--color-sangre)",
                color: "var(--color-surface)",
                fontSize: "0.58rem",
              }}
            >
              Candidato
            </span>
          )}
        </div>
        <p
          className="text-[0.75rem] mt-2 leading-snug"
          style={{ color: "var(--color-piedra)" }}
        >
          {barrio.resumen}
        </p>
        {jugable ? (
          <div
            className="eyebrow mt-3 inline-flex items-center gap-1"
            style={{ color: "var(--color-ocre-deep)", fontSize: "0.62rem" }}
          >
            Entrar al barrio →
          </div>
        ) : (
          <div
            className="eyebrow mt-3"
            style={{ color: "var(--color-piedra-clara)", fontSize: "0.62rem" }}
          >
            Próximamente · catastro pendiente
          </div>
        )}
      </div>
    </button>
  );
}

// ─── Mini paisaje pixel art generado por ID ───────────────────────
//
// Pequeña silueta pixel art determinista a partir del id del barrio.
// No pretende ser la geografía real — sí dar a cada barrio una pieza
// distinta, reconocible y coherente con la paleta de su tipo dominante.

function MiniPixelBarrio({ barrio }: { barrio: BarrioMacro }) {
  const tipo = COLOR_TIPO_CAPITAL[barrio.tipoDominante];
  const seed = stringSeed(barrio.id);
  const cols = 16;
  const rows = 9;
  // Genera una skyline pixel art simple: para cada columna, una altura
  // pseudo-aleatoria entre 2 y rows-1.
  const skyline: number[] = [];
  let s = seed;
  for (let i = 0; i < cols; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    skyline.push(2 + (s % (rows - 2)));
  }

  // Paleta de la mini-fachada: depende del tipo dominante.
  const paleta = paletaParaTipo(barrio.tintHex);

  return (
    <div
      className="relative w-full"
      style={{
        height: 92,
        background: paleta.cielo,
        imageRendering: "pixelated",
      }}
    >
      <svg
        viewBox={`0 0 ${cols} ${rows}`}
        preserveAspectRatio="none"
        width="100%"
        height="100%"
        style={{ display: "block", imageRendering: "pixelated" }}
      >
        {/* Fondo cielo en gradiente discreto */}
        <defs>
          <linearGradient id={`sky-${barrio.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={paleta.cielo} />
            <stop offset="100%" stopColor={paleta.cieloBaja} />
          </linearGradient>
        </defs>
        <rect x={0} y={0} width={cols} height={rows} fill={`url(#sky-${barrio.id})`} />

        {/* Edificios en columna */}
        {skyline.map((h, i) => {
          const y = rows - h;
          const altColor =
            i % 3 === 0 ? paleta.muroAlt : i % 5 === 0 ? paleta.muroAlt2 : paleta.muro;
          return (
            <g key={i}>
              <rect x={i} y={y} width={1} height={h} fill={altColor} />
              {/* Ventanita pixel: solo si edificio alto */}
              {h >= 4 && (
                <rect
                  x={i + 0.25}
                  y={y + 1.25}
                  width={0.5}
                  height={0.5}
                  fill={paleta.ventana}
                />
              )}
              {h >= 6 && (
                <rect
                  x={i + 0.25}
                  y={y + 2.5}
                  width={0.5}
                  height={0.5}
                  fill={paleta.ventana}
                />
              )}
            </g>
          );
        })}

        {/* Suelo */}
        <rect x={0} y={rows - 0.7} width={cols} height={0.7} fill={paleta.suelo} />
      </svg>

      {/* Franja inferior con color del tipo de capital — codifica el "estado" del barrio */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{
          height: 4,
          background: tipo.base,
        }}
      />
    </div>
  );
}

// ─── helpers ──────────────────────────────────────────────────────

function stringSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) & 0x7fffffff;
  }
  return h || 1;
}

/**
 * Paleta de mini-fachada derivada del color de tinte del barrio. Es
 * deliberadamente reducida: un cielo, dos tonos de muro, ventana,
 * suelo. No pretende ser realista — pretende ser pixel art legible.
 */
function paletaParaTipo(tintHex: string) {
  // Mantenemos la paleta canaria base como fondo; el tint solo aporta
  // un acento sutil en el muro alternativo.
  return {
    cielo: "#f5efe2",
    cieloBaja: "#e8dfc8",
    muro: "#f5f2eb", // encalado base
    muroAlt: tintHex,
    muroAlt2: "#5a5350", // piedra volcánica
    ventana: "#2e1a0a", // tea oscura
    suelo: "#8c5a2c", // tea
  };
}
