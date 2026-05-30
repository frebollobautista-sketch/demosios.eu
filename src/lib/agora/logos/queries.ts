// ─── Lógos — queries server-side ──────────────────────────────
// Punto único de lectura contra Supabase para el sub-módulo
// Lógos. Llamar desde Server Components y Server Actions.

import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  LogosComentarioArbol,
  LogosComentarioConAutor,
  LogosFiltrosListado,
  LogosPecNivel,
  LogosPecPublicoConAvatar,
  LogosPostConAutor,
  LogosTranscripcion,
} from "./tipos";

// Selección estándar del post + autor (alias del FK a profiles).
const SELECT_POST_CON_AUTOR = `
  id, autor_id, tipo,
  cuerpo, cita_autor, cita_fuente,
  audio_url, audio_duracion_seg,
  seccion_pharos, isla_id, municipio_id, barrio_id,
  es_ai, ai_etiqueta,
  retirado, retirado_en,
  pec_silencioso_count, pec_publico_count, comentario_count,
  creado, actualizado,
  autor:profiles!logos_posts_autor_id_fkey (
    id, handle, display_name, avatar_url
  )
`;

// ────────────────────────────────────────────────────────────
// Listado del feed Lógos (cronológico)
// ────────────────────────────────────────────────────────────

export async function listarPostsLogos(
  filtros: LogosFiltrosListado = {},
): Promise<LogosPostConAutor[]> {
  const supabase = await createClient();
  const limite = Math.max(1, Math.min(filtros.limite ?? 30, 100));
  const desplazamiento = Math.max(0, filtros.desplazamiento ?? 0);
  const orden = filtros.orden ?? "recientes";

  let q = supabase
    .from("logos_posts")
    .select(SELECT_POST_CON_AUTOR)
    .eq("retirado", false);

  if (filtros.tipo) q = q.eq("tipo", filtros.tipo);
  if (filtros.seccion) q = q.eq("seccion_pharos", filtros.seccion);
  if (filtros.isla) q = q.eq("isla_id", filtros.isla);
  if (filtros.municipio) q = q.eq("municipio_id", filtros.municipio);
  if (filtros.barrio) q = q.eq("barrio_id", filtros.barrio);
  if (filtros.autor) q = q.eq("autor_id", filtros.autor);

  if (orden === "actualizados") {
    q = q.order("actualizado", { ascending: false });
  } else {
    q = q.order("creado", { ascending: false });
  }

  q = q.range(desplazamiento, desplazamiento + limite - 1);

  const { data, error } = await q;
  if (error) {
    console.error("[logos] listarPostsLogos", error);
    return [];
  }
  return (data ?? []) as unknown as LogosPostConAutor[];
}

// ────────────────────────────────────────────────────────────
// Obtener un post concreto
// ────────────────────────────────────────────────────────────

export async function obtenerPostLogos(
  postId: string,
): Promise<LogosPostConAutor | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("logos_posts")
    .select(SELECT_POST_CON_AUTOR)
    .eq("id", postId)
    .maybeSingle();
  if (error) {
    console.error("[logos] obtenerPostLogos", error);
    return null;
  }
  return (data as unknown as LogosPostConAutor) ?? null;
}

// ────────────────────────────────────────────────────────────
// Comentarios anidados (árbol)
// ────────────────────────────────────────────────────────────

export async function listarComentariosLogos(
  postId: string,
): Promise<LogosComentarioArbol[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("logos_comentarios")
    .select(
      `
      id, post_id, parent_id, autor_id,
      cuerpo, pec_silencioso_count, pec_publico_count,
      retirado, retirado_en, creado, actualizado,
      autor:profiles!logos_comentarios_autor_id_fkey (
        id, handle, display_name, avatar_url
      )
      `,
    )
    .eq("post_id", postId)
    .order("creado", { ascending: true });

  if (error) {
    console.error("[logos] listarComentariosLogos", error);
    return [];
  }
  return construirArbol(
    (data ?? []) as unknown as LogosComentarioConAutor[],
  );
}

function construirArbol(
  comentarios: LogosComentarioConAutor[],
): LogosComentarioArbol[] {
  const indice = new Map<string, LogosComentarioArbol>();
  const raices: LogosComentarioArbol[] = [];
  for (const c of comentarios) {
    indice.set(c.id, { ...c, hijos: [] });
  }
  for (const c of comentarios) {
    const nodo = indice.get(c.id)!;
    if (c.parent_id && indice.has(c.parent_id)) {
      indice.get(c.parent_id)!.hijos.push(nodo);
    } else {
      raices.push(nodo);
    }
  }
  return raices;
}

// ────────────────────────────────────────────────────────────
// PEC del usuario actual sobre un post
// ────────────────────────────────────────────────────────────

export async function pecDeUsuarioEnPost(
  postId: string,
  userId: string,
): Promise<LogosPecNivel | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("logos_pecs")
    .select("nivel")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[logos] pecDeUsuarioEnPost", error);
    return null;
  }
  return ((data?.nivel as LogosPecNivel) ?? null);
}

/** Devuelve los PECs de un usuario sobre TODOS los posts dados (batch). */
export async function pecsDeUsuarioEnPosts(
  postIds: string[],
  userId: string,
): Promise<Map<string, LogosPecNivel>> {
  if (postIds.length === 0) return new Map();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("logos_pecs")
    .select("post_id, nivel")
    .eq("user_id", userId)
    .in("post_id", postIds);
  if (error) {
    console.error("[logos] pecsDeUsuarioEnPosts", error);
    return new Map();
  }
  const out = new Map<string, LogosPecNivel>();
  for (const fila of (data ?? []) as Array<{
    post_id: string;
    nivel: LogosPecNivel;
  }>) {
    out.set(fila.post_id, fila.nivel);
  }
  return out;
}

// ────────────────────────────────────────────────────────────
// PECs públicos de un post — para mostrar avatares apilados
// ────────────────────────────────────────────────────────────

export async function pecsPublicosDePost(
  postId: string,
  limite = 12,
): Promise<LogosPecPublicoConAvatar[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("logos_pecs")
    .select(
      `
      user_id, creado,
      autor:profiles!logos_pecs_user_id_fkey (
        handle, avatar_url
      )
      `,
    )
    .eq("post_id", postId)
    .eq("nivel", "publico")
    .order("creado", { ascending: false })
    .limit(limite);
  if (error) {
    console.error("[logos] pecsPublicosDePost", error);
    return [];
  }
  return (
    (data ?? []) as unknown as Array<{
      user_id: string;
      creado: string;
      autor: { handle: string; avatar_url: string | null } | null;
    }>
  ).map((r) => ({
    user_id: r.user_id,
    handle: r.autor?.handle ?? "anónimo",
    avatar_url: r.autor?.avatar_url ?? null,
    creado: r.creado,
  }));
}

// ────────────────────────────────────────────────────────────
// Transcripción de un audio
// ────────────────────────────────────────────────────────────

export async function obtenerTranscripcion(
  postId: string,
): Promise<LogosTranscripcion | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("logos_audio_transcripciones")
    .select("*")
    .eq("post_id", postId)
    .maybeSingle();
  if (error) {
    console.error("[logos] obtenerTranscripcion", error);
    return null;
  }
  return (data as LogosTranscripcion) ?? null;
}
