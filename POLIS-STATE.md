# KOINOS POLIS — Estado del proyecto

> Documento de referencia para Claude. Última actualización: 1 mayo 2026.

## Qué es POLIS

POLIS es el visor/mapa interactivo de KOINOS. Es un **digital twin cívico** de las Islas Canarias que opera en dos modos separados:

1. **Visor de datos** (actual): mapa con satélite + edificios 3D + capas de datos públicos. Objetivo: digitalizar la realidad territorial.
2. **Juego** (futuro): versión gamificada sobre el mismo territorio, eliminando lo que no sea necesario del visor.

El visor es la base. El juego se construye encima.

## Archivo principal

**`public/polis-provincia.html`** — visor standalone HTML (~46KB, ~1000 líneas). No es un componente React — es HTML puro con MapLibre GL JS inline. Se sirve como static file.

### Stack técnico
- MapLibre GL JS 4.7.1 (no Mapbox — open source, sin token)
- Tiles satélite: Esri World Imagery (raster)
- Labels: CARTO light_only_labels (raster, zoom 12+)
- Terrain: Amazon elevation tiles (terrarium encoding) → hillshade
- Todo el JavaScript es ES5 (var, function, .forEach) — compatible con cualquier navegador
- No hay bundler, no hay npm, no hay framework. Un solo archivo HTML.

### Decisiones de diseño firmes (no cambiar sin consultar)
- **Satélite como base**: la imagen real es el fondo. No se reemplaza con colores planos.
- **Edificios en un solo tono** (#c8b898) con sombras para efecto 2.5D. Los colores de tipología son capas activables, NO el estado por defecto.
- **La ciudad debe ser reconocible**: quien mire su barrio debe poder identificarlo. Mínimo detalle necesario para reconocimiento, máximo rendimiento.
- **Los datos se muestran al nivel en que existen**: renta por sección = coropleta en sección; dato por edificio = colorear el bloque.
- **Escalar antes de decorar**: primero tener los polígonos y datos de toda la provincia, luego mejorar la estética.

## Cobertura de datos actual

### Edificios 3D (`public/buildings/`)
- **690 archivos JSON**, uno por sección censal (de 709 totales = 97.3% cobertura)
- **128,215 edificios** en los 34 municipios de las 3 islas de la provincia 35
- Las Palmas de GC (35016): 274 secciones con datos del Catastro INSPIRE (más detallados)
- Resto: extraídos del PBF de Geofabrik con `scripts/pbf-to-buildings.py`
- Formato por archivo: `[[coordenadas_poligono, altura_metros, niveles], ...]`
- Tamaño total: 36MB

### Secciones censales (`public/gc-secciones-lite.json`)
- 709 secciones de la provincia 35 (Gran Canaria + Fuerteventura + Lanzarote)
- Fuente: spain-datasets, censo 2019
- Versión lite: coordenadas reducidas a 4 decimales, 1.2MB
- Versión completa: `gc-secciones.json`, 15MB
- Properties: cusec (10 dígitos), mun (3 dígitos), dis, sec, nmun

### Municipios (`public/gc-municipios-lite.json`)
- 34 municipios como Point centroids, 7KB
- Properties: mun, nmun, sections, center

### Capas OSM (`public/osm-gc/`)
- Extraídas del PBF de Geofabrik con `scripts/pbf-to-osm-layers.py`
- Cubren TODA la provincia 35 (3 islas)
- roads.json: 96,439 features (38MB) — carreteras por tipo (primary, secondary, residential, track, etc.)
- parks.json: 12,881 features (6.5MB) — parques, bosques, cultivos, cementerios
- water.json: 22,140 features (11MB) — ríos, embalses, barrancos
- coastline.json: 658 features (1.2MB) — línea de costa
- pois.json: 10,190 features (1.7MB) — puntos de interés por categoría

### Renta INE (`public/data/renta-seccion.json`)
- **PENDIENTE** — el script `fetch-renta-ine.mjs` descarga desde el INE pero el parser fue corregido y necesita re-ejecución
- Formato esperado: `{ "3501601001": { renta: 28450, year: 2023 }, ... }`
- El visor ya tiene `toggleRenta()` implementado con coropleta rojo-amarillo-verde

### PBF fuente (`KOINOS duplicado/GEOFABRIK/canary-islands-260410.osm.pbf`)
- 57MB, Geofabrik extract de todas las Canarias
- Contiene TODAS las 8 islas (no solo provincia 35)
- Se usa como fuente maestra para extraer edificios y capas OSM

## Mapeo de islas a municipios

```
Gran Canaria (21 municipios):
  35001 Agaete, 35002 Agüimes, 35005 Artenara, 35006 Arucas,
  35008 Firgas, 35009 Gáldar, 35011 Ingenio, 35012 Mogán,
  35013 Moya, 35016 Las Palmas de GC, 35019 San Bartolomé de Tirajana,
  35020 Aldea de San Nicolás, 35021 Santa Brígida, 35022 Santa Lucía de Tirajana,
  35023 Santa María de Guía, 35025 Tejeda, 35026 Telde,
  35027 Teror, 35031 Valsequillo, 35032 Valleseco, 35033 Vega de San Mateo

Fuerteventura (6 municipios):
  35003 Antigua, 35007 Betancuria, 35014 La Oliva,
  35015 Pájara, 35017 Puerto del Rosario, 35030 Tuineje

Lanzarote (7 municipios):
  35004 Arrecife, 35010 Haría, 35018 San Bartolomé,
  35024 Teguise, 35028 Tías, 35029 Tinajo, 35034 Yaiza
```

## Estructura del visor (polis-provincia.html)

### Interfaz
- **Arriba centro**: navegador de islas — SVG con siluetas reales de las 8 islas canarias (extraídas del PBF). Solo contorno, sin relleno. Click vuela a la isla.
- **Izquierda**: panel tipo libreta/diario. Se abre/cierra con click en la tapa. Contiene breadcrumb, stats, lista de municipios agrupados por isla.
- **Toggle "Todos los edificios"**: dentro de la libreta, visible a nivel municipio/sección. Carga TODOS los edificios del municipio de una vez.

### Navegación jerárquica
```
Provincia → click en sección → Municipio → click en sección → Sección (edificios 3D)
Escape para subir un nivel
```

### Capas del mapa (de abajo a arriba)
1. Satélite (Esri, raster)
2. Hillshade (terrain-dem, raster)
3. OSM parks (fill, zoom 12+)
4. OSM water (fill, zoom 13+)
5. OSM coast (line, zoom 11+)
6. OSM roads (line, zoom 12+, ancho por tipo)
7. Secciones censales (fill+line, transparentes excepto hover)
8. Labels municipio (symbol, zoom 8-14)
9. CARTO labels (raster, zoom 12+)
10. [Al entrar en sección] Sombras de edificios (fill, offset)
11. [Al entrar en sección] Edificios 3D (fill-extrusion, pitch 55°)
12. OSM POIs (circle+symbol, zoom 14+)

### Edificios 3D
- Color base: #c8b898 (arena cálida)
- Hover: #f0e0c0
- Sombras: polígonos offset (dx=h*0.000004, dy=-h*0.000003), opacidad escalada por altura
- Light: anchor viewport, color #ffe8c0, intensity 0.6, position [1.5, 210, 30]
- Opacidad: 0.92 con vertical gradient

## Scripts disponibles

### Extracción de datos (Python, ejecutar localmente)
```bash
# Extraer edificios del PBF → JSONs por sección
python3 scripts/pbf-to-buildings.py

# Extraer capas OSM del PBF → GeoJSONs
python3 scripts/pbf-to-osm-layers.py
```
Requieren: `pip install osmium shapely`

### Descarga de datos (Node/Bash, ejecutar localmente)
```bash
# Descargar renta INE (corregir parser y re-ejecutar)
node scripts/fetch-renta-ine.mjs

# Descargar OSM vía Overpass API (alternativa al PBF, solo Gran Canaria)
node scripts/fetch-osm-gc.mjs

# Descargar Catastro INSPIRE (puede fallar, usar PBF como alternativa)
bash scripts/descargar_catastro_v3.sh

# Convertir GML Catastro → JSONs por sección
node scripts/catastro-to-buildings.mjs
```

### Procesamiento de secciones censales
```bash
# Extraer municipios y secciones del GeoJSON de spain-datasets
node scripts/extract-gc-municipios.mjs
```

## Versiones anteriores (no tocar, referencia)
- `polis-3d-v2.html` — versión LPGC con sombras y edificios pulidos
- `polis-3d.html` — primera versión 3D
- `polis_v5.html` a `polis_v16.html` — iteraciones tempranas
- `polis-r3f.html` — prototipo React Three Fiber (abandonado)

## Contexto del proyecto KOINOS/OCRE

KOINOS es una plataforma Next.js 16 / React 19 desplegada en Vercel (koinos.es). OCRE es el nombre del front-end cívico. POLIS es la sección del mapa. El plan es que `polis-provincia.html` se convierta en la homepage de koinos.es, ya sea servida como static HTML o convertida a componente React.

Supabase está configurado como backend (ver package.json).

## Próximos pasos — lo que el usuario quiere

### INMEDIATO: Mapa vectorial basado en polígonos
El usuario está explorando crear una versión del mapa que NO use tiles de satélite como fondo, sino que renderice todo el territorio como **polígonos coloreados extraídos de OSM** con la máxima fidelidad visual respecto a lo que muestra el satélite. Esto implicaría:

1. Extraer del PBF todas las capas de cobertura del suelo: `landuse`, `natural`, `landcover`, `surface`
2. Generar un mapa base vectorial con polígonos coloreados por tipo (urbano, agrícola, bosque, roca, arena, agua, playa)
3. Mantener edificios 3D encima
4. Los huecos sin datos OSM necesitarían un color por defecto (basado en elevación: costa=arena, montaña=roca)
5. El resultado debe ser reconocible comparado con el satélite
6. Ambos modos (satélite vs vectorial) podrían coexistir como toggle

### Decisión pendiente: migrar desarrollo a Claude Code
El proyecto tiene suficiente código para beneficiarse de un workflow con terminal, git, testing local. El visor es un HTML standalone que no necesita build step — se puede iterar con un simple `python3 -m http.server`.

### Datos por integrar
- **INE Renta**: re-ejecutar `fetch-renta-ine.mjs` con el parser corregido
- **Guaguas Municipales**: GTFS público, líneas + paradas
- **Viviendas Vacacionales**: CSV en datos.canarias.es, geocodificar por dirección
- **BIC Patrimonio**: GeoJSON/GeoPackage en datos.canarias.es
- **Catastro enriquecido**: año construcción, superficie, uso (del GML INSPIRE)
- **Calidad del Aire**: API tiempo real (5 estaciones LPGC)
- **PGOU Zonificación**: SITCAN WMS/WFS

### Deploy
- Objetivo: polis-provincia.html como homepage de koinos.es (Vercel)
- Los datos estáticos (GeoJSON, buildings/) pueden ir como assets en Vercel o CDN
- El total de datos es ~95MB — necesita estrategia de carga lazy

## Comandos para arrancar

```bash
# Servir visor localmente
cd ~/KOINOS/public && python3 -m http.server 8080
# Abrir: http://localhost:8080/polis-provincia.html

# Borrar archivo innecesario (35MB de edificios OSM duplicados)
rm ~/KOINOS/public/osm-gc/buildings.json

# Re-ejecutar descarga renta
cd ~/KOINOS && node scripts/fetch-renta-ine.mjs
```
