# KOINOS · Sistema de diseño v1

> Documento maestro vivo. Última actualización: 2026-05-09.
> Fuente única de verdad para color, tipografía, espaciado, radios, motion
> y aplicación. Acompaña al código en `src/app/globals.css` y a los
> generadores en `design/generate.py` / `design/iso_*.py`.
> Si añades un token, añádelo aquí y en `globals.css` el mismo commit.

## Principios

1. **Un solo origen de verdad por token**. Si quieres cambiar un color, lo cambias en `:root` de `globals.css`. Todo lo demás (Tailwind, scripts Python, mockups Figma) lee de ahí.
2. **Nombres conceptuales, no literales**. `--ocre`, no `--brown-700`. La paleta tiene sentido geológico-canario; respétalo.
3. **Tokens canónicos + alias semánticos + alias retro-compat**. Tres capas: el nombre raíz (`--ocre`), el nombre por función (`--link: var(--ocre)`), y el nombre antiguo del código existente (`--color-ocre: var(--ocre)`). Nadie se rompe al actualizar.
4. **Mode-agnostic primero**. Type, space, radius, motion no dependen de light/dark. Color sí — pero esa decisión está pendiente, ver §6.
5. **Outline volcánico es la firma**. Cualquier pieza iso 2.5D lleva trazo `--volcanic` 2.5px. No se negocia.

## 1 · Tipografía

### Familias oficiales (todas SIL OFL · 0 €)

| Token | Familia | Uso |
|---|---|---|
| `--font-display` | **Archivo Black** | wordmark, hero, titulares grandes |
| `--font-sans` | **Inter** | UI, prosa, navegación, cuerpo |
| `--font-mono` | **JetBrains Mono** | datos, números, código, IDs |

Instalación: las cuatro están en `package.json` como dependencias `@fontsource/*` y se importan en `globals.css`. No hay carga externa: bundleadas con Next.

### Escala (9 steps)

```
--text-display  84px    hero, wordmark suelto
--text-h1       48px    portada de página
--text-h2       32px    sección
--text-h3       24px    sub-sección
--text-lg       18px    lead, intro
--text-base     16px    prosa (body)
--text-sm       14px    UI secundaria
--text-xs       12px    captions, metadatos
--text-eyebrow  11px    overline (uppercase + tracking 0.18em)
```

### Leading

```
--leading-tight    1.1   display, h1
--leading-snug     1.3   h2-h3
--leading-normal   1.5   listas, UI
--leading-relaxed  1.6   prosa larga (default body)
```

### Reglas de uso

- **Wordmark KOINOS y todas las sub-marcas** van en Archivo Black con `letter-spacing: 0.13em`.
- **Eyebrow / overline** siempre uppercase con tracking 0.18em y color `--ocre-dk`.
- **Prosa larga** mínimo 16px / 1.6. Por debajo de eso pierde lecturabilidad.
- **Datos numéricos** siempre con `--font-mono` y `font-variant-numeric: tabular-nums` (la clase `.mono` o `.tabular` lo aplica). Esto evita que cambien de ancho columna a columna.
- **No mezclar pesos arbitrariamente**. Inter solo en 400 y 500. Archivo Black es single-weight (no toca otra cosa). Archivo (regular) en 700 si necesitas un display más ligero que el Black.

## 2 · Color

### Paleta canónica (14 tokens)

| Token | Hex | Función |
|---|---|---|
| `--paper` | `#fbf4dd` | papel cálido, fondo de marca |
| `--cream` | `#f4ead4` | superficie secundaria, bandas |
| `--sand-lt` | `#f0e0c0` | hover, top-faces iso, highlights |
| `--sand` | `#c8b898` | tono base de edificio iso, acentos suaves |
| `--ocre` | `#b07840` | pigmento mid-warm, links, énfasis |
| `--ocre-dk` | `#8a5a2a` | sombra ocre, sub-marks, eyebrow |
| `--terracotta` | `#c85438` | acento rojo plebeyo, alertas |
| `--sangre` | `#6e2a1e` | terracota oscuro, danger / depth |
| `--aegean` | `#5b9aa8` | agua mediterránea |
| `--blue-dk` | `#3a5878` | imperial profundo, info |
| `--laurel` | `#7c8a4a` | verde cívico, success |
| `--gold` | `#d8a44a` | oro patricio, premio, warning |
| `--piedra` | `#6d6458` | gris cálido, texto secundario |
| `--volcanic` | `#221d18` | outline universal, tinta principal |

### Alias semánticos

```
--bg          → --paper
--bg-soft     → --cream
--surface     → #ffffff (cards, modales — más blanco que el paper)
--ink         → --volcanic
--ink-muted   → --piedra
--line        → #e5e1d6
--link        → --ocre
--danger      → --terracotta
--success     → --laurel
--warning     → --gold
--info        → --blue-dk
```

### Reglas de contraste WCAG (verificadas)

Sobre fondo `--paper` (#fbf4dd):
- ✅ AAA: `--volcanic`, `--ocre-dk`, `--blue-dk`
- ⚠️ Solo texto grande (≥18px o 14px bold): `--ocre`, `--terracotta`, `--laurel`
- ❌ Decorativo, NO body copy: `--aegean`, `--gold`

Sobre fondo `#0a0a0a` (visor obsidiana, decisión 01 pendiente):
- ✅ AAA: `--paper`, `--sand-lt`, `--sand`
- ✅ AA: `--ocre`, `--terracotta`, `--gold`

### Alias retro-compatibles

El código existente de OCRE usaba `--color-papiro`, `--color-carbon`, `--color-piedra`, etc. Todos quedan vivos como alias hacia los tokens canónicos. **No los uses en código nuevo** — pero tampoco corre prisa migrarlos.

## 3 · Espaciado · base 4 px

```
--space-1   4px     mini-gap (ícono ↔ texto adyacente)
--space-2   8px     gap entre elementos UI relacionados
--space-3   12px    padding interno tight de cards
--space-4   16px    padding estándar de cards, gap entre secciones cortas
--space-6   24px    gap entre secciones de un mismo bloque
--space-8   32px    margen vertical entre bloques distintos
--space-12  48px    margen vertical entre secciones de página
--space-16  64px    hero padding, márgenes generosos
--space-24  96px    aire entre temas mayores
```

Regla: si necesitas un valor que no está, **no lo inventes** — añádelo al sistema o usa el más cercano. La sospecha de "hace falta un step entre 4 y 6" suele ser que estás peleando contra el grid; replantéa la composición antes de añadir token.

## 4 · Radios

```
--radius-sm    4px      botones secundarios, tags, chips
--radius-md    8px      cards, inputs, surfaces estándar
--radius-lg    12px     modales, hero blocks, panels grandes
--radius-xl    16px     contenedores especiales (slide-overs)
--radius-full  9999px   pills, círculos, avatares
```

## 5 · Motion

```
--duration-fast   120ms   hovers, micro-feedback
--duration-base   240ms   transiciones estándar de estado
--duration-slow   400ms   transiciones de página, drawers
--ease-out        cubic-bezier(0.2, 0.8, 0.2, 1)   entrada
--ease-in-out     cubic-bezier(0.4, 0, 0.2, 1)     ida y vuelta
```

Los componentes que se añaden a la página (modales, popups) entran con `--ease-out`. Los que cambian de estado en sitio (toggles, accordions) usan `--ease-in-out`.

## 6 · Decisiones pendientes

Estas dos están en pausa hasta que Pancho las cierre:

### 6.1 · Modo de marca · light / dark / dual

Tres opciones planteadas:
- **Modo papel** — todo light, dark como toggle.
- **Modo obsidiana** — todo dark, light como toggle.
- **Sistema dual** (recomendado) — OCRE light, POLIS dark. Dos productos con identidad propia bajo paleta común.

Mientras no se cierre, el sistema corre en modo papel por defecto (hereda de OCRE app).

### 6.2 · Arquitectura de marca

- **Monolítica** — solo KOINOS tiene logo.
- **Endorsed** (recomendado) — KOINOS sello, OCRE/POLIS/ÁGORA con logo propio firmando bajo, el resto features.
- **House of brands** — cada marca independiente, KOINOS solo en footer legal.

Mientras no se cierre, los 8 logos coexisten al mismo nivel.

## 7 · Cómo extender

1. **Añadir un token nuevo**: edita `:root` en `globals.css`, añade la línea aquí en §1-5, abre commit con prefijo `tokens:`.
2. **Añadir una fuente**: solo si hay justificación de marca (ej. una display alternativa para piezas editoriales). Pasa por aprobación antes — la regla por defecto es las tres familias actuales.
3. **Añadir un componente**: crea el componente en `src/components/<nombre>.tsx`, importa los tokens (no hardcodes), documenta el uso aquí en §8.
4. **Modificar un token existente**: si rompe alias retro-compat, añade el alias antes de mergear. Si rompe el contraste WCAG, lo bloqueas hasta tener replacement.

## 8 · Componentes

Página showcase: **`/sistema`** — abre `localhost:3000/sistema` para ver el museo navegable. Cada componente vive en `src/components/ui/` y se importa así:

```tsx
import { Button, Card, Input, Pill, StatCard } from "@/components/ui";
```

### v1 · primitivos base (escritos)

- [x] **Button** — primary, secondary, ghost, danger · sm/md/lg · leading/trailing icon
- [x] **Card** — surface, elevated, outlined · padding tight/default/generous · accent ocre/terracotta/laurel/blue-dk/gold
- [x] **Input** — text, search · estados default/focused/error · icon, label
- [x] **Pill** — default, active, category (paleta semántica fijada con 8 categorías)
- [x] **StatCard** — simple (mini-stats) y accent (con franja + delta)

### v2 · pendientes para próximas sesiones

- [ ] Breadcrumb
- [ ] Toggle (switch + radio)
- [ ] Modal / drawer
- [ ] Popup de mapa (los del visor)
- [ ] Leyenda de capa (cromática + semántica)
- [ ] Avatar + nivel (cursus honorum badge)
- [ ] Banner inferior (suscripción colapsable)
- [ ] Tabla de datos (con tabular-nums)
- [ ] Tooltip
- [ ] Skeleton / loading state

## 9 · Archivos del sistema

### Hub portable (carpeta `/design` — esta documentación)

```
design/
├── README.md              ← entrada principal (índice maestro)
├── SISTEMA.md             ← este documento (las 5 capas + decisiones)
├── MANUAL_LOGO.md         ← variantes, lockups, construcción, do's & don'ts
├── tokens.css             ← CSS standalone con todas las variables
├── tokens.json            ← W3C Design Tokens para Figma/Style Dictionary
├── components.md          ← API + código de los 5 primitivos UI
├── AUDITORIA_VISUAL.md    ← análisis del estado anterior
├── RECOMENDACIONES_ISO.md ← notas técnicas iso (específico POLIS)
├── generate.py            ← genera los 8 logos en 7 variantes cada una
├── iso_*.py               ← generadores de mockups isométricos
├── svg/                   ← 8 logos × 7 variantes (color/tile/mono/inverse/tint/horizontal/monogram)
├── png/                   ← raster 1024×1024 + png/tile/ + png/favicon/{16,32,64}
└── secciones/             ← mockups por sección censal
```

### Código ejecutable (raíz del repo)

```
src/app/globals.css           ← FUENTE DE VERDAD de tokens (Tailwind v4 @theme inline)
src/app/sistema/page.tsx      ← showcase navegable, localhost:3000/sistema
src/components/ui/Button.tsx
src/components/ui/Card.tsx
src/components/ui/Input.tsx
src/components/ui/Pill.tsx
src/components/ui/StatCard.tsx
src/components/ui/index.ts    ← re-exports
public/polis-provincia.html   ← visor standalone (consumirá tokens vía custom props)
```

**Regla de drift**: si `design/tokens.css` o `design/tokens.json` difieren de `src/app/globals.css`, gana `globals.css` (es lo que ejecuta). Sincronizar el espejo es responsabilidad del autor del cambio en el mismo commit.

## 10 · Versionado

- v1 (2026-05-09) — fundación: tokens consolidados, fuentes oficiales fijadas (Archivo Black + Inter + JetBrains Mono OFL), paleta canónica reconciliada, escala tipográfica, espaciado, radios y motion. Audita anterior cerrada.
