import Link from "next/link";

export const metadata = {
  title: "STOA",
  description:
    "El patio cívico de OCRE. Lo que pasa hoy en el barrio: posts cortos, sin algoritmo, sin scroll infinito.",
};

/**
 * /stoa — capa social ligera.
 *
 * Estado: hoja de ruta visible. La columna social la construimos en una
 * próxima iteración, sobre la tabla `posts` de la migración inicial. Esta
 * página existe ya para que la entrada del header esté viva (la gente la
 * descubre, ve qué será, decide si volverá).
 *
 * Decisión 2026-05-09 con Panch: STOA NO es Instagram. Es la columnata
 * cubierta de la polis griega — espacio de encuentro informal antes de
 * entrar al ágora. Posts cortos territoriales, sin algoritmo, sin
 * follower counts, sin DMs.
 */
export default function StoaPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 pb-24">
      <div className="eyebrow">Στοά · Demos iOS</div>
      <h1
        className="display mt-2 text-[clamp(1.8rem,4vw,2.4rem)]"
        style={{ color: "var(--color-papiro-ink)", lineHeight: 1.05 }}
      >
        STOA
      </h1>
      <p
        className="display italic mt-2 text-[1.05rem]"
        style={{ color: "var(--color-ocre-deep)" }}
      >
        El patio cívico — lo que pasa hoy en el barrio
      </p>
      <p
        className="mt-5 text-[1.05rem]"
        style={{ color: "var(--color-piedra)", lineHeight: 1.55 }}
      >
        En la antigua Atenas, la <strong>Stoá</strong> era la columnata
        cubierta donde la gente se encontraba antes de entrar al Ágora.
        Aquí no hay algoritmo de engagement, ni scroll infinito, ni
        contador público de seguidores. Hay posts cortos, ordenados por
        cuándo se publicaron, etiquetados por barrio para que sepas dónde
        está pasando cada cosa.
      </p>

      <div className="divisor my-10" />

      <section
        className="rounded-xl p-6"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-linea)",
        }}
      >
        <h2
          className="display text-[1.15rem] mb-4"
          style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
        >
          Qué será STOA cuando esté
        </h2>

        <ul
          className="space-y-3 text-[0.95rem]"
          style={{ color: "var(--color-piedra)", lineHeight: 1.55 }}
        >
          <li>
            <strong>Feed cronológico inverso</strong> — sin algoritmo de
            relevancia. Lo más reciente arriba, fin.
          </li>
          <li>
            <strong>Posts cortos</strong> (~280 caracteres) con foto
            opcional. Texto más largo va a Ágora.
          </li>
          <li>
            <strong>Etiqueta territorial</strong> — cada post lleva su
            barrio (LPGC, Vegueta, Telde…). Filtras por isla, municipio o
            barrio.
          </li>
          <li>
            <strong>PEC en lugar de like</strong> — el botón es 🤝
            <em>«estoy de acuerdo»</em>, no un corazón vacío. Reacción
            cualitativa.
          </li>
          <li>
            <strong>Comentarios cortos inline</strong> — para hablar
            despacio mejor abrir un hilo en Ágora.
          </li>
          <li>
            <strong>Sin DMs</strong>. Las conversaciones privadas se
            tienen por Telegram/Signal, no aquí. Esto es público o no es.
          </li>
          <li>
            <strong>Cruce con los demás ejes</strong> — al ver el perfil
            de alguien verás también sus hilos en Ágora, sus recursos en
            Bibliotheka y sus trazos en POLIS.
          </li>
        </ul>
      </section>

      <div className="divisor my-10" />

      <section
        className="rounded-xl p-5"
        style={{
          background: "var(--color-papiro-soft)",
          border: "1px solid var(--color-linea)",
        }}
      >
        <p
          className="text-[0.92rem]"
          style={{ color: "var(--color-piedra)", lineHeight: 1.55 }}
        >
          <strong>Mientras se construye STOA</strong>, ya puedes
          participar en{" "}
          <Link
            href="/agora"
            className="underline"
            style={{ color: "var(--color-ocre-deep)", fontWeight: 600 }}
          >
            Ágora
          </Link>{" "}
          (deliberación formal por sección PHAROS) o pasarte por{" "}
          <Link
            href="/canarias-en-datos"
            className="underline"
            style={{ color: "var(--color-ocre-deep)", fontWeight: 600 }}
          >
            Canarias en Datos
          </Link>{" "}
          (visor abierto del archipiélago).
        </p>
      </section>
    </div>
  );
}
