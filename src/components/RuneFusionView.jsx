import React from "react";
import { Icon } from "./Icon.jsx";
import { iconButtonStyle } from "./primitives.jsx";
import { colors, radius, fonts, metaStyle, glass } from "./tokens.js";

// The rune-binding ritual. Opened by "binding" a forge-rune carried in the pack;
// lists the gear that bears the two enchantments this rune can fuse. Choosing one
// consumes the rune and fuses the pair into a single signature power.
export function RuneFusionView({ runeName, options = [], onFuse, onClose, loading }) {
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 33,
      backgroundColor: "rgba(8,11,11,0.94)", ...glass,
      display: "flex", flexDirection: "column",
      maxWidth: "480px", margin: "0 auto",
    }}>
      <div style={{
        padding: "calc(env(safe-area-inset-top, 0px) + 14px) 16px 12px 16px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: "1px solid rgba(168, 111, 208, 0.22)",
        backgroundColor: "rgba(28, 20, 32, 0.95)",
      }}>
        <div style={{ minWidth: 0, padding: "0 6px" }}>
          <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "21px", color: colors.parchmentLight }}>Rune Binding</div>
          <div style={{ ...metaStyle, fontSize: "9px", letterSpacing: "0.16em", color: "#c79be0", marginTop: "3px" }}>{runeName}</div>
        </div>
        <button onClick={onClose} aria-label="Leave" style={{
          ...iconButtonStyle, width: "30px", height: "30px", borderRadius: "50%",
          backgroundColor: "rgba(168, 111, 208, 0.1)", border: "1px solid rgba(168, 111, 208, 0.3)",
        }}>
          <Icon name="x" size={13} color="#c79be0" strokeWidth={2} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", WebkitOverflowScrolling: "touch" }}>
        {options.length === 0 ? (
          <div style={{ padding: "24px 8px", fontSize: "13px", fontStyle: "italic", color: "rgba(237,228,208,0.6)", lineHeight: 1.5, textAlign: "center" }}>
            You hold the rune, but no gear you own bears two enchantments it can bind.
            Find a piece carrying both halves of one of its fusions first.
          </div>
        ) : options.map((f, i) => (
          <div key={`${f.itemId}-${f.recipe.id}-${i}`} style={{
            padding: "12px 13px", marginBottom: "9px", borderRadius: radius.panelCompact,
            backgroundColor: "rgba(40, 24, 40, 0.55)", border: "1px solid rgba(168, 111, 208, 0.3)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "15px", color: colors.parchmentLight }}>{f.itemName}</div>
                <div style={{ fontSize: "11px", color: "rgba(237,228,208,0.72)", marginTop: "3px" }}>
                  {f.aName} + {f.bName} → <span style={{ color: "#c79be0", fontWeight: 700 }}>{f.resultName}</span>
                </div>
              </div>
              <button onClick={!loading ? () => onFuse(f.itemId, f.recipe.id) : undefined} disabled={loading} style={{
                padding: "8px 18px", borderRadius: radius.pill, border: "none",
                backgroundColor: loading ? "rgba(168,111,208,0.12)" : "#a86fd0",
                color: loading ? "rgba(199,155,224,0.4)" : "#1a1018",
                fontSize: "12px", fontWeight: 800, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", flexShrink: 0,
              }}>Fuse</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
