// shared/rank.js — Función de ranking del feed. Pura, auditable,
// reusada por agora-app y biblioteca-app con sets distintos de
// dimensiones.
//
// La filosofía es: el "algoritmo del usuario" es la combinación de
//   (a) sliders         → vector de pesos por dimensión, [-1, +1]
//   (b) misiones abiertas → items prioritarios, fijados arriba
// y NADA más. Sin caja negra. Cada item del feed debe poder explicar
// "estoy aquí porque slider X está en posición Y" o "estoy aquí
// porque cumples misión Z".
//
// Contrato de items:
//   { id, kind, payload, dims: { dim_id: score [-1,+1] }, mision_ref?,
//     novelty?, ts? }
//
// Contrato de estado:
//   { sliders: { dim_id: posicion [-1,+1] },
//     misiones: [misionId, ...],            // ordenado de + antigua a + nueva
//     dimsMeta?: { dim_id: { polos: [neg,pos], label } } }
//
// rank() devuelve los items ordenados con, para cada uno, una
// explicación legible de POR QUÉ está en esa posición. Esa explicación
// alimenta el HUD "← por qué este item".

// -----------------------------------------------------------
// Helper interno: producto sliders · dims con desglose por dimensión.
//
// Devuelve { score, contribuciones } donde contribuciones[dim] es la
// contribución firmada de esa dim al score total (slider * dim_score).
// Sólo entran las dimensiones presentes en AMBOS lados — los sliders
// que el item no puntúa y los dims que el usuario no tiene en el panel
// se ignoran silenciosamente. Esto permite que cada app declare su set
// y que items legacy con menos dimensiones sigan funcionando.
function calcularContribuciones(sliders, dims) {
  const contribuciones = {};
  let score = 0;
  if (!sliders || !dims) return { score, contribuciones };
  for (const dimId of Object.keys(sliders)) {
    const peso = sliders[dimId];
    const valor = dims[dimId];
    if (typeof peso !== "number" || typeof valor !== "number") continue;
    const c = peso * valor;
    contribuciones[dimId] = c;
    score += c;
  }
  return { score, contribuciones };
}

// -----------------------------------------------------------
// rank(estado, items)
//
// Pura, sin side effects. Devuelve los items envueltos en un objeto
// con score, razón y contribuciones por dimensión.
//
// Regla 1: misiones fijadas arriba (score = +Infinity). El orden entre
// ellas respeta el del array estado.misiones — convención: primero =
// más antigua, para forzar cierres en orden de apertura.
//
// Regla 2: resto ordenado por score descendente. Desempate por
// novelty (descendente) y luego por ts (descendente, más reciente
// primero) si está disponible.
export function rank(estado, items) {
  if (!Array.isArray(items)) return [];
  const sliders = (estado && estado.sliders) || {};
  const misiones = (estado && Array.isArray(estado.misiones)) ? estado.misiones : [];

  // Índice misionId → posición (antigüedad). Más bajo = más antigua.
  const ordenMision = new Map();
  misiones.forEach((m, i) => ordenMision.set(m, i));

  // 1ª pasada: anotar cada item con score, contribuciones y razon.
  const anotados = items.map(item => {
    if (item && item.mision_ref && ordenMision.has(item.mision_ref)) {
      return {
        item,
        score: Infinity,
        razon: "misión: " + item.mision_ref,
        contribuciones: {},
        _orden_mision: ordenMision.get(item.mision_ref)
      };
    }
    const { score, contribuciones } = calcularContribuciones(sliders, item && item.dims);
    return {
      item,
      score,
      razon: "",   // se rellena al final con explicar(), para mantener
                   // rank() barato. La UI puede llamar explicar(res, meta)
                   // cuando renderice — pero dejamos una razón mínima.
      contribuciones,
      _orden_mision: null
    };
  });

  // Ordenación estable.
  anotados.sort((a, b) => {
    // Misiones siempre arriba; entre ellas, por antigüedad asc.
    const aMis = a._orden_mision !== null;
    const bMis = b._orden_mision !== null;
    if (aMis && bMis) return a._orden_mision - b._orden_mision;
    if (aMis) return -1;
    if (bMis) return 1;

    // Score descendente.
    if (b.score !== a.score) return b.score - a.score;

    // Desempate por novelty descendente.
    const aN = (a.item && typeof a.item.novelty === "number") ? a.item.novelty : 0;
    const bN = (b.item && typeof b.item.novelty === "number") ? b.item.novelty : 0;
    if (bN !== aN) return bN - aN;

    // Último desempate: ts descendente (más reciente primero). Items
    // sin ts caen al final.
    const aT = (a.item && a.item.ts) ? Date.parse(a.item.ts) : -Infinity;
    const bT = (b.item && b.item.ts) ? Date.parse(b.item.ts) : -Infinity;
    return bT - aT;
  });

  // Rellenar razon usando explicar() para no duplicar lógica de texto.
  // Pasamos dimsMeta del estado si está disponible.
  const dimsMeta = estado && estado.dimsMeta;
  for (const r of anotados) {
    if (!r.razon) r.razon = explicar(r, dimsMeta);
    delete r._orden_mision;
  }
  return anotados;
}

// -----------------------------------------------------------
// explicar(resultado, dimsMeta?)
//
// Genera el texto del HUD "por qué este item".
//
// - Si el item es de misión → "misión: <misionId>" (o título si dimsMeta
//   trae catálogo de misiones; por ahora sólo id, las apps pueden
//   sobrescribir la razon antes de pintar).
// - Si no → toma las 1-2 dimensiones con mayor |contribución| y
//   formatea "<polo> ★★, <polo> ★", eligiendo polos[1] si la
//   contribución es positiva y polos[0] si es negativa.
// - Sin dimsMeta → usa los dimId crudos como etiqueta.
// - Sin contribuciones (todo 0 / vector vacío) → cadena vacía.
export function explicar(resultado, dimsMeta) {
  if (!resultado) return "";

  // Misión: la razon ya viene formada desde rank(). Si la UI llama
  // explicar() de nuevo sobre un resultado de misión, respetamos.
  if (resultado.score === Infinity) {
    return resultado.razon || (resultado.item && resultado.item.mision_ref
      ? "misión: " + resultado.item.mision_ref
      : "misión");
  }

  const contribs = resultado.contribuciones || {};
  const entradas = Object.entries(contribs)
    .filter(([, v]) => typeof v === "number" && v !== 0)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 2);
  if (entradas.length === 0) return "";

  // ★★ para la dim dominante, ★ para la secundaria.
  const estrellas = ["★★", "★"];
  const partes = entradas.map(([dimId, contrib], i) => {
    const meta = dimsMeta && dimsMeta[dimId];
    let etiqueta = dimId;
    if (meta && Array.isArray(meta.polos) && meta.polos.length === 2) {
      etiqueta = contrib >= 0 ? meta.polos[1] : meta.polos[0];
    }
    return etiqueta + " " + estrellas[i];
  });
  return partes.join(", ");
}

// Dimensiones declaradas por cada app. Cada app importa rank.js y
// declara su propio set; rank() no las conoce de antemano. Esto deja
// las apps libres para tener vocabularios distintos.
//
// Ejemplo Ágora (orientativo, lo fija agora-app/sliders.js):
//   DIMS_AGORA = {
//     cercania:     { label: "Cercanía",     polos: ["lejos","cerca"] },
//     conocidos:    { label: "Tejido",       polos: ["nuevo","conocido"] },
//     reaccionar:   { label: "Acción",       polos: ["consumir","convocar"] },
//     temporalidad: { label: "Tiempo",       polos: ["hoy","porvenir"] }
//   }
//
// Ejemplo Biblioteca:
//   DIMS_BIBLIOTECA = {
//     dominio:     { label: "Profundidad",   polos: ["dominio","frontera"] },
//     canonico:    { label: "Voz",           polos: ["canonico","critico"] },
//     compania:    { label: "Compañía",      polos: ["solitario","compartido"] },
//     navegacion:  { label: "Navegación",    polos: ["vertical","horizontal"] }
//   }

// === Ejemplo de uso ===
// import { rank, explicar } from "./rank.js";
//
// const DIMS = {
//   canonico:   { label: "Voz",        polos: ["canonico","critico"] },
//   navegacion: { label: "Navegación", polos: ["vertical","horizontal"] }
// };
// const estado = {
//   sliders: { canonico: +0.8, navegacion: -0.3 },
//   misiones: ["leer_rawls"],
//   dimsMeta: DIMS
// };
// const items = [
//   { id: "a", kind: "epigrafe", dims: { canonico: +0.9, navegacion: +0.2 }, novelty: 0.1 },
//   { id: "b", kind: "epigrafe", dims: { canonico: -0.5, navegacion: -0.9 }, novelty: 0.9 },
//   { id: "c", kind: "tarea",    mision_ref: "leer_rawls" }
// ];
// const ranked = rank(estado, items);
// → esperado: ranked[0].item.id === "c"   (misión fijada arriba)
// → esperado: ranked[1].item.id === "a"   (crítico ★★, score 0.72 - 0.06 = 0.66)
// → esperado: ranked[1].razon === "critico ★★, vertical ★"
