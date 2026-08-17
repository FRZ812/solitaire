import { describe, expect, it } from "vitest";
import {
  dispatchTowCommand,
  towCommand,
  validateTowCommand,
} from "./commands.js";
import {
  createTowSession,
  encounterFromGenesis,
  isTowSession,
  sealTowSession,
} from "./session.js";
import { encounterFormations } from "./targeting.js";

function combatant(id, overrides = {}) {
  return {
    id,
    name: id,
    maxHp: 500,
    stats: { attack: 12, defense: 4, critRate: 0, dodgeRate: 0 },
    ...overrides,
  };
}

function open(formations = undefined) {
  const opened = createTowSession({
    sessionId: "spatial-compatibility",
    rootSeed: "spatial-seed",
    player: combatant("player-0"),
    allies: [combatant("ally-0", {
      build: { traits: {}, skills: ["strike", "arctic-block"] },
    })],
    enemies: [
      combatant("enemy-0", {
        attacks: [{ id: "jab", name: "Jab", hits: 1, damage: 1 }],
      }),
      combatant("enemy-1", {
        attacks: [{ id: "jab", name: "Jab", hits: 1, damage: 1 }],
      }),
    ],
    build: { traits: {}, skills: ["demon-shoot", "arctic-block"] },
    ...(formations ? { formations } : {}),
  });
  if (!opened.ok) throw new Error(opened.reason);
  return opened.session;
}

describe("formation session compatibility", () => {
  it.each([1, 2])("pins v%s custom formations in genesis and rebuilds the same cells", (version) => {
    const formations = {
      version,
      player: [null, null, "ally-0", null, null, null, null, null, "player-0"],
      enemy: [null, null, "enemy-0", null, null, null, null, null, "enemy-1"],
    };
    const session = open(formations);

    expect(session.genesis.formations).toEqual(formations);
    expect(session.encounter.formations).toEqual(formations);
    expect(encounterFromGenesis(session.genesis).formations).toEqual(formations);
    expect(isTowSession(session)).toBe(true);
  });

  it("continues to validate and deterministically target a formationless legacy session", () => {
    const session = open();
    const { formations: ignoredGenesisFormation, ...legacyGenesis } = session.genesis;
    const { formations: ignoredEncounterFormation, ...legacyEncounter } = session.encounter;
    expect(ignoredGenesisFormation).toBeTruthy();
    expect(ignoredEncounterFormation).toBeTruthy();

    const legacy = sealTowSession({
      ...session,
      genesis: legacyGenesis,
      encounter: legacyEncounter,
      checksum: null,
    });
    expect(isTowSession(legacy)).toBe(true);
    expect(encounterFromGenesis(legacy.genesis).formations).toBeUndefined();
    expect(encounterFormations(legacy.encounter)).toEqual({
      version: 1,
      player: ["player-0", "ally-0", null, null, null, null, null, null, null],
      enemy: ["enemy-0", "enemy-1", null, null, null, null, null, null, null],
    });
  });
});

describe("anchor command compatibility", () => {
  it("normalizes an anchor into a detached, exact durable shape", () => {
    const anchorCell = { side: "enemy", index: 8, transientHighlight: true };
    const command = towCommand({
      id: "shoot-1",
      expectedRevision: 0,
      type: "use-skill",
      actorId: "player-0",
      anchorCell,
      skillId: "demon-shoot",
      targetId: null,
      ignoredUiField: "preview",
    });

    expect(command).toEqual({
      id: "shoot-1",
      expectedRevision: 0,
      type: "use-skill",
      actorId: "player-0",
      anchorCell: { side: "enemy", index: 8 },
      itemId: null,
      skillId: "demon-shoot",
      targetId: null,
    });
    expect(command.anchorCell).not.toBe(anchorCell);
  });

  it("accepts a legacy command with neither item nor anchor fields", () => {
    const session = open();
    expect(validateTowCommand(session, {
      id: "legacy-end",
      expectedRevision: 0,
      type: "end-turn",
      actorId: "player-0",
      skillId: null,
      targetId: null,
    })).toEqual({ ok: true, reason: null });
  });

  it("records and resolves an anchor without requiring a legacy target id", () => {
    const session = open({
      version: 1,
      player: ["player-0", "ally-0", null, null, null, null, null, null, null],
      enemy: [null, null, null, null, null, null, null, null, "enemy-1"],
    });
    const result = dispatchTowCommand(session, {
      id: "shoot-anchor",
      expectedRevision: 0,
      type: "use-skill",
      actorId: "player-0",
      anchorCell: { side: "enemy", index: 8 },
      skillId: "demon-shoot",
      targetId: null,
    });

    expect(result.ok).toBe(true);
    expect(result.command.anchorCell).toEqual({ side: "enemy", index: 8 });
    expect(result.events).toContainEqual(expect.objectContaining({
      type: "skill-committed",
      anchorCell: { side: "enemy", index: 8 },
      targetIds: ["enemy-1"],
    }));
  });
});
