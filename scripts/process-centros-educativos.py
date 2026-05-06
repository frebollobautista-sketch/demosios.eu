#!/usr/bin/env python3
"""
process-centros-educativos.py — Procesa el directorio de Centros Educativos
de Canarias (datos.canarias.es) y genera los archivos consumidos por el
visor:

  public/data/centros-educativos-prov35.geojson   — puntos GeoJSON
  public/data/centros-educativos-stats.json       — agregados por municipio

Fuente:
  https://datos.canarias.es/catalogos/general/dataset/centros-educativos-de-canarias
  Recurso CSV (Consejería de Educación, FP, Actividad Física y Deportes
  del Gobierno de Canarias).

Uso:
  cd ~/OCRE
  curl -sL -o scripts/raw/centros_edu.csv \
    'https://datos.canarias.es/catalogos/general/dataset/f6b15811-014b-46f7-a858-fe48b062ed05/resource/b5e08adf-841b-4ba5-a599-4339e772d792/download/centros.csv'
  python3 scripts/process-centros-educativos.py

Notas:
- Filtra provincia 'Las Palmas' (Gran Canaria + Fuerteventura + Lanzarote).
- Categoría operativa: 'publico' / 'concertado' / 'privado' / 'otro'.
  En el dataset oficial los "Privado" suelen ser en realidad concertados
  (tienen campo Concierto rellenado). Lo derivamos en la propiedad
  `categoria` para permitir filtros en UI.
- Cobertura habitual: ~99.7% con coordenadas válidas.
"""
import csv
import json
import os
import sys
from collections import Counter, defaultdict

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(REPO, 'scripts', 'raw', 'centros_edu.csv')
OUT_GEOJSON = os.path.join(REPO, 'public', 'data', 'centros-educativos-prov35.geojson')
OUT_STATS = os.path.join(REPO, 'public', 'data', 'centros-educativos-stats.json')


def categorizar(naturaleza: str, concierto: str) -> str:
    n = (naturaleza or '').strip()
    c = (concierto or '').strip().lower()
    if 'Público' in n or 'Publico' in n:
        return 'publico'
    if c and c not in ('null', 'privado', ''):
        return 'concertado'
    if 'Privado' in n:
        return 'privado'
    return 'otro'


def main():
    if not os.path.exists(SRC):
        print(f'ERROR: {SRC} no existe. Descarga el CSV primero (ver docstring).', file=sys.stderr)
        sys.exit(1)

    rows = list(csv.DictReader(open(SRC, encoding='utf-8-sig')))
    print(f'Total Canarias: {len(rows):,}')

    prov35 = [r for r in rows if (r.get('Provincia') or '').strip() == 'Las Palmas']
    print(f'Provincia 35: {len(prov35):,}')

    features = []
    skipped = 0
    for r in prov35:
        try:
            lng = float((r.get('Longitud') or '').strip().replace(',', '.'))
            lat = float((r.get('Latitud') or '').strip().replace(',', '.'))
        except (ValueError, AttributeError):
            skipped += 1
            continue
        if not (27 < lat < 30 and -19 < lng < -13):
            skipped += 1
            continue

        cat = categorizar(r.get('Naturaleza'), r.get('Concierto'))
        features.append({
            'type': 'Feature',
            'geometry': {'type': 'Point', 'coordinates': [lng, lat]},
            'properties': {
                'id': r.get('idCentro'),
                'codigo': r.get('Codigo'),
                'nombre': (r.get('Denominacion') or '').strip(),
                'etapa': (r.get('DesEtapaCentro') or '').strip(),
                'etapa_desc': (r.get('DescripcionEtapaCentro') or '').strip(),
                'direccion': (r.get('Direccion') or '').strip(),
                'localidad': (r.get('Localidad') or '').strip(),
                'cp': (r.get('CodigoPostal') or '').strip(),
                'municipio': (r.get('Municipio') or '').strip(),
                'isla': (r.get('Isla') or '').strip(),
                'naturaleza': (r.get('Naturaleza') or '').strip(),
                'categoria': cat,
                'web': (r.get('PaginaWeb') or '').strip().replace('NULL', ''),
            }
        })

    print(f'Features con coords válidas: {len(features):,} (descartadas: {skipped})')
    cat_counts = Counter(f['properties']['categoria'] for f in features)
    print(f'Por categoría: {dict(cat_counts)}')

    os.makedirs(os.path.dirname(OUT_GEOJSON), exist_ok=True)
    with open(OUT_GEOJSON, 'w', encoding='utf-8') as f:
        json.dump({'type': 'FeatureCollection', 'features': features},
                  f, ensure_ascii=False, separators=(',', ':'))
    print(f'✓ {OUT_GEOJSON} ({os.path.getsize(OUT_GEOJSON) // 1024} KB)')

    mun_stats = defaultdict(lambda: {'total': 0, 'publico': 0, 'concertado': 0, 'privado': 0, 'otro': 0})
    for f_ in features:
        p = f_['properties']
        m = p['municipio'] or '?'
        mun_stats[m]['total'] += 1
        mun_stats[m][p['categoria']] += 1

    with open(OUT_STATS, 'w', encoding='utf-8') as f:
        json.dump(dict(mun_stats), f, ensure_ascii=False, indent=2)
    print(f'✓ {OUT_STATS}')

    top = sorted(mun_stats.items(), key=lambda x: -x[1]['total'])[:5]
    print('\nTop 5 municipios:')
    for m, s in top:
        print(f'  {m}: {s["total"]} (Pub:{s["publico"]} Conc:{s["concertado"]} Priv:{s["privado"]})')


if __name__ == '__main__':
    main()
