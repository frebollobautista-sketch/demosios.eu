import Link from "next/link";
import { SECCIONES } from "@/lib/pharos/secciones";
import { createClient } from "@/lib/supabase/server";
import { getCountHilosPorSeccion } from "@/lib/agora/queries";

export const metadata = {
  title: "Ágora",
  description:
    "Plaza de deliberación cívica de OCRE. Hilos abiertos por las 8 secciones temáticas heredadas de PHAROS.",
};

/**
 * /agora — listado de las 8 secciones PHAROS con contador de hilos
 * abiertos en cada una. Cada tarjeta linka a /agora/[seccion].
 *
 * Server Component: lee los conteos de Supabase en el servidor para
 * que la primera carga ya muestre los números (mejor SEO + perceived
 * performance).
 */
export default async function AgoraPage() {
  const supabase = await createClient();
  const counts = await getCountHilosPorSeccion(supabase).catch(
    () => ({}) as Record<string, number>,
  );
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 pb-40">
      <div className="eyebrow">Ἀγορά</div>
      <h1
        className="display mt-1 text-[clamp(1.6rem,3.5vw,2.2rem)]"
        style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
      >
        Ágora
      </h1>
      <p
        className="mt-3 max-w-2xl"
        style={{ color: "var(--color-piedra)" }}
      >
        Plaza de deliberación. Los hilos se organizan por las 8 secciones
        temáticas heredadas de PHAROS. Pulsa una sección para ver los hilos
        abiertos o iniciar uno nuevo.
      </p>

      <div className="my-6 flex flex-wrap items-center gap-3 text-[0.85rem]">
        <Link
          href="/agora/nuevo"
          className="px-4 py-2 rounded-md font-semibold"
          style={{
            background: "var(--color-ocre-deep)",
            color: "var(--color-surface)",
          }}
        >
          Iniciar hilo
        </Link>
        <span style={{ color: "var(--color-piedra-clara)" }}>
          {total === 0
            ? "Aún no hay hilos abiertos."
            : `${total} hilos abiertos en total`}
        </span>
      </div>

      <div className="divisor my-8" />

      <ul className="grid md:grid-cols-2 gap-3">
        {SECCIONES.map((s) => {
          const n = counts[s.id] || 0;
          return (
            <li key={s.id}>
              <Link
                href={`/agora/${s.id}`}
                className="block rounded-xl p-5 transition-colors hover:opacity-90"
                style={{
                  background: s.color,
                  border: "1px solid var(--color-linea)",
                }}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl shrink-0" aria-hidden>
                    {s.icono}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div
                      className="display text-[1.02rem]"
                      style={{ color: s.colorTexto, fontWeight: 600 }}
                    >
                      {s.nombre}
                    </div>
                    <p
                      className="text-[0.88rem] mt-1"
                      style={{ color: "var(--color-papiro-ink)" }}
                    >
                      {s.descripcion}
                    </p>
                    <div
                      className="eyebrow mt-3"
                      style={{ color: "var(--color-piedra-clara)" }}
                    >
                      {n === 0
                        ? "0 hilos · sé el primero"
                        : n === 1
                          ? "1 hilo abierto"
                          : `${n} hilos abiertos`}
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
