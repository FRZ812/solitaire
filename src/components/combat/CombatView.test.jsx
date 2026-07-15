import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CombatView, EnemyDossier, PileSheet, groupCombatCards } from "./CombatView.jsx";

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
    c002: {
      uid: "c002", abilityId: "defend", name: "Guard", description: "Take cover.", statLine: "Block 7",
      type: "skill", target: "self", energyCost: 1, resolveCost: 0, exhaust: false, block: 7, tier: "common",
    },
    c003: {
      uid: "c003", abilityId: "basic-attack", name: "Strike", description: "A measured weapon blow.",
      statLine: "weapon damage · 1 foe", type: "attack", target: "enemy", energyCost: 1,
      resolveCost: 0, exhaust: false, tier: "common",
    },
    c004: {
      uid: "c004", abilityId: "basic-attack", name: "Strike", description: "A measured weapon blow.",
      statLine: "weapon damage · 1 foe", type: "attack", target: "enemy", energyCost: 1,
      resolveCost: 0, exhaust: false, tier: "common",
    },
    c005: {
      uid: "c005", abilityId: "haste", name: "Haste", description: "Quicken your next move.",
      statLine: "self · 8 resolve", type: "skill", target: "self", energyCost: 1,
      resolveCost: 8, exhaust: true, draw: 2, tier: "rare",
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
      race: "human", armor: 2, ward: 1, dodge: 12, accuracy: 18, critChance: 5, speed: 4, will: 6,
      block: 3, shield: 2, magicShield: 1, resolve: 5, resolveMax: 8,
      attrs: { body: 6, reflex: 5, vigor: 7, mind: 3, wit: 4, presence: 2 },
      statuses: [{ type: "weaken", value: 20, duration: 2 }], demeanor: "wary", morale: 70, moraleMax: 80,
      canTalk: true, actionsPerTurn: 2,
      weapon: { name: "Warden's Spear", category: "spear", min: 4, max: 7, type: "physical", pen: 2, reach: 2 },
      gear: [{ id: "warden-mail", name: "Warden Mail", kind: "armor", tier: "uncommon", armor: 2, ward: 1 }],
      abilities: [{ id: "power-strike", tier: "common" }],
      intent: { id: "e0-r2", abilityId: "basic-attack", name: "Strike", kind: "attack", mode: "single", targetUid: "a0", damage: { min: 4, max: 6, hits: 1 }, status: "burn", effect: { type: "burn", value: 4, duration: 3, target: "enemy" } },
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
    expect(html).toContain('aria-label="Deck 6 · Full deck"');
    expect(html).toContain('aria-label="Draw 2 · Not yet drawn"');
    expect(html).toContain("Draw 2");
    expect(html).toContain("Discard 1");
    expect(html).toContain("Exhaust 1");
    expect(html).toContain('aria-labelledby="combat-enemy-e0-inspect"');
    expect(html).toContain("Inspect Road Warden");
    expect(html).toContain("Vitality 20 of 24");
    expect(html).toContain('class="combat-enemy__target"');
    expect(html).toContain("Targeted");
    expect(html).toContain("Full log");
    expect(html).toContain("Block 3");
    expect(html).not.toContain("<svg");
    expect(html).not.toContain("Improvise");
    expect(html).not.toContain("Advance");
    expect(html).not.toContain("Withdraw");
  });

  it("groups pile contents without exposing or mutating draw order", () => {
    const deck = combatFixture().deck;
    const drawBefore = [...deck.draw];
    const groups = groupCombatCards(deck, "draw");
    expect(groups.map(({ card, count }) => [card.name, count])).toEqual([
      ["Guard", 1],
      ["Strike", 1],
    ]);
    expect(deck.draw).toEqual(drawBefore);

    const html = renderToStaticMarkup(<PileSheet deck={deck} pile="draw" onClose={vi.fn()} />);
    expect(html).toContain("Not yet drawn");
    expect(html).toContain("draw order remains unknown");
    expect(html).toContain('aria-label="1 copies"');
    expect(html).toContain('role="dialog"');
  });

  it("renders the inspected enemy as a character-menu dossier", () => {
    const fixture = combatFixture();
    const html = renderToStaticMarkup(
      <EnemyDossier
        enemy={fixture.enemies[0]}
        targetNames={new Map([["a0", "Mara"]])}
        onClose={vi.fn()}
      />,
    );
    expect(html).toContain("Combat profile");
    expect(html).toContain("Attributes");
    expect(html).toContain("Equipment");
    expect(html).toContain("Warden&#x27;s Spear");
    expect(html).toContain("Warden Mail");
    expect(html).toContain("Known abilities");
    expect(html).toContain("Power Strike");
    expect(html).toContain("Queued intent");
    expect(html).toContain("Intent · Strike → Mara");
    expect(html).toContain("Burn 4 · 3t");
    expect(html).toContain("Active conditions");
    expect(html).toContain("Magnitude 20");
    expect(html).toContain('aria-label="Close Road Warden"');
  });
});
