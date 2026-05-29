#!/usr/bin/env python3
"""
extract-centros-educativos-prov38.py — Genera el geojson de centros
educativos para la provincia 38 (Santa Cruz de Tenerife: TF, LP, LG, EH)
a partir del directorio oficial de la Consejería de Educación de
Canarias (Gobierno de Canarias), publicado en datos.canarias.es.

Salida (mismo esquema que prov35):
  public/data/centros-educativos-prov38.geojson

Fuente CSV:
  https://datos.canarias.es/catalogos/general/dataset/centros-educativos-de-canarias
  Recurso CSV (Consejería de Educación, FP, Actividad Física y Deportes).

Estrategia:
- Reutiliza el CSV ya descargado en `~/OCRE/scripts/raw/centros_edu.csv`
  (puerto unificado del script `KOINOS/scripts/process-centros-educativos.py`).
- Filtra Provincia == 'Santa Cruz de Tenerife'.
- Aplica la misma categorización (publico/concertado/privado/otro)
  para que `overlays/educacion.js` no tenga que distinguir las dos
  fuentes.
- Mismas propiedades que prov35: id, codigo, nombre, etapa, etapa_desc,
  direccion, localidad, cp, municipio, isla, naturaleza, categoria, web.

Si el CSV no está cacheado, descarga con:
  mkdir -p ~/OCRE/scripts/raw && \
  curl -sL -o ~/OCRE/scripts/raw/centros_edu.csv \
    'https://datos.canarias.es/catalogos/general/dataset/f6b15811-014b-46f7-a858-fe48b062ed05/resource/b5e08adf-841b-4ba5-a599-4339e772d792/download/centros.csv'

Verificado 2026-05-27: 728 registros prov38, ~99% con coords válidas.
"""
import csv
import json
import os
import sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
SRC_CANDIDATES = [
    os.path.join(REPO, 'scripts', 'raw', 'centros_edu.csv'),
    os.path.expanduser('~/OCRE/scripts/raw/centros_edu.csv'),
    os.path.expanduser('~/KOINOS/scripts/raw/centros_edu.csv'),
]
OUT_GEOJSON = os.path.join(REPO, 'public', 'data', 'centros-educativos-prov38.geojson')
OUT_STATS_DELTA = os.path.join(REPO, 'public', 'data', 'centros-educativos-stats-prov38.json')


def find_src() -> str:
    for p in SRC_CANDIDATES:
        if os.path.exists(p):
            return p
    print('ERROR: no se encuentra centros_edu.csv. Probado:', file=sys.stderr)
    for p in SRC_CANDIDATES:
        print(f'  - {p}', file=sys.stderr)
    print('Descarga con el comando indicado en el docstring.', file=sys.stderr)
    sys.exit(1)


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
    src = find_src()
    rows = list(csv.DictReader(open(src, encoding='utf-8-sig')))
    print(f'Total Canarias: {len(rows):,}')

    prov38 = [r for r in rows if (r.get('Provincia') or '').strip() == 'Santa Cruz de Tenerife']
    print(f'Provincia 38: {len(prov38):,}')

    features = []
    skipped = 0
    skipped_reasons = Counter()
    for r in prov38:
        try:
            lng = float((r.get('Longitud') or '').strip().replace(',', '.'))
            lat = float((r.get('Latitud') or '').strip().replace(',', '.'))
        except (ValueError, AttributeError):
            skipped += 1
            skipped_reasons['coord_parse'] += 1
            continue
        # bbox provincial laxo: TF/LP/LG/EH están entre 27.5-29.0 lat y -18.3 a -16.0 lng
        if not (27 < lat < 29.5 and -18.5 < lng < -15.5):
            skipped += 1
            skipped_reasons['coord_oob'] += 1
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

    print(f'Features con coords válidas: {len(features):,} (descartadas: {skipped} {dict(skipped_reasons)})')
    cat_counts = Counter(f['properties']['categoria'] for f in features)
    print(f'Por categoría: {dict(cat_counts)}')

    isla_counts = Counter(f['properties']['isla'] for f in features)
    print(f'Por isla: {dict(isla_counts)}')

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

    with open(OUT_STATS_DELTA, 'w', encoding='utf-8') as f:
        json.dump(dict(mun_stats), f, ensure_ascii=False, indent=2)
    print(f'✓ {OUT_STATS_DELTA} (stats prov38 sueltos — el overlay debería leer ambos)')

    top = sorted(mun_stats.items(), key=lambda x: -x[1]['total'])[:5]
    print('\nTop 5 municipios prov38:')
    for m, s in top:
        print(f'  {m}: {s["total"]} (Pub:{s["publico"]} Conc:{s["concertado"]} Priv:{s["privado"]})')


if __name__ == '__main__':
    main()
