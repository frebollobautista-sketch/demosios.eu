import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BuscadorUsuarios } from "./BuscadorUsuarios";

export const metadata = {
  title: "Nueva conversación · Mensajes",
  description: "Empieza una conversación privada con otro miembro de OCRE.",
};

export default async function NuevaConversacionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/mensajes/nuevo");

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8 pb-40">
      <Link
        href="/mensajes"
        className="text-[0.85rem] inline-block mb-3"
        style={{ color: "var(--color-piedra-clara)" }}
      >
        ← Mensajes
      </Link>

      <div className="eyebrow">Buzón · Nueva conversación</div>
      <h1
        className="display mt-1 text-[clamp(1.5rem,3vw,1.9rem)]"
        style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
      >
        ¿Con quién hablas?
      </h1>
      <p
        className="mt-3 mb-6 text-[0.95rem]"
        style={{ color: "var(--color-piedra)", lineHeight: 1.55 }}
      >
        Busca a otro miembro de OCRE por su handle o nombre. Si pulsas su
        nombre, abriremos una conversación 1-a-1 con esa persona (o
        recuperaremos la que ya tenías).
      </p>

      <BuscadorUsuarios miId={user.id} />

      <p
        className="mt-10 text-[0.78rem]"
        style={{ color: "var(--color-piedra-clara)" }}
      >
        Si la persona ha desactivado <em>«Permitir mensajes de cualquier usuario»</em>{" "}
        en sus ajustes y todavía no te sigue, no podrás escribirle. (Esa
        restricción la aplicaremos en una futura iteración — por ahora la BD
        permite escribir a cualquier usuario público.)
      </p>
    </div>
  );
}
