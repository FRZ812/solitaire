import { describe, expect, it } from "vitest";
import { compileCharacterBootstrap } from "../src/gameplay/combat/character-bootstrap.js";
import { createPracticeSession } from "../src/gameplay/combat/practice-scenarios.js";
import {
  characterSetupForArchetype,
  createDefaultArchetypeDraft,
  STARTING_ARCHETYPES,
} from "../src/gameplay/combat/starting-archetypes.js";
import { getSkill } from "../src/gameplay/combat/skills.js";
import {
  dispatchCombatRuntimePlayerAction,
  sealCombatRuntimeTerminalReceipt,
  verifyCombatRuntimeSession,
} from "../src/gameplay/combat/runtime.js";
import { sealCombatSession } from "../src/gameplay/combat/session.js";

const REQUIRED_ARCHETYPES = [
  "knight",
  "ranger",
  "artificer",
  "berserker",
  "sorcerer",
  "rogue",
  "warlock",
  "wizard",
  "paladin",
  "blademaster",
  "vampire",
  "automaton",
];

describe("current archetype practice combat", () => {
  it("opens and executes one deterministic attack for every current archetype", () => {
    expect(STARTING_ARCHETYPES.map(({ id }) => id)).toEqual(REQUIRED_ARCHETYPES);

    for (const archetype of STARTING_ARCHETYPES) {
      const draft = { ...createDefaultArchetypeDraft(), archetypeId: archetype.id };
      const setup = characterSetupForArchetype(draft);
      const compiled = compileCharacterBootstrap({
        archetypeId: archetype.id,
        origin: "archetype",
        setup,
      });
      expect(compiled.ok, `${archetype.id} bootstrap`).toBe(true);

      const opened = createPracticeSession(compiled.receipt);
      const reopened = createPracticeSession(compiled.receipt);
      expect(opened.ok, `${archetype.id} practice admission`).toBe(true);
      expect(reopened.session.checksum, `${archetype.id} deterministic practice checksum`)
        .toBe(opened.session.checksum);

      const skillId = compiled.receipt.build.skills
        .map(({ id }) => id)
        .find((id) => getSkill(id)?.effects?.some(({ target }) => target === "enemy"));
      expect(skillId, `${archetype.id} attack skill`).toBeTruthy();

      const result = dispatchCombatRuntimePlayerAction(opened.session, {
        id: `practice-smoke:${archetype.id}`,
        expectedRevision: opened.session.revision,
        type: "use-skill",
        actorId: "wanderer",
        skillId,
        targetId: opened.session.encounter.enemyIds[0],
        itemId: null,
        anchorCell: null,
      });
      expect(result.ok, `${archetype.id} attack dispatch: ${result.reason}`).toBe(true);
      expect(result.session.revision).toBeGreaterThan(opened.session.revision);
      expect(verifyCombatRuntimeSession(result.session).ok, `${archetype.id} replay verification`)
        .toBe(true);
    }
  });

  it("rejects a recomputed terminal session with a forged settlement stream", () => {
    const draft = createDefaultArchetypeDraft();
    const compiled = compileCharacterBootstrap({
      archetypeId: draft.archetypeId,
      origin: "archetype",
      setup: characterSetupForArchetype(draft),
    });
    let session = createPracticeSession(compiled.receipt).session;
    const skillId = compiled.receipt.build.skills[0].id;
    for (let turn = 0; session.status === "active" && turn < 100; turn += 1) {
      const targetId = session.encounter.enemyIds
        .find((id) => session.encounter.actors[id]?.hp > 0);
      const result = dispatchCombatRuntimePlayerAction(session, {
        id: `terminal-stream:${turn}`,
        expectedRevision: session.revision,
        type: "use-skill",
        actorId: "wanderer",
        skillId,
        targetId,
        itemId: null,
        anchorCell: null,
      });
      expect(result.ok, result.reason).toBe(true);
      session = result.session;
    }
    expect(session.status).toBe("terminal");
    const sealed = sealCombatRuntimeTerminalReceipt(session);
    expect(sealed.ok).toBe(true);
    const forged = sealCombatSession({
      ...sealed.session,
      streams: {
        ...sealed.session.streams,
        loot: {
          ...sealed.session.streams.loot,
          state: (sealed.session.streams.loot.state + 1) >>> 0,
        },
      },
      checksum: null,
    });
    expect(verifyCombatRuntimeSession(forged))
      .toMatchObject({ ok: false, reason: "replay-stream-divergence" });
  });
});
