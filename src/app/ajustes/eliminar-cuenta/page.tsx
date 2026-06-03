"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { mensajeAuth } from "@/lib/auth/errores";
import { Marco, Aviso } from "../cambiar-email/page";

/**
 * /ajustes/eliminar-cuenta — borrado definitivo de la cuenta (RGPD).
 *
 * Doble confirmación:
 *   Paso 1 — explicación de consecuencias + casilla "entiendo que es
 *            irreversible".
 *   Paso 2 — escribir literalmente la palabra de confirmación (ELIMINAR).
 *
 * El borrado lo hace la función RPC `delete_my_account` (SECURITY DEFINER),
 * que ejecuta `delete from auth.users where id = auth.uid()`. La cascada de
 * claves foráneas se encarga del resto de tablas. Tras borrar, cerramos
 * sesión y volvemos a la portada.
 */
export default function EliminarCuentaPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [paso, setPaso] = useState<1 | 2>(1);
  const [entiendo, setEntiendo] = useState(false);
  const [palabra, setPalabra] = useState("");
  const [estado, setEstado] = useState<"idle" | "borrando" | "error">("idle");
  const [mensaje, setMensaje] = useState("");

  const PALABRA = "ELIMINAR";

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? "");
    });
  }, []);

  const eliminar = async () => {
    if (palabra.trim().toUpperCase() !== PALABRA) {
      setEstado("error");
      setMensaje(`Escribe ${PALABRA} para confirmar.`);
      return;
    }
    setEstado("borrando");
    setMensaje("");
    const supabase = createClient();
    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      setEstado("error");
      setMensaje(mensajeAuth(error));
      return;
    }
    // Sesión ya inválida; intentamos cerrar y vamos a la portada.
    await supabase.auth.signOut().catch(() => {});
    router.push("/?cuenta=eliminada");
    router.refresh();
  };

  return (
    <Marco titulo="Eliminar cuenta" volver>
      <div
        className="rounded-lg p-4 mb-5"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-sangre)",
        }}
      >
        <p className="text-[0.9rem]" style={{ color: "var(--color-sangre)", fontWeight: 600 }}>
          Esta acción es irreversible.
        </p>
        <p className="text-[0.88rem] mt-2" style={{ color: "var(--color-piedra)", lineHeight: 1.5 }}>
          Se borrará para siempre tu cuenta{" "}
          <strong style={{ color: "var(--color-papiro-ink)" }}>{email || "—"}</strong>{" "}
          y todo lo asociado: perfil, hilos de Ágora, comentarios, reacciones,
          mensajes y preferencias. No se puede recuperar.
        </p>
      </div>

      {paso === 1 ? (
        <div className="space-y-4">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={entiendo}
              onChange={(e) => setEntiendo(e.target.checked)}
              className="mt-1"
            />
            <span className="text-[0.9rem]" style={{ color: "var(--color-papiro-ink)" }}>
              Entiendo que mi cuenta y todos mis datos se borrarán de forma
              permanente y que esto no se puede deshacer.
            </span>
          </label>
          <button
            type="button"
            disabled={!entiendo}
            onClick={() => {
              setPaso(2);
              setEstado("idle");
              setMensaje("");
            }}
            className="h-11 px-5 rounded-md font-semibold text-[0.95rem] disabled:opacity-50"
            style={{ background: "var(--color-sangre)", color: "var(--color-surface)" }}
          >
            Continuar
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <label className="block">
            <span className="eyebrow block mb-1">
              Escribe {PALABRA} para confirmar
            </span>
            <input
              type="text"
              value={palabra}
              onChange={(e) => setPalabra(e.target.value)}
              disabled={estado === "borrando"}
              placeholder={PALABRA}
              autoComplete="off"
              className="w-full h-11 rounded-md px-3 text-[0.95rem] outline-none tracking-wide"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-linea)",
                color: "var(--color-papiro-ink)",
              }}
            />
          </label>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              disabled={
                palabra.trim().toUpperCase() !== PALABRA || estado === "borrando"
              }
              onClick={eliminar}
              className="h-11 px-5 rounded-md font-semibold text-[0.95rem] disabled:opacity-50"
              style={{ background: "var(--color-sangre)", color: "var(--color-surface)" }}
            >
              {estado === "borrando" ? "Eliminando…" : "Eliminar mi cuenta para siempre"}
            </button>
            <button
              type="button"
              disabled={estado === "borrando"}
              onClick={() => {
                setPaso(1);
                setPalabra("");
                setEstado("idle");
                setMensaje("");
              }}
              className="h-11 px-4 rounded-md text-[0.92rem]"
              style={{
                background: "transparent",
                border: "1px solid var(--color-linea)",
                color: "var(--color-piedra)",
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <Aviso estado={estado === "error" ? "error" : "ok"} mensaje={mensaje} />
    </Marco>
  );
}
