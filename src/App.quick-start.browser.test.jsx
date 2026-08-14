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
  await act(async () => element.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  if (element.classList?.contains("production-combat__action")) {
    await waitFor(() => !container?.querySelector("[data-testid='tow-action-beat']"), 3000);
  }
}

let root;
let container;

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

  it("returns to the exact same authored-character preview", async () => {
    const mounted = await mount();
    const start = await waitFor(() => mounted.querySelector(".archetype-start"));
    const cards = [...start.querySelectorAll(".character-choice-card")];
    await click(cards[6]);
    const before = JSON.stringify(harness.serverState);

    await click(start.querySelector(".character-preview__details-button"));
    await click(start.querySelector(".character-details__practice > button"));
    await waitFor(() => mounted.querySelector(".tow-combat"));
    for (let round = 0; round < 40 && mounted.querySelector(".tow-combat"); round += 1) {
      const action = [...mounted.querySelectorAll(".production-combat__action")]
        .find((button) => button.getAttribute("aria-disabled") !== "true");
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
    expect(restored.querySelector("select")).toBeNull();
    expect(JSON.stringify(harness.serverState)).toBe(before);
  });
});
