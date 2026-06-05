# KOINOS · POLIS — Arquitectura

> Documento de referencia técnica. Ver `POLIS-STATE.md` para contexto
> de producto. Ver `docs/DATA_SPEC.md` para el contrato del data pack.

## Resumen

POLIS es el visor/digital twin cívico de la provincia 35 (Las Palmas)
de Canarias. Combina edificios 3D extraídos del Catastro INSPIRE y del
PBF de Geofabrik, capas OSM (calles, parques, agua, POIs) y datos
estadísticos por sección censal. La pieza visual de referencia es la
**sección censal**, ~1.000-2.500 personas, ~10-20 manzanas: cabe en
una pantalla a escala humana, tiene datos del INE asociables, y es el
mismo polígono usado para la coropleta de renta.

El stack tiene dos modos. (1) **Visor de datos** — `polis-provincia.html`
servido como static HTML con MapLibre GL JS, satélite Esri de fondo y
edificios 3D pintados según el toggle activo. (2) **Juego/mockup** —
prototipos de gameplay isométrico (Godot + scripts Python que generan
PNGs comparativos) que exploran el patrón "decisión cívica sobre la
manzana real".

El refactor de mayo 2026 separa el código en cuatro paquetes
(`packages.iso`, `packages.pack`, `packages.mockups`,
`packages.data_sources`), promueve el catálogo de arquetipos a un asset
declarativo (`public/catalog/archetypes.json`) consumible desde JS y
GDScript, y deja `scripts/` como wrappers delgados que delegan a los
paquetes.

## Diagrama del repo

```
KOINOS/
├── docs/                      ← documentación de proyecto
│   ├── ARCHITECTURE.md        (este archivo)
│   ├── DATA_SPEC.md           contrato del data pack v1
│   ├── CHANGELOG.md           historial de versiones
│   ├── POLIS-STATE.md         (raíz) estado del proyecto
│   ├── TAXONOMY.md            jerarquía Cultura/Comunidad/...
│   └── notebook/              cuaderno de trabajo (no técnico)
│
├── packages/                  ← código Python REUTILIZABLE
│   ├── iso/                   piezas iso + clustering
│   │   ├── archetypes.py      lee public/catalog/archetypes.json
│   │   └── bloque_clustering.py
│   ├── pack/                  generador del data pack
│   │   ├── pack_section.py    una sección
│   │   └── batch.py           N secciones con caché STRtree
│   ├── mockups/               renders comparativos / mockups
│   │   ├── zoom.py mobile.py songkick.py
│   │   ├── archetypes_compare.py bloque_compare.py
│   │   ├── lod_ladder.py filter.py events.py
│   │   └── README.md
│   └── data_sources/          (placeholder; ver README)
│
├── public/                    ← assets estáticos servidos al navegador
│   ├── polis-provincia.html   visor MapLibre standalone
│   ├── catalog/
│   │   └── archetypes.json    catálogo declarativo (1 fuente verdad)
│   ├── buildings/<cusec>.json edificios por sección (690 archivos)
│   ├── gc-secciones-lite.json polígonos sección (709 features)
│   ├── gc-municipios-lite.json centroides municipio (34)
│   ├── osm-gc/                roads/parks/water/coastline/pois
│   ├── sections_pack/<cusec>/ data pack v1 (11 archivos por sección)
│   │   └── manifest.json      resumen global del batch
│   └── data/                  renta INE, vivienda vacacional, etc.
│
├── scripts/                   ← wrappers delgados (CLI legacy)
│   ├── *.py                   1-2 líneas que delegan a packages.*
│   └── *.mjs *.sh             extractores Node/Bash sin tocar
│
├── design/                    ← outputs visuales generados por mockups
│   └── secciones/*.png
│
├── godot/                     ← prototipo Godot 4.6 (no tocar)
│   └── polis_walk/
│
├── Makefile                   ← targets canónicos
├── CLAUDE.md AGENTS.md        ← instrucciones para Claude
└── POLIS-STATE.md             ← estado del proyecto
```

## Capas del sistema

- **docs/** — fuente de verdad humana (no se ejecuta).
- **packages/** — código Python reutilizable. Importado vía
  `from packages.<x>.<y> import …`.
- **public/** — assets estáticos: HTML, JSON, PNG. Lo que ve el navegador.
- **design/** — outputs visuales de los mockups. No se sirve al usuario.
- **scripts/** — wrappers CLI con la ruta histórica
  (`python3 scripts/iso_pack.py …`).
- **godot/** — prototipo de exploración en Godot 4.6, separado del visor web.
- **webapp/** *(futuro)* — si POLIS pasa a Next.js como componente React.

## Pipeline de build

```
[raw fuente]                     [extracción]              [pack]                     [render]
PBF Geofabrik 57MB ──────► packages.data_sources ──► public/buildings/   ──► packages.pack ──► public/sections_pack/<cusec>/
                            (futuro: hoy en           public/osm-gc/         .pack_section        meta.json
                             scripts/pbf-to-*)                              .build_pack(cusec)    *.geojson
                                                                                                  preview.png
INE renta CSV ────────────► scripts/fetch-renta-ine ──► public/data/
                                                                                  ▼
                                                                          packages.pack.batch
                                                                          (orquesta N secciones)
                                                                                  ▼
                                                                          public/sections_pack/manifest.json
                                                                                  ▼
                                                                          packages.mockups.*
                                                                          (lee data pack, escribe PNG)
                                                                                  ▼
                                                                          design/secciones/*.png
```

## Convenciones de import

- Siempre desde el árbol absoluto: `from packages.<x>.<y> import …`.
- Nunca relativos (`from .archetypes import`) — para que funcione con
  `python3 -m packages.<x>.<y>` desde la raíz del repo.
- Los scripts en `scripts/*.py` son wrappers — no añadas lógica nueva ahí,
  edita siempre el módulo de `packages/`.
- `iso_pack` (alias histórico) ahora vive como `packages.pack.pack_section`.
- `archetype_catalog` ahora vive como `packages.iso.archetypes`.

## Versionado de data packs

El `schema_version` (futuro) vivirá en `meta.json` de cada pack. Hoy
el pack v1 no lo declara explícitamente — se identifica por el campo
`producer: "iso_pack.py v1"`. Cuando cambie el contrato:

1. Bumpear el campo `schema_version` en `meta.json`.
2. Documentar el cambio en `docs/DATA_SPEC.md` bajo "v2".
3. Anotar en `docs/CHANGELOG.md`.
4. Si el cambio rompe lectores existentes, regenerar el batch completo
   (`make pack-canteras` o `make pack-province`) y commitear.

Los lectores (Godot, JS) deberán comprobar `meta.schema_version`
antes de cargar y rechazar packs incompatibles con un mensaje claro.

## Cómo añadir capas nuevas

1. Crear extractor en `packages/data_sources/<nombre>.py`. Debe
   producir un GeoJSON en WGS84 dentro de `public/<nombre>/`.
2. Añadir lectura/clip al bbox dentro de
   `packages.pack.pack_section.build_pack` (mismo patrón que
   `parks_features` / `water_features`). Salida en metros locales ENU.
3. Añadir el contador al `meta.json` (`<nombre>_count`) y documentarlo
   en `docs/DATA_SPEC.md`.
4. Bumpear `schema_version` si el cambio rompe el contrato.
5. Regenerar batch y commitear `public/sections_pack/`.

Ejemplos de capas pendientes: eventos sintéticos (ya hay JSON en
`packages.mockups.events.EVENTS`), renta INE por sección, viviendas
vacacionales geocodificadas, BIC patrimonio.

## Comandos canónicos

Ver `Makefile` en la raíz del repo:

- `make pack-canteras` — regenera los 76 packs de Las Canteras.
- `make pack-province` — regenera los 709 packs de la provincia 35.
- `make mockup-songkick` — render hero móvil de la manzana 24.
- `make mockup-bloque` — comparativa LOD edificio/bloque/manzana/sección.
- `make lod-ladder` — escalera 5 niveles manzana → isla.
- `make catalog-export` — pasarela informativa: el catálogo se edita
  directamente en `public/catalog/archetypes.json`.
