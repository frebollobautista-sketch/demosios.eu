#!/usr/bin/env python3
"""
process-vv.py — Procesa el Registro de Viviendas Vacacionales (datos.canarias.es)
y genera los archivos consumidos por el visor POLIS:

  public/data/vv-prov35.geojson      — puntos GeoJSON de toda la provincia 35
  public/data/vv-municipio-stats.json — agregados por municipio (count, plazas)

Fuente:
  https://datos.canarias.es/catalogos/general/dataset/establecimientos-extrahoteleros-de-tipologia-vivienda-vacacional-inscritos-en-el-registro
  Recurso JSON (CC-BY, Gobierno de Canarias).

Uso:
  cd ~/KOINOS
  curl -sL -o scripts/raw/vv_canarias.json \
    'https://datos.canarias.es/catalogos/general/dataset/9f4355a2-d086-4384-ba72-d8c99aa2d544/resource/2507a1c1-acf6-4c6a-a3cc-1d414849d1c5/download/establecimientos-extrahoteleros-de-tipologia-vivienda-vacacional-inscritos-en-el-registro-gener.json'
  python3 scripts/process-vv.py

Notas:
- Filtra provincia 'Palmas (Las)' (Gran Canaria + Fuerteventura + Lanzarote).
- Descarta registros sin coordenadas válidas (lat=0, lng=0, fuera de Canarias).
- ~35% de las VV inscritas no están georreferenciadas en el dataset oficial.
"""
import json
import os
import sys
from collections import defaultdict

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(REPO, 'scripts', 'raw', 'vv_canarias.json')
OUT_GEOJSON = os.path.join(REPO, 'public', 'data', 'vv-prov35.geojson')
OUT_STATS = os.path.join(REPO, 'public', 'data', 'vv-municipio-stats.json')


def main():
    if not os.path.exists(SRC):
        print(f'ERROR: {SRC} no existe. Descarga el dataset primero (ver docstring).', file=sys.stderr)
        sys.exit(1)

    print(f'Cargando {SRC}...')
    with open(SRC) as f:
        data = json.load(f)['result']
    print(f'Total Canarias: {len(data):,}')

    prov35 = [r for r in data if r.get('direccion_provincia_nombre') == 'Palmas (Las)']
    print(f'Provincia 35 (Las Palmas): {len(prov35):,}')

    features = []
    skipped = 0
    for r in prov35:
        try:
            lat = float(r.get('latitud') or 'x')
            lng = float(r.get('longitud') or 'x')
        except (ValueError, TypeError):
            skipped += 1
            continue
        # Bounding box laxo de Canarias
        if not (27 < lat < 30 and -19 < lng < -13):
            skipped += 1
            continue
        features.append({
            'type': 'Feature',
            'geometry': {'type': 'Point', 'coordinates': [lng, lat]},
            'properties': {
                'id': r.get('establecimiento_id'),
                'nombre': (r.get('establecimiento_nombre_comercial') or '').strip(),
                'modalidad': r.get('establecimiento_modalidad'),
                'tipologia': r.get('establecimiento_tipologia'),
                'isla': r.get('direccion_isla_nombre'),
                'municipio': r.get('direccion_municipio_nombre'),
                'localidad': r.get('direccion_localidad_nombre'),
                'cp': r.get('direccion_codigo_postal'),
                'plazas': r.get('plazas') or 0,
            }
        })
    print(f'Features con coordenadas válidas: {len(features):,} (descartadas: {skipped:,})')

    os.makedirs(os.path.dirname(OUT_GEOJSON), exist_ok=True)
    with open(OUT_GEOJSON, 'w') as f:
        json.dump({'type': 'FeatureCollection', 'features': features}, f, ensure_ascii=False, separators=(',', ':'))
    size_kb = os.path.getsize(OUT_GEOJSON) // 1024
    print(f'✓ {OUT_GEOJSON} ({size_kb} KB)')

    # Agregados por municipio
    stats = defaultdict(lambda: {'count': 0, 'plazas': 0})
    for f_ in features:
        m = f_['properties']['municipio'] or '?'
        stats[m]['count'] += 1
        stats[m]['plazas'] += f_['properties']['plazas']

    with open(OUT_STATS, 'w') as f:
        json.dump(dict(stats), f, ensure_ascii=False, indent=2)
    print(f'✓ {OUT_STATS}')

    top5 = sorted(stats.items(), key=lambda x: -x[1]['count'])[:5]
    print('\nTop 5 municipios:')
    for m, s in top5:
        print(f'  {m}: {s["count"]:,} VV / {s["plazas"]:,} plazas')


if __name__ == '__main__':
    main()
