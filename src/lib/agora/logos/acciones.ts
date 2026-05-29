"use server";

// ─── Lógos — Server Actions ────────────────────────────────────
// Mutaciones del sub-módulo Lógos: crear post (texto/cita/audio),
// PEC con dos niveles (silencioso/público), comentar, retirar
// (soft-delete con placeholder), pedir transcripción de audio.
//
// Cada acción valida sesión, valida campos según el tipo, y
// devuelve { ok, error?, data? } para que las páginas puedan
// reaccionar sin tirar el árbol.

import { revalidatePath } from "next/cache";

import { CATEGORIAS } from "@/lib/pharos/categorias";
import { SECCIONES } from "@/lib/pharos/secciones";
import { createClient } from "@/lib/supabase/server";

import { normalizarTerritorio } from "../territorio";
import type { LogosPecNivel, LogosPostTipo } from "./tipos";

type Resp<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

function ok<T>(data?: T): Resp<T> {
  return { ok: true, data };
}
function err(msg: string): Resp<never> {
  return { ok: false, error: msg };
}

async function usuarioActual() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}

// ────────────────────────────────────────────────────────────
// Crear post de TEXTO
// ────────────────────────────────────────────────────────────

export async function crearPostTextoAction(
  formData: FormData,
): Promise<Resp<{ id: string }>> {
  const { supabase, user } = await usuarioActual();
  if (!user) return err("Necesitas iniciar sesión para publicar.");

  const cuerpo = String(formData.get("cuerpo") ?? "").trim();
  const seccion = String(formData.get("seccion") ?? "").trim() || null;
  const islaId = String(formData.get("isla") ?? "").trim() || null;
  const municipioId = String(formData.get("municipio") ?? "").trim() || null;
  const barrioId = String(formData.get("barrio") ?? "").trim() || null;

  if (cuerpo.length < 1 || cuerpo.length > 500) {
    return err("El texto debe tener entre 1 y 500 caracteres.");
  }
  if (seccion && !SECCIONES.some((s) => s.id === seccion)) {
    return err("Sección PHAROS desconocida.");
  }

  const territorio = normalizarTerritorio(islaId, municipioId, barrioId);

  const { data, error } = await supabase
    .from("logos_posts")
    .insert({
      autor_id: user.id,
      tipo: "texto" as LogosPostTipo,
      cuerpo,
      seccion_pharos: seccion,
      ...territorio,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "P0001") return err(error.hint ?? error.message);
    console.error("[logos] crearPostTexto", error);
    return err("No se pudo crear el post.");
  }

  revalidatePath("/agora");
  return ok({ id: data.id });
}

// ────────────────────────────────────────────────────────────
// Crear post de CITA
// ────────────────────────────────────────────────────────────

export async function crearPostCitaAction(
  formData: FormData,
): Promise<Resp<{ id: string }>> {
  const { supabase, user } = await usuarioActual();
  if (!user) return err("Necesitas iniciar sesión para publicar.");

  const cuerpo = String(formData.get("cuerpo") ?? "").trim();
  const citaAutor = String(formData.get("cita_autor") ?? "").trim();
  const citaFuente = String(formData.get("cita_fuente") ?? "").trim() || null;
  const seccion = String(formData.get("seccion") ?? "").trim() || null;

  if (cuerpo.length < 1 || cuerpo.length > 280) {
    return err("La cita debe tener entre 1 y 280 caracteres.");
  }
  if (citaAutor.length < 1 || citaAutor.length > 200) {
    return err("El autor de la cita es obligatorio (máx 200 caracteres).");
  }
  if (citaFuente && (citaFuente.length < 1 || citaFuente.length > 300)) {
    return err("La fuente debe tener entre 1 y 300 caracteres.");
  }
  if (seccion && !SECCIONES.some((s) => s.id === seccion)) {
    return err("Sección PHAROS desconocida.");
  }

  const { data, error } = await supabase
    .from("logos_posts")
    .insert({
      autor_id: user.id,
      tipo: "cita" as LogosPostTipo,
      cuerpo,
      cita_autor: citaAutor,
      cita_fuente: citaFuente,
      seccion_pharos: seccion,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "P0001") return err(error.hint ?? error.message);
    console.error("[logos] crearPostCita", error);
    return err("No se pudo crear la cita.");
  }

  revalidatePath("/agora");
  return ok({ id: data.id });
}

// ────────────────────────────────────────────────────────────
// Crear post de AUDIO
// (El audio_url debe haberse subido antes a Supabase Storage por
//  el cliente; esta acción solo registra el post. La transcripción
//  automática vía Whisper se dispara en una edge function aparte.)
// ────────────────────────────────────────────────────────────

export async function crearPostAudioAction(
  formData: FormData,
): Promise<Resp<{ id: string }>> {
  const { supabase, user } = await usuarioActual();
  if (!user) return err("Necesitas iniciar sesión para publicar.");

  const audioUrl = String(formData.get("audio_url") ?? "").trim();
  const duracionStr = String(formData.get("audio_duracion_seg") ?? "").trim();
  const cuerpo = String(formData.get("cuerpo") ?? "").trim() || null;
  const seccion = String(formData.get("seccion") ?? "").trim() || null;

  if (!audioUrl) return err("Falta el archivo de audio.");
  const duracion = parseInt(duracionStr, 10);
  if (Number.isNaN(duracion) || duracion < 1 || duracion > 60) {
    return err("La duración del audio debe ser de 1 a 60 segundos.");
  }
  if (cuerpo && cuerpo.length > 500) {
    return err("La caption no puede exceder 500 caracteres.");
  }

  const { data, error } = await supabase
    .from("logos_posts")
    .insert({
      autor_id: user.id,
      tipo: "audio" as LogosPostTipo,
      cuerpo,
      audio_url: audioUrl,
      audio_duracion_seg: duracion,
      seccion_pharos: seccion,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "P0001") return err(error.hint ?? error.message);
    console.error("[logos] crearPostAudio", error);
    return err("No se pudo crear el audio.");
  }

  // TODO: disparar edge function de transcripción.
  // Por ahora, solo registramos el post; la transcripción se
  // generará cuando se cablee la edge function (tarea aparte).

  revalidatePath("/agora");
  return ok({ id: data.id });
}

// ────────────────────────────────────────────────────────────
// PEC con dos niveles
// ────────────────────────────────────────────────────────────

/**
 * Aplica un PEC al post con el nivel pedido. Si el usuario ya tenía
 * un PEC de otro nivel, lo cambia (UPDATE). Si pulsa el mismo nivel
 * dos veces, lo retira (DELETE).
 *
 * Devuelve el nuevo estado: el nivel actual o null si se ha retirado.
 */
export async function pecPostAction(
  formData: FormData,
): Promise<Resp<{ nivel: LogosPecNivel | null }>> {
  const { supabase, user } = await usuarioActual();
  if (!user) return err("Necesitas iniciar sesión para dar PEC.");

  const postId = String(formData.get("postId") ?? "");
  const nivel = String(formData.get("nivel") ?? "") as LogosPecNivel;

  if (!postId) return err("Post no especificado.");
  if (!["silencioso", "publico"].includes(nivel)) {
    return err("Nivel de PEC inválido.");
  }

  const { data: existente } = await supabase
    .from("logos_pecs")
    .select("id, nivel")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existente) {
    if (existente.nivel === nivel) {
      // Toggle: pulsar el mismo nivel retira el PEC.
      const { error } = await supabase
        .from("logos_pecs")
        .delete()
        .eq("id", existente.id);
      if (error) {
        console.error("[logos] pecPost delete", error);
        return err("No se pudo retirar el PEC.");
      }
      revalidatePath("/agora");
      return ok({ nivel: null });
    }
    // Cambio de nivel: UPDATE.
    const { error } = await supabase
      .from("logos_pecs")
      .update({ nivel })
      .eq("id", existente.id);
    if (error) {
      console.error("[logos] pecPost update", error);
      return err("No se pudo cambiar el nivel del PEC.");
    }
    revalidatePath("/agora");
    return ok({ nivel });
  }

  // Inserción nueva.
  const { error } = await supabase
    .from("logos_pecs")
    .insert({ post_id: postId, user_id: user.id, nivel });
  if (error) {
    console.error("[logos] pecPost insert", error);
    return err("No se pudo dar PEC.");
  }

  revalidatePath("/agora");
  return ok({ nivel });
}

// ────────────────────────────────────────────────────────────
// Comentar (subpost encadenado)
// ────────────────────────────────────────────────────────────

export async function comentarLogosAction(
  formData: FormData,
): Promise<Resp<{ id: string }>> {
  const { supabase, user } = await usuarioActual();
  if (!user) return err("Necesitas iniciar sesión para comentar.");

  const postId = String(formData.get("postId") ?? "");
  const parentId = String(formData.get("parentId") ?? "") || null;
  const cuerpo = String(formData.get("cuerpo") ?? "").trim();

  if (!postId) return err("Post no especificado.");
  if (cuerpo.length < 1 || cuerpo.length > 1000) {
    return err("El comentario debe tener entre 1 y 1000 caracteres.");
  }

  const { data, error } = await supabase
    .from("logos_comentarios")
    .insert({
      post_id: postId,
      parent_id: parentId,
      autor_id: user.id,
      cuerpo,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "P0001") return err(error.hint ?? error.message);
    console.error("[logos] comentarLogos", error);
    return err("No se pudo publicar el comentario.");
  }

  revalidatePath("/agora");
  return ok({ id: data.id });
}

// ────────────────────────────────────────────────────────────
// Soft-delete: retirar post propio
// El post queda con retirado=true; el cliente muestra
// "[post retirado por el autor]". Los comentarios sobreviven.
// ────────────────────────────────────────────────────────────

export async function retirarPostLogosAction(
  formData: FormData,
): Promise<Resp> {
  const { supabase, user } = await usuarioActual();
  if (!user) return err("Necesitas iniciar sesión.");

  const postId = String(formData.get("postId") ?? "");
  if (!postId) return err("Post no especificado.");

  const { error } = await supabase
    .from("logos_posts")
    .update({ retirado: true, retirado_en: new Date().toISOString() })
    .eq("id", postId)
    .eq("autor_id", user.id);

  if (error) {
    console.error("[logos] retirarPostLogos", error);
    return err("No se pudo retirar el post.");
  }

  revalidatePath("/agora");
  return ok();
}

// ────────────────────────────────────────────────────────────
// Soft-delete: retirar comentario propio
// ────────────────────────────────────────────────────────────

export async function retirarComentarioLogosAction(
  formData: FormData,
): Promise<Resp> {
  const { supabase, user } = await usuarioActual();
  if (!user) return err("Necesitas iniciar sesión.");

  const comentarioId = String(formData.get("comentarioId") ?? "");
  if (!comentarioId) return err("Comentario no especificado.");

  const { error } = await supabase
    .from("logos_comentarios")
    .update({ retirado: true, retirado_en: new Date().toISOString() })
    .eq("id", comentarioId)
    .eq("autor_id", user.id);

  if (error) {
    console.error("[logos] retirarComentarioLogos", error);
    return err("No se pudo retirar el comentario.");
  }

  revalidatePath("/agora");
  return ok();
}

// (CATEGORIAS importado para validación futura cuando se añada
//  el campo categoría_local opcional en posts. De momento no se usa
//  para no introducir features no decididas.)
void CATEGORIAS;
