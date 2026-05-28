import React from "react";
import { Icon } from "../Icon.jsx";
import { Panel } from "../primitives.jsx";
import { colors, alert, shadow, radius, fonts, metaStyle } from "../tokens.js";

// Collapsible thinking trace for a narration beat. Rendered at the TOP of
// the beat (before the prose) so its position matches where LiveThinking
// sat while the response was streaming — no jump from top to bottom once
// the answer lands. Default-closed.
function Thinking({ text }) {
  if (!text) return null;
  return (
    <details style={{ marginBottom: "10px" }} className="fade-in">
      <summary style={{
        ...metaStyle,
        color: "rgba(215, 167, 111, 0.65)",
        cursor: "pointer",
        userSelect: "none",
      }}>
        Thinking
      </summary>
      <div style={{
        marginTop: "8px",
        padding: "11px 13px",
        backgroundColor: "rgba(10, 15, 15, 0.45)",
        border: `1px solid rgba(215, 167, 111, 0.12)`,
        borderRadius: radius.panelCompact,
        fontSize: "11px", lineHeight: 1.5,
        color: "rgba(237, 228, 208, 0.8)",
        fontStyle: "italic",
        fontFamily: fonts.serif,
        whiteSpace: "pre-wrap",
      }}>
        {text}
      </div>
    </details>
  );
}

// Three-dot affordance for the long-press / tap action menu.
function Dots() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="rgba(215,167,111,0.85)">
      <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}

// Wraps a bubble so a long-press (or right-click, or the corner button) opens the
// Rewrite / Edit / Rewind menu for that beat.
function Pressable({ onMenu, children }) {
  const timer = React.useRef(null);
  const start = () => { timer.current = setTimeout(() => { timer.current = null; onMenu?.(); }, 480); };
  const cancel = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  if (!onMenu) return children;
  return (
    <div
      style={{ position: "relative" }}
      onTouchStart={start}
      onTouchEnd={cancel}
      onTouchMove={cancel}
      onContextMenu={(e) => { e.preventDefault(); onMenu(); }}
    >
      {children}
      <button
        onClick={(e) => { e.stopPropagation(); onMenu(); }}
        aria-label="Edit, rewrite, or rewind this moment"
        style={{
          position: "absolute", top: 8, right: 8,
          width: 28, height: 28, borderRadius: 9,
          background: "rgba(14, 20, 20, 0.55)",
          border: "1px solid rgba(215, 167, 111, 0.22)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", opacity: 0.55, padding: 0,
        }}
      >
        <Dots />
      </button>
    </div>
  );
}

export function BeatRender({ beat, onMenu }) {
  switch (beat.type) {
    case "narration":
      return (
        <Pressable onMenu={onMenu}>
          <Panel>
            <Thinking text={beat.thinking} />
            {beat.timeStamp && (
              <div style={{ ...metaStyle, color: "rgba(215, 167, 111, 0.45)", marginBottom: "7px" }}>
                {beat.timeStamp}
              </div>
            )}
            <div style={{
              fontFamily: fonts.serif,
              fontStyle: "italic",
              fontSize: "16px",
              lineHeight: "1.46",
              color: colors.parchment,
              whiteSpace: "pre-wrap",
              textShadow: "0 2px 10px rgba(0,0,0,0.24)",
              paddingRight: "28px",
            }}>
              {beat.content}
            </div>
            {beat.truncated && (
              <div style={{
                marginTop: "10px",
                fontFamily: fonts.serif,
                fontSize: "11px",
                fontStyle: "italic",
                color: "rgba(215, 167, 111, 0.55)",
                letterSpacing: "0.04em",
              }}>
                — the narrator was cut short. Long-press to retry or rewrite.
              </div>
            )}
          </Panel>
        </Pressable>
      );

    case "player":
      return (
        <Pressable onMenu={onMenu}>
          <div className="fade-in" style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
            <div style={{
              maxWidth: "85%",
              padding: "12px 15px",
              paddingRight: "34px",
              borderRadius: "18px 18px 4px 18px",
              backgroundColor: "rgba(35, 48, 48, 0.72)",
              color: colors.parchmentLight,
              border: `1px solid rgba(215, 167, 111, 0.28)`,
              boxShadow: shadow.cardDeep,
            }}>
              <div style={{ ...metaStyle, fontSize: "8px", color: colors.parchmentMuted, marginBottom: "4px" }}>You</div>
              <div style={{ fontSize: "13px", lineHeight: 1.45, color: colors.parchment }}>{beat.content}</div>
            </div>
          </div>
        </Pressable>
      );

    case "timestamp":
      return (
        <div className="fade-in" style={{ display: "flex", alignItems: "center", gap: "8px", margin: "4px 4px 12px" }}>
          <div style={{ flex: 1, height: "1px", backgroundColor: "rgba(215, 167, 111, 0.14)" }} />
          <span style={{
            padding: "4px 11px",
            borderRadius: radius.pill,
            backgroundColor: "rgba(20, 29, 29, 0.45)",
            border: `1px solid rgba(215, 167, 111, 0.16)`,
            fontFamily: fonts.serif,
            fontStyle: "italic",
            fontSize: "12px",
            color: "rgba(215, 167, 111, 0.75)",
          }}>
            {beat.content}
          </span>
          <div style={{ flex: 1, height: "1px", backgroundColor: "rgba(215, 167, 111, 0.14)" }} />
        </div>
      );

    case "roll":
      return (
        <Panel tone="dark" compact>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ ...metaStyle, fontSize: "8px", color: "rgba(215, 167, 111, 0.6)", marginBottom: "3px" }}>
                {beat.label} · {beat.formula}{beat.dc ? ` vs DC ${beat.dc}` : ""}
              </div>
              <div style={{ fontFamily: fonts.serif, fontSize: "16px", fontStyle: "italic", color: colors.parchmentLight }}>{beat.outcome}</div>
            </div>
            <div style={{
              fontFamily: fonts.serif,
              fontSize: "32px",
              fontWeight: "bold",
              color: colors.parchmentMuted,
              lineHeight: 1,
              textShadow: "0 0 10px rgba(230, 185, 140, 0.4)",
              background: "rgba(215, 167, 111, 0.08)",
              padding: "4px 8px",
              borderRadius: "8px",
              border: `1px solid rgba(215, 167, 111, 0.2)`,
              minWidth: "48px",
              textAlign: "center",
            }}>
              {beat.value}
            </div>
          </div>
        </Panel>
      );

    case "encounter":
      return (
        <Panel tone="encounter" compact>
          <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "5px" }}>
            <Icon name="alert" size={12} color={alert.dangerAccent} strokeWidth={2} />
            <span style={{ ...metaStyle, fontSize: "8px", color: alert.dangerAccent }}>Encounter · {beat.encounterType}</span>
          </div>
          <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "16px", color: "#fef2f2", lineHeight: 1.42 }}>{beat.note}</div>
        </Panel>
      );

    case "dialogue":
      return (
        <Pressable onMenu={onMenu}>
          <Panel tone="pale" compact>
            <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <div style={{
                width: "36px", height: "36px",
                borderRadius: "50%",
                flexShrink: 0,
                background: "linear-gradient(135deg, #3a2d1e 0%, #151d1d 100%)",
                border: `1px solid rgba(215, 167, 111, 0.4)`,
                boxShadow: "inset 0 0 8px rgba(0,0,0,0.6)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(215, 167, 111, 0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0, paddingRight: "24px" }}>
                <div style={{ ...metaStyle, color: colors.parchmentMuted, marginBottom: "3px" }}>{beat.name}</div>
                <div style={{
                  fontSize: "15px",
                  lineHeight: 1.42,
                  color: colors.parchment,
                  fontStyle: "italic",
                  fontFamily: fonts.serif,
                  textShadow: "0 1px 4px rgba(0,0,0,0.3)",
                }}>
                  "{beat.line}"
                </div>
              </div>
            </div>
          </Panel>
        </Pressable>
      );

    case "travel_card":
      return (
        <Panel tone="default" compact>
          <div style={{ ...metaStyle, fontSize: "8px", color: "rgba(215, 167, 111, 0.6)", marginBottom: "4px" }}>Traveled</div>
          <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "15px", color: colors.parchmentLight }}>
            {`${beat.from} → ${beat.to} · ${beat.mins} min`}
          </div>
        </Panel>
      );

    case "discovery":
      return (
        <Panel tone="discovery" compact>
          <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "5px" }}>
            <Icon name="sparkle" size={12} color={alert.successText} strokeWidth={2} />
            <span style={{ ...metaStyle, fontSize: "8px", color: alert.successText }}>Recorded</span>
          </div>
          <div style={{ fontSize: "12px", color: "#ecfdf5", lineHeight: 1.5, display: "flex", flexWrap: "wrap", gap: "6px 9px" }}>
            {beat.items.map((it, i) => (
              <span key={i} style={{ background: "rgba(52, 211, 153, 0.12)", padding: "2px 6px", borderRadius: "6px", border: `1px solid rgba(52, 211, 153, 0.2)` }}>
                <span style={{ color: "rgba(167, 243, 208, 0.7)", fontSize: "9px", textTransform: "uppercase" }}>{it.kind.replace(/s$/, "")}:</span> {it.name}
              </span>
            ))}
          </div>
        </Panel>
      );

    case "growth":
      return (
        <Panel tone="default" compact>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Icon name="arrowUp" size={13} color={colors.parchmentMuted} strokeWidth={2} />
            <span style={{ ...metaStyle, fontSize: "8px", color: colors.parchmentMuted }}>Growth</span>
            <span style={{ fontSize: "12px", color: colors.parchment }}>{beat.text}</span>
          </div>
        </Panel>
      );

    case "inventory_delta":
      return (
        <Panel tone="pale" compact>
          <div style={{ ...metaStyle, fontSize: "8px", color: "rgba(215, 167, 111, 0.7)", marginBottom: "4px" }}>Inventory</div>
          <div style={{ fontSize: "12px", color: colors.parchment, lineHeight: 1.5, display: "flex", flexWrap: "wrap", gap: "7px 10px" }}>
            {beat.lines.map((l, i) => (
              <span key={i} style={{ background: "rgba(215, 167, 111, 0.08)", padding: "2px 7px", borderRadius: "6px", border: `1px solid rgba(215, 167, 111, 0.12)` }}>
                {l}
              </span>
            ))}
          </div>
        </Panel>
      );

    case "upkeep":
      return (
        <Panel tone="pale" compact>
          <div style={{ ...metaStyle, fontSize: "8px", color: "rgba(167, 200, 150, 0.8)", marginBottom: "4px" }}>On the road</div>
          <div style={{ fontSize: "12px", color: "rgba(237, 228, 208, 0.7)", lineHeight: 1.5, display: "flex", flexWrap: "wrap", gap: "6px 10px" }}>
            {beat.lines.map((l, i) => (
              <span key={i} style={{ background: "rgba(120, 150, 110, 0.1)", padding: "2px 7px", borderRadius: "6px", border: "1px solid rgba(120, 150, 110, 0.2)" }}>
                {l}
              </span>
            ))}
          </div>
        </Panel>
      );

    case "spoilage":
      return (
        <Panel tone="pale" compact>
          <div style={{ ...metaStyle, fontSize: "8px", color: "rgba(150, 140, 110, 0.85)", marginBottom: "4px" }}>Spoiled</div>
          <div style={{ fontSize: "12px", color: "rgba(237, 228, 208, 0.55)", lineHeight: 1.5, display: "flex", flexWrap: "wrap", gap: "7px 10px" }}>
            {beat.lines.map((l, i) => (
              <span key={i} style={{ background: "rgba(120, 110, 80, 0.1)", padding: "2px 7px", borderRadius: "6px", border: "1px solid rgba(120, 110, 80, 0.18)", textDecoration: "line-through" }}>
                {l}
              </span>
            ))}
          </div>
        </Panel>
      );

    case "passage":
      // Natural deaths from age, surfaced by engine/aging.js when codex characters
      // cross their elder ramp during a time-advance. Plain obituary tone — no
      // strikethrough; these are not refuse, they are people who have died.
      return (
        <Panel tone="pale" compact>
          <div style={{ ...metaStyle, fontSize: "8px", color: "rgba(150, 140, 110, 0.85)", marginBottom: "4px" }}>Passing</div>
          <div style={{ fontSize: "12px", color: "rgba(237, 228, 208, 0.6)", lineHeight: 1.55, fontFamily: fonts.serif, fontStyle: "italic" }}>
            {beat.lines.map((l, i) => (<div key={i}>{l}</div>))}
          </div>
        </Panel>
      );

    case "need_alert":
      return (
        <div className="fade-in" style={{
          textAlign: "center", margin: "8px 12px 14px",
          fontFamily: fonts.serif, fontStyle: "italic",
          fontSize: "14px", color: colors.parchmentLight, lineHeight: 1.4,
          textShadow: "0 2px 10px rgba(0,0,0,0.55)",
        }}>
          {beat.text || (beat.lines && beat.lines.join(" · "))}
        </div>
      );

    case "vitals_delta": {
      const LABEL = { vitality: "Vitality", resolve: "Resolve", hunger: "Hunger", thirst: "Thirst", sleep: "Sleep" };
      return (
        <Panel tone="pale" compact>
          <div style={{ ...metaStyle, fontSize: "8px", color: "rgba(215, 167, 111, 0.7)", marginBottom: "4px" }}>Vitals</div>
          <div style={{ fontSize: "12px", lineHeight: 1.5, display: "flex", flexWrap: "wrap", gap: "7px 10px" }}>
            {beat.chips.map((c, i) => {
              const up = c.delta > 0;
              const col = up ? alert.successText : alert.dangerAccent;
              return (
                <span key={i} style={{
                  background: up ? "rgba(16, 185, 129, 0.10)" : "rgba(120, 30, 30, 0.16)",
                  border: `1px solid ${up ? "rgba(16, 185, 129, 0.28)" : "rgba(252, 165, 165, 0.3)"}`,
                  color: col, padding: "2px 7px", borderRadius: "6px",
                }}>
                  {LABEL[c.stat] || c.stat} {up ? "+" : ""}{c.delta}
                </span>
              );
            })}
          </div>
        </Panel>
      );
    }

    case "condition_change":
      return (
        <Panel tone="pale" compact>
          <div style={{ ...metaStyle, fontSize: "8px", color: "rgba(215, 167, 111, 0.7)", marginBottom: "4px" }}>Conditions</div>
          <div style={{ fontSize: "12px", lineHeight: 1.5, display: "flex", flexWrap: "wrap", gap: "7px 10px" }}>
            {beat.entries.map((e, i) => {
              const col = e.polarity === "buff" ? alert.successText : e.polarity === "debuff" ? alert.dangerAccent : colors.gold;
              const ring = e.polarity === "buff" ? "rgba(16, 185, 129, 0.28)" : e.polarity === "debuff" ? "rgba(252, 165, 165, 0.3)" : "rgba(215, 167, 111, 0.24)";
              const tint = e.polarity === "buff" ? "rgba(16, 185, 129, 0.10)" : e.polarity === "debuff" ? "rgba(120, 30, 30, 0.16)" : "rgba(215, 167, 111, 0.07)";
              const mark = e.dir === "gain" ? "+ " : e.dir === "expire" ? "⌛ " : "− ";
              const faded = e.dir !== "gain";
              return (
                <span key={i} style={{
                  background: tint, border: `1px solid ${ring}`, color: col,
                  padding: "2px 7px", borderRadius: "6px", opacity: faded ? 0.7 : 1,
                  textDecoration: e.dir === "lose" || e.dir === "expire" ? "line-through" : "none",
                }}>
                  {mark}{e.name}
                </span>
              );
            })}
          </div>
        </Panel>
      );

    default:
      return null;
  }
}
