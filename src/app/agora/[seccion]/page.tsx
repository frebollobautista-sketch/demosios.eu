import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getHilosPorSeccion } from "@/lib/agora/queries";
import { getSeccionPorId, fechaRelativa } from "@/lib/agora/utils";
import { AutorLink } from "@/components/AutorLink";

type Params = { seccion: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}) {
  const { seccion } = await params;
  const s = getSeccionPorId(seccion);
  if (!s) return { title: "Sección no encontrada" };
  return {
    title: `${s.nombre} · Ágora`,
    description: s.descripcion,
  };
}

/**
 * /agora/[seccion] — listado de hilos abiertos de una sección PHAROS.
 */
export default async function SeccionAgoraPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { seccion } = await params;
  const s = getSeccionPorId(seccion);
  if (!s) notFound();

  const supabase = await createClient();
  const hilos = await getHilosPorSeccion(supabase, seccion).catch(() => []);

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 pb-40">
      <Link
        href="/agora"
        className="text-[0.85rem] inline-block mb-3"
        style={{ color: "var(--color-piedra-clara)" }}
      >
        ← Volver a Ágora
      </Link>

      <div
        className="rounded-xl p-5 mb-6"
        style={{
          background: s.color,
          border: "1px solid var(--color-linea)",
        }}
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl shrink-0" aria-hidden>
            {s.icono}
          </span>
          <div className="flex-1 min-w-0">
            <div
              className="display text-[1.15rem]"
              style={{ color: s.colorTexto, fontWeight: 600 }}
            >
              {s.nombre}
            </div>
            <p
              className="mt-1 text-[0.9rem]"
              style={{ color: "var(--color-papiro-ink)" }}
            >
              {s.descripcion}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <span
          className="eyebrow"
          style={{ color: "var(--color-piedra-clara)" }}
        >
          {hilos.length === 0
            ? "Sin hilos todavía"
            : hilos.length === 1
              ? "1 hilo"
              : `${hilos.length} hilos`}
        </span>
        <Link
          href={`/agora/nuevo?seccion=${encodeURIComponent(seccion)}`}
          className="px-4 py-2 rounded-md text-[0.85rem] font-semibold"
          style={{
            background: "var(--color-ocre-deep)",
            color: "var(--color-surface)",
          }}
        >
          Iniciar hilo en esta sección
        </Link>
      </div>

      {hilos.length === 0 ? (
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
            Aún no se ha abierto ningún hilo aquí.
          </p>
          <p
            className="text-[0.9rem]"
            style={{ color: "var(--color-piedra)" }}
          >
            Si tienes algo que decir sobre {s.nombre.toLowerCase()},{" "}
            <Link
              href={`/agora/nuevo?seccion=${encodeURIComponent(seccion)}`}
              className="underline"
              style={{ color: "var(--color-ocre-deep)" }}
            >
              empieza tú
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {hilos.map((h) => (
            <li key={h.id}>
              <Link
                href={`/agora/hilo/${h.id}`}
                className="block rounded-lg p-4 transition-colors hover:opacity-95"
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-linea)",
                }}
              >
                <div className="flex items-start gap-3">
                  {h.fijado && (
                    <span
                      className="text-[0.7rem] uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 mt-0.5"
                      style={{
                        background: "var(--color-papiro-soft)",
                        color: "var(--color-piedra)",
                      }}
                    >
                      Fijado
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <h2
                      className="display text-[1.05rem] mb-1"
                      style={{
                        color: "var(--color-papiro-ink)",
                        fontWeight: 600,
                      }}
                    >
                      {h.titulo}
                    </h2>
                    <p
                      className="text-[0.88rem] line-clamp-2"
                      style={{
                        color: "var(--color-piedra)",
                        lineHeight: 1.5,
                      }}
                    >
                      {h.cuerpo}
                    </p>
                    <div
                      className="mt-3 flex items-center flex-wrap gap-x-3 gap-y-1 text-[0.78rem]"
                      style={{ color: "var(--color-piedra-clara)" }}
                    >
                      <span>
                        <AutorLink autor={h.autor} className="text-[0.78rem]" />
                        {" · "}
                        {fechaRelativa(h.creado)}
                      </span>
                      {h.comentario_count > 0 && (
                        <span>💬 {h.comentario_count}</span>
                      )}
                      {h.pec_count > 0 && <span>🤝 {h.pec_count}</span>}
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
