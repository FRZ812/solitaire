// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { makeInitialState } from "./data/initial-state.js";
import { LAST_OPENED_KEY, readResumeSnapshot } from "./engine/campaign-resume.js";
import { startProductionCombatSession } from "./gameplay/production/combat-session.js";
import { createPendingTravelCombat } from "./gameplay/production/pending-travel-combat.js";
import { Solitaire } from "./App.jsx";

const harness = vi.hoisted(() => {
  // Production combat is gated behind the preview flag: the shipped build keeps the
  // legacy loop until a whole Tower of Winter fight works on the new kernel. These tests
  // exercise the flagged-on path; App.production-combat-gate.test.jsx covers the off one.
  vi.stubEnv("VITE_ENABLE_REFERENCE_GAMEPLAY_PREVIEW", "true");
  return {
    serverState: null,
    narratorBeat: null,
    saveCampaign: vi.fn(),
    loadCampaignRecord: vi.fn(),
    listCampaigns: vi.fn(),
  };
});

vi.mock("./engine/api-supabase.js", () => ({
  callNarrator: vi.fn(async () => harness.narratorBeat || {
    story: [{ type: "beat", text: "Nothing changes." }],
    minutes_passed: 0,
  }),
}));

vi.mock("./engine/auth-supabase.js", () => ({
  isSubscribed: vi.fn(async () => true),
  linkEmail: vi.fn(async () => {}),
  onAuthChange: (listener) => {
    queueMicrotask(() => listener({ id: "production-browser-user", email: "production@example.test" }));
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

function campaignWithCombat() {
  const state = makeInitialState();
  state.created = true;
  state.productionCombatSequence = 3;
  state.world.codex.characters["brigand-captain"] = {
    id: "brigand-captain",
    name: "Brigand captain",
    combatState: { health: 5, maxHealth: 5, status: "ok" },
  };
  state.activeCombatSession = startProductionCombatSession({
    campaignId: "production-browser-campaign",
    sessionId: "production-browser-campaign:combat:2",
    seed: "production-browser-campaign:combat:2",
    source: { kind: "narrator", note: "A brigand blocks the road.", lethal: true },
    player: {
      name: state.character.name,
      hp: state.character.vitality,
      maxHp: state.character.vitalityMax,
      attack: 5,
      defense: 3,
      proficiencyId: "mastery-sword",
    },
    enemy: {
      name: "Brigand captain",
      hp: 5,
      maxHp: 5,
      damage: { min: 2, max: 2 },
      npcId: "brigand-captain",
    },
  }).session;
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
  throw new Error("Timed out waiting for production combat browser state");
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

async function unmountCampaign() {
  if (root) await act(async () => root.unmount());
  container?.remove();
  root = null;
  container = null;
}

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
});

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(LAST_OPENED_KEY, "production-browser-campaign");
  harness.serverState = campaignWithCombat();
  harness.narratorBeat = null;
  harness.listCampaigns.mockReset().mockResolvedValue([
    { id: "production-browser-campaign", name: "Production campaign", schema_version: "v12" },
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
  await unmountCampaign();
  vi.clearAllTimers();
});

afterAll(() => {
  vi.restoreAllMocks();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

describe("production combat at the real App browser boundary", () => {
  it("resumes, persists an accepted command, reloads, and settles once", async () => {
    let mounted = await mountCampaign();
    const dialog = await waitFor(() => mounted.querySelector(".production-combat"));
    expect(dialog.textContent).toContain("A brigand blocks the road.");

    const strikeButton = [...dialog.querySelectorAll("button")]
      .find((button) => button.textContent.includes("Strike"));
    expect(document.activeElement).toBe(strikeButton);
    const portalSurface = document.createElement("div");
    portalSurface.append(document.createElement("button"));
    document.body.append(portalSurface);
    await waitFor(() => portalSurface.hasAttribute("inert")
      && portalSurface.hasAttribute("hidden")
      && portalSurface.getAttribute("aria-hidden") === "true");

    await click(strikeButton);
    await waitFor(() => mounted.querySelector(".production-combat__outcome"));
    await waitFor(() => (
      readResumeSnapshot("production-browser-user")?.state?.activeCombatSession?.sequence === 1
    ));
    await waitFor(() => harness.saveCampaign.mock.calls.some(([, saved]) => (
      saved.activeCombatSession?.sequence === 1
    )));

    await unmountCampaign();
    expect(portalSurface.hasAttribute("inert")).toBe(false);
    expect(portalSurface.hasAttribute("hidden")).toBe(false);
    expect(portalSurface.hasAttribute("aria-hidden")).toBe(false);
    portalSurface.remove();
    mounted = await mountCampaign();
    const restored = await waitFor(() => mounted.querySelector(".production-combat__outcome"));
    const settleButton = [...restored.querySelectorAll("button")]
      .find((button) => button.textContent.includes("Apply aftermath"));
    expect(document.activeElement).toBe(settleButton);
    await click(settleButton);

    await waitFor(() => !mounted.querySelector(".production-combat"));
    await waitFor(() => document.activeElement === mounted.querySelector(".story-input__field"));
    await waitFor(() => harness.serverState.activeCombatSession === null);
    expect(harness.serverState.combatSettlementReceipts).toHaveLength(1);
    expect(harness.serverState.world.codex.characters["brigand-captain"].combatState.status).toBe("dead");
    expect(harness.serverState.character.proficiencies["mastery-sword"]).toBe(2);

    const savedCount = harness.serverState.combatSettlementReceipts.length;
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 100)); });
    expect(harness.serverState.combatSettlementReceipts).toHaveLength(savedCount);
  }, 45_000);

  it("fails closed on a forged restored session and requires explicit discard", async () => {
    const forged = cloneJson(harness.serverState.activeCombatSession);
    forged.encounter.actors.enemy.hp = 1;
    harness.serverState.activeCombatSession = forged;

    const mounted = await mountCampaign();
    const recovery = await waitFor(() => mounted.querySelector(".production-combat-recovery"));
    expect(recovery.textContent).toContain("invalid-production-combat-session");
    expect(recovery.textContent).toContain("No victory, defeat, reward, injury");
    expect(mounted.querySelector(".production-combat__actions")).toBeNull();

    await click([...recovery.querySelectorAll("button")]
      .find((button) => button.textContent.includes("Discard invalid")));
    await waitFor(() => !mounted.querySelector(".production-combat-recovery"));
    await waitFor(() => harness.serverState.activeCombatSession === null);
    expect(harness.serverState.combatSettlementReceipts).toEqual([]);
    expect(harness.serverState.beats.at(-1).content).toContain("no outcome was applied");
  }, 45_000);

  it("routes one supported narrator-authored foe through the production kernel", async () => {
    const state = makeInitialState();
    state.created = true;
    state.world.codex.characters["road-brigand"] = {
      id: "road-brigand",
      name: "Road brigand",
      kind: "npc",
      attributes: { body: 1, reflex: 1, vigor: 1, mind: 1, wit: 1, presence: 1 },
      proficiencies: {},
      vitality: 5,
      vitalityMax: 5,
      resolve: 1,
      resolveMax: 1,
      worn: [],
      abilities: [],
      conditions: [],
      combatState: { health: 5, maxHealth: 5, status: "ok" },
    };
    harness.serverState = state;
    harness.narratorBeat = {
      story: [{ type: "beat", text: "A brigand draws steel across the road." }],
      minutes_passed: 0,
      start_combat: {
        initiator: "player",
        surprise: false,
        lethal: true,
        foes: [{ npc_id: "road-brigand", name: "Road brigand" }],
        note: "A brigand draws steel across the road.",
      },
    };

    let mounted = await mountCampaign();
    await click(await waitFor(() => mounted.querySelector(
      'button[aria-label="Continue story without a new action"]',
    )));
    await waitFor(() => [...mounted.querySelectorAll("button")]
      .find((button) => button.textContent.includes("Engage")));
    await waitFor(() => harness.saveCampaign.mock.calls.some(([, saved]) => (
      saved.pendingCombatDirective?.directive?.foes?.[0]?.npc_id === "road-brigand"
      && saved.activeCombatSession === null
    )));

    await unmountCampaign();
    mounted = await mountCampaign();
    await click(await waitFor(() => [...mounted.querySelectorAll("button")]
      .find((button) => button.textContent.includes("Engage"))));

    const production = await waitFor(() => mounted.querySelector(".production-combat"));
    expect(production.textContent).toContain("A brigand draws steel across the road.");
    await waitFor(() => harness.saveCampaign.mock.calls.some(([, saved]) => (
      saved.activeCombatSession?.domain === "solitaire-production-combat"
      && saved.productionCombatSequence === 1
      && saved.pendingCombatDirective === null
    )));
  }, 45_000);

  it("keeps unsupported narrator combat wholly on the legacy path", async () => {
    const state = makeInitialState();
    state.created = true;
    state.world.codex.characters["road-brigand"] = {
      id: "road-brigand",
      name: "Road brigand",
      kind: "npc",
      attributes: { body: 1, reflex: 1, vigor: 1, mind: 1, wit: 1, presence: 1 },
      proficiencies: {},
      vitality: 5,
      vitalityMax: 5,
      resolve: 1,
      resolveMax: 1,
      worn: [],
      abilities: [],
      conditions: [],
      combatState: { health: 5, maxHealth: 5, status: "ok" },
    };
    state.world.codex.characters["road-raider"] = {
      ...cloneJson(state.world.codex.characters["road-brigand"]),
      id: "road-raider",
      name: "Road raider",
    };
    harness.serverState = state;
    harness.narratorBeat = {
      story: [{ type: "beat", text: "Two raiders close in." }],
      minutes_passed: 0,
      start_combat: {
        initiator: "enemy",
        surprise: false,
        lethal: true,
        foes: [
          { npc_id: "road-brigand", name: "Road brigand" },
          { npc_id: "road-raider", name: "Road raider" },
        ],
        note: "Two raiders close in.",
      },
    };

    const mounted = await mountCampaign();
    await click(await waitFor(() => mounted.querySelector(
      'button[aria-label="Continue story without a new action"]',
    )));
    await click(await waitFor(() => [...mounted.querySelectorAll("button")]
      .find((button) => button.textContent.includes("Defend"))));

    const legacy = await waitFor(() => mounted.querySelector(".deck-combat"));
    expect(legacy.getAttribute("aria-label")).toBe("Card combat");
    expect(mounted.querySelector(".production-combat")).toBeNull();
    await waitFor(() => harness.saveCampaign.mock.calls.some(([, saved]) => (
      saved.pendingCombatDirective === null
      && saved.activeCombatSession === null
      && saved.productionCombatSequence === 0
    )));
    expect(harness.saveCampaign.mock.calls.some(([, saved]) => (
      saved.activeCombatSession?.domain === "solitaire-production-combat"
    ))).toBe(false);
  }, 45_000);

  it("fails closed on an invalid persisted pending combat directive", async () => {
    const state = makeInitialState();
    state.created = true;
    state.pendingCombatDirective = {
      version: 1,
      campaignId: "production-browser-campaign",
      contextChecksum: "0000000000000000",
      directive: {
        initiator: "narrator",
        surprise: false,
        lethal: true,
        foes: [{ npc_id: null, kind: "bandit", name: "Bandit", tier: null, count: 1 }],
        note: "A malformed handoff.",
      },
    };
    harness.serverState = state;

    const mounted = await mountCampaign();
    const recovery = await waitFor(() => mounted.querySelector(".pending-combat-recovery"));
    expect(recovery.getAttribute("role")).toBe("alert");
    expect(recovery.textContent).toContain("invalid-initiator");
    expect(mounted.querySelector(".production-combat")).toBeNull();
    expect(mounted.querySelector(".deck-combat")).toBeNull();

    await click([...recovery.querySelectorAll("button")]
      .find((button) => button.textContent.includes("Discard invalid")));
    await waitFor(() => !mounted.querySelector(".pending-combat-recovery"));
    await waitFor(() => harness.serverState.pendingCombatDirective === null);
    expect(harness.serverState.activeCombatSession).toBe(null);
    expect(harness.serverState.productionCombatSequence).toBe(0);
    expect(harness.serverState.beats.at(-1).content).toContain("no combat outcome was applied");
  }, 45_000);

  it("routes a persisted supported travel foe through production combat", async () => {
    const state = makeInitialState();
    state.created = true;
    const pending = createPendingTravelCombat({
      campaignId: "production-browser-campaign",
      state,
      encounter: {
        kind: "pickpocket",
        posture: "hostile",
        desc: "A lone cutpurse blocks the road.",
      },
    });
    expect(pending.ok).toBe(true);
    state.pendingTravelCombat = pending.pending;
    harness.serverState = state;

    const mounted = await mountCampaign();
    await click(await waitFor(() => [...mounted.querySelectorAll("button")]
      .find((button) => button.textContent === "Fight")));

    const production = await waitFor(() => mounted.querySelector(".production-combat"));
    expect(production.textContent).toContain("A lone cutpurse blocks the road.");
    await waitFor(() => harness.serverState.activeCombatSession?.source?.kind === "travel");
    expect(harness.serverState.pendingTravelCombat).toBe(null);
    expect(harness.serverState.productionCombatSequence).toBe(1);
    expect(mounted.querySelector(".deck-combat")).toBeNull();
  }, 45_000);
});
