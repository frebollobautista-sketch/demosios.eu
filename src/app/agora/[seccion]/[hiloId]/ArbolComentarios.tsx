"use client";

import { useState } from "react";

import type { ComentarioArbol } from "@/lib/agora/tipos";

import { CajaComentar } from "./CajaComentar";

type Props = {
  hiloId: string;
  seccionId: string;
  comentarios: ComentarioArbol[];
  pecsUsuario: Set<string>;
  puedeResponder: boolean;
};

export function ArbolComentarios({
  hiloId,
  seccionId,
  comentarios,
  pecsUsuario,
  puedeResponder,
}: Props) {
  if (comentarios.length === 0) return null;
  return (
    <ul className="mt-6 space-y-4">
      {comentarios.map((c) => (
        <Item
          key={c.id}
          c={c}
          hiloId={hiloId}
          seccionId={seccionId}
          pecsUsuario={pecsUsuario}
          puedeResponder={puedeResponder}
          nivel={0}
        />
      ))}
    </ul>
  );
}

function Item({
  c,
  hiloId,
  seccionId,
  pecsUsuario,
  puedeResponder,
  nivel,
}: {
  c: ComentarioArbol;
  hiloId: string;
  seccionId: string;
  pecsUsuario: Set<string>;
  puedeResponder: boolean;
  nivel: number;
}) {
  const [respondiendo, setRespondiendo] = useState(false);
  const yaPec = pecsUsuario.has(c.id);

  return (
    <li
      style={{
        marginLeft: nivel === 0 ? 0 : 16,
        paddingLeft: nivel === 0 ? 0 : 12,
        borderLeft: nivel === 0 ? "none" : "2px solid var(--color-linea)",
      }}
    >
      <div
        className="rounded-lg p-3"
        style={{
          background: "var(--color-papiro-soft)",
          border: "1px solid var(--color-linea)",
        }}
      >
        <div
          className="eyebrow flex items-center gap-2"
          style={{ color: "var(--color-piedra-clara)" }}
        >
          {c.autor && <span>@{c.autor.handle}</span>}
          <span>·</span>
          <span>{new Date(c.creado).toLocaleString("es-ES")}</span>
        </div>
        <p
          className="mt-2 whitespace-pre-wrap text-sm"
          style={{ color: "var(--color-papiro-ink)" }}
        >
          {c.cuerpo}
        </p>
        <div className="mt-2 flex items-center gap-3">
          {puedeResponder && (
            <button
              type="button"
              onClick={() => setRespondiendo((v) => !v)}
              className="eyebrow underline"
              style={{ color: "var(--color-ocre-deep)" }}
            >
              {respondiendo ? "Cerrar" : "Responder"}
            </button>
          )}
          <span
            className="eyebrow"
            style={{
              color: yaPec ? "var(--color-siena)" : "var(--color-piedra-clara)",
            }}
          >
            {c.pec_count} {c.pec_count === 1 ? "PEC" : "PECs"}
            {yaPec && " · tu PEC ✓"}
          </span>
        </div>

        {respondiendo && (
          <div className="mt-3">
            <CajaComentar
              hiloId={hiloId}
              seccionId={seccionId}
              parentId={c.id}
              cta="Responder"
              onCancelar={() => setRespondiendo(false)}
              onEnviado={() => setRespondiendo(false)}
            />
          </div>
        )}
      </div>

      {c.hijos.length > 0 && (
        <ul className="mt-3 space-y-3">
          {c.hijos.map((h) => (
            <Item
              key={h.id}
              c={h}
              hiloId={hiloId}
              seccionId={seccionId}
              pecsUsuario={pecsUsuario}
              puedeResponder={puedeResponder}
              nivel={nivel + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
