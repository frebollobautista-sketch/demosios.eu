import { SECCIONES } from "@/lib/pharos/secciones";

export default function AgoraPage() {
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
        temáticas heredadas de PHAROS. Por ahora la estructura; los hilos
        llegarán con la primera cohorte.
      </p>

      <div className="divisor my-8" />

      <ul className="grid md:grid-cols-2 gap-3">
        {SECCIONES.map((s) => (
          <li
            key={s.id}
            className="rounded-xl p-5 transition-colors cursor-pointer"
            style={{
              background: s.color,
              border: "1px solid var(--color-linea)",
            }}
          >
            <div className="flex items-start gap-3">
              <span className="text-xl" aria-hidden>
                {s.icono}
              </span>
              <div className="min-w-0">
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
                  0 hilos · primera cohorte pendiente
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
