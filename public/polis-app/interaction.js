// KOINOS · POLIS — handlers de mouse/touch para pan, zoom y tap.
// Estado mutable se actualiza en `state.view`. Llama a `requestRender()`
// para que app.js redibuje en el próximo frame.
//
// v1.5: añade detección de swipe horizontal en touch para que en nivel
// distrito un swipe izq/dcha navegue al distrito adyacente. El gesto se
// considera swipe (y NO pan) cuando: 1 dedo, recorrido X > 60px, recorrido
// Y < 40px y duración < 600ms. Si no cumple, se trata como pan normal.
//
// [B] v1.6.pinch (2026-05-23) — Pinch-zoom continuo entre niveles.
// Antes: el pinch saturaba a `view.maxScale` y se detenía en seco; al
// soltar, el usuario quedaba "preso" en el nivel actual y necesitaba tap
// para drill-down (o el botón back para subir). En móvil eso se sentía
// como un tope brusco en mitad del gesto natural.
// Ahora: el pinch sigue moviendo la cámara con resistencia elástica
// (rubber-band) más allá de min/max, y si al soltar el overshoot supera
// el umbral, el gesto **commitea** la transición de nivel:
//   - zoom-in past umbral → re-emite tap en el centro del pinch
//     (onTap (handleTap en app.js) navega al hijo bajo el centroide)
//   - zoom-out past umbral → llama window.polisApp.navigateBack()
//     (sube al padre con la misma animación que el botón back).
// Si no se llega al umbral, snap-back animado a min/max. Histeresis
// implícita en el umbral (1.18× / 0.78×) — necesitas pinchar
// claramente más allá del cap para commit, así no parpadea.

export function attach(canvas, state, requestRender, onTap, onSwipe) {
  const dragState = { active: false, lastX: 0, lastY: 0, moved: 0 };
  const touchState = {
    mode: null,
    startDist: 0,
    startScale: 1,
    lastX: 0, lastY: 0,
    startX: 0, startY: 0,
    startTs: 0,
    moved: 0,
    // [B] últimos midpoint y scale ratio observados del pinch (para
    // que touchend pueda decidir commit vs snap-back sin volver a
    // mirar e.touches, que ya está vacío en ese evento).
    lastMidX: 0,
    lastMidY: 0,
    lastTargetScaleRaw: 1,
    // [B] guard para no re-disparar commit si el touch se mantiene tras
    // navegación (p.ej. el segundo dedo se levanta pero el primero sigue).
    committed: false,
  };

  function clampScale(s) {
    const v = state.view;
    return Math.min(v.maxScale, Math.max(v.minScale, s));
  }

  // [B] Soft clamp con rubber-band: permite hasta `OVERSHOOT_MAX` ×
  // más allá de min/max, con resistencia logarítmica (cuanto más
  // empujas, menos te deja avanzar). Esto da feedback háptico-visual de
  // "estás llegando al límite" sin frenar el gesto en seco.
  const OVERSHOOT_MAX = 1.4; // máximo 40% más allá de maxScale (o 1/1.4 por debajo de minScale)
  function softClampScale(s) {
    const v = state.view;
    if (s > v.maxScale) {
      const excess = (s / v.maxScale) - 1; // >0
      // Resistencia: cuanto mayor excess, menos se aplica. Tope OVERSHOOT_MAX.
      const resisted = (OVERSHOOT_MAX - 1) * (1 - 1 / (1 + excess * 2.5));
      return v.maxScale * (1 + resisted);
    }
    if (s < v.minScale) {
      const excess = (v.minScale / s) - 1;
      const resisted = (OVERSHOOT_MAX - 1) * (1 - 1 / (1 + excess * 2.5));
      return v.minScale / (1 + resisted);
    }
    return s;
  }

  // [B] Umbrales de commit. Necesita superar este múltiplo de min/max
  // (medido sobre el targetScaleRaw, ANTES del soft-clamp) para que al
  // soltar se ejecute la navegación al nivel hijo/padre. Histeresis: el
  // umbral es generosamente más alto que el límite duro para evitar
  // commits accidentales por temblor de dedos.
  const COMMIT_IN_RATIO  = 1.18; // 18% past maxScale (raw)
  const COMMIT_OUT_RATIO = 0.78; // 22% past minScale (raw)

  // [B] Animación de snap-back cuando el commit no se dispara. Pequeña
  // tween 180ms para reposicionar scale a min/max sin teleporte. Token
  // de generación para abortar limpiamente: si una nueva touchstart
  // llega mientras snap-back corre, incrementamos el token y el step()
  // antiguo se detiene en su próximo frame.
  let _snapRaf = null;
  let _snapGen = 0;
  function cancelSnap() {
    _snapGen += 1;
    if (_snapRaf) { cancelAnimationFrame(_snapRaf); _snapRaf = null; }
  }
  function snapBack(targetScale) {
    cancelSnap();
    const myGen = ++_snapGen;
    const startScale = state.view.scale;
    const startCx = state.view.cx;
    const startCy = state.view.cy;
    // Pivot: punto bajo el centroide del último pinch.
    const mx = touchState.lastMidX;
    const my = touchState.lastMidY;
    const t0 = performance.now();
    const dur = 180;
    function step() {
      if (myGen !== _snapGen) return; // abortado por otra touchstart
      _snapRaf = null;
      const t = Math.min(1, (performance.now() - t0) / dur);
      const k = t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2;
      const sNow = startScale + (targetScale - startScale) * k;
      // Re-aplica el pivot para no derivar el pan.
      const real = sNow / startScale;
      state.view.scale = sNow;
      state.view.cx = mx - (mx - startCx) * real;
      state.view.cy = my - (my - startCy) * real;
      requestRender();
      if (t < 1) _snapRaf = requestAnimationFrame(step);
    }
    _snapRaf = requestAnimationFrame(step);
  }

  // ---- Mouse
  canvas.addEventListener("mousedown", (e) => {
    dragState.active = true;
    dragState.lastX = e.clientX;
    dragState.lastY = e.clientY;
    dragState.moved = 0;
    canvas.classList.add("grabbing");
  });
  window.addEventListener("mousemove", (e) => {
    if (!dragState.active) return;
    const dx = e.clientX - dragState.lastX;
    const dy = e.clientY - dragState.lastY;
    dragState.moved += Math.abs(dx) + Math.abs(dy);
    dragState.lastX = e.clientX;
    dragState.lastY = e.clientY;
    state.view.cx += dx;
    state.view.cy += dy;
    requestRender();
  });
  window.addEventListener("mouseup", (e) => {
    if (!dragState.active) return;
    dragState.active = false;
    canvas.classList.remove("grabbing");
    if (dragState.moved < 4) {
      // Tap
      const rect = canvas.getBoundingClientRect();
      onTap(e.clientX - rect.left, e.clientY - rect.top);
    }
  });

  // ---- Wheel zoom
  // [Z] 2026-05-31 — Commit de nivel por rueda/trackpad. Antes el wheel
  // SOLO hacía clampScale: en Mac (pinch del trackpad emite eventos
  // `wheel`, no `touch`) era imposible bajar/subir de nivel zoomando — la
  // cámara topaba en min/max y se quedaba presa. Ahora, igual que el pinch
  // táctil: si ya estás en el tope y sigues empujando, acumulamos el
  // overshoot; al superar el umbral se commitea la transición:
  //   - zoom-in en el tope máx → onTap en el cursor (drill-down al hijo)
  //   - zoom-out en el tope mín → navigateBack (sube al padre)
  // Cooldown tras commit para que un solo gesto continuo no encadene
  // varios saltos. El acumulador se resetea si dejas de empujar el tope.
  const WHEEL_COMMIT_IN  = 0.45; // overshoot log acumulado para drill-down
  const WHEEL_COMMIT_OUT = 0.45; // overshoot log acumulado para subir
  let _wheelAccum = 0;
  let _wheelCooldownUntil = 0;
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = Math.exp(-e.deltaY * 0.0015);
    const v = state.view;
    const now = performance.now();

    if (now < _wheelCooldownUntil || state._anim) {
      zoomAt(mx, my, factor);
      return;
    }

    const atMax = v.scale >= v.maxScale - 1e-6;
    const atMin = v.scale <= v.minScale + 1e-6;

    if (atMax && factor > 1) {
      // Empujando hacia adentro estando ya en el tope → acumula y, al
      // pasar el umbral, drillea al hijo bajo el cursor.
      _wheelAccum += Math.log(factor);
      if (_wheelAccum >= WHEEL_COMMIT_IN) {
        _wheelAccum = 0;
        _wheelCooldownUntil = now + 500;
        // 2026-06-02 — flag de origen para que handleTap del lod=municipio
        // sepa que viene de un wheel-commit y deba SALTAR el peek-chip de
        // supra (no quiero un 1er tap=peek; quiero drill directo a sección
        // con edificios). En lod no-municipio el flag es inocuo.
        state._wheelDrill = true;
        onTap(mx, my);
        state._wheelDrill = false;
        return;
      }
    } else if (atMin && factor < 1) {
      // Empujando hacia afuera estando ya en el tope → sube al padre.
      _wheelAccum += -Math.log(factor);
      if (_wheelAccum >= WHEEL_COMMIT_OUT) {
        _wheelAccum = 0;
        _wheelCooldownUntil = now + 500;
        if (typeof window.polisApp?.navigateBack === "function") {
          window.polisApp.navigateBack();
        }
        return;
      }
    } else {
      _wheelAccum = 0; // dejó de empujar contra un tope
    }

    zoomAt(mx, my, factor);
  }, { passive: false });

  function zoomAt(mx, my, factor) {
    const v = state.view;
    const newScale = clampScale(v.scale * factor);
    const real = newScale / v.scale;
    if (real === 1) return;
    // Mantén el punto bajo el cursor estable.
    v.cx = mx - (mx - v.cx) * real;
    v.cy = my - (my - v.cy) * real;
    v.scale = newScale;
    requestRender();
  }

  // ---- Touch
  function tDist(t0, t1) {
    return Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
  }
  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      touchState.mode = "pan";
      touchState.lastX = e.touches[0].clientX;
      touchState.lastY = e.touches[0].clientY;
      touchState.startX = e.touches[0].clientX;
      touchState.startY = e.touches[0].clientY;
      touchState.startTs = performance.now();
      touchState.moved = 0;
    } else if (e.touches.length === 2) {
      touchState.mode = "pinch";
      touchState.startDist = tDist(e.touches[0], e.touches[1]);
      touchState.startScale = state.view.scale;
      touchState.lastTargetScaleRaw = state.view.scale; // [B]
      touchState.committed = false; // [B]
      // [B] Cancela cualquier animación de view inflight (snap-back o
      // animateView en app.js): si state._anim sigue corriendo cuando
      // el pinch empieza a escribir view.scale/cx/cy, el siguiente rAF
      // de animateView pisaría nuestros writes. Mejor abortarla.
      if (state._anim) state._anim = null;
      cancelSnap();
      // [B] midpoint inicial — guarda por si touchend se dispara muy
      // pronto (p.ej. el usuario suelta los dos dedos antes de un move).
      const rect = canvas.getBoundingClientRect();
      touchState.lastMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      touchState.lastMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
    }
  }, { passive: false });
  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    if (touchState.mode === "pan" && e.touches.length === 1) {
      const t = e.touches[0];
      const dx = t.clientX - touchState.lastX;
      const dy = t.clientY - touchState.lastY;
      touchState.moved += Math.abs(dx) + Math.abs(dy);
      touchState.lastX = t.clientX;
      touchState.lastY = t.clientY;
      state.view.cx += dx;
      state.view.cy += dy;
      requestRender();
    } else if (touchState.mode === "pinch" && e.touches.length === 2) {
      const d = tDist(e.touches[0], e.touches[1]);
      const factor = d / Math.max(touchState.startDist, 1);
      // [B] targetScaleRaw es el scale "ideal" sin clamp — lo guardamos
      // para el test de commit en touchend. targetScale aplica
      // rubber-band: dentro de [min,max] es lineal; fuera, resistido.
      const targetScaleRaw = touchState.startScale * factor;
      const targetScale = softClampScale(targetScaleRaw); // [B]
      touchState.lastTargetScaleRaw = targetScaleRaw; // [B]
      const rect = canvas.getBoundingClientRect();
      const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      const my = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
      touchState.lastMidX = mx; // [B]
      touchState.lastMidY = my; // [B]
      const real = targetScale / state.view.scale;
      state.view.cx = mx - (mx - state.view.cx) * real;
      state.view.cy = my - (my - state.view.cy) * real;
      state.view.scale = targetScale;
      requestRender();
    }
  }, { passive: false });
  canvas.addEventListener("touchend", (e) => {
    if (touchState.mode === "pan") {
      const t = e.changedTouches[0];
      const dx = t.clientX - touchState.startX;
      const dy = t.clientY - touchState.startY;
      const dt = performance.now() - touchState.startTs;
      // 2026-05-25 — Pancho: swipe-left = volver al nivel superior en
      // CUALQUIER nivel. En distrito se sigue priorizando el slide entre
      // hermanos (era la única semántica swipe que tenía).
      const isHorizontalSwipe = Math.abs(dx) > 60 && Math.abs(dy) < 40 &&
                                 dt < 600;
      const distritoSiblingSwipe = onSwipe && isHorizontalSwipe &&
                                    state.lodLevel === "distrito";
      const swipeLeftBack = isHorizontalSwipe && dx < -60 &&
                            state.lodLevel !== "distrito" &&
                            state.lodLevel !== "archipielago" &&
                            !state._anim;  // [2026-05-29] no retroceder mid-lateralización
      if (distritoSiblingSwipe) {
        onSwipe(dx);
      } else if (swipeLeftBack) {
        if (typeof window.polisApp?.navigateBack === "function") {
          window.polisApp.navigateBack();
        }
      } else if (touchState.moved < 8) {
        const rect = canvas.getBoundingClientRect();
        onTap(t.clientX - rect.left, t.clientY - rect.top);
      }
    } else if (touchState.mode === "pinch" && !touchState.committed) {
      // [B] Commit / snap-back. El usuario soltó uno o los dos dedos
      // del pinch — evaluamos si el overshoot acumulado supera el
      // umbral. Solo procesamos UNA vez (committed=true) porque
      // touchend se dispara por cada dedo que se levanta.
      touchState.committed = true;
      const v = state.view;
      const raw = touchState.lastTargetScaleRaw;
      const inRatio  = raw / v.maxScale; // >1 si pinch-in past max
      const outRatio = raw / v.minScale; // <1 si pinch-out past min
      const mx = touchState.lastMidX;
      const my = touchState.lastMidY;
      if (inRatio >= COMMIT_IN_RATIO && !state._anim) {
        // [B] Pinch-in commit → re-emite tap en el centroide del pinch
        // para que app.handleTap drilleé al hijo bajo ese punto. Antes
        // dejamos un snap-back rápido al cap para que el render quede
        // estable; handleTap dispara su propia animateView a entry
        // zoom del nivel hijo.
        state.view.scale = v.maxScale;
        // Ajusta el pivot al cap (sin saltos).
        const real = v.maxScale / Math.max(raw, 1e-6);
        state.view.cx = mx - (mx - state.view.cx) * real;
        state.view.cy = my - (my - state.view.cy) * real;
        requestRender();
        onTap(mx, my);
      } else if (outRatio <= COMMIT_OUT_RATIO && !state._anim) {
        // [B] Pinch-out commit → sube al nivel padre. navigateBack
        // expuesto por app.js en window.polisApp.
        state.view.scale = v.minScale;
        requestRender();
        if (window.polisApp?.navigateBack) {
          window.polisApp.navigateBack();
        }
      } else {
        // [B] No commit → snap-back al cap más cercano si hay overshoot.
        if (state.view.scale > v.maxScale) snapBack(v.maxScale);
        else if (state.view.scale < v.minScale) snapBack(v.minScale);
      }
    }
    // Si quedan dedos en pantalla tras este touchend (p.ej. de pinch a
    // pan con 1 dedo), volvemos a modo "pan". Si no, limpiamos.
    if (e.touches && e.touches.length === 1 && touchState.mode === "pinch") {
      touchState.mode = "pan";
      touchState.lastX = e.touches[0].clientX;
      touchState.lastY = e.touches[0].clientY;
      touchState.startX = e.touches[0].clientX;
      touchState.startY = e.touches[0].clientY;
      touchState.startTs = performance.now();
      touchState.moved = 0;
    } else {
      touchState.mode = null;
    }
  });

  // ---- Botones de zoom
  // [OCRE-SKIN 2026-05-24] Hooks comparten lógica con los botones del
  // hud-toolbar legacy y con el nuevo .zoom-fab paper (#btn-zoom-in-ocre,
  // #btn-zoom-out-ocre). Wireamos ambos IDs si existen.
  const _zin = (factor) => zoomAt(
    canvas.width / (2 * (window.devicePixelRatio || 1)),
    canvas.height / (2 * (window.devicePixelRatio || 1)),
    factor
  );
  for (const id of ["btn-zoom-in", "btn-zoom-in-ocre"]) {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", () => _zin(1.4));
  }
  for (const id of ["btn-zoom-out", "btn-zoom-out-ocre"]) {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", () => _zin(1 / 1.4));
  }
  // Reset de viewport por doble-tap / doble-click sobre el canvas.
  // Sustituye al antiguo botón ○ que vivía en la zoom-bar.
  function resetView() {
    state.view.scale = state.view.fitScale;
    state.view.cx = state.initialView.cx;
    state.view.cy = state.initialView.cy;
    requestRender();
  }
  canvas.addEventListener("dblclick", (e) => {
    e.preventDefault();
    resetView();
  });
  let _lastTapTs = 0;
  canvas.addEventListener("touchend", (e) => {
    if (e.changedTouches.length !== 1) return;
    const now = performance.now();
    if (now - _lastTapTs < 320) {
      resetView();
      _lastTapTs = 0;
    } else {
      _lastTapTs = now;
    }
  });

  return { zoomAt };
}
