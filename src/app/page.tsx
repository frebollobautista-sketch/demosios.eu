import Link from "next/link";
import { NavegadorTerritorio } from "@/components/NavegadorTerritorio";
import { EJES } from "@/lib/capital/ejes";

export default function InicioPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 pb-40">
      {/* hero sobrio */}
      <section className="relative">
        <div className="eyebrow">Organización Canaria para la Recuperación de Espacios</div>
        <h1
          className="display mt-2 text-[clamp(1.8rem,4.2vw,2.8rem)]"
          style={{ color: "var(--color-papiro-ink)", lineHeight: 1.1 }}
        >
          Una ventanilla única del común, por isla y por barrio.
        </h1>
        <p
          className="mt-4 max-w-2xl text-[1rem] md:text-[1.05rem]"
          style={{ color: "var(--color-piedra)" }}
        >
          OCRE recupera virtualmente el espacio antes de reclamarlo en la
          calle. Mapeamos qué bloques están en manos del interés
          privado-corporativo y cuáles podrían volver al común. Entras por
          donde vives: isla, municipio, barrio. Te acompaña un perfil con
          <span style={{ color: "var(--color-ocre-deep)", fontWeight: 600 }}>
            {" "}tres formas de capital
          </span>{" "}
          que crece con lo que aportas.
        </p>
      </section>

      <div className="divisor my-10" />

      {/* Navegador territorial */}
      <section aria-labelledby="territorio">
        <div className="flex items-baseline justify-between mb-3">
          <h2
            id="territorio"
            className="display text-[1.25rem]"
            style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
          >
            Entrar por tu territorio
          </h2>
          <span
            className="eyebrow"
            style={{ color: "var(--color-piedra-clara)" }}
          >
            Isla · Municipio · Barrio
          </span>
        </div>
        <NavegadorTerritorio />
      </section>

      <div className="divisor my-12" />

      {/* Tres ejes como presentación */}
      <section aria-labelledby="ejes">
        <h2
          id="ejes"
          className="display text-[1.25rem] mb-2"
          style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
        >
          Tres formas de capital ciudadano
        </h2>
        <p
          className="max-w-2xl text-[0.95rem] mb-6"
          style={{ color: "var(--color-piedra)" }}
        >
          Heredadas de PHAROS. No confundir con capital económico: aquí se mide
          lo que sostiene el común.
        </p>
        <ul className="grid md:grid-cols-3 gap-4">
          {EJES.map((e) => (
            <li
              key={e.id}
              className="rounded-xl p-5"
              style={{
                background: e.colorTenue,
                border: "1px solid var(--color-linea)",
              }}
            >
              <div
                className="display italic text-[1.4rem]"
                style={{ color: e.color, fontWeight: 600 }}
              >
                {e.nombreGriego}
              </div>
              <div
                className="eyebrow mt-0.5"
                style={{ color: e.color, opacity: 0.75 }}
              >
                {e.nombre}
              </div>
              <p
                className="mt-3 text-[0.92rem]"
                style={{ color: "var(--color-papiro-ink)" }}
              >
                {e.descripcion}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <div className="divisor my-12" />

      {/* Puertas de entrada rápidas a las 3 secciones */}
      <section aria-labelledby="puertas">
        <h2
          id="puertas"
          className="display text-[1.25rem] mb-4"
          style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
        >
          Las tres puertas de OCRE
        </h2>
        <div className="grid md:grid-cols-3 gap-3">
          <Puerta
            href="/agora"
            eyebrow="Ἀγορά"
            titulo="Ágora"
            texto="Deliberación pública, hilos por sección. Aquí se acuerda qué hacer."
          />
          <Puerta
            href="/bibliotheka"
            eyebrow="Βιβλιοθήκη"
            titulo="Bibliotheka"
            texto="Cursus honorum de videos ciudadanos y τὰ Κοινά: recursos del común."
          />
          <Puerta
            href="/polis"
            eyebrow="Πόλις"
            titulo="Polis"
            texto="Mapa de espacios, tipo de capital por bloque, candidatos a recuperación."
          />
        </div>
      </section>
    </div>
  );
}

function Puerta({
  href,
  eyebrow,
  titulo,
  texto,
}: {
  href: string;
  eyebrow: string;
  titulo: string;
  texto: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl p-5 transition-colors"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-linea)",
      }}
    >
      <div
        className="display italic text-[0.9rem]"
        style={{ color: "var(--color-ocre-deep)" }}
      >
        {eyebrow}
      </div>
      <div
        className="display mt-0.5 text-[1.25rem]"
        style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
      >
        {titulo}
      </div>
      <p
        className="mt-2 text-[0.9rem]"
        style={{ color: "var(--color-piedra)" }}
      >
        {texto}
      </p>
    </Link>
  );
}
