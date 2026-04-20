"use client";

import { useMemo, useState } from "react";
import type { Isla, Municipio, Barrio } from "@/lib/territorio/canarias";
import {
  BARRIOS_LPGC,
  type BarrioJuego,
  type ComposicionCapital,
  type TipoBloque,
  tipoDominante,
  esCandidatoRecuperacion,
} from "@/lib/territorio/barrios-juego";
import { BarrioModal } from "./BarrioModal";

/** Colores por tipo, coherentes con la tipología de /polis. */
const COLOR_POR_TIPO: Record<TipoBloque, { base: string; tenue: string; borde: string }> = {
  comun: { base: "var(--color-oliva)", tenue: "#DEE6D0", borde: "#5B7A3E" },
  residente: { base: "var(--color-ocre)", tenue: "#EFE2C1", borde: "#8A5E1F" },
  autonomo: { base: "var(--color-ambar)", tenue: "#FBEACF", borde: "#A16207" },
  rentista: { base: "var(--color-siena)", tenue: "#F0DED3", borde: "#7A3C22" },
  corporativo: { base: "var(--color-sangre)", tenue: "#E8D1CD", borde: "#4E1B13" },
};

const R = 42; // radio del hexágono (modo hex)

/** Puntos de un hexágono flat-top centrado en (cx, cy). */
function hexPoints(cx: number, cy: number, r: number): string {
  const sqrt3over2 = Math.sqrt(3) / 2;
  const pts = [
    [cx + r, cy],
    [cx + r / 2, cy - sqrt3over2 * r],
    [cx - r / 2, cy - sqrt3over2 * r],
    [cx - r, cy],
    [cx - r / 2, cy + sqrt3over2 * r],
    [cx + r / 2, cy + sqrt3over2 * r],
  ];
  return pts.map((p) => p.join(",")).join(" ");
}

export type BarrioSeleccionado = {
  datos: Barrio;
  juego: BarrioJuego;
  dominante: TipoBloque;
  candidato: boolean;
};

/**
 * Mapa-tablero de un municipio. Renderiza cada barrio como hexágono
 * (modo fallback) o como polígono vectorial real si el barrio trae un
 * path SVG en `geometria.modo === "vector"`. Mismo click/hover/modal
 * para ambos modos.
 */
export function MapaBarrios({
  isla,
  municipio,
}: {
  isla: Isla;
  municipio: Municipio;
}) {
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const entradas = useMemo(() => {
    return BARRIOS_LPGC.map((bj) => {
      const datos = municipio.barrios.find((b) => b.id === bj.id);
      if (!datos) return null;
      const dominante = tipoDominante(bj.composicionCapital);
      const candidato = esCandidatoRecuperacion(bj.composicionCapital);
      return { juego: bj, datos, dominante, candidato };
    }).filter((x): x is NonNullable<typeof x> => x !== null);
  }, [municipio]);

  const seleccionado: BarrioSeleccionado | null = useMemo(() => {
    if (!seleccionadoId) return null;
    return entradas.find((e) => e.juego.id === seleccionadoId) ?? null;
  }, [entradas, seleccionadoId]);

  if (entradas.length === 0) {
    return (
      <div
        className="rounded-xl p-6 text-center"
        style={{
          background: "var(--color-papiro-soft)",
          border: "1px dashed var(--color-linea)",
          color: "var(--color-piedra)",
        }}
      >
        <p className="display italic" style={{ margin: 0 }}>
          {municipio.nombre} todavía no tiene barrios mapeados en el tablero.
        </p>
        <p style={{ fontSize: "0.88rem", marginTop: "0.5rem" }}>
          Estamos empezando por Las Palmas de Gran Canaria. Pronto se suman
          Santa Cruz de Tenerife y el resto de capitales insulares.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div
        className="relative rounded-xl overflow-hidden"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-linea)",
        }}
      >
        <svg
          viewBox="0 0 500 560"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`Mapa-tablero de ${municipio.nombre}`}
          style={{ width: "100%", height: "auto", display: "block" }}
        >
          {/* Fondo sutil con patrón de grilla para evocar "tablero". */}
          <defs>
            <pattern
              id="grid-tablero"
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 20 0 L 0 0 0 20"
                fill="none"
                stroke="var(--color-linea)"
                strokeWidth="0.4"
                opacity="0.6"
              />
            </pattern>
          </defs>
          <rect width="500" height="560" fill="url(#grid-tablero)" />

          {entradas.map((e) => {
            const { juego, datos, dominante, candidato } = e;
            const color = COLOR_POR_TIPO[dominante];
            const activo = seleccionadoId === juego.id;
            const sobre = hover === juego.id;
            const escala = activo ? 1.05 : sobre ? 1.02 : 1;
            const cx = juego.geometria.cx;
            const cy = juego.geometria.cy;
            return (
              <g
                key={juego.id}
                transform={`translate(${cx}, ${cy}) scale(${escala}) translate(${-cx}, ${-cy})`}
                style={{
                  transition: "transform 0.18s ease",
                  cursor: "pointer",
                  transformOrigin: `${cx}px ${cy}px`,
                }}
                onClick={() => setSeleccionadoId(juego.id)}
                onMouseEnter={() => setHover(juego.id)}
                onMouseLeave={() => setHover(null)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    setSeleccionadoId(juego.id);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`${datos.nombre} — capital dominante: ${dominante}${candidato ? ", candidato a recuperación" : ""}`}
                aria-pressed={activo}
              >
                {/* Halo del barrio seleccionado (detrás). */}
                {activo && juego.geometria.modo === "vector" && (
                  <path
                    d={juego.geometria.d}
                    fill={color.base}
                    opacity="0.2"
                    style={{ filter: "blur(3px)" }}
                  />
                )}
                {activo && juego.geometria.modo === "hex" && (
                  <polygon
                    points={hexPoints(cx, cy, R + 6)}
                    fill={color.base}
                    opacity="0.18"
                  />
                )}

                {/* Cuerpo del barrio. */}
                {juego.geometria.modo === "vector" ? (
                  <path
                    d={juego.geometria.d}
                    fill={activo ? color.base : color.tenue}
                    stroke={color.borde}
                    strokeWidth={activo ? 2.4 : candidato ? 1.8 : 1.1}
                    strokeDasharray={candidato && !activo ? "4 3" : "none"}
                    strokeLinejoin="round"
                    style={{
                      transition: "fill 0.18s ease, stroke-width 0.18s ease",
                    }}
                  />
                ) : (
                  <polygon
                    points={hexPoints(cx, cy, R)}
                    fill={activo ? color.base : color.tenue}
                    stroke={color.borde}
                    strokeWidth={activo ? 3 : candidato ? 2 : 1.2}
                    strokeDasharray={candidato && !activo ? "4 3" : "none"}
                    style={{
                      transition: "fill 0.18s ease, stroke-width 0.18s ease",
                    }}
                  />
                )}

                <text
                  x={cx}
                  y={cy + 4}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight={activo ? 700 : 600}
                  fill={activo ? "#FBF7EC" : "var(--color-papiro-ink)"}
                  style={{
                    pointerEvents: "none",
                    fontFamily: "var(--font-serif-stack)",
                    letterSpacing: "0.01em",
                    // Halo blanco ligero para que el nombre se lea sobre fondos oscuros.
                    paintOrder: "stroke fill",
                    stroke: activo ? "transparent" : "rgba(255,255,255,0.55)",
                    strokeWidth: activo ? 0 : 3,
                  }}
                >
                  {datos.nombre}
                </text>
                {candidato && (
                  <circle
                    cx={
                      juego.geometria.modo === "hex"
                        ? cx + R - 10
                        : cx + 14
                    }
                    cy={
                      juego.geometria.modo === "hex"
                        ? cy - R / 2 - 4
                        : cy - 18
                    }
                    r={5}
                    fill={activo ? "#FBF7EC" : color.borde}
                    stroke={activo ? color.borde : "#FBF7EC"}
                    strokeWidth={1.5}
                    style={{ pointerEvents: "none" }}
                  >
                    <title>Candidato a recuperación</title>
                  </circle>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Leyenda */}
      <ul
        className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[0.78rem]"
        style={{ color: "var(--color-piedra)" }}
        aria-label="Leyenda"
      >
        {(Object.keys(COLOR_POR_TIPO) as TipoBloque[]).map((t) => (
          <li key={t} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block"
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                background: COLOR_POR_TIPO[t].tenue,
                border: `1.2px solid ${COLOR_POR_TIPO[t].borde}`,
              }}
            />
            <span style={{ textTransform: "capitalize" }}>{t}</span>
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5 ml-auto">
          <span
            aria-hidden
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "var(--color-sangre)",
            }}
          />
          <span>Candidato a recuperación</span>
        </li>
      </ul>

      {seleccionado && (
        <BarrioModal
          seleccionado={seleccionado}
          isla={isla}
          municipio={municipio}
          onClose={() => setSeleccionadoId(null)}
        />
      )}
    </div>
  );
}

/** Util: devuelve etiqueta humana para un tipo de bloque. */
export function etiquetaTipo(tipo: TipoBloque): string {
  return {
    comun: "Común",
    residente: "Residente",
    autonomo: "Autónomo / PYME local",
    rentista: "Rentista difuso",
    corporativo: "Privado-corporativo",
  }[tipo];
}

/** Util: devuelve la composición ordenada por porcentaje descendente. */
export function composicionOrdenada(
  c: ComposicionCapital,
): Array<{ tipo: TipoBloque; pct: number }> {
  return (Object.entries(c) as [TipoBloque, number][])
    .map(([tipo, pct]) => ({ tipo, pct }))
    .sort((a, b) => b.pct - a.pct);
}
