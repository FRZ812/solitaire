import sellsword from "../assets/generated/character-portraits/sellsword-grounded-v3.webp";
import reaver from "../assets/generated/character-portraits/reaver-grounded-v3.webp";
import rangerLegacy from "../assets/generated/character-portraits/ranger-grounded-v3.webp";
import cutthroat from "../assets/generated/character-portraits/cutthroat-grounded-v3.webp";
import devout from "../assets/generated/character-portraits/devout-grounded-v3.webp";
import courtEnvoy from "../assets/generated/character-portraits/court-envoy-grounded-v3.webp";
import confidenceArtist from "../assets/generated/character-portraits/confidence-artist-grounded-v3.webp";
import hedgeMage from "../assets/generated/character-portraits/hedge-mage-grounded-v3.webp";
import knightErrant from "../assets/generated/character-portraits/knight-errant-grounded-v3.webp";
import warPriest from "../assets/generated/character-portraits/war-priest-grounded-v3.webp";
import duelist from "../assets/generated/character-portraits/duelist-grounded-v3.webp";
import beastWarden from "../assets/generated/character-portraits/beast-warden-grounded-v3.webp";
import guildAdvocate from "../assets/generated/character-portraits/guild-advocate-grounded-v3.webp";
import velvetCourtier from "../assets/generated/character-portraits/velvet-courtier-grounded-v3.webp";
import warCaptain from "../assets/generated/character-portraits/war-captain-grounded-v3.webp";
import battleArchmage from "../assets/generated/character-portraits/battle-archmage-grounded-v3.webp";
import shadowblade from "../assets/generated/character-portraits/shadowblade-anime-v2.webp";
import championPaladin from "../assets/generated/character-portraits/champion-paladin-grounded-v3.webp";
import dragonHunter from "../assets/generated/character-portraits/dragon-hunter-grounded-v3.webp";
import highSorcerer from "../assets/generated/character-portraits/high-sorcerer-grounded-v3.webp";
import warlord from "../assets/generated/character-portraits/warlord-grounded-v3.webp";
import faeTouched from "../assets/generated/character-portraits/fae-touched-grounded-v3.webp";
import archmageAscendant from "../assets/generated/character-portraits/archmage-ascendant-grounded-v3.webp";
import undyingChampion from "../assets/generated/character-portraits/undying-champion-grounded-v3.webp";
import demonWarlock from "../assets/generated/character-portraits/demon-warlock-grounded-v3.webp";
import dragonAscendant from "../assets/generated/character-portraits/dragon-ascendant-grounded-v3.webp";
import enchanterTyrant from "../assets/generated/character-portraits/enchanter-tyrant-grounded-v3.webp";
import knight from "../assets/generated/archetypes/portraits/knight-portrait-v3.png";
import rangerArchetype from "../assets/generated/archetypes/portraits/ranger-portrait-v4.png";
import artificer from "../assets/generated/archetypes/portraits/artificer-portrait-v3.png";
import berserker from "../assets/generated/archetypes/portraits/berserker-portrait-v3.png";
import sorcerer from "../assets/generated/archetypes/portraits/sorcerer-portrait-v3.png";
import rogue from "../assets/generated/archetypes/portraits/rogue-portrait-v3.png";
import warlock from "../assets/generated/archetypes/portraits/warlock-portrait-v3.png";
import wizard from "../assets/generated/archetypes/portraits/wizard-portrait-v3.png";
import paladin from "../assets/generated/archetypes/portraits/paladin-portrait-v3.png";
import blademaster from "../assets/generated/archetypes/portraits/blademaster-portrait-v3.png";
import vampire from "../assets/generated/archetypes/portraits/vampire-portrait-v3.png";
import automaton from "../assets/generated/archetypes/portraits/automaton-portrait-v3.png";

export const CHARACTER_PORTRAITS = Object.freeze({
  sellsword, reaver, ranger: rangerLegacy, cutthroat, devout,
  "court-envoy": courtEnvoy,
  "confidence-artist": confidenceArtist,
  "hedge-mage": hedgeMage,
  "knight-errant": knightErrant,
  "war-priest": warPriest,
  duelist,
  "beast-warden": beastWarden,
  "guild-advocate": guildAdvocate,
  "velvet-courtier": velvetCourtier,
  "war-captain": warCaptain,
  "battle-archmage": battleArchmage,
  shadowblade,
  "champion-paladin": championPaladin,
  "dragon-hunter": dragonHunter,
  "high-sorcerer": highSorcerer,
  warlord,
  "fae-touched": faeTouched,
  "archmage-ascendant": archmageAscendant,
  "undying-champion": undyingChampion,
  "demon-warlock": demonWarlock,
  "dragon-ascendant": dragonAscendant,
  "enchanter-tyrant": enchanterTyrant,
  "tow:knight": knight,
  "tow:ranger": rangerArchetype,
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
  // Legacy portrait keys are read-only save aliases.
  "tow:arctic-knight": knight,
  "tow:demon-slayer": rangerArchetype,
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

export function portraitTemplateId(record = {}) {
  const key = record.portraitKey || record.templateId;
  return typeof key === "string" ? key.replace(/^(?:template|tow):/, "") : null;
}

export function resolveCharacterPortrait(record = {}, fallback = null, override = null) {
  if (typeof override === "string" && override.trim()) return override;
  if (typeof record.portrait === "string" && record.portrait.trim()) return record.portrait;
  const rawKey = record.portraitKey || record.templateId;
  const templateId = portraitTemplateId(record);
  const lookup = typeof rawKey === "string" && rawKey.startsWith("tow:")
    ? `tow:${templateId}`
    : templateId;
  return CHARACTER_PORTRAITS[lookup] || fallback;
}
