import sceneWhitemarch from "../assets/generated/scene-whitemarch.webp";
import sceneMire from "../assets/generated/scene-mire.webp";
import sceneCrowsmoor from "../assets/generated/scene-crowsmoor.webp";
import sceneTannicWood from "../assets/generated/scene-tannic-wood.webp";
import sceneWhitemarchMarch from "../assets/generated/scene-whitemarch-march.webp";
import sceneSpine from "../assets/generated/scene-spine.webp";
import sceneBramblewych from "../assets/generated/scene-bramblewych.webp";
import sceneBonemarsh from "../assets/generated/scene-bonemarsh.webp";
import sceneSunderedWastes from "../assets/generated/scene-sundered-wastes.webp";
import sceneHollowCoast from "../assets/generated/scene-hollow-coast.webp";
import sceneWitchwood from "../assets/generated/scene-witchwood.webp";
import scenePaleSteppe from "../assets/generated/scene-pale-steppe.webp";
import sceneFarWild from "../assets/generated/scene-far-wild.webp";
import { TERRAINS } from "./terrains.js";

export const TERRAIN_VISUALS = {
  indoor: { tint: "#4b382b", ink: "#f0ddbd", glyph: "⌂", motif: "threshold" },
  settlement: { tint: "#a98b62", ink: "#f5e2c2", glyph: "▦", motif: "roofline" },
  street: { tint: "#777067", ink: "#f0ddbd", glyph: "═", motif: "cobbles" },
  wall: { tint: "#625f58", ink: "#f0ddbd", glyph: "▥", motif: "masonry" },
  road: { tint: "#8c704f", ink: "#f3dfba", glyph: "═", motif: "milestone" },
  plains: { tint: "#697553", ink: "#e8e6c7", glyph: "〰", motif: "grass" },
  hills: { tint: "#76654a", ink: "#eee0c3", glyph: "⌒", motif: "contour" },
  forest: { tint: "#354d3b", ink: "#e4e9ce", glyph: "♣", motif: "bough" },
  marsh: { tint: "#415c56", ink: "#e0e8d7", glyph: "≋", motif: "reeds" },
  mountains: { tint: "#4e4944", ink: "#eadfce", glyph: "▲", motif: "crag" },
  water: { tint: "#365a67", ink: "#dcecf0", glyph: "≈", motif: "current" },
  impassable: { tint: "#18211e", ink: "#87938a", glyph: "✕", motif: "wild" },
};

// One authored visual plate per named region. Closely related regions share a
// brushwork family but still carry their own palette, symbol, and field-note
// language so the UI changes character at the border without changing layout.
export const BIOME_VISUALS = {
  whitemarch: { image: sceneWhitemarch, primary: "#8f755d", secondary: "#c7bda8", accent: "#c38a55", deep: "#111312", symbol: "♜", mood: "chalk, iron & smoke", texture: "masonry" },
  mire: { image: sceneMire, primary: "#526f63", secondary: "#89915f", accent: "#b2a36b", deep: "#101816", symbol: "≋", mood: "peat fog & reedwater", texture: "reeds" },
  "crowsmoor-reach": { image: sceneCrowsmoor, primary: "#8b7448", secondary: "#70763f", accent: "#d0a461", deep: "#17150f", symbol: "♜", mood: "wagon ruts & watchfires", texture: "fieldstone" },
  "tannic-wood": { image: sceneTannicWood, primary: "#40563e", secondary: "#826447", accent: "#b79968", deep: "#101611", symbol: "♣", mood: "brown water & alder shade", texture: "canopy" },
  "whitemarch-march": { image: sceneWhitemarchMarch, primary: "#7d7c70", secondary: "#b8aa83", accent: "#c9a169", deep: "#151613", symbol: "⚒", mood: "chalk wind & milestones", texture: "chalk" },
  "spine-foothills": { image: sceneSpine, primary: "#6d6659", secondary: "#8d5d3c", accent: "#cf9867", deep: "#141312", symbol: "▲", mood: "high wind & thin paths", texture: "strata" },
  "bramblewych-reach": { image: sceneBramblewych, primary: "#674950", secondary: "#4f653e", accent: "#c08875", deep: "#171014", symbol: "✢", mood: "thorn bloom & lost hedges", texture: "bramble" },
  bonemarsh: { image: sceneBonemarsh, primary: "#4d5c58", secondary: "#77735f", accent: "#b6aa8b", deep: "#0e1413", symbol: "☠", mood: "black peat & old bones", texture: "peat" },
  "sundered-wastes": { image: sceneSunderedWastes, primary: "#725347", secondary: "#867055", accent: "#c18458", deep: "#17110e", symbol: "⚑", mood: "broken stone & cooksmoke", texture: "rubble" },
  "drakeholt-peaks": { image: sceneSpine, primary: "#5b6062", secondary: "#8a796c", accent: "#c9a58d", deep: "#111416", symbol: "△", mood: "snow-burned cols & wyrm smoke", texture: "ice" },
  "iron-plateau": { image: sceneWhitemarchMarch, primary: "#6f6c5d", secondary: "#8f7655", accent: "#c9935f", deep: "#141511", symbol: "◇", mood: "dress-stone & mirror light", texture: "ashlar" },
  "tellmar-road": { image: sceneCrowsmoor, primary: "#806848", secondary: "#66694b", accent: "#cda36b", deep: "#17140f", symbol: "═", mood: "caravan dust & cypress", texture: "road" },
  "hollow-coast": { image: sceneHollowCoast, primary: "#52676d", secondary: "#85887b", accent: "#aab8b5", deep: "#101618", symbol: "≈", mood: "salt fen & breathless sea", texture: "salt" },
  "witchwood-deep": { image: sceneWitchwood, primary: "#3e4e40", secondary: "#62564d", accent: "#a98b78", deep: "#0d1410", symbol: "♠", mood: "old bark & hung charms", texture: "oldwood" },
  "pale-steppe": { image: scenePaleSteppe, primary: "#8d8062", secondary: "#b2a37e", accent: "#d3b77f", deep: "#191711", symbol: "☼", mood: "bone grass & long wind", texture: "grass" },
  "far-wild": { image: sceneFarWild, primary: "#5e627c", secondary: "#49675e", accent: "#9ea5c9", deep: "#10121a", symbol: "✧", mood: "unmapped stars & nameless stone", texture: "wild" },
};

export function terrainVisual(terrain) {
  return TERRAIN_VISUALS[terrain] || { tint: TERRAINS[terrain]?.color || "#53605a", ink: "#e8dfcc", glyph: "•", motif: "unknown" };
}

export function biomeVisual(biomeId) {
  return BIOME_VISUALS[biomeId] || BIOME_VISUALS["far-wild"];
}

const WHITEMARCH_PLACE_PATTERN = /(whitemarch|grand market|chain market|crown gate|citadel|low wards|outer works|caravanserai|noble rise|whitewend|guild court|prison gate|registry hall)/i;

// Older campaigns can still stand on the retired tile-by-tile Whitemarch map,
// whose outer wards extend beyond the capital's compact biome bounds. Let the
// authored place metadata win so those saves retain the capital's identity.
export function sceneBiomeId(defaultBiomeId, tile) {
  const poi = tile?.poi || {};
  const placeContext = [tile?.place, poi.parent, poi.parentName, poi.area, poi.areaName, poi.district, poi.districtName, poi.name]
    .filter(Boolean)
    .join(" ");
  return WHITEMARCH_PLACE_PATTERN.test(placeContext) ? "whitemarch" : defaultBiomeId;
}
