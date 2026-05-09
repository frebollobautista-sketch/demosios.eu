import Link from "next/link";

export const metadata = {
  title: "Demos iOS",
  description:
    "Suite cívica de OCRE: STOA, Ágora, Bibliotheka y POLIS. Cuatro espacios para deliberar, documentar, mirar el territorio y compartir el día a día.",
};

/**
 * /demos-ios — landing de la suite cívica.
 *
 * Decisión 2026-05-09 con Panch: lo que antes era /recursos pasa a llamarse
 * "Demos iOS" para reforzarlo como marca-producto agrupando las 4
 * herramientas. STOA es la nueva entrada (capa social ligera) que se
 * añade a las 3 originales (Ágora, Bibliotheka, POLIS).
 */
export default function DemosIosPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 pb-24">
      <div className="eyebrow">OCRE · Demos iOS</div>
      <h1
        className="display mt-2 text-[clamp(1.8rem,4vw,2.4rem)]"
        style={{ color: "var(--color-papiro-ink)", lineHeight: 1.05 }}
      >
        Cuatro espacios. Una comunidad cívica canaria.
      </h1>
      <p
        className="mt-5 text-[1.05rem] max-w-2xl"
        style={{ color: "var(--color-piedra)" }}
      >
        Demos iOS es la suite digital de OCRE: <strong>STOA</strong> para la
        vida cotidiana del barrio, <strong>Ágora</strong> para deliberar,{" "}
        <strong>Bibliotheka</strong> para documentar y aprender, y{" "}
        <strong>POLIS</strong> para mirar el territorio. Sin algoritmos. Sin
        publicidad. Sin venta de datos.
      </p>

      <div className="divisor my-10" />

      <ol
        className="space-y-6 list-none p-0 m-0"
        style={{ counterReset: "rec" }}
      >
        <Espacio
          indice={1}
          href="/stoa"
          griego="Στοά"
          titulo="STOA"
          lema="Lo que pasa hoy en el barrio"
        >
          La columnata cubierta de la polis griega. Aquí pasa la vida
          cotidiana: una foto del barrio, una pregunta rápida, un aviso
          vecinal, un trabajo bien hecho que se reconoce. Posts cortos
          ordenados por orden cronológico — sin algoritmo, sin scroll
          infinito. Cada post lleva su barrio para que sepas dónde está
          ocurriendo.
        </Espacio>

        <Espacio
          indice={2}
          href="/agora"
          griego="Ἀγορά"
          titulo="Ágora"
          lema="Donde se delibera"
        >
          La plaza pública digital. Hilos formales sobre las 8 secciones
          temáticas heredadas de PHAROS: vivienda, trabajo, cambio
          climático, medios, común… Sin algoritmo de engagement. Se entra
          a hablar de algo concreto, se sale cuando se ha dicho.
        </Espacio>

        <Espacio
          indice={3}
          href="/bibliotheka"
          griego="Βιβλιοθήκη"
          titulo="Bibliotheka"
          lema="Donde queda registrado"
        >
          La memoria de lo dicho y lo hecho, en dos alas. El{" "}
          <em className="display italic">Cursus honorum</em> es un canal
          de vídeos ciudadanos graduado por siete niveles cívicos.{" "}
          <em className="display italic">τὰ Κοινά</em> — «las cosas
          comunes» — es el repositorio de recursos del común: guías,
          plantillas y servicios vecinales clasificados por las mismas
          ocho secciones del Ágora.
        </Espacio>

        <Espacio
          indice={4}
          href="/polis"
          griego="Πόλις"
          titulo="POLIS"
          lema="Donde se mira y se traza"
        >
          El mapa de tu barrio en 2.5D, completado entre vecinos. Donde el
          satélite tiene huecos — un edificio sin contorno, un parque sin
          nombre — alguien lo traza y el mapa va creciendo. Es el
          contraplano cívico de un mapa turístico: tu calle no como
          destino, sino como territorio que se reconoce y se cuida.
        </Espacio>
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

function Espacio({
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
