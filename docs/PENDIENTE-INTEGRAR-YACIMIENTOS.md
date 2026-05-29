# PENDIENTE · Integrar overlay Yacimientos prehispánicos (MEM-04)

Fecha: 2026-05-27

## Ficheros
- `public/data/yacimientos-prehispanicos-canarias.geojson` (89 features)
- `public/polis-app/overlays/yacimientos.js`
- `scripts/extract-yacimientos.py` (catálogo curado + OSM)

## Distribución
- **Por isla:** Gran Canaria 26, La Palma 22, Lanzarote 17, Tenerife 15, El Hierro 4, Fuerteventura 3, La Gomera 2.
- **Por tipo:** poblado 70, petroglifo 8, cueva 7, necrópolis 3, granero 1.
- **Por cultura:** canario antiguo 26, benahoarita 22, majo 17, guanche 15, bimbache 4, mahorero 3, gomero 2.
- **Visitables:** 16 (Cueva Pintada, Cuatro Puertas, Risco Caído, Zonzamas, El Julan…). No visitables: 73 (coordenada degradada a centroide municipal).

## Ética anti-expolio (recordatorio)
1. `visitable=true` → pin terracota grande con glifo, popup completo OK.
2. `visitable=false` → pin terracota pequeño sin glifo. `descripcion_corta`
   ya redactada sin pistas geográficas; el popup NO debe añadir nada más.
3. NUNCA mostrar coords más precisas que el centroide municipal salvo `visitable=true`.
4. La Ley 11/2019 obliga; el script + overlay lo respetan por construcción.

## Integración en `overlays/index.js`
```js
import { yacimientosOverlay } from "./yacimientos.js?v=20260527-yacimientos-v0";
// OVERLAYS[]:
yacimientosOverlay,
// META:
yacimientos: { category: "memoria", levels: ["isla","municipio","distrito","barrio","seccion"], subcategorias: true },
```

## Integración en `app.js` AMBITOS
Encaja en el ámbito "memoria" / "cultura":
```js
{ id: "memoria", ..., layers: ["memoria-democratica","bic","yacimientos"] }
```

## API
- `getSubcatOptions()` → filtro por tipo (poblado, necrópolis, petroglifo, cueva, granero, túmulo).
- `getCulturaOptions()` / `setCulturaFilter()` → filtro extra por cultura aborigen (canario, guanche, benahoarita, gomero, bimbache, majo, mahorero).
