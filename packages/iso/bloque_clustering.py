"""KOINOS · POLIS — Clustering de edificios en BLOQUES por adyacencia.

Nivel intermedio entre EDIFICIO INDIVIDUAL y MANZANA ENTERA.

Un BLOQUE es un grupo de 4-12 edificios contiguos cuyos polígonos están
prácticamente pegados (distancia <= 1.5 m). El objetivo es reducir el
ruido visual y la carga computacional manteniendo la lectura de "frente
de manzana" reconocible (los bloques siguen estando segmentados por las
calles internas o patios anchos de la manzana).

Algoritmo:
  1. Cargar buildings (Polygon shapely) de una manzana.
  2. Construir grafo no dirigido: dos buildings están conectados si la
     distancia mínima entre sus polígonos es <= distance_threshold (m).
  3. Encontrar componentes conexos por BFS.
  4. Cada componente es un BLOQUE. Para cada bloque:
       · Polígono unificado: unary_union(buildings).buffer(0.5).buffer(-0.5)
         (el "open" morfológico cierra microhuecos < 1 m).
       · Si el resultado es MultiPolygon, nos quedamos con el polígono de
         mayor área (el resto suele ser ruido residual).
       · Simplify(0.8) para suavizar entrantes.
       · Altura mediana, categoría dominante, lista de building_ids.

También expone simplify_manzana(feature, tolerance=5.0): polígono de
manzana muy simplificado para vistas a escala sección (panel 4).
"""
from __future__ import annotations

from collections import Counter, deque
from typing import Dict, List, Tuple

from shapely.geometry import MultiPolygon, Polygon, shape
from shapely.ops import unary_union


def _statistics_median(values):
    s = sorted(values)
    n = len(s)
    if n == 0:
        return 0.0
    if n % 2 == 1:
        return float(s[n // 2])
    return float((s[n // 2 - 1] + s[n // 2]) / 2.0)


def _largest_polygon(geom):
    """Devuelve el Polygon de mayor área de un Polygon o MultiPolygon."""
    if geom is None or geom.is_empty:
        return None
    if isinstance(geom, Polygon):
        return geom
    if isinstance(geom, MultiPolygon):
        return max(geom.geoms, key=lambda g: g.area)
    try:
        polys = [g for g in geom.geoms if isinstance(g, Polygon)]
        if polys:
            return max(polys, key=lambda g: g.area)
    except Exception:
        pass
    return None


def compute_bloques(building_features: List[Dict],
                    distance_threshold: float = 1.5) -> List[Dict]:
    """Agrupa edificios contiguos en bloques.

    Args:
        building_features: lista de Features GeoJSON con geometry Polygon
            y properties con id, height_m, category.
        distance_threshold: distancia (metros) para considerar dos
            edificios contiguos.

    Returns:
        Lista de dicts con: polygon (shapely Polygon ya simplificado),
        height (mediana), category (dominante), building_ids (list),
        n (nº de edificios), centroid (x,z), area (m^2).
    """
    items = []
    for f in building_features:
        geom = shape(f["geometry"])
        if not isinstance(geom, Polygon):
            geom = _largest_polygon(geom)
        if geom is None or geom.is_empty or not geom.is_valid:
            geom = geom.buffer(0) if geom is not None else None
            if geom is None or geom.is_empty:
                continue
        props = f.get("properties", {})
        items.append({
            "id": props.get("id"),
            "polygon": geom,
            "h": float(props.get("height_m") or 6.0),
            "category": props.get("category", "residencial"),
            "props": props,
        })

    n = len(items)
    if n == 0:
        return []

    adj: Dict[int, List[int]] = {i: [] for i in range(n)}
    for i in range(n):
        gi = items[i]["polygon"]
        for j in range(i + 1, n):
            gj = items[j]["polygon"]
            if gi.distance(gj) <= distance_threshold:
                adj[i].append(j)
                adj[j].append(i)

    visited = [False] * n
    components: List[List[int]] = []
    for s in range(n):
        if visited[s]:
            continue
        queue = deque([s])
        visited[s] = True
        comp = []
        while queue:
            u = queue.popleft()
            comp.append(u)
            for v in adj[u]:
                if not visited[v]:
                    visited[v] = True
                    queue.append(v)
        components.append(comp)

    bloques = []
    for comp in components:
        polys = [items[i]["polygon"] for i in comp]
        try:
            merged = unary_union(polys)
            merged = merged.buffer(0.5).buffer(-0.5)
        except Exception:
            merged = polys[0]

        merged = _largest_polygon(merged)
        if merged is None or merged.is_empty:
            continue

        try:
            merged = merged.simplify(0.8, preserve_topology=True)
        except Exception:
            pass

        if merged.is_empty:
            continue

        heights = [items[i]["h"] for i in comp]
        cats = [items[i]["category"] for i in comp]
        cat_counter = Counter(cats)
        cat_dominante = cat_counter.most_common(1)[0][0] if cat_counter else "residencial"
        ids = [items[i]["id"] for i in comp]

        c = merged.centroid
        bloques.append({
            "polygon": merged,
            "height": _statistics_median(heights),
            "category": cat_dominante,
            "building_ids": ids,
            "n": len(comp),
            "centroid": (c.x, c.y),
            "area": float(merged.area),
        })

    bloques.sort(key=lambda b: -b["n"])
    return bloques


def simplify_manzana(manzana_feature: Dict,
                     tolerance: float = 5.0) -> Polygon:
    """Polígono de manzana simplificado para vistas de sección.

    tolerance en metros. 5 m suele eliminar entrantes pequeños y dejar el
    contorno como un blob legible al 1:5000.
    """
    geom = shape(manzana_feature["geometry"])
    if not geom.is_valid:
        geom = geom.buffer(0)
    geom = _largest_polygon(geom)
    if geom is None:
        return None
    try:
        return geom.simplify(tolerance, preserve_topology=True)
    except Exception:
        return geom


def unify_manzana(building_features: List[Dict],
                  buffer_m: float = 0.5,
                  simplify_tol: float = 1.5) -> Polygon:
    """Une todos los buildings de una manzana en un único polígono limpio."""
    polys = []
    for f in building_features:
        g = shape(f["geometry"])
        if not g.is_valid:
            g = g.buffer(0)
        g = _largest_polygon(g)
        if g and not g.is_empty:
            polys.append(g)
    if not polys:
        return None
    merged = unary_union(polys).buffer(buffer_m).buffer(-buffer_m)
    merged = _largest_polygon(merged)
    if merged is None or merged.is_empty:
        return None
    try:
        merged = merged.simplify(simplify_tol, preserve_topology=True)
    except Exception:
        pass
    return merged


def count_vertices(polygon: Polygon) -> int:
    """Devuelve el nº de vértices del exterior + interiores."""
    if polygon is None or polygon.is_empty:
        return 0
    if isinstance(polygon, MultiPolygon):
        return sum(count_vertices(g) for g in polygon.geoms)
    n = len(polygon.exterior.coords)
    for r in polygon.interiors:
        n += len(r.coords)
    return n
