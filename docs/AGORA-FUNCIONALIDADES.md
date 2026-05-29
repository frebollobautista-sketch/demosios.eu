# Ágora — Inventario de funcionalidades

> **Filiación arquitectónica (2026-05-03):** Ágora es la pestaña del **YO** dentro de Demos iOS. Reemplaza a Twitter e Instagram en su función social cotidiana — la voz personal pública vive aquí. La Ágora griega era literalmente la plaza social donde la gente coincidía a charlar y a contar; aquí cabe lo que dices al mundo (Lógos) y lo que muestras (Eikón).
>
> Ver decisión arquitectónica completa en [`IDEAS.md → Arquitectura del proyecto`](./IDEAS.md#arquitectura-del-proyecto).
>
> **Importante:** este doc se reescribió el 2026-05-03 tras una clarificación con Pancho. La versión anterior interpretaba erróneamente que Ágora se dividía en sub-tabs Público/Íntimo. La división correcta es **Lógos / Eikón** (palabra / imagen), no público/íntimo. Lo íntimo se absorbe dentro de Eikón como toggle al publicar.

Resultado del inventario hecho con Pancho el 3 mayo 2026.

Estado de cada feature:
- ✅ implementado (en código actual de `src/app/feed/page.tsx`)
- ⚠️ parcial
- ❌ pendiente
- 🚫 descartado deliberadamente

---

## Decisiones cerradas el 2026-05-03 (cinco preguntas resueltas)

| Decisión | Resolución |
|---|---|
| **Comentarios** | Sí, **subposts encadenados que NO suben al feed principal**. Solo se ven al abrir el post raíz. Modelo notebook FEED 4.8. La conversación no se convierte en timeline paralelo. Si quieres iniciar un debate de fondo sobre un post, lo citas como germen y abres hilo en Bibliotheka. |
| **Like vs PEC** | **PEC con dos niveles**: silencioso (cuenta sin avatar) + público (avatar visible). El like se elimina. Coherencia radical con el núcleo conceptual del proyecto. |
| **Foto/Vídeo en Eikón** | **Mezclados con marcadores visuales claros**: el vídeo lleva play-icon + badge de duración; la foto va sin marcador. No se fragmenta la voz del autor entre sub-tabs. |
| **Transcripción de audio** | **Sí desde el día 1, vía Whisper API**. Coste estimado ~6 €/mes para 1.000 audios de 60s. Accesibilidad esencial + búsqueda por texto en audios. |
| **Formato de vídeo en Eikón** | **Solo vertical 9:16**. Estética coherente, móvil-first. El material horizontal queda fuera o requiere recorte previo por el autor. |

---

## Tesis del módulo

Ágora reemplaza dos cosas que la gente ya hace fuera de Demos iOS: contar lo que pasa en su día con palabras (Twitter, Threads, Mastodon) y compartir lo que ven con imágenes (Instagram, BeReal). Lo hace **bajo un mismo techo** porque ambos son actos del **YO** — solo cambia el medio.

Decisiones rectoras:

1. **Dos sub-páginas internas** con identidad fuerte: **Lógos** (palabra) y **Eikón** (imagen). Cada una tiene su propio feed, su propia gramática de composición, su propia disciplina visual.
2. **Toggle visible arriba** entre Lógos y Eikón al entrar a Ágora. Estilo de los tabs internos de Instagram (Posts/Reels/Tagged) o de Threads (Para ti/Siguiendo). Cambias con un tap, sin salir de Ágora.
3. **Apertura por defecto en la sub-página más usada**, memorizada. Si pasas más tiempo escribiendo en Lógos, abre en Lógos. Si pasas más tiempo subiendo fotos a Eikón, abre en Eikón.
4. **Lo íntimo (TOUCH absorbido) vive solo dentro de Eikón** como toggle "público / mi círculo" al publicar. Lógos es siempre público — la palabra es para compartir. Si quieres algo solo para ti, está en notas, no en Demos iOS.
5. **Sin pretensión deliberativa**. Ágora no es para debates — esos viven en Bibliotheka. Si quieres abrir un debate, te llevamos allá.

---

## Sub-página Lógos (Λόγος) — la palabra

> **Tesis:** Lógos es el espacio del pensamiento público compartido. Texto, citas, ideas cortas, anuncios cotidianos, voz hablada (audio breve). Es el modo Twitter del proyecto, en clave griega.

### Tipos de post en Lógos

| Tipo | Contenido | Tamaño máx | Renderizado |
|---|---|---|---|
| **Texto** | Texto puro | ~500 chars | Card de texto plano |
| **Cita** | Texto + autor + fuente | 280 chars cita | Card con tipografía serif distinta, autor en cursiva |
| **Audio** | Clip de voz, hasta 60 s + caption opcional | 5 MB | Waveform + play/pause; **transcripción automática (Whisper API) desde el día 1** |

> **Asunción confirmada (2026-05-03):** el audio vive en Lógos porque es palabra hablada, no imagen. La transcripción automática es accesibilidad esencial y permite búsqueda full-text en audios.

### Visibilidad en Lógos

> **Asunción explícita (2026-05-03):** Lógos es **siempre público** (no admite modo privado/círculo). Razón política: la palabra es para compartir; preservar un espacio público fuerte es coherente con la tesis republicana del proyecto.

### Composición de un post Lógos

| Feature | Estado | Notas |
|---|---|---|
| Componer texto | ✅ | En `src/app/feed/page.tsx` |
| Cita incrustada (autor + fuente) | ✅ | Modelo Marco Aurelio: `cita_text`, `cita_author`, `cita_source` |
| Grabar/subir audio ≤60 s | ❌ | Storage + waveform + transcripción auto (deferida si requiere infra cara) |
| Etiqueta opcional de sección PHAROS | ❌ | Permite que el algoritmo del usuario filtre |
| Etiqueta opcional de territorio (isla/municipio/barrio) | ❌ | Coherente con Bibliotheka y Polis para que "Mi Quiosco" cruce capas |
| Reposo de 10 min antes de publicar | ❌ | Borrador en Diario; usuario puede editar/eliminar antes |
| Vista previa antes de publicar | ❌ | "Así se verá" |

### Visualización del feed Lógos

| Feature | Estado | Notas |
|---|---|---|
| Lista vertical cronológica (más reciente arriba) | ⚠️ | El feed actual ya es cronológico |
| Card distinta por tipo (texto / cita / audio) | ❌ | Hoy todos los posts se ven iguales |
| Posts de IA (`isAI`, `aiLabel`) con formato propio | ⚠️ | Existe el flag, falta diferenciar visualmente |
| Sin scroll infinito (paginación o "cargar más" manual) | ❌ | Anti-doomscroll |
| **Algoritmo del usuario** con deslizadores de peso PHAROS | ❌ | Notebook FEED 4.7 — convierte el algoritmo en juguete transparente |
| Modo lectura (sin botones de PEC/like) | ❌ | Releer sin presión de reaccionar |

---

## Sub-página Eikón (Εἰκών) — la imagen

> **Tesis:** Eikón es el espacio de lo visual compartido. Fotos sueltas, carruseles, vídeos cortos. Es el modo Instagram del proyecto, en clave griega. Aquí también vive lo íntimo (TOUCH absorbido) como modo privado al publicar.

### Tipos de post en Eikón

| Tipo | Contenido | Tamaño máx | Renderizado |
|---|---|---|---|
| **Foto suelta** | 1 imagen + caption opcional | 8 MB, jpg/png/webp | Imagen ancho completo + caption debajo |
| **Carrusel** | 2-10 imágenes + caption opcional | 8 MB c/u | Primera imagen + indicador `1/N` + swipe horizontal |
| **Vídeo corto** | 1 vídeo vertical 9:16 hasta 60 s + caption opcional | 50 MB, mp4/mov | Thumbnail + play-icon + badge de duración; tap-to-play; **no autoplay** |

> **Decisión confirmada (2026-05-03):** vídeo solo en formato vertical 9:16. Foto y vídeo se mezclan en el mismo feed Eikón con marcadores visuales claros (play-icon + badge de duración para vídeo); no se fragmentan en sub-sub-tabs.

### Visibilidad en Eikón — el toggle público/círculo

Cada post de Eikón se publica con un **interruptor explícito de visibilidad**:

- **Público** — visible en el feed Eikón global de Demos iOS, abierto a cualquier usuario (modo Instagram clásico).
- **Mi círculo** — visible solo a las personas que tú has aceptado en tu círculo (modo Close Friends + el TOUCH original).

| Feature | Estado | Notas |
|---|---|---|
| Toggle público/círculo en el compositor | ❌ | Decisión visual: switch grande, no escondido |
| Modelo de **círculo de tres niveles** (íntimos / cercanos / conocidos — D3 del 2026-04-20) | ❌ | El usuario puede afinar más allá del binario público/círculo: "esta foto va solo a íntimos", "esta a cercanos también" |
| Indicador visual claro en cada post de su nivel de visibilidad | ❌ | Icono candado o similar; no se confunde un post íntimo con uno público al verlo |
| Vista del lector: "modo íntimo" filtra solo posts de mi círculo / "modo público" solo abierto / "todo" mezcla | ❌ | Sub-toggle dentro de Eikón |
| El feed por defecto mezcla los dos cuando aplique (los íntimos de tu círculo + los públicos de gente que sigues) | ❌ | Coherente con cómo Instagram mezcla seguidos y Close Friends |

### Composición de un post Eikón

| Feature | Estado | Notas |
|---|---|---|
| Subir 1 imagen | ⚠️ | UI existe; storage Supabase pendiente |
| Subir carrusel (2-10) | ❌ | Necesita `post_media` con `position` |
| Grabar/subir vídeo ≤60 s | ❌ | Storage + límite duración + thumbnail |
| Caption opcional | ❌ | A diferencia de Lógos, en Eikón el texto es opcional |
| Caption oculta en grid (notebook TOUCH §3) | ❌ | Tap revela texto; long-press edita. Mantiene el principio "consentimiento progresivo" |
| Etiquetar a personas del círculo en una foto | ❌ | Solo si publicas en modo "mi círculo" |
| Etiqueta opcional de sección PHAROS | ❌ | |
| Etiqueta opcional de territorio | ❌ | |
| Reposo de 10 min antes de publicar | ❌ | Mismo principio que Lógos |

### Visualización del feed Eikón

| Feature | Estado | Notas |
|---|---|---|
| Vista por defecto: grid 3-columnas (estilo Instagram) | ❌ | |
| Vista alternativa: lista vertical cronológica con imagen ancho completo | ❌ | Toggle del usuario |
| Vista alternativa: vista cronológica vertical estilo Day One (notebook TOUCH 4.5) | ❌ | Especialmente útil para tu propio archivo |
| Indicador candado en posts del círculo | ❌ | Distingue público de íntimo de un vistazo |
| Sin scroll infinito | ❌ | Anti-doomscroll |
| **Modo lectura** (sin botones de acción) | ❌ | Releer/ver sin presión |

---

## Lo común a las dos sub-páginas

### Señales (lo que hace el lector con un post)

| Feature | Estado | Notas |
|---|---|---|
| **PEC con dos niveles** | ❌ | **Núcleo del producto.** Dos intensidades: *PEC silencioso* (incrementa contador, sin avatar visible) + *PEC público* (avatar visible junto al post). El usuario elige al pulsar. |
| ~~Like anónimo~~ | 🚫 | **Eliminado el 2026-05-03**. El like se sustituye por el nivel silencioso del PEC. Coherencia radical. |
| **Comentar como subpost encadenado** | ❌ | **Decidido el 2026-05-03**. Los comentarios solo se ven al abrir el post raíz; no suben al feed principal. La conversación no se convierte en timeline paralelo. Si quieres iniciar debate de fondo, citas el post y abres hilo en Bibliotheka. |
| Reportar contenido | ⚠️ | Tabla `reports` existe, falta cablear |
| Bloqueo personal de usuario | ❌ | |
| Reacciones múltiples (gracias / útil / etc.) | 🚫 | Quedan en Bibliotheka-debate; en Ágora solo PEC (silencioso + público) |
| **Guardar post de Eikón en mi propio archivo** | ❌ | Patrimonio personal; conexión con la idea Day One del archivo |
| **Citar post como germen de obra en Bibliotheka** | ❌ | Conexión Ágora → Bibliotheka |

### Anti-patrones cerrados (la disciplina del módulo)

- 🚫 **Scroll infinito** — paginación honesta o "cargar más" manual.
- 🚫 **Algoritmo opaco** — el usuario diseña el filtro, lo entiende y lo edita.
- 🚫 **Trending global** que amplifica lo escandaloso.
- 🚫 **Conteo público de seguidores** como ranking. Cada uno sabe los suyos; nadie compara.
- 🚫 **Stories 24h**. La presión de presencia continua mata la voz reflexiva.
- 🚫 **Streaks** ("llevas 14 días publicando").
- 🚫 **"X está escribiendo…"** o "Y leyendo en este momento".
- 🚫 **Notificaciones push individuales** por cada PEC/like. Solo digest agrupado.
- 🚫 **DMs / mensajes privados**. La otredad mediatizada está postpuesta (decisión política, ver IDEAS.md).
- 🚫 **Reels infinitos / autoplay de vídeo en el feed**. Vídeo siempre tap-to-play.
- 🚫 **Algoritmo de "personas que podrías conocer"**.
- 🚫 **Filtros de belleza / efectos AR** integrados en el compositor.

### Patrones de bienestar (que SÍ tendrá Ágora — comunes a Lógos y Eikón)

- ❌ **Tiempo en pantalla visible** desde el primer pliegue de la home (en Mi Quiosco).
- ❌ **Cierre voluntario** ("cerrar por hoy") — sin notificaciones hasta el día siguiente.
- ❌ **Reposo de 10 min** antes de publicar — borrador editable.
- ❌ **Notificaciones por digest** cada N horas (configurable, default 6h).
- ❌ **Pausa de cuenta** sin perderla.
- ❌ **Panel de transparencia** ("qué sabe Demos iOS de ti").
- ❌ **Cap diario blando de PEC** (notebook §5.2 — propuesta: 20/día).
- ❌ **Mute temporal de la otra sub-página** ("solo Lógos esta semana", "sin Eikón hoy") — coherente con el principio de algoritmo del usuario.
- ❌ **Modo lectura** sin botones de acción.

---

## Pendiente de decidir

> Las preguntas #1, #2, #6, #7 y #8 originales se cerraron el 2026-05-03 (ver "Decisiones cerradas" arriba). Quedan estas:

1. **¿Cap diario de PEC, de posts?** La fricción cívica suave protege la calidad. Recomendación: 20 PECs/día, 5 posts/día como límites blandos.
2. **¿Etiquetado de sección PHAROS obligatorio o opcional al publicar?** Necesario para que el algoritmo del usuario funcione. Recomendación: opcional pero con sugerencia automática del modelo (LLM ligero o reglas) al guardar.
3. **¿Etiquetado territorial obligatorio o opcional?** Si es opcional, los posts sin geo no aparecen al filtrar por barrio. Recomendación: opcional pero pre-rellenado con tu barrio declarado.
4. **¿Cross-posting Lógos ↔ Eikón?** Por ejemplo: foto de Eikón con cita incrustada (texto largo) que aparece en ambos feeds. Recomendación: forzar elegir uno (mantiene la disciplina de cada sub-página).
5. **¿"Modo cena" del Álbum (notebook TOUCH 4.3)** se aplica solo en Eikón íntimo? Es un álbum temporal con cierre tras 48h. Recomendación: sí, vive como variante del modo "mi círculo" en Eikón.
6. **¿Quién asigna el color del semáforo de veracidad (notebook FEED 4.2)?** Decisión política importante. Aplica especialmente a Lógos. Tres modelos posibles: autodeclaración del autor, voto comunitario, filtro editorial PHAROS, o híbrido.

---

## Bloques de implementación (priorización sugerida)

**AB1 — Persistencia mínima de Lógos** (~1 sesión)
Esquema Supabase: `posts_logos`, `pecs`, `likes`. Cableado del PEC con avatar real. Soft-delete con placeholder. Tipos: texto, cita, audio (deferido).

**AB2 — Persistencia mínima de Eikón** (~1 sesión)
Esquema Supabase: `posts_eikon`, `post_media` (para carrusel y vídeo), tabla de visibilidad por nivel. Storage Supabase para imágenes y vídeos.

**AB3 — Toggle público/círculo + modelo de tres niveles** (~2 sesiones)
Tabla `circulos` con tres niveles. UI invitar/aceptar silenciosa. Toggle al publicar en Eikón. Filtro de visibilidad correcto en el feed.

**AB4 — Composición rica para los dos feeds** (~2 sesiones)
Compositor de Lógos (texto + cita + audio). Compositor de Eikón (foto suelta, carrusel, vídeo). Reposo 10 min antes de publicar.

**AB5 — Algoritmo del usuario operativo** (~1 sesión)
Cableado de toggles + deslizadores de peso PHAROS + preview en vivo. Aplica solo a Lógos por ahora; Eikón usa solo cronológico + cuenta seguida + círculo.

**AB6 — Anti-patrones de bienestar** (~1 sesión)
Tiempo en pantalla visible, cierre voluntario, digest, pausa, panel de transparencia, mute temporal por sub-página, modo lectura.

**AB7 — Conexiones cross-pestaña** (~1 sesión)
"Citar post como germen de obra en Bibliotheka". "Guardar post de Eikón en mi archivo personal". Operacionaliza puentes Ágora → Bibliotheka y Ágora → archivo.

**AB8 — Comentarios o no** (decisión + ~1 sesión si sí)
Resolver pregunta abierta #1.

**AB9 — Sub-sub-tabs Foto/Vídeo en Eikón** (decisión + ~0.5 sesión si sí)
Resolver pregunta abierta #6.

---

## Integración con la home unificada "Mi Quiosco"

Ágora contribuye a una banda en el quiosco con:

- Posts recientes de gente que sigues (cronológico) — mezcla Lógos + Eikón cuando ambos son públicos.
- Hasta 3 posts del Algoritmo del usuario (Lógos solo).
- Avisos discretos cuando alguien de tu círculo sube algo nuevo a Eikón íntimo.
- Recordatorios ocasionales del archivo personal — "hace 1 año en tu Eikón…" (estilo Day One).

Cero ruido. La home no ofrece "lo más visto". Ofrece **lo que viste tú** + **lo que pediste ver**.

---

## Lo que NO va en Ágora

- 🚫 Hilos de debate, comentarios anidados profundos, propuestas votables — eso es Bibliotheka · Debate.
- 🚫 Publicación de obras largas, ensayos, vídeos documentales largos — eso es Bibliotheka · Obras.
- 🚫 Pines geográficos, intercambio anclado al territorio — eso es Polis.
- 🚫 Mensajería privada uno-a-uno — postpuesto (decisión política).
- 🚫 Grupos cerrados con membresía explícita — postpuesto.
- 🚫 Live streaming — fuera del alcance.
