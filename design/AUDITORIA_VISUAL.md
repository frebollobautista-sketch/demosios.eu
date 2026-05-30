# KOINOS · Auditoría visual del sistema actual

> Documento de auditoría preliminar. Pancho · 2026-05-09.
> Base: `design/generate.py`, los 8 SVG de `design/svg/`, mockups en
> `design/secciones/`, y `public/polis-provincia.html`. Pre-requisito para
> levantar el sistema institucional.

## Resumen ejecutivo

El sistema visual **no parte de cero**: hay una identidad isométrica 2.5D coherente, una paleta nombrada de 12 tonos derivada de la pigmentación canaria (ocre, terracota, sand, volcánico) y un sistema de wordmark uniforme aplicado a las 8 sub-marcas. Sin embargo, hay **tres fallas estructurales** que impiden hablar todavía de un sistema institucional:

1. **Doble piel cromática sin reglas**: los logos y el front-end mobile/web (mockup `3501602052_filter_salud.png`) viven en cream/papel cálido, mientras que `polis-provincia.html` vive en obsidiana oscura. Ningún documento explica cuándo se usa cada modo.
2. **Tipografía bifurcada y sin sistema**: los logos usan Georgia (serif) y el visor usa `system-ui` (sans). No hay escalas, pesos, ni fuentes oficiales.
3. **Tokens sin formalizar**: la paleta vive como diccionario de Python (`P` en `generate.py`) y como literales hex sembrados por `polis-provincia.html`. No existe un layer único compartido entre Figma, Tailwind v4 y los scripts de mockup.

Lo que sigue desglosa cada capa del sistema, lo que ya está bien, y los huecos.

## 1 · Sistema cromático

### Paleta nombrada (extraída de `generate.py`, 12 tokens)

| Token | Hex | Función conceptual |
|---|---|---|
| `paper_lt` | `#fbf4dd` | papel/canvas base |
| `cream` | `#f4ead4` | papel/página, fondos secundarios |
| `sand_lt` | `#f0e0c0` | hover, top-faces, highlights |
| `sand` | `#c8b898` | tono base de edificio (también en visor) |
| `ocre` | `#b07840` | pigmento mid, mid-warm |
| `ocre_dk` | `#8a5a2a` | sombra ocre, subtítulos |
| `terracotta` | `#c85438` | acento "rojo plebeyo" |
| `aegean` | `#5b9aa8` | agua mediterránea |
| `blue_dk` | `#3a5878` | imperial profundo |
| `laurel` | `#7c8a4a` | verde cívico |
| `gold` | `#d8a44a` | oro patricio, premio |
| `volcanic` | `#221d18` | outline / negro volcánico canario |

### Lo que funciona

La paleta tiene un argumento conceptual sólido (pigmentación geológica canaria + arquetipo greco-romano). El uso del **outline volcánico** sobre cada figura iso es el unificador visual más potente del sistema — es lo que hace que las 8 marcas se lean como familia incluso con relleno distinto.

### Fallas

**El visor `polis-provincia.html` introduce 5 colores no presentes en la paleta nombrada:**

| Hex en visor | Función | ¿Mapea a paleta? |
|---|---|---|
| `#0a0a0a` | fondo del visor | no — debería ser `volcanic` o un nuevo `obsidian` |
| `#d4c4a0` | texto principal en visor | no — hay un `sand` (#c8b898) y un `sand_lt` (#f0e0c0); este es un tercer sand |
| `#1a1610` / `#15120e` / `#141210` | fondos de panel notebook | derivados ad-hoc de `volcanic` |
| `#5a5040` | carreteras primary | no — afín a `ocre_dk` pero distinto |
| `#2a5a18`, `#1a4a6a`, `#9a5aaa` | parques, agua, renta-coropleta | no — ninguno está nombrado |

**Hay un drift entre el `sand` de los logos (#c8b898) y el `sand` del visor para texto (#d4c4a0).** Ambos cumplen la función "tono cálido neutro" pero no son el mismo color. El usuario nunca debería poder detectar un sand "de logo" y un sand "de UI" — pero ahora puede.

### Accesibilidad WCAG (datos calculados)

Sobre **fondo papel claro** (`#fbf4dd`):

| Combinación | Ratio | Texto normal | Texto grande |
|---|---|---|---|
| `volcanic` sobre papel | 15.18 | AAA | AAA |
| `ocre_dk` sobre papel | 5.34 | AA | AAA |
| `blue_dk` sobre papel | 6.70 | AA | AAA |
| `terracotta` sobre papel | 3.99 | FAIL | AA |
| `ocre` sobre papel | 3.40 | FAIL | AA |
| `laurel` sobre papel | 3.41 | FAIL | AA |
| `aegean` sobre papel | 2.88 | FAIL | FAIL |
| `gold` sobre papel | 2.05 | FAIL | FAIL |

Sobre **fondo obsidiana** (`#0a0a0a` del visor):

| Combinación | Ratio | Texto normal | Texto grande |
|---|---|---|---|
| `viewer_fg` `#d4c4a0` | 11.50 | AAA | AAA |
| `sand` `#c8b898` | 10.15 | AAA | AAA |
| `ocre` `#b07840` | 5.29 | AA | AAA |
| `terracotta` `#c85438` | 4.51 | AA | AAA |
| gris `#888` (texto secundario actual) | 5.58 | AA | AAA |

**Implicación**: en modo papel solo `volcanic`, `ocre_dk` y `blue_dk` son tipográficamente seguros para body copy. `terracotta`, `ocre`, `laurel`, `gold`, `aegean` son **decorativos**, no para texto largo. En modo obsidiana hay más holgura.

## 2 · Sistema tipográfico

### Estado actual

- **Logos**: `font-family="Georgia, serif"`. Wordmark a 86px, weight 700, letter-spacing 14. Sub-mark a 26px, letter-spacing 10, color `volcanic` y `ocre_dk` respectivamente.
- **Visor**: `system-ui, sans-serif`. Tamaños sembrados ad-hoc (9px, 10px, 11px, 14px) según componente.
- **Mockup mobile** (`3501602052_filter_salud.png`): sans-serif limpia (parece Inter o SF), pills con padding generoso, tipografía de números grande para stats (345 viviendas, 38 POIs).

### Fallas

1. **No hay fuentes propias declaradas.** Georgia es la que toca de fábrica en cualquier OS, pero en web es inconsistente entre macOS (Georgia bonita) y Windows (Georgia más estrecha). En sistemas sin Georgia se cae a serif genérica.
2. **No hay escala tipográfica.** No existe un sistema con 8-10 steps (ej. 12/14/16/18/24/32/48/64/96) que mapee a tokens.
3. **No hay decisión sobre serif vs. sans en el cuerpo del producto.** El logo es serif, el visor es sans, el mockup es sans. Si el wordmark serif convive con UI sans, eso es legítimo (Bloomberg, NYT lo hacen), pero hay que documentarlo y elegir las dos familias.
4. **No hay fuente monoespaciada para datos.** El visor muestra `28.450€`, `345 edificios`, `41 ha` — todo eso pide tabular numerals que ni Georgia ni system-ui dan bien por defecto.

### Recomendación de fuentes (a validar)

Una propuesta razonable que respeta lo greco-romano sin ser cursi:
- **Display/wordmark**: una serif de transición o didone con personalidad (Cormorant Garamond, GT Sectra, Tiempos Headline). Si querés mantener Georgia gratis, **Source Serif 4** o **Lora** son alternativas open-source con peso institucional.
- **UI/texto**: una sans humanista clara (Inter, IBM Plex Sans, Source Sans 3). Inter tiene tabular numerals nativos y excelente rendering en pantalla.
- **Mono/datos**: IBM Plex Mono o JetBrains Mono.

Las tres familias deberían quedar declaradas como tokens en `@theme inline` con sus fallbacks correspondientes.

## 3 · Sistema iconográfico (la firma visual)

### Lo que es la firma

El elemento más original y reconocible del sistema es el **canon iso 2.5D**:
- Proyección a 30° (`COS30 = cos(30°)`, `SIN30 = 0.5`).
- Primitiva única: el cubo de tres caras visibles (top más claro, left tono medio, right más oscuro).
- Outline `volcanic` 2.5px sin excepción.
- Disc background con gradiente sky→sand_lt + vignette ocre 18% — el "blasón" institucional.
- Sombra de contacto a 22% de opacidad bajo cada pieza.
- Wordmark inferior: nombre 86px + tagline 26px, separados consistentemente.

Esta firma se aplica también a los **mockups de sección** (`iso_packages.py`, `iso_planiso.py`, `iso_lods.py`) — el mismo lenguaje visual que comunica las 8 sub-marcas también es la representación del territorio jugado en POLIS. Es coherencia conceptual fuerte: la marca y el dato hablan el mismo idioma. **Mantener.**

### Variantes ya existentes

Cada pieza tiene tres salidas:
1. **Brand-board completo** (`design/svg/<name>.svg`): disc + iso + wordmark.
2. **Tile transparente** (`design/svg/<name>.tile.svg`): solo el iso, sin disc ni wordmark, listo para insertar en el visor como pieza de mapa.
3. **PNG rasterizados** (`design/png/` y `design/png/tile/`): exports a 1024×1024.

Esta arquitectura ya está pensada para "logo institucional" + "icono operativo en el producto". Buena base.

### Fallas

1. **No existe versión monocromática** de ningún logo. Para impresión a una tinta, fax, sello, watermark, te falta. Habría que generar `<name>.mono.svg` (solo `volcanic` sobre transparente) y `<name>.inverse.svg` (paper sobre obsidiana).
2. **No existe versión reducida** (favicon, app icon, redes). Los SVGs actuales pierden todo a 16×16. Hay que abstraer el motivo a una glifo elemental por marca.
3. **No hay grid de construcción documentado** ni clear-space. Las constantes `S=120`, `CX=512`, `CY=572` están hardcodeadas en `generate.py` pero no figuran como reglas de uso.
4. **CURSUS aparece dos veces.** Como sub-mark independiente (`cursus.svg`, "Honorum · Ciudadanía") y como sección de Bibliotheka (subtítulo "Cursus honorum · Koiná"). La arquitectura de marca no aclara si CURSUS es una marca o una capa dentro de Bibliotheka.

## 4 · Arquitectura de marca (las 8 piezas)

### Mapeo conceptual deducido

```
KOINOS  (master)        — la plataforma, los commons
└── OCRE                — el front-end cívico (Organización Canaria)
    ├── Inicio          — (sin sub-mark)
    ├── ÁGORA           — discusión cívica
    ├── BIBLIOTHEKA     — biblioteca
    │   ├── Cursus honorum  — videos ciudadanos rankeados
    │   └── Koiná          — recursos del común
    └── POLIS           — mapa/visor de territorio
        └── PHAROS      — ejes de capital cívico (sistema de puntos)
```

### Fallas

1. **CURSUS y KOINÁ tienen logo propio** (al mismo nivel que ÁGORA o POLIS), pero conceptualmente son sub-secciones de BIBLIOTHEKA. ¿Marca de tercer nivel o sub-mark de segundo? Hay que decidir.
2. **PHAROS** tiene logo y se describe en POLIS-STATE.md como "ejes de capital cívico" — un sistema de puntos transversal. ¿Es marca o feature? Si es feature no debería tener logo independiente.
3. **OCRE** tiene logo, pero es la marca paraguas del front-end. Debería ser arquitecturalmente al mismo nivel que KOINOS, no por debajo. La relación KOINOS/OCRE no está clara: ¿son sinónimos? ¿KOINOS es el back-end y OCRE el front-end? ¿OCRE es una rama del proyecto?

Esto se resuelve definiendo arquitectura de marca (monolítica, endorsed o house of brands). Te haría falta un diagrama explícito y una regla de coexistencia (qué logo manda en cada contexto).

## 5 · Aplicaciones existentes

### Visor POLIS standalone (`polis-provincia.html`)

- Modo: dark/obsidiana.
- UI metáfora: cuaderno/libreta/diario lateral.
- Componentes: navegador de islas SVG, breadcrumb, stats, lista municipios, toggles de capa, popups.
- Estado: en producción, ~1000 líneas de CSS+JS+HTML inline.
- Tipografía: system-ui, sin escala documentada.

### Mockups OCRE mobile (`3501602052_filter_salud.png`, `m24_mobile.png`, `events.png`, `songkick.png`)

- Modo: light/paper.
- UI metáfora: ficha de papel, pills, search bar, chips de categoría.
- Componentes: barra de búsqueda + filtro, chips de categorías (Todos, Comercio, Restauración, Salud), card de estadísticas, lista de resultados.
- Mapa renderizado con paleta cálida coherente (ocre/sand sobre cream).
- Acento verde activo (laurel-ish) en chip seleccionado.

### Conflicto

El visor (dark) y el mockup mobile (light) muestran **el mismo dato** — la sección 3501602052 — con dos tratamientos visuales totalmente distintos. Esto puede ser intencional (modo nocturno vs. modo día, o "modo experto" vs. "modo público") pero no está formalizado. Hay que decidir:

- (a) **Light por defecto** + dark mode como toggle, ambos tokenizados.
- (b) **Dark para POLIS visor avanzado / data-heavy** + light para OCRE app cívica → dos productos distintos con identidad diferenciada.
- (c) Unificar a un solo modo y descartar el otro.

Recomiendo (a) si quieres un sistema único, (b) si quieres separar la audiencia experta de la cívica. (c) es la opción más conservadora pero pierde una dimensión que ya está hecha.

## 6 · Lo que falta para que sea un sistema institucional

Por orden de bloqueo:

1. **Decisión sobre arquitectura de marca** (cuántos niveles, qué relación entre KOINOS, OCRE y los 6 sub-marks). Sin esto no puedes maquetar manuales.
2. **Decisión light/dark** (un sistema con dos modos, o dos productos con un modo cada uno). Sin esto los tokens divergen.
3. **Tokens compartidos** publicados en un único origen de verdad (probablemente `/Users/panch/KOINOS/app/globals.css` o un `tokens.json`) que alimente Tailwind v4 (`@theme inline`), Figma (variables) y los scripts Python (`generate.py`, `iso_*.py`). El `P` dict actual de `generate.py` es ya el 80% — solo hay que sacarlo.
4. **Fuentes oficiales declaradas** (display, UI, mono) con licencias y fallbacks.
5. **Manual de logo** (clear space, tamaño mínimo, versiones color/mono/inverse, qué hacer y qué no).
6. **Componentes UI básicos** documentados (botón, pill, card, search, breadcrumb, stat-card, leyenda de mapa, toggle) — empezar por los que ya aparecen en visor y mockups.
7. **Iconografía operativa** (no la de marca): hace falta una librería de glifos UI (lupa, filtro, ajustes, mail, avatar, settings) coherente con el peso del outline 2.5px del sistema iso.
8. **Tono de voz y glosario** (Ágora, Cursus honorum, Koiná, Pharos, Polis... cómo se explican al usuario que no sabe griego).
9. **Estilo cartográfico documentado** (paleta para layers OSM, anchos de stroke por tipo de vía, escalas de coropleta, tipografía de labels).
10. **Versiones para impresión y físico** si va a haber cartelería en barrios.

## 7 · Lo que NO hay que tocar

- El canon iso 2.5D (proyección, primitiva cubo, outline volcánico, sombra de contacto). Es la firma. Mantener intacto.
- La paleta nombrada de 12 tokens. Está bien — solo hay que formalizarla y eliminar los hex sueltos del visor.
- La relación entre sub-marcas y motivos arquetípicos (ágora=stoa, biblioteca=templo+rollo, pharos=faro, ocre=estratos, cursus=pirámide+laurel, koiná=ánforas). Es buena escritura visual.
- El uso de la sección censal como pieza de juego visualizada en iso. Une marca y producto.

## 8 · Próximos pasos sugeridos

Por orden:

1. **Decidir light/dark** (esta conversación, 5 minutos).
2. **Decidir arquitectura de marca** (esta conversación o la siguiente, 15-30 minutos con un diagrama).
3. **Sacar los tokens** del `generate.py` y del `polis-provincia.html` a un único `tokens.json` + `globals.css` (1 sesión de trabajo).
4. **Elegir las tres fuentes** y declararlas en el `@theme inline` (40 min).
5. **Empezar el manual de marca** como un `.md` vivo en `/design/MANUAL.md` con secciones: arquitectura, logo, color, tipografía, iconografía, componentes (1-2 sesiones para v0).
6. **Construir el `.fig`** con los logos importados, los tokens como variables y los componentes base. Esto es lo que vas a usar para todo el front-end de aquí en adelante.

Cuando estos 6 estén hechos, tienes la base que toda agencia entrega como "sistema mínimo viable" antes de empezar a aplicarlo a cada superficie del producto.
