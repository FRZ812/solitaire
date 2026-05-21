import React from "react";
import { Icon } from "./Icon.jsx";
import { colors, alert, shadow, radius, glass, fonts, metaStyle } from "./tokens.js";

// ----- Buttons -----

// 36px circular glass button (menu sheet close, codex/map controls).
export const iconButtonStyle = {
  width: "36px", height: "36px",
  borderRadius: radius.pill,
  border: `1px solid rgba(215, 167, 111, 0.28)`,
  backgroundColor: "rgba(20, 29, 29, 0.52)",
  display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer", flexShrink: 0,
  boxShadow: `${shadow.subtle}, inset 0 1px 0 rgba(255,255,255,0.05)`,
  transition: "background-color 0.2s, border-color 0.2s, transform 0.1s",
};

// 44px rounded-square glass button (top header: map / codex / menu).
export const headerButtonStyle = {
  width: "44px", height: "44px",
  borderRadius: radius.panelCompact,
  border: `1px solid rgba(215, 167, 111, 0.28)`,
  backgroundColor: "rgba(20, 29, 29, 0.52)",
  display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer", flexShrink: 0,
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  boxShadow: `${shadow.subtle}, inset 0 1px 0 rgba(255, 255, 255, 0.05)`,
  transition: "background-color 0.2s, border-color 0.2s, transform 0.1s",
};

// ----- Panels -----

const panelShell = {
  marginBottom: "12px",
  boxShadow: shadow.panel,
  ...glass,
};

const panelTones = {
  default: {
    backgroundColor: "rgba(20, 29, 29, 0.65)",
    color: colors.parchment,
    border: "1px solid rgba(215, 167, 111, 0.15)",
  },
  warm: {
    backgroundColor: "rgba(48, 32, 20, 0.6)",
    color: colors.parchment,
    border: "1px solid rgba(215, 167, 111, 0.25)",
  },
  pale: {
    backgroundColor: "rgba(25, 34, 34, 0.72)",
    color: colors.parchmentLight,
    border: "1px solid rgba(215, 167, 111, 0.20)",
  },
  dark: {
    backgroundColor: "rgba(12, 17, 17, 0.78)",
    color: colors.parchment,
    border: "1px solid rgba(215, 167, 111, 0.22)",
  },
  encounter: {
    backgroundColor: "rgba(35, 15, 15, 0.72)",
    color: alert.dangerAccent,
    border: "1px solid rgba(239, 68, 68, 0.35)",
    boxShadow: `inset 0 0 10px rgba(239, 68, 68, 0.1), ${shadow.cardDeep}`,
  },
  discovery: {
    backgroundColor: "rgba(15, 35, 25, 0.72)",
    color: alert.successText,
    border: "1px solid rgba(52, 211, 153, 0.35)",
    boxShadow: `inset 0 0 10px rgba(52, 211, 153, 0.1), ${shadow.cardDeep}`,
  },
};

// Glass panel used for narration, dialogue, encounters, etc. Tones cover
// the standard game palette plus encounter/discovery accents.
export function Panel({ children, tone = "default", compact = false, style }) {
  return (
    <div className="fade-in" style={{
      ...panelShell,
      ...(panelTones[tone] || panelTones.default),
      borderRadius: compact ? radius.panelCompact : radius.panel,
      padding: compact ? "10px 12px" : "14px 16px",
      ...style,
    }}>
      {children}
    </div>
  );
}

// "◆ Label" section header used throughout MenuSheet.
export function SectionHeader({ children, color = colors.gold }) {
  return (
    <div style={{
      ...metaStyle,
      fontSize: "10px",
      letterSpacing: "0.14em",
      color,
      marginBottom: "8px",
      display: "flex", alignItems: "center", gap: "6px",
    }}>
      <span style={{ color, opacity: 0.6 }}>◆</span>
      {children}
    </div>
  );
}

// Unified error/danger banner. Replaces the bespoke error boxes each
// screen invented during the polish pass.
export function ErrorBanner({ children, style }) {
  return (
    <div style={{
      margin: "8px 0 12px",
      padding: "11px 13px",
      borderRadius: radius.panelCompact,
      backgroundColor: alert.dangerBg,
      border: `1px solid ${alert.dangerBorder}`,
      color: alert.dangerText,
      fontSize: "12px", lineHeight: 1.4,
      boxShadow: shadow.cardDeep,
      ...style,
    }}>
      {children}
    </div>
  );
}

// ----- Vitals strip -----

export function Vital({ icon, label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <div style={{ display: "flex", filter: "drop-shadow(0 0 4px rgba(215,167,111,0.25))" }}>
        {icon}
      </div>
      <span style={{ color: "rgba(237,228,208,0.54)", textTransform: "uppercase", fontSize: "9px", letterSpacing: "0.14em", fontWeight: 700 }}>{label}</span>
      <span style={{ fontWeight: 800, color: colors.parchment, textShadow: "0 1px 3px rgba(0,0,0,0.4)" }}>{value}</span>
    </div>
  );
}

export function ConditionPill({ label }) {
  return (
    <div style={{
      padding: "4px 9px",
      borderRadius: radius.pill,
      backgroundColor: "rgba(215, 167, 111, 0.07)",
      border: `1px solid rgba(215, 167, 111, 0.24)`,
      color: colors.gold,
      ...metaStyle,
      letterSpacing: "0.12em",
      textShadow: "0 0 6px rgba(215, 167, 111, 0.2)",
      boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
    }}>
      {label}
    </div>
  );
}

export function VitalsStrip({ character }) {
  const needs = character.needs || { hunger: 100, thirst: 100, sleep: 100 };
  return (
    <div style={{
      margin: "0 12px",
      padding: "10px 14px",
      display: "flex", flexDirection: "column", gap: "8px",
      backgroundColor: "rgba(20, 29, 29, 0.58)",
      border: `1px solid rgba(215, 167, 111, 0.18)`,
      borderRadius: radius.control,
      fontSize: "11px", fontWeight: 600,
      color: colors.parchment,
      ...glass,
      boxShadow: `0 10px 28px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.02)`,
    }}>
      {/* Row 1: vital pools + condition pills. */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        gap: "8px", flexWrap: "wrap",
      }}>
        <Vital icon={<Icon name="heart" size={12} color={colors.gold} strokeWidth={2} fill={colors.gold} />} label="Vit" value={`${Math.round(character.vitality)}/${character.vitalityMax}`} />
        <Vital icon={<Icon name="flame" size={12} color={colors.gold} strokeWidth={2} />} label="Res" value={`${character.resolve}/${character.resolveMax}`} />
        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
          {character.conditions.length === 0 ? (
            <span style={{ fontSize: "9px", color: "rgba(237, 228, 208, 0.36)", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>Clear</span>
          ) : (
            character.conditions.map((c) => <ConditionPill key={c} label={c} />)
          )}
        </div>
      </div>
      {/* Row 2: hunger / thirst / sleep as compact bars. Engine thresholds
          (engine/needs.js): ≤30 = warning, ≤10 = critical. */}
      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
        <MiniNeedBar label="Hgr" value={needs.hunger} ariaLabel={`Hunger ${Math.round(needs.hunger)} of 100`} />
        <MiniNeedBar label="Thr" value={needs.thirst} ariaLabel={`Thirst ${Math.round(needs.thirst)} of 100`} />
        <MiniNeedBar label="Slp" value={needs.sleep}  ariaLabel={`Sleep ${Math.round(needs.sleep)} of 100`} />
      </div>
    </div>
  );
}

// Compact one-line needs meter for the HUD. The fuller `NeedBar` further
// down is used in the character panel and renders the numeric value too;
// MiniNeedBar drops the number so three of them fit comfortably on a
// single row of the VitalsStrip on a phone.
function MiniNeedBar({ label, value, ariaLabel }) {
  const pct = Math.max(0, Math.min(100, value));
  const color =
    pct <= 10 ? "#fca5a5" :   // critical (Starving / Parched / Exhausted)
    pct <= 30 ? "#f5b97a" :   // low      (Hungry / Thirsty / Tired)
    colors.gold;              // ok
  return (
    <div
      style={{ flex: 1, display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}
      title={ariaLabel}
      aria-label={ariaLabel}
    >
      <span style={{
        fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase",
        color: "rgba(237, 228, 208, 0.55)", fontWeight: 700,
        flexShrink: 0, minWidth: "20px",
      }}>{label}</span>
      <div style={{
        flex: 1, height: "5px", borderRadius: "999px",
        backgroundColor: "rgba(10, 15, 14, 0.6)",
        border: "1px solid rgba(215, 167, 111, 0.10)",
        overflow: "hidden",
      }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          backgroundColor: color,
          boxShadow: `0 0 6px ${color}55`,
          transition: "width 0.3s ease-out, background-color 0.2s",
        }} />
      </div>
    </div>
  );
}

// ----- Loading / live thinking -----

export function LoadingDots() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 2px", opacity: 0.78 }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{
          width: "6px", height: "6px", borderRadius: "50%",
          backgroundColor: colors.gold,
          animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </div>
  );
}

export function LiveThinking({ thinking }) {
  return (
    <div style={{ marginBottom: "12px", paddingLeft: "2px" }}>
      <LoadingDots />
      {thinking && (
        <details style={{ marginTop: "2px" }} open>
          <summary style={{
            ...metaStyle,
            letterSpacing: "0.18em",
            color: "rgba(215, 167, 111, 0.64)",
            cursor: "pointer", userSelect: "none",
          }}>
            Thinking
          </summary>
          <div style={{
            marginTop: "6px",
            padding: "12px 14px",
            backgroundColor: "rgba(10, 15, 15, 0.64)",
            border: `1px solid rgba(215, 167, 111, 0.14)`,
            borderRadius: radius.panelCompact,
            fontSize: "12px", lineHeight: "1.52",
            color: "rgba(237, 228, 208, 0.85)",
            whiteSpace: "pre-wrap",
            backdropFilter: "blur(10px)",
            boxShadow: "inset 0 10px 24px rgba(0,0,0,0.3)",
          }}>
            {thinking}
          </div>
        </details>
      )}
    </div>
  );
}

// ----- Input bar -----

export function InputBar({ value, onChange, onSubmit, loading }) {
  const disabled = loading || !value.trim();
  return (
    <div style={{
      padding: "10px 12px calc(env(safe-area-inset-bottom, 0px) + 12px) 12px",
      background: "linear-gradient(180deg, rgba(11,15,14,0) 0%, rgba(11,15,14,0.62) 20%, rgba(11,15,14,0.92) 100%)",
      display: "flex", alignItems: "center", gap: "9px",
    }}>
      <input
        type="text" value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmit(); } }}
        placeholder="What do you do?" disabled={loading}
        style={{
          flex: 1, height: "48px",
          borderRadius: radius.control,
          border: `1px solid rgba(215, 167, 111, 0.22)`,
          backgroundColor: "rgba(10, 15, 15, 0.65)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          padding: "0 18px", fontSize: "14px", color: colors.parchment,
          outline: "none",
          transition: "border-color 0.2s, box-shadow 0.2s",
          boxShadow: `0 10px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.02)`,
        }}
      />
      <button
        onClick={onSubmit} disabled={disabled}
        style={{
          width: "48px", height: "48px",
          borderRadius: radius.control,
          backgroundColor: disabled ? "rgba(215, 167, 111, 0.08)" : colors.gold,
          border: `1px solid rgba(215, 167, 111, 0.28)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: disabled ? "not-allowed" : "pointer",
          flexShrink: 0,
          boxShadow: "0 10px 24px rgba(0,0,0,0.3)",
        }}
      >
        <Icon name="send" size={17} color={disabled ? "rgba(215, 167, 111, 0.3)" : colors.ink} strokeWidth={2.2} />
      </button>
    </div>
  );
}

// ----- Character sheet blocks -----

export function StatBlock({ label, value }) {
  return (
    <div style={{
      padding: "10px 14px",
      backgroundColor: "rgba(20, 29, 29, 0.42)",
      border: `1px solid rgba(215, 167, 111, 0.16)`,
      borderRadius: radius.panelCompact,
      boxShadow: `${shadow.subtle}, inset 0 1px 0 rgba(255,255,255,0.02)`,
    }}>
      <div style={{ ...metaStyle, fontSize: "9px", letterSpacing: "0.14em", color: colors.gold, marginBottom: "3px" }}>{label}</div>
      <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "20px", color: colors.parchment }}>{value}</div>
    </div>
  );
}

export function AttrBlock({ label, score }) {
  return (
    <div style={{
      padding: "9px 10px",
      backgroundColor: "rgba(20, 29, 29, 0.35)",
      border: `1px solid rgba(215, 167, 111, 0.14)`,
      borderRadius: "12px",
      display: "flex", flexDirection: "column", alignItems: "center",
      boxShadow: "0 4px 10px rgba(0,0,0,0.12)",
    }}>
      <div style={{ ...metaStyle, fontSize: "9px", letterSpacing: "0.12em", color: colors.gold }}>{label}</div>
      <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "22px", color: colors.parchment, lineHeight: "1.1", marginTop: "2px" }}>{score ?? 0}</div>
    </div>
  );
}

export function NeedBar({ label, value }) {
  const v = Math.round(value);
  const barColor = v > 50
    ? "linear-gradient(90deg, #606d43 0%, #7B8460 100%)"
    : v > 25
      ? "linear-gradient(90deg, #b09156 0%, #C0A46C 100%)"
      : "linear-gradient(90deg, #7c3b2d 0%, #8F4C3C 100%)";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", alignItems: "baseline" }}>
        <span style={{ ...metaStyle, fontSize: "9px", letterSpacing: "0.14em", color: "rgba(237, 228, 208, 0.72)" }}>{label}</span>
        <span style={{ fontSize: "11px", color: colors.parchment, fontWeight: 700 }}>{v}/100</span>
      </div>
      <div style={{
        width: "100%", height: "7px",
        backgroundColor: "rgba(0, 0, 0, 0.38)",
        border: `1px solid rgba(215, 167, 111, 0.12)`,
        borderRadius: "4px", overflow: "hidden",
        boxShadow: "inset 0 1px 3px rgba(0,0,0,0.4)",
      }}>
        <div style={{
          width: `${v}%`, height: "100%",
          background: barColor,
          borderRadius: "3px",
          transition: "width 0.4s cubic-bezier(0.16, 1, 0.3, 1), background 0.4s",
          boxShadow: v > 25 ? "0 0 6px rgba(215,167,111,0.2)" : "0 0 6px rgba(143,76,60,0.4)",
        }} />
      </div>
    </div>
  );
}
