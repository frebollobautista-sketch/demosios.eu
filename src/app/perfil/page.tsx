import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AvatarInteractivo } from "@/components/AvatarInteractivo";
import { EJES } from "@/lib/capital/ejes";
import {
  agregarCapital,
  puntosTotales,
  ejeDominante,
  type Contribucion,
} from "@/lib/capital/contribuciones";
import {
  CURSUS,
  gradoActual,
  proximoGrado,
  avanceHaciaProximo,
} from "@/lib/cursus/grados";
import { CANARIAS } from "@/lib/territorio/canarias";
import { parseReceta } from "@/lib/avatar/receta";
import { recetaPorSemilla } from "@/lib/avatar/catalogo";
import { PerfilEditor, type Enlace } from "./PerfilEditor";

export const metadata = {
  title: "Mi perfil",
  description: "Tu capital cívico, tu cursus honorum y tus aportaciones en OCRE.",
};

type ProfileRow = {
  id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  avatar_color: string | null;
  bio: string | null;
  isla_id: string | null;
  municipio_id: string | null;
  barrio_id: string | null;
  enlaces?: Enlace[] | null;
  avatar_receta?: unknown;
};

/**
 * /perfil — perfil propio del usuario autenticado, con datos reales.
 *
 * Capital y cursus se calculan a partir de la tabla `contribuciones`
 * (user_id = yo). La cabecera muestra avatar, nombre, handle, grado, lema,
 * ubicación, biografía y enlaces, todo editable mediante <PerfilEditor>.
 */
export default async function PerfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/perfil");

  // Perfil: intentamos traer `enlaces`; si la columna aún no existe
  // (migración sin aplicar), reintentamos sin ella.
  const COLS_BASE =
    "id, handle, display_name, avatar_url, avatar_color, bio, isla_id, municipio_id, barrio_id";
  let perfilRow: ProfileRow | null = null;
  {
    const conEnlaces = await supabase
      .from("profiles")
      .select(`${COLS_BASE}, enlaces, avatar_receta`)
      .eq("id", user.id)
      .single();
    if (conEnlaces.error) {
      const sinEnlaces = await supabase
        .from("profiles")
        .select(COLS_BASE)
        .eq("id", user.id)
        .single();
      perfilRow = (sinEnlaces.data as ProfileRow | null) ?? null;
    } else {
      perfilRow = conEnlaces.data as ProfileRow;
    }
  }

  // Contribuciones reales → tipo de la librería de capital.
  const { data: contribRows } = await supabase
    .from("contribuciones")
    .select("id, tipo, seccion_pharos, creada")
    .eq("user_id", user.id);

  const contribuciones: Contribucion[] = (contribRows ?? []).map(
    (c: {
      id: string;
      tipo: Contribucion["tipo"];
      seccion_pharos: string | null;
      creada: string;
    }) => ({
      id: c.id,
      tipo: c.tipo,
      seccionPharos: c.seccion_pharos ?? undefined,
      creada: c.creada,
    }),
  );

  const puntos = agregarCapital(contribuciones);
  const total = puntosTotales(puntos);
  const dominante = ejeDominante(puntos);
  const grado = gradoActual(puntos);
  const proximo = proximoGrado(grado);
  const avance = Math.round(avanceHaciaProximo(puntos, grado) * 100);

  const nombre =
    perfilRow?.display_name || `@${perfilRow?.handle ?? "vecino"}`;
  const enlaces: Enlace[] = Array.isArray(perfilRow?.enlaces)
    ? (perfilRow!.enlaces as Enlace[])
    : [];
  // Muñeco a mostrar: el personalizado si existe; si no, uno por defecto único.
  const recetaDisplay =
    parseReceta(perfilRow?.avatar_receta) ??
    recetaPorSemilla(perfilRow?.handle || user.id);

  const isla = CANARIAS.find((i) => i.id === perfilRow?.isla_id);
  const muni = isla?.municipios.find((m) => m.id === perfilRow?.municipio_id);
  const barrio = muni?.barrios.find((b) => b.id === perfilRow?.barrio_id);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 pb-40">
      {/* Cabecera de perfil */}
      <section className="flex items-start gap-5 flex-wrap">
        <AvatarInteractivo
          receta={recetaDisplay}
          fotoUrl={perfilRow?.avatar_url ?? null}
          nombre={nombre}
          size={96}
          className="shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="eyebrow" style={{ color: grado.color }}>
            {grado.nombreLatino} · {grado.traduccion}
          </div>
          <h1
            className="display mt-1 text-[clamp(1.5rem,3.2vw,2rem)]"
            style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
          >
            {nombre}{" "}
            {perfilRow?.handle && (
              <span
                className="display italic font-normal"
                style={{ color: "var(--color-piedra)" }}
              >
                @{perfilRow.handle}
              </span>
            )}
          </h1>
          <p
            className="display italic mt-1 text-[1rem]"
            style={{ color: grado.color }}
          >
            «{grado.lema}»
          </p>
          {barrio && (
            <p
              className="text-[0.88rem] mt-2"
              style={{ color: "var(--color-piedra)" }}
            >
              Vecina/o de {barrio.nombre} · {muni!.nombre} · {isla!.nombre}
            </p>
          )}
          {perfilRow?.bio && (
            <p
              className="text-[0.92rem] mt-3 whitespace-pre-wrap max-w-2xl"
              style={{ color: "var(--color-papiro-ink)", lineHeight: 1.55 }}
            >
              {perfilRow.bio}
            </p>
          )}
          {enlaces.length > 0 && (
            <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
              {enlaces.map((e, i) => (
                <li key={i}>
                  <a
                    href={e.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="text-[0.86rem] underline"
                    style={{ color: "var(--color-ocre-deep)" }}
                  >
                    {e.titulo}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex items-center gap-4 flex-wrap">
            <PerfilEditor
              userId={user.id}
              bioInicial={perfilRow?.bio ?? ""}
              enlacesInicial={enlaces}
              avatarUrlInicial={perfilRow?.avatar_url ?? null}
            />
            <Link
              href="/avatar"
              className="text-[0.86rem] underline"
              style={{ color: "var(--color-ocre-deep)" }}
            >
              Personalizar avatar
            </Link>
          </div>
        </div>
      </section>

      <div className="divisor my-8" />

      {/* Capital en los tres ejes */}
      <section aria-labelledby="capital">
        <h2
          id="capital"
          className="display text-[1.15rem] mb-4"
          style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
        >
          Capital acumulado
        </h2>
        {total === 0 && (
          <p
            className="text-[0.9rem] mb-4"
            style={{ color: "var(--color-piedra)" }}
          >
            Todavía no has acumulado capital cívico. Abre un hilo en Ágora,
            publica en STOA o aporta en Bibliotheka para empezar tu cursus.
          </p>
        )}
        <ul className="grid md:grid-cols-3 gap-4">
          {EJES.map((e) => {
            const v = puntos[e.id];
            const pct = Math.min(100, Math.round((v / Math.max(total, 1)) * 100));
            const esDominante = total > 0 && dominante === e.id;
            return (
              <li
                key={e.id}
                className="rounded-xl p-5"
                style={{
                  background: esDominante ? e.colorTenue : "var(--color-surface)",
                  border: esDominante
                    ? `1px solid ${e.color}`
                    : "1px solid var(--color-linea)",
                }}
              >
                <div className="flex items-baseline justify-between">
                  <div
                    className="display italic text-[1.3rem]"
                    style={{ color: e.color, fontWeight: 600 }}
                  >
                    {e.nombreGriego}
                  </div>
                  {esDominante && (
                    <span
                      className="eyebrow rounded-full px-2 py-0.5"
                      style={{
                        background: e.color,
                        color: "var(--color-surface)",
                      }}
                    >
                      Dominante
                    </span>
                  )}
                </div>
                <div
                  className="eyebrow"
                  style={{ color: e.color, opacity: 0.8 }}
                >
                  {e.nombre}
                </div>
                <div className="flex items-baseline justify-between mt-4">
                  <span
                    className="display"
                    style={{
                      color: "var(--color-papiro-ink)",
                      fontSize: "1.6rem",
                      fontFeatureSettings: "'tnum'",
                      fontWeight: 600,
                    }}
                  >
                    {v}
                  </span>
                  <span
                    className="text-[0.8rem]"
                    style={{ color: "var(--color-piedra)" }}
                  >
                    {pct}% del total
                  </span>
                </div>
                <div
                  className="h-[4px] rounded-full mt-2"
                  style={{ background: e.colorTenue }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: e.color }}
                  />
                </div>
                <p
                  className="text-[0.82rem] mt-3"
                  style={{ color: "var(--color-piedra)" }}
                >
                  {e.descripcion}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="divisor my-10" />

      {/* Progreso en el cursus */}
      <section aria-labelledby="cursus">
        <h2
          id="cursus"
          className="display text-[1.15rem] mb-4"
          style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
        >
          Cursus honorum
        </h2>
        <ol
          className="relative rounded-xl p-5"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-linea)",
          }}
        >
          {CURSUS.map((g) => {
            const alcanzado = g.nivel <= grado.nivel;
            const esActual = g.nivel === grado.nivel;
            return (
              <li
                key={g.id}
                className="flex items-center gap-4 py-2"
                style={{
                  opacity: alcanzado ? 1 : 0.5,
                }}
              >
                <span
                  aria-hidden
                  className="shrink-0 inline-flex items-center justify-center"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    background: alcanzado
                      ? "var(--color-papiro-soft)"
                      : "var(--color-papiro)",
                    color: g.color,
                    fontFamily: "var(--font-serif-stack)",
                    fontSize: 18,
                    fontWeight: 700,
                    border: esActual
                      ? `2px solid ${g.color}`
                      : "1px solid var(--color-linea)",
                  }}
                >
                  {g.atributo}
                </span>
                <div className="min-w-0 flex-1">
                  <div
                    className="display text-[0.98rem]"
                    style={{
                      color: "var(--color-papiro-ink)",
                      fontWeight: esActual ? 700 : 600,
                    }}
                  >
                    {g.nombre}{" "}
                    <span
                      className="eyebrow ml-1"
                      style={{ color: "var(--color-piedra-clara)" }}
                    >
                      {g.traduccion}
                    </span>
                  </div>
                  <p
                    className="text-[0.82rem] mt-0.5"
                    style={{ color: "var(--color-piedra)" }}
                  >
                    {g.funcionCivica}
                  </p>
                </div>
                {esActual && proximo && (
                  <div className="shrink-0 w-28">
                    <div
                      className="text-[0.72rem] mb-1"
                      style={{ color: "var(--color-piedra)" }}
                    >
                      Avance: {avance}%
                    </div>
                    <div
                      className="h-[3px] rounded-full"
                      style={{ background: "var(--color-papiro-soft)" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${avance}%`,
                          background: proximo.color,
                        }}
                      />
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <p
        className="mt-12 text-[0.82rem] text-center"
        style={{ color: "var(--color-piedra-clara)" }}
      >
        Gestiona tu cuenta en{" "}
        <Link
          href="/ajustes"
          className="underline"
          style={{ color: "var(--color-ocre-deep)" }}
        >
          Ajustes
        </Link>
        .
      </p>
    </div>
  );
}
