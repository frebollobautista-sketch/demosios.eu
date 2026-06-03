import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { cargarContexto } from "@/lib/avatar/contexto.server";
import { parseReceta, recetaPorDefecto } from "@/lib/avatar/receta";
import { CURSUS } from "@/lib/cursus/grados";
import { AvatarEditor } from "./AvatarEditor";

export const metadata = {
  title: "Tu avatar · OCRE",
  description: "Personaliza tu avatar cívico.",
};

/**
 * /avatar — editor del avatar generativo (DiceBear). Los cosméticos se
 * desbloquean con el cursus/BLaP; el gating se valida también en servidor.
 */
export default async function AvatarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/avatar");

  // Perfil (defensivo: avatar_receta puede no existir aún).
  let recetaJson: unknown = null;
  let handle: string | null = null;
  try {
    const { data } = await supabase
      .from("profiles")
      .select("handle, avatar_receta")
      .eq("id", user.id)
      .maybeSingle();
    const p = data as { handle: string | null; avatar_receta: unknown } | null;
    handle = p?.handle ?? null;
    recetaJson = p?.avatar_receta ?? null;
  } catch {
    // columna sin migrar → receta por defecto
  }

  const seed = handle || user.id;
  const recetaInicial = parseReceta(recetaJson) ?? recetaPorDefecto(seed);

  const ctx = await cargarContexto(supabase, user.id);
  const grado = CURSUS.find((g) => g.nivel === ctx.nivelGrado) ?? CURSUS[0];

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 pb-40">
      <div className="eyebrow">Tu avatar</div>
      <h1
        className="display text-[1.5rem] mt-1 mb-2"
        style={{ color: "var(--color-papiro-ink)" }}
      >
        Personaliza tu avatar
      </h1>
      <p
        className="text-[0.9rem] mb-6"
        style={{ color: "var(--color-piedra)", lineHeight: 1.55 }}
      >
        Eres <strong>{grado.nombre}</strong> ({grado.traduccion}). Según avanzas
        en el cursus y ganas insignias se desbloquean más opciones. Lo que tienes
        bloqueado aparece atenuado con un candado.{" "}
        <Link
          href="/perfil"
          className="underline"
          style={{ color: "var(--color-ocre-deep)" }}
        >
          Ver tu perfil
        </Link>
      </p>

      <AvatarEditor
        recetaInicial={recetaInicial}
        ctx={{
          nivelGrado: ctx.nivelGrado,
          logros: Array.from(ctx.logros),
          insignias: Array.from(ctx.insignias),
        }}
      />
    </div>
  );
}
