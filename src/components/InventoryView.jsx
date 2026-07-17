import React, { useState, useEffect } from "react";
import { ItemIcon } from "./Icon.jsx";
import { DeckPage, DeckPageHeader } from "./DeckPage.jsx";
import { SectionHeader, insetBoxStyle } from "./primitives.jsx";
import { colors, radius, fonts, metaStyle } from "./tokens.js";
import { SLOTS, equipSlot, slotCapacity } from "../engine/combat-stats.js";
import { loadOf, itemWeight } from "../engine/weight.js";
import { itemTemplate } from "../data/catalog.js";
import { tierColor } from "../data/tiers.js";
import { freshnessLabel } from "../engine/spoilage.js";
import { effectiveAttributes } from "../data/proficiencies.js";
import { partyMembers } from "../engine/party.js";
import { ItemDetail } from "./ItemDetail.jsx";

// Inventory page of the panel deck (components/PanelDeck.jsx): a paper-doll of
// equipment slots, the pack as a tappable LIST, the carry-weight gauge, and the
// player's wealth. Equip/unequip/use run through the shared ItemDetail. Content
// only — the deck supplies the sheet chrome, scroll, and dismissal.
//
// When the party is non-empty, a pill row at the top lets the player switch
// between the wanderer and each companion/mount as the inventory TARGET — all
// paper-doll / pack / gauge / coin reads bind to that target.
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

export function InventoryView({ state, onEquip, onUnequip, onUse, onLightTorch, onLightLantern, onRest, onBindRune, onTransfer, initialSelectedId }) {
  const codex = state.world.codex;
  const members = partyMembers(state);
  const showPills = members.length > 0;
  const [selectedId, setSelectedId] = useState(initialSelectedId || "wanderer");
  const [detail, setDetail] = useState(null); // { id, location: "worn"|"carried" }

  // Sync if parent updates initialSelectedId (e.g. PartyView → Open pack).
  useEffect(() => {
    if (initialSelectedId) setSelectedId(initialSelectedId);
  }, [initialSelectedId]);

  // Close any open ItemDetail when switching target so an action can't fire
  // against the wrong character mid-dialog.
  useEffect(() => { setDetail(null); }, [selectedId]);

  const defOf = (id) => codex.items[id] || itemTemplate(id);

  // Bind every read on this view to the active target. Player path is preserved
  // exactly when selectedId === "wanderer".
  const target = selectedId === "wanderer"
    ? {
        char: codex.characters.wanderer,
        inv: state.character.inventory,
        cap: state.character.carryCapacityMax ?? 0,
        isPlayer: true,
        id: "wanderer",
      }
    : (() => {
        const ch = codex.characters[selectedId];
        return {
          char: ch || null,
          inv: ch?.inventory || null,
          cap: ch?.carryCapacityMax ?? 0,
          isPlayer: false,
          id: selectedId,
        };
      })();

  const isMount = target.char?.kind === "mount";
  const wornIds = target.char?.worn || [];
  const carried = target.inv?.carried || [];
  const attrs = target.isPlayer ? effectiveAttributes(state.character) : (target.char?.attributes || {});

  const load = target.char ? Math.round(loadOf(target.char, target.inv, codex.items)) : 0;
  const cap = target.cap || 0;
  const pct = cap ? Math.min(100, Math.round((load / cap) * 100)) : 0;
  const over = (target.isPlayer ? state.character.overburdened : false) || load > cap;

  const slotLabel = (slotId) => SLOTS.find((s) => s.id === slotId)?.label || slotId;
  const occupantOf = (slotId, index) => wornIds.filter((id) => equipSlot(defOf(id)) === slotId)[index] || null;

  // Coin pool may be `null` on a bonded companion (coins live with the player).
  const coinsBonded = target.inv && target.inv.coins === null;
  const coins = target.inv?.coins;

  return (
    <DeckPage className="inventory-view">
      <DeckPageHeader icon="inventory" title="Inventory" subtitle="Gear · pack · wealth" />

      {/* Member-switch pills — only when the party has anyone in it. */}
      {showPills && (
        <div style={{ display: "flex", gap: "6px", overflowX: "auto", margin: "-2px -4px 0", padding: "0 4px 4px" }} className="inventory-targets no-scrollbar">
          {[codex.characters.wanderer, ...members].filter(Boolean).map((ch) => {
            const isSelf = ch.id === "wanderer";
            const pInv = isSelf ? state.character.inventory : ch.inventory;
            const pCap = isSelf ? (state.character.carryCapacityMax ?? 0) : (ch.carryCapacityMax ?? 0);
            const pLoad = Math.round(loadOf(ch, pInv, codex.items));
            const pPct = pCap ? Math.min(999, Math.round((pLoad / pCap) * 100)) : 0;
            const active = selectedId === ch.id;
            const chipTone = pPct >= 100 ? "#d98a6a" : "rgba(237,228,208,0.55)";
            return (
              <button
                key={ch.id}
                onClick={() => setSelectedId(ch.id)}
                style={{
                  flexShrink: 0,
                  display: "inline-flex", alignItems: "center", gap: "6px",
                  padding: "5px 10px", borderRadius: radius.pill,
                  border: `1px solid ${active ? colors.gold : "rgba(215,167,111,0.25)"}`,
                  backgroundColor: active ? "rgba(215,167,111,0.12)" : "rgba(20,29,29,0.5)",
                  color: active ? colors.parchmentLight : colors.parchment,
                  fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                }}>
                <span>{isSelf ? "You" : ch.name}</span>
                <span style={{ ...metaStyle, fontSize: "8px", color: chipTone }}>{pPct}%</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Carry-weight gauge — Body raises the cap. */}
      <div className="inventory-weight">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "4px" }}>
          <span style={{ ...metaStyle, fontSize: "9px", color: over ? "#d98a6a" : "rgba(237,228,208,0.72)" }}>{over ? "Overburdened — slowed" : "Carry weight"}</span>
          <span style={{ fontSize: "11px", fontWeight: 800, color: over ? "#d98a6a" : colors.parchment }}>{load} / {cap}</span>
        </div>
        <div style={{ height: "8px", borderRadius: "4px", backgroundColor: "rgba(0,0,0,0.4)", overflow: "hidden", border: "1px solid rgba(215,167,111,0.14)" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: over ? "linear-gradient(90deg,#7c3b2d,#d98a6a)" : "linear-gradient(90deg,#b09156,#d7a76f)", transition: "width 0.4s" }} />
        </div>
        {target.isPlayer && (
          <div style={{ fontSize: "9.5px", fontStyle: "italic", color: "rgba(237,228,208,0.45)", marginTop: "4px" }}>Raised by Body (and a little Vigor).</div>
        )}
      </div>

      {/* Paper-doll — hidden for mounts (no worn). */}
      {!isMount && (
        <div>
          <SectionHeader>Equipped</SectionHeader>
          <div style={{ ...insetBoxStyle, padding: "10px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", maxWidth: "264px", margin: "0 auto" }}>
              {DOLL.map((entry, i) => {
                if (!entry) return <div key={`sp${i}`} aria-hidden="true" />;
                const [slotId, idxStr] = entry.split(":");
                const index = idxStr ? Number(idxStr) : 0;
                const id = occupantOf(slotId, index);
                const def = id ? defOf(id) : null;
                return (
                  <DollCell key={entry} index={i} slotId={slotId} label={slotLabel(slotId)} id={id} def={def}
                    onTap={id ? () => setDetail({ id, location: "worn" }) : undefined} />
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Wealth — lives here now (moved off the character sheet), above the pack. */}
      <div>
        <SectionHeader>{isMount ? "Burdens" : "Wealth"}</SectionHeader>
        {coinsBonded ? (
          <div style={{ ...insetBoxStyle, fontSize: "12px", fontStyle: "italic", color: "rgba(237,228,208,0.6)" }}>
            Coin pools with the party.
          </div>
        ) : isMount ? (
          <div style={{ ...insetBoxStyle, fontSize: "12px", fontStyle: "italic", color: "rgba(237,228,208,0.6)" }}>
            A beast keeps no coin.
          </div>
        ) : coins ? (
          <div style={{
            ...insetBoxStyle, fontFamily: fonts.serif, fontStyle: "italic", fontSize: "17px", color: colors.parchmentLight,
            display: "grid", gridTemplateColumns: "1fr 1px 1fr 1px 1fr", alignItems: "center", textAlign: "center",
          }}>
            <span><strong style={{ color: "#ffd700" }}>{coins.gold || 0}</strong> gp</span>
            <span style={{ width: "1px", height: "16px", background: "rgba(215,167,111,0.18)", justifySelf: "center" }} />
            <span><strong style={{ color: "#d1d5db" }}>{coins.silver || 0}</strong> sp</span>
            <span style={{ width: "1px", height: "16px", background: "rgba(215,167,111,0.18)", justifySelf: "center" }} />
            <span><strong style={{ color: "#cd7f32" }}>{coins.copper || 0}</strong> cp</span>
          </div>
        ) : null}
      </div>

      {/* Pack — a tappable list (icon · name · weight · qty). */}
      <div>
        <SectionHeader>{isMount ? "Saddlebag" : "Pack"} {carried.length > 0 ? `· ${carried.length}` : ""}</SectionHeader>
        <div className="inventory-pack" style={{ ...insetBoxStyle, display: "flex", flexDirection: "column", gap: "2px" }}>
          {!target.inv ? (
            <span style={{ fontSize: "12px", color: "rgba(237,228,208,0.4)", fontStyle: "italic" }}>Nothing to carry.</span>
          ) : carried.length === 0
            ? <span style={{ fontSize: "12px", color: "rgba(237,228,208,0.4)", fontStyle: "italic" }}>{isMount ? "Saddlebag is empty." : "Pack is empty."}</span>
            : carried.map((c) => {
                const def = defOf(c.itemId);
                const fresh = freshnessLabel(c.freshUntil, state.time?.day || 0);
                const fc = fresh && fresh.tone !== "ok" ? (fresh.tone === "bad" ? "#fca5a5" : "#e6a878") : null;
                const wt = itemWeight(def) * c.quantity;
                return (
                  <button className="inventory-row" key={c.itemId} onClick={() => setDetail({ id: c.itemId, location: "carried" })} style={rowStyle}>
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
          charId={target.id}
          state={state}
          quantity={carried.find((c) => c.itemId === detail.id)?.quantity || 1}
          attrs={attrs}
          freshUntil={carried.find((c) => c.itemId === detail.id)?.freshUntil}
          day={state.time?.day || 0}
          onEquip={onEquip}
          onUnequip={onUnequip}
          onUse={onUse}
          onLightTorch={onLightTorch}
          onLightLantern={onLightLantern}
          onRest={onRest}
          onBindRune={onBindRune}
          onTransfer={onTransfer}
          onClose={() => setDetail(null)}
        />
      )}
    </DeckPage>
  );
}

const rowStyle = {
  display: "flex", alignItems: "center", gap: "8px", width: "100%", textAlign: "left",
  fontSize: "13px", color: colors.parchment, padding: "7px 2px", background: "transparent",
  border: "none", borderBottom: "1px dotted rgba(215, 167, 111, 0.1)", cursor: "pointer", fontFamily: "inherit",
};

// One paper-doll cell: the equipped item's glyph (tap for detail) or a faint slot
// label when the slot is empty.
function emptySlotDefinition(slotId) {
  if (slotId === "mainhand") return { kind: "weapon", name: "Sword" };
  if (slotId === "offhand") return { kind: "shield", name: "Shield" };
  if (slotId === "body") return { kind: "armor", name: "Light armour" };
  if (slotId === "neck" || slotId === "ring") return { kind: "trinket", slot: slotId, name: "Trinket" };
  return { kind: "clothing", slot: slotId, name: labelForEmptySlot(slotId) };
}

function labelForEmptySlot(slotId) {
  return SLOTS.find((slot) => slot.id === slotId)?.label || slotId;
}

function DollCell({ index, slotId, label, id, def, onTap }) {
  const occupied = !!id;
  const tcolor = occupied ? tierColor(def?.tier || "common") : "rgba(215,167,111,0.24)";
  return (
    <button className={`inventory-slot${occupied ? " is-occupied" : ""}`} onClick={onTap} disabled={!occupied} style={{
      "--slot-index": index,
      aspectRatio: "1", borderRadius: radius.chip, fontFamily: "inherit", padding: "4px", minWidth: 0,
      border: `1px solid ${tcolor}`,
      backgroundColor: occupied ? "rgba(20,29,29,0.65)" : "rgba(16,43,67,0.24)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "3px",
      cursor: occupied ? "pointer" : "default",
    }}>
      {occupied
        ? <ItemIcon item={def} itemId={id} size={20} />
        : <ItemIcon item={emptySlotDefinition(slotId)} size={20} className="is-empty" style={{ opacity: 0.24, filter: "grayscale(.45)" }} />}
      <span style={{
        ...metaStyle, fontSize: "7px", letterSpacing: "0.08em",
        color: occupied ? tcolor : "rgba(215,167,111,0.56)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%",
      }}>{occupied ? (def?.name || id) : label}</span>
    </button>
  );
}
