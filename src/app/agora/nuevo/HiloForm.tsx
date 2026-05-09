"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { crearHilo } from "@/lib/agora/queries";
import { SECCIONES } from "@/lib/pharos/secciones";

/**
 * Formulario cliente para crear un hilo en Ágora.
 * Modo `debate` por defecto. Los modos propuesta_decidim y consenso_polis
 * se añadirán en iteración 2.
 */
export function HiloForm({ seccionInicial }: { seccionInicial?: string }) {
  const router = useRouter();
  const [titulo, setTitulo] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [seccion, setSeccion] = useState(seccionInicial || SECCIONES[0].id);
  const [estado, setEstado] = useState<"idle" | "enviando" | "error">("idle");
  const [mensaje, setMensaje] = useState("");

  const tituloOk = titulo.trim().length >= 6 && titulo.trim().length <= 160;
  const cuerpoOk = cuerpo.trim().length >= 1 && cuerpo.trim().length <= 4000;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tituloOk || !cuerpoOk) {
      setEstado("error");
      setMensaje("Título 6–160 caracteres, cuerpo hasta 4000.");
      return;
    }
    setEstado("enviando");
    setMensaje("");
    try {
      const supabase = createClient();
      const { id } = await crearHilo(supabase, {
        titulo,
        cuerpo,
        seccion_pharos: seccion,
        modo: "debate",
      });
      router.push(`/agora/hilo/${id}`);
      router.refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      setEstado("error");
      setMensaje(msg);
    }
  };

  return (
    <form onSubmit={enviar} className="space-y-5" noValidate>
      <div>
        <label className="block text-[0.85rem] font-semibold mb-1.5"
          style={{ color: "var(--color-papiro-ink)" }}
        >
          Sección
        </label>
        <select
          value={seccion}
          onChange={(e) => setSeccion(e.target.value)}
          className="w-full rounded-md px-3 py-2 text-[0.95rem]"
          style={inputStyle}
        >
          {SECCIONES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.icono} {s.nombre}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          className="flex items-baseline justify-between mb-1.5"
        >
          <span
            className="text-[0.85rem] font-semibold"
            style={{ color: "var(--color-papiro-ink)" }}
          >
            Título
          </span>
          <span
            className="text-[0.75rem] tabular-nums"
            style={{
              color:
                titulo.length > 0 && !tituloOk
                  ? "#a04030"
                  : "var(--color-piedra-clara)",
            }}
          >
            {titulo.trim().length} / 160
          </span>
        </label>
        <input
          type="text"
          required
          maxLength={160}
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Una pregunta concreta o una afirmación que invite a debate"
          className="w-full rounded-md px-3 py-2 text-[0.95rem]"
          style={inputStyle}
        />
      </div>

      <div>
        <label
          className="flex items-baseline justify-between mb-1.5"
        >
          <span
            className="text-[0.85rem] font-semibold"
            style={{ color: "var(--color-papiro-ink)" }}
          >
            Cuerpo
          </span>
          <span
            className="text-[0.75rem] tabular-nums"
            style={{
              color:
                cuerpo.length > 0 && !cuerpoOk
                  ? "#a04030"
                  : "var(--color-piedra-clara)",
            }}
          >
            {cuerpo.trim().length} / 4000
          </span>
        </label>
        <textarea
          required
          rows={8}
          value={cuerpo}
          onChange={(e) => setCuerpo(e.target.value)}
          placeholder="Contexto, datos, posición. Cuanto más concreto, más útil. Markdown ligero permitido (** para negrita, * para cursiva)."
          className="w-full rounded-md px-3 py-2 text-[0.95rem] leading-relaxed"
          style={inputStyle}
        />
      </div>

      {estado === "error" && (
        <p
          className="text-[0.9rem] rounded-md px-3 py-2"
          style={{
            background: "rgba(196, 90, 74, 0.08)",
            border: "1px solid rgba(196, 90, 74, 0.4)",
            color: "#a04030",
          }}
          role="alert"
        >
          {mensaje}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={estado === "enviando" || !tituloOk || !cuerpoOk}
          className="px-5 py-2.5 rounded-md text-[0.95rem] font-semibold disabled:opacity-50"
          style={{
            background: "var(--color-ocre-deep)",
            color: "var(--color-surface)",
          }}
        >
          {estado === "enviando" ? "Publicando…" : "Publicar hilo"}
        </button>
        <p
          className="text-[0.78rem]"
          style={{ color: "var(--color-piedra-clara)" }}
        >
          Tu hilo será público. Puedes editarlo o cerrarlo después.
        </p>
      </div>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--color-papiro)",
  border: "1px solid var(--color-linea)",
  color: "var(--color-papiro-ink)",
  outline: "none",
};
