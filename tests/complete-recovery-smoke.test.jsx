import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { VisualNovelStage, visualNovelBeats } from "../src/components/VisualNovelStage.jsx";
import { makeInitialState, migrateCodex } from "../src/data/initial-state.js";
import { COMPANIONS } from "../src/data/companions.js";
import { playerCombatDirective } from "../src/engine/player-combat-intent.js";
import { buildNarratorProjection } from "../src/engine/narrator-projection.js";
import { emptyMechanicsSidecar, upgradeCampaignPayload } from "../src/engine/campaign-migration.js";
import { STARTING_ARCHETYPES } from "../src/gameplay/combat/starting-archetypes.js";

const ROOT = process.cwd().replaceAll("\\", "/");

function currentCampaign() {
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
  return state;
}

describe("complete recovery closure", () => {
  it("uses the visual-novel page model instead of a chat transcript", async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const state = currentCampaign();
    const beats = [
      { id: "t0", type: "timestamp", content: "Dawn" },
      { id: "p1", type: "player", content: "I enter the archive." },
      { id: "d1", type: "dialogue", speakerId: "glass-spire-key-master-iorin", name: "Master Iorin", line: "The shadows remember you." },
    ];
    expect(visualNovelBeats(beats).map(({ id }) => id)).toEqual(["p1", "d1"]);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => root.render(
      <VisualNovelStage state={state} beats={beats} loading />,
    ));

    expect(container.querySelector(".visual-novel-stage")).toBeTruthy();
    expect(container.querySelectorAll(".visual-novel-stage__page .beat")).toHaveLength(1);
    expect(container.querySelector(".story-log")).toBeNull();
    expect(container.querySelector('[data-character-id="glass-spire-key-master-iorin"] img')).toBeTruthy();
    expect(container.textContent).toContain("The shadows remember you.");
    expect(container.textContent).toContain("Connecting to the narrator");

    await act(async () => container.querySelector('[aria-label="Previous story beat"]').click());
    expect(container.textContent).toContain("I enter the archive.");
    expect(container.querySelector('[data-character-id="wanderer"] img')).toBeTruthy();
    await act(async () => root.unmount());
    container.remove();
  });

  it("keeps a warm campaign snapshot inert until authoritative hydration finishes", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onContinue = vi.fn();
    await act(async () => root.render(
      <VisualNovelStage
        state={currentCampaign()}
        beats={[
          { id: "warm-player", type: "player", content: "Cached choice." },
          { id: "warm-reply", type: "narration", content: "Cached reply." },
        ]}
        disabled
        onContinue={onContinue}
      />,
    ));
    const controls = [...container.querySelectorAll(".visual-novel-stage__controls button")];
    expect(controls).toHaveLength(2);
    expect(controls.every((button) => button.disabled)).toBe(true);
    await act(async () => controls[1].click());
    expect(onContinue).not.toHaveBeenCalled();
    await act(async () => root.unmount());
    container.remove();
  });

  it("follows a multi-page authoritative append to the newest story page", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const first = [
      { id: "one", type: "narration", content: "One." },
      { id: "two", type: "narration", content: "Two." },
    ];
    await act(async () => root.render(<VisualNovelStage state={currentCampaign()} beats={first} />));
    await act(async () => root.render(
      <VisualNovelStage
        state={currentCampaign()}
        beats={[
          ...first,
          { id: "three", type: "narration", content: "Three." },
          { id: "four", type: "narration", content: "Four." },
        ]}
      />,
    ));
    expect(container.textContent).toContain("Four.");
    expect(container.querySelector('[aria-label="Story position"]').textContent).toContain("4 / 4");
    await act(async () => root.unmount());
    container.remove();
  });

  it("keeps legacy global progression UI and schematics physically retired", () => {
    expect(existsSync(`${ROOT}/src/components/ProfessionProgression.jsx`)).toBe(false);
    expect(existsSync(`${ROOT}/src/components/ProgressionChoiceModal.jsx`)).toBe(false);
    expect(existsSync(`${ROOT}/src/components/CreationHub.jsx`)).toBe(false);
    expect(existsSync(`${ROOT}/src/components/ManualCreation.jsx`)).toBe(false);
    const app = readFileSync(`${ROOT}/src/App.jsx`, "utf8");
    const panel = readFileSync(`${ROOT}/src/components/PanelDeck.jsx`, "utf8");
    const codex = readFileSync(`${ROOT}/src/components/CodexView.jsx`, "utf8");
    expect(app).toContain("<VisualNovelStage");
    expect(app).not.toMatch(/pendingProgressionChoices|onOpenProgression|handleProgressionChoice/);
    expect(panel).not.toMatch(/ProfessionProgression|ProgressionPage|\"progression\"/);
    expect(codex).not.toMatch(/ProfessionGlossary|key: \"professions\"/);
  });

  it("writes and migrates only the canonical combat sidecar", () => {
    const fresh = currentCampaign();
    expect(fresh.mechanics.combat).toBeTruthy();
    expect(fresh.mechanics).not.toHaveProperty("tow");
    expect(fresh.mechanics).not.toHaveProperty("archetype");

    for (const legacyKey of ["tow", "archetype"]) {
      const legacy = currentCampaign();
      legacy.mechanics[legacyKey] = legacy.mechanics.combat;
      delete legacy.mechanics.combat;
      const upgraded = upgradeCampaignPayload(legacy);
      expect(upgraded.ok).toBe(true);
      expect(upgraded.state.mechanics.combat).toBeTruthy();
      expect(upgraded.state.mechanics).not.toHaveProperty(legacyKey);
    }
  });

  it("restores direct player attacks to deterministic combat intent", () => {
    const target = currentCampaign().world.codex.characters["glass-spire-key-master-iorin"];
    const projection = {
      combatTargetIds: [target.id],
      characters: { [target.id]: target },
    };
    const directive = playerCombatDirective("I attack Master Iorin of the Glass Spire", projection);
    expect(directive?.initiator).toBe("player");
    expect(directive?.foes?.[0]?.npc_id).toBe("glass-spire-key-master-iorin");
  });

  it("retains the current archetypes and recovered authored companions", () => {
    expect(STARTING_ARCHETYPES).toHaveLength(12);
    for (const id of ["garran", "elske", "linnet"]) expect(COMPANIONS).toHaveProperty(id);
    const state = currentCampaign();
    for (const id of [
      "glass-spire-key-master-iorin",
      "wintermere-amber-cup-astrid",
      "whitemarch-velvet-lantern-mara",
      "whitemarch-silver-swan-elira",
      "tellmar-red-reed-kiri",
      "tellmar-pearl-lotus-yue",
      "asalan-copper-date-zahra",
      "asalan-blue-glass-samira",
      "selenyan-ashleaf-thaelis",
      "selenyan-moonbough-irelwen",
    ]) expect(state.world.codex.characters).toHaveProperty(id);
  });
});
