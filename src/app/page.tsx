/**
 * Home — el runtime POLIS (juego iso del archipiélago).
 *
 * Decisión 2026-05-31 (con Panch): la portada pasa a ser directamente el
 * mapa-juego POLIS (public/polis-app), el runtime iso donde se eligen islas
 * → municipios → secciones y se ven los edificios en 3D. Sustituye al lobby
 * del faro. Los datos pesados (sections_pack / osm) se sirven desde
 * Cloudflare R2 vía el wiring de assets-base.js dentro de polis-app.
 *
 * El iframe ocupa el alto restante bajo el Header (h-14 + nav ≈ 96px).
 */

const HEADER_H = "96px";

export default function InicioPage() {
  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height: `calc(100vh - ${HEADER_H})`, background: "#0a0a0a" }}
    >
      <iframe
        src="/polis-app/index.html?v=20260601-r2"
        title="POLIS — mapa cívico de Canarias"
        className="absolute inset-0 h-full w-full border-0 block"
        allow="fullscreen"
      />
    </div>
  );
}
