/**
 * Queries de Ágora — funciones de acceso a Supabase para hilos, comentarios y PECs.
 *
 * Cada función está pensada para usarse desde Server Components (server.ts)
 * o desde Client Components (client.ts). El parámetro `supabase` permite
 * inyectar el cliente correspondiente sin acoplar este módulo a uno.
 *
 * Política RLS de referencia (migración 20260502000000_agora.sql):
 *  - SELECT: público para todos (excepto shadow-banned).
 *  - INSERT: requiere sesión (autor_id = auth.uid()).
 *  - UPDATE/DELETE: solo autor o admin.
 *  - PECs: SELECT público (para conteos), INSERT/DELETE solo propio.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type Hilo = {
  id: string;
  autor_id: string;
  titulo: string;
  cuerpo: string;
  seccion_pharos: string;
  modo: "debate" | "propuesta_decidim" | "consenso_polis";
  estado: "abierto" | "archivado" | "cerrado";
  fijado: boolean;
  pec_count: number;
  comentario_count: number;
  creado: string;
  actualizado: string;
  // Joins manuales que añadimos:
  autor?: { handle: string; display_name: string | null; avatar_url: string | null };
  pec_dado?: boolean; // true si el usuario actual dio PEC
};

export type Comentario = {
  id: string;
  hilo_id: string;
  parent_id: string | null;
  autor_id: string;
  cuerpo: string;
  pec_count: number;
  creado: string;
  autor?: { handle: string; display_name: string | null; avatar_url: string | null };
  pec_dado?: boolean;
};

/**
 * Conteo de hilos abiertos por cada sección PHAROS.
 * Devuelve un mapa { seccion_id: count }.
 */
export async function getCountHilosPorSeccion(
  supabase: SupabaseClient,
): Promise<Record<string, number>> {
  // Una sola query agregada — usamos rpc si existiera. Como no, hacemos
  // un select count(*) agrupado. Supabase JS no soporta GROUP BY directo,
  // así que traemos solo seccion_pharos y agregamos en memoria. Es eficiente
  // mientras hilos < ~10k, suficiente para empezar.
  const { data, error } = await supabase
    .from("agora_hilos")
    .select("seccion_pharos")
    .eq("estado", "abierto");

  if (error) {
    console.warn("getCountHilosPorSeccion error:", error);
    return {};
  }
  const counts: Record<string, number> = {};
  for (const row of data || []) {
    const k = (row as { seccion_pharos: string }).seccion_pharos;
    counts[k] = (counts[k] || 0) + 1;
  }
  return counts;
}

/**
 * Lista de hilos de una sección, orden actualizado desc.
 * Página cliente: límite por defecto 30.
 */
export async function getHilosPorSeccion(
  supabase: SupabaseClient,
  seccionId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<Hilo[]> {
  const { limit = 30, offset = 0 } = opts;
  const { data, error } = await supabase
    .from("agora_hilos")
    .select(
      `id, autor_id, titulo, cuerpo, seccion_pharos, modo, estado, fijado,
       pec_count, comentario_count, creado, actualizado,
       autor:profiles!agora_hilos_autor_id_fkey(handle, display_name, avatar_url)`,
    )
    .eq("seccion_pharos", seccionId)
    .eq("estado", "abierto")
    .order("fijado", { ascending: false })
    .order("actualizado", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.warn("getHilosPorSeccion error:", error);
    return [];
  }
  return (data || []) as unknown as Hilo[];
}

/**
 * Obtiene un hilo por ID + sus comentarios planos (sin anidar).
 * La anidación con parent_id la haremos en una iteración 2 cuando hagamos
 * árbol recursivo. Para v1 es lista lineal por orden de creación.
 */
export async function getHiloConComentarios(
  supabase: SupabaseClient,
  hiloId: string,
): Promise<{ hilo: Hilo | null; comentarios: Comentario[] }> {
  const [hiloRes, comsRes] = await Promise.all([
    supabase
      .from("agora_hilos")
      .select(
        `id, autor_id, titulo, cuerpo, seccion_pharos, modo, estado, fijado,
         pec_count, comentario_count, creado, actualizado,
         autor:profiles!agora_hilos_autor_id_fkey(handle, display_name, avatar_url)`,
      )
      .eq("id", hiloId)
      .single(),
    supabase
      .from("agora_comentarios")
      .select(
        `id, hilo_id, parent_id, autor_id, cuerpo, pec_count, creado,
         autor:profiles!agora_comentarios_autor_id_fkey(handle, display_name, avatar_url)`,
      )
      .eq("hilo_id", hiloId)
      .order("creado", { ascending: true }),
  ]);

  if (hiloRes.error) console.warn("getHilo error:", hiloRes.error);
  if (comsRes.error) console.warn("getComentarios error:", comsRes.error);

  return {
    hilo: (hiloRes.data as unknown as Hilo) || null,
    comentarios: (comsRes.data || []) as unknown as Comentario[],
  };
}

/**
 * Crea un hilo nuevo. autor_id se infiere de la sesión activa por RLS.
 * Devuelve el id del hilo creado o lanza error.
 */
export async function crearHilo(
  supabase: SupabaseClient,
  data: {
    titulo: string;
    cuerpo: string;
    seccion_pharos: string;
    modo?: "debate" | "propuesta_decidim" | "consenso_polis";
  },
): Promise<{ id: string }> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("Necesitas iniciar sesión para crear un hilo.");

  const { data: hilo, error } = await supabase
    .from("agora_hilos")
    .insert({
      autor_id: user.user.id,
      titulo: data.titulo.trim(),
      cuerpo: data.cuerpo.trim(),
      seccion_pharos: data.seccion_pharos,
      modo: data.modo || "debate",
    })
    .select("id")
    .single();

  if (error || !hilo) throw error || new Error("No se pudo crear el hilo");
  return { id: hilo.id as string };
}

/**
 * Crea un comentario en un hilo. parent_id opcional para respuestas anidadas.
 */
export async function crearComentario(
  supabase: SupabaseClient,
  data: { hilo_id: string; cuerpo: string; parent_id?: string | null },
): Promise<{ id: string }> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("Necesitas iniciar sesión para responder.");

  const { data: com, error } = await supabase
    .from("agora_comentarios")
    .insert({
      hilo_id: data.hilo_id,
      parent_id: data.parent_id || null,
      autor_id: user.user.id,
      cuerpo: data.cuerpo.trim(),
    })
    .select("id")
    .single();

  if (error || !com) throw error || new Error("No se pudo crear el comentario");
  return { id: com.id as string };
}

/**
 * Toggle PEC ("estoy de acuerdo") de un hilo. Si ya existe lo elimina; si no, lo crea.
 * El conteo `pec_count` se mantiene por trigger en la BD (ver migración).
 */
export async function togglePecHilo(
  supabase: SupabaseClient,
  hiloId: string,
): Promise<{ dado: boolean }> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("Necesitas iniciar sesión.");

  // Comprobar si ya existe
  const { data: existente } = await supabase
    .from("agora_pecs_hilo")
    .select("id")
    .eq("hilo_id", hiloId)
    .eq("user_id", user.user.id)
    .maybeSingle();

  if (existente) {
    const { error } = await supabase
      .from("agora_pecs_hilo")
      .delete()
      .eq("id", (existente as { id: string }).id);
    if (error) throw error;
    return { dado: false };
  } else {
    const { error } = await supabase
      .from("agora_pecs_hilo")
      .insert({ hilo_id: hiloId, user_id: user.user.id });
    if (error) throw error;
    return { dado: true };
  }
}

export async function togglePecComentario(
  supabase: SupabaseClient,
  comentarioId: string,
): Promise<{ dado: boolean }> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("Necesitas iniciar sesión.");

  const { data: existente } = await supabase
    .from("agora_pecs_comentario")
    .select("id")
    .eq("comentario_id", comentarioId)
    .eq("user_id", user.user.id)
    .maybeSingle();

  if (existente) {
    const { error } = await supabase
      .from("agora_pecs_comentario")
      .delete()
      .eq("id", (existente as { id: string }).id);
    if (error) throw error;
    return { dado: false };
  } else {
    const { error } = await supabase
      .from("agora_pecs_comentario")
      .insert({ comentario_id: comentarioId, user_id: user.user.id });
    if (error) throw error;
    return { dado: true };
  }
}

/**
 * Para un usuario dado, devuelve el set de hilo_ids y comentario_ids con PEC.
 * Útil para hidratar el estado UI inicial de los botones PEC.
 */
export async function getMisPecs(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ hilos: Set<string>; comentarios: Set<string> }> {
  const [hh, cc] = await Promise.all([
    supabase.from("agora_pecs_hilo").select("hilo_id").eq("user_id", userId),
    supabase.from("agora_pecs_comentario").select("comentario_id").eq("user_id", userId),
  ]);
  return {
    hilos: new Set(((hh.data || []) as { hilo_id: string }[]).map((r) => r.hilo_id)),
    comentarios: new Set(
      ((cc.data || []) as { comentario_id: string }[]).map((r) => r.comentario_id),
    ),
  };
}
