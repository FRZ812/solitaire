// @vitest-environment jsdom
//
// The reload gates, at the real App boundary.
//
// A fight used to live in a `useState` beside a `useRef`, so reloading the page lost the
// encounter and — quietly worse — the context needed to settle it. These tests mount the
// real component, play a fight, throw the component away, mount it again from what was
// actually saved, and check that the fight is still there, at the same revision, and
// settles exactly once.

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { makeInitialState } from "./data/initial-state.js";
import { LAST_OPENED_KEY, readResumeSnapshot } from "./engine/campaign-resume.js";
import { createTowSession } from "./gameplay/tow/session.js";
import { decodeTowSession } from "./gameplay/tow/persistence.js";
import { verifyTowSession } from "./gameplay/tow/replay.js";
import { Solitaire } from "./App.jsx";

const harness = vi.hoisted(() => ({
  serverState: null,
  saveCampaign: vi.fn(),
  loadCampaignRecord: vi.fn(),
  listCampaigns: vi.fn(),
}));

vi.mock("./engine/api-supabase.js", () => ({
  callNarrator: vi.fn(async () => ({
    story: [{ type: "beat", text: "The dust settles." }],
    minutes_passed: 0,
  })),
}));

vi.mock("./engine/auth-supabase.js", () => ({
  isSubscribed: vi.fn(async () => true),
  linkEmail: vi.fn(async () => {}),
  onAuthChange: (listener) => {
    queueMicrotask(() => listener({ id: "tow-browser-user", email: "tow@example.test" }));
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

/** A campaign standing in a brawl: nonlethal, one named foe bound to the codex. */
function campaignInAFight({ lethalPolicy = "nonlethal", playerStakes = "survivable", enemies = null } = {}) {
  const state = makeInitialState();
  state.created = true;
  state.world.codex.characters["brigand-captain"] = {
    id: "brigand-captain",
    name: "Brigand captain",
    combatState: { health: 30, maxHealth: 30, status: "ok" },
  };
  const opened = createTowSession({
    sessionId: "tow-browser-campaign:combat:1",
    rootSeed: "tow-browser-campaign:combat:1",
    player: {
      id: "wanderer",
      name: state.character.name,
      maxHp: 120,
      stats: { attack: 14, defense: 4, critRate: 0, dodgeRate: 0 },
    },
    enemies: enemies || [{
      id: "foe-0",
      name: "Brigand captain",
      maxHp: 30,
      stats: { attack: 4, defense: 0, critRate: 0, dodgeRate: 0 },
      attacks: [{ id: "foe-0-jab", name: "Jab", hits: 1, damage: 3 }],
    }],
    build: { traits: {}, skills: ["strike", "block"] },
    context: {
      source: { kind: "narrator", note: "A brigand blocks the road." },
      location: "the road",
      lethalPolicy,
      playerStakes,
      participantBindings: { "foe-0": { campaignEntityId: "brigand-captain", lethal: null } },
      lootPolicy: {
        maxLootTier: "common",
        region: 1,
        coinBonus: 0,
        ownedUniqueIds: [],
        sources: { "foe-0": { kind: "bandits", maxLootTier: "common", tier: "common" } },
      },
    },
  });
  if (!opened.ok) throw new Error(opened.reason);
  state.mechanics = { ...state.mechanics, tow: { activeCombat: opened.session } };
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
  throw new Error("Timed out waiting for Tower of Winter browser state");
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

function savedSession() {
  return harness.serverState?.mechanics?.tow?.activeCombat ?? null;
}

function strikeButton(dialog) {
  return [...dialog.querySelectorAll(".production-combat__action")]
    .find((button) => /strike/i.test(button.textContent));
}

function endTurnButton(dialog) {
  return [...dialog.querySelectorAll(".production-combat__settle")]
    .find((button) => /end turn/i.test(button.textContent));
}

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
});

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(LAST_OPENED_KEY, "tow-browser-campaign");
  harness.serverState = campaignInAFight();
  harness.listCampaigns.mockReset().mockResolvedValue([
    { id: "tow-browser-campaign", name: "Tower campaign", schema_version: "v12" },
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
  await unmountCampaign();
  vi.clearAllTimers();
});

afterAll(() => {
  vi.restoreAllMocks();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

describe("a fight survives a reload", () => {
  it("resumes an admitted fight that has had no commands yet", async () => {
    const mounted = await mountCampaign();
    const dialog = await waitFor(() => mounted.querySelector(".tow-combat"));
    expect(dialog.textContent).toContain("A brigand blocks the road.");
    expect(decodeTowSession(savedSession()).session.revision).toBe(0);
  });

  it("persists an accepted command and comes back at the same revision", async () => {
    let mounted = await mountCampaign();
    let dialog = await waitFor(() => mounted.querySelector(".tow-combat"));

    await click(strikeButton(dialog));
    await click(endTurnButton(dialog));
    const beforeReload = await waitFor(() => {
      const decoded = decodeTowSession(savedSession());
      return decoded.ok && decoded.session.revision === 2 ? decoded.session : null;
    });
    // The warm-resume snapshot carries it too, so a reload with no network still lands on
    // the fight rather than on the moment before it.
    await waitFor(() => (
      readResumeSnapshot("tow-browser-user")?.state?.mechanics?.tow?.activeCombat != null
    ));

    await unmountCampaign();
    mounted = await mountCampaign();
    dialog = await waitFor(() => mounted.querySelector(".tow-combat"));

    const afterReload = decodeTowSession(savedSession()).session;
    expect(afterReload.revision).toBe(2);
    expect(afterReload.encounter).toEqual(beforeReload.encounter);
    expect(afterReload.commands.map((command) => command.id))
      .toEqual(beforeReload.commands.map((command) => command.id));
    // And the resumed fight is provably the fight that was played, not merely a state that
    // loaded cleanly.
    expect(verifyTowSession(afterReload)).toMatchObject({ ok: true });
  });

  it("resumes a terminal fight at its settle prompt and settles it once", async () => {
    let mounted = await mountCampaign();
    let dialog = await waitFor(() => mounted.querySelector(".tow-combat"));

    // Strike until the captain is down. Thirty health against a fourteen-attack strike is
    // three swings; end-turn between them so the foe gets to answer.
    for (let round = 0; round < 8; round += 1) {
      const strike = strikeButton(dialog);
      if (!strike) break;
      await click(strike);
      const settle = dialog.querySelector(".production-combat__outcome");
      if (settle) break;
      await click(endTurnButton(dialog));
    }
    await waitFor(() => dialog.querySelector(".production-combat__outcome"));

    const terminal = await waitFor(() => {
      const decoded = decodeTowSession(savedSession());
      return decoded.ok && decoded.session.status === "terminal" ? decoded.session : null;
    });
    // The verdict is sealed in the same commit that ended the fight, so a reload here lands
    // on a decided fight rather than one that has to be judged a second time.
    expect(terminal.terminalReceipt.reason).toBe("victory");
    expect(terminal.terminalReceipt.participants[1].worldFate).toBe("alive");

    await unmountCampaign();
    mounted = await mountCampaign();
    dialog = await waitFor(() => mounted.querySelector(".tow-combat"));
    const settleButton = await waitFor(() => (
      [...dialog.querySelectorAll(".production-combat__settle")]
        .find((button) => !/end turn/i.test(button.textContent))
    ));

    await click(settleButton);
    await waitFor(() => decodeTowSession(savedSession()).session?.status === "settled");
    const receipts = await waitFor(() => harness.serverState.combatSettlementReceipts);
    expect(receipts).toHaveLength(1);
    expect(receipts[0].sessionId).toBe("tow-browser-campaign:combat:1");

    // The foe was spared, so the codex must not record a corpse.
    expect(harness.serverState.world.codex.characters["brigand-captain"].combatState.status)
      .toBe("downed");
    // And the fight is over: no combat surface, and no second settlement.
    await waitFor(() => !container.querySelector(".tow-combat"));
    expect(harness.serverState.combatSettlementReceipts).toHaveLength(1);
  });
});

describe("readiness carries between fights", () => {
  it("settles what the fight left back into the campaign", async () => {
    const mounted = await mountCampaign();
    const dialog = await waitFor(() => mounted.querySelector(".tow-combat"));

    // Spend a limited-use skill, then finish the fight.
    const guard = [...dialog.querySelectorAll(".production-combat__action")]
      .find((button) => /block/i.test(button.textContent));
    await click(guard);
    for (let round = 0; round < 8; round += 1) {
      const strike = strikeButton(dialog);
      if (!strike || dialog.querySelector(".production-combat__outcome")) break;
      await click(strike);
      if (dialog.querySelector(".production-combat__outcome")) break;
      await click(endTurnButton(dialog));
    }
    await waitFor(() => dialog.querySelector(".production-combat__outcome"));
    const settle = [...dialog.querySelectorAll(".production-combat__settle")]
      .find((button) => !/end turn/i.test(button.textContent));
    await click(settle);

    // The road gives nothing back on its own: what the fight spent is still spent.
    const readiness = await waitFor(() => harness.serverState?.mechanics?.tow?.readiness);
    expect(readiness.block).toBeLessThan(30);
    expect(Object.hasOwn(readiness, "strike")).toBe(false);
  });
});

describe("the telegraph reaches a screen reader too", () => {
  it("names the coming attack in a targetable foe's accessible name", async () => {
    // A foe card becomes a button once there is more than one of them, and a button's
    // aria-label replaces everything inside it. Naming it "Target Wolf 1" would leave a
    // screen-reader user with the one piece of information the whole telegraph exists to
    // give them stripped out.
    const twoFoes = [0, 1].map((index) => ({
      id: `foe-${index}`,
      name: `Brigand ${index + 1}`,
      maxHp: 30,
      stats: { attack: 4, defense: 0, critRate: 0, dodgeRate: 0 },
      attacks: [{ id: `foe-${index}-jab`, name: "Jab", hits: 1, damage: 3 }],
    }));
    harness.serverState = campaignInAFight({ enemies: twoFoes });

    const mounted = await mountCampaign();
    const dialog = await waitFor(() => mounted.querySelector(".tow-combat"));
    const targets = [...dialog.querySelectorAll(".production-combat__fighter--target")];
    expect(targets.length).toBe(2);
    for (const target of targets) {
      const label = target.getAttribute("aria-label");
      expect(label).toMatch(/^Target Brigand \d/);
      expect(label).toContain("health");
      expect(label).toContain("preparing Jab for 3 damage");
    }
  });
});

describe("an unreadable saved fight", () => {
  it("says so and applies nothing until the player discards it", async () => {
    const corrupt = campaignInAFight();
    corrupt.mechanics.tow.activeCombat.checksum = "integrity-v1:0000000000000000";
    harness.serverState = corrupt;

    const mounted = await mountCampaign();
    const alert = await waitFor(() => mounted.querySelector(".tow-combat-recovery"));
    expect(alert.textContent).toContain("tow-session-checksum-mismatch");
    expect(mounted.querySelector(".tow-combat")).toBe(null);
    // Nothing has been applied: no settlement, no wound, no spoils.
    expect(harness.serverState.combatSettlementReceipts).toHaveLength(0);

    await click([...alert.querySelectorAll("button")][0]);
    await waitFor(() => savedSession() === null);
    expect(harness.serverState.combatSettlementReceipts).toHaveLength(0);
  });
});
