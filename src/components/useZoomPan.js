import { useEffect, useRef, useState } from "react";

// Reusable zoom + pan hook for SVG / canvas-style map views.
//
// - Mouse wheel zooms toward the cursor.
// - Touch pinch zooms toward the live midpoint between the two fingers AND
//   pans by the midpoint's translation, so the world stays anchored under
//   the fingertips even when both fingers are moving.
// - Mouse and single-finger drag pan the content.
// - `lastWasDragRef` tracks whether the most recently completed gesture moved
//   far enough to count as a drag; click handlers on hexes check this so a
//   pan doesn't also select a tile.
// - Touch updates are coalesced via requestAnimationFrame so a 120 Hz
//   touchmove stream produces one re-render per displayed frame, not one
//   per native event. This is the main fix for stutter on Android.
//
// The hook only owns zoom/pan state and gesture wiring. Callers apply the
// transform themselves (e.g. via CSS `transform: scale() translate()`) and
// should set `touch-action: none` on the gesture container so the browser
// doesn't intercept the pinch.

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 3.0;
const DRAG_THRESHOLD = 4; // px — below this, gesture counts as a tap, not a drag

function clampZoom(z) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
}

export function useZoomPan(containerRef) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Refs let the event listeners read the freshest state without re-binding.
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = pan; }, [pan]);

  const dragRef = useRef(null);
  const pinchRef = useRef(null);
  const lastWasDragRef = useRef(false);

  // rAF coalescing — pending holds the next zoom/pan target, rafIdRef is the
  // scheduled frame. Multiple touchmove events between frames overwrite the
  // pending values; only the last one applies, eliminating mid-gesture stutter.
  const pendingRef = useRef(null);
  const rafIdRef = useRef(0);

  function getContainerCenter() {
    const el = containerRef.current;
    if (!el) return { cx: 400, cy: 300 };
    return { cx: el.clientWidth / 2, cy: el.clientHeight / 2 };
  }

  function flushPending() {
    rafIdRef.current = 0;
    const p = pendingRef.current;
    pendingRef.current = null;
    if (!p) return;
    // Write the freshest values back to refs so the next frame reads them.
    zoomRef.current = p.zoom;
    panRef.current = p.pan;
    setZoom(p.zoom);
    setPan(p.pan);
  }

  function scheduleApply(nextZoom, nextPan) {
    pendingRef.current = { zoom: nextZoom, pan: nextPan };
    // Optimistically update the refs so further gesture math in the same
    // frame composes on the freshest values rather than the stale state.
    zoomRef.current = nextZoom;
    panRef.current = nextPan;
    if (!rafIdRef.current) {
      rafIdRef.current = requestAnimationFrame(flushPending);
    }
  }

  // Apply a zoom factor anchored at screen point (sx, sy), plus an optional
  // pan delta (dxPan, dyPan). Both screen points are relative to the
  // container's top-left.
  //
  // Convention: (sx, sy) is the OLD anchor — the screen point whose
  // currently-underlying world point should stay still during the zoom.
  // The pan delta is then applied on top, separately, so for pinch
  // gestures pass the PREVIOUS midpoint as anchor and (newMid - oldMid)
  // as the pan delta. This keeps the world point under the user's
  // fingertips at frame T-1 anchored to the fingertips at frame T even
  // when the midpoint translates during the zoom.
  //
  // Used by:
  //  - wheel  (sx, sy = cursor, no pan delta)
  //  - pinch  (sx, sy = previous midpoint, dxPan/dyPan = midpoint delta)
  //  - pan    (factor = 1, no anchor effect, dxPan/dyPan = drag delta)
  function applyZoomPan(factor, sx, sy, dxPan = 0, dyPan = 0) {
    const { cx, cy } = getContainerCenter();
    const prevZoom = zoomRef.current;
    const prevPan = panRef.current;
    const newZoom = clampZoom(prevZoom * factor);
    const f = newZoom / prevZoom; // may not equal `factor` after clamp
    const newPanX = (sx - cx) * (1 - f) + prevPan.x * f + dxPan;
    const newPanY = (sy - cy) * (1 - f) + prevPan.y * f + dyPan;
    scheduleApply(newZoom, { x: newPanX, y: newPanY });
  }

  function panBy(dx, dy) {
    const prev = panRef.current;
    const next = { x: prev.x + dx, y: prev.y + dy };
    scheduleApply(zoomRef.current, next);
  }

  function reset() {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = 0;
    }
    pendingRef.current = null;
    zoomRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  // Wheel + touch listeners need passive:false to preventDefault; attach via
  // ref so React's synthetic events (which are passive) don't interfere.
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
    };

    const onTouchStart = (e) => {
      if (e.touches.length === 1) {
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

        // Two-finger gesture = zoom-around-the-old-midpoint + pan-by-midpoint-delta.
        // Passing the OLD midpoint as the zoom anchor (lastCx, lastCy) and the
        // midpoint delta as the pan keeps the world point that was under the
        // user's fingers in the previous frame glued to where the fingers are
        // in this frame. Using the new midpoint as the anchor instead would
        // leak (M2 − M1)·(1 − f) of jitter per frame.
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
      } else if (e.touches.length === 1) {
        // One finger left after a pinch — resume tracking as a drag from
        // the remaining finger's position so the transition is seamless.
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
        pendingRef.current = null;
      }
    };
  }, [containerRef]);

  // Mouse drag — React synthetic events are passive and we don't need to
  // preventDefault for these, so plain event handlers are fine.
  function onMouseDown(e) {
    if (e.button !== 0) return;
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
    if (dragRef.current) lastWasDragRef.current = dragRef.current.moved;
    dragRef.current = null;
  }

  return {
    zoom,
    pan,
    reset,
    lastWasDragRef,
    mouseHandlers: { onMouseDown, onMouseMove, onMouseUp, onMouseLeave: onMouseUp },
  };
}
