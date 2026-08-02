// Assembles generated placenames from the element banks in data/toponymy.js.
//
// Deterministic: every choice comes from the injected `random(stream)`, which the
// caller derives from (seed, version, x, y). Nothing here reads global state.

import {
  INN_SIGN_ADJECTIVES,
  INN_SIGN_NOUNS,
  MOTIF_NAME_OVERRIDES,
  SITE_NAME_PATTERNS,
  TOPONYM_HEADS,
  TOPONYM_NOUNS,
  TOPONYM_STEMS,
} from "../data/toponymy.js";

const choose = (values, unit) => (
  values?.length ? values[Math.min(values.length - 1, Math.floor(unit * values.length))] : null
);

// "the Pale God" is already a proper form and must not become "the The Pale God";
// "river saints" needs raising to a title.
function faithName(faith) {
  if (!faith) return null;
  if (/^the\s/i.test(faith)) return faith;
  return faith.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

// Region prefixes are what make a Mire name sound like the Mire rather than like
// the heartland generally, so they win a little under half the time.
function headElement(region, realmId, random) {
  const regional = region?.areas?.prefixes || [];
  const realmHeads = TOPONYM_HEADS[realmId] || TOPONYM_HEADS.central;
  if (regional.length && random("site:name:source") < 0.45) {
    return choose(regional, random("site:name:regional"));
  }
  return choose(realmHeads, random("site:name:head"));
}

export function siteNameFor({ family, kind, region, realmId, culture, random }) {
  const patterns = SITE_NAME_PATTERNS[family] || SITE_NAME_PATTERNS.settlement;
  const head = headElement(region, realmId, random) || "Grey";
  const override = MOTIF_NAME_OVERRIDES[kind];
  const stems = override?.stems || TOPONYM_STEMS[family] || TOPONYM_STEMS.settlement;
  const nouns = override?.nouns || TOPONYM_NOUNS[family] || TOPONYM_NOUNS.settlement;
  const stem = choose(stems, random("site:name:stem"));

  // Long heads compound badly -- "Stillwaterhithe" -- and a head whose ending
  // repeats the stem's opening slurs into itself -- "Birchchapel". Both take the
  // spaced form instead.
  const lowerHead = head.toLowerCase();
  const slurs = stem.length >= 2 && lowerHead.endsWith(stem.slice(0, 2));
  const spacedOnly = head.length >= 7 || slurs || lowerHead.endsWith(stem[0]);
  const usable = spacedOnly ? patterns.filter((pattern) => pattern.includes("{noun}")) : patterns;
  const pattern = choose(usable.length ? usable : patterns, random("site:name:pattern"));

  const sign = `${choose(INN_SIGN_ADJECTIVES, random("site:name:sign-adj"))} ${choose(INN_SIGN_NOUNS, random("site:name:sign-noun"))}`;
  const faith = faithName(choose(culture?.faiths || [], random("site:name:faith"))) || "the Quiet Saints";

  return pattern
    .replace("{head}", head)
    .replace("{stem}", stem)
    .replace("{noun}", choose(nouns, random("site:name:noun")))
    .replace("{sign}", sign)
    .replace("{faith}", faith);
}
