# HANDOFF · Chat NAVEGACION

> Brief autocontenido para un chat dedicado a resolver la **navegación
> interactiva a nivel barrio** en POLIS iso. Diseñado para que el
> nuevo chat NO tenga que cargar el contexto entero del chat principal.

## Por qué este chat existe

POLIS iso tiene 4 niveles administrativos drill-down (isla → municipio
→ distrito → sección), pero la **identidad real de la gente está en
el barrio** (Vegueta, La Isleta, Tarahales, Schamann), no en el
distrito administrativo ni en la sección censal INE.

El barrio es la capa donde:
- La gente se reconoce ("yo soy de Tarahales")
- La gamificación inter-barrios tiene sentido (competición amistosa)
- Las "skins" identitarias funcionan (paleta + glifo + carácter por
  barrio)
- El tejido social local agrega de forma significativa

## Estado actual (qué ya funciona)

| Pieza | Status | Ubicación |
|---|---|---|
| `data/barrios-gc.json` LPGC | ✅ 34 barrios · 274/274 secciones | `public/data/` |
| Resto de GC (20 muns) | ❌ pendiente | — |
| `renderBarrio` proxy a `renderDistrito` | ✅ | `polis-app/renderer.js` |
| `enterBarrio(barrioId)` análogo a `enterDistrito` | ✅ | `polis-app/app.js` |
| `?barrio=lpgc-vegueta` deep-link | ✅ | `app.js` URL routing |
| Breadcrumb "Gran Canaria › LPGC › Vegueta" | ✅ | sin distrito intermedio |
| `ENTRY_ZOOM.barrio = 1.8` | ✅ | `iso.js` |
| Overlay `renta` sobre barrios | ✅ verificado Vegueta + La Isleta | `overlays/renta.js` |

## Lo que NO funciona y debe resolverse aquí

### 1. Tap-target municipio → barrio (DECISIÓN UX)

En `handleTap` (`app.js`), a nivel municipio, el tap sobre una sección
dispara `enterDistrito(cusec.slice(2,7))`. Eso lleva por la jerarquía
administrativa.

**Decisión pendiente**:
- (a) Reemplazar por `enterBarrio` cuando el cusec esté mapeado a
  barrio. La jerarquía administrativa queda solo como fallback.
- (b) Toggle UI "vista administrativa / vista identitaria" que cambia
  el comportamiento del tap globalmente.
- (c) Doble tap → barrio, tap simple → distrito (o viceversa).
- (d) Selector flotante que aparece al tap: dos botones "Distrito X"
  / "Barrio Y".

**Recomendación inicial**: (a) — si el cusec está en
`barrios-gc.json`, tap = enterBarrio; si no, fallback a
`enterDistrito`. La jerarquía administrativa NO desaparece pero deja
de ser el camino principal.

### 2. Slide horizontal entre barrios vecinos

Existe `slideToDistritoNeighbor` (`app.js`) que anima el view a un
distrito colindante con `state.district.neighborDistricts`. Replicar
para barrios:
- Computar `barrio.neighborBarrios` al cargar el barrio (intersección
  de bboxes o por compartir secciones-borde).
- `slideToBarrioNeighbor(barrioVecino, tapX)` análogo.
- Botones `‹ ›` laterales o swipe táctil para navegar entre vecinos.

### 3. Datos de barrios para el resto de GC

Solo LPGC tiene barrios curados. Para el resto:

- **Opción A**: extraer de OSM (`place=suburb`, `place=neighbourhood`,
  `place=quarter`) y mapear a secciones por point-in-polygon.
- **Opción B**: usar anchors locales (PNOA, callejero municipal) con
  un script tipo `tools/build-barrios-gc.py` (que probablemente
  existe ya, hay que verificar).
- **Opción C**: dejar el resto de GC SIN barrios y mantener su flow
  administrativo. Solo LPGC tendría la doble jerarquía. Pragmático
  para v1.

**Recomendación**: empezar por Opción C para validar la UX; meterle
Opción A para los 4-5 muns más poblados (Telde, S.B.Tirajana, Santa
Lucía, Arucas) en v2.

### 4. Otros overlays sobre barrio

Solo `renta` sabe pintar a nivel `barrio`. El resto (`vv`, `guaguas`,
`parques`, `educacion`, `lista-espera`, `cobertura`, `eventos`,
`productores`, `tejido-social`) hay que actualizar:

- Añadir `"barrio"` a `META.<id>.levels` en `overlays/index.js`
- En `<overlay>.draw(ctx, state, view)`, manejar `state.lodLevel === "barrio"`
  igual que se maneja `"distrito"` — leer `state.barrio.bbox` para
  filtrar puntos.

Es trabajo repetitivo pero mecánico. Paralelizable con sub-agentes.

### 5. Skins por barrio (visión amplia, NO blocker)

Cada barrio merecería su carácter visual propio. Trabajo pendiente:

- Añadir campo `skin` a cada entrada de `barrios-gc.json`:
  ```json
  {
    "id": "lpgc-vegueta",
    "nombre": "Vegueta",
    "skin": {
      "paleta": ["#C89968", "#5C3D24", "#E2C99A"],
      "glifo": "⛪",
      "caracter": "patrimonio colonial · piedra azul"
    }
  }
  ```
- En el renderer: si hay skin definido para el barrio activo, override
  de la paleta default por la del barrio.
- Pieces narrativos (chascarrillo de barrio) en popup-barrio análogo
  al popup-municipio.

### 6. Nivel `archipielago` como grid de 7 (NO geografía real)

El nivel raíz `archipielago` carga las 7 islas (`state.archipielago.islands`)
y el render funciona, pero las pinta en **proporción geográfica real**
sobre el bbox del archipiélago (~500km este-oeste). Resultado: islas
minúsculas y agrupadas en una franja central de la pantalla, sin
identidad visual propia. Etiquetas legibles pero los polígonos casi
imperceptibles.

**Lo que Pancho pidió**: vista **tablero-grid** estilo selector de
niveles Into the Breach. Las 7 islas dispuestas como tiles uniformes
(4×2 con un slot vacío, o 3+4 escalonado), cada una con tamaño legible
fijo, NO en su posición geográfica real. La identidad cultural por
isla es lo importante, no la métrica de distancia entre ellas.

**Trabajo concreto**:
- En `renderer.js`, branch `state.lodLevel === "archipielago"`: en lugar
  de proyectar `_ringSimple` directamente, **trasladar cada isla a una
  posición de grid** y reescalarla a un tamaño común (p.ej. cada tile
  200×200px en pantalla).
- Mantener la silueta real de cada isla (no la sustituyas por
  rectángulos) — el aire de Into the Breach es "silueta + tile".
- Etiquetas centradas debajo de cada tile.
- Tap en isla → `enterIsla(islaId)` como ya funciona.
- Opcional v2: skin por isla (paleta + glifo identitario).

**Orden visual sugerido** (norte-sur + este-oeste agrupado):
```
[ La Palma ]  [ Tenerife ]  [ Gran Canaria ]  [ Lanzarote ]
[ La Gomera ] [ El Hierro ] [               ] [ Fuerteventura ]
```

## Cuellos de botella conocidos

- **DISTRITO_NICKS en `app.js:998-1004` etiqueta distritos LPGC con
  barrios que no coinciden con la geometría real INE** (La Isleta en
  distrito 03 no 02; Tafira en 05; Jinámar en 01 no 05). Al integrar
  navegación a barrio, eliminar `DISTRITO_NICKS` o sincronizarlo con
  `barrios-gc.json`.
- **Banner duplicado** y **breadcrumb truncado** cuando hay barrio
  largo + 3 niveles. Pulir CSS y/o consolidar `dist-label` y
  `barrio-label` en un solo elemento.

## Cómo arrancar el chat NAVEGACION

```
1. Lee este archivo entero (docs/HANDOFF-NAVEGACION.md).
2. Lee /Users/panch/KOINOS-iso/POLIS-ISO-STATE.md secciones:
   - "Decisión conceptual mayor — Jerarquía identitaria"
   - "Estado del soporte de barrios"
3. Lee /Users/panch/KOINOS-iso/public/data/barrios-gc.json para
   entender el shape de datos.
4. Lee /Users/panch/KOINOS-iso/public/polis-app/app.js secciones
   `enterBarrio`, `handleTap`, `slideToDistritoNeighbor` para
   entender los patrones a replicar.
5. Pregunta a Pancho la decisión UX del punto 1 (tap-target) antes
   de tocar código.
6. Foco primario: resolver el tap-target. Lo demás (slide vecinos,
   datos resto GC, skins) en iteraciones posteriores.
```

## Archivos clave

```
public/data/
├── barrios-gc.json          # 34 barrios LPGC, mapa barrio→[cusecs]
public/polis-app/
├── app.js                   # enterBarrio, handleTap, slideToBarrioNeighbor (TBD)
├── renderer.js              # renderBarrio (proxy a renderDistrito)
├── iso.js                   # ENTRY_ZOOM.barrio = 1.8
└── overlays/
    └── renta.js             # ÚNICO overlay con soporte barrio actualmente
```

## NO cambiar

- La jerarquía administrativa (isla/mun/distrito/sección) sigue
  existiendo y los datos siguen indexados por cusec. Solo se añade
  el barrio como vía paralela.
- La política editorial (`docs/CURATION-POLICY.md`) — invisibilizar
  franquicias y capital externo.
- La estética Into the Breach.

— Brief preparado para chat NAVEGACION · 2026-05-13
