#!/usr/bin/env python3
"""
extract-centros-salud.py — Indicador SAL-01: red FÍSICA de centros de
Atención Primaria + resto de equipamientos sanitarios del SCS y privados
en Canarias. Genera public/data/centros-salud-canarias.geojson.

Las fuentes oficiales del SCS no exponen un dataset descargable directo
y accesible (la URL https://www3.gobiernodecanarias.org/sanidad/scs/centro
devuelve 404; IDECanarias requiere autenticación o WFS específico). Como
fallback validado por el brief, extraemos del PBF Geofabrik (canary-islands).
La cobertura sanitaria pública en OSM Canarias suele ser buena — centros
de salud, consultorios, hospitales públicos y privados, urgencias, y
clínicas especializadas están tageados con `amenity=clinic|doctors|hospital`
+ `healthcare=*`.

Tags OSM cubiertos y categorías destino:
  amenity=hospital  + healthcare=hospital  → HOSPITAL  (H+ rojo)
  amenity=clinic    + healthcare=clinic    → AP        (centro AP / centro de salud)
  amenity=doctors   + healthcare=doctors   → AP        (consulta médica)
  healthcare=centre|centro_de_salud        → AP
  healthcare=consultorio                   → CSO       (consultorio local)
  emergency=yes  o  healthcare=emergency   → URGENCIAS
  healthcare=physiotherapist|psychotherapist|optometrist|...
                                            → ESPECIALIZADO

Heurística para AP vs CSO:
  - Si name contiene "Centro de Salud" o "C.S." → AP
  - Si name contiene "Consultorio" → CSO
  - Si tag healthcare=consultorio → CSO
  - amenity=clinic puro sin OTROS hints → AP (es el caso típico SCS)
  - Si operator contiene "Servicio Canario de Salud"/"SCS" → AP/CSO según nombre
  - private:yes  o  operator privado conocido (Hospiten/Vithas/etc) → mantenemos
    pero los marcamos con properties.publico=false

Salida: FeatureCollection. Cada feature:
  {
    type: "Feature",
    geometry: { type: "Point", coordinates: [lng, lat] },
    properties: {
      nombre, tipo, especialidades, mun, telefono, horario,
      publico (bool|null), operator, website, osm_id, wheelchair
    }
  }
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
OUT = f"{ROOT}/public/data/centros-salud-canarias.geojson"

# Bbox Canarias: lng [-18.2, -13.3], lat [27.5, 29.5]
BBOX = (-18.2, 27.5, -13.3, 29.5)

# Categorías destino (alineadas con el brief).
CAT_AP        = "centro_atencion_primaria"
CAT_CSO       = "consultorio_local"
CAT_HOSPITAL  = "hospital"
CAT_URGENCIAS = "urgencias"
CAT_ESPEC     = "especializado"

# Operadores que asumimos privados (no exhaustivo — el resto se infiere).
PRIVATE_OPERATORS_RE = re.compile(
    r"hospiten|vithas|quir[oó]nsalud|quir[oó]n\s+salud|sanitas|asisa|"
    r"perpetuo\s+socorro|hospital\s+san\s+rom[aá]n|hospiten|imed|"
    r"hospital\s+la\s+colina|hospital\s+santa\s+catalina",
    re.IGNORECASE
)

# Especialidades reconocidas (healthcare:speciality / healthcare).
SPECIALTY_KEYWORDS = {
    "physiotherapist":  "fisioterapia",
    "psychotherapist":  "psicoterapia",
    "psychiatry":       "psiquiatría",
    "psychologist":     "psicología",
    "optometrist":      "optometría",
    "dentist":          "odontología",
    "ophthalmologist":  "oftalmología",
    "rehabilitation":   "rehabilitación",
    "podiatrist":       "podología",
    "midwife":          "matrona",
    "nutrition_counselling": "nutrición",
    "speech_therapist": "logopedia",
    "geriatrics":       "geriatría",
    "paediatrics":      "pediatría",
    "gynaecology":      "ginecología",
    "cardiology":       "cardiología",
    "dermatology":      "dermatología",
    "radiology":        "radiología",
}


def _infer_publico(tags):
    """Devuelve True/False/None — None si no se puede inferir."""
    op = (tags.get("operator") or "").strip()
    if op:
        if PRIVATE_OPERATORS_RE.search(op):
            return False
        if re.search(r"servicio\s+canario\s+de\s+salud|^\s*SCS\b|gobierno\s+de\s+canarias",
                     op, re.IGNORECASE):
            return True
    op_type = (tags.get("operator:type") or "").strip().lower()
    if op_type in ("public", "government"):
        return True
    if op_type in ("private", "commercial"):
        return False
    name = (tags.get("name") or "").lower()
    if re.search(r"centro\s+de\s+salud\b|consultorio\b|c\.\s*s\.\s", name):
        return True
    if PRIVATE_OPERATORS_RE.search(name):
        return False
    return None


def _especialidades(tags):
    """Lista de especialidades inferidas de tags healthcare:*."""
    out = set()
    # healthcare:speciality puede ser ; separado
    for key in ("healthcare:speciality", "healthcare:speciality:en"):
        v = tags.get(key)
        if v:
            for token in re.split(r"[;,]", v):
                t = token.strip().lower()
                if not t:
                    continue
                out.add(SPECIALTY_KEYWORDS.get(t, t))
    # Si healthcare es una especialidad directa
    hc = tags.get("healthcare")
    if hc and hc in SPECIALTY_KEYWORDS:
        out.add(SPECIALTY_KEYWORDS[hc])
    return sorted(out)


def _es_urgencias(tags):
    if tags.get("emergency") == "yes":
        return True
    hc = tags.get("healthcare")
    if hc in ("emergency", "emergency_ward", "urgent_care"):
        return True
    name = (tags.get("name") or "").lower()
    if re.search(r"\burgencias\b|punto\s+de\s+atenci[oó]n\s+continua|\bpac\b", name):
        return True
    return False


def _clasifica(tags):
    """Devuelve la categoría destino, o None si no es sanitario relevante."""
    amenity = tags.get("amenity")
    healthcare = tags.get("healthcare")
    name_lc = (tags.get("name") or "").lower()

    # Descartar veterinarios antes de cualquier otra heurística (emergency=yes
    # en una vet 24h se nos colaba como "urgencias").
    if amenity == "veterinary" or healthcare == "veterinary":
        return None
    if "veterinari" in name_lc:
        return None

    if _es_urgencias(tags):
        return CAT_URGENCIAS

    if amenity == "hospital" or healthcare == "hospital":
        return CAT_HOSPITAL

    # Especializado: healthcare en lista de especialidades reconocidas
    if healthcare and healthcare in SPECIALTY_KEYWORDS:
        return CAT_ESPEC
    # amenity=dentist u otros similares
    if amenity in ("dentist", "veterinary"):
        # veterinary no es para humanos — descartamos
        if amenity == "veterinary":
            return None
        return CAT_ESPEC

    # Consultorio local
    if healthcare == "consultorio" or "consultorio" in name_lc:
        return CAT_CSO

    # AP / centro de salud
    if "centro de salud" in name_lc or re.search(r"\bc\.?\s*s\.\b", name_lc):
        return CAT_AP
    if healthcare in ("centre", "centro_de_salud"):
        return CAT_AP
    if amenity == "clinic" or healthcare == "clinic":
        # Si OSM dice clinic y no hay nada más → asumimos AP (caso SCS típico).
        return CAT_AP
    if amenity == "doctors" or healthcare == "doctors":
        # médicos generalistas — los tratamos como AP también; si en realidad
        # son consulta privada el operador privado lo marcará en _infer_publico.
        return CAT_AP

    # Healthcare="yes" genérico → especializado por defecto
    if healthcare == "yes":
        return CAT_ESPEC

    return None


class Extractor(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.features = []
        self.counts = defaultdict(int)
        self.counts_pub = defaultdict(int)
        self.counts_priv = defaultdict(int)
        self._seen_ids = set()

    def _in_bbox(self, lon, lat):
        return BBOX[0] <= lon <= BBOX[2] and BBOX[1] <= lat <= BBOX[3]

    def _push(self, osm_id, lon, lat, tags):
        if osm_id in self._seen_ids:
            return
        if not self._in_bbox(lon, lat):
            return
        cat = _clasifica(tags)
        if not cat:
            return
        publico = _infer_publico(tags)
        nombre = tags.get("name") or tags.get("name:es") or ""
        mun = tags.get("addr:city") or tags.get("is_in:municipality") or ""
        feat = {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]},
            "properties": {
                "nombre": nombre,
                "tipo": cat,
                "especialidades": _especialidades(tags),
                "mun": mun,
                "telefono": tags.get("phone") or tags.get("contact:phone") or None,
                "horario": tags.get("opening_hours") or None,
                "publico": publico,
                "operator": tags.get("operator") or None,
                "website": tags.get("website") or tags.get("contact:website") or None,
                "wheelchair": tags.get("wheelchair") or None,
                "osm_id": osm_id,
            }
        }
        self.features.append(feat)
        self.counts[cat] += 1
        if publico is True:
            self.counts_pub[cat] += 1
        elif publico is False:
            self.counts_priv[cat] += 1
        self._seen_ids.add(osm_id)

    def node(self, n):
        tags = {t.k: t.v for t in n.tags}
        if not tags:
            return
        # Filtro temprano: ¿es candidato sanitario?
        if not (tags.get("amenity") in ("hospital", "clinic", "doctors", "dentist")
                or tags.get("healthcare")
                or tags.get("emergency") == "yes"):
            return
        try:
            lon, lat = n.location.lon, n.location.lat
        except osmium.InvalidLocationError:
            return
        self._push(f"node/{n.id}", lon, lat, tags)

    def area(self, a):
        tags = {t.k: t.v for t in a.tags}
        if not tags:
            return
        if not (tags.get("amenity") in ("hospital", "clinic", "doctors", "dentist")
                or tags.get("healthcare")
                or tags.get("emergency") == "yes"):
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
        # Identidad del area en osmium: si from_way, id() == way_id*2; mejor
        # usar un prefijo "area/" que evita colisiones con node/way.
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
        "name": "centros-salud-canarias",
        "indicator": "SAL-01",
        "generated_at": "2026-05-27",
        "source": "OSM Geofabrik canary-islands (fallback — SCS no expone dataset abierto)",
        "count": len(ex.features),
        "by_tipo": dict(ex.counts),
        "by_tipo_publico":  dict(ex.counts_pub),
        "by_tipo_privado":  dict(ex.counts_priv),
        "features": ex.features,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(out_fc, f, ensure_ascii=False, separators=(",", ":"))
    print(f"wrote {OUT} — {len(ex.features)} centros", file=sys.stderr)
    for cat in (CAT_AP, CAT_CSO, CAT_HOSPITAL, CAT_URGENCIAS, CAT_ESPEC):
        n = ex.counts.get(cat, 0)
        npub = ex.counts_pub.get(cat, 0)
        npriv = ex.counts_priv.get(cat, 0)
        print(f"  {cat:34s} total={n:4d}  pub={npub:4d}  priv={npriv:4d}",
              file=sys.stderr)


if __name__ == "__main__":
    main()
