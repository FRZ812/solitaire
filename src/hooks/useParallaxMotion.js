import { useEffect, useRef } from "react";

const MOTION_PERMISSION_EVENT = "solitaire:motion-permission";

const ZERO_VARS = {
  "--parallax-far-x": "0px",
  "--parallax-far-y": "0px",
  "--parallax-mid-x": "0px",
  "--parallax-mid-y": "0px",
  "--parallax-near-x": "0px",
  "--parallax-near-y": "0px",
};

function clamp(value, min = -1, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function writeParallaxVars(node, x, y, strength) {
  const layers = {
    far: { x: x * -4 * strength, y: y * -3 * strength },
    mid: { x: x * -9 * strength, y: y * -6 * strength },
    near: { x: x * -13 * strength, y: y * -8.5 * strength },
  };

  for (const [name, offset] of Object.entries(layers)) {
    node.style.setProperty(`--parallax-${name}-x`, `${offset.x.toFixed(2)}px`);
    node.style.setProperty(`--parallax-${name}-y`, `${offset.y.toFixed(2)}px`);
  }
}

export function parallaxPermissionRequired() {
  return typeof window !== "undefined"
    && typeof window.DeviceOrientationEvent?.requestPermission === "function";
}

export async function requestParallaxMotionPermission() {
  if (!parallaxPermissionRequired()) return true;

  try {
    const permission = await window.DeviceOrientationEvent.requestPermission();
    const granted = permission === "granted";
    window.dispatchEvent(new CustomEvent(MOTION_PERMISSION_EVENT, { detail: { granted } }));
    return granted;
  } catch {
    window.dispatchEvent(new CustomEvent(MOTION_PERMISSION_EVENT, { detail: { granted: false } }));
    return false;
  }
}

function orientVector(x, y) {
  const angle = Number(window.screen?.orientation?.angle ?? window.orientation ?? 0);
  if (angle === 90) return { x: -y, y: x };
  if (angle === -90 || angle === 270) return { x: y, y: -x };
  if (Math.abs(angle) === 180) return { x: -x, y: -y };
  return { x, y };
}
/**
 * Coalesces mouse, touch, and device-orientation input into CSS variables
 * without rerendering React. Orientation is calibrated from the device's
 * resting angle, so a comfortable phone hold becomes the neutral position.
 */
export function useParallaxMotion({ strength = 1 } = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof window === "undefined") return undefined;

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (reduced?.matches) {
      for (const [key, value] of Object.entries(ZERO_VARS)) node.style.setProperty(key, value);
      return undefined;
    }

    let frame = 0;
    let currentX = 0;
    let currentY = 0;
    let targetX = 0;
    let targetY = 0;
    let touchActive = false;
    let lastSensorAt = 0;
    let sensorOrigin = null;

    const render = () => {
      frame = 0;
      currentX += (targetX - currentX) * 0.1;
      currentY += (targetY - currentY) * 0.1;
      writeParallaxVars(node, currentX, currentY, strength);

      if (Math.abs(targetX - currentX) > 0.002 || Math.abs(targetY - currentY) > 0.002) {
        frame = window.requestAnimationFrame(render);
      }
    };

    const requestRender = () => {
      if (!frame) frame = window.requestAnimationFrame(render);
    };

    const setFromPoint = (clientX, clientY) => {
      targetX = clamp((clientX / Math.max(window.innerWidth, 1) - 0.5) * 2);
      targetY = clamp((clientY / Math.max(window.innerHeight, 1) - 0.5) * 2);
      requestRender();
    };

    const onPointerDown = (event) => {
      if (event.pointerType !== "touch") return;
      touchActive = true;
      if (Date.now() - lastSensorAt > 1200) setFromPoint(event.clientX, event.clientY);
    };

    const onPointerMove = (event) => {
      if (event.pointerType === "touch") {
        if (!touchActive || Date.now() - lastSensorAt < 1200) return;
      }
      setFromPoint(event.clientX, event.clientY);
    };

    const onPointerUp = (event) => {
      if (event.pointerType !== "touch") return;
      touchActive = false;
      if (Date.now() - lastSensorAt > 1200) reset();
    };

    const onOrientation = (event) => {
      if (!Number.isFinite(event.gamma) || !Number.isFinite(event.beta)) return;
      if (!sensorOrigin) {
        sensorOrigin = { gamma: event.gamma, beta: event.beta };
        return;
      }

      const rawX = clamp((event.gamma - sensorOrigin.gamma) / 14);
      const rawY = clamp((event.beta - sensorOrigin.beta) / 14);
      const oriented = orientVector(rawX, rawY);
      targetX = oriented.x;
      targetY = oriented.y;
      lastSensorAt = Date.now();
      requestRender();
    };

    const reset = () => {
      targetX = 0;
      targetY = 0;
      requestRender();
    };

    const recalibrate = () => {
      sensorOrigin = null;
      reset();
    };

    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerUp, { passive: true });
    window.addEventListener("deviceorientation", onOrientation, { passive: true });
    window.addEventListener("orientationchange", recalibrate, { passive: true });
    window.addEventListener(MOTION_PERMISSION_EVENT, recalibrate);
    window.addEventListener("blur", reset);
    document.addEventListener("mouseleave", reset);

    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("deviceorientation", onOrientation);
      window.removeEventListener("orientationchange", recalibrate);
      window.removeEventListener(MOTION_PERMISSION_EVENT, recalibrate);
      window.removeEventListener("blur", reset);
      document.removeEventListener("mouseleave", reset);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [strength]);

  return ref;
}
