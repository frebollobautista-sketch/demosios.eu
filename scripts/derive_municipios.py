#!/usr/bin/env python3
"""KOINOS · POLIS — Deriva polígonos de municipio a partir de las
secciones censales agrupándolas con shapely.unary_union.

Lee:
  public/gc-secciones-lite.json    (709 features, provincia 35)
  public/gc-municipios-lite.json   (centroides; usado para el nombre)

Escribe:
  public/gc-municipios-poly.json   (FeatureCollection con 21 muns de GC)

Properties por municipio:
  mun           código de 3 dígitos (sin el "35" provincial)
  nmun          nombre legible
  area_ha       área del polígono en hectáreas (proyección equirect)
  perimeter_km  perímetro
  sections_count
  centroid      [lng, lat] del centroide del polígono unido

Geometría:
  Polygon o MultiPolygon en WGS84 simplificado a 0.0003° (~30 m).

Uso:
  python3 scripts/derive_municipios.py
"""
from __future__ import annotations
import json
import math
import pathlib
import sys

from shapely.geometry import shape, mapping
from shapely.ops import unary_union

ROOT = pathlib.Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
SECCIONES = PUBLIC / "gc-secciones-lite.json"
MUNICIPIOS_LITE = PUBLIC / "gc-municipios-lite.json"
OUT = PUBLIC / "gc-municipios-poly.json"

# 21 muns de Gran Canaria (provincia 35).
GC_MUNS = {
    "001", "002", "005", "006", "008", "009", "011", "012", "013", "016",
    "019", "020", "021", "022", "023", "025", "026", "027", "031", "032",
    "033",
}


def deg_to_meters(lat_deg: float):
    """Aprox local: ¿cuántos metros mide 1° de lat y 1° de lng a esa lat?"""
    m_per_deg_lat = 111_132.0
    m_per_deg_lng = 111_320.0 * math.cos(math.radians(lat_deg))
    return m_per_deg_lat, m_per_deg_lng


def measure_area_ha(geom) -> float:
    """Área aproximada en hectáreas usando proyección local equirect."""
    c = geom.centroid
    m_lat, m_lng = deg_to_meters(c.y)
    # transforma cada coord (lon,lat) → (x_m, y_m) y reconstituye geom
    from shapely.geometry import Polygon, MultiPolygon

    def _proj_ring(ring):
        return [((x - c.x) * m_lng, (y - c.y) * m_lat) for x, y in ring]

    if geom.geom_type == "Polygon":
        outer = _proj_ring(list(geom.exterior.coords))
        holes = [_proj_ring(list(h.coords)) for h in geom.interiors]
        p = Polygon(outer, holes)
        return abs(p.area) / 10_000.0
    if geom.geom_type == "MultiPolygon":
        a = 0.0
        for poly in geom.geoms:
            outer = _proj_ring(list(poly.exterior.coords))
            holes = [_proj_ring(list(h.coords)) for h in poly.interiors]
            a += abs(Polygon(outer, holes).area)
        return a / 10_000.0
    return 0.0


def measure_perimeter_km(geom) -> float:
    """Perímetro aproximado en km (mismo método)."""
    c = geom.centroid
    m_lat, m_lng = deg_to_meters(c.y)

    def _len_ring(ring):
        s = 0.0
        for i in range(1, len(ring)):
            dx = (ring[i][0] - ring[i-1][0]) * m_lng
            dy = (ring[i][1] - ring[i-1][1]) * m_lat
            s += math.hypot(dx, dy)
        return s

    if geom.geom_type == "Polygon":
        rings = [list(geom.exterior.coords)] + [list(h.coords) for h in geom.interiors]
        return sum(_len_ring(r) for r in rings) / 1000.0
    if geom.geom_type == "MultiPolygon":
        s = 0.0
        for poly in geom.geoms:
            s += _len_ring(list(poly.exterior.coords))
            for h in poly.interiors:
                s += _len_ring(list(h.coords))
        return s / 1000.0
    return 0.0


def main():
    print(f"  · cargando {SECCIONES.name}…")
    secciones = json.load(open(SECCIONES, encoding="utf-8"))
    muns_meta = {f["properties"]["mun"]: f["properties"]
                 for f in json.load(open(MUNICIPIOS_LITE, encoding="utf-8"))["features"]}

    # Agrupa secciones por mun
    grouped = {}
    for f in secciones["features"]:
        m = f["properties"]["mun"]
        if m not in GC_MUNS:
            continue
        try:
            g = shape(f["geometry"])
            if g.is_empty:
                continue
            if not g.is_valid:
                g = g.buffer(0)
            grouped.setdefault(m, []).append(g)
        except Exception as e:
            print(f"  ! sección {f['properties'].get('cusec')} skip: {e}")

    print(f"  · muns recolectados: {len(grouped)}")

    features = []
    for mun in sorted(grouped):
        geoms = grouped[mun]
        try:
            merged = unary_union(geoms)
        except Exception as e:
            print(f"  ! mun {mun} unary_union falló: {e}")
            continue
        if not merged.is_valid:
            merged = merged.buffer(0)
        # Simplifica preservando topología (~30m)
        simplified = merged.simplify(0.0003, preserve_topology=True)
        if simplified.is_empty:
            simplified = merged

        nmun = muns_meta.get(mun, {}).get("nmun", f"Mun {mun}")
        sections_count = len(geoms)
        area_ha = measure_area_ha(simplified)
        perimeter_km = measure_perimeter_km(simplified)
        c = simplified.centroid
        feat = {
            "type": "Feature",
            "properties": {
                "mun": mun,
                "nmun": nmun,
                "sections_count": sections_count,
                "area_ha": round(area_ha, 2),
                "perimeter_km": round(perimeter_km, 3),
                "centroid": [round(c.x, 6), round(c.y, 6)],
            },
            "geometry": mapping(simplified),
        }
        features.append(feat)
        print(f"  · {mun} {nmun:34s}  secs={sections_count:3d}  "
              f"area={area_ha:8.1f}ha  perim={perimeter_km:6.1f}km")

    fc = {"type": "FeatureCollection", "features": features}
    OUT.write_text(json.dumps(fc, ensure_ascii=False), encoding="utf-8")
    size_kb = OUT.stat().st_size / 1024
    print(f"\n  → {OUT}  ({size_kb:.1f} KB · {len(features)} muns)")


if __name__ == "__main__":
    main()
