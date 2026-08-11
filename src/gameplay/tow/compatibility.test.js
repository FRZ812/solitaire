// Phase 0 exit gate.
//
// The support matrix is only worth having if it cannot drift from the game. These tests
// derive every id from the live catalogues rather than from a copy, so adding an ability,
// trait, skill or status without classifying it fails here — and a REFUSED classification
// has to match what admission actually does, not merely claim it.

import { describe, expect, it } from "vitest";
import { ABILITY_CATALOG } from "../../data/abilities.js";
import { CONDITIONS } from "../../data/conditions.js";
import { getStatusDefinition, statusTypes } from "../kernel/status-stack.js";
import { fusionIds, traitIds } from "./traits.js";
import { passiveSkillIds, skillIds } from "./skills.js";
import { mappedProfessionIds } from "./professions.js";
import { towEncounterSupport } from "./solitaire-bridge.js";
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

  it("keeps uncaptured status lifecycles visible rather than silently defaulted", () => {
    const gaps = gapLifecycleStatusTypes();
    expect(gaps.length).toBeGreaterThan(0);
    for (const type of gaps) {
      const definition = getStatusDefinition(type);
      // A gap status must sit inert rather than pretend to a lifecycle it has no evidence for.
      expect(definition.permanent).toBe(false);
      expect(definition.removeAtEndOfTurn).toBe(false);
      expect(definition.decreaseAtEndOfTurn).toBe(false);
      expect(definition.decreaseWhenHit).toBe(false);
    }
  });

  it("names the traits restricted to one authored character", () => {
    expect(exclusiveTraitIds().sort()).toEqual(["assassin", "innovation", "valiancy"]);
  });
});

describe("a refused classification matches what admission actually does", () => {
  const enemies = [{ name: "Foe" }];

  it("refuses player abilities, as the ability domain claims", () => {
    expect(DOMAIN_RULES["player-ability"].support).toBe(SUPPORT.REFUSED);
    const anyAbility = ABILITY_CATALOG[0].id;
    expect(towEncounterSupport({ character: { abilities: [anyAbility] }, party: [], enemies }))
      .toMatchObject({ ok: false, reason: "unsupported-player-abilities" });
  });

  it("refuses conditions, as the condition domain claims", () => {
    expect(DOMAIN_RULES.condition.support).toBe(SUPPORT.REFUSED);
    const anyCondition = Object.keys(CONDITIONS)[0];
    expect(towEncounterSupport({
      character: { conditions: [{ name: anyCondition }] },
      party: [],
      enemies,
    })).toMatchObject({ ok: false, reason: "unsupported-player-conditions" });
  });

  it("refuses the domains listed as uncovered for an admission reason", () => {
    expect(towEncounterSupport({ character: { racialPassives: ["x"] }, party: [], enemies }))
      .toMatchObject({ ok: false, reason: "unsupported-racial-passives" });
    expect(towEncounterSupport({ character: {}, party: ["ally"], enemies }))
      .toMatchObject({ ok: false, reason: "unsupported-companions" });
    expect(towEncounterSupport({ character: {}, party: [], enemies: [{ abilities: ["roar"] }] }))
      .toMatchObject({ ok: false, reason: "unsupported-enemy-mechanics" });
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
