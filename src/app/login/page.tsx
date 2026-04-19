"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<"idle" | "enviando" | "enviado" | "error">("idle");
  const [mensaje, setMensaje] = useState("");

  const enviarMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setEstado("enviando");
    setMensaje("");
    const supabase = createClient();
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (typeof window !== "undefined" ? window.location.origin : "");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
      },
    });
    if (error) {
      setEstado("error");
      setMensaje(error.message);
      return;
    }
    setEstado("enviado");
    setMensaje("Revisa tu correo y pulsa el enlace para entrar.");
  };

  const entrarConGoogle = async () => {
    const supabase = createClient();
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (typeof window !== "undefined" ? window.location.origin : "");
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
      },
    });
  };

  return (
    <div className="mx-auto max-w-md px-4 sm:px-6 py-12 pb-40">
      <div className="eyebrow">Entrar a OCRE</div>
      <h1
        className="display mt-1 text-[clamp(1.6rem,3vw,2rem)]"
        style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
      >
        Te mandamos un enlace al correo
      </h1>
      <p
        className="mt-3 text-[0.95rem]"
        style={{ color: "var(--color-piedra)" }}
      >
        Sin contraseña. Introduces tu email, te llega un enlace, pulsas y entras.
        Tu sesión dura hasta que cierres.
      </p>

      <form onSubmit={enviarMagicLink} className="mt-6 space-y-3">
        <label className="block">
          <span className="eyebrow block mb-1">Correo electrónico</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={estado === "enviando" || estado === "enviado"}
            placeholder="tu@correo.es"
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
          style={{
            background: "var(--color-ocre-deep)",
            color: "var(--color-surface)",
          }}
        >
          {estado === "enviando"
            ? "Enviando..."
            : estado === "enviado"
            ? "Enlace enviado ✓"
            : "Enviarme el enlace"}
        </button>
      </form>

      {mensaje && (
        <p
          className="mt-3 text-[0.88rem]"
          style={{
            color: estado === "error" ? "var(--color-sangre)" : "var(--color-oliva)",
          }}
        >
          {mensaje}
        </p>
      )}

      <div className="my-6 flex items-center gap-3" aria-hidden>
        <span className="flex-1 h-px" style={{ background: "var(--color-linea)" }} />
        <span className="eyebrow" style={{ color: "var(--color-piedra-clara)" }}>
          o
        </span>
        <span className="flex-1 h-px" style={{ background: "var(--color-linea)" }} />
      </div>

      <button
        onClick={entrarConGoogle}
        className="w-full h-11 rounded-md font-semibold text-[0.95rem] inline-flex items-center justify-center gap-2"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-linea)",
          color: "var(--color-papiro-ink)",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/>
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.5-5.2l-6.2-5.3c-1.9 1.3-4.4 2.1-7.3 2.1-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l.1-.1 6.2 5.3c-.4.4 6.7-4.9 6.7-14.7 0-1.3-.1-2.4-.4-3.5z"/>
        </svg>
        Entrar con Google
      </button>

      <p
        className="mt-8 text-[0.82rem]"
        style={{ color: "var(--color-piedra-clara)" }}
      >
        Volver a{" "}
        <Link
          href="/"
          className="underline"
          style={{ color: "var(--color-ocre-deep)" }}
        >
          Inicio
        </Link>
        .
      </p>
    </div>
  );
}
