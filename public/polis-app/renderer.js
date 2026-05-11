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
import { drawArchetype } from "./archetypes.js";

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
//
// Paso 1 (entry zoom, default): polígonos-sección coloreados por
//   densidad. Sin manzanas, sin edificios.
// Paso 2 (mid zoom): cross-fade entre regiones-sección y manzanas-tile.
// Paso 3 (high zoom): cross-fade entre manzanas-tile y edificios.
//
// Thresholds elegidos para que entry zoom (ratio ≈ 1.45) caiga en paso 1
// puro y haya margen para zoomear in:
//   - T1 = 2.2× fitScale → cruce hacia manzanas (entry queda <T1-r=1.85)
//   - T2 = 4.0× fitScale → cruce hacia edificios
// Cross-fades: ventana ±0.35 alrededor de cada threshold ≈ 300ms
// percibidos (depende de la velocidad del usuario al zoomear).
export const DISTRITO_T1 = 2.2;
export const DISTRITO_T2 = 4.0;
export const DISTRITO_BLEND = 0.35;

export function computeLodBlendDistrito(view) {
  const ratio = view.scale / view.fitScale;
  // Alphas para los tres pasos. Suman ≤1 en transiciones, =1 en los
  // tramos estables. Devuelve { alpha1, alpha2, alpha3 } donde:
  //   alpha1 = peso de regiones-sección (paso 1)
  //   alpha2 = peso de manzanas-tile    (paso 2)
  //   alpha3 = peso de edificios        (paso 3)
  const r = DISTRITO_BLEND;
  // Mezcla 1→2 en torno a T1
  let mix12;
  if (ratio <= DISTRITO_T1 - r) mix12 = 0;
  else if (ratio >= DISTRITO_T1 + r) mix12 = 1;
  else mix12 = (ratio - (DISTRITO_T1 - r)) / (2 * r);
  // Mezcla 2→3 en torno a T2
  let mix23;
  if (ratio <= DISTRITO_T2 - r) mix23 = 0;
  else if (ratio >= DISTRITO_T2 + r) mix23 = 1;
  else mix23 = (ratio - (DISTRITO_T2 - r)) / (2 * r);
  return {
    alpha1: 1 - mix12,
    alpha2: mix12 * (1 - mix23),
    alpha3: mix23,
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

  if (state.lodLevel === "isla") {
    renderIsla(ctx, state);
  } else if (state.lodLevel === "municipio") {
    renderMunicipio(ctx, state);
  } else if (state.lodLevel === "distrito") {
    renderDistrito(ctx, state);
  } else {
    renderSeccion(ctx, state);
  }

  if (slideActive) {
    ctx.restore();
  }

  if (state._lodPillEl) {
    const label =
      state.lodLevel === "isla" ? "LOD: isla" :
      state.lodLevel === "municipio" ? "LOD: municipio" :
      state.lodLevel === "distrito" ? "LOD: distrito" :
      "LOD: sección";
    if (state._lastLodLabel !== label) {
      state._lodPillEl.textContent = label;
      state._lastLodLabel = label;
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

// ==================================================================
// NIVEL ISLA.
// v1.5: plano top-down puro (ax=0, ay=0, sz_factor=0). Corrige el bug de
// v1.4 donde ax=0/ay=90 colapsaba la coordenada vertical y estiraba GC en
// el eje este-oeste. La silueta se reconoce ahora "como en Google Maps".
// Polígonos planos rellenos por color de densidad. Trazo ink 4 px. Sin
// extrusión, sin sombra. Costa azul si está cargada (lazy).

function renderIsla(ctx, state) {
  const { municipios, t1, t2 } = state.isla;

  // Costa: línea fina azul-grisácea sobre el fondo paper_warm. Se carga
  // bajo demanda — la primera vez disparamos la fetch y volvemos a render
  // cuando llegue.
  if (!state.isla.coastline && !state.isla._loadingCoast) {
    state.isla._loadingCoast = true;
    fetch("../osm-gc/coastline.json")
      .then(r => r.json())
      .then(fc => {
        const features = (fc.features || []).filter(f =>
          f.geometry && (f.geometry.type === "LineString" ||
                         f.geometry.type === "MultiLineString"));
        // Pre-proyectamos a metros locales (anclados al centro de GC).
        const ANCH = [-15.55, 28.05];
        const M_LAT = 111132.0;
        const M_LNG = 111320.0 * Math.cos(ANCH[1] * Math.PI / 180);
        const lines = [];
        for (const f of features) {
          const conv = (coords) => coords.map(([lng, lat]) =>
            [(lng - ANCH[0]) * M_LNG, -(lat - ANCH[1]) * M_LAT]);
          if (f.geometry.type === "LineString") lines.push(conv(f.geometry.coordinates));
          else for (const seg of f.geometry.coordinates) lines.push(conv(seg));
        }
        state.isla.coastline = lines;
        if (state._requestRender) state._requestRender();
      })
      .catch(() => { state.isla.coastline = []; });
  }
  if (state.isla.coastline) {
    ctx.save();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = COSTA;
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

  // Polígonos de municipio — planos, color por densidad.
  for (const m of municipios) {
    const sc = m.properties.sections_count || 0;
    const color = sc <= t1 ? SAND : sc <= t2 ? OCRE_LT : OCRE;
    fillRing(ctx, m._ringSimple, state.view, color, INK, 4);
  }

  // Etiquetas centradas en el centroide de cada mun.
  ctx.save();
  for (const m of municipios) {
    const c = m._centroid;
    const [px, py] = project(c[0], 0, c[1], state.view);
    const txt = shortMunName(m.properties.nmun);
    drawLabel(ctx, txt, [px, py], {
      font: "bold 12px Georgia, serif",
      haloW: 4
    });
  }
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

  // v1.5.2 — Vecinos: muns colindantes como polígonos planos
  // semi-transparentes con stroke ink fino. Se renderizan ANTES del mun
  // activo para quedar por debajo.
  drawMunicipioNeighbors(ctx, state);

  // Sombras de cada sección
  for (const s of mu.secciones) {
    drawFlatShadow(ctx, s._ringSimple, view, 3, 3);
  }
  // Tiles de sección con extrusión MODERADA: height = min(40, sqrt(bc*3)).
  for (const s of mu.secciones) {
    const bc = s._buildingCount;
    const h = Math.min(40, Math.sqrt(Math.max(bc, 1) * 3));
    const color = bc <= mu.bcStats.t1 ? PAPER_WARM
                : bc <= mu.bcStats.t2 ? OCRE_LT
                : OCRE;
    drawIsoTile(ctx, s._ringSimple, Math.max(h, 3), color, view, {
      stroke: 4
    });
  }

  // Calles primary/secondary clipadas al bbox del mun (lazy load global).
  drawMunicipioRoads(ctx, state);

  // Contorno grueso del mun por encima
  ctx.lineWidth = 6;
  ctx.strokeStyle = INK;
  ctx.lineJoin = "round";
  drawRingOutline(ctx, mu.polygon._ringSimple, view, 0);
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
  if (!state._roadsGlobal && !state._loadingRoads) {
    state._loadingRoads = true;
    fetch("../osm-gc/roads.json")
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
        state._roadsGlobal = out;
        if (state._requestRender) state._requestRender();
      })
      .catch(() => { state._roadsGlobal = []; });
  }
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
    ctx.lineWidth = (r.type === "primary" || r.type === "trunk" ||
                     r.type === "motorway") ? 4 : 2.5;
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

  // v1.5.2 — Vecinos de sección: las otras secciones del distrito
  // (state.district.secciones excluyendo la actual) como contornos finos
  // con relleno paper_warm semi-transparente. Se renderizan ANTES de la
  // sección activa para quedar por debajo.
  drawSeccionNeighbors(ctx, state);

  drawRoads(ctx, state);

  const sectionAlpha = 1 - lod.t;
  const manzanaAlpha = lod.t;

  if (sectionAlpha > 0.01) {
    ctx.save();
    ctx.globalAlpha = sectionAlpha;
    drawSectionLOD(ctx, state);
    ctx.restore();
  }
  if (manzanaAlpha > 0.01) {
    ctx.save();
    ctx.globalAlpha = manzanaAlpha;
    drawManzanaLOD(ctx, state);
    ctx.restore();
  }

  drawSongkickCard(ctx, state);
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
  ctx.lineCap = "round";
  for (const f of features) {
    const w = ROAD_WIDTHS[f.properties.type] || 1.5;
    const coords = f.geometry.coordinates;
    if (coords.length < 2) continue;
    ctx.lineWidth = w;
    ctx.strokeStyle = STREET;
    ctx.beginPath();
    for (let i = 0; i < coords.length; i++) {
      const [px, py] = project(coords[i][0], 0, coords[i][1], state.view);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
}

function drawSectionLOD(ctx, state) {
  const manzanas = state.section.manzanas;
  const bloqIds = state.section._bloqIds;

  // Sombras REDUCIDAS: offset 4px (antes 6-8) — Pancho v1.3
  for (const m of manzanas) {
    drawFlatShadow(ctx, m._ringSimple, state.view, 4, 4);
  }
  for (const m of manzanas) {
    const isSelected = state.selectedManzanaId === m.properties.id;
    const color = bloqIds.has(m.properties.id) ? GRIS : OCRE;
    const hUse = Math.max(4.0, m.properties.height_median_m || 6);
    drawIsoTile(ctx, m._ringSimple, hUse, color, state.view, {
      stroke: 4,                    // ← reducido de 5 a 4
      liftPx: isSelected ? 4 : 0,
      ringColor: isSelected ? ACCENT_NARANJA : null,
      ringW: 4
    });
  }
}

function drawManzanaLOD(ctx, state) {
  const buildings = state.section.buildings;
  const manzanas = state.section.manzanas;

  for (const m of manzanas) {
    fillRing(ctx, m._ringSimple, state.view, "rgba(200, 153, 104, 0.18)",
             "rgba(26,22,18,0.35)", 1.5);
  }

  // Sombras edificios: offset reducido
  for (const b of buildings) {
    drawFlatShadow(ctx, b._ring, state.view, 2.5, 2.5);
  }

  // Edificios como mini-piezas iso (stroke 3 mantenido — Pancho v1.3)
  for (const b of buildings) {
    const h = Math.max(3.0, b.properties.height_m || 6);
    drawArchetype(ctx, b._ring, h, b._archetype, state.view, {
      stroke: 2.0,
      outline: INK
    });
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

function renderDistrito(ctx, state) {
  const d = state.district;
  if (!d) return;
  const view = state.view;
  const lod = computeLodBlendDistrito(view);

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

  // PASO 1: regiones-sección coloreadas por densidad.
  // Lo dibujamos siempre que alpha1 > 0 — durante el cross-fade con el
  // paso 2 hace de fondo y desaparece progresivamente.
  if (lod.alpha1 > 0.01) {
    ctx.save();
    ctx.globalAlpha = lod.alpha1;
    drawDistritoSecciones(ctx, d, view);
    ctx.restore();
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
    for (const m of d.manzanas) {
      if (shadowOffset > 0.5) {
        drawFlatShadow(ctx, m._ringSimple, view, shadowOffset, shadowOffset);
      }
    }
    for (const m of d.manzanas) {
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

  // PASO 3: edificios individuales con arquetipos.
  if (lod.alpha3 > 0.01) {
    ctx.save();
    ctx.globalAlpha = lod.alpha3;
    // Manzanas en ocre transparente como base bajo edificios.
    for (const m of d.manzanas) {
      fillRing(ctx, m._ringSimple, view, "rgba(200, 153, 104, 0.18)",
               "rgba(26,22,18,0.28)", 1.2);
    }
    for (const b of d.buildings) {
      drawFlatShadow(ctx, b._ring, view, 2.5, 2.5);
    }
    for (const b of d.buildings) {
      const h = Math.max(3.0, b.properties.height_m || 6);
      drawArchetype(ctx, b._ring, h, b._archetype, view, {
        stroke: 1.6,
        outline: INK
      });
    }
    ctx.restore();
  }
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

// PASO 1 del LOD distrito: dibuja los polígonos-sección coloreados por
// densidad de edificios y un contorno gris-fino del bbox del distrito
// como referencia visual.
function drawDistritoSecciones(ctx, d, view) {
  const t1 = d.secStats?.t1 ?? 0;
  const t2 = d.secStats?.t2 ?? 0;

  // Sombras planas SE (3 px) — sólo visibles si la proyección permite
  // un offset, pero las dibujamos siempre por consistencia.
  for (const s of d.secciones) {
    drawFlatShadow(ctx, s._ringSimple, view, 3, 3);
  }

  // Polígonos sección rellenos por densidad, trazo ink 4 px. Usamos
  // drawIsoTile con un height mínimo: en iso completa habrá un relieve
  // sutil pero el énfasis está en el techo plano coloreado.
  for (const s of d.secciones) {
    const bc = s._buildingCount || 0;
    const color = bc <= t1 ? SAND : bc <= t2 ? OCRE_LT : OCRE;
    // Altura simbólica reducida para que el relieve sea sutil en entry
    // zoom (sz_factor distrito = 1.6, así que un h pequeño basta).
    const hUse = 3.0;
    drawIsoTile(ctx, s._ringSimple, hUse, color, view, { stroke: 4 });
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
