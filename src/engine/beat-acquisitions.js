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

// ctx in: { state, beat, world, party, character, newTime, newBeats }.
// Returns the updated { world, party }; character.inventory and newBeats are
// mutated in place (same objects the caller holds).
export function applyAcquisitions({ state, beat, world, party, character, newTime, newBeats }) {
  // A companion the narrator just won over joins the party (the player talked
  // them into it — see [APPROACH RECRUIT] doctrine).
  if (beat.recruit_companion?.id) {
    const tmpl = COMPANIONS[beat.recruit_companion.id];
    if (tmpl && !party.includes(tmpl.id)) {
      party = [...party, tmpl.id];
      // File a fresh entry for a new recruit; a returning companion keeps their
      // accumulated memories + bond. Either way the engine FORCES the authored
      // template's stats/kit (attributes, abilities, skills) onto the codex entry
      // — the narrator may have flavored or even restatted them earlier, but the
      // template is authoritative, so the Company view matches the tavern board.
      const existing = world.codex.characters[tmpl.id];
      const entry = existing
        ? { ...existing, attributes: tmpl.attributes, abilities: [...(tmpl.abilities || [])], skills: (tmpl.skills || []).map((s) => ({ ...s })) }
        : companionCodexEntry(tmpl);
      world = { ...world, codex: { ...world.codex, characters: { ...world.codex.characters, [tmpl.id]: entry } } };
      newBeats.push({ id: `join${Date.now()}`, type: "recruit", text: `${tmpl.name} joins your company.` });
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
    const entry = existing
      ? { ...existing, ...mountCodexEntry(tmpl, existing.name), relationship: existing.relationship || 0, memories: existing.memories || [] }
      : mountCodexEntry(tmpl, granted || generateMountName(tmpl.race));
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
        const entry = { ...mountCodexEntry(tmpl, named || generateMountName(tmpl.race)), acquired: { type: settlement, agreedCp: nominalCp, note, day: newTime.day } };
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
          const entry = { ...bondedCodexEntry(captive), id: bondedId, acquired: { type: settlement, agreedCp: nominalCp, note, day: newTime.day } };
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
          const entry = { ...prisonerCodexEntry(prisoner), id: bondedId, acquired: { type: settlement, agreedCp: nominalCp, note, day: newTime.day } };
          world = { ...world, codex: { ...world.codex, characters: { ...world.codex.characters, [bondedId]: entry } } };
          party = [...party, bondedId];
          newBeats.push({ id: `pris${Date.now()}`, type: "recruit", bonded: true, text: `${prisoner.name} is given over to you and falls in beside the party.` });
        }
      }
    }
  }

  // A companion parts ways, or a mount is set loose — the narrator sets this only
  // once the scene resolves (see PARTING doctrine; the player can argue it out).
  // The leaver drops from the party but stays known in the codex (re-findable). Any
  // saddle links are cleared so no dangling rider/carrier reference remains.
  if (beat.part_ways?.id && party.includes(beat.part_ways.id)) {
    const id = beat.part_ways.id;
    const chars = { ...world.codex.characters };
    const leaver = chars[id];
    const cur = world.currentTile || { x: 0, y: 0 };
    if (leaver) {
      if (leaver.ridingOn && chars[leaver.ridingOn]) chars[leaver.ridingOn] = { ...chars[leaver.ridingOn], riders: (chars[leaver.ridingOn].riders || []).filter((x) => x !== id) };
      for (const rid of (leaver.riders || [])) if (chars[rid]) chars[rid] = { ...chars[rid], ridingOn: null };
      // They leave the party but remain IN THE WORLD: stamp where you left them as
      // their last-known position + home, so they linger/drift near here and can be
      // scryed or found again (engine/positions.js). Whereabouts hidden from the UI.
      chars[id] = { ...leaver, ridingOn: null, riders: [], at: { x: cur.x, y: cur.y, day: newTime.day }, home: leaver.home || { x: cur.x, y: cur.y } };
    }
    if (chars.wanderer?.ridingOn === id) chars.wanderer = { ...chars.wanderer, ridingOn: null };
    world = { ...world, codex: { ...world.codex, characters: chars } };
    party = party.filter((x) => x !== id);
    newBeats.push({ id: `leave${Date.now()}`, type: "recruit", text: leaver?.kind === "mount" ? `${leaver?.name || id} is set loose.` : `${leaver?.name || id} parts ways.` });
  }

  return { world, party };
}
