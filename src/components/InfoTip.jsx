import React from "react";
import { createPortal } from "react-dom";
import { colors, radius, shadow, fonts, glass } from "./tokens.js";

// A small circled-i affordance. Parent supplies onClick (usually opening the
// shared InfoModal with a glossary entry). Kept tiny so it tucks beside labels.
export function InfoButton({ onClick, color = "rgba(215,167,111,0.7)" }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      aria-label="What is this?"
      style={{
        width: "16px", height: "16px", flexShrink: 0, borderRadius: "999px", lineHeight: 1,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: "transparent", border: `1px solid ${color}`, color, cursor: "pointer",
        fontSize: "10px", fontWeight: 800, fontFamily: "inherit", fontStyle: "italic", padding: 0,
      }}
    >i</button>
  );
}

// A viewport-level modal shell shared by the character menu's explanations.
// It is a portal because the character sheet is transformed for drag animation.
export function ViewportModal({ children, onClose, ariaLabel = "Explanation" }) {
  const modal = (
    <div onClick={onClose} role="presentation" style={{
      position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
      backgroundColor: "rgba(8,12,12,0.7)", backdropFilter: "blur(4px)", padding: "20px",
    }}>
      <div onClick={(e) => e.stopPropagation()} className="scale-in" role="dialog" aria-modal="true" aria-label={ariaLabel} style={{
        width: "100%", maxWidth: "320px", maxHeight: "min(90dvh, 640px)", overflowY: "auto",
        backgroundColor: "rgba(20,29,29,0.96)",
        border: `1px solid rgba(215,167,111,0.4)`, borderRadius: radius.panel, padding: "16px 18px",
        boxShadow: shadow.sheet, display: "flex", flexDirection: "column", gap: "8px", ...glass,
      }}>
        {children}
      </div>
    </div>
  );
  // The character sheet is a transformed bottom sheet for drag animation. A
  // fixed child would still be constrained by that transform, so mount the
  // explanation at document level to make its backdrop and centering use the
  // actual viewport.
  return typeof document === "undefined" ? modal : createPortal(modal, document.body);
}

// A lightweight centred popover explaining one concept. `info` = { term, text, extra }.
export function InfoModal({ info, onClose }) {
  if (!info) return null;
  return (
    <ViewportModal onClose={onClose} ariaLabel={`${info.term} explanation`}>
        <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "19px", color: colors.parchmentLight, lineHeight: 1.1 }}>{info.term}</div>
        <div style={{ fontSize: "13px", color: colors.parchment, lineHeight: 1.5 }}>{info.text}</div>
        {info.extra}
        <button onClick={onClose} style={{
          marginTop: "4px", alignSelf: "flex-end", padding: "6px 14px", borderRadius: radius.pill,
          background: "rgba(215,167,111,0.14)", color: colors.parchmentLight,
          border: `1px solid rgba(215,167,111,0.35)`, fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
        }}>Got it</button>
    </ViewportModal>
  );
}
