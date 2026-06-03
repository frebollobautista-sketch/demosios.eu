"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { cargarContexto } from "@/lib/avatar/contexto.server";
import { validarRecetaContra } from "@/lib/avatar/catalogo";
import { AVATAR_RECETA_VERSION, type AvatarReceta } from "@/lib/avatar/receta";

export type GuardarResultado = {
  ok: boolean;
  error?: "no-session" | "bloqueado" | "sin-columna" | "error";
};

/**
 * Guarda la receta del avatar en profiles.avatar_receta, validando en servidor
 * que todos los cosméticos elegidos estén desbloqueados para el usuario.
 */
export async function guardarAvatarReceta(
  receta: AvatarReceta,
): Promise<GuardarResultado> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "no-session" };

  const ctx = await cargarContexto(supabase, user.id);
  const invalidos = validarRecetaContra(receta.opciones, ctx);
  if (invalidos.length > 0) return { ok: false, error: "bloqueado" };

  // Normalizamos para no guardar campos extraños.
  const limpia: AvatarReceta = {
    v: AVATAR_RECETA_VERSION,
    estilo: "avataaars",
    seed: receta.seed,
    opciones: receta.opciones,
  };

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_receta: limpia })
    .eq("id", user.id);

  if (error) {
    if (/avatar_receta|column|does not exist/i.test(error.message || "")) {
      return { ok: false, error: "sin-columna" };
    }
    return { ok: false, error: "error" };
  }

  revalidatePath("/perfil");
  revalidatePath("/avatar");
  return { ok: true };
}
