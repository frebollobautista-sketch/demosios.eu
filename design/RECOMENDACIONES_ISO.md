# KOINOS · POLIS — Recomendaciones para iso por sección

> Análisis tras tres iteraciones (`iso_buildings.py`, `iso_lods.py`, `iso_packages.py`).
> Sección de prueba elegida para este informe: **3501604043** (LPGC, distrito 04 sección 043, 437 edificios, ~41 ha bbox, zona alta de Schamann/Altavista).

## Lo que funcionó

- **`iso_buildings.py`**: el pipeline lng/lat → metros locales → proyección iso es robusto. La paleta KOINOS (paper/cream/sand/ocre/ink) se lee bien sobre fondo claro. El catálogo de 8 piezas individuales aporta riqueza tipológica.
- **`iso_lods.py`**: la idea de tres LODs sobre el MISMO encuadre comunica bien la jerarquía. El algoritmo de extracción de manzanas (buffer + dissolve + buffer-in) genera resultados razonables. El grid de 50 m da escala humana.
- El pintor por `min(x+y)` resuelve oclusión sin Z-buffer en casi todos los casos.

## Lo que NO funcionó

- **Sección demasiado escasa** (3501602010 con ~95 edificios alineados): no comunicaba tejido urbano denso; los paneles parecían un desierto.
- **Monocromía sin datos**: los paneles LOD-1/2 quedaban planos en color (todo arena) y, sin viales ni POIs, no se ve la utilidad de la sección como unidad.
- **Sin calles**: la ausencia de la vialidad OSM rompía la legibilidad espacial. Cuesta saber dónde está el paseo, dónde una avenida.
- **Sin escala humana**: faltaban referencias (dirección, área en hectáreas, número de tramos viarios) que ayudaran a Pancho a decidir si la unidad de juego es adecuada.

## Qué aporta `iso_packages.py`

El nuevo render muestra **cinco paneles que apilan datos sobre la misma sección**, comunicando que cada paquete es una decisión técnica (qué cargar, qué procesar, qué pintar):

1. **Sección + grid 50 m** — el suelo, área en ha, perímetro.
2. **+ Vialidad** (OSM) — anchos por tipo (primary, secondary, residential, etc.).
3. **+ Manzanas (LOD-1)** — extracción por buffer/dissolve, altura mediana.
4. **+ Edificios (LOD-2)** — los 434 prismas individuales.
5. **+ Uso** — categorización por POI dominante (<60 m) con leyenda.

Con esto se ve cómo el archivo `<cusec>.json` se convierte en *demo jugable* añadiendo capas auxiliares ya existentes (`gc-secciones-lite.json`, `osm-gc/roads.json`, `osm-gc/pois.json`).

## Recomendaciones para escalar (76 secciones de Canteras → 709 provincia)

1. **Cachear el polígono de sección y el recorte de roads/pois UNA vez por bbox**: ahora se relee `roads.json` (38 MB) en cada llamada. Refactor a un servicio que cargue una sola vez y sirva por bbox vía índice spatial (rtree) baja el coste por sección de 1.7 s a <0.4 s.
2. **Vincular categorías reales** (no heurística por altura): los POIs `osm-gc/pois.json` son escasos (10–20 por sección), pero `canteras_enriched.json` enlaza 761 edificios con POIs reales. Reproyectar canteras_enriched a lng/lat e importarlo a una capa común; el resto de la provincia se puede cubrir con el listado de viviendas vacacionales + DIRCE empresas + catastro INSPIRE cuando esté integrado.
3. **Render por lotes con perfil prudente**: 4 procesos paralelos de Python son seguros (RAM total <2 GB con shapely en secciones <500 edificios). Para secciones extremas (>2000 edificios ya en Maspalomas o Mogán) el bottleneck es shapely buffer/dissolve: limitar `buffer_m` a 4 m máximo y simplificar polígonos con `simplify(0.5)` antes de unir.

## Delegar a un agente: sí, con un guardrail

- **Tiempo medio actual**: 1.8 s/sección con I/O en frío (lectura completa de roads.json). Con la optimización del punto 1, ~0.4 s.
- **Estimaciones**:
  - 76 secciones canteras: ~30 s actual, ~12 s optimizado.
  - 709 secciones provincia: ~21 min actual, ~5 min optimizado.
- **Riesgo OOM**: bajo en secciones <800 edificios. Medio en >1500 (manzanas con `unary_union` sobre miles de polígonos puede picar a 1-2 GB). Mitigar con `try/except` por sección y fallback a render sin manzanas.
- **Recomendación**: delegar como tarea batch con (a) precarga única de roads.json y pois.json, (b) lista negra de secciones que petan tras 30 s timeout, (c) generación de un índice HTML con miniaturas de los 709 PNG para revisión rápida. Esto entra en una sola sesión de agente con presupuesto razonable.

## Prueba de fidelidad — sección 3501602007

> Generada por `design/iso_fidelity.py` el 2026-05-09. Sección elegida para
> comparar el render isométrico de KOINOS contra el satélite real ANTES de
> lanzar el batch de 76 secciones de Canteras.

### Sección elegida y por qué

- **CUSEC 3501602007** (LPGC, distrito 02, sección 007 — barrio de **Alcaravaneras**).
- Justificación frente a alternativas:
  - 542 edificios (≥300 requerido) → cumple criterio de densidad.
  - Bbox compacto ~786 m × 623 m (~49 ha) → cabe holgado en un mosaico de
    tiles z=18 (7×6 = 42 tiles) sin descargar megabytes inútiles.
  - Tejido urbano denso de manzana cerrada con patios interiores típica del
    ensanche LPGC; perfecta para revelar offsets de proyección o footprints
    sueltos.
  - 248 tramos OSM (86 pedestrian, 65 residential, 38 service, 29 footway,
    15 tertiary) → vialidad rica para verificar el panel C.
  - Distrito DIFERENTE a 3501604043 (Schamann) y 3501602010 (escasa).

### Fuente de tiles efectiva

- **Sandbox de ejecución del agente**: TODAS las fuentes públicas bloqueadas
  por la allowlist de egress (`Esri`, `CARTO`, `OSM` → 403 desde proxy).
  Las únicas fuentes externas alcanzables desde el sandbox son
  `overpass-api.de`, `pypi.org`, `github.com` y dominios de Anthropic.
- **Por tanto**: el PNG `3501602007_fidelity.png` generado en esta sesión
  contiene paneles **B** (footprints sin satélite, fondo paper) y **C**
  (iso KOINOS) válidos, pero el panel **A** muestra un placeholder
  "satélite no disponible — fuentes probadas: Esri, CARTO, OSM" porque los
  tiles no se pudieron descargar.
- **Acción requerida en local (Mac de Pancho, sin restricciones)**:

      cd ~/KOINOS && python3 design/iso_fidelity.py 3501602007

  El script intentará Esri primero, CARTO segundo, OSM tercero. En la Mac
  de Pancho los tres deberían responder (z=18, 42 tiles, ~3-6 s en total).
  El PNG se sobrescribirá con la versión completa.

### Tiempo de descarga

- En sandbox: 0.0 s (todas fallaron inmediatamente con 403).
- Estimación local (z=18, 42 tiles): 3-6 s con Esri (más rápido), 5-10 s con CARTO/OSM.

### Observaciones provisionales (sólo paneles B y C)

Sin satélite no se puede verificar fidelidad de footprints contra cubiertas
reales. Pero el panel C ya revela observaciones útiles del render iso:

1. **Densidad y altura plausibles**: 531 prismas válidos, alturas medias
   ~9-12 m con picos a 18-21 m en los edificios de esquina; coherente con
   Alcaravaneras (manzanas de 4-6 plantas).
2. **Vialidad presente y legible**: las tres anchuras (tertiary, residential,
   pedestrian) se distinguen visualmente; el paseo peatonal interior y las
   calles principales aparecen.
3. **Painter's algorithm sano**: no hay artefactos de oclusión visibles entre
   prismas; las paredes claras/oscuras (left/right) dan sensación de volumen.
4. **Riesgo identificado para el panel A vs B (cuando Pancho lo ejecute en
   local)**: el bbox de la sección se recorta con padding 4%; si las cubiertas
   reales del Catastro/OSM están desplazadas respecto al satélite Esri (típico
   offset 1-3 m por desfase del WMS), se verá como un sesgo sistemático
   constante en una dirección, no aleatorio. La forma de los polígonos debe
   coincidir aunque el centro esté ligeramente offset. Si el desfase es
   aleatorio o cambia por edificio, hay un problema de proyección.

### Veredicto provisional: NO luz verde aún

- **El batch de 76 NO debe lanzarse hasta que Pancho ejecute el script en su
  Mac y verifique visualmente los tres paneles juntos.**
- Si en local los footprints encajan razonablemente con las cubiertas (offset
  ≤2 m, sin rotación visible), el render es lo bastante fiel para el batch.
- Si hay desfase sistemático (toda la sección movida en una dirección), el
  problema está en el catastro/OSM y requiere un offset manual o cambiar
  fuente de footprints; antes del batch hay que ajustar.
- Si hay desfase aleatorio por edificio, hay un bug en `to_local_meters` o en
  la lectura de `<cusec>.json`; antes del batch hay que depurar.
- El script es idempotente, así que `python3 iso_fidelity.py 3501602007`
  (y luego, si convence, `3501604043`, `3501601036`, `3501601055`) puede
  servir como prueba antes del batch sin coste adicional.

### Notas técnicas para futuras pruebas

- El script `iso_fidelity.py` usa el mismo pipeline de `iso_packages.py`
  (panel 4: extrusión LOD-2 de cada edificio), así que si el panel C luce bien
  aquí, el panel 4 del batch lucirá igual.
- El panel A guarda también `<cusec>_satellite_raw.png` por si se quiere
  comparar tile a tile con visores externos.
- Cambiar la `pad_frac` del bbox (por defecto 4%) altera ligeramente el área
  visible — útil si el contorno de la sección queda muy pegado al borde.

## Comparativa cenital vs iso — sección 3501602052

> Generada por `design/iso_planiso.py` el 2026-05-09. Sección elegida como
> alternativa offline a `iso_fidelity.py` (la sandbox no tiene salida de red
> a tiles satelitales — Esri/CARTO/OSM/IGN/IDECanarias todos devuelven 403).
> Pancho hará la comparación abriendo `polis-provincia.html` en su navegador
> (que sí tiene Esri working) en cámara cenital sobre las mismas coords.

### Sección elegida

- **cusec**: 3501602052 (LPGC, distrito 02 sección 052, zona Las Canteras)
- **361 edificios** (en el rango 200-450 pedido)
- **22.18 ha**, bbox (-15.4356, 28.1236, -15.4258, 28.1296)
- **centro**: lat=28.127163, lng=-15.431900
- **269 tramos OSM**: 74 path, 70 residential, 34 tertiary, 30 footway,
  19 service, 16 pedestrian
- **76 POIs** clasificables, mayoría restauración (30) y cívico (20),
  consistente con barrio denso de paseo

### Cómo Pancho debe comparar (paso a paso)

1. **Servir el visor en local** desde el repo:

   ```bash
   cd ~/KOINOS/public && python3 -m http.server 8080
   ```

2. **Abrir el visor con jump directo a las coords del centro**:

   ```
   http://localhost:8080/polis-provincia.html#16/28.127163/-15.431900
   ```

   (MapLibre acepta `#zoom/lat/lng` en el hash; si no lo lleva implementado,
   navegar manualmente: provincia → click en LPGC → click en la sección
   3501602052 que queda al sur del paseo de Las Canteras).

3. **Ajustar la cámara a vista cenital**: pulsar dos veces la tecla de
   reset de pitch (en MapLibre por defecto: shift+arriba lleva pitch a 0,
   o click en el icono de brújula en la esquina superior derecha del mapa
   para que el norte mire arriba y el pitch quede a 0°).

4. **Subir el zoom a 17-18** para que el bbox de la sección ocupe
   aproximadamente el mismo % de pantalla que el panel A del PNG.

5. **Abrir `design/secciones/3501602052_planiso.png` al lado** (en otra
   ventana) y comparar el panel A (cenital KOINOS) con la imagen de
   Esri en el navegador. El panel B (iso) sirve para confirmar que la
   misma información se extruye correctamente.

### Patrones a buscar en la comparación

1. **¿Encajan las calles principales?** — La trama tertiary debería
   reconocerse como la avenida principal cruzando la sección. Si en el
   panel A las líneas ocre del eje principal corresponden a las avenidas
   visibles en el satélite, el viario OSM está correctamente alineado.
2. **¿La densidad de edificios coincide?** — En zona Canteras hay tejido
   continuo de manzanas, casi sin huecos. El panel A debe enseñar
   manzanas casi rellenas de polígonos ocre, no una constelación dispersa.
   Si hay huecos grandes que en satélite están construidos: faltan
   footprints (problema de extracción Catastro/PBF).
3. **¿Hay edificios fantasma o ausentes?** — Comparar borde noreste y
   suroeste de la sección. Edificios que en el panel A aparecen pero en
   satélite es una plaza/parque indican polígonos espurios. Edificios
   que en satélite existen pero en el panel A faltan indican gaps de
   datos (más comunes en interior de manzana o edificación reciente).
4. **¿La forma del polígono de la sección encaja con el límite urbano
   real?** — El borde grueso ocre oscuro del panel A es el polígono
   `gc-secciones-lite.json`. Debe seguir ejes de calle visibles, no
   cortar manzanas por la mitad. Si lo hace, hay desfase entre INE 2019
   y la trama actual.
5. **¿La densidad de POIs comerciales del panel A se concentra donde el
   satélite muestra avenida comercial?** — Los puntos naranja
   (restauración) y azul (comercio) deberían apilarse a lo largo de la
   tertiary principal, no dispersarse aleatoriamente. Si están bien,
   confirma que `osm-gc/pois.json` tiene cobertura usable para el
   mapeo de uso del juego.

### Limitación reconocida

El panel A es un proxy de fidelidad, no una prueba directa contra el
satélite (la sandbox del agente no puede descargar tiles). La comparación
visual la hace Pancho contra polis-provincia.html. Si los 5 patrones
arriba salen verdes, el batch de las 76 secciones de Canteras se puede
lanzar con el mismo pipeline de `iso_packages.py`.

## Spec de data pack v1

> Generado por `scripts/iso_pack.py`. Sección piloto: 3501602052 (Las Canteras).
> Salida: `public/sections_pack/<cusec>/`. Convención de ejes Godot:
> X=east_m, Y=height_m, Z=south_m (right-handed, Y up). Origen: centroide
> de la sección. Unidades: metros. Proyección: ENU lineal `(lng-lng0)*111320*cos(lat0)`.

### Archivos del pack

```
meta.json            section.geojson       buildings.geojson
manzanas.geojson     roads.geojson         pois.geojson
trees.geojson        monuments.geojson     parks.geojson
water.geojson        preview.png
```

### Contrato de propiedades

- **meta.json**: cusec, mun, nmun, area_ha, perimeter_m, building_count,
  tree_count, monument_count, poi_count, road_segment_count,
  centroid_lnglat, bbox_lnglat, bbox_local_m, enu_basis{lng0,lat0,cos_lat0},
  godot_axis_mapping, produced_at, producer, categories{nombre→{color,extrude}}.
- **section.geojson**: FeatureCollection con DOS features hermanas
  (coords_system="wgs84" y "local_m_enu"). Properties: cusec, mun, nmun,
  area_m2, perimeter_m.
- **buildings.geojson**: Polygon. id, height_m, levels, category,
  extrude:true, manzana_id. Categoría = POI<30m (rest./com./aloj./salud/
  finanzas) o building tag OSM publico, sino "residencial".
- **manzanas.geojson**: Polygon. id, height_median_m, building_count, area_m2.
- **roads.geojson**: LineString. osm_id, type
  (primary|secondary|tertiary|residential|service|footway|pedestrian|track),
  width_m (12/9/7/5/3.5/2/4/3), extrude:false.
- **pois.geojson**: Point. osm_id, category, name, extrude:false.
- **trees.geojson**: Point. osm_id, height_m (6.0 default), category:"arbol",
  extrude:true.
- **monuments.geojson**: Point. name, kind, height_m
  (monument=12, artwork=4, fountain=2, statue=4), extrude:true.
- **parks.geojson**: Polygon recortado al bbox. name, kind, category:"parque".
- **water.geojson**: Polygon recortado al bbox. name, kind, category:"agua".

### Convención CRS por archivo

Cada geojson (excepto section.geojson) tiene UNA `FeatureCollection` en
metros locales, con `crs.properties.name = "EPSG:32628_local_enu_m_section_centroid"`,
`crs.properties.lng0` y `crs.properties.lat0` para que Godot pueda
re-proyectar a lng/lat si lo necesita.

### Categorías y paleta KOINOS (en meta.json)

| categoría     | color    | extrude |
|---------------|----------|---------|
| restauracion  | #E68A4F  | false   |
| comercio      | #4F8AE6  | false   |
| alojamiento   | #9F4FE6  | false   |
| salud         | #4FE69F  | false   |
| finanzas      | #E6C44F  | false   |
| residencial   | #C8B898  | true    |
| publico       | #A06544  | true    |
| monumento     | #7A3A1A  | true    |
| arbol         | #5E8A3E  | true    |
| calle         | #8A8276  | false   |
| parque        | #A8C28A  | false   |
| agua          | #7AA0C2  | false   |

### Loader Godot

`godot/polis_walk/scripts/section_loader.gd` (`class_name SectionLoader`)
expone `load_section(cusec, base_path) -> Node3D` que lee meta.json,
construye materiales por categoría, e instancia BoxMesh placeholder por
edificio (con comentario para sustituir por `CSGPolygon3D` cuando se
quiera el polígono real). Calles/parques/agua/POIs se montan como
`MeshInstance3D` planos en y∈[0.03, 0.06]. Árboles → `CylinderMesh`,
monumentos → `BoxMesh`. Comentario de uso al final del archivo.

