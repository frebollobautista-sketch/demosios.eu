"use client";

import { useMemo, useState } from "react";
import { CANARIAS, type Isla, type Municipio } from "@/lib/territorio/canarias";
import { IconChevronRight } from "./Icons";
import { CTAProtegido } from "./CTAProtegido";

type Nivel = "isla" | "municipio" | "barrio";

/**
 * Navegador territorial de tres niveles. Sin routing aún: el estado
 * vive en el componente. Cuando cableemos routing dinámico
 * /[isla]/[municipio]/[barrio], se sustituye por <Link>.
 */
export function NavegadorTerritorio() {
  const [isla, setIsla] = useState<Isla | null>(null);
  const [muni, setMuni] = useState<Municipio | null>(null);
  const [barrio, setBarrio] = useState<string | null>(null);

  const nivel: Nivel = !isla ? "isla" : !muni ? "municipio" : "barrio";

  const poblacionIsla = (i: Isla) =>
    i.municipios.reduce((s, m) => s + (m.poblacion ?? 0), 0);

  const islasOrdenadas = useMemo(
    () =>
      [...CANARIAS].sort((a, b) => poblacionIsla(b) - poblacionIsla(a)),
    [],
  );

  const municipiosOrdenados = useMemo(() => {
    if (!isla) return [];
    return [...isla.municipios].sort(
      (a, b) => (b.poblacion ?? 0) - (a.poblacion ?? 0),
    );
  }, [isla]);

  return (
    <div className="w-full">
      {/* Migas de pan */}
      <div
        className="flex flex-wrap items-center gap-1 text-[0.82rem] mb-4"
        style={{ color: "var(--color-piedra)" }}
      >
        <button
          onClick={() => {
            setIsla(null);
            setMuni(null);
            setBarrio(null);
          }}
          className="display italic hover:underline"
          style={{
            color:
              nivel === "isla"
                ? "var(--color-papiro-ink)"
                : "var(--color-ocre-deep)",
            fontWeight: 600,
          }}
        >
          Canarias
        </button>
        {isla && (
          <>
            <IconChevronRight size={14} />
            <button
              onClick={() => {
                setMuni(null);
                setBarrio(null);
              }}
              className="hover:underline"
              style={{
                color:
                  nivel === "municipio"
                    ? "var(--color-papiro-ink)"
                    : "var(--color-ocre-deep)",
                fontWeight: 600,
              }}
            >
              {isla.nombre}
            </button>
          </>
        )}
        {muni && (
          <>
            <IconChevronRight size={14} />
            <button
              onClick={() => setBarrio(null)}
              className="hover:underline"
              style={{
                color: "var(--color-papiro-ink)",
                fontWeight: 600,
              }}
            >
              {muni.nombre}
            </button>
          </>
        )}
        {barrio && (
          <>
            <IconChevronRight size={14} />
            <span style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}>
              {barrio}
            </span>
          </>
        )}
      </div>

      {/* Panel activo */}
      {nivel === "isla" && (
        <ul className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {islasOrdenadas.map((i) => (
            <li key={i.id}>
              <button
                onClick={() => setIsla(i)}
                className="w-full text-left rounded-xl p-4 transition-colors h-full"
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-linea)",
                }}
              >
                <div className="flex items-start justify-between">
                  <span className="text-2xl leading-none" aria-hidden>
                    {i.emoji}
                  </span>
                  <span
                    className="eyebrow"
                    style={{ color: "var(--color-piedra-clara)" }}
                  >
                    {i.municipios.length} mun.
                  </span>
                </div>
                <div
                  className="display mt-2 text-[1.05rem]"
                  style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
                >
                  {i.nombre}
                </div>
                <div
                  className="text-[0.78rem] mt-0.5"
                  style={{ color: "var(--color-piedra)" }}
                >
                  {poblacionIsla(i).toLocaleString("es-ES")} habitantes
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {nivel === "municipio" && isla && (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {municipiosOrdenados.map((m) => (
            <li key={m.id}>
              <button
                onClick={() => setMuni(m)}
                className="w-full text-left rounded-lg p-3 flex items-center justify-between transition-colors"
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-linea)",
                }}
              >
                <div className="min-w-0">
                  <div
                    className="text-[0.92rem] truncate"
                    style={{
                      color: "var(--color-papiro-ink)",
                      fontWeight: 600,
                    }}
                  >
                    {m.nombre}
                  </div>
                  <div
                    className="text-[0.76rem]"
                    style={{ color: "var(--color-piedra)" }}
                  >
                    {m.poblacion
                      ? `${m.poblacion.toLocaleString("es-ES")} hab.`
                      : "—"}
                    {m.barrios.length > 0
                      ? ` · ${m.barrios.length} barrios mapeados`
                      : " · barrios sin mapear"}
                  </div>
                </div>
                <IconChevronRight size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {nivel === "barrio" && muni && (
        <div>
          {muni.barrios.length === 0 ? (
            <div
              className="rounded-lg p-6 text-center"
              style={{
                background: "var(--color-surface)",
                border: "1px dashed var(--color-linea)",
                color: "var(--color-piedra)",
              }}
            >
              <p className="display italic">
                Este municipio aún no tiene barrios mapeados en OCRE.
              </p>
              <p className="text-[0.85rem] mt-2">
                ¿Quieres ser <strong>oikonómos</strong> de un barrio y empezar su
                mapeo?
              </p>
              <div className="mt-3 inline-block">
                <CTAProtegido
                  etiqueta="Proponer un barrio"
                  etiquetaAnonimo="Entra para proponer barrio"
                  razon="Proponer barrios no mapeados requiere una cuenta."
                  tamano="sm"
                />
              </div>
            </div>
          ) : (
            <ul className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {muni.barrios.map((b) => (
                <li key={b.id}>
                  <button
                    onClick={() => setBarrio(b.nombre)}
                    className="w-full text-left rounded-md p-3 transition-colors"
                    style={{
                      background:
                        barrio === b.nombre
                          ? "var(--color-papiro-soft)"
                          : "var(--color-surface)",
                      border: "1px solid var(--color-linea)",
                    }}
                  >
                    <span
                      className="text-[0.88rem]"
                      style={{
                        color: "var(--color-papiro-ink)",
                        fontWeight: 600,
                      }}
                    >
                      {b.nombre}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {barrio && (
            <div
              className="mt-4 rounded-lg p-4"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-linea)",
              }}
            >
              <div className="eyebrow" style={{ color: "var(--color-piedra)" }}>
                Foro del barrio
              </div>
              <div
                className="display mt-1 text-[1.1rem]"
                style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
              >
                {barrio}
              </div>
              <p
                className="text-[0.88rem] mt-1"
                style={{ color: "var(--color-piedra)" }}
              >
                Aquí vivirán los hilos del Ágora, los recursos de Koiná y el
                mapa de Polis filtrados por este barrio. Próximamente.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
