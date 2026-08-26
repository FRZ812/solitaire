import { describe, expect, it } from "vitest";
import {
  armTowReactionV2,
  commitTowAbilityActionV2,
} from "./action-economy-v2.js";
import { abilityRulesV2AtRank } from "./ability-rules-v2.js";
import {
  TOW_ABILITY_CATALOG_V2_LIST,
  getTowAbilityRulesV2,
} from "./ability-catalog-v2.js";
import { createTowActorV2 } from "./actor-v2.js";
import { TOW_AI_POLICY_REGISTRY_V2_CHECKSUM } from "./ai-v2.js";
import {
  PINNED_TOW_ABILITY_CATALOG_V2_CHECKSUM,
  TOW_ENCOUNTER_POLICY_V2_ID,
  createTowEncounterGenesisV2,
  defineTowEncounterStateV2,
  validateTowEncounterStateV2,
} from "./encounter-state-v2.js";
import {
  beginTowEncounterActorTurnV2,
  beginTowEncounterRoundV2,
  armTowEncounterReactionV2,
  commitTowEncounterAbilityV2,
  endTowEncounterActorTurnV2,
  endTowEncounterRoundV2,
  reduceTowEncounterV2,
  runTowEncounterAiStepV2,
} from "./encounter-v2.js";
import { mutateTowStatusV2, towStatusMagnitudeV2 } from "./status-runtime-v2.js";
import { legalAbilityAnchorsV2, lockAbilityTargetV2 } from "./targeting-v2.js";

function actor({
  id,
  side,
  name = id,
  loadout = [{ id: "arctic-strike", rank: 1 }],
  hp = 500,
  maxHp = 500,
  attack = 100,
  defense = 0,
  speed = 10,
  preferredRow = 0,
  controller = side === "player" ? "human" : "ai",
  profileId = "knight",
} = {}) {
  const created = createTowActorV2({
    id,
    name,
    side,
    controller,
    aiProfile: controller === "human" ? null : { id: profileId, version: 1 },
    preferredRow,
    hp,
    maxHp,
    shield: 0,
    stats: {
      attack,
      defense,
      speed,
      critChanceBps: 0,
      dodgeChanceBps: 0,
    },
    loadout,
  });
  if (!created.ok) throw new TypeError(created.reason);
  return created.actor;
}

function genesis({ players, enemies, resolve = {} }) {
  const actors = [...players, ...enemies];
  const created = createTowEncounterGenesisV2({
    aiPolicyChecksum: TOW_AI_POLICY_REGISTRY_V2_CHECKSUM,
    catalogChecksum: PINNED_TOW_ABILITY_CATALOG_V2_CHECKSUM,
    policyId: TOW_ENCOUNTER_POLICY_V2_ID,
    rosters: {
      player: players.map(({ id }) => id),
      enemy: enemies.map(({ id }) => id),
    },
    actors,
    resolveSeeds: actors.map(({ id }) => ({
      id,
      resolve: resolve[id]?.resolve ?? 10,
      maxResolve: resolve[id]?.maxResolve ?? 20,
    })),
  });
  if (!created.ok) throw new TypeError(created.reason);
  return created.state;
}

function openTurn(state, actorId) {
  const round = beginTowEncounterRoundV2(state);
  if (!round.ok) throw new TypeError(round.reason);
  const turn = beginTowEncounterActorTurnV2(round.state, { actorId });
  if (!turn.ok) throw new TypeError(turn.reason);
  return turn.state;
}

function exhaustScheduledPriorities(state) {
  let current = state;
  while (current.scheduler.cursor < current.scheduler.order.length) {
    const actorId = current.scheduler.order
      .slice(current.scheduler.cursor)
      .find((id) => current.actors[id].hp > 0);
    if (!actorId) break;
    const opened = beginTowEncounterActorTurnV2(current, { actorId });
    if (!opened.ok) throw new TypeError(opened.reason);
    current = opened.state;
    if (opened.transaction.priorityOpened) {
      const ended = endTowEncounterActorTurnV2(current, { actorId });
      if (!ended.ok) throw new TypeError(ended.reason);
      current = ended.state;
    }
  }
  return current;
}

function withStatus(state, {
  actorId,
  statusId,
  value,
  sourceActorId = null,
}) {
  const mutated = mutateTowStatusV2(state.statuses, {
    actorId,
    operation: "add",
    sourceActorId,
    statusId,
    value,
  });
  if (!mutated.ok) throw new TypeError(mutated.reason);
  return defineTowEncounterStateV2({ ...state, statuses: mutated.state });
}

function mixedThreeByThree({ enemyHp = [500, 500, 500] } = {}) {
  const players = [
    actor({
      id: "p:automaton",
      side: "player",
      loadout: [
        { id: "automaton-infinite-power", rank: 1 },
        { id: "automaton-scorched-earth", rank: 1 },
      ],
    }),
    actor({ id: "p:knight", side: "player" }),
    actor({ id: "p:paladin", side: "player" }),
  ];
  const enemies = enemyHp.map((hp, index) => actor({
    id: `e:${index}`,
    side: "enemy",
    hp,
    maxHp: 500,
  }));
  return genesis({
    players,
    enemies,
    resolve: {
      "p:automaton": { resolve: 10, maxResolve: 12 },
      "p:knight": { resolve: 0, maxResolve: 10 },
      "p:paladin": { resolve: 0, maxResolve: 10 },
    },
  });
}

const REACTION_RANK_CASES = TOW_ABILITY_CATALOG_V2_LIST
  .filter(({ action }) => action.lane === "reaction")
  .flatMap((ability) => Array.from(
    { length: ability.rankCount },
    (_, index) => ({ abilityId: ability.id, rank: index + 1 }),
  ));

describe("v2 composite ability transactions", () => {
  it("executes a deterministic quick plus mixed 3v3 main transaction effect-major", () => {
    const opened = openTurn(mixedThreeByThree(), "p:automaton");
    const quick = commitTowEncounterAbilityV2(opened, {
      actorId: "p:automaton",
      abilityId: "automaton-infinite-power",
      anchor: "p:knight",
      randomDraws: [],
    });
    expect(quick.ok).toBe(true);
    expect(quick.transaction).toMatchObject({
      committed: true,
      lane: "quick",
      rank: 1,
      drawsConsumed: 0,
    });
    expect(quick.state.economy.actors["p:automaton"].resolve).toBe(8);
    expect(quick.state.economy.actors["p:knight"].resolve).toBe(2);

    const command = {
      actorId: "p:automaton",
      abilityId: "automaton-scorched-earth",
      anchor: { side: "enemy", index: 4 },
      randomDraws: [9_999, 9_999, 9_999, 9_999, 9_999, 9_999],
    };
    const first = commitTowEncounterAbilityV2(quick.state, command);
    const second = commitTowEncounterAbilityV2(structuredClone(quick.state), command);

    expect(first).toEqual(second);
    expect(first.ok).toBe(true);
    expect(first.transaction).toMatchObject({
      committed: true,
      lane: "main",
      rank: 1,
      drawsConsumed: 6,
      combatResult: null,
    });
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.state.actors["e:0"])).toBe(true);
    expect(validateTowEncounterStateV2(first.state)).toEqual({ ok: true, reason: null });
    expect(first.state.economy.actors["p:automaton"].resolve).toBe(3);
    expect(first.state.economy.actors["p:automaton"].budgets)
      .toEqual({ main: 0, quick: 0, reaction: 1 });

    expect(["e:0", "e:1", "e:2"].map((id) => first.state.actors[id].hp))
      .toEqual([350, 350, 350]);
    expect(["e:0", "e:1", "e:2"].map((id) => (
      towStatusMagnitudeV2(first.state.statuses, id, "limp")
    ))).toEqual([20, 20, 20]);
    expect(first.state.zones.zones).toHaveLength(9);

    const damageOrder = first.events
      .filter(({ type }) => type === "damage-resolved")
      .map(({ effectIndex, targetActorId }) => [effectIndex, targetActorId]);
    const statusOrder = first.events
      .filter(({ type }) => type === "status-mutated")
      .map(({ effectIndex, actorId }) => [effectIndex, actorId]);
    const zoneOrder = first.events
      .filter(({ type }) => type === "zone-created")
      .map(({ effectIndex, index }) => [effectIndex, index]);
    expect(damageOrder).toEqual([[0, "e:0"], [0, "e:1"], [0, "e:2"]]);
    expect(statusOrder).toEqual([[1, "e:0"], [1, "e:1"], [1, "e:2"]]);
    expect(zoneOrder).toEqual(FORMATION_INDEXES.map((index) => [2, index]));
    expect(first.events.map(({ ordinal }) => ordinal))
      .toEqual(first.events.map((_event, index) => index + 1));
  });

  it("consumes snapshotted draws, skips defeated later recipients, and clears cells", () => {
    const opened = openTurn(mixedThreeByThree({ enemyHp: [100, 500, 500] }), "p:automaton");
    const result = commitTowEncounterAbilityV2(opened, {
      actorId: "p:automaton",
      abilityId: "automaton-scorched-earth",
      anchor: { side: "enemy", index: 4 },
      randomDraws: [9_999, 9_999, 9_999, 9_999, 9_999, 9_999],
    });

    expect(result.ok).toBe(true);
    expect(result.state.actors["e:0"].hp).toBe(0);
    expect(result.state.formations.enemy[0]).toBeNull();
    expect(result.state.rosters.enemy).toEqual(["e:0", "e:1", "e:2"]);
    expect(result.transaction.drawsConsumed).toBe(6);
    expect(result.transaction.combatResult).toBeNull();
    expect(result.events).not.toContainEqual(expect.objectContaining({ type: "combat-ended" }));
    expect(result.events).toContainEqual(expect.objectContaining({
      type: "effect-recipient-skipped",
      effectIndex: 1,
      actorId: "e:0",
      reason: "recipient-not-living-and-fielded",
    }));
    expect(result.state.zones.zones).toHaveLength(9);
    expect(validateTowEncounterStateV2(result.state)).toEqual({ ok: true, reason: null });
  });

  it("declares victory only after every enemy is defeated", () => {
    const opened = openTurn(mixedThreeByThree({ enemyHp: [100, 100, 100] }), "p:automaton");
    const result = commitTowEncounterAbilityV2(opened, {
      actorId: "p:automaton",
      abilityId: "automaton-scorched-earth",
      anchor: { side: "enemy", index: 4 },
      randomDraws: [9_999, 9_999, 9_999, 9_999, 9_999, 9_999],
    });

    expect(result.ok).toBe(true);
    expect(result.transaction.combatResult).toBe("victory");
    expect(result.state.formations.enemy).toEqual(FORMATION_INDEXES.map(() => null));
    expect(result.events.filter(({ type }) => type === "combat-ended"))
      .toEqual([expect.objectContaining({ result: "victory", enemyDefeated: true })]);
  });

  it("rejects malformed randomness and reaction lanes atomically", () => {
    const opened = openTurn(mixedThreeByThree(), "p:automaton");
    const invalidDraws = commitTowEncounterAbilityV2(opened, {
      actorId: "p:automaton",
      abilityId: "automaton-scorched-earth",
      anchor: { side: "enemy", index: 4 },
      randomDraws: [],
    });
    expect(invalidDraws).toMatchObject({
      ok: false,
      reason: "invalid-encounter-v2-random-draws",
      state: opened,
      events: [],
    });
    expect(commitTowEncounterAbilityV2(opened, {
      actorId: "p:automaton",
      abilityId: "automaton-scorched-earth",
      anchor: { side: "enemy", index: 4, legacy: true },
      randomDraws: [9_999, 9_999, 9_999, 9_999, 9_999, 9_999],
    })).toMatchObject({
      ok: false,
      reason: "invalid-encounter-v2-ability-input",
      state: opened,
      events: [],
    });

    const reactionActor = actor({
      id: "p:guard",
      side: "player",
      loadout: [{ id: "arctic-block", rank: 1 }],
    });
    const reactionState = openTurn(genesis({
      players: [reactionActor],
      enemies: [actor({ id: "e:guard", side: "enemy" })],
    }), "p:guard");
    const reaction = commitTowEncounterAbilityV2(reactionState, {
      actorId: "p:guard",
      abilityId: "arctic-block",
      anchor: "p:guard",
      randomDraws: [],
    });
    expect(reaction).toMatchObject({
      ok: false,
      reason: "encounter-v2-reaction-arm-command-required",
      state: reactionState,
      events: [],
    });

    const ally = actor({ id: "p:ally", side: "player" });
    const guarded = actor({
      id: "p:guarded",
      side: "player",
      loadout: [
        { id: "arctic-block", rank: 1 },
        { id: "arctic-strike", rank: 1 },
      ],
    });
    const hostile = actor({ id: "e:hostile", side: "enemy" });
    const guardedState = openTurn(genesis({
      players: [guarded, ally],
      enemies: [hostile],
    }), guarded.id);
    const arm = armTowReactionV2(guardedState.economy, {
      actorId: guarded.id,
      abilityId: "arctic-block",
      watchedActorId: ally.id,
    });
    const block = abilityRulesV2AtRank(getTowAbilityRulesV2("arctic-block"), 1);
    const lock = lockAbilityTargetV2(guardedState, block, guarded.id, ally.id);
    const withArm = defineTowEncounterStateV2({
      ...guardedState,
      economy: arm.state,
      reactionLocks: {
        [guarded.id]: { armedSequence: 1, targetLock: lock.lock },
      },
      reactionSequence: 1,
    });
    const committedWhileArmed = commitTowEncounterAbilityV2(withArm, {
      actorId: guarded.id,
      abilityId: "arctic-strike",
      anchor: hostile.id,
      randomDraws: [9_999, 9_999],
    });
    expect(committedWhileArmed.ok).toBe(true);
    expect(committedWhileArmed.state.economy.actors[guarded.id].armedReaction)
      .toMatchObject({ abilityId: "arctic-block" });
  });

  it("pins exact versioned commands at the serialized reducer boundary", () => {
    const state = mixedThreeByThree();
    const opened = reduceTowEncounterV2(state, {
      version: 2,
      rulesetId: "solitaire-tow-v2",
      type: "round-start",
    });
    expect(opened.ok).toBe(true);
    expect(opened.transaction).toMatchObject({
      version: 2,
      rulesetId: "solitaire-tow-v2",
      type: "round-start",
    });

    expect(reduceTowEncounterV2(state, {
      version: 1,
      rulesetId: "solitaire-tow-v2",
      type: "round-start",
    })).toMatchObject({
      ok: false,
      reason: "invalid-encounter-v2-command",
      state,
      events: [],
    });
    expect(reduceTowEncounterV2(state, {
      version: 2,
      rulesetId: "solitaire-tow-v2",
      type: "round-start",
      legacy: true,
    })).toMatchObject({ ok: false, reason: "invalid-encounter-v2-command" });
  });
});

describe("v2 reaction authority", () => {
  it("pins reaction preparation as its own exact serialized reducer command", () => {
    const owner = actor({
      id: "p:owner",
      side: "player",
      controller: "human",
      loadout: [{ id: "arctic-block", rank: 1 }],
    });
    const hostile = actor({ id: "e:hostile", side: "enemy", controller: "human" });
    const state = openTurn(genesis({ players: [owner], enemies: [hostile] }), owner.id);
    const command = {
      version: 2,
      rulesetId: "solitaire-tow-v2",
      type: "reaction-arm",
      actorId: owner.id,
      abilityId: "arctic-block",
      anchor: owner.id,
    };

    const armed = reduceTowEncounterV2(state, command);
    expect(armed.ok).toBe(true);
    expect(armed.transaction).toMatchObject({
      version: 2,
      rulesetId: "solitaire-tow-v2",
      type: "reaction-arm",
      actorId: owner.id,
      abilityId: "arctic-block",
      committed: true,
      armedSequence: 1,
    });
    expect(reduceTowEncounterV2(state, { ...command, randomDraws: [] }))
      .toMatchObject({
        ok: false,
        reason: "invalid-encounter-v2-command",
        state,
        events: [],
      });
  });

  it.each(REACTION_RANK_CASES)(
    "arms and triggers $abilityId rank $rank through its exact hostile window",
    ({ abilityId, rank }) => {
      const definition = getTowAbilityRulesV2(abilityId);
      const reaction = abilityRulesV2AtRank(definition, rank);
      const hostileAbilityId = reaction.action.reactionWindow === "hostile-melee-before-effects"
        ? "arctic-strike"
        : "demon-shoot";
      const owner = actor({
        id: "p:reaction-owner",
        side: "player",
        controller: "human",
        speed: 30,
        defense: 100,
        loadout: [{ id: abilityId, rank }],
      });
      const protectedAlly = reaction.targeting.side === "ally"
        ? actor({
          id: "p:protected-ally",
          side: "player",
          controller: "human",
          speed: 20,
          defense: 100,
        })
        : null;
      const hostile = actor({
        id: "e:hostile-source",
        side: "enemy",
        controller: "human",
        speed: 10,
        attack: 25,
        loadout: [{ id: hostileAbilityId, rank: 1 }],
      });
      let state = openTurn(genesis({
        players: protectedAlly === null ? [owner] : [owner, protectedAlly],
        enemies: [hostile],
      }), owner.id);
      const anchors = legalAbilityAnchorsV2(state, reaction, owner.id);
      const desiredTarget = reaction.action.reactionWatch === "selected-hostile-source"
        ? hostile.id
        : protectedAlly?.id ?? owner.id;
      const anchor = anchors.find(({ actorId }) => actorId === desiredTarget);
      expect(anchor, `${abilityId}:${rank}:legal-anchor`).toBeDefined();
      const armed = armTowEncounterReactionV2(state, {
        actorId: owner.id,
        abilityId,
        anchor: desiredTarget,
      });
      expect(armed.ok).toBe(true);
      expect(armed.transaction).toMatchObject({
        type: "reaction-arm",
        abilityId,
        rank,
        committed: true,
        armedSequence: 1,
      });
      expect(armed.state.economy.actors[owner.id]).toMatchObject({
        resolve: 9,
        budgets: { reaction: 0 },
        armedReaction: { abilityId, rank, watchedActorId: desiredTarget },
      });
      expect(armed.state.economy.actors[owner.id].cooldowns[abilityId] ?? 0)
        .toBe(reaction.action.cooldown);
      expect(armed.state.reactionLocks[owner.id]).toMatchObject({
        armedSequence: 1,
        targetLock: { abilityId, rank, casterId: owner.id },
      });

      const ownerEnded = endTowEncounterActorTurnV2(armed.state, { actorId: owner.id });
      if (protectedAlly !== null) {
        const allyOpened = beginTowEncounterActorTurnV2(ownerEnded.state, {
          actorId: protectedAlly.id,
        });
        const allyEnded = endTowEncounterActorTurnV2(allyOpened.state, {
          actorId: protectedAlly.id,
        });
        state = allyEnded.state;
      } else {
        state = ownerEnded.state;
      }
      const hostileOpened = beginTowEncounterActorTurnV2(state, {
        actorId: hostile.id,
      });
      expect(hostileOpened.ok).toBe(true);
      state = hostileOpened.state;
      const resolved = commitTowEncounterAbilityV2(state, {
        actorId: hostile.id,
        abilityId: hostileAbilityId,
        anchor: reaction.action.reactionWatch === "selected-hostile-source"
          ? owner.id
          : desiredTarget,
        randomDraws: [9_999, 9_999],
      });

      expect(resolved.ok).toBe(true);
      expect(resolved.transaction).toMatchObject({ committed: true, drawsConsumed: 2 });
      expect(resolved.events).toContainEqual(expect.objectContaining({
        type: "reaction-triggered",
        actorId: owner.id,
        abilityId,
        armedSequence: 1,
      }));
      expect(resolved.events).toContainEqual(expect.objectContaining({
        type: "reaction-completed",
        actorId: owner.id,
        abilityId,
        rank,
      }));
      expect(resolved.state.economy.actors[owner.id].armedReaction).toBeNull();
      expect(resolved.state.reactionLocks).toEqual({});
      expect(validateTowEncounterStateV2(resolved.state)).toEqual({ ok: true, reason: null });

      const reactionIndex = resolved.events.findIndex((event) => (
        event.type === "reaction-triggered" && event.abilityId === abilityId
      ));
      const hostileEffectIndex = resolved.events.findIndex((event) => (
        event.type === "ability-effect-started" && event.abilityId === hostileAbilityId
      ));
      if (reaction.action.reactionWindow === "hostile-targeted-after-effects") {
        expect(reactionIndex).toBeGreaterThan(hostileEffectIndex);
      } else {
        expect(reactionIndex).toBeLessThan(hostileEffectIndex);
      }
    },
  );

  it("orders multiple matching arms by monotonic armed sequence before hostile effects", () => {
    const first = actor({
      id: "p:first",
      side: "player",
      controller: "human",
      speed: 30,
      defense: 100,
      loadout: [{ id: "arctic-block", rank: 1 }],
    });
    const second = actor({
      id: "p:second",
      side: "player",
      controller: "human",
      speed: 20,
      defense: 100,
      loadout: [{ id: "witch-bone-shield", rank: 1 }],
    });
    const hostile = actor({
      id: "e:hostile",
      side: "enemy",
      controller: "human",
      speed: 10,
      loadout: [{ id: "demon-shoot", rank: 1 }],
    });
    let state = openTurn(genesis({ players: [first, second], enemies: [hostile] }), first.id);
    const firstArm = armTowEncounterReactionV2(state, {
      actorId: first.id,
      abilityId: "arctic-block",
      anchor: first.id,
    });
    const firstEnded = endTowEncounterActorTurnV2(firstArm.state, { actorId: first.id });
    const secondOpened = beginTowEncounterActorTurnV2(firstEnded.state, { actorId: second.id });
    const secondArm = armTowEncounterReactionV2(secondOpened.state, {
      actorId: second.id,
      abilityId: "witch-bone-shield",
      anchor: first.id,
    });
    const secondEnded = endTowEncounterActorTurnV2(secondArm.state, { actorId: second.id });
    const hostileOpened = beginTowEncounterActorTurnV2(secondEnded.state, { actorId: hostile.id });
    const resolved = commitTowEncounterAbilityV2(hostileOpened.state, {
      actorId: hostile.id,
      abilityId: "demon-shoot",
      anchor: first.id,
      randomDraws: [9_999, 9_999],
    });

    expect(resolved.ok).toBe(true);
    expect(resolved.state.reactionSequence).toBe(2);
    expect(resolved.events
      .filter(({ type }) => type === "reaction-triggered")
      .map(({ actorId, armedSequence }) => [actorId, armedSequence]))
      .toEqual([[first.id, 1], [second.id, 2]]);
    expect(resolved.events.find(({ type }) => type === "reaction-snapshot-created"))
      .toMatchObject({
        reactions: [
          { actorId: first.id, armedSequence: 1 },
          { actorId: second.id, armedSequence: 2 },
        ],
      });
    expect(resolved.state.reactionLocks).toEqual({});
  });

  it("fizzles an after-effect reaction once when its committed unit lock is lost", () => {
    const owner = actor({
      id: "p:repairer",
      side: "player",
      controller: "human",
      speed: 30,
      defense: 100,
      loadout: [{ id: "automaton-repair", rank: 1 }],
    });
    const protectedAlly = actor({
      id: "p:fragile",
      side: "player",
      controller: "human",
      speed: 20,
      hp: 1,
      maxHp: 500,
    });
    const hostile = actor({
      id: "e:hostile",
      side: "enemy",
      controller: "human",
      speed: 10,
      attack: 100,
      loadout: [{ id: "demon-shoot", rank: 1 }],
    });
    let state = openTurn(genesis({ players: [owner, protectedAlly], enemies: [hostile] }), owner.id);
    const armed = armTowEncounterReactionV2(state, {
      actorId: owner.id,
      abilityId: "automaton-repair",
      anchor: protectedAlly.id,
    });
    const ownerEnded = endTowEncounterActorTurnV2(armed.state, { actorId: owner.id });
    const allyOpened = beginTowEncounterActorTurnV2(ownerEnded.state, {
      actorId: protectedAlly.id,
    });
    const allyEnded = endTowEncounterActorTurnV2(allyOpened.state, {
      actorId: protectedAlly.id,
    });
    const hostileOpened = beginTowEncounterActorTurnV2(allyEnded.state, {
      actorId: hostile.id,
    });
    const resolved = commitTowEncounterAbilityV2(hostileOpened.state, {
      actorId: hostile.id,
      abilityId: "demon-shoot",
      anchor: protectedAlly.id,
      randomDraws: [9_999, 9_999],
    });

    expect(resolved.ok).toBe(true);
    expect(resolved.state.actors[protectedAlly.id].hp).toBe(0);
    expect(resolved.events.filter(({ type }) => type === "reaction-fizzled"))
      .toEqual([expect.objectContaining({
        actorId: owner.id,
        abilityId: "automaton-repair",
        cause: "lost-unit-lock",
        armedSequence: 1,
      })]);
    expect(resolved.events.some(({ type, abilityId }) => (
      type === "reaction-completed" && abilityId === "automaton-repair"
    ))).toBe(false);
    expect(resolved.state.reactionLocks).toEqual({});
    expect(resolved.state.economy.actors[owner.id].armedReaction).toBeNull();
  });

  it("rejects an invalid reaction target without spending or allocating sequence", () => {
    const owner = actor({
      id: "p:owner",
      side: "player",
      controller: "human",
      loadout: [{ id: "arctic-block", rank: 1 }],
    });
    const hostile = actor({ id: "e:hostile", side: "enemy", controller: "human" });
    const state = openTurn(genesis({ players: [owner], enemies: [hostile] }), owner.id);
    const refused = armTowEncounterReactionV2(state, {
      actorId: owner.id,
      abilityId: "arctic-block",
      anchor: hostile.id,
    });

    expect(refused).toMatchObject({ ok: false, state, events: [] });
    expect(refused.state.reactionSequence).toBe(0);
    expect(refused.state.reactionLocks).toEqual({});
    expect(refused.state.economy.actors[owner.id]).toEqual(state.economy.actors[owner.id]);
  });

  it("rejects an out-of-priority arm before a control status can be consumed", () => {
    const active = actor({
      id: "p:active",
      side: "player",
      controller: "human",
      speed: 20,
    });
    const owner = actor({
      id: "p:owner",
      side: "player",
      controller: "human",
      speed: 10,
      loadout: [{ id: "demon-evasion", rank: 1 }],
    });
    const hostile = actor({ id: "e:hostile", side: "enemy", speed: 5 });
    let state = openTurn(genesis({ players: [active, owner], enemies: [hostile] }), active.id);
    state = withStatus(state, {
      actorId: owner.id,
      statusId: "stun",
      value: 1,
    });

    const refused = armTowEncounterReactionV2(state, {
      actorId: owner.id,
      abilityId: "demon-evasion",
      anchor: owner.id,
    });

    expect(refused).toMatchObject({
      ok: false,
      reason: "actor-does-not-have-priority-v2",
      state,
      events: [],
    });
    expect(towStatusMagnitudeV2(refused.state.statuses, owner.id, "stun")).toBe(1);
    expect(refused.state.reactionSequence).toBe(0);
    expect(refused.state.reactionLocks).toEqual({});
  });

  it.each([
    {
      reactionId: "clocktower-suppressive-shot",
      ignoredAbilityId: "assassin-cold-blood",
      matchingAbilityId: "demon-shoot",
    },
    {
      reactionId: "assassin-deflect",
      ignoredAbilityId: "demon-shoot",
      matchingAbilityId: "assassin-cold-blood",
    },
  ])("leaves $reactionId armed through a nonmatching hostile window", ({
    reactionId,
    ignoredAbilityId,
    matchingAbilityId,
  }) => {
    const owner = actor({
      id: "p:owner",
      side: "player",
      controller: "human",
      speed: 20,
      defense: 100,
      loadout: [{ id: reactionId, rank: 1 }],
    });
    const hostile = actor({
      id: "e:hostile",
      side: "enemy",
      controller: "human",
      speed: 10,
      loadout: [
        { id: "assassin-cold-blood", rank: 1 },
        { id: "demon-shoot", rank: 1 },
      ],
    });
    let state = openTurn(genesis({ players: [owner], enemies: [hostile] }), owner.id);
    const armed = armTowEncounterReactionV2(state, {
      actorId: owner.id,
      abilityId: reactionId,
      anchor: reactionId === "clocktower-suppressive-shot" ? hostile.id : owner.id,
    });
    const ownerEnded = endTowEncounterActorTurnV2(armed.state, { actorId: owner.id });
    const hostileOpened = beginTowEncounterActorTurnV2(ownerEnded.state, {
      actorId: hostile.id,
    });
    const ignored = commitTowEncounterAbilityV2(hostileOpened.state, {
      actorId: hostile.id,
      abilityId: ignoredAbilityId,
      anchor: owner.id,
      randomDraws: ignoredAbilityId === "demon-shoot" ? [9_999, 9_999] : [],
    });
    expect(ignored.ok).toBe(true);
    expect(ignored.events.some(({ type }) => type === "reaction-triggered")).toBe(false);
    expect(ignored.state.economy.actors[owner.id].armedReaction)
      .toMatchObject({ abilityId: reactionId });

    const matched = commitTowEncounterAbilityV2(ignored.state, {
      actorId: hostile.id,
      abilityId: matchingAbilityId,
      anchor: owner.id,
      randomDraws: matchingAbilityId === "demon-shoot" ? [9_999, 9_999] : [],
    });
    expect(matched.ok).toBe(true);
    expect(matched.events).toContainEqual(expect.objectContaining({
      type: "reaction-triggered",
      actorId: owner.id,
      abilityId: reactionId,
    }));
  });

  it("follows a living unit lock after it moves beyond the declaration range", () => {
    const owner = actor({
      id: "p:owner",
      side: "player",
      controller: "human",
      speed: 30,
      defense: 100,
      loadout: [{ id: "arctic-block", rank: 1 }],
    });
    const ally = actor({
      id: "p:ally",
      side: "player",
      controller: "human",
      speed: 20,
    });
    const hostile = actor({
      id: "e:hostile",
      side: "enemy",
      controller: "human",
      speed: 10,
      loadout: [{ id: "demon-shoot", rank: 1 }],
    });
    let state = openTurn(genesis({ players: [owner, ally], enemies: [hostile] }), owner.id);
    const armed = armTowEncounterReactionV2(state, {
      actorId: owner.id,
      abilityId: "arctic-block",
      anchor: ally.id,
    });
    const movedFormation = [...armed.state.formations.player];
    movedFormation[movedFormation.indexOf(ally.id)] = null;
    movedFormation[8] = ally.id;
    state = defineTowEncounterStateV2({
      ...armed.state,
      formations: { ...armed.state.formations, player: movedFormation },
    });
    const ownerEnded = endTowEncounterActorTurnV2(state, { actorId: owner.id });
    const allyOpened = beginTowEncounterActorTurnV2(ownerEnded.state, { actorId: ally.id });
    const allyEnded = endTowEncounterActorTurnV2(allyOpened.state, { actorId: ally.id });
    const hostileOpened = beginTowEncounterActorTurnV2(allyEnded.state, {
      actorId: hostile.id,
    });
    const resolved = commitTowEncounterAbilityV2(hostileOpened.state, {
      actorId: hostile.id,
      abilityId: "demon-shoot",
      anchor: ally.id,
      randomDraws: [9_999, 9_999],
    });

    expect(resolved.ok).toBe(true);
    expect(resolved.events).toContainEqual(expect.objectContaining({
      type: "reaction-triggered",
      actorId: owner.id,
      targetCommit: expect.objectContaining({
        anchor: expect.objectContaining({ actorId: ally.id, index: 8 }),
      }),
    }));
  });

  it("never opens nested windows while resolving a reaction effect", () => {
    const suppressor = actor({
      id: "p:suppressor",
      side: "player",
      controller: "human",
      speed: 20,
      defense: 100,
      loadout: [{ id: "clocktower-suppressive-shot", rank: 1 }],
    });
    const hostile = actor({
      id: "e:hostile",
      side: "enemy",
      controller: "human",
      speed: 10,
      defense: 100,
      loadout: [
        { id: "demon-evasion", rank: 1 },
        { id: "demon-shoot", rank: 1 },
      ],
    });
    let state = openTurn(genesis({ players: [suppressor], enemies: [hostile] }), suppressor.id);
    const suppressorArm = armTowEncounterReactionV2(state, {
      actorId: suppressor.id,
      abilityId: "clocktower-suppressive-shot",
      anchor: hostile.id,
    });
    const suppressorEnded = endTowEncounterActorTurnV2(suppressorArm.state, {
      actorId: suppressor.id,
    });
    const hostileOpened = beginTowEncounterActorTurnV2(suppressorEnded.state, {
      actorId: hostile.id,
    });
    const hostileArm = armTowEncounterReactionV2(hostileOpened.state, {
      actorId: hostile.id,
      abilityId: "demon-evasion",
      anchor: hostile.id,
    });
    const resolved = commitTowEncounterAbilityV2(hostileArm.state, {
      actorId: hostile.id,
      abilityId: "demon-shoot",
      anchor: suppressor.id,
      randomDraws: [9_999, 9_999],
    });

    expect(resolved.ok).toBe(true);
    expect(resolved.events.filter(({ type }) => type === "reaction-triggered"))
      .toEqual([expect.objectContaining({ actorId: suppressor.id })]);
    expect(resolved.state.economy.actors[hostile.id].armedReaction)
      .toMatchObject({ abilityId: "demon-evasion" });
    expect(resolved.state.reactionLocks[hostile.id]).toMatchObject({ armedSequence: 2 });
  });

  it("freezes all selected hostile units for an AoE and triggers arms in sequence order", () => {
    const owners = [
      actor({
        id: "p:first",
        side: "player",
        controller: "human",
        speed: 40,
        defense: 100,
        loadout: [{ id: "demon-evasion", rank: 1 }],
      }),
      actor({
        id: "p:second",
        side: "player",
        controller: "human",
        speed: 30,
        defense: 100,
        loadout: [{ id: "demon-evasion", rank: 1 }],
      }),
      actor({
        id: "p:third",
        side: "player",
        controller: "human",
        speed: 20,
        defense: 100,
        loadout: [{ id: "demon-evasion", rank: 1 }],
      }),
    ];
    const hostile = actor({
      id: "e:hostile",
      side: "enemy",
      controller: "human",
      speed: 10,
      attack: 25,
      loadout: [{ id: "demon-arrow-rain", rank: 1 }],
    });
    let state = openTurn(genesis({ players: owners, enemies: [hostile] }), owners[0].id);
    for (let index = 0; index < owners.length; index += 1) {
      const owner = owners[index];
      const armed = armTowEncounterReactionV2(state, {
        actorId: owner.id,
        abilityId: "demon-evasion",
        anchor: owner.id,
      });
      expect(armed.transaction.armedSequence).toBe(index + 1);
      const ended = endTowEncounterActorTurnV2(armed.state, { actorId: owner.id });
      state = ended.state;
      if (index + 1 < owners.length) {
        state = beginTowEncounterActorTurnV2(state, {
          actorId: owners[index + 1].id,
        }).state;
      }
    }
    state = beginTowEncounterActorTurnV2(state, { actorId: hostile.id }).state;
    const resolved = commitTowEncounterAbilityV2(state, {
      actorId: hostile.id,
      abilityId: "demon-arrow-rain",
      anchor: { side: "player", index: 4 },
      randomDraws: Array(24).fill(9_999),
    });

    expect(resolved.ok).toBe(true);
    expect(resolved.events.find(({ type }) => type === "reaction-snapshot-created"))
      .toMatchObject({
        hostileSourceId: hostile.id,
        hostileTargetIds: owners.map(({ id }) => id),
        reactions: owners.map(({ id }, index) => ({
          actorId: id,
          abilityId: "demon-evasion",
          armedSequence: index + 1,
        })),
      });
    expect(resolved.events
      .filter(({ type }) => type === "reaction-triggered")
      .map(({ actorId, armedSequence }) => [actorId, armedSequence]))
      .toEqual(owners.map(({ id }, index) => [id, index + 1]));
    expect(resolved.state.reactionLocks).toEqual({});
  });

  it("does not treat a zone-only selected cell as a selected hostile unit", () => {
    const owner = actor({
      id: "p:owner",
      side: "player",
      controller: "human",
      speed: 20,
      defense: 100,
      loadout: [{ id: "arctic-block", rank: 1 }],
    });
    const hostile = actor({
      id: "e:hostile",
      side: "enemy",
      controller: "human",
      speed: 10,
      loadout: [{ id: "demon-trackers-net", rank: 1 }],
    });
    let state = openTurn(genesis({ players: [owner], enemies: [hostile] }), owner.id);
    const armed = armTowEncounterReactionV2(state, {
      actorId: owner.id,
      abilityId: "arctic-block",
      anchor: owner.id,
    });
    const ended = endTowEncounterActorTurnV2(armed.state, { actorId: owner.id });
    state = beginTowEncounterActorTurnV2(ended.state, { actorId: hostile.id }).state;
    const resolved = commitTowEncounterAbilityV2(state, {
      actorId: hostile.id,
      abilityId: "demon-trackers-net",
      anchor: { side: "player", index: 8 },
      randomDraws: [],
    });

    expect(resolved.ok).toBe(true);
    expect(resolved.events.some(({ type }) => type === "reaction-snapshot-created"))
      .toBe(false);
    expect(resolved.events.some(({ type }) => type === "reaction-triggered"))
      .toBe(false);
    expect(resolved.state.economy.actors[owner.id].armedReaction)
      .toMatchObject({ abilityId: "arctic-block" });
    expect(resolved.state.reactionLocks[owner.id]).toMatchObject({ armedSequence: 1 });
  });

  it("fizzles a defeated reaction owner once without refunding preparation", () => {
    const owner = actor({
      id: "p:owner",
      side: "player",
      controller: "human",
      speed: 20,
      hp: 1,
      maxHp: 500,
      defense: 100,
      loadout: [{ id: "north-king-vitality", rank: 1 }],
    });
    const hostile = actor({
      id: "e:hostile",
      side: "enemy",
      controller: "human",
      speed: 10,
      attack: 100,
      loadout: [{ id: "demon-shoot", rank: 1 }],
    });
    let state = openTurn(genesis({ players: [owner], enemies: [hostile] }), owner.id);
    const armed = armTowEncounterReactionV2(state, {
      actorId: owner.id,
      abilityId: "north-king-vitality",
      anchor: owner.id,
    });
    const ownerEnded = endTowEncounterActorTurnV2(armed.state, { actorId: owner.id });
    const hostileOpened = beginTowEncounterActorTurnV2(ownerEnded.state, {
      actorId: hostile.id,
    });
    const resolved = commitTowEncounterAbilityV2(hostileOpened.state, {
      actorId: hostile.id,
      abilityId: "demon-shoot",
      anchor: owner.id,
      randomDraws: [9_999, 9_999],
    });

    expect(resolved.ok).toBe(true);
    expect(resolved.events.filter(({ type }) => type === "reaction-fizzled"))
      .toEqual([expect.objectContaining({
        actorId: owner.id,
        abilityId: "north-king-vitality",
        cause: "actor-defeated",
      })]);
    expect(resolved.events.some(({ type }) => type === "reaction-completed")).toBe(false);
    expect(resolved.state.economy.actors[owner.id]).toMatchObject({
      resolve: 9,
      budgets: { reaction: 0 },
      armedReaction: null,
    });
    expect(resolved.state.reactionLocks).toEqual({});
  });

  it("expires an unused arm only when its owner's next priority actually opens", () => {
    const owner = actor({
      id: "p:owner",
      side: "player",
      controller: "human",
      speed: 20,
      defense: 100,
      loadout: [{ id: "vampire-blood-thirst", rank: 1 }],
    });
    const hostile = actor({
      id: "e:hostile",
      side: "enemy",
      controller: "human",
      speed: 10,
    });
    let state = openTurn(genesis({ players: [owner], enemies: [hostile] }), owner.id);
    const armed = armTowEncounterReactionV2(state, {
      actorId: owner.id,
      abilityId: "vampire-blood-thirst",
      anchor: owner.id,
    });
    expect(armed.ok).toBe(true);
    expect(armed.state.economy.actors[owner.id]).toMatchObject({
      resolve: 9,
      cooldowns: { "vampire-blood-thirst": 1 },
      armedReaction: { abilityId: "vampire-blood-thirst" },
    });

    const ownerEnded = endTowEncounterActorTurnV2(armed.state, { actorId: owner.id });
    const hostileOpened = beginTowEncounterActorTurnV2(ownerEnded.state, {
      actorId: hostile.id,
    });
    const hostileEnded = endTowEncounterActorTurnV2(hostileOpened.state, {
      actorId: hostile.id,
    });
    const roundEnded = endTowEncounterRoundV2(hostileEnded.state);
    const nextRound = beginTowEncounterRoundV2(roundEnded.state);

    expect(nextRound.state.economy.actors[owner.id].armedReaction)
      .toMatchObject({ abilityId: "vampire-blood-thirst" });
    expect(nextRound.state.reactionLocks[owner.id]).toMatchObject({ armedSequence: 1 });

    const nextOwnerPriority = beginTowEncounterActorTurnV2(nextRound.state, {
      actorId: owner.id,
    });
    expect(nextOwnerPriority.ok).toBe(true);
    expect(nextOwnerPriority.events.filter(({ type }) => type === "reaction-expired"))
      .toEqual([expect.objectContaining({
        actorId: owner.id,
        abilityId: "vampire-blood-thirst",
        armedSequence: 1,
        cause: "owner-priority-opened",
      })]);
    expect(nextOwnerPriority.state.economy.actors[owner.id]).toMatchObject({
      resolve: 9,
      cooldowns: {},
      armedReaction: null,
    });
    expect(nextOwnerPriority.state.reactionLocks).toEqual({});
    expect(nextOwnerPriority.state.reactionSequence).toBe(1);
  });

  it("does not snapshot or trigger reactions for a status-blocked hostile action", () => {
    const owner = actor({
      id: "p:owner",
      side: "player",
      controller: "human",
      speed: 20,
      defense: 100,
      loadout: [{ id: "arctic-block", rank: 1 }],
    });
    const hostile = actor({
      id: "e:hostile",
      side: "enemy",
      controller: "human",
      speed: 10,
      loadout: [{ id: "demon-shoot", rank: 1 }],
    });
    let state = openTurn(genesis({ players: [owner], enemies: [hostile] }), owner.id);
    const armed = armTowEncounterReactionV2(state, {
      actorId: owner.id,
      abilityId: "arctic-block",
      anchor: owner.id,
    });
    const ownerEnded = endTowEncounterActorTurnV2(armed.state, { actorId: owner.id });
    const hostileOpened = beginTowEncounterActorTurnV2(ownerEnded.state, {
      actorId: hostile.id,
    });
    state = withStatus(hostileOpened.state, {
      actorId: hostile.id,
      statusId: "stun",
      value: 1,
    });
    const blocked = commitTowEncounterAbilityV2(state, {
      actorId: hostile.id,
      abilityId: "demon-shoot",
      anchor: owner.id,
      randomDraws: [9_999, 9_999],
    });

    expect(blocked.ok).toBe(true);
    expect(blocked.transaction).toMatchObject({
      type: "ability",
      actorId: hostile.id,
      committed: false,
      drawsConsumed: 0,
    });
    expect(blocked.events).toContainEqual(expect.objectContaining({
      type: "ability-blocked",
      actorId: hostile.id,
      blockedBy: "stun",
    }));
    expect(blocked.events.some(({ type }) => type === "reaction-snapshot-created"))
      .toBe(false);
    expect(blocked.events.some(({ type }) => type === "reaction-triggered"))
      .toBe(false);
    expect(blocked.state.economy.actors[owner.id].armedReaction)
      .toMatchObject({ abilityId: "arctic-block" });
    expect(blocked.state.reactionLocks[owner.id]).toMatchObject({ armedSequence: 1 });
  });
});

describe("v2 primitive and scheduler composition", () => {
  it("pins one speed-ordered priority per living fielded actor before round end", () => {
    const first = actor({ id: "p:first", side: "player", speed: 10 });
    const second = actor({ id: "p:second", side: "player", speed: 10 });
    const fastEnemy = actor({ id: "e:fast", side: "enemy", speed: 20 });
    const openedRound = beginTowEncounterRoundV2(genesis({
      players: [first, second],
      enemies: [fastEnemy],
    }));

    expect(openedRound.ok).toBe(true);
    expect(openedRound.state.scheduler).toEqual({
      version: 1,
      round: 1,
      order: [fastEnemy.id, first.id, second.id],
      cursor: 0,
      priorityActorIds: [],
      skippedActorIds: [],
      turnBase: 0,
    });
    expect(beginTowEncounterActorTurnV2(openedRound.state, { actorId: first.id }))
      .toMatchObject({
        ok: false,
        reason: "encounter-v2-actor-out-of-order",
        state: openedRound.state,
        events: [],
      });

    const enemyTurn = beginTowEncounterActorTurnV2(openedRound.state, {
      actorId: fastEnemy.id,
    });
    expect(enemyTurn.ok).toBe(true);
    const enemyEnded = endTowEncounterActorTurnV2(enemyTurn.state, {
      actorId: fastEnemy.id,
    });
    expect(enemyEnded.ok).toBe(true);
    expect(beginTowEncounterActorTurnV2(enemyEnded.state, { actorId: fastEnemy.id }))
      .toMatchObject({ ok: false, reason: "encounter-v2-actor-out-of-order" });
    expect(endTowEncounterRoundV2(enemyEnded.state)).toMatchObject({
      ok: false,
      reason: "encounter-v2-round-schedule-incomplete",
      state: enemyEnded.state,
      events: [],
    });

    const completed = exhaustScheduledPriorities(enemyEnded.state);
    const endedRound = endTowEncounterRoundV2(completed);
    expect(endedRound.ok).toBe(true);
    expect(endedRound.state.scheduler.cursor).toBe(3);
    expect(endedRound.state.economy.phase).toBe("between-rounds");
  });

  it("cannot reopen an owner priority to erase a cooldown inside one round", () => {
    const caster = actor({
      id: "p:ranger",
      side: "player",
      speed: 20,
      loadout: [{ id: "demon-trackers-net", rank: 1 }],
    });
    const target = actor({ id: "e:target", side: "enemy", speed: 10 });
    const opened = openTurn(genesis({ players: [caster], enemies: [target] }), caster.id);
    const cast = commitTowEncounterAbilityV2(opened, {
      actorId: caster.id,
      abilityId: "demon-trackers-net",
      anchor: { side: "enemy", index: 0 },
      randomDraws: [],
    });
    expect(cast.ok).toBe(true);
    expect(cast.state.economy.actors[caster.id].cooldowns)
      .toEqual({ "demon-trackers-net": 6 });

    const ended = endTowEncounterActorTurnV2(cast.state, { actorId: caster.id });
    expect(beginTowEncounterActorTurnV2(ended.state, { actorId: caster.id }))
      .toMatchObject({ ok: false, reason: "encounter-v2-actor-out-of-order" });
    const enemyOpened = beginTowEncounterActorTurnV2(ended.state, { actorId: target.id });
    const enemyEnded = endTowEncounterActorTurnV2(enemyOpened.state, { actorId: target.id });
    const roundEnded = endTowEncounterRoundV2(enemyEnded.state);
    const nextRound = beginTowEncounterRoundV2(roundEnded.state);
    const nextOwnerTurn = beginTowEncounterActorTurnV2(nextRound.state, { actorId: caster.id });
    expect(nextOwnerTurn.ok).toBe(true);
    expect(nextOwnerTurn.state.economy.actors[caster.id].cooldowns)
      .toEqual({ "demon-trackers-net": 5 });
  });

  it("skips only defeated pending actors while preserving the snapshotted order", () => {
    const caster = actor({ id: "p:caster", side: "player", speed: 20 });
    const doomed = actor({ id: "e:doomed", side: "enemy", hp: 1, speed: 15 });
    const survivor = actor({ id: "e:survivor", side: "enemy", speed: 10 });
    const opened = openTurn(genesis({
      players: [caster],
      enemies: [doomed, survivor],
    }), caster.id);
    const cast = commitTowEncounterAbilityV2(opened, {
      actorId: caster.id,
      abilityId: "arctic-strike",
      anchor: doomed.id,
      randomDraws: [9_999, 9_999],
    });
    const ended = endTowEncounterActorTurnV2(cast.state, { actorId: caster.id });
    const staged = runTowEncounterAiStepV2(ended.state, { randomDraws: [] });
    expect(staged).toMatchObject({
      ok: true,
      transaction: {
        type: "ai-step",
        stage: "actor-turn-started",
        actorId: survivor.id,
      },
      state: {
        scheduler: {
          cursor: 3,
          skippedActorIds: [doomed.id],
        },
      },
    });
    expect(staged.events).toContainEqual(expect.objectContaining({
      type: "actor-turn-skipped",
      actorId: doomed.id,
      reason: "defeated-before-priority",
    }));
    const next = beginTowEncounterActorTurnV2(ended.state, { actorId: survivor.id });

    expect(next.ok).toBe(true);
    expect(next.state.scheduler).toMatchObject({
      order: [caster.id, doomed.id, survivor.id],
      cursor: 3,
      priorityActorIds: [caster.id, survivor.id],
      skippedActorIds: [doomed.id],
    });
    expect(next.events).toContainEqual(expect.objectContaining({
      type: "actor-turn-skipped",
      actorId: doomed.id,
      reason: "defeated-before-priority",
    }));
    expect(validateTowEncounterStateV2(next.state)).toEqual({ ok: true, reason: null });
  });

  it("makes the first terminal snapshot absorbing for every reducer transition", () => {
    const caster = actor({ id: "p:caster", side: "player", hp: 10 });
    const target = actor({ id: "e:target", side: "enemy", hp: 1 });
    let state = genesis({ players: [caster], enemies: [target] });
    state = withStatus(state, { actorId: caster.id, statusId: "poison", value: 20 });
    state = openTurn(state, caster.id);
    const victory = commitTowEncounterAbilityV2(state, {
      actorId: caster.id,
      abilityId: "arctic-strike",
      anchor: target.id,
      randomDraws: [9_999, 9_999],
    });

    expect(victory.ok).toBe(true);
    expect(victory.transaction.combatResult).toBe("victory");
    expect(victory.events.filter(({ type }) => type === "combat-ended"))
      .toHaveLength(1);
    for (const refused of [
      beginTowEncounterRoundV2(victory.state),
      beginTowEncounterActorTurnV2(victory.state, { actorId: caster.id }),
      commitTowEncounterAbilityV2(victory.state, {
        actorId: caster.id,
        abilityId: "arctic-strike",
        anchor: target.id,
        randomDraws: [9_999, 9_999],
      }),
      armTowEncounterReactionV2(victory.state, {
        actorId: caster.id,
        abilityId: "arctic-block",
        anchor: caster.id,
      }),
      endTowEncounterActorTurnV2(victory.state, { actorId: caster.id }),
      endTowEncounterRoundV2(victory.state),
    ]) {
      expect(refused).toMatchObject({
        ok: false,
        reason: "encounter-v2-combat-complete",
        state: victory.state,
        events: [],
      });
    }
    expect(victory.state.actors[caster.id].hp).toBe(10);
  });

  it("resolves committed source/recipient movement geometry after damage and status", () => {
    const caster = actor({
      id: "p:knight",
      side: "player",
      loadout: [{ id: "arctic-giants-smash", rank: 1 }],
    });
    const target = actor({ id: "e:target", side: "enemy" });
    const opened = openTurn(genesis({ players: [caster], enemies: [target] }), caster.id);
    const result = commitTowEncounterAbilityV2(opened, {
      actorId: caster.id,
      abilityId: "arctic-giants-smash",
      anchor: { side: "enemy", index: 0 },
      randomDraws: [9_999, 9_999],
    });

    expect(result.ok).toBe(true);
    expect(result.state.actors[target.id].hp).toBe(435);
    expect(towStatusMagnitudeV2(result.state.statuses, target.id, "stun")).toBe(1);
    expect(result.state.formations.enemy[0]).toBeNull();
    expect(result.state.formations.enemy[3]).toBe(target.id);
    expect(result.events).toContainEqual(expect.objectContaining({
      type: "unit-moved",
      actorId: target.id,
      from: { side: "enemy", index: 0 },
      to: { side: "enemy", index: 3 },
    }));
  });

  it("applies heal and cleanse magnitudes through their sole actor/status authorities", () => {
    const healer = actor({
      id: "p:healer",
      side: "player",
      defense: 100,
      loadout: [{ id: "priestess-instant-heal", rank: 1 }],
    });
    const ally = actor({ id: "p:ally", side: "player", hp: 100 });
    const enemy = actor({ id: "e:target", side: "enemy" });
    const healedState = openTurn(genesis({ players: [healer, ally], enemies: [enemy] }), healer.id);
    const healed = commitTowEncounterAbilityV2(healedState, {
      actorId: healer.id,
      abilityId: "priestess-instant-heal",
      anchor: ally.id,
      randomDraws: [],
    });
    expect(healed.ok).toBe(true);
    expect(healed.state.actors[ally.id].hp).toBe(160);

    const purifier = actor({
      id: "p:purifier",
      side: "player",
      loadout: [{ id: "priestess-purification", rank: 1 }],
    });
    let cleanseState = genesis({ players: [purifier, ally], enemies: [enemy] });
    cleanseState = withStatus(cleanseState, {
      actorId: ally.id,
      statusId: "burn",
      value: 10,
    });
    cleanseState = openTurn(cleanseState, purifier.id);
    const cleansed = commitTowEncounterAbilityV2(cleanseState, {
      actorId: purifier.id,
      abilityId: "priestess-purification",
      anchor: { side: "player", index: 1 },
      randomDraws: [],
    });
    expect(cleansed.ok).toBe(true);
    expect(towStatusMagnitudeV2(cleansed.state.statuses, ally.id, "burn")).toBe(4);
  });

  it.each(["paralyze", "stun"])(
    "adjudicates %s before priority so cooldowns and armed reactions do not advance",
    (statusId) => {
      const caster = actor({
        id: "p:controlled",
        side: "player",
        speed: 20,
        loadout: [
          { id: "arctic-block", rank: 1 },
          { id: "demon-trackers-net", rank: 1 },
        ],
      });
      const target = actor({ id: "e:target", side: "enemy", speed: 10 });
      let state = openTurn(genesis({ players: [caster], enemies: [target] }), caster.id);
      const block = abilityRulesV2AtRank(getTowAbilityRulesV2("arctic-block"), 1);
      const lock = lockAbilityTargetV2(state, block, caster.id, caster.id);
      expect(lock.ok).toBe(true);
      const armed = armTowReactionV2(state.economy, {
        actorId: caster.id,
        abilityId: "arctic-block",
        watchedActorId: caster.id,
      });
      expect(armed.ok).toBe(true);
      const spent = commitTowAbilityActionV2(armed.state, {
        actorId: caster.id,
        abilityId: "demon-trackers-net",
      });
      expect(spent.ok).toBe(true);
      state = defineTowEncounterStateV2({
        ...state,
        economy: spent.state,
        reactionLocks: {
          [caster.id]: { armedSequence: 1, targetLock: lock.lock },
        },
        reactionSequence: 1,
      });

      const casterEnded = endTowEncounterActorTurnV2(state, { actorId: caster.id });
      const targetOpened = beginTowEncounterActorTurnV2(casterEnded.state, {
        actorId: target.id,
      });
      const targetEnded = endTowEncounterActorTurnV2(targetOpened.state, {
        actorId: target.id,
      });
      const roundEnded = endTowEncounterRoundV2(targetEnded.state);
      state = withStatus(roundEnded.state, {
        actorId: caster.id,
        statusId,
        value: 1,
      });
      const nextRound = beginTowEncounterRoundV2(state);
      expect(nextRound.ok).toBe(true);
      const beforeEconomy = nextRound.state.economy;
      const beforeReactionLock = nextRound.state.reactionLocks[caster.id];

      const skipped = beginTowEncounterActorTurnV2(nextRound.state, {
        actorId: caster.id,
      });

      expect(skipped.ok).toBe(true);
      expect(skipped.transaction).toMatchObject({
        type: "actor-turn-start",
        actorId: caster.id,
        priorityOpened: false,
        prioritySkipped: true,
        skipReason: "status-action-lock",
        blockedBy: statusId,
      });
      expect(skipped.state.economy).toEqual(beforeEconomy);
      expect(skipped.state.economy.actors[caster.id]).toMatchObject({
        cooldowns: { "demon-trackers-net": 6 },
        armedReaction: { abilityId: "arctic-block" },
      });
      expect(skipped.state.reactionLocks[caster.id]).toEqual(beforeReactionLock);
      expect(towStatusMagnitudeV2(skipped.state.statuses, caster.id, statusId)).toBe(0);
      expect(skipped.state.scheduler).toMatchObject({
        cursor: 1,
        priorityActorIds: [],
        skippedActorIds: [caster.id],
      });
      expect(skipped.events).toContainEqual(expect.objectContaining({
        type: "status-action-adjudicated",
        actorId: caster.id,
        lane: "main",
        allowed: false,
        blockedBy: statusId,
      }));
      expect(skipped.events).toContainEqual(expect.objectContaining({
        type: "actor-priority-skipped",
        actorId: caster.id,
        reason: "status-action-lock",
        blockedBy: statusId,
      }));
      expect(skipped.events.some(({ type }) => type === "owner-priority-opened"))
        .toBe(false);
      expect(skipped.events.some(({ type }) => type === "reaction-expired"))
        .toBe(false);
      expect(validateTowEncounterStateV2(skipped.state)).toEqual({ ok: true, reason: null });

      const nextActor = beginTowEncounterActorTurnV2(skipped.state, {
        actorId: target.id,
      });
      expect(nextActor.ok).toBe(true);
      expect(nextActor.transaction.priorityOpened).toBe(true);
    },
  );

  it("closes priority before periodic end-boundary damage and reports full-side defeat", () => {
    const caster = actor({ id: "p:caster", side: "player", hp: 10 });
    const target = actor({ id: "e:target", side: "enemy" });
    let state = genesis({ players: [caster], enemies: [target] });
    state = withStatus(state, { actorId: caster.id, statusId: "poison", value: 20 });
    state = openTurn(state, caster.id);
    const ended = endTowEncounterActorTurnV2(state, { actorId: caster.id });

    expect(ended.ok).toBe(true);
    expect(ended.state.economy.phase).toBe("round");
    expect(ended.state.economy.activeActorId).toBeNull();
    expect(ended.state.actors[caster.id].hp).toBe(0);
    expect(ended.state.formations.player[0]).toBeNull();
    expect(ended.transaction.combatResult).toBe("defeat");
    expect(ended.events.findIndex(({ type }) => type === "actor-priority-closed"))
      .toBeLessThan(ended.events.findIndex(({ type }) => type === "damage-resolved"));
    expect(validateTowEncounterStateV2(ended.state)).toEqual({ ok: true, reason: null });
  });

  it("ticks and ages round zones only after pre-existing round status boundaries", () => {
    const opened = openTurn(mixedThreeByThree(), "p:automaton");
    const cast = commitTowEncounterAbilityV2(opened, {
      actorId: "p:automaton",
      abilityId: "automaton-scorched-earth",
      anchor: { side: "enemy", index: 4 },
      randomDraws: [9_999, 9_999, 9_999, 9_999, 9_999, 9_999],
    });
    const turn = endTowEncounterActorTurnV2(cast.state, { actorId: "p:automaton" });
    const completed = exhaustScheduledPriorities(turn.state);
    const round = endTowEncounterRoundV2(completed);

    expect(round.ok).toBe(true);
    expect(round.state.economy.phase).toBe("between-rounds");
    expect(round.state.zones.zones).toHaveLength(9);
    expect(round.state.zones.zones.every(({ roundsRemaining }) => roundsRemaining === 1))
      .toBe(true);
    expect(["e:0", "e:1", "e:2"].map((id) => (
      towStatusMagnitudeV2(round.state.statuses, id, "limp")
    ))).toEqual([28, 28, 28]);
    expect(round.events.filter(({ type }) => type === "zone-ticked"))
      .toHaveLength(3);
    expect(round.events.findIndex(({ type }) => type === "status-boundary-resolved"))
      .toBeLessThan(round.events.findIndex(({ type }) => type === "zone-ticked"));
  });
});

describe("v2 staged AI encounter authority", () => {
  const draws = [9_999, 9_999, 1_234, 5_678];

  it("persists declaration before executing one action and advances in replay-owned steps", () => {
    const enemy = actor({ id: "e:ai", side: "enemy", speed: 20 });
    const player = actor({ id: "p:human", side: "player", speed: 10 });
    const initial = genesis({ players: [player], enemies: [enemy] });

    const round = runTowEncounterAiStepV2(initial, { randomDraws: draws });
    expect(round).toMatchObject({
      ok: true,
      transaction: { type: "ai-step", stage: "round-started", drawsConsumed: 0 },
    });
    const turn = runTowEncounterAiStepV2(round.state, { randomDraws: draws });
    expect(turn).toMatchObject({
      ok: true,
      transaction: { type: "ai-step", stage: "actor-turn-started", actorId: enemy.id },
    });

    const declared = runTowEncounterAiStepV2(turn.state, { randomDraws: draws });
    expect(declared).toMatchObject({
      ok: true,
      transaction: {
        type: "ai-step",
        stage: "intent-declared",
        actorId: enemy.id,
        abilityId: "arctic-strike",
        intentSequence: 1,
        drawsConsumed: 0,
        drawsProvided: draws.length,
      },
      state: {
        intentSequence: 1,
        intents: {
          [enemy.id]: {
            abilityId: "arctic-strike",
            rank: 1,
            declaredSequence: 1,
            policyId: "knight-v1",
          },
        },
      },
    });
    expect(declared.events).toContainEqual(expect.objectContaining({
      type: "ai-intent-declared",
      actorId: enemy.id,
      declaredSequence: 1,
    }));
    expect(validateTowEncounterStateV2(declared.state)).toEqual({ ok: true, reason: null });

    const insufficient = runTowEncounterAiStepV2(declared.state, { randomDraws: [] });
    expect(insufficient).toMatchObject({
      ok: false,
      reason: "insufficient-encounter-v2-ai-step-random-draws",
      state: declared.state,
      events: [],
    });

    const executed = runTowEncounterAiStepV2(declared.state, { randomDraws: draws });
    expect(executed).toMatchObject({
      ok: true,
      transaction: {
        type: "ai-step",
        stage: "action-executed",
        actorId: enemy.id,
        abilityId: "arctic-strike",
        intentSequence: 1,
        drawsConsumed: 2,
        drawsProvided: draws.length,
      },
      state: { intents: {} },
    });
    expect(executed.state.actors[player.id].hp).toBeLessThan(player.hp);
    expect(executed.events).toContainEqual(expect.objectContaining({
      type: "action-committed",
      actorId: enemy.id,
      abilityId: "arctic-strike",
    }));

    const ended = runTowEncounterAiStepV2(executed.state, { randomDraws: draws });
    expect(ended).toMatchObject({
      ok: true,
      transaction: {
        type: "ai-step",
        stage: "actor-turn-ended",
        actorId: enemy.id,
        intentSequence: 2,
        drawsConsumed: 0,
      },
      state: { economy: { phase: "round", activeActorId: null } },
    });
    expect(ended.events).toContainEqual(expect.objectContaining({
      type: "ai-priority-ended",
      reason: "no-legal-action-v2",
      declaredSequence: 2,
    }));

    const human = runTowEncounterAiStepV2(ended.state, { randomDraws: draws });
    expect(human).toMatchObject({
      ok: true,
      transaction: {
        type: "ai-step",
        stage: "actor-turn-started",
        actorId: player.id,
      },
      state: { economy: { phase: "actor-turn", activeActorId: player.id } },
    });
    expect(runTowEncounterAiStepV2(human.state, { randomDraws: draws }))
      .toMatchObject({
        ok: false,
        reason: "encounter-v2-player-decision-required",
        state: human.state,
        events: [],
      });

    const replay = [initial];
    for (let index = 0; index < 6; index += 1) {
      const next = runTowEncounterAiStepV2(replay.at(-1), { randomDraws: draws });
      expect(next.ok).toBe(true);
      replay.push(next.state);
    }
    expect(JSON.stringify(replay.at(-1))).toBe(JSON.stringify(human.state));
  });

  it("invalidates a challenged durable lock and persists a fresh declaration before use", () => {
    const easy = actor({ id: "p:easy", side: "player", hp: 1, speed: 10 });
    const challenger = actor({ id: "p:challenger", side: "player", speed: 9 });
    const enemy = actor({
      id: "e:ranger",
      side: "enemy",
      speed: 20,
      profileId: "ranger",
      loadout: [{ id: "demon-shoot", rank: 4 }],
    });
    const opened = openTurn(genesis({ players: [easy, challenger], enemies: [enemy] }), enemy.id);
    const declared = runTowEncounterAiStepV2(opened, { randomDraws: draws });
    expect(declared.state.intents[enemy.id].targetLock.anchor.actorId).toBe(easy.id);
    const challenged = withStatus(declared.state, {
      actorId: enemy.id,
      statusId: "challenged",
      value: 1,
      sourceActorId: challenger.id,
    });

    const invalidated = runTowEncounterAiStepV2(challenged, { randomDraws: draws });
    expect(invalidated).toMatchObject({
      ok: true,
      transaction: {
        stage: "intent-invalidated",
        actorId: enemy.id,
        abilityId: "demon-shoot",
        intentSequence: 2,
        drawsConsumed: 0,
      },
      state: {
        intents: {
          [enemy.id]: {
            declaredSequence: 2,
            targetLock: { anchor: { actorId: challenger.id } },
          },
        },
      },
    });
    const invalidationIndex = invalidated.events.findIndex(({ type }) => (
      type === "ai-intent-invalidated"
    ));
    const declarationIndex = invalidated.events.findIndex(({ type }) => (
      type === "ai-intent-declared"
    ));
    expect(invalidationIndex).toBeGreaterThanOrEqual(0);
    expect(invalidationIndex).toBeLessThan(declarationIndex);
    expect(invalidated.events[invalidationIndex]).toMatchObject({
      declaredSequence: 1,
      reason: "ai-intent-forced-target-mismatch-v2",
    });

    const executed = runTowEncounterAiStepV2(invalidated.state, { randomDraws: draws });
    expect(executed.transaction).toMatchObject({
      stage: "action-executed",
      actorId: enemy.id,
      abilityId: "demon-shoot",
      intentSequence: 2,
      drawsConsumed: 2,
    });
    expect(executed.state.intents).toEqual({});
    expect(executed.state.actors[challenger.id].hp).toBeLessThan(challenger.hp);
    expect(executed.state.actors[easy.id].hp).toBe(easy.hp);
  });

  it("keeps low-level AI execution controller-neutral while the session owns AI commands", () => {
    const enemy = actor({ id: "e:ai", side: "enemy", speed: 20 });
    const player = actor({ id: "p:human", side: "player", speed: 10 });
    const opened = openTurn(genesis({ players: [player], enemies: [enemy] }), enemy.id);
    const direct = commitTowEncounterAbilityV2(opened, {
      actorId: enemy.id,
      abilityId: "arctic-strike",
      anchor: player.id,
      randomDraws: draws.slice(0, 2),
    });
    expect(direct).toMatchObject({
      ok: true,
      transaction: { type: "ability", actorId: enemy.id, committed: true },
    });
    expect(commitTowEncounterAbilityV2(opened, {
      actorId: enemy.id,
      abilityId: "arctic-strike",
      anchor: player.id,
      randomDraws: Array(2),
    })).toMatchObject({
      ok: false,
      reason: "invalid-encounter-v2-ability-input",
      state: opened,
      events: [],
    });
    expect(runTowEncounterAiStepV2(opened, { randomDraws: Array(2) }))
      .toMatchObject({
        ok: false,
        reason: "invalid-encounter-v2-ai-step-input",
        state: opened,
        events: [],
      });

    const malformed = reduceTowEncounterV2(opened, {
      version: 2,
      rulesetId: "solitaire-tow-v2",
      type: "ai-step",
      randomDraws: draws,
      inferredTarget: player.id,
    });
    expect(malformed).toMatchObject({
      ok: false,
      reason: "invalid-encounter-v2-command",
      state: opened,
      events: [],
    });
  });
});

const FORMATION_INDEXES = Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8]);
