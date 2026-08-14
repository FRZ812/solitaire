import ashcaller from "../../assets/generated/combat-cutouts/ashcaller-cutout-v1.webp";
import dawnwarden from "../../assets/generated/combat-cutouts/dawnwarden-cutout-v1.webp";
import duellistFoe from "../../assets/generated/combat-cutouts/duellist-foe-cutout-v1.webp";
import gloamknife from "../../assets/generated/combat-cutouts/gloamknife-cutout-v1.webp";
import ironbound from "../../assets/generated/combat-cutouts/ironbound-cutout-v1.webp";
import nightSovereign from "../../assets/generated/combat-cutouts/night-sovereign-cutout-v1.webp";
import oathforged from "../../assets/generated/combat-cutouts/oathforged-cutout-v1.webp";
import raiderFoe from "../../assets/generated/combat-cutouts/raider-foe-cutout-v1.webp";
import wildstrider from "../../assets/generated/combat-cutouts/wildstrider-cutout-v1.webp";
import wyrmAscendant from "../../assets/generated/combat-cutouts/wyrm-ascendant-cutout-v1.webp";
import arcticKnight from "../../assets/generated/winter-tower/characters/arctic-knight-cutout-v1.png";
import demonSlayer from "../../assets/generated/winter-tower/characters/demon-slayer-cutout-v1.png";
import ownerOfClocktower from "../../assets/generated/winter-tower/characters/owner-of-clocktower-cutout-v1.png";
import oldKingOfNorthland from "../../assets/generated/winter-tower/characters/old-king-of-northland-cutout-v1.png";
import sleeplessOne from "../../assets/generated/winter-tower/characters/sleepless-one-cutout-v1.png";
import lastAssassin from "../../assets/generated/winter-tower/characters/last-assassin-cutout-v1.png";
import witchOfEternity from "../../assets/generated/winter-tower/characters/witch-of-eternity-cutout-v1.png";
import tenaciousMage from "../../assets/generated/winter-tower/characters/tenacious-mage-cutout-v1.png";
import exiledPriestess from "../../assets/generated/winter-tower/characters/exiled-priestess-cutout-v1.png";
import wanderingBlade from "../../assets/generated/winter-tower/characters/wandering-blade-cutout-v1.png";
import desolateVampire from "../../assets/generated/winter-tower/characters/desolate-vampire-cutout-v1.png";
import forsakenAutomaton from "../../assets/generated/winter-tower/characters/forsaken-automaton-cutout-v1.png";

export const TOW_COMBAT_CUTOUTS = Object.freeze({
  ironbound,
  wildstrider,
  gloamknife,
  dawnwarden,
  ashcaller,
  oathforged,
  "night-sovereign": nightSovereign,
  "wyrm-ascendant": wyrmAscendant,
  "duellist-foe": duellistFoe,
  "raider-foe": raiderFoe,
  "arctic-knight": arcticKnight,
  "demon-slayer": demonSlayer,
  "owner-of-clocktower": ownerOfClocktower,
  "old-king-of-northland": oldKingOfNorthland,
  "sleepless-one": sleeplessOne,
  "last-assassin": lastAssassin,
  "witch-of-eternity": witchOfEternity,
  "tenacious-mage": tenaciousMage,
  "exiled-priestess": exiledPriestess,
  "wandering-blade": wanderingBlade,
  "desolate-vampire": desolateVampire,
  "forsaken-automaton": forsakenAutomaton,
});

const CUTOUT_BY_TEMPLATE = Object.freeze({
  sellsword: ironbound,
  ranger: wildstrider,
  cutthroat: gloamknife,
  devout: dawnwarden,
  "hedge-mage": ashcaller,
  "champion-paladin": oathforged,
  shadowblade: nightSovereign,
  "dragon-ascendant": wyrmAscendant,
  "knight-errant": duellistFoe,
  reaver: raiderFoe,
  "arctic-knight": arcticKnight,
  "demon-slayer": demonSlayer,
  "owner-of-clocktower": ownerOfClocktower,
  "old-king-of-northland": oldKingOfNorthland,
  "sleepless-one": sleeplessOne,
  "last-assassin": lastAssassin,
  "witch-of-eternity": witchOfEternity,
  "tenacious-mage": tenaciousMage,
  "exiled-priestess": exiledPriestess,
  "wandering-blade": wanderingBlade,
  "desolate-vampire": desolateVampire,
  "forsaken-automaton": forsakenAutomaton,
});

const CUTOUT_BY_AUTHORED_NAME = Object.freeze({
  "garran holt": ironbound,
  "lior fen": wildstrider,
  "ren kairo": gloamknife,
  "samira avel": dawnwarden,
  "ysolda marr": ashcaller,
  "caldra vey": oathforged,
  "sable ren": nightSovereign,
  vaeraxa: wyrmAscendant,
  "arctic knight": arcticKnight,
  "demon slayer": demonSlayer,
  "owner of clocktower": ownerOfClocktower,
  "old king of northland": oldKingOfNorthland,
  "sleepless one": sleeplessOne,
  "last assassin": lastAssassin,
  "witch of eternity": witchOfEternity,
  "tenacious mage": tenaciousMage,
  "exiled priestess": exiledPriestess,
  "wandering blade": wanderingBlade,
  "desolate vampire": desolateVampire,
  "forsaken automaton": forsakenAutomaton,
});

const KNIGHT_FOE = /\b(duell?ist|sparring|knight|gatekeeper|guard|captain|soldier)\b/i;
const RAIDER_FOE = /\b(waylayer|brigand|bandit|raider|reaver|cutpurse|ogre)\b/i;

export function combatPortraitTemplateId(portraitKey) {
  if (typeof portraitKey !== "string") return null;
  const normalized = portraitKey.trim().replace(/^(?:template|tow):/, "");
  return normalized || null;
}

export function resolvePlayerCombatCutout(portraitKey, actor = null) {
  const templateId = combatPortraitTemplateId(portraitKey || actor?.portraitKey || actor?.templateId);
  if (templateId && CUTOUT_BY_TEMPLATE[templateId]) return CUTOUT_BY_TEMPLATE[templateId];
  const authored = String(actor?.name || "").trim().toLowerCase();
  return CUTOUT_BY_AUTHORED_NAME[authored] || null;
}

export function resolveEnemyCombatCutout(actor) {
  const identity = `${actor?.id || ""} ${actor?.name || ""}`.trim();
  if (KNIGHT_FOE.test(identity)) return duellistFoe;
  if (RAIDER_FOE.test(identity)) return raiderFoe;
  return null;
}

export function resolveTowCombatArt(actor, { playerId = null, playerPortraitKey = null } = {}) {
  if (!actor) return null;
  if (actor.id === playerId) return resolvePlayerCombatCutout(playerPortraitKey, actor);
  if (actor.side === "enemy") return resolveEnemyCombatCutout(actor);
  return resolvePlayerCombatCutout(actor.portraitKey, actor);
}
