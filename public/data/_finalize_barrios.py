#!/usr/bin/env python3
"""
Limpia barrios-canarias-seed.json y re-agrega canónico para toda prov 35.

Pasos:
1. Filtra barrios-seed según criterios (drop locality, drop hamlet/neighbourhood con 1 sec).
2. Escribe barrios-canarias-final.json.
3. Re-calcula barrios-canonical.json con TODOS los muns prov 35.
"""
import json
import os
import time
from collections import defaultdict
from shapely.geometry import shape, Point, mapping
from shapely.ops import unary_union

ROOT_ISO = "/Users/panch/KOINOS-iso/public"
ROOT_MAIN = "/Users/panch/KOINOS/public"

SEED = f"{ROOT_ISO}/data/barrios-canarias-seed.json"
FINAL = f"{ROOT_ISO}/data/barrios-canarias-final.json"
CANONICAL = f"{ROOT_ISO}/data/barrios-canonical.json"
LOG = f"{ROOT_ISO}/data/_finalize_barrios.log"

SECCIONES_GEOJSON = f"{ROOT_ISO}/canarias-secciones-lite.json"
RENTA_JSON = f"{ROOT_MAIN}/data/renta-seccion.json"
VV_GEOJSON = f"{ROOT_MAIN}/data/vv-prov35.geojson"
GUAGUAS_GEOJSON = f"{ROOT_MAIN}/data/guaguas-paradas.geojson"
EDU_GEOJSON = f"{ROOT_MAIN}/data/centros-educativos-prov35.geojson"
SECTIONS_PACK_DIR = f"{ROOT_ISO}/sections_pack"


def log(msg):
    line = f"[{time.strftime('%H:%M:%S')}] {msg}"
    print(line, flush=True)
    with open(LOG, "a") as f:
        f.write(line + "\n")


def filter_seed():
    log("== fase 1: filtrar barrios-seed ==")
    with open(SEED) as f:
        data = json.load(f)
    barrios = data["barrios"]
    log(f"seed barrios: {len(barrios)}")

    kept = {}
    dropped = defaultdict(int)
    for bid, b in barrios.items():
        place_type = b.get("place_type")
        sec_count = len(b.get("sections", []))
        if place_type == "locality":
            dropped["locality"] += 1
            continue
        if place_type == "hamlet" and sec_count <= 1:
            dropped["hamlet-1sec"] += 1
            continue
        if place_type == "neighbourhood" and sec_count <= 1:
            dropped["neighbourhood-1sec"] += 1
            continue
        kept[bid] = b
    log(f"barrios mantenidos: {len(kept)}")
    log(f"descartados por filtros: {dict(dropped)}")

    by_mun = defaultdict(int)
    for b in kept.values():
        by_mun[b["mun"]] += 1
    log(f"final por mun ({len(by_mun)} muns):")
    for mun, n in sorted(by_mun.items(), key=lambda x: -x[1])[:15]:
        log(f"  {mun}: {n}")

    out = {
        "version": "v1-final-canarias-2026-05-13",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": "OSM place=* filtered (drop locality, drop hamlet/neighbourhood con 1 sec)",
        "barrios_count": len(kept),
        "barrios": kept,
    }
    with open(FINAL, "w") as f:
        json.dump(out, f, ensure_ascii=False)
    log(f"escrito {FINAL}")
    return kept


def aggregate_canonical(barrios_final):
    log("== fase 2: re-agregar canónico para todos los muns prov 35 ==")

    # Cargar polígonos de todas las secciones prov 35
    log("leyendo canarias-secciones-lite.json (toda prov 35) ...")
    with open(SECCIONES_GEOJSON) as f:
        secs_raw = json.load(f)
    cusec_to_geom = {}
    cusec_to_nmun = {}
    for feat in secs_raw["features"]:
        cusec = feat["properties"]["cusec"]
        if not (cusec.startswith("35") or cusec.startswith("38")):
            continue
        g = shape(feat["geometry"])
        cusec_to_geom[cusec] = g
        cusec_to_nmun[cusec] = feat["properties"].get("nmun", "")
    log(f"secciones Canarias indexadas: {len(cusec_to_geom)}")

    # Renta
    with open(RENTA_JSON) as f:
        renta = json.load(f)
    log(f"renta entries: {len(renta)}")

    # Meta.json por sección
    log("leyendo meta.json por cusec ...")
    cusec_meta = {}
    for cusec in cusec_to_geom:
        meta_path = f"{SECTIONS_PACK_DIR}/{cusec}/meta.json"
        try:
            with open(meta_path) as f:
                m = json.load(f)
            cusec_meta[cusec] = {
                "building_count": m.get("building_count", 0),
                "area_ha":        m.get("area_ha", 0.0),
                "poi_count":      m.get("poi_count", 0),
            }
        except Exception:
            cusec_meta[cusec] = {"building_count": 0, "area_ha": 0.0, "poi_count": 0}
    metas_ok = sum(1 for v in cusec_meta.values() if v['building_count']>0)
    log(f"metas con building_count>0: {metas_ok}/{len(cusec_to_geom)}")

    # VV / guaguas / edu points
    with open(VV_GEOJSON) as f:
        vv = json.load(f)
    vv_points = [Point(f["geometry"]["coordinates"]) for f in vv["features"]
                 if f.get("geometry", {}).get("type") == "Point"]
    log(f"VV points: {len(vv_points)}")

    with open(GUAGUAS_GEOJSON) as f:
        gg = json.load(f)
    guaguas_points = [Point(f["geometry"]["coordinates"]) for f in gg["features"]
                      if f.get("geometry", {}).get("type") == "Point"]
    log(f"guaguas paradas: {len(guaguas_points)}")

    with open(EDU_GEOJSON) as f:
        edu = json.load(f)
    edu_points = [Point(f["geometry"]["coordinates"]) for f in edu["features"]
                  if f.get("geometry", {}).get("type") == "Point"]
    log(f"centros educativos: {len(edu_points)}")

    # Agregar
    log(f"agregando {len(barrios_final)} barrios ...")
    out = {}
    t0 = time.time()
    for i, (bid, b) in enumerate(barrios_final.items()):
        secs = b.get("sections", [])
        polys = [cusec_to_geom[c] for c in secs if c in cusec_to_geom]
        if not polys:
            continue
        try:
            u = unary_union([p.buffer(0) for p in polys])
        except Exception:
            continue
        centroid = u.centroid
        bbox = u.bounds

        sum_buildings = sum(cusec_meta.get(c, {}).get("building_count", 0) for c in secs)
        sum_pois      = sum(cusec_meta.get(c, {}).get("poi_count", 0) for c in secs)
        area_ha       = sum(cusec_meta.get(c, {}).get("area_ha", 0.0) for c in secs)

        renta_num, renta_den = 0.0, 0
        hogares_total = 0
        for c in secs:
            r = renta.get(c)
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

        out[bid] = {
            "id": bid,
            "name": b["name"],
            "place_type": b.get("place_type"),
            "mun": b["mun"],
            "mun_name": b.get("mun_name"),
            "centroide": [round(centroid.x, 6), round(centroid.y, 6)],
            "bbox": [round(x, 6) for x in bbox],
            "geometria": mapping(u),
            "datos": {
                "secciones_count":      len(polys),
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
        }
        if (i+1) % 50 == 0:
            elapsed = time.time() - t0
            log(f"  [{i+1}/{len(barrios_final)}] · {elapsed:.0f}s")

    final = {
        "version": "v2-canonical-prov35-2026-05-13",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "scope": "Provincia 35 — barrios OSM filtrados, datos agregados",
        "source": "OSM place=* + INE secciones + Catastro INSPIRE + datos.canarias.es",
        "barrios_count": len(out),
        "totales": {
            "edificios":          sum(o["datos"]["edificios"] for o in out.values()),
            "hogares":            sum(o["datos"]["hogares"] for o in out.values()),
            "vivienda_vacacional":sum(o["datos"]["vivienda_vacacional"] for o in out.values()),
            "paradas_guaguas":    sum(o["datos"]["paradas_guaguas"] for o in out.values()),
            "centros_educativos": sum(o["datos"]["centros_educativos"] for o in out.values()),
        },
        "agregacion_reglas": {
            "edificios":              "suma de building_count de meta.json por sección",
            "hogares":                "suma de hogar de renta-seccion.json",
            "area_ha":                "suma",
            "renta_media_ponderada":  "media renta ponderada por hogares",
            "vivienda_vacacional":    "point-in-polygon sobre union geom",
            "paradas_guaguas":        "point-in-polygon",
            "centros_educativos":     "point-in-polygon",
        },
        "barrios": out,
    }
    with open(CANONICAL, "w") as f:
        json.dump(final, f, ensure_ascii=False)
    size_mb = os.path.getsize(CANONICAL) / 1024 / 1024
    log(f"escrito {CANONICAL} ({size_mb:.2f} MB · {len(out)} barrios)")


def main():
    open(LOG, "w").close()
    log("== finalize + re-agregar canónico ==")
    t0 = time.time()
    kept = filter_seed()
    aggregate_canonical(kept)
    log(f"== fin · total {time.time()-t0:.1f}s ==")


if __name__ == "__main__":
    main()
