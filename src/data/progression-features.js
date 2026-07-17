// Typed rewards emitted by profession and racial progression rows.  These are
// intentionally data-only: combat, crafting, social, and narrative systems can
// consume the same stable grant shape without progression importing them.
export const PROGRESSION_GRANT_TYPES = Object.freeze([
  "ability",
  "ability-choice",
  "metamagic-choice",
  "metamagic",
  "passive",
  "proficiency",
  "recipe",
  "action",
  "evolution",
]);

export const METAMAGIC_FEATURES = Object.freeze({
  "empowered-signature": Object.freeze({ id: "empowered-signature", name: "Empowered Signature", description: "Increase the force of the chosen signature spell." }),
  "shaped-signature": Object.freeze({ id: "shaped-signature", name: "Shaped Signature", description: "Reshape the signature spell around allies or into a different area." }),
  "quickened-signature": Object.freeze({ id: "quickened-signature", name: "Quickened Signature", description: "Cast the signature spell with less delay." }),
  "twinned-signature": Object.freeze({ id: "twinned-signature", name: "Twinned Signature", description: "Split the signature spell into two linked castings." }),
  "piercing-signature": Object.freeze({ id: "piercing-signature", name: "Piercing Signature", description: "Drive the signature spell through magical protection." }),
  "transmuted-signature": Object.freeze({ id: "transmuted-signature", name: "Transmuted Signature", description: "Exchange the signature spell's damage expression." }),
  "perfected-signature": Object.freeze({ id: "perfected-signature", name: "Perfected Signature", description: "The signature spell reaches its final personal form." }),
  "subtle-signature": Object.freeze({ id: "subtle-signature", name: "Subtle Signature", description: "Suppress the signature spell's ordinary voice, gesture, and harmless sensory display; this does not conceal its resolved consequences or bypass magical detection." }),
  "lingering-signature": Object.freeze({ id: "lingering-signature", name: "Lingering Signature", description: "Trade immediate force for one bounded additional interval of an eligible signature effect; instantaneous effects cannot be made permanent." }),
  "triggered-signature": Object.freeze({ id: "triggered-signature", name: "Triggered Signature", description: "Delay one prepared signature cast behind a declared observable trigger and short duration; only one triggered signature may be held at once." }),
  "reversible-signature": Object.freeze({ id: "reversible-signature", name: "Reversible Signature", description: "End or safely unwind the Sorcerer's own eligible ongoing signature effect before its normal expiry; harm already dealt is not restored." }),
});

const ACTION_IDS = [
  "wayfinding", "adapt-practice", "borrow-discipline", "speak-with-beasts", "wild-harvest",
  "captivate-audience", "recall-legend", "infuse-item", "salvage-enchantment", "craft-arcane-device",
  "read-the-room", "shelter-guests", "gather-rumours", "assess-crop", "husband-stock", "restore-land",
  "appraise-market", "broker-contract", "open-trade-route", "assess-material", "efficient-craft", "create-masterwork",
  "pace-the-work", "safe-lift", "organize-crew", "research-question", "decode-text", "teach-discipline",
  "diagnose", "stabilize", "perform-surgery", "prepare-remedy", "shift-mood", "create-masterpiece",
  "read-weather", "navigate-tide", "command-vessel", "read-intent", "mediate-dispute", "broker-treaty",
  "read-court", "trade-secret", "shape-reputation", "audit-stores", "coordinate-household", "restore-order",
  "issue-decree", "hold-court", "mobilize-realm", "assess-battlefield", "organize-company", "direct-campaign",
  "anticipate-need", "manage-routine", "protect-confidence",
  "raise-undead", "command-undead", "death-clutch", "grasp-heart",
];

const PASSIVE_IDS = ["adaptable", "tireless", "dragon-heart", "regeneration"];

function labelize(id) {
  return String(id).replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

// Non-combat actions and racial passives are first-class catalog entries, not
// decorative milestone strings. Consumers may attach mechanics incrementally
// while retaining a stable identity and player-facing explanation.
export const PROGRESSION_FEATURES = Object.freeze(Object.fromEntries([
  ...ACTION_IDS.map((id) => [id, Object.freeze({
    id,
    type: "action",
    name: labelize(id),
    description: `Unlocks the ${labelize(id).toLowerCase()} profession action.`,
  })]),
  ...PASSIVE_IDS.map((id) => [id, Object.freeze({
    id,
    type: "passive",
    name: labelize(id),
    description: `A racial progression passive: ${labelize(id).toLowerCase()}.`,
  })]),
]));

export function progressionGrant(type, id, details = {}) {
  if (!PROGRESSION_GRANT_TYPES.includes(type)) throw new Error(`Unknown progression grant type ${type}`);
  return Object.freeze({ type, id, ...details });
}

export function validateProgressionGrant(grant, { abilityExists = () => true } = {}) {
  if (!grant || !PROGRESSION_GRANT_TYPES.includes(grant.type)) return "invalid grant type";
  if (!grant.id && grant.type !== "ability-choice") return `${grant.type} grant has no id`;
  if (grant.type === "ability" && !abilityExists(grant.id)) return `unknown ability ${grant.id}`;
  if (grant.type === "ability-choice") {
    if (!Array.isArray(grant.options) || grant.options.length === 0) return "ability choice has no options";
    const missing = grant.options.find((id) => !abilityExists(id));
    if (missing) return `unknown ability ${missing}`;
  }
  if (grant.type === "metamagic" && !METAMAGIC_FEATURES[grant.id]) return `unknown metamagic ${grant.id}`;
  if (["action", "passive", "recipe"].includes(grant.type) && !PROGRESSION_FEATURES[grant.id] && !(grant.name && grant.description)) {
    return `unknown progression feature ${grant.id}`;
  }
  if (grant.type === "metamagic-choice") {
    if (!Array.isArray(grant.options) || grant.options.length === 0) return "metamagic choice has no options";
    const missing = grant.options.find((id) => !METAMAGIC_FEATURES[id]);
    if (missing) return `unknown metamagic ${missing}`;
  }
  return null;
}
