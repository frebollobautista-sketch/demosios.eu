// shared/hud.js — Componente HUD "← por qué este item". Pintar
// junto a cada item del feed una etiqueta corta que explica su
// posición en el ranking. Filosofía: cero caja negra — cualquier
// item, en cualquier momento, sabe decir por qué está donde está.
//
// Este módulo es la capa de PRESENTACIÓN del contrato de rank.js.
// rank() devuelve { item, score, razon, contribuciones }; hud.js
// convierte ese objeto en un <span> dentro del contenedor del item
// y expone explicar() como helper de texto (delegando en rank.js
// cuando hace falta resolverlo desde dimsMeta).
//
// Vanilla ES module, cero dependencias. Las apps lo importan así:
//
//   import { mountHud, HUD_CSS, explicar } from "../shared/hud.js";
//   document.head.insertAdjacentHTML("beforeend",
//     `<style>${HUD_CSS}</style>`);
//   for (const res of ranked) {
//     const el = renderItem(res.item);
//     mountHud(el, res, DIMS_META);
//     feed.appendChild(el);
//   }
//
// La política es deliberadamente austera: monospace gris pequeño,
// nada que compita visualmente con el contenido. El HUD existe para
// que el usuario pueda escanearlo de un vistazo y entender el feed,
// no para presumir de algoritmo.

import { explicar as explicarRanking } from "./rank.js";

// -----------------------------------------------------------
// CSS sugerido. Se exporta como string para que cada app decida si
// lo inyecta como <style> global, lo concatena a su hoja, o lo
// sobrescribe con su propia paleta. No tocamos document.head desde
// aquí — eso sería un side effect oculto.
export const HUD_CSS = `
.hud-razon {
  display: inline-block;
  margin-left: 0.5em;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.8em;
  color: #888;
  white-space: nowrap;
  vertical-align: baseline;
  user-select: none;
}
.hud-razon:empty { display: none; }
`;

// -----------------------------------------------------------
// explicar(resultado, dimsMeta?)
//
// Re-exporta el formateador de rank.js. Lo envolvemos aquí para que
// las apps puedan importar todo el HUD desde un único módulo, sin
// tener que conocer la estructura interna de rank.js.
export function explicar(resultado, dimsMeta) {
  return explicarRanking(resultado, dimsMeta);
}

// -----------------------------------------------------------
// mountHud(container, resultado, dimsMeta?)
//
// Inserta un <span class="hud-razon"> dentro del container con el
// prefijo "← " + explicar(resultado, dimsMeta). Devuelve el nodo
// creado (útil para tests y para reemplazar contenido cuando el
// estado cambie).
//
// Si la razón es cadena vacía (item sin contribuciones legibles —
// por ejemplo sliders a 0 o item sin dims), no inserta nada y
// devuelve null. Esto evita basura visual en feeds nuevos.
//
// Idempotente: si el container ya tiene un .hud-razon hijo directo,
// se actualiza en lugar de duplicar. La UI puede llamar mountHud
// libremente al refrescar.
export function mountHud(container, resultado, dimsMeta) {
  if (!container || !resultado) return null;
  const texto = explicar(resultado, dimsMeta);
  if (!texto) {
    // Si había un HUD previo y ahora no hay razón, lo retiramos
    // para no dejar etiqueta huérfana.
    const previo = container.querySelector(":scope > .hud-razon");
    if (previo) previo.remove();
    return null;
  }
  let span = container.querySelector(":scope > .hud-razon");
  if (!span) {
    span = document.createElement("span");
    span.className = "hud-razon";
    container.appendChild(span);
  }
  span.textContent = "← " + texto;
  // title para que el usuario pueda pasar el ratón y leer la razón
  // completa si la etiqueta se truncó por white-space:nowrap.
  span.title = texto;
  return span;
}

// === Ejemplo de uso ===
// import { rank } from "../shared/rank.js";
// import { mountHud, HUD_CSS } from "../shared/hud.js";
//
// document.head.insertAdjacentHTML("beforeend", `<style>${HUD_CSS}</style>`);
//
// const DIMS = {
//   canonico:   { label: "Voz",        polos: ["canonico","critico"] },
//   navegacion: { label: "Navegación", polos: ["vertical","horizontal"] }
// };
// const estado = {
//   sliders: { canonico: +0.8, navegacion: -0.3 },
//   misiones: [],
//   dimsMeta: DIMS
// };
// const items = [
//   { id: "a", dims: { canonico: +0.9, navegacion: +0.2 } }
// ];
// const ranked = rank(estado, items);
// const card = document.createElement("div");
// mountHud(card, ranked[0], DIMS);
// → esperado: card.querySelector(".hud-razon").textContent === "← critico ★★, vertical ★"
