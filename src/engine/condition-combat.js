// Bridges persistent character conditions (data/conditions.js) into the combat
// engine's status system. When a fight begins, the buffs and debuffs the player
// is carrying are seeded onto their combatant as real combat statuses / stat
// tweaks, so a Rallied, Cursed, or Blessed character actually fights that way.
//
// This is a SNAPSHOT for the fight only — it does not change character.conditions
// (applyCombatResult preserves those), so a wound carried in is still carried out.
// Combat statuses tick down in TURNS; the durations below are turn counts.

import { condNames } from "../data/conditions.js";

const D = 6;       // a carried-in effect that lasts the opening exchanges
const PERSIST = 99; // an ongoing aura/affliction that holds for the whole fight

// Per-condition seed. A function of the built combatant (so guard/ward can scale
// off the fighter's own armour/ward) returning combat statuses to add and/or
// additive field tweaks. Field keys: dr, ward, healPower, controlResist (added),
// actionsPerTurn (added, also raises actionsLeft), invuln (max), resolveRegen
// (added into triggers). Combat-only — need conditions are handled elsewhere
// (Exhausted via the `weary` flag), so they're intentionally absent here.
const SEEDS = {
  // ---------------- Debuffs ----------------
  Bleeding:        () => ({ statuses: [{ type: "bleed", value: 3, duration: 5 }] }),
  Burning:         () => ({ statuses: [{ type: "burn", value: 4, duration: 3 }] }),
  Poisoned:        () => ({ statuses: [{ type: "poison", value: 2, duration: D }] }),
  Infected:        () => ({ statuses: [{ type: "poison", value: 1, duration: D }] }),
  "Festering Wound": () => ({ statuses: [{ type: "poison", value: 1, duration: D }] }),
  Diseased:        () => ({ statuses: [{ type: "poison", value: 1, duration: PERSIST }] }),
  "Plague-Ridden": () => ({ statuses: [{ type: "poison", value: 3, duration: PERSIST }] }),
  "Withering Curse": () => ({ statuses: [{ type: "curse", value: 20, duration: PERSIST }, { type: "poison", value: 2, duration: PERSIST }] }),

  Bruised:    () => ({ statuses: [{ type: "weaken", value: 8, duration: D }] }),
  Winded:     () => ({ statuses: [{ type: "chill", value: 8, duration: 3 }] }),
  Weakened:   () => ({ statuses: [{ type: "weaken", value: 25, duration: 5 }] }),
  Enfeebled:  () => ({ statuses: [{ type: "weaken", value: 35, duration: D }] }),
  Frightened: () => ({ statuses: [{ type: "weaken", value: 15, duration: 4 }] }),
  Chilled:    () => ({ statuses: [{ type: "chill", value: 10, duration: 4 }] }),
  Dazed:      () => ({ statuses: [{ type: "chill", value: 8, duration: 3 }] }),
  Blinded:    () => ({ statuses: [{ type: "chill", value: 40, duration: 3 }] }),
  Vulnerable: () => ({ statuses: [{ type: "vulnerable", value: 25, duration: 4 }] }),
  Hexed:      () => ({ statuses: [{ type: "vulnerable", value: 10, duration: 5 }] }),
  Cursed:     () => ({ statuses: [{ type: "curse", value: 25, duration: D }] }),
  Damned:     () => ({ statuses: [{ type: "curse", value: 25, duration: PERSIST }] }),
  Slowed:     () => ({ statuses: [{ type: "slow", value: 0, duration: 4 }] }),
  Stunned:    () => ({ statuses: [{ type: "stun", value: 0, duration: 1 }] }),
  Silenced:   () => ({ statuses: [{ type: "silence", value: 0, duration: 3 }] }),
  Charmed:    () => ({ statuses: [{ type: "charmed", value: 1, duration: 3 }] }),
  Dominated:  () => ({ statuses: [{ type: "dominated", value: 1, duration: 2 }] }),
  Petrified:  () => ({ statuses: [{ type: "stun", value: 0, duration: 3 }] }),
  "Severed Limb":    () => ({ statuses: [{ type: "weaken", value: 20, duration: PERSIST }] }),
  "Gravely Wounded": () => ({ statuses: [{ type: "weaken", value: 12, duration: PERSIST }, { type: "vulnerable", value: 10, duration: PERSIST }] }),
  Doomed:     () => ({ statuses: [{ type: "vulnerable", value: 15, duration: PERSIST }] }),

  // ---------------- Buffs ----------------
  "Well-Fed": () => ({ statuses: [{ type: "regen", value: 1, duration: PERSIST }] }),
  Rested:     () => ({ statuses: [{ type: "regen", value: 2, duration: PERSIST }] }),
  Rallied:    () => ({ statuses: [{ type: "rally", value: 20, duration: D }] }),
  Focused:    () => ({ statuses: [{ type: "focus", value: 20, duration: PERSIST }] }),
  Emboldened: () => ({ statuses: [{ type: "rally", value: 5, duration: D }], fields: { controlResist: 0.15 } }),
  Guarded:    (c) => ({ statuses: [{ type: "guard", value: Math.max(4, Math.round((c.armor || 0) * 0.3)), duration: D }] }),
  Blessed:    () => ({ statuses: [{ type: "regen", value: 3, duration: PERSIST }, { type: "guard", value: 3, duration: PERSIST }] }),
  Inspired:   () => ({ statuses: [{ type: "focus", value: 8, duration: D }], fields: { resolveRegen: 2 } }),
  Regenerating: () => ({ statuses: [{ type: "regen", value: 5, duration: PERSIST }] }),
  Hardy:      () => ({ fields: { dr: 0.1 } }),
  Warded:     (c) => ({ fields: { ward: Math.max(5, Math.round((c.ward || 0) * 0.5)) } }),
  Hastened:   () => ({ statuses: [{ type: "dodgeStack", value: 10, duration: D }], fields: { actionsPerTurn: 1 } }),
  Empowered:  () => ({ statuses: [{ type: "rally", value: 15, duration: D }] }),
  Heroic:     () => ({ statuses: [{ type: "rally", value: 15, duration: PERSIST }, { type: "guard", value: 5, duration: PERSIST }, { type: "regen", value: 3, duration: PERSIST }] }),
  Anointed:   () => ({ statuses: [{ type: "regen", value: 3, duration: PERSIST }], fields: { healPower: 0.5, ward: 6 } }),
  "Divine Favor": () => ({ statuses: [{ type: "rally", value: 20, duration: PERSIST }, { type: "guard", value: 10, duration: PERSIST }, { type: "regen", value: 5, duration: PERSIST }], fields: { dr: 0.15 } }),
  Berserk:    () => ({ statuses: [{ type: "rally", value: 40, duration: D }, { type: "vulnerable", value: 20, duration: D }] }),
  "Dragon-Heart": () => ({ statuses: [{ type: "rally", value: 20, duration: PERSIST }, { type: "regen", value: 8, duration: PERSIST }], fields: { dr: 0.2 } }),
  Ascendant:  () => ({ statuses: [{ type: "rally", value: 50, duration: PERSIST }, { type: "guard", value: 20, duration: PERSIST }, { type: "regen", value: 10, duration: PERSIST }], fields: { dr: 0.3, invuln: 2 } }),
};

// Does this condition have a defined combat effect? (For the codex, to show a tag.)
export function hasCombatEffect(name) { return !!SEEDS[name]; }

// Apply every carried condition's combat seed onto a freshly-built combatant.
// Mutates and returns the combatant.
export function seedConditionStatuses(combatant, conditions) {
  for (const name of condNames(conditions)) {
    const fn = SEEDS[name];
    if (!fn) continue;
    const spec = fn(combatant) || {};
    for (const s of (spec.statuses || [])) {
      combatant.statuses = combatant.statuses || [];
      combatant.statuses.push({ type: s.type, value: s.value || 0, duration: s.duration || 1, pctMax: !!s.pctMax });
    }
    for (const [k, v] of Object.entries(spec.fields || {})) {
      if (k === "actionsPerTurn") {
        combatant.actionsPerTurn = (combatant.actionsPerTurn || 1) + v;
        combatant.actionsLeft = combatant.actionsPerTurn;
      } else if (k === "invuln") {
        combatant.invuln = Math.max(combatant.invuln || 0, v);
      } else if (k === "resolveRegen") {
        combatant.triggers = { ...(combatant.triggers || {}), resolveRegen: (combatant.triggers?.resolveRegen || 0) + v };
      } else {
        combatant[k] = (combatant[k] || 0) + v;
      }
    }
  }
  return combatant;
}
