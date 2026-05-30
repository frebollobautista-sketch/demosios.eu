# Contexto ético y estrategia de sembrado

**Propósito:** reunir en un solo lugar la evidencia actualizada (2024–2026) sobre los efectos del scrolling y las prácticas extractivas de las empresas tecnológicas, para que las decisiones de diseño de KOINOS se tomen **sabiendo exactamente qué se está rechazando o reutilizando**. Y, como cara B del mismo problema, plantear la estrategia de sembrado del FEED con contenido de dominio público (el "Twitter histórico") cuando los medios actuales y las figuras relevantes no están disponibles por no poder desmonetizarse.

La tesis de este documento: competir sin conocer las trampas del otro bando te hace ingenuo; conocerlas y replicarlas ciegamente te convierte en lo que estabas tratando de reemplazar. La posición correcta está en el medio — **saber exactamente cómo funciona el daño para poder elegir, caso por caso, qué mecanismo se rechaza, cuál se reutiliza con otro propósito, y cuál se adapta**.

---

## 1. Efectos del scrolling: qué dice la investigación 2024–2026

### 1.1 El bucle dopaminérgico ya no es metáfora, es neurociencia medida

El término *dopamine-scrolling* entró en la literatura de salud pública en 2025 como descripción clínica de un patrón de consumo. El estudio *Dopamine-scrolling: a modern public health challenge requiring urgent attention* (Sharpe & Spooner, Perspectives in Public Health, 2025) lo sitúa como problema de salud pública a gestionar, no como queja cultural. Lo relevante no es que "el móvil te enganche", es que hay mecanismos bioquímicos específicos:

- **Recompensa variable**: cada swipe puede traer algo o nada. El cerebro dispara dopamina en la **anticipación**, no en la recompensa. Es el mismo mecanismo que los tragaperras.
- **Pull-to-refresh, autoplay, feed sin fin, notificaciones intermitentes**: son cuatro de los ganchos documentados como "hooks" en la literatura de diseño persuasivo y en los papeles de neurociencia que estudian el efecto. Todos operan sobre la misma vía (sistema mesolímbico → núcleo accumbens → córtex prefrontal).
- **Estudio de seguimiento de 500 usuarios durante 6 meses**: quienes pasaron más de 2h/día en scroll mostraron una caída del 35% en la variabilidad de ondas Beta — un marcador de control de impulsos en el córtex prefrontal. No es correlación suave: es una huella medible.
- **Fragmentación de la atención**: un estudio de 2024 en *Nature Human Behaviour* documentó que los usuarios intensivos rinden medibly peor en tareas que requieren atención sostenida que los usuarios ligeros. La Nanyang Technological University de Singapur publicó en 2025 que el uso constante de redes sociales **entrena el cerebro a buscar novedad**, lo que degrada tanto la concentración profunda como el descanso.

**Lectura operativa para KOINOS:** el FEED no puede ser un scroll infinito y esperar que "no pase nada". Si copiamos el formato, heredamos el daño. Las alternativas documentadas y con evidencia detrás son la **paginación con cierre explícito**, los **stopping cues** ("ya has visto todas las novedades"), y las **listas finitas**. Hay un paper (Kieras, citado en NN/g y UX Planet) que formaliza por qué el punto final produce "sensación de control" — el usuario sabe cuándo ha terminado y puede parar sin sentir que se pierde algo.

### 1.2 Efectos específicos en adolescentes

- Sistema de refuerzo dopaminérgico **todavía en desarrollo** (el córtex prefrontal cierra maduración a los ~25).
- Más exposición absoluta (la mayoría reportan estar "casi constantemente online").
- Más impacto en sueño, ansiedad, depresión, autoestima. El *Stanford Youth Safety and Digital Wellbeing Report 2025* compila la evidencia y recomienda intervenciones de diseño, no solo educativas.
- Más de **40 fiscales generales de estados norteamericanos** han demandado a Meta en 2023–2024 por daños intencionales a menores. TikTok llegó a acuerdo antes de juicio a finales de 2025. Google (YouTube) y Snap están en la misma línea de fuego. El caso en el Distrito Norte de California se basa en **documentos internos** donde los propios investigadores de Facebook propusieron estudiar si algunas funcionalidades eran "adictivas" — y la propuesta fue desestimada.

**Lectura operativa para KOINOS:** cualquier funcionalidad que pueda clasificarse como "adictiva" en el sentido clínico es ahora una **exposición legal** además de un problema ético. Lo que durante 10 años fue "growth hacking" admirado, hoy se litiga. Esto cambia el coste-beneficio: la ventaja competitiva de copiar los trucos del adversario está bajando a medida que sube el coste regulatorio.

---

## 2. Prácticas de las empresas tecnológicas: el manual del adversario

### 2.1 El modelo *Hooked* y su crítica

Nir Eyal publicó *Hooked* en 2014. El libro formaliza un ciclo de cuatro fases — disparador → acción → recompensa variable → inversión — y se convirtió en manual de cabecera para product managers en Silicon Valley. Instagram, Slack, TikTok, Spotify están construidos sobre ese molde, con o sin atribución explícita.

La crítica es ahora mainstream: el mismo Eyal ha pasado diez años defendiéndose con *Indistractable* (2019) y con la "Manipulation Matrix", según la cual el Hooked solo es ético si tú mismo usarías el producto y si mejora materialmente la vida del usuario. Los detractores (Axbom, Big Think, UXmatters) argumentan que la salvaguarda ética es demasiado débil porque el autor del producto **siempre puede convencerse** de que su producto ayuda. El ejemplo canónico: TikTok.

**Lectura operativa para KOINOS:** los cuatro elementos del Hooked no son intrínsecamente malos. El disparador existe en cualquier app (un badge rojo es un disparador). La acción existe (tocar). La recompensa existe (ver un post). La inversión existe (escribir algo). El problema es **la combinación maximalista y opaca**: disparadores externos agresivos + acciones sin fricción + recompensas impredecibles + inversión que el usuario no percibe. KOINOS puede usar cada uno de los cuatro elementos **invertidos**:

| Elemento Hooked       | Versión extractiva       | Versión KOINOS                                 |
|-----------------------|--------------------------|------------------------------------------------|
| Trigger externo       | Notificación push aleatoria | Notificación contextual silenciosa, configurable, con motivo visible |
| Acción                | Tap sin fricción          | Tap con **micro-fricción cívica** (p.ej. "tu post reposa 10 min antes de publicarse") |
| Recompensa variable   | Likes impredecibles, algoritmo opaco | **PEC visible**, lento y socialmente caro; algoritmo editable por el usuario |
| Inversión             | Datos que te atrapan     | Patrimonio exportable que te **libera** (zip con todo lo tuyo) |

Esta tabla es la cara operativa del proyecto. Cada entrada debería poder trazarse hasta una decisión de código concreta.

### 2.2 Dark patterns: la FTC, la UE y la jurisprudencia de 2024–2026

La FTC publicó en septiembre de 2022 su informe *Bringing Dark Patterns to Light*, donde identifica cuatro categorías: los que crean una creencia falsa, los que ocultan información relevante, los que provocan cargos no autorizados, y los que manipulan opciones de privacidad. En julio de 2024 la FTC, ICPEN y GPEN publicaron un examen conjunto de sitios y apps: **el 76% tenía al menos un patrón oscuro** y el 67% tenía varios.

En septiembre de 2025 la FTC cerró un acuerdo récord de **2.500 millones de dólares con Amazon** por el flujo de suscripción a Amazon Prime — un dark pattern clásico llamado *Roach Motel*: fácil entrar, imposible salir.

En Europa el movimiento es aún más explícito. La *Digital Services Act* (DSA) prohíbe de forma directa los dark patterns. El 5 de diciembre de 2025 la Comisión Europea emitió su **primera decisión de no conformidad** bajo la DSA y multó a X con **120 millones de euros**, en parte porque las marcas azules de verificación de X Premium fueron consideradas diseño engañoso: daban apariencia de verificación sin que X verificara nada real. La Comisión investiga en paralelo a Facebook e Instagram por no proteger a menores del *rabbit-hole effect*, exactamente el efecto que describe la investigación neurocientífica del punto 1.1.

**Lectura operativa para KOINOS:**

1. Hay una **lista explícita** de lo que no se puede hacer legalmente en la UE, publicada por el regulador. KOINOS debería auditarse contra ella como test de cumplimiento (no porque nos obliguen siendo pequeños, sino para no heredar malas prácticas por descuido).
2. Hay una **exigencia emergente** (ya vigente en plataformas grandes) de ofrecer al usuario un **feed alternativo no basado en perfilado** — por ejemplo, cronológico. KOINOS puede hacerlo desde el día 1. El `AlgoritmoPanel` del FEED ya apunta en esa dirección: el usuario diseña su filtro; no hay un ranking oculto.
3. Hay casos de **transparencia algorítmica exigida**: los usuarios deben poder saber cómo se ordena su feed. Documentarlo es diferenciación.

### 2.3 Tristan Harris y la "economía de la atención"

Harris, ex-Google, fundador del Center for Humane Technology, es el otro gran teórico del problema. Su frase "human downgrading" (2019) describe cómo el conjunto de daños — adicción, distracción, aislamiento, polarización, fake news — **se refuerzan mutuamente** y degradan la capacidad humana colectiva. En 2024 acuñó "attachment economy" para describir la siguiente vuelta de tuerca: las compañías que no solo capturan atención sino que reemplazan vínculos humanos por vínculos con el producto (chatbots románticos, asistentes "amigo", etc.).

**Lectura operativa para KOINOS:** lo anterior dice lo que NO hay que hacer. Harris añade una dimensión positiva: el diseño humano pide que el producto **devuelva algo al usuario** cada vez que extrae algo de él. Si KOINOS pide atención, debe dar información clara (semáforo), autonomía (algoritmo editable), y comunidad real (PEC visible, POLIS geolocalizado).

---

## 3. Competir en un *level playing field* sabiendo las reglas del otro

Hay tres estrategias posibles, y este proyecto debería elegir explícitamente una.

### 3.1 Estrategia A — Rechazo total
Nada de scroll infinito, nada de notificaciones push, nada de gamificación, nada de ranking algorítmico. Es la opción más purista y la que siguen apps como Behance, Vero, parte de Mastodon. Problema: **no crece**. Funciona si el producto es radical en el nicho (Vero tiene 3M usuarios tras 8 años).

### 3.2 Estrategia B — Reutilización consciente
Usar los mismos elementos técnicos (feed, notificación, gamificación) pero **orientados al beneficio del usuario**, con transparencia explícita y con posibilidad de desactivar cualquier pieza. Es lo que KOINOS ya está haciendo en el código con PEC, semáforo y algoritmo editable. Requiere disciplina constante para no deslizarse a la estrategia C.

### 3.3 Estrategia C — Copia con maquillaje
Copiar el Hooked clásico con etiquetas amables ("wellbeing", "community", "authentic"). Es lo que hicieron BeReal, Threads y otros. Fallan porque los usuarios notan pronto la incoherencia entre el discurso y el diseño.

**Recomendación para KOINOS:** estrategia B, documentada pieza a pieza en este notebook. Cada funcionalidad con gancho debe llevar anotado:

- Qué hook del manual Eyal reutiliza.
- Qué versión extractiva evita.
- Cómo permite al usuario desactivarla.

Esta disciplina es difícil de mantener en vibe coding sin un contrato escrito. Este archivo es ese contrato.

### 3.4 Diseño concreto: *stopping cues* y paginación cívica

Ideas pragmáticas para aplicar desde ya, con base en la investigación de anti-scroll (NN/g, *Design Frictions on Social Media* — arXiv 2024):

- **Cierre explícito del feed**: después de N posts nuevos, el feed muestra una tarjeta de cierre *"Hasta aquí las novedades. ¿Quieres seguir explorando, abrir el diario, o salir?"*. El usuario toma una decisión en lugar de caer en el bucle.
- **Cierre visible del tiempo**: un marcador temporal ("llevas 8 min en FEED. Esto equivale a leer 3 páginas de un libro") visible pero no culpabilizador. Solo un dato.
- **Fricción cívica antes de publicar**: 10 minutos de reposo del borrador. Ya propuesto en `02_FEED.md §4.4`. Usar el diario como espacio de reposo.
- **Algoritmo apagable**: el usuario debe poder cambiar en un tap entre feed algorítmico (con sus secciones PHAROS ponderadas) y feed cronológico puro. Esto lo exige la DSA para plataformas grandes — KOINOS puede adelantarse.
- **"Has visto todo lo que te interesa hoy"**: una señal activa de suficiencia, no un "cargando más".

Ninguno de estos elementos es revolucionario técnicamente. La innovación es adoptarlos **por defecto** cuando el estándar industrial sigue optimizando para lo contrario.

---

## 4. El problema del sembrado: por qué un FEED vacío no arranca

### 4.1 El *cold start* en redes sociales

Andrew Chen, en *The Cold Start Problem* (2021, hoy canónico), describe cómo las redes sociales fracasan cuando no consiguen construir su **red atómica**: el grupo más pequeño que se sostiene a sí mismo. Los ejemplos recurrentes son Reddit (que durante meses fue "flintstoneado" por los fundadores con docenas de cuentas bot publicando manualmente), Pinterest (con un equipo de *tastemakers* contratados para poblar los primeros tableros), LinkedIn (con invitación cerrada a profesionales específicos). La tesis central: **sin contenido inicial, la red no prende, por muy buena que sea la UX**.

### 4.2 La doble restricción de KOINOS

KOINOS se enfrenta a dos restricciones simultáneas que empeoran el cold start:

1. **Las figuras relevantes actuales no están disponibles.** Escritores, periodistas, músicos o intelectuales vivos con audiencia ya operan en plataformas monetizadas (Substack, YouTube, X, Patreon). KOINOS no puede ofrecerles ingresos equivalentes ni alcance masivo, y además se posiciona contra el modelo de monetización por atención — pedirles que publiquen en KOINOS es pedirles que renuncien a sus lectores por un ideal.
2. **Los medios de comunicación actuales tampoco están incentivados.** Un titular publicado en KOINOS no genera clics en su sitio original. La API de noticias (`src/app/api/noticias/route.ts`) mitiga este problema en parte porque trae enlaces, pero no soluciona la ausencia de voces.

Si el FEED arranca vacío, el usuario entra, ve nada, y se va. Si se llena de bots genéricos, se parece al resto. Hace falta una tercera vía.

### 4.3 El Twitter histórico como tercera vía

La solución es sembrar el FEED con **figuras históricas de dominio público** — escritores, músicos y pintores muertos cuya obra está libre de derechos — publicando fragmentos de su obra como si fueran posts cívicos en diálogo con la actualidad. El ejemplo que ya vive en el código es el post de Marco Aurelio (`src/app/feed/page.tsx:119–137`):

> `isAI: true, aiLabel: "Meditaciones, Libro III"`

Ese post usa el tipo `Post` con dos campos (`isAI`, `aiLabel`) que **ya existen precisamente para esto**. La infraestructura está medio montada sin que lo hubiéramos formalizado. Solo falta el corpus y las reglas.

### 4.4 Ventajas estructurales del sembrado histórico

- **Cero coste de derechos.** Todo lo publicado antes de 1929 está en dominio público en EE.UU.; en España y UE las reglas son por autor (70 años desde la muerte en la mayoría de países). Un autor muerto antes de 1955 es seguro en casi cualquier jurisdicción.
- **Cero conflicto de monetización.** Nadie se queja de que KOINOS publique a Montaigne.
- **Calidad garantizada por la historia.** El filtro editorial lo hizo el tiempo. Las citas de Marco Aurelio que siguen vivas 1800 años después son mejores por selección natural que cualquier tweet fresco.
- **Diálogo con la actualidad sin distorsión.** Un post de Kafka del 3 de septiembre de 1917 sobre la burocracia puesto al lado de una noticia de hoy sobre la Administración es un montaje con fuerza literaria y cero riesgo de fake: todo es lo que dice ser.
- **Coherencia con las secciones PHAROS.** Las 8 secciones temáticas pueden asignar autores: un poeta climático (Mary Oliver, Gary Snyder en parte), un migrante histórico (Stefan Zweig), un crítico mediático (Karl Kraus), un pensador del común (Kropotkin, Elinor Ostrom cuando pase a dominio público). El corpus se auto-organiza.
- **Ritmo natural.** Un autor publica 1 post al día o cada 2 días. Con 30 autores sembrados, el FEED recibe 15–30 posts históricos por día — suficiente para que nunca esté vacío sin inundar.
- **Solventa el vacío inicial sin mentir.** No son cuentas suplantadas ni bots que fingen ser personas. Son **citas atribuidas**, con etiqueta visible de "histórico" y enlace a la obra original en Project Gutenberg, Wikisource o el archivo correspondiente.

### 4.5 Riesgos y cómo mitigarlos

- **Mala atribución.** Las redes sociales están llenas de citas apócrifas ("dijo Einstein…", "dijo Ghandi…"). Cada post debe llevar **referencia bibliográfica verificable** (obra, capítulo, edición) y enlace público cuando exista. Sin eso, la estrategia se convierte en lo contrario de lo que pretende (fake news culta).
- **Descontextualización.** Un fragmento de Nietzsche sin contexto puede ser instrumentalizado por cualquiera. Cada post debe permitir desplegar el párrafo completo con un tap.
- **Sesgo cultural.** Si todo el sembrado es hombre europeo del XIX, KOINOS hereda ese sesgo y lo multiplica. El corpus tiene que trabajarse explícitamente con diversidad geográfica, de género y de tradición.
- **Usurpación estética.** No vale "lo que Marco Aurelio habría tuiteado hoy" como paráfrasis. Solo cita literal o traducción certificada. La licencia creativa es cero; la licencia editorial (qué día, qué sección, junto a qué noticia) es total.
- **Dependencia excesiva del sembrado.** Si a los 6 meses el 80% del FEED siguen siendo autores muertos, KOINOS ha fracasado en atraer voces vivas. El sembrado es rampa, no destino. Hay que medir la proporción y bajar el peso del bot histórico según crezca el contenido orgánico.

### 4.6 Arquitectura técnica mínima (cuando llegue el momento)

Sin escribir código todavía, estas son las piezas que el sembrado histórico requiere:

- **Corpus estructurado**: una tabla `historical_posts` con `author_id`, `source_work`, `chapter`, `text_original`, `text_translated_es`, `section_pharos_id`, `date_publishable` (fecha ideal de publicación si se programa).
- **Catálogo de autores**: tabla `historical_authors` con `name`, `birth_year`, `death_year`, `public_domain_in_eu` (bool), `public_domain_in_us` (bool), `canonical_portrait_url` (dominio público), `primary_section_pharos`, `description`.
- **Marca visual del post histórico**: el componente `Post` ya tiene `isAI` pero el nombre es confuso (estos posts no son AI — son históricos). Proponemos renombrar a `kind: 'human' | 'historical' | 'editorial' | 'ai'` para que cada fuente tenga su signo visual propio.
- **Programador simple**: una función que, cada día, elige N posts históricos de `historical_posts` tratando de respetar la diversidad de secciones PHAROS, autores, y fechas del calendario (ej. Kafka del 3 de julio en el 3 de julio).
- **PEC sobre post histórico**: sí se puede. El PEC a Kafka dice "esto me resuena hoy", no "apruebo a Kafka como vecino". La distinción se entiende culturalmente.
- **Comentario sobre post histórico**: también, pero con cuidado de moderación (no se puede insultar a un autor muerto como si fuera un usuario vivo). Recomendación: en v1, los posts históricos son comentables pero **no retables** por el semáforo verde/amarillo/rojo — la fuente es inatacable (es lo que es, una cita), aunque se pueda debatir la vigencia.

---

## 5. Espacio para tu lista de figuras históricas

*Esta sección queda reservada para la lista que vas a compartir: escritores, músicos, pintores (quizás filósofos, científicas, arquitectas, activistas) que vayan a formar parte del Twitter histórico.*

La idea es que cuando me pases la lista, yo pueda:

1. **Verificar dominio público** para cada nombre (año de muerte, jurisdicción).
2. **Asignarlos a una sección PHAROS** como primer filtro editorial (cada autor por defecto publica en su sección, pero puede aparecer transversalmente si encaja).
3. **Proponer 3–5 fragmentos iniciales** por autor, con referencia bibliográfica verificable, para arrancar el corpus.
4. **Marcar sesgos del conjunto** (p.ej. "de 20 nombres, 17 son hombres europeos del XIX — sugiero rebalancear con X, Y, Z").
5. **Mapear posibles conflictos** (autores con obra controvertida donde una cita fuera de contexto puede dañar).

Estructura que me gustaría recibir de ti (indicativa, no obligatoria):

```
- Nombre completo del autor
- Año de nacimiento y muerte
- Disciplina (escritor / músico / pintor / otro)
- Obra principal o fragmento favorito que te gustaría ver en KOINOS
- Sección PHAROS donde crees que encajaría mejor (opcional)
- Razón por la que lo incluyes (opcional pero útil)
```

Con 15–30 nombres iniciales se puede arrancar.

---

## 6. Cómo se conecta esto con los otros archivos del notebook

- `00_README.md` — se actualiza para incluir este archivo como 5º documento del notebook.
- `01_TOUCH.md §4.8` (etiqueta explícita del orden) se beneficia directamente de §2.2 y §3.4 de este archivo.
- `02_FEED.md §4.2, §4.4, §4.6, §4.7` (semáforo, reposo, post-cita, deslizadores) se entrelaza con §3 y §4 de este archivo.
- `03_POLIS.md §4.5` (gamificación ligera) se apoya en §3.2 (reutilización consciente de hooks) de este archivo.
- `04_FUNCIONALIDADES_LOG.md §2.4` (post-cita como formato nativo) queda formalizado aquí como estrategia completa de sembrado histórico.

---

## Fuentes consultadas para este documento

### Efectos del scrolling / neurociencia
- [Dopamine-scrolling: a modern public health challenge requiring urgent attention — Sharpe & Spooner, Perspectives in Public Health 2025 (SAGE)](https://journals.sagepub.com/doi/10.1177/17579139251331914)
- [Dopamine-scrolling — PubMed / PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC12322333/)
- [Modern-day High: The Neurocognitive Impact of Social Media Usage — Cureus 2025](https://www.cureus.com/articles/380494-modern-day-high-the-neurocognitive-impact-of-social-media-usage.pdf)
- [Social Media Algorithms and Teen Addiction — PMC 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC11804976/)
- [Infinite Scrolling, Finite Satisfaction — arXiv 2408.09601](https://arxiv.org/html/2408.09601v1)
- [Your Brain on Infinite Scroll — WebProNews](https://www.webpronews.com/your-brain-on-infinite-scroll-the-science-behind-brain-rot-and-what-it-means-for-a-generation-raised-online/)
- [Stanford Youth Safety and Digital Wellbeing Report 2025](https://cdh.stanford.edu/sites/g/files/sbiybj29486/files/media/file/youth_safety_and_digital_wellbeing_report_2025.pdf)

### Dark patterns y regulación
- [FTC Bringing Dark Patterns to Light — Report 2022](https://www.ftc.gov/system/files/ftc_gov/pdf/P214800%20Dark%20Patterns%20Report%209.14.2022%20-%20FINAL.pdf)
- [FTC, ICPEN, GPEN Results of Review of Dark Patterns — 2024](https://www.ftc.gov/news-events/news/press-releases/2024/07/ftc-icpen-gpen-announce-results-review-use-dark-patterns-affecting-subscription-services-privacy)
- [The 'dark patterns' at the center of FTC's lawsuit against Amazon — NPR](https://www.npr.org/2025/09/23/nx-s1-5543497/the-dark-patterns-at-the-center-of-ftcs-lawsuit-against-amazon)
- [Trapped By Design — Berkeley Technology Law Journal 2025](https://btlj.org/2025/11/trapped-by-design-how-dark-patterns-manipulate-your-choices-and-the-regulators-fighting-back/)
- [Regulating dark patterns in the EU: Towards digital fairness — European Parliament 2025](https://www.europarl.europa.eu/RegData/etudes/ATAG/2025/767191/EPRS_ATA(2025)767191_EN.pdf)
- [Digital Services Act overview — European Commission](https://digital-strategy.ec.europa.eu/en/policies/digital-services-act)
- [Digital Services Act — AlgorithmWatch explainer](https://algorithmwatch.org/en/dsa-explained/)
- [Cozen O'Connor: Unpacking Dark Patterns Alert 2025](https://www.cozen.com/news-resources/publications/2025/unpacking-dark-patterns)

### Hooked, attention economy, industry critique
- [How Nir Eyal's habit books are dangerous — Axbom](https://axbom.com/nir-eyal-habit-danger/)
- [An Incomplete Loop: A Review of Nir Eyal's Hooked — Big Think](https://bigthink.com/wikimind/an-incomplete-loop-a-review-of-hooked-by-nir-eyal/)
- [Book Review: Hooked — UXmatters](https://www.uxmatters.com/mt/archives/2021/06/book-review-hooked-how-to-build-habit-forming-products.php)
- [What if we had fixed social media? — Center for Humane Technology](https://centerforhumanetechnology.substack.com/p/what-if-we-had-fixed-social-media)
- [Tristan Harris — Wikipedia](https://en.wikipedia.org/wiki/Tristan_Harris)
- [The CHT Perspective — Humane Tech](https://www.humanetech.com/the-cht-perspective)
- [Connecting the dots on the 'attachment economy' — Computerworld](https://www.computerworld.com/article/4124639/connecting-the-dots-on-the-attachment-economy.html)
- [TikTok settles as social media giants face landmark trial — First Amendment Center](https://firstamendment.mtsu.edu/post/tiktok-settles-as-social-media-giants-face-landmark-trial-over-youth-addiction-claims/)
- [Facebook researchers previously proposed studying 'addictive' features — CNN Business](https://www.cnn.com/2026/02/23/tech/facebook-researchers-study-addictive-features)

### Diseño anti-scroll / stopping cues
- [Design Frictions on Social Media: Balancing Reduced Mindless Scrolling and User Satisfaction — arXiv 2407.18803](https://arxiv.org/html/2407.18803v3)
- [Infinite Scrolling: When to Use It, When to Avoid It — Nielsen Norman Group](https://www.nngroup.com/articles/infinite-scrolling-tips/)
- [Infinite Scrolling is Not for Every Website — Nielsen Norman Group](https://www.nngroup.com/articles/infinite-scrolling/)
- [UX: Infinite Scrolling vs. Pagination — Nick Babich, UX Planet](https://uxplanet.org/ux-infinite-scrolling-vs-pagination-1030d29376f1)

### Cold start y estrategias de sembrado
- [How to solve the cold-start problem for social products — Andrew Chen](https://andrewchen.com/how-to-solve-the-cold-start-problem-for-social-products/)
- [The Cold Start Problem — complete summary](https://howtoes.blog/2025/06/03/the-cold-start-problem-a-book-summary/)
- [The Cold Start Problem in Threads — Anand Paka / Medium](https://medium.com/@anandp/the-unsolved-cold-start-problem-in-threads-fa5c80870d8d)

### Twitter histórico / contenido dominio público / bots literarios
- [Dead Writers Society: Social Media and Posthumous Author Identity — Morgan Mushroom](https://morganmushroomwrites.com/2018/08/09/dead-writers-society-social-media-and-posthumous-author-identity/)
- [A Total Beginner's Guide to (Literary) Twitter Bots — Adam Hammond](https://www.adamhammond.com/botguide/)
- [The lives and afterlives of community-created bots on Twitter: A minor history — Carlon, Burgess, Kasianenko 2025 (SAGE)](https://journals.sagepub.com/doi/10.1177/13548565251334087)
- [Postmortem memory of public figures in news and social media — PNAS](https://www.pnas.org/doi/10.1073/pnas.2106152118)
- [If Historical Figures Had Social Media — Kain DeFoe Communications](https://www.kaindefoecommunications.com/social-media-marketing/if-historical-figures-had-social-media/)

*Código de referencia en `src/app/feed/page.tsx` líneas 58–75 (tipo `Post`, campos `isAI`/`aiLabel`), 119–137 (post Marco Aurelio).*
