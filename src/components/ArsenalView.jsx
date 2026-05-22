import React from "react";
import { Icon } from "./Icon.jsx";
import { iconButtonStyle, SectionHeader } from "./primitives.jsx";
import { colors, radius, fonts, metaStyle, glass, shadow } from "./tokens.js";
import { tierColor, tierLabel, tierOrder } from "../data/tiers.js";
import { getAbilityDef } from "../data/abilities.js";
import { PROFICIENCIES, ratingFromXp, proficiencyDef } from "../data/proficiencies.js";
import { ATTR_LABELS } from "../config.js";

const CORE = new Set(["basic-attack", "defend", "talk"]);

function costLabel(def) {
  const parts = [];
  if (def.cost) parts.push(`${def.cost} stam`);
  if (def.resolveCost) parts.push(`${def.resolveCost} res`);
  if (def.cooldown) parts.push(`cd ${def.cooldown}`);
  return parts.join(" · ") || "free";
}

// Full list of the character's abilities + proficiencies, sorted by tier /
// rating (highest first). Opened from the character panel so the panel itself
// stays a tidy preview.
export function ArsenalView({ character, onClose }) {
  const learned = (character.abilities || []).map((a) => (typeof a === "string" ? { id: a, tier: "common" } : { id: a.id, tier: a.tier || "common" }));
  const abilities = [...learned, ...[...CORE].map((id) => ({ id, tier: "common" }))]
    .filter((a) => getAbilityDef(a.id))
    .sort((a, b) => tierOrder(b.tier) - tierOrder(a.tier));

  const profs = PROFICIENCIES
    .map((p) => ({ ...p, xp: character.proficiencies?.[p.id] || 0, rating: ratingFromXp(character.proficiencies?.[p.id] || 0) }))
    .filter((p) => p.xp > 0)
    .sort((a, b) => b.rating - a.rating || b.xp - a.xp);

  return (
    <div onClick={onClose} style={{
      position: "absolute", inset: 0, zIndex: 40,
      backgroundColor: "rgba(8, 12, 12, 0.86)", backdropFilter: "blur(8px)",
      display: "flex", flexDirection: "column", justifyContent: "flex-end",
    }}>
      <div onClick={(e) => e.stopPropagation()} className="slide-up custom-scroll" style={{
        backgroundColor: "rgba(20, 29, 29, 0.96)",
        border: `1px solid rgba(215, 167, 111, 0.22)`, borderBottom: "none",
        borderTopLeftRadius: "24px", borderTopRightRadius: "24px",
        padding: "18px 20px calc(env(safe-area-inset-bottom, 0px) + 22px) 20px",
        maxHeight: "88dvh", overflowY: "auto", ...glass, boxShadow: shadow.sheet, color: colors.parchment,
        display: "flex", flexDirection: "column", gap: "14px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "22px", color: colors.parchmentLight }}>Arsenal</div>
          <button onClick={onClose} aria-label="Close" style={{ ...iconButtonStyle, width: "30px", height: "30px", backgroundColor: "rgba(215,167,111,0.08)", border: `1px solid rgba(215,167,111,0.2)` }}>
            <Icon name="x" size={13} color={colors.parchmentMuted} strokeWidth={2} />
          </button>
        </div>

        <div>
          <SectionHeader>Abilities</SectionHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {abilities.map((a, i) => {
              const def = getAbilityDef(a.id);
              const c = tierColor(a.tier);
              return (
                <div key={`${a.id}-${i}`} style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "8px 11px", borderRadius: radius.chip,
                  backgroundColor: "rgba(20,29,29,0.5)", border: `1px solid ${a.tier === "common" ? "rgba(215,167,111,0.14)" : c}`,
                }}>
                  <Icon name={def.icon || "swords"} size={14} color={c} strokeWidth={1.8} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "7px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: colors.parchment }}>{def.name}</span>
                      {a.tier !== "common" && <span style={{ fontSize: "8px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: c }}>{tierLabel(a.tier)}</span>}
                      <span style={{ fontSize: "8px", color: "rgba(237,228,208,0.4)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{def.school}</span>
                    </div>
                    <div style={{ fontSize: "11px", color: "rgba(237,228,208,0.6)", lineHeight: 1.35, marginTop: "2px" }}>{def.desc}</div>
                  </div>
                  <span style={{ fontSize: "8px", color: "rgba(237,228,208,0.45)", whiteSpace: "nowrap", flexShrink: 0 }}>{costLabel(def)}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <SectionHeader>Proficiencies</SectionHeader>
          {profs.length === 0
            ? <div style={{ fontSize: "12px", color: "rgba(237,228,208,0.45)", fontStyle: "italic" }}>None yet — fight, cast, and survive to improve.</div>
            : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                {profs.map((p) => (
                  <div key={p.id} style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    padding: "8px 10px", borderRadius: radius.chip,
                    backgroundColor: "rgba(20,29,29,0.5)", border: `1px solid rgba(215,167,111,0.16)`,
                  }}>
                    <div style={{
                      width: "26px", height: "26px", borderRadius: "8px", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      backgroundColor: "rgba(215,167,111,0.1)", border: `1px solid rgba(215,167,111,0.28)`,
                      fontFamily: fonts.serif, fontStyle: "italic", fontSize: "15px", color: colors.gold,
                    }}>{p.rating}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: colors.parchment, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                      <div style={{ fontSize: "8px", color: "rgba(237,228,208,0.45)", textTransform: "uppercase", letterSpacing: "0.08em" }}>feeds {ATTR_LABELS[proficiencyDef(p.id)?.attr] || ""}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
