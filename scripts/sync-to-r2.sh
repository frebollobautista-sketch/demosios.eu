#!/usr/bin/env bash
#
# sync-to-r2.sh — sube los assets pesados del runtime POLIS a Cloudflare R2.
#
# Sincroniza (idempotente, por checksum) los 3 directorios pesados que NO
# están en git hacia el bucket R2 público que sirve los datos en producción:
#
#   public/sections_pack/  → s3:$R2_BUCKET/sections_pack/
#   public/osm-gc/         → s3:$R2_BUCKET/osm-gc/
#   public/osm-prov38/     → s3:$R2_BUCKET/osm-prov38/
#
# Credenciales: SOLO desde variables de entorno (nunca hardcodeadas). Cárgalas
# desde .env.local (gitignored):
#
#   set -a; source .env.local; set +a
#   ./scripts/sync-to-r2.sh            # primero hace --dry-run y pide confirmar
#   ./scripts/sync-to-r2.sh --go       # ejecuta la subida real directamente
#
# Variables requeridas (ver .env.local):
#   R2_ACCOUNT_ID  R2_ACCESS_KEY_ID  R2_SECRET_ACCESS_KEY  R2_BUCKET
#
set -euo pipefail

# ── Localiza la raíz del repo (este script vive en scripts/) ────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PUBLIC_DIR="$REPO_ROOT/public"

# ── rclone instalado? ───────────────────────────────────────────────────────
if ! command -v rclone >/dev/null 2>&1; then
  echo "ERROR: rclone no está instalado." >&2
  echo "  Instálalo con:  brew install rclone" >&2
  echo "  (no hace falta 'rclone config': este script configura R2 vía env)" >&2
  exit 1
fi

# ── Credenciales desde entorno (nunca hardcodeadas) ─────────────────────────
: "${R2_ACCOUNT_ID:?Falta R2_ACCOUNT_ID — exporta las vars (set -a; source .env.local; set +a)}"
: "${R2_ACCESS_KEY_ID:?Falta R2_ACCESS_KEY_ID}"
: "${R2_SECRET_ACCESS_KEY:?Falta R2_SECRET_ACCESS_KEY}"
: "${R2_BUCKET:?Falta R2_BUCKET}"

R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

# rclone con backend S3 (R2) configurado on-the-fly vía flags --s3-* (sin
# escribir nada en ~/.config/rclone). El remote efímero se llama ":s3:".
RCLONE_FLAGS=(
  --s3-provider Cloudflare
  --s3-access-key-id   "$R2_ACCESS_KEY_ID"
  --s3-secret-access-key "$R2_SECRET_ACCESS_KEY"
  --s3-endpoint        "$R2_ENDPOINT"
  --s3-region auto
  --transfers 16
  --checksum
  --copy-links          # IMPRESCINDIBLE: public/osm-gc es un symlink a KOINOS;
                        # sin esto rclone lo SALTARÍA y faltaría osm-gc en R2.
  --progress
)

# ── Pares origen→destino ────────────────────────────────────────────────────
DIRS=(
  "sections_pack"
  "osm-gc"
  "osm-prov38"
)

run_sync() {
  local extra="$1"   # "" o "--dry-run"
  for d in "${DIRS[@]}"; do
    local src="$PUBLIC_DIR/$d/"
    local dst=":s3:$R2_BUCKET/$d/"
    if [[ ! -d "$src" ]]; then
      echo "AVISO: no existe $src — lo salto." >&2
      continue
    fi
    echo ""
    echo ">>> rclone sync  $src  →  $dst  ${extra}"
    rclone sync "$src" "$dst" "${RCLONE_FLAGS[@]}" $extra
  done
}

echo "Bucket destino: $R2_BUCKET   endpoint: $R2_ENDPOINT"

if [[ "${1:-}" == "--go" ]]; then
  echo "Modo --go: subida REAL directa."
  run_sync ""
  echo ""
  echo "✓ Sync completado."
  exit 0
fi

# Por defecto: dry-run primero, luego pide confirmación.
echo ""
echo "=== DRY-RUN (no se sube nada todavía) ==="
run_sync "--dry-run"

echo ""
read -r -p "¿Ejecutar la subida REAL ahora? [y/N] " ans
case "$ans" in
  y|Y|yes|YES)
    run_sync ""
    echo ""
    echo "✓ Sync completado."
    ;;
  *)
    echo "Abortado. Nada subido. (Ejecuta con --go para saltar el dry-run.)"
    ;;
esac
