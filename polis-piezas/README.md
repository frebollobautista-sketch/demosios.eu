# POLIS · Piezas vectoriales

Catálogo de la isla como piezas SVG independientes (una por entidad administrativa), pensado para desplegarse sobre un tablero propio sin depender del mapa satelital y sin degradación en zoom.

## Estado actual

Sólo **LPGC (35016)** poblado. Estructura preparada para el resto de Gran Canaria.

- 1 municipio · 5 distritos · 274 secciones censales · 43.687 edificios
- 554 SVG (piezas reales) + 554 PNG (thumbnails para catálogo)
- Fuente geometría: v16 / OSM (edificios) + INE Secciones Censales 2019 (contornos)

## Árbol

```
polis-piezas/
├── MANIFEST.json            ← catálogo maestro (jerarquía + rutas + bbox)
├── tablero.html             ← demo vectorial, zoom infinito sin satellite
├── catalogo.html            ← vista cuadrícula de todas las piezas
├── municipios/ svg/ png/    (1 pieza)
├── distritos/  svg/ png/    (5 piezas)
├── secciones/  svg/ png/    (274 piezas: sólo contorno)
├── edificios/  svg/ png/    (274 piezas: contorno + footprints dentro)
└── _data/
    ├── build_pieces.py      ← regenera todos los SVG + MANIFEST
    ├── render_pngs.py       ← regenera los PNG preview (cairosvg)
    ├── buildings.geojson    ← 43.690 edificios extraídos de v16
    └── building-seccion-map.json
```

## Sistema de coordenadas

Todas las piezas comparten un mismo marco vectorial:

- Proyección equirectangular con corrección `cos(lat)` (distorsión despreciable a esta escala).
- 1 unidad SVG ≈ 1 metro.
- Origen (0,0) = esquina NW del bbox de **Gran Canaria completa** (ya preparado para extensión).
- Y invertida (norte arriba).

Cada pieza SVG lleva su `viewBox` en coordenadas globales, así que colocándola en el tablero según su `bbox` del MANIFEST, las piezas encajan automáticamente — como un tangram real de la isla.

## Añadir un municipio nuevo

1. Obtener polígonos de secciones censales INE del municipio (CUSEC `{codigo}{DD}{SSS}`).
2. Obtener footprints de edificios (OSM overpass o catastro).
3. Añadirlos a `polis-data/secciones-censales-{codigo}.json` con mismo schema.
4. Ampliar `build_pieces.py` para iterar sobre todos los municipios presentes.
5. Re-ejecutar `build_pieces.py` y `render_pngs.py`.

## Ver las piezas

Abre `catalogo.html` para la cuadrícula o `tablero.html` para el lienzo vectorial completo (rueda = zoom, arrastrar = mover, click en pieza = info).
