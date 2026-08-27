import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  NARRATOR_CHARACTER_CUE_ACTIONS,
  NARRATOR_CHARACTER_CUE_MANNERS,
  NARRATOR_SCENE_CUE_TEXT,
} from "./engine/narrator-story-cues.js";
import { makeInitialState } from "./data/initial-state.js";
import { buildStateContext } from "./engine/api.js";
import { SYSTEM_PROMPT } from "./system-prompt.js";

const moduleUrl = new URL("./narrator-instructions.js", import.meta.url);

const EXPECTED_SKILL_IDS = [
  "narrative-craft",
  "identity-and-kindreds",
  "world-and-travel",
  "progression-and-professions",
  "magic-and-mounts",
  "economy-and-survival",
  "codex-and-npcs",
  "relationships-and-party",
  "inventory-and-light",
  "combat-and-consequences",
];

describe("narrator instruction library", () => {
  it("keeps universal player and canon invariants in the always-on contract", () => {
    expect(SYSTEM_PROMPT).toContain(
      "Never emit beat text",
    );
    expect(SYSTEM_PROMPT).toContain(
      "The player's bubble alone carries player speech, action, thought, feeling, intent, consent, choice, and conclusion",
    );
    expect(SYSTEM_PROMPT).toContain(
      "Every person who speaks must already exist and be listed as present in the current state, or be added to discoveries.characters in the same response",
    );
    expect(SYSTEM_PROMPT).toContain(
      "Names and examples found only inside narrator skills are reference material, not people present in the current scene",
    );
    expect(SYSTEM_PROMPT).not.toContain(
      "Routine dialogue or atmosphere with no specialized state change can answer from this core alone",
    );
    expect(SYSTEM_PROMPT).toContain(
      "On an ordinary general-action turn after creation, assassination is the only non-neutral effect",
    );
    expect(SYSTEM_PROMPT).toContain(
      "Conversation, exploration, training, gifts, wounds, relationships, discoveries, and loot do not grant their mechanics through ordinary narration",
    );
  });

  it("publishes the strict versioned wire contract with typed canonical speakers", () => {
    expect(SYSTEM_PROMPT).toContain('"contract_version":2');
    expect(SYSTEM_PROMPT).toContain('"state_revision":"copy from [NARRATOR CONTRACT]"');
    expect(SYSTEM_PROMPT).toContain('"cue":{"kind":"scene","event":"wind-rises|rain-falls|');
    expect(SYSTEM_PROMPT).toContain('"actor_id":"canonical-non-player-id"');
    expect(SYSTEM_PROMPT).toContain(`"event":"${Object.keys(NARRATOR_SCENE_CUE_TEXT).join("|")}"`);
    expect(SYSTEM_PROMPT).toContain(`"action":"${NARRATOR_CHARACTER_CUE_ACTIONS.join("|")}"`);
    expect(SYSTEM_PROMPT).toContain(`"manner":null|"${NARRATOR_CHARACTER_CUE_MANNERS.join("|")}"`);
    expect(SYSTEM_PROMPT).toContain('"speaker":{"kind":"character","id":"present-or-same-response-character-id"}');
    expect(SYSTEM_PROMPT).toContain('"assassination":null|{"target_id":"exact-valid-attempt-id","method":"basic-or-exact-valid-ability-id","outcome":"killed|survived-undetected|detected-combat|interrupted","surprise":null|<boolean>}');
    expect(SYSTEM_PROMPT).toContain("An assassination attempt does not automatically start combat");
    expect(SYSTEM_PROMPT).toContain(
      "start_combat must remain null unless the current [TURN POLICY] and [NARRATOR CONTRACT] authorize that exact combat handoff",
    );
    expect(SYSTEM_PROMPT).toContain(
      "The current [TURN POLICY] is the only mutation capability for this response",
    );
    expect(SYSTEM_PROMPT).toContain(
      "If the accepted story materially establishes an authorized effect, emit that effect in the same response",
    );
    expect(SYSTEM_PROMPT).toContain(
      "If a required outcome cannot be represented by an authorized field, do not narrate that outcome",
    );
    expect(SYSTEM_PROMPT).toContain('"roll":null');
    expect(SYSTEM_PROMPT).toContain('"encounter":null');
    expect(SYSTEM_PROMPT).toContain('"tile_discovery":null');
    expect(SYSTEM_PROMPT).toContain('"progression_focus":null');
    expect(SYSTEM_PROMPT).not.toContain('"progression_focus":null|"racial"');
    expect(SYSTEM_PROMPT).not.toContain('"speaker_id":"existing-or-same-response-character-id"');
    expect(SYSTEM_PROMPT).not.toContain('"name":"canonical NPC display name"');
  });

  it("keeps detailed rules in deterministic on-demand skill modules", async () => {
    expect(existsSync(moduleUrl), "the on-demand narrator instruction module must exist").toBe(true);

    const {
      NARRATOR_INSTRUCTION_CORPUS,
      NARRATOR_SKILL_CATALOG,
      NARRATOR_SKILL_LIBRARY,
      NARRATOR_SKILLS,
    } = await import("./narrator-instructions.js");

    expect(NARRATOR_SKILLS.map((skill) => skill.id)).toEqual(EXPECTED_SKILL_IDS);
    expect(Object.keys(NARRATOR_SKILL_LIBRARY)).toEqual(EXPECTED_SKILL_IDS);
    expect(NARRATOR_SKILLS.every((skill) => skill.content.length > 200)).toBe(true);
    expect(NARRATOR_SKILLS.length).toBeLessThanOrEqual(16);
    expect(NARRATOR_SKILLS.every((skill) => skill.content.length <= 50_000)).toBe(true);
    expect(NARRATOR_SKILLS.reduce((sum, skill) => sum + skill.content.length, 0)).toBeLessThanOrEqual(180_000);
    expect(NARRATOR_SKILL_CATALOG.length).toBeLessThan(3_000);

    expect(NARRATOR_INSTRUCTION_CORPUS).toContain("THE NARRATIVE PHILOSOPHY");
    expect(NARRATOR_INSTRUCTION_CORPUS).toContain("TIER SCALES AN ABILITY");
    expect(NARRATOR_INSTRUCTION_CORPUS).not.toContain("NARRATIVE PARTY REMOVAL");
    expect(NARRATOR_INSTRUCTION_CORPUS).toContain("OUTPUT — STRICT JSON, NOTHING ELSE");
    expect(NARRATOR_INSTRUCTION_CORPUS).toContain('"contract_version": 2');
    expect(NARRATOR_INSTRUCTION_CORPUS).toContain('"state_revision": "copy from [NARRATOR CONTRACT]"');

    const normalize = (value) => value.replace(/\s+/g, " ").trim();
    const detailedDoctrine = NARRATOR_INSTRUCTION_CORPUS
      .slice(0, NARRATOR_INSTRUCTION_CORPUS.indexOf("OUTPUT — STRICT JSON, NOTHING ELSE"));
    const doctrineBodies = NARRATOR_SKILLS.map(({ content }) => (
      content.slice(content.indexOf("DOMAIN DOCTRINE") + "DOMAIN DOCTRINE".length).trim()
    ));
    expect(normalize(doctrineBodies.join("\n")))
      .toBe(normalize(detailedDoctrine));

    const creation = NARRATOR_SKILLS.find(({ id }) => id === "narrative-craft");
    expect(creation.trigger).toContain("character creation");
    expect(creation.content).toContain("CHARACTER CREATION — the opening interview");
    expect(creation.content).toContain('speaker id "threshold-voice"');
    expect(creation.content).toContain("The engine and response schema are authoritative");
    expect(creation.content).not.toContain("The player's body is yours to write");
    expect(creation.content).not.toContain("1–3 short paragraphs per beat entry");

    const world = NARRATOR_SKILLS.find(({ id }) => id === "world-and-travel");
    const progression = NARRATOR_SKILLS.find(({ id }) => id === "progression-and-professions");
    const magic = NARRATOR_SKILLS.find(({ id }) => id === "magic-and-mounts");
    const combat = NARRATOR_SKILLS.find(({ id }) => id === "combat-and-consequences");
    const relationships = NARRATOR_SKILLS.find(({ id }) => id === "relationships-and-party");
    const inventory = NARRATOR_SKILLS.find(({ id }) => id === "inventory-and-light");
    expect(NARRATOR_SKILLS.every(({ content }) => content.startsWith("MECHANICS-CLOSED ROUTE"))).toBe(true);
    expect(world.content).toContain("GEOGRAPHY KNOWN BY LEGEND");
    expect(world.content).toContain(
      "tile_move stays null unless the current [TURN POLICY] supplies that exact destination",
    );
    expect(world.content).not.toContain("Set tile_move:{x,y} on a beat");
    expect(world.content).not.toContain("you may also narrate an encounter drawing from the local spawn table");
    expect(progression.content).toContain("PROGRESSION — engine-owned");
    expect(creation.content).toContain("TOWER ARCHETYPE OVERRIDE — CLOSED COMBAT KIT");
    expect(creation.content).not.toContain("pack items via inventory_changes.added");
    expect(creation.content).not.toContain("Add them via inventory_changes.added");
    expect(magic.content).toContain("[GRANTABLE WORLD POWERS] is present, it is the COMPLETE grant catalogue");
    expect(magic.content).toContain(
      "grant_mount stays null unless the current [TURN POLICY] authorizes that exact beast id",
    );
    expect(magic.content).not.toContain("you may grant_mount after a lighter trial");
    expect(magic.content).not.toContain("grant one by adding it to discoveries.skills");
    expect(relationships.content).not.toContain("Record significant shared moments with memory_updates");
    expect(inventory.content).not.toContain("loot you grant still lands");
    expect(inventory.content).not.toContain("Every weapon, piece of armour, tool, or consumable you award");

    const tower = makeInitialState();
    tower.created = true;
    tower.character.progressionModel = "tow-archetype";
    tower.mechanics = {
      ...tower.mechanics,
      build: {
        traits: {},
        skills: ["arctic-strike", "arctic-block", "arctic-deliberate-blow", "arctic-incineration", "arctic-mortal-blow"],
        runes: [],
      },
    };
    const towerContext = buildStateContext(tower);
    const towerTeachingContract = `${magic.content}\n${towerContext}`;
    expect(towerTeachingContract).toContain("[TOWER COMBAT KIT —");
    expect(towerTeachingContract).toContain("[GRANTABLE WORLD POWERS —");
    expect(towerContext).not.toContain("[GRANTABLE ABILITIES —");
    expect(towerTeachingContract).toContain("never narrate teaching a legacy combat action that the engine will reject");

    expect(combat.content).toContain("The engine has already settled every defeat consequence");
    expect(combat.content).not.toContain("Decide an aftermath");
    expect(combat.content).not.toContain("strip coin and maybe loot");
    expect(combat.content).not.toContain("what the player did with their last breath");
    expect(combat.content).not.toContain('"story": describe the opening blow');
    expect(combat.content).not.toContain("combat_effect");
    expect(combat.content).toContain(
      "start_combat remains null unless the current [TURN POLICY] and [NARRATOR CONTRACT] authorize that exact handoff",
    );
    expect(combat.content).not.toContain("even start_combat for what the noise drew");
    expect(combat.content).not.toContain("You hand a fight to it with the start_combat field");
    expect(combat.content).toContain("An assassination attempt does not automatically start combat");
    expect(combat.content).toContain("stat/ability-authorized assassination deaths");
    expect(combat.content).toContain("outcome:killed only for that exact target and exact method");
    expect(combat.content).toContain("outcome:detected-combat");
    expect(combat.content).toContain("survives without detection or immediate retaliation");
    expect(combat.content).not.toContain("emit start_combat instead");
    expect(combat.content).not.toContain("the strike LANDS and KILLS");
    expect(combat.content).not.toContain("THAT guard takes the blow and dies");
    expect(combat.content).not.toContain("Apply vitality_change with negative deltas");
    expect(combat.content).not.toContain("apply a blocking condition");
    expect(combat.content).not.toContain("Record them on the current tile with location_update");
    expect(NARRATOR_INSTRUCTION_CORPUS).toContain('"roll": null,');
    expect(NARRATOR_INSTRUCTION_CORPUS).toContain('"encounter": null,');
    expect(NARRATOR_INSTRUCTION_CORPUS).toContain('"tile_discovery": null,');
    expect(NARRATOR_INSTRUCTION_CORPUS).toContain('"tile_move": null,');
    expect(NARRATOR_INSTRUCTION_CORPUS).toContain('"progression_focus": null,');
    expect(NARRATOR_INSTRUCTION_CORPUS).not.toContain('"progression_focus": null OR "racial"');
  });
});
