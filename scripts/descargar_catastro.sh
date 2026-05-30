#!/bin/bash
# Descarga todos los ZIPs del Catastro INSPIRE para Gran Canaria
# Ejecutar desde la raíz del proyecto KOINOS:
#   bash scripts/descargar_catastro.sh

set -e
DEST="catastro_data"
mkdir -p "$DEST"

echo "=== Descargando Catastro INSPIRE — Gran Canaria ==="
echo ""

URLS=(
  "35001|AGAETE|https://www.catastro.hacienda.gob.es/INSPIRE/Buildings/35/35001-AGAETE/A.ES.SDGC.BU.35001.zip"
  "35002|AGUIMES|https://www.catastro.hacienda.gob.es/INSPIRE/Buildings/35/35002-AGUIMES/A.ES.SDGC.BU.35002.zip"
  "35003|ARTENARA|https://www.catastro.hacienda.gob.es/INSPIRE/Buildings/35/35003-ARTENARA/A.ES.SDGC.BU.35003.zip"
  "35004|ARUCAS|https://www.catastro.hacienda.gob.es/INSPIRE/Buildings/35/35004-ARUCAS/A.ES.SDGC.BU.35004.zip"
  "35006|FIRGAS|https://www.catastro.hacienda.gob.es/INSPIRE/Buildings/35/35006-FIRGAS/A.ES.SDGC.BU.35006.zip"
  "35007|GALDAR|https://www.catastro.hacienda.gob.es/INSPIRE/Buildings/35/35007-GALDAR/A.ES.SDGC.BU.35007.zip"
  "35008|INGENIO|https://www.catastro.hacienda.gob.es/INSPIRE/Buildings/35/35008-INGENIO/A.ES.SDGC.BU.35008.zip"
  "35009|MOGAN|https://www.catastro.hacienda.gob.es/INSPIRE/Buildings/35/35009-MOGAN/A.ES.SDGC.BU.35009.zip"
  "35010|MOYA|https://www.catastro.hacienda.gob.es/INSPIRE/Buildings/35/35010-MOYA/A.ES.SDGC.BU.35010.zip"
  "35011|LAS PALMAS|https://www.catastro.hacienda.gob.es/INSPIRE/Buildings/35/35011-PALMAS%20DE%20GRAN%20CANARIA,%20LAS/A.ES.SDGC.BU.35011.zip"
  "35012|SAN BARTOLOME|https://www.catastro.hacienda.gob.es/INSPIRE/Buildings/35/35012-SAN%20BARTOLOME%20DE%20TIRAJANA/A.ES.SDGC.BU.35012.zip"
  "35013|SANTA BRIGIDA|https://www.catastro.hacienda.gob.es/INSPIRE/Buildings/35/35013-SANTA%20BRIGIDA/A.ES.SDGC.BU.35013.zip"
  "35014|SANTA LUCIA|https://www.catastro.hacienda.gob.es/INSPIRE/Buildings/35/35014-SANTA%20LUCIA%20DE%20TIRAJANA/A.ES.SDGC.BU.35014.zip"
  "35015|GUIA|https://www.catastro.hacienda.gob.es/INSPIRE/Buildings/35/35015-SANTA%20MARIA%20DE%20GUIA%20DE%20GRAN%20CANARIA/A.ES.SDGC.BU.35015.zip"
  "35017|LAS PALMAS (catastro)|https://www.catastro.hacienda.gob.es/INSPIRE/Buildings/35/35017-LAS%20PALMAS%20DE%20GRAN%20CANARIA/A.ES.SDGC.BU.35017.zip"
  "35018|TELDE|https://www.catastro.hacienda.gob.es/INSPIRE/Buildings/35/35018-TELDE/A.ES.SDGC.BU.35018.zip"
  "35019|TEROR|https://www.catastro.hacienda.gob.es/INSPIRE/Buildings/35/35019-TEROR/A.ES.SDGC.BU.35019.zip"
  "35020|VALLESECO|https://www.catastro.hacienda.gob.es/INSPIRE/Buildings/35/35020-VALLESECO/A.ES.SDGC.BU.35020.zip"
  "35021|VALSEQUILLO|https://www.catastro.hacienda.gob.es/INSPIRE/Buildings/35/35021-VALSEQUILLO%20DE%20GRAN%20CANARIA/A.ES.SDGC.BU.35021.zip"
  "35022|VEGA DE SAN MATEO|https://www.catastro.hacienda.gob.es/INSPIRE/Buildings/35/35022-VEGA%20DE%20SAN%20MATEO/A.ES.SDGC.BU.35022.zip"
  "35023|TEJEDA|https://www.catastro.hacienda.gob.es/INSPIRE/Buildings/35/35023-TEJEDA/A.ES.SDGC.BU.35023.zip"
  "35024|LA ALDEA|https://www.catastro.hacienda.gob.es/INSPIRE/Buildings/35/35024-ALDEA%20DE%20SAN%20NICOLAS,%20LA/A.ES.SDGC.BU.35024.zip"
)

downloaded=0
skipped=0

for entry in "${URLS[@]}"; do
  IFS='|' read -r cod nombre url <<< "$entry"
  fname="$DEST/A.ES.SDGC.BU.${cod}.zip"

  if [ -f "$fname" ]; then
    echo "  ✓ $cod $nombre — ya existe"
    skipped=$((skipped + 1))
    continue
  fi

  echo -n "  ↓ $cod $nombre... "
  if curl -sL -o "$fname" "$url" 2>/dev/null; then
    size=$(du -h "$fname" | cut -f1)
    echo "$size"
    downloaded=$((downloaded + 1))
  else
    echo "ERROR"
    rm -f "$fname"
  fi
done

echo ""
echo "=== Descargados: $downloaded, Ya existían: $skipped ==="
echo "=== Total en $DEST: $(ls $DEST/*.zip 2>/dev/null | wc -l) ZIPs ==="
echo ""
echo "Siguiente paso: python3 scripts/pipeline_gran_canaria.py"
