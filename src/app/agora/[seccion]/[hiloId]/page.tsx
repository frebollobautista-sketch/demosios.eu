import Link from "next/link";
import { notFound } from "next/navigation";

import {
  conteoVotosDecision,
  conteoVotosPropuestasDeHilo,
  listarComentarios,
  listarPropuestas,
  obtenerDecision,
  obtenerHilo,
  pecHiloDeUsuario,
  pecsComentariosDeUsuario,
  votoDecisionDeUsuario,
  votosPropuestasDeUsuario,
} from "@/lib/agora/queries";
import { etiquetaTerritorio, resolverTerritorio } from "@/lib/agora/territorio";
import { calcularTiemposDecision } from "@/lib/agora/tiempos";
import { CATEGORIAS } from "@/lib/pharos/categorias";
import { SECCIONES } from "@/lib/pharos/secciones";
import { createClient } from "@/lib/supabase/server";

import { CajaComentar } from "./CajaComentar";
import { ArbolComentarios } from "./ArbolComentarios";
import { BotonPecHilo } from "./BotonPecHilo";
import { PanelDecidim } from "./PanelDecidim";
import { PanelPolis } from "./PanelPolis";
import { PromoverHilo } from "./PromoverHilo";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ seccion: string; hiloId: string }>;
};

export default async function HiloPage({ params }: Props) {
  const { seccion: seccionId, hiloId } = await params;

  const seccion = SECCIONES.find((s) => s.id === seccionId);
  if (!seccion) notFound();

  const hilo = await obtenerHilo(hiloId);
  if (!hilo || hilo.seccion_pharos !== seccion.id) notFound();

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  const [comentarios, decision, propuestas] = await Promise.all([
    listarComentarios(hilo.id),
    hilo.modo === "propuesta_decidim" ? obtenerDecision(hilo.id) : Promise.resolve(null),
    hilo.modo === "consenso_polis" ? listarPropuestas(hilo.id) : Promise.resolve([]),
  ]);

  const [pecHilo, pecsComentarios, conteosVotosPropuesta, votosUsuarioPropuesta, conteoDecision, votoUsuarioDec] =
    await Promise.all([
      user ? pecHiloDeUsuario(hilo.id, user.id) : false,
      user ? pecsComentariosDeUsuario(hilo.id, user.id) : new Set<string>(),
      hilo.modo === "consenso_polis"
        ? conteoVotosPropuestasDeHilo(hilo.id)
        : Promise.resolve({}),
      hilo.modo === "consenso_polis" && user
        ? votosPropuestasDeUsuario(hilo.id, user.id)
        : Promise.resolve({}),
      decision ? conteoVotosDecision(decision.id) : Promise.resolve(null),
      decision && user ? votoDecisionDeUsuario(decision.id, user.id) : Promise.resolve(null),
    ]);

  const territorio = resolverTerritorio(hilo.isla_id, hilo.municipio_id, hilo.barrio_id);
  const categoria = hilo.categoria_local
    ? CATEGORIAS.find((c) => c.id === hilo.categoria_local)
    : null;
  const esAutor = !!user && user.id === hilo.autor_id;

  // Tiempos de cierre del modo Decidim — se calculan en lib/agora/tiempos
  // para mantener Date.now() fuera del cuerpo del componente (regla
  // react-hooks/purity de React 19).
  const decisionTiempos = decision
    ? calcularTiemposDecision(decision.fecha_cierre, decision.resultado)
    : null;

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 pb-40">
      <Link
        href={`/agora/${seccion.id}`}
        className="eyebrow inline-flex items-center gap-1 hover:opacity-80"
        style={{ color: "var(--color-piedra)" }}
      >
        ← {seccion.icono} {seccion.nombre}
      </Link>

      <article
        className="mt-4 rounded-xl p-6"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-linea)",
          boxShadow: "var(--shadow-sutil)",
        }}
      >
        <BadgeModoGrande modo={hilo.modo} />
        <h1
          className="display mt-2 text-[clamp(1.4rem,3vw,1.9rem)]"
          style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
        >
          {hilo.titulo}
        </h1>

        <div
          className="eyebrow mt-2 flex flex-wrap gap-x-3 gap-y-1"
          style={{ color: "var(--color-piedra-clara)" }}
        >
          {hilo.autor && <span>por @{hilo.autor.handle}</span>}
          <span>{etiquetaTerritorio(territorio)}</span>
          {categoria && (
            <span>
              {categoria.icono} {categoria.nombre}
            </span>
          )}
          <span>creado {new Date(hilo.creado).toLocaleDateString("es-ES")}</span>
        </div>

        <div
          className="mt-5 whitespace-pre-wrap text-[0.98rem] leading-relaxed"
          style={{ color: "var(--color-papiro-ink)" }}
        >
          {hilo.cuerpo}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <BotonPecHilo
            hiloId={hilo.id}
            seccionId={seccion.id}
            activoInicial={pecHilo}
            conteoInicial={hilo.pec_count}
            requiereSesion={!user}
          />
          <span
            className="eyebrow"
            style={{ color: "var(--color-piedra-clara)" }}
          >
            {hilo.comentario_count}{" "}
            {hilo.comentario_count === 1 ? "comentario" : "comentarios"}
          </span>
        </div>
      </article>

      {/* Panel del modo activo */}
      {hilo.modo === "propuesta_decidim" && decision && conteoDecision && decisionTiempos && (
        <div className="mt-6">
          <PanelDecidim
            decision={decision}
            conteo={conteoDecision}
            votoUsuario={votoUsuarioDec}
            hiloId={hilo.id}
            seccionId={seccion.id}
            requiereSesion={!user}
            cerrada={decisionTiempos.cerrada}
            horasRestantes={decisionTiempos.horasRestantes}
          />
        </div>
      )}

      {hilo.modo === "consenso_polis" && (
        <div className="mt-6">
          <PanelPolis
            propuestas={propuestas}
            conteos={conteosVotosPropuesta}
            votosUsuario={votosUsuarioPropuesta}
            hiloId={hilo.id}
            seccionId={seccion.id}
            requiereSesion={!user}
          />
        </div>
      )}

      {/* Promoción solo visible al autor con hilo en modo debate */}
      {esAutor && hilo.modo === "debate" && (
        <div className="mt-6">
          <PromoverHilo hiloId={hilo.id} seccionId={seccion.id} />
        </div>
      )}

      {/* Comentarios — siempre visibles, en cualquier modo */}
      <section className="mt-10">
        <h2
          className="display text-base"
          style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
        >
          Conversación
        </h2>
        <div className="divisor mt-3 mb-5" />

        {user ? (
          <CajaComentar hiloId={hilo.id} seccionId={seccion.id} />
        ) : (
          <Link
            href="/login"
            className="eyebrow underline"
            style={{ color: "var(--color-ocre-deep)" }}
          >
            Inicia sesión para participar →
          </Link>
        )}

        <ArbolComentarios
          hiloId={hilo.id}
          seccionId={seccion.id}
          comentarios={comentarios}
          pecsUsuario={pecsComentarios}
          puedeResponder={!!user}
        />

        {comentarios.length === 0 && (
          <p
            className="mt-6 text-sm"
            style={{ color: "var(--color-piedra-clara)" }}
          >
            Aún no hay comentarios. Quien rompa el silencio inaugura el hilo.
          </p>
        )}
      </section>
    </div>
  );
}

function BadgeModoGrande({ modo }: { modo: string }) {
  const map: Record<string, { label: string; descripcion: string; bg: string; color: string }> = {
    debate: {
      label: "Debate",
      descripcion: "Conversación abierta. Comentarios anidados.",
      bg: "#F1F5F9",
      color: "#334155",
    },
    propuesta_decidim: {
      label: "Propuesta",
      descripcion: "Voto vinculante: a favor / en contra / abstención.",
      bg: "#EFF6FF",
      color: "#1D4ED8",
    },
    consenso_polis: {
      label: "Consenso",
      descripcion: "Microfrases con voto de acuerdo / desacuerdo / pasar.",
      bg: "#FAF5FF",
      color: "#7E22CE",
    },
  };
  const m = map[modo] ?? map.debate;
  return (
    <div className="inline-flex flex-col">
      <span
        className="self-start rounded-md px-2 py-1 text-[0.7rem] font-medium uppercase tracking-wider"
        style={{ background: m.bg, color: m.color }}
      >
        {m.label}
      </span>
      <span
        className="mt-1 text-[0.72rem]"
        style={{ color: "var(--color-piedra-clara)" }}
      >
        {m.descripcion}
      </span>
    </div>
  );
}
