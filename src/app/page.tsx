import Link from "next/link";

export default function InicioPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12 pb-40">
      {/* Hero */}
      <section className="relative">
        <div className="eyebrow">Demosios by OCRE</div>
        <h1
          className="display mt-2 text-[clamp(2rem,4.8vw,3rem)]"
          style={{ color: "var(--color-papiro-ink)", lineHeight: 1.05 }}
        >
          Una plataforma cívica canaria, por isla y por barrio.
        </h1>
        <p
          className="mt-5 text-[1.05rem]"
          style={{ color: "var(--color-piedra)" }}
        >
          Demosios es el lugar donde la{" "}
          <Link
            href="/nosotros"
            className="underline"
            style={{ color: "var(--color-ocre-deep)" }}
          >
            Organización Canaria para la Recuperación de Espacios
          </Link>{" "}
          articula tres funciones básicas de toda comunidad política:
          deliberar, acumular conocimiento, y cuidar el espacio que compartimos.
          Tres secciones, una por función.
        </p>
      </section>

      <div className="divisor my-10" />

      {/* Thread simple sobre las tres secciones */}
      <section aria-labelledby="secciones">
        <h2
          id="secciones"
          className="display text-[1.3rem] mb-2"
          style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
        >
          Cómo está organizado
        </h2>

        <ol
          className="mt-5 space-y-6 list-none p-0 m-0"
          style={{ counterReset: "seccion" }}
        >
          <BloqueSeccion
            indice={1}
            href="/agora"
            griego="Ἀγορά"
            titulo="Ágora"
            lema="Donde se habla"
          >
            La plaza pública digital. Ocho secciones temáticas heredadas de
            PHAROS (vivienda, trabajo, cambio climático, medios, común…) en
            las que los miembros abren hilos, responden, y se avalan entre
            sí. No hay algoritmo de engagement ni scroll infinito: se entra a
            hablar de algo concreto y se sale cuando se ha dicho.
          </BloqueSeccion>

          <BloqueSeccion
            indice={2}
            href="/bibliotheka"
            griego="Βιβλιοθήκη"
            titulo="Bibliotheka"
            lema="Donde queda registrado"
          >
            La memoria de lo dicho y lo hecho, en dos alas. El{" "}
            <em className="display italic">Cursus honorum</em> es un canal de
            vídeos ciudadanos graduado por siete niveles cívicos con
            correspondencia profesional real. <em className="display italic">τὰ Κοινά</em>{" "}
            — «las cosas comunes» — es el repositorio de recursos del común:
            guías, plantillas, servicios vecinales, clasificados por las
            mismas ocho secciones del Ágora.
          </BloqueSeccion>

          <BloqueSeccion
            indice={3}
            href="/polis"
            griego="Πόλις"
            titulo="Polis"
            lema="Donde se actúa sobre el territorio"
          >
            El mapa-tablero del municipio. Cada barrio aparece coloreado por
            el tipo de capital que lo posee — común, residente, autónomo,
            rentista difuso, privado-corporativo. Los barrios con capital
            mayoritariamente corporativo quedan marcados como{" "}
            <strong>candidatos a recuperación</strong>. Pulsas cualquier
            barrio, ves su composición y actúas: abres hilo, publicas
            recurso, marcas bloque.
          </BloqueSeccion>
        </ol>
      </section>

      <div className="divisor my-10" />

      {/* CTA cerrar con enlace a nosotros */}
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
          Por dentro todavía somos pocos; por fuera, el archipiélago entero.
        </p>
        <p
          className="mt-3 text-[0.9rem]"
          style={{ color: "var(--color-piedra)" }}
        >
          Si quieres entender quién está detrás, hacia dónde va el proyecto y
          cómo se entiende «lo público» aquí, pasa por{" "}
          <Link
            href="/nosotros"
            className="underline"
            style={{ color: "var(--color-ocre-deep)", fontWeight: 600 }}
          >
            Nosotros
          </Link>
          .
        </p>
      </section>
    </div>
  );
}

function BloqueSeccion({
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
          style={{
            color: "var(--color-ocre-deep)",
            fontSize: "0.95rem",
          }}
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
