export const NARRATOR_SCENE_CUE_TEXT = Object.freeze({
  "wind-rises": "Wind rises through the scene.",
  "rain-falls": "Rain falls across the scene.",
  "light-shifts": "The light shifts across the scene.",
  "fire-crackles": "A nearby fire crackles.",
  "crowd-stirs": "The surrounding crowd stirs.",
  "crowd-quiets": "The surrounding crowd grows quiet.",
  "footsteps-sound": "Footsteps sound nearby.",
  "silence-settles": "Silence settles over the scene.",
  "door-opens": "A nearby door opens.",
  "door-closes": "A nearby door closes.",
  "smoke-thickens": "Smoke thickens through the scene.",
  "shadows-shift": "Shadows shift across the scene.",
});

export const NARRATOR_CHARACTER_CUE_ACTIONS = Object.freeze([
  "arrives", "departs", "approaches", "withdraws", "waits", "watches", "searches", "works",
  "sits", "stands", "kneels", "falls", "rises", "nods", "shakes-head", "smiles", "frowns",
  "laughs", "weeps", "gestures", "draws-weapon", "sheathes-weapon", "yields", "flees",
  "dies",
]);

export const NARRATOR_TARGETABLE_CHARACTER_CUE_ACTIONS = Object.freeze([
  "approaches", "withdraws", "watches", "gestures",
]);

export const NARRATOR_CHARACTER_CUE_MANNERS = Object.freeze([
  "quietly", "cautiously", "openly", "abruptly", "reluctantly", "eagerly", "wearily",
  "angrily", "gently", "solemnly", "nervously",
]);

export function renderNarratorCharacterCue(cue, characters) {
  const actor = characters[cue.actor_id];
  const target = cue.target_id ? characters[cue.target_id] : null;
  const phrases = {
    arrives: "arrives",
    departs: "departs",
    approaches: target ? `approaches ${target.name}` : "approaches",
    withdraws: target ? `withdraws from ${target.name}` : "withdraws",
    waits: "waits",
    watches: target ? `watches ${target.name}` : "watches the scene",
    searches: "searches nearby",
    works: "works",
    sits: "sits down",
    stands: "stands",
    kneels: "kneels",
    falls: "falls",
    rises: "rises",
    nods: "nods",
    "shakes-head": "shakes their head",
    smiles: "smiles",
    frowns: "frowns",
    laughs: "laughs",
    weeps: "weeps",
    gestures: target ? `gestures toward ${target.name}` : "gestures",
    "draws-weapon": "draws a weapon",
    "sheathes-weapon": "sheathes their weapon",
    yields: "yields",
    flees: "flees",
    dies: "dies",
  };
  return `${actor.name} ${phrases[cue.action]}${cue.manner ? ` ${cue.manner}` : ""}.`;
}
