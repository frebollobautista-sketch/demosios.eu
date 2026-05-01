# POLIS — Próximos pasos para el siguiente chat

## Estado actual

### Lo que funciona (polis-provincia.html)
- Visor MapLibre con satélite + hillshade para las 3 islas de la provincia 35 (Gran Canaria, Fuerteventura, Lanzarote)
- 709 secciones censales de 34 municipios con hover/click
- Navegación: Provincia → Municipio → Sección → Edificio (Escape para subir)
- Panel lateral con lista de municipios agrupados por isla
- Panel derecho con estado de cada capa de datos (cargado / pendiente / sin datos)
- Capas OSM visibles (carreteras, parques, costa, agua, POIs) — **solo cubren Las Palmas de GC**
- Edificios 3D con sombras proyectadas — **solo 272 secciones de Las Palmas (código INE 35016)**
- Terreno hillshade global

### Lo que falta

#### PRIORIDAD 1 — Datos geográficos para cubrir toda la provincia
1. **OSM para toda Gran Canaria**: Ejecutar `node scripts/fetch-osm-gc.mjs` (bbox toda la isla, genera public/osm-gc/). Después ampliar a Fuerteventura y Lanzarote.
2. **Edificios 3D para el resto de municipios**: El Catastro INSPIRE tiene datos para los 21 municipios de GC. Scripts listos:
   - `scripts/descargar_catastro_v2.sh` — descarga los 22 ZIPs del Catastro
   - `scripts/pipeline_gran_canaria.py` — parsea GML, reproyecta UTM28N→WGS84, asigna edificios a secciones censales
   - Falta: adaptar el pipeline para generar los JSON por sección en `public/buildings/` (formato `[[coords, height, levels], ...]`)
3. **Secciones censales actualizadas**: Las actuales son de 2019 (spain-datasets). Buscar las de 2021 (último censo).

#### PRIORIDAD 2 — Capas de datos temáticos
Cada una debe ser un filtro toggleable en el panel derecho.

4. **INE Atlas de Renta** — Renta media por sección censal. CSV descargable de ine.es. Renderizar como coropleta sobre secciones (rojo-amarillo-verde). Nivel: sección censal.
5. **Guaguas Municipales** — GTFS público. Líneas + paradas. Renderizar como líneas coloreadas por ruta. Nivel: línea/parada.
6. **Viviendas Vacacionales** — CSV en datos.canarias.es. Geocodificar por dirección, pintar edificio del color de la capa. Nivel: edificio.
7. **BIC Patrimonio** — GeoJSON/GeoPackage en datos.canarias.es. Puntos + polígonos. Nivel: edificio/zona.
8. **Catastro enriquecido** — Año construcción, superficie, uso. Del INSPIRE buildings GML. Nivel: edificio.
9. **Calidad del Aire** — API tiempo real (calidaddelaire.es). 5 estaciones en LPGC. Gradiente interpolado.
10. **PGOU Zonificación** — SITCAN WMS/WFS. Usos del suelo.

#### PRIORIDAD 3 — Interfaz y despliegue
11. **Homepage**: Integrar polis-provincia.html como página de inicio de koinos.es (actualmente Next.js en Vercel).
   - Opción A: Servir como static HTML en /public de Next.js
   - Opción B: Convertir a componente React que carga MapLibre
   - Los datos estáticos (GeoJSON) pueden ir en Vercel como assets o en un CDN
12. **Filtros avanzados**: UI para activar/desactivar capas con leyenda de colores
13. **Panel de edificio enriquecido**: Al clicar un edificio, mostrar todos los datos disponibles de todas las capas

## Archivos clave

```
public/
├── polis-provincia.html     ← VISOR PRINCIPAL (nuevo, provincia 35 completa)
├── polis-3d-v2.html         ← versión anterior (solo LPGC, más pulida para edificios)
├── gc-secciones-lite.json   ← 709 secciones censales, 1.2MB
├── gc-municipios-lite.json  ← 34 municipios (centroides), 7KB
├── gc-municipios.json       ← 34 municipios (polígonos completos), 14MB
├── gc-secciones.json        ← 709 secciones (precisión completa), 15MB
├── osm/                     ← datos OSM Las Palmas (6 archivos, 19MB total)
├── osm-gc/                  ← [POR GENERAR] datos OSM Gran Canaria completa
├── buildings/               ← 272 archivos JSON por sección (solo LPGC)
├── lpgc-distritos.json      ← distritos de LPGC
└── polis-secciones.json     ← secciones de LPGC (detallado)

scripts/
├── fetch-osm-gc.mjs         ← descarga OSM toda Gran Canaria (LISTO, no ejecutado)
├── fetch-osm-lpgc.mjs       ← descarga OSM Las Palmas (ya ejecutado)
├── extract-gc-municipios.mjs ← extrae municipios de secciones censales (ya ejecutado)
├── descargar_catastro_v2.sh  ← descarga Catastro 21 municipios (LISTO, no ejecutado)
├── pipeline_gran_canaria.py  ← pipeline Catastro→PostGIS (LISTO, no ejecutado)
└── limpiar_y_descargar.py    ← limpia ZIPs corruptos

spain-datasets/data/census/
└── SECC_CE_ES-CN_20190101.json  ← secciones censales Canarias 2019
```

## Filosofía de diseño
- **Dos productos separados**: Visor de datos (digitalizar realidad) vs. Juego (gamificación). El visor es la base.
- **Mapa limpio por defecto**: satélite + hillshade + capas 2D siempre visibles. Sin líneas de frontera hasta que sean relevantes al nivel actual.
- **Edificios en un solo tono** (#c8b898) con sombras para 2.5D. Los colores de tipología son capas activables, no el estado por defecto.
- **Los datos se muestran al nivel en que existen**: renta por sección = coropleta en sección; vivienda vacacional por edificio = colorear el bloque.
- **Escalar antes de decorar**: primero tener los polígonos y datos de toda la provincia, luego mejorar la estética.

## Comandos para ejecutar YA (en tu terminal)
```bash
# 1. Descargar OSM de toda Gran Canaria (~5-10 min)
cd ~/KOINOS && node scripts/fetch-osm-gc.mjs
# → Genera public/osm-gc/ con 6 archivos
# → polis-provincia.html los cargará automáticamente (fallback a osm/ si no existen)

# 2. Descargar renta INE (~1 min)
cd ~/KOINOS && node scripts/fetch-renta-ine.mjs
# → Genera public/data/renta-seccion.json
# → Al abrir polis-provincia.html, el botón "Renta media" se activará en el panel derecho
# → Si falla la descarga directa:
#    - Descarga CSV manualmente desde https://www.ine.es/jaxiT3/Tabla.htm?t=31097
#    - Guárdalo como scripts/renta_raw.csv
#    - Ejecuta: node scripts/fetch-renta-ine.mjs --local

# 3. Descargar Catastro de los 21 municipios (~15 min)
cd ~/KOINOS && bash scripts/descargar_catastro_v2.sh

# 4. Procesar pipeline Catastro (necesita Python + gdal)
cd ~/KOINOS && python3 scripts/pipeline_gran_canaria.py
```
