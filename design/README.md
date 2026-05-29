# KOINOS · Sistema de diseño

> Hub maestro del sistema de diseño KOINOS. Si entras aquí desde fuera del proyecto, este archivo es tu punto de partida. Si trabajas dentro del proyecto, los tokens viven en `src/app/globals.css` y los componentes en `src/components/ui/` — esta carpeta es la documentación canónica y el espejo portable.
>
> Versión: **v1** · 2026-05-09 · Pancho Suárez · panxo93@gmail.com

## Índice rápido

| Archivo | Para qué |
|---|---|
| **[`SISTEMA.md`](./SISTEMA.md)** | Documento maestro: principios, capas (tipo, color, espacio, radio, motion), reglas WCAG, decisiones pendientes. **Empieza aquí.** |
| [`MANUAL_LOGO.md`](./MANUAL_LOGO.md) | Manual de marca: 4 versiones (color/mono/inverse/tint), 4 lockups, construcción, espacio libre, tamaños mínimos, sobre fondos, do's y don'ts, co-branding. |
| [`tokens.css`](./tokens.css) | CSS standalone con todas las variables. Importable en cualquier proyecto. |
| [`tokens.json`](./tokens.json) | Mismos tokens en formato W3C Design Tokens. Para Figma Tokens Studio, Style Dictionary, theo. |
| [`components.md`](./components.md) | API y código de los 5 primitivos UI base (Button, Card, Input, Pill, StatCard). |
| [`AUDITORIA_VISUAL.md`](./AUDITORIA_VISUAL.md) | Análisis del estado anterior — qué tenía el proyecto antes de v1, qué se reconcilió, qué quedó vivo como alias retro-compat. |
| [`RECOMENDACIONES_ISO.md`](./RECOMENDACIONES_ISO.md) | Notas técnicas sobre los renders isométricos por sección censal. Específico de POLIS — no del sistema general. |

## Activos visuales

| Carpeta | Contenido |
|---|---|
| [`svg/`](./svg/) | 8 logos master en SVG (KOINOS, OCRE, POLIS, ÁGORA, BIBLIOTHEKA, PHAROS, CURSUS, KOINÁ) en versión completa (con disco) y `.tile.svg` transparente. |
| [`png/`](./png/) | Mismos logos rasterizados a 1024×1024. Versión completa en raíz, versión tile sin disco en `png/tile/`. |
| [`secciones/`](./secciones/) | Mockups isométricos de secciones censales. Generados por `iso_packages.py`, `iso_lods.py`, `iso_planiso.py`, `iso_fidelity.py`. |
| `contact_sheet.png` | Hoja de contactos del sistema iso a 8 piezas con paleta. Genera con `python3 contact_sheet.py`. |

## Generadores

| Script | Qué hace |
|---|---|
| [`generate.py`](./generate.py) | Genera los 8 logos como SVG + PNG. Consume la paleta de SISTEMA.md §2 (definida inline en `P` dict). Emite a `svg/` y `png/`. Requiere `cairosvg` para rasterizar. |
| [`iso_buildings.py`](./iso_buildings.py) | Render iso de edificios por sección censal — pipeline de proyección y painter. |
| [`iso_lods.py`](./iso_lods.py) | Tres niveles de detalle (sección, manzanas, edificios) sobre el mismo encuadre. |
| [`iso_packages.py`](./iso_packages.py) | Cinco paneles apilados que muestran cada paquete de datos como capa progresiva. |
| [`iso_fidelity.py`](./iso_fidelity.py) | Comparativa iso vs satélite Esri para validar fidelidad antes de batch. |
| [`iso_planiso.py`](./iso_planiso.py) | Cenital + iso lado a lado, alternativa offline cuando la sandbox no tiene tiles. |
| [`mockup_plaza.py`](./mockup_plaza.py) | Mockup ad-hoc para mostrar conceptos sobre plaza concreta. |

## Cómo usar

### Si vas a programar la app

Los archivos de esta carpeta son **espejo de referencia**. La fuente de verdad ejecuta en:

```
src/app/globals.css        ← tokens en código
src/components/ui/         ← componentes activos
src/app/sistema/page.tsx   ← showcase navegable, abrir en localhost:3000/sistema
```

Importa así:

```tsx
import { Button, Card, Input, Pill, StatCard } from "@/components/ui";
```

### Si vas a diseñar en Figma

1. Importa [`tokens.json`](./tokens.json) en Tokens Studio o equivalente.
2. Lee [`SISTEMA.md`](./SISTEMA.md) §1-5 para entender la jerarquía.
3. Lee [`components.md`](./components.md) para conocer la API exacta de los primitivos antes de proponer maquetas.
4. Si propones algo nuevo, abre PR o issue contra `design/` antes de implementar.

### Si vas a usar el sistema fuera del proyecto

1. Copia [`tokens.css`](./tokens.css) a tu proyecto.
2. `@import` desde tu CSS principal.
3. Asegúrate de tener Archivo Black, Inter y JetBrains Mono cargadas (todas OFL · Google Fonts · `@fontsource`).
4. Lee [`SISTEMA.md`](./SISTEMA.md) §1-5 para entender los rangos válidos.

## Tipografía oficial

Las tres familias están en **SIL Open Font License** — uso desktop, web, comercial e institucional sin coste, sin caducidad.

| Token | Familia | Cuándo |
|---|---|---|
| `--font-display` | **Archivo Black** | wordmark, hero, titulares grandes |
| `--font-sans` | **Inter** | UI, prosa, navegación |
| `--font-mono` | **JetBrains Mono** | datos, números, IDs |

Instalación dentro del proyecto (Next.js):
```bash
npm i @fontsource/archivo-black @fontsource/archivo @fontsource/inter @fontsource/jetbrains-mono
```

Instalación en macOS (sistema, para que `cairosvg` rasterice los logos correctamente):
- Descargar de [Google Fonts](https://fonts.google.com): Archivo Black, Archivo, Inter, JetBrains Mono.
- Doble click en cada `.ttf`/`.otf` → "Install Font" en Font Book.

## Decisiones pendientes

Dos decisiones quedaron en pausa esperando a Pancho. Mientras no se cierren, el sistema corre con valores por defecto razonables:

1. **Modo de marca** (light papel / dark obsidiana / dual). Default actual: light. Detalle en SISTEMA.md §6.1.
2. **Arquitectura de marca** (monolítica / endorsed / house). Default actual: las 8 marcas coexisten al mismo nivel. Detalle en SISTEMA.md §6.2.

## Versionado

| Versión | Fecha | Cambios |
|---|---|---|
| v1 | 2026-05-09 | Fundación: tokens consolidados, fuentes oficiales (Archivo Black + Inter + JetBrains Mono OFL), paleta canónica reconciliada, escala tipográfica + espacio + radio + motion, 5 primitivos UI base, página showcase `/sistema`. |

## Mantenimiento

- **Cualquier cambio de token** se hace en `src/app/globals.css` primero, luego se sincroniza a `design/tokens.css` y `design/tokens.json` en el mismo commit.
- **Cualquier componente nuevo** se documenta en `design/components.md` y se añade a `src/app/sistema/page.tsx` como ejemplo vivo.
- **Cualquier cambio en la paleta categórica** requiere también actualizar `src/components/polis-juego/` y los visualizadores de POIs.
- Si hay drift entre `design/` y `src/`, **gana `src/`** (es lo que ejecuta). `design/` es el espejo curado para compartir.
