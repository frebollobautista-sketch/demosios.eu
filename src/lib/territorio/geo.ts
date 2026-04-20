// ─── Utilidades de geometría ─────────────────────────────────────
// Conversor minimal de GeoJSON a `<path d="…">` SVG, con proyección
// equirectangular centrada en el bbox del conjunto. Pensado para
// barrios pequeños (un municipio entero cabe en un viewBox 500×560),
// donde la distorsión Mercator vs equirectangular es despreciable.
//
// Flujo de uso esperado:
//   1. Reunir todos los polígonos de los barrios de un municipio
//      en un FeatureCollection GeoJSON (WGS84 / EPSG:4326).
//   2. Llamar a `ajustarProyeccion(features, viewBox)` para obtener
//      la función `proyectar(lng, lat) → [x, y]` adecuada.
//   3. Por cada feature, construir el `d` con `featureToPath(feature, proyectar)`.
//   4. Guardar el resultado en `barrios-juego.ts` como
//      `geometria: { modo: "vector", d: "...", cx, cy }`.

export type LngLat = [number, number];

export type Polygon = {
  type: "Polygon";
  coordinates: LngLat[][]; // anillo exterior + huecos opcionales
};

export type MultiPolygon = {
  type: "MultiPolygon";
  coordinates: LngLat[][][];
};

export type GeoGeometry = Polygon | MultiPolygon;

export type GeoFeature = {
  type: "Feature";
  id?: string;
  properties?: Record<string, unknown>;
  geometry: GeoGeometry;
};

export type FeatureCollection = {
  type: "FeatureCollection";
  features: GeoFeature[];
};

export type Proyectar = (lng: number, lat: number) => [number, number];

/**
 * Construye una proyección equirectangular que encaja el bbox de
 * todas las features en el viewBox dado, respetando proporciones
 * (con barra negra lateral/vertical si hace falta) y con padding.
 */
export function ajustarProyeccion(
  features: GeoFeature[],
  viewBox: { w: number; h: number; padding?: number },
): { proyectar: Proyectar; bbox: [number, number, number, number] } {
  const padding = viewBox.padding ?? 10;
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;

  for (const f of features) {
    const rings =
      f.geometry.type === "Polygon"
        ? f.geometry.coordinates
        : f.geometry.coordinates.flat();
    for (const ring of rings) {
      for (const [lng, lat] of ring) {
        if (lng < minLng) minLng = lng;
        if (lat < minLat) minLat = lat;
        if (lng > maxLng) maxLng = lng;
        if (lat > maxLat) maxLat = lat;
      }
    }
  }

  const wLng = maxLng - minLng;
  const hLat = maxLat - minLat;
  const availableW = viewBox.w - 2 * padding;
  const availableH = viewBox.h - 2 * padding;
  // Escala uniforme que preserva proporciones (Canarias en latitud ~28°,
  // la deformación Mercator vs equirectangular es < 2 % en un municipio).
  const scale = Math.min(availableW / wLng, availableH / hLat);
  const centerX = viewBox.w / 2;
  const centerY = viewBox.h / 2;
  const midLng = (minLng + maxLng) / 2;
  const midLat = (minLat + maxLat) / 2;

  const proyectar: Proyectar = (lng, lat) => {
    const x = centerX + (lng - midLng) * scale;
    // y invertido: en SVG el origen está arriba, en geo la latitud crece al norte.
    const y = centerY - (lat - midLat) * scale;
    return [x, y];
  };

  return { proyectar, bbox: [minLng, minLat, maxLng, maxLat] };
}

/**
 * Convierte una Feature (Polygon o MultiPolygon) en un string `d` de
 * SVG `<path>`. Usa la función de proyección provista.
 */
export function featureToPath(
  feature: GeoFeature,
  proyectar: Proyectar,
): string {
  const rings: LngLat[][][] =
    feature.geometry.type === "Polygon"
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates;

  const partes: string[] = [];
  for (const polygon of rings) {
    for (const ring of polygon) {
      if (ring.length === 0) continue;
      const pts = ring.map(([lng, lat]) => proyectar(lng, lat));
      const [x0, y0] = pts[0];
      const resto = pts.slice(1).map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`);
      partes.push(`M${x0.toFixed(2)},${y0.toFixed(2)}L${resto.join("L")}Z`);
    }
  }
  return partes.join(" ");
}

/**
 * Centroide aproximado de una feature — media aritmética de los puntos
 * del anillo exterior del primer polígono. Suficiente para colocar
 * etiquetas sin pelear con algoritmos de centroide visual.
 */
export function centroideAprox(
  feature: GeoFeature,
  proyectar: Proyectar,
): [number, number] {
  const ring =
    feature.geometry.type === "Polygon"
      ? feature.geometry.coordinates[0]
      : feature.geometry.coordinates[0][0];
  let sx = 0,
    sy = 0;
  for (const [lng, lat] of ring) {
    const [x, y] = proyectar(lng, lat);
    sx += x;
    sy += y;
  }
  return [sx / ring.length, sy / ring.length];
}
