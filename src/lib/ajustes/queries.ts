/**
 * Queries de ajustes de perfil — lectura y escritura de las 9 columnas
 * añadidas en la migración 20260509000000_settings_messaging.sql.
 *
 * Política RLS asumida (heredada de profiles):
 *  · SELECT: el propio usuario o admin.
 *  · UPDATE: el propio usuario o admin.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type Tema = "light" | "dark" | "system";
export type Tipografia = "georgia" | "inter" | "mono";

export type Preferencias = {
  // Notificaciones
  notif_respuestas_agora: boolean;
  notif_pec: boolean;
  notif_mensajes: boolean;
  // Boletines
  boletin: boolean;
  barrio_quincenal: boolean;
  // Privacidad
  mostrar_email: boolean;
  permitir_mensajes: boolean;
  is_public: boolean;
  // Apariencia
  tema: Tema;
  tipografia: Tipografia;
};

export const PREFERENCIAS_DEFECTO: Preferencias = {
  notif_respuestas_agora: true,
  notif_pec: true,
  notif_mensajes: true,
  boletin: false,
  barrio_quincenal: false,
  mostrar_email: false,
  permitir_mensajes: true,
  is_public: true,
  tema: "system",
  tipografia: "georgia",
};

const COLUMNAS = Object.keys(PREFERENCIAS_DEFECTO).join(",");

/** Devuelve las preferencias del usuario o defaults si la fila no existe. */
export async function getPreferencias(
  supabase: SupabaseClient,
  userId: string,
): Promise<Preferencias> {
  const { data, error } = await supabase
    .from("profiles")
    .select(COLUMNAS)
    .eq("id", userId)
    .single();

  if (error || !data) {
    if (error) console.warn("getPreferencias error:", error);
    return PREFERENCIAS_DEFECTO;
  }
  return { ...PREFERENCIAS_DEFECTO, ...(data as unknown as Preferencias) };
}

/**
 * Actualiza UNA preferencia. Devuelve el valor real persistido (que la
 * BD puede haber recortado por CHECK constraints — útil para tema /
 * tipografia).
 */
export async function actualizarPreferencia<K extends keyof Preferencias>(
  supabase: SupabaseClient,
  userId: string,
  campo: K,
  valor: Preferencias[K],
): Promise<Preferencias[K]> {
  const { data, error } = await supabase
    .from("profiles")
    .update({ [campo]: valor })
    .eq("id", userId)
    .select(campo as string)
    .single();

  if (error || !data) {
    throw error || new Error(`No se pudo actualizar ${String(campo)}`);
  }
  return (data as unknown as Record<string, unknown>)[
    campo as string
  ] as Preferencias[K];
}
