// Buff effects — translate the timed BOON conditions on a character (data/
// conditions.js) into the engine seams they drive. Buffs are laid by boon spells
// (data/buff-spells.js, App.handleCastBuff) and tick down with time like any
// condition; these readers are pure and recomputed wherever they're needed, so an
// effect vanishes the instant its condition lapses.

import { condNames, conditionMeta } from "../data/conditions.js";

// Map-travel speed multiplier (≥1) from active buffs (Haste, etc.). Multiplicative
// so stacked speed boons compound.
export function buffTravelSpeedMult(conditions) {
  let mult = 1;
  for (const name of condNames(conditions)) mult *= (conditionMeta(name).travelSpeedMult || 1);
  return mult;
}

// Transient lift to the bearer's carry cap (engine/attributes.carryCapacityFor
// reads character.carryBonus, which beat.js sets from this each beat).
export function buffCarryBonus(conditions) {
  let sum = 0;
  for (const name of condNames(conditions)) sum += (conditionMeta(name).carryBonus || 0);
  return sum;
}

// Transient lift to the RIDDEN mount's capacity (beat.js writes it to the mount's
// rideCapacityBonus, which engine/riding.rideCapacityOf reads).
export function buffRideBonus(conditions) {
  let sum = 0;
  for (const name of condNames(conditions)) sum += (conditionMeta(name).rideCapacityBonus || 0);
  return sum;
}

// ---- Speed → TIME helpers (the drain-safety guarantee lives here) ----
//
// Need drain and mount-flight stamina are BOTH purely time-based
// (engine/needs.depleteNeeds, App.handleFly's per-hour toll). Haste therefore must
// only ever reduce TIME-per-distance — never inflate it — so a faster journey can
// only cost the same upkeep or less, never more. These helpers enforce that:

// Ground: the same leg simply takes proportionally fewer minutes.
export function hastedGroundMinutes(baseMins, speedMult) {
  return Math.max(1, Math.round(baseMins / Math.max(1, speedMult)));
}

// Flight: a hasted leg REACHES FURTHER (hex cap × speed) within ~the same hour, so
// per-leg time — and thus the per-leg stamina/need toll — stays flat while distance
// grows. (hexes scale up, minutes scale back down by the same factor.)
export function hastedFlightHexes(baseHexes, speedMult) {
  return Math.max(1, Math.round(baseHexes * Math.max(1, speedMult)));
}
export function hastedFlightMinutes(rawFlightMins, speedMult) {
  return Math.max(1, Math.round(rawFlightMins / Math.max(1, speedMult)));
}
