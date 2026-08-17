import { describe, expect, it } from "vitest";
import { reflowTowFormations } from "./movement.js";

function formation(entries = {}) {
  return Array.from({ length: 9 }, (_, cell) => entries[cell] || null);
}

function actor(id, hp = 100) {
  return { id, hp };
}

function build(...ids) {
  return { skills: ids.map((id) => ({ id })) };
}

function state({
  version = 2,
  player = formation({ 6: "player" }),
  enemy = formation({ 6: "enemy" }),
  allies = [],
  enemies = ["enemy"],
  actors = null,
  playerBuild = build("arctic-mortal-blow"),
  allyBuilds = {},
  enemyBuilds = { enemy: build("arctic-mortal-blow") },
} = {}) {
  const ids = ["player", ...allies, ...enemies];
  return {
    playerId: "player",
    allyIds: allies,
    enemyIds: enemies,
    actors: actors || Object.fromEntries(ids.map((id) => [id, actor(id)])),
    build: playerBuild,
    allyBuilds,
    enemyBuilds,
    formations: { version, player, enemy },
  };
}

describe("v2 round-boundary formation reflow", () => {
  it("moves each living actor one same-column step toward its hostile posture", () => {
    const input = state({
      player: formation({ 1: "ranger", 6: "player", 8: "support" }),
      allies: ["ranger", "support"],
      actors: {
        player: actor("player"),
        ranger: actor("ranger"),
        support: actor("support"),
        enemy: actor("enemy"),
      },
      allyBuilds: {
        ranger: build("clocktower-grenade-toss"),
        support: build("arctic-gather-strength"),
      },
    });
    const original = structuredClone(input);

    const result = reflowTowFormations(input);

    expect(result.moves).toEqual([
      { actorId: "player", side: "player", fromCell: 6, toCell: 3 },
      { actorId: "ranger", side: "player", fromCell: 1, toCell: 4 },
      { actorId: "enemy", side: "enemy", fromCell: 6, toCell: 3 },
    ]);
    expect(result.formations.player).toEqual([
      null, null, null,
      "player", "ranger", null,
      null, null, "support",
    ]);
    expect(result.formations.enemy[3]).toBe("enemy");
    expect(input).toEqual(original);
  });

  it("uses immutable roster order when opposite postures claim the same vacancy", () => {
    const input = state({
      player: formation({ 0: "player", 6: "ally" }),
      enemy: formation({ 0: "enemy" }),
      allies: ["ally"],
      actors: { player: actor("player"), ally: actor("ally"), enemy: actor("enemy") },
      playerBuild: build("clocktower-grenade-toss"),
      allyBuilds: { ally: build("arctic-mortal-blow") },
      enemyBuilds: { enemy: build("arctic-gather-strength") },
    });

    const result = reflowTowFormations(input);

    expect(result.moves).toEqual([
      { actorId: "player", side: "player", fromCell: 0, toCell: 3 },
    ]);
    expect(result.formations.player[3]).toBe("player");
    expect(result.formations.player[6]).toBe("ally");
  });

  it("does not swap, follow through an occupied cell, or enter a defeated actor's cell", () => {
    const blocked = state({
      player: formation({ 3: "fallen", 6: "player" }),
      allies: ["fallen"],
      actors: { player: actor("player"), fallen: actor("fallen", 0), enemy: actor("enemy") },
      allyBuilds: { fallen: build("clocktower-grenade-toss") },
      enemyBuilds: { enemy: build("arctic-gather-strength") },
    });
    expect(reflowTowFormations(blocked)).toEqual({
      formations: blocked.formations,
      moves: [],
    });

    const swap = state({
      player: formation({ 3: "ally", 6: "player" }),
      allies: ["ally"],
      actors: { player: actor("player"), ally: actor("ally"), enemy: actor("enemy") },
      allyBuilds: { ally: build("clocktower-grenade-toss") },
      enemyBuilds: { enemy: build("arctic-gather-strength") },
    });
    expect(reflowTowFormations(swap).moves).toEqual([]);
  });

  it("moves mixed hostile loadouts toward middle and ignores fixed or support-only actions", () => {
    const mixed = state({
      player: formation({ 0: "player", 6: "fixed", 8: "support" }),
      allies: ["fixed", "support"],
      actors: {
        player: actor("player"),
        fixed: actor("fixed"),
        support: actor("support"),
        enemy: actor("enemy"),
      },
      playerBuild: build("arctic-mortal-blow", "clocktower-grenade-toss"),
      allyBuilds: {
        fixed: build("strike", "block"),
        support: build("arctic-gather-strength"),
      },
      enemyBuilds: { enemy: build("arctic-gather-strength") },
    });

    const result = reflowTowFormations(mixed);

    expect(result.moves).toEqual([
      { actorId: "player", side: "player", fromCell: 0, toCell: 3 },
    ]);
    expect(result.formations.player[6]).toBe("fixed");
    expect(result.formations.player[8]).toBe("support");
  });

  it("leaves static v1 formations byte-identical", () => {
    const input = state({ version: 1 });
    const result = reflowTowFormations(input);

    expect(result).toEqual({ formations: input.formations, moves: [] });
    expect(result.formations).toBe(input.formations);
  });
});
