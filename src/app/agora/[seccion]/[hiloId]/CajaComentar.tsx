"use client";

import { useRef, useState, useTransition } from "react";

import { comentarAction } from "@/lib/agora/acciones";

type Props = {
  hiloId: string;
  seccionId: string;
  parentId?: string;
  /** Texto del botón. */
  cta?: string;
  /** Si está presente, callback al cancelar (para colapsar la caja en respuestas anidadas). */
  onCancelar?: () => void;
  /** Si está presente, callback al enviar exitosamente. */
  onEnviado?: () => void;
};

export function CajaComentar({
  hiloId,
  seccionId,
  parentId,
  cta = "Publicar comentario",
  onCancelar,
  onEnviado,
}: Props) {
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  function enviar(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const r = await comentarAction(formData);
      if (!r.ok) setError(r.error);
      else {
        if (ref.current) ref.current.value = "";
        onEnviado?.();
      }
    });
  }

  return (
    <form action={enviar} className="space-y-2">
      <input type="hidden" name="hiloId" value={hiloId} />
      <input type="hidden" name="seccion" value={seccionId} />
      {parentId && <input type="hidden" name="parentId" value={parentId} />}
      <textarea
        ref={ref}
        name="cuerpo"
        required
        minLength={1}
        maxLength={2000}
        rows={parentId ? 3 : 4}
        placeholder={parentId ? "Tu respuesta…" : "Tu comentario en este hilo…"}
        className="w-full rounded-lg p-3 text-sm"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-linea)",
          color: "var(--color-papiro-ink)",
        }}
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          style={{
            background: "var(--color-papiro-ink)",
            color: "var(--color-papiro)",
          }}
        >
          {pendiente ? "Enviando…" : cta}
        </button>
        {onCancelar && (
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-lg px-3 py-1.5 text-sm"
            style={{ color: "var(--color-piedra)" }}
          >
            Cancelar
          </button>
        )}
        {error && (
          <span className="text-sm" style={{ color: "var(--color-sangre)" }}>
            {error}
          </span>
        )}
      </div>
    </form>
  );
}
