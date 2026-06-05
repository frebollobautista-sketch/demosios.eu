#!/usr/bin/env python3
"""Retry para cusecs que fallaron por GEOSException en extract_manzanas.

Reemplaza extract_manzanas por una versión con make_valid() después del
buffer y antes del unary_union, lo cual sanea polígonos con topology
inválida (que es lo que rompía el batch anterior).

Uso:
    KOINOS_OSM_DIR=$PWD/public/osm-prov38 \
    python3 scripts/_retry_failed_packs.py 3801701018 3802202002 3803103005 3803601002
"""
from __future__ import annotations
import os
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
os.environ.setdefault("KOINOS_SECCIONES_FILE",
                      str(ROOT / "public" / "canarias-secciones-lite.json"))
sys.path.insert(0, str(ROOT))

from PIL import Image  # noqa: E402
from shapely.geometry import Polygon, MultiPolygon  # noqa: E402
from shapely.ops import unary_union  # noqa: E402

from packages.pack import pack_section as iso_pack  # noqa: E402


_orig_extract = iso_pack.extract_manzanas


def _safer_extract_manzanas(polys, heights, buf=3.5):
    if not polys:
        return []
    expanded = []
    for p in polys:
        try:
            e = p.buffer(buf, join_style=2)
            if e is None or e.is_empty:
                continue
            if not e.is_valid:
                e = iso_pack._repair_geom(e)
                if e is None or e.is_empty:
                    continue
            expanded.append(e)
        except Exception:
            continue
    if not expanded:
        return []
    try:
        merged = unary_union(expanded)
    except Exception:
        # Fallback: union por pares con repair entre cada par.
        merged = expanded[0]
        for nxt in expanded[1:]:
            try:
                merged = merged.union(nxt)
            except Exception:
                merged = iso_pack._repair_geom(merged) or merged
                try:
                    merged = merged.union(nxt)
                except Exception:
                    continue  # descartar este; mantener la unión parcial
        if merged is None:
            return []
    merged_polys = ([merged] if isinstance(merged, Polygon)
                    else list(merged.geoms))
    manzanas = []
    for m in merged_polys:
        try:
            s = m.buffer(-buf * 0.9, join_style=2)
            if s.is_empty:
                continue
            if isinstance(s, Polygon):
                manzanas.append(s)
            else:
                manzanas.extend(list(s.geoms))
        except Exception:
            continue
    from shapely.geometry import Point
    centroids = [p.centroid for p in polys]
    out = []
    for mz in manzanas:
        idx = [i for i, c in enumerate(centroids) if mz.contains(c)]
        if not idx:
            idx = [i for i, c in enumerate(centroids)
                   if mz.intersects(polys[i])]
        if not idx:
            continue
        h_med = sorted(heights[i] for i in idx)[len(idx) // 2]
        out.append((mz, h_med, len(idx)))
    return out


def _stub_preview(out_path, **_kwargs):
    Image.new("RGB", (1, 1), iso_pack.KOINOS_PALETTE["cream"]).save(out_path)


def main():
    cusecs = sys.argv[1:]
    if not cusecs:
        print("Uso: _retry_failed_packs.py CUSEC1 CUSEC2 ...")
        sys.exit(1)

    iso_pack.extract_manzanas = _safer_extract_manzanas
    iso_pack.render_preview = _stub_preview

    out_dir = ROOT / "public" / "sections_pack"
    ok = 0
    fail = []
    for c in cusecs:
        try:
            pack_dir, elapsed, stats, n_mz, *_ = iso_pack.build_pack(
                c, out_dir, verbose=True)
            print(f"  ✓ {c}: {stats['n_edif']} edif, {n_mz} mz, {elapsed:.1f}s")
            ok += 1
        except Exception as e:
            print(f"  ✗ {c}: {type(e).__name__}: {e}")
            fail.append(c)
    print(f"\n{ok} OK / {len(fail)} fail")
    if fail:
        print("Fallaron de nuevo:", fail)


if __name__ == "__main__":
    main()
