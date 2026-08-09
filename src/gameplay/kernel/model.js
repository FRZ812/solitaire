import { createRng } from "./rng.js";
import { REFERENCE_POLICY } from "../reference/policy.js";
import { createReferenceSkillState, MAX_SKILL_SLOTS } from "../reference/skills.js";

function finiteNonNegative(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new TypeError(`invalid-${label}`);
  return number;
}

function actor(input, side) {
  if (!input?.id || !input?.name) throw new TypeError("invalid-actor");
  const maxHp = finiteNonNegative(input.maxHp, "max-hp");
  if (maxHp <= 0) throw new TypeError("invalid-max-hp");
  const hp = Math.min(maxHp, finiteNonNegative(input.hp, "hp"));
  const skillIds = side === "player" ? [...(input.skills || [])] : [];
  if (skillIds.length > MAX_SKILL_SLOTS) throw new TypeError("too-many-skills");
  return {
    id: input.id,
    name: input.name,
    side,
    hp,
    maxHp,
    guard: finiteNonNegative(input.guard ?? 0, "guard"),
    stats: {
      attack: finiteNonNegative(input.stats?.attack ?? 0, "attack"),
      defense: finiteNonNegative(input.stats?.defense ?? 0, "defense"),
    },
    actions: [...(input.actions || [])],
    skills: skillIds.map(createReferenceSkillState),
    statuses: JSON.parse(JSON.stringify(input.statuses || [])),
    ...(input.intent ? { intent: JSON.parse(JSON.stringify(input.intent)) } : {}),
  };
}

export function createEncounter({ seed, player, enemy }) {
  const playerActor = actor(player, "player");
  const enemyActor = actor(enemy, "enemy");
  if (!enemyActor.intent?.id || enemyActor.intent.targetId !== playerActor.id) {
    throw new TypeError("invalid-enemy-intent");
  }
  return {
    version: 1,
    baselineVersion: REFERENCE_POLICY.id,
    phase: "player",
    round: 1,
    sequence: 0,
    rng: createRng(seed),
    playerId: playerActor.id,
    enemyIds: [enemyActor.id],
    actors: {
      [playerActor.id]: playerActor,
      [enemyActor.id]: enemyActor,
    },
    events: [],
  };
}
