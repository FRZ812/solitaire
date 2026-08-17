import { describe, expect, it } from "vitest";
import { compileCharacterBootstrap } from "./character-bootstrap.js";
import { dispatchTowCommand, dispatchTowPlayerAction } from "./commands.js";
import {
  DEFAULT_PRACTICE_ALLY_GROUP_ID,
  DEFAULT_PRACTICE_SCENARIO_ID,
  PRACTICE_ALLY_GROUPS,
  PRACTICE_SCENARIOS,
  createPracticeSession,
  derivePracticeSeed,
  draftHash,
  draftUnchanged,
  getPracticeAllyGroup,
  getPracticeScenario,
  nextPracticeAttempt,
  practiceResult,
} from "./practice-scenarios.js";
import { verifyTowSession } from "./replay.js";
import { getStartingArchetype } from "./starting-archetypes.js";
import { startingPackageIds } from "./starting-packages.js";
import { getSkill, skillLegality } from "./skills.js";
import { effectiveTowBuild, towItemActorBonuses } from "./start-items.js";

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
    expect(next).toEqual({
      scenarioId: "training-yard",
      allyGroupId: "solo",
      attemptIndex: 1,
    });
    const second = createPracticeSession(receipt, next.scenarioId, next.attemptIndex, {
      allyGroupId: next.allyGroupId,
    });
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
    expect(derivePracticeSeed({ ...base, scenarioVersion: 4 })).not.toBe(seed);
    expect(derivePracticeSeed({ ...base, allyGroupId: "field-pair" })).not.toBe(seed);
    expect(derivePracticeSeed({ ...base, allyGroupVersion: 3 })).not.toBe(seed);
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

describe("authored practice formations", () => {
  it("offers versioned solo, pair, and trio groups with stable canonical allies", () => {
    expect(PRACTICE_ALLY_GROUPS.map((group) => group.id)).toEqual([
      "solo",
      "field-pair",
      "expedition-trio",
    ]);
    expect(DEFAULT_PRACTICE_ALLY_GROUP_ID).toBe("solo");
    expect(getPracticeAllyGroup(DEFAULT_PRACTICE_ALLY_GROUP_ID)?.allies).toHaveLength(0);
    expect(PRACTICE_ALLY_GROUPS.every((group) => (
      group.version === 2 && group.formation.length === 9
    ))).toBe(true);

    const pair = getPracticeAllyGroup("field-pair");
    expect(pair.allies).toEqual([
      expect.objectContaining({
        id: "practice-ally-paladin",
        name: "Paladin",
        archetypeId: "paladin",
        build: expect.any(Object),
      }),
    ]);
    const trio = getPracticeAllyGroup("expedition-trio");
    expect(trio.allies.map((ally) => ally.id)).toEqual([
      "practice-ally-paladin",
      "practice-ally-ranger",
    ]);
    expect(new Set(trio.formation.filter(Boolean))).toEqual(new Set([
      "wanderer",
      "practice-ally-paladin",
      "practice-ally-ranger",
    ]));
    expect(trio.formation).toEqual([
      null, "practice-ally-paladin", null,
      "wanderer", null, null,
      null, null, "practice-ally-ranger",
    ]);
  });

  it("opens each group with independent archetype stats, builds, and its exact formation", () => {
    const receipt = receiptFor("wizard");
    for (const group of PRACTICE_ALLY_GROUPS) {
      const practice = createPracticeSession(receipt, "training-yard", 0, {
        allyGroupId: group.id,
      });
      expect(practice.ok, group.id).toBe(true);
      expect(practice.allyGroup).toBe(group);
      expect(practice.session.encounter.allyIds).toHaveLength(group.allies.length);
      expect(practice.session.encounter.formations.player).toEqual(group.formation);
      expect(practice.session.genesis.formations.player).toEqual(group.formation);

      for (const ally of group.allies) {
        const archetype = getStartingArchetype(ally.archetypeId);
        const bonus = towItemActorBonuses(archetype.gear);
        const equippedBuild = effectiveTowBuild(archetype.build, archetype.gear);
        const actor = practice.session.encounter.actors[ally.id];
        expect(actor).toMatchObject({
          name: archetype.name,
          maxHp: archetype.baseStats.maxHp + bonus.maxHp,
          resolve: archetype.baseStats.resolveMax,
          resolveMax: archetype.baseStats.resolveMax,
          stats: {
            attack: archetype.baseStats.attack + bonus.attack,
            defense: archetype.baseStats.defense + bonus.defense,
            critRate: Math.min(100, archetype.baseStats.critRate + bonus.critRate),
            dodgeRate: Math.min(100, archetype.baseStats.dodgeRate + bonus.dodgeRate),
          },
        });
        expect(practice.session.encounter.allyBuilds[ally.id].traits)
          .toEqual(equippedBuild.traits);
        expect(practice.session.encounter.allyBuilds[ally.id].skills.map((entry) => entry.id))
          .toEqual(equippedBuild.skills);
        expect(practice.session.encounter.allyBuilds[ally.id].basicAttack)
          .toEqual(equippedBuild.basicAttack);
        expect(practice.session.genesis.allySnapshots
          .find((snapshot) => snapshot.id === ally.id)?.build.basicAttack)
          .toEqual(equippedBuild.basicAttack);
        expect(practice.session.encounter.allyBuilds[ally.id].skills.map((entry) => entry.id))
          .not.toEqual(receipt.build.skills);
      }
      expect(verifyTowSession(practice.session)).toMatchObject({ ok: true });
    }
  });

  it("makes the ally group a stable seed and session identity without changing draftHash", () => {
    const receipt = receiptFor("fighter");
    const beforeHash = draftHash(receipt);
    const pair = createPracticeSession(receipt, "training-yard", 0, {
      allyGroupId: "field-pair",
    });
    const pairAgain = createPracticeSession(receipt, "training-yard", 0, {
      allyGroupId: "field-pair",
    });
    const trio = createPracticeSession(receipt, "training-yard", 0, {
      allyGroupId: "expedition-trio",
    });

    expect(pair.seed).toBe(pairAgain.seed);
    expect(pair.session.sessionId).toBe(pairAgain.session.sessionId);
    expect(pair.genesisChecksum).toBe(pairAgain.genesisChecksum);
    expect(trio.seed).not.toBe(pair.seed);
    expect(trio.session.sessionId).not.toBe(pair.session.sessionId);
    expect(trio.genesisChecksum).not.toBe(pair.genesisChecksum);
    expect(pair.seed).toContain("field-pair@2");
    expect(draftHash(receipt)).toBe(beforeHash);
  });

  it("rejects an unknown ally group before opening a session", () => {
    expect(createPracticeSession(receiptFor("fighter"), "training-yard", 0, {
      allyGroupId: "unknown-company",
    })).toMatchObject({ ok: false, reason: "unknown-practice-ally-group" });
    expect(getPracticeAllyGroup("unknown-company")).toBe(null);
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
    expect(promoted.session.encounter.build.skills.every((entry) => (
      skillLegality(entry, { turnAvailable: true, resolveAvailable: 99 }).ok
    ))).toBe(true);
    expect(promoted.session.encounter.build.skills.every((entry) => (
      Number.isInteger(entry.cooldownRemaining) && entry.cooldownRemaining === 0
    ))).toBe(true);
    expect(promoted.seed).toBe(again.seed);
    expect(promoted.genesisChecksum).toBe(again.genesisChecksum);
    expect(promoted.seed).not.toBe(baseRarity.seed);
    expect(draftHash(receipt, skillRarities)).not.toBe(draftHash(receipt));

    expect(createPracticeSession(receipt, "training-yard", 0, {
      skillRarities: ["divine", "uncommon", "mythical", "mythical", "mythical"],
    })).toMatchObject({ ok: false, reason: "invalid-practice-skill-rarities" });
  });

  it("starts a promoted General ability at Mythical in the production encounter", () => {
    const archetype = getStartingArchetype("last-assassin");
    const skillIds = [...archetype.build.skills];
    skillIds[2] = "penetration";
    const compiled = compileCharacterBootstrap({
      archetypeId: archetype.id,
      origin: "practice",
      build: { ...archetype.build, skills: skillIds },
    });
    expect(compiled.ok).toBe(true);

    const skillRarities = skillIds.map((id) => getSkill(id).rarity);
    skillRarities[2] = "mythical";
    const promoted = createPracticeSession(compiled.receipt, "training-yard", 0, {
      skillRarities,
    });

    expect(promoted.ok).toBe(true);
    expect(promoted.session.encounter.build.skills[2]).toMatchObject({
      id: "penetration",
      rank: 5,
      usesRemaining: null,
    });
    expect(promoted.seed).not.toBe(
      createPracticeSession(compiled.receipt, "training-yard", 0).seed,
    );
  });

  it("snapshots the selected keepsake without sharing it with campaign state", () => {
    const receipt = receiptFor("fighter");
    const practice = createPracticeSession(receipt, "training-yard", 0, {
      combatItemId: "fire-pot",
    });
    expect(practice.ok).toBe(true);
    expect(practice.session.encounter.build.combatItems).toEqual([
      { id: "fire-pot", quantity: 1 },
    ]);
    expect(practice.seed).not.toBe(createPracticeSession(receipt, "training-yard", 0).seed);
    expect(createPracticeSession(receipt, "training-yard", 0, { combatItemId: "bedroll" }))
      .toMatchObject({ ok: false, reason: "invalid-practice-keepsake" });
  });

  it("applies a permanent keepsake to practice without creating a consumable", () => {
    const receipt = receiptFor("fighter");
    const base = createPracticeSession(receipt, "training-yard", 0);
    const withRelic = createPracticeSession(receipt, "training-yard", 0, {
      keepsakeId: "red-wolf-token",
    });

    expect(withRelic.ok).toBe(true);
    expect(withRelic.session.encounter.actors.wanderer.stats.attack)
      .toBe(base.session.encounter.actors.wanderer.stats.attack + 3);
    expect(withRelic.session.encounter.actors.wanderer.stats.critRate)
      .toBe(base.session.encounter.actors.wanderer.stats.critRate + 3);
    expect(withRelic.session.encounter.build.combatItems).toEqual([]);
    expect(withRelic.seed).not.toBe(base.seed);
  });

  it("gives every foe a playable archetype, trait and complete five-ability loadout", () => {
    for (const scenario of PRACTICE_SCENARIOS) {
      const encounter = createPracticeSession(receiptFor("fighter"), scenario.id).session.encounter;
      expect(encounter.formations.enemy).toEqual(scenario.formation);
      for (const enemy of scenario.enemies) {
        const archetype = getStartingArchetype(enemy.archetypeId);
        expect(archetype).toBeTruthy();
        expect(encounter.enemyArchetypes[enemy.id]).toBe(archetype.id);
        expect(encounter.enemyBuilds[enemy.id].traits).toEqual(archetype.build.traits);
        expect(encounter.enemyBuilds[enemy.id].skills.map((entry) => entry.id))
          .toEqual(archetype.build.skills);
        expect(encounter.actors[enemy.id].stats).toEqual(enemy.stats);
        expect(encounter.enemyBuilds[enemy.id].basicAttack).toBeUndefined();
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

  it("opens a three-enemy generalized formation drill on authored cells", () => {
    const scenario = getPracticeScenario("formation-drill");
    expect(scenario.enemies).toHaveLength(3);
    expect(scenario.enemies.map((enemy) => enemy.archetypeId)).toEqual([
      "knight",
      "ranger",
      "wizard",
    ]);
    const practice = createPracticeSession(receiptFor("fighter"), scenario.id, 0, {
      allyGroupId: "expedition-trio",
    });
    expect(practice.ok).toBe(true);
    expect(practice.session.encounter.enemyIds).toHaveLength(3);
    expect(practice.session.encounter.formations.enemy).toEqual(scenario.formation);
    expect(practice.session.encounter.formations.player)
      .toEqual(getPracticeAllyGroup("expedition-trio").formation);
    expect(verifyTowSession(practice.session)).toMatchObject({ ok: true });
  });

  it("auto-resolves a three-on-three hostile Priority window without spatial intent drift", () => {
    const practice = createPracticeSession(receiptFor("fighter"), "formation-drill", 0, {
      allyGroupId: "expedition-trio",
    });
    let session = practice.session;

    // The Knight initially draws the protagonist, who stands behind the Paladin. Its melee
    // telegraph must name the reachable front rank before that promise reaches the UI.
    expect(session.encounter.intents["foe-0"]).toMatchObject({
      attackId: "arctic-strike",
      targetId: "practice-ally-paladin",
    });

    const party = [session.encounter.playerId, ...session.encounter.allyIds];
    let final = null;
    for (const [index, actorId] of party.entries()) {
      const result = dispatchTowPlayerAction(session, {
        id: `priority-window-${actorId}`,
        expectedRevision: session.revision,
        type: "stand-down",
        actorId,
        anchorCell: null,
        itemId: null,
        skillId: null,
        targetId: null,
      });
      expect(result.ok, `${actorId}:${result.reason}`).toBe(true);
      expect(result.reason).toBe(null);
      expect(result.autoAdvanced).toBe(index === party.length - 1);
      session = result.session;
      final = result;
    }

    // Ranger's combat-start Priority grants one action before its ordinary action. Both
    // declarations resolve against legal formation targets in the same hostile window.
    const rangerCommands = final.events.filter((event) => (
      event.type === "skill-committed" && event.actorId === "foe-1"
    ));
    expect(rangerCommands).toHaveLength(2);
    expect(final.session.commands.map((command) => command.type)).toEqual([
      "stand-down",
      "stand-down",
      "stand-down",
      "end-turn",
    ]);
    expect(final.session.encounter.round).toBe(2);
    expect(verifyTowSession(final.session)).toMatchObject({ ok: true });
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
    expect(result.scenarioVersion).toBe(3);
    expect(result.allyGroupId).toBe("solo");
    expect(result.allyGroupVersion).toBe(2);
    expect(result.seed).toContain("practice::solitaire-tow-v1::fighter@1::training-yard@3::solo@2");
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
