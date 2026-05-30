"use client";

import { useState, useTransition } from "react";

import { promoverHiloAction } from "@/lib/agora/acciones";

type Modo = "propuesta_decidim" | "consenso_polis";

type Props = {
  hiloId: string;
  seccionId: string;
};

export function PromoverHilo({ hiloId, seccionId }: Props) {
  const [abierto, setAbierto] = useState<Modo | null>(null);
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function enviar(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const r = await promoverHiloAction(formData);
      if (!r.ok) setError(r.error);
      else {
        // Recargar para mostrar el nuevo modo.
        window.location.reload();
      }
    });
  }

  return (
    <section
      className="rounded-xl p-4"
      style={{
        background: "var(--color-papiro-soft)",
        border: "1px dashed var(--color-linea)",
      }}
    >
      <div
        className="eyebrow"
        style={{ color: "var(--color-piedra)" }}
      >
        ¿El debate ha madurado?
      </div>
      <p className="text-sm mt-1" style={{ color: "var(--color-papiro-ink)" }}>
        Promueve tu hilo para que se pueda <b>votar una decisión concreta</b>{" "}
        (Decidim) o para <b>mapear consensos</b> con propuestas cortas (Polis).
        Los comentarios actuales se conservan.
      </p>

      {abierto === null && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAbierto("propuesta_decidim")}
            className="rounded-lg px-3 py-1.5 text-sm font-medium"
            style={{ background: "#1D4ED8", color: "white" }}
          >
            → Propuesta votable
          </button>
          <button
            type="button"
            onClick={() => setAbierto("consenso_polis")}
            className="rounded-lg px-3 py-1.5 text-sm font-medium"
            style={{ background: "#7E22CE", color: "white" }}
          >
            → Consenso (microfrases)
          </button>
        </div>
      )}

      {abierto === "propuesta_decidim" && (
        <form action={enviar} className="mt-4 space-y-3">
          <input type="hidden" name="hiloId" value={hiloId} />
          <input type="hidden" name="modo" value="propuesta_decidim" />
          <input type="hidden" name="seccion" value={seccionId} />
          <Campo label="Texto exacto a votar (1–1000)">
            <textarea
              name="decisionTexto"
              required
              minLength={1}
              maxLength={1000}
              rows={3}
              placeholder="Ej.: 'El Paseo de Las Canteras debe ser 100 % peatonal.'"
              className="w-full rounded-md p-2 text-sm"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-linea)",
              }}
            />
          </Campo>
          <Campo label="Fundamentación (opcional)">
            <textarea
              name="decisionFundamentacion"
              maxLength={4000}
              rows={3}
              placeholder="Contexto, datos, antecedentes…"
              className="w-full rounded-md p-2 text-sm"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-linea)",
              }}
            />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Días abiertos a voto">
              <input
                type="number"
                name="decisionDias"
                defaultValue={7}
                min={1}
                max={60}
                className="w-full rounded-md p-2 text-sm"
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-linea)",
                }}
              />
            </Campo>
            <Campo label="Quórum mínimo (vacío = ninguno)">
              <input
                type="number"
                name="decisionQuorum"
                min={0}
                placeholder="Ej.: 30"
                className="w-full rounded-md p-2 text-sm"
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-linea)",
                }}
              />
            </Campo>
          </div>
          <BotonesFormulario
            pendiente={pendiente}
            error={error}
            onCancelar={() => setAbierto(null)}
            cta="Promover a propuesta"
            color="#1D4ED8"
          />
        </form>
      )}

      {abierto === "consenso_polis" && (
        <form action={enviar} className="mt-4">
          <input type="hidden" name="hiloId" value={hiloId} />
          <input type="hidden" name="modo" value="consenso_polis" />
          <input type="hidden" name="seccion" value={seccionId} />
          <p className="text-sm" style={{ color: "var(--color-piedra)" }}>
            El hilo cambia a modo Consenso. Cualquiera podrá añadir
            microfrases votables. No hace falta más configuración.
          </p>
          <BotonesFormulario
            pendiente={pendiente}
            error={error}
            onCancelar={() => setAbierto(null)}
            cta="Promover a consenso"
            color="#7E22CE"
          />
        </form>
      )}
    </section>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span
        className="eyebrow block mb-1"
        style={{ color: "var(--color-piedra)" }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function BotonesFormulario({
  pendiente,
  error,
  onCancelar,
  cta,
  color,
}: {
  pendiente: boolean;
  error: string | null;
  onCancelar: () => void;
  cta: string;
  color: string;
}) {
  return (
    <div className="mt-3 flex items-center gap-2">
      <button
        type="submit"
        disabled={pendiente}
        className="rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        style={{ background: color, color: "white" }}
      >
        {pendiente ? "Promoviendo…" : cta}
      </button>
      <button
        type="button"
        onClick={onCancelar}
        className="rounded-lg px-3 py-1.5 text-sm"
        style={{ color: "var(--color-piedra)" }}
      >
        Cancelar
      </button>
      {error && (
        <span className="text-sm" style={{ color: "var(--color-sangre)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
