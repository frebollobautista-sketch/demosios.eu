"use server";

// ─── Ágora — Server Actions ────────────────────────────────────
// Mutaciones: crear hilo, comentar, PEC, votar, promover modo,
// crear decisión y propuestas. Todas validan sesión y, donde
// corresponde, grado cursus mínimo. Devuelven { ok, error?, data? }
// para que las páginas puedan reaccionar sin tirar el árbol.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { CATEGORIAS } from "@/lib/pharos/categorias";
import { SECCIONES } from "@/lib/pharos/secciones";
import { createClient } from "@/lib/supabase/server";
import { normalizarTerritorio } from "./territorio";
import type { AgoraVotoBinario, AgoraVotoTernario } from "./tipos";

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
// Crear hilo
// ────────────────────────────────────────────────────────────

export async function crearHiloAction(formData: FormData): Promise<Resp<{ id: string; seccion: string }>> {
  const { supabase, user } = await usuarioActual();
  if (!user) return err("Necesitas iniciar sesión para abrir un hilo.");

  const titulo = String(formData.get("titulo") ?? "").trim();
  const cuerpo = String(formData.get("cuerpo") ?? "").trim();
  const seccion = String(formData.get("seccion") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "").trim() || null;
  const islaId = String(formData.get("isla") ?? "").trim() || null;
  const municipioId = String(formData.get("municipio") ?? "").trim() || null;
  const barrioId = String(formData.get("barrio") ?? "").trim() || null;

  if (titulo.length < 6 || titulo.length > 160) {
    return err("El título debe tener entre 6 y 160 caracteres.");
  }
  if (cuerpo.length < 1 || cuerpo.length > 4000) {
    return err("El cuerpo debe tener entre 1 y 4000 caracteres.");
  }
  if (!SECCIONES.some((s) => s.id === seccion)) {
    return err("Sección PHAROS desconocida.");
  }
  if (categoria && !CATEGORIAS.some((c) => c.id === categoria)) {
    return err("Categoría local desconocida.");
  }

  const territorio = normalizarTerritorio(islaId, municipioId, barrioId);

  const { data, error } = await supabase
    .from("agora_hilos")
    .insert({
      autor_id: user.id,
      titulo,
      cuerpo,
      seccion_pharos: seccion,
      categoria_local: categoria,
      ...territorio,
      modo: "debate",
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "P0001") return err(error.hint ?? error.message);
    console.error("[agora] crearHilo", error);
    return err("No se pudo crear el hilo. Intenta de nuevo.");
  }

  revalidatePath(`/agora/${seccion}`);
  revalidatePath("/agora");
  return ok({ id: data.id, seccion });
}

/** Variante que redirige al hilo recién creado. Útil desde un <form action>. */
export async function crearHiloYRedirigir(formData: FormData): Promise<void> {
  const r = await crearHiloAction(formData);
  if (!r.ok) {
    // Si falla, redirigimos a la pantalla de creación con el error en query.
    redirect(`/agora/nuevo?error=${encodeURIComponent(r.error)}`);
  }
  redirect(`/agora/${r.data!.seccion}/${r.data!.id}`);
}

// ────────────────────────────────────────────────────────────
// Comentar
// ────────────────────────────────────────────────────────────

export async function comentarAction(formData: FormData): Promise<Resp<{ id: string }>> {
  const { supabase, user } = await usuarioActual();
  if (!user) return err("Necesitas iniciar sesión para comentar.");

  const hiloId = String(formData.get("hiloId") ?? "");
  const parentId = String(formData.get("parentId") ?? "") || null;
  const cuerpo = String(formData.get("cuerpo") ?? "").trim();
  const seccion = String(formData.get("seccion") ?? "");

  if (!hiloId) return err("Hilo no especificado.");
  if (cuerpo.length < 1 || cuerpo.length > 2000) {
    return err("El comentario debe tener entre 1 y 2000 caracteres.");
  }

  const { data, error } = await supabase
    .from("agora_comentarios")
    .insert({
      hilo_id: hiloId,
      parent_id: parentId,
      autor_id: user.id,
      cuerpo,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "P0001") return err(error.hint ?? error.message);
    console.error("[agora] comentar", error);
    return err("No se pudo publicar el comentario.");
  }

  if (seccion) revalidatePath(`/agora/${seccion}/${hiloId}`);
  return ok({ id: data.id });
}

// ────────────────────────────────────────────────────────────
// PEC: hilo
// ────────────────────────────────────────────────────────────

export async function togglePecHiloAction(formData: FormData): Promise<Resp<{ activo: boolean }>> {
  const { supabase, user } = await usuarioActual();
  if (!user) return err("Necesitas iniciar sesión para dar PEC.");

  const hiloId = String(formData.get("hiloId") ?? "");
  const seccion = String(formData.get("seccion") ?? "");
  if (!hiloId) return err("Hilo no especificado.");

  const { data: existente } = await supabase
    .from("agora_pecs_hilo")
    .select("id")
    .eq("hilo_id", hiloId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existente) {
    const { error } = await supabase
      .from("agora_pecs_hilo")
      .delete()
      .eq("id", existente.id);
    if (error) {
      console.error("[agora] togglePecHilo delete", error);
      return err("No se pudo retirar el PEC.");
    }
    if (seccion) revalidatePath(`/agora/${seccion}/${hiloId}`);
    return ok({ activo: false });
  }

  const { error } = await supabase
    .from("agora_pecs_hilo")
    .insert({ hilo_id: hiloId, user_id: user.id });
  if (error) {
    console.error("[agora] togglePecHilo insert", error);
    return err("No se pudo dar PEC.");
  }
  if (seccion) revalidatePath(`/agora/${seccion}/${hiloId}`);
  return ok({ activo: true });
}

// ────────────────────────────────────────────────────────────
// Votar decisión (Decidim)
// ────────────────────────────────────────────────────────────

export async function votarDecisionAction(formData: FormData): Promise<Resp<{ voto: AgoraVotoBinario }>> {
  const { supabase, user } = await usuarioActual();
  if (!user) return err("Necesitas iniciar sesión para votar.");

  const decisionId = String(formData.get("decisionId") ?? "");
  const voto = String(formData.get("voto") ?? "") as AgoraVotoBinario;
  const hiloId = String(formData.get("hiloId") ?? "");
  const seccion = String(formData.get("seccion") ?? "");

  if (!decisionId) return err("Decisión no especificada.");
  if (!["a_favor", "en_contra", "abstencion"].includes(voto)) {
    return err("Voto inválido.");
  }

  // Comprobar que la decisión sigue abierta.
  const { data: dec } = await supabase
    .from("agora_decisiones")
    .select("fecha_cierre, resultado")
    .eq("id", decisionId)
    .maybeSingle();
  if (!dec) return err("Decisión no encontrada.");
  if (dec.resultado !== null) return err("La decisión ya está cerrada.");
  if (new Date(dec.fecha_cierre as string).getTime() < Date.now()) {
    return err("La decisión ha cerrado.");
  }

  const { error } = await supabase
    .from("agora_votos_decision")
    .upsert(
      { decision_id: decisionId, user_id: user.id, voto },
      { onConflict: "decision_id,user_id" },
    );
  if (error) {
    console.error("[agora] votarDecision", error);
    return err("No se pudo registrar el voto.");
  }

  if (seccion && hiloId) revalidatePath(`/agora/${seccion}/${hiloId}`);
  return ok({ voto });
}

// ────────────────────────────────────────────────────────────
// Polis: crear propuesta + votar
// ────────────────────────────────────────────────────────────

export async function crearPropuestaAction(formData: FormData): Promise<Resp<{ id: string }>> {
  const { supabase, user } = await usuarioActual();
  if (!user) return err("Necesitas iniciar sesión para proponer.");

  const hiloId = String(formData.get("hiloId") ?? "");
  const texto = String(formData.get("texto") ?? "").trim();
  const seccion = String(formData.get("seccion") ?? "");

  if (!hiloId) return err("Hilo no especificado.");
  if (texto.length < 8 || texto.length > 280) {
    return err("La propuesta debe tener entre 8 y 280 caracteres.");
  }

  // Confirmar que el hilo está en modo consenso_polis.
  const { data: hilo } = await supabase
    .from("agora_hilos")
    .select("modo")
    .eq("id", hiloId)
    .maybeSingle();
  if (!hilo) return err("Hilo no encontrado.");
  if (hilo.modo !== "consenso_polis") {
    return err("Este hilo no admite propuestas Polis.");
  }

  const { data, error } = await supabase
    .from("agora_propuestas")
    .insert({ hilo_id: hiloId, autor_id: user.id, texto })
    .select("id")
    .single();
  if (error) {
    console.error("[agora] crearPropuesta", error);
    return err("No se pudo crear la propuesta.");
  }

  if (seccion) revalidatePath(`/agora/${seccion}/${hiloId}`);
  return ok({ id: data.id });
}

export async function votarPropuestaAction(formData: FormData): Promise<Resp<{ voto: AgoraVotoTernario }>> {
  const { supabase, user } = await usuarioActual();
  if (!user) return err("Necesitas iniciar sesión para votar.");

  const propuestaId = String(formData.get("propuestaId") ?? "");
  const voto = String(formData.get("voto") ?? "") as AgoraVotoTernario;
  const hiloId = String(formData.get("hiloId") ?? "");
  const seccion = String(formData.get("seccion") ?? "");

  if (!propuestaId) return err("Propuesta no especificada.");
  if (!["de_acuerdo", "desacuerdo", "pasar"].includes(voto)) {
    return err("Voto inválido.");
  }

  const { error } = await supabase
    .from("agora_votos_propuesta")
    .upsert(
      { propuesta_id: propuestaId, user_id: user.id, voto },
      { onConflict: "propuesta_id,user_id" },
    );
  if (error) {
    console.error("[agora] votarPropuesta", error);
    return err("No se pudo registrar el voto.");
  }

  if (seccion && hiloId) revalidatePath(`/agora/${seccion}/${hiloId}`);
  return ok({ voto });
}

// ────────────────────────────────────────────────────────────
// Promoción de modo
// ────────────────────────────────────────────────────────────

export async function promoverHiloAction(formData: FormData): Promise<Resp<{ modo: string }>> {
  const { supabase, user } = await usuarioActual();
  if (!user) return err("Necesitas iniciar sesión.");

  const hiloId = String(formData.get("hiloId") ?? "");
  const modoNuevo = String(formData.get("modo") ?? "");
  const seccion = String(formData.get("seccion") ?? "");

  if (!hiloId) return err("Hilo no especificado.");
  if (!["propuesta_decidim", "consenso_polis"].includes(modoNuevo)) {
    return err("Modo objetivo inválido.");
  }

  // Sólo el autor del hilo puede promover (para grados superiores ver tarea futura).
  const { data: hilo, error: errH } = await supabase
    .from("agora_hilos")
    .select("autor_id, modo")
    .eq("id", hiloId)
    .maybeSingle();
  if (errH || !hilo) return err("Hilo no encontrado.");
  if (hilo.autor_id !== user.id) {
    return err("Solo el autor o un moderador puede promover el hilo.");
  }
  if (hilo.modo !== "debate") {
    return err("El hilo ya está promovido.");
  }

  // Si se promueve a Decidim, hay que crear la decisión asociada.
  if (modoNuevo === "propuesta_decidim") {
    const texto = String(formData.get("decisionTexto") ?? "").trim();
    const fundamentacion = String(formData.get("decisionFundamentacion") ?? "").trim() || null;
    const dias = Math.max(1, Math.min(parseInt(String(formData.get("decisionDias") ?? "7"), 10) || 7, 60));
    const quorumStr = String(formData.get("decisionQuorum") ?? "").trim();
    const quorum = quorumStr ? Math.max(0, parseInt(quorumStr, 10)) : null;

    if (texto.length < 1 || texto.length > 1000) {
      return err("El texto a votar debe tener entre 1 y 1000 caracteres.");
    }

    const fechaCierre = new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString();
    const { error: errD } = await supabase.from("agora_decisiones").insert({
      hilo_id: hiloId,
      texto,
      fundamentacion,
      fecha_cierre: fechaCierre,
      quorum_minimo: quorum,
    });
    if (errD) {
      console.error("[agora] promover→decisión", errD);
      return err("No se pudo crear la decisión asociada.");
    }
  }

  const { error: errU } = await supabase
    .from("agora_hilos")
    .update({ modo: modoNuevo })
    .eq("id", hiloId);
  if (errU) {
    console.error("[agora] promover→update", errU);
    return err("No se pudo promover el hilo.");
  }

  if (seccion) revalidatePath(`/agora/${seccion}/${hiloId}`);
  return ok({ modo: modoNuevo });
}
