# PENDIENTE — Integrar overlay `subvenciones` (PAR-05)

Indicador **PAR-05 · Subvenciones concedidas por el Gobierno de Canarias**.
Datos, overlay y script ya están en repo, pero NO está enchufado al registro
de overlays para evitar tocar `overlays/index.js` y `app.js` sin tu visto bueno.

## Qué hay ya hecho

| Artefacto | Path |
|---|---|
| Script de extracción | `scripts/extract-subvenciones-gobcan.py` |
| Datos generados      | `public/data/subvenciones-gobcan.json` |
| Overlay              | `public/polis-app/overlays/subvenciones.js` |

El overlay exporta `subvencionesOverlay` con la interfaz estándar
(`id`, `name`, `load`, `isReady`, `draw`, `hitTest`, `getMeta`, ...).

## Pasos de integración (cuando lo apruebes)

### 1. Registrarlo en `public/polis-app/overlays/index.js`

```js
// arriba, junto a los otros imports:
import { subvencionesOverlay } from "./subvenciones.js?v=20260527-bdns";

// dentro de OVERLAYS — ANTES de los pins, DESPUÉS de las coropletas:
export const OVERLAYS = [
  rentaOverlay,
  paroOverlay,
  subvencionesOverlay,    // ← coropleta + pins, va aquí
  barriosOverlay,
  // ...
];

// en META:
const META = {
  // ...
  "subvenciones": {
    category: "trabajo",         // o "comunidad" si prefieres juntarlo con tejido-social
    levels: ["archipielago", "isla", "municipio", "distrito", "barrio", "seccion"]
  },
};
```

Sugerencia de categoría: **`trabajo`** (Trabajo y economía) por defecto —
el dinero público es un input de la economía local. Alternativa razonable:
añadir una nueva categoría `transparencia` para PAR-05 y futuros indicadores
de gasto público.

### 2. Tooltip / popup

`hitTest` ya devuelve el feature con `properties.{beneficiario, importe,
convocatoria, consejeria, fecha, nmun}`. Si el runtime de tooltips usa el
patrón estándar de los pins, no hace falta nada más. Si quieres un chip
con el importe formateado, en el handler que pinte el tooltip:

```js
const imp = item.properties.importe;
const chip = imp >= 1e6 ? `${(imp/1e6).toFixed(2)} M€`
            : imp >= 1e3 ? `${(imp/1e3).toFixed(0)} k€`
            : `${imp} €`;
```

### 3. Comportamiento por nivel (resumen)

- **archipielago / isla**: coropleta ocre por isla y por mun según total
  €/año concedido (cuantil sobre el conjunto de muns con dato).
- **municipio**: coropleta del mun activo + vecinos + pins billete
  dorado sobre los beneficiarios destacados (≥5.000€).
- **distrito / barrio / seccion**: solo pins (sin coropleta, ya estamos
  zoomados dentro de un mun).

## Cobertura realista de los datos

BDNS no expone municipio del beneficiario. El script imputa cumun por
tres caminos:

1. **NIF de ayuntamiento** (NIF empieza por `P` y los dígitos 2-5 = cumun).
2. **Cruce de nombre con `data/tejido-social.geojson`** (similitud
   normalizada). Cuando hay match, el pin es preciso (lng/lat del
   tejido); si no, el pin usa el centroide del municipio.
3. **Heurística sobre texto de la convocatoria y beneficiario**
   (nombres de los 88 muns canarios + pistas de isla).

Las concesiones de personas físicas (NIF enmascarado tipo `***1234**`,
~85% del volumen anual) NO se imputan y solo cuentan en el total
archipielágico. Para 2025-2026: 14k concesiones → ~4% imputadas a mun,
pero esos 4% concentran ~30% del importe (los grandes beneficiarios son
organizaciones identificables; los pequeños son individuos anonimizados).

## Refrescar datos

```sh
python3 scripts/extract-subvenciones-gobcan.py
# o con periodo custom:
python3 scripts/extract-subvenciones-gobcan.py --desde 01/01/2025 --hasta 31/12/2025
```

Tarda ~30s (15 páginas BDNS · 1.000 registros/página · cortesía 150ms entre llamadas).

## Cambios pendientes opcionales

- [ ] Si la categoría `trabajo` no encaja conceptualmente, abrir
      categoría nueva `transparencia` en `index.js · CATEGORIES` +
      `CATEGORY_ORDER`.
- [ ] Añadir API `getSubcatOptions()` al overlay si quieres sub-chips por
      consejería (los datos ya están en `por_consejeria` de cada mun).
- [ ] Subchip de tramo €: <10k, 10-100k, 100k-1M, >1M.
- [ ] Cruzar con `tejido-social` también para destacar visualmente las
      asociaciones que reciben subvención (un anillo dorado sobre el pin
      de tejido, en lugar de pin propio).
- [ ] Cachear el CSV/JSON BDNS en `_cache/` para acelerar re-runs (el
      script ya soporta `--cache <ruta>`).
