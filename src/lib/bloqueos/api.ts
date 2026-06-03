// ─── Bloqueos entre usuarios ──────────────────────────────────────
// Tabla `bloqueos` (bloqueador_id, bloqueado_id) creada en la migración
// 20260603000000_auth_perfil_rgpd.sql. Mientras la migración no esté
// aplicada, estas funciones degradan con gracia: devuelven estados
// neutros en lugar de romper la UI.

import type { SupabaseClient } from "@supabase/supabase-js";

/** ¿La columna/tabla todavía no existe? (migración sin aplicar) */
function faltaTabla(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const m = (error.message || "").toLowerCase();
  return (
    error.code === "42P01" || // undefined_table
    m.includes("does not exist") ||
    m.includes("relation") ||
    m.includes("bloqueos")
  );
}

/** Bloquea a otro usuario. Idempotente: si ya estaba, no falla. */
export async function bloquear(
  supabase: SupabaseClient,
  bloqueadoId: string,
): Promise<{ ok: boolean; razon?: "no-disponible" | "error" }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, razon: "error" };

  const { error } = await supabase
    .from("bloqueos")
    .insert({ bloqueador_id: user.id, bloqueado_id: bloqueadoId });

  // Conflicto de unicidad = ya estaba bloqueado → lo damos por bueno.
  if (error && error.code === "23505") return { ok: true };
  if (faltaTabla(error)) return { ok: false, razon: "no-disponible" };
  if (error) return { ok: false, razon: "error" };
  return { ok: true };
}

/** Deshace el bloqueo. Idempotente. */
export async function desbloquear(
  supabase: SupabaseClient,
  bloqueadoId: string,
): Promise<{ ok: boolean; razon?: "no-disponible" | "error" }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, razon: "error" };

  const { error } = await supabase
    .from("bloqueos")
    .delete()
    .eq("bloqueador_id", user.id)
    .eq("bloqueado_id", bloqueadoId);

  if (faltaTabla(error)) return { ok: false, razon: "no-disponible" };
  if (error) return { ok: false, razon: "error" };
  return { ok: true };
}

/** ¿He bloqueado yo a este usuario? */
export async function estaBloqueado(
  supabase: SupabaseClient,
  bloqueadoId: string,
): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from("bloqueos")
    .select("bloqueado_id")
    .eq("bloqueador_id", user.id)
    .eq("bloqueado_id", bloqueadoId)
    .maybeSingle();

  if (error) return false; // tabla ausente o sin permisos → no bloqueado
  return !!data;
}

/** Lista de IDs que el usuario actual tiene bloqueados. */
export async function listarBloqueados(
  supabase: SupabaseClient,
): Promise<string[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("bloqueos")
    .select("bloqueado_id")
    .eq("bloqueador_id", user.id);

  if (error || !data) return [];
  return data.map((r: { bloqueado_id: string }) => r.bloqueado_id);
}
