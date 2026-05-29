# HANDOFF · POLIS iso (entry point)

> **Si eres un chat nuevo trabajando en POLIS, lee este archivo
> primero.** Aquí está el mapa comprimido del proyecto: qué es, qué
> existe, qué está pendiente y dónde buscar el detalle.
>
> Diseñado para no inflar el contexto del chat — apuntas a los docs
> específicos según necesites.

## Qué es POLIS iso

Visor isométrico vanilla JS + Canvas2D de Gran Canaria, alojado en
`/Users/panch/KOINOS-iso/public/polis-app/`. Drill-down isla →
municipio → distrito → sección (+ barrio identitario en paralelo).

Pieza hermana: visor canónico MapLibre en
`/Users/panch/KOINOS/public/polis-provincia.html` (referencia para
portar capas cívicas; no se modifica desde el iso).

Otra pieza hermana: backend Next.js + Supabase (en otro chat) —
provee identidad, persistencia, moderación. Hooks de integración
listos en el iso vía `window.polisApp.setIndicators / setLayer`.

## Localización

- **Worktree iso**: `/Users/panch/KOINOS-iso/` rama `polis-app-runtime`
- **Repo main**: `/Users/panch/KOINOS/` rama `main`
- **Server preview**: `preview_start({ name: "polis-iso" })` → http://127.0.0.1:8123/polis-app/

## Mapa de documentos

| Doc | Contenido | Cuándo leerlo |
|---|---|---|
| [`POLIS-ISO-STATE.md`](../POLIS-ISO-STATE.md) | Estado de trabajo. Inventario de capas, gaps, decisiones arquitecturales, bugs pendientes. | **SIEMPRE primero**. ~5 min. |
| [`docs/CURATION-POLICY.md`](CURATION-POLICY.md) | Política editorial: qué entra y qué se invisibiliza (franquicias, capital externo, controvertidos). | Antes de añadir contenido nuevo. |
| [`docs/ADMIN-PROTOCOL.md`](ADMIN-PROTOCOL.md) | Sistema de moderación doble capa (anónimo público / nominal admin). | Si tocas gestos / moderación. |
| [`docs/CULTURAL-CONTENT-FORMAT.md`](CULTURAL-CONTENT-FORMAT.md) | Schema de geojsons (eventos, productores, tejido). Receta para añadir capa nueva. | Si añades nuevo dataset cultural. |
| [`docs/HANDOFF-NAVEGACION.md`](HANDOFF-NAVEGACION.md) | Brief específico para resolver navegación interactiva a barrios (delegado a chat NAVEGACION). | Si trabajas navegación nivel barrio. |
| [`docs/AGENDA-INTERACCIONES.md`](AGENDA-INTERACCIONES.md) | Banco de ideas de interacciones agenda cultural/social. Inspiración no plan. | Si exploras visión a medio plazo. |
| [`docs/GESTO-CATALOG.md`](GESTO-CATALOG.md) | Catálogo expandido de gestos cívicos + matriz declarativa gesto × sujeto. Borrador previo a implementación. | Antes de tocar `gestos.js` o popups de entidad. |

## Arquitectura comprimida

```
public/polis-app/
├── index.html         Markup: canvas + tablero + búsqueda + popups
├── style.css          Estética Into the Breach (paper+ink, sin gradientes)
├── app.js             Orquestador: URL routing, state, handleTap, popups
├── renderer.js        render(ctx, state) → renderIsla/Mun/Distrito/Barrio/Sección
├── iso.js             Proyección unificada continua (v1.6) + fitView
├── archetypes.js      Catálogo de piezas para edificios
├── clustering.js      Painter's algorithm
├── interaction.js     Pan/zoom/tap/swipe
├── dashboard.js       Tablero cívico (4 ámbitos de derecho fundamental)
├── gestos.js          Sistema unificado: señales, reportes, compromisos, registros
├── search.js          Buscador transversal + callejero OSM
└── overlays/
    ├── index.js       Registry. OVERLAYS[] + META + drawActiveOverlays()
    ├── renta.js       Coropleta cuantil — único que sabe barrio
    ├── vv.js          Viviendas vacacionales
    ├── guaguas.js     Paradas + líneas LPGC
    ├── cobertura.js   Buffer 300m
    ├── parques.js     6 buckets espacios verdes
    ├── educacion.js   Centros por titularidad
    ├── lista-espera.js Hospitales SCS
    ├── eventos.js     Eventos culturales (cultura.grancanaria.com)
    ├── productores.js Productores artesanos curados
    └── tejido-social.js Cooperativas, asociaciones, espacios autogestionados
```

## Estado de feature flags (a fecha 2026-05-13)

| Feature | Status |
|---|---|
| 4 niveles drill-down isla→mun→distrito→sección | ✅ |
| Nivel **barrio** identitario | ✅ render + URL · ❌ tap-target (ver HANDOFF-NAVEGACION) |
| 9 capas cívicas portadas | ✅ |
| Tablero cívico (4 ámbitos derecho fundamental) | ✅ |
| Sistema de gestos (señal/reporte/compromiso/registro_entidad) | ✅ |
| Doble capa anónimo/admin con moderación | ✅ |
| Buscador transversal + callejero (10k+ calles) | ✅ |
| Responsive móvil con bottom sheet | ✅ |
| Eventos culturales reales del Cabildo | ✅ 10 ítems |
| Productores artesanos curados | ✅ 16 ítems |
| Tejido social curado | ✅ 15 ítems |
| WMS bloqueadas (BIC, salud, aire) | ❌ |
| Backend persistencia | ❌ delegado a chat Next.js+Supabase |
| Skins por barrio | ❌ visión, no implementado |
| Slide entre barrios vecinos | ❌ pendiente NAVEGACION |
| Datos barrios fuera de LPGC | ❌ pendiente NAVEGACION |

## API pública del runtime

```js
// Indicadores reactivos (HUD). Inyectados por capa cívica externa.
window.polisApp.setIndicators({ zone, user, realtime })
window.polisApp.getIndicators()

// Overlays
window.polisApp.setLayer(id, on)

// Popups
window.polisApp.openMunicipioPopup(munCode)
window.polisApp.openEventoPopup(evt)
window.polisApp.openProductorPopup(prod)
window.polisApp.openTejidoPopup(item)
window.polisApp.openCompromisoPopup(ambito)
window.polisApp.openReportePopup(ambito)
window.polisApp.openRegistroPopup()
window.polisApp.openSearch()

// Gestos
window.polisApp.getUserId()
window.polisApp.getGestos()  // cola pendiente de sync con backend

// Tablero
window.polisApp.refreshDashboard()

// Admin (requiere modo activado con Cmd/Ctrl+Shift+A + passphrase)
window.polisApp.isAdmin()
window.polisApp.getRegistroDetallado({tipo?, ambito?, zona?})
window.polisApp.marcarFalso(gestoTs, motivo)
window.polisApp.amonestar(uid, motivo)

// Debug (sólo lectura recomendada)
window.polisApp.state
```

## Cómo arrancar un chat nuevo

1. Lee este `HANDOFF.md` entero. (~3 min)
2. Lee `POLIS-ISO-STATE.md` entero. (~5 min)
3. Si el ámbito es **navegación a barrios** → lee también
   `HANDOFF-NAVEGACION.md`.
4. Si el ámbito es **nuevo contenido** (más capas, más datos
   culturales) → lee `CULTURAL-CONTENT-FORMAT.md` y
   `CURATION-POLICY.md`.
5. Si el ámbito es **moderación / privacidad** → lee
   `ADMIN-PROTOCOL.md`.
6. Pregunta al usuario antes de tocar lógica establecida — las
   decisiones de diseño documentadas aquí están validadas.

## Decisiones políticas no negociables (sin re-discutir)

- **Identidad por distrito / barrio**, NO por sección censal.
- **Anonimato por defecto** en señal/reporte; identidad voluntaria en
  compromiso/registro.
- **Invisibilizar franquicias** y capital externo (ver CURATION-POLICY).
- **Tejido social prioritario** en buscador (typeBonus +6).
- **Web 3.0 framing**: gestos cívicos componibles, identidad estable
  vía pseudónimo, validadores externos (URL/NIF/registro).
- **Estética Into the Breach**: paper #F5E8C8, ink #1A1612, sombras
  4-8px planas, sin gradientes. Tipografía Georgia.

## Pendientes prioritarios

1. **Navegación interactiva a barrio** → chat **NAVEGACION**
2. **Backend Supabase** → chat **Next.js**
3. WMS scrape (BIC, salud, aire) — bajo prioridad

## Migración de contexto

Este doc + `POLIS-ISO-STATE.md` + los handoffs específicos comprimen
~30 chats de contexto en algo legible en 10 minutos. Si descubres una
decisión nueva que merezca persistir, añádela aquí (o crea un
`HANDOFF-<TEMA>.md`).

— Pancho · 2026-05-13
