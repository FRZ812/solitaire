import { describe, expect, it } from "vitest";
import { statusCount } from "../kernel/status-stack.js";
import { createTowEncounter, useSkill } from "./encounter.js";
import { resolveCost } from "./skills.js";

const PLAYER_ID = "player-0";
const ROW_ENEMIES = ["enemy-left", "enemy-centre", "enemy-right"];

function player(overrides = {}) {
  return {
    id: PLAYER_ID,
    name: "Player",
    maxHp: 240,
    resolve: 10,
    resolveMax: 10,
    stats: { attack: 20, defense: 10, critRate: 0, dodgeRate: 0 },
    ...overrides,
  };
}

function enemy(id, overrides = {}) {
  return {
    id,
    name: id,
    maxHp: 500,
    stats: { attack: 1, defense: 0, critRate: 0, dodgeRate: 0 },
    attacks: [{ id: "wait", name: "Wait", hits: 1, damage: 1 }],
    ...overrides,
  };
}

function rowEncounter(skillId, playerOverrides = {}) {
  return createTowEncounter({
    seed: `spatial-resolution:${skillId}`,
    player: player(playerOverrides),
    enemies: ROW_ENEMIES.map((id) => enemy(id)),
    build: { traits: {}, skills: [skillId] },
    formations: {
      version: 1,
      player: [null, null, null, null, null, null, null, null, PLAYER_ID],
      enemy: [null, null, null, ...ROW_ENEMIES, null, null, null],
    },
  });
}

function skillEvents(state, skillId, type) {
  return state.events.filter((event) => event.skillId === skillId && event.type === type);
}

describe("authoritative spatial skill resolution", () => {
  it("rejects a forged off-side Strike before spending action, Resolve, or events", () => {
    const state = rowEncounter("strike");
    const beforeEvents = state.events.length;
    const result = useSkill(
      state,
      "strike",
      "enemy-centre",
      PLAYER_ID,
      { side: "player", index: 8 },
    );

    expect(result).toMatchObject({ ok: false, reason: "invalid-target" });
    expect(result.state).toBe(state);
    expect(result.state.turn.actionsRemaining).toBe(1);
    expect(result.state.actors[PLAYER_ID].resolve).toBe(10);
    expect(result.state.events).toHaveLength(beforeEvents);
  });

  it("damages a whole selected row for one action and one Resolve payment", () => {
    const skillId = "clocktower-buckshot";
    const state = rowEncounter(skillId);
    const cost = resolveCost(skillId);
    const beforeHp = Object.fromEntries(
      ROW_ENEMIES.map((id) => [id, state.actors[id].hp]),
    );
    const used = useSkill(
      state,
      skillId,
      null,
      PLAYER_ID,
      { side: "enemy", index: 4 },
    );

    expect(used.ok).toBe(true);
    expect(used.state.turn.actionsRemaining).toBe(0);
    expect(used.state.actors[PLAYER_ID].resolve).toBe(10 - cost);
    for (const id of ROW_ENEMIES) {
      expect(used.state.actors[id].hp, id).toBeLessThan(beforeHp[id]);
    }
    expect(skillEvents(used.state, skillId, "skill-damage").map((event) => event.targetId))
      .toEqual(ROW_ENEMIES);
    expect(skillEvents(used.state, skillId, "resolve-spent"))
      .toEqual([expect.objectContaining({ actorId: PLAYER_ID, amount: cost })]);

    expect(skillEvents(used.state, skillId, "skill-committed"))
      .toEqual([expect.objectContaining({
        actorId: PLAYER_ID,
        anchorCell: { side: "enemy", index: 4 },
        affectedCells: [
          { side: "enemy", index: 3 },
          { side: "enemy", index: 4 },
          { side: "enemy", index: 5 },
        ],
        targetIds: ROW_ENEMIES,
      })]);
  });

  it("applies a mixed row skill's caster Lethargy once while damaging every target", () => {
    const skillId = "north-king-whirlwind";
    const state = rowEncounter(skillId);
    const used = useSkill(
      state,
      skillId,
      null,
      PLAYER_ID,
      { side: "enemy", index: 4 },
    );

    expect(used.ok).toBe(true);
    for (const id of ROW_ENEMIES) {
      expect(used.state.actors[id].hp, id).toBeLessThan(state.actors[id].hp);
    }
    expect(skillEvents(used.state, skillId, "skill-damage")).toHaveLength(3);
    expect(statusCount(used.state.actors[PLAYER_ID].statuses, "lethargy")).toBe(15);
    expect(skillEvents(used.state, skillId, "skill-status"))
      .toEqual([expect.objectContaining({
        targetId: PLAYER_ID,
        status: "lethargy",
        count: 15,
      })]);
  });

  it("heals and cleanses the selected ally without redirecting either effect to the caster", () => {
    const allyId = "field-medic";
    const state = createTowEncounter({
      seed: "spatial-resolution:first-aid",
      player: player({
        hp: 120,
        statuses: [{ type: "poison", count: 10 }],
      }),
      allies: [{
        id: allyId,
        name: "Field Medic",
        maxHp: 100,
        hp: 40,
        resolve: 8,
        resolveMax: 8,
        stats: { attack: 8, defense: 4, critRate: 0, dodgeRate: 0 },
        statuses: [
          { type: "bleed", count: 10 },
          { type: "burn", count: 5 },
          { type: "poison", count: 20 },
        ],
        build: { traits: {}, skills: ["strike"] },
      }],
      enemies: [enemy("enemy-0")],
      build: { traits: {}, skills: ["first-aid"] },
      formations: {
        version: 1,
        player: [null, null, null, null, allyId, null, null, null, PLAYER_ID],
        enemy: [null, null, null, null, "enemy-0", null, null, null, null],
      },
    });
    const playerBefore = state.actors[PLAYER_ID];
    const used = useSkill(
      state,
      "first-aid",
      null,
      PLAYER_ID,
      { side: "player", index: 4 },
    );

    expect(used.ok).toBe(true);
    expect(used.state.actors[allyId].hp).toBe(54);
    expect(statusCount(used.state.actors[allyId].statuses, "bleed")).toBe(6);
    expect(statusCount(used.state.actors[allyId].statuses, "burn")).toBe(3);
    expect(statusCount(used.state.actors[allyId].statuses, "poison")).toBe(12);
    expect(used.state.actors[PLAYER_ID].hp).toBe(playerBefore.hp);
    expect(statusCount(used.state.actors[PLAYER_ID].statuses, "poison")).toBe(10);
    expect(skillEvents(used.state, "first-aid", "skill-heal"))
      .toEqual([expect.objectContaining({ targetId: allyId, amount: 14 })]);
    expect(skillEvents(used.state, "first-aid", "skill-cleanse"))
      .toEqual([expect.objectContaining({ targetId: allyId, removed: 14 })]);
  });
});
