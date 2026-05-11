"use client";

import { useEffect, useState } from "react";

/**
 * Polis — Modo gamificado (beta).
 *
 * Iframe al runtime standalone en `/public/polis-app/`.
 * Render isométrico vectorial sin satélite, navegación jerárquica
 * isla → municipio → distrito → sección → manzana → edificio,
 * con catálogo de arquetipos compartido en `/public/catalog/archetypes.json`.
 *
 * Nombre provisional ("pendiente cambio de nombre" según directiva del proyecto).
 *
 * Integración con la capa cívica: el iframe expone
 * `window.polisApp.setIndicators(newIndicators)` para inyectar datos en runtime
 * desde Next.js (ver docs/RUNTIME.md sección "Integración con la capa cívica").
 */

const HEADER_H = "96px";

export default function PolisGamificadoPage() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Future: cuando la capa cívica esté lista, este useEffect puede
    // llamar a la iframe.contentWindow.polisApp.setIndicators(...)
    // con datos reales de Supabase.
  }, []);

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height: `calc(100vh - ${HEADER_H})`, background: "#F5E8C8" }}
    >
      <iframe
        src="/polis-app/"
        className="w-full h-full border-0"
        title="POLIS gamificado (beta) — render isométrico"
        onLoad={() => setLoaded(true)}
        style={{
          opacity: loaded ? 1 : 0,
          transition: "opacity 240ms ease-out",
        }}
      />
      {!loaded && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ color: "#8A5A2A", fontFamily: "serif", fontStyle: "italic" }}
        >
          Cargando POLIS isométrico…
        </div>
      )}
    </div>
  );
}
