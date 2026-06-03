"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { mensajeAuth } from "@/lib/auth/errores";

/**
 * /auth/restablecer — fijar una nueva contraseña.
 *
 * Se llega aquí desde el enlace del correo de recuperación, después de que
 * /auth/callback haya intercambiado el code por una sesión. Por tanto, aquí
 * ya debe existir sesión: comprobamos getUser() y, si la hay, permitimos
 * cambiar la contraseña con updateUser().
 */
export default function RestablecerPage() {
  const router = useRouter();
  const [comprobando, setComprobando] = useState(true);
  const [haySesion, setHaySesion] = useState(false);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [estado, setEstado] = useState<"idle" | "enviando" | "ok" | "error">(
    "idle",
  );
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setHaySesion(!!data.user);
      setComprobando(false);
    });
  }, []);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setEstado("error");
      setMensaje("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== password2) {
      setEstado("error");
      setMensaje("Las dos contraseñas no coinciden.");
      return;
    }
    setEstado("enviando");
    setMensaje("");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setEstado("error");
      setMensaje(mensajeAuth(error));
      return;
    }
    setEstado("ok");
    setMensaje("Contraseña actualizada. Entrando…");
    setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 1200);
  };

  if (comprobando) {
    return (
      <div className="mx-auto max-w-md px-4 sm:px-6 py-16 text-center">
        <p style={{ color: "var(--color-piedra)" }}>Comprobando el enlace…</p>
      </div>
    );
  }

  if (!haySesion) {
    return (
      <div className="mx-auto max-w-md px-4 sm:px-6 py-12 pb-40">
        <div className="eyebrow">Enlace no válido</div>
        <h1
          className="display mt-1 text-[1.5rem]"
          style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
        >
          El enlace ha caducado o ya se usó
        </h1>
        <p className="mt-3 text-[0.95rem]" style={{ color: "var(--color-piedra)" }}>
          Pide uno nuevo para cambiar la contraseña.
        </p>
        <Link
          href="/recuperar"
          className="inline-block mt-5 px-4 py-2 rounded-md font-semibold text-[0.95rem]"
          style={{ background: "var(--color-ocre-deep)", color: "var(--color-surface)" }}
        >
          Pedir un enlace nuevo
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 sm:px-6 py-12 pb-40">
      <div className="eyebrow">Nueva contraseña</div>
      <h1
        className="display mt-1 text-[clamp(1.6rem,3vw,2rem)]"
        style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
      >
        Crea tu nueva contraseña
      </h1>

      <form onSubmit={guardar} className="mt-6 space-y-3">
        <label className="block">
          <span className="eyebrow block mb-1">Nueva contraseña</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={estado === "enviando" || estado === "ok"}
            autoComplete="new-password"
            className="w-full h-11 rounded-md px-3 text-[0.95rem] outline-none"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-linea)",
              color: "var(--color-papiro-ink)",
            }}
          />
        </label>
        <label className="block">
          <span className="eyebrow block mb-1">Repite la contraseña</span>
          <input
            type="password"
            required
            minLength={8}
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            disabled={estado === "enviando" || estado === "ok"}
            autoComplete="new-password"
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
          disabled={!password || !password2 || estado === "enviando" || estado === "ok"}
          className="w-full h-11 rounded-md font-semibold text-[0.95rem] transition-opacity disabled:opacity-60"
          style={{ background: "var(--color-ocre-deep)", color: "var(--color-surface)" }}
        >
          {estado === "enviando" ? "Guardando…" : "Guardar contraseña"}
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
    </div>
  );
}
