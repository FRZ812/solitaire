/** @vitest-environment jsdom */

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { startProductionCombatSession, transitionProductionCombatSession } from "../../gameplay/production/combat-session.js";
import ProductionCombatView from "./ProductionCombatView.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function session({ enemyHp = 5, enemyDefense = 0 } = {}) {
  return startProductionCombatSession({
    campaignId: "campaign-7",
    sessionId: "campaign-7:combat:2",
    seed: "campaign-7:combat:2",
    source: { kind: "narrator", note: "A brigand attacks from the ditch.", lethal: true },
    player: {
      name: "Wanderer",
      hp: 20,
      maxHp: 20,
      attack: 5,
      defense: 3,
      proficiencyId: "mastery-sword",
    },
    enemy: {
      name: "Brigand captain",
      hp: enemyHp,
      maxHp: enemyHp,
      damage: { min: 2, max: 2 },
      defense: enemyDefense,
      npcId: "brigand-captain",
    },
  }).session;
}

let root;
let container;

async function renderView(props) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<ProductionCombatView {...props} />);
  });
}

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe("ProductionCombatView", () => {
  it("shows authoritative HP and intent and emits exact action commands", async () => {
    const onCommand = vi.fn();
    await renderView({ session: session(), onCommand, onSettle: vi.fn(), error: null });

    expect(container.textContent).toContain("A brigand attacks from the ditch.");
    expect(container.textContent).toContain("Wanderer");
    expect(container.textContent).toContain("20 / 20");
    expect(container.textContent).toContain("Brigand captain");
    expect(container.textContent).toContain("5 / 5");
    expect(container.textContent).toContain("Incoming strike: 2 damage");
    expect(container.textContent).toContain("Deal 5 damage");
    expect(container.textContent).toContain("Raise 5 guard");

    const strike = [...container.querySelectorAll("button")]
      .find((button) => button.textContent.includes("Strike"));
    await act(async () => strike.click());
    expect(onCommand).toHaveBeenCalledWith({
      type: "use-action",
      actorId: "player",
      actionId: "strike",
      targetId: "enemy",
    });
    expect(document.activeElement).toBe(strike);

    const guard = [...container.querySelectorAll("button")]
      .find((button) => button.textContent.includes("Guard"));
    guard.focus();
    guard.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(strike);
    strike.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Tab", shiftKey: true, bubbles: true, cancelable: true,
    }));
    expect(document.activeElement).toBe(guard);
  });

  it("narrates canonical resolution events and displays mitigated strike damage", async () => {
    const active = session({ enemyHp: 12, enemyDefense: 2 });
    const transitioned = transitionProductionCombatSession(active, {
      type: "use-action",
      actorId: "player",
      actionId: "strike",
      targetId: "enemy",
    }).session;
    await renderView({ session: transitioned, onCommand: vi.fn(), onSettle: vi.fn(), error: null });

    expect(container.textContent).toContain("Deal 3 damage");
    expect(container.textContent).toContain("You take 2 damage.");
    expect(container.textContent).not.toContain("waiting for your decision");
  });

  it("owns terminal presentation and exposes settlement without overclaiming durability", async () => {
    const terminal = transitionProductionCombatSession(session(), {
      type: "use-action",
      actorId: "player",
      actionId: "strike",
      targetId: "enemy",
    }).session;
    const onSettle = vi.fn();
    await renderView({ session: terminal, onCommand: vi.fn(), onSettle, error: null });

    expect(container.textContent).toContain("Victory");
    expect(container.textContent).toContain("The foe falls.");
    expect(container.textContent).toContain("Apply the authoritative aftermath");
    expect(container.textContent).not.toContain("saved");
    const settle = [...container.querySelectorAll("button")]
      .find((button) => button.textContent.includes("Apply aftermath"));
    expect(document.activeElement).toBe(settle);
    await act(async () => settle.click());
    expect(onSettle).toHaveBeenCalledTimes(1);
  });

  it("restores focus when the modal unmounts", async () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    await renderView({ session: session(), onCommand: vi.fn(), onSettle: vi.fn(), error: null });

    expect(document.activeElement).not.toBe(opener);
    await act(async () => root.unmount());
    await act(async () => { await Promise.resolve(); });
    expect(document.activeElement).toBe(opener);
    root = null;
    opener.remove();
  });

  it("announces rejected commands without replacing the combat state", async () => {
    await renderView({
      session: session(),
      onCommand: vi.fn(),
      onSettle: vi.fn(),
      error: "That action was rejected by replay authority.",
    });

    expect(container.querySelector('[role="alert"]')?.textContent)
      .toContain("rejected by replay authority");
  });
});
