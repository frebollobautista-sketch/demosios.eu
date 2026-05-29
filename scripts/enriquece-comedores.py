#!/usr/bin/env python3
"""
enriquece-comedores.py — Enriquece centros-educativos-prov35.geojson con
información de COMEDOR + BECAS escolares.

Estado: PLACEHOLDER. Marca todos los CEIP/CER públicos como
"comedor_publico" + las concertadas como "comedor_concertado". Cuando la
Consejería de Educación publique un listado nominal por centro, este
script se actualizará para hacer match preciso y reemplazar el placeholder.

Heurística usada (siempre marcada con `_estimado: true`):
- CEIP/CER públicos → tipo_comedor = "gratuito" si en municipios con tasa
  de paro alto (>15% ISTAC), "subvencionado_parcial" si paro <15%
- Concertados → "concertado"
- IES → "becas_estatales"
- Privados → "no_comedor" (por defecto)
- Programa "Desayunos Escolares Canarias" se asume disponible en TODOS
  los CEIP públicos (cobertura universal autonómica desde curso 2023-24)

Salida: public/data/comedores-escolares-canarias.geojson — extiende
features de centros-educativos con nuevas properties.
"""

import json
from pathlib import Path

ROOT = Path("/Users/panch/KOINOS-iso")
IN_EDU = ROOT / "public" / "data" / "centros-educativos-prov35.geojson"
IN_PARO = ROOT / "public" / "data" / "paro-registrado-muns.json"
OUT = ROOT / "public" / "data" / "comedores-escolares-canarias.geojson"


def cargar_paro():
    """Devuelve dict {mun_normalizado: paro_pct}."""
    with open(IN_PARO) as f:
        data = json.load(f)
    out = {}
    for cumun, info in (data.get("muns") or {}).items():
        nmun = (info or {}).get("nmun")
        pct = (info or {}).get("paro_pct")
        if nmun and pct is not None:
            out[nmun.upper().strip()] = pct
    return out


def main():
    if not IN_EDU.exists():
        print(f"ERROR: no encuentro {IN_EDU}")
        return
    paro_by_mun = cargar_paro()

    with open(IN_EDU) as f:
        fc = json.load(f)

    counts = {"gratuito": 0, "subvencionado_parcial": 0, "concertado": 0, "becas_estatales": 0, "no_comedor": 0}

    for feat in fc.get("features", []):
        p = feat.get("properties", {})
        etapa = (p.get("etapa") or "").upper().strip()
        categoria = (p.get("categoria") or "").lower().strip()
        mun = (p.get("municipio") or "").upper().strip()
        paro_pct = paro_by_mun.get(mun, 14.0)

        # Decisión tipo_comedor
        if etapa in ("CEIP", "CER", "CEE", "CEIP-CEPA", "CEIP-IES"):
            if categoria == "publico":
                if paro_pct > 15.0:
                    tipo = "gratuito"
                else:
                    tipo = "subvencionado_parcial"
            elif "concertado" in categoria:
                tipo = "concertado"
            else:
                tipo = "no_comedor"
        elif etapa.startswith("IES"):
            tipo = "becas_estatales"
        elif "CONCERTADO" in (p.get("naturaleza", "").upper()):
            tipo = "concertado"
        elif "PRIVADO" in (p.get("naturaleza", "").upper()):
            tipo = "no_comedor"
        else:
            tipo = "no_comedor"

        comedor_disponible = tipo not in ("no_comedor",)
        desayunos = etapa in ("CEIP", "CER", "CEIP-CEPA") and categoria == "publico"
        becas_programa = (
            "Programa Desayunos Escolares Canarias" if desayunos else
            "Beca Comedor Estatal MEFP" if tipo == "becas_estatales" else
            "Beca Comedor Estatal MEFP + autonómica" if tipo in ("gratuito", "subvencionado_parcial") else
            None
        )

        # Inyecta nuevas properties
        p["comedor"] = comedor_disponible
        p["tipo_comedor"] = tipo
        p["desayuno_disponible"] = desayunos
        p["becas_comedor_nombre"] = becas_programa
        p["_estimado"] = True
        p["_paro_mun_pct"] = round(paro_pct, 1)

        counts[tipo] += 1

    # Reescribe FC con metadata
    fc["version"] = "v0-placeholder-2026-05-27"
    fc["fuente"] = "Datos base centros-educativos-prov35.geojson + heurística por etapa/categoría y paro mun. Pendiente listado nominal Consejería Educación CAN."
    fc["counts_tipo_comedor"] = counts

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(fc, f, ensure_ascii=False)
    print(f"wrote {OUT}")
    print(f"  total centros: {len(fc.get('features', []))}")
    for tipo, n in counts.items():
        print(f"  {tipo}: {n}")


if __name__ == "__main__":
    main()
