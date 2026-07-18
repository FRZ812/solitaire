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
    expect(SYSTEM_PROMPT).toContain("War Singer/Satirist/Resonant Virtuoso/Lorekeeper are Bard specializations");
    expect(SYSTEM_PROMPT).toContain("Bard is a non-spell performance profession");
    expect(SYSTEM_PROMPT).toContain("Cadence is capped at four and resets every fight");
    expect(SYSTEM_PROMPT).toContain("alternating native voice, rhythm, harmony, or story motifs builds one");
    expect(SYSTEM_PROMPT).toContain("repeating the same motif builds none, and finishers spend the earned count");
    expect(SYSTEM_PROMPT).toContain("never casts arcane, divine, primal, pact, or shadow magic");
    expect(SYSTEM_PROMPT).toContain("never spends Resolve as spellcasting");
    expect(SYSTEM_PROMPT).toContain("never produces healing, shields, summons, enchantment, compulsion, or true or magical damage");
    expect(SYSTEM_PROMPT).toContain("Hunter/Trailblazer/Beast Warden/Trapper are Ranger specializations");
    expect(SYSTEM_PROMPT).toContain("Ranger is wholly non-spell fieldcraft");
    expect(SYSTEM_PROMPT).toContain("self-side Quarry Insight is an integer from zero to five bound to one studied target and resets every combat");
    expect(SYSTEM_PROMPT).toContain("selecting or successfully building against a different quarry clears the old count first");
    expect(SYSTEM_PROMPT).toContain("builders add only after their setup or hit succeeds");
    expect(SYSTEM_PROMPT).toContain("spenders require the current quarry and spend once for the whole action");
    expect(SYSTEM_PROMPT).toContain("never use magical Hunter's Mark, primal/arcane/divine power, teleportation, conjuring, Warrior Tempo, Monk Posture Strain, Barbarian Fury, or another profession's cards");
    expect(SYSTEM_PROMPT).toContain("only suitable trained mundane animal allies already present in the scene or fight");
    expect(SYSTEM_PROMPT).toContain("never summon, create, transform, replace, telepathically command, or share senses with an animal");
    expect(SYSTEM_PROMPT).toContain("Infiltrator, Scoundrel, Assassin, and Saboteur are specializations of the broad Rogue profession");
    expect(SYSTEM_PROMPT).toContain("Rogue is wholly mundane subterfuge");
    expect(SYSTEM_PROMPT).toContain("Opportunity Window is a two-turn, non-numeric, non-stacking target status owned by the source Rogue");
    expect(SYSTEM_PROMPT).toContain("A successful native setup or hit creates or refreshes that Rogue's Window on that exact target");
    expect(SYSTEM_PROMPT).toContain("one Rogue may prepare several targets and several Rogues retain independent openings on one target");
    expect(SYSTEM_PROMPT).toContain("consumes it once when committed even if the action misses");
    expect(SYSTEM_PROMPT).toContain("a multi-hit exploit consumes only once");
    expect(SYSTEM_PROMPT).toContain("never uses spells, shadow magic, magical invisibility, teleportation, Ranger fieldcraft or Quarry Insight, Warrior Tempo, Monk Posture Strain, Barbarian Fury, Bard performance or Cadence, or Artificer-style construction");
    expect(SYSTEM_PROMPT).toContain("Confidence work still depends on language, context, motive, and evidence");
    expect(SYSTEM_PROMPT).toContain("poison requires a real known carried substance and valid exposure");
    expect(SYSTEM_PROMPT).toContain("Saboteur work exploits an existing accessible mechanism or prepared structural fault");
    expect(SYSTEM_PROMPT).toContain("Shield Oath/Truth Oath/Mercy Oath/Beacon Oath are Paladin specializations");
    expect(SYSTEM_PROMPT).toContain("Paladin is unique non-spell oathcraft");
    expect(SYSTEM_PROMPT).toContain("Self-side Conviction is an integer from zero to five and resets every fight");
    expect(SYSTEM_PROMPT).toContain("only when Oathguard actually intercepts nonzero hostile damage for an ally or Stand Fast actually absorbs a real hostile hit");
    expect(SYSTEM_PROMPT).toContain("attempts, zero damage, ordinary injury, self-made harm, healing, basic actions, and unrelated actions earn none");
    expect(SYSTEM_PROMPT).toContain("multiple Paladins track their Conviction independently");
    expect(SYSTEM_PROMPT).toContain("Native spenders commit Conviction once even if an attack misses");
    expect(SYSTEM_PROMPT).toContain("a multi-hit action spends only once");
    expect(SYSTEM_PROMPT).toContain("uses no generic spellcasting, healing, smite, true damage, Warrior Tempo, or borrowed Cleric cards");
    expect(SYSTEM_PROMPT).toContain("Any sacred radiant rider is bounded, applies only to a profane target, and still passes through ward");
    expect(SYSTEM_PROMPT).toContain("Truth pressure remains source-owned and never reveals guilt");
    expect(SYSTEM_PROMPT).toContain("Mercy offers remain voluntary");
    expect(SYSTEM_PROMPT).toContain("Beacon guidance requires visible, willing allies and creates no supernatural light");
    expect(SYSTEM_PROMPT).toContain("Monk feats that look impossible are trained physical phenomena produced by conditioning, biomechanics, breath, speed, leverage, and impact");
    expect(SYSTEM_PROMPT).toContain("native unarmed contacts build target-side Posture Strain");
    expect(SYSTEM_PROMPT).toContain("only Temple Arms permits its own staff, spear, and temple-blade kata");
    expect(SYSTEM_PROMPT).not.toContain("Cleric, Fighter, Rogue");
    expect(SYSTEM_PROMPT).not.toContain("Mariner, Fighter, Ranger");
    expect(SYSTEM_PROMPT).toContain("trained fighter");
  });
});
