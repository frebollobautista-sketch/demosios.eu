#!/usr/bin/env python3
"""
POLIS — Generador de piezas vectoriales (tangram de la isla).

Lee:
  - polis-data/secciones-censales-35016.json   (INE, 274 secciones con polígono)
  - polis-data/jerarquia-unificada.json        (municipio / distritos)
  - polis-piezas/_data/buildings.geojson       (43.690 edificios, extraídos de v16)
  - polis-piezas/_data/building-seccion-map.json (edificio → CUSEC)

Produce:
  - polis-piezas/municipios/svg/35016.svg             (contorno LPGC)
  - polis-piezas/distritos/svg/35016-DD.svg           (5 piezas)
  - polis-piezas/secciones/svg/{CUSEC}.svg            (274 piezas)
  - polis-piezas/edificios/svg/{CUSEC}.svg            (274 piezas, footprints dentro)
  - polis-piezas/*/png/*.png                           (preview thumbnails)
  - polis-piezas/MANIFEST.json                         (catálogo maestro)

Sistema de coordenadas:
  - Proyección equirectangular con corrección cos(lat)
  - 1 unidad SVG ≈ 1 metro
  - Origen = esquina NW del bbox global (Gran Canaria completa, para permitir extensión)
  - y invertida (norte hacia arriba en mundo → y=0 arriba en SVG)

Todas las piezas comparten el mismo marco, así que colocando cada SVG
en (piece.x, piece.y) con (piece.w, piece.h) del MANIFEST, el tablero
reconstruye la isla perfecta sin dependencia de mapa.
"""
import json
import math
import os
import sys
from pathlib import Path

_MAC = Path('/Users/panch/KOINOS')
_LINUX = Path('/sessions/exciting-funny-gates/mnt/KOINOS')
ROOT = _MAC if _MAC.exists() else _LINUX
PIEZAS = ROOT / 'polis-piezas'
DATA = ROOT / 'polis-data'
PIEZAS_DATA = PIEZAS / '_data'

# --- Bbox global: Gran Canaria entera (para extensión futura) ---
GC_BBOX = dict(min_lng=-15.85, max_lng=-15.35, min_lat=27.72, max_lat=28.19)
MID_LAT = (GC_BBOX['min_lat'] + GC_BBOX['max_lat']) / 2
COS_LAT = math.cos(math.radians(MID_LAT))
# 1° lat ≈ 110574 m, 1° lng ≈ 111320 * cos(lat) m
M_PER_DEG_LAT = 110574
M_PER_DEG_LNG = 111320 * COS_LAT


def project(lng, lat):
    """lat/lon (WGS84) -> (x, y) en metros sobre el marco global (origen NW)."""
    x = (lng - GC_BBOX['min_lng']) * M_PER_DEG_LNG
    y = (GC_BBOX['max_lat'] - lat) * M_PER_DEG_LAT  # y invertida
    return x, y


def path_from_coords(coords, close=True):
    """Construye un path SVG 'M x,y L ... Z' desde [[lng,lat],...]."""
    pts = [project(lng, lat) for lng, lat in coords]
    parts = [f"M{pts[0][0]:.2f},{pts[0][1]:.2f}"]
    for x, y in pts[1:]:
        parts.append(f"L{x:.2f},{y:.2f}")
    if close:
        parts.append("Z")
    return ''.join(parts)


def bbox_of_coords(coords_list_of_lists):
    """bbox (min_x, min_y, max_x, max_y) en unidades SVG a partir de listas lng/lat."""
    xs, ys = [], []
    for coords in coords_list_of_lists:
        for lng, lat in coords:
            x, y = project(lng, lat)
            xs.append(x)
            ys.append(y)
    return min(xs), min(ys), max(xs), max(ys)


def bbox_of_geojson(features, key='geometry'):
    xs, ys = [], []
    for f in features:
        g = f[key]
        if g['type'] == 'Polygon':
            rings = g['coordinates']
        elif g['type'] == 'MultiPolygon':
            rings = [r for poly in g['coordinates'] for r in poly]
        else:
            continue
        for ring in rings:
            for lng, lat in ring:
                x, y = project(lng, lat)
                xs.append(x)
                ys.append(y)
    return (min(xs), min(ys), max(xs), max(ys)) if xs else None


def svg_header(bbox, padding=5):
    """viewBox ajustada al bbox con padding (unidades = m)."""
    mnx, mny, mxx, mxy = bbox
    w = (mxx - mnx) + 2 * padding
    h = (mxy - mny) + 2 * padding
    vb = f"{mnx - padding:.2f} {mny - padding:.2f} {w:.2f} {h:.2f}"
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" '
            f'preserveAspectRatio="xMidYMid meet" data-origin="{mnx - padding:.2f},{mny - padding:.2f}">')


def load_all():
    sec_json = json.load(open(DATA / 'secciones-censales-35016.json'))
    jer = json.load(open(DATA / 'jerarquia-unificada.json'))
    buildings = json.load(open(PIEZAS_DATA / 'buildings.geojson'))
    bsm = json.load(open(PIEZAS_DATA / 'building-seccion-map.json'))
    return sec_json, jer, buildings, bsm


# ---------- generadores ----------

def gen_municipio(sec_json, out_svg):
    """Pieza municipio: todas las secciones como silueta única (color relleno)."""
    paths = []
    bbox_coords = []
    for cusec, s in sec_json['secciones'].items():
        paths.append(f'<path d="{path_from_coords(s["coords"])}" />')
        bbox_coords.append(s['coords'])
    bbox = bbox_of_coords(bbox_coords)
    body = (svg_header(bbox) +
            '<style>path{fill:#d9c9a3;stroke:#7a5f2e;stroke-width:8;stroke-linejoin:round;'
            'fill-rule:nonzero;vector-effect:non-scaling-stroke;}</style>'
            '<g fill="#d9c9a3" stroke="#7a5f2e" stroke-width="8" stroke-linejoin="round">'
            + ''.join(paths) + '</g></svg>')
    out_svg.write_text(body)
    return bbox


def gen_distrito(distrito_code, seccion_codes, sec_json, out_svg):
    paths = []
    bbox_coords = []
    for cusec in seccion_codes:
        s = sec_json['secciones'].get(cusec)
        if not s:
            continue
        paths.append(f'<path d="{path_from_coords(s["coords"])}" />')
        bbox_coords.append(s['coords'])
    if not bbox_coords:
        return None
    bbox = bbox_of_coords(bbox_coords)
    body = (svg_header(bbox) +
            '<g fill="#b08a5c" fill-opacity="0.85" stroke="#4a2e12" '
            'stroke-width="5" stroke-linejoin="round">'
            + ''.join(paths) + '</g></svg>')
    out_svg.write_text(body)
    return bbox


def gen_seccion(cusec, s, out_svg):
    bbox = bbox_of_coords([s['coords']])
    body = (svg_header(bbox) +
            '<g fill="#e8dcc0" fill-opacity="0.9" stroke="#333" '
            'stroke-width="3" stroke-linejoin="round">'
            f'<path d="{path_from_coords(s["coords"])}" /></g></svg>')
    out_svg.write_text(body)
    return bbox


def gen_edificios_de_seccion(cusec, s, buildings_by_sec, out_svg):
    """Pieza de edificios: contorno sección + footprints dentro."""
    sec_coords = s['coords']
    feats = buildings_by_sec.get(cusec, [])

    # bbox = sección (para fijar marco uniforme con pieza sección)
    bbox = bbox_of_coords([sec_coords])

    parts = [svg_header(bbox)]
    # fondo sección muy tenue para referencia
    parts.append(
        '<path d="' + path_from_coords(sec_coords) + '" '
        'fill="#f5eedd" stroke="#aaa" stroke-width="2" stroke-dasharray="4 3"/>'
    )
    # edificios
    parts.append('<g fill="#2d2d2d" stroke="#111" stroke-width="0.6" fill-opacity="0.85">')
    for f in feats:
        g = f['geometry']
        if g['type'] == 'Polygon':
            rings = g['coordinates']
        elif g['type'] == 'MultiPolygon':
            rings = [r for poly in g['coordinates'] for r in poly]
        else:
            continue
        for ring in rings:
            parts.append(f'<path d="{path_from_coords(ring)}" />')
    parts.append('</g></svg>')
    out_svg.write_text(''.join(parts))
    return bbox, len(feats)


def main():
    sec_json, jer, buildings, bsm = load_all()

    # prepara out dirs
    for sub in ['municipios', 'distritos', 'secciones', 'edificios']:
        (PIEZAS / sub / 'svg').mkdir(parents=True, exist_ok=True)
        (PIEZAS / sub / 'png').mkdir(parents=True, exist_ok=True)

    manifest = {
        'generado': __import__('datetime').datetime.utcnow().isoformat() + 'Z',
        'proyeccion': {
            'tipo': 'equirectangular_cos_lat',
            'origen_lng': GC_BBOX['min_lng'],
            'origen_lat': GC_BBOX['max_lat'],
            'm_per_deg_lat': M_PER_DEG_LAT,
            'm_per_deg_lng': M_PER_DEG_LNG,
            'unidad_svg': 'metros',
            'y_invertida': True,
            'bbox_global_lng_lat': GC_BBOX,
        },
        'municipios': {},
    }

    # --- MUNICIPIO 35016 ---
    print('→ municipio 35016...')
    mun_svg = PIEZAS / 'municipios' / 'svg' / '35016.svg'
    mun_bbox = gen_municipio(sec_json, mun_svg)

    mun_entry = {
        'codigo_ine': '35016',
        'nombre': 'Las Palmas de Gran Canaria',
        'svg': 'municipios/svg/35016.svg',
        'png': 'municipios/png/35016.png',
        'bbox': list(mun_bbox),
        'bbox_w': mun_bbox[2] - mun_bbox[0],
        'bbox_h': mun_bbox[3] - mun_bbox[1],
        'distritos': {},
    }

    # --- DISTRITOS ---
    print('→ 5 distritos...')
    for dcode, d in sec_json['distritos'].items():
        dkey = f'35016-{dcode}'
        svg_path = PIEZAS / 'distritos' / 'svg' / f'{dkey}.svg'
        bbox = gen_distrito(dcode, d['secciones'], sec_json, svg_path)
        if bbox is None:
            continue
        mun_entry['distritos'][dcode] = {
            'codigo': dcode,
            'nombre': d['nombre'],
            'n_secciones': d['n_secciones'],
            'svg': f'distritos/svg/{dkey}.svg',
            'png': f'distritos/png/{dkey}.png',
            'bbox': list(bbox),
            'bbox_w': bbox[2] - bbox[0],
            'bbox_h': bbox[3] - bbox[1],
            'secciones': {},
        }

    # --- indexa edificios por sección ---
    print('→ indexando edificios por sección...')
    by_sec = {}
    for f in buildings['features']:
        bid = str(f['properties'].get('id'))
        cusec = bsm.get(bid)
        if not cusec:
            continue
        by_sec.setdefault(cusec, []).append(f)
    total_feats = sum(len(v) for v in by_sec.values())
    print(f'   {total_feats} edificios asignados a {len(by_sec)} secciones')

    # --- SECCIONES + EDIFICIOS ---
    print('→ 274 secciones + edificios...')
    n_done = 0
    n_emp = 0
    for cusec, s in sec_json['secciones'].items():
        dcode = s['distrito']
        sec_svg = PIEZAS / 'secciones' / 'svg' / f'{cusec}.svg'
        sec_bbox = gen_seccion(cusec, s, sec_svg)

        ed_svg = PIEZAS / 'edificios' / 'svg' / f'{cusec}.svg'
        ed_bbox, n_ed = gen_edificios_de_seccion(cusec, s, by_sec, ed_svg)

        if n_ed == 0:
            n_emp += 1

        if dcode in mun_entry['distritos']:
            mun_entry['distritos'][dcode]['secciones'][cusec] = {
                'cusec': cusec,
                'distrito': dcode,
                'seccion': s['seccion'],
                'barrio': s.get('barrio'),
                'centroide': s['centroide'],
                'n_puntos': s['n_puntos'],
                'n_edificios': n_ed,
                'svg_contorno': f'secciones/svg/{cusec}.svg',
                'png_contorno': f'secciones/png/{cusec}.png',
                'svg_edificios': f'edificios/svg/{cusec}.svg',
                'png_edificios': f'edificios/png/{cusec}.png',
                'bbox': list(sec_bbox),
                'bbox_w': sec_bbox[2] - sec_bbox[0],
                'bbox_h': sec_bbox[3] - sec_bbox[1],
            }
        n_done += 1
        if n_done % 50 == 0:
            print(f'   ...{n_done}/274')
    print(f'   {n_emp} secciones sin edificios mapeados')

    manifest['municipios']['35016'] = mun_entry

    # resumen
    manifest['resumen'] = {
        'n_municipios': len(manifest['municipios']),
        'n_distritos': sum(len(m['distritos']) for m in manifest['municipios'].values()),
        'n_secciones': sum(len(d['secciones']) for m in manifest['municipios'].values() for d in m['distritos'].values()),
        'n_edificios_total': total_feats,
        'n_piezas_svg': 1 + 5 + 274 + 274,  # mun + distritos + secciones + edificios
    }

    out = PIEZAS / 'MANIFEST.json'
    out.write_text(json.dumps(manifest, indent=2, ensure_ascii=False))
    print(f'\n✓ MANIFEST escrito en {out}')
    print('  resumen:', manifest['resumen'])


if __name__ == '__main__':
    main()
