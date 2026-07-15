import React from "react";
import { colors } from "./tokens.js";

const ICONS = {
  menu: <><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></>,
  send: <><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/></>,
  heart: <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>,
  flame: <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></>,
  alert: <><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></>,
  x: <><path d="M18 6 6 18"/><path d="m6 6 12 12"/></>,
  reset: <><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></>,
  map: <><path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/></>,
  book: <><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></>,
  bag: <><path d="M5 9a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><path d="M9 6V5a3 3 0 0 1 6 0v1"/><path d="M5 12h14"/></>,
  user: <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
  arrowLeft: <><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></>,
  sparkle: <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>,
  crosshair: <><circle cx="12" cy="12" r="10"/><line x1="22" x2="18" y1="12" y2="12"/><line x1="6" x2="2" y1="12" y2="12"/><line x1="12" x2="12" y1="6" y2="2"/><line x1="12" x2="12" y1="22" y2="18"/></>,
  compass: <><circle cx="12" cy="12" r="9"/><path d="m16 8-2.2 5.8L8 16l2.2-5.8z"/><circle cx="12" cy="12" r="1"/></>,
  arrowUp: <><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></>,
  globe: <><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></>,
  zoomOut: <><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/><path d="M8 11h6"/></>,
  swords: <><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" x2="19" y1="19" y2="13"/><line x1="16" x2="20" y1="16" y2="20"/><line x1="19" x2="21" y1="21" y2="19"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" x2="9" y1="14" y2="18"/><line x1="7" x2="4" y1="17" y2="20"/><line x1="3" x2="5" y1="19" y2="21"/></>,
  shield: <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>,
  // Needs glyphs — small enough to live inside a compact radial meter.
  droplet: <path d="M12 2.5c-3.5 5-5.5 8-5.5 11a5.5 5.5 0 1 0 11 0c0-3-2-6-5.5-11Z" />,
  moon:    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />,
  // Chicken drumstick (Lucide). Reads instantly as "food/hunger".
  drumstick: (
    <>
      <path d="M15.45 15.4c-2.13.65-4.3.32-5.7-1.1-2.29-2.27-1.76-6.5 1.17-9.42 2.93-2.93 7.15-3.46 9.43-1.18 1.41 1.41 1.74 3.57 1.1 5.71-1.4-.51-3.26-.02-4.64 1.36-1.38 1.38-1.87 3.23-1.36 4.63z" />
      <path d="m11.25 15.6-2.16 2.16a2.5 2.5 0 1 1-4.56 1.73 2.49 2.49 0 0 1-1.41-4.24 2.5 2.5 0 0 1 3.14-.32l2.16-2.16" />
    </>
  ),
  woodenBird: (
    <>
      <path d="M20 4 C16 4 13 7 11 9 C9 7 6 4 2 4 C5 9 8 11 11 12 C11 15 13 18 16 20 C16 16 15 13 14 11 C16 9 19 6 20 4 Z" fill="rgba(215, 167, 111, 0.2)" />
      <line x1="16" y1="10" x2="19" y2="7" stroke="rgba(230, 185, 140, 0.85)" strokeWidth="1.2" />
      <line x1="15" y1="12" x2="17.5" y2="9.5" stroke="rgba(230, 185, 140, 0.85)" strokeWidth="1.2" />
      <circle cx="11.5" cy="11.5" r="0.75" fill="#f5dcb8" />
    </>
  ),
};

export function Icon({ name, size = 16, color = "currentColor", strokeWidth = 1.5, fill = "none" }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
      fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  );
}

// Per-item glyph so the pack/shop reads at a glance. Picks an outline by the
// item's KIND (weapon/armor/shield/clothing/trinket/remedy/food/drink/tool/
// material), refined by NAME keywords (a dagger vs an axe, a helm vs boots, a
// torch vs a spyglass). Falls back to a pouch for anything uncategorised.
export function ItemIcon({ item, itemId, size = 14, style = {} }) {
  const id = itemId || item?.id || "";
  const name = (item?.name || id).toLowerCase();
  const kind = item?.kind || "";

  // 1. Special Case: Wooden Bird
  if (id === "wooden-bird") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={colors.gold} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "6px", display: "inline-block", verticalAlign: "middle", ...style }}>
        <path d="M20 4 C16 4 13 7 11 9 C9 7 6 4 2 4 C5 9 8 11 11 12 C11 15 13 18 16 20 C16 16 15 13 14 11 C16 9 19 6 20 4 Z" fill="rgba(215, 167, 111, 0.25)" />
        <line x1="16" y1="10" x2="19" y2="7" stroke={colors.parchmentMuted} strokeWidth="1.2" />
        <line x1="15" y1="12" x2="17.5" y2="9.5" stroke={colors.parchmentMuted} strokeWidth="1.2" />
        <circle cx="11.5" cy="11.5" r="0.75" fill={colors.parchmentLight} />
      </svg>
    );
  }

  let stroke = "rgba(215, 167, 111, 0.75)";
  let paths = null;

  if (kind === "weapon") {
    if (name.includes("staff") || name.includes("wand") || name.includes("grimoire") || name.includes("tome") || name.includes("codex") || name.includes("focus")) {
      stroke = "#c9b3e8";
      paths = name.includes("grimoire") || name.includes("tome") || name.includes("codex") ? (
        <>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" fill="rgba(176, 114, 230, 0.15)" />
          <path d="M12 6h5M12 10h5M12 14h5" strokeWidth="1" opacity="0.7" />
        </>
      ) : (
        <>
          <line x1="5" y1="19" x2="15" y2="9" strokeWidth="2" />
          <circle cx="17" cy="7" r="3" fill="rgba(176, 114, 230, 0.3)" stroke="#c9b3e8" strokeWidth="1.8" />
          <path d="M14 6l6-2" stroke="#c9b3e8" strokeWidth="1.2" />
          <path d="M18 4l-2 6" stroke="#c9b3e8" strokeWidth="1.2" />
        </>
      );
    } else if (name.includes("dagger") || name.includes("stiletto") || name.includes("dirk") || name.includes("knife") || name.includes("kris") || name.includes("heartseeker") || name.includes("shadowfang") || name.includes("eclipse")) {
      stroke = "rgba(215, 167, 111, 0.85)";
      paths = (
        <>
          <line x1="9" y1="15" x2="3" y2="21" strokeWidth="2" />
          <line x1="8" y1="14" x2="10" y2="16" strokeWidth="2" />
          <path d="M9 15l10-10-3-3-10 10v3z" fill="rgba(215, 167, 111, 0.15)" strokeWidth="1.5" />
        </>
      );
    } else if (name.includes("axe") || name.includes("cleaver") || name.includes("doomhewer") || name.includes("skullsplitter")) {
      stroke = "rgba(215, 167, 111, 0.85)";
      paths = (
        <>
          <line x1="9" y1="15" x2="3" y2="21" strokeWidth="2" />
          <path d="M9 15c3-3 5-4 8-4l3-3-5-5-3 3c0 3-1 5-4 8" strokeWidth="1.5" />
          <path d="M17 11c1 3 4 5 5 5v-8c-1 0-4 1-5 3z" fill="rgba(215, 167, 111, 0.2)" strokeWidth="1.5" />
        </>
      );
    } else if (name.includes("mace") || name.includes("hammer") || name.includes("club") || name.includes("morningstar") || name.includes("maul") || name.includes("skullcrusher") || name.includes("breaking")) {
      stroke = "rgba(215, 167, 111, 0.85)";
      paths = (
        <>
          <line x1="9" y1="15" x2="3" y2="21" strokeWidth="2" />
          <line x1="7" y1="13" x2="11" y2="17" />
          <rect x="11" y="5" width="8" height="8" rx="1.5" fill="rgba(215, 167, 111, 0.2)" strokeWidth="1.8" transform="rotate(45 15 9)" />
        </>
      );
    } else if (name.includes("spear") || name.includes("lance") || name.includes("pike") || name.includes("halberd") || name.includes("glaive") || name.includes("windpiercer") || name.includes("wyrmreach")) {
      stroke = "rgba(215, 167, 111, 0.85)";
      paths = (
        <>
          <line x1="3" y1="21" x2="16" y2="8" strokeWidth="2" />
          <path d="M16 8l-1.5-1.5 5.5-5.5 1.5 1.5z" fill="rgba(215, 167, 111, 0.2)" strokeWidth="1.5" />
          <line x1="14" y1="10" x2="12" y2="8" strokeWidth="1.5" />
        </>
      );
    } else if (name.includes("bow") || name.includes("arbalest") || name.includes("crossbow") || name.includes("stormreaver") || name.includes("deathknell")) {
      stroke = "rgba(215, 167, 111, 0.85)";
      paths = (
        <>
          <path d="M9 3c3 3 3 15 0 18" strokeWidth="1.8" />
          <line x1="9" y1="3" x2="9" y2="21" strokeDasharray="1.5,1.5" />
          <line x1="7" y1="12" x2="19" y2="12" strokeWidth="1.8" />
          <path d="m15 8 4 4-4 4" strokeWidth="1.5" />
        </>
      );
    } else {
      stroke = "rgba(215, 167, 111, 0.85)";
      paths = (
        <>
          <line x1="6" y1="18" x2="3" y2="21" strokeWidth="2.5" />
          <line x1="5" y1="15" x2="9" y2="19" strokeWidth="2" />
          <path d="M8 16L21 3l-2-2L6 14v2z" fill="rgba(215, 167, 111, 0.15)" strokeWidth="1.5" />
        </>
      );
    }
  } else if (kind === "shield") {
    stroke = "rgba(237, 228, 208, 0.85)";
    paths = (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="rgba(237, 228, 208, 0.15)" strokeWidth="1.8" />
        <path d="M12 5v12" strokeWidth="1" strokeDasharray="2,1" />
      </>
    );
  } else if (kind === "armor") {
    stroke = "rgba(237, 228, 208, 0.85)";
    paths = (
      <>
        <path d="M16 2H8a2 2 0 0 0-2 2v4a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V4a2 2 0 0 0-2-2z" fill="rgba(237, 228, 208, 0.1)" strokeWidth="1.8" />
        <path d="M6 8v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8" fill="rgba(237, 228, 208, 0.15)" strokeWidth="1.8" />
        <line x1="12" y1="5" x2="12" y2="14" strokeWidth="1.2" />
      </>
    );
  } else if (kind === "clothing") {
    stroke = "rgba(237, 228, 208, 0.8)";
    if (name.includes("helm") || name.includes("cap") || name.includes("coif") || name.includes("circlet") || name.includes("crown")) {
      paths = (
        <>
          <path d="M12 2C6.5 2 2 6.5 2 12v3a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3c0-5.5-4.5-10-10-10z" fill="rgba(237, 228, 208, 0.15)" strokeWidth="1.8" />
          <path d="M12 2v7" strokeWidth="1.2" />
          <path d="M7 14h10" strokeWidth="1.5" />
        </>
      );
    } else if (name.includes("boots") || name.includes("shoes")) {
      paths = (
        <>
          <path d="M4 4h4v8h6c1 0 2 1 2 2v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4z" fill="rgba(237, 228, 208, 0.1)" strokeWidth="1.8" />
          <path d="M4 13h12" strokeWidth="1.2" />
          <path d="M8 20h6" strokeWidth="1.5" />
        </>
      );
    } else if (name.includes("bracers") || name.includes("vambraces") || name.includes("gauntlets") || name.includes("gloves")) {
      paths = (
        <>
          <path d="M6 14h12l-1-10H7l-1 10z" fill="rgba(237, 228, 208, 0.1)" strokeWidth="1.8" />
          <path d="M6 14c0 3 2 5 6 5s6-2 6-5" fill="rgba(237, 228, 208, 0.15)" strokeWidth="1.5" />
          <path d="M8 22h8" strokeWidth="1.5" />
        </>
      );
    } else {
      paths = (
        <>
          <path d="M12 3a4 4 0 0 0-4 4v13c0 1 1 2 2 2h4c1 0 2-1 2-2V7a4 4 0 0 0-4-4z" fill="rgba(237, 228, 208, 0.15)" strokeWidth="1.8" />
          <path d="M4 7c0 8 2 13 4 15m12-15c0 8-2 13-4 15" strokeWidth="1.5" />
        </>
      );
    }
  } else if (kind === "trinket") {
    stroke = "#ffd700";
    if (name.includes("ring") || name.includes("band")) {
      paths = (
        <>
          <circle cx="12" cy="14" r="6" fill="rgba(255, 215, 0, 0.05)" strokeWidth="1.8" />
          <polygon points="12,4 15,8 12,10 9,8" fill="rgba(255, 215, 0, 0.3)" strokeWidth="1.5" />
        </>
      );
    } else {
      paths = (
        <>
          <path d="M6 3c1 5 3 7 6 7s5-2 6-7" strokeWidth="1.8" />
          <circle cx="12" cy="13" r="3" fill="rgba(255, 215, 0, 0.25)" strokeWidth="1.8" />
        </>
      );
    }
  } else if (kind === "remedy") {
    stroke = "#a7f3d0";
    paths = (
      <>
        <path d="M10 2h4v3h-4z" />
        <path d="M8 9a4 4 0 0 0-3 3.87v5.26A2.87 2.87 0 0 0 7.87 21h8.26A2.87 2.87 0 0 0 19 18.13v-5.26A4 4 0 0 0 16 9" fill="rgba(167, 243, 208, 0.15)" strokeWidth="1.8" />
        <line x1="8" y1="5" x2="16" y2="5" />
        <line x1="9" y1="14" x2="15" y2="14" strokeWidth="1" strokeDasharray="1,1" />
      </>
    );
  } else if (kind === "food") {
    stroke = "rgba(230, 160, 120, 0.85)";
    paths = (
      <>
        <path d="M15.45 15.4c-2.13.65-4.3.32-5.7-1.1-2.29-2.27-1.76-6.5 1.17-9.42 2.93-2.93 7.15-3.46 9.43-1.18 1.41 1.41 1.74 3.57 1.1 5.71-1.4-.51-3.26-.02-4.64 1.36-1.38 1.38-1.87 3.23-1.36 4.63z" fill="rgba(230, 160, 120, 0.15)" strokeWidth="1.8" />
        <path d="m11.25 15.6-2.16 2.16a2.5 2.5 0 1 1-4.56 1.73 2.49 2.49 0 0 1-1.41-4.24 2.5 2.5 0 0 1 3.14-.32l2.16-2.16" strokeWidth="1.5" />
      </>
    );
  } else if (kind === "drink") {
    stroke = "rgba(127, 199, 224, 0.85)";
    paths = (
      <>
        <path d="M6 3h12v4c0 3-2 6-6 6s-6-3-6-6V3z" fill="rgba(127, 199, 224, 0.1)" strokeWidth="1.8" />
        <line x1="12" y1="13" x2="12" y2="20" strokeWidth="1.8" />
        <path d="M8 21h8" strokeWidth="1.8" />
      </>
    );
  } else if (kind === "tool") {
    stroke = "rgba(180, 180, 170, 0.85)";
    if (name.includes("rope") || name.includes("wire") || name.includes("string") || name.includes("lasso")) {
      paths = (
        <>
          <circle cx="12" cy="12" r="7" fill="rgba(180, 180, 170, 0.05)" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="4" strokeWidth="1.2" strokeDasharray="2,1" />
          <path d="M12 5c2-2 5-2 5 1s-4 4-7 4" strokeWidth="1.5" />
        </>
      );
    } else if (name.includes("torch") || name.includes("lantern") || name.includes("tinderbox") || name.includes("oil")) {
      stroke = "#e6a878";
      paths = (
        <>
          <path d="M18 10c0 4-3 7-6 7s-6-3-6-7c0-3.5 2-6.5 5.5-9 1 3.5 2.5 4.5 4 4.5 1.5 0 2.5-1.5 2.5-1.5 0 1.5 0 4.5 0 6z" fill="rgba(239, 137, 72, 0.15)" strokeWidth="1.8" />
          <line x1="8" y1="16" x2="6" y2="22" strokeWidth="2" />
        </>
      );
    } else if (name.includes("spyglass")) {
      paths = (
        <>
          <line x1="4" y1="20" x2="20" y2="4" strokeWidth="2.2" />
          <circle cx="20" cy="4" r="2" fill="rgba(180, 180, 170, 0.2)" />
          <line x1="8" y1="16" x2="6" y2="14" />
          <line x1="14" y1="10" x2="12" y2="8" />
        </>
      );
    } else if (name.includes("spade") || name.includes("shovel") || name.includes("pick") || name.includes("crowbar") || name.includes("hammer")) {
      paths = (
        <>
          <line x1="19" y1="5" x2="5" y2="19" strokeWidth="2" />
          <path d="M15 5C13 3 8 4 6 6s-3 7-1 9l4-4 4 4-4 4" fill="rgba(180, 180, 170, 0.1)" strokeWidth="1.8" />
        </>
      );
    } else {
      paths = (
        <>
          <path d="M6 20a6 6 0 0 0 12 0V10a6 6 0 0 0-12 0v10z" fill="rgba(180, 180, 170, 0.05)" />
          <path d="M6 10c0-2.5 1.5-4 6-4s6 1.5 6 4" />
          <path d="M9 6a3 3 0 0 1 6 0" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </>
      );
    }
  } else if (kind === "material") {
    if (name.includes("ingot")) {
      stroke = "rgba(215, 167, 111, 0.9)";
      paths = (
        <>
          <path d="M2 17l4-8h12l4 8H2z" fill="rgba(215, 167, 111, 0.15)" strokeWidth="1.8" />
          <path d="M6 9l3-5h6l3 5" fill="rgba(215, 167, 111, 0.1)" strokeWidth="1.5" />
          <line x1="9" y1="17" x2="9" y2="9" strokeWidth="1" />
          <line x1="15" y1="17" x2="15" y2="9" strokeWidth="1" />
        </>
      );
    } else if (name.includes("rune")) {
      stroke = "#b072e6";
      paths = (
        <>
          <circle cx="12" cy="12" r="8" fill="rgba(176, 114, 230, 0.2)" strokeWidth="2" />
          <path d="M12 7l3 5-3 5-3-5z" fill="rgba(176, 114, 230, 0.3)" strokeWidth="1.5" />
        </>
      );
    } else if (name.includes("hide")) {
      stroke = "rgba(215, 167, 111, 0.75)";
      paths = (
        <>
          <path d="M4 4c3 0 3-2 8-2s5 2 8 2v16c-3 0-3 2-8 2s-5-2-8-2V4z" fill="rgba(215, 167, 111, 0.15)" strokeWidth="1.8" />
          <path d="M4 12h16" strokeWidth="1" strokeDasharray="2,2" />
          <path d="M12 2v20" strokeWidth="1" strokeDasharray="2,2" />
        </>
      );
    } else if (name.includes("haft") || name.includes("stave")) {
      stroke = "rgba(215, 167, 111, 0.75)";
      paths = (
        <>
          <rect x="4" y="8" width="16" height="8" rx="2" fill="rgba(215, 167, 111, 0.1)" strokeWidth="1.8" transform="rotate(-15 12 12)" />
          <line x1="8" y1="9" x2="16" y2="11" strokeWidth="1" />
          <line x1="7" y1="12" x2="15" y2="14" strokeWidth="1" />
        </>
      );
    } else {
      stroke = "rgba(215, 167, 111, 0.75)";
      paths = (
        <>
          <circle cx="12" cy="12" r="6" fill="rgba(215, 167, 111, 0.1)" strokeWidth="1.8" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" strokeWidth="1" />
        </>
      );
    }
  } else {
    stroke = "rgba(215, 167, 111, 0.75)";
    paths = (
      <>
        <path d="M6 20a6 6 0 0 0 12 0V10a6 6 0 0 0-12 0v10z" fill="rgba(215, 167, 111, 0.05)" />
        <path d="M6 10c0-2.5 1.5-4 6-4s6 1.5 6 4" />
        <path d="M9 6a3 3 0 0 1 6 0" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </>
    );
  }

  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ marginRight: "6px", display: "inline-block", verticalAlign: "middle", ...style }}>
      {paths}
    </svg>
  );
}
