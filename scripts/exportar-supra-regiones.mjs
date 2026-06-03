#!/usr/bin/env node
/**
 * exportar-supra-regiones.mjs
 *
 * Exporta supra-regiones (con geom_tile) por isla a:
 *   public/data/supra-regiones-{isla}.geojson
 *
 * El runtime carga el fichero de la isla activa para renderizar las
 * tiles principales del municipio (sustituyen al choropleth admin).
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT  = join(ROOT, 'public', 'data');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('✗ Falta DATABASE_URL'); process.exit(1); }
const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();
  mkdirSync(OUT, { recursive: true });
  const islas = ['gc','tf','lp','lz','fv','lg','eh'];
  for (const isla of islas) {
    const r = await client.query(
      `select id, mun_cod, isla, capa, nombre, parent_id, n_nucleos,
              st_asgeojson(st_centroid(geom_tile))::json as centroide,
              st_asgeojson(geom_tile)::json as tile
       from supra_regiones
       where isla = $1 and geom_tile is not null
       order by mun_cod, nombre`,
      [isla]
    );
    const features = r.rows.map(row => ({
      type: 'Feature',
      geometry: row.tile,
      properties: {
        id: row.id, mun_cod: row.mun_cod, capa: row.capa,
        nombre: row.nombre, parent_id: row.parent_id,
        n_nucleos: row.n_nucleos, centroide: row.centroide
      }
    }));
    const fc = { type: 'FeatureCollection', generated_at: new Date().toISOString(), isla, count: features.length, features };
    const path = join(OUT, `supra-regiones-${isla}.geojson`);
    writeFileSync(path, JSON.stringify(fc));
    const sizeMB = (JSON.stringify(fc).length / 1024 / 1024).toFixed(2);
    console.log(`  ${isla}: ${features.length} supra-regiones → ${path}  (${sizeMB} MB)`);
  }
  await client.end();
  console.log('\n✔ Supra-regiones exportadas.');
}
main().catch(async (e) => { console.error('\n✗ Error:', e.message); try { await client.end(); } catch {} process.exit(1); });
