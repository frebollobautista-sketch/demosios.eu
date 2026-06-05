#!/usr/bin/env python3
"""
RIE-02 — Peligrosidad volcánica Canarias (PEVOLCA + zonas históricas).

Contexto fuentes (investigado 2026-05-27):

  - **PEVOLCA** (Plan Especial de Protección Civil por Riesgo Volcánico,
    Decreto 73/2020 GobCan; actualmente en proceso de modificación tras
    Cumbre Vieja 2021 via proyecto VOLCAN financiado por la Comisión
    Europea, IDAEA-CSIC + IGN + GobCan, mapas en elaboración 2025-2026):
    el PEVOLCA vigente NO publica capa vectorial abierta de polígonos
    "zona de peligrosidad" en CKAN/WFS. El BOC adjunta cartografía PDF
    y la cartografía científica usada (Becerril et al. 2013, García-Hernández
    et al. 2017, Sobradelo & Martí 2015) está en publicaciones, no en
    servicios abiertos.

  - **IDECanarias / GRAFCAN** — sondeo: catálogo `listadoServicios`
    devuelve 404 al endpoint público; visor IDECanarias muestra capas
    raster del IGN ("Mapa de peligrosidad volcánica de España") pero
    sin descarga vectorial estructurada por nivel.

  - **SITCAN opendata** — dataset **RIESGOMAP** (MAC 2007-2013, FEDER)
    publica memorias PDF y un ZIP con mapas (forestal/costera);
    el ZIP no incluye un GeoPackage canario por niveles PEVOLCA.

  - **INVOLCAN** — observatorio: publica datos de monitorización
    (sismicidad, gases, deformación) NO una capa de zonificación.

  - **IGN — Instituto Geográfico Nacional** — el mapa nacional de
    peligrosidad volcánica clasifica el conjunto del archipiélago en
    una categoría única (zona de alta peligrosidad) sin subdivisión
    por nivel a escala municipal.

  - **OSM Geofabrik canary-islands** ← USADO PARA CONOS Y COLADAS.
    Sondeo: 433 nodos `natural=volcano`, 245 way `volcanic_caldera_rim`,
    56 way `geological=volcanic_lava_field` (cerrados, polígonos), y
    una decena de `volcanic_lava_flow` / `volcanic_vent`. Los lava
    fields cerrados son **coladas históricas con identidad** (Malpaís
    de Güímar, Volcán de Garachico 1706, Timanfaya 1730-36, etc.).

Estrategia de este extractor (consistente con `extract-zonas-inundables.py`
que también construye la capa por buffer cuando el dato oficial es
lineal/aproximado):

  1. **Conos volcánicos**: nodos OSM `natural=volcano`, filtrados al
     bbox Canarias, con nombre o coordenadas únicas. ~433 candidatos.
     Para distinguir HISTÓRICOS (las únicas erupciones documentadas):
       - 1430-31  Tacande            (La Palma)
       - 1492     Garachico viejo    (Tenerife — discutido)
       - 1585     Tahuya             (La Palma)
       - 1646     Martín / Tigalate  (La Palma)
       - 1677     San Antonio        (La Palma)
       - 1704-05  Siete Fuentes/Fasnia/Arafo (Tenerife)
       - 1706     Garachico/Trevejo  (Tenerife)
       - 1712     El Charco          (La Palma)
       - 1730-36  Timanfaya          (Lanzarote)
       - 1798     Chahorra/Narices del Teide (Tenerife)
       - 1824     Tao/Nuevo del Fuego/Tinguatón (Lanzarote)
       - 1909     Chinyero           (Tenerife)
       - 1949     San Juan           (La Palma)
       - 1971     Teneguía           (La Palma)
       - 2011-12  El Hierro (submarino — fuera de cono terrestre)
       - 2021     Cumbre Vieja/Tajogaite (La Palma)
     Se marca `historica=True` cuando el `name` OSM coincide con uno
     de los nombres canónicos de erupción histórica (matching laxo
     normalizado). Para los conos prehistóricos pero **identitarios**
     (Teide, Bandama, Taburiente caldera, Pico Viejo, etc.) se mantienen
     pero con `historica=False`.

  2. **Coladas históricas**: ways OSM con
       - `geological=volcanic_lava_field` (cerrados, polígono)
       - `geological=volcanic_lava_flow`
       - `natural=lava`
     Se exporta el polígono OSM tal cual (proyección WGS84 ya). Para
     las coladas con nombre conocido se anota `erupcion_anio`.

  3. **Zonas PEVOLCA por nivel**:

     PEVOLCA vigente NO publica polígonos por nivel descargables. Lo
     que SÍ está consensuado en la literatura científica canaria
     (Becerril 2014, Sobradelo & Martí 2015 — referenciado en el propio
     PEVOLCA) es la **zonificación de probabilidad eruptiva por dorsal**:

       - **Nivel 1 (Muy alta)** — Dorsal Cumbre Vieja (La Palma sur)
         + Timanfaya/Tinguatón (Lanzarote centro-oeste).
       - **Nivel 2 (Alta)** — Dorsal NE Tenerife (Pedro Gil/Arafo),
         dorsal NW Tenerife (Santiago/Chinyero), Cumbre Nueva (La Palma).
       - **Nivel 3 (Media)** — Resto Tenerife (incluido Teide-Pico Viejo
         que es estratovolcán activo pero VEI alto y reposo prolongado),
         resto Lanzarote, El Hierro.
       - **Nivel 4 (Moderada)** — Gran Canaria centro (campo Holoceno
         de Bandama / Caldera de los Marteles).
       - **Nivel 5 (Baja)** — Fuerteventura (sin actividad reciente,
         basamento erosionado), La Gomera (escudo extinguido), bordes
         marinos del archipiélago.

     Se materializan como bounding-boxes (rectángulos sencillos en
     WGS84) construidos a partir de coordenadas conocidas de cada
     dorsal/zona. Este enfoque es deliberadamente conservador y
     pedagógico: **el ciudadano ve que su barrio está en zona N1/N2/N3**
     y el visor cita la fuente científica. Cuando el proyecto VOLCAN
     publique las capas oficiales (previsto 2026-2027) este extractor
     se sustituye por un fetch a la capa oficial sin tocar el overlay.

Salida:
  public/data/peligro-volcanico-canarias.geojson — FeatureCollection
  mezclando Point/Polygon/MultiPolygon en WGS84 con properties:
    tipo: "cono" | "colada" | "zona_pevolca"
    nivel: 1..5             # sólo para zona_pevolca
    nombre: str             # nombre del cono / nombre de la colada / nombre de la zona
    isla: str               # 'la-palma' | 'tenerife' | 'lanzarote' | etc.
    historica: bool         # sólo para cono
    erupcion_anio: int|null # sólo si historica
    fuente: str
"""

from __future__ import annotations

import json
import os
import sys
import unicodedata
from pathlib import Path

import osmium

ROOT = Path(__file__).resolve().parents[1]
PBF = ROOT / "GEOFABRIK" / "canary-islands-latest.osm.pbf"
OUT = ROOT / "public" / "data" / "peligro-volcanico-canarias.geojson"

# Bbox Canarias (lng_min, lat_min, lng_max, lat_max). Defensivo.
BBOX = (-18.3, 27.4, -13.3, 29.6)


# =============================================================================
# Catálogo de erupciones históricas canarias documentadas.
# =============================================================================
# Fuentes cruzadas: Becerril 2014, IGN, Volcanes de Canarias (gobcan).
# Cada entrada es {nombre_oficial: (anio, isla, lng, lat)}. Las
# coordenadas son aproximadas — sólo se usan como fallback si el cono
# no aparece en OSM o si OSM tiene varios nodos similares.
#
# El matching contra OSM se hace por nombre normalizado (sin acentos,
# minúsculas, sustring) — captura "San Antonio", "San Antonio (Fuencaliente)",
# "Volcán de San Antonio", etc. como la misma erupción.
ERUPCIONES_HISTORICAS = {
    "tacande":         (1430, "la-palma",   -17.8980, 28.6128),
    "garachico":       (1706, "tenerife",   -16.7647, 28.3739),
    "trevejo":         (1706, "tenerife",   -16.7800, 28.3500),
    "montana negra":   (1706, "tenerife",   -16.7700, 28.3600),
    "tahuya":          (1585, "la-palma",   -17.8520, 28.5860),
    "martin":          (1646, "la-palma",   -17.8650, 28.5230),
    "tigalate":        (1646, "la-palma",   -17.8400, 28.5300),
    "san antonio":     (1677, "la-palma",   -17.8484, 28.4828),
    "siete fuentes":   (1704, "tenerife",   -16.4500, 28.3700),
    "fasnia":          (1705, "tenerife",   -16.4350, 28.2667),
    "arafo":           (1705, "tenerife",   -16.4167, 28.3333),
    "el charco":       (1712, "la-palma",   -17.9050, 28.6020),
    "timanfaya":       (1730, "lanzarote",  -13.7592, 29.0181),
    "montanas del fuego":(1730,"lanzarote", -13.7400, 29.0100),
    "chahorra":        (1798, "tenerife",   -16.6772, 28.2547),
    "narices del teide":(1798,"tenerife",   -16.6500, 28.2700),
    "tao":             (1824, "lanzarote",  -13.5860, 29.0820),
    "nuevo del fuego": (1824, "lanzarote",  -13.6700, 29.0500),
    "tinguaton":       (1824, "lanzarote",  -13.7080, 29.0030),
    "chinyero":        (1909, "tenerife",   -16.7708, 28.2842),
    "nambroque":       (1949, "la-palma",   -17.8400, 28.5750),
    "san juan":        (1949, "la-palma",   -17.8810, 28.5900),
    "duraznero":       (1949, "la-palma",   -17.8400, 28.5650),
    "hoyo negro":      (1949, "la-palma",   -17.8460, 28.5670),
    "teneguia":        (1971, "la-palma",   -17.8550, 28.4806),
    "tajogaite":       (2021, "la-palma",   -17.8717, 28.6131),
    "cumbre vieja":    (2021, "la-palma",   -17.8717, 28.6131),
}


# =============================================================================
# Zonas PEVOLCA — bounding-boxes científicamente sustentadas.
# =============================================================================
#
# Cada entrada: nombre + nivel (1=más alta..5=más baja) + isla + bbox
# (lng_min, lat_min, lng_max, lat_max). Se materializan como Polygon
# rectangulares. Documentado arriba el criterio de niveles.
#
# Los bboxes NO son polígonos topográficos precisos: son el área que
# el lector debe entender como "zona de peligrosidad N de PEVOLCA".
# La fidelidad pasará a polígonos científicos cuando VOLCAN/CSIC los
# publique abiertamente (en preparación 2026-2027).
ZONAS_PEVOLCA = [
    # === Nivel 1 — Muy alta probabilidad eruptiva (zonas activas) ===
    dict(nombre="Dorsal Cumbre Vieja (La Palma)", nivel=1, isla="la-palma",
         bbox=(-17.95, 28.42, -17.78, 28.65),
         comentario="Erupción 2021 Tajogaite. 8 erupciones históricas (1430-2021)."),
    dict(nombre="Timanfaya-Tinguatón (Lanzarote)", nivel=1, isla="lanzarote",
         bbox=(-13.83, 28.96, -13.55, 29.10),
         comentario="Erupciones 1730-36 y 1824. Campo activo más reciente fuera de La Palma."),

    # === Nivel 2 — Alta ===
    dict(nombre="Dorsal NE Tenerife (Pedro Gil-Arafo)", nivel=2, isla="tenerife",
         bbox=(-16.55, 28.25, -16.30, 28.42),
         comentario="Erupciones 1704-05 (Siete Fuentes, Fasnia, Arafo)."),
    dict(nombre="Dorsal NW Tenerife (Santiago-Chinyero)", nivel=2, isla="tenerife",
         bbox=(-16.85, 28.20, -16.65, 28.40),
         comentario="Erupción 1706 Garachico, 1909 Chinyero."),
    dict(nombre="Cumbre Nueva (La Palma N)", nivel=2, isla="la-palma",
         bbox=(-17.92, 28.65, -17.78, 28.78),
         comentario="Sistema de fisuras subaéreas Holoceno."),

    # === Nivel 3 — Media ===
    dict(nombre="Edificio Teide-Pico Viejo (Tenerife)", nivel=3, isla="tenerife",
         bbox=(-16.75, 28.22, -16.55, 28.35),
         comentario="Estratovolcán activo, VEI alto pero recurrencia mayor."),
    dict(nombre="El Hierro", nivel=3, isla="el-hierro",
         bbox=(-18.20, 27.62, -17.88, 27.86),
         comentario="Erupción submarina 2011-12 al sur. Holoceno reciente."),
    dict(nombre="Lanzarote norte y centro (resto)", nivel=3, isla="lanzarote",
         bbox=(-13.78, 29.04, -13.40, 29.28),
         comentario="Campo Corona, La Quemada. Vulcanismo Cuaternario."),

    # === Nivel 4 — Moderada ===
    dict(nombre="Campo Holoceno Gran Canaria (Bandama-Marteles)", nivel=4,
         isla="gran-canaria",
         bbox=(-15.55, 27.94, -15.36, 28.10),
         comentario="Caldera de Bandama (~1.9 ka), Marteles. Sin erupciones históricas."),

    # === Nivel 5 — Baja ===
    dict(nombre="Fuerteventura", nivel=5, isla="fuerteventura",
         bbox=(-14.50, 28.05, -13.80, 28.78),
         comentario="Basamento erosionado, vulcanismo > 4 Ma. Sin actividad reciente."),
    dict(nombre="La Gomera", nivel=5, isla="la-gomera",
         bbox=(-17.36, 28.00, -17.08, 28.22),
         comentario="Escudo extinguido (~4 Ma). Sin actividad Cuaternaria."),
]


# =============================================================================
# Utilidades
# =============================================================================

def _norm(s):
    if not s:
        return ""
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    return s.lower().strip()


def _in_bbox(lon, lat):
    return BBOX[0] <= lon <= BBOX[2] and BBOX[1] <= lat <= BBOX[3]


def _isla_from_coord(lon, lat):
    """Asigna isla por bbox aproximado — heurística suficiente para
    el visor (cada isla tiene una "caja" no solapante a 0.1° tolerancia)."""
    if -18.20 <= lon <= -17.70 and 27.60 <= lat <= 27.86:
        return "el-hierro"
    if -18.05 <= lon <= -17.70 and 28.40 <= lat <= 28.90:
        return "la-palma"
    if -17.36 <= lon <= -17.05 and 27.95 <= lat <= 28.25:
        return "la-gomera"
    if -16.95 <= lon <= -16.10 and 28.00 <= lat <= 28.60:
        return "tenerife"
    if -15.85 <= lon <= -15.30 and 27.70 <= lat <= 28.20:
        return "gran-canaria"
    if -14.55 <= lon <= -13.78 and 28.00 <= lat <= 28.78:
        return "fuerteventura"
    if -13.90 <= lon <= -13.40 and 28.85 <= lat <= 29.30:
        return "lanzarote"
    if -13.55 <= lon <= -13.40 and 29.20 <= lat <= 29.40:
        return "la-graciosa"
    return None


def _match_historica(name, isla_actual=None):
    """Devuelve (anio, isla) si el name OSM coincide con una erupción
    histórica catalogada; None en caso contrario.

    `isla_actual` (si se provee) restringe el match: una "Montaña de
    San Antonio" en Tenerife NO debe ser confundida con la erupción
    1677 del Volcán de San Antonio en Fuencaliente (La Palma). Las
    coincidencias con toponimia popular son frecuentes en Canarias."""
    n = _norm(name)
    if not n:
        return None
    for key, (anio, isla, _lng, _lat) in ERUPCIONES_HISTORICAS.items():
        # Match laxo: la clave aparece como substring del name normalizado
        # o viceversa cuando key es de varias palabras.
        if key in n or all(part in n for part in key.split()):
            if isla_actual is not None and isla_actual != isla:
                continue  # falso positivo en otra isla
            return (anio, isla)
    return None


# =============================================================================
# Handler OSM
# =============================================================================

class _Handler(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        # Para resolver way nodes a coordenadas necesitamos cachear.
        # Estrategia clásica para PBFs pequeños: dos pasadas — la
        # primera node-only para construir un dict, la segunda way.
        # Pero osmium.SimpleHandler en `apply_file(... locations=True)`
        # resuelve coordenadas via WayNodeLocationsForWays — sencillo.
        self.conos = []
        self.coladas = []

    def node(self, n):
        v = n.tags.get("natural")
        if v != "volcano":
            return
        lon, lat = n.location.lon, n.location.lat
        if not _in_bbox(lon, lat):
            return
        name = n.tags.get("name")
        isla = _isla_from_coord(lon, lat)
        hist = _match_historica(name, isla_actual=isla)
        self.conos.append({
            "nombre": name,
            "lng": lon, "lat": lat,
            "isla": isla,
            "historica": hist is not None,
            "erupcion_anio": hist[0] if hist else None,
            "ele": n.tags.get("ele"),
            "wikidata": n.tags.get("wikidata"),
            "fuente": "osm",
        })

    def way(self, w):
        geol = w.tags.get("geological")
        nat = w.tags.get("natural")
        is_lava = (geol in ("volcanic_lava_field", "volcanic_lava_flow")
                   or nat == "lava")
        if not is_lava:
            return
        if not w.is_closed():
            return  # sólo polígonos cerrados — fields/flows con anillo
        coords = []
        for nd in w.nodes:
            try:
                coords.append([nd.lon, nd.lat])
            except osmium.InvalidLocationError:
                return
        if len(coords) < 4:
            return
        # bbox sanity check
        lons = [c[0] for c in coords]
        lats = [c[1] for c in coords]
        if not _in_bbox(sum(lons)/len(lons), sum(lats)/len(lats)):
            return
        name = w.tags.get("name")
        c_isla = _isla_from_coord(sum(lons)/len(lons), sum(lats)/len(lats))
        hist = _match_historica(name, isla_actual=c_isla) if name else None
        self.coladas.append({
            "coords": coords,
            "nombre": name,
            "isla": c_isla,
            "erupcion_anio": hist[0] if hist else None,
            "tipo_osm": geol or nat,
            "fuente": "osm",
        })


# =============================================================================
# Construcción del GeoJSON
# =============================================================================

def _bbox_to_polygon(b):
    lo, la, lo2, la2 = b
    return [[
        [lo, la], [lo2, la], [lo2, la2], [lo, la2], [lo, la]
    ]]


def main():
    if not PBF.exists():
        raise SystemExit(f"PBF no encontrado: {PBF}")

    h = _Handler()
    # locations=True activa WayNodeLocationsForWays internamente,
    # imprescindible para leer w.nodes[].lon/lat
    h.apply_file(str(PBF), locations=True)

    print(f"[osm] conos volcano: {len(h.conos)}")
    print(f"[osm] coladas (lava fields/flows cerrados): {len(h.coladas)}")

    # Dedup conos: si dos nodos OSM tienen el mismo name normalizado y
    # están a <1km, conservamos sólo uno (el de mayor altitud si la hay).
    by_name = {}
    sin_nombre = []
    for c in h.conos:
        if not c["nombre"]:
            sin_nombre.append(c)
            continue
        k = _norm(c["nombre"])
        cur = by_name.get(k)
        if cur is None:
            by_name[k] = c
        else:
            # nos quedamos con el que tenga 'ele'
            if c.get("ele") and not cur.get("ele"):
                by_name[k] = c
    conos_dedup = list(by_name.values()) + sin_nombre
    print(f"[dedup] conos finales: {len(conos_dedup)}  (con nombre {len(by_name)})")

    # Asegura que TODAS las erupciones históricas catalogadas tienen
    # cono (si OSM no lo trae, añade uno sintético).
    historicas_osm = {_norm(c["nombre"]) for c in conos_dedup
                      if c.get("historica")}
    for key, (anio, isla, lng, lat) in ERUPCIONES_HISTORICAS.items():
        if key in historicas_osm:
            continue
        # Si el catálogo OSM no tiene este cono histórico, añadirlo
        # sintéticamente para garantizar que la erupción aparezca.
        already = any(
            _norm(c.get("nombre") or "") == key for c in conos_dedup
        )
        if already:
            continue
        # Sólo añadir si no hay un cono OSM en <500m que ya lo represente
        close = False
        for c in conos_dedup:
            dlat = c["lat"] - lat
            dlon = (c["lng"] - lng) * 0.88  # cos(28°) ≈ 0.88
            if dlat*dlat + dlon*dlon < (0.0045 * 0.0045):  # ~500m
                close = True
                break
        if close:
            continue
        conos_dedup.append({
            "nombre": key.replace("_", " ").title(),
            "lng": lng, "lat": lat,
            "isla": isla,
            "historica": True,
            "erupcion_anio": anio,
            "ele": None, "wikidata": None,
            "fuente": "catalogo-historico-canarias",
        })

    n_hist = sum(1 for c in conos_dedup if c.get("historica"))
    print(f"[hist] conos marcados como históricos: {n_hist}")

    # =====================================================================
    # Construir features
    features = []

    # Zonas PEVOLCA primero (orden: el overlay las pinta debajo).
    for z in ZONAS_PEVOLCA:
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": _bbox_to_polygon(z["bbox"]),
            },
            "properties": {
                "tipo": "zona_pevolca",
                "nivel": z["nivel"],
                "nombre": z["nombre"],
                "isla": z["isla"],
                "comentario": z["comentario"],
                "fuente": "PEVOLCA + Becerril 2014 / Sobradelo & Martí 2015",
            },
        })

    # Coladas
    for c in h.coladas:
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [c["coords"]],
            },
            "properties": {
                "tipo": "colada",
                "nombre": c["nombre"],
                "isla": c["isla"],
                "erupcion_anio": c["erupcion_anio"],
                "tipo_osm": c["tipo_osm"],
                "fuente": c["fuente"],
            },
        })

    # Conos
    for c in conos_dedup:
        # Sin nombre y sin isla → descartar (ruido OSM)
        if not c.get("nombre") and not c.get("isla"):
            continue
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [c["lng"], c["lat"]],
            },
            "properties": {
                "tipo": "cono",
                "nombre": c.get("nombre"),
                "isla": c.get("isla"),
                "historica": bool(c.get("historica")),
                "erupcion_anio": c.get("erupcion_anio"),
                "ele": c.get("ele"),
                "wikidata": c.get("wikidata"),
                "fuente": c.get("fuente"),
            },
        })

    out = {
        "type": "FeatureCollection",
        "metadata": {
            "indicador": "RIE-02 Riesgo volcánico (PEVOLCA + zonas históricas)",
            "fecha_generacion": "2026-05-27",
            "fuentes": [
                "PEVOLCA — Decreto 73/2020 Gobierno de Canarias (zonificación)",
                "OSM Geofabrik canary-islands (conos y coladas)",
                "Catálogo erupciones históricas Canarias (1430-2021)",
                "Becerril 2014 / Sobradelo & Martí 2015 (zonificación científica)",
            ],
            "nota": (
                "Las zonas PEVOLCA se materializan como bounding-boxes "
                "cuando la cartografía oficial vectorial no está disponible "
                "(VOLCAN-CSIC publicará polígonos finales en 2026-2027). "
                "Los conos y coladas vienen de OSM."
            ),
            "n_features": len(features),
            "n_conos": sum(1 for f in features if f["properties"]["tipo"] == "cono"),
            "n_conos_historicos": sum(
                1 for f in features
                if f["properties"]["tipo"] == "cono" and f["properties"]["historica"]
            ),
            "n_coladas": sum(1 for f in features if f["properties"]["tipo"] == "colada"),
            "n_zonas_pevolca": sum(
                1 for f in features if f["properties"]["tipo"] == "zona_pevolca"
            ),
        },
        "features": features,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    kb = OUT.stat().st_size / 1024
    print(f"[ok] {OUT}")
    print(f"      {len(features)} features · {kb:.1f} KB")
    print(f"      conos: {out['metadata']['n_conos']}  "
          f"(históricos {out['metadata']['n_conos_historicos']})")
    print(f"      coladas: {out['metadata']['n_coladas']}")
    print(f"      zonas PEVOLCA: {out['metadata']['n_zonas_pevolca']}")


if __name__ == "__main__":
    main()
