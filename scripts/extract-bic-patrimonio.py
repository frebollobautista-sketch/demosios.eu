#!/usr/bin/env python3
"""
extract-bic-patrimonio.py — Extrae Bienes de Interés Cultural (BIC) y
patrimonio catalogado del archipiélago canario y escribe
public/data/bic-patrimonio-canarias.geojson.

Fuentes:
  1. BIC oficial Tenerife (datos.tenerife.es) — inmuebles declarados con
     geometría MultiPolygon, categoría oficial y fecha de declaración
     (extraída del BOC).
  2. Fallback OSM Geofabrik PBF (canary-islands-latest.osm.pbf) — nodos con
     tag `historic=*` para cubrir el resto de islas. Tags aceptados:
       historic=monument, archaeological_site, castle, ruins, wayside_shrine,
       wayside_cross, memorial, tomb, manor, mine, building, city_gate.

Schema properties:
  - nombre
  - tipo               (bic / archaeological / iglesia / castle / monumento /
                        memorial / ruins / etc.)
  - categoria          (arquitectura / arqueologia / etnografico /
                        memoria / paleontologico / desconocido)
  - mun                (municipio cuando se conoce)
  - fecha_declaracion  (sólo para BIC con BOC publicado; null en OSM)
  - fuente             (gobcan-tenerife / osm)
  - id

Salida: FeatureCollection con Point (centroides cuando el origen es polígono).
"""

import json
import os
import re
import sys
import urllib.request
from collections import Counter, defaultdict

import osmium

ROOT = "/Users/panch/KOINOS-iso"
PBF = f"{ROOT}/GEOFABRIK/canary-islands-latest.osm.pbf"
OUT = f"{ROOT}/public/data/bic-patrimonio-canarias.geojson"
TEN_URL = (
    "https://datos.tenerife.es/ckan/dataset/"
    "83530250-3418-43d0-8019-18345a211271/resource/"
    "e9e78284-c65a-489e-9aaa-3282bd1ccd4c/download/bic_inmuebles.geojson"
)
CACHE_TEN = f"{ROOT}/scripts/_cache/bic_tenerife.geojson"

# Bbox Canarias: lng [-18.2, -13.3], lat [27.5, 29.5]
BBOX = (-18.2, 27.5, -13.3, 29.5)

# Mapeo categoría oficial GobCan → (tipo, categoria normalizada)
CAT_GOBCAN = {
    "MONUMENTO":          ("monumento",      "arquitectura"),
    "CONJUNTO HISTÓRICO": ("bic",            "arquitectura"),
    "SITIO HISTÓRICO":    ("bic",            "memoria"),
    "ZONA ARQUEOLÓGICA":  ("archaeological", "arqueologia"),
    "SITIO ETNOLÓGICO":   ("bic",            "etnografico"),
    "JARDÍN HISTÓRICO":   ("bic",            "arquitectura"),
    "ZONA PALEONTOLÓGICA":("archaeological", "paleontologico"),
}

# Mapeo OSM historic=* → (tipo, categoria)
HISTORIC_OSM = {
    "monument":           ("monumento",      "arquitectura"),
    "archaeological_site":("archaeological", "arqueologia"),
    "castle":             ("castle",         "arquitectura"),
    "fort":               ("castle",         "arquitectura"),
    "ruins":              ("ruins",          "arquitectura"),
    "wayside_cross":      ("iglesia",        "memoria"),
    "wayside_shrine":     ("iglesia",        "memoria"),
    "memorial":           ("memorial",       "memoria"),
    "tomb":               ("memorial",       "memoria"),
    "manor":              ("monumento",      "arquitectura"),
    "mine":               ("ruins",          "etnografico"),
    "city_gate":          ("castle",         "arquitectura"),
    "building":           ("monumento",      "arquitectura"),
}

# Religioso fuera de historic=* — añadimos amenity=place_of_worship si tiene
# wikidata/heritage para no duplicar la capa cultura-venues.
HERITAGE_RELIGIOUS_TAGS = ("heritage", "ref:bic", "wikidata")

YEAR_RE = re.compile(r"\b(19|20)\d{2}\b")


def _in_bbox(lon, lat):
    return BBOX[0] <= lon <= BBOX[2] and BBOX[1] <= lat <= BBOX[3]


def _polygon_centroid(coords):
    """Centroide simple (media) de coordenadas anidadas — vale para visor iso."""
    xs, ys = [], []

    def walk(c):
        if not c:
            return
        if isinstance(c[0], (int, float)):
            xs.append(c[0])
            ys.append(c[1])
        else:
            for sub in c:
                walk(sub)

    walk(coords)
    if not xs:
        return None
    return (sum(xs) / len(xs), sum(ys) / len(ys))


def _extract_year(text):
    if not text:
        return None
    m = YEAR_RE.search(text)
    return m.group(0) if m else None


def fetch_tenerife():
    os.makedirs(os.path.dirname(CACHE_TEN), exist_ok=True)
    if not os.path.exists(CACHE_TEN):
        print(f"descargando {TEN_URL} → {CACHE_TEN}", file=sys.stderr)
        req = urllib.request.Request(TEN_URL, headers={"User-Agent": "polis-iso/1.0"})
        with urllib.request.urlopen(req, timeout=60) as r, open(CACHE_TEN, "wb") as f:
            f.write(r.read())
    with open(CACHE_TEN, "r", encoding="utf-8") as f:
        return json.load(f)


def parse_tenerife(fc):
    out = []
    counts = Counter()
    for feat in fc.get("features", []):
        geom = feat.get("geometry") or {}
        props = feat.get("properties") or {}
        # bic_entorno es un flag descriptivo, no implica duplicación: cada BIC
        # aparece una sola vez con su geometría.
        ctr = _polygon_centroid(geom.get("coordinates"))
        if not ctr:
            continue
        lon, lat = ctr
        if not _in_bbox(lon, lat):
            continue
        cat_orig = (props.get("bic_categoria") or "").strip().upper()
        tipo, cat = CAT_GOBCAN.get(cat_orig, ("bic", "arquitectura"))
        fecha = _extract_year(props.get("bic_descripcion")) \
            or _extract_year(props.get("boletin1_nombre"))
        out.append({
            "type": "Feature",
            "geometry": {"type": "Point",
                         "coordinates": [round(lon, 6), round(lat, 6)]},
            "properties": {
                "nombre": (props.get("bic_nombre") or "").title() or None,
                "tipo": tipo,
                "categoria": cat,
                "mun": (props.get("municipio_nombre") or "").title() or None,
                "fecha_declaracion": fecha,
                "fuente": "gobcan-tenerife",
                "categoria_original": cat_orig or None,
                "id": f"bic-tf-{len(out)}",
            }
        })
        counts[tipo] += 1
    return out, counts


class OSMHistoric(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.features = []
        self.counts = Counter()
        self.seen = set()

    def _accept(self, tags):
        # historic=* preferente
        h = tags.get("historic")
        if h and h in HISTORIC_OSM:
            return HISTORIC_OSM[h]
        if h == "yes":
            return ("monumento", "arquitectura")
        # iglesia/ermita con marca de patrimonio
        if tags.get("amenity") == "place_of_worship":
            for k in HERITAGE_RELIGIOUS_TAGS:
                if tags.get(k):
                    return ("iglesia", "arquitectura")
        # building=church/chapel histórica
        if tags.get("building") in ("church", "chapel", "cathedral"):
            if tags.get("historic") or tags.get("heritage"):
                return ("iglesia", "arquitectura")
        return None

    def node(self, n):
        tags = {t.k: t.v for t in n.tags}
        m = self._accept(tags)
        if not m:
            return
        try:
            lon, lat = n.location.lon, n.location.lat
        except osmium.InvalidLocationError:
            return
        if not _in_bbox(lon, lat):
            return
        key = (round(lon, 5), round(lat, 5))
        if key in self.seen:
            return
        self.seen.add(key)
        tipo, cat = m
        name = tags.get("name") or tags.get("name:es")
        start = tags.get("start_date") or tags.get("year_of_construction")
        self.features.append({
            "type": "Feature",
            "geometry": {"type": "Point",
                         "coordinates": [round(lon, 6), round(lat, 6)]},
            "properties": {
                "nombre": name,
                "tipo": tipo,
                "categoria": cat,
                "mun": tags.get("addr:city") or tags.get("is_in:municipality"),
                "fecha_declaracion": _extract_year(start),
                "fuente": "osm",
                "osm_tag_historic": tags.get("historic"),
                "id": f"osm-n-{n.id}",
            }
        })
        self.counts[tipo] += 1

    def area(self, a):
        tags = {t.k: t.v for t in a.tags}
        m = self._accept(tags)
        if not m:
            return
        try:
            outer = next(iter(a.outer_rings()), None)
            if outer is None:
                return
            xs, ys = [], []
            for pt in outer:
                xs.append(pt.lon)
                ys.append(pt.lat)
            if not xs:
                return
            lon = sum(xs) / len(xs)
            lat = sum(ys) / len(ys)
        except Exception:
            return
        if not _in_bbox(lon, lat):
            return
        key = (round(lon, 5), round(lat, 5))
        if key in self.seen:
            return
        self.seen.add(key)
        tipo, cat = m
        name = tags.get("name") or tags.get("name:es")
        self.features.append({
            "type": "Feature",
            "geometry": {"type": "Point",
                         "coordinates": [round(lon, 6), round(lat, 6)]},
            "properties": {
                "nombre": name,
                "tipo": tipo,
                "categoria": cat,
                "mun": tags.get("addr:city"),
                "fecha_declaracion": _extract_year(
                    tags.get("start_date") or tags.get("year_of_construction")),
                "fuente": "osm",
                "osm_tag_historic": tags.get("historic"),
                "id": f"osm-a-{a.id}",
            }
        })
        self.counts[tipo] += 1


def parse_osm():
    if not os.path.exists(PBF):
        print(f"WARN: PBF no encontrado {PBF}", file=sys.stderr)
        return [], Counter()
    ex = OSMHistoric()
    ex.apply_file(PBF, locations=True)
    return ex.features, ex.counts


def dedupe_osm_vs_tenerife(osm_feats, ten_feats, radius_deg=0.002):
    """Eliminamos puntos OSM que caigan a <~200m de un BIC oficial Tenerife."""
    grid = defaultdict(list)
    for f in ten_feats:
        lon, lat = f["geometry"]["coordinates"]
        grid[(round(lon, 2), round(lat, 2))].append((lon, lat))
    kept = []
    dropped = 0
    for f in osm_feats:
        lon, lat = f["geometry"]["coordinates"]
        near = False
        for dx in (-0.01, 0, 0.01):
            for dy in (-0.01, 0, 0.01):
                key = (round(lon + dx, 2), round(lat + dy, 2))
                for (tlon, tlat) in grid.get(key, ()):
                    if abs(tlon - lon) < radius_deg and abs(tlat - lat) < radius_deg:
                        near = True
                        break
                if near:
                    break
            if near:
                break
        if near:
            dropped += 1
            continue
        kept.append(f)
    return kept, dropped


def main():
    try:
        ten_fc = fetch_tenerife()
    except Exception as e:
        print(f"WARN: fallo Tenerife ({e}); continuamos sólo con OSM", file=sys.stderr)
        ten_fc = {"features": []}
    ten_feats, ten_counts = parse_tenerife(ten_fc)
    print(f"BIC Tenerife oficial: {len(ten_feats)} ({dict(ten_counts)})",
          file=sys.stderr)

    osm_feats, osm_counts = parse_osm()
    print(f"OSM historic crudo: {len(osm_feats)} ({dict(osm_counts)})",
          file=sys.stderr)

    osm_feats, dropped = dedupe_osm_vs_tenerife(osm_feats, ten_feats)
    print(f"OSM tras dedupe vs Tenerife: {len(osm_feats)} (drop {dropped})",
          file=sys.stderr)

    all_feats = ten_feats + osm_feats

    by_tipo = Counter(f["properties"]["tipo"] for f in all_feats)
    by_fuente = Counter(f["properties"]["fuente"] for f in all_feats)

    out_fc = {
        "type": "FeatureCollection",
        "name": "bic-patrimonio-canarias",
        "generated_at": "2026-05-27",
        "sources": [
            "datos.tenerife.es CKAN bic_inmuebles.geojson (Gobierno de Canarias)",
            f"OSM Geofabrik {os.path.basename(PBF)} (historic=*)",
        ],
        "count": len(all_feats),
        "by_tipo": dict(by_tipo),
        "by_fuente": dict(by_fuente),
        "features": all_feats,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out_fc, f, ensure_ascii=False, separators=(",", ":"))
    print(f"wrote {OUT} — {len(all_feats)} features", file=sys.stderr)
    for tipo, n in by_tipo.most_common():
        print(f"  {tipo:18s} {n}", file=sys.stderr)


if __name__ == "__main__":
    main()
