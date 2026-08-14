import { getStatusDefinition } from "../../gameplay/kernel/status-stack.js";
import { combatVfxForStatus } from "./tow-combat-vfx.js";

const STATUS_COPY = Object.freeze({
  protection: "Reduces each incoming hit by its Count before ward and health are touched.",
  steelskin: "Reduces every individual incoming hit by its Count.",
  evade: "Raises Dodge by 60% while at least one stack remains.",
  haste: "Adds one turn-consuming action per stack when the round's action budget is set.",
  "doom-atk": "Each attack inflicts Doom equal to its Count; Doom resolves after the enemy acts.",
  burn: "Deals fixed damage equal to its Count at the turn boundary, bypassing defence and ward.",
  unstoppable: "Prevents Sleep, Paralyze, and Stun from nullifying this combatant's action.",
  tenacity: "Adds its Count to Defence.",
  thorn: "Returns damage equal to its Count once for every incoming hit that resolves.",
  lifesteal: "Recovers health in proportion to damage dealt.",
  strength: "Adds its Count to Attack.",
  misfortune: "Deals damage equal to its Count at the beginning of the enemy turn.",
  poison: "Poison is tracked as a harmful Count; its exact source rule is not yet evidenced.",
  cripple: "Cripple is tracked as a harmful Count; its exact source rule is not yet evidenced.",
  charge: "Charge stores power as a Count for abilities that consume or transform it.",
  grow: "Grow records accumulating power as a Count.",
  overload: "Adds its Count to Attack until the end of the turn.",
  "poison-atk": "Adds poison pressure to attacks according to its Count.",
  weak: "Weak is tracked as a harmful Count; its exact source rule is not yet evidenced.",
  focus: "Focus records offensive precision as a Count.",
  solidity: "Reduces damage from attacks by 30% while at least one stack remains.",
  guard: "Reduces damage from attacks by 50% while at least one stack remains.",
  sharpen: "Sharpen records increased offensive accuracy as a Count.",
  eviscerate: "Eviscerate records execution pressure as a Count.",
  priority: "Each net stack grants one extra action before the enemy after opposing Priority cancels it.",
  doom: "Deals fixed damage equal to its Count after the affected side acts, bypassing defence and ward.",
  invincible: "Prevents damage from attacks while at least one stack remains.",
  conceal: "Raises Dodge by 80% while at least one stack remains.",
  sleep: "Automatically forfeits one command window per stack unless Unstoppable is present.",
  paralyze: "Automatically forfeits one command window per stack unless Unstoppable is present.",
  stun: "Automatically forfeits one command window per stack unless Unstoppable is present.",
  bleed: "Bleed records damage-over-time pressure as a Count.",
  "bleed-atk": "Adds Bleed pressure to attacks according to its Count.",
  lethargy: "Lethargy is tracked as a harmful Count; its exact source rule is not yet evidenced.",
  "lethargy-atk": "Adds Lethargy pressure to attacks according to its Count.",
  vulnerable: "Raises incoming attack damage by 1% per stack. For example, 12 Vulnerable means +12% damage received.",
  skeleton: "Skeleton records summoned support as a Count.",
  limp: "Limp records impaired movement as a Count.",
  berserk: "Raises attack damage and is spent by striking or being struck.",
  initiative: "Accumulates when attacking; every 100 Initiative converts into 1 Priority.",
  judgment: "Judgment stores temporary Doom-inflicting power for the next attack.",
});

const AFFLICTIONS = new Set([
  "bleed", "burn", "cripple", "doom", "lethargy", "limp", "misfortune",
  "paralyze", "poison", "sleep", "stun", "vulnerable", "weak",
]);

const CONTROL = new Set(["paralyze", "sleep", "stun"]);

function words(value) {
  return String(value || "Unknown")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function lifecycleText(definition, type) {
  if (CONTROL.has(type)) return "Loses 1 stack only when it automatically forfeits a command window.";
  if (type === "priority") return "A net stack is spent by each extra action it grants; opposing stacks remain cancelled.";
  if (!definition) return "Persists until a combat rule removes it.";
  const clauses = [];
  if (definition.permanent) clauses.push("Persists between turns");
  if (definition.removeAtEndOfTurn) clauses.push("removed at the end of the turn");
  if (definition.decreaseAtEndOfTurn) clauses.push("loses 1 stack at the end of the turn");
  if (definition.decreaseWhenHit) clauses.push("loses 1 stack when hit");
  if (clauses.length === 0) {
    return definition.lifecycleEvidence === "gap"
      ? "Its observed expiry is unresolved; it remains until another combat rule removes it."
      : "Persists until a combat rule removes it.";
  }
  const sentence = clauses.join("; ");
  return `${sentence[0].toUpperCase()}${sentence.slice(1)}.`;
}

function toneFor(type) {
  if (CONTROL.has(type)) return "control";
  if (AFFLICTIONS.has(type)) return "affliction";
  return "boon";
}

export function towStatusPresentation(status) {
  const type = String(status?.type || "unknown");
  const count = Number.isFinite(status?.count) ? status.count : 0;
  const tone = toneFor(type);
  return {
    count,
    countLabel: `${count} ${count === 1 ? "stack" : "stacks"}`,
    effect: STATUS_COPY[type] || `${words(type)} is tracked as a Count on this combatant.`,
    lifecycle: lifecycleText(getStatusDefinition(type), type),
    name: words(type),
    tone,
    toneLabel: tone === "boon" ? "Boon" : tone === "control" ? "Control" : "Affliction",
    visual: combatVfxForStatus(type),
  };
}
