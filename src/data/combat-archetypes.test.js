import { describe, it, expect } from "vitest";
import {
  ARCHETYPES, ARCHETYPE_IDS, PROFESSION_ARCHETYPE, DEFERRED_PROFESSIONS,
  FALLBACK_ARCHETYPE_ID, TELEGRAPH_TAGS, UNIVERSAL_VERBS,
  archetypeById, archetypeIdForProfession, archetypeForCharacter, isDeferredProfession,
  staminaMaxFor, verbCost, answersTelegraph,
} from "./combat-archetypes.js";
import { PROFESSION_PROFILES } from "./profession-progressions.js";
import { getAbilityDef } from "./abilities.js";

const ALL_PROFESSION_IDS = Object.keys(PROFESSION_PROFILES);

describe("archetype coverage", () => {
  it("maps EVERY profession to exactly one archetype, or defers it deliberately", () => {
    for (const professionId of ALL_PROFESSION_IDS) {
      const mapped = archetypeIdForProfession(professionId);
      const deferred = isDeferredProfession(professionId);
      expect(
        mapped || deferred,
        `profession "${professionId}" is neither mapped to an archetype nor listed as deferred`,
      ).toBeTruthy();
    }
  });

  it("never maps a profession to two archetypes", () => {
    const seen = new Map();
    for (const record of Object.values(ARCHETYPES)) {
      for (const professionId of record.professions) {
        expect(
          seen.has(professionId),
          `profession "${professionId}" is claimed by both ${seen.get(professionId)} and ${record.id}`,
        ).toBe(false);
        seen.set(professionId, record.id);
      }
    }
  });

  it("never claims a profession that does not exist", () => {
    for (const record of Object.values(ARCHETYPES)) {
      for (const professionId of record.professions) {
        expect(
          ALL_PROFESSION_IDS.includes(professionId),
          `${record.id} claims "${professionId}", which is not a real profession`,
        ).toBe(true);
      }
    }
  });

  it("defers only professions that actually exist", () => {
    for (const professionId of DEFERRED_PROFESSIONS) {
      expect(ALL_PROFESSION_IDS).toContain(professionId);
    }
  });

  it("keeps the archetype count near the agreed scope", () => {
    expect(ARCHETYPE_IDS.length).toBeGreaterThanOrEqual(8);
    expect(ARCHETYPE_IDS.length).toBeLessThanOrEqual(10);
  });
});

describe("archetype records", () => {
  it("seeds every archetype with abilities that actually resolve", () => {
    for (const record of Object.values(ARCHETYPES)) {
      expect(record.abilities.length, `${record.id} has no seed abilities`).toBeGreaterThan(0);
      for (const abilityId of record.abilities) {
        expect(
          getAbilityDef(abilityId),
          `${record.id} seeds "${abilityId}", which does not resolve to an ability`,
        ).toBeTruthy();
      }
    }
  });

  it("gives every archetype enough seed abilities to fill the slot cap", () => {
    // Slots hard-cap at 5. An archetype that cannot fill its bar would leave a
    // character with permanently empty slots and nothing to swap in.
    for (const record of Object.values(ARCHETYPES)) {
      expect(record.abilities.length, `${record.id} cannot fill 5 slots`).toBeGreaterThanOrEqual(5);
    }
  });

  it("never seeds the same ability into one archetype twice", () => {
    for (const record of Object.values(ARCHETYPES)) {
      expect(new Set(record.abilities).size, `${record.id} has duplicate seed abilities`)
        .toBe(record.abilities.length);
    }
  });

  it("declares a coherent stamina profile and defensive costs", () => {
    for (const record of Object.values(ARCHETYPES)) {
      const { base, perVigor, regen } = record.stamina;
      expect(base, `${record.id} base stamina`).toBeGreaterThan(0);
      expect(perVigor, `${record.id} perVigor`).toBeGreaterThan(0);
      expect(regen, `${record.id} regen`).toBeGreaterThan(0);
      expect(record.guardCost, `${record.id} guardCost`).toBeGreaterThan(0);
      expect(record.evadeCost, `${record.id} evadeCost`).toBeGreaterThan(0);

      const cheapest = Math.min(record.guardCost, record.evadeCost);
      expect(
        regen,
        `${record.id} regenerates ${regen}/round against a cheapest defence of ${cheapest} — defending is free, so stamina exerts no pressure`,
      ).toBeLessThan(cheapest);
    }
  });

  // The load-bearing property of the whole stamina economy, expressed as the
  // thing a player actually feels: how many consecutive rounds can you defend
  // before you are Staggered?
  //
  // Too many and "always defend" is a winning line, the read is irrelevant, and
  // we have rebuilt the problem we set out to fix. Too few and defending is a
  // trap option nobody takes. Against a target fight length of 4-7 rounds, the
  // window has to sit inside the fight.
  it("exhausts a combatant who defends every round, within the length of a fight", () => {
    const REFERENCE_VIGOR = 6;
    for (const record of Object.values(ARCHETYPES)) {
      const pool = staminaMaxFor(record.id, REFERENCE_VIGOR);
      const cheapest = Math.min(record.guardCost, record.evadeCost);
      const netDrain = cheapest - record.stamina.regen;
      const rounds = pool / netDrain;

      expect(
        rounds,
        `${record.id} can defend for ${rounds.toFixed(1)} rounds straight (pool ${pool}, net drain ${netDrain}/round) — long enough to turtle through any fight`,
      ).toBeLessThanOrEqual(10);
      expect(
        rounds,
        `${record.id} is exhausted after ${rounds.toFixed(1)} rounds of defending — defence is not a real option`,
      ).toBeGreaterThanOrEqual(1.5);
    }
  });

  it("lets the front line outlast the back line on defence", () => {
    const sustain = (id) => {
      const record = ARCHETYPES[id];
      return staminaMaxFor(id, 6) / (Math.min(record.guardCost, record.evadeCost) - record.stamina.regen);
    };
    // A Vanguard is built to be hit; a Channeler defends twice and is spent.
    expect(sustain("vanguard")).toBeGreaterThan(sustain("channeler") * 2);
    expect(sustain("zealot")).toBeGreaterThan(sustain("occultist"));
  });

  it("uses only real attribute keys, in priority order", () => {
    const valid = new Set(["body", "reflex", "vigor", "mind", "wit", "presence"]);
    for (const record of Object.values(ARCHETYPES)) {
      expect(record.attributes.length, `${record.id} has no attribute priority`).toBe(4);
      for (const key of record.attributes) {
        expect(valid.has(key), `${record.id} lists bogus attribute "${key}"`).toBe(true);
      }
      expect(new Set(record.attributes).size, `${record.id} repeats an attribute`).toBe(4);
    }
  });

  it("keeps records frozen so combat cannot mutate shared data", () => {
    for (const record of Object.values(ARCHETYPES)) {
      expect(Object.isFrozen(record)).toBe(true);
      expect(Object.isFrozen(record.abilities)).toBe(true);
    }
  });
});

describe("resolution", () => {
  it("resolves a character by their profession", () => {
    expect(archetypeForCharacter({ progression: { professionId: "fighter" } }).id).toBe("vanguard");
    expect(archetypeForCharacter({ progression: { professionId: "wizard" } }).id).toBe("channeler");
    expect(archetypeForCharacter({ progression: { professionId: "bard" } }).id).toBe("voice");
  });

  it("honours profession aliases", () => {
    // "warrior" and "archmage" are alias names the narrator may produce.
    expect(archetypeIdForProfession("warrior")).toBe("vanguard");
    expect(archetypeIdForProfession("archmage")).toBe("channeler");
  });

  it("lets an explicit stored combat archetype override the profession mapping", () => {
    const character = { progression: { professionId: "fighter", combatArchetypeId: "channeler" } };
    expect(archetypeForCharacter(character).id).toBe("channeler");
  });

  it("ignores a stored combat archetype that is not real", () => {
    const character = { progression: { professionId: "fighter", combatArchetypeId: "not-an-archetype" } };
    expect(archetypeForCharacter(character).id).toBe("vanguard");
  });

  // `progression.archetypeId` and `character.archetype` already mean the narrative
  // SPECIALIZATION ("Sellsword", "Pale Archivist"). Combat archetypes must never
  // read them, or a specialization that happens to share a word with an archetype
  // would silently reassign the character's entire combat model.
  it("never mistakes a narrative specialization for a combat archetype", () => {
    const character = {
      profession: "fighter",
      archetype: "warden",                                   // a specialization label
      progression: { professionId: "fighter", archetypeId: "warden" },
    };
    expect(archetypeForCharacter(character).id).toBe("vanguard");
  });

  it("never returns null, whatever it is handed", () => {
    for (const input of [undefined, null, {}, { progression: {} }, { progression: { professionId: "nonsense" } },
      { progression: { professionId: "wanderer" } }]) {
      const record = archetypeForCharacter(input);
      expect(record, `archetypeForCharacter(${JSON.stringify(input)}) returned nothing`).toBeTruthy();
      expect(ARCHETYPE_IDS).toContain(record.id);
    }
  });

  it("falls back for a deferred Wanderer rather than inventing a discipline", () => {
    expect(isDeferredProfession("wanderer")).toBe(true);
    expect(archetypeIdForProfession("wanderer")).toBe(null);
    expect(archetypeForCharacter({ progression: { professionId: "wanderer" } }).id)
      .toBe(FALLBACK_ARCHETYPE_ID);
  });
});

describe("derived combat values", () => {
  it("scales stamina with Vigor and never returns a useless pool", () => {
    for (const id of ARCHETYPE_IDS) {
      expect(staminaMaxFor(id, 0)).toBeGreaterThan(0);
      expect(staminaMaxFor(id, 10)).toBeGreaterThan(staminaMaxFor(id, 0));
      expect(staminaMaxFor(id, -5)).toBeGreaterThan(0); // negative Vigor cannot underflow the pool
    }
    expect(staminaMaxFor("not-an-archetype", 5)).toBeGreaterThan(0);
  });

  it("gives a Vanguard deeper stamina and cheaper guard than a Channeler", () => {
    expect(staminaMaxFor("vanguard", 6)).toBeGreaterThan(staminaMaxFor("channeler", 6));
    expect(verbCost("vanguard", "guard")).toBeLessThan(verbCost("channeler", "guard"));
  });

  it("makes a Skirmisher evade cheaply and guard expensively — the inverse of a Vanguard", () => {
    expect(verbCost("skirmisher", "evade")).toBeLessThan(verbCost("skirmisher", "guard"));
    expect(verbCost("vanguard", "guard")).toBeLessThan(verbCost("vanguard", "evade"));
  });

  it("charges nothing for striking or for an unknown verb", () => {
    expect(verbCost("vanguard", "strike")).toBe(0);
    expect(verbCost("vanguard", "improvise")).toBe(0);
  });
});

describe("telegraphs", () => {
  it("gives every tag a label and a description", () => {
    for (const tag of Object.values(TELEGRAPH_TAGS)) {
      expect(tag.label).toBeTruthy();
      expect(tag.desc).toBeTruthy();
    }
  });

  it("answers a heavy blow with evasion and a flurry with a guard", () => {
    expect(answersTelegraph("heavy", "evade")).toBe(true);
    expect(answersTelegraph("heavy", "guard")).toBe(false);
    expect(answersTelegraph("flurry", "guard")).toBe(true);
    expect(answersTelegraph("flurry", "evade")).toBe(false);
  });

  it("leaves an unblockable telegraph with no defensive answer", () => {
    expect(TELEGRAPH_TAGS.unblockable.answer).toBe(null);
    for (const verb of UNIVERSAL_VERBS) {
      expect(answersTelegraph("unblockable", verb)).toBe(false);
    }
  });

  it("returns false for an unknown tag rather than throwing", () => {
    expect(answersTelegraph("not-a-tag", "guard")).toBe(false);
    expect(answersTelegraph(undefined, "guard")).toBe(false);
  });
});
