// Travel/time upkeep — the survival layer that ticks as the party moves.
//
// On any time-passing beat (a travel leg, a long wait, a rest) the party:
//   • eats and drinks from the SHARED pack to hold off hunger/thirst (Kingmaker
//     rations) — perishables first so nothing rots in the bag;
//   • lets wounds bite — Bleeding/Poisoned cost a little vitality until treated;
//   • drags its companions along on the same clock — they hunger, thirst, and
//     tire too, and call out for a rest when they're spent.
//
// Returns plain info lines so the UI can show, per leg, what was consumed and
// who needs a halt. Pure-ish: clones what it changes, mutates nothing passed in.

import { itemTemplate } from "../data/catalog.js";
import { depleteNeeds, getNeedConditions } from "./needs.js";
import { conditionMeta, condNames } from "../data/conditions.js";

const AUTO_EAT_BELOW = 55;    // top hunger up once it dips below this
const AUTO_DRINK_BELOW = 55;  // …and thirst
const clampNeed = (v) => Math.max(0, Math.min(100, v));

const defOf = (codexItems, id) => codexItems?.[id] || itemTemplate(id);
const lc = (s) => (s || "").toLowerCase();

function removeOne(carried, itemId) {
  const i = carried.findIndex((c) => c.itemId === itemId && c.quantity > 0);
  if (i < 0) return;
  carried[i].quantity -= 1;
  if (carried[i].quantity <= 0) carried.splice(i, 1);
}

// Best food/drink in the pack for a given need — soonest-spoiling first so we
// burn perishables before the preserved staples.
function pickByNeed(carried, codexItems, want, kinds) {
  let best = null;
  for (const c of carried) {
    if (c.quantity <= 0) continue;
    const def = defOf(codexItems, c.itemId);
    if (!def?.use?.needs || !kinds.includes(def.kind)) continue;
    if ((def.use.needs[want] || 0) <= 0) continue;
    const perish = def.perish || Infinity;
    if (!best || perish < best.perish) best = { itemId: c.itemId, def, perish };
  }
  return best;
}

// One eat + one drink pass to top a single person's needs from the shared pack.
// Returns a NEW inventory and the updated needs, plus human lines. Drinking
// prefers a waterskin draught (free, refillable) over consuming ale/wine.
export function autoConsume(inventory, needs, codexItems, who = "") {
  const carried = (inventory.carried || []).map((c) => ({ ...c }));
  const out = { ...needs };
  const lines = [];
  const label = who ? `${who} ` : "";

  if (out.thirst < AUTO_DRINK_BELOW) {
    const vessel = carried.find((c) => {
      const def = defOf(codexItems, c.itemId);
      if (!def?.capacity || c.quantity <= 0) return false;
      return (c.water ?? def.capacity * c.quantity) > 0;
    });
    if (vessel) {
      const def = defOf(codexItems, vessel.itemId);
      vessel.water = (vessel.water ?? def.capacity * vessel.quantity) - 1;
      out.thirst = clampNeed(out.thirst + (def.use?.needs?.thirst || 0));
      lines.push(`${label}drank from a ${lc(def.name)}`);
    } else {
      const d = pickByNeed(carried, codexItems, "thirst", ["drink", "food"]);
      if (d) {
        removeOne(carried, d.itemId);
        out.thirst = clampNeed(out.thirst + (d.def.use.needs.thirst || 0));
        if (d.def.use.needs.hunger) out.hunger = clampNeed(out.hunger + d.def.use.needs.hunger);
        lines.push(`${label}drank ${lc(d.def.name)}`);
      }
    }
  }

  if (out.hunger < AUTO_EAT_BELOW) {
    const f = pickByNeed(carried, codexItems, "hunger", ["food"]);
    if (f) {
      removeOne(carried, f.itemId);
      out.hunger = clampNeed(out.hunger + (f.def.use.needs.hunger || 0));
      if (f.def.use.needs.thirst) out.thirst = clampNeed(out.thirst + f.def.use.needs.thirst);
      lines.push(`${label}ate ${lc(f.def.name)}`);
    }
  }

  return { inventory: { ...inventory, carried }, needs: out, lines };
}

// Feed ONE mount from the pack's feed stores — matching its diet (fodder / meat /
// livestock), soonest-spoiling first. Mounts never touch the party's rations and
// people never eat fodder, so the two upkeep paths don't raid each other's food.
// Returns a NEW inventory, updated needs, and human lines.
export function autoConsumeMount(inventory, mount, needs, codexItems) {
  const carried = (inventory.carried || []).map((c) => ({ ...c }));
  const out = { ...needs };
  const lines = [];
  const diet = mount.feed || "fodder";
  const name = mount.name || "the mount";

  if (out.hunger < AUTO_EAT_BELOW) {
    let best = null;
    for (const c of carried) {
      if (c.quantity <= 0) continue;
      const def = defOf(codexItems, c.itemId);
      if (def?.kind !== "feed" || def.feedKind !== diet || !def.nourish) continue;
      const perish = def.perish || Infinity;
      if (!best || perish < best.perish) best = { itemId: c.itemId, def, perish };
    }
    if (best) {
      removeOne(carried, best.itemId);
      out.hunger = clampNeed(out.hunger + (best.def.nourish.hunger || 0));
      if (best.def.nourish.thirst) out.thirst = clampNeed(out.thirst + best.def.nourish.thirst);
      lines.push(`${name} fed on ${lc(best.def.name)}`);
    }
  }

  return { inventory: { ...inventory, carried }, needs: out, lines };
}

// Wounds bite as the clock turns. Returns reduced vitality + a flavour line if it
// ticked (the actual number is reported by the vitals_delta beat, not here).
export function woundTick(vitality, conditions, minutes) {
  const hours = (minutes || 0) / 60;
  if (hours <= 0) return { vitality, lines: [] };
  let dmg = 0;
  const which = [];
  for (const name of condNames(conditions)) {
    const dot = conditionMeta(name).dotPerHour || 0;
    if (dot > 0) { dmg += dot * hours; which.push(name.toLowerCase()); }
  }
  dmg = Math.round(dmg);
  if (dmg <= 0) return { vitality, lines: [] };
  const next = Math.max(0, vitality - dmg);
  return { vitality: next, lines: [`${which.join(" & ")} saps you — tend it`] };
}

// Drag each companion along the same clock: deplete their needs, feed them from
// the shared pack, and flag any who are spent. Returns updated companion entries
// (by id), the shared inventory after they've eaten, and rest-prompt lines.
export function companionUpkeep(party, codexCharacters, inventory, minutes, decayMult, codexItems) {
  const updated = {};
  let inv = inventory;
  const lines = [];
  for (const id of party || []) {
    const c = codexCharacters?.[id];
    if (!c || c.combatState?.status === "dead") continue;
    const baseNeeds = c.needs || { hunger: 70, thirst: 75, sleep: 70 };
    const drained = depleteNeeds(baseNeeds, minutes, decayMult);
    // Mounts eat their own feed (fodder/meat/livestock); everyone else eats from
    // the shared ration pack.
    const fed = c.kind === "mount"
      ? autoConsumeMount(inv, c, drained, codexItems)
      : autoConsume(inv, drained, codexItems, c.name);
    inv = fed.inventory;
    if (fed.lines.length) lines.push(...fed.lines);
    updated[id] = { ...c, needs: fed.needs };
    // Rest prompts: only the worst state, once, so the log isn't spammed.
    const conds = getNeedConditions(fed.needs);
    if (conds.includes("Exhausted")) lines.push(`${c.name} is exhausted and needs to rest`);
    else if (conds.includes("Parched")) lines.push(`${c.name} is parched`);
    else if (conds.includes("Starving")) lines.push(`${c.name} is starving`);
  }
  return { companions: updated, inventory: inv, lines };
}
