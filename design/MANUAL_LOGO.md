# KOINOS · Manual de logo v1

> Reglas canónicas de uso del logotipo KOINOS y sus 7 sub-marcas (OCRE, POLIS, ÁGORA, BIBLIOTHEKA, PHAROS, CURSUS, KOINÁ). Si vas a entregar material a un proveedor externo, adjunta este documento + la carpeta `svg/` + `tokens.css`.
>
> Versión: v1 · 2026-05-09 · Pancho Suárez

## 1 · Versiones del logo

Cada una de las 8 marcas existe en cuatro versiones. El generador `generate.py` produce las cuatro automáticamente para cada pieza al correrlo.

### A · Color (master)

La versión por defecto. Disco con cielo crema → arena, motivo isométrico 2.5D con sombra de contacto, acentos terracota y oro, wordmark inferior en Archivo Black con tracking 11.

**Cuándo se usa**: web, app, presentaciones, papelería oficial, redes sociales, OG images, cabeceras institucionales. **Es la versión por defecto** — siempre que se pueda imprimir/mostrar a color, se usa esta.

**Archivos**: `svg/<name>.svg` · `png/<name>.png`

### B · Monocromática

Una sola tinta volcánica (`#221d18`) sobre fondo papel (`#fbf4dd`). Se conserva el outline pero se eliminan todos los rellenos.

**Cuándo se usa**: impresión a una tinta, fax, sello, watermark, embossing, grabado en papel, contextos donde el color no está garantizado o sería mal interpretado (memorias institucionales, anexos legales).

**Archivos**: `svg/<name>.mono.svg` · `png/<name>.mono.png`

### C · Inverse / negativo

Sobre fondo volcánico (`#221d18`). Outline papel, top-faces papel translúcido, los acentos terracota y oro se conservan para mantener el código semántico.

**Cuándo se usa**: cualquier fondo oscuro — modo nocturno del visor POLIS, presentaciones con tema oscuro, banners sobre fotografía contrastada, merchandising negro.

**Archivos**: `svg/<name>.inverse.svg` · `png/<name>.inverse.png`

### D · Single-color / tinta

Outline de un solo color sobre cualquier fondo de la paleta. Se usa el blanco (`paper_lt`) sobre fondos de color saturado. Pierde el detalle interno (el ojo del faro, el cráter ocre).

**Cuándo se usa**: co-branding (cuando otra marca dicta el color), aplicaciones físicas (chapas esmaltadas, neón, metacrilato), uniformes y merchandising mono-tinta.

**Archivos**: `svg/<name>.tint.svg` · `png/<name>.tint.png`

## 2 · Lockups · 4 configuraciones

### A · Vertical (default)

Isótipo arriba, wordmark debajo, tagline opcional. **Es la configuración default** — la que se usa en `svg/<name>.svg`. Pensada para brand-board, OG images, hero de página, cartelería institucional.

Proporciones canónicas (caja 1024×1024):
- Disco a `cy = 532`, radio 430.
- Wordmark a `y = 914`, font-size 86, letter-spacing 11.
- Tagline a `y = 958`, font-size 22, letter-spacing 8.

### B · Horizontal

Isótipo izquierda, wordmark + tagline apilados a la derecha. Para headers, navegación, footers, tarjetas de visita.

Proporciones recomendadas:
- Caja 280×130 mínima.
- Isótipo a la izquierda, ocupando ~45% del ancho.
- Espacio entre isótipo y wordmark = altura X del wordmark.
- Wordmark vertical-centered con la mitad del isótipo.

**Archivos**: `svg/<name>.horizontal.svg`

### C · Isotipo solo

Solo la pieza isométrica con disco, sin wordmark. Para usar cuando el contexto de marca ya está dado (avatar de Twitter cuando el handle es @koinos, segunda mención dentro de un mismo deck, etc.).

**Archivos**: `svg/<name>.tile.svg` (ya existe en el repo).

### D · Monograma

La pieza más reducida. Un cubo con la letra en Archivo Black sobre la cara superior. Pierde toda la complejidad del isótipo a cambio de ser legible a 16px.

Letra por marca:

| Marca | Letra |
|---|---|
| KOINOS | K |
| OCRE | O |
| POLIS | P |
| ÁGORA | A |
| BIBLIOTHEKA | B |
| PHAROS | Φ (alt: F) |
| CURSUS | C |
| KOINÁ | κ (lowercase griega, evita colisión con KOINOS) |

**Cuándo se usa**: favicon, app icon, watermark, badges en avatares de juego, cualquier espacio < 24 px, marca de agua impresa.

**Archivos**: `svg/<name>.monogram.svg` · `png/<name>.monogram.png`

## 3 · Construcción

### Grid base

El logotipo maestro se construye en una caja de 220 × 220 unidades (la rejilla de referencia) con eje vertical y horizontal centrados.

- Rejilla base: 22 × 22 unidades (10% de la caja).
- Disco maestro: radio 88 (80% de la caja).
- Eje del isótipo: centrado en el disco.
- Espacio inferior reservado para wordmark: 32 unidades de altura.

### Espacio libre · X-height

El logo respeta un margen mínimo igual a la **altura X del wordmark** (la altura de la "O" mayúscula de KOINOS) en los cuatro lados. Eso significa:

- Para wordmark a 86 px: margen ≥ 64 px (la "O" de Archivo Black mide ~64 px a font-size 86).
- Para wordmark a 16 px: margen ≥ 12 px.

**Excepción**: en el lockup horizontal, el espacio entre isótipo y wordmark puede reducirse a 0.5X siempre que el conjunto respete X en los bordes externos.

## 4 · Tamaños · mínimos garantizados

| Aplicación | Tamaño | Versión a usar |
|---|---|---|
| App icon (iOS/Android home) | 96 × 96 px | Monograma sobre cubo volcánico |
| macOS dock / sidebar | 64 × 64 px | Monograma |
| Favicon HD | 32 × 32 px | Monograma |
| Favicon mínimo | 16 × 16 px | Monograma (letra ocupa 50%) |
| Wordmark cómodo | desde 28 px | Wordmark + tagline |
| Wordmark mínimo | 16 px | Solo wordmark, sin tagline |
| Logo completo (vertical lockup) | desde 96 px de alto | Versión color/master |
| Print mínimo | 12 mm de alto | Monocromática |

**Por debajo de 12 px** no muestres marca — deja la zona libre. Mejor un logo ausente que uno ilegible.

## 5 · Aplicación sobre fondos

| Fondo | Versión recomendada | Notas |
|---|---|---|
| `--paper` `#fbf4dd` | A · Color (master) | Default. Es el fondo previsto. |
| `--cream` `#f4ead4` | A · Color | Funciona, los blancos del logo se confunden ligeramente. |
| `--sand` `#c8b898` | A · Color | Funciona, ya hay contraste. |
| `--ocre` `#b07840` | D · Single-color tinta | Usar `paper_lt` sobre el fondo. |
| `--terracotta` `#c85438` | D · Single-color tinta | Usar `paper_lt`. |
| `--volcanic` `#221d18` | C · Inverse | Acentos terracota y oro intactos. |
| `--blue-dk` `#3a5878` | D · Single-color tinta | Usar `paper_lt`. |
| Fotografía clara | A · Color sobre disco | El disco crea el contenedor visual. |
| Fotografía oscura | C · Inverse sobre disco | Idem. |
| Fotografía mixta | D · Single-color tinta sobre overlay | Aplica overlay sólido `--volcanic/40%` antes del logo. |

## 6 · Don'ts · prohibido

- **No cambiar la paleta del logo.** Los acentos terracota y oro tienen significado semántico (rojo plebeyo + oro patricio). Cambiarlos rompe la lectura.
- **No rotar ni inclinar.** El isótipo está construido a 30° por proyección isométrica. Cualquier rotación adicional rompe la geometría.
- **No deformar las proporciones.** El logo nunca se estira horizontal o verticalmente. Si necesita caber en una caja específica, se reescala proporcionalmente.
- **No usar otra tipografía.** El wordmark va en Archivo Black, la tagline en Inter 500. Sustituir por Times, Comic Sans, Helvetica, etc. invalida la marca.
- **No añadir sombras, glows, gradientes externos, drop-shadows o efectos de bisel.** El isótipo ya tiene su propia sombra de contacto integrada — eso es todo.
- **No mezclar con otra marca sin reglas.** El co-branding requiere documento aparte (ver §8).
- **No alterar el espacio entre isótipo y wordmark** del lockup vertical. La distancia es parte de la marca.
- **No invertir colores arbitrariamente.** Si necesitas oscuro, usa la versión inverse oficial — no hagas un negativo improvisado del archivo color.
- **No recortar el disco.** Si el espacio no es cuadrado, usa el lockup horizontal o el isotipo sin disco (`.tile.svg`).
- **No alterar el orden de los elementos** (disco · sombra · plinth · cráter ocre · ojo terracota · oro). Cada capa tiene un significado y un orden de pintor establecido.

## 7 · Co-branding

Cuando KOINOS aparece junto a otra marca (ayuntamiento, organización aliada, sponsor), respetar:

1. **Tamaño paritario** — los logos van al mismo tamaño visual (no necesariamente mismo ancho, sino misma "presencia óptica").
2. **Separador** — una línea vertical de 0.5px en `--volcanic` o un espacio igual a 2X.
3. **Orden** — KOINOS a la derecha en contextos donde KOINOS es el sello (cuando es una iniciativa propia). KOINOS a la izquierda en contextos donde KOINOS es el participante.
4. **Versión** — ambos logos van en la misma versión (color, mono, inverse, tint). Nunca color KOINOS junto a mono ayuntamiento.
5. **Aprobación** — cualquier co-branding nuevo requiere visto bueno de Pancho antes de imprimirse.

## 8 · Aplicación a las 8 marcas

Las reglas de §3, §4, §5 y §6 aplican idénticas a las 8 marcas. Lo único que cambia es:

- La pieza isométrica central (cada una tiene su motivo arquitectónico).
- El wordmark (KOINOS, OCRE, POLIS, ÁGORA, BIBLIOTHEKA, PHAROS, CURSUS, KOINÁ).
- La letra del monograma (ver tabla en §2.D).

El resto — proporciones, tracking, espacio libre, tamaños mínimos, paleta, prohibiciones — es compartido. **Si tocas una regla, la tocas para las 8.**

## 9 · Generación

Al correr `python3 design/generate.py` se producen para cada una de las 8 marcas:

```
svg/<name>.svg              ← color · master · vertical
svg/<name>.tile.svg         ← isotipo · transparente · sin wordmark
svg/<name>.mono.svg         ← monocromática · 1 tinta volcánica
svg/<name>.inverse.svg      ← negativo · sobre obsidiana
svg/<name>.tint.svg         ← single-color · tinta papel
svg/<name>.horizontal.svg   ← lockup horizontal
svg/<name>.monogram.svg     ← monograma · letra en cubo

png/<name>.png              ← raster 1024×1024 del master
png/<name>.mono.png
png/<name>.inverse.png
png/<name>.tint.png
png/<name>.horizontal.png
png/<name>.monogram.png
png/tile/<name>.tile.png
png/favicon/<name>-16.png   ← favicon 16
png/favicon/<name>-32.png   ← favicon 32
png/favicon/<name>-64.png   ← favicon 64
```

Total: **8 marcas × ~14 archivos = 112 archivos**.

Requisitos:
- Archivo Black instalada en el sistema (Google Fonts → descargar → Font Book).
- Inter instalada en el sistema.
- `pip install cairosvg`.

## 10 · Distribución

Para entregar a un proveedor externo (imprenta, agencia, cliente):

1. La carpeta `design/svg/` completa (todos los formatos).
2. Una selección de PNGs en `design/png/` (master + favicon + inverse).
3. Este documento (`MANUAL_LOGO.md`).
4. `tokens.css` o `tokens.json` (la paleta).
5. La declaración de fuentes oficiales (Archivo Black, Inter, JetBrains Mono — todas OFL · enlaces a Google Fonts).

Empaqueta como `koinos-brand-kit-v1.zip` y envía con permiso de uso explícito.
