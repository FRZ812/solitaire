import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  NARRATOR_CHARACTER_CUE_ACTIONS,
  NARRATOR_CHARACTER_CUE_MANNERS,
  NARRATOR_SCENE_CUE_TEXT,
} from "./engine/narrator-story-cues.js";
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
      "start_combat must remain null unless the current [NARRATOR CONTRACT] authorizes that exact combat handoff",
    );
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
    expect(normalize(NARRATOR_SKILLS.map(({ content }) => content).join("\n")))
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
    const combat = NARRATOR_SKILLS.find(({ id }) => id === "combat-and-consequences");
    expect(world.content).toContain("GEOGRAPHY KNOWN BY LEGEND");
    expect(progression.content.startsWith("PROGRESSION — engine-owned")).toBe(true);
    expect(combat.content).toContain("The engine has already settled every defeat consequence");
    expect(combat.content).not.toContain("Decide an aftermath");
    expect(combat.content).not.toContain("strip coin and maybe loot");
    expect(combat.content).not.toContain("what the player did with their last breath");
    expect(combat.content).not.toContain('"story": describe the opening blow');
    expect(combat.content).not.toContain("combat_effect");
    expect(combat.content).toContain(
      "start_combat remains null unless the current [NARRATOR CONTRACT] authorizes that exact handoff",
    );
    expect(combat.content).not.toContain("You hand a fight to it with the start_combat field");
    expect(combat.content).toContain("An assassination attempt does not automatically start combat");
    expect(combat.content).toContain("stat/ability-authorized assassination deaths");
    expect(combat.content).toContain("outcome:killed only for that exact target and exact method");
    expect(combat.content).toContain("outcome:detected-combat");
    expect(combat.content).toContain("survives without detection or immediate retaliation");
    expect(combat.content).not.toContain("emit start_combat instead");
    expect(combat.content).not.toContain("the strike LANDS and KILLS");
    expect(combat.content).not.toContain("THAT guard takes the blow and dies");
  });
});
