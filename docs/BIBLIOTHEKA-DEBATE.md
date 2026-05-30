# Bibliotheka · Debate — Inventario de funcionalidades

> **Filiación arquitectónica (2026-05-03):** El módulo de debate (lo que originalmente se llamó "Ágora" durante la sesión del 2 mayo) **vive ahora dentro de Bibliotheka** como uno de sus dos sub-modos junto con Obras. Encarna el **NOSOTROS** del marco YO/NOSOTROS/ELLO. Reddit con sentido de base de datos: deliberación temática anclada a sección PHAROS + categoría local + territorio.
>
> Razón del renombrado (decisión 2026-05-03): el toggle público de la app usa los tres nombres griegos clásicos como pestañas — **Ágora · Bibliotheka · Polis** — y la Ágora pasa a ser el espacio del YO (donde la gente coincide a charlar y a contar, lectura cotidiana de la plaza griega). El debate estructurado, archivable y citable, vive bajo Bibliotheka.
>
> Ver decisión arquitectónica completa en [`IDEAS.md → Arquitectura del proyecto`](./IDEAS.md#arquitectura-del-proyecto). Para el inventario de la nueva Ágora (módulo del YO público + íntimo) ver [`AGORA-FUNCIONALIDADES.md`](./AGORA-FUNCIONALIDADES.md).

Resultado del inventario foro reddit-like + capas cívicas hecho con Pancho el 2 mayo 2026 (originalmente como "Ágora"). Este doc define **qué hace y qué no hace el debate de Bibliotheka**, independientemente del modelo de datos (que vive en `BIBLIOTHEKA-DEBATE-DATA-MODEL.md`).

Estado de cada feature:
- ✅ implementado
- ⚠️ parcial (existe pero falta cablear)
- ❌ pendiente

---

## Hilo (post raíz)

| Feature | Estado | Notas |
|---|---|---|
| Título + cuerpo + autor + sección PHAROS | ✅ | Sección PHAROS obligatoria |
| Imagen adjunta (opcional) | ❌ | Storage Supabase pendiente |
| Enlace externo (modo "link post") | ❌ | Campo `enlace text null` + render como tarjeta |
| Etiqueta de territorio (isla/municipio/barrio) | ✅ | Jerárquico, opcional |
| Etiqueta de categoría local | ✅ | Una de las 10 de PHAROS |
| Apertura: cualquier registrado | ✅ | Rate limit 5/24h |
| Borrado: placeholder "[hilo retirado por el autor]" | ❌ | Soft-delete con flag `retirado bool` |
| Comentarios sobreviven al borrado | ❌ | Va de la mano del soft-delete |
| Edición: 1h solo tipográficos, después no | ❌ | Política a implementar en server action; hoy edición libre vía RLS |

## Comentarios

| Feature | Estado | Notas |
|---|---|---|
| Anidamiento sin límite | ✅ | parent_id auto-referencial |
| Imagen adjunta | ❌ | |
| Cita de otro comentario (quote) | ❌ | Campo `cita_de uuid null` con render embebido |
| Markdown rico (negrita, listas, enlaces) | ❌ | Hoy es texto plano. Necesita renderer (rehype + sanitize) |
| Borrar/editar mismas reglas que el hilo | ❌ | Idem soft-delete + ventana 1h |
| Autor del hilo puede fijar 1 comentario | ❌ | Campo `comentario_fijado uuid null` en `agora_hilos` |
| Autor del hilo puede ocultar comentarios fuera de tema | ❌ | Flag `oculto_por_autor bool` |

## Señales (votos, reacciones, PEC)

| Feature | Estado | Notas |
|---|---|---|
| ▲/▼ anónimos sobre hilos | ❌ | Tabla `agora_votos_hilo (hilo_id, user_id, valor int -1/+1)` |
| ▲/▼ anónimos sobre comentarios | ❌ | Tabla `agora_votos_comentario` análoga |
| Reacciones múltiples (gracias/útil/no de acuerdo/fuera de tema) | ❌ | Tabla `agora_reacciones (target_id, target_kind, user_id, tipo enum)` |
| PEC explícito firmado y público (avatar visible) | ✅ | `agora_pecs_hilo` y `agora_pecs_comentario` ya creadas |
| Reportar contenido (motivos predefinidos) | ⚠️ | Tabla `reports` existe en FEED, hay que extenderla a entidades Ágora |
| Bloqueo personal de usuario | ❌ | Tabla `bloqueos (bloqueador_id, bloqueado_id)` global de la plataforma |

## Navegación y descubrimiento

| Feature | Estado | Notas |
|---|---|---|
| Landing de las 8 secciones con conteo de hilos | ✅ | |
| Filtros por categoría + territorio + ordenación | ✅ | En la página de cada sección |
| Feed personal (mezcla de secciones favoritas) | ❌ | Tabla `secciones_favoritas (user_id, seccion_pharos)` + ruta `/agora/feed` |
| Búsqueda full-text en títulos y cuerpos | ❌ | Índice GIN sobre `tsvector` con español |
| Hilos fijados arriba de una sección | ✅ | Campo `fijado bool` ya existe; falta gating del cursus para fijar |
| Top 5 trending últimas 24h en la home | ❌ | Query con ventana de tiempo + comentario_count + pec_count |

## Notificaciones

| Feature | Estado | Notas |
|---|---|---|
| Comentan tu hilo | ❌ | Trigger SQL → tabla `notificaciones` |
| Responden tu comentario | ❌ | Trigger SQL |
| Te mencionan con @handle | ❌ | Parser server-side al guardar; resuelve handles → IDs |
| Recibes un PEC | ❌ | Trigger SQL |
| Indicador (campana) en la app | ❌ | Componente en el Header |
| Suscripción manual a hilos ajenos | ❌ | Tabla `suscripciones_hilo (user_id, hilo_id)` |
| Push notifications (móvil) | ❌ | Pendiente de tener app móvil |
| Sin emails | — | Decisión: Ágora no usa email para notificar |

## Perfil cívico (vista pública del usuario)

| Feature | Estado | Notas |
|---|---|---|
| Click en handle → perfil público | ❌ | Ruta `/perfil/[handle]` |
| Lista de hilos del usuario | ❌ | Query a `agora_hilos` filtrado por autor |
| Comentarios más respaldados | ❌ | Query a `agora_comentarios` ordered by pec_count |
| Grado del cursus + capital por eje (KOI/PAI/POL) | ⚠️ | Lógica existe en `lib/cursus`, falta cálculo agregado real |
| Barrio/municipio si lo declaró | ⚠️ | Profile existe, falta campo |
| Modo privado (@privado) | ⚠️ | Toggle UI en /ajustes existe, falta `is_public` en `profiles` y filtro RLS |
| Sin karma numérico (solo grado del cursus) | ✅ | Decisión cerrada |

## Moderación y estructura comunitaria

| Feature | Estado | Notas |
|---|---|---|
| Admins de plataforma | ✅ | `is_admin` ya existe en `profiles` |
| Curadores por sección (didáskalos+) | ❌ | Tabla `curadores (user_id, seccion_pharos)` o cálculo dinámico por grado |
| Sub-secciones creables por bouleutés+ | ❌ | Tabla `agora_subsecciones (id, seccion_pharos, slug, nombre, creador, descripcion)` + columna `subseccion_id` opcional en hilos |
| Panel lateral con reglas por sección | ❌ | Tabla `agora_reglas_seccion` o estático en código |
| Reglas globales de la plataforma | ⚠️ | `/legal/terminos` existe |

## Capas de deliberación formal (lo "no-Reddit")

| Feature | Estado | Notas |
|---|---|---|
| Promover debate a propuesta votable (Decidim) | ✅ | Voto a favor / contra / abstención + fecha cierre + quórum |
| Promover debate a mapeo de consenso (Polis) | ✅ | Microfrases + voto ternario; clustering pendiente |
| Cierre formal con resumen final del autor/curador | ❌ | Campo `resumen_cierre text null` + estado `cerrado` |
| Auto-publicar resumen como recurso en Bibliotheka/Koiná | ❌ | Trigger o server action que crea fila en tabla de Bibliotheka |
| Sin encuestas rápidas (poll Twitter-style) | — | Decisión: descartado |

## Lo que NO va (decisiones cerradas)

- Profundidad limitada de árbol de comentarios (queda sin límite)
- Sistema sin votos (descartado, va con votos)
- Edición libre con historial wiki (descartado, va 1h tipográfico)
- Anonimato total por hilo (descartado, modo @privado es lo más lejos)
- Karma numérico tipo Reddit (descartado, solo grado del cursus)
- Tendencias más allá del top 5 (no hot/rising/etc)
- Notificaciones por email (canal fuera de Ágora)
- Encuestas rápidas tipo Twitter dentro del hilo (descartado)

## Bloques de implementación (priorización)

Cada bloque se puede atacar por separado en sesiones distintas:

**Bloque B1 — Foro básico que falta**
▲/▼, markdown rico, soft-delete con placeholder, edición 1h, bloqueo personal, ocultar/fijar comentarios desde autor. (~2 sesiones)

**Bloque B2 — Multimedia y composición**
Imagen adjunta en hilo y comentario, enlace externo (link post), quote de comentario, menciones @handle. Requiere Supabase Storage + parser de menciones. (~2 sesiones)

**Bloque B3 — Descubrimiento**
Feed personal con favoritas, búsqueda full-text, top 5 trending en home, suscripciones a hilos, sistema de notificaciones (campana). (~2 sesiones)

**Bloque B4 — Estructura comunitaria**
Sub-secciones, curadores con grado del cursus, panel de reglas, perfil público `/perfil/[handle]`, modo privado cableado. (~2-3 sesiones)

**Bloque B5 — Cierre del ciclo cívico**
Cierre formal con resumen, auto-publicación a Koiná, integración con `contribuciones` para que sume capital. (~1 sesión)

**Bloque B6 — Reacciones múltiples**
Capa fina sobre B1; se puede meter como anexo cuando ya esté ▲/▼. (~0.5 sesión)
