// State-context builders shared by both narrator backends (api-anthropic.js for
// the artifact build, api-supabase.js for the web build). The narrator call
// itself lives in those files; this module is helpers only.
import { ATTR_KEYS, ATTR_LABELS } from "../config.js";
import { effectiveAttributes } from "../data/proficiencies.js";
import { getAbilityDef } from "../data/abilities.js";
import { TERRAINS } from "../data/terrains.js";
import { RUMORED } from "../data/rumored.js";
import { summarizeFabled } from "../data/fabled.js";
import { getTile, isSeen, HEX_DIRECTIONS, hexDistance } from "./world.js";
import { hostileProfile } from "./encounters.js";
import { getBiome } from "../data/biomes.js";
import { buildingForTile, isBuildingOpen, buildingHours } from "../data/town.js";
import { formatTime, formatDate } from "./time.js";
import { relationshipTier } from "./relationships.js";

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
  const companions = (world.party || []).map((id) => world.codex.characters[id]).filter(Boolean);
  const companionDetail = (c) => {
    const abil = (c.abilities || []).map((id) => getAbilityDef(id)?.name || id);
    const sk = (c.skills || []).map((s) => `${s.name}${s.rating ? ` ${s.rating}` : ""}`);
    const gear = (c.worn || []).map((id) => world.codex.items[id]?.name || String(id).replace(/-/g, " "));
    const bits = [];
    if (abil.length) bits.push(`fights with ${abil.join(", ")}`);
    if (sk.length) bits.push(`skilled in ${sk.join(", ")}`);
    if (gear.length) bits.push(`carries ${gear.join(", ")}`);
    return `${c.name} (${c.race} ${c.profession}${bits.length ? `; ${bits.join("; ")}` : ""})`;
  };
  const partyLine = companions.length
    ? `\n[COMPANIONS — travelling with you: ${companions.map(companionDetail).join(" · ")}. They are present in scenes, act and speak on their own, fight at your side, and share your fortunes (they can be wounded, killed, or leave). When the player asks a companion what they can do, ANSWER CONCRETELY from this kit — their real abilities, skills, and gear — never vague hand-waving. You may move gear between the player and a companion when they share loot (use companion_gear). Don't drop or forget them.]`
    : "";
  return `[STATE — ${formatDate(time)}, ${formatTime(time)}; at ${place} (${TERRAINS[t.terrain]?.label}); Vitality ${Math.round(character.vitality)}/${character.vitalityMax}; Resolve ${character.resolve}/${character.resolveMax}; Conditions: ${character.conditions.join(", ") || "none"}; Bond: ${character.bond}${nearbyStr}]${locLine}${svcLine}${questLine}${partyLine}${buildSurroundings(state, t)}
[BIOME — ${biome.name}: ${biome.description}]
[ATTRIBUTES — ${summarizeAttributes(effectiveAttributes(character))}]
[ABILITIES KNOWN — ${summarizeAbilities(character)}]
[NEEDS — Hunger ${Math.round(character.needs.hunger)}/100, Thirst ${Math.round(character.needs.thirst)}/100, Sleep ${Math.round(character.needs.sleep)}/100]
[CODEX — ${summarizeCodex(world.codex)}]
[INVENTORY — ${summarizeInventory(character, world.codex, state.time?.day || 0)}]
[GEOGRAPHY KNOWN BY REPUTATION — ${summarizeRumored()}]
[GEOGRAPHY KNOWN BY LEGEND — ${summarizeFabled()}]
[KNOWLEDGE BY CHARACTER]
${summarizeKnowledge(world.codex)}
[BONDS & MEMORIES — the player's standing with people met, and what each remembers of their shared history. Honour these on every re-encounter: a person who knows the player does NOT need re-introducing, and treats them per their bond. Deepen or sour them with relationship_changes; record significant shared moments with memory_updates.]
${summarizeBonds(world.codex)}`;
}

