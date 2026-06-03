"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { mensajeAuth } from "@/lib/auth/errores";
import { Marco, Aviso } from "../cambiar-email/page";

/**
 * /ajustes/cambiar-password — fija una nueva contraseña desde la cuenta.
 *
 * Para evitar que cualquiera con la sesión abierta cambie la contraseña sin
 * conocer la actual, re-autenticamos primero con signInWithPassword usando el
 * correo de la cuenta + la contraseña actual. Si es correcta, aplicamos la
 * nueva con updateUser().
 *
 * Nota: si la cuenta se creó solo con magic link o Google y nunca tuvo
 * contraseña, la verificación de la actual fallará. En ese caso el usuario
 * debe usar "He olvidado la contraseña" (flujo /recuperar) para fijar una.
 */
export default function CambiarPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [nueva2, setNueva2] = useState("");
  const [estado, setEstado] = useState<"idle" | "enviando" | "ok" | "error">(
    "idle",
  );
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? "");
    });
  }, []);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nueva.length < 8) {
      setEstado("error");
      setMensaje("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (nueva !== nueva2) {
      setEstado("error");
      setMensaje("Las dos contraseñas nuevas no coinciden.");
      return;
    }
    if (nueva === actual) {
      setEstado("error");
      setMensaje("La nueva contraseña no puede ser igual a la actual.");
      return;
    }
    setEstado("enviando");
    setMensaje("");
    const supabase = createClient();

    // 1) Re-autenticación: comprobamos la contraseña actual.
    const { error: errLogin } = await supabase.auth.signInWithPassword({
      email,
      password: actual,
    });
    if (errLogin) {
      setEstado("error");
      setMensaje(
        "La contraseña actual no es correcta. Si nunca pusiste contraseña (entras con enlace o Google), usa «He olvidado la contraseña».",
      );
      return;
    }

    // 2) Aplicamos la nueva contraseña.
    const { error } = await supabase.auth.updateUser({ password: nueva });
    if (error) {
      setEstado("error");
      setMensaje(mensajeAuth(error));
      return;
    }
    setEstado("ok");
    setMensaje("Contraseña actualizada correctamente.");
    setTimeout(() => {
      router.push("/ajustes");
      router.refresh();
    }, 1200);
  };

  const bloqueado = estado === "enviando" || estado === "ok";

  return (
    <Marco titulo="Cambiar contraseña" volver>
      <form onSubmit={guardar} className="space-y-3">
        {/* Campo oculto con el email para los gestores de contraseñas. */}
        <input
          type="email"
          value={email}
          autoComplete="username"
          readOnly
          hidden
        />
        <label className="block">
          <span className="eyebrow block mb-1">Contraseña actual</span>
          <input
            type="password"
            required
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            disabled={bloqueado}
            autoComplete="current-password"
            className="w-full h-11 rounded-md px-3 text-[0.95rem] outline-none"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-linea)",
              color: "var(--color-papiro-ink)",
            }}
          />
        </label>
        <label className="block">
          <span className="eyebrow block mb-1">Nueva contraseña</span>
          <input
            type="password"
            required
            minLength={8}
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            disabled={bloqueado}
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
          <span className="eyebrow block mb-1">Repite la nueva contraseña</span>
          <input
            type="password"
            required
            minLength={8}
            value={nueva2}
            onChange={(e) => setNueva2(e.target.value)}
            disabled={bloqueado}
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
          disabled={!actual || !nueva || !nueva2 || bloqueado}
          className="h-11 px-5 rounded-md font-semibold text-[0.95rem] disabled:opacity-60"
          style={{ background: "var(--color-ocre-deep)", color: "var(--color-surface)" }}
        >
          {estado === "enviando" ? "Guardando…" : "Guardar contraseña"}
        </button>
      </form>
      <Aviso estado={estado} mensaje={mensaje} />
    </Marco>
  );
}
