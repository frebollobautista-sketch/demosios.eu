#!/bin/bash
# ─────────────────────────────────────────────────────────────────────
# cowork-fill-missing.sh
#
# Después de correr download + build, si quedan cusecs sin archivo de
# buildings (típicamente secciones rurales sin construcción registrada),
# este script genera un archivo `[]` vacío para cada uno. Así el visor
# no falla al fetcharlas — la sección se renderiza como polígono base
# sin edificios encima, que es lo correcto para zonas sin urbanizar.
#
# Uso:
#   bash scripts/cowork-fill-missing.sh
# ─────────────────────────────────────────────────────────────────────

set -u
REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO" || exit 1

python3 <<'PY'
import json, os
PUB = "public"
gc = json.load(open(f"{PUB}/gc-secciones-lite.json"))
p38 = json.load(open(f"{PUB}/prov38-secciones-lite.json"))

expected = set()
for src in (gc, p38):
    for f in src['features']:
        expected.add(f['properties']['cusec'])

have = set(f.replace('.json','') for f in os.listdir(f"{PUB}/buildings") if f.endswith('.json'))
missing = sorted(expected - have)

print(f"Faltantes a rellenar: {len(missing)}")
for cu in missing:
    path = f"{PUB}/buildings/{cu}.json"
    with open(path, "w") as fh:
        fh.write("[]")
    print(f"  + {cu}.json (vacío)")
print(f"Hecho. Ahora cobertura == 100% (con secciones-vacías para zonas sin OSM/catastro).")
PY
