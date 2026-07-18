import { WIZARD_PROGRESSION_LEVELS } from "./profession-levels/wizard.js";
import { SORCERER_PROGRESSION_LEVELS } from "./profession-levels/sorcerer.js";
import { CLERIC_PROGRESSION_LEVELS } from "./profession-levels/cleric.js";
import { WARRIOR_PROGRESSION_LEVELS } from "./profession-levels/warrior.js";
import { MONK_PROGRESSION_LEVELS } from "./profession-levels/monk.js";
import { BARBARIAN_PROGRESSION_LEVELS } from "./profession-levels/barbarian.js";
import { BARD_PROGRESSION_LEVELS } from "./profession-levels/bard.js";
import { RANGER_PROGRESSION_LEVELS } from "./profession-levels/ranger.js";
import { ROGUE_PROGRESSION_LEVELS } from "./profession-levels/rogue.js";
import { PALADIN_PROGRESSION_LEVELS } from "./profession-levels/paladin.js";
import { DRUID_PROGRESSION_LEVELS } from "./profession-levels/druid.js";
import { WARLOCK_PROGRESSION_LEVELS } from "./profession-levels/warlock.js";
import { ARTIFICER_PROGRESSION_LEVELS } from "./profession-levels/artificer.js";
import { INNKEEPER_PROGRESSION_LEVELS } from "./profession-levels/innkeeper.js";
import { FARMER_PROGRESSION_LEVELS } from "./profession-levels/farmer.js";
import { MERCHANT_PROGRESSION_LEVELS } from "./profession-levels/merchant.js";

// Registry hook for authoring professions one at a time. A missing table is
// deliberately reported as content-incomplete; the engine does not pretend a
// generated filler route is finished authored progression.
export const PROFESSION_LEVEL_TABLES = Object.freeze({
  wizard: WIZARD_PROGRESSION_LEVELS,
  sorcerer: SORCERER_PROGRESSION_LEVELS,
  cleric: CLERIC_PROGRESSION_LEVELS,
  fighter: WARRIOR_PROGRESSION_LEVELS,
  monk: MONK_PROGRESSION_LEVELS,
  barbarian: BARBARIAN_PROGRESSION_LEVELS,
  bard: BARD_PROGRESSION_LEVELS,
  ranger: RANGER_PROGRESSION_LEVELS,
  rogue: ROGUE_PROGRESSION_LEVELS,
  paladin: PALADIN_PROGRESSION_LEVELS,
  druid: DRUID_PROGRESSION_LEVELS,
  warlock: WARLOCK_PROGRESSION_LEVELS,
  artificer: ARTIFICER_PROGRESSION_LEVELS,
  innkeeper: INNKEEPER_PROGRESSION_LEVELS,
  farmer: FARMER_PROGRESSION_LEVELS,
  merchant: MERCHANT_PROGRESSION_LEVELS,
});

export const PROFESSION_CONTENT_STATUS = Object.freeze({ wizard: "complete", sorcerer: "complete", cleric: "complete", fighter: "complete", monk: "complete", barbarian: "complete", bard: "complete", ranger: "complete", rogue: "complete", paladin: "complete", druid: "complete", warlock: "complete", artificer: "complete", innkeeper: "complete", farmer: "complete", merchant: "complete" });

export function professionLevelTable(professionId) {
  return PROFESSION_LEVEL_TABLES[professionId] || null;
}

export function professionContentStatus(professionId) {
  return PROFESSION_CONTENT_STATUS[professionId] || "content-incomplete";
}
