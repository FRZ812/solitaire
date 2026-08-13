// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { openLabSession } from "./CombatLab.jsx";
import { TowCombatView } from "./TowCombatView.jsx";

let root;
let container;

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
});

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  container?.remove();
  root = null;
  container = null;
});

async function renderView(props = {}) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const encounter = openLabSession({ packageId: "rogue", scenarioId: "training-yard" }).session.encounter;
  await act(async () => root.render(
    <TowCombatView
      encounter={encounter}
      onUseSkill={() => {}}
      onStandDown={() => {}}
      onSettle={() => {}}
      {...props}
    />,
  ));
  return container;
}

describe("compact combat HUD", () => {
  it("shows full-art abilities without labels, counts, infinity, or Swift badges", async () => {
    const mounted = await renderView();
    const actions = [...mounted.querySelectorAll(".tow-combat__action")];
    expect(actions.length).toBeGreaterThan(1);
    expect(actions.every((action) => action.querySelector(".tow-combat__ability-art img"))).toBe(true);
    expect(mounted.querySelector(".tow-combat__ability-art-name")).toBeNull();
    expect(mounted.querySelector(".tow-combat__action-charge")).toBeNull();
    expect(mounted.querySelector(".tow-combat__action-swift")).toBeNull();
    expect(actions.map((action) => action.textContent).join("")).not.toContain("∞");
    expect(actions.every((action) => action.querySelector(".tow-combat__sr-only")?.textContent)).toBe(true);
  });

  it("puts current and maximum health inside each health bar", async () => {
    const mounted = await renderView();
    const bars = [...mounted.querySelectorAll(".tow-combat__bar")];
    expect(bars.length).toBeGreaterThanOrEqual(2);
    expect(bars.every((bar) => /\d+\s*\/\s*\d+/.test(bar.querySelector(".tow-combat__bar-value")?.textContent)))
      .toBe(true);
    expect(mounted.querySelector(".tow-combat__hp")).toBeNull();
  });

  it("replaces the decorative title with a working exit control when supplied", async () => {
    const onEscape = vi.fn();
    const mounted = await renderView({ onEscape, escapeLabel: "Leave practice" });
    expect(mounted.textContent).not.toContain("The clash");
    const leave = [...mounted.querySelectorAll("button")]
      .find((button) => button.textContent.includes("Leave practice"));
    expect(leave).toBeTruthy();
    await act(async () => leave.click());
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("offers retreat in every active fight with the current calculated chance", async () => {
    const onRetreat = vi.fn();
    const mounted = await renderView({ onRetreat });
    const retreat = [...mounted.querySelectorAll("button")]
      .find((button) => button.textContent.includes("Retreat"));
    expect(retreat).toBeTruthy();
    expect(retreat.textContent).toMatch(/Retreat\s*·\s*\d+%/);
    expect(retreat.getAttribute("aria-label")).toMatch(/chance.*Spends .* action on failure/i);
    await act(async () => retreat.click());
    expect(onRetreat).toHaveBeenCalledWith("wanderer");
  });

  it("lets Escape dismiss details first and leave only on the next press", async () => {
    vi.useFakeTimers();
    try {
      const onEscape = vi.fn();
      const mounted = await renderView({ onEscape });
      const action = mounted.querySelector(".tow-combat__action");
      await act(async () => {
        action.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }));
        vi.advanceTimersByTime(450);
      });
      expect(mounted.querySelector("[data-testid='tow-skill-details']")).toBeTruthy();
      await act(async () => mounted.querySelector(".tow-combat").dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
      ));
      expect(mounted.querySelector("[data-testid='tow-skill-details']")).toBeNull();
      expect(onEscape).not.toHaveBeenCalled();
      await act(async () => mounted.querySelector(".tow-combat").dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
      ));
      expect(onEscape).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
