// Phase 0 exit gate.
//
// The support matrix is only worth having if it cannot drift from the game. These tests
// derive every id from the live catalogues rather than from a copy, so adding an ability,
// trait, skill or status without classifying it fails here — and a REFUSED classification
// has to match what admission actually does, not merely claim it.

import { describe, expect, it } from "vitest";
import { ABILITY_CATALOG } from "../../data/abilities.js";
import { CONDITIONS } from "../../data/conditions.js";
import {
  getStatusDefinition,
  PROVISIONAL_CONTROL_LIFECYCLE,
  statusTypes,
} from "../kernel/status-stack.js";
import { fusionIds, traitIds } from "./traits.js";
import { passiveSkillIds, skillIds } from "./skills.js";
import { mappedProfessionIds } from "./professions.js";
import { towEncounterSupport } from "./solitaire-bridge.js";
import { admitTowEncounter } from "./admission.js";
import {
  capabilityInventory,
  DOMAIN_RULES,
  exclusiveTraitIds,
  FIDELITY,
  gapLifecycleStatusTypes,
  isValidFidelity,
  isValidSupport,
  OVERRIDES,
  SUPPORT,
  supportFor,
  UNCOVERED_DOMAINS,
} from "./compatibility.js";

const inventory = capabilityInventory();

function idsFor(domain) {
  return inventory.filter((entry) => entry.domain === domain).map((entry) => entry.id);
}

describe("every capability has exactly one classification", () => {
  it("covers every id the live catalogues contain", () => {
    const covered = new Set(inventory.map((entry) => entry.id));
    const expected = [
      ...traitIds(),
      ...fusionIds(),
      ...skillIds(),
      ...passiveSkillIds(),
      ...statusTypes(),
      ...mappedProfessionIds(),
      ...ABILITY_CATALOG.map((ability) => ability.id),
      ...Object.keys(CONDITIONS),
    ];
    const missing = expected.filter((id) => !covered.has(id));
    expect(missing).toEqual([]);
  });

  it("classifies each id once per domain", () => {
    const seen = new Set();
    const duplicates = [];
    for (const entry of inventory) {
      const key = `${entry.domain}:${entry.id}`;
      if (seen.has(key)) duplicates.push(key);
      seen.add(key);
    }
    expect(duplicates).toEqual([]);
  });

  it("gives every entry a valid support and fidelity", () => {
    for (const entry of inventory) {
      expect(isValidSupport(entry.support), `${entry.id} support`).toBe(true);
      expect(isValidFidelity(entry.fidelity), `${entry.id} fidelity`).toBe(true);
      expect(typeof entry.reason).toBe("string");
      expect(entry.reason.length).toBeGreaterThan(20);
      expect(entry.source).toMatch(/^src\//);
    }
  });

  it("returns nothing for an unknown id or domain", () => {
    expect(supportFor("", "tow-trait")).toBeNull();
    expect(supportFor(null, "tow-trait")).toBeNull();
    expect(supportFor("ironclad", "not-a-domain")).toBeNull();
  });
});

describe("the matrix stays honest about what it does not cover", () => {
  it("carries no override for a capability the catalogues no longer contain", () => {
    const known = new Set(inventory.map((entry) => `${entry.domain}:${entry.id}`));
    const dead = Object.keys(OVERRIDES).filter((key) => !known.has(key));
    expect(dead).toEqual([]);
  });

  it("scopes overrides by domain, so a colliding id is not reclassified", () => {
    // `charge` is both a trait and the status that trait grants.
    expect(supportFor("charge", "tow-trait").fidelity).toBe(FIDELITY.EXACT);
    expect(supportFor("charge", "tow-status").domain).toBe("tow-status");
  });

  it("gives every uncovered domain an objective reason", () => {
    expect(UNCOVERED_DOMAINS.length).toBeGreaterThan(0);
    for (const gap of UNCOVERED_DOMAINS) {
      expect(typeof gap.domain).toBe("string");
      expect(gap.reason.length).toBeGreaterThan(40);
    }
  });

  it("covers every status lifecycle in the shipped source table", () => {
    expect(gapLifecycleStatusTypes()).toEqual([]);
  });

  it("consumes control only when it actually forfeits a command window", () => {
    // The source activates all four control families on TrySkill and decays them PerTurn.
    // Consuming one Count in the command it nullifies is the same holder-turn outcome while
    // preserving newly inflicted control until that holder actually receives a command.
    expect(PROVISIONAL_CONTROL_LIFECYCLE.types).toEqual(["paralyze", "sleep", "stun", "confuse"]);
    expect(PROVISIONAL_CONTROL_LIFECYCLE.evidence).toBe("shipped-1.4.16");
    expect(PROVISIONAL_CONTROL_LIFECYCLE.consumeWhenCommandNullified).toBe(true);
    expect(PROVISIONAL_CONTROL_LIFECYCLE.decreaseAtEndOfTurn).toBe(false);
    for (const type of PROVISIONAL_CONTROL_LIFECYCLE.types) {
      const definition = getStatusDefinition(type);
      expect(definition.decreaseAtEndOfTurn).toBe(false);
      expect(definition.permanent).toBe(false);
      expect(definition.lifecycleEvidence).toBe("shipped-1.4.16");
    }
  });

  it("names the traits restricted to one combat archetype", () => {
    expect(exclusiveTraitIds().sort()).toEqual([
      "assassin",
      "combo",
      "gale",
      "innovation",
      "judgment",
      "necromancy",
      "overheat",
      "valiancy",
    ]);
  });
});

describe("a classification matches what admission actually does", () => {
  // The matrix is only worth having if it describes the code. Rather than asserting a
  // particular verdict, each of these checks that the classification and the behaviour say
  // the same thing — so changing one without the other fails here, in either direction.
  const enemies = [{ name: "Foe" }];

  it("does not block on a capability it classifies as absent or adapted", () => {
    const softDomains = ["player-ability", "racial-passive", "condition"];
    for (const domain of softDomains) {
      expect([SUPPORT.ABSENT, SUPPORT.ADAPTED]).toContain(DOMAIN_RULES[domain].support);
    }
    const anyAbility = ABILITY_CATALOG[0].id;
    const anyCondition = Object.keys(CONDITIONS)[0];
    expect(towEncounterSupport({
      character: {
        abilities: [anyAbility],
        conditions: [{ name: anyCondition }],
        racialPassives: ["darkvision"],
      },
      party: [],
      enemies,
    })).toEqual({ ok: true, reason: null });
  });

  it("carries an adapted condition into the fight rather than merely allowing it", () => {
    // "Adapted" is a claim that the capability arrives in a changed shape. If nothing
    // arrived, the honest classification would be absent.
    const admission = admitTowEncounter({
      character: { conditions: ["Bleeding"] },
      party: [],
      enemies,
    });
    expect(DOMAIN_RULES.condition.support).toBe(SUPPORT.ADAPTED);
    expect(admission.openingStatuses.length).toBeGreaterThan(0);
  });

  it("records every absent capability instead of letting it disappear", () => {
    const admission = admitTowEncounter({
      character: { abilities: [ABILITY_CATALOG[0].id], racialPassives: ["darkvision"] },
      party: [],
      enemies,
    });
    const recorded = admission.notes.map((entry) => entry.code);
    expect(recorded).toContain("ability-superseded-by-package");
    expect(recorded).toContain("racial-passive-superseded-by-package");
  });

  it("still refuses what genuinely cannot run, with an objective code", () => {
    expect(towEncounterSupport({ character: {}, party: [], enemies: [] }))
      .toMatchObject({ ok: false, reason: "no-enemies" });
    expect(towEncounterSupport({ character: {}, party: [], enemies: [{ abilities: ["roar"] }] }))
      .toEqual({ ok: true, reason: null });
    expect(towEncounterSupport({
      character: { conditions: ["Not An Authored Condition"] },
      party: [],
      enemies,
    })).toMatchObject({ ok: false, reason: "unsupported-condition" });
  });

  it("fields a companion now that the domain claims it can", () => {
    expect(DOMAIN_RULES.companion.support).toBe(SUPPORT.ADAPTED);
    const admission = admitTowEncounter({ character: {}, party: [{ id: "ally" }], enemies });
    expect(admission.supported).toBe(true);
    expect(admission.notes.map((entry) => entry.code)).toContain("companion-admitted");
    expect(admission.allies).toHaveLength(1);
  });

  it("still names the domains nothing can field yet", () => {
    // Summons and mounts would be allied actors too, and the allied side now exists — but
    // neither has an authored lifecycle, so neither may be fielded.
    expect(UNCOVERED_DOMAINS.find((gap) => gap.domain === "summon")).toBeTruthy();
    expect(UNCOVERED_DOMAINS.find((gap) => gap.domain === "enemy-mechanic")).toBeUndefined();
  });

  it("admits a plain fighter against plain foes", () => {
    expect(towEncounterSupport({
      character: { abilities: [], conditions: [], racialPassives: [] },
      party: [],
      enemies,
    })).toEqual({ ok: true, reason: null });
  });
});

describe("fidelity classification", () => {
  it("marks Solitaire-native capabilities as extended, not as Tower of Winter parity", () => {
    for (const domain of ["profession", "player-ability", "condition"]) {
      expect(DOMAIN_RULES[domain].fidelity).toBe(FIDELITY.EXTENDED);
    }
  });

  it("marks trait rank interpolation as provisional rather than captured", () => {
    // Both endpoints of every trait span are evidence; the ranks between them are not.
    expect(DOMAIN_RULES["tow-trait"].fidelity).toBe(FIDELITY.BALANCE);
    expect(supportFor("ironclad", "tow-trait").fidelity).toBe(FIDELITY.BALANCE);
  });

  it("marks interval-scaling traits as exact, since both endpoints are captured", () => {
    expect(supportFor("charge", "tow-trait").fidelity).toBe(FIDELITY.EXACT);
    expect(supportFor("shocker", "tow-trait").fidelity).toBe(FIDELITY.EXACT);
  });

  it("classifies every profession, so none silently lacks a combat identity", () => {
    const professions = idsFor("profession");
    expect(professions.length).toBeGreaterThan(0);
    for (const id of professions) {
      expect(supportFor(id, "profession").support).toBe(SUPPORT.ADAPTED);
    }
  });
});
