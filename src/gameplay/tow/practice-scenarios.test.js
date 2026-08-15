import { describe, expect, it } from "vitest";
import { compileCharacterBootstrap } from "./character-bootstrap.js";
import { dispatchTowCommand } from "./commands.js";
import {
  DEFAULT_PRACTICE_SCENARIO_ID,
  PRACTICE_SCENARIOS,
  createPracticeSession,
  derivePracticeSeed,
  draftHash,
  draftUnchanged,
  getPracticeScenario,
  nextPracticeAttempt,
  practiceResult,
} from "./practice-scenarios.js";
import { getStartingArchetype } from "./starting-archetypes.js";
import { startingPackageIds } from "./starting-packages.js";

// The six the plan names as the field-ready Quick Start cohort, by the profession each maps
// to. Every one has to complete practice without a blocked capability.
const FIELD_READY = Object.freeze([
  "fighter", "cleric", "ranger", "rogue", "wizard", "paladin",
]);

function receiptFor(professionId, origin = "quick-start") {
  const compiled = compileCharacterBootstrap({ professionId, origin });
  if (!compiled.ok) throw new Error(compiled.reason);
  return compiled.receipt;
}

function playOut(practice, rounds = 40) {
  let session = practice.session;
  for (let round = 0; round < rounds && session.encounter.phase === "player"; round += 1) {
    const target = session.encounter.enemyIds.find((id) => session.encounter.actors[id].hp > 0);
    const struck = dispatchTowCommand(session, {
      id: `strike-${round}`,
      expectedRevision: session.revision,
      type: "use-skill",
      actorId: session.encounter.playerId,
      skillId: "strike",
      targetId: target,
    });
    session = struck.ok ? struck.session : session;
    if (session.encounter.phase !== "player") break;
    session = dispatchTowCommand(session, {
      id: `end-${round}`,
      expectedRevision: session.revision,
      type: "end-turn",
      actorId: session.encounter.playerId,
    }).session;
  }
  return { ...practice, session };
}

describe("the seed is derived, never drawn", () => {
  it("gives the same draft, scenario and attempt the same fight", () => {
    const receipt = receiptFor("fighter");
    const first = createPracticeSession(receipt, "training-yard", 0);
    const second = createPracticeSession(receipt, "training-yard", 0);
    expect(second.seed).toBe(first.seed);
    expect(second.genesisChecksum).toBe(first.genesisChecksum);
    expect(second.session.encounter).toEqual(first.session.encounter);
  });

  it("gives a different attempt a different, still-recorded seed", () => {
    const receipt = receiptFor("fighter");
    const first = createPracticeSession(receipt, "training-yard", 0);
    const next = nextPracticeAttempt(first);
    expect(next).toEqual({ scenarioId: "training-yard", attemptIndex: 1 });
    const second = createPracticeSession(receipt, next.scenarioId, next.attemptIndex);
    expect(second.seed).not.toBe(first.seed);
    // Still derived: asking for that attempt again reproduces it exactly.
    expect(createPracticeSession(receipt, "training-yard", 1).seed).toBe(second.seed);
  });

  it("gives two different drafts different fights", () => {
    expect(createPracticeSession(receiptFor("fighter"), "training-yard", 0).seed)
      .not.toBe(createPracticeSession(receiptFor("wizard"), "training-yard", 0).seed);
  });

  it("names every input that could change the fight", () => {
    const base = {
      packageId: "fighter", scenarioId: "training-yard", draftHash: "abc", attemptIndex: 0,
    };
    const seed = derivePracticeSeed(base);
    expect(derivePracticeSeed({ ...base, packageId: "wizard" })).not.toBe(seed);
    expect(derivePracticeSeed({ ...base, scenarioId: "the-duellist" })).not.toBe(seed);
    expect(derivePracticeSeed({ ...base, scenarioVersion: 3 })).not.toBe(seed);
    expect(derivePracticeSeed({ ...base, draftHash: "def" })).not.toBe(seed);
    expect(derivePracticeSeed({ ...base, attemptIndex: 1 })).not.toBe(seed);
  });

  it("refuses an attempt index it cannot record", () => {
    const base = { packageId: "f", scenarioId: "s", draftHash: "h" };
    expect(derivePracticeSeed({ ...base, attemptIndex: -1 })).toBe(null);
    expect(derivePracticeSeed({ ...base, attemptIndex: 1.5 })).toBe(null);
    expect(derivePracticeSeed({ packageId: "f", scenarioId: "s" })).toBe(null);
  });
});

describe("opening a practice fight", () => {
  it("runs on the production session, marked as practice", () => {
    const practice = createPracticeSession(receiptFor("fighter"));
    expect(practice.ok).toBe(true);
    expect(practice.session.mode).toBe("practice");
    expect(practice.session.rulesetId).toBe("solitaire-tow-v1");
    // The real reducer means the real telegraph, so practice teaches the actual fight.
    expect(practice.session.encounter.intents).not.toEqual({});
  });

  it("stakes nothing, because it can write nothing", () => {
    const practice = createPracticeSession(receiptFor("fighter"));
    expect(practice.session.context.playerStakes).toBe("survivable");
    expect(practice.session.context.lethalPolicy).toBe("nonlethal");
    // Nothing campaign-shaped ever reaches it: the session it returns has no binding to a
    // codex entity, no loot sources, and no reward policy to commit.
    expect(practice.session.context.participantBindings).toEqual({});
    expect(practice.session.context.lootPolicy.sources).toEqual({});
    expect(practice.session.context.rewardPolicy.proficiencyId).toBe(null);
  });

  it("starts from the compiled build's own loadout", () => {
    const receipt = receiptFor("cleric");
    const practice = createPracticeSession(receipt);
    expect(practice.session.encounter.build.skills.map((entry) => entry.id))
      .toEqual(receipt.build.skills);
  });

  it("starts every selected ability at its chosen rarity and fingerprints the promotion", () => {
    const compiled = compileCharacterBootstrap({
      archetypeId: "last-assassin",
      origin: "archetype",
    });
    const receipt = compiled.receipt;
    const skillRarities = ["rare", "uncommon", "mythical", "mythical", "mythical"];
    const promoted = createPracticeSession(receipt, "training-yard", 0, { skillRarities });
    const again = createPracticeSession(receipt, "training-yard", 0, { skillRarities });
    const baseRarity = createPracticeSession(receipt, "training-yard", 0);

    expect(promoted.ok).toBe(true);
    expect(promoted.session.encounter.build.skills.map((entry) => entry.rank)).toEqual([3, 2, 2, 2, 4]);
    expect(promoted.seed).toBe(again.seed);
    expect(promoted.genesisChecksum).toBe(again.genesisChecksum);
    expect(promoted.seed).not.toBe(baseRarity.seed);
    expect(draftHash(receipt, skillRarities)).not.toBe(draftHash(receipt));

    expect(createPracticeSession(receipt, "training-yard", 0, {
      skillRarities: ["divine", "uncommon", "mythical", "mythical", "mythical"],
    })).toMatchObject({ ok: false, reason: "invalid-practice-skill-rarities" });
  });

  it("gives every foe a playable archetype, trait and complete five-ability loadout", () => {
    for (const scenario of PRACTICE_SCENARIOS) {
      const encounter = createPracticeSession(receiptFor("fighter"), scenario.id).session.encounter;
      for (const enemy of scenario.enemies) {
        const archetype = getStartingArchetype(enemy.archetypeId);
        expect(archetype).toBeTruthy();
        expect(encounter.enemyArchetypes[enemy.id]).toBe(archetype.id);
        expect(encounter.enemyBuilds[enemy.id].traits).toEqual(archetype.build.traits);
        expect(encounter.enemyBuilds[enemy.id].skills.map((entry) => entry.id))
          .toEqual(archetype.build.skills);
        expect(encounter.enemyAttacks[enemy.id].map((entry) => entry.skillId))
          .toEqual(archetype.build.skills);
        expect(encounter.enemyAttacks[enemy.id].map((entry) => entry.name))
          .not.toEqual(expect.arrayContaining(["Jab", "Swing", "Heavy blow"]));
      }
    }
  });

  it("lets the Duellist declare the Wandering Blade's authored kit", () => {
    const encounter = createPracticeSession(receiptFor("rogue"), "the-duellist").session.encounter;
    expect(encounter.enemyBuilds["foe-0"].skills.map((entry) => entry.id)).toEqual([
      "blade-slash",
      "blade-barrier",
      "blade-chi-liberation",
      "blade-one-flash",
      "blade-katana-dance",
    ]);
  });

  it("refuses a scenario or a receipt it does not recognise", () => {
    expect(createPracticeSession(receiptFor("fighter"), "nowhere"))
      .toMatchObject({ ok: false, reason: "unknown-practice-scenario" });
    expect(createPracticeSession({ nonsense: true }))
      .toMatchObject({ ok: false, reason: "invalid-bootstrap-receipt" });
  });

  it("offers a default scenario that exists", () => {
    expect(getPracticeScenario(DEFAULT_PRACTICE_SCENARIO_ID)).toBeTruthy();
    expect(PRACTICE_SCENARIOS.length).toBeGreaterThan(1);
  });
});

describe("every field-ready package can complete practice", () => {
  it("reaches a legal fight and finishes it, for all six", () => {
    for (const packageId of FIELD_READY) {
      expect(startingPackageIds()).toContain(packageId);
      const practice = createPracticeSession(receiptFor(packageId), "training-yard");
      expect(practice.ok, packageId).toBe(true);
      const result = practiceResult(playOut(practice));
      expect(result.outcome, packageId).not.toBe("unfinished");
      expect(result.replayVerified, packageId).toBe(true);
    }
  });

  it("reaches a legal fight in every scenario", () => {
    for (const scenario of PRACTICE_SCENARIOS) {
      const practice = createPracticeSession(receiptFor("fighter"), scenario.id);
      expect(practice.ok, scenario.id).toBe(true);
      expect(practice.session.encounter.enemyIds.length).toBe(scenario.enemies.length);
    }
  });
});

describe("the result screen has everything needed to reproduce it", () => {
  it("shows scenario version, seed, both checksums and the replay verdict", () => {
    const result = practiceResult(playOut(createPracticeSession(receiptFor("fighter"))));
    expect(result.scenarioVersion).toBe(2);
    expect(result.seed).toContain("practice::solitaire-tow-v1::fighter@1::training-yard@2");
    expect(result.genesisChecksum).toMatch(/^[0-9a-f]{16}$/);
    expect(result.terminalChecksum).toMatch(/^[0-9a-f]{16}$/);
    expect(result.replayVerified).toBe(true);
    expect(result.replayDivergence).toBe(null);
  });

  it("reproduces both checksums exactly on a retry of the same seed", () => {
    // "Retry same seed" is a promise, and this is the thing that makes it one.
    const receipt = receiptFor("ranger");
    const first = practiceResult(playOut(createPracticeSession(receipt, "roadside-ambush", 0)));
    const again = practiceResult(playOut(createPracticeSession(receipt, "roadside-ambush", 0)));
    expect(again.genesisChecksum).toBe(first.genesisChecksum);
    expect(again.terminalChecksum).toBe(first.terminalChecksum);
    expect(again.outcome).toBe(first.outcome);
  });

  it("carries the Chronicle, so a practice fight can be read like a real one", () => {
    const result = practiceResult(playOut(createPracticeSession(receiptFor("fighter"))));
    expect(result.chronicle.participants.length).toBeGreaterThan(1);
  });

  it("says nothing about a fight that never opened", () => {
    expect(practiceResult(null)).toBe(null);
    expect(practiceResult({ ok: false })).toBe(null);
  });
});

describe("the draft comes back untouched", () => {
  it("is byte-identical after entry, after a whole fight, and after the result", () => {
    // The claim practice lives or dies on: trying a build must not silently change it.
    const receipt = receiptFor("rogue");
    const before = JSON.stringify(receipt);
    const beforeHash = draftHash(receipt);

    const practice = createPracticeSession(receipt, "the-duellist");
    expect(JSON.stringify(receipt)).toBe(before);

    const finished = playOut(practice);
    expect(JSON.stringify(receipt)).toBe(before);

    practiceResult(finished);
    expect(JSON.stringify(receipt)).toBe(before);
    expect(draftUnchanged(beforeHash, draftHash(receipt))).toBe(true);
  });

  it("notices a draft that did change", () => {
    expect(draftUnchanged("abc", "def")).toBe(false);
    expect(draftUnchanged(null, null)).toBe(false);
  });

  it("hashes only what would change the fight", () => {
    // Two receipts compiled from the same request hash the same; a different package does
    // not. Origin is not mechanical, so it does not move the hash.
    expect(draftHash(receiptFor("fighter"))).toBe(draftHash(receiptFor("fighter")));
    expect(draftHash(receiptFor("fighter"))).not.toBe(draftHash(receiptFor("wizard")));
    expect(draftHash(receiptFor("fighter", "quick-start")))
      .toBe(draftHash(receiptFor("fighter", "practice")));
  });
});
