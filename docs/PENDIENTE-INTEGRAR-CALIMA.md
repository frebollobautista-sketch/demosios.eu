# PENDIENTE · Integrar overlay Calima (RIE-05)

Fecha: 2026-05-27
Estado: ficheros creados, **integración manual pendiente** para no tocar
`overlays/index.js` ni `app.js` desde la tarea de generación.

## Ficheros creados

| Path | Rol |
|---|---|
| `public/data/calima-estado.json` | Estado actual del polvo sahariano (placeholder estructural) |
| `scripts/refresh-calima.py` | Pipeline de refresco. Soporta `--source {placeholder,aemet,bdrc,naaps}` y `--simulate {bajo,moderado,alto,muy_alto,extremo}` |
| `public/polis-app/overlays/calima.js` | Overlay que pinta velo translúcido + banner topbar |

## Lo que FALTA hacer (manual, ~3 líneas)

### 1. Registrar el overlay en `overlays/index.js`

```js
import { calimaOverlay } from "./calima.js";
// ... y añadir calimaOverlay al array/registro existente
```

### 2. Activarlo en `app.js`

Igual que se hace con `calidadAireOverlay` / `coberturaOverlay`:
llamar a `calimaOverlay.load()` en el bootstrap y enchufar su `draw()`
en el render loop respetando el orden Z (debería ir **por encima** de
polígonos administrativos pero **por debajo** de pins de calidad-aire
para que los pins sigan legibles sobre el velo).

### 3. (Opcional) Toggle en el menú de capas

`name`: "Calima (polvo sahariano)" — id `"calima"`. Se puede ocultar
manualmente desde el menú de overlays existente.

## Diseño del overlay (resumen)

- **Velo translúcido** sobre las islas listadas en `afecta_islas`, color
  del nivel (verde→amarillo→naranja→rojo→morado), alpha 0.18 → 0.35
  según severidad.
- **Niveles aplicables**: archipiélago, isla, municipio. Por debajo
  (distrito/barrio/sección/manzana) NO se pinta — sería ruido visual.
- **Banner topbar** (`.calima-banner`): aparece automáticamente cuando
  `nivel_actual ∈ {alto, muy_alto, extremo}`. Se crea en
  `document.body` desde `load()`, no requiere cambios a `index.html`.
  Mensaje tipo: `⚠ Calima alta hoy · PM10 ~120 · cerrar ventanas`.

## Fuentes de datos investigadas

| Fuente | Viabilidad | Notas |
|---|---|---|
| **BDRC MONARCH** (`dust.aemet.es`) | Media (preferida) | netCDF 0.1°, 3h, 72h forecast. Endpoint TDS exacto requiere User Guide del portal (no expuesto en HTML público). Permite extraer `sconc_dust` µg/m³ por isla. |
| **AEMET OpenData avisos** (`opendata.aemet.es`) | Alta (más simple) | API REST + API key gratuita. CAP-XML con fenómeno PI (polvo). Sólo da nivel cualitativo, no PM10. |
| **NAAPS NRL** (`nrlmry.navy.mil/aerosol`) | Baja | Sólo PNG, sin endpoint estable. Útil para cross-check visual. |
| **AQICN PM10 proxy** | Baja-Media | Reutilizar `calidad-aire-canarias.json`. Es nowcast, no pronóstico. |

**Recomendación**: empezar por AEMET avisos (más simple, autoritativa
para nivel cualitativo) y enriquecer con BDRC cuando se tenga el
endpoint TDS confirmado.

## Cómo regenerar el placeholder

```bash
python3 /Users/panch/KOINOS-iso/scripts/refresh-calima.py
# o simular un escenario concreto para testear el overlay:
python3 /Users/panch/KOINOS-iso/scripts/refresh-calima.py --simulate alto
python3 /Users/panch/KOINOS-iso/scripts/refresh-calima.py --simulate extremo
```
