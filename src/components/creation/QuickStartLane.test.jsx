// @vitest-environment jsdom
//
// Phase 4's headline gate: one click from Quick Start reaches a legal fight. Everything else
// here guards the promise the lane makes while doing it — that trying a build is free.

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { compileCharacterBootstrap } from "../../gameplay/tow/character-bootstrap.js";
import { PRACTICE_SCENARIOS } from "../../gameplay/tow/practice-scenarios.js";
import { getSkill } from "../../gameplay/tow/skills.js";
import { startingPackage } from "../../gameplay/tow/starting-packages.js";
import { PracticeFight } from "./PracticeFight.jsx";
import { FIELD_READY_TEMPLATE_IDS, QuickStartLane, fieldReadyStarts } from "./QuickStartLane.jsx";

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

async function click(element) {
  expect(element).toBeTruthy();
  await act(async () => element.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

describe("the field-ready cohort", () => {
  it("offers exactly the six people the plan names", () => {
    const starts = fieldReadyStarts();
    expect(starts).toHaveLength(6);
    expect(starts.map((entry) => entry.template.id)).toEqual([...FIELD_READY_TEMPLATE_IDS]);
  });

  it("keeps each one's authored identity and actual level", () => {
    // Quick Start commits a person, not a normalised stand-in.
    for (const entry of fieldReadyStarts()) {
      expect(entry.template.label, entry.template.id).toBeTruthy();
      expect(entry.level, entry.template.id).toBeGreaterThanOrEqual(1);
      expect(entry.package.trait.rank).toBeGreaterThanOrEqual(1);
    }
  });

  it("advertises only capabilities that are actually there", () => {
    // A start appears here only when everything it begins with resolves. Advertising a
    // skill the catalogue has since lost would be offering a build that cannot be played.
    for (const entry of fieldReadyStarts()) {
      expect(startingPackage(entry.template.setup.profession), entry.template.id).toBeTruthy();
      for (const skill of entry.package.skills) {
        expect(getSkill(skill.id), `${entry.template.id}:${skill.id}`).toBeTruthy();
      }
    }
  });
});

describe("the lane itself", () => {
  it("shows the five facts that decide the choice", async () => {
    const mounted = await render(<QuickStartLane />);
    const labels = [...mounted.querySelectorAll(".quick-start__fact-label")]
      .map((node) => node.textContent);
    expect(labels).toEqual(["Role", "Opens with", "Your actions", "How rationed", "Attention"]);
  });

  it("preselects one package and lets the choice move", async () => {
    const mounted = await render(<QuickStartLane />);
    const choices = [...mounted.querySelectorAll(".quick-start__choice")];
    expect(choices).toHaveLength(6);
    expect(choices.filter((node) => node.getAttribute("aria-checked") === "true")).toHaveLength(1);

    await click(choices[3]);
    expect(choices[3].getAttribute("aria-checked")).toBe("true");
    expect(choices[0].getAttribute("aria-checked")).toBe("false");
  });

  it("hands the chosen start and scenario to whoever is listening", async () => {
    const asked = [];
    const mounted = await render(
      <QuickStartLane onPractice={(start, scenarioId) => asked.push([start.template.id, scenarioId])} />,
    );
    await click(mounted.querySelector(".quick-start__try"));
    expect(asked).toEqual([[FIELD_READY_TEMPLATE_IDS[0], PRACTICE_SCENARIOS[0].id]]);
  });

  it("offers begin and practice as separate, explicit actions", async () => {
    const events = [];
    const mounted = await render(
      <QuickStartLane onPractice={() => events.push("practice")} onBegin={() => events.push("begin")} />,
    );
    await click(mounted.querySelector(".quick-start__try"));
    await click(mounted.querySelector(".quick-start__begin"));
    // Trying a build must never be a step on the way to committing to it.
    expect(events).toEqual(["practice", "begin"]);
  });
});

describe("one click reaches a legal fight", () => {
  it("opens a real, commandable encounter for every field-ready package", async () => {
    for (const entry of fieldReadyStarts()) {
      const packageId = entry.template.id;
      const compiled = compileCharacterBootstrap({
        professionId: entry.template.setup.profession,
        level: entry.level,
        origin: "quick-start",
      });
      expect(compiled.ok, packageId).toBe(true);

      const mounted = await render(
        <PracticeFight receipt={compiled.receipt} scenarioId="training-yard" onExit={() => {}} />,
      );
      // The production combat surface, with legal actions waiting.
      const dialog = mounted.querySelector(".tow-combat");
      expect(dialog, packageId).toBeTruthy();
      const actions = [...dialog.querySelectorAll(".production-combat__action")]
        .filter((button) => !button.disabled);
      expect(actions.length, packageId).toBeGreaterThan(0);
      // And a telegraph to read before spending any of them.
      expect(dialog.textContent, packageId).toContain("Next");

      if (root) await act(async () => root.unmount());
      container?.remove();
      root = null;
      container = null;
    }
  });

  it("plays out to a result that carries its own reproduction receipt", async () => {
    const compiled = compileCharacterBootstrap({ professionId: "fighter", origin: "quick-start" });
    const mounted = await render(
      <PracticeFight receipt={compiled.receipt} scenarioId="training-yard" onExit={() => {}} />,
    );

    for (let round = 0; round < 30; round += 1) {
      const dialog = mounted.querySelector(".tow-combat");
      if (!dialog) break;
      const strike = [...dialog.querySelectorAll(".production-combat__action")]
        .find((button) => /strike/i.test(button.textContent) && !button.disabled);
      if (!strike) break;
      await click(strike);
      if (!mounted.querySelector(".tow-combat")) break;
      const endTurn = [...mounted.querySelectorAll(".production-combat__settle")]
        .find((button) => /end turn/i.test(button.textContent));
      if (!endTurn) break;
      await click(endTurn);
    }

    const result = mounted.querySelector(".practice-fight--result");
    expect(result).toBeTruthy();
    // The things that make the fight reproducible, not just the things that make it feel good.
    const receipt = result.querySelector(".practice-fight__receipt").textContent;
    expect(receipt).toContain("training-yard v1");
    expect(receipt).toContain("practice::solitaire-tow-v1::fighter@1");
    expect(receipt).toContain("verified");
    // And the promise the lane made.
    expect(result.textContent).toContain("Nothing here was written down");
  });

  it("offers retry-same-seed and try-another-seed as separate actions", async () => {
    const compiled = compileCharacterBootstrap({ professionId: "fighter", origin: "quick-start" });
    const mounted = await render(
      <PracticeFight receipt={compiled.receipt} scenarioId="training-yard" onExit={() => {}} />,
    );
    for (let round = 0; round < 30 && mounted.querySelector(".tow-combat"); round += 1) {
      const strike = [...mounted.querySelectorAll(".production-combat__action")]
        .find((button) => /strike/i.test(button.textContent) && !button.disabled);
      if (!strike) break;
      await click(strike);
      const endTurn = [...mounted.querySelectorAll(".production-combat__settle")]
        .find((button) => /end turn/i.test(button.textContent));
      if (endTurn) await click(endTurn);
    }

    const before = mounted.querySelector(".practice-fight__receipt").textContent;
    const buttons = [...mounted.querySelectorAll(".practice-fight__actions button")];
    expect(buttons.map((button) => button.textContent))
      .toEqual(["Retry same seed", "Try another seed", "Back to your build"]);

    // Another seed is a different, still-derived fight rather than a reroll.
    await click(buttons[1]);
    expect(mounted.querySelector(".tow-combat")).toBeTruthy();
    expect(mounted.textContent).not.toBe(before);
  });

  it("leaves the compiled draft byte-identical after a whole practice fight", async () => {
    const compiled = compileCharacterBootstrap({ professionId: "rogue", origin: "quick-start" });
    const before = JSON.stringify(compiled.receipt);
    const mounted = await render(
      <PracticeFight receipt={compiled.receipt} scenarioId="the-duellist" onExit={() => {}} />,
    );
    for (let round = 0; round < 30 && mounted.querySelector(".tow-combat"); round += 1) {
      const strike = [...mounted.querySelectorAll(".production-combat__action")]
        .find((button) => !button.disabled);
      if (!strike) break;
      await click(strike);
      const endTurn = [...mounted.querySelectorAll(".production-combat__settle")]
        .find((button) => /end turn/i.test(button.textContent));
      if (endTurn) await click(endTurn);
    }
    expect(JSON.stringify(compiled.receipt)).toBe(before);
  });
});
