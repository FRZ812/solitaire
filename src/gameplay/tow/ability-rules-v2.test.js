import { describe, expect, it } from "vitest";
import { abilityProfile } from "./ability-profile.js";
import {
  ABILITY_V2_ACTION_LANES,
  ABILITY_V2_ANCHOR_RANGES,
  ABILITY_V2_AREA_SHAPES,
  ABILITY_V2_CAST_MODES,
  ABILITY_V2_EFFECT_PRIMITIVES,
  ABILITY_V2_EXECUTION_ORDER,
  ABILITY_V2_PRESENTATION_TIERS,
  ABILITY_V2_REACTION_WINDOW,
  ABILITY_V2_REACTION_WATCHES,
  ABILITY_V2_REACTION_WINDOWS,
  TOW_ABILITY_RULESET_V2_ID,
  TOW_ABILITY_RULES_V2_VERSION,
  abilityRulesV2AtRank,
  defineAbilityRulesV2,
  defineZoneRulesV2,
  defineZoneRulesV2Registry,
  isAbilityRulesV2,
  isZoneRulesV2,
  isZoneRulesV2Registry,
  validateAbilityRulesV2,
  validateAbilityZoneReferencesV2,
  validateZoneRulesV2,
  zoneRulesV2AtRank,
} from "./ability-rules-v2.js";
import { TOW_RULESET_ID } from "./ruleset.js";

function effect(primitive, recipient, byRank, overrides = {}) {
  const operation = {
    damage: "deal",
    heal: "restore",
    shield: "grant",
    status: "add",
    cleanse: "remove",
    resource: "gain",
    move: "move",
    push: "push",
    pull: "pull",
    zone: "create",
  }[primitive] || null;
  return {
    primitive,
    operation,
    recipient,
    scalesFrom: null,
    subject: null,
    motion: null,
    value: { unit: "flat", basis: "none", byRank },
    ...overrides,
  };
}

function rule(overrides = {}) {
  return {
    version: TOW_ABILITY_RULES_V2_VERSION,
    rulesetId: TOW_ABILITY_RULESET_V2_ID,
    id: "knight-driving-cut",
    rankCount: 3,
    action: {
      lane: "main",
      reactionWatch: null,
      reactionWindow: null,
      resolveCostByRank: [3, 2, 2],
      cooldownByRank: [1, 1, 0],
    },
    targeting: {
      side: "enemy",
      includeCaster: false,
      anchor: { shape: "occupied-cell", range: "melee", tracking: "unit" },
      area: { shape: "single" },
    },
    presentation: { castMode: "melee", tierByRank: ["ability", "ability", "mythical"] },
    effects: [
      effect("damage", "selected-units", [100, 120, 145], {
        scalesFrom: "caster",
        value: { unit: "percent", basis: "attack", byRank: [100, 120, 145] },
      }),
      effect("push", "selected-units", [1, 1, 2], {
        motion: "source-target-vector",
        value: { unit: "cells", basis: "none", byRank: [1, 1, 2] },
      }),
    ],
    ...overrides,
  };
}

function zone(overrides = {}) {
  return {
    version: TOW_ABILITY_RULES_V2_VERSION,
    rulesetId: TOW_ABILITY_RULESET_V2_ID,
    id: "burning-ground",
    rankCount: 3,
    movementPolicy: "none",
    timing: { trigger: "round", tick: "end" },
    stacking: { policy: "stack-potency", cap: 3 },
    payload: {
      primitive: "damage",
      operation: "deal",
      recipient: "enemy-occupants",
      scalesFrom: "caster",
      subject: null,
      potency: { unit: "percent", basis: "attack", byRank: [25, 35, 50] },
    },
    ...overrides,
  };
}

describe("opt-in Tower ability rules v2 schema", () => {
  it("pins the spatial, recipient, budget, and rank contract immutably", () => {
    const source = rule();
    const definition = defineAbilityRulesV2(source);

    expect(isAbilityRulesV2(definition)).toBe(true);
    expect(validateAbilityRulesV2(definition)).toEqual({ ok: true, reason: null });
    expect(definition).toMatchObject({
      version: 2,
      rulesetId: "solitaire-tow-v2",
      action: {
        lane: "main",
        reactionWatch: null,
        reactionWindow: null,
        resolveCostByRank: [3, 2, 2],
        cooldownByRank: [1, 1, 0],
      },
      targeting: {
        side: "enemy",
        includeCaster: false,
        anchor: { shape: "occupied-cell", range: "melee", tracking: "unit" },
        area: { shape: "single" },
      },
      presentation: {
        castMode: "melee",
        tierByRank: ["ability", "ability", "mythical"],
      },
      effects: [
        { primitive: "damage", operation: "deal", scalesFrom: "caster", recipient: "selected-units" },
        { primitive: "push", operation: "push", scalesFrom: null, recipient: "selected-units" },
      ],
    });
    expect(Object.isFrozen(definition)).toBe(true);
    expect(Object.isFrozen(definition.action.resolveCostByRank)).toBe(true);
    expect(Object.isFrozen(definition.targeting.anchor)).toBe(true);
    expect(Object.isFrozen(definition.presentation)).toBe(true);
    expect(Object.isFrozen(definition.presentation.tierByRank)).toBe(true);
    expect(Object.isFrozen(definition.effects[0].value.byRank)).toBe(true);

    source.action.resolveCostByRank[0] = 99;
    source.effects[0].value.byRank[0] = 999;
    expect(definition.action.resolveCostByRank[0]).toBe(3);
    expect(definition.effects[0].value.byRank[0]).toBe(100);
  });

  it("resolves rank-aware cost and effect magnitudes into a detached snapshot", () => {
    const resolved = abilityRulesV2AtRank(rule(), 3);

    expect(resolved).toMatchObject({
      rulesetId: TOW_ABILITY_RULESET_V2_ID,
      id: "knight-driving-cut",
      rank: 3,
      rankCount: 3,
      action: {
        lane: "main", reactionWatch: null, reactionWindow: null, resolveCost: 2, cooldown: 0,
      },
      presentation: { castMode: "melee", tier: "mythical" },
      effects: [
        { primitive: "damage", operation: "deal", scalesFrom: "caster", motion: null, value: { unit: "percent", basis: "attack", amount: 145 } },
        { primitive: "push", operation: "push", scalesFrom: null, motion: "source-target-vector", value: { unit: "cells", basis: "none", amount: 2 } },
      ],
    });
    expect(Object.isFrozen(resolved)).toBe(true);
    expect(Object.isFrozen(resolved.targeting)).toBe(true);
    expect(Object.isFrozen(resolved.effects)).toBe(true);
    expect(abilityRulesV2AtRank(rule(), 1).presentation.tier).toBe("ability");
    expect(() => abilityRulesV2AtRank(rule(), 0)).toThrow("invalid-ability-rules-v2-rank");
  });

  it("covers main, quick, and reaction lanes plus every 3x3 area shape", () => {
    expect(ABILITY_V2_ACTION_LANES).toEqual(["main", "quick", "reaction"]);
    expect(ABILITY_V2_CAST_MODES).toEqual(["melee", "projectile", "field", "support"]);
    expect(ABILITY_V2_PRESENTATION_TIERS).toEqual(["restrained", "ability", "mythical"]);
    expect(ABILITY_V2_ANCHOR_RANGES).toEqual([
      "self", "adjacent", "melee", "ranged", "global",
    ]);
    expect(ABILITY_V2_AREA_SHAPES).toEqual([
      "single", "row", "column", "cross-short", "cross-full", "all",
    ]);
    expect(ABILITY_V2_EXECUTION_ORDER).toEqual({
      selectedCells: "row-major",
      selectedUnits: "snapshot-at-commit",
      effects: "authored-effect-major",
      recipients: "row-major",
      substitution: "never",
    });
    expect(ABILITY_V2_REACTION_WINDOW).toBe("hostile-targeted-before-effects");
    for (const lane of ABILITY_V2_ACTION_LANES) {
      expect(isAbilityRulesV2(rule({
        action: {
          lane,
          reactionWatch: lane === "reaction" ? "selected-hostile-target" : null,
          reactionWindow: lane === "reaction" ? ABILITY_V2_REACTION_WINDOW : null,
          resolveCostByRank: [0, 0, 0],
          cooldownByRank: [0, 0, 0],
        },
        ...(lane === "reaction" ? {
          targeting: {
            side: "ally",
            includeCaster: true,
            anchor: { shape: "occupied-cell", range: "adjacent", tracking: "unit" },
            area: { shape: "single" },
          },
        } : {}),
      })))
        .toBe(true);
    }
    for (const shape of ABILITY_V2_AREA_SHAPES) {
      const candidate = rule({
        targeting: {
          ...rule().targeting,
          anchor: {
            shape: shape === "single" ? "occupied-cell" : "cell",
            range: "ranged",
            tracking: shape === "single" ? "unit" : "cell",
          },
          area: { shape },
        },
      });
      expect(isAbilityRulesV2(candidate), shape).toBe(true);
    }

    const cellPinnedOccupiedAnchor = rule({
      targeting: {
        ...rule().targeting,
        anchor: { shape: "occupied-cell", range: "adjacent", tracking: "cell" },
      },
    });
    expect(abilityRulesV2AtRank(cellPinnedOccupiedAnchor, 1).targeting.anchor)
      .toEqual({ shape: "occupied-cell", range: "adjacent", tracking: "cell" });
  });

  it("supports the complete pre-armed reaction window matrix, including ally protection", () => {
    expect(ABILITY_V2_REACTION_WINDOWS).toEqual([
      "hostile-targeted-before-effects",
      "hostile-targeted-after-effects",
      "hostile-main-before-effects",
      "hostile-melee-before-effects",
    ]);
    expect(ABILITY_V2_REACTION_WATCHES).toEqual([
      "selected-hostile-target", "selected-hostile-source",
    ]);
    for (const reactionWindow of ABILITY_V2_REACTION_WINDOWS.filter((window) => (
      window !== "hostile-main-before-effects"
    ))) {
      const protector = rule({
        id: `paladin-${reactionWindow}`,
        action: {
          lane: "reaction",
          reactionWatch: "selected-hostile-target",
          reactionWindow,
          resolveCostByRank: [1, 1, 1],
          cooldownByRank: [1, 1, 1],
        },
        targeting: {
          side: "ally",
          includeCaster: true,
          anchor: { shape: "occupied-cell", range: "adjacent", tracking: "unit" },
          area: { shape: "single" },
        },
        presentation: {
          castMode: "support",
          tierByRank: ["restrained", "ability", "ability"],
        },
        effects: [effect("shield", "selected-units", [12, 18, 25])],
      });
      expect(isAbilityRulesV2(protector), reactionWindow).toBe(true);
    }

    const suppressiveShot = rule({
      id: "ranger-suppressive-shot",
      action: {
        lane: "reaction",
        reactionWatch: "selected-hostile-source",
        reactionWindow: "hostile-main-before-effects",
        resolveCostByRank: [1, 1, 1],
        cooldownByRank: [1, 1, 1],
      },
      targeting: {
        side: "enemy",
        includeCaster: false,
        anchor: { shape: "occupied-cell", range: "ranged", tracking: "unit" },
        area: { shape: "single" },
      },
    });
    expect(isAbilityRulesV2(suppressiveShot)).toBe(true);
    expect(abilityRulesV2AtRank(suppressiveShot, 1).action.reactionWatch)
      .toBe("selected-hostile-source");
  });

  it("models allied support and self-centred effects without ambiguous recipients", () => {
    const allyHeal = rule({
      id: "paladin-restoring-light",
      targeting: {
        side: "ally",
        includeCaster: true,
        anchor: { shape: "occupied-cell", range: "ranged", tracking: "unit" },
        area: { shape: "cross-short" },
      },
      effects: [effect("heal", "selected-units", [10, 14, 18], {
        scalesFrom: "recipient",
        value: { unit: "percent", basis: "max-hp", byRank: [10, 14, 18] },
      })],
    });
    const selfWard = rule({
      id: "knight-braced-guard",
      targeting: {
        side: "self",
        includeCaster: true,
        anchor: { shape: "caster", range: "self", tracking: "unit" },
        area: { shape: "single" },
      },
      effects: [effect("shield", "caster", [20, 30, 40])],
    });

    expect(isAbilityRulesV2(allyHeal)).toBe(true);
    expect(isAbilityRulesV2(selfWard)).toBe(true);
    expect(defineAbilityRulesV2(allyHeal).targeting.side).toBe("ally");
  });

  it("pins effect operations and the owner of every scaling stat", () => {
    const effects = [
      effect("damage", "selected-units", [90, 110, 130], {
        scalesFrom: "recipient",
        value: { unit: "percent", basis: "defense", byRank: [90, 110, 130] },
      }),
      effect("status", "selected-units", [12, 18, 24], {
        operation: "add",
        scalesFrom: "caster",
        subject: "vulnerable",
        value: { unit: "percent", basis: "attack", byRank: [12, 18, 24] },
      }),
      effect("status", "selected-units", [80, 70, 60], {
        operation: "scale",
        subject: "guard",
        value: { unit: "percent", basis: "none", byRank: [80, 70, 60] },
      }),
      effect("status", "selected-units", [1, 2, 3], {
        operation: "subtract",
        subject: "burn",
        value: { unit: "stacks", basis: "none", byRank: [1, 2, 3] },
      }),
      effect("resource", "caster", [1, 2, 3], {
        operation: "gain",
        subject: "resolve",
      }),
      effect("resource", "selected-units", [1, 1, 2], {
        operation: "drain",
        subject: "resolve",
      }),
      effect("cleanse", "selected-units", [40, 40, 40], {
        operation: "retain-percent",
        subject: "burn",
        value: { unit: "percent", basis: "none", byRank: [40, 40, 40] },
      }),
      effect("cleanse", "selected-units", [2, 3, 4], {
        operation: "subtract",
        subject: "poison",
        value: { unit: "stacks", basis: "none", byRank: [2, 3, 4] },
      }),
      effect("cleanse", "selected-units", [0, 0, 0], {
        operation: "clear",
        subject: "lethargy",
      }),
    ];
    const definition = defineAbilityRulesV2(rule({ effects }));

    expect(definition.effects.map(({ primitive, operation, scalesFrom, value }) => ({
      primitive, operation, scalesFrom, basis: value.basis,
    }))).toEqual([
      { primitive: "damage", operation: "deal", scalesFrom: "recipient", basis: "defense" },
      { primitive: "status", operation: "add", scalesFrom: "caster", basis: "attack" },
      { primitive: "status", operation: "scale", scalesFrom: null, basis: "none" },
      { primitive: "status", operation: "subtract", scalesFrom: null, basis: "none" },
      { primitive: "resource", operation: "gain", scalesFrom: null, basis: "none" },
      { primitive: "resource", operation: "drain", scalesFrom: null, basis: "none" },
      { primitive: "cleanse", operation: "retain-percent", scalesFrom: null, basis: "none" },
      { primitive: "cleanse", operation: "subtract", scalesFrom: null, basis: "none" },
      { primitive: "cleanse", operation: "clear", scalesFrom: null, basis: "none" },
    ]);
  });

  it("provides explicit move, push, pull, and cell-zone primitives", () => {
    expect(ABILITY_V2_EFFECT_PRIMITIVES).toEqual(expect.arrayContaining([
      "move", "push", "pull", "zone",
    ]));
    const primitives = [
      effect("move", "caster", [1, 1, 2], {
        motion: "to-anchor",
        value: { unit: "cells", basis: "none", byRank: [1, 1, 2] },
      }),
      effect("move", "caster", [1, 2, 2], {
        motion: "nearest-empty-same-row",
        value: { unit: "cells", basis: "none", byRank: [1, 2, 2] },
      }),
      effect("push", "selected-units", [1, 1, 2], {
        motion: "source-target-vector",
        value: { unit: "cells", basis: "none", byRank: [1, 1, 2] },
      }),
      effect("pull", "selected-units", [1, 2, 2], {
        motion: "source-target-vector",
        value: { unit: "cells", basis: "none", byRank: [1, 2, 2] },
      }),
      effect("zone", "selected-cells", [1, 2, 3], {
        subject: "burning-ground",
        value: { unit: "rounds", basis: "none", byRank: [1, 2, 3] },
      }),
    ];

    for (const candidate of primitives) {
      expect(isAbilityRulesV2(rule({ effects: [candidate] })), candidate.primitive).toBe(true);
    }
  });

  it("pins executable zone timing, stacking, recipients, and ranked potency", () => {
    const definition = defineZoneRulesV2(zone());
    const registry = defineZoneRulesV2Registry([definition]);
    const zoneAbility = rule({
      id: "wizard-burning-ground",
      targeting: {
        side: "enemy",
        includeCaster: false,
        anchor: { shape: "cell", range: "ranged", tracking: "cell" },
        area: { shape: "cross-short" },
      },
      presentation: { castMode: "field", tierByRank: ["ability", "ability", "mythical"] },
      effects: [effect("zone", "selected-cells", [2, 2, 3], {
        subject: "burning-ground",
        value: { unit: "rounds", basis: "none", byRank: [2, 2, 3] },
      })],
    });

    expect(isZoneRulesV2(definition)).toBe(true);
    expect(isZoneRulesV2Registry(registry)).toBe(true);
    expect(validateZoneRulesV2(definition)).toEqual({ ok: true, reason: null });
    expect(validateAbilityZoneReferencesV2(zoneAbility, registry))
      .toEqual({ ok: true, reason: null });
    expect(registry[zoneAbility.effects[0].subject]).toEqual(definition);
    expect(Object.isFrozen(definition.payload.potency.byRank)).toBe(true);
    expect(Object.isFrozen(registry)).toBe(true);
    expect(zoneRulesV2AtRank(definition, 3)).toMatchObject({
      id: "burning-ground",
      rank: 3,
      movementPolicy: "none",
      timing: { trigger: "round", tick: "end" },
      stacking: { policy: "stack-potency", cap: 3 },
      payload: {
        primitive: "damage",
        operation: "deal",
        recipient: "enemy-occupants",
        scalesFrom: "caster",
        potency: { unit: "percent", basis: "attack", amount: 50 },
      },
    });
  });

  it("fails closed on ambiguous zones and missing registry references", () => {
    const missingMovementPolicy = zone();
    delete missingMovementPolicy.movementPolicy;
    const malformed = [
      [missingMovementPolicy, "invalid-zone-rules-v2-shape"],
      [zone({ movementPolicy: "slow-entry" }), "invalid-zone-v2-movement-policy"],
      [zone({ timing: { trigger: "enter", tick: "start" } }), "incoherent-zone-v2-timing"],
      [zone({ stacking: { policy: "stack-potency", cap: null } }), "invalid-zone-v2-stacking-cap"],
      [zone({ stacking: { policy: "replace", cap: 2 } }), "invalid-zone-v2-stacking-cap"],
      [zone({ payload: { ...zone().payload, primitive: "zone" } }), "invalid-zone-v2-payload-primitive"],
      [zone({ payload: { ...zone().payload, operation: "restore" } }), "invalid-zone-v2-payload-operation"],
      [zone({ payload: { ...zone().payload, scalesFrom: "owner" } }), "invalid-zone-v2-scale-source"],
      [zone({ payload: { ...zone().payload, scalesFrom: null } }), "incoherent-zone-v2-scaling"],
      [zone({ payload: {
        ...zone().payload,
        scalesFrom: "caster",
        potency: { unit: "flat", basis: "none", byRank: [1, 1, 1] },
      } }), "incoherent-zone-v2-scaling"],
      [zone({ payload: {
        ...zone().payload,
        potency: { unit: "cells", basis: "none", byRank: [1, 1, 1] },
      } }), "invalid-zone-v2-potency"],
      [{ ...zone(), extra: true }, "invalid-zone-rules-v2-shape"],
    ];

    for (const [candidate, reason] of malformed) {
      expect(validateZoneRulesV2(candidate), reason).toEqual({ ok: false, reason });
      expect(isZoneRulesV2(candidate), reason).toBe(false);
      expect(() => defineZoneRulesV2(candidate), reason).toThrow(reason);
    }
    expect(() => defineZoneRulesV2Registry([zone(), zone()]))
      .toThrow("duplicate-zone-rules-v2-id");

    const zoneAbility = rule({
      effects: [effect("zone", "selected-cells", [1, 1, 1], {
        subject: "missing-zone",
        value: { unit: "rounds", basis: "none", byRank: [1, 1, 1] },
      })],
    });
    expect(validateAbilityZoneReferencesV2(zoneAbility, defineZoneRulesV2Registry([zone()])))
      .toEqual({ ok: false, reason: "unknown-zone-rules-v2-id" });
    expect(validateAbilityZoneReferencesV2(zoneAbility, {}))
      .toEqual({ ok: false, reason: "unknown-zone-rules-v2-id" });
    const mismatched = defineZoneRulesV2Registry([zone({ rankCount: 2, payload: {
      ...zone().payload,
      potency: { ...zone().payload.potency, byRank: [25, 35] },
    } })]);
    expect(validateAbilityZoneReferencesV2(
      { ...zoneAbility, effects: [{ ...zoneAbility.effects[0], subject: "burning-ground" }] },
      mismatched,
    )).toEqual({ ok: false, reason: "zone-rules-v2-rank-count-mismatch" });
  });

  it("fails closed on malformed or incoherent authored definitions", () => {
    const missingPresentation = rule();
    delete missingPresentation.presentation;
    const missingMotion = rule();
    delete missingMotion.effects[0].motion;
    const missingOperation = rule();
    delete missingOperation.effects[0].operation;
    const missingScaleSource = rule();
    delete missingScaleSource.effects[0].scalesFrom;
    const cases = [
      [missingPresentation, "invalid-ability-rules-v2-shape"],
      [missingMotion, "invalid-v2-effect-shape"],
      [missingOperation, "invalid-v2-effect-shape"],
      [missingScaleSource, "invalid-v2-effect-shape"],
      [rule({ rulesetId: TOW_RULESET_ID }), "invalid-ability-rules-v2-id"],
      [rule({ version: 1 }), "invalid-ability-rules-v2-version"],
      [rule({ rankCount: 7 }), "invalid-ability-rules-v2-rank-count"],
      [rule({ action: {
        lane: "bonus", reactionWatch: null, reactionWindow: null, resolveCostByRank: [1, 1, 1], cooldownByRank: [0, 0, 0],
      } }), "invalid-v2-action-lane"],
      [rule({ action: {
        lane: "main", reactionWatch: null, reactionWindow: null, resolveCostByRank: [1, 1], cooldownByRank: [0, 0, 0],
      } }), "invalid-v2-action-rank-values"],
      [rule({ action: {
        lane: "main", reactionWatch: null, reactionWindow: null, resolveCostByRank: [1, 1, 1], cooldownByRank: [0, 0],
      } }), "invalid-v2-action-cooldowns"],
      [rule({ action: {
        lane: "reaction", reactionWatch: "selected-hostile-target", reactionWindow: null, resolveCostByRank: [1, 1, 1], cooldownByRank: [0, 0, 0],
      } }), "invalid-v2-reaction-window"],
      [rule({ action: {
        lane: "reaction", reactionWatch: "selected-hostile-target", reactionWindow: "ally-hit", resolveCostByRank: [1, 1, 1], cooldownByRank: [0, 0, 0],
      } }), "invalid-v2-reaction-window"],
      [rule({ action: {
        lane: "quick", reactionWatch: "selected-hostile-target", reactionWindow: ABILITY_V2_REACTION_WINDOW, resolveCostByRank: [1, 1, 1], cooldownByRank: [0, 0, 0],
      } }), "invalid-v2-nonreaction-window"],
      [rule({ action: {
        lane: "reaction", reactionWatch: "nearest-hostile", reactionWindow: ABILITY_V2_REACTION_WINDOW, resolveCostByRank: [1, 1, 1], cooldownByRank: [0, 0, 0],
      } }), "invalid-v2-reaction-watch"],
      [rule({ action: {
        lane: "reaction", reactionWatch: "selected-hostile-source", reactionWindow: ABILITY_V2_REACTION_WINDOW, resolveCostByRank: [1, 1, 1], cooldownByRank: [0, 0, 0],
      } }), "incoherent-v2-reaction-watch"],
      [rule({ action: {
        lane: "reaction", reactionWatch: "selected-hostile-target", reactionWindow: ABILITY_V2_REACTION_WINDOW, resolveCostByRank: [1, 1, 1], cooldownByRank: [0, 0, 0],
      } }), "incoherent-v2-reaction-targeting"],
      [rule({ presentation: { castMode: "beam", tierByRank: ["ability", "ability", "mythical"] } }), "invalid-v2-cast-mode"],
      [rule({ presentation: { castMode: "field", tierByRank: ["ability", "ultimate", "mythical"] } }), "invalid-v2-presentation-tier"],
      [rule({ presentation: { castMode: "field", tierByRank: ["ability", "mythical"] } }), "invalid-v2-presentation-tier"],
      [rule({ presentation: { castMode: "field", tierByRank: ["ability", "ability", "mythical"], extra: true } }), "invalid-v2-presentation-shape"],
      [rule({ targeting: { ...rule().targeting, side: "either" } }), "invalid-v2-target-side"],
      [rule({ targeting: {
        ...rule().targeting,
        anchor: { shape: "occupied-cell", range: "melee", tracking: "position" },
      } }), "invalid-v2-anchor-tracking"],
      [rule({ targeting: {
        ...rule().targeting,
        anchor: { shape: "cell", range: "ranged", tracking: "unit" },
      } }), "incoherent-v2-anchor-tracking"],
      [rule({ targeting: { ...rule().targeting, includeCaster: true } }), "incoherent-v2-enemy-targeting"],
      [rule({
        targeting: {
          side: "self",
          includeCaster: true,
          anchor: { shape: "cell", range: "ranged", tracking: "cell" },
          area: { shape: "single" },
        },
      }), "incoherent-v2-self-targeting"],
      [rule({ effects: [effect("teleport", "caster", [1, 1, 1])] }), "invalid-v2-effect-primitive"],
      [rule({ effects: [effect("damage", "selected-units", [1, 1, 1], {
        operation: "restore",
      })] }), "invalid-v2-effect-operation"],
      [rule({ effects: [effect("damage", "selected-units", [1, 1, 1], {
        scalesFrom: "owner",
      })] }), "invalid-v2-effect-scale-source"],
      [rule({ effects: [effect("damage", "selected-units", [1, 1, 1], {
        value: { unit: "percent", basis: "attack", byRank: [1, 1, 1] },
      })] }), "incoherent-v2-effect-scaling"],
      [rule({ effects: [effect("damage", "selected-units", [1, 1, 1], {
        scalesFrom: "caster",
      })] }), "incoherent-v2-effect-scaling"],
      [rule({ effects: [effect("status", "selected-units", [1, 1, 1], {
        operation: "scale",
        subject: "guard",
        value: { unit: "stacks", basis: "none", byRank: [1, 1, 1] },
      })] }), "invalid-v2-status-operation"],
      [rule({ effects: [effect("resource", "caster", [1, 1, 1], {
        operation: "add",
        subject: "resolve",
      })] }), "invalid-v2-effect-operation"],
      [rule({ effects: [effect("resource", "caster", [1, 1, 1], {
        operation: "gain",
        subject: "resovle",
      })] }), "unknown-v2-resource-id"],
      [rule({ effects: [effect("cleanse", "selected-units", [100, 100, 100], {
        operation: "remove",
        subject: "burn",
        value: { unit: "percent", basis: "none", byRank: [100, 100, 100] },
      })] }), "invalid-v2-effect-operation"],
      [rule({ effects: [effect("cleanse", "selected-units", [100, 100, 100], {
        operation: "clear",
        subject: "burn",
      })] }), "invalid-v2-status-operation"],
      [rule({ effects: [effect("cleanse", "selected-units", [140, 140, 140], {
        operation: "retain-percent",
        subject: "burn",
        value: { unit: "percent", basis: "none", byRank: [140, 140, 140] },
      })] }), "invalid-v2-status-operation"],
      [rule({ effects: [effect("push", "caster", [1, 1, 1], {
        motion: "source-target-vector",
        value: { unit: "cells", basis: "none", byRank: [1, 1, 1] },
      })] }), "invalid-v2-movement-recipient"],
      [rule({ effects: [effect("move", "caster", [1, 1, 1], {
        value: { unit: "cells", basis: "none", byRank: [1, 1, 1] },
      })] }), "invalid-v2-movement-motion"],
      [rule({ effects: [effect("pull", "selected-units", [1, 1, 1], {
        motion: "toward-anchor",
        value: { unit: "cells", basis: "none", byRank: [1, 1, 1] },
      })] }), "invalid-v2-movement-motion"],
      [rule({ effects: [effect("damage", "selected-units", [1, 1, 1], {
        motion: "toward-anchor",
      })] }), "invalid-v2-nonmovement-motion"],
      [rule({ effects: [effect("move", "caster", [1, 1, 1], {
        motion: "teleport-anywhere",
        value: { unit: "cells", basis: "none", byRank: [1, 1, 1] },
      })] }), "invalid-v2-effect-motion"],
      [rule({ effects: [effect("zone", "selected-units", [1, 1, 1], {
        subject: "ice-field",
        value: { unit: "rounds", basis: "none", byRank: [1, 1, 1] },
      })] }), "invalid-v2-zone-effect"],
      [rule({ effects: [effect("zone", "selected-cells", [0, 1, 1], {
        subject: "ice-field",
        value: { unit: "rounds", basis: "none", byRank: [0, 1, 1] },
      })] }), "invalid-v2-effect-rank-values"],
    ];

    for (const [candidate, reason] of cases) {
      expect(validateAbilityRulesV2(candidate), reason).toEqual({ ok: false, reason });
      expect(isAbilityRulesV2(candidate), reason).toBe(false);
      expect(() => defineAbilityRulesV2(candidate), reason).toThrow(reason);
    }
  });

  it("does not reinterpret or silently route the v1 replay profile", () => {
    expect(TOW_RULESET_ID).toBe("solitaire-tow-v1");
    expect(TOW_ABILITY_RULESET_V2_ID).not.toBe(TOW_RULESET_ID);
    expect(abilityProfile("arctic-strike").rulesetId).toBe(TOW_RULESET_ID);
    expect(() => abilityProfile("arctic-strike", 1, {
      rulesetId: TOW_ABILITY_RULESET_V2_ID,
    })).toThrow(`unsupported-ability-ruleset:${TOW_ABILITY_RULESET_V2_ID}`);
    expect(isAbilityRulesV2(abilityProfile("arctic-strike"))).toBe(false);
  });
});
