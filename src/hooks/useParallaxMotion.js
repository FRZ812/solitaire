import { useEffect, useRef } from "react";

const ZERO_VARS = {
  "--parallax-far-x": "0px",
  "--parallax-far-y": "0px",
  "--parallax-mid-x": "0px",
  "--parallax-mid-y": "0px",
  "--parallax-near-x": "0px",
  "--parallax-near-y": "0px",
};

function writeParallaxVars(node, x, y, strength) {
  const layers = {
    far: { x: x * -2.5 * strength, y: y * -1.8 * strength },
    mid: { x: x * -6 * strength, y: y * -4 * strength },
    near: { x: x * -11 * strength, y: y * -7 * strength },
  };

  for (const [name, offset] of Object.entries(layers)) {
    node.style.setProperty(`--parallax-${name}-x`, `${offset.x.toFixed(2)}px`);
    node.style.setProperty(`--parallax-${name}-y`, `${offset.y.toFixed(2)}px`);
  }
}
/**
 * Coalesces pointer movement into CSS variables without rerendering React.
 * Touch devices retain the ambient CSS drift; reduced-motion users get a
 * completely still scene.
 */
export function useParallaxMotion({ strength = 1 } = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof window === "undefined") return undefined;

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia?.("(hover: hover) and (pointer: fine)");

    if (reduced?.matches || !finePointer?.matches) {
      for (const [key, value] of Object.entries(ZERO_VARS)) node.style.setProperty(key, value);
      return undefined;
    }

    let frame = 0;
    let currentX = 0;
    let currentY = 0;
    let targetX = 0;
    let targetY = 0;

    const render = () => {
      frame = 0;
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;
      writeParallaxVars(node, currentX, currentY, strength);

      if (Math.abs(targetX - currentX) > 0.002 || Math.abs(targetY - currentY) > 0.002) {
        frame = window.requestAnimationFrame(render);
      }
    };

    const requestRender = () => {
      if (!frame) frame = window.requestAnimationFrame(render);
    };

    const onPointerMove = (event) => {
      targetX = Math.max(-1, Math.min(1, (event.clientX / Math.max(window.innerWidth, 1) - 0.5) * 2));
      targetY = Math.max(-1, Math.min(1, (event.clientY / Math.max(window.innerHeight, 1) - 0.5) * 2));
      requestRender();
    };

    const reset = () => {
      targetX = 0;
      targetY = 0;
      requestRender();
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("blur", reset);
    document.addEventListener("mouseleave", reset);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("blur", reset);
      document.removeEventListener("mouseleave", reset);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [strength]);

  return ref;
}
