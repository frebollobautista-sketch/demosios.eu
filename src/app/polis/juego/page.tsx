// ─── /polis/juego ─────────────────────────────────────────────────
// Capa gamificada de POLIS. Vista 3D Three.js + R3F sobre el casco
// real (Catastro INSPIRE + OSM). Avatar caminable, cámara TPS,
// colisión con edificios, anotación cívica con PEC.
//
// El motor se carga dinámicamente (ssr:false) porque R3F + three.js
// no soportan SSR — necesitan el navegador.

import dynamic from "next/dynamic";

const JuegoPolis = dynamic(
  () => import("@/components/polis-juego/JuegoPolis").then((m) => m.JuegoPolis),
  {
    ssr: false,
    loading: () => (
      <div
        className="rounded-xl p-6 text-center"
        style={{
          background: "var(--color-papiro-soft)",
          border: "1px dashed var(--color-linea)",
          color: "var(--color-piedra)",
        }}
      >
        <p className="display italic">Preparando el motor 3D…</p>
      </div>
    ),
  },
);

export const metadata = {
  title: "Polis · Juego — mapeo cívico de campo",
  description:
    "Capa gamificada de POLIS: caminas el casco histórico de Vegueta + Triana en 3D real, te paras frente a un edificio y lo anotas.",
};

export default function PolisJuegoPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 pb-40">
      <div className="eyebrow">Πόλις · Juego</div>
      <h1
        className="display mt-1 text-[clamp(1.6rem,3.5vw,2.2rem)]"
        style={{ color: "var(--color-papiro-ink)", fontWeight: 600 }}
      >
        Mapea el barrio caminándolo
      </h1>
      <p
        className="mt-3 max-w-2xl"
        style={{ color: "var(--color-piedra)" }}
      >
        Vegueta + Triana en 3D real: 1.321 edificios catastrales extruidos,
        472 calles OSM, 187 POIs nombrados. Caminas con WASD o joystick,
        la cámara te sigue, te paras frente a un edificio del aro dorado y
        lo anotas. Cada firma suma PEC y construye el registro cívico. Los
        bloques rentistas y corporativos quedan marcados como candidatos a
        recuperación.
      </p>

      <nav
        className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[0.8rem]"
        style={{ color: "var(--color-piedra)" }}
      >
        <a
          href="/polis"
          className="eyebrow"
          style={{ color: "var(--color-ocre-deep)" }}
        >
          ← visor de datos
        </a>
        <a
          href="/polis-3d.html"
          target="_blank"
          rel="noopener noreferrer"
          className="eyebrow"
          style={{ color: "var(--color-ocre-deep)" }}
        >
          mapa 3D real ↗
        </a>
        <a
          href="/polis-juego/playground.html"
          target="_blank"
          rel="noopener noreferrer"
          className="eyebrow"
          style={{ color: "var(--color-ocre-deep)" }}
        >
          playground 2D ↗
        </a>
      </nav>

      <div className="divisor my-6" />

      <JuegoPolis />

      <div className="divisor my-10" />

      <section
        className="rounded-xl p-5"
        style={{
          background: "var(--color-papiro-soft)",
          border: "1px dashed var(--color-linea)",
          color: "var(--color-piedra)",
        }}
      >
        <div className="eyebrow">Sobre el motor</div>
        <p className="mt-2 text-[0.92rem] leading-relaxed">
          Three.js + React Three Fiber + drei. Edificios extruidos con
          alturas comprimidas a 3-7 m para jugabilidad. Calles renderizadas
          como una sola mesh ribbon con grosor por tipo de vía. Cámara TPS
          que persigue al avatar con suavizado. Colisión slide simple
          contra los edificios cercanos.
        </p>
        <p className="mt-2 text-[0.88rem] leading-relaxed">
          Datos cargados de <code>/public/polis-juego/vegueta-triana-full.json</code>{" "}
          (Catastro INSPIRE + OSM, ~380 KB). Para iterar en local: edita
          ese JSON o el motor en <code>src/components/polis-juego/Motor3D.tsx</code>.
        </p>
      </section>
    </div>
  );
}
