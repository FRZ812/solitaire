// Party fly-multicast. Flying the whole band is taxing: Fly must be cast ONCE PER
// HEAD (player + each companion), and the resolve toll is split across the party
// members who actually know Fly. With one caster a big party drains them fast; with
// several, the cost divides. The player can override the auto-split and assign each
// passenger to a specific caster (see MapView's FlyPanel).

import { partyMembers } from "./party.js";
import { knownTravelSpells, TRAVEL_SPELLS } from "../data/travel-spells.js";
import { resolvePoolForMind } from "./attributes.js";

export const FLY_COST = TRAVEL_SPELLS.fly.resolveCost;

const knowsFly = (ch) => knownTravelSpells(ch).some((s) => s.id === "fly");

// A member's current pool — defensively derived from Mind for older party members
// saved before companions carried a persisted resolve pool.
function memberResolve(ch) {
  const max = ch?.resolveMax ?? resolvePoolForMind(ch?.attributes?.mind || 0);
  const cur = ch?.resolve ?? max;
  return { resolve: Math.max(0, Math.round(cur)), resolveMax: max };
}

// Everyone in the party as {id, char, kind, name} — the player is "wanderer".
function roster(state) {
  const player = state.character;
  return [
    { id: "wanderer", char: player, kind: "player", name: player.name || "You" },
    ...partyMembers(state).map((c) => ({ id: c.id, char: c, kind: "companion", name: c.name })),
  ];
}

// Greedy even-out: hand each cast to the caster with the most resolve left AS A
// FRACTION of their pool, so the load spreads across everyone who can cast (a deep
// pool isn't drained alone while a smaller caster idles, and equal pools split
// evenly — 6 heads, 2 casters → 3 each). Returns { passengerId: casterId }.
function balanceAssign(passengers, casters, flyCost) {
  const rem = Object.fromEntries(casters.map((c) => [c.id, c.resolve]));
  const frac = (id) => rem[id] / Math.max(1, (casters.find((c) => c.id === id)?.resolveMax || 1));
  const assign = {};
  for (const p of passengers) {
    let best = null;
    for (const c of casters) {
      if (rem[c.id] < flyCost) continue;
      if (best == null || frac(c.id) > frac(best) || (frac(c.id) === frac(best) && rem[c.id] > rem[best])) best = c.id;
    }
    // If no one can still afford a cast, park it on the deepest pool (flagged infeasible).
    if (best == null && casters.length) best = casters.reduce((a, b) => (rem[b.id] > rem[a.id] ? b : a), casters[0]).id;
    assign[p.id] = best ?? null;
    if (best != null) rem[best] -= flyCost;
  }
  return assign;
}

// The full plan for flying the party from where it stands: who must be carried, who
// can cast, the per-head cost, an auto-balanced assignment, and whether it's payable.
export function flyMulticastPlan(state) {
  const flyCost = FLY_COST;
  const all = roster(state);
  const passengers = all.map(({ id, name, kind }) => ({ id, name, kind }));
  const casters = all.filter((m) => knowsFly(m.char)).map((m) => {
    const r = memberResolve(m.char);
    return { id: m.id, name: m.name, kind: m.kind, resolve: r.resolve, resolveMax: r.resolveMax, capacity: Math.floor(r.resolve / flyCost) };
  });
  const casts = passengers.length;
  const totalCost = casts * flyCost;
  const totalCapacity = casters.reduce((s, c) => s + c.capacity, 0);
  const feasible = casters.length > 0 && totalCapacity >= casts;
  return { flyCost, passengers, casters, casts, totalCost, feasible, autoAssign: balanceAssign(passengers, casters, flyCost) };
}

// Per-caster resolve spend for an assignment ({ casterId: resolveSpent }).
export function assignmentCost(assign, flyCost = FLY_COST) {
  const out = {};
  for (const casterId of Object.values(assign || {})) {
    if (casterId == null) continue;
    out[casterId] = (out[casterId] || 0) + flyCost;
  }
  return out;
}

// Every passenger assigned, and no caster asked for more than they hold.
export function assignmentValid(assign, casters, flyCost = FLY_COST) {
  if (!assign || Object.values(assign).some((c) => c == null)) return false;
  const cost = assignmentCost(assign, flyCost);
  const byId = Object.fromEntries(casters.map((c) => [c.id, c]));
  return Object.entries(cost).every(([id, spent]) => byId[id] && spent <= byId[id].resolve);
}
