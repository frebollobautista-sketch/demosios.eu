#!/usr/bin/env python3
"""Genera dos archivos para el nivel archipiélago:
  - canarias-islands-poly.json : 7 islas como polígonos (unión de muns por isla)
  - canarias-municipios-poly.json : todos los muns de Canarias con polígono"""
import json, os, time
from collections import defaultdict
from shapely.geometry import shape, mapping
from shapely.ops import unary_union

ROOT = "/Users/panch/KOINOS-iso/public"
SRC = f"{ROOT}/canarias-secciones-lite.json"
OUT_ISLAS = f"{ROOT}/canarias-islands-poly.json"
OUT_MUNS = f"{ROOT}/canarias-municipios-poly.json"

# Mapping mun (5 dig) → isla
PROV35_GC = {"35001","35002","35005","35006","35008","35009","35011","35012","35013","35016","35019","35020","35021","35022","35023","35025","35026","35027","35031","35032","35033"}
PROV35_LZ = {"35004","35010","35018","35024","35028","35029","35034"}
PROV35_FV = {"35003","35007","35014","35015","35017","35030"}
# 2026-05-20 — Mapping corregido tras descubrir que SECC_CE de 2019 usa
# códigos distintos a los que yo asumía. Discovery por bbox del primer
# sample de cada cumun.
PROV38_TF = {"38001","38004","38005","38006","38010","38011","38012","38015","38017","38018","38019","38020","38022","38023","38025","38026","38028","38031","38032","38034","38035","38038","38039","38040","38041","38042","38043","38044","38046","38051","38052"}
PROV38_LP = {"38007","38008","38009","38014","38016","38024","38027","38029","38030","38033","38037","38045","38047","38053"}
PROV38_LG = {"38002","38003","38021","38036","38049","38050"}
PROV38_EH = {"38013","38048","38901"}

ISLA_OF = {}
for m in PROV35_GC: ISLA_OF[m]="gc"
for m in PROV35_LZ: ISLA_OF[m]="lz"
for m in PROV35_FV: ISLA_OF[m]="fv"
for m in PROV38_TF: ISLA_OF[m]="tf"
for m in PROV38_LP: ISLA_OF[m]="lp"
for m in PROV38_LG: ISLA_OF[m]="lg"
for m in PROV38_EH: ISLA_OF[m]="eh"

ISLA_NAMES = {"gc":"Gran Canaria","lz":"Lanzarote","fv":"Fuerteventura",
              "tf":"Tenerife","lp":"La Palma","lg":"La Gomera","eh":"El Hierro"}

def main():
    t0 = time.time()
    print(f"leyendo {SRC} ...")
    with open(SRC) as f:
        d = json.load(f)
    print(f"  features: {len(d['features'])}")

    # Agrupar geoms por mun
    mun_geoms = defaultdict(list)
    mun_nmun = {}
    mun_isla = {}
    mun_sec_count = defaultdict(int)
    for feat in d["features"]:
        p = feat["properties"]
        cusec = p.get("cusec","")
        mun5 = cusec[:5]
        if mun5 not in ISLA_OF:
            continue
        try:
            g = shape(feat["geometry"]).buffer(0)
            mun_geoms[mun5].append(g)
            mun_nmun[mun5] = p.get("nmun","")
            mun_isla[mun5] = ISLA_OF[mun5]
            mun_sec_count[mun5] += 1
        except Exception:
            pass

    # Build muns file
    muns_feats = []
    isla_geoms = defaultdict(list)
    for mun5, geoms in mun_geoms.items():
        try:
            u = unary_union(geoms).buffer(0)
            # 2026-05-20 — Smooth jigsaw: buffer-out + buffer-in elimina
            # pinchos del unioning de secciones, y un simplify suave deja
            # contornos limpios sin perder la silueta.
            u_smooth = u.buffer(0.0008).buffer(-0.0008).buffer(0)
            us = u_smooth.simplify(0.0005, preserve_topology=True)
            geom_out = mapping(us)
            c = us.centroid
            muns_feats.append({
                "type":"Feature",
                "properties": {
                    "mun": mun5[2:],          # 3 dig sin prefix
                    "cumun": mun5,            # 5 dig
                    "nmun": mun_nmun[mun5],
                    "isla": mun_isla[mun5],
                    "sections_count": mun_sec_count[mun5],
                    "centroid_lnglat": [round(c.x,5), round(c.y,5)],
                },
                "geometry": geom_out,
            })
            # acumular para islas
            isla_geoms[mun_isla[mun5]].append(u)
        except Exception as e:
            print(f"  warn {mun5}: {e}")

    # Sort by isla, mun
    muns_feats.sort(key=lambda f: (f["properties"]["isla"], f["properties"]["mun"]))
    out_muns = {"type":"FeatureCollection","features":muns_feats}
    with open(OUT_MUNS,"w") as f:
        json.dump(out_muns, f, ensure_ascii=False)
    sz1 = os.path.getsize(OUT_MUNS)/1024/1024
    print(f"escrito {OUT_MUNS} ({sz1:.2f} MB · {len(muns_feats)} muns)")

    # Build islas file
    islas_feats = []
    for isla_id, geoms in isla_geoms.items():
        u = unary_union(geoms).buffer(0)
        # Smooth jigsaw a nivel isla (buffers más grandes que muns).
        u_smooth = u.buffer(0.002).buffer(-0.002).buffer(0)
        us = u_smooth.simplify(0.0015, preserve_topology=True)
        c = us.centroid
        bb = us.bounds
        islas_feats.append({
            "type":"Feature",
            "properties":{
                "isla": isla_id,
                "name": ISLA_NAMES[isla_id],
                "muns_count": sum(1 for m in mun_isla.values() if m == isla_id),
                "sections_count": sum(mun_sec_count[m] for m in mun_isla if mun_isla[m]==isla_id),
                "centroid_lnglat": [round(c.x,5), round(c.y,5)],
                "bbox_lnglat": [round(x,5) for x in bb],
            },
            "geometry": mapping(us),
        })
    # Ordenar por nombre canónico
    islas_feats.sort(key=lambda f: ["tf","gc","lz","fv","lp","lg","eh"].index(f["properties"]["isla"]))
    out_islas = {"type":"FeatureCollection","features":islas_feats}
    with open(OUT_ISLAS,"w") as f:
        json.dump(out_islas, f, ensure_ascii=False)
    sz2 = os.path.getsize(OUT_ISLAS)/1024/1024
    print(f"escrito {OUT_ISLAS} ({sz2:.2f} MB · {len(islas_feats)} islas)")
    print(f"\ntotal {time.time()-t0:.1f}s")
    print("\nResumen por isla:")
    for f in islas_feats:
        p = f["properties"]
        print(f"  {p['isla']} ({p['name']}): {p['muns_count']} muns · {p['sections_count']} secs")

if __name__ == "__main__":
    main()
