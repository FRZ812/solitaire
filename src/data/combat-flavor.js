// Enemy disposition: morale config, demeanor defaults, and the flavour lines
// that make a fight read as a living thing rather than a stat sheet. Kept
// dependency-free so both the bestiary (which stamps demeanor onto generated
// foes) and the combat engine (which reads thresholds + lines) can import it.
//
// A demeanor decides how a foe behaves as the fight turns against it:
//   morale   — starting (and max) nerve
//   breakAt  — at/below this morale a social foe yields or flees
//   prefer   — "yield" | "flee" | "either" when it breaks
//   canYield / canFlee / canParley — which resolutions are even possible
//   proud    — resents being bullied (control-spam); may demand a fair fight
//   fleeAt   — beasts only: HP% under which they bolt
//   yieldHp  — HP% at/under which a thinking foe, when losing or hopeless, will
//              break (flee/yield). Brave folk fight to near-death (low value);
//              the timid — a craven, a frightened noble — break early (high
//              value). People don't surrender just because a fight is uncertain.

export const DEMEANOR_CONFIG = {
  feral:     { morale: 60,  breakAt: -1, fleeAt: 0.22, yieldHp: 0.22, prefer: "flee",  canYield: false, canFlee: true,  canParley: false, proud: false },
  cowardly:  { morale: 45,  breakAt: 42, yieldHp: 0.55, prefer: "flee",  canYield: true,  canFlee: true,  canParley: true,  proud: false },
  wary:      { morale: 60,  breakAt: 30, yieldHp: 0.30, prefer: "either",canYield: true,  canFlee: true,  canParley: true,  proud: false },
  fierce:    { morale: 72,  breakAt: 18, yieldHp: 0.18, prefer: "yield", canYield: true,  canFlee: true,  canParley: true,  proud: true  },
  brutish:   { morale: 65,  breakAt: 24, yieldHp: 0.20, prefer: "flee",  canYield: false, canFlee: true,  canParley: true,  proud: false },
  honorable: { morale: 78,  breakAt: 26, yieldHp: 0.18, prefer: "yield", canYield: true,  canFlee: false, canParley: true,  proud: true  },
  fanatic:   { morale: 100, breakAt: -1, yieldHp: 0,    prefer: "none",  canYield: false, canFlee: false, canParley: false, proud: false },
  mindless:  { morale: 100, breakAt: -1, yieldHp: 0,    prefer: "none",  canYield: false, canFlee: false, canParley: false, proud: false },
};

export const DEMEANOR_LABEL = {
  feral: "feral", cowardly: "craven", wary: "wary", fierce: "fierce",
  brutish: "brutish", honorable: "honorable", fanatic: "fanatic", mindless: "mindless",
};
export function demeanorLabel(d) { return DEMEANOR_LABEL[d] || "wary"; }

// Infer a demeanor from a foe's kind + race when the template doesn't set one.
export function defaultDemeanor(kind = "", race = "") {
  const k = `${kind} ${race || ""}`.toLowerCase();
  const has = (...w) => w.some((s) => k.includes(s));
  if (has("skeleton", "thrall", "undead", "wight", "ghoul", "corpse")) return "mindless";
  if (has("cultist", "fanatic", "zealot", "burning")) return "fanatic";
  if (has("wolf", "hound", "dog", "warg", "bear", "boar", "owlbear", "spider", "eel", "leech", "stirge", "beast", "ibex", "wyvern", "drakeling", "gryphon")) {
    return has("wyvern", "drakeling", "gryphon", "warg") ? "fierce" : "feral";
  }
  if (has("ogre", "troll", "giant")) return "brutish";
  if (has("orc")) return "fierce";
  if (has("knight", "guard", "soldier", "captain", "warden", "paladin")) return "honorable";
  if (has("goblin", "bandit", "brigand", "cutthroat", "thief", "robber", "highway", "pickpocket", "press", "raider")) return "cowardly";
  return "wary";
}

// {name} is substituted with the foe's name. Categories:
//   waver  — nerve fraying (still fighting)
//   plead  — trying to talk their way out (still fighting)
//   provoke— proud foe, bullied by control/tricks, demands a fair fight
//   flee   — breaks and runs (resolved)
//   yield  — lays down arms / surrenders (resolved)
//   defy   — refuses a surrender demand
//   allyFell — reacts to a companion falling
const FLAVOR = {
  waver: {
    feral:    ["{name} flinches back, hackles up, no longer sure of the kill.", "{name} circles wider now, wary of you."],
    cowardly: ["{name}'s eyes dart to the way out.", "{name}'s grip slips on the hilt, knuckles white."],
    honorable:["{name} steadies their breathing, but the blade dips.", "{name} measures you again, reassessing."],
    fierce:   ["{name} bares teeth through the pain, but the footing falters.", "{name} grunts, blood in the mouth, and presses on."],
    brutish:  ["{name} shakes its head like a struck ox, slowing.", "{name} rumbles low, uncertain."],
    default:  ["{name} wavers, the fight draining from the stance.", "{name} hesitates, weighing the odds anew."],
  },
  plead: {
    cowardly: ["{name} throws up a hand. \"Wait — wait! We can talk about this!\"", "{name} stumbles back. \"I don't want to die over this!\""],
    wary:     ["{name} keeps the blade up but calls out. \"There's no need for this to end in blood.\"", "{name} edges back. \"Name your terms, traveller — quickly.\""],
    default:  ["{name} signals for a pause. \"Enough — speak, before this goes further.\""],
  },
  provoke: {
    honorable:["{name} snarls. \"Fight me straight, coward — or is trickery all you have?\"", "{name} spits. \"Bind me and beat me — there is no honor in it. Face me fairly!\""],
    fierce:   ["{name} roars through the binding. \"Tricks! Stand and fight me like a warrior!\"", "{name} strains against the spell. \"Cut the witchery and we'll see who's stronger!\""],
    default:  ["{name} glares. \"Quit your games and fight me proper.\""],
  },
  flee: {
    feral:    ["{name} breaks and bolts into the cover, gone.", "{name} wheels and flees, tail low."],
    cowardly: ["{name} turns and runs, throwing away the blade.", "{name} scrambles off without a backward glance."],
    brutish:  ["{name} lumbers away as fast as it can, crashing through the brush.", "{name} gives up and retreats, dragging one leg."],
    default:  ["{name} loses nerve and flees the field.", "{name} breaks off and runs."],
  },
  yield: {
    honorable:["{name} lowers the blade and goes to one knee. \"Enough. I yield — with honor.\"", "{name} salutes you with the sword, then casts it down. \"Well fought. I yield.\""],
    cowardly: ["{name} drops to the dirt, hands raised. \"I yield! I yield — please!\"", "{name} flings the weapon away and begs off. \"Spare me — I'm done!\""],
    fierce:   ["{name} sinks down, breath ragged. \"You've... bested me. I'll fight no more.\"", "{name} drops the weapon, glaring still. \"Take it. I yield.\""],
    default:  ["{name} lays down arms and yields.", "{name} raises empty hands in surrender."],
  },
  defy: {
    honorable:["{name} sets the jaw. \"I'll not yield to the likes of you.\"", "{name} shakes the head. \"Not yet. Not to that.\""],
    fanatic:  ["{name} laughs, wild-eyed. \"Yield? I welcome the dark!\"", "{name} will not hear it — there is only the cause."],
    default:  ["{name} refuses, and tightens the grip on the weapon.", "{name} answers your demand with a curse."],
  },
  allyFell: {
    cowardly: ["{name} stares at the fallen and the courage goes out of them.", "{name} blanches at the body and steps back."],
    honorable:["{name}'s face hardens with grief over the fallen.", "{name} stands over the fallen, jaw tight."],
    default:  ["{name} falters at the sight of the fallen.", "{name} glances at the body, shaken."],
  },
};

export function flavorLine(category, demeanor, name) {
  const cat = FLAVOR[category];
  if (!cat) return null;
  const pool = cat[demeanor] || cat.default;
  if (!pool || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)].replace(/\{name\}/g, name);
}
