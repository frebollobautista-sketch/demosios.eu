#!/bin/bash
# ─────────────────────────────────────────────────────────────────────
# cowork-build-buildings.sh
#
# Orquesta la conversión de los datos descargados a archivos JSON por
# sección censal usables por el visor POLIS iso. Estrategia:
#
#   1. Descomprime los ZIPs de catastro en catastro_data/.
#   2. Corre `scripts/catastro-to-buildings.mjs` → genera buildings desde
#      GML (fuente principal — el catastro español tiene TODAS las
#      construcciones registradas).
#   3. Corre `scripts/pbf-to-buildings.py` → complementa con OSM las
#      secciones que catastro NO cubrió (o si catastro falló).
#   4. Audita cobertura: compara contra gc-secciones-lite.json y
#      prov38-secciones-lite.json. Reporta cusecs faltantes.
#
# Tiempo estimado: 5-20 min según hardware.
#
# Uso:
#   bash scripts/cowork-build-buildings.sh
# ─────────────────────────────────────────────────────────────────────

set -u

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO" || exit 1

CATASTRO_DEST="catastro_data"
OSM_PBF="GEOFABRIK/canary-islands-latest.osm.pbf"
BUILDINGS_OUT="public/buildings"
mkdir -p "$BUILDINGS_OUT"

echo "╔════════════════════════════════════════════════════════╗"
echo "║  Build buildings — fase 1: descomprimir ZIPs catastro  ║"
echo "╚════════════════════════════════════════════════════════╝"
UNZIPPED=0
for zip in "$CATASTRO_DEST"/A.ES.SDGC.BU.*.zip; do
  [ -f "$zip" ] || continue
  cod=$(basename "$zip" .zip | sed 's/A.ES.SDGC.BU.//')
  outdir="$CATASTRO_DEST/A.ES.SDGC.BU.${cod}"
  if [ -d "$outdir" ] && [ -f "$outdir"/A.ES.SDGC.BU.${cod}.building.gml ]; then
    continue   # ya descomprimido
  fi
  unzip -qo "$zip" -d "$outdir"
  UNZIPPED=$((UNZIPPED+1))
done
echo "  $UNZIPPED ZIPs descomprimidos (los ya hechos se saltan)."

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║  Fase 2: catastro GML → buildings JSON por sección     ║"
echo "╚════════════════════════════════════════════════════════╝"
if [ -f scripts/catastro-to-buildings.mjs ]; then
  if command -v node >/dev/null 2>&1; then
    node scripts/catastro-to-buildings.mjs || echo "  ⚠ catastro-to-buildings.mjs salió con error, sigo"
  else
    echo "  ⚠ node no encontrado — saltando catastro→buildings"
  fi
else
  echo "  ⚠ scripts/catastro-to-buildings.mjs no existe — saltando"
fi

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║  Fase 3: OSM PBF → buildings JSON (complemento)        ║"
echo "╚════════════════════════════════════════════════════════╝"
if [ ! -f "$OSM_PBF" ]; then
  echo "  ⚠ $OSM_PBF no existe — saltando fase OSM."
  echo "    Ejecuta scripts/cowork-download-buildings.sh primero si quieres."
else
  if command -v python3 >/dev/null 2>&1; then
    # Verificar dependencias
    python3 -c "import osmium, shapely" 2>/dev/null || {
      echo "  ⚠ Faltan dependencias osmium/shapely. Intenta:"
      echo "      pip install osmium shapely"
      echo "    Saltando fase OSM."
    }
    if python3 -c "import osmium, shapely" 2>/dev/null; then
      # Prov 35
      if [ -f scripts/pbf-to-buildings.py ]; then
        echo "── Prov 35 (GC + FV + LZ) ──"
        python3 scripts/pbf-to-buildings.py || echo "  ⚠ pbf-to-buildings.py error, sigo"
      fi
      # Prov 38
      if [ -f scripts/_pbf_to_buildings_prov38.py ]; then
        echo "── Prov 38 (TF + LP + LG + EH) ──"
        python3 scripts/_pbf_to_buildings_prov38.py || echo "  ⚠ _pbf_to_buildings_prov38.py error, sigo"
      fi
    fi
  else
    echo "  ⚠ python3 no encontrado — saltando fase OSM"
  fi
fi

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║  Fase 4: auditoría de cobertura                        ║"
echo "╚════════════════════════════════════════════════════════╝"
python3 <<'PY'
import json, os, collections
PUB = "public"
gc = json.load(open(f"{PUB}/gc-secciones-lite.json"))
p38 = json.load(open(f"{PUB}/prov38-secciones-lite.json"))

# Mapping mun→isla
muns_poly = json.load(open(f"{PUB}/canarias-municipios-poly.json"))
mun_to_isla = { f['properties']['cumun']: f['properties']['isla'] for f in muns_poly['features'] }

expected = []
for src in (gc, p38):
    for f in src['features']:
        cu = f['properties']['cusec']
        cumun = cu[:5]
        expected.append((cu, mun_to_isla.get(cumun, '??')))

have = set(f.replace('.json','') for f in os.listdir(f"{PUB}/buildings") if f.endswith('.json'))

per = collections.defaultdict(lambda: [0,0])
miss_per_isla = collections.defaultdict(list)
for cu, isla in expected:
    per[isla][1] += 1
    if cu in have:
        per[isla][0] += 1
    else:
        miss_per_isla[isla].append(cu)

print(f"{'isla':<6} {'have':>5} {'exp':>5} {'%':>6}")
total_have = total_exp = 0
for isla in sorted(per):
    h, e = per[isla]
    total_have += h; total_exp += e
    print(f"{isla:<6} {h:>5} {e:>5} {100*h/e:>5.1f}%")
print("-"*30)
print(f"{'TOTAL':<6} {total_have:>5} {total_exp:>5} {100*total_have/total_exp:>5.1f}%")

if any(miss_per_isla.values()):
    print("\nFaltantes por isla:")
    for isla, items in sorted(miss_per_isla.items()):
        if not items: continue
        print(f"  {isla}: {len(items)} cusecs")
        by_mun = collections.Counter(c[:5] for c in items)
        for cumun, n in by_mun.most_common(5):
            print(f"    {cumun}: {n}")
PY

echo ""
echo "── Listo. Si quedan faltantes:"
echo "    • Generar JSONs vacíos: bash scripts/cowork-fill-missing.sh   (opcional)"
echo "    • Investigar Overpass:  cada cusec faltante puede consultarse en https://overpass-turbo.eu"
