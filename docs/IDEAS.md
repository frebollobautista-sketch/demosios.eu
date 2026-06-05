# IDEAS — captura del flow del chat

Todo lo que se dice en el chat y no se acaba operando en el mismo turno vive aquí. Formato mínimo:

```
### Fecha — título corto
Contexto de una línea. Decisión pendiente o siguiente paso.
```

**Nota:** para la vista accionable y priorizada de estas ideas, ver [`ROADMAP.md`](./ROADMAP.md). Este fichero es el log cronológico sin filtrar.

---

## Arquitectura del proyecto

### 2026-05-24 — Tesis de participación: lo rompedor es epistémico, embudo de tres niveles y separación derecho/retención

Conversación estratégica sobre cómo POLIS/OCRE rompe la desafección democrática y qué ofrecer a la ciudadanía de base. No se ha tocado código; queda como marco para decisiones de producto y onboarding.

**(1) Corrección al baseline "hay que ser muy rompedor".** Lo disruptivo NO es la intensidad política —la persona desafecta huye del conflicto y del "posiciónate"; presentar la plataforma como militancia digital repele al público objetivo y deja solo a los ya convencidos—. Lo rompedor es **epistémico**: hacer visible lo invisible (quién controla cada manzana, los trade-offs reales). El mensaje no es "ven a luchar" sino "ven a *ver*". Esto ya está en la tesis de POLIS (commons vs. acumulación) y en "jugar ES opinar con información".

**(2) Reclamar espacio digital = especificidad hiperlocal.** No se compite con la economía de la atención en su terreno. La palanca es que la persona vea *su* calle/edificio/bar. El territorio es contenido infinito, renovable y no copiable barato.

**(3) Embudo de tres niveles, no conversión total.** No hace falta que todos participen (esa expectativa mata el civic tech). Diseñar para: *espectador* (solo mira su barrio; ~90%; ya genera conciencia → de aquí sale la masa/visibilidad), *participante ligero* (un voto, un vídeo) y *núcleo* (cursus honorum → de aquí sale la fuerza). Puertas distintas para públicos distintos.

**(4) La movilización difusa se vuelve citable.** POLIS como cara no partidista y verificable de la movilización actual: un dato sobre un mapa lo cita un medio, una pancarta no. Resuelve el problema de credibilidad ante el neutral y el periodista.

**(5) El consenso agregado necesita salida al mundo real.** Las decisiones agregadas de N jugadores deben convertirse en un objeto que existe (documento, cifra prensable, entrega al ayuntamiento). Sin esa puerta, es un juego sin consecuencia y se nota.

**(6) Separar capa de legitimidad y capa de retención.** Nadie se queda por "el ejercicio de su derecho" — el derecho legitima pero no retiene. Confundirlas produce algo moralmente impecable y vacío. Lo que retiene a la ciudadanía de base: **reconocimiento** (cursus honorum como motor, no decoración), **consecuencia legible** (pantalla "tu decisión vs. ayuntamiento vs. media"), **identidad territorial** ("mi barrio" = bucle de retención que se actualiza solo) y **coste de entrada de 30 segundos** (primera acción = un voto sobre el uso de una calle, sin conocimiento previo ni posicionamiento; encaja con la primera misión ya decidida: Espacio público en Las Canteras). Síntesis: el derecho legitima, el juego retiene, el territorio engancha, el reconocimiento fideliza.

### 2026-05-11 — Regla de membresía, flujo asimétrico hacia administraciones, línea editorial cartográfica y arquitectura anti-filtración

Conversación estratégica que cierra tres decisiones estructurales y abre una cuarta. Antes de tocar código conviene fijarlas porque condicionan el modelo de datos, el verificador de cuentas, el API público y la propia tesis política de la plataforma.

**(1) Regla de membresía: solo demos, nunca kratos.**

En Demos iOS / OCRE se admiten como cuentas registradas únicamente:

- **Personas individuales** (la base, voto y voz horizontales).
- **Tercer sector** (asociaciones vecinales, AMPAs, sindicatos, cooperativas, ONGs, fundaciones).
- **Pymes** locales.

Quedan explícitamente **excluidos como miembros**: gobierno (estatal, autonómico, cabildos, ayuntamientos), partidos políticos, grandes corporaciones, fondos de inversión, SOCIMIs, grandes tenedores. Pueden leer lo público — no pueden registrarse, no pueden votar, no pueden moderar, no pueden contar como "voz" en ningún agregado.

La lectura clásica: el demos se reúne en la plaza; el kratos responde a lo que la plaza produce, no participa en producirlo. Es lo que distingue una *res publica viva* de un Decidim donde la administración modera y la legitimidad se diluye.

**Implicaciones operativas inmediatas:**

- Tabla `profiles` necesita un campo `tipo_cuenta` enum (`individuo` | `tercer_sector` | `pyme`) con verificación dura en el alta institucional (NIF, registro de asociaciones, registro mercantil para pymes).
- Manifiesto cívico corto que cada cuenta institucional suscribe al registrarse: no concentración de capital, no extracción del territorio, deliberación honesta. Revocación si se documenta incumplimiento. No es filtro ideológico, es condición de pertenencia a la plaza.
- Una pyme inmobiliaria-rentista es técnicamente pyme pero su lógica no es la de la base. El manifiesto y la revocación son la forma de filtrar sin tener que escribir reglas de exclusión por sector.
- El gobierno nunca entra por la puerta trasera: cuidado con cuentas de "investigadores municipales", "asociaciones pantalla", "fundaciones del cabildo". El verificador debe revisar relaciones de propiedad y financiación cuando hay duda.

**(2) Flujo asimétrico de información hacia la administración.**

El gobierno pasa de **interlocutor** a **lector**. El reporte de desperfectos del que hablamos en la sesión anterior **deja de ser un ticket** que el ciudadano envía al ayuntamiento (con su firma, su identidad, su responsabilidad) y pasa a ser una **publicación cívica** al mapa común. El ayuntamiento decide si se entera, si scrapea, si se suscribe al API.

Arquitectura en tres capas con permisos diferenciados:

- **Capa 1 — Deliberativa interna.** Solo cuentas verificadas (individuo / tercer sector / pyme). El gobierno no tiene lectura privilegiada. Aquí viven debates, propuestas, votos, conversaciones íntimas en TOUCH. Máxima protección (ver punto 4).
- **Capa 2 — Publicaciones públicas.** Mapa POLIS, ensayos Bibliotheka, FEED público, hilos cerrados con resolución. Cualquiera puede leer, incluido el gobierno.
- **Capa 3 — API de agregados para administraciones y terceros.** Endpoint público con datos agregados (nunca identidades, nunca parcelas singulares). El ayuntamiento se suscribe vía webhook al feed de desperfectos por municipio. La administración consume estructurado lo que ya es público — no negocia con la plataforma para tener acceso preferente.

El loop se invierte: ya no es "ciudadano → ayuntamiento → ciudadano" sino "ciudadano → mapa común ← ayuntamiento". La administración pasa a ser una más de las que consultan, y se la mide por cómo responde, no por si concede. El estado de los desperfectos ("abierto / en gestión / resuelto / sin atender N días") queda visible para todos: el mapa es **scorecard público** de la administración.

**Implicaciones inmediatas:**

- Tabla `anotacion_territorial` unificada con campo `competencia_administrativa` opcional. Cuando está rellenado, la anotación entra automáticamente en el feed público que las administraciones pueden consumir.
- API REST público bajo `/api/v1/...` con endpoints agregados por municipio / sección / categoría. Sin autenticación obligatoria. Documentado.
- Webhook opcional para administraciones que quieran push (no pull). Esto sí pide registro técnico, pero no convierte a la administración en cuenta del demos: es relación de cliente API, no de miembro.

**(3) Línea editorial cartográfica: bloque sí, parcela no.**

POLIS expone la desigualdad estructural — concentración rentista, densidad de vacacional, propiedad corporativa por sección — porque es información que el ciudadano necesita para opinar con criterio y que el gobierno debería producir y no produce.

POLIS **no** expone inteligencia operativa accionable contra propiedades o personas concretas. La regla operativa, escrita y codificada en el data layer:

- **Resolución máxima de propiedad: sección censal o bloque.** Nunca parcela singular en vista pública.
- **Nombres de grandes tenedores (Blackstone, SOCIMIs específicas, fondos) aparecen como categoría agregada** ("X% de esta sección bajo titularidad de Y"), nunca asociados a una parcela concreta visible en mapa.
- **El API de agregados sirve datos a partir de N propietarios distintos por celda** (N ≥ 5 o similar, decisión técnica pendiente) — k-anonymity básico para evitar reidentificación.
- **No hay descarga de raw data con propietario a nivel parcelario.** Lo que el Catastro ofrece bajo pago identificado, POLIS no replica.

La razón política, no solo legal: la energía política que hoy se canaliza en pintadas, cerrojos rotos, ocupaciones y otras acciones directas existe porque el conflicto no tiene cuerpo deliberativo. POLIS, si funciona, le ofrece a esa misma energía un cuerpo no-violento donde mapear, deliberar y presionar institucionalmente. Pero solo lo hace si se distancia con claridad de la acción directa contra propiedades o personas singulares — si no, queda como teatro o como inteligencia operativa, y en cualquiera de los dos casos pierde su carácter de contrapoder en sentido fuerte (Negri / Hardt: contrapoder es visibilidad, deliberación y presión electoral-judicial, no destrucción de propiedad).

Conviene una **declaración de principios cartográficos** escrita y visible — algo corto, una página — donde se diga: exponer desigualdad estructural sí; identificar parcelas singulares o personas no; deliberar la injusticia sí; armar la acción directa no. No por miedo a los arts. 510 y 573 CP (que también están), sino por coherencia política del proyecto.

**(4) Arquitectura anti-filtración del espacio deliberativo interno.**

La pregunta "¿podemos impedir capturas de pantalla?" tiene respuesta franca: **en web, no**. CSS, deshabilitar clic derecho, eventos de focus — todo bypasseable en segundos, y un teléfono apuntando a la pantalla anula cualquier defensa por sofisticada que sea. En apps nativas iOS/Android **sí** se puede pedir al sistema operativo que oculte el contenido (`FLAG_SECURE` en Android, `UIScreen.isCaptured` en iOS — lo que hace Signal), pero la cámara externa sigue ganando.

La pregunta productiva no es "cómo impedir capturas" sino **"cómo reducir el valor estratégico de una captura aunque ocurra"**. Ahí sí hay arquitectura útil, y se asume para la Capa 1 (deliberativa interna):

- **Marca de agua personal invisible en cada vista renderizada.** El handle (o un hash del user_id) embebido en píxeles que sobreviven al screenshot pero no son visibles a ojo. Si una captura aparece filtrada, se identifica al filtrador. Apple lo usa para docs internos; funciona como disuasor real.
- **Efímero por defecto en la capa íntima.** El contenido del espacio deliberativo más sensible (TOUCH, conversaciones de borrador previas a publicar en Ágora) tiene caducidad. Una captura sigue valiendo pero pierde contexto (respuestas, votos, hilo alrededor) — queda como prueba huérfana, no como historia consultable. La decisión 2026-05-02 de TOUCH como invite-only con 3 círculos es coherente con esto.
- **Modo off-record para conversaciones sensibles.** Nada persistido en servidor. Se documenta la decisión final, no la transcripción.
- **Pseudonimato por defecto, nombre real opt-in.** Si lo que se filtra es un handle, no una persona, el daño se contiene. Coherente con el cursus honorum como identidad cívica (el grado y el handle, no el DNI).
- **Agregación obligatoria en POLIS.** Lo del punto 3: si la captura no contiene parcelas singulares ni propietarios identificados, no es armable como inteligencia.
- **Sin DMs ni grupos cerrados (por ahora).** La decisión 2026-05-02 de postergar TÚ y VOSOTROS protege también de este flanco: lo que no existe no se filtra.

App nativa con `FLAG_SECURE` / `UIScreen.isCaptured` es complemento para los casuales, no defensa contra los determinados. Vale la pena cuando exista versión móvil, pero no se prioriza ahora.

**Decisiones técnicas pendientes derivadas de esta entrada:**

1. **Esquema de `tipo_cuenta` en `profiles`** y proceso de verificación institucional (KYC ligero para tercer sector + pyme).
2. **Manifiesto cívico** redactado en una página, mostrado en alta institucional, vinculado a la cuenta con timestamp de aceptación.
3. **Diseño del API `/api/v1/agregados/`** — endpoints, granularidad, k-anonymity threshold N, webhooks opcionales.
4. **Implementación de watermarking invisible** en server-side rendering de la Capa 1 — librería a evaluar (steganography en canvas o en SVG según superficie).
5. **Declaración de principios cartográficos** redactada y visible en `/principios` o equivalente, enlazada desde POLIS.
6. **Modelo `anotacion_territorial`** con campos `competencia_administrativa`, `estado` (abierto / gestión / resuelto / sin_atender), `feed_publico` boolean.
7. **Política de revocación de cuenta institucional** documentada (criterios, procedimiento, derecho a defensa, registro público de revocaciones para auditabilidad).

Tres invariantes que tienen que sostenerse juntos para que el balance funcione: la administración no participa, la cartografía respeta la resolución máxima (bloque sí, parcela no), y el espacio deliberativo interno protege a quien delibera (watermark, efímero, pseudónimo, off-record). Si los tres están escritos, codificados y defendibles, el gobierno se beneficia de la información sin tener acceso preferente, y el ciudadano no se compromete porque no firma nada, no denuncia a nadie y no aparece en registro vinculable.

### 2026-05-10 — Capa de convergencia ciudadano↔administración sobre POLIS (anterior a la decisión de membresía)

Sesión previa donde se identificó la pauta de qué información cívica puede compartirse con administraciones con feedback loop corto. Núcleo: hecho localizable + ventaja informativa del vecino + competencia administrativa clara + bajo coste político + loop verificable. Candidatos por capa OSM:

- **Roads** (96.439 features): alumbrado fundido, baches, señalización, pasos de cebra, sumideros, ramas obstruyendo.
- **Parks** (12.881 features): mobiliario roto, salud arbórea, parques infantiles, vertidos, microbasura.
- **Water** (22.140 features): obstrucciones en barrancos, vertidos tras lluvia, accesos costeros cortados, fuentes públicas averiadas. Convergencia muy alta y subexplorada (Consejo Insular de Aguas + Costas + ayuntamiento).
- **POIs** (10.190 puntos): correcciones del mapa (negocios cerrados / nuevos / accesibilidad / horarios).
- **Edificios 3D** (128.215): patrimonio en mal estado, riesgo de derrumbe visible.

Zonas de fricción (NO converger directamente): vivienda vacía / vacacional ilegal (rompe equilibrio social, agregación obligatoria si acaso), ruido/olores/tráfico (politiza), mapeo de acumulación corporativa (núcleo de POLIS, tensa con administración por diseño).

**Prototipo recomendado:** desperfectos en el paseo de Las Canteras — zona con `canteras_enriched.json` ya cargado (1.665 edificios, 1.475 POIs), competencia municipal directa, alta intensidad de uso, respuesta administrativa visible. Segundo loop: estado de barrancos y accesos a costa (interlocutores: Consejo Insular de Aguas, Demarcación de Costas).

Esta entrada queda **revisada por la del 2026-05-11**: el reporte deja de ser ticket dirigido al ayuntamiento y pasa a ser publicación al mapa común que la administración consume vía API. Ver punto (2) de la entrada del 11 mayo.

### 2026-05-10 — Gestor de contenido: grid de 6, algoritmos suscribibles, gramática gestual de TOUCH

Propuesta del usuario para unificar la superficie principal de la app — lo que en la entrada del 2026-05-02 llamamos *"mi quiosco"*. La idea reúne tres movimientos que hasta ahora estaban dispersos en `FEED-FUNCIONALIDADES.md`, `TOUCH-FUNCIONALIDADES.md` y los notebooks:

1. **Grid finito de 6 elementos en lugar de scroll infinito.** El usuario ve seis publicaciones a la vez, en cuadrícula, ocupando una pantalla. Es la materialización visual del anti-patrón "🚫 scroll infinito" que ya estaba descartado tanto en FEED como en TOUCH; ahora se eleva a forma arquitectónica: una pantalla = seis ítems = una unidad de atención cerrada. Para ver más, el usuario hace un acto deliberado (refresh, cambio de algoritmo, gesto). No hay arrastre infinito.

2. **Suscripción a algoritmos en plural.** En vez de un único algoritmo opaco que decide qué ves, el usuario se suscribe a uno o varios algoritmos que aportan contenido al grid. Continuación del principio "filtro lo hace el usuario" del FEED (notebook 02, gap 4.7), pero generalizado: los algoritmos son **objetos de primera clase**, públicos, firmados por su autor, con manifest legible. El usuario no diseña *un* algoritmo: compone varios.

3. **Gramática gestual heredada de TOUCH.** Las interacciones que se diseñaron para TOUCH (caption oculta, gesto deliberado en vez de scroll pasivo) se aplican a TODA la superficie. Diferencias propias del gestor:
   - **Long-press → expansión casi a pantalla completa** para interactuar con la publicación (PEC, debate, contexto, autoría, fuente del algoritmo que la trajo). Patrón Peek-and-Pop / Quick Look pero aplicado al objeto cívico, no al sistema operativo.
   - **Gestos predefinidos → la información se mueve.** Repertorio aún por fijar: swipe horizontal entre algoritmos suscritos (cambiar la fuente del grid sin salir), swipe vertical para descartar/refrescar el slot, etc.

### Implicaciones de que el usuario cree sus propios algoritmos

El salto de "algoritmos suscribibles" (los crea otra gente) a "el usuario crea el suyo" abre un terreno espinoso que conviene mapear antes de tocar código:

**(a) Lenguaje de definición.** ¿Cómo describe el usuario su preferencia? Tres niveles, escalables: (i) sliders de peso por sección PHAROS — ya planteado en FEED notebook 4.7; (ii) selectores tipo Bluesky feed: incluir autores, etiquetas, territorio, tipo de contenido (debate / obra / post), exclusiones; (iii) reglas booleanas o lenguaje natural ("muéstrame lo que pasa en mi barrio + ensayos de salud + amigos íntimos"). Más potente, más opaco. Recomendación MVP: (i) + (ii).

**(b) El algoritmo es público y firmado.** Coherente con la transparencia radical del proyecto: cada algoritmo tiene autor visible, manifest legible y otros usuarios pueden suscribirse. Esto convierte al "diseñador de algoritmos" en una figura nueva del ecosistema cívico — lo que en griego sería un *kybernētēs* (piloto, gobernador; raíz de "cibernética"). Hay que decidir si esa figura entra en el cursus honorum o queda lateral como insignia.

**(c) Capital y reconocimiento.** Si alguien crea un algoritmo que muchos suscriben, ¿gana capital `paideía` (sabe enseñar a mirar) o `politeía` (organiza el espacio público)? Probablemente paideía. Conviene fijar cómo computa antes de que la gente empiece a "minar suscriptores".

**(d) Auditabilidad por publicación.** Cada ítem en el grid lleva visible POR QUÉ está ahí — qué algoritmo lo trajo, con qué peso. Es el "badge tu algoritmo" de FEED-FUNCIONALIDADES llevado a la unidad mínima. Sin esto, la transparencia es retórica.

**(e) Riesgo de filter bubble consciente.** Si el usuario diseña su propia burbuja, peor que TikTok (que al menos a veces te empuja a contenido nuevo). Mitigación propuesta: garantizar que **1 de los 6 slots SIEMPRE sea "fuera de tu algoritmo"** (asignado por una regla del sistema — territorio adyacente, sección PHAROS poco visitada, debate del día). Esa fricción es coherente con la decisión política del proyecto: la plaza no se elige a la carta.

**(f) Adversarial.** Algoritmos públicos son armas baratas: alguien crea uno que parece neutral pero amplifica una agenda. Mitigación: marcar algoritmos populares con el "mapa de su sesgo" (qué secciones, qué territorio, qué autores favorece), permitir disputas, etiquetar algoritmos institucionales vs. ciudadanos.

**(g) Componibilidad de varios algoritmos en 6 slots.** ¿Reparto proporcional, rotación, prioridad declarada, slots fijos por algoritmo? Decisión muy operativa, condiciona el resto.

**(h) Fricción cívica al crear.** Coherente con los "3 segundos de fricción cívica" de la entrada del 2026-05-02: crear un algoritmo debería pedir al autor declarar su sesgo intencionado en una línea ("este algoritmo prioriza voz vecinal sobre prensa institucional"). Es el manifest mínimo, parte pública del objeto.

**(i) Lock-in vs. exit.** El usuario debe poder bifurcar un algoritmo ajeno, modificarlo como suyo, exportarlo, borrarlo. Coherente con la postura del proyecto sobre patrimonio personal en TOUCH.

**(j) Separación grafo social vs. grafo algorítmico.** Suscribirse a un algoritmo NO debería contar como "follow" del autor. Son dos relaciones distintas que conviene no fusionar — evitamos la dinámica Twitter de concursar por seguidores.

### Pendiente de decidir antes de construir

1. **¿El gestor es la home unificada "mi quiosco" del 2026-05-02 o un módulo aparte?** Probablemente es su materialización concreta. Confirmar y unificar nombres.
2. **¿Aplica solo a Ágora (YO) o a toda la app (Ágora + Bibliotheka + Polis)?** Si es transversal, decidir cómo conviven en un mismo grid items de naturaleza distinta (post corto, ensayo largo, hilo de debate, ítem de mapa).
3. **Lenguaje de definición del algoritmo en el MVP**: arrancar con sliders PHAROS + selectores básicos.
4. **Reparto de los 6 slots** entre N algoritmos suscritos + el slot obligatorio "fuera de tu burbuja".
5. **Long-press**: ¿abre overlay (vuelvo al grid) o navega a vista detalle (avanzo)?
6. **Repertorio de gestos exacto**: swipe entre algoritmos, swipe descarta, swipe guarda en TOUCH, double-tap PEC. Prototipar antes de cablear.

### 2026-05-03 — Toggle público con tres nombres griegos: Ágora · Bibliotheka · Polis

Decisión del usuario tras ver el primer mock del Quiosco con cuatro pestañas pronominales: **la cara externa de la app usa los nombres griegos clásicos**, no los pronombres. La arquitectura interna sigue siendo YO/NOSOTROS/ELLO + Polis (ver entrada del 2026-05-02 más abajo), pero la nav inferior tiene **tres botones**: Ágora · Bibliotheka · Polis.

Reasignación funcional:

- **Ágora** = el **YO** (FEED público + TOUCH íntimo, integrados con sub-tabs internos).
  - Lectura: la Ágora griega era la plaza social cotidiana donde la gente coincidía a charlar y a contar. Encaja con la voz personal pública e íntima.
  - El módulo de debate (lo que en la sesión del 2 mayo se llamó "Ágora") **deja de llamarse así**.

- **Bibliotheka** = el **NOSOTROS** (debate Reddit-like) + el **ELLO** (obras publicadas), con sub-tabs internos `Debate` y `Obras`.
  - Lectura: la Bibliotheka clásica guardaba tanto los rollos de obra como los registros de las decisiones. Cuadra con "Reddit con base de datos" (lo que el usuario explicitó) ampliado a publicación de obra.
  - Se absorbe el ELLO sin perder su identidad: queda como sub-tab visible, con tarjetas de color púrpura distinguibles dentro del flujo.

- **Polis** = territorio + intercambio + registro (sin cambios respecto a la entrada del 2026-05-02).

**El ELLO desaparece como pestaña** independiente. **Los pronombres siguen siendo la arquitectura conceptual interna** — sirven para razonar sobre tipos de contenido, gramática del usuario, decisiones de UX y filiación de docs. Pero el usuario final ve tres pestañas griegas, no cuatro pronombres.

### Implicaciones inmediatas (acciones tomadas el 2026-05-03)

1. `docs/AGORA-FUNCIONALIDADES.md` — el contenido viejo (que describía el debate) **se ha movido a** `docs/BIBLIOTHEKA-DEBATE.md`. El doc original queda libre para describir la **nueva** Ágora (módulo del YO).
2. `docs/AGORA-DATA-MODEL.md` — convertido en redirect a `docs/BIBLIOTHEKA-DEBATE-DATA-MODEL.md`.
3. `supabase/migrations/20260502000000_agora.sql` — **se mantiene tal cual** con prefijo `agora_*` en tablas. Cuando renombremos rutas en código, podemos hacer una migración v3 que renombre las tablas a `biblio_debate_*`. Sin urgencia; coste técnico bajo.
4. Las rutas `/agora/...` del código actual describen el debate. **Quedan pendientes de mover** a `/bibliotheka/debate/...` cuando bajemos al código real. La pestaña `/agora` del nuevo Ágora arrancará desde cero.
5. `docs/CONCEPTO.md` y los notebooks 01_TOUCH, 02_FEED, 07_BIBLIOTHEKA quedan **pendientes de actualizar** con esta reasignación. Se actualizan en la siguiente tanda de docs.

### Tres pestañas, dos sub-tabs internos

Mock visual: `quiosco-mobile-mock` (artifact en Cowork). Estructura confirmada visualmente.

- Ágora abre con sub-tabs `Todo · Público (FEED) · Íntimo (TOUCH)`.
- Bibliotheka abre con sub-tabs `Todo · Debate · Obras`.
- Polis abre con su lógica propia (mapa + capas; aún por desarrollar).


### 2026-05-02 — Demos iOS organizado por pronombres: YO / NOSOTROS / ELLO + Polis

Decisión arquitectónica del usuario tras la reflexión sobre Reddit vs Twitter como modos sociales distintos. La plataforma se reorganiza con una columna vertebral gramatical clara: cada módulo encarna un pronombre del habla común. No es metáfora decorativa, es taxonomía operativa. Define UI, gramática del contenido, expectativas del usuario y arquitectura de notificaciones.

**El YO** — Twitter / Instagram. Posts personales, gente compartiendo pensamientos, fotografía cotidiana. Modo expresivo del individuo. Cubre dos capas existentes:

- **FEED** = el yo público (lo que dices a quien quiera leer).
- **TOUCH** = el yo íntimo (lo que enseñas solo a tu círculo).

Ambos comparten gramática (post corto + media + endorsement) pero divergen en alcance. Mismo pronombre, dos órbitas.

**El NOSOTROS** — Reddit con sentido de base de datos. Debate, deliberación, archivo temático. Modo asambleario. Una sola capa:

- **ÁGORA** = el nosotros que delibera (el debate común, los hilos PHAROS, las propuestas Decidim, los mapeos Polis-style).

Aquí pesa la sección PHAROS, el territorio, la categoría local. Aquí vive el cierre formal de hilos con resumen y la promoción a propuesta votable.

**El ELLO** — Substack. Herramienta libre para presentar y publicar. Modo obra. Una sola capa:

- **BIBLIOTHEKA** = el ello que se publica (cursus de vídeos, ensayos largos al estilo Grapheion, guías y plantillas del común que no son un debate sino una pieza acabada).

Aquí pesa la autoría, la duración del texto, la curaduría editorial. Es el espacio donde cada uno aporta lo que sabe hacer al patrimonio común. La voz queda fijada.

**POLIS — fuera de la trinidad pronominal, geográfico-pragmático**

Polis no es un pronombre. Es el lugar. Aquí conviven:

- El mapa cívico (digital twin canario, edificios 3D, capital por bloque) que ya está en marcha.
- El **intercambio práctico** anclado al territorio: coche compartido, busco/ofrezco, oficios cerca, mercadillo del sábado. Lo que antes era pieza de Koiná y ahora se desplaza a Polis porque es geográfico por naturaleza.
- El **registro territorial** (un edificio pasa a manos de un fondo, una plaza se peatonaliza, un comercio cierra) — anotaciones colectivas sobre el espacio.

τὰ Κοινά (Koiná) **se redefine**: se queda en Bibliotheka lo que es publicación de recursos del común (guías, plantillas, conocimiento legible y reusable). Se mueve a Polis lo que es servicio o intercambio anclado a un sitio.

### Implicaciones inmediatas

1. **Una pantalla de entrada unificada** ("mi quiosco" — propuesto en la reflexión del 2026-05-02 sobre Reddit/Twitter) mezcla los cuatro mundos con badges de pronombre, deja al usuario activar/desactivar capas. No es feed algorítmico — es navegación etiquetada.
2. **Cada acción de publicación empieza eligiendo el pronombre** (3 segundos de fricción cívica): "voy a decir algo mío" / "voy a abrir un debate común" / "voy a publicar una obra" / "voy a anotar el territorio". Esto evita que la voz personal contamine el debate temático y viceversa.
3. **Polis amplía su alcance** más allá del mapa: queda como módulo de **lugar + intercambio + registro**. Hay que actualizar `POLIS-STATE.md` y los notebooks/03_POLIS.md.
4. **Los notebooks de cada sección** quedan filiados: TOUCH y FEED al "yo", Ágora al "nosotros", Bibliotheka al "ello", Polis fuera del eje pronominal.
5. **TOUCH queda pendiente de revisar** dentro de la lente "yo íntimo" — la decisión 2026-04-20 (D3) de "TOUCH invite-only estricto con círculos de 3 niveles" sigue siendo coherente.

### Lo que esta arquitectura NO contempla todavía

- **El IMPERSONAL** (anuncios institucionales, decisiones aprobadas por proceso Decidim, actas): podría ser una capa lateral en Bibliotheka o un módulo "boletín oficial" propio. Sigue abierto.

### 2026-05-02 — Decisión política: el TÚ y el VOSOTROS quedan postpuestos

Decisión del usuario: la **otredad mediatizada** (mensajería privada uno-a-uno, grupos cerrados con membresía explícita) **no tiene cabida hasta que la base republicana esté asentada**. Es decir: hasta que el espacio público común — NOSOTROS (Ágora) + ELLO (Bibliotheka) + Polis (lugar/intercambio/registro) + YO en sus dos modos (FEED público y TOUCH íntimo) — funcione como **res publica viva**, no se construyen canales privados encima.

Razón política: una plataforma cívica que añade DMs y grupos cerrados antes de tener una asamblea sólida termina siendo un sustituto privado de WhatsApp con apariencia cívica, donde la conversación importante migra a chats invisibles y el espacio público se vacía. Es exactamente la dinámica que mata Decidim, Loomio y todas las plataformas participativas convencionales: la deliberación auténtica se hace fuera, en grupos privados, y la plataforma queda como teatro.

Demos iOS apuesta deliberadamente por el camino contrario: **primero la plaza, después los pasillos**. El TÚ y el VOSOTROS aparecerán cuando tenga sentido — cuando ya haya una vida común visible y el privado venga a complementarla, no a sustituirla. Si nunca tienen sentido, mejor.

Esta decisión queda como invariante hasta que el usuario la revise explícitamente. Cualquier propuesta futura de "añadir mensajes directos" debe argumentar por qué la base republicana ya está asentada.

---

## Ágora — foro híbrido

### 2026-05-02 — MVP de Ágora desplegado: foro + Decidim + Polis
Implementado el sistema completo de deliberación según `docs/AGORA-DATA-MODEL.md`. Tres modos coexisten en una misma estructura de hilo:

- **debate** (por defecto): comentarios anidados estilo Reddit, PEC al hilo y al comentario.
- **propuesta_decidim**: voto binario *a favor / en contra / abstención* sobre un texto concreto, con fecha de cierre y quórum opcional.
- **consenso_polis**: microfrases con voto ternario *de acuerdo / desacuerdo / pasar*.

Un hilo nace siempre como `debate` y su autor puede promoverlo a cualquiera de los otros dos modos sin destruir la conversación previa. Los comentarios del debate quedan visibles bajo el panel del modo nuevo.

Anclaje obligatorio a sección PHAROS, opcional a categoría local y a territorio (isla → municipio → barrio). La página de sección permite filtrar por las tres dimensiones y ordenar por última actividad / recientes / más respaldados.

Artefactos:
- `supabase/migrations/20260502000000_agora.sql` — 8 tablas + 5 enums + RLS + triggers de denormalización + rate limit (5 hilos/24h, 30 comentarios/hora).
- `src/lib/agora/{tipos,queries,acciones,territorio,tiempos}.ts` — API server-side completa.
- `src/app/agora/{page,nuevo,[seccion]/{page,[hiloId]/page}}.tsx` — rutas Next 16 con `params: Promise`.
- 7 componentes cliente: filtros, formulario, caja de comentar, árbol anidado, botón PEC, panel Decidim, panel Polis, promoción de modo.

**Pendiente para próximas sesiones:**
1. **Aplicar la migración SQL** al proyecto Supabase real (este chat solo escribió el archivo).
2. **Clustering Polis-style** sobre `agora_votos_propuesta`: vista materializada que identifique grupos de opinión y propuestas-puente (las que generan consenso entre clusters opuestos). Recalcular cada hora.
3. **Gating real por grado cursus** para promoción y fijación de hilos: hoy solo el autor puede promover. Incorporar `bouleutes` / `didaskalos` cuando exista cálculo de capital en server.
4. **Cierre automático de decisiones**: cron edge function que actualiza `resultado` cuando vence `fecha_cierre`, calcula aprobada/rechazada/sin_quorum/empate.
5. **Capital generado**: enganchar las inserciones de `agora_hilos` y `agora_comentarios` con la tabla `contribuciones` (decisión 2026-04-19 sobre tabla única) para que sumen capital al perfil del usuario según `pesoDeSeccion`.
6. **Notificaciones**: cuando alguien comenta tu hilo o vota tu propuesta, llegar al feed personal del usuario.
7. **Realtime opcional**: `supabase.channel('agora_hilo:<id>')` para que comentarios y votos se propaguen sin recargar.
8. **Moderación**: extender `reports` para cubrir `agora_hilos`/`agora_comentarios`/`agora_propuestas` (la tabla actual solo apunta a posts/comments del FEED).
9. **Búsqueda full-text** en hilos por sección — índice GIN sobre `titulo || cuerpo`.
10. **Anti-spam adicional**: detección de duplicados por hash de cuerpo, cooldown progresivo cuando salta el rate limit.

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

## Ágora — tablero de aficiones / feed

### 2026-05-29 — Tablero de aficiones y preferencias: diseño cerrado
Sesión dedicada a diseñar (no construir aún) el algoritmo de un "tablero de aficiones y preferencias" para Ágora. Vanilla ES modules, sin build, todo localStorage de momento.

**Hallazgo de partida:** hoy las aficiones NO son dimensiones del algoritmo — son una capa de *boost*. En `descubre.js`, los intereses de `PALETA_AMPLIA` solo (a) multiplican peso por match de keyword (`construirBoost`), (b) deciden qué subreddits se cargan, (c) aplican un `dimBias` pequeño. Los ítems (`feed.js:aplicarDims`) solo llevan 4 dims posturales (`cercania, conocidos, reaccionar, temporalidad`), ninguna temática. Por eso el interés no se ve en sliders, `explicar()` no lo nombra y `aprenderDeFeedback()` no lo aprende. Ya existía un proto-toggle: los presets `✦ Intereses` / `🏛 Cívico`.

**Re-encuadre:** promover las aficiones de "boost" a **dimensiones de primera clase**. En cuanto cada interés es una `dim` con su slider y los ítems se puntúan en dims temáticas, `rank()` (agnóstico de dims), `explicar()` y `aprenderDeFeedback()` funcionan gratis. Es "enchufarse al motor sin reescribirlo".

**Decisiones cerradas con el usuario:**
- **Opción A — dos tableros separados** (hobby/entretenimiento · cívico/sociopolítico), cada uno su set de dims, sus sliders y su clave de storage. (Se descartaron B unificado y C crossfader jerárquico).
- **Familia cívica derivada de `taxonomia.js`** (los 10 verbos) por mapeo fino, sin editar el fichero (sólo-lectura; otra sesión es dueña de él). Fuente de verdad única.
- **Solo Ágora en v1**; `biblioteca-app` reutilizará `shared/tablero.js` después.
- **Tablero = SOLO afinidad de tema** (sliders para gustos estables). Hobby: 10 intereses de `PALETA_AMPLIA` + mando **Descubrimiento** (seguro↔sorpresa, expone `serendipia`). Cívico: 10 verbos + Descubrimiento.
- **Posturales recortados** (los 4 `DIMS_AGORA` heredados convencían poco al usuario, "complicaban los filtros"). Lugar/tiempo/postura son propiedades *por-ítem*, no preferencias estables → **chips en la propia tarjeta** que al tocarlos pivotan (patrón 1, elegido sobre rails y maqueta). El pivot = **boost transitorio, visible y reversible, NO aprendido ni persistido** (lente de sesión, no algoritmo propio). La "Acción" (consumir↔convocar) se vuelve **botón *actuar* + chip de postura** en la tarjeta — gana, no se pierde. Única excepción de control persistente: **chip de alcance geográfico** (barrio/isla) fijo arriba. `cercania`/`ts` quedan como sesgo de orden interno en `rank()`, ya no user-facing.
- **Entrega dual con cambio en vivo:** *toggle* (un tablero activo a la vez) ⇄ *feed único intercalado* (ratio ajustable + cuota cívica ≥1 por ventana). El usuario alterna entre ambos modos cuando quiera.
- **Anti-dilución de lo sociopolítico (3 capas):** inyección cívica (`INJECT_CADA=6`) promovida de Descubre a invariante del feed; suelo de familia en modo único; enganche del "éxito" al `honestyMeter` de `loops.js` (celebrar fin real, nunca engagement por engagement).

**Distinción clave de la filosofía:** pulgares sobre el tema = aprendizaje persistido (tu algoritmo, dueño tú); pivots de chip = lente transitoria.

**Plan de implementación (validado, pendiente luz verde para codear):**
1. `shared/tablero.js` **nuevo** — define las dos familias como sets de dims, `dimsMeta` por familia, `clasificar(item)` (texto/kind/subreddit/overlay → dims temáticas, sustituye a `construirBoost` como señal de tema), `pivotBoost(item, pivots)` transitorio, `interleave(hobby, civico, ratio)` + cuota cívica, estado/persistencia `agora-tablero` con migración desde `agora-sliders` + `agora-descubre-config`.
2. `feed.js` — `aplicarDims` llama a `tablero.clasificar(item)`; `cercania`/`ts` pasan a sesgo de orden; cada ítem expone geo/ts/postura para los chips.
3. `sliders.js` → `mountTablero(container, familia, onChange)` (reusa persistencia/`setState` existentes).
4. `descubre.js` — presets = entrada Descubre de cada tablero; retira `construirBoost` como señal de tema; promueve inyección cívica.
5. `app.js` — familia activa, interruptor en vivo toggle⇄único, chips de pivot + chip de alcance, pasar dims/sliders correctos a `rank()`.
6. Anti-dilución + hook a `honestyMeter`.

Se reutilizan `rank.js`, `stumble.js`, `hud.js`, `gestos.js`, `loops.js`, `taxonomia.js` **sin editarlos**.

### 2026-05-29 — Ágora alineada al formato de POLIS: skin verde oscuro + touchbar mutada
Decisión del usuario: Ágora "forma parte de la misma app" que POLIS, así que adopta su formato (membrete serif, barras paper/ink, IBM Plex Mono para números/UID, idioma neobrutalista) pero con **skin verde oscuro** en vez del ocre/papel de POLIS — manteniendo el **acento cálido (oro PHAROS)** como POLIS. Paleta nueva en `agora-app/style.css` `:root` (bg `#0e1712`, surfaces verdes, text parchemino, `--ocre` oro intacto, `--font-serif`/`--font-mono`).

**Header portado de POLIS (no recoloreado):** Ágora adopta el shell real de POLIS — membrete **"OCRE ▾"** (icono pieza de ajedrez oro + serif) con su **dropdown de vistas** (POLIS→`../polis-app/`, ÁGORA activo, BIBLIOTHEKA→`../biblioteca-app/`) y los iconos ✦/⚙/Entrar a la derecha. **Se retiró `shared/navbar.js`** (la barra de 3 pestañas Mapa/Ágora/Biblioteca): la navegación entre caras vive ahora en el dropdown OCRE▾, como en el mapa. CSS portado a `agora-app/style.css` (.app-topbar, .app-topbar-brand, .app-topbar-menu/.atm-item) adaptado a verde.

**Touchbar mutada:** la tira de siluetas de islas de POLIS (`siluetas-strip`, salto de contexto territorial) muta en Ágora a la **tira selectora de feed** (salto de contexto algorítmico): `✦ Aficiones · 🏛 Cívico · ⇄ Mezcla`. Es donde se conmuta en vivo entre los dos tableros y el feed único intercalado — entrega el "cambio en vivo" del diseño en el mismo sitio donde POLIS pone las islas. Alternativas anotadas para más adelante: chips de intereses activos (silenciar/solo), zonas cívicas con actividad, sub-secciones.

**Ruteo de feeds por FUENTE** (no por tema): Aficiones = reddit/bsky (el ancho de la web), Cívico = overlays/quórums/sillas/eventos (vida local), Mezcla = interleave de ambos con cuota cívica. Coherente con los presets originales de Descubre. Las dims temáticas del tablero ordenan DENTRO de cada feed.

Bug colateral cazado y corregido: el comentario de documentación del timeline en `index.html` anidaba `<!-- opcional -->` dentro de otro comentario → el primer `-->` lo cerraba y renderizaba los botones de ejemplo + un `-->` suelto sobre el feed. Eliminado.

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

### 2026-05-24 — Motor de sinergias (Nobel Economía 2025: Mokyr / Aghion-Howitt)
Marco: Mokyr distingue conocimiento proposicional (saber qué/por qué — teóricos) y prescriptivo (saber cómo — ejecutores); la innovación se vuelve autosostenida cuando baja el coste de acceso al conocimiento y ambos mundos se encuentran. Aghion-Howitt: destrucción creativa, todo cambio tiene un coste que alguien paga. Dirección para OCRE: la red social cívica no es un feed sino una máquina de reducir el coste de acceso al conocimiento en un territorio. Principios: (1) perfil dual — cada vecino declara su *saber* y su *hacer/recursos*; partir el capital PHAROS en capital de saber y capital de ejecución. (2) Objeto central = encuentro/proyecto, no la publicación. (3) Emparejamiento por distancia cruzada — premiar conexiones socialmente lejanas pero geográficamente cercanas (capital social puente). (4) Cada match anclado a sección censal (POLIS). (5) Destrucción creativa visible (alineado con principio del juego POLIS). (6) Conocimiento contestable: el ejecutor reporta qué falló → actualiza el saber. Piezas ya alineadas: Bibliotheka (Cursus honorum=proposicional, Koiná=prescriptivo), Ágora (deliberación), Polis (ancla geográfica). Falta el motor de emparejamiento que las cose — nombre tentativo *Synousía* (συνουσία) — que proponga proyectos activamente. Métrica: tejido cívico = densidad de colaboraciones realizadas entre desconocidos, ponderada por distancia social. Siguiente paso: documento de diseño de producto (modelo de datos del perfil dual, lógica del motor de emparejamiento, integración con secciones censales).

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

### 2026-05-24 — Árbol de habilidades Mêtis (savant / fabricant) absorbe el cursus
Diseño completo en [`ARBOL-METIS.md`](./ARBOL-METIS.md), mockup interactivo en [`arbol-metis-mockup.html`](./arbol-metis-mockup.html). Sistema de gamificación de dos ramas: Epistḗmē (savant, saber por qué — alimentada por capital cultural/paideía + koinonía) y Téchnē (fabricant, saber cómo — capital político/politeía + koinonía), con un tronco Synousía cuyos nodos exigen un nodo encendido de cada rama del mismo tier (co-activable en pareja, reparte el coste). Decisiones tomadas con el usuario: (1) entregable = documento + mockup visual; (2) mecánica híbrida — capital acumulado como umbral que no se gasta + un recurso renovable, *práxis*, que sí se gasta al encender un nodo y se recarga con la semana y lo cotidiano; (3) el árbol absorbe los 7 grados del cursus — el grado se *deriva* de los puntos de árbol (escalera única de 7 nombres conservada) y la *clase* del banner pasa a ser la rama dominante (savant/fabricant/sinérgeta). Árchon sigue siendo electo. Pendientes: validar nombres, cerrar catálogo de nodos y costes exactos, regla de recarga de práxis, variante de latencia, esqueleto TS en `src/lib/metis/`.

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

### 2026-04-29 — Vista 3D de edificios con MapLibre GL fill-extrusion
Creado `public/polis-3d.html`: misma jerarquía administrativa (274 secciones, 5 distritos) pero al entrar en una sección los edificios se muestran extruidos en 3D. Altura calculada con `building:levels × 3m` para los 2 095 edificios que tienen el dato, y estimada por tipo de edificio para los 41 595 restantes. La cámara rota a pitch 55° con bearing -20° al entrar. Fallback seguro: `polis.html` (Leaflet 2D) sigue disponible e integrado en `/polis` como segunda sección.

Próximos pasos: (1) enriquecer alturas con datos catastrales de plantas cuando estén en Supabase, (2) colorear por composición de capital en lugar de por distrito, (3) integrar modelos 3D reales de Blender (blosm) cuando estén seccionados por sección censal — Path B del plan original.

### 2026-04-19 — Cuarto eje opcional `oikonomia`
Se decidió reducir a 3 ejes (koinonía/paideía/politeía). Si en iteraciones posteriores aparece una economía local productiva en OCRE, la interfaz `PesoPorEje` admite ampliarla sin romper contribuciones existentes.

## POLIS — Sistema de gestos

### 2026-05-13 — Trámites cívicos como categoría nueva del árbol (DIFERIDO — requiere identidad real)
Hoy el catálogo de gestos cubre expresión cívica declarativa (señalo, reporto, recomiendo, me comprometo). Falta el gesto que **mueve un trámite administrativo real** — la pieza que cierra el círculo "el mapa hace, no sólo muestra". Categoría nueva propuesta, **reservada en IDEAS hasta tener backend de identidad real (Cl@ve / certificado digital)** porque todos estos gestos exigen identidad oficial verificable, no anónimo ni pseudónimo:

- `queja_oficial` — un `reporte` que el usuario eleva con identidad. Va al organismo competente (ayuntamiento, cabildo, SCS, GovCan) con seguimiento del expediente. Un bache reportado se vuelve queja municipal trazable.
- `solicitud_cita` — pedir cita en padrón / servicios sociales / SCS desde el popup del equipamiento. El catálogo dice qué citas aplican a cada tipo de equipamiento.
- `consultar_padron` — sobre `vivienda` residencial. Certificado, cambio de domicilio, comprobación.
- `pago_tasa` — IBI, basura, agua, terraza, vado. No procesamos pago: redirigimos a la sede electrónica con contexto rellenado.
- `licencia_menor` — obra menor, mudanza, fiesta de calle, mercado puntual.
- `subvencion_o_ayuda` — sobre entidad cívica o comercio. Solicitar la subvención aplicable (cultura, vivienda, REA, bono cultural).
- `transparencia` — sobre equipamiento o entidad. Solicitud formal de información pública (ley de transparencia).
- `firma_propuesta` — firmar una `propuesta` (capa 3 del catálogo activo) elevándola a petición oficial al alcanzar quórum.

Decisiones a tomar cuando se desbloqueen: qué 3 trámites empezar (voto: queja oficial + cita SCS + consulta padrón), quién hospeda el puente administrativo (sede electrónica vs capa Next.js que envía por email firmado vs API directa si existe), y cómo se cablea Cl@ve/certificado contra la identidad pseudónima del sistema actual. Probablemente implica una **capa 6** nueva o ampliación de capa 5 con tipo de identidad `identidad_oficial`.

### 2026-05-13 — Acción colectiva con quórums
Mecánicas que dan sentido a sumarse: individualmente valen poco, colectivamente se transforman. Algunas piezas **podrían funcionar sin identidad real** (anónimo agregado o pseudónimo estable) y entrarían al catálogo activo en una iteración futura; otras dependen de los trámites (que están diferidos):

- `convoco_quorum` — propongo acción que requiere N personas. Si llega: se eleva. Ej: limpieza de playa (12+ → cabildo), paso peatonal (50+ → queja colectiva), consulta de barrio (100+ → resultado público no vinculante). Convocar puede hacerse con pseudónimo estable; lo que se eleva ya requiere identidad real.
- `firmo_quorum` — adhesión a una convocatoria. Más fuerte que `senal_pos`: es compromiso de presencia o consentimiento formal. Anónimo con UID estable evita duplicados sin exigir identidad.
- `voto_consulta_local` — si alguien activó una consulta informal, voto. Anónimo agregado por barrio.
- `mision_barrio` — el sistema propone misiones desde la analítica de gestos: "7 reportes de alumbrado este mes en tu barrio → ¿lo elevamos a queja colectiva?". No es gesto del usuario, es propuesta automática del sistema sobre un patrón detectado.

Sujetos nuevos posibles: `convocatoria_quorum` (efímera con umbral, parecida a `evento` pero con condición de activación).

Pendiente de decidir: ¿quórums los convoca cualquiera con pseudónimo, o sólo rol Mediador? ¿Misiones de barrio las propone el sistema automáticamente o las activa un Mediador?

### 2026-05-13 — Gamificación como puerta a capacidades (no como puntos decorativos)
Reformulación del sentido de la gamificación dentro del árbol de gestos. Los badges actuales (si se diseñaran como simples puntos coleccionables) serían vacíos. La propuesta es que cada badge **desbloquee una superficie de acción**, no acumule trofeo:

- **Vecino reconocido en X barrio** — tras N gestos válidos en el barrio. Sus reportes ganan peso en agregación pública; sus propuestas arrancan con +5 firmas implícitas.
- **Curador de tejido** — tras N `alta_ciudadana` validadas correctamente por moderación. Sus altas siguientes entran sin cola.
- **Mediador** — tras cumplir N compromisos públicos. Puede convocar consultas informales sin requerir activación admin.
- **Representante de entidad verificado** — ya existe como `soy_de_entidad` (capa 5 actual). Da `publico_balance`, `alianza`, etc.
- **Validador de zona** — tras señales que después se confirman correctas. Sus reportes saltan el filtro inicial de moderación.

Principio: quien no juega no pierde nada. Quien juega obtiene **más superficies de acción**, no medallas. Coherente con la filosofía "anonimato por defecto, identidad opcional verificable" — los badges no exponen a nadie, solo añaden permisos.

Lo único que entraría al catálogo activo sin esperar backend serían los conteos internos para detectar candidatos a cada badge. La concesión efectiva de capacidades requiere backend Supabase (perfil persistente, rol, validación de reportes). Por eso queda apuntado aquí.

### 2026-05-13 — Pendientes que se moverán al catálogo cuando se acuerden
Lista de cosas a decidir antes de mover ideas de IDEAS a `GESTO-CATALOG.md`:

1. ¿Qué 3 trámites empezamos cuando llegue identidad real? Voto inicial: queja oficial + cita SCS + consulta padrón.
2. ¿Quién hospeda el puente administrativo? Sede electrónica municipal con redirect, o capa Next.js propia que envía por email firmado, o API directa del organismo si existe.
3. ¿Quórums abiertos a cualquier pseudónimo o sólo rol Mediador?
4. ¿Misiones de barrio: propuestas automáticas del sistema o activación manual por Mediadores?
5. ¿Cómo se cablea Cl@ve/certificado contra la identidad pseudónima actual? Probablemente cuenta verificada que cuelga del pseudónimo estable, no reemplazo.
6. ¿Capa 6 nueva (identidad oficial) o ampliación de capa 5?
