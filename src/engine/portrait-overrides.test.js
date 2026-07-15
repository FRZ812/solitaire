import { describe, expect, it } from "vitest";
import { recordTurn, stateBeforeTurn } from "./timeline.js";
import {
  migratePortraitOverrides,
  portraitOverrideFor,
  withPortraitOverride,
} from "./portrait-overrides.js";

const image = "data:image/webp;base64,QUJDRA==";

function timelineState() {
  return {
    character: { name: "Wanderer" },
    portraitOverrides: { "demon-king": image },
    time: { day: 1, hour: 8, minute: 0 },
    world: { codex: { characters: {} }, seen: {}, tiles: {}, currentTile: { x: 0, y: 0 } },
    beats: [],
    apiHistory: [],
    turns: [],
  };
}

describe("save-level portrait overrides", () => {
  it("adds, replaces, and removes an override without editing character fiction", () => {
    const state = timelineState();
    const added = withPortraitOverride(state, "wanderer", image);
    expect(portraitOverrideFor(added, "wanderer")).toBe(image);
    expect(added.character).toBe(state.character);
    const reset = withPortraitOverride(added, "wanderer", null);
    expect(portraitOverrideFor(reset, "wanderer")).toBeNull();
    expect(portraitOverrideFor(reset, "demon-king")).toBe(image);
  });

  it("keeps one image copy outside checkpoints and preserves it across rewind", () => {
    const base = timelineState();
    const next = { ...base, beats: [{ id: "n1", type: "narration", content: "The road opens." }] };
    const recorded = recordTurn(base, "Walk", next);
    expect(JSON.stringify(recorded).split(image)).toHaveLength(2);
    expect(recorded.turns[0].char).not.toHaveProperty("portrait");

    const replacement = `${image}new`;
    const rewound = stateBeforeTurn({ ...recorded, portraitOverrides: { "demon-king": replacement } }, 0);
    expect(portraitOverrideFor(rewound, "demon-king")).toBe(replacement);
  });

  it("migrates current legacy portraits and scrubs historical duplicates", () => {
    const state = timelineState();
    state.character.portrait = image;
    state.world.codex.characters = {
      wanderer: { id: "wanderer", portrait: "data:image/webp;base64,OLD" },
      ally: { id: "ally", portrait: "data:image/webp;base64,ALLY" },
    };
    state.turns = [{ char: { portrait: "data:image/webp;base64,HISTORY" } }];
    state.pools = { codex: [{ characters: { ally: { portrait: "data:image/webp;base64,POOL" } } }], seen: [], tiles: [] };

    migratePortraitOverrides(state);

    expect(state.portraitOverrides.wanderer).toBe(image);
    expect(state.portraitOverrides.ally).toBe("data:image/webp;base64,ALLY");
    expect(state.character).not.toHaveProperty("portrait");
    expect(state.world.codex.characters.wanderer).not.toHaveProperty("portrait");
    expect(state.turns[0].char).not.toHaveProperty("portrait");
    expect(state.pools.codex[0].characters.ally).not.toHaveProperty("portrait");
  });
});
