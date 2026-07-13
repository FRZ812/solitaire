import React from "react";
import titleBackdrop from "../assets/generated/jrpg-title-backdrop.png";

/**
 * Shared title/creation backdrop. The artwork is generated locally by
 * scripts/generate-jrpg-ui-assets.py on a 240px pixel canvas, then enlarged
 * with nearest-neighbour sampling to keep every pixel crisp.
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
