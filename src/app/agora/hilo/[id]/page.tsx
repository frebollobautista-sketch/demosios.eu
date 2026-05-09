import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getHiloConComentarios, getMisPecs } from "@/lib/agora/queries";
import { getSeccionPorId, fechaRelativa, nombreAutor } from "@/lib/agora/utils";
import { PECButton } from "./PECButton";
import { RespuestaForm } from "./RespuestaForm";

type Params = { id: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { hilo } = await getHiloConComentarios(supabase, id);
  if (!hilo) return { title: "Hilo no encontrado" };
  return {
    title: `${hilo.titulo} · Ágora`,
    description: hilo.cuerpo.slice(0, 160),
  };
}

/**
 * /agora/hilo/[id] — detalle de un hilo + sus comentarios.
 * En v1 los comentarios se muestran en lista plana ordenada por fecha.
 * En v2 se añadirá árbol con parent_id (respuestas a respuestas).
 */
export default async function HiloDetallePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ hilo, comentarios }, sessionRes] = await Promise.all([
    getHiloConComentarios(supabase, id),
    supabase.auth.getUser(),
  ]);
  if (!hilo) notFound();

  const user = sessionRes.data.user;
  const misPecs = user
    ? await getMisPecs(supabase, user.id).catch(() => ({
        hilos: new Set<string>(),
        comentarios: new Set<string>(),
      }))
    : { hilos: new Set<string>(), comentarios: new Set<string>() };

  const seccion = getSeccionPorId(hilo.seccion_pharos);

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 pb-40">
      <Link
        href={seccion ? `/agora/${seccion.id}` : "/agora"}
        className="text-[0.85rem] inline-block mb-3"
        style={{ color: "var(--color-piedra-clara)" }}
      >
        ← {seccion ? seccion.nombre : "Volver a Ágora"}
      </Link>

      {/* Hilo principal */}
      <article
        className="rounded-xl p-5 sm:p-6 mb-6"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-linea)",
        }}
      >
        {seccion && (
          <div
            className="eyebrow mb-2"
            style={{ color: seccion.colorTexto }}
          >
            {seccion.icono} {seccion.nombre}
          </div>
        )}

        <h1
          className="display text-[1.4rem] sm:text-[1.6rem] mb-3"
          style={{ color: "var(--color-papiro-ink)", fontWeight: 600, lineHeight: 1.2 }}
        >
          {hilo.titulo}
        </h1>

        <div
          className="text-[0.85rem] mb-4"
          style={{ color: "var(--color-piedra-clara)" }}
        >
          @{nombreAutor(hilo.autor)} · {fechaRelativa(hilo.creado)}
        </div>

        <div
          className="text-[1rem] whitespace-pre-wrap"
          style={{ color: "var(--color-papiro-ink)", lineHeight: 1.65 }}
        >
          {hilo.cuerpo}
        </div>

        <div className="mt-5 flex items-center gap-2">
          <PECButton
            tipo="hilo"
            id={hilo.id}
            countInicial={hilo.pec_count}
            dadoInicial={misPecs.hilos.has(hilo.id)}
            authed={!!user}
          />
          <span
            className="text-[0.85rem]"
            style={{ color: "var(--color-piedra-clara)" }}
          >
            {hilo.comentario_count === 0
              ? "Aún sin respuestas"
              : hilo.comentario_count === 1
                ? "1 respuesta"
                : `${hilo.comentario_count} respuestas`}
          </span>
        </div>
      </article>

      {/* Comentarios */}
      {comentarios.length > 0 && (
        <ol className="space-y-3 mb-8 list-none p-0">
          {comentarios.map((c) => (
            <li
              key={c.id}
              className="rounded-lg p-4"
              style={{
                background: "var(--color-papiro-soft)",
                border: "1px solid var(--color-linea)",
              }}
            >
              <div
                className="text-[0.82rem] mb-2"
                style={{ color: "var(--color-piedra-clara)" }}
              >
                @{nombreAutor(c.autor)} · {fechaRelativa(c.creado)}
              </div>
              <div
                className="text-[0.95rem] whitespace-pre-wrap mb-3"
                style={{ color: "var(--color-papiro-ink)", lineHeight: 1.6 }}
              >
                {c.cuerpo}
              </div>
              <PECButton
                tipo="comentario"
                id={c.id}
                countInicial={c.pec_count}
                dadoInicial={misPecs.comentarios.has(c.id)}
                authed={!!user}
              />
            </li>
          ))}
        </ol>
      )}

      {/* Form de respuesta */}
      <div
        className="rounded-xl p-5"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-linea)",
        }}
      >
        <RespuestaForm hiloId={hilo.id} authed={!!user} />
      </div>
    </div>
  );
}
