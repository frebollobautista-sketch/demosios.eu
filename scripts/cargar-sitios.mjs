#!/usr/bin/env node
/**
 * cargar-sitios.mjs
 *
 * Carga en la tabla `sitios` de Supabase (proyecto ocre) los indicadores
 * cívicos GEOLOCALIZADOS de tipo PUNTO desde public/data/*.geojson.
 *
 * Cada capa (overlay) se mapea a una `categoria`. Se guarda geom (Point
 * 4326), nombre, subtipo y el resto de propiedades en `props` (jsonb).
 * Tras la carga, se asigna municipio_cod + isla por contención espacial
 * contra la tabla `municipios` (ST_Contains) — así el vínculo isla/mun es
 * fiable independientemente de la calidad de las props de origen.
 *
 * Polígonos/zonas (ENP, inundables, volcánico-polígono, cobertura) NO se
 * cargan aquí — son zonas, no sitios; irían a otra tabla.
 *
 * Uso:
 *   export DATABASE_URL="postgresql://...pooler.supabase.com:5432/postgres"
 *   node scripts/cargar-sitios.mjs
 *
 * Idempotente: vacía `sitios` (TRUNCATE) y recarga. Relanzable.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'public', 'data');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('✗ Falta DATABASE_URL.');
  process.exit(1);
}

// file → categoria + claves candidatas para nombre/subtipo (primera que exista)
const SOURCES = [
  { file: 'centros-salud-canarias.geojson',          cat: 'centros-salud',       nombre: ['nombre'],          subtipo: ['tipo'] },
  { file: 'farmacias-canarias.geojson',              cat: 'farmacias',           nombre: ['nombre'],          subtipo: ['turno'] },
  { file: 'centros-educativos-prov35.geojson',       cat: 'educacion',           nombre: ['nombre'],          subtipo: ['etapa'] },
  { file: 'centros-educativos-prov38.geojson',       cat: 'educacion',           nombre: ['nombre'],          subtipo: ['etapa'] },
  { file: 'comedores-escolares-canarias.geojson',    cat: 'comedores-escolares', nombre: ['nombre'],          subtipo: ['tipo_comedor', 'etapa'] },
  { file: 'yacimientos-prehispanicos-canarias.geojson', cat: 'yacimientos',      nombre: ['nombre'],          subtipo: ['tipo'] },
  { file: 'bic-patrimonio-canarias.geojson',         cat: 'bic',                 nombre: ['nombre'],          subtipo: ['tipo'] },
  { file: 'memoria-democratica-canarias.geojson',    cat: 'memoria-democratica', nombre: ['nombre'],          subtipo: ['tipo'] },
  { file: 'arboles-singulares-canarias.geojson',     cat: 'arboles-singulares',  nombre: ['nombre'],          subtipo: ['familia', 'especie'] },
  { file: 'playas-canarias.geojson',                 cat: 'playas',              nombre: ['nombre'],          subtipo: [] },
  { file: 'centros-civicos-canarias.geojson',        cat: 'centros-civicos',     nombre: ['nombre'],          subtipo: ['tipo'] },
  { file: 'cultura-venues.geojson',                  cat: 'cultura-venues',      nombre: ['name', 'nombre'],  subtipo: ['categoria'] },
  { file: 'agora-canarias.geojson',                  cat: 'agora',               nombre: ['name'],            subtipo: ['subtype', 'kind'] },
  { file: 'movilidad-electrica-canarias.geojson',    cat: 'bici-recarga',        nombre: ['name'],            subtipo: ['tipo'] },
  { file: 'mobiliario-urbano-canarias.geojson',      cat: 'mobiliario',          nombre: [],                  subtipo: ['tipo'] },
  { file: 'productores-locales.geojson',             cat: 'productores',         nombre: ['nombre'],          subtipo: ['oficio'] },
  { file: 'tejido-social-canarias-v2.geojson',       cat: 'tejido-social',       nombre: ['nombre'],          subtipo: ['categoria'] },
  { file: 'negocios-canarias.geojson',               cat: 'negocios',            nombre: ['name'],            subtipo: ['bucket', 'subcat'] },
  { file: 'events-cultural.geojson',                 cat: 'eventos',             nombre: ['titulo'],          subtipo: ['categoria'] },
  { file: 'guaguas-paradas.geojson',                 cat: 'guaguas-paradas',     nombre: ['nombre'],          subtipo: [] },
  { file: 'vv-prov35.geojson',                       cat: 'vivienda-vacacional', nombre: ['nombre'],          subtipo: ['modalidad', 'tipologia'] },
];

const pick = (props, keys) => {
  for (const k of keys) {
    const v = props?.[k];
    if (v !== undefined && v !== null && v !== '') return String(v);
  }
  return null;
};

const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
const BATCH = 1000;

async function loadFile(src) {
  const path = join(DATA, src.file);
  if (!existsSync(path)) { console.log(`  · ${src.file}: NO existe, omitido`); return 0; }
  let fc;
  try { fc = JSON.parse(readFileSync(path, 'utf8')); }
  catch (e) { console.log(`  · ${src.file}: ilegible (${e.message})`); return 0; }
  const feats = fc.features || [];
  let rows = [];
  let n = 0;
  for (const f of feats) {
    const g = f.geometry;
    if (!g || g.type !== 'Point') continue;
    const [lng, lat] = g.coordinates || [];
    if (typeof lng !== 'number' || typeof lat !== 'number') continue;
    const props = f.properties || {};
    rows.push([src.cat, pick(props, src.subtipo), pick(props, src.nombre), JSON.stringify(props), lng, lat]);
    if (rows.length >= BATCH) { n += await flush(rows); rows = []; }
  }
  if (rows.length) n += await flush(rows);
  console.log(`  · ${src.file} → ${src.cat}: ${n} puntos`);
  return n;
}

async function flush(rows) {
  const vals = [];
  const params = [];
  rows.forEach((r, i) => {
    const b = i * 6;
    vals.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},st_setsrid(st_makepoint($${b + 5},$${b + 6}),4326))`);
    params.push(r[0], r[1], r[2], r[3], r[4], r[5]);
  });
  await client.query(
    `insert into sitios (categoria, subtipo, nombre, props, geom) values ${vals.join(',')}`,
    params
  );
  return rows.length;
}

async function main() {
  await client.connect();
  console.log('Conectado — cargando sitios cívicos…\n');
  await client.query('truncate table sitios restart identity');
  let total = 0;
  for (const src of SOURCES) total += await loadFile(src);
  console.log(`\n  ${total} sitios cargados.`);

  console.log('\nAsignando municipio + isla por contención espacial…');
  const r = await client.query(`
    update sitios s set municipio_cod = m.codigo_ine, isla = m.isla
    from municipios m
    where st_contains(m.geom, s.geom)
  `);
  console.log(`  ${r.rowCount} sitios vinculados a municipio/isla.`);

  const sinMun = await client.query('select count(*)::int c from sitios where municipio_cod is null');
  console.log(`  ${sinMun.rows[0].c} sin municipio (fuera de polígonos / coords dudosas).`);

  await client.end();
  console.log('\n✔ Sitios cívicos cargados.');
}

main().catch(async (e) => { console.error('\n✗ Error:', e.message); try { await client.end(); } catch {} process.exit(1); });
