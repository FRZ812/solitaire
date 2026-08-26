import { describe, expect, it } from "vitest";
import {
  commitTowAbilityActionV2,
} from "./action-economy-v2.js";
import { abilityRulesV2AtRank } from "./ability-rules-v2.js";
import {
  TOW_ABILITY_CATALOG_V2_LIST,
  TOW_DEFAULT_ABILITY_KITS_V2,
  getTowAbilityRulesV2,
} from "./ability-catalog-v2.js";
import { createTowActorV2 } from "./actor-v2.js";
import {
  TOW_AI_POLICY_REGISTRY_V2,
  TOW_AI_POLICY_REGISTRY_V2_CHECKSUM,
  TOW_AI_PROFILE_IDS_V2,
  calculateTowAiPolicyRegistryV2Checksum,
  declareTowAiIntentV2,
  evaluateTowAiIntentV2,
  getTowAiPolicyV2,
  isTowAiIntentV2,
  redeclareTowAiIntentV2,
  validateTowAiIntentV2,
  validateTowAiPolicyV2,
} from "./ai-v2.js";
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
} from "./encounter-v2.js";
import { mutateTowStatusV2 } from "./status-runtime-v2.js";
import {
  commitAbilityTargetsV2,
  legalAbilityAnchorsV2,
} from "./targeting-v2.js";

function actor({
  id,
  side,
  controller = "human",
  profileId = null,
  loadout = [{ id: "arctic-strike", rank: 1 }],
  hp = 500,
  maxHp = 500,
  speed = 10,
  preferredRow = 0,
} = {}) {
  const created = createTowActorV2({
    id,
    name: id,
    side,
    controller,
    aiProfile: controller === "ai" ? { id: profileId, version: 1 } : null,
    preferredRow,
    hp,
    maxHp,
    shield: 0,
    stats: {
      attack: 100,
      defense: 100,
      speed,
      critChanceBps: 0,
      dodgeChanceBps: 0,
    },
    loadout,
  });
  if (!created.ok) throw new TypeError(created.reason);
  return created.actor;
}

function genesis(actors, { resolve = 10, maxResolve = 20 } = {}) {
  const rosters = {
    player: actors.filter(({ side }) => side === "player").map(({ id }) => id),
    enemy: actors.filter(({ side }) => side === "enemy").map(({ id }) => id),
  };
  const created = createTowEncounterGenesisV2({
    aiPolicyChecksum: TOW_AI_POLICY_REGISTRY_V2_CHECKSUM,
    catalogChecksum: PINNED_TOW_ABILITY_CATALOG_V2_CHECKSUM,
    policyId: TOW_ENCOUNTER_POLICY_V2_ID,
    rosters,
    actors,
    resolveSeeds: actors.map(({ id }) => ({ id, resolve, maxResolve })),
  });
  if (!created.ok) throw new TypeError(created.reason);
  return created.state;
}

function openTurn(state, actorId) {
  const round = beginTowEncounterRoundV2(state);
  if (!round.ok) throw new TypeError(round.reason);
  const turn = beginTowEncounterActorTurnV2(round.state, { actorId });
  if (!turn.ok) throw new TypeError(turn.reason);
  if (!turn.transaction.priorityOpened) throw new TypeError("test-ai-priority-not-opened");
  return turn.state;
}

function basicState({
  profileId,
  loadout,
  aiSide = "enemy",
  aiHp = 500,
  allies = [],
  opponents = [],
} = {}) {
  const opposing = aiSide === "player" ? "enemy" : "player";
  const ai = actor({
    id: `${aiSide}:ai`,
    side: aiSide,
    controller: "ai",
    profileId,
    loadout,
    hp: aiHp,
    maxHp: 500,
    speed: 100,
  });
  const party = allies.length > 0 ? allies : [];
  const targets = opponents.length > 0 ? opponents : [actor({
    id: `${opposing}:target`,
    side: opposing,
    speed: 10,
  })];
  return { ai, state: openTurn(genesis([ai, ...party, ...targets]), ai.id) };
}

function withStatus(state, { actorId, statusId, value, sourceActorId = null }) {
  const changed = mutateTowStatusV2(state.statuses, {
    actorId,
    operation: "add",
    sourceActorId,
    statusId,
    value,
  });
  if (!changed.ok) throw new TypeError(changed.reason);
  return defineTowEncounterStateV2({ ...state, statuses: changed.state });
}

function relocate(state, side, placements) {
  const cells = Array(9).fill(null);
  for (const [actorId, index] of placements) cells[index] = actorId;
  return defineTowEncounterStateV2({
    ...state,
    formations: {
      ...state.formations,
      [side]: cells,
    },
  });
}

function anchorKey(anchor) {
  return anchor.tracking === "unit"
    ? `unit:${anchor.actorId}`
    : `cell:${anchor.side}:${anchor.index}`;
}

function lockKey(lock) {
  return lock.anchor.tracking === "unit"
    ? `unit:${lock.anchor.actorId}`
    : `cell:${lock.anchor.side}:${lock.anchor.index}`;
}

const ACTION_RANK_CASES = Object.entries(TOW_DEFAULT_ABILITY_KITS_V2)
  .flatMap(([profileId, abilityIds]) => abilityIds.flatMap((abilityId) => {
    const definition = getTowAbilityRulesV2(abilityId);
    return definition.action.lane === "reaction"
      ? []
      : Array.from({ length: definition.rankCount }, (_, index) => ({
        profileId,
        abilityId,
        rank: index + 1,
      }));
  }));

describe("v2 AI policy and intent schema", () => {
  it("pins 12 explicit versioned profiles and a fail-stable checksum", () => {
    expect(TOW_AI_PROFILE_IDS_V2).toEqual([
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
    expect(Object.keys(TOW_AI_POLICY_REGISTRY_V2)).toEqual(
      TOW_AI_PROFILE_IDS_V2.map((id) => `${id}-v1`),
    );
    expect(calculateTowAiPolicyRegistryV2Checksum())
      .toBe(TOW_AI_POLICY_REGISTRY_V2_CHECKSUM);
    expect(TOW_AI_POLICY_REGISTRY_V2_CHECKSUM).toBe("fnv1a32:9bcc646d");

    for (const profileId of TOW_AI_PROFILE_IDS_V2) {
      const policy = getTowAiPolicyV2(profileId, 1);
      expect(policy).toMatchObject({
        version: 1,
        rulesetId: "solitaire-tow-v2",
        profileId,
        profileVersion: 1,
        policyId: `${profileId}-v1`,
        lanePriority: ["quick", "main"],
        randomness: "none",
      });
      expect(validateTowAiPolicyV2(policy)).toEqual({ ok: true, reason: null });
      expect(Object.isFrozen(policy)).toBe(true);
    }
    expect(getTowAiPolicyV2("unknown", 1)).toBeNull();
    expect(validateTowAiPolicyV2({
      ...TOW_AI_POLICY_REGISTRY_V2["knight-v1"],
      legacy: true,
    })).toEqual({ ok: false, reason: "invalid-ai-policy-v2-shape" });
  });

  it("creates an exact immutable five-field persisted intent with versioned policy identity", () => {
    const { ai, state } = basicState({
      profileId: "ranger",
      loadout: [{ id: "demon-shoot", rank: 3 }],
    });
    const declared = declareTowAiIntentV2(state, {
      actorId: ai.id,
      declaredSequence: 7,
    });

    expect(declared).toMatchObject({ ok: true, decision: "intent", endReason: null });
    expect(Object.keys(declared.intent).sort()).toEqual([
      "abilityId",
      "declaredSequence",
      "policyId",
      "rank",
      "targetLock",
    ]);
    expect(declared.intent).toMatchObject({
      abilityId: "demon-shoot",
      rank: 3,
      declaredSequence: 7,
      policyId: "ranger-v1",
      targetLock: { casterId: ai.id, abilityId: "demon-shoot", rank: 3 },
    });
    expect(isTowAiIntentV2(declared.intent)).toBe(true);
    expect(Object.isFrozen(declared.intent)).toBe(true);
    expect(Object.isFrozen(declared.intent.targetLock.anchor)).toBe(true);
    expect(declared.events).toEqual([expect.objectContaining({
      type: "ai-intent-declared",
      actorId: ai.id,
      policyId: "ranger-v1",
      declaredSequence: 7,
    })]);

    expect(validateTowAiIntentV2({ ...declared.intent, legacyTargetId: "player:target" }))
      .toEqual({ ok: false, reason: "invalid-ai-intent-v2-shape" });
    expect(validateTowAiIntentV2({
      ...declared.intent,
      rank: 2,
    })).toEqual({ ok: false, reason: "ai-intent-target-lock-mismatch-v2" });
  });

  it("rejects unknown or mismatched genesis profiles without inferring from a loadout", () => {
    const ai = actor({
      id: "enemy:unknown-profile",
      side: "enemy",
      controller: "ai",
      profileId: "test-ai",
      loadout: [{ id: "demon-shoot", rank: 1 }],
    });
    const target = actor({ id: "player:target", side: "player" });
    expect(createTowEncounterGenesisV2({
      aiPolicyChecksum: TOW_AI_POLICY_REGISTRY_V2_CHECKSUM,
      catalogChecksum: PINNED_TOW_ABILITY_CATALOG_V2_CHECKSUM,
      policyId: TOW_ENCOUNTER_POLICY_V2_ID,
      rosters: { player: [target.id], enemy: [ai.id] },
      actors: [ai, target],
      resolveSeeds: [ai, target].map(({ id }) => ({ id, resolve: 10, maxResolve: 20 })),
    })).toEqual({
      ok: false,
      reason: "invalid-encounter-genesis-v2-ai-profile",
      state: null,
    });
  });

  it("fails closed when declaration is requested outside that AI actor's open priority", () => {
    const ai = actor({
      id: "enemy:waiting-ai",
      side: "enemy",
      controller: "ai",
      profileId: "ranger",
      loadout: [{ id: "demon-shoot", rank: 1 }],
      speed: 100,
    });
    const target = actor({ id: "player:target", side: "player" });
    const waiting = genesis([ai, target]);
    expect(declareTowAiIntentV2(waiting, {
      actorId: ai.id,
      declaredSequence: 1,
    })).toMatchObject({
      ok: false,
      reason: "ai-actor-does-not-have-priority-v2",
      events: [],
    });
  });
});

describe("v2 AI exhaustive authoritative reachability", () => {
  it.each(ACTION_RANK_CASES)(
    "declares a legal $abilityId rank $rank for the $profileId profile",
    ({ profileId, abilityId, rank }) => {
      const { ai, state } = basicState({
        profileId,
        loadout: [{ id: abilityId, rank }],
      });
      const ability = abilityRulesV2AtRank(getTowAbilityRulesV2(abilityId), rank);
      const legal = legalAbilityAnchorsV2(state, ability, ai.id);
      expect(legal.length, `${abilityId}:${rank}:legal-anchors`).toBeGreaterThan(0);

      const declared = declareTowAiIntentV2(state, {
        actorId: ai.id,
        declaredSequence: rank,
      });
      expect(declared.ok, `${abilityId}:${rank}:${declared.reason}`).toBe(true);
      expect(declared.decision).toBe("intent");
      expect(declared.intent).toMatchObject({ abilityId, rank, policyId: `${profileId}-v1` });
      expect(legal.map(anchorKey)).toContain(lockKey(declared.intent.targetLock));

      const committed = commitAbilityTargetsV2(state, ability, declared.intent.targetLock);
      expect(committed.ok, `${abilityId}:${rank}:${committed.reason}`).toBe(true);
      const evaluated = evaluateTowAiIntentV2(state, {
        actorId: ai.id,
        intent: declared.intent,
      });
      expect(evaluated).toMatchObject({
        ok: true,
        valid: true,
        reason: null,
        requiresFreshDeclaration: false,
        targetCommit: { abilityId, rank, casterId: ai.id },
      });
      expect(validateTowEncounterStateV2(state)).toEqual({ ok: true, reason: null });
    },
  );

  it("covers all 12 full kits and never declares a reaction as a main/quick intent", () => {
    const seenProfiles = [];
    for (const profileId of TOW_AI_PROFILE_IDS_V2) {
      const loadout = TOW_DEFAULT_ABILITY_KITS_V2[profileId]
        .map((id) => ({ id, rank: 1 }));
      const { ai, state } = basicState({ profileId, loadout });
      const declared = declareTowAiIntentV2(state, {
        actorId: ai.id,
        declaredSequence: 1,
      });
      expect(declared.ok, `${profileId}:${declared.reason}`).toBe(true);
      expect(declared.decision).toBe("intent");
      const ability = abilityRulesV2AtRank(
        getTowAbilityRulesV2(declared.intent.abilityId),
        declared.intent.rank,
      );
      expect(["quick", "main"]).toContain(ability.action.lane);
      expect(evaluateTowAiIntentV2(state, {
        actorId: ai.id,
        intent: declared.intent,
      })).toMatchObject({ ok: true, valid: true });
      seenProfiles.push(profileId);
    }
    expect(seenProfiles).toEqual(TOW_AI_PROFILE_IDS_V2);
    expect(ACTION_RANK_CASES.length).toBe(
      TOW_ABILITY_CATALOG_V2_LIST
        .filter(({ action }) => action.lane !== "reaction")
        .reduce((sum, ability) => sum + ability.rankCount, 0),
    );
  });
});

describe("v2 AI deterministic priorities and geometry", () => {
  it("uses a legal quick action before main, then main after the quick budget is spent", () => {
    const { ai, state } = basicState({
      profileId: "paladin",
      aiHp: 250,
      loadout: [
        { id: "priestess-crush", rank: 1 },
        { id: "priestess-instant-heal", rank: 1 },
      ],
    });
    const quick = declareTowAiIntentV2(state, {
      actorId: ai.id,
      declaredSequence: 1,
    });
    expect(quick.intent.abilityId).toBe("priestess-instant-heal");
    expect(abilityRulesV2AtRank(
      getTowAbilityRulesV2(quick.intent.abilityId),
      quick.intent.rank,
    ).action.lane).toBe("quick");

    const spent = commitTowAbilityActionV2(state.economy, {
      actorId: ai.id,
      abilityId: quick.intent.abilityId,
    });
    expect(spent.ok).toBe(true);
    const afterQuick = defineTowEncounterStateV2({ ...state, economy: spent.state });
    const main = declareTowAiIntentV2(afterQuick, {
      actorId: ai.id,
      declaredSequence: 2,
    });
    expect(main.intent.abilityId).toBe("priestess-crush");
    expect(abilityRulesV2AtRank(
      getTowAbilityRulesV2(main.intent.abilityId),
      main.intent.rank,
    ).action.lane).toBe("main");
  });

  it.each(["enemy", "player"])(
    "targets the most wounded same-side ally for healing when AI is on the %s side",
    (aiSide) => {
      const otherSide = aiSide === "player" ? "enemy" : "player";
      const wounded = actor({
        id: `${aiSide}:wounded`,
        side: aiSide,
        hp: 100,
        maxHp: 1_000,
        speed: 20,
      });
      const scratched = actor({
        id: `${aiSide}:scratched`,
        side: aiSide,
        hp: 400,
        maxHp: 500,
        speed: 15,
      });
      const opponent = actor({ id: `${otherSide}:opponent`, side: otherSide });
      const { ai, state } = basicState({
        aiSide,
        profileId: "paladin",
        loadout: [{ id: "priestess-instant-heal", rank: 5 }],
        allies: [wounded, scratched],
        opponents: [opponent],
      });
      const declared = declareTowAiIntentV2(state, {
        actorId: ai.id,
        declaredSequence: 1,
      });
      expect(declared.intent.targetLock.anchor).toEqual({
        tracking: "unit",
        side: aiSide,
        index: null,
        actorId: wounded.id,
      });
    },
  );

  it.each([
    {
      profileId: "warlock",
      abilityId: "witch-all-out-attack",
      placements: [0, 1, 2],
      expectedAnchor: 0,
      expectedUnits: 3,
      area: "row",
      zone: false,
    },
    {
      profileId: "wizard",
      abilityId: "mage-god-slaying-spear",
      placements: [0, 3, 6],
      expectedAnchor: 0,
      expectedUnits: 3,
      area: "column",
      zone: false,
    },
    {
      profileId: "ranger",
      abilityId: "demon-trackers-net",
      placements: [1, 3, 4],
      expectedAnchor: 4,
      expectedUnits: 3,
      area: "cross-short",
      zone: true,
    },
    {
      profileId: "wizard",
      abilityId: "mage-flame-storm",
      placements: [0, 4, 8],
      expectedAnchor: 4,
      expectedUnits: 3,
      area: "all",
      zone: true,
    },
  ])(
    "chooses maximal row-major $area geometry for $abilityId",
    ({ profileId, abilityId, placements, expectedAnchor, expectedUnits, zone }) => {
      const opponents = placements.map((_, index) => actor({
        id: `player:target-${index}`,
        side: "player",
        speed: 10 - index,
      }));
      const ai = actor({
        id: "enemy:ai",
        side: "enemy",
        controller: "ai",
        profileId,
        loadout: [{ id: abilityId, rank: 1 }],
        speed: 100,
      });
      let initial = genesis([ai, ...opponents]);
      initial = relocate(initial, "player", opponents.map(({ id }, index) => (
        [id, placements[index]]
      )));
      const state = openTurn(initial, ai.id);
      const declared = declareTowAiIntentV2(state, {
        actorId: ai.id,
        declaredSequence: 1,
      });
      expect(declared.intent.targetLock.anchor).toEqual({
        tracking: "cell",
        side: "player",
        index: expectedAnchor,
        actorId: null,
      });
      const ability = abilityRulesV2AtRank(getTowAbilityRulesV2(abilityId), 1);
      const committed = commitAbilityTargetsV2(state, ability, declared.intent.targetLock);
      expect(committed.selectedUnits).toHaveLength(expectedUnits);
      if (zone) {
        expect(ability.effects.some(({ primitive }) => primitive === "zone")).toBe(true);
        expect(committed.selectedCells.length).toBeGreaterThan(0);
      }
    },
  );

  it("produces mirrored legal choices with identical stable tie breaks on either side", () => {
    function mirrored(aiSide) {
      const targetSide = aiSide === "player" ? "enemy" : "player";
      const opponents = [500, 10, 300].map((hp, index) => actor({
        id: `${targetSide}:target-${index}`,
        side: targetSide,
        hp,
        maxHp: 500,
        speed: 10 - index,
      }));
      const { ai, state } = basicState({
        aiSide,
        profileId: "ranger",
        loadout: [{ id: "demon-shoot", rank: 2 }],
        opponents,
      });
      const declared = declareTowAiIntentV2(state, {
        actorId: ai.id,
        declaredSequence: 1,
      });
      const ability = abilityRulesV2AtRank(getTowAbilityRulesV2("demon-shoot"), 2);
      const committed = commitAbilityTargetsV2(state, ability, declared.intent.targetLock);
      return { declared, committed };
    }

    const enemy = mirrored("enemy");
    const player = mirrored("player");
    expect(enemy.declared.intent.abilityId).toBe(player.declared.intent.abilityId);
    expect(enemy.committed.anchor.index).toBe(1);
    expect(player.committed.anchor.index).toBe(1);
    expect(enemy.committed.anchor.side).toBe("player");
    expect(player.committed.anchor.side).toBe("enemy");
  });

  it("is byte-stable across repeated declarations and never needs a random draw", () => {
    const { ai, state } = basicState({
      profileId: "sorcerer",
      loadout: [
        { id: "sleepless-entangling-roots", rank: 2 },
        { id: "sleepless-swing", rank: 3 },
        { id: "sleepless-water-totem", rank: 1 },
      ],
    });
    const before = JSON.stringify(state);
    const first = declareTowAiIntentV2(state, { actorId: ai.id, declaredSequence: 11 });
    const second = declareTowAiIntentV2(state, { actorId: ai.id, declaredSequence: 11 });
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(JSON.stringify(state)).toBe(before);
    expect(getTowAiPolicyV2("sorcerer", 1).randomness).toBe("none");
  });

  it("returns an explicit end decision when no main or quick action is legal", () => {
    const { ai, state } = basicState({
      profileId: "knight",
      loadout: [{ id: "arctic-block", rank: 1 }],
    });
    const ended = declareTowAiIntentV2(state, {
      actorId: ai.id,
      declaredSequence: 4,
    });
    expect(ended).toEqual({
      ok: true,
      reason: null,
      decision: "end",
      endReason: "no-legal-action-v2",
      intent: null,
      events: [{
        type: "ai-priority-ended",
        actorId: ai.id,
        declaredSequence: 4,
        policyId: "knight-v1",
        reason: "no-legal-action-v2",
      }],
    });
  });
});

describe("v2 persisted intent invalidation", () => {
  it("invalidates Challenge-incompatible intent and emits a brand-new declaration/lock", () => {
    const easyTarget = actor({
      id: "player:easy",
      side: "player",
      hp: 1,
      maxHp: 500,
      speed: 10,
    });
    const challenger = actor({
      id: "player:challenger",
      side: "player",
      hp: 500,
      maxHp: 500,
      speed: 9,
    });
    const { ai, state } = basicState({
      profileId: "ranger",
      loadout: [{ id: "demon-shoot", rank: 4 }],
      opponents: [easyTarget, challenger],
    });
    const original = declareTowAiIntentV2(state, {
      actorId: ai.id,
      declaredSequence: 1,
    });
    expect(original.intent.targetLock.anchor.actorId).toBe(easyTarget.id);
    const originalBytes = JSON.stringify(original.intent);
    const challenged = withStatus(state, {
      actorId: ai.id,
      statusId: "challenged",
      value: 1,
      sourceActorId: challenger.id,
    });
    const challengedBytes = JSON.stringify(challenged);

    expect(evaluateTowAiIntentV2(challenged, {
      actorId: ai.id,
      intent: original.intent,
    })).toMatchObject({
      ok: true,
      valid: false,
      reason: "ai-intent-forced-target-mismatch-v2",
      requiresFreshDeclaration: true,
      targetCommit: null,
    });
    const replaced = redeclareTowAiIntentV2(challenged, {
      actorId: ai.id,
      intent: original.intent,
      nextDeclaredSequence: 2,
    });

    expect(replaced).toMatchObject({
      ok: true,
      decision: "intent",
      intent: {
        abilityId: "demon-shoot",
        rank: 4,
        declaredSequence: 2,
        policyId: "ranger-v1",
        targetLock: { anchor: { actorId: challenger.id } },
      },
      events: [
        {
          type: "ai-intent-invalidated",
          actorId: ai.id,
          abilityId: "demon-shoot",
          rank: 4,
          declaredSequence: 1,
          policyId: "ranger-v1",
          reason: "ai-intent-forced-target-mismatch-v2",
        },
        expect.objectContaining({
          type: "ai-intent-declared",
          actorId: ai.id,
          declaredSequence: 2,
          targetLock: expect.objectContaining({
            anchor: expect.objectContaining({ actorId: challenger.id }),
          }),
        }),
      ],
    });
    expect(replaced.intent).not.toBe(original.intent);
    expect(replaced.intent.targetLock).not.toBe(original.intent.targetLock);
    expect(JSON.stringify(original.intent)).toBe(originalBytes);
    expect(JSON.stringify(challenged)).toBe(challengedBytes);
    expect(evaluateTowAiIntentV2(challenged, {
      actorId: ai.id,
      intent: replaced.intent,
    })).toMatchObject({ ok: true, valid: true });
  });

  it("retains a still-valid lock without changing its sequence and rejects stale replacement sequence", () => {
    const { ai, state } = basicState({
      profileId: "ranger",
      loadout: [{ id: "demon-shoot", rank: 1 }],
    });
    const declared = declareTowAiIntentV2(state, {
      actorId: ai.id,
      declaredSequence: 3,
    });
    const retained = redeclareTowAiIntentV2(state, {
      actorId: ai.id,
      intent: declared.intent,
      nextDeclaredSequence: 4,
    });
    expect(retained).toMatchObject({
      ok: true,
      decision: "retain",
      intent: { declaredSequence: 3 },
      events: [],
    });
    expect(retained.intent).not.toBe(declared.intent);
    expect(redeclareTowAiIntentV2(state, {
      actorId: ai.id,
      intent: declared.intent,
      nextDeclaredSequence: 3,
    })).toMatchObject({
      ok: false,
      reason: "nonmonotonic-ai-intent-sequence-v2",
      events: [],
    });
  });
});
