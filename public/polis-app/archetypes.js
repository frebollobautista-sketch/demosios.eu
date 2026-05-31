// KOINOS · POLIS — consume public/catalog/archetypes.json y resuelve la
// regla de classification_rules para cada edificio. Devuelve una función
// drawArchetype(ctx, name, feature, projector) que pinta el edificio en
// modo iso usando los colores del catálogo.
//
// La idea: en LOD manzana cada edificio se renderiza como una pieza iso
// con su archetipo asignado (colores propios), sin variar la huella.

import { project } from "./iso.js";

let CATALOG = null;

export async function loadCatalog(url = "../catalog/archetypes.json") {
  const r = await fetch(url);
  if (!r.ok) throw new Error("archetypes.json no accesible");
  CATALOG = await r.json();
  return CATALOG;
}

export function classify(props, areaM2) {
  if (!CATALOG) return "residencial_3p";
  const cat = props.category;
  const h = props.height_m || 0;
  // Reglas oficiales del catálogo:
  for (const r of CATALOG.classification_rules.order) {
    if (r.if_category && cat === r.if_category) return r.then;
    if (r.if_height_gt !== undefined) {
      if (h > r.if_height_gt) {
        if (r.and_area_gt !== undefined && areaM2 <= r.and_area_gt) continue;
        return r.then;
      }
    }
    if (r.if_height_lte !== undefined) {
      if (h <= r.if_height_lte) {
        if (r.and_area_lt !== undefined && areaM2 >= r.and_area_lt) continue;
        if (r.and_area_gte !== undefined && areaM2 < r.and_area_gte) continue;
        if (r.and_category !== undefined && cat !== r.and_category) continue;
        return r.then;
      }
    }
    if (r.default) return r.default;
  }
  return "residencial_3p";
}

export function archetypeColors(name) {
  if (!CATALOG) return null;
  const a = CATALOG.archetypes[name];
  return a ? a.colors : null;
}

// Dibuja un edificio como pieza iso usando colores del archetipo.
// ringWorld: lista de [x, z] en metros locales. h: altura en metros.
// view: estado pan/zoom para el proyector.
// archetypeName: clave en archetypes.json.
// outline: color de contorno (string css). stroke: ancho.
export function drawArchetype(ctx, ringWorld, h, archetypeName, view, opts = {}) {
  const stroke = opts.stroke ?? 2.5;
  const outline = opts.outline ?? "#1A1612";
  const colors = archetypeColors(archetypeName) || {
    wall: "#C8B898", roof: "#B09E7C", trim: "#5C4022"
  };
  const sideColor = "#1A1612";
  const roofColor = colors.roof || colors.wall || "#C8B898";

  const n = ringWorld.length;
  if (n < 3) return;

  // Cierra si viene abierto
  let pts = ringWorld;
  if (pts[0][0] !== pts[n - 1][0] || pts[0][1] !== pts[n - 1][1]) {
    pts = pts.concat([pts[0]]);
  }
  const m = pts.length - 1;

  // Vértices abajo y arriba en pantalla
  const bot = new Array(m);
  const top = new Array(m);
  for (let i = 0; i < m; i++) {
    bot[i] = project(pts[i][0], 0, pts[i][1], view);
    top[i] = project(pts[i][0], h, pts[i][1], view);
  }

  // Caras laterales: solo las "visibles" (normal hacia SE en el pack:
  // en bloque_clustering la regla era nx_+nz_ > 0). Aquí replicamos.
  ctx.lineWidth = stroke;
  ctx.strokeStyle = outline;
  ctx.fillStyle = sideColor;
  for (let k = 0; k < m; k++) {
    const [ax, az] = pts[k];
    const [bx, bz] = pts[(k + 1) % m];
    const nx = bz - az;
    const nz = -(bx - ax);
    if (nx + nz <= 0) continue;
    ctx.beginPath();
    ctx.moveTo(bot[k][0], bot[k][1]);
    ctx.lineTo(bot[(k + 1) % m][0], bot[(k + 1) % m][1]);
    ctx.lineTo(top[(k + 1) % m][0], top[(k + 1) % m][1]);
    ctx.lineTo(top[k][0], top[k][1]);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Techo
  ctx.fillStyle = roofColor;
  ctx.beginPath();
  ctx.moveTo(top[0][0], top[0][1]);
  for (let i = 1; i < m; i++) ctx.lineTo(top[i][0], top[i][1]);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

// Versión rápida sin caras (para LOD muy alejado): solo huella.
export function drawFootprint(ctx, ringWorld, view, fill, stroke, strokeW = 2) {
  const n = ringWorld.length;
  if (n < 3) return;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const [px, py] = project(ringWorld[i][0], 0, ringWorld[i][1], view);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) {
    ctx.lineWidth = strokeW;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}
