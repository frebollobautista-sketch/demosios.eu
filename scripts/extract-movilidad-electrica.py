#!/usr/bin/env python3
"""
extract-movilidad-electrica.py — MOV-03 · Aparcabicis + recarga eléctrica
=========================================================================

Indicador del visor OCRE · POLIS. Tres fuentes combinadas en un único
FeatureCollection:

  1. OSM PBF Geofabrik (canary-islands-latest):
       amenity=bicycle_parking   → tipo "bici_parking"
       amenity=charging_station  → tipo "recarga"
     Acepta nodes y areas (way cerrado). Plazas leídas de `capacity`,
     potencia eléctrica de `maxpower` / `output` (cuando exista, kW).

  2. Sítycleta (Las Palmas de GC) — bike-sharing del Ayuntamiento.
     Detrás de Sítycleta está Nextbike (la web `sitycleta.es` redirige a
     `sitycleta.com` con header `X-Nextbike-Reason`). Usamos el feed
     público Nextbike `api.nextbike.net/maps/nextbike-live.json` filtrado
     por `city.uid = 408` (Las Palmas de GC). 65 estaciones a 2026-05-27.
       tipo "bike_sharing", brand "Sitycleta"
     plazas = bike_racks · stand-by = bikes_available_to_rent (no se exporta
     para mantener output estable entre snapshots).

  3. BiciAmbiental (Tenerife) — servicio similar de bike-sharing.
     A 2026-05-27 BiciAmbiental NO publica feed GBFS ni endpoint abierto
     conocido (la URL biciambiental.org no expone catálogo). Mientras no
     haya feed, el script lee un CSV manual opcional en
       data-sources/biciambiental-tf.csv
     con columnas `nombre,lat,lng,mun,plazas`. Si no existe, simplemente
     no se emiten features de BiciAmbiental (no aborta).

Reverse-geocode `isla`: bbox por isla (suficiente para Canarias dado que
las islas no se solapan en lng/lat). `mun` se toma de tags OSM cuando
existe (`addr:city` / `is_in:municipality`), y se deja string vacío en
otros casos — el overlay no depende de `mun` para filtrar.

Salida: public/data/movilidad-electrica-canarias.geojson

Features properties:
  { nombre, tipo, isla, mun, plazas?, brand?, kw_max?, osm_id? }
"""

import csv
import json
import math
import os
import ssl
import sys
import urllib.request
from collections import defaultdict

import osmium

ROOT = "/Users/panch/KOINOS-iso"
PBF_CANDIDATES = [
    f"{ROOT}/GEOFABRIK/canary-islands-latest.osm.pbf",
    f"{ROOT}/GEOFABRIK/canary-islands-260410.osm.pbf",
]
OUT = f"{ROOT}/public/data/movilidad-electrica-canarias.geojson"

BICIAMB_CSV = f"{ROOT}/data-sources/biciambiental-tf.csv"

# Bbox Canarias archipiélago (ligeramente holgado).
BBOX = (-18.5, 27.4, -13.2, 29.6)

# Bboxes por isla — orden de prioridad evita que La Graciosa caiga en
# Lanzarote (subset). Cada entrada: nombre → (lng_min, lat_min, lng_max, lat_max)
ISLAS_BBOX = [
    ("La Graciosa",   (-13.55, 29.20, -13.43, 29.32)),
    ("Lanzarote",     (-13.92, 28.83, -13.40, 29.30)),
    ("Fuerteventura", (-14.55, 28.02, -13.78, 28.78)),
    ("Gran Canaria",  (-15.85, 27.70, -15.34, 28.20)),
    ("Tenerife",      (-16.95, 28.00, -16.10, 28.62)),
    ("La Gomera",     (-17.36, 27.95, -17.05, 28.23)),
    ("La Palma",      (-18.00, 28.40, -17.70, 28.90)),
    ("El Hierro",     (-18.20, 27.60, -17.85, 27.85)),
]

NEXTBIKE_URL = "https://api.nextbike.net/maps/nextbike-live.json?countries=ES"
NEXTBIKE_LPGC_UID = 408  # ciudad Las Palmas de GC en el feed Nextbike

COORD_DECIMALS = 6


# ---------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------

def isla_from_lnglat(lon, lat):
    for nombre, (a, b, c, d) in ISLAS_BBOX:
        if a <= lon <= c and b <= lat <= d:
            return nombre
    return None


def _to_int(value):
    if value is None:
        return None
    try:
        s = str(value).strip().replace(",", ".")
        if not s:
            return None
        return int(float(s))
    except (TypeError, ValueError):
        return None


def _parse_kw(tags):
    """Devuelve kW máximo del charging_station leyendo OSM tags."""
    raw = (tags.get("maxpower") or tags.get("output") or
           tags.get("socket:type2:output") or tags.get("socket:chademo:output") or
           tags.get("socket:ccs:output") or "")
    if not raw:
        return None
    raw = str(raw).lower().strip()
    # Formatos vistos: "22", "22 kw", "22kW", "11kw;22kw", "3.7;22"
    candidates = []
    for chunk in raw.replace(";", ",").split(","):
        s = chunk.strip()
        for unit in ("kw", "kva"):
            if s.endswith(unit):
                s = s[: -len(unit)].strip()
        try:
            candidates.append(float(s.replace(" ", "")))
        except ValueError:
            continue
    if not candidates:
        return None
    return round(max(candidates), 1)


# ---------------------------------------------------------------
# OSM handler — aparcabicis + recarga eléctrica
# ---------------------------------------------------------------

class OSMExtractor(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.features = []
        self.counts = defaultdict(int)
        self._seen_ids = set()

    def _in_bbox(self, lon, lat):
        return BBOX[0] <= lon <= BBOX[2] and BBOX[1] <= lat <= BBOX[3]

    def _push(self, osm_id, lon, lat, tags):
        if osm_id in self._seen_ids:
            return
        if not self._in_bbox(lon, lat):
            return
        amen = tags.get("amenity")
        if amen == "bicycle_parking":
            tipo = "bici_parking"
        elif amen == "charging_station":
            tipo = "recarga"
        else:
            return

        isla = isla_from_lnglat(lon, lat)
        nombre = (tags.get("name") or tags.get("name:es") or "").strip()
        mun = (tags.get("addr:city") or tags.get("is_in:municipality") or "").strip()
        plazas = _to_int(tags.get("capacity"))
        kw_max = _parse_kw(tags) if tipo == "recarga" else None
        brand = (tags.get("brand") or tags.get("operator") or "").strip() or None

        props = {
            "nombre": nombre or None,
            "tipo": tipo,
            "isla": isla,
            "mun": mun or None,
            "osm_id": osm_id,
        }
        if plazas is not None:
            props["plazas"] = plazas
        if brand:
            props["brand"] = brand
        if kw_max is not None:
            props["kw_max"] = kw_max
        # Limpia None para reducir peso
        props = {k: v for k, v in props.items() if v is not None}

        self.features.append({
            "type": "Feature",
            "geometry": {"type": "Point",
                         "coordinates": [round(lon, COORD_DECIMALS),
                                         round(lat, COORD_DECIMALS)]},
            "properties": props,
        })
        self.counts[tipo] += 1
        self._seen_ids.add(osm_id)

    def node(self, n):
        tags = {t.k: t.v for t in n.tags}
        if tags.get("amenity") not in ("bicycle_parking", "charging_station"):
            return
        try:
            lon, lat = n.location.lon, n.location.lat
        except osmium.InvalidLocationError:
            return
        self._push(f"node/{n.id}", lon, lat, tags)

    def area(self, a):
        tags = {t.k: t.v for t in a.tags}
        if tags.get("amenity") not in ("bicycle_parking", "charging_station"):
            return
        try:
            outer = next(iter(a.outer_rings()), None)
            if outer is None:
                return
            xs, ys = [], []
            for pt in outer:
                xs.append(pt.lon); ys.append(pt.lat)
            if not xs:
                return
            lon = sum(xs) / len(xs)
            lat = sum(ys) / len(ys)
        except Exception:
            return
        self._push(f"area/{a.id}", lon, lat, tags)


# ---------------------------------------------------------------
# Sítycleta (Nextbike feed)
# ---------------------------------------------------------------

def fetch_sitycleta():
    """Descarga el feed Nextbike-ES y filtra Las Palmas (uid 408).
    Devuelve lista de features GeoJSON con tipo `bike_sharing`."""
    ctx = ssl.create_default_context()
    try:
        req = urllib.request.Request(
            NEXTBIKE_URL,
            headers={
                # Sin UA "Python-urllib/..." Nextbike contesta 403. Cualquier
                # UA realista funciona.
                "User-Agent": ("Mozilla/5.0 (compatible; KOINOS-OCRE/1.0; "
                               "+https://github.com/panchcc/koinos-iso)"),
                "Accept": "application/json, */*;q=0.8",
            },
        )
        with urllib.request.urlopen(req, timeout=20, context=ctx) as r:
            data = json.load(r)
    except Exception as e:
        print(f"WARN: no se pudo descargar Nextbike feed: {e}", file=sys.stderr)
        return []

    feats = []
    for country in data.get("countries", []):
        for city in country.get("cities", []):
            if city.get("uid") != NEXTBIKE_LPGC_UID:
                continue
            for place in city.get("places", []):
                lon = place.get("lng")
                lat = place.get("lat")
                if lon is None or lat is None:
                    continue
                # Algunas filas son `bike: true` (bici suelta), no estación —
                # las dejamos fuera porque no son aparcamiento físico.
                if place.get("spot") is False and place.get("bike") is True:
                    continue
                isla = isla_from_lnglat(lon, lat) or "Gran Canaria"
                nombre = (place.get("name") or "").strip()
                plazas = place.get("bike_racks")
                props = {
                    "nombre": nombre or None,
                    "tipo": "bike_sharing",
                    "isla": isla,
                    "mun": "Las Palmas de Gran Canaria",
                    "brand": "Sítycleta",
                    "src_id": f"nextbike/{place.get('uid')}",
                }
                if isinstance(plazas, int) and plazas > 0:
                    props["plazas"] = plazas
                props = {k: v for k, v in props.items() if v is not None}
                feats.append({
                    "type": "Feature",
                    "geometry": {"type": "Point",
                                 "coordinates": [round(lon, COORD_DECIMALS),
                                                 round(lat, COORD_DECIMALS)]},
                    "properties": props,
                })
    print(f"  Sítycleta (Nextbike LPGC): {len(feats)} estaciones", file=sys.stderr)
    return feats


# ---------------------------------------------------------------
# BiciAmbiental — CSV manual opcional (Tenerife)
# ---------------------------------------------------------------

def fetch_biciambiental():
    """Lee CSV manual si existe. Formato:
       nombre,lat,lng,mun,plazas
    A 2026-05-27 BiciAmbiental no publica feed abierto; este lector
    permite añadir estaciones a mano sin tocar el script."""
    if not os.path.exists(BICIAMB_CSV):
        print(f"  BiciAmbiental: sin CSV manual ({BICIAMB_CSV}) — 0 estaciones",
              file=sys.stderr)
        return []
    feats = []
    with open(BICIAMB_CSV, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            try:
                lat = float(row["lat"]); lon = float(row["lng"])
            except (KeyError, TypeError, ValueError):
                continue
            isla = isla_from_lnglat(lon, lat) or "Tenerife"
            props = {
                "nombre": (row.get("nombre") or "").strip() or None,
                "tipo": "bike_sharing",
                "isla": isla,
                "mun": (row.get("mun") or "").strip() or None,
                "brand": "BiciAmbiental",
                "src_id": f"biciamb/{len(feats)}",
            }
            plazas = _to_int(row.get("plazas"))
            if plazas is not None:
                props["plazas"] = plazas
            props = {k: v for k, v in props.items() if v is not None}
            feats.append({
                "type": "Feature",
                "geometry": {"type": "Point",
                             "coordinates": [round(lon, COORD_DECIMALS),
                                             round(lat, COORD_DECIMALS)]},
                "properties": props,
            })
    print(f"  BiciAmbiental (CSV manual): {len(feats)} estaciones",
          file=sys.stderr)
    return feats


# ---------------------------------------------------------------
# main
# ---------------------------------------------------------------

def main():
    pbf = next((p for p in PBF_CANDIDATES if os.path.exists(p)), None)
    if not pbf:
        print("ERROR: PBF Geofabrik no encontrado", file=sys.stderr)
        sys.exit(1)
    print(f"PBF: {pbf}", file=sys.stderr)

    ex = OSMExtractor()
    ex.apply_file(pbf, locations=True)
    osm_feats = ex.features
    print(f"OSM: bici_parking={ex.counts['bici_parking']} · "
          f"recarga={ex.counts['recarga']}", file=sys.stderr)

    sityc_feats = fetch_sitycleta()
    biciamb_feats = fetch_biciambiental()

    features = osm_feats + sityc_feats + biciamb_feats

    # Contadores por tipo y por isla (útiles para sub-chips en runtime)
    by_tipo = defaultdict(int)
    by_isla = defaultdict(lambda: defaultdict(int))
    for f in features:
        t = f["properties"]["tipo"]
        i = f["properties"].get("isla") or "?"
        by_tipo[t] += 1
        by_isla[i][t] += 1

    out_fc = {
        "type": "FeatureCollection",
        "name": "movilidad-electrica-canarias",
        "indicator": "MOV-03",
        "generated_at": "2026-05-27",
        "sources": {
            "osm_pbf": os.path.basename(pbf),
            "sitycleta": NEXTBIKE_URL + f" (city.uid={NEXTBIKE_LPGC_UID})",
            "biciambiental": ("CSV manual data-sources/biciambiental-tf.csv "
                              "— sin feed abierto a 2026-05-27"),
        },
        "count": len(features),
        "by_tipo": dict(by_tipo),
        "by_isla": {k: dict(v) for k, v in by_isla.items()},
        "features": features,
    }

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(out_fc, f, ensure_ascii=False, separators=(",", ":"))
    size_kb = os.path.getsize(OUT) / 1024
    print(f"\nwrote {OUT} — {len(features)} features ({size_kb:.1f} KB)",
          file=sys.stderr)
    for t, n in sorted(by_tipo.items(), key=lambda x: -x[1]):
        print(f"  {t}: {n}", file=sys.stderr)


if __name__ == "__main__":
    main()
