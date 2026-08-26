// Party acquisitions — the recruit / grant-mount / buy-mount / purchase-captive
// / purchase-rights / part-ways branches of applyBeat, extracted (Stage 3) into
// one cohesive pipeline step. It threads the evolving `world` and `party`
// (returned) and mutates `character.inventory` (coin deductions) + pushes log
// beats. No dependency back on beat.js — beat.js imports applyAcquisitions, one
// direction.
import { COMPANIONS, companionCodexEntry } from "../data/companions.js";
import { MOUNTS, mountCodexEntry, generateMountName } from "../data/mounts.js";
import { CAPTIVE_POOL, SLAVE_HIGH_TIER_MIN_CP, bondedCodexEntry } from "../data/slaves.js";
import { PRISONER_POOL, prisonerCodexEntry } from "../data/gaol.js";
import { markCaptiveBought } from "./slaves.js";
import { coinsToCopper, copperToCoins, canAfford } from "./economy.js";
import { carryCapacityFor, estimateAttributesFor, recomputeResolveMax, resolvePoolForMind } from "./attributes.js";
import { bodyWeightForRace } from "./weight.js";
import { normalizeCharacterProgression } from "./progression.js";

function normalizeAcquiredCharacter(entry, { legacyAttributes = false } = {}) {
  normalizeCharacterProgression(entry, {
    convertLegacyAttributes: legacyAttributes,
    enforceLevelAttributeScale: true,
    alignAttributesToProgression: legacyAttributes,
  });
  recomputeResolveMax(entry);
  entry.carryCapacityMax = carryCapacityFor(entry);
  return entry;
}

// Remove one travelling member without deleting their codex entry. Both a
// settled parting and a narrator-resolved death need the same riding cleanup;
// death additionally persists the member's fate so they cannot keep acting from
// the codex after leaving the active roster.
function removePartyMember(world, party, id, newTime, { dead = false, setHome = false } = {}) {
  const chars = { ...world.codex.characters };
  const member = chars[id];
  const cur = world.currentTile || { x: 0, y: 0 };
  if (member) {
    if (member.ridingOn && chars[member.ridingOn]) {
      chars[member.ridingOn] = {
        ...chars[member.ridingOn],
        riders: (chars[member.ridingOn].riders || []).filter((x) => x !== id),
      };
    }
    for (const riderId of (member.riders || [])) {
      if (chars[riderId]) chars[riderId] = { ...chars[riderId], ridingOn: null };
    }

    const position = { x: cur.x, y: cur.y, day: newTime.day };
    const fate = dead
      ? {
          combatState: {
            ...(member.combatState || {}),
            health: 0,
            maxHealth: member.combatState?.maxHealth ?? member.health ?? 0,
            status: "dead",
          },
        }
      : {};
    chars[id] = {
      ...member,
      ...fate,
      ridingOn: null,
      riders: [],
      at: position,
      ...(setHome ? { home: member.home || { x: cur.x, y: cur.y } } : {}),
    };
  }
  if (chars.wanderer?.ridingOn === id) chars.wanderer = { ...chars.wanderer, ridingOn: null };
  return {
    world: { ...world, codex: { ...world.codex, characters: chars } },
    party: party.filter((x) => x !== id),
  };
}

// ctx in: { state, beat, world, party, character, newTime, newBeats }.
// Returns the updated { world, party }; character.inventory and newBeats are
// mutated in place (same objects the caller holds).
export function applyAcquisitions({ state, beat, world, party, character, newTime, newBeats }) {
  // A companion the narrator just won over joins the party (the player talked
  // them into it — see [APPROACH RECRUIT] doctrine). Two shapes:
  //  - a fixed-roster id (COMPANIONS, the tavern-board prospects): the engine
  //    FORCES the authored template's stats/kit onto the codex entry — the
  //    narrator may have flavored or even restatted them earlier, but the
  //    template is authoritative, so the Company view matches the board.
  //  - any OTHER id already on file in world.codex.characters (an improvised
  //    NPC the narrator introduced via discoveries.characters — a freed
  //    captive, a won-over ally, a dominated thrall): no authored template
  //    exists to force, so they join exactly as already filed in the codex.
  //    An id matching neither is dropped — the narrator invented it on the
  //    spot with no prior discoveries.characters entry to back it.
  if (beat.recruit_companion?.id) {
    const id = beat.recruit_companion.id;
    const tmpl = COMPANIONS[id];
    if (tmpl && !party.includes(tmpl.id)) {
      party = [...party, tmpl.id];
      // File a fresh entry for a new recruit; a returning companion keeps their
      // accumulated memories + bond.
      const existing = world.codex.characters[tmpl.id];
      const rawEntry = existing
        ? {
            ...existing,
            kind: "companion",
            portraitKey: typeof existing.portraitKey === "string" && existing.portraitKey.trim()
              ? existing.portraitKey
              : `companion:${tmpl.id}`,
            abilities: existing.abilities?.length ? [...existing.abilities] : [...(tmpl.abilities || [])],
            skills: existing.skills?.length ? existing.skills.map((skill) => ({ ...skill })) : (tmpl.skills || []).map((skill) => ({ ...skill })),
          }
        : companionCodexEntry(tmpl);
      const entry = normalizeAcquiredCharacter(rawEntry, { legacyAttributes: !existing?.progression });
      world = { ...world, codex: { ...world.codex, characters: { ...world.codex.characters, [tmpl.id]: entry } } };
      newBeats.push({ id: `join${Date.now()}`, type: "recruit", text: `${tmpl.name} joins your company.` });
    } else if (!tmpl && !party.includes(id) && world.codex.characters[id]) {
      party = [...party, id];
      const existing = world.codex.characters[id];
      // An improvised NPC filed via discoveries.characters can be thin — the
      // narrator declares name/description but no stat block. Estimate a
      // plausible one from what we do know (race, age, profession) rather
      // than joining with all-zero attributes.
      if (!existing.attributes || Object.keys(existing.attributes).length === 0) {
        const attrs = estimateAttributesFor(existing);
        const race = existing.race || "human";
        world = {
          ...world,
          codex: {
            ...world.codex,
            characters: {
              ...world.codex.characters,
              [id]: {
                ...existing,
                attributes: attrs,
                needs: existing.needs || { hunger: 70, thirst: 75, sleep: 70 },
                resolve: existing.resolve ?? resolvePoolForMind(attrs.mind),
                resolveMax: existing.resolveMax ?? resolvePoolForMind(attrs.mind),
                bodyWeight: existing.bodyWeight ?? bodyWeightForRace(race),
                ridingOn: existing.ridingOn ?? null,
                riders: existing.riders || [],
              },
            },
          },
        };
      }
      const joined = normalizeAcquiredCharacter({ ...world.codex.characters[id] });
      world = { ...world, codex: { ...world.codex, characters: { ...world.codex.characters, [id]: joined } } };
      newBeats.push({ id: `join${Date.now()}`, type: "recruit", text: `${world.codex.characters[id].name || id} joins your company.` });
    }
  }

  // An exotic/flying mount EARNED in play (tamed, quest-won, story-gifted) joins
  // the party as a kind:"mount" codex character. Mundane mounts come from a stable
  // (the buy_mount handler just below); the narrator only grants the exotic ones, and the
  // engine FORCES the authored template (bodyWeight, rideCapacity, combat kit) — a
  // dragon is a dragon, the narrator can't restat it. Unknown ids are dropped, the
  // same way invented item ids are.
  if (beat.grant_mount?.id && MOUNTS[beat.grant_mount.id] && !party.includes(beat.grant_mount.id)) {
    const tmpl = MOUNTS[beat.grant_mount.id];
    party = [...party, tmpl.id];
    const existing = world.codex.characters[tmpl.id];
    // A tamed/earned beast is named in the fiction — by the player who tamed it (the
    // narrator passes grant_mount.name), else a fitting fallback. A returning mount
    // keeps the name it had. The player can rename it anytime.
    const granted = (beat.grant_mount.name || "").trim();
    const authored = mountCodexEntry(tmpl, existing?.name || granted || generateMountName(tmpl.race));
    const rawEntry = existing
      ? { ...authored, ...existing, relationship: existing.relationship || 0, memories: existing.memories || [] }
      : authored;
    if (!existing?.progression) {
      rawEntry.profession = authored.profession;
      rawEntry.archetype = authored.archetype;
      rawEntry.level = authored.level;
    }
    const entry = normalizeAcquiredCharacter(rawEntry, { legacyAttributes: !existing?.progression });
    world = { ...world, codex: { ...world.codex, characters: { ...world.codex.characters, [tmpl.id]: entry } } };
    newBeats.push({ id: `mount${Date.now()}`, type: "recruit", text: `${entry.name}, ${entry.species || tmpl.name}, now bears you.` });
  }

  // A mundane mount BOUGHT at a stable, after the haggling scene closes
  // ([APPROACH MOUNT] doctrine). The narrator names the agreed price and
  // (optionally) the SETTLEMENT path — "coin" (default) clamps to the haggle
  // band and takes the coin; a non-coin settlement ("writ" / "ruse" / "theft"
  // / "gift" / "barter") skips both, same shape as purchase_captive. A
  // stolen / writ'd / bartered horse is the stabler's problem to chase later;
  // the engine just adds the (already-named) beast to the party with the
  // settlement recorded.
  if (beat.buy_mount?.id && MOUNTS[beat.buy_mount.id] && !party.includes(beat.buy_mount.id)) {
    const tmpl = MOUNTS[beat.buy_mount.id];
    if (tmpl.acquisition === "stable") {
      const settlement = typeof beat.buy_mount.settlement === "string" && beat.buy_mount.settlement ? beat.buy_mount.settlement : "coin";
      const note = typeof beat.buy_mount.settlementNote === "string" && beat.buy_mount.settlementNote ? beat.buy_mount.settlementNote : null;
      const list = tmpl.priceCp || 0;
      const agreed = Number.isFinite(beat.buy_mount.priceCp) ? beat.buy_mount.priceCp : list;
      let proceed = true;
      let coinToTake = 0;
      let nominalCp = agreed;
      if (settlement === "coin") {
        const price = Math.max(Math.round(list * 0.4), Math.min(agreed, list)); // haggle floor 40%, never above list
        if (canAfford(character.inventory.coins, price)) {
          coinToTake = price;
          nominalCp = price;
        } else {
          proceed = false;
        }
      }
      if (proceed) {
        if (coinToTake > 0) {
          character.inventory = { ...character.inventory, coins: copperToCoins(coinsToCopper(character.inventory.coins) - coinToTake) };
        }
        const named = (beat.buy_mount.name || "").trim(); // the stabler's name for it, if given
        const existing = world.codex.characters[tmpl.id];
        const authored = mountCodexEntry(tmpl, existing?.name || named || generateMountName(tmpl.race));
        const rawEntry = existing ? { ...authored, ...existing } : authored;
        if (!existing?.progression) {
          rawEntry.profession = authored.profession;
          rawEntry.archetype = authored.archetype;
          rawEntry.level = authored.level;
        }
        rawEntry.acquired = { type: settlement, agreedCp: nominalCp, note, day: newTime.day };
        const entry = normalizeAcquiredCharacter(rawEntry, { legacyAttributes: !existing?.progression });
        world = { ...world, codex: { ...world.codex, characters: { ...world.codex.characters, [tmpl.id]: entry } } };
        party = [...party, tmpl.id];
        newBeats.push({ id: `buy${Date.now()}`, type: "recruit", text: `${entry.name}, ${entry.species}, joins your company.` });
      }
    }
  }

  // A captive's bond bought at the Block, after the inspect-haggle-settle scene
  // closes ([INSPECT CAPTIVE] doctrine, mirror of [APPROACH RECRUIT]). The
  // narrator names the agreed copper after haggling with the Chain Factor and
  // (optionally) the SETTLEMENT path — "coin" (default), or a non-coin path
  // the player negotiated: "writ" (a noble's deposit writ or covenant), "ruse"
  // (forgery / sleight / bluffed credentials), "theft" (lifted off the platform
  // by force or stealth), "gift", "barter". On coin the engine clamps to the
  // haggle floor, checks affordability, and takes the coin; on a non-coin
  // settlement none of that runs — the consequence (a debt to call in, a
  // soured Factor, a watch pursuit) is the narrator's to play out in later
  // beats. Either way the engine files a bonded codex entry (kind "bonded")
  // with the settlement record on it, adds them to the party, and marks them
  // off the platform. A purchase against an unknown key is dropped; an
  // unaffordable coin offer is dropped with the table-clears narration.
  if (beat.purchase_captive?.key) {
    const captive = CAPTIVE_POOL.find((c) => c.key === beat.purchase_captive.key);
    if (!captive) {
      newBeats.push({ id: `pcap${Date.now()}`, type: "narration", content: "The Chain Factor checks his slate, frowns — that captive is no longer on the platform." });
    } else {
      const settlement = typeof beat.purchase_captive.settlement === "string" && beat.purchase_captive.settlement ? beat.purchase_captive.settlement : "coin";
      const note = typeof beat.purchase_captive.settlementNote === "string" && beat.purchase_captive.settlementNote ? beat.purchase_captive.settlementNote : null;
      const list = captive.priceCp || 0;
      const agreed = Number.isFinite(beat.purchase_captive.agreedPriceCp) ? beat.purchase_captive.agreedPriceCp : list;
      let proceed = true;
      let coinToTake = 0;
      let nominalCp = agreed;
      if (settlement === "coin") {
        // Haggle floor 50% of list (the Block's own SLAVE_LOW_PRICE_FLOOR_PCT),
        // never above list — the Factor will not be talked above his own
        // asking, nor more than half below it without abandoning the sale.
        const price = Math.max(Math.round(list * 0.5), Math.min(agreed, list));
        if (!canAfford(character.inventory.coins, price)) {
          newBeats.push({ id: `pcap${Date.now()}`, type: "narration", content: "The coin doesn't add up at the table; the Factor sets the writ aside." });
          proceed = false;
        } else {
          coinToTake = price;
          nominalCp = price;
        }
      }
      if (proceed) {
        const bondedId = `bonded-${captive.key}-${newTime.day}`;
        if (!party.includes(bondedId)) {
          if (coinToTake > 0) {
            character.inventory = { ...character.inventory, coins: copperToCoins(coinsToCopper(character.inventory.coins) - coinToTake) };
          }
          const entry = normalizeAcquiredCharacter({
            ...bondedCodexEntry(captive),
            id: bondedId,
            acquired: { type: settlement, agreedCp: nominalCp, note, day: newTime.day },
          }, { legacyAttributes: true });
          world = { ...world, codex: { ...world.codex, characters: { ...world.codex.characters, [bondedId]: entry } } };
          // Also mark the captive off the visible roster on the current tile —
          // the same face shouldn't reappear when the player reopens the menu
          // before the per-tier window rolls. Tier is read from priceCp so a
          // re-purchase by key from the static pool slots into the right tier.
          const cur = world.currentTile;
          if (cur) {
            const tileKey = `${cur.x},${cur.y}`;
            const tier = (captive.priceCp || 0) >= SLAVE_HIGH_TIER_MIN_CP ? "high" : "low";
            const stateForMark = { ...state, world, time: newTime, character };
            const marked = markCaptiveBought(stateForMark, { key: captive.key, tier }, tileKey);
            world = marked.world;
          }
          party = [...party, bondedId];
          newBeats.push({ id: `pcap${Date.now()}`, type: "recruit", bonded: true, text: `${captive.name} is bonded to you and falls in beside the party.` });
        }
      }
    }
  }

  // A prisoner's rights bought at the gaol, after the inspect-haggle-settle
  // scene closes ([INSPECT RIGHTS] doctrine, mirror of [INSPECT CAPTIVE]).
  // The warden's listed fee is the asking; the player may talk it down, OR
  // settle by a non-coin path the narrator negotiates ("writ" / "ruse" /
  // "theft" / "gift" / "barter") — same shape as purchase_captive. Coin path
  // clamps, checks affordability, and deducts; non-coin path skips all that
  // and trusts the fiction. Either way the prisoner is filed as bonded with
  // the settlement recorded, and joins the party. Unknown keys or
  // unaffordable coin offers are dropped with a narration line.
  if (beat.purchase_rights?.key) {
    const prisoner = PRISONER_POOL.find((p) => p.key === beat.purchase_rights.key);
    if (!prisoner) {
      newBeats.push({ id: `pris${Date.now()}`, type: "narration", content: "The warden checks his ledger, shakes his head — that one's no longer in the cells." });
    } else {
      const settlement = typeof beat.purchase_rights.settlement === "string" && beat.purchase_rights.settlement ? beat.purchase_rights.settlement : "coin";
      const note = typeof beat.purchase_rights.settlementNote === "string" && beat.purchase_rights.settlementNote ? beat.purchase_rights.settlementNote : null;
      const list = prisoner.rightsCp || 0;
      const agreed = Number.isFinite(beat.purchase_rights.agreedPriceCp) ? beat.purchase_rights.agreedPriceCp : list;
      let proceed = true;
      let coinToTake = 0;
      let nominalCp = agreed;
      if (settlement === "coin") {
        const price = Math.max(Math.round(list * 0.5), Math.min(agreed, list));
        if (!canAfford(character.inventory.coins, price)) {
          newBeats.push({ id: `pris${Date.now()}`, type: "narration", content: "The coin doesn't add up at the warden's desk; the writ stays on the table." });
          proceed = false;
        } else {
          coinToTake = price;
          nominalCp = price;
        }
      }
      if (proceed) {
        const bondedId = `bonded-${prisoner.key}-${newTime.day}`;
        if (!party.includes(bondedId)) {
          if (coinToTake > 0) {
            character.inventory = { ...character.inventory, coins: copperToCoins(coinsToCopper(character.inventory.coins) - coinToTake) };
          }
          const entry = normalizeAcquiredCharacter({
            ...prisonerCodexEntry(prisoner),
            id: bondedId,
            acquired: { type: settlement, agreedCp: nominalCp, note, day: newTime.day },
          }, { legacyAttributes: true });
          world = { ...world, codex: { ...world.codex, characters: { ...world.codex.characters, [bondedId]: entry } } };
          party = [...party, bondedId];
          newBeats.push({ id: `pris${Date.now()}`, type: "recruit", bonded: true, text: `${prisoner.name} is given over to you and falls in beside the party.` });
        }
      }
    }
  }

  // A death or permanent departure that happens directly in narration must also
  // change the mechanical roster. Combat deaths are handled by combat-result.js;
  // this is the equivalent bridge for story-only events. Unknown reasons and ids
  // outside the current party are ignored so the narrator cannot rewrite the
  // wider codex through this action.
  const narratedRemovals = Array.isArray(beat.party_removals)
    ? beat.party_removals
    : (beat.party_removals ? [beat.party_removals] : []);
  for (const removal of narratedRemovals) {
    const id = removal?.id;
    const reason = removal?.reason;
    if (!id || !party.includes(id) || (reason !== "dead" && reason !== "left")) continue;
    ({ world, party } = removePartyMember(world, party, id, newTime, {
      dead: reason === "dead",
      setHome: reason === "left",
    }));
  }

  // A companion parts ways, or a mount is set loose — the narrator sets this only
  // once the scene resolves (see PARTING doctrine; the player can argue it out).
  // The leaver drops from the party but stays known in the codex (re-findable). Any
  // saddle links are cleared so no dangling rider/carrier reference remains.
  if (beat.part_ways?.id && party.includes(beat.part_ways.id)) {
    const id = beat.part_ways.id;
    const leaver = world.codex.characters[id];
    // They leave the party but remain IN THE WORLD: stamp where you left them as
    // their last-known position + home, so they linger/drift near here and can be
    // scryed or found again (engine/positions.js). Whereabouts hidden from the UI.
    ({ world, party } = removePartyMember(world, party, id, newTime, { setHome: true }));
    newBeats.push({ id: `leave${Date.now()}`, type: "recruit", text: leaver?.kind === "mount" ? `${leaver?.name || id} is set loose.` : `${leaver?.name || id} parts ways.` });
  }

  return { world, party };
}
