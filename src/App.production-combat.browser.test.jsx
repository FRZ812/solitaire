// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { makeInitialState } from "./data/initial-state.js";
import { LAST_OPENED_KEY, readResumeSnapshot } from "./engine/campaign-resume.js";
import { buildNarratorProjection, narratorTurnPolicy } from "./engine/narrator-projection.js";
import { compileNarratorCandidate, NARRATOR_RESPONSE_KEYS } from "./engine/narrator-turn-compiler.js";
import { callNarrator } from "./engine/api-supabase.js";
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

  // The narrator rework closed the door these two tests used to walk through. An
  // ordinary action runs on the general-action policy, whose allowedEffects deliberately
  // omit start_combat, so a model that tries to author a fight mid-scene now produces an
  // ILLEGAL_EFFECT violation instead of a combat handoff. Production-kernel routing for
  // fights the engine *did* authorize is covered by the travel case below, and the
  // supported/unsupported admission rules by combat-adapter.test.js.
  it("refuses a narrator turn that tries to author a fight on an ordinary action", () => {
    const state = makeInitialState();
    state.created = true;
    const projection = buildNarratorProjection(state);
    const turnPolicy = narratorTurnPolicy("[PLAYER ACTION] Wait.", state, {});
    expect(turnPolicy.id).toBe("general-action");
    expect(turnPolicy.allowedEffects).not.toContain("start_combat");

    const candidate = Object.fromEntries(NARRATOR_RESPONSE_KEYS.map((key) => [key, null]));
    Object.assign(candidate, {
      contract_version: projection.contractVersion,
      state_revision: projection.stateRevision,
      story: [{ type: "beat", cue: { kind: "scene", event: "silence-settles" } }],
      minutes_passed: 0,
      vitality_change: 0,
      resolve_change: 0,
      start_combat: {
        initiator: "player",
        surprise: false,
        lethal: true,
        foes: [{ npc_id: "road-brigand", name: "Road brigand" }],
        note: "A brigand draws steel across the road.",
      },
    });

    const compiled = compileNarratorCandidate({ candidate, projection, turnPolicy });
    expect(compiled.ok).toBe(false);
    expect(compiled.violations).toContainEqual(expect.objectContaining({
      code: "ILLEGAL_EFFECT",
      path: "/start_combat",
    }));
  });

  it("allocates no production combat when the narrator attempts an unauthorized fight", async () => {
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
      story: [{ type: "beat", cue: { kind: "scene", event: "silence-settles" } }],
      minutes_passed: 0,
      start_combat: {
        initiator: "player",
        surprise: false,
        lethal: true,
        foes: [{ npc_id: "road-brigand", name: "Road brigand" }],
        note: "A brigand draws steel across the road.",
      },
    };

    const mounted = await mountCampaign();
    await click(await waitFor(() => mounted.querySelector(
      'button[aria-label="Continue story without a new action"]',
    )));

    // A refused turn changes nothing, so there is no save to wait on. Settle instead,
    // then assert that neither loop claimed the turn and no handoff was persisted.
    for (let tick = 0; tick < 12; tick += 1) {
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    }
    expect(mounted.querySelector(".production-combat")).toBeNull();
    expect(mounted.querySelector(".deck-combat")).toBeNull();
    expect(harness.serverState.activeCombatSession ?? null).toBe(null);
    expect(harness.serverState.pendingCombatDirective ?? null).toBe(null);
    expect(harness.serverState.productionCombatSequence).toBe(0);
  }, 45_000);

  it("turns an exact player attack into a pending engine handoff without asking the narrator to author combat", async () => {
    const state = makeInitialState();
    state.created = true;
    const current = state.world.currentTile;
    state.world.codex.characters["road-brigand"] = {
      id: "road-brigand",
      name: "Road brigand",
      kind: "npc",
      tier: "common",
      at: { x: current.x, y: current.y, day: state.time.day },
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
    callNarrator.mockClear();

    const mounted = await mountCampaign();
    const field = await waitFor(() => mounted.querySelector(".story-input__field"));
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    await act(async () => {
      setValue.call(field, "I attack Road brigand.");
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await click(await waitFor(() => mounted.querySelector('button[aria-label="Queue message"]')));
    await click(await waitFor(() => mounted.querySelector(
      'button[aria-label="Run narrator with 1 queued message"]',
    )));

    await waitFor(() => callNarrator.mock.calls.length > 0 || [...mounted.querySelectorAll("button")]
      .some((button) => button.textContent === "Engage"));
    expect(callNarrator).not.toHaveBeenCalled();
    expect(mounted.textContent).toContain("You commit to combat with Road brigand.");
    expect([...mounted.querySelectorAll("button")].some((button) => button.textContent === "Engage")).toBe(true);
    await waitFor(() => harness.serverState.pendingCombatDirective?.directive?.foes?.[0]?.npc_id === "road-brigand");
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
