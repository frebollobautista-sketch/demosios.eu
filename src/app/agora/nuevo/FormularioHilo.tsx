"use client";

import { useState } from "react";

import { crearHiloYRedirigir } from "@/lib/agora/acciones";
import type { Categoria } from "@/lib/pharos/categorias";
import type { Seccion } from "@/lib/pharos/secciones";
import type { Isla } from "@/lib/territorio/canarias";

type Props = {
  secciones: Seccion[];
  categorias: Categoria[];
  islas: Isla[];
  seccionInicial: string;
};

export function FormularioHilo({
  secciones,
  categorias,
  islas,
  seccionInicial,
}: Props) {
  const [seccion, setSeccion] = useState(seccionInicial);
  const [islaId, setIslaId] = useState<string>("");
  const [municipioId, setMunicipioId] = useState<string>("");
  const [barrioId, setBarrioId] = useState<string>("");

  const isla = islas.find((i) => i.id === islaId) ?? null;
  const municipio =
    isla?.municipios.find((m) => m.id === municipioId) ?? null;

  return (
    <form action={crearHiloYRedirigir} className="mt-6 space-y-5">
      <Campo label="Título" hint="Entre 6 y 160 caracteres. Sé concreto.">
        <input
          type="text"
          name="titulo"
          required
          minLength={6}
          maxLength={160}
          placeholder="¿Qué necesita ser dicho?"
          className="w-full rounded-md p-2 text-sm"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-linea)",
            color: "var(--color-papiro-ink)",
          }}
        />
      </Campo>

      <Campo label="Cuerpo" hint="Hasta 4000 caracteres. Markdown ligero.">
        <textarea
          name="cuerpo"
          required
          minLength={1}
          maxLength={4000}
          rows={8}
          placeholder="Plantea el tema con datos, antecedentes, preguntas abiertas. La buena deliberación se cuida desde el primer mensaje."
          className="w-full rounded-md p-2 text-sm"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-linea)",
            color: "var(--color-papiro-ink)",
          }}
        />
      </Campo>

      <div>
        <span
          className="eyebrow block mb-2"
          style={{ color: "var(--color-piedra)" }}
        >
          Sección PHAROS (obligatoria)
        </span>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {secciones.map((s) => {
            const seleccionada = seccion === s.id;
            return (
              <label
                key={s.id}
                className="cursor-pointer rounded-md p-2 text-xs"
                style={{
                  background: seleccionada ? s.color : "var(--color-surface)",
                  border: `1px solid ${seleccionada ? s.colorTexto : "var(--color-linea)"}`,
                  color: seleccionada ? s.colorTexto : "var(--color-papiro-ink)",
                }}
              >
                <input
                  type="radio"
                  name="seccion"
                  value={s.id}
                  checked={seleccionada}
                  onChange={() => setSeccion(s.id)}
                  className="sr-only"
                />
                <span aria-hidden className="mr-1">
                  {s.icono}
                </span>
                {s.nombre}
              </label>
            );
          })}
        </div>
      </div>

      <Campo label="Categoría local (opcional)">
        <select
          name="categoria"
          defaultValue=""
          className="w-full rounded-md p-2 text-sm"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-linea)",
            color: "var(--color-papiro-ink)",
          }}
        >
          <option value="">— Sin categoría local —</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icono} {c.nombre}
            </option>
          ))}
        </select>
      </Campo>

      <div>
        <span
          className="eyebrow block mb-2"
          style={{ color: "var(--color-piedra)" }}
        >
          Ámbito territorial (opcional, jerárquico)
        </span>
        <div className="grid grid-cols-3 gap-2">
          <select
            name="isla"
            value={islaId}
            onChange={(e) => {
              setIslaId(e.target.value);
              setMunicipioId("");
              setBarrioId("");
            }}
            className="rounded-md p-2 text-sm"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-linea)",
              color: "var(--color-papiro-ink)",
            }}
          >
            <option value="">— Isla —</option>
            {islas.map((i) => (
              <option key={i.id} value={i.id}>
                {i.emoji} {i.nombre}
              </option>
            ))}
          </select>

          <select
            name="municipio"
            value={municipioId}
            onChange={(e) => {
              setMunicipioId(e.target.value);
              setBarrioId("");
            }}
            disabled={!isla}
            className="rounded-md p-2 text-sm disabled:opacity-50"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-linea)",
              color: "var(--color-papiro-ink)",
            }}
          >
            <option value="">— Municipio —</option>
            {(isla?.municipios ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>

          <select
            name="barrio"
            value={barrioId}
            onChange={(e) => setBarrioId(e.target.value)}
            disabled={!municipio || municipio.barrios.length === 0}
            className="rounded-md p-2 text-sm disabled:opacity-50"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-linea)",
              color: "var(--color-papiro-ink)",
            }}
          >
            <option value="">
              {!municipio
                ? "— Barrio —"
                : municipio.barrios.length === 0
                  ? "Sin barrios mapeados"
                  : "— Barrio —"}
            </option>
            {(municipio?.barrios ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="submit"
        className="rounded-lg px-4 py-2 text-sm font-medium"
        style={{
          background: "var(--color-papiro-ink)",
          color: "var(--color-papiro)",
        }}
      >
        Abrir hilo
      </button>
    </form>
  );
}

function Campo({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span
        className="eyebrow block mb-1"
        style={{ color: "var(--color-piedra)" }}
      >
        {label}
      </span>
      {children}
      {hint && (
        <span
          className="mt-1 block text-[0.72rem]"
          style={{ color: "var(--color-piedra-clara)" }}
        >
          {hint}
        </span>
      )}
    </label>
  );
}
