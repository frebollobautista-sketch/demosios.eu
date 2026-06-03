"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { mensajeAuth } from "@/lib/auth/errores";

/**
 * /recuperar — solicitar un enlace para restablecer la contraseña.
 *
 * Supabase envía un correo con un enlace que vuelve a /auth/callback,
 * que intercambia el code por sesión y redirige a /auth/restablecer,
 * donde el usuario fija su nueva contraseña.
 */
export default function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<"idle" | "enviando" | "enviado" | "error">(
    "idle",
  );
  const [mensaje, setMensaje] = useState("");

  const origin = () =>
    process.env.NEXT_PUBLIC_SITE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setEstado("enviando");
    setMensaje("");
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin()}/auth/callback?redirect=/auth/restablecer`,
    });
    if (error) {
      setEstado("error");
      setMensaje(mensajeAuth(error));
      return;
    }
    setEstado("enviado");
    setMensaje(
      "Si ese correo tiene una cuenta, te hemos enviado un enlace para cambiar la contraseña. Revisa tu bandeja (y el spam).",
    );
  };

  return (
    <div className="mx-auto max-w-md px-4 sm:px-6 py-12 pb-40">
      <div className="eyebrow">Recuperar acceso</div>
      <h1
        className="display mt-1 text-[clamp(1.6rem,3vw,2rem)]"
        style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
      >
        ¿Has olvidado la contraseña?
      </h1>
      <p className="mt-3 text-[0.95rem]" style={{ color: "var(--color-piedra)" }}>
        Escribe tu correo y te enviamos un enlace para crear una nueva.
      </p>

      <form onSubmit={enviar} className="mt-6 space-y-3">
        <label className="block">
          <span className="eyebrow block mb-1">Correo electrónico</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={estado === "enviando" || estado === "enviado"}
            placeholder="tu@correo.es"
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
          disabled={!email || estado === "enviando" || estado === "enviado"}
          className="w-full h-11 rounded-md font-semibold text-[0.95rem] transition-opacity disabled:opacity-60"
          style={{ background: "var(--color-ocre-deep)", color: "var(--color-surface)" }}
        >
          {estado === "enviando"
            ? "Enviando…"
            : estado === "enviado"
              ? "Enlace enviado ✓"
              : "Enviarme el enlace"}
        </button>
      </form>

      {mensaje && (
        <p
          className="mt-3 text-[0.88rem]"
          style={{
            color:
              estado === "error" ? "var(--color-sangre)" : "var(--color-oliva)",
          }}
        >
          {mensaje}
        </p>
      )}

      <p
        className="mt-8 text-[0.82rem]"
        style={{ color: "var(--color-piedra-clara)" }}
      >
        Volver a{" "}
        <Link
          href="/login"
          className="underline"
          style={{ color: "var(--color-ocre-deep)" }}
        >
          Iniciar sesión
        </Link>
        .
      </p>
    </div>
  );
}
