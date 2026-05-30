"use client";

// ─── POLIS · Juego: ficha de mapeo (bottom sheet) ────────────────
// Sube desde abajo cuando el jugador toca un edificio dentro del
// radio anotable. Cinco campos: uso, capital, año, materiales,
// estado de conservación. Submit → +PEC en los tres ejes según los
// datos aportados, y cierra.

import { useEffect, useState } from "react";
import { COLOR_TIPO_CAPITAL, PALETAS_MATERIAL } from "@/lib/polis-juego/paletas";
import type {
  EdificioProyectado,
  MaterialId,
  PosicionUsuario,
  UsoDeclarado,
} from "@/lib/polis-juego/tipos";
import type { TipoBloque } from "@/lib/territorio/barrios-juego";

const USOS: { id: UsoDeclarado; label: string; emoji: string }[] = [
  { id: "vivienda-residente", label: "Vivienda · residente", emoji: "🏠" },
  { id: "vivienda-vacacional", label: "Vivienda · vacacional", emoji: "🏖" },
  { id: "comercio-local", label: "Comercio local", emoji: "🛒" },
  { id: "comercio-cadena", label: "Comercio cadena", emoji: "🏬" },
  { id: "oficina", label: "Oficina", emoji: "💼" },
  { id: "patrimonio", label: "Patrimonio / cultural", emoji: "🏛" },
  { id: "dotacional", label: "Dotacional / público", emoji: "🏥" },
  { id: "industrial", label: "Industrial / taller", emoji: "🏭" },
  { id: "vacante", label: "Vacante / ruina", emoji: "○" },
];

const CAPITALES: TipoBloque[] = [
  "comun",
  "residente",
  "autonomo",
  "rentista",
  "corporativo",
];

const MATERIALES: MaterialId[] = [
  "piedra_volcanica_canaria",
  "encalado_blanco",
  "madera_tea",
  "azulejo_hidraulico",
  "tejado_teja_arabe",
];

export type DatosFicha = {
  uso: UsoDeclarado;
  capital: TipoBloque;
  anioAprox: number;
  materialesDetectados: MaterialId[];
  conservacion: number;
  nota: string;
};

export function FichaMapeo({
  edificio,
  posicion,
  distanciaM,
  onCerrar,
  onEnviar,
}: {
  edificio: EdificioProyectado;
  posicion: PosicionUsuario;
  distanciaM: number;
  onCerrar: () => void;
  onEnviar: (datos: DatosFicha) => void;
}) {
  const [uso, setUso] = useState<UsoDeclarado>("vivienda-residente");
  const [capital, setCapital] = useState<TipoBloque>("residente");
  const [anioAprox, setAnioAprox] = useState<number>(1960);
  const [materialesDetectados, setMateriales] = useState<MaterialId[]>([]);
  const [conservacion, setConservacion] = useState<number>(60);
  const [nota, setNota] = useState<string>("");

  // Cerrar con Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCerrar]);

  const toggleMaterial = (m: MaterialId) =>
    setMateriales((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m],
    );

  const enviar = () => {
    onEnviar({
      uso,
      capital,
      anioAprox,
      materialesDetectados,
      conservacion,
      nota,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: "rgba(28,25,21,0.55)" }}
      onClick={onCerrar}
    >
      <div
        className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-linea)",
          boxShadow: "var(--shadow-carta)",
          maxHeight: "92vh",
          animation: "slideUp 280ms ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* asa visual ──────────────────────────────── */}
        <div className="pt-2 pb-1 flex justify-center sm:hidden">
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 4,
              background: "var(--color-linea)",
            }}
          />
        </div>

        {/* cabecera ────────────────────────────────── */}
        <div
          className="px-5 py-3 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--color-linea)" }}
        >
          <div>
            <div className="eyebrow">Ficha de mapeo</div>
            <div
              className="display text-[0.95rem] mt-0.5"
              style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
            >
              Edificio {edificio.id.split("-")[0].slice(-3)} · {edificio.alturaM.toFixed(1)} m de altura
            </div>
            <div
              className="text-[0.7rem]"
              style={{ color: "var(--color-piedra)" }}
            >
              A {Math.round(distanciaM)} m de ti · GPS ±{Math.round(posicion.accuracyM)} m
              {posicion.esTest && " · TEST"}
            </div>
          </div>
          <button
            onClick={onCerrar}
            className="eyebrow"
            style={{
              color: "var(--color-piedra)",
              background: "transparent",
              border: 0,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        {/* contenido scrollable ───────────────────────── */}
        <div className="overflow-y-auto px-5 py-4 space-y-5">
          {/* USO */}
          <Campo titulo="¿Qué uso tiene?" eje="exploracion">
            <div className="grid grid-cols-3 gap-2">
              {USOS.map((u) => (
                <Toggle
                  key={u.id}
                  active={uso === u.id}
                  onClick={() => setUso(u.id)}
                  label={`${u.emoji} ${u.label.split("·")[0].trim()}`}
                  sublabel={u.label.split("·")[1]?.trim()}
                />
              ))}
            </div>
          </Campo>

          {/* CAPITAL */}
          <Campo titulo="¿De quién parece ser?" eje="recuperacion">
            <div className="grid grid-cols-5 gap-2">
              {CAPITALES.map((c) => {
                const meta = COLOR_TIPO_CAPITAL[c];
                const activo = capital === c;
                return (
                  <button
                    key={c}
                    onClick={() => setCapital(c)}
                    className="rounded-md py-2 px-1 text-[0.66rem]"
                    style={{
                      background: activo
                        ? meta.tenue
                        : "var(--color-papiro-soft)",
                      color: activo
                        ? meta.base as string
                        : "var(--color-piedra)",
                      border: `1px solid ${activo ? (meta.base as string) : "var(--color-linea)"}`,
                      cursor: "pointer",
                      fontWeight: activo ? 600 : 400,
                      lineHeight: 1.2,
                    }}
                  >
                    {meta.etiqueta}
                  </button>
                );
              })}
            </div>
            <p
              className="text-[0.7rem] mt-2"
              style={{ color: "var(--color-piedra-clara)" }}
            >
              Si marcas <em>rentista</em> o <em>privado-corporativo</em>, el
              bloque entra como candidato a recuperación.
            </p>
          </Campo>

          {/* AÑO */}
          <Campo titulo="¿De qué época es?" eje="calibrado">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1500}
                max={2025}
                step={5}
                value={anioAprox}
                onChange={(e) => setAnioAprox(parseInt(e.target.value, 10))}
                className="flex-1"
                style={{ accentColor: "var(--color-ocre)" }}
              />
              <span
                className="display text-[0.95rem] tabular-nums"
                style={{
                  color: "var(--color-papiro-ink)",
                  fontWeight: 600,
                  minWidth: 56,
                  textAlign: "right",
                }}
              >
                {anioAprox}
              </span>
            </div>
          </Campo>

          {/* MATERIALES */}
          <Campo titulo="¿Qué materiales ves?" eje="calibrado">
            <div className="grid grid-cols-5 gap-2">
              {MATERIALES.map((m) => {
                const p = PALETAS_MATERIAL[m];
                const activo = materialesDetectados.includes(m);
                return (
                  <button
                    key={m}
                    onClick={() => toggleMaterial(m)}
                    className="rounded-md overflow-hidden"
                    style={{
                      border: activo
                        ? `2px solid var(--color-ocre-deep)`
                        : "1px solid var(--color-linea)",
                      background: "var(--color-surface)",
                      padding: 0,
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        height: 24,
                        background: `linear-gradient(180deg, ${p.luz} 0%, ${p.base} 50%, ${p.sombra} 100%)`,
                      }}
                    />
                    <div
                      className="text-[0.6rem] py-1 px-0.5 leading-tight"
                      style={{
                        color: activo
                          ? "var(--color-ocre-deep)"
                          : "var(--color-piedra)",
                        fontWeight: activo ? 600 : 400,
                      }}
                    >
                      {p.etiqueta}
                    </div>
                  </button>
                );
              })}
            </div>
          </Campo>

          {/* CONSERVACIÓN */}
          <Campo titulo="Estado de conservación" eje="calibrado">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={conservacion}
                onChange={(e) => setConservacion(parseInt(e.target.value, 10))}
                className="flex-1"
                style={{ accentColor: "var(--color-ocre)" }}
              />
              <span
                className="display text-[0.85rem] tabular-nums"
                style={{
                  color: "var(--color-papiro-ink)",
                  fontWeight: 600,
                  minWidth: 56,
                  textAlign: "right",
                }}
              >
                {etiquetaConservacion(conservacion)}
              </span>
            </div>
          </Campo>

          {/* NOTA */}
          <Campo titulo="Nota libre (opcional)">
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              rows={2}
              placeholder="Algo que se vea desde la calle y no quepa en lo anterior."
              className="w-full rounded-md p-2 text-[0.85rem]"
              style={{
                border: "1px solid var(--color-linea)",
                background: "var(--color-papiro-soft)",
                color: "var(--color-papiro-ink)",
                fontFamily: "inherit",
                resize: "vertical",
              }}
            />
          </Campo>
        </div>

        {/* footer ─ submit ─────────────────────────────── */}
        <div
          className="px-5 py-3 flex items-center justify-between gap-3"
          style={{
            borderTop: "1px solid var(--color-linea)",
            background: "var(--color-papiro-soft)",
          }}
        >
          <span
            className="text-[0.74rem]"
            style={{ color: "var(--color-piedra)" }}
          >
            Recompensa estimada:{" "}
            <strong style={{ color: "var(--color-papiro-ink)" }}>
              +
              {estimarRecompensa({
                uso,
                capital,
                anioAprox,
                materialesDetectados,
                conservacion,
                nota,
              })}{" "}
              PEC
            </strong>
          </span>
          <button
            onClick={enviar}
            className="rounded-md px-4 py-2 eyebrow"
            style={{
              background: "var(--color-ocre)",
              color: "var(--color-surface)",
              border: 0,
              cursor: "pointer",
            }}
          >
            Anotar →
          </button>
        </div>

        <style jsx>{`
          @keyframes slideUp {
            from {
              transform: translateY(40px);
              opacity: 0;
            }
            to {
              transform: translateY(0);
              opacity: 1;
            }
          }
        `}</style>
      </div>
    </div>
  );
}

// ─── piezas reutilizables ────────────────────────────────────────

function Campo({
  titulo,
  eje,
  children,
}: {
  titulo: string;
  eje?: "exploracion" | "calibrado" | "recuperacion";
  children: React.ReactNode;
}) {
  const ejeColor =
    eje === "exploracion"
      ? "var(--color-ocre)"
      : eje === "calibrado"
        ? "var(--color-ocre-deep)"
        : eje === "recuperacion"
          ? "var(--color-sangre)"
          : "var(--color-piedra-clara)";
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {eje && (
          <span
            style={{
              display: "inline-block",
              width: 7,
              height: 7,
              borderRadius: 999,
              background: ejeColor,
            }}
          />
        )}
        <span
          className="eyebrow"
          style={{ color: "var(--color-piedra)", fontSize: "0.66rem" }}
        >
          {titulo}
        </span>
      </div>
      {children}
    </div>
  );
}

function Toggle({
  active,
  onClick,
  label,
  sublabel,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sublabel?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-md py-2 px-2 text-left text-[0.7rem]"
      style={{
        background: active ? "var(--color-papiro-soft)" : "var(--color-surface)",
        color: active ? "var(--color-papiro-ink)" : "var(--color-piedra)",
        border: `1px solid ${active ? "var(--color-ocre)" : "var(--color-linea)"}`,
        cursor: "pointer",
        fontWeight: active ? 600 : 400,
        lineHeight: 1.2,
      }}
    >
      <div>{label}</div>
      {sublabel && (
        <div
          className="text-[0.62rem]"
          style={{ color: "var(--color-piedra-clara)", fontWeight: 400 }}
        >
          {sublabel}
        </div>
      )}
    </button>
  );
}

function etiquetaConservacion(v: number): string {
  if (v < 25) return "ruina";
  if (v < 50) return "deteriorado";
  if (v < 75) return "regular";
  return "bueno";
}

/** Heurística de recompensa — la fuente de verdad la tiene JuegoPolis. */
export function estimarRecompensa(d: DatosFicha): number {
  const explo = 10;
  const cal =
    8 +
    (d.materialesDetectados.length >= 1 ? 6 : 0) +
    (d.anioAprox > 1500 ? 4 : 0);
  const rec =
    d.capital === "corporativo" ? 60 : d.capital === "rentista" ? 40 : 0;
  return explo + cal + rec;
}
