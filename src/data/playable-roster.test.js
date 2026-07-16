import { describe, expect, it } from "vitest";
import { applyBeat } from "../engine/beat.js";
import { buildStateContext } from "../engine/api.js";
import {
  playableCharactersNear,
  toggleTrackedCharacter,
  trackedCharacterResult,
} from "../engine/positions.js";
import { LANDMARKS } from "./continent.js";
import { makeInitialState, migrateCodex } from "./initial-state.js";
import {
  PLAYABLE_CHARACTER_PLACEMENTS,
  playableCharacterId,
} from "./playable-roster.js";
import { CHARACTER_TEMPLATES } from "./templates.js";

const playableEntries = (state) => Object.values(state.world.codex.characters)
  .filter((character) => character.playable);

describe("playable characters in the campaign world", () => {
  it("files every ready-made character into the fresh Codex at a unique authored landmark", () => {
    const state = makeInitialState();
    const entries = playableEntries(state);
    const landmarks = new Map(LANDMARKS.map((landmark) => [landmark.id, landmark]));

    expect(entries).toHaveLength(CHARACTER_TEMPLATES.length);
    expect(new Set(entries.map((entry) => entry.templateId))).toEqual(
      new Set(CHARACTER_TEMPLATES.map((template) => template.id)),
    );
    expect(new Set(entries.map((entry) => `${entry.at.x},${entry.at.y}`)).size).toBe(entries.length);

    const realms = new Set();
    for (const entry of entries) {
      const landmark = landmarks.get(PLAYABLE_CHARACTER_PLACEMENTS[entry.templateId]);
      expect(landmark, `${entry.templateId} landmark`).toBeTruthy();
      expect(entry).toMatchObject({
        id: playableCharacterId(entry.templateId),
        kind: "npc",
        playable: true,
        trackable: true,
        homeName: landmark.name,
        home: landmark.coord,
        at: { ...landmark.coord, day: state.time.day },
      });
      realms.add(landmark.realmId);
    }
    expect(realms).toEqual(new Set(["central", "north", "east", "south", "west"]));
  });

  it("removes the selected template's NPC copy when creation resolves", () => {
    const base = makeInitialState();
    const selectedId = playableCharacterId("ranger");
    expect(base.world.codex.characters[selectedId]?.name).toBe("Faelar Sylvareth");

    const next = applyBeat(base, {
      character_setup: {
        name: "Faelar Sylvareth",
        race: "elf",
        profession: "ranger",
        templateId: "ranger",
        portraitKey: "template:ranger",
      },
    });

    expect(next.world.codex.characters[selectedId]).toBeUndefined();
    expect(next.world.codex.characters.wanderer).toMatchObject({
      kind: "player",
      name: "Faelar Sylvareth",
      templateId: "ranger",
    });
    expect(playableEntries(next)).toHaveLength(CHARACTER_TEMPLATES.length - 1);
    expect(base.world.codex.characters[selectedId]).toBeTruthy();
  });

  it("deduplicates an older template campaign during migration", () => {
    const oldSave = makeInitialState();
    oldSave.character.templateId = "shadowblade";
    oldSave.world.codex.characters.wanderer.templateId = "shadowblade";
    oldSave.world.trackedCharacterId = playableCharacterId("shadowblade");

    const migrated = migrateCodex(oldSave);

    expect(migrated.world.codex.characters[playableCharacterId("shadowblade")]).toBeUndefined();
    expect(migrated.world.trackedCharacterId).toBeNull();
    expect(oldSave.world.codex.characters[playableCharacterId("shadowblade")]).toBeTruthy();
  });

  it("toggles an approximate atlas trail and surfaces the character on arrival", () => {
    const base = makeInitialState();
    const id = playableCharacterId("court-envoy");
    const tracked = toggleTrackedCharacter(base, id);
    const result = trackedCharacterResult(tracked);

    expect(result).toMatchObject({ id, name: "Nadira Sahir" });
    expect(result.pos).toMatchObject({
      x: tracked.world.codex.characters[id].at.x,
      y: tracked.world.codex.characters[id].at.y,
    });
    expect(toggleTrackedCharacter(tracked, id).world.trackedCharacterId).toBeNull();

    const arrived = {
      ...tracked,
      world: { ...tracked.world, currentTile: { x: result.pos.x, y: result.pos.y } },
    };
    expect(playableCharactersNear(arrived).map(({ character }) => character.id)).toContain(id);
    expect(buildStateContext(arrived)).toContain("[OTHER ROSTER CHARACTERS HERE — Nadira Sahir");
  });
});
