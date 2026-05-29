"use client";

// ─── POLIS · Juego: contenedor / orquestador (R3F) ───────────────
// Monta el motor 3D Three.js + R3F, mantiene el HUD, panel de
// misiones y la ficha de mapeo. Ya no hay modos espectador/test:
// el motor 3D es la pantalla principal, no requiere GPS, el avatar
// camina libre por Vegueta + Triana.

import { useCallback, useEffect, useMemo, useState } from "react";
import { JUGADOR_INICIAL, MISIONES_INICIALES } from "@/lib/polis-juego/mock";
import type {
  Anotacion,
  Jugador,
  Mision,
  PuntosJuego,
} from "@/lib/polis-juego/tipos";
import { totalPEC } from "@/lib/polis-juego/tipos";
import { HUDJugador } from "./HUDJugador";
import { PanelMisiones } from "./PanelMisiones";
import { ToastPEC } from "./ToastPEC";
import { Motor3D, type AnotacionVisual } from "./Motor3D";
import { FichaMapeo, type DatosFicha } from "./FichaMapeo";
import type { EdifMesh } from "@/lib/polis-juego/useEscena3D";

type ToastEvent = {
  id: number;
  ejePrincipal: "exploracion" | "calibrado" | "recuperacion";
  pec: PuntosJuego;
  mensaje: string;
};

export function JuegoPolis() {
  const [jugador, setJugador] = useState<Jugador>(JUGADOR_INICIAL);
  const [misiones, setMisiones] = useState<Mision[]>(MISIONES_INICIALES);
  const [edificioSeleccionado, setEdificioSeleccionado] = useState<EdifMesh | null>(null);
  const [toasts, setToasts] = useState<ToastEvent[]>([]);
  const [tick, setTick] = useState<{
    avatarPos: [number, number];
    anotablesCerca: number;
    calleActual: string | null;
  }>({ avatarPos: [0, 0], anotablesCerca: 0, calleActual: null });
  const [poiCerca, setPoiCerca] = useState<{ n: string; k: string | null } | null>(null);

  // Mapa de anotaciones para colorear edificios.
  const anotacionesVisuales = useMemo(() => {
    const m = new Map<string, AnotacionVisual>();
    for (const a of jugador.anotaciones) {
      m.set(a.edificioId, { capital: a.capital });
    }
    return m;
  }, [jugador.anotaciones]);

  const lanzarToast = useCallback(
    (
      ejePrincipal: "exploracion" | "calibrado" | "recuperacion",
      pec: PuntosJuego,
      mensaje: string,
    ) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, ejePrincipal, pec, mensaje }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
    },
    [],
  );

  const sumarPEC = useCallback((delta: PuntosJuego) => {
    setJugador((j) => ({
      ...j,
      pec: {
        exploracion: j.pec.exploracion + delta.exploracion,
        calibrado: j.pec.calibrado + delta.calibrado,
        recuperacion: j.pec.recuperacion + delta.recuperacion,
      },
    }));
  }, []);

  const enviarAnotacion = useCallback(
    (datos: DatosFicha) => {
      if (!edificioSeleccionado) return;
      const anotacion: Anotacion = {
        id: `an-${Date.now()}`,
        edificioId: edificioSeleccionado.id,
        ts: Date.now(),
        posUsuarioLngLat: [0, 0],
        distanciaM: 0,
        uso: datos.uso,
        capital: datos.capital,
        anioAprox: datos.anioAprox,
        materialesDetectados: datos.materialesDetectados,
        conservacion: datos.conservacion,
        nota: datos.nota || undefined,
      };
      const explo = 10;
      const cal =
        8 +
        (datos.materialesDetectados.length >= 1 ? 6 : 0) +
        (datos.anioAprox > 1500 ? 4 : 0);
      const rec =
        datos.capital === "corporativo" ? 60 : datos.capital === "rentista" ? 40 : 0;
      const delta: PuntosJuego = {
        exploracion: explo,
        calibrado: cal,
        recuperacion: rec,
      };
      setJugador((j) => ({
        ...j,
        anotaciones: [...j.anotaciones, anotacion],
        edificiosExplorados: Array.from(new Set([...j.edificiosExplorados, edificioSeleccionado.id])),
      }));
      sumarPEC(delta);
      const ejeP =
        rec > 0 ? "recuperacion" : cal > explo ? "calibrado" : "exploracion";
      const total = explo + cal + rec;
      lanzarToast(ejeP, delta, `+${total} PEC · anotación firmada`);
      setEdificioSeleccionado(null);
    },
    [edificioSeleccionado, sumarPEC, lanzarToast],
  );

  // ── Recalcular progreso de misiones ──
  useEffect(() => {
    const numAnotaciones = jugador.anotaciones.length;
    const distintos = new Set(jugador.anotaciones.map((a) => a.edificioId)).size;
    const conTea = jugador.anotaciones.filter((a) =>
      a.materialesDetectados.includes("madera_tea"),
    ).length;
    const rentistas = jugador.anotaciones.filter(
      (a) => a.capital === "rentista" || a.uso === "vivienda-vacacional",
    ).length;
    const corporativas = jugador.anotaciones.filter(
      (a) => a.capital === "corporativo",
    ).length;

    setMisiones((prev) =>
      prev.map((m) => {
        let prog = m.progreso;
        switch (m.id) {
          case "primer-mapeo":
            prog = numAnotaciones >= 1 ? 1 : 0; break;
          case "calle-completa":
            prog = Math.min(1, distintos / 5); break;
          case "ojo-tea":
            prog = Math.min(1, conTea / 3); break;
          case "cazador-vacacional":
            prog = Math.min(1, rentistas / 2); break;
          case "primera-corporativa":
            prog = corporativas >= 1 ? 1 : 0; break;
        }
        return { ...m, progreso: prog };
      }),
    );
  }, [jugador.anotaciones]);

  return (
    <div className="relative">
      <HUDJugador jugador={jugador} totalPec={totalPEC(jugador.pec)} />

      <div className="grid lg:grid-cols-[1fr_320px] gap-6 mt-6">
        <div>
          <Motor3D
            anotaciones={anotacionesVisuales}
            onSeleccionarEdificio={(e) => setEdificioSeleccionado(e)}
            onPoiCerca={setPoiCerca}
            onTick={setTick}
          />

          {/* Banda informativa debajo del canvas */}
          <div
            className="mt-3 rounded-lg px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.78rem]"
            style={{
              background: "var(--color-papiro-soft)",
              border: "1px solid var(--color-linea)",
              color: "var(--color-piedra)",
            }}
          >
            {tick.calleActual && (
              <span>
                <span
                  className="eyebrow"
                  style={{ color: "var(--color-piedra-clara)", fontSize: "0.58rem", marginRight: 6 }}
                >
                  CALLE
                </span>
                <strong style={{ color: "var(--color-papiro-ink)" }}>{tick.calleActual}</strong>
              </span>
            )}
            <span>
              Anotables a ≤25 m:{" "}
              <strong
                style={{
                  color: tick.anotablesCerca > 0
                    ? "var(--color-ocre-deep)"
                    : "var(--color-piedra)",
                }}
              >
                {tick.anotablesCerca}
              </strong>
            </span>
            {poiCerca && (
              <span>
                <span
                  className="eyebrow"
                  style={{ color: "var(--color-piedra-clara)", fontSize: "0.58rem", marginRight: 6 }}
                >
                  POI
                </span>
                <strong style={{ color: "var(--color-oliva)" }}>{poiCerca.n}</strong>
                <span style={{ color: "var(--color-piedra-clara)", marginLeft: 6 }}>
                  {poiCerca.k}
                </span>
              </span>
            )}
            <span style={{ marginLeft: "auto", color: "var(--color-piedra-clara)" }}>
              WASD · Shift correr · clic edificio cercano
            </span>
          </div>
        </div>

        <PanelMisiones misiones={misiones} jugador={jugador} />
      </div>

      {edificioSeleccionado && (
        <FichaMapeo
          edificio={{
            id: edificioSeleccionado.id,
            poligonoLngLat: [],
            alturaM: edificioSeleccionado.hReal,
            centroideLngLat: [0, 0],
            seccionId: "",
            poligonoXZ: edificioSeleccionado.xz,
            centroideXZ: edificioSeleccionado.cxz,
          }}
          posicion={{
            lat: 28.099,
            lng: -15.417,
            accuracyM: 0,
            esTest: false,
            ts: Date.now(),
          }}
          distanciaM={0}
          onCerrar={() => setEdificioSeleccionado(null)}
          onEnviar={enviarAnotacion}
        />
      )}

      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <ToastPEC
            key={t.id}
            ejePrincipal={t.ejePrincipal}
            pec={t.pec}
            mensaje={t.mensaje}
          />
        ))}
      </div>
    </div>
  );
}
