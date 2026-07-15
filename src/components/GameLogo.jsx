import React from "react";
import logo from "../assets/generated/logo-solitaire-compass-v1.png";

export function GameLogo({ className = "", compact = false }) {
  return (
    <img
      className={`brand-logo${compact ? " brand-logo--compact" : ""}${className ? ` ${className}` : ""}`}
      src={logo}
      alt="Solitaire"
      draggable="false"
    />
  );
}
