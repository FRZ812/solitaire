import { describe, expect, it } from "vitest";
import v13ResolveCadenceSession from "./fixtures/v13-resolve-cadence-session.json";
import { verifyRetiredTowV13Session } from "./legacy-v13-verifier.js";
import { towSessionChecksum as frozenTowV13SessionChecksum } from "./session-v13.js";

function sourceSession() {
  return JSON.parse(JSON.stringify(v13ResolveCadenceSession));
}

function reseal(session) {
  session.checksum = frozenTowV13SessionChecksum(session);
  return session;
}

describe("the verifier-only deployed v1.3 boundary", () => {
  it("accepts the immutable deployed Resolve-cadence victory", () => {
    const session = sourceSession();
    expect(session).toMatchObject({
      version: 1,
      rulesetId: "solitaire-tow-v1.3",
      checksum: "integrity-v1:852f566c2371b384",
      status: "settled",
    });
    expect(verifyRetiredTowV13Session(session))
      .toEqual({ ok: true, reason: null, divergence: null });
  });

  it("snapshots a caller Proxy once without reading through it again", () => {
    const session = sourceSession();
    let directReads = 0;
    const proxy = new Proxy(session, {
      get() {
        directReads += 1;
        throw new Error("caller proxy was re-read");
      },
    });

    expect(verifyRetiredTowV13Session(proxy))
      .toEqual({ ok: true, reason: null, divergence: null });
    expect(directReads).toBe(0);
  });

  it("does not route a current identity through frozen rules", () => {
    const session = sourceSession();
    session.rulesetId = "solitaire-tow-v1.4";
    session.terminalReceipt.rulesetId = "solitaire-tow-v1.4";
    reseal(session);

    expect(verifyRetiredTowV13Session(session)).toEqual({
      ok: false,
      reason: "retired-v1.3-session-required",
      divergence: null,
    });
  });

  it("rejects a replay-divergent encounter even after checksum recomputation", () => {
    const session = sourceSession();
    session.encounter.actors.wanderer.hp -= 1;
    reseal(session);

    expect(verifyRetiredTowV13Session(session)).toMatchObject({
      ok: false,
      reason: "replay-state-divergence",
    });
  });
});
