import React from "react";
import titleBackdrop from "../assets/generated/title-solitaire-daylight-v2.webp";
import titleForeground from "../assets/generated/title-solitaire-daylight-foreground-v2.png";
import { useParallaxMotion } from "../hooks/useParallaxMotion.js";

const MOTES = [
  [8, 82, 0.2, 9], [17, 70, 1.9, 7], [27, 90, 3.7, 10], [39, 76, 5.3, 8],
  [54, 86, 2.8, 11], [67, 72, 6.4, 7], [77, 92, 4.6, 9], [89, 78, 1.1, 8],
];

/**
 * Shared title/creation backdrop. The production plate follows the same
 * high-definition oil-brush direction as the in-world region scenes.
 */
export function InitialBackdrop() {
  const backdropRef = useParallaxMotion({ strength: 1.15 });

  return (
    <div ref={backdropRef} className="initial-backdrop" aria-hidden="true">
      <div className="initial-backdrop__layer initial-backdrop__layer--far">
        <img className="initial-backdrop__art" src={titleBackdrop} alt="" draggable="false" />
      </div>
      <div className="initial-backdrop__layer initial-backdrop__layer--mid">
        <div className="initial-backdrop__atmosphere" />
      </div>
      <div className="initial-backdrop__sky" />
      <div className="initial-backdrop__shade" />
      <div className="initial-backdrop__scanlines" />
      <div className="initial-backdrop__motes">
        {MOTES.map(([left, top, delay, duration], index) => (
          <span key={index} style={{ left: `${left}%`, top: `${top}%`, animationDelay: `${delay}s`, animationDuration: `${duration}s` }} />
        ))}
      </div>
      <div className="initial-backdrop__layer initial-backdrop__layer--near">
        <img className="initial-backdrop__foreground" src={titleForeground} alt="" draggable="false" />
      </div>
    </div>
  );
}
