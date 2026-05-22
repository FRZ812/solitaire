import React from "react";
import { Icon } from "./Icon.jsx";
import { iconButtonStyle, Panel, SectionHeader } from "./primitives.jsx";
import { colors, radius, fonts, metaStyle } from "./tokens.js";
import { formatCopper, formatCoins } from "../engine/economy.js";

// The Block: the auctioneer's lots. Each captive is a person, not stock — buying
// their bond pays the auctioneer and makes their fate yours, settled in the world
// by the narrator (free them, press them to service, ransom, or resell).
export function SlaveMarketView({ state, building, board, onBuy, onClose, loading }) {
  const coins = state.character.inventory.coins;

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 30,
      backgroundColor: "#0d1312",
      display: "flex", flexDirection: "column",
      maxWidth: "480px", margin: "0 auto",
      borderLeft: "1px solid rgba(215, 167, 111, 0.12)",
      borderRight: "1px solid rgba(215, 167, 111, 0.12)",
      boxShadow: "0 0 50px rgba(0,0,0,0.9)",
    }}>
      {/* Header */}
      <div style={{
        padding: "calc(env(safe-area-inset-top, 0px) + 14px) 16px 12px 16px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: "1px solid rgba(215, 167, 111, 0.15)",
        backgroundColor: "rgba(20, 29, 29, 0.95)",
      }}>
        <button onClick={onClose} aria-label="Leave" style={{
          ...iconButtonStyle, width: "30px", height: "30px", borderRadius: "50%",
          backgroundColor: "rgba(215, 167, 111, 0.08)", border: "1px solid rgba(215, 167, 111, 0.2)",
        }}>
          <Icon name="arrowLeft" size={13} color="#e6b98c" strokeWidth={2} />
        </button>
        <div style={{ textAlign: "center", minWidth: 0, padding: "0 6px" }}>
          <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "22px", color: colors.parchmentLight }}>{building.label}</div>
          <div style={{ ...metaStyle, fontSize: "9px", letterSpacing: "0.16em", color: "rgba(215, 167, 111, 0.78)", marginTop: "3px" }}>The Auctioneer</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "5px", padding: "6px 10px", borderRadius: radius.pill, border: "1px solid rgba(215, 167, 111, 0.28)", backgroundColor: "rgba(215, 167, 111, 0.08)" }}>
          <Icon name="sparkle" size={11} color={colors.gold} />
          <span style={{ fontSize: "12px", fontWeight: 800, color: colors.parchmentLight }}>{formatCoins(coins)}</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 16px", WebkitOverflowScrolling: "touch" }}>
        <Panel tone="warm" style={{ marginBottom: "12px" }}>
          <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "14px", color: colors.parchment, lineHeight: 1.4 }}>{building.blurb}</div>
        </Panel>

        {/* The lots — buy a captive's bond; their fate is then yours. */}
        <SectionHeader>On the block</SectionHeader>
        {board.captives.map((c) => (
          <Row key={c.id} title={c.name} meta={`${c.origin} · ${c.spirit}`} desc={c.desc} sub={`Taken: ${c.taken}. ${c.skills}.`}
            price={`bond ${formatCopper(c.priceCp)}`}
            action={<ActionButton label="Buy bond" enabled={!loading} onClick={() => onBuy(c)} />} />
        ))}
        <div style={{ ...metaStyle, fontSize: "10px", color: colors.parchmentMuted, lineHeight: 1.5, marginTop: "6px", fontStyle: "italic" }}>
          A bond bought is a fate taken. What you do with it — strike the irons, set them to work, send them home, or sell them on — is yours to decide once they're out of the auctioneer's hands.
        </div>
        <div style={{ height: "8px" }} />
      </div>
    </div>
  );
}

function Row({ title, meta, desc, sub, price, action }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "10px",
      padding: "11px 13px", marginBottom: "8px",
      borderRadius: radius.panelCompact,
      backgroundColor: "rgba(20, 29, 29, 0.5)",
      border: "1px solid rgba(215, 167, 111, 0.14)",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "16px", color: colors.parchmentLight, lineHeight: 1.2 }}>{title}</div>
        <div style={{ ...metaStyle, fontSize: "8px", color: colors.parchmentMuted, margin: "2px 0 4px" }}>{meta}</div>
        <div style={{ fontSize: "11px", color: "rgba(237, 228, 208, 0.7)", lineHeight: 1.35 }}>{desc}</div>
        {sub && <div style={{ fontSize: "10px", color: "rgba(237, 228, 208, 0.5)", lineHeight: 1.35, marginTop: "3px", fontStyle: "italic" }}>{sub}</div>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px", flexShrink: 0 }}>
        {price && (
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <Icon name="sparkle" size={10} color={colors.gold} />
            <span style={{ fontSize: "11px", fontWeight: 800, color: colors.gold, textAlign: "right" }}>{price}</span>
          </div>
        )}
        {action}
      </div>
    </div>
  );
}

function ActionButton({ label, enabled, ghost = false, onClick }) {
  return (
    <button onClick={enabled ? onClick : undefined} disabled={!enabled} style={{
      padding: "7px 14px", borderRadius: radius.pill,
      border: ghost ? "1px solid rgba(215,167,111,0.3)" : "none",
      backgroundColor: ghost ? "transparent" : enabled ? colors.gold : "rgba(215, 167, 111, 0.1)",
      color: ghost ? "rgba(215,167,111,0.8)" : enabled ? colors.ink : "rgba(215, 167, 111, 0.4)",
      fontSize: "12px", fontWeight: 800, cursor: enabled ? "pointer" : "not-allowed", fontFamily: "inherit", whiteSpace: "nowrap",
    }}>{label}</button>
  );
}
