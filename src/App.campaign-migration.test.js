import { describe, expect, it } from "vitest";
import { prepareCampaignState } from "./App.jsx";
import { makeInitialState } from "./data/initial-state.js";
import { prepareWarmCampaignState } from "./engine/campaign-resume.js";
import {
  rewindToPlayerBeat,
  startTurnCheckpoint,
  stateAfterTurn,
  stateBeforeTurn,
} from "./engine/timeline.js";

function staleTowProjection(source, overrides = {}) {
  return {
    ...source,
    progressionModel: "tow-archetype",
    combatArchetypeId: "arctic-knight",
    towBaseStats: { maxHp: 186, resolveMax: 8, attack: 18, defense: 16 },
    abilities: ["firebolt", "haste", "invented-cut"],
    level: 47,
    progression: source.progression,
    metamagicIds: ["quickened"],
    ...overrides,
  };
}

function staleTowCampaign() {
  const state = makeInitialState();
  state.created = true;
  delete state.mechanics;
  state.character = staleTowProjection(state.character);
  state.world.codex.characters.wanderer = staleTowProjection(
    state.world.codex.characters.wanderer,
  );
  state.turns = [{
    char: staleTowProjection(state.character),
    world: {
      codex: {
        characters: {
          wanderer: staleTowProjection(state.world.codex.characters.wanderer),
        },
      },
    },
  }];
  state.pools = {
    codex: [{
      characters: {
        wanderer: staleTowProjection(state.world.codex.characters.wanderer),
      },
    }],
  };
  return state;
}

function expectTowProjectionClean(character) {
  expect(character).toMatchObject({
    progressionModel: "tow-archetype",
    combatArchetypeId: "arctic-knight",
    towBaseStats: { maxHp: 186, resolveMax: 8, attack: 18, defense: 16 },
    abilities: ["haste"],
  });
  for (const retired of ["progression", "level", "metamagicIds"]) {
    expect(character).not.toHaveProperty(retired);
  }
}

describe("production campaign preparation", () => {
  it("upgrades a v12-era payload before hydration and removes retired Tower state everywhere", () => {
    const prepared = prepareCampaignState(staleTowCampaign());

    expect(prepared.mechanics).toMatchObject({ version: 1 });
    expectTowProjectionClean(prepared.character);
    expectTowProjectionClean(prepared.world.codex.characters.wanderer);
    expectTowProjectionClean(prepared.turns[0].char);
    expectTowProjectionClean(prepared.turns[0].world.codex.characters.wanderer);
    expectTowProjectionClean(prepared.pools.codex[0].characters.wanderer);
  });

  it("runs the same verified preparation for a warm resume snapshot", () => {
    const prepared = prepareWarmCampaignState(
      { state: staleTowCampaign() },
      prepareCampaignState,
    );

    expectTowProjectionClean(prepared.character);
    expectTowProjectionClean(prepared.world.codex.characters.wanderer);
  });

  it("keeps retired state dead through actual before, after, and player-beat rewinds", () => {
    const firstBase = staleTowCampaign();
    firstBase.turns = [];
    delete firstBase.pools;
    const firstPlayer = { id: "tow-rewind-1", type: "player", content: "Hold the line." };
    firstBase.beats = [...firstBase.beats, firstPlayer];
    const firstAfter = {
      ...firstBase,
      beats: [...firstBase.beats, { id: "tow-answer-1", type: "narration", content: "The line holds." }],
    };
    const first = startTurnCheckpoint(firstBase, "first", firstAfter);
    const secondPlayer = { id: "tow-rewind-2", type: "player", content: "Advance." };
    const secondBase = { ...first, beats: [...first.beats, secondPlayer] };
    const completed = startTurnCheckpoint(secondBase, "second", {
      ...secondBase,
      beats: [...secondBase.beats, { id: "tow-answer-2", type: "narration", content: "You advance." }],
    });
    const prepared = prepareCampaignState(completed);

    for (const restored of [
      stateBeforeTurn(prepared, 1),
      stateAfterTurn(prepared, 0),
      rewindToPlayerBeat(
        prepared,
        prepared.beats.findIndex((beat) => beat.id === firstPlayer.id),
      ),
    ]) {
      expectTowProjectionClean(restored.character);
      expectTowProjectionClean(restored.world.codex.characters.wanderer);
    }
  });

  it("is idempotent and fails closed for a malformed payload", () => {
    const once = prepareCampaignState(staleTowCampaign());
    expect(prepareCampaignState(once)).toEqual(once);
    expect(() => prepareCampaignState("not-a-campaign")).toThrowError(
      expect.objectContaining({ code: "CAMPAIGN_MIGRATION_FAILED" }),
    );
  });
});
