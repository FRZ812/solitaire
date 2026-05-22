import React from "react";
import { colors, radius, shadow, fonts, metaStyle, glass, alert } from "./tokens.js";

// A themed confirm/cancel modal — replaces browser window.confirm so prompts
// (reset a campaign, train as an apprentice, pay a trainer, etc.) match the
// game's look. Driven by App state: { title, body, confirmLabel, danger,
// resolve }. The buttons resolve the pending promise true / false.
export function ConfirmDialog({ title, body, confirmLabel = "Confirm", cancelLabel = "Cancel", danger = false, onResolve }) {
  const accent = danger ? alert.dangerAccent : colors.gold;
  return (
    <div
      onClick={() => onResolve(false)}
      style={{
        position: "absolute", inset: 0, zIndex: 60,
        display: "flex", alignItems: "center", justifyContent: "center",
        backgroundColor: "rgba(8,12,12,0.72)", backdropFilter: "blur(4px)", padding: "22px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="scale-in"
        style={{
          width: "100%", maxWidth: "340px",
          backgroundColor: "rgba(20,29,29,0.97)",
          border: `1px solid ${danger ? "rgba(252,165,165,0.4)" : "rgba(215,167,111,0.35)"}`,
          borderRadius: radius.panel, padding: "20px", boxShadow: shadow.sheet,
          display: "flex", flexDirection: "column", gap: "12px", ...glass,
        }}
      >
        <div style={{ ...metaStyle, fontSize: "9px", letterSpacing: "0.16em", color: accent }}>{title}</div>
        <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "16px", color: colors.parchment, lineHeight: 1.4 }}>{body}</div>
        <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
          <button
            onClick={() => onResolve(false)}
            style={{
              flex: 1, height: "42px", borderRadius: radius.control,
              border: "1px solid rgba(215,167,111,0.28)", backgroundColor: "transparent",
              color: "rgba(215,167,111,0.8)", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            }}
          >{cancelLabel}</button>
          <button
            onClick={() => onResolve(true)}
            style={{
              flex: 1, height: "42px", borderRadius: radius.control, border: "none",
              backgroundColor: danger ? "#8F4C3C" : colors.gold,
              color: danger ? "#FFE7DB" : colors.ink, fontSize: "13px", fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
            }}
          >{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
