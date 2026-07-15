// The live scene registry uses only the high-definition oil-painted plates.
// Retired pixel and duplicate source exports are no longer part of the tree.
import sceneWhitemarch from "../assets/generated/scene-whitemarch-v2.webp";
import sceneMire from "../assets/generated/scene-mire-v2.webp";
import sceneCrowsmoor from "../assets/generated/scene-crowsmoor-v2.webp";
import sceneTannicWood from "../assets/generated/scene-tannic-wood-v2.webp";
import sceneWhitemarchMarch from "../assets/generated/scene-whitemarch-march-v2.webp";
import sceneSpine from "../assets/generated/scene-spine-v2.webp";
import sceneDrakeholtPeaks from "../assets/generated/scene-drakeholt-peaks-v2.webp";
import sceneIronPlateau from "../assets/generated/scene-iron-plateau-v2.webp";
import sceneTellmarRoad from "../assets/generated/scene-tellmar-road-v2.webp";
import sceneBramblewych from "../assets/generated/scene-bramblewych-v2.webp";
import sceneBonemarsh from "../assets/generated/scene-bonemarsh-v2.webp";
import sceneSunderedWastes from "../assets/generated/scene-sundered-wastes-v2.webp";
import sceneHollowCoast from "../assets/generated/scene-hollow-coast-v2.webp";
import sceneWitchwood from "../assets/generated/scene-witchwood-v2.webp";
import scenePaleSteppe from "../assets/generated/scene-pale-steppe-v2.webp";
import sceneFarWild from "../assets/generated/scene-far-wild-v2.webp";
import { TERRAINS } from "./terrains.js";

export const TERRAIN_VISUALS = {
  indoor: { tint: "#7a5d45", ink: "#fff0d0", glyph: "⌂", motif: "threshold" },
  settlement: { tint: "#c69a66", ink: "#fff4d6", glyph: "▦", motif: "roofline" },
  street: { tint: "#8aa2ad", ink: "#f6edda", glyph: "═", motif: "cobbles" },
  wall: { tint: "#a9a6a0", ink: "#fff0d0", glyph: "▥", motif: "masonry" },
  road: { tint: "#c49055", ink: "#ffedc4", glyph: "═", motif: "milestone" },
  plains: { tint: "#86a866", ink: "#f2f3ce", glyph: "〰", motif: "grass" },
  hills: { tint: "#ad875d", ink: "#f8e7c8", glyph: "⌒", motif: "contour" },
  forest: { tint: "#3f7e59", ink: "#eaf4d5", glyph: "♣", motif: "bough" },
  marsh: { tint: "#3d8a82", ink: "#e4f2e5", glyph: "≋", motif: "reeds" },
  mountains: { tint: "#6c8198", ink: "#f1e8da", glyph: "▲", motif: "crag" },
  water: { tint: "#347fa4", ink: "#e3f5fa", glyph: "≈", motif: "current" },
  impassable: { tint: "#33475e", ink: "#a7b7c3", glyph: "✕", motif: "wild" },
};

// One authored visual plate per named region. Closely related regions share a
// brushwork family but still carry their own palette, symbol, and field-note
// language so the UI changes character at the border without changing layout.
export const BIOME_VISUALS = {
  whitemarch: { image: sceneWhitemarch, primary: "#5b91b6", secondary: "#c9e7ef", accent: "#e8ad54", deep: "#0b2639", symbol: "♜", mood: "sunlit spires & crystal gardens", texture: "masonry" },
  mire: { image: sceneMire, primary: "#3d8f8a", secondary: "#91c785", accent: "#f0cb74", deep: "#0b3038", symbol: "≋", mood: "lotus water & lantern reeds", texture: "reeds" },
  "crowsmoor-reach": { image: sceneCrowsmoor, primary: "#7169a5", secondary: "#8fbb6d", accent: "#f3bd64", deep: "#162a45", symbol: "♜", mood: "heather wind & star stones", texture: "fieldstone" },
  "tannic-wood": { image: sceneTannicWood, primary: "#4d8a60", secondary: "#d59c52", accent: "#f2c56f", deep: "#102f38", symbol: "♣", mood: "amber leaves & tealwater", texture: "canopy" },
  "whitemarch-march": { image: sceneWhitemarchMarch, primary: "#6f9d77", secondary: "#a9d2de", accent: "#e9b45f", deep: "#143343", symbol: "⚒", mood: "spring roads & ivory horizons", texture: "chalk" },
  "spine-foothills": { image: sceneSpine, primary: "#6b91bb", secondary: "#a9d8e8", accent: "#f5c779", deep: "#132a43", symbol: "▲", mood: "bright snow & singing falls", texture: "strata" },
  "bramblewych-reach": { image: sceneBramblewych, primary: "#a65f87", secondary: "#61a06c", accent: "#f1bd72", deep: "#24304a", symbol: "✢", mood: "rose arches & hedge-lights", texture: "bramble" },
  bonemarsh: { image: sceneBonemarsh, primary: "#6ea1a0", secondary: "#e5c5a1", accent: "#f3c884", deep: "#163548", symbol: "✧", mood: "pearl reeds & ancient stone", texture: "peat" },
  "sundered-wastes": { image: sceneSunderedWastes, primary: "#c97b5f", secondary: "#d9ac6e", accent: "#62c4c6", deep: "#3d2940", symbol: "⚑", mood: "rose mesas & turquoise springs", texture: "rubble" },
  "drakeholt-peaks": { image: sceneDrakeholtPeaks, primary: "#789dc1", secondary: "#d5e6ec", accent: "#f0c58b", deep: "#162b47", symbol: "△", mood: "snowlit cols & cloudfire", texture: "ice" },
  "iron-plateau": { image: sceneIronPlateau, primary: "#789aa0", secondary: "#b7c4a3", accent: "#dfb75e", deep: "#18313e", symbol: "◇", mood: "mirror stone & high meadows", texture: "ashlar" },
  "tellmar-road": { image: sceneTellmarRoad, primary: "#a88955", secondary: "#7daa76", accent: "#e6b765", deep: "#203342", symbol: "═", mood: "cypress shade & bright caravans", texture: "road" },
  "hollow-coast": { image: sceneHollowCoast, primary: "#4389aa", secondary: "#8fc7c0", accent: "#f1c56c", deep: "#0d324b", symbol: "≈", mood: "sapphire wind & ivory cliffs", texture: "salt" },
  "witchwood-deep": { image: sceneWitchwood, primary: "#4b8d72", secondary: "#8a6caf", accent: "#bfe28c", deep: "#172c46", symbol: "♠", mood: "violet boughs & spirit-bloom", texture: "oldwood" },
  "pale-steppe": { image: scenePaleSteppe, primary: "#b39e61", secondary: "#8fc1ce", accent: "#f0bd65", deep: "#243549", symbol: "☼", mood: "silver grass & ribbon-light", texture: "grass" },
  "far-wild": { image: sceneFarWild, primary: "#667fc4", secondary: "#54a58b", accent: "#d9b5ff", deep: "#1c294a", symbol: "✧", mood: "crystal meadows & aurora ruins", texture: "wild" },
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
