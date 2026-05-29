# TOUCH — Modo íntimo

> "Tu colección personal, sin feed ni algoritmo."
> — `src/app/feed/page.tsx`, copy placeholder del submodo Álbum.

> **Filiación arquitectónica (2026-05-02):** TOUCH es el módulo del **YO íntimo** dentro del marco YO/NOSOTROS/ELLO de Demos iOS. Mismo pronombre que FEED pero alcance restringido: lo que solo enseñas a tu círculo invitado. Conserva el modelo de tres niveles de cercanía (íntimo / cercano / conocido — D3 del 2026-04-20). Ver decisión arquitectónica completa en [`docs/IDEAS.md → Arquitectura del proyecto`](../IDEAS.md#arquitectura-del-proyecto).

---

## 1. Qué es TOUCH

TOUCH es el modo **íntimo y cerrado** de KOINOS. Es la habitación propia del usuario: su archivo de fotos, sus colecciones guardadas, su grupo de personas de confianza, y su escaparate personal (Kiosko) hacia ese círculo estrecho.

**Principio rector:** en TOUCH no hay algoritmo, no hay métricas públicas, no hay infinite scroll. Lo que hay es **curaduría** por parte del propio usuario y acceso selectivo por parte del círculo invitado. Es lo contrario de Instagram público, lo contrario de TikTok, y lo contrario incluso del propio FEED de KOINOS.

### 1.1 Submodos activos en el código

Definidos en `TOUCH_MEDALS` (líneas 360–366 de `src/app/feed/page.tsx`):

| Medalla   | Icono    | Qué hace (ya escrito en copy)                                                |
|-----------|----------|------------------------------------------------------------------------------|
| Álbum     | Images   | Colección personal de fotos/vídeos guardados. Regla clave: la caption NO se muestra en el grid — pulsar la foto revela el texto. "Acto deliberado, no scroll pasivo." |
| Amigos    | Users    | Red íntima. Solo a quien invitas.                                            |
| Collage   | LayoutGrid | Combina varias fotos en una sola composición.                              |
| Video     | Film     | Vídeos cortos a partir de fotos o clips (editor básico, música, transiciones). |
| Kiosko    | Store    | Escaparate privado. Lo que el usuario elige mostrar a su red íntima.         |

El único submodo con implementación real hoy es **Álbum** (hay un `AlbumPanel`, un `AlbumModal` y datos de ejemplo `ALBUM_ITEMS`). El resto son placeholders con `TouchPanel` genérico.

---

## 2. Investigación: qué están haciendo otros (y qué cubren y qué no)

### 2.1 El giro de Gen Z hacia lo privado

Hay un consenso emergente en 2024–2026 sobre que el modelo "feed público optimizado" está agotado, especialmente entre usuarios jóvenes. *Close Friends* de Instagram, BeReal, Locket, Poparazzi, Retro y Vero llevan tres años explorando el mismo territorio que TOUCH pretende ocupar: **compartir con pocos, sin edición excesiva, sin presión de performance**. Stanford publicó en 2025 su *Youth Safety and Digital Wellbeing Report* documentando este giro.

De la investigación se desprenden cuatro patrones de diseño recurrentes:

- **Captura honesta o con fricción** (dual-camera de BeReal, widget en pantalla de inicio de Locket, prohibición del selfie de Poparazzi).
- **Círculos pequeños, curados manualmente** (Vero con sus niveles de cercanía, Enclayve con dispositivo físico en casa, Favs como red explícita de amistades).
- **Cronología en vez de algoritmo** (Ello, Behance, Vero — el patrón es volver al orden temporal y quitar el ranking).
- **Gestos deliberados** en vez de swipe infinito (toques conscientes, widgets fijos, no-scroll).

### 2.2 Lo que ninguno resuelve bien

- **Archivo personal de largo plazo.** Casi todas las apps íntimas están pensadas para el *ahora* (foto del día, momento en directo). Muy pocas tratan el álbum como un **patrimonio personal** que crece en el tiempo y se puede revisar años después. Álbum de TOUCH, si se diseña bien, puede ocupar ese hueco.
- **Escaparate personal dirigido a la red íntima.** Portfolios (Behance, Dribbble) son públicos. Close Friends de Instagram es efímero (stories). Nadie ofrece un **Kiosko** que sea a la vez editable, semi-permanente y visible solo para una lista concreta. Es una categoría vacía.
- **Colecciones compartidas negociadas.** Álbumes compartidos de Apple o Google Photos funcionan, pero no tienen curación editorial (quién decide qué entra, cómo se ordena, con qué pie de foto). TOUCH puede meter edición colaborativa suave.
- **Archivo con memoria narrativa.** Nadie ata automáticamente fotos a texto largo (el álbum explicando qué pasaba ese día). TOUCH ya tiene una pista: la caption oculta en el grid que solo aparece al tocar es exactamente eso — pequeña narrativa que solo se activa con un gesto consciente.

### 2.3 Referentes a estudiar con atención

- **BeReal** — para el patrón de "captura con fricción" y la economía de la atención recíproca. Su declive reciente es tan instructivo como su auge: enseña que la fricción sin valor perdura poco.
- **Locket** — para el patrón del "widget en pantalla de inicio": la presencia de los amigos en el espacio del usuario sin abrir la app.
- **Poparazzi** — para el principio "no te fotografías tú, te fotografían los demás". Útil para pensar Kiosko como algo construido en parte por los amigos.
- **Enclayve** — para la idea radical de "tu red vive en un dispositivo físico en tu casa". No copiarla, pero sí entender su lectura de la privacidad.
- **Day One** (diario personal) — para pensar Álbum como formato diario/cronológico cuando el usuario quiere verlo así.
- **Glass** — para curación minimalista de fotografía sin métricas.

---

## 3. Gaps y necesidades no cubiertas (mapa para informar UI antes de tocar código)

| Área                               | Estado en KOINOS | Gap identificado                                                                 |
|------------------------------------|------------------|----------------------------------------------------------------------------------|
| Modelo de invitación al círculo    | No definido      | ¿Pull (invito yo) / push (me invito yo con código) / mixto? Ver backlog 3.1.     |
| Persistencia y búsqueda del álbum  | Parcial (datos dummy) | Falta un esquema de metadatos: fecha, lugar, etiqueta personal, "humor del día". |
| Caption diferida en el grid        | Idea escrita en copy | Falta implementar el gesto: tap = revela; long-press = edita.                    |
| Kiosko como formato editable       | Placeholder      | No existe modelo de "slot editable" ni orden manual ni cambio de portada.        |
| Collage y Video                    | Placeholder      | Decidir si se construyen nativos o se enlazan a herramientas existentes.         |
| Exportación del archivo            | No existe        | Si TOUCH es patrimonio personal, debe poder exportarse (zip, PDF, libro).        |
| Qué NO hace el modo                | No escrito       | Escribir la negativa explícita en UI: "aquí no hay likes, no hay rankings, no hay algoritmo". |

---

## 4. Backlog de ideas para TOUCH

Agrupadas por cercanía al código actual.

### 4.1 Círculo íntimo como grafo asimétrico
El modelo más sencillo es bidireccional (tú y yo somos amigos mutuamente). El más potente es **asimétrico con círculos**: cada usuario define cuántos niveles quiere (solo 1 nivel "íntimos", o 3 niveles: íntimos / cercanos / conocidos). El álbum, el kiosko y cada post pueden apuntar a un nivel, y ese nivel decide quién lo ve. Esto es lo que Vero popularizó y lo que Close Friends intentó tardíamente. Para KOINOS sería natural: ya se trabaja con modos y segmentación.

### 4.2 Caption oculta → historia encadenada
Extiende el gesto ya escrito: además de revelar el texto al tocar una foto, permite **encadenar** varias fotos con una narrativa progresiva (como un carrusel, pero el carrusel no se pre-renderiza — el siguiente solo carga al tocar). Convierte el álbum en un formato cuentístico sin tener que ir a Stories o Reels.

### 4.3 Álbumes co-editados en modo "cena"
Tras un evento compartido (cena, viaje, partido), TOUCH puede abrir un álbum temporal al que todos los asistentes suben fotos durante un tiempo acotado (p.ej. 48h). Se cierra y se queda como recuerdo común. Nadie lo hace bien todavía: Google Photos lo intenta, pero sin ritual. Aquí el ritual (tiempo acotado, lista de invitados, cierre visible) es el valor.

### 4.4 Kiosko como escaparate negociado
El Kiosko no tiene que ser solo "lo que yo enseño": puede permitir que **amigos suban cosas a mi Kiosko** con mi aprobación. Herencia de Poparazzi, pero aplicada a un escaparate estable en vez de a un feed efímero. Muy potente si se aplica al portfolio personal (un amigo puede "regalarte" una foto para tu Kiosko).

### 4.5 Historia del álbum como línea de tiempo vertical
Álbum con vista alternativa tipo *Day One*: línea vertical con meses/años, scroll vertical rápido, con zooms por décadas. Convierte la app en archivo de vida, no en feed.

### 4.6 Detección de "momentos" sin algoritmo
En vez de un algoritmo opaco, exponer al usuario un **agrupador transparente**: "estas 14 fotos son del 3 de marzo. ¿Quieres que TOUCH las agrupe como un momento?". El agrupamiento es una propuesta, no una decisión. El usuario acepta o rechaza. Este es el patrón de *consentimiento progresivo* que podemos oponer al patrón TikTok.

### 4.7 "Modo sobre" — ver tu propio álbum desde fuera
Un gesto para ver tu álbum como lo ve un amigo de nivel X. Ayuda a curar. Útil porque muchos usuarios no saben **qué están compartiendo realmente** y con quién.

### 4.8 Desconexión del algoritmo como postura explícita
Cada submodo de TOUCH debería mostrar una micro-etiqueta en el header: "orden: por fecha / manual / por amistad". Sin algoritmo oculto. Transparencia radical como ventaja competitiva frente a Instagram.

---

## 5. Preguntas abiertas

1. **¿Los submodos de TOUCH comparten datos con los de FEED?** Por ejemplo, si yo guardo un post del FEED público en mi Álbum de TOUCH, ¿qué se guarda exactamente — el enlace, la captura, la copia? Tiene implicaciones legales y de UX.
2. **¿Kiosko es ofrecible al público o solo a la red íntima?** Decisión pendiente. Yo recomendaría **dos capas**: Kiosko íntimo (visible solo al círculo) y Kiosko público (opcional, visible a cualquiera con enlace). Diferenciarlos visualmente para evitar confusión.
3. **¿Amigos es la misma lista en TOUCH que en FEED?** En FEED hay una medalla "Amigos" y en TOUCH también. Si son la misma lista, hay que deduplicar el código. Si son distintas, hay que explicar por qué al usuario.
4. **Video nativo vs export.** Si hacer editor de vídeo nativo es caro, valorar export directo a Instagram/TikTok con marca de "hecho en TOUCH" como alternativa.

---

## 6. Entradas mínimas al código para esta siguiente iteración

Lo que se debería documentar directamente en el código al cerrar esta pasada de notebook:

- Añadir un comentario cabecera en `TouchPanel` (línea ~1474) que apunte a este archivo.
- En `TOUCH_COPY`, cambiar los "próximamente" por copy definitivo que refleje las decisiones de 4.8 (transparencia del orden).
- Decidir esquema Supabase de `touch_albums`, `touch_circles`, `touch_kiosks`.

---

## Fuentes consultadas para este documento

- [The End of Oversharing in 2025: Why Gen Z Is Going Private on Social Media — IFSO / Medium](https://medium.com/@ifso_59790/the-end-of-oversharing-in-2025-why-gen-z-is-going-private-on-social-media-5cdc2720e524)
- [BeReal Alternatives: Top 22 Social Networks — AlternativeTo](https://alternativeto.net/software/bereal/)
- [Poparazzi: The Anti-Selfie Selfie Club — Medium](https://medium.com/poparazzi/the-anti-selfie-selfie-club-ad1ce447ac91)
- [Close Friends Only: the New Private Internet — The Teen Magazine](https://www.theteenmagazine.com/close-friends-only-the-new-private-internet)
- [Enclayve — private invite-only home-based network](https://www.enclayve.com/)
- [Stanford Youth Safety and Digital Wellbeing Report 2025](https://cdh.stanford.edu/sites/g/files/sbiybj29486/files/media/file/youth_safety_and_digital_wellbeing_report_2025.pdf)
- [An Anti Algorithmic Manifesto — maloid](https://maloid.neocities.org/blog/posts/2025-03-30-An-Anti-Algorithmic-Manifesto)
- [How Gen Z Social Apps Like Poparazzi, BeReal & VSCO Are Transforming Social Media Marketing — Marketing Scoop](https://www.marketingscoop.com/marketing/how-gen-z-social-apps-like-poparazzi-bereal-vsco-are-transforming-social-media-marketing/)
- [Instagram Close Friends: Complete Guide 2025 — SocialRails](https://socialrails.com/social-media-terms/instagram-close-friends-feed-posts)

*Código de referencia en `src/app/feed/page.tsx` líneas 360–366, 1024–1554.*
