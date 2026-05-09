import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HiloForm } from "./HiloForm";

export const metadata = {
  title: "Iniciar hilo · Ágora",
  description: "Abre un hilo de deliberación en Ágora.",
};

/**
 * /agora/nuevo — abre un hilo nuevo.
 *
 * Server Component que comprueba sesión. Si no hay sesión, redirige
 * a /login con redirect=back para volver tras autenticar.
 */
export default async function NuevoHiloPage({
  searchParams,
}: {
  searchParams: Promise<{ seccion?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { seccion } = await searchParams;

  if (!user) {
    redirect(
      `/login?redirect=${encodeURIComponent(
        seccion ? `/agora/nuevo?seccion=${seccion}` : "/agora/nuevo",
      )}`,
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 pb-40">
      <Link
        href="/agora"
        className="text-[0.85rem] inline-block mb-3"
        style={{ color: "var(--color-piedra-clara)" }}
      >
        ← Volver a Ágora
      </Link>

      <div className="eyebrow">Ἀγορά · Iniciar hilo</div>
      <h1
        className="display mt-1 text-[clamp(1.6rem,3.5vw,2.2rem)]"
        style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
      >
        Abre un hilo
      </h1>
      <p
        className="mt-3 max-w-2xl"
        style={{ color: "var(--color-piedra)" }}
      >
        Un hilo de Ágora es una pregunta concreta o una afirmación que
        invita al debate. La gente responde, da PEC <em>(estoy de acuerdo)</em>,
        y el hilo crece o queda como registro consultable.
      </p>

      <div className="divisor my-8" />

      <HiloForm seccionInicial={seccion} />
    </div>
  );
}
