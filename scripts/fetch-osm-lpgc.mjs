#!/usr/bin/env node
/**
 * fetch-osm-lpgc.mjs
 *
 * Descarga datos OSM de Las Palmas de Gran Canaria via Overpass API.
 * Genera GeoJSON por capa, listos para el renderizador 3D de Polis.
 *
 * Uso:
 *   node scripts/fetch-osm-lpgc.mjs
 *
 * Salida en public/osm/:
 *   buildings.json    — edificios con nombre, dirección, niveles, uso
 *   roads.json        — carreteras con tipo y nombre
 *   parks.json        — parques y zonas verdes
 *   coastline.json    — línea de costa
 *   pois.json         — puntos de interés con nombre y tipo
 *   water.json        — fuentes de agua, ríos, estanques
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Check Node version for fetch support
const nodeVersion = parseInt(process.version.slice(1));
console.log(`Node ${process.version} detectado`);
if (nodeVersion < 18) {
  console.error("⚠ Necesitas Node 18+ para fetch nativo.");
  console.error("  Alternativa: npm install node-fetch y cambiar el import.");
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "osm");
mkdirSync(OUT_DIR, { recursive: true });
console.log(`Directorio de salida: ${OUT_DIR}`);

// Bounding box: Las Palmas de Gran Canaria (generoso, cubre toda la ciudad)
const BBOX = "28.06,-15.46,28.17,-15.40";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// Pausa entre queries para no saturar el servidor
const DELAY_MS = 4000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function query(overpassQL) {
  console.log("  → Enviando query a Overpass...");
  const body = `data=${encodeURIComponent(overpassQL)}`;
  try {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "*/*",
        "User-Agent": "KOINOS-Polis/1.0",
      },
      body,
      signal: AbortSignal.timeout(90000),
    });
    console.log(`  → Respuesta: ${res.status} ${res.statusText}`);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Overpass error ${res.status}: ${text.slice(0, 300)}`);
    }
    const json = await res.json();
    console.log(`  → Elementos recibidos: ${json.elements?.length ?? 0}`);
    return json;
  } catch (err) {
    if (err.name === "TimeoutError") {
      throw new Error("Timeout (90s). Overpass puede estar saturado, reintenta en 1 min.");
    }
    throw err;
  }
}

// ── Helpers: convertir respuesta Overpass a GeoJSON ──

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
    // relaciones: convertir miembros a features individuales
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
  console.log(`  ✓ ${name}.json — ${geojson.features.length} features (${(JSON.stringify(geojson).length / 1024).toFixed(0)} KB)`);
}

// ── Queries ──

async function fetchBuildings() {
  console.log("\n1/6 Edificios...");
  const data = await query(`
    [out:json][timeout:60][bbox:${BBOX}];
    (
      way["building"];
      relation["building"];
    );
    out body geom;
  `);
  const gj = toGeoJSON(data);
  // Enriquecer propiedades útiles
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
    [out:json][timeout:45][bbox:${BBOX}];
    way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|pedestrian|living_street|unclassified|service|footway|path|cycleway)$"];
    out body geom;
  `);
  const gj = toGeoJSON(data);
  for (const f of gj.features) {
    const p = f.properties;
    f.properties = {
      name: p.name || null,
      highway: p.highway,
      lanes: p.lanes ? parseInt(p.lanes) : null,
      surface: p.surface || null,
      oneway: p.oneway || null,
      osm_id: f.id,
    };
  }
  save("roads", gj);
}

async function fetchParks() {
  console.log("\n3/6 Parques y zonas verdes...");
  const data = await query(`
    [out:json][timeout:30][bbox:${BBOX}];
    (
      way["leisure"="park"];
      way["leisure"="garden"];
      way["landuse"="grass"];
      way["landuse"="forest"];
      way["leisure"="playground"];
      relation["leisure"="park"];
    );
    out body geom;
  `);
  const gj = toGeoJSON(data);
  for (const f of gj.features) {
    const p = f.properties;
    f.properties = {
      name: p.name || null,
      type: p.leisure || p.landuse || "green",
      osm_id: f.id,
    };
  }
  save("parks", gj);
}

async function fetchCoastline() {
  console.log("\n4/6 Costa...");
  const data = await query(`
    [out:json][timeout:30][bbox:${BBOX}];
    (
      way["natural"="coastline"];
      way["natural"="beach"];
    );
    out body geom;
  `);
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
    [out:json][timeout:45][bbox:${BBOX}];
    (
      node["amenity"~"^(restaurant|cafe|bar|bank|pharmacy|hospital|school|university|library|theatre|cinema|place_of_worship|police|fire_station|post_office|marketplace)$"];
      node["tourism"~"^(hotel|hostel|museum|attraction|viewpoint|information)$"];
      node["shop"~"^(supermarket|mall|convenience|bakery|butcher|clothes|department_store)$"];
      node["leisure"~"^(sports_centre|stadium|swimming_pool|fitness_centre)$"];
    );
    out body;
  `);
  const gj = toGeoJSON(data);
  for (const f of gj.features) {
    const p = f.properties;
    const category = p.amenity || p.tourism || p.shop || p.leisure || "other";
    f.properties = {
      name: p.name || null,
      category,
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
    [out:json][timeout:30][bbox:${BBOX}];
    (
      way["natural"="water"];
      way["waterway"];
      node["amenity"="fountain"];
      way["amenity"="fountain"];
      way["leisure"="swimming_pool"]["access"!="private"];
    );
    out body geom;
  `);
  const gj = toGeoJSON(data);
  for (const f of gj.features) {
    const p = f.properties;
    f.properties = {
      name: p.name || null,
      type: p.natural || p.waterway || p.amenity || p.leisure || "water",
      osm_id: f.id,
    };
  }
  save("water", gj);
}

// ── Main ──

async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║  KOINOS POLIS — Descarga OSM Las Palmas ║");
  console.log("╚══════════════════════════════════════════╝");
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
    if (done < steps.length) await sleep(DELAY_MS);
  }

  console.log(`\n══════════════════════════════════════`);
  console.log(`  ${done}/${steps.length} capas descargadas.`);
  console.log(`  Archivos en: ${OUT_DIR}/`);
  console.log(`══════════════════════════════════════\n`);

  if (done === 0) {
    console.error("Ninguna capa se descargó. Comprueba tu conexión a internet.");
    process.exit(1);
  }
}

main();
