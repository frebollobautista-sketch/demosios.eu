"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  actualizarPreferencia,
  type Preferencias,
} from "@/lib/ajustes/queries";

/**
 * Componentes con persistencia real en Supabase (columnas de `profiles`).
 *
 * Patrón: optimistic update + rollback si falla. El error es raro porque
 * RLS solo permite que el usuario actualice su propia fila, pero si la
 * sesión ha expirado podemos ver fallos.
 */

type ToggleBoolKey = {
  [K in keyof Preferencias]: Preferencias[K] extends boolean ? K : never;
}[keyof Preferencias];

export function ToggleReal({
  userId,
  campo,
  inicial,
  label,
  descripcion,
}: {
  userId: string;
  campo: ToggleBoolKey;
  inicial: boolean;
  label: string;
  descripcion?: string;
}) {
  const [valor, setValor] = useState(inicial);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const cambiar = async () => {
    if (enviando) return;
    const nuevo = !valor;
    setValor(nuevo);
    setEnviando(true);
    setMensaje(null);
    try {
      const supabase = createClient();
      await actualizarPreferencia(supabase, userId, campo, nuevo);
    } catch (e) {
      console.warn("actualizarPreferencia falló:", e);
      setValor(valor); // rollback
      setMensaje("No se pudo guardar — intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="py-2.5">
      <label className="flex items-start justify-between gap-3 cursor-pointer">
        <div className="flex-1 min-w-0">
          <span
            className="text-[0.92rem]"
            style={{ color: "var(--color-papiro-ink)", fontWeight: 500 }}
          >
            {label}
          </span>
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
          onClick={cambiar}
          disabled={enviando}
          role="switch"
          aria-checked={valor}
          className="relative shrink-0 mt-1 disabled:opacity-60"
          style={{
            width: 36,
            height: 20,
            borderRadius: 999,
            background: valor
              ? "var(--color-ocre-deep)"
              : "var(--color-papiro-soft)",
            border: "1px solid var(--color-linea)",
            transition: "background 0.15s",
          }}
        >
          <span
            className="absolute"
            style={{
              top: 1,
              left: valor ? 17 : 1,
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
      {mensaje && (
        <p
          className="text-[0.78rem] mt-1"
          style={{ color: "#a04030" }}
          role="alert"
        >
          {mensaje}
        </p>
      )}
    </div>
  );
}

type RadioRealKey = {
  [K in keyof Preferencias]: Preferencias[K] extends string ? K : never;
}[keyof Preferencias];

export function RadioReal<K extends RadioRealKey>({
  userId,
  campo,
  inicial,
  opciones,
  label,
  descripcion,
}: {
  userId: string;
  campo: K;
  inicial: Preferencias[K];
  opciones: { value: Preferencias[K]; label: string }[];
  label: string;
  descripcion?: string;
}) {
  const [valor, setValor] = useState<Preferencias[K]>(inicial);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const cambiar = async (nuevo: Preferencias[K]) => {
    if (enviando || nuevo === valor) return;
    const anterior = valor;
    setValor(nuevo);
    setEnviando(true);
    setMensaje(null);
    try {
      const supabase = createClient();
      await actualizarPreferencia(supabase, userId, campo, nuevo);
    } catch (e) {
      console.warn("actualizarPreferencia falló:", e);
      setValor(anterior);
      setMensaje("No se pudo guardar — intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="py-2.5">
      <div
        className="text-[0.92rem] mb-1"
        style={{ color: "var(--color-papiro-ink)", fontWeight: 500 }}
      >
        {label}
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
            key={String(o.value)}
            type="button"
            onClick={() => cambiar(o.value)}
            disabled={enviando}
            className="px-3 py-1 rounded-md text-[0.82rem] transition-colors disabled:opacity-60"
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
              fontWeight: valor === o.value ? 600 : 500,
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
      {mensaje && (
        <p
          className="text-[0.78rem] mt-1"
          style={{ color: "#a04030" }}
          role="alert"
        >
          {mensaje}
        </p>
      )}
    </div>
  );
}
