"use client";

/**
 * Calibrador Pixel Art — KOINOS / POLIS
 * -----------------------------------------------------------
 * Herramienta de trabajo de escritorio para calibrar perfiles de
 * material (pixel size, colores, contraste, saturación). Los cuatro
 * parámetros están descritos en POLIS_digitalizador_urbano.md § 2.
 *
 * Toda la lógica de pixelización vive en src/lib/pixelart/ para que
 * también pueda usarse desde el flujo mobile /mapear.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import {
  pintarOriginal,
  procesarImagen,
  cargarImagenDesdeFile,
  type ResultadoFiltro,
} from "@/lib/pixelart/procesar";
import {
  descargar,
  exportarGdScript,
  exportarJson,
  type Medicion,
} from "@/lib/pixelart/exportadores";

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

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unidad = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unidad?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium" style={{ color: C.text }}>
          {label}
        </span>
        <span
          className="text-xs font-mono tabular-nums"
          style={{ color: C.textMuted }}
        >
          {value}
          {unidad}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#FF6B6B]"
      />
    </label>
  );
}

function Metrica({ label, valor }: { label: string; valor: string }) {
  return (
    <div
      className="rounded-lg p-2 text-center"
      style={{ background: C.surfaceAlt }}
    >
      <p
        className="text-[10px] uppercase tracking-wide"
        style={{ color: C.textDim }}
      >
        {label}
      </p>
      <p className="text-sm font-mono tabular-nums font-semibold">{valor}</p>
    </div>
  );
}

export default function CalibradorPage() {
  const [imagen, setImagen] = useState<HTMLImageElement | null>(null);
  const [nombreImagen, setNombreImagen] = useState<string>("");
  const [pixelSize, setPixelSize] = useState(7);
  const [colores, setColores] = useState(12);
  const [contraste, setContraste] = useState(120);
  const [saturacion, setSaturacion] = useState(100);
  const [resultado, setResultado] = useState<ResultadoFiltro | null>(null);
  const [mediciones, setMediciones] = useState<Medicion[]>([]);
  const [nombreMaterial, setNombreMaterial] = useState("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalRef = useRef<HTMLCanvasElement>(null);

  const onFile = useCallback(async (f: File) => {
    const img = await cargarImagenDesdeFile(f);
    setImagen(img);
    setNombreImagen(f.name.replace(/\.[^.]+$/, ""));
  }, []);

  useEffect(() => {
    if (!imagen || !originalRef.current) return;
    pintarOriginal(imagen, originalRef.current);
  }, [imagen]);

  useEffect(() => {
    if (!imagen || !canvasRef.current) return;
    const r = procesarImagen(imagen, canvasRef.current, {
      pixelSize,
      colores,
      contraste,
      saturacion,
    });
    setResultado(r);
  }, [imagen, pixelSize, colores, contraste, saturacion]);

  const metricas = useMemo(() => {
    if (!resultado) return null;
    return {
      resolucion: `${resultado.resolucion.w}×${resultado.resolucion.h}`,
      tiles: resultado.tilesUnicos,
      densidad: resultado.densidadBitsPx.toFixed(2),
    };
  }, [resultado]);

  function guardarMedicion() {
    if (!resultado) return;
    const nombre = nombreMaterial.trim() || nombreImagen || "sin_nombre";
    const m: Medicion = {
      id: Math.random().toString(36).slice(2, 10),
      nombre,
      pixelSize,
      colores,
      contraste,
      saturacion,
      paletaHex: resultado.paletaHex,
      tilesUnicos: resultado.tilesUnicos,
      densidadBitsPx: resultado.densidadBitsPx,
      timestamp: new Date().toISOString(),
    };
    setMediciones((prev) => {
      const sin = prev.filter((x) => x.nombre !== nombre);
      return [...sin, m];
    });
    setNombreMaterial("");
  }

  function eliminarMedicion(id: string) {
    setMediciones((prev) => prev.filter((m) => m.id !== id));
  }

  return (
    <div className="min-h-dvh" style={{ background: C.bg, color: C.text }}>
      <header
        className="sticky top-0 z-40 px-4 py-3"
        style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Calibrador Pixel Art</h1>
            <p className="text-xs" style={{ color: C.textMuted }}>
              KOINOS · POLIS · Digitalizador Urbano
            </p>
          </div>
          <Link
            href="/"
            className="text-xs px-3 py-1.5 rounded-lg"
            style={{ color: C.textMuted, border: `1px solid ${C.border}` }}
          >
            ← Inicio
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {!imagen && (
          <div
            className="rounded-2xl p-10 text-center"
            style={{ background: C.surface, border: `2px dashed ${C.border}` }}
          >
            <p className="text-sm mb-3" style={{ color: C.textMuted }}>
              Sube una fotografía de una fachada, un muro, una puerta… para
              calibrar su perfil pixel art.
            </p>
            <label
              className="inline-block px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
              style={{ background: C.primary, color: "#fff" }}
            >
              Seleccionar imagen
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
        )}

        {imagen && (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              <div
                className="rounded-2xl p-4"
                style={{ background: C.surface, border: `1px solid ${C.border}` }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold">
                    Comparativa ·{" "}
                    <span style={{ color: C.textMuted }}>{nombreImagen}</span>
                  </h2>
                  <label
                    className="text-xs px-2 py-1 rounded cursor-pointer"
                    style={{
                      color: C.textMuted,
                      border: `1px solid ${C.border}`,
                    }}
                  >
                    Otra imagen
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
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <p
                      className="text-[10px] uppercase tracking-wide mb-1"
                      style={{ color: C.textDim }}
                    >
                      Original
                    </p>
                    <canvas
                      ref={originalRef}
                      className="w-full h-auto rounded"
                      style={{ background: C.surfaceAlt }}
                    />
                  </div>
                  <div>
                    <p
                      className="text-[10px] uppercase tracking-wide mb-1"
                      style={{ color: C.textDim }}
                    >
                      Pixel art
                    </p>
                    <canvas
                      ref={canvasRef}
                      className="w-full h-auto rounded"
                      style={{
                        background: C.surfaceAlt,
                        imageRendering: "pixelated",
                      }}
                    />
                  </div>
                </div>
              </div>

              {resultado && metricas && (
                <div
                  className="rounded-2xl p-4"
                  style={{
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                  }}
                >
                  <h2 className="text-sm font-semibold mb-3">Métricas</h2>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <Metrica label="Resolución" valor={metricas.resolucion} />
                    <Metrica label="Tiles únicos" valor={String(metricas.tiles)} />
                    <Metrica
                      label="Densidad"
                      valor={`${metricas.densidad} b/px`}
                    />
                  </div>
                  <p
                    className="text-[10px] uppercase tracking-wide mb-2"
                    style={{ color: C.textDim }}
                  >
                    Paleta extraída ({resultado.paletaHex.length} colores)
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {resultado.paletaHex.map((hex, i) => (
                      <div
                        key={i}
                        title={hex}
                        className="w-8 h-8 rounded"
                        style={{
                          background: hex,
                          border: `1px solid ${C.border}`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <aside className="space-y-4">
              <div
                className="rounded-2xl p-4 space-y-4"
                style={{
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                }}
              >
                <h2 className="text-sm font-semibold">Parámetros</h2>
                <Slider
                  label="Tamaño de píxel"
                  value={pixelSize}
                  min={1}
                  max={32}
                  unidad=" px"
                  onChange={setPixelSize}
                />
                <Slider
                  label="Número de colores"
                  value={colores}
                  min={2}
                  max={64}
                  onChange={setColores}
                />
                <Slider
                  label="Contraste"
                  value={contraste}
                  min={50}
                  max={200}
                  unidad=" %"
                  onChange={setContraste}
                />
                <Slider
                  label="Saturación"
                  value={saturacion}
                  min={0}
                  max={200}
                  unidad=" %"
                  onChange={setSaturacion}
                />
              </div>

              <div
                className="rounded-2xl p-4 space-y-3"
                style={{
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                }}
              >
                <h2 className="text-sm font-semibold">Guardar medición</h2>
                <input
                  type="text"
                  placeholder="id del material (ej: piedra_volcanica_canaria)"
                  value={nombreMaterial}
                  onChange={(e) => setNombreMaterial(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg"
                  style={{
                    background: C.surfaceAlt,
                    border: `1px solid ${C.border}`,
                    color: C.text,
                  }}
                />
                <button
                  onClick={guardarMedicion}
                  disabled={!resultado}
                  className="w-full py-2 rounded-lg text-xs font-medium disabled:opacity-40"
                  style={{ background: C.primary, color: "#fff" }}
                >
                  Guardar como perfil
                </button>
              </div>

              {mediciones.length > 0 && (
                <div
                  className="rounded-2xl p-4 space-y-3"
                  style={{
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                  }}
                >
                  <h2 className="text-sm font-semibold">
                    Mediciones ({mediciones.length})
                  </h2>
                  <ul className="space-y-2">
                    {mediciones.map((m) => (
                      <li
                        key={m.id}
                        className="text-xs p-2 rounded flex items-start justify-between gap-2"
                        style={{ background: C.surfaceAlt }}
                      >
                        <div className="flex-1 min-w-0">
                          <p
                            className="font-medium truncate"
                            style={{ color: C.text }}
                          >
                            {m.nombre}
                          </p>
                          <p
                            className="text-[10px] font-mono"
                            style={{ color: C.textMuted }}
                          >
                            {m.pixelSize}px · {m.colores}c · {m.contraste}% ·{" "}
                            {m.saturacion}%
                          </p>
                        </div>
                        <button
                          onClick={() => eliminarMedicion(m.id)}
                          className="text-[10px]"
                          style={{ color: C.textDim }}
                          aria-label="Eliminar"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() =>
                        descargar(
                          "materiales_base.json",
                          exportarJson(mediciones),
                          "application/json"
                        )
                      }
                      className="flex-1 py-2 rounded-lg text-[11px] font-medium"
                      style={{
                        background: C.surfaceAlt,
                        color: C.text,
                        border: `1px solid ${C.border}`,
                      }}
                    >
                      Exportar JSON
                    </button>
                    <button
                      onClick={() =>
                        descargar(
                          "pixel_art_styles.gd",
                          exportarGdScript(mediciones),
                          "text/plain"
                        )
                      }
                      className="flex-1 py-2 rounded-lg text-[11px] font-medium"
                      style={{
                        background: C.surfaceAlt,
                        color: C.text,
                        border: `1px solid ${C.border}`,
                      }}
                    >
                      Exportar GDScript
                    </button>
                  </div>
                </div>
              )}
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
