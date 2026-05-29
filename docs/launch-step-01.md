# Paso 1 · Repo + CI/CD en Vercel con preview por PR

Este documento es la checklist del primer paso de "Lanzar a 500 personas"
(ver Diario dentro de la app). Explica qué quedó ya hecho en el código y
qué pasos manuales tienes que dar tú en GitHub y Vercel.

## Qué significa este paso

- **Repo** → el código vive en GitHub, no solo en tu Mac.
- **CI** → un robot verifica cada cambio (lint, typecheck, build) y lo
  bloquea si rompe algo.
- **CD** → cada cambio se publica solo a internet vía Vercel.
- **Preview por PR** → cada rama de trabajo genera una URL temporal
  (`koinos-git-rama.vercel.app`) para probar cambios antes de fusionarlos.

## Lo que ya está hecho en el código

| Archivo | Qué aporta |
|---|---|
| `package.json` | Nuevo script `npm run typecheck` (`tsc --noEmit`). |
| `.nvmrc` | Fija Node 22 (LTS, default de Vercel). |
| `.github/workflows/ci.yml` | Pipeline que corre **lint**, **typecheck** y **build** en paralelo en cada push a `main` y en cada PR. |

El workflow:

- Usa `actions/setup-node` con caché de `node_modules` (primera run ~2 min,
  siguientes ~30 s).
- Cancela runs antiguas de la misma rama si se hace un push nuevo (ahorra
  minutos de CI).
- Para el job de **build** pasa placeholders de `NEXT_PUBLIC_SUPABASE_URL`
  y `NEXT_PUBLIC_SUPABASE_ANON_KEY`, porque Next.js los necesita en tiempo
  de build. Las claves reales van en Vercel como variables de entorno.

## Pasos manuales que tienes que dar tú

### 1. Subir el repo a GitHub

```bash
cd /Users/panch/KOINOS

# Si aún no tienes gh CLI: brew install gh && gh auth login
gh repo create koinos --private --source=. --remote=origin

# Si prefieres la web:
#   a) Crea https://github.com/tu-usuario/koinos (privado)
#   b) git remote add origin https://github.com/tu-usuario/koinos.git
```

Luego:

```bash
git add .
git commit -m "feat: add CI workflow, typecheck script, and .nvmrc"
git push -u origin main
```

Al hacer `push` verás en GitHub → pestaña **Actions** → debería correr
el workflow `CI` y pasar los tres jobs (lint, typecheck, build).

### 2. Conectar el repo a Vercel

1. Entra a https://vercel.com (login con GitHub).
2. **Add New → Project** → selecciona `koinos`.
3. Framework: **Next.js** (detectado solo).
4. Root Directory: `./` (raíz).
5. **Environment Variables** → añade de momento placeholders (las reales
   llegarán en el paso 2 "Supabase producción"):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://placeholder.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `placeholder-anon-key`
6. **Deploy**.

Vercel creará la rama `main` como "Production" y cualquier otra rama
(o PR) como "Preview" automáticamente. No hace falta `vercel.json`.

### 3. Probar que el ciclo funciona

```bash
git checkout -b test/preview
echo "<!-- hello -->" >> README.md
git add README.md
git commit -m "test: trigger preview deploy"
git push -u origin test/preview

gh pr create --fill
```

Deberías ver en el PR de GitHub:

- ✅ **CI / Lint**, **CI / Typecheck**, **CI / Build** (verdes)
- 💬 Un comentario del bot de Vercel con la URL del preview
  `koinos-git-test-preview-<tu-user>.vercel.app`

Si los tres ticks están verdes y la URL del preview carga la app,
el paso 1 está completo. Puedes marcar el item 1 como hecho en el
Diario.

### 4. Protección de la rama main (recomendado)

En GitHub → **Settings → Branches → Add rule** → `main`:

- ☑ Require a pull request before merging
- ☑ Require status checks to pass before merging
  - Elige: `Lint`, `Typecheck`, `Build`
- ☑ Require branches to be up to date before merging

Así nadie (ni tú mismo por error) puede meter código roto en `main`.

## Verificación local antes de hacer push

Antes de empujar a GitHub, reproduce lo que hará CI:

```bash
npm ci
npm run lint
npm run typecheck
npm run build
```

Si los cuatro pasan, CI pasará casi seguro.

## Troubleshooting

**"CI falla en lint pero local pasa"** → probablemente tu Node local es
más nuevo que el del CI (el workflow usa Node 22 desde `.nvmrc`). Instala
`nvm`, haz `nvm use` y reproduce.

**"Build falla por env vars"** → añade `NEXT_PUBLIC_SUPABASE_URL` y
`NEXT_PUBLIC_SUPABASE_ANON_KEY` al job de build (ya incluido), o al
proyecto de Vercel.

**"Vercel no despliega previews en PRs"** → en el dashboard de Vercel
Project → Settings → Git → asegúrate que `Automatically expose System
Environment Variables` y `Preview Deployments` están activos.
