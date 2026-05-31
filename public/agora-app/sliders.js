// agora-app/sliders.js — Panel del tablero de aficiones (por familia).
//
// El "algoritmo del usuario" dejó de ser 4 sliders posturales: ahora es
// un tablero de TEMAS por familia (hobby / cívico). mountTablero pinta los
// sliders de afinidad de la familia activa + un mando de Descubrimiento.
// Lugar/tiempo/postura NO viven aquí — son chips por-ítem en la tarjeta.
//
// El estado lo posee shared/tablero.js (clave localStorage agora-tablero);
// este módulo solo lo pinta y lo edita. setState() refleja los nudges del
// modo Descubre en los sliders, para que el aprendizaje se VEA.

import {
  FAMILIAS, temasDe, loadTablero, saveTablero
} from "../shared/tablero.js?v=20260529-agora-verde";

export function mountTablero(container, familia, onChange) {
  if (!container) return null;
  const tablero = loadTablero();
  const fam = FAMILIAS[familia] ? familia : "hobby";
  const famState = tablero[fam];
  const temas = temasDe(fam);

  container.innerHTML = "";

  const intro = document.createElement("p");
  intro.className = "tablero-intro";
  intro.textContent = fam === "hobby"
    ? "Sube los temas que te gustan. Tus pulgares en Descubre los afinan."
    : "Sube los temas cívicos que te importan. El «cerca» y el «actuar» viven en cada tarjeta.";
  container.appendChild(intro);

  const grid = document.createElement("div");
  grid.className = "tablero-grid";
  container.appendChild(grid);

  const inputs = {};
  const valSpans = {};
  for (const t of temas) {
    const cell = document.createElement("div");
    cell.className = "slider-cell tablero-cell";

    const label = document.createElement("div");
    label.className = "tablero-cell-label";
    label.textContent = `${t.emoji} ${t.label}`;

    const input = document.createElement("input");
    input.type = "range";
    input.min = "-1"; input.max = "1"; input.step = "0.05";
    input.value = String(famState.sliders[t.id] ?? 0);
    input.setAttribute("aria-label", t.label);

    const val = document.createElement("div");
    val.className = "slider-value";
    val.textContent = Number(input.value).toFixed(2);

    inputs[t.id] = input;
    valSpans[t.id] = val;

    input.addEventListener("input", () => {
      const v = parseFloat(input.value);
      famState.sliders[t.id] = Number.isFinite(v) ? v : 0;
      val.textContent = famState.sliders[t.id].toFixed(2);
      saveTablero(tablero);
      onChange && onChange(tablero);
    });

    cell.append(label, input, val);
    grid.appendChild(cell);
  }

  // Mando de Descubrimiento (serendipia) de la familia.
  const knob = document.createElement("div");
  knob.className = "tablero-knob";
  const kl = document.createElement("div");
  kl.className = "tablero-knob-label";
  kl.textContent = "Descubrimiento";
  const ends = document.createElement("div");
  ends.className = "tablero-knob-ends";
  ends.innerHTML = "<span>seguro</span><span>sorpresa</span>";
  const kInput = document.createElement("input");
  kInput.type = "range";
  kInput.min = "0"; kInput.max = "1"; kInput.step = "0.05";
  kInput.value = String(famState.descubrimiento ?? 0.5);
  kInput.setAttribute("aria-label", "Descubrimiento");
  kInput.addEventListener("input", () => {
    const v = parseFloat(kInput.value);
    famState.descubrimiento = Number.isFinite(v) ? v : 0.5;
    saveTablero(tablero);
    onChange && onChange(tablero);
  });
  knob.append(kl, ends, kInput);
  container.appendChild(knob);

  // setState: aplica un vector de sliders (nudge de Descubre) y lo refleja
  // en los inputs visibles. Solo toca temas conocidos de esta familia.
  function setState(nuevos) {
    if (!nuevos) return;
    for (const t of temas) {
      const v = nuevos[t.id];
      if (typeof v === "number" && Number.isFinite(v)) {
        famState.sliders[t.id] = Math.max(-1, Math.min(1, v));
      }
      if (inputs[t.id]) inputs[t.id].value = String(famState.sliders[t.id]);
      if (valSpans[t.id]) valSpans[t.id].textContent = famState.sliders[t.id].toFixed(2);
    }
    saveTablero(tablero);
    onChange && onChange(tablero);
  }

  function reset() {
    for (const t of temas) famState.sliders[t.id] = 0;
    setState({ ...famState.sliders });
  }

  return {
    getState: () => ({ ...famState.sliders }),
    setState,
    reset,
    familia: fam
  };
}
