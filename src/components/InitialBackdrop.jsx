import React from "react";
import titleBackdrop from "../assets/generated/scene-tellmar-road-v2.webp";

/**
 * Shared title/creation backdrop. The production plate follows the same
 * high-definition oil-brush direction as the in-world region scenes.
 */
export function InitialBackdrop() {
  return (
    <div className="initial-backdrop" aria-hidden="true">
      <img className="initial-backdrop__art" src={titleBackdrop} alt="" draggable="false" />
      <div className="initial-backdrop__sky" />
      <div className="initial-backdrop__shade" />
      <div className="initial-backdrop__scanlines" />
    </div>
  );
}
