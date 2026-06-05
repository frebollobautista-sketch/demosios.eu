/**
 * Home (/) — de momento muestra el visor POLIS.
 *
 * Cambio temporal (2026-05, con Panch): la portada del sitio pasa a ser
 * el mapa POLIS. El lobby cívico anterior (InicioPage — el faro y las
 * cuatro puertas) se conserva intacto en la ruta /lobby
 * (src/app/lobby/page.tsx). Para revertir, basta con volver a colocar
 * aquí el contenido de ese archivo.
 *
 * El header del sitio se mantiene solo: lo aporta el <Shell> del layout
 * raíz, que envuelve todas las rutas. Esta página reexporta el
 * componente de la ruta /polis, que embebe el visor (polis-provincia.html)
 * en un iframe bajo el header, con sidebar en escritorio y bottom-sheet
 * en móvil.
 */
export { default } from "./polis/page";
