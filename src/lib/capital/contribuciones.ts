// ─── Contribuciones: qué acciones suman capital ───────────────────
// Cada acción cívica en OCRE genera puntos de capital en los 3 ejes
// según su naturaleza. Los valores son conservadores: no queremos
// premiar la cantidad sino la calidad y la persistencia.

import { EJES, EjeId, PesoPorEje, pesoDeSeccion } from "./ejes";

export type TipoContribucion =
  | "video_cursus"        // Video publicado en Bibliotheka / Cursus honorum
  | "recurso_koina"       // Recurso subido a Bibliotheka / Koiná
  | "hilo_agora"          // Hilo abierto en Ágora
  | "respuesta_agora"     // Respuesta en un hilo de Ágora
  | "pec_recibido"        // Otro ciudadano avala tu aportación
  | "espacio_recuperado"  // Lideras la recuperación de un bloque en Polis
  | "mapa_pin";           // Marcaje en Polis (edificio, oficio, uso)

export type Contribucion = {
  id: string;
  tipo: TipoContribucion;
  seccionPharos?: string; // opcional — algunas aportaciones son transversales
  creada: string;         // ISO
};

/** Puntos base por tipo de contribución, antes de ponderar por sección. */
const BASE_POR_TIPO: Record<TipoContribucion, number> = {
  video_cursus: 8,
  recurso_koina: 5,
  hilo_agora: 3,
  respuesta_agora: 1,
  pec_recibido: 2,
  espacio_recuperado: 20,
  mapa_pin: 1,
};

/**
 * Reparto fijo por tipo cuando la contribución NO tiene sección PHAROS
 * asociada. Por defecto damos peso equilibrado a los tres ejes.
 */
const REPARTO_POR_TIPO_SIN_SECCION: Record<TipoContribucion, PesoPorEje> = {
  video_cursus: { koinonia: 0.3, paideia: 1.0, politeia: 0.3 },
  recurso_koina: { koinonia: 0.4, paideia: 1.0, politeia: 0.2 },
  hilo_agora: { koinonia: 0.6, paideia: 0.3, politeia: 0.8 },
  respuesta_agora: { koinonia: 0.8, paideia: 0.3, politeia: 0.5 },
  pec_recibido: { koinonia: 1.0, paideia: 0.2, politeia: 0.2 },
  espacio_recuperado: { koinonia: 0.6, paideia: 0.3, politeia: 1.0 },
  mapa_pin: { koinonia: 0.4, paideia: 0.4, politeia: 0.6 },
};

/**
 * Calcula cuántos puntos ganás en cada eje por una contribución dada.
 * Si la contribución tiene sección PHAROS asociada, sumamos ese peso
 * al reparto base por tipo; si no, usamos solo el reparto por tipo.
 */
export function puntosPorContribucion(c: Contribucion): PesoPorEje {
  const base = BASE_POR_TIPO[c.tipo];
  const reparto = { ...REPARTO_POR_TIPO_SIN_SECCION[c.tipo] };

  if (c.seccionPharos) {
    const pesoSeccion = pesoDeSeccion(c.seccionPharos);
    for (const ejeId of Object.keys(reparto) as EjeId[]) {
      // La sección pesa la MITAD que el reparto por tipo, para que la
      // taxonomía temática modere pero no domine el cálculo.
      reparto[ejeId] = reparto[ejeId] + pesoSeccion[ejeId] * 0.5;
    }
  }

  return {
    koinonia: Math.round(base * reparto.koinonia),
    paideia: Math.round(base * reparto.paideia),
    politeia: Math.round(base * reparto.politeia),
  };
}

/** Suma total de capital acumulado por eje a partir de una lista de contribuciones. */
export function agregarCapital(contribuciones: Contribucion[]): PesoPorEje {
  const total: PesoPorEje = { koinonia: 0, paideia: 0, politeia: 0 };
  for (const c of contribuciones) {
    const p = puntosPorContribucion(c);
    total.koinonia += p.koinonia;
    total.paideia += p.paideia;
    total.politeia += p.politeia;
  }
  return total;
}

/** Puntos totales (suma simple de los 3 ejes) — útil para el nivel del cursus. */
export function puntosTotales(p: PesoPorEje): number {
  return p.koinonia + p.paideia + p.politeia;
}

/** Eje dominante del ciudadano — define su "inclinación" visible en el perfil. */
export function ejeDominante(p: PesoPorEje): EjeId {
  let dom: EjeId = "koinonia";
  let max = p.koinonia;
  if (p.paideia > max) {
    dom = "paideia";
    max = p.paideia;
  }
  if (p.politeia > max) {
    dom = "politeia";
  }
  return dom;
}

/** Re-export por comodidad. */
export { EJES };
