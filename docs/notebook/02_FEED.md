# FEED — Modo público

> "PEC is an embodied endorsement: your face is visible on the post, unlike a Like, which is anonymous and just bumps a counter."
> — `src/app/feed/page.tsx:70–75`

> **Filiación arquitectónica (2026-05-02):** FEED es el módulo del **YO público** dentro del marco YO/NOSOTROS/ELLO de Demos iOS. Twitter/Instagram-like: el individuo se expresa hacia quien quiera leerlo. Comparte gramática (post corto + media + endorsement) con TOUCH (el yo íntimo) pero diverge en alcance. Ver decisión arquitectónica completa en [`docs/IDEAS.md → Arquitectura del proyecto`](../IDEAS.md#arquitectura-del-proyecto).

---

## 1. Qué es FEED

FEED es el modo **público discursivo** de KOINOS. Es donde pasan las ideas: textos cortos, citas, noticias, opiniones, hilos temáticos. Es la sobremesa digital del proyecto.

A diferencia de un feed de Twitter/X, Bluesky o Threads, FEED tiene tres decisiones de diseño que lo distinguen:

1. **PEC en lugar de like** — el endorsement es encarnado: tu avatar se pega al post.
2. **Semáforo de veracidad** — los posts llevan un punto verde / amarillo / rojo que informa sobre el estado de la información antes de leerla.
3. **El algoritmo lo construye el usuario** — existe una medalla "Algoritmo" que expone las 8 secciones PHAROS como intereses activables, y el usuario decide qué ejes quiere que pesen en su timeline.

### 1.1 Submodos activos en el código

Definidos en `FEED_MEDALS` (líneas 368–373 de `src/app/feed/page.tsx`):

| Medalla   | Icono    | Qué hace                                                                       |
|-----------|----------|--------------------------------------------------------------------------------|
| Escribir  | PenLine  | Redacta un post propio. Panel `EscribirPanel` línea ~822.                      |
| Amigos    | Users    | Timeline filtrado por gente que ya sigues.                                     |
| Noticias  | Newspaper | Panel `NoticiaPanel` (línea ~477), alimentado por `api/noticias/route.ts`.    |
| Algoritmo | Cpu      | Panel `AlgoritmoPanel` (línea ~918). Expone las 8 secciones PHAROS como filtros activables para moldear el timeline del usuario. |

Además, en la misma pantalla conviven elementos globales: **Diario** (esquina plegada), **semáforo** (`SemaforoDot`), **rail de medallas** (`FloatingRail`), y la **cabecera** donde se cambia entre TOUCH / FEED / POLIS.

### 1.2 Secciones PHAROS que alimentan el FEED

De `src/lib/pharos/secciones.ts`:

1. Salud, servicios sociales y economía reproductiva
2. Cambio climático y autonomía estratégica
3. El común
4. Migración y cooperación al desarrollo
5. Defensa, geopolítica y seguridad ciudadana
6. Medios de comunicación y desinformación post-moderna
7. Industria, energía y transición sostenible
8. Cartera de trabajo de la 4ª Revolución Industrial

Estas 8 secciones **no se reinventan**: son el molde temático heredado de PHAROS. Toda la taxonomía de FEED pasa por ellas.

---

## 2. Investigación: qué están haciendo otros

### 2.1 Community Notes: la gran apuesta de X y sus imitadores

Desde 2021 X ha empujado *Community Notes* como sustituto del fact-checking profesional. En 2024 lo adoptó YouTube, en 2025 Meta anunció que cerraba su programa de terceros en EE.UU. y TikTok lanzó *Footnotes*. El modelo dominante en 2026 es:

- Cualquier usuario puede escribir una nota sobre un post.
- Un algoritmo público (publicado por X) exige **acuerdo cruzado** entre perfiles de puntos de vista distintos para mostrar la nota.
- Solo un ~11% de notas llegan a "helpful". El tiempo medio hasta alcanzarlo es ~15.5 horas, lo cual limita su capacidad para frenar desinformación en tiempo real.
- Hay evidencia (Nature Communications, 2025) de que los posts con nota pública se borran un 32% más que los que solo tienen nota privada. Eso sugiere que la corrección por pares **empuja a la autocorrección** más que a la retirada forzosa.

**Lectura para KOINOS:** el semáforo verde/amarillo/rojo no compite con Community Notes — es una **capa previa** más rápida y menos costosa cognitivamente. El usuario no tiene que leer la nota para entender el estado. El semáforo señala, la nota explica. Son complementarios.

### 2.2 pol.is y la construcción de consenso

pol.is (y su aplicación más célebre, **vTaiwan**) hace algo que ningún feed convencional hace: **agrupa a los participantes por patrón de voto** y dibuja un mapa de opiniones donde emergen islas de consenso y de disenso. vTaiwan lleva 200.000 participantes y ha contribuido a 26 piezas de legislación desde 2014. Desde 2024 funciona sin apoyo gubernamental directo, como laboratorio cívico voluntario.

El valor de pol.is es que **invisibiliza al tróll**: las voces que no encajan con ningún clúster grande se quedan en los bordes y no amplifican el ruido. Lo interesante no es lo más votado: es lo que más gente distinta vota a favor.

**Lectura para KOINOS:** hay un gap en FEED. El **Algoritmo** que hoy diseña el propio usuario eligiendo secciones PHAROS no captura este tipo de consenso emergente. Sería natural añadir una vista de tipo "mapa de opiniones" como un cuarto submodo (ver backlog 4.1).

### 2.3 El giro anti-algorítmico

En paralelo a Community Notes y pol.is, está el movimiento más general "anti-algoritmo": Vero, Ello, Behance, Mastodon. Su tesis común es que el feed cronológico elimina la ansiedad de performance y la manipulación por ranking. El problema es que el feed cronológico **no escala**: con 500 seguidos, el usuario ya no puede procesar.

**Lectura para KOINOS:** la respuesta no es algoritmo-ranking ni orden puro. Es **el usuario diseña su propio filtro**, que es exactamente lo que `AlgoritmoPanel` propone con las secciones PHAROS. KOINOS está alineado con esta tendencia. Falta hacer esa decisión visible y pedagógica en la UI.

### 2.4 La economía del endorsement encarnado

La crítica al like lleva años (Instagram probó ocultarlo en 2019). Pero ningún competidor ha sustituido el like por algo **más** social en vez de menos. BeReal quitó el like pero no lo reemplazó. KOINOS **añade** visibilidad: PEC pone tu cara en el post. Eso lo hace más caro socialmente, pero también más expresivo.

**Lectura para KOINOS:** el PEC es la mejor apuesta singular del proyecto. Es novedoso, es coherente con el modo cívico de POLIS, y diferencia a KOINOS de todo lo que hay. Hay que tratarlo como el núcleo del producto.

---

## 3. Gaps y necesidades no cubiertas

| Área                                      | Estado en KOINOS | Gap                                                                                  |
|-------------------------------------------|------------------|--------------------------------------------------------------------------------------|
| Criterio del semáforo                     | No definido      | ¿Quién asigna el color? ¿Manual por el autor, comunitario por votos, editorial PHAROS, híbrido? |
| Persistencia y esquema de PEC             | No definido      | Falta `pec_count`, `pec_avatars[]`, `user_pec_state`, `pec_at` en Supabase.          |
| Algoritmo editable                        | Panel en UI      | No está cableado al timeline real (las secciones PHAROS se muestran pero no filtran nada aún). |
| Mapa de consensos estilo pol.is           | No existe        | Oportunidad fuerte (ver 4.1).                                                        |
| Visibilidad del tipo de fuente            | No existe        | Un post de una persona, uno de un bot, uno traído por API de Noticias y uno citado (estilo Marco Aurelio línea 119) deberían verse distintos. Parcialmente ya: `isAI` y `aiLabel`. |
| Respuesta y debate encadenado             | No existe        | Sin hilos, FEED es solo tablón. Para ser sobremesa, falta el mecanismo de respuesta. |
| Exportación / archivo de lo que "PECas"   | No existe        | Si PEC es tan importante, el usuario debería poder ver su propio historial de PEC como colección. |
| Fricción contra el ruido                  | No explícita     | ¿Cuánto escribes antes de postear? ¿Hay un período mínimo de "reposo" entre post y publicación? Vale la pena estudiarlo. |
| Semilla de contenido editorial            | Parcial (`NoticiaPanel`) | ¿Qué fuentes alimentan `api/noticias/route.ts`? Definir criterio y rotación.  |

---

## 4. Backlog de ideas para FEED

### 4.1 Mapa de consensos (pol.is integrado en FEED)
Añadir un 5º submodo al rail del FEED: **Mapa**. El mapa dibuja cómo vota la comunidad sobre un tema abierto — por ejemplo, "¿Cómo debería KOINOS tratar la publicidad?" — y muestra clústeres de opinión. El algoritmo de pol.is es open source y puede integrarse sin reinventarlo. Esto le daría a KOINOS una dimensión deliberativa que ningún competidor español tiene.

### 4.2 Semáforo comunitario explicable
Cada punto de color se asigna por una **combinación** de: autodeclaración del autor (el que publica elige el color al postear y asume la reputación), votos del lector con "señal de ajuste" (subir/bajar), y un filtro editorial PHAROS que solo interviene en fuentes de noticias. La regla debe ser **transparente y auditable**: al tocar el punto, el usuario ve por qué está en amarillo. Esto es lo que Community Notes no hace bien: el dictamen es colectivo pero el *por qué* queda oculto.

### 4.3 PEC encadenado / genealogía de una idea
Cuando muchos usuarios PECan un post, se puede construir un **árbol de endorsement** que muestra quién influyó en quién. "María PECó a Carlos, Ana PECó el post después de ver a María". Eso convierte el PEC en un rastro social, no en una métrica. Usa `pec_at` temporal.

### 4.4 Estado de publicación con reposo
Antes de publicar un post, se guarda como borrador durante X minutos. Al usuario se le muestra "tu idea reposa durante 10 minutos antes de publicarse — puedes editarla o eliminarla hasta entonces". Fricción cívica. Resultado: menos impulsividad, más pensamiento. Usar el **diario** ya existente como espacio de reposo visual.

### 4.5 Sección-of-the-day
Cada día FEED destaca una de las 8 secciones PHAROS como foco editorial. El contenido de esa sección se eleva temporalmente. Ayuda a romper filter bubble sin romper la voluntad del usuario.

### 4.6 Citas como primera clase ciudadana
En el ejemplo de Marco Aurelio (línea 119–137) aparece un post `isAI: true` con `aiLabel: "Meditaciones, Libro III"`. Esto sugiere un tipo de post "cita de autor histórico". Formalizar como formato explícito: posts de cita llevan un estilo propio, vinculan al autor canónico, y pueden ser PECados como cualquier otro post pero cuentan para una sección especial del perfil ("lo que me hace pensar").

### 4.7 Algoritmo explicable con deslizadores
`AlgoritmoPanel` ya muestra las secciones como toggles. El siguiente paso es que cada sección tenga un **deslizador de peso** (0 a 100), y que el usuario vea en tiempo real qué 5 posts aparecerían si aplicara su configuración. El algoritmo es un *juguete*, no una caja negra.

### 4.8 Hilos / respuestas sin amplificación
Para no replicar el modelo X de respuestas que se convierten en timeline paralelo, las respuestas en KOINOS serían **subposts encadenados** que no salen al feed principal. Solo los ves si abres el post raíz. Mantener la sobremesa como tal sin convertirla en guerra cuerpo a cuerpo.

### 4.9 Clip de voz de 10 segundos como formato
Twitter/X empujó clip de voz y no cuajó, pero porque era un añadido. En KOINOS, un clip de 10 segundos como formato limitado por defecto (no editable, fuerza honestidad) podría diferenciar. Especialmente en POLIS.

### 4.10 Noticia citada vs noticia resumida
El `NoticiaPanel` actual trae titulares. Añadir dos modos: **citar** (el titular aparece como cita en mi muro con el permalink) y **resumir en 140 caracteres** (el propio usuario resume y asume el resumen — fomenta lectura completa).

---

## 5. Preguntas abiertas

1. **¿Quién asigna el color del semáforo?** Esta decisión define el carácter del proyecto. Si la comunidad tiene demasiado peso, colapsa en tribalismo. Si la asume el autor, es honesto pero abusable. Si la asume PHAROS, es editorial y pierde comunidad. Mi recomendación es el modelo híbrido de 4.2.
2. **¿El PEC tiene coste?** Desbloquear el "poner mi cara" cada día tiene un límite natural — si PECas 300 cosas, pierde valor. ¿Hay un cap diario (por ejemplo 20 PECs/día)? Podría ser una restricción bondadosa.
3. **¿Los bots/AI pueden PECar?** Recomendación: no. Solo caras humanas reales. Los bots pueden comentar pero no empujar su cara.
4. **¿Dónde encajan las respuestas?** ¿Hilos inline, modal, pantalla nueva?
5. **¿FEED es global o es "mi barrio/comunidad"?** Si es global, compite con X. Si es local, compite con Nextdoor. KOINOS está escribiendo una mezcla (noticias globales, amigos locales). Hay que explicitar qué proporción.

---

## 6. Entradas mínimas al código para la siguiente iteración

- Cableado real del `AlgoritmoPanel` al filtro de `POSTS` (hoy solo muestra toggles sin efecto).
- Esquema Supabase de PEC (`pecs` tabla con `post_id`, `user_id`, `created_at`, `avatar_snapshot`).
- Criterio de `sem` (`green | yellow | red`) documentado en un comentario sobre el tipo `Post` (línea ~58).
- Diferenciar visualmente post con `isAI` del post humano (ya hay `aiLabel` pero el estilo se aplica de forma suave — se puede reforzar).

---

## Fuentes consultadas para este documento

- [Did the Roll-Out of Community Notes Reduce Engagement With Misinformation on X/Twitter? — ACM HCI](https://dl.acm.org/doi/10.1145/3686967)
- [Differential impact from individual vs collective misinformation tagging — Nature Communications 2025](https://www.nature.com/articles/s41467-025-55868-0)
- [The most effective online fact-checkers? Your peers — University of Rochester](https://www.rochester.edu/newscenter/crowdsourcing-fact-checking-community-notes-social-media-676142/)
- [Pol.is — Wikipedia](https://en.wikipedia.org/wiki/Pol.is)
- [Hacking polarization: pol.is and vTaiwan — Paula Berman / Hacktivism](https://words.democracy.earth/hacking-ideology-pol-is-and-vtaiwan-570d36442ee5)
- [Lessons From Consensus Building in Taiwan — Democracy Technologies](https://democracy-technologies.org/participation/consensus-building-in-taiwan/)
- [vTaiwan's hybrid approach to digital deliberation with AI — People Powered](https://www.peoplepowered.org/news-content/digital-participation-case-study-taiwan)
- [Bridging Voting and Deliberation with Algorithms: Field Insights from vTaiwan — ACM FAccT 2025](https://dl.acm.org/doi/10.1145/3715275.3732205)
- [Countdown to the Midterms: Social Media Platform Policies and the Information Environment — CDT](https://cdt.org/insights/countdown-to-the-midterms-social-media-platform-policies-and-the-information-environment/)
- [An Anti Algorithmic Manifesto — maloid](https://maloid.neocities.org/blog/posts/2025-03-30-An-Anti-Algorithmic-Manifesto)

*Código de referencia en `src/app/feed/page.tsx` líneas 58–75, 233–332, 368–386, 451–1023, 2108+.*
