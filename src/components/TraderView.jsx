import React, { useState } from "react";
import { Icon } from "./Icon.jsx";
import { iconButtonStyle, Panel, SectionHeader } from "./primitives.jsx";
import { colors, radius, fonts, metaStyle, glass } from "./tokens.js";
import { canAfford, formatCopper, formatCoins, SELLABLE_KINDS, usedSellPrice, DEFAULT_RESALE_RATE } from "../engine/economy.js";
import { trainingOffer } from "../engine/training.js";
import { TRAIN_CAP } from "../data/town.js";
import { useEffectChips } from "../data/goods.js";
import { perishDescriptor } from "../engine/spoilage.js";

// A standard trader menu: a Buy ledger rolled from the shop's stock and a Sell
// ledger of the player's saleable goods. Reused by every trader building
// (healer now; market stalls, the smith's counter, etc. later). Transactions
// are deterministic and local — App applies them via engine/economy.js. The
export function TraderView({ state, building, tileKey, stock, receipts = {}, onClose, onBuy, onSell, onForge, onTrain, loading }) {
  const [tab, setTab] = useState("buy");

  const codex = state.world.codex;
  const inv = state.character.inventory;
  const coins = inv.coins;
  const worn = new Set(codex.characters.wanderer?.worn || []);
  const buys = building.buys ? new Set(building.buys) : SELLABLE_KINDS;
  const resaleRate = building.sellRate ?? DEFAULT_RESALE_RATE;

  const tile = state.world.tiles[tileKey];
  const sold = (tile?.shop && tile.shop.bucket === stock.bucket) ? tile.shop.sold : {};

  // Buy ledger: rolled stock minus what's been bought this restock window.
  const buyRows = stock.items
    .map((s) => ({ ...s, remaining: s.qty - (sold[s.itemId] || 0) }))
    .filter((s) => s.remaining > 0);

  // Sell ledger: carried goods the trader will buy back (not worn equipment).
  const sellRows = inv.carried
    .map((c) => ({ c, def: codex.items[c.itemId] }))
    // Only real trade goods sell: a kind this trader buys, a set worth, and not
    // worn. Keepsakes and storied items (no `value`) stay in the pack.
    .filter(({ c, def }) => def && def.value > 0 && buys.has(def.kind) && !worn.has(c.itemId))
    .map(({ c, def }) => {
      // Items bought this visit (and not yet carried out) are refunded in full,
      // at exactly what you paid; anything else sells at the used-goods price.
      const refundStack = receipts[c.itemId] || [];
      const isRefund = refundStack.length > 0;
      return {
        itemId: c.itemId,
        def,
        have: c.quantity,
        isRefund,
        refundCount: refundStack.length,
        price: isRefund ? refundStack[refundStack.length - 1] : usedSellPrice(def.value, resaleRate),
      };
    });

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
          <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "22px", color: colors.parchmentLight, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {building.label}
          </div>
          <div style={{ ...metaStyle, fontSize: "9px", letterSpacing: "0.16em", color: "rgba(215, 167, 111, 0.78)", marginTop: "3px" }}>
            Trader
          </div>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: "5px",
          padding: "6px 10px", borderRadius: radius.pill,
          border: "1px solid rgba(215, 167, 111, 0.28)", backgroundColor: "rgba(215, 167, 111, 0.08)",
        }}>
          <Icon name="sparkle" size={11} color={colors.gold} />
          <span style={{ fontSize: "12px", fontWeight: 800, color: colors.parchmentLight }}>{formatCoins(coins)}</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", padding: "10px 16px 4px", backgroundColor: "rgba(20, 29, 29, 0.95)" }}>
        {[["buy", "Buy"], ["sell", "Sell"]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            flex: 1, height: "34px", borderRadius: radius.panelCompact,
            border: tab === key ? "1px solid rgba(215, 167, 111, 0.5)" : "1px solid rgba(215, 167, 111, 0.18)",
            backgroundColor: tab === key ? "rgba(215, 167, 111, 0.16)" : "rgba(20, 29, 29, 0.4)",
            color: tab === key ? colors.parchmentLight : "rgba(237, 228, 208, 0.6)",
            fontSize: "12px", fontWeight: 800, letterSpacing: "0.08em", cursor: "pointer", fontFamily: "inherit",
          }}>{label}</button>
        ))}
      </div>

      {/* Ledger */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 16px 4px", WebkitOverflowScrolling: "touch" }}>
        <Panel tone="warm" style={{ marginBottom: "12px" }}>
          <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "14px", color: colors.parchment, lineHeight: 1.4 }}>
            {building.blurb}
          </div>
        </Panel>

        {/* Expert training — pay to fast-track a grindy proficiency a step. */}
        {building.trains?.length > 0 && (
          <>
            <SectionHeader>Training</SectionHeader>
            {building.trains.map((profId) => {
              const offer = trainingOffer(state, profId, TRAIN_CAP);
              return (
                <div key={profId} style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "11px 13px", marginBottom: "8px", borderRadius: radius.panelCompact,
                  backgroundColor: "rgba(20, 29, 29, 0.5)", border: "1px solid rgba(215, 167, 111, 0.14)",
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "16px", color: colors.parchmentLight }}>{offer.name}</div>
                    <div style={{ ...metaStyle, fontSize: "8px", color: colors.parchmentMuted, marginTop: "2px" }}>
                      {offer.capped ? `rating ${offer.cur} · mastered here` : `rating ${offer.cur} → ${offer.next} · ${offer.hours}h`}
                    </div>
                  </div>
                  {offer.capped ? (
                    <span style={{ fontSize: "11px", fontStyle: "italic", color: "rgba(237,228,208,0.45)", flexShrink: 0 }}>Mastered</span>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px", flexShrink: 0 }}>
                      <PriceTag cp={offer.costCp} />
                      <ActionButton label="Train" enabled={canAfford(coins, offer.costCp) && !loading} onClick={() => onTrain(profId)} />
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {tab === "buy" && (
          <>
            <SectionHeader>Wares</SectionHeader>
            {buyRows.length === 0 ? (
              <EmptyNote>The shelves are bare. Come back in a few days.</EmptyNote>
            ) : buyRows.map((row) => {
              const affordable = canAfford(coins, row.price) && !loading;
              return (
                <GoodRow key={row.itemId} def={row.def} meta={`${row.remaining} in stock`}>
                  <PriceTag cp={row.price} />
                  <ActionButton label="Buy" enabled={affordable} onClick={() => onBuy(row.def, row.price, stock.bucket)} />
                </GoodRow>
              );
            })}
          </>
        )}

        {tab === "sell" && (
          <>
            <SectionHeader>Your goods</SectionHeader>
            {sellRows.length === 0 ? (
              <EmptyNote>You carry nothing this trader wants to buy.</EmptyNote>
            ) : sellRows.map((row) => (
              <GoodRow key={row.itemId} def={row.def} meta={row.isRefund ? `${row.have} in pack · refundable ×${row.refundCount}` : `${row.have} in pack`}>
                <PriceTag cp={row.price} refund={row.isRefund} />
                <ActionButton label={row.isRefund ? "Refund" : "Sell"} enabled={!loading} onClick={() => onSell(row.itemId, row.price, row.isRefund)} />
              </GoodRow>
            ))}
          </>
        )}
      </div>

      {/* Footer — the forge hand-off (smiths only). Talking to a keeper isn't a
          panel action; the player just types it in the world. */}
      {onForge && (
        <div style={{
          padding: "12px 16px calc(env(safe-area-inset-bottom, 0px) + 16px)",
          borderTop: "1px solid rgba(215, 167, 111, 0.22)",
          backgroundColor: "rgba(20, 29, 29, 0.95)", ...glass,
        }}>
          <button onClick={onForge} style={{
            width: "100%", height: "44px", borderRadius: radius.control, border: "none",
            backgroundColor: colors.gold, color: colors.ink,
            fontSize: "13px", fontWeight: 800, letterSpacing: "0.04em",
            cursor: "pointer", fontFamily: "inherit",
          }}>
            To the Forge
          </button>
        </div>
      )}
    </div>
  );
}

function GoodRow({ def, meta, children }) {
  const chips = useEffectChips(def);
  const keeps = perishDescriptor(def);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "10px",
      padding: "11px 13px", marginBottom: "8px",
      borderRadius: radius.panelCompact,
      backgroundColor: "rgba(20, 29, 29, 0.5)",
      border: "1px solid rgba(215, 167, 111, 0.14)",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "16px", color: colors.parchmentLight, lineHeight: 1.2 }}>{def.name}</div>
        <div style={{ ...metaStyle, fontSize: "8px", color: colors.parchmentMuted, margin: "2px 0 4px" }}>{def.kind} · {meta}</div>
        <div style={{ fontSize: "11px", color: "rgba(237, 228, 208, 0.7)", lineHeight: 1.35 }}>{def.description}</div>
        {chips.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "5px" }}>
            {chips.map((c, i) => (
              <span key={i} style={{ fontSize: "10px", fontWeight: 700, color: "#a7f3d0", background: "rgba(167,243,208,0.08)", border: "1px solid rgba(167,243,208,0.22)", padding: "1px 6px", borderRadius: radius.pill }}>{c}</span>
            ))}
          </div>
        )}
        {keeps && (
          <div style={{ fontSize: "9.5px", fontStyle: "italic", color: typeof def.perish === "number" && def.perish <= 4 ? "rgba(230,160,120,0.85)" : "rgba(237,228,208,0.45)", marginTop: "4px" }}>{keeps}</div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px", flexShrink: 0 }}>
        {children}
      </div>
    </div>
  );
}

function PriceTag({ cp, refund = false }) {
  const color = refund ? "#a7f3d0" : colors.gold;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
      <Icon name="sparkle" size={10} color={color} />
      <span style={{ fontSize: "12px", fontWeight: 800, color }}>{formatCopper(cp)}</span>
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
