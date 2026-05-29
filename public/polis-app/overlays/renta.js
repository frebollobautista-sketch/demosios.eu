// Overlay "Renta media por sección" — coropleta cuantil sobre las
// secciones censales visibles. Portado del visor canónico MapLibre
// (polis-provincia.html · toggleRenta) al runtime iso vanilla 2D.
//
// API mínima (la misma que seguirán el resto de overlays):
//   rentaOverlay.id        → identificador de capa
//   rentaOverlay.name      → etiqueta human-readable (para el botón)
//   rentaOverlay.load()    → fetch + cache del JSON. Idempotente.
//   rentaOverlay.draw(ctx, state, view) → pinta la coropleta sobre
//       las secciones del nivel actual. El renderer decide cuándo
//       llamarlo en función de state.activeOverlays.renta.
//   rentaOverlay.isReady() → true si load() resolvió.
//
// Color scale: tres breakpoints (p20, p50, p80) sobre el set global
// de rentas, interpolados rojo → amarillo → verde — copiado tal cual
// del canónico (`#c45a4a`, `#d4c44a`, `#4aaa5a`). Opacidad 0.55 para
// que el ink y el relieve iso sigan siendo legibles por debajo.

import { project } from "../iso.js";

const DATA_URL = "../data/renta-seccion.json";

// Colores del canónico (visor MapLibre). NO modificar sin
// actualizar también polis-provincia.html para mantener coherencia
// entre los dos visores.
const C_LOW  = [196,  90,  74]; // #c45a4a
const C_MID  = [212, 196,  74]; // #d4c44a
const C_HIGH = [ 74, 170,  90]; // #4aaa5a

const FILL_ALPHA = 0.55;

let _data = null;          // { cusec: { renta, hogar } }
let _breaks = null;        // { p20, p50, p80 }
let _loadingPromise = null;

function _computeBreaks(data) {
  const rentas = Object.values(data)
    .map(r => r && r.renta)
    .filter(n => typeof n === "number" && isFinite(n))
    .sort((a, b) => a - b);
  if (!rentas.length) return { p20: 7000, p50: 10000, p80: 14000 };
  return {
    p20: rentas[Math.floor(rentas.length * 0.2)] || 7000,
    p50: rentas[Math.floor(rentas.length * 0.5)] || 10000,
    p80: rentas[Math.floor(rentas.length * 0.8)] || 14000
  };
}

function _lerp(a, b, t) { return a + (b - a) * t; }

function _colorFor(renta, breaks) {
  // Mismo comportamiento que `interpolate linear` de MapLibre: por
  // debajo del primer stop el color es C_LOW; por encima del último,
  // C_HIGH; entre stops, interpolación lineal componente a componente.
  if (renta <= breaks.p20) return C_LOW;
  if (renta >= breaks.p80) return C_HIGH;
  if (renta <= breaks.p50) {
    const t = (renta - breaks.p20) / (breaks.p50 - breaks.p20);
    return [
      _lerp(C_LOW[0],  C_MID[0],  t),
      _lerp(C_LOW[1],  C_MID[1],  t),
      _lerp(C_LOW[2],  C_MID[2],  t)
    ];
  }
  const t = (renta - breaks.p50) / (breaks.p80 - breaks.p50);
  return [
    _lerp(C_MID[0],  C_HIGH[0], t),
    _lerp(C_MID[1],  C_HIGH[1], t),
    _lerp(C_MID[2],  C_HIGH[2], t)
  ];
}

function _rgba([r, g, b], a) {
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
}

// Pinta el polígono "plano" de una sección con su color de renta.
// Toma el _ringSimple que ya proyectaron app.js/loadMunicipio /
// loadDistrito a metros locales — el overlay sólo decide color.
function _fillSection(ctx, ring, view, color) {
  if (!ring || ring.length < 3) return;
  ctx.beginPath();
  for (let i = 0; i < ring.length; i++) {
    const [px, py] = project(ring[i][0], 0, ring[i][1], view);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = _rgba(color, FILL_ALPHA);
  ctx.fill();
}

function _drawSecciones(ctx, secciones, view) {
  if (!secciones || !secciones.length) return;
  for (const s of secciones) {
    const cusec = s.properties && s.properties.cusec;
    if (!cusec) continue;
    const row = _data[cusec];
    if (!row || typeof row.renta !== "number") continue;
    const color = _colorFor(row.renta, _breaks);
    _fillSection(ctx, s._ringSimple, view, color);
  }
}

export const rentaOverlay = {
  id: "renta",
  name: "Renta media",

  load: async () => {
    if (_data) return _data;
    if (_loadingPromise) return _loadingPromise;
    _loadingPromise = fetch(DATA_URL)
      .then(r => {
        if (!r.ok) throw new Error("renta fetch " + r.status);
        return r.json();
      })
      .then(json => {
        _data = json;
        _breaks = _computeBreaks(json);
        return _data;
      })
      .catch(err => {
        console.warn("[rentaOverlay] no se pudo cargar:", err);
        _data = null;
        _breaks = null;
        _loadingPromise = null;
        return null;
      });
    return _loadingPromise;
  },

  isReady: () => _data !== null && _breaks !== null,

  // Render por nivel:
  //  - isla:      omitido (granularidad sección no aporta a 21 muns).
  //  - municipio: cada sección del mun se pinta con su color.
  //  - distrito:  todas las secciones del distrito se pintan.
  //  - barrio:    todas las secciones del barrio se pintan
  //               (v1.6.barrio: state.barrio.secciones tiene la misma
  //               estructura que state.district.secciones).
  //  - sección:   omitido (estamos dentro de una sola sección).
  draw: (ctx, state, view) => {
    if (!_data || !_breaks) return;
    if (!state || !view) return;
    const lvl = state.lodLevel;
    ctx.save();
    if (lvl === "municipio") {
      _drawSecciones(ctx, state.municipio?.secciones, view);
    } else if (lvl === "distrito") {
      _drawSecciones(ctx, state.district?.secciones, view);
    } else if (lvl === "barrio") {
      _drawSecciones(ctx, state.barrio?.secciones, view);
    }
    ctx.restore();
  },

  // Devuelve los breaks calculados (útil para una futura leyenda
  // tipo `showRentaLegend()` del canónico). No usado todavía por la UI.
  getBreaks: () => _breaks
};
