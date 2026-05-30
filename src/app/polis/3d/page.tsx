import { Polis3D } from "@/components/Polis3D";

export default function Polis3DPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 pb-40">
      <div className="eyebrow">Πόλις</div>
      <h1
        className="display mt-1 text-[clamp(1.6rem,3.5vw,2.2rem)]"
        style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
      >
        Polis 3D — Prototipo R3F
      </h1>
      <p
        className="mt-3 max-w-2xl mb-8"
        style={{ color: "var(--color-piedra)" }}
      >
        48 edificios de Santa Catalina (sección 006) renderizados con React
        Three Fiber. Cada piso es un bloque extruido independiente. Los
        polígonos son los reales del catastro/OSM.
      </p>
      <Polis3D />
      <p
        className="text-[0.78rem] mt-3"
        style={{ color: "var(--color-piedra-clara)" }}
      >
        React Three Fiber + Three.js · WebGL GPU · Datos: OSM + Catastro INSPIRE
      </p>
    </div>
  );
}
