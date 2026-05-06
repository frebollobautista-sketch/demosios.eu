import Link from "next/link";
import { ConsultoriaForm } from "./ConsultoriaForm";

export const metadata = {
  title: "Consultorías",
  description:
    "OCRE — lobby social con base territorial en Canarias. Consultorías operativas y de dirección estratégica para instituciones, tercer sector, empresas y autónomos con compromiso social demostrable.",
};

/**
 * /consultorias — vitrina de servicios + formulario de solicitud.
 *
 * Decisión 2026-05-06 con Panch: definición pública de OCRE como "lobby
 * social con base territorial en Canarias". El formulario persiste a
 * Supabase (tabla `consultoria_solicitudes`, ver migración
 * 20260506130000_consultorias.sql) y permite hasta 5 adjuntos por
 * solicitud.
 */
export default function ConsultoriasPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 pb-24">
      <div className="eyebrow">OCRE · Consultorías</div>
      <h1
        className="display mt-2 text-[clamp(1.8rem,4vw,2.4rem)]"
        style={{ color: "var(--color-papiro-ink)", lineHeight: 1.05 }}
      >
        Acompañamos a quienes trabajan por lo común en Canarias.
      </h1>
      <p
        className="mt-5 text-[1.05rem]"
        style={{ color: "var(--color-piedra)", lineHeight: 1.55 }}
      >
        OCRE es un <strong>lobby social con base territorial en Canarias</strong>.
        Prestamos actualmente <em>consultorías operativas y de dirección
        estratégica</em> para instituciones, entes del tercer sector, así como
        empresas y autónomos con compromiso en valores sociales demostrable.
      </p>
      <p
        className="mt-3 text-[1rem]"
        style={{ color: "var(--color-piedra)", lineHeight: 1.55 }}
      >
        No somos un despacho de servicios genéricos: somos una organización con
        red, datos propios y posición pública. Cuando intervenimos lo hacemos
        cruzando lo técnico con lo cívico — y dejamos huella documental abierta
        siempre que el cliente lo permite.
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

      {/* Formulario */}
      <section
        aria-labelledby="formulario"
        className="rounded-xl p-6 sm:p-8"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-linea)",
        }}
      >
        <h2
          id="formulario"
          className="display text-[1.3rem]"
          style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
        >
          ¿Tu organización necesita acompañamiento?
        </h2>
        <p
          className="mt-2 mb-6 text-[0.95rem]"
          style={{ color: "var(--color-piedra)", lineHeight: 1.55 }}
        >
          Cuéntanos brevemente quién eres y qué necesitas. Te respondemos en
          un máximo de 5 días laborables con una propuesta de alcance,
          calendario y coste orientativo. Primer contacto sin compromiso.
        </p>

        <ConsultoriaForm />
      </section>

      <p
        className="mt-6 text-[0.85rem] text-center"
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
