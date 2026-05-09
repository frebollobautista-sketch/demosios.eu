import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getConversacion, getMensajes } from "@/lib/mensajes/queries";
import { fechaRelativa, nombreAutor } from "@/lib/agora/utils";
import { MensajeForm } from "./MensajeForm";
import { MarcarLeidoOnLoad } from "./MarcarLeidoOnLoad";

type Params = { id: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  return {
    title: `Conversación · Mensajes`,
    description: `Detalle de conversación ${id}`,
  };
}

/**
 * /mensajes/[id] — chat individual.
 * RLS garantiza que solo participantes lleguen aquí: si la conversación
 * no es accesible, getConversacion devuelve null → 404.
 */
export default async function ConversacionPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/mensajes/${id}`);

  const conversacion = await getConversacion(supabase, id, user.id);
  if (!conversacion) notFound();

  const mensajes = await getMensajes(supabase, id);

  const titulo =
    conversacion.tipo === "grupo"
      ? conversacion.nombre || "Grupo sin nombre"
      : conversacion.otro
        ? `@${conversacion.otro.handle}` +
          (conversacion.otro.display_name
            ? ` · ${conversacion.otro.display_name}`
            : "")
        : "Conversación";

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 pb-40">
      <MarcarLeidoOnLoad conversacionId={id} />

      <Link
        href="/mensajes"
        className="text-[0.85rem] inline-block mb-3"
        style={{ color: "var(--color-piedra-clara)" }}
      >
        ← Todos los mensajes
      </Link>

      <header
        className="rounded-lg p-4 mb-5"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-linea)",
        }}
      >
        <h1
          className="display text-[1.15rem]"
          style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
        >
          {titulo}
        </h1>
        {conversacion.tipo === "directa" && conversacion.otro && (
          <p
            className="text-[0.82rem] mt-0.5"
            style={{ color: "var(--color-piedra-clara)" }}
          >
            Conversación privada — solo tú y {nombreAutor(conversacion.otro)}{" "}
            podéis ver los mensajes.
          </p>
        )}
      </header>

      {/* Mensajes */}
      <ol
        className="space-y-3 mb-6 list-none p-0"
        aria-label="Mensajes"
      >
        {mensajes.length === 0 && (
          <li
            className="text-center text-[0.9rem] py-8"
            style={{ color: "var(--color-piedra-clara)" }}
          >
            Aún no hay mensajes. Escribe el primero abajo.
          </li>
        )}
        {mensajes.map((m) => {
          const esMio = m.autor_id === user.id;
          return (
            <li
              key={m.id}
              className="flex gap-2"
              style={{ flexDirection: esMio ? "row-reverse" : "row" }}
            >
              <div
                className="rounded-2xl px-4 py-2.5 max-w-[80%]"
                style={{
                  background: esMio
                    ? "var(--color-ocre-deep)"
                    : "var(--color-surface)",
                  color: esMio
                    ? "var(--color-surface)"
                    : "var(--color-papiro-ink)",
                  border: esMio
                    ? "none"
                    : "1px solid var(--color-linea)",
                }}
              >
                {!esMio && (
                  <div
                    className="text-[0.72rem] mb-0.5"
                    style={{ color: "var(--color-ocre-deep)", fontWeight: 600 }}
                  >
                    @{m.autor?.handle ?? "—"}
                  </div>
                )}
                <p
                  className="text-[0.95rem] whitespace-pre-wrap"
                  style={{ lineHeight: 1.5 }}
                >
                  {m.cuerpo}
                </p>
                <div
                  className="text-[0.7rem] mt-1 tabular-nums"
                  style={{
                    color: esMio
                      ? "rgba(255,255,255,0.65)"
                      : "var(--color-piedra-clara)",
                  }}
                >
                  {fechaRelativa(m.creado)}
                  {m.editado && " · editado"}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Input */}
      <div
        className="rounded-xl p-4 sticky bottom-3"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-linea)",
        }}
      >
        <MensajeForm conversacionId={id} />
      </div>
    </div>
  );
}
