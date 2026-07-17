import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ManualCreation } from "../components/ManualCreation.jsx";
import { makeInitialState } from "../data/initial-state.js";
import {
  canonicalProfessionId,
  canonicalProfessionIdentity,
  isBroadProfessionName,
} from "../data/progression-paths.js";
import { SYSTEM_PROMPT } from "../system-prompt.js";
import { buildStateContext, summarizeProgressionAllocation } from "./api.js";
import { sanitizeNarratorProgressionHints, sanitizeProfessionPlan } from "./discoveries.js";
import { createProgression, normalizeCharacterProgression } from "./progression.js";

describe("Warrior public identity and fighter save compatibility", () => {
  it("maps the public broad name to the durable id without inventing a specialization", () => {
    expect(canonicalProfessionId("Warrior")).toBe("fighter");
    expect(isBroadProfessionName("Warrior", "fighter")).toBe(true);
    expect(canonicalProfessionIdentity("Warrior")).toEqual({
      professionId: "fighter",
      specializationId: null,
    });

    expect(canonicalProfessionIdentity("Sellsword")).toEqual({
      professionId: "fighter",
      specializationId: "sellsword",
    });
  });

  it("keeps public broad names broad through narrator input and legacy save migration", () => {
    expect(sanitizeProfessionPlan({
      profession_plan: [
        { profession: "Warrior", levels: 10 },
        { profession: "Sellsword", levels: 5 },
      ],
    })).toEqual([
      { profession: "fighter", levels: 10 },
      { profession: "fighter", specialization: "Sellsword", levels: 5 },
    ]);

    expect(sanitizeNarratorProgressionHints({ profession: "Warrior", level: 8 })).toMatchObject({
      profession: "fighter",
      level: 8,
    });
    expect(sanitizeNarratorProgressionHints({ profession: "Warrior", level: 8 })).not.toHaveProperty("archetype");

    const migrated = normalizeCharacterProgression({ profession: "Warrior", race: "human", level: 8 });
    expect(migrated).toMatchObject({ profession: "fighter", archetype: null });
    expect(migrated.progression.professions[0]).toMatchObject({
      professionId: "fighter",
      specializationId: null,
    });
  });

  it("shows Warrior in creation and narrator-facing progression text while retaining the save id", () => {
    const html = renderToStaticMarkup(
      <ManualCreation onBegin={() => {}} onCancel={() => {}} onQuit={() => {}} busy={false} />,
    );
    expect(html).toContain('<option value="Warrior"></option>');
    expect(html).not.toContain('<option value="fighter"></option>');

    const progression = createProgression({ professionId: "Warrior", level: 8 });
    expect(progression.professionId).toBe("fighter");
    expect(summarizeProgressionAllocation({ profession: "fighter", progression }).professionText)
      .toContain("Warrior 8");

    const state = makeInitialState();
    state.character.profession = "fighter";
    state.world.codex.characters.wanderer.profession = "fighter";
    const playerLine = buildStateContext(state).match(/\[PLAYER —[^\n]+/)?.[0] || "";
    expect(playerLine).toContain("Warrior");
    expect(playerLine).not.toMatch(/\bfighter\b/i);
  });

  it("teaches the full broad roster and martial-independence rule without relabeling generic combatants", () => {
    expect(SYSTEM_PROMPT).toContain("Warrior, Barbarian, Bard, Cleric, Druid, Monk, Paladin, Ranger, Rogue, Sorcerer, Warlock, Wizard, Artificer");
    expect(SYSTEM_PROMPT).toContain("Sellsword/Duelist/Iron Vanguard/Undying Champion are Warrior specializations");
    expect(SYSTEM_PROMPT).toContain("Reaver/Berserker/Juggernaut/Clan Champion are Barbarian specializations");
    expect(SYSTEM_PROMPT).toContain("NEVER imports another profession's spells or abilities");
    expect(SYSTEM_PROMPT).toContain("Barbarian Fury is self-side, capped at five, resets every fight");
    expect(SYSTEM_PROMPT).toContain("earned no more than once per hostile action that directly damages the Barbarian");
    expect(SYSTEM_PROMPT).toContain("deliberate self-provocation may add one Fury only by exposing the guard");
    expect(SYSTEM_PROMPT).toContain("never primal spirits, elemental power, shapeshifting, Warrior Tempo, or Monk Posture Strain");
    expect(SYSTEM_PROMPT).toContain("Bard is a non-spell performance profession");
    expect(SYSTEM_PROMPT).toContain("never casts arcane, divine, primal, or pact magic and never borrows caster cards");
    expect(SYSTEM_PROMPT).toContain("Monk feats that look impossible are trained physical phenomena produced by conditioning, biomechanics, breath, speed, leverage, and impact");
    expect(SYSTEM_PROMPT).toContain("native unarmed contacts build target-side Posture Strain");
    expect(SYSTEM_PROMPT).toContain("only Temple Arms permits its own staff, spear, and temple-blade kata");
    expect(SYSTEM_PROMPT).not.toContain("Cleric, Fighter, Rogue");
    expect(SYSTEM_PROMPT).not.toContain("Mariner, Fighter, Ranger");
    expect(SYSTEM_PROMPT).toContain("trained fighter");
  });
});
