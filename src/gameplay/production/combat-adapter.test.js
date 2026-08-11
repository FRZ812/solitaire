import { describe, expect, it } from "vitest";
import { startProductionCombatSession } from "./combat-session.js";
import { adaptNarratorCombatStart } from "./combat-adapter.js";

function campaignState() {
  return {
    productionCombatSequence: 2,
    pendingLoot: null,
    party: [],
    character: {
      name: "Wanderer",
      vitality: 24,
      vitalityMax: 30,
      resolve: 8,
      resolveMax: 8,
      abilities: [],
      conditions: [],
      attributes: { body: 2, reflex: 3, vigor: 2, mind: 2, wit: 4, presence: 1 },
      proficiencies: {},
      inventory: { carried: [], coins: { copper: 0, silver: 0, gold: 0 } },
    },
    world: {
      seed: "avarra:campaign:fixture",
      codex: {
        items: {},
        characters: { wanderer: { id: "wanderer", worn: [] } },
      },
    },
  };
}

function enemy() {
  return {
    name: "Roadside brigand",
    health: 12,
    maxHealth: 12,
    weapon: { min: 2, max: 4, category: "sword" },
    armor: 1,
    ward: 1,
    dodge: 2,
    abilities: [],
    statuses: [],
    npcId: "brigand-captain",
  };
}

function directive() {
  return {
    initiator: "player",
    surprise: false,
    lethal: true,
    foes: [{ npc_id: "brigand-captain", kind: "bandit", name: "Roadside brigand" }],
    note: "A roadside brigand lunges from the ditch.",
  };
}

describe("narrator production-combat capability adapter", () => {
  it("projects one supported narrator foe into a deterministic production session", () => {
    const adapted = adaptNarratorCombatStart({
      campaignId: "campaign-7",
      state: campaignState(),
      directive: directive(),
      enemies: [enemy()],
    });

    expect(adapted).toMatchObject({
      ok: true,
      nextSequence: 3,
      input: {
        campaignId: "campaign-7",
        sessionId: "campaign-7:combat:2",
        source: { kind: "narrator", lethal: true },
        player: { proficiencyId: "mastery-unarmed" },
        enemy: {
          name: "Roadside brigand",
          damage: { min: 2, max: 4 },
          defense: 3,
          npcId: "brigand-captain",
        },
      },
    });
    expect(Number.isSafeInteger(adapted.input.seed)).toBe(true);
    expect(startProductionCombatSession(adapted.input).ok).toBe(true);
  });

  it("projects a supported travel foe with explicit travel ownership", () => {
    const adapted = adaptNarratorCombatStart({
      campaignId: "campaign-7",
      state: campaignState(),
      directive: directive(),
      enemies: [enemy()],
      sourceKind: "travel",
    });

    expect(adapted).toMatchObject({
      ok: true,
      input: { source: { kind: "travel" } },
    });
    expect(startProductionCombatSession(adapted.input).ok).toBe(true);
    expect(adaptNarratorCombatStart({
      campaignId: "campaign-7",
      state: campaignState(),
      directive: directive(),
      enemies: [enemy()],
      sourceKind: "unknown",
    })).toEqual({ ok: false, reason: "unsupported-source-kind", input: null });
  });

  it.each([
    ["multiple-enemies", (state, dir, enemies) => enemies.push(enemy())],
    ["party-companion", (state) => state.party.push("companion")],
    ["player-ability", (state) => state.character.abilities.push({ id: "fireball", tier: "common" })],
    ["enemy-ability", (_state, _dir, enemies) => enemies[0].abilities.push({ id: "poison" })],
    ["surprise", (_state, dir) => { dir.surprise = true; }],
    ["nonlethal", (_state, dir) => { dir.lethal = false; }],
    ["unsettled-loot", (state) => { state.pendingLoot = { items: [] }; }],
  ])("leaves %s on the legacy path instead of dropping unsupported mechanics", (reason, arrange) => {
    const state = campaignState();
    const dir = directive();
    const enemies = [enemy()];
    arrange(state, dir, enemies);

    expect(adaptNarratorCombatStart({
      campaignId: "campaign-7",
      state,
      directive: dir,
      enemies,
    })).toEqual({ ok: false, reason: `unsupported-${reason}`, input: null });
  });
});
