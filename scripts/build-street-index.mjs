#!/usr/bin/env node
// Índice ligero de calles desde osm-gc/roads.json (37MB) → un JSON pequeño
// { name, lat, lon, bbox:[w,s,e,n] } por nombre de calle (deduplicado).
// El buscador del visor carga ESTE índice, no los 37MB.
import fs from "node:fs";
const SRC = "/Users/panch/KOINOS/public/osm-gc/roads.json";
const OUT = "/Users/panch/KOINOS/public/data/street-index.json";

const raw = JSON.parse(fs.readFileSync(SRC, "utf8"));
const byName = new Map();   // name -> {sx,sy,n, w,s,e,nn}

// Filtro de nombres-basura de OSM: descarta "-", "?", solo-puntuación o
// sin ninguna letra, y los muy cortos. Evita entradas inútiles.
const TIENE_LETRA = /[a-zñáéíóúü]/i;
function nombreValido(n) {
  if (typeof n !== "string") return false;
  const t = n.trim();
  return t.length >= 3 && TIENE_LETRA.test(t);
}

for (const f of raw.features || []) {
  const name = f.properties && f.properties.name;
  if (!nombreValido(name)) continue;
  const coords = (f.geometry && f.geometry.coordinates) || [];
  let agg = byName.get(name);
  if (!agg) { agg = { sx:0, sy:0, n:0, w:Infinity, s:Infinity, e:-Infinity, nn:-Infinity }; byName.set(name, agg); }
  for (const c of coords) {
    const lon = c[0], lat = c[1];
    if (typeof lon !== "number" || typeof lat !== "number") continue;
    agg.sx += lon; agg.sy += lat; agg.n++;
    if (lon < agg.w) agg.w = lon;
    if (lon > agg.e) agg.e = lon;
    if (lat < agg.s) agg.s = lat;
    if (lat > agg.nn) agg.nn = lat;
  }
}

const out = [];
for (const [name, a] of byName) {
  if (a.n === 0) continue;
  out.push({
    name,
    lat: +(a.sy / a.n).toFixed(6),
    lon: +(a.sx / a.n).toFixed(6),
    bbox: [+a.w.toFixed(6), +a.s.toFixed(6), +a.e.toFixed(6), +a.nn.toFixed(6)]
  });
}
out.sort((x, y) => x.name.localeCompare(y.name, "es"));
fs.mkdirSync("/Users/panch/KOINOS/public/data", { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
console.log("calles únicas:", out.length, "| bytes:", fs.statSync(OUT).size);
