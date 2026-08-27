import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { makeInitialState } from "../../data/initial-state.js";
import {
  dispatchTowCommand,
  dispatchTowPlayerAction,
  towSessionEvents,
} from "./commands.js";
import { sealTowTerminalReceipt, worldFatesByParticipant } from "./outcomes.js";
import { decodeTowSession, encodeTowSession } from "./persistence.js";
import { replayTowCombatSession, verifyTowSession } from "./replay.js";
import {
  TOW_RUNTIME_IDENTITIES,
  TOW_RUNTIME_REASONS,
  TOW_V1_RUNTIME_IDENTITY,
  createTowRuntimeStreamSequencer,
  createTowRuntimeSession,
  decodeTowRuntimeSession,
  dispatchTowRuntimeCommand,
  dispatchTowRuntimePlayerAction,
  encodeTowRuntimeSession,
  markTowRuntimeSessionSettled,
  replayTowRuntimeSession,
  sealTowRuntimeTerminalReceipt,
  settleTowRuntimeEncounter,
  spendTowRuntimeSessionStream,
  supportsTowRuntime,
  towRuntimeSessionEvents,
  towRuntimeIdentity,
  towRuntimeRegistrationKey,
  towRuntimeWorldFates,
  verifyTowRuntimeSession,
} from "./runtime.js";
import {
  TOW_RULESET_ID,
  TOW_SESSION_VERSION,
  createTowSession,
  markTowSessionSettled,
  spendTowSessionStream,
  streamSequencer,
  towSessionChecksum,
} from "./session.js";
import { settleTowEncounter } from "./settlement.js";

function sessionInput(overrides = {}) {
  return {
    sessionId: "runtime-v1-fight",
    rootSeed: "runtime-v1-seed",
    player: {
      id: "wanderer",
      name: "Wanderer",
      maxHp: 80,
      stats: { attack: 250, defense: 5, critRate: 0, dodgeRate: 0 },
    },
    enemies: [{
      id: "brigand",
      name: "Brigand",
      maxHp: 10,
      stats: { attack: 2, defense: 0, critRate: 0, dodgeRate: 0 },
      attacks: [{ id: "jab", name: "Jab", hits: 1, damage: 2 }],
    }],
    build: { traits: {}, skills: ["strike", "block"] },
    formations: {
      // A formation schema version is nested gameplay data, never a runtime selector.
      version: 2,
      player: ["wanderer", null, null, null, null, null, null, null, null],
      enemy: ["brigand", null, null, null, null, null, null, null, null],
    },
    ...overrides,
  };
}

function openSession(overrides = {}) {
  const opened = createTowSession(sessionInput(overrides));
  if (!opened.ok) throw new Error(opened.reason);
  return opened.session;
}

function strikeInput(session, id = "runtime-strike") {
  return {
    id,
    expectedRevision: session.revision,
    type: "use-skill",
    actorId: "wanderer",
    skillId: "strike",
    targetId: "brigand",
  };
}

function terminalSession(overrides = {}) {
  const session = openSession(overrides);
  const result = dispatchTowCommand(session, strikeInput(session));
  if (!result.ok || result.session.status !== "terminal") {
    throw new Error(result.reason || "fixture-did-not-end-fight");
  }
  return result.session;
}

describe("Tower runtime registration", () => {
  it("keeps core runtime implementations pointing into the facade, never back out of it", () => {
    const implementationFiles = [
      "commands.js",
      "outcomes.js",
      "persistence.js",
      "replay.js",
      "session.js",
      "settlement.js",
    ];
    for (const name of implementationFiles) {
      const source = readFileSync(new URL(name, import.meta.url), "utf8");
      expect(source, name).not.toMatch(/from\s+["']\.\/runtime\.js["']/);
    }
  });

  it("keeps production session-lifecycle consumers behind the runtime facade", () => {
    const consumers = [
      ["App.jsx", new URL("../../App.jsx", import.meta.url)],
      ["CombatLab.jsx", new URL("../../components/combat/CombatLab.jsx", import.meta.url)],
      ["PracticeFight.jsx", new URL("../../components/creation/PracticeFight.jsx", import.meta.url)],
      ["practice-scenarios.js", new URL("./practice-scenarios.js", import.meta.url)],
    ];
    const directLifecycleImport = /from\s+["'](?:\.\/(?:commands|outcomes|persistence|replay|session|settlement)|(?:\.\.\/|\.\/)*gameplay\/tow\/(?:commands|outcomes|persistence|replay|session|settlement))\.js["']/;

    for (const [name, url] of consumers) {
      const source = readFileSync(url, "utf8");
      expect(source, name).not.toMatch(directLifecycleImport);
      expect(source, name).toMatch(/runtime\.js["']/);
    }
  });

  it("publishes one immutable exact v1 pair and a collision-free registration key", () => {
    expect(TOW_V1_RUNTIME_IDENTITY).toEqual({
      version: TOW_SESSION_VERSION,
      rulesetId: TOW_RULESET_ID,
    });
    expect(Object.isFrozen(TOW_V1_RUNTIME_IDENTITY)).toBe(true);
    expect(Object.isFrozen(TOW_RUNTIME_IDENTITIES)).toBe(true);
    expect(TOW_RUNTIME_IDENTITIES).toEqual([TOW_V1_RUNTIME_IDENTITY]);
    expect(towRuntimeRegistrationKey(TOW_V1_RUNTIME_IDENTITY))
      .toBe(JSON.stringify([TOW_SESSION_VERSION, TOW_RULESET_ID]));
  });

  it("gives archived v1 fights a dedicated update boundary", () => {
    const legacyIdentity = { version: 1, rulesetId: "solitaire-tow-v1" };
    const legacySession = { ...openSession(), ...legacyIdentity };

    expect(TOW_RULESET_ID).not.toBe(legacyIdentity.rulesetId);
    expect(supportsTowRuntime(legacyIdentity)).toBe(false);
    expect(decodeTowRuntimeSession(legacySession)).toEqual({
      ok: false,
      reason: TOW_RUNTIME_REASONS.legacyRuntime,
      session: null,
    });
  });

  it("retires v1.1 before source-correct General mechanics become current", () => {
    const retiredIdentity = { version: 1, rulesetId: "solitaire-tow-v1.1" };
    const retiredSession = { ...openSession(), ...retiredIdentity };

    expect(TOW_RULESET_ID).toBe("solitaire-tow-v1.4");
    expect(supportsTowRuntime(retiredIdentity)).toBe(false);
    expect(decodeTowRuntimeSession(retiredSession)).toEqual({
      ok: false,
      reason: TOW_RUNTIME_REASONS.legacyRuntime,
      session: null,
    });
  });

  it("retires v1.2 before source-authored uncapped mechanics become current", () => {
    const retiredIdentity = { version: 1, rulesetId: "solitaire-tow-v1.2" };
    const retiredSession = { ...openSession(), ...retiredIdentity };

    expect(TOW_RULESET_ID).toBe("solitaire-tow-v1.4");
    expect(supportsTowRuntime(retiredIdentity)).toBe(false);
    expect(decodeTowRuntimeSession(retiredSession)).toEqual({
      ok: false,
      reason: TOW_RUNTIME_REASONS.legacyRuntime,
      session: null,
    });
  });

  it("retires v1.3 before free-basic Resolve recovery becomes current", () => {
    const retiredIdentity = { version: 1, rulesetId: "solitaire-tow-v1.3" };
    const retiredSession = { ...openSession(), ...retiredIdentity };

    expect(TOW_RULESET_ID).toBe("solitaire-tow-v1.4");
    expect(supportsTowRuntime(retiredIdentity)).toBe(false);
    expect(decodeTowRuntimeSession(retiredSession)).toEqual({
      ok: false,
      reason: TOW_RUNTIME_REASONS.legacyRuntime,
      session: null,
    });
  });

  it("requires both selectors and does not infer a runtime from formation data or ids", () => {
    expect(towRuntimeIdentity({ version: 1 })).toBe(null);
    expect(towRuntimeIdentity({ rulesetId: TOW_RULESET_ID })).toBe(null);
    expect(towRuntimeRegistrationKey({ version: "1", rulesetId: TOW_RULESET_ID })).toBe(null);
    expect(supportsTowRuntime({ genesis: { formations: { version: 1 } } })).toBe(false);
    expect(supportsTowRuntime({ id: TOW_RULESET_ID })).toBe(false);

    const opened = openSession();
    expect(opened.genesis.formations.version).toBe(2);
    expect(supportsTowRuntime(opened)).toBe(true);
  });

  it.each([
    [{ version: 2, rulesetId: TOW_RULESET_ID }, "future session with old ruleset"],
    [{ version: 1, rulesetId: "solitaire-tow-v2" }, "old session with future ruleset"],
    [{ version: 2, rulesetId: "solitaire-tow-v2" }, "unregistered future pair"],
    [{ version: 77, rulesetId: "unknown" }, "unknown pair"],
  ])("rejects the %s pair (%s) instead of falling through to v1", (identity) => {
    expect(supportsTowRuntime(identity)).toBe(false);
    expect(createTowRuntimeSession(identity, sessionInput())).toEqual({
      ok: false,
      reason: TOW_RUNTIME_REASONS.unsupportedRuntime,
      session: null,
    });
    expect(decodeTowRuntimeSession({ ...openSession(), ...identity })).toEqual({
      ok: false,
      reason: TOW_RUNTIME_REASONS.unsupportedRuntime,
      session: null,
    });
  });

  it("distinguishes malformed or missing identity from a well-formed unsupported pair", () => {
    expect(createTowRuntimeSession({}, sessionInput()).reason)
      .toBe(TOW_RUNTIME_REASONS.invalidIdentity);
    expect(decodeTowRuntimeSession(null)).toEqual({
      ok: false,
      reason: TOW_RUNTIME_REASONS.invalidIdentity,
      session: null,
    });
  });

  it("rejects accessor identity selectors without executing them", () => {
    let reads = 0;
    const payload = {};
    Object.defineProperties(payload, {
      version: {
        enumerable: true,
        get() {
          reads += 1;
          return TOW_SESSION_VERSION;
        },
      },
      rulesetId: {
        enumerable: true,
        get() {
          reads += 1;
          return TOW_RULESET_ID;
        },
      },
    });

    expect(decodeTowRuntimeSession(payload)).toEqual({
      ok: false,
      reason: TOW_RUNTIME_REASONS.invalidIdentity,
      session: null,
    });
    expect(reads).toBe(0);
  });

  it("translates identity descriptor failures into a stable rejection", () => {
    const payload = new Proxy({}, {
      getOwnPropertyDescriptor() {
        throw new Error("descriptor-ran");
      },
    });

    expect(decodeTowRuntimeSession(payload)).toEqual({
      ok: false,
      reason: TOW_RUNTIME_REASONS.invalidIdentity,
      session: null,
    });
  });
});

describe("v1 runtime compatibility", () => {
  it("creates the exact v1 serialized session without putting selectors into creation input", () => {
    const direct = createTowSession(sessionInput());
    const routed = createTowRuntimeSession(TOW_V1_RUNTIME_IDENTITY, sessionInput());

    expect(routed).toEqual(direct);
    expect(Object.keys(routed.session).sort()).toEqual(Object.keys(direct.session).sort());
  });

  it("decodes and encodes byte-compatible v1 payloads", () => {
    const session = openSession();
    expect(decodeTowRuntimeSession(session)).toEqual(decodeTowSession(session));
    expect(encodeTowRuntimeSession(session)).toEqual(encodeTowSession(session));
  });

  it("rejects a structurally valid runtime payload that diverges from its replay", () => {
    const session = openSession();
    const blocked = dispatchTowCommand(session, {
      id: "runtime-block",
      expectedRevision: 0,
      type: "use-skill",
      actorId: "wanderer",
      skillId: "block",
      targetId: "wanderer",
    });
    expect(blocked.ok).toBe(true);
    const tampered = JSON.parse(JSON.stringify(blocked.session));
    tampered.encounter.actors.wanderer.hp -= 1;
    tampered.checksum = towSessionChecksum(tampered);
    expect(decodeTowSession(tampered).ok).toBe(true);

    expect(decodeTowRuntimeSession(tampered)).toMatchObject({
      ok: false,
      reason: "replay-state-divergence",
      session: null,
    });
    expect(encodeTowRuntimeSession(tampered)).toEqual({
      ok: false,
      reason: "replay-state-divergence",
      payload: null,
    });
  });

  it("rejects a replay-valid practice victory before campaign settlement", () => {
    const terminal = terminalSession({ mode: "practice" });
    const sealed = sealTowRuntimeTerminalReceipt(terminal);
    expect(sealed.ok).toBe(true);
    expect(sealed.session.mode).toBe("practice");
    expect(verifyTowRuntimeSession(sealed.session).ok).toBe(true);
    const state = makeInitialState();
    const before = JSON.stringify(state);

    expect(settleTowRuntimeEncounter(state, sealed.session, {
      encounterId: sealed.session.sessionId,
    })).toEqual({
      ok: false,
      reason: "campaign-session-required",
      state,
      receipt: null,
      duplicate: false,
    });
    expect(JSON.stringify(state)).toBe(before);
  });

  it("rejects practice authority relabeled as campaign even after recomputing its checksum", () => {
    const sealed = sealTowRuntimeTerminalReceipt(terminalSession({ mode: "practice" }));
    const forged = JSON.parse(JSON.stringify(sealed.session));
    forged.mode = "campaign";
    forged.checksum = towSessionChecksum(forged);
    const state = makeInitialState();
    const before = JSON.stringify(state);

    expect(verifyTowRuntimeSession(forged).ok).toBe(false);
    expect(settleTowRuntimeEncounter(state, forged)).toMatchObject({
      ok: false,
      state,
      receipt: null,
      duplicate: false,
    });
    expect(JSON.stringify(state)).toBe(before);
  });

  it("derives settlement identity from the sealed session and deduplicates caller aliases", () => {
    const sealed = sealTowRuntimeTerminalReceipt(terminalSession()).session;
    const state = makeInitialState();

    const first = settleTowRuntimeEncounter(state, sealed, { encounterId: "forged-alias-a" });
    expect(first).toMatchObject({
      ok: true,
      receipt: { sessionId: sealed.sessionId },
      duplicate: false,
    });
    const second = settleTowRuntimeEncounter(first.state, sealed, { encounterId: "forged-alias-b" });
    expect(second).toMatchObject({
      ok: false,
      reason: "tow-encounter-already-settled",
      receipt: { sessionId: sealed.sessionId },
      duplicate: true,
    });
    expect(second.state).toBe(first.state);
  });

  it("refuses replay-divergent Resolve before settlement changes campaign state", () => {
    const tampered = JSON.parse(JSON.stringify(terminalSession({
      player: {
        ...sessionInput().player,
        resolve: 6,
        resolveMax: 6,
        resolveRegen: 1,
      },
    })));
    tampered.encounter.actors.wanderer.resolve = 5;
    tampered.checksum = towSessionChecksum(tampered);
    expect(decodeTowSession(tampered).ok).toBe(true);
    const state = makeInitialState();
    const before = JSON.stringify(state);

    expect(settleTowRuntimeEncounter(state, tampered, { encounterId: tampered.sessionId }))
      .toEqual({
        ok: false,
        reason: "replay-state-divergence",
        state,
        receipt: null,
        duplicate: false,
      });
    expect(JSON.stringify(state)).toBe(before);
  });

  it("dispatches low-level and App-facing player commands exactly as v1", () => {
    const session = openSession();
    const command = strikeInput(session);

    expect(dispatchTowRuntimeCommand(session, command))
      .toEqual(dispatchTowCommand(session, command));
    expect(dispatchTowRuntimePlayerAction(session, command))
      .toEqual(dispatchTowPlayerAction(session, command));
  });

  it("replays and verifies through the same v1 implementation", () => {
    const session = terminalSession();
    expect(replayTowRuntimeSession(session))
      .toEqual(replayTowCombatSession(session.genesis, session.commands));
    expect(verifyTowRuntimeSession(session)).toEqual(verifyTowSession(session));
  });

  it("keeps terminal sealing, settlement, stream spend, and final marking separate", () => {
    const terminal = terminalSession();
    const directSeal = sealTowTerminalReceipt(terminal);
    const routedSeal = sealTowRuntimeTerminalReceipt(terminal);
    expect(routedSeal).toEqual(directSeal);
    expect(towRuntimeSessionEvents(routedSeal.session)).toEqual({
      ok: true,
      reason: null,
      events: towSessionEvents(directSeal.session),
    });
    expect(towRuntimeWorldFates(routedSeal.session)).toEqual({
      ok: true,
      reason: null,
      worldFates: worldFatesByParticipant(directSeal.session.terminalReceipt),
    });

    const state = makeInitialState();
    const context = { encounterId: terminal.sessionId };
    expect(settleTowRuntimeEncounter(state, routedSeal.session, context))
      .toEqual(settleTowEncounter(state, directSeal.session.encounter, context));

    const routedSequence = createTowRuntimeStreamSequencer(routedSeal.session, "loot");
    const directSequence = streamSequencer(directSeal.session.streams.loot);
    expect(routedSequence.ok).toBe(true);
    expect(routedSequence.sequencer.random()).toBe(directSequence.random());
    expect(routedSequence.sequencer.endpoint()).toEqual(directSequence.endpoint());
    const endpoint = {
      ...routedSeal.session.streams.loot,
      state: (routedSeal.session.streams.loot.state + 1) >>> 0,
    };
    const spent = spendTowRuntimeSessionStream(routedSeal.session, "loot", endpoint);
    expect(spent).toEqual(spendTowSessionStream(directSeal.session, "loot", endpoint));
    expect(spent.session.status).toBe("terminal");

    expect(markTowRuntimeSessionSettled(spent.session, terminal.sessionId))
      .toEqual(markTowSessionSettled(spent.session, terminal.sessionId));
  });

  it("rejects projections that lack their required terminal receipt or named stream", () => {
    const session = openSession();
    expect(towRuntimeWorldFates(session)).toEqual({
      ok: false,
      reason: "missing-terminal-receipt",
      worldFates: {},
    });
    expect(createTowRuntimeStreamSequencer(session, "ambient")).toEqual({
      ok: false,
      reason: "unknown-session-stream",
      sequencer: null,
    });
  });

  it("rejects every session operation before an unregistered pair reaches v1", () => {
    const session = { ...openSession(), version: 2, rulesetId: "solitaire-tow-v2" };
    const reason = TOW_RUNTIME_REASONS.unsupportedRuntime;

    expect(decodeTowRuntimeSession(session)).toEqual({ ok: false, reason, session: null });
    expect(encodeTowRuntimeSession(session)).toEqual({ ok: false, reason, payload: null });
    expect(dispatchTowRuntimeCommand(session, strikeInput(session))).toMatchObject({
      ok: false, reason, session, command: null, events: [], duplicate: false,
    });
    expect(dispatchTowRuntimePlayerAction(session, strikeInput(session))).toMatchObject({
      ok: false,
      reason,
      session,
      autoAdvanced: false,
      autoCommand: null,
    });
    expect(replayTowRuntimeSession(session)).toEqual({
      ok: false,
      reason,
      encounter: null,
      divergence: null,
      replayedCommands: 0,
    });
    expect(verifyTowRuntimeSession(session)).toEqual({ ok: false, reason, divergence: null });
    expect(towRuntimeSessionEvents(session)).toEqual({ ok: false, reason, events: [] });
    expect(towRuntimeWorldFates(session)).toEqual({
      ok: false,
      reason,
      worldFates: {},
    });
    expect(createTowRuntimeStreamSequencer(session, "loot"))
      .toEqual({ ok: false, reason, sequencer: null });
    expect(sealTowRuntimeTerminalReceipt(session)).toEqual({ ok: false, reason, session });
    expect(spendTowRuntimeSessionStream(session, "loot", session.streams.loot))
      .toEqual({ ok: false, reason, session });
    expect(markTowRuntimeSessionSettled(session, session.sessionId))
      .toEqual({ ok: false, reason, session });

    const state = makeInitialState();
    expect(settleTowRuntimeEncounter(state, session, { encounterId: session.sessionId })).toEqual({
      ok: false,
      reason,
      state,
      receipt: null,
      duplicate: false,
    });
  });
});
