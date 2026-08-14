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

function viewElement(encounter, props = {}) {
  return (
    <TowCombatView
      encounter={encounter}
      onUseSkill={() => {}}
      onStandDown={() => {}}
      onSettle={() => {}}
      {...props}
    />
  );
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
    expect(actions.every((action) => action.classList.contains("production-combat__action"))).toBe(true);
  });

  it("moves the incoming attack to one compact icon above the enemy", async () => {
    const mounted = await renderView();
    const intent = mounted.querySelector("[data-testid='tow-enemy-intent']");
    expect(intent).toBeTruthy();
    expect(intent.closest(".tow-combat__threat")).toBeTruthy();
    expect(intent.querySelector(".tow-combat__intent-sigil img")).toBeTruthy();
    expect(intent.getAttribute("aria-label")).toMatch(/(?:damage|hits of).*targeting/i);
    expect(intent.querySelector(".tow-combat__intent-target")?.textContent).toMatch(/^→\s+/);
    expect(mounted.querySelector(".tow-combat__telegraph")).toBeNull();
    expect(mounted.querySelector(".tow-combat__incoming")).toBeNull();
    expect(mounted.querySelector(".tow-combat__exchange")?.getAttribute("aria-label")).toBe("Combat record");
  });

  it("renders every multi-hit contact in its own staggered effect lane", async () => {
    const base = openLabSession({ packageId: "rogue", scenarioId: "training-yard" }).session.encounter;
    await renderView({ encounter: base });
    const sequence = base.sequence + 1;
    const next = {
      ...base,
      sequence,
      events: [
        ...base.events,
        {
          sequence,
          type: "skill-damage",
          actorId: base.playerId,
          targetId: base.enemyIds[0],
          skillId: "strike",
          hits: [
            { index: 0, damage: 4, toHp: 4, absorbed: 0, critical: false, dodged: false },
            { index: 1, damage: 5, toHp: 5, absorbed: 0, critical: false, dodged: false },
          ],
        },
      ],
    };
    await act(async () => root.render(viewElement(next)));

    const effects = [...container.querySelectorAll(".tow-combat__effect")];
    expect(effects).toHaveLength(2);
    expect(effects.map((effect) => effect.dataset.hitIndex)).toEqual(["0", "1"]);
    expect(effects.map((effect) => effect.dataset.hitCount)).toEqual(["2", "2"]);
    expect(effects.map((effect) => effect.dataset.effectLane)).toEqual(["0", "1"]);
    expect(effects.map((effect) => effect.style.getPropertyValue("--tow-effect-delay")))
      .toEqual(["0ms", "155ms"]);
  });

  it("puts current and maximum health inside each health bar", async () => {
    const mounted = await renderView();
    const bars = [...mounted.querySelectorAll(".tow-combat__bar")];
    expect(bars.length).toBeGreaterThanOrEqual(2);
    expect(bars.every((bar) => /\d+\s*\/\s*\d+/.test(bar.querySelector(".tow-combat__bar-value")?.textContent)))
      .toBe(true);
    expect(mounted.querySelector(".tow-combat__hp")).toBeNull();
  });

  it("commits one command through anticipation, contact, and recovery", async () => {
    vi.useFakeTimers();
    try {
      const onUseSkill = vi.fn();
      const mounted = await renderView({ onUseSkill });
      const action = mounted.querySelector(".tow-combat__action");

      await act(async () => {
        action.click();
        action.click();
      });

      expect(onUseSkill).not.toHaveBeenCalled();
      expect(mounted.querySelector(".tow-combat").dataset.presentationPhase).toBe("windup");
      expect(mounted.querySelector("[data-testid='tow-action-beat']")).toBeTruthy();
      expect(action.classList.contains("is-committed")).toBe(true);
      expect([...mounted.querySelectorAll(".tow-combat__action")].every((button) => button.disabled)).toBe(true);

      await act(async () => vi.advanceTimersByTime(600));
      expect(onUseSkill).toHaveBeenCalledTimes(1);
      expect(onUseSkill).toHaveBeenCalledWith("strike", "foe-0", "wanderer");
      expect(mounted.querySelector(".tow-combat").dataset.presentationPhase).toBe("resolve");
      expect(mounted.querySelector("[data-testid='tow-action-beat']")?.textContent).toContain("Consequence");
    } finally {
      vi.useRealTimers();
    }
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
