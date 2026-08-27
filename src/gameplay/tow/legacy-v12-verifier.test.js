import { describe, expect, it } from "vitest";
import v12AuthenticRewardCampaign from "./fixtures/v12-authentic-reward-campaign.json";
import { verifyRetiredTowV12Session } from "./legacy-v12-verifier.js";
import { towSessionChecksum as frozenTowV12SessionChecksum } from "./session-v12.js";

function sourceSession() {
  return JSON.parse(JSON.stringify(v12AuthenticRewardCampaign.mechanics.tow.activeCombat));
}

function reseal(session) {
  session.checksum = frozenTowV12SessionChecksum(session);
  return session;
}

describe("the verifier-only deployed v1.2 boundary", () => {
  it("accepts the immutable deployed Shield Bash victory", () => {
    const session = sourceSession();
    expect(session).toMatchObject({
      version: 1,
      rulesetId: "solitaire-tow-v1.2",
      checksum: "integrity-v1:0b6880aa59763eaf",
      status: "settled",
    });
    expect(verifyRetiredTowV12Session(session))
      .toEqual({ ok: true, reason: null, divergence: null });
  });

  it("does not route a current identity through frozen rules", () => {
    const session = sourceSession();
    session.rulesetId = "solitaire-tow-v1.4";
    session.terminalReceipt.rulesetId = "solitaire-tow-v1.4";
    reseal(session);

    expect(verifyRetiredTowV12Session(session)).toEqual({
      ok: false,
      reason: "retired-v1.2-session-required",
      divergence: null,
    });
  });

  it("rejects a replay-divergent encounter even after checksum recomputation", () => {
    const session = sourceSession();
    session.encounter.actors.wanderer.hp -= 1;
    reseal(session);

    expect(verifyRetiredTowV12Session(session)).toMatchObject({
      ok: false,
      reason: "replay-state-divergence",
    });
  });

  it("rejects an unknown structural field even after checksum recomputation", () => {
    const session = sourceSession();
    session.futureAuthority = { accepted: true };
    reseal(session);

    expect(verifyRetiredTowV12Session(session)).toEqual({
      ok: false,
      reason: "invalid-retired-v1.2-session",
      divergence: null,
    });
  });

  it("rejects a substituted sealed reward endpoint after checksum recomputation", () => {
    const session = sourceSession();
    session.terminalReceipt.streamEndpoints.rewards.state = (
      session.terminalReceipt.streamEndpoints.rewards.state + 1
    ) >>> 0;
    reseal(session);

    expect(verifyRetiredTowV12Session(session)).toMatchObject({
      ok: false,
      reason: "replay-receipt-divergence",
    });
  });
});
