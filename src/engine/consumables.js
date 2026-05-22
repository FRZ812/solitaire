// Using a consumable from the pack: spend one and resolve its `use` effect
// (goods.js) — vitality / resolve, needs, and condition removal — deterministic
// and clamped. Returns { state, ok, summary } where summary is a short
// human-readable line of what changed, for a log beat.

export function useConsumable(state, itemId) {
  const def = state.world.codex.items?.[itemId];
  if (!def?.use) return { state, ok: false, reason: "That can't be used." };

  const inv = state.character.inventory;
  const carried = inv.carried.map((c) => ({ ...c }));
  const idx = carried.findIndex((c) => c.itemId === itemId);
  if (idx < 0 || carried[idx].quantity < 1) return { state, ok: false, reason: "You don't have that." };
  carried[idx].quantity -= 1;
  if (carried[idx].quantity <= 0) carried.splice(idx, 1);

  const ch = state.character;
  const u = def.use;
  const parts = [];

  let vitality = ch.vitality;
  if (u.vitality) {
    vitality = Math.max(0, Math.min(ch.vitalityMax, vitality + u.vitality));
    parts.push(`vitality ${u.vitality > 0 ? "+" : ""}${u.vitality}`);
  }
  let resolve = ch.resolve;
  if (u.resolve) {
    resolve = Math.max(0, Math.min(ch.resolveMax, resolve + u.resolve));
    parts.push(`resolve ${u.resolve > 0 ? "+" : ""}${u.resolve}`);
  }

  const needs = { ...ch.needs };
  if (u.needs) {
    for (const k of ["hunger", "thirst", "sleep"]) {
      if (u.needs[k]) {
        needs[k] = Math.max(0, Math.min(100, (needs[k] || 0) + u.needs[k]));
        parts.push(`${k} ${u.needs[k] > 0 ? "+" : ""}${u.needs[k]}`);
      }
    }
  }

  let conditions = ch.conditions;
  if (u.removeConditions?.length) {
    const cleared = ch.conditions.filter((c) => u.removeConditions.includes(c));
    if (cleared.length) {
      conditions = ch.conditions.filter((c) => !u.removeConditions.includes(c));
      parts.push(`${cleared.join(", ")} cleared`);
    }
  }

  const verb = (u.verb || "Use").toLowerCase();
  const summary = `You ${verb} the ${def.name}.${parts.length ? ` (${parts.join(", ")})` : ""}`;

  return {
    ok: true,
    summary,
    state: {
      ...state,
      character: { ...ch, vitality, resolve, needs, conditions, inventory: { ...inv, carried } },
    },
  };
}
