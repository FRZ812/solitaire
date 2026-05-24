// Boon magic — utility self-buffs, distinct from combat abilities and from travel
// MODES (data/travel-spells.js). They are learned like any ability (an entry in a
// character's `abilities`, granted by a teacher / grimoire / awakening via
// discoveries.skills), but flagged `noncombat: true` so they NEVER appear in the
// combat bar or arsenal. Casting one (engine: App.handleCastBuff) spends Resolve
// and lays a timed BUFF CONDITION (data/conditions.js) on you; the condition's
// engine-wired fields (travelSpeedMult / carryBonus / rideCapacityBonus, read via
// engine/buffs.js) then drive travel speed and carrying limits until it lapses.
//
// HASTE deliberately only shortens TIME-per-distance, never the rate of need or
// mount-stamina drain (both are time-based) — so going faster can only cost LESS
// upkeep over a journey, never more (engine/buffs.js, scripts/mount-weight-sim).

export const BUFF_SPELLS = {
  haste: {
    id: "haste", name: "Haste", school: "arcane", icon: "sparkle", noncombat: true, kind: "buff",
    resolveCost: 2, minTier: "rare",
    applies: { condition: "Hastened", minutes: 60 },
    desc: "Boon magic (cast on yourself). Quicken you AND your mount — cover far more ground on the road and fly far faster, for about an hour (and in a fight you act more often). Pure speed: it never tires you or your beast any faster.",
    description: "Quicken yourself and your mount — ground and flight alike move far swifter for a time.",
  },
  "bear-strength": {
    id: "bear-strength", name: "Bear's Strength", school: "arcane", icon: "sparkle", noncombat: true, kind: "buff",
    resolveCost: 2, minTier: "rare",
    applies: { condition: "Bear's Strength", minutes: 120 },
    desc: "Boon magic (cast on yourself). Swell your thews and your mount's for a couple of hours — haul far more weight yourself, and the mount you ride bears a heavier load.",
    description: "A surge of bestial might — your carry limit and your mount's both swell for a time.",
  },
};

export const BUFF_SPELL_LIST = Object.values(BUFF_SPELLS);
export const BUFF_SPELL_IDS = Object.keys(BUFF_SPELLS);

export function isBuffSpell(id) { return !!BUFF_SPELLS[id]; }
export function buffSpellById(id) { return BUFF_SPELLS[id] || null; }

const learnedIds = (character) => {
  const learned = Array.isArray(character?.abilities) ? character.abilities : [];
  return new Set(learned.map((a) => (typeof a === "string" ? a : a?.id)).filter(Boolean));
};

// The boon spells a CHARACTER knows — read from their per-character abilities.
export function knownBuffSpells(character) {
  const ids = learnedIds(character);
  return BUFF_SPELL_IDS.filter((id) => ids.has(id)).map((id) => BUFF_SPELLS[id]);
}
