#!/usr/bin/env node
/**
 * fetch-renta-ine-canarias.mjs
 *
 * Descarga renta del Atlas INE (tabla 31097) para AMBAS provincias
 * canarias (35 + 38) y genera renta-seccion.json combinado.
 *
 * Mejoras vs fetch-renta-ine.mjs (que solo cubría prov 35):
 *   - Filtra mun starts with "35" OR "38"
 *   - Captura "Renta neta media por persona" → renta
 *   - Captura "Renta neta media por hogar" → hogar (campo extra que el
 *     visor consume vía dashboard.js).
 *
 * Uso:
 *   node scripts/fetch-renta-ine-canarias.mjs           # fetch directo
 *   node scripts/fetch-renta-ine-canarias.mjs --local   # usa renta_raw.csv
 */

import { writeFileSync, readFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "public", "data");
mkdirSync(OUT_DIR, { recursive: true });

const useLocal = process.argv.includes("--local");
// INE Atlas Distribución Renta de los Hogares — pruebas de tablas para
// nivel SECCIÓN CENSAL. La 30896/31097 son por municipio.
// Candidatos por sección: 30824 (renta), 30825, 30832 (índices).
// Probamos 30824 (Renta media por persona por sección).
const INE_URL = "https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/30824.csv";

async function getCSV() {
  if (useLocal) {
    const localPath = join(__dirname, "renta_raw.csv");
    if (!existsSync(localPath)) {
      console.error("No se encontró scripts/renta_raw.csv");
      process.exit(1);
    }
    return readFileSync(localPath, "utf8");
  }
  console.log("Descargando desde INE…");
  const res = await fetch(INE_URL, {
    headers: { "User-Agent": "KOINOS-Polis/2.0" },
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw new Error(`INE error ${res.status}`);
  return await res.text();
}

async function main() {
  console.log("╔════════════════════════════════════════════════╗");
  console.log("║  Renta INE — Canarias (prov 35 + 38) v2        ║");
  console.log("╚════════════════════════════════════════════════╝\n");

  let csv;
  try {
    csv = await getCSV();
  } catch (e) {
    console.error("Error:", e.message);
    process.exit(1);
  }
  console.log("CSV:", (csv.length / 1024).toFixed(0), "KB");

  const lines = csv.split("\n").map((l) => l.trim()).filter(Boolean);
  const header = lines[0].split(";");
  const iMun = header.findIndex(h => /[Mm]unicipio/.test(h));
  const iDis = header.findIndex(h => /[Dd]istrito/.test(h));
  const iSec = header.findIndex(h => /[Ss]ecci[oó]n/.test(h));
  const iInd = header.findIndex(h => /[Ii]ndicador/.test(h));
  const iPer = header.findIndex(h => /[Pp]eriodo/.test(h));
  const iTotal = header.findIndex(h => /[Tt]otal/.test(h));
  console.log(`Cols: mun=${iMun} dis=${iDis} sec=${iSec} ind=${iInd} per=${iPer} total=${iTotal}`);

  const result = {};   // cusec → { renta, hogar, year }
  let cRenta = 0, cHogar = 0, skipped = 0;
  let lastMun = "", lastDis = "";

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(";");
    if (cols.length < 4) { skipped++; continue; }
    const munCol = (cols[iMun] || "").replace(/"/g, "").trim();
    const disCol = (cols[iDis] || "").replace(/"/g, "").trim();
    const secCol = (cols[iSec] || "").replace(/"/g, "").trim();
    const indCol = (cols[iInd] || "").replace(/"/g, "").trim();
    const perCol = (cols[iPer] || "").replace(/"/g, "").trim();
    const totalCol = (cols[iTotal] || "").replace(/"/g, "").trim();
    if (munCol) lastMun = munCol;
    if (disCol) lastDis = disCol;
    if (!secCol) { skipped++; continue; }

    // Detectar qué indicador es
    const isPersona = indCol.includes("Renta neta media por persona");
    const isHogar = indCol.includes("Renta neta media por hogar");
    if (!isPersona && !isHogar) { skipped++; continue; }

    const munMatch = lastMun.match(/^(\d{5})/);
    if (!munMatch) { skipped++; continue; }
    const munCode = munMatch[1];
    // Filter Canarias (prov 35 OR 38)
    if (!munCode.startsWith("35") && !munCode.startsWith("38")) { skipped++; continue; }

    const disMatch = lastDis.match(/(\d{2})/);
    if (!disMatch) { skipped++; continue; }
    const secMatch = secCol.match(/(\d{3})/);
    if (!secMatch) { skipped++; continue; }
    const cusec = munCode + disMatch[1] + secMatch[1];
    const year = parseInt(perCol) || 2022;

    if (totalCol === "." || totalCol === "" || totalCol === "..") { skipped++; continue; }
    const numStr = totalCol.replace(/\./g, "").replace(",", ".");
    const val = parseFloat(numStr);
    if (isNaN(val) || val < 100) { skipped++; continue; }

    const entry = result[cusec] = result[cusec] || { year };
    // Mantener año más reciente
    if (entry.year !== undefined && entry.year < year) {
      // Reset para nuevo año
      entry.year = year;
      delete entry.renta; delete entry.hogar;
    }
    if (isPersona && (entry.renta === undefined || entry.year <= year)) {
      entry.renta = Math.round(val); entry.year = year; cRenta++;
    }
    if (isHogar && (entry.hogar === undefined || entry.year <= year)) {
      entry.hogar = Math.round(val); entry.year = year; cHogar++;
    }
  }

  const total = Object.keys(result).length;
  const conRenta = Object.values(result).filter(r => r.renta).length;
  const conHogar = Object.values(result).filter(r => r.hogar).length;
  const prov35 = Object.keys(result).filter(k => k.startsWith("35")).length;
  const prov38 = Object.keys(result).filter(k => k.startsWith("38")).length;
  console.log(`\nResultados:`);
  console.log(`  Total cusecs: ${total} (prov 35: ${prov35}, prov 38: ${prov38})`);
  console.log(`  con renta:   ${conRenta}`);
  console.log(`  con hogar:   ${conHogar}`);
  console.log(`  skipped lines: ${skipped}`);

  if (total === 0) {
    console.error("No se encontraron datos. CSV puede haber cambiado de formato.");
    writeFileSync(join(__dirname, "renta_debug.csv"), csv.slice(0, 5000));
    process.exit(1);
  }

  // Stats por prov
  for (const prov of ["35", "38"]) {
    const vals = Object.entries(result)
      .filter(([k]) => k.startsWith(prov))
      .map(([, r]) => r.renta).filter(Boolean)
      .sort((a, b) => a - b);
    if (!vals.length) continue;
    console.log(`\nProv ${prov} renta€/persona:`);
    console.log(`  min ${vals[0]} · max ${vals[vals.length-1]} · mediana ${vals[Math.floor(vals.length/2)]}`);
  }

  // Backup actual y escribir
  const outPath = join(OUT_DIR, "renta-seccion.json");
  if (existsSync(outPath)) {
    const bkp = outPath.replace(".json", `.backup-${Date.now()}.json`);
    writeFileSync(bkp, readFileSync(outPath));
    console.log(`\nBackup → ${bkp}`);
  }
  writeFileSync(outPath, JSON.stringify(result));
  console.log(`\n✓ ${outPath}`);
  console.log(`  ${total} secciones · ${(JSON.stringify(result).length / 1024).toFixed(0)} KB`);
}

main();
