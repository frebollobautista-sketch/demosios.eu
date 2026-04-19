import { IconMap } from "@/components/Icons";

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

      <section>
        <h2
          className="display text-[1.1rem] mb-3"
          style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
        >
          Tipología de bloques
        </h2>
        <ul className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
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
          style={{ background: "var(--color-surface)", color: "var(--color-ocre-deep)" }}
        >
          <IconMap />
        </div>
        <p
          className="display italic mt-3 text-[1rem]"
          style={{ color: "var(--color-papiro-ink)" }}
        >
          El mapa interactivo aterrizará aquí.
        </p>
        <p className="mt-2 max-w-xl mx-auto text-[0.9rem]">
          Se apoyará en el digitalizador urbano pixel art de KOINOS (POLIS) y
          en las fuentes abiertas de catastro y OSM. Las piezas técnicas
          existen; queda el ensamblaje.
        </p>
      </section>
    </div>
  );
}
