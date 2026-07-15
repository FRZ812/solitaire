import React from "react";
import { radius } from "./tokens.js";
import { ATTR_LABELS } from "../config.js";
import { tier as tierInfo } from "../data/tiers.js";
import { attrDescriptor, smoothStatSummary, attributeLadder, attrPurpose } from "../data/attribute-tiers.js";
import { vigorHealthBonus } from "../engine/attributes.js";

// Expanded detail for a tapped attribute: what it governs mechanically, its
// current always-on bonuses, and the full unique-unlock ladder (which thresholds
// this score has reached).
export function AttributeDetail({ attrKey, value }) {
  const smooth = smoothStatSummary(attrKey, value);
  // Vigor's payoff is max HP (it lives in vitalityMax, not the combat statMods),
  // so surface it here as its always-on line.
  if (attrKey === "vigor" && vigorHealthBonus(value) > 0) smooth.unshift(`+${vigorHealthBonus(value)} max HP`);
  const ladder = attributeLadder(attrKey, value);
  return (
    <div id={`attribute-detail-${attrKey}`} className="attribute-detail" style={{ borderRadius: radius.panelCompact }}>
      <div className="attribute-detail__heading">
        <div>
          <small>Capability profile</small>
          <strong>{ATTR_LABELS[attrKey]} <span>{attrDescriptor(attrKey, value)}</span></strong>
        </div>
        <em>{value}</em>
      </div>
      <p className="attribute-detail__purpose">{attrPurpose(attrKey)}</p>
      <div className="attribute-detail__eyebrow">Always active</div>
      <div className="attribute-detail__bonuses">
        {smooth.length ? smooth.join(" · ") : "Nothing yet — this score is too low to bend the fight."}
      </div>
      <div className="attribute-detail__eyebrow">Threshold path</div>
      <div className="attribute-detail__ladder">
        {ladder.map((step) => {
          const c = tierInfo(step.tier).color;
          return (
            <div key={step.at} className={`attribute-detail__step${step.reached ? " is-reached" : ""}`}>
              <span className="attribute-detail__node" style={{ "--attribute-tier": c }}>{step.reached ? "✓" : step.at}</span>
              <span><b>{step.at}+</b>{step.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
