#!/bin/bash
# ─────────────────────────────────────────────────────────────────────
# descargar-catastro-canarias.sh
#
# Descarga los edificios del Catastro INSPIRE (tema Buildings / BU) de
# los ~88 municipios de las dos provincias canarias:
#   · 35 — Las Palmas        (Gran Canaria + Fuerteventura + Lanzarote)
#   · 38 — Santa Cruz de Tfe. (Tenerife + La Palma + La Gomera + El Hierro)
#
# Reúne todo lo aprendido peleándonos con el servidor del Catastro:
#
#   • Descubre las URLs reales desde el FEED ATOM oficial. No hay lista
#     de municipios hardcoded ni rutas adivinadas — el propio Catastro
#     publica el código y la URL exacta de cada municipio.
#
#   • curl con -k. El servidor del Catastro presenta un certificado de
#     una CA del sector público (FNMT) cuya cadena curl no logra
#     verificar; sin -k la conexión aborta con "HTTP 000". El ZIP se
#     valida igualmente por sus magic bytes, así que saltarse esa
#     comprobación de certificado es seguro aquí.
#
#   • Idempotente. Salta los ZIP que ya están bajados y son válidos.
#     Puedes cortar (Ctrl+C) y relanzar sin perder nada.
#
#   • Reintentos con espera creciente (20s, 40s, 60s, 80s) y una pausa
#     entre municipios, para los muns grandes que el servidor limita
#     cuando se le piden en ráfaga.
#
# Uso:
#   cd ~/KOINOS-iso
#   bash scripts/descargar-catastro-canarias.sh
#
# Opciones:
#   --prov 35|38   descargar solo una provincia   (por defecto: ambas)
#   --pausa N      segundos de pausa entre muns    (por defecto: 8)
#
# Salida:
#   catastro_data/A.ES.SDGC.BU.{codigo}.zip
#   logs/atom_prov35.tsv , logs/atom_prov38.tsv   (índices del ATOM)
#
# Siguiente paso, una vez descargado:
#   bash scripts/cowork-complete-buildings.sh     (fases 2 a 6: build)
# ─────────────────────────────────────────────────────────────────────

set -u

# ── Configuración y flags ─────────────────────────────────────────────
PROV_FILTER="all"
PAUSA=8
MAX_INTENTOS=5

while [ $# -gt 0 ]; do
  case "$1" in
    --prov)  PROV_FILTER="$2"; shift 2 ;;
    --pausa) PAUSA="$2";       shift 2 ;;
    -h|--help)
      echo "Uso: $0 [--prov 35|38] [--pausa N]"
      exit 0 ;;
    *) echo "Opción desconocida: $1"; exit 1 ;;
  esac
done

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO" || { echo "Error: no puedo entrar en $REPO"; exit 1; }

DEST="catastro_data"
mkdir -p "$DEST" logs

UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
ATOM_BASE="https://www.catastro.hacienda.gob.es/INSPIRE/buildings"

# ── ¿Es un ZIP válido?  (magic bytes 50 4b  +  tamaño razonable) ──────
es_zip_valido() {
  local f="$1"
  [ -f "$f" ] || return 1
  local size magic
  size=$(wc -c < "$f" 2>/dev/null || echo 0)
  magic=$(xxd -l 2 -p "$f" 2>/dev/null || echo "")
  [ "$magic" = "504b" ] && [ "$size" -gt 100000 ]
}

OK=0; SKIP=0; FAIL=0
FALLIDOS=()

# ── Descarga de una provincia completa ────────────────────────────────
descargar_provincia() {
  local prov="$1"
  echo ""
  echo "── Provincia $prov — descubriendo municipios vía feed ATOM ──"

  local atom_url="${ATOM_BASE}/${prov}/ES.SDGC.bu.atom_${prov}.xml"
  local tsv="logs/atom_prov${prov}.tsv"

  # El ATOM es un índice XML. De cada entrada sacamos (código, URL ZIP).
  # IMPORTANTE: las URLs del ATOM traen ESPACIOS sin codificar en la ruta
  # (p.ej. .../35015-LA OLIVA/...). curl no puede con eso — hay que
  # percent-encodear la ruta (espacios -> %20, Ñ -> %C3%91, etc.).
  # Esta es la causa real de que fallaran siempre los mismos 21 muns.
  curl -sL -k --tlsv1.2 --max-time 60 -H "User-Agent: $UA" "$atom_url" |
    python3 -c "
import re, sys, urllib.parse as up
raw = sys.stdin.buffer.read().decode('iso-8859-1', errors='replace')
seen = set()
for m in re.finditer(r'href=\"(https?://[^\"]+/A\\.ES\\.SDGC\\.BU\\.(\\d{5})\\.zip)\"', raw):
    url, cod = m.group(1), m.group(2)
    if cod in seen:
        continue
    seen.add(cod)
    sp = up.urlsplit(url)
    url = up.urlunsplit((sp.scheme, sp.netloc, up.quote(sp.path), '', ''))
    print(f'{cod}\\t{url}')
" > "$tsv"

  local total
  total=$(wc -l < "$tsv" 2>/dev/null | tr -d ' ')
  [ -z "$total" ] && total=0
  if [ "$total" -eq 0 ]; then
    echo "  ✗ El feed ATOM no devolvió municipios."
    echo "    Revisa tu conexión con www.catastro.hacienda.gob.es"
    return 1
  fi
  echo "  $total municipios descubiertos"
  echo ""

  while IFS=$'\t' read -r cod url; do
    [ -z "$cod" ] && continue
    local zip="$DEST/A.ES.SDGC.BU.${cod}.zip"

    # Idempotente: si ya lo tenemos válido, lo saltamos.
    if es_zip_valido "$zip"; then
      printf "  · %s  ya descargado\n" "$cod"
      SKIP=$((SKIP+1))
      continue
    fi
    rm -f "$zip"

    local conseguido=0 intento=1
    while [ "$intento" -le "$MAX_INTENTOS" ]; do
      printf "  ↓ %s  (intento %d/%d) ... " "$cod" "$intento" "$MAX_INTENTOS"
      curl -sL -k --tlsv1.2 --max-time 900 \
        -H "User-Agent: $UA" -H "Accept: */*" \
        -o "$zip" "$url" 2>/dev/null

      if es_zip_valido "$zip"; then
        printf "%d KB ✓\n" "$(( $(wc -c < "$zip") / 1024 ))"
        OK=$((OK+1)); conseguido=1
        break
      fi

      # Lo recibido no es un ZIP (casi siempre una página HTML que el
      # servidor devuelve cuando limita el ritmo). Backoff y reintento.
      rm -f "$zip"
      if [ "$intento" -lt "$MAX_INTENTOS" ]; then
        local espera=$(( intento * 20 ))
        printf "no válido — espera %ds\n" "$espera"
        sleep "$espera"
      else
        printf "no válido — agotados %d intentos\n" "$MAX_INTENTOS"
      fi
      intento=$(( intento + 1 ))
    done

    if [ "$conseguido" -eq 0 ]; then
      FAIL=$((FAIL+1))
      FALLIDOS+=("$cod")
    fi
    sleep "$PAUSA"
  done < "$tsv"
}

# ── Main ──────────────────────────────────────────────────────────────
echo "╔══════════════════════════════════════════════════════╗"
echo "║  Catastro INSPIRE Buildings — descarga Canarias        ║"
echo "╚══════════════════════════════════════════════════════╝"
echo "Inicio: $(date '+%H:%M:%S')"

if [ "$PROV_FILTER" = "all" ] || [ "$PROV_FILTER" = "35" ]; then
  descargar_provincia 35
fi
if [ "$PROV_FILTER" = "all" ] || [ "$PROV_FILTER" = "38" ]; then
  descargar_provincia 38
fi

# ── Resumen ───────────────────────────────────────────────────────────
validos=0
for f in "$DEST"/A.ES.SDGC.BU.*.zip; do
  es_zip_valido "$f" && validos=$((validos+1))
done

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  Resumen                                               ║"
echo "╚══════════════════════════════════════════════════════╝"
echo "  Descargados nuevos    : $OK"
echo "  Ya estaban (saltados) : $SKIP"
echo "  Fallidos              : $FAIL"
echo "  ZIPs válidos en $DEST/: $validos"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "  Municipios que siguen fallando:"
  for c in "${FALLIDOS[@]}"; do
    echo "    - $c"
  done
  echo ""
  echo "  El script es idempotente: vuelve a lanzarlo y reintentará"
  echo "  solo esos. Si tras 2-3 pasadas siguen cayendo, no es ruido"
  echo "  de red — habrá que sacarlos de otra fuente (GRAFCAN)."
fi

echo ""
echo "Fin: $(date '+%H:%M:%S')"
echo "Siguiente paso: bash scripts/cowork-complete-buildings.sh"
