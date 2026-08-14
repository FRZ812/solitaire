// @vitest-environment jsdom
//
// The Lab has to be worth having and impossible to ship. The gate covers the second; this
// covers the first — that it drives the production fight rather than a shortcut of its own,
// and that a fixture taken out of it can be put straight back in.

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { dispatchTowCommand } from "../../gameplay/tow/commands.js";
import { decodeTowSession } from "../../gameplay/tow/persistence.js";
import { verifyTowSession } from "../../gameplay/tow/replay.js";
import { CombatLab, exportLabFixture, importLabFixture, openLabSession } from "./CombatLab.jsx";

let root;
let container;

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
});

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  container?.remove();
  root = null;
  container = null;
});

async function render(element) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(element));
  return container;
}

describe("opening a lab session", () => {
  it("returns a real production session", () => {
    const opened = openLabSession({ packageId: "fighter", scenarioId: "training-yard" });
    expect(opened.ok).toBe(true);
    expect(opened.session.rulesetId).toBe("solitaire-tow-v1");
    expect(opened.session.revision).toBe(0);
    expect(verifyTowSession(opened.session)).toMatchObject({ ok: true });
  });

  it("is reproducible from the same request", () => {
    const first = openLabSession({ packageId: "cleric", scenarioId: "the-duellist", attemptIndex: 2 });
    const second = openLabSession({ packageId: "cleric", scenarioId: "the-duellist", attemptIndex: 2 });
    expect(second.seed).toBe(first.seed);
    expect(second.session.encounter).toEqual(first.session.encounter);
  });

  it("refuses a fixture it does not know", () => {
    expect(openLabSession({ packageId: "fighter", scenarioId: "nowhere" }))
      .toMatchObject({ ok: false, reason: "unknown-practice-scenario" });
  });
});

describe("fixtures travel through the strict codec", () => {
  it("round-trips a played session without losing a command", () => {
    // A fight found by hand becomes a fight that stays fixed, which only works if the
    // exported fixture is exactly what a save would be.
    let session = openLabSession({ packageId: "fighter", scenarioId: "training-yard" }).session;
    session = dispatchTowCommand(session, {
      id: "lab-0", expectedRevision: 0, type: "use-skill",
      actorId: session.encounter.playerId, skillId: "strike", targetId: "foe-0",
    }).session;

    const exported = exportLabFixture(session);
    expect(exported.ok).toBe(true);

    const imported = importLabFixture(exported.json);
    expect(imported.ok).toBe(true);
    expect(imported.session.commands).toHaveLength(1);
    expect(imported.session.encounter).toEqual(session.encounter);
    expect(verifyTowSession(imported.session)).toMatchObject({ ok: true });
  });

  it("refuses a fixture the codec would refuse on load", () => {
    const session = openLabSession({ packageId: "fighter", scenarioId: "training-yard" }).session;
    const tampered = JSON.parse(exportLabFixture(session).json);
    tampered.encounter.actors["foe-0"].hp = 1;
    expect(importLabFixture(JSON.stringify(tampered)))
      .toMatchObject({ ok: false, reason: "tow-session-checksum-mismatch" });
  });

  it("refuses something that is not JSON at all", () => {
    expect(importLabFixture("{not json")).toMatchObject({ ok: false, reason: "invalid-fixture-json" });
  });

  it("exports only what decode would accept", () => {
    const session = openLabSession({ packageId: "rogue", scenarioId: "roadside-ambush" }).session;
    const payload = JSON.parse(exportLabFixture(session).json);
    expect(decodeTowSession(payload).ok).toBe(true);
  });
});

describe("the lab surface", () => {
  it("shows ruleset, seed, revision, checksum, intents and commands at once", async () => {
    const mounted = await render(<CombatLab onExit={() => {}} />);
    const state = mounted.querySelector(".combat-lab__state").textContent;
    expect(state).toContain("solitaire-tow-v1");
    expect(state).toContain("practice::solitaire-tow-v1");
    expect(state).toContain("integrity-v1:");
    expect(state).toContain("verified");
    expect(mounted.querySelector(".combat-lab__intents").textContent).toMatch(/→/);
    expect(mounted.querySelector(".combat-lab__commands")).toBeTruthy();
  });

  it("drives the production combat view rather than a resolver of its own", async () => {
    vi.useFakeTimers();
    try {
      const mounted = await render(<CombatLab onExit={() => {}} />);
      expect(mounted.querySelector(".tow-combat")).toBeTruthy();
      const action = [...mounted.querySelectorAll(".production-combat__action")]
        .find((button) => button.getAttribute("aria-disabled") !== "true");
      await act(async () => action.dispatchEvent(new MouseEvent("click", { bubbles: true })));
      expect(mounted.querySelector("[data-testid='tow-action-beat']")).toBeTruthy();
      await act(async () => vi.advanceTimersByTime(600));
      // The action and its automatic enemy advance both landed on the real session.
      const commands = [...mounted.querySelector(".combat-lab__commands").children];
      expect(commands).toHaveLength(2);
      expect(commands.map((entry) => entry.textContent))
        .toEqual([expect.stringContaining("use-skill"), expect.stringContaining("end-turn")]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("opens generated-art details on hold without firing the action", async () => {
    vi.useFakeTimers();
    try {
      const mounted = await render(<CombatLab onExit={() => {}} />);
      const action = mounted.querySelector(".production-combat__action");
      expect(action.querySelector(".tow-combat__ability-art img")).toBeTruthy();

      await act(async () => {
        action.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }));
        vi.advanceTimersByTime(450);
      });
      expect(mounted.querySelector("[data-testid='tow-skill-details']")).toBeTruthy();

      await act(async () => {
        action.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, button: 0 }));
        action.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
      });
      expect([...mounted.querySelector(".combat-lab__commands").children]).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
