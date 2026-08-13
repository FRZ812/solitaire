// @vitest-environment jsdom

import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { compileCharacterBootstrap } from "../../gameplay/tow/character-bootstrap.js";
import { PRACTICE_SCENARIOS } from "../../gameplay/tow/practice-scenarios.js";
import {
  STARTING_ARCHETYPES,
  STARTING_VISAGES,
  archetypeFusionIds,
  createDefaultArchetypeDraft,
  invalidStartingArchetypes,
} from "../../gameplay/tow/starting-archetypes.js";
import { PracticeFight } from "./PracticeFight.jsx";
import { QuickStartLane } from "./QuickStartLane.jsx";

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

async function type(input, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function ControlledStart(props) {
  const [draft, setDraft] = useState(createDefaultArchetypeDraft());
  return <QuickStartLane {...props} draft={draft} onDraftChange={setDraft} />;
}

describe("the level-free archetype catalogue", () => {
  it("is complete, portrait-backed, and independent from legacy template people", () => {
    expect(STARTING_ARCHETYPES).toHaveLength(8);
    expect(STARTING_VISAGES).toHaveLength(8);
    expect(invalidStartingArchetypes()).toEqual([]);
    for (const entry of STARTING_ARCHETYPES) {
      expect(entry).not.toHaveProperty("level");
      expect(entry).not.toHaveProperty("template");
      expect(entry.build).not.toHaveProperty("level");
      expect(entry.gear.length).toBeGreaterThan(0);
    }
  });

  it("keeps visible power differences in equipment and starting fusions", () => {
    const grounded = STARTING_ARCHETYPES.filter((entry) => entry.power === "Grounded");
    const apex = STARTING_ARCHETYPES.find((entry) => entry.power === "Ascendant");
    expect(grounded.length).toBeGreaterThan(1);
    expect(archetypeFusionIds(apex.id).length).toBeGreaterThan(archetypeFusionIds(grounded[0].id).length);
  });
});

describe("the single start surface", () => {
  it("shows portrait-led archetypes without exposing legacy roster or limbo routes", async () => {
    const mounted = await render(<ControlledStart />);
    expect(mounted.querySelectorAll(".archetype-card")).toHaveLength(STARTING_ARCHETYPES.length);
    expect(mounted.querySelectorAll(".archetype-card img")).toHaveLength(STARTING_ARCHETYPES.length);
    expect(mounted.textContent).not.toContain("Choose a life, or forge your own");
    expect(mounted.textContent).not.toContain("Enter the limbo");
    expect(mounted.textContent).not.toMatch(/\bLevel\b/);
    expect(mounted.textContent).toContain("Starting equipment");
    expect(mounted.textContent).toContain("Starting fusions");
  });

  it("moves mechanics independently from the selected face", async () => {
    const mounted = await render(<ControlledStart />);
    const cards = [...mounted.querySelectorAll(".archetype-card")];
    const faces = [...mounted.querySelectorAll(".archetype-start__faces button")];
    expect(cards.filter((node) => node.getAttribute("aria-checked") === "true")).toHaveLength(1);
    expect(faces.filter((node) => node.getAttribute("aria-checked") === "true")).toHaveLength(1);

    await click(cards[3]);
    expect(cards[3].getAttribute("aria-checked")).toBe("true");
    // A chosen appearance is retained when the combat archetype changes.
    expect(faces[0].getAttribute("aria-checked")).toBe("true");

    await click(faces[4]);
    expect(faces[4].getAttribute("aria-checked")).toBe("true");
    expect(cards[3].getAttribute("aria-checked")).toBe("true");
  });

  it("requires the player's own name and never assigns a template name", async () => {
    const begun = [];
    const mounted = await render(<ControlledStart onBegin={(draft) => begun.push(draft)} />);
    const begin = mounted.querySelector(".archetype-start__begin");
    expect(begin.disabled).toBe(true);
    expect(mounted.textContent).not.toContain("Bram Coltaine");

    await type(mounted.querySelector(".archetype-start__name input"), "Mira Vale");
    expect(begin.disabled).toBe(false);
    await click(begin);
    expect(begun).toEqual([expect.objectContaining({ name: "Mira Vale", archetypeId: "ironbound" })]);
  });

  it("lets practice happen before identity is committed", async () => {
    const asked = [];
    const mounted = await render(
      <ControlledStart onPractice={(draft, scenarioId) => asked.push([draft, scenarioId])} />,
    );
    await click(mounted.querySelector(".archetype-start__test"));
    expect(asked).toEqual([[
      expect.objectContaining({ archetypeId: STARTING_ARCHETYPES[0].id, name: "" }),
      PRACTICE_SCENARIOS[0].id,
    ]]);
  });
});

describe("every advertised archetype reaches the production fight", () => {
  it("opens a legal, commandable practice encounter", async () => {
    for (const entry of STARTING_ARCHETYPES) {
      const compiled = compileCharacterBootstrap({ archetypeId: entry.id, origin: "archetype" });
      expect(compiled.ok, entry.id).toBe(true);
      expect(compiled.receipt.archetypeId).toBe(entry.id);

      const mounted = await render(
        <PracticeFight receipt={compiled.receipt} scenarioId="training-yard" onExit={() => {}} />,
      );
      const dialog = mounted.querySelector(".tow-combat");
      expect(dialog, entry.id).toBeTruthy();
      expect([...dialog.querySelectorAll(".production-combat__action")]
        .some((button) => !button.disabled), entry.id).toBe(true);
      expect(dialog.textContent, entry.id).toContain("Next");

      await act(async () => root.unmount());
      container.remove();
      root = null;
      container = null;
    }
  });

  it("plays out with a reproducible receipt and leaves the draft untouched", async () => {
    const compiled = compileCharacterBootstrap({ archetypeId: "ironbound", origin: "archetype" });
    const before = JSON.stringify(compiled.receipt);
    const mounted = await render(
      <PracticeFight receipt={compiled.receipt} scenarioId="training-yard" onExit={() => {}} />,
    );

    for (let round = 0; round < 40 && mounted.querySelector(".tow-combat"); round += 1) {
      const action = [...mounted.querySelectorAll(".production-combat__action")]
        .find((button) => !button.disabled);
      if (!action) break;
      await click(action);
    }

    const result = mounted.querySelector(".practice-fight--result");
    expect(result).toBeTruthy();
    expect(result.querySelector(".practice-fight__receipt").textContent).toContain("verified");
    expect(result.textContent).toContain("Nothing here was written down");
    expect(JSON.stringify(compiled.receipt)).toBe(before);
  });
});
