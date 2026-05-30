"use client";

/**
 * /mapear — flujo mobile de mapeo cultural pixel art.
 *
 * Este es el primer punto de entrada real para el usuario final.
 * Mantiene el mismo ancho `max-w-lg` que el home (src/app/page.tsx)
 * y la tab bar de abajo, para que encaje en el móvil.
 *
 * Flujo pensado:
 *   1. Elegir material (preset) — define los 4 parámetros del filtro.
 *   2. Subir / capturar foto.
 *   3. Ver comparativa original/pixel art inmediata.
 *   4. (Más adelante) Enviar al mapa.
 *
 * Nota sobre persistencia: en este primer pase no subimos a Supabase
 * todavía. Solo validamos el loop UI + filtro en la mano del usuario.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

import {
  cargarImagenDesdeFile,
  pintarOriginal,
  procesarImagen,
  type ResultadoFiltro,
} from "@/lib/pixelart/procesar";
import {
  PRESETS_MATERIAL,
  PRESET_POR_DEFECTO,
  type PresetMaterial,
} from "@/lib/pixelart/presets";

const C = {
  bg: "#FAF7F5",
  surface: "#FFFFFF",
  surfaceAlt: "#F3EFEC",
  border: "#E8E2DD",
  primary: "#FF6B6B",
  text: "#2D2926",
  textMuted: "#7A7067",
  textDim: "#A89F97",
};

export default function MapearPage() {
  const [preset, setPreset] = useState<PresetMaterial>(PRESET_POR_DEFECTO);
  const [imagen, setImagen] = useState<HTMLImageElement | null>(null);
  const [nombreImagen, setNombreImagen] = useState<string>("");
  const [resultado, setResultado] = useState<ResultadoFiltro | null>(null);
  const [procesando, setProcesando] = useState(false);

  const originalRef = useRef<HTMLCanvasElement>(null);
  const pixelRef = useRef<HTMLCanvasElement>(null);

  const onFile = useCallback(async (f: File) => {
    setProcesando(true);
    try {
      const img = await cargarImagenDesdeFile(f);
      setImagen(img);
      setNombreImagen(f.name.replace(/\.[^.]+$/, ""));
    } finally {
      setProcesando(false);
    }
  }, []);

  // Pinta el original cuando llega una nueva imagen.
  useEffect(() => {
    if (!imagen || !originalRef.current) return;
    pintarOriginal(imagen, originalRef.current);
  }, [imagen]);

  // Reprocesa pixel art cuando cambia imagen o preset.
  useEffect(() => {
    if (!imagen || !pixelRef.current) return;
    const r = procesarImagen(imagen, pixelRef.current, preset.params);
    setResultado(r);
  }, [imagen, preset]);

  function reiniciar() {
    setImagen(null);
    setNombreImagen("");
    setResultado(null);
  }

  return (
    <div className="min-h-dvh" style={{ background: C.bg }}>
      {/* Header */}
      <header
        className="sticky top-0 z-40 px-4 py-3"
        style={{
          background: C.surface,
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold" style={{ color: C.text }}>
              Mapear fachada
            </h1>
            <p className="text-[11px]" style={{ color: C.textMuted }}>
              POLIS · pixel art cultural
            </p>
          </div>
          <Link
            href="/"
            className="text-xs px-2.5 py-1 rounded-md"
            style={{ color: C.textMuted, border: `1px solid ${C.border}` }}
          >
            ←
          </Link>
        </div>
      </header>

      {/* Contenido */}
      <main className="max-w-lg mx-auto px-4 py-5 pb-28 space-y-5">
        {/* Paso 1 · Material */}
        <section
          className="rounded-2xl p-4"
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
          }}
        >
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-semibold" style={{ color: C.text }}>
              1. Material
            </h2>
            <span className="text-[10px]" style={{ color: C.textDim }}>
              define el filtro
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {PRESETS_MATERIAL.map((p) => {
              const activo = p.id === preset.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setPreset(p)}
                  className="flex items-center gap-2 p-2 rounded-xl text-left"
                  style={{
                    background: activo ? C.surfaceAlt : C.surface,
                    border: `1.5px solid ${activo ? C.primary : C.border}`,
                  }}
                >
                  <span
                    className="w-7 h-7 rounded-lg shrink-0"
                    style={{
                      background: p.colorRepresentativo,
                      border: `1px solid ${C.border}`,
                    }}
                  />
                  <span className="min-w-0">
                    <span
                      className="block text-[11px] font-semibold truncate"
                      style={{ color: C.text }}
                    >
                      {p.etiqueta}
                    </span>
                    <span
                      className="block text-[9px] truncate"
                      style={{ color: C.textMuted }}
                    >
                      {p.descripcion}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <p
            className="mt-3 text-[10px] font-mono tabular-nums"
            style={{ color: C.textDim }}
          >
            {preset.params.pixelSize}px · {preset.params.colores} colores ·{" "}
            {preset.params.contraste}% contraste · {preset.params.saturacion}%
            saturación
          </p>
        </section>

        {/* Paso 2 · Foto */}
        <section
          className="rounded-2xl p-4"
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
          }}
        >
          <h2 className="text-sm font-semibold mb-3" style={{ color: C.text }}>
            2. Foto
          </h2>

          {!imagen && (
            <div
              className="rounded-xl p-6 text-center"
              style={{
                background: C.surfaceAlt,
                border: `1.5px dashed ${C.border}`,
              }}
            >
              <p className="text-xs mb-3" style={{ color: C.textMuted }}>
                Haz una foto de la fachada o elige una de tu galería.
              </p>
              <div className="flex gap-2 justify-center">
                <label
                  className="inline-block px-3 py-2 rounded-lg text-xs font-medium cursor-pointer"
                  style={{ background: C.primary, color: "#fff" }}
                >
                  Cámara
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onFile(f);
                    }}
                  />
                </label>
                <label
                  className="inline-block px-3 py-2 rounded-lg text-xs font-medium cursor-pointer"
                  style={{
                    background: C.surface,
                    color: C.text,
                    border: `1px solid ${C.border}`,
                  }}
                >
                  Galería
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onFile(f);
                    }}
                  />
                </label>
              </div>
            </div>
          )}

          {imagen && (
            <div className="space-y-3">
              <div>
                <p
                  className="text-[10px] uppercase tracking-wide mb-1"
                  style={{ color: C.textDim }}
                >
                  Original · {nombreImagen}
                </p>
                <canvas
                  ref={originalRef}
                  className="w-full h-auto rounded-lg"
                  style={{ background: C.surfaceAlt }}
                />
              </div>
              <div>
                <p
                  className="text-[10px] uppercase tracking-wide mb-1"
                  style={{ color: C.textDim }}
                >
                  Pixel art · {preset.etiqueta}
                </p>
                <canvas
                  ref={pixelRef}
                  className="w-full h-auto rounded-lg"
                  style={{
                    background: C.surfaceAlt,
                    imageRendering: "pixelated",
                  }}
                />
              </div>

              {resultado && (
                <div
                  className="flex items-center justify-between p-2 rounded-lg"
                  style={{ background: C.surfaceAlt }}
                >
                  <div className="flex gap-0.5">
                    {resultado.paletaHex.map((hex, i) => (
                      <div
                        key={i}
                        title={hex}
                        className="w-4 h-4 rounded-sm"
                        style={{
                          background: hex,
                          border: `1px solid ${C.border}`,
                        }}
                      />
                    ))}
                  </div>
                  <span
                    className="text-[10px] font-mono"
                    style={{ color: C.textMuted }}
                  >
                    {resultado.resolucion.w}×{resultado.resolucion.h}
                  </span>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={reiniciar}
                  className="flex-1 py-2 rounded-lg text-xs font-medium"
                  style={{
                    background: C.surface,
                    color: C.text,
                    border: `1px solid ${C.border}`,
                  }}
                >
                  Otra foto
                </button>
                <button
                  disabled
                  className="flex-1 py-2 rounded-lg text-xs font-medium opacity-50"
                  style={{ background: C.primary, color: "#fff" }}
                  title="Pendiente: subir al mapa de POLIS"
                >
                  Enviar al mapa
                </button>
              </div>
            </div>
          )}

          {procesando && (
            <p
              className="mt-2 text-[11px] text-center"
              style={{ color: C.textMuted }}
            >
              Cargando imagen…
            </p>
          )}
        </section>

        <p
          className="text-[10px] text-center"
          style={{ color: C.textDim }}
        >
          El filtro se aplica en tu dispositivo. Nada se sube todavía.
        </p>
      </main>

      {/* Tab bar mismo estilo que el home */}
      <nav
        className="fixed bottom-0 left-0 right-0 px-4 py-2 pb-[env(safe-area-inset-bottom)]"
        style={{
          background: C.surface,
          borderTop: `1px solid ${C.border}`,
        }}
      >
        <div className="max-w-lg mx-auto flex justify-around">
          <Link
            href="/"
            className="flex flex-col items-center gap-0.5"
            style={{ color: C.textDim }}
          >
            <span className="text-xl">🏠</span>
            <span className="text-[10px]">Inicio</span>
          </Link>
          <button
            className="flex flex-col items-center gap-0.5"
            style={{ color: C.textDim }}
          >
            <span className="text-xl">🔍</span>
            <span className="text-[10px]">Buscar</span>
          </button>
          <button
            className="flex flex-col items-center gap-0.5"
            style={{ color: C.primary }}
          >
            <span className="text-xl">🗺️</span>
            <span className="text-[10px] font-medium">Mapear</span>
          </button>
          <button
            className="flex flex-col items-center gap-0.5"
            style={{ color: C.textDim }}
          >
            <span className="text-xl">🔔</span>
            <span className="text-[10px]">Alertas</span>
          </button>
          <button
            className="flex flex-col items-center gap-0.5"
            style={{ color: C.textDim }}
          >
            <span className="text-xl">👤</span>
            <span className="text-[10px]">Perfil</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
