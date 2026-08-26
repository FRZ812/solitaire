import { CAPTIVE_POOL } from "../data/slaves.js";
import { COMPANION_LIST } from "../data/companions.js";
import { PRISONER_POOL, WANTED_POOL } from "../data/gaol.js";
import { MOUNT_LIST } from "../data/mounts.js";
import { CHARACTER_TEMPLATES } from "../data/templates.js";
import { STARTING_ARCHETYPES } from "../gameplay/tow/starting-archetypes.js";

const fixed = (key, id, name, category, source) => Object.freeze({
  key,
  id,
  name,
  category,
  source,
  requiredVariants: 2,
});

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
].map(([id, name]) => fixed(`codex:${id}`, id, name, "fixed-codex", "initial-state")));

const playable = CHARACTER_TEMPLATES.map((template) => fixed(
  `template:${template.id}`,
  template.id,
  template.setup.name,
  "playable-template",
  "templates",
));

const tow = STARTING_ARCHETYPES.map((archetype) => fixed(
  `tow:${archetype.id}`,
  archetype.id,
  archetype.name,
  "tow-archetype",
  "starting-archetypes",
));

const companions = COMPANION_LIST.map((companion) => fixed(
  `companion:${companion.id}`,
  companion.id,
  companion.name,
  "companion",
  "companions",
));

const captives = CAPTIVE_POOL.map((captive) => fixed(
  `bonded:${captive.key}`,
  captive.key,
  captive.name,
  "bonded-captive",
  "slaves",
));

const prisoners = PRISONER_POOL.map((prisoner) => fixed(
  `bonded:${prisoner.key}`,
  prisoner.key,
  prisoner.name,
  "gaol-prisoner",
  "gaol",
));

const wanted = WANTED_POOL.map((person) => fixed(
  `wanted:${person.key}`,
  person.key,
  person.name,
  "wanted-person",
  "gaol",
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
  ...playable,
  ...tow,
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
const FIXED_CODEX_IDS = new Set(FIXED_CODEX_PORTRAIT_IDENTITIES.map((identity) => identity.id));
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
  if (FIXED_CODEX_IDS.has(record.id)) return `codex:${record.id}`;
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
