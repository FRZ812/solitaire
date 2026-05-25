import React, { useState } from "react";
import { colors, radius, shadow, fonts, metaStyle, glass } from "./tokens.js";

// A themed single-line text prompt (e.g. name a newly-joined mount). Driven by App
// state: { title, body, defaultValue, placeholder, confirmLabel, resolve }. OK
// resolves the trimmed string (or null if blank); Cancel/backdrop resolves null.
export function NamePrompt({ title, body, defaultValue = "", placeholder = "", confirmLabel = "Name", onResolve }) {
  const [value, setValue] = useState(defaultValue);
  const submit = () => { const v = value.trim(); onResolve(v || null); };
  return (
    <div
      onClick={() => onResolve(null)}
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
          border: "1px solid rgba(215,167,111,0.35)",
          borderRadius: radius.panel, padding: "20px", boxShadow: shadow.sheet,
          display: "flex", flexDirection: "column", gap: "12px", ...glass,
        }}
      >
        <div style={{ ...metaStyle, fontSize: "9px", letterSpacing: "0.16em", color: colors.gold }}>{title}</div>
        {body && <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "16px", color: colors.parchment, lineHeight: 1.4 }}>{body}</div>}
        <input
          autoFocus
          value={value}
          placeholder={placeholder}
          maxLength={40}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          style={{
            height: "42px", borderRadius: radius.control, padding: "0 12px",
            border: "1px solid rgba(215,167,111,0.4)", backgroundColor: "rgba(8,12,12,0.5)",
            color: colors.parchmentLight, fontSize: "15px", fontFamily: fonts.serif, fontStyle: "italic", outline: "none",
          }}
        />
        <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
          <button
            onClick={() => onResolve(null)}
            style={{
              flex: 1, height: "42px", borderRadius: radius.control,
              border: "1px solid rgba(215,167,111,0.28)", backgroundColor: "transparent",
              color: "rgba(215,167,111,0.8)", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            }}
          >Keep name</button>
          <button
            onClick={submit}
            style={{
              flex: 1, height: "42px", borderRadius: radius.control, border: "none",
              backgroundColor: colors.gold, color: colors.ink, fontSize: "13px", fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
            }}
          >{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
