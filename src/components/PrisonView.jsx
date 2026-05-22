import React from "react";
import { Icon } from "./Icon.jsx";
import { iconButtonStyle, Panel, SectionHeader } from "./primitives.jsx";
import { colors, radius, fonts, metaStyle } from "./tokens.js";
import { formatCopper, formatCoins } from "../engine/economy.js";

// The gaol: the warden's wanted board (take bounties, dead or alive — settled in
// the world by the narrator on delivery) and the cells (buy a prisoner's rights).
export function PrisonView({ state, building, board, onAccept, onAbandon, onBuyRights, onClose, loading }) {
  const coins = state.character.inventory.coins;
  const taken = new Set((state.world.quests || []).map((q) => q.id));
  const activeBounties = (state.world.quests || []).filter((q) => q.status === "active" && q.type === "bounty");

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
          <div style={{ ...metaStyle, fontSize: "9px", letterSpacing: "0.16em", color: "rgba(215, 167, 111, 0.78)", marginTop: "3px" }}>The Warden</div>
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

        {/* Bounties already taken — pursue them in the world; the warden pays on delivery. */}
        {activeBounties.length > 0 && (
          <>
            <SectionHeader>Contracts you hold</SectionHeader>
            {activeBounties.map((q) => (
              <Row key={q.id} title={q.title.replace(/^Bounty: /, "")} meta={q.crime} desc={q.desc}
                reward={`${formatCopper(q.rewardCp)} alive · ${formatCopper(q.rewardDeadCp)} dead`}
                action={<ActionButton label="Drop" ghost enabled={!loading} onClick={() => onAbandon(q.id)} />} />
            ))}
          </>
        )}

        {/* Wanted board. */}
        <SectionHeader>Wanted — dead or alive</SectionHeader>
        {board.bounties.map((b) => {
          const isTaken = taken.has(b.id);
          return (
            <Row key={b.id} title={b.name} meta={b.crime} desc={b.desc}
              reward={`${formatCopper(b.rewardAliveCp)} alive · ${formatCopper(b.rewardDeadCp)} dead`}
              action={<ActionButton label={isTaken ? "Taken" : "Take"} enabled={!isTaken && !loading} onClick={() => onAccept(b)} />} />
          );
        })}

        {/* The cells — buy a prisoner's rights. */}
        <SectionHeader>In the cells</SectionHeader>
        {board.prisoners.map((p) => (
          <Row key={p.id} title={p.name} meta={p.crime} desc={p.desc}
            reward={`rights ${formatCopper(p.rightsCp)}`}
            action={<ActionButton label="Buy rights" enabled={!loading} onClick={() => onBuyRights(p)} />} />
        ))}
        <div style={{ height: "8px" }} />
      </div>
    </div>
  );
}

function Row({ title, meta, desc, reward, action }) {
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
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px", flexShrink: 0 }}>
        {reward && (
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <Icon name="sparkle" size={10} color={colors.gold} />
            <span style={{ fontSize: "11px", fontWeight: 800, color: colors.gold, textAlign: "right" }}>{reward}</span>
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
