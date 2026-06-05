#!/usr/bin/env python3
"""
DBSCAN clusters de edificios por municipio.

Recorre /public/sections_pack/{cusec}/buildings.geojson, agrupa por mun (5
dígitos prov+mun = cumun), corre DBSCAN sobre centroides de edificios en
metros locales (lng/lat → proyección equirectangular sencilla con anchor
medio del mun), y escribe /public/clusters_by_mun.json con:

{
  "version": "v1-dbscan-mun-clusters-2026-05-24",
  "params": { "eps_m": 60, "min_samples": 4 },
  "clusters": {
    "<cumun>": [
      { "id": "<cumun>-c0", "centroid_lnglat": [lng,lat],
        "hull_lnglat": [[lng,lat],...], "building_count": N,
        "nearest_place_name": "...", "nearest_place_type": "hamlet",
        "nearest_place_dist_m": 45 },
      ...
    ]
  }
}

Sin sklearn ni scipy — implementación manual con grid index y BFS para
mantener el script portable a cualquier máquina con Python 3 + numpy +
shapely.

Uso:
  python3 scripts/dbscan-mun-clusters.py
"""

import json
import math
import sys
from collections import defaultdict, deque
from pathlib import Path

import numpy as np
from shapely.geometry import MultiPoint, Point

ROOT = Path("/Users/panch/KOINOS-iso/public")
SP_DIR = ROOT / "sections_pack"
OSM_PLACES = ROOT / "data" / "osm-places-canarias.json"
OUT = ROOT / "clusters_by_mun.json"

EPS_M = 180.0         # radio máximo entre vecinos dentro del mismo cluster
MIN_SAMPLES = 6       # mínimo de edificios para que un punto sea core
MIN_CLUSTER_SIZE = 20 # post-filter: clusters < este se promueven a noise
EARTH_R = 6371000.0

# OSM place types ordenados de "más identitario" a "menos" — para preferir
# hamlet/village sobre locality cuando hay empate de distancia
PLACE_TYPE_PRIORITY = {
    "town": 5, "village": 4, "suburb": 3, "neighbourhood": 3,
    "hamlet": 2, "quarter": 2, "city_block": 2, "locality": 1,
}


def lnglat_to_m(lng, lat, anchor_lng, anchor_lat):
    """Proyección equirectangular local (suficiente para distancias < 1 km)."""
    cos = math.cos(math.radians(anchor_lat))
    x = math.radians(lng - anchor_lng) * EARTH_R * cos
    y = math.radians(lat - anchor_lat) * EARTH_R
    return x, y


def m_to_lnglat(x, y, anchor_lng, anchor_lat):
    cos = math.cos(math.radians(anchor_lat))
    lng = anchor_lng + math.degrees(x / (EARTH_R * cos))
    lat = anchor_lat + math.degrees(y / EARTH_R)
    return lng, lat


def feat_centroid(feat):
    """Centroide aproximado del primer ring de un polígono GeoJSON.
    Devuelve (x, y) en las unidades de la geometría (típicamente metros
    locales para nuestros sections_pack).
    """
    g = feat.get("geometry") or {}
    coords = g.get("coordinates") or []
    if g.get("type") == "Polygon" and coords:
        ring = coords[0]
    elif g.get("type") == "MultiPolygon" and coords:
        ring = coords[0][0]
    else:
        return None
    if not ring:
        return None
    n = len(ring)
    sx = sum(p[0] for p in ring) / n
    sy = sum(p[1] for p in ring) / n
    return sx, sy


def local_m_to_lnglat(x, y, lng0, lat0):
    """Convierte metros locales ENU (relativos a lng0/lat0) a lng/lat
    geodésicos. Reverso de lnglat_to_m con anchor = (lng0, lat0)."""
    cos_lat = math.cos(math.radians(lat0))
    lng = lng0 + math.degrees(x / (EARTH_R * cos_lat))
    lat = lat0 + math.degrees(y / EARTH_R)
    return lng, lat


def read_section_crs(gj):
    """Lee el anchor lng0/lat0 del CRS local del GeoJSON. None si no es local."""
    crs = gj.get("crs") or {}
    props = crs.get("properties") or {}
    lng0 = props.get("lng0")
    lat0 = props.get("lat0")
    if lng0 is None or lat0 is None:
        return None
    return float(lng0), float(lat0)


def dbscan_grid(points_xy, eps, min_samples):
    """DBSCAN manual con grid index uniforme.

    points_xy: ndarray (N,2) en metros.
    Devuelve labels ndarray (N,) con -1 = noise, 0..K-1 = cluster id.
    """
    n = len(points_xy)
    if n == 0:
        return np.array([], dtype=int)
    cell = eps  # tamaño de celda = eps → vecinos están en celda actual ± 1
    grid = defaultdict(list)
    for i, (x, y) in enumerate(points_xy):
        grid[(int(x // cell), int(y // cell))].append(i)

    def neighbors(i):
        x, y = points_xy[i]
        cx, cy = int(x // cell), int(y // cell)
        out = []
        for ddx in (-1, 0, 1):
            for ddy in (-1, 0, 1):
                for j in grid.get((cx + ddx, cy + ddy), ()):
                    if j == i:
                        continue
                    dx = points_xy[j][0] - x
                    dy = points_xy[j][1] - y
                    if dx * dx + dy * dy <= eps * eps:
                        out.append(j)
        return out

    labels = np.full(n, -1, dtype=int)
    visited = np.zeros(n, dtype=bool)
    cluster_id = 0
    for i in range(n):
        if visited[i]:
            continue
        visited[i] = True
        nb = neighbors(i)
        if len(nb) + 1 < min_samples:
            continue  # noise por ahora; puede ser absorbido más tarde
        labels[i] = cluster_id
        queue = deque(nb)
        while queue:
            j = queue.popleft()
            if labels[j] == -1:
                labels[j] = cluster_id  # punto borde
            if not visited[j]:
                visited[j] = True
                nb_j = neighbors(j)
                if len(nb_j) + 1 >= min_samples:
                    queue.extend(nb_j)
        cluster_id += 1
    return labels


def load_osm_places():
    """Carga OSM places. Devuelve lista de dict {lng, lat, name, type}."""
    with open(OSM_PLACES) as f:
        data = json.load(f)
    out = []
    for p in data.get("places", []):
        coords = p.get("centroid_lnglat") or p.get("lnglat") or p.get("center")
        if not coords:
            # algunos vienen como [lng, lat] sueltos en otras keys
            if "lng" in p and "lat" in p:
                coords = [p["lng"], p["lat"]]
            else:
                continue
        out.append({
            "lng": coords[0], "lat": coords[1],
            "name": p.get("name") or "",
            "type": p.get("place") or p.get("type") or "",
        })
    return out


def haversine_m(lng1, lat1, lng2, lat2):
    """Distancia haversine entre dos puntos lng/lat en metros."""
    rlat1, rlat2 = math.radians(lat1), math.radians(lat2)
    dlat = rlat2 - rlat1
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(rlat1) * math.cos(rlat2) * math.sin(dlng / 2) ** 2
    return 2 * EARTH_R * math.asin(math.sqrt(a))


def nearest_place(centroid_lnglat, places):
    """Encuentra el OSM place más cercano al centroide. Prioriza tipos
    identitarios (hamlet/village) frente a locality si están a < 1.5x la
    distancia mínima."""
    if not places:
        return None
    clng, clat = centroid_lnglat
    # primer paso: top-5 por distancia
    scored = []
    for p in places:
        d = haversine_m(clng, clat, p["lng"], p["lat"])
        scored.append((d, p))
    scored.sort(key=lambda x: x[0])
    if not scored:
        return None
    top = scored[:5]
    dmin = top[0][0]
    # Promueve hamlet/village si está cerca del mínimo y tiene más prioridad
    best = top[0]
    for d, p in top:
        if d > dmin * 1.5:
            continue
        if PLACE_TYPE_PRIORITY.get(p["type"], 0) > PLACE_TYPE_PRIORITY.get(best[1]["type"], 0):
            best = (d, p)
    return {
        "name": best[1]["name"],
        "type": best[1]["type"],
        "dist_m": round(best[0], 1),
    }


def hull_lnglat(points_xy, anchor):
    """Convex hull de un cluster en lng/lat. Devuelve lista [[lng,lat],...]."""
    if len(points_xy) < 3:
        # Para 1-2 puntos, devolvemos buffer redondo de 30m
        mp = MultiPoint([Point(x, y) for x, y in points_xy])
        if mp.is_empty:
            return []
        hull = mp.buffer(30.0).exterior
        if hull is None:
            return []
        coords = list(hull.coords)
    else:
        mp = MultiPoint([Point(x, y) for x, y in points_xy])
        hull = mp.convex_hull
        if hull.geom_type == "Polygon":
            coords = list(hull.exterior.coords)
        elif hull.geom_type == "LineString":
            # buffer ligero para línea
            coords = list(hull.buffer(20.0).exterior.coords)
        else:
            return []
    anchor_lng, anchor_lat = anchor
    return [list(m_to_lnglat(x, y, anchor_lng, anchor_lat)) for x, y in coords]


def main():
    # 1) Carga OSM places
    places = load_osm_places()
    print(f"OSM places loaded: {len(places)}", file=sys.stderr)

    # 2) Lista todos los cusec dirs y agrúpalos por cumun (prov+mun, 5 dig)
    cusec_by_cumun = defaultdict(list)
    for d in sorted(SP_DIR.iterdir()):
        if d.is_dir() and len(d.name) == 10 and d.name.isdigit():
            cusec_by_cumun[d.name[:5]].append(d.name)

    print(f"muns to process: {len(cusec_by_cumun)}", file=sys.stderr)

    out = {
        "version": "v1-dbscan-mun-clusters-2026-05-24",
        "params": {"eps_m": EPS_M, "min_samples": MIN_SAMPLES},
        "clusters": {},
    }

    total_clusters = 0
    total_buildings_clustered = 0
    total_noise = 0

    for cumun in sorted(cusec_by_cumun):
        # Aggregate todos los building centroids del mun → lng/lat geodésico.
        # Cada sección tiene su propio anchor local meters (CRS lng0/lat0),
        # así que reconvertimos a lng/lat antes de mezclar.
        centroids_lnglat = []
        for cusec in cusec_by_cumun[cumun]:
            path = SP_DIR / cusec / "buildings.geojson"
            if not path.exists():
                continue
            try:
                with open(path) as f:
                    gj = json.load(f)
            except Exception as e:
                print(f"  skip {cusec}: {e}", file=sys.stderr)
                continue
            sec_anchor = read_section_crs(gj)
            for feat in gj.get("features", []):
                c = feat_centroid(feat)
                if not c:
                    continue
                if sec_anchor:
                    # coords están en metros locales relativos a sec_anchor;
                    # las reconvertimos a lng/lat absolutos.
                    lng, lat = local_m_to_lnglat(c[0], c[1], sec_anchor[0], sec_anchor[1])
                    centroids_lnglat.append((lng, lat))
                else:
                    # Fallback: ya está en lng/lat (raro, pero por si acaso).
                    centroids_lnglat.append(c)

        if not centroids_lnglat:
            out["clusters"][cumun] = []
            continue

        # Anchor = centroide medio del mun
        lng_arr = np.array([p[0] for p in centroids_lnglat])
        lat_arr = np.array([p[1] for p in centroids_lnglat])
        anchor_lng = float(lng_arr.mean())
        anchor_lat = float(lat_arr.mean())

        # Proyecta a metros locales
        points_xy = np.array([
            lnglat_to_m(lng, lat, anchor_lng, anchor_lat)
            for lng, lat in centroids_lnglat
        ])

        # DBSCAN
        labels = dbscan_grid(points_xy, EPS_M, MIN_SAMPLES)

        # Post-filter: clusters con < MIN_CLUSTER_SIZE buildings se vuelven
        # noise (eran caseríos minúsculos que ensucian la navegación).
        # Renumera para que los ids supervivientes sean 0..K-1.
        if len(labels) and labels.max() >= 0:
            unique, counts = np.unique(labels[labels >= 0], return_counts=True)
            drop = set(unique[counts < MIN_CLUSTER_SIZE].tolist())
            keep = sorted(unique[counts >= MIN_CLUSTER_SIZE].tolist())
            remap = {old: new for new, old in enumerate(keep)}
            new_labels = np.full_like(labels, -1)
            for i, lab in enumerate(labels):
                if lab in remap:
                    new_labels[i] = remap[lab]
            labels = new_labels

        n_clusters = int(labels.max() + 1) if len(labels) and labels.max() >= 0 else 0
        n_noise = int((labels == -1).sum())
        total_noise += n_noise

        clusters_out = []
        for cid in range(n_clusters):
            mask = labels == cid
            pts_m = points_xy[mask]
            pts_lnglat = [centroids_lnglat[i] for i, m in enumerate(mask) if m]
            cx = float(pts_m[:, 0].mean())
            cy = float(pts_m[:, 1].mean())
            centroid_lnglat = list(m_to_lnglat(cx, cy, anchor_lng, anchor_lat))
            hull = hull_lnglat(pts_m, (anchor_lng, anchor_lat))
            np_ = nearest_place(centroid_lnglat, places)
            clusters_out.append({
                "id": f"{cumun}-c{cid}",
                "centroid_lnglat": [round(centroid_lnglat[0], 6), round(centroid_lnglat[1], 6)],
                "hull_lnglat": [[round(p[0], 6), round(p[1], 6)] for p in hull],
                "building_count": int(mask.sum()),
                "nearest_place_name": (np_ or {}).get("name") or None,
                "nearest_place_type": (np_ or {}).get("type") or None,
                "nearest_place_dist_m": (np_ or {}).get("dist_m"),
            })
            total_buildings_clustered += int(mask.sum())

        total_clusters += n_clusters
        out["clusters"][cumun] = clusters_out
        print(
            f"  {cumun}: {len(centroids_lnglat):>6} bld → {n_clusters:>3} clusters, {n_noise:>5} noise",
            file=sys.stderr,
        )

    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"\nwrote {OUT}", file=sys.stderr)
    print(f"  total clusters: {total_clusters}", file=sys.stderr)
    print(f"  total buildings clustered: {total_buildings_clustered}", file=sys.stderr)
    print(f"  total noise (huérfanos): {total_noise}", file=sys.stderr)


if __name__ == "__main__":
    main()
