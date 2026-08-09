export const MAX_SKILL_SLOTS = 3;

const COMMON_SKILL_SOURCE = Object.freeze({
  confidence: "secondary",
  date: "2023-08-08",
  url: "https://gall.dcinside.com/mgallery/board/view/?id=tow&no=5316",
});

export const EMERGENCY_EVASION = Object.freeze({
  id: "emergency-evasion",
  name: "Emergency Evasion",
  consumesTurn: false,
  target: "self",
  usesPerEncounter: 4,
  cooldown: 0,
  effect: Object.freeze({
    type: "apply-status",
    status: Object.freeze({ type: "evasion", duration: 1 }),
  }),
  evidence: COMMON_SKILL_SOURCE,
});

export const SLEEP_BOMB = Object.freeze({
  id: "sleep-bomb",
  name: "Sleep Bomb",
  consumesTurn: true,
  target: "enemy",
  usesPerEncounter: null,
  cooldown: 6,
  effect: Object.freeze({
    type: "apply-status",
    status: Object.freeze({ type: "sleep", duration: null, breakOnDamage: true }),
  }),
  evidence: COMMON_SKILL_SOURCE,
});

const SKILLS = Object.freeze({
  [EMERGENCY_EVASION.id]: EMERGENCY_EVASION,
  [SLEEP_BOMB.id]: SLEEP_BOMB,
});

export function getReferenceSkill(skillId) {
  return Object.hasOwn(SKILLS, skillId) ? SKILLS[skillId] : null;
}

export function createReferenceSkillState(skillId) {
  const definition = getReferenceSkill(skillId);
  if (!definition) throw new TypeError(`unknown-skill:${skillId}`);
  return {
    id: definition.id,
    usesRemaining: definition.usesPerEncounter,
    cooldownRemaining: 0,
    cooldownSetRound: null,
  };
}
