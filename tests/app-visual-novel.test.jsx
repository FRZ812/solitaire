import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeInitialState, migrateCodex } from "../src/data/initial-state.js";
import { rememberLastCampaignId } from "../src/engine/campaign-resume.js";

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

const RECORD = {
  id: CAMPAIGN_ID,
  updatedAt: "2026-08-28T03:00:00.000Z",
  state: campaignState(),
};

vi.mock("../src/engine/auth-supabase.js", () => ({
  onAuthChange(callback) {
    callback({ id: "mounted-user", email: "mounted@example.test" });
    return () => {};
  },
  isSubscribed: async () => true,
  signOut: async () => {},
  linkEmail: async () => {},
}));

vi.mock("../src/engine/campaigns-supabase.js", () => ({
  listCampaigns: async () => [{ id: CAMPAIGN_ID, name: "Mounted recovery" }],
  loadCampaignRecord: async (id) => (id === CAMPAIGN_ID ? structuredClone(RECORD) : null),
  saveCampaign: async (id) => ({ id: id || CAMPAIGN_ID, updatedAt: RECORD.updatedAt }),
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

describe("mounted App story presentation", () => {
  beforeEach(() => {
    localStorage.clear();
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
  }, 20_000);
});
