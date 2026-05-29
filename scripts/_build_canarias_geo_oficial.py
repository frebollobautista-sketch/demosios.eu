#!/usr/bin/env python3
"""Regenera los polígonos de municipio e isla a partir de límites
administrativos OFICIALES (es-atlas, basado en IGN/INE), en lugar de
derivarlos de secciones censales simplificadas.

es-atlas/es/municipalities.json es un TopoJSON con los 8213 municipios
de España. Topología compartida => sin gaps/overlaps, bordes vecinos
exactos. `id` = código INE 5-díg (cumun); lo usamos para el match con
nuestro mapping isla y para conservar nmun/sections_count actuales.

Salida (mismo schema que consumía el runtime):
  - canarias-municipios-poly.json
  - canarias-islands-poly.json
"""
import json, os, time
from collections import defaultdict
from shapely.geometry import shape, mapping, Polygon, MultiPolygon
from shapely.ops import unary_union

ROOT = "/Users/panch/KOINOS-iso/public"
TOPO = "/tmp/es-municipalities.json"
PREV_MUNS = f"{ROOT}/canarias-municipios-poly.json.bak"   # para nmun/sections_count
OUT_MUNS = f"{ROOT}/canarias-municipios-poly.json"
OUT_ISLAS = f"{ROOT}/canarias-islands-poly.json"

# Mapping cumun (5 dig) -> isla (igual que _build_canarias_geo.py)
PROV35_GC = {"35001","35002","35005","35006","35008","35009","35011","35012","35013","35016","35019","35020","35021","35022","35023","35025","35026","35027","35031","35032","35033"}
PROV35_LZ = {"35004","35010","35018","35024","35028","35029","35034"}
PROV35_FV = {"35003","35007","35014","35015","35017","35030"}
PROV38_TF = {"38001","38004","38005","38006","38010","38011","38012","38015","38017","38018","38019","38020","38022","38023","38025","38026","38028","38031","38032","38034","38035","38038","38039","38040","38041","38042","38043","38044","38046","38051","38052"}
PROV38_LP = {"38007","38008","38009","38014","38016","38024","38027","38029","38030","38033","38037","38045","38047","38053"}
PROV38_LG = {"38002","38003","38021","38036","38049","38050"}
PROV38_EH = {"38013","38048","38901"}
ISLA_OF = {}
for s,n in [(PROV35_GC,"gc"),(PROV35_LZ,"lz"),(PROV35_FV,"fv"),(PROV38_TF,"tf"),(PROV38_LP,"lp"),(PROV38_LG,"lg"),(PROV38_EH,"eh")]:
    for m in s: ISLA_OF[m]=n
ISLA_NAMES = {"gc":"Gran Canaria","lz":"Lanzarote","fv":"Fuerteventura","tf":"Tenerife","lp":"La Palma","lg":"La Gomera","eh":"El Hierro"}

# ---- TopoJSON decode ----
def load_topo():
    topo = json.load(open(TOPO))
    tr = topo["transform"]; scale = tr["scale"]; trans = tr["translate"]
    raw_arcs = topo["arcs"]
    dec = []
    for arc in raw_arcs:
        pts=[]; x=0; y=0
        for d in arc:
            x+=d[0]; y+=d[1]
            pts.append([x*scale[0]+trans[0], y*scale[1]+trans[1]])
        dec.append(pts)
    return topo, dec

def arc_coords(dec, idx):
    return dec[idx] if idx>=0 else dec[~idx][::-1]

def ring_coords(dec, arc_idx_list):
    out=[]
    for k,idx in enumerate(arc_idx_list):
        seg=arc_coords(dec, idx)
        out.extend(seg if k==0 else seg[1:])
    return out

def geom_to_shape(dec, g):
    t=g["type"]
    if t=="Polygon":
        rings=[ring_coords(dec,r) for r in g["arcs"]]
        return Polygon(rings[0], rings[1:]).buffer(0)
    if t=="MultiPolygon":
        polys=[]
        for poly in g["arcs"]:
            rings=[ring_coords(dec,r) for r in poly]
            polys.append(Polygon(rings[0], rings[1:]))
        return MultiPolygon(polys).buffer(0)
    return None

def main():
    t0=time.time()
    topo, dec = load_topo()
    geoms = topo["objects"]["municipalities"]["geometries"]
    # metadatos previos por cumun (nmun, sections_count) para no perder coloreado
    prev = {}
    if os.path.exists(PREV_MUNS):
        for f in json.load(open(PREV_MUNS))["features"]:
            prev[f["properties"]["cumun"]] = f["properties"]

    muns_feats=[]; isla_geoms=defaultdict(list)
    sample_checked=False
    for g in geoms:
        cumun=str(g.get("id",""))
        if cumun not in ISLA_OF:
            continue
        sh = geom_to_shape(dec, g)
        if sh is None or sh.is_empty:
            print("  warn geom vacia", cumun); continue
        if not sample_checked:
            b=sh.bounds
            print(f"  sample {cumun} bounds={[round(x,3) for x in b]} (esperado lng~-13..-18, lat~27..29)")
            sample_checked=True
        isla=ISLA_OF[cumun]
        pm=prev.get(cumun, {})
        nmun=pm.get("nmun") or g.get("properties",{}).get("name","")
        sc=pm.get("sections_count", 1)
        muns_feats.append({
            "type":"Feature",
            "properties":{
                "mun": cumun[2:],
                "cumun": cumun,
                "nmun": nmun,
                "isla": isla,
                "sections_count": sc,
                "centroid_lnglat":[0,0],   # se rellena tras partición
            },
            "_shape": sh,   # temporal (se elimina antes de escribir)
        })

    # Partición secuencial por isla: el TopoJSON deja micro-overlaps
    # residuales (~0.1 km2 en GC: Ingenio∩Valsequillo). Restamos de cada
    # municipio la unión de los ya colocados (orden área asc, el pequeño
    # se conserva entero) → teselación exacta sin overlaps, sin crear
    # gaps (parten de geometría que ya tesela).
    by_isla=defaultdict(list)
    for f in muns_feats: by_isla[f["properties"]["isla"]].append(f)
    for isla, feats in by_isla.items():
        feats.sort(key=lambda f: f["_shape"].area)
        acc=None
        for f in feats:
            sh=f["_shape"]
            if acc is not None:
                d=sh.difference(acc).buffer(0)
                if not d.is_empty: sh=d
            f["_shape"]=sh
            acc = sh if acc is None else unary_union([acc, sh])
            isla_geoms[isla].append(sh)

    # Finalizar features: centroid + geometry, quitar _shape temporal.
    for f in muns_feats:
        sh=f.pop("_shape")
        c=sh.representative_point()
        f["properties"]["centroid_lnglat"]=[round(c.x,5),round(c.y,5)]
        f["geometry"]=mapping(sh)

    muns_feats.sort(key=lambda f:(f["properties"]["isla"], f["properties"]["mun"]))
    json.dump({"type":"FeatureCollection","features":muns_feats}, open(OUT_MUNS,"w"), ensure_ascii=False)
    print(f"escrito {OUT_MUNS} ({os.path.getsize(OUT_MUNS)/1024/1024:.2f} MB · {len(muns_feats)} muns)")

    # Islas = unión de sus municipios (topología oficial => contorno limpio)
    islas_feats=[]
    for isla,gs in isla_geoms.items():
        u=unary_union(gs).buffer(0)
        c=u.representative_point(); bb=u.bounds
        islas_feats.append({
            "type":"Feature",
            "properties":{
                "isla":isla,"name":ISLA_NAMES[isla],
                "muns_count":len(gs),
                "sections_count":sum(f["properties"]["sections_count"] for f in muns_feats if f["properties"]["isla"]==isla),
                "centroid_lnglat":[round(c.x,5),round(c.y,5)],
                "bbox_lnglat":[round(x,5) for x in bb],
            },
            "geometry": mapping(u),
        })
    islas_feats.sort(key=lambda f:["tf","gc","lz","fv","lp","lg","eh"].index(f["properties"]["isla"]))
    json.dump({"type":"FeatureCollection","features":islas_feats}, open(OUT_ISLAS,"w"), ensure_ascii=False)
    print(f"escrito {OUT_ISLAS} ({os.path.getsize(OUT_ISLAS)/1024/1024:.2f} MB · {len(islas_feats)} islas)")
    print(f"total {time.time()-t0:.1f}s")

if __name__=="__main__":
    main()
