// @vitest-environment jsdom
//
// Phase 4's start lane at the real App boundary. The component tests prove the lane works;
// this proves it is actually wired to the game — that a fresh campaign opens on it, that one
// click reaches a fight, and that trying a build writes nothing.

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { makeInitialState } from "./data/initial-state.js";
import { LAST_OPENED_KEY } from "./engine/campaign-resume.js";
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
    queueMicrotask(() => listener({ id: "quick-start-user", email: "qs@example.test" }));
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
  throw new Error("Timed out waiting for the start lane");
}

async function click(element) {
  expect(element).toBeTruthy();
  await act(async () => element.dispatchEvent(new MouseEvent("click", { bubbles: true })));
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
  localStorage.setItem(LAST_OPENED_KEY, "quick-start-campaign");
  // A campaign in limbo: created:false, nothing spoken yet. This is the start screen.
  harness.serverState = makeInitialState();
  harness.listCampaigns.mockReset().mockResolvedValue([
    { id: "quick-start-campaign", name: "New campaign", schema_version: "v12" },
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

describe("the start opens on Quick Start", () => {
  it("shows the lane, its six people, and the five facts", async () => {
    const mounted = await mount();
    const lane = await waitFor(() => mounted.querySelector(".quick-start"));
    expect(lane.getAttribute("role")).toBe("dialog");
    expect(lane.getAttribute("aria-modal")).toBe("true");
    expect(mounted.querySelector(".game-hud-layer").hasAttribute("inert")).toBe(true);
    expect(mounted.querySelector(".game-hud-layer").getAttribute("aria-hidden")).toBe("true");
    expect(lane.querySelectorAll(".quick-start__choice")).toHaveLength(6);
    expect([...lane.querySelectorAll(".quick-start__fact-label")].map((n) => n.textContent))
      .toEqual(["Role", "Opens with", "Your actions", "How rationed", "Attention"]);
    // The roster is still there, one click away.
    expect(lane.querySelector(".quick-start__other")).toBeTruthy();
  });

  it("recovers an older limbo save even when it already contains a player reply", async () => {
    harness.serverState.beats.push({
      id: "legacy-player-reply",
      type: "player",
      content: "My name is Wanderer.",
    });

    const mounted = await mount();
    const lane = await waitFor(() => mounted.querySelector(".quick-start"));
    expect(lane.getAttribute("aria-modal")).toBe("true");
    expect(mounted.querySelector(".game-hud-layer").hasAttribute("inert")).toBe(true);
    expect(harness.serverState.created).toBe(false);
  });

  it("reaches the roster lane without leaving the start", async () => {
    const mounted = await mount();
    const lane = await waitFor(() => mounted.querySelector(".quick-start"));
    await click(lane.querySelector(".quick-start__other"));
    await waitFor(() => !mounted.querySelector(".quick-start"));
    expect(mounted.textContent.length).toBeGreaterThan(0);
  });
});

describe("one click from the start reaches a fight", () => {
  it("opens a real, commandable encounter and writes nothing", async () => {
    const mounted = await mount();
    const lane = await waitFor(() => mounted.querySelector(".quick-start"));
    const savesBefore = harness.saveCampaign.mock.calls.length;

    await click(lane.querySelector(".quick-start__try"));
    const dialog = await waitFor(() => mounted.querySelector(".tow-combat"));
    expect(dialog.textContent).toContain("Nothing here is written down");
    const actions = [...dialog.querySelectorAll(".production-combat__action")]
      .filter((button) => !button.disabled);
    expect(actions.length).toBeGreaterThan(0);

    // Spend a real action, and the campaign still has no character and no combat.
    await click(actions[0]);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
    expect(harness.serverState.created).toBe(false);
    expect(harness.serverState.mechanics?.tow?.activeCombat ?? null).toBe(null);
    expect(harness.saveCampaign.mock.calls.length).toBe(savesBefore);
  });

  it("comes back to the lane with the campaign untouched", async () => {
    const mounted = await mount();
    const lane = await waitFor(() => mounted.querySelector(".quick-start"));
    const before = JSON.stringify(harness.serverState);

    await click(lane.querySelector(".quick-start__try"));
    await waitFor(() => mounted.querySelector(".tow-combat"));

    // Fight to the end, then leave.
    for (let round = 0; round < 30 && mounted.querySelector(".tow-combat"); round += 1) {
      const action = [...mounted.querySelectorAll(".production-combat__action")]
        .find((button) => !button.disabled);
      if (!action) break;
      await click(action);
    }
    const result = await waitFor(() => mounted.querySelector(".practice-fight--result"));
    await click([...result.querySelectorAll("button")].find((b) => /Back to your build/.test(b.textContent)));

    await waitFor(() => mounted.querySelector(".quick-start"));
    expect(JSON.stringify(harness.serverState)).toBe(before);
  });
});
