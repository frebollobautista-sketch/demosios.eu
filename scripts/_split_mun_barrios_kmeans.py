#!/usr/bin/env python3
"""Divide barrios sintéticos `*-mun` con >15 secciones en sub-barrios
sintéticos `*-z1`, `*-z2`, ..., usando k-means simple sobre los
centroides de las secciones.

Output: barrios-canonical-lite.json AUMENTADO con los sub-barrios.
Los barrios -mun originales se MANTIENEN (back-compat); los nuevos
sub-barrios `-z*` se añaden como entradas paralelas.

K se determina por número de secciones:
  >100 → K=8
  >50  → K=5
  >25  → K=4
  >15  → K=3
"""
from __future__ import annotations
import json
import math
import pathlib
import random
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
LITE = PUBLIC / "data" / "barrios-canonical-lite.json"
SECS_FILES = {
    "prov35": PUBLIC / "gc-secciones-lite.json",
    "prov38": PUBLIC / "prov38-secciones-lite.json",
}

random.seed(42)


def ring_centroid(ring):
    n = len(ring)
    sx = sum(p[0] for p in ring)
    sy = sum(p[1] for p in ring)
    return (sx / n, sy / n)


def ring_bbox(ring):
    xs = [p[0] for p in ring]
    ys = [p[1] for p in ring]
    return [min(xs), min(ys), max(xs), max(ys)]


def kmeans(points, k, iters=40):
    """Lloyd's k-means simple. points: list of (x, y). Devuelve labels."""
    if k <= 1 or len(points) <= k:
        return [i % k for i in range(len(points))]
    # Init: k-means++ light: pick first random, luego más lejano N-1 veces.
    centers = [points[random.randrange(len(points))]]
    while len(centers) < k:
        best = None; bestd = -1
        for p in points:
            d = min((p[0]-c[0])**2 + (p[1]-c[1])**2 for c in centers)
            if d > bestd: bestd = d; best = p
        centers.append(best)

    labels = [0] * len(points)
    for _ in range(iters):
        # assign
        new_labels = []
        for p in points:
            bi, bd = 0, math.inf
            for ci, c in enumerate(centers):
                d = (p[0]-c[0])**2 + (p[1]-c[1])**2
                if d < bd: bd = d; bi = ci
            new_labels.append(bi)
        if new_labels == labels:
            break
        labels = new_labels
        # update centers
        sums = [[0.0, 0.0, 0] for _ in range(k)]
        for p, lbl in zip(points, labels):
            sums[lbl][0] += p[0]
            sums[lbl][1] += p[1]
            sums[lbl][2] += 1
        for ci in range(k):
            if sums[ci][2] > 0:
                centers[ci] = (sums[ci][0]/sums[ci][2], sums[ci][1]/sums[ci][2])
    return labels


def _k_for(n):
    if n > 100: return 8
    if n > 50: return 5
    if n > 25: return 4
    if n > 15: return 3
    return 1


def main():
    lite = json.load(open(LITE, encoding="utf-8"))
    barrios = lite["barrios"]

    # Load all section polygons (prov 35 + 38) and index by cusec
    sec_index = {}
    for label, path in SECS_FILES.items():
        if not path.exists(): continue
        fc = json.load(open(path, encoding="utf-8"))
        for f in fc.get("features", []):
            cusec = f["properties"]["cusec"]
            geom = f.get("geometry")
            if not geom or geom["type"] != "Polygon":
                continue
            ring = geom["coordinates"][0]
            sec_index[cusec] = {
                "centroid": ring_centroid(ring),
                "bbox": ring_bbox(ring),
            }
    print(f"Indexed {len(sec_index)} sections")

    # Find -mun barrios with > 15 sections
    added = []
    for bid, b in list(barrios.items()):
        if not bid.endswith("-mun"):
            continue
        secs = b.get("sections") or b.get("secciones_origen") or []
        if len(secs) < 16:
            continue
        # Compute centroids for sections in this barrio
        pts = []
        keep_secs = []
        for c in secs:
            info = sec_index.get(c)
            if not info: continue
            pts.append(info["centroid"])
            keep_secs.append(c)
        if len(pts) < 16: continue
        k = _k_for(len(pts))
        labels = kmeans(pts, k)
        # Group sections per cluster
        clusters = defaultdict(list)
        for sec, lbl in zip(keep_secs, labels):
            clusters[lbl].append(sec)
        # Create sub-barrios
        for ci in sorted(clusters.keys()):
            sub_secs = clusters[ci]
            # Centroide cluster en lnglat
            sub_pts = [sec_index[c]["centroid"] for c in sub_secs]
            cx = sum(p[0] for p in sub_pts) / len(sub_pts)
            cy = sum(p[1] for p in sub_pts) / len(sub_pts)
            # Bbox unión
            xs = []; ys = []
            for c in sub_secs:
                bb = sec_index[c]["bbox"]
                xs += [bb[0], bb[2]]
                ys += [bb[1], bb[3]]
            bbox = [min(xs), min(ys), max(xs), max(ys)]
            sub_id = f"{bid.replace('-mun', '')}-z{ci+1}"
            sub_name = f"{b.get('name', bid)} · zona {ci+1}"
            barrios[sub_id] = {
                "id": sub_id,
                "name": sub_name,
                "mun": b.get("mun"),
                "mun_name": b.get("mun_name") or b.get("name"),
                "place_type": "sub_mun_sintetico",
                "centroide": [round(cx, 6), round(cy, 6)],
                "bbox": [round(v, 6) for v in bbox],
                "sections": sub_secs,
                "secciones_origen": sub_secs,
                "datos": {
                    "edificios": None,
                    "n_secciones": len(sub_secs),
                },
                "_parent_mun_barrio": bid,
            }
            added.append((sub_id, len(sub_secs)))
        print(f"  {bid} ({len(secs)} secs) → {k} sub-barrios")

    print(f"\nTotal sub-barrios añadidos: {len(added)}")

    # Re-write lite con _cusecIndex regenerado al boot por el cliente.
    # Backup
    bkp = LITE.with_suffix(".pre-split.json")
    if not bkp.exists():
        with open(bkp, "w", encoding="utf-8") as f:
            json.dump(lite, f, ensure_ascii=False, separators=(",", ":"))
        print(f"Backup pre-split → {bkp.name}")

    with open(LITE, "w", encoding="utf-8") as f:
        json.dump(lite, f, ensure_ascii=False, separators=(",", ":"))
    size_kb = LITE.stat().st_size / 1024
    print(f"\n→ {LITE.name}  {len(barrios)} barrios total · {size_kb:.0f} KB")


if __name__ == "__main__":
    main()
