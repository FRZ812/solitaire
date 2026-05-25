import React from "react";
import { Icon } from "./Icon.jsx";
import { iconButtonStyle, Panel, SectionHeader } from "./primitives.jsx";
import { colors, radius, fonts, metaStyle, glass } from "./tokens.js";
import { canAfford, formatCopper, formatCoins } from "../engine/economy.js";
import { MOUNTS } from "../data/mounts.js";

// The stable: buy a mundane mount (it joins the party as a kind:"mount" character,
// engine/economy.buyMount) and the feed to keep it. Exotic/flying mounts are never
// sold here — they're earned in play (beat.grant_mount). Buy-only and deterministic;
// App applies the transactions.
export function StableView({ state, building, tileKey, stock, mounts, onClose, onBuy, onBuyMount, loading }) {
  const inv = state.character.inventory;
  const coins = inv.coins;
  const owned = new Set(state.party || []);

  const tile = state.world.tiles[tileKey];
  const sold = (tile?.shop && stock && tile.shop.bucket === stock.bucket) ? tile.shop.sold : {};

  // Region-gated, seed-rolled mount list (App resolves biome/override + roll).
  const mountRows = (mounts || [])
    .map((m) => ({ ...m, tmpl: MOUNTS[m.id] }))
    .filter((m) => m.tmpl && !owned.has(m.id));

  // Use the rolled stock's own template def (always present) — fodder/raw-meat
  // usually aren't in the player's codex.items yet, so don't depend on that.
  const feedRows = (stock?.items || [])
    .map((s) => ({ ...s, remaining: s.qty - (sold[s.itemId] || 0), def: s.def || state.world.codex.items[s.itemId] }))
    .filter((s) => s.remaining > 0 && s.def);

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 30, backgroundColor: "#0d1312",
      display: "flex", flexDirection: "column", maxWidth: "480px", margin: "0 auto",
      borderLeft: "1px solid rgba(215, 167, 111, 0.12)", borderRight: "1px solid rgba(215, 167, 111, 0.12)",
      boxShadow: "0 0 50px rgba(0,0,0,0.9)",
    }}>
      <div style={{
        padding: "calc(env(safe-area-inset-top, 0px) + 14px) 16px 12px 16px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: "1px solid rgba(215, 167, 111, 0.15)", backgroundColor: "rgba(20, 29, 29, 0.95)",
      }}>
        <button onClick={onClose} aria-label="Leave" style={{
          ...iconButtonStyle, width: "30px", height: "30px", borderRadius: "50%",
          backgroundColor: "rgba(215, 167, 111, 0.08)", border: "1px solid rgba(215, 167, 111, 0.2)",
        }}>
          <Icon name="arrowLeft" size={13} color="#e6b98c" strokeWidth={2} />
        </button>
        <div style={{ textAlign: "center", minWidth: 0, padding: "0 6px" }}>
          <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "22px", color: colors.parchmentLight, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {building.label}
          </div>
          <div style={{ ...metaStyle, fontSize: "9px", letterSpacing: "0.16em", color: "rgba(215, 167, 111, 0.78)", marginTop: "3px" }}>Stable</div>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: "5px", padding: "6px 10px", borderRadius: radius.pill,
          border: "1px solid rgba(215, 167, 111, 0.28)", backgroundColor: "rgba(215, 167, 111, 0.08)",
        }}>
          <Icon name="sparkle" size={11} color={colors.gold} />
          <span style={{ fontSize: "12px", fontWeight: 800, color: colors.parchmentLight }}>{formatCoins(coins)}</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "10px 16px 4px", WebkitOverflowScrolling: "touch" }}>
        <Panel tone="warm" style={{ marginBottom: "12px" }}>
          <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "14px", color: colors.parchment, lineHeight: 1.4 }}>{building.blurb}</div>
        </Panel>

        <SectionHeader>Mounts</SectionHeader>
        {mountRows.length === 0 ? (
          <EmptyNote>No beasts for sale just now.</EmptyNote>
        ) : mountRows.map((m) => {
          const t = m.tmpl;
          const price = t.priceCp || 0;
          const meta = `${t.tier} · carries ${t.rideCapacity} · ${t.moveProfile?.canFly ? "flies" : `ground ×${t.moveProfile?.ground ?? 1}`}`;
          return (
            <Row key={m.id} title={t.name} meta={meta} desc={t.desc}>
              <PriceTag cp={price} />
              <ActionButton label="Buy" enabled={canAfford(coins, price) && !loading} onClick={() => onBuyMount(m.id, price)} />
            </Row>
          );
        })}

        <SectionHeader>Feed &amp; tack</SectionHeader>
        {feedRows.length === 0 ? (
          <EmptyNote>Out of feed. Come back in a few days.</EmptyNote>
        ) : feedRows.map((row) => row.def && (
          <Row key={row.itemId} title={row.def.name} meta={`${row.def.kind} · ${row.remaining} in stock`} desc={row.def.description}>
            <PriceTag cp={row.price} />
            <ActionButton label="Buy" enabled={canAfford(coins, row.price) && !loading} onClick={() => onBuy(row.def, row.price, stock.bucket)} />
          </Row>
        ))}
      </div>

      <div style={{
        padding: "12px 16px calc(env(safe-area-inset-bottom, 0px) + 16px)",
        borderTop: "1px solid rgba(215, 167, 111, 0.22)", backgroundColor: "rgba(20, 29, 29, 0.95)", ...glass,
      }}>
        <div style={{ fontSize: "11px", fontStyle: "italic", color: "rgba(237,228,208,0.5)", textAlign: "center" }}>
          A bought mount joins your company. Ride and seat it from the Company panel.
        </div>
      </div>
    </div>
  );
}

function Row({ title, meta, desc, children }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "10px", padding: "11px 13px", marginBottom: "8px",
      borderRadius: radius.panelCompact, backgroundColor: "rgba(20, 29, 29, 0.5)", border: "1px solid rgba(215, 167, 111, 0.14)",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "16px", color: colors.parchmentLight, lineHeight: 1.2 }}>{title}</div>
        <div style={{ ...metaStyle, fontSize: "8px", color: colors.parchmentMuted, margin: "2px 0 4px" }}>{meta}</div>
        <div style={{ fontSize: "11px", color: "rgba(237, 228, 208, 0.7)", lineHeight: 1.35 }}>{desc}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px", flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function PriceTag({ cp }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
      <Icon name="sparkle" size={10} color={colors.gold} />
      <span style={{ fontSize: "12px", fontWeight: 800, color: colors.gold }}>{formatCopper(cp)}</span>
    </div>
  );
}

function ActionButton({ label, enabled, onClick }) {
  return (
    <button onClick={enabled ? onClick : undefined} disabled={!enabled} style={{
      padding: "7px 16px", borderRadius: radius.pill, border: "none",
      backgroundColor: enabled ? colors.gold : "rgba(215, 167, 111, 0.1)",
      color: enabled ? colors.ink : "rgba(215, 167, 111, 0.4)",
      fontSize: "12px", fontWeight: 800, cursor: enabled ? "pointer" : "not-allowed", fontFamily: "inherit",
    }}>{label}</button>
  );
}

function EmptyNote({ children }) {
  return (
    <div style={{ padding: "16px 4px", fontSize: "12px", fontStyle: "italic", color: "rgba(237, 228, 208, 0.45)", textAlign: "center" }}>
      {children}
    </div>
  );
}
