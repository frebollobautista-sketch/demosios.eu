# Escalado de Polis a las 8 islas de Canarias

Plan para llevar Demos iOS Polis desde el estado actual (1 municipio con datos completos: LPGC) a los **88 municipios** del archipiélago canario.

Última revisión: 2026-04-29.

---

## 1. Estado de partida

| Tabla | Estado | Detalle |
|---|---|---|
| `municipios` | 21 filas | Solo Gran Canaria. Falta resto del archipiélago. |
| `distritos` | 5 filas | LPGC. Resto de capitales sin distritos. |
| `secciones` | 274 filas | LPGC. Resto sin secciones. |
| `edificios` | 0 filas | Vacía. Tabla preparada con columna `geom` PostGIS. |
| `municipios.datos_cargados` | 1 = `true` (LPGC) | Marca operativa para tracking. |

## 2. Lo que falta para Canarias completa

| Isla | Municipios | Población aprox | Capital insular |
|---|---:|---:|---|
| Tenerife | 31 | 928 600 | Santa Cruz de Tenerife |
| Gran Canaria | 21 (1 cargado) | 855 500 | Las Palmas de Gran Canaria ✓ |
| Lanzarote | 7 | 156 100 | Arrecife |
| Fuerteventura | 6 | 119 700 | Puerto del Rosario |
| La Palma | 14 | 83 500 | Santa Cruz de La Palma |
| La Gomera | 6 | 22 100 | San Sebastián de La Gomera |
| El Hierro | 3 | 11 700 | Valverde |
| La Graciosa | 1 (pedanía) | 700 | Caleta de Sebo |
| **Total** | **89** | **~2 178 000** | 8 capitales |

Restan **68 municipios** sin geometría administrativa, secciones censales, ni edificios.

## 3. Estimación de tamaño en BD

Promedios derivados de LPGC (caso atípico — capital muy poblada):

| Granularidad | Por municipio LPGC | Por municipio promedio (estimado) | Total Canarias estimado |
|---|---:|---:|---:|
| Distritos administrativos | 5 | 0–3 | ~50 |
| Secciones censales | 274 | 5–15 | ~900 |
| Edificios (OSM) | 19 481 | 1 500–3 000 | ~250 000 |
| GeoJSON peso (gzip) | ~3 MB | ~250 KB | ~25 MB transmitido |
| BD PostGIS estimado | ~15 MB | ~1 MB | ~80 MB |

**Cabe en Supabase Free tier (500 MB DB)** con margen amplio. Solo cuando añadamos foto-mapeo, testimonios o catastro detallado se acercará al límite y haya que pasar a Pro ($25/mes, 8 GB).

## 4. Fuentes de datos disponibles

### 4.1 Secciones censales (INE)

`KOINOS/spain-datasets/data/census/` contiene GeoJSON oficiales del INE por comunidad autónoma. Buscar específicamente:

- `CN.geojson` o `Canarias.geojson` (código ISO 3166-2 = ES-CN)
- Si no existe agrupado, vendrá por código de provincia: `35` (Las Palmas), `38` (Santa Cruz de Tenerife)

Cada feature lleva `CUSEC` (9 dígitos: 2 provincia + 3 municipio + 2 distrito + 3 sección) — coincide 1:1 con `secciones.cusec` que ya tenemos.

### 4.2 Geometría municipal

OpenStreetMap con Overpass:
```
[out:json][timeout:60];
relation["ISO3166-2"="ES-CN"]["admin_level"="6"];
out geom;
```
Devuelve la provincia. Para municipios:
```
relation(area:36035000)["admin_level"="8"];
```
Donde `36035000` es el área OSM de Canarias.

Alternativa más limpia: Ministerio de Fomento — Sistema de Información Geográfica Territorial (SIGT) o el conjunto de datos abiertos de cada cabildo.

### 4.3 Edificios (OSM Overpass por municipio)

Para cada municipio, query tipo:
```
[out:json][timeout:120];
area["name"="Tegueste"]["admin_level"="8"]->.muni;
(way[building](area.muni); relation[building](area.muni););
out geom;
```

Resultado: GeoJSON con todos los edificios mapeados por la comunidad OSM en ese municipio. Cobertura desigual: muy buena en ciudades, parcial en zonas rurales.

### 4.4 Renta media (INE, ya descargado)

`KOINOS/spain-datasets/data/Renta media en España.csv` — 4.2 MB con `CUSEC + renta_persona + renta_hogar`. Cargar como tabla `renta_ine` y cruzar por `cusec`. Permite enriquecer la composición de capital antes de tener catastro.

## 5. Pipeline reproducible (a construir)

### 5.1 Función SQL idempotente para secciones

```sql
create or replace function cargar_secciones_geojson(municipio_codigo_ine text, fc jsonb)
returns int as $$
declare
  feature jsonb;
  inserted int := 0;
  muni_id int;
begin
  select id into muni_id from municipios where codigo_ine = municipio_codigo_ine;
  if muni_id is null then
    raise exception 'Municipio % no existe', municipio_codigo_ine;
  end if;

  for feature in select * from jsonb_array_elements(fc->'features') loop
    insert into secciones (cusec, distrito_id, municipio_id, geom)
    values (
      feature->'properties'->>'CUSEC',
      null,  -- distrito se infiere por SUBSTRING(cusec, 6, 2) tras crear distritos
      muni_id,
      ST_GeomFromGeoJSON(feature->'geometry')
    )
    on conflict (cusec) do update set geom = excluded.geom;
    inserted := inserted + 1;
  end loop;

  return inserted;
end;
$$ language plpgsql;
```

### 5.2 Función SQL para edificios

Análoga, con `staging` intermedio para validar y luego insertar a `edificios` enlazando `seccion_id` con `ST_Within`.

### 5.3 Script Python que orquesta

```python
# scripts/cargar_canarias.py
import json, requests, supabase

ISLAS = ['Tenerife', 'Lanzarote', 'Fuerteventura', 'La Palma',
        'La Gomera', 'El Hierro', 'La Graciosa']

for isla in ISLAS:
    municipios = supabase.table('municipios').select('*').eq('isla', isla).execute()
    for m in municipios.data:
        if m['datos_cargados']:
            continue
        # 1. Descargar secciones del INE para este código
        # 2. Descargar edificios OSM con Overpass
        # 3. Llamar a las funciones cargar_*
        # 4. UPDATE municipios SET datos_cargados=true WHERE id = m['id']
```

**Idempotencia**: la función usa `ON CONFLICT` para que reejecutarla no rompa. Sirve para parchar municipios concretos sin reprocesar todo.

## 6. Fases de carga sugeridas

Por impacto/tracción × esfuerzo:

### Fase A — Capitales insulares (6 municipios)
Las 6 capitales que faltan (Santa Cruz de Tenerife, Arrecife, Puerto del Rosario, Santa Cruz de La Palma, San Sebastián de La Gomera, Valverde). Cubre las 7 islas mayores. Visualmente Polis pasa de "1 ciudad mapeada" a "todas las capitales canarias mapeadas". **Es el salto narrativo más fuerte por menos esfuerzo**.

Estimación: 30–40 minutos de carga total con el pipeline funcionando. Ya hay infraestructura PostGIS lista.

### Fase B — Resto de Gran Canaria (20 municipios)
Cierra la primera isla completa. Telde (~100k habitantes), Santa Lucía de Tirajana (~75k), San Bartolomé de Tirajana (~55k) son los siguientes en peso poblacional.

Estimación: 1 hora.

### Fase C — Tenerife completa (30 restantes)
Isla con más municipios (31). La Laguna (160k), Arona (84k), Granadilla (54k), Adeje (48k), La Orotava (42k), Los Realejos (38k), Puerto de la Cruz (31k). Mucho turismo y mucho movimiento corporativo — datos clave para la tesis OCRE.

Estimación: 1.5 horas.

### Fase D — Islas menores (24 restantes)
Lanzarote, Fuerteventura, La Palma, La Gomera, El Hierro, La Graciosa. Cobertura geográfica completa.

Estimación: 1 hora.

### Fase E — Renta media INE
Cargar el CSV de renta a la BD y cruzar con secciones por CUSEC. Habilita la primera capa de capital real (proxy socioeconómico) sobre todo el archipiélago.

Estimación: 30 minutos.

**Total estimado de las 5 fases: ~5 horas de trabajo orquestado**, repartidas en 1-2 sesiones. El cuello de botella no es la ejecución sino el rate-limiting de Overpass API (∼1 query / segundo) — descargar 88 sets de edificios desde OSM tarda más por las pausas entre queries que por el procesamiento.

## 7. Visualización en /polis tras escalado

Cuando todos los municipios estén cargados, el mapa v16 (estático, solo LPGC) se queda corto. Soluciones:

### Opción 1 — Selector de municipio en v16

Reescribir v16 para aceptar `?municipio=35016` como parámetro, regenerar 88 archivos HTML estáticos. Funciona pero pesa: 88 × 22 MB = ~2 GB. **Descartado.**

### Opción 2 — Mapa dinámico desde Supabase (tarea #16)

Lo correcto. Componente `<MapaPolis>` en React con react-leaflet, llamadas RPC con bbox al backend. Carga solo lo visible. Escala a millones de features.

**Esta es la fase final del escalado.** El mapa v16 queda como referencia histórica de la maqueta inicial.

### Opción 3 — Vista jerárquica con tabs por isla

Mientras llega la opción 2, una vista intermedia en `/polis` con 8 tabs (una por isla) y un selector de municipio dentro de cada tab. Cada selección renderiza el tablero hexagonal mock o un SVG simple del municipio. Útil de transición.

## 8. Métricas de éxito de cada fase

| Fase | Métrica de cierre |
|---|---|
| A | Las 8 capitales insulares aparecen seleccionables en el selector de Polis con datos reales |
| B | `municipios.datos_cargados = true` para los 21 de Gran Canaria |
| C | Idem para los 31 de Tenerife |
| D | Idem para los 36 de las islas menores |
| E | Tabla `renta_ine` con ~300 000 filas, view `barrio_renta_promedio` accesible desde Demos iOS |

## 9. Lo que NO se escala automáticamente

- **Tipologías culturales NODOS** (espacios + agentes + prácticas) — son contribuciones manuales en taller, no se importan de ningún dataset.
- **Composición de capital real** (común/residente/autónomo/rentista/corporativo) — requiere catastro INSPIRE + CNMV + análisis manual de SOCIMIs y fondos. Es trabajo sociológico y editorial, no descargable.
- **Testimonios y memorias** del barrio — solo nacen de talleres con vecinos.

Por eso el escalado es solo la **base administrativa**; la riqueza cívica de Polis se construye encima por capas, no de golpe.

## 10. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Rate-limiting de Overpass | Pausas controladas; si pasa muy lento, alternativa Geofabrik (PBF entero de Canarias en una descarga) |
| Cobertura OSM desigual en zonas rurales (La Gomera, El Hierro, La Graciosa) | Aceptar conteos bajos de edificios; etiquetar municipios como "cobertura parcial" hasta complementar con catastro |
| Conflictos de versión (CUSEC cambia entre años censales) | Función con ON CONFLICT actualiza geom; mantener `cusec_year` si hace falta histórico |
| BD se acerca a 500 MB free tier | Plan pro $25/mes desbloquea 8 GB; antes, podemos comprimir geometrías con ST_SnapToGrid sin pérdida visible |
| Imágenes satélite Esri tienen cuota | Free tier de Esri hoy generoso, monitorizar uso; alternativa MapTiler o Cloudflare Images |
