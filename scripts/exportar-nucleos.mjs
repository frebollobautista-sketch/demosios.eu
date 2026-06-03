#!/usr/bin/env node
/**
 * exportar-nucleos.mjs
 *
 * Exporta nucleos con geom_tile desde Supabase a geojson por isla:
 *   public/data/nucleos-{isla}.geojson
 *
 * El runtime carga el fichero de la isla activa para renderizar las tiles
 * intermedias y permitir navegar a un núcleo concreto.
 *
 * Uso:
 *   export DATABASE_URL="postgresql://..."
 *   node scripts/exportar-nucleos.mjs
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
      `select id, ref_ine, nombre, place_type, mun_cod, poblacion,
              supra_region_id,
              st_asgeojson(st_centroid(geom_tile))::json as centroide,
              st_asgeojson(geom_tile)::json as tile
       from nucleos
       where isla = $1 and geom_tile is not null
       order by nombre`,
      [isla]
    );
    const features = r.rows.map(row => ({
      type: 'Feature',
      geometry: row.tile,
      properties: {
        id: row.id,
        ref_ine: row.ref_ine,
        nombre: row.nombre,
        place_type: row.place_type,
        mun_cod: row.mun_cod,
        poblacion: row.poblacion,
        supra_region_id: row.supra_region_id,
        centroide: row.centroide
      }
    }));
    const fc = { type: 'FeatureCollection', generated_at: new Date().toISOString(), isla, count: features.length, features };
    const path = join(OUT, `nucleos-${isla}.geojson`);
    writeFileSync(path, JSON.stringify(fc));
    const sizeMB = (JSON.stringify(fc).length / 1024 / 1024).toFixed(2);
    console.log(`  ${isla}: ${features.length} núcleos → ${path}  (${sizeMB} MB)`);
  }
  await client.end();
  console.log('\n✔ Núcleos exportados.');
}
main().catch(async (e) => { console.error('\n✗ Error:', e.message); try { await client.end(); } catch {} process.exit(1); });
