"use client";

// Wrapper Client Component para el motor 3D de POLIS Juego.
// En Next.js 16 + Turbopack, `dynamic(..., { ssr: false })` ya NO se
// permite dentro de un Server Component (page.tsx exporta metadata, así
// que es Server Component). Aislamos aquí el import dinámico con ssr:false.

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

export default function JuegoPolisClient() {
  return <JuegoPolis />;
}
