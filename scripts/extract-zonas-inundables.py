#!/usr/bin/env python3
"""
RIE-01 — Zonas inundables Canarias.

Origen: SITCAN / Gobierno de Canarias (PEINCA — Plan Especial de
Inundaciones), dataset "ARPSI" (Áreas de Riesgo Potencial Significativo
de Inundación). El SNCZI estatal expone WMS pero no WFS abierto, y los
SHP descargables del MITECO no cubren Canarias con el detalle T10/T100
/T500 que sí publican estatalmente otras demarcaciones — Canarias se
gestiona autonómicamente.

URL fuente (estable, CKAN):
  https://opendata.sitcan.es/dataset/peinca
  → arpsi.gpkg (675 KB) — 180 features MULTILINESTRING en EPSG:32628
    (ETRS89 / UTM 28N). Distribución oficial bajo aviso legal Gob. Canarias.

Salida:
  public/data/zonas-inundables-canarias.geojson — FeatureCollection
  Polygon/MultiPolygon en WGS84 con properties:
    {
      tipo:        "fluvial" | "costera",
      categoria:   "T100" (fluvial) | "costera",     # alias para el overlay
      demarcacion: "ES120 GRAN CANARIA" | ...,
      nombre:      "Barranco de Las Goteras" | ...,
      arpsi:       "ES120_ARPSI_0039",
      km:          1.78
    }

Las ARPSI son tramos lineales del cauce/costa identificados como riesgo
potencial significativo de inundación. Para el visor (Canvas 2D, sin
WMS), generamos bandas poligonales mediante buffer:

  - Fluvial → buffer 50 m a cada lado del eje del barranco. Aproxima
    la llanura inundable (T100). Las ARPSI fluviales están definidas
    sobre el cauce principal.
  - Costera → buffer 100 m hacia ambos lados (cinta costera). En la
    costa este criterio cubre el frente con riesgo de temporal /
    inundación marina.

Simplificación a tolerancia 30 m (Douglas-Peucker en UTM) para reducir
peso JSON sin pérdida visual sensible al tamaño del canvas.
"""

import json
import sqlite3
import struct
from pathlib import Path

from pyproj import Transformer
from shapely import wkb
from shapely.geometry import mapping
from shapely.ops import transform as shp_transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
SRC = Path("/tmp/inund/arpsi.gpkg")
OUT = ROOT / "public" / "data" / "zonas-inundables-canarias.geojson"

# Buffers en metros (UTM 28N).
BUFFER_FLUVIAL = 50.0   # 50 m a cada lado del eje del cauce
BUFFER_COSTERA = 100.0  # 100 m a cada lado de la línea costera
SIMPLIFY_TOL   = 30.0   # Douglas-Peucker en metros
BBOX_CANARIAS  = (-18.2, 27.5, -13.3, 29.5)  # lng/lat (W, S, E, N)

# Transformers ETRS89/UTM 28N <-> WGS84.
TR_TO_WGS84 = Transformer.from_crs(32628, 4326, always_xy=True)


def _decode_gpkg_geom(blob: bytes):
    """Decodifica el header binario GPKG y devuelve un objeto Shapely.

    Header layout (GeoPackage 1.x §2.1.3):
      bytes 0..1   "GP"
      byte 2       version (0)
      byte 3       flags
      bytes 4..7   srs_id (int32 LE)
      [envelope opcional]
      resto        WKB estándar
    """
    if blob is None or len(blob) < 8:
        return None
    if blob[:2] != b"GP":
        return None
    flags = blob[3]
    envelope_type = (flags & 0b00001110) >> 1
    envelope_sizes = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}
    env_bytes = envelope_sizes.get(envelope_type, 0)
    wkb_offset = 8 + env_bytes
    return wkb.loads(blob[wkb_offset:])


def _to_wgs84(geom):
    """Reproyecta una geometría Shapely de UTM 28N a WGS84 lng/lat."""
    return shp_transform(lambda x, y, z=None: TR_TO_WGS84.transform(x, y), geom)


def _intersects_canarias(geom_wgs):
    """Filtro defensivo: descarta features fuera del bbox de Canarias."""
    minx, miny, maxx, maxy = geom_wgs.bounds
    bw, bs, be, bn = BBOX_CANARIAS
    return not (maxx < bw or minx > be or maxy < bs or miny > bn)


def main():
    if not SRC.exists():
        raise SystemExit(f"No existe {SRC}. Descarga primero el GPKG.")

    conn = sqlite3.connect(SRC)
    cur = conn.cursor()
    cur.execute("""
        SELECT id, geom, demarcacion_codigo, demarcacion_nombre,
               arpsi_codigo, arpsi_nombre, longitud_km, arpsi_tipo
          FROM arpsi
    """)
    rows = cur.fetchall()
    conn.close()
    print(f"[arpsi] {len(rows)} features leídos")

    feats_out = []
    stats = {"fluvial": 0, "costera": 0, "drop": 0}

    for (rid, blob, dem_cod, dem_nom, arpsi_cod, arpsi_nom,
         km, tipo) in rows:
        geom_utm = _decode_gpkg_geom(blob)
        if geom_utm is None or geom_utm.is_empty:
            stats["drop"] += 1
            continue

        tipo_norm = (tipo or "").strip().lower()
        if tipo_norm.startswith("flu"):
            buffer_m = BUFFER_FLUVIAL
            categoria = "T100"  # alias para nuestra paleta (riesgo medio)
        elif tipo_norm.startswith("cos"):
            buffer_m = BUFFER_COSTERA
            categoria = "costera"
        else:
            # No esperamos otros tipos en este dataset.
            buffer_m = BUFFER_FLUVIAL
            categoria = "T500"

        # Buffer en UTM (metros) → simplificación → reproyección WGS84.
        poly_utm = geom_utm.buffer(
            buffer_m,
            cap_style=2,   # CAP_FLAT — cintas que no sobresalen del extremo
            join_style=2,  # JOIN_MITRE — esquinas vivas
        )
        if poly_utm.is_empty:
            stats["drop"] += 1
            continue

        poly_utm = poly_utm.simplify(SIMPLIFY_TOL, preserve_topology=True)
        poly_wgs = _to_wgs84(poly_utm)

        if not _intersects_canarias(poly_wgs):
            stats["drop"] += 1
            continue

        feats_out.append({
            "type": "Feature",
            "geometry": mapping(poly_wgs),
            "properties": {
                "tipo": "fluvial" if tipo_norm.startswith("flu") else "costera",
                "categoria": categoria,
                "demarcacion": f"{dem_cod} {dem_nom}",
                "nombre": arpsi_nom,
                "arpsi": arpsi_cod,
                "km": round(float(km), 2) if km is not None else None,
            },
        })
        stats[feats_out[-1]["properties"]["tipo"]] += 1

    out = {
        "type": "FeatureCollection",
        "metadata": {
            "fuente": "PEINCA — ARPSI Canarias (Gob. Canarias, SITCAN)",
            "url":    "https://opendata.sitcan.es/dataset/peinca",
            "tipo":   "ARPSI - Áreas de Riesgo Potencial Significativo de Inundación",
            "buffer_fluvial_m": BUFFER_FLUVIAL,
            "buffer_costera_m": BUFFER_COSTERA,
            "simplify_tol_m":   SIMPLIFY_TOL,
            "n_features":       len(feats_out),
            "stats":            stats,
        },
        "features": feats_out,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    size_kb = OUT.stat().st_size / 1024
    print(f"[ok] {OUT} — {len(feats_out)} polígonos · {size_kb:.1f} KB")
    print(f"[stats] {stats}")


if __name__ == "__main__":
    main()
