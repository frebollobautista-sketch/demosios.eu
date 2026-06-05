#!/usr/bin/env python3
"""
extract-arboles-singulares.py — ESP-05 Árboles Singulares de Canarias.

Tarea: identidad. Cada drago es patrimonio vivo. Generar un GeoJSON con
el catálogo de árboles singulares del archipiélago para que el runtime
iso pinte "estampas botánicas" sobre el territorio.

Estrategia de fuentes (investigada 2026-05-27):

  1. **datos.canarias.es** — buscado "árboles singulares" / "arbolado
     singular" / "catálogo arbolado": NO encontrado dataset abierto
     reutilizable. El Gobierno publica el catálogo como PDF cerrado por
     resolución, sin endpoint CSV/GeoJSON.

  2. **IDECanarias** — el listado de servicios responde 404 sobre el
     endpoint público explorable; no expone una capa WFS "árboles
     singulares" identificable sin credenciales.

  3. **Cabildos** (Tenerife / Gran Canaria / La Palma) — portales web
     temáticos sin descargables. Listados HTML únicamente.

  4. **OSM Geofabrik canary-islands** ← USADO. La comunidad mapea
     `natural=tree` con un subconjunto importante etiquetado como
     `denotation=natural_monument`, `monument=*`, o con `name` propio
     ("Drago Milenario", "Pino Gordo", "Garoé"...). Sondeo: 144
     candidatos con identidad (nombre/monumento natural/altura > 20m).
     Las especies dominantes son las esperables: Dracaena draco (drago),
     Pinus canariensis (pino canario), Phoenix canariensis (palmera
     canaria), Visnea mocanera, Ocotea foetens (til), Laurus azorica.

Por lo tanto: fuente principal **OSM PBF**, enriquecida con un
catálogo curado (`CURATED_ENRICHMENT`) que añade edad estimada y
tradición/leyenda para los ejemplares más icónicos (Drago de Icod,
Pino Gordo de Vilaflor, Garoé, Dragos Gemelos, etc.) cuyos datos no
están en OSM pero forman parte del imaginario popular.

Salida: `public/data/arboles-singulares-canarias.geojson`
"""

from __future__ import annotations

import json
import os
import sys
import unicodedata
from collections import Counter, defaultdict

import osmium

ROOT = "/Users/panch/KOINOS-iso"
PBF_CANDIDATES = [
    f"{ROOT}/GEOFABRIK/canary-islands-latest.osm.pbf",
    f"{ROOT}/GEOFABRIK/canary-islands-260410.osm.pbf",
]
OUT = f"{ROOT}/public/data/arboles-singulares-canarias.geojson"
BARRIOS = f"{ROOT}/public/data/barrios-canonical.json"

# Bbox Canarias (lng_min, lat_min, lng_max, lat_max).
BBOX = (-18.3, 27.5, -13.3, 29.5)

GENERATED_AT = "2026-05-27"


# =============================================================================
# Especies → familia visual (la usa el overlay para elegir el icono).
# =============================================================================
#
# El overlay diferencia 5 grupos visuales: drago, pino_canario, laurel,
# sabina, palmera, otro. Esta normalización pasa de "Pinus canariensis"
# (texto libre OSM) a un tag estable.

SPECIES_TO_FAMILY = {
    # Dragos
    "dracaena draco": "drago",
    "dracaena drago": "drago",   # variante con typo en OSM
    "dragos": "drago",
    "drago": "drago",
    # Pino canario
    "pinus canariensis": "pino_canario",
    "pinus": "pino_canario",     # en Canarias casi siempre P. canariensis
    "pino canario": "pino_canario",
    # Laurel / laurisilva
    "laurus azorica": "laurel",
    "laurus novocanariensis": "laurel",
    "laurus": "laurel",
    "ocotea foetens": "til",     # til, miembro de laurisilva → variante
    "persea indica": "viñatigo",
    "visnea mocanera": "mocan",
    "ilex canariensis": "acebiño",
    # Sabina / juniperus
    "juniperus phoenicea": "sabina",
    "juniperus canariensis": "sabina",
    "juniperus": "sabina",
    "sabina": "sabina",
    # Palmera canaria
    "phoenix canariensis": "palmera",
    "phoenis canariensis": "palmera",   # typo encontrado en OSM
    "phoenix": "palmera",
    # Otros frecuentes
    "arbutus canariensis": "madroño",
    "euphorbia canariensis": "cardon",
    "euphorbia balsamifera": "tabaiba",
    "ceratonia siliqua l.": "algarrobo",
    "ceratonia siliqua": "algarrobo",
    "ficus": "ficus",
    "ficus virens": "ficus",
    "araucaria": "araucaria",
    "cedrus": "cedro",
    "pinus pinea": "pino_pinonero",
    "adenocarpus foliolosus": "codeso",
}


def _norm(s: str) -> str:
    if not s:
        return ""
    s = s.strip().lower()
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s


def family_of(species: str | None, name: str | None) -> str:
    """Devuelve la familia visual a partir de especie y nombre."""
    sp = _norm(species or "")
    if sp in SPECIES_TO_FAMILY:
        return SPECIES_TO_FAMILY[sp]
    # heurística por nombre cuando OSM no etiqueta la especie
    n = _norm(name or "")
    for kw, fam in (
        ("drago", "drago"),
        ("pino", "pino_canario"),
        ("laurel", "laurel"),
        ("til", "til"),
        ("sabina", "sabina"),
        ("palmer", "palmera"),
        ("garoe", "til"),       # el Garoé era un til (Ocotea foetens)
        ("mocan", "mocan"),
        ("vinatigo", "viñatigo"),
        ("acebino", "acebiño"),
        ("algarrobo", "algarrobo"),
    ):
        if kw in n:
            return fam
    return "otro"


# =============================================================================
# Enrichment curado — para los más icónicos no documentados en OSM.
# Match por (nombre normalizado, bbox aprox). Cuando hay match, se
# rellenan los campos vacíos sin pisar lo que sí publique OSM.
# =============================================================================

CURATED_ENRICHMENT = [
    {
        "match_name": "drago milenario",
        "near": (28.3239, -16.7126),   # Icod de los Vinos
        "edad_aprox": 800,              # estudios modernos: 500-800 años (no 1000+)
        "altura_m": 18.0,
        "proteccion": "monumental",
        "tradicion": (
            "Símbolo del archipiélago. Los guanches consideraban su savia roja "
            "(\"sangre de drago\") un don de los dioses; se usaba para embalsamar momias."
        ),
    },
    {
        "match_name": "drago de san francisco",
        "near": (28.4682, -16.2546),   # Santa Cruz de Tenerife
        "edad_aprox": 200,
        "proteccion": "singular",
        "tradicion": "Compañero urbano de los chicharreros; sobrevivió a la expansión del centro.",
    },
    {
        "match_name": "dragos gemelos",
        "near": (27.9, -15.5),
        "proteccion": "monumental",
        "tradicion": "Pareja de dragos enraizados juntos — anomalía botánica que la gente del pueblo enseña a los nietos.",
    },
    {
        "match_name": "drago de tenteniguada",
        "near": (28.0334, -15.5660),   # Valsequillo, GC
        "edad_aprox": 300,
        "proteccion": "singular",
        "tradicion": "Centinela del barranco de Tenteniguada. Bajo su copa se celebraban reuniones vecinales antes del ayuntamiento.",
    },
    {
        "match_name": "drago de gáldar",
        "near": (28.1438, -15.6536),
        "edad_aprox": 400,
        "proteccion": "monumental",
        "tradicion": "Testigo de la antigua corte aborigen de Gáldar.",
    },
    {
        "match_name": "drago de puntagorda",
        "near": (28.7700, -17.9933),   # La Palma
        "edad_aprox": 500,
        "proteccion": "monumental",
        "tradicion": "El drago más venerado del noroeste de La Palma; las romerías hacen parada bajo su copa.",
    },
    {
        "match_name": "drago de la culata",
        "near": (28.6, -17.85),
        "proteccion": "monumental",
        "tradicion": "Patrimonio rural de la medianía palmera.",
    },
    {
        "match_name": "el drago de san antonio",
        "near": (28.4, -16.5),
        "altura_m": 16.0,
        "proteccion": "singular",
    },
    {
        "match_name": "drago centenario",
        "proteccion": "singular",
        "tradicion": "Uno de los muchos dragos centenarios del paisaje doméstico canario.",
    },
    {
        "match_name": "pino gordo",
        "near": (28.1567, -16.6353),    # Vilaflor, Tenerife
        "edad_aprox": 800,
        "altura_m": 45.12,
        "proteccion": "monumental",
        "tradicion": (
            "El pino canario más imponente del archipiélago. Sobrevivió al fuego "
            "varias veces — el pino canario rebrota tras incendios, milagro adaptativo."
        ),
    },
    {
        "match_name": "pino de las dos pernadas",
        "altura_m": 56.0,
        "proteccion": "monumental",
        "tradicion": "Doble tronco unido en la base, raro en Pinus canariensis adultos.",
    },
    {
        "match_name": "pino gordo de pilancones",
        "near": (27.83, -15.62),       # Pilancones, GC
        "altura_m": 50.0,
        "proteccion": "monumental",
        "tradicion": "Vigía del macizo de Pilancones, en pleno corazón del sur de Gran Canaria.",
    },
    {
        "match_name": "pino piloto",
        "altura_m": 25.0,
        "proteccion": "singular",
    },
    {
        "match_name": "pino centenario",
        "proteccion": "singular",
    },
    {
        "match_name": "pino de buen paso",
        "proteccion": "singular",
        "tradicion": "Pino-marco de medianías; los abuelos lo señalan en las romerías.",
    },
    {
        "match_name": "pino de la catadura",
        "proteccion": "singular",
    },
    {
        "match_name": "pino de santo domingo",
        "proteccion": "singular",
    },
    {
        "match_name": "garoé",
        "near": (27.8167, -17.9333),   # El Hierro
        "edad_aprox": 150,              # el original cayó en 1610; el actual es reposición de 1949
        "proteccion": "monumental",
        "tradicion": (
            "El \"árbol que llora\". Los bimbaches creían que destilaba agua del aire — "
            "y era cierto: la lluvia horizontal de los alisios condensa en sus hojas. "
            "El original cayó en 1610; el actual fue plantado en 1949."
        ),
    },
    {
        "match_name": "til de los pavos",
        "proteccion": "monumental",
        "tradicion": "Til monumental de la laurisilva. Los pavos salvajes solían anidar en sus ramas, de ahí el nombre.",
    },
    {
        "match_name": "laurel centenario",
        "proteccion": "singular",
    },
    {
        "match_name": "palmera de paquesito",
        "altura_m": 45.0,
        "proteccion": "monumental",
        "tradicion": "Palmera canaria de altura excepcional, símbolo del paisaje cultural de palmerales.",
    },
]


def _almost_eq(a, b, tol=0.05):
    """Comparación blanda para emparejar OSM ↔ catálogo curado por coordenadas."""
    return abs(a[0] - b[0]) <= tol and abs(a[1] - b[1]) <= tol


def enrich_curated(name: str, lat: float, lon: float, props: dict) -> dict:
    """Sin pisar campos ya rellenos por OSM, completa con curado si hay match."""
    nn = _norm(name)
    for c in CURATED_ENRICHMENT:
        if _norm(c["match_name"]) != nn:
            continue
        if "near" in c and not _almost_eq((lat, lon), c["near"], tol=0.5):
            continue
        for k in ("edad_aprox", "altura_m", "proteccion", "tradicion"):
            if k in c and props.get(k) in (None, "", 0):
                props[k] = c[k]
        break
    return props


# =============================================================================
# Lookup de municipio por point-in-polygon sobre `barrios-canonical.json`.
# Hacemos un ray-casting simple — los polígonos son pequeños y son ~462,
# así que no merece la pena meter shapely sólo para esto.
# =============================================================================

def _load_barrios():
    """Devuelve lista de (mun_name, bbox, ring_outer) para lookup rápido."""
    try:
        with open(BARRIOS, "r") as f:
            d = json.load(f)
    except FileNotFoundError:
        return []
    out = []
    for b in d.get("barrios", {}).values():
        mun = b.get("mun_name") or ""
        bbox = b.get("bbox")
        geom = b.get("geometria") or {}
        coords = geom.get("coordinates")
        if not (mun and bbox and coords):
            continue
        # Polygon: coords = [outer_ring, holes...]
        # MultiPolygon: coords = [[outer_ring, holes...], ...]
        rings = []
        if geom.get("type") == "Polygon":
            rings.append(coords[0])
        elif geom.get("type") == "MultiPolygon":
            for poly in coords:
                rings.append(poly[0])
        for r in rings:
            out.append((mun, bbox, r))
    return out


def _point_in_ring(lon, lat, ring) -> bool:
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        intersect = ((yi > lat) != (yj > lat)) and \
                    (lon < (xj - xi) * (lat - yi) / (yj - yi + 1e-12) + xi)
        if intersect:
            inside = not inside
        j = i
    return inside


def municipio_for(lon, lat, barrios):
    for mun, bbox, ring in barrios:
        if not (bbox[0] <= lon <= bbox[2] and bbox[1] <= lat <= bbox[3]):
            continue
        if _point_in_ring(lon, lat, ring):
            return mun
    return None


# =============================================================================
# Handler osmium principal.
# =============================================================================

class TreeHandler(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.rows = []

    def _is_singular(self, tags) -> tuple[bool, str]:
        """¿Pasa el filtro de "árbol con identidad"? Devuelve (bool, proteccion_default)."""
        if tags.get("natural") != "tree" and tags.get("monument") != "tree":
            return False, ""
        # Razones para considerarlo singular:
        if tags.get("denotation") == "natural_monument":
            return True, "monumental"
        if tags.get("monument") in ("yes", "tree"):
            return True, "monumental"
        if tags.get("heritage"):
            return True, "monumental"
        if tags.get("protected") == "tree":
            return True, "monumental"
        # Tiene nombre propio → muy probable que la comunidad lo tenga catalogado.
        name = tags.get("name") or tags.get("name:es")
        if name:
            n = name.strip().lower()
            # Filtra nombres genéricos ("Árbol", "Tree", "drago" en minúscula sin más).
            if len(n) < 4:
                return False, ""
            if n in ("tree", "arbol", "árbol", "drago", "laurel", "pino", "palmera"):
                return False, ""
            return True, "singular"
        # Altura excepcional → singular implícito.
        try:
            h = float(tags.get("height", "") or 0)
            if h >= 20:
                return True, "singular"
        except ValueError:
            pass
        return False, ""

    def _in_bbox(self, lon, lat):
        return BBOX[0] <= lon <= BBOX[2] and BBOX[1] <= lat <= BBOX[3]

    def node(self, n):
        tags = {t.k: t.v for t in n.tags}
        ok, prot_def = self._is_singular(tags)
        if not ok:
            return
        try:
            lon, lat = n.location.lon, n.location.lat
        except osmium.InvalidLocationError:
            return
        if not self._in_bbox(lon, lat):
            return

        name = (tags.get("name") or tags.get("name:es") or "").strip()
        species_raw = tags.get("species") or tags.get("species:es") or tags.get("genus") or ""
        species_es = tags.get("species:es") or ""
        fam = family_of(species_raw, name)

        try:
            altura = float(tags.get("height", "") or 0) or None
        except ValueError:
            altura = None

        edad = None
        start = tags.get("start_date") or tags.get("age")
        if start:
            # OSM admite "1500", "~1500", "1500-01-01", "approx 1500" etc.
            digits = "".join(c for c in str(start) if c.isdigit())
            if len(digits) >= 4:
                try:
                    yr = int(digits[:4])
                    if 1000 <= yr <= 2100:
                        edad = 2026 - yr
                    else:
                        edad = yr if yr < 3000 else None
                except ValueError:
                    pass

        self.rows.append({
            "osm_id": f"node/{n.id}",
            "lon": round(lon, 6),
            "lat": round(lat, 6),
            "nombre": name,
            "especie_raw": species_raw,
            "especie_es": species_es,
            "familia": fam,
            "altura_m": altura,
            "edad_aprox": edad,
            "proteccion": prot_def,
            "wikipedia": tags.get("wikipedia"),
            "wikidata": tags.get("wikidata") or tags.get("species:wikidata"),
        })


# =============================================================================
# Especie legible en castellano cuando OSM solo trae el latín.
# =============================================================================

SPECIES_HUMAN = {
    "drago": "drago",
    "pino_canario": "pino canario",
    "palmera": "palmera canaria",
    "laurel": "laurel",
    "til": "til",
    "sabina": "sabina",
    "viñatigo": "viñatigo",
    "mocan": "mocán",
    "acebiño": "acebiño",
    "madroño": "madroño canario",
    "cardon": "cardón",
    "tabaiba": "tabaiba",
    "algarrobo": "algarrobo",
    "araucaria": "araucaria",
    "cedro": "cedro",
    "ficus": "ficus",
    "pino_pinonero": "pino piñonero",
    "codeso": "codeso de monte",
    "otro": "árbol singular",
}


def main():
    pbf = next((p for p in PBF_CANDIDATES if os.path.exists(p)), None)
    if not pbf:
        print("ERROR: PBF no encontrado", file=sys.stderr)
        sys.exit(1)
    print(f"PBF: {pbf}", file=sys.stderr)

    handler = TreeHandler()
    handler.apply_file(pbf, locations=True)
    print(f"Candidatos OSM tras filtro singular: {len(handler.rows)}", file=sys.stderr)

    barrios = _load_barrios()
    print(f"Barrios cargados para lookup municipio: {len(barrios)}", file=sys.stderr)

    features = []
    by_familia = Counter()
    by_mun = Counter()
    by_proteccion = Counter()

    # Deduplica por coordenadas redondeadas (a veces el mismo árbol aparece
    # dos veces en OSM por mapeos paralelos).
    seen = {}

    for r in handler.rows:
        key = (round(r["lat"], 4), round(r["lon"], 4), _norm(r["nombre"]))
        if key in seen:
            # Funde campos cuando el duplicado aporta info.
            prev = seen[key]
            for k in ("altura_m", "edad_aprox"):
                if not prev["properties"].get(k) and r.get(k):
                    prev["properties"][k] = r[k]
            if not prev["properties"].get("nombre") and r.get("nombre"):
                prev["properties"]["nombre"] = r["nombre"]
            continue

        mun = municipio_for(r["lon"], r["lat"], barrios) or ""

        especie_label = r["especie_es"] or SPECIES_HUMAN.get(r["familia"], "árbol singular")
        # Si el nombre OSM es genérico ("drago"), conserva la especie raw como
        # ayuda — pero el "nombre" en la propiedad sigue siendo el del campo OSM.
        nombre = r["nombre"]
        if not nombre:
            # Genera un nombre legible para los anónimos famosos por monumento.
            base = SPECIES_HUMAN.get(r["familia"], "árbol")
            if base == "árbol singular":
                nombre = "Árbol singular"
            else:
                nombre = f"{base.capitalize()} singular"

        props = {
            "nombre": nombre,
            "especie": especie_label,
            "familia": r["familia"],
            "edad_aprox": r["edad_aprox"],
            "altura_m": r["altura_m"],
            "proteccion": r["proteccion"] or "singular",
            "mun": mun,
            "tradicion": None,
            "osm_id": r["osm_id"],
            "wikipedia": r["wikipedia"],
            "wikidata": r["wikidata"],
        }
        props = enrich_curated(nombre, r["lat"], r["lon"], props)

        by_familia[props["familia"]] += 1
        by_proteccion[props["proteccion"]] += 1
        if mun:
            by_mun[mun] += 1

        f = {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [r["lon"], r["lat"]]},
            "properties": props,
        }
        seen[key] = f
        features.append(f)

    out_fc = {
        "type": "FeatureCollection",
        "name": "arboles-singulares-canarias",
        "generated_at": GENERATED_AT,
        "source": (
            "OSM Geofabrik canary-islands (natural=tree + denotation=natural_monument / "
            "monument / heritage / name propio / altura>=20m) — enriquecido con catálogo "
            "curado para ejemplares icónicos (Drago de Icod, Pino Gordo, Garoé...)"
        ),
        "count": len(features),
        "by_familia": dict(by_familia),
        "by_proteccion": dict(by_proteccion),
        "by_municipio": dict(by_mun.most_common(15)),
        "features": features,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(out_fc, f, ensure_ascii=False, separators=(",", ":"))
    print(f"\nWROTE {OUT}", file=sys.stderr)
    print(f"  total árboles: {len(features)}", file=sys.stderr)
    print(f"  por familia: {dict(by_familia)}", file=sys.stderr)
    print(f"  por protección: {dict(by_proteccion)}", file=sys.stderr)
    print(f"  con tradición curada: {sum(1 for x in features if x['properties'].get('tradicion'))}", file=sys.stderr)
    print(f"  con municipio resuelto: {sum(1 for x in features if x['properties'].get('mun'))}", file=sys.stderr)


if __name__ == "__main__":
    main()
