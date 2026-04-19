"use client";

import { useEffect } from "react";
import type { Isla, Municipio } from "@/lib/territorio/canarias";
import type { TipoBloque } from "@/lib/territorio/barrios-juego";
import {
  type BarrioSeleccionado,
  etiquetaTipo,
  composicionOrdenada,
} from "./MapaBarrios";
import { IconClose } from "./Icons";
import { CTAProtegido } from "./CTAProtegido";

const COLOR_POR_TIPO: Record<TipoBloque, string> = {
  comun: "var(--color-oliva)",
  residente: "var(--color-ocre)",
  autonomo: "var(--color-ambar)",
  rentista: "var(--color-siena)",
  corporativo: "var(--color-sangre)",
};

/** Ventana emergente que aparece al clicar un barrio en el mapa. */
export function BarrioModal({
  seleccionado,
  isla,
  municipio,
  onClose,
}: {
  seleccionado: BarrioSeleccionado;
  isla: Isla;
  municipio: Municipio;
  onClose: () => void;
}) {
  // Escape para cerrar + bloquear scroll del body mientras está abierta.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const { datos, juego, dominante, candidato } = seleccionado;
  const orden = composicionOrdenada(juego.composicionCapital);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="barrio-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      {/* overlay */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "rgba(26, 23, 20, 0.55)" }}
      />

      {/* card */}
      <div
        className="relative w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl flotante-sombra"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-linea)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div
          className="flex items-start gap-3 p-5"
          style={{ borderBottom: "1px solid var(--color-linea)" }}
        >
          <div className="flex-1 min-w-0">
            <div
              className="eyebrow"
              style={{ color: "var(--color-piedra)" }}
            >
              {isla.nombre} · {municipio.nombre}
            </div>
            <h2
              id="barrio-modal-title"
              className="display mt-1"
              style={{
                color: "var(--color-papiro-ink)",
                fontWeight: 600,
                fontSize: "clamp(1.4rem, 3vw, 1.75rem)",
                lineHeight: 1.1,
              }}
            >
              {datos.nombre}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span
                className="eyebrow rounded-full px-2 py-0.5"
                style={{
                  background: COLOR_POR_TIPO[dominante],
                  color: "var(--color-surface)",
                }}
              >
                {etiquetaTipo(dominante)}
              </span>
              {candidato && (
                <span
                  className="eyebrow rounded-full px-2 py-0.5"
                  style={{
                    background: "var(--color-sangre)",
                    color: "var(--color-surface)",
                  }}
                >
                  Candidato
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md shrink-0"
            style={{ color: "var(--color-piedra)" }}
          >
            <IconClose />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="p-5 space-y-5">
          {juego.nota && (
            <p
              className="display italic"
              style={{
                color: "var(--color-papiro-ink)",
                fontSize: "0.98rem",
                lineHeight: 1.4,
              }}
            >
              «{juego.nota}»
            </p>
          )}

          {/* Composición de capital */}
          <div>
            <div className="eyebrow mb-2" style={{ color: "var(--color-piedra)" }}>
              Composición de capital
            </div>

            {/* Barra apilada */}
            <div
              className="w-full h-3 rounded-full overflow-hidden flex"
              style={{ background: "var(--color-papiro-soft)" }}
              role="img"
              aria-label="Distribución porcentual de los tipos de capital del barrio"
            >
              {orden.map((seg) =>
                seg.pct > 0 ? (
                  <div
                    key={seg.tipo}
                    style={{
                      width: `${seg.pct}%`,
                      background: COLOR_POR_TIPO[seg.tipo],
                    }}
                    title={`${etiquetaTipo(seg.tipo)}: ${seg.pct}%`}
                  />
                ) : null,
              )}
            </div>

            {/* Lista numerada */}
            <ul className="mt-3 space-y-1.5">
              {orden.map((seg) => (
                <li
                  key={seg.tipo}
                  className="flex items-center gap-2 text-[0.88rem]"
                  style={{ color: "var(--color-papiro-ink)" }}
                >
                  <span
                    aria-hidden
                    style={{
                      display: "inline-block",
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      background: COLOR_POR_TIPO[seg.tipo],
                      flexShrink: 0,
                    }}
                  />
                  <span className="flex-1">{etiquetaTipo(seg.tipo)}</span>
                  <span
                    style={{
                      fontFeatureSettings: "'tnum'",
                      color: "var(--color-piedra)",
                      fontWeight: seg.tipo === dominante ? 600 : 500,
                    }}
                  >
                    {seg.pct}%
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Acciones (protegidas) */}
          <div
            className="pt-4"
            style={{ borderTop: "1px solid var(--color-linea)" }}
          >
            <div
              className="eyebrow mb-2"
              style={{ color: "var(--color-piedra)" }}
            >
              Acciones en {datos.nombre}
            </div>
            <div className="flex flex-wrap gap-2">
              <CTAProtegido
                etiqueta="Abrir hilo"
                etiquetaAnonimo="Entra para abrir hilo"
                razon="Abrir hilos en el Ágora del barrio requiere cuenta."
                tamano="sm"
                variant="primary"
              />
              <CTAProtegido
                etiqueta="Publicar recurso"
                etiquetaAnonimo="Entra para publicar"
                razon="Publicar recursos en Koiná requiere cuenta."
                tamano="sm"
                variant="ghost"
              />
              <CTAProtegido
                etiqueta="Marcar un bloque"
                etiquetaAnonimo="Entra para marcar"
                razon="Marcar bloques en el mapa requiere cuenta y contribuye a afinar la composición real del barrio."
                tamano="sm"
                variant="ghost"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
