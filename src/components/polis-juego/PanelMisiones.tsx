"use client";

// ─── POLIS · Juego: panel lateral de misiones ─────────────────────
// Lista de misiones con barra de progreso y recompensa por eje.
// Las misiones completadas se marcan con un sello sobrio.

import { COLOR_EJE_JUEGO } from "@/lib/polis-juego/paletas";
import type { Jugador, Mision } from "@/lib/polis-juego/tipos";

export function PanelMisiones({
  misiones,
  jugador,
}: {
  misiones: Mision[];
  jugador: Jugador;
}) {
  const completadas = misiones.filter((m) => m.progreso >= 1).length;
  return (
    <aside
      className="rounded-xl p-5"
      style={{
        background: "var(--color-papiro-soft)",
        border: "1px solid var(--color-linea)",
        height: "fit-content",
        position: "sticky",
        top: "7rem",
      }}
    >
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="eyebrow">Cuaderno de campo</div>
          <h3
            className="display text-[1rem] mt-1"
            style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
          >
            Misiones
          </h3>
        </div>
        <span
          className="text-[0.74rem]"
          style={{ color: "var(--color-piedra)" }}
        >
          {completadas} / {misiones.length}
        </span>
      </div>

      <ul className="list-none p-0 m-0 space-y-3">
        {misiones.map((m) => (
          <CartaMision key={m.id} mision={m} />
        ))}
      </ul>

      {/* Resumen del jugador al pie */}
      <div
        className="mt-5 pt-4"
        style={{ borderTop: "1px solid var(--color-linea)" }}
      >
        <div
          className="eyebrow"
          style={{ color: "var(--color-piedra-clara)" }}
        >
          Tu huella en Vegueta
        </div>
        <ul
          className="text-[0.78rem] mt-2 space-y-1 list-none p-0 m-0"
          style={{ color: "var(--color-piedra)" }}
        >
          <li>
            Anotaciones firmadas:{" "}
            <strong style={{ color: "var(--color-papiro-ink)" }}>
              {jugador.anotaciones.length}
            </strong>
          </li>
          <li>
            Edificios distintos:{" "}
            <strong style={{ color: "var(--color-ocre-deep)" }}>
              {new Set(jugador.anotaciones.map((a) => a.edificioId)).size}
            </strong>
          </li>
          <li>
            Marcados a recuperar:{" "}
            <strong style={{ color: "var(--color-sangre)" }}>
              {
                jugador.anotaciones.filter(
                  (a) => a.capital === "rentista" || a.capital === "corporativo",
                ).length
              }
            </strong>
          </li>
        </ul>
      </div>
    </aside>
  );
}

function CartaMision({ mision }: { mision: Mision }) {
  const meta = COLOR_EJE_JUEGO[mision.ejePrincipal];
  const completa = mision.progreso >= 1;
  return (
    <li
      className="rounded-lg p-3"
      style={{
        background: "var(--color-surface)",
        border: `1px solid ${completa ? meta.hex : "var(--color-linea)"}`,
        opacity: completa ? 0.94 : 1,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className="display text-[0.95rem]"
          style={{
            color: completa ? "var(--color-piedra)" : "var(--color-papiro-ink)",
            fontWeight: 600,
            textDecoration: completa ? "line-through" : "none",
          }}
        >
          {mision.titulo}
        </div>
        <span
          className="eyebrow rounded-full px-1.5 py-0.5 shrink-0"
          style={{
            background: "var(--color-papiro-soft)",
            color: meta.hex,
            fontSize: "0.58rem",
          }}
        >
          {meta.etiqueta}
        </span>
      </div>
      <p
        className="text-[0.78rem] mt-1 leading-snug"
        style={{ color: "var(--color-piedra)" }}
      >
        {completa && mision.cuandoCompleta ? mision.cuandoCompleta : mision.descripcion}
      </p>

      {/* Barra de progreso */}
      <div
        className="rounded-full overflow-hidden mt-2"
        style={{
          height: 4,
          background: "var(--color-papiro-soft)",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${Math.round(mision.progreso * 100)}%`,
            background: meta.hex,
            transition: "width 400ms ease-out",
          }}
        />
      </div>

      {/* Recompensa */}
      <div
        className="text-[0.7rem] mt-1.5 flex items-center justify-between"
        style={{ color: "var(--color-piedra-clara)" }}
      >
        <span>
          Recompensa:{" "}
          {(["exploracion", "calibrado", "recuperacion"] as const)
            .filter((k) => mision.recompensa[k] > 0)
            .map((k) => `${COLOR_EJE_JUEGO[k].icono} ${mision.recompensa[k]}`)
            .join(" · ")}
        </span>
        {completa && (
          <span style={{ color: meta.hex, fontWeight: 600 }}>✓ completada</span>
        )}
      </div>
    </li>
  );
}
