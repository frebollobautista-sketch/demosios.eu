"use client";

// ─── POLIS · Juego: hook de geolocalización ──────────────────────
// Pide permiso, observa la posición, y devuelve estado + posición.
// En modo TEST la posición se simula en torno al centro de Vegueta
// para poder probar el flujo desde un Mac sin moverse.

import { useCallback, useEffect, useRef, useState } from "react";
import { CENTRO_VEGUETA } from "./geo";
import type { EstadoGps, PosicionUsuario } from "./tipos";

type Resultado = {
  estado: EstadoGps;
  posicion: PosicionUsuario | null;
  /** Solicita permiso explícitamente (botón). */
  solicitar: () => void;
  /** Activa modo TEST: posición simulada cerca del Mercado de Vegueta. */
  activarTest: (offsetMetros?: { dx: number; dz: number }) => void;
  /** Vuelve a posición real (desactiva test). */
  desactivarTest: () => void;
  esTest: boolean;
};

/**
 * Posición simulada por defecto: justo al lado del Mercado de
 * Vegueta. Sirve para que un dev sin GPS active el modo mapeo.
 */
const POS_TEST_DEFECTO = {
  lat: 28.0985,
  lng: -15.4147,
};

export function useGeolocation(): Resultado {
  const [estado, setEstado] = useState<EstadoGps>("inicial");
  const [posicion, setPosicion] = useState<PosicionUsuario | null>(null);
  const [esTest, setEsTest] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  const limpiarWatch = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== "undefined") {
      navigator.geolocation?.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const solicitar = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setEstado("indisponible");
      return;
    }
    setEstado("solicitando");
    limpiarWatch();
    watchIdRef.current = navigator.geolocation.watchPosition(
      (p) => {
        setEstado("ok");
        setPosicion({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracyM: p.coords.accuracy,
          esTest: false,
          ts: Date.now(),
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setEstado("denegado");
        else setEstado("indisponible");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5_000,
        timeout: 15_000,
      },
    );
  }, [limpiarWatch]);

  const activarTest = useCallback(
    (offsetMetros?: { dx: number; dz: number }) => {
      limpiarWatch();
      // Convertir offset metros → lat/lng (aprox).
      const RADIO_TIERRA_M = 6_378_137;
      const radLat = (CENTRO_VEGUETA.lat * Math.PI) / 180;
      const dLat = offsetMetros ? -offsetMetros.dz / RADIO_TIERRA_M : 0;
      const dLng = offsetMetros
        ? offsetMetros.dx / (RADIO_TIERRA_M * Math.cos(radLat))
        : 0;
      const lat = POS_TEST_DEFECTO.lat + (dLat * 180) / Math.PI;
      const lng = POS_TEST_DEFECTO.lng + (dLng * 180) / Math.PI;

      setEsTest(true);
      setEstado("ok");
      setPosicion({
        lat,
        lng,
        accuracyM: 5,
        esTest: true,
        ts: Date.now(),
      });
    },
    [limpiarWatch],
  );

  const desactivarTest = useCallback(() => {
    setEsTest(false);
    setPosicion(null);
    setEstado("inicial");
  }, []);

  useEffect(() => {
    return () => {
      limpiarWatch();
    };
  }, [limpiarWatch]);

  return { estado, posicion, solicitar, activarTest, desactivarTest, esTest };
}
