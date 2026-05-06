import Link from "next/link";

export const metadata = {
  title: "Canarias en Datos",
  description:
    "Visor abierto de la provincia 35 (Gran Canaria, Fuerteventura y Lanzarote): viviendas vacacionales, edificios, secciones censales y más. Filtra, descarga y cita.",
};

/**
 * /canarias-en-datos — landing del visor cívico de datos territoriales.
 *
 * Decisión 2026-05-06: el motor del visor (anteriormente "POLIS") aparece
 * aquí sin marca explícita. La marca POLIS se reserva para la parte
 * gamificada (paseo por el barrio) bajo /recursos. El embed apunta a
 * /polis-provincia.html que sigue siendo el archivo standalone MapLibre
 * en public/, mismo patrón que ya estaba pero renombrado conceptualmente.
 *
 * Estructura preparada para añadir, en iteraciones siguientes:
 *  - panel de filtros lateral (renta, edad, vivienda vacacional, BIC, etc.)
 *  - generación de informes citables a partir del estado del visor
 *  - exportación CSV/GeoJSON del subset visible
 */
export default function CanariasEnDatosPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 pb-24">
      <div className="eyebrow">Datos abiertos · provincia 35</div>
      <h1
        className="display mt-2 text-[clamp(1.8rem,4vw,2.4rem)]"
        style={{ color: "var(--color-papiro-ink)", lineHeight: 1.05 }}
      >
        Canarias en Datos
      </h1>
      <p
        className="mt-4 text-[1.05rem] max-w-3xl"
        style={{ color: "var(--color-piedra)" }}
      >
        Visor abierto de Gran Canaria, Fuerteventura y Lanzarote. 128.215
        edificios en 690 secciones censales, capas de carreteras, parques,
        agua, costa y POIs, y un catálogo creciente de indicadores cívicos
        que iremos publicando cada mes — empezando por viviendas
        vacacionales.
      </p>

      <div className="my-6 flex flex-wrap gap-3 text-[0.85rem]">
        <a
          href="/polis-provincia.html"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 rounded-md font-semibold"
          style={{
            background: "var(--color-ocre-deep)",
            color: "var(--color-surface)",
          }}
        >
          Abrir el visor a pantalla completa ↗
        </a>
        <Link
          href="/canarias-en-datos/indicadores"
          className="px-4 py-2 rounded-md"
          style={{
            border: "1px solid var(--color-linea)",
            color: "var(--color-papiro-ink)",
          }}
        >
          Catálogo de indicadores
        </Link>
      </div>

      {/* Embed del visor */}
      <section
        className="overflow-hidden rounded-xl"
        style={{
          border: "1px solid var(--color-linea)",
          background: "#0a0806",
          aspectRatio: "16 / 10",
          minHeight: "480px",
        }}
      >
        <iframe
          src="/polis-provincia.html"
          title="Visor Canarias en Datos"
          className="block w-full h-full"
          style={{ border: 0 }}
          loading="lazy"
        />
      </section>

      <p
        className="mt-3 text-[0.8rem]"
        style={{ color: "var(--color-piedra-clara)" }}
      >
        El visor funciona mejor en pantalla completa. Si vas a explorar a
        fondo o a generar imágenes para una presentación,{" "}
        <a
          href="/polis-provincia.html"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
          style={{ color: "var(--color-ocre-deep)" }}
        >
          ábrelo en pestaña aparte
        </a>
        .
      </p>

      <div className="divisor my-10" />

      <section className="grid gap-6 sm:grid-cols-2">
        <Bloque titulo="Capas activas hoy">
          <ul
            className="text-[0.92rem] list-disc pl-5 space-y-1"
            style={{ color: "var(--color-piedra)", lineHeight: 1.55 }}
          >
            <li>Edificios 3D (128.215 polígonos extruidos por altura)</li>
            <li>Secciones censales (709, INE 2019)</li>
            <li>Municipios (34, prov. 35)</li>
            <li>OSM: carreteras, parques, agua, costa, POIs</li>
            <li>
              <strong>Vivienda vacacional</strong> · 24.884 establecimientos
              registrados (Registro Gral. Turístico, datos.canarias.es)
            </li>
          </ul>
        </Bloque>

        <Bloque titulo="Próximos indicadores">
          <ul
            className="text-[0.92rem] list-disc pl-5 space-y-1"
            style={{ color: "var(--color-piedra)", lineHeight: 1.55 }}
          >
            <li>BIC — Bienes de Interés Cultural (patrimonio)</li>
            <li>Renta media por sección censal (INE)</li>
            <li>Calidad del aire en tiempo real (5 estaciones LPGC)</li>
            <li>Guaguas: paradas, líneas y huella de cobertura (GTFS)</li>
            <li>PGOU — zonificación urbanística (SITCAN)</li>
            <li>Catastro enriquecido (año, superficie, uso)</li>
          </ul>
        </Bloque>
      </section>

      <div className="divisor my-10" />

      <section
        className="rounded-xl p-6"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-linea)",
        }}
      >
        <h2
          className="display text-[1.15rem]"
          style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
        >
          Cómo citar
        </h2>
        <p
          className="mt-2 text-[0.92rem] max-w-3xl"
          style={{ color: "var(--color-piedra)", lineHeight: 1.55 }}
        >
          Si usas datos visualizados aquí en un trabajo, informe o publicación,
          la convención es citar tanto la fuente original (INE, datos.canarias.es,
          OSM, Catastro…) como el procesamiento de OCRE. Cada capa lleva una
          etiqueta de procedencia visible. Estamos preparando una función para
          generar informes y exportaciones citables directamente desde el visor.
        </p>
      </section>
    </div>
  );
}

function Bloque({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-lg p-5"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-linea)",
      }}
    >
      <h3
        className="display text-[1.05rem] mb-3"
        style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
      >
        {titulo}
      </h3>
      {children}
    </div>
  );
}
