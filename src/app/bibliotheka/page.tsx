"use client";

import { useState } from "react";
import { CURSUS } from "@/lib/cursus/grados";
import { SECCIONES } from "@/lib/pharos/secciones";
import { IconPlay, IconScroll, IconChevronRight } from "@/components/Icons";
import { CTAProtegido } from "@/components/CTAProtegido";

type Pestana = "cursus" | "koina";

export default function BibliothekaPage() {
  const [pestana, setPestana] = useState<Pestana>("cursus");

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 pb-40">
      <div className="eyebrow">Βιβλιοθήκη</div>
      <h1
        className="display mt-1 text-[clamp(1.6rem,3.5vw,2.2rem)]"
        style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
      >
        Bibliotheka
      </h1>
      <p
        className="mt-3 max-w-2xl"
        style={{ color: "var(--color-piedra)" }}
      >
        Dos alas. El <em className="display italic">Cursus honorum</em>{" "}
        gradua el contenido ciudadano en vídeo y abre carreras cívicas
        reales. <em className="display italic">τὰ Κοινά</em> (tà koiná)
        recoge recursos del común: guías, plantillas, servicios vecinales.
      </p>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Secciones de Bibliotheka"
        className="mt-8 inline-flex rounded-lg p-1"
        style={{
          background: "var(--color-papiro-soft)",
          border: "1px solid var(--color-linea)",
        }}
      >
        <TabButton
          label="Cursus honorum"
          icon={<IconPlay size={16} />}
          activo={pestana === "cursus"}
          onClick={() => setPestana("cursus")}
        />
        <TabButton
          label="τὰ Κοινά"
          sub="Koiná"
          icon={<IconScroll size={16} />}
          activo={pestana === "koina"}
          onClick={() => setPestana("koina")}
        />
      </div>

      <div className="divisor my-8" />

      {pestana === "cursus" ? <SeccionCursus /> : <SeccionKoina />}
    </div>
  );
}

function TabButton({
  label,
  sub,
  icon,
  activo,
  onClick,
}: {
  label: string;
  sub?: string;
  icon: React.ReactNode;
  activo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      role="tab"
      aria-selected={activo}
      onClick={onClick}
      className="px-4 py-2 text-[0.9rem] rounded-md transition-colors inline-flex items-center gap-2"
      style={{
        background: activo ? "var(--color-surface)" : "transparent",
        color: activo
          ? "var(--color-papiro-ink)"
          : "var(--color-piedra)",
        fontWeight: activo ? 600 : 500,
        boxShadow: activo ? "var(--shadow-sutil)" : "none",
      }}
    >
      {icon}
      <span className="display italic">{label}</span>
      {sub && (
        <span
          className="text-[0.7rem] uppercase tracking-widest"
          style={{ color: "var(--color-piedra-clara)" }}
        >
          · {sub}
        </span>
      )}
    </button>
  );
}

/* ─── Cursus honorum (pestaña 1) ────────────────────────────────── */

function SeccionCursus() {
  return (
    <div>
      <p
        className="max-w-2xl mb-6 text-[0.94rem]"
        style={{ color: "var(--color-piedra)" }}
      >
        Siete grados. Cada uno habilita una función cívica real dentro de OCRE
        y se corresponde con roles profesionales contemporáneos, de modo que
        mañana esta escalera pueda articular una red profesional concreta
        (autónomos, cooperativas, asociaciones, cargos electos).
      </p>
      <ol className="space-y-3">
        {CURSUS.map((g) => (
          <li
            key={g.id}
            className="rounded-xl p-5"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-linea)",
              borderLeft: `3px solid ${g.color}`,
            }}
          >
            <div className="flex items-start gap-4">
              <span
                aria-hidden
                className="shrink-0 inline-flex items-center justify-center"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: "var(--color-papiro-soft)",
                  color: g.color,
                  fontFamily: "var(--font-serif-stack)",
                  fontSize: 22,
                  fontWeight: 700,
                }}
                title={g.lema}
              >
                {g.atributo}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span
                    className="display text-[1.15rem]"
                    style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
                  >
                    {g.nombre}
                  </span>
                  <span
                    className="eyebrow"
                    style={{ color: "var(--color-piedra-clara)" }}
                  >
                    {g.nombreLatino} · {g.traduccion}
                  </span>
                  <span
                    className="ml-auto text-[0.78rem] rounded-full px-2 py-0.5"
                    style={{
                      background: "var(--color-papiro-soft)",
                      color: "var(--color-piedra)",
                    }}
                  >
                    Nivel {g.nivel}
                  </span>
                </div>
                <p
                  className="display italic mt-1 text-[0.95rem]"
                  style={{ color: g.color }}
                >
                  «{g.lema}»
                </p>
                <p
                  className="mt-2 text-[0.92rem]"
                  style={{ color: "var(--color-papiro-ink)" }}
                >
                  <strong
                    className="eyebrow mr-1 not-italic"
                    style={{ color: "var(--color-piedra)" }}
                  >
                    Función cívica:
                  </strong>
                  {g.funcionCivica}
                </p>
                <p
                  className="mt-2 text-[0.88rem]"
                  style={{ color: "var(--color-piedra)" }}
                >
                  <strong
                    className="eyebrow mr-1 not-italic"
                    style={{ color: "var(--color-piedra)" }}
                  >
                    Correspondencia profesional:
                  </strong>
                  {g.correspondenciaProfesional.join(", ")}.
                </p>
                {g.requisitoCualitativo && g.requisitoCualitativo.length > 0 && (
                  <ul
                    className="mt-3 flex flex-wrap gap-1.5 text-[0.76rem]"
                    style={{ color: "var(--color-piedra)" }}
                  >
                    {g.requisitoCualitativo.map((r) => (
                      <li
                        key={r}
                        className="rounded-full px-2 py-0.5"
                        style={{
                          background: "var(--color-papiro-soft)",
                          border: "1px solid var(--color-linea)",
                        }}
                      >
                        {r}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>

      {/* Call to action para subir un video */}
      <div
        className="mt-8 rounded-xl p-5 flex items-center gap-4"
        style={{
          background: "var(--color-papiro-soft)",
          border: "1px dashed var(--color-linea)",
        }}
      >
        <div
          className="hidden sm:flex items-center justify-center"
          style={{
            width: 48,
            height: 48,
            borderRadius: 999,
            background: "var(--color-surface)",
            color: "var(--color-ocre-deep)",
          }}
        >
          <IconPlay />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="display text-[1.02rem]"
            style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
          >
            ¿Listo para subir tu primer video?
          </div>
          <p
            className="text-[0.88rem]"
            style={{ color: "var(--color-piedra)" }}
          >
            Aportar 5 vídeos y recibir 15 PECs te hace pasar de oikonómos a
            ergátes. Cada pieza suma a paideía.
          </p>
        </div>
        <CTAProtegido
          etiqueta="Subir video"
          etiquetaAnonimo="Entra para subir"
          razon="Subir vídeos al cursus honorum requiere una cuenta."
        />
      </div>
    </div>
  );
}

/* ─── Koiná (pestaña 2) ─────────────────────────────────────────── */

function SeccionKoina() {
  return (
    <div>
      <p
        className="max-w-2xl mb-6 text-[0.94rem]"
        style={{ color: "var(--color-piedra)" }}
      >
        <em className="display italic">τὰ κοινά</em> — «las cosas comunes».
        Recursos que pertenecen a quien los necesite: guías prácticas,
        plantillas, mapas, servicios de proximidad. Clasificados por las
        mismas 8 secciones que ordenan el Ágora.
      </p>
      <ul className="grid md:grid-cols-2 gap-3">
        {SECCIONES.map((s) => (
          <li
            key={s.id}
            className="rounded-xl p-5 cursor-pointer"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-linea)",
            }}
          >
            <div className="flex items-start gap-3">
              <span
                className="shrink-0 inline-flex items-center justify-center"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: s.color,
                  color: s.colorTexto,
                  fontSize: 18,
                }}
                aria-hidden
              >
                {s.icono}
              </span>
              <div className="min-w-0 flex-1">
                <div
                  className="display text-[0.98rem]"
                  style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
                >
                  {s.nombre}
                </div>
                <p
                  className="text-[0.84rem] mt-1"
                  style={{ color: "var(--color-piedra)" }}
                >
                  {s.descripcion}
                </p>
                <div
                  className="eyebrow mt-3 flex items-center gap-1"
                  style={{ color: "var(--color-piedra-clara)" }}
                >
                  0 recursos públicos
                  <IconChevronRight size={12} />
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
