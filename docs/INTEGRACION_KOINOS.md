# Integración KOINOS → Demos iOS

Cómo trasladar todas las funciones de KOINOS hacia la plataforma Demos iOS, de forma que podamos ofrecer los productos por separado o juntos, atraer al público cívico serio y a la vez dar cobijo a usuarios de redes sociales canarios que quieran un entorno fuera del circuito del odio.

Última revisión: 2026-04-20.

---

## 1. Tesis de la integración

Demos iOS y KOINOS nacieron del mismo autor y comparten un núcleo ético:

- **Nada de engagement algorítmico.** No hay feed infinito optimizado para atención.
- **PEC en vez de like.** El respaldo es público y encarnado; el "like" anónimo no existe o es secundario.
- **Semáforo híbrido.** Cada contenido público se etiqueta por calidad (verde/ámbar/rojo) desde autor + comunidad + editorial.
- **Taxonomía PHAROS.** Las 8 secciones temáticas son comunes: cambio climático, común, migración, defensa, medios, industria, 4ª Revolución Industrial, salud+reproductiva.
- **Contra el odio por diseño.** Las reglas del sistema desincentivan falacia y descarrilamiento.

Tienen, sin embargo, públicos distintos:

| Producto | Público objetivo | Propuesta |
|---|---|---|
| **OCRE** (cívico) | Vecino serio, activista, asociación, PYME local | Deliberar, mapear, recuperar espacios |
| **KOINOS FEED** | Usuario de red social cansado del algoritmo | Expresar ideas originales con tiempo |
| **KOINOS TOUCH** | Circulo íntimo por invitación | Compartir fotos sin métricas ni algoritmo |

Integrados bajo el paraguas **Demos iOS**, la plataforma pasa a leerse como un sistema operativo cívico-social con tres capas que se activan a voluntad. El usuario entra por la puerta que le interesa y puede añadir las otras.

## 2. Propuesta de producto: una plataforma, tres capas

### 2.1. Capas

```
                    ┌──────────────────────────┐
                    │     DEMOS iOS by OCRE    │
                    │   (perfil · capital · PHAROS)   │
                    └──────────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
       ┌──────┐            ┌──────┐              ┌───────┐
       │ OCRE │            │ FEED │              │ TOUCH │
       │cívico│            │social│              │íntimo │
       └──────┘            └──────┘              └───────┘
     Ágora                microblog            fotos landscape
     Bibliotheka          de ideas              long-press
     Polis                + 4 pieles            caption oculta
     Escribanía*          + semáforo            invite-only
     Cursus honorum       + PEC
     Koiná                + AlgoritmoPanel
                          (mausoLEO opcional)
```
*Escribanía = tercera ala de Bibliotheka, ya propuesta.

### 2.2. Cómo se presentan

- **Home (faro)**: tres puertas claras. "Entrar en OCRE", "Entrar en FEED", "Entrar en TOUCH". El faro sigue siendo el hero.
- **/ajustes → Capas activas**: toggle de tres para elegir cuáles quieres usar. Determina qué aparece en el nav.
- **/nosotros**: explica el solapamiento y las tres puertas.

### 2.3. Posicionamiento por público

- **El público serio** entra por OCRE (formal, estructurado). Si quiere expresarse más allá de los hilos de Ágora, añade FEED. Rara vez TOUCH.
- **El usuario de red social** entra por FEED (familiar: posts, reacciones, gestos). Descubre TOUCH para su círculo. Si le interesa su barrio, activa OCRE.
- **Ambos convergen** en un mismo espacio cívico sin tener que cambiar de app.

## 3. Arquitectura unificada

### 3.1. Identidad única

Una sola tabla `profiles`, un solo proyecto Supabase, un solo login. El mismo handle aparece en tus posts del FEED, tus fotos TOUCH (para tus círculos), tus hilos en Ágora y tus pines en Polis.

### 3.2. Sistema de capital común

Cada aportación, sea la capa que sea, genera entradas en `contribuciones`. Los tres ejes (Koinonía, Paideía, Politeía) se alimentan de todas las capas por igual, con pesos ya definidos. El Cursus honorum progresa igual si eres muy activo en FEED, en Bibliotheka o en Polis.

### 3.3. Tabla principal: `publicaciones`

Reemplaza/complementa las tablas que iba a haber separadas por tipo. Una tabla reúne todo lo publicable:

```sql
create type modo_publicacion as enum (
  'hilo_agora',
  'respuesta_agora',
  'post_feed',
  'foto_touch',
  'articulo_escribania',
  'recurso_koina',
  'video_cursus',
  'pin_polis'
);

create type piel_publicacion as enum (
  'plain',      -- por defecto FEED
  'post_it',    -- idea corta
  'periodico',  -- noticia
  'cuero',      -- posicionamiento serio
  'cita',       -- frase histórica
  'pergamino'   -- artículo largo Escribanía
);

create type visibilidad as enum ('publico', 'circulo', 'privado');
create type semaforo as enum ('verde', 'ambar', 'rojo');

create table publicaciones (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references profiles(id) on delete cascade not null,
  modo modo_publicacion not null,
  texto text,
  imagen_url text,
  video_url text,
  seccion_pharos text,
  barrio_id text,
  piel piel_publicacion default 'plain',
  visibilidad visibilidad default 'publico',
  semaforo semaforo,
  parent_id uuid references publicaciones(id) on delete cascade,
  es_ai boolean default false,
  ai_autor_historico text,  -- si es mausoLEO
  creado_en timestamptz default now(),
  updated_at timestamptz default now()
);

create index publicaciones_modo_idx on publicaciones(modo);
create index publicaciones_author_idx on publicaciones(author_id);
create index publicaciones_seccion_idx on publicaciones(seccion_pharos);
create index publicaciones_parent_idx on publicaciones(parent_id);
create index publicaciones_creado_idx on publicaciones(creado_en desc);
```

### 3.4. Reacciones unificadas

```sql
create type tipo_reaccion as enum (
  'like',      -- anónimo, suma al contador
  'pec',       -- respaldo encarnado, visible
  'datos',     -- esta publicación aporta datos verificables
  'opinion',   -- es una opinión válida
  'ruido'      -- no aporta, ataque o falacia
);

create table reacciones (
  id uuid primary key default gen_random_uuid(),
  publicacion_id uuid references publicaciones(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  tipo tipo_reaccion not null,
  creado_en timestamptz default now(),
  unique (publicacion_id, user_id, tipo)
);
```

Con esto, el perfil de calidad de cada usuario se computa como el ratio de reacciones recibidas: % datos / % opinión / % ruido. Los usuarios con ratio alto de ruido reducen visibilidad, los de alto datos/opinión ganan peso al reaccionar.

### 3.5. Círculos (para TOUCH)

```sql
create table circulos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  nivel integer not null check (nivel between 1 and 3),  -- 1=íntimo, 2=cercano, 3=conocido
  nombre text  -- "familia", "amigos de barrio"…
);

create table pertenencia_circulo (
  circulo_id uuid references circulos(id) on delete cascade not null,
  miembro_id uuid references profiles(id) on delete cascade not null,
  primary key (circulo_id, miembro_id)
);
```

Cada `publicaciones.visibilidad = 'circulo'` va acompañada de un `circulo_id` (o lista) que la RLS usa para filtrar.

## 4. Navegación propuesta

Hay tres formas razonables:

### Opción A — Selector de capa en el header (recomendada)

```
[ 🔆 faro ] Demos iOS by OCRE               [📮 perfil ⚙ ajustes]
┌─────────────────────────────────────────────────────────────┐
│  OCRE    │    FEED    │    TOUCH                             │ ← selector capa
└─────────────────────────────────────────────────────────────┘
[ Inicio · Ágora · Bibliotheka · Polis · Nosotros ]      ← sub-nav OCRE

(al cambiar a FEED:)
[ Feed · Categorías · Destacados · Siguiendo ]

(al cambiar a TOUCH:)
[ Álbum · Kiosko · Círculos ]
```

**Pro**: separación clara entre modos. Cada modo tiene su gramática propia.
**Contra**: una capa extra en el header.

### Opción B — Todo en un único nav

```
[ 🔆 faro ] Demos iOS by OCRE
[ Inicio · Ágora · Bibliotheka · Polis · FEED · TOUCH · Nosotros ]
```

**Pro**: más simple.
**Contra**: los tres modos se mezclan mentalmente para el usuario.

### Opción C — Aplicaciones separadas con SSO

`demosios.eu` (OCRE), `feed.demosios.eu` o `koinos.app` (KOINOS). Mismo Supabase, misma sesión.

**Pro**: cada producto respira.
**Contra**: más infra, más dominios, el usuario se cansa de cambiar.

**Recomendación**: A para la primera iteración. Si en dos años KOINOS FEED ha crecido a masa suficiente se puede independizar a C.

## 5. Qué se reutiliza de KOINOS

Mucho. El repo `/KOINOS` tiene:

- **`src/lib/pharos/`** — ya copiado a OCRE. Una sola fuente de verdad.
- **`src/lib/supabase/`** — ya replicado.
- **`src/middleware.ts`** — adaptado como `proxy.ts` en OCRE.
- **`src/app/feed/page.tsx`** (≈6000 líneas) — contiene TODAS las pieles, gestos, AlgoritmoPanel, BibliotecaPanel, PolisMap, compose modal. Es el tesoro a portar. Se divide en componentes al traerlo.
- **`src/lib/las-palmas-data.ts`** — landmarks para POLIS. Se fusiona con `territorio/canarias.ts`.
- **`src/components/PolisMap.tsx`** — versión Leaflet del mapa. Se añade como segunda opción al tablero hexagonal, para cuando haya landmarks reales.
- **`prototipos/koinos-showcase.jsx`** — toggle TOUCH/FEED de referencia visual.
- **`prototipos/feed-prototype.jsx`** — UX inicial de FEED.
- **`docs/notebook/01_TOUCH.md`** y **`02_FEED.md`** — decisiones de diseño ya tomadas.

El ahorro es muy grande: las primeras 2 fases (FEED y TOUCH) son reorganizar + portar, no diseñar de cero.

## 6. Fases de migración

Cada fase es una tanda de trabajo clara con su propio commit set. Estimaciones para una sesión de 2-3 horas.

### Fase 1 — FEED básico (1-2 sesiones)

**Objetivo**: traer el microblog reflexivo como capa pública.

- Añadir al header el selector de capa A (OCRE / FEED / TOUCH).
- Nueva ruta `/feed`.
- Portar los 4 tipos de piel (post-it, periódico, cuero, cita) como componente `<PostFeed>` con variantes.
- Compose modal a pantalla completa: texto + 1 imagen + link con embed previsualizado + selector de sección PHAROS + selector de piel.
- Tabla `publicaciones` con `modo='post_feed'`.
- Feed cronológico, sin infinito scroll — cargas 20, botón "ver más antiguo".
- Gestos móviles: swipe arriba descartar, swipe derecha guardar, doble tap like, long-press "más como esto".
- RLS: posts públicos visibles a todos; insert solo autenticado.

**Sin esta fase**: no.
**Con esta fase**: el usuario tiene algo reconocible y similar a una red social tradicional, pero limpio.

### Fase 2 — TOUCH por invitación (1-2 sesiones)

**Objetivo**: la capa íntima de fotos.

- Nueva ruta `/touch`.
- Tabla `circulos` y `pertenencia_circulo`. UI en `/ajustes → Círculos` para invitar.
- Vista de foto fullscreen horizontal (landscape). Swipe entre fotos, long-press revela caption con glassmorphism. No hay métricas visibles.
- `publicaciones` con `modo='foto_touch'` y `visibilidad='circulo'`.
- RLS: tu TOUCH se ve solo por miembros de tus círculos.
- Sin feed cronológico: se pasa foto a foto como páginas.

**Sin esta fase**: FEED solo, KOINOS queda cojo.
**Con esta fase**: la capa íntima está completa.

### Fase 3 — Reacciones y semáforo unificados (1 sesión)

**Objetivo**: el sistema de calidad.

- Tabla `reacciones` con los cinco tipos (like, pec, datos, opinión, ruido).
- Componentes `<PECers>`, `<ReactionBar>`, `<QualityBadge>`.
- Perfil del usuario muestra su % datos / opinión / ruido.
- Función SQL que reduce visibilidad de posts con >40% ruido.
- Semáforo visible en cada publicación, coloreado.

**Sin esta fase**: el feed es solo cronológico.
**Con esta fase**: la plataforma empieza a diferenciarse éticamente de las demás.

### Fase 4 — Unificar perfil y capital (1 sesión)

**Objetivo**: el faro se enciende por dentro.

- `/perfil` muestra actividad agregada de todas las capas.
- Reactivar `<BannerAvatar>` con datos reales.
- Badges KOI/PAI/POL visibles en cada post del FEED y en cada hilo del Ágora.
- Cursus honorum progresa con todas las aportaciones.

**Sin esta fase**: el capital sigue siendo abstracto.
**Con esta fase**: el usuario ve que lo que hace le mueve el nivel.

### Fase 5 — AlgoritmoPanel y filtrado por PHAROS (0.5 sesión)

**Objetivo**: el usuario diseña su propio feed.

- Panel en `/feed/ajustes` para activar/desactivar las 8 secciones PHAROS.
- Filtro cronológico puro como alternativa (exigencia DSA).
- Gestos de "más como esto" y "menos como esto" afectan los pesos.

### Fase 6 — MausoLEO / EternaGRAM (exploratoria, 2 sesiones)

**Objetivo**: personajes históricos en dominio público publicando.

- Tablas `autores_historicos` y `publicaciones_historicas`.
- Corpus inicial: Marco Aurelio, Arendt, Kropotkin, Ostrom (cuando entre a dominio público), Mary Oliver, Galdós para lo canario.
- Programador que elige N por día respetando diversidad de sección.
- Toggle en `/ajustes` para activarlos/desactivarlos.

### Fase 7 — Diario lateral (0.5 sesión)

**Objetivo**: tarea personal privada.

- Portar el Diario de `koinos-showcase.jsx`.
- Tabla `diario_tareas` privada del usuario.
- Se autoborran al marcarse completadas.

## 7. Decisiones cerradas (2026-04-20)

- **D1 · Marca**: todo bajo **Demos iOS**. KOINOS se absorbe como dos módulos — **FEED** y **TOUCH** — dentro del OS cívico. La marca KOINOS desaparece del producto final; sus ideas sobreviven como las dos capas sociales.
- **D2 · FEED y Ágora coexisten**: Ágora es la versión cívica-seria (foro estructurado por sección PHAROS). FEED es el trípode de la parte red-social de KOINOS (microblog con 4 pieles, gestos y AlgoritmoPanel). Inicialmente ambas accesibles a la vez por el mismo usuario — no son excluyentes.
- **D3 · TOUCH**: invite-only estricto con círculos de 3 niveles (íntimo · cercano · conocido). Modelo Vero/Close Friends llevado a límite máximo.
- **D4 · Orden**: Fase 1 = FEED. La Escribanía de Bibliotheka espera.

## 7bis. Historial de alternativas (para trazabilidad)

### D1. Nombre del conjunto

- **A**: todo bajo "Demos iOS by OCRE". KOINOS se renombra a "FEED" y "TOUCH" como módulos. La marca KOINOS desaparece.
- **B**: "Demos iOS by OCRE" contiene un módulo llamado "KOINOS" que agrupa FEED+TOUCH. El logo de KOINOS sobrevive pequeño.
- **C**: marcas paralelas, un Supabase compartido, dos dominios. `demosios.eu` y `koinos.app`.

Mi recomendación: **A**. Un solo nombre fuerte, los módulos se reconocen como capas.

### D2. ¿FEED absorbe Ágora o coexisten?

- **Coexisten** (mi recomendación): Ágora = foro estructurado por sección PHAROS, con hilos y respuestas largas. FEED = stream rápido de posts individuales. Diferentes gramáticas.
- **FEED absorbe Ágora**: Ágora se vuelve una vista filtrada (FEED con `parent_id IS NULL` y `modo='post_feed'` + filtro por PHAROS). Menos duplicación, más simple.

### D3. Visibilidad de TOUCH

- **Invite-only estricto** (lo que describe KOINOS original): solo miembros de un círculo que tú creas ven tus fotos.
- **Follow-mutuo**: tus fotos las ven quienes te siguen y a los que sigues. Más simple, menos íntimo.

### D4. Orden de fases

- Fase 1 (FEED) antes que Escribanía, o Escribanía primero?
- Mi recomendación: FEED primero. Es la capa que trae al "público social" que queremos atraer. Escribanía entra dentro de Bibliotheka y puede esperar una iteración.

## 8. Riesgos

| Riesgo | Mitigación |
|---|---|
| Fatiga cognitiva al usuario | Home del faro con tres puertas claras + onboarding que explica las capas |
| Dilución de la marca KOINOS | Decisión D1: absorber bajo Demos iOS como capas |
| Carga técnica (tabla `publicaciones` gigante) | Índices por modo, paginación cursor, particionado por año si crece mucho |
| Moderación de FEED abierto | Semáforo híbrido + función SQL que reduce visibilidad a >40% ruido |
| Círculos TOUCH + RLS compleja | Tabla `pertenencia_circulo` con índice, RLS que joinea por `miembro_id = auth.uid()` |

## 9. Tareas creadas en la barra

- #8 — Decidir D1, D2, D3, D4 (4 decisiones estratégicas)
- #9 — Fase 1: traer FEED (tabla `publicaciones` + ruta `/feed` + 4 pieles + compose)
- #10 — Fase 2: traer TOUCH (círculos + foto fullscreen + long-press caption)
- #11 — Fase 3: reacciones y semáforo unificados
- #12 — Fase 4: unificar perfil y reactivar BannerAvatar
