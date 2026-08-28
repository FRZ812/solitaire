import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEY } from "../src/config.js";
import { makeInitialState, migrateCodex } from "../src/data/initial-state.js";
import { readResumeSnapshot, rememberLastCampaignId, writeResumeSnapshot } from "../src/engine/campaign-resume.js";
import { compileCharacterBootstrap } from "../src/gameplay/combat/character-bootstrap.js";
import { createPracticeSession } from "../src/gameplay/combat/practice-scenarios.js";
import {
  COMBAT_V1_RUNTIME_IDENTITY,
  createCombatRuntimeSession,
} from "../src/gameplay/combat/runtime.js";
import {
  characterSetupForArchetype,
  createDefaultArchetypeDraft,
} from "../src/gameplay/combat/starting-archetypes.js";

const CAMPAIGN_ID = "mounted-visual-novel";

function campaignState() {
  const state = migrateCodex(makeInitialState());
  state.created = true;
  state.character = {
    ...state.character,
    id: "wanderer",
    name: "Mira",
    kind: "player",
    combatArchetypeId: "wizard",
    progressionModel: "archetype",
    portraitKey: "archetype:wizard",
  };
  state.world.codex.characters.wanderer = {
    ...state.world.codex.characters.wanderer,
    ...state.character,
  };
  state.beats = [
    { id: "player-arrival", type: "player", content: "I enter the archive." },
    {
      id: "iorin-answer",
      type: "dialogue",
      speakerId: "glass-spire-key-master-iorin",
      name: "Master Iorin",
      line: "The shadows remember you.",
    },
  ];
  return state;
}

function campaignStateWithCombat() {
  const state = campaignState();
  const draft = createDefaultArchetypeDraft();
  const compiled = compileCharacterBootstrap({
    archetypeId: draft.archetypeId,
    origin: "archetype",
    setup: characterSetupForArchetype(draft),
  });
  const practice = createPracticeSession(compiled.receipt).session;
  const genesis = practice.genesis;
  const opened = createCombatRuntimeSession(COMBAT_V1_RUNTIME_IDENTITY, {
    sessionId: `${CAMPAIGN_ID}:combat:1`,
    rootSeed: "mounted-warm-combat",
    mode: "campaign",
    player: genesis.playerSnapshot,
    allies: genesis.allySnapshots,
    enemies: genesis.enemySnapshots,
    formations: genesis.formations,
    build: genesis.effectiveBuild,
    context: {
      campaignId: CAMPAIGN_ID,
      campaignRevision: state.mechanics.campaignRevision,
    },
  });
  state.mechanics.combat.activeCombat = opened.session;
  return state;
}

const RECORD = {
  id: CAMPAIGN_ID,
  updatedAt: "2026-08-28T03:00:00.000Z",
  state: campaignState(),
};

const campaignMocks = vi.hoisted(() => ({
  baselineCalls: 0,
  emptyFirstList: false,
  holdFirstLoad: false,
  holdFirstSave: false,
  listCalls: 0,
  loadCalls: 0,
  recordState: null,
  returnMissing: false,
  resolveHeldLoad: null,
  resolveHeldSave: null,
  saveCalls: 0,
  savedSnapshots: [],
  signOutCalls: 0,
}));

vi.mock("../src/engine/auth-supabase.js", () => ({
  onAuthChange(callback) {
    callback({ id: "mounted-user", email: "mounted@example.test" });
    return () => {};
  },
  isSubscribed: async () => true,
  signOut: async () => { campaignMocks.signOutCalls += 1; },
  linkEmail: async () => {},
}));

vi.mock("../src/engine/campaigns-supabase.js", () => ({
  acceptCampaignBaseline: () => { campaignMocks.baselineCalls += 1; },
  listCampaigns: async () => {
    campaignMocks.listCalls += 1;
    if (campaignMocks.emptyFirstList && campaignMocks.listCalls === 1) return [];
    return [{ id: CAMPAIGN_ID, name: "Mounted recovery" }];
  },
  loadCampaignRecord: async (id) => {
    campaignMocks.loadCalls += 1;
    const record = {
      ...RECORD,
      state: campaignMocks.recordState || RECORD.state,
    };
    if (campaignMocks.holdFirstLoad && campaignMocks.loadCalls === 1) {
      return new Promise((resolve) => {
        campaignMocks.resolveHeldLoad = () => resolve(structuredClone(record));
      });
    }
    if (campaignMocks.returnMissing) return null;
    return id === CAMPAIGN_ID ? structuredClone(record) : null;
  },
  saveCampaign: async (id, state) => {
    campaignMocks.saveCalls += 1;
    campaignMocks.savedSnapshots.push(structuredClone(state));
    if (campaignMocks.holdFirstSave && campaignMocks.saveCalls === 1) {
      return new Promise((resolve) => {
        campaignMocks.resolveHeldSave = () => resolve({ id: id || CAMPAIGN_ID, updatedAt: RECORD.updatedAt });
      });
    }
    return { id: id || CAMPAIGN_ID, updatedAt: RECORD.updatedAt };
  },
  deleteCampaign: async () => {},
  renameCampaign: async () => {},
}));

async function flushUntil(predicate, message) {
  for (let index = 0; index < 30; index += 1) {
    await act(async () => {
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    if (predicate()) return;
  }
  throw new Error(message);
}

function expectAccessibleThroughAncestors(element) {
  expect(element).toBeTruthy();
  for (let node = element; node && node !== document.body; node = node.parentElement) {
    expect(node.hidden).toBe(false);
    expect(node.hasAttribute("inert")).toBe(false);
    expect(node.getAttribute("aria-hidden")).not.toBe("true");
  }
}

describe("mounted App story presentation", () => {
  beforeEach(() => {
    localStorage.clear();
    campaignMocks.baselineCalls = 0;
    campaignMocks.emptyFirstList = false;
    campaignMocks.holdFirstLoad = false;
    campaignMocks.holdFirstSave = false;
    campaignMocks.listCalls = 0;
    campaignMocks.loadCalls = 0;
    campaignMocks.recordState = null;
    campaignMocks.returnMissing = false;
    campaignMocks.resolveHeldLoad = null;
    campaignMocks.resolveHeldSave = null;
    campaignMocks.saveCalls = 0;
    campaignMocks.savedSnapshots = [];
    campaignMocks.signOutCalls = 0;
    rememberLastCampaignId(CAMPAIGN_ID);
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    globalThis.ResizeObserver ||= class {
      observe() {}
      disconnect() {}
      unobserve() {}
    };
    globalThis.requestAnimationFrame ||= (callback) => setTimeout(() => callback(Date.now()), 0);
    globalThis.cancelAnimationFrame ||= clearTimeout;
  });

  it("mounts the visual novel as the primary recovered campaign story surface", async () => {
    const { Solitaire } = await import("../src/App.jsx");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => root.render(<Solitaire />));
    await flushUntil(
      () => container.querySelector(".visual-novel-stage"),
      "mounted App never displayed the visual-novel story stage",
    );

    expect(container.querySelector(".story-log")).toBeNull();
    expect(container.querySelectorAll(".visual-novel-stage__page .beat")).toHaveLength(1);
    expect(container.textContent).toContain("The shadows remember you.");
    expect(container.querySelector('[data-character-id="glass-spire-key-master-iorin"] img')).toBeTruthy();

    await act(async () => root.unmount());
    container.remove();
  }, 35_000);

  it("saves state accepted while the final exit save is in flight", async () => {
    const { Solitaire } = await import("../src/App.jsx");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => root.render(<Solitaire />));
    await flushUntil(
      () => container.querySelector(".visual-novel-stage"),
      "campaign never opened for exit-save regression",
    );

    const field = container.querySelector(".story-input__field");
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    await act(async () => {
      valueSetter.call(field, "Accepted during final save.");
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await flushUntil(
      () => container.querySelector(".story-input__action")?.classList.contains("is-send"),
      "composer never accepted the late-action draft",
    );
    const lateAction = container.querySelector(".story-input__action");

    await act(async () => container.querySelector('[aria-label="Character, company, skills, inventory, and codex"]').click());
    await flushUntil(
      () => [...container.querySelectorAll("button")].some((button) => button.textContent.includes("Back to Campaigns")),
      "dossier never exposed the campaign exit action",
    );
    const exit = [...container.querySelectorAll("button")]
      .find((button) => button.textContent.includes("Back to Campaigns"));
    campaignMocks.holdFirstSave = true;
    await act(async () => {
      exit.click();
      lateAction.click();
      await Promise.resolve();
    });
    expect(campaignMocks.saveCalls).toBe(1);
    expect(container.textContent).toContain("Saving your journey");

    await act(async () => {
      campaignMocks.resolveHeldSave();
      await Promise.resolve();
    });
    await flushUntil(
      () => campaignMocks.saveCalls >= 2 && container.querySelector(".campaign-card__open"),
      "exit did not save the newer state before returning to campaigns",
    );
    expect(campaignMocks.savedSnapshots[1].beats.at(-1)?.content).toBe("Accepted during final save.");

    await act(async () => root.unmount());
    container.remove();
  }, 35_000);

  it("lets the player escape when authoritative warm-resume loading stalls", async () => {
    campaignMocks.emptyFirstList = true;
    campaignMocks.holdFirstLoad = true;
    const dirtyState = campaignState();
    dirtyState.beats.push({ id: "unsaved-local", type: "narration", content: "Unsaved local choice." });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(campaignState()));
    writeResumeSnapshot({
      userId: "mounted-user",
      campaignId: CAMPAIGN_ID,
      state: dirtyState,
      dirty: true,
      serverUpdatedAt: RECORD.updatedAt,
    });
    const { Solitaire } = await import("../src/App.jsx");
    const container = document.createElement("div");
    const outsideSurface = document.createElement("button");
    outsideSurface.textContent = "Install app";
    document.body.appendChild(container);
    document.body.appendChild(outsideSurface);
    const root = createRoot(container);

    await act(async () => root.render(<Solitaire />));
    await flushUntil(
      () => container.querySelector(".visual-novel-stage"),
      "warm resume never painted its cached story",
    );
    await flushUntil(
      () => campaignMocks.listCalls >= 2,
      "the concurrent legacy import never completed",
    );

    const cancel = container.querySelector(".journey-loader__cancel");
    expect(cancel).toBeTruthy();
    expect(cancel.textContent).toContain("Back to journeys");
    expectAccessibleThroughAncestors(container.querySelector(".journey-resume"));
    expect(outsideSurface.hidden).toBe(true);
    expect(outsideSurface.hasAttribute("inert")).toBe(true);
    expect(outsideSurface.getAttribute("aria-hidden")).toBe("true");
    await act(async () => cancel.click());
    await flushUntil(
      () => container.textContent.includes("Mounted recovery"),
      "cancelling the stalled resume did not return to the campaign list",
    );
    expect(container.querySelector(".visual-novel-stage")).toBeNull();
    expect(outsideSurface.hidden).toBe(false);
    expect(outsideSurface.hasAttribute("inert")).toBe(false);
    expect(outsideSurface.getAttribute("aria-hidden")).toBeNull();

    const signOutButton = [...container.querySelectorAll("button")]
      .find((button) => button.textContent.includes("Sign out"));
    await act(async () => signOutButton.click());
    expect(campaignMocks.signOutCalls).toBe(0);
    expect(container.textContent).toContain("Unsaved recovery is still stored on this device");

    await act(async () => container.querySelector(".campaign-new").click());
    expect(container.textContent).toContain("before starting another");
    expect(container.querySelector(".visual-novel-stage")).toBeNull();

    await act(async () => {
      campaignMocks.resolveHeldLoad();
      await Promise.resolve();
    });
    expect(container.querySelector(".visual-novel-stage")).toBeNull();
    expect(container.textContent).toContain("Mounted recovery");
    expect(campaignMocks.baselineCalls).toBe(0);

    await act(async () => container.querySelector(".campaign-card__open").click());
    await flushUntil(
      () => container.textContent.includes("Unsaved local choice."),
      "reopening the campaign did not recover the dirty local snapshot",
    );
    expect(readResumeSnapshot("mounted-user")?.dirty).toBe(true);
    expect(campaignMocks.baselineCalls).toBe(1);

    await act(async () => root.unmount());
    container.remove();
    outsideSurface.remove();
  }, 35_000);

  it("preserves dirty recovery when the authoritative row is unavailable", async () => {
    campaignMocks.returnMissing = true;
    const dirtyState = campaignState();
    dirtyState.beats.push({ id: "device-only", type: "narration", content: "Only on this device." });
    writeResumeSnapshot({
      userId: "mounted-user",
      campaignId: CAMPAIGN_ID,
      state: dirtyState,
      dirty: true,
      serverUpdatedAt: RECORD.updatedAt,
    });
    const { Solitaire } = await import("../src/App.jsx");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => root.render(<Solitaire />));
    await flushUntil(
      () => container.textContent.includes("unsaved recovery remains on this device"),
      "missing cloud row did not surface preserved local recovery",
    );

    const preserved = readResumeSnapshot("mounted-user");
    expect(preserved?.dirty).toBe(true);
    expect(preserved?.state.beats.at(-1)?.content).toBe("Only on this device.");
    expect(campaignMocks.baselineCalls).toBe(0);

    await act(async () => root.unmount());
    container.remove();
  }, 35_000);

  it("keeps cold campaign opening owned while a concurrent import finishes", async () => {
    campaignMocks.emptyFirstList = true;
    campaignMocks.holdFirstLoad = true;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(campaignState()));
    const { Solitaire } = await import("../src/App.jsx");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => root.render(<Solitaire />));
    await flushUntil(
      () => campaignMocks.listCalls >= 2,
      "the concurrent import never completed during cold opening",
    );

    expect(container.querySelector(".campaign-card__open")).toBeNull();
    const cancel = container.querySelector(".journey-loader__cancel");
    expect(cancel).toBeTruthy();
    await act(async () => cancel.click());
    await act(async () => {
      campaignMocks.resolveHeldLoad();
      await Promise.resolve();
    });
    expect(container.querySelector(".visual-novel-stage")).toBeNull();

    await act(async () => root.unmount());
    container.remove();
  }, 35_000);

  it("rebinds document isolation when cold hydration opens active combat", async () => {
    campaignMocks.holdFirstLoad = true;
    campaignMocks.recordState = campaignStateWithCombat();
    const { Solitaire } = await import("../src/App.jsx");
    const container = document.createElement("div");
    const outsideSurface = document.createElement("button");
    outsideSurface.textContent = "Install app";
    document.body.appendChild(container);
    document.body.appendChild(outsideSurface);
    const root = createRoot(container);

    await act(async () => root.render(<Solitaire />));
    await flushUntil(
      () => container.querySelector(".journey-loader"),
      "cold authoritative opening never exposed its loader",
    );
    expectAccessibleThroughAncestors(container.querySelector(".journey-loader"));
    expect(outsideSurface.hidden).toBe(true);

    await act(async () => {
      campaignMocks.resolveHeldLoad();
      await Promise.resolve();
    });
    await flushUntil(
      () => container.querySelector(".archetype-combat"),
      "cold authoritative hydration never opened active combat",
    );
    expect(container.querySelector(".journey-loader")).toBeNull();
    expectAccessibleThroughAncestors(container.querySelector(".archetype-combat"));
    expect(outsideSurface.hidden).toBe(true);

    await act(async () => root.unmount());
    expect(outsideSurface.hidden).toBe(false);
    expect(outsideSurface.hasAttribute("inert")).toBe(false);
    expect(outsideSurface.getAttribute("aria-hidden")).toBeNull();
    container.remove();
    outsideSurface.remove();
  }, 35_000);

  it("keeps hydrated character selection visible and interactive", async () => {
    const limboState = campaignState();
    limboState.created = false;
    campaignMocks.recordState = limboState;
    const { Solitaire } = await import("../src/App.jsx");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => root.render(<Solitaire />));
    await flushUntil(
      () => container.querySelector(".character-select"),
      "hydrated limbo never opened character selection",
    );

    const selection = container.querySelector(".character-select");
    expect(selection.hasAttribute("data-app-exclusive-surface")).toBe(true);
    expect(selection.hidden).toBe(false);
    expect(selection.hasAttribute("inert")).toBe(false);
    expect(selection.getAttribute("aria-hidden")).toBeNull();
    expect(selection.querySelector("button")).toBeTruthy();
    expectAccessibleThroughAncestors(selection);

    await act(async () => root.unmount());
    container.remove();
  }, 35_000);

  it("keeps warm cached combat behind actionable recovery until hydration", async () => {
    campaignMocks.holdFirstLoad = true;
    const combatState = campaignStateWithCombat();
    writeResumeSnapshot({
      userId: "mounted-user",
      campaignId: CAMPAIGN_ID,
      state: combatState,
      dirty: false,
      serverUpdatedAt: RECORD.updatedAt,
    });
    const { Solitaire } = await import("../src/App.jsx");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => root.render(<Solitaire />));
    await flushUntil(
      () => container.querySelector(".journey-resume"),
      "warm combat never exposed its recovery overlay",
    );

    const recovery = container.querySelector(".journey-resume");
    const cancel = recovery.querySelector(".journey-loader__cancel");
    expect(container.querySelector(".archetype-combat")).toBeNull();
    expect(recovery.hidden).toBe(false);
    expect(recovery.hasAttribute("inert")).toBe(false);
    expect(cancel).toBeTruthy();
    expectAccessibleThroughAncestors(recovery);

    await act(async () => cancel.click());
    await act(async () => {
      campaignMocks.resolveHeldLoad();
      await Promise.resolve();
    });
    expect(container.querySelector(".archetype-combat")).toBeNull();

    await act(async () => root.unmount());
    container.remove();
  }, 35_000);
});
