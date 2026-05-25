import React, { useState } from "react";
import { Icon, ItemIcon } from "./Icon.jsx";
import { SectionHeader, insetBoxStyle } from "./primitives.jsx";
import { colors, radius, fonts, metaStyle } from "./tokens.js";
import { SLOTS, equipSlot, slotCapacity } from "../engine/combat-stats.js";
import { loadOf, itemWeight } from "../engine/weight.js";
import { itemTemplate } from "../data/catalog.js";
import { tierColor } from "../data/tiers.js";
import { freshnessLabel } from "../engine/spoilage.js";
import { effectiveAttributes } from "../data/proficiencies.js";
import { ItemDetail } from "./ItemDetail.jsx";

// Inventory page of the panel deck (components/PanelDeck.jsx): a paper-doll of
// equipment slots, the pack as a tappable LIST, the carry-weight gauge, and the
// player's wealth. Equip/unequip/use run through the shared ItemDetail. Content
// only — the deck supplies the sheet chrome, scroll, and dismissal.
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

export function InventoryView({ state, onEquip, onUnequip, onUse, onLightTorch, onLightLantern, onRest, onBindRune }) {
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
    <div style={{ padding: "2px 16px 8px", display: "flex", flexDirection: "column", gap: "14px", color: colors.parchment }}>
      <div>
        <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "24px", color: colors.parchmentLight, lineHeight: 1.05 }}>Inventory</div>
        <div style={{ ...metaStyle, fontSize: "9px", letterSpacing: "0.16em", color: "rgba(215, 167, 111, 0.7)", marginTop: "2px" }}>Gear · pack · wealth</div>
      </div>

      {/* Carry-weight gauge — Body raises the cap. */}
      <div>
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
      <div>
        <SectionHeader>Equipped</SectionHeader>
        <div style={{ ...insetBoxStyle, padding: "10px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", maxWidth: "264px", margin: "0 auto" }}>
            {DOLL.map((entry, i) => {
              if (!entry) return <div key={`sp${i}`} />;
              const [slotId, idxStr] = entry.split(":");
              const index = idxStr ? Number(idxStr) : 0;
              const id = occupantOf(slotId, index);
              const def = id ? defOf(id) : null;
              return (
                <DollCell key={entry} label={slotLabel(slotId)} id={id} def={def}
                  onTap={id ? () => setDetail({ id, location: "worn" }) : undefined} />
              );
            })}
          </div>
        </div>
      </div>

      {/* Wealth — lives here now (moved off the character sheet), above the pack. */}
      <div>
        <SectionHeader>Wealth</SectionHeader>
        <div style={{
          ...insetBoxStyle, fontFamily: fonts.serif, fontStyle: "italic", fontSize: "17px", color: colors.parchmentLight,
          display: "grid", gridTemplateColumns: "1fr 1px 1fr 1px 1fr", alignItems: "center", textAlign: "center",
        }}>
          <span><strong style={{ color: "#ffd700" }}>{inv.coins.gold}</strong> gp</span>
          <span style={{ width: "1px", height: "16px", background: "rgba(215,167,111,0.18)", justifySelf: "center" }} />
          <span><strong style={{ color: "#d1d5db" }}>{inv.coins.silver}</strong> sp</span>
          <span style={{ width: "1px", height: "16px", background: "rgba(215,167,111,0.18)", justifySelf: "center" }} />
          <span><strong style={{ color: "#cd7f32" }}>{inv.coins.copper}</strong> cp</span>
        </div>
      </div>

      {/* Pack — a tappable list (icon · name · weight · qty). */}
      <div>
        <SectionHeader>Pack {inv.carried.length > 0 ? `· ${inv.carried.length}` : ""}</SectionHeader>
        <div style={{ ...insetBoxStyle, display: "flex", flexDirection: "column", gap: "2px" }}>
          {inv.carried.length === 0
            ? <span style={{ fontSize: "12px", color: "rgba(237,228,208,0.4)", fontStyle: "italic" }}>Your pack is empty.</span>
            : inv.carried.map((c) => {
                const def = defOf(c.itemId);
                const fresh = freshnessLabel(c.freshUntil, state.time?.day || 0);
                const fc = fresh && fresh.tone !== "ok" ? (fresh.tone === "bad" ? "#fca5a5" : "#e6a878") : null;
                const wt = itemWeight(def) * c.quantity;
                return (
                  <button key={c.itemId} onClick={() => setDetail({ id: c.itemId, location: "carried" })} style={rowStyle}>
                    <span style={{ display: "flex", alignItems: "center", minWidth: 0, gap: "7px", flex: 1 }}>
                      <ItemIcon item={def} itemId={c.itemId} size={16} />
                      <span style={{ color: tierColor(def?.tier || "common"), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{def?.name || c.itemId}</span>
                      {fc && <span style={{ fontSize: "9px", fontStyle: "italic", color: fc, flexShrink: 0 }}>· {fresh.text}</span>}
                    </span>
                    <span style={{ ...metaStyle, fontSize: "8px", color: "rgba(215,167,111,0.6)", flexShrink: 0 }}>{wt} wt</span>
                    <span style={{ color: colors.parchmentMuted, fontWeight: "bold", flexShrink: 0, minWidth: "26px", textAlign: "right" }}>×{c.quantity}</span>
                  </button>
                );
              })}
        </div>
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

const rowStyle = {
  display: "flex", alignItems: "center", gap: "8px", width: "100%", textAlign: "left",
  fontSize: "13px", color: colors.parchment, padding: "7px 2px", background: "transparent",
  border: "none", borderBottom: "1px dotted rgba(215, 167, 111, 0.1)", cursor: "pointer", fontFamily: "inherit",
};

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
        ? <ItemIcon item={def} itemId={id} size={20} />
        : <Icon name="x" size={9} color="rgba(215,167,111,0.18)" strokeWidth={2} />}
      <span style={{
        ...metaStyle, fontSize: "7px", letterSpacing: "0.08em",
        color: occupied ? tcolor : "rgba(215,167,111,0.4)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%",
      }}>{occupied ? (def?.name || id) : label}</span>
    </button>
  );
}
