// Food spoilage. Perishable goods (goods.js: kind "food" with a `perish` shelf
// life in days) carry a `freshUntil` ABSOLUTE campaign day on each carried stack
// — the food is good through that day and spoils once the clock passes it.
// Preserved staples (hardtack, jerky, salt-pork, dried beans, onions…) set no
// `perish` and never spoil.
//
// Tracking is lazy and absolute-day based, so it's correct no matter which path
// advanced time (a narrated beat, day-labour, a multi-day apprenticeship): we
// only ever compare freshUntil to the current day. Stacks merge pessimistically
// — a pile is only as fresh as its oldest member.

import { goodDef } from "../data/goods.js";

export function isPerishable(def) {
  return !!def && def.kind === "food" && typeof def.perish === "number";
}

// Stamp/refresh a carried stack's freshUntil when food is acquired. Non-
// perishables are left untouched (no freshUntil). Merging keeps the EARLIER
// date so adding fresh stock to an aging pile doesn't magically renew it.
export function stampFreshUntil(stack, def, day) {
  if (!isPerishable(def)) return stack;
  const fu = (day || 0) + def.perish;
  stack.freshUntil = stack.freshUntil == null ? fu : Math.min(stack.freshUntil, fu);
  return stack;
}

// Remove any perishable stack whose freshUntil has passed. Returns the kept
// stacks and a list of what spoiled (for a log beat). No-op stacks (and the
// whole array, when nothing spoiled) are returned untouched.
export function spoilCarried(carried, day, itemsCodex = {}) {
  const kept = [];
  const spoiled = [];
  for (const c of carried) {
    if (c.freshUntil != null && (day || 0) > c.freshUntil) {
      const name = itemsCodex[c.itemId]?.name || goodDef(c.itemId)?.name || c.itemId;
      spoiled.push({ itemId: c.itemId, name, quantity: c.quantity });
    } else {
      kept.push(c);
    }
  }
  return { carried: spoiled.length ? kept : carried, spoiled };
}

// State-level wrapper for callers outside applyBeat (day-labour, forge). Returns
// the same state object when nothing spoiled, so it's safe to call freely.
export function spoilState(state) {
  const day = state.time?.day || 0;
  const inv = state.character.inventory;
  const { carried, spoiled } = spoilCarried(inv.carried, day, state.world?.codex?.items);
  if (!spoiled.length) return { state, spoiled };
  return {
    spoiled,
    state: { ...state, character: { ...state.character, inventory: { ...inv, carried } } },
  };
}

// Display: a perishable carried stack's freshness, given the current day.
// Returns null for non-perishables. tone: "ok" | "warn" | "bad".
export function freshnessLabel(freshUntil, day) {
  if (freshUntil == null) return null;
  const left = freshUntil - (day || 0);
  if (left < 0) return { text: "spoiled", tone: "bad" };
  if (left === 0) return { text: "spoils today", tone: "warn" };
  if (left === 1) return { text: "1 day left", tone: "warn" };
  if (left <= 3) return { text: `${left} days left`, tone: "warn" };
  return { text: `${left} days fresh`, tone: "ok" };
}

// Display: how a good keeps, for the buy/detail panels (from the def alone).
export function perishDescriptor(def) {
  if (!def || def.kind !== "food") return null;
  if (typeof def.perish !== "number") return "Keeps well — won't spoil";
  if (def.perish <= 4) return `Perishable — eat within ~${def.perish} days`;
  if (def.perish <= 20) return `Keeps ~${def.perish} days`;
  return "Keeps for weeks";
}
