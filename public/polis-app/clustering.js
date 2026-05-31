// KOINOS · POLIS — utilidades JS minimal de simplificación.
//
// Versión de bolsillo de packages/iso/bloque_clustering.py. No reimplementa
// shapely: para v0 nos basta con un Douglas-Peucker para el contorno y un
// "outer ring" del polígono (ignorando huecos) para el LOD sección.

// Distancia perpendicular punto-segmento.
function perpDist([px, pz], [ax, az], [bx, bz]) {
  const dx = bx - ax;
  const dz = bz - az;
  const denom = dx * dx + dz * dz;
  if (denom === 0) return Math.hypot(px - ax, pz - az);
  const t = ((px - ax) * dx + (pz - az) * dz) / denom;
  const cx = ax + t * dx;
  const cz = az + t * dz;
  return Math.hypot(px - cx, pz - cz);
}

// Douglas-Peucker iterativo. tol en metros.
export function simplifyRing(ring, tol = 1.5) {
  if (ring.length < 4) return ring.slice();
  // Si es cerrado (último == primero), simplificamos sobre el abierto.
  let pts = ring;
  let closed = false;
  const a = ring[0], b = ring[ring.length - 1];
  if (a[0] === b[0] && a[1] === b[1]) {
    pts = ring.slice(0, -1);
    closed = true;
  }
  const keep = new Array(pts.length).fill(false);
  keep[0] = true;
  keep[pts.length - 1] = true;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [i0, i1] = stack.pop();
    let maxD = 0, idx = -1;
    for (let k = i0 + 1; k < i1; k++) {
      const d = perpDist(pts[k], pts[i0], pts[i1]);
      if (d > maxD) { maxD = d; idx = k; }
    }
    if (maxD > tol && idx !== -1) {
      keep[idx] = true;
      stack.push([i0, idx], [idx, i1]);
    }
  }
  const out = [];
  for (let i = 0; i < pts.length; i++) if (keep[i]) out.push(pts[i]);
  if (closed) out.push(out[0]);
  return out;
}

// Devuelve solo el primer ring (exterior) de una geometría Polygon o
// MultiPolygon en formato GeoJSON. Para v0 ignoramos huecos.
export function outerRing(geometry) {
  if (!geometry) return null;
  if (geometry.type === "Polygon") {
    return geometry.coordinates[0];
  }
  if (geometry.type === "MultiPolygon") {
    // Quédate con el polígono de mayor bbox.
    let best = null, bestArea = -Infinity;
    for (const poly of geometry.coordinates) {
      const ring = poly[0];
      let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
      for (const [x, z] of ring) {
        if (x < minx) minx = x; if (x > maxx) maxx = x;
        if (z < miny) miny = z; if (z > maxy) maxy = z;
      }
      const a = (maxx - minx) * (maxy - miny);
      if (a > bestArea) { bestArea = a; best = ring; }
    }
    return best;
  }
  return null;
}

// Ordena features por painter's algorithm iso (suma min(x+z) del ring).
export function sortByDepth(features) {
  return features.slice().sort((a, b) => a._depth - b._depth);
}

// Calcula y cachea profundidad (min x+z del ring exterior simplificado).
export function annotateDepth(feat) {
  if (feat._depth !== undefined) return feat;
  const ring = feat._ringSimple || feat._ring;
  let sumx = 0, sumz = 0;
  for (const [x, z] of ring) { sumx += x; sumz += z; }
  feat._depth = (sumx + sumz) / ring.length;
  return feat;
}
