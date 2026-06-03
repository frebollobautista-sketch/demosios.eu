// Carga el contexto de desbloqueo de cosméticos de un usuario (server-only):
//   · nivel de grado actual, derivado de `contribuciones` (misma fórmula que el
//     perfil), no de profiles.grado_id (que puede no estar poblado todavía),
//   · logros conseguidos (user_logros) e insignias (user_insignias), leídos de
//     forma defensiva: si las tablas BLaP aún no existen, conjuntos vacíos.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  agregarCapital,
  type Contribucion,
  type TipoContribucion,
} from "@/lib/capital/contribuciones";
import { gradoActual } from "@/lib/cursus/grados";
import {
  contextoVacio,
  type ContextoDesbloqueo,
} from "@/lib/avatar/catalogo";

export async function cargarContexto(
  supabase: SupabaseClient,
  userId: string,
): Promise<ContextoDesbloqueo> {
  const ctx = contextoVacio();

  // 1) Grado actual a partir de las contribuciones.
  try {
    const { data } = await supabase
      .from("contribuciones")
      .select("tipo, seccion_pharos")
      .eq("user_id", userId);

    const filas =
      (data as { tipo: string; seccion_pharos: string | null }[] | null) ?? [];
    const contribuciones: Contribucion[] = filas.map((f, i) => ({
      id: String(i),
      tipo: f.tipo as TipoContribucion,
      seccionPharos: f.seccion_pharos ?? undefined,
      creada: "", // no se usa para el cálculo de grado
    }));
    const capital = agregarCapital(contribuciones);
    ctx.nivelGrado = gradoActual(capital).nivel;
  } catch {
    // sin contribuciones → nivel 0
  }

  // 2) Logros conseguidos (defensivo).
  try {
    const { data, error } = await supabase
      .from("user_logros")
      .select("logro_id, conseguido_en")
      .eq("user_id", userId);
    if (!error && data) {
      for (const r of data as { logro_id: string; conseguido_en: string | null }[]) {
        if (r.conseguido_en) ctx.logros.add(r.logro_id);
      }
    }
  } catch {
    // tabla aún no existe
  }

  // 3) Insignias (defensivo).
  try {
    const { data, error } = await supabase
      .from("user_insignias")
      .select("insignia_id")
      .eq("user_id", userId);
    if (!error && data) {
      for (const r of data as { insignia_id: string }[]) {
        ctx.insignias.add(r.insignia_id);
      }
    }
  } catch {
    // tabla aún no existe
  }

  return ctx;
}
