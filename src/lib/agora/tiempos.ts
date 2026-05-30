// ─── Ágora — utilidades de tiempo (lado servidor) ─────────────
// Cálculos sobre fechas que se ejecutan EXCLUSIVAMENTE en server
// components. Mantenerlos fuera del cuerpo del componente evita
// que react-hooks/purity marque Date.now() como impuro.

import "server-only";

export type TiemposDecision = {
  cerrada: boolean;
  horasRestantes: number;
};

export function calcularTiemposDecision(
  fechaCierreISO: string,
  resultado: string | null,
): TiemposDecision {
  const cierreMs = new Date(fechaCierreISO).getTime();
  const ahoraMs = Date.now();
  return {
    cerrada: resultado !== null || cierreMs < ahoraMs,
    horasRestantes: Math.max(
      0,
      Math.floor((cierreMs - ahoraMs) / (60 * 60 * 1000)),
    ),
  };
}
