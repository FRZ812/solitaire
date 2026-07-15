import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CombatView } from "./CombatView.jsx";

function combatFixture() {
  const cards = {
    c001: {
      uid: "c001", abilityId: "basic-attack", name: "Strike", description: "A measured weapon blow.",
      statLine: "weapon damage · 1 foe", requirementLine: "needs sword · Body 3+",
      type: "attack", target: "enemy", energyCost: 1, resolveCost: 0, exhaust: false, tier: "common",
    },
    c006: {
      uid: "c006", abilityId: "fireball", name: "Fireball", description: "A burst of flame.",
      statLine: "dmg 4–7 magical · all foes · burn 4 3t · 6 resolve", requirementLine: "Mind 4+",
      type: "attack", target: "all-enemies", energyCost: 1, resolveCost: 6, exhaust: false, tier: "common",
    },
  };
  return {
    round: 2,
    phase: "player",
    target: 0,
    targetUid: "e0",
    lethal: true,
    log: [{ id: "l1", kind: "system", text: "The lines are drawn." }],
    player: {
      uid: "p", name: "Wanderer", health: 24, maxHealth: 30, energy: 3, maxEnergy: 3,
      resolve: 4, resolveMax: 6, statuses: [], cooldowns: {}, spellSurge: true, prof: { spellcasting: 20 },
      abilities: [{ id: "basic-attack", tier: "common" }, { id: "fireball", tier: "common" }],
      weapon: { category: "sword" }, actionsLeft: 3,
    },
    allies: [{
      uid: "a0", name: "Mara", health: 18, maxHealth: 20, statuses: [], tier: "common",
    }],
    enemies: [{
      uid: "e0", id: "enemy", name: "Road Warden", tier: "common", health: 20, maxHealth: 24,
      armor: 2, ward: 0, statuses: [], demeanor: "wary", morale: 70, moraleMax: 80,
      intent: { id: "e0-r2", abilityId: "basic-attack", name: "Strike", kind: "attack", mode: "single", targetUid: "a0", damage: { min: 4, max: 6, hits: 1 } },
      intents: [], resolved: null,
    }],
    deck: { cards, hand: ["c001", "c006"], draw: ["c002", "c003"], discard: ["c004"], exhaust: ["c005"] },
  };
}

describe("CombatView", () => {
  it("renders visible intent, hand, energy, and every pile without SVG controls", () => {
    const html = renderToStaticMarkup(
      <CombatView
        combat={combatFixture()}
        onPlayCard={vi.fn()}
        onSetTarget={vi.fn()}
        onEndTurn={vi.fn()}
        onFlee={vi.fn()}
        onStandDown={vi.fn()}
        onCeasefire={vi.fn()}
        onResolve={vi.fn()}
      />,
    );
    expect(html).toContain("Intent · Strike → Mara");
    expect(html).toContain("Strike");
    expect(html).toContain("weapon damage · 1 foe");
    expect(html).toContain("needs sword · Body 3+");
    expect(html).toContain("8 resolve");
    expect(html).not.toContain("6 resolve");
    expect(html).toContain("3/3");
    expect(html).toContain("Draw 2");
    expect(html).toContain("Discard 1");
    expect(html).toContain("Exhaust 1");
    expect(html).not.toContain("<svg");
    expect(html).not.toContain("Improvise");
    expect(html).not.toContain("Advance");
    expect(html).not.toContain("Withdraw");
  });
});
