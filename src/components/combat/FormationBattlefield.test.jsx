// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { FormationBattlefield } from "./FormationBattlefield.jsx";

let root;
let container;

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  container?.remove();
  root = null;
  container = null;
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
});
