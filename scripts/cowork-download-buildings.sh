#!/bin/bash
# ─────────────────────────────────────────────────────────────────────
# cowork-download-buildings.sh
#
# Descarga TODOS los inputs necesarios para regenerar `public/buildings/`
# con cobertura 100% de las 7 islas Canarias:
#
#   1. Catastro INSPIRE Buildings de las 34 muns prov 35 (GC + FV + LZ)
#   2. Catastro INSPIRE Buildings de las 54 muns prov 38 (TF + LP + LG + EH)
#   3. PBF de Geofabrik (canary-islands-latest) como fallback OSM
#
# Pensado para correr una vez desde Cowork u otro entorno con ancho de
# banda. Descarga ≈ 2.5 GB. Tiempo ≈ 15-30 min según conexión.
#
# Uso:
#   bash scripts/cowork-download-buildings.sh [--skip-osm] [--skip-catastro]
#                                             [--prov 35|38|all]
#
# Salida:
#   catastro_data/A.ES.SDGC.BU.{cod}.zip   — 88 ZIPs (uno por mun)
#   GEOFABRIK/canary-islands-latest.osm.pbf
#
# Tras descargar, ejecutar `scripts/cowork-build-buildings.sh`.
# ─────────────────────────────────────────────────────────────────────

set -u

# ── Config ────────────────────────────────────────────────────────────
SKIP_OSM=0
SKIP_CATASTRO=0
PROV_FILTER="all"   # all | 35 | 38
THROTTLE=2          # segundos de pausa entre descargas exitosas (anti rate-limit)

while [ $# -gt 0 ]; do
  case "$1" in
    --skip-osm) SKIP_OSM=1; shift ;;
    --skip-catastro) SKIP_CATASTRO=1; shift ;;
    --prov) PROV_FILTER="$2"; shift 2 ;;
    -h|--help)
      echo "Uso: $0 [--skip-osm] [--skip-catastro] [--prov 35|38|all]"
      exit 0
      ;;
    *) echo "Flag desconocido: $1"; exit 1 ;;
  esac
done

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO" || { echo "No puedo cd a $REPO"; exit 1; }

CATASTRO_DEST="catastro_data"
OSM_DEST="GEOFABRIK"
mkdir -p "$CATASTRO_DEST" "$OSM_DEST"

UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
CATASTRO_BASE_35="https://www.catastro.hacienda.gob.es/INSPIRE/Buildings/35"
CATASTRO_BASE_38="https://www.catastro.hacienda.gob.es/INSPIRE/Buildings/38"
OSM_URL="https://download.geofabrik.de/africa/canary-islands-latest.osm.pbf"

# ── Listas de municipios ──────────────────────────────────────────────
# Pares "código nombre-para-URL" (nombre = UPPERCASE sin tildes, espacios
# y comas preservados según convenio INSPIRE).
MUNS_35=(
  "35001 AGAETE"
  "35002 AGUIMES"
  "35003 ANTIGUA"
  "35004 ARRECIFE"
  "35005 ARTENARA"
  "35006 ARUCAS"
  "35007 BETANCURIA"
  "35008 FIRGAS"
  "35009 GALDAR"
  "35010 HARIA"
  "35011 INGENIO"
  "35012 MOGAN"
  "35013 MOYA"
  "35014 OLIVA, LA"
  "35015 PAJARA"
  "35016 PALMAS DE GRAN CANARIA, LAS"
  "35017 PUERTO DEL ROSARIO"
  "35018 SAN BARTOLOME"
  "35019 SAN BARTOLOME DE TIRAJANA"
  "35020 ALDEA DE SAN NICOLAS, LA"
  "35021 SANTA BRIGIDA"
  "35022 SANTA LUCIA DE TIRAJANA"
  "35023 SANTA MARIA DE GUIA DE GRAN CANARIA"
  "35024 TEGUISE"
  "35025 TEJEDA"
  "35026 TELDE"
  "35027 TEROR"
  "35028 TIAS"
  "35029 TINAJO"
  "35030 TUINEJE"
  "35031 VALSEQUILLO DE GRAN CANARIA"
  "35032 VALLESECO"
  "35033 VEGA DE SAN MATEO"
  "35034 YAIZA"
)
MUNS_38=(
  "38001 ADEJE"
  "38002 AGULO"
  "38003 ALAJERO"
  "38004 ARAFO"
  "38005 ARICO"
  "38006 ARONA"
  "38007 BARLOVENTO"
  "38008 BRENA ALTA"
  "38009 BRENA BAJA"
  "38010 BUENAVISTA DEL NORTE"
  "38011 CANDELARIA"
  "38012 FASNIA"
  "38013 FRONTERA"
  "38014 FUENCALIENTE DE LA PALMA"
  "38015 GARACHICO"
  "38016 GARAFIA"
  "38017 GRANADILLA DE ABONA"
  "38018 GUANCHA, LA"
  "38019 GUIA DE ISORA"
  "38020 GUIMAR"
  "38021 HERMIGUA"
  "38022 ICOD DE LOS VINOS"
  "38023 SAN CRISTOBAL DE LA LAGUNA"
  "38024 LLANOS DE ARIDANE, LOS"
  "38025 MATANZA DE ACENTEJO, LA"
  "38026 OROTAVA, LA"
  "38027 PASO, EL"
  "38028 PUERTO DE LA CRUZ"
  "38029 PUNTAGORDA"
  "38030 PUNTALLANA"
  "38031 REALEJOS, LOS"
  "38032 ROSARIO, EL"
  "38033 SAN ANDRES Y SAUCES"
  "38034 SAN JUAN DE LA RAMBLA"
  "38035 SAN MIGUEL DE ABONA"
  "38036 SAN SEBASTIAN DE LA GOMERA"
  "38037 SANTA CRUZ DE LA PALMA"
  "38038 SANTA CRUZ DE TENERIFE"
  "38039 SANTA URSULA"
  "38040 SANTIAGO DEL TEIDE"
  "38041 SAUZAL, EL"
  "38042 SILOS, LOS"
  "38043 TACORONTE"
  "38044 TANQUE, EL"
  "38045 TAZACORTE"
  "38046 TEGUESTE"
  "38047 TIJARAFE"
  "38048 VALVERDE"
  "38049 VALLE GRAN REY"
  "38050 VALLEHERMOSO"
  "38051 VICTORIA DE ACENTEJO, LA"
  "38052 VILAFLOR DE CHASNA"
  "38053 VILLA DE MAZO"
  "38901 PINAR DE EL HIERRO, EL"
)

# ── Counters ──────────────────────────────────────────────────────────
OK=0; FAIL=0; SKIP=0
declare -a FAILED_MUNS

# ── Descarga 1 mun de catastro (con varios fallbacks de URL) ─────────
download_mun() {
  local cod="$1"
  local nombre="$2"
  local prov="${cod:0:2}"
  local base="$CATASTRO_BASE_35"
  [ "$prov" = "38" ] && base="$CATASTRO_BASE_38"

  local zip="A.ES.SDGC.BU.${cod}.zip"
  local path="$CATASTRO_DEST/$zip"

  # ¿Ya descargado y válido?
  if [ -f "$path" ]; then
    local size=$(wc -c < "$path" 2>/dev/null || echo 0)
    local magic=$(xxd -l 2 -p "$path" 2>/dev/null || echo "")
    if [ "$magic" = "504b" ] && [ "$size" -gt 10000 ]; then
      printf "  · %s %-40s ya existe (%d KB)\n" "$cod" "$nombre" "$(( size / 1024 ))"
      SKIP=$((SKIP+1))
      return 0
    fi
    rm -f "$path"
  fi

  # URL-encode del nombre (espacios → %20, comas → %2C)
  local nombre_url=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$nombre" 2>/dev/null || echo "$nombre")

  # 3 variantes de URL que INSPIRE usa según el mun
  local urls=(
    "${base}/${cod}-${nombre_url}/${zip}"
    "${base}/${cod}/${zip}"
    "https://www.catastro.hacienda.gob.es/INSPIRE/Buildings/${cod}/${zip}"
  )

  # -k: el servidor del Catastro presenta un cert de la CA del sector
  # publico (FNMT) cuya cadena curl no puede verificar -> sin -k aborta
  # la conexion (HTTP 000). El ZIP se valida igualmente por magic bytes.
  for url in "${urls[@]}"; do
    local attempt=1
    local maxattempts=5
    while [ "$attempt" -le "$maxattempts" ]; do
      printf "  ↓ %s %-40s " "$cod" "$nombre"
      local status=$(curl -sI -k --tlsv1.2 --max-time 20 \
        -H "User-Agent: $UA" \
        -w "%{http_code}" -o /dev/null "$url" 2>/dev/null)
      if [ "$status" = "200" ] || [ "$status" = "301" ] || [ "$status" = "302" ]; then
        curl -sL -k --tlsv1.2 --max-time 600 \
          -H "User-Agent: $UA" -H "Accept: */*" \
          -o "$path" "$url" 2>/dev/null
        if [ -f "$path" ]; then
          local size=$(wc -c < "$path" 2>/dev/null || echo 0)
          local magic=$(xxd -l 2 -p "$path" 2>/dev/null || echo "")
          if [ "$magic" = "504b" ] && [ "$size" -gt 10000 ]; then
            printf "%d KB ✓\n" "$(( size / 1024 ))"
            OK=$((OK+1))
            sleep "$THROTTLE"
            return 0
          fi
        fi
        rm -f "$path"
        # 'inválido' = el servidor devolvió HTML en vez del ZIP, casi
        # siempre por rate-limiting. Backoff creciente y reintento.
        if [ "$attempt" -lt "$maxattempts" ]; then
          local wait=$(( attempt * 10 ))
          printf "inválido — throttle, espera %ds (intento %d/%d)\n" \
            "$wait" "$attempt" "$maxattempts"
          sleep "$wait"
        else
          printf "inválido — agotados %d intentos\n" "$maxattempts"
        fi
        attempt=$(( attempt + 1 ))
      else
        printf "HTTP %s\n" "$status"
        break
      fi
    done
  done

  echo "  ✗ $cod $nombre — NO DISPONIBLE"
  FAIL=$((FAIL+1))
  FAILED_MUNS+=("$cod $nombre")
  return 1
}

# ── Bloque: catastro ──────────────────────────────────────────────────
if [ $SKIP_CATASTRO -eq 0 ]; then
  echo "╔════════════════════════════════════════════════════════╗"
  echo "║  Catastro INSPIRE Buildings — descarga                 ║"
  echo "╚════════════════════════════════════════════════════════╝"

  if [ "$PROV_FILTER" = "all" ] || [ "$PROV_FILTER" = "35" ]; then
    echo ""
    echo "── Prov 35 (Gran Canaria + Fuerteventura + Lanzarote) — ${#MUNS_35[@]} muns ──"
    for entry in "${MUNS_35[@]}"; do
      cod="${entry%% *}"
      nombre="${entry#* }"
      download_mun "$cod" "$nombre"
    done
  fi

  if [ "$PROV_FILTER" = "all" ] || [ "$PROV_FILTER" = "38" ]; then
    echo ""
    echo "── Prov 38 (Tenerife + La Palma + La Gomera + El Hierro) — ${#MUNS_38[@]} muns ──"
    for entry in "${MUNS_38[@]}"; do
      cod="${entry%% *}"
      nombre="${entry#* }"
      download_mun "$cod" "$nombre"
    done
  fi

  echo ""
  echo "── Resumen catastro ──"
  echo "  Descargados nuevos : $OK"
  echo "  Ya existían        : $SKIP"
  echo "  Fallidos           : $FAIL"
  if [ $FAIL -gt 0 ]; then
    echo ""
    echo "Muns fallidos (puedes reintentar manualmente o probar Overpass como fallback):"
    for m in "${FAILED_MUNS[@]}"; do
      echo "  - $m"
    done
  fi
fi

# ── Bloque: OSM PBF ───────────────────────────────────────────────────
if [ $SKIP_OSM -eq 0 ]; then
  echo ""
  echo "╔════════════════════════════════════════════════════════╗"
  echo "║  Geofabrik PBF — canary-islands-latest.osm.pbf         ║"
  echo "╚════════════════════════════════════════════════════════╝"
  PBF_PATH="$OSM_DEST/canary-islands-latest.osm.pbf"
  if [ -f "$PBF_PATH" ]; then
    local_size=$(wc -c < "$PBF_PATH" 2>/dev/null || echo 0)
    if [ "$local_size" -gt 40000000 ]; then  # >40 MB sano (el PBF pesa ~56 MB)
      echo "  · PBF ya existe ($(( local_size / 1024 / 1024 )) MB), saltando."
    else
      rm -f "$PBF_PATH"
    fi
  fi
  if [ ! -f "$PBF_PATH" ]; then
    echo "  ↓ Descargando $OSM_URL ..."
    curl -L --progress-bar -o "$PBF_PATH" "$OSM_URL"
    if [ -f "$PBF_PATH" ]; then
      echo "  ✓ PBF guardado en $PBF_PATH ($(( $(wc -c < "$PBF_PATH") / 1024 / 1024 )) MB)"
    else
      echo "  ✗ Fallo descarga PBF"
    fi
  fi
fi

# ── Resumen total ─────────────────────────────────────────────────────
echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║  Resumen total                                         ║"
echo "╚════════════════════════════════════════════════════════╝"
echo "  catastro_data/ ZIPs válidos:"
ok_zips=0
for f in "$CATASTRO_DEST"/*.zip; do
  [ -f "$f" ] || continue
  m=$(xxd -l 2 -p "$f" 2>/dev/null || echo "")
  [ "$m" = "504b" ] && ok_zips=$((ok_zips+1))
done
echo "    $ok_zips ZIPs (de 88 esperados)"
echo "  GEOFABRIK/:"
if [ -f "$OSM_DEST/canary-islands-latest.osm.pbf" ]; then
  echo "    canary-islands-latest.osm.pbf ($(( $(wc -c < "$OSM_DEST/canary-islands-latest.osm.pbf") / 1024 / 1024 )) MB)"
else
  echo "    (PBF ausente)"
fi
echo ""
echo "Siguiente paso: bash scripts/cowork-build-buildings.sh"
