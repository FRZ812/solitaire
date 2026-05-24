// Travel magic — utility spells that grant map travel MODES, distinct from combat
// abilities. They're "known" the same way the grimoire's utility spells are: by an
// entry in world.codex.spells (granted by a teacher/grimoire/the narrator via
// discoveries.spells), NOT in character.abilities — so they never touch combat.
//
// The mechanics live here, keyed by id; knowledge is the codex entry. Each use
// spends Resolve (which persists out of combat), so travel-magic leaves you
// drained for whatever waits on the far side. (engine: handleTravel, MapView)

import { DIMENSION_DOOR_RANGE } from "../config.js";

export const TRAVEL_SPELLS = {
  fly: {
    id: "fly", name: "Fly", mode: "fly", resolveCost: 2, minTier: "rare",
    description: "Take to the air — cross any ground (even water), see far from on high, and leave what prowls below behind. Each leg aloft costs resolve.",
  },
  "dimension-door": {
    id: "dimension-door", name: "Dimension Door", mode: "teleport", range: DIMENSION_DOOR_RANGE, resolveCost: 2, minTier: "rare",
    description: "Step through a fold in space to a spot you can see, a short way off — no road, no danger between.",
  },
  gate: {
    id: "gate", name: "Gate", mode: "teleport", range: Infinity, resolveCost: 4, minTier: "legendary",
    description: "Tear open a gate to a place you know — somewhere you've been, or a landmark of repute. Distance is nothing; the toll on your will is steep.",
  },
};

export function isTravelSpell(id) { return !!TRAVEL_SPELLS[id]; }
export function travelSpellById(id) { return TRAVEL_SPELLS[id] || null; }

// The travel spells the player currently knows — read from the codex's spell lore
// (where utility/known spells live), mapped to their mechanical defs.
export function knownTravelSpells(state) {
  const spells = state?.world?.codex?.spells || {};
  return Object.keys(TRAVEL_SPELLS).filter((id) => spells[id]).map((id) => TRAVEL_SPELLS[id]);
}

export function knowsTravelSpell(state, id) {
  return !!state?.world?.codex?.spells?.[id] && !!TRAVEL_SPELLS[id];
}
