import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPosts } from "@/lib/stoa/queries";
import { fechaRelativa } from "@/lib/agora/utils";
import { AutorLink } from "@/components/AutorLink";
import { Compose } from "./Compose";

export const metadata = {
  title: "STOA",
  description:
    "El patio cívico de OCRE. Lo que pasa hoy en el barrio: posts cortos, sin algoritmo, sin scroll infinito.",
};

/**
 * /stoa — capa social ligera. Feed cronológico inverso de posts.
 *
 * Server Component: pre-fetcha posts en el servidor para que la primera
 * carga tenga contenido. El compose y futuras interacciones (PEC,
 * comentarios) van en Client Components.
 */
export default async function StoaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const posts = await getPosts(supabase, { limit: 30 });

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8 pb-40">
      <div className="eyebrow">Στοά · Demos iOS</div>
      <h1
        className="display mt-1 text-[clamp(1.6rem,3.2vw,2rem)]"
        style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
      >
        STOA
      </h1>
      <p
        className="display italic mt-1 text-[0.95rem]"
        style={{ color: "var(--color-ocre-deep)" }}
      >
        El patio cívico — lo que pasa hoy en el barrio
      </p>

      <div className="divisor my-6" />

      <Compose authed={!!user} />

      {posts.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-linea)",
          }}
        >
          <p
            className="display italic text-[1rem] mb-2"
            style={{ color: "var(--color-papiro-ink)" }}
          >
            La columnata está callada.
          </p>
          <p
            className="text-[0.9rem]"
            style={{ color: "var(--color-piedra)" }}
          >
            Aún no hay posts en STOA. {user ? "Sé el primero." : "Cuando entres con tu cuenta, podrás abrir el patio."}
          </p>
        </div>
      ) : (
        <ol className="space-y-3 list-none p-0 m-0">
          {posts.map((p) => (
            <li
              key={p.id}
              className="rounded-xl p-4"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-linea)",
              }}
            >
              <div className="flex items-baseline justify-between gap-2 mb-2 flex-wrap">
                <AutorLink
                  autor={p.autor}
                  showDisplayName
                  className="text-[0.88rem]"
                />
                <span
                  className="text-[0.75rem] tabular-nums shrink-0"
                  style={{ color: "var(--color-piedra-clara)" }}
                >
                  {fechaRelativa(p.created_at)}
                </span>
              </div>
              <p
                className="text-[0.95rem] whitespace-pre-wrap"
                style={{ color: "var(--color-papiro-ink)", lineHeight: 1.55 }}
              >
                {p.text}
              </p>
              {p.image_url && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={p.image_url}
                  alt=""
                  className="mt-3 rounded-lg w-full h-auto"
                  style={{ maxHeight: 400, objectFit: "cover" }}
                />
              )}
            </li>
          ))}
        </ol>
      )}

      <div className="divisor my-10" />

      {/* Bloque informativo: qué es STOA y qué falta */}
      <section
        className="rounded-xl p-5"
        style={{
          background: "var(--color-papiro-soft)",
          border: "1px solid var(--color-linea)",
          fontSize: "0.85rem",
          color: "var(--color-piedra)",
          lineHeight: 1.55,
        }}
      >
        <p className="mb-3">
          <strong style={{ color: "var(--color-papiro-ink)" }}>
            STOA es el patio cívico de OCRE.
          </strong>{" "}
          Posts cortos ordenados por cuándo se publicaron — sin algoritmo,
          sin scroll infinito, sin contador público de seguidores.
        </p>
        <p className="text-[0.78rem]" style={{ color: "var(--color-piedra-clara)" }}>
          <em>Próximamente:</em> etiqueta territorial por barrio, reacción
          PEC 🤝 y comentarios cortos inline. Para deliberar más despacio
          mejor abre un hilo en{" "}
          <Link
            href="/agora"
            className="underline"
            style={{ color: "var(--color-ocre-deep)" }}
          >
            Ágora
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
