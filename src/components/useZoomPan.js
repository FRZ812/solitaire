import { useEffect, useRef, useState } from "react";

// Reusable zoom + pan hook for SVG / canvas-style map views.
//
// - Mouse wheel zooms toward the cursor.
// - Touch pinch zooms toward the midpoint between the two fingers.
// - Mouse and single-finger drag pan the content.
// - `lastWasDragRef` tracks whether the most recently completed gesture moved
//   far enough to count as a drag; click handlers on hexes check this so a
//   pan doesn't also select a tile.
//
// The hook only owns zoom/pan state and gesture wiring. Callers apply the
// transform themselves (e.g. via CSS `transform: scale() translate()`).

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

  function getContainerCenter() {
    const el = containerRef.current;
    if (!el) return { cx: 400, cy: 300 };
    return { cx: el.clientWidth / 2, cy: el.clientHeight / 2 };
  }

  // Zoom by `factor`, keeping the screen point (sx, sy) — measured from the
  // container's top-left — anchored under the cursor/pinch midpoint.
  function zoomAt(factor, sx, sy) {
    const { cx, cy } = getContainerCenter();
    const prevZoom = zoomRef.current;
    const prevPan = panRef.current;
    const newZoom = clampZoom(prevZoom * factor);
    if (newZoom === prevZoom) return;
    const f = newZoom / prevZoom;
    const newPanX = (sx - cx) * (1 - f) + prevPan.x * f;
    const newPanY = (sy - cy) * (1 - f) + prevPan.y * f;
    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  }

  function panBy(dx, dy) {
    setPan(p => ({ x: p.x + dx, y: p.y + dy }));
  }

  function reset() {
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
      zoomAt(factor, sx, sy);
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
          cx: (t1.clientX + t2.clientX) / 2 - rect.left,
          cy: (t1.clientY + t2.clientY) / 2 - rect.top,
        };
        dragRef.current = null;
      }
    };

    const onTouchMove = (e) => {
      if (pinchRef.current && e.touches.length === 2) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const factor = dist / pinchRef.current.lastDist;
        pinchRef.current.lastDist = dist;
        zoomAt(factor, pinchRef.current.cx, pinchRef.current.cy);
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
        // One finger left after a pinch — resume tracking as a drag from here.
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
