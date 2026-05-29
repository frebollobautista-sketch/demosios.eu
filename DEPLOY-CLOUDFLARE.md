# Deploy POLIS · Iso a Cloudflare Pages

Cloudflare Pages aguanta hasta **20.000 archivos por deployment** (más holgura que Vercel 13k) y **bandwidth ilimitado** en el plan free.

## Estado actual a deployar

- `public/` total ≈ **1.5 GB** (incluye 1.2 GB de sections_pack)
- ~14.000 archivos
- Después de exclusiones (`buildings/`, `osm-*/roads.json` crudos, backups): ≈ **350 MB**, ~13.000 archivos

## Configuración ya creada

| Archivo | Función |
|---|---|
| `public/_redirects` | `/` → `/polis-app/` |
| `public/_headers` | Cache-Control por path (sections_pack inmutable, app.js no-cache) |
| `.vercelignore` | (vale también para CF Pages con `wrangler.toml`) |

## Setup paso a paso

### Opción A — Git push (más cómodo)

1. Crea un repo en GitHub (puede ser privado).
2. Push del directorio `KOINOS-iso/public/` como repo (o usar git subtree para que solo `public/` cuente como root).
3. En Cloudflare Dashboard: **Pages → Create project → Connect to Git**.
4. Build settings:
   - **Build command**: *(vacío — no hay build, es estático)*
   - **Build output directory**: `/`  (o `public` si pusheas el repo entero)
   - **Root directory**: `/`  (o `public`)
5. Deploy.

### Opción B — Wrangler CLI (sin Git)

```bash
# Instalar wrangler
npm install -g wrangler

# Login
wrangler login

# Deploy directo desde KOINOS-iso/public/
cd /Users/panch/KOINOS-iso
wrangler pages deploy public/ --project-name=polis-iso
```

Wrangler subirá los ~13k archivos. Primera vez tarda 5-10 min.

### Opción C — Drag & drop (solo para test rápido)

1. Comprime `public/` excluyendo lo de `.vercelignore`:
   ```bash
   cd /Users/panch/KOINOS-iso/public
   tar --exclude=sections_pack_backup_2026_05_24 \
       --exclude=buildings_backup_catastro \
       --exclude=buildings \
       --exclude=buildings-by-mun \
       --exclude=osm-gc/roads.json \
       --exclude=osm-prov38/roads.json \
       -czf /tmp/polis-iso-deploy.tar.gz .
   ```
2. En Cloudflare Pages → **Direct upload** → arrastra el `.tar.gz`.
3. Espera la URL `https://polis-iso.pages.dev`.

## Reducciones aplicadas al deploy

Ya **no** se incluyen (ver `.vercelignore`):

- `sections_pack_backup_2026_05_24/` (hardlinks 0 B reales)
- `buildings_backup_catastro/` (333 MB duplicado)
- `buildings/` (333 MB — fuente catastro JSON, el visor usa `sections_pack/`)
- `buildings-by-mun/` (32 MB derivado, no usado por visor)
- `osm-gc/roads.json` (38 MB → sustituido por `roads-main.json` 2.5 MB)
- `osm-prov38/roads.json` (48 MB → sustituido por `roads-main.json` 3.7 MB)
- `data/entidades-canarias-raw.json` (15 MB, fuente; el visor usa `tejido-social-canarias.geojson`)
- `data/barrios-canonical.backup-*.json` (32 MB)
- `data/barrios-canarias-{seed,final}.json`
- `*.md`, `*.py`, `*.log`, `scripts/`, `node_modules/`

## Tras el deploy

URL pública: `https://polis-iso.pages.dev/` (o el dominio que conectes).

Verifica:
- `/` redirige a `/polis-app/`
- `/polis-app/?cusec=3501601003` carga sección Vegueta
- Activar overlay "Ágora" muestra ▲ en plazas

## Costo estimado

- **Free tier Cloudflare Pages**: 500 builds/mes, ancho de banda ilimitado, 100.000 requests/día.
- Para POLIS uso real (visitantes ocasionales): cabe sobrado.
