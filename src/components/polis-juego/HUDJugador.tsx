"use client";

// ─── POLIS · Juego: HUD del jugador ───────────────────────────────
// Banda superior con: avatar + alias + grado, totales por eje
// (exploración / calibrado / recuperación), barra de progreso al
// próximo grado del cursus honorum y conversión PEC → capital OCRE.

import { COLOR_EJE_JUEGO } from "@/lib/polis-juego/paletas";
import { gradoActual, proximoGrado, avanceHaciaProximo } from "@/lib/cursus/grados";
import { convertirAOcre, type Jugador, type EjeJuego } from "@/lib/polis-juego/tipos";
import { Avatar } from "@/components/Avatar";

export function HUDJugador({
  jugador,
  totalPec,
}: {
  jugador: Jugador;
  totalPec: number;
}) {
  const ocre = convertirAOcre(jugador.pec);
  const grado = gradoActual(ocre);
  const proximo = proximoGrado(grado);
  const avance = avanceHaciaProximo(ocre, grado);

  return (
    <div
      className="rounded-xl px-4 sm:px-5 py-4 grid gap-4 lg:grid-cols-[auto_1fr_auto] items-center"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-linea)",
        boxShadow: "var(--shadow-sutil)",
      }}
    >
      {/* Avatar + grado */}
      <div className="flex items-center gap-3">
        <Avatar
          inicial={jugador.inicial}
          color="var(--color-ocre)"
          grado={grado}
          size={44}
        />
        <div>
          <div
            className="display text-[1rem]"
            style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
          >
            {jugador.alias}
          </div>
          <div
            className="eyebrow mt-0.5"
            style={{ color: grado.color }}
            title={grado.lema}
          >
            {grado.nombre} · {grado.traduccion}
          </div>
        </div>
      </div>

      {/* PEC por eje */}
      <div className="grid grid-cols-3 gap-3">
        <BarraPEC
          ejeId="exploracion"
          valor={jugador.pec.exploracion}
          maximo={totalPec || 1}
        />
        <BarraPEC
          ejeId="calibrado"
          valor={jugador.pec.calibrado}
          maximo={totalPec || 1}
        />
        <BarraPEC
          ejeId="recuperacion"
          valor={jugador.pec.recuperacion}
          maximo={totalPec || 1}
        />
      </div>

      {/* Progreso al próximo grado */}
      <div className="min-w-[180px]">
        <div className="flex items-baseline justify-between mb-1.5">
          <span
            className="eyebrow"
            style={{ color: "var(--color-piedra-clara)" }}
          >
            Próximo grado
          </span>
          <span
            className="text-[0.78rem]"
            style={{ color: "var(--color-piedra)" }}
          >
            {proximo ? proximo.nombre : "máximo alcanzado"}
          </span>
        </div>
        <div
          className="rounded-full overflow-hidden"
          style={{
            height: 6,
            background: "var(--color-papiro-soft)",
            border: "1px solid var(--color-linea)",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${Math.round(avance * 100)}%`,
              background: proximo ? proximo.color : grado.color,
              transition: "width 400ms ease-out",
            }}
          />
        </div>
        <div
          className="text-[0.7rem] mt-1.5 flex items-center justify-between"
          style={{ color: "var(--color-piedra-clara)" }}
        >
          <span>
            PEC totales: <strong style={{ color: "var(--color-papiro-ink)" }}>{totalPec}</strong>
          </span>
          <span title="Equivalente en capital OCRE (κοινωνία / παιδεία / πολιτεία)">
            {ocre.koinonia} κ · {ocre.paideia} π · {ocre.politeia} π
          </span>
        </div>
      </div>
    </div>
  );
}

function BarraPEC({
  ejeId,
  valor,
  maximo,
}: {
  ejeId: EjeJuego;
  valor: number;
  maximo: number;
}) {
  const meta = COLOR_EJE_JUEGO[ejeId];
  const pct = Math.max(0.04, valor / maximo);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span
          className="eyebrow inline-flex items-center gap-1"
          style={{ color: "var(--color-piedra-clara)" }}
        >
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              background: meta.hex,
              borderRadius: 999,
            }}
          />
          {meta.etiqueta}
        </span>
        <span
          className="text-[0.78rem]"
          style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
        >
          {valor}
        </span>
      </div>
      <div
        className="rounded-sm overflow-hidden"
        style={{
          height: 5,
          background: "var(--color-papiro-soft)",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${Math.round(pct * 100)}%`,
            background: meta.hex,
            transition: "width 400ms ease-out",
          }}
        />
      </div>
    </div>
  );
}
