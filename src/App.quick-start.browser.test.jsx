// @vitest-environment jsdom
//
// The character start at the real App boundary: legacy limbo saves recover into one
// archetype chooser, practice remains disposable, and Begin commits the whole character in
// one local transaction without a narrator dependency.

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
}

async function type(input, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
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
  it("shows eight portrait archetypes and no legacy roster or limbo route", async () => {
    const mounted = await mount();
    const start = await waitFor(() => mounted.querySelector(".archetype-start"));
    expect(start.getAttribute("role")).toBe("dialog");
    expect(start.getAttribute("aria-modal")).toBe("true");
    expect(mounted.querySelector(".game-hud-layer").hasAttribute("inert")).toBe(true);
    expect(start.querySelectorAll(".archetype-card")).toHaveLength(STARTING_ARCHETYPES.length);
    expect(start.querySelectorAll(".archetype-card img")).toHaveLength(STARTING_ARCHETYPES.length);
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

  it("commits name, face, gear, and durable build without returning to limbo", async () => {
    const mounted = await mount();
    const start = await waitFor(() => mounted.querySelector(".archetype-start"));
    const cards = [...start.querySelectorAll(".archetype-card")];
    const faces = [...start.querySelectorAll(".archetype-start__faces button")];
    await click(cards[3]);
    await click(faces[4]);
    await type(start.querySelector(".archetype-start__name input"), "Mira Vale");
    await click(start.querySelector(".archetype-start__begin"));

    await waitFor(() => !mounted.querySelector(".archetype-start"));
    expect(mounted.textContent).toContain("Mira Vale enters Whitemarch");
    expect(mounted.textContent).not.toContain("There is no floor");
    await waitFor(() => harness.serverState.created === true);
    expect(harness.serverState.character).toMatchObject({
      name: "Mira Vale",
      combatArchetypeId: STARTING_ARCHETYPES[3].id,
      progressionModel: "tow-archetype",
      portraitKey: "template:champion-paladin",
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

    await click(start.querySelector(".archetype-start__test"));
    const dialog = await waitFor(() => mounted.querySelector(".tow-combat"));
    expect(dialog.textContent).toContain("Nothing here is written down");
    const actions = [...dialog.querySelectorAll(".production-combat__action")]
      .filter((button) => !button.disabled);
    expect(actions.length).toBeGreaterThan(0);

    await click(actions[0]);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
    expect(harness.serverState.created).toBe(false);
    expect(harness.serverState.mechanics?.tow?.activeCombat ?? null).toBe(null);
    expect(harness.saveCampaign.mock.calls.length).toBe(savesBefore);
  });

  it("returns to the exact same archetype, face, and typed name", async () => {
    const mounted = await mount();
    const start = await waitFor(() => mounted.querySelector(".archetype-start"));
    const cards = [...start.querySelectorAll(".archetype-card")];
    const faces = [...start.querySelectorAll(".archetype-start__faces button")];
    await click(cards[6]);
    await click(faces[2]);
    await type(start.querySelector(".archetype-start__name input"), "Ilyra");
    const before = JSON.stringify(harness.serverState);

    await click(start.querySelector(".archetype-start__test"));
    await waitFor(() => mounted.querySelector(".tow-combat"));
    for (let round = 0; round < 40 && mounted.querySelector(".tow-combat"); round += 1) {
      const action = [...mounted.querySelectorAll(".production-combat__action")]
        .find((button) => !button.disabled);
      if (!action) break;
      await click(action);
    }
    const result = await waitFor(() => mounted.querySelector(".practice-fight--result"));
    await click([...result.querySelectorAll("button")].find((button) => /Back to your build/.test(button.textContent)));

    const restored = await waitFor(() => mounted.querySelector(".archetype-start"));
    expect(restored.querySelector(".archetype-start__name input").value).toBe("Ilyra");
    expect(restored.querySelectorAll(".archetype-card")[6].getAttribute("aria-checked")).toBe("true");
    expect(restored.querySelectorAll(".archetype-start__faces button")[2].getAttribute("aria-checked")).toBe("true");
    expect(JSON.stringify(harness.serverState)).toBe(before);
  });
});
