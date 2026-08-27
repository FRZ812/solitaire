// @vitest-environment jsdom

import React, { act } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { resolveCharacterPortrait } from "./character-portrait-assets.js";
import { VisualNovelStage } from "./VisualNovelStage.jsx";

let container;
let root;

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
});

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  container?.remove();
  container = null;
  root = null;
});

const mara = {
  id: "mara",
  name: "Mara Vale",
  kind: "npc",
  portraitKey: "companion:senna",
};

function storyState() {
  return {
    character: {
      id: "wanderer",
      name: "Ryn",
      portraitKey: "tow:ranger",
    },
    portraitOverrides: {
      wanderer: "data:image/png;base64,PLAYER",
    },
    world: {
      codex: {
        characters: {
          wanderer: {
            id: "wanderer",
            name: "Ryn",
            kind: "player",
            portraitKey: "tow:ranger",
          },
          mara,
        },
      },
    },
  };
}

async function renderStage(props) {
  if (!container) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  }
  await act(async () => root.render(
    <VisualNovelStage
      state={storyState()}
      beats={[]}
      loading={false}
      onContinue={() => {}}
      {...props}
    />,
  ));
  return container;
}

async function click(element) {
  expect(element).toBeTruthy();
  await act(async () => element.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

describe("VisualNovelStage", () => {
  it("keeps story navigation touch targets at least 44px on short screens", () => {
    const css = readFileSync(join(process.cwd(), "src/components/chat-scene.css"), "utf8");
    expect(css).toMatch(/\.visual-novel-stage__controls button\s*\{\s*min-width:\s*0;\s*min-height:\s*44px;/);
    expect(css).not.toContain(".visual-novel-stage__controls button { min-height: 40px; }");
  });

  it("shows one bubble at a time and pages backward through exact speaker portraits", async () => {
    const onContinue = vi.fn();
    const beats = [
      { id: "t0", type: "timestamp", content: "Day 1 · 08:00" },
      { id: "p1", type: "player", content: "I ask who barred the gate." },
      { id: "d2", type: "dialogue", speakerId: "mara", name: "Mara Vale", line: "The reeve did." },
    ];
    const mounted = await renderStage({ beats, onContinue });

    expect(mounted.querySelectorAll(".visual-novel-stage .beat")).toHaveLength(1);
    expect(mounted.textContent).toContain("The reeve did.");
    expect(mounted.textContent).not.toContain("I ask who barred the gate.");
    expect(mounted.querySelector(".visual-novel-stage__counter").textContent).toContain("2 / 2");
    expect(mounted.querySelector(".visual-novel-character").dataset.characterId).toBe("mara");
    expect(mounted.querySelector(".visual-novel-character img").getAttribute("src"))
      .toBe(resolveCharacterPortrait(mara));

    await click(mounted.querySelector('[aria-label="Previous story beat"]'));
    expect(mounted.textContent).toContain("I ask who barred the gate.");
    expect(mounted.textContent).not.toContain("The reeve did.");
    expect(mounted.querySelector(".visual-novel-character").dataset.characterId).toBe("wanderer");
    expect(mounted.querySelector(".visual-novel-character img").getAttribute("src"))
      .toBe("data:image/png;base64,PLAYER");

    await click(mounted.querySelector('[aria-label="Next story beat"]'));
    expect(mounted.textContent).toContain("The reeve did.");
    await click(mounted.querySelector('[aria-label="Continue story"]'));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("uses the canonical actor portrait for an NPC action bubble", async () => {
    const mounted = await renderStage({
      beats: [{
        id: "n1",
        type: "narration",
        actorId: "mara",
        content: "Mara Vale waits quietly.",
      }],
    });

    expect(mounted.querySelector("[data-beat-id='n1']")).toBeTruthy();
    expect(mounted.querySelector(".visual-novel-character").dataset.characterId).toBe("mara");
    expect(mounted.querySelector(".visual-novel-character img").getAttribute("alt"))
      .toBe("Mara Vale portrait");
  });

  it("reveals the first newly generated bubble instead of skipping a multi-entry response", async () => {
    const onContinue = vi.fn();
    const opening = [{ id: "n0", type: "narration", content: "Rain falls across the road." }];
    const mounted = await renderStage({ beats: opening, onContinue });

    await renderStage({
      beats: [
        ...opening,
        { id: "p1", type: "player", content: "I raise the lantern." },
        { id: "d2", type: "dialogue", speakerId: "mara", name: "Mara Vale", line: "Lower it." },
      ],
      onContinue,
    });

    expect(mounted.textContent).toContain("I raise the lantern.");
    expect(mounted.textContent).not.toContain("Lower it.");
    await click(mounted.querySelector('[aria-label="Next story beat"]'));
    expect(mounted.textContent).toContain("Lower it.");
    expect(onContinue).not.toHaveBeenCalled();
  });

  it("keeps an in-flight narrator response at the live edge while history stays readable", async () => {
    const mounted = await renderStage({
      beats: [
        { id: "n1", type: "narration", content: "The gate stands open." },
        { id: "d2", type: "dialogue", speakerId: "mara", line: "Come through." },
      ],
      loading: true,
    });

    expect(mounted.querySelector('[aria-label="Narrator response pending validation"]')).toBeTruthy();
    await click(mounted.querySelector('[aria-label="Previous story beat"]'));
    expect(mounted.textContent).toContain("The gate stands open.");
    expect(mounted.querySelector('[aria-label="Narrator response pending validation"]')).toBeNull();
  });
});
