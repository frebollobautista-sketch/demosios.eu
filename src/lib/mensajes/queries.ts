/**
 * Queries de mensajería — usa las 4 tablas de la migración 20260509:
 * conversaciones, conversacion_participantes, mensajes, mensaje_lecturas.
 *
 * RLS asume:
 *  · SELECT: solo participantes (o admin).
 *  · INSERT mensajes: solo participante con autor_id = auth.uid().
 *  · INSERT participantes: solo si ya eres participante o tú mismo
 *    (creando uno nuevo en una conversación nueva).
 *  · INSERT/UPDATE lecturas: solo el propio usuario.
 *  · Rate limit (trigger): 60 mensajes/hora por autor.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type ConversacionTipo = "directa" | "grupo";

export type Conversacion = {
  id: string;
  tipo: ConversacionTipo;
  nombre: string | null;
  creado_por: string | null;
  ultimo_mensaje_at: string;
  created_at: string;
};

export type Mensaje = {
  id: string;
  conversacion_id: string;
  autor_id: string;
  cuerpo: string;
  editado: boolean;
  creado: string;
  actualizado: string;
  autor?: { handle: string; display_name: string | null; avatar_url: string | null };
};

export type ConversacionConContexto = Conversacion & {
  /** Para tipo='directa': el otro participante. Para grupos: null. */
  otro?: { id: string; handle: string; display_name: string | null; avatar_url: string | null };
  /** Último mensaje (preview). Puede ser null si la conversación se creó sin mensajes. */
  ultimo_mensaje?: { cuerpo: string; autor_id: string; creado: string } | null;
  /** Hay mensajes nuevos para mí desde mi última lectura. */
  no_leidos: boolean;
};

/* ─────────── LECTURAS ─────────── */

export async function getMisConversaciones(
  supabase: SupabaseClient,
  userId: string,
): Promise<ConversacionConContexto[]> {
  // 1) IDs de conversaciones donde participo
  const { data: parts, error: errParts } = await supabase
    .from("conversacion_participantes")
    .select("conversacion_id")
    .eq("user_id", userId);

  if (errParts) {
    console.warn("getMisConversaciones parts:", errParts);
    return [];
  }
  const ids = (parts || []).map(
    (r) => (r as { conversacion_id: string }).conversacion_id,
  );
  if (ids.length === 0) return [];

  // 2) Las conversaciones, ordenadas por ultimo_mensaje_at desc
  const { data: convs, error: errConvs } = await supabase
    .from("conversaciones")
    .select("*")
    .in("id", ids)
    .order("ultimo_mensaje_at", { ascending: false });

  if (errConvs || !convs) return [];

  // 3) Para cada conversación: otro participante (si directa), último mensaje y last-read
  // Lo hacemos paralelizado con Promise.all. Para una primera versión
  // aceptamos N queries; cuando crezca pasamos a una RPC SQL.
  const promesas = (convs as Conversacion[]).map(async (c) => {
    const [otrosRes, ultRes, lecRes] = await Promise.all([
      supabase
        .from("conversacion_participantes")
        .select(
          `user_id, autor:profiles!conversacion_participantes_user_id_fkey(handle, display_name, avatar_url)`,
        )
        .eq("conversacion_id", c.id)
        .neq("user_id", userId),
      supabase
        .from("mensajes")
        .select("cuerpo, autor_id, creado")
        .eq("conversacion_id", c.id)
        .order("creado", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("mensaje_lecturas")
        .select("ultimo_leido_at")
        .eq("conversacion_id", c.id)
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const otros = (otrosRes.data || []) as unknown as Array<{
      user_id: string;
      autor: { handle: string; display_name: string | null; avatar_url: string | null };
    }>;
    const otro =
      c.tipo === "directa" && otros[0]
        ? {
            id: otros[0].user_id,
            handle: otros[0].autor?.handle ?? "—",
            display_name: otros[0].autor?.display_name ?? null,
            avatar_url: otros[0].autor?.avatar_url ?? null,
          }
        : undefined;

    const ultimo = (ultRes.data as { cuerpo: string; autor_id: string; creado: string } | null) ?? null;
    const ultimoLeidoAt = (lecRes.data as { ultimo_leido_at: string } | null)?.ultimo_leido_at;

    const noLeidos =
      !!ultimo &&
      ultimo.autor_id !== userId &&
      (!ultimoLeidoAt || new Date(ultimo.creado) > new Date(ultimoLeidoAt));

    return {
      ...c,
      otro,
      ultimo_mensaje: ultimo,
      no_leidos: noLeidos,
    } as ConversacionConContexto;
  });

  return Promise.all(promesas);
}

/**
 * Total de conversaciones del user con mensajes no leídos.
 * Útil para el badge del icono buzón en el header.
 */
export async function getNoLeidosCount(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const conv = await getMisConversaciones(supabase, userId);
  return conv.filter((c) => c.no_leidos).length;
}

/**
 * Obtiene mensajes de una conversación. Devuelve los más recientes
 * primero por defecto (orden cronológico ascendente cuando se renderiza).
 */
export async function getMensajes(
  supabase: SupabaseClient,
  conversacionId: string,
  opts: { limit?: number } = {},
): Promise<Mensaje[]> {
  const { limit = 100 } = opts;
  const { data, error } = await supabase
    .from("mensajes")
    .select(
      `id, conversacion_id, autor_id, cuerpo, editado, creado, actualizado,
       autor:profiles!mensajes_autor_id_fkey(handle, display_name, avatar_url)`,
    )
    .eq("conversacion_id", conversacionId)
    .order("creado", { ascending: true })
    .limit(limit);

  if (error) {
    console.warn("getMensajes error:", error);
    return [];
  }
  return (data || []) as unknown as Mensaje[];
}

export async function getConversacion(
  supabase: SupabaseClient,
  conversacionId: string,
  userId: string,
): Promise<ConversacionConContexto | null> {
  const [convRes, partsRes] = await Promise.all([
    supabase
      .from("conversaciones")
      .select("*")
      .eq("id", conversacionId)
      .single(),
    supabase
      .from("conversacion_participantes")
      .select(
        `user_id, autor:profiles!conversacion_participantes_user_id_fkey(handle, display_name, avatar_url)`,
      )
      .eq("conversacion_id", conversacionId),
  ]);

  if (convRes.error || !convRes.data) return null;
  const c = convRes.data as Conversacion;
  const otros = ((partsRes.data || []) as unknown as Array<{
    user_id: string;
    autor: { handle: string; display_name: string | null; avatar_url: string | null };
  }>).filter((p) => p.user_id !== userId);
  const otro = otros[0]
    ? {
        id: otros[0].user_id,
        handle: otros[0].autor?.handle ?? "—",
        display_name: otros[0].autor?.display_name ?? null,
        avatar_url: otros[0].autor?.avatar_url ?? null,
      }
    : undefined;
  return { ...c, otro, no_leidos: false };
}

/* ─────────── ESCRITURAS ─────────── */

/**
 * Busca o crea una conversación 1-a-1 entre el usuario actual y otro.
 * Si ya existe una directa con ambos, la devuelve. Si no, crea una nueva.
 *
 * IMPORTANTE: hay una pequeña race condition si dos clientes crean a la vez,
 * podrían crear duplicados. Para una v1 aceptamos el riesgo.
 */
export async function getOCrearConversacionDirecta(
  supabase: SupabaseClient,
  otherUserId: string,
): Promise<{ id: string; nueva: boolean }> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("Necesitas iniciar sesión.");
  if (user.user.id === otherUserId) {
    throw new Error("No puedes iniciar una conversación contigo mismo.");
  }

  // Buscar conversación directa donde ambos sean participantes.
  // Truco: traemos las conversaciones del usuario y filtramos en JS.
  const { data: misIdsRows } = await supabase
    .from("conversacion_participantes")
    .select("conversacion_id")
    .eq("user_id", user.user.id);
  const misIds = (misIdsRows || []).map((r) => (r as { conversacion_id: string }).conversacion_id);

  if (misIds.length > 0) {
    const { data: ambos } = await supabase
      .from("conversacion_participantes")
      .select("conversacion_id")
      .eq("user_id", otherUserId)
      .in("conversacion_id", misIds);

    const compartidas = (ambos || []).map(
      (r) => (r as { conversacion_id: string }).conversacion_id,
    );
    if (compartidas.length > 0) {
      // Filtrar solo las directas
      const { data: directas } = await supabase
        .from("conversaciones")
        .select("id, tipo")
        .in("id", compartidas)
        .eq("tipo", "directa")
        .limit(1);
      const dir = (directas || [])[0] as { id: string } | undefined;
      if (dir) return { id: dir.id, nueva: false };
    }
  }

  // Crear conversación nueva
  const { data: convNueva, error: errConv } = await supabase
    .from("conversaciones")
    .insert({ tipo: "directa", creado_por: user.user.id })
    .select("id")
    .single();
  if (errConv || !convNueva) throw errConv || new Error("No se pudo crear");
  const convId = (convNueva as { id: string }).id;

  // Insertar a ambos participantes (yo primero, luego el otro)
  const { error: errPart1 } = await supabase
    .from("conversacion_participantes")
    .insert({ conversacion_id: convId, user_id: user.user.id });
  if (errPart1) throw errPart1;

  const { error: errPart2 } = await supabase
    .from("conversacion_participantes")
    .insert({ conversacion_id: convId, user_id: otherUserId });
  if (errPart2) throw errPart2;

  return { id: convId, nueva: true };
}

export async function enviarMensaje(
  supabase: SupabaseClient,
  conversacionId: string,
  cuerpo: string,
): Promise<{ id: string }> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("Necesitas iniciar sesión.");

  const t = cuerpo.trim();
  if (t.length < 1 || t.length > 2000) {
    throw new Error("Mensaje vacío o demasiado largo (máx. 2000 caracteres).");
  }

  const { data: msg, error } = await supabase
    .from("mensajes")
    .insert({
      conversacion_id: conversacionId,
      autor_id: user.user.id,
      cuerpo: t,
    })
    .select("id")
    .single();

  if (error) {
    // Rate limit: el trigger lanza P0001 cuando se exceden 60/hora
    if (error.code === "P0001") {
      throw new Error(
        "Has enviado demasiados mensajes en la última hora. Respira.",
      );
    }
    throw error;
  }
  return { id: (msg as { id: string }).id };
}

/**
 * Upsert de la marca de lectura. Llamar tras renderizar la conversación.
 */
export async function marcarLeido(
  supabase: SupabaseClient,
  conversacionId: string,
): Promise<void> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return;

  // Comprobar si ya existe la fila
  const { data: existente } = await supabase
    .from("mensaje_lecturas")
    .select("id")
    .eq("conversacion_id", conversacionId)
    .eq("user_id", user.user.id)
    .maybeSingle();

  if (existente) {
    await supabase
      .from("mensaje_lecturas")
      .update({ ultimo_leido_at: new Date().toISOString() })
      .eq("id", (existente as { id: string }).id);
  } else {
    await supabase
      .from("mensaje_lecturas")
      .insert({
        conversacion_id: conversacionId,
        user_id: user.user.id,
      });
  }
}

/**
 * Busca usuarios por handle o display_name. Útil para iniciar conversación.
 * RLS de profiles aplica: si is_public=false el usuario no aparece a anon.
 */
export async function buscarUsuarios(
  supabase: SupabaseClient,
  query: string,
  excluirId?: string,
): Promise<Array<{ id: string; handle: string; display_name: string | null; avatar_url: string | null }>> {
  const q = query.trim();
  if (q.length < 2) return [];

  let req = supabase
    .from("profiles")
    .select("id, handle, display_name, avatar_url")
    .or(`handle.ilike.%${q}%,display_name.ilike.%${q}%`)
    .limit(10);
  if (excluirId) req = req.neq("id", excluirId);

  const { data, error } = await req;
  if (error) {
    console.warn("buscarUsuarios error:", error);
    return [];
  }
  return (data || []) as Array<{
    id: string;
    handle: string;
    display_name: string | null;
    avatar_url: string | null;
  }>;
}
