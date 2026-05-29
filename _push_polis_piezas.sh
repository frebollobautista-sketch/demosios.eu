#!/usr/bin/env bash
# Push de polis-piezas/ a origin/main, versión SEGURA.
#
# Cambios respecto a la versión 1 (que borró polis-piezas/ por hacer reset --hard
# tras un commit local legítimo):
#   - Detecta si el local va POR DELANTE del remoto y nunca hace reset --hard en ese caso.
#   - Si polis-piezas/ falta, lo recupera del reflog buscando un commit que lo contenga.
#   - Pre-vuelo: comprueba que el push tiene credenciales válidas (gh o PAT en Keychain).
#
# Uso:
#   cd ~/KOINOS
#   bash _push_polis_piezas.sh
set -e
cd "$(dirname "$0")"

echo "→ Repo: $(pwd)"
echo "→ Remote: $(git remote get-url origin)"
echo

# --- 1. Lock huérfano ---
if [ -f .git/index.lock ]; then
  echo "→ Eliminando .git/index.lock huérfano…"
  rm -f .git/index.lock
fi

# --- 2. Sync con remoto sin destruir ---
echo "→ Fetch origin…"
git fetch origin

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
BASE=$(git merge-base HEAD origin/main 2>/dev/null || echo "")

if [ "$LOCAL" = "$REMOTE" ]; then
  echo "✓ Local ya alineado con origin/main."
elif [ "$LOCAL" = "$BASE" ]; then
  echo "→ Local va por DETRÁS de origin/main → fast-forward."
  git merge --ff-only origin/main
elif [ "$REMOTE" = "$BASE" ]; then
  echo "→ Local va por DELANTE de origin/main (tiene commits aún no pusheados). NO reseteo."
else
  echo "→ Historias divergentes. Necesitas decidir manualmente (git rebase / merge)."
  echo "  Local:  $LOCAL"
  echo "  Remote: $REMOTE"
  echo "  Base:   $BASE"
  exit 1
fi
echo "  HEAD ahora: $(git log -1 --oneline)"
echo

# --- 3. Recuperar polis-piezas/ si falta ---
if [ ! -d polis-piezas ] || [ "$(find polis-piezas -type f 2>/dev/null | wc -l | tr -d ' ')" -lt 100 ]; then
  echo "→ polis-piezas/ vacío o ausente. Buscando en reflog…"
  RESCATE=$(git reflog --format='%H %s' | grep -i 'polis.*piezas\|polis_piezas\|polis-piezas' | head -1 | awk '{print $1}')
  if [ -z "$RESCATE" ]; then
    # fallback: buscar cualquier commit que tenga polis-piezas/MANIFEST.json
    RESCATE=$(git log --all --reflog --diff-filter=A --pretty=format:'%H' -- polis-piezas/MANIFEST.json | head -1)
  fi
  if [ -n "$RESCATE" ]; then
    echo "  encontrado en commit $RESCATE → checkout"
    git checkout "$RESCATE" -- polis-piezas/
    echo "  recuperados $(find polis-piezas -type f | wc -l | tr -d ' ') ficheros"
  else
    echo "✗ No encontré polis-piezas/ en el reflog. Aborto."
    exit 1
  fi
fi

# --- 4. Identidad git ---
[ -z "$(git config user.name)"  ] && git config user.name  "Pancho"
[ -z "$(git config user.email)" ] && git config user.email "panxo93@gmail.com"

# --- 5. Add + commit ---
echo "→ git add polis-piezas/ ($(find polis-piezas -type f | wc -l | tr -d ' ') ficheros)"
git add polis-piezas/

if git diff --cached --quiet; then
  echo "✓ No hay cambios nuevos en polis-piezas/. Saltando commit."
else
  STAT=$(git diff --cached --stat | tail -1)
  git commit -m "Polis: piezas vectoriales 35016 (1 municipio + 5 distritos + 274 secciones + 274 packs edificios)

- 554 SVG en marco unificado (origen NW Gran Canaria, 1u = 1m, equirectangular cos(lat))
- 554 PNG preview ≤512px
- MANIFEST.json con jerarquía + bbox por pieza (montable como tangram sin mapa)
- tablero.html (zoom vectorial nativo, sin Leaflet ni satellite)
- catalogo.html (cuadrícula de thumbnails)
- _data/build_pieces.py + render_pngs.py (regeneración)

Datos: INE secciones censales 2019 + DATA_BUILDINGS de polis_v16.html (43.687 footprints OSM)
Cobertura: solo 35016. Estructura preparada para resto de Gran Canaria.

$STAT"
fi
echo

# --- 6. Pre-vuelo de credenciales ---
echo "→ Comprobando credenciales antes de pushear…"
if ! GIT_TERMINAL_PROMPT=0 git push --dry-run origin main 2>&1 | grep -qE "Everything up-to-date|new branch|To " ; then
  cat <<EOF

✗ Sin credenciales válidas para pushear. GitHub ya no acepta passwords (sólo PAT u OAuth).

   Vía rápida (recomendada):
     brew install gh
     gh auth login           # GitHub.com → HTTPS → Login with browser
     gh auth setup-git
     # luego vuelve a correr este script

   Vía PAT manual:
     1) https://github.com/settings/tokens → Generate (classic) con scope 'repo'
     2) git config --global credential.helper osxkeychain
     3) corre este script y cuando pida password, pega el ghp_... del paso 1

EOF
  exit 2
fi

# --- 7. Push real ---
echo "→ Push a origin/main…"
git push origin main
echo
echo "✓ Listo. Verifica en https://github.com/frebollobautista-sketch/demosios.eu"
