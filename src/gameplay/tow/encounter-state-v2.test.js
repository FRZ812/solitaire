import { describe, expect, it } from "vitest";
import {
  armTowReactionV2,
  beginTowActionRoundV2,
  beginTowActorTurnV2,
} from "./action-economy-v2.js";
import { abilityRulesV2AtRank } from "./ability-rules-v2.js";
import { getTowAbilityRulesV2 } from "./ability-catalog-v2.js";
import { createTowActorV2 } from "./actor-v2.js";
import { TOW_AI_POLICY_REGISTRY_V2_CHECKSUM } from "./ai-v2.js";
import {
  PINNED_TOW_ABILITY_CATALOG_V2_CHECKSUM,
  TOW_ENCOUNTER_POLICY_V2,
  TOW_ENCOUNTER_POLICY_V2_ID,
  createTowEncounterGenesisV2,
  defineTowEncounterStateV2,
  isTowEncounterStateV2,
  validateTowEncounterStateV2,
} from "./encounter-state-v2.js";
import { lockAbilityTargetV2 } from "./targeting-v2.js";
import { placeTowZoneV2 } from "./zones-v2.js";

function actor({
  id,
  name,
  side,
  preferredRow = 0,
  controller = side === "enemy" ? "ai" : "human",
  aiProfile = controller === "ai" ? { id: "knight", version: 1 } : null,
  hp = 100,
  loadout = [
    { id: "arctic-strike", rank: 1 },
    { id: "arctic-block", rank: 1 },
  ],
} = {}) {
  const created = createTowActorV2({
    id,
    name,
    side,
    controller,
    aiProfile,
    preferredRow,
    hp,
    maxHp: 100,
    shield: 0,
    stats: {
      attack: 20,
      defense: 15,
      speed: 10,
      critChanceBps: 500,
      dodgeChanceBps: 250,
    },
    loadout,
  });
  if (!created.ok) throw new TypeError(created.reason);
  return created.actor;
}

function genesisInput(overrides = {}) {
  const actors = [
    actor({
      id: "p:ranger",
      name: "Mira",
      side: "player",
      loadout: [
        { id: "demon-shoot", rank: 2 },
        { id: "demon-evasion", rank: 1 },
      ],
    }),
    actor({ id: "p:knight", name: "Alden", side: "player" }),
    actor({ id: "e:guard", name: "Iron Guard", side: "enemy" }),
  ];
  return {
    aiPolicyChecksum: TOW_AI_POLICY_REGISTRY_V2_CHECKSUM,
    catalogChecksum: PINNED_TOW_ABILITY_CATALOG_V2_CHECKSUM,
    policyId: TOW_ENCOUNTER_POLICY_V2_ID,
    rosters: {
      player: ["p:ranger", "p:knight"],
      enemy: ["e:guard"],
    },
    actors,
    resolveSeeds: [
      { id: "e:guard", resolve: 3, maxResolve: 5 },
      { id: "p:knight", resolve: 4, maxResolve: 6 },
      { id: "p:ranger", resolve: 4, maxResolve: 6 },
    ],
    ...overrides,
  };
}

function genesis(overrides = {}) {
  const created = createTowEncounterGenesisV2(genesisInput(overrides));
  if (!created.ok) throw new TypeError(created.reason);
  return created.state;
}

describe("v2 encounter genesis", () => {
  it("composes one canonical, deeply frozen state from explicit v2 authorities", () => {
    const input = structuredClone(genesisInput());
    const created = createTowEncounterGenesisV2(input);

    expect(created.ok).toBe(true);
    expect(created.state).toMatchObject({
      version: 2,
      rulesetId: "solitaire-tow-v2",
      aiPolicyChecksum: "fnv1a32:9bcc646d",
      catalogChecksum: "fnv1a32:8a8adfc6",
      policy: TOW_ENCOUNTER_POLICY_V2,
      rosters: input.rosters,
      formations: {
        version: 2,
        player: ["p:ranger", "p:knight", null, null, null, null, null, null, null],
        enemy: ["e:guard", null, null, null, null, null, null, null, null],
      },
      scheduler: {
        version: 1,
        round: 0,
        order: [],
        cursor: 0,
        priorityActorIds: [],
        skippedActorIds: [],
        turnBase: 0,
      },
      reactionLocks: {},
      intents: {},
      intentSequence: 0,
    });
    expect(Object.keys(created.state.actors)).toEqual([
      "e:guard", "p:knight", "p:ranger",
    ]);
    expect(Object.keys(created.state.economy.actors)).toEqual(Object.keys(created.state.actors));
    expect(Object.keys(created.state.statuses.actors)).toEqual(Object.keys(created.state.actors));
    expect(created.state.zones.zones).toEqual([]);
    expect(created.state.economy.actors["p:knight"].abilityRanks).toEqual({
      "arctic-block": 1,
      "arctic-strike": 1,
    });
    expect(created.state.economy.actors["p:knight"].resolve).toBe(4);
    expect(Object.isFrozen(created.state)).toBe(true);
    expect(created.state.policy.damage.policyChecksum).toBe("fnv1a32:f41dd5bb");
    expect(created.state.policy.execution).toMatchObject({
      version: 2,
      rulesetId: "solitaire-tow-v2",
      reducerVersion: 1,
      transactionFailure: "no-state-change",
      reactions: {
        arm: "atomic-economy-target-lock-and-monotonic-sequence",
        nested: "never",
        unusedExpiry: "owner-priority-open-only",
      },
    });
    expect(Object.isFrozen(created.state.policy.statuses.behaviorPolicy)).toBe(true);
    expect(Object.isFrozen(created.state.statuses.actors["p:knight"])).toBe(true);

    input.rosters.player.reverse();
    input.actors[0].loadout[0].rank = 6;
    expect(created.state.rosters.player).toEqual(["p:ranger", "p:knight"]);
    expect(created.state.actors["p:ranger"].loadout[0].rank).toBe(1);
  });

  it("uses roster order, preferred rows, nearest-row fallback, and lower-row ties", () => {
    const players = [
      actor({ id: "p:0", name: "Zero", side: "player", preferredRow: 0 }),
      actor({ id: "p:1", name: "One", side: "player", preferredRow: 0 }),
      actor({ id: "p:2", name: "Two", side: "player", preferredRow: 0 }),
      actor({ id: "p:3", name: "Three", side: "player", preferredRow: 0 }),
      actor({ id: "p:rear", name: "Rear", side: "player", preferredRow: 2 }),
    ];
    const enemy = actor({ id: "e:0", name: "Enemy", side: "enemy", preferredRow: 2 });
    const state = genesis({
      actors: [...players].reverse().concat(enemy),
      rosters: {
        player: ["p:0", "p:1", "p:2", "p:3", "p:rear"],
        enemy: ["e:0"],
      },
      resolveSeeds: [...players, enemy].map(({ id }) => ({
        id,
        resolve: 0,
        maxResolve: 0,
      })),
    });

    expect(state.formations.player).toEqual([
      "p:0", "p:1", "p:2",
      "p:3", null, null,
      "p:rear", null, null,
    ]);
    expect(state.formations.enemy[6]).toBe("e:0");
  });

  it("defines a detached frozen state after validating decoded data", () => {
    const initial = genesis();
    const decoded = structuredClone(initial);
    const defined = defineTowEncounterStateV2(decoded);

    expect(defined).toEqual(initial);
    expect(defined).not.toBe(decoded);
    expect(defined.actors).not.toBe(decoded.actors);
    expect(Object.isFrozen(defined)).toBe(true);
    decoded.actors["p:knight"].hp = 1;
    expect(defined.actors["p:knight"].hp).toBe(100);
  });

  it.each([
    ["legacy field", (value) => ({ ...value, build: { skills: ["strike"] } }),
      "invalid-encounter-genesis-v2-input"],
    ["stale catalogue", (value) => ({ ...value, catalogChecksum: "fnv1a32:deadbeef" }),
      "invalid-encounter-genesis-v2-catalog-checksum"],
    ["stale AI policy", (value) => ({ ...value, aiPolicyChecksum: "fnv1a32:deadbeef" }),
      "invalid-encounter-genesis-v2-ai-policy-checksum"],
    ["unknown policy", (value) => ({ ...value, policyId: "solitaire-tow-v2-experimental" }),
      "invalid-encounter-genesis-v2-policy"],
    ["duplicate roster", (value) => ({
      ...value,
      rosters: { ...value.rosters, player: ["p:ranger", "p:ranger"] },
    }), "invalid-encounter-v2-rosters"],
    ["actor omitted from roster", (value) => ({
      ...value,
      rosters: { ...value.rosters, player: ["p:ranger"] },
    }), "invalid-encounter-genesis-v2-actors"],
    ["creation input instead of snapshot", (value) => ({
      ...value,
      actors: value.actors.map((entry, index) => index === 0
        ? { ...entry, version: undefined }
        : entry),
    }), "invalid-encounter-genesis-v2-actors"],
    ["missing Resolve seed", (value) => ({
      ...value,
      resolveSeeds: value.resolveSeeds.slice(1),
    }), "invalid-encounter-genesis-v2-resolve-seeds"],
    ["Resolve over cap", (value) => ({
      ...value,
      resolveSeeds: value.resolveSeeds.map((seed, index) => index === 0
        ? { ...seed, resolve: seed.maxResolve + 1 }
        : seed),
    }), "invalid-encounter-genesis-v2-resolve-seeds"],
    ["defeated participant", (value) => ({
      ...value,
      actors: value.actors.map((entry, index) => index === 0
        ? { ...entry, hp: 0 }
        : entry),
    }), "invalid-encounter-genesis-v2-defeated-actor"],
  ])("rejects %s at genesis", (_label, mutate, reason) => {
    expect(createTowEncounterGenesisV2(mutate(genesisInput())))
      .toEqual({ ok: false, reason, state: null });
  });
});

describe("v2 encounter state invariants", () => {
  it("persists only canonical AI-owned rank and policy pinned target locks", () => {
    const state = genesis();
    const ability = abilityRulesV2AtRank(getTowAbilityRulesV2("arctic-strike"), 1);
    const locked = lockAbilityTargetV2(state, ability, "e:guard", "p:ranger");
    expect(locked.ok).toBe(true);
    const intent = {
      abilityId: "arctic-strike",
      rank: 1,
      targetLock: locked.lock,
      declaredSequence: 1,
      policyId: "knight-v1",
    };
    const persisted = defineTowEncounterStateV2({
      ...state,
      intents: { "e:guard": intent },
      intentSequence: 1,
    });
    expect(validateTowEncounterStateV2(persisted)).toEqual({ ok: true, reason: null });
    expect(persisted.intents["e:guard"]).toEqual(intent);
    expect(Object.isFrozen(persisted.intents["e:guard"].targetLock)).toBe(true);

    for (const mutate of [
      (value) => { value.intentSequence = 0; },
      (value) => { value.intents["e:guard"].policyId = "ranger-v1"; },
      (value) => { value.intents["e:guard"].rank = 2; },
      (value) => {
        value.intents = { "p:ranger": { ...value.intents["e:guard"] } };
      },
    ]) {
      const changed = structuredClone(persisted);
      mutate(changed);
      expect(validateTowEncounterStateV2(changed)).toEqual({
        ok: false,
        reason: "encounter-v2-intent-authority-mismatch",
      });
    }
    expect(validateTowEncounterStateV2({
      ...structuredClone(state),
      intents: { "z:last": intent, "a:first": intent },
      intentSequence: 1,
    })).toEqual({ ok: false, reason: "invalid-encounter-v2-intents" });
  });

  it("pins exact state, ruleset, catalogue, and complete policy identity", () => {
    const state = genesis();
    expect(validateTowEncounterStateV2(state)).toEqual({ ok: true, reason: null });
    expect(isTowEncounterStateV2(state)).toBe(true);

    for (const [mutate, reason] of [
      [(value) => ({ ...value, legacy: true }), "invalid-encounter-state-v2-shape"],
      [(value) => ({ ...value, version: 1 }), "invalid-encounter-state-v2-ruleset"],
      [(value) => ({ ...value, rulesetId: "solitaire-tow-v1" }),
        "invalid-encounter-state-v2-ruleset"],
      [(value) => ({ ...value, catalogChecksum: "fnv1a32:00000000" }),
        "invalid-encounter-state-v2-catalog-checksum"],
      [(value) => ({ ...value, aiPolicyChecksum: "fnv1a32:00000000" }),
        "invalid-encounter-state-v2-ai-policy-checksum"],
      [(value) => ({
        ...value,
        policy: {
          ...value.policy,
          formation: { ...value.policy.formation, occupantIdentity: "best-effort" },
        },
      }), "invalid-encounter-state-v2-policy"],
      [(value) => ({
        ...value,
        scheduler: { ...value.scheduler, cursor: 1 },
      }), "invalid-encounter-v2-scheduler"],
      [(value) => ({
        ...value,
        policy: {
          ...value.policy,
          execution: { ...value.policy.execution, transactionFailure: "partial-commit" },
        },
      }), "invalid-encounter-state-v2-policy"],
    ]) {
      expect(validateTowEncounterStateV2(mutate(structuredClone(state))))
        .toEqual({ ok: false, reason });
    }
  });

  it("requires exact roster, actor, formation, economy, and status identities", () => {
    const state = genesis();
    const cases = [
      [(value) => { delete value.actors["p:ranger"]; },
        "encounter-v2-actor-roster-mismatch"],
      [(value) => { value.actors["p:knight"].side = "enemy"; },
        "encounter-v2-actor-side-mismatch"],
      [(value) => { value.formations.player[0] = null; },
        "encounter-v2-formation-roster-mismatch"],
      [(value) => { value.formations.player[0] = "p:knight"; },
        "encounter-v2-formation-roster-mismatch"],
      [(value) => { value.formations.version = 1; },
        "invalid-encounter-v2-formations"],
      [(value) => { value.economy.actors["p:knight"].abilityRanks["arctic-strike"] = 2; },
        "encounter-v2-economy-loadout-mismatch"],
      [(value) => { delete value.economy.actors["p:ranger"]; },
        "encounter-v2-economy-actor-mismatch"],
      [(value) => { delete value.statuses.actors["p:ranger"]; },
        "encounter-v2-status-actor-mismatch"],
    ];

    for (const [mutate, reason] of cases) {
      const changed = structuredClone(state);
      mutate(changed);
      expect(validateTowEncounterStateV2(changed)).toEqual({ ok: false, reason });
    }
  });

  it("requires every living actor fielded exactly once and every defeated actor cleared", () => {
    const state = structuredClone(genesis());
    state.actors["e:guard"].hp = 0;

    expect(validateTowEncounterStateV2(state))
      .toEqual({ ok: false, reason: "encounter-v2-formation-roster-mismatch" });

    state.formations.enemy[0] = null;
    expect(validateTowEncounterStateV2(state)).toEqual({ ok: true, reason: null });
    expect(state.rosters.enemy).toEqual(["e:guard"]);
  });

  it("requires every valid zone owner to be a same-side encounter actor", () => {
    const state = genesis();
    const placed = placeTowZoneV2(state.zones, {
      instanceId: "zone:foreign",
      definitionId: "ranger-snare",
      ownerActorId: "not-in-encounter",
      ownerSide: "player",
      side: "enemy",
      index: 4,
      rank: 1,
      resolvedPotency: 10,
      rounds: 2,
      sequence: 1,
    });
    expect(placed.ok).toBe(true);

    expect(validateTowEncounterStateV2({ ...state, zones: placed.state }))
      .toEqual({ ok: false, reason: "encounter-v2-zone-owner-mismatch" });
  });

  it("requires exactly one matching target lock iff an economy reaction is armed", () => {
    const initial = genesis();
    const round = beginTowActionRoundV2(initial.economy);
    const priority = beginTowActorTurnV2(round.state, { actorId: "p:ranger" });
    const armed = armTowReactionV2(priority.state, {
      actorId: "p:ranger",
      abilityId: "demon-evasion",
      watchedActorId: "p:ranger",
    });
    expect(armed.ok).toBe(true);

    const resolvedAbility = abilityRulesV2AtRank(getTowAbilityRulesV2("demon-evasion"), 1);
    const target = lockAbilityTargetV2(
      initial,
      resolvedAbility,
      "p:ranger",
      "p:ranger",
    );
    expect(target.ok).toBe(true);
    const valid = {
      ...initial,
      economy: armed.state,
      scheduler: {
        version: 1,
        round: 1,
        order: ["p:ranger", "p:knight", "e:guard"],
        cursor: 1,
        priorityActorIds: ["p:ranger"],
        skippedActorIds: [],
        turnBase: 0,
      },
      reactionLocks: {
        "p:ranger": { armedSequence: 1, targetLock: target.lock },
      },
      reactionSequence: 1,
    };
    expect(validateTowEncounterStateV2(valid)).toEqual({ ok: true, reason: null });

    const skippedLiving = structuredClone(valid);
    skippedLiving.scheduler.cursor = 2;
    expect(validateTowEncounterStateV2(skippedLiving))
      .toEqual({ ok: false, reason: "encounter-v2-schedule-prefix-mismatch" });
    const turnDrift = structuredClone(valid);
    turnDrift.scheduler.turnBase = 1;
    expect(validateTowEncounterStateV2(turnDrift))
      .toEqual({ ok: false, reason: "encounter-v2-schedule-turn-mismatch" });

    expect(validateTowEncounterStateV2({ ...valid, reactionLocks: {} }))
      .toEqual({ ok: false, reason: "encounter-v2-reaction-lock-arm-mismatch" });
    expect(validateTowEncounterStateV2({
      ...initial,
      reactionLocks: {
        "p:knight": { armedSequence: 1, targetLock: target.lock },
      },
      reactionSequence: 1,
    })).toEqual({ ok: false, reason: "encounter-v2-reaction-lock-arm-mismatch" });

    const mismatched = structuredClone(valid);
    mismatched.reactionLocks["p:ranger"].targetLock.anchor.actorId = "e:guard";
    expect(validateTowEncounterStateV2(mismatched))
      .toEqual({ ok: false, reason: "encounter-v2-reaction-lock-arm-mismatch" });
  });
});
