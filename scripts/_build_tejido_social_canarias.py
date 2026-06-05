#!/usr/bin/env python3
"""Combina los 7 archivos data/entidades/{isla}.json (geocoded) en un
tejido-social-canarias.geojson con la forma que espera el overlay
tejido-social.js (Feature Point + properties{id, nombre, categoria,
municipio, que_hace}).

Cada entidad se mapea a una categoría del CAT_STYLE del overlay según
su `fuente`/`tipo`/`actividad`. La actividad libre se preserva en
`que_hace` (truncada a 200 chars).
"""
from __future__ import annotations
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
ENT_DIR = ROOT / "public" / "data" / "entidades"
OUT_PATH = ROOT / "public" / "data" / "tejido-social-canarias.geojson"

ISLAS = ["gc", "tf", "lp", "lg", "eh", "fv", "lz"]


def _categoria_from(e: dict) -> str:
    """Mapeo grueso de fuente/actividad a categorías del overlay."""
    fuente = (e.get("fuente") or "").lower()
    tipo = (e.get("tipo") or "").lower()
    actividad = (e.get("actividad") or "").lower()
    nombre = (e.get("nombre") or "").lower()

    if "fundacion" in fuente or "fundación" in actividad:
        return "espacio_comunitario"
    if "cooperativa" in nombre or "cooperativa" in actividad or "soc. coop" in nombre:
        return "cooperativa"
    if "vecinos" in nombre or "vecinal" in nombre or "asoc. de vecinos" in nombre:
        return "asociacion_vecinos"
    if "biblioteca" in nombre:
        return "biblioteca_popular"
    if "huerto" in nombre:
        return "huerto_urbano"
    if "centro social" in nombre or "casa del pueblo" in nombre:
        return "centro_social"
    # asociación cultural por defecto (cubre la mayoría de asociaciones)
    return "asociacion_cultural"


def main() -> None:
    features: list = []
    dropped_no_geo = 0
    dropped_out = 0
    for isla in ISLAS:
        path = ENT_DIR / f"{isla}.json"
        if not path.exists():
            print(f"⚠ no encontrado {path}")
            continue
        raw = json.load(open(path, encoding="utf-8"))
        ents = raw.get("entidades") if isinstance(raw, dict) else raw
        n_ok = 0
        for e in ents:
            lat = e.get("lat")
            lon = e.get("lon") or e.get("lng")
            if lat is None or lon is None:
                dropped_no_geo += 1
                continue
            try:
                lat = float(lat); lon = float(lon)
            except Exception:
                dropped_no_geo += 1
                continue
            # Sanity bbox Canarias: lon -18.3..-13.3, lat 27.5..29.5
            if not (-18.5 <= lon <= -13.2 and 27.4 <= lat <= 29.6):
                dropped_out += 1
                continue
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [round(lon, 6), round(lat, 6)],
                },
                "properties": {
                    "id": e.get("id"),
                    "nombre": e.get("nombre"),
                    "categoria": _categoria_from(e),
                    "municipio": e.get("municipio"),
                    "isla": e.get("isla"),
                    "fuente": e.get("fuente"),
                    "que_hace": (e.get("actividad") or "")[:200],
                },
            })
            n_ok += 1
        print(f"{isla}: {n_ok} features OK ({len(ents)} en raw)")

    out = {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "generated_at": __import__("datetime").datetime.now().isoformat(),
            "source": "data/entidades/{isla}.json (geocoded)",
            "n_features": len(features),
            "dropped_no_geo": dropped_no_geo,
            "dropped_out_bbox": dropped_out,
        },
    }
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    size_mb = OUT_PATH.stat().st_size / 1024 / 1024
    print(f"\n→ {OUT_PATH} · {len(features)} features · {size_mb:.1f} MB")
    print(f"  dropped sin geo: {dropped_no_geo}, fuera bbox: {dropped_out}")


if __name__ == "__main__":
    main()
