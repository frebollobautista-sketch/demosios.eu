"""KOINOS · POLIS — Validación automática de data packs (v1.4).

Para cada pack en ``public/sections_pack/<cusec>/`` comprueba:

1. Área de ``section.geojson`` (anillo en metros locales ENU) vs el
   ``area_ha`` declarado en ``meta.json``. Tolerancia ±2%.
2. Centroide del polígono de la sección cae dentro del propio polígono
   (sanity de validez topológica).
3. bbox del polígono cuadra con el bbox derivado de los building
   footprints. Tolerancia ±30% (los buildings rara vez ocupan toda la
   sección, pero deben estar contenidos).
4. ``meta.building_count`` == nº features en ``buildings.geojson``.
5. ``manzana_count`` (o nº manzanas en ``manzanas.geojson``) coincide
   con la cifra reportada en el manifest si existe.

Salidas:
    public/sections_pack/validation_report.json
    public/sections_pack/validation_report.csv

Uso:
    python3 scripts/validate_packs.py
    python3 scripts/validate_packs.py --pack-dir public/sections_pack
"""
from __future__ import annotations
import argparse
import csv
import json
import pathlib
import sys
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
DEFAULT_PACK_DIR = ROOT / "public" / "sections_pack"

AREA_TOL_PCT = 2.0       # % tolerable entre meta.area_ha y geometría medida
BBOX_TOL_PCT = 30.0      # % tolerable entre bbox sección y bbox edificios


def shoelace_area(ring):
    """Área en m² de un anillo cerrado en coordenadas planas."""
    n = len(ring)
    if n < 3:
        return 0.0
    s = 0.0
    for i in range(n):
        x1, y1 = ring[i][0], ring[i][1]
        x2, y2 = ring[(i + 1) % n][0], ring[(i + 1) % n][1]
        s += (x1 * y2 - x2 * y1)
    return abs(s) / 2.0


def ring_centroid(ring):
    if not ring:
        return (0.0, 0.0)
    sx = sum(p[0] for p in ring) / len(ring)
    sy = sum(p[1] for p in ring) / len(ring)
    return (sx, sy)


def ring_bbox(ring):
    if not ring:
        return (0, 0, 0, 0)
    xs = [p[0] for p in ring]
    ys = [p[1] for p in ring]
    return (min(xs), min(ys), max(xs), max(ys))


def point_in_ring(px, py, ring):
    """Ray-cast clásico."""
    n = len(ring)
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > py) != (yj > py) and \
           px < (xj - xi) * (py - yi) / (yj - yi + 1e-12) + xi:
            inside = not inside
        j = i
    return inside


def find_local_section_ring(section_gj):
    """Devuelve el anillo de la sección en metros locales ENU."""
    feats = section_gj.get("features", [])
    for f in feats:
        if f.get("properties", {}).get("coords_system") == "local_m_enu":
            coords = f["geometry"]["coordinates"]
            return [list(c) for c in coords[0]]
    # Fallback: la última feature (orden histórico).
    if feats:
        coords = feats[-1]["geometry"]["coordinates"]
        return [list(c) for c in coords[0]]
    return None


def collect_building_bbox(buildings_gj):
    feats = buildings_gj.get("features", [])
    if not feats:
        return None
    minx = miny = float("inf")
    maxx = maxy = float("-inf")
    for f in feats:
        g = f.get("geometry") or {}
        if g.get("type") != "Polygon":
            continue
        for ring in g.get("coordinates", []):
            for p in ring:
                if p[0] < minx: minx = p[0]
                if p[1] < miny: miny = p[1]
                if p[0] > maxx: maxx = p[0]
                if p[1] > maxy: maxy = p[1]
    if minx == float("inf"):
        return None
    return (minx, miny, maxx, maxy)


def bbox_overlap_pct(b1, b2):
    """Devuelve la diferencia relativa máxima en cualquiera de las
    dimensiones (0% = idénticos, 100% = sin overlap). Asume bboxes
    válidas en el mismo sistema de coordenadas."""
    if b1 is None or b2 is None:
        return None
    w1 = max(b1[2] - b1[0], 1e-6)
    h1 = max(b1[3] - b1[1], 1e-6)
    w2 = max(b2[2] - b2[0], 1e-6)
    h2 = max(b2[3] - b2[1], 1e-6)
    dw = abs(w1 - w2) / max(w1, w2) * 100.0
    dh = abs(h1 - h2) / max(h1, h2) * 100.0
    return max(dw, dh)


def validate_pack(pack_dir: pathlib.Path):
    """Devuelve (passed: bool, reasons: list[str], stats: dict)."""
    cusec = pack_dir.name
    reasons = []
    stats = {"cusec": cusec}

    # 1) meta.json
    meta_path = pack_dir / "meta.json"
    if not meta_path.exists():
        return False, ["meta.json no existe"], stats
    try:
        meta = json.load(open(meta_path, encoding="utf-8"))
    except Exception as e:
        return False, [f"meta.json corrupto: {e}"], stats

    # 2) section.geojson
    section_path = pack_dir / "section.geojson"
    if not section_path.exists():
        return False, ["section.geojson no existe"], stats
    section_gj = json.load(open(section_path, encoding="utf-8"))
    local_ring = find_local_section_ring(section_gj)
    if not local_ring:
        return False, ["section.geojson sin anillo local"], stats

    # Check 1: área
    declared_ha = meta.get("area_ha", 0)
    measured_m2 = shoelace_area(local_ring)
    measured_ha = measured_m2 / 10000.0
    diff_pct = abs(declared_ha - measured_ha) / max(declared_ha, 1e-6) * 100.0
    stats["area_meta_ha"] = round(declared_ha, 4)
    stats["area_geom_ha"] = round(measured_ha, 4)
    stats["area_diff_pct"] = round(diff_pct, 3)
    if diff_pct > AREA_TOL_PCT:
        reasons.append(f"area drift {diff_pct:.2f}% (>{AREA_TOL_PCT}%): "
                       f"meta={declared_ha:.2f} ha vs geom={measured_ha:.2f} ha")

    # Check 2: centroide dentro del polígono (sanity topológica)
    cx, cy = ring_centroid(local_ring)
    if not point_in_ring(cx, cy, local_ring):
        reasons.append("centroide fuera del polígono (no convexo o "
                       "topología degradada)")
        stats["centroid_in_poly"] = False
    else:
        stats["centroid_in_poly"] = True

    # Check 3: bbox del polígono vs bbox de buildings
    buildings_path = pack_dir / "buildings.geojson"
    bld_count_geo = 0
    bld_bbox = None
    if buildings_path.exists():
        bgj = json.load(open(buildings_path, encoding="utf-8"))
        bld_count_geo = len(bgj.get("features", []))
        bld_bbox = collect_building_bbox(bgj)
    sec_bbox = ring_bbox(local_ring)
    stats["sec_bbox"] = [round(v, 1) for v in sec_bbox]
    if bld_bbox is not None:
        diff_bbox = bbox_overlap_pct(sec_bbox, bld_bbox)
        stats["bbox_diff_pct"] = round(diff_bbox, 1) if diff_bbox is not None else None
        # Edificios deben estar dentro del bbox de sección (con holgura).
        # Si la sección es mucho más grande que los buildings es OK.
        # Pero los buildings nunca deberían sobresalir más de un 30%.
        excess = max(
            (sec_bbox[0] - bld_bbox[0]) if bld_bbox[0] < sec_bbox[0] else 0,
            (sec_bbox[1] - bld_bbox[1]) if bld_bbox[1] < sec_bbox[1] else 0,
            (bld_bbox[2] - sec_bbox[2]) if bld_bbox[2] > sec_bbox[2] else 0,
            (bld_bbox[3] - sec_bbox[3]) if bld_bbox[3] > sec_bbox[3] else 0,
        )
        sec_w = max(sec_bbox[2] - sec_bbox[0], 1e-6)
        sec_h = max(sec_bbox[3] - sec_bbox[1], 1e-6)
        excess_pct = excess / max(sec_w, sec_h) * 100.0
        stats["bld_outside_pct"] = round(excess_pct, 1)
        if excess_pct > BBOX_TOL_PCT:
            reasons.append(f"bbox edificios sobresale {excess_pct:.1f}% del "
                           f"bbox sección (>{BBOX_TOL_PCT}%)")
    else:
        stats["bbox_diff_pct"] = None
        stats["bld_outside_pct"] = None

    # Check 4: building_count meta vs nº features
    declared_bld = meta.get("building_count", 0)
    stats["bld_count_meta"] = declared_bld
    stats["bld_count_geo"] = bld_count_geo
    if declared_bld != bld_count_geo:
        reasons.append(f"building_count mismatch: meta={declared_bld} "
                       f"vs geojson={bld_count_geo}")

    # Check 5: manzana_count (no siempre presente en meta antiguos).
    mz_count_geo = 0
    mz_path = pack_dir / "manzanas.geojson"
    if mz_path.exists():
        mgj = json.load(open(mz_path, encoding="utf-8"))
        mz_count_geo = len(mgj.get("features", []))
    declared_mz = meta.get("manzana_count")
    stats["mz_count_geo"] = mz_count_geo
    stats["mz_count_meta"] = declared_mz
    if declared_mz is not None and declared_mz != mz_count_geo:
        reasons.append(f"manzana_count mismatch: meta={declared_mz} "
                       f"vs geojson={mz_count_geo}")

    return (len(reasons) == 0), reasons, stats


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pack-dir", default=str(DEFAULT_PACK_DIR))
    ap.add_argument("--limit", type=int, default=None,
                    help="Validar solo las primeras N (debug)")
    args = ap.parse_args()

    pack_root = pathlib.Path(args.pack_dir)
    if not pack_root.is_absolute():
        pack_root = ROOT / pack_root

    pack_dirs = sorted([p for p in pack_root.iterdir()
                        if p.is_dir() and p.name.isdigit() and len(p.name) == 10])
    if args.limit:
        pack_dirs = pack_dirs[:args.limit]

    print(f"Validando {len(pack_dirs)} packs en {pack_root}…")
    results = []
    failures = []
    passed = 0
    for i, pd in enumerate(pack_dirs, 1):
        try:
            ok, reasons, stats = validate_pack(pd)
        except Exception as e:
            ok = False
            reasons = [f"excepción {type(e).__name__}: {e}"]
            stats = {"cusec": pd.name}
        stats["passed"] = ok
        stats["reasons"] = reasons
        results.append(stats)
        if ok:
            passed += 1
        else:
            failures.append({"cusec": pd.name, "reasons": reasons,
                             "stats": stats})
        if i % 100 == 0 or i == len(pack_dirs):
            print(f"  · {i}/{len(pack_dirs)} ({passed} OK)")

    # Resumen JSON
    summary = {
        "version": "1.0",
        "produced_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "total_packs": len(pack_dirs),
        "total_passed": passed,
        "total_failed": len(failures),
        "tolerances": {
            "area_pct": AREA_TOL_PCT,
            "bbox_pct": BBOX_TOL_PCT,
        },
        "failures": failures,
    }
    out_json = pack_root / "validation_report.json"
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    print(f"\nresumen → {out_json}")

    # CSV plano (un row por pack) para abrir en Excel/Numbers
    out_csv = pack_root / "validation_report.csv"
    fields = ["cusec", "passed", "area_meta_ha", "area_geom_ha",
              "area_diff_pct", "centroid_in_poly", "bbox_diff_pct",
              "bld_outside_pct", "bld_count_meta", "bld_count_geo",
              "mz_count_geo", "mz_count_meta", "reasons"]
    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for r in results:
            row = {k: r.get(k, "") for k in fields if k != "reasons"}
            row["reasons"] = " | ".join(r.get("reasons", []))
            w.writerow(row)
    print(f"csv     → {out_csv}")

    print(f"\nVALIDACIÓN FINAL  ·  {passed}/{len(pack_dirs)} OK  ·  "
          f"{len(failures)} fallos")
    # Top razones de fallo (resumen rápido)
    from collections import Counter
    cnt = Counter()
    for f in failures:
        for r in f["reasons"]:
            head = r.split(":")[0]
            cnt[head] += 1
    if cnt:
        print("Razones más comunes:")
        for k, n in cnt.most_common(8):
            print(f"  · {n:>4d}  {k}")


if __name__ == "__main__":
    main()
