// @vitest-environment jsdom

import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { compileCharacterBootstrap } from "../../gameplay/tow/character-bootstrap.js";
import { PRACTICE_SCENARIOS } from "../../gameplay/tow/practice-scenarios.js";
import {
  STARTING_ARCHETYPES,
  archetypeFusionIds,
  createDefaultArchetypeDraft,
  invalidStartingArchetypes,
} from "../../gameplay/tow/starting-archetypes.js";
import { PracticeFight } from "./PracticeFight.jsx";
import { QuickStartLane } from "./QuickStartLane.jsx";
import { resolvePlayerCombatCutout } from "../combat/tow-combat-art.js";

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

async function keydown(element, key) {
  expect(element).toBeTruthy();
  await act(async () => element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true })));
}

function ControlledStart(props) {
  const [draft, setDraft] = useState(createDefaultArchetypeDraft());
  return <QuickStartLane {...props} draft={draft} onDraftChange={setDraft} />;
}

describe("the authored TOW character catalogue", () => {
  it("is complete, unique, portrait-backed, and level-free", () => {
    expect(STARTING_ARCHETYPES).toHaveLength(8);
    expect(invalidStartingArchetypes()).toEqual([]);
    expect(new Set(STARTING_ARCHETYPES.map((entry) => entry.character.name)).size).toBe(8);
    for (const entry of STARTING_ARCHETYPES) {
      expect(entry).not.toHaveProperty("level");
      expect(entry.build).not.toHaveProperty("level");
      expect(entry.character).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        epithet: expect.any(String),
        portraitKey: expect.stringMatching(/^template:/),
      });
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

describe("the simple grid-to-preview flow", () => {
  it("opens on a portrait grid without creation fields or expanded mechanics", async () => {
    const mounted = await render(<ControlledStart />);
    expect(mounted.querySelectorAll(".character-choice-card")).toHaveLength(STARTING_ARCHETYPES.length);
    expect(mounted.querySelectorAll(".character-choice-card img")).toHaveLength(STARTING_ARCHETYPES.length);
    expect(mounted.querySelectorAll(".character-choice-card__copy strong")).toHaveLength(STARTING_ARCHETYPES.length);
    STARTING_ARCHETYPES.forEach((entry, index) => {
      expect(mounted.querySelectorAll(".character-choice-card__art")[index].getAttribute("src"))
        .toBe(resolvePlayerCombatCutout(entry.character.portraitKey, entry.character));
    });
    expect(mounted.querySelector(".character-preview")).toBeNull();
    expect(mounted.querySelector("input")).toBeNull();
    expect(mounted.querySelector("select")).toBeNull();
    expect(mounted.textContent).not.toContain("Starting equipment");
    expect(mounted.textContent).not.toContain("Starting fusions");
    expect(mounted.textContent).not.toContain("Choose a life, or forge your own");
    expect(mounted.textContent).not.toContain("Enter the limbo");
    expect(mounted.textContent).not.toContain("Grounded");
    expect(mounted.textContent).not.toContain("Heroic");
    expect(mounted.textContent).not.toMatch(/\bLevel\b/);
  });

  it("turns a grid choice into a focused fixed-character preview and carousel", async () => {
    const mounted = await render(<ControlledStart />);
    await click(mounted.querySelectorAll(".character-choice-card")[3]);

    const preview = mounted.querySelector(".character-preview");
    const character = STARTING_ARCHETYPES[3].character;
    expect(preview).toBeTruthy();
    expect(preview.querySelector("h1").textContent).toBe(character.name);
    expect(preview.textContent).toContain(character.epithet);
    expect(preview.querySelector("input")).toBeNull();
    expect(preview.querySelectorAll(".character-preview__carousel [role=radio]")).toHaveLength(8);
    expect(preview.querySelectorAll(".character-preview__carousel [aria-checked=true]")).toHaveLength(1);
    expect(preview.querySelector(".character-preview__close")).toBeNull();
    expect(preview.querySelectorAll(".character-preview__starting-actions img").length).toBeGreaterThan(1);
    expect(preview.querySelector(".character-preview__cutout").getAttribute("src"))
      .toBe(resolvePlayerCombatCutout(STARTING_ARCHETYPES[3].character.portraitKey, STARTING_ARCHETYPES[3].character));
    expect(preview.textContent).not.toContain("Starting trait");
    expect(preview.textContent).not.toMatch(/\bRank\s+\d/);
    expect(mounted.textContent).not.toContain("Starting equipment");
  });

  it("changes the whole authored identity from the side-scrolling carousel", async () => {
    const mounted = await render(<ControlledStart />);
    await click(mounted.querySelectorAll(".character-choice-card")[0]);
    const carousel = mounted.querySelectorAll(".character-preview__carousel [role=radio]");
    await click(carousel[6]);

    expect(mounted.querySelector(".character-preview__copy h1").textContent)
      .toBe(STARTING_ARCHETYPES[6].character.name);
    expect(carousel[6].getAttribute("aria-checked")).toBe("true");
    expect(mounted.querySelector(".character-preview__portrait img").getAttribute("alt"))
      .toContain(STARTING_ARCHETYPES[6].character.epithet);
  });

  it("keeps loadout and practice controls behind an on-demand details drawer", async () => {
    const asked = [];
    const mounted = await render(
      <ControlledStart onPractice={(draft, scenarioId) => asked.push([draft, scenarioId])} />,
    );
    await click(mounted.querySelectorAll(".character-choice-card")[6]);
    expect(mounted.querySelector(".character-details")).toBeNull();

    await click(mounted.querySelector(".character-preview__details-button"));
    const details = mounted.querySelector(".character-details");
    expect(details).toBeTruthy();
    expect(details.textContent).toContain("Starting equipment");
    expect(details.textContent).toContain("Starting fusions");
    expect(details.textContent).toContain("Starting abilities");
    expect(details.textContent).toContain("Equipped now · ranks 1–6");
    expect(details.textContent).toContain("Possible refinement");
    expect(details.querySelectorAll(".starting-ability__art img")).toHaveLength(
      STARTING_ARCHETYPES[6].build.skills.length,
    );
    expect(details.querySelector("select")).toBeNull();

    const picker = details.querySelector("[role=combobox]");
    await click(picker);
    const options = details.querySelectorAll("[role=option]");
    expect(options).toHaveLength(PRACTICE_SCENARIOS.length);
    await click(options[1]);
    expect(picker.textContent).toContain(PRACTICE_SCENARIOS[1].name);

    await click(details.querySelector(".character-details__practice > button"));
    expect(asked).toEqual([[
      { archetypeId: STARTING_ARCHETYPES[6].id, preview: true },
      PRACTICE_SCENARIOS[1].id,
    ]]);
  });

  it("supports keyboard selection in the custom practice opponent picker", async () => {
    const mounted = await render(<ControlledStart />);
    await click(mounted.querySelectorAll(".character-choice-card")[0]);
    await click(mounted.querySelector(".character-preview__details-button"));
    const picker = mounted.querySelector("[role=combobox]");

    await keydown(picker, "ArrowDown");
    expect(picker.getAttribute("aria-expanded")).toBe("true");
    await keydown(picker, "ArrowDown");
    await keydown(picker, "Enter");
    expect(picker.getAttribute("aria-expanded")).toBe("false");
    expect(picker.textContent).toContain(PRACTICE_SCENARIOS[1].name);
  });

  it("starts the selected authored character without asking for a name or face", async () => {
    const begun = [];
    const mounted = await render(<ControlledStart onBegin={(draft) => begun.push(draft)} />);
    await click(mounted.querySelectorAll(".character-choice-card")[4]);
    const begin = mounted.querySelector(".character-preview__begin");
    expect(begin.disabled).toBe(false);
    await click(begin);
    expect(begun).toEqual([{ archetypeId: STARTING_ARCHETYPES[4].id, preview: true }]);
  });
});

describe("every advertised character reaches the production fight", () => {
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
      expect(dialog.textContent, entry.id).toContain(entry.character.name);
      expect([...dialog.querySelectorAll(".production-combat__action")]
        .some((button) => button.getAttribute("aria-disabled") !== "true"), entry.id).toBe(true);
      expect(dialog.textContent, entry.id).toContain("Incoming");

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
        .find((button) => button.getAttribute("aria-disabled") !== "true");
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
