#!/usr/bin/env python3
"""Renderiza un PNG preview (~512px máx) para cada SVG generado."""
import os, sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

_MAC = Path('/Users/panch/KOINOS')
_LINUX = Path('/sessions/exciting-funny-gates/mnt/KOINOS')
ROOT = _MAC if _MAC.exists() else _LINUX
PIEZAS = ROOT / 'polis-piezas'

try:
    import cairosvg
except ImportError:
    print('ERROR: pip install cairosvg --break-system-packages')
    sys.exit(1)


def render(svg_path: Path, png_path: Path, max_px=512):
    try:
        png_path.parent.mkdir(parents=True, exist_ok=True)
        # parse viewBox para decidir proporciones
        import re
        txt = svg_path.read_text()
        m = re.search(r'viewBox="([\d\.\-\s]+)"', txt)
        if not m:
            return f'no viewBox in {svg_path.name}'
        _, _, w, h = [float(v) for v in m.group(1).split()]
        if w >= h:
            ow, oh = max_px, int(max_px * h / w)
        else:
            oh, ow = max_px, int(max_px * w / h)
        if ow < 32: ow = 32
        if oh < 32: oh = 32
        cairosvg.svg2png(
            bytestring=txt.encode('utf-8'),
            write_to=str(png_path),
            output_width=ow,
            output_height=oh,
            background_color='#fff8e7' if 'edificios' not in str(png_path) else '#f5eedd',
        )
        return None
    except Exception as e:
        return f'{svg_path.name}: {e}'


def all_jobs():
    jobs = []
    for sub in ['municipios', 'distritos', 'secciones', 'edificios']:
        svg_dir = PIEZAS / sub / 'svg'
        png_dir = PIEZAS / sub / 'png'
        for svg in sorted(svg_dir.glob('*.svg')):
            png = png_dir / (svg.stem + '.png')
            jobs.append((svg, png))
    return jobs


def main():
    jobs = all_jobs()
    print(f'{len(jobs)} piezas a renderizar')
    errs = []
    done = 0
    with ThreadPoolExecutor(max_workers=6) as ex:
        futs = {ex.submit(render, s, p): (s, p) for s, p in jobs}
        for fut in as_completed(futs):
            err = fut.result()
            if err:
                errs.append(err)
            done += 1
            if done % 50 == 0:
                print(f'  ...{done}/{len(jobs)}')
    print(f'✓ {done - len(errs)} PNG generados, {len(errs)} errores')
    if errs:
        for e in errs[:10]:
            print('  !', e)


if __name__ == '__main__':
    main()
