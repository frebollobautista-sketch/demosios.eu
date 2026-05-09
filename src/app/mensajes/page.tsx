import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMisConversaciones } from "@/lib/mensajes/queries";
import { fechaRelativa } from "@/lib/agora/utils";

export const metadata = {
  title: "Mensajes",
  description: "Tus conversaciones privadas en OCRE.",
};

/**
 * /mensajes — lista de conversaciones del usuario actual.
 * Server Component: pre-fetcha en el servidor para que la primera carga
 * ya muestre la lista.
 */
export default async function MensajesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/mensajes");

  const conversaciones = await getMisConversaciones(supabase, user.id);

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 pb-40">
      <div className="eyebrow">Buzón</div>
      <div className="flex items-baseline justify-between gap-3 mt-1 mb-2 flex-wrap">
        <h1
          className="display text-[clamp(1.6rem,3.2vw,2rem)]"
          style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
        >
          Mensajes
        </h1>
        <Link
          href="/mensajes/nuevo"
          className="text-[0.85rem] font-semibold px-4 py-2 rounded-md"
          style={{
            background: "var(--color-ocre-deep)",
            color: "var(--color-surface)",
          }}
        >
          + Nueva conversación
        </Link>
      </div>
      <p
        className="text-[0.9rem]"
        style={{ color: "var(--color-piedra)" }}
      >
        Conversaciones 1-a-1 con otros miembros de OCRE. Sin notificaciones
        push, sin grupos, sin DMs masivos. Es texto, lo escribes despacio.
      </p>

      <div className="divisor my-6" />

      {conversaciones.length === 0 ? (
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
            Aún no tienes conversaciones.
          </p>
          <p
            className="text-[0.9rem] mb-5"
            style={{ color: "var(--color-piedra)" }}
          >
            Empieza una con cualquier miembro de OCRE — busca por su handle.
          </p>
          <Link
            href="/mensajes/nuevo"
            className="inline-block px-5 py-2.5 rounded-md text-[0.9rem] font-semibold"
            style={{
              background: "var(--color-ocre-deep)",
              color: "var(--color-surface)",
            }}
          >
            Empezar conversación
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {conversaciones.map((c) => {
            const titulo =
              c.tipo === "grupo"
                ? c.nombre || "Grupo sin nombre"
                : c.otro
                  ? `@${c.otro.handle}` +
                    (c.otro.display_name ? ` · ${c.otro.display_name}` : "")
                  : "Conversación";

            return (
              <li key={c.id}>
                <Link
                  href={`/mensajes/${c.id}`}
                  className="block rounded-lg p-4 transition-colors hover:opacity-95 relative"
                  style={{
                    background: c.no_leidos
                      ? "var(--color-papiro-soft)"
                      : "var(--color-surface)",
                    border: "1px solid var(--color-linea)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <h2
                      className="display text-[1rem] truncate"
                      style={{
                        color: "var(--color-papiro-ink)",
                        fontWeight: c.no_leidos ? 700 : 600,
                      }}
                    >
                      {titulo}
                      {c.no_leidos && (
                        <span
                          aria-label="Mensajes nuevos"
                          className="inline-block w-2 h-2 rounded-full ml-2 align-middle"
                          style={{ background: "var(--color-ocre-deep)" }}
                        />
                      )}
                    </h2>
                    <span
                      className="text-[0.75rem] shrink-0 tabular-nums"
                      style={{ color: "var(--color-piedra-clara)" }}
                    >
                      {fechaRelativa(c.ultimo_mensaje_at)}
                    </span>
                  </div>
                  {c.ultimo_mensaje ? (
                    <p
                      className="text-[0.88rem] line-clamp-1"
                      style={{ color: "var(--color-piedra)" }}
                    >
                      {c.ultimo_mensaje.autor_id === user.id ? "Tú: " : ""}
                      {c.ultimo_mensaje.cuerpo}
                    </p>
                  ) : (
                    <p
                      className="text-[0.85rem] italic"
                      style={{ color: "var(--color-piedra-clara)" }}
                    >
                      Sin mensajes todavía.
                    </p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <p
        className="mt-12 text-[0.78rem] text-center"
        style={{ color: "var(--color-piedra-clara)" }}
      >
        Las conversaciones son privadas — solo tú y el otro participante las
        veis. Límite anti-spam: 60 mensajes/hora.
      </p>
    </div>
  );
}

