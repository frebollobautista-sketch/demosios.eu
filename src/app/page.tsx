import Link from "next/link";
import { FaroHero } from "@/components/FaroHero";

/**
 * Home — lobby social de OCRE.
 *
 * Decisión 2026-05-06 (con Panch): la home pivota desde "Demos iOS by OCRE"
 * (producto delante) hacia "OCRE · Demos iOS" (organización delante). El
 * objetivo es que esta página actúe como vestíbulo de la organización
 * cívica — no como portada de un producto. Las cuatro puertas son las
 * funciones reales que ofrece OCRE a residentes y entidades de Canarias.
 */
export default function InicioPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 pb-40">
      {/* Hero: el faro como emblema de OCRE */}
      <section className="relative flex flex-col items-center text-center pt-4 pb-2">
        <FaroHero />
        <div className="eyebrow mt-6">Lobby cívico canario</div>
        <h1
          className="display mt-2 text-[clamp(2rem,4.8vw,2.8rem)]"
          style={{
            color: "var(--color-papiro-ink)",
            lineHeight: 1.05,
            maxWidth: "30ch",
          }}
        >
          OCRE
        </h1>
        <p
          className="display italic mt-2 text-[1.05rem]"
          style={{ color: "var(--color-ocre-deep)" }}
        >
          Organización Canaria para la Recuperación de Espacios
        </p>
        <p
          className="mt-5 text-[1.05rem] max-w-2xl"
          style={{ color: "var(--color-piedra)" }}
        >
          Acompañamos a residentes, autónomos, PYMEs, asociaciones y
          ayuntamientos canarios en el cuidado, defensa y recuperación de los
          espacios que compartimos — físicos, simbólicos y de información
          pública. Lo hacemos abriendo datos, dando consultoría asequible y
          construyendo recursos cívicos en abierto.
        </p>
      </section>

      <div className="divisor my-10" />

      {/* Cuatro puertas — las secciones del header */}
      <section aria-labelledby="puertas">
        <h2
          id="puertas"
          className="display text-[1.3rem] mb-2"
          style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
        >
          Por dónde entrar
        </h2>
        <p
          className="text-[0.95rem] mt-1 mb-6"
          style={{ color: "var(--color-piedra)" }}
        >
          Cuatro puertas, una organización. Elige según lo que necesites.
        </p>

        <ol
          className="mt-5 space-y-6 list-none p-0 m-0"
          style={{ counterReset: "puerta" }}
        >
          <Puerta
            indice={1}
            href="/demos-ios"
            titulo="Demos iOS"
            lema="Si vienes a la comunidad"
          >
            La suite cívica de OCRE: <em>STOA</em> para el día a día del
            barrio, <em>Ágora</em> para deliberar, <em>Bibliotheka</em>{" "}
            para documentar, y <em>POLIS</em> para mirar y trazar el
            territorio. Se entra con cuenta y se sale habiendo aportado
            algo.
          </Puerta>

          <Puerta
            indice={2}
            href="/canarias-en-datos"
            titulo="Canarias en Datos"
            lema="Si quieres ver el archipiélago"
          >
            Visor abierto de la provincia 35 — Gran Canaria, Fuerteventura y
            Lanzarote — con capas de viviendas vacacionales, renta media,
            patrimonio BIC, centros educativos y más. Filtra, descarga y
            cita. Iremos sumando indicadores nuevos cada semana.
          </Puerta>

          <Puerta
            indice={3}
            href="/consultorias"
            titulo="Consultorías"
            lema="Si necesitas que te acompañemos"
          >
            Asesoría para ayuntamientos, asociaciones, autónomos y empresas
            con compromiso social en Canarias. Apertura de datos,
            urbanismo, vivienda turística, participación ciudadana,
            visualización territorial. Primer contacto sin compromiso.
          </Puerta>

          <Puerta
            indice={4}
            href="/sobre-ocre"
            titulo="Sobre OCRE"
            lema="Si quieres saber quiénes somos"
          >
            Quiénes formamos la organización, cómo nos financiamos, cómo
            entendemos la palabra «común» y por qué pensamos que recuperar
            el espacio empieza por verlo bien. Transparencia, no marketing.
          </Puerta>
        </ol>
      </section>

      <div className="divisor my-10" />

      {/* Cierre */}
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
          Recuperamos virtualmente el espacio antes de reclamarlo en la calle.
        </p>
        <p
          className="mt-3 text-[0.9rem]"
          style={{ color: "var(--color-piedra)" }}
        >
          OCRE opera el dominio <code>demosios.eu</code> como plataforma cívica
          de servicios. Si quieres entender la decisión, pásate por{" "}
          <Link
            href="/sobre-ocre"
            className="underline"
            style={{ color: "var(--color-ocre-deep)", fontWeight: 600 }}
          >
            Sobre OCRE
          </Link>
          .
        </p>
      </section>
    </div>
  );
}

function Puerta({
  indice,
  href,
  titulo,
  lema,
  children,
}: {
  indice: number;
  href: string;
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
