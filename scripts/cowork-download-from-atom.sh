#!/bin/bash
# ─────────────────────────────────────────────────────────────────────
# cowork-download-from-atom.sh
#
# Descarga catastro INSPIRE Buildings usando el ATOM feed oficial del
# Catastro para descubrir el código y nombre exactos de cada municipio.
#
# NO usa listas hardcoded — corrige el bug del script anterior donde
# códigos y nombres prov 35 estaban desfasados (35017 era LPGC, no
# Puerto del Rosario; SC Tenerife es 38900, no 38038; El Pinar es
# 38054, no 38901). Esto evita la mayoría de los falsos "throttle 404".
#
# Uso:
#   bash scripts/cowork-download-from-atom.sh [--prov 35|38|all]
#
# Salida: catastro_data/A.ES.SDGC.BU.{cod}.zip
# ─────────────────────────────────────────────────────────────────────

set -u

PROV_FILTER="all"
THROTTLE=3

while [ $# -gt 0 ]; do
  case "$1" in
    --prov) PROV_FILTER="$2"; shift 2 ;;
    -h|--help) echo "Uso: $0 [--prov 35|38|all]"; exit 0 ;;
    *) echo "Flag desconocido: $1"; exit 1 ;;
  esac
done

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO" || exit 1
mkdir -p catastro_data

UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

fetch_atom_urls() {
  local prov="$1"
  curl -sL -k --max-time 30 -H "User-Agent: $UA" \
    "https://www.catastro.hacienda.gob.es/INSPIRE/buildings/${prov}/ES.SDGC.bu.atom_${prov}.xml" |
    python3 -c "
import re, sys
raw = sys.stdin.buffer.read().decode('iso-8859-1', errors='replace')
# href de cada ZIP: https://.../{cod}-{nombre}/A.ES.SDGC.BU.{cod}.zip
for m in re.finditer(r'href=\"(https?://[^\"]+/A\\.ES\\.SDGC\\.BU\\.(\\d{5})\\.zip)\"', raw):
    url, code = m.group(1), m.group(2)
    print(f'{code}|{url}')
"
}

OK=0; SKIP=0; FAIL=0
declare -a FAILED

download_one() {
  local cod="$1"
  local url="$2"
  local zip="A.ES.SDGC.BU.${cod}.zip"
  local path="catastro_data/$zip"

  if [ -f "$path" ]; then
    local size=$(wc -c < "$path" 2>/dev/null || echo 0)
    local magic=$(xxd -l 2 -p "$path" 2>/dev/null || echo "")
    if [ "$magic" = "504b" ] && [ "$size" -gt 100000 ]; then
      printf "  · %s ya existe (%d KB)\n" "$cod" "$(( size / 1024 ))"
      SKIP=$((SKIP+1))
      return 0
    fi
    rm -f "$path"
  fi

  printf "  ↓ %s " "$cod"
  curl -sL -k --tlsv1.2 --max-time 600 \
    -H "User-Agent: $UA" -H "Accept: */*" \
    -o "$path" "$url" 2>/dev/null

  if [ -f "$path" ]; then
    local size=$(wc -c < "$path" 2>/dev/null || echo 0)
    local magic=$(xxd -l 2 -p "$path" 2>/dev/null || echo "")
    if [ "$magic" = "504b" ] && [ "$size" -gt 100000 ]; then
      printf "%d KB ✓\n" "$(( size / 1024 ))"
      OK=$((OK+1))
      sleep "$THROTTLE"
      return 0
    fi
  fi
  rm -f "$path"
  printf "FAIL\n"
  FAIL=$((FAIL+1))
  FAILED+=("$cod")
  return 1
}

process_prov() {
  local prov="$1"
  echo ""
  echo "── Descubriendo prov $prov desde ATOM ──"
  local urls=$(fetch_atom_urls "$prov")
  local total=$(echo "$urls" | grep -c '^[0-9]')
  echo "  $total muns en ATOM"
  echo ""
  echo "$urls" | while IFS='|' read -r cod url; do
    [ -z "$cod" ] && continue
    download_one "$cod" "$url"
  done
}

if [ "$PROV_FILTER" = "all" ] || [ "$PROV_FILTER" = "35" ]; then
  process_prov 35
fi
if [ "$PROV_FILTER" = "all" ] || [ "$PROV_FILTER" = "38" ]; then
  process_prov 38
fi

echo ""
echo "═══════════════════════════════════════════"
echo "  Descargados nuevos : $OK"
echo "  Ya existían        : $SKIP"
echo "  Fallidos           : $FAIL"
if [ $FAIL -gt 0 ]; then
  echo "  Códigos fallidos   : ${FAILED[*]}"
fi
echo "═══════════════════════════════════════════"
