import React from "react";
import { Icon } from "./Icon.jsx";
import { iconButtonStyle, Panel, SectionHeader } from "./primitives.jsx";
import { colors, radius, fonts, metaStyle } from "./tokens.js";
import { formatCopper, formatCoins } from "../engine/economy.js";

// The Block: the Chain Factor's lots. The platform shows TWO tiers —
//   "This morning's lots" = high-tier captives, paraded fresh each day.
//   "Still on the platform" = low-tier captives, lingering across the
//   multi-day window until someone takes them or the window rolls.
// Bought captives are filtered from the visible roster for the rest of their
// per-tier window so the same face doesn't reappear when the player closes and
// reopens the menu. Closed-at-night gating is upstream in App.jsx (it refuses
// to open this view outside the Chain Market Steps' hours).
export function SlaveMarketView({ state, building, board, tileKey, onInspect, onClose, loading }) {
  const coins = state.character.inventory.coins;
  const tile = state.world.tiles?.[tileKey];
  const highBought = (tile?.slavemarket?.high?.bucket === board.highBucket) ? tile.slavemarket.high.bought : {};
  const lowBought  = (tile?.slavemarket?.low?.bucket  === board.lowBucket)  ? tile.slavemarket.low.bought  : {};
  const isBought = (c) => (c.tier === "high" ? !!highBought[c.key] : !!lowBought[c.key]);

  const highLots = board.captives.filter((c) => c.tier === "high" && !isBought(c));
  const lowLots  = board.captives.filter((c) => c.tier === "low"  && !isBought(c));

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
          <div style={{ ...metaStyle, fontSize: "9px", letterSpacing: "0.16em", color: "rgba(215, 167, 111, 0.78)", marginTop: "3px" }}>The Chain Factor</div>
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

        {highLots.length > 0 && (
          <>
            <SectionHeader>This morning's lots</SectionHeader>
            {highLots.map((c) => (
              <Row key={c.id} title={c.name} meta={`${c.origin} · ${c.spirit}`} desc={c.desc} sub={`Taken: ${c.taken}. ${c.skills}.`}
                price={`bond ${formatCopper(c.priceCp)}`}
                action={<ActionButton label="Approach" enabled={!loading} onClick={() => onInspect(c)} />} />
            ))}
            <div style={{ ...metaStyle, fontSize: "9px", color: "rgba(237, 228, 208, 0.4)", lineHeight: 1.4, margin: "2px 0 12px", fontStyle: "italic" }}>
              Prime lots — paraded fresh each morning. Tomorrow's faces will be different.
            </div>
          </>
        )}

        {lowLots.length > 0 && (
          <>
            <SectionHeader>Still on the platform</SectionHeader>
            {lowLots.map((c) => {
              const decayed = c.daysLingering > 0 && c.priceCp < c.originalPriceCp;
              return (
                <Row key={c.id} title={c.name} meta={`${c.origin} · ${c.spirit}`} desc={c.desc} sub={`Taken: ${c.taken}. ${c.skills}.`}
                  price={`bond ${formatCopper(c.priceCp)}`}
                  priceSub={decayed ? `was ${formatCopper(c.originalPriceCp)}` : null}
                  action={<ActionButton label="Approach" enabled={!loading} onClick={() => onInspect(c)} />} />
              );
            })}
            <div style={{ ...metaStyle, fontSize: "9px", color: "rgba(237, 228, 208, 0.4)", lineHeight: 1.4, margin: "2px 0 8px", fontStyle: "italic" }}>
              The Chain Factor knocks their bond each day they stay. Once the price is right, someone else takes them off the platform — what you see here is what hasn't moved yet.
            </div>
          </>
        )}

        {highLots.length === 0 && lowLots.length === 0 && (
          <div style={{ ...metaStyle, fontSize: "11px", color: colors.parchmentMuted, lineHeight: 1.5, marginTop: "8px", fontStyle: "italic", textAlign: "center" }}>
            The platform is empty between coffles. Come back in the morning.
          </div>
        )}

        <div style={{ height: "8px" }} />
      </div>
    </div>
  );
}

function Row({ title, meta, desc, sub, price, priceSub, action }) {
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
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "1px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <Icon name="sparkle" size={10} color={colors.gold} />
              <span style={{ fontSize: "11px", fontWeight: 800, color: colors.gold, textAlign: "right" }}>{price}</span>
            </div>
            {priceSub && <span style={{ fontSize: "9px", color: "rgba(237, 228, 208, 0.45)", textAlign: "right", fontStyle: "italic", textDecoration: "line-through" }}>{priceSub}</span>}
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
