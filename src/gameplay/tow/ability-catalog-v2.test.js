import { describe, expect, it } from "vitest";
import { abilityProfile } from "./ability-profile.js";
import {
  TOW_ABILITY_CATALOG_V2,
  TOW_ABILITY_CATALOG_V2_CHECKSUM,
  TOW_ABILITY_CATALOG_V2_LIST,
  TOW_ABILITY_NAMES_V2,
  TOW_ABILITY_ROLES_V2,
  TOW_ABILITY_STATUS_LIST_V2,
  TOW_ABILITY_STATUSES_V2,
  TOW_ABILITY_ZONE_LIST_V2,
  TOW_ABILITY_ZONES_V2,
  TOW_DEFAULT_ABILITY_KITS_V2,
  calculateTowAbilityCatalogV2Checksum,
  getTowAbilityNameV2,
  getTowAbilityRolesV2,
  getTowAbilityRulesV2,
  getTowDefaultAbilityKitV2,
  getTowStatusRulesV2,
} from "./ability-catalog-v2.js";
import {
  TOW_ABILITY_RULESET_V2_ID,
  abilityRulesV2AtRank,
  isAbilityRulesV2,
  isZoneRulesV2Registry,
  validateAbilityZoneReferencesV2,
} from "./ability-rules-v2.js";
import {
  isStatusRulesV2,
  isStatusRulesV2Registry,
  validateAbilityRuleReferencesV2,
  validateAbilityStatusReferencesV2,
  validateZoneStatusReferencesV2,
} from "./status-rules-v2.js";
import { TOW_RULESET_ID, createTowSession, isTowSession } from "./session.js";
import { getSkill } from "./skills.js";

const EXPECTED_ARCHETYPES = Object.freeze([
  "knight",
  "ranger",
  "artificer",
  "berserker",
  "sorcerer",
  "rogue",
  "warlock",
  "wizard",
  "paladin",
  "blademaster",
  "vampire",
  "automaton",
]);

const EXPECTED_COVERAGE = Object.freeze({
  lanes: Object.freeze({ main: 30, quick: 18, reaction: 12 }),
  sides: Object.freeze({ enemy: 32, ally: 21, self: 7 }),
  shapes: Object.freeze({
    single: 40,
    row: 6,
    column: 2,
    "cross-short": 5,
    "cross-full": 3,
    all: 4,
  }),
  rankOneCosts: Object.freeze({ 0: 12, 1: 21, 2: 13, 3: 7, 4: 4, 5: 3 }),
  roles: Object.freeze({
    buff: 21,
    cleanse: 4,
    damage: 25,
    economy: 1,
    heal: 6,
    "tank-control": 27,
    tempo: 5,
  }),
});

function tally(values) {
  return Object.fromEntries(
    [...new Set(values)].sort().map((value) => [
      value,
      values.filter((candidate) => candidate === value).length,
    ]),
  );
}

function assertDeeplyFrozen(value, visited = new Set()) {
  if (!value || typeof value !== "object" || visited.has(value)) return;
  visited.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) assertDeeplyFrozen(child, visited);
}

function openLegacySession() {
  return createTowSession({
    sessionId: "ability-catalog-v2-legacy-proof",
    rootSeed: "ability-catalog-v2-legacy-proof-seed",
    player: {
      id: "wanderer",
      name: "Wanderer",
      maxHp: 170,
      stats: { attack: 12, defense: 13, critRate: 0, dodgeRate: 0 },
    },
    enemies: [{
      id: "foe-0",
      name: "Bandit",
      maxHp: 40,
      stats: { attack: 9, defense: 0, critRate: 0, dodgeRate: 0 },
      attacks: [{ id: "jab", name: "Jab", hits: 1, damage: 6 }],
    }],
    build: { traits: {}, skills: ["strike", "block"] },
  });
}

describe("the opt-in party ability catalogue", () => {
  it("pins twelve unique five-action kits to exactly sixty definitions", () => {
    expect(Object.keys(TOW_DEFAULT_ABILITY_KITS_V2)).toEqual(EXPECTED_ARCHETYPES);

    const kitIds = EXPECTED_ARCHETYPES.flatMap((archetypeId) => {
      const kit = getTowDefaultAbilityKitV2(archetypeId);
      expect(kit).toHaveLength(5);
      expect(kit).toBe(TOW_DEFAULT_ABILITY_KITS_V2[archetypeId]);
      for (const id of kit) expect(getSkill(id)?.archetypeId, id).toBe(archetypeId);
      return kit;
    });

    expect(kitIds).toHaveLength(60);
    expect(new Set(kitIds).size).toBe(60);
    expect(Object.keys(TOW_ABILITY_CATALOG_V2)).toHaveLength(60);
    expect(TOW_ABILITY_CATALOG_V2_LIST).toHaveLength(60);
    expect(Object.keys(TOW_ABILITY_NAMES_V2)).toHaveLength(60);
    expect(Object.keys(TOW_ABILITY_ROLES_V2)).toHaveLength(60);
    expect(new Set(TOW_ABILITY_CATALOG_V2_LIST.map(({ id }) => id))).toEqual(new Set(kitIds));
    expect(TOW_ABILITY_CATALOG_V2_LIST.map(({ id }) => id)).toEqual(kitIds);
    expect(new Set(Object.keys(TOW_ABILITY_NAMES_V2))).toEqual(new Set(kitIds));
    expect(new Set(Object.keys(TOW_ABILITY_ROLES_V2))).toEqual(new Set(kitIds));

    expect(getTowDefaultAbilityKitV2("unknown")).toBe(null);
    expect(getTowAbilityRulesV2("unknown")).toBe(null);
    expect(getTowAbilityNameV2("unknown")).toBe(null);
    expect(getTowAbilityRolesV2("unknown")).toBe(null);
    expect(getTowAbilityRulesV2(null)).toBe(null);
    expect(getTowStatusRulesV2("unknown")).toBe(null);
  });

  it("preserves every selected source id, generalized name, and authored rank count", () => {
    for (const definition of TOW_ABILITY_CATALOG_V2_LIST) {
      const source = getSkill(definition.id);
      expect(source, definition.id).not.toBe(null);
      expect(source.source?.build, definition.id).toBe("1.4.16");
      expect(getTowAbilityNameV2(definition.id), definition.id).toBe(source.name);
      expect(definition.rankCount, definition.id).toBe(source.rankCount);
      expect(getTowAbilityRulesV2(definition.id), definition.id).toBe(definition);
    }
  });

  it("validates every literal definition through the strict status and zone registries", () => {
    expect(isZoneRulesV2Registry(TOW_ABILITY_ZONES_V2)).toBe(true);
    expect(Object.keys(TOW_ABILITY_ZONES_V2)).toHaveLength(7);
    expect(TOW_ABILITY_ZONE_LIST_V2).toHaveLength(7);
    expect(isStatusRulesV2Registry(TOW_ABILITY_STATUSES_V2)).toBe(true);
    expect(Object.keys(TOW_ABILITY_STATUSES_V2)).toHaveLength(30);
    expect(TOW_ABILITY_STATUS_LIST_V2).toHaveLength(30);
    expect(validateZoneStatusReferencesV2(TOW_ABILITY_ZONES_V2, TOW_ABILITY_STATUSES_V2))
      .toEqual({ ok: true, reason: null });

    const referencedZoneIds = new Set();
    const referencedStatusIds = new Set();
    for (const definition of TOW_ABILITY_CATALOG_V2_LIST) {
      expect(isAbilityRulesV2(definition), definition.id).toBe(true);
      expect(validateAbilityZoneReferencesV2(definition, TOW_ABILITY_ZONES_V2), definition.id)
        .toEqual({ ok: true, reason: null });
      expect(validateAbilityStatusReferencesV2(definition, TOW_ABILITY_STATUSES_V2), definition.id)
        .toEqual({ ok: true, reason: null });
      expect(validateAbilityRuleReferencesV2(definition, {
        zones: TOW_ABILITY_ZONES_V2,
        statuses: TOW_ABILITY_STATUSES_V2,
      }), definition.id).toEqual({ ok: true, reason: null });
      for (const effect of definition.effects) {
        if (effect.primitive === "zone") referencedZoneIds.add(effect.subject);
        if (["status", "cleanse"].includes(effect.primitive)) {
          referencedStatusIds.add(effect.subject);
        }
      }
    }
    for (const zone of TOW_ABILITY_ZONE_LIST_V2) {
      if (["status", "cleanse"].includes(zone.payload.primitive)) {
        referencedStatusIds.add(zone.payload.subject);
      }
    }
    for (const status of TOW_ABILITY_STATUS_LIST_V2) {
      expect(isStatusRulesV2(status), status.id).toBe(true);
      expect(getTowStatusRulesV2(status.id), status.id).toBe(status);
    }
    expect(referencedZoneIds).toEqual(new Set(Object.keys(TOW_ABILITY_ZONES_V2)));
    expect(referencedStatusIds).toEqual(new Set(Object.keys(TOW_ABILITY_STATUSES_V2)));

    expect(getTowStatusRulesV2("challenged")).toMatchObject({
      provenance: "source-actor",
      duration: { clock: "recipient-turn-end", count: 1 },
      stacking: { policy: "replace", cap: 1 },
      polarity: "harmful",
      category: "targeting",
      behavior: "forced-target",
    });
    for (const id of ["delayed-lethargy", "blade-dance-parry"]) {
      expect(getTowStatusRulesV2(id), id).toMatchObject({
        duration: { clock: "recipient-turn-end", count: 2 },
        decay: { timing: "none", stacks: 0 },
        expiry: "duration-end",
      });
    }
  });

  it("locks the proposed lane, side, shape, and opening Resolve-cost distributions", () => {
    expect(tally(TOW_ABILITY_CATALOG_V2_LIST.map(({ action }) => action.lane)))
      .toEqual(EXPECTED_COVERAGE.lanes);
    expect(tally(TOW_ABILITY_CATALOG_V2_LIST.map(({ targeting }) => targeting.side)))
      .toEqual(EXPECTED_COVERAGE.sides);
    expect(tally(TOW_ABILITY_CATALOG_V2_LIST.map(({ targeting }) => targeting.area.shape)))
      .toEqual(EXPECTED_COVERAGE.shapes);
    expect(tally(TOW_ABILITY_CATALOG_V2_LIST.map(({ action }) => action.resolveCostByRank[0])))
      .toEqual(EXPECTED_COVERAGE.rankOneCosts);

    const reactions = TOW_ABILITY_CATALOG_V2_LIST.filter(({ action }) => (
      action.lane === "reaction"
    ));
    expect(tally(reactions.map(({ action }) => action.reactionWatch))).toEqual({
      "selected-hostile-source": 1,
      "selected-hostile-target": 11,
    });
    expect(reactions.find(({ action }) => action.reactionWatch === "selected-hostile-source")?.id)
      .toBe("clocktower-suppressive-shot");
    expect(TOW_ABILITY_CATALOG_V2_LIST.filter(({ action }) => action.lane !== "reaction")
      .every(({ action }) => action.reactionWindow === null && action.reactionWatch === null))
      .toBe(true);
  });

  it("keeps support, displacement, zone, and explicit multi-hit identities inspectable", () => {
    const abilitiesWith = (primitive) => TOW_ABILITY_CATALOG_V2_LIST.filter(
      ({ effects }) => effects.some((effect) => effect.primitive === primitive),
    );
    const explicitDamageHits = (id) => getTowAbilityRulesV2(id).effects.filter(
      ({ primitive }) => primitive === "damage",
    ).length;

    expect(abilitiesWith("damage")).toHaveLength(20);
    expect(abilitiesWith("heal")).toHaveLength(6);
    expect(abilitiesWith("cleanse")).toHaveLength(4);
    expect(abilitiesWith("resource")).toHaveLength(1);
    expect(TOW_ABILITY_CATALOG_V2_LIST.filter(({ effects }) => effects.some(
      ({ primitive }) => ["move", "push", "pull"].includes(primitive),
    ))).toHaveLength(6);
    expect(abilitiesWith("zone")).toHaveLength(7);
    expect(tally(TOW_ABILITY_ZONE_LIST_V2.map(({ movementPolicy }) => movementPolicy))).toEqual({
      "block-exit": 2,
      none: 5,
    });
    expect(tally(Object.values(TOW_ABILITY_ROLES_V2).flat())).toEqual(EXPECTED_COVERAGE.roles);
    for (const [id, roles] of Object.entries(TOW_ABILITY_ROLES_V2)) {
      expect(roles.length, id).toBeGreaterThan(0);
      expect(new Set(roles).size, id).toBe(roles.length);
      expect(getTowAbilityRolesV2(id), id).toBe(roles);
    }

    expect(explicitDamageHits("assassin-flurry")).toBe(2);
    expect(explicitDamageHits("demon-arrow-rain")).toBe(4);
    expect(explicitDamageHits("witch-all-out-attack")).toBe(5);
    expect(explicitDamageHits("mage-god-slaying-spear")).toBe(3);
    expect(TOW_ABILITY_CATALOG_V2_LIST.some(({ effects }) => effects.some(
      (effect) => Object.hasOwn(effect, "hits"),
    ))).toBe(false);

    const cleanses = (id) => getTowAbilityRulesV2(id).effects.filter(
      ({ primitive }) => primitive === "cleanse",
    );
    expect(cleanses("north-king-warriors-oath").every(
      ({ operation, value }) => operation === "clear"
        && value.unit === "flat"
        && value.byRank.every((amount) => amount === 0),
    )).toBe(true);
    expect(cleanses("priestess-purification").every(
      ({ operation, value }) => operation === "retain-percent"
        && value.unit === "percent"
        && value.byRank.join(",") === "40,30,20,0",
    )).toBe(true);
    expect(cleanses("automaton-repair").every(
      ({ operation, value }) => operation === "retain-percent"
        && value.unit === "percent"
        && value.byRank.every((amount) => amount === 40),
    )).toBe(true);
    expect(cleanses("assassin-cold-blood")).toEqual([
      expect.objectContaining({
        operation: "clear",
        subject: "protection",
        value: { unit: "flat", basis: "none", byRank: [0, 0] },
      }),
    ]);
  });

  it("gives every adjacent multi-rank promotion a real combat progression vector", () => {
    for (const definition of TOW_ABILITY_CATALOG_V2_LIST) {
      if (definition.rankCount === 1) continue;
      const rankVectors = Array.from({ length: definition.rankCount }, (_, rankIndex) => (
        JSON.stringify({
          resolveCost: definition.action.resolveCostByRank[rankIndex],
          cooldown: definition.action.cooldownByRank[rankIndex],
          effects: definition.effects.map(({ value }) => value.byRank[rankIndex]),
        })
      ));
      for (let rankIndex = 1; rankIndex < rankVectors.length; rankIndex += 1) {
        expect(rankVectors[rankIndex], `${definition.id}:rank-${rankIndex + 1}`)
          .not.toBe(rankVectors[rankIndex - 1]);
      }
    }
  });

  it("keeps every status reachable and every non-creating mutation backed by a producer", () => {
    const produced = new Set();
    const cleanseTargets = new Set();
    const statusMutations = [];

    for (const definition of TOW_ABILITY_CATALOG_V2_LIST) {
      for (const effect of definition.effects) {
        if (effect.primitive === "status") {
          if (effect.operation === "add") produced.add(effect.subject);
          else statusMutations.push({ abilityId: definition.id, subject: effect.subject });
        }
        if (effect.primitive === "cleanse") cleanseTargets.add(effect.subject);
      }
    }
    for (const zone of TOW_ABILITY_ZONE_LIST_V2) {
      if (zone.payload.primitive === "status" && zone.payload.operation === "add") {
        produced.add(zone.payload.subject);
      }
    }

    expect(new Set([...produced, ...cleanseTargets]))
      .toEqual(new Set(Object.keys(TOW_ABILITY_STATUSES_V2)));
    expect(statusMutations.filter(({ subject }) => !produced.has(subject))).toEqual([]);

    expect(getTowAbilityRulesV2("north-king-whirlwind").effects)
      .toEqual(expect.arrayContaining([expect.objectContaining({ subject: "delayed-lethargy" })]));
    expect(getTowAbilityRulesV2("north-king-warriors-oath").effects.map(({ subject }) => subject))
      .toEqual(expect.arrayContaining(["lethargy", "delayed-lethargy"]));
    expect(getTowAbilityRulesV2("blade-katana-dance").effects)
      .toEqual(expect.arrayContaining([expect.objectContaining({ subject: "blade-dance-parry" })]));
    expect(TOW_ABILITY_ZONES_V2["automaton-scorched-earth"].payload).toMatchObject({
      primitive: "status",
      operation: "add",
      subject: "limp",
      potency: { byRank: [8, 12] },
    });
  });

  it("does not create Resolve by paying a self-targetable resource action", () => {
    const resourceAbilities = TOW_ABILITY_CATALOG_V2_LIST.filter(({ effects }) => effects.some(
      ({ primitive, operation, subject }) => (
        primitive === "resource" && operation === "gain" && subject === "resolve"
      ),
    ));
    expect(resourceAbilities.map(({ id }) => id)).toEqual(["automaton-infinite-power"]);

    for (const definition of resourceAbilities) {
      expect(definition.targeting.includeCaster, definition.id).toBe(true);
      expect(["self", "ally"], definition.id).toContain(definition.targeting.side);
      expect(definition.targeting.area.shape, definition.id).toBe("single");
      for (let rankIndex = 0; rankIndex < definition.rankCount; rankIndex += 1) {
        const gained = definition.effects
          .filter(({ primitive, operation, subject }) => (
            primitive === "resource" && operation === "gain" && subject === "resolve"
          ))
          .reduce((total, { value }) => total + value.byRank[rankIndex], 0);
        expect(gained, `${definition.id}:rank-${rankIndex + 1}`)
          .toBeLessThanOrEqual(definition.action.resolveCostByRank[rankIndex]);
      }
    }
  });

  it("deep-freezes every public collection and detached authored definition", () => {
    for (const value of [
      TOW_DEFAULT_ABILITY_KITS_V2,
      TOW_ABILITY_NAMES_V2,
      TOW_ABILITY_ROLES_V2,
      TOW_ABILITY_STATUSES_V2,
      TOW_ABILITY_STATUS_LIST_V2,
      TOW_ABILITY_CATALOG_V2,
      TOW_ABILITY_CATALOG_V2_LIST,
      TOW_ABILITY_ZONES_V2,
      TOW_ABILITY_ZONE_LIST_V2,
    ]) assertDeeplyFrozen(value);

    expect(() => {
      TOW_DEFAULT_ABILITY_KITS_V2.knight[0] = "mutated";
    }).toThrow(TypeError);
    expect(() => {
      TOW_ABILITY_CATALOG_V2["arctic-strike"].effects[0].value.byRank[0] = 999;
    }).toThrow(TypeError);
    expect(getTowDefaultAbilityKitV2("knight")[0]).toBe("arctic-strike");
    expect(getTowAbilityRulesV2("arctic-strike").effects[0].value.byRank[0]).toBe(100);
  });

  it("keeps the committed semantic checksum stable", () => {
    expect(TOW_ABILITY_CATALOG_V2_CHECKSUM).toBe("fnv1a32:8a8adfc6");
    expect(calculateTowAbilityCatalogV2Checksum()).toBe(TOW_ABILITY_CATALOG_V2_CHECKSUM);
  });

  it("does not mutate or reinterpret v1 profiles and durable sessions", () => {
    const legacyProfileBefore = JSON.stringify(abilityProfile("arctic-block"));
    const opened = openLegacySession();
    expect(opened.ok).toBe(true);
    expect(isTowSession(opened.session)).toBe(true);
    expect(opened.session.rulesetId).toBe(TOW_RULESET_ID);
    expect(TOW_ABILITY_RULESET_V2_ID).not.toBe(TOW_RULESET_ID);
    const legacySessionBefore = JSON.stringify(opened.session);

    for (const definition of TOW_ABILITY_CATALOG_V2_LIST) {
      abilityRulesV2AtRank(definition, definition.rankCount);
    }

    expect(JSON.stringify(abilityProfile("arctic-block"))).toBe(legacyProfileBefore);
    expect(JSON.stringify(opened.session)).toBe(legacySessionBefore);
    expect(isTowSession(opened.session)).toBe(true);
    expect(() => abilityProfile("arctic-block", 1, {
      rulesetId: TOW_ABILITY_RULESET_V2_ID,
    })).toThrow(`unsupported-ability-ruleset:${TOW_ABILITY_RULESET_V2_ID}`);
  });
});
