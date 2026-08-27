// Combat → campaign-state folding — extracted from combat.js (Stage 1). This is
// the bridge layer: applyCombatResult/applyLoot take the finished combat state
// (`cs`) plus the campaign `state` and return a new campaign state (HP, wounds,
// spoils, learned ability, thralls). It depends only on data tables + economy,
// not on the resolver, so App.jsx imports these directly from here.
import { effectiveAttributes, ratingFromXp, proficiencyName } from "../data/proficiencies.js";
import { ATTR_KEYS, ATTR_LABELS } from "../config.js";
import { condNames, normalizeConditions } from "../data/conditions.js";
import { getAbilityDef } from "../data/abilities.js";
import { tierLabel, tier as tierInfo } from "../data/tiers.js";
import { coinsToCopper, copperToCoins } from "./economy.js";
import { advanceProgression, earnedLevelGrowthText, normalizeCharacterProgression } from "./progression.js";
import { carryCapacityFor, maxVitalityFor, recomputeResolveMax } from "./attributes.js";

// Tiny local copies of combat.js's shared helpers — kept local so this module
// has no import back into combat.js (which would cycle). Stage 2 consolidates
// these into a shared combat-core sink.
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const clone = (x) => JSON.parse(JSON.stringify(x));
const hasStatus = (c, type) => (c.statuses || []).some((s) => s.type === type);

// Fold a finished combat back into the campaign state: HP, lingering wounds as
// conditions, loot into inventory/codex, and a learned ability. Returns a new
// state with summary beats appended.
export function applyCombatResult(state, cs, context = {}) {
  const next = clone(state);
  const beats = [];
  const now = Date.now();

  next.character.vitality = clamp(Math.round(cs.player.health), 0, next.character.vitalityMax);
  if (cs.phase === "defeat") next.character.vitality = Math.max(1, next.character.vitality);

  // Proficiency XP earned this fight raises use-based mastery and feeds the
  // global character-level reserve. The player decides later whether each
  // earned level advances racial evolution or a profession.
  if (cs.profGains && Object.keys(cs.profGains).length) {
    const beforeProf = { ...(next.character.proficiencies || {}) };
    const beforeEff = effectiveAttributes(next.character);
    const profLines = [];
    next.character.proficiencies = { ...beforeProf };
    for (const [id, xp] of Object.entries(cs.profGains)) {
      const before = beforeProf[id] || 0;
      const after = before + xp;
      next.character.proficiencies[id] = after;
      const r0 = ratingFromXp(before), r1 = ratingFromXp(after);
      if (r1 > r0) profLines.push(`${proficiencyName(id)} ${r0} → ${r1}`);
    }
    const afterEff = effectiveAttributes(next.character);
    const attrLines = [];
    for (const k of ATTR_KEYS) if (afterEff[k] > beforeEff[k]) attrLines.push(`${ATTR_LABELS[k]} ${beforeEff[k]} → ${afterEff[k]}`);
    if (profLines.length) beats.push({ id: `pg${now}`, type: "growth", text: profLines.join(" · ") });
    if (attrLines.length) beats.push({ id: `ag${now}`, type: "growth", text: `Attributes — ${attrLines.join(" · ")}` });

    const progressionXp = Object.values(cs.profGains)
      .reduce((sum, xp) => sum + Math.max(0, Number(xp) || 0), 0) * 10;
    const progress = advanceProgression(next.character, progressionXp);
    if (progress.earnedLevels > 0) {
      beats.push({
        id: `cl${now}`,
        type: "growth",
        text: earnedLevelGrowthText(progress),
      });
    }
    const wanderer = next.world.codex.characters?.wanderer;
    if (wanderer && next.character.progression) {
      next.world.codex.characters.wanderer = {
        ...wanderer,
        profession: next.character.profession,
        archetype: next.character.archetype,
        attributes: { ...(next.character.attributes || {}) },
        progression: {
          ...next.character.progression,
          paths: { ...next.character.progression.paths },
        },
      };
    }
  }
  // Spent Resolve (spellcasting drain) persists out of the fight.
  if (typeof cs.player.resolve === "number") {
    next.character.resolve = clamp(Math.round(cs.player.resolve), 0, next.character.resolveMax);
  }

  const conds = new Set(condNames(next.character.conditions));
  if (hasStatus(cs.player, "bleed")) conds.add("Bleeding");
  if (hasStatus(cs.player, "poison")) conds.add("Poisoned");
  if (cs.phase === "defeat") { conds.add("Gravely Wounded"); conds.add("Bleeding"); }
  next.character.conditions = normalizeConditions(Array.from(conds));

  // The detailed aftermath is narrated by the narrator ([COMBAT OVER]/[DEFEATED])
  // right after this, so we only drop a brief lead-in for defeat.
  if (cs.phase === "defeat") {
    beats.push({ id: `cb${now}`, type: "narration", content: `The fight goes against you. A last blow lands, your legs fold, and the world tips into black.` });
  }

  // Spoils are NOT auto-granted. Only actual corpses carry anything, and even
  // then the player must deliberately Search the fallen (a timed, public act the
  // narrator can complicate). Stash what's available for that choice.
  const loot = cs.loot;
  const deadCount = cs.enemies.filter((e) => e._dead).length;
  const hasSpoils = loot && deadCount > 0 && ((loot.items && loot.items.length) || loot.ability || loot.coins.silver || loot.coins.copper || loot.coins.gold);
  next.pendingLoot = hasSpoils ? { ...loot, deadCount, flavor: context.flavor || cs.enemies[0]?.name || "the fallen" } : null;

  // Persist named foes' combat state so a re-fight continues from their wounds
  // (no full-HP reset) and a foe who yielded/died stays that way.
  for (const e of cs.enemies) {
    if (!e.npcId) continue;
    const ch = next.world.codex.characters?.[e.npcId];
    if (!ch) continue;
    const status = e._dead ? "dead" : e.resolved === "yielded" ? "yielded" : (e.resolved === "fled" || e.fleeing) ? "fled" : (e.health < e.maxHealth ? "wounded" : "ok");
    ch.combatState = { health: Math.max(0, Math.ceil(e.health)), maxHealth: e.maxHealth, status };
  }

  // A companion slain in a lethal fight is gone — mark the codex character dead
  // and remove them from the party. (Survivors recover fully; we don't carry
  // their wounds, so attrition can't slowly doom the whole company.)
  const fallen = (cs.allies || []).filter((a) => a._dead && a.companionId);
  if (fallen.length) {
    const fallenIds = new Set(fallen.map((a) => a.companionId));
    next.party = (next.party || []).filter((id) => !fallenIds.has(id));
    const chars = next.world.codex.characters || {};
    for (const a of fallen) {
      const ch = chars[a.companionId];
      if (ch) ch.combatState = { health: 0, maxHealth: a.maxHealth, status: "dead" };
      // Falling clears the saddle: a dead mount drops its riders, a dead rider
      // leaves its seat (engine/riding.js linkage).
      const dead = chars[a.companionId];
      if (dead) {
        if (dead.ridingOn && chars[dead.ridingOn]) chars[dead.ridingOn].riders = (chars[dead.ridingOn].riders || []).filter((x) => x !== a.companionId);
        dead.ridingOn = null;
        for (const rid of [...(dead.riders || [])]) if (chars[rid]) chars[rid].ridingOn = null;
        dead.riders = [];
      }
    }
    // If the player's mount fell, the player is afoot now too.
    const w = chars.wanderer;
    if (w?.ridingOn && fallenIds.has(w.ridingOn)) w.ridingOn = null;
  }

  // DOMINATED THRALLS — a foe the player permanently enthralled (Dominate landed)
  // joins the party and persists OUTSIDE combat, bound until the binder (wanderer)
  // dies/releases it or a Dispel breaks it. File a codex character from its combat
  // stats + a permanent Enthralled condition. (Thralls slain in the fight are skipped.)
  {
    const chars = next.world.codex.characters || (next.world.codex.characters = {});
    for (const a of (cs.allies || [])) {
      if (a.enthralledBy !== "p" || a.companionId || a._dead || a.health <= 0) continue;
      const tid = a.npcId || a.id || `thrall-${Math.random().toString(36).slice(2, 8)}`;
      if (chars[tid]) { if (!(next.party || []).includes(tid)) next.party = [...(next.party || []), tid]; continue; }
      const hadGear = (a.gear || []).length > 0;
      const charmed = a.bindKind === "charm"; // divine Charm — devoted, not leashed
      const exactFocus = a.archetype || a.profession || a.kind || String(a.name || "bound-combatant").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const entry = {
        id: tid, kind: "thrall", name: a.name, race: a.race || null,
        profession: a.profession || (hadGear ? "soldier" : "hunter"),
        archetype: exactFocus,
        ...(Number.isFinite(Number(a.level)) ? { level: Number(a.level) } : {}),
        attributes: { ...(a.attrs || {}) },
        worn: hadGear ? a.gear.map((g) => g.id) : [],
        naturalWeapon: hadGear ? null : (a.naturalWeaponSpec || null),
        abilities: (a.abilities || []).map((x) => x.id),
        // Charm rewrites the heart (artificial devotion → high relationship); Dominate
        // is only a leash (attitude unchanged). Both are bound until the binder frees them.
        conditions: [{ name: charmed ? "Charmed" : "Enthralled", remaining: null, by: "wanderer" }],
        relationship: charmed ? 80 : 0,
        enthralledBy: "wanderer",
      };
      const rawPeak = Math.max(0, ...Object.values(entry.attributes).map((value) => Number(value) || 0));
      normalizeCharacterProgression(entry, {
        convertLegacyAttributes: rawPeak <= 30,
        enforceLevelAttributeScale: true,
        alignAttributesToProgression: rawPeak <= 30,
      });
      const progressedMaxHealth = maxVitalityFor(entry);
      const remainingRatio = a.maxHealth > 0 ? Math.max(0, Math.min(1, a.health / a.maxHealth)) : 1;
      entry.combatState = {
        health: Math.max(1, Math.round(progressedMaxHealth * remainingRatio)),
        maxHealth: progressedMaxHealth,
        status: remainingRatio < 1 ? "wounded" : "ok",
      };
      recomputeResolveMax(entry);
      entry.carryCapacityMax = carryCapacityFor(entry);
      chars[tid] = entry;
      if (!(next.party || []).includes(tid)) next.party = [...(next.party || []), tid];
    }
  }

  // Hand the narrator a blow-by-blow account so the fight can be referenced
  // afterward (and so a [DEFEATED] follow-up knows exactly what happened).
  next.apiHistory = [...(next.apiHistory || []), { role: "user", content: buildCombatRecap(cs, context) }];

  next.beats = [...next.beats, ...beats];
  return next;
}

// Deliberately loot the fallen (the player chose to search the corpses). Grants
// the stashed spoils, records what was taken, and returns { state, taken } so
// the caller can narrate it + adjudicate fallout. Clears pendingLoot.
export function applyLoot(state, manifest) {
  const next = clone(state);
  next.pendingLoot = null;
  const beats = [];
  const now = Date.now();
  if (!manifest) return { state: { ...next, beats: [...next.beats] }, taken: "" };

  next.world.codex.items = { ...next.world.codex.items };
  const invLines = [];
  const takenParts = [];
  for (const it of (manifest.items || [])) {
    if (it.entry) next.world.codex.items[it.itemId] = it.entry;
    const existing = next.character.inventory.carried.find((c) => c.itemId === it.itemId);
    if (existing) existing.quantity += it.quantity || 1;
    else next.character.inventory.carried.push({ itemId: it.itemId, quantity: it.quantity || 1 });
    invLines.push(`+${it.quantity || 1}× ${it.entry?.name || it.itemId}`);
    takenParts.push(it.entry?.name || it.itemId);
  }
  // Add the spoils' coin to the purse in copper, then re-express canonically so
  // the purse never accumulates >9 of a lower denomination (the manifest's coins
  // are already canonical, coming from rollLoot → copperToCoins).
  const coins = manifest.coins || {};
  next.character.inventory.coins = copperToCoins(coinsToCopper(next.character.inventory.coins) + coinsToCopper(coins));
  const coinParts = [];
  if (coins.gold) coinParts.push(`+${coins.gold}gp`);
  if (coins.silver) coinParts.push(`+${coins.silver}sp`);
  if (coins.copper) coinParts.push(`+${coins.copper}cp`);
  if (coinParts.length) { invLines.push(coinParts.join(", ")); takenParts.push(coinParts.join(", ")); }
  if (invLines.length) beats.push({ id: `lt${now}`, type: "inventory_delta", lines: invLines });

  if (manifest.ability) {
    next.character.abilities = Array.isArray(next.character.abilities) ? [...next.character.abilities] : [];
    next.character.abilities.push({ id: manifest.ability.id, tier: manifest.ability.tier });
    const def = getAbilityDef(manifest.ability.id);
    next.world.codex.skills = { ...next.world.codex.skills };
    next.world.codex.skills[manifest.ability.id] = {
      id: manifest.ability.id, name: `${manifest.ability.name} (${tierLabel(manifest.ability.tier)})`,
      description: def?.desc || "A combat ability.", rating: tierInfo(manifest.ability.tier).order + 1,
      combatAbility: true, tier: manifest.ability.tier,
    };
    beats.push({ id: `la${now}`, type: "discovery", items: [{ kind: "ability", name: `${manifest.ability.name} · ${tierLabel(manifest.ability.tier)}` }] });
    takenParts.push(`the technique ${manifest.ability.name}`);
  }

  next.beats = [...next.beats, ...beats];
  return { state: next, taken: takenParts.join(", ") };
}

function buildCombatRecap(cs, context) {
  const outcome =
    cs.standoff ? "it ground to a STALEMATE — neither side could best the other, and both broke off in a wary, exhausted draw (no victor, no spoils)" :
    cs.phase === "victory" ? "you won" :
    cs.phase === "defeat" ? "you were beaten down and went under" :
    cs.phase === "resolved" ? "it ended without a slaughter" :
    cs.phase === "playerFled" ? "you broke off and fled" : "it ended";
  // Fate is the foe's ACTUAL resolution, not raw HP — a foe that yielded, fled,
  // or was knocked out is ALIVE even at 0-ish health, and must never be narrated
  // (or have a companion narrated) as killed.
  const foes = cs.enemies.map((e) => {
    const st = e.executed ? "EXECUTED — cut down by the player AFTER it had surrendered, disarmed and defenceless (a cold, deliberate killing)"
      : e._dead ? "slain in the fighting"
      : e.resolved === "yielded" ? "YIELDED then SPARED — alive, disarmed, a captive at the player's mercy (do NOT kill it)"
      : e.resolved === "fled" ? "FLED — escaped alive, off the field"
      : e.fleeing ? "FLEEING — broke and ran"
      : e.resolved === "ko" ? "knocked out — alive, unconscious"
      : e.health <= 0 ? "down, gravely wounded but not dead"
      : `still standing (${Math.ceil(e.health)}/${e.maxHealth})`;
    return `${e.name} [${e.tier}, ${e.demeanor}] — ${st}`;
  }).join("; ");
  const executeNote = cs.executedCount
    ? ` NOTE: the player EXECUTED ${cs.executedCount} foe${cs.executedCount === 1 ? "" : "s"} who had already surrendered and were defenceless — a cold, ugly act. Any companions and witnesses should react accordingly (unease, horror, judgement, fear of the player), and it may stain the player's standing or conscience.`
    : "";
  const spareNote = cs.spared ? " The player SPARED the foe(s) who yielded — they live, disarmed and at the player's mercy (captive, free to be questioned, ransomed, recruited, or released)." : "";
  const account = cs.log
    .filter((l) => !/^—\s*Turn/.test(l.text))
    .slice(-22)
    .map((l) => l.text)
    .join(" ");
  const magicNote = cs.magicCast
    ? " NOTE: the player WORKED MAGIC in this fight — magic is rare and dreaded, so any ordinary folk who witnessed it should react with shock, panic, even cries of witchcraft, far beyond their reaction to mere violence."
    : "";
  const n = cs.enemies.length;
  const allies = (cs.allies || []);
  const allyNote = allies.length
    ? ` Fighting at your side: ${allies.map((a) => `${a.name} (${a._dead ? "slain" : a.resolved === "ko" ? "knocked out" : a.health < a.maxHealth ? `wounded, ${Math.ceil(a.health)}/${a.maxHealth}` : "unhurt"})`).join("; ")}.`
    : "";
  return `[COMBAT REPORT] ${context.flavor || "A fight"} — ${outcome}. You fought exactly ${n} foe${n === 1 ? "" : "s"} (this is the full roster — narrate only these, by these EXACT fates): ${foes}.${allyNote} Honour each fate precisely: do NOT kill a foe that yielded, fled, or was knocked out, do not have a companion finish one off, and do not raise, revive, or invent foes. Only foes marked "slain" or "executed" died.${executeNote}${spareNote} You ended at ${Math.ceil(cs.player.health)}/${cs.player.maxHealth} HP. Blow-by-blow: ${account}.${magicNote}`.slice(0, 1800);
}
