# PENDIENTE · Integrar overlay Memoria democrática (MEM-01)

Fecha: 2026-05-27
Estado: ficheros creados, **integración manual pendiente** para no tocar
`overlays/index.js` ni `app.js` desde la tarea de generación.

Marco legal: **Ley 19/2022 de Memoria Democrática** — obligación de
catalogar lugares de memoria (Art. 51). Este overlay materializa esa
obligación a nivel cívico-visual en POLIS.

## Ficheros creados

| Path | Rol |
|---|---|
| `public/data/memoria-democratica-canarias.geojson` | 16 lugares curados (8 fosas, 5 cárceles, 1 lugar simbólico, 1 monumento, 1 embarque exilio) |
| `scripts/extract-memoria-democratica.py` | Generador del GeoJSON. Datos hardcodeados (no hay JSON oficial nacional descargable a 2026-05-27). Cita por feature. Validador ÉTICA heurístico |
| `public/polis-app/overlays/memoria-democratica.js` | Overlay pin lapidario rojo apagado + badge de víctimas en fosas comunes |

## Lo que FALTA hacer (manual, ~5 líneas)

### 1. Registrar el overlay en `overlays/index.js`

```js
import { memoriaDemocraticaOverlay } from "./memoria-democratica.js";
// ... añadir al registro de overlays existente.
// META[id] debe llevar: { subcategorias: true } para activar sub-chips estándar
//   (ya implementa getSubcatOptions / setSubcatFilter).
```

CATEGORY_ORDER sugerido: junto a `cultura` y `agora` — bloque
"identidad y memoria del territorio". No mezclar con servicios.

### 2. Activarlo en `app.js`

Igual que `productoresOverlay` o `agoraOverlay`:
- Llamar a `memoriaDemocraticaOverlay.load()` en el bootstrap.
- Enchufar su `draw()` en el render loop, **por encima** de polígonos
  administrativos y barrios, **por debajo** de eventos activos
  (para que un evento HOY siga teniendo prioridad visual sobre un
  marcador histórico).
- `hitTest()` integrado con el resolver de popups habitual.

### 3. Popup (HTML del clic)

Mostrar (en castellano, sobrio, sin sensacionalismo):

- `nombre` — H3
- `tipo` legible (vía `getTipoLabel`) + `epoca` como subline
- `descripcion_corta` — párrafo
- Si `numero_victimas` o `numero_exhumados`: badge dignificado
- `mun` · `isla`
- "Fuente: " + `fuente` en footer pequeño

**NUNCA** exponer ni linkear listas de víctimas individuales — sólo
agregados. Si en el futuro se añade `victimas_url`, debe apuntar a un
recurso oficial externo (Min.PTMD), nunca embeber.

### 4. (Opcional pero recomendado) Cache-bust

```html
<script src="overlays/memoria-democratica.js?v=20260527-mem01" ...>
```

## Diseño del overlay (resumen)

### Estética
- Paleta rojos óxido / tierra quemada (`#7A2E2E`, `#4E2A22`, `#5A3030`).
  Saturación baja deliberada — la sobriedad es parte del mensaje.
- Pin con forma de **losa/estela vertical** (proporción 1:1.3), no
  círculo ni triángulo. Distinguible de eventos/ágora/tejido.
- Sin animación, sin pulsado. Coherente con tono memorialístico.

### Niveles
- Visible en: **isla / municipio / distrito / barrio / vecindario / seccion**.
- Como hay sólo 16 features, NO satura ninguna escala. A nivel
  archipiélago se podría ocultar (lo deja a integrador en `index.js`).

### Sub-chips (5 tipos)
| Key | Label |
|---|---|
| `fosa_comun` | Fosa común |
| `carcel` | Cárcel / campo |
| `lugar_simbolico` | Lugar simbólico |
| `monumento_victimas` | Monumento |
| `exilio_embarque` | Exilio / embarque |

### Badge de víctimas
Cuando `tipo === "fosa_comun"` y el cluster es de tamaño 1, se pinta
un pequeño badge bajo la losa con el número de exhumados (preferente)
o víctimas estimadas, formato `24†` o `~27†`. **Siempre visible**:
política editorial del proyecto.

## Fuentes investigadas (sin export disponible)

- Ministerio Política Territorial y Memoria Democrática (MPTMD):
  buscador georreferenciado web — sin export público.
- Gobierno de Canarias · Memoria Histórica: portal informativo,
  sin dataset.
- ARMH Canarias y Asoc. Memoria Histórica Arucas: documentación
  de exhumaciones (Pozos de Arucas, Sima de Jinámar).
- Tamaimos: serie "Memoria Histórica de Canarias".
- Wikipedia ES (Fyffes, Tefía, Sima de Jinámar).
- Foro por la Memoria · La Palma (Pino del Consuelo).
- Memoria de Lanzarote (`bk.memoriadelanzarote.com`).

Si se libera el dataset oficial del MPTMD (KML/JSON), el script
admite ampliarse: añadir nuevos elementos al array `LUGARES` con la
misma estructura — el validador ÉTICA se encarga de marcar nombres
individuales sospechosos antes de publicar.

## Conteo por tipo (16 totales)

| Tipo | N |
|---|---|
| fosa_comun | 8 |
| carcel | 5 |
| monumento_victimas | 1 |
| exilio_embarque | 1 |
| lugar_simbolico | 1 |

Por isla: Gran Canaria 9 · Tenerife 3 · Lanzarote 2 · La Palma 1 ·
Fuerteventura 1. La Gomera y El Hierro pendientes (sin datos
documentados encontrados en esta iteración).
