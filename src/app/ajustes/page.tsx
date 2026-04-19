import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TogglePrivacidad } from "./TogglePrivacidad";

export default async function AjustesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/ajustes");

  const { data: perfil } = await supabase
    .from("profiles")
    .select("is_public, handle, display_name")
    .eq("id", user.id)
    .single();

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 pb-40">
      <div className="eyebrow">Preferencias</div>
      <h1
        className="display mt-1 text-[clamp(1.6rem,3.2vw,2rem)]"
        style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
      >
        Ajustes
      </h1>
      <p
        className="mt-3 max-w-2xl"
        style={{ color: "var(--color-piedra)" }}
      >
        Configuración de tu perfil en OCRE. Todo cambio se guarda al momento.
      </p>

      <div className="divisor my-8" />

      <section>
        <h2
          className="display text-[1.1rem] mb-3"
          style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
        >
          Privacidad
        </h2>
        <TogglePrivacidad
          userId={user.id}
          inicial={perfil?.is_public ?? true}
        />
      </section>

      <div className="divisor my-10" />

      <section>
        <h2
          className="display text-[1.1rem] mb-3"
          style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
        >
          Identidad
        </h2>
        <div
          className="rounded-xl p-5"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-linea)",
          }}
        >
          <dl className="text-[0.92rem]" style={{ color: "var(--color-piedra)" }}>
            <div className="flex justify-between py-1">
              <dt className="eyebrow">Correo</dt>
              <dd style={{ color: "var(--color-papiro-ink)" }}>{user.email}</dd>
            </div>
            <div className="flex justify-between py-1">
              <dt className="eyebrow">Handle</dt>
              <dd style={{ color: "var(--color-papiro-ink)" }}>
                @{perfil?.handle ?? "—"}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <p className="mt-10 text-[0.82rem]" style={{ color: "var(--color-piedra-clara)" }}>
        Volver a <Link href="/" className="underline" style={{ color: "var(--color-ocre-deep)" }}>Inicio</Link>.
      </p>
    </div>
  );
}
