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
  const vitMax = character.vitalityMax || 1;
  const resMax = character.resolveMax || 1;
  return (
    <div style={{
      margin: "0 12px",
      padding: "6px 10px",
      display: "flex", flexDirection: "column", gap: "5px",
      backgroundColor: "rgba(20, 29, 29, 0.58)",
      border: `1px solid rgba(215, 167, 111, 0.18)`,
      borderRadius: radius.control,
      color: colors.parchment,
      ...glass,
      boxShadow: `0 10px 28px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.02)`,
    }}>
      {/* Five radial meters in a single row — vit / res / hunger / thirst /
          sleep — so the whole HUD is one strip even on a narrow phone.
          Engine thresholds (engine/needs.js): ≤30% amber, ≤10% red. The
          same threshold applies to vit/res so a near-dead player gets the
          warning before the condition pill fires. */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        gap: "4px",
      }}>
        <RadialMeter
          iconName="heart" iconFill={colors.gold}
          value={character.vitality} max={vitMax}
          label={`${Math.round(character.vitality)}/${vitMax}`}
          ariaLabel={`Vitality ${Math.round(character.vitality)} of ${vitMax}`}
        />
        <RadialMeter
          iconName="flame"
          value={character.resolve} max={resMax}
          label={`${character.resolve}/${resMax}`}
          ariaLabel={`Resolve ${character.resolve} of ${resMax}`}
        />
        <RadialMeter
          iconName="drumstick"
          value={needs.hunger} max={100}
          label={Math.round(needs.hunger)}
          ariaLabel={`Hunger ${Math.round(needs.hunger)} of 100`}
        />
        <RadialMeter
          iconName="droplet"
          value={needs.thirst} max={100}
          label={Math.round(needs.thirst)}
          ariaLabel={`Thirst ${Math.round(needs.thirst)} of 100`}
        />
        <RadialMeter
          iconName="moon"
          value={needs.sleep} max={100}
          label={Math.round(needs.sleep)}
          ariaLabel={`Sleep ${Math.round(needs.sleep)} of 100`}
        />
      </div>

      {/* Condition pills — only when there's something active. Hidden when
          clear so the strip stays one row in the common case. */}
      {character.conditions.length > 0 && (
        <div style={{
          display: "flex", gap: "5px", flexWrap: "wrap",
          justifyContent: "center",
          paddingTop: "4px",
          borderTop: `1px solid rgba(215, 167, 111, 0.10)`,
        }}>
          {character.conditions.map((c) => <ConditionPill key={c} label={c} />)}
        </div>
      )}
    </div>
  );
}

// Circular pool/needs meter: a faint background ring, a coloured arc whose
// length is value/max, and the icon centred. Numeric value below in tiny
// uppercase. Colour follows the engine's need-threshold convention so all
// five gauges read consistently:
//   ≤10% → red    (Starving / Parched / Exhausted / near-death vitality)
//   ≤30% → amber  (Hungry / Thirsty / Tired / wounded vitality)
//   else → gold
function RadialMeter({ iconName, iconFill, value, max, label, ariaLabel }) {
  const v = Number.isFinite(value) ? value : 0;
  const m = Math.max(1, max);
  const pct = Math.max(0, Math.min(100, (v / m) * 100));
  const color =
    pct <= 10 ? "#fca5a5" :
    pct <= 30 ? "#f5b97a" :
    colors.gold;

  // Geometry: 28×28 box, ring radius 12, stroke 2.5. Circumference = 2πr.
  const SIZE = 28;
  const R = 12;
  const C = 2 * Math.PI * R;
  const dashOffset = C * (1 - pct / 100);

  return (
    <div
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", minWidth: 0 }}
      title={ariaLabel}
      aria-label={ariaLabel}
    >
      <div style={{ position: "relative", width: SIZE, height: SIZE }}>
        <svg
          width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}
          style={{ transform: "rotate(-90deg)", display: "block" }}
        >
          {/* faint background ring */}
          <circle cx={SIZE/2} cy={SIZE/2} r={R}
                  fill="none" stroke="rgba(215, 167, 111, 0.14)" strokeWidth="2.5" />
          {/* progress arc */}
          <circle cx={SIZE/2} cy={SIZE/2} r={R}
                  fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"
                  strokeDasharray={C} strokeDashoffset={dashOffset}
                  style={{
                    transition: "stroke-dashoffset 0.4s cubic-bezier(0.16,1,0.3,1), stroke 0.2s",
                    filter: `drop-shadow(0 0 3px ${color}66)`,
                  }} />
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}>
          <Icon name={iconName} size={11} color={color} fill={iconFill || "none"} strokeWidth={1.8} />
        </div>
      </div>
      <span style={{
        fontSize: "8px", letterSpacing: "0.04em", color,
        fontWeight: 700, lineHeight: 1, whiteSpace: "nowrap",
      }}>{label}</span>
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
  const ref = React.useRef(null);
  // Grow the field with its content (up to a cap, then it scrolls), so a longer
  // action is easy to write and read back before sending.
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);
  return (
    <div style={{
      padding: "10px 12px calc(env(safe-area-inset-bottom, 0px) + 12px) 12px",
      background: "linear-gradient(180deg, rgba(11,15,14,0) 0%, rgba(11,15,14,0.62) 20%, rgba(11,15,14,0.92) 100%)",
      display: "flex", alignItems: "flex-end", gap: "9px",
    }}>
      <textarea
        ref={ref}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        // Enter adds a new line (there's a Send button); ⌘/Ctrl+Enter sends.
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); if (!disabled) onSubmit(); } }}
        placeholder="What do you do?" disabled={loading}
        style={{
          flex: 1, minHeight: "48px", maxHeight: "160px",
          boxSizing: "border-box", resize: "none", overflowY: "auto",
          borderRadius: radius.control,
          border: `1px solid rgba(215, 167, 111, 0.22)`,
          backgroundColor: "rgba(10, 15, 15, 0.65)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          padding: "13px 18px", fontSize: "14px", lineHeight: 1.4, color: colors.parchment,
          outline: "none", fontFamily: "inherit",
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

export function AttrBlock({ label, score, active, onClick }) {
  return (
    <button onClick={onClick} disabled={!onClick} style={{
      padding: "9px 10px", width: "100%", fontFamily: "inherit",
      backgroundColor: active ? "rgba(215, 167, 111, 0.16)" : "rgba(20, 29, 29, 0.35)",
      border: `1px solid ${active ? "rgba(215, 167, 111, 0.5)" : "rgba(215, 167, 111, 0.14)"}`,
      borderRadius: "12px",
      display: "flex", flexDirection: "column", alignItems: "center",
      boxShadow: "0 4px 10px rgba(0,0,0,0.12)", cursor: onClick ? "pointer" : "default",
    }}>
      <div style={{ ...metaStyle, fontSize: "9px", letterSpacing: "0.12em", color: colors.gold }}>{label}</div>
      <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "22px", color: colors.parchment, lineHeight: "1.1", marginTop: "2px" }}>{score ?? 0}</div>
    </button>
  );
}

export function NeedBar({ label, value }) {
  return <StatBar label={label} value={value} max={100} />;
}

// Labelled progress bar showing value / max. Default colouring follows the
// need-threshold convention (green > 50% > amber > 25% > red); pass `gradient`
// to override (e.g. Resolve's violet).
export function StatBar({ label, value, max = 100, gradient }) {
  const v = Math.round(value);
  const m = Math.max(1, max);
  const pct = Math.max(0, Math.min(100, (v / m) * 100));
  const barColor = gradient || (pct > 50
    ? "linear-gradient(90deg, #606d43 0%, #7B8460 100%)"
    : pct > 25
      ? "linear-gradient(90deg, #b09156 0%, #C0A46C 100%)"
      : "linear-gradient(90deg, #7c3b2d 0%, #8F4C3C 100%)");

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", alignItems: "baseline" }}>
        <span style={{ ...metaStyle, fontSize: "9px", letterSpacing: "0.14em", color: "rgba(237, 228, 208, 0.72)" }}>{label}</span>
        <span style={{ fontSize: "11px", color: colors.parchment, fontWeight: 700 }}>{v}/{m}</span>
      </div>
      <div style={{
        width: "100%", height: "7px",
        backgroundColor: "rgba(0, 0, 0, 0.38)",
        border: `1px solid rgba(215, 167, 111, 0.12)`,
        borderRadius: "4px", overflow: "hidden",
        boxShadow: "inset 0 1px 3px rgba(0,0,0,0.4)",
      }}>
        <div style={{
          width: `${pct}%`, height: "100%",
          background: barColor,
          borderRadius: "3px",
          transition: "width 0.4s cubic-bezier(0.16, 1, 0.3, 1), background 0.4s",
          boxShadow: pct > 25 ? "0 0 6px rgba(215,167,111,0.2)" : "0 0 6px rgba(143,76,60,0.4)",
        }} />
      </div>
    </div>
  );
}
