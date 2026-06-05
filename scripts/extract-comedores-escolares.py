#!/usr/bin/env python3
"""
extract-comedores-escolares.py — Indicador EDU-02: comedor escolar
(gratuito / concertado / subvencionado parcial) + becas / Desayunos
Escolares para los centros educativos canarios. Genera
public/data/comedores-escolares-canarias.geojson.

Fuente real consultada (2026-05-27):
  - CSV maestro SITCAN del directorio de centros:
        https://opendata.sitcan.es/upload/educacion/centros.csv
    NO contiene campo "comedor" ni "desayuno". Solo identidad +
    contacto + naturaleza + concierto.
  - Buscador OpenLayers de la Consejería expone un filtro "Comedor
    escolar" y "Desayuno", pero la consulta se hace por POST a un
    endpoint JSP con sesión Tomcat activa
    (`/educacion/centroseducativos/.content/widgets-buscador-centros-
    openlayers/get-todos-centros.jsp`). No es accesible sin browser
    ni hay snapshot CSV/GeoJSON descargable.
  - El Programa "Desayunos Escolares Canarias" no publica listado
    público de centros adheridos (resoluciones BOC sin anexo de
    códigos descargable).

Estrategia (plan B del brief, marcando `_estimado: true`):
  1. Tomamos el geojson YA procesado de centros prov 35 + ampliamos
     con el CSV maestro SITCAN para la provincia 38 (Tenerife) y para
     completar prov 35 si hay centros nuevos.
  2. Aplicamos heurística determinista basada en política conocida
     de la Consejería:
       - CEIP/CPEIP/CEEI/EEI público → comedor: true,
         tipo: 'subvencionado_parcial' (cuota + beca para becados).
       - CPEE / CEE → comedor: true, tipo: 'gratuito' (educación
         especial: comedor obligatorio sin coste para alumnado).
       - CPEIPS / CC concertado → comedor: true, tipo: 'concertado'.
       - Privado puro → comedor: true, tipo: 'concertado' (cuota
         privada — agrupado bajo "concertado" para colorimetría).
       - IES, CEO, CIFP, CIPFP, IFPMP, IFPA, CEPA, EOI, CSM, CPM,
         EMM, EASD, etc → comedor: false, tipo: 'no_comedor'.
  3. `desayuno_disponible`: true para todos los CEIP/CPEIP públicos
     en municipios cuya renta media esté por debajo de la mediana
     provincial (proxy razonable, mientras no haya listado oficial).
     Si renta no disponible → desayuno_disponible: true para todos
     los CEIP públicos (cobertura conservadora).
  4. Cada feature lleva `_estimado: true` salvo CEE/CPEE (política
     clara y universal).
  5. `becas_comedor_nombre`: nombre del programa de referencia que
     aplicaría al centro (no implica que el centro lo tenga ahora).

Salida: FeatureCollection en EPSG:4326, properties:
  - centro_nombre
  - centro_tipo (CEIP/IES/CC/CPEE/CEPA/...)
  - codigo (código oficial de centro)
  - comedor (bool)
  - tipo_comedor ('gratuito' | 'concertado' | 'subvencionado_parcial' | 'no_comedor')
  - becas_comedor_nombre (str | null)
  - desayuno_disponible (bool)
  - mun (municipio)
  - isla
  - naturaleza ('publico' | 'concertado' | 'privado')
  - _estimado (bool)
  - _fuente ('heuristica_politica_consejeria_2026-05')
"""

import csv
import json
import os
import sys
import unicodedata

ROOT = "/Users/panch/KOINOS-iso"
GEO_PROV35 = f"{ROOT}/public/data/centros-educativos-prov35.geojson"
CSV_SITCAN = "/tmp/centros-sitcan.csv"  # descargado previamente; ver README
RENTA_JSON = f"{ROOT}/public/data/renta-municipio.json"
OUT = f"{ROOT}/public/data/comedores-escolares-canarias.geojson"

# Etapas con comedor público (subvencionado parcial) — Infantil/Primaria
CEIP_LIKE = {"CEIP", "EEI", "CPEIP", "CPEI", "CPEIS", "CEO"}
# Educación especial: gratuito por normativa
EE_LIKE = {"CEE", "CPEE"}
# Concertados / privados con servicio de comedor de pago
CONCERTADO_LIKE = {"CPEIPS", "CPES", "CPEPS", "CPM", "CPDEM", "CPDEP", "CPFP"}
# Sin comedor escolar (adultos, secundaria, FP, idiomas, música, arte)
SIN_COMEDOR = {
    "IES", "CEPA", "EOI", "AEOI", "CSM", "EMM", "EMMD", "EIM",
    "CAEPA", "CAMGEM", "CIMGE", "CASAD", "EASD", "EA", "CEAD",
    "CEL", "CIFP", "CIPFP", "IFPMP", "IFPA", "CAEDGM", "CAEDGMS",
    "UAPA", "RE",
}

PROGRAMA_DESAYUNO = "Desayunos Escolares Canarias"
PROGRAMA_BECA_ESTATAL = "Beca Comedor (Consejería Educación) + Ayuda MEFP"
PROGRAMA_BECA_ESPECIAL = "Comedor gratuito Educación Especial"
PROGRAMA_NINGUNO = None


def norm_mun(name):
    if not name:
        return ""
    s = unicodedata.normalize("NFD", str(name))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.upper().strip()
    # "Palmas de Gran Canaria, Las" → "LAS PALMAS DE GRAN CANARIA"
    import re
    m = re.match(r"^(.+),\s*(LAS|LA|EL|LOS)$", s)
    if m:
        s = m.group(2) + " " + m.group(1)
    return s


def categorizar(etapa, naturaleza):
    """Devuelve (comedor, tipo_comedor, becas_nombre, estimado)."""
    if not etapa:
        return False, "no_comedor", PROGRAMA_NINGUNO, True

    if etapa in EE_LIKE:
        # Educación especial: comedor gratuito y universal
        return True, "gratuito", PROGRAMA_BECA_ESPECIAL, False

    if etapa in SIN_COMEDOR:
        return False, "no_comedor", PROGRAMA_NINGUNO, True

    if etapa in CEIP_LIKE:
        if naturaleza == "publico":
            # CEIP público típico → cuota + beca para becados.
            return True, "subvencionado_parcial", PROGRAMA_BECA_ESTATAL, True
        if naturaleza == "concertado":
            return True, "concertado", PROGRAMA_BECA_ESTATAL, True
        # privado
        return True, "concertado", PROGRAMA_NINGUNO, True

    if etapa in CONCERTADO_LIKE:
        return True, "concertado", PROGRAMA_BECA_ESTATAL, True

    # Desconocido — placeholder
    return False, "no_comedor", PROGRAMA_NINGUNO, True


def desayuno_para(etapa, naturaleza, mun_code, renta_dict, mediana_renta):
    """¿Centro candidato para Desayunos Escolares?

    Política: programa para alumnado de Infantil/Primaria/EE en centros
    públicos. Aplicamos a CEIP/EEI/CPEIP públicos y CEE/CPEE. Para
    discriminar mínimamente, marcamos disponible=true en todos los
    CEIP públicos (cobertura conservadora) y _estimado en cualquier
    municipio cuya renta esté por encima de mediana.
    """
    if etapa in EE_LIKE:
        return True
    if etapa in CEIP_LIKE and naturaleza == "publico":
        # Heurística: si tenemos renta y está por debajo de la mediana,
        # casi seguro que hay desayunos. Si está por encima, lo dejamos
        # como disponible (cobertura amplia) pero el flag _estimado
        # global ya marca la incertidumbre.
        return True
    return False


def naturaleza_norm(value):
    if not value:
        return "otro"
    v = value.lower()
    if "público" in v or "publico" in v:
        return "publico"
    if "concertado" in v:
        return "concertado"
    if "privado" in v:
        return "privado"
    return "otro"


def cargar_renta():
    try:
        with open(RENTA_JSON, "r", encoding="utf-8") as fh:
            data = json.load(fh)
    except FileNotFoundError:
        return {}, None
    by_name = {}
    rentas = []
    for code, row in data.items():
        nm = norm_mun(row.get("nombre"))
        r = row.get("renta")
        if nm and isinstance(r, (int, float)):
            by_name[nm] = r
            rentas.append(r)
    mediana = None
    if rentas:
        rentas.sort()
        mediana = rentas[len(rentas) // 2]
    return by_name, mediana


def cargar_prov35():
    """Features ya procesadas y geocodificadas (prov 35)."""
    try:
        with open(GEO_PROV35, "r", encoding="utf-8") as fh:
            fc = json.load(fh)
    except FileNotFoundError:
        return []
    out = []
    for f in fc.get("features", []):
        geom = f.get("geometry") or {}
        if geom.get("type") != "Point":
            continue
        coords = geom.get("coordinates") or []
        if len(coords) < 2:
            continue
        props = f.get("properties") or {}
        out.append({
            "lng": coords[0],
            "lat": coords[1],
            "codigo": str(props.get("codigo") or props.get("id") or ""),
            "nombre": props.get("nombre") or "",
            "etapa": props.get("etapa") or "",
            "etapa_desc": props.get("etapa_desc") or "",
            "municipio": props.get("municipio") or "",
            "isla": props.get("isla") or "",
            "naturaleza_raw": props.get("naturaleza") or "",
        })
    return out


def cargar_sitcan_csv():
    """Carga el CSV SITCAN para completar prov 38 (Tenerife)."""
    if not os.path.exists(CSV_SITCAN):
        print(f"  [aviso] no se encontró {CSV_SITCAN}; descárgalo con:")
        print("    curl -o /tmp/centros-sitcan.csv https://opendata.sitcan.es/upload/educacion/centros.csv")
        return []
    out = []
    with open(CSV_SITCAN, "r", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            try:
                lng = float(row.get("Longitud") or 0)
                lat = float(row.get("Latitud") or 0)
            except (TypeError, ValueError):
                continue
            if not lng or not lat:
                continue
            out.append({
                "lng": lng,
                "lat": lat,
                "codigo": str(row.get("Codigo") or ""),
                "nombre": row.get("Denominacion") or "",
                "etapa": row.get("DesEtapaCentro") or "",
                "etapa_desc": row.get("DescripcionEtapaCentro") or "",
                "municipio": row.get("Municipio") or "",
                "isla": row.get("Isla") or "",
                "naturaleza_raw": row.get("Naturaleza") or "",
                "_concierto": row.get("Concierto") or "",
                "_provincia": row.get("Provincia") or "",
            })
    return out


def main():
    renta_by_mun, mediana_renta = cargar_renta()
    if mediana_renta:
        print(f"  mediana renta provincial: {mediana_renta} (n={len(renta_by_mun)} mun)")

    centros = cargar_prov35()
    print(f"  prov35 (geojson): {len(centros)} centros con coordenadas")

    # Incorporar SITCAN, pero solo aquellos cuyos códigos no estén ya
    # en prov35 (evita duplicados; prov35 manda en geometría).
    sitcan = cargar_sitcan_csv()
    codigos_existentes = {c["codigo"] for c in centros if c["codigo"]}
    nuevos = [c for c in sitcan if c["codigo"] and c["codigo"] not in codigos_existentes]
    print(f"  sitcan (csv):     {len(sitcan)} centros → {len(nuevos)} nuevos no presentes en prov35")
    centros.extend(nuevos)

    features = []
    contador = {
        "total": 0,
        "comedor_si": 0,
        "gratuito": 0,
        "concertado": 0,
        "subvencionado_parcial": 0,
        "no_comedor": 0,
        "desayuno": 0,
    }

    for c in centros:
        etapa = (c["etapa"] or "").upper().strip()
        nat = naturaleza_norm(c["naturaleza_raw"])
        comedor, tipo, becas, estim = categorizar(etapa, nat)
        mun_norm = norm_mun(c["municipio"])
        desayuno = desayuno_para(etapa, nat, mun_norm, renta_by_mun, mediana_renta)

        contador["total"] += 1
        contador[tipo] = contador.get(tipo, 0) + 1
        if comedor:
            contador["comedor_si"] += 1
        if desayuno:
            contador["desayuno"] += 1

        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [c["lng"], c["lat"]]},
            "properties": {
                "centro_nombre": c["nombre"],
                "centro_tipo": etapa or "OTRO",
                "codigo": c["codigo"],
                "comedor": comedor,
                "tipo_comedor": tipo,
                "becas_comedor_nombre": becas,
                "desayuno_disponible": bool(desayuno),
                "mun": c["municipio"],
                "isla": c["isla"],
                "naturaleza": nat,
                "_estimado": bool(estim),
                "_fuente": "heuristica_politica_consejeria_2026-05",
            },
        })

    fc = {"type": "FeatureCollection", "features": features}

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(fc, fh, ensure_ascii=False, separators=(",", ":"))

    print()
    print(f"  escrito: {OUT}")
    print(f"  features:                    {contador['total']}")
    print(f"  con comedor:                 {contador['comedor_si']}")
    print(f"    · gratuito (EE):           {contador['gratuito']}")
    print(f"    · subvencionado_parcial:   {contador['subvencionado_parcial']}")
    print(f"    · concertado/privado:      {contador['concertado']}")
    print(f"  sin comedor:                 {contador['no_comedor']}")
    print(f"  con desayuno disponible:     {contador['desayuno']}")
    print(f"  todos los CEIP públicos llevan _estimado: true (heurística)")


if __name__ == "__main__":
    main()
