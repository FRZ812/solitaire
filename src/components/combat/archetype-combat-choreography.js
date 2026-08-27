import {
  combatVfxForIntent,
  combatVfxVariantForForm,
  combatVfxVariantForSkill,
} from "./archetype-combat-vfx.js";

const MOTION_PROFILES = Object.freeze({
  deliberate: Object.freeze({ windupMs: 560, recoveryMs: 1250, paceLabel: "Committed", windupVerb: "commits to" }),
  sequence: Object.freeze({ windupMs: 360, recoveryMs: 1160, paceLabel: "Sequence", windupVerb: "sets the rhythm for" }),
  guard: Object.freeze({ windupMs: 430, recoveryMs: 1050, paceLabel: "Guard", windupVerb: "sets their footing for" }),
  recovery: Object.freeze({ windupMs: 410, recoveryMs: 1030, paceLabel: "Recovery", windupVerb: "draws breath for" }),
  quick: Object.freeze({ windupMs: 260, recoveryMs: 840, paceLabel: "Quick", windupVerb: "finds the opening for" }),
  invocation: Object.freeze({ windupMs: 450, recoveryMs: 1120, paceLabel: "Invocation", windupVerb: "shapes" }),
  measured: Object.freeze({ windupMs: 370, recoveryMs: 980, paceLabel: "Measured", windupVerb: "measures the distance for" }),
});

const DELIBERATE_MOTIONS = new Set(["execution", "heavy", "inferno", "quake", "rolling"]);
const SEQUENCE_MOTIONS = new Set(["barrage", "cross", "cyclone", "flurry", "multi", "peal", "shadow-flurry", "volley"]);
const GUARD_MOTIONS = new Set(["brace", "counter", "curtain", "fortress", "unyielding"]);
const RECOVERY_MOTIONS = new Set(["mend", "siphon"]);
const QUICK_MOTIONS = new Set(["afterimage", "bolt", "flash", "fork", "pin", "projectile", "rapid", "snap", "thrust"]);
const INVOCATION_MOTIONS = new Set(["ascend", "aura", "bind", "brand", "charge", "fate", "radiant", "shout", "smoke", "summon", "void"]);

function profileForMotion(motion) {
  if (DELIBERATE_MOTIONS.has(motion)) return MOTION_PROFILES.deliberate;
  if (SEQUENCE_MOTIONS.has(motion)) return MOTION_PROFILES.sequence;
  if (GUARD_MOTIONS.has(motion)) return MOTION_PROFILES.guard;
  if (RECOVERY_MOTIONS.has(motion)) return MOTION_PROFILES.recovery;
  if (QUICK_MOTIONS.has(motion)) return MOTION_PROFILES.quick;
  if (INVOCATION_MOTIONS.has(motion)) return MOTION_PROFILES.invocation;
  return MOTION_PROFILES.measured;
}

function actionVisual(definition, weaponPresentation) {
  if (definition?.id === "strike") {
    const formId = weaponPresentation?.activeFormId || weaponPresentation?.attackSnapshot?.formId;
    const formVisual = formId ? combatVfxVariantForForm(formId) : null;
    if (formVisual) return formVisual;
  }
  return combatVfxVariantForSkill(definition?.id)
    || combatVfxForIntent({ attackId: definition?.id, name: definition?.name });
}

function actionTarget(definition) {
  const effects = definition?.effects || [];
  return effects.some((effect) => effect.target === "enemy" || [
    "damage",
    "damage-enemy-lost-hp",
    "scaled-status-enemy-lost-hp",
    "amplify-statuses",
  ].includes(effect.type)) ? "enemy" : "self";
}

/**
 * Presentation-only timing for a command. Mechanics still resolve through the encounter
 * kernel; this creates a readable anticipation/contact/recovery rhythm around that commit.
 */
export function combatChoreographyForAction(
  definition,
  weaponPresentation = null,
  { reducedMotion = false } = {},
) {
  const visual = actionVisual(definition, weaponPresentation);
  const profile = profileForMotion(visual.motion);
  const swift = definition?.consumesTurn === false;
  return {
    ...profile,
    visual,
    target: actionTarget(definition),
    windupMs: reducedMotion ? 70 : (swift ? Math.min(profile.windupMs, 280) : profile.windupMs),
    recoveryMs: reducedMotion ? 180 : (swift ? Math.min(profile.recoveryMs, 840) : profile.recoveryMs),
    paceLabel: swift ? "Swift" : profile.paceLabel,
  };
}
