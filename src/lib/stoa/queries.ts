/**
 * Queries de STOA — usa la tabla `posts` del schema inicial.
 *
 * RLS:
 *  · SELECT: público (cualquiera lee).
 *  · INSERT: con sesión, author_id = auth.uid().
 *  · UPDATE/DELETE: propio o admin.
 *
 * Pendiente de iteración 2:
 *  - Filtro territorial (isla/municipio/barrio) cuando Cowork añada
 *    columnas a posts via ALTER TABLE.
 *  - Reacciones PEC (necesita tabla `posts_pecs` o reusar el patrón de
 *    agora_pecs_*).
 *  - Comentarios (la tabla `comments` ya existe en initial_schema).
 *  - Imágenes/audios (Storage bucket `stoa-uploads`).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type Post = {
  id: string;
  author_id: string;
  text: string;
  image_url: string | null;
  video_url: string | null;
  created_at: string;
  updated_at: string;
  autor?: {
    handle: string;
    display_name: string | null;
    avatar_url: string | null;
  };
};

const SELECT_FIELDS = `
  id, author_id, text, image_url, video_url, created_at, updated_at,
  autor:profiles!posts_author_id_fkey(handle, display_name, avatar_url)
`;

/** Feed cronológico inverso. Página de tamaño `limit` con offset. */
export async function getPosts(
  supabase: SupabaseClient,
  opts: { limit?: number; offset?: number } = {},
): Promise<Post[]> {
  const { limit = 30, offset = 0 } = opts;
  const { data, error } = await supabase
    .from("posts")
    .select(SELECT_FIELDS)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.warn("getPosts error:", error);
    return [];
  }
  return (data || []) as unknown as Post[];
}

/** Crea un post. text obligatorio, máx 2000 chars. */
export async function crearPost(
  supabase: SupabaseClient,
  data: { text: string },
): Promise<{ id: string }> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("Necesitas iniciar sesión.");

  const t = data.text.trim();
  if (t.length === 0) throw new Error("El post no puede estar vacío.");
  if (t.length > 2000) throw new Error("Máximo 2000 caracteres.");

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      author_id: user.user.id,
      text: t,
    })
    .select("id")
    .single();

  if (error || !post) throw error || new Error("No se pudo crear el post");
  return { id: (post as { id: string }).id };
}

/** Borrar un post propio (RLS hace la comprobación de autoría). */
export async function eliminarPost(
  supabase: SupabaseClient,
  postId: string,
): Promise<void> {
  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) throw error;
}
