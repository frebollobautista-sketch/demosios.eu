#!/usr/bin/env python3
"""
Precomputar `barrios-canonical.json`: unión geom + datos agregados por barrio.

Salida: una entrada por barrio LPGC con:
- geometria (unión de polígonos de sus secciones)
- centroide
- datos agregados (suma o media ponderada según métrica)
- secciones_origen para trazabilidad

Después de esto, la UI puede consumir el barrio como unidad canónica
sin tocar cusec.
"""
import json
import os
import time
from collections import defaultdict
from shapely.geometry import shape, Point, mapping
from shapely.ops import unary_union

ROOT_ISO = "/Users/panch/KOINOS-iso/public"
ROOT_MAIN = "/Users/panch/KOINOS/public"

BARRIOS_JSON = f"{ROOT_ISO}/data/barrios-gc.json"
SECCIONES_GEOJSON = f"{ROOT_ISO}/gc-secciones-lite.json"
RENTA_JSON = f"{ROOT_MAIN}/data/renta-seccion.json"
VV_GEOJSON = f"{ROOT_MAIN}/data/vv-prov35.geojson"
GUAGUAS_GEOJSON = f"{ROOT_MAIN}/data/guaguas-paradas.geojson"
EDU_GEOJSON = f"{ROOT_MAIN}/data/centros-educativos-prov35.geojson"
SECTIONS_PACK_DIR = f"{ROOT_ISO}/public/sections_pack" if False else f"{ROOT_ISO}/sections_pack"  # use ROOT_ISO

OUT = f"{ROOT_ISO}/data/barrios-canonical.json"
LOG = f"{ROOT_ISO}/data/_build_barrios_canonical.log"


def log(msg):
    line = f"[{time.strftime('%H:%M:%S')}] {msg}"
    print(line, flush=True)
    with open(LOG, "a") as f:
        f.write(line + "\n")


def main():
    open(LOG, "w").close()
    log("== precomputar barrios-canonical.json ==")

    # 1. Barrios curados
    with open(BARRIOS_JSON) as f:
        barrios_data = json.load(f)
    barrios = barrios_data["barrios"]
    log(f"barrios cargados: {len(barrios)}")

    # 2. Secciones-INE polygons (filtrar LPGC: cusec empieza por 35016)
    log("leyendo gc-secciones-lite.json ...")
    with open(SECCIONES_GEOJSON) as f:
        secs_raw = json.load(f)
    cusec_to_geom = {}
    cusec_to_centroid = {}
    for feat in secs_raw["features"]:
        cusec = feat["properties"]["cusec"]
        if not cusec.startswith("35016"):
            continue
        g = shape(feat["geometry"])
        cusec_to_geom[cusec] = g
        c = g.centroid
        cusec_to_centroid[cusec] = (c.x, c.y)
    log(f"secciones LPGC indexadas: {len(cusec_to_geom)}")

    # 3. Renta por sección {cusec: {renta, hogar}}
    log("leyendo renta-seccion.json ...")
    with open(RENTA_JSON) as f:
        renta = json.load(f)
    log(f"renta entries: {len(renta)}")

    # 4. Meta.json por sección (para building_count y area_ha)
    log("leyendo meta.json por cada cusec LPGC ...")
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
        except (FileNotFoundError, json.JSONDecodeError) as e:
            cusec_meta[cusec] = {"building_count": 0, "area_ha": 0.0, "poi_count": 0}
    log(f"metas leídos: {sum(1 for v in cusec_meta.values() if v['building_count']>0)} con building_count>0")

    # 5. VV points
    log("leyendo vv-prov35.geojson ...")
    with open(VV_GEOJSON) as f:
        vv = json.load(f)
    vv_points = [Point(f["geometry"]["coordinates"]) for f in vv["features"]
                 if f.get("geometry", {}).get("type") == "Point"]
    log(f"VV points: {len(vv_points)}")

    # 6. Guaguas paradas
    log("leyendo guaguas-paradas.geojson ...")
    with open(GUAGUAS_GEOJSON) as f:
        gg = json.load(f)
    guaguas_points = [Point(f["geometry"]["coordinates"]) for f in gg["features"]
                      if f.get("geometry", {}).get("type") == "Point"]
    log(f"guaguas paradas: {len(guaguas_points)}")

    # 7. Centros educativos
    log("leyendo centros-educativos-prov35.geojson ...")
    with open(EDU_GEOJSON) as f:
        edu = json.load(f)
    edu_points = [Point(f["geometry"]["coordinates"]) for f in edu["features"]
                  if f.get("geometry", {}).get("type") == "Point"]
    log(f"centros educativos: {len(edu_points)}")

    # 8. Por cada barrio agregar
    log("agregando por barrio ...")
    out = {}
    t0 = time.time()
    for i, (bid, b) in enumerate(barrios.items()):
        secs = b.get("sections", [])
        polys = [cusec_to_geom[c] for c in secs if c in cusec_to_geom]
        if not polys:
            log(f"  {bid}: 0 polígonos disponibles, skip")
            continue

        # Unión geométrica (puede tirar GEOSException en geom inválida → buffer 0 fix)
        try:
            u = unary_union([p.buffer(0) for p in polys])
        except Exception as e:
            log(f"  {bid}: error union: {e}")
            continue
        centroid = u.centroid
        bbox = u.bounds  # (minx, miny, maxx, maxy)

        # Métricas suma-ables
        sum_buildings = sum(cusec_meta.get(c, {}).get("building_count", 0) for c in secs)
        sum_pois      = sum(cusec_meta.get(c, {}).get("poi_count", 0) for c in secs)
        area_ha       = sum(cusec_meta.get(c, {}).get("area_ha", 0.0) for c in secs)

        # Renta: media ponderada por hogar
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

        # Point-in-polygon (preparar geom una vez)
        vv_count = sum(1 for p in vv_points if u.contains(p))
        guaguas_count = sum(1 for p in guaguas_points if u.contains(p))
        edu_count = sum(1 for p in edu_points if u.contains(p))

        out[bid] = {
            "id": bid,
            "name": b["name"],
            "mun": b["mun"],
            "mun_name": b.get("mun_name"),
            "distrito_hint": b.get("distrito_hint"),
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
            "agregacion_reglas": {
                "edificios":              "suma",
                "hogares":                "suma",
                "area_ha":                "suma",
                "renta_media_ponderada":  "media ponderada por hogares",
                "vivienda_vacacional":    "point-in-polygon (puntos dentro de la union geom)",
                "paradas_guaguas":        "point-in-polygon",
                "centros_educativos":     "point-in-polygon",
            }
        }
        elapsed = time.time() - t0
        log(f"  [{i+1}/{len(barrios)}] {b['name']} · {len(polys)} secs · {sum_buildings} edif · renta={renta_media} · VV={vv_count} · guaguas={guaguas_count} · edu={edu_count}")

    # 9. Manifest + escritura
    final = {
        "version": "v1-canonical-lpgc-2026-05-13",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "scope": "LPGC (35016) — 34 barrios canónicos con datos agregados",
        "barrios_count": len(out),
        "totales": {
            "edificios_lpgc":          sum(o["datos"]["edificios"] for o in out.values()),
            "hogares_lpgc":            sum(o["datos"]["hogares"] for o in out.values()),
            "vivienda_vacacional_lpgc":sum(o["datos"]["vivienda_vacacional"] for o in out.values()),
            "paradas_guaguas_lpgc":    sum(o["datos"]["paradas_guaguas"] for o in out.values()),
            "centros_educativos_lpgc": sum(o["datos"]["centros_educativos"] for o in out.values()),
        },
        "barrios": out,
    }
    with open(OUT, "w") as f:
        json.dump(final, f, ensure_ascii=False)
    size_mb = os.path.getsize(OUT) / 1024 / 1024
    log(f"escrito {OUT} ({size_mb:.2f} MB)")
    log(f"== terminado · {len(out)} barrios agregados ==")


if __name__ == "__main__":
    main()
