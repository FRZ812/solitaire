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
    expect(container.textContent).toContain("Opening narrator stream");

    await act(async () => container.querySelector('[aria-label="Previous story beat"]').click());
    expect(container.textContent).toContain("I enter the archive.");
    expect(container.querySelector('[data-character-id="wanderer"] img')).toBeTruthy();
    await act(async () => root.unmount());
    container.remove();
  });

  it("sinks the portrait under the story bubble instead of fading above it", () => {
    const css = readFileSync(`${ROOT}/src/components/chat-scene.css`, "utf8");
    const characterRule = css.match(/\.visual-novel-character\s*\{([^}]*)\}/)?.[1] || "";
    const portraitRule = css.match(/\.visual-novel-character > img,\s*\.visual-novel-character > div\s*\{([^}]*)\}/)?.[1] || "";
    const pageRule = css.match(/\.visual-novel-stage__page\s*\{([^}]*)\}/)?.[1] || "";

    expect(characterRule).toMatch(/--portrait-bubble-overlap:\s*clamp\(/);
    expect(characterRule).toContain("transform: translateY(var(--portrait-bubble-overlap));");
    expect(characterRule).toMatch(/z-index:\s*1/);
    expect(portraitRule).toMatch(/-webkit-mask-image:\s*none/);
    expect(portraitRule).toMatch(/mask-image:\s*none/);
    expect(pageRule).toMatch(/z-index:\s*3/);
    expect(css).toMatch(/@media \(max-height: 500px\)[\s\S]*?\.visual-novel-character\s*\{[\s\S]*?--portrait-bubble-overlap:\s*clamp\(18px, 5dvh, 28px\)/);
  });

  it("labels narration as narration and omits a redundant one-page count", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const state = currentCampaign();
    await act(async () => root.render(
      <VisualNovelStage
        state={state}
        beats={[{ id: "narrator-only", type: "narration", actorId: "wanderer", content: "The square opens ahead." }]}
      />,
    ));

    expect(container.querySelector(".visual-novel-stage__meta > span").textContent).toBe("Narrator");
    expect(container.querySelector('[aria-label="Story position"]')).toBeNull();

    await act(async () => root.unmount());
    container.remove();
  });

  it("presents narrator cancellation as a stop action rather than forward navigation", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => root.render(
      <VisualNovelStage
        state={currentCampaign()}
        beats={[{ id: "pending", type: "narration", content: "The square waits." }]}
        loading
        onCancelNarrator={vi.fn()}
      />,
    ));

    const stop = container.querySelector('[aria-label="Stop narrator"]');
    expect(stop.textContent.trim()).toBe("Stop narration");
    expect(stop.classList.contains("is-stop")).toBe(true);
    expect(stop.querySelector('[aria-hidden="true"]')).toBeNull();

    await act(async () => root.unmount());
    container.remove();
  });

  it("shows and clears an explicit overflow cue for a scrollable story page", async () => {
    const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");
    const clientHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get() { return this.classList?.contains("visual-novel-stage__copy") ? 420 : 0; },
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get() { return this.classList?.contains("visual-novel-stage__copy") ? 220 : 0; },
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => root.render(
      <VisualNovelStage
        state={currentCampaign()}
        beats={[{ id: "overflow", type: "narration", content: "A long page." }]}
      />,
    ));

    expect(container.textContent).toContain("Scroll for more");
    const copy = container.querySelector(".visual-novel-stage__copy");
    await act(async () => {
      copy.scrollTop = 200;
      copy.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    expect(container.textContent).not.toContain("Scroll for more");

    await act(async () => root.unmount());
    container.remove();
    if (scrollHeightDescriptor) Object.defineProperty(HTMLElement.prototype, "scrollHeight", scrollHeightDescriptor);
    else delete HTMLElement.prototype.scrollHeight;
    if (clientHeightDescriptor) Object.defineProperty(HTMLElement.prototype, "clientHeight", clientHeightDescriptor);
    else delete HTMLElement.prototype.clientHeight;
  });

  it("drops a stale overflow cue when a newly appended page fits without that cue", async () => {
    const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");
    const clientHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get() {
        if (!this.classList?.contains("visual-novel-stage__copy")) return 0;
        return this.parentElement?.dataset.beatId === "long-page" ? 420 : 240;
      },
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get() {
        if (!this.classList?.contains("visual-novel-stage__copy")) return 0;
        return this.parentElement?.classList.contains("has-more") ? 220 : 252;
      },
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const longPage = { id: "long-page", type: "narration", content: "A long page." };
    const fittingPage = { id: "fitting-page", type: "narration", content: "A fitting page." };
    await act(async () => root.render(
      <VisualNovelStage state={currentCampaign()} beats={[longPage]} />,
    ));
    expect(container.textContent).toContain("Scroll for more");

    await act(async () => root.render(
      <VisualNovelStage state={currentCampaign()} beats={[longPage, fittingPage]} />,
    ));
    expect(container.querySelector(".visual-novel-stage__page").dataset.beatId).toBe("fitting-page");
    expect(container.textContent).not.toContain("Scroll for more");

    await act(async () => root.unmount());
    container.remove();
    if (scrollHeightDescriptor) Object.defineProperty(HTMLElement.prototype, "scrollHeight", scrollHeightDescriptor);
    else delete HTMLElement.prototype.scrollHeight;
    if (clientHeightDescriptor) Object.defineProperty(HTMLElement.prototype, "clientHeight", clientHeightDescriptor);
    else delete HTMLElement.prototype.clientHeight;
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
    expect(container.querySelector('[aria-label="Story position"]').textContent).toContain("Page 4 of 4");
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
