#!/usr/bin/env python3
"""
extract-centros-civicos.py — Indicador TEJ-04 (Tejido cívico municipal):
Centros cívicos municipales + casas de juventud + centros de mayores +
centros de la mujer en Canarias.

Fuente principal: OSM PBF Geofabrik (canary-islands-latest.osm.pbf).
Las webs municipales y la capa "equipamientos sociales" de IDECanarias
son las fuentes que el catálogo OCRE referencia pero, igual que con
SAL-01, no exponen un dump descargable directo accesible; nos apoyamos
en el grafo OSM (que sí cubre la mayoría de los grandes muns: LPGC,
La Laguna, SC Tenerife, Telde, Arrecife, Puerto del Rosario, La Orotava,
Santa Lucía…) y completamos por heurística de nombre.

Tipos destino (alineado con el brief):
  civico    — Centro cívico municipal (community_centre genérico,
              "Centro Cívico", "Casa del Pueblo", "Casa Cultura")
  juventud  — Casa de juventud / Espacio joven
              (amenity=youth_centre, "Casa de la Juventud", "Espacio Joven")
  mayores   — Centro de mayores / 3ª edad / hogar del jubilado
              (social_facility=senior_centre|nursing_home|assisted_living)
  mujer     — Centro de la mujer / Casa de la mujer / Casa de igualdad
              (social_facility=women_centre, "Casa de la Mujer",
              "Centro de Igualdad", "C.I.E.M.")

Tags OSM cubiertos (filtro de entrada, luego desambigua por nombre):
  amenity=community_centre
  amenity=youth_centre
  amenity=social_centre
  amenity=social_facility
  social_facility=senior_centre|outreach|women_centre|group_home|...
  community_centre=youth_centre|senior|...

Salida: public/data/centros-civicos-canarias.geojson — FeatureCollection.
Cada feature:
  {
    type: "Feature",
    geometry: {type: "Point", coordinates: [lng, lat]},
    properties: {
      nombre, tipo, mun, horario, telefono,
      servicios, operator, website, wheelchair, osm_id
    }
  }

`servicios` se infiere de los tags description / community_centre:for /
social_facility:for cuando existen (lista). En la mayoría de casos vendrá
vacío — el dataset OSM no es exhaustivo en eso; la idea es que el
extractor lo soporte para cuando se completen.
"""

import json
import os
import re
import sys
from collections import defaultdict

import osmium

ROOT = "/Users/panch/KOINOS-iso"
PBF_CANDIDATES = [
    f"{ROOT}/GEOFABRIK/canary-islands-latest.osm.pbf",
    f"{ROOT}/GEOFABRIK/canary-islands-260410.osm.pbf",
]
OUT = f"{ROOT}/public/data/centros-civicos-canarias.geojson"

# Bbox Canarias: lng [-18.2, -13.3], lat [27.5, 29.5]
BBOX = (-18.2, 27.5, -13.3, 29.5)

# Tipos destino.
T_CIVICO   = "civico"
T_JUVENTUD = "juventud"
T_MAYORES  = "mayores"
T_MUJER    = "mujer"

# Regex de desambiguación por nombre — castellano, con tolerancia a
# mayúsculas, acentos opcionales y abreviaturas comunes en rótulos
# municipales canarios.
RE_JUVENTUD = re.compile(
    r"\b(casa\s+(de\s+)?(la\s+)?juventud|espacio\s+joven|"
    r"centro\s+(de\s+)?juventud|c\.?\s*juventud|"
    r"oficina\s+(de\s+)?(la\s+)?juventud|"
    r"sala\s+joven|aula\s+joven)\b",
    re.IGNORECASE,
)
RE_MAYORES = re.compile(
    r"\b(centro\s+(de\s+)?(d[ií]a\s+(de\s+)?)?mayores|"
    r"hogar\s+(del\s+)?(jubilado|pensionista|mayor)|"
    r"club\s+(de\s+)?mayores|"
    r"residencia\s+(de\s+)?mayores|"
    r"casa\s+(de\s+)?(los\s+)?mayores|"
    r"asociaci[oó]n\s+(de\s+)?mayores|"
    r"3[aª]?\s+edad)\b",
    re.IGNORECASE,
)
RE_MUJER = re.compile(
    r"\b(casa\s+(de\s+)?(la\s+)?mujer|"
    r"centro\s+(de\s+)?(la\s+)?mujer|"
    r"centro\s+(de\s+)?igualdad|"
    r"c\.?\s*i\.?\s*e\.?\s*m\.?|"
    r"oficina\s+(de\s+)?igualdad|"
    r"servicio\s+(de\s+)?(la\s+)?mujer)\b",
    re.IGNORECASE,
)
RE_CIVICO = re.compile(
    r"\b(centro\s+c[ií]vico|"
    r"casa\s+(de\s+la\s+)?cultura|"
    r"casa\s+(del\s+)?pueblo|"
    r"local\s+social|"
    r"sal[oó]n\s+social|"
    r"telecentro|"
    r"casa\s+(de\s+)?vecinos)\b",
    re.IGNORECASE,
)

# social_facility:for / community_centre:for valores → tipo destino.
SF_FOR_MAP = {
    "senior":      T_MAYORES,
    "senior_citizens": T_MAYORES,
    "elderly":     T_MAYORES,
    "juvenile":    T_JUVENTUD,
    "child":       T_JUVENTUD,
    "youth":       T_JUVENTUD,
    "women":       T_MUJER,
    "woman":       T_MUJER,
    "abused_women": T_MUJER,
}

# Filtro de entrada — qué tags hacen que un POI sea candidato.
def _es_candidato(tags):
    amenity = tags.get("amenity")
    if amenity in ("community_centre", "youth_centre", "social_centre"):
        return True
    if amenity == "social_facility":
        return True
    if tags.get("social_facility"):
        return True
    if tags.get("community_centre"):
        return True
    # Nombres muy explícitos pueden venir sin amenity (raro pero existe).
    name = (tags.get("name") or "") + " " + (tags.get("name:es") or "")
    if (RE_JUVENTUD.search(name) or RE_MAYORES.search(name)
            or RE_MUJER.search(name) or RE_CIVICO.search(name)):
        return True
    return False


def _clasifica(tags):
    """Devuelve uno de los 4 tipos destino, o None si no es relevante."""
    name = (tags.get("name") or tags.get("name:es") or "").strip()
    amenity = tags.get("amenity")
    sf      = (tags.get("social_facility") or "").strip().lower()
    sf_for  = (tags.get("social_facility:for") or "").strip().lower()
    cc      = (tags.get("community_centre") or "").strip().lower()
    cc_for  = (tags.get("community_centre:for") or "").strip().lower()

    # 1) amenity=youth_centre → juventud directo
    if amenity == "youth_centre":
        return T_JUVENTUD

    # 2) social_facility=women_centre → mujer
    if sf in ("women_centre", "outreach;women_centre"):
        return T_MUJER
    # 3) social_facility=senior_centre|nursing_home|assisted_living|group_home(senior)
    if sf in ("senior_centre", "nursing_home", "assisted_living"):
        return T_MAYORES
    if sf == "group_home" and sf_for in ("senior", "elderly", "senior_citizens"):
        return T_MAYORES

    # 4) community_centre=youth_centre / senior → tipo por sub-tag
    for tok in re.split(r"[;,]", cc + " " + sf):
        tok = tok.strip().lower()
        if not tok:
            continue
        if tok in ("youth_centre", "youth"):
            return T_JUVENTUD
        if tok in ("senior", "senior_citizens", "elderly"):
            return T_MAYORES
        if tok in ("women", "women_centre"):
            return T_MUJER

    # 5) :for tags
    for raw in (sf_for, cc_for):
        for tok in re.split(r"[;,]", raw):
            tok = tok.strip().lower()
            if tok in SF_FOR_MAP:
                return SF_FOR_MAP[tok]

    # 6) Desambiguación por nombre (regex en orden de especificidad —
    #    juventud/mayores/mujer antes que cívico, para no “tragárselos”
    #    con "Centro Cívico de Mayores").
    if name:
        if RE_JUVENTUD.search(name):
            return T_JUVENTUD
        if RE_MAYORES.search(name):
            return T_MAYORES
        if RE_MUJER.search(name):
            return T_MUJER
        if RE_CIVICO.search(name):
            return T_CIVICO

    # 7) Caso por defecto — amenity=community_centre / social_centre sin
    #    desambiguación de público objetivo → centro cívico genérico.
    if amenity in ("community_centre", "social_centre"):
        return T_CIVICO

    return None


def _servicios(tags):
    """Lista de servicios inferidos. La mayoría de tags OSM no lo expresan
    explícitamente — devolvemos lo que haya."""
    out = []
    for key in ("description", "community_centre:for", "social_facility:for",
                "service", "services"):
        v = tags.get(key)
        if not v:
            continue
        for token in re.split(r"[;,]", v):
            t = token.strip()
            if t and t not in out:
                out.append(t)
    return out


def _mun(tags):
    return (tags.get("addr:city")
            or tags.get("is_in:municipality")
            or tags.get("is_in:town")
            or "")


class Extractor(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.features = []
        self.counts = defaultdict(int)
        self._seen_ids = set()

    def _in_bbox(self, lon, lat):
        return BBOX[0] <= lon <= BBOX[2] and BBOX[1] <= lat <= BBOX[3]

    def _push(self, osm_id, lon, lat, tags):
        if osm_id in self._seen_ids:
            return
        if not self._in_bbox(lon, lat):
            return
        tipo = _clasifica(tags)
        if not tipo:
            return
        nombre = tags.get("name") or tags.get("name:es") or ""
        feat = {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]},
            "properties": {
                "nombre": nombre,
                "tipo": tipo,
                "mun": _mun(tags),
                "horario": tags.get("opening_hours") or None,
                "telefono": tags.get("phone") or tags.get("contact:phone") or None,
                "servicios": _servicios(tags),
                "operator": tags.get("operator") or None,
                "website": tags.get("website") or tags.get("contact:website") or None,
                "wheelchair": tags.get("wheelchair") or None,
                "osm_id": osm_id,
            }
        }
        self.features.append(feat)
        self.counts[tipo] += 1
        self._seen_ids.add(osm_id)

    def node(self, n):
        tags = {t.k: t.v for t in n.tags}
        if not tags or not _es_candidato(tags):
            return
        try:
            lon, lat = n.location.lon, n.location.lat
        except osmium.InvalidLocationError:
            return
        self._push(f"node/{n.id}", lon, lat, tags)

    def area(self, a):
        tags = {t.k: t.v for t in a.tags}
        if not tags or not _es_candidato(tags):
            return
        try:
            outer = next(iter(a.outer_rings()), None)
            if outer is None:
                return
            xs, ys = [], []
            for pt in outer:
                xs.append(pt.lon)
                ys.append(pt.lat)
            if not xs:
                return
            lon = sum(xs) / len(xs)
            lat = sum(ys) / len(ys)
        except (osmium.InvalidLocationError, Exception):
            return
        self._push(f"area/{a.id}", lon, lat, tags)


def main():
    pbf = next((p for p in PBF_CANDIDATES if os.path.exists(p)), None)
    if not pbf:
        print("ERROR: PBF no encontrado en", PBF_CANDIDATES, file=sys.stderr)
        sys.exit(1)
    print(f"PBF: {pbf}", file=sys.stderr)

    ex = Extractor()
    ex.apply_file(pbf, locations=True)

    out_fc = {
        "type": "FeatureCollection",
        "name": "centros-civicos-canarias",
        "indicator": "TEJ-04",
        "generated_at": "2026-05-27",
        "source": "OSM Geofabrik canary-islands (fallback — webs municipales y IDECanarias 'equipamientos sociales' no expuestos como dump abierto)",
        "count": len(ex.features),
        "by_tipo": dict(ex.counts),
        "features": ex.features,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(out_fc, f, ensure_ascii=False, separators=(",", ":"))
    print(f"wrote {OUT} — {len(ex.features)} centros", file=sys.stderr)
    for tipo in (T_CIVICO, T_JUVENTUD, T_MAYORES, T_MUJER):
        n = ex.counts.get(tipo, 0)
        print(f"  {tipo:10s} {n:4d}", file=sys.stderr)


if __name__ == "__main__":
    main()
