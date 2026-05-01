#!/usr/bin/env python3
"""
pbf-to-osm-layers.py — Extrae capas OSM del PBF para Provincia 35.
Una sola pasada usando SimpleHandler con location handler integrado.
"""

import osmium
import json
import os
import sys
import time

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(SCRIPT_DIR)
OUT_DIR = os.path.join(ROOT, "public", "osm-gc")
os.makedirs(OUT_DIR, exist_ok=True)

PBF_CANDIDATES = [
    os.path.join(ROOT, "GEOFABRIK", "canary-islands-260410.osm.pbf"),
    os.path.join(ROOT, "KOINOS duplicado", "GEOFABRIK", "canary-islands-260410.osm.pbf"),
]
PBF_PATH = None
for p in PBF_CANDIDATES:
    if os.path.exists(p) and os.path.getsize(p) > 1000:
        PBF_PATH = p; break
if not PBF_PATH:
    print("ERROR: No PBF"); sys.exit(1)

BBOX = (-16.2, 27.5, -13.3, 29.5)

HIGHWAY_TYPES = frozenset(['motorway','trunk','primary','secondary','tertiary',
    'residential','unclassified','service','living_street','pedestrian',
    'track','path','footway','cycleway',
    'motorway_link','trunk_link','primary_link','secondary_link'])

AMENITY_POIS = frozenset(['restaurant','cafe','bar','hospital','clinic','pharmacy',
    'school','university','bank','place_of_worship','library','police','townhall',
    'fuel','bus_station'])
TOURISM_POIS = frozenset(['hotel','museum','viewpoint','attraction','camp_site'])


class Extractor(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.roads = []
        self.parks = []
        self.water = []
        self.coast = []
        self.pois = []

    def _get_coords(self, way):
        coords = []
        for n in way.nodes:
            try:
                lon, lat = n.lon, n.lat
                if BBOX[0] <= lon <= BBOX[2] and BBOX[1] <= lat <= BBOX[3]:
                    coords.append([round(lon,6), round(lat,6)])
                else:
                    coords.append(None)  # out of bbox
            except osmium.InvalidLocationError:
                coords.append(None)
        # Remove None at edges, keep inner
        while coords and coords[0] is None: coords.pop(0)
        while coords and coords[-1] is None: coords.pop()
        return [c for c in coords if c is not None]

    def node(self, n):
        try:
            lon, lat = n.location.lon, n.location.lat
        except osmium.InvalidLocationError:
            return
        if not (BBOX[0] <= lon <= BBOX[2] and BBOX[1] <= lat <= BBOX[3]):
            return
        tags = n.tags
        amenity = tags.get('amenity','')
        tourism = tags.get('tourism','')
        natural = tags.get('natural','')
        poi = None
        if amenity in AMENITY_POIS:
            poi = {'type':amenity,'category':'amenity'}
        elif tourism in TOURISM_POIS:
            poi = {'type':tourism,'category':'tourism'}
        elif natural in ('peak','volcano','beach'):
            poi = {'type':natural,'category':'natural'}
        elif tags.get('aeroway') == 'aerodrome':
            poi = {'type':'aerodrome','category':'transport'}
        if poi:
            poi['name'] = tags.get('name','')
            self.pois.append({'type':'Feature',
                'geometry':{'type':'Point','coordinates':[round(lon,6),round(lat,6)]},
                'properties':poi})

    def way(self, w):
        tags = w.tags
        hw = tags.get('highway','')
        nat = tags.get('natural','')
        ww = tags.get('waterway','')
        lei = tags.get('leisure','')
        lu = tags.get('landuse','')

        if hw in HIGHWAY_TYPES:
            coords = self._get_coords(w)
            if len(coords) >= 2:
                self.roads.append({'type':'Feature',
                    'geometry':{'type':'LineString','coordinates':coords},
                    'properties':{'highway':hw,'name':tags.get('name','')}})
        elif nat == 'coastline':
            coords = self._get_coords(w)
            if len(coords) >= 2:
                self.coast.append({'type':'Feature',
                    'geometry':{'type':'LineString','coordinates':coords},
                    'properties':{}})
        elif nat in ('water','bay') or ww in ('river','stream','canal','drain') or lu == 'reservoir':
            coords = self._get_coords(w)
            if ww in ('river','stream','canal','drain'):
                if len(coords) >= 2:
                    self.water.append({'type':'Feature',
                        'geometry':{'type':'LineString','coordinates':coords},
                        'properties':{'type':ww,'name':tags.get('name','')}})
            else:
                if len(coords) >= 4:
                    if coords[0] != coords[-1]: coords.append(coords[0])
                    self.water.append({'type':'Feature',
                        'geometry':{'type':'Polygon','coordinates':[coords]},
                        'properties':{'type':nat or lu,'name':tags.get('name','')}})
        elif (lei in ('park','garden','playground','pitch','nature_reserve') or
              lu in ('forest','farmland','vineyard','orchard','cemetery') or
              nat in ('wood','scrub','sand','beach') or
              tags.get('boundary') == 'protected_area'):
            coords = self._get_coords(w)
            if len(coords) >= 4:
                if coords[0] != coords[-1]: coords.append(coords[0])
                ptype = lei or lu or nat or 'park'
                self.parks.append({'type':'Feature',
                    'geometry':{'type':'Polygon','coordinates':[coords]},
                    'properties':{'type':ptype,'name':tags.get('name','')}})


def main():
    print("PBF → OSM Layers (Provincia 35)")
    print(f"PBF: {PBF_PATH}\n")

    t0 = time.time()
    ext = Extractor()
    ext.apply_file(PBF_PATH, locations=True, idx='flex_mem')
    print(f"Procesado en {time.time()-t0:.1f}s")
    print(f"  {len(ext.roads)} roads, {len(ext.parks)} parks, {len(ext.water)} water, {len(ext.coast)} coast, {len(ext.pois)} pois")

    for name, features in [('roads',ext.roads),('parks',ext.parks),
                           ('water',ext.water),('coastline',ext.coast),('pois',ext.pois)]:
        path = os.path.join(OUT_DIR, f"{name}.json")
        with open(path, 'w') as f:
            json.dump({'type':'FeatureCollection','features':features}, f)
        print(f"  {name}.json: {len(features)} feat, {os.path.getsize(path)/1024:.0f} KB")

    print(f"\nListo: {OUT_DIR}/")

if __name__ == "__main__":
    main()
