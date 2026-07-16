import abilities from "../assets/generated/ui-icons/ui-icon-abilities-v1.png";
import alert from "../assets/generated/ui-icons/ui-icon-alert-v1.png";
import atlas from "../assets/generated/ui-icons/ui-icon-atlas-v1.png";
import back from "../assets/generated/ui-icons/ui-icon-back-v1.png";
import character from "../assets/generated/ui-icons/ui-icon-character-v1.png";
import close from "../assets/generated/ui-icons/ui-icon-close-v1.png";
import codex from "../assets/generated/ui-icons/ui-icon-codex-v1.png";
import combat from "../assets/generated/ui-icons/ui-icon-combat-v1.png";
import company from "../assets/generated/ui-icons/ui-icon-company-v1.png";
import compass from "../assets/generated/ui-icons/ui-icon-compass-v1.png";
import condition from "../assets/generated/ui-icons/ui-icon-condition-v1.png";
import daylight from "../assets/generated/ui-icons/ui-icon-daylight-v1.png";
import hunger from "../assets/generated/ui-icons/ui-icon-hunger-v1.png";
import inventory from "../assets/generated/ui-icons/ui-icon-inventory-v1.png";
import journal from "../assets/generated/ui-icons/ui-icon-journal-v1.png";
import map from "../assets/generated/ui-icons/ui-icon-map-v1.png";
import progress from "../assets/generated/ui-icons/ui-icon-progress-v1.png";
import play from "../assets/generated/ui-icons/ui-icon-play-v1.png";
import reset from "../assets/generated/ui-icons/ui-icon-reset-v1.png";
import resolve from "../assets/generated/ui-icons/ui-icon-resolve-v1.png";
import rest from "../assets/generated/ui-icons/ui-icon-rest-v1.png";
import send from "../assets/generated/ui-icons/ui-icon-send-v1.png";
import target from "../assets/generated/ui-icons/ui-icon-target-v1.png";
import thirst from "../assets/generated/ui-icons/ui-icon-thirst-v1.png";
import visibilityClosed from "../assets/generated/ui-icons/ui-icon-visibility-closed-v1.png";
import visibilityHalf from "../assets/generated/ui-icons/ui-icon-visibility-half-v1.png";
import visibilityOpen from "../assets/generated/ui-icons/ui-icon-visibility-open-v1.png";
import vitality from "../assets/generated/ui-icons/ui-icon-vitality-v1.png";
import world from "../assets/generated/ui-icons/ui-icon-world-v1.png";

// Semantic names are preferred at call sites. Legacy aliases keep older views
// on the same game-asset language while those views are migrated incrementally.
export const GAME_ICON_ASSETS = {
  abilities,
  alert,
  atlas,
  back,
  character,
  close,
  codex,
  combat,
  company,
  compass,
  condition,
  daylight,
  hunger,
  inventory,
  journal,
  map,
  play,
  progress,
  reset,
  resolve,
  rest,
  send,
  target,
  thirst,
  visibilityClosed,
  visibilityHalf,
  visibilityOpen,
  vitality,
  world,

  // Existing Lucide-like names.
  arrowLeft: back,
  arrowUp: progress,
  bag: inventory,
  book: codex,
  bread: hunger,
  crosshair: target,
  droplet: thirst,
  eye: visibilityOpen,
  eyeHalf: visibilityHalf,
  eyeOff: visibilityClosed,
  flame: resolve,
  globe: world,
  heart: vitality,
  moon: rest,
  shield: condition,
  sparkle: abilities,
  sun: daylight,
  swords: combat,
  user: character,
  users: company,
  x: close,
};
