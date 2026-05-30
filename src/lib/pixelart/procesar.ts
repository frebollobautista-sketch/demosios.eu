/**
 * Pipeline de pixelización — KOINOS / POLIS
 * -------------------------------------------------------------
 * Módulo agnóstico de React. Solo depende de APIs de navegador
 * (HTMLImageElement, HTMLCanvasElement, OffscreenCanvas-friendly).
 *
 * Extraído desde src/app/calibrador/page.tsx para poder reutilizarse
 * tanto en el calibrador (herramienta de trabajo) como en la ruta
 * /mapear (flujo mobile de usuario final).
 */

export type RGB = [number, number, number];

export type ParametrosFiltro = {
  /** Tamaño de píxel en el espacio de salida, 1–32. */
  pixelSize: number;
  /** Número de colores en la paleta final, 2–64. */
  colores: number;
  /** Contraste en porcentaje, 50–200 (100 = identidad). */
  contraste: number;
  /** Saturación en porcentaje, 0–200 (100 = identidad). */
  saturacion: number;
};

export type ResultadoFiltro = {
  paletaHex: string[];
  tilesUnicos: number;
  resolucion: { w: number; h: number };
  densidadBitsPx: number;
};

/** Tamaño máximo del lado mayor para el procesado. Equilibrio calidad/rendimiento. */
export const MAX_LADO = 512;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function rgbToHex([r, g, b]: RGB): string {
  const h = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/**
 * Ajuste de contraste y saturación en espacio RGB.
 * - Contraste: `(v - 128) * k + 128` con `k = contraste/100`.
 * - Saturación: mezcla con la luminancia BT.601.
 */
export function ajustarPixel(
  r: number,
  g: number,
  b: number,
  contrastePct: number,
  saturacionPct: number
): RGB {
  const k = contrastePct / 100;
  let nr = (r - 128) * k + 128;
  let ng = (g - 128) * k + 128;
  let nb = (b - 128) * k + 128;

  const s = saturacionPct / 100;
  const gris = 0.299 * nr + 0.587 * ng + 0.114 * nb;
  nr = gris + (nr - gris) * s;
  ng = gris + (ng - gris) * s;
  nb = gris + (nb - gris) * s;

  return [clamp(nr, 0, 255), clamp(ng, 0, 255), clamp(nb, 0, 255)];
}

/**
 * K-means determinista en espacio RGB.
 * La inicialización es muestreo uniforme por índice para que el resultado
 * sea estable entre re-renders con los mismos datos.
 */
export function kmeans(
  pixels: RGB[],
  k: number,
  iters = 8
): { centros: RGB[]; asign: number[] } {
  const n = pixels.length;
  if (n === 0 || k <= 0) return { centros: [], asign: [] };
  const kReal = Math.min(k, n);

  const centros: RGB[] = [];
  for (let i = 0; i < kReal; i++) {
    const idx = Math.floor((i + 0.5) * (n / kReal));
    centros.push([...pixels[idx]] as RGB);
  }

  const asign = new Array<number>(n).fill(0);

  for (let it = 0; it < iters; it++) {
    for (let i = 0; i < n; i++) {
      let mejor = 0;
      let mejorD = Infinity;
      const [pr, pg, pb] = pixels[i];
      for (let j = 0; j < kReal; j++) {
        const [cr, cg, cb] = centros[j];
        const dr = pr - cr;
        const dg = pg - cg;
        const db = pb - cb;
        const d = dr * dr + dg * dg + db * db;
        if (d < mejorD) {
          mejorD = d;
          mejor = j;
        }
      }
      asign[i] = mejor;
    }

    const sumas: number[][] = Array.from({ length: kReal }, () => [0, 0, 0, 0]);
    for (let i = 0; i < n; i++) {
      const j = asign[i];
      sumas[j][0] += pixels[i][0];
      sumas[j][1] += pixels[i][1];
      sumas[j][2] += pixels[i][2];
      sumas[j][3] += 1;
    }
    for (let j = 0; j < kReal; j++) {
      const cnt = sumas[j][3];
      if (cnt > 0) {
        centros[j] = [sumas[j][0] / cnt, sumas[j][1] / cnt, sumas[j][2] / cnt];
      }
    }
  }

  return { centros, asign };
}

/**
 * Procesa una imagen aplicando el filtro pixel art sobre un canvas de salida.
 * Dibuja directamente en `canvasOut` (tamaño = celdasX*pixelSize × celdasY*pixelSize).
 */
export function procesarImagen(
  img: HTMLImageElement,
  canvasOut: HTMLCanvasElement,
  params: ParametrosFiltro
): ResultadoFiltro | null {
  const { pixelSize, colores, contraste, saturacion } = params;

  const aspect = img.naturalWidth / img.naturalHeight;
  let destW: number;
  let destH: number;
  if (aspect >= 1) {
    destW = Math.min(MAX_LADO, img.naturalWidth);
    destH = Math.round(destW / aspect);
  } else {
    destH = Math.min(MAX_LADO, img.naturalHeight);
    destW = Math.round(destH * aspect);
  }

  const celdasX = Math.max(1, Math.floor(destW / pixelSize));
  const celdasY = Math.max(1, Math.floor(destH / pixelSize));

  const tmp = document.createElement("canvas");
  tmp.width = celdasX;
  tmp.height = celdasY;
  const tctx = tmp.getContext("2d");
  if (!tctx) return null;
  tctx.imageSmoothingEnabled = true;
  tctx.drawImage(img, 0, 0, celdasX, celdasY);

  const data = tctx.getImageData(0, 0, celdasX, celdasY).data;
  const pixels: RGB[] = [];
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = ajustarPixel(data[i], data[i + 1], data[i + 2], contraste, saturacion);
    pixels.push([r, g, b]);
  }

  const { centros, asign } = kmeans(pixels, colores);
  if (centros.length === 0) return null;

  canvasOut.width = celdasX * pixelSize;
  canvasOut.height = celdasY * pixelSize;
  const octx = canvasOut.getContext("2d");
  if (!octx) return null;
  octx.imageSmoothingEnabled = false;

  for (let y = 0; y < celdasY; y++) {
    for (let x = 0; x < celdasX; x++) {
      const idx = y * celdasX + x;
      const [r, g, b] = centros[asign[idx]];
      octx.fillStyle = `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
      octx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
    }
  }

  const paletaHex = centros.map((c) => rgbToHex(c));
  const tilesUnicos = new Set(asign).size;
  const densidadBitsPx = Math.log2(Math.max(2, colores));

  return {
    paletaHex,
    tilesUnicos,
    resolucion: { w: celdasX, h: celdasY },
    densidadBitsPx,
  };
}

/**
 * Pinta la imagen original (sin filtro) a tamaño MAX_LADO, conservando aspecto.
 * Útil para el canvas de "preview original" del calibrador y del flujo mapear.
 */
export function pintarOriginal(
  img: HTMLImageElement,
  canvasOut: HTMLCanvasElement
): void {
  const aspect = img.naturalWidth / img.naturalHeight;
  let w: number;
  let h: number;
  if (aspect >= 1) {
    w = Math.min(MAX_LADO, img.naturalWidth);
    h = Math.round(w / aspect);
  } else {
    h = Math.min(MAX_LADO, img.naturalHeight);
    w = Math.round(h * aspect);
  }
  canvasOut.width = w;
  canvasOut.height = h;
  const ctx = canvasOut.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, 0, 0, w, h);
  }
}

/** Carga una imagen desde un File y devuelve una promesa con el HTMLImageElement listo. */
export function cargarImagenDesdeFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}
