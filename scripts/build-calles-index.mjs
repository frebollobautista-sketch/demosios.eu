#!/usr/bin/env node
// scripts/build-calles-index.mjs — Callejero global de Canarias.
//
// Pre-procesa los roads.json de OSM (gitignored, ~84MB combinados) y
// produce un índice ligero versionable para el buscador transversal:
//
//   public/osm-gc/roads.json        (prov 35 — Gran Canaria, FV, Lanz.)
//   public/osm-prov38/roads.json    (prov 38 — Tenerife, La Palma, Gomera, Hierro)
//                                     ↓
//   public/data/calles-canarias-index.json
//
// Para cada LineString con `name` y `highway` indexable (residencial,
// primaria, secundaria, terciaria, peatonal, etc.) calcula su centroide,
// le asigna municipio por point-in-polygon contra
// canarias-municipios-poly.json (88 municipios), y agrupa por
// (nombre_normalizado, código_mun) para emitir una entrada por
// calle-en-municipio (la misma "Calle Real" en muns distintos son
// entradas distintas).
//
// Formato compacto (keys de 1-2 letras) para mantener el JSON pequeño;
// el formato final se puede ajustar después — el usuario dijo
// "luego vemos el formato".
//
// Uso:
//   node scripts/build-calles-index.mjs

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..");

// Tipos de calle que vale indexar (excluye footways, cycleways, links).
const HIGHWAY_INDEXABLE = new Set([
  "residential", "primary", "secondary", "tertiary",
  "pedestrian", "living_street", "unclassified"
]);

// Prioridad para elegir el "tipo dominante" cuando una calle tiene
// tramos heterogéneos.
const TIPO_PRIO = [
  "primary", "secondary", "tertiary", "pedestrian",
  "living_street", "residential", "unclassified"
];

// -----------------------------------------------------------
// Helpers geométricos

function norm(s) {
  return String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().trim();
}

// Ray casting sobre un anillo [[lon,lat], ...].
function pointInRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = ((yi > lat) !== (yj > lat))
      && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInGeom(lon, lat, geom) {
  if (!geom) return false;
  if (geom.type === "Polygon") {
    const [outer, ...holes] = geom.coordinates;
    if (!pointInRing(lon, lat, outer)) return false;
    return !holes.some(h => pointInRing(lon, lat, h));
  }
  if (geom.type === "MultiPolygon") {
    return geom.coordinates.some(poly => {
      const [outer, ...holes] = poly;
      if (!pointInRing(lon, lat, outer)) return false;
      return !holes.some(h => pointInRing(lon, lat, h));
    });
  }
  return false;
}

function geomBbox(geom) {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  const eat = (rings) => {
    for (const ring of rings) for (const [x, y] of ring) {
      if (x < minLon) minLon = x; if (x > maxLon) maxLon = x;
      if (y < minLat) minLat = y; if (y > maxLat) maxLat = y;
    }
  };
  if (geom.type === "Polygon") eat(geom.coordinates);
  else if (geom.type === "MultiPolygon") for (const p of geom.coordinates) eat(p);
  return [minLon, minLat, maxLon, maxLat];
}

function lineCentroidAndBbox(coords) {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  let sumLon = 0, sumLat = 0;
  for (const [x, y] of coords) {
    if (x < minLon) minLon = x; if (x > maxLon) maxLon = x;
    if (y < minLat) minLat = y; if (y > maxLat) maxLat = y;
    sumLon += x; sumLat += y;
  }
  const n = coords.length;
  return { c: [sumLon / n, sumLat / n], b: [minLon, minLat, maxLon, maxLat] };
}

const round = (n, d = 5) => Math.round(n * 10 ** d) / 10 ** d;

// -----------------------------------------------------------
// Carga municipios + índice bbox

console.log("⌛ cargando municipios (point-in-polygon)…");
const muniGeo = JSON.parse(readFileSync(join(REPO, "public/canarias-municipios-poly.json"), "utf8"));
const muniIdx = muniGeo.features.map(f => ({
  mun:   f.properties.mun,
  cumun: f.properties.cumun,
  nmun:  f.properties.nmun,
  isla:  f.properties.isla,
  geom:  f.geometry,
  bbox:  geomBbox(f.geometry)
}));
console.log(`  ${muniIdx.length} municipios`);

function asignarMunicipio(lon, lat) {
  for (const m of muniIdx) {
    if (lon < m.bbox[0] || lon > m.bbox[2] || lat < m.bbox[1] || lat > m.bbox[3]) continue;
    if (pointInGeom(lon, lat, m.geom)) return m;
  }
  // Fallback: el más cercano por centro de bbox (calle costera, etc).
  let best = null, bestD = Infinity;
  for (const m of muniIdx) {
    const cx = (m.bbox[0] + m.bbox[2]) / 2;
    const cy = (m.bbox[1] + m.bbox[3]) / 2;
    const d = (cx - lon) ** 2 + (cy - lat) ** 2;
    if (d < bestD) { bestD = d; best = m; }
  }
  return best;
}

// -----------------------------------------------------------
// Acumulador por (nombre_norm, cumun).

const grupos = new Map();

function procesarRoads(path, etiqueta) {
  if (!existsSync(path)) {
    console.warn(`⚠️  ausente: ${path} — saltando ${etiqueta}`);
    return;
  }
  console.log(`⌛ leyendo ${etiqueta} (${path})…`);
  const json = JSON.parse(readFileSync(path, "utf8"));
  const feats = json.features || [];
  console.log(`  ${feats.length} segmentos`);

  let indexados = 0, sinNombre = 0, fueraTipo = 0, ruido = 0;
  for (const f of feats) {
    const name = (f.properties?.name || "").trim();
    const highway = f.properties?.highway;
    if (!name) { sinNombre++; continue; }
    if (!HIGHWAY_INDEXABLE.has(highway)) { fueraTipo++; continue; }
    // Filtra nombres ruido: letras sueltas, "S/N", "-", ".", etc.
    // Exigimos ≥3 caracteres alfanuméricos (sin signos) en el nombre.
    const alnum = name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]/g, "");
    if (alnum.length < 3 || /^s\/?n$/i.test(name)) { ruido++; continue; }
    const coords = f.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length === 0) continue;

    const { c, b } = lineCentroidAndBbox(coords);
    const mun = asignarMunicipio(c[0], c[1]);
    if (!mun) continue;

    const key = norm(name) + "|" + mun.cumun;
    let g = grupos.get(key);
    if (!g) {
      g = {
        nombre: name, tiposCount: {}, mun, n: 0,
        sumLon: 0, sumLat: 0,
        minLon: Infinity, minLat: Infinity, maxLon: -Infinity, maxLat: -Infinity
      };
      grupos.set(key, g);
    }
    g.tiposCount[highway] = (g.tiposCount[highway] || 0) + 1;
    g.n += 1;
    g.sumLon += c[0]; g.sumLat += c[1];
    if (b[0] < g.minLon) g.minLon = b[0];
    if (b[1] < g.minLat) g.minLat = b[1];
    if (b[2] > g.maxLon) g.maxLon = b[2];
    if (b[3] > g.maxLat) g.maxLat = b[3];

    indexados++;
  }
  console.log(`  ${indexados} indexados · ${sinNombre} sin nombre · ${fueraTipo} tipo no indexable · ${ruido} nombre ruido`);
}

procesarRoads(join(REPO, "public/osm-gc/roads.json"), "osm-gc (prov 35)");
procesarRoads(join(REPO, "public/osm-prov38/roads.json"), "osm-prov38");

console.log(`⌛ consolidando ${grupos.size} entradas únicas…`);

function tipoDominante(tiposCount) {
  const entries = Object.entries(tiposCount);
  entries.sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return TIPO_PRIO.indexOf(a[0]) - TIPO_PRIO.indexOf(b[0]);
  });
  return entries[0][0];
}

const items = [];
for (const g of grupos.values()) {
  items.push({
    n:  g.nombre,
    m:  g.mun.mun,
    mn: g.mun.nmun,
    i:  g.mun.isla,
    t:  tipoDominante(g.tiposCount),
    c:  [round(g.sumLon / g.n), round(g.sumLat / g.n)],
    b:  [round(g.minLon), round(g.minLat), round(g.maxLon), round(g.maxLat)]
  });
}

// Orden estable por nombre normalizado + código municipio.
items.sort((a, b) => {
  const na = norm(a.n), nb = norm(b.n);
  if (na < nb) return -1; if (na > nb) return 1;
  return a.m.localeCompare(b.m);
});

const out = {
  _meta: {
    fuente: "OSM (Geofabrik) — roads prov 35 + prov 38, agrupados por scripts/build-calles-index.mjs",
    generado: new Date().toISOString().slice(0, 10),
    highway_types_indexados: [...HIGHWAY_INDEXABLE],
    municipios_lookup: "public/canarias-municipios-poly.json",
    n: items.length,
    schema: {
      n:  "nombre canónico de la calle",
      m:  "código municipio (3 dígitos INE)",
      mn: "nombre municipio",
      i:  "código isla (gc, tf, eh, lg, lz, fv, lp, hi)",
      t:  "highway dominante",
      c:  "centroide [lon, lat]",
      b:  "bbox [w, s, e, n]"
    }
  },
  items
};

const outPath = join(REPO, "public/data/calles-canarias-index.json");
writeFileSync(outPath, JSON.stringify(out));
const stats = readFileSync(outPath).length;
console.log(`✅ ${items.length} calles → public/data/calles-canarias-index.json`);
console.log(`   tamaño: ${(stats / 1024 / 1024).toFixed(2)} MB`);
console.log(`   primeras 3:`);
for (const it of items.slice(0, 3)) console.log(`     · ${it.n} (${it.mn}, ${it.i}) · ${it.t}`);
