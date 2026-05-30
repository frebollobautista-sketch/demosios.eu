import Link from "next/link";

import { contarHilosPorSeccion } from "@/lib/agora/queries";
import { SECCIONES } from "@/lib/pharos/secciones";

export const dynamic = "force-dynamic";

export default async function AgoraPage() {
  const conteos = await contarHilosPorSeccion();

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
        temáticas heredadas de PHAROS y se anclan opcionalmente a un
        territorio (isla, municipio, barrio) y a una categoría local.
      </p>

      <div className="mt-6 flex items-center gap-3">
        <Link
          href="/agora/nuevo"
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          style={{
            background: "var(--color-papiro-ink)",
            color: "var(--color-papiro)",
          }}
        >
          <span aria-hidden>＋</span> Abrir un hilo
        </Link>
        <span className="eyebrow" style={{ color: "var(--color-piedra-clara)" }}>
          {totalHilos(conteos)} hilos abiertos
        </span>
      </div>

      <div className="divisor my-8" />

      <ul className="grid md:grid-cols-2 gap-3">
        {SECCIONES.map((s) => {
          const n = conteos[s.id] ?? 0;
          return (
            <li key={s.id}>
              <Link
                href={`/agora/${s.id}`}
                className="block rounded-xl p-5 transition-colors hover:opacity-95"
                style={{
                  background: s.color,
                  border: "1px solid var(--color-linea)",
                }}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl" aria-hidden>
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
                        : `${n} ${n === 1 ? "hilo abierto" : "hilos abiertos"}`}
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

function totalHilos(c: Record<string, number>): number {
  return Object.values(c).reduce((s, v) => s + v, 0);
}
