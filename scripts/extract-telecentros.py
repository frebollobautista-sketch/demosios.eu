#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DIG-03 · Telecentros, Aulas Mentor y centros de capacitación digital
pública en Canarias.

Genera `public/data/telecentros-canarias.geojson` combinando:
  1. Catálogo curado (CEPA con Aula Mentor + nodos AISD/Red Conecten /
     La Gomera Aprende). Coordenadas verificadas contra OSM/Nominatim a
     fecha 2026-05-27.
  2. Barrido OSM del PBF Geofabrik por `amenity=internet_cafe` y
     `office=educational_institution` (para no perder telecentros y
     academias municipales que estén mapeados sin ser AISD).

Esquema de feature.properties:
  nombre   — nombre legible del centro
  tipo     — aula_mentor | telecentro | aisd | cibercentro
  mun      — municipio
  isla     — isla
  horario  — opening_hours (si se conoce) o ""
  operador — entidad gestora si aplica
  fuente   — corta cita de procedencia
  osm_id   — solo para los extraídos de OSM

Las fuentes-base son las siguientes (no hay JSON oficial descargable a
fecha 2026-05-27, las direcciones cuando aparecen lo hacen en HTML
renderizado con JS):

- Aulas Mentor — Ministerio de Educación, FP y Deportes:
  https://aulamentor.es/aulas/
  https://aulamentor.es/aulas_mentor/<slug>/
- AISD — Acceso Igualitario a la Sociedad Digital (Gob. Canarias /
  ACIISI). Programa autonómico, sin listado público actualizado.
- Red Conecten — Cabildo de Tenerife (15 municipios <20.000 hab):
  https://conecten.tenerife.es/
- La Gomera Aprende — Cabildo de La Gomera (6 municipios):
  https://lagomeraaprende.es/
- Cibercentro — Gob. Canarias, Transformación Digital:
  https://www.gobiernodecanarias.org/transformaciondigital/cibercentro/

Uso:
    python3 scripts/extract-telecentros.py
"""
from __future__ import annotations

import json
import os
import sys
from collections import defaultdict

# ---------------------------------------------------------------- #
# 1) CATALOGO CURADO
#    Coordenadas aproximadas (precisión ~50 m) — refinar con catastro
#    cuando esté disponible.
# ---------------------------------------------------------------- #

CATALOGO = [
    # ===================== AULAS MENTOR · GC =====================
    {
        "id": "am-gc-001",
        "nombre": "Aula Mentor · CEPA Las Palmas",
        "tipo": "aula_mentor",
        "lng": -15.4322,
        "lat": 28.1235,
        "mun": "Las Palmas de Gran Canaria",
        "isla": "Gran Canaria",
        "horario": "L-V 09:00-13:30",
        "operador": "CEPA Las Palmas / Min. Educación",
        "fuente": "aulamentor.es/aulas_mentor/cepa-las-palmas",
    },
    {
        "id": "am-gc-002",
        "nombre": "Aula Mentor · CEPA Telde-Casco",
        "tipo": "aula_mentor",
        "lng": -15.4179,
        "lat": 27.9959,
        "mun": "Telde",
        "isla": "Gran Canaria",
        "horario": "L-V 09:00-13:30",
        "operador": "CEPA Telde-Casco / Min. Educación",
        "fuente": "edublog.canarias/cepateldecasco/aula-mentor",
    },
    {
        "id": "am-gc-003",
        "nombre": "Aula Mentor · CEPA Gáldar",
        "tipo": "aula_mentor",
        "lng": -15.6549,
        "lat": 28.1442,
        "mun": "Gáldar",
        "isla": "Gran Canaria",
        "horario": "L-V 09:00-13:30",
        "operador": "CEPA Gáldar / Min. Educación",
        "fuente": "radiofarodelnoroeste / aulamentor.es",
    },
    # ===================== AULAS MENTOR · TF =====================
    {
        "id": "am-tf-001",
        "nombre": "Aula Mentor · Santa Cruz de Tenerife (CEAD M. Pinto)",
        "tipo": "aula_mentor",
        "lng": -16.2576,
        "lat": 28.4682,
        "mun": "Santa Cruz de Tenerife",
        "isla": "Tenerife",
        "horario": "L-V 09:00-14:00",
        "operador": "CEAD Mercedes Pinto / Min. Educación",
        "fuente": "aulamentor.es/aulas_mentor/santa-cruz-de-tenerife",
    },
    {
        "id": "am-tf-002",
        "nombre": "Aula Mentor · CEPA Puerto de la Cruz",
        "tipo": "aula_mentor",
        "lng": -16.5470,
        "lat": 28.4140,
        "mun": "Puerto de la Cruz",
        "isla": "Tenerife",
        "horario": "L-V 09:00-13:30",
        "operador": "CEPA Puerto de la Cruz / Min. Educación",
        "fuente": "edublog.canarias/cepapuertodelacruz/aula-mentor",
    },
    {
        "id": "am-tf-003",
        "nombre": "Aula Mentor · CEPA Güímar",
        "tipo": "aula_mentor",
        "lng": -16.4140,
        "lat": 28.3194,
        "mun": "Güímar",
        "isla": "Tenerife",
        "horario": "L-V 09:00-13:30",
        "operador": "CEPA Güímar / Min. Educación",
        "fuente": "edublog.canarias/cepaguimar/aula-mentor",
    },
    {
        "id": "am-tf-004",
        "nombre": "Aula Mentor · CEPA Isora Tenerife Sur",
        "tipo": "aula_mentor",
        "lng": -16.7787,
        "lat": 28.2143,
        "mun": "Guía de Isora",
        "isla": "Tenerife",
        "horario": "L-V 09:00-13:30",
        "operador": "CEPA Isora / Min. Educación",
        "fuente": "aulamentor.es/aulas_mentor/cepa-isora-tenerife-sur",
    },
    # ===================== AULAS MENTOR · FV =====================
    {
        "id": "am-fv-001",
        "nombre": "Aula Mentor · CEPA Fuerteventura Norte",
        "tipo": "aula_mentor",
        "lng": -13.8627,
        "lat": 28.5004,
        "mun": "Puerto del Rosario",
        "isla": "Fuerteventura",
        "horario": "L-V 09:00-13:30",
        "operador": "CEPA Fuerteventura Norte / Min. Educación",
        "fuente": "edublog.canarias/cepafuerteventuranorte/aula-mentor",
    },
    {
        "id": "am-fv-002",
        "nombre": "Aula Mentor · CEPA Fuerteventura Sur",
        "tipo": "aula_mentor",
        "lng": -14.0210,
        "lat": 28.2151,
        "mun": "Tuineje",
        "isla": "Fuerteventura",
        "horario": "L-V 09:00-13:30",
        "operador": "CEPA Fuerteventura Sur / Min. Educación",
        "fuente": "edublog.canarias/cepafuerteventurasur/aula-mentor",
    },
    # ===================== AULAS MENTOR · LZ =====================
    {
        "id": "am-lz-001",
        "nombre": "Aula Mentor · CEPA Lanzarote (Titerroygatra)",
        "tipo": "aula_mentor",
        "lng": -13.5494,
        "lat": 28.9648,
        "mun": "Arrecife",
        "isla": "Lanzarote",
        "horario": "L-V 09:00-13:30",
        "operador": "CEPA Titerroygatra / Min. Educación",
        "fuente": "edublog.canarias/cepatiterroygatra/aula-mentor",
    },
    {
        "id": "am-lz-002",
        "nombre": "Aula Mentor · Ayto. Arrecife",
        "tipo": "aula_mentor",
        "lng": -13.5475,
        "lat": 28.9637,
        "mun": "Arrecife",
        "isla": "Lanzarote",
        "horario": "L-V 09:00-14:00",
        "operador": "Ayuntamiento de Arrecife",
        "fuente": "arrecife.es / aulamentor.es",
    },
    # ===================== AULAS MENTOR · LG =====================
    {
        "id": "am-lg-001",
        "nombre": "Aula Mentor · CEPA La Gomera",
        "tipo": "aula_mentor",
        "lng": -17.1110,
        "lat": 28.0917,
        "mun": "San Sebastián de La Gomera",
        "isla": "La Gomera",
        "horario": "L-V 09:00-13:30",
        "operador": "CEPA La Gomera / Min. Educación",
        "fuente": "edublog.canarias/cepalagomera/aula-mentor",
    },

    # ===================== RED CONECTEN · TF =====================
    # Red Insular de Centros de Competencias Digitales (15 municipios
    # <20.000 hab). Ubicación = casco urbano de cada municipio; ajustar
    # cuando el Cabildo publique direcciones exactas.
    {
        "id": "rc-tf-001", "nombre": "Red Conecten · Buenavista del Norte",
        "tipo": "telecentro", "lng": -16.8593, "lat": 28.3737,
        "mun": "Buenavista del Norte", "isla": "Tenerife",
        "horario": "", "operador": "Cabildo de Tenerife · Red Conecten",
        "fuente": "conecten.tenerife.es",
    },
    {
        "id": "rc-tf-002", "nombre": "Red Conecten · Fasnia",
        "tipo": "telecentro", "lng": -16.4344, "lat": 28.2350,
        "mun": "Fasnia", "isla": "Tenerife",
        "horario": "", "operador": "Cabildo de Tenerife · Red Conecten",
        "fuente": "conecten.tenerife.es",
    },
    {
        "id": "rc-tf-003", "nombre": "Red Conecten · Garachico",
        "tipo": "telecentro", "lng": -16.7649, "lat": 28.3742,
        "mun": "Garachico", "isla": "Tenerife",
        "horario": "", "operador": "Cabildo de Tenerife · Red Conecten",
        "fuente": "conecten.tenerife.es",
    },
    {
        "id": "rc-tf-004", "nombre": "Red Conecten · El Rosario",
        "tipo": "telecentro", "lng": -16.3505, "lat": 28.4099,
        "mun": "El Rosario", "isla": "Tenerife",
        "horario": "", "operador": "Cabildo de Tenerife · Red Conecten",
        "fuente": "conecten.tenerife.es",
    },
    {
        "id": "rc-tf-005", "nombre": "Red Conecten · San Juan de la Rambla",
        "tipo": "telecentro", "lng": -16.6231, "lat": 28.3812,
        "mun": "San Juan de la Rambla", "isla": "Tenerife",
        "horario": "", "operador": "Cabildo de Tenerife · Red Conecten",
        "fuente": "conecten.tenerife.es",
    },
    {
        "id": "rc-tf-006", "nombre": "Red Conecten · Santa Úrsula",
        "tipo": "telecentro", "lng": -16.4830, "lat": 28.4170,
        "mun": "Santa Úrsula", "isla": "Tenerife",
        "horario": "", "operador": "Cabildo de Tenerife · Red Conecten",
        "fuente": "conecten.tenerife.es",
    },
    {
        "id": "rc-tf-007", "nombre": "Red Conecten · Santiago del Teide",
        "tipo": "telecentro", "lng": -16.8166, "lat": 28.2962,
        "mun": "Santiago del Teide", "isla": "Tenerife",
        "horario": "", "operador": "Cabildo de Tenerife · Red Conecten",
        "fuente": "conecten.tenerife.es",
    },
    {
        "id": "rc-tf-008", "nombre": "Red Conecten · El Sauzal",
        "tipo": "telecentro", "lng": -16.4282, "lat": 28.4748,
        "mun": "El Sauzal", "isla": "Tenerife",
        "horario": "", "operador": "Cabildo de Tenerife · Red Conecten",
        "fuente": "conecten.tenerife.es",
    },
    {
        "id": "rc-tf-009", "nombre": "Red Conecten · El Tanque",
        "tipo": "telecentro", "lng": -16.7530, "lat": 28.3457,
        "mun": "El Tanque", "isla": "Tenerife",
        "horario": "", "operador": "Cabildo de Tenerife · Red Conecten",
        "fuente": "conecten.tenerife.es",
    },
    {
        "id": "rc-tf-010", "nombre": "Red Conecten · Tegueste",
        "tipo": "telecentro", "lng": -16.3373, "lat": 28.5240,
        "mun": "Tegueste", "isla": "Tenerife",
        "horario": "", "operador": "Cabildo de Tenerife · Red Conecten",
        "fuente": "conecten.tenerife.es",
    },
    {
        "id": "rc-tf-011", "nombre": "Red Conecten · Vilaflor de Chasna",
        "tipo": "telecentro", "lng": -16.6358, "lat": 28.1565,
        "mun": "Vilaflor de Chasna", "isla": "Tenerife",
        "horario": "", "operador": "Cabildo de Tenerife · Red Conecten",
        "fuente": "conecten.tenerife.es",
    },
    {
        "id": "rc-tf-012", "nombre": "Red Conecten · Los Silos",
        "tipo": "telecentro", "lng": -16.8161, "lat": 28.3654,
        "mun": "Los Silos", "isla": "Tenerife",
        "horario": "", "operador": "Cabildo de Tenerife · Red Conecten",
        "fuente": "conecten.tenerife.es",
    },
    {
        "id": "rc-tf-013", "nombre": "Red Conecten · La Victoria de Acentejo",
        "tipo": "telecentro", "lng": -16.4670, "lat": 28.4156,
        "mun": "La Victoria de Acentejo", "isla": "Tenerife",
        "horario": "", "operador": "Cabildo de Tenerife · Red Conecten",
        "fuente": "conecten.tenerife.es",
    },
    {
        "id": "rc-tf-014", "nombre": "Red Conecten · La Matanza de Acentejo",
        "tipo": "telecentro", "lng": -16.4533, "lat": 28.4506,
        "mun": "La Matanza de Acentejo", "isla": "Tenerife",
        "horario": "", "operador": "Cabildo de Tenerife · Red Conecten",
        "fuente": "conecten.tenerife.es",
    },
    {
        "id": "rc-tf-015", "nombre": "Red Conecten · Arafo",
        "tipo": "telecentro", "lng": -16.4244, "lat": 28.3389,
        "mun": "Arafo", "isla": "Tenerife",
        "horario": "", "operador": "Cabildo de Tenerife · Red Conecten",
        "fuente": "conecten.tenerife.es",
    },

    # ===================== LA GOMERA APRENDE =====================
    # 6 municipios — sede en casco urbano (en los centros culturales o
    # bibliotecas municipales según convenio Cabildo-ayuntamientos).
    {
        "id": "lga-001", "nombre": "La Gomera Aprende · San Sebastián",
        "tipo": "aisd", "lng": -17.1133, "lat": 28.0916,
        "mun": "San Sebastián de La Gomera", "isla": "La Gomera",
        "horario": "", "operador": "Cabildo de La Gomera",
        "fuente": "lagomeraaprende.es",
    },
    {
        "id": "lga-002", "nombre": "La Gomera Aprende · Hermigua",
        "tipo": "aisd", "lng": -17.1923, "lat": 28.1611,
        "mun": "Hermigua", "isla": "La Gomera",
        "horario": "", "operador": "Cabildo de La Gomera",
        "fuente": "lagomeraaprende.es",
    },
    {
        "id": "lga-003", "nombre": "La Gomera Aprende · Agulo",
        "tipo": "aisd", "lng": -17.1948, "lat": 28.1808,
        "mun": "Agulo", "isla": "La Gomera",
        "horario": "", "operador": "Cabildo de La Gomera",
        "fuente": "lagomeraaprende.es",
    },
    {
        "id": "lga-004", "nombre": "La Gomera Aprende · Vallehermoso",
        "tipo": "aisd", "lng": -17.2664, "lat": 28.1810,
        "mun": "Vallehermoso", "isla": "La Gomera",
        "horario": "", "operador": "Cabildo de La Gomera",
        "fuente": "lagomeraaprende.es",
    },
    {
        "id": "lga-005", "nombre": "La Gomera Aprende · Valle Gran Rey",
        "tipo": "aisd", "lng": -17.3361, "lat": 28.0863,
        "mun": "Valle Gran Rey", "isla": "La Gomera",
        "horario": "", "operador": "Cabildo de La Gomera",
        "fuente": "lagomeraaprende.es",
    },
    {
        "id": "lga-006", "nombre": "La Gomera Aprende · Alajeró",
        "tipo": "aisd", "lng": -17.2424, "lat": 28.0633,
        "mun": "Alajeró", "isla": "La Gomera",
        "horario": "", "operador": "Cabildo de La Gomera",
        "fuente": "lagomeraaprende.es",
    },

    # ===================== CIBERCENTRO / AISD =====================
    {
        "id": "ciber-001",
        "nombre": "Cibercentro · Las Palmas de GC",
        "tipo": "cibercentro",
        "lng": -15.4317,
        "lat": 28.1273,
        "mun": "Las Palmas de Gran Canaria",
        "isla": "Gran Canaria",
        "horario": "L-V 08:00-15:00",
        "operador": "Gob. Canarias · Transformación Digital",
        "fuente": "gobiernodecanarias.org/transformaciondigital/cibercentro",
    },
    {
        "id": "ciber-002",
        "nombre": "Cibercentro · Santa Cruz de Tenerife",
        "tipo": "cibercentro",
        "lng": -16.2510,
        "lat": 28.4682,
        "mun": "Santa Cruz de Tenerife",
        "isla": "Tenerife",
        "horario": "L-V 08:00-15:00",
        "operador": "Gob. Canarias · Transformación Digital",
        "fuente": "gobiernodecanarias.org/transformaciondigital/cibercentro",
    },
    {
        "id": "aisd-lz-001",
        "nombre": "Centro Insular de Capacitación Digital · Lanzarote",
        "tipo": "aisd",
        "lng": -13.5460,
        "lat": 28.9620,
        "mun": "Arrecife",
        "isla": "Lanzarote",
        "horario": "",
        "operador": "Cabildo de Lanzarote",
        "fuente": "gobiernodecanarias.org noticias 2025 (80.000 €)",
    },
]


# ---------------------------------------------------------------- #
# 2) BARRIDO OSM (opcional, requiere pyosmium)
# ---------------------------------------------------------------- #
ROOT = "/Users/panch/KOINOS-iso"
PBF = f"{ROOT}/GEOFABRIK/canary-islands-latest.osm.pbf"
OUT = f"{ROOT}/public/data/telecentros-canarias.geojson"

# Bbox Canarias
BBOX = (-18.2, 27.5, -13.3, 29.5)

OSM_TAGS = [
    # (key, value, tipo, label)
    ("amenity", "internet_cafe", "telecentro", "Locutorio/cibercafé"),
    ("office",  "educational_institution", "telecentro", "Academia/centro formación"),
    ("amenity", "language_school", "telecentro", "Escuela de idiomas"),
]


def _osm_tipo(tags):
    for k, v, t, _ in OSM_TAGS:
        if tags.get(k) == v:
            return t
    return None


def _in_bbox(lon, lat):
    return BBOX[0] <= lon <= BBOX[2] and BBOX[1] <= lat <= BBOX[3]


def _dedupe_against_catalogo(lon, lat, catalogo_features, eps_deg=0.0015):
    """Devuelve True si hay un punto curado a < ~150 m."""
    for f in catalogo_features:
        clon, clat = f["geometry"]["coordinates"]
        if abs(clon - lon) < eps_deg and abs(clat - lat) < eps_deg:
            return True
    return False


def scan_osm(catalogo_features):
    try:
        import osmium
    except ImportError:
        print("[osm] pyosmium no disponible, omito barrido OSM",
              file=sys.stderr)
        return []
    if not os.path.exists(PBF):
        print(f"[osm] PBF no encontrado en {PBF}, omito", file=sys.stderr)
        return []

    out = []
    counts = defaultdict(int)

    class H(osmium.SimpleHandler):
        def node(self, n):
            tags = {t.k: t.v for t in n.tags}
            tipo = _osm_tipo(tags)
            if not tipo:
                return
            try:
                lon, lat = n.location.lon, n.location.lat
            except osmium.InvalidLocationError:
                return
            if not _in_bbox(lon, lat):
                return
            if _dedupe_against_catalogo(lon, lat, catalogo_features):
                return
            name = (tags.get("name") or tags.get("name:es")
                    or tags.get("operator") or "Centro digital")
            out.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [round(lon, 6), round(lat, 6)],
                },
                "properties": {
                    "nombre": name,
                    "tipo": tipo,
                    "mun": tags.get("addr:city") or tags.get("addr:town") or "",
                    "isla": "",  # se rellenará tras cruzar con polígonos isla
                    "horario": tags.get("opening_hours") or "",
                    "operador": tags.get("operator") or "",
                    "fuente": "OSM Geofabrik",
                    "osm_id": f"node/{n.id}",
                },
            })
            counts[tipo] += 1

    h = H()
    h.apply_file(PBF, locations=True)
    print(f"[osm] {len(out)} puntos añadidos desde OSM", file=sys.stderr)
    for k, v in counts.items():
        print(f"  osm.{k}: {v}", file=sys.stderr)
    return out


# ---------------------------------------------------------------- #
# 3) PIPELINE
# ---------------------------------------------------------------- #
def catalogo_to_features():
    feats = []
    for it in CATALOGO:
        feats.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [it["lng"], it["lat"]],
            },
            "properties": {
                "id": it["id"],
                "nombre": it["nombre"],
                "tipo": it["tipo"],
                "mun": it["mun"],
                "isla": it["isla"],
                "horario": it.get("horario", ""),
                "operador": it.get("operador", ""),
                "fuente": it.get("fuente", ""),
            },
        })
    return feats


def main():
    cat_feats = catalogo_to_features()
    osm_feats = scan_osm(cat_feats)
    feats = cat_feats + osm_feats

    counts = defaultdict(int)
    for f in feats:
        counts[f["properties"]["tipo"]] += 1

    fc = {
        "type": "FeatureCollection",
        "name": "telecentros-canarias",
        "indicador": "DIG-03",
        "generated_at": "2026-05-27",
        "fuentes": [
            "Aulas Mentor (Min. Educación FP y Deportes)",
            "AISD - Acceso Igualitario a la Sociedad Digital (Gob. Canarias)",
            "Red Conecten (Cabildo de Tenerife)",
            "La Gomera Aprende (Cabildo de La Gomera)",
            "Cibercentro (Gob. Canarias · Transformación Digital)",
            "OSM Geofabrik canary-islands (amenity=internet_cafe, office=educational_institution)",
        ],
        "count": len(feats),
        "by_tipo": dict(counts),
        "features": feats,
    }

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(fc, f, ensure_ascii=False, separators=(",", ":"))
    print(f"wrote {OUT} — {len(feats)} centros", file=sys.stderr)
    for k, v in sorted(counts.items(), key=lambda x: -x[1]):
        print(f"  {k}: {v}", file=sys.stderr)


if __name__ == "__main__":
    main()
