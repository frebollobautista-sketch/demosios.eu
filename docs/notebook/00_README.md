# KOINOS — Notebook de proyecto

**Carpeta:** KOINOS
**Estado:** Documentación viva — abril 2026
**Autor:** Pancho + sesiones Claude / Cowork
**Propósito:** unificar ideas, decisiones y referencias del proyecto para que cualquier sesión (de Claude, de NotebookLM o propia) pueda retomar el trabajo sin perder contexto entre iteraciones de vibe coding.

---

## 1. Qué es KOINOS

KOINOS es una **plataforma cívica gamificada** que propone una forma distinta de habitar el espacio digital: ni feed infinito que optimiza atención, ni app de utilidad pura, sino una arquitectura de **tres modos** que cubren tres necesidades humanas distintas y complementarias.

| Modo      | Necesidad que cubre                           | Metáfora                     | Color UI    |
|-----------|-----------------------------------------------|------------------------------|-------------|
| **TOUCH** | Intimidad, archivo personal, círculo cerrado  | La habitación propia         | `#FF6B6B`   |
| **FEED**  | Ideas, opinión, actualidad, diálogo           | La sobremesa                 | `#7C5CFC`   |
| **POLIS** | Ciudad, territorio, trámite, acción colectiva | La plaza                     | `#3DBBF0`   |

Los tres modos comparten una misma interfaz (rail flotante de medallas a la izquierda, tarjeta central estilo columna, diario plegable en la esquina superior derecha), pero cada uno **sustituye los verbos disponibles en el rail**. Esa es la decisión de diseño más distintiva hasta la fecha: el modo no solo cambia el contenido, cambia lo que puedes hacer.

---

## 2. Por qué existe este notebook

El proyecto se está desarrollando a través de **vibe coding / visual coding** con asistentes como Claude. Eso tiene dos consecuencias que obligan a escribir documentación:

1. **Los cambios se pierden entre sesiones.** Una decisión tomada el martes (por ejemplo, que el botón PEC muestra la cara del usuario encima del post en vez de un contador) puede perderse el jueves cuando otra sesión reintroduce un "like" estándar porque nadie escribió en algún sitio por qué no había like.
2. **Las ideas descartadas se olvidan.** Muchas funcionalidades buenas se quedan en el aire durante una conversación y nunca se trasladan al código. Este notebook sirve como **log explícito** de esas ideas, para poder rescatarlas.

El notebook es el **contrato de memoria** del proyecto. Cuando una sesión de Claude empiece en esta carpeta, leer `00_README.md` y los 4 archivos a los que apunta es suficiente para entender qué es KOINOS, qué decisiones están tomadas, qué queda abierto y qué ideas están en cola.

---

## 3. Estructura del notebook

```
KOINOS/docs/notebook/
├── 00_README.md                       ← este archivo (mapa general)
├── 01_TOUCH.md                        ← investigación + gaps + backlog del modo íntimo
├── 02_FEED.md                         ← investigación + gaps + backlog del modo público
├── 03_POLIS.md                        ← investigación + gaps + backlog del modo cívico
├── 04_FUNCIONALIDADES_LOG.md          ← ideas descartadas / rescatables / sugerencias nuevas
└── 05_CONTEXTO_ETICO_Y_SEMBRADO.md    ← efectos del scroll, prácticas adversarias, estrategia de "Twitter histórico" para el cold-start
```

Además, en la raíz del proyecto:

- `POLIS_digitalizador_urbano.md` — documento específico sobre el pipeline pixel art para POLIS (calibrador, perfiles de material, Godot, Street View / Mapillary). Complementa `03_POLIS.md` con el detalle técnico del digitalizador urbano.

La misma documentación se mantiene en espejo en `The Lighthouse/Documentación/` para consulta desde Notebook/NotebookLM aunque la carpeta KOINOS no esté conectada.

---

## 4. Decisiones de diseño ya tomadas (resumen)

Estas decisiones son las que **no deberían cambiarse sin discusión explícita**. Si una sesión de Claude propone algo que las contradice, la sesión está olvidando contexto.

### 4.1 Arquitectura de 3 modos (TOUCH / FEED / POLIS)

- El rail izquierdo cambia de verbos al cambiar de modo (`medalsFor(mode)` en `src/app/feed/page.tsx`).
- El color de acento cambia: rojo coral (TOUCH), violeta (FEED), azul (POLIS).
- Al cambiar de modo, la medalla activa vuelve a la primera del nuevo set.

### 4.2 PEC no es Like

El **PEC** (del verbo "PECar" sobre un post — véase comentarios en `feed/page.tsx` líneas 70–75 y 233–236) es un endorsement **encarnado**: al hacer PEC, tu avatar se pega visualmente al post, junto a los de otros usuarios que también lo han hecho. El like sigue existiendo como contador anónimo, pero el PEC es público, cuesta más socialmente y se acumula visualmente como una pequeña multitud en miniatura.

> "PEC is an embodied endorsement: your face is visible on the post, unlike a Like, which is anonymous and just bumps a counter." — `src/app/feed/page.tsx:70–75`

Esta decisión es la que diferencia a KOINOS de Twitter/X, Bluesky y Threads. No se debe sustituir por un contador.

### 4.3 Semáforo (verde / amarillo / rojo)

Los posts del feed llevan un punto de color (`SemaforoDot`, ~línea 333 de `feed/page.tsx`) que indica la **temperatura de veracidad/contexto** del contenido. Es una señal visual previa a cualquier lectura. El criterio de asignación todavía no está fijado (manual, comunitario, editorial, híbrido): es una pregunta abierta del proyecto.

### 4.4 Diario plegable (esquina superior derecha)

Un "doblez de página" en la esquina superior derecha abre un diario privado con checklists y notas (`diaryOpen`, líneas 2123+). Es persistente, personal, y no tiene nada que ver con el feed. Es un gesto deliberado para dar al usuario un espacio **dentro de la app** que no compite por su atención con el feed.

### 4.5 PHAROS como capa heredada

Las 8 secciones temáticas (`src/lib/pharos/secciones.ts`) y las 10 categorías (`src/lib/pharos/categorias.ts`) vienen de un proyecto anterior llamado **PHAROS**. Están migradas, no se reinventan. Las secciones PHAROS estructuran los algoritmos del FEED; las categorías PHAROS estructuran los pines de POLIS.

### 4.6 Stack técnico

- **Frontend:** Next.js (App Router, con nota en `AGENTS.md` de que este Next.js tiene breaking changes respecto al que Claude conoce por entrenamiento — leer `node_modules/next/dist/docs/` antes de escribir código).
- **Autenticación / datos:** Supabase.
- **Motor 2D para POLIS / digitalizador:** Godot.
- **Carpeta de assets de ciudad:** `godot/mercado_vegueta/`, `referencias/`, `estilos/`.

---

## 5. Relación con NotebookLM y Cowork

- **Cowork** (Claude con acceso a archivos locales) lee directamente este notebook al empezar cualquier sesión sobre KOINOS. La instrucción implícita es: si el usuario dice "trabaja en FEED", lee primero `02_FEED.md` y los comentarios relevantes en `src/app/feed/page.tsx`.
- **NotebookLM** puede consumir esta misma documentación como corpus. La ventaja es poder hacer preguntas tipo "¿por qué PEC y no like?", "¿qué secciones PHAROS tiene FEED?", "¿qué ideas de TOUCH descartamos?" sin tener que releer archivos enteros.
- El mismo notebook se guarda en `The Lighthouse/Documentación/` para consulta incluso si la carpeta KOINOS no está conectada en la sesión.

---

## 6. Cómo leer este notebook

- Si acabas de llegar al proyecto: lee este README, luego `01_TOUCH.md`, `02_FEED.md`, `03_POLIS.md` en ese orden.
- Si vas a tocar código de un modo concreto: lee el `.md` correspondiente **antes** de mirar el código.
- Si te preguntas "¿no teníamos antes esta idea?": mira `04_FUNCIONALIDADES_LOG.md` antes de reinventarla.
- Si la pregunta es sobre postura ética del proyecto, cómo competir sin replicar prácticas adversarias, o cómo semilla el contenido inicial del FEED con autores históricos: lee `05_CONTEXTO_ETICO_Y_SEMBRADO.md`.
- Si hay una contradicción entre este notebook y el código: **la decisión debe pasar por una conversación explícita**, no resolverse silenciosamente dentro de una sesión de vibe coding.

---

## 7. Pendientes abiertos del propio notebook

- Conectar y leer la carpeta `Notebook/GAMIFICACIÓN` (aún no accesible en la sesión actual). Su contenido alimenta la sección de mecánicas del log y la discusión del rail flotante como "tabla de clases / medallas".
- Cerrar el criterio del semáforo (verde/amarillo/rojo): ¿quién lo asigna?
- Definir el esquema de datos mínimo de PEC en Supabase (`pec_count`, `pec_avatars[]`, `user_pec_state`).
- Decidir si el Kiosko de TOUCH es público ofrecible hacia fuera de la red íntima o es escaparate solo para amigos.

---

*Generado en sesión Claude × Cowork — 12 abril 2026 — a partir del código actual de `/Users/panch/KOINOS` y del documento `POLIS_digitalizador_urbano.md`.*
