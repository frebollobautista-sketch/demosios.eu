"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { crearPropuestaAction, votarPropuestaAction } from "@/lib/agora/acciones";
import type {
  AgoraVotoTernario,
  ConteoVotosTernario,
  Propuesta,
} from "@/lib/agora/tipos";

type Props = {
  propuestas: Propuesta[];
  conteos: Record<string, ConteoVotosTernario>;
  votosUsuario: Record<string, AgoraVotoTernario>;
  hiloId: string;
  seccionId: string;
  requiereSesion: boolean;
};

const OPCIONES: { value: AgoraVotoTernario; label: string; color: string }[] = [
  { value: "de_acuerdo", label: "De acuerdo", color: "#047857" },
  { value: "desacuerdo", label: "Desacuerdo", color: "#BE123C" },
  { value: "pasar", label: "Pasar", color: "#6D6458" },
];

export function PanelPolis({
  propuestas: propuestasIniciales,
  conteos: conteosIniciales,
  votosUsuario: votosIniciales,
  hiloId,
  seccionId,
  requiereSesion,
}: Props) {
  const router = useRouter();
  const [propuestas, setPropuestas] = useState<Propuesta[]>(propuestasIniciales);
  const [conteos, setConteos] = useState(conteosIniciales);
  const [votos, setVotos] = useState(votosIniciales);
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const refTexto = useRef<HTMLTextAreaElement>(null);

  function crearPropuesta(formData: FormData) {
    if (requiereSesion) {
      router.push("/login");
      return;
    }
    setError(null);
    const texto = String(formData.get("texto") ?? "").trim();
    if (texto.length < 8) return setError("Mínimo 8 caracteres.");

    startTransition(async () => {
      const r = await crearPropuestaAction(formData);
      if (!r.ok) setError(r.error);
      else {
        // Añadir optimista al estado local
        setPropuestas((ps) => [
          ...ps,
          {
            id: r.data!.id,
            hilo_id: hiloId,
            autor_id: "you", // se reemplaza al recargar
            texto,
            aprobada_para_votar: true,
            creado: new Date().toISOString(),
          },
        ]);
        if (refTexto.current) refTexto.current.value = "";
      }
    });
  }

  function votar(propuestaId: string, voto: AgoraVotoTernario) {
    if (requiereSesion) {
      router.push("/login");
      return;
    }
    setError(null);

    setConteos((c) => {
      const cur =
        c[propuestaId] ??
        ({ de_acuerdo: 0, desacuerdo: 0, pasar: 0, total: 0 } as ConteoVotosTernario);
      const next = { ...cur };
      const previo = votos[propuestaId];
      if (previo && previo !== voto) {
        next[previo] = Math.max(0, next[previo] - 1);
        next.total = Math.max(0, next.total - 1);
      }
      if (previo !== voto) {
        next[voto] += 1;
        next.total += 1;
      }
      return { ...c, [propuestaId]: next };
    });
    setVotos((v) => ({ ...v, [propuestaId]: voto }));

    const fd = new FormData();
    fd.set("propuestaId", propuestaId);
    fd.set("voto", voto);
    fd.set("hiloId", hiloId);
    fd.set("seccion", seccionId);

    startTransition(async () => {
      const r = await votarPropuestaAction(fd);
      if (!r.ok) {
        setError(r.error);
      }
    });
  }

  return (
    <section
      className="rounded-xl p-5"
      style={{
        background: "#FAF5FF",
        border: "1px solid #E9D5FF",
      }}
    >
      <div className="eyebrow" style={{ color: "#7E22CE" }}>
        Mapeo de consenso
      </div>
      <p
        className="display mt-1 text-base"
        style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
      >
        Vota propuestas cortas — busca puntos en común.
      </p>
      <p className="mt-2 text-sm" style={{ color: "var(--color-piedra)" }}>
        Cada propuesta es una frase votable. <b>De acuerdo</b> /{" "}
        <b>Desacuerdo</b> / <b>Pasar</b> si no quieres pronunciarte. El sistema
        agrupará respuestas para encontrar consensos transversales.
      </p>

      <ul className="mt-4 space-y-3">
        {propuestas.length === 0 && (
          <li
            className="rounded-md p-3 text-sm"
            style={{
              background: "var(--color-surface)",
              border: "1px dashed var(--color-linea)",
              color: "var(--color-piedra)",
            }}
          >
            Aún no hay propuestas. Empieza tú abajo.
          </li>
        )}
        {propuestas.map((p) => {
          const c =
            conteos[p.id] ??
            ({ de_acuerdo: 0, desacuerdo: 0, pasar: 0, total: 0 } as ConteoVotosTernario);
          const tu = votos[p.id] ?? null;
          return (
            <li
              key={p.id}
              className="rounded-md p-3"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-linea)",
              }}
            >
              <p
                className="text-sm"
                style={{ color: "var(--color-papiro-ink)" }}
              >
                {p.texto}
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {OPCIONES.map((o) => {
                  const seleccionado = tu === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => votar(p.id, o.value)}
                      disabled={pendiente}
                      className="rounded-md px-2 py-1.5 text-xs font-medium disabled:opacity-60"
                      style={{
                        background: seleccionado ? o.color : "var(--color-papiro-soft)",
                        color: seleccionado ? "white" : o.color,
                        border: `1px solid ${seleccionado ? o.color : "var(--color-linea)"}`,
                      }}
                    >
                      <div>{o.label}</div>
                      <div
                        className="eyebrow"
                        style={{
                          color: seleccionado
                            ? "rgba(255,255,255,0.85)"
                            : "var(--color-piedra-clara)",
                        }}
                      >
                        {c[o.value]}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div
                className="eyebrow mt-2"
                style={{ color: "var(--color-piedra-clara)" }}
              >
                Total: {c.total} votos
              </div>
            </li>
          );
        })}
      </ul>

      <form action={crearPropuesta} className="mt-5 space-y-2">
        <input type="hidden" name="hiloId" value={hiloId} />
        <input type="hidden" name="seccion" value={seccionId} />
        <textarea
          ref={refTexto}
          name="texto"
          required
          minLength={8}
          maxLength={280}
          rows={2}
          placeholder="Tu propuesta (8–280 caracteres) — una frase concreta y votable."
          className="w-full rounded-lg p-2 text-sm"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-linea)",
            color: "var(--color-papiro-ink)",
          }}
        />
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          style={{
            background: "#7E22CE",
            color: "white",
          }}
        >
          {pendiente ? "Enviando…" : "Añadir propuesta"}
        </button>
        {error && (
          <p className="text-sm" style={{ color: "var(--color-sangre)" }}>
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
