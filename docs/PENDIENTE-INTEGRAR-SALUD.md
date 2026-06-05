# PENDIENTE-INTEGRAR-SALUD.md

Indicador **SAL-01 — Centros de Atención Primaria del SCS con horarios y
especialidades**. Capa lista pero NO enchufada al runtime — esta nota
describe los 4 cambios necesarios para conectarla.

Generado 2026-05-27.

## Estado actual

- Script extractor: `/Users/panch/KOINOS-iso/scripts/extract-centros-salud.py`
- Dataset: `/Users/panch/KOINOS-iso/public/data/centros-salud-canarias.geojson`
  - 723 features (335 AP, 90 hospitales, 57 urgencias, 45 consultorios, 197 especializados)
  - Fuente: OSM PBF Geofabrik (SCS no expone dataset abierto accesible — 404)
  - Para regenerar: `python3 scripts/extract-centros-salud.py` desde root del repo
- Overlay: `/Users/panch/KOINOS-iso/public/polis-app/overlays/centros-salud.js`
  - Export: `centrosSaludOverlay`
  - `id: "centros-salud"`
  - API completa (load/isReady/draw/hitTest/getSubcatOptions/setSubcatFilter)

## Integración (cuando estés listo)

### 1. `public/polis-app/overlays/index.js`

Añadir el import al bloque superior:

```js
import { centrosSaludOverlay } from "./centros-salud.js";
```

Añadir el overlay al array `OVERLAYS` — sugerencia: justo después de
`listaEsperaOverlay` para mantener juntas las dos capas SCS:

```js
listaEsperaOverlay,
centrosSaludOverlay,   // SAL-01 · red física AP/CSO/Hosp/Urg/Esp
```

Añadir metadata en `META`:

```js
"centros-salud": {
  category: "equipamientos",
  levels:   ["isla", "municipio", "distrito", "barrio", "seccion"],
  subcategorias: true,   // opt-in para los 5 sub-chips por tipo
},
```

> Nota: alternativamente puede ir en categoría `desigualdades` junto a
> lista-espera. Decisión de UX — recomiendo `equipamientos` porque
> conceptualmente es infraestructura física (como `educacion`), no un
> indicador de desigualdad por sí mismo.

### 2. `public/polis-app/app.js` (si aplica)

NO requiere cambios si todos los overlays se descubren vía `OVERLAYS`
en `overlays/index.js`. Si app.js mantiene una lista hardcoded de IDs
para hit-testing en el inspector, añadir `"centros-salud"` a esa lista.

### 3. Verificación visual

Tras la integración:

1. `npm run dev` (o el comando del servidor estático del visor iso).
2. Abrir el panel de capas — debería aparecer
   "Centros de salud (SAL-01)" bajo "Equipamientos".
3. Activar el toggle → pins AP (verde-azulado) en municipio.
4. Probar sub-chips (5 tipos) — los pins deberían filtrarse en vivo.
5. Drill-down isla → municipio → distrito → barrio → sección: los
   datos deberían persistir y reescalarse correctamente.

### 4. Tests opcionales

- `centrosSaludOverlay.hitTest(px, py, state, view)` ya implementado —
  el inspector global puede usarlo igual que con productores/eventos.
- Filtros: `setPublicoFilter("publico" | "privado" | null)` — UI no
  conectada todavía, pero la API existe para una futura iteración.

## Caveats

- **OSM cobertura**: la cobertura sanitaria pública en OSM Canarias es
  buena pero no exhaustiva. Si en el futuro el SCS publica un dataset
  oficial, el script extractor debería sustituirse por un fetch directo.
- **Horarios**: pocos centros traen `opening_hours` en OSM (~5-10%).
  Los nombres de tipo "Centro de Salud X" suelen seguir el horario
  estándar del SCS (L-V 08:00-15:00) pero NO lo asumimos en la data.
- **Especialidades**: solo se extraen las explícitas en `healthcare:speciality`.
  La mayoría de centros AP del SCS no la tagean, así que el array suele
  venir vacío. Está bien para la v0 — basta con tipo + ubicación + horario
  cuando exista.
- **Categoría AP vs especializado**: cuando OSM marca `amenity=clinic` o
  `amenity=doctors` sin `operator` que aclare público/privado, lo asumimos
  AP (centro de atención primaria genérico). Las clínicas privadas tipo
  Hospiten/Vithas se detectan por nombre/operator y se marcan
  `publico: false`. Una iteración futura podría cross-referenciar con un
  listado oficial del SCS para etiquetar con más precisión.
