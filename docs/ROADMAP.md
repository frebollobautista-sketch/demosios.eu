# ROADMAP — Demos iOS by OCRE

Vista accionable de las tareas, consolidada desde `docs/IDEAS.md`. Cada línea lleva un marcador:

- ✓ **hecho** (en producción o en el repo y listo para pushear)
- → **en curso** (empezado, falta cerrar)
- ○ **pendiente** (aceptado, sin empezar)
- ? **exploratorio** (idea abierta, a decidir antes de tocar código)

Última actualización: 2026-04-20.

---

## 1. Infraestructura y despliegue

- ✓ Repositorio GitHub `frebollobautista-sketch/demosios.eu` enlazado a Vercel con auto-deploy en cada push a `main`.
- ✓ Dominio `demosios.eu` en DonDominio apuntando a Vercel via nameservers, SSL emitido por Let's Encrypt.
- ✓ Proyecto Supabase `ocre` en `eu-west-3` (Free tier, 0 €/mes) con tablas `profiles` + `contribuciones` + RLS + trigger de creación automática de perfil.
- ✓ Vercel Deployment Protection desactivado para producción.
- ✓ Conectores MCP de Supabase y Vercel en Cowork.
- ○ GitHub Desktop como único flujo para pushes manuales — establecido por falta de MCP oficial de GitHub.

## 2. Marca e identidad

- ✓ Nombre del proyecto: **Demos iOS by OCRE** (lectura doble griego/tech, explicada en /nosotros).
- ✓ Logo del faro en el header (SVG inline, icono más nombre en dos líneas).
- ✓ Favicon pendiente de generar a partir del faro — ○ pendiente de build-time script o asset manual.
- ✓ Paleta blanca (papiro v1) con acentos ocre/siena/oliva/sangre/ámbar.
- ✓ Metadatos Open Graph y Twitter completos.
- ○ Imagen de compartir (OG image) personalizada — falta generar un `public/og.png` 1200×630 con el faro y el nombre.
- ? Modo aventura / skin romana con toggle en /ajustes que rote los nombres griegos por latinos (`src/lib/skins/nombres.ts` ya preparado).

## 3. Navegación y shell

- ✓ Header en dos filas (logo + acciones · nav de secciones siempre visible).
- ✓ Banner de suscripción al correo, solo para registrados, persistente vía localStorage.
- ✓ CTA protegidos (`CTAProtegido`) para acciones que requieren sesión.
- ○ Reactivar banner flotante del avatar (`BannerAvatar.tsx`) cuando haya contribuciones reales que alimenten el nivel/clase. Retirado de momento por ser prematuro.
- ? Faro clicable por pisos: convertir cada `<g id="piso-…">` del `FaroHero` en un `<Link>` a su sección correspondiente (base→Inicio, medio→Ágora, alto→Bibliotheka, galería→Nosotros, linterna→Polis).

## 4. Auth y perfil

- ✓ `/login` con tres vías: magic link, email+contraseña, Google OAuth.
- ✓ `/registro` mínimo: email + contraseña + handle (sin barrio, sin DNI).
- ✓ `/auth/callback` que intercambia `code` por sesión de Supabase.
- ✓ Proxy (`src/proxy.ts`, antes `middleware.ts`) que refresca cookies y protege `/perfil` y `/ajustes`.
- ✓ `/ajustes` con toggle de privacidad (público/privado) cableado a `profiles.is_public`.
- ✓ `/perfil` con avatar + stats mock de capital.
- ○ Apple OAuth cuando haya app móvil.
- ○ Sustituir `PERFIL_DEMO` en `/perfil` por lectura real desde `profiles` + `contribuciones` del usuario actual.
- ○ Guardar barrio del usuario en `/ajustes` → `profiles.barrio_id`.

## 5. Inicio

- ✓ Faro hero animado (SVG con haces oscilantes ±4°, pivote en la bombilla, ciclo 6 s encendido/apagado).
- ✓ Thread narrativo en tres pasos (Ágora · Bibliotheka · Polis) con lema y explicación.
- ✓ CTA final a `/nosotros`.

## 6. Ágora

- ✓ Página con las 8 secciones PHAROS visibles como cards.
- ○ Crear hilo: formulario + tabla `hilos(id, author_id, seccion_pharos, titulo, creado_en)` + RLS.
- ○ Responder hilo: tabla `respuestas` con threading básico.
- ○ PEC sobre hilos y respuestas: tabla `pecs` + contador visible.
- ○ Filtro por sección PHAROS, por barrio.
- ? Daily highlight: elevar temporalmente un hilo por sección PHAROS cada día.
- ? Moderación por semáforo híbrido (autor + comunidad + editorial).

## 7. Bibliotheka

- ✓ Dos pestañas funcionando: Cursus honorum (grados) · τὰ Κοινά (8 secciones).
- ✓ Los 7 grados del cursus con lema, función cívica y correspondencia profesional.
- → **Escribanía / Scriptorium: tercera ala para artículos largos P2P.** Propuesta en curso, pendiente de:
  - ? Nombre final: Grapheion / Escribanía / Imprenta / Kalamotheka.
  - ? Estructura: 3ª pestaña dentro de Bibliotheka o sección propia en el header.
  - ? Editor: Markdown+preview / WYSIWYG tipo Notion / híbrido.
  - ? Campos: título, copete, sección PHAROS, barrio, tags, pull quote.
- ○ Subir vídeo real al cursus: storage Supabase + encoding → `contribuciones { tipo: "video_cursus" }`.
- ○ Publicar recurso en Koiná: formulario + `contribuciones { tipo: "recurso_koina" }`.
- ○ Listado real de recursos filtrable por sección PHAROS.
- ? Validación de ergátes-a-didáskalos: otros didáskalos dan el visto bueno a una serie ajena.

## 8. Polis

- ✓ Tablero hexagonal MVP con 10 barrios de LPGC coloreados por capital dominante.
- ✓ Modal `BarrioModal` con composición de capital y tres CTAs protegidos.
- ✓ Andamiaje para aceptar vectores reales (`GeometriaBarrio` con modo `hex` | `vector`, helper `geo.ts` para GeoJSON→SVG).
- → **Vectores reales de barrios LPGC.** Pendiente de:
  - ? Fuente: hallazgo de que OSM solo tiene puntos, no polígonos. Opciones: Voronoi desde los 10 centroides OSM + contorno municipal, INE secciones censales agregadas, o dibujo manual desde Blender GIS.
  - ? El usuario está trabajando en paralelo con Blender GIS — pendiente saber si la escena tiene contornos dibujados manualmente o solo edificios OSM.
- ○ Extender tablero a Santa Cruz de Tenerife y el resto de capitales insulares.
- ○ Rutas dinámicas `/isla/[islaId]/[municipioId]/[barrioId]` con Link desde el navegador territorial.
- ○ Capa de landmarks superpuesta al tablero (Catedral, Mercado de Vegueta, etc.).
- ○ Marcar un bloque: cuando haya vectores reales, permitir a usuarios registrados pinchar un bloque individual y aportar información sobre su titularidad.
- ? Conexión con catastro INSPIRE / CNMV para identificar SOCIMIs y fondos buitre.

## 9. /nosotros

- ✓ Página con Misión · Visión · Valores (placeholders) + Equipo + Explorador de nomenclatura griego/latino.
- ○ **Redactar** Misión, Visión y Valores reales (pendiente del usuario, son textos personales).
- ○ Añadir bio completa de Pancho en el bloque Equipo.
- ○ Sumar colaboradores conforme aparezcan.

## 10. Sistema de capital

- ✓ Tres ejes definidos: Koinonía (KOI) · Paideía (PAI) · Politeía (POL).
- ✓ Función de agregado a partir de contribuciones implementada en `src/lib/capital/contribuciones.ts`.
- ✓ Cursus honorum ligado a totales por eje y totales globales.
- ○ Cablear al servidor: computar capital real al vuelo leyendo `contribuciones` del usuario.
- ○ Badges compactos con códigos `KOI/PAI/POL` en perfiles y en hilos del Ágora.
- ? Cuarto eje opcional `oikonomia` (economía local productiva) si hiciera falta.
- ? Códigos cortos para las 8 secciones PHAROS (propuesta `SAL/CLI/COM/MIG/DEF/MED/IND/TRA`).
- ? Insignias laterales no lineales ("custodio/a del agua", "guardián/ana de la biblioteca del barrio").
- ? Red profesional a partir del cursus: sugeridos cercanos por barrio con PECs relevantes.

## 11. Producción editorial y de vídeo

- ○ **Serie "Circunstancia canaria"**, previa al cursus. Arco de 5-6 episodios:
  - 00. Canarias, circunstancia — marco general.
  - 01. La tierra que fue común — heredamientos, suelo comunal.
  - 02. Cómo se privatizó el archipiélago — turismo, vivienda vacacional.
  - 03. Qué sigue siendo común — inventario.
  - 04. Organizarse: por qué ahora — precariedad, éxodo.
  - 05. OCRE: para qué existe — puente al mecanismo.
- ○ Pipeline de producción: iPad + Procreate Dreams, ruta 1 (kinetic typography + grabado fijo).
- ○ Redactar guion 00 en `docs/guiones/00-circunstancia-canaria.md`.
- ○ Fijar encuadre único (1080×1920 o 1920×1080), paleta de 7 colores del cursus, bumper de 3 s.
- ○ Serie del Cursus honorum, uno por grado (7 vídeos cortos que expliquen cada nivel).
- ? El propio trabajo de animación convierte al autor en primer `poietés` del sistema (track paralelo artístico).
- ? El grabado romano sobrio puede debutar primero en vídeo antes que en UI del cursus.

## 12. Articulación con KOINOS

- ○ Decisión pendiente: perfil único cross-producto (una sola tabla para KOINOS+OCRE) o perfiles espejo sincronizados.
- ○ Digitalizador urbano pixel art de KOINOS debe alimentar el mapa de Polis — pipeline ya documentado en `KOINOS/POLIS_digitalizador_urbano.md`.

## 13. Accesibilidad y rendimiento

- ✓ `prefers-reduced-motion` honrado en el faro y en los divisores.
- ✓ `aria-label` y `role="img"` en SVGs decorativos.
- ○ Auditoría Lighthouse tras el primer lanzamiento público.
- ○ Imágenes optimizadas con `next/image` cuando haya fotos reales.
- ○ Revisar contraste de color en la paleta blanca (algunos grises claros pueden fallar AA).

## 14. Escalado técnico (cuando pase de 10k MAUs)

- ? Índices específicos en `contribuciones` por `user_id`, `seccion_pharos`.
- ? Redis delante de Supabase para sesiones cuando cueste en cómputo.
- ? Cloudflare como CDN ante Vercel si hace falta más caché geográfica.
- ? Migración gradual a Neon o Postgres autogestionado cerca del millón de MAUs.

---

## Prioridades sugeridas para las próximas sesiones

Ordenadas por impacto inmediato × coste de implementación:

1. **Escribanía / editor de artículos largos** — decidir nombre + estructura + editor. Es la pieza que más amplía la superficie de uso de la plataforma por un coste moderado. (Sección 7).
2. **Vectores reales de barrios LPGC** — acaba de inflexionar a algo reconocible por el ciudadano. Depende del trabajo paralelo del usuario en Blender GIS. (Sección 8).
3. **Redactar Misión · Visión · Valores en /nosotros** — sin esto el sitio sigue oliendo a demo. No es código, es texto del usuario. (Sección 9).
4. **Guion del episodio 00 de la serie "Circunstancia canaria"** — desbloquea la producción de vídeo y con ella el Cursus honorum real. (Sección 11).
5. **Cablear hilos del Ágora** — primera superficie social real, permite probar el sistema de capital con datos reales. (Sección 6).

Todo lo demás se atiende conforme la realidad lo pida.
