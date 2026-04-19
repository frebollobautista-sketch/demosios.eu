import { Avatar } from "@/components/Avatar";
import { EJES } from "@/lib/capital/ejes";
import {
  agregarCapital,
  puntosTotales,
  ejeDominante,
} from "@/lib/capital/contribuciones";
import {
  CURSUS,
  gradoActual,
  proximoGrado,
  avanceHaciaProximo,
} from "@/lib/cursus/grados";
import { PERFIL_DEMO } from "@/lib/perfil/mock";
import { CANARIAS } from "@/lib/territorio/canarias";

export default function PerfilPage() {
  const perfil = PERFIL_DEMO;
  const puntos = agregarCapital(perfil.contribuciones);
  const total = puntosTotales(puntos);
  const dominante = ejeDominante(puntos);
  const grado = gradoActual(puntos);
  const proximo = proximoGrado(grado);
  const avance = Math.round(avanceHaciaProximo(puntos, grado) * 100);

  const isla = CANARIAS.find((i) => i.id === perfil.islaId);
  const muni = isla?.municipios.find((m) => m.id === perfil.municipioId);
  const barrio = muni?.barrios.find((b) => b.id === perfil.barrioId);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 pb-40">
      {/* Cabecera de perfil */}
      <section className="flex items-start gap-5">
        <Avatar
          inicial={perfil.avatarInicial}
          color={perfil.avatarColor}
          grado={grado}
          size={96}
        />
        <div className="min-w-0 flex-1">
          <div className="eyebrow" style={{ color: grado.color }}>
            {grado.nombreLatino} · {grado.traduccion}
          </div>
          <h1
            className="display mt-1 text-[clamp(1.5rem,3.2vw,2rem)]"
            style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
          >
            {perfil.nombre}{" "}
            <span
              className="display italic font-normal"
              style={{ color: "var(--color-piedra)" }}
            >
              @{perfil.handle}
            </span>
          </h1>
          <p
            className="display italic mt-1 text-[1rem]"
            style={{ color: grado.color }}
          >
            «{grado.lema}»
          </p>
          {barrio && (
            <p
              className="text-[0.88rem] mt-2"
              style={{ color: "var(--color-piedra)" }}
            >
              Vecina/o de {barrio.nombre} · {muni!.nombre} · {isla!.nombre}
            </p>
          )}
        </div>
      </section>

      <div className="divisor my-8" />

      {/* Capital en los tres ejes */}
      <section aria-labelledby="capital">
        <h2
          id="capital"
          className="display text-[1.15rem] mb-4"
          style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
        >
          Capital acumulado
        </h2>
        <ul className="grid md:grid-cols-3 gap-4">
          {EJES.map((e) => {
            const v = puntos[e.id];
            const pct = Math.min(100, Math.round((v / Math.max(total, 1)) * 100));
            const esDominante = dominante === e.id;
            return (
              <li
                key={e.id}
                className="rounded-xl p-5"
                style={{
                  background: esDominante ? e.colorTenue : "var(--color-surface)",
                  border: esDominante
                    ? `1px solid ${e.color}`
                    : "1px solid var(--color-linea)",
                }}
              >
                <div className="flex items-baseline justify-between">
                  <div
                    className="display italic text-[1.3rem]"
                    style={{ color: e.color, fontWeight: 600 }}
                  >
                    {e.nombreGriego}
                  </div>
                  {esDominante && (
                    <span
                      className="eyebrow rounded-full px-2 py-0.5"
                      style={{
                        background: e.color,
                        color: "var(--color-surface)",
                      }}
                    >
                      Dominante
                    </span>
                  )}
                </div>
                <div
                  className="eyebrow"
                  style={{ color: e.color, opacity: 0.8 }}
                >
                  {e.nombre}
                </div>
                <div className="flex items-baseline justify-between mt-4">
                  <span
                    className="display"
                    style={{
                      color: "var(--color-papiro-ink)",
                      fontSize: "1.6rem",
                      fontFeatureSettings: "'tnum'",
                      fontWeight: 600,
                    }}
                  >
                    {v}
                  </span>
                  <span
                    className="text-[0.8rem]"
                    style={{ color: "var(--color-piedra)" }}
                  >
                    {pct}% del total
                  </span>
                </div>
                <div
                  className="h-[4px] rounded-full mt-2"
                  style={{ background: e.colorTenue }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: e.color }}
                  />
                </div>
                <p
                  className="text-[0.82rem] mt-3"
                  style={{ color: "var(--color-piedra)" }}
                >
                  {e.descripcion}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="divisor my-10" />

      {/* Progreso en el cursus */}
      <section aria-labelledby="cursus">
        <h2
          id="cursus"
          className="display text-[1.15rem] mb-4"
          style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
        >
          Cursus honorum
        </h2>
        <ol
          className="relative rounded-xl p-5"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-linea)",
          }}
        >
          {CURSUS.map((g) => {
            const alcanzado = g.nivel <= grado.nivel;
            const esActual = g.nivel === grado.nivel;
            return (
              <li
                key={g.id}
                className="flex items-center gap-4 py-2"
                style={{
                  opacity: alcanzado ? 1 : 0.5,
                }}
              >
                <span
                  aria-hidden
                  className="shrink-0 inline-flex items-center justify-center"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    background: alcanzado
                      ? "var(--color-papiro-soft)"
                      : "var(--color-papiro)",
                    color: g.color,
                    fontFamily: "var(--font-serif-stack)",
                    fontSize: 18,
                    fontWeight: 700,
                    border: esActual
                      ? `2px solid ${g.color}`
                      : "1px solid var(--color-linea)",
                  }}
                >
                  {g.atributo}
                </span>
                <div className="min-w-0 flex-1">
                  <div
                    className="display text-[0.98rem]"
                    style={{
                      color: "var(--color-papiro-ink)",
                      fontWeight: esActual ? 700 : 600,
                    }}
                  >
                    {g.nombre}{" "}
                    <span
                      className="eyebrow ml-1"
                      style={{ color: "var(--color-piedra-clara)" }}
                    >
                      {g.traduccion}
                    </span>
                  </div>
                  <p
                    className="text-[0.82rem] mt-0.5"
                    style={{ color: "var(--color-piedra)" }}
                  >
                    {g.funcionCivica}
                  </p>
                </div>
                {esActual && proximo && (
                  <div className="shrink-0 w-28">
                    <div
                      className="text-[0.72rem] mb-1"
                      style={{ color: "var(--color-piedra)" }}
                    >
                      Avance: {avance}%
                    </div>
                    <div
                      className="h-[3px] rounded-full"
                      style={{ background: "var(--color-papiro-soft)" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${avance}%`,
                          background: proximo.color,
                        }}
                      />
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
