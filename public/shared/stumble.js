// shared/stumble.js — Motor de descubrimiento estilo StumbleUpon.
//
// Genérico, reutilizado por agora-app y biblioteca-app. Dos piezas puras:
//
//   pickStumble(ranked, opts)        → elige UN resultado por muestreo
//                                       aleatorio ponderado del cuartil
//                                       superior (serendipia controlada).
//   aprenderDeFeedback(sliders, ...) → empuja los sliders hacia (o en
//                                       contra de) el perfil del item según
//                                       el pulgar. Devuelve el diff para que
//                                       la UI lo muestre — NADA es opaco.
//
// Filosofía: en StumbleUpon clásico el pulgar entrenaba una caja negra.
// Aquí el pulgar mueve TUS sliders y lo ves moverse. "Crear tu algoritmo"
// emerge de tus stumbles, pero transparente y reversible.

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }

// id estable de un resultado de rank() (envuelve un item).
function idDe(res) {
  return (res && res.item && (res.item.id != null)) ? String(res.item.id) : null;
}

// Muestreo ponderado: devuelve un índice de `pesos` con probabilidad
// proporcional al peso. Pesos deben ser ≥ 0.
function muestreoPonderado(pesos) {
  let total = 0;
  for (const p of pesos) total += (p > 0 ? p : 0);
  if (total <= 0) return 0;
  let r = Math.random() * total;
  for (let i = 0; i < pesos.length; i++) {
    r -= (pesos[i] > 0 ? pesos[i] : 0);
    if (r <= 0) return i;
  }
  return pesos.length - 1;
}

// -----------------------------------------------------------
// pickStumble(ranked, opts) → resultado de rank() | null
//
// ranked: array de { item, score, razon, contribuciones } (salida de rank()).
// opts:
//   serendipia: 0..1   — 0 = casi determinista (top 10%), 1 = todo el pool.
//   vistos: Set<id>    — ids ya mostrados en esta sesión de stumble; se
//                        evitan hasta agotar el pool (entonces se resetea).
//
// Estrategia: del pool no-visto, tomamos el cuartil cuyo ancho crece con
// la serendipia, y muestreamos ponderando por score (los de más score
// son más probables, pero no garantizados — eso es la serendipia).
export function pickStumble(ranked, opts = {}) {
  if (!Array.isArray(ranked) || ranked.length === 0) return null;
  const serendipia = clamp(typeof opts.serendipia === "number" ? opts.serendipia : 0.5, 0, 1);
  const vistos = (opts.vistos instanceof Set) ? opts.vistos : new Set();

  let pool = ranked.filter(r => {
    const id = idDe(r);
    return id === null || !vistos.has(id);
  });
  // Pool agotado → reiniciamos el ciclo de descubrimiento.
  if (pool.length === 0) {
    vistos.clear();
    pool = ranked.slice();
  }

  // Ancho del cuartil: serendipia 0 → 10% superior; 1 → 100%.
  const frac = lerp(0.10, 1.0, serendipia);
  const n = Math.max(1, Math.ceil(pool.length * frac));
  const top = pool.slice(0, n);

  // Pesos por score. Infinity (misiones) → peso alto finito. Desplazamos
  // a positivo porque los scores pueden ser negativos.
  //
  // opts.boost(res) → multiplicador opcional (default 1). Lo usan los
  // intereses del onboarding: items que casan con lo que marcaste pesan
  // más, así "reproducir contenido sobre eso" funciona desde el primer
  // stumble, antes incluso de tocar un pulgar.
  const boost = (typeof opts.boost === "function") ? opts.boost : null;
  const pesos = top.map(r => {
    const s = (r.score === Infinity) ? 1000 : (typeof r.score === "number" ? r.score : 0);
    let w = Math.max(0.01, s + 2);
    if (boost) {
      const m = boost(r);
      if (typeof m === "number" && m > 0) w *= m;
    }
    return w;
  });
  const idx = muestreoPonderado(pesos);
  const elegido = top[idx] || top[0] || null;

  if (elegido) {
    const id = idDe(elegido);
    if (id !== null) vistos.add(id);
  }
  return elegido;
}

// -----------------------------------------------------------
// aprenderDeFeedback(sliders, item, signo, rate) → { sliders, diff }
//
// signo: +1 (me gusta) / -1 (no me gusta).
// rate:  tamaño del paso por pulgar (Ágora ~0.10, Biblioteca ~0.05).
//
// Para cada dimensión que el item puntúa (dims[dim] ≠ 0), empujamos el
// slider en la dirección signo*sign(dim_score). Es un gradiente simple:
// "me gustó algo crítico-horizontal" → sube crítico y horizontal.
//
// Devuelve el diff real aplicado (tras clamp a [-1,1]) para que la UI
// pueda mostrar "subí X ★, bajé Y ★" — la transparencia es el punto.
export function aprenderDeFeedback(sliders, item, signo, rate = 0.08) {
  const nuevos = { ...(sliders || {}) };
  const diff = {};
  const dims = (item && item.dims) || {};
  const s = signo >= 0 ? 1 : -1;

  for (const dimId of Object.keys(nuevos)) {
    const v = dims[dimId];
    if (typeof v !== "number" || v === 0) continue;
    const delta = rate * s * Math.sign(v);
    const antes = nuevos[dimId];
    const despues = clamp(antes + delta, -1, 1);
    const real = despues - antes;
    if (Math.abs(real) > 0.0001) {
      nuevos[dimId] = despues;
      diff[dimId] = real;
    }
  }
  return { sliders: nuevos, diff };
}

// -----------------------------------------------------------
// Helper de presentación: texto legible del diff de aprendizaje.
// dimsMeta: { dimId: { polos:[neg,pos], label } } para nombrar los polos.
// Devuelve algo como "subí crítico ★, bajé cerca ★" o "" si vacío.
export function describirDiff(diff, dimsMeta) {
  const partes = [];
  for (const [dimId, delta] of Object.entries(diff || {})) {
    const meta = dimsMeta && dimsMeta[dimId];
    let etiqueta = dimId;
    if (meta && Array.isArray(meta.polos) && meta.polos.length === 2) {
      // El polo hacia el que nos movemos depende del signo del nuevo valor
      // acumulado; aquí usamos el signo del delta como aproximación visible.
      etiqueta = delta >= 0 ? meta.polos[1] : meta.polos[0];
    }
    const verbo = delta >= 0 ? "subí" : "bajé";
    partes.push(`${verbo} ${etiqueta}`);
  }
  return partes.join(", ");
}

// === Ejemplo de uso ===
// import { pickStumble, aprenderDeFeedback, describirDiff } from "./stumble.js";
// const ranked = rank(estado, items);
// const vistos = new Set();
// const res = pickStumble(ranked, { serendipia: 0.6, vistos });
// // usuario pulsa ❤:
// const { sliders, diff } = aprenderDeFeedback(estado.sliders, res.item, +1, 0.10);
// const aviso = describirDiff(diff, DIMS);  // "subí crítico, subí horizontal"
