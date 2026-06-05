#!/usr/bin/env python3
"""
Recupera 8 barrios reales del sur LPGC desde `barrios-gc.json` (curado
del 11-mayo) y los inserta en `barrios-canonical.json`. Después, ajusta
"Palmas de Gran Canaria, Las (otros)" eliminando las secciones que
ahora tienen su propio barrio. Si queda vacío, lo borra.

Barrios a recuperar: Jinámar, Hoya de la Plata, San Cristóbal, San Juan,
San José, Zárate, Pedro Hidalgo, Cono Sur.
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

BARRIOS_GC_VIEJO = f"{ROOT_ISO}/data/barrios-gc.json"
CANONICAL = f"{ROOT_ISO}/data/barrios-canonical.json"
SECCIONES_GEOJSON = f"{ROOT_ISO}/gc-secciones-lite.json"
RENTA_JSON = f"{ROOT_MAIN}/data/renta-seccion.json"
VV_GEOJSON = f"{ROOT_MAIN}/data/vv-prov35.geojson"
GUAGUAS_GEOJSON = f"{ROOT_MAIN}/data/guaguas-paradas.geojson"
EDU_GEOJSON = f"{ROOT_MAIN}/data/centros-educativos-prov35.geojson"
SECTIONS_PACK_DIR = f"{ROOT_ISO}/sections_pack"

LOG = f"{ROOT_ISO}/data/_recover_lpgc_sur.log"

BARRIOS_A_RECUPERAR = [
    "lpgc-jinamar",
    "lpgc-hoya-de-la-plata",
    "lpgc-san-cristobal",
    "lpgc-san-juan",
    "lpgc-san-jose",
    "lpgc-zarate",
    "lpgc-pedro-hidalgo",
    "lpgc-cono-sur",
]


def log(msg):
    line = f"[{time.strftime('%H:%M:%S')}] {msg}"
    print(line, flush=True)
    with open(LOG, "a") as f:
        f.write(line + "\n")


def main():
    open(LOG, "w").close()
    log("== recuperar 8 barrios sur LPGC desde curado viejo ==")

    with open(BARRIOS_GC_VIEJO) as f:
        viejo = json.load(f)
    with open(CANONICAL) as f:
        canon = json.load(f)
    log(f"barrios-gc.json viejo: {len(viejo.get('barrios', {}))} entradas")
    log(f"canonical actual: {canon['barrios_count']} barrios")

    # Cargar polígonos secciones
    with open(SECCIONES_GEOJSON) as f:
        secs_raw = json.load(f)
    feat_by_cusec = {f["properties"]["cusec"]: f for f in secs_raw["features"]}
    nmun_lpgc = next((f["properties"].get("nmun","") for f in secs_raw["features"]
                      if f["properties"]["mun"] == "016"), "Palmas de Gran Canaria, Las")

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

    cusecs_recuperados = set()
    n_added = 0
    for old_id in BARRIOS_A_RECUPERAR:
        b_old = viejo["barrios"].get(old_id)
        if not b_old:
            log(f"  ! {old_id}: no encontrado en barrios-gc.json viejo — skip")
            continue
        secs = b_old.get("sections", [])
        if not secs:
            log(f"  ! {old_id}: sin secciones — skip")
            continue

        polys = []
        for cusec in secs:
            f = feat_by_cusec.get(cusec)
            if not f:
                continue
            try:
                polys.append(shape(f["geometry"]).buffer(0))
            except Exception:
                pass
        if not polys:
            log(f"  ! {old_id}: sin polígonos válidos")
            continue
        u = unary_union(polys)
        centroid = u.centroid
        bbox = u.bounds

        # Agregados
        sum_buildings = sum_pois = 0
        area_ha = 0.0
        for cusec in secs:
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
        for cusec in secs:
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

        # ID canonical: "016-<slug-nombre>"
        # nombre viene del curado viejo
        nombre = b_old["name"]
        new_id = f"016-{unicodedata.normalize('NFKD', nombre).encode('ascii','ignore').decode().lower().replace(' ','-').replace(',','').strip('-')}"
        new_id = re.sub(r'-+', '-', new_id)

        # Skip si ya existe en canonical (no duplicar)
        if new_id in canon["barrios"]:
            log(f"  skip {new_id} (ya existe)")
            continue

        canon["barrios"][new_id] = {
            "id": new_id,
            "name": nombre,
            "place_type": "curated-recovered",
            "mun": "35016",
            "mun_name": nmun_lpgc,
            "centroide": [round(centroid.x, 6), round(centroid.y, 6)],
            "bbox": [round(x, 6) for x in bbox],
            "geometria": mapping(u),
            "datos": {
                "secciones_count":      len(secs),
                "edificios":            sum_buildings,
                "hogares":              hogares_total,
                "area_ha":              round(area_ha, 2),
                "renta_media_ponderada": renta_media,
                "vivienda_vacacional":  vv_count,
                "paradas_guaguas":      guaguas_count,
                "centros_educativos":   edu_count,
                "pois_total":           sum_pois,
            },
            "secciones_origen": secs,
            "recovered_from": old_id,
            "recovered_reason": "curado 11-mayo del sur LPGC, OSM no etiquetó estos barrios",
        }
        for c in secs:
            cusecs_recuperados.add(c)
        n_added += 1
        log(f"  + {new_id} · {nombre} · {len(secs)} secs · {sum_buildings} edif · renta={renta_media}")

    log(f"recuperados {n_added} barrios, {len(cusecs_recuperados)} cusecs movidos a barrios reales")

    # Ajustar "Palmas de Gran Canaria, Las (otros)"
    otros_id = "016-palmas-de-gran-canaria-las-otros"
    if otros_id in canon["barrios"]:
        otros = canon["barrios"][otros_id]
        remaining = [c for c in otros["secciones_origen"] if c not in cusecs_recuperados]
        log(f"'(otros)' antes: {len(otros['secciones_origen'])} secs, después: {len(remaining)}")
        if not remaining:
            del canon["barrios"][otros_id]
            log(f"  borrado '(otros)' (vacío)")
        else:
            # Recomputar agregaciones del "(otros)" con remaining
            polys = [shape(feat_by_cusec[c]["geometry"]).buffer(0) for c in remaining if c in feat_by_cusec]
            if polys:
                u = unary_union(polys)
                centroid = u.centroid
                bbox = u.bounds
                sum_buildings = sum_pois = 0
                area_ha = 0.0
                for cusec in remaining:
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
                for cusec in remaining:
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
                otros.update({
                    "centroide": [round(centroid.x, 6), round(centroid.y, 6)],
                    "bbox": [round(x, 6) for x in bbox],
                    "geometria": mapping(u),
                    "datos": {
                        "secciones_count":      len(remaining),
                        "edificios":            sum_buildings,
                        "hogares":              hogares_total,
                        "area_ha":              round(area_ha, 2),
                        "renta_media_ponderada": renta_media,
                        "vivienda_vacacional":  vv_count,
                        "paradas_guaguas":      guaguas_count,
                        "centros_educativos":   edu_count,
                        "pois_total":           sum_pois,
                    },
                    "secciones_origen": remaining,
                })
                log(f"  '(otros)' ajustado: {len(remaining)} secs, {sum_buildings} edif, renta={renta_media}")

    canon["barrios_count"] = len(canon["barrios"])
    canon["version"] = "v5-canonical-prov35-with-recovered-2026-05-13"
    canon["recovered_count"] = n_added
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
    log(f"== escrito {CANONICAL} ({size_mb:.2f} MB · {canon['barrios_count']} barrios) ==")


if __name__ == "__main__":
    main()
