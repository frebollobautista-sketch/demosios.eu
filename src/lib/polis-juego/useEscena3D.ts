"use client";

// ─── Hook: carga la escena 3D de Vegueta + Triana ───────────────
// Hace fetch del JSON ampliado y prepara las geometrías que R3F
// necesita: extrudes de edificios, líneas de calles, formas de
// parques, posiciones de POIs.

import { useEffect, useState } from "react";
import * as THREE from "three";

export type EdifMesh = {
  id: string;
  xz: Array<[number, number]>;
  hReal: number;     // altura del catastro en metros (para la ficha)
  hVisual: number;   // altura comprimida para juego
  cxz: [number, number];
  geometry: THREE.BufferGeometry;
};

export type RoadLine = {
  n: string | null;
  k: string | null;
  points: THREE.Vector3[];
};

export type ParkShape = {
  n: string | null;
  k: string | null;
  geometry: THREE.BufferGeometry;
  cxz: [number, number];
};

export type Poi = {
  n: string | null;
  k: string | null;
  xz: [number, number];
};

export type WaterFeat = {
  n: string | null;
  k: string | null;
  t: "P" | "A";
  xz: number[] | Array<[number, number]>;
  cxz?: [number, number];
};

export type Escena3D = {
  id: string;
  nombre: string;
  edificios: EdifMesh[];
  roads: RoadLine[];
  parks: ParkShape[];
  pois: Poi[];
  water: WaterFeat[];
  spawn: [number, number];
};

/** Compresión de altura para jugabilidad. */
export function alturaVisual(hReal: number): number {
  return Math.min(7, 3 + Math.sqrt(Math.max(0, hReal - 2)) * 1.2);
}

function poligonoAExtrude(xz: Array<[number, number]>, h: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  xz.forEach(([x, z], i) => {
    if (i === 0) shape.moveTo(x, z);
    else shape.lineTo(x, z);
  });
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: h,
    bevelEnabled: false,
  });
  // ExtrudeGeometry trabaja en plano XY. Rotamos a XZ para que la
  // altura quede en Y (Y up en three).
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

function poligonoAPlano(xz: Array<[number, number]>): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  xz.forEach(([x, z], i) => {
    if (i === 0) shape.moveTo(x, z);
    else shape.lineTo(x, z);
  });
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

function spawnCalculado(
  roads: RoadLine[],
  edificios: EdifMesh[],
): [number, number] {
  // Punto de calle más cercano al origen que no caiga dentro de un edificio.
  if (roads.length > 0) {
    let mejor: [number, number] | null = null;
    let dMin = Infinity;
    for (const r of roads) {
      for (const p of r.points) {
        const d = Math.hypot(p.x, p.z);
        if (d < dMin && !puntoEnAlgunEdif(p.x, p.z, edificios)) {
          dMin = d;
          mejor = [p.x, p.z];
        }
      }
    }
    if (mejor && dMin < 60) return mejor;
  }
  // Espiral
  for (let r = 1; r < 80; r += 1.5) {
    for (let a = 0; a < 24; a++) {
      const ang = (a / 24) * Math.PI * 2;
      const x = Math.cos(ang) * r;
      const z = Math.sin(ang) * r;
      if (!puntoEnAlgunEdif(x, z, edificios)) return [x, z];
    }
  }
  return [0, 0];
}

function puntoEnAlgunEdif(x: number, z: number, edificios: EdifMesh[]): boolean {
  for (const e of edificios) {
    const dx = e.cxz[0] - x;
    const dz = e.cxz[1] - z;
    if (Math.hypot(dx, dz) > 30) continue;
    if (puntoEnPoligono(x, z, e.xz)) return true;
  }
  return false;
}

export function puntoEnPoligono(x: number, z: number, poly: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], zi = poly[i][1];
    const xj = poly[j][0], zj = poly[j][1];
    const intersect =
      ((zi > z) !== (zj > z)) &&
      (x < (xj - xi) * (z - zi) / (zj - zi + 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function distEdifMin(
  x: number,
  z: number,
  poly: Array<[number, number]>,
): number {
  if (puntoEnPoligono(x, z, poly)) return 0;
  let mn = Infinity;
  for (let i = 0; i < poly.length - 1; i++) {
    const [ax, az] = poly[i];
    const [bx, bz] = poly[i + 1];
    const A = x - ax, B = z - az, C = bx - ax, D = bz - az;
    const dot = A * C + B * D;
    const len = C * C + D * D;
    let t = len ? dot / len : 0;
    t = Math.max(0, Math.min(1, t));
    const px = ax + t * C;
    const pz = az + t * D;
    const d = Math.hypot(x - px, z - pz);
    if (d < mn) mn = d;
  }
  return mn;
}

type RawJson = {
  v: number;
  escena: {
    id: string;
    nombre: string;
    edif: Array<{ id: string; xz: Array<[number, number]>; h: number; cxz: [number, number] }>;
    roads: Array<{ n: string | null; k: string | null; xz: Array<[number, number]> }>;
    parks: Array<{
      n: string | null;
      k: string | null;
      xz: Array<[number, number]>;
      cxz: [number, number];
    }>;
    pois: Array<{ n: string | null; k: string | null; xz: [number, number] }>;
    water: Array<WaterFeat>;
  };
};

export function useEscena3D(url: string = "/polis-juego/vegueta-triana-full.json") {
  const [escena, setEscena] = useState<Escena3D | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    fetch(url, { cache: "force-cache" })
      .then((r) => {
        if (!r.ok) throw new Error("Fetch falló: " + r.status);
        return r.json() as Promise<RawJson>;
      })
      .then((json) => {
        if (cancelado) return;
        const e = json.escena;

        const edificios: EdifMesh[] = e.edif.map((d) => {
          const hVisual = alturaVisual(d.h);
          return {
            id: d.id,
            xz: d.xz,
            hReal: d.h,
            hVisual,
            cxz: d.cxz,
            geometry: poligonoAExtrude(d.xz, hVisual),
          };
        });

        const roads: RoadLine[] = e.roads.map((r) => ({
          n: r.n,
          k: r.k,
          points: r.xz.map(([x, z]) => new THREE.Vector3(x, 0.05, z)),
        }));

        const parks: ParkShape[] = e.parks.map((p) => ({
          n: p.n,
          k: p.k,
          geometry: poligonoAPlano(p.xz),
          cxz: p.cxz,
        }));

        const pois: Poi[] = e.pois.map((p) => ({ n: p.n, k: p.k, xz: p.xz }));
        const water: WaterFeat[] = e.water || [];
        const spawn = spawnCalculado(roads, edificios);

        setEscena({
          id: e.id,
          nombre: e.nombre,
          edificios,
          roads,
          parks,
          pois,
          water,
          spawn,
        });
      })
      .catch((err) => {
        if (!cancelado) setError(String(err.message || err));
      });
    return () => {
      cancelado = true;
    };
  }, [url]);

  return { escena, error };
}
