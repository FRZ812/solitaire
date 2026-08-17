// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { FormationBattlefield } from "./FormationBattlefield.jsx";

let root;
let container;
const originalMatchMedia = window.matchMedia;

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.useRealTimers();
  window.matchMedia = originalMatchMedia;
});

async function renderFormation(props = {}) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<FormationBattlefield {...props} />));
  return container;
}

describe("formation battlefield", () => {
  it("renders invisible logical vacancies and compact art-led unit vitals", async () => {
    const actors = {
      knight: { id: "knight", name: "Knight", hp: 84, maxHp: 100, resolve: 5, resolveMax: 8 },
      warden: { id: "warden", name: "Warden", side: "enemy", hp: 42, maxHp: 70, resolve: 2, resolveMax: 6 },
    };
    const mounted = await renderFormation({
      actors,
      formations: {
        player: [null, "knight"],
        enemy: [null, null, null, null, "warden"],
      },
      artForActor: (actor) => `/portraits/${actor.id}.webp`,
      activeActorId: "knight",
    });

    const cells = [...mounted.querySelectorAll(".tow-formation-cell")];
    expect(cells).toHaveLength(18);
    expect(mounted.querySelectorAll(".tow-formation-cell.is-empty")).toHaveLength(16);
    expect(mounted.querySelector("[data-side='enemy'][data-cell-index='0']").classList.contains("is-empty")).toBe(true);
    expect(mounted.querySelector("[data-side='enemy'][data-cell-index='0']").classList.contains("is-valid-anchor")).toBe(false);

    const units = [...mounted.querySelectorAll(".tow-formation-unit")];
    expect(units).toHaveLength(2);
    expect(units.find((unit) => unit.textContent.includes("Knight")).classList.contains("is-active")).toBe(true);
    expect(mounted.querySelector("img[src='/portraits/knight.webp']")).toBeTruthy();
    expect(mounted.querySelectorAll("[role='meter']")).toHaveLength(4);
    expect(mounted.querySelector("[aria-label='Knight health']").getAttribute("aria-valuenow")).toBe("84");
    expect(mounted.querySelector("[aria-label='Warden Resolve']").getAttribute("aria-valuemax")).toBe("6");
  });

  it("exposes targeting, footprint, selection and intent states without enabling other cells", async () => {
    const onSelectCell = vi.fn();
    const mounted = await renderFormation({
      actors: {
        foe: { id: "foe", name: "Foe", hp: 20, maxHp: 20, resolve: 4, resolveMax: 4 },
      },
      formations: { enemy: [null, "foe"], player: [] },
      validAnchors: [{ side: "enemy", index: 0 }, { side: "enemy", index: 1 }],
      affectedCells: [{ side: "enemy", index: 0 }, { side: "enemy", index: 1 }, { side: "enemy", index: 2 }],
      selectedAnchor: { side: "enemy", index: 0 },
      intentCells: [{ side: "player", index: 4 }],
      onSelectCell,
    });

    const selected = mounted.querySelector("[data-side='enemy'][data-cell-index='0']");
    const affected = mounted.querySelector("[data-side='enemy'][data-cell-index='2']");
    const intent = mounted.querySelector("[data-side='player'][data-cell-index='4']");
    const invalid = mounted.querySelector("[data-side='enemy'][data-cell-index='8']");

    expect(["is-empty", "is-valid-anchor", "is-affected", "is-selected-anchor"]
      .every((className) => selected.classList.contains(className))).toBe(true);
    expect(selected.disabled).toBe(false);
    expect(selected.getAttribute("aria-label")).toMatch(/empty.*valid target.*selected target.*affected/i);
    expect(affected.classList.contains("is-affected")).toBe(true);
    expect(affected.disabled).toBe(true);
    expect(intent.classList.contains("is-intent-target")).toBe(true);
    expect(invalid.disabled).toBe(true);

    await act(async () => selected.click());
    expect(onSelectCell).toHaveBeenCalledOnce();
    expect(onSelectCell).toHaveBeenCalledWith("enemy", 0);
  });

  it("holds pre-move cells until the cue, then swaps formation and intent atomically", async () => {
    vi.useFakeTimers();
    const actors = {
      knight: { id: "knight", name: "Knight", hp: 84, maxHp: 100, resolve: 5, resolveMax: 8 },
    };
    const mounted = await renderFormation({
      actors,
      formations: {
        version: 2,
        player: [null, "knight", null, null, null, null, null, null, null],
        enemy: Array(9).fill(null),
      },
      intentCells: [{ side: "player", index: 1 }],
      intentCellsBeforeMove: [{ side: "player", index: 4 }],
      feedbackCues: [{
        id: "40-hit",
        targetId: "knight",
        hpChange: -16,
        shieldChange: 0,
        delayMs: 0,
      }],
      movementCue: {
        id: "41-formation-moved",
        delayMs: 300,
        durationMs: 200,
        moves: [{ actorId: "knight", side: "player", fromCell: 4, toCell: 1 }],
        formationsBefore: {
          version: 2,
          player: [null, null, null, null, "knight", null, null, null, null],
          enemy: Array(9).fill(null),
        },
      },
    });
    const focusKeeper = document.createElement("button");
    document.body.appendChild(focusKeeper);
    focusKeeper.focus();

    expect(mounted.querySelector(".tow-formation-battlefield").dataset.movementPhase).toBe("pending");
    expect(mounted.querySelector(".tow-formation-battlefield").getAttribute("aria-busy")).toBe("true");
    expect(mounted.querySelector("[data-side='player'][data-cell-index='4']").textContent).toContain("Knight");
    expect(mounted.querySelector("[data-side='player'][data-cell-index='4']").classList.contains("is-intent-target")).toBe(true);
    expect(mounted.querySelector("[data-side='player'][data-cell-index='1']").textContent).not.toContain("Knight");

    await act(async () => vi.advanceTimersByTime(300));

    const destination = mounted.querySelector("[data-side='player'][data-cell-index='1']");
    expect(mounted.querySelector(".tow-formation-battlefield").dataset.movementPhase).toBe("settling");
    expect(destination.textContent).toContain("Knight");
    expect(destination.classList.contains("is-intent-target")).toBe(true);
    expect(destination.querySelector(".tow-formation-unit.is-arriving")).toBeTruthy();
    expect(destination.querySelector(".tow-formation-cell__move-marker")).toBeTruthy();
    expect(destination.querySelector("[aria-label='Knight health']").getAttribute("aria-valuenow"))
      .toBe("84");
    expect(destination.querySelector(".tow-formation-unit.is-reacting")).toBeNull();
    expect(mounted.querySelector(".tow-formation-battlefield__announcement").textContent)
      .toBe("Knight moves from player row 2 column 2 to row 1 column 2.");
    expect(document.activeElement).toBe(focusKeeper);

    await act(async () => vi.advanceTimersByTime(200));
    expect(mounted.querySelector(".tow-formation-battlefield").dataset.movementPhase).toBe("settled");
    expect(destination.querySelector(".tow-formation-cell__move-marker")).toBeNull();
    expect(document.activeElement).toBe(focusKeeper);
    focusKeeper.remove();
  });

  it("uses a direct final swap and static destination marker under reduced motion", async () => {
    vi.useFakeTimers();
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    const mounted = await renderFormation({
      actors: {
        knight: { id: "knight", name: "Knight", hp: 84, maxHp: 100 },
      },
      formations: {
        version: 2,
        player: [null, "knight", null, null, null, null, null, null, null],
        enemy: Array(9).fill(null),
      },
      movementCue: {
        id: "42-formation-moved",
        delayMs: 0,
        durationMs: 200,
        moves: [{ actorId: "knight", side: "player", fromCell: 4, toCell: 1 }],
        formationsBefore: {
          version: 2,
          player: [null, null, null, null, "knight", null, null, null, null],
          enemy: Array(9).fill(null),
        },
      },
    });

    await act(async () => vi.advanceTimersByTime(0));
    const battlefield = mounted.querySelector(".tow-formation-battlefield");
    const destination = mounted.querySelector("[data-side='player'][data-cell-index='1']");
    expect(battlefield.dataset.reducedMotion).toBe("true");
    expect(battlefield.dataset.movementPhase).toBe("settling");
    expect(destination.textContent).toContain("Knight");
    expect(destination.querySelector(".tow-formation-unit.is-arriving")).toBeNull();
    expect(destination.querySelector(".tow-formation-cell__move-marker")).toBeTruthy();
  });
});
