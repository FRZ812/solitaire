import React, { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { Icon, ItemIcon } from "./Icon.jsx";
import { iconButtonStyle, actionButtonStyle, insetBoxStyle } from "./primitives.jsx";
import { colors, radius, fonts, metaStyle, glass, shadow } from "./tokens.js";
import { itemCombatStats, itemRequirement } from "../engine/combat-stats.js";
import { EQUIPPABLE } from "../engine/inventory.js";
import { isFusionRune, passiveLabel, passiveEffectText, passiveDef } from "../data/passives.js";
import { tierColor, tierLabel } from "../data/tiers.js";
import { useEffectChips } from "../data/goods.js";
import { freshnessLabel, perishDescriptor } from "../engine/spoilage.js";
import { getAbilityDef } from "../data/abilities.js";
import { partyMembers } from "../engine/party.js";
import { loadOf, itemWeight } from "../engine/weight.js";
import { ATTR_LABELS } from "../config.js";

// Tier-coloured passive (affix) pill. Tap to reveal exactly what it does and by
// how much at this item's grade — the magnitude is otherwise opaque on the chip.
export function PassiveChip({ id, tier }) {
  const [open, setOpen] = useState(false);
  const c = tierColor(tier);
  const effect = passiveEffectText(id, tier);
  const flavour = passiveDef(id)?.desc;
  return (
    <div style={{ width: open ? "100%" : "auto" }}>
      <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }} title={effect}
        style={{
          fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: radius.pill,
          color: c, border: `1px solid ${c}`, cursor: "pointer",
          display: "inline-flex", alignItems: "center", gap: "4px",
        }}>
        {passiveLabel(id, tier)}
        {effect && <span style={{ opacity: 0.65, fontSize: "9px" }}>{open ? "▾" : "ⓘ"}</span>}
      </span>
      {open && effect && (
        <div style={{ margin: "5px 2px 2px", lineHeight: 1.45 }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: c }}>{effect}</div>
          {flavour && <div style={{ fontSize: "11px", fontStyle: "italic", color: "rgba(237,228,208,0.6)", marginTop: "2px" }}>{flavour}</div>}
        </div>
      )}
    </div>
  );
}

// Bedroll rest: tap to reveal duration presets; each skips time and restores sleep.
function RestButton({ onRest, onClose }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button onClick={() => setOpen(true)} style={actionButtonStyle()}>Rest…</button>;
  const opt = (label, hours) => (
    <button onClick={() => { onRest?.(hours); onClose(); }} style={{
      flex: 1, padding: "10px 6px", borderRadius: radius.panelCompact, border: `1px solid rgba(215,167,111,0.35)`,
      background: "rgba(215,167,111,0.1)", color: colors.parchmentLight, fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
    }}>{label}</button>
  );
  return (
    <div style={{ display: "flex", gap: "6px" }}>
      {opt("Nap · 1h", 1)}
      {opt("Rest · 4h", 4)}
      {opt("Night · 8h", 8)}
    </div>
  );
}

// "Give to…" picker: pick a destination character + quantity, then fire onTransfer.
// Capacity is checked against the destination's remaining room post-transfer.
function GiveToPicker({ item, id, charId, quantity, state, onTransfer, onClose }) {
  const [open, setOpen] = useState(false);
  const [destId, setDestId] = useState(null);
  const [qty, setQty] = useState(1);
  const codex = state?.world?.codex;
  const unitWt = itemWeight(item);
  const maxQty = Math.max(1, quantity || 1);

  // Eligible destinations: the player and every party member EXCEPT the source.
  // Defensive: omit members with no inventory (pre-migration save).
  const destinations = useMemo(() => {
    if (!codex) return [];
    const wanderer = codex.characters.wanderer;
    const list = [];
    if (wanderer && charId !== "wanderer") {
      list.push({
        id: "wanderer",
        name: "You",
        char: wanderer,
        inv: state.character.inventory,
        cap: state.character.carryCapacityMax ?? 0,
      });
    }
    for (const m of partyMembers(state)) {
      if (!m || m.id === charId) continue;
      if (!m.inventory) continue;
      list.push({
        id: m.id, name: m.name, char: m,
        inv: m.inventory,
        cap: m.carryCapacityMax ?? 0,
      });
    }
    return list;
  }, [codex, charId, state]);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={actionButtonStyle({ ghost: true })}>Give to…</button>
    );
  }

  if (destinations.length === 0) {
    return (
      <div style={{ ...insetBoxStyle, fontSize: "11px", fontStyle: "italic", color: "rgba(237,228,208,0.6)" }}>
        No one to hand it to.
      </div>
    );
  }

  const confirm = (dId, q) => {
    onTransfer?.(charId, dId, id, q);
    onClose();
  };
  const selectedDestination = destinations.find((entry) => entry.id === destId);
  const selectedRemaining = selectedDestination
    ? selectedDestination.cap - loadOf(selectedDestination.char, selectedDestination.inv, codex.items)
    : 0;
  const canConfirm = !!selectedDestination && unitWt * qty <= selectedRemaining;

  return (
    <div style={{ ...insetBoxStyle, display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ ...metaStyle, fontSize: "8px", color: colors.gold }}>Hand off — {item.name || id}</div>
      {maxQty > 1 && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "space-between" }}>
          <span style={{ fontSize: "11px", color: colors.parchmentMuted }}>Quantity</span>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} style={stepperBtn}>−</button>
            <span style={{ minWidth: "32px", textAlign: "center", fontFamily: fonts.serif, fontStyle: "italic", fontSize: "15px", color: colors.parchmentLight }}>{qty}</span>
            <button onClick={() => setQty((q) => Math.min(maxQty, q + 1))} style={stepperBtn}>+</button>
            <button onClick={() => setQty(maxQty)} style={{ ...stepperBtn, fontSize: "9px", padding: "4px 8px" }}>all</button>
          </div>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {destinations.map((d) => {
          const dLoad = loadOf(d.char, d.inv, codex.items);
          const dRem = d.cap - dLoad;
          const transferWt = unitWt * qty;
          const fits = transferWt <= dRem;
          const pctAfter = d.cap ? Math.min(999, Math.round(((dLoad + (fits ? transferWt : 0)) / d.cap) * 100)) : 0;
          const selected = destId === d.id;
          return (
            <button
              key={d.id}
              onClick={() => fits && setDestId(d.id)}
              disabled={!fits}
              title={fits ? undefined : `${d.name} can't carry that — only ${Math.max(0, Math.round(dRem))} of capacity remains.`}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px",
                padding: "7px 10px", borderRadius: radius.chip,
                border: `1px solid ${selected ? colors.gold : "rgba(215,167,111,0.22)"}`,
                backgroundColor: selected ? "rgba(215,167,111,0.12)" : "rgba(20,29,29,0.5)",
                color: fits ? colors.parchment : "rgba(237,228,208,0.35)",
                cursor: fits ? "pointer" : "not-allowed", fontFamily: "inherit", textAlign: "left",
              }}>
              <span style={{ fontSize: "12px", fontWeight: 700 }}>{d.name}</span>
              <span style={{ ...metaStyle, fontSize: "8px", color: fits ? "rgba(215,167,111,0.7)" : "rgba(217,138,106,0.7)" }}>
                {Math.round(dLoad)} / {d.cap} {fits ? `· ${pctAfter}% after` : "· full"}
              </span>
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: "6px" }}>
        <button onClick={() => setOpen(false)} style={{ ...actionButtonStyle({ ghost: true }), flex: 1 }}>Cancel</button>
        <button
          onClick={() => canConfirm && confirm(destId, qty)}
          disabled={!canConfirm}
          style={{
            ...actionButtonStyle(), flex: 1,
            opacity: canConfirm ? 1 : 0.4,
            cursor: canConfirm ? "pointer" : "not-allowed",
          }}>
          Give
        </button>
      </div>
    </div>
  );
}

const stepperBtn = {
  width: "24px", height: "24px", borderRadius: radius.chip,
  border: "1px solid rgba(215,167,111,0.3)", backgroundColor: "rgba(20,29,29,0.6)",
  color: colors.parchment, fontSize: "13px", fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
  display: "inline-flex", alignItems: "center", justifyContent: "center",
};

// Item detail modal: stats, requirement, passives, and equip/unequip/use. Shared
// by the Character sheet and the dedicated Inventory screen.
//
// `charId` identifies WHICH party member this dialog targets — defaults to the
// wanderer so legacy callers (the Character sheet) keep working unchanged. The
// equip/unequip/use callbacks all receive `charId` as their first argument so
// the engine can route the action to the right inventory.
export function ItemDetail({ item, id, location, charId = "wanderer", state, quantity, attrs, freshUntil, day, onEquip, onUnequip, onUse, onLightTorch, onLightLantern, onRest, onBindRune, onTransfer, onClose }) {
  if (!item) return null;
  const cs = itemCombatStats(item);
  const req = itemRequirement(item);
  const reqMet = (attrs[req.attr] || 0) >= req.value;
  const equippable = EQUIPPABLE.has(item.kind);
  const worn = location === "worn";
  const isPlayerTarget = charId === "wanderer";
  // Consumable handling for NPCs is out of scope — only the wanderer can `use`.
  const usable = !worn && !!item.use && isPlayerTarget;
  const bindable = isFusionRune(id) && isPlayerTarget;
  // Give-to picker available for any pack item when the engine wires a transfer
  // handler and we have enough state to render destinations.
  const giveable = !worn && !!onTransfer && !!state;
  const tcolor = tierColor(item.tier || "common");
  const effectChips = useEffectChips(item);
  const keeps = perishDescriptor(item);
  const fresh = freshnessLabel(freshUntil, day);
  const freshColor = fresh ? (fresh.tone === "bad" ? "#fca5a5" : fresh.tone === "warn" ? "#e6a878" : "#a7f3d0") : null;
  const statLine = (label, value) => (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: colors.parchment, padding: "2px 0" }}>
      <span style={{ color: colors.parchmentMuted }}>{label}</span><span>{value}</span>
    </div>
  );
  // Rendered through a portal to document.body so it overlays the whole viewport.
  // (Inside the panel deck it would otherwise be sized against the transformed,
  // 300%-wide page track and appear stretched/off-centre.)
  return createPortal(
    <div onClick={(e) => { e.stopPropagation(); onClose(); }} style={{
      position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center",
      backgroundColor: "rgba(8,12,12,0.7)", backdropFilter: "blur(4px)", padding: "20px",
    }}>
      <div onClick={(e) => e.stopPropagation()} className="scale-in" style={{
        width: "100%", maxWidth: "340px", maxHeight: "80%", overflowY: "auto",
        backgroundColor: "rgba(20,29,29,0.96)", border: `1px solid ${tcolor}`,
        borderRadius: radius.panel, padding: "18px", boxShadow: shadow.sheet,
        display: "flex", flexDirection: "column", gap: "10px", ...glass,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "20px", color: tcolor, lineHeight: 1.1 }}><ItemIcon item={item} itemId={id} size={18} />{item.name || id}</div>
            <div style={{ ...metaStyle, fontSize: "8px", color: colors.parchmentMuted, marginTop: "3px" }}>{tierLabel(item.tier || "common")} · {item.kind || "item"}</div>
          </div>
          <button onClick={onClose} style={{ ...iconButtonStyle, width: "28px", height: "28px", flexShrink: 0, backgroundColor: "rgba(215,167,111,0.08)", border: `1px solid rgba(215,167,111,0.2)` }}>
            <Icon name="x" size={12} color={colors.parchmentMuted} strokeWidth={2} />
          </button>
        </div>

        {item.appearance && <div style={{ fontSize: "12px", fontStyle: "italic", color: "rgba(237,228,208,0.7)", lineHeight: 1.45 }}>{item.appearance}</div>}
        {item.description && <div style={{ fontSize: "12px", color: colors.parchment, lineHeight: 1.45 }}>{item.description}</div>}

        {(cs.damage || cs.armor > 0 || cs.ward > 0 || cs.dodge > 0) && (
          <div style={insetBoxStyle}>
            {cs.damage && statLine("Damage", `${cs.damage.min}–${cs.damage.max} ${cs.damage.type}${cs.damage.pen ? ` · pen ${cs.damage.pen}` : ""}`)}
            {cs.weaponType && statLine("Type", cs.weaponType)}
            {cs.armor > 0 && statLine("Armor", `+${cs.armor}`)}
            {cs.ward > 0 && statLine("Ward", `+${cs.ward}`)}
            {cs.dodge > 0 && statLine("Dodge", `+${cs.dodge}%`)}
            {req.value > 0 && (
              <div style={{ fontSize: "11px", marginTop: "5px", color: reqMet ? "#a7f3d0" : "#fca5a5" }}>
                Requires {ATTR_LABELS[req.attr]} {req.value}{reqMet ? "" : " — under-req: reduced, passives off"}
              </div>
            )}
          </div>
        )}

        {(item.passives && item.passives.length > 0) && (
          <div>
            <div style={{ ...metaStyle, fontSize: "8px", color: colors.gold, marginBottom: "5px" }}>Passives <span style={{ color: colors.parchmentMuted, fontWeight: 400 }}>· tap for detail</span></div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
              {item.passives.map((p, i) => (
                <PassiveChip key={i} id={p.id} tier={p.tier} />
              ))}
            </div>
          </div>
        )}

        {item.grants && (
          <div style={{ ...insetBoxStyle, border: `1px solid rgba(176,114,230,0.4)` }}>
            <div style={{ ...metaStyle, fontSize: "8px", color: "#b072e6", marginBottom: "5px" }}>{worn ? "Granting (while equipped)" : "On equip — awakens magic"}</div>
            {(item.grants.abilities?.length > 0) && (
              <div style={{ fontSize: "11px", color: colors.parchment, marginBottom: "4px" }}>
                Spells in battle: {item.grants.abilities.map((a) => getAbilityDef(a.id)?.name || a.id).join(", ")}
              </div>
            )}
            {(item.grants.spells?.length > 0) && (
              <div style={{ fontSize: "11px", color: colors.parchment }}>
                Cantrips: {item.grants.spells.map((s) => s.name).join(", ")}
              </div>
            )}
            <div style={{ fontSize: "10px", color: "rgba(237,228,208,0.5)", fontStyle: "italic", marginTop: "5px" }}>
              {worn ? "Unequip to set the gift aside." : "Spells scale with Mind — grind Spellcasting to grow it."}
            </div>
          </div>
        )}

        {effectChips.length > 0 && (
          <div style={insetBoxStyle}>
            <div style={{ ...metaStyle, fontSize: "8px", color: colors.gold, marginBottom: "6px" }}>When used</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
              {effectChips.map((c, i) => (
                <span key={i} style={{ fontSize: "11px", fontWeight: 700, color: "#a7f3d0", border: "1px solid rgba(167,243,208,0.35)", padding: "2px 8px", borderRadius: radius.pill }}>{c}</span>
              ))}
            </div>
            {(keeps || fresh) && (
              <div style={{ fontSize: "11px", marginTop: "8px", color: freshColor || "rgba(237,228,208,0.55)" }}>
                {fresh ? `Freshness: ${fresh.text}` : keeps}
              </div>
            )}
          </div>
        )}

        {usable && (
          <button onClick={() => { onUse(id); onClose(); }} style={actionButtonStyle()}>{item.use.verb || "Use"}</button>
        )}
        {isPlayerTarget && id === "torch" && (
          <>
            <div style={{ fontSize: "11px", fontStyle: "italic", color: "rgba(237,228,208,0.6)", margin: "2px 2px 0", lineHeight: 1.4 }}>Needs a tinderbox to strike the flame. Burns ~1h; sheds a modest pool of light.</div>
            <button onClick={() => { onLightTorch?.(); onClose(); }} style={actionButtonStyle()}>Light a torch</button>
          </>
        )}
        {isPlayerTarget && id === "lantern" && (
          <>
            <div style={{ fontSize: "11px", fontStyle: "italic", color: "rgba(237,228,208,0.6)", margin: "2px 2px 0", lineHeight: 1.4 }}>Burns a flask of lamp-oil for ~4h of steady, bright light you can hood at will.</div>
            <button onClick={() => { onLightLantern?.(); onClose(); }} style={actionButtonStyle()}>Light the lantern</button>
          </>
        )}
        {isPlayerTarget && ((item.tool?.uses || []).includes("rest") || (item.tool?.uses || []).includes("camp")) && (
          <RestButton onRest={onRest} onClose={onClose} />
        )}
        {bindable && (
          <>
            <div style={{ fontSize: "11px", fontStyle: "italic", color: "rgba(199,155,224,0.8)", margin: "2px 2px 6px", lineHeight: 1.4 }}>
              Bind this rune to gear that bears two enchantments it can fuse.
            </div>
            <button onClick={() => { onBindRune?.(id); onClose(); }} style={actionButtonStyle()}>Bind Rune…</button>
          </>
        )}
        {equippable && (
          worn
            ? <button onClick={() => { onUnequip(charId, id); onClose(); }} style={actionButtonStyle()}>Unequip</button>
            : <button onClick={() => { onEquip(charId, id); onClose(); }} style={actionButtonStyle()}>Equip</button>
        )}
        {giveable && (
          <GiveToPicker
            item={item} id={id} charId={charId} quantity={quantity}
            state={state} onTransfer={onTransfer} onClose={onClose}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}
