import {
  normalizeRacialBranchChoices,
  pendingRacialBranchChoices,
  racialBranchChoices,
} from "./racial-branches.js";

const authoredBuild = (raceId, rationale, branchChoices) => Object.freeze({
  raceId,
  rationale,
  branchChoices: Object.freeze(branchChoices),
});

// Ready-made characters are the one place where reached racial thresholds may
// begin resolved. Each selection follows the character's authored history;
// manual characters still reach the same thresholds with no automatic choice.
export const TEMPLATE_RACIAL_BRANCH_BUILDS = Object.freeze({
  "champion-paladin": authoredBuild(
    "human",
    "Yusra's disciplined courage and ability to steady a whole room make her a mortal Paragon.",
    { "human-adaptation": "paragon" },
  ),
  "dragon-hunter": authoredBuild(
    "human",
    "Halvard repeatedly survives close encounters with wyrms through caution, endurance, and refusal to panic.",
    { "human-adaptation": "survivor" },
  ),
  "high-sorcerer": authoredBuild(
    "human",
    "Veylan outgrew the institution that trained him by turning exceptional study into self-directed mastery.",
    { "human-adaptation": "prodigy" },
  ),
  warlord: authoredBuild(
    "half-orc",
    "Grum made three hostile war-bands move as one, expressing his mixed blood through the Warhowl path.",
    { "half-orc-claim": "warhowl" },
  ),
  "fae-touched": authoredBuild(
    "elf",
    "Niamh's thornwild weapon, mobile fighting style, and weather-like motion fit a Greenblood Wild Runner.",
    {
      "elf-awakening": "greenblood",
      "elf-greenblood-destiny": "wild-runner",
    },
  ),
  "archmage-ascendant": authoredBuild(
    "human",
    "Inzaghi's vanished canons and reality-spanning scholarship express the breadth of a mortal Prodigy.",
    { "human-adaptation": "prodigy" },
  ),
  "undying-champion": authoredBuild(
    "human",
    "Sigrun has died and risen four times; her defining mortal inheritance is survival beyond every ending.",
    { "human-adaptation": "survivor" },
  ),
  "demon-warlock": authoredBuild(
    "demonborn",
    "Vesh weaponizes courtly charm, exact bargains, and concealed power as a Velvet Tempter who matures into a Court Devil.",
    {
      "demonborn-inheritance": "velvet-tempter",
      "demonborn-tempter-apex": "court-devil",
    },
  ),
  "dragon-ascendant": authoredBuild(
    "drakeborn",
    "Vaelith's furnace-bright blood and sovereign presence express the Ember Line as a Cinder Tyrant.",
    {
      "drakeborn-breath-line": "ember-line",
      "drakeborn-ember-ascendance": "cinder-tyrant",
    },
  ),
  "enchanter-tyrant": authoredBuild(
    "human",
    "Korvane combined supreme enchantment with rulership, making the Prodigy's cross-disciplinary Polymath destiny his mortal apex.",
    {
      "human-adaptation": "prodigy",
      "human-prodigy-calling": "polymath",
    },
  ),
});

// Direct integration shape for templates.js:
//   branchChoices: TEMPLATE_RACIAL_BRANCH_CHOICES[template.id] || {}
export const TEMPLATE_RACIAL_BRANCH_CHOICES = Object.freeze(Object.fromEntries(
  Object.entries(TEMPLATE_RACIAL_BRANCH_BUILDS).map(([templateId, build]) => [templateId, build.branchChoices]),
));

/**
 * Validate the authored selections against the live threshold definitions.
 * Dependency maps are arguments so templates.js can import this data without a
 * circular dependency back into its own TEMPLATE_RACIAL_LEVELS export.
 */
export function validateTemplateRacialBranchBuilds(templateRacialLevels, templateRaces) {
  const errors = [];
  const levels = templateRacialLevels || {};
  const races = templateRaces || {};
  const eligibleIds = Object.entries(levels)
    .filter(([, level]) => Number(level) >= 10)
    .map(([templateId]) => templateId);

  for (const templateId of eligibleIds) {
    if (!TEMPLATE_RACIAL_BRANCH_BUILDS[templateId]) errors.push(`${templateId}: reached a racial branch threshold without authored choices`);
  }

  for (const [templateId, build] of Object.entries(TEMPLATE_RACIAL_BRANCH_BUILDS)) {
    const level = Number(levels[templateId] ?? -1);
    if (level < 10) {
      errors.push(`${templateId}: authored racial choices before level 10`);
      continue;
    }
    const actualRace = typeof races === "function" ? races(templateId) : races[templateId];
    if (actualRace && actualRace !== build.raceId) errors.push(`${templateId}: branch race ${build.raceId} does not match ${actualRace}`);
    if (build.rationale.length < 50) errors.push(`${templateId}: branch rationale is not specific enough`);

    const definitions = racialBranchChoices(build.raceId);
    const normalized = normalizeRacialBranchChoices(build.raceId, build.branchChoices);
    if (Object.keys(normalized).length !== Object.keys(build.branchChoices).length) errors.push(`${templateId}: contains an invalid or unreachable branch selection`);

    for (const [choiceId, optionId] of Object.entries(build.branchChoices)) {
      const definition = definitions.find((entry) => entry.id === choiceId);
      if (!definition) {
        errors.push(`${templateId}: unknown choice ${choiceId}`);
        continue;
      }
      if (!definition.options.some((entry) => entry.id === optionId)) errors.push(`${templateId}: unknown option ${optionId} for ${choiceId}`);
      if (definition.threshold > level) errors.push(`${templateId}: selected ${choiceId} at ${level}, before threshold ${definition.threshold}`);
      if (definition.parentChoiceId && build.branchChoices[definition.parentChoiceId] !== definition.parentOptionId) {
        errors.push(`${templateId}: ${choiceId} prerequisite ${definition.parentChoiceId}=${definition.parentOptionId} is not selected`);
      }
    }

    const pending = pendingRacialBranchChoices(build.raceId, level, normalized);
    if (pending.length) errors.push(`${templateId}: unresolved reached choices ${pending.map((entry) => entry.id).join(", ")}`);
  }

  return errors;
}
