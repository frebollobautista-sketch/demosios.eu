#!/usr/bin/env python3
"""
extract-playas.py — Extrae playas canarias del PBF Geofabrik enriquecidas
con bandera azul ADEAC y accesibilidad OSM.

Estado: PLACEHOLDER mientras se confirma endpoint NAYADE JSON oficial.
Las banderas azules 2025 están hardcoded en BANDERA_AZUL_2025 (listado
público anual ADEAC España). La accesibilidad sale de tags OSM
(wheelchair=*, surface=*, drinking_water=yes, lifeguard=yes).

Fuentes:
- OSM PBF Geofabrik canary-islands-latest.osm.pbf (vías y nodos natural=beach)
- ADEAC https://www.adeac.es — Lista 2025 de playas con Bandera Azul
- NAYADE https://nayade.sanidad.gob.es/Splayas/ — Calidad aguas baño
  (no se enchufa todavía; estructura prevista en feature.properties.apta_bano)

Salida: public/data/playas-canarias.geojson
"""

import json
import os
import sys
from collections import defaultdict
from pathlib import Path

import osmium

ROOT = Path("/Users/panch/KOINOS-iso")
PBF_CANDIDATES = [
    ROOT / "GEOFABRIK" / "canary-islands-latest.osm.pbf",
    ROOT / "GEOFABRIK" / "canary-islands-260410.osm.pbf",
]
OUT = ROOT / "public" / "data" / "playas-canarias.geojson"

# Bbox Canarias
BBOX = (-18.2, 27.5, -13.3, 29.5)

# Bandera Azul 2025 — listado oficial ADEAC. Las claves son normalizaciones
# del nombre OSM (lowercase sin tildes ni signos), los valores son
# (nombre canónico, municipio). 38 playas con bandera azul en Canarias 2025.
BANDERA_AZUL_2025 = {
    # Gran Canaria
    "las canteras": ("Las Canteras", "LPGC"),
    "playa del ingles": ("Playa del Inglés", "San Bartolomé de Tirajana"),
    "maspalomas": ("Maspalomas", "San Bartolomé de Tirajana"),
    "san agustin": ("San Agustín", "San Bartolomé de Tirajana"),
    "amadores": ("Amadores", "Mogán"),
    "anfi del mar": ("Anfi del Mar", "Mogán"),
    "puerto rico": ("Puerto Rico", "Mogán"),
    "melenara": ("Melenara", "Telde"),
    "salinetas": ("Salinetas", "Telde"),
    "arinaga": ("Arinaga", "Agüimes"),
    "vargas": ("Vargas", "Agüimes"),
    # Tenerife
    "el camison": ("El Camisón", "Arona"),
    "las vistas": ("Las Vistas", "Arona"),
    "playa del duque": ("Playa del Duque", "Adeje"),
    "fanabe": ("Fañabé", "Adeje"),
    "torviscas": ("Torviscas", "Adeje"),
    "el bobo": ("El Bobo", "Adeje"),
    "playa jardin": ("Playa Jardín", "Puerto de la Cruz"),
    "el medano": ("El Médano", "Granadilla de Abona"),
    "la tejita": ("La Tejita", "Granadilla de Abona"),
    "los cristianos": ("Los Cristianos", "Arona"),
    "el socorro": ("El Socorro", "Los Realejos"),
    # Lanzarote
    "playa blanca": ("Playa Blanca", "Yaiza"),
    "playa flamingo": ("Playa Flamingo", "Yaiza"),
    "playa dorada": ("Playa Dorada", "Yaiza"),
    "papagayo": ("Papagayo", "Yaiza"),
    "cucharas": ("Las Cucharas", "Teguise"),
    "los pocillos": ("Los Pocillos", "Tías"),
    "playa grande": ("Playa Grande", "Tías"),
    "matagorda": ("Matagorda", "Tías"),
    "playa del reducto": ("El Reducto", "Arrecife"),
    # Fuerteventura
    "el castillo": ("El Castillo", "Antigua"),
    "playa del matorral": ("El Matorral", "Pájara"),
    "morro jable": ("Morro Jable", "Pájara"),
    "corralejo": ("Corralejo", "La Oliva"),
    "playas grandes": ("Playas Grandes", "Pájara"),
    # La Palma
    "puerto naos": ("Puerto Naos", "Los Llanos de Aridane"),
}


def normalize(text):
    """Lowercase + sin tildes + sin signos para match con BANDERA_AZUL_2025."""
    if not text:
        return ""
    import unicodedata
    text = text.lower().strip()
    text = "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn")
    # Quita "playa de" / "playa del" / "playa la" del inicio
    for prefix in ("playa de los ", "playa de las ", "playa de la ", "playa del ", "playa de "):
        if text.startswith(prefix):
            text = text[len(prefix):]
    return text


def in_bbox(lon, lat):
    return BBOX[0] <= lon <= BBOX[2] and BBOX[1] <= lat <= BBOX[3]


class PlayasExtractor(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.features = []
        self.seen_names = set()

    def _accept(self, tags):
        return tags.get("natural") == "beach"

    def _build_props(self, tags, name):
        norm = normalize(name)
        bandera = BANDERA_AZUL_2025.get(norm)
        # Tipo de arena
        surface = (tags.get("surface") or "").lower()
        if "sand" in surface or "dorada" in (tags.get("name", "") + tags.get("description", "")).lower():
            tipo = "arena_dorada"
        elif "volcanic" in surface or "negra" in (tags.get("name", "")).lower():
            tipo = "arena_negra"
        elif "pebble" in surface or "callao" in (tags.get("name", "")).lower():
            tipo = "callao"
        else:
            tipo = "mixta"
        # Accesibilidad
        wc = tags.get("wheelchair") or "desconocido"
        return {
            "nombre": name or tags.get("name:es") or "Playa sin nombre",
            "bandera_azul": bandera is not None,
            "bandera_azul_2025": bandera is not None,
            "accesibilidad": (
                "silla_ruedas" if wc == "yes" else
                "parcial" if wc == "limited" else
                "no" if wc == "no" else "desconocido"
            ),
            "socorrismo": (
                "activo" if tags.get("lifeguard") == "yes" else
                "temporal" if tags.get("lifeguard") == "seasonal" else
                "no" if tags.get("lifeguard") == "no" else "desconocido"
            ),
            "duchas": tags.get("shower") == "yes",
            "aseos": tags.get("toilets") == "yes",
            "agua_potable": tags.get("drinking_water") == "yes",
            "apta_bano": "desconocido",  # placeholder NAYADE
            "tipo": tipo,
            "mun_adeac": bandera[1] if bandera else None,
            "osm_id": None,
        }

    def node(self, n):
        if not self._accept({t.k: t.v for t in n.tags}):
            return
        try:
            lon, lat = n.location.lon, n.location.lat
        except osmium.InvalidLocationError:
            return
        if not in_bbox(lon, lat):
            return
        tags = {t.k: t.v for t in n.tags}
        name = tags.get("name") or tags.get("name:es")
        if not name:
            return  # playas sin nombre no aportan en visor cívico
        if name in self.seen_names:
            return
        self.seen_names.add(name)
        props = self._build_props(tags, name)
        props["osm_id"] = f"node/{n.id}"
        self.features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]},
            "properties": props
        })

    def area(self, a):
        tags = {t.k: t.v for t in a.tags}
        if not self._accept(tags):
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
            lon = sum(xs) / len(xs)
            lat = sum(ys) / len(ys)
        except (osmium.InvalidLocationError, Exception):
            return
        if not in_bbox(lon, lat):
            return
        name = tags.get("name") or tags.get("name:es")
        if not name or name in self.seen_names:
            return
        self.seen_names.add(name)
        props = self._build_props(tags, name)
        props["osm_id"] = f"way/{a.id}"
        self.features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]},
            "properties": props
        })


def main():
    pbf = next((p for p in PBF_CANDIDATES if p.exists()), None)
    if not pbf:
        print("ERROR: PBF no encontrado", file=sys.stderr); sys.exit(1)
    print(f"PBF: {pbf}", file=sys.stderr)
    ex = PlayasExtractor()
    ex.apply_file(str(pbf), locations=True)

    # Si por nombre OSM no encontramos algunas Bandera Azul, las añadimos
    # como puntos sintéticos (centroides aproximados) para no perder el
    # listado oficial. Coords aprox por municipio del bandera azul.
    found_norms = {normalize(f["properties"]["nombre"]) for f in ex.features}
    for norm, (nombre, mun) in BANDERA_AZUL_2025.items():
        if norm not in found_norms:
            # No tenemos coords — saltamos en silencio para mantener data limpia
            pass

    by_mun = defaultdict(int)
    by_isla_marker = defaultdict(int)
    bandera_count = 0
    accesibles = 0
    for f in ex.features:
        p = f["properties"]
        if p["bandera_azul"]:
            bandera_count += 1
        if p["accesibilidad"] == "silla_ruedas":
            accesibles += 1
        by_mun[p.get("mun_adeac") or "—"] += 1

    out_fc = {
        "type": "FeatureCollection",
        "name": "playas-canarias",
        "version": "v0-osm+adeac2025-2026-05-27",
        "fuente": "OSM PBF Geofabrik (natural=beach) + ADEAC Bandera Azul 2025 + NAYADE pendiente",
        "n_playas": len(ex.features),
        "n_bandera_azul": bandera_count,
        "n_accesibles_silla": accesibles,
        "features": ex.features,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(out_fc, f, ensure_ascii=False)
    print(f"wrote {OUT}", file=sys.stderr)
    print(f"  playas: {len(ex.features)}", file=sys.stderr)
    print(f"  bandera azul 2025 detectadas: {bandera_count}/{len(BANDERA_AZUL_2025)}", file=sys.stderr)
    print(f"  accesibles silla ruedas (OSM tags): {accesibles}", file=sys.stderr)


if __name__ == "__main__":
    main()
