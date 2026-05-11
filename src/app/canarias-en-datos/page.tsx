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

      <section className="space-y-6">
        <Bloque titulo="Base territorial (siempre visible)">
          <ul
            className="text-[0.92rem] list-disc pl-5 space-y-1"
            style={{ color: "var(--color-piedra)", lineHeight: 1.55 }}
          >
            <li>Edificios 3D — 128.215 polígonos extruidos por altura</li>
            <li>Secciones censales — 709, INE 2019</li>
            <li>Municipios — 34 de la provincia 35</li>
            <li>OSM — carreteras, parques, agua, costa, POIs</li>
          </ul>
        </Bloque>

        <Bloque titulo="Indicadores cívicos — hoja de ruta de 10 capas">
          <p
            className="text-[0.88rem] mb-4"
            style={{ color: "var(--color-piedra-clara)" }}
          >
            Cinco categorías × dos indicadores. Activa los que necesites desde el
            botón <em>🗂️ Capas</em> del visor. Las próximas se publican
            progresivamente.
          </p>
          <Categoria
            titulo="Vivienda y turismo"
            items={[
              { name: "Vivienda vacacional", source: "Registro Gral. Turístico · datos.canarias.es", ready: true, color: "#e07a3a" },
              { name: "Renta media por sección censal", source: "INE · Atlas de Distribución de Renta · 698 secciones prov 35", ready: true, color: "#9a5aaa" },
            ]}
          />
          <Categoria
            titulo="Patrimonio y cultura"
            items={[
              { name: "BIC — Bienes de Interés Cultural", source: "GRAFCAN · D.G. Patrimonio Cultural", ready: true, color: "#c44a4a" },
              { name: "Yacimientos arqueológicos", source: "datos.canarias.es", ready: false, color: "#8a4a2a" },
            ]}
          />
          <Categoria
            titulo="Movilidad y transporte"
            items={[
              { name: "Guaguas Municipales LPGC: paradas + líneas", source: "GTFS · 848 paradas · 47 líneas", ready: true, color: "#3da06a" },
              { name: "Cobertura transporte LPGC (300 m)", source: "derivado · 41,6 km² cubiertos", ready: true, color: "#5dc88a" },
            ]}
          />
          <Categoria
            titulo="Demografía"
            items={[
              { name: "Población por sección censal", source: "INE · Padrón continuo", ready: false, color: "#5a8aa8" },
              { name: "Densidad demográfica (hab/km²)", source: "derivado población × área", ready: false, color: "#7aa5c0" },
            ]}
          />
          <Categoria
            titulo="Equipamientos"
            items={[
              { name: "Centros educativos", source: "Consejería Educación · datos.canarias.es", ready: true, color: "#5a90c0" },
              { name: "Centros sanitarios (hospitales, salud, urgencias)", source: "GRAFCAN · Mapa Sanitario SCS", ready: true, color: "#c8d05a" },
            ]}
          />
          <Categoria
            titulo="Desigualdades cívicas"
            items={[
              { name: "Listas de espera quirúrgica SCS por isla", source: "ISTAC · SCS · 32.131 personas a dic 2025", ready: true, color: "#d4632a" },
            ]}
          />
          <Categoria
            titulo="Medio ambiente"
            items={[
              { name: "Estaciones de calidad del aire", source: "GRAFCAN · Red de Vigilancia Calidad Aire Canarias", ready: true, color: "#5acab0" },
            ]}
          />
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

function Categoria({
  titulo,
  items,
}: {
  titulo: string;
  items: { name: string; source: string; ready: boolean; color: string }[];
}) {
  return (
    <div className="mb-5 last:mb-0">
      <div
        className="eyebrow mb-2"
        style={{ color: "var(--color-piedra-clara)" }}
      >
        {titulo}
      </div>
      <ul className="space-y-1.5 list-none p-0 m-0">
        {items.map((it) => (
          <li
            key={it.name}
            className="flex items-start gap-2.5 text-[0.9rem]"
            style={{
              color: it.ready
                ? "var(--color-papiro-ink)"
                : "var(--color-piedra-clara)",
              lineHeight: 1.5,
            }}
          >
            <span
              aria-hidden
              className="inline-block rounded-full mt-1.5 shrink-0"
              style={{
                width: 8,
                height: 8,
                background: it.color,
                opacity: it.ready ? 1 : 0.4,
              }}
            />
            <span className="flex-1">
              <strong style={{ fontWeight: it.ready ? 600 : 500 }}>
                {it.name}
              </strong>
              <span
                className="text-[0.78rem] ml-2"
                style={{ color: "var(--color-piedra-clara)" }}
              >
                {it.source}
              </span>
              {!it.ready && (
                <span
                  className="ml-2 text-[0.7rem] tracking-wider px-1.5 py-0.5 rounded"
                  style={{
                    background: "var(--color-papiro-soft)",
                    color: "var(--color-piedra)",
                    textTransform: "uppercase",
                  }}
                >
                  Próximamente
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
