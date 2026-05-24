import React, { useState } from "react";
import { Icon, ItemIcon } from "./Icon.jsx";
import { iconButtonStyle, SectionHeader, insetBoxStyle } from "./primitives.jsx";
import { colors, radius, fonts, metaStyle } from "./tokens.js";
import { SLOTS, equipSlot, slotCapacity } from "../engine/combat-stats.js";
import { loadOf } from "../engine/weight.js";
import { itemTemplate } from "../data/catalog.js";
import { tierColor } from "../data/tiers.js";
import { freshnessLabel } from "../engine/spoilage.js";
import { effectiveAttributes } from "../data/proficiencies.js";
import { formatCoins } from "../engine/economy.js";
import { ItemDetail } from "./ItemDetail.jsx";

// A standard-ARPG inventory screen: a paper-doll of equipment slots, an icon-grid
// pack, and a carry-weight gauge (Body raises the cap — engine/attributes). Equip,
// unequip, use, and the rest of the item actions run through the shared ItemDetail.
//
// Paper-doll layout (3 columns) — each entry is a slot id, "ring:<index>" for the
// two ring cells, or null for an empty spacer.
const DOLL = [
  "neck", "head", "over",
  "back", "body", "hands",
  "mainhand", "torso", "offhand",
  "ring:0", "legs", "ring:1",
  null, "feet", null,
];

export function InventoryView({ state, onClose, onEquip, onUnequip, onUse, onLightTorch, onLightLantern, onRest, onBindRune }) {
  const [detail, setDetail] = useState(null); // { id, location: "worn"|"carried" }
  const codex = state.world.codex;
  const inv = state.character.inventory;
  const wornIds = codex.characters.wanderer?.worn || [];
  const attrs = effectiveAttributes(state.character);
  const defOf = (id) => codex.items[id] || itemTemplate(id);

  const cap = state.character.carryCapacityMax ?? 0;
  const load = Math.round(loadOf(codex.characters?.wanderer, inv, codex.items));
  const pct = cap ? Math.min(100, Math.round((load / cap) * 100)) : 0;
  const over = state.character.overburdened || load > cap;

  const slotLabel = (slotId) => SLOTS.find((s) => s.id === slotId)?.label || slotId;
  const occupantOf = (slotId, index) => wornIds.filter((id) => equipSlot(defOf(id)) === slotId)[index] || null;

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 30, backgroundColor: "#0d1312",
      display: "flex", flexDirection: "column", maxWidth: "480px", margin: "0 auto",
      borderLeft: "1px solid rgba(215, 167, 111, 0.12)", borderRight: "1px solid rgba(215, 167, 111, 0.12)",
      boxShadow: "0 0 50px rgba(0,0,0,0.9)",
    }}>
      {/* Header */}
      <div style={{
        padding: "calc(env(safe-area-inset-top, 0px) + 14px) 16px 12px 16px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: "1px solid rgba(215, 167, 111, 0.15)", backgroundColor: "rgba(20, 29, 29, 0.95)",
      }}>
        <button onClick={onClose} aria-label="Close" style={{
          ...iconButtonStyle, width: "30px", height: "30px", borderRadius: "50%",
          backgroundColor: "rgba(215, 167, 111, 0.08)", border: "1px solid rgba(215, 167, 111, 0.2)",
        }}>
          <Icon name="arrowLeft" size={13} color="#e6b98c" strokeWidth={2} />
        </button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "22px", color: colors.parchmentLight }}>Inventory</div>
          <div style={{ ...metaStyle, fontSize: "9px", letterSpacing: "0.16em", color: "rgba(215, 167, 111, 0.78)", marginTop: "3px" }}>Gear &amp; pack</div>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: "5px", padding: "6px 10px", borderRadius: radius.pill,
          border: "1px solid rgba(215, 167, 111, 0.28)", backgroundColor: "rgba(215, 167, 111, 0.08)",
        }}>
          <Icon name="sparkle" size={11} color={colors.gold} />
          <span style={{ fontSize: "12px", fontWeight: 800, color: colors.parchmentLight }}>{formatCoins(inv.coins)}</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 20px", WebkitOverflowScrolling: "touch" }}>
        {/* Carry-weight gauge — Body raises the cap. */}
        <div style={{ margin: "0 0 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "4px" }}>
            <span style={{ ...metaStyle, fontSize: "9px", color: over ? "#d98a6a" : "rgba(237,228,208,0.72)" }}>{over ? "Overburdened — slowed" : "Carry weight"}</span>
            <span style={{ fontSize: "11px", fontWeight: 800, color: over ? "#d98a6a" : colors.parchment }}>{load} / {cap}</span>
          </div>
          <div style={{ height: "8px", borderRadius: "4px", backgroundColor: "rgba(0,0,0,0.4)", overflow: "hidden", border: "1px solid rgba(215,167,111,0.14)" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: over ? "linear-gradient(90deg,#7c3b2d,#d98a6a)" : "linear-gradient(90deg,#b09156,#d7a76f)", transition: "width 0.4s" }} />
          </div>
          <div style={{ fontSize: "9.5px", fontStyle: "italic", color: "rgba(237,228,208,0.45)", marginTop: "4px" }}>Raised by Body (and a little Vigor).</div>
        </div>

        {/* Paper-doll */}
        <SectionHeader>Equipped</SectionHeader>
        <div style={{ ...insetBoxStyle, padding: "12px", marginBottom: "16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
            {DOLL.map((entry, i) => {
              if (!entry) return <div key={`sp${i}`} />;
              const [slotId, idxStr] = entry.split(":");
              const index = idxStr ? Number(idxStr) : 0;
              const id = occupantOf(slotId, index);
              const def = id ? defOf(id) : null;
              return (
                <DollCell
                  key={entry}
                  label={slotLabel(slotId)}
                  id={id}
                  def={def}
                  onTap={id ? () => setDetail({ id, location: "worn" }) : undefined}
                />
              );
            })}
          </div>
        </div>

        {/* Pack — icon grid */}
        <SectionHeader>Pack {inv.carried.length > 0 ? `· ${inv.carried.length}` : ""}</SectionHeader>
        {inv.carried.length === 0 ? (
          <div style={{ padding: "16px 4px", fontSize: "12px", fontStyle: "italic", color: "rgba(237,228,208,0.45)", textAlign: "center" }}>Your pack is empty.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(58px, 1fr))", gap: "8px" }}>
            {inv.carried.map((c) => {
              const def = defOf(c.itemId);
              const fresh = freshnessLabel(c.freshUntil, state.time?.day || 0);
              return (
                <PackCell key={c.itemId} id={c.itemId} def={def} qty={c.quantity} fresh={fresh} onTap={() => setDetail({ id: c.itemId, location: "carried" })} />
              );
            })}
          </div>
        )}
      </div>

      {detail && (
        <ItemDetail
          item={{ ...itemTemplate(detail.id), ...codex.items[detail.id] }}
          id={detail.id}
          location={detail.location}
          attrs={attrs}
          freshUntil={inv.carried.find((c) => c.itemId === detail.id)?.freshUntil}
          day={state.time?.day || 0}
          onEquip={onEquip}
          onUnequip={onUnequip}
          onUse={onUse}
          onLightTorch={onLightTorch}
          onLightLantern={onLightLantern}
          onRest={onRest}
          onBindRune={onBindRune}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

// One paper-doll cell: the equipped item's glyph (tap for detail) or a faint slot
// label when the slot is empty.
function DollCell({ label, id, def, onTap }) {
  const occupied = !!id;
  const tcolor = occupied ? tierColor(def?.tier || "common") : "rgba(215,167,111,0.14)";
  return (
    <button onClick={onTap} disabled={!occupied} style={{
      aspectRatio: "1", borderRadius: radius.chip, fontFamily: "inherit", padding: "4px", minWidth: 0,
      border: `1px solid ${tcolor}`,
      backgroundColor: occupied ? "rgba(20,29,29,0.65)" : "rgba(20,29,29,0.3)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "3px",
      cursor: occupied ? "pointer" : "default",
    }}>
      {occupied
        ? <ItemIcon item={def} itemId={id} size={24} />
        : <Icon name="x" size={10} color="rgba(215,167,111,0.18)" strokeWidth={2} />}
      <span style={{
        ...metaStyle, fontSize: "7px", letterSpacing: "0.08em",
        color: occupied ? tcolor : "rgba(215,167,111,0.4)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%",
      }}>{occupied ? (def?.name || id) : label}</span>
    </button>
  );
}

// One pack cell: item glyph + quantity badge, freshness-tinted border for food.
function PackCell({ id, def, qty, fresh, onTap }) {
  const fc = fresh && fresh.tone !== "ok" ? (fresh.tone === "bad" ? "#fca5a5" : "#e6a878") : null;
  const border = fc || tierColor(def?.tier || "common");
  return (
    <button onClick={onTap} title={def?.name || id} style={{
      position: "relative", width: "100%", aspectRatio: "1", borderRadius: radius.chip,
      border: `1px solid ${border}`, backgroundColor: "rgba(20,29,29,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontFamily: "inherit",
    }}>
      <ItemIcon item={def} itemId={id} size={26} />
      {qty > 1 && (
        <span style={{
          position: "absolute", bottom: "2px", right: "3px",
          fontSize: "10px", fontWeight: 800, color: colors.parchment, textShadow: "0 1px 2px #000",
        }}>×{qty}</span>
      )}
    </button>
  );
}
