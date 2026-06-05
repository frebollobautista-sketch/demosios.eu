# _archivo · KOINOS-iso

Material apartado del deploy de Cloudflare Pages (`public/`). Conservado
aquí por valor histórico / audit trail pero no servido en producción.

## Histórico

### 2026-06-02 — `polis-provincia-legacy-2026-06-02.html`

Viewer canónico legacy (1146 líneas, MapLibre + choropleth por sección
censal INE, JS inline). Sustituido en producción por `polis-provincia.html`
(redirect 302 → `/polis-app/`) tras el cutover a la app iso con
supra-regiones + núcleos Voronoi.

Motivo: la app iso pasa a ser THE viewer. El modelo administrativo
(barrios canonical GC + secciones INE) ya no es la afordancia visible.
El usuario navega por **territorio nombrado** (Las Cuevas, Barranco de
la Mina, San Mateo…) en vez de códigos censales.

El HTML legacy se preserva por si en el futuro hace falta consultar
algún panel concreto (street index, callejero, gestos cívicos pre-iso).
