// @vitest-environment jsdom
//
// The authored-character start at the real App boundary: legacy limbo saves recover into
// one portrait grid, practice remains disposable, and Begin commits the complete fixed
// character in one local transaction without a narrator dependency.

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { makeInitialState } from "./data/initial-state.js";
import { LAST_OPENED_KEY } from "./engine/campaign-resume.js";
import { DEFAULT_STARTING_KEEPSAKE_ID, STARTING_KEEPSAKES } from "./gameplay/tow/keepsakes.js";
import {
  PRACTICE_ALLY_GROUPS,
  PRACTICE_SCENARIOS,
} from "./gameplay/tow/practice-scenarios.js";
import { STARTING_ARCHETYPES } from "./gameplay/tow/starting-archetypes.js";
import { Solitaire } from "./App.jsx";

const harness = vi.hoisted(() => ({
  serverState: null,
  saveCampaign: vi.fn(),
  loadCampaignRecord: vi.fn(),
  listCampaigns: vi.fn(),
}));

vi.mock("./engine/api-supabase.js", () => ({
  callNarrator: vi.fn(async () => ({ story: [{ type: "beat", text: "..." }], minutes_passed: 0 })),
}));

vi.mock("./engine/auth-supabase.js", () => ({
  isSubscribed: vi.fn(async () => true),
  linkEmail: vi.fn(async () => {}),
  onAuthChange: (listener) => {
    queueMicrotask(() => listener({ id: "archetype-start-user", email: "start@example.test" }));
    return () => {};
  },
  signOut: vi.fn(async () => {}),
}));

vi.mock("./engine/campaigns-supabase.js", () => ({
  deleteCampaign: vi.fn(async () => {}),
  listCampaigns: harness.listCampaigns,
  loadCampaignRecord: harness.loadCampaignRecord,
  renameCampaign: vi.fn(async () => {}),
  saveCampaign: harness.saveCampaign,
}));

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

async function waitFor(assertion, timeout = 5000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = assertion();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
  }
  if (lastError) throw lastError;
  throw new Error("Timed out waiting for the character start");
}

async function click(element) {
  expect(element).toBeTruthy();
  const combatAction = element.classList?.contains("production-combat__action");
  await act(async () => element.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  if (combatAction) {
    let confirmation = container?.querySelector('[data-testid="tow-target-confirmation"]');
    if (confirmation) {
      let confirm = [...confirmation.querySelectorAll("button")]
        .find((button) => button.textContent.trim() === "Confirm");
      if (confirm?.disabled) {
        const anchor = await waitFor(() => (
          container?.querySelector(
            '[aria-label="Battle formations"] .tow-formation-cell.is-valid-anchor:not(:disabled)',
          )
        ));
        await act(async () => anchor.dispatchEvent(new MouseEvent("click", { bubbles: true })));
        confirmation = await waitFor(() => (
          container?.querySelector('[data-testid="tow-target-confirmation"]')
        ));
        confirm = await waitFor(() => {
          const button = [...confirmation.querySelectorAll("button")]
            .find((candidate) => candidate.textContent.trim() === "Confirm");
          return button && !button.disabled ? button : null;
        });
      }
      expect(confirm).toBeTruthy();
      expect(confirm.disabled).toBe(false);
      await act(async () => confirm.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    }

    await waitFor(() => {
      const combat = container?.querySelector(".tow-combat");
      return !combat || combat.getAttribute("aria-busy") !== "true";
    }, 6000);
  }
}

let root;
let container;
let originalMatchMedia;

async function mount() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<Solitaire />));
  return container;
}

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  // This test proves the campaign boundary, not the real-time duration of every combat beat.
  // Exercise the product's accessible reduced-motion path so forty possible commands do not
  // turn one reversibility assertion into a minute-long animation test.
  originalMatchMedia = globalThis.matchMedia;
  globalThis.matchMedia = (query) => ({
    matches: query === "(prefers-reduced-motion: reduce)",
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
});
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(LAST_OPENED_KEY, "archetype-start-campaign");
  harness.serverState = makeInitialState();
  harness.listCampaigns.mockReset().mockResolvedValue([
    { id: "archetype-start-campaign", name: "New campaign", schema_version: "v12" },
  ]);
  harness.loadCampaignRecord.mockReset().mockImplementation(async () => ({
    state: cloneJson(harness.serverState),
    updatedAt: "2026-08-12T12:00:00.000Z",
  }));
  harness.saveCampaign.mockReset().mockImplementation(async (id, state) => {
    harness.serverState = cloneJson(state);
    return { id, updatedAt: "2026-08-12T12:00:01.000Z" };
  });
});

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.clearAllTimers();
});

afterAll(() => {
  vi.restoreAllMocks();
  if (originalMatchMedia) globalThis.matchMedia = originalMatchMedia;
  else delete globalThis.matchMedia;
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

describe("one new-campaign start", () => {
  it("shows eight complete characters and no legacy roster or limbo route", async () => {
    const mounted = await mount();
    const start = await waitFor(() => mounted.querySelector(".archetype-start"));
    expect(start.getAttribute("role")).toBe("dialog");
    expect(start.getAttribute("aria-modal")).toBe("true");
    expect(mounted.querySelector(".game-hud-layer").hasAttribute("inert")).toBe(true);
    expect(start.querySelectorAll(".character-choice-card")).toHaveLength(STARTING_ARCHETYPES.length);
    expect(start.querySelectorAll(".character-choice-card img")).toHaveLength(STARTING_ARCHETYPES.length);
    expect(start.querySelector("input")).toBeNull();
    expect(start.querySelector("select")).toBeNull();
    expect(start.textContent).not.toContain("Choose a life, or forge your own");
    expect(start.textContent).not.toContain("Enter the limbo");
    expect(start.textContent).not.toMatch(/\bLevel\b/);
  });

  it("recovers an older limbo save even when it already contains a player reply", async () => {
    harness.serverState.beats.push({
      id: "legacy-player-reply",
      type: "player",
      content: "My name is Wanderer.",
    });

    const mounted = await mount();
    const start = await waitFor(() => mounted.querySelector(".archetype-start"));
    expect(start.getAttribute("aria-modal")).toBe("true");
    expect(start.textContent).not.toContain("My name is Wanderer.");
    expect(harness.serverState.created).toBe(false);
  });

  it("commits the selected authored identity, gear, and durable build without returning to limbo", async () => {
    const mounted = await mount();
    const start = await waitFor(() => mounted.querySelector(".archetype-start"));
    const cards = [...start.querySelectorAll(".character-choice-card")];
    await click(cards[3]);
    await click(start.querySelector(".character-preview__begin"));

    await waitFor(() => !mounted.querySelector(".archetype-start"));
    expect(mounted.textContent).toContain(`${STARTING_ARCHETYPES[3].character.name} enters Whitemarch`);
    expect(mounted.textContent).not.toContain("There is no floor");
    await waitFor(() => harness.serverState.created === true);
    expect(harness.serverState.character).toMatchObject({
      name: STARTING_ARCHETYPES[3].character.name,
      combatArchetypeId: STARTING_ARCHETYPES[3].id,
      progressionModel: "tow-archetype",
      towBaseStats: STARTING_ARCHETYPES[3].baseStats,
      portraitKey: STARTING_ARCHETYPES[3].character.portraitKey,
    });
    expect(harness.serverState.mechanics.bootstrapOrigin).toBe("archetype");
    expect(harness.serverState.world.codex.characters.wanderer.worn.length).toBeGreaterThan(0);
  });
});

describe("practice is reversible and writes nothing", () => {
  it("opens a real commandable encounter without touching the campaign", async () => {
    const mounted = await mount();
    const start = await waitFor(() => mounted.querySelector(".archetype-start"));
    const savesBefore = harness.saveCampaign.mock.calls.length;

    await click(start.querySelectorAll(".character-choice-card")[0]);
    await click(start.querySelector(".character-preview__details-button"));
    await click(start.querySelector(".character-details__practice > button"));
    const dialog = await waitFor(() => mounted.querySelector(".tow-combat"));
    expect(dialog.textContent).toContain("Nothing here is written down");
    const actions = [...dialog.querySelectorAll(".production-combat__action")]
      .filter((button) => button.getAttribute("aria-disabled") !== "true");
    expect(actions.length).toBeGreaterThan(0);

    await click(actions[0]);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
    expect(harness.serverState.created).toBe(false);
    expect(harness.serverState.mechanics?.tow?.activeCombat ?? null).toBe(null);
    expect(harness.saveCampaign.mock.calls.length).toBe(savesBefore);
  });

  it("launches the selected allied and enemy formations through the App boundary", async () => {
    const alliedGroup = PRACTICE_ALLY_GROUPS.find((entry) => entry.id === "expedition-trio");
    const enemyGroup = PRACTICE_SCENARIOS.find((entry) => entry.id === "formation-drill");
    expect(alliedGroup).toBeTruthy();
    expect(enemyGroup).toBeTruthy();

    const mounted = await mount();
    const start = await waitFor(() => mounted.querySelector(".archetype-start"));
    const savesBefore = harness.saveCampaign.mock.calls.length;
    await click(start.querySelectorAll(".character-choice-card")[0]);
    await click(start.querySelector(".character-preview__details-button"));
    const details = await waitFor(() => mounted.querySelector(".character-details"));

    const alliedPicker = details.querySelector('[role="combobox"][aria-label="Allied formation"]');
    await click(alliedPicker);
    const alliedList = details.querySelector('[role="listbox"][aria-label="Allied formation choices"]');
    await click([...alliedList.querySelectorAll('[role="option"]')]
      .find((option) => option.textContent.includes(alliedGroup.name)));
    expect(alliedPicker.textContent).toContain(alliedGroup.name);

    const enemyPicker = details.querySelector('[role="combobox"][aria-label="Enemy formation"]');
    await click(enemyPicker);
    const enemyList = details.querySelector('[role="listbox"][aria-label="Enemy formation choices"]');
    await click([...enemyList.querySelectorAll('[role="option"]')]
      .find((option) => option.textContent.includes(enemyGroup.name)));
    expect(enemyPicker.textContent).toContain(enemyGroup.name);

    await click(details.querySelector(".character-details__practice > button"));
    const combat = await waitFor(() => mounted.querySelector(".tow-combat"));
    const alliedFormation = await waitFor(() => combat.querySelector('[aria-label="Player formation"]'));
    const enemyFormation = combat.querySelector('[aria-label="Enemy formation"]');
    expect(alliedFormation.querySelectorAll(".tow-formation-cell.has-unit"))
      .toHaveLength(alliedGroup.allies.length + 1);
    expect(enemyFormation.querySelectorAll(".tow-formation-cell.has-unit"))
      .toHaveLength(enemyGroup.enemies.length);

    const commanders = [...combat.querySelectorAll(".production-combat__commander")];
    expect(commanders).toHaveLength(alliedGroup.allies.length + 1);
    const paladinCommander = commanders.find((button) => button.textContent.includes("Paladin"));
    await click(paladinCommander);
    expect(paladinCommander.getAttribute("aria-pressed")).toBe("true");
    const paladinAction = [...combat.querySelectorAll(".production-combat__action")]
      .find((button) => button.getAttribute("aria-disabled") !== "true");
    await click(paladinAction);
    await waitFor(() => paladinCommander.querySelector("strong")?.textContent === "0");

    expect(harness.serverState.created).toBe(false);
    expect(harness.serverState.mechanics?.tow?.activeCombat ?? null).toBe(null);
    expect(harness.saveCampaign.mock.calls.length).toBe(savesBefore);
  });

  it("returns to the exact same authored-character preview", async () => {
    const mounted = await mount();
    const start = await waitFor(() => mounted.querySelector(".archetype-start"));
    const cards = [...start.querySelectorAll(".character-choice-card")];
    await click(cards[6]);
    const before = JSON.stringify(harness.serverState);

    await click(start.querySelector(".character-preview__details-button"));
    await click(start.querySelector(".character-details__practice > button"));
    await waitFor(() => mounted.querySelector(".tow-combat"));
    for (let round = 0; round < 80 && mounted.querySelector(".tow-combat"); round += 1) {
      let action = [...mounted.querySelectorAll(".production-combat__action")]
        .find((button) => button.getAttribute("aria-disabled") !== "true");
      if (!action) {
        // Stun, Paralyze, Sleep and hostile Priority now advance without player input. Wait
        // for that real scheduler command instead of treating a correctly locked deck as the
        // end of the practice script.
        await waitFor(() => (
          mounted.querySelector(".practice-fight--result")
          || [...mounted.querySelectorAll(".production-combat__action")]
            .some((button) => button.getAttribute("aria-disabled") !== "true")
        ), 3000);
        if (mounted.querySelector(".practice-fight--result")) break;
        action = [...mounted.querySelectorAll(".production-combat__action")]
          .find((button) => button.getAttribute("aria-disabled") !== "true");
      }
      if (!action) break;
      await click(action);
    }
    const result = await waitFor(() => mounted.querySelector(".practice-fight--result"));
    await click([...result.querySelectorAll("button")].find((button) => /Back to your build/.test(button.textContent)));

    const restored = await waitFor(() => mounted.querySelector(".archetype-start"));
    expect(restored.querySelector(".character-preview__copy h1").textContent)
      .toBe(STARTING_ARCHETYPES[6].character.name);
    expect(restored.querySelectorAll(".character-preview__carousel [role=radio]")[6].getAttribute("aria-checked"))
      .toBe("true");
    expect(restored.querySelector("input")).toBeNull();
    const keepsake = restored.querySelector(".character-preview__keepsake .keepsake-picker__trigger");
    expect(STARTING_KEEPSAKES).toHaveLength(10);
    expect(keepsake.getAttribute("aria-label")).toContain(
      STARTING_KEEPSAKES.find((entry) => entry.id === DEFAULT_STARTING_KEEPSAKE_ID).name,
    );
    expect(JSON.stringify(harness.serverState)).toBe(before);
  }, 30_000);
});
