"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import type { Categoria } from "@/lib/pharos/categorias";
import type { Isla, Municipio } from "@/lib/territorio/canarias";

type Valores = {
  categoria: string;
  isla: string;
  municipio: string;
  barrio: string;
  orden: "recientes" | "actividad" | "pec";
};

type Props = {
  seccionId: string;
  categorias: Categoria[];
  islas: Isla[];
  municipios: Municipio[];
  valores: Valores;
};

export function FiltrosSeccion({
  seccionId,
  categorias,
  islas,
  municipios,
  valores,
}: Props) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();

  function aplicar(parcial: Partial<Valores>) {
    const next: Valores = { ...valores, ...parcial };
    // Resetear municipio/barrio si cambia isla; resetear barrio si cambia municipio.
    if (parcial.isla !== undefined && parcial.isla !== valores.isla) {
      next.municipio = "";
      next.barrio = "";
    }
    if (parcial.municipio !== undefined && parcial.municipio !== valores.municipio) {
      next.barrio = "";
    }

    const params = new URLSearchParams();
    if (next.categoria) params.set("categoria", next.categoria);
    if (next.isla) params.set("isla", next.isla);
    if (next.municipio) params.set("municipio", next.municipio);
    if (next.barrio) params.set("barrio", next.barrio);
    if (next.orden && next.orden !== "actividad") params.set("orden", next.orden);

    const qs = params.toString();
    startTransition(() => {
      router.push(`/agora/${seccionId}${qs ? `?${qs}` : ""}`);
    });
  }

  function limpiar() {
    startTransition(() => {
      router.push(`/agora/${seccionId}`);
    });
  }

  const muniSeleccionado = valores.municipio
    ? municipios.find((m) => m.id === valores.municipio)
    : null;
  const barriosDisponibles = muniSeleccionado?.barrios ?? [];

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: "var(--color-papiro-soft)",
        border: "1px solid var(--color-linea)",
      }}
    >
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <CampoSelect
          label="Categoría local"
          value={valores.categoria}
          onChange={(v) => aplicar({ categoria: v })}
          options={[
            { value: "", label: "Todas" },
            ...categorias.map((c) => ({ value: c.id, label: `${c.icono} ${c.nombre}` })),
          ]}
        />
        <CampoSelect
          label="Isla"
          value={valores.isla}
          onChange={(v) => aplicar({ isla: v })}
          options={[
            { value: "", label: "Todas" },
            ...islas.map((i) => ({ value: i.id, label: `${i.emoji} ${i.nombre}` })),
          ]}
        />
        <CampoSelect
          label="Municipio"
          value={valores.municipio}
          onChange={(v) => aplicar({ municipio: v })}
          disabled={!valores.isla}
          options={[
            { value: "", label: valores.isla ? "Todos" : "—" },
            ...municipios.map((m) => ({ value: m.id, label: m.nombre })),
          ]}
        />
        <CampoSelect
          label="Barrio"
          value={valores.barrio}
          onChange={(v) => aplicar({ barrio: v })}
          disabled={!valores.municipio || barriosDisponibles.length === 0}
          options={[
            {
              value: "",
              label:
                !valores.municipio
                  ? "—"
                  : barriosDisponibles.length === 0
                    ? "Sin barrios"
                    : "Todos",
            },
            ...barriosDisponibles.map((b) => ({ value: b.id, label: b.nombre })),
          ]}
        />
        <CampoSelect
          label="Orden"
          value={valores.orden}
          onChange={(v) => aplicar({ orden: v as Valores["orden"] })}
          options={[
            { value: "actividad", label: "Última actividad" },
            { value: "recientes", label: "Más recientes" },
            { value: "pec", label: "Más respaldados" },
          ]}
        />
      </div>

      {(valores.categoria || valores.isla || valores.orden !== "actividad") && (
        <button
          type="button"
          onClick={limpiar}
          className="eyebrow mt-3 underline"
          style={{ color: "var(--color-piedra)" }}
          disabled={pendiente}
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}

function CampoSelect({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col text-xs" style={{ color: "var(--color-piedra)" }}>
      <span className="eyebrow mb-1">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="rounded-md px-2 py-1.5 text-sm"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-linea)",
          color: "var(--color-papiro-ink)",
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
