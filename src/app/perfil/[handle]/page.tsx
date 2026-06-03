import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AvatarInteractivo } from "@/components/AvatarInteractivo";
import { parseReceta } from "@/lib/avatar/receta";
import { recetaPorSemilla } from "@/lib/avatar/catalogo";
import { EnviarMensajeButton } from "./EnviarMensajeButton";
import { BloquearButton } from "./BloquearButton";

type Params = { handle: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}) {
  const { handle } = await params;
  return {
    title: `@${handle} · Perfil`,
    description: `Perfil público de @${handle} en OCRE.`,
  };
}

/**
 * /perfil/[handle] — perfil público de un usuario.
 *
 * Lectura: RLS de profiles es SELECT público (true), así que cualquiera
 * puede leer. Si is_public = false, todavía se devuelve la fila (no hay
 * filtro RLS para eso) — la decisión de mostrar u ocultar se hace aquí
 * en la página.
 *
 * Sin sesión: se ve el perfil en modo lectura, el botón "Enviar mensaje"
 * lleva a /login.
 */
export default async function PerfilHandlePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { handle } = await params;
  const supabase = await createClient();

  // Perfil: intentamos traer `avatar_receta`; si la columna aún no existe
  // (migración BLaP sin aplicar), reintentamos sin ella.
  const COLS =
    "id, handle, display_name, avatar_url, bio, sem, is_public, created_at";
  const sessionPromise = supabase.auth.getUser();

  let perfilData: unknown = null;
  {
    const conReceta = await supabase
      .from("profiles")
      .select(`${COLS}, avatar_receta`)
      .eq("handle", handle)
      .maybeSingle();
    if (conReceta.error) {
      const sinReceta = await supabase
        .from("profiles")
        .select(COLS)
        .eq("handle", handle)
        .maybeSingle();
      perfilData = sinReceta.data;
    } else {
      perfilData = conReceta.data;
    }
  }
  const sessionRes = await sessionPromise;

  const perfil = perfilData as
    | {
        id: string;
        handle: string;
        display_name: string | null;
        avatar_url: string | null;
        bio: string | null;
        sem: string | null;
        is_public: boolean | null;
        created_at: string;
        avatar_receta?: unknown;
      }
    | null;

  if (!perfil) notFound();

  const recetaDisplay =
    parseReceta(perfil.avatar_receta) ?? recetaPorSemilla(perfil.handle);

  const yo = sessionRes.data.user;
  const esMiPerfil = yo?.id === perfil.id;

  // Si is_public = false y NO soy yo, mostramos un mensaje de privacidad
  // en lugar del perfil completo. (404 sería más estricto pero menos
  // claro al user que sabe del handle.)
  const oculto = perfil.is_public === false && !esMiPerfil;

  if (oculto) {
    return (
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-16 text-center">
        <div className="eyebrow mb-2">Perfil privado</div>
        <h1
          className="display text-[1.5rem] mb-3"
          style={{ color: "var(--color-papiro-ink)" }}
        >
          @{perfil.handle}
        </h1>
        <p
          className="text-[0.95rem]"
          style={{ color: "var(--color-piedra)" }}
        >
          Este usuario ha optado por no mostrar su perfil públicamente. Si
          os conocéis, escríbele directamente al privado o por otra vía.
        </p>
      </div>
    );
  }

  const nombre = perfil.display_name || `@${perfil.handle}`;
  const fechaAlta = new Date(perfil.created_at).toLocaleDateString("es", {
    month: "long",
    year: "numeric",
  });

  // Contribuciones reales: hilos de Ágora y posts de STOA (logos).
  const [hilosRes, postsRes] = await Promise.all([
    supabase
      .from("agora_hilos")
      .select("id, titulo, creado")
      .eq("autor_id", perfil.id)
      .order("creado", { ascending: false })
      .limit(5),
    supabase
      .from("logos_posts")
      .select("id, cuerpo, creado")
      .eq("autor_id", perfil.id)
      .eq("retirado", false)
      .order("creado", { ascending: false })
      .limit(5),
  ]);

  const hilos =
    (hilosRes.data as { id: string; titulo: string; creado: string }[] | null) ??
    [];
  const posts =
    (postsRes.data as { id: string; cuerpo: string; creado: string }[] | null) ??
    [];
  const sinAportaciones = hilos.length === 0 && posts.length === 0;

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-10 pb-40">
      <div className="eyebrow">Perfil</div>

      <header
        className="rounded-xl p-6 mt-2 mb-6"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-linea)",
        }}
      >
        <div className="flex items-start gap-4 flex-wrap">
          {/* Avatar: muñeco por defecto; la foto se revela al posar el dedo. */}
          <AvatarInteractivo
            receta={recetaDisplay}
            fotoUrl={perfil.avatar_url}
            nombre={nombre}
            size={80}
            className="shrink-0"
          />

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h1
              className="display text-[1.4rem]"
              style={{
                color: "var(--color-papiro-ink)",
                fontWeight: 600,
              }}
            >
              {nombre}
            </h1>
            {perfil.display_name && (
              <div
                className="text-[0.92rem] mt-0.5"
                style={{ color: "var(--color-piedra)" }}
              >
                @{perfil.handle}
              </div>
            )}
            <div
              className="text-[0.78rem] mt-2"
              style={{ color: "var(--color-piedra-clara)" }}
            >
              Miembro desde {fechaAlta}
            </div>
            {perfil.bio && (
              <p
                className="text-[0.92rem] mt-3 whitespace-pre-wrap"
                style={{
                  color: "var(--color-papiro-ink)",
                  lineHeight: 1.55,
                }}
              >
                {perfil.bio}
              </p>
            )}
          </div>
        </div>

        {/* Acciones */}
        {!esMiPerfil ? (
          <div className="mt-5 flex items-start gap-3 flex-wrap">
            <EnviarMensajeButton
              otherUserId={perfil.id}
              authed={!!yo}
              handle={perfil.handle}
            />
            {yo && (
              <BloquearButton otherUserId={perfil.id} handle={perfil.handle} />
            )}
          </div>
        ) : (
          <div className="mt-5 flex items-center gap-3 flex-wrap">
            <Link
              href="/perfil"
              className="px-4 py-2 rounded-md text-[0.88rem]"
              style={{
                background: "var(--color-papiro-soft)",
                color: "var(--color-piedra)",
                border: "1px solid var(--color-linea)",
              }}
            >
              Ver mi perfil completo
            </Link>
            <Link
              href="/ajustes"
              className="text-[0.85rem] underline"
              style={{ color: "var(--color-ocre-deep)" }}
            >
              Editar en Ajustes
            </Link>
          </div>
        )}
      </header>

      {/* Bloque: contribuciones cívicas reales (Ágora + STOA). */}
      <section
        className="rounded-xl p-5"
        style={{
          background: "var(--color-papiro-soft)",
          border: "1px solid var(--color-linea)",
        }}
      >
        <h2
          className="display text-[1rem] mb-3"
          style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
        >
          Contribuciones cívicas
        </h2>

        {sinAportaciones ? (
          <p
            className="text-[0.85rem]"
            style={{ color: "var(--color-piedra)", lineHeight: 1.55 }}
          >
            @{perfil.handle} todavía no ha publicado hilos en Ágora ni posts
            en STOA.
          </p>
        ) : (
          <div className="space-y-5">
            {hilos.length > 0 && (
              <div>
                <div
                  className="eyebrow mb-2"
                  style={{ color: "var(--color-piedra-clara)" }}
                >
                  Hilos en Ágora
                </div>
                <ul className="space-y-2">
                  {hilos.map((h) => (
                    <li key={h.id}>
                      <Link
                        href={`/agora/hilo/${h.id}`}
                        className="text-[0.92rem] underline"
                        style={{ color: "var(--color-ocre-deep)" }}
                      >
                        {h.titulo}
                      </Link>
                      <span
                        className="text-[0.76rem] ml-2"
                        style={{ color: "var(--color-piedra-clara)" }}
                      >
                        {new Date(h.creado).toLocaleDateString("es", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {posts.length > 0 && (
              <div>
                <div
                  className="eyebrow mb-2"
                  style={{ color: "var(--color-piedra-clara)" }}
                >
                  Posts en STOA
                </div>
                <ul className="space-y-2">
                  {posts.map((p) => (
                    <li
                      key={p.id}
                      className="text-[0.9rem]"
                      style={{ color: "var(--color-papiro-ink)" }}
                    >
                      <span className="line-clamp-2">
                        {p.cuerpo || "(sin texto)"}
                      </span>
                      <span
                        className="text-[0.76rem]"
                        style={{ color: "var(--color-piedra-clara)" }}
                      >
                        {new Date(p.creado).toLocaleDateString("es", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
