#!/usr/bin/env python3
"""Genera tejido-social-canarias-v2.geojson más compacto y útil.

Estrategia:
  - Entidades con geocode preciso (ok-native, ok-street) → feature
    individual (calidad alta).
  - Entidades con geocode ok-municipio / ok-municipio-centroide
    → AGRUPADAS por (mun, categoría) en un single feature-cluster con
    count. El visor las pinta como un único pin "Ag·N" en el centroide
    del mun.

Resultado esperado: 25.286 → ~3.700 individuales + ~600 clusters mun.
Tamaño 8 MB → ~1.5-2 MB.
"""
from __future__ import annotations
import json
import pathlib
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parent.parent
ENT_DIR = ROOT / "public" / "data" / "entidades"
OUT = ROOT / "public" / "data" / "tejido-social-canarias-v2.geojson"
ISLAS = ["gc", "tf", "lp", "lg", "eh", "fv", "lz"]

PRECISE_STATUSES = frozenset({"ok-native", "ok-street"})
MUN_STATUSES = frozenset({"ok-municipio", "ok-municipio-centroide"})


def _categoria_from(e: dict) -> str:
    fuente = (e.get("fuente") or "").lower()
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
    return "asociacion_cultural"


def main() -> None:
    precise = []  # feature individuales
    mun_groups: dict[tuple, list] = defaultdict(list)  # (mun, cat) → [entidades]

    for isla_key in ISLAS:
        path = ENT_DIR / f"{isla_key}.json"
        if not path.exists():
            continue
        raw = json.load(open(path, encoding="utf-8"))
        ents = raw.get("entidades") if isinstance(raw, dict) else raw
        for e in ents:
            lat = e.get("lat")
            lon = e.get("lon") or e.get("lng")
            if lat is None or lon is None:
                continue
            try:
                lat = float(lat); lon = float(lon)
            except Exception:
                continue
            if not (-18.5 <= lon <= -13.2 and 27.4 <= lat <= 29.6):
                continue
            status = e.get("geocode_status") or ""
            cat = _categoria_from(e)
            base_props = {
                "id": e.get("id"),
                "nombre": e.get("nombre"),
                "categoria": cat,
                "municipio": e.get("municipio"),
                "isla": e.get("isla"),
                "fuente": e.get("fuente"),
                "activa": bool(e.get("tiene_email") or e.get("tiene_telefono") or e.get("tiene_web")),
                "web": e.get("web") if e.get("tiene_web") else None,
            }
            if status in PRECISE_STATUSES:
                precise.append({
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]},
                    "properties": base_props,
                })
            elif status in MUN_STATUSES:
                key = (e.get("municipio") or "?", cat)
                mun_groups[key].append((lon, lat, base_props))

    # Para cada (mun, cat) agrupado, generar UN feature con centroide
    # promedio y count, además de nombres sample para tooltip
    cluster_feats = []
    for (mun, cat), items in mun_groups.items():
        n = len(items)
        cx = sum(it[0] for it in items) / n
        cy = sum(it[1] for it in items) / n
        sample = [it[2]["nombre"] for it in items[:5]]
        # algún nombre representativo de la fuente
        cluster_feats.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(cx, 6), round(cy, 6)]},
            "properties": {
                "id": f"cl-{mun}-{cat}".lower().replace(" ", "_"),
                "nombre": f"{n} entidades en {mun}",
                "categoria": cat,
                "municipio": mun,
                "isla": items[0][2].get("isla"),
                "activa": sum(1 for it in items if it[2].get("activa")),
                "fuente": "cluster-municipio",
                "count": n,
                "sample_nombres": sample,
            },
        })

    all_feats = precise + cluster_feats
    out = {
        "type": "FeatureCollection",
        "features": all_feats,
        "metadata": {
            "generated_at": __import__("datetime").datetime.now().isoformat(),
            "n_precise": len(precise),
            "n_cluster_mun": len(cluster_feats),
            "n_total": len(all_feats),
            "source": "data/entidades/{isla}.json",
            "note": "Geocode preciso → individual; geocode mun → 1 feature por (mun, cat)",
        },
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    size_kb = OUT.stat().st_size / 1024
    print(f"\n→ {OUT.name}")
    print(f"  {len(precise)} precise + {len(cluster_feats)} clusters mun = {len(all_feats)} features")
    print(f"  {size_kb:.0f} KB (orig: ~8.000 KB)")


if __name__ == "__main__":
    main()
