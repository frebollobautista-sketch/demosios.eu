export const metadata = {
  title: "Sobre OCRE",
  description:
    "OCRE — Una plataforma cívica gamificada para recuperar el sentido de lo público y transformar la manera en que nos relacionamos con la política.",
};

export default function NosotrosPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 pb-40">
      <div className="eyebrow">Sobre OCRE</div>
      <h1
        className="display mt-1 text-[clamp(1.8rem,3.6vw,2.4rem)]"
        style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
      >
        Política que se juega, no que se sufre
      </h1>

      <p
        className="mt-5 max-w-2xl text-[1.05rem] leading-relaxed"
        style={{ color: "var(--color-piedra)" }}
      >
        Las redes sociales nos prometieron conexión y nos dejaron con
        indiferencia. Scroll infinito, indignación de usar y tirar, la
        sensación de que todo da igual. Esa parálisis tiene nombre antiguo
        — <em>ataraxia</em> — y un efecto muy moderno: millones de personas
        convencidas de que la política no va con ellas.
      </p>

      <p
        className="mt-4 max-w-2xl text-[1.05rem] leading-relaxed"
        style={{ color: "var(--color-piedra)" }}
      >
        <strong style={{ color: "var(--color-ocre-deep)" }}>OCRE</strong> nace
        para romper ese ciclo. No somos una red social más, ni un foro de
        debate, ni una app de firmas. Somos una{" "}
        <strong style={{ color: "var(--color-ocre-deep)" }}>
          plataforma cívica gamificada
        </strong>
        : un espacio donde participar en lo público se siente como avanzar en
        un juego, no como gritar al vacío.
      </p>

      <div className="divisor my-10" />

      <section className="space-y-6">
        <div className="eyebrow">Cómo funciona</div>
        <h2
          className="display mt-1 text-[1.4rem]"
          style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
        >
          Tres capas, un propósito
        </h2>

        <p
          className="mt-2 text-[0.97rem] leading-relaxed"
          style={{ color: "var(--color-piedra)" }}
        >
          La plataforma se organiza en tres espacios complementarios. El{" "}
          <strong style={{ color: "var(--color-ocre-deep)" }}>Ágora</strong> es
          donde se debate y se delibera: propuestas vecinales, consultas
          ciudadanas, conversaciones que van a algún sitio. La{" "}
          <strong style={{ color: "var(--color-ocre-deep)" }}>Bibliotheka</strong>{" "}
          reúne el conocimiento compartido: datos abiertos, recursos públicos,
          documentación sobre el territorio. Y{" "}
          <strong style={{ color: "var(--color-ocre-deep)" }}>Polis</strong> es
          la capa territorial: un visor 3D interactivo de tu ciudad, tu barrio,
          tu calle — donde la información deja de ser abstracta y se convierte
          en mapa.
        </p>

        <p
          className="mt-3 text-[0.97rem] leading-relaxed"
          style={{ color: "var(--color-piedra)" }}
        >
          Cada acción — proponer, votar, documentar, mapear — suma puntos y
          desbloquea niveles dentro de un{" "}
          <em className="display italic" style={{ color: "var(--color-ocre-deep)" }}>
            cursus honorum
          </em>{" "}
          cívico: una carrera de reconocimiento basada en lo que aportas a tu
          comunidad, no en cuántos seguidores acumulas. La gamificación no es
          un adorno; es el mecanismo que transforma la participación ocasional
          en hábito.
        </p>
      </section>

      <div className="divisor my-10" />

      <section className="space-y-6">
        <div className="eyebrow">Por qué existe</div>
        <h2
          className="display mt-1 text-[1.4rem]"
          style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
        >
          Porque lo público merece mejores herramientas
        </h2>

        <p
          className="mt-2 text-[0.97rem] leading-relaxed"
          style={{ color: "var(--color-piedra)" }}
        >
          Tenemos apps para pedir comida, para encontrar pareja, para invertir
          en bolsa. Pero para decidir qué pasa con el solar de tu barrio, con
          el presupuesto de tu ayuntamiento o con el plan de movilidad de tu
          isla, las herramientas siguen siendo un PDF colgado en una web
          institucional y un buzón de sugerencias. OCRE quiere cerrar esa
          brecha: darle a la participación ciudadana la misma calidad de
          experiencia que damos por sentada en todo lo demás.
        </p>
      </section>

      <div className="divisor my-10" />

      {/* Equipo */}
      <section aria-labelledby="equipo">
        <div className="eyebrow">Quién hay detrás</div>
        <h2
          id="equipo"
          className="display mt-1 text-[1.4rem]"
          style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
        >
          Un proyecto asociativo, abierto a quien quiera sumar
        </h2>
        <p
          className="mt-2 text-[0.95rem]"
          style={{ color: "var(--color-piedra)" }}
        >
          OCRE es, por ahora, un proyecto personal con vocación colectiva.
          Nace de una convicción: que las herramientas digitales pueden
          acercar a la gente a la política en lugar de alejarla.
        </p>

        <ul className="mt-5 grid gap-3 list-none p-0 m-0">
          <MiembroEquipo
            nombre="Francisco Rebollo Bautista"
            cargo="Fundador"
            descripcion="Analista de políticas públicas y relaciones internacionales con experiencia profesional en el extranjero. Dedica su tiempo libre a construir OCRE como proyecto asociativo, convencido de que se puede cambiar la manera en que percibimos e interactuamos con la política — empezando por las herramientas que usamos para participar en ella."
          />
        </ul>
      </section>
    </div>
  );
}

function MiembroEquipo({
  nombre,
  cargo,
  descripcion,
}: {
  nombre: string;
  cargo: string;
  descripcion: string;
}) {
  return (
    <li
      className="rounded-xl p-4 flex items-start gap-4"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-linea)",
      }}
    >
      <span
        aria-hidden
        className="inline-flex items-center justify-center rounded-full shrink-0"
        style={{
          width: 48,
          height: 48,
          background: "var(--color-siena)",
          color: "var(--color-surface)",
          fontFamily: "var(--font-serif-stack)",
          fontSize: "1.1rem",
          fontWeight: 700,
        }}
      >
        {nombre.charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <div
          className="display text-[1.05rem]"
          style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
        >
          {nombre}
        </div>
        <div
          className="eyebrow"
          style={{ color: "var(--color-ocre-deep)" }}
        >
          {cargo}
        </div>
        <p
          className="mt-2 text-[0.88rem]"
          style={{ color: "var(--color-piedra)" }}
        >
          {descripcion}
        </p>
      </div>
    </li>
  );
}

