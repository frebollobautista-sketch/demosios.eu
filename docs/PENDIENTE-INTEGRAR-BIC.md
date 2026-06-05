# Pendiente integrar: bic overlay

Indicador **CUL-01 Bienes de Interés Cultural + patrimonio catalogado**.
Datos y overlay ya producidos por `scripts/extract-bic-patrimonio.py` (genera
`public/data/bic-patrimonio-canarias.geojson`) y
`public/polis-app/overlays/bic.js`.

No se ha tocado `overlays/index.js` ni `app.js` porque hay otros chats
trabajando en paralelo. Cambios mínimos abajo.

## Cambios en `public/polis-app/overlays/index.js`

1. Añadir import:

   ```js
   import { bicOverlay } from "./bic.js?v=20260527-bic-v0";
   ```

2. Añadir a `OVERLAYS[]`:

   ```js
   bicOverlay,
   ```

3. Añadir a `META`:

   ```js
   "bic": {
     category: "cultura",
     levels: ["isla", "municipio", "distrito", "barrio", "seccion"],
     subcategorias: true
   },
   ```

## Cambios en `public/polis-app/app.js` (AMBITOS)

Localizar el `layer` con `id: "cultura"` y añadir `"bic"` a su lista
`layers` (junto a `cultura-venues`, `eventos`).

## Sub-chips (7 tipos)

El overlay expone `bicOverlay.types` — array `{key, label, color}`:

| key            | label              | count aprox |
|----------------|--------------------|-------------|
| bic            | BIC declarado      | 62          |
| archaeological | Yacimiento         | 188         |
| castle         | Fortificación      | 22          |
| iglesia        | Iglesia/ermita     | 368         |
| monumento      | Monumento          | 699         |
| ruins          | Ruinas             | 901         |
| memorial       | Memorial           | 360         |

API para UI de chips:

```js
bicOverlay.setActiveTypes(["bic", "archaeological"]);  // filtrar
bicOverlay.setActiveTypes(null);                       // todos
bicOverlay.pick(view, state, mouseX, mouseY);          // hit-test popup
```

## Glifos

Cada tipo dibuja una forma propia (no reusa el rectángulo redondeado de
`cultura-venues`, para distinguirse visualmente):

- `bic` → estrella ocre brand (#C5764A)
- `archaeological` → triángulo púrpura
- `castle` → torre con almenas
- `iglesia` → cruz
- `monumento` → cuadrado pequeño
- `ruins` / `memorial` → banner con glifo "Ru"/"Me"

En clusters (>1 ítem en CLUSTER_PX=22) se cae al banner con
`glyph·count` y el color del tipo dominante (mayor prioridad).

## Niveles y filtrado por LOD

- `isla` / `archipielago`: sólo BIC, castle y archaeological **con
  nombre** (evita saturar con 900 ruinas OSM sin nombre).
- `municipio` / `distrito` / `barrio` / `seccion`: todo el detalle que
  caiga en bbox del nivel.

## Fuentes

1. **BIC oficial Gobierno de Canarias** (Tenerife):
   `datos.tenerife.es` → `bic_inmuebles.geojson` (199 inmuebles
   declarados con categoría, BOC y fecha). Mapeado a tipos `bic` /
   `monumento` / `archaeological`. Para el resto de islas no hay
   GeoJSON descargable abierto que se haya encontrado a fecha de hoy
   (IDECanarias sólo publica WMS, sin WFS estable; datos.gob.es lista
   subconjuntos pero sin enlace de descarga directa). Si aparece fuente
   oficial para Gran Canaria, La Palma, etc., extender
   `parse_*` en el script con el mismo schema.

2. **OSM Geofabrik canary-islands** (`historic=*`): 2776 nodos crudos
   → 2401 tras dedupe contra Tenerife oficial (radio ~200 m). Cubre
   archipiélago completo y aporta diversidad (memoriales, ermitas
   rurales, ruinas etnográficas, torres). Etiquetado OSM-historic:
   - `monument`, `archaeological_site`, `castle`/`fort`, `ruins`,
     `wayside_cross`, `wayside_shrine`, `memorial`, `tomb`, `manor`,
     `mine`, `city_gate`, `building`(con historic/heritage).
   - También se aceptan `amenity=place_of_worship` con tag
     `heritage`/`ref:bic`/`wikidata` (iglesias catalogadas).

## Cache-buster

`?v=20260527-bic-v0` en el fetch del overlay. Subir número si se
regenera el GeoJSON con cambios incompatibles (renombrado de
properties, nuevos tipos).

## TODO al integrar

- Añadir popup que muestre `nombre`, `categoria_original`,
  `fecha_declaracion`, `mun`, `fuente` al usar `bicOverlay.pick(...)`
  desde `app.js`.
- Verificar contraste visual con `cultura-venues` (ambos en cat
  cultura); el ocre brand de BIC es más cálido que el azul biblioteca,
  pero puede colidir con `centro_artes`. Considerar usar borde dorado
  para `tipo=bic` si la coexistencia molesta en seccion.
