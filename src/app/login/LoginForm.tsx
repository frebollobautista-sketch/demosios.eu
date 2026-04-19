"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Metodo = "enlace" | "password";

/**
 * Formulario de login con dos métodos:
 * · "enlace" (magic link) — sin contraseña, Supabase envía un correo.
 * · "password" — email + contraseña clásico.
 *
 * Se aísla de la page porque usa `useSearchParams`, que obliga a
 * vivir dentro de un `<Suspense>` en Next.js 16 durante el prerender.
 */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";

  const [metodo, setMetodo] = useState<Metodo>("enlace");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [estado, setEstado] = useState<"idle" | "enviando" | "enviado" | "error">("idle");
  const [mensaje, setMensaje] = useState("");

  const origin = () =>
    process.env.NEXT_PUBLIC_SITE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");

  const enviarMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setEstado("enviando");
    setMensaje("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin()}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
        shouldCreateUser: false,
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

  const entrarConPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setEstado("enviando");
    setMensaje("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setEstado("error");
      setMensaje(error.message);
      return;
    }
    router.push(redirect);
    router.refresh();
  };

  const entrarConGoogle = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin()}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
      },
    });
  };

  return (
    <>
      {/* Selector de método */}
      <div
        role="tablist"
        className="mt-6 inline-flex rounded-lg p-1"
        style={{
          background: "var(--color-papiro-soft)",
          border: "1px solid var(--color-linea)",
        }}
      >
        <button
          role="tab"
          aria-selected={metodo === "enlace"}
          onClick={() => {
            setMetodo("enlace");
            setEstado("idle");
            setMensaje("");
          }}
          className="px-3 py-1.5 text-[0.86rem] rounded-md transition-colors"
          style={{
            background: metodo === "enlace" ? "var(--color-surface)" : "transparent",
            color:
              metodo === "enlace"
                ? "var(--color-papiro-ink)"
                : "var(--color-piedra)",
            fontWeight: metodo === "enlace" ? 600 : 500,
            boxShadow: metodo === "enlace" ? "var(--shadow-sutil)" : "none",
          }}
        >
          Con enlace al correo
        </button>
        <button
          role="tab"
          aria-selected={metodo === "password"}
          onClick={() => {
            setMetodo("password");
            setEstado("idle");
            setMensaje("");
          }}
          className="px-3 py-1.5 text-[0.86rem] rounded-md transition-colors"
          style={{
            background:
              metodo === "password" ? "var(--color-surface)" : "transparent",
            color:
              metodo === "password"
                ? "var(--color-papiro-ink)"
                : "var(--color-piedra)",
            fontWeight: metodo === "password" ? 600 : 500,
            boxShadow: metodo === "password" ? "var(--shadow-sutil)" : "none",
          }}
        >
          Con contraseña
        </button>
      </div>

      {metodo === "enlace" ? (
        <form onSubmit={enviarMagicLink} className="mt-4 space-y-3">
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
          <p
            className="text-[0.78rem]"
            style={{ color: "var(--color-piedra-clara)" }}
          >
            Sin contraseña. Te llega un enlace al correo, pulsas y entras.
          </p>
        </form>
      ) : (
        <form onSubmit={entrarConPassword} className="mt-4 space-y-3">
          <label className="block">
            <span className="eyebrow block mb-1">Correo electrónico</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={estado === "enviando"}
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
          <label className="block">
            <span className="eyebrow block mb-1">Contraseña</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={estado === "enviando"}
              autoComplete="current-password"
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
            disabled={!email || !password || estado === "enviando"}
            className="w-full h-11 rounded-md font-semibold text-[0.95rem] transition-opacity disabled:opacity-60"
            style={{
              background: "var(--color-ocre-deep)",
              color: "var(--color-surface)",
            }}
          >
            {estado === "enviando" ? "Entrando..." : "Entrar"}
          </button>
          <p
            className="text-[0.78rem]"
            style={{ color: "var(--color-piedra-clara)" }}
          >
            ¿No tienes cuenta todavía?{" "}
            <Link
              href="/registro"
              className="underline"
              style={{ color: "var(--color-ocre-deep)" }}
            >
              Créala en un minuto
            </Link>
            .
          </p>
        </form>
      )}

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
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.5-5.2l-6.2-5.3c-1.9 1.3-4.4 2.1-7.3 2.1-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l.1-.1 6.2 5.3c-.4.4 6.7-4.9 6.7-14.7 0-1.3-.1-2.4-.4-3.5z" />
        </svg>
        Entrar con Google
      </button>
    </>
  );
}
