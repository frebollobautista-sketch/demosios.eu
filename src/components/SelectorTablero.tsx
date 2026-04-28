"use client";

import { useMemo, useState } from "react";
import { CANARIAS } from "@/lib/territorio/canarias";
import { BARRIOS_POR_MUNICIPIO } from "@/lib/territorio/barrios-juego";
import { MapaBarrios } from "./MapaBarrios";

/**
 * Wrapper cliente del tablero hexagonal con selector de municipio.
 *
 * Solo se ofrecen los municipios que tienen barrios mapeados en
 * `BARRIOS_POR_MUNICIPIO` — el resto no aparecen en el desplegable.
 * Cuando el mapa Supabase-driven (#16) esté vivo, este selector se
 * reemplaza por uno alimentado desde la BD con todos los municipios
 * disponibles.
 */
export function SelectorTablero({
  municipioInicialId = "las-palmas-de-gran-canaria",
}: {
  municipioInicialId?: string;
}) {
  const opciones = useMemo(() => {
    const ids = Object.keys(BARRIOS_POR_MUNICIPIO);
    const items: Array<{
      municipioId: string;
      islaId: string;
      islaNombre: string;
      municipioNombre: string;
      numBarrios: number;
    }> = [];
    for (const isla of CANARIAS) {
      for (const m of isla.municipios) {
        if (!ids.includes(m.id)) continue;
        items.push({
          municipioId: m.id,
          islaId: isla.id,
          islaNombre: isla.nombre,
          municipioNombre: m.nombre,
          numBarrios: BARRIOS_POR_MUNICIPIO[m.id].length,
        });
      }
    }
    return items;
  }, []);

  const [seleccionId, setSeleccionId] = useState(municipioInicialId);

  const seleccion = useMemo(() => {
    const par = CANARIAS.flatMap((isla) =>
      isla.municipios.map((m) => ({ isla, municipio: m })),
    ).find((p) => p.municipio.id === seleccionId);
    return par ?? null;
  }, [seleccionId]);

  if (!seleccion) {
    return (
      <p style={{ color: "var(--color-piedra)" }}>
        Municipio no encontrado en el catálogo territorial.
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <h2
          className="display text-[1.15rem]"
          style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
        >
          Tablero conceptual de capital
        </h2>
        <label className="inline-flex items-center gap-2 text-[0.9rem]">
          <span
            className="eyebrow"
            style={{ color: "var(--color-piedra)" }}
          >
            Municipio
          </span>
          <select
            value={seleccionId}
            onChange={(e) => setSeleccionId(e.target.value)}
            className="rounded-md px-2 py-1 text-[0.9rem]"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-linea)",
              color: "var(--color-papiro-ink)",
            }}
          >
            {opciones.map((o) => (
              <option key={o.municipioId} value={o.municipioId}>
                {o.municipioNombre} · {o.islaNombre}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p
        className="text-[0.9rem] mb-4 max-w-2xl"
        style={{ color: "var(--color-piedra)" }}
      >
        Cada hexágono es un barrio coloreado por el tipo de capital
        dominante. Los de borde punteado y marca roja son <strong>candidatos
        a recuperación</strong> (&gt;30 % en manos rentistas o corporativas).
        Pulsa un barrio para ver composición y acciones.
      </p>
      <MapaBarrios isla={seleccion.isla} municipio={seleccion.municipio} />
      <p
        className="text-[0.78rem] mt-3"
        style={{ color: "var(--color-piedra-clara)" }}
      >
        Datos provisionales con lógica editorial. Cuando el mapa dinámico
        contra Supabase esté vivo, los porcentajes se calcularán a partir
        de catastro + renta INE + contribuciones reales de ciudadanos.
      </p>
    </div>
  );
}
