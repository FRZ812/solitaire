// @vitest-environment jsdom

import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { compileCharacterBootstrap } from "../../gameplay/tow/character-bootstrap.js";
import {
  DEFAULT_STARTING_KEEPSAKE_ID,
  STARTING_KEEPSAKES,
} from "../../gameplay/tow/keepsakes.js";
import {
  DEFAULT_PRACTICE_ALLY_GROUP_ID,
  PRACTICE_ALLY_GROUPS,
  PRACTICE_SCENARIOS,
} from "../../gameplay/tow/practice-scenarios.js";
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

async function chooseAndConfirmCombatAction(mounted, action) {
  await click(action);

  const confirmation = mounted.querySelector("[data-testid='tow-target-confirmation']");
  if (!confirmation) return;
  const commit = confirmation.querySelector(".tow-combat__target-commit");
  if (commit.disabled) {
    const anchor = [...mounted.querySelectorAll(".tow-formation-cell.is-valid-anchor")]
      .find((cell) => !cell.disabled);
    await click(anchor);
  }
  expect(commit.disabled).toBe(false);
  await click(commit);
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
    const expectedPortraitFiles = [
      "knight-portrait-v5.png",
      "ranger-portrait-v6.png",
      "artificer-portrait-v5.png",
      "berserker-portrait-v5.png",
      "sorcerer-portrait-v5.png",
      "rogue-portrait-v5.png",
      "warlock-portrait-v5.png",
      "wizard-portrait-v5.png",
      "paladin-portrait-v5.png",
      "blademaster-portrait-v5.png",
      "vampire-portrait-v5.png",
      "automaton-portrait-v5.png",
    ];
    expect(mounted.querySelectorAll(".character-choice-card")).toHaveLength(STARTING_ARCHETYPES.length);
    expect(mounted.querySelectorAll(".character-choice-card img")).toHaveLength(STARTING_ARCHETYPES.length);
    expect(mounted.querySelectorAll(".character-choice-card__copy strong")).toHaveLength(STARTING_ARCHETYPES.length);
    STARTING_ARCHETYPES.forEach((entry, index) => {
      const card = mounted.querySelectorAll(".character-choice-card")[index];
      const portraitSrc = mounted.querySelectorAll(".character-choice-card__art")[index].getAttribute("src");
      expect(portraitSrc).toBe(resolvePlayerCombatCutout(entry.character.portraitKey, entry.character));
      expect(portraitSrc).toMatch(new RegExp(`${expectedPortraitFiles[index].replace(".", "\\.")}$`));
      expect(card.getAttribute("aria-label")).toContain(entry.role);
      expect(card.getAttribute("aria-label")).toContain(`${entry.attention} attention`);
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

  it("surfaces the live combat readout and launches disposable practice without opening details", async () => {
    const asked = [];
    const selected = STARTING_ARCHETYPES[2];
    const mounted = await render(
      <ControlledStart onPractice={(draft, scenarioId, allyGroupId) => (
        asked.push([draft, scenarioId, allyGroupId])
      )} />,
    );

    const card = mounted.querySelectorAll(".character-choice-card")[2];
    expect(card.textContent).toContain(selected.role);
    expect(card.textContent).toContain(`${selected.attention} attention`);
    await click(card);

    const readout = mounted.querySelector(".character-preview__combat-readout");
    expect(readout).toBeTruthy();
    expect(readout.textContent).toContain(`HP${selected.baseStats.maxHp}`);
    expect(readout.textContent).toContain(`Resolve${selected.baseStats.resolveMax}`);
    expect(readout.textContent).toContain(`ATK${selected.baseStats.attack}`);
    expect(readout.textContent).toContain(`DEF${selected.baseStats.defense}`);
    expect(mounted.querySelector(".character-details")).toBeNull();

    await click(mounted.querySelector(".character-preview__practice-button"));
    expect(asked).toEqual([[
      {
        archetypeId: selected.id,
        keepsakeId: DEFAULT_STARTING_KEEPSAKE_ID,
        preview: true,
      },
      PRACTICE_SCENARIOS[0].id,
      DEFAULT_PRACTICE_ALLY_GROUP_ID,
    ]]);
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
      <ControlledStart onPractice={(draft, scenarioId, allyGroupId) => (
        asked.push([draft, scenarioId, allyGroupId])
      )} />,
    );
    await click(mounted.querySelectorAll(".character-choice-card")[6]);
    expect(mounted.querySelector(".character-details")).toBeNull();

    await click(mounted.querySelector(".character-preview__details-button"));
    const details = mounted.querySelector(".character-details");
    expect(details).toBeTruthy();
    expect(details.textContent).toContain("Starting equipment");
    expect(details.textContent).toContain("Starting fusions");
    expect(details.textContent).toContain("Select loadout");
    expect(details.textContent).toContain("Reusable combat kit");
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
    expect(loadoutEditor.querySelector(".ability-swap-picker__trigger-uses").textContent)
      .toContain("No Resolve · Damage · One enemy");

    const allyPicker = details.querySelector('[role="combobox"][aria-label="Allied formation"]');
    await click(allyPicker);
    const allyOptions = details.querySelectorAll('[role="listbox"][aria-label="Allied formation choices"] [role="option"]');
    expect(allyOptions).toHaveLength(PRACTICE_ALLY_GROUPS.length);
    await click(allyOptions[1]);
    expect(allyPicker.textContent).toContain(PRACTICE_ALLY_GROUPS[1].name);

    const enemyPicker = details.querySelector('[role="combobox"][aria-label="Enemy formation"]');
    await click(enemyPicker);
    const enemyOptions = details.querySelectorAll('[role="listbox"][aria-label="Enemy formation choices"] [role="option"]');
    expect(enemyOptions).toHaveLength(PRACTICE_SCENARIOS.length);
    await click(enemyOptions[1]);
    expect(enemyPicker.textContent).toContain(PRACTICE_SCENARIOS[1].name);

    await click(details.querySelector(".character-details__practice > button"));
    expect(asked).toEqual([[
      {
        archetypeId: STARTING_ARCHETYPES[6].id,
        keepsakeId: DEFAULT_STARTING_KEEPSAKE_ID,
        preview: true,
      },
      PRACTICE_SCENARIOS[1].id,
      PRACTICE_ALLY_GROUPS[1].id,
    ]]);
  });

  it("keeps the longest multi-role ability metadata structured and complete", async () => {
    const mounted = await render(<ControlledStart />);
    await click(mounted.querySelectorAll(".character-choice-card")[10]);
    await click(mounted.querySelector(".character-preview__details-button"));

    const editor = mounted.querySelector('[aria-label="Selectable loadout"]');
    const triggers = editor.querySelectorAll(".ability-swap-picker__trigger");
    await click(triggers[2]);
    const option = document.querySelector('[data-skill-id="vampire-endless-will"]');
    const metadata = option?.querySelector(".ability-swap-picker__option-meta");

    expect(metadata).toBeTruthy();
    expect(metadata.classList.contains("ability-tactical-meta")).toBe(true);
    expect(metadata.querySelectorAll(".ability-tactical-meta__role")).toHaveLength(3);
    expect(metadata.querySelector(".ability-tactical-meta__cost").textContent).toBe("5 Resolve");
    expect(metadata.querySelector(".ability-tactical-meta__target").textContent)
      .toBe("One party member");
    expect(metadata.textContent)
      .toBe("5 Resolve · Guard / control + Empower + Cleanse · One party member · uses action");
    expect(metadata.getAttribute("aria-label")).toBe(metadata.textContent);
  });

  it("supports keyboard selection in the custom enemy formation picker", async () => {
    const mounted = await render(<ControlledStart />);
    await click(mounted.querySelectorAll(".character-choice-card")[0]);
    await click(mounted.querySelector(".character-preview__details-button"));
    const picker = mounted.querySelector('[role="combobox"][aria-label="Enemy formation"]');

    await keydown(picker, "ArrowDown");
    expect(picker.getAttribute("aria-expanded")).toBe("true");
    await keydown(picker, "ArrowDown");
    await keydown(picker, "Enter");
    expect(picker.getAttribute("aria-expanded")).toBe("false");
    expect(picker.textContent).toContain(PRACTICE_SCENARIOS[1].name);
  });

  it("describes the Rogue loadout from its real damage and status effects", async () => {
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

    const editor = mounted.querySelector('[aria-label="Selectable loadout"]');
    const trigger = editor.querySelectorAll(".ability-swap-picker__trigger")[0];
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

    await click(editor.querySelectorAll(".ability-swap-picker__trigger")[2]);
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
      keepsakeId: DEFAULT_STARTING_KEEPSAKE_ID,
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

    const editor = mounted.querySelector('[aria-label="Selectable loadout"]');
    const trigger = editor.querySelectorAll(".ability-swap-picker__trigger")[2];
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
      .toContain("340% ATK");
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
      keepsakeId: DEFAULT_STARTING_KEEPSAKE_ID,
      preview: true,
      testSkillIds: expectedSkillIds,
      testSkillRarities: expectedRarities,
    }]);
  });

  it("starts the selected archetype representative without asking for a name or face", async () => {
    const begun = [];
    const mounted = await render(<ControlledStart onBegin={(draft) => begun.push(draft)} />);
    await click(mounted.querySelectorAll(".character-choice-card")[4]);
    const begin = mounted.querySelector(".character-preview__begin");
    expect(begin.disabled).toBe(false);
    await click(begin);
    expect(begun).toEqual([{
      archetypeId: STARTING_ARCHETYPES[4].id,
      keepsakeId: DEFAULT_STARTING_KEEPSAKE_ID,
      preview: true,
    }]);
  });

  it("uses the custom keepsake catalogue for permanent relics and one-use supplies", async () => {
    const begun = [];
    const mounted = await render(<ControlledStart onBegin={(draft) => begun.push(draft)} />);
    await click(mounted.querySelector(".character-choice-card"));
    const trigger = mounted.querySelector(".character-preview__keepsake .keepsake-picker__trigger");
    expect(trigger.textContent).toContain("Threadbare War Ribbon");
    expect(trigger.querySelector("img")?.getAttribute("src")).toMatch(/threadbare-war-ribbon-v1\.webp$/);

    await click(trigger);
    let panel = document.querySelector(".keepsake-picker__panel");
    expect(panel.querySelectorAll('[role="option"]')).toHaveLength(6);
    expect(panel.querySelectorAll(".ability-swap-picker__option-art img")).toHaveLength(6);
    const redWolf = panel.querySelector('[data-keepsake-id="red-wolf-token"]');
    expect(redWolf.querySelector(".ability-swap-picker__option-summary").textContent)
      .toBe("The Red Wolves pressed one into the hand of every recruit who survived their first winter.");
    expect(redWolf.querySelector(".ability-swap-picker__option-meta").textContent)
      .toBe("+3 ATK · +3% Critical");
    const lockedHalo = panel.querySelector('[data-keepsake-id="saints-broken-halo"]');
    expect(lockedHalo.getAttribute("aria-disabled")).toBeNull();
    await click(lockedHalo);
    expect(panel.querySelector(".keepsake-picker__unlock").textContent).toContain("Hold the Line");
    expect(panel.querySelector('[data-action="confirm-keepsake"]').disabled).toBe(true);

    await click(panel.querySelector('[role="tab"][data-group-id="supply"]'));
    panel = document.querySelector(".keepsake-picker__panel");
    expect(panel.querySelectorAll('[role="option"]')).toHaveLength(4);
    expect(STARTING_KEEPSAKES).toHaveLength(10);
    await click(panel.querySelector('[data-keepsake-id="fire-pot"]'));
    await click(panel.querySelector('[data-action="confirm-keepsake"]'));
    expect(document.querySelector(".keepsake-picker__panel")).toBeNull();
    expect(trigger.textContent).toContain("Fire Pot");
    expect(trigger.textContent).toContain("150% ATK");
    await click(mounted.querySelector(".character-preview__begin"));
    expect(begun[0]).toMatchObject({ keepsakeId: "fire-pot" });
  });

  it("enables an achievement relic without changing the selector contract", async () => {
    const mounted = await render(
      <ControlledStart unlockedAchievementIds={["hold-the-line"]} />,
    );
    await click(mounted.querySelector(".character-choice-card"));
    const trigger = mounted.querySelector(".character-preview__keepsake .keepsake-picker__trigger");
    await click(trigger);
    const panel = document.querySelector(".keepsake-picker__panel");
    await click(panel.querySelector('[data-keepsake-id="saints-broken-halo"]'));
    expect(panel.querySelector('[data-action="confirm-keepsake"]').disabled).toBe(false);
    await click(panel.querySelector('[data-action="confirm-keepsake"]'));
    expect(trigger.textContent).toContain("Saint's Broken Halo");
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
      expect([...dialog.querySelectorAll("[aria-label='Player formation'] .tow-formation-cell.has-unit")]
        .some((cell) => cell.getAttribute("aria-label").includes(entry.character.name)), entry.id).toBe(true);
      expect([...dialog.querySelectorAll(".production-combat__action")]
        .some((button) => button.getAttribute("aria-disabled") !== "true"), entry.id).toBe(true);
      expect(dialog.querySelector("[data-testid='tow-enemy-intent']")?.getAttribute("aria-label"), entry.id)
        .toMatch(/(?:damage|effect).*(?:targeting|used on)/i);

      await act(async () => root.unmount());
      container.remove();
      root = null;
      container = null;
    }
  });

  it("renders the selected three-member allied formation with portrait art", async () => {
    const allyGroup = PRACTICE_ALLY_GROUPS.find((group) => group.allies.length === 2);
    expect(allyGroup).toBeTruthy();
    const compiled = compileCharacterBootstrap({ archetypeId: "arctic-knight", origin: "archetype" });
    const mounted = await render(
      <PracticeFight
        receipt={compiled.receipt}
        scenarioId="training-yard"
        allyGroupId={allyGroup.id}
        onExit={() => {}}
      />,
    );

    const occupied = mounted.querySelectorAll(".tow-formation-cell[data-side='player'].has-unit");
    expect(occupied).toHaveLength(3);
    expect([...occupied].every((cell) => cell.querySelector(".tow-formation-unit__figure img")))
      .toBe(true);
    expect([...occupied].every((cell) => (
      cell.querySelector(".tow-formation-unit__meter--hp")
      && cell.querySelector(".tow-formation-unit__meter--resolve")
    ))).toBe(true);
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
        if (action) await chooseAndConfirmCombatAction(mounted, action);
        await act(async () => vi.runAllTimersAsync());
      }

      const result = mounted.querySelector(".practice-fight--result");
      expect(result).toBeTruthy();
      expect(result.querySelector(".practice-fight__receipt").textContent).toContain("verified");
      expect(result.querySelector(".practice-fight__receipt").textContent).toContain("Solo");
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
        onPractice={(draft, scenarioId, allyGroupId) => asked.push([draft, scenarioId, allyGroupId])}
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
      keepsakeId: DEFAULT_STARTING_KEEPSAKE_ID,
      preview: true,
      testSkillIds: expectedTestSkills,
    }, PRACTICE_SCENARIOS[0].id, DEFAULT_PRACTICE_ALLY_GROUP_ID]]);

    await click(mounted.querySelector(".character-details__close"));
    await click(mounted.querySelector(".character-preview__begin"));
    expect(begun).toEqual([{
      archetypeId: selected.id,
      keepsakeId: DEFAULT_STARTING_KEEPSAKE_ID,
      preview: true,
    }]);
  });
});
