// State-context builders shared by both narrator backends (api-anthropic.js for
// the artifact build, api-supabase.js for the web build). The narrator call
// itself lives in those files; this module is helpers only.
import { ATTR_KEYS, ATTR_LABELS } from "../config.js";
import { effectiveAttributes } from "../data/proficiencies.js";
import { getAbilityDef } from "../data/abilities.js";
import { TERRAINS } from "../data/terrains.js";
import { RUMORED } from "../data/rumored.js";
import { summarizeFabled } from "../data/fabled.js";
import { getTile, isSeen, HEX_DIRECTIONS } from "./world.js";
import { getBiome } from "../data/biomes.js";
import { buildingForTile } from "../data/town.js";
import { formatTime, formatDate } from "./time.js";

export function summarizeCodex(codex) {
  const lines = [];
  const chars = Object.values(codex.characters).filter(c => c.kind !== "player");
  if (chars.length) lines.push(`Met: ${chars.map(c => `${c.name}(${c.race || "?"}, ${c.profession || "?"})`).join("; ")}`);
  else lines.push(`Met: only you`);
  const races = Object.values(codex.races).map(r => r.common ? `${r.name}*` : r.name);
  lines.push(`Races: ${races.join(", ") || "none"}`);
  const profs = Object.values(codex.professions).map(p => p.common ? `${p.name}*` : p.name);
  lines.push(`Professions: ${profs.join(", ") || "none"}`);
  const spells = Object.values(codex.spells).map(s => s.name);
  if (spells.length) lines.push(`Spells: ${spells.join(", ")}`);
  const skills = Object.values(codex.skills).map(s => `${s.name}(${s.rating ?? "?"})`);
  if (skills.length) lines.push(`Skills: ${skills.join(", ")}`);
  lines.push(`(*=baseline)`);
  return lines.join("; ");
}

export function summarizeInventory(character, codex) {
  const inv = character.inventory;
  const carried = inv.carried.map(c => `${c.quantity}× ${codex.items[c.itemId]?.name || c.itemId}`);
  const wornIds = codex.characters.wanderer?.worn || [];
  const worn = wornIds.map(id => codex.items[id]?.name || id);
  return `Pack: ${carried.join(", ") || "nothing"}. Worn: ${worn.join(", ") || "nothing"}. Coins: ${inv.coins.copper}cp/${inv.coins.silver}sp/${inv.coins.gold}gp.`;
}

export function summarizeAttributes(attrs) {
  return ATTR_KEYS.map(k => `${ATTR_LABELS[k]} ${attrs[k] ?? 0}`).join(", ");
}

// What the player can DO in a fight: combat spells (magic — schools arcane/divine,
// dreaded if cast in public) vs martial techniques. Granted abilities (e.g. from an
// equipped grimoire) live here too, so the narrator knows the player can cast them.
export function summarizeAbilities(character) {
  const spells = [], techniques = [];
  for (const entry of (character.abilities || [])) {
    const def = getAbilityDef(typeof entry === "string" ? entry : entry?.id);
    if (!def) continue;
    (def.school === "arcane" || def.school === "divine" ? spells : techniques).push(def.name);
  }
  const parts = [];
  if (spells.length) parts.push(`Spells (magic): ${spells.join(", ")}`);
  if (techniques.length) parts.push(`Techniques: ${techniques.join(", ")}`);
  return parts.join("; ") || "none learned";
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

export function buildStateContext(state) {
  const { character, time, world } = state;
  const t = getTile(state, world.currentTile.x, world.currentTile.y);
  const biome = getBiome(world.currentTile.x, world.currentTile.y);
  const place = t.poi?.name || `${TERRAINS[t.terrain]?.label || "Wilderness"} (${world.currentTile.x},${world.currentTile.y})`;
  const nearby = [];
  for (const d of HEX_DIRECTIONS) {
    const nx = world.currentTile.x + d.x, ny = world.currentTile.y + d.y;
    if (!isSeen(state, nx, ny)) continue;
    const nt = getTile(state, nx, ny);
    if (nt.poi?.name) nearby.push(nt.poi.name);
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
  // A wired service building (a trader, etc.) at this tile. Its goods and prices
  // are handled by the counter UI; the narrator only flavors the keeper/place.
  const bld = buildingForTile(t);
  const svcLine = bld
    ? `\n[SERVICE — you are at ${bld.label}${bld.kind === "trader" ? `, a trader (${bld.keeper})` : ""}. Buying and selling happen at the counter UI; flavor the keeper and the place, react, or haggle in words, but do not tally coin or invent the transaction here.]`
    : "";
  // Tasks the player has taken from a quest board — leads the narrator can
  // weave in and reward when fulfilled.
  const quests = (world.quests || []).filter((q) => q.status === "active");
  const questLine = quests.length
    ? `\n[ACTIVE TASKS — ${quests.map((q) => `"${q.title}" (from ${q.giver}; reward ${q.rewardCp}cp)`).join("; ")}]`
    : "";
  return `[STATE — ${formatDate(time)}, ${formatTime(time)}; at ${place} (${TERRAINS[t.terrain]?.label}); Vitality ${Math.round(character.vitality)}/${character.vitalityMax}; Resolve ${character.resolve}/${character.resolveMax}; Conditions: ${character.conditions.join(", ") || "none"}; Bond: ${character.bond}${nearbyStr}]${locLine}${svcLine}${questLine}
[BIOME — ${biome.name}: ${biome.description}]
[ATTRIBUTES — ${summarizeAttributes(effectiveAttributes(character))}]
[ABILITIES KNOWN — ${summarizeAbilities(character)}]
[NEEDS — Hunger ${Math.round(character.needs.hunger)}/100, Thirst ${Math.round(character.needs.thirst)}/100, Sleep ${Math.round(character.needs.sleep)}/100]
[CODEX — ${summarizeCodex(world.codex)}]
[INVENTORY — ${summarizeInventory(character, world.codex)}]
[GEOGRAPHY KNOWN BY REPUTATION — ${summarizeRumored()}]
[GEOGRAPHY KNOWN BY LEGEND — ${summarizeFabled()}]
[KNOWLEDGE BY CHARACTER]
${summarizeKnowledge(world.codex)}`;
}

