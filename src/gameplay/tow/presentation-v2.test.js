import { describe, expect, it } from "vitest";
import { getTowAbilityRulesV2 } from "./ability-catalog-v2.js";
import { abilityRulesV2AtRank } from "./ability-rules-v2.js";
import { createTowActorV2 } from "./actor-v2.js";
import { TOW_AI_POLICY_REGISTRY_V2_CHECKSUM } from "./ai-v2.js";
import {
  PINNED_TOW_ABILITY_CATALOG_V2_CHECKSUM,
  TOW_ENCOUNTER_POLICY_V2_ID,
  createTowEncounterGenesisV2,
  defineTowEncounterStateV2,
} from "./encounter-state-v2.js";
import {
  beginTowEncounterActorTurnV2,
  beginTowEncounterRoundV2,
  armTowEncounterReactionV2,
  commitTowEncounterAbilityV2,
  endTowEncounterActorTurnV2,
  runTowEncounterAiStepV2,
} from "./encounter-v2.js";
import {
  previewTowAbilityTargetV2,
  projectTowCombatViewV2,
  projectTowDeclaredIntentsV2,
  projectTowEventPresentationV2,
  projectTowLegalActionsV2,
  projectTowLegalAnchorsV2,
} from "./presentation-v2.js";
import { createTowSessionV2 } from "./session-v2.js";
import { mutateTowStatusV2 } from "./status-runtime-v2.js";
import { legalAbilityAnchorsV2 } from "./targeting-v2.js";

function actor({
  id,
  side,
  hp = 500,
  maxHp = hp,
  shield = 0,
  preferredRow = 0,
  controller = side === "player" ? "human" : "ai",
  loadout = [{ id: "arctic-strike", rank: 1 }],
  speed = 10,
  profileId = "knight",
}) {
  const created = createTowActorV2({
    id,
    name: id,
    side,
    controller,
    aiProfile: controller === "ai" ? { id: profileId, version: 1 } : null,
    preferredRow,
    hp,
    maxHp,
    shield,
    stats: { attack: 100, defense: 0, speed, critChanceBps: 0, dodgeChanceBps: 0 },
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
      resolve: resolve[id] ?? 10,
      maxResolve: 20,
    })),
  });
  if (!created.ok) throw new TypeError(created.reason);
  return { input: {
    aiPolicyChecksum: TOW_AI_POLICY_REGISTRY_V2_CHECKSUM,
    catalogChecksum: PINNED_TOW_ABILITY_CATALOG_V2_CHECKSUM,
    policyId: TOW_ENCOUNTER_POLICY_V2_ID,
    rosters: {
      player: players.map(({ id }) => id),
      enemy: enemies.map(({ id }) => id),
    },
    actors,
    resolveSeeds: actors.map(({ id }) => ({ id, resolve: resolve[id] ?? 10, maxResolve: 20 })),
  }, state: created.state };
}

function mixedThreeByThree({ enemyHp = 500, firstEnemyController = "ai" } = {}) {
  const players = [
    actor({
      id: "p:auto",
      side: "player",
      hp: 620,
      shield: 45,
      loadout: [
        { id: "automaton-infinite-power", rank: 1 },
        { id: "automaton-scorched-earth", rank: 1 },
      ],
    }),
    actor({
      id: "p:guard",
      side: "player",
      preferredRow: 1,
      loadout: [{ id: "arctic-block", rank: 1 }, { id: "arctic-strike", rank: 1 }],
    }),
    actor({ id: "p:ally", side: "player", preferredRow: 2 }),
  ];
  const enemies = [0, 1, 2].map((index) => actor({
    id: `e:${index}`,
    side: "enemy",
    hp: enemyHp,
    preferredRow: index,
    controller: index === 0 ? firstEnemyController : "ai",
  }));
  return genesis({ players, enemies, resolve: { "p:auto": 10, "p:guard": 8, "p:ally": 2 } });
}

function openTurn(state, actorId) {
  const round = beginTowEncounterRoundV2(state);
  if (!round.ok) throw new TypeError(round.reason);
  const turn = beginTowEncounterActorTurnV2(round.state, { actorId });
  if (!turn.ok) throw new TypeError(turn.reason);
  return turn.state;
}

function withStatus(state, { actorId, statusId, value, sourceActorId = null }) {
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

describe("v2 combat presentation projections", () => {
  it("projects mobile-critical HP, shield, Resolve, budgets, formations, and scheduler numbers", () => {
    const opened = openTurn(mixedThreeByThree().state, "p:auto");
    const projected = projectTowCombatViewV2(opened);

    expect(projected).toMatchObject({ ok: true, reason: null });
    expect(projected.view.phase).toMatchObject({
      economyPhase: "actor-turn",
      activeActorId: "p:auto",
      decisionActorId: "p:auto",
      round: 1,
      turn: 1,
    });
    expect(projected.view.actors.find(({ id }) => id === "p:auto")).toMatchObject({
      hp: 620,
      maxHp: 620,
      shield: 45,
      resolve: 10,
      maxResolve: 20,
      budgets: { main: 1, quick: 1, reaction: 1 },
      field: { side: "player", index: 0 },
    });
    expect(projected.view.formations.player).toHaveLength(9);
    expect(projected.view.formations.enemy).toHaveLength(9);
    expect(projected.view.formations.player.filter(({ actorId }) => actorId === null)).toHaveLength(6);
    expect(projected.view.scheduler).toMatchObject({ cursor: 1, priorityActorIds: ["p:auto"] });
    expect(Object.isFrozen(projected.view.actors[0].budgets)).toBe(true);
  });

  it("reports legal main/quick/reaction actions and reaction armability for the decision actor", () => {
    const base = mixedThreeByThree().state;
    const round = beginTowEncounterRoundV2(base);
    if (!round.ok) throw new TypeError(round.reason);
    const autoTurn = beginTowEncounterActorTurnV2(round.state, { actorId: "p:auto" });
    if (!autoTurn.ok) throw new TypeError(autoTurn.reason);
    // Give the next equal-speed actor priority through the canonical scheduler.
    const ended = endTowEncounterActorTurnV2(autoTurn.state, { actorId: "p:auto" });
    if (!ended.ok) throw new TypeError(ended.reason);
    const guardTurn = beginTowEncounterActorTurnV2(ended.state, { actorId: "p:guard" });
    if (!guardTurn.ok) throw new TypeError(guardTurn.reason);

    const query = projectTowLegalActionsV2(guardTurn.state);
    expect(query).toMatchObject({ ok: true, query: { actorId: "p:guard" } });
    expect(query.query.actions).toContainEqual(expect.objectContaining({
      abilityId: "arctic-block",
      lane: "reaction",
      commandType: "reaction-arm",
      reactionArmable: true,
    }));
    expect(query.query.actions).toContainEqual(expect.objectContaining({
      abilityId: "arctic-strike",
      lane: "main",
      commandType: "ability",
      reactionArmable: false,
    }));

    const armed = armTowEncounterReactionV2(guardTurn.state, {
      actorId: "p:guard",
      abilityId: "arctic-block",
      anchor: "p:auto",
    });
    if (!armed.ok) throw new TypeError(armed.reason);
    const eventProjection = projectTowEventPresentationV2(armed.state, { events: armed.events });
    expect(eventProjection.projection.payloads.find(({ type }) => type === "reaction-armed"))
      .toMatchObject({
        ability: { id: "arctic-block", castMode: "support", tier: "restrained" },
        targetSnapshot: {
          complete: false,
          anchor: { tracking: "unit", actorId: "p:auto" },
        },
      });
  });

  it("projects empty cell anchors, exact area footprints, and immutable target previews", () => {
    const opened = openTurn(mixedThreeByThree().state, "p:auto");
    const anchors = projectTowLegalAnchorsV2(opened, {
      actorId: "p:auto",
      abilityId: "automaton-scorched-earth",
    });

    expect(anchors.ok).toBe(true);
    expect(anchors.query.anchors.some(({ empty }) => empty)).toBe(true);
    expect(anchors.query.anchors.every(({ selectedCells }) => selectedCells.length === 9)).toBe(true);
    const empty = anchors.query.anchors.find(({ empty }) => empty);
    const preview = previewTowAbilityTargetV2(opened, {
      actorId: "p:auto",
      abilityId: "automaton-scorched-earth",
      anchor: { side: empty.side, index: empty.index },
    });
    expect(preview).toMatchObject({
      ok: true,
      preview: {
        ability: { presentation: { castMode: "field", tier: "ability" } },
        targetCommit: { selectedCells: expect.any(Array), selectedUnits: expect.any(Array) },
      },
    });
    expect(preview.preview.targetCommit.selectedCells).toHaveLength(9);
    expect(Object.isFrozen(preview.preview.targetCommit.selectedCells)).toBe(true);
  });

  it("projects the exact canonical durable AI intent without caller-authored retargeting", () => {
    const player = actor({ id: "p:target", side: "player", speed: 10 });
    const enemy = actor({ id: "e:ai", side: "enemy", speed: 20 });
    const opened = openTurn(genesis({ players: [player], enemies: [enemy] }).state, enemy.id);
    const declared = runTowEncounterAiStepV2(opened, { randomDraws: [] });
    if (!declared.ok) throw new TypeError(declared.reason);
    expect(declared.transaction.stage).toBe("intent-declared");
    const projection = projectTowDeclaredIntentsV2(declared.state);

    expect(projection).toMatchObject({
      ok: true,
      projection: {
        intents: [{
          ordinal: 1,
          actorId: enemy.id,
          abilityId: "arctic-strike",
          rank: 1,
          declaredSequence: 1,
          policyId: "knight-v1",
          presentation: { castMode: "melee", tier: "restrained" },
          targetLock: declared.state.intents[enemy.id].targetLock,
          targetCommit: { selectedCells: expect.any(Array), selectedUnits: expect.any(Array) },
          fizzleReason: null,
        }],
      },
    });
    expect(projectTowCombatViewV2(declared.state).view.intents)
      .toEqual(projection.projection.intents);
    expect(projectTowDeclaredIntentsV2(declared.state, {
      declarations: [{ actorId: enemy.id, abilityId: "arctic-strike", anchor: player.id }],
    })).toMatchObject({
      ok: false,
      reason: "invalid-presentation-v2-intents-input",
      projection: null,
    });
  });

  it("projects persisted Challenge invalidation, fresh commit, fizzle, and execution clear", () => {
    const easy = actor({ id: "p:easy", side: "player", hp: 1, maxHp: 500, speed: 10 });
    const challenger = actor({ id: "p:challenger", side: "player", speed: 9 });
    const enemy = actor({
      id: "e:ranger",
      side: "enemy",
      speed: 20,
      profileId: "ranger",
      loadout: [{ id: "demon-shoot", rank: 4 }],
    });
    const opened = openTurn(genesis({
      players: [easy, challenger],
      enemies: [enemy],
    }).state, enemy.id);
    const declared = runTowEncounterAiStepV2(opened, { randomDraws: [] });
    if (!declared.ok) throw new TypeError(declared.reason);
    const first = projectTowDeclaredIntentsV2(declared.state);
    expect(first.projection.intents).toEqual([
      expect.objectContaining({
        actorId: enemy.id,
        abilityId: "demon-shoot",
        rank: 4,
        declaredSequence: 1,
        policyId: "ranger-v1",
        targetLock: expect.objectContaining({
          anchor: expect.objectContaining({ actorId: easy.id }),
        }),
        targetCommit: expect.objectContaining({
          selectedUnits: [{ side: "player", index: 0, actorId: easy.id }],
        }),
        fizzleReason: null,
      }),
    ]);

    const leftCombat = structuredClone(declared.state);
    leftCombat.actors[easy.id].hp = 0;
    leftCombat.formations.player[0] = null;
    const fizzled = projectTowDeclaredIntentsV2(defineTowEncounterStateV2(leftCombat));
    expect(fizzled.projection.intents[0]).toMatchObject({
      declaredSequence: 1,
      targetCommit: null,
      fizzleReason: "lost-v2-unit-anchor",
    });

    const challenged = withStatus(declared.state, {
      actorId: enemy.id,
      statusId: "challenged",
      value: 1,
      sourceActorId: challenger.id,
    });
    const invalidated = runTowEncounterAiStepV2(challenged, { randomDraws: [] });
    if (!invalidated.ok) throw new TypeError(invalidated.reason);
    expect(invalidated.transaction.stage).toBe("intent-invalidated");
    const fresh = projectTowDeclaredIntentsV2(invalidated.state);
    expect(fresh.projection.intents).toEqual([
      expect.objectContaining({
        actorId: enemy.id,
        abilityId: "demon-shoot",
        rank: 4,
        declaredSequence: 2,
        policyId: "ranger-v1",
        targetLock: expect.objectContaining({
          anchor: expect.objectContaining({ actorId: challenger.id }),
        }),
        targetCommit: expect.objectContaining({
          selectedUnits: [{ side: "player", index: 1, actorId: challenger.id }],
        }),
        fizzleReason: null,
      }),
    ]);
    expect(first.projection.intents[0].targetLock.anchor.actorId).toBe(easy.id);

    const executed = runTowEncounterAiStepV2(invalidated.state, {
      randomDraws: [9_999, 9_999],
    });
    if (!executed.ok) throw new TypeError(executed.reason);
    expect(executed.transaction.stage).toBe("action-executed");
    expect(projectTowDeclaredIntentsV2(executed.state).projection.intents).toEqual([]);
    expect(projectTowCombatViewV2(executed.state).view.intents).toEqual([]);
  });

  it("uses committed event snapshots and catalog presentation metadata for VFX payloads", () => {
    const opened = openTurn(mixedThreeByThree().state, "p:auto");
    const resolved = commitTowEncounterAbilityV2(opened, {
      actorId: "p:auto",
      abilityId: "automaton-scorched-earth",
      anchor: { side: "enemy", index: 4 },
      randomDraws: [9_999, 9_999, 9_999, 9_999, 9_999, 9_999],
    });
    if (!resolved.ok) throw new TypeError(resolved.reason);
    const projection = projectTowEventPresentationV2(resolved.state, { events: resolved.events });
    const declaration = projection.projection.payloads.find(({ type }) => type === "action-committed");

    expect(declaration).toMatchObject({
      actorId: "p:auto",
      ability: {
        id: "automaton-scorched-earth",
        castMode: "field",
        tier: "ability",
      },
      targetSnapshot: { complete: true },
    });
    expect(declaration.targetSnapshot.selectedCells).toHaveLength(9);
    expect(projection.projection.payloads.find(({ type }) => type === "damage-resolved"))
      .toMatchObject({ ability: { id: "automaton-scorched-earth" } });
  });

  it("keeps reaction effects distinct from the hostile ability sharing their command event range", () => {
    const fixture = mixedThreeByThree({ firstEnemyController: "human" });
    const round = beginTowEncounterRoundV2(fixture.state);
    if (!round.ok) throw new TypeError(round.reason);
    const autoTurn = beginTowEncounterActorTurnV2(round.state, { actorId: "p:auto" });
    if (!autoTurn.ok) throw new TypeError(autoTurn.reason);
    const autoEnded = endTowEncounterActorTurnV2(autoTurn.state, { actorId: "p:auto" });
    if (!autoEnded.ok) throw new TypeError(autoEnded.reason);
    const guardTurn = beginTowEncounterActorTurnV2(autoEnded.state, { actorId: "p:guard" });
    if (!guardTurn.ok) throw new TypeError(guardTurn.reason);
    const armed = armTowEncounterReactionV2(guardTurn.state, {
      actorId: "p:guard",
      abilityId: "arctic-block",
      anchor: "p:auto",
    });
    if (!armed.ok) throw new TypeError(armed.reason);
    const guardEnded = endTowEncounterActorTurnV2(armed.state, { actorId: "p:guard" });
    if (!guardEnded.ok) throw new TypeError(guardEnded.reason);
    const allyTurn = beginTowEncounterActorTurnV2(guardEnded.state, { actorId: "p:ally" });
    if (!allyTurn.ok) throw new TypeError(allyTurn.reason);
    const allyEnded = endTowEncounterActorTurnV2(allyTurn.state, { actorId: "p:ally" });
    if (!allyEnded.ok) throw new TypeError(allyEnded.reason);
    const enemyTurn = beginTowEncounterActorTurnV2(allyEnded.state, { actorId: "e:0" });
    if (!enemyTurn.ok) throw new TypeError(enemyTurn.reason);
    const attack = commitTowEncounterAbilityV2(enemyTurn.state, {
      actorId: "e:0",
      abilityId: "arctic-strike",
      anchor: "p:auto",
      randomDraws: [9_999, 9_999],
    });
    if (!attack.ok) throw new TypeError(attack.reason);

    const projection = projectTowEventPresentationV2(attack.state, { events: attack.events });
    expect(projection.ok).toBe(true);
    expect(projection.projection.payloads.find(({ type }) => type === "shield-resolved"))
      .toMatchObject({ ability: { id: "arctic-block" } });
    expect(projection.projection.payloads.find(({ type }) => type === "damage-resolved"))
      .toMatchObject({ ability: { id: "arctic-strike" } });
  });

  it("returns terminal read models with no legal decision and rejects malformed or tampered sources", () => {
    const terminalOpened = openTurn(mixedThreeByThree({ enemyHp: 100 }).state, "p:auto");
    const terminal = commitTowEncounterAbilityV2(terminalOpened, {
      actorId: "p:auto",
      abilityId: "automaton-scorched-earth",
      anchor: { side: "enemy", index: 4 },
      randomDraws: [9_999, 9_999, 9_999, 9_999, 9_999, 9_999],
    });
    if (!terminal.ok) throw new TypeError(terminal.reason);
    expect(projectTowCombatViewV2(terminal.state)).toMatchObject({
      ok: true,
      view: { terminal: true, combatResult: "victory", phase: { decisionActorId: null } },
    });
    expect(projectTowLegalActionsV2(terminal.state)).toMatchObject({
      ok: true,
      query: { actorId: null, actions: [] },
    });

    const malformed = structuredClone(terminal.state);
    malformed.actors["p:auto"].hp = malformed.actors["p:auto"].maxHp + 1;
    expect(projectTowCombatViewV2(malformed)).toMatchObject({ ok: false, view: null });

    const fixture = mixedThreeByThree();
    const session = createTowSessionV2({ sessionId: "presentation:tamper", genesis: fixture.input });
    if (!session.ok) throw new TypeError(session.reason);
    const tampered = structuredClone(session.session);
    tampered.encounter.actors["p:auto"].hp -= 1;
    expect(projectTowCombatViewV2(tampered)).toMatchObject({
      ok: false,
      reason: "tow-session-v2-checksum-mismatch",
      view: null,
    });
    expect(previewTowAbilityTargetV2(terminalOpened, {
      actorId: "p:auto",
      abilityId: "automaton-scorched-earth",
      anchor: { side: "enemy", index: 4 },
      extra: true,
    })).toMatchObject({ ok: false, reason: "invalid-presentation-v2-preview-input" });

    const malformedEvents = structuredClone(terminal.events);
    const committed = malformedEvents.find(({ targetCommit }) => targetCommit);
    committed.targetCommit.selectedUnits[0].actorId = "missing:event-target";
    expect(projectTowEventPresentationV2(terminal.state, { events: malformedEvents }))
      .toMatchObject({
        ok: false,
        reason: "invalid-presentation-v2-events",
        projection: null,
      });
  });
});
