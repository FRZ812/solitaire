// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  FormationBattlefield,
  basicMeleeLungeCues,
} from "./FormationBattlefield.jsx";

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
  vi.restoreAllMocks();
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
  it("collapses multi-hit basic melee receipts into one timed out-and-back lunge", () => {
    const sourceCell = { side: "player", index: 4 };
    const targetCell = { side: "enemy", index: 1 };
    expect(basicMeleeLungeCues([
      {
        id: "10-hit-0",
        sequence: 10,
        actionIndex: 2,
        basicMelee: true,
        attackerId: "knight",
        sourceCell,
        targetCell,
        delayMs: 0,
      },
      {
        id: "10-hit-1",
        sequence: 10,
        actionIndex: 2,
        basicMelee: true,
        attackerId: "knight",
        sourceCell,
        targetCell,
        delayMs: 210,
      },
    ])).toEqual([expect.objectContaining({
      actorId: "knight",
      sourceCell,
      targetCell,
      delayMs: 0,
      durationMs: 830,
    })]);
  });

  it("lunges the complete portrait-and-vitals card while keeping actor authority in its cell", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function bounds() {
      const side = this.dataset?.side;
      const index = Number(this.dataset?.cellIndex);
      if (!side || !Number.isSafeInteger(index)) {
        return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
      }
      const left = (index % 3) * 100;
      const top = (side === "enemy" ? 0 : 300) + (Math.floor(index / 3) * 80);
      return {
        x: left,
        y: top,
        top,
        left,
        right: left + 100,
        bottom: top + 80,
        width: 100,
        height: 80,
      };
    });
    const mounted = await renderFormation({
      actors: {
        knight: { id: "knight", name: "Knight", side: "player", hp: 84, maxHp: 100 },
        foe: { id: "foe", name: "Foe", side: "enemy", hp: 30, maxHp: 30 },
      },
      formations: {
        player: [null, null, null, null, "knight"],
        enemy: [null, "foe"],
      },
      feedbackCues: [{
        id: "10-hit",
        sequence: 10,
        actionIndex: 1,
        basicMelee: true,
        attackerId: "knight",
        targetId: "foe",
        sourceCell: { side: "player", index: 4 },
        targetCell: { side: "enemy", index: 1 },
        delayMs: 40,
      }],
      renderActorOverlay: (actor) => (
        <span data-testid={`overlay-${actor.id}`}>Status</span>
      ),
    });

    const source = mounted.querySelector("[data-side='player'][data-cell-index='4']");
    const lunge = source.querySelector(".tow-formation-unit.is-lunging");
    expect(lunge).toBeTruthy();
    expect(lunge.dataset.lungeId).toBe("10-hit-basic-melee-lunge");
    expect(lunge.style.getPropertyValue("--tow-lunge-delay")).toBe("40ms");
    expect(Number.parseFloat(lunge.style.getPropertyValue("--tow-lunge-y"))).toBeLessThan(0);
    expect(source.querySelector("[aria-label='Knight health']")).toBeTruthy();
    expect(lunge.querySelector("[data-testid='overlay-knight']")).toBeTruthy();
    expect(mounted.querySelector("[data-side='enemy'][data-cell-index='1'] [aria-label='Knight health']"))
      .toBeNull();
    expect(mounted.querySelector(".tow-formation-grid--player.has-lunging-unit")).toBeTruthy();
  });

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
    const knightHealth = mounted.querySelector("[aria-label='Knight health']");
    expect(knightHealth.closest(".tow-formation-unit").classList.contains("is-active")).toBe(true);
    expect(mounted.querySelector("img[src='/portraits/knight.webp']")).toBeTruthy();
    expect(mounted.querySelectorAll("[role='meter']")).toHaveLength(4);
    expect(knightHealth.getAttribute("aria-valuenow")).toBe("84");
    expect(mounted.querySelector("[aria-label='Warden Resolve']").getAttribute("aria-valuemax")).toBe("6");
    expect(mounted.querySelector(".tow-formation-unit__name")).toBeNull();
    expect([...knightHealth.closest(".tow-formation-unit__vitals").children].map((node) => node.classList[1]))
      .toEqual(["tow-formation-unit__meter--hp", "tow-formation-unit__meter--resolve"]);
  });

  it("exposes targeting, footprint, selection and intent states without enabling other cells", async () => {
    const onSelectCell = vi.fn();
    const onPreviewCell = vi.fn();
    const mounted = await renderFormation({
      actors: {
        foe: { id: "foe", name: "Foe", hp: 20, maxHp: 20, resolve: 4, resolveMax: 4 },
      },
      formations: { enemy: [null, "foe"], player: [] },
      validAnchors: [{ side: "enemy", index: 0 }, { side: "enemy", index: 1 }],
      affectedCells: [{ side: "enemy", index: 0 }, { side: "enemy", index: 1 }, { side: "enemy", index: 2 }],
      previewAnchor: { side: "enemy", index: 1 },
      selectedAnchor: { side: "enemy", index: 0 },
      intentCells: [{ side: "player", index: 4 }],
      onSelectCell,
      onPreviewCell,
    });

    const selected = mounted.querySelector("[data-side='enemy'][data-cell-index='0']");
    const affected = mounted.querySelector("[data-side='enemy'][data-cell-index='2']");
    const previewed = mounted.querySelector("[data-side='enemy'][data-cell-index='1']");
    const intent = mounted.querySelector("[data-side='player'][data-cell-index='4']");
    const invalid = mounted.querySelector("[data-side='enemy'][data-cell-index='8']");

    expect(["is-empty", "is-valid-anchor", "is-affected", "is-selected-anchor"]
      .every((className) => selected.classList.contains(className))).toBe(true);
    expect(selected.disabled).toBe(false);
    expect(selected.getAttribute("aria-label")).toMatch(/empty.*valid target.*selected target.*ability footprint/i);
    expect(affected.classList.contains("is-affected")).toBe(true);
    expect(affected.disabled).toBe(true);
    expect(previewed.classList.contains("is-preview-anchor")).toBe(true);
    expect(previewed.getAttribute("aria-label")).toMatch(/previewing the ability footprint/i);
    expect(intent.classList.contains("is-intent-target")).toBe(false);
    expect(invalid.disabled).toBe(true);

    await act(async () => selected.click());
    expect(onSelectCell).toHaveBeenCalledOnce();
    expect(onSelectCell).toHaveBeenCalledWith("enemy", 0);

    await act(async () => previewed.focus());
    expect(onPreviewCell).toHaveBeenLastCalledWith("enemy", 1);

    const focusKeeper = document.createElement("button");
    document.body.appendChild(focusKeeper);
    await act(async () => focusKeeper.focus());
    expect(onPreviewCell).toHaveBeenLastCalledWith(null, null);
    focusKeeper.remove();
  });

  it("opens an occupied cell dossier without turning vacant cells into controls", async () => {
    const onInspectActor = vi.fn();
    const actor = { id: "knight", name: "Knight", hp: 84, maxHp: 100 };
    const mounted = await renderFormation({
      actors: { knight: actor },
      formations: { player: [null, "knight"], enemy: [] },
      onInspectActor,
    });

    const empty = mounted.querySelector("[data-side='player'][data-cell-index='0']");
    const occupied = mounted.querySelector("[data-side='player'][data-cell-index='1']");
    expect(empty.disabled).toBe(true);
    expect(occupied.disabled).toBe(false);
    expect(occupied.getAttribute("aria-haspopup")).toBe("dialog");

    await act(async () => occupied.click());
    expect(onInspectActor).toHaveBeenCalledOnce();
    expect(onInspectActor).toHaveBeenCalledWith(actor);
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
    expect(mounted.querySelector("[data-side='player'][data-cell-index='4'] [aria-label='Knight health']"))
      .toBeTruthy();
    expect(mounted.querySelector("[data-side='player'][data-cell-index='4']").classList.contains("is-intent-target")).toBe(true);
    expect(mounted.querySelector("[data-side='player'][data-cell-index='1'] [aria-label='Knight health']"))
      .toBeNull();

    await act(async () => vi.advanceTimersByTime(300));

    const destination = mounted.querySelector("[data-side='player'][data-cell-index='1']");
    expect(mounted.querySelector(".tow-formation-battlefield").dataset.movementPhase).toBe("settling");
    expect(destination.querySelector("[aria-label='Knight health']")).toBeTruthy();
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
    expect(destination.querySelector("[aria-label='Knight health']")).toBeTruthy();
    expect(destination.querySelector(".tow-formation-unit.is-arriving")).toBeNull();
    expect(destination.querySelector(".tow-formation-cell__move-marker")).toBeTruthy();
  });
});
