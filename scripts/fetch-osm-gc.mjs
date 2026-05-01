#!/usr/bin/env node
/**
 * fetch-osm-gc.mjs
 *
 * Descarga datos OSM de toda Gran Canaria via Overpass API.
 * Genera GeoJSON por capa, listos para el visor Polis.
 *
 * Uso:
 *   node scripts/fetch-osm-gc.mjs
 *
 * Salida en public/osm-gc/:
 *   buildings.json, roads.json, parks.json, coastline.json, pois.json, water.json
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "osm-gc");
mkdirSync(OUT_DIR, { recursive: true });

// Bounding box: Gran Canaria completa
const BBOX = "27.73,-15.86,28.21,-15.35";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

const DELAY_MS = 8000; // más pausa porque las queries son más grandes
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function query(overpassQL, label) {
  console.log(`  → Enviando query (${label})...`);
  const body = `data=${encodeURIComponent(overpassQL)}`;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(OVERPASS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "*/*",
          "User-Agent": "KOINOS-Polis/1.0",
        },
        body,
        signal: AbortSignal.timeout(180000), // 3 min para isla completa
      });
      console.log(`  → Respuesta: ${res.status} ${res.statusText}`);
      if (res.status === 429 || res.status === 504) {
        console.log(`  ⏳ Servidor saturado, esperando 30s (intento ${attempt}/${maxRetries})...`);
        await sleep(30000);
        continue;
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Overpass error ${res.status}: ${text.slice(0, 300)}`);
      }
      const json = await res.json();
      console.log(`  → Elementos recibidos: ${json.elements?.length ?? 0}`);
      return json;
    } catch (err) {
      if (err.name === "TimeoutError" && attempt < maxRetries) {
        console.log(`  ⏳ Timeout, reintentando (${attempt}/${maxRetries})...`);
        await sleep(15000);
        continue;
      }
      throw err;
    }
  }
  throw new Error("Máximo de reintentos alcanzado");
}

// ── Helpers: Overpass → GeoJSON ──

function nodeToFeature(el) {
  return {
    type: "Feature",
    properties: el.tags || {},
    geometry: { type: "Point", coordinates: [el.lon, el.lat] },
    id: el.id,
  };
}

function wayToFeature(el) {
  if (!el.geometry) return null;
  const coords = el.geometry.map((g) => [g.lon, g.lat]);
  const isClosed =
    coords.length > 2 &&
    coords[0][0] === coords[coords.length - 1][0] &&
    coords[0][1] === coords[coords.length - 1][1];
  return {
    type: "Feature",
    properties: el.tags || {},
    geometry: {
      type: isClosed ? "Polygon" : "LineString",
      coordinates: isClosed ? [coords] : coords,
    },
    id: el.id,
  };
}

function toGeoJSON(data) {
  const features = [];
  for (const el of data.elements) {
    let f = null;
    if (el.type === "node") f = nodeToFeature(el);
    else if (el.type === "way") f = wayToFeature(el);
    else if (el.type === "relation" && el.members) {
      for (const m of el.members) {
        if (m.type === "way" && m.geometry) {
          const coords = m.geometry.map((g) => [g.lon, g.lat]);
          const isClosed =
            coords.length > 2 &&
            coords[0][0] === coords[coords.length - 1][0] &&
            coords[0][1] === coords[coords.length - 1][1];
          features.push({
            type: "Feature",
            properties: { ...el.tags, role: m.role },
            geometry: {
              type: isClosed ? "Polygon" : "LineString",
              coordinates: isClosed ? [coords] : coords,
            },
            id: `${el.id}-${m.ref}`,
          });
        }
      }
      continue;
    }
    if (f) features.push(f);
  }
  return { type: "FeatureCollection", features };
}

function save(name, geojson) {
  const path = join(OUT_DIR, `${name}.json`);
  writeFileSync(path, JSON.stringify(geojson));
  const sizeMB = (JSON.stringify(geojson).length / 1024 / 1024).toFixed(1);
  console.log(`  ✓ ${name}.json — ${geojson.features.length} features (${sizeMB} MB)`);
}

// ── Queries ──

async function fetchBuildings() {
  console.log("\n1/6 Edificios (isla completa, puede tardar 1-2 min)...");
  const data = await query(`
    [out:json][timeout:180][bbox:${BBOX}];
    (
      way["building"];
      relation["building"];
    );
    out body geom;
  `, "buildings");
  const gj = toGeoJSON(data);
  for (const f of gj.features) {
    const p = f.properties;
    f.properties = {
      name: p.name || p["addr:housename"] || null,
      street: p["addr:street"] || null,
      housenumber: p["addr:housenumber"] || null,
      levels: p["building:levels"] ? parseInt(p["building:levels"]) : null,
      building_type: p.building !== "yes" ? p.building : null,
      amenity: p.amenity || null,
      shop: p.shop || null,
      tourism: p.tourism || null,
      office: p.office || null,
      osm_id: f.id,
    };
  }
  save("buildings", gj);
}

async function fetchRoads() {
  console.log("\n2/6 Carreteras...");
  const data = await query(`
    [out:json][timeout:120][bbox:${BBOX}];
    way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|pedestrian|living_street|unclassified|service|footway|path|cycleway|track)$"];
    out body geom;
  `, "roads");
  const gj = toGeoJSON(data);
  for (const f of gj.features) {
    const p = f.properties;
    f.properties = {
      name: p.name || null,
      highway: p.highway,
      lanes: p.lanes ? parseInt(p.lanes) : null,
      surface: p.surface || null,
      oneway: p.oneway || null,
      ref: p.ref || null,
      osm_id: f.id,
    };
  }
  save("roads", gj);
}

async function fetchParks() {
  console.log("\n3/6 Parques y zonas verdes...");
  const data = await query(`
    [out:json][timeout:90][bbox:${BBOX}];
    (
      way["leisure"="park"];
      way["leisure"="garden"];
      way["landuse"="grass"];
      way["landuse"="forest"];
      way["leisure"="playground"];
      way["natural"="wood"];
      way["landuse"="farmland"];
      way["landuse"="vineyard"];
      way["landuse"="orchard"];
      relation["leisure"="park"];
      relation["landuse"="forest"];
      relation["natural"="wood"];
    );
    out body geom;
  `, "parks");
  const gj = toGeoJSON(data);
  for (const f of gj.features) {
    const p = f.properties;
    f.properties = {
      name: p.name || null,
      type: p.leisure || p.landuse || p.natural || "green",
      osm_id: f.id,
    };
  }
  save("parks", gj);
}

async function fetchCoastline() {
  console.log("\n4/6 Costa y playas...");
  const data = await query(`
    [out:json][timeout:60][bbox:${BBOX}];
    (
      way["natural"="coastline"];
      way["natural"="beach"];
      relation["natural"="coastline"];
    );
    out body geom;
  `, "coastline");
  const gj = toGeoJSON(data);
  for (const f of gj.features) {
    const p = f.properties;
    f.properties = {
      name: p.name || null,
      type: p.natural,
      surface: p.surface || null,
      osm_id: f.id,
    };
  }
  save("coastline", gj);
}

async function fetchPOIs() {
  console.log("\n5/6 Puntos de interés...");
  const data = await query(`
    [out:json][timeout:90][bbox:${BBOX}];
    (
      node["amenity"~"^(restaurant|cafe|bar|bank|pharmacy|hospital|school|university|library|theatre|cinema|place_of_worship|police|fire_station|post_office|marketplace|fuel|bus_station|ferry_terminal|townhall)$"];
      node["tourism"~"^(hotel|hostel|museum|attraction|viewpoint|information|camp_site|apartment)$"];
      node["shop"~"^(supermarket|mall|convenience|bakery|butcher|clothes|department_store)$"];
      node["leisure"~"^(sports_centre|stadium|swimming_pool|fitness_centre|marina)$"];
      node["natural"~"^(peak|volcano|cave_entrance)$"];
    );
    out body;
  `, "pois");
  const gj = toGeoJSON(data);
  for (const f of gj.features) {
    const p = f.properties;
    const category = p.amenity || p.tourism || p.shop || p.leisure || p.natural || "other";
    f.properties = {
      name: p.name || null,
      category,
      ele: p.ele ? parseFloat(p.ele) : null,
      cuisine: p.cuisine || null,
      phone: p.phone || null,
      website: p.website || null,
      opening_hours: p.opening_hours || null,
      osm_id: f.id,
    };
  }
  save("pois", gj);
}

async function fetchWater() {
  console.log("\n6/6 Agua...");
  const data = await query(`
    [out:json][timeout:60][bbox:${BBOX}];
    (
      way["natural"="water"];
      way["waterway"];
      way["landuse"="reservoir"];
      relation["natural"="water"];
      node["amenity"="fountain"];
      way["amenity"="fountain"];
    );
    out body geom;
  `, "water");
  const gj = toGeoJSON(data);
  for (const f of gj.features) {
    const p = f.properties;
    f.properties = {
      name: p.name || null,
      type: p.natural || p.waterway || p.amenity || p.landuse || "water",
      osm_id: f.id,
    };
  }
  save("water", gj);
}

// ── Main ──

async function main() {
  console.log("╔═══════════════════════════════════════════════╗");
  console.log("║  KOINOS POLIS — Descarga OSM GRAN CANARIA    ║");
  console.log("╚═══════════════════════════════════════════════╝");
  console.log(`Bounding box: ${BBOX}`);
  console.log(`Destino: ${OUT_DIR}/\n`);

  const steps = [
    ["buildings", fetchBuildings],
    ["roads", fetchRoads],
    ["parks", fetchParks],
    ["coastline", fetchCoastline],
    ["pois", fetchPOIs],
    ["water", fetchWater],
  ];

  let done = 0;
  for (const [name, fn] of steps) {
    try {
      await fn();
      done++;
    } catch (err) {
      console.error(`\n✗ Error en ${name}:`, err.message);
      console.error("  Continuando con la siguiente capa...\n");
    }
    if (done < steps.length) {
      console.log(`  Esperando ${DELAY_MS / 1000}s antes de la siguiente query...`);
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  ${done}/${steps.length} capas descargadas.`);
  console.log(`  Archivos en: ${OUT_DIR}/`);
  console.log(`═══════════════════════════════════════════\n`);

  if (done === 0) {
    console.error("Ninguna capa se descargó. Comprueba tu conexión a internet.");
    process.exit(1);
  }
}

main();
