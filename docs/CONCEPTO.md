# OCRE — Concepto

**Organización Canaria para la Recuperación de Espacios.**

## Tesis

En Canarias, como en otros territorios tensionados por la acumulación inmobiliaria, parte del parque construido está efectivamente fuera del común: bloques enteros controlados por fondos buitre, SOCIMI, operadores vacacionales opacos. OCRE propone **recuperar esos espacios virtualmente antes de poder reclamarlos materialmente**: mapearlos, clasificarlos por tipo de capital propietario, hacer visible el mosaico de la ciudad.

La recuperación virtual no sustituye la material. La antecede. Hace público lo que el mercado deja difuso.

## Articulación con KOINOS

OCRE reutiliza piezas de KOINOS:

- Las 8 **secciones PHAROS** como taxonomía temática del Ágora y la Bibliotheka.
- El modelo de **perfil + avatar + PEC** (respaldo encarnado).
- El concepto de **capital cívico** discutido en PHAROS, aquí explicitado como tres ejes griegos: **Koinonía**, **Paideía**, **Politeía**. Ver [`CAPITAL.md`](./CAPITAL.md).
- La **gamificación ligera** discutida en `docs/notebook/03_POLIS.md §4.5`, aquí convertida en un **cursus honorum** de siete grados con función cívica concreta y correspondencia profesional contemporánea. Ver [`CURSUS_HONORUM.md`](./CURSUS_HONORUM.md).

Donde KOINOS es una plataforma cívica multimodal (TOUCH, FEED, POLIS), OCRE es una **ventanilla única territorial** para vecinos, autónomos y PYMEs canarias.

## Secciones

Demos iOS / OCRE se organiza por **pronombres del habla común** (decisión 2026-05-02; ver [`IDEAS.md → Arquitectura del proyecto`](./IDEAS.md#arquitectura-del-proyecto)). Cada módulo encarna un modo gramatical distinto. La división no es decorativa: define UI, expectativas del usuario y arquitectura de notificaciones.

- **Inicio** — pantalla "mi quiosco": mezcla etiquetada de los cuatro mundos según las preferencias del usuario.

- **El YO** — Twitter / Instagram. Posts personales, expresión cotidiana.
  - **FEED** = el yo público.
  - **TOUCH** = el yo íntimo (invite-only, círculos de 3 niveles).

- **El NOSOTROS** — Reddit con sentido de base de datos. Deliberación temática.
  - **Ágora** (Ἀγορά) = el nosotros que delibera. Hilos por sección PHAROS, anclados a categoría local + territorio. Tres modalidades dentro del foro: debate, propuesta votable (Decidim), mapeo de consenso (Polis-style).

- **El ELLO** — Substack. Herramienta libre para publicar obra acabada.
  - **Bibliotheka** (Βιβλιοθήκη) = el ello que se publica. Cursus honorum (vídeos ciudadanos), Grapheion (ensayos largos), guías y plantillas reusables del común.

- **Polis** (Πόλις) — fuera del eje pronominal porque su unidad significativa es el **lugar**. Tres funciones:
  - Mapa cívico canario (digital twin, edificios 3D, capital por bloque).
  - Intercambio práctico anclado al territorio (coche compartido, oficios cerca, ofertas geo-localizadas).
  - Registro territorial colectivo (un bloque pasa a un fondo, una plaza cambia de uso, un comercio cierra).

- **Perfil** — avatar, capital acumulado, nivel en el cursus, huella participativa por sección.

## Elementos persistentes de UI

- **Header sobrio**: logo + Inicio / Ágora / Bibliotheka / Polis.
- **Esquina superior derecha**: correo (suscripción), perfil (avatar), ajustes.
- **Banner flotante inferior-derecha**: avatar del ciudadano con nivel, clase dominante y progreso. Minimizable (queda solo el avatar) y ocultable.
- **Banner inferior de suscripción**: ocupa solo la parte inferior del teléfono, colapsa a un único icono de correo en la esquina inferior izquierda. Recuerda la elección del usuario en `localStorage`.

## Paleta

Papiro (`#F4EEDF`), tinta oscura (`#2B241B`), ocre (`#B4832E`), ocre profundo (`#8A5E1F`), siena tostado (`#A14B2A`), oliva (`#5B7A3E`), sangre de toro (`#6E2A1E`, solo para avisos serios), carbón (`#1C1915`). Tipografía serif romana para títulos y rótulos cívicos, sans sistema para cuerpo.

## Roadmap mínimo

1. Conectar Supabase: replicar tabla `profiles` de KOINOS con `islaId/municipioId/barrioId`.
2. Cablear las contribuciones (`video_cursus`, `recurso_koina`, `hilo_agora`, `respuesta_agora`, `pec_recibido`, `espacio_recuperado`, `mapa_pin`) como filas que se agregan al capital.
3. Rutas dinámicas `/isla/[islaId]`, `/isla/[islaId]/[municipioId]`, `/isla/[islaId]/[municipioId]/[barrioId]`.
4. Subida de vídeos (storage de Supabase) con validación del cursus.
5. Mapa Polis apoyándose en el digitalizador urbano pixel art (`KOINOS/POLIS_digitalizador_urbano.md`).
