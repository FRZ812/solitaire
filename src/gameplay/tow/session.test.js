import { describe, expect, it } from "vitest";
import { createRng } from "../kernel/rng.js";
import {
  TOW_RNG_STREAMS,
  TOW_RULESET_ID,
  createTowSession,
  deriveSeedManifest,
  encounterFromGenesis,
  isTowSession,
  markTowSessionSettled,
  participantIsLethal,
  towCombatContext,
  towSessionChecksum,
  towStreamEndpoints,
} from "./session.js";

function player(overrides = {}) {
  return {
    id: "wanderer",
    name: "Wanderer",
    maxHp: 170,
    stats: { attack: 12, defense: 13, critRate: 0, dodgeRate: 0 },
    ...overrides,
  };
}

function foe(overrides = {}) {
  return {
    id: "foe-0",
    name: "Bandit",
    maxHp: 40,
    stats: { attack: 9, defense: 0, critRate: 0, dodgeRate: 0 },
    attacks: [{ id: "jab", name: "Jab", hits: 1, damage: 6 }],
    ...overrides,
  };
}

function open(overrides = {}) {
  return createTowSession({
    sessionId: "combat-1",
    rootSeed: "seed-1",
    player: player(overrides.player),
    enemies: overrides.enemies || [foe()],
    build: { traits: {}, skills: ["strike", "block"], ...overrides.build },
    context: overrides.context,
    ...(overrides.mode ? { mode: overrides.mode } : {}),
  });
}

describe("opening a session", () => {
  it("produces a valid, active session pinned to the ruleset", () => {
    const opened = open();
    expect(opened.ok).toBe(true);
    expect(isTowSession(opened.session)).toBe(true);
    expect(opened.session.rulesetId).toBe(TOW_RULESET_ID);
    expect(opened.session.status).toBe("active");
    expect(opened.session.revision).toBe(0);
    expect(opened.session.commands).toEqual([]);
    expect(opened.session.terminalReceipt).toBe(null);
    expect(opened.session.settlementId).toBe(null);
  });

  it("carries the context the encounter deliberately does not know", () => {
    const opened = open({
      context: {
        location: "The Broken Wheel",
        lethalPolicy: "nonlethal",
        source: { kind: "narrator", note: "a barfight" },
        participantBindings: { "foe-0": { campaignEntityId: "npc-hale", lethal: null } },
      },
    });
    expect(opened.session.context.location).toBe("The Broken Wheel");
    expect(opened.session.context.participantBindings["foe-0"].campaignEntityId).toBe("npc-hale");
    expect(opened.session.context.source.note).toBe("a barfight");
  });

  it("rejects a binding for an actor that is not in the fight", () => {
    // Usually means the codex ids and the actor ids were built from different lists, which
    // would write the wrong person's death into the world at settlement.
    const opened = open({
      context: { participantBindings: { "foe-9": { campaignEntityId: "npc-hale", lethal: null } } },
    });
    expect(opened.ok).toBe(false);
    expect(opened.reason).toBe("unknown-participant-binding");
  });

  it("refuses an unusable id, seed, or mode", () => {
    expect(createTowSession({ sessionId: "", rootSeed: "s" }).reason).toBe("invalid-session-id");
    expect(createTowSession({ sessionId: "combat-1", rootSeed: null }).reason).toBe("invalid-session-seed");
    expect(createTowSession({ sessionId: "combat-1", rootSeed: "s", mode: "sandbox" }).reason)
      .toBe("invalid-session-mode");
  });

  it("refuses a fight with no foes before an encounter is ever built", () => {
    const opened = createTowSession({
      sessionId: "combat-1",
      rootSeed: "seed-1",
      player: player(),
      enemies: [],
      build: {},
    });
    expect(opened.ok).toBe(false);
    expect(opened.reason).toBe("invalid-session-genesis");
  });
});

describe("named randomness streams", () => {
  it("derives one seed per stream, by name", () => {
    const manifest = deriveSeedManifest("seed-1");
    expect(Object.keys(manifest).sort()).toEqual([...TOW_RNG_STREAMS].sort());
    expect(new Set(Object.values(manifest)).size).toBe(TOW_RNG_STREAMS.length);
  });

  it("gives every stream a different starting endpoint", () => {
    const endpoints = towStreamEndpoints(open().session);
    const states = Object.values(endpoints).map((rng) => rng.state);
    expect(new Set(states).size).toBe(states.length);
  });

  it("keeps a stream's seed independent of the other streams", () => {
    // The whole reason for deriving by name: adding a draw to intent later must not shift
    // what loot a player gets from the same root seed.
    const manifest = deriveSeedManifest("seed-1");
    expect(manifest.loot).toBe("seed-1::tow-stream::loot::v1");
    expect(createRng(manifest.loot)).toEqual(open().session.streams.loot);
  });
});

describe("genesis", () => {
  it("rebuilds the same opening encounter every time", () => {
    const { session } = open();
    const first = encounterFromGenesis(session.genesis);
    const second = encounterFromGenesis(session.genesis);
    expect(first).toEqual(second);
    expect(first).toEqual(session.encounter);
  });

  it("holds an empty intent schedule until the telegraph phase fills it", () => {
    expect(open().session.genesis.intentSchedules).toEqual({});
  });
});

describe("the admission's defaults", () => {
  it("assumes the safest reading of anything left unstated", () => {
    const context = towCombatContext();
    expect(context.lethalPolicy).toBe("nonlethal");
    expect(context.playerStakes).toBe("survivable");
    expect(context.retreatPolicy).toBe("forbidden");
  });

  it("lets a participant's own lethality override a mixed policy", () => {
    const context = towCombatContext({
      lethalPolicy: "mixed",
      participantBindings: {
        "foe-0": { campaignEntityId: null, lethal: true },
        "foe-1": { campaignEntityId: null, lethal: false },
      },
    });
    expect(participantIsLethal(context, "foe-0")).toBe(true);
    expect(participantIsLethal(context, "foe-1")).toBe(false);
    // No binding under a mixed policy is not lethal — the safe reading again.
    expect(participantIsLethal(context, "foe-2")).toBe(false);
  });

  it("follows the session policy where a participant states nothing", () => {
    const lethal = towCombatContext({
      lethalPolicy: "lethal",
      participantBindings: { "foe-0": { campaignEntityId: null, lethal: null } },
    });
    expect(participantIsLethal(lethal, "foe-0")).toBe(true);
  });
});

describe("integrity", () => {
  it("changes the checksum when anything durable changes", () => {
    const { session } = open();
    const edited = { ...session, revision: 1 };
    expect(towSessionChecksum(edited)).not.toBe(session.checksum);
  });

  it("ignores the checksum field itself when checksumming", () => {
    const { session } = open();
    expect(towSessionChecksum({ ...session, checksum: "integrity-v1:nonsense" }))
      .toBe(session.checksum);
  });
});

describe("settling the session", () => {
  it("refuses to settle a fight still in progress", () => {
    const { session } = open();
    const settled = markTowSessionSettled(session, "settle-1");
    expect(settled.ok).toBe(false);
    expect(settled.reason).toBe("encounter-not-terminal");
  });

  it("absorbs a repeat of the same settlement and refuses a different one", () => {
    const { session } = open();
    const terminal = { ...session, status: "terminal", encounter: { ...session.encounter, phase: "victory" } };
    const first = markTowSessionSettled(terminal, "settle-1");
    expect(first.ok).toBe(true);
    expect(first.session.status).toBe("settled");

    const again = markTowSessionSettled(first.session, "settle-1");
    expect(again).toMatchObject({ ok: true, duplicate: true });
    expect(again.session).toBe(first.session);

    const other = markTowSessionSettled(first.session, "settle-2");
    expect(other.ok).toBe(false);
    expect(other.reason).toBe("session-already-settled");
  });
});

describe("structural validation", () => {
  it("rejects a status that disagrees with the fight it holds", () => {
    const { session } = open();
    expect(isTowSession({ ...session, status: "terminal" })).toBe(false);
    expect(isTowSession({ ...session, status: "settled", settlementId: "s" })).toBe(false);
  });

  it("rejects a revision that does not match the command count", () => {
    const { session } = open();
    expect(isTowSession({ ...session, revision: 3 })).toBe(false);
  });

  it("rejects an unknown key", () => {
    const { session } = open();
    expect(isTowSession({ ...session, smuggled: true })).toBe(false);
  });
});
