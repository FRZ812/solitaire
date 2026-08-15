// @vitest-environment jsdom

import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { compileCharacterBootstrap } from "../../gameplay/tow/character-bootstrap.js";
import { STARTING_COMBAT_ITEMS } from "../../gameplay/tow/combat-items.js";
import { PRACTICE_SCENARIOS } from "../../gameplay/tow/practice-scenarios.js";
import { getSkill } from "../../gameplay/tow/skills.js";
import {
  STARTING_ARCHETYPES,
  TOWER_ROSTER_SIZE,
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

async function change(element, value) {
  expect(element).toBeTruthy();
  await act(async () => {
    element.value = value;
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function ControlledStart(props) {
  const [draft, setDraft] = useState(createDefaultArchetypeDraft());
  return <QuickStartLane {...props} draft={draft} onDraftChange={setDraft} />;
}

describe("the authored TOW character catalogue", () => {
  it("is complete, unique, portrait-backed, and level-free", () => {
    expect(STARTING_ARCHETYPES).toHaveLength(TOWER_ROSTER_SIZE);
    expect(invalidStartingArchetypes()).toEqual([]);
    expect(new Set(STARTING_ARCHETYPES.map((entry) => entry.character.name)).size).toBe(TOWER_ROSTER_SIZE);
    for (const entry of STARTING_ARCHETYPES) {
      expect(entry).not.toHaveProperty("level");
      expect(entry.build).not.toHaveProperty("level");
      expect(entry.character).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        epithet: expect.any(String),
        portraitKey: expect.stringMatching(/^tow:/),
        sourceName: expect.any(String),
      });
      expect(entry.build.skills).toHaveLength(5);
      expect(entry.gear.length).toBeGreaterThan(0);
    }
  });

  it("keeps visible source stat and mechanic differences on the fixed templates", () => {
    expect(new Set(STARTING_ARCHETYPES.map((entry) => entry.baseStats.maxHp)).size).toBeGreaterThan(4);
    expect(new Set(STARTING_ARCHETYPES.map((entry) => Object.keys(entry.build.traits)[0])).size)
      .toBe(TOWER_ROSTER_SIZE);
    expect(STARTING_ARCHETYPES.every((entry) => entry.source.page.includes("namu.wiki"))).toBe(true);
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
    expect(preview.querySelectorAll(".character-preview__carousel [role=radio]")).toHaveLength(TOWER_ROSTER_SIZE);
    expect(preview.querySelectorAll(".character-preview__carousel [aria-checked=true]")).toHaveLength(1);
    expect(preview.querySelector(".character-preview__close")).toBeNull();
    expect(preview.querySelectorAll(".character-preview__ability-slot img")).toHaveLength(5);
    expect(preview.querySelectorAll(".character-preview__ability-slot[data-ability-type]")).toHaveLength(5);
    expect(preview.querySelectorAll('.character-preview__ability-slot[data-slot-role="fixed"]')).toHaveLength(2);
    expect(preview.querySelectorAll('.character-preview__ability-slot[data-slot-role="flexible"]')).toHaveLength(3);
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

  it("supports roving keyboard navigation across all twelve carousel portraits", async () => {
    const mounted = await render(<ControlledStart />);
    await click(mounted.querySelectorAll(".character-choice-card")[0]);
    const carousel = mounted.querySelectorAll(".character-preview__carousel [role=radio]");
    expect(carousel[0].tabIndex).toBe(0);
    expect(carousel[1].tabIndex).toBe(-1);
    await keydown(carousel[0], "ArrowRight");
    expect(mounted.querySelector(".character-preview__copy h1").textContent)
      .toBe(STARTING_ARCHETYPES[1].character.name);
    expect(mounted.querySelectorAll(".character-preview__carousel [role=radio]")[1].tabIndex).toBe(0);
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
    expect(details.textContent).toContain("Select loadout");
    expect(details.textContent).toContain("Source identity");
    expect(details.querySelectorAll(".character-details__stats > div")).toHaveLength(6);
    expect(details.textContent).not.toContain("Possible refinement");
    expect(details.textContent).toContain("Passive trait");
    expect(details.textContent).not.toContain("Starting abilities");
    expect(details.textContent).not.toContain("Character ability library");
    expect(details.textContent).not.toContain("General ability library");
    expect(details.querySelector(".starting-abilities")).toBeNull();
    expect(details.querySelector(".character-exclusive-library")).toBeNull();
    expect(details.querySelector('[data-trait-id="necromancy"]')?.textContent)
      .toContain("Skeletons each turn");
    const loadoutEditor = details.querySelector('[aria-label="Selectable loadout"]');
    expect(loadoutEditor.querySelectorAll(".ability-swap-picker__trigger")).toHaveLength(5);
    expect(loadoutEditor.querySelector("select")).toBeNull();

    const picker = details.querySelector('[role="combobox"][aria-label="Practice opponent"]');
    await click(picker);
    const options = details.querySelectorAll("[role=option]");
    expect(options).toHaveLength(PRACTICE_SCENARIOS.length);
    await click(options[1]);
    expect(picker.textContent).toContain(PRACTICE_SCENARIOS[1].name);

    await click(details.querySelector(".character-details__practice > button"));
    expect(asked).toEqual([[
      {
        archetypeId: STARTING_ARCHETYPES[6].id,
        keepsakeId: STARTING_COMBAT_ITEMS[0].id,
        preview: true,
      },
      PRACTICE_SCENARIOS[1].id,
    ]]);
  });

  it("supports keyboard selection in the custom practice opponent picker", async () => {
    const mounted = await render(<ControlledStart />);
    await click(mounted.querySelectorAll(".character-choice-card")[0]);
    await click(mounted.querySelector(".character-preview__details-button"));
    const picker = mounted.querySelector('[role="combobox"][aria-label="Practice opponent"]');

    await keydown(picker, "ArrowDown");
    expect(picker.getAttribute("aria-expanded")).toBe("true");
    await keydown(picker, "ArrowDown");
    await keydown(picker, "Enter");
    expect(picker.getAttribute("aria-expanded")).toBe("false");
    expect(picker.textContent).toContain(PRACTICE_SCENARIOS[1].name);
  });

  it("describes the Last Assassin loadout from its real damage and status effects", async () => {
    const mounted = await render(<ControlledStart />);
    await click(mounted.querySelectorAll(".character-choice-card")[5]);
    await click(mounted.querySelector(".character-preview__details-button"));

    const details = mounted.querySelector(".character-details");
    const editor = details.querySelector('[aria-label="Selectable loadout"]');
    const summaries = [...editor.querySelectorAll(".ability-swap-picker__trigger-summary")]
      .map((entry) => entry.textContent);

    expect(details.querySelectorAll(".character-details__test-loadout")).toHaveLength(1);
    expect(details.querySelector(".character-details__split")).toBeNull();
    expect(summaries).toEqual([
      "Deal 2 hits of 50% ATK damage",
      "Gain Parry equal to 185% DEF",
      "Inflict 2 Stun · 6-turn cooldown",
      "Deal 240% ATK damage · Remove Limp on the enemy",
      "Deal 4 hits of 35% ATK damage · 9-turn cooldown",
    ]);
  });

  it("supports roving keyboard selection in the custom ability picker", async () => {
    const mounted = await render(<ControlledStart />);
    await click(mounted.querySelectorAll(".character-choice-card")[6]);
    await click(mounted.querySelector(".character-preview__details-button"));
    const editor = mounted.querySelector('[aria-label="Selectable loadout"]');
    const trigger = editor.querySelectorAll(".ability-swap-picker__trigger")[2];

    await click(trigger);
    let panel = document.querySelector(".ability-swap-picker__panel");
    const current = panel.querySelector('[role="option"][aria-selected="true"]');
    await keydown(current, "ArrowDown");
    const next = panel.querySelector('[role="option"].is-active');
    expect(next).not.toBe(current);
    expect(next.getAttribute("aria-disabled")).toBe("false");
    const nextName = next.querySelector(".ability-swap-picker__option-title strong").textContent;
    await keydown(next, "Enter");

    panel = document.querySelector(".ability-swap-picker__panel");
    expect(panel.querySelector('[role="option"][aria-selected="true"]')).toBe(next);
    await click(panel.querySelector('[data-action="confirm-ability-swap"]'));
    expect(document.querySelector(".ability-swap-picker__panel")).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.textContent).toContain(nextName);

    await click(trigger);
    panel = document.querySelector(".ability-swap-picker__panel");
    await keydown(panel.querySelector('[role="option"].is-active'), "Escape");
    expect(document.querySelector(".ability-swap-picker__panel")).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("promotes an ability through named rarities with live values before equipping it", async () => {
    const asked = [];
    const mounted = await render(
      <ControlledStart onPractice={(draft) => asked.push(draft)} />,
    );
    const selected = STARTING_ARCHETYPES[5];
    await click(mounted.querySelectorAll(".character-choice-card")[5]);
    await click(mounted.querySelector(".character-preview__details-button"));

    const trigger = mounted.querySelectorAll(".ability-swap-picker__trigger")[0];
    await click(trigger);
    let panel = document.querySelector(".ability-swap-picker__panel");
    const lower = panel.querySelector('[data-action="lower-rarity"]');
    const promote = panel.querySelector('[data-action="promote-rarity"]');
    expect(lower.disabled).toBe(true);
    expect(promote.disabled).toBe(false);
    expect(panel.querySelector(".ability-swap-picker__rarity-stepper output").textContent)
      .toBe("Common");

    await click(promote);
    await click(panel.querySelector('[data-action="promote-rarity"]'));
    panel = document.querySelector(".ability-swap-picker__panel");
    expect(panel.querySelector(".ability-swap-picker__rarity-stepper output").textContent)
      .toBe("Rare");
    expect(panel.querySelector('[role="option"][aria-selected="true"] .ability-swap-picker__option-summary').textContent)
      .toContain("2 hits of 64% ATK damage");

    await click(panel.querySelector('[data-action="promote-rarity"]'));
    await click(panel.querySelector('[data-action="promote-rarity"]'));
    panel = document.querySelector(".ability-swap-picker__panel");
    expect(panel.querySelector(".ability-swap-picker__rarity-stepper output").textContent)
      .toBe("Legendary");
    expect(panel.querySelector('[role="option"][aria-selected="true"] .ability-swap-picker__option-summary').textContent)
      .toContain("2 hits of 78% ATK damage");

    await click(panel.querySelector('[data-action="confirm-ability-swap"]'));
    expect(trigger.textContent).toContain("Legendary");
    expect(trigger.textContent).not.toMatch(/Rank|\d\s*\/\s*\d/);
    expect(trigger.querySelector(".ability-swap-picker__trigger-summary").textContent)
      .toContain("2 hits of 78% ATK damage");

    await click(mounted.querySelectorAll(".ability-swap-picker__trigger")[2]);
    panel = document.querySelector(".ability-swap-picker__panel");
    expect(panel.querySelector(".ability-swap-picker__rarity-stepper output").textContent)
      .toBe("Legendary");
    await click(panel.querySelector('[data-action="promote-rarity"]'));
    expect(panel.querySelector(".ability-swap-picker__rarity-stepper output").textContent)
      .toBe("Mythical");
    expect(panel.querySelector('[data-action="promote-rarity"]').disabled).toBe(true);
    await click(panel.querySelector('[role="option"][data-skill-id="assassin-shadow-strike"]'));
    expect(panel.querySelector(".ability-swap-picker__rarity-copy").textContent).toContain("Fixed at Mythical");
    expect(panel.querySelector('[data-action="lower-rarity"]').disabled).toBe(true);
    expect(panel.querySelector('[data-action="promote-rarity"]').disabled).toBe(true);
    await keydown(panel.querySelector('[role="option"][aria-selected="true"]'), "Escape");

    await click(mounted.querySelector(".character-details__practice > button"));
    expect(asked).toEqual([{
      archetypeId: selected.id,
      keepsakeId: STARTING_COMBAT_ITEMS[0].id,
      preview: true,
      testSkillRarities: ["legendary", "common", "legendary", "legendary", "rare"],
    }]);
  });

  it("promotes a General ability from its authored rarity through Mythical", async () => {
    const asked = [];
    const mounted = await render(
      <ControlledStart onPractice={(draft) => asked.push(draft)} />,
    );
    const selected = STARTING_ARCHETYPES[5];
    await click(mounted.querySelectorAll(".character-choice-card")[5]);
    await click(mounted.querySelector(".character-preview__details-button"));

    const trigger = mounted.querySelectorAll(".ability-swap-picker__trigger")[2];
    await click(trigger);
    let panel = document.querySelector(".ability-swap-picker__panel");
    await click(panel.querySelector('[role="tab"][data-group-id="general"]'));
    await click(panel.querySelector('[role="option"][data-skill-id="penetration"]'));
    panel = document.querySelector(".ability-swap-picker__panel");

    expect(panel.querySelector(".ability-swap-picker__rarity-stepper output").textContent)
      .toBe("Uncommon");
    expect(panel.querySelector('[data-action="lower-rarity"]').disabled).toBe(true);
    expect(panel.querySelector('[data-action="promote-rarity"]').disabled).toBe(false);

    for (let promotion = 0; promotion < 4; promotion += 1) {
      await click(panel.querySelector('[data-action="promote-rarity"]'));
      panel = document.querySelector(".ability-swap-picker__panel");
    }
    expect(panel.querySelector(".ability-swap-picker__rarity-stepper output").textContent)
      .toBe("Mythical");
    expect(panel.querySelector('[role="option"][aria-selected="true"] .ability-swap-picker__option-summary').textContent)
      .toContain("180% ATK");
    expect(panel.querySelector('[data-action="promote-rarity"]').disabled).toBe(true);

    await click(panel.querySelector('[data-action="confirm-ability-swap"]'));
    expect(trigger.textContent).toContain("Penetration");
    expect(trigger.textContent).toContain("Mythical");
    expect(trigger.textContent).not.toMatch(/Rank|\d\s*\/\s*\d/);

    const expectedSkillIds = [...selected.build.skills];
    expectedSkillIds[2] = "penetration";
    const expectedRarities = expectedSkillIds.map((id) => getSkill(id).rarity);
    expectedRarities[2] = "mythical";
    await click(mounted.querySelector(".character-details__practice > button"));
    expect(asked).toEqual([{
      archetypeId: selected.id,
      keepsakeId: STARTING_COMBAT_ITEMS[0].id,
      preview: true,
      testSkillIds: expectedSkillIds,
      testSkillRarities: expectedRarities,
    }]);
  });

  it("starts the selected authored character without asking for a name or face", async () => {
    const begun = [];
    const mounted = await render(<ControlledStart onBegin={(draft) => begun.push(draft)} />);
    await click(mounted.querySelectorAll(".character-choice-card")[4]);
    const begin = mounted.querySelector(".character-preview__begin");
    expect(begin.disabled).toBe(false);
    await click(begin);
    expect(begun).toEqual([{
      archetypeId: STARTING_ARCHETYPES[4].id,
      keepsakeId: STARTING_COMBAT_ITEMS[0].id,
      preview: true,
    }]);
  });

  it("carries the selected combat keepsake into the authored start", async () => {
    const begun = [];
    const mounted = await render(<ControlledStart onBegin={(draft) => begun.push(draft)} />);
    await click(mounted.querySelector(".character-choice-card"));
    const select = mounted.querySelector(".character-preview__keepsake select");
    expect(select.querySelectorAll("option")).toHaveLength(4);
    await change(select, "fire-pot");
    expect(mounted.querySelector(".character-preview__keepsake").textContent)
      .toContain("Strike for 150% ATK");
    await click(mounted.querySelector(".character-preview__begin"));
    expect(begun[0]).toMatchObject({ keepsakeId: "fire-pot" });
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
    vi.useFakeTimers();
    try {
      const compiled = compileCharacterBootstrap({ archetypeId: "arctic-knight", origin: "archetype" });
      const before = JSON.stringify(compiled.receipt);
      const mounted = await render(
        <PracticeFight receipt={compiled.receipt} scenarioId="training-yard" onExit={() => {}} />,
      );

      for (let round = 0; round < 80 && mounted.querySelector(".tow-combat"); round += 1) {
        const action = [...mounted.querySelectorAll(".production-combat__action")]
          .find((button) => button.getAttribute("aria-disabled") !== "true");
        // A control or hostile-Priority window intentionally has no commandable button.
        // Advance its automatic stand-down timer instead of mistaking that presentation
        // state for a deadlocked practice fight.
        if (action) await click(action);
        await act(async () => vi.runAllTimersAsync());
      }

      const result = mounted.querySelector(".practice-fight--result");
      expect(result).toBeTruthy();
      expect(result.querySelector(".practice-fight__receipt").textContent).toContain("verified");
      expect(result.textContent).toContain("Nothing here was written down");
      expect(JSON.stringify(compiled.receipt)).toBe(before);
    } finally {
      vi.useRealTimers();
    }
  });

  it("swaps a legal five-action practice kit without changing the journey start", async () => {
    const asked = [];
    const begun = [];
    const mounted = await render(
      <ControlledStart
        onPractice={(draft, scenarioId) => asked.push([draft, scenarioId])}
        onBegin={(draft) => begun.push(draft)}
      />,
    );
    const selected = STARTING_ARCHETYPES[5];
    await click(mounted.querySelectorAll(".character-choice-card")[5]);
    await click(mounted.querySelector(".character-preview__details-button"));

    const editor = mounted.querySelector('[aria-label="Selectable loadout"]');
    let triggers = editor.querySelectorAll(".ability-swap-picker__trigger");
    expect(triggers).toHaveLength(5);
    expect(editor.querySelector("select")).toBeNull();

    await click(triggers[0]);
    let panel = document.querySelector('.ability-swap-picker__panel[role="dialog"]');
    let options = panel.querySelectorAll('[role="option"]');
    expect(options).toHaveLength(3);
    const replacementBasicOption = [...options]
      .find((option) => option.dataset.skillId !== selected.build.skills[0]);
    const replacementBasic = replacementBasicOption.dataset.skillId;
    await click(replacementBasicOption);
    await click(panel.querySelector('[data-action="confirm-ability-swap"]'));

    triggers = editor.querySelectorAll(".ability-swap-picker__trigger");
    await click(triggers[2]);
    panel = document.querySelector('.ability-swap-picker__panel[role="dialog"]');
    expect(panel.querySelector('[role="tab"][data-group-id="exclusive"]').getAttribute("aria-selected"))
      .toBe("true");
    expect(panel.querySelectorAll('[role="option"]')).toHaveLength(17);
    await click(panel.querySelector('[role="tab"][data-group-id="general"]'));
    options = panel.querySelectorAll('[role="option"]');
    expect(options).toHaveLength(18);
    await click(panel.querySelector('[role="option"][data-skill-id="penetration"]'));
    await click(panel.querySelector('[data-action="confirm-ability-swap"]'));

    triggers = editor.querySelectorAll(".ability-swap-picker__trigger");
    expect(triggers[2].textContent).toContain("Penetration");
    await click(triggers[3]);
    panel = document.querySelector('.ability-swap-picker__panel[role="dialog"]');
    await click(panel.querySelector('[role="tab"][data-group-id="general"]'));
    const duplicate = panel.querySelector('[role="option"][data-skill-id="penetration"]');
    expect(duplicate.getAttribute("aria-disabled")).toBe("true");
    expect(duplicate.querySelector(".ability-swap-picker__availability").textContent).toBe("In slot 3");
    await keydown(duplicate, "Escape");
    expect(document.querySelector(".ability-swap-picker__panel")).toBeNull();
    expect(mounted.querySelector(".practice-loadout-editor__note").textContent)
      .toContain("Practice loadout modified");

    const expectedTestSkills = [
      replacementBasic,
      selected.build.skills[1],
      "penetration",
      selected.build.skills[3],
      selected.build.skills[4],
    ];
    await click(mounted.querySelector(".character-details__practice > button"));
    expect(asked).toEqual([[{
      archetypeId: selected.id,
      keepsakeId: STARTING_COMBAT_ITEMS[0].id,
      preview: true,
      testSkillIds: expectedTestSkills,
    }, PRACTICE_SCENARIOS[0].id]]);

    await click(mounted.querySelector(".character-details__close"));
    await click(mounted.querySelector(".character-preview__begin"));
    expect(begun).toEqual([{
      archetypeId: selected.id,
      keepsakeId: STARTING_COMBAT_ITEMS[0].id,
      preview: true,
    }]);
  });
});
