import React from "react";
import { Icon } from "../Icon.jsx";
import { Panel } from "../primitives.jsx";
import { colors, alert, shadow, radius, fonts, metaStyle } from "../tokens.js";

// Collapsible thinking trace beneath a narration beat. Default-closed —
// the live-stream thinking is shown separately while the response is in
// flight (see LiveThinking in primitives).
function Thinking({ text }) {
  if (!text) return null;
  return (
    <details style={{ marginTop: "10px" }} className="fade-in">
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
        fontSize: "12px", lineHeight: 1.5,
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

export function BeatRender({ beat }) {
  switch (beat.type) {
    case "narration":
      return (
        <Panel>
          {beat.timeStamp && (
            <div style={{ ...metaStyle, color: "rgba(215, 167, 111, 0.45)", marginBottom: "7px" }}>
              {beat.timeStamp}
            </div>
          )}
          <div style={{
            fontFamily: fonts.serif,
            fontStyle: "italic",
            fontSize: "18px",
            lineHeight: "1.48",
            color: colors.parchment,
            whiteSpace: "pre-wrap",
            textShadow: "0 2px 10px rgba(0,0,0,0.24)",
          }}>
            {beat.content}
          </div>
          <Thinking text={beat.thinking} />
        </Panel>
      );

    case "player":
      return (
        <div className="fade-in" style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
          <div style={{
            maxWidth: "85%",
            padding: "12px 15px",
            borderRadius: "18px 18px 4px 18px",
            backgroundColor: "rgba(35, 48, 48, 0.72)",
            color: colors.parchmentLight,
            border: `1px solid rgba(215, 167, 111, 0.28)`,
            boxShadow: shadow.cardDeep,
          }}>
            <div style={{ ...metaStyle, fontSize: "8px", color: colors.parchmentMuted, marginBottom: "4px" }}>You</div>
            <div style={{ fontSize: "14px", lineHeight: 1.45, color: colors.parchment }}>{beat.content}</div>
          </div>
        </div>
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
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...metaStyle, color: colors.parchmentMuted, marginBottom: "3px" }}>{beat.name}</div>
              <div style={{
                fontSize: "17px",
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

    case "needs_delta":
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

    default:
      return null;
  }
}
