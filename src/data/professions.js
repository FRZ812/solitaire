// Canonical profession records shared by character creation and the living
// Codex. Ready-made characters use a focused adventuring subset, while common
// occupations remain here so old saves keep their existing lore entries.
export const PROFESSIONS = Object.freeze({
  innkeeper: { id: "innkeeper", name: "Innkeeper", description: "Keeper of an inn or tavern.", common: true },
  farmer: { id: "farmer", name: "Farmer", description: "Tiller of land, raiser of stock.", common: true },
  peddler: { id: "peddler", name: "Peddler", description: "A travelling trader of small goods.", common: true },
  monarch: { id: "monarch", name: "Monarch", description: "Crowned ruler of a kingdom or comparable polity." },
  noble: { id: "noble", name: "Noble", description: "Holder of a title — baron, lord, count, or comparable rank." },
  witch: { id: "witch", name: "Witch", description: "A hedge-magic practitioner working outside the Spire schools." },
  speaker: { id: "speaker", name: "Speaker", description: "A civic leader heard by consent rather than obeyed by command." },
  "chapter-master": { id: "chapter-master", name: "Chapter-Master", description: "Senior officer of a militant order's chapter-house." },
  "hold-father": { id: "hold-father", name: "Hold-Father", description: "Elected leader of a dwarven hold for a term of years." },
  matriarch: { id: "matriarch", name: "Matriarch", description: "An elected female leader of a clan, hold, or free settlement." },

  sellsword: { id: "sellsword", name: "Sellsword", role: "Tank", iconKey: "sellsword", description: "A paid front-line fighter who survives by discipline, shield-work, and contracts kept." },
  reaver: { id: "reaver", name: "Reaver", role: "Bruiser", iconKey: "reaver", description: "A furious heavy-weapon fighter who turns momentum and pain into overwhelming force." },
  ranger: { id: "ranger", name: "Ranger", role: "Ranged DPS", iconKey: "ranger", description: "A wilderness archer, scout, and patient hunter of trails others cannot read." },
  assassin: { id: "assassin", name: "Assassin", role: "Assassin", iconKey: "cutthroat", description: "A precise killer trained in concealment, footwork, and ending a fight before it begins." },
  priest: { id: "priest", name: "Priest", role: "Healer", iconKey: "devout", description: "A keeper of faith who mends the wounded and stands against the unholy." },
  "hedge-mage": { id: "hedge-mage", name: "Hedge-Mage", role: "Mage", iconKey: "hedge-mage", description: "A self-taught practitioner whose improvised Art is dangerous, practical, and fiercely personal." },
  knight: { id: "knight", name: "Knight-Errant", role: "Tank", iconKey: "knight-errant", description: "An oath-bound armoured rider who carries duty after banners and houses have fallen." },
  "war-priest": { id: "war-priest", name: "War-Priest", role: "Healer", iconKey: "war-priest", description: "A battlefield cleric who carries mercy in one hand and a hammer in the other." },
  duelist: { id: "duelist", name: "Duelist", role: "Assassin", iconKey: "duelist", description: "A technical sword-fighter who wins by measure, nerve, and one perfect opening." },
  warden: { id: "warden", name: "Beast-Warden", role: "Ranged DPS", iconKey: "beast-warden", description: "A marcher who reads beasts, weather, and broken country as a living map." },
  "war-captain": { id: "war-captain", name: "War-Captain", role: "Tank", iconKey: "war-captain", description: "A veteran commander who can turn frightened people and bad ground into an unbroken line." },
  archmage: { id: "archmage", name: "Archmage", role: "Mage", iconKey: "battle-archmage", description: "A master of the Art able to shape several schools of magic at battlefield scale." },
  paladin: { id: "paladin", name: "Paladin", role: "Healer", iconKey: "champion-paladin", description: "A consecrated champion whose presence shelters allies and brings radiant ruin to the dark." },
  "dragon-hunter": { id: "dragon-hunter", name: "Dragon-Hunter", role: "Ranged DPS", iconKey: "dragon-hunter", description: "A greatbow hunter trained to read wings, scale, breath, and the fatal instant between them." },
  sorcerer: { id: "sorcerer", name: "High Sorcerer", role: "Mage", iconKey: "high-sorcerer", description: "A formidable practitioner of binding magic — taught, oathed, or self-discovered." },
  warlord: { id: "warlord", name: "Warlord", role: "Bruiser", iconKey: "warlord", description: "A conqueror who leads sworn warriors by force of presence and still greater force of arms." },
  "fae-touched": { id: "fae-touched", name: "Fae-Touched", role: "Skirmisher", iconKey: "fae-touched", description: "A survivor of an otherworldly bargain who moves with glamour, steel, and half-tamed weather." },
  champion: { id: "champion", name: "Undying Champion", role: "Bruiser", iconKey: "undying-champion", description: "A storied hero whom wounds, age, and even the grave have repeatedly failed to keep." },
  warlock: { id: "warlock", name: "Demon-Warlock", role: "Warlock", iconKey: "demon-warlock", description: "A binder who chains infernal power and accepts every debt that power demands." },
  "dragon-ascendant": { id: "dragon-ascendant", name: "Dragon-Ascendant", role: "Demigod", iconKey: "dragon-ascendant", description: "A drake-blooded mortal whose buried wyrm-line has awakened into near-divine dominion." },
  "enchanter-tyrant": { id: "enchanter-tyrant", name: "Enchanter-Tyrant", role: "God-Tyrant", iconKey: "enchanter-tyrant", description: "A sovereign will that conquers by making obedience feel like one's own idea." },
});

export function professionRecord(id) {
  return PROFESSIONS[id] || null;
}
