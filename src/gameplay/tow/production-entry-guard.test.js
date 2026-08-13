// Phase 9's entry-point and module-absence guards.
//
// The cutover deletes the reference and production preview stacks, and that deletion is a
// support decision — how long a half-finished legacy session stays finishable is not a thing
// a test should decide. What a test can do is make the deletion safe when it comes, and stop
// the ground shifting before it: exactly one controller starts a production fight, the
// preview stacks are unreachable with the flag off, and nothing has quietly grown a second
// way in.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RETIREMENT_LEDGER, ledgerEntryFor } from "../retirement-ledger.js";
import { referenceGameplayPreviewEnabled } from "../reference/release-gate.js";

const appSource = readFileSync(new URL("../../App.jsx", import.meta.url), "utf8");

describe("one way into a fight", () => {
  it("starts a production fight through the session controller and nothing else", () => {
    // Every live fight is admitted, sessioned and settled through the same path. A second
    // entry point is how a fight ends up outside the durability, the telegraph, and the
    // gateway all at once.
    expect(appSource).toContain("createTowSession({");
    expect(appSource.match(/createTowSession\(\{/g)).toHaveLength(1);
    // And the reducer is only ever reached through the command boundary.
    expect(appSource).not.toMatch(/[^a-zA-Z]useSkill\(/);
    expect(appSource).not.toMatch(/[^a-zA-Z]endTurn\(/);
  });

  it("admits before it sessions, every time", () => {
    // Admission is what carries conditions in and keeps unsupported content out; a start
    // that skipped it would be a fight the player's state never reached.
    const start = appSource.indexOf("admitTowEncounter({");
    const session = appSource.indexOf("createTowSession({");
    expect(start).toBeGreaterThan(-1);
    expect(start).toBeLessThan(session);
  });

  it("dispatches every player action through the command boundary", () => {
    expect(appSource).toContain("dispatchTowCommand(session, {");
    expect(appSource.match(/dispatchTowCommand\(/g)).toHaveLength(1);
  });
});

describe("the preview stacks cannot be reached with the flag off", () => {
  it("reads the flag from the environment and defaults closed", () => {
    // Defaulting closed is what makes "no feature flag can reactivate the retired resolver"
    // reachable: the flag has to be set to a literal "true", and anything else is off.
    expect(referenceGameplayPreviewEnabled(undefined)).toBe(false);
    expect(referenceGameplayPreviewEnabled({})).toBe(false);
    expect(referenceGameplayPreviewEnabled({ VITE_ENABLE_REFERENCE_GAMEPLAY_PREVIEW: "1" })).toBe(false);
    expect(referenceGameplayPreviewEnabled({ VITE_ENABLE_REFERENCE_GAMEPLAY_PREVIEW: true })).toBe(false);
    expect(referenceGameplayPreviewEnabled({ VITE_ENABLE_REFERENCE_GAMEPLAY_PREVIEW: "true" })).toBe(true);
  });

  it("gates every preview surface on it", () => {
    // Each mount site is behind the flag, so turning it off removes the surface rather than
    // leaving a dark one mounted.
    for (const surface of ["referenceGameplayOpen", "referenceRun"]) {
      expect(appSource).toContain(surface);
    }
    expect(appSource).toMatch(/REFERENCE_GAMEPLAY_PREVIEW_ENABLED\s*&&\s*referenceRun/);
  });

  it("keeps the Tower of Winter fight out of the preview gate", () => {
    // The live loop must not be reachable only when a preview flag happens to be on.
    const towMount = appSource.indexOf("<TowCombatView");
    const gatedRegion = appSource.slice(Math.max(0, towMount - 400), towMount);
    expect(gatedRegion).not.toContain("REFERENCE_GAMEPLAY_PREVIEW_ENABLED");
  });
});

describe("the retirement ledger still describes the code", () => {
  it("names a destination and a reason for every retained module", () => {
    expect(RETIREMENT_LEDGER.length).toBeGreaterThan(0);
    for (const entry of RETIREMENT_LEDGER) {
      expect(entry.module, JSON.stringify(entry)).toBeTruthy();
      expect(entry.why.length, entry.module).toBeGreaterThan(20);
    }
  });

  it("has an entry for the intent machine now that it has been ported", () => {
    // kernel/intent.js was the port source for tow/intent.js. Its ledger entry is what stops
    // the original being deleted before the port was proven, and what says it may be now.
    const entry = ledgerEntryFor("kernel/intent.js");
    expect(entry).toBeTruthy();
    expect(entry.successor).toBe("src/gameplay/tow/intent.js");
  });
});
