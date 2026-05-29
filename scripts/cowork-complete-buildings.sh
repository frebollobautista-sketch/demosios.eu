#!/bin/bash
# ─────────────────────────────────────────────────────────────────────
# cowork-complete-buildings.sh
#
# Script COMPLETO Y AUTÓNOMO para regenerar `public/buildings/` con
# cobertura 100% real (no solo de archivos, sino de edificios) en las
# 7 islas Canarias.
#
# Diseñado para correr en Cowork (u otra máquina con IP distinta) ya
# que la descarga directa de catastro INSPIRE ha fallado parcialmente
# en la IP de Pancho — pero NO por rate-limiting real sino por la
# lista de muns hardcoded del script anterior. Este script:
#
#   1. Descarga catastro INSPIRE usando el ATOM feed oficial (auto-
#      descubre códigos y nombres correctos).
#   2. Complementa con OSM PBF Geofabrik (rellena edificios donde
#      catastro no cubre — zonas rurales, costas, etc.).
#   3. Audita densidad final por mun y compara contra benchmarks
#      conocidos (LPGC=598 edif/sec, La Laguna=878).
#
# Tiempo estimado: 30-60 min (descarga ~2.5 GB catastro + PBF, parsing).
# Espacio: ~5 GB en disco durante el proceso.
#
# Uso (desde Cowork):
#   cd ~/KOINOS-iso   # asumiendo repo clonado
#   bash scripts/cowork-complete-buildings.sh
#
# Recoger el resultado:
#   rsync -av --delete cowork:KOINOS-iso/public/buildings/ \
#                       /Users/panch/KOINOS-iso/public/buildings/
# ─────────────────────────────────────────────────────────────────────

set -u

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO" || { echo "Error: no puedo cd a $REPO"; exit 1; }

mkdir -p catastro_data GEOFABRIK logs public/buildings

UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
ATOM_BASE="https://www.catastro.hacienda.gob.es/INSPIRE/buildings"
OSM_PBF_URL="https://download.geofabrik.de/africa/canary-islands-latest.osm.pbf"
OSM_PBF="GEOFABRIK/canary-islands-latest.osm.pbf"

# ─────────────────────────────────────────────────────────────────────
# FASE 1 — Descarga catastro desde ATOM feed (auto-discovery)
# ─────────────────────────────────────────────────────────────────────

phase1_catastro() {
  echo ""
  echo "╔════════════════════════════════════════════════════════╗"
  echo "║  FASE 1 — Descarga catastro desde ATOM feed            ║"
  echo "╚════════════════════════════════════════════════════════╝"

  for prov in 35 38; do
    echo ""
    echo "── Provincia $prov ──"
    local atom_url="${ATOM_BASE}/${prov}/ES.SDGC.bu.atom_${prov}.xml"
    echo "  ↓ Atom feed: $atom_url"

    # Extraer (código, URL) de cada mun del ATOM
    local urls_file="logs/atom_prov${prov}.tsv"
    curl -sL -k --max-time 30 -H "User-Agent: $UA" "$atom_url" |
      python3 -c "
import re, sys
raw = sys.stdin.buffer.read().decode('iso-8859-1', errors='replace')
for m in re.finditer(r'href=\"(https?://[^\"]+/A\\.ES\\.SDGC\\.BU\\.(\\d{5})\\.zip)\"', raw):
    url, code = m.group(1), m.group(2)
    print(f'{code}\\t{url}')
" > "$urls_file"

    local n=$(wc -l < "$urls_file")
    echo "  $n muns descubiertos"

    local ok=0; local skip=0; local fail=0
    while IFS=$'\t' read -r cod url; do
      [ -z "$cod" ] && continue
      local zip="catastro_data/A.ES.SDGC.BU.${cod}.zip"

      # Idempotente: skip si ZIP válido
      if [ -f "$zip" ]; then
        local size=$(wc -c < "$zip" 2>/dev/null || echo 0)
        local magic=$(xxd -l 2 -p "$zip" 2>/dev/null || echo "")
        if [ "$magic" = "504b" ] && [ "$size" -gt 100000 ]; then
          skip=$((skip+1))
          continue
        fi
        rm -f "$zip"
      fi

      printf "  ↓ %s " "$cod"
      curl -sL -k --tlsv1.2 --max-time 600 \
        -H "User-Agent: $UA" -H "Accept: */*" \
        -o "$zip" "$url" 2>/dev/null

      if [ -f "$zip" ]; then
        local size=$(wc -c < "$zip" 2>/dev/null || echo 0)
        local magic=$(xxd -l 2 -p "$zip" 2>/dev/null || echo "")
        if [ "$magic" = "504b" ] && [ "$size" -gt 100000 ]; then
          printf "%d KB ✓\n" "$(( size / 1024 ))"
          ok=$((ok+1))
          sleep 2  # cortesía leve, no rate-limit real
          continue
        fi
      fi
      rm -f "$zip"
      printf "FAIL\n"
      fail=$((fail+1))
    done < "$urls_file"

    echo "  Prov $prov: ok=$ok skip=$skip fail=$fail"
  done

  echo ""
  echo "── Total ZIPs en catastro_data/ ──"
  ls catastro_data/*.zip 2>/dev/null | wc -l
}

# ─────────────────────────────────────────────────────────────────────
# FASE 2 — Descomprimir ZIPs catastro
# ─────────────────────────────────────────────────────────────────────

phase2_unzip() {
  echo ""
  echo "╔════════════════════════════════════════════════════════╗"
  echo "║  FASE 2 — Descomprimir ZIPs catastro                   ║"
  echo "╚════════════════════════════════════════════════════════╝"
  local unzipped=0
  for zip in catastro_data/A.ES.SDGC.BU.*.zip; do
    [ -f "$zip" ] || continue
    local cod=$(basename "$zip" .zip | sed 's/A.ES.SDGC.BU.//')
    local outdir="catastro_data/A.ES.SDGC.BU.${cod}"
    [ -d "$outdir" ] && [ -f "$outdir/A.ES.SDGC.BU.${cod}.building.gml" ] && continue
    unzip -qo "$zip" -d "$outdir"
    unzipped=$((unzipped+1))
  done
  echo "  $unzipped ZIPs descomprimidos (existentes saltados)"
}

# ─────────────────────────────────────────────────────────────────────
# FASE 3 — Procesar catastro GML → buildings JSON
# ─────────────────────────────────────────────────────────────────────

phase3_catastro_to_buildings() {
  echo ""
  echo "╔════════════════════════════════════════════════════════╗"
  echo "║  FASE 3 — Catastro GML → buildings JSON por sección    ║"
  echo "╚════════════════════════════════════════════════════════╝"
  if ! command -v node >/dev/null 2>&1; then
    echo "  ⚠ node no encontrado — fase 3 saltada"
    return 1
  fi
  node scripts/catastro-to-buildings.mjs 2>&1 | tee logs/catastro-build.log | tail -10
  echo ""
  echo "  Log completo: logs/catastro-build.log"
}

# ─────────────────────────────────────────────────────────────────────
# FASE 4 — Descargar PBF Geofabrik (si falta)
# ─────────────────────────────────────────────────────────────────────

phase4_pbf() {
  echo ""
  echo "╔════════════════════════════════════════════════════════╗"
  echo "║  FASE 4 — PBF Geofabrik canary-islands                 ║"
  echo "╚════════════════════════════════════════════════════════╝"
  if [ -f "$OSM_PBF" ]; then
    local size=$(wc -c < "$OSM_PBF" 2>/dev/null || echo 0)
    # El PBF de canary-islands pesa ~56 MB. El umbral anterior (100 MB)
    # borraba un PBF perfectamente válido y forzaba re-descarga.
    if [ "$size" -gt 40000000 ]; then
      echo "  · PBF ya presente ($(( size / 1024 / 1024 )) MB)"
      return 0
    fi
    rm -f "$OSM_PBF"
  fi
  echo "  ↓ Descargando $OSM_PBF_URL"
  curl -L --progress-bar -o "$OSM_PBF" "$OSM_PBF_URL"
  if [ -f "$OSM_PBF" ]; then
    echo "  ✓ PBF guardado ($(( $(wc -c < "$OSM_PBF") / 1024 / 1024 )) MB)"
  else
    echo "  ✗ Fallo descarga PBF"
    return 1
  fi
}

# ─────────────────────────────────────────────────────────────────────
# FASE 5 — Procesar PBF → buildings JSON (complemento OSM)
# ─────────────────────────────────────────────────────────────────────
#
# El script catastro-to-buildings sobreescribe los archivos. Si para
# alguna sección catastro no aportó datos (mun no descargado), el
# archivo previo se mantiene — pero la mayoría de previos son del PBF
# del 2026-04. Para muns que catastro nuevo no tocó, conviene refrescar
# con PBF actualizado.
#
# CUIDADO: este script SOBREESCRIBE buildings. Para preservar catastro
# y solo complementar con OSM donde catastro no llegó, modificaríamos
# pbf-to-buildings para que solo escriba si el archivo destino NO existe
# o está vacío. Pero el comportamiento estándar (sobreescribir) es OK
# si lo corremos ANTES que catastro. Aquí lo corremos DESPUÉS para que
# catastro tenga prioridad: pbf solo escribe lo que no haya.
#
# El script tal y como está sobreescribe. Necesitamos un wrapper que
# preserve los catastro existentes.

phase5_pbf_complement() {
  echo ""
  echo "╔════════════════════════════════════════════════════════╗"
  echo "║  FASE 5 — PBF OSM → complementar buildings              ║"
  echo "╚════════════════════════════════════════════════════════╝"
  if [ ! -f "$OSM_PBF" ]; then
    echo "  ⚠ PBF ausente, fase 5 saltada"
    return 1
  fi
  if ! command -v python3 >/dev/null 2>&1; then
    echo "  ⚠ python3 no encontrado"
    return 1
  fi
  if ! python3 -c "import osmium, shapely" 2>/dev/null; then
    echo "  ⚠ Falta osmium/shapely. Instala con:"
    echo "      pip3 install osmium shapely"
    echo "  Fase 5 saltada."
    return 1
  fi

  echo "  · Corriendo pbf-to-buildings.py (prov 35)..."
  python3 scripts/pbf-to-buildings.py 2>&1 | tee logs/pbf-gc.log | tail -5
  echo ""
  if [ -f scripts/_pbf_to_buildings_prov38.py ]; then
    echo "  · Corriendo _pbf_to_buildings_prov38.py..."
    python3 scripts/_pbf_to_buildings_prov38.py 2>&1 | tee logs/pbf-tf.log | tail -5
  fi

  # El PBF (OSM) acaba de sobreescribir secciones con datos de menor
  # calidad que catastro. Catastro es la fuente autoritativa y mucho más
  # densa, así que lo re-ejecutamos AL FINAL: gana en todas sus secciones
  # y OSM queda solo donde catastro no llega.
  #
  # (El esquema anterior de backup+merge NO funcionaba: 'cp -R' sobre
  #  public/buildings —que es un symlink— copiaba el symlink, no los
  #  datos; el "backup" y el destino eran el mismo directorio, así que
  #  el merge comparaba cada archivo consigo mismo y no restauraba nada.)
  echo ""
  echo "  · Re-ejecutando catastro para que tenga prioridad sobre OSM..."
  if command -v node >/dev/null 2>&1; then
    node scripts/catastro-to-buildings.mjs 2>&1 | tee logs/catastro-final.log | tail -8
  else
    echo "  ⚠ node no encontrado — catastro NO re-aplicado, revisar resultado"
  fi
}

# ─────────────────────────────────────────────────────────────────────
# FASE 6 — Audit final
# ─────────────────────────────────────────────────────────────────────

phase6_audit() {
  echo ""
  echo "╔════════════════════════════════════════════════════════╗"
  echo "║  FASE 6 — Audit final por mun                          ║"
  echo "╚════════════════════════════════════════════════════════╝"
  python3 <<'PY'
import json, os, collections
PUB = "public"
gc = json.load(open(f"{PUB}/gc-secciones-lite.json"))
p38 = json.load(open(f"{PUB}/prov38-secciones-lite.json"))
muns = json.load(open(f"{PUB}/canarias-municipios-poly.json"))
mun_info = { f['properties']['cumun']: (f['properties']['nmun'], f['properties']['isla'])
             for f in muns['features'] }

per_mun = collections.defaultdict(lambda: [0, 0])  # [secs, total_edif]
for src in (gc, p38):
    for f in src['features']:
        cu = f['properties']['cusec']
        mun = cu[:5]
        per_mun[mun][0] += 1
        path = f"{PUB}/buildings/{cu}.json"
        if os.path.exists(path):
            try: per_mun[mun][1] += len(json.load(open(path)))
            except: pass

# Imprimir todos los muns ordenados por isla, luego por densidad
rows = []
for mun, (secs, edif) in per_mun.items():
    nmun, isla = mun_info.get(mun, ('?','?'))
    prom = edif / secs if secs else 0
    rows.append((isla, mun, nmun, secs, edif, prom))
rows.sort(key=lambda r: (r[0], -r[5]))

print(f"\n{'isla':<4} {'mun':<6} {'nombre':<35} {'secs':>4} {'edif':>7} {'prom':>5}")
print("-" * 70)
current_isla = None
for isla, mun, nmun, secs, edif, prom in rows:
    if isla != current_isla:
        print(f"\n[{isla.upper()}]")
        current_isla = isla
    flag = ' ⚠️' if prom < 50 else ('   ' if prom < 150 else ' ✓ ')
    print(f"{flag} {mun:<6} {nmun[:34]:<35} {secs:>4} {edif:>7} {prom:>5.0f}")

print("\n" + "=" * 70)
print("Benchmarks de referencia:")
print("  LPGC      (35016): debería ~600 edif/sec")
print("  La Laguna (38023): debería ~880 edif/sec")
print("  Telde     (35026): debería ~870 edif/sec")
print("\n⚠️  = densidad < 50 (probablemente solo OSM sin catastro)")
print("✓   = densidad ≥ 150 (catastro corrido OK)")
PY
}

# ─────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────

ts() { date '+%H:%M:%S'; }
echo "Inicio: $(ts)"

phase1_catastro
phase2_unzip
phase3_catastro_to_buildings
phase4_pbf
phase5_pbf_complement
phase6_audit

echo ""
echo "Fin: $(ts)"
echo ""
echo "Para recoger los resultados en local:"
echo "  rsync -av cowork:KOINOS-iso/public/buildings/ ./public/buildings/"
echo ""
echo "Si la densidad de algún mun sigue baja (< 150 edif/sec) revisa:"
echo "  - logs/catastro-build.log  → fallos de procesar GML"
echo "  - logs/pbf-gc.log          → cobertura OSM"
echo "  - logs/atom_prov35.tsv     → muns que descubrió el ATOM"
