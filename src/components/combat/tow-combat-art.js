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
import knight from "../../assets/generated/archetypes/portraits/knight-portrait-v1.webp";
import ranger from "../../assets/generated/archetypes/portraits/ranger-portrait-v1.webp";
import artificer from "../../assets/generated/archetypes/portraits/artificer-portrait-v1.webp";
import berserker from "../../assets/generated/archetypes/portraits/berserker-portrait-v1.webp";
import sorcerer from "../../assets/generated/archetypes/portraits/sorcerer-portrait-v1.webp";
import rogue from "../../assets/generated/archetypes/portraits/rogue-portrait-v1.webp";
import warlock from "../../assets/generated/archetypes/portraits/warlock-portrait-v1.webp";
import wizard from "../../assets/generated/archetypes/portraits/wizard-portrait-v1.webp";
import paladin from "../../assets/generated/archetypes/portraits/paladin-portrait-v1.webp";
import blademaster from "../../assets/generated/archetypes/portraits/blademaster-portrait-v1.webp";
import vampire from "../../assets/generated/archetypes/portraits/vampire-portrait-v1.webp";
import automaton from "../../assets/generated/archetypes/portraits/automaton-portrait-v1.webp";

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
  knight, ranger, artificer, berserker, sorcerer, rogue,
  warlock, wizard, paladin, blademaster, vampire, automaton,
  "arctic-knight": knight,
  "demon-slayer": ranger,
  "owner-of-clocktower": artificer,
  "old-king-of-northland": berserker,
  "sleepless-one": sorcerer,
  "last-assassin": rogue,
  "witch-of-eternity": warlock,
  "tenacious-mage": wizard,
  "exiled-priestess": paladin,
  "wandering-blade": blademaster,
  "desolate-vampire": vampire,
  "forsaken-automaton": automaton,
  "tow:knight": knight,
  "tow:ranger": ranger,
  "tow:artificer": artificer,
  "tow:berserker": berserker,
  "tow:sorcerer": sorcerer,
  "tow:rogue": rogue,
  "tow:warlock": warlock,
  "tow:wizard": wizard,
  "tow:paladin": paladin,
  "tow:blademaster": blademaster,
  "tow:vampire": vampire,
  "tow:automaton": automaton,
  "tow:arctic-knight": knight,
  "tow:demon-slayer": ranger,
  "tow:owner-of-clocktower": artificer,
  "tow:old-king-of-northland": berserker,
  "tow:sleepless-one": sorcerer,
  "tow:last-assassin": rogue,
  "tow:witch-of-eternity": warlock,
  "tow:tenacious-mage": wizard,
  "tow:exiled-priestess": paladin,
  "tow:wandering-blade": blademaster,
  "tow:desolate-vampire": vampire,
  "tow:forsaken-automaton": automaton,
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
  "tow:knight": knight,
  "tow:ranger": ranger,
  "tow:artificer": artificer,
  "tow:berserker": berserker,
  "tow:sorcerer": sorcerer,
  "tow:rogue": rogue,
  "tow:warlock": warlock,
  "tow:wizard": wizard,
  "tow:paladin": paladin,
  "tow:blademaster": blademaster,
  "tow:vampire": vampire,
  "tow:automaton": automaton,
  "tow:arctic-knight": knight,
  "tow:demon-slayer": ranger,
  "tow:owner-of-clocktower": artificer,
  "tow:old-king-of-northland": berserker,
  "tow:sleepless-one": sorcerer,
  "tow:last-assassin": rogue,
  "tow:witch-of-eternity": warlock,
  "tow:tenacious-mage": wizard,
  "tow:exiled-priestess": paladin,
  "tow:wandering-blade": blademaster,
  "tow:desolate-vampire": vampire,
  "tow:forsaken-automaton": automaton,
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
  knight, ranger, artificer, berserker, sorcerer, rogue,
  warlock, wizard, paladin, blademaster, vampire, automaton,
  "arctic knight": knight,
  "demon slayer": ranger,
  "owner of clocktower": artificer,
  "old king of northland": berserker,
  "sleepless one": sorcerer,
  "last assassin": rogue,
  "witch of eternity": warlock,
  "tenacious mage": wizard,
  "exiled priestess": paladin,
  "wandering blade": blademaster,
  "desolate vampire": vampire,
  "forsaken automaton": automaton,
});

const KNIGHT_FOE = /\b(duell?ist|sparring|knight|gatekeeper|guard|captain|soldier)\b/i;
const RAIDER_FOE = /\b(waylayer|brigand|bandit|raider|reaver|cutpurse|ogre)\b/i;

export function combatPortraitTemplateId(portraitKey) {
  if (typeof portraitKey !== "string") return null;
  const normalized = portraitKey.trim().replace(/^(?:template|tow):/, "");
  return normalized || null;
}

export function resolvePlayerCombatCutout(portraitKey, actor = null) {
  const rawKey = portraitKey || actor?.portraitKey || actor?.templateId;
  const templateId = combatPortraitTemplateId(rawKey);
  const lookup = typeof rawKey === "string" && rawKey.trim().startsWith("tow:")
    ? `tow:${templateId}`
    : templateId;
  if (lookup && CUTOUT_BY_TEMPLATE[lookup]) return CUTOUT_BY_TEMPLATE[lookup];
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
