// Try the build before you commit to it.
//
// A player choosing a starting package is being asked to pick a combat identity from a
// description. Practice lets them go and use it instead — a real fight, on the real reducer,
// against an authored foe — and then hands their draft back exactly as it was.
//
// Two properties make that trustworthy rather than merely nice.
//
// It is the production fight. The same encounter reducer, the same command boundary, the
// same intent scheduler, the same Chronicle and the same replay verifier. Nothing branches
// on "this is only practice", because a practice fight that played by different rules would
// be teaching the player something false about the build they are about to take into a
// world where it matters.
//
// And it cannot write anything. Not a campaign row, not a local save, not an injury, not a
// reward. That is enforced by not handing it the ability rather than by asking it nicely:
// `createPracticeSession` takes a receipt and a scenario and returns a session, and there is
// no persistence argument for it to misuse. The draft is hashed before and after so the
// claim is checked rather than asserted.
//
// The seed is derived, never ambient. The same draft, scenario and attempt always produce
// the same fight, so "retry the same seed" is a real promise and "try another seed" is an
// explicit, recorded step rather than a reroll nobody can reproduce.

import { cloneJsonData } from "../kernel/json-data.js";
import { gameplayChecksum } from "../kernel/replay.js";
import { isCharacterBootstrapReceipt } from "./character-bootstrap.js";
import { buildCombatChronicle } from "./chronicle.js";
import { LOCKED_LANE_FORMATION_RULES_VERSION } from "./formation.js";
import {
  combatItemIdForKeepsake,
  isStartingKeepsake,
  permanentItemIdForKeepsake,
} from "./keepsakes.js";
import {
  TOW_V1_RUNTIME_IDENTITY,
  createTowRuntimeSession,
  sealTowRuntimeTerminalReceipt,
  verifyTowRuntimeSession,
} from "./runtime.js";
import { getSkill, skillRankForRarity, skillRarityChoices } from "./skills.js";
import { getStartingArchetype } from "./starting-archetypes.js";
import { effectiveTowBuild, towItemActorBonuses } from "./start-items.js";

export const PRACTICE_SCENARIO_VERSION = 4;
export const PRACTICE_ALLY_GROUP_VERSION = 2;
export const MAX_PRACTICE_ATTEMPT = 4096;

function freezeJsonData(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(freezeJsonData));
  if (value && typeof value === "object") {
    return Object.freeze(Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, freezeJsonData(entry)]),
    ));
  }
  return value;
}

function foe(id, name, maxHp, attack, archetypeId) {
  const archetype = getStartingArchetype(archetypeId);
  if (!archetype) throw new TypeError(`unknown-practice-archetype:${archetypeId}`);
  return Object.freeze({
    id,
    name,
    maxHp,
    resolve: archetype.baseStats.resolveMax,
    resolveMax: archetype.baseStats.resolveMax,
    resolveRegen: archetype.baseStats.resolveRegen,
    stats: Object.freeze({ attack, defense: attack, critRate: 4, dodgeRate: 3 }),
    archetypeId: archetype.id,
    build: Object.freeze({
      traits: Object.freeze({ ...archetype.build.traits }),
      skills: Object.freeze([...archetype.build.skills]),
      runes: Object.freeze([...archetype.build.runes]),
    }),
  });
}

function canonicalAlly(id, archetypeId) {
  const archetype = getStartingArchetype(archetypeId);
  if (!archetype) throw new TypeError(`unknown-practice-archetype:${archetypeId}`);
  const base = archetype.baseStats;
  const bonus = towItemActorBonuses(archetype.gear);
  return Object.freeze({
    id,
    name: archetype.name,
    maxHp: base.maxHp + bonus.maxHp,
    resolve: base.resolveMax + bonus.resolveMax,
    resolveMax: base.resolveMax + bonus.resolveMax,
    resolveRegen: base.resolveRegen + bonus.resolveRegen,
    stats: Object.freeze({
      attack: base.attack + bonus.attack,
      defense: base.defense + bonus.defense,
      critRate: Math.min(100, base.critRate + bonus.critRate),
      dodgeRate: Math.min(100, base.dodgeRate + bonus.dodgeRate),
    }),
    archetypeId: archetype.id,
    build: freezeJsonData(effectiveTowBuild(archetype.build, archetype.gear)),
  });
}

const PALADIN_ALLY = canonicalAlly("practice-ally-paladin", "paladin");
const RANGER_ALLY = canonicalAlly("practice-ally-ranger", "ranger");

function allyGroup(id, name, summary, allies, formation) {
  return Object.freeze({
    id,
    version: PRACTICE_ALLY_GROUP_VERSION,
    name,
    summary,
    allies: Object.freeze([...allies]),
    formation: Object.freeze([...formation]),
  });
}

/** Authored player-side groups. The selected archetype always occupies `wanderer`. */
export const PRACTICE_ALLY_GROUPS = Object.freeze([
  allyGroup(
    "solo",
    "Solo",
    "Only the selected archetype enters the formation.",
    [],
    [null, "wanderer", null, null, null, null, null, null, null],
  ),
  allyGroup(
    "field-pair",
    "Field pair",
    "A canonical Paladin holds the front while the selected archetype works behind them.",
    [PALADIN_ALLY],
    [null, PALADIN_ALLY.id, null, null, "wanderer", null, null, null, null],
  ),
  allyGroup(
    "expedition-trio",
    "Expedition trio",
    "A Paladin vanguard, selected flanker, and Ranger rearguard demonstrate all three ranks.",
    [PALADIN_ALLY, RANGER_ALLY],
    [null, PALADIN_ALLY.id, null, "wanderer", null, null, null, null, RANGER_ALLY.id],
  ),
]);

export const DEFAULT_PRACTICE_ALLY_GROUP_ID = "solo";

export function getPracticeAllyGroup(allyGroupId) {
  return PRACTICE_ALLY_GROUPS.find((group) => group.id === allyGroupId) || null;
}

/**
 * Authored practice fixtures.
 *
 * Instructional rather than trivial: each is meant to be won by someone reading the
 * telegraph and spending a guard at the right moment, and lost by someone mashing the
 * attack button. Scenarios scale by fixture, never by secretly normalising the person — the
 * selected archetype's fixed combat equipment and mechanics go in untouched.
 */
export const PRACTICE_SCENARIOS = Object.freeze([
  Object.freeze({
    id: "training-yard",
    version: PRACTICE_SCENARIO_VERSION,
    name: "The training yard",
    summary: "One opponent, no stakes. Room to see what your actions do.",
    difficulty: "gentle",
    enemies: Object.freeze([foe("foe-0", "Sparring partner", 52, 8, "arctic-knight")]),
    formation: Object.freeze([null, "foe-0", null, null, null, null, null, null, null]),
  }),
  Object.freeze({
    id: "roadside-ambush",
    version: PRACTICE_SCENARIO_VERSION,
    name: "A roadside ambush",
    summary: "Two of them, and neither waits their turn. Pick who falls first.",
    difficulty: "standard",
    enemies: Object.freeze([
      foe("foe-0", "Waylayer", 34, 7, "last-assassin"),
      foe("foe-1", "Waylayer", 34, 7, "demon-slayer"),
    ]),
    formation: Object.freeze(["foe-0", null, "foe-1", null, null, null, null, null, null]),
  }),
  Object.freeze({
    id: "the-duellist",
    version: PRACTICE_SCENARIO_VERSION,
    name: "The duellist",
    summary: "One opponent who hits hard enough that guarding the right round matters.",
    difficulty: "sharp",
    enemies: Object.freeze([foe("foe-0", "Duellist", 74, 11, "wandering-blade")]),
    formation: Object.freeze([null, "foe-0", null, null, null, null, null, null, null]),
  }),
  Object.freeze({
    id: "formation-drill",
    version: PRACTICE_SCENARIO_VERSION,
    name: "The formation drill",
    summary: "Three distinct ranks make lines, columns, and area footprints visible.",
    difficulty: "formation",
    enemies: Object.freeze([
      foe("foe-0", "Knight", 64, 9, "knight"),
      foe("foe-1", "Ranger", 48, 9, "ranger"),
      foe("foe-2", "Wizard", 44, 10, "wizard"),
    ]),
    formation: Object.freeze([
      null, "foe-0", null,
      "foe-1", null, null,
      null, null, "foe-2",
    ]),
  }),
]);

export const DEFAULT_PRACTICE_SCENARIO_ID = "training-yard";

export function getPracticeScenario(scenarioId) {
  return PRACTICE_SCENARIOS.find((scenario) => scenario.id === scenarioId) || null;
}

/**
 * A stable fingerprint of the draft being tried.
 *
 * Only what would change the fight: the package and the build. Deliberately *not* the
 * receipt's own id, which folds in the origin — hashing that would mean the same build gave
 * a different practice fight depending on whether the player reached it from Quick Start or
 * from the roster, which is a difference the player can see and cannot explain.
 */
function normalizedPracticeSkillRarities(receipt, skillRarities) {
  if (skillRarities == null) return null;
  if (!Array.isArray(skillRarities) || skillRarities.length !== receipt.build.skills.length) return false;
  if (!skillRarities.every((rarity, index) => {
    const entry = receipt.build.skills[index];
    const definition = getSkill(typeof entry === "string" ? entry : entry?.id);
    return definition && skillRarityChoices(definition).includes(rarity);
  })) return false;
  return skillRarities.some((rarity, index) => (
    rarity !== getSkill(
      typeof receipt.build.skills[index] === "string"
        ? receipt.build.skills[index]
        : receipt.build.skills[index]?.id,
    ).rarity
  )) ? [...skillRarities] : null;
}

function withPracticeSkillRarities(build, sourceSkillIds, skillRarities) {
  if (!skillRarities) return build;
  const ids = sourceSkillIds.map((entry) => (typeof entry === "string" ? entry : entry?.id));
  return {
    ...build,
    skills: build.skills.map((entry) => {
      const id = typeof entry === "string" ? entry : entry.id;
      const sourceIndex = ids.indexOf(id);
      if (sourceIndex < 0) return entry;
      const rank = skillRankForRarity(id, skillRarities[sourceIndex]);
      return typeof entry === "string"
        ? { id, rank }
        : { ...entry, id, rank };
    }),
  };
}

export function draftHash(receipt, skillRarities = null, keepsakeId = null) {
  if (!isCharacterBootstrapReceipt(receipt)) return null;
  const rarities = normalizedPracticeSkillRarities(receipt, skillRarities);
  if (rarities === false) return null;
  if (keepsakeId !== null && !isStartingKeepsake(keepsakeId)) return null;
  const archetype = getStartingArchetype(receipt.archetypeId);
  const permanentItemId = permanentItemIdForKeepsake(keepsakeId);
  const itemIds = [...(archetype?.gear || []), ...(permanentItemId ? [permanentItemId] : [])];
  const build = withPracticeSkillRarities(
    effectiveTowBuild(receipt.build, itemIds),
    receipt.build.skills,
    rarities,
  );
  return gameplayChecksum({
    archetypeId: receipt.archetypeId,
    professionId: receipt.professionId,
    build,
    itemIds,
    keepsakeId,
  });
}

/**
 * The practice seed, derived rather than drawn.
 *
 * Ambient randomness would make "retry the same seed" a lie and "try another seed"
 * unrepeatable. Every input that could change the fight is named here, so a recorded result
 * can always be reproduced from what the result screen shows.
 */
export function derivePracticeSeed({
  rulesetId = TOW_V1_RUNTIME_IDENTITY.rulesetId,
  packageId,
  packageVersion = 1,
  scenarioId,
  scenarioVersion = PRACTICE_SCENARIO_VERSION,
  allyGroupId = DEFAULT_PRACTICE_ALLY_GROUP_ID,
  allyGroupVersion = PRACTICE_ALLY_GROUP_VERSION,
  draftHash: hash,
  attemptIndex = 0,
} = {}) {
  if (!packageId || !scenarioId || !allyGroupId || !hash) return null;
  if (!Number.isSafeInteger(attemptIndex) || attemptIndex < 0 || attemptIndex > MAX_PRACTICE_ATTEMPT) {
    return null;
  }
  return [
    "practice",
    rulesetId,
    `${packageId}@${packageVersion}`,
    `${scenarioId}@${scenarioVersion}`,
    `${allyGroupId}@${allyGroupVersion}`,
    hash,
    attemptIndex,
  ].join("::");
}

/**
 * The actor a package brings to a practice fight.
 *
 * The source roster brings an authored stat chassis. Practice must exercise that exact
 * chassis or the selector would advertise one character and test a different one.
 */
export function practiceActor(receipt, keepsakeId = null) {
  const archetype = getStartingArchetype(receipt?.archetypeId);
  const permanentItemId = permanentItemIdForKeepsake(keepsakeId);
  const bonus = towItemActorBonuses([
    ...(archetype?.gear || []),
    ...(permanentItemId ? [permanentItemId] : []),
  ]);
  const base = archetype?.baseStats || {
    maxHp: 96,
    resolveMax: 8,
    resolveRegen: 1,
    attack: 12,
    defense: 12,
    critRate: 5,
    dodgeRate: 5,
  };
  return {
    id: "wanderer",
    name: archetype?.character?.name || "You",
    maxHp: base.maxHp + bonus.maxHp,
    resolve: base.resolveMax + bonus.resolveMax,
    resolveMax: base.resolveMax + bonus.resolveMax,
    resolveRegen: base.resolveRegen + bonus.resolveRegen,
    stats: {
      attack: base.attack + bonus.attack,
      defense: base.defense + bonus.defense,
      critRate: Math.min(100, base.critRate + bonus.critRate),
      dodgeRate: Math.min(100, base.dodgeRate + bonus.dodgeRate),
    },
  };
}

function rejected(reason) {
  return { ok: false, reason, session: null, seed: null };
}

/**
 * Open a practice fight.
 *
 * Takes a compiled receipt and a scenario, and returns a session. There is deliberately no
 * argument through which campaign state, storage, or a narrator could reach it — practice
 * cannot write because it was never handed anything to write with.
 */
export function createPracticeSession(
  receipt,
  scenarioId = DEFAULT_PRACTICE_SCENARIO_ID,
  attemptIndex = 0,
  {
    skillRarities = null,
    keepsakeId = null,
    combatItemId = null,
    allyGroupId = DEFAULT_PRACTICE_ALLY_GROUP_ID,
  } = {},
) {
  if (!isCharacterBootstrapReceipt(receipt)) return rejected("invalid-bootstrap-receipt");
  const scenario = getPracticeScenario(scenarioId);
  if (!scenario) return rejected("unknown-practice-scenario");
  const allyGroup = getPracticeAllyGroup(allyGroupId);
  if (!allyGroup) return rejected("unknown-practice-ally-group");

  const rarities = normalizedPracticeSkillRarities(receipt, skillRarities);
  if (rarities === false) return rejected("invalid-practice-skill-rarities");
  // `combatItemId` is retained as a compatibility alias for older callers and replay tests.
  const selectedKeepsakeId = keepsakeId ?? combatItemId;
  if (selectedKeepsakeId !== null && !isStartingKeepsake(selectedKeepsakeId)) {
    return rejected("invalid-practice-keepsake");
  }
  const hash = draftHash(receipt, rarities, selectedKeepsakeId);
  const archetype = getStartingArchetype(receipt.archetypeId);
  const permanentItemId = permanentItemIdForKeepsake(selectedKeepsakeId);
  const itemIds = [...(archetype?.gear || []), ...(permanentItemId ? [permanentItemId] : [])];
  const selectedCombatItemId = combatItemIdForKeepsake(selectedKeepsakeId);
  const effectiveBuild = withPracticeSkillRarities(
    effectiveTowBuild(receipt.build, itemIds),
    receipt.build.skills,
    rarities,
  );
  const seed = derivePracticeSeed({
    packageId: receipt.professionId,
    scenarioId: scenario.id,
    scenarioVersion: scenario.version,
    allyGroupId: allyGroup.id,
    allyGroupVersion: allyGroup.version,
    draftHash: hash,
    attemptIndex,
  });
  if (!seed) return rejected("invalid-practice-seed");

  const opened = createTowRuntimeSession(TOW_V1_RUNTIME_IDENTITY, {
    sessionId: `practice:${scenario.id}:${allyGroup.id}:${hash}:${attemptIndex}`,
    rootSeed: seed,
    mode: "practice",
    player: practiceActor(receipt, selectedKeepsakeId),
    allies: allyGroup.allies.map((ally) => cloneJsonData(ally)),
    enemies: scenario.enemies.map((enemy) => cloneJsonData(enemy)),
    formations: {
      // Practice teaches the production rule: formation is chosen before combat and stays
      // fixed, while melee reach is blocked independently by the front unit in each lane.
      version: LOCKED_LANE_FORMATION_RULES_VERSION,
      player: [...allyGroup.formation],
      enemy: [...scenario.formation],
    },
    // Practice owns a disposable full Resolve snapshot rather than campaign resources.
    build: {
      ...effectiveBuild,
      skills: effectiveBuild.skills,
      combatItems: selectedCombatItemId ? [{ id: selectedCombatItemId, quantity: 1 }] : [],
    },
    context: {
      source: { kind: "practice", note: scenario.name },
      location: scenario.name,
      // Nothing is at stake because nothing is written; saying so in the admission keeps the
      // terminal resolver honest rather than relying on the mode flag.
      lethalPolicy: "nonlethal",
      playerStakes: "survivable",
      retreatPolicy: "allowed",
    },
  });
  if (!opened.ok) return rejected(opened.reason);

  return {
    ok: true,
    reason: null,
    session: opened.session,
    seed,
    scenario: { id: scenario.id, version: scenario.version, name: scenario.name },
    allyGroup,
    attemptIndex,
    draftHash: hash,
    genesisChecksum: gameplayChecksum(opened.session.genesis),
  };
}

/**
 * Everything the result screen has to show, and everything a bug report would need.
 *
 * Scenario version, seed, both checksums and the replay verdict are surfaced deliberately:
 * a practice result nobody can reproduce is a practice result nobody can act on.
 */
export function practiceResult(practice) {
  if (!practice?.ok) return null;
  const { session } = practice;
  const sealed = session.terminalReceipt
    ? { ok: true, session }
    : sealTowRuntimeTerminalReceipt(session);
  const settled = sealed.ok ? sealed.session : session;
  const receipt = settled.terminalReceipt;
  const verification = verifyTowRuntimeSession(settled);

  return {
    version: PRACTICE_SCENARIO_VERSION,
    scenarioId: practice.scenario.id,
    scenarioVersion: practice.scenario.version,
    allyGroupId: practice.allyGroup.id,
    allyGroupVersion: practice.allyGroup.version,
    seed: practice.seed,
    attemptIndex: practice.attemptIndex,
    draftHash: practice.draftHash,
    genesisChecksum: practice.genesisChecksum,
    terminalChecksum: receipt ? gameplayChecksum(receipt) : null,
    outcome: receipt ? receipt.reason : "unfinished",
    rounds: settled.encounter.round,
    replayVerified: verification.ok,
    replayDivergence: verification.divergence,
    chronicle: receipt ? buildCombatChronicle(settled, receipt) : null,
  };
}

/** The next attempt: a different fight, from a seed that is still derived and recorded. */
export function nextPracticeAttempt(practice) {
  if (!practice?.ok) return null;
  const attemptIndex = Math.min(MAX_PRACTICE_ATTEMPT, practice.attemptIndex + 1);
  return {
    scenarioId: practice.scenario.id,
    allyGroupId: practice.allyGroup.id,
    attemptIndex,
  };
}

/**
 * Prove practice left the draft alone.
 *
 * Compares a hash taken before entry against one taken after any exit path. Cheap, and it
 * turns "practice does not touch your draft" from a claim into something the code checks
 * every time it is used.
 */
export function draftUnchanged(before, after) {
  return Boolean(before) && before === after;
}
