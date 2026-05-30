// ─── POLIS · Juego: cargador de edificios reales ─────────────────
// Carga los polígonos del catastro INSPIRE de las secciones censales
// que componen Vegueta y los proyecta a metros locales centrados en
// CENTRO_VEGUETA. El JSON de cada sección viene en formato:
//
//   [
//     [polygon_coords_lng_lat, height_m],
//     [polygon_coords_lng_lat, height_m],
//     ...
//   ]
//
// El resultado es un EdificioProyectado[] listo para R3F.

import {
  CENTRO_VEGUETA,
  centroide,
  lngLatAMetros,
} from "./geo";
import type { EdificioCatastro, EdificioProyectado } from "./tipos";

/** Secciones censales de Vegueta (distrito 01 LPGC). */
export const SECCIONES_VEGUETA = [
  "3501601001",
  "3501601003",
  "3501601004",
  "3501601005",
  "3501601019",
];

type RawJson = Array<[Array<[number, number]>, number]>;

/** Convierte un JSON crudo a EdificioCatastro[]. */
function rawAEdificios(seccionId: string, raw: RawJson): EdificioCatastro[] {
  return raw.map((entry, i) => {
    const [poligono, alturaM] = entry;
    return {
      id: `${seccionId}-${i.toString(36)}`,
      poligonoLngLat: poligono,
      alturaM: Math.max(2.5, alturaM || 6),
      centroideLngLat: centroide(poligono),
      seccionId,
    };
  });
}

/** Proyecta un EdificioCatastro a metros locales (X/Z). */
export function proyectar(
  edificio: EdificioCatastro,
  origen: { lat: number; lng: number } = CENTRO_VEGUETA,
): EdificioProyectado {
  const poligonoXZ = edificio.poligonoLngLat.map(([lng, lat]) =>
    lngLatAMetros(lng, lat, origen),
  );
  const [cLng, cLat] = edificio.centroideLngLat;
  const centroideXZ = lngLatAMetros(cLng, cLat, origen);
  return {
    ...edificio,
    poligonoXZ,
    centroideXZ,
  };
}

/** Carga las secciones de Vegueta desde /public/buildings/. Cliente. */
export async function cargarVegueta(): Promise<EdificioProyectado[]> {
  const cargas = await Promise.all(
    SECCIONES_VEGUETA.map(async (sec) => {
      try {
        const r = await fetch(`/buildings/${sec}.json`, { cache: "force-cache" });
        if (!r.ok) return [];
        const raw = (await r.json()) as RawJson;
        return rawAEdificios(sec, raw);
      } catch {
        return [];
      }
    }),
  );
  const edificios = cargas.flat();
  return edificios.map((e) => proyectar(e));
}

/** Subset de prueba: edificios cerca del centro de Vegueta. */
export function edificiosCerca(
  edificios: EdificioProyectado[],
  origen: { x: number; z: number },
  radioM: number,
): EdificioProyectado[] {
  return edificios.filter((e) => {
    const [cx, cz] = e.centroideXZ;
    const dx = cx - origen.x;
    const dz = cz - origen.z;
    return Math.sqrt(dx * dx + dz * dz) <= radioM;
  });
}
