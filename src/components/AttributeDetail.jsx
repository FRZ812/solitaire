import React from "react";
import { colors, radius } from "./tokens.js";
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
    <div style={{ marginTop: "8px", padding: "9px 11px", borderRadius: radius.panelCompact, backgroundColor: "rgba(10,15,15,0.45)", border: `1px solid rgba(215,167,111,0.2)` }}>
      <div style={{ fontSize: "12px", color: colors.parchmentLight, fontWeight: 700, marginBottom: "5px" }}>
        {ATTR_LABELS[attrKey]} {value} <span style={{ color: "rgba(215,167,111,0.7)", fontWeight: 400 }}>· {attrDescriptor(attrKey, value)}</span>
      </div>
      <div style={{ fontSize: "11.5px", color: "rgba(237,228,208,0.85)", lineHeight: 1.5, marginBottom: "8px" }}>{attrPurpose(attrKey)}</div>
      <div style={{ fontSize: "9px", color: "rgba(215,167,111,0.6)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "3px" }}>Always on now</div>
      <div style={{ fontSize: "11px", color: "rgba(237,228,208,0.85)", lineHeight: 1.45, marginBottom: "8px" }}>
        {smooth.length ? smooth.join(" · ") : "Nothing yet — this score is too low to bend the fight."}
      </div>
      <div style={{ fontSize: "9px", color: "rgba(215,167,111,0.6)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>Threshold unlocks</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
        {ladder.map((step) => {
          const c = tierInfo(step.tier).color;
          return (
            <div key={step.at} style={{ display: "flex", gap: "8px", alignItems: "baseline", opacity: step.reached ? 1 : 0.45 }}>
              <span style={{ flexShrink: 0, fontSize: "10px", fontWeight: 800, color: step.reached ? c : "rgba(237,228,208,0.5)", width: "34px" }}>
                {step.reached ? "✓ " : ""}{step.at}+
              </span>
              <span style={{ fontSize: "11px", color: step.reached ? "rgba(237,228,208,0.9)" : "rgba(237,228,208,0.6)", lineHeight: 1.4 }}>{step.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
