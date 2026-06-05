#!/usr/bin/env python3
"""Re-packs section packs por isla, reusa `packages.pack.batch` con
preview.png stub (tiny placeholder) y sin contact_sheet.

Uso:
    KOINOS_OSM_DIR=$PWD/public/osm-prov38 \
    python3 scripts/_repack_sections_buildings.py --isla tf

    python3 scripts/_repack_sections_buildings.py --isla gc

`KOINOS_SECCIONES_FILE` se fuerza a public/canarias-secciones-lite.json.
"""
from __future__ import annotations
import argparse
import os
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
os.environ.setdefault("KOINOS_SECCIONES_FILE",
                      str(ROOT / "public" / "canarias-secciones-lite.json"))
sys.path.insert(0, str(ROOT))

from packages.pack import pack_section as iso_pack  # noqa: E402
from packages.pack import batch as iso_batch  # noqa: E402
from PIL import Image  # noqa: E402
import json  # noqa: E402


def _stub_preview(out_path, **_kwargs):
    # preview.png placeholder 1x1 — los previews detallados se regeneran
    # luego con `batch.py --skip-existing` si hace falta para contact_sheet.
    Image.new("RGB", (1, 1), iso_pack.KOINOS_PALETTE["cream"]).save(out_path)


def _cusecs_for_isla(isla: str) -> list[str]:
    """Lista de cusecs de la isla, filtrando por prov para evitar el
    bug de mun "013" que existe en gc Y eh."""
    muns = iso_batch.ISLA_MUNS[isla]
    prov = iso_batch.ISLA_PROV[isla]
    sections = json.load(open(iso_pack.SECCIONES_FILE, encoding="utf-8"))
    out = sorted({f["properties"]["cusec"]
                  for f in sections["features"]
                  if f["properties"].get("mun") in muns
                  and f["properties"]["cusec"].startswith(prov)})
    return out


def main():
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--isla", choices=sorted(iso_batch.ISLA_MUNS.keys()))
    g.add_argument("--prov", choices=["35", "38"],
                   help="Procesa todas las islas de la prov (35=gc/fv/lz, "
                        "38=tf/lp/lg/eh). Reusa los datasets OSM una sola vez.")
    g.add_argument("--cusecs", nargs="+",
                   help="Lista explícita de cusecs (sobrescribe isla/prov)")
    ap.add_argument("--out-dir",
                    default=str(ROOT / "public" / "sections_pack"))
    ap.add_argument("--limit", type=int, default=None)
    args = ap.parse_args()

    iso_pack.render_preview = _stub_preview

    if args.cusecs:
        cusecs = sorted(args.cusecs)
        label = f"custom ({len(cusecs)} cusecs)"
    elif args.prov:
        cusecs = []
        for isla, prov in iso_batch.ISLA_PROV.items():
            if prov == args.prov:
                cusecs.extend(_cusecs_for_isla(isla))
        cusecs = sorted(set(cusecs))
        label = f"prov {args.prov}"
    else:
        cusecs = _cusecs_for_isla(args.isla)
        label = f"isla {args.isla}"

    if args.limit:
        cusecs = cusecs[:args.limit]
    print(f"{label}: {len(cusecs)} cusecs a procesar")

    sys.argv = [sys.argv[0],
                "--cusecs"] + cusecs + [
                "--out-dir", args.out_dir,
                "--no-contact-sheet",
                "--no-manifest"]
    iso_batch.main()


if __name__ == "__main__":
    main()
