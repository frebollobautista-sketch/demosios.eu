# TOUCH — Inventario de funcionalidades

> **Filiación arquitectónica (2026-05-02):** TOUCH es el módulo del **YO íntimo** dentro del marco YO/NOSOTROS/ELLO de Demos iOS. Mismo pronombre que FEED pero alcance restringido: lo que solo enseñas a tu círculo invitado. No es un DM ni un grupo cerrado (esos están explícitamente postpuestos como "otredad mediatizada" hasta que la base republicana esté asentada — ver IDEAS.md). TOUCH es **el archivo personal**, no la conversación íntima. Ver decisión arquitectónica completa en [`IDEAS.md → Arquitectura del proyecto`](./IDEAS.md#arquitectura-del-proyecto).

Documento paralelo a `AGORA-FUNCIONALIDADES.md` y `FEED-FUNCIONALIDADES.md`. Para investigación de mercado y backlog narrativo, ver `notebook/01_TOUCH.md`.

Estado de cada feature:
- ✅ implementado
- ⚠️ parcial
- ❌ pendiente
- 🚫 descartado deliberadamente

---

## Estado actual del código

TOUCH vive como **submodos dentro de `src/app/feed/page.tsx`** (no hay ruta propia `/touch` todavía). Solo Álbum tiene implementación real; el resto son placeholders con `TouchPanel` genérico.

| Submodo | Implementación |
|---|---|
| **Álbum** (colección personal de fotos/vídeos) | ⚠️ panel + modal funcionales con datos `ALBUM_ITEMS` mock |
| **Amigos** (red íntima invitada) | ❌ placeholder |
| **Collage** (composición de varias fotos) | ❌ placeholder |
| **Vídeo** (editor básico) | ❌ placeholder |
| **Kiosko** (escaparate privado al círculo) | ❌ placeholder |

---

## Principio rector

En TOUCH **no hay algoritmo, no hay métricas públicas, no hay infinite scroll**. Lo que hay es **curaduría** (el usuario elige qué entra) y **acceso selectivo** (el círculo invitado decide quién ve). Es lo contrario de Instagram público, lo contrario de TikTok, y lo contrario incluso del propio FEED.

---

## El círculo íntimo — modelo de tres niveles (D3 del 2026-04-20)

Decisión heredada: invite-only estricto con **tres niveles de cercanía**:

- **Íntimos** — la gente más cercana. Por defecto ve todo lo que publicas en TOUCH.
- **Cercanos** — amistades y familia extendida. Ve lo etiquetado para ellos.
- **Conocidos** — vecinos, colegas, contactos profesionales. Ve solo lo del Kiosko.

Cada item de TOUCH (foto, álbum, kiosko) declara a qué nivel está dirigido. La invitación es **pull** (yo invito a alguien a entrar en mi círculo) y el invitado acepta — sin notificaciones públicas, sin "X y tú sois amigos ahora".

| Feature | Estado |
|---|---|
| Modelo de datos para 3 niveles | ❌ |
| UI para invitar a un nivel | ❌ |
| Aceptación de invitación silenciosa | ❌ |
| Cambiar nivel de un contacto sin notificarle | ❌ |
| Ver tu propio TOUCH "como si fueras X" (notebook 4.7) | ❌ — gesto clave para curar |

---

## Álbum — el patrimonio personal

| Feature | Estado | Notas |
|---|---|---|
| Cuadrícula de fotos | ✅ | `AlbumPanel` |
| Caption oculta (tap revela texto, long-press edita) | ⚠️ idea en copy | Notebook §3 e §4.2 |
| Encadenamiento narrativo de varias fotos (carrusel cuentístico) | ❌ | Notebook 4.2 |
| Vista cronológica vertical estilo Day One | ❌ | Notebook 4.5 |
| Agrupación de "momentos" como propuesta (no como decisión) | ❌ | Notebook 4.6 — *consentimiento progresivo* frente al patrón TikTok |
| Etiqueta personal (lugar, humor del día) | ❌ | |
| Exportación del archivo (zip, PDF, libro) | ❌ | TOUCH es patrimonio: debe poder salir |
| Borrado real (no shadow archive) | ❌ | Coherente con la transparencia radical del módulo |

---

## Kiosko — el escaparate al círculo

| Feature | Estado | Notas |
|---|---|---|
| UI editable (slots, orden, portada) | ❌ | |
| Visibilidad por nivel (íntimo / cercano / conocido) | ❌ | |
| Permitir que un amigo "regale" una foto a tu Kiosko (con tu aprobación) | ❌ | Notebook 4.4, herencia Poparazzi aplicada al portfolio |
| Kiosko íntimo vs Kiosko público (notebook §5.2) | ❌ | Decisión pendiente: ¿se permite uno público o todo es íntimo? Recomendación de mantener todo íntimo por coherencia con la decisión política sobre otredad |

---

## Álbumes co-editados ("modo cena")

Tras un evento compartido (cena, viaje, partido), TOUCH abre un álbum temporal al que todos los asistentes suben fotos durante 48h. Se cierra y se queda como recuerdo común. Notebook 4.3 — uno de los inventos más originales del proyecto.

| Feature | Estado |
|---|---|
| Crear álbum-cena con lista de invitados | ❌ |
| Tiempo acotado (cierre automático tras 48h, configurable) | ❌ |
| Copia del álbum para cada participante | ❌ |
| Marca visible "esto fue un álbum-cena del [fecha]" | ❌ |

> Nota: este es el patrón más cercano al VOSOTROS dentro de TOUCH. La diferencia con un grupo cerrado es que el álbum-cena tiene **principio y fin definidos** y solo sirve para **cosas que ya pasaron** — no es un canal de conversación continua. Por eso no rompe la decisión política de postponer el VOSOTROS.

---

## Anti-patrones cerrados (lo que TOUCH NO va a tener)

- 🚫 **Likes públicos sobre tus fotos**. TOUCH no tiene contador de likes ni lo va a tener.
- 🚫 **Algoritmo de recomendación**. Orden cronológico o curaduría manual; cero ranking automático.
- 🚫 **Stories 24h**. Contradice todo el principio de patrimonio.
- 🚫 **Métricas comparables entre amigos** ("X tiene más fotos que tú").
- 🚫 **Sugerencias de "personas que podrías conocer"**. Contradice el principio invite-only.
- 🚫 **Notificaciones de "X vio tu álbum"**. Inhibe el acceso libre del círculo a tu archivo.
- 🚫 **DMs / chats privados**. TOUCH no es un canal de conversación. Ver decisión política sobre TÚ.
- 🚫 **Compartir hacia el exterior** (link público de un álbum) sin marca explícita de "esto sale del círculo".

---

## Patrones de bienestar (que SÍ tendrá TOUCH)

- ❌ **Etiqueta visible del orden** (notebook 4.8) en cada submodo: "orden: por fecha / manual / por amistad". Transparencia radical como ventaja sobre Instagram.
- ❌ **Agrupador transparente de momentos** (notebook 4.6) — propuesta del sistema, decisión del usuario.
- ❌ **Ver tu archivo "como un amigo de nivel X"** — gesto de curaduría (notebook 4.7).
- ❌ **Exportación completa** del archivo personal (foto + caption + fecha + nivel asignado).
- ❌ **Borrado real** y panel de transparencia de qué guarda Supabase.
- ❌ **Pausa de cuenta** sin perder el archivo.

---

## Submodos: estado y decisiones

### Álbum
⚠️ El submodo más maduro. Pendiente: caption oculta operativa, vista cronológica vertical, agrupador de momentos.

### Amigos
❌ Stub. Aquí vive el modelo de tres niveles. **Bloquea todo lo demás** porque la visibilidad de Álbum/Kiosko/Collage depende de niveles.

### Collage
❌ Stub. Decisión pendiente: ¿editor nativo o se enlaza a herramienta externa? Notebook §5.4 — si nativo es caro, valorar export a Procreate / Photoshop con marca "hecho en TOUCH".

### Vídeo
❌ Stub. Misma decisión que Collage: nativo vs export. Recomendación: empezar con export a iMovie / Procreate Dreams ya que el usuario tiene esa pipeline (notebook IDEAS gamificación).

### Kiosko
❌ Stub. Núcleo de la idea de "escaparate negociado". Bloqueado por modelo de niveles.

---

## Pendiente de decidir

1. **¿Amigos en TOUCH es la misma lista que Amigos en FEED?** (notebook §5.3). Si son la misma, deduplicar código. Si son distintas, explicar al usuario por qué.
2. **¿Kiosko admite versión pública?** (notebook §5.2). Recomendación: no, todo Kiosko es por niveles del círculo. La versión pública pertenecería a Bibliotheka como portfolio.
3. **¿Datos compartidos entre TOUCH y FEED?** Si guardo un post de FEED en mi Álbum, ¿qué se guarda — enlace, captura, copia? (notebook §5.1).
4. **¿Vídeo nativo o export?** Si export, ¿a qué herramientas? Implica decidir formato de salida.
5. **¿Hay límite de almacenamiento por usuario?** TOUCH es archivo, crecerá. Habrá que decidir caps.
6. **¿Sincronización con Photos del móvil?** (iCloud, Google Photos). Útil pero invasivo de privacidad. Decidir tras tener app móvil.

---

## Bloques de implementación (priorización sugerida)

**TB1 — Modelo de niveles del círculo** (~2 sesiones)
Tabla `touch_circles (user_id, contact_id, nivel)`. UI para invitar y aceptar silenciosamente. Cambio de nivel sin notificación. Vista "como si fueras X". **Bloquea TB2-TB5**.

**TB2 — Álbum maduro** (~1 sesión)
Caption oculta operativa, vista cronológica vertical Day One-like, etiqueta personal por foto.

**TB3 — Kiosko** (~1-2 sesiones)
Modelo de slots editables, asignación a niveles, "regalo" de foto entre amigos.

**TB4 — Álbumes co-editados ("modo cena")** (~1 sesión)
Lo más original del módulo. Lista de invitados, tiempo acotado, copia para cada uno.

**TB5 — Quality of life** (~0.5 sesión, compartido con FEED y Ágora)
Etiqueta de orden visible, exportación, pausa, borrado real, panel de transparencia.

**TB6 — Collage / Vídeo** (~variable)
Decidir nativo vs export antes de estimar. Si export, integración mínima. Si nativo, varias sesiones.

---

## Integración con la home unificada "mi quiosco"

Cuando exista la home `/inicio` propuesta el 2026-05-02, TOUCH **casi no aparece** — y eso es lo correcto. Lo íntimo no se mezcla con el resto. Solo:

- Aviso discreto cuando alguien de tu círculo sube algo nuevo a su Álbum o Kiosko (sin badge llamativo).
- Recordatorio ocasional de tu propio archivo: "hace 1 año en tu Álbum…" (estilo Day One — no estilo Facebook Memories).

El YO íntimo no busca audiencia, no compite por atención. Su lugar en la home es **mínimo y voluntario**. Si entras a TOUCH lo haces a propósito, no porque la home te empuje.
