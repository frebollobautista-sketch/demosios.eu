# FEED — Inventario de funcionalidades

> **Filiación arquitectónica (2026-05-02):** FEED es el módulo del **YO público** dentro del marco YO/NOSOTROS/ELLO de Demos iOS. Twitter/Instagram-like: el individuo se expresa hacia quien quiera leerlo. Mismo pronombre que TOUCH (yo íntimo) pero distinto alcance. Ver decisión arquitectónica completa en [`IDEAS.md → Arquitectura del proyecto`](./IDEAS.md#arquitectura-del-proyecto).

Documento paralelo a `AGORA-FUNCIONALIDADES.md` — define qué hace y qué no hace FEED, alineado con la lente quality-of-life del 2026-05-02. Para investigación de mercado y backlog narrativo, ver `notebook/02_FEED.md`.

Estado de cada feature:
- ✅ implementado
- ⚠️ parcial (existe pero falta cablear)
- ❌ pendiente
- 🚫 descartado deliberadamente (no se va a hacer)

---

## Estado actual del código

`src/app/feed/page.tsx` — 6.091 líneas, todo cliente. Estructura por **medallas** (4 submodos cliqueables) con datos mock embebidos. Sin Supabase cableado todavía.

| Componente | Implementación |
|---|---|
| Submodo **Escribir** (post propio) | ✅ panel funcional con texto, imagen, cita, enlace |
| Submodo **Amigos** (timeline filtrado) | ⚠️ panel existe, sin lógica de filtro real |
| Submodo **Noticias** | ⚠️ panel + ruta `api/noticias/route.ts`, sin definir fuentes |
| Submodo **Algoritmo** (filtros PHAROS) | ⚠️ toggles visibles, no cableados al timeline |
| Semáforo de veracidad (verde/amarillo/rojo) | ⚠️ visual sí, criterio de asignación no |
| PEC (endorsement encarnado, avatar visible) | ⚠️ visual sí, persistencia no |
| Like clásico | ✅ |
| Posts de IA con etiqueta (`isAI`, `aiLabel`) | ✅ formato citas históricas (Marco Aurelio etc.) |
| Diario (esquina plegada, persistente) | ✅ |
| Header con cambio entre TOUCH/FEED/POLIS | ✅ (precede a la nueva arquitectura YO/NOSOTROS/ELLO) |

---

## Post — qué lleva (la unidad básica del YO público)

| Feature | Estado | Notas |
|---|---|---|
| Texto corto (límite tipo Twitter) | ✅ | Sin límite explícito todavía; conviene definir 500-1000 |
| Imagen adjunta | ✅ | UI sí; storage Supabase pendiente |
| Cita incrustada (autor + fuente) | ✅ | Modelo Marco Aurelio: `cita_text`, `cita_author`, `cita_source` |
| Enlace externo | ✅ | Render como tarjeta |
| Vídeo corto | ❌ | Pendiente — propuesta del notebook 4.9 (clip de voz/vídeo de 10s) |
| Etiqueta de sección PHAROS | ❌ | Hoy el algoritmo filtra por sección pero los posts no la declaran |
| Etiqueta de territorio | ❌ | Inconsistente con Ágora — debería existir para que "mi quiosco" cruce capas |
| Borrado por el autor | ❌ | Pendiente; coherencia con Ágora: placeholder "[post retirado]" |
| Edición tras publicar | ❌ | Recomendación: misma regla que Ágora (1h tipográfico) |
| Reposo antes de publicar | ❌ | Idea fuerte del notebook 4.4: borrador 10 min antes de publicar |

---

## Señales (lo que hace el lector con un post)

| Feature | Estado | Notas |
|---|---|---|
| **PEC encarnado público** (avatar visible) | ⚠️ | Núcleo del producto. La identidad civil del módulo. |
| **Like anónimo** | ✅ | Heredado del MVP. Pregunta abierta: ¿coexiste con PEC o se elimina? |
| Comentar / responder | ❌ | Sin respuestas, FEED es un tablón. Decisión 2026-04-19 (notebook 4.8): subposts encadenados que NO suben al feed principal |
| Reportar contenido | ⚠️ | Tabla `reports` existe, falta cablear |
| Bloqueo personal de usuario | ❌ | Coherente con la decisión de Ágora |
| Reacciones múltiples (gracias / útil / etc.) | 🚫 | Decartar para FEED — quedan en Ágora donde aportan matiz al debate. En FEED solo PEC + like ya cubren la señal |
| Guardar post propio en TOUCH (Álbum) | ❌ | Bonita conexión cross-yo (público → íntimo) |
| Citar post en Bibliotheka (como germen de ensayo) | ❌ | Conexión yo → ello |

---

## El "algoritmo construido por el usuario"

Decisión rectora del módulo (notebook §1, gap 4.7): **el filtro lo hace el usuario, no la plataforma**. Las 8 secciones PHAROS se exponen como deslizadores de peso.

| Feature | Estado | Notas |
|---|---|---|
| Toggles de sección PHAROS visibles | ✅ | En `AlgoritmoPanel` |
| Cableado real al filtro de timeline | ❌ | Hoy es decorativo |
| Deslizador de peso (0–100 por sección) | ❌ | Notebook 4.7 — eleva el algoritmo a **juguete transparente** |
| Preview en vivo ("con esta config verías estos 5 posts") | ❌ | Diferenciador clave |
| Orden cronológico por defecto | ✅ | Sin algoritmo opaco |
| Badge "tu algoritmo" visible en cada post | ❌ | Honestidad: ¿por qué este post está aquí? |

---

## Anti-patrones cerrados (lo que FEED NO va a tener — coherente con la lente quality-of-life)

- 🚫 **Scroll infinito**. Paginación o "cargar más" manual.
- 🚫 **Algoritmo opaco**. El usuario diseña el filtro y lo entiende.
- 🚫 **Trending global** que amplifica lo escandaloso. (Aplica también a la home unificada.)
- 🚫 **Contadores de seguidores como ranking público**. Cada uno sabe los suyos; nadie compara.
- 🚫 **Stories 24h**. La presión de presencia continua mata la voz reflexiva.
- 🚫 **Streaks** ("llevas 14 días publicando"). Castigan ausencias, gameifican lo equivocado.
- 🚫 **"X está escribiendo…" / "Y leyendo en este momento"**. Presión social en tiempo real.
- 🚫 **Notificaciones push individuales** por cada like/PEC. Solo digest agrupado.
- 🚫 **Reacciones múltiples** (van en Ágora, no aquí).
- 🚫 **DMs / mensajes privados**. Decisión política: el TÚ queda fuera (ver IDEAS.md).

---

## Patrones de bienestar (que SÍ tendrá FEED)

- ✅ Tiempo en pantalla **visible al usuario** (común a toda la plataforma).
- ❌ **Cierre voluntario** ("cierro la app por hoy") con celebración del gesto.
- ❌ **Modo lectura sin botones** — releer posts sin presión de PEC/like.
- ❌ **Reposo antes de publicar** (10 min en borrador) — lo único que combate la impulsividad.
- ❌ **Notificaciones por digest** (cada N horas, no en tiempo real).
- ❌ **Pausa de cuenta** (no eliminarla, no recibir notificaciones, volver cuando quieras).
- ❌ **Panel de transparencia** (qué sabe la plataforma de ti).
- ❌ **Cap diario blando de PEC** (notebook §5.2 — propuesta: 20 PECs/día) para que el gesto siga teniendo valor.

---

## Submodos: estado y decisiones

### Escribir
✅ Funciona. Pendiente: reposo de 10 min antes de publicar, etiquetado obligatorio de sección PHAROS al publicar.

### Amigos
⚠️ El panel existe. Pendiente: definir si "amigos" es la misma lista que el círculo íntimo de TOUCH o lista distinta (notebook §5.3).

### Noticias
⚠️ Panel + endpoint sin definir fuentes. Pendiente: fijar fuentes editoriales y rotación. Idea del notebook 4.10: dos modos — "citar" (titular + permalink) y "resumir en 140 chars" (el usuario asume el resumen, fomenta lectura completa).

### Algoritmo
⚠️ Toggles visibles, no cableados. Pendiente: cableado + deslizadores + preview (4.7).

### Mapa de consensos (5º submodo propuesto, notebook 4.1)
🚫 **Movido a Ágora**. La deliberación tipo Polis vive en el NOSOTROS, no en el YO. Esta era una idea pre-arquitectura YO/NOSOTROS/ELLO — al filiar Ágora al NOSOTROS, el panel Polis-style ya tiene su sitio natural allí.

---

## Pendiente de decidir

1. **Like vs PEC**: ¿coexisten o el like se elimina por redundancia?
2. **Comentarios / respuestas en FEED**: ¿hay o no? Si hay, ¿como subposts encadenados (notebook 4.8) o no se permiten? Sin respuestas, FEED es solo tablón.
3. **Etiquetado obligatorio de sección PHAROS al publicar**: ¿obligatorio, opcional, o automático con sugerencia? Necesario para que "mi quiosco" pueda cruzar capas con coherencia.
4. **Etiquetado territorial**: ¿se importa de Ágora la jerarquía isla/municipio/barrio?
5. **Posts de IA**: ¿quién los crea? ¿Yapper-bots como ya están sembrados en la migración de Supabase, o se eliminan?
6. **Caps de uso**: ¿cap diario de PEC? ¿cap diario de posts? Notebook §5.2.
7. **Sección-of-the-day** (notebook 4.5): ¿se eleva editorialmente una sección al día? Riesgo de paternalismo, beneficio de romper filter bubble.

---

## Bloques de implementación (priorización sugerida)

**FB1 — Persistencia mínima** (~1 sesión)
Esquema Supabase: `posts`, `pecs`, `likes`, `feed_section_tag`. Cableado del PEC con avatar real. Borrado autor + placeholder.

**FB2 — Algoritmo del usuario** (~1 sesión)
Cableado de toggles + deslizadores de peso + preview en vivo. Convertir el "Algoritmo" en juguete transparente.

**FB3 — Reposo y digest** (~1 sesión)
Reposo de 10 min antes de publicar (usar el Diario). Notificaciones agrupadas en digest (compartido con Ágora).

**FB4 — Comentarios o no** (decisión + ~1 sesión si sí)
Resolver pregunta abierta #2. Si sí, subposts encadenados que no suben al feed.

**FB5 — Conexiones cross-yo** (~1 sesión)
Guardar post de FEED en TOUCH/Álbum. Citar post de FEED como germen de ensayo en Bibliotheka. Operacionaliza el "yo público → yo íntimo / yo público → ello".

**FB6 — Quality of life completo** (~1 sesión)
Tiempo en pantalla visible, cierre voluntario, modo lectura, pausa de cuenta. Compartido con Ágora y TOUCH.

---

## Integración con la home unificada "mi quiosco"

Cuando exista la home `/inicio` propuesta el 2026-05-02, FEED contribuye con:

- Posts recientes de gente que sigues (timeline cronológico).
- Un máximo de 3 posts del Algoritmo del usuario (no top viral, no trending).
- Cita del día (formato `isAI` con `aiLabel`).
- Cada item con badge **YO público**.

Cero ruido. La home no ofrece "lo más visto" — ofrece **lo que viste tú** + **lo que pediste ver**. El YO en su modo más austero.
