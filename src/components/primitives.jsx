import React from "react";
import { Icon } from "./Icon.jsx";

export const iconButtonStyle = {
  width: "34px", height: "34px", borderRadius: "50%",
  border: "1px solid #E5DFD2", backgroundColor: "transparent",
  display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer", flexShrink: 0,
};

export function Vital({ icon, label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
      {icon}
      <span style={{ color: "#8B857A", textTransform: "uppercase", fontSize: "9px", letterSpacing: "0.1em" }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

export function ConditionPill({ label }) {
  return (
    <div style={{ padding: "3px 9px", borderRadius: "10px", backgroundColor: "#1A1A1A", color: "#FBF8F2", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 500 }}>
      {label}
    </div>
  );
}

export function VitalsStrip({ character }) {
  return (
    <div style={{ padding: "8px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#F4EFE3", borderBottom: "1px solid #EBE5D6", fontSize: "11px", fontWeight: 500, color: "#1A1A1A", gap: "8px", flexWrap: "wrap" }}>
      <Vital icon={<Icon name="heart" size={11} color="#8B5A2B" strokeWidth={2} fill="#8B5A2B" />} label="Vit" value={`${Math.round(character.vitality)}/${character.vitalityMax}`} />
      <Vital icon={<Icon name="flame" size={11} color="#8B5A2B" strokeWidth={2} />} label="Res" value={`${character.resolve}/${character.resolveMax}`} />
      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
        {character.conditions.length === 0 ? (
          <span style={{ fontSize: "9px", color: "#A8A199" }}>—</span>
        ) : (
          character.conditions.map((c) => <ConditionPill key={c} label={c} />)
        )}
      </div>
    </div>
  );
}

export function LoadingDots() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "12px 0", opacity: 0.6 }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#8B5A2B", animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite` }} />
      ))}
    </div>
  );
}

export function InputBar({ value, onChange, onSubmit, loading }) {
  return (
    <div style={{ padding: "12px 14px calc(env(safe-area-inset-bottom, 0px) + 14px) 14px", backgroundColor: "rgba(251, 248, 242, 0.95)", backdropFilter: "blur(12px)", borderTop: "1px solid #EBE5D6", display: "flex", alignItems: "center", gap: "8px" }}>
      <input
        type="text" value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmit(); } }}
        placeholder="What do you do?" disabled={loading}
        style={{ flex: 1, height: "40px", borderRadius: "20px", border: "1px solid #E5DFD2", backgroundColor: "#FFFFFF", padding: "0 16px", fontSize: "14px", color: "#1A1A1A", outline: "none" }}
      />
      <button
        onClick={onSubmit} disabled={loading || !value.trim()}
        style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: loading || !value.trim() ? "#8B857A" : "#1A1A1A", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: loading || !value.trim() ? "not-allowed" : "pointer", flexShrink: 0, transition: "background-color 0.2s" }}
      >
        <Icon name="send" size={15} color="#FBF8F2" strokeWidth={1.8} />
      </button>
    </div>
  );
}

export function StatBlock({ label, value }) {
  return (
    <div style={{ padding: "10px 12px", backgroundColor: "#F4EFE3", borderRadius: "10px" }}>
      <div style={{ fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#8B5A2B", fontWeight: 500, marginBottom: "2px" }}>{label}</div>
      <div style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: "20px", color: "#1A1A1A" }}>{value}</div>
    </div>
  );
}

export function AttrBlock({ label, score }) {
  return (
    <div style={{ padding: "8px 10px", backgroundColor: "#F4EFE3", border: "1px solid #E5DFD2", borderRadius: "9px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#8B5A2B", fontWeight: 500 }}>{label}</div>
      <div style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: "22px", color: "#1A1A1A", lineHeight: "1.1", marginTop: "1px" }}>{score ?? 0}</div>
    </div>
  );
}

export function NeedBar({ label, value }) {
  const v = Math.round(value);
  const barColor = v > 50 ? "#8B5A2B" : v > 25 ? "#C9A876" : "#7A2C18";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
        <span style={{ fontSize: "10px", color: "#8B5A2B", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: "11px", color: "#1A1A1A", fontWeight: 500 }}>{v}/100</span>
      </div>
      <div style={{ width: "100%", height: "6px", backgroundColor: "#E5DFD2", borderRadius: "3px", overflow: "hidden" }}>
        <div style={{ width: `${v}%`, height: "100%", backgroundColor: barColor, transition: "width 0.3s, background-color 0.3s" }} />
      </div>
    </div>
  );
}
