#!/usr/bin/env node
/**
 * fetch-renta-ine.mjs
 *
 * Descarga el Atlas de Distribución de Renta de los Hogares del INE
 * y genera un JSON indexado por CUSEC para la provincia 35.
 *
 * Uso:
 *   node scripts/fetch-renta-ine.mjs
 *
 * Salida: public/data/renta-seccion.json
 *   { "3501601001": { renta: 28450, year: 2022 }, ... }
 *
 * Fuente: INE tabla 31097 (Renta media por persona por sección censal)
 * URL: https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/31097.csv
 *
 * Si la descarga directa falla, también se puede descargar manualmente:
 *   1. Ir a https://www.ine.es/jaxiT3/Tabla.htm?t=31097
 *   2. Filtrar por provincia "35 Las Palmas"
 *   3. Descargar CSV
 *   4. Guardar como scripts/renta_raw.csv
 *   5. Ejecutar este script con --local
 */

import { writeFileSync, readFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "public", "data");
mkdirSync(OUT_DIR, { recursive: true });

const useLocal = process.argv.includes("--local");
const INE_URL = "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/31097.csv";

async function getCSV() {
  if (useLocal) {
    const localPath = join(__dirname, "renta_raw.csv");
    if (!existsSync(localPath)) {
      console.error("No se encontró scripts/renta_raw.csv");
      console.error("Descarga manualmente desde: " + INE_URL);
      process.exit(1);
    }
    console.log("Usando archivo local: " + localPath);
    return readFileSync(localPath, "utf8");
  }

  console.log("Descargando desde INE...");
  console.log("URL: " + INE_URL);
  const res = await fetch(INE_URL, {
    headers: { "User-Agent": "KOINOS-Polis/1.0" },
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`INE error ${res.status}`);
  return await res.text();
}

async function main() {
  console.log("╔═══════════════════════════════════════════╗");
  console.log("║  KOINOS — Descarga Renta INE (prov. 35)  ║");
  console.log("╚═══════════════════════════════════════════╝\n");

  let csv;
  try {
    csv = await getCSV();
  } catch (e) {
    console.error("Error descargando:", e.message);
    console.error("\nAlternativa manual:");
    console.error("  1. Descarga CSV desde " + INE_URL);
    console.error("  2. Guárdalo como scripts/renta_raw.csv");
    console.error("  3. Ejecuta: node scripts/fetch-renta-ine.mjs --local");
    process.exit(1);
  }

  console.log("CSV recibido:", (csv.length / 1024).toFixed(0), "KB");

  // Parse INE CSV format (tabla 31097)
  // Columns: Municipios;Distritos;Secciones;Indicadores de renta media y mediana;Periodo;Total
  // - Municipios: "35016 Palmas de Gran Canaria, Las"
  // - Distritos: "01" or empty (at municipal level)
  // - Secciones: "001" or empty (at district/municipal level)
  // - Indicadores: "Renta neta media por persona", "Renta neta media por hogar", etc.
  // - Periodo: "2023", "2022", etc.
  // - Total: "16.893" (Spanish format, . = thousands separator)
  // CUSEC = municipio(5) + distrito(2) + seccion(3)
  const lines = csv.split("\n").map((l) => l.trim()).filter(Boolean);
  console.log("Líneas:", lines.length);

  const header = lines[0].split(";");
  console.log("Columnas:", header);

  // Find column indices
  const iMun = header.findIndex(h => h.match(/[Mm]unicipio/));
  const iDis = header.findIndex(h => h.match(/[Dd]istrito/));
  const iSec = header.findIndex(h => h.match(/[Ss]ecci[oó]n/));
  const iInd = header.findIndex(h => h.match(/[Ii]ndicador/));
  const iPer = header.findIndex(h => h.match(/[Pp]eriodo/));
  const iTotal = header.findIndex(h => h.match(/[Tt]otal/));
  console.log(`Índices: mun=${iMun} dis=${iDis} sec=${iSec} ind=${iInd} per=${iPer} total=${iTotal}`);

  const result = {};
  let count = 0;
  let skipped = 0;
  let lastMun = "";
  let lastDis = "";

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(";");
    if (cols.length < 4) { skipped++; continue; }

    // Track current municipio/distrito (INE CSV repeats them only when they change)
    const munCol = (cols[iMun] || "").replace(/"/g, "").trim();
    const disCol = (cols[iDis] || "").replace(/"/g, "").trim();
    const secCol = (cols[iSec] || "").replace(/"/g, "").trim();
    const indCol = (cols[iInd] || "").replace(/"/g, "").trim();
    const perCol = (cols[iPer] || "").replace(/"/g, "").trim();
    const totalCol = (cols[iTotal] || "").replace(/"/g, "").trim();

    // Update tracking
    if (munCol) lastMun = munCol;
    if (disCol) lastDis = disCol;

    // Only process section-level rows with "Renta neta media por persona"
    if (!secCol) { skipped++; continue; }
    if (!indCol.includes("Renta neta media por persona")) { skipped++; continue; }

    // Extract municipio code (5 digits at start)
    const munMatch = lastMun.match(/^(\d{5})/);
    if (!munMatch) { skipped++; continue; }
    const munCode = munMatch[1];

    // Filter province 35
    if (!munCode.startsWith("35")) { skipped++; continue; }

    // Extract distrito (2 digits)
    const disMatch = lastDis.match(/(\d{2})/);
    if (!disMatch) { skipped++; continue; }
    const disCode = disMatch[1];

    // Extract seccion (3 digits)
    const secMatch = secCol.match(/(\d{3})/);
    if (!secMatch) { skipped++; continue; }
    const secCode = secMatch[1];

    const cusec = munCode + disCode + secCode;

    // Parse year
    const year = parseInt(perCol) || 2022;

    // Parse renta value (Spanish: "16.893" means 16893, "." = thousands sep)
    if (totalCol === "." || totalCol === "" || totalCol === "..") { skipped++; continue; }
    const numStr = totalCol.replace(/\./g, "").replace(",", ".");
    const renta = parseFloat(numStr);
    if (isNaN(renta) || renta < 100) { skipped++; continue; }

    // Keep most recent year per section
    if (!result[cusec] || (result[cusec].year < year)) {
      result[cusec] = { renta: Math.round(renta), year };
      count++;
    }
  }

  console.log(`\nParsed: ${count} secciones con renta`);
  console.log(`Skipped: ${skipped} líneas`);

  if (count === 0) {
    console.error("\nNo se encontraron datos. El formato del CSV puede haber cambiado.");
    console.error("Revisa manualmente el archivo y ajusta el parser.");
    // Save raw for debugging
    writeFileSync(join(__dirname, "renta_debug.csv"), csv.slice(0, 5000));
    console.error("Primeras líneas guardadas en scripts/renta_debug.csv");
    process.exit(1);
  }

  // Stats
  const rentas = Object.values(result).map((r) => r.renta).sort((a, b) => a - b);
  console.log(`\nEstadísticas provincia 35:`);
  console.log(`  Min: ${rentas[0]}€`);
  console.log(`  Max: ${rentas[rentas.length - 1]}€`);
  console.log(`  Mediana: ${rentas[Math.floor(rentas.length / 2)]}€`);
  console.log(`  Media: ${Math.round(rentas.reduce((a, b) => a + b, 0) / rentas.length)}€`);

  // Save
  const outPath = join(OUT_DIR, "renta-seccion.json");
  writeFileSync(outPath, JSON.stringify(result));
  console.log(`\n✓ ${outPath}`);
  console.log(`  ${count} secciones, ${(JSON.stringify(result).length / 1024).toFixed(0)} KB`);
}

main();
