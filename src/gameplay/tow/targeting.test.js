import { describe, expect, it } from "vitest";
import {
  encounterFormations,
  formationCellForActor,
  isEncounterFormations,
  legalSkillAnchors,
  resolveSkillTargets,
} from "./targeting.js";

function actor(id, side, hp = 100) {
  return { id, side, hp, maxHp: 100 };
}

function battle({
  allies = ["ally-0", "ally-1"],
  enemies = ["enemy-0"],
  formations = null,
  hp = {},
} = {}) {
  const playerId = "player-0";
  const playerIds = [playerId, ...allies];
  const actors = Object.fromEntries([
    ...playerIds.map((id) => [id, actor(id, "player", hp[id] ?? 100)]),
    ...enemies.map((id) => [id, actor(id, "enemy", hp[id] ?? 100)]),
  ]);
  return {
    playerId,
    allyIds: allies,
    enemyIds: enemies,
    actors,
    ...(formations ? { formations: { version: 1, ...formations } } : {}),
  };
}

function cells(result) {
  return result.affectedCells.map((cell) => cell.index);
}

describe("encounter formations", () => {
  it("derives deterministic row-major cells for formationless legacy encounters", () => {
    const state = battle({ enemies: ["enemy-0", "enemy-1"] });

    expect(encounterFormations(state)).toEqual({
      version: 1,
      player: ["player-0", "ally-0", "ally-1", null, null, null, null, null, null],
      enemy: ["enemy-0", "enemy-1", null, null, null, null, null, null, null],
    });
    expect(formationCellForActor(state, "player-0")).toEqual({ side: "player", index: 0 });
    expect(formationCellForActor(state, "enemy-1")).toEqual({ side: "enemy", index: 1 });
  });

  it("preserves valid custom cells on both independently oriented sides", () => {
    const formations = {
      player: ["ally-1", null, null, null, "ally-0", null, null, null, "player-0"],
      enemy: [null, null, "enemy-0", null, null, null, null, null, "enemy-1"],
    };
    const state = battle({ enemies: ["enemy-0", "enemy-1"], formations });

    expect(encounterFormations(state)).toEqual({ version: 1, ...formations });
    expect(isEncounterFormations(state.formations, state)).toBe(true);
    expect(formationCellForActor(state, "player-0")).toEqual({ side: "player", index: 8 });
    expect(formationCellForActor(state, "enemy-0")).toEqual({ side: "enemy", index: 2 });
  });

  it("preserves versioned formation rules without changing cell normalization", () => {
    const state = battle({
      allies: [],
      enemies: ["enemy-0"],
      formations: {
        version: 2,
        player: [null, null, null, null, null, null, null, null, "player-0"],
        enemy: [null, null, null, null, "enemy-0", null, null, null, null],
      },
    });

    expect(encounterFormations(state)).toEqual(state.formations);
    expect(isEncounterFormations(state.formations, state)).toBe(true);
    expect(isEncounterFormations({ ...state.formations, version: 3 }, state)).toBe(true);
    expect(isEncounterFormations({ ...state.formations, version: 4 }, state)).toBe(false);
  });

  it("defaults only an absent legacy snapshot and rejects explicit malformed formations", () => {
    const legacy = battle({ allies: [], enemies: ["enemy-0"] });
    expect(encounterFormations(legacy).version).toBe(1);

    for (const formations of [null, [], "formation"]) {
      expect(() => encounterFormations({ ...legacy, formations })).toThrow("invalid-formations");
    }
    for (const version of [null, 4]) {
      expect(() => encounterFormations({ ...legacy, formations: { version } }))
        .toThrow("invalid-formation-version");
    }
  });
});

describe("legal anchors", () => {
  it("limits melee to the nearest living enemy rank and exposes the next rank when it falls", () => {
    const formations = {
      player: [null, null, null, null, null, null, null, null, "player-0"],
      enemy: [null, null, "front", null, "middle", null, null, null, "rear"],
    };
    const state = battle({ allies: [], enemies: ["front", "middle", "rear"], formations });

    expect(legalSkillAnchors(state, "strike")).toEqual([{ side: "enemy", index: 2 }]);
    expect(resolveSkillTargets(state, "strike", state.playerId, {
      anchorCell: { side: "enemy", index: 4 },
    })).toMatchObject({ ok: false, reason: "invalid-target" });

    const exposed = {
      ...state,
      actors: { ...state.actors, front: { ...state.actors.front, hp: 0 } },
    };
    expect(legalSkillAnchors(exposed, "strike"))
      .toEqual([{ side: "enemy", index: 4 }]);
  });

  it("locks new melee reach to the foremost living unit in each independent column", () => {
    const formations = {
      version: 3,
      player: [null, null, null, null, null, null, null, null, "player-0"],
      enemy: [
        "column-0-front", null, null,
        "column-0-middle", "column-1-middle", null,
        "column-0-rear", "column-1-rear", "column-2-rear",
      ],
    };
    const enemies = [
      "column-0-front",
      "column-0-middle",
      "column-1-middle",
      "column-0-rear",
      "column-1-rear",
      "column-2-rear",
    ];
    const state = battle({ allies: [], enemies, formations });

    expect(legalSkillAnchors(state, "strike")).toEqual([
      { side: "enemy", index: 0 },
      { side: "enemy", index: 4 },
      { side: "enemy", index: 8 },
    ]);
    expect(resolveSkillTargets(state, "strike", state.playerId, {
      anchorCell: { side: "enemy", index: 7 },
    })).toMatchObject({ ok: false, reason: "invalid-target" });

    const exposed = {
      ...state,
      actors: {
        ...state.actors,
        "column-0-front": { ...state.actors["column-0-front"], hp: 0 },
      },
    };
    expect(legalSkillAnchors(exposed, "strike")).toEqual([
      { side: "enemy", index: 3 },
      { side: "enemy", index: 4 },
      { side: "enemy", index: 8 },
    ]);
  });

  it("allows an empty ranged area anchor only when its footprint reaches a living target", () => {
    const state = battle({
      allies: [],
      formations: {
        player: ["player-0", null, null, null, null, null, null, null, null],
        enemy: [null, null, null, null, "enemy-0", null, null, null, null],
      },
    });

    expect(legalSkillAnchors(state, "north-king-whirlwind"))
      .toEqual([3, 4, 5].map((index) => ({ side: "enemy", index })));
    expect(resolveSkillTargets(state, "north-king-whirlwind", state.playerId, {
      anchorCell: { side: "enemy", index: 3 },
    })).toMatchObject({
      ok: true,
      anchorCell: { side: "enemy", index: 3 },
      targetIds: ["enemy-0"],
    });
    expect(legalSkillAnchors(state, "demon-shoot"))
      .toEqual([{ side: "enemy", index: 4 }]);
  });
});

describe("footprint resolution", () => {
  const cases = [
    ["north-king-whirlwind", 4, [3, 4, 5]],
    ["mage-destruction-ray", 4, [1, 4, 7]],
    ["clocktower-grenade-toss", 0, [0, 1, 3]],
    ["clocktower-chain-explosion", 0, [0, 1, 2, 3, 6]],
    ["demon-arrow-rain", 4, [0, 1, 2, 3, 4, 5, 6, 7, 8]],
  ];

  it.each(cases)("resolves %s from anchor %i in canonical cell order", (
    skillId,
    anchor,
    expectedCells,
  ) => {
    const enemies = Array.from({ length: 9 }, (_, index) => `enemy-${index}`);
    const state = battle({ allies: [], enemies });
    const resolved = resolveSkillTargets(state, skillId, state.playerId, {
      anchorCell: { side: "enemy", index: anchor },
    });

    expect(resolved.ok).toBe(true);
    expect(cells(resolved)).toEqual(expectedCells);
    expect(resolved.targetIds).toEqual(expectedCells.map((index) => `enemy-${index}`));
  });

  it("highlights and resolves both formations for a true all-combatants effect", () => {
    const state = battle({ enemies: ["enemy-0", "enemy-1"] });
    const resolved = resolveSkillTargets(state, "north-king-natures-intervention");

    expect(resolved).toMatchObject({
      ok: true,
      anchorCell: { side: "player", index: 4 },
      primaryTargetId: "player-0",
      targetIds: ["player-0", "ally-0", "ally-1", "enemy-0", "enemy-1"],
    });
    expect(resolved.affectedCells).toEqual([
      ...Array.from({ length: 9 }, (_, index) => ({ side: "player", index })),
      ...Array.from({ length: 9 }, (_, index) => ({ side: "enemy", index })),
    ]);
  });
});

describe("self, ally, and rejected targets", () => {
  const formations = {
    player: ["ally-1", null, null, null, "ally-0", null, null, null, "player-0"],
    enemy: [null, null, null, null, "enemy-0", null, null, null, null],
  };

  it("keeps self skills on the caster while ally skills can select caster or companion", () => {
    const state = battle({ formations });

    expect(legalSkillAnchors(state, "arctic-block"))
      .toEqual([{ side: "player", index: 8 }]);
    expect(resolveSkillTargets(state, "arctic-block")).toMatchObject({
      ok: true,
      sourceCell: { side: "player", index: 8 },
      anchorCell: { side: "player", index: 8 },
      targetIds: ["player-0"],
    });

    expect(legalSkillAnchors(state, "priestess-greater-heal"))
      .toEqual([0, 4, 8].map((index) => ({ side: "player", index })));
    expect(resolveSkillTargets(state, "priestess-greater-heal", state.playerId, {
      anchorCell: { side: "player", index: 4 },
    })).toMatchObject({ ok: true, targetIds: ["ally-0"], primaryTargetId: "ally-0" });
    expect(resolveSkillTargets(state, "priestess-greater-heal", state.playerId, {
      targetId: "player-0",
    })).toMatchObject({ ok: true, targetIds: ["player-0"], primaryTargetId: "player-0" });
  });

  it("maps a valid legacy target id to its custom cell", () => {
    const state = battle({ formations });
    expect(resolveSkillTargets(state, "demon-shoot", state.playerId, {
      targetId: "enemy-0",
    })).toMatchObject({
      ok: true,
      anchorCell: { side: "enemy", index: 4 },
      targetIds: ["enemy-0"],
      primaryTargetId: "enemy-0",
    });
  });

  it.each([
    { side: "player", index: 8 },
    { side: "enemy", index: -1 },
    { side: "enemy", index: 9 },
    { side: "enemy", index: 4.5 },
  ])("rejects an off-side or invalid anchor $side:$index", (anchorCell) => {
    const state = battle({ formations });
    expect(resolveSkillTargets(state, "demon-shoot", state.playerId, { anchorCell }))
      .toMatchObject({ ok: false, reason: "invalid-target" });
  });
});
