import Link from "next/link";
import { notFound } from "next/navigation";

import { SECCIONES } from "@/lib/pharos/secciones";

// NOTA: la vista de detalle de hilo con votos/decisiones/propuestas está en
// desarrollo. El backend de queries (conteoVotosDecision, listarPropuestas,
// obtenerHilo, etc.) aún no existe, así que esta página queda como placeholder
// para no romper el build de producción. Los componentes CajaComentar,
// ArbolComentarios, PanelDecidim, PanelPolis, PromoverHilo y BotonPecHilo
// quedan en la carpeta sin usar hasta que se implemente esa capa de datos.

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ seccion: string; hiloId: string }>;
};

export default async function HiloPage({ params }: Props) {
  const { seccion: seccionId } = await params;

  const seccion = SECCIONES.find((s) => s.id === seccionId);
  if (!seccion) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 pb-40">
      <nav className="mb-6 text-[0.8rem]" style={{ color: "var(--color-piedra)" }}>
        <Link href="/agora" className="eyebrow" style={{ color: "var(--color-ocre-deep)" }}>
          ← Ágora
        </Link>
        <span className="mx-2">·</span>
        <Link
          href={`/agora/${seccion.id}`}
          className="eyebrow"
          style={{ color: "var(--color-ocre-deep)" }}
        >
          {seccion.nombre}
        </Link>
      </nav>

      <div
        className="rounded-xl p-6 text-center"
        style={{
          background: "var(--color-papiro-soft)",
          border: "1px dashed var(--color-linea)",
          color: "var(--color-piedra)",
        }}
      >
        <div className="eyebrow">En construcción</div>
        <p className="display italic mt-2">
          La vista de detalle del hilo estará disponible pronto.
        </p>
        <p className="mt-3 text-[0.9rem]">
          Mientras tanto, puedes ver los hilos abiertos de{" "}
          <Link
            href={`/agora/${seccion.id}`}
            style={{ color: "var(--color-ocre-deep)", textDecoration: "underline" }}
          >
            {seccion.nombre}
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
