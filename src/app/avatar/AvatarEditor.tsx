"use client";

import { useMemo, useState, useTransition } from "react";
import { AvatarReceta } from "@/components/AvatarReceta";
import {
  CATALOGO_AVATAR,
  NINGUNO,
  estaDesbloqueada,
  motivoBloqueo,
  type ContextoDesbloqueo,
  type ParteAvatar,
} from "@/lib/avatar/catalogo";
import type { AvatarReceta as Receta } from "@/lib/avatar/receta";
import { guardarAvatarReceta } from "./actions";

/** Contexto serializable que viaja del server al cliente. */
export type CtxSerializable = {
  nivelGrado: number;
  logros: string[];
  insignias: string[];
};

export function AvatarEditor({
  recetaInicial,
  ctx: ctxSer,
}: {
  recetaInicial: Receta;
  ctx: CtxSerializable;
}) {
  const ctx: ContextoDesbloqueo = useMemo(
    () => ({
      nivelGrado: ctxSer.nivelGrado,
      logros: new Set(ctxSer.logros),
      insignias: new Set(ctxSer.insignias),
    }),
    [ctxSer],
  );

  const [receta, setReceta] = useState<Receta>(recetaInicial);
  const [parteActiva, setParteActiva] = useState<string>(CATALOGO_AVATAR[0].id);
  const [pendiente, startTransition] = useTransition();
  const [estado, setEstado] = useState<
    null | "ok" | "bloqueado" | "sin-columna" | "error"
  >(null);

  const parte =
    CATALOGO_AVATAR.find((p) => p.id === parteActiva) ?? CATALOGO_AVATAR[0];

  function valorActual(p: ParteAvatar): string {
    if (p.campoProbabilidad && receta.opciones[p.campoProbabilidad] === 0) {
      return NINGUNO;
    }
    const v = receta.opciones[p.campo];
    return Array.isArray(v) && v.length ? String(v[0]) : "";
  }

  function elegir(p: ParteAvatar, id: string) {
    setEstado(null);
    setReceta((prev) => {
      const opciones = { ...prev.opciones };
      if (p.campoProbabilidad) {
        if (id === NINGUNO) {
          opciones[p.campoProbabilidad] = 0;
        } else {
          opciones[p.campoProbabilidad] = 100;
          opciones[p.campo] = [id];
        }
      } else {
        opciones[p.campo] = [id];
      }
      return { ...prev, opciones };
    });
  }

  function guardar() {
    setEstado(null);
    startTransition(async () => {
      const res = await guardarAvatarReceta(receta);
      if (res.ok) {
        setEstado("ok");
      } else if (res.error === "bloqueado" || res.error === "sin-columna") {
        setEstado(res.error);
      } else {
        setEstado("error");
      }
    });
  }

  const seleccion = valorActual(parte);

  return (
    <div className="flex flex-col md:flex-row gap-8">
      {/* Vista previa */}
      <div className="flex flex-col items-center gap-4 md:sticky md:top-6 self-start">
        <AvatarReceta receta={receta} size={180} title="Vista previa" />
        <button
          type="button"
          onClick={guardar}
          disabled={pendiente}
          className="px-5 py-2 rounded-md text-[0.9rem] font-medium disabled:opacity-50"
          style={{
            background: "var(--color-ocre-deep)",
            color: "#FBF7EC",
          }}
        >
          {pendiente ? "Guardando…" : "Guardar avatar"}
        </button>
        {estado === "ok" && (
          <p className="text-[0.82rem]" style={{ color: "#2f7d32" }} role="status">
            ✓ Avatar guardado
          </p>
        )}
        {estado === "bloqueado" && (
          <p className="text-[0.82rem]" style={{ color: "#a04030" }} role="alert">
            Has elegido algo que aún no tienes desbloqueado.
          </p>
        )}
        {estado === "sin-columna" && (
          <p
            className="text-[0.82rem] text-center max-w-[200px]"
            style={{ color: "#a04030" }}
            role="alert"
          >
            El avatar no se puede guardar todavía (falta aplicar la migración).
          </p>
        )}
        {estado === "error" && (
          <p className="text-[0.82rem]" style={{ color: "#a04030" }} role="alert">
            No se pudo guardar. Inténtalo de nuevo.
          </p>
        )}
      </div>

      {/* Controles */}
      <div className="flex-1 min-w-0">
        {/* Pestañas de partes */}
        <div className="flex flex-wrap gap-2 mb-4">
          {CATALOGO_AVATAR.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setParteActiva(p.id)}
              className="px-3 py-1.5 rounded-md text-[0.82rem]"
              style={{
                background:
                  p.id === parteActiva
                    ? "var(--color-ocre-deep)"
                    : "var(--color-papiro-soft)",
                color: p.id === parteActiva ? "#FBF7EC" : "var(--color-piedra)",
                border: "1px solid var(--color-linea)",
              }}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>

        {/* Opciones de la parte activa */}
        <div className="flex flex-wrap gap-2.5">
          {parte.opciones.map((o) => {
            const desbloqueada = estaDesbloqueada(o.desbloqueo, ctx);
            const activa = seleccion === o.id;
            const esColor = !!parte.esColor;
            const motivo = desbloqueada ? "" : motivoBloqueo(o.desbloqueo);

            if (esColor) {
              return (
                <button
                  key={o.id}
                  type="button"
                  disabled={!desbloqueada}
                  onClick={() => elegir(parte, o.id)}
                  title={desbloqueada ? o.etiqueta : motivo}
                  className="relative rounded-full"
                  style={{
                    width: 38,
                    height: 38,
                    background: `#${o.id}`,
                    border: activa
                      ? "3px solid var(--color-ocre-deep)"
                      : "3px solid var(--color-linea)",
                    cursor: desbloqueada ? "pointer" : "not-allowed",
                    opacity: desbloqueada ? 1 : 0.35,
                  }}
                >
                  {!desbloqueada && (
                    <span
                      aria-hidden
                      className="absolute inset-0 flex items-center justify-center text-[0.7rem]"
                      style={{ color: "#000" }}
                    >
                      🔒
                    </span>
                  )}
                </button>
              );
            }

            return (
              <button
                key={o.id}
                type="button"
                disabled={!desbloqueada}
                onClick={() => elegir(parte, o.id)}
                title={desbloqueada ? o.etiqueta : motivo}
                className="px-3 py-2 rounded-md text-[0.82rem] text-left"
                style={{
                  minWidth: 96,
                  background: activa
                    ? "var(--color-ocre-deep)"
                    : "var(--color-surface)",
                  color: activa ? "#FBF7EC" : "var(--color-papiro-ink)",
                  border: activa
                    ? "1px solid var(--color-ocre-deep)"
                    : "1px solid var(--color-linea)",
                  cursor: desbloqueada ? "pointer" : "not-allowed",
                  opacity: desbloqueada ? 1 : 0.55,
                }}
              >
                <span className="block">{o.etiqueta}</span>
                {!desbloqueada && (
                  <span
                    className="block text-[0.68rem] mt-0.5"
                    style={{ color: "var(--color-piedra-clara)" }}
                  >
                    🔒 {motivo}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
