// ─── POLIS · Juego: helpers geográficos ──────────────────────────
// Proyección plana centrada en un punto del barrio. Para distancias
// pequeñas (< 2 km) basta una equirectangular: la deformación es
// imperceptible y evitamos meter dependencias de turf/proj4.
//
// Convención del motor R3F:
//   · Eje X = Este (positivo hacia E)
//   · Eje Z = Sur  (positivo hacia S; Norte es -Z)
//   · Eje Y = altura (positivo hacia arriba)
//
// Los polígonos del catastro vienen en [lng, lat]. Los proyectamos a
// [X, Z] en metros respecto al centro del barrio.

const RADIO_TIERRA_M = 6_378_137;

/** Centro del casco histórico de Vegueta — origen de coordenadas locales. */
export const CENTRO_VEGUETA: { lat: number; lng: number } = {
  lat: 28.0985,
  lng: -15.4147,
};

/** Convierte un par lng/lat al sistema X/Z en metros, centrado en `origen`. */
export function lngLatAMetros(
  lng: number,
  lat: number,
  origen: { lat: number; lng: number },
): [number, number] {
  const radLat = (origen.lat * Math.PI) / 180;
  const dLng = ((lng - origen.lng) * Math.PI) / 180;
  const dLat = ((lat - origen.lat) * Math.PI) / 180;
  const x = dLng * Math.cos(radLat) * RADIO_TIERRA_M; // E+
  const z = -dLat * RADIO_TIERRA_M;                    // N- (norte = -Z)
  return [x, z];
}

/** Distancia geodésica aprox. en metros (Haversine simplificado). */
export function distanciaMetros(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * RADIO_TIERRA_M * Math.asin(Math.sqrt(h));
}

/** Centroide medio (no exacto, pero suficiente para el dot del marker). */
export function centroide(coords: Array<[number, number]>): [number, number] {
  let sx = 0;
  let sy = 0;
  for (const [a, b] of coords) {
    sx += a;
    sy += b;
  }
  return [sx / coords.length, sy / coords.length];
}

/** Bounding box de un set de polígonos lng/lat. */
export function bbox(
  poligonos: Array<Array<[number, number]>>,
): { minLng: number; minLat: number; maxLng: number; maxLat: number } {
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  for (const p of poligonos) {
    for (const [lng, lat] of p) {
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
    }
  }
  return { minLng, minLat, maxLng, maxLat };
}
