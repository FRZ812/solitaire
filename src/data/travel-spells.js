// Travel magic — utility spells that grant map travel MODES, distinct from combat
// abilities. They are learned like any other ability (an entry in a character's
// `abilities`, granted by a teacher via discoveries.skills, a grimoire, or an
// awakening), but flagged `noncombat: true` so they NEVER appear in the combat bar,
// arsenal, or ability codex — they only light up travel buttons on the map.
//
// The mechanics live here, keyed by id. Each use spends Resolve (which persists out
// of combat), so travel-magic leaves the caster drained. (engine: App.handleFly /
// handleTeleport, MapView; flying the whole party costs one cast PER HEAD, split
// across the casters who know Fly.)

import { DIMENSION_DOOR_RANGE } from "../config.js";
import { tierOrder } from "./tiers.js";

export const TRAVEL_SPELLS = {
  fly: {
    id: "fly", name: "Fly", school: "arcane", icon: "sparkle", noncombat: true,
    mode: "fly", resolveCost: 2, minTier: "rare",
    desc: "Travel magic (cast from the map). Take to the air for about an hour — cross any ground, even water, and see far from on high. What stalks the ground can't reach you, though over wild country things hunt the sky. Flying companions costs a casting for each, split across those who know Fly.",
    description: "Take to the air for about an hour — cross any ground (even water), see far from on high, and leave what prowls below behind. Over the deep wilds, though, predators hunt the air. Flying others costs a casting for each soul carried.",
  },
  "dimension-door": {
    id: "dimension-door", name: "Dimension Door", school: "arcane", icon: "sparkle", noncombat: true,
    mode: "teleport", range: DIMENSION_DOOR_RANGE, resolveCost: 2, minTier: "rare",
    desc: "Travel magic (cast from the map). Step through a fold in space to a spot you can see, a short way off — no road, no danger between.",
    description: "Step through a fold in space to a spot you can see, a short way off — no road, no danger between.",
  },
  gate: {
    id: "gate", name: "Gate", school: "arcane", icon: "sparkle", noncombat: true,
    mode: "teleport", range: Infinity, resolveCost: 4, minTier: "legendary",
    desc: "Travel magic (cast from the map). Tear open a gate to a place you know — somewhere you've been, or a landmark of repute. Distance is nothing; the toll on your will is steep.",
    description: "Tear open a gate to a place you know — somewhere you've been, or a landmark of repute. Distance is nothing; the toll on your will is steep.",
  },
};

export const TRAVEL_SPELL_LIST = Object.values(TRAVEL_SPELLS);
export const TRAVEL_SPELL_IDS = Object.keys(TRAVEL_SPELLS);

export function isTravelSpell(id) { return !!TRAVEL_SPELLS[id]; }
export function travelSpellById(id) { return TRAVEL_SPELLS[id] || null; }

const learnedTiers = (character) => {
  const learned = Array.isArray(character?.abilities) ? character.abilities : [];
  return new Map(learned.map((entry) => {
    const normalized = typeof entry === "string" ? { id: entry, tier: "common" } : entry;
    return [normalized?.id, normalized?.tier || "common"];
  }).filter(([id]) => id));
};

// The travel spells a CHARACTER knows — read from their per-character abilities.
export function knownTravelSpells(character) {
  const learned = learnedTiers(character);
  return TRAVEL_SPELL_IDS.filter((id) => learned.has(id)).map((id) => {
    const spell = TRAVEL_SPELLS[id];
    const learnedTier = learned.get(id) || "common";
    const resolvedTier = spell.minTier && tierOrder(learnedTier) < tierOrder(spell.minTier) ? spell.minTier : learnedTier;
    return { ...spell, tier: resolvedTier };
  });
}

export function knowsTravelSpell(character, id) {
  return !!TRAVEL_SPELLS[id] && learnedTiers(character).has(id);
}
