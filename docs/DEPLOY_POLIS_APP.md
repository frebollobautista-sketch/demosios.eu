# Deploy del runtime POLIS a koinos.es (Vercel)

> Guía operativa para publicar `public/polis-app/` en producción
> bajo `https://koinos.es/polis-app/`. v1.5.3 — 2026-05-11.

## URL de producción esperada

```
https://koinos.es/polis-app/
https://koinos.es/polis-app/?mun=016
https://koinos.es/polis-app/?level=distrito&distrito_id=01602
https://koinos.es/polis-app/?cusec=3501602052
```

Next.js 16 sirve cualquier contenido bajo `public/` directamente, sin
configuración adicional ni reglas en `next.config.ts`. El runtime es
HTML + ES modules + Canvas2D, sin build step propio: se publica tal cual
está en el repo.

## Estructura desplegada

```
public/
├── polis-app/        index.html + app.js + renderer.js + iso.js + …
├── sections_pack/    562 carpetas <cusec>/ con geojson + meta.json
├── osm-gc/           coastline.json + roads.json (lazy load)
├── catalog/          archetypes.json
├── gc-municipios-poly.json
├── gc-secciones-lite.json
└── sections_pack/manifest.json
```

Vercel sube la carpeta `public/` íntegra como assets estáticos
servidos por su CDN. No requiere edge function, ni rewrite, ni
header custom — la app web no toca `/api/*` ni rutas Next.

## Checklist pre-deploy

- [ ] **Smoke test local**: `cd ~/KOINOS/public && python3 -m http.server 8080`
      y abrir `http://localhost:8080/polis-app/`. Verificar que entran
      las cuatro vistas (isla → mun → distrito → sec) y la consola del
      navegador no muestra errores.
- [ ] **Alternativa Next.js dev**: `npm run dev` y `curl -I
      http://localhost:3000/polis-app/index.html` debe devolver `200 OK`.
- [ ] **Manifest válido**: `jq '.sections | length' public/sections_pack/manifest.json`
      → 562.
- [ ] **Secciones accesibles**: probar 3 cusecs al azar (uno LPGC, uno
      rural sur, uno rural norte) abriendo `?cusec=<X>` en el smoke
      test. Sin 404s en pestaña Network.
- [ ] **Indicators hook**: en consola `window.polisApp.setIndicators({
      zone: { discovered_pct: 47 } })` debe actualizar el HUD en
      caliente, sin recargar.
- [ ] **Edificios al suelo**: zoom in a paso 3 del distrito 02 LPGC
      (`?level=distrito&distrito_id=01602`), verificar que los edificios
      individuales nacen del suelo y no del techo de la manzana.

## Comando deploy

```bash
git add -A
git commit -m "polis-app v1.5.3: edificios al suelo + indicators hook"
git push origin main
```

Vercel detecta el push, ejecuta `next build`, sube `public/` al CDN, y
deja la URL canónica `koinos.es/polis-app/` lista en ~60s. El dominio
ya está conectado al proyecto Vercel `ocre` (verificable en el
dashboard).

## Enlace desde la app principal

Cuando se decida exponer el visor en la UI, añadir un enlace en la
sección POLIS / Mapear de Next.js:

```tsx
<a href="/polis-app/" className="…">
  Modo isométrico (beta)
</a>
```

Copy sugerido: **"Modo isométrico (beta)"** — refleja el estado pre-
integración con Supabase y deja claro que es un visor independiente del
flow cívico principal. Cuando se enganche `setIndicators` desde Next.js
(vía iframe o embed) podemos cambiarlo a "Modo POLIS" sin beta tag.

## Plan de rollback

Si tras el deploy aparece un bug crítico:

```bash
git log --oneline -10               # localizar el commit problemático
git revert <sha>                    # crear commit que deshace cambios
git push origin main                # Vercel redepliega en ~60s
```

Alternativa más rápida desde el dashboard de Vercel: **Deployments →
deployment anterior → Promote to Production**. Esto restablece la
versión previa sin tocar git.

## Notas

- `polis-app/` no tiene tests automáticos. La validación pre-deploy se
  hace manualmente con el checklist de arriba.
- Si en el futuro el visor pasa a montarse embebido (no en iframe),
  habrá que mover `app.js` a un Client Component de Next.js y exponer
  `setIndicators` directamente desde el host (sin
  `iframeRef.current?.contentWindow?.polisApp`).
- Cambios sólo en `public/polis-app/` o `docs/` no requieren `next build`
  exhaustivo — Vercel detecta cache de build y reusa lo estático.
