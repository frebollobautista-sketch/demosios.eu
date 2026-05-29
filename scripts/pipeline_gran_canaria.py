#!/usr/bin/env python3
"""
PIPELINE COMPLETO: Catastro + Secciones Censales → Supabase
============================================================
Descarga, parsea y sube edificios de TODA Gran Canaria.

Ejecutar desde la raíz del proyecto KOINOS:
  python3 scripts/pipeline_gran_canaria.py

Requisitos:
  pip3 install pyproj shapely requests supabase

Pasos:
  1. Descarga ZIPs del Catastro INSPIRE para cada municipio
  2. Extrae y parsea GML (EPSG:32628 → WGS84)
  3. Descarga secciones censales del INE GeoServer
  4. Asigna edificios a secciones (point-in-polygon)
  5. Sube todo a Supabase (PostGIS)
"""

import json
import os
import re
import sys
import time
import zipfile
from pathlib import Path

import requests
from pyproj import Transformer
from shapely.geometry import shape, Point, mapping
from shapely.strtree import STRtree

# ===================== CONFIG =====================

KOINOS_DIR = Path(__file__).parent.parent
DATA_DIR = KOINOS_DIR / "catastro_data"
SECCIONES_DIR = KOINOS_DIR / "secciones_data"

# Supabase config — rellenar antes de ejecutar
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://zkezbitcvpjyxyyjilyx.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")  # Service role key!

# UTM 28N → WGS84
transformer = Transformer.from_crs("EPSG:32628", "EPSG:4326", always_xy=True)

# Municipios de Gran Canaria (codigo_catastro → nombre)
with open(KOINOS_DIR / "catastro_download_links.json") as f:
    MUNICIPIOS = json.load(f)

# ===================== PASO 1: DESCARGAR CATASTRO =====================

def descargar_catastro():
    """Descarga ZIPs de edificios del Catastro INSPIRE."""
    DATA_DIR.mkdir(exist_ok=True)

    for cod, info in MUNICIPIOS.items():
        zip_path = DATA_DIR / f"A.ES.SDGC.BU.{cod}.zip"
        if zip_path.exists():
            print(f"  ✓ {cod} {info['nombre']} — ya descargado")
            continue

        # Build URL with proper encoding (Catastro uses spaces in paths)
        url = info["url"]
        # URL-encode spaces but keep the rest intact
        url_encoded = url.replace(" ", "%20")

        print(f"  ↓ {cod} {info['nombre']}...")
        try:
            r = requests.get(url_encoded, timeout=300, stream=True, allow_redirects=True)
            r.raise_for_status()

            # Check content type — Catastro returns HTML error pages sometimes
            ct = r.headers.get("Content-Type", "")
            if "html" in ct.lower() or "text" in ct.lower():
                print(f"    ✗ Servidor devolvió HTML (error). Intentando URL alternativa...")
                # Try ATOM feed URL format
                alt_url = f"https://www.catastro.hacienda.gob.es/INSPIRE/Buildings/35/{cod}-{info['nombre'].replace(' ', '%20')}/A.ES.SDGC.BU.{cod}.zip"
                r = requests.get(alt_url, timeout=300, stream=True, allow_redirects=True)
                r.raise_for_status()
                ct = r.headers.get("Content-Type", "")
                if "html" in ct.lower() or "text" in ct.lower():
                    print(f"    ✗ URL alternativa también devolvió HTML. Omitiendo.")
                    continue

            with open(zip_path, "wb") as f:
                for chunk in r.iter_content(8192):
                    f.write(chunk)

            size_mb = zip_path.stat().st_size / 1024 / 1024

            # Verify it's actually a ZIP (magic bytes PK)
            with open(zip_path, "rb") as f:
                magic = f.read(2)
            if magic != b"PK":
                print(f"    ✗ No es un ZIP válido ({size_mb:.1f} MB). Eliminando.")
                zip_path.unlink()
                continue

            print(f"    {size_mb:.1f} MB ✓")
        except Exception as e:
            print(f"    ERROR: {e}")
            if zip_path.exists():
                zip_path.unlink()


# ===================== PASO 2: PARSEAR GML =====================

# Regex patterns para streaming parse
MEMBER_RE = re.compile(r'<gml:featureMember>(.*?)</gml:featureMember>', re.DOTALL)
ID_RE = re.compile(r'<base:localId>([^<]+)</base:localId>')
USE_RE = re.compile(r'<bu-ext2d:currentUse>([^<]+)</bu-ext2d:currentUse>')
FLOORS_RE = re.compile(r'<bu-ext2d:numberOfFloorsAboveGround[^>]*>(\d+)</bu-ext2d:numberOfFloorsAboveGround>')
AREA_RE = re.compile(r'<bu-ext2d:value uom="m2">([^<]+)</bu-ext2d:value>')
YEAR_RE = re.compile(r'<bu-core2d:beginning>(\d{4})')
POSLIST_RE = re.compile(r'<gml:posList[^>]*>([\s\S]*?)</gml:posList>')


def parse_poslist(text):
    """gml:posList (UTM 28N) → list of [lon, lat] WGS84."""
    nums = text.split()
    coords = []
    for i in range(0, len(nums) - 1, 2):
        x, y = float(nums[i]), float(nums[i + 1])
        lon, lat = transformer.transform(x, y)
        coords.append([round(lon, 6), round(lat, 6)])
    if coords and coords[0] != coords[-1]:
        coords.append(coords[0])
    return coords


USE_MAP = {
    "1_residential": "residential",
    "2_agriculture": "warehouse",
    "3_industrial": "industrial",
    "4_1_office": "office",
    "4_2_retail": "commercial",
    "4_3_publicServices": "public",
}


def parsear_gml(cod):
    """Parsea el GML de un municipio → GeoJSON FeatureCollection."""
    zip_path = DATA_DIR / f"A.ES.SDGC.BU.{cod}.zip"
    if not zip_path.exists():
        print(f"  ✗ {cod} — ZIP no encontrado")
        return None

    geojson_path = DATA_DIR / f"buildings_{cod}.geojson"
    if geojson_path.exists():
        print(f"  ✓ {cod} — GeoJSON ya existe")
        with open(geojson_path) as f:
            return json.load(f)

    # Extraer ZIP
    extract_dir = DATA_DIR / f"A.ES.SDGC.BU.{cod}"
    if not extract_dir.exists():
        with zipfile.ZipFile(zip_path) as zf:
            zf.extractall(extract_dir)

    # Buscar archivo .building.gml
    gml_files = list(extract_dir.rglob("*.building.gml"))
    if not gml_files:
        gml_files = list(extract_dir.rglob("*.gml"))
    if not gml_files:
        print(f"  ✗ {cod} — No se encontró GML")
        return None

    gml_path = gml_files[0]
    print(f"  → Parseando {gml_path.name} ({gml_path.stat().st_size / 1024 / 1024:.0f} MB)...")

    # Intentar varios encodings
    for enc in ["utf-8", "iso-8859-1", "latin-1"]:
        try:
            with open(gml_path, "r", encoding=enc) as f:
                gml = f.read()
            break
        except UnicodeDecodeError:
            continue

    features = []
    for m in MEMBER_RE.finditer(gml):
        block = m.group(1)

        id_m = ID_RE.search(block)
        if not id_m:
            continue
        cat_id = id_m.group(1)

        poslists = POSLIST_RE.findall(block)
        if not poslists:
            continue

        rings = []
        for pl in poslists:
            coords = parse_poslist(pl)
            if len(coords) >= 4:
                rings.append(coords)
        if not rings:
            continue

        props = {"catastro_id": cat_id, "municipio_cod": cod}

        use_m = USE_RE.search(block)
        if use_m:
            raw_use = use_m.group(1)
            props["use"] = raw_use
            for prefix, btype in USE_MAP.items():
                if prefix in raw_use:
                    props["building"] = btype
                    break
            else:
                props["building"] = "yes"
        else:
            props["building"] = "yes"

        floors_m = FLOORS_RE.search(block)
        if floors_m:
            props["floors"] = int(floors_m.group(1))

        area_m = AREA_RE.search(block)
        if area_m:
            props["area_m2"] = float(area_m.group(1))

        year_m = YEAR_RE.search(block)
        if year_m:
            props["year"] = int(year_m.group(1))

        if len(rings) == 1:
            geom = {"type": "Polygon", "coordinates": rings}
        else:
            geom = {"type": "MultiPolygon", "coordinates": [[r] for r in rings]}

        features.append({"type": "Feature", "properties": props, "geometry": geom})

    print(f"    {len(features)} edificios")

    fc = {"type": "FeatureCollection", "features": features}
    with open(geojson_path, "w") as f:
        json.dump(fc, f, separators=(",", ":"))

    return fc


# ===================== PASO 3: SECCIONES CENSALES (INE) =====================

INE_GEOSERVER = "https://www.ine.es/geoserver/ogc/features/v1/collections"
# Collection ID para secciones censales 2024
SECCIONES_COLLECTION = "Secciones"


def descargar_secciones_ine():
    """Descarga secciones censales de Gran Canaria desde INE GeoServer."""
    SECCIONES_DIR.mkdir(exist_ok=True)
    out_path = SECCIONES_DIR / "secciones_gran_canaria.geojson"

    if out_path.exists():
        print("  ✓ Secciones ya descargadas")
        with open(out_path) as f:
            return json.load(f)

    print("  ↓ Descargando secciones censales de GC desde INE...")

    # INE GeoServer OGC API Features - filtrar por provincia 35
    # Paginación: limit=1000, offset para siguientes
    all_features = []
    offset = 0
    limit = 1000

    while True:
        url = (
            f"{INE_GEOSERVER}/{SECCIONES_COLLECTION}/items"
            f"?f=json&limit={limit}&offset={offset}"
            f"&CPRO=35"  # Provincia Las Palmas
        )
        print(f"    Fetching offset={offset}...")
        r = requests.get(url, timeout=60)
        r.raise_for_status()
        data = r.json()

        feats = data.get("features", [])
        if not feats:
            break

        # Filtrar solo Gran Canaria (municipios 35001-35024)
        for f in feats:
            cusec = f["properties"].get("CUSEC", "")
            cmun = f["properties"].get("CMUN", "")
            # Gran Canaria municipalities: 001-024 (excepto 005, 016, 017 que no existen)
            if cusec.startswith("35"):
                all_features.append(f)

        offset += limit
        if len(feats) < limit:
            break

    print(f"    {len(all_features)} secciones de Gran Canaria")

    fc = {"type": "FeatureCollection", "features": all_features}
    with open(out_path, "w") as f:
        json.dump(fc, f, separators=(",", ":"))

    return fc


def descargar_secciones_alternativo():
    """Alternativa: usar datos.canarias.es si INE GeoServer falla."""
    SECCIONES_DIR.mkdir(exist_ok=True)
    out_path = SECCIONES_DIR / "secciones_gran_canaria.geojson"

    if out_path.exists():
        with open(out_path) as f:
            return json.load(f)

    # Intentar primero INE
    try:
        return descargar_secciones_ine()
    except Exception as e:
        print(f"  INE falló: {e}")

    # Alternativa: datos.canarias.es
    print("  ↓ Intentando datos.canarias.es...")
    url = "https://datos.canarias.es/catalogos/estadisticas/dataset/secciones-de-canarias-a-01-01-2023"
    # Este endpoint devuelve la página del dataset, no el GeoJSON directamente.
    # El usuario tendrá que descargar manualmente el shapefile/GeoJSON.
    print("  ✗ Descarga manual necesaria:")
    print(f"    {url}")
    print("    Descarga el GeoJSON y guárdalo como:")
    print(f"    {out_path}")
    return None


# ===================== PASO 4: ASIGNAR EDIFICIOS A SECCIONES =====================

def asignar_secciones(buildings_fc, secciones_fc, municipio_cod):
    """Point-in-polygon: asigna cusec a cada edificio."""
    # Construir índice espacial de secciones
    sec_geoms = []
    sec_cusecs = []
    sec_props = []

    mun_prefix = f"35{municipio_cod[-3:]}" if len(municipio_cod) == 5 else municipio_cod

    for feat in secciones_fc["features"]:
        cusec = feat["properties"].get("CUSEC", "")
        # Filtrar secciones del municipio actual
        cmun = feat["properties"].get("CMUN", "")
        cpro = feat["properties"].get("CPRO", "35")
        full_mun = f"{cpro}{cmun}"

        # El código catastro puede no coincidir exactamente con INE
        # Catastro 35017 = INE 35016 (Las Palmas caso especial)
        if not cusec.startswith(full_mun):
            continue

        g = shape(feat["geometry"])
        if g.is_valid and not g.is_empty:
            sec_geoms.append(g)
            sec_cusecs.append(cusec)
            sec_props.append(feat["properties"])

    if not sec_geoms:
        print(f"    No hay secciones para municipio {municipio_cod}")
        return buildings_fc, {}

    tree = STRtree(sec_geoms)
    print(f"    {len(sec_geoms)} secciones indexadas")

    bsm = {}  # building → seccion map
    assigned = 0

    for feat in buildings_fc["features"]:
        geom = shape(feat["geometry"])
        if not geom.is_valid:
            geom = geom.buffer(0)
        if geom.is_empty:
            continue

        centroid = geom.centroid
        candidates = tree.query(centroid)
        cusec = None

        for idx in candidates:
            if sec_geoms[idx].contains(centroid):
                cusec = sec_cusecs[idx]
                break

        if not cusec:
            for idx in candidates:
                if centroid.distance(sec_geoms[idx]) < 0.0005:
                    cusec = sec_cusecs[idx]
                    break

        if cusec:
            feat["properties"]["cusec"] = cusec
            bid = feat["properties"].get("catastro_id", str(id(feat)))
            bsm[bid] = cusec
            assigned += 1

    print(f"    {assigned}/{len(buildings_fc['features'])} asignados")
    return buildings_fc, bsm


# ===================== PASO 5: SUBIR A SUPABASE =====================

def subir_a_supabase(buildings_fc, municipio_cod, municipio_nombre):
    """Inserta edificios en Supabase via REST API."""
    if not SUPABASE_KEY:
        print("  ✗ SUPABASE_SERVICE_KEY no configurada. Saltando upload.")
        return

    from supabase import create_client
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    features = buildings_fc["features"]
    BATCH = 100
    total = 0

    for i in range(0, len(features), BATCH):
        batch = features[i : i + BATCH]
        rows = []
        for feat in batch:
            p = feat["properties"]
            geom_json = json.dumps(feat["geometry"])
            rows.append({
                "source_id": p.get("catastro_id", ""),
                "source": "catastro",
                "building_type": p.get("building", "yes"),
                "plantas": p.get("floors"),
                "year_built": p.get("year"),
                "area_m2": p.get("area_m2"),
                "municipio_id": None,  # Se resuelve después con SQL
                "geom": f"SRID=4326;{geom_json}",  # PostGIS acepta GeoJSON via text
            })

        # Usar SQL directo para ST_GeomFromGeoJSON
        vals = []
        for feat in batch:
            p = feat["properties"]
            geom = json.dumps(feat["geometry"], separators=(",", ":"))
            bid = (p.get("catastro_id") or "").replace("'", "''")
            btype = (p.get("building") or "yes").replace("'", "''")
            plantas = p.get("floors")
            year = p.get("year")
            area = p.get("area_m2")

            vals.append(
                f"('{bid}','catastro','{btype}',"
                f"NULL,NULL,"
                f"{plantas if plantas else 'NULL'},"
                f"{year if year else 'NULL'},"
                f"{area if area else 'NULL'},"
                f"ST_SetSRID(ST_GeomFromGeoJSON('{geom}'),4326))"
            )

        sql = (
            "INSERT INTO edificios "
            "(source_id,source,building_type,nombre,calle,plantas,year_built,area_m2,geom) "
            "VALUES\n" + ",\n".join(vals) + ";"
        )

        result = sb.rpc("bulk_insert_edificios", {"sql_text": sql}).execute()
        total += len(batch)

        if (i // BATCH) % 10 == 0:
            print(f"    {total}/{len(features)}...")

    print(f"    ✓ {total} edificios subidos para {municipio_nombre}")

    # Marcar municipio como cargado
    sb.table("municipios").update({"datos_cargados": True}).eq(
        "codigo_catastro", municipio_cod
    ).execute()


# ===================== MAIN =====================

def main():
    print("=" * 60)
    print("PIPELINE GRAN CANARIA — Catastro + Secciones → Supabase")
    print("=" * 60)

    # Paso 1
    print("\n[1/5] DESCARGAR CATASTRO")
    descargar_catastro()

    # Paso 2
    print("\n[2/5] PARSEAR GML → GeoJSON")
    all_buildings = {}
    for cod, info in MUNICIPIOS.items():
        print(f"\n  {cod} {info['nombre']}:")
        fc = parsear_gml(cod)
        if fc:
            all_buildings[cod] = fc

    # Paso 3
    print("\n[3/5] DESCARGAR SECCIONES CENSALES")
    secciones_fc = descargar_secciones_alternativo()

    # Paso 4
    if secciones_fc:
        print("\n[4/5] ASIGNAR EDIFICIOS A SECCIONES")
        for cod, fc in all_buildings.items():
            print(f"\n  {cod} {MUNICIPIOS[cod]['nombre']}:")
            all_buildings[cod], bsm = asignar_secciones(fc, secciones_fc, cod)
    else:
        print("\n[4/5] SALTANDO — no hay secciones disponibles")

    # Paso 5
    print("\n[5/5] SUBIR A SUPABASE")
    if SUPABASE_KEY:
        for cod, fc in all_buildings.items():
            print(f"\n  {cod} {MUNICIPIOS[cod]['nombre']}:")
            subir_a_supabase(fc, cod, MUNICIPIOS[cod]["nombre"])
    else:
        print("  ✗ Set SUPABASE_SERVICE_KEY env var to enable upload")
        print("  Los GeoJSON están guardados en:", DATA_DIR)

    # Resumen
    print("\n" + "=" * 60)
    print("RESUMEN")
    total = sum(len(fc["features"]) for fc in all_buildings.values())
    print(f"  Municipios procesados: {len(all_buildings)}/{len(MUNICIPIOS)}")
    print(f"  Edificios totales: {total:,}")
    print(f"  Datos en: {DATA_DIR}")
    print("=" * 60)


if __name__ == "__main__":
    main()
