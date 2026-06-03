// KOINOS · POLIS — render loop principal con 3 niveles jerárquicos.
//
// render(ctx, state) consulta state.lodLevel y delega a:
//   - renderIsla(ctx, state)        21 muns como tiles iso simplificados
//   - renderMunicipio(ctx, state)   N secciones del mun como tiles iso
//   - renderSeccion(ctx, state)     manzanas + edificios (lo de v0.2)
//
// La intencion estilística (ver docs/STYLE_GUIDE.md):
//   isla:      trazo 4px, sombra 3px, fondo paper, etiquetas con halo
//   municipio: trazo 4px, sombra 4px, contorno mun 6px, sin etiqueta sec
//   seccion:   trazo 4px (manzanas) y 3px (edif), sombra 4px (reducida)

import { project } from "./iso.js";
import { drawArchetype, drawFootprint } from "./archetypes.js";
import { drawActiveOverlays } from "./overlays/index.js";
import { assetUrl } from "./assets-base.js";

// 2026-05-24 — Paleta ITB v2 paper restaurada (revert OCRE-SKIN dark).
// Sólo se conservan la top bar OCRE + siluetas-strip; el lienzo y los
// blobs vuelven a paper warm + bright ocres como en la versión anterior.
const PAPER = "#F5E8C8";
const PAPER_WARM = "#F0DDB4";
const OCRE = "#C89968";
const OCRE_LT = "#D9B58A";
const OCRE_DK = "#A37945";
const SAND = "#E2C99A";
const GRIS = "#4A4D52";
const STREET = "#6B6358";
const INK = "#1A1612";
const COSTA = "#3F5F7E";
const ACCENT_NARANJA = "#E68A4F";
const ACCENT_MORADO = "#9F4FE6";

// Anchos de calle en px.
const ROAD_WIDTHS = {
  primary: 5, secondary: 4, tertiary: 3,
  residential: 2, service: 1.5, footway: 1.2,
  pedestrian: 1.2, track: 1.2
};

const ROAD_PRIORITY = new Set(["primary", "secondary", "tertiary"]);

// LOD threshold dentro de la vista sección (manzana vs edificios).
export const LOD_THRESHOLD_FACTOR = 1.6;
export const LOD_BLEND_RANGE = 0.4;

export function computeLodBlend(view) {
  const ratio = view.scale / view.fitScale;
  const t = LOD_THRESHOLD_FACTOR;
  const r = LOD_BLEND_RANGE;
  if (ratio <= t - r) return { mode: "section", t: 0 };
  if (ratio >= t + r) return { mode: "manzana", t: 1 };
  const k = (ratio - (t - r)) / (2 * r);
  return { mode: "blend", t: k };
}

// v1.5.1 — LOD triple del nivel distrito.
// v1.5.2 — thresholds recalibrados tras subir el entryZoom a 1.45×.
// v1.6a — thresholds bajados (T1=0.5/T2=1.0) para mostrar edificios
//   individuales desde el entry. Causó masa-negra con los 7232 buildings
//   apretados en el distrito 01604.
// v1.6b — vuelta a thresholds altos pero con paso 1 REFORMULADO:
//   ahora paso 1 muestra cada sección como UN bloque iso extrudido por
//   densidad (no polígonos planos como antes). El entry queda en paso 1
//   con secciones distinguibles como "edificios-sección"; los pasos 2 y
//   3 quedan disponibles al zoom-in para ver manzanas y edificios.
//
// Paso 1 (entry, ratio 0.5–2.0): cada sección extrudida como bloque iso
//   con altura ∝ sqrt(building_count). Resultado: ~80 piezas grandes
//   distinguibles en lugar de masa de 7232 edificios.
// Paso 2 (mid zoom, ratio 2.0–3.5): cross-fade hacia manzanas-tile.
// Paso 3 (high zoom, ratio > 3.5): cross-fade hacia edificios individuales.
export const DISTRITO_T1 = 2.0;
export const DISTRITO_T2 = 3.5;
export const DISTRITO_BLEND = 0.35;

export function computeLodBlendDistrito(view) {
  // v1.6d — LOD multi-paso restaurado. Pancho prefiere la progresión
  // natural por zoom-in desde distrito: en entry (ratio 1.05) el
  // mosaico de secciones coloreadas con hover/selección; al hacer
  // zoom-in aparecen las manzanas (α2) y luego los edificios (α3).
  // El "equilibrio" que él busca: identidad de barrio en la entrada,
  // detalle disponible para quien lo necesita.
  //
  // [A] v1.6.lodA-ramp (2026-05-23) — añadidas dos sub-rampas para
  // suavizar el salto entre manzana-tile y archetype 3D:
  //   - `bldFootprintK` (0→1 en ratio 2.6–3.5): hace aparecer los
  //     footprints planos de los edificios ANTES de que los archetypes
  //     extruyan, mientras las manzanas-tile siguen visibles. Crea una
  //     fase intermedia "veo el contorno de los edificios sobre la
  //     manzana" antes del 3D.
  //   - `bldHeightK` (0→1 en ratio 3.6–4.8): rampa la altura de la
  //     extrusión desde 0 (plano) hasta full. Cuando α3 entra, los
  //     edificios crecen continuamente en lugar de aparecer ya con
  //     altura completa.
  // Resultado visual: footprint → low-3D → full-3D en lugar de
  // manzana-tile → BOOM archetype.
  const ratio = view.scale / view.fitScale;
  const r = DISTRITO_BLEND;
  let mix12;
  if (ratio <= DISTRITO_T1 - r) mix12 = 0;
  else if (ratio >= DISTRITO_T1 + r) mix12 = 1;
  else mix12 = (ratio - (DISTRITO_T1 - r)) / (2 * r);
  let mix23;
  if (ratio <= DISTRITO_T2 - r) mix23 = 0;
  else if (ratio >= DISTRITO_T2 + r) mix23 = 1;
  else mix23 = (ratio - (DISTRITO_T2 - r)) / (2 * r);
  // [A] sub-rampas para suavizar transición manzana → edificio.
  const bldFootprintK = ratio <= 2.6 ? 0
                      : ratio >= 3.5 ? 1
                      : (ratio - 2.6) / 0.9;
  const bldHeightK = ratio <= 3.6 ? 0
                   : ratio >= 4.8 ? 1
                   : (ratio - 3.6) / 1.2;
  return {
    alpha1: 1 - mix12,
    alpha2: mix12 * (1 - mix23),
    alpha3: mix23,
    bldFootprintK,
    bldHeightK,
    ratio
  };
}

// ==================================================================
// Render principal (despachador).

export function render(ctx, state) {
  const dpr = state.dpr;
  const w = ctx.canvas.width / dpr;
  const h = ctx.canvas.height / dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = PAPER_WARM;
  ctx.fillRect(0, 0, w, h);

  if (!state.view) return;

  // Slide horizontal entre distritos / secciones / municipios vecinos:
  // aplicamos un translate global al contenido (no al canvas, para no
  // afectar la UI). v1.5.2 — extendido a todos los niveles de tap-vecino.
  let slideDx = 0;
  const slideActive = state._slideAnim && (
    state.lodLevel === "distrito" || state.lodLevel === "seccion" ||
    state.lodLevel === "municipio");
  if (slideActive) {
    const a = state._slideAnim;
    const t = Math.min(1, (performance.now() - a.t0) / a.duration);
    const k = easeInOutCss(t);
    if (a.phase === "out") {
      slideDx = -a.dir * a.width * k;
    } else {
      slideDx = a.dir * a.width * (1 - k);
    }
    ctx.save();
    ctx.translate(slideDx, 0);
  }

  // v1.6.manzana — Diferimos el swap de render mientras la cámara viaja.
  // enterManzana fija state.renderLevel = nivel-padre para que el contexto
  // del barrio/sección no desaparezca de golpe antes de que el vuelo llegue;
  // el onDone de applyNewView lo limpia. Solo aplica con _anim activo.
  const lvl = (state.renderLevel && state._anim) ? state.renderLevel : state.lodLevel;

  if (lvl === "archipielago") {
    renderArchipielago(ctx, state);
  } else if (lvl === "isla") {
    renderIsla(ctx, state);
  } else if (lvl === "municipio") {
    renderMunicipio(ctx, state);
  } else if (lvl === "distrito") {
    renderDistrito(ctx, state);
  } else if (lvl === "vecindario") {
    renderVecindario(ctx, state);
  } else if (lvl === "barrio") {
    renderBarrio(ctx, state);
  } else if (lvl === "manzana") {
    renderManzana(ctx, state);
  } else {
    renderSeccion(ctx, state);
  }

  // Hook overlays cívicos: se pintan tras el render base del nivel pero
  // dentro del transform del slide animation, para que las capas
  // acompañen el desplazamiento horizontal entre vecinos.
  drawActiveOverlays(ctx, state, state.view);

  if (slideActive) {
    ctx.restore();
  }

  if (state._lodPillEl) {
    const label =
      state.lodLevel === "archipielago" ? "LOD: archipiélago" :
      state.lodLevel === "isla" ? "LOD: isla" :
      state.lodLevel === "municipio" ? "LOD: municipio" :
      state.lodLevel === "distrito" ? "LOD: distrito" :
      state.lodLevel === "barrio" ? "LOD: barrio" :
      state.lodLevel === "vecindario" ? "LOD: vecindario" :
      state.lodLevel === "manzana" ? "LOD: manzana" :
      "LOD: sección";
    if (state._lastLodLabel !== label) {
      state._lodPillEl.textContent = label;
      state._lastLodLabel = label;
      if (state._refreshLayerPanel) state._refreshLayerPanel();
      // Tablero cívico: recalcular métricas al cambiar nivel.
      if (state._refreshDashboard) state._refreshDashboard();
    }
  }

  renderHud(state);
}

// ==================================================================
// HUD reactivo — consume state.indicators (v1.5.3).
//
// El runtime web no genera estos números: vienen de la capa cívica
// (Next.js / Supabase) vía `window.polisApp.setIndicators(...)`. Hasta
// que llegue ese push los placeholders muestran "--". Se refresca en
// cada `render()` (es DOM, no canvas — sólo escribe si cambió el valor
// para no fragmentar el layout).
function renderHud(state) {
  const hud = document.getElementById("hud");
  if (!hud) return;
  const ind = state.indicators || {};
  const zone = ind.zone || {};
  const real = ind.realtime || {};

  const fmtPct = (v) =>
    (typeof v === "number" && v > 0)
      ? `${Math.round(v)}%`
      : "--";
  const fmtInt = (v) =>
    (typeof v === "number" && v > 0)
      ? v.toLocaleString("es")
      : "--";

  setHudRow(hud, "zone-recovered",
            fmtPct(zone.calibrated_pct || zone.discovered_pct),
            "recuperado");
  setHudRow(hud, "realtime-events",
            fmtInt(real.events_live),
            "eventos vivos");
  setHudRow(hud, "realtime-portals",
            fmtInt(real.registered_residents),
            "portales registrables");
}

function setHudRow(hud, key, valueStr, labelStr) {
  const row = hud.querySelector(`.hud-row[data-key="${key}"]`);
  if (!row) return;
  const strong = row.querySelector("strong");
  if (strong && strong.textContent !== valueStr) {
    strong.textContent = valueStr;
  }
  const lbl = row.querySelector(".hud-label");
  if (lbl && lbl.textContent !== labelStr) {
    lbl.textContent = labelStr;
  }
}

function easeInOutCss(t) { return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2; }

// ==================================================================
// Helpers genéricos.

function fillRing(ctx, ring, view, fillStyle, strokeStyle, lineW) {
  if (ring.length < 3) return;
  ctx.beginPath();
  for (let i = 0; i < ring.length; i++) {
    const [px, py] = project(ring[i][0], 0, ring[i][1], view);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  if (fillStyle) { ctx.fillStyle = fillStyle; ctx.fill(); }
  if (strokeStyle) {
    ctx.lineWidth = lineW;
    ctx.strokeStyle = strokeStyle;
    ctx.stroke();
  }
}

function drawIsoTile(ctx, ring, h, topColor, view, opts = {}) {
  const stroke = opts.stroke ?? 4;
  const liftPx = opts.liftPx ?? 0;
  const sideColor = opts.sideColor ?? INK;

  let pts = ring;
  if (pts.length >= 2) {
    const a = pts[0], b = pts[pts.length - 1];
    if (a[0] === b[0] && a[1] === b[1]) pts = pts.slice(0, -1);
  }
  const m = pts.length;
  if (m < 3) return;

  // Modo plano: cuando ax≈0 y ay≈0 (isla, municipio), no dibujamos las
  // caras laterales — se proyectarían como polígonos degenerados (top==bot)
  // que solo crean ruido visual con el stroke. El techo plano basta.
  const isFlat = view && Math.abs(view.ax ?? 30) < 0.5 &&
                 Math.abs(view.ay ?? 30) < 0.5;

  const bot = new Array(m), top = new Array(m);
  for (let i = 0; i < m; i++) {
    const [bx, by] = project(pts[i][0], 0, pts[i][1], view);
    const [tx, ty] = project(pts[i][0], h, pts[i][1], view);
    bot[i] = [bx, by - liftPx];
    top[i] = [tx, ty - liftPx];
  }

  ctx.lineWidth = stroke;
  ctx.strokeStyle = INK;
  ctx.fillStyle = sideColor;
  if (!isFlat) {
    for (let k = 0; k < m; k++) {
      const ax = pts[k][0], az = pts[k][1];
      const bx = pts[(k + 1) % m][0], bz = pts[(k + 1) % m][1];
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
  }

  ctx.fillStyle = topColor;
  ctx.beginPath();
  ctx.moveTo(top[0][0], top[0][1]);
  for (let i = 1; i < m; i++) ctx.lineTo(top[i][0], top[i][1]);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  if (opts.ringColor) {
    ctx.lineWidth = opts.ringW || 3;
    ctx.strokeStyle = opts.ringColor;
    ctx.beginPath();
    ctx.moveTo(top[0][0], top[0][1]);
    for (let i = 1; i < m; i++) ctx.lineTo(top[i][0], top[i][1]);
    ctx.closePath();
    ctx.stroke();
  }
}

function drawFlatShadow(ctx, ring, view, dxM = 4, dzM = 4, color = INK) {
  if (ring.length < 3) return;
  ctx.beginPath();
  for (let i = 0; i < ring.length; i++) {
    const [x, z] = ring[i];
    const [px, py] = project(x + dxM, 0, z + dzM, view);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawLabel(ctx, text, [px, py], opts = {}) {
  ctx.font = opts.font || "bold 13px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // halo
  ctx.lineWidth = opts.haloW || 4;
  ctx.strokeStyle = opts.haloColor || INK;
  ctx.strokeText(text, px, py);
  ctx.fillStyle = opts.color || "#FFFFFF";
  ctx.fillText(text, px, py);
}

// [I] ITB v2 — HUD card label. Pinta una tarjeta-recuadro estilo
// tablero táctico sobre el centroide. Fondo ink translúcido, borde
// paper, esquina superior izquierda chaflanada. Texto en dos líneas:
//  - nombre (Georgia italic, paper)
//  - sub-meta opcional (Plex Mono, accent-cyan o paper)
// Devuelve el rect total ocupado para el anti-overlap del caller.
function drawHudCard(ctx, [px, py], opts = {}) {
  const name = opts.name || "";
  const meta = opts.meta || "";
  const isHover = !!opts.hover;
  const nameFont = isHover
    ? 'italic 600 14px Georgia, "Times New Roman", serif'
    : 'italic 500 12px Georgia, "Times New Roman", serif';
  const metaFont = '500 10px "IBM Plex Mono", "SF Mono", Menlo, monospace';

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Medidas
  ctx.font = nameFont;
  const wName = ctx.measureText(name).width;
  let wMeta = 0;
  if (meta) {
    ctx.font = metaFont;
    wMeta = ctx.measureText(meta).width;
  }
  const w = Math.max(wName, wMeta);
  const padX = 7;
  const padY = meta ? 5 : 4;
  const lineH = 14;
  const totalH = (meta ? lineH * 2 + 2 : lineH);
  const boxW = w + padX * 2;
  const boxH = totalH + padY * 2;
  const x0 = px - boxW / 2;
  const y0 = py - boxH / 2;
  const chamfer = 6;

  // Path con chaflán superior-izquierda (acento triangular ITB).
  ctx.beginPath();
  ctx.moveTo(x0 + chamfer, y0);
  ctx.lineTo(x0 + boxW, y0);
  ctx.lineTo(x0 + boxW, y0 + boxH);
  ctx.lineTo(x0, y0 + boxH);
  ctx.lineTo(x0, y0 + chamfer);
  ctx.closePath();

  // Fondo ink translúcido
  ctx.fillStyle = isHover ? "rgba(26,22,18,0.94)" : "rgba(26,22,18,0.86)";
  ctx.fill();

  // Borde paper
  ctx.lineWidth = 1;
  ctx.strokeStyle = isHover ? "#F5E8C8" : "rgba(245,232,200,0.78)";
  ctx.stroke();

  // Acento cyan en la diagonal del chaflán cuando hover.
  if (isHover) {
    ctx.beginPath();
    ctx.moveTo(x0 + chamfer, y0);
    ctx.lineTo(x0, y0 + chamfer);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#2EE8E0";
    ctx.stroke();
  }

  // Texto: nombre (línea sup. si meta, centrado si no)
  ctx.fillStyle = PAPER;
  ctx.font = nameFont;
  if (meta) {
    ctx.fillText(name, px, y0 + padY + lineH / 2 - 1);
    ctx.fillStyle = isHover ? "#2EE8E0" : "rgba(245,232,200,0.85)";
    ctx.font = metaFont;
    ctx.fillText(meta, px, y0 + padY + lineH + 2 + lineH / 2 - 2);
  } else {
    ctx.fillText(name, px, py);
  }

  ctx.restore();

  return {
    x0,
    x1: x0 + boxW,
    y0,
    y1: y0 + boxH,
    w: boxW,
    h: boxH
  };
}

// ==================================================================
// NIVEL ISLA.
// v1.5: plano top-down puro (ax=0, ay=0, sz_factor=0). Corrige el bug de
// v1.4 donde ax=0/ay=90 colapsaba la coordenada vertical y estiraba GC en
// el eje este-oeste. La silueta se reconoce ahora "como en Google Maps".
// Polígonos planos rellenos por color de densidad. Trazo ink 4 px. Sin
// extrusión, sin sombra. Costa azul si está cargada (lazy).

// 2026-05-19 — NIVEL ARCHIPIÉLAGO (raíz).
// Pinta las 7 islas como polígonos planos coloreados por densidad de
// secciones (terciles: SAND / OCRE_LT / OCRE). Modo flat top-down: el
// preset "archipielago" tiene ax=0,ay=0,sz_factor=0 igual que "isla". El
// label "Canarias" flota en pantalla fija, estilo membrete grande
// (mimetizando el patrón de renderIsla con "Gran Canaria").
function renderArchipielago(ctx, state) {
  const arch = state.archipielago;
  if (!arch) return;
  const { islands, t1, t2 } = arch;

  // Polígonos de isla — planos, color por densidad de sections_count.
  // 2026-05-21 — contraste subido (OCRE_LT/OCRE/OCRE_DK) para que las
  // islas pequeñas (EH, LG) no se confundan con el fondo PAPER_WARM.
  for (const f of islands) {
    const sc = f.properties.sections_count || 0;
    const color = sc <= t1 ? OCRE_LT : sc <= t2 ? OCRE : OCRE_DK;
    // MultiPolygon: pintamos todos los rings (algunos islotes pequeños).
    for (const r of (f._rings || [f._ringSimple])) {
      fillRing(ctx, r, state.view, color, INK, 4);
    }
  }

  // Etiquetas de isla (sobre la hovered o todas con halo discreto).
  const hoveredIsla = state.hoverFeature?.properties?.isla;
  for (const f of islands) {
    const p = f.properties;
    const c = f._centroid;
    const [px, py] = project(c[0], 0, c[1], state.view);
    const isHover = hoveredIsla === p.isla;
    ctx.save();
    drawLabel(ctx, p.name, [px, py], {
      font: isHover ? "bold 14px Georgia, serif" : "italic 12px Georgia, serif",
      haloW: 5
    });
    ctx.restore();
  }

  // Tipografía "Canarias" flotante en posición fija (estilo membrete).
  ctx.save();
  const W = ctx.canvas.clientWidth || ctx.canvas.width;
  const H = ctx.canvas.clientHeight || ctx.canvas.height;
  const fontSize = Math.max(40, Math.min(86, W * 0.10));
  ctx.font = `italic 600 ${fontSize}px Georgia, "Times New Roman", serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const cx = W / 2;
  const cy = Math.max(110, H * 0.14);
  ctx.fillStyle = "rgba(26, 22, 18, 0.55)";
  ctx.strokeStyle = "rgba(245, 232, 200, 0.85)";
  ctx.lineWidth = Math.max(2, fontSize * 0.06);
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.strokeText("Canarias", cx, cy);
  ctx.fillText("Canarias", cx, cy);
  ctx.restore();
}

// 2026-05-24 — Costa: extraída como helpers para poder pintarla en
// CUALQUIER nivel (mun, distrito, barrio, sec, manzana), no solo en isla.
// Pancho: "se deja de diferenciar la línea de costa al bajar de nivel y
// eso hace que el mapa parezca una maqueta incompleta".
function ensureCoastline(state) {
  if (!state.isla || state.isla.coastline || state.isla._loadingCoast) return;
  const COASTLINE_SRC = {
    gc: "../osm-gc/coastline.json",
    fv: "../osm-gc/coastline.json",
    lz: "../osm-gc/coastline.json",
    tf: "../osm-prov38/coastline.json",
    lp: "../osm-prov38/coastline.json",
    lg: "../osm-prov38/coastline.json",
    eh: "../osm-prov38/coastline.json",
  };
  const rel = COASTLINE_SRC[state.isla.id];
  if (!rel) { state.isla.coastline = []; return; }
  const url = assetUrl(rel);
  state.isla._loadingCoast = true;
  fetch(url)
    .then(r => r.json())
    .then(fc => {
      const features = (fc.features || []).filter(f =>
        f.geometry && (f.geometry.type === "LineString" ||
                       f.geometry.type === "MultiLineString"));
      const ANCH = [-15.55, 28.05];
      const M_LAT = 111132.0;
      const M_LNG = 111320.0 * Math.cos(ANCH[1] * Math.PI / 180);
      const [ix0, iz0, ix1, iz1] = state.isla.bbox || [-Infinity, -Infinity, Infinity, Infinity];
      const PAD = 5000;
      const lines = [];
      for (const f of features) {
        const conv = (coords) => coords.map(([lng, lat]) =>
          [(lng - ANCH[0]) * M_LNG, -(lat - ANCH[1]) * M_LAT]);
        const segs = f.geometry.type === "LineString"
          ? [f.geometry.coordinates]
          : f.geometry.coordinates;
        for (const seg of segs) {
          const line = conv(seg);
          let touches = false;
          for (const [x, z] of line) {
            if (x >= ix0 - PAD && x <= ix1 + PAD &&
                z >= iz0 - PAD && z <= iz1 + PAD) {
              touches = true; break;
            }
          }
          if (touches) lines.push(line);
        }
      }
      state.isla.coastline = lines;
      if (state._requestRender) state._requestRender();
    })
    .catch(() => { state.isla.coastline = []; });
}

function drawCoastline(ctx, state, opts = {}) {
  if (!state.isla?.coastline) return;
  ctx.save();
  ctx.lineWidth = opts.lineWidth ?? 1.2;
  ctx.strokeStyle = opts.strokeStyle ?? COSTA;
  ctx.lineCap = "round";
  for (const line of state.isla.coastline) {
    if (line.length < 2) continue;
    ctx.beginPath();
    for (let i = 0; i < line.length; i++) {
      const [px, py] = project(line[i][0], 0, line[i][1], state.view);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// Backdrop isla — costa + outlines de todos los muns en color dim.
// Pintado como primer layer en niveles más profundos para que el usuario
// siempre vea el contorno de la isla y los muns aunque esté zoomed-in a
// un barrio o sección. Sin esto, el "mapa parece una maqueta".
function drawIslaBackdrop(ctx, state) {
  ensureCoastline(state);
  drawCoastline(ctx, state, { lineWidth: 1.0, strokeStyle: "rgba(63,95,126,0.6)" });
  // Outlines de los muns hermanos (todos menos el actual) — paper-warm
  // fill MUY translúcido + stroke ink fino.
  const municipios = state.isla?.municipios;
  if (!municipios) return;
  const activeMun = state.municipio?.mun;
  ctx.save();
  ctx.lineWidth = 1.0;
  ctx.lineJoin = "round";
  for (const f of municipios) {
    if (f.properties.mun === activeMun) continue; // el activo se pinta sólo
    const ring = f._ringSimple;
    if (!ring) continue;
    // Fill semi-transparente para que se vean como tejido del archipiélago.
    fillRing(ctx, ring, state.view,
             "rgba(245, 232, 200, 0.55)",       // paper warm faint
             "rgba(26, 22, 18, 0.35)", 1.0);    // ink hairline
  }
  ctx.restore();
}

// Backdrop municipio — outline del mun activo + barrios hermanos
// como contornos. Llamado en barrio/sec/manzana para mantener el tejido
// del municipio siempre presente.
function drawMunBackdrop(ctx, state) {
  const mu = state.municipio;
  if (!mu) return;
  // Contorno del mun activo en ink fino (sobre la isla)
  ctx.save();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = "rgba(26,22,18,0.7)";
  ctx.lineJoin = "round";
  drawRingOutline(ctx, mu.polygon._ringSimple, state.view, 0);
  ctx.restore();

  // Barrios hermanos (todos menos el actual) — outlines ocre-dim
  const piezas = mu.barriosPiezas || [];
  const activeBarrioId = state.barrio?.barrioId;
  if (!piezas.length) return;
  ctx.save();
  ctx.lineWidth = 1.0;
  ctx.lineJoin = "round";
  for (const p of piezas) {
    if (p.id === activeBarrioId) continue;
    for (const ring of p.rings) {
      fillRing(ctx, ring, state.view,
               "rgba(217, 181, 138, 0.20)",      // OCRE_LT muy translúcido
               "rgba(163, 121, 69, 0.55)", 1.0); // OCRE_DK fino
    }
  }
  ctx.restore();
}

function renderIsla(ctx, state) {
  const { municipios, t1, t2 } = state.isla;

  // 2026-05-29 — Geometría OFICIAL (es-atlas/IGN-INE, límites
  // administrativos reales). Tesela la isla sin gaps ni overlaps, así
  // que los polígonos de municipio ya NO dejan slivers triangulares ni
  // "líneas dobles re-recorriendo el camino". Su borde exterior es la
  // costa oficial (no necesitamos la costa OSM separada, que al ser más
  // detallada que la geometría oficial asomaba desajustada). Stroke fino
  // (1.4px) para que la delimitación municipal no crispe al alejar.
  for (const m of municipios) {
    const sc = m.properties.sections_count || 0;
    const color = sc <= t1 ? OCRE_LT : sc <= t2 ? OCRE : OCRE_DK;
    fillRing(ctx, m._ringSimple, state.view, color, INK, 1.4);
  }

  // Etiquetas de mun: SOLO sobre el mun hovered (mouse desktop o touch
  // mobile vía hoveredSeccionCusec/hoverFeature). Sin labels permanentes
  // — el usuario reconoce el mun pasando el dedo/cursor. 2026-05-19.
  const hoveredMunCode = state.hoverFeature?.properties?.mun;
  if (hoveredMunCode) {
    const hm = municipios.find(m => m.properties.mun === hoveredMunCode);
    if (hm) {
      ctx.save();
      const c = hm._centroid;
      const [px, py] = project(c[0], 0, c[1], state.view);
      const txt = shortMunName(hm.properties.nmun);
      drawLabel(ctx, txt, [px, py], {
        font: "bold 13px Georgia, serif",
        haloW: 5
      });
      ctx.restore();
    }
  }

  // Tipografía "Gran Canaria" flotante en posición de pantalla fija
  // (no depende de la proyección). Bajo el header del banner, centrada,
  // semi-transparente sobre el render. 2026-05-13.
  ctx.save();
  const W = ctx.canvas.clientWidth || ctx.canvas.width;
  const H = ctx.canvas.clientHeight || ctx.canvas.height;
  const fontSize = Math.max(34, Math.min(74, W * 0.085));
  ctx.font = `italic 600 ${fontSize}px Georgia, "Times New Roman", serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const cx = W / 2;
  const cy = Math.max(110, H * 0.16);
  ctx.fillStyle = "rgba(26, 22, 18, 0.55)";
  ctx.strokeStyle = "rgba(245, 232, 200, 0.85)";
  ctx.lineWidth = Math.max(2, fontSize * 0.06);
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  // 2026-05-19 — label dinámico (Gran Canaria, Tenerife, La Palma, …)
  // según la isla activa. Backward-compat: si state.isla.name no existe
  // (no debería pasar tras refactor), cae a "Gran Canaria".
  const islaName = state.isla?.name || "Gran Canaria";
  ctx.strokeText(islaName, cx, cy);
  ctx.fillText(islaName, cx, cy);
  ctx.restore();
}

function shortMunName(nmun) {
  return nmun.replace("Palmas de Gran Canaria, Las", "LPGC")
             .replace("de Gran Canaria", "")
             .replace("San Bartolomé de Tirajana", "S.B. Tirajana")
             .replace("Santa Lucía de Tirajana", "S.L. Tirajana")
             .replace("Santa María de Guía", "Sta. Mª Guía")
             .replace(", La", "")
             .replace(", Las", "")
             .trim();
}

// ==================================================================
// NIVEL MUNICIPIO.

function renderMunicipio(ctx, state) {
  const mu = state.municipio;
  const view = state.view;
  // [C] Limpia los rects de etiqueta del frame anterior. Si el mun
  // activo no tiene piezas (rural sintético) o el render falla antes
  // del bloque de etiquetas, el hit-test no puede caer sobre rects
  // viejos de otro municipio.
  state._munLabelRects = null;

  // 2026-05-24 — Backdrop isla (costa + muns hermanos) por debajo. Sin
  // esto el mun activo aparecía aislado, perdiendo contexto geográfico.
  drawIslaBackdrop(ctx, state);

  // v1.5.2 — Vecinos: muns colindantes como polígonos planos
  // semi-transparentes con stroke ink fino. Se renderizan DESPUÉS del
  // backdrop pero antes del mun activo para quedar por debajo.
  drawMunicipioNeighbors(ctx, state);

  // 2026-05-22 — Fill base del polígono administrativo del mun activo.
  // Sin esto, muns rurales (Tejeda mun=025, Artenara mun=005) con 1-2
  // secciones quedaban "huecos": las piezas/secciones cubrían sólo el
  // núcleo poblado y el resto del polígono permanecía a color de fondo
  // (PAPER_WARM), indistinguible del archipiélago alrededor. SAND es
  // un tono ligeramente más cálido que paper y más claro que OCRE_LT,
  // así no compite con los tiles iso que van encima.
  fillRing(ctx, mu.polygon._ringSimple, view, SAND, null, 0);

  // v1.6.barrio-pieza (Fase 2a) — Si el mun tiene piezas-barrio del
  // catálogo canonical (164 barrios prov 35), las piezas tappables son
  // los barrios, no las 274 secciones-INE. Las secciones sin barrio
  // asignado ("huérfanas") siguen pintándose con un stroke ligero para
  // no perderlas visualmente. Si el mun no tiene piezas (Tejeda,
  // Artenara…), caemos al render legacy de 274 secciones.
  const piezas = mu.barriosPiezas;
  const owned = mu.barrioOwnedCusecs;
  const hasPiezas = !!(piezas && piezas.length);

  // 2026-06-02 — Modelo MIXTO:
  //   · Muns con barrios canonical (Las Palmas, Telde, Santa Cruz, La
  //     Laguna, Mogán...) — 54 muns en Canarias — usan tiles iso 3D
  //     identitarias (Vegueta, Triana, La Isleta, Tamaraceite…). Modelo
  //     "to the bridge" preservado.
  //   · Muns sin barrios canonical (Tejeda, Artenara, Vega de San Mateo,
  //     muns rurales no-GC) — supra-regiones overlay cubre con cascada
  //     toponímia/barranco/cabecera/kmeans.
  // El flag `_showAdminPiezas` queda como toggle debug para forzar el
  // fallback de secciones-INE en consola.
  if (hasPiezas) {
    // 2026-06-02 — Sombra plana SUTIL: offset 1.5m SE + color ink
    // translúcido 18%. Antes con offset 2m y INK sólido se leía como
    // línea negra gruesa por detrás de cada pieza, saturando.
    for (const p of piezas) {
      for (const ring of p.rings) {
        drawFlatShadow(ctx, ring, view, 1.5, 1.5, "rgba(26,22,18,0.18)");
      }
    }
    // Tiles iso por pieza con choropleth ocre original sobre terciles
    // de buildings_total (paper warm / ocre lt / ocre). Stroke 1px fino.
    // sideColor en ink translúcido 30% — las caras laterales pasan a
    // ser sombra suave del bloque en vez de fill negro sólido que
    // creaba "líneas negras gruesas" detrás de cada pieza.
    for (const p of piezas) {
      const bc = Number.isFinite(p.buildings_total) ? p.buildings_total : 0;
      const h = Math.min(40, Math.sqrt(Math.max(bc, 1) * 3));
      const color = bc <= mu.bcStats.t1 ? PAPER_WARM
                  : bc <= mu.bcStats.t2 ? OCRE_LT
                  : OCRE;
      for (const ring of p.rings) {
        drawIsoTile(ctx, ring, Math.max(h, 3), color, view, {
          stroke: 1,
          sideColor: "rgba(26,22,18,0.30)"
        });
      }
    }

    // [C] Highlight del borde por pieza-barrio — INK fino 1.2px sobre
    // los rings originales para definir el polígono sin saturar. El
    // hover sube a 2.5 con INK saturado.
    // SOLO sobre rings ORIGINALES (_originalRingCount): las huérfanas
    // reasignadas no llevan outline propio para no parecer sub-piezas.
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    const hoverPiezaId = state.hoverFeature?.properties?.barrioPiezaId;
    for (const p of piezas) {
      const isHover = p.id === hoverPiezaId;
      ctx.lineWidth = isHover ? 2.5 : 1.2;
      ctx.strokeStyle = isHover ? INK : "rgba(26,22,18,0.65)";
      const cutoff = Number.isFinite(p._originalRingCount)
        ? p._originalRingCount
        : p.rings.length;
      for (let r = 0; r < cutoff; r++) {
        drawRingOutline(ctx, p.rings[r], view, 0);
      }
    }
    ctx.restore();

    // Secciones huérfanas: las que no están en ninguna pieza. Stroke
    // ligero sobre el footprint, sin extrusión, para que se vean pero
    // no compitan con las piezas-barrio.
    if (owned) {
      ctx.save();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = "rgba(26,22,18,0.45)";
      ctx.lineJoin = "round";
      for (const s of mu.secciones) {
        if (owned.has(s.properties.cusec)) continue;
        drawRingOutline(ctx, s._ringSimple, view, 0);
      }
      ctx.restore();
    }
  } else if (state._showAdminPiezas) {
    // Fallback legacy: 274 secciones como tiles iso (muns sin barrios).
    // 2026-06-02 — gateado: por defecto el render admin no se pinta;
    // supra-regiones.js cubre el mun.
    for (const s of mu.secciones) {
      drawFlatShadow(ctx, s._ringSimple, view, 3, 3);
    }
    for (const s of mu.secciones) {
      const bc = Number.isFinite(s._buildingCount) ? s._buildingCount : 0;
      const h = Math.min(40, Math.sqrt(Math.max(bc, 1) * 3));
      const color = bc <= mu.bcStats.t1 ? PAPER_WARM
                  : bc <= mu.bcStats.t2 ? OCRE_LT
                  : OCRE;
      drawIsoTile(ctx, s._ringSimple, Math.max(h, 3), color, view, {
        stroke: 4
      });
    }
  }

  // Calles primary/secondary clipadas al bbox del mun (lazy load global).
  drawMunicipioRoads(ctx, state);

  // Overlays cívicos (renta, etc.) los pinta drawActiveOverlays() desde
  // el dispatcher principal, no aquí.

  // Contorno fino del mun por encima — 2026-05-13 bajado de 6 a 2.5 para
  // que la pieza-barrio respire visualmente y no parezca encerrada.
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = INK;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  drawRingOutline(ctx, mu.polygon._ringSimple, view, 0);

  // 2026-05-24 — Clusters DBSCAN: nivel intermedio clicable entre barrios
  // y secciones. Visibles cuando estamos algo zoomados (ratio > 1.2), para
  // muns rurales donde "barrio = todo el mun" no da resolución. En LPGC
  // y otros muns urbanos con muchas piezas-barrio se ven igual pero
  // probablemente solapen — el filtro de tamaño + anti-overlap los limpia.
  drawMunClusters(ctx, state);

  // [C] Etiquetas permanentes de barrio sobre el centroide de cada
  // pieza, con anti-overlap simple. Antes solo se pintaba el barrio
  // hovered (era invisible-de-arranque y solapaba con el hover de touch
  // mobile). Ahora se ven los 12 nombres de San Bartolomé / 34 de LPGC
  // directamente al entrar.
  //
  // Política anti-overlap:
  //  1. Calcular tamaño aproximado en píxeles de cada pieza (bbox
  //     proyectado). Si cellW o cellH < 40 px, descartamos la etiqueta
  //     — es ruido en muns dispersos con cabeceras sintéticas mínimas.
  //  2. Ordenar piezas por importancia (densidad de buildings desc)
  //     para que las grandes/densas se pinten primero.
  //  3. Greedy: cada label genera un rect (bbox del texto + padding).
  //     Si solapa con un rect ya pintado, se descarta.
  //  4. El barrio hovered SIEMPRE se pinta (último, font ligeramente
  //     mayor) para asegurar feedback de interacción.
  //  5. Los rects pintados se guardan en state._munLabelRects para que
  //     handleTap pueda hit-testear tap sobre la etiqueta misma.
  if (hasPiezas) {
    ctx.save();
    const baseFont = "italic 12px Georgia, serif";
    const hoverFont = "bold italic 13px Georgia, serif";
    ctx.font = baseFont;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Pre-cálculo por pieza: centroide proyectado, bbox px, importancia.
    const items = [];
    for (const p of piezas) {
      const [px, py] = project(p.centroid[0], 0, p.centroid[1], view);
      // Bbox del primer ring en píxeles — proxy del tamaño visual.
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      const ring = p._ringSimple;
      for (let i = 0; i < ring.length; i++) {
        const [rx, ry] = project(ring[i][0], 0, ring[i][1], view);
        if (rx < minX) minX = rx;
        if (rx > maxX) maxX = rx;
        if (ry < minY) minY = ry;
        if (ry > maxY) maxY = ry;
      }
      const cellW = maxX - minX;
      const cellH = maxY - minY;
      const importance = Number.isFinite(p.buildings_total)
        ? p.buildings_total
        : 0;
      items.push({ p, px, py, cellW, cellH, importance });
    }

    // Densas primero — las pequeñas/dispersas ceden ante las grandes.
    items.sort((a, b) => b.importance - a.importance);

    const hoverPiezaId = state.hoverFeature?.properties?.barrioPiezaId;
    const placed = [];

    const overlaps = (r, list) => {
      for (const o of list) {
        if (r.x1 > o.x0 && r.x0 < o.x1 && r.y1 > o.y0 && r.y0 < o.y1) {
          return true;
        }
      }
      return false;
    };

    for (const it of items) {
      const isHover = it.p.id === hoverPiezaId;
      // 2026-06-02 — Etiquetas permanentes con anti-overlap. La regla
      // "solo-en-hover" (2026-05-31) era inviable en móvil donde hover
      // no se puede invocar. Ahora cada pieza muestra su nombre +
      // edificios; greedy por importancia descendente — las grandes/
      // densas pintan primero y las pequeñas que solapan se omiten.
      // hover sigue siendo el caso "siempre se pinta" para feedback.

      const text = it.p.name || "";
      if (!text) continue;

      // [I] ITB v2 — pre-medida para anti-overlap. La HUD card es algo
      // mayor que el halo de drawLabel, así que reservamos un rect
      // proporcional. La sub-meta (edif count) sólo se muestra si la
      // celda es lo bastante grande — en muns muy densos prescindimos
      // de ella para no romper el grid.
      ctx.font = isHover ? hoverFont : baseFont;
      const m = ctx.measureText(text);
      const buildings = Number.isFinite(it.p.buildings_total)
        ? it.p.buildings_total
        : 0;
      const showMeta = buildings > 0
        && (isHover || (it.cellW > 80 && it.cellH > 36));
      const meta = showMeta
        ? `${buildings.toLocaleString("es")} edif`
        : "";
      const wName = m.width;
      // estimación del ancho meta (Plex Mono ~ 6px por car a 10px font)
      const wMeta = meta ? meta.length * 6.2 : 0;
      const w = Math.max(wName, wMeta);
      const lineH = 14;
      const padX = 7;
      const padY = meta ? 5 : 4;
      const boxW = w + padX * 2;
      const boxH = (meta ? lineH * 2 + 2 : lineH) + padY * 2;
      const rect = {
        x0: it.px - boxW / 2,
        x1: it.px + boxW / 2,
        y0: it.py - boxH / 2,
        y1: it.py + boxH / 2
      };
      // Anti-overlap: si solapa con uno ya pintado y no es hover, salta.
      if (!isHover && overlaps(rect, placed)) continue;
      placed.push({ ...rect, piezaId: it.p.id });

      drawHudCard(ctx, [it.px, it.py], {
        name: text,
        meta,
        hover: isHover
      });
    }
    ctx.restore();

    // Exponer rects para hit-test extendido en handleTap (app.js).
    state._munLabelRects = placed;
  }
}

// 2026-05-24 — Clusters DBSCAN: pinta hulls + label sobre el mun activo.
// Se invoca en renderMunicipio una vez los barrios ya están pintados.
// Render: stroke ocre punteado + label HUD card con el nombre del núcleo
// y el contador de edificios. Hover/active highlight pendiente (fase 3).
function drawMunClusters(ctx, state) {
  const mu = state.municipio;
  const view = state.view;
  const clusters = mu?.clusters;
  if (!clusters || !clusters.length) return;

  // 2026-05-24 — Visible desde fitView (ratio 1.0) para que el usuario
  // vea inmediatamente los núcleos cliclables. A ratio bajo cap fuerte
  // (top-5 más grandes), al zoomar revelamos progresivamente más.
  const ratio = view.scale / view.fitScale;
  const maxCount = ratio < 1.15 ? 5
                 : ratio < 1.5  ? 12
                 : ratio < 2.0  ? 22
                 :                45;
  const sorted = [...clusters].sort((a, b) => b.buildingCount - a.buildingCount);
  const visible = sorted.slice(0, maxCount);

  // Stroke ocre oscuro dashed para sugerir "zona heurística", no admin.
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = "rgba(163, 121, 69, 0.85)";
  for (const c of visible) {
    drawRingOutline(ctx, c.ring, view, 0);
  }
  ctx.restore();

  // Labels HUD card — 2026-05-31: solo en hover (petición usuario). El
  // hull dashed sigue visible siempre como pista de zona clicable; el
  // rect se publica para todos los clusters visibles (el tap sigue
  // funcionando aunque no haya etiqueta), pero la tarjeta nombre+edif
  // únicamente se pinta sobre el cluster con hover (state.hoverClusterId).
  ctx.save();
  ctx.font = "bold italic 11px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const hoverClusterId = state.hoverClusterId ?? null;
  // Rects para hit-test en handleTap. Cada rect lleva clusterId.
  const placedRects = [];
  for (const c of visible) {
    const [px, py] = project(c.centroid[0], 0, c.centroid[1], view);
    const text = c.name;
    const meta = c.buildingCount.toLocaleString("es") + " edif";
    const m = ctx.measureText(text);
    const padX = 6, padY = 4, lineH = 13;
    const wName = m.width;
    const wMeta = meta.length * 5.6;
    const w = Math.max(wName, wMeta);
    const boxW = w + padX * 2;
    const boxH = lineH * 2 + padY * 2;
    const rect = {
      x0: px - boxW / 2, x1: px + boxW / 2,
      y0: py - boxH / 2, y1: py + boxH / 2
    };
    placedRects.push({ ...rect, clusterId: c.id });

    if (c.id !== hoverClusterId) continue;

    // Card paper translúcida (vs HUD ink card de barrios — los diferencia).
    ctx.fillStyle = "rgba(251, 247, 238, 0.94)";
    ctx.strokeStyle = "rgba(163, 121, 69, 0.85)";
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    const chamfer = 4;
    ctx.beginPath();
    ctx.moveTo(rect.x0 + chamfer, rect.y0);
    ctx.lineTo(rect.x1, rect.y0);
    ctx.lineTo(rect.x1, rect.y1);
    ctx.lineTo(rect.x0, rect.y1);
    ctx.lineTo(rect.x0, rect.y0 + chamfer);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Nombre
    ctx.fillStyle = INK;
    ctx.font = "bold italic 11px Georgia, serif";
    ctx.fillText(text, px, py - lineH / 2 + 1);
    // Meta
    ctx.fillStyle = "rgba(26,22,18,0.6)";
    ctx.font = "500 9.5px 'IBM Plex Mono', SF Mono, Menlo, monospace";
    ctx.fillText(meta, px, py + lineH / 2 + 1);
  }
  ctx.restore();

  state._munClusterRects = placedRects;
}

// v1.5.2 — Vecinos colindantes nivel municipio.
//
// Muns vecinos detectados en loadMunicipio por bbox+distancia. Se pintan
// como polígonos planos con relleno paper_warm semi-transparente y
// stroke ink 2 px. No se pintan calles ni secciones — sólo la silueta.
function drawMunicipioNeighbors(ctx, state) {
  const mu = state.municipio;
  if (!mu?.neighbors?.length) return;
  const view = state.view;

  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.lineJoin = "round";
  for (const n of mu.neighbors) {
    fillRing(ctx, n._ringSimple, view, "rgba(240,221,180,0.55)", INK, 2);
  }
  ctx.restore();
}

function drawMunicipioRoads(ctx, state) {
  const mu = state.municipio;
  const view = state.view;
  // 2026-05-26 — Carga roads-main por isla (no roads.json completo). El
  // archivo *-main contiene SÓLO motorway/trunk/primary/secondary, los
  // únicos tipos que pintamos a este nivel. Reduce 38-48 MB → 2.5-3.7 MB.
  // Caché por isla: state._roadsByIsla.get(islaId) = lines[].
  if (!state._roadsByIsla) state._roadsByIsla = new Map();
  const islaId = state.isla?.id || "gc";
  const PROV38 = islaId === "tf" || islaId === "lp" || islaId === "lg" || islaId === "eh";
  const ROADS_URL = assetUrl(PROV38 ? "../osm-prov38/roads-main.json" : "../osm-gc/roads-main.json");
  const cacheKey = PROV38 ? "prov38" : "gc";

  if (!state._roadsByIsla.has(cacheKey) && !state._loadingRoads?.[cacheKey]) {
    state._loadingRoads = state._loadingRoads || {};
    state._loadingRoads[cacheKey] = true;
    fetch(ROADS_URL)
      .then(r => r.json())
      .then(fc => {
        const ANCH = [-15.55, 28.05];
        const M_LAT = 111132.0;
        const M_LNG = 111320.0 * Math.cos(ANCH[1] * Math.PI / 180);
        const out = [];
        for (const f of fc.features || []) {
          const hw = (f.properties && (f.properties.highway || f.properties.type))
                     || "";
          if (hw !== "primary" && hw !== "secondary" &&
              hw !== "trunk" && hw !== "motorway") continue;
          const g = f.geometry;
          if (!g || g.type !== "LineString") continue;
          const line = g.coordinates.map(([lng, lat]) =>
            [(lng - ANCH[0]) * M_LNG, -(lat - ANCH[1]) * M_LAT]);
          out.push({ type: hw, line });
        }
        state._roadsByIsla.set(cacheKey, out);
        if (state._requestRender) state._requestRender();
      })
      .catch(() => { state._roadsByIsla.set(cacheKey, []); });
  }
  // Backward-compat con _roadsGlobal (otros sitios lo leen)
  state._roadsGlobal = state._roadsByIsla.get(cacheKey) || null;
  if (!state._roadsGlobal || !state._roadsGlobal.length) return;
  const [bx0, bz0, bx1, bz1] = mu.bbox;
  ctx.save();
  ctx.lineCap = "round";
  for (const r of state._roadsGlobal) {
    // Clip naive por bbox: descarta líneas completamente fuera.
    let inX = false, inZ = false;
    for (const p of r.line) {
      if (p[0] >= bx0 && p[0] <= bx1) inX = true;
      if (p[1] >= bz0 && p[1] <= bz1) inZ = true;
      if (inX && inZ) break;
    }
    if (!inX || !inZ) continue;
    // 2026-05-13 — calles más finas + residentiales en alpha reducido
    // para quitar el "ruido marrón" que dominaba el nivel mun.
    const isPrimary = r.type === "primary" || r.type === "trunk" || r.type === "motorway";
    const isSecondary = r.type === "secondary" || r.type === "tertiary";
    if (isPrimary) {
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = STREET;
    } else if (isSecondary) {
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(107,99,88,0.65)";
    } else {
      // residential / service / footway / track — opacidad baja
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(107,99,88,0.30)";
    }
    ctx.beginPath();
    for (let i = 0; i < r.line.length; i++) {
      const [px, py] = project(r.line[i][0], 0, r.line[i][1], view);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawRingOutline(ctx, ring, view, y) {
  ctx.beginPath();
  for (let i = 0; i < ring.length; i++) {
    const [px, py] = project(ring[i][0], y, ring[i][1], view);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
}

// ==================================================================
// NIVEL SECCIÓN (lo que ya teníamos en v0.2 con shadow+stroke reducidos).

function renderSeccion(ctx, state) {
  const lod = computeLodBlend(state.view);

  // 2026-05-24 — Backdrop: costa + muns hermanos + mun outline +
  // barrios hermanos. Mantiene contexto geográfico al bajar a sección.
  drawIslaBackdrop(ctx, state);
  drawMunBackdrop(ctx, state);

  // v1.5.2 — Vecinos de sección: las otras secciones del distrito
  // (state.district.secciones excluyendo la actual) como contornos finos
  // con relleno paper_warm semi-transparente. Se renderizan ANTES de la
  // sección activa para quedar por debajo.
  drawSeccionNeighbors(ctx, state);

  drawRoads(ctx, state);

  // 2026-05-26 — Cross-fade manzanas-iso ↔ edificios-individuales.
  //   ratio < 3.0           → solo drawSectionLOD (manzanas iso unificadas)
  //   ratio 3.0 → 5.0       → cross-fade: manzanas alpha 1.0→0.0,
  //                            edificios drawArchetype alpha 0.0→1.0
  //   ratio ≥ 5.0           → solo edificios (con clipping al viewport)
  // El clipping descarta edificios cuyo centroide cae fuera del canvas
  // (+margen), de modo que el coste real escala con lo VISIBLE, no con
  // los 4500 totales de la sección.
  //
  // Reemplaza la nota previa (2026-05-25) "agregaciones hasta manzana,
  // edificios SOLO al entrar a manzana": con catastro completo (5-10×
  // más edif) tener acceso al detalle pieza-a-pieza desde sección
  // recupera la riqueza informativa que la agregación borraba.
  const ratio = state.view.scale / state.view.fitScale;
  const tDetail = Math.max(0, Math.min(1, (ratio - 3.0) / 2.0));
  const manzanaAlpha = 1.0 - tDetail;
  const bldgAlpha = tDetail;

  if (manzanaAlpha > 0.01) {
    ctx.save();
    ctx.globalAlpha = manzanaAlpha;
    drawSectionLOD(ctx, state);
    ctx.restore();
  }
  if (bldgAlpha > 0.01) {
    ctx.save();
    ctx.globalAlpha = bldgAlpha;
    drawSeccionParks(ctx, state);       // 2026-05-29 — parques brotan con los edificios, por debajo
    drawSeccionBuildings(ctx, state);
    ctx.restore();
  }

  drawSongkickCard(ctx, state);
}

// 2026-05-29 — Parques / zonas verdes a nivel sección. Mismo patrón que
// drawSeccionBuildings: coords locales (m), proyección iso, clipping por
// viewport (centroide visible + margen). Se dibujan ANTES que los
// edificios (quedan por debajo, como suelo verde) y comparten la α del
// cross-fade (bldgAlpha), así que "brotan" a la vez que los edificios.
function drawSeccionParks(ctx, state) {
  const parks = state.section && state.section.parks;
  if (!parks || !parks.length) return;
  const view = state.view;
  const W = ctx.canvas.width / state.dpr;
  const H = ctx.canvas.height / state.dpr;
  const margin = 80;
  for (const p of parks) {
    if (!p._ring || p._ring.length < 3 || !p._centroid) continue;
    const [cx, cz] = p._centroid;
    const [px, py] = project(cx, 0, cz, view);
    if (px < -margin || px > W + margin || py < -margin || py > H + margin) continue;
    // Verde vegetal translúcido + contorno tenue. Hereda globalAlpha del caller.
    fillRing(ctx, p._ring, view, "rgba(74,160,90,0.50)", "rgba(42,80,24,0.55)", 1);
  }
}

// 2026-05-26 — Edificios individuales a nivel sección con clipping
// viewport. Usa drawArchetype como renderManzana, pero salta edificios
// no visibles (centroide fuera del canvas + margen). Coste típico:
// 50-200 edif visibles vs 1500-4500 totales. Sin sombras planas (el
// volumen extruido + outline ink basta para anclar al suelo y evita
// el "pedestal flotante" que generaba drawFlatShadow).
function drawSeccionBuildings(ctx, state) {
  const view = state.view;
  const W = ctx.canvas.width / state.dpr;
  const H = ctx.canvas.height / state.dpr;
  const margin = 80;  // px — incluir edificios cuyo centroide está cerca del borde
  const buildings = state.section.buildings;

  // Painter's algorithm: ordenar por (x + z) creciente para que los del
  // fondo se dibujen primero y los del frente queden encima.
  const visible = [];
  for (const b of buildings) {
    if (!b._ring || b._ring.length < 3 || !b._centroid) continue;
    const [cx, cz] = b._centroid;
    const [px, py] = project(cx, 0, cz, view);
    if (px < -margin || px > W + margin) continue;
    if (py < -margin || py > H + margin) continue;
    visible.push({ b, key: cx + cz });
  }
  visible.sort((a, b) => a.key - b.key);

  for (const { b } of visible) {
    const h = Math.max(3.0, b.properties.height_m || 6);
    drawArchetype(ctx, b._ring, h, b._archetype, view, {
      stroke: 1.5,
      outline: INK
    });
  }
}

// v1.5.2 — Vecinos colindantes nivel sección.
//
// Las otras secciones del distrito (state.district.secciones) ya están en
// el mismo anchor GC que la sección activa (siempre que la sección se
// haya cargado vía buildSeccionFromDistrictPack). Las pintamos como
// polígonos planos:
//   - relleno paper_warm semi-transparente (rgba para que la sombra de
//     la sección activa se vea por encima)
//   - contorno ink 1.5 px
//   - sin manzanas, sin edificios, sin shadow
function drawSeccionNeighbors(ctx, state) {
  const d = state.district;
  if (!d) return;
  const currentCusec = state.section?.meta?.cusec;
  if (!currentCusec) return;
  const view = state.view;

  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = INK;
  ctx.lineJoin = "round";
  for (const s of d.secciones) {
    if (s.properties.cusec === currentCusec) continue;
    fillRing(ctx, s._ringSimple, view, "rgba(240,221,180,0.55)", INK, 1.5);
  }
  ctx.restore();
}

function drawRoads(ctx, state) {
  const features = state.section.roads;
  // 2026-05-26 — Atenuar roads a alto zoom: cuando el usuario ve
  // edificios individuales (cross-fade ≥3.0), los roads gruesos negros
  // compiten visualmente. Interpolamos alpha 1.0 → 0.40 y width × 1.0 → 0.55
  // entre ratio 2.5 y 4.5 — coincide con la rampa de detalle edif.
  const ratio = state.view.scale / state.view.fitScale;
  const fadeT = Math.max(0, Math.min(1, (ratio - 2.5) / 2.0));
  const roadAlpha = 1.0 - fadeT * 0.60;     // 1.0 → 0.40
  const widthFactor = 1.0 - fadeT * 0.45;   // 1.0 → 0.55
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalAlpha = roadAlpha;
  for (const f of features) {
    const w = (ROAD_WIDTHS[f.properties.type] || 1.5) * widthFactor;
    const coords = f.geometry.coordinates;
    if (coords.length < 2) continue;
    ctx.lineWidth = Math.max(0.5, w);
    ctx.strokeStyle = STREET;
    ctx.beginPath();
    for (let i = 0; i < coords.length; i++) {
      const [px, py] = project(coords[i][0], 0, coords[i][1], state.view);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawSectionLOD(ctx, state) {
  const manzanas = state.section.manzanas;
  const selId = state.selectedManzanaId;

  // 2026-05-25 — Coloreado por terciles building_count (paleta paper-ocre)
  // en lugar del binario GRIS/OCRE legacy. Encaja con renderBarrio y
  // evita que las "manzanas-bloque" (puertos, polígonos) dominen visualmente
  // con su gris oscuro. Altura cap 22 para no levantar warehouses excesivos.
  const counts = [];
  for (const m of manzanas) {
    const bc = m.properties.building_count || 0;
    if (bc > 0 && bc <= 30) counts.push(bc);
  }
  counts.sort((a, c) => a - c);
  const t1 = counts[Math.floor(counts.length / 3)] || 0;
  const t2 = counts[Math.floor(counts.length * 2 / 3)] || 0;
  const colorFor = (bc) => {
    if (bc > 30) return OCRE_DK;
    if (bc <= t1) return SAND;
    if (bc <= t2) return OCRE_LT;
    return OCRE;
  };

  for (const m of manzanas) {
    if (selId !== null && m.properties.id !== selId) continue;
    drawFlatShadow(ctx, m._ringSimple, state.view, 2, 2);
  }
  // Fade-others: otras manzanas planas OCRE_LT translúcido cuando hay focal.
  if (selId !== null) {
    ctx.save();
    ctx.globalAlpha = 0.30;
    for (const m of manzanas) {
      if (m.properties.id === selId) continue;
      fillRing(ctx, m._ringSimple, state.view, OCRE_LT,
               "rgba(26,22,18,0.65)", 1.0);
    }
    ctx.restore();
  }
  for (const m of manzanas) {
    const isSelected = selId === m.properties.id;
    if (selId !== null && !isSelected) continue;
    const bc = m.properties.building_count || 0;
    const hMed = m.properties.height_median_m || 6;
    const hUse = Math.max(3, Math.min(22, hMed * 0.8));
    drawIsoTile(ctx, m._ringSimple, hUse, colorFor(bc), state.view, {
      stroke: 1.8,
      liftPx: isSelected ? 4 : 0,
      ringColor: isSelected ? ACCENT_NARANJA : null,
      ringW: 4
    });
  }
}

function drawManzanaLOD(ctx, state) {
  const buildings = state.section.buildings;
  const manzanas = state.section.manzanas;
  const selId = state.selectedManzanaId;

  for (const m of manzanas) {
    fillRing(ctx, m._ringSimple, state.view, "rgba(200, 153, 104, 0.18)",
             "rgba(26,22,18,0.35)", 1.5);
  }

  // Sombras edificios: offset reducido. Si hay manzana seleccionada, sólo
  // dibujamos sombra de los edificios focales — las del resto compiten
  // con el énfasis visual.
  for (const b of buildings) {
    if (selId !== null && b.properties.manzana_id !== selId) continue;
    drawFlatShadow(ctx, b._ring, state.view, 2.5, 2.5);
  }

  // Fade-to-context: cuando hay manzana seleccionada, los edificios del
  // resto de la sección se pintan como footprints planos OCRE_LT con
  // alpha bajo (siguen formando la "ciudad" alrededor, pero no compiten
  // con los focales). Los focales mantienen su archetype iso completo.
  // v1.6.fade: stroke ink bumpeado para que los contornos se lean a este
  // zoom — antes alpha efectiva era ~0.17 y prácticamente no se veían.
  if (selId !== null) {
    ctx.save();
    ctx.globalAlpha = 0.30;
    for (const b of buildings) {
      if (b.properties.manzana_id === selId) continue;
      drawFootprint(ctx, b._ring, state.view, OCRE_LT,
                    "rgba(26,22,18,0.95)", 1.0);
    }
    ctx.restore();
    for (const b of buildings) {
      if (b.properties.manzana_id !== selId) continue;
      const h = Math.max(3.0, b.properties.height_m || 6);
      drawArchetype(ctx, b._ring, h, b._archetype, state.view, {
        stroke: 2.0,
        outline: INK
      });
    }
  } else {
    for (const b of buildings) {
      const h = Math.max(3.0, b.properties.height_m || 6);
      drawArchetype(ctx, b._ring, h, b._archetype, state.view, {
        stroke: 2.0,
        outline: INK
      });
    }
  }

  if (state.selectedManzanaId !== null) {
    const m = manzanas.find(mm => mm.properties.id === state.selectedManzanaId);
    if (m) {
      ctx.lineWidth = 4;
      ctx.strokeStyle = ACCENT_NARANJA;
      ctx.beginPath();
      const r = m._ringSimple;
      for (let i = 0; i < r.length; i++) {
        const [px, py] = project(r[i][0], 0, r[i][1], state.view);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
}

function drawSongkickCard(ctx, state) {
  // v1.6 — desactivado: el card "Concierto OFGC · Mahler" era un
  // placeholder hardcoded de la versión inicial. Los eventos reales
  // ahora se cargan vía overlays/eventos.js (toggle "Eventos culturales"
  // en el panel de capas), con datos de cultura.grancanaria.com/agenda.
  return;
  // eslint-disable-next-line no-unreachable
  const anchorId = state.section._songkickAnchorId;
  if (anchorId === null || anchorId === undefined) return;
  const m = state.section.manzanas.find(mm => mm.properties.id === anchorId);
  if (!m) return;
  const c = m._centroid;
  const hUse = Math.max(4.0, m.properties.height_median_m || 6);
  const [ax, ay] = project(c[0], hUse, c[1], state.view);

  const W = 220, H = 70, R = 10;
  let bx0 = ax - W / 2;
  let by0 = ay - H - 26;
  const cw = ctx.canvas.width / state.dpr;
  const ch = ctx.canvas.height / state.dpr;
  bx0 = Math.max(12, Math.min(cw - W - 12, bx0));
  by0 = Math.max(60, Math.min(ch - H - 12, by0));
  const bx1 = bx0 + W, by1 = by0 + H;

  ctx.fillStyle = INK;
  roundRect(ctx, bx0 + 5, by0 + 5, W, H, R);
  ctx.fill();

  ctx.fillStyle = ACCENT_MORADO;
  roundRect(ctx, bx0, by0, W, H, R);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  ctx.stroke();

  ctx.beginPath();
  ctx.fillStyle = ACCENT_MORADO;
  const tipX = Math.max(bx0 + 24, Math.min(bx1 - 24, ax));
  ctx.moveTo(tipX - 10, by1);
  ctx.lineTo(tipX + 10, by1);
  ctx.lineTo(ax, ay - 2);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.moveTo(tipX - 10, by1); ctx.lineTo(ax, ay - 2);
  ctx.moveTo(tipX + 10, by1); ctx.lineTo(ax, ay - 2);
  ctx.stroke();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 14px Georgia, serif";
  ctx.textBaseline = "top";
  ctx.fillText("Concierto OFGC · Mahler", bx0 + 14, by0 + 12);
  ctx.font = "13px Georgia, serif";
  ctx.fillText("Hoy · 20:30", bx0 + 14, by0 + 38);

  ctx.fillStyle = ACCENT_MORADO;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(ax, ay, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

// ==================================================================
// NIVEL DISTRITO (v1.5.1 — LOD triple).
//
// Iso completa 30°/30° (configurada en PROJ_PRESETS.distrito). LOD
// interno con TRES pasos y dos cross-fades:
//
//   Paso 1 — entry zoom (scale ≤ 2.2× fitScale, v1.5.2):
//     Sólo polígonos de las N secciones del distrito coloreados por
//     densidad de edificios (paleta cálida 3 niveles, igual que la
//     vista municipio). Trazo ink 4px, sombra plana SE 3px, contorno
//     bbox del distrito en ink 6px. Sin extrusión visible (sz_factor
//     reducido en el render). Etiqueta del distrito flotante (HTML).
//     Beneficio: en distrito 02 LPGC se ven 58 piezas grandes, no
//     1.700 manzanas pequeñas.
//
//   Paso 2 — mid zoom (2.2× < scale ≤ 4.0× fitScale):
//     Cross-fade entre regiones-sección y manzanas-tile. Las secciones
//     mantienen un contorno fino ink y las manzanas aparecen como
//     tiles unificados con stroke 4px y sombra plana 4px.
//
//   Paso 3 — high zoom (scale > 4.0× fitScale):
//     Cross-fade entre manzanas-tile y edificios-arquetipo individuales
//     con catálogo (lo que existía antes en v1.5).
//
// Las ventanas de cross-fade son ±0.35 alrededor de cada threshold —
// suficiente para sentirse como ~300ms en un MacBook normal a velocidad
// de rueda normal.

// 2026-05-26 — renderVecindario: nivel intermedio entre sección y
// barrio/distrito. Reusa renderDistrito sustituyendo state.district por
// state.vecindario (mismo schema, cargado por loadVecindario en app.js).
// La sección focal se resalta vía state.selectedSeccionCusec (highlight
// naranja perimetral persistente, mismo patrón v1.6e del distrito).
function renderVecindario(ctx, state) {
  const vec = state.vecindario;
  if (!vec) return;
  const saved = state.district;
  state.district = vec;
  try {
    renderDistrito(ctx, state);
  } finally {
    state.district = saved;
  }
}

function renderDistrito(ctx, state) {
  const d = state.district;
  if (!d) return;
  const view = state.view;
  const lod = computeLodBlendDistrito(view);

  // 2026-05-24 — Backdrop completo costa+isla+mun.
  drawIslaBackdrop(ctx, state);
  drawMunBackdrop(ctx, state);

  // v1.5.2 — Vecinos: otros distritos del mismo municipio renderizados como
  // polígonos planos desaturados ANTES del distrito activo, para que el
  // distrito quede por encima y los vecinos asomen alrededor sin tapar
  // el contenido principal.
  drawDistritoNeighbors(ctx, d, view);

  // Calles del distrito: dibujadas siempre que NO sea paso 1 puro,
  // porque a entry zoom las calles del distrito completo saturan tanto
  // como las manzanas. Aparecen junto con las manzanas (paso 2+).
  const roadAlpha = Math.min(1, lod.alpha2 + lod.alpha3);
  if (roadAlpha > 0.01) {
    ctx.save();
    ctx.globalAlpha = roadAlpha;
    ctx.lineCap = "round";
    for (const r of d.roads) {
      const w = ROAD_WIDTHS[r.type] || 1.5;
      ctx.lineWidth = w;
      ctx.strokeStyle = STREET;
      ctx.beginPath();
      for (let i = 0; i < r.line.length; i++) {
        const [px, py] = project(r.line[i][0], 0, r.line[i][1], view);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // PASO 1: secciones como bloques iso individuales con color de paleta
  // por cusec + iluminación si están hovered/selected.
  // v1.6c: computeLodBlendDistrito siempre devuelve alpha1=1, así que
  // las ramas alpha2/alpha3 son código muerto que se conserva por si
  // queremos restaurar el detalle (manzanas/edificios) en el futuro.
  if (lod.alpha1 > 0.01) {
    ctx.save();
    ctx.globalAlpha = lod.alpha1;
    drawDistritoSecciones(ctx, d, view,
                          state.selectedSeccionCusec,
                          state.hoveredSeccionCusec);
    ctx.restore();
    // Los overlays cívicos (renta, etc.) los pinta drawActiveOverlays()
    // desde el dispatcher principal — el propio overlay decide qué hacer
    // según state.lodLevel.
  } else if (lod.alpha2 > 0.01) {
    // En el paso 2 dejamos un contorno fino de las secciones para no
    // perder la referencia administrativa.
    ctx.save();
    ctx.globalAlpha = Math.min(0.5, lod.alpha2);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = "rgba(26,22,18,0.55)";
    for (const s of d.secciones) {
      ctx.beginPath();
      const r = s._ringSimple;
      for (let i = 0; i < r.length; i++) {
        const [px, py] = project(r[i][0], 0, r[i][1], view);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }

  // PASO 2: manzanas como tiles iso unificados.
  //
  // Fix v1.5.3 (edificios al suelo): durante el cross-fade paso 2 → paso 3
  // la altura de las manzanas se interpola desde su `height_median_m` hasta
  // 0. Cuando paso 3 es dominante (alpha3 == 1) las manzanas quedan
  // *planas* en el suelo y los edificios extruyen claramente desde z=0,
  // evitando que parezcan flotar sobre el techo de la manzana. La sombra
  // también se reduce con la altura para acompañar el aplanado.
  if (lod.alpha2 > 0.01) {
    ctx.save();
    ctx.globalAlpha = lod.alpha2;
    // Factor de extrusión: 1 en paso 2 puro, 0 cuando paso 3 toma el relevo.
    const heightK = 1 - lod.alpha3;
    const shadowOffset = 4 * heightK;
    const selCusec = state.selectedSeccionCusec || null;
    for (const m of d.manzanas) {
      if (selCusec && m._cusec !== selCusec) continue;
      if (shadowOffset > 0.5) {
        drawFlatShadow(ctx, m._ringSimple, view, shadowOffset, shadowOffset);
      }
    }
    // v1.6.fade-others: manzanas de OTRAS secciones como footprints planos
    // alpha-reducidos durante paso 2 cuando hay sección seleccionada.
    if (selCusec) {
      ctx.save();
      ctx.globalAlpha = lod.alpha2 * 0.30;
      for (const m of d.manzanas) {
        if (m._cusec === selCusec) continue;
        fillRing(ctx, m._ringSimple, view, OCRE_LT,
                 "rgba(26,22,18,0.55)", 1.0);
      }
      ctx.restore();
    }
    for (const m of d.manzanas) {
      if (selCusec && m._cusec !== selCusec) continue;
      const hFull = Math.max(4.0, m.properties.height_median_m || 6);
      const hUse = hFull * heightK;
      // Si hUse ≈ 0 (paso 3 dominante) dibujamos un anillo plano relleno
      // (sólo "techo" sin caras laterales) — la manzana queda aplastada
      // al suelo y los edificios extruyen claramente desde z=0.
      if (hUse < 0.5) {
        fillRing(ctx, m._ringSimple, view, OCRE, INK, 4);
      } else {
        drawIsoTile(ctx, m._ringSimple, hUse, OCRE, view, { stroke: 4 });
      }
    }
    ctx.restore();
  }

  // PASO 2.5 [A]: pre-α3 footprint ramp. Antes de que los archetypes 3D
  // tomen el relevo, los footprints de edificios focales fade-in sobre
  // la manzana-tile. Esto evita el salto "manzana → edificio 3D"; el
  // usuario ve aparecer el contorno de los edificios primero, después
  // crecer en altura.
  // Se activa en ratio 2.6–3.5 (mientras α2 sigue siendo dominante y
  // α3 aún es 0). Cuando α3 ≥ 0.01 cedemos el control al bloque α3
  // original (que ya pinta archetype con bldHeightK).
  if (lod.bldFootprintK > 0.01 && lod.alpha3 < 0.01) {
    const selCusec = state.selectedSeccionCusec || null;
    ctx.save();
    ctx.globalAlpha = lod.bldFootprintK * 0.85;
    for (const b of d.buildings) {
      if (selCusec && b._cusec !== selCusec) continue;
      drawFootprint(ctx, b._ring, view, "rgba(200,153,104,0.55)",
                    "rgba(26,22,18,0.85)", 1.0);
    }
    ctx.restore();
  }

  // PASO 3: edificios individuales con arquetipos.
  //
  // v1.6.fade-others: cuando hay sección seleccionada (tap a una sección
  // del distrito que disparó zoom a 5× fitScale), los edificios y
  // manzanas de OTRAS secciones del distrito se atenúan — siguen como
  // tejido urbano alrededor pero no compiten con la sección focal. La
  // selección queda "destacada" en lugar de competir a igual color con
  // todos los edificios vecinos del distrito.
  if (lod.alpha3 > 0.01) {
    ctx.save();
    ctx.globalAlpha = lod.alpha3;
    const selCusec = state.selectedSeccionCusec || null;
    // [A] Rampa de altura: en la transición α3 (3.6–4.8) los edificios
    // crecen desde footprint plano hasta su altura completa. Antes el
    // edificio aparecía ya a altura máxima en cuanto α3 destellaba.
    const heightScale = Math.max(0.0, lod.bldHeightK);
    // Manzanas en ocre transparente como base bajo edificios.
    for (const m of d.manzanas) {
      fillRing(ctx, m._ringSimple, view, "rgba(200, 153, 104, 0.18)",
               "rgba(26,22,18,0.28)", 1.2);
    }
    // Sombras: sólo edificios focales (sin selección → todas). [A]
    // Atenúa la sombra con heightScale — sin altura no hay sombra.
    if (heightScale > 0.05) {
      ctx.save();
      ctx.globalAlpha = lod.alpha3 * heightScale;
      for (const b of d.buildings) {
        if (selCusec && b._cusec !== selCusec) continue;
        drawFlatShadow(ctx, b._ring, view, 2.5 * heightScale, 2.5 * heightScale);
      }
      ctx.restore();
    }
    // Edificios de OTRAS secciones: footprint plano OCRE_LT con alpha
    // reducida — quedan como contexto desaturado.
    if (selCusec) {
      ctx.save();
      ctx.globalAlpha = lod.alpha3 * 0.30;
      for (const b of d.buildings) {
        if (b._cusec === selCusec) continue;
        drawFootprint(ctx, b._ring, view, OCRE_LT,
                      "rgba(26,22,18,0.85)", 1.0);
      }
      ctx.restore();
    }
    // Edificios focales: archetype con altura escalada por bldHeightK.
    // Cuando heightScale es muy bajo (< 0.08) pintamos footprint para
    // evitar archetypes ultra-bajos que se ven feos; el footprint ya
    // estaba apareciendo en la fase 2.5 con un alpha similar, así que
    // hay continuidad visual.
    for (const b of d.buildings) {
      if (selCusec && b._cusec !== selCusec) continue;
      const hFull = Math.max(3.0, b.properties.height_m || 6);
      const h = hFull * heightScale; // [A]
      if (h < 0.5) {
        // [A] altura nula → footprint plano para mantener la presencia
        // del edificio mientras el archetype todavía no ha "despegado".
        drawFootprint(ctx, b._ring, view, "rgba(200,153,104,0.65)",
                      INK, 1.6);
      } else {
        drawArchetype(ctx, b._ring, h, b._archetype, view, {
          stroke: 1.6,
          outline: INK
        });
      }
    }
    ctx.restore();
  }

  // v1.6e — Highlight perimetral persistente de la sección seleccionada.
  // El highlight-bloque del mosaico (α1) desaparece al zoom-in, pero el
  // contorno de la sección elegida sigue visible sobre los edificios
  // para anclar el contexto: "estás dentro de la sección X".
  if (state.selectedSeccionCusec && (lod.alpha2 > 0.01 || lod.alpha3 > 0.01)) {
    const sel = d.secciones.find(s =>
      s.properties.cusec === state.selectedSeccionCusec);
    if (sel) {
      ctx.save();
      ctx.globalAlpha = Math.max(lod.alpha2, lod.alpha3);
      ctx.lineWidth = 4;
      ctx.strokeStyle = ACCENT_NARANJA;
      ctx.lineJoin = "round";
      ctx.beginPath();
      const r = sel._ringSimple;
      for (let i = 0; i < r.length; i++) {
        const [px, py] = project(r[i][0], 0, r[i][1], view);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  }
}

// v1.6.barrio-pieza-real — Render del nivel barrio reformulado. Pancho
// pidió que la unidad visible/tappable en barrio sean MANZANAS, no
// edificios. El LOD intra-nivel queda bloqueado: aunque el usuario haga
// zoom-in, el renderer NO destapa edificios — sólo "ve mejor" las
// mismas manzanas (label aparece a ratio > 1.8). El descenso a
// edificios sólo ocurre por tap explícito (enterManzana).
//
// Capas (en orden, atrás → adelante):
//   1. Vecinos: barrios colindantes del mismo mun como outline finísimo
//      gris, sin extrusión, alpha 0.18. Hace contexto sin ruido.
//   2. Sombras planas SE 2px de cada manzana.
//   3. Manzanas como tiles iso extrudidos. Altura = min(30, h_median*0.8);
//      color top = terciles por building_count (sand/ocre-light/ocre)
//      con un cuarto color ocre-dark para manzanas de >30 buildings.
//   4. Outline real del polígono del barrio en ink 3px round.
//   5. Labels opcionales por manzana cuando zoom ratio > 1.8 (fade-in).
function renderBarrio(ctx, state) {
  const b = state.barrio;
  if (!b) return;
  const view = state.view;

  // 2026-05-24 — Backdrop completo: costa + muns hermanos + mun outline
  // + barrios hermanos. Sin esto el barrio quedaba "flotando" desconectado
  // del resto del mapa cuando el usuario zoomeaba a su nivel.
  drawIslaBackdrop(ctx, state);
  drawMunBackdrop(ctx, state);

  // ── 1. Vecinos: barrios colindantes del mismo mun como outline gris.
  drawBarrioNeighbors(ctx, b, view);

  // ── Terciles de building_count sobre las manzanas del barrio activo
  // (excluyendo las "grandes" >30 para no sesgar el cálculo). La cuarta
  // banda (ocre-dark) marca manzanas relevantes >30 edificios.
  const counts = [];
  for (const m of b.manzanas) {
    const bc = m.properties.building_count || 0;
    if (bc > 0 && bc <= 30) counts.push(bc);
  }
  counts.sort((a, c) => a - c);
  const t1 = counts[Math.floor(counts.length / 3)] || 0;
  const t2 = counts[Math.floor(counts.length * 2 / 3)] || 0;
  const colorFor = (bc) => {
    if (bc > 30) return OCRE_DK;
    if (bc <= t1) return SAND;
    if (bc <= t2) return OCRE_LT;
    return OCRE;
  };

  // ── 2. Sombras planas SE 2px. Cuando hay sección seleccionada saltamos
  // las sombras de las manzanas de otras secciones — la sombra hace ruido
  // sobre el tejido atenuado.
  const selCusec = state.selectedSeccionCusec;
  for (const m of b.manzanas) {
    if (!m._ringSimple) continue;
    if (selCusec && m._cusec !== selCusec) continue;
    drawFlatShadow(ctx, m._ringSimple, view, 2, 2,
                   "rgba(26,22,18,0.25)");
  }

  // 2026-06-02 — Cross-fade manzana-iso ↔ edificios-individuales.
  // Petición usuario: ver el barrio ENTERO con sus edificios extruidos
  // (no atenuados como hacía enterManzana, no solo manzanas-tile). Se
  // pintan TODOS los buildings del barrio con archetypes 3D cuando el
  // zoom cruza 2.0. Mismo patrón que renderSeccion.
  //   ratio ≤ 2.0   → solo manzanas iso (current)
  //   ratio 2.0→3.5 → manzanas alpha 1→0, edificios alpha 0→1
  //   ratio ≥ 3.5   → solo edificios individuales con clipping viewport
  const ratio = view.scale / view.fitScale;
  const tDetail = Math.max(0, Math.min(1, (ratio - 2.0) / 1.5));
  const manzanaAlpha = 1.0 - tDetail;
  const bldgAlpha = tDetail;

  // ── 3. Manzanas como tiles iso. Altura modesta (cap 30) para que el
  // mosaico se lea como pieza y no se solape entre vecinas. Stroke ink
  // fino 1.5 px. side ink (default), sin liftPx.
  //
  // v1.6.fade: si selectedSeccionCusec está activo (fallback de tap sobre
  // sección desde el barrio), las manzanas de otras secciones se pintan
  // como tiles planos OCRE_LT con alpha 0.30 — siguen visibles como
  // tejido pero no compiten con la sección focal.
  if (manzanaAlpha > 0.01) {
    ctx.save();
    ctx.globalAlpha = manzanaAlpha;
    for (const m of b.manzanas) {
      if (!m._ringSimple) continue;
      const bc = m.properties.building_count || 0;
      const hMed = m.properties.height_median_m || 6;
      const hUse = Math.max(3, Math.min(30, hMed * 0.8));
      if (selCusec && m._cusec !== selCusec) {
        ctx.save();
        ctx.globalAlpha = manzanaAlpha * 0.30;
        fillRing(ctx, m._ringSimple, view, OCRE_LT,
                 "rgba(26,22,18,0.95)", 1.0);
        ctx.restore();
      } else {
        drawIsoTile(ctx, m._ringSimple, hUse, colorFor(bc), view, {
          stroke: 1.5
        });
      }
    }
    ctx.restore();
  }

  // ── 3b. Edificios individuales del barrio entero a alto zoom. Sin
  // atenuación de "otros" — esto es lo que el usuario reclamó: ver el
  // barrio completo como mosaico extruido. Mismo viewport clipping que
  // renderSeccion para escalar con lo VISIBLE (no con los 3000+ totales).
  if (bldgAlpha > 0.01 && b.buildings && b.buildings.length) {
    const W = ctx.canvas.width / state.dpr;
    const H = ctx.canvas.height / state.dpr;
    const margin = 80;
    const visible = [];
    for (const bld of b.buildings) {
      if (!bld._ring || bld._ring.length < 3 || !bld._centroid) continue;
      const [cx, cz] = bld._centroid;
      const [vpx, vpy] = project(cx, 0, cz, view);
      if (vpx < -margin || vpx > W + margin) continue;
      if (vpy < -margin || vpy > H + margin) continue;
      visible.push({ b: bld, key: cx + cz });
    }
    visible.sort((a, c) => a.key - c.key);
    ctx.save();
    ctx.globalAlpha = bldgAlpha;
    // Sombras planas SE 2px primero (z-stack).
    for (const { b: bld } of visible) {
      drawFlatShadow(ctx, bld._ring, view, 2, 2);
    }
    // Archetypes con altura real (height_m).
    for (const { b: bld } of visible) {
      const h = Math.max(3.0, bld.properties.height_m || 6);
      drawArchetype(ctx, bld._ring, h, bld._archetype, view, {
        stroke: 1.5,
        outline: INK
      });
    }
    ctx.restore();
  }

  // ── 4. Outline real del barrio (en ink 3px round) sobre las manzanas
  // para "enmarcar" la pieza activa.
  if (b.barrioRings && b.barrioRings.length) {
    ctx.save();
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (const ring of b.barrioRings) {
      drawRingOutline(ctx, ring, view, 0);
    }
    ctx.restore();
  }

  // ── 5. Labels por manzana DESACTIVADOS (2026-05-19). Los números de
  // building_count no aportaban significado al usuario. La info de la
  // manzana hovered/tapped se mostrará en panel lateral o popover.
  // (placeholder por si en futuro queremos labels semánticos).
}

// Vecinos colindantes nivel barrio. Cada pieza-barrio adyacente se pinta
// como outline finísimo gris (alpha 0.18). Sin extrusión, sin fill.
function drawBarrioNeighbors(ctx, b, view) {
  const neigh = b.neighborBarrios;
  if (!neigh || !neigh.length) return;
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.lineWidth = 1.0;
  ctx.strokeStyle = INK;
  ctx.lineJoin = "round";
  for (const nb of neigh) {
    for (const ring of nb.rings) {
      drawRingOutline(ctx, ring, view, 0);
    }
  }
  ctx.restore();
}

// v1.6.manzana (Phase 2b) — Render del nivel manzana. Quinto y último
// LOD visible (el "edificio focal" queda como hook tap, no como nivel).
//
// Lo que se pinta:
//   1. Vecinos del barrio en gris desaturado como contexto (resto de
//      manzanas + edificios del barrio que no son la manzana focal).
//   2. Outline de la manzana focal (sin fill o muy translúcido).
//   3. Edificios de la manzana focal como archetypes a tamaño grande
//      (el zoom 3.5× los hace bien visibles y tappables en móvil).
//   4. Label flotante "Manzana N · X edificios" centrada arriba.
function renderManzana(ctx, state) {
  const view = state.view;
  const m = state.manzana;
  if (!m) return;

  // 2026-05-24 — Backdrop completo: aunque el zoom es muy cerrado en
  // manzana, conservar la silueta del mun + barrio + costa al fondo da
  // sensación de "el mapa sigue ahí". Sin esto la manzana flotaba en vacío.
  drawIslaBackdrop(ctx, state);
  drawMunBackdrop(ctx, state);

  // 1. Contexto fade-to-context. Pancho v1.6.fade: cuando entras a una
  // manzana el resto del barrio debe seguir visible — "es raro vivir en
  // una ciudad y no verlos". Manzanas vecinas como polígono plano con
  // alpha bajo; edificios vecinos como footprint OCRE_LT con stroke ink
  // suficiente para que se lean como tejido urbano a este zoom.
  if (state.barrio) {
    ctx.save();
    // Manzanas vecinas: outline ink + fill OCRE_LT muy translúcido.
    ctx.globalAlpha = 0.30;
    for (const mz of state.barrio.manzanas) {
      if (mz._cusec === m.cusec && mz.properties.id === m.manzanaId) continue;
      fillRing(ctx, mz._ringSimple, view,
               "rgba(217,181,138,0.45)",
               "rgba(26,22,18,0.85)", 1.0);
    }
    // Edificios vecinos: footprint plano OCRE_LT con stroke ink visible.
    // Sin extrusión para mantener barato el render (>1000 buildings).
    ctx.globalAlpha = 0.30;
    for (const b of state.barrio.buildings) {
      if (b._cusec === m.cusec && b.properties.manzana_id === m.manzanaId) continue;
      const ring = b._ring;
      if (!ring || ring.length < 3) continue;
      drawFootprint(ctx, ring, view, OCRE_LT, "rgba(26,22,18,0.95)", 1.0);
    }
    ctx.restore();
  }

  // 2. Outline de la manzana focal. Stroke ink grueso, fill muy
  // translúcido (paper_warm 12%) — sirve como "suelo" del módulo.
  fillRing(ctx, m.feature._ringSimple || m.geometry, view,
           "rgba(245,232,200,0.30)", INK, 3);

  // 3. Edificios focales como archetypes grandes. Sombras planas
  // primero (mismo patrón que renderDistrito α3), luego archetypes con
  // stroke grueso (2.5) para que se lean a este zoom.
  for (const b of m.buildings) {
    drawFlatShadow(ctx, b._ring, view, 2.8, 2.8);
  }
  for (const b of m.buildings) {
    const h = Math.max(3.0, b.properties.height_m || 6);
    drawArchetype(ctx, b._ring, h, b._archetype, view, {
      stroke: 2.5,
      outline: INK
    });
  }

  // 4. Label flotante centrada arriba. Usa el centroide world-coord de
  // la manzana proyectado al canvas; lo desplazamos hacia arriba un
  // offset fijo para no solapar con los edificios.
  const dpr = state.dpr;
  const w = ctx.canvas.width / dpr;
  const labelText = `Manzana ${m.manzanaId} · ${m.buildings.length} edificios`;
  ctx.save();
  ctx.font = "bold 16px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const tx = w / 2;
  const ty = 36;
  // halo + texto
  ctx.lineWidth = 5;
  ctx.strokeStyle = INK;
  ctx.strokeText(labelText, tx, ty);
  ctx.fillStyle = "#F0DDB4";
  ctx.fillText(labelText, tx, ty);
  ctx.restore();
}

// v1.5.2 — Vecinos colindantes nivel distrito.
//
// Cada distrito vecino se pinta como conjunto de polígonos-sección con:
//   - relleno desaturado (60% paper_warm + 40% color de densidad)
//   - sin sombra
//   - stroke ink 2 px (más fino que el activo)
//   - sin label flotante
// Se renderizan ANTES del distrito activo para que queden por debajo.
// Tap sobre estos polígonos dispara enterDistrito(vecino) con slide
// lateral (manejado en handleTap → app.js).
function drawDistritoNeighbors(ctx, d, view) {
  const neigh = d.neighborDistricts;
  if (!neigh || !neigh.length) return;

  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.lineJoin = "round";
  for (const nd of neigh) {
    for (const s of nd.secciones) {
      const bc = s._buildingCount || 0;
      // Color base según densidad (mismas franjas que el distrito activo
      // pero usando terciles del propio distrito vecino sería costoso;
      // como aproximación usamos los terciles del distrito activo, ya
      // que el efecto buscado es "asomar", no precisión cromática).
      const t1 = d.secStats?.t1 ?? 0;
      const t2 = d.secStats?.t2 ?? 0;
      const base = bc <= t1 ? SAND : bc <= t2 ? OCRE_LT : OCRE;
      // Desaturación 60% paper_warm + 40% base
      const fill = mixColor(PAPER_WARM, base, 0.4);
      fillRing(ctx, s._ringSimple, view, fill, INK, 2);
    }
  }
  ctx.restore();
}

// Mezcla dos colores hex en proporción t (0..1) — devuelve hex.
function mixColor(c1, c2, t) {
  const a = parseHex(c1), b = parseHex(c2);
  const r = Math.round(a[0] * (1 - t) + b[0] * t);
  const g = Math.round(a[1] * (1 - t) + b[1] * t);
  const bb = Math.round(a[2] * (1 - t) + b[2] * t);
  return `rgb(${r},${g},${bb})`;
}
function parseHex(h) {
  const x = h.replace("#", "");
  return [parseInt(x.slice(0, 2), 16),
          parseInt(x.slice(2, 4), 16),
          parseInt(x.slice(4, 6), 16)];
}

// PASO 1 del LOD distrito (v1.6c — "secciones como bloques de mosaico").
// Cada sección se renderiza como un bloque iso individual con un color
// estable derivado del CUSEC (hash → índice en SECTION_PALETTE). Al
// hover (`state.hoveredSeccionCusec`) o tap (`state.selectedSeccionCusec`)
// la sección se "ilumina": liftPx + anillo accent_naranja, y techo
// reforzado con tono más saturado. Sin LOD: el zoom-in ya no desciende
// a manzanas/edificios (computeLodBlendDistrito → α1=1 siempre).
//
// La altura sigue siendo proporcional a la densidad de edificios para
// que el relieve transmita la realidad urbanística, pero el color ya
// no codifica densidad — codifica IDENTIDAD de sección.

// Paleta cálida de 12 tonos para diferenciar secciones adyacentes.
// Mezcla sands, ocres y tierras dentro de la familia visual del
// runtime (Into the Breach). Hash estable: la misma sección recibe
// el mismo color entre sesiones.
const SECTION_PALETTE = [
  "#D9B58A", "#C89968", "#A37945", "#E2C99A",
  "#F0DDB4", "#B89D6E", "#B0876C", "#9C7A56",
  "#D4A87C", "#C09574", "#A88A66", "#BFAA88"
];

function _hashCusec(cusec) {
  let h = 0;
  for (let i = 0; i < cusec.length; i++) {
    h = ((h << 5) - h + cusec.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function _colorForSeccion(cusec) {
  return SECTION_PALETTE[_hashCusec(cusec) % SECTION_PALETTE.length];
}

function _lighten(hex, amt) {
  // amt in [0,1] mezcla hacia blanco
  const [r, g, b] = parseHex(hex);
  return `rgb(${Math.round(r + (255 - r) * amt)},${Math.round(g + (255 - g) * amt)},${Math.round(b + (255 - b) * amt)})`;
}

function drawDistritoSecciones(ctx, d, view, selectedCusec, hoveredCusec) {
  // Sombras planas SE (3 px).
  for (const s of d.secciones) {
    drawFlatShadow(ctx, s._ringSimple, view, 3, 3);
  }

  // Las secciones seleccionada / hovered se dibujan AL FINAL para
  // quedar visualmente por encima de sus vecinas (lift + anillo).
  const deferred = [];

  for (const s of d.secciones) {
    const cusec = s.properties.cusec;
    if (cusec === selectedCusec || cusec === hoveredCusec) {
      deferred.push(s);
      continue;
    }
    const bc = s._buildingCount || 0;
    const color = _colorForSeccion(cusec);
    const hUse = Math.max(3, Math.min(22, Math.pow(Math.max(bc, 1), 0.42) * 1.6));
    drawIsoTile(ctx, s._ringSimple, hUse, color, view, {
      stroke: 1.5,
      sideColor: OCRE_DK
    });
  }

  // Render diferido: secciones iluminadas.
  for (const s of deferred) {
    const cusec = s.properties.cusec;
    const isSelected = cusec === selectedCusec;
    const baseColor = _colorForSeccion(cusec);
    // Selected: lighten 35 % + lift 5 + anillo accent_naranja grueso.
    // Hovered (no selected): lighten 18 % + lift 2 + anillo blanco fino.
    const lightFactor = isSelected ? 0.35 : 0.18;
    const color = _lighten(baseColor, lightFactor);
    const bc = s._buildingCount || 0;
    const hUse = Math.max(3, Math.min(22, Math.pow(Math.max(bc, 1), 0.42) * 1.6));
    drawIsoTile(ctx, s._ringSimple, hUse, color, view, {
      stroke: 1.5,
      sideColor: isSelected ? "#8B5A2B" : OCRE_DK,
      liftPx: isSelected ? 5 : 2,
      ringColor: isSelected ? ACCENT_NARANJA : "#FFFFFF",
      ringW: isSelected ? 4 : 2.5
    });
  }

  // Contorno bbox del distrito como referencia (ink 6 px). Es un rect
  // por simplicidad — más fiable que computar la unión geométrica de
  // las secciones (que tendría agujeros y muchos vértices).
  if (d.districtOutline) {
    ctx.save();
    ctx.lineWidth = 6;
    ctx.strokeStyle = INK;
    ctx.lineJoin = "round";
    ctx.beginPath();
    const r = d.districtOutline;
    for (let i = 0; i < r.length; i++) {
      const [px, py] = project(r[i][0], 0, r[i][1], view);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
