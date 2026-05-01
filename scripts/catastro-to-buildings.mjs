#!/usr/bin/env node
/**
 * catastro-to-buildings.mjs
 *
 * Convierte GML del Catastro INSPIRE en archivos JSON de edificios
 * por sección censal, listos para el visor Polis.
 *
 * NO necesita GDAL ni PostGIS — parsea el GML directamente.
 *
 * Uso:
 *   node scripts/catastro-to-buildings.mjs
 *
 * Entrada: catastro_data/*.zip (o A.ES.SDGC.BU.XXXXX/ dirs ya descomprimidos)
 * Necesita: gc-secciones.json en public/ (secciones censales para asignar edificios)
 *
 * Salida: public/buildings/CUSECCODE.json
 *   Formato: [[coords, height, levels], ...]
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "public", "buildings");
mkdirSync(OUT_DIR, { recursive: true });

// ── UTM Zone 28N → WGS84 conversion ──
// EPSG:32628 (UTM 28N) to EPSG:4326 (WGS84)
// Simplified conversion — good enough for Canarias
function utm28nToWgs84(easting, northing) {
  // UTM Zone 28N parameters
  const k0 = 0.9996;
  const a = 6378137.0; // WGS84 semi-major axis
  const e = 0.0818191908; // eccentricity
  const e2 = e * e;
  const ep2 = e2 / (1 - e2);
  const falseEasting = 500000;
  const x = easting - falseEasting;
  const y = northing;

  const M = y / k0;
  const mu = M / (a * (1 - e2/4 - 3*e2*e2/64 - 5*e2*e2*e2/256));
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));

  const phi1 = mu + (3*e1/2 - 27*e1*e1*e1/32)*Math.sin(2*mu)
    + (21*e1*e1/16 - 55*e1*e1*e1*e1/32)*Math.sin(4*mu)
    + (151*e1*e1*e1/96)*Math.sin(6*mu);

  const sinPhi = Math.sin(phi1);
  const cosPhi = Math.cos(phi1);
  const tanPhi = sinPhi / cosPhi;
  const N1 = a / Math.sqrt(1 - e2 * sinPhi * sinPhi);
  const T1 = tanPhi * tanPhi;
  const C1 = ep2 * cosPhi * cosPhi;
  const R1 = a * (1 - e2) / Math.pow(1 - e2 * sinPhi * sinPhi, 1.5);
  const D = x / (N1 * k0);

  let lat = phi1 - (N1 * tanPhi / R1) * (D*D/2 - (5 + 3*T1 + 10*C1 - 4*C1*C1 - 9*ep2)*D*D*D*D/24
    + (61 + 90*T1 + 298*C1 + 45*T1*T1 - 252*ep2 - 3*C1*C1)*D*D*D*D*D*D/720);

  let lon = (D - (1 + 2*T1 + C1)*D*D*D/6
    + (5 - 2*C1 + 28*T1 - 3*C1*C1 + 8*ep2 + 24*T1*T1)*D*D*D*D*D/120) / cosPhi;

  // Central meridian for zone 28 is -15°
  lat = lat * 180 / Math.PI;
  lon = lon * 180 / Math.PI + (-15);

  return [parseFloat(lon.toFixed(6)), parseFloat(lat.toFixed(6))];
}

// ── GML Parser (simple XML regex-based) ──
function parseGML(gmlContent) {
  const buildings = [];
  // Match each Building or BuildingPart element
  const buildingRegex = /<bu-ext:Building[^>]*>[\s\S]*?<\/bu-ext:Building>/g;
  const partRegex = /<bu-ext:BuildingPart[^>]*>[\s\S]*?<\/bu-ext:BuildingPart>/g;

  const allMatches = [...gmlContent.matchAll(buildingRegex), ...gmlContent.matchAll(partRegex)];

  for (const match of allMatches) {
    const xml = match[0];

    // Extract height
    let height = null;
    const hMatch = xml.match(/<bu-base:value>(\d+\.?\d*)<\/bu-base:value>/);
    if (hMatch) height = parseFloat(hMatch[1]);

    // Extract number of floors
    let levels = null;
    const floorMatch = xml.match(/<bu-ext:numberOfFloorsAboveGround>(\d+)<\/bu-ext:numberOfFloorsAboveGround>/);
    if (floorMatch) levels = parseInt(floorMatch[1]);

    // Extract geometry (posList)
    const posListMatch = xml.match(/<gml:posList[^>]*>([\s\S]*?)<\/gml:posList>/);
    if (!posListMatch) continue;

    const coords = posListMatch[1].trim().split(/\s+/).map(Number);
    if (coords.length < 6) continue; // Need at least 3 points

    // Determine if 2D or 3D coordinates
    // Check srsDimension attribute
    const dimMatch = posListMatch[0].match(/srsDimension="(\d)"/);
    const dim = dimMatch ? parseInt(dimMatch[1]) : (coords.length % 3 === 0 ? 3 : 2);

    const wgs84Coords = [];
    const step = dim;
    for (let i = 0; i < coords.length - step + 1; i += step) {
      // GML order: easting(X), northing(Y), [height(Z)]
      const easting = coords[i];
      const northing = coords[i + 1];

      // Skip if coordinates don't look like UTM 28N
      if (easting < 100000 || easting > 900000 || northing < 3000000 || northing > 3200000) continue;

      const [lon, lat] = utm28nToWgs84(easting, northing);
      wgs84Coords.push([lon, lat]);
    }

    if (wgs84Coords.length < 3) continue;

    // Close polygon if not closed
    const first = wgs84Coords[0];
    const last = wgs84Coords[wgs84Coords.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      wgs84Coords.push([...first]);
    }

    // Default height if not specified
    if (!height && levels) height = levels * 3;
    if (!height) height = 8;

    buildings.push({
      coords: wgs84Coords,
      height: Math.round(height * 10) / 10,
      levels: levels || 0,
    });
  }

  return buildings;
}

// ── Point-in-polygon (ray casting) ──
function pointInPolygon(point, polygon) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// ── Main ──
async function main() {
  console.log("╔═══════════════════════════════════════════════════╗");
  console.log("║  Catastro GML → Buildings JSON por sección       ║");
  console.log("╚═══════════════════════════════════════════════════╝\n");

  // Load sections
  const secPath = join(ROOT, "public", "gc-secciones.json");
  if (!existsSync(secPath)) {
    console.error("Falta gc-secciones.json. Ejecuta primero: node scripts/extract-gc-municipios.mjs");
    process.exit(1);
  }
  const secciones = JSON.parse(readFileSync(secPath, "utf8"));
  console.log(`Secciones censales: ${secciones.features.length}`);

  // Build spatial index: section polygons with bboxes
  const secIndex = secciones.features.map((f) => {
    let minX=180, maxX=-180, minY=90, maxY=-90;
    const ring = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] :
                 f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates[0][0] : null;
    if (!ring) return null;
    for (const [x,y] of ring) {
      if(x<minX)minX=x; if(x>maxX)maxX=x;
      if(y<minY)minY=y; if(y>maxY)maxY=y;
    }
    return {
      cusec: f.properties.cusec,
      ring, minX, maxX, minY, maxY
    };
  }).filter(Boolean);

  function findSection(lng, lat) {
    // Quick bbox filter
    const candidates = secIndex.filter(s =>
      lng >= s.minX && lng <= s.maxX && lat >= s.minY && lat <= s.maxY
    );
    for (const s of candidates) {
      if (pointInPolygon([lng, lat], s.ring)) return s.cusec;
    }
    return null;
  }

  // Find GML files
  const gmlSources = [];

  // Check catastro_data/ for ZIPs
  const dataDir = join(ROOT, "catastro_data");
  if (existsSync(dataDir)) {
    const zips = readdirSync(dataDir).filter(f => f.endsWith('.zip'));
    for (const zip of zips) {
      const codMatch = zip.match(/BU\.(\d{5})\.zip/);
      if (!codMatch) continue;
      const cod = codMatch[1];
      const extractDir = join(dataDir, `A.ES.SDGC.BU.${cod}`);

      // Unzip if not already extracted
      if (!existsSync(extractDir)) {
        console.log(`Descomprimiendo ${zip}...`);
        try {
          execSync(`cd "${dataDir}" && unzip -o -q "${zip}" -d "A.ES.SDGC.BU.${cod}"`, {timeout: 30000});
        } catch (e) {
          console.warn(`  Error descomprimiendo ${zip}:`, e.message);
          continue;
        }
      }
      gmlSources.push(extractDir);
    }
  }

  // Check for already-extracted directories in root
  const rootDirs = readdirSync(ROOT).filter(f => f.match(/^A\.ES\.SDGC\.BU\.\d{5}$/) && existsSync(join(ROOT, f)));
  for (const d of rootDirs) {
    if (!gmlSources.includes(join(ROOT, d))) {
      gmlSources.push(join(ROOT, d));
    }
  }

  if (gmlSources.length === 0) {
    console.error("No se encontraron datos del Catastro.");
    console.error("Ejecuta primero: bash scripts/descargar_catastro_v3.sh");
    process.exit(1);
  }

  console.log(`\nFuentes GML encontradas: ${gmlSources.length}`);

  // Process each source
  let totalBuildings = 0;
  let totalSections = new Set();
  const sectionBuildings = {};

  for (const dir of gmlSources) {
    const codMatch = dir.match(/BU\.(\d{5})/);
    const cod = codMatch ? codMatch[1] : '?';

    // Find building GML file
    const files = readdirSync(dir).filter(f => f.includes('building') && f.endsWith('.gml') && !f.includes('part'));
    if (files.length === 0) {
      console.warn(`  No building GML in ${dir}`);
      continue;
    }

    console.log(`\nProcesando ${cod} (${files[0]})...`);
    const gmlContent = readFileSync(join(dir, files[0]), "utf8");
    const buildings = parseGML(gmlContent);
    console.log(`  ${buildings.length} edificios parseados`);

    // Assign to sections
    let assigned = 0;
    for (const b of buildings) {
      // Centroid
      let cx = 0, cy = 0;
      for (const [x,y] of b.coords) { cx += x; cy += y; }
      cx /= b.coords.length;
      cy /= b.coords.length;

      const cusec = findSection(cx, cy);
      if (!cusec) continue;

      if (!sectionBuildings[cusec]) sectionBuildings[cusec] = [];
      sectionBuildings[cusec].push([b.coords, b.height, b.levels]);
      assigned++;
      totalSections.add(cusec);
    }

    console.log(`  ${assigned}/${buildings.length} asignados a secciones`);
    totalBuildings += assigned;
  }

  // Write section files
  console.log(`\nEscribiendo ${totalSections.size} archivos de secciones...`);
  let written = 0;
  for (const [cusec, buildings] of Object.entries(sectionBuildings)) {
    const outPath = join(OUT_DIR, `${cusec}.json`);
    writeFileSync(outPath, JSON.stringify(buildings));
    written++;
  }

  console.log(`\n═══════════════════════════════════════`);
  console.log(`  ${totalBuildings} edificios totales`);
  console.log(`  ${written} archivos de secciones escritos`);
  console.log(`  Destino: ${OUT_DIR}/`);
  console.log(`═══════════════════════════════════════\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
