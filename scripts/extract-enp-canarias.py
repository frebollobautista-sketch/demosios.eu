#!/usr/bin/env python3
"""
ESP-01 — Espacios Naturales Protegidos + Red Natura 2000 Canarias.

Combina tres fuentes oficiales en un solo GeoJSON para el overlay
`enp.js`:

 1. Red Canaria de ENP (Decreto Legislativo 1/2000)
    Fuente: SITCAN Open Data — opendata.sitcan.es
    URL:    https://opendata.sitcan.es/dataset/espacios-naturales-protegidos-de-canarias
    Fichero: eennpp.zip — SHP en EPSG:32628, 147 features.
    Categorías nativas (Ley 12/1994): Parque Nacional, Parque Natural,
    Parque Rural, Reserva Natural Integral, Reserva Natural Especial,
    Monumento Natural, Paisaje Protegido, Sitio de Interés Científico.

 2. ZEC — Zonas Especiales de Conservación (Red Natura 2000)
    Fuente: SITCAN (host Gob. Canarias)
    URL:    https://www.gobiernodecanarias.org/medioambiente/descargas/
            Biodiversidad/Red-Natura/Planes-ZEC/Cartografia-ZEC.rar
    Fichero: ZEC.shp — SHP en EPSG:32628 (sin .prj — confirmado por bbox),
             177 features. Aprobadas por Decreto 174/2009.

 3. ZEPA terrestres — Zonas de Especial Protección para las Aves
    Fuente: SITCAN Open Data
    URL:    https://opendata.sitcan.es/upload/medio-ambiente/gobcan_medio-ambiente_zepa.zip
    Fichero: 13_1_ZEPAs_CCAA_2022.shp — SHP en EPSG:32628, 45 features.
             Declaradas por Decreto 184/2022.

Salida: public/data/enp-canarias.geojson — FeatureCollection con
properties:

  {
    nombre:     "Roque Nublo" | ...
    tipo:       parque_nacional | parque_natural | parque_rural |
                reserva_natural_integral | reserva_natural_especial |
                monumento_natural | paisaje_protegido | sitio_interes |
                red_natura_zec | red_natura_zepa
    isla:       "Gran Canaria" | "Tenerife" | "La Palma" | "La Gomera" |
                "El Hierro" | "Fuerteventura" | "Lanzarote" | null
    hectareas:  float (área calculada en UTM 28N o tomada del shapefile)
    codigo:     "C-12" | "ES7020021" | ...    (cuando aplique)
    ambito:     "Terrestre" | "Marítimo" | "Terrestre-Marino" | null
                (sólo en ZEC — ZEPA aquí son sólo terrestres por fuente)
    fuente:     "ENP" | "ZEC" | "ZEPA"
  }

Reproyección UTM 28N → WGS84 y simplificación Douglas-Peucker 25 m en
metros (en UTM, antes de reproyectar) para reducir peso. Los polígonos
de Parque Nacional / Parque Rural son grandes y se simplifican bien sin
artefactos a la escala de visor isla/municipio.

Cómo regenerar:

    mkdir -p /tmp/enp
    cd /tmp/enp
    curl -L https://opendata.sitcan.es/upload/medio-ambiente/eennpp.zip -o eennpp.zip
    unzip -o eennpp.zip
    curl -L https://opendata.sitcan.es/upload/medio-ambiente/gobcan_medio-ambiente_zepa.zip -o zepa.zip
    unzip -o zepa.zip
    curl -L "https://www.gobiernodecanarias.org/medioambiente/descargas/Biodiversidad/Red-Natura/Planes-ZEC/Cartografia-ZEC.rar" -o zec.rar
    mkdir -p zec && cd zec && bsdtar -xf ../zec.rar && cd ..
    python3 /Users/panch/KOINOS-iso/scripts/extract-enp-canarias.py
"""

import json
from pathlib import Path

import shapefile  # pyshp
from pyproj import Transformer
from shapely.geometry import shape, mapping
from shapely.ops import transform as shp_transform

ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = Path("/tmp/enp")
ENP_SHP   = SRC_DIR / "eennpp"
ZEC_SHP   = SRC_DIR / "zec" / "ZEC"
ZEPA_SHP  = SRC_DIR / "13_1_ZEPAs_CCAA_2022"

OUT = ROOT / "public" / "data" / "enp-canarias.geojson"

SIMPLIFY_TOL  = 60.0   # metros (UTM 28N) — Douglas-Peucker
# Tolerancia elegida tras profilar: con 25 m → 73K puntos (2.9 MB);
# con 60 m → ~30K puntos (~1.1 MB) sin pérdida visible a la escala
# isla/municipio. Los buffers de la Red Canaria son >100 m en su mayoría
# (parques grandes), así que 60 m es un detalle razonable.
BBOX_CANARIAS = (-18.4, 27.4, -13.3, 29.6)  # WGS84 (W, S, E, N)

# UTM 28N → WGS84
TR_TO_WGS84 = Transformer.from_crs(32628, 4326, always_xy=True)


# ---- Mapeos -----------------------------------------------------------

# Categoría textual del SHP → tipo canónico del overlay.
# Mantenemos las 8 categorías de la Red Canaria (Ley 12/1994 / TR 1/2000)
# como tipos distintos: agruparlas distorsiona la realidad legal.
ENP_TIPO = {
    "Parque Nacional":              "parque_nacional",
    "Parque Natural":               "parque_natural",
    "Parque Rural":                 "parque_rural",
    "Reserva Natural Integral":     "reserva_natural_integral",
    "Reserva Natural Especial":     "reserva_natural_especial",
    "Monumento Natural":            "monumento_natural",
    "Paisaje Protegido":            "paisaje_protegido",
    "Sitio de Interés Científico":  "sitio_interes",
}

# Prefijo del campo `codigo` (ej. "C-12") → nombre canónico de isla.
# Catálogo cerrado: la Red Canaria sólo cubre las 7 islas principales.
ENP_PREFIJO_ISLA = {
    "C": "Gran Canaria",
    "T": "Tenerife",
    "P": "La Palma",
    "G": "La Gomera",
    "H": "El Hierro",
    "F": "Fuerteventura",
    "L": "Lanzarote",
}


def _isla_from_codigo(cod: str):
    if not cod:
        return None
    p = cod[0].upper()
    return ENP_PREFIJO_ISLA.get(p)


def _to_wgs84(geom):
    return shp_transform(lambda x, y, z=None: TR_TO_WGS84.transform(x, y), geom)


def _intersects_canarias(geom):
    minx, miny, maxx, maxy = geom.bounds
    bw, bs, be, bn = BBOX_CANARIAS
    return not (maxx < bw or minx > be or maxy < bs or miny > bn)


def _shape_to_shapely(sf_shape):
    """Convierte un shape de pyshp a Shapely Polygon/MultiPolygon."""
    geo = sf_shape.__geo_interface__
    return shape(geo)


def _process(geom_utm, simplify=True):
    """Simplifica en UTM 28N, reproyecta a WGS84, valida bbox Canarias."""
    if geom_utm.is_empty:
        return None
    if simplify:
        geom_utm = geom_utm.simplify(SIMPLIFY_TOL, preserve_topology=True)
        if geom_utm.is_empty:
            return None
    geom_wgs = _to_wgs84(geom_utm)
    if not _intersects_canarias(geom_wgs):
        return None
    return geom_wgs


def _hectareas_utm(geom_utm):
    """Área en hectáreas calculada en UTM (m²/10000)."""
    try:
        return round(geom_utm.area / 10000.0, 2)
    except Exception:
        return None


# ---- Extractores -------------------------------------------------------

def extract_enp():
    feats = []
    stats = {}
    drops = 0
    r = shapefile.Reader(str(ENP_SHP), encoding="latin-1")
    fields = [f[0] for f in r.fields[1:]]
    for sr in r.iterShapeRecords():
        d = dict(zip(fields, sr.record))
        cat = d.get("categoria", "").strip()
        tipo = ENP_TIPO.get(cat)
        if tipo is None:
            drops += 1
            continue
        geom_utm = _shape_to_shapely(sr.shape)
        ha = _hectareas_utm(geom_utm)
        geom_wgs = _process(geom_utm)
        if geom_wgs is None:
            drops += 1
            continue
        codigo = (d.get("codigo") or "").strip()
        feats.append({
            "type": "Feature",
            "geometry": mapping(geom_wgs),
            "properties": {
                "nombre":    d.get("nombre", "").strip(),
                "tipo":      tipo,
                "isla":      _isla_from_codigo(codigo),
                "hectareas": ha,
                "codigo":    codigo or None,
                "ambito":    None,
                "fuente":    "ENP",
            },
        })
        stats[tipo] = stats.get(tipo, 0) + 1
    return feats, stats, drops


def extract_zec():
    feats = []
    drops = 0
    r = shapefile.Reader(str(ZEC_SHP), encoding="latin-1")
    fields = [f[0] for f in r.fields[1:]]
    for sr in r.iterShapeRecords():
        d = dict(zip(fields, sr.record))
        geom_utm = _shape_to_shapely(sr.shape)
        ha = d.get("HECTARES") or _hectareas_utm(geom_utm)
        geom_wgs = _process(geom_utm)
        if geom_wgs is None:
            drops += 1
            continue
        feats.append({
            "type": "Feature",
            "geometry": mapping(geom_wgs),
            "properties": {
                "nombre":    (d.get("NOMZEC") or "").strip(),
                "tipo":      "red_natura_zec",
                "isla":      (d.get("ISLA") or "").strip() or None,
                "hectareas": round(float(ha), 2) if ha else None,
                "codigo":    (d.get("COD_LIC") or "").strip() or None,
                "ambito":    (d.get("AMBITO") or "").strip() or None,
                "fuente":    "ZEC",
            },
        })
    return feats, {"red_natura_zec": len(feats)}, drops


def extract_zepa():
    feats = []
    drops = 0
    # ZEPA viene en EPSG:32628 con .prj y .cpg=UTF-8
    r = shapefile.Reader(str(ZEPA_SHP), encoding="utf-8")
    fields = [f[0] for f in r.fields[1:]]
    for sr in r.iterShapeRecords():
        d = dict(zip(fields, sr.record))
        # Filtro: AC == "Canarias" (algunas distros traen todas las CCAA;
        # en este shapefile ya viene filtrado pero verificamos).
        ac = (d.get("AC") or "").strip()
        if ac and ac.lower() != "canarias":
            drops += 1
            continue
        geom_utm = _shape_to_shapely(sr.shape)
        ha = d.get("HECTAREAS") or _hectareas_utm(geom_utm)
        geom_wgs = _process(geom_utm)
        if geom_wgs is None:
            drops += 1
            continue
        feats.append({
            "type": "Feature",
            "geometry": mapping(geom_wgs),
            "properties": {
                "nombre":    (d.get("SITE_NAME") or "").strip(),
                "tipo":      "red_natura_zepa",
                "isla":      (d.get("ISLA") or "").strip() or None,
                "hectareas": round(float(ha), 2) if ha else None,
                "codigo":    (d.get("SITE_CODE") or "").strip() or None,
                "ambito":    "Terrestre",  # este SHP cubre sólo ZEPA terrestres
                "fuente":    "ZEPA",
            },
        })
    return feats, {"red_natura_zepa": len(feats)}, drops


def _round_ring(ring, ndigits):
    return [[round(c[0], ndigits), round(c[1], ndigits)] for c in ring]


def _round_geometry(geom, ndigits=6):
    """Redondea las coordenadas de una geometría GeoJSON Polygon/MultiPolygon."""
    if not geom:
        return geom
    t = geom.get("type")
    if t == "Polygon":
        geom["coordinates"] = [_round_ring(r, ndigits) for r in geom["coordinates"]]
    elif t == "MultiPolygon":
        geom["coordinates"] = [
            [_round_ring(r, ndigits) for r in poly]
            for poly in geom["coordinates"]
        ]
    return geom


def _round_coords(featcol, ndigits=6):
    """Recorre features de una FeatureCollection y redondea sus geometrías."""
    for feat in featcol.get("features", []):
        _round_geometry(feat.get("geometry"), ndigits)
    return featcol


# ---- Main --------------------------------------------------------------

def main():
    all_feats = []
    all_stats = {}
    total_drops = 0

    for name, fn in (("ENP", extract_enp),
                     ("ZEC", extract_zec),
                     ("ZEPA", extract_zepa)):
        feats, stats, drops = fn()
        print(f"[{name}] {len(feats)} polígonos · {stats} · drops={drops}")
        all_feats.extend(feats)
        all_stats.update(stats)
        total_drops += drops

    out = {
        "type": "FeatureCollection",
        "metadata": {
            "fuente_enp":  "SITCAN — Espacios Naturales Protegidos de Canarias",
            "fuente_zec":  "Gob. Canarias — Cartografía ZEC (Red Natura 2000)",
            "fuente_zepa": "SITCAN — ZEPA terrestres de Canarias (Decreto 184/2022)",
            "urls": {
                "enp":  "https://opendata.sitcan.es/dataset/espacios-naturales-protegidos-de-canarias",
                "zec":  "https://opendata.sitcan.es/dataset/zec-canarias",
                "zepa": "https://opendata.sitcan.es/dataset/zonas-de-especial-proteccion-para-las-aves-zepa-terrestres-de-canarias",
            },
            "crs_origen":   "EPSG:32628 (ETRS89/WGS84 UTM 28N)",
            "crs_salida":   "EPSG:4326 (WGS84 lng/lat)",
            "simplify_tol_m": SIMPLIFY_TOL,
            "n_features":   len(all_feats),
            "stats":        all_stats,
            "nota":         (
                "Categorías ENP fieles a la Ley 12/1994 y al TR 1/2000 "
                "(8 figuras de la Red Canaria). ZEC y ZEPA terrestres "
                "se publican como capas independientes de Red Natura 2000."
            ),
        },
        "features": all_feats,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    # Reduce precisión de coordenadas a 6 decimales (≈11 cm a 28ºN) —
    # ahorra ~50% del peso final sin pérdida visible.
    _round_coords(out)
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    size_kb = OUT.stat().st_size / 1024
    print(f"[ok] {OUT} — {len(all_feats)} polígonos · {size_kb:.1f} KB")
    print(f"[stats] {all_stats}")
    print(f"[drops totales] {total_drops}")


if __name__ == "__main__":
    main()
