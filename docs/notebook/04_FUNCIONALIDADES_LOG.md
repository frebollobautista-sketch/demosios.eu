# Log de funcionalidades — descartadas, rescatables y nuevas sugerencias

**Propósito:** que ninguna idea se evapore entre sesiones. Este documento recoge funcionalidades que en algún momento formaron parte de la conversación del proyecto, aunque hoy no estén en el código, y añade sugerencias nuevas por módulo que no se han discutido todavía.

**Convención de etiquetas:**
- `(KOINOS-actual)` — forma parte de KOINOS hoy en el código.
- `(KOINOS-descartado)` — estuvo en KOINOS y ya no está. Se puede rescatar.
- `(PHAROS-heredado)` — viene de PHAROS, puede o no integrarse.
- `(nuevo)` — sugerencia Claude basada en el estado actual + investigación.
- `(? por confirmar con Pancho)` — idea que suena familiar pero no se puede verificar en esta sesión porque no tengo acceso a las conversaciones previas ni a la carpeta `Notebook/GAMIFICACIÓN`. Marcar para que Pancho confirme.

---

## 0. Aviso sobre esta sesión

Esta es la **primera sesión** con acceso a la carpeta `/Users/panch/KOINOS`. No puedo recordar conversaciones previas de otras sesiones (Claude no conserva memoria entre chats). Por tanto, el apartado "ideas descartadas" se construye a partir de tres fuentes:

1. **Pistas en el propio código**: cosas que están comentadas, mencionadas como "próximamente" o que existen como esqueleto (pistas de que en algún momento se discutió).
2. **Pistas en el documento `POLIS_digitalizador_urbano.md`**: menciona ideas que no están en el código actual.
3. **Pistas en el proyecto PHAROS migrado**: algunas secciones y categorías vienen de allí.

Todo lo demás está marcado `(? por confirmar con Pancho)` y requiere que tú me lo corrobores o descartes. Cuando conectes `Notebook/GAMIFICACIÓN` en otra sesión, este archivo se puede ampliar con lo que descubras allí.

---

## 1. TOUCH — funcionalidades en juego

### 1.1 Ya en el código
- **Álbum con caption oculta en el grid** `(KOINOS-actual)` — pulsar revela el texto. Implementado en `AlbumPanel` y `AlbumModal`.
- **5 verbs en el rail**: Álbum, Amigos, Collage, Video, Kiosko `(KOINOS-actual)` — solo Álbum tiene contenido real; los otros son placeholders con `TOUCH_COPY`.

### 1.2 Mencionadas como "próximamente" en el código (en cola clara)
- **Editor de collage** con plantillas y drag-and-drop `(KOINOS-descartado/diferido)` — `TOUCH_COPY.collage`.
- **Editor básico de video** con música y transiciones `(KOINOS-descartado/diferido)` — `TOUCH_COPY.video`.
- **Grid de fotos guardadas con swipe gestures** `(KOINOS-descartado/diferido)` — `TOUCH_COPY.album`.
- **Lista de personas para red íntima con invitación explícita** `(KOINOS-descartado/diferido)` — `TOUCH_COPY.amigos`.
- **Vitrina Kiosko como "escaparate privado"** `(KOINOS-descartado/diferido)` — `TOUCH_COPY.kiosko`.

### 1.3 Candidatas a rescatar — `(? por confirmar con Pancho)`
- **Diario privado vinculado a fotos** — hoy el diario existe en la UI (esquina plegada) y Álbum existe en TOUCH, pero no están conectados. Tendría sentido que una entrada del diario pudiera incrustar una foto del álbum. `(? por confirmar)`
- **Modo "para ti" familiar** — álbumes separados por grupo (familia, pareja, amigos de la infancia). `(? por confirmar)`
- **Sincronización con carrete del teléfono** — sugerir fotos del día para incorporarlas. `(? por confirmar)`
- **Backup exportable** (zip o libro impreso). `(? por confirmar)`

### 1.4 Sugerencias nuevas `(nuevo)`
- **Círculos asimétricos por nivel** (modelo Vero de 3 niveles). Ver `01_TOUCH.md` §4.1.
- **Caption oculta encadenada** (carrusel que solo carga al tocar). Ver §4.2.
- **Álbumes co-editados en modo "cena"** con cierre temporal. Ver §4.3.
- **Kiosko negociado** (amigos pueden subir al mío con aprobación). Ver §4.4.
- **Línea temporal tipo Day One**. Ver §4.5.
- **"Modo sobre" para ver tu propio álbum desde fuera**. Ver §4.7.
- **Etiqueta explícita de orden** ("orden: por fecha / manual / por amistad") en el header de cada submodo. Ver §4.8.

---

## 2. FEED — funcionalidades en juego

### 2.1 Ya en el código
- **PEC (endorsement encarnado)** `(KOINOS-actual)` — `PecStack` líneas 237+.
- **Semáforo verde/amarillo/rojo** `(KOINOS-actual)` — `SemaforoDot` línea ~333.
- **Algoritmo editable por secciones PHAROS** `(KOINOS-actual)` — `AlgoritmoPanel` línea ~918.
- **Panel de noticias** alimentado por API interna `(KOINOS-actual)` — `NoticiaPanel` línea ~477 + `src/app/api/noticias/route.ts`.
- **Posts con `isAI` y `aiLabel`** (citas, posts editoriales) `(KOINOS-actual)` — tipo `Post` línea ~58.
- **Panel Escribir** para redactar posts `(KOINOS-actual)` — `EscribirPanel` línea ~822.
- **Diario plegable** `(KOINOS-actual)` — `diaryOpen` línea 2123.
- **Checklists dentro del diario** `(KOINOS-actual)` — `lists` línea 2124.

### 2.2 Heredadas de PHAROS
- **8 secciones temáticas** `(PHAROS-heredado)` — en `src/lib/pharos/secciones.ts`.
- **10 categorías de discusión** `(PHAROS-heredado)` — en `src/lib/pharos/categorias.ts`.
- **Foro / hilos de discusión con categoría** `(PHAROS-heredado, no implementado aún en KOINOS)` — el comentario "[REF-008] categorías temáticas para hilos del foro" sugiere que PHAROS tenía un foro clásico. Decidir si se rescata. Recomendación: no como foro separado, sí como **modo de respuesta** dentro del FEED.
- **Repositorio de recursos temáticos** `(PHAROS-heredado, no implementado)` — el comentario "[REF-400] secciones temáticas del repositorio de recursos" apunta a una biblioteca. Parcialmente presente en `BibliotecaPanel` (línea ~628), pero no ligada todavía a datos reales.

### 2.3 Candidatas a rescatar — `(? por confirmar con Pancho)`
- **Modo de deliberación estilo pol.is** — creo que es algo que no has mencionado todavía formalmente, pero es una extensión natural. Márcalo como nuevo si no lo habías propuesto antes. `(nuevo, ver §2.4)`
- **Reputación cívica por sección** — un usuario tiene "credibilidad" distinta en cada una de las 8 secciones PHAROS, ganada por PECs recibidos sobre posts clasificados en esa sección. `(? por confirmar)`
- **Retar un post** (marcarlo como dudoso con argumentación). `(? por confirmar)`
- **Ciclo de vida del post**: publicado → revisado por pares → editado → archivado. `(? por confirmar)`
- **Post con tiempo de reposo obligatorio** antes de publicarse. `(? por confirmar)`

### 2.4 Sugerencias nuevas `(nuevo)`
- **Mapa de consensos pol.is como 5º submodo** (ver `02_FEED.md` §4.1).
- **Semáforo híbrido auditable** (autor + comunidad + PHAROS). Ver §4.2.
- **Genealogía de PEC** (árbol de quién influyó en quién). Ver §4.3.
- **Estado de reposo del borrador**, con uso del Diario como espacio de reposo visual. Ver §4.4.
- **Sección-del-día** como rotación editorial. Ver §4.5.
- **Post-cita como formato nativo** (herencia del post de Marco Aurelio). Ver §4.6.
- **Deslizadores de peso por sección en Algoritmo**, con preview en tiempo real. Ver §4.7.
- **Hilos de respuesta sin amplificación al feed principal**. Ver §4.8.
- **Clip de voz de 10s** como formato honesto. Ver §4.9.
- **Resumen en 140 caracteres** asumido por el lector. Ver §4.10.

---

## 3. POLIS — funcionalidades en juego

### 3.1 Ya en el código
- **4 verbs**: Mapear, Peticionar, Ocupación, Ventanilla `(KOINOS-actual)`.
- **Mapa SVG estilizado con pines** `(KOINOS-actual)` — `PolisMode` línea ~1639, placeholder hasta Leaflet.
- **Pines de ejemplo en LPGC** `(KOINOS-actual)` — `POLI_PINS` línea ~1572 (Triana, Plaza del Pilar, El Confital, Las Canteras, Vegueta).
- **Ruta independiente `/mapear`** `(KOINOS-actual)` — `src/app/mapear/page.tsx`.
- **Calibrador pixel art** `(KOINOS-actual)` — `src/app/calibrador/page.tsx` + `src/lib/pixelart/`.
- **Pipeline de digitalizador urbano documentado** `(KOINOS-actual)` — `POLIS_digitalizador_urbano.md`.
- **Carpeta Godot con `mercado_vegueta`** `(KOINOS-actual)` — destino final de los tiles generados.

### 3.2 Mencionadas en `POLIS_digitalizador_urbano.md` (en cola técnica)
- **Integración Google Street View API** `(KOINOS-en cola)`.
- **Integración Mapillary API** `(KOINOS-en cola)`.
- **Fotogrametría móvil (Polycam / RealityCapture)** `(KOINOS-en cola)`.
- **Segmentación por zonas con modelo de visión** (SAM de Meta, GroundingDINO) `(KOINOS-en cola)`.
- **8–12 perfiles de material canónicos** para contexto canario. En el doc se proponen 4 como ejemplo: `piedra_volcanica_canaria`, `madera_tea`, `encalado_blanco`, `azulejo_hidraulico`.
- **TileMap de prueba en Godot** con GDScript generado por el calibrador.
- **Alimentación de NotebookLM** con los JSON exportados del calibrador.

### 3.3 Candidatas a rescatar — `(? por confirmar con Pancho)`
- **Ágora migrada de PHAROS como modo de debate** — el código de `PolisMode` comenta "Migrated from PHAROS' 'ágora' + mapa concepts". Eso apunta a que PHAROS tenía una capa llamada "ágora" que se absorbió aquí. ¿Quedan funcionalidades de aquella ágora que no se han traído? `(? por confirmar)`
- **Presupuesto participativo local** (al estilo Decidim). `(? por confirmar)`
- **Asambleas físicas con convocatoria geolocalizada**. Ya aparece en el pin `@vegueta.viva` como caso de ejemplo. Decidir si es una funcionalidad de primera clase. `(? por confirmar)`
- **"Estado ciudadano"** del usuario — una vista pública de qué tramites has hecho, qué peticiones has firmado, qué has aportado. `(? por confirmar)`

### 3.4 Sugerencias nuevas `(nuevo)`
- **Interoperabilidad con Decidim como capa** (ver `03_POLIS.md` §4.1).
- **Ventanilla contextual por ubicación**. Ver §4.2.
- **Ciclo de vida del pin** (`aviso / evento / asamblea / peticion / oferta` con reglas de caducidad). Ver §4.3.
- **Ocupación como NextDoor/Wallapop sin pago**. Ver §4.4.
- **Gamificación de contribución por insignias de calle** (pendiente de contrastar con `Notebook/GAMIFICACIÓN`). Ver §4.5.
- **Línea temporal del barrio** complementaria al mapa. Ver §4.6.
- **Toggle mapa estándar ↔ mapa pixel art** alimentado por el digitalizador. Ver §4.7.
- **Asamblea pol.is anclada al pin**. Ver §4.8.
- **Patrimonio visual acumulado** del barrio. Ver §4.9.
- **Notificaciones geográficas por interés en pin**. Ver §4.10.

---

## 4. Ideas transversales a los 3 modos

### 4.1 Ya en el código
- **Un solo rail de medallas que muta por modo** `(KOINOS-actual)` — decisión de diseño central.
- **Diario plegable global** `(KOINOS-actual)`.
- **Autenticación Supabase con metadata** `(KOINOS-actual)` — `user.user_metadata?.display_name`.

### 4.2 Candidatas a rescatar — `(? por confirmar con Pancho)`
- **Notificaciones unificadas** en el tabbar inferior (`home/page.tsx` ya tiene un botón 🔔 Alertas sin contenido). Se puede rescatar como centro de notificaciones por modo. `(? por confirmar)`
- **Buscador global** transversal — también hay un botón 🔍 Buscar sin contenido. Decidir qué busca: ¿posts? ¿pines? ¿personas? ¿todo a la vez? `(? por confirmar)`
- **Perfil de usuario** con vista pública y privada. El botón 👤 Perfil está vacío. `(? por confirmar)`

### 4.3 Sugerencias nuevas `(nuevo)`
- **Cambio de modo con gesto físico** — deslizar la columna central lateralmente para cambiar entre TOUCH/FEED/POLIS (en móvil). Como cambiar de página.
- **Estado del usuario visible en el rail** — una insignia pequeña en la medalla activa cuenta las novedades en ese submodo ("3 nuevas").
- **Descubrimiento cruzado** — desde un pin de POLIS, saltar al hilo de FEED que habla de ese lugar. Desde un post de FEED con geolocalización, saltar al pin de POLIS. Conexión explícita entre los 3 modos.
- **Archivo semanal automático** — el viernes por la tarde, KOINOS propone al usuario un resumen de la semana: 3 pines que has seguido, 2 posts que has PECado, 1 foto del Álbum que subiste. Ritual de cierre. Sin métricas, sin gamificación dura.
- **Export de todo** — un botón que genera un zip con todos tus datos en formatos abiertos (json, md, jpg). Cumple GDPR y da señal de confianza a usuarios prudentes.
- **"Antídoto del feed"** — una opción que, al activarse, sustituye el FEED por un texto largo curado (un ensayo, una entrevista). Sin scroll, sin likes. Un botón de "hoy quiero leer algo largo" dentro de la app cívica.

---

## 5. Instrucciones para mantener este log

1. **Cada vez que se descarte una funcionalidad**, añadirla aquí con su etiqueta antes de borrarla del código.
2. **Cada vez que se sugiera una funcionalidad nueva**, añadirla en la sección `(nuevo)` del módulo correspondiente.
3. **Marcar `(? por confirmar)`** cualquier cosa que venga de una conversación antigua no trazable, hasta que Pancho la corrobore o la descarte.
4. **Revisar trimestralmente** (o cuando se cambie de rumbo grande) qué ideas rescatables merecen volver al backlog activo.
5. **Conectar con `Notebook/GAMIFICACIÓN`** cuando esté accesible, para traer de allí las mecánicas de gamificación que informen el sistema de medallas del rail y las insignias de contribución en POLIS.

---

*Este log nace el 12 de abril de 2026. Es un documento vivo — cada sesión puede (y debe) añadir entradas.*
