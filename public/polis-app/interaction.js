// KOINOS · POLIS — handlers de mouse/touch para pan, zoom y tap.
// Estado mutable se actualiza en `state.view`. Llama a `requestRender()`
// para que app.js redibuje en el próximo frame.
//
// v1.5: añade detección de swipe horizontal en touch para que en nivel
// distrito un swipe izq/dcha navegue al distrito adyacente. El gesto se
// considera swipe (y NO pan) cuando: 1 dedo, recorrido X > 60px, recorrido
// Y < 40px y duración < 600ms. Si no cumple, se trata como pan normal.

export function attach(canvas, state, requestRender, onTap, onSwipe) {
  const dragState = { active: false, lastX: 0, lastY: 0, moved: 0 };
  const touchState = {
    mode: null,
    startDist: 0,
    startScale: 1,
    lastX: 0, lastY: 0,
    startX: 0, startY: 0,
    startTs: 0,
    moved: 0
  };

  function clampScale(s) {
    const v = state.view;
    return Math.min(v.maxScale, Math.max(v.minScale, s));
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
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = Math.exp(-e.deltaY * 0.0015);
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
      const targetScale = clampScale(touchState.startScale * factor);
      const rect = canvas.getBoundingClientRect();
      const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      const my = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
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
      const isSwipe = onSwipe && Math.abs(dx) > 60 && Math.abs(dy) < 40 &&
                      dt < 600 && state.lodLevel === "distrito";
      if (isSwipe) {
        onSwipe(dx);
      } else if (touchState.moved < 8) {
        const rect = canvas.getBoundingClientRect();
        onTap(t.clientX - rect.left, t.clientY - rect.top);
      }
    }
    touchState.mode = null;
  });

  // ---- Botones de zoom
  document.getElementById("btn-zoom-in").addEventListener("click", () => {
    zoomAt(canvas.width / (2 * (window.devicePixelRatio || 1)),
           canvas.height / (2 * (window.devicePixelRatio || 1)), 1.4);
  });
  document.getElementById("btn-zoom-out").addEventListener("click", () => {
    zoomAt(canvas.width / (2 * (window.devicePixelRatio || 1)),
           canvas.height / (2 * (window.devicePixelRatio || 1)), 1 / 1.4);
  });
  document.getElementById("btn-zoom-reset").addEventListener("click", () => {
    state.view.scale = state.view.fitScale;
    state.view.cx = state.initialView.cx;
    state.view.cy = state.initialView.cy;
    requestRender();
  });

  return { zoomAt };
}
