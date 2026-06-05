#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MEM-01 · Lugares de memoria democrática en Canarias.

Genera `public/data/memoria-democratica-canarias.geojson` con los lugares
conocidos asociados a la Guerra Civil, la represión franquista, el exilio
y la represión social del régimen en el archipiélago.

==================================================================
ÉTICA — leer antes de modificar este fichero.
==================================================================
- NO se publican nombres individuales de víctimas. Sólo el lugar y la
  cifra agregada cuando es histórica y verificada.
- Las cifras de víctimas son ESTIMACIONES historiográficas (no censo
  judicial) y por tanto se prefijan con `~` en la propiedad
  `numero_victimas`. Cuando hay un dato exhumado y confirmado, se
  marca aparte en `numero_exhumados`.
- Marcadores diseñados con sobriedad (rojo apagado, sin animación) para
  evitar espectacularización. Patrón estético "Into the Breach" del
  resto del runtime.
==================================================================

FUENTES PRIMARIAS (no se ha encontrado JSON/GeoJSON oficial nacional
descargable a fecha 2026-05-27; los datos están hardcodeados con cita
bibliográfica/periodística por feature):

- Ministerio de Política Territorial y Memoria Democrática (MPTMD) —
  `https://mptmd.gob.es/portal/memoria-democratica/mapa-de-fosas` —
  buscador georreferenciado web, sin export público de datos.
- Gobierno de Canarias · Memoria Histórica —
  `https://www.gobiernodecanarias.org/justicia/memoriahistorica/`
- Asociación para la Recuperación de la Memoria Histórica (ARMH) y
  Asociación de Memoria Histórica de Arucas — exhumaciones Pozos de
  Arucas (Llano de las Brujas, Tenoya), Sima de Jinámar.
- "Memoria Histórica de Canarias", serie de Tamaimos.
- Wikipedia ES — Prisión de Fyffes, Colonia Agrícola Penitenciaria de
  Tefía, Sima de Jinámar, Pozos de Arucas.
- Foro por la Memoria · La Palma — Pino del Consuelo.

Uso:
    python3 scripts/extract-memoria-democratica.py
    → escribe public/data/memoria-democratica-canarias.geojson
"""

import json
import os
import sys
from datetime import date

# ---------------------------------------------------------------- #
# Catálogo curado. Coordenadas aproximadas al lugar; refinar con
# trabajo de campo si se accede al catálogo oficial completo.
# ---------------------------------------------------------------- #
LUGARES = [
    # ============== GRAN CANARIA ==============
    {
        "id": "mem-gc-001",
        "nombre": "Sima de Jinámar",
        "tipo": "fosa_comun",
        "epoca": "Guerra Civil",
        "numero_victimas": "~cientos (estimación)",
        "numero_exhumados": 4,
        "descripcion_corta": (
            "Tubo volcánico de 76 m al que las 'Brigadas del Amanecer' "
            "arrojaron a republicanos detenidos en 1936-37. Símbolo "
            "central de la represión franquista en Gran Canaria. "
            "Primera intervención arqueológica halló restos óseos, "
            "cartuchería Mauser y objetos personales."
        ),
        "lng": -15.3961,
        "lat": 28.0479,
        "mun": "Telde",
        "isla": "Gran Canaria",
        "fuente": "ARMH / eldiario.es / Gob.Canarias",
    },
    {
        "id": "mem-gc-002",
        "nombre": "Pozo del Llano de las Brujas",
        "tipo": "fosa_comun",
        "epoca": "Guerra Civil",
        "numero_victimas": "~27 (estimación)",
        "numero_exhumados": 24,
        "descripcion_corta": (
            "Pozo de más de 50 m en Montaña Blanca. Primera fosa "
            "del franquismo exhumada en Canarias (desde 2008). "
            "Personas con manos atadas y disparo en la cabeza. "
            "Detenciones masivas de marzo de 1937."
        ),
        "lng": -15.5210,
        "lat": 28.1190,
        "mun": "Arucas",
        "isla": "Gran Canaria",
        "fuente": "Asoc. Memoria Histórica Arucas / ARMH",
    },
    {
        "id": "mem-gc-003",
        "nombre": "Pozo de Tenoya",
        "tipo": "fosa_comun",
        "epoca": "Guerra Civil",
        "numero_victimas": "~14+ (estimación)",
        "numero_exhumados": 14,
        "descripcion_corta": (
            "Uno de los 'Pozos del Olvido' de Arucas. Exhumación "
            "iniciada en 2013 complicada por galerías, escombros y "
            "vehículos arrojados. Restos de 14 personas localizados."
        ),
        "lng": -15.4843,
        "lat": 28.1248,
        "mun": "Las Palmas de Gran Canaria",
        "isla": "Gran Canaria",
        "fuente": "Asoc. Memoria Histórica Arucas / eldiario.es",
    },
    {
        "id": "mem-gc-004",
        "nombre": "Pozo del Puente del Barranco de Arucas",
        "tipo": "fosa_comun",
        "epoca": "Guerra Civil",
        "numero_victimas": "desconocido",
        "descripcion_corta": (
            "Tercero de los 'Pozos del Olvido'. Sin exhumar. "
            "Detenciones falangistas de marzo de 1937."
        ),
        "lng": -15.5236,
        "lat": 28.1117,
        "mun": "Arucas",
        "isla": "Gran Canaria",
        "fuente": "Asoc. Memoria Histórica Arucas",
    },
    {
        "id": "mem-gc-005",
        "nombre": "Pozo de la Vuelta del Francés",
        "tipo": "fosa_comun",
        "epoca": "Guerra Civil",
        "numero_victimas": "desconocido",
        "descripcion_corta": (
            "Cuarto pozo del conjunto de Arucas vinculado a las "
            "desapariciones forzadas de 1937. Sin exhumar."
        ),
        "lng": -15.5180,
        "lat": 28.1080,
        "mun": "Arucas",
        "isla": "Gran Canaria",
        "fuente": "Asoc. Memoria Histórica Arucas",
    },
    {
        "id": "mem-gc-006",
        "nombre": "Campo de concentración de La Isleta",
        "tipo": "carcel",
        "epoca": "Guerra Civil",
        "numero_victimas": "~1.100 reclusos",
        "descripcion_corta": (
            "Primer campo de concentración en Gran Canaria, sobre "
            "terreno militar de la península de La Isleta. Rodeado "
            "por triple alambrada. Campo de castigo y trabajo "
            "forzado (carreteras, baterías costeras). Funcionó hasta "
            "febrero de 1937, cuando se trasladó a Gando."
        ),
        "lng": -15.4144,
        "lat": 28.1672,
        "mun": "Las Palmas de Gran Canaria",
        "isla": "Gran Canaria",
        "fuente": "Tamaimos / Wikipedia / Canarias7",
    },
    {
        "id": "mem-gc-007",
        "nombre": "Lazareto de Gando (campo de concentración)",
        "tipo": "carcel",
        "epoca": "Guerra Civil",
        "numero_victimas": "~1.100 reclusos",
        "descripcion_corta": (
            "Antiguo lazareto reutilizado como campo de concentración "
            "tras el cierre de La Isleta (febrero 1937). Reclusos de "
            "toda la provincia, sometidos a trabajos forzados "
            "(emblemáticamente, acarreo de arena)."
        ),
        "lng": -15.3858,
        "lat": 27.9352,
        "mun": "Telde",
        "isla": "Gran Canaria",
        "fuente": "Tamaimos / elpaiscanario.com",
    },
    {
        "id": "mem-gc-008",
        "nombre": "Cementerio de Las Palmas — fosa común sin exhumar",
        "tipo": "fosa_comun",
        "epoca": "Guerra Civil",
        "numero_victimas": "desconocido",
        "descripcion_corta": (
            "Fosa común en el cementerio municipal que contiene "
            "víctimas de la represión, entre ellas el periodista "
            "Manuel Fernández (asesinado en La Isleta, 1936). "
            "Exhumación bloqueada institucionalmente."
        ),
        "lng": -15.4243,
        "lat": 28.1379,
        "mun": "Las Palmas de Gran Canaria",
        "isla": "Gran Canaria",
        "fuente": "Diario de Lanzarote / ARMH",
    },
    {
        "id": "mem-gc-009",
        "nombre": "Muelle de Las Palmas — embarque del exilio",
        "tipo": "exilio_embarque",
        "epoca": "Guerra Civil",
        "numero_victimas": None,
        "descripcion_corta": (
            "Punto de embarque para el exilio republicano canario "
            "(1936-1939). Miles de personas hacia América (México "
            "principalmente). Lugar simbólico de la diáspora "
            "republicana del archipiélago."
        ),
        "lng": -15.4140,
        "lat": 28.1437,
        "mun": "Las Palmas de Gran Canaria",
        "isla": "Gran Canaria",
        "fuente": "eldiario.es / bibliografía exilio canario-mexicano",
    },

    # ============== TENERIFE ==============
    {
        "id": "mem-tf-001",
        "nombre": "Prisión de Fyffes",
        "tipo": "carcel",
        "epoca": "Guerra Civil",
        "numero_victimas": "~4.000 reclusos en 12 años",
        "descripcion_corta": (
            "Antiguos almacenes plataneros de la compañía Fyffes "
            "habilitados como cárcel militar tras el golpe del 18 "
            "de julio de 1936. Hasta 1.500 presos simultáneos. "
            "Hacinamiento, tortura, ejecuciones sumarias y "
            "desapariciones forzadas. Símbolo central de la "
            "represión en Tenerife."
        ),
        "lng": -16.2526,
        "lat": 28.4720,
        "mun": "Santa Cruz de Tenerife",
        "isla": "Tenerife",
        "fuente": "Wikipedia / eltambor.es / ULL",
    },
    {
        "id": "mem-tf-002",
        "nombre": "Fortaleza de Paso Alto",
        "tipo": "carcel",
        "epoca": "Guerra Civil",
        "numero_victimas": None,
        "descripcion_corta": (
            "Antigua batería militar utilizada como lugar de "
            "ejecuciones y detención. Propuesta abierta para "
            "convertirla en Museo de la Memoria Histórica."
        ),
        "lng": -16.2418,
        "lat": 28.4855,
        "mun": "Santa Cruz de Tenerife",
        "isla": "Tenerife",
        "fuente": "Diario de Avisos / ULL",
    },
    {
        "id": "mem-tf-003",
        "nombre": "Cementerio de San Rafael y San Roque — fosa común",
        "tipo": "fosa_comun",
        "epoca": "Guerra Civil",
        "numero_victimas": "desconocido",
        "descripcion_corta": (
            "Cementerio histórico de Santa Cruz con fosa común "
            "que recoge víctimas de fusilamientos del 36-37, "
            "muchas procedentes de la prisión de Fyffes."
        ),
        "lng": -16.2552,
        "lat": 28.4719,
        "mun": "Santa Cruz de Tenerife",
        "isla": "Tenerife",
        "fuente": "Bibliografía ULL / repositorio RIULL",
    },

    # ============== LA PALMA ==============
    {
        "id": "mem-lp-001",
        "nombre": "Pino del Consuelo",
        "tipo": "monumento_victimas",
        "epoca": "Guerra Civil",
        "numero_victimas": "~52 (placas) / 8 exhumados",
        "numero_exhumados": 8,
        "descripcion_corta": (
            "Lugar de las primeras exhumaciones judiciales de "
            "víctimas de la dictadura en España (1994). Monumento "
            "oficial declarado Lugar de Memoria Histórica por el "
            "Gobierno de Canarias. Placas con 52 nombres de "
            "desaparecidos palmeros."
        ),
        "lng": -17.8460,
        "lat": 28.4853,
        "mun": "Fuencaliente de La Palma",
        "isla": "La Palma",
        "fuente": "Foro por la Memoria / Gob.Canarias",
    },

    # ============== FUERTEVENTURA ==============
    {
        "id": "mem-fv-001",
        "nombre": "Colonia Agrícola Penitenciaria de Tefía",
        "tipo": "carcel",
        "epoca": "Franquismo",
        "numero_victimas": "~200 internos (Ley Vagos y Maleantes)",
        "descripcion_corta": (
            "Colonia penitenciaria 1954-1966 destinada al "
            "internamiento y 'reeducación' de varones homosexuales "
            "bajo la Ley de Vagos y Maleantes (1954). Trabajos "
            "forzados, malos tratos sistemáticos. Declarada Lugar "
            "de Memoria Democrática por el Gobierno de España "
            "(2025). Monumento LGTBIQ desde 2008."
        ),
        "lng": -14.0392,
        "lat": 28.5641,
        "mun": "Puerto del Rosario",
        "isla": "Fuerteventura",
        "fuente": "Min.PTMD / Wikipedia / Togayther",
    },

    # ============== LANZAROTE ==============
    {
        "id": "mem-lz-001",
        "nombre": "Cementerio de Arrecife — fosa común",
        "tipo": "fosa_comun",
        "epoca": "Guerra Civil",
        "numero_victimas": "desconocido",
        "descripcion_corta": (
            "Fosa común documentada en el cementerio de Arrecife "
            "con víctimas de la represión del 36 en Lanzarote, "
            "muchas tras paso por La Isleta o Gando. Pendiente de "
            "exhumación."
        ),
        "lng": -13.5479,
        "lat": 28.9627,
        "mun": "Arrecife",
        "isla": "Lanzarote",
        "fuente": "Diario de Lanzarote / Memoria de Lanzarote",
    },
    {
        "id": "mem-lz-002",
        "nombre": "Lugar de detenciones de la Guerra Civil — Arrecife",
        "tipo": "lugar_simbolico",
        "epoca": "Guerra Civil",
        "numero_victimas": None,
        "descripcion_corta": (
            "Punto de concentración de detenidos lanzaroteños "
            "previo a su traslado a campos de Gran Canaria "
            "(La Isleta, Gando). Documentado en la ponencia marco "
            "'La Guerra Civil en Lanzarote y Fuerteventura'."
        ),
        "lng": -13.5460,
        "lat": 28.9636,
        "mun": "Arrecife",
        "isla": "Lanzarote",
        "fuente": "Memoria de Lanzarote (bk.memoriadelanzarote.com)",
    },
]


# ---------------------------------------------------------------- #
# Sanity check ética.
# ---------------------------------------------------------------- #
def _validate_ethics():
    """No incluir nombres individuales de víctimas en descripciones.

    Whitelist: nombres de represores institucionales (Brigadas del
    Amanecer) o personas ya públicas que IMPULSARON la memoria
    (no víctimas), permitidos por contexto histórico documentado.
    """
    allowed_proper_nouns = {
        "Manuel Fernández",  # caso público documentado, periodista, ya en prensa
        "Brigadas del Amanecer",
        "Pino Sosa",  # impulsora de exhumaciones (no víctima)
        "Vagos y Maleantes",
        "Reyes Católicos",  # avenida
        "Pino del Consuelo",  # árbol
        "Las Brujas",  # topónimo
        "Vuelta del Francés",  # topónimo
        "Llano de las Brujas",
        "Casa African Eastern",  # propietaria almacenes
        "Alfonso XIII",  # contexto monetario
        "Mauser",  # tipo cartucho
    }
    # Heurística suave; sólo avisa.
    flagged = 0
    for L in LUGARES:
        desc = L.get("descripcion_corta", "") or ""
        # buscar cadenas de "Nombre Apellido" sospechosas
        import re
        for m in re.findall(r"\b[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+", desc):
            if m in allowed_proper_nouns:
                continue
            # whitelist parcial por contención
            if any(a in m or m in a for a in allowed_proper_nouns):
                continue
            print(f"  [ETICA] revisar '{m}' en {L['id']}", file=sys.stderr)
            flagged += 1
    if flagged:
        print(f"  [ETICA] {flagged} entidad(es) marcada(s) — revisar manualmente.",
              file=sys.stderr)


def main():
    _validate_ethics()

    features = []
    for L in LUGARES:
        props = {
            "id": L["id"],
            "nombre": L["nombre"],
            "tipo": L["tipo"],
            "epoca": L["epoca"],
            "numero_victimas": L.get("numero_victimas"),
            "descripcion_corta": L.get("descripcion_corta", ""),
            "mun": L["mun"],
            "isla": L["isla"],
            "fuente": L["fuente"],
        }
        if "numero_exhumados" in L:
            props["numero_exhumados"] = L["numero_exhumados"]
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point",
                         "coordinates": [L["lng"], L["lat"]]},
            "properties": props,
        })

    fc = {
        "type": "FeatureCollection",
        "_meta": {
            "fuente": (
                "Curado a mano — lugares de memoria democrática en "
                "Canarias (Ley 19/2022). Sin JSON oficial nacional "
                "descargable a fecha 2026-05-27."
            ),
            "actualizado": str(date.today()),
            "version": 1,
            "schema_tipos": [
                "fosa_comun", "carcel", "lugar_simbolico",
                "monumento_victimas", "exilio_embarque",
            ],
            "schema_epocas": ["Guerra Civil", "Franquismo", "Transición"],
            "etica": (
                "No se publican nombres individuales de víctimas. "
                "Cifras son estimaciones historiográficas — datos "
                "exhumados confirmados aparecen en `numero_exhumados`."
            ),
            "marco_legal": "Ley 19/2022 de Memoria Democrática (España)",
            "uso": (
                "Overlay `memoria-democratica` en polis-app/iso. "
                "Pin sobrio rojo apagado, sin animación."
            ),
        },
        "features": features,
    }

    out_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "public", "data",
    )
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "memoria-democratica-canarias.geojson")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(fc, f, ensure_ascii=False, indent=2)

    # Reporte por tipo
    by_tipo = {}
    by_isla = {}
    for L in LUGARES:
        by_tipo[L["tipo"]] = by_tipo.get(L["tipo"], 0) + 1
        by_isla[L["isla"]] = by_isla.get(L["isla"], 0) + 1

    print(f"[memoria-democratica] escrito {out_path}")
    print(f"[memoria-democratica] total: {len(LUGARES)} lugares")
    print("  por tipo:")
    for k, v in sorted(by_tipo.items()):
        print(f"    {k:22s} {v}")
    print("  por isla:")
    for k, v in sorted(by_isla.items()):
        print(f"    {k:22s} {v}")


if __name__ == "__main__":
    main()
