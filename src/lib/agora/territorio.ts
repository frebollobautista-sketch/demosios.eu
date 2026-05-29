// ─── Ágora — utilidades para anclaje territorial ───────────────
// Resuelve y valida slugs de isla / municipio / barrio contra el
// catálogo en src/lib/territorio/canarias.ts. Devuelve nombres
// humanos para pintar UI.

import { CANARIAS, type Barrio, type Isla, type Municipio } from "@/lib/territorio/canarias";

export type Territorio = {
  isla: Isla | null;
  municipio: Municipio | null;
  barrio: Barrio | null;
};

export function resolverTerritorio(
  islaId?: string | null,
  municipioId?: string | null,
  barrioId?: string | null,
): Territorio {
  const isla = islaId ? CANARIAS.find((i) => i.id === islaId) ?? null : null;
  const municipio = isla && municipioId
    ? isla.municipios.find((m) => m.id === municipioId) ?? null
    : null;
  const barrio = municipio && barrioId
    ? municipio.barrios.find((b) => b.id === barrioId) ?? null
    : null;
  return { isla, municipio, barrio };
}

export function etiquetaTerritorio(t: Territorio): string {
  const partes = [
    t.barrio?.nombre,
    t.municipio?.nombre,
    t.isla?.nombre,
  ].filter(Boolean);
  return partes.length > 0 ? partes.join(" · ") : "Provincial";
}

/** Validación al persistir: si llega un id que no existe, lo convertimos a null. */
export function normalizarTerritorio(
  islaId?: string | null,
  municipioId?: string | null,
  barrioId?: string | null,
): { isla_id: string | null; municipio_id: string | null; barrio_id: string | null } {
  const t = resolverTerritorio(islaId, municipioId, barrioId);
  return {
    isla_id: t.isla?.id ?? null,
    municipio_id: t.municipio?.id ?? null,
    barrio_id: t.barrio?.id ?? null,
  };
}
