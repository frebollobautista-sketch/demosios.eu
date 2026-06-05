# Pipeline de buildings — pensado para Cowork

Regenera `public/buildings/` con cobertura 100% de las 7 islas Canarias
(GC + FV + LZ + TF + LP + LG + EH). Pensado para correr una vez en un
entorno con ancho de banda y CPU (Cowork u otra máquina), no en local.

## Cobertura actual del repo

| Isla | Tienen | Esperadas | Cobertura |
|---|---|---|---|
| El Hierro (eh) | 6 | 6 | 100% |
| Fuerteventura (fv) | 55 | 55 | 100% |
| La Gomera (lg) | 14 | 14 | 100% |
| La Palma (lp) | 62 | 62 | 100% |
| Lanzarote (lz) | 73 | 73 | 100% |
| Gran Canaria (gc) | 562 | 581 | 96.7% — faltan 19 |
| Tenerife (tf) | 582 | 590 | 98.6% — faltan 8 |

**Total**: 1354 / 1381 cusecs (98%).

Las 27 faltantes son secciones donde OSM (Geofabrik) no tiene
polígonos de edificios — algunas legítimamente rurales, otras
probablemente perdidas por filtros del extractor. Este pipeline las
recupera vía **Catastro INSPIRE** (fuente oficial que sí registra todo).

## Requisitos del entorno

- `curl`, `unzip`, `xxd`, `python3` (estándar).
- `node` (>= 18) para `catastro-to-buildings.mjs`.
- `pip install osmium shapely` para el fallback PBF.
- **~3 GB libres** en disco (catastro ~2 GB + PBF ~150 MB + intermedios).

## Pasos

### 1. Descarga inputs (catastro + PBF)

```bash
cd ~/KOINOS-iso     # o donde tengas clonado el repo
bash scripts/cowork-download-buildings.sh
```

Descarga:

- 88 ZIPs de **Catastro INSPIRE Buildings** (34 muns prov 35 + 54 muns
  prov 38) en `catastro_data/`.
- PBF **Geofabrik canary-islands-latest** en `GEOFABRIK/`.

Tiempo: ~15–30 min según conexión. Si un mun falla descarga, el
script continúa con el siguiente y lo reporta al final.

Flags útiles:

```bash
--skip-osm           # solo catastro, sin PBF
--skip-catastro      # solo PBF
--prov 35|38|all     # filtra por provincia (default: all)
```

### 2. Build buildings

```bash
bash scripts/cowork-build-buildings.sh
```

Hace:

1. Descomprime los ZIPs de catastro.
2. Corre `scripts/catastro-to-buildings.mjs` → catastro GML →
   `public/buildings/{cusec}.json` (fuente principal).
3. Corre `scripts/pbf-to-buildings.py` y
   `scripts/_pbf_to_buildings_prov38.py` → complementa secciones
   donde catastro no las cubrió.
4. Audita cobertura final — imprime tabla por isla y cusecs
   faltantes (si quedan).

Tiempo: ~5–20 min según CPU (catastro GML parsing es CPU-bound).

### 3. (Opcional) Rellenar faltantes con `[]` vacíos

Si quedan cusecs sin archivo (muy probable que algunos sean
secciones legítimamente sin edificación: pinares, costa virgen,
zonas portuarias industriales sin trazado):

```bash
bash scripts/cowork-fill-missing.sh
```

Genera un archivo `[]` por cada cusec faltante. El visor no falla
al fetcharlos, y la sección se ve como polígono base sin edificios.

Esto garantiza cobertura 100% **a nivel de fetch**, aunque algunas
secciones sigan visualmente vacías de edificios (correcto cuando lo
están en la realidad).

### 4. Llevar el resultado de vuelta a este repo

Una vez `public/buildings/` está completo en Cowork:

- Copia el directorio entero a tu máquina local:
  ```bash
  rsync -av --delete cowork:KOINOS-iso/public/buildings/ ./public/buildings/
  ```
- Opcionalmente sube los GML descomprimidos a un bucket si quieres
  preservarlos para regenerar sin re-descargar:
  ```bash
  tar -cJf catastro_data.tar.xz catastro_data/
  # → cuélgalo en algún storage (S3, etc.)
  ```

## Notas

- **Prov 35** del INE = **Las Palmas** (GC + FV + LZ).
- **Prov 38** del INE = **Santa Cruz de Tenerife** (TF + LP + LG + EH).
- Catastro publica buildings con clave `cumun = prov + mun` (5 dígitos).
- La sección censal (`cusec`) tiene 10 dígitos: `prov(2) + mun(3) +
  distrito(2) + sección(3)`.
- Mun rarito: `38901 — El Pinar de El Hierro`. Algunos años el
  catastro lo publica bajo `38013-FRONTERA` (antes era una pedanía).
  Si `38901` falla en descarga, no es bloqueante.

## Si falla algo

Cada script imprime resumen al final con éxitos/fallos. Los logs
verbose se pueden guardar con:

```bash
bash scripts/cowork-download-buildings.sh 2>&1 | tee logs/download.log
bash scripts/cowork-build-buildings.sh    2>&1 | tee logs/build.log
```

Para reintentar solo los fallidos, el script de descarga es idempotente
— si el ZIP ya existe y es válido (magic bytes `504b` + tamaño > 10
KB), salta. Re-corre sin miedo.
