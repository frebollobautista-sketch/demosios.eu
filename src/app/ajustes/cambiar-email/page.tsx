"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { mensajeAuth } from "@/lib/auth/errores";

/**
 * /ajustes/cambiar-email — cambia el correo de la cuenta.
 *
 * Supabase envía un enlace de confirmación al correo NUEVO (y, según la
 * configuración del proyecto, también al antiguo). El cambio no es efectivo
 * hasta que se confirma desde el correo.
 */
export default function CambiarEmailPage() {
  const [emailActual, setEmailActual] = useState("");
  const [nuevo, setNuevo] = useState("");
  const [estado, setEstado] = useState<"idle" | "enviando" | "ok" | "error">(
    "idle",
  );
  const [mensaje, setMensaje] = useState("");

  const origin = () =>
    process.env.NEXT_PUBLIC_SITE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmailActual(data.user?.email ?? "");
    });
  }, []);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevo) return;
    if (nuevo.toLowerCase() === emailActual.toLowerCase()) {
      setEstado("error");
      setMensaje("Ese ya es tu correo actual.");
      return;
    }
    setEstado("enviando");
    setMensaje("");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser(
      { email: nuevo },
      { emailRedirectTo: `${origin()}/auth/callback?redirect=/ajustes` },
    );
    if (error) {
      setEstado("error");
      setMensaje(mensajeAuth(error));
      return;
    }
    setEstado("ok");
    setMensaje(
      "Te hemos enviado un enlace de confirmación al correo nuevo. El cambio se aplica cuando pulses ese enlace.",
    );
  };

  return (
    <Marco titulo="Cambiar correo" volver>
      <p className="text-[0.9rem] mb-4" style={{ color: "var(--color-piedra)" }}>
        Correo actual:{" "}
        <strong style={{ color: "var(--color-papiro-ink)" }}>
          {emailActual || "—"}
        </strong>
      </p>
      <form onSubmit={guardar} className="space-y-3">
        <label className="block">
          <span className="eyebrow block mb-1">Nuevo correo</span>
          <input
            type="email"
            required
            value={nuevo}
            onChange={(e) => setNuevo(e.target.value)}
            disabled={estado === "enviando" || estado === "ok"}
            placeholder="nuevo@correo.es"
            autoComplete="email"
            className="w-full h-11 rounded-md px-3 text-[0.95rem] outline-none"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-linea)",
              color: "var(--color-papiro-ink)",
            }}
          />
        </label>
        <button
          type="submit"
          disabled={!nuevo || estado === "enviando" || estado === "ok"}
          className="h-11 px-5 rounded-md font-semibold text-[0.95rem] disabled:opacity-60"
          style={{ background: "var(--color-ocre-deep)", color: "var(--color-surface)" }}
        >
          {estado === "enviando" ? "Enviando…" : "Enviar confirmación"}
        </button>
      </form>
      <Aviso estado={estado} mensaje={mensaje} />
    </Marco>
  );
}

export function Marco({
  titulo,
  children,
  volver,
}: {
  titulo: string;
  children: React.ReactNode;
  volver?: boolean;
}) {
  return (
    <div className="mx-auto max-w-md px-4 sm:px-6 py-10 pb-40">
      {volver && (
        <Link
          href="/ajustes"
          className="text-[0.82rem] underline"
          style={{ color: "var(--color-ocre-deep)" }}
        >
          ← Volver a Ajustes
        </Link>
      )}
      <h1
        className="display mt-3 text-[clamp(1.5rem,3vw,1.9rem)]"
        style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
      >
        {titulo}
      </h1>
      <div className="divisor my-6" />
      {children}
    </div>
  );
}

export function Aviso({
  estado,
  mensaje,
}: {
  estado: string;
  mensaje: string;
}) {
  if (!mensaje) return null;
  return (
    <p
      className="mt-3 text-[0.88rem]"
      style={{
        color: estado === "error" ? "var(--color-sangre)" : "var(--color-oliva)",
      }}
    >
      {mensaje}
    </p>
  );
}
