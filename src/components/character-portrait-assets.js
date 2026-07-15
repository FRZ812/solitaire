import sellsword from "../assets/generated/character-portraits/sellsword-anime-v2.webp";
import reaver from "../assets/generated/character-portraits/reaver-anime-v2.webp";
import ranger from "../assets/generated/character-portraits/ranger-anime-v2.webp";
import cutthroat from "../assets/generated/character-portraits/cutthroat-anime-v2.webp";
import devout from "../assets/generated/character-portraits/devout-anime-v2.webp";
import hedgeMage from "../assets/generated/character-portraits/hedge-mage-anime-v2.webp";
import knightErrant from "../assets/generated/character-portraits/knight-errant-anime-v2.webp";
import warPriest from "../assets/generated/character-portraits/war-priest-anime-v2.webp";
import duelist from "../assets/generated/character-portraits/duelist-anime-v2.webp";
import beastWarden from "../assets/generated/character-portraits/beast-warden-anime-v2.webp";
import warCaptain from "../assets/generated/character-portraits/war-captain-anime-v2.webp";
import battleArchmage from "../assets/generated/character-portraits/battle-archmage-anime-v2.webp";
import shadowblade from "../assets/generated/character-portraits/shadowblade-anime-v2.webp";
import championPaladin from "../assets/generated/character-portraits/champion-paladin-anime-v2.webp";
import warlord from "../assets/generated/character-portraits/warlord-anime-v2.webp";
import faeTouched from "../assets/generated/character-portraits/fae-touched-anime-v2.webp";
import archmageAscendant from "../assets/generated/character-portraits/archmage-ascendant-anime-v2.webp";
import undyingChampion from "../assets/generated/character-portraits/undying-champion-anime-v2.webp";
import demonWarlock from "../assets/generated/character-portraits/demon-warlock-anime-v2.webp";
import dragonAscendant from "../assets/generated/character-portraits/dragon-ascendant-anime-v2.webp";
import enchanterTyrant from "../assets/generated/character-portraits/enchanter-tyrant-anime-v2.webp";

export const CHARACTER_PORTRAITS = Object.freeze({
  sellsword, reaver, ranger, cutthroat, devout,
  "hedge-mage": hedgeMage,
  "knight-errant": knightErrant,
  "war-priest": warPriest,
  duelist,
  "beast-warden": beastWarden,
  "war-captain": warCaptain,
  "battle-archmage": battleArchmage,
  shadowblade,
  "champion-paladin": championPaladin,
  warlord,
  "fae-touched": faeTouched,
  "archmage-ascendant": archmageAscendant,
  "undying-champion": undyingChampion,
  "demon-warlock": demonWarlock,
  "dragon-ascendant": dragonAscendant,
  "enchanter-tyrant": enchanterTyrant,
});

export function portraitTemplateId(record = {}) {
  const key = record.portraitKey || record.templateId;
  return typeof key === "string" ? key.replace(/^template:/, "") : null;
}

export function resolveCharacterPortrait(record = {}, fallback = null, override = null) {
  if (typeof override === "string" && override.trim()) return override;
  if (typeof record.portrait === "string" && record.portrait.trim()) return record.portrait;
  return CHARACTER_PORTRAITS[portraitTemplateId(record)] || fallback;
}
