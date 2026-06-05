#!/usr/bin/env node
/**
 * computar-supra-regiones.mjs
 *
 * Aplica la cascada de 4 capas para asignar cada núcleo a una
 * supra-región, y computa los tiles Voronoi recortados al municipio.
 *
 *   Capa 1 — Raíz toponímica canaria (Cueva, Lomo, Hoya, ...).
 *   Capa 2 — Barranco named más cercano dentro del municipio.
 *   Capa 3 — Núcleo cabecera (town/village/suburb más prominente).
 *   Capa 4 — K-means residual.
 *
 * Sub-tessellación si una supra-región tiene >15 núcleos.
 *
 * Uso:
 *   export DATABASE_URL="postgresql://..."
 *   node scripts/computar-supra-regiones.mjs
 *
 * Idempotente: limpia supra_regiones y los campos derivados de nucleos.
 */

import { dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('✗ Falta DATABASE_URL'); process.exit(1); }
const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

// ─── Diccionario toponímico canario ──────────────────────────────────────
// Cada entrada: raíz (singular case-folded) → nombre plural de la supra-región.
const TOPO_ROOTS = {
  cueva:      'Las Cuevas',
  cuevas:     'Las Cuevas',
  lomo:       'Los Lomos',
  lomos:      'Los Lomos',
  lomito:     'Los Lomos',
  hoya:       'Las Hoyas',
  hoyas:      'Las Hoyas',
  hoyeta:     'Las Hoyas',
  risco:      'Los Riscos',
  riscos:     'Los Riscos',
  risquillos: 'Los Riscos',
  risquillo:  'Los Riscos',
  vega:       'Las Vegas',
  vegas:      'Las Vegas',
  veguetilla: 'Las Vegas',
  llano:      'Los Llanos',
  llanos:     'Los Llanos',
  llanito:    'Los Llanos',
  mesa:       'Las Mesas',
  mesas:      'Las Mesas',
  meseta:     'Las Mesas',
  degollada:  'Las Degolladas',
  degolladas: 'Las Degolladas',
  montaña:    'Las Montañas',
  montañas:   'Las Montañas',
  montañeta:  'Las Montañas',
  cumbre:     'Las Cumbres',
  cumbres:    'Las Cumbres',
  solana:     'Las Solanas',
  solanas:    'Las Solanas',
  umbría:     'Las Umbrías',
  pago:       'Los Pagos',
  pagos:      'Los Pagos',
  caserío:    'Los Caseríos',
  caserios:   'Los Caseríos',
  finca:      'Las Fincas',
  fincas:     'Las Fincas',
  punta:      'Las Puntas',
  playa:      'Las Playas',
  playas:     'Las Playas',
  valle:      'Los Valles',
  valles:     'Los Valles',
  cruz:       'Las Cruces',
  cuesta:     'Las Cuestas',
  morro:      'Los Morros',
  morros:     'Los Morros',
  ladera:     'Las Laderas',
  pico:       'Los Picos',
  picos:      'Los Picos',
};

// Normaliza texto: quita acentos, lower, trim.
function norm(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Devuelve la entrada del diccionario que coincide con la primera palabra
// significativa del nombre (saltando artículos). null si no hay match.
const STOPWORDS = new Set(['el','la','los','las','de','del','y','o','al','a']);
function matchTopoRoot(nombre) {
  const words = norm(nombre).split(/\s+/).filter(w => w && !STOPWORDS.has(w));
  for (const w of words) {
    const w2 = w.replace(/[.,;:]/g, '');
    if (TOPO_ROOTS[w2]) return { key: w2, supraNombre: TOPO_ROOTS[w2] };
  }
  return null;
}

// K-means muy simple en 2D (lng,lat). k iteraciones limitadas, k determinístico.
function kmeans(points, k, maxIter = 30) {
  if (points.length <= k) return points.map((p, i) => ({ ...p, cluster: i }));
  // Init: pick k puntos evenly spaced after sorting by lng
  const sorted = [...points].sort((a, b) => a.lng - b.lng);
  const centroids = [];
  for (let i = 0; i < k; i++) {
    const idx = Math.floor((i + 0.5) * sorted.length / k);
    centroids.push({ lng: sorted[idx].lng, lat: sorted[idx].lat });
  }
  let assign = new Array(points.length);
  for (let it = 0; it < maxIter; it++) {
    let changed = false;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      let best = 0, bd = Infinity;
      for (let c = 0; c < k; c++) {
        const dx = p.lng - centroids[c].lng, dy = p.lat - centroids[c].lat;
        const d = dx*dx + dy*dy;
        if (d < bd) { bd = d; best = c; }
      }
      if (assign[i] !== best) { assign[i] = best; changed = true; }
    }
    // Update centroids
    const sums = new Array(k).fill(0).map(() => ({ lng: 0, lat: 0, n: 0 }));
    for (let i = 0; i < points.length; i++) {
      const s = sums[assign[i]];
      s.lng += points[i].lng; s.lat += points[i].lat; s.n++;
    }
    for (let c = 0; c < k; c++) {
      if (sums[c].n > 0) {
        centroids[c].lng = sums[c].lng / sums[c].n;
        centroids[c].lat = sums[c].lat / sums[c].n;
      }
    }
    if (!changed) break;
  }
  return points.map((p, i) => ({ ...p, cluster: assign[i] }));
}

// place_type rank (menor = más prominente)
const PT_RANK = { town: 0, village: 1, suburb: 2, neighbourhood: 3, hamlet: 4, locality: 5, quarter: 5 };

async function main() {
  await client.connect();
  console.log('Conectado — calculando supra-regiones…\n');

  // ── 0. Limpia ──
  await client.query(`
    update nucleos set topo_root = null, barranco_name = null, cabecera_id = null, supra_region_id = null
  `);
  await client.query('truncate table supra_regiones restart identity');
  console.log('  · estado anterior limpiado');

  // ── 1. Topo_root: calcular en JS y UPDATE batch ──
  console.log('\n— Capa 1: raíz toponímica —');
  const ns = await client.query('select id, nombre from nucleos');
  let matched = 0;
  const batchUpd = [];
  for (const row of ns.rows) {
    const m = matchTopoRoot(row.nombre);
    if (m) { batchUpd.push([row.id, m.supraNombre]); matched++; }
  }
  // UPDATE batched
  const CHUNK = 1000;
  for (let i = 0; i < batchUpd.length; i += CHUNK) {
    const chunk = batchUpd.slice(i, i + CHUNK);
    const vals = chunk.map((_, j) => `($${j*2+1}::bigint, $${j*2+2})`).join(',');
    const params = chunk.flat();
    await client.query(
      `update nucleos n set topo_root = v.root
       from (values ${vals}) as v(id, root)
       where n.id = v.id`,
      params
    );
  }
  console.log(`  ${matched} núcleos con raíz toponímica (de ${ns.rows.length})`);

  // ── 2. Barranco_name: KNN al barranco named más cercano dentro del mun ──
  console.log('\n— Capa 2: barranco named cercano (<1500m) —');
  await client.query(`
    with cand as (
      select n.id, j.nombre
      from nucleos n
      cross join lateral (
        select b.nombre, b.geom
        from barrancos b
        where b.mun_cod = n.mun_cod
        order by b.geom <-> n.geom
        limit 1
      ) j
      where n.topo_root is null
        and st_distance(j.geom::geography, n.geom::geography) < 1500
    )
    update nucleos t set barranco_name = cand.nombre
    from cand where t.id = cand.id
  `);
  const r2 = await client.query(`select count(*)::int c from nucleos where topo_root is null and barranco_name is not null`);
  console.log(`  ${r2.rows[0].c} núcleos asociados a barranco named`);

  // ── 3. Cabecera_id: para los aún sin clasificar, KNN al núcleo cabecera ──
  console.log('\n— Capa 3: núcleo cabecera (gravedad cultural) —');
  await client.query(`
    with cabs as (
      select n.id, n.mun_cod, n.geom,
             row_number() over (
               partition by n.mun_cod
               order by case n.place_type
                          when 'town' then 0
                          when 'village' then 1
                          when 'suburb' then 2
                          when 'neighbourhood' then 3
                          else 9 end,
                        coalesce(n.poblacion, 0) desc
             ) as rnk
      from nucleos n
      where n.place_type in ('town','village','suburb','neighbourhood')
    ),
    cand as (
      select n.id as nid, j.cab_id
      from nucleos n
      cross join lateral (
        select c.id as cab_id
        from cabs c
        where c.mun_cod = n.mun_cod and c.rnk <= 5
        order by c.geom <-> n.geom
        limit 1
      ) j
      where n.topo_root is null and n.barranco_name is null
    )
    update nucleos t set cabecera_id = cand.cab_id
    from cand where t.id = cand.nid
  `);
  const r3 = await client.query(`select count(*)::int c from nucleos where topo_root is null and barranco_name is null and cabecera_id is not null`);
  console.log(`  ${r3.rows[0].c} núcleos asociados a cabecera`);

  // ── 4. Crear supra_regiones a partir de los grupos ──
  console.log('\n— Construyendo supra_regiones —');

  // 4.1 — Capa toponimia
  const r4a = await client.query(`
    insert into supra_regiones (mun_cod, isla, capa, nombre, n_nucleos, geom)
    select n.mun_cod, max(n.isla), 'toponimia', n.topo_root, count(*),
           st_centroid(st_collect(n.geom))
    from nucleos n
    where n.topo_root is not null
    group by n.mun_cod, n.topo_root
    having count(*) >= 3
    returning id, mun_cod, nombre
  `);
  console.log(`  Capa 1: ${r4a.rowCount} supra-regiones`);

  // Núcleos con topo_root pero grupo <3 quedan sin supra (caerán a kmeans residual).

  // 4.2 — Capa barranco
  const r4b = await client.query(`
    insert into supra_regiones (mun_cod, isla, capa, nombre, n_nucleos, geom)
    select n.mun_cod, max(n.isla), 'barranco', n.barranco_name, count(*),
           st_centroid(st_collect(n.geom))
    from nucleos n
    where n.topo_root is null and n.barranco_name is not null
    group by n.mun_cod, n.barranco_name
    having count(*) >= 3
    returning id, mun_cod, nombre
  `);
  console.log(`  Capa 2: ${r4b.rowCount} supra-regiones`);

  // 4.3 — Capa cabecera
  const r4c = await client.query(`
    insert into supra_regiones (mun_cod, isla, capa, nombre, n_nucleos, geom)
    select n.mun_cod, max(n.isla), 'cabecera',
           (select nombre || ' y sus pagos' from nucleos c where c.id = n.cabecera_id),
           count(*),
           st_centroid(st_collect(n.geom))
    from nucleos n
    where n.topo_root is null and n.barranco_name is null and n.cabecera_id is not null
    group by n.mun_cod, n.cabecera_id
    having count(*) >= 2
    returning id, mun_cod, nombre
  `);
  console.log(`  Capa 3: ${r4c.rowCount} supra-regiones`);

  // ── 5. UPDATE nucleos.supra_region_id ── (por capa+nombre+mun)
  // Capa 1
  await client.query(`
    update nucleos n set supra_region_id = sr.id
    from supra_regiones sr
    where sr.capa = 'toponimia' and sr.mun_cod = n.mun_cod and sr.nombre = n.topo_root
  `);
  // Capa 2
  await client.query(`
    update nucleos n set supra_region_id = sr.id
    from supra_regiones sr
    where sr.capa = 'barranco' and sr.mun_cod = n.mun_cod and sr.nombre = n.barranco_name
      and n.supra_region_id is null
  `);
  // Capa 3 — mapear por (mun, cabecera_id) via el nombre 'X y sus pagos'
  await client.query(`
    update nucleos n set supra_region_id = sr.id
    from supra_regiones sr, nucleos c
    where sr.capa = 'cabecera'
      and c.id = n.cabecera_id
      and sr.mun_cod = n.mun_cod
      and sr.nombre = c.nombre || ' y sus pagos'
      and n.supra_region_id is null
  `);

  // ── 6. Capa 4 — k-means para los residuales (sin supra todavía) ──
  console.log('\n— Capa 4: k-means residual —');
  // Cargo residuales agrupados por mun
  const res = await client.query(`
    select n.id, n.mun_cod, n.isla, n.nombre,
           st_x(n.geom) as lng, st_y(n.geom) as lat,
           n.place_type, n.poblacion
    from nucleos n
    where n.supra_region_id is null
    order by n.mun_cod
  `);
  const byMun = new Map();
  for (const row of res.rows) {
    if (!byMun.has(row.mun_cod)) byMun.set(row.mun_cod, []);
    byMun.get(row.mun_cod).push(row);
  }
  let kmeansCreated = 0;
  for (const [mun, pts] of byMun) {
    const k = Math.max(1, Math.ceil(pts.length / 8));
    const clusters = kmeans(pts, k);
    // agrupar
    const groups = new Map();
    for (const p of clusters) {
      if (!groups.has(p.cluster)) groups.set(p.cluster, []);
      groups.get(p.cluster).push(p);
    }
    // crear supra_region por cluster, nombre = núcleo más prominente
    for (const [, grp] of groups) {
      const head = grp.slice().sort((a,b) => (PT_RANK[a.place_type]??9) - (PT_RANK[b.place_type]??9)
                                              || (b.poblacion||0) - (a.poblacion||0))[0];
      const cx = grp.reduce((s,p)=>s+p.lng,0)/grp.length;
      const cy = grp.reduce((s,p)=>s+p.lat,0)/grp.length;
      const ins = await client.query(`
        insert into supra_regiones (mun_cod, isla, capa, nombre, n_nucleos, geom)
        values ($1, $2, 'kmeans', $3, $4, st_setsrid(st_makepoint($5,$6), 4326))
        returning id
      `, [mun, head.isla, head.nombre, grp.length, cx, cy]);
      const supraId = ins.rows[0].id;
      // asignar nucleos
      const ids = grp.map(p => p.id);
      await client.query(
        `update nucleos set supra_region_id = $1 where id = any($2::bigint[])`,
        [supraId, ids]
      );
      kmeansCreated++;
    }
  }
  console.log(`  Capa 4: ${kmeansCreated} supra-regiones (de ${res.rowCount} residuales)`);

  // ── 7. Voronoi por mun: tiles ──
  console.log('\n— Calculando tiles Voronoi por municipio —');
  const rV = await client.query(`
    with por_mun as (
      select mun_cod, st_collect(geom) as pts
      from supra_regiones
      where parent_id is null
      group by mun_cod
    ),
    vor as (
      select pm.mun_cod, (st_dump(st_voronoipolygons(pm.pts))).geom as cell
      from por_mun pm
    ),
    clip as (
      select v.mun_cod,
             st_multi(st_collectionextract(st_intersection(v.cell, m.geom), 3)) as tile
      from vor v
      join municipios m on m.codigo_ine = v.mun_cod
    ),
    asign as (
      select sr.id as sid, c.tile
      from clip c
      join supra_regiones sr on sr.mun_cod = c.mun_cod and st_contains(c.tile, sr.geom)
    )
    update supra_regiones t set geom_tile = a.tile from asign a where t.id = a.sid
  `);
  console.log(`  ${rV.rowCount} tiles asignados`);

  // ── 8. Sub-tessellación >15 ──
  console.log('\n— Sub-tessellación (supra >15 hijos) —');
  const big = await client.query(`
    select id, mun_cod, isla, nombre, n_nucleos, st_asgeojson(geom_tile)::json as tile
    from supra_regiones
    where parent_id is null and n_nucleos > 15
  `);
  let subs = 0;
  for (const sr of big.rows) {
    // núcleos hijos
    const childs = await client.query(`
      select id, mun_cod, isla, nombre, st_x(geom) lng, st_y(geom) lat,
             place_type, poblacion
      from nucleos where supra_region_id = $1
    `, [sr.id]);
    const k = Math.ceil(childs.rowCount / 8);
    const clusters = kmeans(childs.rows.map(r => ({ ...r, lng:+r.lng, lat:+r.lat })), k);
    const groups = new Map();
    for (const p of clusters) {
      if (!groups.has(p.cluster)) groups.set(p.cluster, []);
      groups.get(p.cluster).push(p);
    }
    // Crear sub-supra-regiones
    const subIds = [];
    let idx = 0;
    for (const [, grp] of groups) {
      const head = grp.slice().sort((a,b) => (PT_RANK[a.place_type]??9) - (PT_RANK[b.place_type]??9)
                                              || (b.poblacion||0) - (a.poblacion||0))[0];
      const cx = grp.reduce((s,p)=>s+p.lng,0)/grp.length;
      const cy = grp.reduce((s,p)=>s+p.lat,0)/grp.length;
      const nombre = `${sr.nombre} · ${head.nombre}`;
      const ins = await client.query(`
        insert into supra_regiones (mun_cod, isla, capa, nombre, n_nucleos, parent_id, geom)
        values ($1, $2, 'sub', $3, $4, $5, st_setsrid(st_makepoint($6,$7), 4326))
        returning id
      `, [sr.mun_cod, sr.isla, nombre, grp.length, sr.id, cx, cy]);
      subIds.push(ins.rows[0].id);
      // asignar nucleos al sub
      await client.query(
        `update nucleos set supra_region_id = $1 where id = any($2::bigint[])`,
        [ins.rows[0].id, grp.map(p => p.id)]
      );
      subs++;
      idx++;
    }
    // Voronoi recortado al tile padre
    await client.query(`
      with vor as (
        select (st_dump(st_voronoipolygons(st_collect(geom)))).geom as cell
        from supra_regiones where parent_id = $1
      ),
      par as (select geom_tile as tile from supra_regiones where id = $1),
      clip as (
        select st_multi(st_collectionextract(st_intersection(v.cell, p.tile), 3)) tile
        from vor v cross join par p
      )
      update supra_regiones t set geom_tile = c.tile
      from clip c
      where t.parent_id = $1 and st_contains(c.tile, t.geom)
    `, [sr.id]);
  }
  console.log(`  ${subs} sub-supra-regiones creadas (en ${big.rowCount} supra grandes)`);

  // ── 9. Resumen ──
  const sum = await client.query(`
    select capa, count(*) c from supra_regiones group by capa order by 2 desc
  `);
  console.log('\n— Resumen por capa —');
  sum.rows.forEach(r => console.log(`  ${r.capa}: ${r.c}`));
  const cob = await client.query(`select
    (select count(*) from nucleos where supra_region_id is not null) as asignados,
    (select count(*) from nucleos) as total`);
  console.log(`\n  Núcleos asignados: ${cob.rows[0].asignados}/${cob.rows[0].total}`);

  await client.end();
  console.log('\n✔ Supra-regiones computadas.');
}

main().catch(async (e) => { console.error('\n✗ Error:', e.message); console.error(e.stack); try { await client.end(); } catch {} process.exit(1); });
