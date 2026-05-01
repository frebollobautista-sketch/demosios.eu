#!/bin/bash
# Descarga ZIPs del Catastro INSPIRE Buildings para Gran Canaria
# v3: URLs directas INSPIRE, sin depender del ATOM feed
#
# Ejecutar: cd ~/KOINOS && bash scripts/descargar_catastro_v3.sh
#
# Si un municipio falla, el script continúa con el siguiente.
# Al final muestra resumen de éxitos/fallos.

DEST="catastro_data"
mkdir -p "$DEST"

echo "╔═══════════════════════════════════════════════════╗"
echo "║  Catastro INSPIRE Buildings — Gran Canaria        ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

# Base URL del servicio INSPIRE (formato ATOM download)
BASE="https://www.catastro.hacienda.gob.es/INSPIRE/Buildings/35"

OK=0
FAIL=0
SKIP=0

download() {
  local cod="$1"
  local nombre="$2"
  local zip="A.ES.SDGC.BU.${cod}.zip"
  local path="$DEST/$zip"

  # Ya descargado y válido?
  if [ -f "$path" ]; then
    local size=$(wc -c < "$path" 2>/dev/null || echo 0)
    local magic=$(xxd -l 2 -p "$path" 2>/dev/null)
    if [ "$magic" = "504b" ] && [ "$size" -gt 10000 ]; then
      echo "  ✓ $cod $nombre — ya existe ($(( size / 1024 )) KB)"
      SKIP=$((SKIP+1))
      return 0
    fi
    rm -f "$path"
  fi

  # Intentar múltiples formatos de URL
  local urls=(
    "${BASE}/${cod}-${nombre}/${zip}"
    "${BASE}/${cod}/${zip}"
    "https://www.catastro.hacienda.gob.es/INSPIRE/Buildings/${cod}/${zip}"
  )

  for url in "${urls[@]}"; do
    echo -n "  ↓ $cod $nombre... "

    # Primero HEAD para verificar que existe
    local status=$(curl -sI --tlsv1.2 --max-time 15 \
      -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" \
      -w "%{http_code}" -o /dev/null "$url" 2>/dev/null)

    if [ "$status" = "200" ] || [ "$status" = "301" ] || [ "$status" = "302" ]; then
      # Descargar
      curl -sL --tlsv1.2 --max-time 300 \
        -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" \
        -H "Accept: */*" \
        -o "$path" "$url" 2>/dev/null

      # Verificar
      if [ -f "$path" ]; then
        local size=$(wc -c < "$path" 2>/dev/null || echo 0)
        local magic=$(xxd -l 2 -p "$path" 2>/dev/null)
        if [ "$magic" = "504b" ] && [ "$size" -gt 10000 ]; then
          echo "$(( size / 1024 )) KB ✓"
          OK=$((OK+1))
          return 0
        fi
      fi
      echo "inválido"
      rm -f "$path"
    else
      echo "HTTP $status"
    fi
  done

  # Último intento: descargar la página del municipio y buscar el enlace
  echo "  ↓ $cod buscando enlace alternativo..."
  local page=$(curl -sL --tlsv1.2 --max-time 15 \
    -H "User-Agent: Mozilla/5.0" \
    "${BASE}/${cod}-${nombre}/" 2>/dev/null)

  local alt_url=$(echo "$page" | grep -oP 'href="[^"]*\.zip"' | head -1 | sed 's/href="//;s/"//')
  if [ -n "$alt_url" ]; then
    # Si es relativa, completar
    [[ "$alt_url" != http* ]] && alt_url="${BASE}/${cod}-${nombre}/${alt_url}"
    echo -n "  ↓ $cod desde enlace... "
    curl -sL --tlsv1.2 --max-time 300 \
      -H "User-Agent: Mozilla/5.0" \
      -o "$path" "$alt_url" 2>/dev/null

    if [ -f "$path" ]; then
      local magic=$(xxd -l 2 -p "$path" 2>/dev/null)
      local size=$(wc -c < "$path" 2>/dev/null || echo 0)
      if [ "$magic" = "504b" ] && [ "$size" -gt 10000 ]; then
        echo "$(( size / 1024 )) KB ✓"
        OK=$((OK+1))
        return 0
      fi
    fi
    rm -f "$path"
  fi

  echo "  ✗ $cod $nombre — NO DISPONIBLE"
  FAIL=$((FAIL+1))
  return 1
}

# 21 municipios de Gran Canaria + 1 duplicado (LPGC tiene 35011 y 35017)
download "35001" "AGAETE"
download "35002" "AGUIMES"
download "35003" "ARTENARA"
download "35004" "ARUCAS"
download "35006" "FIRGAS"
download "35007" "GALDAR"
download "35008" "INGENIO"
download "35009" "MOGAN"
download "35010" "MOYA"
download "35011" "PALMAS DE GRAN CANARIA, LAS"
download "35012" "SAN BARTOLOME DE TIRAJANA"
download "35013" "SANTA BRIGIDA"
download "35014" "SANTA LUCIA DE TIRAJANA"
download "35015" "SANTA MARIA DE GUIA DE GRAN CANARIA"
download "35017" "LAS PALMAS DE GRAN CANARIA"
download "35018" "TELDE"
download "35019" "TEROR"
download "35020" "VALLESECO"
download "35021" "VALSEQUILLO DE GRAN CANARIA"
download "35022" "VEGA DE SAN MATEO"
download "35023" "TEJEDA"
download "35024" "ALDEA DE SAN NICOLAS, LA"

echo ""
echo "═══════════════════════════════════════"
echo "  Descargados: $OK"
echo "  Ya existían: $SKIP"
echo "  Fallidos:    $FAIL"
echo "═══════════════════════════════════════"
echo ""

# Copiar 35017 de la raíz si existe y no se descargó
if [ -d "A.ES.SDGC.BU.35017" ] && [ ! -f "$DEST/A.ES.SDGC.BU.35017.zip" ]; then
  echo "Nota: Ya tienes 35017 descomprimido en A.ES.SDGC.BU.35017/"
fi

echo "ZIPs válidos:"
for f in "$DEST"/*.zip; do
  [ -f "$f" ] || continue
  local_magic=$(xxd -l 2 -p "$f" 2>/dev/null)
  if [ "$local_magic" = "504b" ]; then
    echo "  $(basename $f) — $(( $(wc -c < "$f") / 1024 )) KB"
  fi
done

echo ""
echo "Siguiente: node scripts/catastro-to-buildings.mjs"
