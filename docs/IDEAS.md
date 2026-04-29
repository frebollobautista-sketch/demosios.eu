# IDEAS — captura del flow del chat

Todo lo que se dice en el chat y no se acaba operando en el mismo turno vive aquí. Formato mínimo:

```
### Fecha — título corto
Contexto de una línea. Decisión pendiente o siguiente paso.
```

**Nota:** para la vista accionable y priorizada de estas ideas, ver [`ROADMAP.md`](./ROADMAP.md). Este fichero es el log cronológico sin filtrar.

---

## Marca e identidad

### 2026-04-19 — Nombre del proyecto: **Demos iOS** (lectura doble intencional)
Decisión del usuario: el proyecto no se llama "Demosios" sino **Demos iOS** — escrito con espacio y con la grafía clásica de iOS (i minúscula + OS mayúscula). Doble lectura deliberada:

- Para quien lee griego: δημόσιος ("público") → nombre clásico que justifica el dominio `demosios.eu`.
- Para cualquiera: "Demos iOS" → sistema operativo del demos (del pueblo). La plataforma se piensa como OS cívico, no como red social.

Visualmente en el logo: "Demos" en tipografía serif del proyecto + "iOS" en sans sistema (SF Pro / ui-sans-serif) ligeramente más pequeño, evocando la marca de Apple sin copiar su tipografía. "by OCRE" en tagline italic debajo. Dominio `demosios.eu` sin cambios.

### 2026-04-19 — Faro animado como hero de la home
Decisión del usuario: la primera cosa que ve cualquier visitante es un **faro** encendiéndose. Es lo que da clase y memorabilidad al proyecto antes de leer una sola línea. Implementado en `src/components/FaroHero.tsx` con SVG vectorial completo:

- **Estructura por pisos** (grupos `<g id="piso-base">`, `piso-medio`, `piso-alto`, `galeria`, `linterna`, `cupula`, `pinaculo`) para poder convertirlos en anchors clicables a secciones más adelante.
- **Animación**: los haces de luz rotan 18 s por vuelta (continuo) + encienden/apagan en ciclo de 6 s (0.3 s fade-in, 2.4 s pleno, 0.3 s fade-out, 3 s apagado). La bombilla central cambia de tono entre estados. El halo alrededor de la linterna pulsa al ritmo de los haces.
- **CSS en `globals.css`** (no styled-jsx), para que el componente pueda ser server-rendered.
- Respeta `prefers-reduced-motion`: sin animación, luces a opacidad fija.
- Posible siguiente paso cuando el usuario lo decida: convertir cada piso en un `<Link>` que lleve a su sección (piso base → Inicio, piso medio → Ágora, piso alto → Bibliotheka, galería → Nosotros, linterna → Polis). Hoy solo visual.

### 2026-04-19 — Icono de la marca: faro
El logo anterior (columna jónica) se cambia por un **faro**. Razones que se apilan:
1. Referencia directa a PHAROS (la torre de Alejandría dio nombre a todos los faros), que es el legado del proyecto anterior de Pancho del que OCRE hereda las 8 secciones temáticas.
2. El faro es símbolo canario primordial — archipiélago de faros por identidad geográfica.
3. Semánticamente funciona: una baliza civil que marca el camino encaja perfectamente con un "sistema operativo del demos". Se alinea con la tesis: no un muro, una luz.

### 2026-04-19 — Header rediseñado: nav siempre visible, sin hamburguesa
Decisión del usuario: las funcionalidades deben estar siempre visibles como botones, no escondidas tras un hamburguesa en móvil. Rediseño en dos filas:
- Fila 1 (h-14): logo del faro a la izquierda, acciones de usuario a la derecha (Entrar/Crear cuenta o perfil/ajustes).
- Fila 2 (h-11): las 5 secciones como botones con indicador activo. Scroll horizontal con `no-scrollbar` cuando no quepan en móvil.

`scroll-padding-top` subido a 7rem para que los anchors respeten el header doble.

### 2026-04-19 — Página /nosotros (About Us)
Creada con cuatro bloques: Misión · Visión · Valores (placeholders editables por el usuario), Equipo (de momento solo Pancho — "Fundador · Dirección"), y un Explorador de Nomenclatura griego/latino. Los placeholders llevan corchetes y texto en itálica gris para que sea obvio qué falta redactar.

### 2026-04-19 — Modo aventura: skin romana (nomenclatura latina)
Propuesta del usuario: activar opcionalmente nomenclatura latina para toda la plataforma. Tabla de correspondencia implementada en `src/lib/skins/nombres.ts`:

| Griego (actual) | Latino (aventura) |
|---|---|
| Ágora (Ἀγορά) | Forum |
| Bibliotheka (Βιβλιοθήκη) | Bibliotheca |
| Polis (Πόλις) | Civitas |
| τὰ Κοινά | Res Communes |
| Κοινωνία | Communitas |
| Παιδεία | Eruditio |
| Πολιτεία | Res Publica |
| Cursus honorum | (ya es latino) |

Toggle todavía no cableado en UI — vivirá en `/ajustes` como "Nomenclatura: griego / latino". Las rutas no cambian, solo las etiquetas. Previsualización inmediata en el explorador de `/nosotros`.

## Polis — UI del mapa

### 2026-04-29 — Nombres reales en regiones, no códigos
Decisión del usuario: las regiones del mapa nunca deben mostrar códigos crudos (CUSEC tipo `3501601003`, etiquetas tipo `Sec 003`). Si una unidad administrativa se llama oficialmente "San Lorenzo 3", ese es el nombre que se usa, números ordinales incluidos. La regla es: **nombre humano siempre, código nunca para el usuario final**. Hoy v16 ya muestra `barrio` cuando existe pero falla a "Sec 003" cuando no — hay que rellenar el catálogo y normalizar el fallback. Tarea #21.

### 2026-04-29 — Popup emergente con el nombre al clicar región
Al pulsar sobre un polígono (sección, distrito, barrio), debe emerger un label/popup centrado sobre la región con el nombre — no solo aparecer en el panel lateral como hace v16 ahora. Estilo `bindTooltip` o `bindPopup` de Leaflet. La identificación debe ser visualmente inmediata, sin necesidad de mirar a otro lado. Tarea #21.

### 2026-04-29 — Mapear zonas no-vivienda cuando todo sea polígono real
Cuando la UI deje los hexágonos mock y pase a polígonos vectoriales completos, hay que decidir cómo se tratan las zonas que NO son vivienda: espacios públicos (plazas, parques, costa), equipamientos (escuelas, hospitales, ayuntamientos), comercio (mercados, ejes comerciales), patrimonio, industria/logística, infraestructura, suelo natural. La tipología actual de capital (común / residente / autónomo / rentista / corporativo) está pensada para titularidad — no es suficiente para usos del suelo. Tres alternativas: añadir eje paralelo `uso_suelo` ortogonal a `titularidad`; ignorar las no-vivienda y colorear solo bloques residenciales; mostrarlas con tratamiento visual diferenciado (tramas, opacidad, desaturación). Decisión bloquea diseño del mapa dinámico (#16). Tarea #22.

## Patrimonio NODOS

### 2026-04-29 — Patrimonio metodológico de NODOS Culturales absorbido en KOINOS
Decisión del usuario: NODOS Culturales (Lima, 2021-2026) tiene un marco metodológico construido en 5 años de trabajo sociológico de campo. Independientemente de que el proyecto se integre o no con Demos iOS, **se recoge como patrimonio institucional del ecosistema KOINOS** para acumular experiencia.

Dos documentos generados:

- [`docs/ANALISIS_NODOS.md`](./ANALISIS_NODOS.md) — análisis estratégico del expediente: qué tiene, qué les falta, dónde Demos iOS encaja como alternativa al MVP que iban a contratar (Casanova/WordPress), tres escenarios de colaboración con sus pros y contras, preguntas pendientes para el usuario.
- [`docs/METODO_NODOS.md`](./METODO_NODOS.md) — distilación metodológica pura: tesis política del mapeo (Harley, Freire, De Sousa Santos), tres ontologías (espacios + agentes + prácticas), cuatro ejes de caracterización, cuatro métodos de captura, distinción Duxbury inventario/humanístico, glosario regional, marco teórico citado, ocho lecciones operativas absorbibles a KOINOS, bibliografía mínima.

Lecciones más importantes para KOINOS / Demos iOS aunque no se implementen ya:
1. Las prácticas (eventos itinerantes con frecuencia, estacionalidad, agentes organizadores) son tan importantes como los espacios — pieza completamente ausente hoy.
2. Provenance en `contribuciones`: distinguir presencial / virtual / itinerante / redes-web cambia la confiabilidad del dato.
3. Cohortes cartográficas como entidades de primera clase: un taller de mapeo es una comunidad con identidad propia.
4. Doctrina humanística (Duxbury): la modal del barrio debe contar memorias y relaciones, no ser un directorio.
5. Diccionario regional: el vocabulario vivo cambia de Vegueta a Anaga; la plataforma debería respetar el habla.

### 2026-04-20 — Trasladar todo KOINOS a Demos iOS como capas de un mismo OS cívico
Decisión estratégica del usuario: unificar KOINOS (red social, TOUCH+FEED) y OCRE (cívico, Ágora+Bibliotheka+Polis) bajo el paraguas Demos iOS. Objetivos:
- **Atraer al público serio** (OCRE formal) **y al usuario de red social canario cansado del odio** (KOINOS social) en una misma plataforma.
- **Ofrecer los módulos por separado o juntos** — cada usuario decide qué capas habita desde `/ajustes`.
- Una identidad, un Supabase, un sistema de capital compartido.

Plan completo documentado en [`docs/INTEGRACION_KOINOS.md`](./INTEGRACION_KOINOS.md) con: tesis, arquitectura unificada (tabla `publicaciones` con enum `modo`, tabla `reacciones` con 5 tipos, círculos para TOUCH, RLS por visibilidad), siete fases de migración estimadas, cuatro decisiones estratégicas abiertas (nombre del conjunto, coexistencia FEED/Ágora, visibilidad TOUCH, orden de fases) y riesgos con mitigación.

Pendiente de respuesta del usuario a D1-D4 antes de iniciar fase 1.

### 2026-04-20 — Decisiones D1-D4 cerradas
- **D1**: todo bajo Demos iOS; KOINOS se absorbe como módulos FEED y TOUCH (la marca KOINOS desaparece como entidad externa).
- **D2**: Ágora y FEED coexisten — Ágora versión cívica-seria, FEED parte del trípode social heredado de KOINOS. El usuario accede a las dos simultáneamente.
- **D3**: TOUCH invite-only estricto con círculos de 3 niveles (íntimo/cercano/conocido).
- **D4**: Fase 1 = FEED primero. Escribanía espera.

Fase 1 desbloqueada. Empezaremos en la siguiente sesión cuando el usuario dé la orden.

## Bibliotheka — escribanía / articulos largos

### 2026-04-20 — Tercera ala de Bibliotheka: editor de artículos P2P
Propuesta del usuario: añadir en la Bibliotheka un editor para publicar artículos largos peer-to-peer, como manera de expresar ideas que no caben en el formato hilo del Ágora. Queda como pieza de la plataforma pensada como OS cívico — lo que en la calle sería el panfleto, el ensayo, la carta abierta. Sub-decisiones abiertas:

- **Nombre**: Grapheion (griego γραφεῖον) / Escribanía (castellano) / Imprenta / Kalamotheka (caja de cálamos). Recomendación: Grapheion por coherencia con el resto de secciones griegas, con Scriptorium como latino del modo aventura.
- **Estructura**: tercera pestaña dentro de Bibliotheka (recomendado, respeta la arquitectura actual) o cuarta sección propia en el header.
- **Editor**: Markdown simple con preview en vivo (MVP, 1-2 h) / WYSIWYG tipo Tiptap (4-6 h, 200 KB extra) / híbrido con toolbar sobre markdown (compromiso).
- **Campos**: título · copete/entradilla · sección PHAROS · barrio/isla opcional · etiquetas libres · pull quote para compartir. Usuario a definir cuáles son obligatorios.

Pendiente de respuesta del usuario para fijar nombre/estructura/editor antes de construir.

## Sin clasificar

### 2026-04-19 — Preview renderizable dentro de Cowork
El usuario pidió ver el proyecto en preview sin levantar `npm run dev`. Se generó `ocre-preview.html` en la raíz del proyecto como preview autocontenido (vanilla JS, sin deps) para poder abrirlo directamente. Mantener actualizado cuando cambien las secciones principales.

### 2026-04-19 — Silenciar warning de lockfiles múltiples
Next.js 16 detecta `/Users/panch/package-lock.json` como workspace root. Se fijó `turbopack.root` en `next.config.ts` apuntando al directorio del proyecto. Si aparece en otro proyecto, aplicar el mismo patrón.

## UI / UX

### 2026-04-19 — Home reescrita como thread narrativo
Retirados los bloques que generaban confusión: navegador territorial (isla/municipio/barrio, que ahora vive implícito en /polis), showcase de los tres ejes de capital (prematuro sin contribuciones reales), y puertas tipo tarjeta. La home actual es un hilo narrativo en tres pasos — Ágora (donde se habla), Bibliotheka (donde queda registrado), Polis (donde se actúa sobre el territorio) — cada uno con lema corto y explicación real de lo que hace. Cierra con CTA a /nosotros.

### 2026-04-19 — Candado de privacidad en Ajustes (público/privado del perfil)
En el menú del engranaje (icono superior derecho) añadir un toggle con candado que vuelva el perfil público o privado. Cuando esté privado, mostrar un candado pequeño junto al avatar (tanto en el banner flotante como en la cabecera del perfil) y, en la versión real, ocultar el perfil en Ágora/Polis a quienes no sigas. Implementado ya como prototipo en `ocre-preview.html`; pendiente de cablear en `src/app/ajustes/page.tsx` y en la tabla `profiles` cuando conectemos Supabase (columna `is_public boolean default true`).

### 2026-04-19 — Atributos del cursus honorum: explorar tanto visuales como correspondencias profesionales reales
Propuesta implementada con 7 grados griegos + campo `correspondenciaProfesional`. Falta iterar visualmente: ¿conviene ilustraciones tipo grabado romano sobrio en lugar de símbolos tipográficos (○, ⬡, ◆…)? Probar un segundo set con siluetas de figuras clásicas (togada, laurel, escudo redondo). Posible track paralelo: `poietés` para artistas.

### 2026-04-19 — Banner flotante del avatar: minimización e invisibilidad
Implementado con dos niveles (minimizar → solo avatar; ocultar → desaparece). Falta: recuerdo de la preferencia en localStorage y reapertura desde el icono de perfil del header.

### 2026-04-19 — Suscripción email: persistencia entre rutas
Implementada con `localStorage` vía `useSyncExternalStore` para evitar setState-en-effect de React 19. Si el usuario descarta el banner, al pulsar el icono de correo del header se reabre; tras cerrar con la X vuelve a icono mínimo inferior-izquierda.

## Despliegue

### 2026-04-19 — Dominio: demosios.eu (δημόσιος = "público")
Comprado en DonDominio. Decisión: mantener el registro en DonDominio (precio EU, sin valor migrar), hospedar Next.js en Vercel (free tier suficiente), conectar ambos por DNS (no transfer). SSL lo emite Vercel solo. Runbook completo en [`docs/DEPLOY.md`](./DEPLOY.md). Metadatos y Open Graph de la app ya actualizados en `src/app/layout.tsx`.

### 2026-04-19 — Conectores MCP sugeridos: Supabase y Vercel
Ambos servicios tienen MCP oficial. Conectarlos desde Cowork significa que Claude puede listar proyectos, aplicar migraciones, consultar logs de despliegue y cambiar variables de entorno sin pedir tokens sueltos ni tocar el navegador. GitHub no tiene MCP oficial (sí GitLab / Codeberg); alternativa: `gh auth login` en el sandbox por sesión, o token PAT en `.env.local`.

### 2026-04-19 — Vercel "Install Coding Agent Plugin" — NO hace falta en Cowork
Vercel ofrece un plugin instalable para Claude Code (CLI), Cursor y Codex que les da acceso a su API. Aquí usamos Cowork y ya tenemos el MCP oficial de Vercel conectado, que cubre exactamente las mismas capacidades. Instalar el plugin duplicaría y ensuciaría el entorno local. Solo relevante si algún día se usa Claude Code directamente desde la terminal del Mac.

### 2026-04-19 — Auth y BBDD: Supabase nuevo proyecto para OCRE
Reutilizamos el patrón de KOINOS (`@supabase/ssr`), pero proyecto Supabase separado para no entremezclar datos con KOINOS mientras iteramos. Auth: magic link + Google OAuth como mínimo. Password clásico evitado. Apple OAuth cuando haya app móvil.

### 2026-04-19 — Escalado 0 → ~2.4M usuarios
Supabase Pro cubre hasta ~500k-1M MAUs cómodamente. Para 2.4M se queda en Supabase Team o se migra gradualmente a Postgres autogestionado (Neon / RDS) con réplicas de lectura, Redis delante para sesiones, Cloudflare como CDN. No optimizar antes de tener 10× la demanda actual — la arquitectura se valida con datos reales.

### 2026-04-19 — Tabla de contribuciones única con enum
Diseño sugerido: `contribuciones(id, user_id, tipo enum, seccion_pharos text null, target_id uuid null, creada timestamptz)`. Un solo insert por cualquier acción cívica (video, hilo, respuesta, PEC, pin, espacio recuperado). El agregado de capital se computa con una sola query por usuario, y así podemos re-ejecutar la función `puntosPorContribucion` cuando iteremos sus pesos sin migrar datos.

## Articulación con KOINOS

### 2026-04-19 — Compartir perfil y capital con KOINOS
Prevista la tabla `profiles` replicada. Decisión pendiente: ¿perfil único cross-producto (una sola tabla para KOINOS + OCRE) o perfiles espejo con sync? Favorece lo primero si queremos una sola identidad cívica.

### 2026-04-19 — Digitalizador urbano pixel art → Polis OCRE
El pipeline ya documentado en `KOINOS/POLIS_digitalizador_urbano.md` debe alimentar el mapa de Polis. Material base en `KOINOS/estilos/*.json`.

## Territorio

### 2026-04-19 — Rutas dinámicas por territorio
Pendiente: `/isla/[islaId]`, `/isla/[islaId]/[municipioId]`, `/isla/[islaId]/[municipioId]/[barrioId]`. Cuando exista, convertir los botones del `NavegadorTerritorio` en `<Link>`.

### 2026-04-19 — Barrios reales
Hoy solo hay barrios mapeados para las capitales insulares y algunos municipios grandes. Fuente real: secciones censales del INE + OSM. Cuando conectemos, generar seed SQL.

## Gamificación / Cursus

### 2026-04-19 — Producción de vídeo del cursus: iPad + Procreate Dreams
Tres rutas ordenadas de menor a mayor coste por pieza: (1) kinetic typography + grabado fijo en PNG exportado desde Procreate y compuesto en Dreams con keyframes de posición/opacidad; (2) motion comic con capas separadas (cabeza/cuerpo/fondo) performadas con el dedo en Dreams; (3) cutout articulado con rig. Decisión: arrancar por (1), fija la gramática visual que heredan las otras dos. Antes de tocar Procreate: fijar encuadre único (1080x1920 o 1920x1080, no mezclar), paleta cerrada a los 7 colores del cursus + blanco/negro (cada vídeo vive en el color del grado o eje que explica), y bumper reutilizable de 3 s (logo OCRE → griego → latino → castellano). Pipeline: `docs/guiones/NN-titulo.md` → storyboard → PNGs en `public/cursus/NN/` → Dreams → MP4 → contribución `video` del eje `paideía`.

### 2026-04-19 — Pivote editorial: primero la serie "Circunstancia canaria", luego el cursus
Decisión del usuario: arrancar la producción de vídeo con una serie previa al cursus que explique el porqué del proyecto. Tono Ortega ("yo soy yo y mi circunstancia"), marco civico-territorial. Arco propuesto de 5-6 episodios: (00) Canarias, circunstancia — marco general; (01) La tierra que fue común — heredamientos, suelo comunal, dehesas; (02) Cómo se privatizó el archipiélago — turismo, vivienda vacacional, grandes patrimonios, costa; (03) Qué sigue siendo común — inventario de comunes vivos; (04) Organizarse: por qué ahora — precariedad, éxodo, resistencias; (05) OCRE: para qué existe — puente al mecanismo (cursus, Polis, Ágora, Bibliotheka) como respuesta a los cuatro anteriores. Se mantiene ruta 1 de producción (kinetic typography + grabado fijo) y el pipeline, solo cambian los assets: `public/series/circunstancia/mapa-canarias.svg`, grabados de oficios canarios (gofio, salinas, aljibes, molinos), y fotografía doc ilustrada. Fuentes de datos a tener abiertas desde el guion 00: ISTAC, INE, datos.canarias.es, Ministerio de Vivienda, reportes de impacto turístico. Pendiente: redactar guion del ep 00 en `docs/guiones/00-circunstancia-canaria.md`.

### 2026-04-19 — El grabado romano sobrio puede debutar en vídeo antes que en UI
La exploración pendiente de sustituir los símbolos tipográficos del cursus (○⬡◆✦❖✶♁) por ilustraciones de grabado romano puede probarse primero en el formato vídeo (ruta 1 de la producción). Ahí el coste es bajo y, si funciona, migra a la UI con aval visual real.

### 2026-04-19 — Track `poietés` nace del propio trabajo de animación
Si el admin/autor anima el cursus en Procreate Dreams, se convierte en el primer `poietés` del sistema. El track paralelo artístico (mencionado como variante futura en `CURSUS_HONORUM.md`) puede arrancar con este caso de uso concreto: animar vídeos del cursus entrena el hueco del grado.

### 2026-04-21 — Menú de automatización producción de vídeo (voz usuario + Claude aliado)
Nueve rutas ordenadas de más simple a más ambiciosa: (1) voz en bruto → transcripción → guion estructurado con storyboard; (2) guion → timeline técnica con timecodes calculando 150-180 palabras/min; (3) guion → prompt pack para ilustraciones con estilo anclado (grabado romano, paleta OCRE) usable en Midjourney/FLUX; (4) datos → visualizaciones auto en SVG con d3 (ISTAC, INE, datos.canarias.es); (5) voz clonada con ElevenLabs desde muestra de 3 min (~5-22€/mes); (6) transcripción del MP4 final → SRT/VTT para accesibilidad + corte vertical 60 s para redes; (7) biblioteca viva de assets en `public/series/` mantenida por Claude; (8) bucle de auditoría post-publicación (qué beat rindió, qué cifra se entendió); (9) DSL markdown guion→Dreams timeline-skeleton (solo vale si >20 eps/año). Combinación mínima recomendada para arrancar: 1 + 2 + 4.

### 2026-04-21 — Matiz al ranking de coste de producción
Corrección al ranking previo (kinetic typography < motion comic < cutout articulado): contadores de cifras son casi gratis (dos keyframes, Dreams interpola); el ranking depende de cuándo mides — para el primer vídeo tipografía kinética es más barata, pero para una serie entera un personaje riggeado amortiza y puede salir más barato del segundo vídeo en adelante. Con el pivote a stick figure hecho a mano (entrada siguiente), este debate se disuelve: el stick figure combina coste bajo por pieza con amortización de personaje consistente, y además enseña los principios de animación mientras se produce.

### 2026-04-21 — Pivote técnico: stick figure como narrador de la serie
Decisión del usuario tras confrontar la curva de aprendizaje de animación: arrancar con stick figure + contenido escrito a mano, en lugar de ilustración compleja o personaje con rig. Razones: (a) sidesteps uncanny valley, que era la preocupación real con cualquier aproximación a reconocimiento facial; (b) el stick figure es precisamente cómo los animadores bloquean el movimiento antes de dibujar cualquier cosa encima — aprender a animarlo ES aprender animación; (c) tradición política-popular (xkcd, RSA Animate, pizarra con voz en off, Alan Becker, pizarrones de Errejón); (d) evita exponerse en cámara sin perder voz; (e) el trazo hecho a mano lee como coherencia con un proyecto sobre lo común. Currículo de entrada en 5 principios en este orden: squash and stretch (pelota bota) → arcs (todo movimiento natural es curvo, nunca recto) → anticipation (windup antes de la acción grande) → slow in / slow out (easing, Dreams lo trae incorporado) → timing / spacing (dibujos separados = rápido, juntos = lento). Recurso: serie "12 Principles of Animation" de Alan Becker en YouTube, explicada literalmente con un stick figure. Los otros 7 principios se aprenden por accidente una vez interiorizados estos 5. Sobre reconocimiento facial: descartado por uncanny valley — solo caben (a) totalmente simbólico o (b) hiperestilizado; nunca mitad-y-mitad.

### 2026-04-21 — Narrador-stick-figure que crece en el cursus a lo largo de la serie (propuesta, pendiente aceptación)
El monigote narrador de la serie "Circunstancia canaria" podría encarnar el cursus honorum: empieza el ep 00 como polítes (stick simple), gana atributo al avanzar los episodios — jarra en oikonómos cuando explique heredamientos, símbolo técnico en ergátes cuando cite datos, togada mínima en bouleutés al convocar organización, laurel en strategós para el ep 05 (puente a OCRE). Sube un grado por episodio. Beneficio narrativo: el cursus deja de ser abstracto — el espectador ha visto la escalera subiendo durante 5 episodios antes de que OCRE la explique. Cada cambio de grado es micro-ritual: cambia atributo, color del lema, punto cívico. Nombre propuesto para el narrador: Demos, alineado con `demosios.eu` y con la doble lectura "Demos iOS". Pendiente: decidir si aceptar esta integración narrativa o dejar que el narrador sea neutro a lo largo de la serie.

### 2026-04-19 — Insignias laterales no lineales
Idea: "custodio/a del agua", "guardián/ana de la biblioteca del barrio", etc. Insignias que cruzan el cursus y aportan reconocimiento lateral sin escalar niveles.

### 2026-04-19 — Red profesional a partir del cursus
Cuando haya varios oikonómoi y ergátai por barrio, ofrecer "sugeridos cercanos con PECs relevantes" como motor de enlace profesional dentro del común.

## Taxonomía

### 2026-04-19 — Códigos cortos de los ejes: KOI · PAI · POL
Notas previas sobre abreviaturas de los indicadores (en sesiones anteriores o NotebookLM) no se encontraron en disco. Decisión: tres letras en alfabeto latino por cada eje — `KOI` (Koinonía), `PAI` (Paideía), `POL` (Politeía). Campo `codigo` añadido al tipo `Eje` en `src/lib/capital/ejes.ts`. Uso previsto: columnas SQL (`cap_koi`, `cap_pai`, `cap_pol` si alguna vez materializamos totales), parámetros de URL (`?eje=KOI`), badges compactos. Si aparecieran las notas originales y divergieran, renombrar es `sed` + una migración SQL.

### 2026-04-19 — Códigos cortos de las 8 secciones PHAROS (pendiente)
Para simetría con los ejes, conviene un código corto por sección PHAROS: propuesta `SAL / CLI / COM / MIG / DEF / MED / IND / TRA`. Todavía sin aplicar al código. Cuando las contribuciones empiecen a cargar la columna `seccion_pharos` con su id-slug actual (`salud-servicios-sociales`, etc.) podemos mantener ese slug y usar los códigos solo para UI.

## Auth

### 2026-04-19 — Tres vías de entrada: magic link · password · Google
Magic link sigue siendo la puerta por defecto (menos fricción, más segura que password débil). Password clásico añadido en `/login` como tab alternativa y en `/registro` como flujo formal de alta. Google OAuth habilitado como atajo. Implementación en `src/app/login/LoginForm.tsx` y `src/app/registro/RegistroForm.tsx`.

### 2026-04-19 — Registro mínimo: email + password + handle (sin domicilio)
Decisión del usuario: pedir domicilio es más sensible que un email, y OCRE es una plataforma cívica, no un censo. El registro formal pide solo correo, contraseña de 8+ caracteres y un handle (minúsculas/números/guión bajo, 3-30). El barrio se setea opcionalmente después desde `/ajustes`. El trigger `handle_new_user` de Supabase lee `raw_user_meta_data->>'handle'` y crea la fila en `profiles` automáticamente.

### 2026-04-19 — Gating: botones visibles pero inertes con microcopy "Entra para..."
Patrón implementado en `src/components/CTAProtegido.tsx`. Un botón que requiere sesión: con usuario activo se comporta normal, sin usuario queda visible con etiqueta alternativa y al clicar muestra un tooltip que enlaza a `/login` y `/registro`. Aplicado ya en: "Subir video" (Bibliotheka) y "Proponer un barrio" (Navegador territorial). Cuando se añadan más acciones (crear hilo en Ágora, marcar pin en Polis, PEC) se usa el mismo componente.

### 2026-04-19 — Banner flotante del avatar: solo con sesión activa
Antes se pintaba siempre con `PERFIL_DEMO`. Ahora el banner solo se monta cuando `useSession()` devuelve un usuario. Pendiente: sustituir `PERFIL_DEMO` por una lectura real desde `profiles` + `contribuciones` del usuario actual cuando cableemos el cálculo de capital en servidor.

### 2026-04-19 — Banner del avatar retirado de momento (demasiado pronto)
Decisión del usuario: mostrar nivel + clase + puntos es prematuro con cero contribuciones reales. Se retira el banner flotante completamente (incluso para usuarios autenticados) hasta que el cálculo de capital se alimente de contribuciones reales. El componente `BannerAvatar.tsx` se mantiene en el repo para reactivación inmediata cuando llegue el momento.

### 2026-04-19 — Boletín solo para usuarios registrados
El banner de suscripción y el icono de correo del header solo aparecen cuando hay sesión activa. Razón: los anónimos no están aún en el perímetro de la comunidad; pedirles email para newsletter antes de que hayan explorado la plataforma es invasivo. El boletín se concibe como comunicación interna a quien ya forma parte del común.

## Mapa / Tablero

### 2026-04-19 — Tablero hexagonal de barrios — MVP con LPGC
Primer tablero interactivo en `/polis`: 10 barrios de Las Palmas de Gran Canaria como hexágonos flat-top en un SVG de 500×560. Cada barrio tiene `composicionCapital` mock (% por tipo de bloque) y se colorea por el tipo dominante. Click → modal `BarrioModal` con composición completa + 3 CTAs protegidos (abrir hilo, publicar recurso, marcar bloque). Barrios candidatos a recuperación (>30 % rentista+corporativo) llevan borde punteado y una marca roja.

Pendiente: (1) extender a las otras capitales insulares cuando tengamos la data, (2) sustituir la cuadrícula hex por geometría real de bloques (pipeline Blender GIS + catastro + OSM descrito en `KOINOS/POLIS_digitalizador_urbano.md`), (3) permitir cambiar de isla/municipio desde selector dentro de `/polis`, (4) capa de landmarks superpuesta.

### 2026-04-19 — Datos mock de composición de capital por barrio
Valores provisionales con lógica editorial (La Isleta mayoritariamente residente, Vegueta alta proporción de común por su patrimonio cultural, Jinámar con 35% corporativo como candidato natural). Sirven para validar UX hasta que haya datos reales. Fuentes reales previstas: Catastro INSPIRE para titularidad registrada, CNMV para identificar SOCIMIs, reportes del Ministerio de Vivienda para grandes tenedores.

### 2026-04-19 — Vectores reales de barrios (chat paralelo "CAMBIAR EL MAPA POLIS")
Decisión del usuario: los hexágonos son MVP; el objetivo es usar contornos reales de barrios para que el ciudadano se reconozca en SU barrio y no en un símbolo. Infraestructura ya preparada:

- El tipo `GeometriaBarrio` en `src/lib/territorio/barrios-juego.ts` acepta dos modos mutuamente excluyentes: `{ modo: "hex", cx, cy }` (actual) o `{ modo: "vector", d, cx, cy }` donde `d` es un path SVG ya proyectado al viewBox 500×560.
- `MapaBarrios` renderiza polígono real cuando `modo === "vector"` y hexágono cuando `modo === "hex"`. Mismo click/hover/modal para ambos.
- Nuevo helper en `src/lib/territorio/geo.ts`: `ajustarProyeccion`, `featureToPath`, `centroideAprox`. Permite convertir un FeatureCollection GeoJSON (WGS84) a paths SVG en coordenadas del viewBox. Proyección equirectangular, con padding, respeta proporciones.

Flujo esperado para integrar los vectores cuando lleguen:
1. Reunir los 10 polígonos de barrios LPGC en un FeatureCollection GeoJSON (un archivo `.geojson`).
2. Colocar el archivo en `src/lib/territorio/data/lpgc.geojson` (no existe aún la carpeta).
3. Ejecutar el helper una vez en build-time o a mano (un pequeño script) para generar los `d` y centroides, y pegarlos en `BARRIOS_LPGC` (o cargar dinámicamente).
4. Cambiar `modo: "hex"` por `modo: "vector"` en cada entrada.

Fuentes viables para los polígonos: OSM Overpass (gratis, a veces barrios oficiales faltan), INE secciones censales (agregables a barrios si hay cruce oficial), Ayuntamiento de LPGC open data (geoportal), o dibujo manual en Figma/Inkscape exportando SVG.

### 2026-04-19 — Cuarto eje opcional `oikonomia`
Se decidió reducir a 3 ejes (koinonía/paideía/politeía). Si en iteraciones posteriores aparece una economía local productiva en OCRE, la interfaz `PesoPorEje` admite ampliarla sin romper contribuciones existentes.
