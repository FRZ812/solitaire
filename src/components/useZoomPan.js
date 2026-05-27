import { useEffect, useLayoutEffect, useRef, useState } from "react";

// Reusable zoom + pan hook for SVG / canvas-style map views.
//
// Performance model:
// During a gesture the hook writes `style.transform` directly to a DOM node
// via `transformRef` on each rAF. React state (`zoom`, `pan`) is intentionally
// NOT updated mid-gesture — that would re-render the entire consumer
// (potentially hundreds of SVG hexes) at 60–120 Hz and produce the
// jump-back/glitch behavior. State commits once at gesture end so labels
// stay correct.
//
// The caller MUST:
//   - attach `transformRef` to the element they want transformed
//   - NOT include `transform` in that element's React-controlled inline style
//     (React would otherwise fight the imperative DOM writes during a gesture)
//   - apply `touch-action: none` to the gesture container so the browser
//     doesn't claim the pinch
//
// Gesture model:
//   - Mouse wheel zooms toward the cursor.
//   - Touch pinch zooms toward the PREVIOUS midpoint between fingers AND
//     pans by the midpoint translation, so the world point under the
//     fingertips at frame T-1 lands exactly under the fingertips at frame T
//     (the math derivation lives in the commit history).
//   - Mouse and single-finger drag pan.
//   - `lastWasDragRef` tracks whether the just-finished gesture moved far
//     enough to count as a drag; click handlers on hexes check it so a pan
//     doesn't also select a tile.

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 3.0;
const DRAG_THRESHOLD = 4; // px — below this, gesture counts as a tap, not a drag

function clampZoom(z) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
}

function buildTransform(panX, panY, zoom) {
  return `translate(-50%, -50%) translate(${panX}px, ${panY}px) scale(${zoom})`;
}

// `options.panDisabledRef` — a React ref (whose .current is a boolean).
// When true, single-finger / mouse drag-to-pan is suppressed. The MapEditor
// passes this when its Multi tool is active so the user's drag-select
// gesture isn't fighting a pan-the-map gesture. Pinch-zoom and wheel-zoom
// stay active regardless — only the pan branch is gated.
export function useZoomPan(containerRef, options = {}) {
  const panDisabledRef = options.panDisabledRef || { current: false };
  // Visible React state, used for UI labels and any external consumer.
  // Updated only on gesture end / reset — NEVER mid-gesture.
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // The live truth — refs the gesture handlers read and write. The DOM
  // transform is derived from these, not from React state.
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });

  // Caller attaches this to the element they want transformed.
  const transformRef = useRef(null);

  const dragRef = useRef(null);
  const pinchRef = useRef(null);
  const lastWasDragRef = useRef(false);

  // rAF coalescing — many touchmove events between frames collapse into one
  // DOM write per displayed frame.
  const rafIdRef = useRef(0);

  function writeTransform() {
    const el = transformRef.current;
    if (!el) return;
    el.style.transform = buildTransform(panRef.current.x, panRef.current.y, zoomRef.current);
  }

  function scheduleWrite() {
    if (rafIdRef.current) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = 0;
      writeTransform();
    });
  }

  // Sync DOM to React state on mount and on any state-driven change (reset,
  // end-of-gesture commit). Idempotent when state already matches refs.
  useLayoutEffect(() => {
    zoomRef.current = zoom;
    panRef.current = pan;
    writeTransform();
  }, [zoom, pan]);

  function getContainerCenter() {
    const el = containerRef.current;
    if (!el) return { cx: 400, cy: 300 };
    return { cx: el.clientWidth / 2, cy: el.clientHeight / 2 };
  }

  // applyZoomPan composes a zoom factor anchored at screen point (sx, sy)
  // — relative to the container's top-left — with an optional pan delta.
  // CONVENTION: (sx, sy) is the OLD anchor; the world point currently under
  // it should remain under it through the zoom. The pan delta then layers
  // on top. For pinch, sx/sy is the PREVIOUS midpoint and (dxPan, dyPan)
  // is (newMidpoint − oldMidpoint).
  function applyZoomPan(factor, sx, sy, dxPan = 0, dyPan = 0) {
    const { cx, cy } = getContainerCenter();
    const prevZoom = zoomRef.current;
    const prevPan = panRef.current;
    const newZoom = clampZoom(prevZoom * factor);
    const f = newZoom / prevZoom; // may not equal `factor` after clamp
    zoomRef.current = newZoom;
    panRef.current = {
      x: (sx - cx) * (1 - f) + prevPan.x * f + dxPan,
      y: (sy - cy) * (1 - f) + prevPan.y * f + dyPan,
    };
    scheduleWrite();
  }

  function panBy(dx, dy) {
    panRef.current = { x: panRef.current.x + dx, y: panRef.current.y + dy };
    scheduleWrite();
  }

  // commitToState fires after a gesture ends, so React state matches refs
  // and downstream consumers (UI labels) see the final values.
  function commitToState() {
    setZoom(zoomRef.current);
    setPan({ x: panRef.current.x, y: panRef.current.y });
  }

  function reset() {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = 0;
    }
    zoomRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    setZoom(1);
    setPan({ x: 0, y: 0 });
    // useLayoutEffect will write the DOM.
  }

  // Wheel + touch listeners need passive:false to preventDefault. Attached
  // via ref so React's synthetic events (which are passive) don't interfere.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const factor = Math.exp(-e.deltaY * 0.0015);
      applyZoomPan(factor, sx, sy);
      // Wheel events arrive in bursts then stop. Commit on a debounced
      // tail; for simplicity we commit on every wheel — it's a single
      // event per tick rather than a sustained gesture.
      commitToState();
    };

    const onTouchStart = (e) => {
      if (e.touches.length === 1) {
        // Skip single-finger pan when the consumer has disabled it
        // (e.g. MapEditor's Multi tool — drag-select instead). Pinch
        // (2 fingers) still goes through the else branch below.
        if (panDisabledRef.current) return;
        const t = e.touches[0];
        dragRef.current = {
          lastX: t.clientX, lastY: t.clientY,
          startX: t.clientX, startY: t.clientY,
          moved: false,
        };
        pinchRef.current = null;
      } else if (e.touches.length === 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const rect = el.getBoundingClientRect();
        pinchRef.current = {
          lastDist: Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY),
          lastCx: (t1.clientX + t2.clientX) / 2 - rect.left,
          lastCy: (t1.clientY + t2.clientY) / 2 - rect.top,
        };
        dragRef.current = null;
      }
    };

    const onTouchMove = (e) => {
      if (pinchRef.current && e.touches.length === 2) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const rect = el.getBoundingClientRect();
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const cx = (t1.clientX + t2.clientX) / 2 - rect.left;
        const cy = (t1.clientY + t2.clientY) / 2 - rect.top;

        // Zoom around the OLD midpoint, then translate by the midpoint delta.
        // This keeps the world point under the user's fingers at frame T-1
        // glued to the fingers' new position at frame T.
        const factor = dist / pinchRef.current.lastDist;
        const dcx = cx - pinchRef.current.lastCx;
        const dcy = cy - pinchRef.current.lastCy;

        applyZoomPan(factor, pinchRef.current.lastCx, pinchRef.current.lastCy, dcx, dcy);

        pinchRef.current.lastDist = dist;
        pinchRef.current.lastCx = cx;
        pinchRef.current.lastCy = cy;
      } else if (dragRef.current && e.touches.length === 1) {
        e.preventDefault();
        const t = e.touches[0];
        const dx = t.clientX - dragRef.current.lastX;
        const dy = t.clientY - dragRef.current.lastY;
        const totalDx = t.clientX - dragRef.current.startX;
        const totalDy = t.clientY - dragRef.current.startY;
        if (Math.abs(totalDx) > DRAG_THRESHOLD || Math.abs(totalDy) > DRAG_THRESHOLD) {
          dragRef.current.moved = true;
        }
        dragRef.current.lastX = t.clientX;
        dragRef.current.lastY = t.clientY;
        panBy(dx, dy);
      }
    };

    const onTouchEnd = (e) => {
      if (e.touches.length === 0) {
        if (dragRef.current) lastWasDragRef.current = dragRef.current.moved;
        dragRef.current = null;
        pinchRef.current = null;
        commitToState();
      } else if (e.touches.length === 1) {
        // One finger left after a pinch — commit and resume tracking as a
        // drag from the remaining finger's position so the transition is
        // seamless.
        commitToState();
        pinchRef.current = null;
        const t = e.touches[0];
        dragRef.current = {
          lastX: t.clientX, lastY: t.clientY,
          startX: t.clientX, startY: t.clientY,
          moved: false,
        };
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = 0;
      }
    };
  }, [containerRef]);

  // Mouse drag — React synthetic events are passive and we don't need to
  // preventDefault for these, so plain event handlers are fine.
  function onMouseDown(e) {
    if (e.button === 1) {
      // Middle-mouse-button: always pans, regardless of panDisabledRef.
      // Lets consumers reserve left-button for their own gesture (the
      // MapEditor's Multi tool uses LMB for drag-select) while leaving
      // an "always works" pan available on mouse hardware. preventDefault
      // suppresses the browser's middle-click auto-scroll cursor.
      e.preventDefault();
    } else if (e.button === 0) {
      // Left button: subject to the consumer's pan-disable flag. The
      // MapEditor's Multi tool flips this on so dragging hexes doesn't
      // also drag the camera.
      if (panDisabledRef.current) return;
    } else {
      // Ignore right-click (context menu) and other buttons.
      return;
    }
    dragRef.current = {
      lastX: e.clientX, lastY: e.clientY,
      startX: e.clientX, startY: e.clientY,
      moved: false,
    };
  }

  function onMouseMove(e) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.lastX;
    const dy = e.clientY - dragRef.current.lastY;
    const totalDx = e.clientX - dragRef.current.startX;
    const totalDy = e.clientY - dragRef.current.startY;
    if (Math.abs(totalDx) > DRAG_THRESHOLD || Math.abs(totalDy) > DRAG_THRESHOLD) {
      dragRef.current.moved = true;
    }
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    panBy(dx, dy);
  }

  function onMouseUp() {
    if (dragRef.current) {
      lastWasDragRef.current = dragRef.current.moved;
      if (dragRef.current.moved) commitToState();
    }
    dragRef.current = null;
  }

  return {
    zoom,
    pan,
    transformRef,
    reset,
    lastWasDragRef,
    mouseHandlers: { onMouseDown, onMouseMove, onMouseUp, onMouseLeave: onMouseUp },
  };
}
