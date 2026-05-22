// Blacksmith schematics + apprenticeship ladder.
//
// A schematic is a recipe: it produces an EQUIPMENT item (equipment.js) from a
// set of MATERIALS (+ optional coin), and is gated behind an apprenticeship
// `rank`. The player must apprentice to the smith to raise their rank before
// the higher schematics can be forged at all (the "unlock schematics before you
// can forge" rule). The forging minigame then sets the OUTPUT TIER, so skill at
// the anvil — not just the recipe — decides how good the piece comes out.
//
// Ranks: 0 = untrained (can forge nothing), 1 = Apprentice, 2 = Journeyman,
// 3 = Master. Apprenticing costs coin + time (you live and labour at the forge).

export const APPRENTICESHIP = [
  { rank: 1, title: "Apprentice", costCp: 50,  days: 10, blurb: "Sweep the floor, work the bellows, ruin a dozen blades — and learn the basics." },
  { rank: 2, title: "Journeyman", costCp: 200, days: 30, blurb: "Months at the anvil. The smith trusts you with steel and the harder patterns." },
  { rank: 3, title: "Master",     costCp: 800, days: 90, blurb: "A long road. You leave able to forge what the smith can — and a little they can't." },
];

export function apprenticeStep(rank) {
  return APPRENTICESHIP.find((a) => a.rank === rank + 1) || null;
}

export function rankTitle(rank) {
  if (rank <= 0) return "Untrained";
  return (APPRENTICESHIP.find((a) => a.rank === rank) || APPRENTICESHIP[APPRENTICESHIP.length - 1]).title;
}

export const SCHEMATICS = [
  { id: "sch-iron-dagger",     rank: 1, item: "iron-dagger",     baseTier: "common",   minutes: 120, requires: [{ id: "iron-ingot", qty: 1 }] },
  { id: "sch-iron-helm",       rank: 1, item: "iron-helm",       baseTier: "common",   minutes: 120, requires: [{ id: "iron-ingot", qty: 1 }] },
  { id: "sch-iron-spear",      rank: 1, item: "iron-spear",      baseTier: "common",   minutes: 150, requires: [{ id: "iron-ingot", qty: 1 }, { id: "hardwood-haft", qty: 1 }] },
  { id: "sch-leather-jerkin",  rank: 1, item: "leather-jerkin",  baseTier: "common",   minutes: 180, requires: [{ id: "leather-hide", qty: 3 }] },
  { id: "sch-round-shield",    rank: 1, item: "round-shield",    baseTier: "common",   minutes: 150, requires: [{ id: "iron-ingot", qty: 1 }, { id: "hardwood-haft", qty: 2 }] },
  { id: "sch-iron-shortsword", rank: 1, item: "iron-shortsword", baseTier: "common",   minutes: 180, requires: [{ id: "iron-ingot", qty: 2 }, { id: "hardwood-haft", qty: 1 }] },
  { id: "sch-iron-mace",       rank: 2, item: "iron-mace",       baseTier: "common",   minutes: 180, requires: [{ id: "iron-ingot", qty: 2 }, { id: "hardwood-haft", qty: 1 }] },
  { id: "sch-iron-longsword",  rank: 2, item: "iron-longsword",  baseTier: "uncommon", minutes: 240, requires: [{ id: "steel-ingot", qty: 2 }, { id: "hardwood-haft", qty: 1 }] },
  { id: "sch-chain-hauberk",   rank: 2, item: "chain-hauberk",   baseTier: "uncommon", minutes: 480, requires: [{ id: "steel-ingot", qty: 4 }] },
];

export function schematicsForBuilding(building) {
  const set = building?.schematics;
  return set ? SCHEMATICS.filter((s) => set.includes(s.id)) : SCHEMATICS;
}
