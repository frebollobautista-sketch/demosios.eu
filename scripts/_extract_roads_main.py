#!/usr/bin/env python3
"""Extrae solo highways principales (motorway/trunk/primary/secondary)
desde osm-{gc,prov38}/roads.json hacia roads-main.json.

Estos son los road tipos que el visor pinta a nivel municipio (renderer.js
drawMunicipioRoads). El archivo completo es 38-48 MB por isla; el filtrado
suele bajar a 1-3 MB. La carga al entrar a municipio se acelera ~20×.
"""
from __future__ import annotations
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
KEEP = frozenset({"motorway", "trunk", "primary", "secondary"})

SOURCES = [
    PUBLIC / "osm-gc" / "roads.json",
    PUBLIC / "osm-prov38" / "roads.json",
]


def main() -> None:
    for src in SOURCES:
        if not src.exists():
            print(f"⚠ no encontrado {src}")
            continue
        fc = json.load(open(src, encoding="utf-8"))
        feats = fc.get("features", []) or []
        kept = []
        for f in feats:
            props = f.get("properties") or {}
            hw = props.get("highway") or props.get("type") or ""
            if hw not in KEEP:
                continue
            g = f.get("geometry")
            if not g or g.get("type") != "LineString":
                continue
            kept.append({
                "type": "Feature",
                "geometry": g,
                "properties": {
                    "highway": hw,
                    # Mantener nombre si existe (para potencial search.js)
                    "name": props.get("name", ""),
                },
            })
        out_path = src.parent / "roads-main.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump({"type": "FeatureCollection", "features": kept},
                      f, ensure_ascii=False, separators=(",", ":"))
        size_kb = out_path.stat().st_size / 1024
        src_kb = src.stat().st_size / 1024
        ratio = 100 * size_kb / src_kb
        print(f"{src.name:25} → {out_path.name:20} {len(kept):>5} feats · {size_kb:>7.0f} KB ({ratio:.1f}% del original {src_kb:.0f} KB)")


if __name__ == "__main__":
    main()
