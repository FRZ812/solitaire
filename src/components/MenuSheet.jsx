import React, { useState } from "react";
import { Icon } from "./Icon.jsx";
import {
  iconButtonStyle, ConditionPill, NeedBar, AttrBlock, StatBlock,
  SectionHeader, ErrorBanner,
} from "./primitives.jsx";
import { colors, alert, shadow, radius, glass, fonts, metaStyle } from "./tokens.js";
import { ATTR_KEYS, ATTR_LABELS } from "../config.js";
import { deriveCombatStats } from "../engine/combat-stats.js";
import { getAbilityDef } from "../data/abilities.js";
import { tierColor, tierLabel } from "../data/tiers.js";

// Item-specific inline icon. The wooden bird is a meaningful in-fiction
// item, so it gets a custom glyph; everything else falls back to a
// pouch/scroll outline.
function renderItemIcon(itemId) {
  if (itemId === "wooden-bird") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.gold} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "6px", display: "inline-block", verticalAlign: "middle" }}>
        <path d="M20 4 C16 4 13 7 11 9 C9 7 6 4 2 4 C5 9 8 11 11 12 C11 15 13 18 16 20 C16 16 15 13 14 11 C16 9 19 6 20 4 Z" fill="rgba(215, 167, 111, 0.25)" />
        <line x1="16" y1="10" x2="19" y2="7" stroke={colors.parchmentMuted} strokeWidth="1.2" />
        <line x1="15" y1="12" x2="17.5" y2="9.5" stroke={colors.parchmentMuted} strokeWidth="1.2" />
        <circle cx="11.5" cy="11.5" r="0.75" fill={colors.parchmentLight} />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(215, 167, 111, 0.75)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "6px", display: "inline-block", verticalAlign: "middle" }}>
      <path d="M6 20a6 6 0 0 0 12 0V10a6 6 0 0 0-12 0v10z" fill="rgba(215, 167, 111, 0.05)" />
      <path d="M6 10c0-2.5 1.5-4 6-4s6 1.5 6 4" />
      <path d="M9 6a3 3 0 0 1 6 0" />
      <line x1="8" x2="16" y1="12" y2="12" />
    </svg>
  );
}

// Compact label/value cell for the derived combat stats grid.
function CombatStat({ label, value }) {
  return (
    <div style={{
      padding: "7px 8px",
      backgroundColor: "rgba(20, 29, 29, 0.35)",
      border: `1px solid rgba(215, 167, 111, 0.14)`,
      borderRadius: "10px",
      display: "flex", flexDirection: "column", alignItems: "center",
    }}>
      <div style={{ ...metaStyle, fontSize: "8px", letterSpacing: "0.1em", color: colors.gold }}>{label}</div>
      <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "17px", color: colors.parchment, lineHeight: 1.1, marginTop: "2px" }}>{value}</div>
    </div>
  );
}

// Tier-coloured ability pill.
function AbilityChip({ name, tier }) {
  const c = tierColor(tier);
  return (
    <span title={tierLabel(tier)} style={{
      fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: radius.pill,
      color: c, border: `1px solid ${c}`, backgroundColor: `${c}18`,
    }}>{name}</span>
  );
}

// Inset gold-tinted container reused for Wealth / Wearing / Carrying.
const insetBoxStyle = {
  background: "rgba(215, 167, 111, 0.03)",
  border: `1px solid rgba(215, 167, 111, 0.08)`,
  borderRadius: radius.chip,
  padding: "8px 12px",
};

// Pill-shaped action button at the foot of the sheet.
function actionButtonStyle({ danger = false, ghost = false } = {}) {
  if (ghost) {
    return {
      display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
      padding: "12px",
      border: "none", borderRadius: radius.panelCompact,
      backgroundColor: "transparent",
      color: "rgba(215, 167, 111, 0.6)",
      fontSize: "12px", fontWeight: 700,
      cursor: "pointer", fontFamily: "inherit",
    };
  }
  if (danger) {
    return {
      display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
      padding: "13px",
      border: `1px solid rgba(239, 68, 68, 0.35)`,
      borderRadius: radius.panelCompact,
      backgroundColor: "rgba(239, 68, 68, 0.08)",
      color: alert.dangerAccent,
      fontSize: "13px", fontWeight: 700,
      cursor: "pointer", fontFamily: "inherit",
    };
  }
  return {
    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
    padding: "13px",
    border: `1px solid rgba(215, 167, 111, 0.25)`,
    borderRadius: radius.panelCompact,
    backgroundColor: "rgba(215, 167, 111, 0.08)",
    color: colors.parchmentLight,
    fontSize: "13px", fontWeight: 700,
    cursor: "pointer", fontFamily: "inherit",
  };
}

// Hairline rule used to separate the sheet's major groups (identity /
// stats / possessions / actions) so the section headers don't all read as
// one undifferentiated stack.
function Divider() {
  return (
    <div style={{
      height: "1px",
      margin: "2px 0",
      background: "linear-gradient(90deg, transparent, rgba(215, 167, 111, 0.2), transparent)",
    }} />
  );
}

export function MenuSheet({ state, user, onClose, onReset, onOpenCodex, onBackToCampaigns, onSignOut, onLinkEmail }) {
  const inv = state.character.inventory;
  const codex = state.world.codex;
  const wornIds = codex.characters.wanderer?.worn || [];
  const attrs = state.character.attributes;
  const combat = deriveCombatStats(state.character, codex);
  const learnedAbilities = state.character.abilities || [];

  const showGuestNag = user?.is_anonymous && onLinkEmail;

  return (
    <div
      style={{
        position: "absolute", inset: 0,
        backgroundColor: "rgba(11, 15, 14, 0.65)",
        backdropFilter: "blur(6px)",
        zIndex: 20,
        display: "flex", flexDirection: "column", justifyContent: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="slide-up no-scrollbar"
        style={{
          backgroundColor: "rgba(20, 29, 29, 0.92)",
          border: `1px solid rgba(215, 167, 111, 0.22)`,
          borderBottom: "none",
          borderTopLeftRadius: "24px",
          borderTopRightRadius: "24px",
          padding: "20px 22px calc(env(safe-area-inset-bottom, 0px) + 24px) 22px",
          display: "flex", flexDirection: "column", gap: "15px",
          maxHeight: "85dvh", overflowY: "auto",
          ...glass,
          boxShadow: shadow.sheet,
          color: colors.parchment,
        }}
      >
        {/* Grab handle — reads as a dismissable bottom sheet. */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: "-8px", marginBottom: "2px" }}>
          <div style={{ width: "38px", height: "4px", borderRadius: radius.pill, backgroundColor: "rgba(215, 167, 111, 0.28)" }} />
        </div>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...metaStyle, fontSize: "9px", letterSpacing: "0.18em", color: "rgba(215, 167, 111, 0.6)", marginBottom: "5px" }}>
              Character
            </div>
            <div style={{
              fontFamily: fonts.serif, fontStyle: "italic",
              fontSize: "26px", color: colors.parchmentLight, lineHeight: 1,
              textShadow: "0 2px 10px rgba(0,0,0,0.3)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {state.character.name}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              ...iconButtonStyle,
              width: "30px", height: "30px", flexShrink: 0,
              backgroundColor: "rgba(215, 167, 111, 0.08)",
              border: `1px solid rgba(215, 167, 111, 0.2)`,
            }}
          >
            <Icon name="x" size={13} color={colors.parchmentMuted} strokeWidth={2} />
          </button>
        </div>

        {/* Bond */}
        <div style={{
          fontFamily: fonts.serif, fontStyle: "italic",
          fontSize: "15px", lineHeight: "1.5",
          color: colors.parchmentMuted,
          paddingLeft: "12px",
          borderLeft: `2px solid rgba(215, 167, 111, 0.4)`,
          opacity: 0.95,
        }}>
          {state.character.bond}
        </div>

        <Divider />

        {/* Vitals — the two pools (Vitality / Resolve) and the three survival
            needs read as one "how am I holding up" block instead of two
            separate sections sitting apart in the stack. */}
        <div>
          <SectionHeader>Vitals</SectionHeader>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <StatBlock label="Vitality" value={`${Math.round(state.character.vitality)} / ${state.character.vitalityMax}`} />
            <StatBlock label="Resolve"  value={`${state.character.resolve} / ${state.character.resolveMax}`} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "9px", marginTop: "12px" }}>
            <NeedBar label="Hunger" value={state.character.needs.hunger} />
            <NeedBar label="Thirst" value={state.character.needs.thirst} />
            <NeedBar label="Sleep"  value={state.character.needs.sleep}  />
          </div>
        </div>

        {/* Attributes */}
        <div>
          <SectionHeader>Attributes</SectionHeader>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
            {ATTR_KEYS.map(k => <AttrBlock key={k} label={ATTR_LABELS[k]} score={attrs[k]} />)}
          </div>
        </div>

        {/* Combat — stats derived from attributes + equipped gear. */}
        <div>
          <SectionHeader>Combat</SectionHeader>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", marginBottom: "8px" }}>
            <CombatStat label="Armor" value={combat.armor} />
            <CombatStat label="Ward" value={combat.ward} />
            <CombatStat label="Dodge" value={`${combat.dodge}%`} />
            <CombatStat label="Crit" value={`${combat.critChance}%`} />
            <CombatStat label="Pen" value={combat.weapon.pen} />
            <CombatStat label="Damage" value={`${combat.weapon.min}–${combat.weapon.max}`} />
          </div>
          <div style={insetBoxStyle}>
            <div style={{ ...metaStyle, fontSize: "9px", letterSpacing: "0.12em", color: "rgba(215, 167, 111, 0.7)", marginBottom: "7px" }}>
              Abilities · {combat.weapon.name}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {[{ id: "basic-attack", tier: "common" }, { id: "defend", tier: "common" }, ...learnedAbilities].map((a, i) => {
                const def = getAbilityDef(typeof a === "string" ? a : a.id);
                if (!def) return null;
                return <AbilityChip key={i} name={def.name} tier={(typeof a === "object" && a.tier) || "common"} />;
              })}
            </div>
          </div>
        </div>

        {/* Conditions */}
        <div>
          <SectionHeader>Conditions</SectionHeader>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {state.character.conditions.length === 0
              ? <span style={{ fontSize: "12px", color: "rgba(237, 228, 208, 0.5)", fontStyle: "italic" }}>None</span>
              : state.character.conditions.map((c) => <ConditionPill key={c} label={c} />)}
          </div>
        </div>

        <Divider />

        {/* Wealth */}
        <div>
          <SectionHeader>Wealth</SectionHeader>
          <div style={{
            ...insetBoxStyle,
            fontFamily: fonts.serif, fontStyle: "italic",
            fontSize: "17px", color: colors.parchmentLight,
            display: "grid", gridTemplateColumns: "1fr 1px 1fr 1px 1fr",
            alignItems: "center", textAlign: "center",
          }}>
            <span><strong style={{ color: "#ffd700", fontWeight: "bold" }}>{inv.coins.gold}</strong> gp</span>
            <span style={{ width: "1px", height: "16px", background: "rgba(215, 167, 111, 0.18)", justifySelf: "center" }} />
            <span><strong style={{ color: "#d1d5db", fontWeight: "bold" }}>{inv.coins.silver}</strong> sp</span>
            <span style={{ width: "1px", height: "16px", background: "rgba(215, 167, 111, 0.18)", justifySelf: "center" }} />
            <span><strong style={{ color: "#cd7f32", fontWeight: "bold" }}>{inv.coins.copper}</strong> cp</span>
          </div>
        </div>

        {/* Wearing */}
        <div>
          <SectionHeader>Wearing</SectionHeader>
          <div style={{ ...insetBoxStyle, display: "flex", flexDirection: "column", gap: "2px" }}>
            {wornIds.length === 0
              ? <span style={{ fontSize: "12px", color: "rgba(237, 228, 208, 0.4)", fontStyle: "italic" }}>No equipped gear.</span>
              : wornIds.map((id) => (
                  <div key={id} style={{
                    fontSize: "13px", color: colors.parchment,
                    padding: "4px 0",
                    borderBottom: `1px dotted rgba(215, 167, 111, 0.1)`,
                    display: "flex", alignItems: "center",
                  }}>
                    {renderItemIcon(id)}
                    {codex.items[id]?.name || id}
                  </div>
                ))}
          </div>
        </div>

        {/* Carrying */}
        <div>
          <SectionHeader>Carrying (Pack)</SectionHeader>
          <div style={{ ...insetBoxStyle, display: "flex", flexDirection: "column", gap: "2px" }}>
            {inv.carried.length === 0
              ? <span style={{ fontSize: "12px", color: "rgba(237, 228, 208, 0.4)", fontStyle: "italic" }}>Pack is empty.</span>
              : inv.carried.map((c) => (
                  <div key={c.itemId} style={{
                    fontSize: "13px", color: colors.parchment,
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "4px 0",
                    borderBottom: `1px dotted rgba(215, 167, 111, 0.1)`,
                  }}>
                    <span style={{ display: "flex", alignItems: "center" }}>
                      {renderItemIcon(c.itemId)}
                      {codex.items[c.itemId]?.name || c.itemId}
                    </span>
                    <span style={{ color: colors.parchmentMuted, fontWeight: "bold" }}>×{c.quantity}</span>
                  </div>
                ))}
          </div>
        </div>

        {showGuestNag && <GuestNagSection onLinkEmail={onLinkEmail} />}

        <Divider />

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <button onClick={onOpenCodex} style={actionButtonStyle()}>
            <Icon name="book" size={14} strokeWidth={1.5} />
            Open Codex
          </button>
          {onBackToCampaigns && (
            <button onClick={onBackToCampaigns} style={actionButtonStyle()}>
              <Icon name="arrowLeft" size={14} strokeWidth={1.5} />
              Back to Campaigns
            </button>
          )}
          <button onClick={onReset} style={actionButtonStyle({ danger: true })}>
            <Icon name="reset" size={14} strokeWidth={1.5} />
            Reset Campaign
          </button>
          {onSignOut && (
            <button onClick={onSignOut} style={actionButtonStyle({ ghost: true })}>
              Sign Out
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function GuestNagSection({ onLinkEmail }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const addr = email.trim();
    if (!addr || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onLinkEmail(addr);
      setSent(true);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      marginTop: "4px",
      padding: "14px 16px",
      backgroundColor: "rgba(215, 167, 111, 0.06)",
      border: `1px solid rgba(215, 167, 111, 0.22)`,
      borderRadius: radius.panelCompact,
    }}>
      <div style={{
        ...metaStyle, fontSize: "10px", letterSpacing: "0.12em",
        color: colors.parchmentMuted, fontWeight: 700, marginBottom: "6px",
      }}>
        Playing as guest
      </div>
      <p style={{ margin: "0 0 10px 0", fontSize: "12px", color: "rgba(237, 228, 208, 0.75)", lineHeight: "1.45" }}>
        Link an email so you can resume your campaigns from another device.
      </p>
      {sent ? (
        <div style={{
          fontSize: "12px",
          color: alert.successText,
          padding: "8px 12px",
          backgroundColor: alert.successBg,
          border: `1px solid ${alert.successBorder}`,
          borderRadius: radius.chip,
        }}>
          Check <strong>{email}</strong> for a confirmation link.
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", gap: "8px" }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={busy}
            required
            className="custom-input"
            style={{
              flex: 1, padding: "9px 12px", fontSize: "13px",
              backgroundColor: "rgba(10, 15, 15, 0.65)", color: colors.parchment,
              border: `1px solid rgba(215, 167, 111, 0.2)`,
              borderRadius: radius.chip,
              fontFamily: "inherit", outline: "none", minWidth: 0,
            }}
          />
          <button
            type="submit"
            disabled={busy || !email.trim()}
            style={{
              padding: "9px 15px", fontSize: "12px", fontWeight: 700,
              backgroundColor: colors.gold, color: colors.ink,
              border: "none", borderRadius: radius.chip,
              cursor: (busy || !email.trim()) ? "default" : "pointer",
              opacity: (busy || !email.trim()) ? 0.4 : 1,
              fontFamily: "inherit", whiteSpace: "nowrap",
            }}
          >
            {busy ? "..." : "Link"}
          </button>
        </form>
      )}
      {error && <ErrorBanner style={{ margin: "8px 0 0" }}>{error}</ErrorBanner>}
    </div>
  );
}
