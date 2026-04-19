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

- **Inicio** — navegador isla → municipio → barrio, presentación del común.
- **Ágora** (Ἀγορά) — deliberación pública, hilos por sección PHAROS.
- **Bibliotheka** (Βιβλιοθήκη) — dos alas:
  - *Cursus honorum*: canal de vídeos ciudadanos, graduación cívica.
  - *τὰ Κοινά (Koiná)*: recursos del común (guías, plantillas, servicios).
- **Polis** (Πόλις) — mapa de bloques por tipo de capital, candidatos a recuperación.
- **Perfil** — avatar, capital acumulado, nivel en el cursus.

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
