# BIBLIOTHEKA — Modo de obra publicada

> "Lo que se queda escrito, lo que se transmite, lo que el común guarda."
> — Pendiente de cita real desde el código.

> **Filiación arquitectónica (2026-05-02):** Bibliotheka es el módulo del **ELLO** dentro del marco YO/NOSOTROS/ELLO de Demos iOS. Substack-like: herramienta libre para presentar y publicar obra acabada. Aquí pesa la autoría, la duración del texto, la curaduría editorial. Es el espacio donde cada uno aporta lo que sabe hacer al patrimonio común y la voz queda fijada. Ver decisión arquitectónica completa en [`docs/IDEAS.md → Arquitectura del proyecto`](../IDEAS.md#arquitectura-del-proyecto).

---

## 1. Qué es Bibliotheka

Bibliotheka es **el lugar donde la voz queda fijada**. A diferencia de FEED (donde lo que dices se hunde en horas) y de Ágora (donde lo que escribes vive dentro de un debate ajeno), en Bibliotheka publicas **obra propia** que sobrevive como pieza autónoma. Es el modo Substack del proyecto, en clave cívica canaria.

Tres alas previstas:

- **Cursus honorum** — canal de vídeos ciudadanos. Cada vecino que ha cubierto el grado correspondiente del cursus puede abrir una serie. Modelo "kinetic typography → motion comic → cutout articulado" documentado en `IDEAS.md` (sección Gamificación).
- **Grapheion** (γραφεῖον, escribanía) — editor de artículos largos peer-to-peer. Ensayos, cartas abiertas, panfletos. Pendiente de decisión sobre nombre / estructura / editor (ver `IDEAS.md` sección Bibliotheka — escribanía).
- **τὰ Κοινά (Koiná)** — recursos del común *publicables*: guías prácticas, plantillas, dossiers reusables. **Lo que NO va en Koiná** son los servicios o intercambios anclados al territorio (coche compartido, busco/ofrezco): esos se van a Polis tras la decisión del 2026-05-02.

## 2. Qué NO es Bibliotheka

- No es Ágora — aquí no se debate, se publica.
- No es FEED — aquí no se postea desde la vida cotidiana, se publica obra acabada.
- No es Polis — aquí no se ancla al lugar geográficamente; se ancla a la sección PHAROS y al autor.

## 3. Pendiente de desarrollar (próximas sesiones)

- Modelo de datos.
- Editor para Grapheion (markdown simple vs WYSIWYG vs híbrido — ver IDEAS).
- Pipeline de subida de vídeos del cursus a Supabase Storage.
- Curación editorial: ¿quién promueve una pieza al kiosko de inicio?
- Cierre del ciclo Ágora → Bibliotheka: cuando un hilo se cierra con resumen, ese resumen se auto-publica como recurso en Koiná (decisión 2026-05-02 del inventario de funcionalidades de Ágora).
- Reaplicar las recomendaciones quality-of-life que decidimos para Ágora (sin trending, notificaciones por digest, modo lectura sin botones, etc.).

## 4. Lo que ya existe en el código

- Ruta `/bibliotheka/page.tsx` con dos paneles iniciales (cursus + Koiná).
- Tipos del cursus en `src/lib/cursus/grados.ts` (7 grados con función cívica).
- Sin modelo de datos persistente todavía.
