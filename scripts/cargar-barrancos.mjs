#!/usr/bin/env node
/**
 * cargar-barrancos.mjs
 *
 * Carga la tabla `barrancos` con waterways nombrados (barrancos, arroyos,
 * cauces) desde public/osm-gc/water.json + public/osm-prov38/water.json.
 *
 * Filtra:
 *   - properties.name != null
 *   - geometry.type == 'LineString' (excluye lagunas/balsas/presas polígonos)
 *
 * Agrega por nombre POR FICHERO (cada fichero = una provincia) para que
 * homonimias entre provincias no se fusionen. Cada nombre acumula sus
 * segmentos como MultiLineString.
 *
 * Después del INSERT asigna mun_cod+isla por contención del centroide.
 *
 * Uso:
 *   export DATABASE_URL="postgresql://..."
 *   node scripts/cargar-barrancos.mjs
 *
 * Idempotente: TRUNCATE + recarga.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = [
  { path: join(ROOT, 'public', 'osm-gc',     'water.json') },
  { path: join(ROOT, 'public', 'osm-prov38', 'water.json') },
];

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('✗ Falta DATABASE_URL'); process.exit(1); }
const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

const BATCH = 400;

/** Agrega un FC de water.json en MultiLineString por nombre. */
function aggregate(fc) {
  const byName = new Map();
  for (const f of (fc.features || [])) {
    const name = (f.properties?.name || '').trim();
    if (!name) continue;
    const g = f.geometry;
    if (!g || g.type !== 'LineString') continue;
    let acc = byName.get(name);
    if (!acc) { acc = []; byName.set(name, acc); }
    acc.push(g.coordinates);
  }
  return [...byName.entries()].map(([name, lines]) => ({ name, mls: { type: 'MultiLineString', coordinates: lines } }));
}

async function flush(rows) {
  if (!rows.length) return 0;
  const vals = [];
  const params = [];
  rows.forEach((r, i) => {
    const b = i * 2;
    vals.push(`($${b+1}, st_setsrid(st_geomfromgeojson($${b+2}), 4326))`);
    params.push(r.name, JSON.stringify(r.mls));
  });
  await client.query(
    `insert into barrancos (nombre, geom) values ${vals.join(',')}`,
    params
  );
  return rows.length;
}

async function main() {
  await client.connect();
  console.log('Conectado — cargando barrancos…\n');
  await client.query('truncate table barrancos restart identity');

  let total = 0;
  for (const src of SRC) {
    let fc;
    try { fc = JSON.parse(readFileSync(src.path, 'utf8')); }
    catch (e) { console.log(`  · ${src.path}: NO existe`); continue; }
    const items = aggregate(fc);
    let n = 0, batch = [];
    for (const it of items) {
      batch.push(it);
      if (batch.length >= BATCH) { n += await flush(batch); batch = []; }
    }
    if (batch.length) n += await flush(batch);
    console.log(`  · ${src.path.split('/').slice(-2).join('/')} → ${n} barrancos`);
    total += n;
  }
  console.log(`\n  ${total} barrancos cargados.`);

  console.log('\nAsignando mun_cod + isla por contención del centroide…');
  await client.query(`
    update barrancos b
    set mun_cod = m.codigo_ine, isla = m.isla
    from municipios m
    where st_contains(m.geom, st_centroid(b.geom))
  `);
  // KNN fallback para los que no contiene
  await client.query(`
    with nn as (
      select b.id, j.codigo_ine, j.isla
      from barrancos b
      cross join lateral (
        select m.codigo_ine, m.isla from municipios m order by m.geom <-> b.geom limit 1
      ) j
      where b.mun_cod is null
    )
    update barrancos t set mun_cod = nn.codigo_ine, isla = nn.isla
    from nn where t.id = nn.id
  `);
  const sin = await client.query('select count(*)::int c from barrancos where mun_cod is null');
  console.log(`  sin mun_cod: ${sin.rows[0].c}`);

  // Resumen
  const r = await client.query(`
    select isla, count(*) c from barrancos group by isla order by isla
  `);
  console.log('\n— Por isla —');
  r.rows.forEach(x => console.log(`  ${x.isla}: ${x.c}`));

  await client.end();
  console.log('\n✔ Barrancos cargados.');
}
main().catch(async (e) => { console.error('\n✗ Error:', e.message); try { await client.end(); } catch {} process.exit(1); });
