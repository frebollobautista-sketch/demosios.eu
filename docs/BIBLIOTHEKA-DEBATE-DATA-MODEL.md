# Bibliotheka · Debate — Modelo de datos

> **Nota de renombrado (2026-05-03):** este doc se llamó originalmente `AGORA-DATA-MODEL.md`. Tras la decisión del 2026-05-03 de usar nombres griegos clásicos en el toggle de la app y reorganizar — Ágora ahora es el módulo del YO; el debate temático vive como sub-modo de Bibliotheka — este doc pasa a describir el **debate dentro de Bibliotheka**. Las tablas SQL se mantienen prefijadas `agora_*` por compatibilidad con la migración ya escrita; podrán renombrarse en una migración futura sin urgencia.

Documento de referencia para la implementación del **debate de Bibliotheka** en Demos iOS / OCRE.
Última actualización del modelo: 2 mayo 2026 (publicado originalmente como "Ágora-Data-Model").

## Tesis

El debate de Bibliotheka es **un solo foro híbrido con tres modos de interacción** que comparten estructura de hilo. Un hilo nace siempre como **debate** (foro clásico, comentarios anidados). Cuando el debate madura, su autor o un moderador con grado cursus suficiente puede **promoverlo** a:

- **propuesta_decidim** — voto binario *A favor / En contra / Abstención* sobre un texto concreto. Para tomar una decisión.
- **consenso_polis** — colección de propuestas cortas con voto ternario *De acuerdo / Desacuerdo / Pasar*. Para mapear opiniones y encontrar consenso transversal.

Promover no destruye el debate previo: los comentarios siguen visibles bajo el panel del modo nuevo.

## Anclaje obligatorio

Cada hilo se ancla a tres ejes:

1. **Sección PHAROS** — obligatoria. Una de las 8 (`src/lib/pharos/secciones.ts`).
2. **Categoría local** — opcional. Una de las 10 (`src/lib/pharos/categorias.ts`). Permite filtrar "movilidad", "urbanismo", "comunidad" sin pisar la sección PHAROS.
3. **Ámbito territorial** — opcional, jerárquico: isla → municipio → barrio. Sin ámbito = alcance insular general.

Esta tridimensionalidad es lo que diferencia Ágora del FEED: la conversación pertenece a un lugar y a un dominio temático.

## Tablas

### `agora_hilos`
Estado raíz de cualquier hilo, sea cual sea su modo.

| columna | tipo | notas |
|---|---|---|
| `id` | uuid PK | gen_random_uuid |
| `autor_id` | uuid FK profiles | not null |
| `titulo` | text | 6..160 chars |
| `cuerpo` | text | 1..4000 chars (markdown ligero) |
| `seccion_pharos` | text | not null, slug de SECCIONES |
| `categoria_local` | text | nullable, slug de CATEGORIAS |
| `isla_id` | text | nullable, slug de CANARIAS |
| `municipio_id` | text | nullable, slug del municipio |
| `barrio_id` | text | nullable, slug del barrio |
| `modo` | enum agora_modo | default 'debate' |
| `estado` | enum agora_estado | default 'abierto' |
| `fijado` | boolean | default false |
| `pec_count` | integer | default 0 (denormalizado, mantenido por trigger) |
| `comentario_count` | integer | default 0 (idem) |
| `creado` | timestamptz | default now() |
| `actualizado` | timestamptz | trigger |

**Enums:**
- `agora_modo`: `'debate' | 'propuesta_decidim' | 'consenso_polis'`
- `agora_estado`: `'abierto' | 'archivado' | 'cerrado'`

### `agora_comentarios`
Comentarios anidados al estilo Reddit (parent_id auto-referencial).

| columna | tipo | notas |
|---|---|---|
| `id` | uuid PK | |
| `hilo_id` | uuid FK agora_hilos | not null, on delete cascade |
| `parent_id` | uuid FK agora_comentarios | nullable |
| `autor_id` | uuid FK profiles | not null |
| `cuerpo` | text | 1..2000 chars |
| `pec_count` | integer | denormalizado |
| `creado` | timestamptz | default now() |

### `agora_pecs_hilo`
PEC = respaldo encarnado a un hilo. Mismo concepto que en FEED pero referenciando hilos.

| columna | tipo | notas |
|---|---|---|
| `id` | uuid PK | |
| `hilo_id` | uuid FK | on delete cascade |
| `user_id` | uuid FK profiles | |
| `creado` | timestamptz | |
| | | unique(hilo_id, user_id) |

### `agora_pecs_comentario`
Análogo para comentarios.

| columna | tipo | notas |
|---|---|---|
| `id` | uuid PK | |
| `comentario_id` | uuid FK | on delete cascade |
| `user_id` | uuid FK profiles | |
| `creado` | timestamptz | |
| | | unique(comentario_id, user_id) |

### `agora_decisiones`
Modo Decidim. Cuando un hilo se promueve a `propuesta_decidim` se crea una fila aquí con el texto exacto que se vota y la fecha de cierre.

| columna | tipo | notas |
|---|---|---|
| `id` | uuid PK | |
| `hilo_id` | uuid FK agora_hilos | unique (1 decisión por hilo) |
| `texto` | text | 1..1000 chars: la propuesta que se vota |
| `fundamentacion` | text | nullable, contexto largo |
| `fecha_cierre` | timestamptz | not null |
| `quorum_minimo` | integer | nullable, votos mínimos para validar |
| `resultado` | enum agora_resultado | nullable hasta que cierra |
| `creado` | timestamptz | |

**Enum `agora_resultado`:** `'aprobada' | 'rechazada' | 'sin_quorum' | 'empate'`.

### `agora_votos_decision`
Votos individuales sobre una `agora_decisiones`.

| columna | tipo | notas |
|---|---|---|
| `id` | uuid PK | |
| `decision_id` | uuid FK | on delete cascade |
| `user_id` | uuid FK profiles | |
| `voto` | enum agora_voto_binario | `'a_favor' \| 'en_contra' \| 'abstencion'` |
| `creado` | timestamptz | |
| | | unique(decision_id, user_id) |

### `agora_propuestas`
Modo Polis. Microfrases votables generadas por participantes dentro de un hilo en modo `consenso_polis`. Cada hilo en este modo tiene N propuestas.

| columna | tipo | notas |
|---|---|---|
| `id` | uuid PK | |
| `hilo_id` | uuid FK agora_hilos | not null |
| `autor_id` | uuid FK profiles | not null |
| `texto` | text | 8..280 chars (estilo tuit, condensable) |
| `aprobada_para_votar` | boolean | default true (false = oculta hasta moderar) |
| `creado` | timestamptz | |

### `agora_votos_propuesta`
Voto ternario sobre una propuesta Polis-style.

| columna | tipo | notas |
|---|---|---|
| `id` | uuid PK | |
| `propuesta_id` | uuid FK | on delete cascade |
| `user_id` | uuid FK profiles | |
| `voto` | enum agora_voto_ternario | `'de_acuerdo' \| 'desacuerdo' \| 'pasar'` |
| `creado` | timestamptz | |
| | | unique(propuesta_id, user_id) |

> Nota: el clustering de opinión Polis-style (encontrar grupos y propuestas-puente) se computa offline a partir de `agora_votos_propuesta`. Primera versión: vista materializada que recalcula cada hora. No está en la migración inicial.

## Reglas de promoción (modo)

Quién puede crear/promover qué:

| Acción | Grado mínimo |
|---|---|
| Crear hilo en modo `debate` | `polites` (cualquiera autenticado) |
| Comentar | `polites` |
| Promover hilo propio a `propuesta_decidim` | `oikonomos` (autor del hilo) o `bouleutes` (cualquier hilo) |
| Promover hilo propio a `consenso_polis` | `ergates` (autor del hilo) o `bouleutes` (cualquier hilo) |
| Crear propuesta dentro de un hilo `consenso_polis` | `polites` |
| Cerrar/archivar hilo | autor + `bouleutes` o superior |
| Fijar hilo en una sección | `didaskalos` o superior |

(Los grados se definen en `src/lib/cursus/grados.ts`. El gating se chequea en server actions, no solo en RLS, porque RLS no conoce el `puntos` agregado del usuario en tiempo real.)

## Capital generado

Mapeo a `src/lib/capital/contribuciones.ts`:

| Acción Ágora | Tipo de contribución | Notas |
|---|---|---|
| Crear hilo | `hilo_agora` | sección PHAROS asociada |
| Comentar | `respuesta_agora` | sección heredada del hilo |
| PEC recibida (hilo o comentario) | `pec_recibido` | beneficiario = autor |
| Crear propuesta Polis | `respuesta_agora` × 0.7 | versión condensada del comentario |
| Promover a propuesta_decidim | (sin puntos directos) | la promoción no es contribución, es liderazgo |

## Anti-spam y rate limit

- Trigger SQL: máximo 5 hilos creados por usuario por día (24h rolling).
- Trigger SQL: máximo 30 comentarios por hora.
- Reportes existentes (`reports`) ya cubren el flujo de moderación.

## Queries clave

1. **Listar hilos de una sección PHAROS, opcionalmente filtrados por categoría/territorio, ordenados por:**
   - `recientes`: `creado desc`
   - `actividad`: `actualizado desc` (cuando se postea un comentario, el hilo recibe `update`)
   - `pec`: `pec_count desc nulls last, creado desc`
2. **Obtener un hilo + autor + comentarios anidados + decisión activa o propuestas Polis si las hay.**
3. **Para un usuario, obtener sus votos en una decisión / sus votos en propuestas de un hilo, para pintar UI.**

## Visibilidad y RLS

Lectura pública para hilos / comentarios / propuestas / decisiones / conteos. La tabla `profiles.is_shadow_banned` filtra autores marcados.

Escritura: solo el propio usuario crea o borra sus filas. Las promociones de modo se hacen vía server action que valida grado y luego escribe con `service role` o con la sesión normal previa comprobación.

## Camino de implementación (esta sesión)

1. Migración SQL `0002_agora.sql` — todas las tablas, enums, índices, RLS, triggers de denormalización.
2. `src/lib/agora/` — types, queries server-side, helpers cliente.
3. `src/app/agora/page.tsx` — landing con filtros y conteos reales.
4. `src/app/agora/[seccion]/page.tsx` — lista de hilos.
5. `src/app/agora/[seccion]/[hiloId]/page.tsx` — vista de hilo (modo debate primero).
6. `src/app/agora/nuevo/page.tsx` — creación.
7. Server actions para promover modo + crear decisión / propuesta.

Lo que queda fuera de esta sesión: clustering Polis (vista materializada), notificaciones, realtime, moderación avanzada, cálculo de quórum dinámico, voto delegado.
