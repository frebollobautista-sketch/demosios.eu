// shared/loops.js — Eventos de cierre ("fines reales") derivados del
// historial de gestos. NO es un módulo de gestos sobre sujetos (eso es
// gestos.js); es la capa que detecta CIERRES de bucle a partir de lo
// que el usuario ya ha hecho.
//
// Cada función recibe el array de gestos del usuario (vía
// getAllGestos() de shared/gestos.js) y devuelve la lista de eventos
// de cierre detectados. Son funciones puras: no escriben, no notifican
// — la UI decide cuándo consultarlas y cómo recompensar.
//
// Vocabulario de "fines reales":
//
//   POLIS / ÁGORA
//   ──────────────
//   F3 apertura_tejido   primer gesto con una contraparte (entidad o
//                        zona) con la que el usuario nunca había
//                        interactuado antes.
//   F4 reciprocidad      gesto recurrente con la misma contraparte
//                        dentro de una ventana temporal — relación
//                        sostenida, no flash.
//   F1 encuentro         (futuro, requiere identidad) dos personas
//                        co-firman un gesto bilateral.
//   F2 quorum_alcanzado  (futuro, requiere mision_barrio) convocatoria
//                        llega al umbral firmado.
//
//   BIBLIOTECA
//   ──────────
//   G1 dominio_retenido  epígrafe sobrevive 30d en spaced repetition
//                        sin caer por debajo del umbral de retención.
//   G2 sintesis          (emitido por usuario en biblioteca-app)
//                        nota que cita ≥2 fuentes con ≥1 canónica y
//                        ≥1 crítica. Se detecta aquí para alimentar
//                        el honesty meter.
//   G3 aplicacion_civica (futuro) idea de biblioteca usada en gesto
//                        POLIS — bridge entre apps.
//   G4 transmision       (futuro, requiere identidad) explicas un
//                        epígrafe/fuente a otra persona.
//
// Política: estas funciones son SOLO LECTURA del log. El productor de
// recompensas es la UI de cada app. Si una app quiere "marcar como
// recompensado un cierre", lo hace emitiendo un gesto separado
// (compromiso_cumplido con referencia al cierre) — no mutando el log
// histórico.

// -----------------------------------------------------------
// Helpers internos.

// Deriva la "contraparte" de un gesto: identidad estable sobre la que
// el usuario está actuando. Preferimos entidad_id (sujeto concreto)
// porque es más fino y sobrevive a renombrados de zona. Fallback a
// zona — es la única señal cuando el gesto recae sobre un espacio
// público sin id propio (ej.: una calle, una plaza sin registro).
function contraparteDe(g) {
  const eid = g?.payload?.entidad_id;
  if (eid) return { id: String(eid), tipo: "entidad" };
  if (g?.zona) return { id: String(g.zona), tipo: "zona" };
  return null;
}

// Parser tolerante de ts ISO. Devuelve milisegundos o NaN.
function tsMs(g) {
  if (!g?.ts) return NaN;
  const t = Date.parse(g.ts);
  return Number.isFinite(t) ? t : NaN;
}

const DIA_MS = 24 * 60 * 60 * 1000;

// -----------------------------------------------------------
// F3 — Apertura de tejido.
//
// Primer gesto del usuario con una contraparte nunca tocada antes.
// Una entrada por contraparte (la PRIMERA cronológicamente). Excluye
// gestos marcados como falsos por moderación.

export function detectarAperturasTejido(gestos) {
  if (!Array.isArray(gestos)) return [];

  // Ordenamos por ts ascendente para que el "primer gesto" sea estable
  // independientemente del orden de entrada.
  const orden = gestos
    .filter(g => g && g.falso !== true)
    .map(g => ({ g, t: tsMs(g) }))
    .filter(x => Number.isFinite(x.t))
    .sort((a, b) => a.t - b.t);

  const vistos = new Set();
  const out = [];
  for (const { g } of orden) {
    const cp = contraparteDe(g);
    if (!cp) continue;
    // Clave compuesta tipo+id para no colisionar entidad↔zona homónimas.
    const key = cp.tipo + ":" + cp.id;
    if (vistos.has(key)) continue;
    vistos.add(key);
    out.push({
      contraparte_id: cp.id,
      contraparte_tipo: cp.tipo,
      primer_gesto_ts: g.ts,
      gesto_ref: g
    });
  }
  return out;
}

// -----------------------------------------------------------
// F4 — Reciprocidad.
//
// Misma contraparte ≥3 veces dentro de una ventana móvil de N días,
// con span ≥2 días entre el primero y el último de la racha (i.e.
// no vale apilar 3 clicks seguidos en 5 minutos).
//
// Algoritmo: por contraparte, ordenamos gestos por ts y deslizamos
// una ventana de tamaño ventanaDias. Si en algún momento la ventana
// contiene ≥3 gestos y el span entre el primero y el último de la
// ventana es ≥2 días, emitimos UN evento por contraparte (el último
// ts de la primera ventana válida marca el cierre del bucle).

export function detectarReciprocidad(gestos, ventanaDias = 30) {
  if (!Array.isArray(gestos)) return [];

  // Agrupar por contraparte.
  const grupos = new Map();
  for (const g of gestos) {
    if (!g || g.falso === true) continue;
    const t = tsMs(g);
    if (!Number.isFinite(t)) continue;
    const cp = contraparteDe(g);
    if (!cp) continue;
    const key = cp.tipo + ":" + cp.id;
    if (!grupos.has(key)) grupos.set(key, { cp, items: [] });
    grupos.get(key).items.push({ g, t });
  }

  const ventanaMs = ventanaDias * DIA_MS;
  const minSpanMs = 2 * DIA_MS;
  const out = [];

  for (const [, { cp, items }] of grupos) {
    if (items.length < 3) continue;
    items.sort((a, b) => a.t - b.t);

    // Ventana deslizante: por cada item j, retraemos i hasta que
    // (t[j]-t[i]) ≤ ventanaMs. Si la ventana [i..j] tiene ≥3 puntos
    // y (t[j]-t[i]) ≥ minSpanMs, hay reciprocidad.
    let i = 0;
    let matched = null;
    for (let j = 0; j < items.length; j++) {
      while (items[j].t - items[i].t > ventanaMs) i++;
      const count = j - i + 1;
      const span = items[j].t - items[i].t;
      if (count >= 3 && span >= minSpanMs) {
        matched = { i, j };
        break;
      }
    }
    if (!matched) continue;

    const ini = matched.i;
    const fin = matched.j;
    const span_dias = (items[fin].t - items[ini].t) / DIA_MS;
    out.push({
      contraparte_id: cp.id,
      contraparte_tipo: cp.tipo,
      recurrencias: fin - ini + 1,
      span_dias: Math.round(span_dias * 100) / 100,
      ultimo_ts: items[fin].g.ts
    });
  }
  return out;
}

// -----------------------------------------------------------
// G1 — Dominio retenido (esqueleto).
//
// Pendiente: el scheduler SRS vive en biblioteca-app y todavía no
// existe. Cuando exista, srsState será un map { epigrafe_id → {
// intervalo_dias, ultimo_review_ts, aciertos_consecutivos, ... } } y
// esta función filtrará los epígrafes que llevan ≥30d en intervalo
// largo sin fallo. Forma de retorno congelada para que la UI pueda
// codear contra ella ya.

export function detectarDominioRetenido(/* srsState */) {
  // TODO biblioteca-app: implementar cuando exista el scheduler SRS.
  // Retorno esperado:
  //   [{ epigrafe_id, intervalo_dias, ultimo_review_ts }]
  return [];
}

// -----------------------------------------------------------
// G2 — Síntesis.
//
// Gesto de tipo "sintesis" cuyo payload.fuentes es array de
// {id, origen} con ≥2 entradas, al menos una con origen "canonico"
// y al menos una con origen "critico". Excluye gestos falsos.

export function detectarSintesis(gestos) {
  if (!Array.isArray(gestos)) return [];

  const out = [];
  for (const g of gestos) {
    if (!g || g.falso === true) continue;
    if (g.tipo !== "sintesis") continue;
    const fuentes = g.payload?.fuentes;
    if (!Array.isArray(fuentes) || fuentes.length < 2) continue;

    // Validamos forma de cada fuente y recogemos los orígenes.
    let okForma = true;
    let tieneCanonico = false;
    let tieneCritico = false;
    for (const f of fuentes) {
      if (!f || typeof f !== "object" || !f.id || !f.origen) {
        okForma = false;
        break;
      }
      if (f.origen === "canonico") tieneCanonico = true;
      if (f.origen === "critico") tieneCritico = true;
    }
    if (!okForma) continue;
    if (!tieneCanonico || !tieneCritico) continue;

    out.push({
      gesto_ref: g,
      n_fuentes: fuentes.length,
      ts: g.ts
    });
  }
  return out;
}

// -----------------------------------------------------------
// Honesty meter — ratio de compromisos cumplidos en ventana.
//
// Filosofía: la honestidad NO es "cumple todo lo que promete" (eso es
// sobrerrendimiento, indica que te comprometes a menos de lo que
// puedes). Tampoco es "promete y no cierra" (vapor). Sweet spot
// empírico: 50-75% de cierre. Verde dentro, ámbar fuera.
//
// Convención: gesto "compromiso" abre, gesto "compromiso_cumplido"
// cierra y lleva payload.compromiso_ref apuntando al ts (o id) del
// compromiso original. La ventana se mide sobre el ts del compromiso
// abierto (si el compromiso entra en la ventana, también cuenta su
// cierre aunque caiga fuera — un compromiso cerrado tarde sigue
// siendo cerrado).

export function honestyMeter(gestos, ventanaDias = 30) {
  if (!Array.isArray(gestos)) {
    return { abiertas: 0, cerradas: 0, ratio: null, banda: "ambar" };
  }

  const ahora = Date.now();
  const ventanaMs = ventanaDias * DIA_MS;
  const desde = ahora - ventanaMs;

  // Index de cierres por referencia, para vincular cierre→apertura.
  // Tolerante a dos formatos de ref: por ts ISO o por id explícito.
  const cierresPorRef = new Map();
  for (const g of gestos) {
    if (!g || g.falso === true) continue;
    if (g.tipo !== "compromiso_cumplido") continue;
    const ref = g.payload?.compromiso_ref;
    if (!ref) continue;
    cierresPorRef.set(String(ref), g);
  }

  let abiertas = 0;
  let cerradas = 0;
  for (const g of gestos) {
    if (!g || g.falso === true) continue;
    if (g.tipo !== "compromiso") continue;
    const t = tsMs(g);
    if (!Number.isFinite(t)) continue;
    if (t < desde) continue;       // fuera de ventana
    abiertas++;
    // La referencia natural al compromiso es su ts (único en el log).
    // Algunos call sites podrían usar un id en payload; soportamos
    // ambos.
    const refTs = g.ts;
    const refId = g.payload?.id;
    if (cierresPorRef.has(refTs) || (refId && cierresPorRef.has(String(refId)))) {
      cerradas++;
    }
  }

  const total = abiertas;  // "abiertas" = compromisos contraídos en ventana
  if (total === 0) {
    return { abiertas: 0, cerradas: 0, ratio: null, banda: "ambar" };
  }
  const ratio = cerradas / total;
  const banda = (ratio >= 0.5 && ratio <= 0.75) ? "verde" : "ambar";
  return { abiertas, cerradas, ratio, banda };
}

// =============================================================
// VERIFICACIÓN — ejemplo de uso con gestos sintéticos.
//
// Pegar en consola tras importar el módulo para validar a ojo. No es
// un test runner; es documentación ejecutable mientras no haya harness.
//
// import * as L from "./shared/loops.js";
//
// const hoy = Date.now();
// const dia = 24*60*60*1000;
// const iso = (offsetDias) => new Date(hoy - offsetDias*dia).toISOString();
//
// const gestos = [
//   // Apertura: primer contacto con cooperativa X.
//   { tipo: "senal", userId: "u_a", payload: { entidad_id: "coop_X", valor: 1 }, zona: "vegueta", ts: iso(40) },
//   // Reciprocidad con coop_X: 3 gestos repartidos en 12 días.
//   { tipo: "senal", userId: "u_a", payload: { entidad_id: "coop_X", valor: 1 }, zona: "vegueta", ts: iso(30) },
//   { tipo: "check_in", userId: "u_a", payload: { entidad_id: "coop_X" }, zona: "vegueta", ts: iso(20) },
//   // Apertura con zona "triana" (sin entidad_id).
//   { tipo: "senal", userId: "u_a", payload: { valor: 1 }, zona: "triana", ts: iso(15) },
//   // Gesto falso — debería ignorarse.
//   { tipo: "senal", userId: "u_a", payload: { entidad_id: "coop_Y" }, zona: "telde", ts: iso(10), falso: true },
//   // Síntesis válida (canónico + crítico).
//   { tipo: "sintesis", userId: "u_a",
//     payload: { fuentes: [
//       { id: "marx_capital", origen: "canonico" },
//       { id: "graeber_debt", origen: "critico" }
//     ] }, ts: iso(8) },
//   // Síntesis inválida — sólo canónicos, no se emite.
//   { tipo: "sintesis", userId: "u_a",
//     payload: { fuentes: [
//       { id: "republicanismo_pettit", origen: "canonico" },
//       { id: "kant_paz_perpetua",    origen: "canonico" }
//     ] }, ts: iso(7) },
//   // Compromiso abierto sin cerrar (dentro de ventana).
//   { tipo: "compromiso", userId: "u_a", payload: { texto: "voy al mercadillo" }, ts: iso(20) },
//   // Compromiso abierto + cerrado.
//   { tipo: "compromiso", userId: "u_a", payload: { texto: "leo el manifiesto" }, ts: iso(15) },
//   { tipo: "compromiso_cumplido", userId: "u_a",
//     payload: { compromiso_ref: iso(15) }, ts: iso(5) }
// ];
//
// L.detectarAperturasTejido(gestos);
//   // → 2 eventos: coop_X (ts -40d, tipo entidad) y triana (ts -15d, tipo zona).
// L.detectarReciprocidad(gestos);
//   // → 1 evento: coop_X, recurrencias 3, span_dias ~20, ultimo_ts iso(-20d).
// L.detectarSintesis(gestos);
//   // → 1 evento (la primera; la segunda falla por falta de "critico").
// L.honestyMeter(gestos, 30);
//   // → { abiertas: 2, cerradas: 1, ratio: 0.5, banda: "verde" }.
// L.detectarDominioRetenido();
//   // → [] (esqueleto, SRS aún no existe).
