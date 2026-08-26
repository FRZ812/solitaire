import { describe, expect, it } from "vitest";
import { abilityTargeting } from "./ability-targeting.js";
import { resolveAttack } from "../kernel/tow-damage.js";
import { statusCount } from "../kernel/status-stack.js";
import {
  createTowEncounter,
  declaredIntents,
  endTurn,
  isTowEncounter,
  useSkill,
} from "./encounter.js";
import {
  createSkillState,
  effectMagnitude,
  getSkill,
  skillIds,
} from "./skills.js";

function encounterFor(skillId, {
  playerHp = 98,
  playerMaxHp = 100,
  playerResolve = null,
  playerResolveMax = null,
  playerStatuses = [],
  enemyHp = 100,
  enemyMaxHp = 100,
  enemyResolve = null,
  enemyResolveMax = null,
  enemyStatuses = [],
  rank = 1,
} = {}) {
  return createTowEncounter({
    seed: `ability-semantic-parity:${skillId}:${rank}`,
    player: {
      id: "player",
      name: "Player",
      hp: playerHp,
      maxHp: playerMaxHp,
      ...(Number.isFinite(playerResolve) ? {
        resolve: playerResolve,
        resolveMax: playerResolveMax,
      } : {}),
      statuses: playerStatuses,
      stats: { attack: 20, defense: 20, critRate: 0, dodgeRate: 0 },
    },
    enemies: [{
      id: "enemy",
      name: "Enemy",
      hp: enemyHp,
      maxHp: enemyMaxHp,
      ...(Number.isFinite(enemyResolve) ? {
        resolve: enemyResolve,
        resolveMax: enemyResolveMax,
      } : {}),
      statuses: enemyStatuses,
      stats: { attack: 1, defense: 0, critRate: 0, dodgeRate: 0 },
      attacks: [{ id: "wait", name: "Wait", hits: 1, damage: 0 }],
    }],
    build: {
      traits: {},
      skills: [createSkillState(skillId, rank)],
      runes: [],
    },
  });
}

const EVENT_TYPE_BY_EFFECT = Object.freeze({
  damage: "skill-damage",
  "delayed-damage": "skill-status",
  heal: "skill-heal",
  "heal-flat": "skill-heal",
  "heal-lost-fraction": "skill-heal",
  "modify-status": "skill-status-modified",
  "reduce-statuses": "skill-cleanse",
  "restore-skill-uses": "skill-resolve-restored",
  "scale-status": "skill-status-scaled",
  "scaled-status": "skill-status",
  "scaled-status-enemy-lost-hp": "skill-status",
  shield: "skill-shield",
  status: "skill-status",
  "status-from-status": "skill-status",
  "temporary-max-hp": "skill-max-hp",
});

function prerequisiteStatuses(definition) {
  const ids = new Set();
  for (const effect of definition.effects) {
    if (effect.factorStatus) ids.add(effect.factorStatus);
    for (const status of effect.statuses || []) ids.add(status);
    if (["modify-status", "reduce-statuses"].includes(effect.type) && effect.status) {
      ids.add(effect.status);
    }
  }
  return [...ids].map((type) => ({ type, count: 10 }));
}

function semanticEncounter(definition, rank) {
  const statuses = prerequisiteStatuses(definition);
  const opened = createTowEncounter({
    seed: `semantic-oracle:${definition.id}:${rank}`,
    player: {
      id: "player",
      name: "Player",
      hp: 5_000,
      maxHp: 10_000,
      resolve: 50,
      resolveMax: 100,
      statuses,
      stats: { attack: 1_000, defense: 1_000, critRate: 0, dodgeRate: 0 },
    },
    enemies: [{
      id: "enemy",
      name: "Enemy",
      hp: 5_000,
      maxHp: 10_000,
      resolve: 100,
      resolveMax: 100,
      statuses,
      stats: { attack: 1, defense: 0, critRate: 0, dodgeRate: 0 },
      attacks: [{ id: "wait", name: "Wait", hits: 1, damage: 0 }],
    }],
    build: {
      traits: {},
      skills: [createSkillState(definition.id, rank)],
      runes: [],
    },
  });
  return {
    ...opened,
    turn: { ...opened.turn, actionsRemaining: 2 },
  };
}

function eventMatchesEffect(event, effect) {
  if (event.type !== EVENT_TYPE_BY_EFFECT[effect.type]) return false;
  if ([
    "delayed-damage",
    "scaled-status",
    "scaled-status-enemy-lost-hp",
    "status",
    "status-from-status",
  ].includes(effect.type)) {
    const status = effect.type === "delayed-damage"
      ? effect.status || "limited-life-sentence"
      : effect.status;
    return event.status === status;
  }
  if (["modify-status"].includes(effect.type)) return event.status === effect.status;
  if (["reduce-statuses", "scale-status"].includes(effect.type)) {
    return effect.statuses.every((status) => event.statuses?.includes(status));
  }
  return true;
}

function effectPromisesOutcome(skillId, effectIndex, rank) {
  const effect = getSkill(skillId).effects[effectIndex];
  if (effect.type === "reduce-statuses") return true;
  if (effect.type === "scale-status") return effectMagnitude(skillId, effectIndex, rank) !== 100;
  return effectMagnitude(skillId, effectIndex, rank) !== 0 || effect.type === "status";
}

describe("ability text-to-mechanics parity", () => {
  it("projects factor-based enemy damage from the declared target", () => {
    const state = createTowEncounter({
      seed: "intent:reapers-scythe",
      player: {
        id: "player",
        name: "Player",
        maxHp: 1_000,
        stats: { attack: 1, defense: 0, critRate: 0, dodgeRate: 0 },
      },
      enemies: [{
        id: "reaper",
        name: "Reaper",
        maxHp: 100,
        resolve: 10,
        resolveMax: 10,
        stats: { attack: 10, defense: 0, critRate: 0, dodgeRate: 0 },
        build: { traits: {}, skills: ["witch-reapers-scythe"] },
      }],
      build: { traits: {}, skills: ["strike"] },
    });

    expect(declaredIntents(state)[0]).toMatchObject({
      skillId: "witch-reapers-scythe",
      damage: 130,
      hits: 1,
      targetIds: ["player"],
    });
  });

  it("projects every recipient of an enemy area boon", () => {
    const allies = ["priest", "ally-a", "ally-b"];
    const state = createTowEncounter({
      seed: "intent:sacred-aegis",
      player: {
        id: "player",
        name: "Player",
        maxHp: 100,
        stats: { attack: 1, defense: 0, critRate: 0, dodgeRate: 0 },
      },
      enemies: allies.map((id, index) => ({
        id,
        name: id,
        maxHp: 100,
        resolve: 10,
        resolveMax: 10,
        stats: { attack: 1, defense: 10, critRate: 0, dodgeRate: 0 },
        ...(index === 0
          ? { build: { traits: {}, skills: ["priestess-divine-barrier"] } }
          : { attacks: [{ id: `${id}-wait`, name: "Wait", hits: 1, damage: 0 }] }),
      })),
      build: { traits: {}, skills: ["strike"] },
    });
    const intent = declaredIntents(state).find(({ enemyId }) => enemyId === "priest");

    expect(intent).toMatchObject({
      skillId: "priestess-divine-barrier",
      target: "area",
      targetIds: allies,
    });
  });

  it("emits the promised canonical outcome for every live ability rank and effect", () => {
    const failures = [];
    let checkedEffects = 0;

    for (const skillId of skillIds()) {
      const definition = getSkill(skillId);
      for (let rank = 1; rank <= definition.rankCount; rank += 1) {
        const state = semanticEncounter(definition, rank);
        const targetId = abilityTargeting(definition).anchorSide === "enemy" ? "enemy" : "player";
        const result = useSkill(state, skillId, targetId);
        if (!result.ok) {
          failures.push(`${skillId}@${rank}: command rejected (${result.reason})`);
          continue;
        }
        const events = result.state.events.filter((event) => (
          event.sequence > state.sequence && event.skillId === skillId
        ));
        definition.effects.forEach((effect, effectIndex) => {
          if (!effectPromisesOutcome(skillId, effectIndex, rank)) return;
          checkedEffects += 1;
          if (!events.some((event) => eventMatchesEffect(event, effect))) {
            failures.push(
              `${skillId}@${rank} effect[${effectIndex}] ${effect.type}`
              + `${effect.status ? `:${effect.status}` : ""}: no canonical outcome`,
            );
          }
        });
      }
    }

    expect(checkedEffects).toBeGreaterThan(skillIds().length);
    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("accounts for every catalogue rank's applied health, ward, maximum-health, and status deltas", () => {
    const failures = [];
    let checkedRanks = 0;

    for (const skillId of skillIds()) {
      const definition = getSkill(skillId);
      for (let rank = 1; rank <= definition.rankCount; rank += 1) {
        const state = semanticEncounter(definition, rank);
        const targetId = abilityTargeting(definition).anchorSide === "enemy" ? "enemy" : "player";
        const result = useSkill(state, skillId, targetId);
        if (!result.ok) continue;
        checkedRanks += 1;
        const expected = Object.fromEntries(Object.entries(state.actors).map(([actorId, actor]) => [
          actorId,
          { hp: actor.hp, maxHp: actor.maxHp, shield: actor.shield },
        ]));
        const events = result.state.events.filter((event) => (
          event.sequence > state.sequence && event.skillId === skillId
        ));

        for (const event of events) {
          if (event.type === "skill-damage") {
            const hits = Array.isArray(event.hits) ? event.hits : [];
            expected[event.targetId].hp -= hits.reduce((sum, hit) => sum + (hit.toHp || 0), 0);
            expected[event.targetId].shield -= hits.reduce((sum, hit) => sum + (hit.absorbed || 0), 0);
            expected[event.actorId].hp -= hits.reduce((sum, hit) => sum + (hit.thorn || 0), 0);
            expected[event.actorId].hp += hits.reduce((sum, hit) => sum + (hit.lifestealHeal || 0), 0);
          }
          if (event.type === "skill-heal") expected[event.targetId].hp += event.amount;
          if (event.type === "skill-status" && event.status === "grow") {
            expected[event.targetId || event.actorId].maxHp += event.count;
          }
          if (event.type === "skill-shield") {
            if (event.after - event.before !== event.amount) {
              failures.push(`${skillId}@${rank}: ward event ${event.before}→${event.after} != +${event.amount}`);
            }
            expected[event.targetId].shield += event.amount;
          }
          if (event.type === "skill-max-hp") {
            if (!event.targetId) failures.push(`${skillId}@${rank}: maximum-health event missing targetId`);
            expected[event.targetId || event.actorId].maxHp += event.amount;
          }
          if (event.type === "skill-status-modified" && event.after - event.before !== event.delta) {
            failures.push(`${skillId}@${rank}: ${event.status} ${event.before}→${event.after} != ${event.delta}`);
          }
          if (event.type === "skill-status-modified" && event.status === "grow") {
            expected[event.targetId || event.actorId].maxHp += event.delta;
          }
          if (event.type === "skill-status-scaled") {
            const changed = (event.changes || []).reduce(
              (sum, change) => sum + Math.abs(change.after - change.before),
              0,
            );
            if (changed !== event.changed) {
              failures.push(`${skillId}@${rank}: scaled status changed ${event.changed}, rows total ${changed}`);
            }
            expected[event.targetId || event.actorId].maxHp += (event.changes || [])
              .filter((change) => change.status === "grow")
              .reduce((sum, change) => sum + change.after - change.before, 0);
          }
        }

        for (const [actorId, actor] of Object.entries(result.state.actors)) {
          const projected = expected[actorId];
          for (const field of ["hp", "maxHp", "shield"]) {
            const bounded = field === "hp"
              ? Math.max(0, Math.min(actor.maxHp, projected[field]))
              : projected[field];
            if (actor[field] !== bounded) {
              failures.push(`${skillId}@${rank}: ${actorId}.${field}=${actor[field]}, events project ${bounded}`);
            }
          }
        }
      }
    }

    expect(checkedRanks).toBeGreaterThan(1_000);
    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("replays every live ability rank identically from a JSON snapshot", () => {
    const failures = [];
    for (const skillId of skillIds()) {
      const definition = getSkill(skillId);
      for (let rank = 1; rank <= definition.rankCount; rank += 1) {
        const state = semanticEncounter(definition, rank);
        const restored = JSON.parse(JSON.stringify(state));
        if (!isTowEncounter(restored)) {
          failures.push(`${skillId}@${rank}: snapshot rejected`);
          continue;
        }
        const targetId = abilityTargeting(definition).anchorSide === "enemy" ? "enemy" : "player";
        const liveResult = useSkill(state, skillId, targetId);
        const replayResult = useSkill(restored, skillId, targetId);
        if (JSON.stringify(replayResult) !== JSON.stringify(liveResult)) {
          failures.push(`${skillId}@${rank}: replay diverged`);
        }
      }
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("gives Interception a useful Lethargy value at every promoted rank", () => {
    expect([1, 2, 3, 4, 5, 6].map((rank) => (
      effectMagnitude("automaton-interception", 0, rank)
    ))).toEqual([25, 50, 75, 100, 125, 150]);

    const opened = encounterFor("automaton-interception", {
      playerResolve: 8,
      playerResolveMax: 8,
    });
    const state = {
      ...opened,
      turn: { ...opened.turn, actionsRemaining: 2 },
    };
    const result = useSkill(state, "automaton-interception", "enemy");
    const event = result.state.events.find((entry) => (
      entry.type === "skill-status"
      && entry.skillId === "automaton-interception"
      && entry.status === "lethargy"
    ));

    expect(result.ok).toBe(true);
    expect(event?.count).toBe(25);
    expect(result.state.actors.enemy.statuses)
      .toContainEqual({ type: "lethargy", count: 25 });
  });

  it("does not resurrect a caster killed by retaliation earlier in the same ability", () => {
    const state = encounterFor("witch-vampiric-touch", {
      playerHp: 5,
      playerMaxHp: 100,
      playerResolve: 8,
      playerResolveMax: 8,
      enemyHp: 100,
      enemyMaxHp: 100,
      enemyStatuses: [{ type: "counter-attack", count: 10 }],
    });

    const result = useSkill(state, "witch-vampiric-touch", "enemy");

    expect(result.ok).toBe(true);
    expect(result.state.actors.player.hp).toBe(0);
    expect(result.state.phase).toBe("defeat");
  });

  it("arms the legacy Retaliation skill with a real counterattack pool", () => {
    const state = encounterFor("retaliation");
    const armed = useSkill(state, "retaliation", "player");

    expect(armed.ok).toBe(true);
    expect(statusCount(armed.state.actors.player.statuses, "counter-attack")).toBe(32);

    const contact = resolveAttack({
      attacker: armed.state.actors.enemy,
      defender: armed.state.actors.player,
      attack: { hits: 1, damage: 10 },
      rng: armed.state.rng,
    });
    expect(contact.attacker.hp).toBe(68);
  });

  it("reports the health actually restored rather than the unclamped request", () => {
    const state = encounterFor("priestess-instant-heal");
    const before = state.actors.player.hp;

    const result = useSkill(state, "priestess-instant-heal", "player");

    expect(result.ok).toBe(true);
    const applied = result.state.actors.player.hp - before;
    const event = result.state.events.find((entry) => (
      entry.type === "skill-heal" && entry.skillId === "priestess-instant-heal"
    ));
    expect(applied).toBeGreaterThan(0);
    expect(event?.amount).toBe(applied);
  });

  it("rejects a full-health healing command before spending Resolve or the action", () => {
    const state = encounterFor("priestess-instant-heal", {
      playerHp: 100,
      playerMaxHp: 100,
      playerResolve: 8,
      playerResolveMax: 8,
    });

    const result = useSkill(state, "priestess-instant-heal", "player");

    expect(result).toEqual({ ok: false, reason: "no-effective-outcome", state });
  });

  it("rejects deterministic zero-damage skills before payment", () => {
    const state = encounterFor("sudden-blow", {
      playerResolve: 8,
      playerResolveMax: 8,
      playerStatuses: [{ type: "lethargy", count: 20 }],
    });

    expect(useSkill(state, "sudden-blow", "enemy"))
      .toEqual({ ok: false, reason: "no-effective-outcome", state });
  });

  it("rejects Blade Inversion when neither damage nor Initiative removal can change state", () => {
    const state = encounterFor("blade-inversion", {
      playerResolve: 8,
      playerResolveMax: 8,
      playerStatuses: [{ type: "lethargy", count: 20 }],
    });

    expect(useSkill(state, "blade-inversion", "enemy"))
      .toEqual({ ok: false, reason: "no-effective-outcome", state });
  });

  it("allows First Aid to cleanse at full health without requiring a rank magnitude", () => {
    const state = encounterFor("first-aid", {
      playerHp: 100,
      playerMaxHp: 100,
      playerResolve: 8,
      playerResolveMax: 8,
      playerStatuses: [{ type: "poison", count: 10 }],
    });

    const result = useSkill(state, "first-aid", "player");

    expect(result.ok).toBe(true);
    expect(result.state.actors.player.statuses)
      .toContainEqual({ type: "poison", count: 6 });
  });

  it("rejects status conversion when the required source stack is absent", () => {
    const state = encounterFor("sleepless-acceleration", {
      playerResolve: 8,
      playerResolveMax: 8,
      enemyStatuses: [],
    });

    const result = useSkill(state, "sleepless-acceleration", "enemy");

    expect(result).toEqual({ ok: false, reason: "no-effective-outcome", state });
  });

  it("rejects an empty cleanse before spending its command", () => {
    const state = encounterFor("assassin-cold-blood", {
      playerResolve: 8,
      playerResolveMax: 8,
      playerStatuses: [],
    });

    const result = useSkill(state, "assassin-cold-blood", "player");

    expect(result).toEqual({ ok: false, reason: "no-effective-outcome", state });
  });

  it("rejects a weaker Ward refresh before spending its command", () => {
    const opened = encounterFor("block", {
      playerResolve: 8,
      playerResolveMax: 8,
    });
    const state = {
      ...opened,
      actors: {
        ...opened.actors,
        player: { ...opened.actors.player, shield: 10_000 },
      },
    };

    const result = useSkill(state, "block", "player");

    expect(result).toEqual({ ok: false, reason: "no-effective-outcome", state });
  });

  it("reports only the Initiative actually removed by Blade Inversion", () => {
    const opened = encounterFor("blade-inversion", {
      playerResolve: 8,
      playerResolveMax: 8,
      playerStatuses: [],
    });
    const state = {
      ...opened,
      turn: { ...opened.turn, actionsRemaining: 2 },
    };

    const result = useSkill(state, "blade-inversion", "enemy");
    const event = result.state.events.find((entry) => (
      entry.type === "skill-status-modified" && entry.skillId === "blade-inversion"
    ));

    expect(result.ok).toBe(true);
    expect(event).toMatchObject({
      status: "initiative",
      requestedDelta: -10,
      delta: 0,
      before: 0,
      after: 0,
    });
  });

  it("reports only status-from-status stacks actually stored after policy limits", () => {
    const opened = encounterFor("automaton-impact-cannon", {
      playerResolve: 8,
      playerResolveMax: 8,
      enemyResolve: 1,
      enemyResolveMax: 1,
      enemyStatuses: [{ type: "limp", count: 500 }],
    });
    const state = {
      ...opened,
      turn: { ...opened.turn, actionsRemaining: 2 },
    };

    const result = useSkill(state, "automaton-impact-cannon", "enemy");
    const stored = result.state.actors.enemy.statuses
      .find((entry) => entry.type === "doom")?.count || 0;
    const event = result.state.events.find((entry) => (
      entry.type === "skill-status"
      && entry.skillId === "automaton-impact-cannon"
      && entry.status === "doom"
    ));

    expect(result.ok).toBe(true);
    expect(stored).toBe(30);
    expect(event).toMatchObject({ count: 30, requestedCount: 425 });
  });

  it("rejects status conversion when every recipient is already capped", () => {
    const state = encounterFor("automaton-impact-cannon", {
      playerResolve: 8,
      playerResolveMax: 8,
      enemyResolve: 1,
      enemyResolveMax: 1,
      enemyStatuses: [
        { type: "limp", count: 500 },
        { type: "doom", count: 30 },
      ],
    });

    const result = useSkill(state, "automaton-impact-cannon", "enemy");

    expect(result).toEqual({ ok: false, reason: "no-effective-outcome", state });
  });

  it("reports only Judge of Fate stacks actually added below the status ceiling", () => {
    const opened = encounterFor("judge-of-fate", {
      playerResolve: 8,
      playerResolveMax: 8,
      enemyHp: 10,
      enemyMaxHp: 100,
      enemyResolve: 1,
      enemyResolveMax: 1,
      enemyStatuses: [{ type: "misfortune", count: 20 }],
    });
    const state = {
      ...opened,
      turn: { ...opened.turn, actionsRemaining: 2 },
    };

    const result = useSkill(state, "judge-of-fate", "enemy");
    const event = result.state.events.find((entry) => (
      entry.type === "skill-status"
      && entry.skillId === "judge-of-fate"
      && entry.status === "misfortune"
    ));

    expect(result.ok).toBe(true);
    expect(result.state.actors.enemy.statuses)
      .toContainEqual({ type: "misfortune", count: 30 });
    expect(event).toMatchObject({ count: 10, requestedCount: 27 });
  });

  it("rejects Judge of Fate when Misfortune is already capped", () => {
    const state = encounterFor("judge-of-fate", {
      playerResolve: 8,
      playerResolveMax: 8,
      enemyHp: 10,
      enemyMaxHp: 100,
      enemyResolve: 1,
      enemyResolveMax: 1,
      enemyStatuses: [{ type: "misfortune", count: 30 }],
    });

    const result = useSkill(state, "judge-of-fate", "enemy");

    expect(result).toEqual({ ok: false, reason: "no-effective-outcome", state });
  });

  it("rejects Resolve restoration that cannot produce a net gain", () => {
    const state = encounterFor("automaton-infinite-power", {
      playerResolve: 8,
      playerResolveMax: 8,
    });

    const result = useSkill(state, "automaton-infinite-power", "player");

    expect(result).toEqual({ ok: false, reason: "no-effective-outcome", state });
  });

  it("reports the damaging status stacks actually stored after policy limits", () => {
    const opened = encounterFor("blade-one-flash", {
      playerResolve: 8,
      playerResolveMax: 8,
      enemyResolve: 1,
      enemyResolveMax: 1,
    });
    const state = {
      ...opened,
      turn: { ...opened.turn, actionsRemaining: 2 },
    };

    const result = useSkill(state, "blade-one-flash", "enemy");

    expect(result.ok).toBe(true);
    const stored = result.state.actors.enemy.statuses
      .find((entry) => entry.type === "doom")?.count || 0;
    const event = result.state.events.find((entry) => (
      entry.type === "skill-status"
      && entry.skillId === "blade-one-flash"
      && entry.status === "doom"
    ));
    expect(stored).toBeGreaterThan(0);
    expect(event?.count).toBe(stored);
  });

  it("rejects an already-capped damaging status before payment", () => {
    const state = encounterFor("blade-one-flash", {
      playerResolve: 8,
      playerResolveMax: 8,
      enemyResolve: 1,
      enemyResolveMax: 1,
      enemyStatuses: [{ type: "doom", count: 30 }],
    });

    const result = useSkill(state, "blade-one-flash", "enemy");

    expect(result).toEqual({ ok: false, reason: "no-effective-outcome", state });
  });

  it("converts each full 100 Initiative into immediate Priority", () => {
    const opened = encounterFor("blade-quick-swordsmanship", {
      playerResolve: 8,
      playerResolveMax: 8,
      playerStatuses: [{ type: "initiative", count: 90 }],
    });
    const state = {
      ...opened,
      turn: { ...opened.turn, actionsRemaining: 2 },
    };

    const result = useSkill(state, "blade-quick-swordsmanship", "enemy");

    expect(result.ok).toBe(true);
    const statuses = result.state.actors.player.statuses;
    expect(statuses.find((entry) => entry.type === "initiative")).toBeUndefined();
    expect(statuses.find((entry) => entry.type === "priority")?.count).toBe(1);
    expect(result.state.turn.actionsRemaining).toBe(3);
  });

  it("records before and after values for every scaled status", () => {
    const opened = encounterFor("priestess-doom", {
      playerResolve: 8,
      playerResolveMax: 8,
      enemyResolve: 1,
      enemyResolveMax: 1,
      enemyStatuses: [
        { type: "bleed", count: 10 },
        { type: "burn", count: 10 },
        { type: "poison", count: 10 },
      ],
    });
    const state = {
      ...opened,
      turn: { ...opened.turn, actionsRemaining: 2 },
    };

    const result = useSkill(state, "priestess-doom", "enemy");

    expect(result.ok).toBe(true);
    const event = result.state.events.find((entry) => (
      entry.type === "skill-status-scaled" && entry.skillId === "priestess-doom"
    ));
    expect(event?.percent).toBe(200);
    expect(event?.changes).toEqual([
      { status: "burn", before: 10, after: 20 },
      { status: "poison", before: 10, after: 20 },
      { status: "bleed", before: 10, after: 20 },
    ]);
  });

  it("records scaled-status changes after damaging-status ceilings", () => {
    const opened = encounterFor("priestess-doom", {
      playerResolve: 8,
      playerResolveMax: 8,
      enemyResolve: 1,
      enemyResolveMax: 1,
      enemyStatuses: [
        { type: "burn", count: 20 },
        { type: "poison", count: 20 },
        { type: "bleed", count: 20 },
      ],
    });
    const state = {
      ...opened,
      turn: { ...opened.turn, actionsRemaining: 2 },
    };

    const result = useSkill(state, "priestess-doom", "enemy");
    const event = result.state.events.find((entry) => (
      entry.type === "skill-status-scaled" && entry.skillId === "priestess-doom"
    ));

    expect(event?.changed).toBe(30);
    expect(event?.changes).toEqual([
      { status: "burn", before: 20, after: 30 },
      { status: "poison", before: 20, after: 30 },
      { status: "bleed", before: 20, after: 30 },
    ]);
    expect(event?.requestedChanges).toEqual([
      { status: "burn", before: 20, after: 40 },
      { status: "poison", before: 20, after: 40 },
      { status: "bleed", before: 20, after: 40 },
    ]);
  });

  it.each([
    ["blade-latent-power", "strength", 33],
    ["automaton-emergency-fuel", "haste", 4],
  ])("resolves %s's Foul Ceremony countdown and exact self-damage", (skillId, boon, boonCount) => {
    let state = encounterFor(skillId, {
      playerHp: 100,
      playerMaxHp: 100,
      playerResolve: 8,
      playerResolveMax: 8,
    });
    state = useSkill(state, skillId, "player").state;
    expect(state.actors.player.statuses).toContainEqual({ type: boon, count: boonCount });
    expect(state.actors.player.statuses).toContainEqual({ type: "foul-ceremony", count: 4 });
    expect(state.scheduledEffects).toContainEqual(expect.objectContaining({
      type: "damage",
      skillId,
      targetId: "player",
      turnsRemaining: 4,
      amount: 9999,
      status: "foul-ceremony",
    }));

    for (let turn = 0; turn < 3; turn += 1) state = endTurn(state).state;
    expect(state.actors.player.hp).toBeGreaterThan(0);
    state = endTurn(state).state;

    const event = [...state.events].reverse().find((entry) => (
      entry.type === "tick-damage" && entry.delayedSkillIds?.includes(skillId)
    ));
    expect(state.actors.player.hp).toBe(0);
    expect(event).toMatchObject({
      delayedDamage: 9999,
      delayedStatuses: ["foul-ceremony"],
      applied: 100,
    });
  });

  it("reports fatal boundary damage as an exact canonical delta", () => {
    let state = encounterFor("witch-forbidden-ritual", {
      playerResolve: 8,
      playerResolveMax: 8,
      playerHp: 100,
      playerMaxHp: 100,
    });
    state = useSkill(state, "witch-forbidden-ritual", "player").state;
    for (let turn = 0; turn < 4; turn += 1) state = endTurn(state).state;

    const event = [...state.events].reverse().find((entry) => (
      entry.type === "tick-damage" && entry.forbiddenRitual
    ));
    expect(state.actors.player.hp).toBe(0);
    expect(event?.fatalDamage).toBeGreaterThan(0);
    expect(event?.total).toBe(event?.fatalDamage);
  });

  it("removes Forbidden Ritual's temporary maximum health at expiration", () => {
    let state = encounterFor("witch-forbidden-ritual", {
      playerResolve: 8,
      playerResolveMax: 8,
      playerHp: 100,
      playerMaxHp: 100,
    });
    state = useSkill(state, "witch-forbidden-ritual", "player").state;
    expect(state.actors.player.maxHp).toBe(150);
    for (let turn = 0; turn < 4; turn += 1) state = endTurn(state).state;

    const event = [...state.events].reverse().find((entry) => (
      entry.type === "tick-damage" && entry.forbiddenRitual
    ));
    expect(state.actors.player.maxHp).toBe(100);
    expect(event).toMatchObject({
      maxHpExpired: 50,
      maxHpBefore: 150,
      maxHpAfter: 100,
    });
  });

  it("replays Forbidden Ritual identically after a JSON save round trip", () => {
    let live = encounterFor("witch-forbidden-ritual", {
      playerResolve: 8,
      playerResolveMax: 8,
      playerHp: 100,
      playerMaxHp: 100,
    });
    live = useSkill(live, "witch-forbidden-ritual", "player").state;
    let restored = JSON.parse(JSON.stringify(live));
    expect(isTowEncounter(restored)).toBe(true);

    for (let turn = 0; turn < 4; turn += 1) {
      live = endTurn(live).state;
      restored = endTurn(restored).state;
    }
    expect(restored).toEqual(live);
  });

  it("migrates legacy Forbidden Ritual schedules before removing temporary maximum health", () => {
    let state = encounterFor("witch-forbidden-ritual", {
      playerResolve: 8,
      playerResolveMax: 8,
      playerHp: 100,
      playerMaxHp: 100,
    });
    state = useSkill(state, "witch-forbidden-ritual", "player").state;
    state = JSON.parse(JSON.stringify(state));
    delete state.scheduledEffects[0].maxHpGain;
    expect(isTowEncounter(state)).toBe(true);

    for (let turn = 0; turn < 4; turn += 1) state = endTurn(state).state;

    expect(state.actors.player).toMatchObject({ hp: 0, maxHp: 100 });
  });

  it("does not double-count fatal damage on top of other boundary damage", () => {
    let state = encounterFor("witch-forbidden-ritual", {
      playerResolve: 8,
      playerResolveMax: 8,
      playerHp: 100,
      playerMaxHp: 100,
    });
    state = useSkill(state, "witch-forbidden-ritual", "player").state;
    for (let turn = 0; turn < 3; turn += 1) state = endTurn(state).state;
    state = {
      ...state,
      actors: {
        ...state.actors,
        player: {
          ...state.actors.player,
          statuses: [...state.actors.player.statuses, { type: "poison", count: 10 }],
        },
      },
    };
    state = endTurn(state).state;

    const event = [...state.events].reverse().find((entry) => (
      entry.type === "tick-damage" && entry.forbiddenRitual
    ));
    expect(event?.poison).toBe(10);
    expect(event?.fatalDamage + event?.poison).toBe(event?.total);
    expect(event?.total).toBe(event?.applied);
  });
});
