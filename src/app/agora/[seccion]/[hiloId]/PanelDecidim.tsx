"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { votarDecisionAction } from "@/lib/agora/acciones";
import type {
  AgoraVotoBinario,
  ConteoVotosBinario,
  Decision,
} from "@/lib/agora/tipos";

type Props = {
  decision: Decision;
  conteo: ConteoVotosBinario;
  votoUsuario: AgoraVotoBinario | null;
  hiloId: string;
  seccionId: string;
  requiereSesion: boolean;
  /** Calculado en el server para evitar Date.now() en render. */
  cerrada: boolean;
  /** Horas restantes calculadas en el server. */
  horasRestantes: number;
};

const OPCIONES: { value: AgoraVotoBinario; label: string; color: string }[] = [
  { value: "a_favor", label: "A favor", color: "#047857" },
  { value: "en_contra", label: "En contra", color: "#BE123C" },
  { value: "abstencion", label: "Abstención", color: "#6D6458" },
];

export function PanelDecidim({
  decision,
  conteo,
  votoUsuario,
  hiloId,
  seccionId,
  requiereSesion,
  cerrada,
  horasRestantes,
}: Props) {
  const router = useRouter();
  const [votoActual, setVotoActual] = useState<AgoraVotoBinario | null>(votoUsuario);
  const [conteoLocal, setConteoLocal] = useState(conteo);
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function votar(voto: AgoraVotoBinario) {
    if (requiereSesion) {
      router.push("/login");
      return;
    }
    if (cerrada) return;
    setError(null);

    // Optimismo: ajustar conteo local
    setConteoLocal((c) => {
      const next = { ...c };
      if (votoActual && votoActual !== voto) {
        next[votoActual] = Math.max(0, next[votoActual] - 1);
        next.total = Math.max(0, next.total - 1);
      }
      if (votoActual !== voto) {
        next[voto] += 1;
        next.total += 1;
      }
      return next;
    });
    const previo = votoActual;
    setVotoActual(voto);

    const fd = new FormData();
    fd.set("decisionId", decision.id);
    fd.set("voto", voto);
    fd.set("hiloId", hiloId);
    fd.set("seccion", seccionId);

    startTransition(async () => {
      const r = await votarDecisionAction(fd);
      if (!r.ok) {
        // Revertir
        setVotoActual(previo);
        setConteoLocal(conteo);
        setError(r.error);
      }
    });
  }

  return (
    <section
      className="rounded-xl p-5"
      style={{
        background: "#EFF6FF",
        border: "1px solid #BFDBFE",
      }}
    >
      <div
        className="eyebrow"
        style={{ color: "#1D4ED8" }}
      >
        Propuesta a votación
      </div>
      <p
        className="display mt-1 text-base"
        style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
      >
        {decision.texto}
      </p>
      {decision.fundamentacion && (
        <p
          className="mt-2 whitespace-pre-wrap text-sm"
          style={{ color: "var(--color-piedra)" }}
        >
          {decision.fundamentacion}
        </p>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2">
        {OPCIONES.map((o) => {
          const seleccionado = votoActual === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => votar(o.value)}
              disabled={pendiente || cerrada}
              className="rounded-lg px-3 py-2 text-sm font-medium transition-all disabled:opacity-60"
              style={{
                background: seleccionado ? o.color : "var(--color-surface)",
                color: seleccionado ? "white" : o.color,
                border: `1px solid ${seleccionado ? o.color : "var(--color-linea)"}`,
              }}
            >
              {o.label}
              <div
                className="eyebrow mt-0.5"
                style={{
                  color: seleccionado ? "rgba(255,255,255,0.85)" : "var(--color-piedra-clara)",
                }}
              >
                {conteoLocal[o.value]} ({pct(conteoLocal[o.value], conteoLocal.total)})
              </div>
            </button>
          );
        })}
      </div>

      <div
        className="eyebrow mt-4 flex flex-wrap gap-x-3 gap-y-1"
        style={{ color: "var(--color-piedra)" }}
      >
        <span>Total votos: {conteoLocal.total}</span>
        {decision.quorum_minimo !== null && decision.quorum_minimo !== undefined && (
          <span>Quórum mínimo: {decision.quorum_minimo}</span>
        )}
        <span>
          {cerrada
            ? `Cerrada el ${new Date(decision.fecha_cierre).toLocaleDateString("es-ES")}`
            : `Cierra en ${horasRestantes} h`}
        </span>
      </div>

      {error && (
        <p className="mt-2 text-sm" style={{ color: "var(--color-sangre)" }}>
          {error}
        </p>
      )}
    </section>
  );
}

function pct(n: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((n / total) * 100)}%`;
}
