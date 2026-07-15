import React, { useState } from "react";
import { Icon } from "./Icon.jsx";
import {
  parallaxPermissionRequired,
  requestParallaxMotionPermission,
} from "../hooks/useParallaxMotion.js";

export function MotionPermissionButton({ compact = false, className = "" }) {
  const [status, setStatus] = useState("idle");
  const required = parallaxPermissionRequired();

  if (!required) return null;

  async function enableMotion() {
    if (status === "requesting") return;
    setStatus("requesting");
    const granted = await requestParallaxMotionPermission();
    setStatus(granted ? "granted" : "denied");
  }

  const label = status === "granted"
    ? "Tilt enabled"
    : status === "denied"
      ? "Tilt unavailable"
      : status === "requesting"
        ? "Enabling tilt…"
        : "Enable tilt";

  return (
    <button
      type="button"
      className={`motion-permission${compact ? " is-compact" : ""}${className ? ` ${className}` : ""}`}
      onClick={enableMotion}
      disabled={status === "requesting" || status === "granted"}
      aria-live="polite"
    >
      <Icon name="compass" size={compact ? 13 : 14} strokeWidth={1.6} />
      <span>{compact && status === "idle" ? "Tilt" : label}</span>
    </button>
  );
}
