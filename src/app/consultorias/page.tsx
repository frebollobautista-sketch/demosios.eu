import Link from "next/link";

export const metadata = {
  title: "Consultorías",
  description:
    "Asesoría cívica de OCRE para ayuntamientos, asociaciones y profesionales en Canarias: apertura de datos, urbanismo, vivienda turística, participación ciudadana.",
};

/**
 * /consultorias — vitrina de servicios de consultoría de OCRE.
 *
 * Estado: placeholder estructural. Iremos añadiendo casos, tarifas
 * orientativas y formulario de contacto. La idea es que el header dé
 * acceso directo desde el primer momento aunque el contenido aún sea
 * incompleto, para reservar el espacio de marca.
 */
export default function ConsultoriasPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 pb-24">
      <div className="eyebrow">OCRE · Consultorías</div>
      <h1
        className="display mt-2 text-[clamp(1.8rem,4vw,2.4rem)]"
        style={{ color: "var(--color-papiro-ink)", lineHeight: 1.05 }}
      >
        Acompañamos a quien trabaja por lo común en Canarias.
      </h1>
      <p
        className="mt-5 text-[1.05rem] max-w-2xl"
        style={{ color: "var(--color-piedra)" }}
      >
        OCRE ofrece consultoría asequible a ayuntamientos, cabildos,
        asociaciones, autónomos y PYMEs canarios sobre los temas en los que
        nuestro trabajo cívico se solapa con sus necesidades operativas. No
        somos un despacho de servicios: somos una organización con red, datos
        propios y posición pública.
      </p>

      <div className="divisor my-10" />

      <h2
        className="display text-[1.3rem] mb-4"
        style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
      >
        Áreas de trabajo
      </h2>

      <ul className="grid gap-4 sm:grid-cols-2">
        <Tarjeta
          titulo="Apertura de datos"
          descripcion="Diagnóstico, formato (CSV/GeoJSON/API), licencias y ciclo de actualización. Dejamos el dataset publicado, citable y sostenible."
        />
        <Tarjeta
          titulo="Vivienda y turismo"
          descripcion="Análisis territorial cruzado de viviendas vacacionales, padrón y planeamiento. Datos brutos auditables."
        />
        <Tarjeta
          titulo="Participación ciudadana"
          descripcion="Diseño de procesos deliberativos. Acompañamos desde la convocatoria hasta el informe final con devolución pública."
        />
        <Tarjeta
          titulo="Visualización territorial"
          descripcion="Mapas a medida sobre la base de Canarias en Datos. Capas interactivas embebibles en la web del cliente."
        />
        <Tarjeta
          titulo="Formación cívica"
          descripcion="Talleres de alfabetización en datos públicos para personal técnico, asociaciones vecinales y centros educativos."
        />
        <Tarjeta
          titulo="Auditoría de cumplimiento"
          descripcion="Revisión de obligaciones de publicidad activa según Ley 19/2013 de transparencia, con plan de subsanación."
        />
      </ul>

      <div className="divisor my-10" />

      <section
        className="rounded-xl p-6 text-center"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-linea)",
        }}
      >
        <h2
          className="display text-[1.15rem]"
          style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
        >
          ¿Tu organización necesita acompañamiento?
        </h2>
        <p
          className="mt-3 text-[0.95rem] max-w-2xl mx-auto"
          style={{ color: "var(--color-piedra)" }}
        >
          Cuéntanos qué hace falta y te respondemos con una propuesta de
          alcance, calendario y coste orientativo. Primer contacto sin
          compromiso.
        </p>
        <p
          className="mt-5 text-[0.85rem]"
          style={{ color: "var(--color-piedra-clara)" }}
        >
          Mientras montamos el formulario directo, escríbenos a{" "}
          <a
            href="mailto:hola@demosios.eu"
            className="underline"
            style={{ color: "var(--color-ocre-deep)", fontWeight: 600 }}
          >
            hola@demosios.eu
          </a>
          .
        </p>
        <p
          className="mt-3 text-[0.8rem]"
          style={{ color: "var(--color-piedra-clara)" }}
        >
          ¿Aún explorando? Pasa por{" "}
          <Link
            href="/canarias-en-datos"
            className="underline"
            style={{ color: "var(--color-ocre-deep)" }}
          >
            Canarias en Datos
          </Link>{" "}
          o lee{" "}
          <Link
            href="/sobre-ocre"
            className="underline"
            style={{ color: "var(--color-ocre-deep)" }}
          >
            Sobre OCRE
          </Link>
          .
        </p>
      </section>
    </div>
  );
}

function Tarjeta({
  titulo,
  descripcion,
}: {
  titulo: string;
  descripcion: string;
}) {
  return (
    <li
      className="rounded-lg p-4"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-linea)",
      }}
    >
      <h3
        className="display text-[1.05rem] mb-1"
        style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
      >
        {titulo}
      </h3>
      <p
        className="text-[0.92rem]"
        style={{ color: "var(--color-piedra)", lineHeight: 1.5 }}
      >
        {descripcion}
      </p>
    </li>
  );
}
