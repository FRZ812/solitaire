import { describe, expect, it } from "vitest";
import { makeInitialState } from "../data/initial-state.js";
import { applyAcquisitions } from "./beat-acquisitions.js";
import { AUTHORED_MOUNT_LEVELS, progressionLevel } from "./progression.js";
import { maxResolveFor } from "./attributes.js";
import { MOUNTS, MOUNT_PROGRESSION_LEVEL_BY_TIER } from "../data/mounts.js";

function acquire(beat) {
  const state = makeInitialState();
  const newBeats = [];
  const result = applyAcquisitions({
    state,
    beat,
    world: state.world,
    party: [],
    character: state.character,
    newTime: state.time,
    newBeats,
  });
  return { ...result, newBeats };
}

function expectProgression(entry) {
  expect(entry.progression).toMatchObject({ version: 1 });
  expect(progressionLevel(entry)).toBeGreaterThan(0);
  expect(entry.progression.professionId).toBe(entry.profession);
  expect(entry.resolveMax).toBe(maxResolveFor(entry));
}

describe("party acquisition progression", () => {
  it("keeps every authored mount id aligned with its tier's progression level", () => {
    for (const mount of Object.values(MOUNTS)) {
      expect(AUTHORED_MOUNT_LEVELS[mount.id], mount.id).toBe(MOUNT_PROGRESSION_LEVEL_BY_TIER[mount.tier]);
    }
  });

  it("normalizes an authored companion into the shared stack", () => {
    const { world, party } = acquire({ recruit_companion: { id: "senna" } });
    const senna = world.codex.characters.senna;

    expect(party).toContain("senna");
    expectProgression(senna);
    expect(senna).toMatchObject({ profession: "hunter" });
    expect(progressionLevel(senna)).toBe(22);
  });

  it("folds a captive's exact vocation into profession and archetype", () => {
    const { world, party } = acquire({ purchase_captive: { key: "harl", settlement: "gift" } });
    const id = party.find((entry) => entry.startsWith("bonded-harl-"));
    const harl = world.codex.characters[id];

    expectProgression(harl);
    expect(harl).toMatchObject({ profession: "soldier", archetype: "marsh-spearman" });
    expect(progressionLevel(harl)).toBe(15);
  });

  it("folds a prisoner's exact vocation into profession and archetype", () => {
    const { world, party } = acquire({ purchase_rights: { key: "loff", settlement: "gift" } });
    const id = party.find((entry) => entry.startsWith("bonded-loff-"));
    const loff = world.codex.characters[id];

    expectProgression(loff);
    expect(loff).toMatchObject({ profession: "artisan", archetype: "baker" });
    expect(progressionLevel(loff)).toBe(15);
  });

  it("files an earned divine mount as a racial level-100 Codex character", () => {
    const { world, party } = acquire({ grant_mount: { id: "dragon", name: "Ashwing" } });
    const dragon = world.codex.characters.dragon;

    expect(party).toContain("dragon");
    expectProgression(dragon);
    expect(dragon).toMatchObject({
      kind: "mount",
      profession: "dragon-ascendant",
      archetype: "dragon-mount",
    });
    expect(progressionLevel(dragon)).toBe(100);
    expect(dragon).not.toHaveProperty("level");
  });

  it("files a mundane stable mount in the ordinary level band", () => {
    const { world, party } = acquire({ buy_mount: { id: "horse", settlement: "gift", name: "Moss" } });
    const horse = world.codex.characters.horse;

    expect(party).toContain("horse");
    expectProgression(horse);
    expect(horse).toMatchObject({ kind: "mount", profession: "wanderer", archetype: "horse-mount" });
    expect(progressionLevel(horse)).toBe(10);
  });
});
