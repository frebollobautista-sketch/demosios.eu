"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { togglePecHiloAction } from "@/lib/agora/acciones";

type Props = {
  hiloId: string;
  seccionId: string;
  activoInicial: boolean;
  conteoInicial: number;
  requiereSesion: boolean;
};

export function BotonPecHilo({
  hiloId,
  seccionId,
  activoInicial,
  conteoInicial,
  requiereSesion,
}: Props) {
  const router = useRouter();
  const [activo, setActivo] = useState(activoInicial);
  const [conteo, setConteo] = useState(conteoInicial);
  const [pendiente, startTransition] = useTransition();

  function alClick() {
    if (requiereSesion) {
      router.push("/login");
      return;
    }
    // Optimismo: mover UI antes de la respuesta.
    const sigActivo = !activo;
    setActivo(sigActivo);
    setConteo((n) => n + (sigActivo ? 1 : -1));

    const fd = new FormData();
    fd.set("hiloId", hiloId);
    fd.set("seccion", seccionId);

    startTransition(async () => {
      const r = await togglePecHiloAction(fd);
      if (!r.ok) {
        // revertir
        setActivo(!sigActivo);
        setConteo((n) => n + (sigActivo ? -1 : 1));
        console.error(r.error);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={alClick}
      disabled={pendiente}
      className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60"
      style={{
        background: activo ? "var(--color-siena)" : "var(--color-papiro-soft)",
        color: activo ? "var(--color-papiro)" : "var(--color-papiro-ink)",
        border: "1px solid var(--color-linea)",
      }}
      title={requiereSesion ? "Inicia sesión para dar PEC" : "Respaldo encarnado"}
    >
      <span aria-hidden>{activo ? "✓" : "+"}</span>
      <span>
        PEC · {conteo}
      </span>
    </button>
  );
}
