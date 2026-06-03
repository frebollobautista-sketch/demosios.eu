/**
 * Utilidades de `handle` (nombre de usuario único).
 *
 * Reglas: minúsculas, números y guión bajo, 3-30 caracteres.
 * La disponibilidad se comprueba contra la BD con tolerancia: usa la RPC
 * `handle_disponible` (SECURITY DEFINER, case-insensitive) y, si esa función
 * todavía no existe en la BD (migración sin aplicar), cae a un SELECT directo
 * sobre `profiles` (cuya RLS de lectura es pública).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const HANDLE_REGEX = /^[a-z0-9_]{3,30}$/;

/** Normaliza la entrada del usuario a un handle válido en curso de escritura. */
export function normalizarHandle(v: string): string {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 30);
}

/** Valida el formato. Devuelve mensaje de error en español o "" si es válido. */
export function validarHandle(h: string): string {
  if (!h) return "Elige un nombre de usuario.";
  if (h.length < 3) return "Mínimo 3 caracteres.";
  if (h.length > 30) return "Máximo 30 caracteres.";
  if (!HANDLE_REGEX.test(h))
    return "Solo minúsculas, números y guión bajo (_).";
  return "";
}

export type DisponibilidadHandle = "disponible" | "ocupado" | "error";

/** Comprueba si un handle está libre. No valida formato (hazlo antes). */
export async function handleDisponible(
  supabase: SupabaseClient,
  handle: string,
): Promise<DisponibilidadHandle> {
  const h = handle.trim().toLowerCase();
  // 1) Intento por RPC (recomendado).
  const rpc = await supabase.rpc("handle_disponible", { p_handle: h });
  if (!rpc.error) {
    return rpc.data ? "disponible" : "ocupado";
  }
  // 2) Fallback: SELECT directo (RLS de profiles es lectura pública).
  const sel = await supabase
    .from("profiles")
    .select("id")
    .ilike("handle", h)
    .maybeSingle();
  if (sel.error && sel.error.code !== "PGRST116") {
    return "error";
  }
  return sel.data ? "ocupado" : "disponible";
}
