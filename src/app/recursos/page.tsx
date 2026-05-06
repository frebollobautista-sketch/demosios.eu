import Link from "next/link";

export const metadata = {
  title: "Recursos",
  description:
    "Recursos cívicos digitales de OCRE: Ágora para deliberar, Bibliotheka para documentar y un paseo gamificado por el barrio.",
};

/**
 * /recursos — hub que agrupa los espacios cívicos comunitarios.
 *
 * Decisión 2026-05-06: Ágora, Bibliotheka y el paseo POLIS gamificado
 * dejan de aparecer en el header principal. Quedan accesibles desde aquí.
 * Las rutas /agora, /bibliotheka y /polis siguen funcionando — esta
 * página es el portal de entrada en lugar de la navegación directa.
 */
export default function RecursosPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 pb-24">
      <div className="eyebrow">OCRE · Recursos cívicos</div>
      <h1
        className="display mt-2 text-[clamp(1.8rem,4vw,2.4rem)]"
        style={{ color: "var(--color-papiro-ink)", lineHeight: 1.05 }}
      >
        Espacios para deliberar, documentar y mirar.
      </h1>
      <p
        className="mt-5 text-[1.05rem] max-w-2xl"
        style={{ color: "var(--color-piedra)" }}
      >
        Tres recursos digitales abiertos a la comunidad de OCRE. Se entra con
        cuenta y se sale habiendo aportado o aprendido algo.
      </p>

      <div className="divisor my-10" />

      <ol
        className="space-y-6 list-none p-0 m-0"
        style={{ counterReset: "rec" }}
      >
        <Recurso
          indice={1}
          href="/agora"
          griego="Ἀγορά"
          titulo="Ágora"
          lema="Donde se habla"
        >
          La plaza pública digital. Ocho secciones temáticas (vivienda,
          trabajo, cambio climático, medios, común…) en las que los miembros
          abren hilos, responden y se avalan entre sí. Sin algoritmo de
          engagement ni scroll infinito: se entra a hablar de algo concreto
          y se sale cuando se ha dicho.
        </Recurso>

        <Recurso
          indice={2}
          href="/bibliotheka"
          griego="Βιβλιοθήκη"
          titulo="Bibliotheka"
          lema="Donde queda registrado"
        >
          La memoria de lo dicho y lo hecho, en dos alas. El{" "}
          <em className="display italic">Cursus honorum</em> es un canal de
          vídeos ciudadanos graduado por siete niveles cívicos. <em className="display italic">τὰ Κοινά</em>{" "}
          — «las cosas comunes» — es el repositorio de recursos del común:
          guías, plantillas y servicios vecinales clasificados por las mismas
          ocho secciones del Ágora.
        </Recurso>

        <Recurso
          indice={3}
          href="/polis"
          griego="Πόλις"
          titulo="POLIS — paseo por el barrio"
          lema="Donde se mira"
        >
          Un paseo gamificado por las calles de tu barrio. Te mueves con un
          avatar entre los edificios reales en 3D y vas activando lugares,
          datos y micro-historias. Es el contraplano cívico de un mapa
          turístico: tu calle no como destino, sino como territorio que se
          reconoce y se cuida.
        </Recurso>
      </ol>

      <div className="divisor my-10" />

      <section
        className="rounded-xl p-6 text-center"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-linea)",
        }}
      >
        <p
          className="display italic text-[1rem]"
          style={{ color: "var(--color-papiro-ink)" }}
        >
          Si vienes a explorar el archipiélago en datos, no a participar
          aún, mejor pasa por{" "}
          <Link
            href="/canarias-en-datos"
            className="underline"
            style={{ color: "var(--color-ocre-deep)", fontWeight: 600 }}
          >
            Canarias en Datos
          </Link>
          .
        </p>
      </section>
    </div>
  );
}

function Recurso({
  indice,
  href,
  griego,
  titulo,
  lema,
  children,
}: {
  indice: number;
  href: string;
  griego: string;
  titulo: string;
  lema: string;
  children: React.ReactNode;
}) {
  return (
    <li
      className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1"
      style={{
        borderLeft: "2px solid var(--color-linea)",
        paddingLeft: "1.25rem",
      }}
    >
      <span
        aria-hidden
        className="display italic"
        style={{
          color: "var(--color-ocre-deep)",
          fontSize: "1rem",
          fontWeight: 600,
          gridRow: "1 / span 2",
          marginTop: "0.1rem",
        }}
      >
        {indice}.
      </span>
      <div className="flex items-baseline gap-3 flex-wrap">
        <Link
          href={href}
          className="display hover:underline"
          style={{
            color: "var(--color-papiro-ink)",
            fontSize: "1.35rem",
            fontWeight: 600,
          }}
        >
          {titulo}
        </Link>
        <span
          className="display italic"
          style={{ color: "var(--color-ocre-deep)", fontSize: "0.95rem" }}
        >
          {griego}
        </span>
        <span
          className="eyebrow"
          style={{ color: "var(--color-piedra-clara)" }}
        >
          {lema}
        </span>
      </div>
      <p
        style={{
          color: "var(--color-piedra)",
          fontSize: "0.98rem",
          lineHeight: 1.55,
        }}
      >
        {children}
      </p>
    </li>
  );
}
