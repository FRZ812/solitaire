import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { applyBeat } from "./beat.js";
import { makeInitialState } from "../data/initial-state.js";
import { ALL_ITEMS } from "../data/catalog.js";
import { maxVitalityFor } from "./attributes.js";

// A fresh, post-creation state so the full applyBeat pipeline runs (the limbo
// state freezes the clock and the body-ledger).
const fresh = () => ({ ...makeInitialState(), created: true });
const totalMinutes = (t) => t.day * 1440 + t.hour * 60 + t.minute;

// Curated views for the golden snapshots — drop volatile ids and the bulky
// codex so the snapshot is the behaviorally-relevant output only.
const beatView = (beats) => beats.map(({ id, ...rest }) => rest);
const charView = (c) => ({
  vitality: c.vitality, vitalityMax: c.vitalityMax, resolve: c.resolve, resolveMax: c.resolveMax,
  attributes: c.attributes, needs: c.needs, conditions: c.conditions, overburdened: c.overburdened,
  coins: c.inventory.coins, carried: c.inventory.carried,
});

describe("applyBeat — time & feed", () => {
  it("advances the clock by minutes_passed", () => {
    const base = fresh();
    const next = applyBeat(base, { minutes_passed: 90 });
    expect(totalMinutes(next.time) - totalMinutes(base.time)).toBe(90);
  });

  it("appends a narration beat carrying the content", () => {
    const next = applyBeat(fresh(), { narration: "The wind howls down the pass." });
    expect(next.beats.some((b) => b.type === "narration" && b.content === "The wind howls down the pass.")).toBe(true);
  });

  it("appends story beats and dialogue in their authored chronological order", () => {
    const base = fresh();
    const next = applyBeat(base, { story: [
      { type: "beat", text: "The keeper reaches beneath the counter." },
      { type: "dialogue", name: "Keeper", line: "Two bedrolls." },
      { type: "beat", text: "He binds the bundle with a square knot." },
    ] });
    const visible = next.beats.slice(base.beats.length).filter((b) => b.type === "narration" || b.type === "dialogue");

    expect(visible.map((b) => b.type)).toEqual(["narration", "dialogue", "narration"]);
    expect(visible.map((b) => b.content || b.line)).toEqual([
      "The keeper reaches beneath the counter.",
      "Two bedrolls.",
      "He binds the bundle with a square knot.",
    ]);
  });

  it("treats the input state as immutable", () => {
    const base = fresh();
    const beatsLen = base.beats.length;
    const vigor = base.character.attributes.vigor;
    applyBeat(base, { narration: "x", minutes_passed: 60, attribute_changes: { vigor: 2 } });
    expect(base.beats.length).toBe(beatsLen);
    expect(base.character.attributes.vigor).toBe(vigor);
  });
});

describe("applyBeat — attributes & vitals", () => {
  it("applies attribute_changes and keeps vitalityMax in sync", () => {
    const base = fresh();
    const next = applyBeat(base, { attribute_changes: { vigor: 2 } });
    expect(next.character.attributes.vigor).toBe(base.character.attributes.vigor + 2);
    expect(next.character.vitalityMax).toBe(maxVitalityFor(next.character));
  });

  it("clamps vitality_change into [0, vitalityMax]", () => {
    const base = fresh();
    expect(applyBeat(base, { vitality_change: 9999 }).character.vitality).toBe(base.character.vitalityMax);
    expect(applyBeat(base, { vitality_change: -9999 }).character.vitality).toBe(0);
  });
});

describe("applyBeat — inventory catalog gate", () => {
  it("drops invented (non-catalog) items but keeps catalog ones", () => {
    const validId = Object.keys(ALL_ITEMS)[0];
    const next = applyBeat(fresh(), {
      inventory_changes: { added: [
        { itemId: "totally-invented-xyz", quantity: 1 },
        { itemId: validId, quantity: 1 },
      ] },
    });
    const ids = next.character.inventory.carried.map((c) => c.itemId);
    expect(ids).not.toContain("totally-invented-xyz");
    expect(ids).toContain(validId);
  });
});

describe("applyBeat — needs depletion", () => {
  it("depletes needs as the clock turns (no food in the empty starting pack)", () => {
    const base = fresh();
    const next = applyBeat(base, { minutes_passed: 600 });
    expect(next.character.needs.hunger).toBeLessThan(base.character.needs.hunger);
  });
});

describe("applyBeat — authored character presentation", () => {
  it("persists class, subclass, portrait key, character hooks, and authored mastery", () => {
    const profile = {
      voice: "Quiet and exact.",
      complication: "An oath is coming due.",
      signature: "Counts every doorway.",
    };
    const next = applyBeat(fresh(), {
      character_setup: {
        name: "Bram", race: "human", profession: "assassin", subclass: "shadowblade",
        templateId: "shadowblade", portraitKey: "template:shadowblade", profile,
        proficiencies: { spellcasting: 1350, invented: 99 },
      },
    });
    const wanderer = next.world.codex.characters.wanderer;
    expect(next.character).toMatchObject({
      profession: "assassin", subclass: "shadowblade", templateId: "shadowblade", portraitKey: "template:shadowblade", profile,
      proficiencies: { spellcasting: 1350 },
    });
    expect(next.character.proficiencies).not.toHaveProperty("invented");
    expect(wanderer).toMatchObject({
      profession: "assassin", subclass: "shadowblade", templateId: "shadowblade", portraitKey: "template:shadowblade", profile,
    });
  });
});

describe("applyBeat — narrator party removal", () => {
  it("marks a narratively killed companion dead and removes them from the party", () => {
    const recruited = applyBeat(fresh(), { recruit_companion: { id: "bram" } });
    const next = applyBeat(recruited, {
      story: [{ type: "beat", text: "The falling gate takes Bram beneath it." }],
      party_removals: [{ id: "bram", reason: "dead" }],
    });

    expect(next.party).not.toContain("bram");
    expect(next.world.codex.characters.bram.combatState).toMatchObject({
      health: 0,
      status: "dead",
    });
    expect(recruited.party).toContain("bram");
    expect(recruited.world.codex.characters.bram.combatState).toBeUndefined();
  });

  it("ignores narrator removals for characters outside the current party", () => {
    const base = fresh();
    const next = applyBeat(base, {
      party_removals: [{ id: "demon-king", reason: "dead" }],
    });

    expect(next.party).toEqual(base.party);
    expect(next.world.codex.characters["demon-king"].combatState).toBeUndefined();
  });
});

// GOLDEN characterization — full curated output of representative beats, captured
// as inline snapshots. These exist to make the Stage-3 applyBeat decomposition
// provably behavior-preserving: the snapshots must stay byte-identical across the
// refactor. Date.now is pinned so any id-bearing field is stable (ids are also
// stripped by beatView). Beats here avoid Math.random paths (no mount-name gen).
describe("applyBeat — golden snapshots (refactor safety net)", () => {
  beforeEach(() => vi.spyOn(Date, "now").mockReturnValue(1_000_000));
  afterEach(() => vi.restoreAllMocks());

  it("golden — a rich survival/inventory/attribute/vitals beat", () => {
    const validId = Object.keys(ALL_ITEMS)[0];
    const next = applyBeat(fresh(), {
      minutes_passed: 60,
      narration: "You press on through the pass.",
      attribute_changes: { vigor: 1 },
      inventory_changes: { added: [{ itemId: validId, quantity: 2 }], coins: { silver: 3 } },
      vitality_change: 5,
      resolve_change: -2,
      needs_changes: { hunger: 10 },
    });
    expect({
      time: next.time, party: next.party, created: next.created,
      character: charView(next.character), beats: beatView(next.beats),
    }).toMatchSnapshot();
  });

  it("golden — recruiting a companion files them into the party + codex", () => {
    const next = applyBeat(fresh(), { recruit_companion: { id: "bram" } });
    const bram = next.world.codex.characters.bram;
    expect({
      party: next.party,
      bram: bram && { id: bram.id, name: bram.name, kind: bram.kind, hasAttributes: !!bram.attributes, hasAbilities: Array.isArray(bram.abilities) },
      recruitBeats: next.beats.filter((b) => b.type === "recruit").map((b) => b.text),
    }).toMatchSnapshot();
  });

  it("golden — character_setup sets identity, attributes, abilities, derived pools", () => {
    const next = applyBeat(fresh(), {
      character_setup: {
        name: "Aldric", bond: "Find the lost heir.", race: "human",
        attributes: { body: 6, reflex: 5, vigor: 7, mind: 4, wit: 5, presence: 3 },
        abilities: ["power-strike"],
      },
    });
    const w = next.world.codex.characters.wanderer;
    expect({
      created: next.created,
      name: next.character.name, bond: next.character.bond, race: next.character.race,
      attributes: next.character.attributes, abilities: next.character.abilities,
      vitalityMax: next.character.vitalityMax, resolveMax: next.character.resolveMax,
      carryCapacityMax: next.character.carryCapacityMax,
      wandererCodex: { name: w.name, race: w.race, attributes: w.attributes },
    }).toMatchSnapshot();
  });

  it("golden — location_update stamps the tile and _userMsg/_raw extend apiHistory", () => {
    const base = fresh();
    const tileKey = `${base.world.currentTile.x},${base.world.currentTile.y}`;
    const next = applyBeat(base, {
      minutes_passed: 30,
      location_update: { state: "razed", note: "You put the camp to the torch." },
      _userMsg: "I burn the camp.",
      _raw: "{\"narration\":\"It burns.\"}",
    });
    expect({
      tileStatus: next.world.tiles[tileKey]?.status,
      apiHistory: next.apiHistory,
    }).toMatchSnapshot();
  });

  it("golden — recruit + relationship/memory updates fold onto the codex character", () => {
    const next = applyBeat(fresh(), {
      recruit_companion: { id: "bram" },
      relationship_changes: [{ id: "bram", delta: 5 }],
      memory_updates: [{ id: "bram", adds: ["Saved my life at the ford."] }],
    });
    const bram = next.world.codex.characters.bram;
    expect({
      party: next.party,
      relationship: bram?.relationship,
      memories: bram?.memories,
    }).toMatchSnapshot();
  });
});
