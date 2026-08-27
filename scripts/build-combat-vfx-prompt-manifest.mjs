#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getSkill, skillIds } from "../src/gameplay/combat/skills.js";
import { getCombatArchetypeIdentity } from "../src/gameplay/combat/archetype-identities.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUTPUT = path.join(ROOT, "docs", "design", "combat-vfx-imagegen-prompts.json");

const GENERAL_STYLE = Object.freeze({
  label: "General combat technique",
  palette: "neutral steel, warm impact white, and one restrained signature hue",
  material: "grounded physical particles, believable force, and restrained high-fantasy energy",
  theme: "clear universal combat language that does not imply a specific character or archetype",
});

function styleFor(skill) {
  const identity = getCombatArchetypeIdentity(skill?.archetypeId || skill?.exclusiveTo);
  if (!identity) return GENERAL_STYLE;
  return Object.freeze({
    label: identity.name,
    palette: identity.palette.join(", "),
    material: identity.materials,
    theme: identity.vfxTheme,
  });
}

const EXACT_DIRECTIONS = Object.freeze({
  "assassin-execution": "A clean lethal decapitation flash cut: two hairline silver-red trajectories, a needle-bright contact, then a delayed razor-thin horizontal sever line. Never a thick X or emblem.",
  "assassin-storm-of-knives": "A four-stage knife sequence: high-left streak, low-right streak, center thrust, then a compact cross cut, each trajectory visibly handing momentum to the next.",
  "vampire-claw": "A six-beat-feeling razor blood-claw scratch, used only for Scratch: three narrow curved crimson talon trails with liquid droplets and a clean fade.",
  "vampire-blood-whirlwind": "A rapid full-circle vortex of separate dark-crimson blade ribbons whose orbit tightens, peaks, and unwinds with conserved rotation.",
  "vampire-blood-spear": "A high-velocity crimson spear condenses from droplets, launches point-first, pierces through center, then bursts into forward-moving blood droplets.",
  "vampire-heart-destroyer": "A focal needle puncture into a recognizable sanguine heart core, followed by one expanding pressure ring and branching heart fractures.",
  "vampire-rampage": "A four-part combo with readable handoffs: blood sweep left, blood sweep right, straight blood lance, then a reverse-flowing blood backflow.",
  "mage-thorn-veil": "Thick wooden briar vines erupt into a defensive lattice with needle brambles and real splintering spines; organic bark, never blood claws.",
  "sleepless-entangling-roots": "Gnarled wooden roots erupt upward, curl around one shared center, tighten, then settle with bark splinters and falling soil.",
  penetration: "A narrow armor-breaking kinetic spear vector strikes one plate seam and drives fragments forward rather than exploding radially.",
  "rapid-cooling": "A cryogenic snap blooms from condensed vapor into branching ice crystals, peaks as a frost shell, then sheds snow dust.",
  "urgent-guard": "A quick reactive steel guard flashes only at the contact point, catches force, sends one deflection ripple aside, and settles.",
  "stone-skin-elixir": "Granite plates grow in connected sections around one implied body anchor, lock together, glint, then retain a quiet stone residue.",
  "protection-scroll": "A parchment scroll unfurls, its ward ink ignites in sequence, and the written light rises into a curved protective barrier.",
  "elixir-of-wrath": "A compact ember-red bloodlust aura climbs around an implied weapon anchor, flares at the midpoint, then stabilizes as heat shimmer.",
  "first-aid": "Emerald restorative threads cross and stitch one wound point closed; gentle motes rise after closure without forming a medical logo.",
  "emergency-evasion": "Three offset phantom silhouettes dash along one continuous lane, each afterimage thinner and more transparent than the last.",
  "sudden-blow": "A fast compact thrust compresses air, contacts at center, and releases two narrow forward-moving shock rings.",
  "unbendable-will": "A grounded golden combat-like aura rises in stacked vertical planes, braces against a lateral pressure wave, and remains upright.",
  "killing-instinct": "A restrained crimson predator-eye glint narrows onto one weak point, locks focus, then leaves a fine targeting afterglow.",
  "sleep-grenade": "A small glass vial arcs, cracks at center, and releases layered lavender dream vapor and crescent motes with no letters or text.",
  "blade-of-curse": "A wicked violet cleave carries thorn-like necrotic needles through its wake, then the cut path smolders into sparse curse mist.",
  beastification: "A feral wolf-shaped energy impulse emerges from a sanguine aura, lunges through center, and resolves into fang-like ember trails.",
  "judge-of-fate": "Two delicate golden balance pans assemble, tip toward the target, emit a measured judgment pulse, and dissolve into dust-light.",
  "super-speed": "Compressed cyan-white chevrons build into a single sonic lane, pass through a Mach ring, then stretch into receding speed haze.",
  transcendence: "Astral motes orbit upward through three widening cosmic rings, flare into a weightless ascension column, then settle as starlight.",
  "peace-declaration": "Soft white laurel-like light curves close into one calming harmony ring that expands gently and silences surrounding turbulence.",
});

const VISUAL_RULES = Object.freeze([
  [/execution|instant-kill|finishing|mortal|finale|final-counter|limited-life/, "a decisive execution trajectory with a delayed lethal aftereffect"],
  [/whirlwind|maelstrom|vortex|storm|dance|rampage/, "a controlled rotating multi-hit vortex with readable sequential contacts"],
  [/double|triple|flurry|rapid|barrage|rain|crossfire|all-out|human-wave/, "a staged multi-hit sequence whose separate contacts never collapse into one blob"],
  [/arrow|shot|shoot|snipe|bullet|round|spear|lance|railgun|projectile/, "a directional projectile that visibly forms, launches, travels, contacts, and exits or fragments"],
  [/ray|beam|laser|disintegr|orbital/, "a narrow energy beam that charges, establishes a continuous line, cuts through contact, and powers down"],
  [/block|shield|barrier|deflect|parry|guard|defensive|impregnable|field|matrix|scales|plating/, "a defensive surface that assembles from segments, receives one directional impact, ripples, and settles"],
  [/heal|repair|regener|recovery|first-aid|transference/, "restorative filaments that gather, reconnect damage, pulse once, and recede into gentle motes"],
  [/summon|monster|spirit|skeleton|mirror-image|gate|totem/, "a conjuration that begins as a grounded aperture, gains a readable silhouette, manifests, and leaves residual motes"],
  [/smoke|mist|stealth|evasion|evade|blink|flight|flash-step|acrobat/, "a directional displacement or concealment trail with successively fading afterimages"],
  [/cry|scream|shouting|warcry|intimid/, "a pressure wave that gathers at one origin and expands in asymmetric concentric fronts"],
  [/curse|doom|ritual|sigil|hex|fate|oracle|judgment|sentence/, "an occult or sacred mark that writes itself in parts, locks onto one anchor, pulses, fractures, and fades"],
  [/fire|flame|inciner|ignition|heat|scorched|burn/, "a physically rising flame action with a hot core, curling tongues, embers, and smoke that conserve upward flow"],
  [/frost|ice|cool|glacier|arctic/, "a cold action with condensed vapor, branching rime growth, crystal contact, and drifting snow dust"],
  [/lightning|voltage|shock|electro|plasma|overload|charge/, "an electrical action whose leader arcs connect progressively, peak at contact, then decay into smaller branches"],
  [/root|thorn|briar|nature|bear-trap/, "an organic ground-up eruption of real bark, thick roots, thorns, splinters, and falling soil"],
  [/blood|vampir|bite|claw|wound|sever|devour|lifesteal/, "a sanguine action made from liquid ribbons and sparse weighted droplets, with no generic red emblem"],
  [/smash|crush|impact|kick|headbutt|pulver|earthquake|detonation|bomb|grenade|cannon/, "a weighty impact that compresses before contact, displaces debris directionally, and settles under gravity"],
  [/stance|focus|analysis|calibration|preparation|improvement|redesign|awakening|power/, "a self-centered preparation aura that assembles in layers, reaches one stable peak, and leaves a quiet sustained trace"],
  [/slash|strike|cut|cleave|sweep|blow|riposte|counter|scythe|sword/, "a disciplined melee trajectory with anticipation, acceleration, a precise contact, follow-through, and a tapering afterimage"],
]);

const PHASES = Object.freeze({
  execution: [
    "near-empty anticipation with one tiny tension glint",
    "the first hairline attack path starts entering the cell",
    "the path accelerates toward the shared contact anchor",
    "a complementary lethal trajectory begins while the first remains as a dim afterimage",
    "needle-bright primary contact with a concise directional spray",
    "full follow-through extends beyond contact without changing direction",
    "the delayed lethal consequence appears along the established cut line",
    "the line breaks into sparse fragments and weighted motes",
    "an almost empty endpoint with only a faint hairline residue",
  ],
  guard: [
    "two faint motes establish the defensive anchor",
    "the first lower segment rises into place",
    "neighboring segments connect while the upper edge remains open",
    "the defensive surface closes and braces toward incoming force",
    "one off-center impact flashes and pushes a ripple across the surface",
    "the ripple travels away from contact while the barrier holds",
    "impact fragments shed outward and the surface relaxes",
    "segments dim and retract in reverse assembly order",
    "only a thin grounded protective afterglow remains",
  ],
  projectile: [
    "small particles gather around the launch origin",
    "the projectile silhouette condenses with its point aligned to travel",
    "a launch impulse stretches backward while the tip advances",
    "the projectile crosses toward center with a continuous tapering trail",
    "primary contact at center compresses into a bright directional point",
    "the projectile penetrates or exits beyond center as debris follows forward",
    "the trail separates into smaller forward-moving fragments",
    "fragments decelerate and lose brightness along the same lane",
    "only a faint exit glint and two or three motes remain",
  ],
  multi: [
    "a restrained anticipation cue establishes the first attack direction",
    "the first contact path completes and starts to fade",
    "the second attack begins from a clearly different authored angle",
    "the second contact hands momentum into the central sequence",
    "the strongest middle contact combines the established trajectories without becoming a blob",
    "the next distinct strike crosses or orbits through the same anchor",
    "the final strike resolves the combo with a readable exit direction",
    "all trails separate into staggered afterimages and sparse particles",
    "a clean endpoint retains only the last trajectory's faint residue",
  ],
  aura: [
    "three faint grounded motes establish the center anchor",
    "particles begin one coherent orbit or upward stream",
    "a lower ring or base layer forms without closing the whole silhouette",
    "energy climbs and thickens around the same center",
    "the aura reaches its brightest stable peak with one outward pulse",
    "the pulse expands while the central form remains coherent",
    "outer energy separates into smaller rising or orbiting motes",
    "the central form dims from top to bottom",
    "a quiet sustained trace remains at the original anchor",
  ],
  summon: [
    "a faint grounded aperture or glyph begins at the shared anchor",
    "the aperture expands and emits the first material fragments",
    "a partial silhouette rises while still visibly connected to the aperture",
    "the silhouette gains its defining contour and momentum",
    "the summoned form reaches full readable manifestation",
    "it performs one concise action or pressure pulse",
    "the silhouette breaks into its native material and recedes",
    "the aperture contracts while loose fragments fall or drift",
    "only a few residual motes remain over the closed anchor",
  ],
  impact: [
    "dust or energy draws inward toward the future impact point",
    "the striking mass or pressure front enters with a clear direction",
    "compression increases immediately before contact",
    "the leading edge touches the shared anchor and begins displacement",
    "the heaviest contact frame drives debris asymmetrically away from force",
    "the force continues through as larger fragments travel and rotate",
    "debris separates by weight, with heavy pieces falling first",
    "dust and smaller sparks settle around the original contact point",
    "the endpoint is nearly clear with one small grounded residue",
  ],
  displacement: [
    "a compact silhouette-shaped distortion leans into travel",
    "the leading edge advances while the original anchor starts to fade",
    "one elongated afterimage bridges origin and destination",
    "the destination form starts resolving ahead of the trailing haze",
    "peak displacement shows the clearest destination and longest coherent trail",
    "the destination stabilizes while the origin breaks into smoke or motes",
    "the connecting trail thins along the same route",
    "only two staggered translucent afterimages remain",
    "the lane clears to a faint directional wisp",
  ],
  beam: [
    "tiny sparks align along the future beam axis",
    "a compact emitter glow condenses at the origin",
    "a thin leader ray reaches partway toward center",
    "the leader ray connects and the channel begins widening",
    "the continuous beam reaches peak core brightness at contact",
    "the beam sustains while forward vapor and fragments leave the contact side",
    "the core narrows and breaks into segmented light",
    "the channel collapses back toward the origin",
    "one faint axial afterline remains before full transparency",
  ],
  organic: [
    "the ground or base anchor bulges with one small crack",
    "the first thick organic shoot breaks through with loose soil or droplets",
    "secondary branches follow the first branch's growth direction",
    "the structure curls toward and begins enclosing the contact anchor",
    "the growth reaches maximum tension with sharp secondary detail",
    "the structure tightens or lashes through one decisive motion",
    "small splinters, leaves, or droplets shed while the main mass relaxes",
    "the outer branches retract or settle under their own weight",
    "a grounded remnant and a few falling particles remain",
  ],
  strike: [
    "one faint glint or dust pull establishes the attack origin",
    "the attack edge begins moving along its authored trajectory",
    "the trail lengthens and brightens as speed increases",
    "the leading edge approaches the shared contact anchor",
    "precise primary contact flashes with concise directional debris",
    "the attack follows fully through the contact point",
    "a delayed afterline or secondary material response becomes visible",
    "the trail tapers into sparse fragments that keep the same momentum",
    "the endpoint is almost empty with only a faint directional residue",
  ],
});

function mechanicsSummary(skill) {
  const effects = skill.effects || [];
  const hits = Math.max(1, ...effects.map((effect) => Number(effect.hits) || 1));
  const statuses = [...new Set(effects.flatMap((effect) => [
    effect.status,
    ...(effect.statuses || []),
  ]).filter(Boolean))];
  const verbs = [];
  if (effects.some((effect) => effect.type === "damage" || effect.type?.startsWith("damage-"))) verbs.push(hits > 1 ? `${hits} distinct damage contacts` : "one damage contact");
  if (effects.some((effect) => effect.type === "shield")) verbs.push("defensive interception");
  if (effects.some((effect) => effect.type?.startsWith("heal"))) verbs.push("restorative return flow");
  if (statuses.length) verbs.push(`the ${statuses.join(", ")} state`);
  return verbs.length ? verbs.join(" plus ") : "a readable tactical state change";
}

function visualDirection(skill) {
  if (EXACT_DIRECTIONS[skill.id]) return EXACT_DIRECTIONS[skill.id];
  // Legacy ids can contain obsolete character themes (arctic, demon, priestess, etc.).
  // They are migration keys, never art direction, so only canonical display language is
  // allowed to select the visual rule.
  const identity = `${skill.archetypeId || "general"} ${skill.name}`.toLowerCase();
  const rule = VISUAL_RULES.find(([pattern]) => pattern.test(identity));
  return `${skill.name}: ${rule?.[1] || "a singular authored fantasy-combat effect with a clear origin, contact, consequence, and fade"}. It must visually communicate ${mechanicsSummary(skill)}.`;
}

function motionType(skill, direction) {
  const identity = `${skill.id} ${skill.name} ${direction}`.toLowerCase();
  const hits = Math.max(1, ...(skill.effects || []).map((effect) => Number(effect.hits) || 1));
  if (/execution|instant-kill|mortal|finishing|finale|limited-life/.test(identity)) return "execution";
  if (/block|shield|barrier|deflect|parry|guard|defensive|impregnable|field|matrix|scales|plating/.test(identity)) return "guard";
  if (/ray|beam|laser|disintegr|orbital/.test(identity)) return "beam";
  if (/summon|monster|spirit|skeleton|mirror-image|gate|totem/.test(identity)) return "summon";
  if (/smoke|mist|stealth|evasion|evade|blink|flight|flash-step|acrobat/.test(identity)) return "displacement";
  if (/root|thorn|briar|nature|entangl/.test(identity)) return "organic";
  if (hits > 1 || /double|triple|flurry|rapid|barrage|rain|crossfire|whirlwind|maelstrom|storm|dance|rampage/.test(identity)) return "multi";
  if (/arrow|shot|shoot|snipe|bullet|round|spear|lance|railgun|skull-throw/.test(identity)) return "projectile";
  if (/smash|crush|impact|kick|headbutt|pulver|earthquake|detonation|bomb|grenade|cannon/.test(identity)) return "impact";
  const hasDamage = (skill.effects || []).some((effect) => effect.type === "damage" || effect.type?.startsWith("damage-"));
  if (!hasDamage || /heal|repair|regener|stance|focus|analysis|calibration|preparation|awakening|power|cry|scream|ritual|sigil|curse|doom|fate|judgment/.test(identity)) return "aura";
  return "strike";
}

function commonPromptContract(skill, style, direction, motion) {
  const frames = PHASES[motion];
  return `Create one production-ready transparent PNG sprite sheet for the dark-fantasy browser RPG combat VFX ability "${style.label} — ${skill.name}" (${skill.id}).

LAYOUT CONTRACT: one square image, conceptually divided into a perfectly aligned 3 columns by 3 rows grid of nine equal square cells. Reading order is left-to-right, top-to-bottom, frames 1 through 9. Real transparent alpha in every cell; no checkerboard, backdrop, scenery, floor, grid lines, borders, gutters, numbers, labels, typography, UI, icon, poster, crest, badge, symmetrical emblem, character, body, face, hands, or full weapon. Keep the identical orthographic camera, scale, center anchor, rendering style, and effect origin across all cells. Keep every effect fully inside its own cell with generous transparent safety margin and no spill into adjacent cells.

ART DIRECTION: crisp hand-painted raster game VFX with physically layered particles and soft volumetric depth, never flat vector art or SVG-like geometry. ${direction} The reusable ${style.label} visual grammar is ${style.theme}. Use ${style.palette}; materials are ${style.material}. Preserve an asymmetric action silhouette and readable travel direction. Avoid generic radial explosions unless the ability explicitly requires one.

NATURAL NINE-FRAME MOTION:
${frames.map((frame, index) => `${index + 1}. ${frame}.`).join("\n")}

CONTINUITY CONTRACT: every adjacent frame must follow incrementally from the last, conserving direction, placement, mass, rotation, effect origin, and particle momentum. This is one anticipation to action to contact to follow-through to dissipation animation, not nine unrelated illustrations. Frame 5 is the primary visual peak. Frame 9 must be almost transparent for a smooth removal. Preserve sharp alpha edges for additive GPU compositing after each cell is cropped to 256 by 256 and played at 18 fps.`;
}

function parseSpecDirections(specPath) {
  if (!specPath || !fs.existsSync(specPath)) return new Map();
  const source = fs.readFileSync(specPath, "utf8").replace(/\r\n/g, "\n");
  const directions = new Map();
  const headingPattern = /^###\s+\d+\.\s+`([^`]+)`([^\n]*)(?:\n([\s\S]*?))?(?=^###\s+\d+\.|^##\s+Character|^#\s+2\.|\z)/gm;
  for (const match of source.matchAll(headingPattern)) {
    const [, id, heading = "", body = ""] = match;
    const concise = `${heading} ${body}`
      .replace(/\$\\to\$/g, "then")
      .replace(/[*_#]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^[:\s-]+/, "");
    if (concise) directions.set(id, concise.slice(0, 1100));
  }
  const generalSection = source.split("# 2. General Active Abilities")[1]?.split("# 3. Status Effects")[0] || "";
  for (const match of generalSection.matchAll(/^\d+\.\s+`([^`]+)`:\s*([^\n]+)/gm)) {
    directions.set(match[1], match[2].replace(/\$\\to\$/g, "then").trim());
  }
  return directions;
}

export function buildManifest({ specPath = null } = {}) {
  const draftedDirections = parseSpecDirections(specPath);
  return skillIds().map((id) => {
    const skill = getSkill(id);
    const style = styleFor(skill);
    // The draft remains authoritative for the universal abilities. Its protagonist-bound
    // palette notes are deliberately not carried into the generalized archetype library;
    // those use the same motion taxonomy with canonical kit materials and names instead.
    const direction = EXACT_DIRECTIONS[id]
      || (!skill.archetypeId ? draftedDirections.get(id) : null)
      || visualDirection(skill);
    const motion = motionType(skill, direction);
    return Object.freeze({
      id,
      name: skill.name,
      owner: style.label,
      layout: "3x3",
      frames: 9,
      fps: 18,
      frameSize: 256,
      motion,
      direction,
      prompt: commonPromptContract(skill, style, direction, motion),
    });
  });
}

function parseCli(argv) {
  const options = {
    specPath: null,
    output: DEFAULT_OUTPUT,
    pendingDir: null,
    offset: 0,
    limit: null,
    write: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--spec") options.specPath = path.resolve(argv[++index]);
    else if (value === "--output") options.output = path.resolve(argv[++index]);
    else if (value === "--pending-dir") options.pendingDir = path.resolve(argv[++index]);
    else if (value === "--offset") options.offset = Number(argv[++index]);
    else if (value === "--limit") options.limit = Number(argv[++index]);
    else if (value === "--write") options.write = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return options;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = parseCli(process.argv.slice(2));
  const completeManifest = buildManifest({ specPath: options.specPath });
  const manifest = options.pendingDir
    ? completeManifest.filter((entry) => !fs.existsSync(path.join(options.pendingDir, `${entry.id}-v1.webp`)))
    : completeManifest;
  const slice = manifest.slice(options.offset, options.limit === null ? undefined : options.offset + options.limit);
  const serialized = `${JSON.stringify(slice, null, 2)}\n`;
  if (options.write) {
    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    fs.writeFileSync(options.output, serialized);
    console.error(`wrote ${slice.length} per-ability ImageGen prompts to ${options.output}`);
  } else {
    process.stdout.write(serialized);
  }
}
