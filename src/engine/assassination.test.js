import { describe, expect, it } from "vitest";
import { makeInitialState } from "../data/initial-state.js";
import {
  narratorAssassinationAttemptCapabilities,
  narratorAssassinationCapabilities,
} from "./assassination.js";
import { buildNarratorProjection, narratorTurnPolicy } from "./narrator-projection.js";
import { applyBeat } from "./beat.js";
import { deriveCombatStats } from "./combat-stats.js";

function character(id, overrides = {}) {
  return {
    id,
    kind: "npc",
    name: id.replace(/-/g, " "),
    race: "human",
    level: 1,
    attributes: { body: 1, reflex: 1, vigor: 1, mind: 1, wit: 1, presence: 1 },
    proficiencies: {},
    abilities: [],
    innatePassives: [],
    worn: [],
    ...overrides,
  };
}

function assassinationState() {
  const state = makeInitialState();
  const current = state.world.currentTile;
  const player = {
    ...state.character,
    attributes: { body: 12, reflex: 16, vigor: 10, mind: 4, wit: 14, presence: 4 },
    proficiencies: { ...(state.character.proficiencies || {}), ambush: 600, awareness: 150 },
    abilities: [{ id: "execute", tier: "rare" }],
  };
  return {
    ...state,
    created: true,
    character: player,
    world: {
      ...state.world,
      codex: {
        ...state.world.codex,
        items: {
          ...state.world.codex.items,
          "iron-dagger": {
            id: "iron-dagger", name: "Iron Dagger", kind: "weapon", tier: "common",
          },
        },
        characters: {
          ...state.world.codex.characters,
          wanderer: {
            ...state.world.codex.characters.wanderer,
            attributes: { ...player.attributes },
            proficiencies: { ...player.proficiencies },
            abilities: [...player.abilities],
            worn: ["iron-dagger"],
          },
          mark: character("mark", { at: { x: current.x, y: current.y, day: state.time.day } }),
          bulwark: character("bulwark", {
            at: { x: current.x, y: current.y, day: state.time.day },
            level: 80,
            tier: "legendary",
            health: 400,
            attributes: { body: 70, reflex: 60, vigor: 80, mind: 40, wit: 60, presence: 50 },
            abilities: ["sanctuary"],
            innatePassives: [{ id: "undying", tier: "divine" }],
          }),
        },
      },
    },
  };
}

describe("narrator assassination authority", () => {
  it("does not export a raw death reducer outside the compiled application boundary", async () => {
    const module = await import("./assassination.js");
    expect(module).not.toHaveProperty("applyNarratorAssassination");
  });

  it("derives only exact methods earned against a present canonical stat block", () => {
    const state = assassinationState();
    const capabilities = narratorAssassinationCapabilities(state, ["mark", "bulwark"]);

    expect(deriveCombatStats(state.character, state.world.codex).weapon.category).toBe("dagger");
    expect(capabilities.mark).toEqual({ methods: ["basic"] });
    expect(capabilities).not.toHaveProperty("bulwark");
  });

  it("binds exact assassination methods into the projection and general turn policy", () => {
    const state = assassinationState();
    const projection = buildNarratorProjection(state);
    const policy = narratorTurnPolicy("I try to assassinate the mark.", state);

    expect(projection.assassinationAttempts.bulwark.methods).toEqual(["basic"]);
    expect(projection.assassinationTargets.mark.methods).toEqual(["basic"]);
    expect(projection.context).toContain("mark:basic");
    expect(policy.allowedEffects).toContain("assassination");
    expect(policy.allowedEffects).not.toContain("start_combat");
  });

  it("exposes no legacy assassination surface for a contaminated Tower archetype", () => {
    const state = assassinationState();
    state.character = {
      ...state.character,
      progressionModel: "tow-archetype",
      abilities: [
        { id: "execute", tier: "rare" },
        { id: "firebolt", tier: "rare" },
        { id: "blood-siphon", tier: "rare" },
        { id: "haste", tier: "rare" },
        { id: "gate", tier: "legendary" },
      ],
      progression: {
        professions: [{
          professionId: "sorcerer",
          paths: { "stale-sorcerer-track": 20 },
          choices: { signatureSpellId: "firebolt" },
          metamagic: ["quickened-signature"],
        }],
      },
    };
    state.world.codex.characters.wanderer = {
      ...state.world.codex.characters.wanderer,
      ...state.character,
      worn: ["iron-dagger"],
    };

    expect(narratorAssassinationAttemptCapabilities(state, ["mark"])).toEqual({});
    expect(narratorAssassinationCapabilities(state, ["mark"])).toEqual({});

    const projection = buildNarratorProjection(state);
    expect(projection.assassinationAttempts).toEqual({});
    expect(projection.assassinationTargets).toEqual({});
    expect(projection.context).not.toContain("mark:basic");
    expect(projection.context).not.toContain("mark:execute");
  });

  it("fails closed for absent, incomplete, already-dead, and protected targets", () => {
    const state = assassinationState();
    const current = state.world.currentTile;
    state.world.codex.characters.incomplete = character("incomplete", {
      at: { x: current.x, y: current.y, day: state.time.day },
      attributes: { body: 1 },
    });
    state.world.codex.characters.dead = character("dead", {
      at: { x: current.x, y: current.y, day: state.time.day },
      deathDay: state.time.day,
    });

    expect(narratorAssassinationCapabilities(
      state,
      ["bulwark", "incomplete", "dead", "not-canonical"],
    )).toEqual({});
  });

  it("derives defenses from the target's own canonical equipment", () => {
    const state = assassinationState();
    state.world.codex.items["stonewall-plate"] = {
      id: "stonewall-plate",
      name: "Stonewall Plate",
      kind: "armor",
      tier: "legendary",
      passives: [{ id: "stonewall", tier: "legendary" }],
      combat: { armor: 20, armorClass: "heavy" },
    };
    state.world.codex.characters.mark.worn = ["stonewall-plate"];

    expect(narratorAssassinationCapabilities(state, ["mark"])).toEqual({});
  });

  it("does not authorize a method with a malformed owned ability tier", () => {
    const state = assassinationState();
    state.character.abilities = [{ id: "execute", tier: "forged" }];
    state.world.codex.characters.wanderer.abilities = [...state.character.abilities];

    expect(narratorAssassinationCapabilities(state, ["mark"])).toEqual({});
  });

  it("does not authorize a weapon technique without its canonical weapon", () => {
    const state = assassinationState();
    state.world.codex.characters.wanderer.worn = [];

    expect(narratorAssassinationCapabilities(state, ["mark"]).mark.methods)
      .not.toContain("execute");
  });

  it("does not authorize a Resolve-cost ability outside its settled resource economy", () => {
    const state = assassinationState();
    state.character.abilities = [{ id: "death-clutch", tier: "divine" }];
    state.character.resolve = 0;
    state.world.codex.characters.wanderer.abilities = [...state.character.abilities];

    expect(narratorAssassinationCapabilities(state, ["mark"]).mark.methods)
      .not.toContain("death-clutch");
  });

  it("fails closed when a target's canonical ability data is unknown", () => {
    const state = assassinationState();
    state.world.codex.characters.mark.abilities = ["unknown-defence"];

    expect(narratorAssassinationCapabilities(state, ["mark"])).toEqual({});
  });

  it("fails closed for a dead canonical player actor or coercible target statistics", () => {
    const deadActor = assassinationState();
    deadActor.character.deathDay = deadActor.time.day;
    expect(narratorAssassinationAttemptCapabilities(deadActor, ["mark"])).toEqual({});
    expect(narratorAssassinationCapabilities(deadActor, ["mark"])).toEqual({});

    const stringAttribute = assassinationState();
    stringAttribute.world.codex.characters.mark.attributes.body = "1";
    expect(narratorAssassinationAttemptCapabilities(stringAttribute, ["mark"])).toEqual({});
    expect(narratorAssassinationCapabilities(stringAttribute, ["mark"])).toEqual({});
  });

  it("fails closed for inherited, mismatched, or malformed canonical equipment", () => {
    const inheritedItem = assassinationState();
    inheritedItem.world.codex.characters.mark.worn = ["constructor"];
    expect(narratorAssassinationAttemptCapabilities(inheritedItem, ["mark"])).toEqual({});

    const malformedCombat = assassinationState();
    malformedCombat.world.codex.items["bad-mail"] = {
      id: "bad-mail",
      kind: "armor",
      passives: [],
      combat: { armor: "99" },
    };
    malformedCombat.world.codex.characters.mark.worn = ["bad-mail"];
    expect(narratorAssassinationCapabilities(malformedCombat, ["mark"])).toEqual({});

    const mismatchedIdentity = assassinationState();
    mismatchedIdentity.world.codex.items["bad-mail"] = {
      id: "another-item",
      kind: "armor",
      passives: [],
      combat: { armor: 4 },
    };
    mismatchedIdentity.world.codex.characters.mark.worn = ["bad-mail"];
    expect(narratorAssassinationCapabilities(mismatchedIdentity, ["mark"])).toEqual({});
  });

  it("never exposes a current party member as an assassination target", () => {
    const state = assassinationState();
    state.party = ["mark"];

    expect(narratorAssassinationAttemptCapabilities(state, ["mark"])).toEqual({});
    expect(narratorAssassinationCapabilities(state, ["mark"])).toEqual({});
  });


  it("does not expose assassination death through the raw mechanics reducer", () => {
    const state = assassinationState();

    const next = applyBeat(state, {
      story: [],
      assassination: {
        target_id: "mark", method: "execute", outcome: "killed", surprise: null,
      },
    });

    expect(next.world.codex.characters.mark).not.toHaveProperty("deathDay");
  });
});
