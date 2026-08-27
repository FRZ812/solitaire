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
import knight from "../../assets/generated/archetypes/portraits/knight-portrait-v5.png";
import ranger from "../../assets/generated/archetypes/portraits/ranger-portrait-v6.png";
import artificer from "../../assets/generated/archetypes/portraits/artificer-portrait-v5.png";
import berserker from "../../assets/generated/archetypes/portraits/berserker-portrait-v5.png";
import sorcerer from "../../assets/generated/archetypes/portraits/sorcerer-portrait-v5.png";
import rogue from "../../assets/generated/archetypes/portraits/rogue-portrait-v5.png";
import warlock from "../../assets/generated/archetypes/portraits/warlock-portrait-v5.png";
import wizard from "../../assets/generated/archetypes/portraits/wizard-portrait-v5.png";
import paladin from "../../assets/generated/archetypes/portraits/paladin-portrait-v5.png";
import blademaster from "../../assets/generated/archetypes/portraits/blademaster-portrait-v5.png";
import vampire from "../../assets/generated/archetypes/portraits/vampire-portrait-v5.png";
import automaton from "../../assets/generated/archetypes/portraits/automaton-portrait-v5.png";

export const COMBAT_COMBAT_CUTOUTS = Object.freeze({
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
  "owner-of-artificer": artificer,
  "old-king-of-northland": berserker,
  "sleepless-one": sorcerer,
  "last-assassin": rogue,
  "witch-of-eternity": warlock,
  "tenacious-mage": wizard,
  "exiled-priestess": paladin,
  "wandering-blade": blademaster,
  "desolate-vampire": vampire,
  "forsaken-automaton": automaton,
  "archetype:knight": knight,
  "archetype:ranger": ranger,
  "archetype:artificer": artificer,
  "archetype:berserker": berserker,
  "archetype:sorcerer": sorcerer,
  "archetype:rogue": rogue,
  "archetype:warlock": warlock,
  "archetype:wizard": wizard,
  "archetype:paladin": paladin,
  "archetype:blademaster": blademaster,
  "archetype:vampire": vampire,
  "archetype:automaton": automaton,
  "archetype:arctic-knight": knight,
  "archetype:demon-slayer": ranger,
  "archetype:owner-of-artificer": artificer,
  "archetype:old-king-of-northland": berserker,
  "archetype:sleepless-one": sorcerer,
  "archetype:last-assassin": rogue,
  "archetype:witch-of-eternity": warlock,
  "archetype:tenacious-mage": wizard,
  "archetype:exiled-priestess": paladin,
  "archetype:wandering-blade": blademaster,
  "archetype:desolate-vampire": vampire,
  "archetype:forsaken-automaton": automaton,
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
  "archetype:knight": knight,
  "archetype:ranger": ranger,
  "archetype:artificer": artificer,
  "archetype:berserker": berserker,
  "archetype:sorcerer": sorcerer,
  "archetype:rogue": rogue,
  "archetype:warlock": warlock,
  "archetype:wizard": wizard,
  "archetype:paladin": paladin,
  "archetype:blademaster": blademaster,
  "archetype:vampire": vampire,
  "archetype:automaton": automaton,
  "archetype:arctic-knight": knight,
  "archetype:demon-slayer": ranger,
  "archetype:owner-of-artificer": artificer,
  "archetype:old-king-of-northland": berserker,
  "archetype:sleepless-one": sorcerer,
  "archetype:last-assassin": rogue,
  "archetype:witch-of-eternity": warlock,
  "archetype:tenacious-mage": wizard,
  "archetype:exiled-priestess": paladin,
  "archetype:wandering-blade": blademaster,
  "archetype:desolate-vampire": vampire,
  "archetype:forsaken-automaton": automaton,
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
  "owner of artificer": artificer,
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
  const normalized = portraitKey.trim().replace(/^(?:template|combat):/, "");
  return normalized || null;
}

export function resolvePlayerCombatCutout(portraitKey, actor = null) {
  const rawKey = portraitKey
    || actor?.portraitKey
    || actor?.templateId
    || actor?.combatArchetypeId
    || actor?.archetypeId
    || actor?.profession;
  const templateId = combatPortraitTemplateId(rawKey);
  const lookup = typeof rawKey === "string" && rawKey.trim().startsWith("archetype:")
    ? `archetype:${templateId}`
    : templateId;
  if (lookup && CUTOUT_BY_TEMPLATE[lookup]) return CUTOUT_BY_TEMPLATE[lookup];
  const authored = String(actor?.name || "").trim().toLowerCase();
  return CUTOUT_BY_AUTHORED_NAME[authored] || null;
}

export function resolveEnemyCombatCutout(actor, archetypeId = null) {
  const key = archetypeId || actor?.archetypeId || actor?.templateId || null;
  if (typeof key === "string") {
    const normalized = key.trim().toLowerCase().replace(/^archetype:/, "");
    if (COMBAT_COMBAT_CUTOUTS[normalized]) return COMBAT_COMBAT_CUTOUTS[normalized];
    if (COMBAT_COMBAT_CUTOUTS[`archetype:${normalized}`]) return COMBAT_COMBAT_CUTOUTS[`archetype:${normalized}`];
  }
  const identity = `${actor?.id || ""} ${actor?.name || ""}`.trim();
  if (KNIGHT_FOE.test(identity)) return duellistFoe;
  if (RAIDER_FOE.test(identity)) return raiderFoe;
  return null;
}

export function resolveCombatCombatArt(actor, {
  playerId = null,
  playerPortraitKey = null,
  archetypeId = null,
} = {}) {
  if (!actor) return null;
  if (actor.id === playerId) return resolvePlayerCombatCutout(playerPortraitKey, actor);
  if (actor.side === "enemy") return resolveEnemyCombatCutout(actor, archetypeId);
  return resolvePlayerCombatCutout(actor.portraitKey, actor);
}
