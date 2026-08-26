import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import { gameplayChecksum } from "../kernel/replay.js";
import { decodeTowSession, encodeTowSession } from "./persistence.js";
import {
  decodeTowRuntimeSession,
  encodeTowRuntimeSession,
} from "./runtime.js";
import {
  encounterFromGenesis,
  isTowSession,
  towSessionChecksum,
} from "./session.js";

// This file is deliberately read as raw text instead of imported as a module. The fixture
// is an archaeological sample, not a factory: production code must continue to accept and
// replay these exact bytes. Never regenerate it from current rules in this test.
const fixtureUrl = new URL("./fixtures/legacy-v1-golden.json", import.meta.url);
const rawFixture = readFileSync(fixtureUrl, "utf8");
const golden = JSON.parse(rawFixture);

const LEGACY_COMMAND_KEYS = [
  "actorId",
  "eventsFrom",
  "eventsTo",
  "expectedRevision",
  "id",
  "seq",
  "skillId",
  "stateChecksum",
  "streams",
  "targetId",
  "type",
];
const CURRENT_COMMAND_KEYS = [
  "actorId",
  "anchorCell",
  "eventsFrom",
  "eventsTo",
  "expectedRevision",
  "id",
  "itemId",
  "seq",
  "skillId",
  "stateChecksum",
  "streams",
  "targetId",
  "type",
];

function fixtureCase(id) {
  const entry = golden.cases.find((candidate) => candidate.id === id);
  if (!entry) throw new Error(`missing-golden-case:${id}`);
  return entry;
}

describe("raw Tower v1 replay goldens", () => {
  it("keeps the committed JSON byte-exact and canonical", () => {
    expect(createHash("sha256").update(rawFixture).digest("hex"))
      .toBe("1c6b17e7c59676815dfa1c519c18bb4f4485d7ea9dd87228752763b102a5465d");
    expect(rawFixture).toBe(`${JSON.stringify(golden, null, 2)}\n`);
    expect(golden).toMatchObject({
      format: "solitaire-tow-v1-golden",
      fixtureVersion: 1,
    });
    expect(golden.cases.map(({ id }) => id)).toEqual([
      "formationless-legacy",
      "static-formation-v1-anchor",
      "moving-formation-v2",
    ]);
  });

  it.each(golden.cases)("preserves $id but rejects its retired runtime identity", ({ expected, session }) => {
    const decoded = decodeTowSession(session);
    const encoded = encodeTowSession(session);
    expect(isTowSession(session)).toBe(false);
    expect(decoded).toEqual({
      ok: false,
      reason: "unsupported-tow-ruleset",
      session: null,
    });
    expect(encoded).toEqual({
      ok: false,
      reason: "unsupported-tow-ruleset",
      payload: null,
    });
    expect(decodeTowRuntimeSession(session)).toEqual({
      ok: false,
      reason: "unsupported-legacy-tow-runtime",
      session: null,
    });
    expect(encodeTowRuntimeSession(session)).toEqual({
      ok: false,
      reason: "unsupported-legacy-tow-runtime",
      payload: null,
    });

    expect(gameplayChecksum(session.genesis)).toBe(expected.genesisChecksum);
    expect(gameplayChecksum(session.encounter)).toBe(expected.encounterChecksum);
    expect(towSessionChecksum(session)).toBe(expected.sessionChecksum);
    expect(session.checksum).toBe(expected.sessionChecksum);
    expect(session.commands.map(({ eventsFrom, eventsTo }) => [eventsFrom, eventsTo]))
      .toEqual(expected.eventRanges);
    expect(session.commands.map(({ stateChecksum }) => stateChecksum))
      .toEqual(expected.stateChecksums);
    expect(session.commands.at(-1).eventsTo).toBe(session.encounter.sequence);
  });

  it("preserves the formationless genesis and legacy command record", () => {
    const { session } = fixtureCase("formationless-legacy");
    expect(Object.hasOwn(session.genesis, "formations")).toBe(false);
    expect(Object.hasOwn(session.encounter, "formations")).toBe(false);
    expect(Object.hasOwn(encounterFromGenesis(session.genesis), "formations")).toBe(false);
    expect(Object.keys(session.commands[0]).sort()).toEqual(LEGACY_COMMAND_KEYS);
    expect(session.commands[0]).toMatchObject({
      type: "use-skill",
      skillId: "strike",
      targetId: "foe-0",
      eventsFrom: 1,
      eventsTo: 3,
    });
  });

  it("pins static v1 targeting and moving v2 reflow under the same v1 ruleset", () => {
    const anchored = fixtureCase("static-formation-v1-anchor").session;
    const moving = fixtureCase("moving-formation-v2").session;

    expect(anchored.rulesetId).toBe("solitaire-tow-v1");
    expect(anchored.genesis.formations.version).toBe(1);
    expect(anchored.encounter.formations).toEqual(anchored.genesis.formations);
    expect(Object.keys(anchored.commands[0]).sort()).toEqual(CURRENT_COMMAND_KEYS);
    expect(anchored.commands[0].anchorCell).toEqual({ side: "enemy", index: 8 });
    expect(anchored.encounter.events).toContainEqual(expect.objectContaining({
      type: "skill-committed",
      anchorCell: { side: "enemy", index: 8 },
      targetIds: ["foe-0"],
    }));

    expect(moving.rulesetId).toBe("solitaire-tow-v1");
    expect(moving.genesis.formations.version).toBe(2);
    expect(moving.genesis.formations.player[0]).toBe("wanderer");
    expect(moving.encounter.formations.player[3]).toBe("wanderer");
    expect(Object.keys(moving.commands[0]).sort()).toEqual(CURRENT_COMMAND_KEYS);
    expect(moving.commands[0].anchorCell).toBe(null);
    expect(moving.encounter.events).toContainEqual(expect.objectContaining({
      type: "formation-moved",
      moves: [{
        actorId: "wanderer",
        side: "player",
        fromCell: 0,
        toCell: 3,
      }],
    }));
  });
});
