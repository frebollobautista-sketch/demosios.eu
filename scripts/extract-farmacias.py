#!/usr/bin/env python3
"""
extract-farmacias.py — Indicador SAL-03: red de farmacias en Canarias con
información de farmacias de guardia rotatoria. Genera el geojson
public/data/farmacias-canarias.geojson.

Fuentes:

  PROVINCIA DE LAS PALMAS (COFLP - https://www.coflp.org)
    El Colegio Oficial de Farmacéuticos de Las Palmas publica abiertamente
    dos CSVs al año en https://www.coflp.org/descargas/ :
      • Agrupa26.csv  → registro maestro de farmacias (nombre, dirección,
                        teléfono, horarios, coordenadas lat,lng, turno,
                        código de turno). 360 farmacias geocodificadas en
                        2026.
      • TURNOS 2026.csv → calendario día-a-día por municipio: qué número
                          de turno (y, en municipios grandes, qué código
                          A/B/C) está de guardia 24 h ese día.
    Cruzando ambos por (municipio, turno, código) podemos calcular para
    cualquier fecha qué farmacias están de guardia hoy y la próxima fecha
    en que les vuelve a tocar.

  PROVINCIA DE S/C TENERIFE (COFTF - https://www.coftenerife.es)
    El COF de Tenerife NO publica un dataset abierto descargable. Tiene
    un buscador con API REST interno
    (/farmacias/controller/server.php/api/*) pero requiere autorización
    y devuelve 404 sin token. Por ahora caemos al fallback OSM:
    extraemos `amenity=pharmacy` del PBF Geofabrik para tener al menos
    el inventario físico, con `guardia_hoy: null` y `_placeholder: true`
    en sus props. La integración real con COFTF queda pendiente — o
    bien negociar acceso, o scrapeo nocturno de su buscador, o esperar
    a un dataset abierto.

  OSM PBF (canary-islands.osm.pbf) se usa para:
    1. Provincia S/C Tenerife → fuente PRINCIPAL (no hay alternativa)
    2. Provincia Las Palmas    → fuente SECUNDARIA: completa farmacias
                                 que OSM tenga pero no estén en el CSV
                                 del COFLP (raro, pero el COFLP solo
                                 lista las farmacias colegiadas activas
                                 de un turno; si una farmacia OSM no
                                 cruza, la añadimos como `_extra_osm`).

Modelo de salida (propiedades por feature, brief SAL-03):
    nombre, direccion, telefono, mun, isla, guardia_hoy (bool|null),
    guardia_proxima_fecha (YYYY-MM-DD|null)

Propiedades extra (auditoría / debugging):
    fuente             : "coflp" | "osm"
    osm_id             : "node/123" | "way/456" | null
    turno              : int (sólo coflp)
    codigo_turno       : "A" | "B" | "" (sólo coflp)
    zona_farmaceutica  : "GC13" etc. (sólo coflp)
    horario_lv         : "9:30-13:15,16:30-20:00" (sólo coflp)
    publico            : True (todas son colegiadas, asumimos servicio público regulado)
    _placeholder       : true si no tenemos info de guardia
"""

import csv
import io
import json
import os
import re
import sys
import urllib.request
from collections import defaultdict
from datetime import date, datetime, timedelta

import osmium

ROOT = "/Users/panch/KOINOS-iso"
PBF_CANDIDATES = [
    f"{ROOT}/GEOFABRIK/canary-islands-latest.osm.pbf",
    f"{ROOT}/GEOFABRIK/canary-islands-260410.osm.pbf",
]
OUT = f"{ROOT}/public/data/farmacias-canarias.geojson"

# Bbox Canarias: lng [-18.2, -13.3], lat [27.5, 29.5]
BBOX = (-18.2, 27.5, -13.3, 29.5)

# Fuentes COFLP
COFLP_AGRUPA = "https://www.coflp.org/descargas/2026/Agrupa26.csv"
COFLP_TURNOS = "https://www.coflp.org/descargas/2026/TURNOS%202026.csv"

# Fecha "hoy" — por defecto la del sistema, pero permitimos override por env
# para pruebas reproducibles (FARMACIAS_DATE=2026-05-27).
TODAY = datetime.fromisoformat(os.environ.get("FARMACIAS_DATE", date.today().isoformat())).date()

# ---------- Helpers de geografía ---------------------------------------------

# Mapeo municipio→isla (provincia GC: 21 municipios; provincia TF: 54)
# Esto cubre la totalidad de municipios canarios, agrupados por isla.
ISLA_POR_MUN = {
    # Gran Canaria
    "Agaete": "Gran Canaria", "Agüimes": "Gran Canaria", "Artenara": "Gran Canaria",
    "Arucas": "Gran Canaria", "Firgas": "Gran Canaria", "Gáldar": "Gran Canaria",
    "Ingenio": "Gran Canaria", "Mogán": "Gran Canaria", "Moya": "Gran Canaria",
    "Las Palmas de Gran Canaria": "Gran Canaria",
    "Las Palmas de GC": "Gran Canaria",
    "La Aldea de San Nicolás": "Gran Canaria", "San Bartolomé de Tirajana": "Gran Canaria",
    "San Mateo": "Gran Canaria", "Vega de San Mateo": "Gran Canaria",
    "Santa Brígida": "Gran Canaria", "Santa Lucía de Tirajana": "Gran Canaria",
    "Santa María de Guía": "Gran Canaria", "Tejeda": "Gran Canaria",
    "Telde": "Gran Canaria", "Teror": "Gran Canaria", "Valleseco": "Gran Canaria",
    "Valsequillo de Gran Canaria": "Gran Canaria", "Valsequillo": "Gran Canaria",
    "Gáldar - Guía": "Gran Canaria", "Agüimes - Ingenio": "Gran Canaria",
    # Fuerteventura
    "Antigua": "Fuerteventura", "Betancuria": "Fuerteventura",
    "La Oliva": "Fuerteventura", "Pájara": "Fuerteventura",
    "Puerto del Rosario": "Fuerteventura", "Tuineje": "Fuerteventura",
    "Morro Jable - Jandía": "Fuerteventura", "Morro Jable": "Fuerteventura",
    # Lanzarote
    "Arrecife": "Lanzarote", "Haría": "Lanzarote", "San Bartolomé de Lanzarote": "Lanzarote",
    "San Bartolomé": "Lanzarote", "Teguise": "Lanzarote", "Tías": "Lanzarote",
    "Tinajo": "Lanzarote", "Yaiza": "Lanzarote",
    "Tinajo - San Bartolomé de Lanzarote": "Lanzarote",
    # Tenerife
    "Adeje": "Tenerife", "Arafo": "Tenerife", "Arico": "Tenerife", "Arona": "Tenerife",
    "Buenavista del Norte": "Tenerife", "Candelaria": "Tenerife",
    "Fasnia": "Tenerife", "Garachico": "Tenerife", "Granadilla de Abona": "Tenerife",
    "Guía de Isora": "Tenerife", "Güímar": "Tenerife",
    "Icod de los Vinos": "Tenerife", "La Guancha": "Tenerife",
    "La Matanza de Acentejo": "Tenerife", "La Orotava": "Tenerife",
    "La Victoria de Acentejo": "Tenerife", "Los Realejos": "Tenerife",
    "Los Silos": "Tenerife", "Puerto de la Cruz": "Tenerife",
    "El Rosario": "Tenerife", "San Cristóbal de La Laguna": "Tenerife",
    "La Laguna": "Tenerife",
    "San Juan de la Rambla": "Tenerife", "San Miguel de Abona": "Tenerife",
    "Santa Cruz de Tenerife": "Tenerife", "Santa Úrsula": "Tenerife",
    "Santiago del Teide": "Tenerife", "El Sauzal": "Tenerife",
    "El Tanque": "Tenerife", "Tacoronte": "Tenerife", "Tegueste": "Tenerife",
    "Vilaflor de Chasna": "Tenerife", "Vilaflor": "Tenerife",
    # La Palma
    "Barlovento": "La Palma", "Breña Alta": "La Palma", "Breña Baja": "La Palma",
    "Fuencaliente de La Palma": "La Palma", "Fuencaliente": "La Palma",
    "Garafía": "La Palma", "Los Llanos de Aridane": "La Palma",
    "El Paso": "La Palma", "Puntagorda": "La Palma", "Puntallana": "La Palma",
    "San Andrés y Sauces": "La Palma", "Santa Cruz de La Palma": "La Palma",
    "Tazacorte": "La Palma", "Tijarafe": "La Palma", "Villa de Mazo": "La Palma",
    # La Gomera
    "Agulo": "La Gomera", "Alajeró": "La Gomera",
    "Hermigua": "La Gomera", "San Sebastián de La Gomera": "La Gomera",
    "Valle Gran Rey": "La Gomera", "Vallehermoso": "La Gomera",
    # El Hierro
    "Frontera": "El Hierro", "El Pinar de El Hierro": "El Hierro",
    "El Pinar": "El Hierro", "Valverde": "El Hierro",
}


def isla_de(mun, fallback=None):
    if not mun:
        return fallback
    m = mun.strip()
    # alguno trae sufijo "(GC)" o similar
    m_clean = re.sub(r"\s*\([A-Z]+\)$", "", m).strip()
    return ISLA_POR_MUN.get(m_clean) or ISLA_POR_MUN.get(m) or fallback


# Bbox por isla para clasificar features OSM por coordenada cuando el tag
# `addr:city` falta. Aprox bbox geográficos (lng_min, lat_min, lng_max, lat_max).
ISLA_BBOX = {
    "Gran Canaria":  (-15.85, 27.70, -15.34, 28.18),
    "Fuerteventura": (-14.55, 27.95, -13.78, 28.78),
    "Lanzarote":     (-13.90, 28.83, -13.40, 29.30),
    "Tenerife":      (-16.95, 27.95, -16.10, 28.62),
    "La Palma":      (-18.05, 28.42, -17.65, 28.88),
    "La Gomera":     (-17.40, 27.95, -17.00, 28.25),
    "El Hierro":     (-18.20, 27.60, -17.85, 27.95),
}


def isla_por_coord(lon, lat):
    for isla, (x0, y0, x1, y1) in ISLA_BBOX.items():
        if x0 <= lon <= x1 and y0 <= lat <= y1:
            return isla
    return None


# ---------- COFLP — Las Palmas ------------------------------------------------

def _http_get_text(url, encoding="iso-8859-1"):
    req = urllib.request.Request(url, headers={"User-Agent": "KOINOS-extract-farmacias/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode(encoding, errors="replace")


def _parse_csv(text):
    # Normaliza line endings de Windows/Mac antiguo: el CSV grande de
    # turnos llega con CRLF mezclado con CR sueltos en celdas.
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    return list(csv.reader(io.StringIO(normalized), delimiter=";"))


def _find_coord(cells):
    """Busca una celda con patrón lat,lng y la devuelve (lon, lat)."""
    pat = re.compile(r"^\s*(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$")
    for cell in cells:
        m = pat.match(cell or "")
        if m:
            lat = float(m.group(1))
            lng = float(m.group(2))
            # En Canarias la lat es ~27-29 y la lng -13..-18.
            if 27.0 <= lat <= 29.6 and -18.4 <= lng <= -13.2:
                return (lng, lat)
    return None


def _horario_lv(row):
    """Compacta apertura/cierre matutino + vespertino de lunes-viernes."""
    am_o, am_c = row[10].strip(), row[11].strip()
    pm_o, pm_c = row[12].strip(), row[13].strip()
    chunks = []
    if am_o and am_c:
        chunks.append(f"{am_o[:5]}-{am_c[:5]}")
    if pm_o and pm_c:
        chunks.append(f"{pm_o[:5]}-{pm_c[:5]}")
    return ",".join(chunks) if chunks else None


def cargar_coflp():
    """Devuelve dict de farmacias COFLP + tabla de turnos para cálculo de guardia.

    Returns: (lista_farms_dict, lookup_turnos_dia)
        farms[i] = {
            nombre, direccion, telefono, mun, isla, lng, lat,
            turno (int), codigo (str), zona_farm, horario_lv
        }
        lookup_turnos_dia[(municipio_norm, "YYYY-MM-DD")] = {"turno": int, "codigo": str}
    """
    try:
        ag_txt = _http_get_text(COFLP_AGRUPA)
        tu_txt = _http_get_text(COFLP_TURNOS)
    except Exception as e:
        print(f"WARN: COFLP fetch fallo: {e}", file=sys.stderr)
        return [], {}

    farms = []
    ag_rows = _parse_csv(ag_txt)
    if not ag_rows:
        return [], {}
    hdr = [h.strip() for h in ag_rows[0]]
    # Map seguro: el orden está documentado pero por si cambia.
    def col(name):
        try:
            return hdr.index(name)
        except ValueError:
            return -1

    iMun, iZona = col("Municipio"), col("Zona Farmacéutica")
    iTurno, iCodigo = col("Turno"), col("Codigo")
    iTitular, iDir = col("Titular"), col("Dirección")
    iTel = col("Telefono")

    for row in ag_rows[1:]:
        if len(row) < 10:
            continue
        nombre = (row[iTitular] if iTitular >= 0 else "").strip()
        if not nombre:
            continue
        coord = _find_coord(row)
        if not coord:
            continue
        lng, lat = coord
        mun = row[iMun].strip() if iMun >= 0 else ""
        farms.append({
            "nombre": nombre,
            "direccion": (row[iDir].strip() if iDir >= 0 else "") or None,
            "telefono": (row[iTel].strip() if iTel >= 0 else "") or None,
            "mun": mun,
            "isla": isla_de(mun) or isla_por_coord(lng, lat),
            "lng": lng,
            "lat": lat,
            "turno": _to_int(row[iTurno] if iTurno >= 0 else ""),
            "codigo": (row[iCodigo].strip() if iCodigo >= 0 else "") or "",
            "zona_farm": (row[iZona].strip() if iZona >= 0 else "") or None,
            "horario_lv": _horario_lv(row),
        })

    # Calendario turnos por día (todo 2026, ~11k filas)
    tu_rows = _parse_csv(tu_txt)
    if not tu_rows:
        return farms, {}
    thdr = [h.strip() for h in tu_rows[0]]
    def tcol(name):
        try:
            return thdr.index(name)
        except ValueError:
            return -1
    iDia, iMes, iAnio = tcol("Dia"), tcol("Mes"), tcol("Año")
    iTMun = tcol("Municipio")
    iTTurno = tcol("Turnos_24h")
    iTCod = tcol("Código")

    lookup = {}
    for row in tu_rows[1:]:
        if len(row) < 12:
            continue
        try:
            d = int(row[iDia]); m = int(row[iMes]); y = int(row[iAnio])
        except (ValueError, IndexError):
            continue
        try:
            iso = date(y, m, d).isoformat()
        except ValueError:
            continue
        mun = row[iTMun].strip() if iTMun >= 0 else ""
        turno = _to_int(row[iTTurno] if iTTurno >= 0 else "")
        codigo = (row[iTCod].strip() if iTCod >= 0 else "") or ""
        if turno is None:
            continue
        lookup[(mun, iso)] = {"turno": turno, "codigo": codigo}
    return farms, lookup


def _to_int(s):
    try:
        return int(str(s).strip())
    except (ValueError, TypeError):
        return None


def calcular_guardia(farm, lookup, today=TODAY, horizonte_dias=180):
    """Devuelve (guardia_hoy: bool|None, guardia_proxima_fecha: ISO|None).

    Una farmacia está de guardia un día X si en lookup[(mun, X)] el turno
    coincide con el turno de la farmacia. En municipios grandes (Las
    Palmas GC, Telde, etc.) además el código del turno (A/B/...) ha de
    coincidir; en municipios pequeños el campo `codigo` del calendario
    viene vacío y se ignora.
    """
    mun = farm["mun"]
    if not mun or farm["turno"] is None:
        return None, None

    # Hoy
    today_iso = today.isoformat()
    rec = lookup.get((mun, today_iso))
    hoy = None
    if rec is not None:
        if rec["turno"] == farm["turno"]:
            # Comprobar código si hay diferenciación A/B en este municipio
            if rec["codigo"]:
                hoy = (rec["codigo"] == farm["codigo"])
            else:
                hoy = True
        else:
            hoy = False

    # Próxima fecha (incluyendo hoy)
    proxima = None
    for delta in range(0, horizonte_dias + 1):
        d = today + timedelta(days=delta)
        rec = lookup.get((mun, d.isoformat()))
        if rec is None:
            continue
        if rec["turno"] != farm["turno"]:
            continue
        if rec["codigo"] and rec["codigo"] != farm["codigo"]:
            continue
        proxima = d.isoformat()
        break
    return hoy, proxima


# ---------- OSM PBF — Tenerife y completar Las Palmas ------------------------

class FarmaciasOsmExtractor(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.features = []
        self._seen = set()

    def _in_bbox(self, lon, lat):
        return BBOX[0] <= lon <= BBOX[2] and BBOX[1] <= lat <= BBOX[3]

    def _is_pharmacy(self, tags):
        return tags.get("amenity") == "pharmacy" or tags.get("healthcare") == "pharmacy"

    def _push(self, osm_id, lon, lat, tags):
        if osm_id in self._seen:
            return
        if not self._in_bbox(lon, lat):
            return
        nombre = tags.get("name") or tags.get("name:es") or "Farmacia"
        direccion = " ".join(filter(None, [
            tags.get("addr:street"),
            tags.get("addr:housenumber"),
        ])) or tags.get("addr:full") or None
        mun = tags.get("addr:city") or tags.get("is_in:municipality") or ""
        isla = isla_de(mun) or isla_por_coord(lon, lat)
        self.features.append({
            "nombre": nombre.strip(),
            "direccion": direccion.strip() if direccion else None,
            "telefono": tags.get("phone") or tags.get("contact:phone") or None,
            "mun": mun.strip(),
            "isla": isla,
            "lng": round(lon, 6),
            "lat": round(lat, 6),
            "osm_id": osm_id,
            "horario_lv": tags.get("opening_hours") or None,
            "wheelchair": tags.get("wheelchair") or None,
            "website": tags.get("website") or tags.get("contact:website") or None,
        })
        self._seen.add(osm_id)

    def node(self, n):
        tags = {t.k: t.v for t in n.tags}
        if not self._is_pharmacy(tags):
            return
        try:
            lon, lat = n.location.lon, n.location.lat
        except osmium.InvalidLocationError:
            return
        self._push(f"node/{n.id}", lon, lat, tags)

    def area(self, a):
        tags = {t.k: t.v for t in a.tags}
        if not self._is_pharmacy(tags):
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
            lon = sum(xs)/len(xs); lat = sum(ys)/len(ys)
        except (osmium.InvalidLocationError, Exception):
            return
        self._push(f"area/{a.id}", lon, lat, tags)


def cargar_osm():
    pbf = next((p for p in PBF_CANDIDATES if os.path.exists(p)), None)
    if not pbf:
        print("WARN: PBF no encontrado — saltamos extracción OSM", file=sys.stderr)
        return []
    print(f"PBF: {pbf}", file=sys.stderr)
    ex = FarmaciasOsmExtractor()
    ex.apply_file(pbf, locations=True)
    return ex.features


# ---------- Fusión ------------------------------------------------------------

def _dedup_key(lng, lat, nombre):
    """Clave grosso modo: redondear coord a ~10m y normalizar nombre."""
    nm = re.sub(r"[^a-z0-9]", "", (nombre or "").lower())[:24]
    return (round(lng, 4), round(lat, 4), nm)


def fusionar(coflp_farms, coflp_lookup, osm_farms):
    """Combina ambos sets. Para Las Palmas la fuente canónica es COFLP
    (con guardia calculable); OSM solo añade farmacias que NO estén
    en COFLP. Para Tenerife / S/C provincia: solo OSM como placeholder.
    """
    out = []
    counts = {"coflp": 0, "osm": 0, "guardia_hoy": 0}

    coflp_seen = set()
    for f in coflp_farms:
        hoy, prox = calcular_guardia(f, coflp_lookup)
        feat = {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [f["lng"], f["lat"]]},
            "properties": {
                "nombre": f["nombre"],
                "direccion": f["direccion"],
                "telefono": f["telefono"],
                "mun": f["mun"],
                "isla": f["isla"],
                "guardia_hoy": hoy,
                "guardia_proxima_fecha": prox,
                "fuente": "coflp",
                "turno": f["turno"],
                "codigo_turno": f["codigo"] or None,
                "zona_farmaceutica": f["zona_farm"],
                "horario_lv": f["horario_lv"],
                "publico": True,
                "osm_id": None,
                "_placeholder": False,
            },
        }
        out.append(feat)
        counts["coflp"] += 1
        if hoy:
            counts["guardia_hoy"] += 1
        coflp_seen.add(_dedup_key(f["lng"], f["lat"], f["nombre"]))

    for f in osm_farms:
        # Si esta farmacia OSM cae en una isla de provincia Las Palmas y
        # el COFLP ya tiene una farmacia muy cercana con nombre parecido,
        # la saltamos. Si no, la añadimos como _placeholder.
        prov_lp = f["isla"] in ("Gran Canaria", "Fuerteventura", "Lanzarote")
        key = _dedup_key(f["lng"], f["lat"], f["nombre"])
        if prov_lp and key in coflp_seen:
            continue
        # Comprobación más amplia: si hay alguna farmacia COFLP a ≤80m
        # en la misma isla, dedup.
        if prov_lp and any(
            (round(c["lng"], 4) == round(f["lng"], 4) and
             round(c["lat"], 4) == round(f["lat"], 4))
            for c in coflp_farms
        ):
            continue
        feat = {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [f["lng"], f["lat"]]},
            "properties": {
                "nombre": f["nombre"],
                "direccion": f["direccion"],
                "telefono": f["telefono"],
                "mun": f["mun"],
                "isla": f["isla"],
                "guardia_hoy": None,
                "guardia_proxima_fecha": None,
                "fuente": "osm",
                "turno": None,
                "codigo_turno": None,
                "zona_farmaceutica": None,
                "horario_lv": f.get("horario_lv"),
                "publico": True,
                "osm_id": f["osm_id"],
                "_placeholder": True,
            },
        }
        out.append(feat)
        counts["osm"] += 1
    return out, counts


# ---------- Main --------------------------------------------------------------

def main():
    print(f"Fecha de cálculo de guardia: {TODAY.isoformat()}", file=sys.stderr)
    print("Descargando COFLP...", file=sys.stderr)
    coflp_farms, coflp_lookup = cargar_coflp()
    print(f"  COFLP: {len(coflp_farms)} farmacias geocodificadas, "
          f"{len(coflp_lookup)} entradas calendario", file=sys.stderr)
    print("Extrayendo OSM (amenity=pharmacy)...", file=sys.stderr)
    osm_farms = cargar_osm()
    print(f"  OSM: {len(osm_farms)} farmacias", file=sys.stderr)

    feats, counts = fusionar(coflp_farms, coflp_lookup, osm_farms)
    print(f"Resultado: {len(feats)} farmacias  (coflp={counts['coflp']} "
          f"osm={counts['osm']} guardia_hoy={counts['guardia_hoy']})",
          file=sys.stderr)

    by_isla = defaultdict(int)
    by_isla_guardia = defaultdict(int)
    by_isla_placeholder = defaultdict(int)
    for f in feats:
        i = f["properties"]["isla"] or "?"
        by_isla[i] += 1
        if f["properties"]["guardia_hoy"]:
            by_isla_guardia[i] += 1
        if f["properties"]["_placeholder"]:
            by_isla_placeholder[i] += 1

    fc = {
        "type": "FeatureCollection",
        "name": "farmacias-canarias",
        "indicator": "SAL-03",
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "generated_for_date": TODAY.isoformat(),
        "source": "COFLP (provincia Las Palmas, datos abiertos CSV) + "
                  "OSM Geofabrik canary-islands (provincia S/C Tenerife como "
                  "placeholder; COFTF no expone dataset abierto)",
        "count": len(feats),
        "by_isla": dict(by_isla),
        "by_isla_guardia_hoy": dict(by_isla_guardia),
        "by_isla_placeholder": dict(by_isla_placeholder),
        "guardia_hoy_total": counts["guardia_hoy"],
        "features": feats,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(fc, f, ensure_ascii=False, separators=(",", ":"))
    print(f"wrote {OUT}", file=sys.stderr)
    for isla in sorted(by_isla, key=lambda x: -by_isla[x]):
        ph = by_isla_placeholder.get(isla, 0)
        g  = by_isla_guardia.get(isla, 0)
        print(f"  {isla:18s}  total={by_isla[isla]:4d}  guardia_hoy={g:3d}  "
              f"placeholder={ph:4d}", file=sys.stderr)


if __name__ == "__main__":
    main()
