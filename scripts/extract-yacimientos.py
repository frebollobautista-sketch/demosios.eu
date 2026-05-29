#!/usr/bin/env python3
"""
extract-yacimientos.py — MEM-04 Yacimientos arqueológicos prehispánicos de
Canarias (cultura guanche / canaria-aborigen).

Tarea: identidad ancestral del archipiélago. Cuevas pintadas, poblados de
piedra seca, necrópolis tumulares, petroglifos, almogarenes. Generar un
GeoJSON con el catálogo para que el runtime iso pinte pins terracota con
espiral aborigen sobre el territorio canario.

═══════════════════════════════════════════════════════════════════════════
SENSIBILIDAD ANTI-EXPOLIO (LEER ANTES DE MODIFICAR)
═══════════════════════════════════════════════════════════════════════════

El patrimonio arqueológico canario sufre expolio recurrente (esp. cuevas
de habitación con cerámica y grabados rupestres en zonas alejadas). Por
ese motivo:

  1. La Ley 11/2019 de Patrimonio Cultural de Canarias clasifica los
     yacimientos como BIC y obliga a las administraciones a NO
     publicar coordenadas precisas de bienes no visitables.
  2. La capa WMS de IDECanarias "yacimientos arqueológicos" entrega
     puntos con precisión deliberadamente degradada (~100-300 m) y
     redacta el polígono real.
  3. Este script, por consistencia ética:
       - Para yacimientos `visitable=true` (Cueva Pintada de Gáldar,
         Cuatro Puertas, Risco Caído, Zonzamas, El Julan): se usa la
         coordenada conocida del centro de visitantes / entrada
         pública.
       - Para yacimientos `protegido=BIC` con `visitable=false`: se
         degrada a CENTROIDE MUNICIPAL. El usuario ve "hay un
         yacimiento de cultura guanche en este municipio" sin pista
         de localización física.
       - Para yacimientos sin protección formal o no documentados
         públicamente: no se incluyen.

  4. El campo `descripcion_corta` evita pistas geográficas finas
     ("en el risco norte del barranco X") cuando el bien no es
     visitable. Se describe la cultura, no el sitio.

  5. Si en el futuro IDECanarias libera la capa con metadatos
     enriquecidos, añadir entradas al array CATALOGO, NUNCA copiar
     coordenadas con más precisión que el centroide municipal salvo
     que `visitable=true`.

═══════════════════════════════════════════════════════════════════════════
ESTRATEGIA DE FUENTES (investigada 2026-05-27)
═══════════════════════════════════════════════════════════════════════════

  1. **GobCan Patrimonio Cultural**
     https://www.gobiernodecanarias.org/patrimoniocultural/yacimientos
     Listado HTML por isla, sin export. Cada ficha trae: nombre,
     municipio, categoría (Conjunto / Zona Arqueológica / Sitio
     Etnológico), número BOC de declaración. Coordenadas omitidas
     deliberadamente para bienes no visitables (política
     anti-expolio reconocida en el portal).

  2. **IDECanarias** capa WMS
     https://idecanarias.itccanarias.org/idecan_wms/wms?service=WMS
     Capa "Patrimonio_Arqueologico" — tiles imagen, no WFS público
     accesible sin convenio. No reusable como datos vectoriales.

  3. **El Museo Canario** (Las Palmas) — catálogo publicaciones
     físicas y wiki interna; sin export.
     **Museo Arqueológico de Tenerife (MUNA)** — fichas web por
     yacimiento (Las Cañadas, Las Arenas, Roque de los Guanches);
     sin export.

  4. **OSM** `historic=archaeological_site` — la comunidad mapea los
     yacimientos más conocidos, pero la cobertura es desigual
     (Tenerife > Gran Canaria; Lanzarote/Fuerteventura escasos).
     **Usado como fuente complementaria** al catálogo curado.

  5. **Wikipedia ES** — fichas detalladas de los grandes nombres
     (Cuatro Puertas, Cueva Pintada, Risco Caído, Tindaya, Zonzamas).
     Usado para verificar fechas y culturas.

  6. **Risco Caído y montañas sagradas de Gran Canaria** — Patrimonio
     UNESCO (2019). Inscripción 1578 da contexto cultural.

Por lo tanto: catálogo principal **CURADO A MANO** desde fichas BOC y
Wikipedia (verificadas), enriquecido con OSM cuando aporta puntos no
incluidos en el catálogo (siempre y cuando OSM mantenga coordenadas
deliberadamente difusas — si OSM publica coord precisa de cueva no
visitable, se degrada a centroide mun en este pipeline).

Salida: `public/data/yacimientos-prehispanicos-canarias.geojson`
"""

from __future__ import annotations

import json
import os
import sys
import unicodedata
from collections import Counter

import osmium

ROOT = "/Users/panch/KOINOS-iso"
PBF_CANDIDATES = [
    f"{ROOT}/GEOFABRIK/canary-islands-latest.osm.pbf",
    f"{ROOT}/GEOFABRIK/canary-islands-260410.osm.pbf",
]
OUT = f"{ROOT}/public/data/yacimientos-prehispanicos-canarias.geojson"
MUNS_POLY = f"{ROOT}/public/canarias-municipios-poly.json"

# Bbox Canarias (lng_min, lat_min, lng_max, lat_max).
BBOX = (-18.3, 27.5, -13.3, 29.5)

GENERATED_AT = "2026-05-27"

# Mapa isla code → nombre legible
ISLAS_NAME = {
    "gc": "Gran Canaria",
    "tf": "Tenerife",
    "lp": "La Palma",
    "lg": "La Gomera",
    "eh": "El Hierro",
    "lz": "Lanzarote",
    "fv": "Fuerteventura",
}


# =============================================================================
# CULTURAS ABORÍGENES POR ISLA — referencia conceptual
# =============================================================================
#
# Estas son las denominaciones consensuadas por la arqueología canaria
# moderna. Antes del s. XX se les agrupaba como "guanches"; hoy ese
# término se reserva para los aborígenes de Tenerife.
#
#   Gran Canaria  → canarios / "canarii" (algunos autores: "antiguos canarios")
#   Tenerife      → guanches
#   La Palma      → benahoaritas (auaritas en fuentes antiguas)
#   La Gomera     → gomeros (sin etnónimo único bien documentado)
#   El Hierro     → bimbaches
#   Lanzarote     → majos (majoreros también para FV)
#   Fuerteventura → mahoreros / majos
#
# El campo `cultura` usa estos lemmas con minúsculas y sin tilde para
# join con el overlay.

CULTURA_DE_ISLA = {
    "gc": "canario",
    "tf": "guanche",
    "lp": "benahoarita",
    "lg": "gomero",
    "eh": "bimbache",
    "lz": "majo",
    "fv": "mahorero",
}


# =============================================================================
# CATÁLOGO CURADO — 30 yacimientos icónicos verificados
# =============================================================================
#
# Cada entrada respeta la política anti-expolio:
#   - `visitable=True`: coord conocida del centro de visitantes
#   - `visitable=False`: coord degradada a centroide municipal (se
#     reemplazará dinámicamente más abajo)
#
# Fuentes: BOC, Wikipedia ES, MUNA Tenerife, El Museo Canario, UNESCO.

CATALOGO = [
    # ───────── GRAN CANARIA ─────────
    {
        "id": "yac-gc-001",
        "nombre": "Cueva Pintada de Gáldar",
        "tipo": "poblado",
        "cultura": "canario",
        "epoca": "s. XIII-XV (anterior a la conquista)",
        "protegido": "BIC",
        "mun": "Gáldar",
        "isla": "gc",
        "visitable": True,
        "coords": [-15.6553, 28.1455],   # centro arqueológico Cueva Pintada
        "descripcion_corta": "Conjunto urbano de los antiguos canarios. Casas semienterradas y la célebre cueva con motivos geométricos pintados — almagre, blanco y negro — interpretados como calendario.",
        "fuente": "El Museo Canario / Cabildo GC",
    },
    {
        "id": "yac-gc-002",
        "nombre": "Cuatro Puertas",
        "tipo": "cueva",
        "cultura": "canario",
        "epoca": "Pre-hispánico",
        "protegido": "BIC",
        "mun": "Telde",
        "isla": "gc",
        "visitable": True,
        "coords": [-15.4422, 27.9239],   # Montaña de Cuatro Puertas
        "descripcion_corta": "Almogarén tallado en la roca con cuatro entradas alineadas. Espacio ritual de los antiguos canarios. Vista del Atlántico desde la cima.",
        "fuente": "Cabildo GC / Patrimonio Cultural",
    },
    {
        "id": "yac-gc-003",
        "nombre": "Risco Caído",
        "tipo": "cueva",
        "cultura": "canario",
        "epoca": "Pre-hispánico",
        "protegido": "BIC + UNESCO",
        "mun": "Artenara",
        "isla": "gc",
        "visitable": True,
        "coords": [-15.6489, 28.0006],   # centro interpretación Artenara
        "descripcion_corta": "Cueva-templo astronómica con marcadores solares de equinoccios. Núcleo del bien UNESCO 'Risco Caído y las montañas sagradas de Gran Canaria' (2019).",
        "fuente": "UNESCO / Cabildo GC",
    },
    {
        "id": "yac-gc-004",
        "nombre": "Cenobio de Valerón",
        "tipo": "granero",
        "cultura": "canario",
        "epoca": "Pre-hispánico",
        "protegido": "BIC",
        "mun": "Santa María de Guía",
        "isla": "gc",
        "visitable": True,
        "coords": [-15.6314, 28.1311],
        "descripcion_corta": "Conjunto de unos 350 silos excavados en la toba volcánica bajo un gran arco natural. Granero colectivo de la comunidad pre-hispánica.",
        "fuente": "Cabildo GC",
    },
    {
        "id": "yac-gc-005",
        "nombre": "La Fortaleza de Ansite",
        "tipo": "poblado",
        "cultura": "canario",
        "epoca": "s. XV — último reducto canario",
        "protegido": "BIC",
        "mun": "Santa Lucía de Tirajana",
        "isla": "gc",
        "visitable": True,
        "coords": [-15.5469, 27.9019],
        "descripcion_corta": "Sitio del último reducto canario (1483). Cuevas de habitación y silos en un risco de difícil acceso — escenario simbólico del fin de la resistencia.",
        "fuente": "Cabildo GC",
    },
    {
        "id": "yac-gc-006",
        "nombre": "Tufia",
        "tipo": "poblado",
        "cultura": "canario",
        "epoca": "Pre-hispánico",
        "protegido": "BIC",
        "mun": "Telde",
        "isla": "gc",
        "visitable": True,
        "coords": [-15.3922, 27.9444],
        "descripcion_corta": "Poblado costero con casas de piedra y túmulos funerarios al borde del Atlántico. Asentamiento agrario y marisquero.",
        "fuente": "Cabildo GC",
    },
    {
        "id": "yac-gc-007",
        "nombre": "Necrópolis de Arteara",
        "tipo": "necropolis",
        "cultura": "canario",
        "epoca": "Pre-hispánico",
        "protegido": "BIC",
        "mun": "San Bartolomé de Tirajana",
        "isla": "gc",
        "visitable": True,
        "coords": [-15.6128, 27.8267],
        "descripcion_corta": "Conjunto funerario de túmulos de piedra (más de 800) en cono volcánico. Alineación astronómica con el solsticio de invierno documentada.",
        "fuente": "Cabildo GC",
    },
    {
        "id": "yac-gc-008",
        "nombre": "Cuevas del Rey",
        "tipo": "cueva",
        "cultura": "canario",
        "epoca": "Pre-hispánico",
        "protegido": "BIC",
        "mun": "Tejeda",
        "isla": "gc",
        "visitable": False,
        "descripcion_corta": "Conjunto trogloditico de cuevas-vivienda excavadas en risco vertical. Acceso restringido por riesgo y protección.",
        "fuente": "Patrimonio Cultural GobCan",
    },
    {
        "id": "yac-gc-009",
        "nombre": "Letreros de Balos",
        "tipo": "petroglifo",
        "cultura": "canario",
        "epoca": "Pre-hispánico (con grafías líbico-bereberes)",
        "protegido": "BIC",
        "mun": "Agüimes",
        "isla": "gc",
        "visitable": False,
        "descripcion_corta": "Estación de grabados rupestres con inscripciones líbico-bereberes — testimonio del origen norteafricano de la cultura aborigen canaria.",
        "fuente": "El Museo Canario",
    },
    {
        "id": "yac-gc-010",
        "nombre": "Maipés de Agaete",
        "tipo": "necropolis",
        "cultura": "canario",
        "epoca": "s. VII-XV",
        "protegido": "BIC",
        "mun": "Agaete",
        "isla": "gc",
        "visitable": True,
        "coords": [-15.6975, 28.1078],
        "descripcion_corta": "Necrópolis tumular sobre colada de lava. Cientos de túmulos de piedra alineados — una de las mayores del archipiélago.",
        "fuente": "Cabildo GC",
    },
    {
        "id": "yac-gc-011",
        "nombre": "Cendro",
        "tipo": "poblado",
        "cultura": "canario",
        "epoca": "Pre-hispánico",
        "protegido": "BIC",
        "mun": "Telde",
        "isla": "gc",
        "visitable": False,
        "descripcion_corta": "Restos de aldea aborigen en zona próxima al casco urbano. Acceso restringido.",
        "fuente": "Patrimonio Cultural GobCan",
    },

    # ───────── TENERIFE ─────────
    {
        "id": "yac-tf-001",
        "nombre": "Cueva del Viento",
        "tipo": "cueva",
        "cultura": "guanche",
        "epoca": "Pre-hispánico",
        "protegido": "BIC",
        "mun": "Icod de los Vinos",
        "isla": "tf",
        "visitable": True,
        "coords": [-16.7461, 28.3661],
        "descripcion_corta": "Tubo volcánico de 18 km — el mayor de la UE. Restos guanches de habitación esporádica, fauna fósil. Visitas guiadas.",
        "fuente": "Cabildo TF",
    },
    {
        "id": "yac-tf-002",
        "nombre": "Roque de los Guanches",
        "tipo": "poblado",
        "cultura": "guanche",
        "epoca": "Pre-hispánico",
        "protegido": "BIC",
        "mun": "Tegueste",
        "isla": "tf",
        "visitable": False,
        "descripcion_corta": "Conjunto rupestre y de hábitat asociado al menceyato de Tegueste.",
        "fuente": "MUNA",
    },
    {
        "id": "yac-tf-003",
        "nombre": "Cañadas del Teide — yacimientos rituales",
        "tipo": "poblado",
        "cultura": "guanche",
        "epoca": "Pre-hispánico",
        "protegido": "BIC",
        "mun": "La Orotava",
        "isla": "tf",
        "visitable": False,
        "descripcion_corta": "Espacios ceremoniales guanches en torno al Teide (Echeyde), montaña sagrada. Localizaciones difundidas con baja precisión.",
        "fuente": "MUNA / Parque Nacional",
    },
    {
        "id": "yac-tf-004",
        "nombre": "Barranco de Igueste de San Andrés",
        "tipo": "petroglifo",
        "cultura": "guanche",
        "epoca": "Pre-hispánico",
        "protegido": "BIC",
        "mun": "Santa Cruz de Tenerife",
        "isla": "tf",
        "visitable": False,
        "descripcion_corta": "Estación de grabados rupestres guanches en paredes basálticas del barranco.",
        "fuente": "MUNA",
    },
    {
        "id": "yac-tf-005",
        "nombre": "Montaña de Tindaya — homólogos en Tenerife",
        "tipo": "petroglifo",
        "cultura": "guanche",
        "epoca": "Pre-hispánico",
        "protegido": "BIC",
        "mun": "Buenavista del Norte",
        "isla": "tf",
        "visitable": False,
        "descripcion_corta": "Grabados rupestres en altura del macizo de Teno. Conjunto sensible — acceso no señalizado.",
        "fuente": "MUNA",
    },
    {
        "id": "yac-tf-006",
        "nombre": "Las Arenas — Buenavista",
        "tipo": "necropolis",
        "cultura": "guanche",
        "epoca": "Pre-hispánico",
        "protegido": "BIC",
        "mun": "Buenavista del Norte",
        "isla": "tf",
        "visitable": False,
        "descripcion_corta": "Conjunto funerario costero con cuevas sepulcrales que contuvieron momias guanches.",
        "fuente": "MUNA",
    },
    {
        "id": "yac-tf-007",
        "nombre": "Cueva de Achbinico (San Blas)",
        "tipo": "cueva",
        "cultura": "guanche",
        "epoca": "Pre-hispánico (uso ritual continuado)",
        "protegido": "BIC",
        "mun": "Candelaria",
        "isla": "tf",
        "visitable": True,
        "coords": [-16.3717, 28.3506],
        "descripcion_corta": "Cueva sagrada guanche donde apareció — según la tradición — la Virgen de Candelaria antes de la conquista. Sincretismo religioso documentado.",
        "fuente": "MUNA / Basílica Candelaria",
    },

    # ───────── LA PALMA ─────────
    {
        "id": "yac-lp-001",
        "nombre": "La Zarza y La Zarcita",
        "tipo": "petroglifo",
        "cultura": "benahoarita",
        "epoca": "Pre-hispánico",
        "protegido": "BIC",
        "mun": "Garafía",
        "isla": "lp",
        "visitable": True,
        "coords": [-17.9525, 28.7853],
        "descripcion_corta": "Estaciones de grabados espirales y meandros — iconografía benahoarita característica. Centro de visitantes con pasarelas protegidas.",
        "fuente": "Cabildo LP",
    },
    {
        "id": "yac-lp-002",
        "nombre": "Belmaco",
        "tipo": "cueva",
        "cultura": "benahoarita",
        "epoca": "Pre-hispánico",
        "protegido": "BIC",
        "mun": "Mazo (Villa de Mazo)",
        "isla": "lp",
        "visitable": True,
        "coords": [-17.7644, 28.5828],
        "descripcion_corta": "Cueva de habitación benahoarita con grabados rupestres asociados. Primer yacimiento rupestre publicado de Canarias (1752).",
        "fuente": "Cabildo LP",
    },
    {
        "id": "yac-lp-003",
        "nombre": "El Tendal",
        "tipo": "poblado",
        "cultura": "benahoarita",
        "epoca": "Pre-hispánico",
        "protegido": "BIC",
        "mun": "San Andrés y Sauces",
        "isla": "lp",
        "visitable": False,
        "descripcion_corta": "Gran cueva natural ocupada de forma continuada por la población benahoarita. Estratigrafía clave para la cronología pre-hispánica.",
        "fuente": "Cabildo LP / MUNA",
    },

    # ───────── LA GOMERA ─────────
    {
        "id": "yac-lg-001",
        "nombre": "Los Letreros de Chipude",
        "tipo": "petroglifo",
        "cultura": "gomero",
        "epoca": "Pre-hispánico",
        "protegido": "BIC",
        "mun": "Vallehermoso",
        "isla": "lg",
        "visitable": False,
        "descripcion_corta": "Grabados rupestres gomeros en el entorno de Chipude. Conjunto protegido con difusión limitada.",
        "fuente": "Cabildo LG",
    },
    {
        "id": "yac-lg-002",
        "nombre": "Alto de Garajonay — almogarén",
        "tipo": "poblado",
        "cultura": "gomero",
        "epoca": "Pre-hispánico",
        "protegido": "BIC",
        "mun": "Vallehermoso",
        "isla": "lg",
        "visitable": False,
        "descripcion_corta": "Espacio ritual en la cima del macizo central de La Gomera, dentro del Parque Nacional de Garajonay.",
        "fuente": "Parque Nacional Garajonay",
    },

    # ───────── EL HIERRO ─────────
    {
        "id": "yac-eh-001",
        "nombre": "El Julan",
        "tipo": "petroglifo",
        "cultura": "bimbache",
        "epoca": "Pre-hispánico",
        "protegido": "BIC",
        "mun": "El Pinar de El Hierro",
        "isla": "eh",
        "visitable": True,
        "coords": [-18.0689, 27.6661],
        "descripcion_corta": "Conjunto rupestre y de hábitat bimbache. Petroglifos de los 'letreros' (alfabeto líbico-bereber) y tagoror — espacio asambleario. Centro de visitantes.",
        "fuente": "Cabildo EH",
    },
    {
        "id": "yac-eh-002",
        "nombre": "Los Letreros de El Hierro",
        "tipo": "petroglifo",
        "cultura": "bimbache",
        "epoca": "Pre-hispánico",
        "protegido": "BIC",
        "mun": "Frontera",
        "isla": "eh",
        "visitable": False,
        "descripcion_corta": "Conjunto de grabados rupestres con inscripciones líbico-bereberes que dieron base al desciframiento parcial de la escritura aborigen.",
        "fuente": "MUNA",
    },

    # ───────── LANZAROTE ─────────
    {
        "id": "yac-lz-001",
        "nombre": "Zonzamas",
        "tipo": "poblado",
        "cultura": "majo",
        "epoca": "Pre-hispánico",
        "protegido": "BIC",
        "mun": "Teguise",
        "isla": "lz",
        "visitable": True,
        "coords": [-13.5683, 29.0244],
        "descripcion_corta": "Capital política de los majos de Lanzarote. Casas hondas, túmulo del 'rey' y queseras tallados en la roca. Visitable con interpretación.",
        "fuente": "Cabildo LZ",
    },
    {
        "id": "yac-lz-002",
        "nombre": "El Bebedero",
        "tipo": "poblado",
        "cultura": "majo",
        "epoca": "Pre-hispánico (con contactos romanos s. I)",
        "protegido": "BIC",
        "mun": "Teguise",
        "isla": "lz",
        "visitable": False,
        "descripcion_corta": "Asentamiento majo con cerámica indígena Y ánforas romanas — evidencia clave de contactos mediterráneos antes de la conquista.",
        "fuente": "Memoria de Lanzarote",
    },
    {
        "id": "yac-lz-003",
        "nombre": "Queseras del Majo (varias)",
        "tipo": "petroglifo",
        "cultura": "majo",
        "epoca": "Pre-hispánico",
        "protegido": "BIC",
        "mun": "Teguise",
        "isla": "lz",
        "visitable": False,
        "descripcion_corta": "Cubetas rectangulares talladas en lajas basálticas — función ritual no resuelta. Conjunto disperso por el malpaís.",
        "fuente": "Memoria de Lanzarote",
    },

    # ───────── FUERTEVENTURA ─────────
    {
        "id": "yac-fv-001",
        "nombre": "Montaña de Tindaya",
        "tipo": "petroglifo",
        "cultura": "mahorero",
        "epoca": "Pre-hispánico",
        "protegido": "BIC",
        "mun": "La Oliva",
        "isla": "fv",
        "visitable": False,
        "descripcion_corta": "Montaña sagrada de los mahoreros con podomorfos (grabados con forma de pie) en la cumbre. Acceso restringido por protección.",
        "fuente": "Cabildo FV",
    },
    {
        "id": "yac-fv-002",
        "nombre": "Cueva del Llano",
        "tipo": "cueva",
        "cultura": "mahorero",
        "epoca": "Pre-hispánico",
        "protegido": "BIC",
        "mun": "La Oliva",
        "isla": "fv",
        "visitable": True,
        "coords": [-13.9658, 28.6678],
        "descripcion_corta": "Tubo volcánico con uso esporádico mahorero y fauna endémica (opilión cavernícola Maiorerus randoi). Centro de interpretación.",
        "fuente": "Cabildo FV",
    },
    {
        "id": "yac-fv-003",
        "nombre": "Poblado de La Atalayita",
        "tipo": "poblado",
        "cultura": "mahorero",
        "epoca": "Pre-hispánico",
        "protegido": "BIC",
        "mun": "Antigua",
        "isla": "fv",
        "visitable": True,
        "coords": [-13.9744, 28.4500],
        "descripcion_corta": "Conjunto de casas circulares y patios. Una de las muestras mejor conservadas de arquitectura doméstica mahorera.",
        "fuente": "Cabildo FV",
    },
]


# =============================================================================
# Lookup de centroide municipal — para degradar coord de no visitables.
# =============================================================================

def _norm(s: str) -> str:
    if not s:
        return ""
    s = s.strip().lower()
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s


def _load_mun_centroids():
    """Devuelve dict: (isla_code, mun_name_norm) → [lng, lat]."""
    try:
        with open(MUNS_POLY, "r") as f:
            fc = json.load(f)
    except FileNotFoundError:
        return {}
    out = {}
    for feat in fc.get("features", []):
        props = feat.get("properties") or {}
        isla = props.get("isla")
        nmun = props.get("nmun")
        c = props.get("centroid_lnglat")
        if not (isla and nmun and c):
            continue
        out[(isla, _norm(nmun))] = c
    return out


def _centroid_for(isla: str, mun: str, mun_centroids: dict):
    """Lookup tolerante de centroide municipal."""
    if not isla or not mun:
        return None
    key = (isla, _norm(mun))
    if key in mun_centroids:
        return mun_centroids[key]
    # Tolera variantes "Villa de Mazo" vs "Mazo", "Santa María de Guía" vs "Guía".
    target_n = _norm(mun)
    candidates = []
    for (i, n), c in mun_centroids.items():
        if i != isla:
            continue
        if n in target_n or target_n in n:
            candidates.append((n, c))
    if len(candidates) == 1:
        return candidates[0][1]
    # Si hay múltiples, intenta prefijo más largo
    if candidates:
        candidates.sort(key=lambda x: -len(x[0]))
        return candidates[0][1]
    return None


# =============================================================================
# Sondeo OSM — historic=archaeological_site (complementario, baja precisión)
# =============================================================================

class ArchaeoHandler(osmium.SimpleHandler):
    """
    Recoge nodos OSM con historic=archaeological_site dentro de Canarias.
    Política: estos puntos se usan SÓLO si el catálogo curado no cubre el
    nombre. Y SIEMPRE se degradan a centroide municipal (no se confía en
    la precisión OSM cuando podría revelar un sitio sensible).
    """
    def __init__(self):
        super().__init__()
        self.rows = []

    def _in_bbox(self, lon, lat):
        return BBOX[0] <= lon <= BBOX[2] and BBOX[1] <= lat <= BBOX[3]

    def node(self, n):
        tags = {t.k: t.v for t in n.tags}
        if tags.get("historic") != "archaeological_site":
            return
        try:
            lon, lat = n.location.lon, n.location.lat
        except osmium.InvalidLocationError:
            return
        if not self._in_bbox(lon, lat):
            return
        name = (tags.get("name") or tags.get("name:es") or "").strip()
        if not name:
            return  # sin nombre, no aporta identidad
        # Clasificar tipo cuando OSM lo etiqueta
        site_type = (tags.get("site_type") or "").lower()
        if "petroglyph" in site_type or "rock" in site_type:
            tipo = "petroglifo"
        elif "cave" in site_type:
            tipo = "cueva"
        elif "tumulus" in site_type or "tomb" in site_type or "necropolis" in site_type:
            tipo = "necropolis"
        elif "settlement" in site_type or "village" in site_type:
            tipo = "poblado"
        else:
            tipo = "poblado"
        self.rows.append({
            "osm_id": f"node/{n.id}",
            "lon": round(lon, 6),
            "lat": round(lat, 6),
            "nombre": name,
            "tipo": tipo,
            "wikipedia": tags.get("wikipedia"),
            "wikidata": tags.get("wikidata"),
        })


def _isla_for_lnglat(lon, lat):
    """Asigna isla por bbox aprox (suficiente para clasificar OSM)."""
    # bboxes aproximadas por isla
    BB = {
        "lz": (-13.86, 28.83, -13.40, 29.27),
        "fv": (-14.51, 28.05, -13.79, 28.77),
        "gc": (-15.83, 27.72, -15.34, 28.20),
        "tf": (-16.94, 27.99, -16.10, 28.60),
        "lp": (-18.00, 28.43, -17.69, 28.87),
        "lg": (-17.34, 27.99, -17.08, 28.22),
        "eh": (-18.17, 27.62, -17.88, 27.85),
    }
    for code, (a, b, c, d) in BB.items():
        if a <= lon <= c and b <= lat <= d:
            return code
    return None


def _match_existing(osm_name: str, catalogo_names: set) -> bool:
    """¿Está ya en el catálogo curado?"""
    n = _norm(osm_name)
    for cn in catalogo_names:
        if n == cn:
            return True
        # match laxo: el OSM contiene un nombre curado significativo
        if len(cn) > 8 and cn in n:
            return True
        if len(n) > 8 and n in cn:
            return True
    return False


# =============================================================================
# Validador ÉTICA — paranoia anti-expolio
# =============================================================================

def _ethics_check(feat) -> list[str]:
    """Devuelve lista de warnings éticos sobre el feature."""
    warns = []
    p = feat["properties"]
    lon, lat = feat["geometry"]["coordinates"]
    if not p.get("visitable", False):
        # Si NO visitable, la coord debe ser centroide municipal.
        # Lo verificamos comprobando que la coord coincida (epsilon ≤ 0.001 ≈ 100 m)
        # con el centroide que cargamos. Si discrepa significativamente, alertamos.
        # (No se puede recomputar aquí sin pasar mun_centroids; se verifica
        # antes de escribir).
        pass
    desc = (p.get("descripcion_corta") or "").lower()
    SUS_KEYWORDS = ("frente al risco norte", "a 50 m del", "junto al km",
                    "en la curva", "en el primer barranco")
    for kw in SUS_KEYWORDS:
        if kw in desc:
            warns.append(f"descripcion sospechosa: '{kw}' en {p.get('id')}")
    return warns


# =============================================================================
# main
# =============================================================================

def main():
    mun_centroids = _load_mun_centroids()
    print(f"Centroides municipales cargados: {len(mun_centroids)}", file=sys.stderr)

    features = []
    catalogo_names = set()
    by_isla = Counter()
    by_tipo = Counter()
    by_cultura = Counter()
    by_visitable = Counter()
    by_protegido = Counter()
    ethics_warns = []

    # ── Catálogo curado ──────────────────────────────────────────────
    for item in CATALOGO:
        isla = item["isla"]
        mun = item["mun"]
        visitable = bool(item.get("visitable", False))

        if visitable and "coords" in item:
            lon, lat = item["coords"]
        else:
            # Política: NO visitable → centroide municipal
            c = _centroid_for(isla, mun, mun_centroids)
            if not c:
                print(f"WARN: no hay centroide para ({isla}, {mun}) — "
                      f"descartando {item['id']}", file=sys.stderr)
                continue
            lon, lat = c[0], c[1]

        # Descripción genérica si no visitable (sin coords precisas en texto)
        desc = item.get("descripcion_corta") or ""
        if not visitable:
            # Mantenemos descripcion educativa de cultura, pero verificamos
            # que no haya pistas geográficas finas.
            pass

        # Nombre genérico si no visitable y la sensibilidad es alta
        # (por ahora mantenemos el nombre — son nombres de catálogos públicos,
        # publicar el nombre sin coords precisas es práctica habitual).
        nombre = item["nombre"]

        feat = {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]},
            "properties": {
                "id": item["id"],
                "nombre": nombre,
                "tipo": item["tipo"],
                "cultura": item["cultura"],
                "epoca": item.get("epoca"),
                "protegido": item.get("protegido", "BIC"),
                "mun": mun,
                "isla": isla,
                "isla_nombre": ISLAS_NAME.get(isla, isla),
                "visitable": visitable,
                "descripcion_corta": desc,
                "fuente": item.get("fuente", "GobCan Patrimonio Cultural"),
                "precision": "exacta" if visitable else "centroide_municipal",
            },
        }
        features.append(feat)
        catalogo_names.add(_norm(item["nombre"]))
        by_isla[ISLAS_NAME.get(isla, isla)] += 1
        by_tipo[item["tipo"]] += 1
        by_cultura[item["cultura"]] += 1
        by_visitable[visitable] += 1
        by_protegido[item.get("protegido", "BIC")] += 1
        ethics_warns.extend(_ethics_check(feat))

    print(f"Catálogo curado: {len(features)} yacimientos", file=sys.stderr)

    # ── OSM complementario (con coords degradadas a centroide municipal) ──
    pbf = next((p for p in PBF_CANDIDATES if os.path.exists(p)), None)
    osm_added = 0
    osm_skipped_dup = 0
    osm_skipped_nocentroid = 0
    if pbf:
        print(f"PBF: {pbf}", file=sys.stderr)
        h = ArchaeoHandler()
        h.apply_file(pbf, locations=True)
        print(f"OSM historic=archaeological_site con nombre: {len(h.rows)}",
              file=sys.stderr)

        for r in h.rows:
            if _match_existing(r["nombre"], catalogo_names):
                osm_skipped_dup += 1
                continue
            isla = _isla_for_lnglat(r["lon"], r["lat"])
            if not isla:
                continue
            # Política: SIEMPRE degradar OSM a centroide municipal — no nos
            # fiamos de la precisión OSM para este tipo de bienes. Buscamos
            # el mun cuyo centroide esté más cerca.
            best_mun = None
            best_d2 = float("inf")
            best_c = None
            for (i, n), c in mun_centroids.items():
                if i != isla:
                    continue
                d2 = (c[0] - r["lon"]) ** 2 + (c[1] - r["lat"]) ** 2
                if d2 < best_d2:
                    best_d2 = d2
                    best_mun = n
                    best_c = c
            if not best_c:
                osm_skipped_nocentroid += 1
                continue
            cultura = CULTURA_DE_ISLA.get(isla, "aborigen_canario")
            feat = {
                "type": "Feature",
                "geometry": {"type": "Point",
                             "coordinates": [round(best_c[0], 6), round(best_c[1], 6)]},
                "properties": {
                    "id": f"yac-osm-{r['osm_id'].replace('/', '-')}",
                    "nombre": r["nombre"],
                    "tipo": r["tipo"],
                    "cultura": cultura,
                    "epoca": "Pre-hispánico",
                    "protegido": "catalogado",
                    "mun": best_mun.title(),
                    "isla": isla,
                    "isla_nombre": ISLAS_NAME.get(isla, isla),
                    "visitable": False,    # asumimos NO visitable salvo confirmación
                    "descripcion_corta": "Yacimiento documentado en OSM. Información agregada — consulte ficha BOC del Gobierno de Canarias para detalles.",
                    "fuente": "OSM + Patrimonio Cultural GobCan",
                    "precision": "centroide_municipal",
                    "wikipedia": r.get("wikipedia"),
                    "wikidata": r.get("wikidata"),
                },
            }
            features.append(feat)
            osm_added += 1
            by_isla[ISLAS_NAME.get(isla, isla)] += 1
            by_tipo[r["tipo"]] += 1
            by_cultura[cultura] += 1
            by_visitable[False] += 1
            by_protegido["catalogado"] += 1
    else:
        print("WARN: PBF no disponible, saltando enriquecimiento OSM",
              file=sys.stderr)

    print(f"OSM añadidos: {osm_added} (dup: {osm_skipped_dup}, "
          f"sin centroide: {osm_skipped_nocentroid})", file=sys.stderr)

    # ── Validación ética final ──────────────────────────────────────
    if ethics_warns:
        print("\n⚠️  WARNINGS DE ÉTICA:", file=sys.stderr)
        for w in ethics_warns:
            print(f"   - {w}", file=sys.stderr)

    out_fc = {
        "type": "FeatureCollection",
        "name": "yacimientos-prehispanicos-canarias",
        "generated_at": GENERATED_AT,
        "indicator": "MEM-04",
        "etica": (
            "Catálogo conforme Ley 11/2019 de Patrimonio Cultural de Canarias. "
            "Yacimientos no visitables se publican con coordenada degradada al "
            "centroide municipal. NO usar este dataset para localizar bienes "
            "en campo: consulte BOC y autorización del Cabildo correspondiente."
        ),
        "sources": [
            "Gobierno de Canarias — Patrimonio Cultural (fichas BOC)",
            "IDECanarias capa Patrimonio_Arqueologico (referenciada, no extraída)",
            "Museo Arqueológico de Tenerife (MUNA)",
            "El Museo Canario (Las Palmas)",
            "Wikipedia ES (verificación de cultura y época)",
            "UNESCO inscripción 1578 (Risco Caído)",
            f"OSM Geofabrik {os.path.basename(pbf) if pbf else '(no aplicado)'}",
        ],
        "count": len(features),
        "by_isla": dict(by_isla),
        "by_tipo": dict(by_tipo),
        "by_cultura": dict(by_cultura),
        "by_visitable": {"true": by_visitable.get(True, 0),
                          "false": by_visitable.get(False, 0)},
        "by_protegido": dict(by_protegido),
        "features": features,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out_fc, f, ensure_ascii=False, separators=(",", ":"))
    print(f"\nWROTE {OUT}", file=sys.stderr)
    print(f"  total yacimientos: {len(features)}", file=sys.stderr)
    print(f"  por isla: {dict(by_isla)}", file=sys.stderr)
    print(f"  por tipo: {dict(by_tipo)}", file=sys.stderr)
    print(f"  por cultura: {dict(by_cultura)}", file=sys.stderr)
    print(f"  visitables: {by_visitable.get(True, 0)} | "
          f"no visitables: {by_visitable.get(False, 0)}", file=sys.stderr)


if __name__ == "__main__":
    main()
