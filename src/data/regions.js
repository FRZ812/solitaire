// Region-gated difficulty. Each biome (data/biomes.js) is assigned a difficulty
// band (data/balance.js). Difficulty rises as you travel out from the Vale core
// toward the cursed marches and the fabled far places — there is no level
// scaling, so the region you stand in decides how tough its foes and loot are.

import { getBiome } from "./biomes.js";
import { difficultyBand } from "./balance.js";

// biome id → difficulty band level (1 easiest … 6 deadliest).
export const BIOME_DIFFICULTY = {
  // The capital — the player's starting ground.
  whitemarch: 2,
  // Vale core — home ground.
  mire: 1,
  "crowsmoor-reach": 1,
  // The settled frontier.
  "tannic-wood": 2,
  "whitemarch-march": 2,
  "bramblewych-reach": 2,
  // The wilds.
  "spine-foothills": 3,
  "iron-plateau": 3,
  "tellmar-road": 3,
  "witchwood-deep": 3,
  // The cursed marches.
  "hollow-coast": 4,
  bonemarsh: 4,
  "pale-steppe": 4,
  // The far reaches — warlord and wyrm country.
  "sundered-wastes": 5,
  "drakeholt-peaks": 5,
  // Anything past the named world.
  "far-wild": 6,
};

// Difficulty profile at a coordinate: the band object plus the biome name, used
// to set enemy/loot tier ceilings and the rollTier luck for that area.
export function regionDifficulty(x, y) {
  const biome = getBiome(x, y);
  const level = BIOME_DIFFICULTY[biome.id] ?? 2;
  return { ...difficultyBand(level), biomeId: biome.id, biomeName: biome.name };
}
