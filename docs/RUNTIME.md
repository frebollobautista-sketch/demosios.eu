# KOINOS · POLIS — Runtime web v0.4 (jerárquico, 4 niveles)

Implementación del **motor isométrico** del data pack v1 con navegación
jerárquica de **cuatro niveles** (isla → municipio → distrito → sección)
directamente en el navegador. HTML + Canvas2D + ES modules. Cero build
step.

> v1.5 introduce el nivel intermedio **distrito** (cusec dígitos 6-7) y
> aplana isla y municipio a vista top-down (mapa). Sólo distrito y
> sección usan iso completa 30°/30°.

## Arrancar

```bash
cd ~/KOINOS/public
python3 -m http.server 8080
# abrir: http://localhost:8080/polis-app/
```

Sin parámetros la app arranca en la **vista isla** con los 21 municipios
de Gran Canaria. Para saltar directamente a un nivel concreto:

```
http://localhost:8080/polis-app/                                # nivel isla (default)
http://localhost:8080/polis-app/?mun=016                        # nivel municipio LPGC
http://localhost:8080/polis-app/?level=distrito&distrito_id=01602  # nivel distrito 02 LPGC
http://localhost:8080/polis-app/?cusec=3501602052               # nivel sección (carga mun+dist+sec)
```

## Navegación

```
Gran Canaria (isla)
  └── tap municipio → Municipio
                       └── tap sección → Distrito (todas las secciones del distrito)
                                          └── tap sección → Sección (manzanas + edificios)
```

- **Tap** en una pieza entra al siguiente nivel. v1.5: tap en una
  sección del nivel **municipio** entra a su **distrito** (no salta
  directo a sección).
- **Breadcrumb** arriba a la izquierda permite saltar a cualquier nivel
  anterior con un click. Formato:
  `Gran Canaria › LPGC › Distrito 02 › Sección 052`.
- **Botón flotante "←"** (`#back-btn` en index.html) retrocede un nivel
  cada pulsación; oculto en isla (raíz). Equivale a disparar
  `window.history.back()` cuando hay historial, con fallback a
  `navigateBack()`: sección → distrito → municipio → isla.
- **Botón Atrás del navegador / gesto deslizar de iOS**: gestionados
  mediante `history.pushState` + listener `popstate`. Cada nivel
  (`enterIsla` / `enterMunicipio` / `enterDistrito` / `enterSeccion`)
  empuja una entrada con state
  `{ lodLevel, mun, distritoId, cusec }`. El listener reproduce el
  nivel guardado y bloquea el siguiente push con la guarda
  `state._navigatingFromPop`.
- **Animación**: zoom + interpolación de ángulos (ax/ay/sz_factor) de
  500 ms `ease-in-out` antes de cambiar de nivel — la cámara "rota"
  desde top-down plano (isla, municipio) hasta iso 30°/30° (distrito,
  sección).
- **Viewport stack (v1.5.1)**: cada vez que el usuario hace navegación
  forward (isla→mun, mun→distrito, distrito→sección) guardamos un
  snapshot del viewport del nivel padre en `state.viewportStack`
  (clave = lodLevel del padre, valor = `{ view: {scale, cx, cy, tx,
  ty, ax, ay, sz_factor, minScale, maxScale, fitScale} }`). Al hacer
  back desde el nivel hijo, `navigateBack()` y el handler de
  `popstate` consumen ese snapshot (`consumeViewportFor(level)`) y lo
  pasan como `restoreView` a `enterIsla` / `enterMunicipio` /
  `enterDistrito`. El nuevo view se compone con `mergeRestoredView`:
  hereda `minScale/maxScale/fitScale` del `fitView` fresco (por si la
  ventana se redimensionó) pero usa `scale + pan + ángulos` del
  snapshot, y se anima con la misma curva 500 ms `ease-in-out` que la
  forward. Resultado: el back es el inverso visual exacto de la
  forward — vuelta al pan + zoom originales — y desaparece el "salto"
  que antes producía `fitView` al hacer back. Si no hay snapshot
  (deep link, primer arranque, viewport ya consumido) se cae al
  `fitView` del nivel como fallback. La heurística
  `isBackNavigation(from, to)` usa `LEVEL_DEPTH` (`isla=0`,
  `municipio=1`, `distrito=2`, `seccion=3`) para distinguir back de
  forward en `popstate`.
- **Navegación lateral entre distritos** (sólo nivel distrito): dos
  botones flotantes `‹` y `›` en los bordes laterales (clase
  `.dist-side-btn`) saltan al distrito anterior/siguiente del mismo
  municipio cíclicamente (01 → 02 → 03 → 04 → 05 → 01). Animación
  slide horizontal 600 ms ease-in-out (300 ms salida + 300 ms entrada).
  En móvil el mismo gesto se dispara con swipe horizontal del canvas
  (≥60 px X, <40 px Y, <600 ms) — implementado en
  `interaction.js#touchend` y delegado a `handleSwipe(dx)` en `app.js`.
- **Tap vecino → slide lateral (v1.5.2)**: en los niveles municipio,
  distrito y sección, alrededor del contenido activo se renderizan las
  piezas colindantes (otros muns / distritos / secciones) en color
  desaturado y con stroke fino — ver §Vecinos colindantes en
  `STYLE_GUIDE.md`. Un tap sobre una pieza vecina dispara
  `enterMunicipio/Distrito/Seccion` del vecino con la misma animación
  slide horizontal del bullet anterior. La duración por defecto es
  600 ms para municipio y distrito y 400 ms para sección. La dirección
  (`dir = +1` o `-1`) se decide según en qué mitad del viewport quedó
  el tap: derecha → contenido sale a la izquierda; izquierda → sale a
  la derecha. Detección de adyacencia: bbox+centroide para muns;
  pertenencia al mismo padre administrativo para distritos y secciones.
- **URL deep-link**: el primer arranque hace `replaceState`; cada
  navegación posterior hace `pushState`. Formatos URL:
  `?mun=016`, `?level=distrito&distrito_id=01602`,
  `?cusec=3501602052` (este último expande a municipio+distrito+sección
  en cascada al arrancar).

Cualquier `cusec` que tenga su carpeta en `public/sections_pack/<cusec>/`
funciona — la app lee el pack tal cual está, sin transformación previa.
Las **562 secciones GC v1.4** están en el manifest (3 secciones más
respecto a v1.3 tras el rescate con `buffer(0)`).

## Estructura

```
public/polis-app/
├── index.html       Markup + canvas + breadcrumb + side-panel + HUD + zoom bar +
│                    botones laterales ‹ › + dist-label (distrito)
├── style.css        Paleta KOINOS, layout, breadcrumb (fixed positions),
│                    .dist-side-btn / .dist-label
├── app.js           Orquestador: estados isla/municipio/distrito/sección,
│                    transiciones, URL-routing, eventos UI, slide horizontal
├── iso.js           Proyección parametrizable (modo plano + iso),
│                    fitView, point-in-polygon, lnglatToLocalMeters
├── renderer.js      Despachador render(ctx, state) →
│                    renderIsla/Municipio/Distrito/Seccion
├── archetypes.js    Lee catalog/archetypes.json, classify(), drawArchetype()
├── clustering.js    simplifyRing (Douglas-Peucker), outerRing, painter's depth
└── interaction.js   Pan/zoom (mouse + touch), tap, swipe horizontal,
                     botones de zoom
```

Total: ~1.900 LOC tras v1.5 (+450 sobre v1.4).

## Niveles y datos

| Nivel       | Datos cargados                                | Piezas    |
|-------------|-----------------------------------------------|-----------|
| isla        | `gc-municipios-poly.json` (~382 KB)           | 21 muns   |
| municipio   | `gc-secciones-lite.json` + `manifest.json`    | 1–79 secs |
| distrito    | N × `sections_pack/<cusec>/*.geojson`         | 30–79 secs + ~1k–8k edif |
| sección     | `sections_pack/<cusec>/*.geojson`             | manzanas + edif |

La carga es **lazy**: cada nivel solo descarga lo suyo. Isla y
manifest.json se mantienen en memoria una vez cargados, así que volver
a vista isla es instantáneo. Reentrar a un mun ya visitado *sí* recarga
sus secciones (no hay cache de mun por ahora). El nivel **distrito**
descarga las N secciones del distrito en paralelo y reproyecta cada una
desde su anchor `meta.enu_basis` al anchor común GC para integrarlas en
el mismo "mundo" 2D que isla y municipio.

Ver `docs/STYLE_GUIDE.md` para la spec visual de los cuatro niveles.

## Cómo añadir una sección

1. Verifica que `public/sections_pack/<cusec>/` existe (ya están las 274 LPGC).
2. Visita `?cusec=<cusec>`.
3. La app carga `meta.json`, `manzanas.geojson`, `buildings.geojson`,
   `roads.geojson`, `pois.geojson` en paralelo, ajusta el view al bbox
   y arranca el render loop.

## LOD y umbral

Hay dos sistemas de LOD anidados:

1. **LOD jerárquico** (entre niveles, gestionado por `state.lodLevel`):
   isla / municipio / distrito / sección. Cambia con tap o breadcrumb.
2. **LOD interno** dentro de los niveles distrito y sección.

### LOD interno en sección
- **Zoom out** (default al entrar): manzanas como tiles iso unificados
  (vista de bloques). Threshold relativo: `scale < 1.6 × fitScale`.
- **Zoom in**: edificios individuales con archetipos del catálogo.
  Threshold: `scale > 1.6 × fitScale`.
- **Cross-fade**: ±40% alrededor del threshold ambos LODs se
  renderizan con alpha interpolada para evitar el salto duro.

Helper `computeLodBlend(view)` en `renderer.js` devuelve `{ mode, t }`
donde `t ∈ [0,1]` interpola entre vista de manzana (t=0) y vista de
edificios (t=1).

### LOD interno en distrito (v1.5.2 — TRIPLE)
- **Paso 1 — entry zoom** (`scale ≤ 2.2 × fitScale`, default al
  entrar): regiones-sección coloreadas por densidad de edificios
  (paleta cálida 3 niveles). En distrito 02 LPGC el usuario ve 58
  polígonos legibles, no 1.700 manzanas pequeñas.
- **Paso 2 — mid zoom** (`2.2× < scale ≤ 4.0×`): cross-fade entre
  regiones-sección y manzanas-tile (`OCRE`). Las secciones quedan como
  contorno fino. Calles del distrito aparecen progresivamente.
- **Paso 3 — high zoom** (`scale > 4.0×`): cross-fade entre
  manzanas-tile y edificios-arquetipo individuales con catálogo.
- **Cross-fades**: ventana ±0.35 alrededor de cada threshold (≈300 ms
  percibidos a velocidad de zoom de rueda normal en MacBook).
- **Zoom de entrada (v1.5.2)**: `fitView` aplica un multiplicador
  `entryZoom = 1.45×` al nivel distrito. Esto hace que el bbox ocupe
  ~70-80 % del viewport (vs 50 % con `fitScale` exacto), las 58
  secciones ocupan ~80-200 px de ancho mínimo y se leen como piezas
  grandes en lugar de puntos. El `fitScale` se conserva como
  referencia para los thresholds LOD (no se reescala), así que la
  ratio efectiva al entrar es 1.45 — claramente dentro de Paso 1 puro.

Helper `computeLodBlendDistrito(view)` en `renderer.js` devuelve
`{ alpha1, alpha2, alpha3, ratio }` con los pesos para componer los
tres pasos del distrito.

## Limitaciones conocidas (v0)

- **Solo dos LODs.** No hay nivel intermedio "bloque" (clustering por
  adyacencia), aunque está descrito en `bloque_clustering.py` y previsto
  en el data pack v2.
- **Sin carga progresiva.** Una sola sección a la vez. No hay tiles ni
  precarga de vecinas; cambiar `?cusec=` recarga la página entera.
- **Eventos hardcoded.** La card Songkick está fijada a la manzana 24
  con texto literal. No hay capa `events.geojson` en el pack todavía.
- **POIs no se dibujan.** Solo se cuentan por manzana para el panel lateral.
- **Clipping naive.** Las calles se dibujan completas sin clip al viewport;
  con muchas líneas grandes podría notarse.
- **Cache mínima.** Re-proyectamos los rings en cada frame (al pan/zoom).
  Para ~52 manzanas + 361 edificios va sobrado en MacBook moderno; con
  varias secciones simultáneas habría que cachear top/bot por feature.

## Integración con la capa cívica (v1.5.3)

El runtime web es un visor neutro: no conoce el estado real de cada
edificio (descubierto / identificado / calibrado / etc). Ese modelo
vive en Supabase y está siendo cerrado en el "chat polis" — el
componente Next.js `src/app/feed/page.tsx` y tablas
`polis_zones` / `polis_buildings` / `polis_user_progress`. Para no
acoplar la app web a esa decisión, el runtime expone un único punto
de inyección y consume desde ahí:

### Contrato `state.indicators`

```js
state.indicators = {
  zone: {
    discovered_pct:  0,    // %
    identified_pct:  0,    // %
    calibrated_pct:  0,    // %
    total_buildings: 0
  },
  user: {
    badges_count:        0,
    materials_found:     0,
    last_calibration_at: null   // ISO string o null
  },
  realtime: {
    events_live:          0,
    registered_residents: 0
  }
};
```

Cualquier campo a 0 / null muestra placeholder neutro (`"--"`) en el
HUD. El runtime nunca sobreescribe estos valores — sólo el código
externo los modifica.

### API pública

`window.polisApp.setIndicators(partial)` — hace deep-merge de
`partial` sobre las tres ramas (`zone`, `user`, `realtime`) y dispara
un repaint. Sólo escribe los campos presentes, así que llamadas
parciales (sólo `zone`, sólo `realtime`) son seguras.

`window.polisApp.getIndicators()` — snapshot inmutable (clon JSON) del
state actual; útil para debugging.

### Snippet de uso desde Next.js

```tsx
// src/app/polis-app-host/page.tsx (boceto)
"use client";
import { useEffect, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function PolisHost() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const supabase = createBrowserClient(/* env vars */);
    const channel = supabase
      .channel("polis_zone_02_lpgc")
      .on("postgres_changes",
          { event: "*", schema: "public", table: "polis_zones",
            filter: "distrito_id=eq.01602" },
          (payload) => {
            const zone = payload.new;
            iframeRef.current?.contentWindow?.polisApp?.setIndicators({
              zone: {
                discovered_pct:  zone.discovered_pct,
                identified_pct:  zone.identified_pct,
                calibrated_pct:  zone.calibrated_pct,
                total_buildings: zone.total_buildings
              }
            });
          })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  return <iframe ref={iframeRef} src="/polis-app/" className="w-full h-screen" />;
}
```

Si en el futuro el runtime se sirve embebido (no en iframe), se llama
directamente: `window.polisApp.setIndicators({...})`.

### Prueba de humo

Con la app abierta, en la consola del navegador:

```js
window.polisApp.setIndicators({
  zone:     { discovered_pct: 47, calibrated_pct: 12 },
  realtime: { events_live: 8, registered_residents: 156 }
});
```

El HUD debe actualizarse al instante (sin recargar).

## Próximos pasos

- **Web Worker** para descargar el preprocesado pesado (clustering por
  adyacencia, point-in-polygon de POIs) fuera del thread principal.
- **IndexedDB** como caché del data pack ya parseado: la segunda vista
  arrancaría instantánea.
- **Carga vecinos**: detectar bbox del view y precargar packs de
  secciones adyacentes con `manifest.json`.
- **Capa de eventos** (`events.geojson` en el pack v2) que reemplace la
  card hardcoded con datos reales.
- **Integración Supabase**: usuario logueado, decisiones cívicas,
  estado de "recuperado vs bloqueado" persistido por sección.
