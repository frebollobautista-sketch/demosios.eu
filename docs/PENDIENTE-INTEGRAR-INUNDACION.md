# PENDIENTE · Integrar overlay Zonas Inundables (RIE-01)

Fecha: 2026-05-27
Estado: ficheros creados y datos extraídos, **integración manual
pendiente** para no tocar `overlays/index.js` ni `app.js` desde la
tarea de generación.

## Ficheros creados

| Path | Rol |
|---|---|
| `scripts/extract-zonas-inundables.py` | Pipeline de extracción ARPSI → GeoJSON buffer |
| `public/data/zonas-inundables-canarias.geojson` | 180 polígonos (34 fluviales + 146 costeras) · 165 KB |
| `public/polis-app/overlays/inundacion.js` | Overlay translúcido azul + leyenda flotante |

## Fuente de datos

**PEINCA · ARPSI Canarias** — Plan Especial de Protección Civil y
Atención de Emergencias por Riesgo de Inundaciones (Gob. Canarias,
Decreto 115/2018, actualizado dic-2024).

- URL canónica (CKAN SITCAN): https://opendata.sitcan.es/dataset/peinca
- Distribución descargada: `arpsi.gpkg` (675 KB, GeoPackage SQLite)
- CRS origen: EPSG:32628 (ETRS89 / UTM 28N)
- 180 features `MULTILINESTRING` cubriendo las 7 demarcaciones:
  Gran Canaria (42), Tenerife (43), Lanzarote (35), Fuerteventura (34),
  La Palma (12), La Gomera (7), El Hierro (7).
- Tipologías: 34 ARPSI fluviales (84.0 km) + 146 costeras (219.8 km).

### Por qué NO SNCZI estatal

El SNCZI (MITECO) publica WMS de polígonos T10/T100/T500/DPH para la
España peninsular y Baleares. **Para Canarias no hay WFS abierto ni SHP
descargables** equivalentes — la cartografía oficial canaria se gestiona
autonómicamente y se publica como ARPSI lineal (cauce + frente costero)
vía SITCAN. El SNCZI WMS funcionaría para tiles pero no encaja en el
visor Canvas 2D (necesitamos vectores).

### Por qué buffers en vez de polígonos T10/T100/T500

ARPSI describe tramos (líneas) de cauce/costa identificados como
"riesgo potencial significativo". El extractor genera polígonos
visualizables aplicando buffer:

- **Fluvial**: 50 m a cada lado del eje del barranco (aprox. llanura
  inundable, equivalente conceptual a T100). Categoría `T100`.
- **Costera**: 100 m a cada lado de la línea costera (cinta de temporal
  marino). Categoría `costera`.

Simplificación Douglas-Peucker 30 m (en UTM) para reducir peso JSON.

La paleta del overlay incluye también `T10`, `T500`, `DPH` previstos
por si en una iter posterior se integran datos SNCZI nacional.

## Lo que FALTA hacer (manual, ~3 líneas)

### 1. Registrar el overlay en `overlays/index.js`

```js
import { inundacionOverlay } from "./inundacion.js";
// ... y añadir inundacionOverlay al array OVERLAYS

// En META:
inundacion: {
  category: "ambiente",
  levels: ["municipio", "distrito", "barrio", "seccion"]
},
```

Orden Z sugerido: pintar **antes** de pins (educación, eventos, etc.)
y **después** de coropletas (renta, paro) — debería ir junto a
`coberturaOverlay` / `parquesOverlay` en el array.

### 2. (Nada que tocar en `app.js`)

El overlay sigue el contrato estándar `load`/`isReady`/`draw`. El boot
y el render loop ya lo gestionarán a través del registry de
`initOverlays(state)`.

## Diseño del overlay (resumen)

- **Niveles**: municipio, distrito, barrio, sección. En isla los tramos
  son demasiado finos para aportar; a nivel manzana la granularidad ya
  es excesiva (los buffers entrarían en edificios concretos cuando el
  mensaje es "este barranco/tramo costero tiene riesgo").
- **Paleta**: azul medio (fluvial, alpha 0.30) + cyan (costera,
  alpha 0.28). T10/T500/DPH preparadas en la paleta.
- **Sin pins, sin labels** — pura capa visual.
- **Leyenda flotante bottom-left** (`#inundacion-legend`) inyectada
  on-demand desde `draw()`. Sólo muestra las categorías efectivamente
  presentes en el dataset. Se oculta al apagar el overlay o al salir
  de los niveles aplicables.

## Cómo regenerar el dataset

```bash
# Necesita /tmp/inund/arpsi.gpkg (descarga del CKAN SITCAN)
curl -L "https://opendata.sitcan.es/dataset/6c822523-3a00-4fdb-a38f-be6b17d3adcc/resource/c8250faf-34f4-4f23-accf-b32c76aa8bb3/download/arpsi.gpkg" \
  -o /tmp/inund/arpsi.gpkg

python3 /Users/panch/KOINOS-iso/scripts/extract-zonas-inundables.py
```

Salida esperada:
```
[arpsi] 180 features leídos
[ok] public/data/zonas-inundables-canarias.geojson — 180 polígonos · 164.9 KB
[stats] {'fluvial': 34, 'costera': 146, 'drop': 0}
```

## Importancia cívica

Este indicador es el que un ciudadano necesita **antes** de comprar o
alquilar vivienda en planta baja o sótano, especialmente en:

- Cauces de barranco en Gran Canaria sur (Maspalomas, Telde, Arguineguín)
  y Las Palmas (Guiniguada, Las Goteras).
- Frente litoral norte de Tenerife (temporales atlánticos), Lanzarote
  norte, Fuerteventura este, y zonas portuarias.

El PEINCA es **el documento oficial autonómico de emergencias** — no es
un proxy ni una estimación: define qué tramos disparan protocolos de
Protección Civil.
