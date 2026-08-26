import { describe, expect, it } from "vitest";
import { makeInitialState, migrateCodex } from "../data/initial-state.js";
import { WANTED_POOL } from "../data/gaol.js";
import { acceptBounty } from "./gaol.js";
import { progressionLevel } from "./progression.js";

describe("acceptBounty", () => {
  it("files the named target as a stable portrait-aware Codex character", () => {
    const state = makeInitialState();
    const target = { ...WANTED_POOL[0], id: "bounty-4-redhand" };
    const result = acceptBounty(state, target);

    expect(result.ok).toBe(true);
    expect(result.state.world.quests.at(-1)).toMatchObject({
      targetKey: "redhand",
      targetCharacterId: "wanted-redhand",
    });
    expect(result.state.world.codex.characters["wanted-redhand"]).toMatchObject({
      id: "wanted-redhand",
      kind: "wanted",
      portraitKey: "wanted:redhand",
      name: "Red-Hand Mott",
      wanted: { status: "at-large" },
    });
    expect(progressionLevel(result.state.world.codex.characters["wanted-redhand"])).toBeGreaterThan(0);
  });

  it("keeps an existing target record when a later contract references the same person", () => {
    const state = makeInitialState();
    const target = { ...WANTED_POOL[0], id: "bounty-4-redhand" };
    const first = acceptBounty(state, target).state;
    first.world.codex.characters["wanted-redhand"] = {
      ...first.world.codex.characters["wanted-redhand"],
      memories: [{ text: "Previously encountered." }],
    };
    delete first.world.codex.characters["wanted-redhand"].portraitKey;
    const later = acceptBounty(first, { ...target, id: "bounty-5-redhand" });

    expect(later.ok).toBe(true);
    expect(later.state.world.codex.characters["wanted-redhand"].portraitKey).toBe("wanted:redhand");
    expect(later.state.world.codex.characters["wanted-redhand"].memories).toEqual([
      { text: "Previously encountered." },
    ]);
  });

  it("hydrates the Codex target for an active bounty from a pre-target save", () => {
    const state = makeInitialState();
    state.world.quests = [{
      id: "bounty-4-redhand",
      title: "Bounty: Red-Hand Mott",
      type: "bounty",
      target: "Red-Hand Mott",
      status: "active",
    }];

    const migrated = migrateCodex(state);

    expect(migrated.world.quests[0]).toMatchObject({
      targetKey: "redhand",
      targetCharacterId: "wanted-redhand",
    });
    expect(migrated.world.codex.characters["wanted-redhand"]).toMatchObject({
      id: "wanted-redhand",
      kind: "wanted",
      portraitKey: "wanted:redhand",
      name: "Red-Hand Mott",
    });
    expect(state.world.codex.characters["wanted-redhand"]).toBeUndefined();
  });

  it("backfills an existing active-bounty target without replacing its history", () => {
    const state = makeInitialState();
    state.world.quests = [{
      id: "bounty-4-redhand",
      type: "bounty",
      target: "Red-Hand Mott",
      status: "active",
    }];
    state.world.codex.characters["wanted-redhand"] = {
      id: "wanted-redhand",
      kind: "wanted",
      name: "Red-Hand Mott",
      memories: [{ text: "Spotted once at the west causeway." }],
    };

    const migrated = migrateCodex(state);

    expect(migrated.world.codex.characters["wanted-redhand"]).toMatchObject({
      portraitKey: "wanted:redhand",
      memories: [{ text: "Spotted once at the west causeway." }],
    });
  });
});
