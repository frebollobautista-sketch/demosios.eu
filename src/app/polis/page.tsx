import { IconMap } from "@/components/Icons";
import { MapaBarrios } from "@/components/MapaBarrios";
import { CANARIAS } from "@/lib/territorio/canarias";

type TipoBloque = {
  id: string;
  label: string;
  color: string;
  descripcion: string;
  aptoRecuperacion: boolean;
};

/**
 * Tipología primaria del capital que posee un bloque. La distinción
 * clave de OCRE: los bloques mayoritariamente en capital privado-
 * corporativo (fondo buitre, SOCIMI, vacacional opaco) son candidatos
 * a recuperación. Los demás ya están, en algún grado, en manos del
 * común.
 */
const TIPOS: TipoBloque[] = [
  {
    id: "comun",
    label: "Común",
    color: "var(--color-oliva)",
    descripcion:
      "Propiedad cooperativa, comunal, pública de uso o cesión de uso.",
    aptoRecuperacion: false,
  },
  {
    id: "residente",
    label: "Residente",
    color: "var(--color-ocre)",
    descripcion:
      "Propiedad de pequeños tenedores que la habitan o la alquilan a residentes estables.",
    aptoRecuperacion: false,
  },
  {
    id: "autonomo",
    label: "Autónomo / PYME local",
    color: "var(--color-ambar)",
    descripcion:
      "Local u oficina de actividad productiva arraigada en el barrio.",
    aptoRecuperacion: false,
  },
  {
    id: "rentista",
    label: "Rentista difuso",
    color: "var(--color-siena)",
    descripcion:
      "Gran tenedor persona física con cartera de inmuebles en alquiler turístico u ocioso.",
    aptoRecuperacion: true,
  },
  {
    id: "corporativo",
    label: "Privado-corporativo",
    color: "var(--color-sangre)",
    descripcion:
      "Fondos buitre, SOCIMI, fondos de inversión, filiales de plataformas vacacionales.",
    aptoRecuperacion: true,
  },
];

export default function PolisPage() {
  // Por ahora el tablero arranca en Las Palmas de Gran Canaria.
  // Cuando tengamos datos para más municipios, añadimos un selector.
  const isla = CANARIAS.find((i) => i.id === "gran-canaria")!;
  const municipio = isla.municipios.find(
    (m) => m.id === "las-palmas-de-gran-canaria",
  )!;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 pb-40">
      <div className="eyebrow">Πόλις</div>
      <h1
        className="display mt-1 text-[clamp(1.6rem,3.5vw,2.2rem)]"
        style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
      >
        Polis
      </h1>
      <p
        className="mt-3 max-w-2xl"
        style={{ color: "var(--color-piedra)" }}
      >
        Mapa de la ciudad según la composición de capital de cada bloque.
        Recuperamos virtualmente lo que aún puede volver al común: los
        bloques cuyo capital mayoritario es privado-corporativo.
      </p>

      <div className="divisor my-8" />

      <section aria-labelledby="tablero">
        <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
          <h2
            id="tablero"
            className="display text-[1.15rem]"
            style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
          >
            Tablero de {municipio.nombre}
          </h2>
          <span
            className="eyebrow"
            style={{ color: "var(--color-piedra-clara)" }}
          >
            {isla.emoji} {isla.nombre} · {municipio.barrios.length} barrios
          </span>
        </div>
        <p
          className="text-[0.9rem] mb-4 max-w-2xl"
          style={{ color: "var(--color-piedra)" }}
        >
          Cada hexágono es un barrio, coloreado por el tipo de capital
          dominante en él. Los barrios con borde punteado y marca roja son
          <strong> candidatos a recuperación</strong> (&gt;30 % en manos
          rentistas o corporativas). Pulsa cualquier barrio para ver su
          composición completa y abrir acciones.
        </p>
        <MapaBarrios isla={isla} municipio={municipio} />
      </section>

      <div className="divisor my-12" />

      <section>
        <h2
          className="display text-[1.1rem] mb-3"
          style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
        >
          Tipología de bloques
        </h2>
        <ul className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 list-none p-0 m-0">
          {TIPOS.map((t) => (
            <li
              key={t.id}
              className="rounded-xl p-4"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-linea)",
                borderLeft: `3px solid ${t.color}`,
              }}
            >
              <div className="flex items-center justify-between">
                <div
                  className="display text-[1rem]"
                  style={{ color: t.color, fontWeight: 600 }}
                >
                  {t.label}
                </div>
                {t.aptoRecuperacion ? (
                  <span
                    className="eyebrow rounded-full px-2 py-0.5"
                    style={{
                      background: "var(--color-sangre)",
                      color: "var(--color-surface)",
                    }}
                  >
                    Candidato
                  </span>
                ) : (
                  <span
                    className="eyebrow rounded-full px-2 py-0.5"
                    style={{
                      background: "var(--color-papiro-soft)",
                      color: "var(--color-piedra)",
                    }}
                  >
                    En común
                  </span>
                )}
              </div>
              <p
                className="mt-2 text-[0.88rem]"
                style={{ color: "var(--color-papiro-ink)" }}
              >
                {t.descripcion}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <div className="divisor my-12" />

      <section
        className="rounded-xl p-6 text-center"
        style={{
          background: "var(--color-papiro-soft)",
          border: "1px dashed var(--color-linea)",
          color: "var(--color-piedra)",
        }}
      >
        <div
          className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full"
          style={{
            background: "var(--color-surface)",
            color: "var(--color-ocre-deep)",
          }}
        >
          <IconMap />
        </div>
        <p
          className="display italic mt-3 text-[1rem]"
          style={{ color: "var(--color-papiro-ink)" }}
        >
          El mapa geográfico real aterrizará aquí.
        </p>
        <p className="mt-2 max-w-xl mx-auto text-[0.9rem]">
          Por ahora el tablero es estilizado (hexágonos por barrio).
          Cuando acabemos de cablear el pipeline de Blender GIS + catastro
          + OSM documentado en KOINOS, sustituimos los hexágonos por la
          geometría real de bloques y parcelas.
        </p>
      </section>
    </div>
  );
}
