#!/bin/bash
# Descarga ZIPs del Catastro INSPIRE para Gran Canaria
# Usa curl con flags de SSL robustos
# Ejecutar: bash scripts/descargar_catastro_v2.sh

set -e
DEST="catastro_data"
mkdir -p "$DEST"

echo "=== Descargando Catastro INSPIRE — Gran Canaria (v2) ==="
echo ""

# Primero: obtener el ATOM feed para descubrir URLs reales
ATOM="$DEST/atom_feed.xml"
echo "Descargando ATOM feed..."
curl -sL --tlsv1.2 -o "$ATOM" \
  -H "User-Agent: Mozilla/5.0" \
  "https://www.catastro.hacienda.gob.es/INSPIRE/Buildings/35/ES.SDGC.bu.atom.xml"

if [ -f "$ATOM" ] && grep -q "feed" "$ATOM" 2>/dev/null; then
  echo "  ✓ ATOM feed descargado ($(wc -c < "$ATOM") bytes)"
  echo ""
  # Extraer URLs de ZIPs del ATOM feed
  grep -oP 'href="[^"]*\.zip"' "$ATOM" | sed 's/href="//;s/"//' > "$DEST/atom_urls.txt"
  echo "  URLs encontradas en ATOM: $(wc -l < "$DEST/atom_urls.txt")"
  echo ""
else
  echo "  ✗ ATOM feed no disponible, usando URLs hardcodeadas"
  echo ""
  # Fallback: no ATOM feed
  > "$DEST/atom_urls.txt"
fi

# Copiar 35017 de la raíz si existe
if [ -f "A.ES.SDGC.BU.35017.zip" ] && [ ! -f "$DEST/A.ES.SDGC.BU.35017.zip" ]; then
  cp "A.ES.SDGC.BU.35017.zip" "$DEST/"
  echo "  → Copiado 35017 desde raíz"
fi

# Función de descarga con reintentos
download() {
  local cod="$1"
  local nombre="$2"
  local fname="$DEST/A.ES.SDGC.BU.${cod}.zip"

  # Ya existe y es válido?
  if [ -f "$fname" ]; then
    magic=$(xxd -l 2 -p "$fname" 2>/dev/null)
    size=$(stat -f%z "$fname" 2>/dev/null || stat -c%s "$fname" 2>/dev/null)
    if [ "$magic" = "504b" ] && [ "$size" -gt 10000 ]; then
      echo "  ✓ $cod $nombre — $(echo "scale=1; $size/1048576" | bc) MB"
      return 0
    else
      rm -f "$fname"
    fi
  fi

  # Intentar URL del ATOM feed primero
  local atom_url=$(grep "BU\.${cod}\.zip" "$DEST/atom_urls.txt" 2>/dev/null | head -1)

  # URLs a probar (en orden de prioridad)
  local urls=()
  [ -n "$atom_url" ] && urls+=("$atom_url")
  urls+=("https://www.catastro.hacienda.gob.es/INSPIRE/Buildings/35/${cod}-${nombre}/A.ES.SDGC.BU.${cod}.zip")

  for url in "${urls[@]}"; do
    echo -n "  ↓ $cod $nombre... "

    if curl -sL --tlsv1.2 --max-time 300 \
         -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" \
         -H "Accept: application/zip,application/octet-stream,*/*" \
         -o "$fname" \
         "$url" 2>/dev/null; then

      # Verificar ZIP válido
      magic=$(xxd -l 2 -p "$fname" 2>/dev/null)
      size=$(stat -f%z "$fname" 2>/dev/null || stat -c%s "$fname" 2>/dev/null)

      if [ "$magic" = "504b" ] && [ "$size" -gt 10000 ]; then
        echo "$(echo "scale=1; $size/1048576" | bc) MB ✓"
        return 0
      else
        echo "inválido ($size bytes)"
        rm -f "$fname"
      fi
    else
      echo "error curl"
      rm -f "$fname"
    fi
  done

  echo "  ✗ $cod $nombre — FALLÓ"
  return 1
}

# Lista de municipios (codigo|nombre_carpeta_catastro)
# Los nombres deben coincidir EXACTAMENTE con los del servidor Catastro
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
echo "=== ZIPs válidos en $DEST: ==="
for f in "$DEST"/*.zip; do
  [ -f "$f" ] || continue
  magic=$(xxd -l 2 -p "$f" 2>/dev/null)
  if [ "$magic" = "504b" ]; then
    size=$(stat -f%z "$f" 2>/dev/null || stat -c%s "$f" 2>/dev/null)
    echo "  $(basename $f) — $(echo "scale=1; $size/1048576" | bc) MB"
  fi
done
echo ""
echo "Siguiente paso: python3 scripts/pipeline_gran_canaria.py"
