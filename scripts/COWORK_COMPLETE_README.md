# Pipeline COMPLETO de buildings — Cowork

Script único `cowork-complete-buildings.sh` que reemplaza al anterior trío
(download / build / fill-missing). Diseñado para correr en **Cowork** (u
otra máquina) porque la descarga directa desde el laptop de Pancho ha
fallado parcialmente — no por rate-limiting real del Catastro INSPIRE
sino porque la lista de muns hardcoded del primer script estaba mal
alineada (códigos prov 35 desfasados, nombres con artículo invertido,
SC Tenerife es código 38900 no 38038).

Este script **descubre los códigos correctos automáticamente desde el
ATOM feed oficial** del Catastro, evitando el bug.

## Por qué hace falta

Cobertura actual (en local, tras sesiones previas):

| isla | muns OK | edif/sec medio |
|---|---|---|
| GC | 21/21 con catastro descargado | ~600–900 |
| TF | 22/31 con catastro | varía 45 → 1162 |
| LP/LG/EH/FV/LZ | parcial | variable |

**Muns con densidad baja** (< 150 edif/sec) son los que NO tuvieron catastro
descargado y dependen solo del PBF de Geofabrik, que en TF/LP/LG/EH/FV/LZ
está muy parcial. Concretamente reportados: La Orotava 45, Los Realejos 69.

## Lo que hace el script

6 fases secuenciales:

1. **Catastro vía ATOM feed**: descarga `A.ES.SDGC.BU.{cod}.zip` para
   prov 35 + prov 38 usando los códigos y URLs reales que el ATOM
   publica. Idempotente — salta los ZIPs ya válidos.
2. **Descomprimir** los ZIPs nuevos a `catastro_data/`.
3. **`catastro-to-buildings.mjs`** convierte GML → `public/buildings/{cusec}.json`.
4. **Descargar PBF Geofabrik canary-islands** si falta.
5. **`pbf-to-buildings.py` + `_pbf_to_buildings_prov38.py`** generan
   buildings desde OSM. Después merge inteligente: para cada cusec, si
   el catastro tenía más edificios, se restaura desde backup. Solo se
   queda el PBF cuando catastro no había aportado nada.
6. **Audit** por mun con densidad (edif/sec). Marca con ⚠️ los muns
   bajos y con ✓ los OK comparado con benchmarks LPGC/La Laguna/Telde.

## Requisitos

- `curl`, `unzip`, `xxd`, `python3` (estándar macOS/Linux)
- `node` (>= 18)
- `pip3 install osmium shapely` para la fase OSM
- ~5 GB libres durante el proceso

## Ejecución

```bash
cd ~/KOINOS-iso   # asumiendo repo clonado en Cowork
bash scripts/cowork-complete-buildings.sh 2>&1 | tee logs/run-complete.log
```

Tiempo: 30–60 min según ancho de banda + CPU.

## Recoger resultados en local

```bash
# desde el laptop de Pancho:
rsync -av --delete cowork:KOINOS-iso/public/buildings/ \
                   ~/KOINOS-iso/public/buildings/
```

(o `scp -r`, o `tar -cz | ssh ... tar -xz`)

## Validación

Tras correr, abre el visor en local apuntando al puerto 8123 y navega a:

- `?mun=035026` (La Orotava): debería pasar de 45 → ~600+ edif/sec.
- `?mun=038031` (Los Realejos): debería pasar de 69 → ~600+.
- `?mun=035016` (LPGC, control): debe seguir igual ~598 edif/sec.

Si algún mun sigue bajo, revisar:

- `logs/catastro-build.log` — fallos de parsing GML.
- `logs/pbf-gc.log` y `logs/pbf-tf.log` — cobertura OSM.
- `logs/atom_prov35.tsv` y `logs/atom_prov38.tsv` — URLs descubiertas.

## ¿Por qué no se corre desde el laptop de Pancho?

Pruebas de ayer mostraron que la IP local fallaba en algunos muns
prov 35 con HTTP 200 + cuerpo HTML (página de error de Catastro). Era
en realidad por nombres mal formados en URL — el script anterior usaba
`OLIVA, LA` y la URL real es `LA OLIVA`. El sub-agente investigador lo
descubrió ayer noche.

Cowork tiene IP distinta + entorno limpio, y este script ya tiene la
fuente correcta (ATOM feed) por lo que no debería fallar por ese bug.
Si Cowork falla, hay un mirror alternativo a explorar:
`grafcan.es / idecanarias.es` (regional canario, sin rate-limit
documentado).
