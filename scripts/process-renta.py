#!/usr/bin/env python3
"""
process-renta.py — Procesa el dataset "Renta media en España" del INE
(Atlas de Distribución de Renta) y genera los archivos consumidos por
el visor:

  public/data/renta-seccion.json    — {cusec: {renta, hogar}} prov 35
  public/data/renta-municipio.json  — agregado por municipio prov 35

Fuente:
  El CSV original viene del INE — Atlas de Distribución de Renta de
  los Hogares (ADRH). Variables: renta media por persona y por hogar
  a nivel de municipio, distrito y sección censal.

  Repo upstream donde lo tenemos versionado:
    https://github.com/jdalradius/spain-datasets

  Si no tienes ese repo clonado, descárgalo o indica una ruta
  alternativa con la variable de entorno SPAIN_DATASETS_CSV.

Uso:
  cd ~/OCRE
  python3 scripts/process-renta.py

Notas:
- Cobertura provincia 35: 698 secciones con dato de las 710 totales
  (98%); 12 secciones sin dato porque el INE censura por umbral de
  privacidad (poca población o muy pocos hogares declarantes).
- Renta varía de ~4.700 € (sección de menor renta) a ~27.000 €
  (residencial alto) — escala apropiada para coropleta cuantil.
"""
import csv
import json
import os
import sys
from collections import defaultdict

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_CSV = os.path.expanduser(
    '~/KOINOS/spain-datasets/data/Renta media en España.csv'
)
SRC = os.environ.get('SPAIN_DATASETS_CSV', DEFAULT_CSV)
OUT_SECCION = os.path.join(REPO, 'public', 'data', 'renta-seccion.json')
OUT_MUN = os.path.join(REPO, 'public', 'data', 'renta-municipio.json')


def main():
    if not os.path.exists(SRC):
        print(f'ERROR: {SRC} no existe.', file=sys.stderr)
        print('Ajusta SPAIN_DATASETS_CSV o clona', file=sys.stderr)
        print('  https://github.com/jdalradius/spain-datasets', file=sys.stderr)
        sys.exit(1)

    rows = list(csv.DictReader(open(SRC, encoding='utf-8')))
    prov35 = [r for r in rows if r.get('Código de provincia') == '35']
    print(f'Filas prov 35: {len(prov35):,}')

    # Por sección
    secciones = {}
    sin_dato = 0
    for r in prov35:
        if r.get('Tipo de elemento') != 'sección':
            continue
        cusec = r.get('Código de territorio', '').strip()
        if len(cusec) != 10:
            continue
        rp = (r.get('Renta media por persona') or '').strip()
        rh = (r.get('Renta media por hogar') or '').strip()
        if not rp:
            sin_dato += 1
            continue
        try:
            secciones[cusec] = {
                'renta': int(float(rp)),
                'hogar': int(float(rh)) if rh else None,
            }
        except ValueError:
            sin_dato += 1

    print(f'Secciones con renta: {len(secciones):,} (sin dato: {sin_dato})')

    os.makedirs(os.path.dirname(OUT_SECCION), exist_ok=True)
    with open(OUT_SECCION, 'w', encoding='utf-8') as f:
        json.dump(secciones, f, ensure_ascii=False, separators=(',', ':'))
    print(f'✓ {OUT_SECCION} ({os.path.getsize(OUT_SECCION) // 1024} KB)')

    # Por municipio (para futuras coropletas a nivel municipal)
    mun_data = {}
    for r in prov35:
        if r.get('Tipo de elemento') != 'municipio':
            continue
        cmun = r.get('Código de municipio', '').strip()
        rp = (r.get('Renta media por persona') or '').strip()
        rh = (r.get('Renta media por hogar') or '').strip()
        if cmun and rp:
            try:
                mun_data[cmun] = {
                    'nombre': r.get('Municipio', ''),
                    'renta': int(float(rp)),
                    'hogar': int(float(rh)) if rh else None,
                }
            except ValueError:
                pass

    with open(OUT_MUN, 'w', encoding='utf-8') as f:
        json.dump(mun_data, f, ensure_ascii=False, indent=2)
    print(f'✓ {OUT_MUN} ({len(mun_data)} municipios)')

    rentas = sorted(s['renta'] for s in secciones.values())
    if rentas:
        print(f'\nDistribución €/persona: min={rentas[0]} '
              f'p20={rentas[len(rentas)//5]} '
              f'mediana={rentas[len(rentas)//2]} '
              f'p80={rentas[len(rentas)*4//5]} '
              f'max={rentas[-1]}')


if __name__ == '__main__':
    main()
