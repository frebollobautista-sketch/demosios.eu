#!/usr/bin/env python3
"""
Asigna secciones a los barrios prov 38 (Tenerife/LP/LG/EH) cuyo campo
`secciones_origen` está vacío en barrios-canonical.json. Sin secciones
asignadas, loadBarrio() lanza "sin secciones válidas" y el tap muere
silenciosamente — el bug que Pancho reporta como "no clicable prov 38".

Estrategia:
1. Lee barrios-canonical.json + prov38-secciones-lite.json.
2. Por cada sección prov 38 con cusec.startswith("38"):
   a. Calcula centroide.
   b. Busca entre los barrios DEL MISMO MUN (3-dig último) qué polígono
      contiene el centroide (point-in-polygon, shapely).
   c. Si lo contiene → añade cusec al `secciones_origen` del barrio.
   d. Si no lo contiene ninguno → asigna al barrio con centroide más
      cercano (Voronoi-like fallback) → garantiza 0 huérfanos.
3. Hace backup y reescribe barrios-canonical.json.

Idempotente: si el barrio YA tiene cusecs asignados, los preserva (sólo
añade los faltantes que coincidan por mun).
"""

import json
import math
import sys
from collections import defaultdict
from pathlib import Path

from shapely.geometry import Polygon, Point, MultiPolygon, shape

ROOT = Path("/Users/panch/KOINOS-iso/public")
BARRIOS = ROOT / "data" / "barrios-canonical.json"
SEC_LITE = ROOT / "prov38-secciones-lite.json"
BACKUP = ROOT / "data" / "barrios-canonical.backup-pre-prov38-assign-20260524.json"


def main():
    # Backup
    if not BACKUP.exists():
        BACKUP.write_text(BARRIOS.read_text())
        print(f"backup: {BACKUP}", file=sys.stderr)

    with open(BARRIOS) as f:
        bdata = json.load(f)
    with open(SEC_LITE) as f:
        secdata = json.load(f)

    # Identifica barrios prov 38 (mun startswith "38" o id startswith
    # algún código que mapea a prov 38). Por convención el campo `mun` los
    # tiene como "35XXX" (data legacy mal etiquetada), pero el id tiene
    # 3 dígitos al inicio, así que validamos por TIPO de mun via el cumun
    # que sale de prov38-secciones-lite (mun 3-dig + cusec[0:2]="38").
    prov38_mun3 = set()
    for f in secdata["features"]:
        if f["properties"]["cusec"].startswith("38"):
            prov38_mun3.add(f["properties"]["mun"])
    print(f"prov 38 muns en secciones-lite: {len(prov38_mun3)}", file=sys.stderr)

    # Index barrios prov 38 por mun3 (el mun3 sale del prefijo del id)
    barrios_by_mun3 = defaultdict(list)
    for bid, meta in bdata["barrios"].items():
        # mun3 desde el id (primeros 3 chars antes del dash)
        if "-" not in bid:
            continue
        bid_mun = bid.split("-")[0]
        if bid_mun not in prov38_mun3:
            continue
        # Skip si el barrio mun NO es prov 38 (el campo `mun` mal etiquetado
        # incluye barrios prov 35 con id "001-…" — descartamos cruzando
        # con prov38_mun3 que es nuestra verdad de origen para prov 38).
        # Nota: prov 35 también puede tener muns "001"..."035", así que esto
        # no es perfecto. Para evitar contaminación, exigimos que `geometria`
        # esté en territorio prov 38 (centroide.lng < -16, lat ~28).
        cen = meta.get("centroide") or []
        if not cen or len(cen) != 2:
            continue
        lng, lat = cen[0], cen[1]
        # Filtro geográfico: prov 38 cubre lng ≈ [-18.2, -16.1], lat ≈ [27.6, 28.9].
        # Prov 35: lng ≈ [-16.0, -13.4]. Si lng < -16 → prov 38.
        if lng > -16.0:
            continue
        barrios_by_mun3[bid_mun].append((bid, meta))

    print(f"barrios prov 38 indexados: {sum(len(v) for v in barrios_by_mun3.values())} en {len(barrios_by_mun3)} muns", file=sys.stderr)

    # Construye polígonos shapely para cada barrio (cache).
    def build_geom(meta):
        g = meta.get("geometria") or {}
        if not g.get("type"):
            return None
        try:
            return shape(g)
        except Exception:
            return None

    barrio_polys = {}
    barrio_centroids = {}
    for mun3, items in barrios_by_mun3.items():
        for bid, meta in items:
            poly = build_geom(meta)
            if poly is None or poly.is_empty:
                continue
            barrio_polys[bid] = poly
            barrio_centroids[bid] = poly.centroid

    # Recorre secciones prov 38, asigna a barrio por point-in-polygon o
    # por nearest centroid si nadie la contiene.
    assigned = defaultdict(set)  # bid → set of cusecs
    n_inside = 0
    n_fallback = 0
    n_no_barrios = 0
    for f in secdata["features"]:
        cusec = f["properties"]["cusec"]
        if not cusec.startswith("38"):
            continue
        mun3 = f["properties"]["mun"]
        candidates = barrios_by_mun3.get(mun3, [])
        if not candidates:
            n_no_barrios += 1
            continue
        # Centroide sección
        try:
            sec_poly = shape(f["geometry"])
            sec_cen = sec_poly.centroid
        except Exception:
            continue

        # Point-in-polygon
        winner = None
        for bid, _ in candidates:
            poly = barrio_polys.get(bid)
            if poly and poly.covers(sec_cen):
                winner = bid
                break
        if winner is None:
            # Fallback: barrio con centroide más cercano (mismo mun)
            best_d = math.inf
            for bid, _ in candidates:
                cen = barrio_centroids.get(bid)
                if not cen:
                    continue
                d = sec_cen.distance(cen)
                if d < best_d:
                    best_d = d
                    winner = bid
            n_fallback += 1
        else:
            n_inside += 1

        if winner:
            assigned[winner].add(cusec)

    print(f"  point-in-polygon hits: {n_inside}", file=sys.stderr)
    print(f"  nearest-centroid fallbacks: {n_fallback}", file=sys.stderr)
    print(f"  sin barrios para su mun: {n_no_barrios}", file=sys.stderr)

    # Actualiza barrios-canonical en memoria: añade los cusecs nuevos al
    # secciones_origen del barrio (preservando los que ya existan; el
    # script es idempotente).
    n_updated = 0
    n_new_cusecs = 0
    for bid, cusecs in assigned.items():
        meta = bdata["barrios"][bid]
        existing = set(meta.get("secciones_origen") or [])
        merged = sorted(existing | cusecs)
        new = len(merged) - len(existing)
        if new > 0:
            meta["secciones_origen"] = merged
            n_updated += 1
            n_new_cusecs += new

    print(f"barrios actualizados: {n_updated}", file=sys.stderr)
    print(f"cusecs nuevos añadidos: {n_new_cusecs}", file=sys.stderr)

    BARRIOS.write_text(json.dumps(bdata, ensure_ascii=False) + "\n")
    print(f"wrote {BARRIOS}", file=sys.stderr)


if __name__ == "__main__":
    main()
