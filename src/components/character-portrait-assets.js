import sellsword from "../assets/generated/character-portraits/sellsword-grounded-v3.webp";
import reaver from "../assets/generated/character-portraits/reaver-grounded-v3.webp";
import ranger from "../assets/generated/character-portraits/ranger-grounded-v3.webp";
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
import shadowblade from "../assets/generated/character-portraits/shadowblade-grounded-v3.webp";
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

export const CHARACTER_PORTRAITS = Object.freeze({
  sellsword, reaver, ranger, cutthroat, devout,
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
