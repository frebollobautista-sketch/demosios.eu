#!/usr/bin/env node
/**
 * cargar-supabase.mjs
 *
 * Carga en la base de datos Supabase del proyecto (ocre) las tres capas
 * territoriales de Canarias:
 *
 *   1. municipios  — 88   (canarias-municipios-poly.json)
 *   2. secciones   — 1381 (canarias-secciones-lite.json)
 *   3. edificios   — ~1,5M (public/buildings/{cusec}.json)
 *
 * Pensado para ejecutarse en TU Mac, no en Cowork: una carga masiva de
 * ~1,5M filas necesita conexión directa con Postgres, no puede ir por el
 * conector MCP.
 *
 * ── Requisitos ────────────────────────────────────────────────────────
 *   1. Instalar el cliente de Postgres en el repo:
 *        cd ~/KOINOS-iso && npm install pg
 *
 *   2. Exportar la cadena de conexión. En el panel de Supabase:
 *        Project Settings → Database → Connection string → URI
 *      Usa la de "Session pooler" (IPv4, compatible en cualquier red).
 *        export DATABASE_URL="postgresql://postgres.zkezbitcvpjyxyyjilyx:TU_PASSWORD@aws-0-eu-west-3.pooler.supabase.com:5432/postgres"
 *
 * ── Uso ───────────────────────────────────────────────────────────────
 *        cd ~/KOINOS-iso
 *        node scripts/cargar-supabase.mjs
 *
 * Idempotente: municipios y secciones se hacen por UPSERT; la tabla
 * edificios se vacía (TRUNCATE) y se recarga entera. Puedes relanzarlo.
 *
 * AVISO de tamaño: ~1,5M de polígonos pueden rondar o superar el límite
 * de 500 MB del plan gratuito de Supabase. Si la BDD se llena, la fase 3
 * fallará a media carga — lo verás en pantalla.
 * ──────────────────────────────────────────────────────────────────────
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUB = join(ROOT, 'public');
const BUILDINGS = join(PUB, 'buildings');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('✗ Falta la variable DATABASE_URL.');
  console.error('  Cópiala de Supabase → Project Settings → Database → Connection string (URI).');
  console.error('  export DATABASE_URL="postgresql://postgres.xxx:PASSWORD@aws-0-eu-west-3.pooler.supabase.com:5432/postgres"');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },   // Supabase exige SSL
});

const BATCH = 1000;          // edificios por sentencia INSERT
const ts = () => new Date().toLocaleTimeString('es-ES');

async function main() {
  await client.connect();
  console.log(`Conectado a la BDD — ${ts()}`);

  // ─── FASE 1 — municipios ────────────────────────────────────────────
  console.log('\n╔═ FASE 1 — municipios ═╗');
  const muns = JSON.parse(readFileSync(join(PUB, 'canarias-municipios-poly.json'), 'utf8'));
  const munId = {};   // cumun (codigo INE 5 dígitos) -> id
  for (const f of muns.features) {
    const p = f.properties;
    const r = await client.query(
      `insert into municipios (codigo_ine, codigo_catastro, nombre, isla, geom)
       values ($1, $2, $3, $4, st_multi(st_geomfromgeojson($5)))
       on conflict (codigo_ine) do update set
         nombre = excluded.nombre, isla = excluded.isla, geom = excluded.geom
       returning id`,
      [p.cumun, p.cumun, p.nmun, p.isla, JSON.stringify(f.geometry)]
    );
    munId[p.cumun] = r.rows[0].id;
  }
  console.log(`  ${Object.keys(munId).length} municipios cargados.`);

  // ─── FASE 2 — secciones ─────────────────────────────────────────────
  console.log('\n╔═ FASE 2 — secciones censales ═╗');
  const secs = JSON.parse(readFileSync(join(PUB, 'canarias-secciones-lite.json'), 'utf8'));
  const secId = {};   // cusec (10 dígitos) -> id
  for (const f of secs.features) {
    const p = f.properties;
    const cumun = p.cusec.slice(0, 5);
    const r = await client.query(
      `insert into secciones (cusec, municipio_id, municipio_cod, geom)
       values ($1, $2, $3, st_geomfromgeojson($4))
       on conflict (cusec) do update set
         municipio_id = excluded.municipio_id,
         municipio_cod = excluded.municipio_cod,
         geom = excluded.geom
       returning id`,
      [p.cusec, munId[cumun] || null, cumun, JSON.stringify(f.geometry)]
    );
    secId[p.cusec] = r.rows[0].id;
  }
  console.log(`  ${Object.keys(secId).length} secciones cargadas.`);

  // ─── FASE 3 — edificios ─────────────────────────────────────────────
  // 2026-05-29 — Opt-in: la fase 3 (~1,5M polígonos) puede acercarse al
  // límite de 500 MB del plan free. Se omite salvo que se pida con
  // EDIFICIOS=1, para poder cargar territorio (muns+secciones) sin riesgo.
  if (process.env.EDIFICIOS !== '1') {
    console.log('\n╔═ FASE 3 — edificios ═╗');
    console.log('  OMITIDA (EDIFICIOS!=1). Relanza con EDIFICIOS=1 para cargarlos.');
    await client.end();
    console.log('\n✔ Territorio cargado (municipios + secciones).');
    return;
  }
  console.log('\n╔═ FASE 3 — edificios (~1,5M) ═╗');
  await client.query('truncate table edificios restart identity');
  const files = readdirSync(BUILDINGS).filter((f) => f.endsWith('.json'));
  let total = 0, skipped = 0, fileN = 0;

  for (const file of files) {
    fileN++;
    const cusec = file.replace('.json', '');
    const cumun = cusec.slice(0, 5);
    const sid = secId[cusec] || null;
    const mid = munId[cumun] || null;

    let arr;
    try {
      arr = JSON.parse(readFileSync(join(BUILDINGS, file), 'utf8'));
    } catch {
      continue;
    }

    for (let i = 0; i < arr.length; i += BATCH) {
      const slice = arr.slice(i, i + BATCH);
      const params = [];
      const rows = [];
      let n = 0;
      for (const b of slice) {
        // b = [ anillo_de_coordenadas, altura_m, plantas ]
        const gj = JSON.stringify({ type: 'Polygon', coordinates: [b[0]] });
        params.push(gj, b[1] != null ? b[1] : null, b[2] != null ? b[2] : null);
        rows.push(
          `('catastro-inspire', st_geomfromgeojson($${n + 1}), $${n + 2}, $${n + 3}, ` +
          `${sid === null ? 'null' : sid}, ${mid === null ? 'null' : mid}, '${cumun}')`
        );
        n += 3;
      }
      const sql =
        `insert into edificios ` +
        `(source, geom, altura_m, plantas, seccion_id, municipio_id, municipio_cod) ` +
        `values ${rows.join(',')}`;
      try {
        await client.query(sql, params);
        total += slice.length;
      } catch (e) {
        // Una geometría inválida tumba el lote: reintento fila a fila.
        for (const b of slice) {
          try {
            await client.query(
              `insert into edificios
                 (source, geom, altura_m, plantas, seccion_id, municipio_id, municipio_cod)
               values ('catastro-inspire', st_geomfromgeojson($1), $2, $3, $4, $5, $6)`,
              [
                JSON.stringify({ type: 'Polygon', coordinates: [b[0]] }),
                b[1] != null ? b[1] : null,
                b[2] != null ? b[2] : null,
                sid, mid, cumun,
              ]
            );
            total++;
          } catch {
            skipped++;
          }
        }
      }
    }
    if (fileN % 100 === 0) {
      console.log(`  ${fileN}/${files.length} secciones · ${total} edificios · ${ts()}`);
    }
  }

  console.log(`\n  ${total} edificios cargados` + (skipped ? `, ${skipped} descartados (geometría inválida)` : ''));

  // ─── Resumen ────────────────────────────────────────────────────────
  const sz = await client.query(
    `select pg_size_pretty(pg_database_size(current_database())) as bdd,
            (select count(*) from municipios) as municipios,
            (select count(*) from secciones)  as secciones,
            (select count(*) from edificios)  as edificios`
  );
  const s = sz.rows[0];
  console.log('\n╔═ RESUMEN ═╗');
  console.log(`  municipios : ${s.municipios}`);
  console.log(`  secciones  : ${s.secciones}`);
  console.log(`  edificios  : ${s.edificios}`);
  console.log(`  tamaño BDD : ${s.bdd}`);
  console.log(`\nFin — ${ts()}`);

  await client.end();
}

main().catch(async (e) => {
  console.error('\n✗ Error:', e.message);
  try { await client.end(); } catch {}
  process.exit(1);
});
