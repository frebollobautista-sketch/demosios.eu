#!/usr/bin/env node
/**
 * cargar-nucleos.mjs
 *
 * Carga la tabla `nucleos` (nivel intermedio entre municipio y sección)
 * desde public/data/osm-places-canarias.json.
 *
 * Filtra tipos relevantes para navegación (hamlet, village, neighbourhood,
 * suburb, town, locality) y los inserta con su coordenada. Después del
 * load el script calcula:
 *   - mun_cod por contención espacial contra municipios (ya que muchas
 *     entradas vienen sin ref:ine o con ref:ine inconsistente con el
 *     polígono real),
 *   - tiles Voronoi por municipio, recortados al polígono municipal,
 *   - asignación de cada sección a su núcleo dominante.
 *
 * Idempotente: TRUNCATE + recarga.
 *
 * Uso:
 *   export DATABASE_URL="postgresql://..."
 *   node scripts/cargar-nucleos.mjs
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC  = join(ROOT, 'public', 'data', 'osm-places-canarias.json');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('✗ Falta DATABASE_URL'); process.exit(1); }

// Tipos que cuentan como "núcleo navegable". 'locality' incluido aunque
// es más genérico — añade densidad en zonas rurales sin perder calidad.
const TIPOS_OK = new Set(['hamlet','village','neighbourhood','suburb','town','locality','quarter']);

const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
const BATCH = 800;

async function flushPoints(rows) {
  if (!rows.length) return 0;
  const vals = [];
  const params = [];
  rows.forEach((r, i) => {
    const b = i * 7;
    vals.push(`($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},st_setsrid(st_makepoint($${b+6},$${b+7}),4326))`);
    params.push(r.ref_ine, r.nombre, r.place_type, r.poblacion, r.isla_hint, r.lng, r.lat);
  });
  await client.query(
    `insert into nucleos (ref_ine, nombre, place_type, poblacion, isla, geom) values ${vals.join(',')}`,
    params
  );
  return rows.length;
}

async function main() {
  await client.connect();
  console.log('Conectado — cargando núcleos…\n');
  await client.query('truncate table nucleos restart identity');
  await client.query('update secciones set nucleo_id = null');

  const fc = JSON.parse(readFileSync(SRC, 'utf8'));
  const pl = fc.places || [];
  console.log(`OSM places en archivo: ${pl.length}`);

  // Phase 1 — insertar puntos filtrados
  let batch = [];
  let inserted = 0, skipped_type = 0, skipped_geo = 0;
  for (const p of pl) {
    const tipo = p.place || p.type;
    if (!TIPOS_OK.has(tipo)) { skipped_type++; continue; }
    const lng = p.lng ?? p.lnglat?.[0] ?? p.center?.[0];
    const lat = p.lat ?? p.lnglat?.[1] ?? p.center?.[1];
    if (typeof lng !== 'number' || typeof lat !== 'number') { skipped_geo++; continue; }
    const tags = p.tags || {};
    batch.push({
      ref_ine: tags['ref:ine'] || null,
      nombre: p.name || tags.name || '(sin nombre)',
      place_type: tipo,
      poblacion: tags.population ? parseInt(tags.population, 10) || null : null,
      isla_hint: null, // se asignará por spatial join
      lng, lat
    });
    if (batch.length >= BATCH) { inserted += await flushPoints(batch); batch = []; }
  }
  if (batch.length) inserted += await flushPoints(batch);
  console.log(`  ${inserted} núcleos insertados (omitidos por tipo: ${skipped_type}, por geometría: ${skipped_geo})`);

  // Phase 2 — asignar mun_cod + isla por contención + KNN fallback
  console.log('\nAsignando mun_cod + isla (ST_Contains + KNN fallback)…');
  await client.query(`
    update nucleos n set
      mun_cod = m.codigo_ine,
      isla    = m.isla
    from municipios m
    where st_contains(m.geom, n.geom)
  `);
  await client.query(`
    with nn as (
      select n.id, j.codigo_ine, j.isla
      from nucleos n
      cross join lateral (
        select m.codigo_ine, m.isla from municipios m order by m.geom <-> n.geom limit 1
      ) j
      where n.mun_cod is null
    )
    update nucleos t set mun_cod = nn.codigo_ine, isla = nn.isla
    from nn where t.id = nn.id
  `);
  const sinMun = await client.query('select count(*)::int c from nucleos where mun_cod is null');
  console.log(`  sin mun_cod: ${sinMun.rows[0].c}`);

  // Phase 3 — Voronoi por municipio + recorte al límite municipal
  console.log('\nCalculando tiles Voronoi por municipio…');
  // ST_VoronoiPolygons devuelve un GeometryCollection; lo desplegamos por
  // ST_Dump y emparejamos cada celda con su núcleo por contención del
  // centroide original.
  const r = await client.query(`
    with por_mun as (
      select mun_cod, st_collect(geom) as pts
      from nucleos
      group by mun_cod
    ),
    voronoi as (
      select pm.mun_cod,
             (st_dump(st_voronoipolygons(pm.pts))).geom as cell
      from por_mun pm
    ),
    cell_clip as (
      select v.mun_cod, st_intersection(v.cell, m.geom) as tile
      from voronoi v
      join municipios m on m.codigo_ine = v.mun_cod
    ),
    asignacion as (
      select n.id as nucleo_id,
             st_multi(cc.tile) as tile
      from cell_clip cc
      join nucleos n on n.mun_cod = cc.mun_cod
                    and st_contains(cc.tile, n.geom)
    )
    update nucleos t
    set geom_tile = a.tile
    from asignacion a
    where t.id = a.nucleo_id;
  `);
  console.log(`  tiles Voronoi asignados (${r.rowCount} núcleos)`);

  // Phase 4 — asignar nucleo_id a cada sección por contención de su centroide
  console.log('\nAsignando secciones.nucleo_id (centroide ⊂ tile)…');
  const rs = await client.query(`
    with sn as (
      select s.cusec, n.id as nid
      from secciones s
      join nucleos n
        on st_contains(n.geom_tile, st_centroid(s.geom))
       and n.mun_cod = s.municipio_cod
    )
    update secciones t set nucleo_id = sn.nid
    from sn where t.cusec = sn.cusec
  `);
  const sinNuc = await client.query('select count(*)::int c from secciones where nucleo_id is null');
  console.log(`  ${rs.rowCount} secciones vinculadas a su núcleo`);
  console.log(`  secciones sin núcleo: ${sinNuc.rows[0].c}`);

  // Resumen final
  console.log('\n— Resumen —');
  const sum = await client.query(`
    select isla, count(*) total, count(geom_tile) con_tile
    from nucleos group by isla order by isla
  `);
  sum.rows.forEach(r => console.log(`  ${r.isla}: ${r.total} núcleos (${r.con_tile} con tile)`));

  await client.end();
  console.log('\n✔ Núcleos cargados.');
}

main().catch(async (e) => { console.error('\n✗ Error:', e.message); try { await client.end(); } catch {} process.exit(1); });
