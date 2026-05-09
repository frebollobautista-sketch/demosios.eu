"use client";

import { useEffect, useState } from "react";

/**
 * Toggle "demo" cuyo estado persiste solo en localStorage.
 * Usado para mostrar la UI de las funcionalidades que aún no tienen
 * persistencia real en BD (notificaciones, apariencia, etc.).
 *
 * Cuando la funcionalidad correspondiente exista, se sustituye por un
 * componente que persiste en `profiles.<columna>` (Supabase).
 */
export function ToggleDemo({
  storageKey,
  label,
  descripcion,
  defecto = false,
  soon = false,
}: {
  storageKey: string;
  label: string;
  descripcion?: string;
  defecto?: boolean;
  soon?: boolean;
}) {
  const [activo, setActivo] = useState(defecto);
  const [hidratado, setHidratado] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = window.localStorage.getItem(storageKey);
    if (v === "1") setActivo(true);
    if (v === "0") setActivo(false);
    setHidratado(true);
  }, [storageKey]);

  const cambiar = () => {
    const nuevo = !activo;
    setActivo(nuevo);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, nuevo ? "1" : "0");
    }
  };

  return (
    <label
      className={`flex items-start justify-between gap-3 py-2.5 ${
        soon ? "" : "cursor-pointer"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-[0.92rem]"
            style={{ color: "var(--color-papiro-ink)", fontWeight: 500 }}
          >
            {label}
          </span>
          {soon && (
            <span
              className="text-[0.65rem] tracking-wider px-1.5 py-0.5 rounded"
              style={{
                background: "var(--color-papiro-soft)",
                color: "var(--color-piedra)",
                textTransform: "uppercase",
              }}
            >
              Próx.
            </span>
          )}
        </div>
        {descripcion && (
          <p
            className="text-[0.78rem] mt-0.5"
            style={{ color: "var(--color-piedra)", lineHeight: 1.45 }}
          >
            {descripcion}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={soon ? undefined : cambiar}
        disabled={soon || !hidratado}
        role="switch"
        aria-checked={activo}
        className="relative shrink-0 mt-1 disabled:cursor-not-allowed"
        style={{
          width: 36,
          height: 20,
          borderRadius: 999,
          background: activo
            ? "var(--color-ocre-deep)"
            : "var(--color-papiro-soft)",
          border: "1px solid var(--color-linea)",
          opacity: soon ? 0.5 : 1,
          transition: "background 0.15s",
        }}
      >
        <span
          className="absolute"
          style={{
            top: 1,
            left: activo ? 17 : 1,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "var(--color-surface)",
            transition: "left 0.15s",
            boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
          }}
        />
      </button>
    </label>
  );
}

export function RadioDemo({
  storageKey,
  opciones,
  defecto,
  label,
  descripcion,
  soon = false,
}: {
  storageKey: string;
  opciones: { value: string; label: string }[];
  defecto: string;
  label: string;
  descripcion?: string;
  soon?: boolean;
}) {
  const [valor, setValor] = useState(defecto);
  const [hidratado, setHidratado] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = window.localStorage.getItem(storageKey);
    if (v) setValor(v);
    setHidratado(true);
  }, [storageKey]);

  const cambiar = (v: string) => {
    setValor(v);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, v);
    }
  };

  return (
    <div className="py-2.5">
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <span
          className="text-[0.92rem]"
          style={{ color: "var(--color-papiro-ink)", fontWeight: 500 }}
        >
          {label}
        </span>
        {soon && (
          <span
            className="text-[0.65rem] tracking-wider px-1.5 py-0.5 rounded"
            style={{
              background: "var(--color-papiro-soft)",
              color: "var(--color-piedra)",
              textTransform: "uppercase",
            }}
          >
            Próx.
          </span>
        )}
      </div>
      {descripcion && (
        <p
          className="text-[0.78rem] mb-2"
          style={{ color: "var(--color-piedra)", lineHeight: 1.45 }}
        >
          {descripcion}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {opciones.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => !soon && cambiar(o.value)}
            disabled={soon || !hidratado}
            className="px-3 py-1 rounded-md text-[0.82rem] transition-colors disabled:cursor-not-allowed"
            style={{
              background:
                valor === o.value
                  ? "var(--color-ocre-deep)"
                  : "var(--color-papiro-soft)",
              color:
                valor === o.value
                  ? "var(--color-surface)"
                  : "var(--color-piedra)",
              border: "1px solid var(--color-linea)",
              opacity: soon ? 0.5 : 1,
              fontWeight: valor === o.value ? 600 : 500,
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
