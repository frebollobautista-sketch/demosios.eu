#!/bin/bash
# ─────────────────────────────────────────────────────────────────────
# auditar-buildings.sh
#
# Imprime la tabla de densidad de edificios (edif/sección) por municipio
# leyendo public/buildings/. Sirve para verificar el resultado del build
# sin tener que re-ejecutar todo el pipeline.
#
# Uso:
#   cd ~/KOINOS-iso
#   bash scripts/auditar-buildings.sh
# ─────────────────────────────────────────────────────────────────────

set -u
REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO" || { echo "No puedo entrar en $REPO"; exit 1; }

python3 <<'PY'
import json, os, collections
PUB = "public"
gc  = json.load(open(f"{PUB}/gc-secciones-lite.json"))
p38 = json.load(open(f"{PUB}/prov38-secciones-lite.json"))
muns = json.load(open(f"{PUB}/canarias-municipios-poly.json"))
mun_info = { f['properties']['cumun']: (f['properties']['nmun'], f['properties']['isla'])
             for f in muns['features'] }

per_mun = collections.defaultdict(lambda: [0, 0])  # [secciones, edificios]
for src in (gc, p38):
    for f in src['features']:
        cu  = f['properties']['cusec']
        mun = cu[:5]
        per_mun[mun][0] += 1
        path = f"{PUB}/buildings/{cu}.json"
        if os.path.exists(path):
            try:
                per_mun[mun][1] += len(json.load(open(path)))
            except Exception:
                pass

rows = []
for mun, (secs, edif) in per_mun.items():
    nmun, isla = mun_info.get(mun, ('?', '?'))
    rows.append((isla, mun, nmun, secs, edif, edif / secs if secs else 0))
rows.sort(key=lambda r: (r[0], -r[5]))

print(f"\n{'':3} {'mun':<6} {'nombre':<35} {'secs':>4} {'edif':>9} {'prom':>6}")
print("-" * 72)
cur = None
tot_s = tot_e = 0
flojos = []
for isla, mun, nmun, secs, edif, prom in rows:
    if isla != cur:
        print(f"\n[{isla.upper()}]")
        cur = isla
    flag = ' ⚠️' if prom < 50 else ('   ' if prom < 150 else ' ✓ ')
    if prom < 50:
        flojos.append((mun, nmun, prom))
    print(f"{flag} {mun:<6} {nmun[:34]:<35} {secs:>4} {edif:>9} {prom:>6.0f}")
    tot_s += secs
    tot_e += edif

print("\n" + "=" * 72)
print(f"TOTAL: {tot_e} edificios en {tot_s} secciones "
      f"(media {tot_e/tot_s if tot_s else 0:.0f} edif/sec)")
print("\nBenchmarks de referencia (catastro bien aplicado):")
print("  LPGC      35016  ~600 edif/sec")
print("  La Laguna 38023  ~880 edif/sec")
print("  Telde     35026  ~870 edif/sec")
if flojos:
    print(f"\n⚠️  {len(flojos)} municipios con densidad < 50 (revisar):")
    for mun, nmun, prom in flojos:
        print(f"     {mun}  {nmun}  ({prom:.0f} edif/sec)")
PY
