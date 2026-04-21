import { SECCIONES_SKIN, EJES_SKIN, KOINA_LATINO } from "@/lib/skins/nombres";

export const metadata = {
  title: "Nosotros",
  description:
    "OCRE — Organización Canaria para la Recuperación de Espacios. Misión, visión, valores y equipo detrás de Demosios.",
};

export default function NosotrosPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 pb-40">
      <div className="eyebrow">Sobre Demosios by OCRE</div>
      <h1
        className="display mt-1 text-[clamp(1.8rem,3.6vw,2.4rem)]"
        style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
      >
        El proyecto y la organización
      </h1>
      <p
        className="mt-4 max-w-2xl"
        style={{ color: "var(--color-piedra)" }}
      >
        <strong style={{ color: "var(--color-ocre-deep)" }}>Demosios</strong>{" "}
        (del griego <em className="display italic">δημόσιος</em>, «público») es
        la plataforma cívica que estás usando. La construye y sostiene{" "}
        <strong style={{ color: "var(--color-ocre-deep)" }}>OCRE</strong>, la
        Organización Canaria para la Recuperación de Espacios. La plataforma
        lleva el nombre de lo que quiere proteger. La organización lleva el
        nombre de lo que quiere hacer.
      </p>

      <div className="divisor my-10" />

      {/* Misión / Visión / Valores como bloques separados */}
      <section className="space-y-8">
        <Bloque titulo="Misión" eyebrow="Qué hacemos">
          <p style={{ color: "var(--color-piedra)" }}>
            <em
              className="display italic"
              style={{ color: "var(--color-piedra-clara)" }}
            >
              [Placeholder para redactar — una frase que diga para qué existe
              OCRE. Ejemplo: «Recuperar el espacio urbano canario del común,
              empezando por mapearlo, deliberarlo y articular a su gente.»]
            </em>
          </p>
        </Bloque>

        <Bloque titulo="Visión" eyebrow="Hacia dónde vamos">
          <p style={{ color: "var(--color-piedra)" }}>
            <em
              className="display italic"
              style={{ color: "var(--color-piedra-clara)" }}
            >
              [Placeholder — el horizonte largo. Ejemplo: «Una Canarias donde
              cada barrio sepa qué parte de su suelo está en manos del común y
              tenga los medios para ampliarlo.»]
            </em>
          </p>
        </Bloque>

        <Bloque titulo="Valores" eyebrow="Cómo trabajamos">
          <ul
            className="list-disc pl-5 space-y-2"
            style={{ color: "var(--color-piedra)" }}
          >
            <li>
              <em
                className="display italic"
                style={{ color: "var(--color-piedra-clara)" }}
              >
                [Placeholder — ejemplo: «Lo público antes que lo privado.
                Transparencia por defecto. Participación real, no consultiva.»]
              </em>
            </li>
          </ul>
        </Bloque>
      </section>

      <div className="divisor my-10" />

      {/* Equipo */}
      <section aria-labelledby="equipo">
        <div className="eyebrow">Equipo</div>
        <h2
          id="equipo"
          className="display mt-1 text-[1.4rem]"
          style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
        >
          Quiénes lo sostienen
        </h2>
        <p
          className="mt-2 text-[0.95rem]"
          style={{ color: "var(--color-piedra)" }}
        >
          Por ahora una persona al frente — luego, conforme sumen, se añaden.
        </p>

        <ul className="mt-4 grid gap-3 list-none p-0 m-0">
          <MiembroEquipo
            nombre="Pancho"
            cargo="Fundador · Dirección"
            descripcion="Origen de OCRE, del proyecto Demosios y de la tesis de las tres capas (Ágora · Bibliotheka · Polis). Pendiente de redactar bio más completa."
          />
        </ul>
      </section>

      <div className="divisor my-10" />

      {/* Explorador de skins */}
      <section aria-labelledby="skins">
        <div className="eyebrow">Nomenclatura</div>
        <h2
          id="skins"
          className="display mt-1 text-[1.4rem]"
          style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
        >
          Modo griego · modo aventura latino
        </h2>
        <p
          className="mt-3 text-[0.95rem]"
          style={{ color: "var(--color-piedra)" }}
        >
          Demosios usa por defecto nomenclatura griega clásica
          (Ágora, Bibliotheka, Polis). Un futuro <em>modo aventura</em> permitirá
          conmutar toda la plataforma a nomenclatura latina — cambiando
          únicamente las etiquetas visibles, no las rutas ni el código. El
          cursus honorum ya es latino de origen, así que encaja sin fricción.
          Aquí puedes previsualizar la correspondencia:
        </p>

        <div
          className="mt-5 rounded-xl overflow-hidden"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-linea)",
          }}
        >
          <table
            className="w-full text-[0.92rem]"
            style={{ borderCollapse: "collapse" }}
          >
            <thead>
              <tr
                style={{
                  background: "var(--color-papiro-soft)",
                }}
              >
                <Th>Concepto</Th>
                <Th>Griego (actual)</Th>
                <Th>Latino (aventura)</Th>
                <Th>Traducción</Th>
              </tr>
            </thead>
            <tbody>
              {SECCIONES_SKIN.filter((s) => s.slug !== "inicio").map((s) => (
                <tr
                  key={s.slug}
                  style={{ borderTop: "1px solid var(--color-linea)" }}
                >
                  <Td>Sección</Td>
                  <Td>
                    <span
                      className="display italic"
                      style={{ color: "var(--color-ocre-deep)" }}
                    >
                      {s.griego}
                    </span>
                    {s.griegoOriginal && (
                      <span
                        className="ml-1 text-[0.76rem]"
                        style={{ color: "var(--color-piedra-clara)" }}
                      >
                        {s.griegoOriginal}
                      </span>
                    )}
                  </Td>
                  <Td>
                    <span
                      className="display italic"
                      style={{ color: "var(--color-siena)" }}
                    >
                      {s.latino}
                    </span>
                  </Td>
                  <Td style={{ color: "var(--color-piedra)" }}>
                    {s.traduccion}
                  </Td>
                </tr>
              ))}
              <tr style={{ borderTop: "1px solid var(--color-linea)" }}>
                <Td>Recursos del común</Td>
                <Td>
                  <span
                    className="display italic"
                    style={{ color: "var(--color-ocre-deep)" }}
                  >
                    {KOINA_LATINO.griego}
                  </span>
                </Td>
                <Td>
                  <span
                    className="display italic"
                    style={{ color: "var(--color-siena)" }}
                  >
                    {KOINA_LATINO.latino}
                  </span>
                </Td>
                <Td style={{ color: "var(--color-piedra)" }}>
                  las cosas comunes
                </Td>
              </tr>
              {EJES_SKIN.map((e) => (
                <tr
                  key={e.id}
                  style={{ borderTop: "1px solid var(--color-linea)" }}
                >
                  <Td>Eje de capital</Td>
                  <Td>
                    <span
                      className="display italic"
                      style={{ color: "var(--color-ocre-deep)" }}
                    >
                      {e.griego}
                    </span>
                  </Td>
                  <Td>
                    <span
                      className="display italic"
                      style={{ color: "var(--color-siena)" }}
                    >
                      {e.latino}
                    </span>
                  </Td>
                  <Td style={{ color: "var(--color-piedra)" }}>
                    {e.id === "koinonia" && "capital social"}
                    {e.id === "paideia" && "capital cultural"}
                    {e.id === "politeia" && "capital político"}
                  </Td>
                </tr>
              ))}
              <tr style={{ borderTop: "1px solid var(--color-linea)" }}>
                <Td>Carrera cívica</Td>
                <Td colSpan={2}>
                  <span
                    className="display italic"
                    style={{ color: "var(--color-ocre-deep)" }}
                  >
                    Cursus honorum
                  </span>{" "}
                  <span
                    className="text-[0.78rem]"
                    style={{ color: "var(--color-piedra-clara)" }}
                  >
                    (ya es latino, no cambia)
                  </span>
                </Td>
                <Td style={{ color: "var(--color-piedra)" }}>
                  escala de grados
                </Td>
              </tr>
            </tbody>
          </table>
        </div>

        <p
          className="mt-4 text-[0.85rem]"
          style={{ color: "var(--color-piedra-clara)" }}
        >
          El modo aventura todavía no está activado como toggle en la interfaz.
          Cuando lo cableemos vivirá en tus ajustes como «Nomenclatura:
          griego / latino».
        </p>
      </section>
    </div>
  );
}

function Bloque({
  titulo,
  eyebrow,
  children,
}: {
  titulo: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="eyebrow">{eyebrow}</div>
      <h2
        className="display mt-1 text-[1.2rem]"
        style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
      >
        {titulo}
      </h2>
      <div
        className="mt-2 rounded-lg p-4"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-linea)",
        }}
      >
        {children}
      </div>
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

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="text-left"
      style={{
        padding: "0.625rem 0.875rem",
        fontSize: "0.72rem",
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: "var(--color-piedra)",
        fontWeight: 600,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  colSpan,
  style,
}: {
  children: React.ReactNode;
  colSpan?: number;
  style?: React.CSSProperties;
}) {
  return (
    <td
      colSpan={colSpan}
      style={{
        padding: "0.625rem 0.875rem",
        verticalAlign: "top",
        ...style,
      }}
    >
      {children}
    </td>
  );
}
