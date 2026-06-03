#!/usr/bin/env node
/**
 * audit-supra-nucleos.mjs
 *
 * Audit headless de los geojson supra-regiones + núcleos en las 7 islas.
 * NO toca BD. Lee los ficheros estáticos que sirve polis-app y reporta
 * cobertura, consistencia, integridad referencial y tamaños.
 *
 * Uso:
 *   node scripts/audit-supra-nucleos.mjs
 *
 * Exit codes:
 *   0 → todo ok
 *   1 → warnings (cosas raras pero no rotas)
 *   2 → errores (consistencia rota; runtime no funcionará bien)
 *
 * Diseñado para correr post-export de los scripts/exportar-*.mjs y
 * actuar como gate antes del cutover web.
 */

import { readFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'public', 'data');

const ISLAS = ['gc', 'tf', 'lp', 'lz', 'fv', 'lg', 'eh'];
const ISLA_NAMES = {
  gc: 'Gran Canaria', tf: 'Tenerife', lp: 'La Palma',
  lz: 'Lanzarote', fv: 'Fuerteventura', lg: 'La Gomera', eh: 'El Hierro'
};

// Códigos de salida
let warnings = [];
let errors = [];

// ---------- Helpers ----------

function loadGeoJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    return { _error: e.message };
  }
}

function fileSize(path) {
  if (!existsSync(path)) return 0;
  return statSync(path).size;
}

function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

// Bounding box de un Polygon/MultiPolygon en lng/lat.
function bbox(geom) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const walkRing = ring => {
    for (const [x, y] of ring) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  };
  if (!geom) return null;
  if (geom.type === 'Polygon') {
    for (const r of geom.coordinates) walkRing(r);
  } else if (geom.type === 'MultiPolygon') {
    for (const poly of geom.coordinates) for (const r of poly) walkRing(r);
  } else return null;
  if (!isFinite(minX)) return null;
  return [minX, minY, maxX, maxY];
}

// Área aproximada en m² (lat ≈ 28°, factor ~98 km/° lng × 111 km/° lat).
function approxAreaM2(bb) {
  if (!bb) return 0;
  const [mnx, mny, mxx, mxy] = bb;
  const dx_km = (mxx - mnx) * 98;
  const dy_km = (mxy - mny) * 111;
  return Math.abs(dx_km * dy_km) * 1e6;
}

// ---------- Audit por isla ----------

function auditIsla(isla) {
  const islaName = ISLA_NAMES[isla];
  const result = { isla, islaName, ok: true, supra: {}, nuc: {}, issues: [] };

  const supraPath = join(DATA, `supra-regiones-${isla}.geojson`);
  const nucPath = join(DATA, `nucleos-${isla}.geojson`);

  // ----- Carga -----
  const supraFC = loadGeoJson(supraPath);
  const nucFC = loadGeoJson(nucPath);

  if (!supraFC) {
    result.issues.push(`✗ supra-regiones-${isla}.geojson NO EXISTE`);
    errors.push(`${isla}: supra-regiones geojson ausente`);
    result.ok = false;
    return result;
  }
  if (supraFC._error) {
    result.issues.push(`✗ supra-regiones-${isla}.geojson INVÁLIDO: ${supraFC._error}`);
    errors.push(`${isla}: supra-regiones JSON inválido`);
    result.ok = false;
    return result;
  }
  if (!nucFC) {
    result.issues.push(`✗ nucleos-${isla}.geojson NO EXISTE`);
    errors.push(`${isla}: nucleos geojson ausente`);
    result.ok = false;
    return result;
  }
  if (nucFC._error) {
    result.issues.push(`✗ nucleos-${isla}.geojson INVÁLIDO: ${nucFC._error}`);
    errors.push(`${isla}: nucleos JSON inválido`);
    result.ok = false;
    return result;
  }

  const supras = supraFC.features || [];
  const nucs = nucFC.features || [];

  // ----- Supra-regiones audit -----
  const topLevel = supras.filter(f => f.properties?.parent_id == null);
  const subs = supras.filter(f => f.properties?.parent_id != null);
  const byCapa = {};
  const munsCubiertos = new Set();
  for (const f of supras) {
    const p = f.properties || {};
    byCapa[p.capa || 'NULL'] = (byCapa[p.capa || 'NULL'] || 0) + 1;
    if (p.mun_cod) munsCubiertos.add(p.mun_cod);
  }

  result.supra = {
    total: supras.length,
    topLevel: topLevel.length,
    subs: subs.length,
    byCapa,
    munsCubiertos: munsCubiertos.size,
    fileSize: fmtSize(fileSize(supraPath))
  };

  // ----- Núcleos audit -----
  const orphans = nucs.filter(f => f.properties?.supra_region_id == null);
  const byPlace = {};
  for (const f of nucs) {
    const pt = f.properties?.place_type || 'NULL';
    byPlace[pt] = (byPlace[pt] || 0) + 1;
  }

  result.nuc = {
    total: nucs.length,
    asignados: nucs.length - orphans.length,
    huerfanos: orphans.length,
    byPlace,
    fileSize: fmtSize(fileSize(nucPath))
  };

  if (orphans.length > 0) {
    result.issues.push(`⚠ ${orphans.length} núcleos sin supra_region_id`);
    warnings.push(`${isla}: ${orphans.length} núcleos huérfanos`);
  }

  // ----- Consistencia: todo supra_region_id de núcleo existe en supras -----
  const supraIds = new Set(supras.map(f => String(f.properties?.id)));
  const refsRotas = [];
  for (const n of nucs) {
    const srid = n.properties?.supra_region_id;
    if (srid == null) continue;
    if (!supraIds.has(String(srid))) refsRotas.push({ nuc: n.properties?.nombre, srid });
  }
  if (refsRotas.length > 0) {
    result.issues.push(`✗ ${refsRotas.length} núcleos referencian supra-id inexistente (ej: ${refsRotas.slice(0, 3).map(x => x.srid).join(', ')})`);
    errors.push(`${isla}: ${refsRotas.length} referencias rotas núcleo→supra`);
    result.ok = false;
  }

  // ----- Consistencia: parent_id de subs apunta a top-level de la misma isla -----
  const topLevelIds = new Set(topLevel.map(f => String(f.properties?.id)));
  const parentRotos = [];
  for (const s of subs) {
    const pid = s.properties?.parent_id;
    if (!topLevelIds.has(String(pid))) parentRotos.push({ id: s.properties?.id, parent: pid });
  }
  if (parentRotos.length > 0) {
    result.issues.push(`✗ ${parentRotos.length} sub-supras con parent_id inválido (ej: ${parentRotos.slice(0, 3).map(x => x.parent).join(', ')})`);
    errors.push(`${isla}: ${parentRotos.length} parent_id rotos`);
    result.ok = false;
  }

  // ----- Cobertura: muns de la isla con ≥1 supra top-level -----
  const munConTopLevel = new Set(topLevel.map(f => f.properties?.mun_cod));
  // Para saber qué muns faltan, usamos los muns del catálogo de núcleos
  const munsDeNucleos = new Set(nucs.map(f => f.properties?.mun_cod).filter(Boolean));
  const munsSinSupra = [...munsDeNucleos].filter(m => !munConTopLevel.has(m));
  if (munsSinSupra.length > 0) {
    result.issues.push(`⚠ ${munsSinSupra.length} muns con núcleos pero SIN supra top-level: ${munsSinSupra.slice(0, 5).join(', ')}${munsSinSupra.length > 5 ? '…' : ''}`);
    warnings.push(`${isla}: ${munsSinSupra.length} muns sin supra`);
  }

  // ----- Tamaño geom: tiles aberrantes -----
  const sizesM2 = [];
  for (const s of topLevel) {
    const bb = bbox(s.geometry);
    const area = approxAreaM2(bb);
    sizesM2.push({ nombre: s.properties?.nombre, mun: s.properties?.mun_cod, area });
  }
  sizesM2.sort((a, b) => a.area - b.area);
  result.supra.geom = {
    masPeque: sizesM2.slice(0, 3).map(x => `${x.nombre} (${(x.area / 1e6).toFixed(3)} km²)`),
    masGrande: sizesM2.slice(-3).reverse().map(x => `${x.nombre} (${(x.area / 1e6).toFixed(2)} km²)`)
  };
  // Aberrantes: tiles <1 ha (puede indicar Voronoi degenerado) o >100 km² (raro en Canarias)
  const aberrantesPeque = sizesM2.filter(x => x.area > 0 && x.area < 10000);
  const aberrantesGrande = sizesM2.filter(x => x.area > 100e6);
  if (aberrantesPeque.length > 0) {
    result.issues.push(`⚠ ${aberrantesPeque.length} supra-tiles <1 ha (Voronoi degenerado?): ${aberrantesPeque.slice(0, 3).map(x => x.nombre).join(', ')}`);
    warnings.push(`${isla}: ${aberrantesPeque.length} tiles degenerados`);
  }
  if (aberrantesGrande.length > 0) {
    result.issues.push(`⚠ ${aberrantesGrande.length} supra-tiles >100 km²: ${aberrantesGrande.slice(0, 3).map(x => x.nombre).join(', ')}`);
    warnings.push(`${isla}: ${aberrantesGrande.length} tiles enormes`);
  }

  return result;
}

// ---------- Render ----------

function printIslaReport(r) {
  console.log(`\n━━━ ${r.isla.toUpperCase()} · ${r.islaName} ━━━`);
  console.log(`  supra-regiones: ${r.supra.total} total / ${r.supra.topLevel} top-level / ${r.supra.subs} sub  (${r.supra.fileSize})`);
  console.log(`    por capa: ${Object.entries(r.supra.byCapa).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  console.log(`    muns cubiertos: ${r.supra.munsCubiertos}`);
  if (r.supra.geom?.masPeque?.length) {
    console.log(`    3 más pequeñas: ${r.supra.geom.masPeque.join(' | ')}`);
    console.log(`    3 más grandes: ${r.supra.geom.masGrande.join(' | ')}`);
  }
  console.log(`  núcleos: ${r.nuc.total} total / ${r.nuc.asignados} con supra / ${r.nuc.huerfanos} huérfanos  (${r.nuc.fileSize})`);
  console.log(`    por place_type: ${Object.entries(r.nuc.byPlace).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  if (r.issues.length === 0) {
    console.log(`  ✔ Sin issues`);
  } else {
    console.log(`  Issues:`);
    for (const i of r.issues) console.log(`    ${i}`);
  }
}

// ---------- Main ----------

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  AUDIT supra-regiones + núcleos · 7 islas Canarias');
console.log(`  ${new Date().toISOString()}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const results = ISLAS.map(auditIsla);
for (const r of results) printIslaReport(r);

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  SUMMARY');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// Tabla síntesis
const colWidths = { isla: 4, supraT: 7, supraTop: 8, subs: 4, nucT: 6, nucOrph: 6 };
console.log(`  ${'isla'.padEnd(4)} | ${'supraT'.padStart(7)} | ${'topLvl'.padStart(7)} | ${'subs'.padStart(4)} | ${'nucT'.padStart(6)} | ${'nucOrph'.padStart(7)} | status`);
console.log(`  ${'─'.repeat(4)} | ${'─'.repeat(7)} | ${'─'.repeat(7)} | ${'─'.repeat(4)} | ${'─'.repeat(6)} | ${'─'.repeat(7)} | ─────`);
for (const r of results) {
  const status = !r.ok ? '✗ ERROR' : r.issues.length === 0 ? '✔ ok' : `⚠ ${r.issues.length}w`;
  console.log(`  ${r.isla.padEnd(4)} | ${String(r.supra.total).padStart(7)} | ${String(r.supra.topLevel).padStart(7)} | ${String(r.supra.subs).padStart(4)} | ${String(r.nuc.total).padStart(6)} | ${String(r.nuc.huerfanos).padStart(7)} | ${status}`);
}

console.log('');
if (errors.length > 0) {
  console.log(`✗ ${errors.length} ERRORES:`);
  for (const e of errors) console.log(`   · ${e}`);
}
if (warnings.length > 0) {
  console.log(`⚠ ${warnings.length} WARNINGS:`);
  for (const w of warnings) console.log(`   · ${w}`);
}
if (errors.length === 0 && warnings.length === 0) {
  console.log('✔ TODO OK · listo para cutover');
}

console.log('');
process.exit(errors.length > 0 ? 2 : warnings.length > 0 ? 1 : 0);
