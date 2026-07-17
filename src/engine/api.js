// State-context builders shared by both narrator backends (api-anthropic.js for
// the artifact build, api-supabase.js for the web build). The narrator call
// itself lives in those files; this module is helpers only.
import { ATTR_KEYS, ATTR_LABELS, originLabel, AERIAL_SIGHTING_DAYS } from "../config.js";
import { effectiveAttributes } from "../data/proficiencies.js";
import { attrDescriptor } from "../data/attribute-tiers.js";
import { getAbilityDef, ABILITY_CATALOG, abilityCategoryOf } from "../data/abilities.js";
import { ALL_ITEMS } from "../data/catalog.js";
import { tierOrder } from "../data/tiers.js";
import { TERRAINS } from "../data/terrains.js";
import { RUMORED } from "../data/rumored.js";
import { summarizeFabled } from "../data/fabled.js";
import { getTile, isSeen, HEX_DIRECTIONS, hexDistance, currentLocationName } from "./world.js";
import { poiMeta, poiPlaceName } from "./location.js";
import { hostileProfile } from "./encounters.js";
import { getBiome } from "../data/biomes.js";
import { ecologyDefinition } from "../data/continent.js";
import { buildingForTile, isBuildingOpen, buildingHours } from "../data/town.js";
import { formatTime, formatDate } from "./time.js";
import { relationshipTier } from "./relationships.js";
import { lightStatus } from "./light.js";
import { conditionMeta, condName } from "../data/conditions.js";
import { characterArchetype } from "../data/character-archetypes.js";
import { professionProfile } from "../data/progression-paths.js";
import { playableCharactersNear } from "./positions.js";
import { progressionLevel } from "./progression.js";
import { progressionNarrativeProjection } from "./progression-abilities.js";
import { summarizeMemoryBank } from "./memory.js";
import { buildNarratorSteering } from "./narrator-settings.js";

const rankTotal = (paths) => Object.values(paths || {})
  .reduce((total, rank) => total + Math.max(0, Math.floor(Number(rank) || 0)), 0);
const progressionLabel = (value) => String(value || "")
  .replace(/[-_]+/g, " ")
  .replace(/\b\w/g, (letter) => letter.toUpperCase());
const progressionProfessionName = (value) => professionProfile(value)?.name || progressionLabel(value);

// Character power labels are intentionally absent. The narrator receives the
// exact numeric allocation so it can honor multiclass and metamorphosis fiction
// without turning internal population thresholds into public titles.
export function summarizeProgressionAllocation(character) {
  const progression = character?.progression || {};
  const racialLevel = rankTotal(progression.racial?.paths);
  const professions = Array.isArray(progression.professions)
    ? progression.professions.map((entry) => ({
        professionId: entry.professionId,
        specializationId: entry.specializationId || entry.archetypeId || null,
        levels: rankTotal(entry.paths),
        specializationPath: entry.specializationPath || entry.specializationPathId
          || entry.choices?.specializationPath || null,
        branchChoices: entry.branchChoices && typeof entry.branchChoices === "object"
          ? Object.entries(entry.branchChoices).map(([choiceId, optionId]) => `${choiceId}=${optionId}`)
          : [],
      })).filter((entry) => entry.professionId && entry.levels > 0)
    : [];
  const professionLevel = professions.reduce((sum, entry) => sum + entry.levels, 0);
  const totalLevel = Math.max(1, progressionLevel(character));
  const professionText = professions.length
    ? professions.map((entry) => {
        const branches = [entry.specializationPath, ...entry.branchChoices].filter(Boolean);
        return `${progressionProfessionName(entry.professionId)}${entry.specializationId ? ` (${progressionLabel(entry.specializationId)})` : ""} ${entry.levels}${branches.length ? `; layered branches ${branches.join(" > ")}` : "; general profession progression"}`;
      }).join(" + ")
    : `${progressionProfessionName(progression.professionId || character?.profession || "wanderer")} ${Math.max(0, totalLevel - racialLevel)}`;
  return {
    totalLevel,
    racialLevel,
    professionLevel: professions.length ? professionLevel : Math.max(0, totalLevel - racialLevel),
    professionText,
  };
}

export function summarizeCodex(codex) {
  const lines = [];
  const chars = Object.values(codex.characters).filter(c => c.kind !== "player");
  const roster = chars.filter((c) => c.playable);
  const encountered = chars.filter((c) => !c.playable);
  if (encountered.length) lines.push(`Met: ${encountered.map((c) => {
    const archetype = characterArchetype(c);
    const allocation = summarizeProgressionAllocation(c);
    return `${c.name}(${c.race || "?"}, ${c.profession ? progressionProfessionName(c.profession) : "?"}${archetype ? `/${archetype.label}` : ""}, level ${allocation.totalLevel} = racial ${allocation.racialLevel} + professions ${allocation.professionLevel})`;
  }).join("; ")}`);
  else lines.push(`Met: only you`);
  if (roster.length) lines.push(`World roster (known dossiers, not automatically met): ${roster.map((c) => c.name).join(", ")}`);
  const races = Object.values(codex.races).map(r => r.common ? `${r.name}*` : r.name);
  lines.push(`Races: ${races.join(", ") || "none"}`);
  const profs = Object.values(codex.professions).map(p => `${p.id}:${p.name}${p.common ? "*" : ""}`);
  lines.push(`Professions: ${profs.join(", ") || "none"}`);
  const spells = Object.values(codex.spells).map(s => s.name);
  if (spells.length) lines.push(`Spells: ${spells.join(", ")}`);
  const skills = Object.values(codex.skills).map(s => `${s.name}(${s.rating ?? "?"})`);
  if (skills.length) lines.push(`Skills: ${skills.join(", ")}`);
  lines.push(`(*=baseline)`);
  return lines.join("; ");
}

export function summarizeInventory(character, codex, day = 0) {
  const inv = character.inventory;
  const carried = inv.carried.map(c => {
    const base = `${c.quantity}× ${codex.items[c.itemId]?.name || c.itemId}`;
    if (c.freshUntil == null) return base;
    const left = c.freshUntil - day;
    if (left <= 0) return `${base} (spoiling)`;
    if (left <= 3) return `${base} (${left}d to spoil)`;
    return base;
  });
  const wornIds = codex.characters.wanderer?.worn || [];
  const worn = wornIds.map(id => codex.items[id]?.name || id);
  return `Pack: ${carried.join(", ") || "nothing"}. Worn: ${worn.join(", ") || "nothing"}. Coins: ${inv.coins.copper}cp/${inv.coins.silver}sp/${inv.coins.gold}gp.`;
}

export function summarizeAttributes(attrs) {
  // Each score carries its named tier (the system-prompt's bands) so the narrator
  // anchors checks + flavor consistently: e.g. "Body 5 (fit), Vigor 12 (iron-willed)".
  return ATTR_KEYS.map(k => `${ATTR_LABELS[k]} ${attrs[k] ?? 0} (${attrDescriptor(k, attrs[k] ?? 0)})`).join(", ");
}

// What the player can DO in a fight: combat spells (magic — schools arcane/divine,
// dreaded if cast in public) vs martial techniques. Granted abilities (e.g. from an
// equipped grimoire) live here too, so the narrator knows the player can cast them.
export function summarizeAbilities(character, progressionProjection = progressionNarrativeProjection(character)) {
  const spells = [], techniques = [];
  for (const entry of progressionProjection.abilities) {
    const def = getAbilityDef(typeof entry === "string" ? entry : entry?.id);
    if (!def) continue;
    (def.school === "arcane" || def.school === "divine" ? spells : techniques).push(def.name);
  }
  const parts = [];
  if (spells.length) parts.push(`Spells (magic): ${spells.join(", ")}`);
  if (techniques.length) parts.push(`Techniques: ${techniques.join(", ")}`);
  return parts.join("; ") || "none learned";
}

export function summarizeProgressionCapabilities(character, progressionProjection = progressionNarrativeProjection(character)) {
  const profiles = progressionProjection.metamagicProfiles || [];
  const progressionCapabilities = progressionProjection.progressionCapabilities
    || progressionProjection.branchCapabilities || [];
  const parts = [];
  if (profiles.length) {
    const assignments = profiles.map((profile) => (
      `${profile.abilityName}${profile.primarySignature ? " [primary signature]" : ""} = ${profile.features.map((feature) => feature.name).join(", ")}`
    ));
    const definitions = new Map();
    for (const profile of profiles) {
      for (const feature of profile.features) definitions.set(feature.id, feature);
    }
    parts.push(`Metamagic profiles: ${assignments.join("; ")}`);
    parts.push(`Authored metamagic effects: ${[...definitions.values()].map((feature) => `${feature.name} — ${feature.description}`).join("; ")}`);
  }
  if (progressionCapabilities.length) {
    parts.push(`Earned progression capabilities: ${progressionCapabilities.map((feature) => `${feature.name} — ${feature.description}`).join("; ")}`);
  }
  return parts.join(" | ") || "none beyond the listed abilities";
}

// The COMPLETE pool of abilities the narrator may teach/grant by id — the engine's
// defined library, minus innate racial powers (engine grants those by race) and
// unique drop-only abilities. Surfaced so a starting kit or learned-in-play
// technique is drawn from real ids, never invented. Built live from the catalog.
export function summarizeGrantableAbilities() {
  const techniques = [], spells = [], cataclysmic = [];
  for (const a of ABILITY_CATALOG) {
    if (a.innate || a.unique || a.branchExclusive || a.progressionExclusive) continue; // race/drop/progression-owned — not narrator-grantable
    const label = a.minTier ? `${a.id} (≥${a.minTier})` : a.id; // floored apex powers
    (abilityCategoryOf(a) === "spell" ? spells : techniques).push(label);
    if (a.cataclysm) cataclysmic.push(a.id);
  }
  const parts = [];
  if (techniques.length) parts.push(`Techniques: ${techniques.sort().join(", ")}`);
  if (spells.length) parts.push(`Spells (magic): ${spells.sort().join(", ")}`);
  if (cataclysmic.length) parts.push(`Cataclysmic (terrain-scale — adjudicate per CATACLYSMIC MAGIC; feasible only with room/sky, hits everyone present, can fail or backfire): ${cataclysmic.sort().join(", ")}`);
  return parts.join(" | ");
}

// The COMPLETE pool of item ids the narrator may grant (loot/gift/shop/reward),
// grouped by kind. Spans every tier up to divine — exactly like grantable
// ABILITIES — so the grade is gated by narrative justification (see the preamble),
// not hard-capped. Built live from the catalog so it never drifts.
export function summarizeGrantableItems() {
  const byKind = {};
  for (const it of Object.values(ALL_ITEMS)) {
    const k = it.kind || "other";
    (byKind[k] = byKind[k] || []).push(it.id);
  }
  return Object.entries(byKind)
    .map(([k, ids]) => `${k} — ${ids.sort().join(", ")}`)
    .join("\n");
}

// Bonds + recent shared memories for everyone the player has a relationship or
// history with — so re-meetings need no re-introduction and carry their weight.
// 8-wind compass bearing from one axial hex to another.
export function compassDir(from, to) {
  const dq = to.x - from.x, dr = to.y - from.y;
  if (dq === 0 && dr === 0) return "here";
  const ex = dq + dr / 2, ey = dr; // y grows south
  const ang = ((Math.atan2(-ey, ex) * 180 / Math.PI) % 360 + 360) % 360; // 0=E, 90=N
  return ["E", "NE", "N", "NW", "W", "SW", "S", "SE"][Math.round(ang / 45) % 8];
}

// What the player can sense around them right now: whether this is safe/settled
// or open wilds (with the real encounter risk + likely hostiles HERE), and the
// bearing + distance to each accepted objective. Lets the narrator foreshadow a
// quest's dangers only when actually near it, not three hexes from the tavern.
function buildSurroundings(state, t) {
  const cur = state.world.currentTile;
  const near = HEX_DIRECTIONS.some((d) => {
    const nt = getTile(state, cur.x + d.x, cur.y + d.y);
    return nt.terrain === "settlement" || nt.terrain === "indoor";
  });
  const safe = t.terrain === "settlement" || t.terrain === "indoor" || near;
  const hp = hostileProfile(t, cur.x, cur.y);
  const here = safe
    ? "a settled, watched place — safe; no wilderness ambush here"
    : `open country — encounter risk ~${hp.chancePercent}%${hp.kinds.length ? `, likely: ${hp.kinds.join(", ")}` : ""}`;
  const objectives = (state.world.quests || [])
    .filter((q) => q.status === "active" && q.loc)
    .map((q) => {
      const dist = hexDistance(cur, q.loc);
      return `${q.title} → ${q.locName || "target"} (${dist} hex${dist === 1 ? "" : "es"} ${compassDir(cur, q.loc)}${dist <= 3 ? ", NEAR" : ""})`;
    });
  const objLine = objectives.length ? ` Objectives: ${objectives.join("; ")}.` : "";
  return `\n[SURROUNDINGS — Here: ${here}.${objLine} Foreshadow a quest's specific dangers (goblin-sign, good cover, fresh tracks) ONLY when its target is NEAR (≤3 hexes) AND you are on a dangerous wilderness hex — never while far off or safe in a settlement. If the player heads AWAY from an accepted objective or lets things drag, companions may notice and react per their bond and nature.]`;
}

export function summarizeBonds(codex) {
  const out = [];
  for (const c of Object.values(codex.characters)) {
    if (c.kind === "player") continue;
    const rel = c.relationship || 0;
    const mems = c.memories || [];
    if (rel === 0 && mems.length === 0) continue;
    const tier = relationshipTier(rel).label;
    const recent = mems.slice(-4).map((m) => `"${m}"`).join("; ");
    out.push(`${c.name}: ${tier} (${rel > 0 ? "+" : ""}${rel})${recent ? ` — remembers: ${recent}` : ""}`);
  }
  return out.length ? out.join("\n") : "(no one knows you yet)";
}

export function summarizeKnowledge(codex) {
  const out = [];
  for (const c of Object.values(codex.characters)) {
    const facts = c.knows || [];
    if (facts.length === 0) continue;
    const label = c.kind === "player" ? "You know" : `${c.name} knows`;
    out.push(`${label}: ${facts.map(f => `"${f}"`).join("; ")}`);
  }
  return out.join("\n");
}

export function summarizeRumored() {
  const items = Object.values(RUMORED);
  const grouped = {};
  for (const r of items) { grouped[r.name] = grouped[r.name] || r; }
  return Object.values(grouped).map(r => `${r.name} (${r.kind}, ${r.direction})`).join("; ");
}

export { summarizeMemoryBank };

export function buildStateContext(state) {
  const { character, time, world, party = [] } = state;
  const t = getTile(state, world.currentTile.x, world.currentTile.y);
  const biome = getBiome(world.currentTile.x, world.currentTile.y, world.seed);
  const ecology = t.ecology ? ecologyDefinition(t.ecology) : null;
  const place = currentLocationName(state) || `${TERRAINS[t.terrain]?.label || "Wilderness"} (${world.currentTile.x},${world.currentTile.y})`;
  const basePlace = poiPlaceName(t.poi) || `${TERRAINS[t.terrain]?.label || "Wilderness"} (${world.currentTile.x},${world.currentTile.y})`;
  const locMeta = poiMeta(t, basePlace);
  const locBits = [];
  if (locMeta.area) locBits.push(`Area: ${locMeta.area}`);
  if (locMeta.district) locBits.push(`District: ${locMeta.district}`);
  if (locMeta.footprint) locBits.push(`POI footprint: ${locMeta.footprint}`);
  if (locMeta.part) locBits.push(`Current hex: ${locMeta.part}`);
  if (locMeta.access) locBits.push(`Access: ${locMeta.access}`);
  const localLine = locBits.length ? `\n[LOCAL PLACE — ${locBits.join("; ")}]` : "";
  const nearby = [];
  for (const d of HEX_DIRECTIONS) {
    const nx = world.currentTile.x + d.x, ny = world.currentTile.y + d.y;
    if (!isSeen(state, nx, ny)) continue;
    const nt = getTile(state, nx, ny);
    const nearbyName = poiPlaceName(nt.poi);
    if (nearbyName) nearby.push(nearbyName);
    else if (nt.poi?.type === "hidden") nearby.push(`?(${TERRAINS[nt.terrain]?.label})`);
  }
  const nearbyStr = nearby.length ? `; Nearby: ${nearby.join(", ")}` : "";
  // Lasting state the player's actions left on this spot (razed, emptied, tense…).
  let locLine = "";
  if (t.status) {
    const ago = Math.max(0, (time.day || 0) - (t.status.day || 0));
    const when = ago <= 0 ? "today" : ago === 1 ? "yesterday" : `${ago} days ago`;
    locLine = `\n[LOCATION STATE — ${t.status.note || t.status.status} (since ${when}${t.status.depopulated ? "; depopulated" : ""})]`;
  }
  // The party was seen on the wing over this place — a rare wonder folk gossip about
  // for days. Surfaces only within the window, then quietly stops.
  let flyLine = "";
  if (t.aerialSighting) {
    const ago = Math.max(0, (time.day || 0) - (t.aerialSighting.day || 0));
    if (ago < AERIAL_SIGHTING_DAYS) {
      const when = ago <= 0 ? "today" : ago === 1 ? "yesterday" : `${ago} days ago`;
      flyLine = `\n[SEEN FLYING — the party was seen aloft over this place ${when}; flight is rare and remarkable, and folk here are still talking of it. Weave in their wonder, fear, or suspicion (the more so if it was on a dragon or great beast).]`;
    }
  }
  // A wired service building (a trader, etc.) at this tile. Its goods and prices
  // are handled by the counter UI; the narrator only flavors the keeper/place.
  const bld = buildingForTile(t);
  let svcLine = "";
  if (bld) {
    const open = isBuildingOpen(bld, time.hour);
    const h = buildingHours(bld);
    const pad = (n) => String(n).padStart(2, "0");
    svcLine = open
      ? `\n[SERVICE — ${bld.label} (${bld.keeper}); open ${pad(h.open)}:00–${pad(h.close)}:00, currently OPEN. Trade and training happen at the counter UI — flavor the keeper and the place, react, or haggle in words, but don't tally coin or invent transactions. If the player loiters past closing or badly overstays, the keeper winds down, refuses further custom, and ushers them out.]`
      : `\n[SERVICE — ${bld.label} (${bld.keeper}); open ${pad(h.open)}:00–${pad(h.close)}:00, currently CLOSED. Door barred, shutters down — no trade until it opens. The player may knock, wait, or come back; do not run a sale or service now.]`;
  }
  // Tasks the player has taken from a quest board — leads the narrator can
  // weave in and reward when fulfilled.
  const quests = (world.quests || []).filter((q) => q.status === "active");
  const questLine = quests.length
    ? `\n[ACTIVE TASKS — ${quests.map((q) => q.type === "bounty"
        ? `bounty on ${q.target} (${q.crime}; ${q.rewardCp}cp alive / ${q.rewardDeadCp}cp dead — pay the warden on delivery)`
        : `"${q.title}" (from ${q.giver}; reward ${q.rewardCp}cp)`).join("; ")}]`
    : "";
  // Companions recruited into the party — real people travelling with the player.
  const companions = party.map((id) => world.codex.characters[id]).filter(Boolean);
  const companionDetail = (c) => {
    const abil = (c.abilities || []).map((id) => getAbilityDef(id)?.name || id);
    const sk = (c.skills || []).map((s) => `${s.name}${s.rating ? ` ${s.rating}` : ""}`);
    const gear = (c.worn || []).map((id) => world.codex.items[id]?.name || String(id).replace(/-/g, " "));
    const bits = [];
    if (abil.length) bits.push(`fights with ${abil.join(", ")}`);
    if (sk.length) bits.push(`skilled in ${sk.join(", ")}`);
    if (gear.length) bits.push(`carries ${gear.join(", ")}`);
    const archetype = characterArchetype(c);
    const allocation = summarizeProgressionAllocation(c);
    return `${c.name} (id: ${c.id}; level ${allocation.totalLevel} = racial ${allocation.racialLevel} + professions ${allocation.professionLevel}; ${c.race} ${progressionProfessionName(c.profession)}${archetype ? `, ${archetype.label} specialization` : ""}${bits.length ? `; ${bits.join("; ")}` : ""})`;
  };
  const partyLine = companions.length
    ? `\n[COMPANIONS — travelling with you: ${companions.map(companionDetail).join(" · ")}. They are present in scenes, act and speak on their own, fight at your side, and share your fortunes (they can be wounded, killed, or leave). When the player asks a companion what they can do, ANSWER CONCRETELY from this kit — their real abilities, skills, and gear — never vague hand-waving. You may move gear between the player and a companion when they share loot (use companion_gear). If narration itself permanently kills or removes one, use their listed id in party_removals in that same response. Don't drop or forget them silently.]`
    : "";
  const localRoster = playableCharactersNear(state);
  const localRosterLine = localRoster.length
    ? `\n[OTHER ROSTER CHARACTERS HERE — ${localRoster.map(({ character: c }) => `${c.name} (id: ${c.id}; ${c.race} ${progressionProfessionName(c.profession)}${c.role ? `; ${c.role}` : ""})`).join(" · ")}. These authored people are physically present at this hex. Surface them naturally in the scene as independent NPCs, true to their dossier and voice. They are not companions unless the fiction changes that, and none is a second copy of the player.]`
    : "";
  const you = world.codex.characters.wanderer || {};
  const playerArchetype = characterArchetype(you);
  const youDesc = [
    originLabel(you.origin),
    you.race,
    you.profession ? progressionProfessionName(you.profession) : null,
    playerArchetype ? `(${playerArchetype.label} specialization)` : null,
  ].filter(Boolean).join(" ");
  const playerAllocation = summarizeProgressionAllocation(character);
  const progressionProjection = progressionNarrativeProjection(character);
  const playerLine = `[PLAYER — You are ${character.name}${youDesc ? `, a ${youDesc}` : ""}. Keep this identity consistent (do not drift the player's race or origin). Your NAME is PRIVATE: another character knows it ONLY if you have told THEM in the fiction (or it has plausibly reached them — a poster, a mutual friend, your own renown). A stranger, someone freshly met, or a companion you have only just recruited does NOT know your name until you give it — they address you by look, bearing, or role ("the swordsman", "stranger", "you with the bow") until then. The name you gave one person (the innkeeper) did not travel to anyone else on its own.]`;
  const narratorSteering = buildNarratorSteering(state.narratorSettings);
  const narratorSteeringLine = narratorSteering ? `\n${narratorSteering}` : "";
  const authoredProfile = you.profile || character.profile;
  const playerProfileLine = authoredProfile
    ? `\n[AUTHORED CHARACTER — Voice: ${authoredProfile.voice || "as established"} Complication: ${authoredProfile.complication || "none authored"} Telltale habit: ${authoredProfile.signature || "none authored"} Keep these specific hooks alive without forcing all three into every scene.]`
    : "";
  const conditionsLine = (character.conditions || []).map((c) => {
    const name = condName(c);
    const meta = conditionMeta(name);
    const tag = meta.polarity === "buff" ? " [buff]" : "";
    const rem = (typeof c === "object" && c && c.remaining != null)
      ? `, ~${Math.max(1, Math.round(c.remaining / 60 * 10) / 10)}h left` : "";
    return `${name}${tag}${rem}`;
  }).join(", ") || "none";
  const generatedAreaLine = t.area?.name && ecology
    ? `\n[AREA — ${t.area.name}; ${ecology.name}: ${ecology.description} Resources and materials: ${(t.resources || ecology.resources || []).join(", ") || "locally scarce"}.]`
    : "";
  return `${playerLine}${playerProfileLine}${narratorSteeringLine}
[STATE — ${formatDate(time)}, ${formatTime(time)}; at ${place} (${TERRAINS[t.terrain]?.label}); Vitality ${Math.round(character.vitality)}/${character.vitalityMax}; Resolve ${character.resolve}/${character.resolveMax}; Conditions: ${conditionsLine}; Light: ${lightStatus(state).text}; Bond: ${character.bond}${nearbyStr}]${localLine}${locLine}${flyLine}${svcLine}${questLine}${partyLine}${localRosterLine}${buildSurroundings(state, t)}
[REGION — ${biome.name}: ${biome.description}]${generatedAreaLine}
[ATTRIBUTES — ${summarizeAttributes(effectiveAttributes(character))}]
[PROGRESSION — level ${playerAllocation.totalLevel}/100 = racial ${playerAllocation.racialLevel}/30 + professions ${playerAllocation.professionLevel}/70; profession allocation ${playerAllocation.professionText}. Specialization ${playerArchetype?.label || "Adaptive Seeker"}. Broad-profession growth continues alongside any listed layered specialization branches. The engine owns durable ranks and every player branch choice; narrate an unlocked choice but never choose it.]
[ABILITIES KNOWN — ${summarizeAbilities(character, progressionProjection)}]
[PROGRESSION CAPABILITIES — ${summarizeProgressionCapabilities(character, progressionProjection)}]
[GRANTABLE ABILITIES — the COMPLETE set you may grant by id (a creation kit, a teacher's lesson, a technique learned in play). Use these ids EXACTLY; grant NOTHING outside this list, and never invent an ability. Innate racial powers are NOT here — the engine grants those from the chosen race. Each may be granted at a TIER from common→divine: the tier scales its power exactly like gear, so match it to the source — a hedge-teacher or short drill gives common/uncommon; a true master or guild gives rare/epic; only a fabled mentor, a legendary relic, or a god's boon confers legendary+; divine is godhood, almost never given. An id shown as "name (≥tier)" has a FLOOR — never grant or teach it below that tier (the engine clamps it up if you try). Set the tier on the grant (see ABILITIES & SPELLS). ${summarizeGrantableAbilities()}]
[NEEDS — Hunger ${Math.round(character.needs.hunger)}/100, Thirst ${Math.round(character.needs.thirst)}/100, Sleep ${Math.round(character.needs.sleep)}/100]
[CODEX — ${summarizeCodex(world.codex)}]
[INVENTORY — ${summarizeInventory(character, world.codex, state.time?.day || 0)}]
[ITEM CATALOG — the COMPLETE set of item ids you may grant (loot, gift, shop find, reward), by kind. Grant ONLY these ids via inventory_changes.added; do NOT invent items — the engine DISCARDS any grant whose id is not a catalog id. Items carry a TIER (common→divine) that scales their power exactly like abilities — so gate the GRADE by narrative justification, NOT by handing out relics freely: common/uncommon is everyday kit; rare/epic is a fine smith, a guild, or hard-won loot; legendary+ is a fabled forge, a king's hoard, or a god's boon, and divine is godhood — almost never given. A NAMED legendary+ relic is a specific figure's signature arm (e.g. the Demon King's sword) — grant one ONLY when the fiction truly supports it (you ARE that figure, you slew its bearer); otherwise prefer a generic high-tier piece. Earn the grade in the fiction, exactly as you would a high-tier ability.
${summarizeGrantableItems()}]
[GEOGRAPHY KNOWN BY REPUTATION — ${summarizeRumored()}]
[GEOGRAPHY KNOWN BY LEGEND — ${summarizeFabled()}]
[KNOWLEDGE BY CHARACTER]
${summarizeKnowledge(world.codex)}
[BONDS & MEMORIES — the player's standing with people met, and what each remembers of their shared history. Honour these on every re-encounter: a person who knows the player does NOT need re-introducing, and treats them per their bond. Deepen or sour them with relationship_changes; record significant shared moments with memory_updates.]
${summarizeBonds(world.codex)}
[MEMORY BANK — durable facts you have chosen to remember with the \`remember\` tool: promises, secrets, unresolved threads, plot-relevant details that must survive long after this turn scrolls out of the conversation window. This list is authoritative and permanent — treat it as ground truth. Call \`remember\` again whenever something worth this durability happens; don't re-record what's already listed.]
${summarizeMemoryBank(state.memories)}`;
}

