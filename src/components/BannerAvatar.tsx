"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "./Avatar";
import { IconClose, IconChevronRight } from "./Icons";
import { EJES } from "@/lib/capital/ejes";
import {
  agregarCapital,
  puntosTotales,
  ejeDominante,
} from "@/lib/capital/contribuciones";
import {
  avanceHaciaProximo,
  gradoActual,
  proximoGrado,
} from "@/lib/cursus/grados";
import type { PerfilMock } from "@/lib/perfil/mock";

/** Banner flotante en esquina inferior-derecha que acompaña siempre al usuario. */
export function BannerAvatar({ perfil }: { perfil: PerfilMock }) {
  const [minimizado, setMinimizado] = useState(false);
  const [oculto, setOculto] = useState(false);

  if (oculto) return null;

  const puntos = agregarCapital(perfil.contribuciones);
  const total = puntosTotales(puntos);
  const dominante = ejeDominante(puntos);
  const grado = gradoActual(puntos);
  const proximo = proximoGrado(grado);
  const avance = Math.round(avanceHaciaProximo(puntos, grado) * 100);
  const ejeDom = EJES.find((e) => e.id === dominante)!;

  // Minimizado: solo avatar flotando. Desktop & mobile.
  if (minimizado) {
    return (
      <button
        onClick={() => setMinimizado(false)}
        className="fixed right-4 bottom-4 z-40 rounded-full flotante-sombra"
        aria-label="Abrir banner de perfil"
        style={{ padding: 4, background: "var(--color-surface)" }}
      >
        <Avatar
          inicial={perfil.avatarInicial}
          color={perfil.avatarColor}
          grado={grado}
          size={48}
        />
      </button>
    );
  }

  return (
    <aside
      role="complementary"
      aria-label="Tu estado cívico"
      className="fixed right-4 bottom-4 z-40 w-[280px] rounded-2xl flotante-sombra"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-linea)",
      }}
    >
      <div className="flex items-center gap-3 p-3">
        <Avatar
          inicial={perfil.avatarInicial}
          color={perfil.avatarColor}
          grado={grado}
          size={48}
        />
        <div className="min-w-0 flex-1">
          <div
            className="eyebrow"
            style={{ color: grado.color }}
            title={grado.traduccion}
          >
            {grado.nombre}
          </div>
          <div
            className="truncate text-[0.9rem] font-medium"
            style={{ color: "var(--color-papiro-ink)" }}
          >
            {perfil.nombre}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <button
            onClick={() => setMinimizado(true)}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md"
            style={{ color: "var(--color-piedra)" }}
            aria-label="Minimizar"
            title="Minimizar"
          >
            <IconChevronRight size={14} />
          </button>
          <button
            onClick={() => setOculto(true)}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md"
            style={{ color: "var(--color-piedra-clara)" }}
            aria-label="Ocultar"
            title="Ocultar"
          >
            <IconClose size={14} />
          </button>
        </div>
      </div>

      {/* stats de capital — 3 ejes, barras finas */}
      <div
        className="px-3 pb-2 space-y-1.5"
        style={{ color: "var(--color-piedra)" }}
      >
        {EJES.map((e) => {
          const v = puntos[e.id];
          const pct = Math.min(100, Math.round((v / Math.max(total, 1)) * 100));
          return (
            <div key={e.id} className="text-[0.72rem]">
              <div className="flex items-baseline justify-between">
                <span
                  className="display italic"
                  style={{
                    color:
                      dominante === e.id
                        ? "var(--color-papiro-ink)"
                        : "var(--color-piedra)",
                    fontWeight: dominante === e.id ? 600 : 500,
                  }}
                >
                  {e.nombreGriego}
                </span>
                <span style={{ fontFeatureSettings: "'tnum'" }}>{v}</span>
              </div>
              <div
                className="h-[4px] rounded-full mt-0.5"
                style={{ background: e.colorTenue }}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: e.color }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* clase dominante + avance al próximo grado */}
      <div
        className="px-3 pb-3 pt-2 border-t"
        style={{ borderColor: "var(--color-linea)" }}
      >
        <div className="flex items-center justify-between text-[0.72rem]">
          <span className="eyebrow">Clase</span>
          <span
            className="display"
            style={{ color: ejeDom.color, fontWeight: 600 }}
          >
            {ejeDom.icono} {ejeDom.nombre}
          </span>
        </div>
        {proximo && (
          <div className="mt-2 text-[0.72rem]">
            <div
              className="flex items-baseline justify-between"
              style={{ color: "var(--color-piedra)" }}
            >
              <span>
                Rumbo a{" "}
                <span className="display italic" style={{ color: proximo.color }}>
                  {proximo.nombre}
                </span>
              </span>
              <span style={{ fontFeatureSettings: "'tnum'" }}>{avance}%</span>
            </div>
            <div
              className="mt-1 h-[3px] rounded-full"
              style={{ background: "var(--color-papiro-soft)" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${avance}%`,
                  background: proximo.color,
                }}
              />
            </div>
          </div>
        )}
        {!proximo && (
          <div
            className="mt-2 text-[0.72rem] display italic"
            style={{ color: grado.color }}
          >
            Custodia actual del común.
          </div>
        )}
        <Link
          href="/perfil"
          className="mt-3 block w-full text-center rounded-md border py-1.5 text-[0.8rem]"
          style={{
            borderColor: "var(--color-linea)",
            color: "var(--color-ocre-deep)",
            fontWeight: 600,
          }}
        >
          Ver perfil completo
        </Link>
      </div>

    </aside>
  );
}
