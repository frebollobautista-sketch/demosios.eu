#!/usr/bin/env python3
"""Genera barrios-canonical-lite.json: misma estructura que
barrios-canonical.json pero SIN el campo `geometria` (que son los
polígonos full, 7.4 MB→~400 KB).

El visor solo necesita el índice cusec→barrioId + metadatos básicos al
boot. Las geometrías se cargan lazy cuando el usuario entra a un barrio
específico (loadBarrio() puede pedir el JSON completo si las necesita).
"""
from __future__ import annotations
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "public" / "data" / "barrios-canonical.json"
OUT = ROOT / "public" / "data" / "barrios-canonical-lite.json"

DROP_KEYS = frozenset({"geometria", "geometry"})


def main() -> None:
    data = json.load(open(SRC, encoding="utf-8"))
    barrios = data.get("barrios") or {}
    n = 0
    for bid, b in barrios.items():
        for k in list(b.keys()):
            if k in DROP_KEYS:
                del b[k]
        n += 1
    out = {
        "version": data.get("version") or "lite-v1",
        "generated_from": "barrios-canonical.json",
        "barrios": barrios,
        "_lite": True,  # señal para que el cliente sepa que no hay geometrías
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    src_kb = SRC.stat().st_size / 1024
    out_kb = OUT.stat().st_size / 1024
    print(f"{n} barrios · {src_kb:.0f} KB → {out_kb:.0f} KB ({100*out_kb/src_kb:.1f}%)")


if __name__ == "__main__":
    main()
