/**
 * Home — el runtime POLIS (juego iso del archipiélago).
 *
 * Decisión 2026-05-31 (con Panch): la portada pasa a ser directamente el
 * mapa-juego POLIS (public/polis-app), el runtime iso donde se eligen islas
 * → municipios → secciones y se ven los edificios en 3D. Sustituye al lobby
 * del faro. Los datos pesados (sections_pack / osm) se sirven desde
 * Cloudflare R2 vía el wiring de assets-base.js dentro de polis-app.
 *
 * En la home se oculta el Header del sitio (ver Shell.tsx), así que el
 * iframe ocupa el viewport completo y solo se ve la barra propia del juego.
 */

export default function InicioPage() {
  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height: "100dvh", background: "#0a0a0a" }}
    >
      <iframe
        src="/polis-app/index.html?v=20260601-perfil1"
        title="POLIS — mapa cívico de Canarias"
        className="absolute inset-0 h-full w-full border-0 block"
        allow="fullscreen"
      />
    </div>
  );
}
