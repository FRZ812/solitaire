// @vitest-environment jsdom
//
// The Tower of Winter rebuild ships dark. Until a whole fight works on the new kernel,
// the deterministic loop is a two-action placeholder, so a shipped build must keep every
// live encounter on the legacy deck loop — no half-states in front of a player.
//
// This file deliberately does NOT stub VITE_ENABLE_REFERENCE_GAMEPLAY_PREVIEW, so it runs
// the gate closed. App.production-combat.browser.test.jsx runs it open.

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { makeInitialState } from "./data/initial-state.js";
import { LAST_OPENED_KEY } from "./engine/campaign-resume.js";
import { REFERENCE_GAMEPLAY_PREVIEW_ENABLED } from "./gameplay/reference/release-gate.js";
import { createPendingTravelCombat } from "./gameplay/production/pending-travel-combat.js";
import { Solitaire } from "./App.jsx";

const harness = vi.hoisted(() => ({
  serverState: null,
  saveCampaign: vi.fn(),
  loadCampaignRecord: vi.fn(),
  listCampaigns: vi.fn(),
}));

vi.mock("./engine/api-supabase.js", () => ({
  callNarrator: vi.fn(async () => ({
    story: [{ type: "beat", text: "Nothing changes." }],
    minutes_passed: 0,
  })),
}));

vi.mock("./engine/auth-supabase.js", () => ({
  isSubscribed: vi.fn(async () => true),
  linkEmail: vi.fn(async () => {}),
  onAuthChange: (listener) => {
    queueMicrotask(() => listener({ id: "gate-user", email: "gate@example.test" }));
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

const campaignId = "gate-campaign";

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function campaignAwaitingATravelFight() {
  const state = makeInitialState();
  state.created = true;
  const pending = createPendingTravelCombat({
    campaignId,
    state,
    encounter: {
      kind: "pickpocket",
      posture: "hostile",
      desc: "A lone cutpurse blocks the road.",
    },
  });
  if (!pending.ok) throw new Error(`fixture rejected: ${pending.reason}`);
  state.pendingTravelCombat = pending.pending;
  return state;
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
  throw new Error("Timed out waiting for gated combat browser state");
}

async function click(element) {
  expect(element).toBeTruthy();
  await act(async () => element.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

let root;
let container;

async function mountCampaign() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<Solitaire />));
  await waitFor(() => container.querySelector(".game-shell"));
  return container;
}

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
});

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(LAST_OPENED_KEY, campaignId);
  harness.serverState = campaignAwaitingATravelFight();
  harness.listCampaigns.mockReset().mockResolvedValue([
    { id: campaignId, name: "Gate campaign", schema_version: "v12" },
  ]);
  harness.loadCampaignRecord.mockReset().mockImplementation(async () => ({
    state: cloneJson(harness.serverState),
    updatedAt: "2026-08-10T12:00:00.000Z",
  }));
  harness.saveCampaign.mockReset().mockImplementation(async (id, state) => {
    harness.serverState = cloneJson(state);
    return { id, updatedAt: "2026-08-10T12:00:01.000Z" };
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

describe("with the Tower of Winter preview flag closed", () => {
  it("is closed by default, so a shipped build never runs the placeholder loop", () => {
    expect(REFERENCE_GAMEPLAY_PREVIEW_ENABLED).toBe(false);
  });

  it("still restores the offered fight across a reload", async () => {
    // Persisting the handoff is a plain fix for an offered fight vanishing on reload, and
    // it is safe with the new loop switched off — so it stays on in a shipped build.
    const mounted = await mountCampaign();
    const fight = await waitFor(() => [...mounted.querySelectorAll("button")]
      .find((button) => button.textContent === "Fight"));
    expect(fight).toBeTruthy();
    expect(mounted.textContent).toContain("A lone cutpurse blocks the road.");
  });

  it("sends a travel fight to the legacy loop and allocates no production session", async () => {
    const mounted = await mountCampaign();
    await click(await waitFor(() => [...mounted.querySelectorAll("button")]
      .find((button) => button.textContent === "Fight")));

    await waitFor(() => mounted.querySelector(".deck-combat"));
    expect(mounted.querySelector(".production-combat")).toBeNull();

    await waitFor(() => harness.serverState.pendingTravelCombat === null);
    expect(harness.serverState.activeCombatSession ?? null).toBe(null);
    expect(harness.serverState.productionCombatSequence).toBe(0);
    expect(harness.saveCampaign.mock.calls.some(([, saved]) => (
      saved.activeCombatSession?.domain === "solitaire-production-combat"
    ))).toBe(false);
  }, 45_000);
});
