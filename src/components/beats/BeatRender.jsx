import React from "react";
import { Icon } from "../Icon.jsx";

export function BeatRender({ beat }) {
  switch (beat.type) {
    case "narration":
      return (
        <div style={{ marginBottom: "16px" }}>
          {beat.timeStamp && (
            <div style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: "11px", color: "#A8A199", marginBottom: "6px" }}>
              {beat.timeStamp}
            </div>
          )}
          <div style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: "16px", lineHeight: "1.55", color: "#2A2A2A", whiteSpace: "pre-wrap" }}>
            {beat.content}
          </div>
        </div>
      );
    case "player":
      return (
        <div style={{ marginBottom: "16px", paddingLeft: "12px", borderLeft: "2px solid #C9A876" }}>
          <div style={{ fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#8B5A2B", marginBottom: "4px", fontWeight: 500 }}>You</div>
          <div style={{ fontSize: "14px", lineHeight: "1.5", color: "#1A1A1A" }}>{beat.content}</div>
        </div>
      );
    case "timestamp":
      return (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", margin: "4px 0 10px 0" }}>
          <div style={{ flex: 1, height: "1px", backgroundColor: "#EBE5D6" }} />
          <span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: "11px", color: "#A8A199" }}>
            {beat.content}
          </span>
          <div style={{ flex: 1, height: "1px", backgroundColor: "#EBE5D6" }} />
        </div>
      );
    case "roll":
      return (
        <div style={{ marginBottom: "16px", padding: "10px 12px", backgroundColor: "#1A1A1A", borderRadius: "10px", color: "#FBF8F2", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "9px", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.6, marginBottom: "2px" }}>
              {beat.label} · {beat.formula}{beat.dc ? ` vs DC ${beat.dc}` : ""}
            </div>
            <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: "13px", fontStyle: "italic" }}>{beat.outcome}</div>
          </div>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: "28px", color: "#E8B98C", lineHeight: "1" }}>{beat.value}</div>
        </div>
      );
    case "encounter":
      return (
        <div style={{ marginBottom: "16px", padding: "10px 12px", backgroundColor: "#FBF1DF", border: "1px dashed #C9A876", borderRadius: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
            <Icon name="alert" size={11} color="#8B5A2B" strokeWidth={2} />
            <span style={{ fontSize: "9px", letterSpacing: "0.16em", textTransform: "uppercase", color: "#8B5A2B", fontWeight: 600 }}>
              Encounter · {beat.encounterType}
            </span>
          </div>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: "13px", color: "#3A3A3A", lineHeight: "1.45" }}>{beat.note}</div>
        </div>
      );
    case "dialogue":
      return (
        <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", padding: "10px 12px", backgroundColor: "#F4EFE3", borderRadius: "10px", marginBottom: "12px" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg, #6B4A2E 0%, #4A3018 60%, #2A1A09 100%)", boxShadow: "inset 0 -2px 4px rgba(0,0,0,0.3)" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#6B655B", marginBottom: "2px", fontWeight: 500 }}>{beat.name}</div>
            <div style={{ fontSize: "15px", lineHeight: "1.45", color: "#1A1A1A", fontStyle: "italic", fontFamily: "'Instrument Serif', serif" }}>"{beat.line}"</div>
          </div>
        </div>
      );
    case "travel_card":
      return (
        <div style={{ marginBottom: "16px", padding: "10px 14px", border: "1px solid #EBE5D6", backgroundColor: "#F7F1E2", borderRadius: "12px" }}>
          <div style={{ fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#8B5A2B", fontWeight: 500, marginBottom: "4px" }}>Traveled</div>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: "14px", color: "#1A1A1A" }}>
            {beat.from} → {beat.to} · {beat.mins} min
          </div>
        </div>
      );
    case "discovery":
      return (
        <div style={{ marginBottom: "16px", padding: "8px 12px", backgroundColor: "rgba(232,185,140,0.15)", border: "1px solid rgba(139,90,43,0.25)", borderRadius: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
            <Icon name="sparkle" size={11} color="#8B5A2B" strokeWidth={2} />
            <span style={{ fontSize: "9px", letterSpacing: "0.16em", textTransform: "uppercase", color: "#8B5A2B", fontWeight: 600 }}>Recorded</span>
          </div>
          <div style={{ fontSize: "12px", color: "#3A3A3A", lineHeight: "1.5" }}>
            {beat.items.map((it, i) => (
              <span key={i}>
                <span style={{ color: "#8B857A", fontSize: "10px" }}>{it.kind.replace(/s$/, "")}:</span> {it.name}
                {i < beat.items.length - 1 ? " · " : ""}
              </span>
            ))}
          </div>
        </div>
      );
    case "growth":
      return (
        <div style={{ marginBottom: "16px", padding: "8px 12px", backgroundColor: "rgba(139,90,43,0.08)", border: "1px solid rgba(139,90,43,0.3)", borderRadius: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
          <Icon name="arrowUp" size={12} color="#8B5A2B" strokeWidth={2} />
          <span style={{ fontSize: "9px", letterSpacing: "0.16em", textTransform: "uppercase", color: "#8B5A2B", fontWeight: 600 }}>Growth</span>
          <span style={{ fontSize: "12px", color: "#3A3A3A" }}>{beat.text}</span>
        </div>
      );
    case "inventory_delta":
      return (
        <div style={{ marginBottom: "16px", padding: "8px 12px", backgroundColor: "#F4EFE3", borderRadius: "10px", border: "1px solid #E5DFD2" }}>
          <div style={{ fontSize: "9px", letterSpacing: "0.16em", textTransform: "uppercase", color: "#8B5A2B", fontWeight: 600, marginBottom: "4px" }}>Inventory</div>
          <div style={{ fontSize: "12px", color: "#3A3A3A", lineHeight: "1.5", display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {beat.lines.map((l, i) => <span key={i}>{l}</span>)}
          </div>
        </div>
      );
    case "needs_delta":
    case "need_alert":
      return (
        <div style={{ textAlign: "center", margin: "10px 0 16px 0", fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: "13px", color: "#8B5A2B", lineHeight: "1.4", letterSpacing: "0.01em" }}>
          {beat.text || (beat.lines && beat.lines.join(" · "))}
        </div>
      );
    default:
      return null;
  }
}
