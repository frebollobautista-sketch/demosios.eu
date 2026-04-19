// ─── OCRE: Ejes de capital ciudadano ──────────────────────────────
// Heredado del modelo PHAROS. Cada una de las 8 secciones temáticas
// de PHAROS (ver src/lib/pharos/secciones.ts) pesa sobre uno o dos
// de los tres ejes de capital clásico adaptados a la ciudadanía:
//
//   · KOINONÍA   (κοινωνία)  — capital social: vínculos, cuidado, comunidad
//   · PAIDEÍA    (παιδεία)   — capital cultural: formación, obra, memoria
//   · POLITEÍA   (πολιτεία)  — capital político: gobernanza, ley, res publica
//
// No mezclamos con capital económico: OCRE nace para actuar fuera de
// las lógicas de acumulación y explotación de mercado.
//
// Las "contribuciones" (publicar un recurso, liderar un hilo, subir un
// video al cursus honorum, recuperar un espacio en Polis) suman puntos
// en los ejes según su naturaleza. El sistema es aditivo y transparente.

import { SECCIONES } from "@/lib/pharos/secciones";

export type EjeId = "koinonia" | "paideia" | "politeia";

export type Eje = {
  id: EjeId;
  nombre: string;
  nombreGriego: string;
  descripcion: string;
  color: string;
  colorTenue: string;
  icono: string;
  /** Secciones PHAROS que alimentan principalmente este eje. */
  seccionesPrincipales: string[];
  /** Secciones PHAROS que alimentan secundariamente este eje. */
  seccionesSecundarias: string[];
};

export const EJES: Eje[] = [
  {
    id: "koinonia",
    nombre: "Capital social",
    nombreGriego: "Κοινωνία",
    descripcion:
      "Vínculos, cuidado mutuo, asociacionismo, convivencia. Crece cuando aparecen otras personas como respaldo (PEC) de lo que haces.",
    color: "var(--color-siena)",
    colorTenue: "#F0DED3",
    icono: "🤝",
    seccionesPrincipales: ["salud-servicios-sociales", "el-comun", "migracion-cooperacion"],
    seccionesSecundarias: ["defensa-geopolitica"],
  },
  {
    id: "paideia",
    nombre: "Capital cultural",
    nombreGriego: "Παιδεία",
    descripcion:
      "Formación, obra, memoria del común. Crece al publicar recursos, videos o hilos que otros usan para aprender.",
    color: "var(--color-ocre-deep)",
    colorTenue: "#EFE2C1",
    icono: "📜",
    seccionesPrincipales: ["medios-desinformacion", "trabajo-4ri"],
    seccionesSecundarias: ["cambio-climatico", "el-comun"],
  },
  {
    id: "politeia",
    nombre: "Capital político",
    nombreGriego: "Πολιτεία",
    descripcion:
      "Res publica: gobernanza, deliberación, recuperación de espacios. Crece al proponer, votar y sostener decisiones comunes.",
    color: "var(--color-oliva)",
    colorTenue: "#DEE6D0",
    icono: "⚖️",
    seccionesPrincipales: ["cambio-climatico", "industria-energia", "defensa-geopolitica"],
    seccionesSecundarias: ["migracion-cooperacion", "el-comun"],
  },
];

/** Devuelve el eje por id o lanza si no existe. */
export function eje(id: EjeId): Eje {
  const e = EJES.find((x) => x.id === id);
  if (!e) throw new Error(`Eje desconocido: ${id}`);
  return e;
}

/**
 * Tabla inversa: dada una sección PHAROS, devuelve los ejes (con peso)
 * que recibe cada contribución. Peso principal = 1.0, secundario = 0.4.
 */
export type PesoPorEje = Record<EjeId, number>;

export function pesoDeSeccion(seccionId: string): PesoPorEje {
  const pesos: PesoPorEje = { koinonia: 0, paideia: 0, politeia: 0 };
  for (const e of EJES) {
    if (e.seccionesPrincipales.includes(seccionId)) pesos[e.id] += 1.0;
    else if (e.seccionesSecundarias.includes(seccionId)) pesos[e.id] += 0.4;
  }
  return pesos;
}

/** Sanity export: asegúrate en build de que todas las secciones están cubiertas. */
export function coberturaSecciones(): {
  cubierta: string[];
  huerfanas: string[];
} {
  const todas = SECCIONES.map((s) => s.id);
  const cubierta = todas.filter((id) =>
    EJES.some(
      (e) =>
        e.seccionesPrincipales.includes(id) ||
        e.seccionesSecundarias.includes(id),
    ),
  );
  const huerfanas = todas.filter((id) => !cubierta.includes(id));
  return { cubierta, huerfanas };
}
