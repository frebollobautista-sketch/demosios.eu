#!/usr/bin/env node
/**
 * extract-gc-municipios.mjs
 *
 * Extrae límites municipales de Gran Canaria del GeoJSON de secciones censales.
 * Agrupa secciones por municipio y genera un GeoJSON simplificado.
 *
 * Uso:
 *   node scripts/extract-gc-municipios.mjs
 *
 * Entrada: spain-datasets/data/census/SECC_CE_ES-CN_20190101.json
 * Salida:
 *   public/gc-municipios.json     — polígonos municipales
 *   public/gc-secciones.json      — todas las secciones censales de GC
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// Try to find the census sections file
const possiblePaths = [
  join(ROOT, "spain-datasets", "data", "census", "SECC_CE_ES-CN_20190101.json"),
  join(ROOT, "spain-datasets", "data", "census", "secciones_censales_canarias.json"),
];

let censusPath = null;
for (const p of possiblePaths) {
  try {
    readFileSync(p, { encoding: "utf8", flag: "r" });
    censusPath = p;
    break;
  } catch (e) {
    // try next
  }
}

if (!censusPath) {
  console.error("No se encontró el GeoJSON de secciones censales de Canarias.");
  console.error("Buscado en:", possiblePaths.join("\n  "));
  console.error("\nDescarga desde INE o genera con spain-datasets.");
  process.exit(1);
}

console.log(`Leyendo secciones censales: ${censusPath}`);
const allSections = JSON.parse(readFileSync(censusPath, "utf8"));
console.log(`Total secciones Canarias: ${allSections.features.length}`);

// Gran Canaria: province code 35
// Filter sections for province 35 (Gran Canaria)
const gcSections = allSections.features.filter((f) => {
  const cusec = f.properties.CUSEC || f.properties.cusec || "";
  const cpro = f.properties.CPRO || f.properties.cpro || cusec.slice(0, 2);
  return cpro === "35";
});

console.log(`Secciones Gran Canaria: ${gcSections.length}`);

if (gcSections.length === 0) {
  console.error("No se encontraron secciones de provincia 35 (Gran Canaria).");
  console.error("Propiedades de ejemplo:", JSON.stringify(allSections.features[0]?.properties).slice(0, 200));
  process.exit(1);
}

// Save all GC sections
const gcSeccionesGeoJSON = {
  type: "FeatureCollection",
  features: gcSections.map((f, i) => {
    const cusec = f.properties.CUSEC || f.properties.cusec;
    const cmun = f.properties.CMUN || f.properties.cmun || cusec.slice(2, 5);
    const cdis = f.properties.CDIS || f.properties.cdis || cusec.slice(5, 7);
    const csec = f.properties.CSEC || f.properties.csec || cusec.slice(7, 10);
    const nmun = f.properties.NMUN || f.properties.nmun || "";

    return {
      type: "Feature",
      id: i,
      properties: {
        cusec,
        mun: cmun,
        dis: cdis,
        sec: csec,
        nmun,
      },
      geometry: f.geometry,
    };
  }),
};

writeFileSync(
  join(ROOT, "public", "gc-secciones.json"),
  JSON.stringify(gcSeccionesGeoJSON)
);
console.log(`✓ gc-secciones.json — ${gcSeccionesGeoJSON.features.length} secciones`);

// Group by municipality and create municipal boundaries
// Simple approach: use the convex hull of each municipality's sections
// Better approach: merge/union polygons — but that requires turf or similar
// For now, we'll just keep all sections grouped by municipality

const munMap = {};
for (const f of gcSeccionesGeoJSON.features) {
  const mun = f.properties.mun;
  if (!munMap[mun]) {
    munMap[mun] = {
      code: mun,
      name: f.properties.nmun,
      sections: [],
      features: [],
    };
  }
  munMap[mun].sections.push(f.properties.cusec);
  munMap[mun].features.push(f);
}

// For municipality boundaries, pick the outer boundary
// Simple approach: bounding box per municipality + all section polygons
const munFeatures = Object.values(munMap).map((m, i) => {
  // Merge all coordinates to find bbox
  let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;
  const allCoords = [];

  for (const f of m.features) {
    const scan = (coords) => {
      if (typeof coords[0] === "number") {
        if (coords[0] < minLng) minLng = coords[0];
        if (coords[0] > maxLng) maxLng = coords[0];
        if (coords[1] < minLat) minLat = coords[1];
        if (coords[1] > maxLat) maxLat = coords[1];
        allCoords.push(coords);
      } else {
        for (const c of coords) scan(c);
      }
    };
    scan(f.geometry.coordinates);
  }

  // Use a MultiPolygon with all section polygons as the municipality geometry
  const polygons = m.features
    .map((f) => {
      if (f.geometry.type === "Polygon") return f.geometry.coordinates;
      if (f.geometry.type === "MultiPolygon")
        return f.geometry.coordinates.flat();
      return null;
    })
    .filter(Boolean);

  return {
    type: "Feature",
    id: i,
    properties: {
      mun: m.code,
      nmun: m.name,
      sections: m.sections.length,
      bbox: [minLng, minLat, maxLng, maxLat],
    },
    geometry: {
      type: "MultiPolygon",
      coordinates: polygons.map((p) =>
        Array.isArray(p[0][0]) ? p : [p]
      ),
    },
  };
});

const munGeoJSON = {
  type: "FeatureCollection",
  features: munFeatures,
};

writeFileSync(
  join(ROOT, "public", "gc-municipios.json"),
  JSON.stringify(munGeoJSON)
);

console.log(`\n✓ gc-municipios.json — ${munFeatures.length} municipios:`);
for (const m of Object.values(munMap).sort((a, b) => a.code.localeCompare(b.code))) {
  console.log(`  ${m.code} ${m.name.padEnd(30)} ${m.sections.length} secciones`);
}

console.log(`\nArchivos en: ${join(ROOT, "public")}/`);
