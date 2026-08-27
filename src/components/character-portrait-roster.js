import { CAPTIVE_POOL } from "../data/slaves.js";
import { COMPANION_LIST } from "../data/companions.js";
import { PRISONER_POOL, WANTED_POOL } from "../data/gaol.js";
import { MOUNT_LIST } from "../data/mounts.js";
import { CHARACTER_TEMPLATES } from "../data/templates.js";
import { REGIONAL_ESTABLISHMENT_CHARACTER_IDENTITIES } from "../data/regional-establishment-characters.js";
import { PORTRAIT_CANDIDATE_CHARACTER_IDENTITIES } from "../data/portrait-candidate-characters.js";
import { STARTING_ARCHETYPES } from "../gameplay/combat/starting-archetypes.js";


const fixed = (key, id, name, category, source, requiredVariants = 2) => Object.freeze({
  key,
  id,
  name,
  category,
  source,
  requiredVariants,
});

const PORTRAIT_VARIANT_COUNT_OVERRIDES = Object.freeze({
  "template:velvet-courtier": 1,
  "companion:tomkin": 1,
  "companion:doran": 1,
  "companion:elske": 0,
  "companion:garran": 0,
  "companion:linnet": 0,
  "bonded:harl": 1,
  "bonded:neela": 1,
  "bonded:okk": 1,
  "bonded:miri": 1,
  "bonded:voss": 1,
  "bonded:tama": 1,
  "bonded:pieter": 1,
  "bonded:rurik": 0,
  "bonded:marn": 1,
  "bonded:yshka": 1,
  "bonded:lis": 1,
  "bonded:loff": 1,
  "bonded:min": 1,
  "bonded:grukk": 1,
  "bonded:pell": 1,
  "bonded:sera": 1,
  "codex:heron-archivist-isera": 0,
  "wanted:redhand": 1,
  "wanted:appr": 1,
  "wanted:sael": 1,
  "wanted:rider": 1,
  "wanted:vane": 1,
  "wanted:eel": 0,
  "wanted:crows": 0,
});

function requiredPortraitVariants(key, fallback = 2) {
  return Object.hasOwn(PORTRAIT_VARIANT_COUNT_OVERRIDES, key)
    ? PORTRAIT_VARIANT_COUNT_OVERRIDES[key]
    : fallback;
}

export const FIXED_CODEX_PORTRAIT_IDENTITIES = Object.freeze([
  ["demon-king", "The Demon King"],
  ["vale-king-asar", "King Asar V of Asalan"],
  ["goblin-king", "The Goblin King"],
  ["selenyan-speaker", "Lirilin of the Long Note"],
  ["glass-spire-master", "The High Master of the Glass Spire"],
  ["great-wyrm", "Vyrnholt, the Great Wyrm"],
  ["hawthorn-lord", "The Hawthorn Lord"],
  ["witch-queen", "The Witch-Queen of the Bone Citadel"],
  ["crowsmoor-baron", "Baron Halrad of Crowsmoor"],
  ["whitemarch-treasurer", "Lord-Treasurer Selia of Whitemarch"],
  ["cinder-chapter-master", "Brother-Master Anders Yoreld"],
  ["stonebrook-hold-father", "Hold-Father Druin Ironvein"],
  ["halfborn-matriarch", "Matriarch Vela of the Halfborn"],
  ["heron-master", "Master Aenya of the Heron"],
  ["the-hag", "The Hag of the Cot"],
  ["king-of-three", "The King-of-Three"],
  ["vale-king-asar-vi", "Prince Asar of Asalan"],
  ["halfborn-matriarch-elect-brann", "Brann the Iron-Tongue"],
  ["stonebrook-hold-father-korro", "Korro Stoneholt"],
  ["whitemarch-treasurer-halen", "Halen Vossane"],
  ["cinder-chapter-master-tovar", "Brother-Lieutenant Tovar Eldred"],
  ["crowsmoor-baron-heir", "Lady Anwen of Crowsmoor"],
  ["heron-master-apprentice", "Naela of the Heron"],
].map(([id, name]) => fixed(`codex:${id}`, id, name, "fixed-codex", "initial-state", 1)));

export const REPURPOSED_CODEX_PORTRAIT_IDENTITIES = Object.freeze([
  ["bonemarsh-charmwright-neris", "Neris of Barrowfen"],
  ["glass-spire-key-master-iorin", "Master Iorin of the Glass Spire"],
  ["halfborn-watch-captain-yarra", "Yarra Hearthward"],
  ["brokenhold-marshal-hesk", "Marshal Hesk Ashmantle"],
  ["crowsmoor-muster-reeve-orren", "Orren Pike, Muster-Reeve"],
  ["stonebrook-roadmaster-dorrin", "Dorrin Stonebrook"],
  ["heron-archivist-isera", "Isera Pell of the Heron"],
  ["whitemarch-deed-keeper-ilyra", "Ilyra Marren, Keeper of Deeds"],
].map(([id, name]) => fixed(
  `codex:${id}`,
  id,
  name,
  "repurposed-codex",
  "repurposed-portrait-characters",
  requiredPortraitVariants(`codex:${id}`, 1),
)));

const playable = CHARACTER_TEMPLATES.map((template) => fixed(
  `template:${template.id}`,
  template.id,
  template.setup.name,
  "playable-template",
  "templates",
  requiredPortraitVariants(`template:${template.id}`),
));

const combat = STARTING_ARCHETYPES.map((archetype) => fixed(
  `archetype:${archetype.id}`,
  archetype.id,
  archetype.name,
  "archetype",
  "starting-archetypes",
  2,
));

export const REGIONAL_ESTABLISHMENT_PORTRAIT_IDENTITIES = Object.freeze(
  REGIONAL_ESTABLISHMENT_CHARACTER_IDENTITIES.map(([id, name]) => fixed(
    `codex:${id}`,
    id,
    name,
    "regional-establishment",
    "regional-establishment-characters",
    1,
  )),
);

export const PORTRAIT_CANDIDATE_IDENTITIES = Object.freeze(
  PORTRAIT_CANDIDATE_CHARACTER_IDENTITIES.map(([id, name]) => fixed(
    `codex:${id}`,
    id,
    name,
    "portrait-candidate-codex",
    "portrait-candidate-characters",
    id === "old-root-ritualist-velisse" ? 2 : 1,
  )),
);


const companions = COMPANION_LIST.map((companion) => fixed(
  `companion:${companion.id}`,
  companion.id,
  companion.name,
  "companion",
  "companions",
  requiredPortraitVariants(`companion:${companion.id}`),
));

const captives = CAPTIVE_POOL.map((captive) => fixed(
  `bonded:${captive.key}`,
  captive.key,
  captive.name,
  "bonded-captive",
  "slaves",
  requiredPortraitVariants(`bonded:${captive.key}`),
));

const prisoners = PRISONER_POOL.map((prisoner) => fixed(
  `bonded:${prisoner.key}`,
  prisoner.key,
  prisoner.name,
  "gaol-prisoner",
  "gaol",
  requiredPortraitVariants(`bonded:${prisoner.key}`),
));

const wanted = WANTED_POOL.map((person) => fixed(
  `wanted:${person.key}`,
  person.key,
  person.name,
  "wanted-person",
  "gaol",
  requiredPortraitVariants(`wanted:${person.key}`),
));

const mounts = MOUNT_LIST.map((mount) => fixed(
  `mount:${mount.id}`,
  mount.id,
  mount.name,
  "mount",
  "mounts",
));

const thresholdVoice = fixed(
  "codex:threshold-voice",
  "threshold-voice",
  "The Threshold Voice",
  "fixed-codex-special",
  "initial-state",
);

export const CHARACTER_PORTRAIT_IDENTITIES = Object.freeze([
  ...FIXED_CODEX_PORTRAIT_IDENTITIES,
  ...REPURPOSED_CODEX_PORTRAIT_IDENTITIES,
  ...REGIONAL_ESTABLISHMENT_PORTRAIT_IDENTITIES,
  ...PORTRAIT_CANDIDATE_IDENTITIES,
  ...playable,
  ...combat,
  ...companions,
  ...captives,
  ...prisoners,
  ...wanted,
  ...mounts,
  thresholdVoice,
]);

export const CHARACTER_PORTRAIT_IDENTITY_BY_KEY = Object.freeze(Object.fromEntries(
  CHARACTER_PORTRAIT_IDENTITIES.map((identity) => [identity.key, identity]),
));

const BONDED_KEYS = Object.freeze([...captives, ...prisoners].map((identity) => identity.id));
const CODEX_CHARACTER_IDS = new Set([
  ...FIXED_CODEX_PORTRAIT_IDENTITIES,
  ...REPURPOSED_CODEX_PORTRAIT_IDENTITIES,
  ...REGIONAL_ESTABLISHMENT_PORTRAIT_IDENTITIES,
  ...PORTRAIT_CANDIDATE_IDENTITIES,
].map((identity) => identity.id));
const COMPANION_IDS = new Set(companions.map((identity) => identity.id));
const MOUNT_IDS = new Set(mounts.map((identity) => identity.id));
const WANTED_IDENTITY_BY_CHARACTER_ID = new Map(
  wanted.map((identity) => [`wanted-${identity.id}`, identity.key]),
);

export function characterPortraitIdentityKey(record = {}) {
  if (typeof record.portraitKey === "string" && CHARACTER_PORTRAIT_IDENTITY_BY_KEY[record.portraitKey]) {
    return record.portraitKey;
  }
  if (record.id === "threshold-voice") return "codex:threshold-voice";
  if (CODEX_CHARACTER_IDS.has(record.id)) return `codex:${record.id}`;
  if (record.kind === "companion" && COMPANION_IDS.has(record.id)) return `companion:${record.id}`;
  if (record.kind === "mount" && MOUNT_IDS.has(record.id)) return `mount:${record.id}`;
  if (WANTED_IDENTITY_BY_CHARACTER_ID.has(record.id)) return WANTED_IDENTITY_BY_CHARACTER_ID.get(record.id);
  for (const key of BONDED_KEYS) {
    if (record.id === `bonded-${key}` || String(record.id || "").startsWith(`bonded-${key}-`)) {
      return `bonded:${key}`;
    }
  }
  return null;
}

export const CHARACTER_PORTRAIT_CATEGORY_COUNTS = Object.freeze(
  CHARACTER_PORTRAIT_IDENTITIES.reduce((counts, identity) => {
    counts[identity.category] = (counts[identity.category] || 0) + 1;
    return counts;
  }, {}),
);
