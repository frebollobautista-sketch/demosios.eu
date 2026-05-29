#!/usr/bin/env python3
"""Extrae las 672 secciones de prov 38 (Tenerife, La Palma, La Gomera, El Hierro)
desde SECC_CE_ES-CN_20190101.json y las escribe en formato compatible con
gc-secciones-lite.json (lowercase fields: cusec, mun, dis, sec, nmun).
Salida: public/prov38-secciones-lite.json"""
import json, os, sys, time

SRC = "/Users/panch/KOINOS/spain-datasets/data/census/SECC_CE_ES-CN_20190101.json"
OUT = "/Users/panch/KOINOS-iso/public/prov38-secciones-lite.json"

def main():
    t0 = time.time()
    print(f"leyendo {SRC} ...")
    with open(SRC) as f:
        d = json.load(f)
    feats_out = []
    for f in d["features"]:
        p = f["properties"]
        cusec = p.get("CUSEC", "")
        if not cusec.startswith("38"):
            continue
        # Simplificar polígono: redondear a 5 decimales (~1m precisión)
        geom = f["geometry"]
        def round_coords(c):
            if isinstance(c[0], (int, float)):
                return [round(c[0], 5), round(c[1], 5)]
            return [round_coords(x) for x in c]
        geom["coordinates"] = round_coords(geom["coordinates"])
        feats_out.append({
            "type": "Feature",
            "properties": {
                "cusec": cusec,
                "mun": p.get("CMUN", ""),
                "dis": p.get("CDIS", ""),
                "sec": p.get("CSEC", ""),
                "nmun": p.get("NMUN", ""),
            },
            "geometry": geom,
        })
    out = {"type": "FeatureCollection", "features": feats_out}
    with open(OUT, "w") as f:
        json.dump(out, f, ensure_ascii=False)
    sz = os.path.getsize(OUT) / 1024 / 1024
    print(f"escrito {OUT} ({sz:.2f} MB · {len(feats_out)} secciones · {time.time()-t0:.1f}s)")
    # Stats por isla (38 → muns)
    tf = {f"{i:03d}" for i in list(range(1,32))}  # Tenerife muns 38001-38031
    lp = {f"{i:03d}" for i in [10,11,12,13,14,15,16,17,18,19,20,21,22,23]}  # La Palma muns approx
    # Más exacto: La Palma muns son 38010-38023 (14), El Hierro 38001/38028/38055 (3), La Gomera 38005/...
    # Por simplicidad agrupar por nombre nmun
    by_mun = {}
    for f in feats_out:
        nm = f["properties"]["nmun"]
        by_mun[nm] = by_mun.get(nm, 0) + 1
    print(f"\nMuns prov 38 ({len(by_mun)} muns):")
    for k, v in sorted(by_mun.items(), key=lambda x: -x[1])[:15]:
        print(f"  {k}: {v} secs")
    print(f"  ... +{max(0, len(by_mun)-15)} más")

if __name__ == "__main__":
    main()
