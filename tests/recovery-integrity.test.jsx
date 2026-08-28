import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  applyCharacterBootstrap,
  characterSetupChecksum,
  compileCharacterBootstrap,
  isCharacterBootstrapReceipt,
} from "../src/gameplay/combat/character-bootstrap.js";
import {
  characterSetupForArchetype,
  createDefaultArchetypeDraft,
  STARTING_ARCHETYPES,
} from "../src/gameplay/combat/starting-archetypes.js";
import { makeInitialState, migrateCodex } from "../src/data/initial-state.js";
import {
  canCommitCombatSession,
  emptyMechanicsSidecar,
  hasCurrentMechanicsState,
  upgradeCampaignPayload,
} from "../src/engine/campaign-migration.js";
import {
  createPendingCombatHandoff,
  readPendingCombatHandoff,
} from "../src/gameplay/combat/pending-directive.js";
import { createPracticeSession } from "../src/gameplay/combat/practice-scenarios.js";
import {
  COMBAT_V1_RUNTIME_IDENTITY,
  createCombatRuntimeSession,
  settleCombatRuntimeEncounter,
} from "../src/gameplay/combat/runtime.js";
import { narratorTurnPolicy } from "../src/engine/narrator-projection.js";
import { NARRATOR_RESPONSE_KEYS } from "../src/engine/narrator-turn-compiler.js";
import { SYSTEM_PROMPT } from "../src/system-prompt.js";
import {
  DEFAULT_NARRATOR_EFFORT,
  DEFAULT_NARRATOR_MODEL,
  NARRATOR_MODELS,
} from "../src/engine/narrator-models.js";
import {
  DEFAULT_EFFORT as EDGE_DEFAULT_EFFORT,
  DEFAULT_MODEL as EDGE_DEFAULT_MODEL,
  NARRATOR_MODEL_IDS,
  buildNarratorRequest,
} from "../supabase/functions/narrate/routing.ts";

const ROOT = process.cwd().replaceAll("\\", "/");

function currentState() {
  const state = migrateCodex(makeInitialState());
  state.created = true;
  state.mechanics = {
    ...emptyMechanicsSidecar(),
    campaignId: "campaign-a",
    campaignRevision: 7,
  };
  state.character.progressionModel = "archetype";
  return state;
}

describe("recovery integrity closure", () => {
  it("binds bootstrap identity to the complete character setup and rejects forgery", () => {
    const draft = createDefaultArchetypeDraft();
    const setup = characterSetupForArchetype(draft);
    const compiled = compileCharacterBootstrap({
      archetypeId: draft.archetypeId,
      origin: "archetype",
      setup,
    });
    expect(compiled.ok).toBe(true);
    expect(compiled.receipt.setupChecksum).toBe(characterSetupChecksum(setup));
    expect(isCharacterBootstrapReceipt(compiled.receipt)).toBe(true);

    const forged = { ...compiled.receipt, id: "0000000000000000" };
    expect(isCharacterBootstrapReceipt(forged)).toBe(false);

    const first = applyCharacterBootstrap(emptyMechanicsSidecar(), compiled.receipt);
    const second = applyCharacterBootstrap(first.mechanics, compiled.receipt);
    expect(first).toMatchObject({ ok: true, applied: true });
    expect(second).toMatchObject({ ok: true, applied: false });
    expect(second.mechanics).toBe(first.mechanics);

    const changed = compileCharacterBootstrap({
      archetypeId: draft.archetypeId,
      origin: "archetype",
      setup: { ...setup, name: `${setup.name} Changed` },
    });
    expect(changed.receipt.id).not.toBe(compiled.receipt.id);
  });

  it("normalizes retired stable IDs while preserving one canonical combat sidecar", () => {
    const state = currentState();
    state.character.inventory.carried.push({ itemId: "combat-shield", quantity: 1 });
    state.world.codex.items["combat-shield"] = { id: "combat-shield", name: "Old Shield" };
    state.world.seen = { "heron-combat": true };
    const migrated = migrateCodex(state);
    expect(migrated.character.inventory.carried[0].itemId).toBe("great-shield");
    expect(migrated.world.codex.items["great-shield"].id).toBe("great-shield");
    expect(migrated.world.codex.items).not.toHaveProperty("combat-shield");
    expect(migrated.world.seen).toHaveProperty("heron-seat", true);
    expect(migrated.mechanics).toHaveProperty("combat");
    expect(migrated.mechanics).not.toHaveProperty("archetype");
  });

  it("rejects malformed or unearned mechanics at the campaign write gate", () => {
    const valid = currentState();
    expect(hasCurrentMechanicsState(valid)).toBe(true);
    expect(upgradeCampaignPayload(valid)).toMatchObject({ ok: true, writable: true });

    const malformedCombat = structuredClone(valid);
    malformedCombat.mechanics.combat.activeCombat = { garbage: true };
    expect(hasCurrentMechanicsState(malformedCombat)).toBe(false);

    const malformedLedger = structuredClone(valid);
    malformedLedger.combatSettlementReceipts = "bad";
    expect(hasCurrentMechanicsState(malformedLedger)).toBe(false);

    const partialBootstrap = structuredClone(valid);
    partialBootstrap.mechanics.bootstrapId = "0123456789abcdef";
    partialBootstrap.mechanics.build = null;
    expect(hasCurrentMechanicsState(partialBootstrap)).toBe(false);
  });

  it("refuses a new combat session while earned loot or a reward is unresolved", () => {
    const state = currentState();
    const candidate = {
      sessionId: "next-fight",
      context: { campaignId: "campaign-a", campaignRevision: 7 },
    };
    state.pendingLoot = { id: "loot-from-prior-fight", items: [] };
    expect(canCommitCombatSession(state, candidate)).toBe(false);

    state.pendingLoot = null;
    state.pendingReward = { sourceReceiptId: "next-fight" };
    expect(canCommitCombatSession(state, candidate)).toBe(false);
  });

  it("binds pending combat handoffs to the current campaign mechanics context", () => {
    const state = currentState();
    const directive = {
      initiator: "player",
      surprise: false,
      lethal: true,
      foes: [{ npc_id: null, kind: "bandits", name: null, tier: "common", count: 1 }],
      note: "Bandits close the road.",
    };
    const created = createPendingCombatHandoff({ campaignId: "campaign-a", state, directive });
    expect(created.ok).toBe(true);
    const withPending = { ...state, pendingCombatDirective: created.handoff };
    expect(readPendingCombatHandoff(created.handoff, { campaignId: "campaign-a", state: withPending }).ok).toBe(true);

    const advanced = structuredClone(withPending);
    advanced.mechanics.campaignRevision += 1;
    expect(readPendingCombatHandoff(created.handoff, { campaignId: "campaign-a", state: advanced }))
      .toMatchObject({ ok: false, reason: "pending-combat-context-mismatch" });
  });

  it("refuses settlement across campaign or campaign-revision boundaries", () => {
    const draft = createDefaultArchetypeDraft();
    const compiled = compileCharacterBootstrap({
      archetypeId: draft.archetypeId,
      origin: "archetype",
      setup: characterSetupForArchetype(draft),
    });
    const practice = createPracticeSession(compiled.receipt);
    const genesis = practice.session.genesis;
    const opened = createCombatRuntimeSession(COMBAT_V1_RUNTIME_IDENTITY, {
      sessionId: "campaign-b:combat:1",
      rootSeed: "campaign-boundary-fixture",
      mode: "campaign",
      player: genesis.playerSnapshot,
      allies: genesis.allySnapshots,
      enemies: genesis.enemySnapshots,
      formations: genesis.formations,
      build: genesis.effectiveBuild,
      context: { campaignId: "campaign-b", campaignRevision: 8 },
    });
    expect(opened.ok).toBe(true);

    const wrongCampaign = currentState();
    expect(settleCombatRuntimeEncounter(wrongCampaign, opened.session))
      .toMatchObject({ ok: false, reason: "combat-campaign-identity-mismatch" });

    const wrongRevision = currentState();
    wrongRevision.mechanics.campaignId = "campaign-b";
    expect(settleCombatRuntimeEncounter(wrongRevision, opened.session))
      .toMatchObject({ ok: false, reason: "combat-campaign-revision-mismatch" });
  });

  it("keeps narrator creation and global progression outside the wire contract", () => {
    const policy = narratorTurnPolicy("Continue.", currentState());
    expect(policy.allowedEffects).toEqual(["assassination"]);
    expect(policy.allowedSkillIds).not.toContain("progression-and-professions");
    expect(NARRATOR_RESPONSE_KEYS).not.toContain("progression_focus");
    expect(NARRATOR_RESPONSE_KEYS).not.toContain("character_setup");
    expect(SYSTEM_PROMPT).not.toMatch(/progression_focus|character_setup/);
  });

  it("keeps browser and Edge narrator registries/defaults/pricing aligned", () => {
    expect(NARRATOR_MODELS.map(({ id }) => id)).toEqual([...NARRATOR_MODEL_IDS]);
    expect(DEFAULT_NARRATOR_MODEL).toBe(EDGE_DEFAULT_MODEL);
    expect(DEFAULT_NARRATOR_EFFORT).toBe(EDGE_DEFAULT_EFFORT);
    const luna = NARRATOR_MODELS.find(({ id }) => id === "openai/gpt-5.6-luna");
    const terra = NARRATOR_MODELS.find(({ id }) => id === "openai/gpt-5.6-terra");
    expect(luna.price).toMatchObject({ input: 0.22, output: 1.32 });
    expect(terra.price).toMatchObject({ input: 2, output: 12 });
    const lunaRequest = buildNarratorRequest({ model: luna.id, effort: "max", messages: [], tools: [], toolChoice: "none" });
    const terraRequest = buildNarratorRequest({ model: terra.id, effort: "max", messages: [], tools: [], toolChoice: "none" });
    expect(lunaRequest.provider.max_price).toEqual({ prompt: 0.44, completion: 2.64 });
    expect(terraRequest.provider.max_price).toEqual({ prompt: 4, completion: 24 });
    expect(lunaRequest).not.toHaveProperty("service_tier");
    expect(terraRequest).not.toHaveProperty("service_tier");
  });

  it("physically retires the prototype/reference UI and keeps all archetypes", () => {
    for (const path of [
      "src/components/ProfessionProgression.jsx",
      "src/components/ProgressionChoiceModal.jsx",
      "src/components/CreationHub.jsx",
      "src/components/ManualCreation.jsx",
      "src/components/combat/ProductionCombatView.jsx",
      "src/components/combat/ReferenceCombatView.jsx",
      "src/gameplay/production",
      "src/gameplay/reference",
      "src/gameplay/run",
    ]) expect(existsSync(`${ROOT}/${path}`)).toBe(false);
    expect(STARTING_ARCHETYPES).toHaveLength(12);
    const app = readFileSync(`${ROOT}/src/App.jsx`, "utf8").replaceAll("\r\n", "\n");
    const practice = readFileSync(`${ROOT}/src/components/creation/PracticeFight.jsx`, "utf8");
    expect(app).toContain("<VisualNovelStage");
    expect(app).not.toMatch(/ProductionCombatView|ReferenceCombatView|REFERENCE_GAMEPLAY/);
    expect(app).toContain("if (appliedBootstrap.applied === false) return true;");
    expect(app).toContain("flushActiveCampaignUntilStable");
    expect(app).toContain("Newer progress is still waiting to save");
    expect(practice).toMatch(/data-app-exclusive-surface className="practice-fight practice-fight--failed"/);
    expect(practice).toMatch(/data-app-exclusive-surface className="practice-fight practice-fight--result"/);
  });
});
