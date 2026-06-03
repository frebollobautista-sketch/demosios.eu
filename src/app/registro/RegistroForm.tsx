"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { mensajeAuth } from "@/lib/auth/errores";
import {
  HANDLE_REGEX,
  handleDisponible,
  normalizarHandle,
} from "@/lib/auth/handle";

/**
 * Registro formal con email + contraseña + handle.
 *
 * Handle normalizado: solo letras, números y guiones bajos, 3-30 chars.
 * Si el handle ya existe, Supabase devuelve error del CHECK UNIQUE en
 * profiles (se muestra al usuario).
 *
 * Sin barrio. Sin display name obligatorio. El trigger `handle_new_user`
 * crea la fila en `profiles` automáticamente cuando Supabase confirma
 * el signup — si el usuario pasó `handle` en raw_user_meta_data, lo usa.
 */
export function RegistroForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [handle, setHandle] = useState("");
  const [estado, setEstado] = useState<"idle" | "enviando" | "enviado" | "error">("idle");
  const [mensaje, setMensaje] = useState("");

  // Disponibilidad de handle en tiempo real.
  const [dispo, setDispo] = useState<
    "idle" | "comprobando" | "disponible" | "ocupado" | "formato" | "error"
  >("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleValido = (h: string) => HANDLE_REGEX.test(h);

  const normalizar = normalizarHandle;

  const origin = () =>
    process.env.NEXT_PUBLIC_SITE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");

  // Comprobación debounced (350 ms) de disponibilidad del handle.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!handle) {
      setDispo("idle");
      return;
    }
    if (!handleValido(handle)) {
      setDispo("formato");
      return;
    }
    setDispo("comprobando");
    debounceRef.current = setTimeout(async () => {
      const supabase = createClient();
      const r = await handleDisponible(supabase, handle);
      // Evita pisar un estado más reciente si el usuario siguió escribiendo.
      setDispo(
        r === "disponible"
          ? "disponible"
          : r === "ocupado"
            ? "ocupado"
            : "error",
      );
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [handle]);

  const registrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !handle) return;
    if (!handleValido(handle)) {
      setEstado("error");
      setMensaje(
        "El nombre de usuario solo admite minúsculas, números y guión bajo, entre 3 y 30 caracteres.",
      );
      return;
    }
    if (dispo === "ocupado") {
      setEstado("error");
      setMensaje("Ese nombre de usuario ya está cogido. Prueba con otro.");
      return;
    }
    if (password.length < 8) {
      setEstado("error");
      setMensaje("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setEstado("enviando");
    setMensaje("");

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { handle },
        emailRedirectTo: `${origin()}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
      },
    });
    if (error) {
      setEstado("error");
      setMensaje(mensajeAuth(error));
      return;
    }
    if (data.user && !data.session) {
      // Supabase por defecto pide verificación por correo antes de crear sesión.
      setEstado("enviado");
      setMensaje(
        "Te hemos enviado un correo para confirmar la cuenta. Pulsa el enlace para activarla y entrar.",
      );
      return;
    }
    // Sesión creada directamente (si la verificación de email está desactivada)
    router.push(redirect);
    router.refresh();
  };

  return (
    <form onSubmit={registrar} className="mt-6 space-y-3">
      <label className="block">
        <span className="eyebrow block mb-1">Nombre de usuario</span>
        <input
          type="text"
          required
          value={handle}
          onChange={(e) => setHandle(normalizar(e.target.value))}
          disabled={estado === "enviando" || estado === "enviado"}
          placeholder="vegueta_oikonomos"
          autoComplete="username"
          className="w-full h-11 rounded-md px-3 text-[0.95rem] outline-none font-mono"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-linea)",
            color: "var(--color-papiro-ink)",
          }}
        />
        {handle && dispo !== "idle" ? (
          <span
            className="text-[0.76rem] block mt-1"
            style={{
              color:
                dispo === "disponible"
                  ? "var(--color-oliva)"
                  : dispo === "comprobando"
                    ? "var(--color-piedra-clara)"
                    : "var(--color-sangre)",
            }}
          >
            {dispo === "comprobando" && "Comprobando disponibilidad…"}
            {dispo === "disponible" && "✓ Disponible"}
            {dispo === "ocupado" && "Ya está cogido. Prueba con otro."}
            {dispo === "formato" &&
              "Solo minúsculas, números y guión bajo. 3-30 caracteres."}
            {dispo === "error" &&
              "No hemos podido comprobarlo ahora; lo validaremos al crear la cuenta."}
          </span>
        ) : (
          <span
            className="text-[0.76rem] block mt-1"
            style={{ color: "var(--color-piedra-clara)" }}
          >
            Minúsculas, números y guión bajo. 3-30 caracteres. Es tu @.
          </span>
        )}
      </label>

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

      <label className="block">
        <span className="eyebrow block mb-1">Contraseña</span>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={estado === "enviando" || estado === "enviado"}
          autoComplete="new-password"
          className="w-full h-11 rounded-md px-3 text-[0.95rem] outline-none"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-linea)",
            color: "var(--color-papiro-ink)",
          }}
        />
        <span
          className="text-[0.76rem] block mt-1"
          style={{ color: "var(--color-piedra-clara)" }}
        >
          Mínimo 8 caracteres.
        </span>
      </label>

      <button
        type="submit"
        disabled={
          !email ||
          !password ||
          !handle ||
          dispo === "ocupado" ||
          dispo === "formato" ||
          dispo === "comprobando" ||
          estado === "enviando" ||
          estado === "enviado"
        }
        className="w-full h-11 rounded-md font-semibold text-[0.95rem] transition-opacity disabled:opacity-60"
        style={{
          background: "var(--color-ocre-deep)",
          color: "var(--color-surface)",
        }}
      >
        {estado === "enviando"
          ? "Creando cuenta..."
          : estado === "enviado"
          ? "Correo de confirmación enviado ✓"
          : "Crear cuenta"}
      </button>

      {mensaje && (
        <p
          className="text-[0.88rem]"
          style={{
            color: estado === "error" ? "var(--color-sangre)" : "var(--color-oliva)",
          }}
        >
          {mensaje}
        </p>
      )}

      <p
        className="text-[0.76rem] pt-2"
        style={{ color: "var(--color-piedra-clara)" }}
      >
        Al registrarte aceptas que guardamos tu correo para autenticarte y
        nunca compartimos tu actividad con terceros.
      </p>
    </form>
  );
}
