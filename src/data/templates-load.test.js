import { describe, it, expect } from "vitest";

// Fail-fast canary. `CHARACTER_TEMPLATES` (templates.js:1093) compiles every
// ready-made ledger at MODULE LOAD and throws on mismatch, and progression.js
// imports it — so a bad template takes down every progression consumer, every
// component test, and App.jsx at once.
//
// This test exists so that failure reads as one unambiguous line instead of a
// hundred confusing downstream errors. If it is red, fix templates.js first and
// ignore everything else.
describe("templates module load", () => {
  it("imports without throwing and yields a compiled roster", async () => {
    const mod = await import("./templates.js");
    expect(Array.isArray(mod.CHARACTER_TEMPLATES)).toBe(true);
    expect(mod.CHARACTER_TEMPLATES.length).toBeGreaterThan(0);
  });

  it("gives every template the setup fields downstream code reads unguarded", async () => {
    const { CHARACTER_TEMPLATES } = await import("./templates.js");
    for (const template of CHARACTER_TEMPLATES) {
      expect(template.id, "template is missing an id").toBeTruthy();
      expect(template.setup, `${template.id} has no setup`).toBeTruthy();
      expect(template.setup.progression, `${template.id} has no compiled progression`).toBeTruthy();
      expect(template.setup.attributes, `${template.id} has no attributes`).toBeTruthy();
      expect(Number.isFinite(template.setup.level), `${template.id} has a non-numeric level`).toBe(true);
    }
  });
});
