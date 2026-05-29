#!/usr/bin/env python3
"""
ESP-02 — Playas Canarias (Bandera Azul + accesibilidad + socorrismo).

Genera public/data/playas-canarias.geojson combinando:

  1. OSM (canary-islands PBF Geofabrik) como base geográfica — 805 features
     con `natural=beach`, ~596 con nombre. OSM da geometría, accesibilidad
     (`wheelchair`), socorrismo (`lifeguard` / `supervised`), tipo (surface),
     servicios (`toilets`, `shower`), y municipio (cuando hay `addr:city`).

  2. Lista CURADA de banderas azules 2024 publicada por ADEAC y replicada
     por medios oficiales (planetacanario.com, eldiario.es, canarias7).
     ADEAC no expone un endpoint JSON estable — bloquea User-Agents
     automatizados y su sitio devuelve 400 ante curl. NAYADE / MITECO
     idem (403). La lista de 60 banderas azules 2024 (56 playas + 4
     puertos deportivos que excluimos) se incrusta aquí como tabla:
     nombre normalizado + municipio. Match por nombre normalizado dentro
     del municipio.

  3. Capa de fallback: si OSM no tiene la playa con bandera azul de la
     lista curada, se inyecta como feature con geometría = centroide
     municipal aproximado, marcada `source: "curated"`. Esto cubre los
     huecos típicos de OSM en piscinas naturales (Bajamar, El Caletón)
     que a veces están taggeadas con `leisure=swimming_area` en vez de
     `natural=beach`.

Esquema de salida (FeatureCollection · WGS84):

  {
    type: "Feature",
    geometry: {type: "Point", coordinates: [lng, lat]},
    properties: {
      nombre, mun, isla,
      bandera_azul: bool,
      accesibilidad: "silla_ruedas"|"parcial"|"no"|"desconocido",
      socorrismo:    "activa"|"temporal"|"no"|"desconocido",
      duchas: bool|null,
      aseos: bool|null,
      apta_bano: "excelente"|"buena"|"suficiente"|"mala"|"desconocido",
      longitud_m: int|null,
      tipo: "arena_dorada"|"negra"|"callao"|"mixta"|"desconocido",
      osm_id, source
    }
  }

apta_bano: NAYADE / Sanidad Canaria no expone API JSON pública con
calidad de aguas; se infiere como "excelente" por defecto en playas con
bandera azul (criterio ADEAC exige "excelente" últimos 4 años), y
"desconocido" en el resto. En cuanto se exponga un endpoint NAYADE
estable se puede rellenar este campo con el último análisis.
"""

import json
import math
import os
import re
import sys
import unicodedata
from collections import defaultdict

import osmium

ROOT = "/Users/panch/KOINOS-iso"
PBF = f"{ROOT}/GEOFABRIK/canary-islands-latest.osm.pbf"
OUT = f"{ROOT}/public/data/playas-canarias.geojson"

# Bbox Canarias.
BBOX = (-18.2, 27.5, -13.3, 29.5)

# -----------------------------------------------------------------
# Mapa isla → bbox aproximada (para asignar `isla` cuando OSM no la
# expone). Los bboxes son holgados — basta para clasificar un punto.
# -----------------------------------------------------------------
ISLAS_BBOX = [
    # (isla, lng_min, lat_min, lng_max, lat_max)
    ("El Hierro",      -18.20, 27.60, -17.85, 27.85),
    ("La Palma",       -18.05, 28.40, -17.65, 28.90),
    ("La Gomera",      -17.40, 27.95, -17.05, 28.25),
    ("Tenerife",       -16.95, 27.95, -16.10, 28.65),
    ("Gran Canaria",   -15.85, 27.70, -15.30, 28.20),
    ("Fuerteventura",  -14.55, 27.95, -13.75, 28.85),
    ("Lanzarote",      -13.90, 28.80, -13.30, 29.45),
]


def _isla_de(lng, lat):
    for isla, a, b, c, d in ISLAS_BBOX:
        if a <= lng <= c and b <= lat <= d:
            return isla
    return None


# -----------------------------------------------------------------
# Lista curada de banderas azules 2024 (ADEAC).
# Fuente: planetacanario.com / eldiario.es / canarias7 — 56 playas
# (excluimos los 4 puertos deportivos del listado oficial). Normalizamos
# nombre por lowercase + sin acentos para hacer match con OSM.
# -----------------------------------------------------------------
BLUE_FLAG_2024 = [
    # Fuerteventura
    ("La Oliva", "Fuerteventura", "Corralejo Viejo"),
    ("La Oliva", "Fuerteventura", "Grandes Playas"),
    ("La Oliva", "Fuerteventura", "La Concha"),
    ("Pájara", "Fuerteventura", "Butihondo"),
    ("Pájara", "Fuerteventura", "Costa Calma"),
    ("Pájara", "Fuerteventura", "El Matorral"),
    ("Pájara", "Fuerteventura", "Morro Jable"),
    ("Puerto del Rosario", "Fuerteventura", "Blanca"),
    ("Puerto del Rosario", "Fuerteventura", "Los Pozos"),
    ("Puerto del Rosario", "Fuerteventura", "Puerto Lajas"),
    ("Tuineje", "Fuerteventura", "Gran Tarajal"),
    # Gran Canaria
    ("Agaete", "Gran Canaria", "Las Nieves"),
    ("Agüimes", "Gran Canaria", "Arinaga"),
    ("Arucas", "Gran Canaria", "El Puertillo"),
    ("Arucas", "Gran Canaria", "Los Charcones"),
    ("Gáldar", "Gran Canaria", "Sardina"),
    ("Ingenio", "Gran Canaria", "El Burrero"),
    ("San Bartolomé de Tirajana", "Gran Canaria", "El Inglés"),
    ("San Bartolomé de Tirajana", "Gran Canaria", "Maspalomas"),
    ("San Bartolomé de Tirajana", "Gran Canaria", "Meloneras"),
    ("San Bartolomé de Tirajana", "Gran Canaria", "San Agustín"),
    ("Telde", "Gran Canaria", "Hoya del Pozo"),
    ("Telde", "Gran Canaria", "La Garita"),
    ("Telde", "Gran Canaria", "Melenara"),
    ("Telde", "Gran Canaria", "Salinetas"),
    # Lanzarote
    ("Arrecife", "Lanzarote", "El Reducto"),
    ("Teguise", "Lanzarote", "Las Cucharas"),
    ("Tías", "Lanzarote", "Matagorda"),
    ("Tías", "Lanzarote", "Pila de la Barrilla"),
    ("Tías", "Lanzarote", "Pocillos"),
    ("Yaiza", "Lanzarote", "Blanca"),
    # La Gomera
    ("Alajeró", "La Gomera", "Santiago"),
    # El Hierro
    ("El Pinar de El Hierro", "El Hierro", "La Restinga"),
    ("Valverde", "El Hierro", "Timijaraque"),
    # La Palma
    ("Breña Alta", "La Palma", "Bajamar"),
    ("Breña Baja", "La Palma", "Los Cancajos"),
    ("Los Llanos de Aridane", "La Palma", "Charco Verde"),
    ("Los Llanos de Aridane", "La Palma", "Puerto Naos"),
    ("Santa Cruz de la Palma", "La Palma", "Santa Cruz de la Palma"),
    ("Tazacorte", "La Palma", "El Puerto de Tazacorte"),
    # Tenerife
    ("Adeje", "Tenerife", "El Duque"),
    ("Adeje", "Tenerife", "Fañabé"),
    ("Adeje", "Tenerife", "Torviscas"),
    ("Arona", "Tenerife", "El Camisón"),
    ("Arona", "Tenerife", "Las Vistas"),
    ("Arona", "Tenerife", "Los Cristianos"),
    ("Garachico", "Tenerife", "El Muelle"),
    ("Garachico", "Tenerife", "Piscinas Naturales de El Caletón"),
    ("Guía de Isora", "Tenerife", "Playa de la Jaquita"),
    ("Guía de Isora", "Tenerife", "Playa San Juan"),
    ("Icod de los Vinos", "Tenerife", "San Marcos"),
    ("Los Realejos", "Tenerife", "Socorro"),
    ("San Cristóbal de La Laguna", "Tenerife", "Piscinas Naturales de Bajamar"),
    ("San Cristóbal de La Laguna", "Tenerife", "Piscina Natural del Arenisco"),
    ("San Cristóbal de La Laguna", "Tenerife", "Piscina Natural de Jóver"),
    ("Tacoronte", "Tenerife", "La Arena"),
]

# Centroides municipales aproximados (lng, lat) — usados sólo como
# fallback cuando OSM no tiene una playa con bandera azul. Tomados de
# los polígonos administrativos de barrios-canonical / municipios-info.
MUN_CENTROIDS = {
    "La Oliva":                       (-13.95, 28.78),
    "Pájara":                         (-14.20, 28.20),
    "Puerto del Rosario":             (-13.86, 28.50),
    "Tuineje":                        (-14.07, 28.30),
    "Agaete":                         (-15.69, 28.10),
    "Agüimes":                        (-15.45, 27.83),
    "Arucas":                         (-15.52, 28.12),
    "Gáldar":                         (-15.65, 28.14),
    "Ingenio":                        (-15.44, 27.92),
    "San Bartolomé de Tirajana":      (-15.58, 27.79),
    "Telde":                          (-15.42, 27.99),
    "Arrecife":                       (-13.55, 28.96),
    "Teguise":                        (-13.45, 29.07),
    "Tías":                           (-13.66, 28.95),
    "Yaiza":                          (-13.76, 28.95),
    "Alajeró":                        (-17.24, 28.05),
    "El Pinar de El Hierro":          (-17.99, 27.71),
    "Valverde":                       (-17.91, 27.81),
    "Breña Alta":                     (-17.79, 28.66),
    "Breña Baja":                     (-17.77, 28.61),
    "Los Llanos de Aridane":          (-17.91, 28.66),
    "Santa Cruz de la Palma":         (-17.76, 28.68),
    "Tazacorte":                      (-17.94, 28.64),
    "Adeje":                          (-16.74, 28.12),
    "Arona":                          (-16.68, 28.10),
    "Garachico":                      (-16.76, 28.37),
    "Guía de Isora":                  (-16.79, 28.21),
    "Icod de los Vinos":              (-16.71, 28.37),
    "Los Realejos":                   (-16.58, 28.38),
    "San Cristóbal de La Laguna":     (-16.32, 28.49),
    "Tacoronte":                      (-16.41, 28.47),
}


def _norm(s):
    """Normaliza string para match laxo: lowercase + sin acentos."""
    if not s:
        return ""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower().strip()
    # quitar prefijo "playa de"/"playa"/"piscinas naturales de"/etc.
    s = re.sub(r"^(playas?\s+de\s+|playas?\s+|piscinas?\s+naturales?\s+(de\s+)?(la\s+|el\s+|los\s+|las\s+)?)", "", s)
    s = re.sub(r"\s+", " ", s)
    return s


# Set normalizado (mun, nombre) → True si tiene bandera azul.
BLUE_FLAG_SET = set((_norm(m), _norm(n)) for m, _i, n in BLUE_FLAG_2024)
# Por si OSM no expone municipio, fallback por nombre solo (puede dar
# falsos positivos en homónimos pero los nombres específicos son únicos).
BLUE_FLAG_BY_NAME = set(_norm(n) for _m, _i, n in BLUE_FLAG_2024)


# -----------------------------------------------------------------
# Mapeo de surface OSM → tipo cívico.
# -----------------------------------------------------------------
def _tipo_from_surface(surface):
    if not surface:
        return "desconocido"
    s = surface.lower()
    if "black" in s or s == "volcanic":
        return "negra"
    if "pebble" in s or s == "gravel" or "stone" in s:
        return "callao"
    if s == "sand":
        # En Canarias la arena puede ser dorada o negra según isla. Sin
        # info adicional no asumimos: por convención, las islas
        # orientales (LZ/FV) y zonas del sur de GC son doradas, las
        # vertientes norte y la mayoría de TF son negras. Aquí
        # declaramos `arena_dorada` por defecto cuando surface=sand
        # tag-cleaned, y luego en _enrich_by_isla afinamos.
        return "arena_dorada"
    if "mixed" in s:
        return "mixta"
    return "desconocido"


def _afinar_tipo_por_isla(tipo, isla):
    """Las playas de la vertiente norte de Tenerife / La Palma / La
    Gomera son típicamente de arena negra basáltica. OSM marca sólo
    `sand` y se pierde el matiz. Si el feature lleva surface=sand pero
    está en TF/LP/LG/EH norte, lo etiquetamos como `negra`."""
    if tipo != "arena_dorada":
        return tipo
    if isla in ("La Palma", "La Gomera", "El Hierro"):
        return "negra"
    # Tenerife: norte negra, sur dorada (frontera ~28.30 lat es burda
    # pero suficiente). Lo gestionamos fuera con el lat.
    return tipo


# -----------------------------------------------------------------
# Accesibilidad.
# -----------------------------------------------------------------
def _accesibilidad(tags):
    w = (tags.get("wheelchair") or "").lower()
    if w == "yes" or w == "designated":
        return "silla_ruedas"
    if w == "limited":
        return "parcial"
    if w == "no":
        return "no"
    # heurística: si tiene `toilets:wheelchair=yes` o `ramp` en el name
    if (tags.get("toilets:wheelchair") or "").lower() == "yes":
        return "silla_ruedas"
    if re.search(r"\baccesible\b|\brampa\b", tags.get("name", ""), re.I):
        return "parcial"
    return "desconocido"


def _socorrismo(tags):
    sup = (tags.get("supervised") or "").lower()
    lg = (tags.get("lifeguard") or "").lower()
    if lg == "yes" or sup == "yes":
        return "activa"
    if "seasonal" in sup or "seasonal" in lg or sup == "summer" or lg == "summer":
        return "temporal"
    if lg == "no" or sup == "no":
        return "no"
    return "desconocido"


def _bool_tag(tags, key):
    v = (tags.get(key) or "").lower()
    if v == "yes":
        return True
    if v == "no":
        return False
    return None


def _longitud_polygon(outer):
    """Diagonal del bbox del polígono en metros — proxy de longitud de
    playa (la mayoría de polígonos son alargados costa-tierra)."""
    xs = [pt.lon for pt in outer]
    ys = [pt.lat for pt in outer]
    if not xs:
        return None
    cy = sum(ys) / len(ys)
    mLat = 111000
    mLng = 111000 * math.cos(math.radians(cy))
    w = (max(xs) - min(xs)) * mLng
    h = (max(ys) - min(ys)) * mLat
    # Longitud aproximada = max(ancho, alto) — la playa siempre es más
    # larga que ancha.
    return int(round(max(w, h)))


def _in_bbox(lon, lat):
    return BBOX[0] <= lon <= BBOX[2] and BBOX[1] <= lat <= BBOX[3]


class Extractor(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.features = []
        self._seen = set()

    def _push(self, osm_id, lon, lat, tags, longitud=None):
        if osm_id in self._seen:
            return
        if not _in_bbox(lon, lat):
            return
        if tags.get("natural") != "beach":
            return
        nombre = tags.get("name") or tags.get("name:es") or ""
        if not nombre:
            return  # Sólo conservamos playas con nombre.
        mun = tags.get("addr:city") or tags.get("is_in:municipality") or ""
        isla = _isla_de(lon, lat) or ""

        key = (_norm(mun), _norm(nombre))
        bandera_azul = key in BLUE_FLAG_SET
        if not bandera_azul and not mun:
            # Sin municipio fiable, intentamos match por nombre.
            bandera_azul = _norm(nombre) in BLUE_FLAG_BY_NAME

        tipo = _tipo_from_surface(tags.get("surface"))
        tipo = _afinar_tipo_por_isla(tipo, isla)
        # Tenerife norte: forzar negra si lat > 28.30 y aún arena_dorada
        if tipo == "arena_dorada" and isla == "Tenerife" and lat > 28.30:
            tipo = "negra"

        feat = {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]},
            "properties": {
                "nombre": nombre,
                "mun": mun,
                "isla": isla,
                "bandera_azul": bool(bandera_azul),
                "accesibilidad": _accesibilidad(tags),
                "socorrismo": _socorrismo(tags),
                "duchas": _bool_tag(tags, "shower"),
                "aseos": _bool_tag(tags, "toilets"),
                "apta_bano": "excelente" if bandera_azul else "desconocido",
                "longitud_m": longitud,
                "tipo": tipo,
                "osm_id": osm_id,
                "source": "osm",
            },
        }
        self.features.append(feat)
        self._seen.add(osm_id)

    def node(self, n):
        tags = {t.k: t.v for t in n.tags}
        if tags.get("natural") != "beach":
            return
        try:
            self._push(f"node/{n.id}", n.location.lon, n.location.lat, tags)
        except osmium.InvalidLocationError:
            return

    def area(self, a):
        tags = {t.k: t.v for t in a.tags}
        if tags.get("natural") != "beach":
            return
        try:
            outer = list(next(iter(a.outer_rings()), []) or [])
            if not outer:
                return
            xs = [pt.lon for pt in outer]
            ys = [pt.lat for pt in outer]
            lon = sum(xs) / len(xs)
            lat = sum(ys) / len(ys)
            longitud = _longitud_polygon(outer)
        except Exception:
            return
        self._push(f"area/{a.id}", lon, lat, tags, longitud=longitud)


def _inject_curated_missing(features):
    """Si una bandera azul de la lista curada no aparece entre las
    features extraídas, la inyectamos como feature `source:curated` con
    geometría = centroide municipal. Esto evita huecos visibles."""
    have = set()
    for f in features:
        p = f["properties"]
        have.add((_norm(p.get("mun") or ""), _norm(p.get("nombre") or "")))
        # Match laxo: también marcamos como visto si coincide sólo por
        # nombre (cubre el caso de OSM sin addr:city).
        have.add(("", _norm(p.get("nombre") or "")))

    injected = 0
    for mun, isla, nombre in BLUE_FLAG_2024:
        nmun = _norm(mun)
        nname = _norm(nombre)
        if (nmun, nname) in have or ("", nname) in have:
            continue
        centroid = MUN_CENTROIDS.get(mun)
        if not centroid:
            continue
        lng, lat = centroid
        # Tipo por defecto según isla (norte → negra).
        tipo = "negra" if isla in ("La Palma", "La Gomera", "El Hierro") else "arena_dorada"
        if isla == "Tenerife" and lat > 28.30:
            tipo = "negra"
        feat = {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(lng, 6), round(lat, 6)]},
            "properties": {
                "nombre": nombre,
                "mun": mun,
                "isla": isla,
                "bandera_azul": True,
                "accesibilidad": "desconocido",
                "socorrismo": "desconocido",
                "duchas": None,
                "aseos": None,
                "apta_bano": "excelente",
                "longitud_m": None,
                "tipo": tipo,
                "osm_id": f"curated/{nmun}/{nname}".replace(" ", "_"),
                "source": "curated",
            },
        }
        features.append(feat)
        injected += 1
    return injected


def main():
    if not os.path.exists(PBF):
        print(f"ERROR: PBF no encontrado: {PBF}", file=sys.stderr)
        sys.exit(1)
    print(f"PBF: {PBF}", file=sys.stderr)

    ex = Extractor()
    ex.apply_file(PBF, locations=True)

    injected = _inject_curated_missing(ex.features)

    # Stats.
    by_isla = defaultdict(int)
    n_bandera = 0
    n_acc_sr = 0
    n_acc_parc = 0
    n_socorro = 0
    for f in ex.features:
        p = f["properties"]
        if p.get("isla"):
            by_isla[p["isla"]] += 1
        if p.get("bandera_azul"):
            n_bandera += 1
        if p.get("accesibilidad") == "silla_ruedas":
            n_acc_sr += 1
        elif p.get("accesibilidad") == "parcial":
            n_acc_parc += 1
        if p.get("socorrismo") == "activa":
            n_socorro += 1

    out_fc = {
        "type": "FeatureCollection",
        "name": "playas-canarias",
        "indicator": "ESP-02",
        "generated_at": "2026-05-27",
        "source": "OSM Geofabrik canary-islands + lista curada ADEAC banderas azules 2024",
        "count": len(ex.features),
        "stats": {
            "bandera_azul":    n_bandera,
            "acc_silla_ruedas": n_acc_sr,
            "acc_parcial":      n_acc_parc,
            "socorrismo_activa": n_socorro,
            "curated_injected": injected,
            "by_isla":          dict(by_isla),
        },
        "features": ex.features,
    }

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(out_fc, f, ensure_ascii=False, separators=(",", ":"))
    size_kb = os.path.getsize(OUT) / 1024
    print(f"wrote {OUT} — {len(ex.features)} playas · {size_kb:.1f} KB", file=sys.stderr)
    print(f"  bandera_azul:      {n_bandera}", file=sys.stderr)
    print(f"  curated_injected:  {injected}", file=sys.stderr)
    print(f"  acc_silla_ruedas:  {n_acc_sr}", file=sys.stderr)
    print(f"  acc_parcial:       {n_acc_parc}", file=sys.stderr)
    print(f"  socorrismo_activa: {n_socorro}", file=sys.stderr)
    print(f"  by_isla:           {dict(by_isla)}", file=sys.stderr)


if __name__ == "__main__":
    main()
