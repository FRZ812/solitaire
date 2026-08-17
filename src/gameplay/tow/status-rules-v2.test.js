import { describe, expect, it } from "vitest";
import {
  TOW_ABILITY_RULESET_V2_ID,
  TOW_ABILITY_RULES_V2_VERSION,
  defineAbilityRulesV2,
  defineZoneRulesV2,
  defineZoneRulesV2Registry,
} from "./ability-rules-v2.js";
import {
  defineStatusRulesV2,
  defineStatusRulesV2Registry,
  defineStatusRuntimeResolversV2,
  isStatusRulesV2,
  isStatusRulesV2Registry,
  validateAbilityRuleReferencesV2,
  validateAbilityStatusReferencesV2,
  validateStatusRulesV2,
  validateZoneStatusReferencesV2,
} from "./status-rules-v2.js";

function status(overrides = {}) {
  return {
    version: TOW_ABILITY_RULES_V2_VERSION,
    rulesetId: TOW_ABILITY_RULESET_V2_ID,
    id: "challenged",
    provenance: "source-actor",
    duration: { clock: "recipient-turn-end", count: 1 },
    decay: { timing: "none", stacks: 0 },
    expiry: "duration-end",
    stacking: { policy: "replace", cap: 1 },
    polarity: "harmful",
    category: "targeting",
    behavior: "forced-target",
    ...overrides,
  };
}

function statusEffect(subject = "challenged", operation = "add") {
  return {
    primitive: "status",
    operation,
    recipient: "selected-units",
    scalesFrom: null,
    subject,
    motion: null,
    value: { unit: "stacks", basis: "none", byRank: [1] },
  };
}

function ability(effect = statusEffect()) {
  return defineAbilityRulesV2({
    version: TOW_ABILITY_RULES_V2_VERSION,
    rulesetId: TOW_ABILITY_RULESET_V2_ID,
    id: "knight-challenge",
    rankCount: 1,
    action: {
      lane: "quick",
      reactionWatch: null,
      reactionWindow: null,
      resolveCostByRank: [1],
      cooldownByRank: [1],
    },
    targeting: {
      side: "enemy",
      includeCaster: false,
      anchor: { shape: "occupied-cell", range: "ranged", tracking: "unit" },
      area: { shape: "single" },
    },
    presentation: { castMode: "field", tierByRank: ["ability"] },
    effects: [effect],
  });
}

function zone(subject = "challenged") {
  return defineZoneRulesV2({
    version: TOW_ABILITY_RULES_V2_VERSION,
    rulesetId: TOW_ABILITY_RULESET_V2_ID,
    id: "challenge-field",
    rankCount: 1,
    movementPolicy: "block-exit",
    timing: { trigger: "occupant-turn", tick: "start" },
    stacking: { policy: "refresh-duration", cap: null },
    payload: {
      primitive: "status",
      operation: "add",
      recipient: "enemy-occupants",
      scalesFrom: null,
      subject,
      potency: { unit: "stacks", basis: "none", byRank: [1] },
    },
  });
}

describe("Tower status rules v2", () => {
  it("pins forced-target provenance and complete lifecycle semantics", () => {
    const definition = defineStatusRulesV2(status());

    expect(isStatusRulesV2(definition)).toBe(true);
    expect(validateStatusRulesV2(definition)).toEqual({ ok: true, reason: null });
    expect(definition).toMatchObject({
      id: "challenged",
      provenance: "source-actor",
      duration: { clock: "recipient-turn-end", count: 1 },
      decay: { timing: "none", stacks: 0 },
      expiry: "duration-end",
      stacking: { policy: "replace", cap: 1 },
      polarity: "harmful",
      category: "targeting",
      behavior: "forced-target",
    });
    expect(Object.isFrozen(definition)).toBe(true);
    expect(Object.isFrozen(definition.duration)).toBe(true);
    expect(Object.isFrozen(definition.decay)).toBe(true);
    expect(Object.isFrozen(definition.stacking)).toBe(true);
  });

  it("builds an immutable registry and rejects unknown ability and zone subjects", () => {
    const statuses = defineStatusRulesV2Registry([status()]);
    const zones = defineZoneRulesV2Registry([zone()]);

    expect(isStatusRulesV2Registry(statuses)).toBe(true);
    expect(Object.isFrozen(statuses)).toBe(true);
    expect(validateAbilityStatusReferencesV2(ability(), statuses))
      .toEqual({ ok: true, reason: null });
    expect(validateZoneStatusReferencesV2(zones, statuses))
      .toEqual({ ok: true, reason: null });
    expect(validateAbilityRuleReferencesV2(ability(), { zones, statuses }))
      .toEqual({ ok: true, reason: null });

    const resolver = () => null;
    expect(defineStatusRuntimeResolversV2(statuses, { challenged: resolver }))
      .toEqual({ challenged: resolver });
    expect(() => defineStatusRuntimeResolversV2(statuses, {}))
      .toThrow("invalid-status-runtime-resolvers-v2");
    expect(() => defineStatusRuntimeResolversV2(statuses, { challenged: "infer-v1" }))
      .toThrow("invalid-status-runtime-resolvers-v2");

    expect(validateAbilityStatusReferencesV2(ability(statusEffect("unknown")), statuses))
      .toEqual({ ok: false, reason: "unknown-status-rules-v2-id" });
    expect(validateZoneStatusReferencesV2(
      defineZoneRulesV2Registry([zone("unknown")]),
      statuses,
    )).toEqual({ ok: false, reason: "unknown-status-rules-v2-id" });
  });

  it("fails closed on ambiguous lifecycle, stacking, and forced-target definitions", () => {
    const cases = [
      [status({ provenance: "target-name" }), "invalid-status-v2-provenance"],
      [status({ duration: { clock: "encounter", count: 1 } }), "invalid-status-v2-duration-count"],
      [status({ duration: { clock: "round-end", count: null } }), "invalid-status-v2-duration-count"],
      [status({ decay: { timing: "none", stacks: 1 } }), "invalid-status-v2-decay-stacks"],
      [status({ decay: { timing: "round-end", stacks: 1 } }), "incoherent-status-v2-decay"],
      [status({ expiry: "at-zero" }), "incoherent-status-v2-expiry"],
      [status({ stacking: { policy: "add", cap: null } }), "invalid-status-v2-stacking-cap"],
      [status({ behavior: "forced-target", provenance: "none" }), "incoherent-status-v2-forced-target"],
      [status({ behavior: "forced-target", polarity: "beneficial" }), "incoherent-status-v2-forced-target"],
      [status({ stacking: { policy: "unique-per-source", cap: 1 } }), "incoherent-status-v2-forced-target"],
      [{ ...status(), extra: true }, "invalid-status-rules-v2-shape"],
    ];

    for (const [candidate, reason] of cases) {
      expect(validateStatusRulesV2(candidate), reason).toEqual({ ok: false, reason });
      expect(isStatusRulesV2(candidate), reason).toBe(false);
      expect(() => defineStatusRulesV2(candidate), reason).toThrow(reason);
    }
    expect(() => defineStatusRulesV2Registry([status(), status()]))
      .toThrow("duplicate-status-rules-v2-id");
  });
});
