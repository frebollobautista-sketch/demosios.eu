#!/usr/bin/env python3
"""Extrae negocios locales desde el PBF Geofabrik canary-islands-latest.

Captura:
  - shop=* (todas las tiendas: panadería, carnicería, supermercado, ropa, etc.)
  - amenity in {marketplace, restaurant, cafe, bar, pub, fast_food,
                ice_cream, food_court}

Clasifica en bucket:
  alimentacion: pan, carne, pescado, frutas, ultramarinos, supermercado,
                bebidas, mercado, restaurante, cafe, bar
  hogar: ferretería, muebles, electrodomésticos
  cuidado: farmacia, óptica, peluquería, herbolario
  ropa: clothes, shoes, jewelry
  cultura: books, music, stationery
  ocio: sports, toys, gift
  otros: el resto

Output: public/data/negocios-canarias.geojson
"""
from __future__ import annotations
import json
import pathlib
import sys
from collections import Counter

try:
    import osmium
except ImportError:
    print("Necesita: pip install osmium")
    sys.exit(1)

ROOT = pathlib.Path(__file__).resolve().parent.parent
PBF = ROOT / "GEOFABRIK" / "canary-islands-latest.osm.pbf"
OUT = ROOT / "public" / "data" / "negocios-canarias.geojson"

BBOX = (-18.5, 27.4, -13.2, 29.6)

# Bucket mapping: subtipo OSM → categoria visual
ALIMENTACION_SHOP = {
    "bakery": "panaderia",
    "butcher": "carniceria",
    "seafood": "pescaderia",
    "fishmonger": "pescaderia",
    "greengrocer": "fruteria",
    "fruit": "fruteria",
    "supermarket": "supermercado",
    "convenience": "ultramarinos",
    "general": "ultramarinos",
    "alcohol": "bebidas",
    "wine": "bebidas",
    "beverages": "bebidas",
    "deli": "ultramarinos",
    "cheese": "ultramarinos",
    "dairy": "ultramarinos",
    "pastry": "panaderia",
    "confectionery": "panaderia",
    "chocolate": "panaderia",
    "tea": "bebidas",
    "coffee": "bebidas",
    "spices": "ultramarinos",
    "farm": "ultramarinos",
    "organic": "ultramarinos",
    "food": "ultramarinos",
}
ALIMENTACION_AMENITY = {
    "marketplace": "mercado",
    "restaurant": "restaurante",
    "cafe": "cafe",
    "bar": "bar",
    "pub": "bar",
    "fast_food": "restaurante",
    "ice_cream": "cafe",
    "food_court": "mercado",
    "biergarten": "bar",
}
HOGAR = {"hardware", "doityourself", "furniture", "electronics", "appliance",
         "garden_centre", "florist", "kitchen", "bathroom_furnishing",
         "houseware", "paint", "lighting", "bed", "interior_decoration"}
CUIDADO = {"pharmacy", "optician", "hairdresser", "beauty", "herbalist",
           "cosmetics", "perfumery", "tattoo", "massage", "nail"}
ROPA = {"clothes", "shoes", "jewelry", "bag", "watches", "fashion_accessories",
        "second_hand", "fabric", "leather"}
CULTURA = {"books", "music", "stationery", "art", "musical_instrument",
           "newsagent", "video", "video_games", "anime"}
OCIO = {"sports", "toys", "gift", "outdoor", "bicycle", "hobby", "model",
        "fishing", "hunting"}


def classify(tag_type, source):
    """Devuelve (bucket, subcat). bucket = grupo visual top-level."""
    if source == "amenity":
        sub = ALIMENTACION_AMENITY.get(tag_type)
        if sub:
            return ("alimentacion", sub)
    elif source == "shop":
        sub = ALIMENTACION_SHOP.get(tag_type)
        if sub:
            return ("alimentacion", sub)
        if tag_type in HOGAR: return ("hogar", tag_type)
        if tag_type in CUIDADO: return ("cuidado", tag_type)
        if tag_type in ROPA: return ("ropa", tag_type)
        if tag_type in CULTURA: return ("cultura", tag_type)
        if tag_type in OCIO: return ("ocio", tag_type)
        return ("otros", tag_type)
    return None


class Extractor(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.feats = []

    def node(self, n):
        try:
            lon, lat = n.location.lon, n.location.lat
        except osmium.InvalidLocationError:
            return
        if not (BBOX[0] <= lon <= BBOX[2] and BBOX[1] <= lat <= BBOX[3]):
            return
        tags = n.tags
        shop = tags.get("shop", "")
        amenity = tags.get("amenity", "")
        cls = None
        kind_raw = None
        source = None
        if shop:
            cls = classify(shop, "shop")
            kind_raw = shop; source = "shop"
        elif amenity in ALIMENTACION_AMENITY:
            cls = classify(amenity, "amenity")
            kind_raw = amenity; source = "amenity"
        if not cls:
            return
        bucket, subcat = cls
        self.feats.append({
            "type": "Feature",
            "geometry": {"type": "Point",
                         "coordinates": [round(lon, 6), round(lat, 6)]},
            "properties": {
                "name": tags.get("name", ""),
                "bucket": bucket,
                "subcat": subcat,
                "kind_raw": kind_raw,
                "source": source,
            },
        })


def main():
    if not PBF.exists():
        print(f"⚠ No existe {PBF}. Necesita PBF Geofabrik canary-islands.")
        sys.exit(1)
    ex = Extractor()
    ex.apply_file(str(PBF), locations=True, idx="flex_mem")
    print(f"Extraídos: {len(ex.feats)} negocios")
    buckets = Counter(f["properties"]["bucket"] for f in ex.feats)
    print("\nPor bucket:")
    for k, v in buckets.most_common():
        print(f"  {v:>5}  {k}")
    print("\nPor subcat alimentación (top 10):")
    ali_sub = Counter(f["properties"]["subcat"] for f in ex.feats
                      if f["properties"]["bucket"] == "alimentacion")
    for k, v in ali_sub.most_common():
        print(f"  {v:>5}  {k}")

    out = {
        "type": "FeatureCollection",
        "features": ex.feats,
        "metadata": {
            "generated_at": __import__("datetime").datetime.now().isoformat(),
            "source": "GEOFABRIK canary-islands-latest.osm.pbf",
            "n_features": len(ex.feats),
            "buckets": dict(buckets),
        },
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"\n→ {OUT.name}  ({OUT.stat().st_size/1024:.0f} KB)")


if __name__ == "__main__":
    main()
