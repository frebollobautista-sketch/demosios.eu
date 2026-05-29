#!/usr/bin/env python3
"""
Segunda pasada de relleno: para cada mun con secciones huérfanas
(no asignadas a ningún barrio OSM/sintético), crear un barrio
sintético adicional llamado "<mun_name> (otros)" que cubre esas
secciones huérfanas. Así no quedan huecos blancos en ningún mun.

Mantiene los barrios OSM y los sintéticos-mun previos intactos.
"""
import json
import os
import re
import time
import unicodedata
from collections import defaultdict
from shapely.geometry import shape, Point, mapping
from shapely.ops import unary_union

ROOT_ISO = "/Users/panch/KOINOS-iso/public"
ROOT_MAIN = "/Users/panch/KOINOS/public"

CANONICAL = f"{ROOT_ISO}/data/barrios-canonical.json"
SECCIONES_GEOJSON = f"{ROOT_ISO}/canarias-secciones-lite.json"
RENTA_JSON = f"{ROOT_MAIN}/data/renta-seccion.json"
VV_GEOJSON = f"{ROOT_MAIN}/data/vv-prov35.geojson"
GUAGUAS_GEOJSON = f"{ROOT_MAIN}/data/guaguas-paradas.geojson"
EDU_GEOJSON = f"{ROOT_MAIN}/data/centros-educativos-prov35.geojson"
SECTIONS_PACK_DIR = f"{ROOT_ISO}/sections_pack"

LOG = f"{ROOT_ISO}/data/_fill_orphan_sections.log"


def log(msg):
    line = f"[{time.strftime('%H:%M:%S')}] {msg}"
    print(line, flush=True)
    with open(LOG, "a") as f:
        f.write(line + "\n")


def slug(s):
    if not s:
        return ""
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return s


def main():
    open(LOG, "w").close()
    log("== rellenar secciones huérfanas con sintético '(otros)' por mun ==")

    with open(CANONICAL) as f:
        canon = json.load(f)
    log(f"canonical actual: {canon['barrios_count']} barrios")

    # Secciones owned
    owned = set()
    for b in canon["barrios"].values():
        for sec in b.get("secciones_origen", []):
            owned.add(sec)
    log(f"secciones owned: {len(owned)}")

    # Cargar secciones
    with open(SECCIONES_GEOJSON) as f:
        secs_raw = json.load(f)

    # Por mun: huérfanos
    orphan_by_mun = defaultdict(list)
    feat_by_cusec = {}
    nmun_by_mun = {}
    for feat in secs_raw["features"]:
        cusec = feat["properties"]["cusec"]
        mun_long = cusec[:5]  # 5-dig prefix correcto (35xxx o 38xxx)
        nmun_by_mun[mun_long] = feat["properties"].get("nmun", "")
        feat_by_cusec[cusec] = feat
        if cusec not in owned:
            orphan_by_mun[mun_long].append(cusec)
    log(f"muns con huérfanos: {len(orphan_by_mun)}")

    # Datos para agregación
    with open(RENTA_JSON) as f:
        renta = json.load(f)
    with open(VV_GEOJSON) as f:
        vv = json.load(f)
    vv_points = [Point(f["geometry"]["coordinates"]) for f in vv["features"]
                 if f.get("geometry", {}).get("type") == "Point"]
    with open(GUAGUAS_GEOJSON) as f:
        gg = json.load(f)
    guaguas_points = [Point(f["geometry"]["coordinates"]) for f in gg["features"]
                      if f.get("geometry", {}).get("type") == "Point"]
    with open(EDU_GEOJSON) as f:
        edu = json.load(f)
    edu_points = [Point(f["geometry"]["coordinates"]) for f in edu["features"]
                  if f.get("geometry", {}).get("type") == "Point"]

    n_added = 0
    for mun, orphans in orphan_by_mun.items():
        if not orphans:
            continue
        polys = []
        for cusec in orphans:
            f = feat_by_cusec.get(cusec)
            if not f:
                continue
            try:
                polys.append(shape(f["geometry"]).buffer(0))
            except Exception:
                pass
        if not polys:
            continue
        u = unary_union(polys)
        centroid = u.centroid
        bbox = u.bounds

        sum_buildings = 0
        sum_pois = 0
        area_ha = 0.0
        for cusec in orphans:
            meta_path = f"{SECTIONS_PACK_DIR}/{cusec}/meta.json"
            try:
                with open(meta_path) as f:
                    m = json.load(f)
                sum_buildings += m.get("building_count", 0)
                sum_pois += m.get("poi_count", 0)
                area_ha += m.get("area_ha", 0.0)
            except Exception:
                pass

        renta_num, renta_den, hogares_total = 0.0, 0, 0
        for cusec in orphans:
            r = renta.get(cusec)
            if r:
                hog = r.get("hogar", 0)
                rta = r.get("renta", 0)
                if hog > 0 and rta > 0:
                    renta_num += rta * hog
                    renta_den += hog
                hogares_total += hog
        renta_media = round(renta_num / renta_den, 1) if renta_den > 0 else None

        vv_count = sum(1 for p in vv_points if u.contains(p))
        guaguas_count = sum(1 for p in guaguas_points if u.contains(p))
        edu_count = sum(1 for p in edu_points if u.contains(p))

        nmun = nmun_by_mun[mun]
        mun_short = mun[2:]
        bid = f"{mun_short}-{slug(nmun)}-otros"

        # Si ya tiene un sintético-mun (mun rural sin OSM), entonces hubo
        # cero huérfanos restantes — saltar (no debería ocurrir, pero por
        # idempotencia).
        if bid in canon["barrios"]:
            log(f"  skip {bid} (ya existe)")
            continue

        canon["barrios"][bid] = {
            "id": bid,
            "name": f"{nmun} (otros)",
            "place_type": "synthetic-otros",
            "mun": mun,
            "mun_name": nmun,
            "centroide": [round(centroid.x, 6), round(centroid.y, 6)],
            "bbox": [round(x, 6) for x in bbox],
            "geometria": mapping(u),
            "datos": {
                "secciones_count":      len(orphans),
                "edificios":            sum_buildings,
                "hogares":              hogares_total,
                "area_ha":              round(area_ha, 2),
                "renta_media_ponderada": renta_media,
                "vivienda_vacacional":  vv_count,
                "paradas_guaguas":      guaguas_count,
                "centros_educativos":   edu_count,
                "pois_total":           sum_pois,
            },
            "secciones_origen": orphans,
            "synthetic": True,
            "synthetic_reason": "secciones del mun no cubiertas por barrios OSM — fill (otros)",
        }
        n_added += 1
        log(f"  + {bid} · {nmun} (otros) · {len(orphans)} secs · {sum_buildings} edif · renta={renta_media}")

    canon["barrios_count"] = len(canon["barrios"])
    canon["version"] = "v4-canonical-prov35-fully-covered-2026-05-13"
    canon["scope"] = "Provincia 35 — barrios OSM + sintéticos mun rurales + sintéticos (otros) para huérfanos. Cobertura 100%."
    canon["synthetic_otros_count"] = n_added
    canon["totales"] = {
        "edificios":          sum(o["datos"]["edificios"] for o in canon["barrios"].values()),
        "hogares":            sum(o["datos"]["hogares"] for o in canon["barrios"].values()),
        "vivienda_vacacional":sum(o["datos"]["vivienda_vacacional"] for o in canon["barrios"].values()),
        "paradas_guaguas":    sum(o["datos"]["paradas_guaguas"] for o in canon["barrios"].values()),
        "centros_educativos": sum(o["datos"]["centros_educativos"] for o in canon["barrios"].values()),
    }

    with open(CANONICAL, "w") as f:
        json.dump(canon, f, ensure_ascii=False)
    size_mb = os.path.getsize(CANONICAL) / 1024 / 1024
    log(f"== escrito {CANONICAL} ({size_mb:.2f} MB · {canon['barrios_count']} barrios, +{n_added} '(otros)') ==")


if __name__ == "__main__":
    main()
