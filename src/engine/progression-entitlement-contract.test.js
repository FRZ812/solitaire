import { describe, it, expect } from "vitest";
import { progressionCombatEntitlements } from "./progression-abilities.js";
import { CHARACTER_TEMPLATES } from "../data/templates.js";
import { getAbilityDef } from "../data/abilities.js";
import { passiveDef } from "../data/passives.js";
import { TIER_BY_ID } from "../data/tiers.js";

// `progressionCombatEntitlements` is the SOLE seam between progression and
// combat — combat.js imports nothing else from the progression layer, and calls
// it at :1886 and :2002. This file pins its SHAPE rather than its contents, so
// the body can be rewritten wholesale without going red.
//
// The load-bearing assertion is the ability-count floor. If a rewrite returns an
// empty kit for some character shape, combat still *works* — the player just
// silently drops to basic attacks — and nothing else in the suite notices.

const ARRAY_KEYS = [
  "abilities",
  "passives",
  "signatureSpellIds",
  "metamagicIds",
  "progressionCapabilities",
  "branchCapabilities",
  "progressionAbilityIds",
  "selectedBranchAbilityIds",
];

const characterFromTemplate = (template) => ({
  name: template.name || template.id,
  race: template.setup.race,
  attributes: { ...template.setup.attributes },
  abilities: template.setup.abilities || [],
  proficiencies: template.setup.proficiencies || {},
  progression: template.setup.progression,
});

describe("progressionCombatEntitlements — structural contract", () => {
  it("returns every documented key with the documented container type", () => {
    const result = progressionCombatEntitlements(characterFromTemplate(CHARACTER_TEMPLATES[0]));
    for (const key of ARRAY_KEYS) {
      expect(Array.isArray(result[key]), `${key} must be an array`).toBe(true);
    }
    expect(typeof result.metamagicByAbilityId).toBe("object");
    expect(result.metamagicByAbilityId).not.toBeNull();
    expect(Array.isArray(result.metamagicByAbilityId)).toBe(false);
  });

  it("tolerates empty, partial, and malformed characters without throwing", () => {
    for (const input of [undefined, null, {}, { abilities: [] }, { progression: {} },
      { abilities: ["not-a-real-ability"], progression: { professions: [] } },
      { abilities: [{}, null, ""], progression: { professions: null, racial: null } }]) {
      const result = progressionCombatEntitlements(input);
      for (const key of ARRAY_KEYS) expect(Array.isArray(result[key])).toBe(true);
    }
  });

  it("only ever emits ability ids that resolve, at a real tier", () => {
    for (const template of CHARACTER_TEMPLATES) {
      const { abilities } = progressionCombatEntitlements(characterFromTemplate(template));
      for (const entry of abilities) {
        expect(entry?.id, `${template.id} emitted an entry with no id`).toBeTruthy();
        expect(getAbilityDef(entry.id), `${template.id} emitted unresolvable ability ${entry.id}`).toBeTruthy();
        expect(TIER_BY_ID[entry.tier], `${template.id} emitted ability ${entry.id} at bogus tier ${entry.tier}`).toBeTruthy();
      }
    }
  });

  it("only ever emits passive ids that resolve, at a real tier", () => {
    for (const template of CHARACTER_TEMPLATES) {
      const { passives } = progressionCombatEntitlements(characterFromTemplate(template));
      for (const entry of passives) {
        expect(passiveDef(entry?.id), `${template.id} emitted unresolvable passive ${entry?.id}`).toBeTruthy();
        expect(TIER_BY_ID[entry.tier], `${template.id} emitted passive ${entry.id} at bogus tier ${entry.tier}`).toBeTruthy();
      }
    }
  });

  it("never emits the same ability id twice", () => {
    for (const template of CHARACTER_TEMPLATES) {
      const { abilities } = progressionCombatEntitlements(characterFromTemplate(template));
      const ids = abilities.map((entry) => entry.id);
      expect(new Set(ids).size, `${template.id} emitted duplicate ability ids`).toBe(ids.length);
    }
  });

  // The anti-regression assertion this whole file exists for.
  //
  // The floor is 2 because that is the MEASURED minimum today (sellsword L8 and
  // reaver L13 both project exactly 2). It is deliberately not a design target —
  // it is a tripwire for a rewrite that returns an empty or near-empty kit,
  // which would otherwise be invisible: combat still runs, the player just
  // silently drops to basic attacks and no other test notices.
  //
  // Raise this to the equipped-slot count once loadout slots land.
  it("gives EVERY playable template a usable kit, not an empty one", () => {
    for (const template of CHARACTER_TEMPLATES) {
      const { abilities } = progressionCombatEntitlements(characterFromTemplate(template));
      expect(
        abilities.length,
        `${template.id} (level ${template.setup.level}) projected only ${abilities.length} abilities — a rewrite has silently emptied the kit`,
      ).toBeGreaterThanOrEqual(2);
    }
  });

  // Recorded because it is a real balance defect, not a passing curiosity.
  // Today's kit size does not track level and diverges wildly by discipline:
  // knight-errant L26 → 5 abilities, hedge-mage L23 → 10; war-captain L43 → 9,
  // battle-archmage L49 → 21; enchanter-tyrant L99 → 23. Casters balloon while
  // martials stay lean, so "how much is on my bar" is set by discipline rather
  // than by progression. Equipped slots are what fix this.
  it("documents the current kit-size spread (tripwire, not a target)", () => {
    const counts = CHARACTER_TEMPLATES.map((template) => (
      progressionCombatEntitlements(characterFromTemplate(template)).abilities.length
    ));
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(2);
    // If this ceiling ever drops, the slot system has landed and this test
    // should be replaced by an assertion about slots rather than owned kit.
    expect(Math.max(...counts)).toBeGreaterThan(15);
  });

  it("is a pure projection — it never writes back into the character", () => {
    const template = CHARACTER_TEMPLATES[0];
    const character = characterFromTemplate(template);
    const before = JSON.stringify(character);
    progressionCombatEntitlements(character);
    expect(JSON.stringify(character)).toBe(before);
  });

  it("is deterministic for the same input", () => {
    for (const template of CHARACTER_TEMPLATES.slice(0, 8)) {
      const character = characterFromTemplate(template);
      const a = progressionCombatEntitlements(character);
      const b = progressionCombatEntitlements(character);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
  });

  it("returns a serializable projection — combat state must survive a save", () => {
    for (const template of CHARACTER_TEMPLATES.slice(0, 8)) {
      const result = progressionCombatEntitlements(characterFromTemplate(template));
      expect(() => JSON.parse(JSON.stringify(result))).not.toThrow();
    }
  });
});
