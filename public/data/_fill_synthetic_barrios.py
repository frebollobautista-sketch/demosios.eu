#!/usr/bin/env python3
"""
Rellena `barrios-canonical.json` con barrios sintéticos para muns que
no tienen barrios OSM (rurales). Cada mun sin barrios → 1 barrio sintético
con name = mun_name, sections = todas las secciones del mun.

Esto elimina los huecos blancos en muns rurales (Tejeda, Artenara,
Vega de San Mateo, etc.) y deja la prov 35 totalmente cubierta por
piezas-barrio.
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

LOG = f"{ROOT_ISO}/data/_fill_synthetic_barrios.log"


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
    log("== rellenar barrios-canonical con sintéticos para muns sin barrios ==")

    # 1. Canonical actual
    with open(CANONICAL) as f:
        canon = json.load(f)
    log(f"canonical actual: {canon['barrios_count']} barrios")

    # 2. Indexar muns ya con barrios (basado en mun field "35016" forma 5 dig)
    muns_with_barrios = set()
    sections_owned = set()
    for bid, b in canon["barrios"].items():
        muns_with_barrios.add(b["mun"])
        for sec in b.get("secciones_origen", []):
            sections_owned.add(sec)
    log(f"muns con al menos 1 barrio: {len(muns_with_barrios)}")
    log(f"secciones owned por algún barrio: {len(sections_owned)}")

    # 3. Cargar secciones prov 35
    log("leyendo canarias-secciones-lite.json ...")
    with open(SECCIONES_GEOJSON) as f:
        secs_raw = json.load(f)
    # mun → [(cusec, feature)]
    by_mun = defaultdict(list)
    nmun_by_mun = {}
    for feat in secs_raw["features"]:
        cusec = feat["properties"]["cusec"]
        mun_short = feat["properties"]["mun"]  # 3 dig "016"
        prov = cusec[:2]  # "35" o "38"
        mun_long = prov + mun_short  # cusec prefix correcto
        nmun = feat["properties"].get("nmun", "")
        by_mun[mun_long].append((cusec, feat))
        nmun_by_mun[mun_long] = nmun

    log(f"muns en gc-secciones-lite: {len(by_mun)}")

    # 4. Identificar muns sin barrios (rurales)
    muns_sin_barrios = sorted(set(by_mun.keys()) - muns_with_barrios)
    log(f"muns SIN ningún barrio canonical: {len(muns_sin_barrios)}")
    for m in muns_sin_barrios:
        log(f"  {m} ({nmun_by_mun[m]}): {len(by_mun[m])} secciones")

    if not muns_sin_barrios:
        log("nada que rellenar.")
        return

    # 5. Cargar datos para agregación
    log("cargando datos para agregación ...")
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
    log(f"VV={len(vv_points)} guaguas={len(guaguas_points)} edu={len(edu_points)}")

    # 6. Crear barrios sintéticos
    log("creando barrios sintéticos ...")
    n_added = 0
    for mun in muns_sin_barrios:
        secs = by_mun[mun]
        secciones = [c for c, _ in secs]
        polys = []
        for cusec, feat in secs:
            try:
                g = shape(feat["geometry"]).buffer(0)
                polys.append(g)
            except Exception:
                pass
        if not polys:
            continue
        u = unary_union(polys)
        centroid = u.centroid
        bbox = u.bounds

        # Meta.json sum
        sum_buildings = 0
        sum_pois = 0
        area_ha = 0.0
        for cusec, _ in secs:
            meta_path = f"{SECTIONS_PACK_DIR}/{cusec}/meta.json"
            try:
                with open(meta_path) as f:
                    m = json.load(f)
                sum_buildings += m.get("building_count", 0)
                sum_pois += m.get("poi_count", 0)
                area_ha += m.get("area_ha", 0.0)
            except Exception:
                pass

        # Renta ponderada por hogar
        renta_num, renta_den, hogares_total = 0.0, 0, 0
        for cusec, _ in secs:
            r = renta.get(cusec)
            if r:
                hog = r.get("hogar", 0)
                rta = r.get("renta", 0)
                if hog > 0 and rta > 0:
                    renta_num += rta * hog
                    renta_den += hog
                hogares_total += hog
        renta_media = round(renta_num / renta_den, 1) if renta_den > 0 else None

        # Point-in-polygon
        vv_count = sum(1 for p in vv_points if u.contains(p))
        guaguas_count = sum(1 for p in guaguas_points if u.contains(p))
        edu_count = sum(1 for p in edu_points if u.contains(p))

        nmun = nmun_by_mun[mun]
        mun_short = mun[2:]  # quitar "35"
        bid = f"{mun_short}-{slug(nmun)}-mun"

        canon["barrios"][bid] = {
            "id": bid,
            "name": nmun,
            "place_type": "synthetic-mun",
            "mun": mun,
            "mun_name": nmun,
            "centroide": [round(centroid.x, 6), round(centroid.y, 6)],
            "bbox": [round(x, 6) for x in bbox],
            "geometria": mapping(u),
            "datos": {
                "secciones_count":      len(secciones),
                "edificios":            sum_buildings,
                "hogares":              hogares_total,
                "area_ha":              round(area_ha, 2),
                "renta_media_ponderada": renta_media,
                "vivienda_vacacional":  vv_count,
                "paradas_guaguas":      guaguas_count,
                "centros_educativos":   edu_count,
                "pois_total":           sum_pois,
            },
            "secciones_origen": secciones,
            "synthetic": True,
            "synthetic_reason": "mun sin barrios OSM canonical — fill por nombre municipio",
        }
        n_added += 1
        log(f"  + {bid} · {nmun} · {len(secciones)} secs · {sum_buildings} edif · renta={renta_media}")

    # 7. Update metadata
    canon["barrios_count"] = len(canon["barrios"])
    canon["version"] = "v3-canonical-prov35-with-synthetic-2026-05-13"
    canon["scope"] = "Provincia 35 — barrios OSM + sintéticos para muns rurales"
    canon["synthetic_count"] = n_added
    # Recalcular totales
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
    log(f"== escrito {CANONICAL} ({size_mb:.2f} MB · {canon['barrios_count']} barrios, {n_added} sintéticos) ==")


if __name__ == "__main__":
    main()
